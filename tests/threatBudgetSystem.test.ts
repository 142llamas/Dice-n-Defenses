import { describe, it, expect } from "vitest";
import { applyThreatBudget } from "../src/game/systems/ThreatBudgetSystem";
import { RandomService } from "../src/game/systems/RandomService";
import type { DifficultyDefinition } from "../src/game/data/difficulty";
import type { WaveDefinition } from "../src/game/data/waves";

/** D-217 (item 3b): ThreatBudgetSystem — pure per-wave difficulty transform. */

function makeTier(overrides: Partial<DifficultyDefinition> = {}): DifficultyDefinition {
  return {
    id: "normal",
    name: "Normal",
    enemyCountMultiplier: 1,
    enemyHpMultiplier: 1,
    shortRestCharges: 3,
    longRestCharges: 1,
    startingGearPoints: 9,
    companionDiscretionaryGearSlots: 2,
    eliteFraction: 0,
    eliteFractionCap: 0,
    eliteStatMultiplier: { hp: 1, damage: 1 },
    extraLaneChance: 0,
    maxSimultaneousLanes: 1,
    cadenceMultiplier: 1,
    ...overrides,
  };
}

const baseWave: WaveDefinition = {
  id: "w",
  spawns: [{ enemyId: "grunt", count: 4, startTurn: 1, intervalTurns: 2 }],
  completionGold: 0,
};

