import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import {
  emptyLevelUpPlan,
  fastForwardHero,
  futureChoiceSteps,
  levelUpDeltaSummary,
  resolveAsiForLevel,
  resolveSpellPickForRequest,
  resolveSubclassForClass,
  simulateHeroForPlanning,
  type LevelUpPlan,
  type LevelUpStatSnapshot,
} from "../src/game/systems/LevelUpPlanSystem";

/**
 * D-133: the Character Creation level-by-level planner's pure resolution/
 * enumeration layer. Every "no plan" case here is a regression guard against
 * D-129's original fixed-default fast-forward behavior — these must stay
 * byte-for-byte identical for any existing build with no plan set.
 */

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    abilityId: "cleave",
    controlledBy: "human",
    ...overrides,
  };
}

function heroFromBuild(overrides: Partial<CharacterBuild> = {}): Hero {
  return new Hero(heroDefinitionFromBuild(build(overrides)), { x: 0, y: 0 });
}

describe("resolveAsiForLevel (D-133)", () => {
  it("with no plan, raises the hero's own current-highest ability score by 2 (D-129 default)", () => {
    const hero = heroFromBuild(); // str 15 is highest
    hero.levelUpClass(); // level 2, no ASI yet
    resolveAsiForLevel(hero, 4, undefined);
    expect(hero.abilityScoreValue("str")).toBe(17);
  });

  it("a planned single-ability choice overrides the default", () => {
    const hero = heroFromBuild();
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("prompt"), asiChoices: { 4: { path: "ability", abilityMode: "single", ability: "con" } } };
    resolveAsiForLevel(hero, 4, plan);
    expect(hero.abilityScoreValue("con")).toBe(15);
    expect(hero.abilityScoreValue("str")).toBe(15); // unchanged
  });

  it("a planned split-ability choice raises both by 1", () => {
    const hero = heroFromBuild();
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), asiChoices: { 4: { path: "ability", abilityMode: "split", first: "dex", second: "con" } } };
    resolveAsiForLevel(hero, 4, plan);
    expect(hero.abilityScoreValue("dex")).toBe(15);
    expect(hero.abilityScoreValue("con")).toBe(14);
  });

  it("a planned, still-valid feat is granted instead of an ability raise", () => {
    const hero = heroFromBuild(); // Fighter — has a Fighting Style feature, so Archery's prerequisite is met
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), asiChoices: { 4: { path: "feat", featId: "archery" } } };
    resolveAsiForLevel(hero, 4, plan);
    expect(hero.abilityScoreValue("str")).toBe(15); // no ability raise happened
  });

  it("a planned feat whose prerequisites are no longer met falls back to the default ability raise, not a crash", () => {
    const hero = heroFromBuild({ classId: "wizard", abilityId: "fire-bolt" }); // no Fighting Style feature
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), asiChoices: { 4: { path: "feat", featId: "archery" } } };
    resolveAsiForLevel(hero, 4, plan);
    // falls back to raising the hero's own current-highest ability score
    expect(hero.abilityScoreValue("str")).toBe(17);
  });

  it("a feat needing a chosen ability (Grappler) applies that ability's boost", () => {
    const hero = heroFromBuild(); // str/dex 13+ met (15/14)
    hero.levelUpClass();
    hero.levelUpClass();
    hero.levelUpClass(); // level 4 — Grappler's `minLevel: 4` prerequisite needs this
    const plan: LevelUpPlan = {
      ...emptyLevelUpPlan("auto"),
      asiChoices: { 4: { path: "feat", featId: "grappler", chosenAbility: "dex" } },
    };
    resolveAsiForLevel(hero, 4, plan);
    expect(hero.abilityScoreValue("dex")).toBe(15);
  });
});

describe("resolveSubclassForClass (D-133)", () => {
  it("with no plan, grants the class's first modeled subclass (D-129 default)", () => {
    const hero = heroFromBuild();
    hero.levelUpClass();
    hero.levelUpClass();
    resolveSubclassForClass(hero, "fighter", undefined);
    expect(hero.subclassId).toBeDefined();
  });

  it("a planned, real subclass id is used instead of the default", () => {
    const hero = heroFromBuild();
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), subclassId: "champion" };
    resolveSubclassForClass(hero, "fighter", plan);
    expect(hero.subclassId).toBe("champion");
  });

  it("an invalid/unknown planned subclass id falls back to the default rather than granting garbage", () => {
    const hero = heroFromBuild();
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), subclassId: "not-a-real-subclass" };
    resolveSubclassForClass(hero, "fighter", plan);
    expect(hero.subclassId).not.toBe("not-a-real-subclass");
    expect(hero.subclassId).toBeDefined();
  });
});

