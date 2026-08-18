import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import { WIZARD_CANTRIP_IDS, WIZARD_LEVELED_SPELL_IDS, CLERIC_CANTRIP_IDS, CLERIC_LEVELED_SPELL_IDS } from "../src/game/data/characterCreation";
import { cantripsKnownForClassAtLevel } from "../src/game/systems/SpellcastingSystem";
import { getClassDefinition } from "../src/game/data/classes";
import { preparedSpellCountForClassAtLevel } from "../src/game/systems/SpellPreparationSystem";

/**
 * Phase 13.7 (DECISIONS D-092): a caster hero's real spell-slot economy and
 * spellbook. `Hero.knownSpellAbilityIds()` lists every spell the hero's
 * class actually knows (not just the one signature action chosen at
 * creation); `Hero.canCastSpell`/`spendSpellSlot` gate/spend a leveled
 * spell's slot. A Long Rest fully restores slots; a Short Rest does not,
 * matching the SRD (unlike a Warlock).
 */

function wizardBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-wiz",
    name: "Elyra",
    raceId: "human",
    classId: "wizard",
    level: 1,
    abilityScores: { str: 8, dex: 12, con: 13, int: 15, wis: 10, cha: 10 },
    abilityId: "fire-bolt",
    controlledBy: "human",
    ...overrides,
  };
}

function clericBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-cleric",
    name: "Doran",
    raceId: "human",
    classId: "cleric",
    level: 1,
    abilityScores: { str: 8, dex: 12, con: 13, int: 10, wis: 16, cha: 10 },
    abilityId: "sacred-flame",
    controlledBy: "human",
    ...overrides,
  };
}

function heroFrom(build: CharacterBuild): Hero {
  return new Hero(heroDefinitionFromBuild(build), { x: 0, y: 0 });
}

const NO_CLASS_HERO_DEF: HeroDefinition = {
  id: "hero-no-class",
  name: "Test Hero",
  movementTiles: 4,
  maxHealth: 12,
  attackDamage: 4,
  attackRangeTiles: 1,
  attackBonus: 4,
  baseArmorClass: 10,
  abilityId: "cleave",
};

function heroWithNoClass(): Hero {
  return new Hero(NO_CLASS_HERO_DEF, { x: 0, y: 0 });
}

describe("Hero.knownSpellAbilityIds (Phase 13.7, D-092)", () => {
  it("is empty for a hero with no classId (no known spell list)", () => {
    expect(heroWithNoClass().knownSpellAbilityIds()).toEqual([]);
  });

  it("is empty for a non-caster D&D-built hero (Fighter/Rogue)", () => {
    const fighterBuild: CharacterBuild = {
      id: "b",
      name: "Kael",
      raceId: "human",
      classId: "fighter",
      level: 1,
      abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      abilityId: "cleave",
      controlledBy: "human",
    };
    expect(heroFrom(fighterBuild).knownSpellAbilityIds()).toEqual([]);
  });

  it("lists a level-1 Wizard's DEFAULT prepared spells/cantrips (D-134) — a bounded subset of the full SRD list, not the whole thing", () => {
    const hero = heroFrom(wizardBuild()); // signature ability: fire-bolt
    const known = hero.knownSpellAbilityIds();
    const cantripCount = cantripsKnownForClassAtLevel(getClassDefinition("wizard"), 1);
    const preparedCount = preparedSpellCountForClassAtLevel("wizard", 1);
    expect(known.length).toBe(cantripCount + preparedCount);
    // every known id is a real member of the full class list (a subset, not something invented)
    const fullList = [...WIZARD_CANTRIP_IDS, ...WIZARD_LEVELED_SPELL_IDS];
    expect(known.every((id) => fullList.includes(id))).toBe(true);
    // the deterministic default (first-in-list-order) picks
    expect(known).toEqual([...WIZARD_LEVELED_SPELL_IDS.slice(0, preparedCount), ...WIZARD_CANTRIP_IDS.slice(0, cantripCount)]);
  });

  it("lists a level-1 Cleric's DEFAULT prepared spells/cantrips (D-134) — a bounded subset of the full SRD list", () => {
    const hero = heroFrom(clericBuild());
    const known = hero.knownSpellAbilityIds();
    const cantripCount = cantripsKnownForClassAtLevel(getClassDefinition("cleric"), 1);
    const preparedCount = preparedSpellCountForClassAtLevel("cleric", 1);
    expect(known.length).toBe(cantripCount + preparedCount);
    const fullList = [...CLERIC_CANTRIP_IDS, ...CLERIC_LEVELED_SPELL_IDS];
    expect(known.every((id) => fullList.includes(id))).toBe(true);
    expect(known).toEqual([...CLERIC_LEVELED_SPELL_IDS.slice(0, preparedCount), ...CLERIC_CANTRIP_IDS.slice(0, cantripCount)]);
  });
});

