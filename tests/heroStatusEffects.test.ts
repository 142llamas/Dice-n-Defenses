import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";

const TEST_HERO_DEF: HeroDefinition = {
  id: "hero-test",
  name: "Test Hero",
  movementTiles: 4,
  maxHealth: 12,
  attackDamage: 4,
  attackRangeTiles: 1,
  attackBonus: 4,
  baseArmorClass: 10,
  abilityId: "cleave",
};

/**
 * Phase 21 (D-112): a hero can now carry the same status effects an enemy
 * always could — Kevin chose the FULL generic system over a narrow
 * poison+silence-only one. `Hero.activeStatuses` mirrors `Enemy
 * .activeStatuses` field-for-field, reusing data/statusEffects.ts's exact
 * shape. These tests cover only the hero-SIDE consumption (armorClass fold-
 * in, movement reduction, incapacitation, damage-over-time, disadvantage,
 * silencing) — the underlying apply/refresh/expire bookkeeping is already
 * exhaustively covered for Enemy in tests/statusEffects.test.ts and is byte-
 * for-byte the same code shape here.
 */

function testHero(): Hero {
  return new Hero(TEST_HERO_DEF, { x: 0, y: 0 });
}

describe("Hero status effect bookkeeping", () => {
  it("applies, reports, and expires a status after its duration", () => {
    const hero = testHero();
    expect(hero.hasStatus("poisoned")).toBe(false);
    hero.applyStatus("poisoned", 2);
    expect(hero.hasStatus("poisoned")).toBe(true);
    hero.tickStatuses();
    expect(hero.hasStatus("poisoned")).toBe(true);
    hero.tickStatuses();
    expect(hero.hasStatus("poisoned")).toBe(false);
  });

  it("refreshes to the LONGER duration instead of stacking", () => {
    const hero = testHero();
    hero.applyStatus("silenced", 1);
    hero.applyStatus("silenced", 3);
    hero.tickStatuses();
    hero.tickStatuses();
    expect(hero.hasStatus("silenced")).toBe(true); // would have expired at 1
    hero.tickStatuses();
    expect(hero.hasStatus("silenced")).toBe(false);
  });
});

describe("Hero: armorClassDelta (exposed) folds into armorClass", () => {
  it("lowers effective Armor Class while active, restored once expired", () => {
    const hero = testHero();
    const baseAC = hero.armorClass;
    hero.applyStatus("exposed", 2);
    expect(hero.armorClass).toBe(baseAC - 2);
    hero.tickStatuses();
    hero.tickStatuses();
    expect(hero.armorClass).toBe(baseAC);
  });
});

describe("Hero: movementReduction (slowed) folds into effectiveMovementTiles", () => {
  it("reduces movement budget while slowed, never below 0", () => {
    const hero = testHero();
    const base = hero.movementTiles;
    expect(hero.effectiveMovementTiles).toBe(base);
    hero.applyStatus("slowed", 1); // -2
    expect(hero.effectiveMovementTiles).toBe(Math.max(0, base - 2));
    expect(hero.movementBudget()).toBe(Math.max(0, base - 2));
  });
});

describe("Hero: preventsAction (stunned/restrained) blocks moving and acting", () => {
  it.each(["stunned", "restrained"] as const)("%s prevents canMove/canAct", (statusId) => {
    const hero = testHero();
    expect(hero.canMove()).toBe(true);
    expect(hero.canAct()).toBe(true);
    hero.applyStatus(statusId, 1);
    expect(hero.canMove()).toBe(false);
    expect(hero.canAct()).toBe(false);
    hero.tickStatuses();
    expect(hero.canMove()).toBe(true);
    expect(hero.canAct()).toBe(true);
  });
});

describe("Hero: attackRollDisadvantage (blinded/sapped/toppled) exposed via attacksWithDisadvantage", () => {
  it.each(["blinded", "sapped", "toppled"] as const)("%s", (statusId) => {
    const hero = testHero();
    expect(hero.attacksWithDisadvantage).toBe(false);
    hero.applyStatus(statusId, 1);
    expect(hero.attacksWithDisadvantage).toBe(true);
    hero.tickStatuses();
    expect(hero.attacksWithDisadvantage).toBe(false);
  });
});

describe("Hero: preventsCasting (silenced) exposed via isSilenced", () => {
  it("blocks casting only, not moving or a basic attack", () => {
    const hero = testHero();
    expect(hero.isSilenced).toBe(false);
    hero.applyStatus("silenced", 2);
    expect(hero.isSilenced).toBe(true);
    expect(hero.canMove()).toBe(true); // silenced ≠ incapacitated
    expect(hero.canAct()).toBe(true);
    hero.tickStatuses();
    hero.tickStatuses();
    expect(hero.isSilenced).toBe(false);
  });
});

describe("Hero: damagePerTurn (poisoned) via tickStatusDamage", () => {
  it("deals damage and reports the total, floored at 0 health", () => {
    const hero = testHero();
    const startHealth = hero.health;
    hero.applyStatus("poisoned", 3); // 2 dmg/phase
    const dealt = hero.tickStatusDamage();
    expect(dealt).toBe(2);
    expect(hero.health).toBe(startHealth - 2);
  });

  it("returns 0 with no active damage-over-time status", () => {
    const hero = testHero();
    expect(hero.tickStatusDamage()).toBe(0);
  });

  it("never drops health below 0, and returns 0 once already defeated", () => {
    const hero = testHero();
    hero.health = 1;
    hero.applyStatus("poisoned", 1);
    const dealt = hero.tickStatusDamage();
    expect(dealt).toBe(1);
    expect(hero.health).toBe(0);
    expect(hero.isAlive()).toBe(false);
    hero.applyStatus("poisoned", 1);
    expect(hero.tickStatusDamage()).toBe(0); // already dead — no further "damage" to report
  });
});

describe("Hero: resetForNewTurn ticks statuses down, same cadence as buffs", () => {
  it("expires a 1-turn status on the next reset", () => {
    const hero = testHero();
    hero.applyStatus("silenced", 1);
    hero.resetForNewTurn();
    expect(hero.isSilenced).toBe(false);
  });
});

describe("Hero: toSnapshot/fromSnapshot round-trips activeStatuses", () => {
  it("preserves every active status and its remaining duration", () => {
    const hero = testHero();
    hero.applyStatus("poisoned", 3);
    hero.applyStatus("silenced", 1);
    const snap = hero.toSnapshot();
    const restored = Hero.fromSnapshot(snap);
    expect(restored.hasStatus("poisoned")).toBe(true);
    expect(restored.hasStatus("silenced")).toBe(true);
    expect(restored.toSnapshot().activeStatuses).toEqual(snap.activeStatuses);
  });
});