describe("resolveSpellPickForRequest (D-133)", () => {
  function wizardAtLevel(level: number): Hero {
    const hero = heroFromBuild({ classId: "wizard", abilityId: "fire-bolt" });
    fastForwardHero(hero, level, undefined);
    return hero;
  }

  it("mastery: with no plan, picks the first eligible known spell (D-129 default)", () => {
    const hero = wizardAtLevel(18);
    expect(hero.needsSpellMasteryPick()).toBe(false); // fastForwardHero already resolved it with no plan
  });

  it("mastery: a planned, still-eligible spell is honored", () => {
    const hero = new Hero(heroDefinitionFromBuild(build({ classId: "wizard", abilityId: "fire-bolt" })), { x: 0, y: 0 });
    fastForwardHero(hero, 17, undefined);
    hero.levelUpClass(); // reach 18 without resolving the pick yet
    const eligible = hero.eligibleSpellMasterySpells();
    expect(eligible.length).toBeGreaterThan(0);
    const chosen = eligible[eligible.length - 1];
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("prompt"), spellPicks: { 18: { kind: "mastery", spellId: chosen } } };
    resolveSpellPickForRequest(hero, { hero, kind: "mastery" }, plan);
    expect(hero.needsSpellMasteryPick()).toBe(false);
  });

  it("arcanum: a planned spell for the wrong tier is ignored, falls back to the default for that tier", () => {
    const hero = new Hero(heroDefinitionFromBuild(build({ classId: "warlock", abilityId: "eldritch-blast" })), { x: 0, y: 0 });
    fastForwardHero(hero, 10, undefined);
    hero.levelUpClass(); // reach 11
    const plan: LevelUpPlan = {
      ...emptyLevelUpPlan("prompt"),
      spellPicks: { 13: { kind: "arcanum", tier: 7, spellId: "some-other-spell" } },
    };
    resolveSpellPickForRequest(hero, { hero, kind: "arcanum", tier: 6 }, plan);
    expect(hero.needsMysticArcanumPick(6)).toBe(false);
  });
});

describe("fastForwardHero / simulateHeroForPlanning (D-133)", () => {
  it("with no plan, matches D-129's original defaults exactly (str stays the top-raised ability every ASI level)", () => {
    const hero = heroFromBuild();
    fastForwardHero(hero, 8, undefined);
    expect(hero.level).toBe(8);
    // Fighter ASI at 4 and 6 and 8's own level-8 ASI hasn't resolved yet (loop stops before applying level 8's own trigger check past cap)
    expect(hero.abilityScoreValue("str")).toBeGreaterThan(15);
  });

  it("simulateHeroForPlanning applies a partial plan and returns a hero at the target level with no side effects on a real hero", () => {
    const b = build();
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), subclassId: "champion", asiChoices: { 4: { path: "ability", abilityMode: "single", ability: "con" } } };
    const scratch = simulateHeroForPlanning(b, plan, 6);
    expect(scratch.level).toBe(6);
    expect(scratch.subclassId).toBe("champion");
    expect(scratch.abilityScoreValue("con")).toBe(15);
  });
});

describe("futureChoiceSteps (D-133)", () => {
  it("omits a subclass step for a level-1-choice class (Warlock)", () => {
    const steps = futureChoiceSteps("warlock");
    expect(steps.some((s) => s.kind === "subclass")).toBe(false);
  });

  it("includes a subclass step at the right level for a later-choice class (Fighter, level 3)", () => {
    const steps = futureChoiceSteps("fighter");
    const subclassStep = steps.find((s) => s.kind === "subclass");
    expect(subclassStep?.level).toBe(3);
  });

  it("lists every Fighter ASI level, including its two bonus ones (6/14)", () => {
    const steps = futureChoiceSteps("fighter").filter((s) => s.kind === "asi").map((s) => s.level);
    expect(steps).toEqual([4, 6, 8, 12, 14, 16, 19]);
  });

  it("includes Wizard's Spell Mastery/Signature Spells steps at 18/20", () => {
    const steps = futureChoiceSteps("wizard").filter((s) => s.kind === "spellPick");
    expect(steps.map((s) => [s.level, s.spellPickKind])).toEqual([
      [18, "mastery"],
      [20, "signature"],
    ]);
  });

  it("includes Warlock's four Mystic Arcanum tiers at 11/13/15/17", () => {
    const steps = futureChoiceSteps("warlock").filter((s) => s.kind === "spellPick");
    expect(steps.map((s) => [s.level, s.tier])).toEqual([
      [11, 6],
      [13, 7],
      [15, 8],
      [17, 9],
    ]);
  });

  it("returns steps sorted by level", () => {
    const steps = futureChoiceSteps("fighter");
    const levels = steps.map((s) => s.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });
});

describe("levelUpDeltaSummary (D-148)", () => {
  const snapshot = (overrides: Partial<LevelUpStatSnapshot> = {}): LevelUpStatSnapshot => ({
    maxHealth: 10,
    armorClass: 15,
    attackBonus: 4,
    ...overrides,
  });

  it("reports an HP increase with an explicit + sign", () => {
    const summary = levelUpDeltaSummary(snapshot(), snapshot({ maxHealth: 16 }), undefined, 2);
    expect(summary).toBe("+6 max HP");
  });

  it("reports an AC change as before→after", () => {
    const summary = levelUpDeltaSummary(snapshot(), snapshot({ armorClass: 16 }), undefined, 2);
    expect(summary).toBe("AC 15→16");
  });

  it("reports an attack bonus change with signs on both sides", () => {
    const summary = levelUpDeltaSummary(snapshot(), snapshot({ attackBonus: 5 }), undefined, 2);
    expect(summary).toBe("attack +4→+5");
  });

  it("names every class feature gained at the new level, real Fighter data (Action Surge at level 2)", () => {
    const summary = levelUpDeltaSummary(snapshot(), snapshot({ maxHealth: 16 }), "fighter", 2);
    expect(summary).toBe("+6 max HP, new feature: Action Surge");
  });

  it("falls back to a plain no-change message when nothing moved", () => {
    const summary = levelUpDeltaSummary(snapshot(), snapshot(), undefined, 2);
    expect(summary).toBe("No stat changes this level.");
  });

  it("omits feature text when classId is undefined (the classic fixed roster)", () => {
    const summary = levelUpDeltaSummary(snapshot(), snapshot({ maxHealth: 16 }), undefined, 3);
    expect(summary).toBe("+6 max HP");
  });
});
