import { describe, it, expect } from "vitest";
import {
  DIFFICULTY_IDS,
  getDifficultyDefinition,
  partySizeScalingFactor,
  BALANCED_PARTY_SIZE,
} from "../src/game/data/difficulty";

/**
 * Phase 11.4 (D-077): difficulty tiers and the party-size scaling factor that
 * combines with them in WaveSystem. Pure data/arithmetic only — see
 * tests/waves.test.ts for the WaveSystem behavior these numbers drive.
 */

describe("difficulty tiers", () => {
  it("defines all four tiers with Normal as a 1x baseline", () => {
    expect(DIFFICULTY_IDS).toEqual(["easy", "normal", "hard", "nightmare"]);
    const normal = getDifficultyDefinition("normal");
    expect(normal.enemyCountMultiplier).toBe(1);
    expect(normal.enemyHpMultiplier).toBe(1);
  });

  it("scales Easy below 1x and Hard/Nightmare above it, strictly increasing", () => {
    const easy = getDifficultyDefinition("easy");
    const hard = getDifficultyDefinition("hard");
    const nightmare = getDifficultyDefinition("nightmare");
    expect(easy.enemyCountMultiplier).toBeLessThan(1);
    expect(easy.enemyHpMultiplier).toBeLessThan(1);
    expect(hard.enemyCountMultiplier).toBeGreaterThan(1);
    expect(nightmare.enemyCountMultiplier).toBeGreaterThan(hard.enemyCountMultiplier);
    expect(nightmare.enemyHpMultiplier).toBeGreaterThan(hard.enemyHpMultiplier);
  });
});

describe("difficulty tiers — Rest-charge budget (Phase 13.4, D-088)", () => {
  it("gives every tier a non-negative Short/Long Rest charge count", () => {
    for (const id of DIFFICULTY_IDS) {
      const tier = getDifficultyDefinition(id);
      expect(tier.shortRestCharges).toBeGreaterThanOrEqual(0);
      expect(tier.longRestCharges).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives a harder tier no MORE rest charges than an easier one (harder = less recovery)", () => {
    const easy = getDifficultyDefinition("easy");
    const normal = getDifficultyDefinition("normal");
    const hard = getDifficultyDefinition("hard");
    const nightmare = getDifficultyDefinition("nightmare");
    expect(normal.shortRestCharges).toBeLessThanOrEqual(easy.shortRestCharges);
    expect(hard.shortRestCharges).toBeLessThanOrEqual(normal.shortRestCharges);
    expect(nightmare.shortRestCharges).toBeLessThanOrEqual(hard.shortRestCharges);
    expect(normal.longRestCharges).toBeLessThanOrEqual(easy.longRestCharges);
  });

  it("always gives Long Rest charges a much smaller pool than Short Rest, per D-086", () => {
    for (const id of DIFFICULTY_IDS) {
      const tier = getDifficultyDefinition(id);
      expect(tier.longRestCharges).toBeLessThan(Math.max(1, tier.shortRestCharges));
    }
  });
});

describe("difficulty tiers — campaign gear economy (D-194)", () => {
  it("gives every tier a non-negative gear-points budget and discretionary-slot count", () => {
    for (const id of DIFFICULTY_IDS) {
      const tier = getDifficultyDefinition(id);
      expect(tier.startingGearPoints).toBeGreaterThanOrEqual(0);
      expect(tier.companionDiscretionaryGearSlots).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives a harder tier no MORE gear points or discretionary slots than an easier one", () => {
    const easy = getDifficultyDefinition("easy");
    const normal = getDifficultyDefinition("normal");
    const hard = getDifficultyDefinition("hard");
    const nightmare = getDifficultyDefinition("nightmare");
    expect(normal.startingGearPoints).toBeLessThanOrEqual(easy.startingGearPoints);
    expect(hard.startingGearPoints).toBeLessThanOrEqual(normal.startingGearPoints);
    expect(nightmare.startingGearPoints).toBeLessThanOrEqual(hard.startingGearPoints);
    expect(hard.companionDiscretionaryGearSlots).toBeLessThanOrEqual(normal.companionDiscretionaryGearSlots);
    expect(nightmare.companionDiscretionaryGearSlots).toBeLessThanOrEqual(hard.companionDiscretionaryGearSlots);
  });

  it("keeps Normal's companion discretionary-slot count at 2 — the full authored kit, no regression from D-193 Plan 2.2", () => {
    expect(getDifficultyDefinition("normal").companionDiscretionaryGearSlots).toBe(2);
  });
});

describe("partySizeScalingFactor", () => {
  it("returns exactly 1x at the balanced party size (4)", () => {
    expect(partySizeScalingFactor(BALANCED_PARTY_SIZE)).toBe(1);
  });

  it("scales down linearly for a smaller party", () => {
    expect(partySizeScalingFactor(2)).toBe(0.5);
    expect(partySizeScalingFactor(1)).toBe(0.25);
  });
});
