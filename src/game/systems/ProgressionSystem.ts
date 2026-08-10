/**
 * ProgressionSystem: pure level-up CADENCE tracking. No Phaser.
 *
 * The Source of Truth's §9 "Level cadence" item is OPEN ("every wave or slower
 * after balance testing?"); this system answers it with a DEFAULT (not LOCKED)
 * choice — a level-up every LEVEL_UP_WAVE_INTERVAL completed waves — chosen so
 * a ten-wave campaign offers a handful of meaningful level-ups (waves 2, 4, 6,
 * 8, 10) without a full XP-per-kill economy.
 *
 * This used to also own a flat Vigor/Might level-up CHOICE for the original
 * classic fixed roster. That roster (and the choice) were removed once every
 * hero was built via the D&D-style character-creation system instead, which
 * advances a real class level on this same wave-clear cadence — `BattleScene`
 * calls `hasPendingLevelUp` right after awarding a wave's reward and, if true,
 * calls `acknowledgeLevelUp()` while it applies each hero's own
 * `Hero.levelUpClass()`. `Hero.grantVigor`/`grantMight` still exist — they're
 * also how a Vigor Tonic/other attack-buff potion works — just no longer
 * reachable via a level-up choice.
 */

export const LEVEL_UP_WAVE_INTERVAL = 2;

export class ProgressionSystem {
  private levelsGranted = 0;

  /** How many level-ups have been granted so far. */
  get levelsSoFar(): number {
    return this.levelsGranted;
  }

  /**
   * True once `wavesCleared` has crossed a new LEVEL_UP_WAVE_INTERVAL
   * threshold that hasn't been granted yet. Pure arithmetic — call this right
   * after a wave clears; if true, apply the level-up before moving on.
   */
  hasPendingLevelUp(wavesCleared: number): boolean {
    const earned = Math.floor(wavesCleared / LEVEL_UP_WAVE_INTERVAL);
    return earned > this.levelsGranted;
  }

  /** Mark this threshold's level-up as granted, so `hasPendingLevelUp` fires exactly once per threshold. */
  acknowledgeLevelUp(): void {
    this.levelsGranted += 1;
  }
}
