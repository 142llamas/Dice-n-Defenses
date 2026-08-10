import { describe, it, expect } from "vitest";
import { ProgressionSystem, LEVEL_UP_WAVE_INTERVAL } from "../src/game/systems/ProgressionSystem";

/**
 * Phase 7 "level-up cadence" tests. ProgressionSystem is pure arithmetic over
 * "waves cleared"; BattleScene calls `hasPendingLevelUp` after a wave reward
 * and, if true, advances every living hero's real class level
 * (`Hero.levelUpClass`) before calling `acknowledgeLevelUp`.
 */

describe("ProgressionSystem cadence", () => {
  it("has no pending level-up before the first threshold", () => {
    const p = new ProgressionSystem();
    for (let w = 0; w < LEVEL_UP_WAVE_INTERVAL; w++) {
      expect(p.hasPendingLevelUp(w)).toBe(false);
    }
  });

  it("becomes pending exactly at each interval, once per threshold", () => {
    const p = new ProgressionSystem();
    expect(p.hasPendingLevelUp(LEVEL_UP_WAVE_INTERVAL)).toBe(true);
    p.acknowledgeLevelUp();
    expect(p.levelsSoFar).toBe(1);
    // Not pending again until the NEXT threshold.
    expect(p.hasPendingLevelUp(LEVEL_UP_WAVE_INTERVAL)).toBe(false);
    expect(p.hasPendingLevelUp(LEVEL_UP_WAVE_INTERVAL * 2 - 1)).toBe(false);
    expect(p.hasPendingLevelUp(LEVEL_UP_WAVE_INTERVAL * 2)).toBe(true);
  });
});
