import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import { subclassesForClass } from "../src/game/data/subclasses";
import { getSpell } from "../src/game/data/spells";
import { eligibleCantripPool, eligibleLeveledSpellPool, maxCastableSpellLevel } from "../src/game/systems/SpellPreparationSystem";
import {
  autoResolveAsiForLevel,
  autoResolveSpellPickForRequest,
  autoResolveSubclassForClass,
  emptyLevelUpPlan,
  fastForwardHero,
  futureChoiceSteps,
  levelUpDeltaSummary,
  resolveAsiForLevel,
  resolveSpellPickForRequest,
  resolveSpellSwapStepsForLevel,
  resolveSubclassForClass,
  simulateHeroForPlanning,
  type LevelUpPlan,
  type LevelUpStatSnapshot,
} from "../src/game/systems/LevelUpPlanSystem";

/**
 * D-133: the Character Creation level-by-level planner's pure resolution/
 * enumeration layer. D-16x removed every silent fallback default (Kevin's
 * own words: "I want all blue-prints to be player-made") — every "no plan"
 * case here now asserts the resolver returns unresolved (`false`, or an
 * unresolved step from `fastForwardHero`) with NO mutation to the hero,
 * rather than the old D-129 fixed-default behavior.
 */

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    controlledBy: "human",
    ...overrides,
  };
}

function heroFromBuild(overrides: Partial<CharacterBuild> = {}): Hero {
  return new Hero(heroDefinitionFromBuild(build(overrides)), { x: 0, y: 0 });
}

describe("resolveAsiForLevel (D-133)", () => {
  it("with no plan, resolves nothing — returns false, no ability score changes", () => {
    const hero = heroFromBuild(); // str 15 is highest
    hero.levelUpClass(); // level 2, no ASI yet
    expect(resolveAsiForLevel(hero, 4, undefined)).toBe(false);
    expect(hero.abilityScoreValue("str")).toBe(15);
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

  it("a planned feat whose prerequisites are no longer met resolves nothing, not a crash", () => {
    const hero = heroFromBuild({ classId: "wizard" }); // no Fighting Style feature
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), asiChoices: { 4: { path: "feat", featId: "archery" } } };
    expect(resolveAsiForLevel(hero, 4, plan)).toBe(false);
    expect(hero.abilityScoreValue("str")).toBe(15); // unchanged — no fallback ability raise anymore
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
  it("with no plan, resolves nothing — returns false, no subclass granted", () => {
    const hero = heroFromBuild();
    hero.levelUpClass();
    hero.levelUpClass();
    expect(resolveSubclassForClass(hero, "fighter", undefined)).toBe(false);
    expect(hero.subclassId).toBeUndefined();
  });

  it("a planned, real subclass id is used instead of the default", () => {
    const hero = heroFromBuild();
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), subclassId: "champion" };
    resolveSubclassForClass(hero, "fighter", plan);
    expect(hero.subclassId).toBe("champion");
  });

  it("an invalid/unknown planned subclass id resolves nothing rather than granting garbage", () => {
    const hero = heroFromBuild();
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("auto"), subclassId: "not-a-real-subclass" };
    expect(resolveSubclassForClass(hero, "fighter", plan)).toBe(false);
    expect(hero.subclassId).toBeUndefined();
  });
});

