import { describe, it, expect } from "vitest";
import {
  CREATABLE_CLASS_IDS,
  startingGearIdsForSlotType,
  startingGearPointCost,
  companionStartingGearForDifficulty,
  knownSpellIdsForClass,
} from "../src/game/data/characterCreation";
import { getClassDefinition } from "../src/game/data/classes";
import { getEquipmentDefinition, type GearSlotType } from "../src/game/data/equipment";

/** Every real slot type a starting-gear picker offers (D-193: all 10 gear slots, ring1/ring2 both drawing from the one "ring" pool). */
const ALL_SLOT_TYPES: GearSlotType[] = ["weapon", "shield", "head", "chest", "legs", "back", "ring", "amulet", "footwear"];

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

describe("startingGearIdsForSlotType (D-193, Party Creation Overhaul Plan 2)", () => {
  it("is non-empty for all 9 slot types and every id resolves to a real item of that slot", () => {
    ALL_SLOT_TYPES.forEach((slot) => {
      const ids = startingGearIdsForSlotType(slot);
      expect(ids.length).toBeGreaterThan(0);
      ids.forEach((id) => {
        const def = getEquipmentDefinition(id);
        expect(def.slot).toBe(slot);
      });
    });
  });

  it("excludes every rare-and-up item — free starting gear stays common/uncommon only", () => {
    ALL_SLOT_TYPES.forEach((slot) => {
      startingGearIdsForSlotType(slot).forEach((id) => {
        expect(["common", "uncommon"]).toContain(getEquipmentDefinition(id).rarity);
      });
    });
    expect(startingGearIdsForSlotType("chest")).not.toContain("aegis-of-the-first-ward"); // legendary
    expect(startingGearIdsForSlotType("ring")).not.toContain("ring-of-frostbite"); // rare
  });

  it("includes the 4 new focus items under the amulet slot", () => {
    const amuletIds = startingGearIdsForSlotType("amulet");
    expect(amuletIds).toEqual(
      expect.arrayContaining(["holy-symbol", "arcane-focus", "druidic-totem", "component-pouch"]),
    );
  });
});

describe("startingGearPointCost (D-194, campaign gear economy)", () => {
  it("costs 1 point for common, 2 for uncommon — the only rarities the starting pool ever contains", () => {
    expect(startingGearPointCost("common")).toBe(1);
    expect(startingGearPointCost("uncommon")).toBe(2);
  });

  it("costs strictly more for a rarer tier, in case a future pool ever includes one", () => {
    expect(startingGearPointCost("rare")).toBeGreaterThan(startingGearPointCost("uncommon"));
    expect(startingGearPointCost("veryRare")).toBeGreaterThan(startingGearPointCost("rare"));
    expect(startingGearPointCost("legendary")).toBeGreaterThan(startingGearPointCost("veryRare"));
  });
});

describe("companionStartingGearForDifficulty (D-194, campaign gear economy)", () => {
  const casterBaseline = { weapon: "dagger", chest: "padded-armor", amulet: "arcane-focus" };
  const martialBaseline = { weapon: "longsword", chest: "chain-shirt", shield: "shield" };

  it("always keeps weapon and a caster's amulet (implement), regardless of difficulty", () => {
    for (const difficultyId of ["easy", "normal", "hard", "nightmare"] as const) {
      const kit = companionStartingGearForDifficulty(casterBaseline, difficultyId);
      expect(kit.weapon).toBe("dagger");
      expect(kit.amulet).toBe("arcane-focus");
    }
  });

  it("keeps the full kit (chest survives) on easy/normal, matching D-193 Plan 2.2's authored baseline", () => {
    expect(companionStartingGearForDifficulty(martialBaseline, "easy")).toEqual(martialBaseline);
    expect(companionStartingGearForDifficulty(martialBaseline, "normal")).toEqual(martialBaseline);
  });

  it("trims discretionary slots (chest, then shield) as difficulty rises", () => {
    const hardKit = companionStartingGearForDifficulty(martialBaseline, "hard");
    expect(hardKit).toEqual({ weapon: "longsword", chest: "chain-shirt" }); // 1 discretionary slot: chest kept, shield dropped

    const nightmareKit = companionStartingGearForDifficulty(martialBaseline, "nightmare");
    expect(nightmareKit).toEqual({ weapon: "longsword" }); // 0 discretionary slots: weapon only
  });

  it("a martial companion with no amulet in their baseline stays weapon-only at nightmare (no implement to preserve)", () => {
    expect(companionStartingGearForDifficulty(martialBaseline, "nightmare")).toEqual({ weapon: "longsword" });
  });

  it("a caster companion always keeps weapon+amulet even at nightmare, with chest dropped", () => {
    expect(companionStartingGearForDifficulty(casterBaseline, "nightmare")).toEqual({
      weapon: "dagger",
      amulet: "arcane-focus",
    });
  });

  it("is a pure function — never mutates the baseline map passed in", () => {
    const baseline = { ...martialBaseline };
    companionStartingGearForDifficulty(baseline, "nightmare");
    expect(baseline).toEqual(martialBaseline);
  });
});
