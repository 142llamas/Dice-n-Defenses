import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";
import { getPotionDefinition, POTION_ORDER } from "../src/game/data/potions";

/**
 * Phase 11.5 (D-078) potion tests. Potions are consumable: using one applies
 * a flat, instant effect (heal or a permanent-for-the-battle attack buff —
 * see data/potions.ts for why no duration/expiry tracking is needed) and then
 * empties the slot, so it can never be used twice.
 */

const WREN_TEST_HERO_DEF: HeroDefinition = {
  id: "hero-wren-test",
  name: "Test Hero",
  movementTiles: 3,
  maxHealth: 8,
  attackDamage: 3, // 3 base attack dmg
  attackRangeTiles: 3,
  attackBonus: 4,
  baseArmorClass: 10,
};

function wren(): Hero {
  return new Hero(WREN_TEST_HERO_DEF, { x: 0, y: 0 }); // 3 base attack dmg
}

describe("potion catalogue", () => {
  it("every catalogue entry resolves to a real definition", () => {
    for (const id of POTION_ORDER) {
      expect(getPotionDefinition(id).id).toBe(id);
    }
  });

  it("throws on an unknown potion id", () => {
    expect(() => getPotionDefinition("nonexistent")).toThrow();
  });
});

describe("Hero potions", () => {
  it("has no potions loaded by default", () => {
    const hero = wren();
    expect(hero.hasAnyPotion()).toBe(false);
    expect(hero.firstLoadedPotionSlot()).toBeNull();
  });

  it("healing draught restores HP capped at max", () => {
    const hero = wren();
    hero.health = hero.effectiveMaxHealth - 2;
    hero.equippedPotions.general1 = "healing-draught"; // heals 6
    const used = hero.usePotion("general1");
    expect(used?.id).toBe("healing-draught");
    expect(hero.health).toBe(hero.effectiveMaxHealth); // capped, not overhealed
  });

  it("vigor tonic grants a permanent attack buff", () => {
    const hero = wren();
    hero.equippedPotions.general1 = "vigor-tonic"; // +2 attack
    hero.usePotion("general1");
    expect(hero.effectiveAttackDamage).toBe(3 + 2);
  });

  it("using a potion empties its slot so it cannot be used twice", () => {
    const hero = wren();
    hero.equippedPotions.general1 = "healing-draught";
    hero.usePotion("general1");
    expect(hero.usePotion("general1")).toBeNull();
    expect(hero.hasAnyPotion()).toBe(false);
  });

  it("using an empty slot is a safe no-op", () => {
    const hero = wren();
    expect(hero.usePotion("general2")).toBeNull();
  });

  it("firstLoadedPotionSlot prefers general1 over general2", () => {
    const hero = wren();
    hero.equippedPotions.general2 = "healing-draught";
    expect(hero.firstLoadedPotionSlot()).toBe("general2");
    hero.equippedPotions.general1 = "vigor-tonic";
    expect(hero.firstLoadedPotionSlot()).toBe("general1");
  });
});

/**
 * Phase 22 (magic-item expansion): three new potion effect kinds, plus a
 * `rarity` field on every potion — the loot system's own tier key.
 */
describe("Phase 22 potion effects", () => {
  it("every catalogue entry has a rarity from the real ladder", () => {
    for (const id of POTION_ORDER) {
      expect(["common", "uncommon", "rare", "veryRare", "legendary"]).toContain(getPotionDefinition(id).rarity);
    }
  });

  it("potion of speed grants a permanent movement buff", () => {
    const hero = wren();
    const base = hero.effectiveMovementTiles;
    hero.equippedPotions.general1 = "potion-of-speed"; // +4 tiles (D-172)
    hero.usePotion("general1");
    expect(hero.effectiveMovementTiles).toBe(base + 4);
  });

  it("potion of resistance grants hasDamageResistance without ever expiring or blocking Rage", () => {
    const hero = wren();
    expect(hero.hasDamageResistance).toBe(false);
    hero.equippedPotions.general1 = "potion-of-resistance";
    hero.usePotion("general1");
    expect(hero.hasDamageResistance).toBe(true);
    // A permanent grant, unlike Rage/Wild Shape — resetForNewTurn never clears it.
    hero.resetForNewTurn();
    expect(hero.hasDamageResistance).toBe(true);
  });

  it("restorative ointment cures every active status effect and heals", () => {
    const hero = wren();
    hero.health = hero.effectiveMaxHealth - 10;
    hero.applyStatus("poisoned", 3);
    hero.applyStatus("slowed", 2);
    expect(hero.hasStatus("poisoned")).toBe(true);
    hero.equippedPotions.general1 = "restorative-ointment"; // heals 6, cures all
    hero.usePotion("general1");
    expect(hero.hasStatus("poisoned")).toBe(false);
    expect(hero.hasStatus("slowed")).toBe(false);
    expect(hero.health).toBe(hero.effectiveMaxHealth - 10 + 6);
  });
});
