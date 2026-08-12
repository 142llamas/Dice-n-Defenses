import { describe, it, expect, vi } from "vitest";
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

/**
 * D-124: two new options on a failed save — `halveOnFail` (Rogue's/Monk's
 * Evasion) and `rerollFailedSave` (Fighter's Indomitable). Both are
 * exercised end-to-end against a real `WaveSystem`/Blightcaller in
 * `tests/combat.test.ts`; these focus on the pure function's own logic in
 * isolation, mirroring every other block in this file.
 */
describe("SavingThrowSystem.applySaveOrDamage — halveOnFail (D-124)", () => {
  it("halves (floored) the damage on a failed save when set", () => {
    const t = target(10);
    const result = SavingThrowSystem.applySaveOrDamage(t, 7, 15, 0, RandomService.fixed(1), "normal", { halveOnFail: true });
    expect(result.save.success).toBe(false);
    expect(result.damageDealt).toBe(3); // floor(7 / 2)
    expect(t.health).toBe(7);
  });

  it("a successful save always deals 0 damage, halveOnFail or not", () => {
    const t = target(10);
    const result = SavingThrowSystem.applySaveOrDamage(t, 7, 15, 0, RandomService.fixed(20), "normal", { halveOnFail: true });
    expect(result.save.success).toBe(true);
    expect(result.damageDealt).toBe(0);
    expect(t.health).toBe(10);
  });

  it("deals full damage on a failed save when the flag is absent (unchanged pre-D-124 behavior)", () => {
    const t = target(10);
    const result = SavingThrowSystem.applySaveOrDamage(t, 7, 15, 0, RandomService.fixed(1));
    expect(result.damageDealt).toBe(7);
  });
});

describe("SavingThrowSystem.applySaveOrDamage — rerollFailedSave (D-124)", () => {
  it("is invoked only when the first roll fails, and the new roll replaces it outright", () => {
    // Seed 5's first two d20 draws are 14 then 16 (verified against RandomService's
    // own mulberry32 algorithm): with bonus 0 and DC 15, the first roll fails
    // (14 < 15) and the second succeeds (16 >= 15).
    const t = target(10);
    const reroll = vi.fn(() => true);
    const result = SavingThrowSystem.applySaveOrDamage(t, 6, 15, 0, RandomService.seeded(5), "normal", {
      rerollFailedSave: reroll,
    });
    expect(reroll).toHaveBeenCalledTimes(1);
    expect(result.save.d20).toBe(16);
    expect(result.save.success).toBe(true);
    expect(result.damageDealt).toBe(0);
    expect(t.health).toBe(10);
  });

  it("is never invoked when the first roll already succeeds", () => {
    const t = target(10);
    const reroll = vi.fn(() => true);
    SavingThrowSystem.applySaveOrDamage(t, 6, 15, 0, RandomService.fixed(20), "normal", { rerollFailedSave: reroll });
    expect(reroll).not.toHaveBeenCalled();
  });

  it("declining the reroll (returns false) keeps the original failed result", () => {
    const t = target(10);
    const reroll = vi.fn(() => false);
    const result = SavingThrowSystem.applySaveOrDamage(t, 6, 15, 0, RandomService.seeded(5), "normal", {
      rerollFailedSave: reroll,
    });
    expect(reroll).toHaveBeenCalledTimes(1);
    expect(result.save.d20).toBe(14); // the original roll, never replaced
    expect(result.save.success).toBe(false);
    expect(result.damageDealt).toBe(6);
  });
});
