import { describe, it, expect } from "vitest";
import { RewardSystem } from "../src/game/systems/RewardSystem";
import type { WaveDefinition } from "../src/game/data/waves";

/**
 * Phase 5 reward tests. These cover the "wave reward and optional turn-limit
 * bonus" scope item independently of the specific balance numbers in waves.ts:
 * completion gold is always granted; the time bonus is granted only when the
 * wave defines a turnLimit and was cleared on or before it.
 */

const bearer = (rewardGold: number, treasureBonusGold?: number) => ({ def: { rewardGold, treasureBonusGold } });

describe("RewardSystem kill gold", () => {
  it("sums the reward gold of defeated enemies", () => {
    expect(RewardSystem.killGold([bearer(3), bearer(2), bearer(3)])).toBe(8);
  });

  it("is zero for no defeats", () => {
    expect(RewardSystem.killGold([])).toBe(0);
  });

  // Phase 20 (D-111): treasure-laden enemies.
  it("adds a treasure-laden enemy's bonus gold on top of its ordinary reward", () => {
    expect(RewardSystem.killGold([bearer(4, 10)])).toBe(14);
  });

  it("mixes treasure-laden and ordinary enemies correctly", () => {
    expect(RewardSystem.killGold([bearer(4, 10), bearer(3), bearer(3, 14)])).toBe(34);
  });
});

describe("RewardSystem wave reward", () => {
  const wave: WaveDefinition = {
    id: "w",
    turnLimit: 5,
    spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }],
    completionGold: 10,
    timeBonusGold: 4,
  };

  it("grants the time bonus when cleared within the turn limit", () => {
    const r = RewardSystem.waveReward(wave, 5); // exactly on the limit
    expect(r.withinTurnLimit).toBe(true);
    expect(r.completionGold).toBe(10);
    expect(r.timeBonusGold).toBe(4);
    expect(r.total).toBe(14);
  });

  it("omits the time bonus when cleared after the turn limit", () => {
    const r = RewardSystem.waveReward(wave, 6);
    expect(r.withinTurnLimit).toBe(false);
    expect(r.timeBonusGold).toBe(0);
    expect(r.total).toBe(10); // completion gold only
  });

  it("never grants a bonus when the wave has no turn limit", () => {
    const noLimit: WaveDefinition = { ...wave, turnLimit: undefined };
    const r = RewardSystem.waveReward(noLimit, 1);
    expect(r.withinTurnLimit).toBe(false);
    expect(r.timeBonusGold).toBe(0);
    expect(r.total).toBe(10);
  });
});
