import { describe, it, expect } from "vitest";
import {
  decideSlotPairPlacement,
  decideHandsPlacement,
  handsCategoryOf,
  weaponGripOf,
  isMagicItem,
  applyCatalogFilters,
  type CatalogFilters,
} from "../src/game/systems/GearFilterSystem";
import { getEquipmentDefinition } from "../src/game/data/equipment";

describe("decideSlotPairPlacement", () => {
  it("auto-places into slotA when both are empty", () => {
    expect(decideSlotPairPlacement(null, null, "general1", "general2")).toEqual({
      kind: "autoPlace",
      slot: "general1",
    });
  });

  it("auto-places into slotB when only slotA is occupied", () => {
    expect(decideSlotPairPlacement("potion-healing", null, "general1", "general2")).toEqual({
      kind: "autoPlace",
      slot: "general2",
    });
  });

  it("auto-places into slotA when only slotB is occupied", () => {
    expect(decideSlotPairPlacement(null, "potion-healing", "general1", "general2")).toEqual({
      kind: "autoPlace",
      slot: "general1",
    });
  });

  it("requires compare-and-replace when both are occupied", () => {
    expect(decideSlotPairPlacement("potion-healing", "potion-mana", "general1", "general2")).toEqual({
      kind: "compareAndReplace",
    });
  });

  it("works generically for the ring pair too", () => {
    expect(decideSlotPairPlacement("ring-of-protection", null, "ring1", "ring2")).toEqual({
      kind: "autoPlace",
      slot: "ring2",
    });
  });
});

describe("decideHandsPlacement", () => {
  it("a real shield only ever candidates for the shield slot", () => {
    expect(decideHandsPlacement("shield", null, null)).toEqual({ kind: "autoPlace", slot: "shield" });
    expect(decideHandsPlacement("shield", "dagger", "shield")).toEqual({
      kind: "compareAndReplace",
      candidateSlots: ["shield"],
    });
  });

  it("a two-handed weapon only ever candidates for the weapon slot", () => {
    expect(decideHandsPlacement("greatsword", null, null)).toEqual({ kind: "autoPlace", slot: "weapon" });
    expect(decideHandsPlacement("greatsword", "dagger", null)).toEqual({
      kind: "compareAndReplace",
      candidateSlots: ["weapon"],
    });
  });

  it("a light melee weapon candidates for either hand, preferring weapon when both are empty", () => {
    expect(decideHandsPlacement("dagger", null, null)).toEqual({ kind: "autoPlace", slot: "weapon" });
  });

  it("a light melee weapon auto-places into whichever hand is actually empty", () => {
    expect(decideHandsPlacement("dagger", "greatsword", null)).toEqual({ kind: "autoPlace", slot: "shield" });
    expect(decideHandsPlacement("dagger", null, "shield")).toEqual({ kind: "autoPlace", slot: "weapon" });
  });

  it("a light melee weapon needs a replace choice once both hands are full", () => {
    expect(decideHandsPlacement("dagger", "shortsword", "shield")).toEqual({
      kind: "compareAndReplace",
      candidateSlots: ["weapon", "shield"],
    });
  });
});

describe("handsCategoryOf (D-233)", () => {
  it("categorizes a melee weapon", () => {
    expect(handsCategoryOf("dagger")).toBe("melee");
    expect(handsCategoryOf("greatsword")).toBe("melee");
  });

  it("categorizes a ranged weapon", () => {
    expect(handsCategoryOf("shortbow")).toBe("ranged");
    expect(handsCategoryOf("longbow")).toBe("ranged");
  });

  it("categorizes a real shield as \"shield\"", () => {
    expect(handsCategoryOf("shield")).toBe("shield");
  });

  it("categorizes a spellcasting focus as \"focus\", not \"shield\" (D-232's itemKind tag)", () => {
    expect(handsCategoryOf("arcane-focus")).toBe("focus");
    expect(handsCategoryOf("holy-symbol")).toBe("focus");
  });

  it("returns null for an item that isn't eligible for either hand", () => {
    expect(handsCategoryOf("leather-cap")).toBeNull();
  });
});