describe("resolveSpellPickForRequest (D-133)", () => {
  function wizardAtLevel(level: number): Hero {
    const hero = heroFromBuild({ classId: "wizard" });
    fastForwardHero(hero, level, undefined);
    return hero;
  }

  it("mastery: with no plan, resolves nothing — the pick stays outstanding", () => {
    const hero = wizardAtLevel(18);
    expect(hero.needsSpellMasteryPick()).toBe(true); // fastForwardHero leaves it unresolved with no plan
  });

  it("mastery: a planned, still-eligible spell is honored", () => {
    const hero = new Hero(heroDefinitionFromBuild(build({ classId: "wizard" })), { x: 0, y: 0 });
    fastForwardHero(hero, 17, undefined);
    hero.levelUpClass(); // reach 18 without resolving the pick yet
    const eligible = hero.eligibleSpellMasterySpells();
    expect(eligible.length).toBeGreaterThan(0);
    const chosen = eligible[eligible.length - 1];
    const plan: LevelUpPlan = { ...emptyLevelUpPlan("prompt"), spellPicks: { 18: { kind: "mastery", spellId: chosen } } };
    expect(resolveSpellPickForRequest(hero, { hero, kind: "mastery" }, plan)).toBe(true);
    expect(hero.needsSpellMasteryPick()).toBe(false);
  });

  it("arcanum: a planned spell for the wrong tier is ignored — resolves nothing for the actual tier", () => {
    const hero = new Hero(heroDefinitionFromBuild(build({ classId: "warlock" })), { x: 0, y: 0 });
    fastForwardHero(hero, 10, undefined);
    hero.levelUpClass(); // reach 11
    const plan: LevelUpPlan = {
      ...emptyLevelUpPlan("prompt"),
      spellPicks: { 13: { kind: "arcanum", tier: 7, spellId: "some-other-spell" } },
    };
    expect(resolveSpellPickForRequest(hero, { hero, kind: "arcanum", tier: 6 }, plan)).toBe(false);
    expect(hero.needsMysticArcanumPick(6)).toBe(true); // still outstanding — no fallback pick anymore
  });
});

describe("resolveSpellSwapStepsForLevel (D-199, Party Creation Overhaul Plan 6.5)", () => {
  function sorcererAtLevel(level: number): Hero {
    const hero = heroFromBuild({ classId: "sorcerer" });
    fastForwardHero(hero, level, undefined);
    return hero;
  }

  function plannedSwaps(hero: Hero, level: number): LevelUpPlan {
    const dropCantrip = hero.knownCantripIds[0];
    const learnCantrip = eligibleCantripPool("sorcerer").find((id) => !hero.knownCantripIds.includes(id))!;
    const dropPrepared = hero.preparedSpellIds[0];
    const maxLevel = maxCastableSpellLevel("sorcerer", level);
    const learnPrepared = eligibleLeveledSpellPool("sorcerer").find(
      (id) => !hero.preparedSpellIds.includes(id) && getSpell(id).level <= maxLevel,
    )!;
    return {
      ...emptyLevelUpPlan("auto"),
      spellSwaps: {
        [level]: [
          { kind: "cantrips", dropId: dropCantrip, learnId: learnCantrip },
          { kind: "prepared", dropId: dropPrepared, learnId: learnPrepared },
        ],
      },
    };
  }

  it("with no plan, resolves nothing — returns false, no mutation", () => {
    const hero = sorcererAtLevel(2);
    const beforeCantrips = [...hero.knownCantripIds];
    const beforePrepared = [...hero.preparedSpellIds];
    expect(resolveSpellSwapStepsForLevel(hero, 2, undefined)).toBe(false);
    expect([...hero.knownCantripIds]).toEqual(beforeCantrips);
    expect([...hero.preparedSpellIds]).toEqual(beforePrepared);
  });

  it("resolves a fully-planned swap (both kinds) atomically", () => {
    const hero = sorcererAtLevel(2);
    const plan = plannedSwaps(hero, 2);
    const [cantripChoice, preparedChoice] = plan.spellSwaps[2]!;
    expect(resolveSpellSwapStepsForLevel(hero, 2, plan)).toBe(true);
    expect(hero.knownCantripIds).toContain(cantripChoice.learnId);
    expect(hero.knownCantripIds).not.toContain(cantripChoice.dropId);
    expect(hero.preparedSpellIds).toContain(preparedChoice.learnId);
    expect(hero.preparedSpellIds).not.toContain(preparedChoice.dropId);
  });

  it("a partial plan (only one of the two needed kinds) resolves nothing — atomic all-or-nothing", () => {
    const hero = sorcererAtLevel(2);
    const beforeCantrips = [...hero.knownCantripIds];
    const beforePrepared = [...hero.preparedSpellIds];
    const full = plannedSwaps(hero, 2);
    const cantripOnly: LevelUpPlan = { ...full, spellSwaps: { 2: [full.spellSwaps[2]![0]] } };
    expect(resolveSpellSwapStepsForLevel(hero, 2, cantripOnly)).toBe(false);
    expect([...hero.knownCantripIds]).toEqual(beforeCantrips);
    expect([...hero.preparedSpellIds]).toEqual(beforePrepared);
  });

  it("a stale dropId (no longer known) resolves nothing rather than crashing", () => {
    const hero = sorcererAtLevel(2);
    const full = plannedSwaps(hero, 2);
    const stale: LevelUpPlan = {
      ...full,
      spellSwaps: { 2: [{ kind: "cantrips", dropId: "not-a-known-cantrip", learnId: full.spellSwaps[2]![0].learnId }, full.spellSwaps[2]![1]] },
    };
    expect(resolveSpellSwapStepsForLevel(hero, 2, stale)).toBe(false);
  });

  it("no swap opportunity at this level/class resolves true with no mutation (Fighter, a non-caster)", () => {
    const hero = heroFromBuild(); // Fighter
    hero.levelUpClass();
    expect(resolveSpellSwapStepsForLevel(hero, 2, undefined)).toBe(true);
  });

  it("fastForwardHero silently applies a planned swap along the way", () => {
    const scratch = heroFromBuild({ classId: "sorcerer" });
    fastForwardHero(scratch, 2, undefined);
    const plan = plannedSwaps(scratch, 2);
    const [cantripChoice, preparedChoice] = plan.spellSwaps[2]!;

    const hero = heroFromBuild({ classId: "sorcerer" });
    fastForwardHero(hero, 2, plan);
    expect(hero.knownCantripIds).toContain(cantripChoice.learnId);
    expect(hero.preparedSpellIds).toContain(preparedChoice.learnId);
  });

  it("fastForwardHero leaves an unplanned swap untouched — matches the baseline before D-199", () => {
    const hero = heroFromBuild({ classId: "sorcerer" });
    const before = new Hero(heroDefinitionFromBuild(build({ classId: "sorcerer" })), { x: 0, y: 0 });
    fastForwardHero(hero, 5, undefined);
    fastForwardHero(before, 5, undefined);
    expect([...hero.knownCantripIds]).toEqual([...before.knownCantripIds]);
    expect([...hero.preparedSpellIds]).toEqual([...before.preparedSpellIds]);
  });
});

