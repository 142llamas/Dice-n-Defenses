import type { Hero } from "../entities/Hero";

/**
 * ProgressionSystem: pure "level-up choices" rules for Phase 7. No Phaser.
 *
 * The Source of Truth's §9 "Level cadence" item is OPEN ("every wave or slower
 * after balance testing?"); this system answers it with a DEFAULT (not LOCKED)
 * choice — a level-up every LEVEL_UP_WAVE_INTERVAL completed waves — chosen so
 * a ten-wave campaign offers a handful of meaningful choices (waves 2, 4, 6, 8,
 * 10) without a full XP-per-kill economy. BattleScene calls
 * `hasPendingLevelUp` right after awarding a wave's reward and, if true, shows
 * the two choices and calls `applyChoice` with whichever the player picks —
 * the RULE (what each choice does, and that it applies once per threshold)
 * lives here; the scene only renders the prompt.
 *
 * "Multiple viable strategies" (the phase's acceptance criterion): Vigor leans
 * into surviving hits, Might leans into ending fights faster — a real choice,
 * not a strictly-better option, since neither is free.
 *
 * Phase 13.3 (D-089): this Vigor/Might choice now applies ONLY to the classic
 * fixed roster. A D&D-built party (every hero has `classId`) advances a real
 * class level on this same wave-clear cadence instead — `BattleScene` calls
 * `acknowledgeLevelUp()` rather than `applyChoice()` for that case; see
 * `BattleScene.isClassBasedParty`/`applyClassLevelUps`.
 */

export const LEVEL_UP_WAVE_INTERVAL = 2;

export type LevelUpOptionId = "vigor" | "might";

export interface LevelUpOption {
  id: LevelUpOptionId;
  name: string;
  description: string;
}

export const LEVEL_UP_OPTIONS: LevelUpOption[] = [
  {
    id: "vigor",
    name: "Vigor",
    description: "+3 max HP to every living hero (and heals them for it).",
  },
  {
    id: "might",
    name: "Might",
    description: "+1 basic-attack damage to every living hero.",
  },
];

const VIGOR_AMOUNT = 3;
const MIGHT_AMOUNT = 1;

export class ProgressionSystem {
  private levelsGranted = 0;

  /** How many level-ups have been granted so far. */
  get levelsSoFar(): number {
    return this.levelsGranted;
  }

  /**
   * True once `wavesCleared` has crossed a new LEVEL_UP_WAVE_INTERVAL
   * threshold that hasn't been granted yet. Pure arithmetic — call this right
   * after a wave clears; if true, present the choice before moving on.
   */
  hasPendingLevelUp(wavesCleared: number): boolean {
    const earned = Math.floor(wavesCleared / LEVEL_UP_WAVE_INTERVAL);
    return earned > this.levelsGranted;
  }

  /**
   * Apply the chosen option to every hero passed in (the scene passes only
   * LIVING heroes — a fallen hero gets nothing retroactively) and mark this
   * threshold as granted, so `hasPendingLevelUp` won't fire again until the
   * next one.
   */
  applyChoice(optionId: LevelUpOptionId, heroes: ReadonlyArray<Hero>): void {
    for (const hero of heroes) {
      if (optionId === "vigor") hero.grantVigor(VIGOR_AMOUNT);
      else if (optionId === "might") hero.grantMight(MIGHT_AMOUNT);
    }
    this.levelsGranted += 1;
  }

  /**
   * Phase 13.3 (D-089): mark this threshold's level-up as granted WITHOUT
   * applying a Vigor/Might choice — used for a D&D-built party, where each
   * hero levels itself via `Hero.levelUpClass()` instead (there's no flat
   * choice to make; ASI is deferred to 13.6). Keeps `hasPendingLevelUp`
   * firing exactly once per threshold either way.
   */
  acknowledgeLevelUp(): void {
    this.levelsGranted += 1;
  }
}
