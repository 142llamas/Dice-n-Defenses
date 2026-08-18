import { describe, it, expect } from "vitest";
import { FIGHTER, WIZARD, CLERIC } from "../src/game/data/classes";
import { isSpellcaster, cantripsKnownForClassAtLevel, spellSlotsForClassAtLevel } from "../src/game/systems/SpellcastingSystem";

/**
 * Phase 11.2 ("spellcasting engine," DECISIONS D-071/D-074) — pure derived
 * math for a caster's known cantrips, spell slots, and prepared-spell count.
 * Nothing here spends a slot in a battle yet (see the module comment in
 * `systems/SpellcastingSystem.ts` and `data/spells.ts`).
 */

describe("isSpellcaster", () => {
  it("is false for the Fighter, true for the Wizard and Cleric", () => {
    expect(isSpellcaster(FIGHTER)).toBe(false);
    expect(isSpellcaster(WIZARD)).toBe(true);
    expect(isSpellcaster(CLERIC)).toBe(true);
  });
});

describe("cantripsKnownForClassAtLevel", () => {
  it("is always 0 for a non-caster", () => {
    expect(cantripsKnownForClassAtLevel(FIGHTER, 1)).toBe(0);
    expect(cantripsKnownForClassAtLevel(FIGHTER, 20)).toBe(0);
  });

  it("follows the Wizard's 3/4/5 cantrip progression at 1st/4th/10th level", () => {
    expect(cantripsKnownForClassAtLevel(WIZARD, 1)).toBe(3);
    expect(cantripsKnownForClassAtLevel(WIZARD, 3)).toBe(3);
    expect(cantripsKnownForClassAtLevel(WIZARD, 4)).toBe(4);
    expect(cantripsKnownForClassAtLevel(WIZARD, 9)).toBe(4);
    expect(cantripsKnownForClassAtLevel(WIZARD, 10)).toBe(5);
    expect(cantripsKnownForClassAtLevel(WIZARD, 20)).toBe(5);
  });
});

describe("spellSlotsForClassAtLevel", () => {
  it("is always empty for a non-caster", () => {
    expect(spellSlotsForClassAtLevel(FIGHTER, 5)).toEqual([]);
  });

  it("gives a level-1 Wizard exactly two 1st-level slots and nothing higher", () => {
    expect(spellSlotsForClassAtLevel(WIZARD, 1)).toEqual([2]);
  });

  it("grants 2nd-level slots starting at character level 3", () => {
    expect(spellSlotsForClassAtLevel(WIZARD, 2)).toEqual([3]);
    expect(spellSlotsForClassAtLevel(WIZARD, 3)).toEqual([4, 2]);
  });

  it("reaches every spell level (1st-9th) by character level 17, and holds steady where the SRD table repeats", () => {
    expect(spellSlotsForClassAtLevel(WIZARD, 17)).toEqual([4, 3, 3, 3, 2, 1, 1, 1, 1]);
    expect(spellSlotsForClassAtLevel(WIZARD, 20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    // level 12 has no table entry of its own — it should reuse level 11's slots.
    expect(spellSlotsForClassAtLevel(WIZARD, 12)).toEqual(spellSlotsForClassAtLevel(WIZARD, 11));
  });
});

describe("the Cleric shares the Wizard's full-caster tables (Phase 11.3, D-075)", () => {
  it("has the identical cantrip and spell-slot progression", () => {
    expect(cantripsKnownForClassAtLevel(CLERIC, 1)).toBe(cantripsKnownForClassAtLevel(WIZARD, 1));
    expect(spellSlotsForClassAtLevel(CLERIC, 5)).toEqual(spellSlotsForClassAtLevel(WIZARD, 5));
  });
});
