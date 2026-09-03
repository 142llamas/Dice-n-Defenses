import { describe, it, expect } from "vitest";
import { statMultiplierForBoss, BOSS_SCALING_CURVE, BOSS_LEVEL_OVERRIDES } from "../src/game/data/bossScaling";

describe("statMultiplierForBoss", () => {
  it("returns a no-op multiplier at the baseline level", () => {
    expect(statMultiplierForBoss("cinderlord", 1)).toEqual({ hp: 1, damage: 1, attackBonusAdd: 0 });
  });

  it("returns a no-op multiplier below the baseline level (never shrinks a boss)", () => {
    expect(statMultiplierForBoss("cinderlord", 0)).toEqual({ hp: 1, damage: 1, attackBonusAdd: 0 });
  });

  it("scales hp/damage/attackBonus upward with levels above the baseline", () => {
    const result = statMultiplierForBoss("cinderlord", 11); // 10 levels above baseline
    expect(result.hp).toBeCloseTo(1 + 10 * BOSS_SCALING_CURVE.hpGrowthPerLevel);
    expect(result.damage).toBeCloseTo(1 + 10 * BOSS_SCALING_CURVE.damageGrowthPerLevel);
    expect(result.attackBonusAdd).toBe(Math.round(10 * BOSS_SCALING_CURVE.attackBonusGrowthPerLevel));
  });

  it("scales strictly more at a higher target level than a lower one", () => {
    const low = statMultiplierForBoss("cinderlord", 10);
    const high = statMultiplierForBoss("cinderlord", 20);
    expect(high.hp).toBeGreaterThan(low.hp);
    expect(high.damage).toBeGreaterThan(low.damage);
    expect(high.attackBonusAdd ?? 0).toBeGreaterThanOrEqual(low.attackBonusAdd ?? 0);
  });

  it("applies the same curve uniformly to any boss id and any target level, serving both Free Play caps and campaign chapter bands", () => {
    for (const targetLevel of [5, 10, 15, 20]) {
      const a = statMultiplierForBoss("cinderlord", targetLevel);
      const b = statMultiplierForBoss("some-other-boss", targetLevel);
      expect(a).toEqual(b);
    }
  });

  it("respects a per-boss-per-level override when one exists, bypassing the curve entirely", () => {
    BOSS_LEVEL_OVERRIDES["test-boss"] = { 20: { hp: 5, damage: 5, attackBonusAdd: 99 } };
    try {
      expect(statMultiplierForBoss("test-boss", 20)).toEqual({ hp: 5, damage: 5, attackBonusAdd: 99 });
      // A different level for the same boss still falls back to the curve.
      expect(statMultiplierForBoss("test-boss", 15)).not.toEqual({ hp: 5, damage: 5, attackBonusAdd: 99 });
    } finally {
      delete BOSS_LEVEL_OVERRIDES["test-boss"];
    }
  });
});