describe("weaponGripOf (D-233)", () => {
  it("is oneHanded for a Light melee weapon", () => {
    expect(weaponGripOf("dagger")).toBe("oneHanded");
    expect(weaponGripOf("shortsword")).toBe("oneHanded");
  });

  it("is twoHanded for a Two-Handed weapon, melee or ranged", () => {
    expect(weaponGripOf("greatsword")).toBe("twoHanded");
    expect(weaponGripOf("longbow")).toBe("twoHanded");
  });

  it("is oneHanded for a one-handed ranged weapon", () => {
    expect(weaponGripOf("sling")).toBe("oneHanded");
  });

  it("is null for a real shield or a focus — neither has a grip of its own", () => {
    expect(weaponGripOf("shield")).toBeNull();
    expect(weaponGripOf("arcane-focus")).toBeNull();
  });
});

describe("isMagicItem (D-233)", () => {
  it("is false only for common", () => {
    expect(isMagicItem("common")).toBe(false);
  });

  it("is true for every rarity above common", () => {
    expect(isMagicItem("uncommon")).toBe(true);
    expect(isMagicItem("rare")).toBe(true);
    expect(isMagicItem("veryRare")).toBe(true);
    expect(isMagicItem("legendary")).toBe(true);
  });
});

describe("applyCatalogFilters (D-233)", () => {
  const HANDS_IDS = ["dagger", "shortsword", "greatsword", "shortbow", "sling", "shield", "arcane-focus"];
  const getRarity = (id: string) => getEquipmentDefinition(id).rarity;
  const NO_FILTERS: CatalogFilters = {
    rarity: "all",
    magicOnly: false,
    handsCategory: "all",
    weaponCategory: "all",
    grip: "all",
    proficiencyClassId: null,
  };

  it("passes everything through when every filter is at its default", () => {
    expect(applyCatalogFilters(HANDS_IDS, getRarity, NO_FILTERS)).toEqual(HANDS_IDS);
  });

  it("filters by hands category alone", () => {
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, handsCategory: "melee" })).toEqual([
      "dagger",
      "shortsword",
      "greatsword",
    ]);
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, handsCategory: "focus" })).toEqual([
      "arcane-focus",
    ]);
  });

  it("filters by weapon type (simple/martial) alone, excluding non-weapons", () => {
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, weaponCategory: "simple" })).toEqual([
      "dagger",
      "shortbow",
      "sling",
    ]);
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, weaponCategory: "martial" })).toEqual([
      "shortsword",
      "greatsword",
    ]);
  });

  it("filters by grip alone, excluding non-weapons", () => {
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, grip: "twoHanded" })).toEqual([
      "greatsword",
      "shortbow",
    ]);
  });

  it("filters by magicOnly, excluding every common item", () => {
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, magicOnly: true })).toEqual([]);
  });

  it("combines dimensions (melee + martial)", () => {
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, handsCategory: "melee", weaponCategory: "martial" })).toEqual([
      "shortsword",
      "greatsword",
    ]);
  });

  it("filters by exact rarity tier", () => {
    expect(applyCatalogFilters(["dagger", "amulet-of-fury"], getRarity, { ...NO_FILTERS, rarity: "uncommon" })).toEqual([
      "amulet-of-fury",
    ]);
  });

  it("D-235: filters out items the given class isn't proficient with, but never a real shield/non-hands item", () => {
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, proficiencyClassId: "wizard" })).toEqual([
      "dagger",
      "shortbow",
      "sling",
      "shield",
      "arcane-focus",
    ]);
  });

  it("D-235: a class's named martial exception still passes, and a non-caster loses the focus", () => {
    expect(applyCatalogFilters(HANDS_IDS, getRarity, { ...NO_FILTERS, proficiencyClassId: "rogue" })).toEqual([
      "dagger",
      "shortsword",
      "shortbow",
      "sling",
      "shield",
    ]);
  });
});
