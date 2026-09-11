import { describe, it, expect } from "vitest";
import {
  CREATABLE_CLASS_IDS,
  startingGearIdsForSlotType,
  defaultStartingGearForClass,
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

  it("includes the spellcasting focus items under the shield (off-hand) slot", () => {
    const shieldIds = startingGearIdsForSlotType("shield");
    expect(shieldIds).toEqual(
      expect.arrayContaining(["holy-symbol", "arcane-focus", "druidic-totem", "component-pouch"]),
    );
  });
});

describe("defaultStartingGearForClass (D-246, Plan 5)", () => {
  it("gives every creatable class a kit with at least a weapon", () => {
    CREATABLE_CLASS_IDS.forEach((classId) => {
      expect(defaultStartingGearForClass(classId).weapon).toBeTruthy();
    });
  });

  it("resolves every item id in every class's kit to a real item of the matching slot", () => {
    CREATABLE_CLASS_IDS.forEach((classId) => {
      const kit = defaultStartingGearForClass(classId);
      (Object.entries(kit) as [GearSlotType, string][]).forEach(([slot, itemId]) => {
        expect(getEquipmentDefinition(itemId).slot).toBe(slot);
      });
    });
  });

  it("returns an empty kit for an unrecognized class id, defensively", () => {
    expect(defaultStartingGearForClass("not-a-real-class")).toEqual({});
  });
});

describe("companionStartingGearForDifficulty (D-194, campaign gear economy)", () => {
  // D-232: a caster's spellcasting focus now lives in the `shield`
  // (off-hand) slot, not `amulet` — this baseline's `shield` is a focus
  // item (`itemKind: "focus"`), NOT a real Shield.
  const casterBaseline = { weapon: "dagger", chest: "padded-armor", shield: "arcane-focus" };
  const martialBaseline = { weapon: "longsword", chest: "chain-shirt", shield: "shield" };

  it("always keeps weapon and a caster's focus (implement), regardless of difficulty", () => {
    for (const difficultyId of ["easy", "normal", "hard", "nightmare"] as const) {
      const kit = companionStartingGearForDifficulty(casterBaseline, difficultyId);
      expect(kit.weapon).toBe("dagger");
      expect(kit.shield).toBe("arcane-focus");
    }
  });

  it("keeps the full kit (chest survives) on easy/normal, matching D-193 Plan 2.2's authored baseline", () => {
    expect(companionStartingGearForDifficulty(martialBaseline, "easy")).toEqual(martialBaseline);
    expect(companionStartingGearForDifficulty(martialBaseline, "normal")).toEqual(martialBaseline);
  });

  it("trims discretionary slots (chest, then a real shield) as difficulty rises", () => {
    const hardKit = companionStartingGearForDifficulty(martialBaseline, "hard");
    expect(hardKit).toEqual({ weapon: "longsword", chest: "chain-shirt" }); // 1 discretionary slot: chest kept, shield dropped

    const nightmareKit = companionStartingGearForDifficulty(martialBaseline, "nightmare");
    expect(nightmareKit).toEqual({ weapon: "longsword" }); // 0 discretionary slots: weapon only
  });

  it("a martial companion with no amulet/focus in their baseline stays weapon-only at nightmare (no implement to preserve)", () => {
    expect(companionStartingGearForDifficulty(martialBaseline, "nightmare")).toEqual({ weapon: "longsword" });
  });

  it("a caster companion always keeps weapon+focus even at nightmare, with chest dropped", () => {
    expect(companionStartingGearForDifficulty(casterBaseline, "nightmare")).toEqual({
      weapon: "dagger",
      shield: "arcane-focus",
    });
  });

  it("is a pure function — never mutates the baseline map passed in", () => {
    const baseline = { ...martialBaseline };
    companionStartingGearForDifficulty(baseline, "nightmare");
    expect(baseline).toEqual(martialBaseline);
  });
});
