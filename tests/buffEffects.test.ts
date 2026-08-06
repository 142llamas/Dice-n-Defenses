import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";

/**
 * Phase 16 (D-106, "make all spells usable"): the ally-buff system — the
 * Hero-side counterpart to Enemy's status effects (tests/statusEffects.ts).
 * Covers apply/refresh/expire bookkeeping and each buff's real hookup
 * (attack bonus, Armor Class, saving throw bonus).
 */

const BASE_DEF: Omit<HeroDefinition, "id" | "classId"> = {
  name: "Test Hero",
  movementTiles: 3,
  maxHealth: 10,
  attackDamage: 3,
  attackRangeTiles: 1,
  attackBonus: 4,
  baseArmorClass: 10,
  abilityId: "cleave",
};

function makeHero(id = "h1"): Hero {
  return new Hero({ id, ...BASE_DEF }, { x: 0, y: 0 });
}

describe("Hero buff bookkeeping", () => {
  it("applies, reports, and expires a buff after its duration", () => {
    const hero = makeHero();
    expect(hero.hasBuff("blessed")).toBe(false);
    hero.applyBuff("blessed", 2);
    expect(hero.hasBuff("blessed")).toBe(true);
    hero.tickBuffs(); // 2 -> 1, still active
    expect(hero.hasBuff("blessed")).toBe(true);
    hero.tickBuffs(); // 1 -> 0, expires
    expect(hero.hasBuff("blessed")).toBe(false);
  });

  it("refreshes to the LONGER duration instead of stacking", () => {
    const hero = makeHero();
    hero.applyBuff("blessed", 1);
    hero.applyBuff("blessed", 3); // refresh to the longer one
    hero.tickBuffs();
    hero.tickBuffs();
    expect(hero.hasBuff("blessed")).toBe(true); // would have expired at 1
    hero.tickBuffs();
    expect(hero.hasBuff("blessed")).toBe(false);
  });

  it("ticks down once per resetForNewTurn call", () => {
    const hero = makeHero();
    hero.applyBuff("warded", 1);
    expect(hero.hasBuff("warded")).toBe(true);
    hero.resetForNewTurn();
    expect(hero.hasBuff("warded")).toBe(false);
  });
});

describe("Hero buff hookups", () => {
  it("blessed raises effectiveAttackBonus", () => {
    const hero = makeHero();
    expect(hero.effectiveAttackBonus).toBe(4);
    hero.applyBuff("blessed", 1);
    expect(hero.effectiveAttackBonus).toBe(6);
  });

  it("warded raises armorClass", () => {
    const hero = makeHero();
    expect(hero.armorClass).toBe(10);
    hero.applyBuff("warded", 1);
    expect(hero.armorClass).toBe(12);
  });

  it("guided raises savingThrowBonus", () => {
    const hero = makeHero();
    const base = hero.savingThrowBonus;
    hero.applyBuff("guided", 1);
    expect(hero.savingThrowBonus).toBe(base + 2);
  });
});

describe("Hero buff snapshot round trip", () => {
  it("survives toSnapshot -> fromSnapshot", () => {
    const hero = makeHero();
    hero.applyBuff("blessed", 3);
    const restored = Hero.fromSnapshot(hero.toSnapshot());
    expect(restored.hasBuff("blessed")).toBe(true);
    expect(restored.effectiveAttackBonus).toBe(hero.effectiveAttackBonus);
  });
});
