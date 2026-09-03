/**
 * LevelMilestoneSystem — D-217 (item 3a): pure level-up CADENCE tracking for
 * Free Play and Campaign, superseding `ProgressionSystem`'s D-174-locked
 * "1 level per hero per wave, uniform across every mode" for those two modes
 * specifically. Co-op, Test Mode, and the campaign-less classic "Create
 * Party" path are explicitly OUT of scope — nothing in this redesign touches
 * them, and they keep using `ProgressionSystem` exactly as before.
 *
 * Unlike `ProgressionSystem` (which only ever grants exactly one level per
 * threshold), a single milestone here can imply a jump of several levels at
 * once — Free Play's Short run (4 waves, level cap 10) needs 9 level-ups
 * spread across only 3 non-finale waves, so `BattleScene.applyClassLevelUps`
 * loops `hero.levelUpClass()` until `hero.level` reaches `currentLevel`
 * rather than calling it exactly once per wave-clear event.
 *
 * A `LevelMilestoneTrack` is plain data (`data/levelMilestones.ts` for Free
 * Play's Run Length presets, `ChapterDefinition.levelMilestones` in
 * `data/campaigns.ts` for Campaign) — this class only interprets it.
 * Applying a milestone is monotonic (`currentLevel` never decreases even if
 * a lower/duplicate milestone is looked up again), which is what makes
 * re-entering an earlier campaign chapter after already being higher-level
 * elsewhere a safe no-op rather than a downgrade.
 */

export interface LevelMilestone {
  /** Wave-clear count (1-based, the same "wavesCleared" counter `BattleScene` already tracks) after which the party should be AT `level`. */
  afterWave: number;
  level: number;
}

export type LevelMilestoneTrack = readonly LevelMilestone[];

export class LevelMilestoneSystem {
  private level: number;

  constructor(
    private readonly track: LevelMilestoneTrack,
    startingLevel: number,
  ) {
    this.level = startingLevel;
  }

  /** The highest level actually granted so far. */
  get currentLevel(): number {
    return this.level;
  }

  /**
   * The highest level implied by every milestone reached at or before
   * `wavesCleared`, or `null` if that's no higher than `currentLevel` (i.e.
   * nothing new to grant yet).
   */
  pendingTargetLevel(wavesCleared: number): number | null {
    let implied = this.level;
    for (const milestone of this.track) {
      if (milestone.afterWave <= wavesCleared && milestone.level > implied) {
        implied = milestone.level;
      }
    }
    return implied > this.level ? implied : null;
  }

  /** True once `wavesCleared` has crossed one or more milestones not yet granted. Pure arithmetic — call this right after a wave clears. */
  hasPendingLevelUp(wavesCleared: number): boolean {
    return this.pendingTargetLevel(wavesCleared) !== null;
  }

  /** Advances `currentLevel` to whatever `pendingTargetLevel(wavesCleared)` implies. A no-op if nothing is pending. */
  acknowledgeLevelUp(wavesCleared: number): void {
    const target = this.pendingTargetLevel(wavesCleared);
    if (target !== null) this.level = target;
  }
}
