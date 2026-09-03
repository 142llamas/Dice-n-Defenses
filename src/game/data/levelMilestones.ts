import type { LevelMilestone, LevelMilestoneTrack } from "../systems/LevelMilestoneSystem";

/**
 * Free Play's Run Length presets — D-217 (item 3a). Separates run length
 * from difficulty (see `data/difficulty.ts`'s own D-217 addendum): every
 * Free Play run starts at level 1, the player independently picks Run
 * Length (which sets BOTH the wave count and the level cap) and Difficulty
 * (which no longer touches level at all). `waveCount` matches the existing
 * Short/Medium/Long presets `FreePlayScene` already offered before this
 * redesign (4/7/10) — only the level-cap concept and the milestone track
 * that reaches it are new.
 */
export type RunLengthId = "quick" | "short" | "medium" | "long";

export interface RunLengthDefinition {
  id: RunLengthId;
  label: string;
  waveCount: number;
  levelCap: number;
}

export const RUN_LENGTH_IDS: RunLengthId[] = ["quick", "short", "medium", "long"];

export const RUN_LENGTH_DEFINITIONS: Record<RunLengthId, RunLengthDefinition> = {
  // Kevin's own ask: an even faster option than Short, 1→5 — the shortest
  // possible shape a Run Length can take (one ramp wave, then the finale
  // fought entirely at the cap), same "first-pass/untuned" caveat as every
  // other Run Length's own wave count.
  quick: { id: "quick", label: "Quick", waveCount: 2, levelCap: 5 },
  short: { id: "short", label: "Short", waveCount: 4, levelCap: 10 },
  medium: { id: "medium", label: "Medium", waveCount: 7, levelCap: 15 },
  long: { id: "long", label: "Long", waveCount: 10, levelCap: 20 },
};

export function getRunLengthDefinition(id: RunLengthId): RunLengthDefinition {
  return RUN_LENGTH_DEFINITIONS[id];
}

/**
 * Distributes `levelCap - startingLevel` level-ups as evenly as possible
 * across waves `1..(waveCount - 1)` — deliberately leaving the LAST wave
 * (the boss finale) with no milestone of its own, so the party reaches the
 * full level cap after clearing the second-to-last wave and fights one full
 * regular wave at that cap before the boss (Kevin's own explicit ask: "give
 * the player one regular wave at the final level before the boss so newly
 * unlocked abilities can be used before the boss encounter"). Consecutive
 * waves that would imply the same level (rounding can produce these when
 * the level span doesn't divide evenly) collapse into a single milestone at
 * the later wave, so the track never carries a redundant no-op entry.
 *
 * `startingLevel` defaults to 1 for Free Play (every run starts at level 1);
 * `data/campaigns.ts`'s `chapterLevelMilestones` reuses this SAME function
 * with a chapter's own `levelRange` (e.g. `[6, 10]`) instead, so both Free
 * Play and Campaign derive their default ramp from one shared generator.
 *
 * Pure and deterministic — same "wave count + level cap in, milestone track
 * out" shape as `FreePlayWaveGenerator.generateFreePlayWaves`, which this is
 * a sibling to (that function shapes ENEMIES per wave; this shapes WHEN
 * levels land — two independent concerns over the same `waveCount`).
 */
export function generateLevelMilestones(waveCount: number, levelCap: number, startingLevel = 1): LevelMilestoneTrack {
  if (levelCap <= startingLevel) return [];
  const rampWaves = Math.max(0, waveCount - 1);
  const span = levelCap - startingLevel;
  if (rampWaves === 0) {
    // No room to ramp before the (only) wave — go straight to the cap.
    return [{ afterWave: 0, level: levelCap }];
  }
  const milestones: LevelMilestone[] = [];
  let lastLevel = startingLevel;
  for (let wave = 1; wave <= rampWaves; wave++) {
    const level = startingLevel + Math.round((span * wave) / rampWaves);
    if (level > lastLevel) {
      milestones.push({ afterWave: wave, level });
      lastLevel = level;
    }
  }
  return milestones;
}

/** Convenience: the milestone track for a Free Play Run Length preset. */
export function levelMilestonesForRunLength(id: RunLengthId): LevelMilestoneTrack {
  const def = getRunLengthDefinition(id);
  return generateLevelMilestones(def.waveCount, def.levelCap);
}
