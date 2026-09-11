import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";
import { isItemEligibleForSlot, isOffHandEligibleWeapon, previewGearSlotChange, formatGearDelta } from "../src/game/systems/GearCompareSystem";
import { getEquipmentDefinition } from "../src/game/data/equipment";
import { getSpell } from "../src/game/data/spells";

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

/** A D&D-built hero (has `abilityScores`, none of it above 10) — the classic-roster `wren()` fixture always reports `effectiveAbilityScore` as 0 (see `Hero.effectiveAbilityScore`), so a `setsAbilityScore` item's effect needs its own fixture to be observable at all. */
function wrenWithAbilityScores(): Hero {
  return new Hero(
    { ...WREN_TEST_HERO_DEF, abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    { x: 0, y: 0 },
  );
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
    expect(formatGearDelta(preview)).toBe("No change");
  });

  it("reports both AC and attack-bonus changes together, comma-separated", () => {
    const hero = wren();
    const preview = previewGearSlotChange(hero, "amulet", "bracers-of-archery");
    hero.equippedItems.weapon = "shortbow";
    const previewWithRanged = previewGearSlotChange(hero, "amulet", "bracers-of-archery");
    expect(formatGearDelta(previewWithRanged)).toContain("attack");
    expect(formatGearDelta(preview)).toBe("No change"); // no ranged weapon yet — no bonus applies
  });

  // Item 4 (Batch B, KI-187): every field below used to fall through to the
  // (now impossible) "No AC/attack change" fallback even though the item
  // clearly does something — the exact playtest complaint.

  it("reports a weapon swap's damage-dice change", () => {
    const hero = wren(); // base attack damage 3
    const preview = previewGearSlotChange(hero, "weapon", "greatsword"); // 2d6 -> avg 8
    expect(formatGearDelta(preview)).toBe("dmg 3→8");
  });

  it("reports a saving-throw-only item's change", () => {
    const hero = wren();
    const before = hero.savingThrowBonus;
    const preview = previewGearSlotChange(hero, "ring1", "luckstone");
    expect(preview.afterSavingThrow).toBe(before + 1);
    expect(formatGearDelta(preview)).toBe(`save +${before}→+${before + 1}`);
  });

  it("reports a movement-only item's change", () => {
    const hero = wren(); // movementTiles 3
    const preview = previewGearSlotChange(hero, "footwear", "boots-of-striding-and-springing");
    expect(formatGearDelta(preview)).toBe("move 3→5");
  });

  it("reports an ability-score-setting item's change, abbreviated", () => {
    const hero = wrenWithAbilityScores(); // str 10
    const preview = previewGearSlotChange(hero, "amulet", "gauntlets-of-ogre-power"); // sets str to 19
    expect(preview.abilityScoreChanges).toEqual([{ ability: "str", before: 10, after: 19 }]);
    expect(formatGearDelta(preview)).toBe("STR 10→19");
  });

  it("has no effect on a hero whose score already meets the item's floor", () => {
    const hero = new Hero(
      { ...WREN_TEST_HERO_DEF, abilityScores: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      { x: 0, y: 0 },
    );
    const preview = previewGearSlotChange(hero, "amulet", "gauntlets-of-ogre-power");
    expect(preview.abilityScoreChanges).toEqual([]);
  });

  it("reports a gained status immunity", () => {
    const hero = wren();
    const preview = previewGearSlotChange(hero, "ring1", "ring-of-free-action");
    expect(preview.statusImmunityGained.sort()).toEqual(["restrained", "stunned"]);
    expect(formatGearDelta(preview)).toBe("+immune: Restrained, +immune: Stunned");
  });

  it("reports a lost status immunity when swapping away from an immunity item", () => {
    const hero = wren();
    hero.equippedItems.amulet = "periapt-of-proof-against-poison";
    const preview = previewGearSlotChange(hero, "amulet", "bracers-of-archery");
    expect(preview.statusImmunityLost).toEqual(["poisoned"]);
    expect(formatGearDelta(preview)).toContain("-immune: Poisoned");
  });

  it("reports a granted charged spell", () => {
    const hero = wren();
    const preview = previewGearSlotChange(hero, "amulet", "wand-of-magic-missile");
    expect(preview.chargedSpellGained).toEqual({ spellId: "magic-missile", maxCharges: 7 });
    expect(formatGearDelta(preview)).toBe(`+${getSpell("magic-missile").name} (7 charges)`);
  });
});
