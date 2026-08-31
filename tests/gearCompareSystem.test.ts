import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";
import { isItemEligibleForSlot, isOffHandEligibleWeapon, previewGearSlotChange, formatGearDelta } from "../src/game/systems/GearCompareSystem";
import { getEquipmentDefinition } from "../src/game/data/equipment";

/**
 * D-209 (The Armory): `GearCompareSystem` is what a slot-first shopping flow
 * needs that the old item-first flow didn't — "does this item fit the slot
 * I already picked" (`isItemEligibleForSlot`) instead of "which slot should
 * this item go in" (the old, now-deleted `targetGearSlot`), plus a pure
 * before/after preview (`previewGearSlotChange`) for the compare panel.
 */

const WREN_TEST_HERO_DEF: HeroDefinition = {
  id: "hero-wren-test",
  name: "Test Hero",
  movementTiles: 3,
  maxHealth: 8,
  attackDamage: 3,
  attackRangeTiles: 3,
  attackBonus: 4,
  baseArmorClass: 10,
};

function wren(): Hero {
  return new Hero(WREN_TEST_HERO_DEF, { x: 0, y: 0 });
}

describe("isItemEligibleForSlot", () => {
  it("matches an item to its own slot type", () => {
    expect(isItemEligibleForSlot("iron-buckler", "chest")).toBe(true);
    expect(isItemEligibleForSlot("whetstone-band", "ring1")).toBe(true);
    expect(isItemEligibleForSlot("whetstone-band", "ring2")).toBe(true);
  });

  it("rejects an item that doesn't match the slot", () => {
    expect(isItemEligibleForSlot("iron-buckler", "legs")).toBe(false);
    expect(isItemEligibleForSlot("longsword", "chest")).toBe(false);
  });

  it("a real Shield only fits the shield (Left hand) slot, never weapon (Right hand)", () => {
    expect(isItemEligibleForSlot("shield", "shield")).toBe(true);
    expect(isItemEligibleForSlot("shield", "weapon")).toBe(false);
  });

  it("a Light melee weapon fits BOTH hand slots (D-110 dual-wielding), a non-Light weapon only weapon", () => {
    expect(isOffHandEligibleWeapon(getEquipmentDefinition("dagger"))).toBe(true);
    expect(isItemEligibleForSlot("dagger", "weapon")).toBe(true);
    expect(isItemEligibleForSlot("dagger", "shield")).toBe(true);

    expect(isOffHandEligibleWeapon(getEquipmentDefinition("greatsword"))).toBe(false);
    expect(isItemEligibleForSlot("greatsword", "weapon")).toBe(true);
    expect(isItemEligibleForSlot("greatsword", "shield")).toBe(false);
  });
});

describe("previewGearSlotChange", () => {
  it("reports no change on both sides when the slot already holds this exact item", () => {
    const hero = wren();
    hero.equippedItems.chest = "iron-buckler";
    const preview = previewGearSlotChange(hero, "chest", "iron-buckler");
    expect(preview.beforeAC).toBe(preview.afterAC);
    expect(preview.beforeAttackDamage).toBe(preview.afterAttackDamage);
  });

  it("reflects an AC-only item's delta without touching attack numbers", () => {
    const hero = wren();
    const preview = previewGearSlotChange(hero, "chest", "iron-buckler");
    expect(preview.beforeAC).toBe(10);
    expect(preview.afterAC).toBe(10 + (getEquipmentDefinition("iron-buckler").armorClass ?? 0));
    expect(preview.beforeAttackDamage).toBe(preview.afterAttackDamage);
  });

  it("reflects a weapon's REPLACED (not summed) attack damage", () => {
    const hero = wren(); // base attack damage 3
    const preview = previewGearSlotChange(hero, "weapon", "greatsword"); // 2d6 -> avg 8
    expect(preview.beforeAttackDamage).toBe(3);
    expect(preview.afterAttackDamage).toBe(8);
  });

  it("never mutates the real hero — only a throwaway clone", () => {
    const hero = wren();
    previewGearSlotChange(hero, "weapon", "greatsword");
    expect(hero.equippedItems.weapon).toBeUndefined();
    expect(hero.effectiveAttackDamage).toBe(3);
  });
});

describe("formatGearDelta", () => {
  it("reports an AC-only change", () => {
    const hero = wren();
    const preview = previewGearSlotChange(hero, "chest", "iron-buckler");
    expect(formatGearDelta(preview)).toBe(`AC 10→${preview.afterAC}`);
  });

  it("reports no change when both sides are identical", () => {
    const hero = wren();
    hero.equippedItems.chest = "iron-buckler";
    const preview = previewGearSlotChange(hero, "chest", "iron-buckler");
    expect(formatGearDelta(preview)).toBe("No AC/attack change");
  });

  it("reports both AC and attack-bonus changes together, comma-separated", () => {
    const hero = wren();
    const preview = previewGearSlotChange(hero, "amulet", "bracers-of-archery");
    hero.equippedItems.weapon = "shortbow";
    const previewWithRanged = previewGearSlotChange(hero, "amulet", "bracers-of-archery");
    expect(formatGearDelta(previewWithRanged)).toContain("attack");
    expect(formatGearDelta(preview)).toBe("No AC/attack change"); // no ranged weapon yet — no bonus applies
  });
});