describe("fastForwardHero / simulateHeroForPlanning (D-133)", () => {
  it("with no plan, resolves nothing silently — every ASI/subclass trigger comes back unresolved, hero stats unchanged", () => {
    const hero = heroFromBuild(); // Fighter, str 15
    const unresolved = fastForwardHero(hero, 8, undefined);
    expect(hero.level).toBe(8);
    expect(hero.abilityScoreValue("str")).toBe(15); // no ASI silently applied
    expect(hero.subclassId).toBeUndefined(); // no subclass silently granted
    expect(unresolved.map((s) => ({ level: s.level, kind: s.kind }))).toEqual([
      { level: 3, kind: "subclass" },
      { level: 4, kind: "asi" },
      { level: 6, kind: "asi" },
      { level: 8, kind: "asi" },
    ]);
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

  it("includes both cantrip and prepared spellSwap steps for Sorcerer at level 2 (D-199)", () => {
    const kinds = futureChoiceSteps("sorcerer")
      .filter((s) => s.kind === "spellSwap" && s.level === 2)
      .map((s) => s.spellSwapKind)
      .sort();
    expect(kinds).toEqual(["cantrips", "prepared"]);
  });

  it("has no spellSwap steps for Wizard — its swap cadence is Long-Rest-only (D-199)", () => {
    expect(futureChoiceSteps("wizard").some((s) => s.kind === "spellSwap")).toBe(false);
  });

  it("has only cantrip spellSwap steps for Cleric — its PREPARED list is a full relist, Long-Rest-only (D-199)", () => {
    const kinds = futureChoiceSteps("cleric")
      .filter((s) => s.kind === "spellSwap" && s.level === 2)
      .map((s) => s.spellSwapKind);
    expect(kinds).toEqual(["cantrips"]);
  });
});

describe("autoResolveAsiForLevel/autoResolveSubclassForClass/autoResolveSpellPickForRequest (D-198)", () => {
  // Party Creation Overhaul Plan 5.1: an AI-controlled hero has nobody
  // present to answer a level-up prompt — Kevin confirmed directly (asked
  // via the same "should the game ever invent a choice" question D-16x
  // settled the other way for player-made blueprints) that THIS specific
  // case is the deliberate exception: an AI hero with no explicit plan
  // entry gets a simple invented default instead of being left unresolved
  // forever. Scoped only to `hero.controlledBy === "ai"` callers
  // (`BattleScene.applyClassLevelUps`/`buildHeroes`) — these functions
  // themselves don't check `controlledBy`, so exercise them directly.

  it("autoResolveAsiForLevel raises the class's primary ability by 2", () => {
    const hero = heroFromBuild(); // Fighter, primaryAbility "str", str 15
    autoResolveAsiForLevel(hero);
    expect(hero.abilityScoreValue("str")).toBe(17);
  });

  it("autoResolveAsiForLevel falls back to the next non-maxed ability once the primary is capped", () => {
    const hero = heroFromBuild(); // Fighter, str 15
    for (let i = 0; i < 3; i++) hero.improveAbilityScore("str", 2); // 15 -> 20 (capped)
    autoResolveAsiForLevel(hero);
    expect(hero.abilityScoreValue("str")).toBe(20); // unchanged — already maxed
    expect(hero.abilityScoreValue("dex")).toBe(16); // 14 -> 16, the next candidate in ability order
  });

  it("autoResolveAsiForLevel is a no-op for a hero with no classId (the classic fixed roster)", () => {
    const hero = new Hero(
      { id: "x", name: "Classic", movementTiles: 6, maxHealth: 10, attackDamage: 3, attackRangeTiles: 1, attackBonus: 4, baseArmorClass: 10 },
      { x: 0, y: 0 },
    );
    expect(() => autoResolveAsiForLevel(hero)).not.toThrow();
  });

  it("autoResolveSubclassForClass grants this class's first modeled subclass", () => {
    const hero = heroFromBuild();
    autoResolveSubclassForClass(hero, "fighter");
    expect(hero.subclassId).toBe(subclassesForClass("fighter")[0].id);
  });

  it("autoResolveSpellPickForRequest (mastery) grants the first eligible spell", () => {
    const hero = new Hero(heroDefinitionFromBuild(build({ classId: "wizard" })), { x: 0, y: 0 });
    fastForwardHero(hero, 18, undefined);
    expect(hero.needsSpellMasteryPick()).toBe(true);
    autoResolveSpellPickForRequest(hero, { hero, kind: "mastery" });
    expect(hero.needsSpellMasteryPick()).toBe(false);
  });

  it("autoResolveSpellPickForRequest (signature) grants the first two eligible spells", () => {
    const hero = new Hero(heroDefinitionFromBuild(build({ classId: "wizard" })), { x: 0, y: 0 });
    fastForwardHero(hero, 20, undefined);
    expect(hero.needsSignatureSpellsPick()).toBe(true);
    autoResolveSpellPickForRequest(hero, { hero, kind: "signature" });
    expect(hero.needsSignatureSpellsPick()).toBe(false);
  });

  it("autoResolveSpellPickForRequest (arcanum) grants the first eligible spell for that tier", () => {
    const hero = new Hero(heroDefinitionFromBuild(build({ classId: "warlock" })), { x: 0, y: 0 });
    fastForwardHero(hero, 11, undefined);
    expect(hero.needsMysticArcanumPick(6)).toBe(true);
    autoResolveSpellPickForRequest(hero, { hero, kind: "arcanum", tier: 6 });
    expect(hero.needsMysticArcanumPick(6)).toBe(false);
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
