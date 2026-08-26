import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import { subclassGrantedSpellIdsUpToLevel } from "../src/game/data/subclasses";
import { getSpell } from "../src/game/data/spells";

/**
 * D-124: wiring a batch of class/subclass features whose blocking system
 * (real saving throws, Advantage/Disadvantage, rest resource pools, spell
 * slots) has existed since Phase 13.5/13.10/D-086/D-092 but was never
 * looped back to unlock them, plus two new small systems built specifically
 * to unlock a few more (the "frightened" status effect, a generalized
 * reaction slot). Pure Hero-level tests only — every mechanic's actual
 * battle hookup (`BattleScene.applyIntimidatingPresence`/
 * `applyRetaliations`/`applyCuttingWords`) needs Phaser and can't be
 * unit-tested here, same standing limitation `actionEconomy.test.ts` already
 * documents for Uncanny Dodge's own auto-apply. The saving-throw hookups
 * themselves (Danger Sense/Evasion/Indomitable/Elusive) ARE pure — see the
 * new D-124 block in `tests/combat.test.ts` for their WaveSystem-level
 * coverage, and `tests/savingThrowSystem.test.ts` for the underlying
 * `SavingThrowSystem` options this file's Hero getters ultimately feed.
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

describe("Fighter's Indomitable (D-124)", () => {
  it("grants no reroll charges below level 9", () => {
    const hero = heroFromBuild();
    expect(hero.indomitableUsesAvailable).toBe(0);
    expect(hero.rerollFailedSave()).toBe(false);
  });

  it("grants exactly 1/2/3 charges at levels 9/13/17, refilled on a Long Rest", () => {
    const hero = heroFromBuild();
    for (let i = 1; i < 9; i++) hero.levelUpClass();
    expect(hero.level).toBe(9);
    expect(hero.indomitableUsesAvailable).toBe(1);
    for (let i = 9; i < 13; i++) hero.levelUpClass();
    expect(hero.indomitableUsesAvailable).toBe(2);
    for (let i = 13; i < 17; i++) hero.levelUpClass();
    expect(hero.indomitableUsesAvailable).toBe(3);
  });

  it("rerollFailedSave consumes a charge and returns true only while charges remain", () => {
    const hero = heroFromBuild();
    for (let i = 1; i < 9; i++) hero.levelUpClass(); // level 9, 1 charge
    expect(hero.rerollFailedSave()).toBe(true);
    expect(hero.indomitableUsesAvailable).toBe(0);
    expect(hero.rerollFailedSave()).toBe(false);
  });

  it("recharges only on a Long Rest, not a Short Rest", () => {
    const hero = heroFromBuild();
    for (let i = 1; i < 9; i++) hero.levelUpClass();
    hero.rerollFailedSave();
    hero.shortRest();
    expect(hero.indomitableUsesAvailable).toBe(0);
    hero.longRest();
    expect(hero.indomitableUsesAvailable).toBe(1);
  });

  it("is always 0 for a non-Fighter, even past level 9", () => {
    const hero = heroFromBuild({ classId: "barbarian" });
    for (let i = 1; i < 9; i++) hero.levelUpClass();
    expect(hero.indomitableUsesAvailable).toBe(0);
  });
});

describe("Barbarian's Danger Sense — Combatant.savingThrowAdvantage (D-124)", () => {
  it("is 'normal' below level 2 or for any other class", () => {
    expect(heroFromBuild({ classId: "barbarian" }).savingThrowAdvantage).toBe("normal");
    expect(heroFromBuild().savingThrowAdvantage).toBe("normal"); // Fighter
  });

  it("is 'advantage' for a Barbarian at level 2+", () => {
    const hero = heroFromBuild({ classId: "barbarian" });
    hero.levelUpClass();
    expect(hero.level).toBe(2);
    expect(hero.savingThrowAdvantage).toBe("advantage");
  });
});

describe("Rogue's/Monk's Evasion — Combatant.evasionHalvesFailedSave (D-124)", () => {
  it("is false below level 7 for either class", () => {
    expect(heroFromBuild({ classId: "rogue" }).evasionHalvesFailedSave).toBe(false);
    expect(heroFromBuild({ classId: "monk" }).evasionHalvesFailedSave).toBe(false);
  });

  it("is true for a Rogue at level 7+", () => {
    const hero = heroFromBuild({ classId: "rogue" });
    for (let i = 1; i < 7; i++) hero.levelUpClass();
    expect(hero.evasionHalvesFailedSave).toBe(true);
  });

  it("is true for a Monk at level 7+", () => {
    const hero = heroFromBuild({ classId: "monk" });
    for (let i = 1; i < 7; i++) hero.levelUpClass();
    expect(hero.evasionHalvesFailedSave).toBe(true);
  });

  it("is false for a Fighter at any level", () => {
    const hero = heroFromBuild();
    for (let i = 1; i < 20; i++) hero.levelUpClass();
    expect(hero.evasionHalvesFailedSave).toBe(false);
  });
});

describe("Rogue's Elusive — Combatant.deniesAttackerAdvantage (D-124)", () => {
  it("is false below level 18", () => {
    const hero = heroFromBuild({ classId: "rogue" });
    for (let i = 1; i < 17; i++) hero.levelUpClass();
    expect(hero.deniesAttackerAdvantage()).toBe(false);
  });

  it("is true for a Rogue at level 18+", () => {
    const hero = heroFromBuild({ classId: "rogue" });
    for (let i = 1; i < 18; i++) hero.levelUpClass();
    expect(hero.deniesAttackerAdvantage()).toBe(true);
  });

  it("is false once defeated", () => {
    const hero = heroFromBuild({ classId: "rogue" });
    for (let i = 1; i < 18; i++) hero.levelUpClass();
    hero.health = 0;
    expect(hero.deniesAttackerAdvantage()).toBe(false);
  });

  it("is false while incapacitated (stunned/restrained-family status)", () => {
    const hero = heroFromBuild({ classId: "rogue" });
    for (let i = 1; i < 18; i++) hero.levelUpClass();
    hero.applyStatus("stunned", 1);
    expect(hero.deniesAttackerAdvantage()).toBe(false);
  });
});

describe("Path of the Berserker's Intimidating Presence (D-124)", () => {
  it("requires the subclass AND level 10+", () => {
    const noSubclass = heroFromBuild({ classId: "barbarian" });
    for (let i = 1; i < 10; i++) noSubclass.levelUpClass();
    expect(noSubclass.hasIntimidatingPresence).toBe(false);

    const tooLow = heroFromBuild({ classId: "barbarian", subclassId: "path-of-the-berserker" });
    for (let i = 1; i < 9; i++) tooLow.levelUpClass();
    expect(tooLow.hasIntimidatingPresence).toBe(false);

    const ready = heroFromBuild({ classId: "barbarian", subclassId: "path-of-the-berserker" });
    for (let i = 1; i < 10; i++) ready.levelUpClass();
    expect(ready.hasIntimidatingPresence).toBe(true);
  });
});

describe("Path of the Berserker's Retaliation (D-124)", () => {
  it("requires the subclass, level 14+, and an available reaction", () => {
    const hero = heroFromBuild({ classId: "barbarian", subclassId: "path-of-the-berserker" });
    for (let i = 1; i < 13; i++) hero.levelUpClass();
    expect(hero.canUseRetaliation()).toBe(false); // level 13, not yet 14
    hero.levelUpClass();
    expect(hero.level).toBe(14);
    expect(hero.canUseRetaliation()).toBe(true);
  });

  it("spends the reaction, unavailable again until the next turn", () => {
    const hero = heroFromBuild({ classId: "barbarian", subclassId: "path-of-the-berserker" });
    for (let i = 1; i < 14; i++) hero.levelUpClass();
    hero.useRetaliation();
    expect(hero.canUseRetaliation()).toBe(false);
    hero.resetForNewTurn();
    expect(hero.canUseRetaliation()).toBe(true);
  });

  it("is unavailable to the SRD Path of the Ironhide (the other Barbarian subclass)", () => {
    const hero = heroFromBuild({ classId: "barbarian", subclassId: "path-of-the-ironhide" });
    for (let i = 1; i < 20; i++) hero.levelUpClass();
    expect(hero.canUseRetaliation()).toBe(false);
  });
});

describe("College of Lore's Cutting Words (D-124)", () => {
  it("requires the subclass, level 3+, an available reaction, AND a Bardic Inspiration use", () => {
    const hero = heroFromBuild({ classId: "bard", subclassId: "college-of-lore" });
    for (let i = 1; i < 3; i++) hero.levelUpClass();
    expect(hero.canUseCuttingWords()).toBe(true); // Bards start with Bardic Inspiration uses
  });

  it("spends the reaction AND a Bardic Inspiration use, independent of the bonus-action version", () => {
    const hero = heroFromBuild({ classId: "bard", subclassId: "college-of-lore" });
    for (let i = 1; i < 3; i++) hero.levelUpClass();
    const usesBefore = hero.bardicInspirationUsesAvailable;
    hero.useCuttingWords();
    expect(hero.bardicInspirationUsesAvailable).toBe(usesBefore - 1);
    expect(hero.canUseCuttingWords()).toBe(false); // reaction now spent
    expect(hero.canUseBardicInspiration()).toBe(true); // bonus action untouched
  });

  it("is unavailable once Bardic Inspiration uses run out", () => {
    const hero = heroFromBuild({ classId: "bard", subclassId: "college-of-lore" });
    for (let i = 1; i < 3; i++) hero.levelUpClass();
    while (hero.bardicInspirationUsesAvailable > 0) hero.useCuttingWords();
    expect(hero.canUseCuttingWords()).toBe(false);
  });

  it("is unavailable to the SRD Bard College of Lore's sibling subclass (College of the Blade)", () => {
    const hero = heroFromBuild({ classId: "bard", subclassId: "college-of-the-blade" });
    for (let i = 1; i < 20; i++) hero.levelUpClass();
    expect(hero.canUseCuttingWords()).toBe(false);
  });
});

describe("Hero.bardicInspirationUsesAvailable (D-124, needed by BattleScene.applyCuttingWords)", () => {
  it("matches the constructed starting pool for a Bard", () => {
    const hero = heroFromBuild({ classId: "bard" });
    expect(hero.bardicInspirationUsesAvailable).toBeGreaterThan(0);
  });
});

describe("subclass-granted spell lists via Hero.knownSpellAbilityIds (D-124)", () => {
  it("The Fiend adds Burning Hands and Command to a level-1 Warlock's spellbook — spells not otherwise known", () => {
    const withSubclass = heroFromBuild({ classId: "warlock", subclassId: "the-fiend" });
    const withoutSubclass = heroFromBuild({ classId: "warlock" });
    expect(withSubclass.knownSpellAbilityIds()).toContain("burning-hands");
    expect(withSubclass.knownSpellAbilityIds()).toContain("command");
    // Proves this is a genuinely NEW addition, not something every Warlock already knows.
    expect(withoutSubclass.knownSpellAbilityIds()).not.toContain("burning-hands");
    expect(withoutSubclass.knownSpellAbilityIds()).not.toContain("command");
  });

  it("The Fiend's higher-level Expanded Spell List entries only appear once that level is reached", () => {
    const hero = heroFromBuild({ classId: "warlock", subclassId: "the-fiend" });
    expect(hero.knownSpellAbilityIds()).not.toContain("scorching-ray"); // 2nd-level tier (character level 3)
    for (let i = 1; i < 3; i++) hero.levelUpClass();
    expect(hero.knownSpellAbilityIds()).toContain("scorching-ray");
  });

  it("Life Domain's Domain Spells are wired and, under D-134's now-bounded prepared-spell economy, are genuinely guaranteed known regardless of what's actually prepared", () => {
    const withSubclass = heroFromBuild({ classId: "cleric", subclassId: "life-domain" });
    const withoutSubclass = heroFromBuild({ classId: "cleric" });
    for (let i = 1; i < 9; i++) {
      withSubclass.levelUpClass();
      withoutSubclass.levelUpClass();
    }
    // the default-filled prepared/cantrip subset is identical either way (it
    // depends only on class/level, never on subclass) — Domain Spells only
    // ever ADD on top of it, never remove or change it.
    const withoutIds = withoutSubclass.knownSpellAbilityIds();
    const withIds = withSubclass.knownSpellAbilityIds();
    for (const id of withoutIds) expect(withIds).toContain(id);
    // every Domain Spell is guaranteed known, whether or not it happens to
    // also be in the small default-prepared subset above.
    const domainSpellAbilityIds = subclassGrantedSpellIdsUpToLevel("life-domain", withSubclass.level)
      .map((id) => getSpell(id).abilityId)
      .filter((id): id is string => !!id);
    expect(domainSpellAbilityIds.length).toBeGreaterThan(0);
    for (const id of domainSpellAbilityIds) expect(withIds).toContain(id);
  });

  it("stays empty for Oath of Devotion — Paladin has no spellbook in this game at all, even though its class def carries a spellcasting progression for Divine Smite's slot pool", () => {
    const hero = heroFromBuild({ classId: "paladin", subclassId: "oath-of-devotion" });
    for (let i = 1; i < 5; i++) hero.levelUpClass();
    expect(hero.knownSpellAbilityIds()).toEqual([]);
  });
});