describe("applyThreatBudget", () => {
  it("with a fully-neutral tier, behaves as a no-op (counts/intervals unchanged, no elite split)", () => {
    const result = applyThreatBudget(baseWave, makeTier(), RandomService.fixed(99), 1);
    expect(result.spawns).toEqual([{ enemyId: "grunt", count: 4, startTurn: 1, intervalTurns: 2 }]);
  });

  it("bakes enemyCountMultiplier into each group's count, rounded, minimum 1", () => {
    const result = applyThreatBudget(baseWave, makeTier({ enemyCountMultiplier: 1.5 }), RandomService.fixed(99), 1);
    expect(result.spawns[0].count).toBe(6); // 4 * 1.5

    const tiny: WaveDefinition = { id: "w", spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 };
    const shrunk = applyThreatBudget(tiny, makeTier({ enemyCountMultiplier: 0.1 }), RandomService.fixed(99), 1);
    expect(shrunk.spawns[0].count).toBe(1); // never scales to zero
  });

  it("splits a group into regular + elite sub-groups per eliteFraction, capped by eliteFractionCap", () => {
    const tier = makeTier({ eliteFraction: 0.5, eliteFractionCap: 0.5, eliteStatMultiplier: { hp: 1.4, damage: 1.2 } });
    const result = applyThreatBudget(baseWave, tier, RandomService.fixed(99), 1);
    expect(result.spawns).toHaveLength(2);
    const [regular, elite] = result.spawns;
    expect(regular.count).toBe(2);
    expect(regular.statMultiplier).toBeUndefined();
    expect(elite.count).toBe(2);
    expect(elite.statMultiplier).toEqual({ hp: 1.4, damage: 1.2 });
    expect(regular.count + elite.count).toBe(4);
  });

  it("never converts a group's last regular unit, even at a 100% elite fraction", () => {
    const small: WaveDefinition = { id: "w", spawns: [{ enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 0 };
    const tier = makeTier({ eliteFraction: 1, eliteFractionCap: 1 });
    const result = applyThreatBudget(small, tier, RandomService.fixed(99), 1);
    const regular = result.spawns.find((g) => g.statMultiplier === undefined);
    expect(regular?.count).toBeGreaterThanOrEqual(1);
  });

  it("never elite-splits a group of exactly 1 (would need to convert the only unit)", () => {
    const single: WaveDefinition = { id: "w", spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 };
    const tier = makeTier({ eliteFraction: 1, eliteFractionCap: 1 });
    const result = applyThreatBudget(single, tier, RandomService.fixed(99), 1);
    expect(result.spawns).toHaveLength(1);
    expect(result.spawns[0].statMultiplier).toBeUndefined();
  });

  it("never elite-splits the boss's own group", () => {
    const bossWave: WaveDefinition = {
      id: "w",
      spawns: [{ enemyId: "cinderlord", count: 4, startTurn: 1, intervalTurns: 1 }],
      completionGold: 0,
    };
    const tier = makeTier({ eliteFraction: 1, eliteFractionCap: 1 });
    const result = applyThreatBudget(bossWave, tier, RandomService.fixed(99), 1, "cinderlord");
    expect(result.spawns).toHaveLength(1);
    expect(result.spawns[0].statMultiplier).toBeUndefined();
    expect(result.spawns[0].count).toBe(4);
  });

  it("multiplies intervalTurns by cadenceMultiplier, floored at 1 turn", () => {
    const fasterResult = applyThreatBudget(baseWave, makeTier({ cadenceMultiplier: 0.5 }), RandomService.fixed(99), 1);
    expect(fasterResult.spawns[0].intervalTurns).toBe(1); // round(2 * 0.5) = 1

    const zeroed: WaveDefinition = { id: "w", spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 };
    const flooredResult = applyThreatBudget(zeroed, makeTier({ cadenceMultiplier: 0.1 }), RandomService.fixed(99), 1);
    expect(flooredResult.spawns[0].intervalTurns).toBeGreaterThanOrEqual(1);

    expect(baseWave.spawns[0].intervalTurns).toBe(2); // original wave untouched
  });

  it("never touches startTurn or turnLimit regardless of cadenceMultiplier", () => {
    const wave: WaveDefinition = { id: "w", turnLimit: 10, spawns: [{ enemyId: "grunt", count: 1, startTurn: 3, intervalTurns: 1 }], completionGold: 0 };
    const result = applyThreatBudget(wave, makeTier({ cadenceMultiplier: 0.2 }), RandomService.fixed(99), 1);
    expect(result.turnLimit).toBe(10);
    expect(result.spawns[0].startTurn).toBe(3);
  });

  it("adds no extra lane when spawnPointCount is 1, even at 100% extraLaneChance", () => {
    const tier = makeTier({ extraLaneChance: 1, maxSimultaneousLanes: 3 });
    const result = applyThreatBudget(baseWave, tier, RandomService.fixed(0), 1);
    expect(result.spawns).toHaveLength(1);
  });

  it("adds an extra lane duplicating a small non-boss group onto a spare spawn point, when the roll favors it", () => {
    const wave: WaveDefinition = {
      id: "w",
      spawns: [
        { enemyId: "grunt", count: 4, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
        { enemyId: "cinderlord", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
      ],
      completionGold: 0,
    };
    const tier = makeTier({ extraLaneChance: 1, maxSimultaneousLanes: 2 });
    const result = applyThreatBudget(wave, tier, RandomService.fixed(0), 2, "cinderlord");
    const extraLane = result.spawns.find((g) => g.spawnIndex === 1);
    expect(extraLane).toBeDefined();
    expect(extraLane?.enemyId).toBe("grunt"); // the boss is never a duplication candidate
  });

  it("respects maxSimultaneousLanes — no extra lane once the cap is already met", () => {
    const wave: WaveDefinition = {
      id: "w",
      spawns: [{ enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1, spawnIndex: 0 }],
      completionGold: 0,
    };
    const tier = makeTier({ extraLaneChance: 1, maxSimultaneousLanes: 1 });
    const result = applyThreatBudget(wave, tier, RandomService.fixed(0), 3);
    expect(result.spawns.every((g) => (g.spawnIndex ?? 0) === 0)).toBe(true);
  });

  it("does not mutate the original WaveDefinition", () => {
    const before = JSON.parse(JSON.stringify(baseWave));
    applyThreatBudget(baseWave, makeTier({ enemyCountMultiplier: 2, eliteFraction: 0.5, eliteFractionCap: 0.5, cadenceMultiplier: 0.5 }), RandomService.fixed(0), 2);
    expect(baseWave).toEqual(before);
  });
});
