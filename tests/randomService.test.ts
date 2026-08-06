import { describe, it, expect } from "vitest";
import { RandomService } from "../src/game/systems/RandomService";

/**
 * Phase 13.1 (D-086) dice core. RandomService is the one seedable source of
 * randomness real combat now draws on (Source of Truth "controlled
 * randomness" — a service tests can seed). See CombatSystem's tests for how
 * `fixed()` is used as the deterministic test double for combat resolution;
 * this file covers RandomService's own contract in isolation.
 */

describe("RandomService", () => {
  it("rollD20 always returns an integer from 1 to 20", () => {
    const random = RandomService.seeded(12345);
    for (let i = 0; i < 500; i++) {
      const roll = random.rollD20();
      expect(Number.isInteger(roll)).toBe(true);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(20);
    }
  });

  it("the same seed produces the exact same sequence of rolls", () => {
    const a = RandomService.seeded(42);
    const b = RandomService.seeded(42);
    const seqA = Array.from({ length: 20 }, () => a.rollD20());
    const seqB = Array.from({ length: 20 }, () => b.rollD20());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds (almost certainly) produce different sequences", () => {
    const a = RandomService.seeded(1);
    const b = RandomService.seeded(2);
    const seqA = Array.from({ length: 20 }, () => a.rollD20());
    const seqB = Array.from({ length: 20 }, () => b.rollD20());
    expect(seqA).not.toEqual(seqB);
  });

  it("fixed() returns the same value every time, for any roll method", () => {
    const random = RandomService.fixed(17);
    expect(random.rollD20()).toBe(17);
    expect(random.rollD20()).toBe(17);
    expect(random.rollD20With("advantage")).toBe(17);
    expect(random.rollD20With("disadvantage")).toBe(17);
  });

  it("fixed() defaults to 15 — a guaranteed hit against this project's armor classes, never a crit or fumble", () => {
    const random = RandomService.fixed();
    expect(random.rollD20()).toBe(15);
  });

  it("advantage keeps the higher of two rolls, disadvantage the lower", () => {
    for (let i = 0; i < 100; i++) {
      // A fresh instance from the same seed draws the identical (a, b) pair
      // rollD20With("advantage"/"disadvantage") draws internally, so this
      // predicts exactly what each mode must return.
      const control = RandomService.seeded(1000 + i);
      const a = control.rollD20();
      const b = control.rollD20();
      expect(RandomService.seeded(1000 + i).rollD20With("advantage")).toBe(Math.max(a, b));
      expect(RandomService.seeded(1000 + i).rollD20With("disadvantage")).toBe(Math.min(a, b));
    }
  });

  it("normal mode draws exactly one roll (matches a plain rollD20 from the same seed)", () => {
    const a = RandomService.seeded(99);
    const b = RandomService.seeded(99);
    expect(a.rollD20With("normal")).toBe(b.rollD20());
  });

  /** Phase 22 (magic-item expansion): the loot system's own roll primitives. */
  describe("rollPercent/rollIndex", () => {
    it("rollPercent always returns an integer from 0 to 99", () => {
      const random = RandomService.seeded(2026);
      for (let i = 0; i < 500; i++) {
        const roll = random.rollPercent();
        expect(Number.isInteger(roll)).toBe(true);
        expect(roll).toBeGreaterThanOrEqual(0);
        expect(roll).toBeLessThanOrEqual(99);
      }
    });

    it("fixed() forces a specific, cappable rollPercent outcome", () => {
      expect(RandomService.fixed(0).rollPercent()).toBe(0);
      expect(RandomService.fixed(99).rollPercent()).toBe(99);
      expect(RandomService.fixed(150).rollPercent()).toBe(99); // capped, never >= 100
    });

    it("rollIndex always returns an integer in [0, count)", () => {
      const random = RandomService.seeded(777);
      for (let i = 0; i < 200; i++) {
        const roll = random.rollIndex(7);
        expect(Number.isInteger(roll)).toBe(true);
        expect(roll).toBeGreaterThanOrEqual(0);
        expect(roll).toBeLessThan(7);
      }
    });

    it("rollIndex(0) is always 0, never a divide-by-zero/NaN", () => {
      expect(RandomService.seeded(1).rollIndex(0)).toBe(0);
      expect(RandomService.fixed().rollIndex(0)).toBe(0);
    });

    it("fixed() always picks index 0 — the pool's first entry, for deterministic tests", () => {
      expect(RandomService.fixed(15).rollIndex(10)).toBe(0);
    });
  });
});
