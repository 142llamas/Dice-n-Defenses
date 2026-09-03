import { describe, it, expect } from "vitest";
import { LevelMilestoneSystem, type LevelMilestoneTrack } from "../src/game/systems/LevelMilestoneSystem";

describe("LevelMilestoneSystem", () => {
  it("starts at the given starting level with nothing pending before any milestone is reached", () => {
    const track: LevelMilestoneTrack = [{ afterWave: 1, level: 3 }];
    const sys = new LevelMilestoneSystem(track, 1);
    expect(sys.currentLevel).toBe(1);
    expect(sys.hasPendingLevelUp(0)).toBe(false);
    expect(sys.pendingTargetLevel(0)).toBeNull();
  });

  it("reports a pending level-up once wavesCleared reaches a milestone", () => {
    const track: LevelMilestoneTrack = [{ afterWave: 1, level: 3 }];
    const sys = new LevelMilestoneSystem(track, 1);
    expect(sys.hasPendingLevelUp(1)).toBe(true);
    expect(sys.pendingTargetLevel(1)).toBe(3);
  });

  it("can jump multiple levels in a single milestone", () => {
    const track: LevelMilestoneTrack = [{ afterWave: 1, level: 7 }];
    const sys = new LevelMilestoneSystem(track, 1);
    sys.acknowledgeLevelUp(1);
    expect(sys.currentLevel).toBe(7);
  });

  it("only advances up to the highest milestone reached so far, not future ones", () => {
    const track: LevelMilestoneTrack = [
      { afterWave: 1, level: 3 },
      { afterWave: 3, level: 6 },
      { afterWave: 5, level: 10 },
    ];
    const sys = new LevelMilestoneSystem(track, 1);
    sys.acknowledgeLevelUp(2); // only wave 1's milestone reached
    expect(sys.currentLevel).toBe(3);
    sys.acknowledgeLevelUp(4); // now wave 3's milestone reached too
    expect(sys.currentLevel).toBe(6);
  });

  it("acknowledging with no new milestone reached is a no-op", () => {
    const track: LevelMilestoneTrack = [{ afterWave: 1, level: 3 }];
    const sys = new LevelMilestoneSystem(track, 1);
    sys.acknowledgeLevelUp(1);
    expect(sys.currentLevel).toBe(3);
    sys.acknowledgeLevelUp(1);
    expect(sys.currentLevel).toBe(3);
    expect(sys.hasPendingLevelUp(1)).toBe(false);
  });

  it("is monotonic — re-querying an earlier wave count never implies a downgrade", () => {
    const track: LevelMilestoneTrack = [
      { afterWave: 1, level: 3 },
      { afterWave: 5, level: 10 },
    ];
    const sys = new LevelMilestoneSystem(track, 1);
    sys.acknowledgeLevelUp(5); // jumps straight to 10
    expect(sys.currentLevel).toBe(10);
    // Re-entering at an earlier wave count (e.g. a lower campaign chapter)
    // must never imply going backward.
    expect(sys.pendingTargetLevel(1)).toBeNull();
    sys.acknowledgeLevelUp(1);
    expect(sys.currentLevel).toBe(10);
  });

  it("handles an out-of-order track the same as a sorted one", () => {
    const track: LevelMilestoneTrack = [
      { afterWave: 5, level: 10 },
      { afterWave: 1, level: 3 },
    ];
    const sys = new LevelMilestoneSystem(track, 1);
    expect(sys.pendingTargetLevel(1)).toBe(3);
    expect(sys.pendingTargetLevel(5)).toBe(10);
  });

  it("with an empty track (a side mission), never grants a level-up regardless of wavesCleared", () => {
    const sys = new LevelMilestoneSystem([], 5);
    expect(sys.hasPendingLevelUp(100)).toBe(false);
    expect(sys.currentLevel).toBe(5);
  });
});
