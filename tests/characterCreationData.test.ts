import { describe, it, expect } from "vitest";
import { CREATABLE_CLASS_IDS, STARTING_GEAR_IDS, knownSpellIdsForClass } from "../src/game/data/characterCreation";
import { getClassDefinition } from "../src/game/data/classes";
import { getEquipmentDefinition } from "../src/game/data/equipment";

/**
 * Phase 11.2 (D-074) and 11.3 (D-075): the class-picker data
 * CharacterCreationScene reads, extended Phase 13.8 (D-093) for the
 * remaining eight core classes.
 */

describe("CREATABLE_CLASS_IDS", () => {
  it("lists all twelve classes, each a real registered class", () => {
    expect(CREATABLE_CLASS_IDS).toEqual([
      "fighter",
      "wizard",
      "rogue",
      "cleric",
      "barbarian",
      "bard",
      "druid",
      "monk",
      "paladin",
      "ranger",
      "sorcerer",
      "warlock",
    ]);
    CREATABLE_CLASS_IDS.forEach((id) => expect(() => getClassDefinition(id)).not.toThrow());
  });
});

describe("knownSpellIdsForClass (Phase 13.8, D-093)", () => {
  it("gives every full-spellbook caster a non-empty known-spell list", () => {
    for (const classId of ["wizard", "cleric", "bard", "druid", "sorcerer", "warlock"]) {
      expect(knownSpellIdsForClass(classId).length).toBeGreaterThan(0);
    }
  });

  it("gives a non-spellbook class (including the half-caster Paladin/Ranger) an empty known-spell list", () => {
    for (const classId of ["fighter", "rogue", "barbarian", "monk", "paladin", "ranger"]) {
      expect(knownSpellIdsForClass(classId)).toEqual([]);
    }
  });
});

describe("STARTING_GEAR_IDS (Phase 13.11, D-096)", () => {
  it("is non-empty and every id resolves to a real equipment item", () => {
    expect(STARTING_GEAR_IDS.length).toBeGreaterThan(0);
    STARTING_GEAR_IDS.forEach((id) => expect(() => getEquipmentDefinition(id)).not.toThrow());
  });

  it("excludes every rare-and-up item — free starting gear stays common/uncommon only", () => {
    STARTING_GEAR_IDS.forEach((id) => {
      const rarity = getEquipmentDefinition(id).rarity;
      expect(["common", "uncommon"]).toContain(rarity);
    });
    expect(STARTING_GEAR_IDS).not.toContain("aegis-of-the-first-ward"); // legendary
    expect(STARTING_GEAR_IDS).not.toContain("ring-of-frostbite"); // rare
  });
});