describe("Hero spell slots (Phase 13.7, D-092)", () => {
  it("a level-1 Wizard/Cleric starts with 2 first-level slots (FULL_CASTER_SPELL_SLOTS_BY_LEVEL[1])", () => {
    expect(heroFrom(wizardBuild()).spellSlotsRemainingAt(1)).toBe(2);
    expect(heroFrom(clericBuild()).spellSlotsRemainingAt(1)).toBe(2);
  });

  it("a hero with no classId and non-casters have 0 slots at every level", () => {
    expect(heroWithNoClass().spellSlotsRemainingAt(1)).toBe(0);
  });

  it("canCastSpell is always true for a cantrip (fire-bolt), regardless of slots", () => {
    const hero = heroFrom(wizardBuild());
    expect(hero.canCastSpell("fire-bolt")).toBe(true);
    for (let i = 0; i < 5; i++) hero.spendSpellSlot(1);
    expect(hero.canCastSpell("fire-bolt")).toBe(true); // still true — cantrips are never slot-gated
  });

  it("canCastSpell is slot-gated for a leveled spell (magic-missile), and spendSpellSlot decrements it", () => {
    const hero = heroFrom(wizardBuild());
    expect(hero.canCastSpell("magic-missile")).toBe(true);
    hero.spendSpellSlot(1);
    expect(hero.spellSlotsRemainingAt(1)).toBe(1);
    hero.spendSpellSlot(1);
    expect(hero.spellSlotsRemainingAt(1)).toBe(0);
    expect(hero.canCastSpell("magic-missile")).toBe(false);
  });

  it("spendSpellSlot with none remaining is a safe no-op, never going negative", () => {
    const hero = heroFrom(wizardBuild());
    hero.spendSpellSlot(1);
    hero.spendSpellSlot(1);
    hero.spendSpellSlot(1); // already 0
    expect(hero.spellSlotsRemainingAt(1)).toBe(0);
  });

  it("levelUpClass grows slot capacity (level 1 -> 2: 2 -> 3) without refilling spent slots", () => {
    const hero = heroFrom(wizardBuild());
    hero.spendSpellSlot(1);
    hero.spendSpellSlot(1); // 0 remaining
    hero.levelUpClass(); // level 2: max rises 2 -> 3, so remaining rises 0 -> 1
    expect(hero.spellSlotsRemainingAt(1)).toBe(1);
  });

  it("levelUpClass unlocks a new slot LEVEL when the character reaches it (level 2 -> 3: 2nd-level slots appear)", () => {
    const hero = heroFrom(wizardBuild());
    hero.levelUpClass(); // level 2
    expect(hero.spellSlotsRemainingAt(2)).toBe(0); // no 2nd-level slots yet
    hero.levelUpClass(); // level 3: FULL_CASTER_SPELL_SLOTS_BY_LEVEL[3] = [4, 2]
    expect(hero.spellSlotsRemainingAt(1)).toBe(4);
    expect(hero.spellSlotsRemainingAt(2)).toBe(2);
  });

  it("a Short Rest does NOT restore spell slots (unlike a Warlock's, this game's casters follow the standard SRD cadence)", () => {
    const hero = heroFrom(wizardBuild());
    hero.spendSpellSlot(1);
    hero.shortRest();
    expect(hero.spellSlotsRemainingAt(1)).toBe(1); // still down by 1
  });

  it("a Long Rest fully restores spell slots", () => {
    const hero = heroFrom(wizardBuild());
    hero.spendSpellSlot(1);
    hero.spendSpellSlot(1);
    hero.longRest();
    expect(hero.spellSlotsRemainingAt(1)).toBe(2);
  });

  it("a Long Rest is a no-op on slots for a non-caster hero", () => {
    const hero = heroWithNoClass();
    hero.longRest();
    expect(hero.spellSlotsRemainingAt(1)).toBe(0);
  });
});

