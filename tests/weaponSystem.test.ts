import { describe, it, expect } from "vitest";
import {
  averageDiceDamage,
  weaponAttackDamage,
  weaponRangeTiles,
  weaponAbilityModifier,
} from "../src/game/systems/WeaponSystem";
import type { WeaponData } from "../src/game/data/weapons";

/**
 * Phase 17 (D-108): pure weapon-math tests. `averageDiceDamage` uses the
 * SAME "round half up per die" convention `CharacterSystem.fixedHitDieGain`
 * already established for hit-die averages — these numbers are the direct,
 * checkable consequence of that formula, not independently chosen.
 */

describe("averageDiceDamage", () => {
  it("averages a single die, rounding the traditional half up", () => {
    expect(averageDiceDamage("1d4")).toBe(3); // 2.5 -> 3
    expect(averageDiceDamage("1d6")).toBe(4); // 3.5 -> 4
    expect(averageDiceDamage("1d8")).toBe(5); // 4.5 -> 5
    expect(averageDiceDamage("1d10")).toBe(6); // 5.5 -> 6
    expect(averageDiceDamage("1d12")).toBe(7); // 6.5 -> 7
  });

  it("scales linearly with multiple dice", () => {
    expect(averageDiceDamage("2d6")).toBe(8); // 2 * 4
    expect(averageDiceDamage("2d6")).toBe(2 * averageDiceDamage("1d6"));
  });

  it("treats a flat integer string (the Blowgun) as itself", () => {
    expect(averageDiceDamage("1")).toBe(1);
  });
});

const longsword: WeaponData = {
  category: "martial",
  kind: "melee",
  damageDice: "1d8",
  damageType: "slashing",
  properties: ["versatile"],
  versatileDamageDice: "1d10",
  mastery: "sap",
};

const shortbow: WeaponData = {
  category: "simple",
  kind: "ranged",
  damageDice: "1d6",
  damageType: "piercing",
  properties: ["ammunition", "twoHanded"],
  mastery: "vex",
};

const rapier: WeaponData = {
  category: "martial",
  kind: "melee",
  damageDice: "1d8",
  damageType: "piercing",
  properties: ["finesse"],
  mastery: "vex",
};

describe("weaponAttackDamage", () => {
  it("uses the one-handed die plus ability modifier by default", () => {
    expect(weaponAttackDamage(longsword, { abilityModifier: 3, twoHandedGrip: false })).toBe(5 + 3);
  });

  it("uses the versatile (two-handed) die when gripped two-handed", () => {
    expect(weaponAttackDamage(longsword, { abilityModifier: 3, twoHandedGrip: true })).toBe(6 + 3);
  });

  it("ignores twoHandedGrip for a weapon with no versatile die", () => {
    expect(weaponAttackDamage(shortbow, { abilityModifier: 2, twoHandedGrip: true })).toBe(4 + 2);
  });

  it("never drops below 1 even with a very negative ability modifier", () => {
    expect(weaponAttackDamage(shortbow, { abilityModifier: -10, twoHandedGrip: false })).toBe(1);
  });
});

describe("weaponRangeTiles", () => {
  it("reaches 1 tile for a plain melee weapon", () => {
    expect(weaponRangeTiles(longsword)).toBe(1);
  });

  it("reaches 2 tiles for a Reach weapon", () => {
    const glaive: WeaponData = { ...longsword, properties: ["heavy", "reach", "twoHanded"] };
    expect(weaponRangeTiles(glaive)).toBe(2);
  });

  it("reaches 2 tiles for a Thrown (non-Ammunition) weapon", () => {
    const javelin: WeaponData = { ...longsword, properties: ["thrown"] };
    expect(weaponRangeTiles(javelin)).toBe(2);
  });

  it("reaches 3 tiles for an Ammunition weapon", () => {
    expect(weaponRangeTiles(shortbow)).toBe(3);
  });
});

describe("weaponAbilityModifier", () => {
  it("uses Strength for a plain melee weapon", () => {
    expect(weaponAbilityModifier(longsword, 3, 1)).toBe(3);
  });

  it("uses Dexterity for a ranged weapon with no Finesse", () => {
    expect(weaponAbilityModifier(shortbow, 3, 1)).toBe(1);
  });

  it("picks the BETTER of Strength/Dexterity for a Finesse weapon", () => {
    expect(weaponAbilityModifier(rapier, 1, 4)).toBe(4);
    expect(weaponAbilityModifier(rapier, 5, 2)).toBe(5);
  });
});
