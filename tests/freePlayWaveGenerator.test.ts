import { describe, it, expect } from "vitest";
import { generateFreePlayWaves } from "../src/game/systems/FreePlayWaveGenerator";

/**
 * Phase 11.9 (D-071) — free-play mode's deterministic wave generator. Same
 * spirit as campaigns.test.ts's spec: unique ids, only-real-ids-in-pool,
 * finale carries the boss, and (new here) determinism across repeated calls.
 */

const STANDARD_POOL = ["grunt", "runner", "wisp", "brute", "swarmling", "warden", "razorwing"];

describe("generateFreePlayWaves", () => {
  it("produces exactly N WaveDefinitions with unique ids", () => {
    const waves = generateFreePlayWaves({
      waveCount: 7,
      minionPool: STANDARD_POOL,
      bossEnemyId: "cinderlord",
    });
    expect(waves.length).toBe(7);
    const ids = waves.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every non-finale wave only uses ids from minionPool", () => {
    const waves = generateFreePlayWaves({
      waveCount: 10,
      minionPool: STANDARD_POOL,
      bossEnemyId: "tidelord",
    });
    for (const wave of waves.slice(0, -1)) {
      for (const group of wave.spawns) {
        expect(STANDARD_POOL).toContain(group.enemyId);
      }
    }
  });

  it("the finale wave includes exactly one bossEnemyId entry", () => {
    const waves = generateFreePlayWaves({
      waveCount: 4,
      minionPool: STANDARD_POOL,
      bossEnemyId: "basalt-colossus",
    });
    const finale = waves[waves.length - 1];
    const bossGroups = finale.spawns.filter((g) => g.enemyId === "basalt-colossus");
    expect(bossGroups.length).toBe(1);
    expect(bossGroups[0].count).toBe(1);

    // The boss should not appear in any earlier wave.
    for (const wave of waves.slice(0, -1)) {
      expect(wave.spawns.some((g) => g.enemyId === "basalt-colossus")).toBe(false);
    }
  });

  it("the finale wave also mixes in escort enemies from the pool alongside the boss", () => {
    const waves = generateFreePlayWaves({
      waveCount: 4,
      minionPool: STANDARD_POOL,
      bossEnemyId: "cinderlord",
    });
    const finale = waves[waves.length - 1];
    const escortGroups = finale.spawns.filter((g) => g.enemyId !== "cinderlord");
    expect(escortGroups.length).toBeGreaterThanOrEqual(2);
    expect(escortGroups.length).toBeLessThanOrEqual(3);
    for (const group of escortGroups) {
      expect(STANDARD_POOL).toContain(group.enemyId);
    }
  });

  it("calling it twice with the same options produces identical output (determinism)", () => {
    const options = { waveCount: 7, minionPool: STANDARD_POOL, bossEnemyId: "tidelord" };
    const first = generateFreePlayWaves(options);
    const second = generateFreePlayWaves(options);
    expect(first).toEqual(second);
  });

  it("a minionPool of length 1 doesn't crash", () => {
    expect(() =>
      generateFreePlayWaves({ waveCount: 4, minionPool: ["grunt"], bossEnemyId: "cinderlord" }),
    ).not.toThrow();
    const waves = generateFreePlayWaves({
      waveCount: 4,
      minionPool: ["grunt"],
      bossEnemyId: "cinderlord",
    });
    expect(waves.length).toBe(4);
    for (const wave of waves.slice(0, -1)) {
      for (const group of wave.spawns) {
        expect(group.enemyId).toBe("grunt");
      }
    }
    const finale = waves[waves.length - 1];
    expect(finale.spawns.some((g) => g.enemyId === "cinderlord")).toBe(true);
  });

  it("every wave has a positive enemy count, turnLimit, and completionGold", () => {
    const waves = generateFreePlayWaves({
      waveCount: 10,
      minionPool: STANDARD_POOL,
      bossEnemyId: "tidelord",
    });
    for (const wave of waves) {
      expect(wave.turnLimit).toBeGreaterThan(0);
      expect(wave.completionGold).toBeGreaterThan(0);
      for (const group of wave.spawns) {
        expect(group.count).toBeGreaterThan(0);
        expect(group.startTurn).toBeGreaterThanOrEqual(1);
        expect(group.intervalTurns).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
