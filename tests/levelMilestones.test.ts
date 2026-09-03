import { describe, it, expect } from "vitest";
import {
  RUN_LENGTH_IDS,
  RUN_LENGTH_DEFINITIONS,
  getRunLengthDefinition,
  generateLevelMilestones,
  levelMilestonesForRunLength,
} from "../src/game/data/levelMilestones";
import { LevelMilestoneSystem } from "../src/game/systems/LevelMilestoneSystem";

describe("Run Length presets", () => {
  it("defines Quick/Short/Medium/Long with the existing wave counts and Kevin's own level caps", () => {
    expect(RUN_LENGTH_IDS).toEqual(["quick", "short", "medium", "long"]);
    expect(getRunLengthDefinition("quick")).toMatchObject({ waveCount: 2, levelCap: 5 });
    expect(getRunLengthDefinition("short")).toMatchObject({ waveCount: 4, levelCap: 10 });
    expect(getRunLengthDefinition("medium")).toMatchObject({ waveCount: 7, levelCap: 15 });
    expect(getRunLengthDefinition("long")).toMatchObject({ waveCount: 10, levelCap: 20 });
  });

  it("strictly increases both wave count and level cap from Quick to Long", () => {
    const [q, s, m, l] = ["quick", "short", "medium", "long"] as const;
    expect(RUN_LENGTH_DEFINITIONS[s].waveCount).toBeGreaterThan(RUN_LENGTH_DEFINITIONS[q].waveCount);
    expect(RUN_LENGTH_DEFINITIONS[m].waveCount).toBeGreaterThan(RUN_LENGTH_DEFINITIONS[s].waveCount);
    expect(RUN_LENGTH_DEFINITIONS[l].waveCount).toBeGreaterThan(RUN_LENGTH_DEFINITIONS[m].waveCount);
    expect(RUN_LENGTH_DEFINITIONS[s].levelCap).toBeGreaterThan(RUN_LENGTH_DEFINITIONS[q].levelCap);
    expect(RUN_LENGTH_DEFINITIONS[m].levelCap).toBeGreaterThan(RUN_LENGTH_DEFINITIONS[s].levelCap);
    expect(RUN_LENGTH_DEFINITIONS[l].levelCap).toBeGreaterThan(RUN_LENGTH_DEFINITIONS[m].levelCap);
  });
});

describe("generateLevelMilestones", () => {
  it("reaches exactly the level cap after the second-to-last wave, leaving the finale wave with no milestone of its own", () => {
    for (const id of RUN_LENGTH_IDS) {
      const { waveCount, levelCap } = getRunLengthDefinition(id);
      const track = generateLevelMilestones(waveCount, levelCap);
      const last = track[track.length - 1];
      expect(last.afterWave).toBe(waveCount - 1);
      expect(last.level).toBe(levelCap);
      expect(track.every((m) => m.afterWave < waveCount)).toBe(true);
    }
  });

  it("never regresses — every milestone's level strictly increases with afterWave", () => {
    const track = generateLevelMilestones(10, 20);
    for (let i = 1; i < track.length; i++) {
      expect(track[i].level).toBeGreaterThan(track[i - 1].level);
      expect(track[i].afterWave).toBeGreaterThan(track[i - 1].afterWave);
    }
  });

  it("drives a LevelMilestoneSystem from level 1 to exactly the cap by the second-to-last wave, for every Run Length", () => {
    for (const id of RUN_LENGTH_IDS) {
      const { waveCount, levelCap } = getRunLengthDefinition(id);
      const sys = new LevelMilestoneSystem(levelMilestonesForRunLength(id), 1);
      for (let wave = 1; wave <= waveCount - 1; wave++) {
        if (sys.hasPendingLevelUp(wave)) sys.acknowledgeLevelUp(wave);
      }
      expect(sys.currentLevel).toBe(levelCap);
      // The finale wave (waveCount) itself grants nothing further.
      expect(sys.hasPendingLevelUp(waveCount)).toBe(false);
    }
  });

  it("degenerates to an immediate jump to the cap when there's no room to ramp (a single-wave run)", () => {
    const track = generateLevelMilestones(1, 10);
    expect(track).toEqual([{ afterWave: 0, level: 10 }]);
  });

  it("returns an empty track for a level cap of 1 (no level-ups possible)", () => {
    expect(generateLevelMilestones(4, 1)).toEqual([]);
  });
});
