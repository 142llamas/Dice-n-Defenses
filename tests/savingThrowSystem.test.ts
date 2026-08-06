import { describe, it, expect } from "vitest";
import { SavingThrowSystem } from "../src/game/systems/SavingThrowSystem";
import { RandomService } from "../src/game/systems/RandomService";
import type { Combatant } from "../src/game/systems/CombatSystem";

/**
 * Phase 13.5 (DECISIONS D-090): SavingThrowSystem mirrors CombatSystem's dice
 * resolution (see tests/combat.test.ts's "dice resolution" block) but for a
 * saving throw instead of an attack roll: success means NO damage, not a hit.
 */

function target(health = 10): Combatant {
  return { id: "target-1", position: { x: 0, y: 0 }, health };
}

describe("SavingThrowSystem.rollSave", () => {
  it("succeeds when the total meets or beats the DC", () => {
    const result = SavingThrowSystem.rollSave(5, 15, RandomService.fixed(10)); // 10 + 5 = 15
    expect(result.success).toBe(true);
    expect(result.total).toBe(15);
  });

  it("fails when the total falls short of the DC", () => {
    const result = SavingThrowSystem.rollSave(2, 15, RandomService.fixed(10)); // 10 + 2 = 12
    expect(result.success).toBe(false);
  });

  it("a natural 20 always succeeds, even against an unbeatable DC/bonus", () => {
    const result = SavingThrowSystem.rollSave(-5, 30, RandomService.fixed(20));
    expect(result.d20).toBe(20);
    expect(result.success).toBe(true);
  });

  it("a natural 1 always fails, even with a bonus that would otherwise clear the DC", () => {
    const result = SavingThrowSystem.rollSave(20, 10, RandomService.fixed(1));
    expect(result.d20).toBe(1);
    expect(result.success).toBe(false);
  });
});

describe("SavingThrowSystem.applySaveOrDamage", () => {
  it("deals no damage on a successful save", () => {
    const t = target(10);
    const result = SavingThrowSystem.applySaveOrDamage(t, 6, 15, 5, RandomService.fixed(10)); // 10+5=15, succeeds
    expect(result.save.success).toBe(true);
    expect(result.damageDealt).toBe(0);
    expect(t.health).toBe(10);
  });

  it("deals full damage on a failed save, mutating the target's health", () => {
    const t = target(10);
    const result = SavingThrowSystem.applySaveOrDamage(t, 6, 15, 0, RandomService.fixed(10)); // 10+0=10, fails
    expect(result.save.success).toBe(false);
    expect(result.damageDealt).toBe(6);
    expect(t.health).toBe(4);
    expect(result.healthAfter).toBe(4);
  });

  it("reports defeated exactly on the strike that reaches 0 HP", () => {
    const t = target(4);
    const result = SavingThrowSystem.applySaveOrDamage(t, 6, 15, 0, RandomService.fixed(10));
    expect(result.defeated).toBe(true);
    expect(t.health).toBe(0);
  });

  it("does nothing to an already-defeated target", () => {
    const t = target(0);
    const result = SavingThrowSystem.applySaveOrDamage(t, 6, 15, 0, RandomService.fixed(10));
    expect(result.damageDealt).toBe(0);
    expect(result.defeated).toBe(false);
    expect(t.health).toBe(0);
  });
});