describe("Hero prepared spells/known cantrips/spellbook (D-134)", () => {
  it("levelUpClass grows the prepared-spell list to match the new level's count, keeping everything already prepared", () => {
    const hero = heroFrom(wizardBuild());
    const atLevel1 = [...hero.preparedSpellIds];
    expect(atLevel1.length).toBe(preparedSpellCountForClassAtLevel("wizard", 1));
    hero.levelUpClass(); // level 2: prepared count 4 -> 5
    expect(hero.preparedSpellIds.length).toBe(preparedSpellCountForClassAtLevel("wizard", 2));
    for (const id of atLevel1) expect(hero.preparedSpellIds).toContain(id);
  });

  it("levelUpClass grows known cantrips only at the levels the count actually changes (1/4/10)", () => {
    const hero = heroFrom(wizardBuild());
    expect(hero.knownCantripIds.length).toBe(3); // Wizard: 3 at level 1
    for (let i = 1; i < 4; i++) hero.levelUpClass(); // reach level 4
    expect(hero.knownCantripIds.length).toBe(4);
  });

  it("a Wizard's spellbook grows 6 -> 8 on the level 1 -> 2 level-up, and the prepared list is drawn FROM the spellbook, not the full class list", () => {
    const hero = heroFrom(wizardBuild());
    expect(hero.spellbookIds.length).toBe(6);
    for (const id of hero.preparedSpellIds) expect(hero.spellbookIds).toContain(id);
    hero.levelUpClass();
    expect(hero.spellbookIds.length).toBe(8);
  });

  it("a non-Wizard caster has an empty spellbook always", () => {
    expect(heroFrom(clericBuild()).spellbookIds).toEqual([]);
  });

  it("choosePreparedSpells/chooseCantrips overwrite the current selection wholesale", () => {
    const hero = heroFrom(wizardBuild());
    hero.choosePreparedSpells(["magic-missile"]);
    expect(hero.preparedSpellIds).toEqual(["magic-missile"]);
    hero.chooseCantrips(["ray-of-frost"]);
    expect(hero.knownCantripIds).toEqual(["ray-of-frost"]);
    expect(hero.knownSpellAbilityIds()).toEqual(["magic-missile", "ray-of-frost"]);
  });

  it("learnSpellbookSpells only ever adds to a Wizard's spellbook, never duplicates, and is a no-op for any other class", () => {
    const wizard = heroFrom(wizardBuild());
    const before = wizard.spellbookIds.length;
    wizard.learnSpellbookSpells(["fireball", "fireball"]); // duplicate in the same call
    expect(wizard.spellbookIds.length).toBe(before + 1);
    expect(wizard.spellbookIds).toContain("fireball");

    const cleric = heroFrom(clericBuild());
    cleric.learnSpellbookSpells(["cure-wounds"]);
    expect(cleric.spellbookIds).toEqual([]);
  });

  it("chooseSpellbook replaces a Wizard's spellbook wholesale, unlike learnSpellbookSpells' additive behavior", () => {
    const wizard = heroFrom(wizardBuild());
    wizard.chooseSpellbook(["magic-missile", "shield"]);
    expect(wizard.spellbookIds).toEqual(["magic-missile", "shield"]);
    wizard.chooseSpellbook(["fireball"]);
    expect(wizard.spellbookIds).toEqual(["fireball"]);
  });

  it("a non-caster has no prepared spells/cantrips/spellbook at all", () => {
    const hero = heroWithNoClass();
    expect(hero.preparedSpellIds).toEqual([]);
    expect(hero.knownCantripIds).toEqual([]);
    expect(hero.spellbookIds).toEqual([]);
  });
});
