import type { Hero } from "../entities/Hero";

/**
 * RestSystem: Phase 13.4 (D-088) — a per-run, difficulty-tuned pool of Short
 * and Long Rest charges. Pure, no Phaser.
 *
 * Resolves 13.2's (D-087) "once per BATTLE" placeholder for Second Wind/
 * Action Surge with the SRD's real once-per-REST cadence: those two
 * resources now only recharge when `Hero.shortRest`/`longRest` actually
 * runs, which only happens through this class.
 *
 * `BattleScene` offers a rest choice between waves (opt-in — see
 * `afterWaveCleared`/`showRestChoice`), calling `takeShortRest`/
 * `takeLongRest` with the currently-living heroes. This class only tracks
 * the remaining charge counts and rejects a rest with none left; the actual
 * per-hero effects live on `Hero` (`shortRest`/`longRest`), the same
 * division of responsibility `ProgressionSystem.applyChoice` already uses
 * for level-up choices.
 */

export interface RestOptions {
  shortRestCharges: number;
  longRestCharges: number;
}

export class RestSystem {
  private shortRemaining: number;
  private longRemaining: number;

  constructor(options: RestOptions) {
    this.shortRemaining = options.shortRestCharges;
    this.longRemaining = options.longRestCharges;
  }

  get shortRestsRemaining(): number {
    return this.shortRemaining;
  }

  get longRestsRemaining(): number {
    return this.longRemaining;
  }

  canTakeShortRest(): boolean {
    return this.shortRemaining > 0;
  }

  canTakeLongRest(): boolean {
    return this.longRemaining > 0;
  }

  /** Spends one Short Rest charge and rests every hero passed in. No-op (returns false) if none remain. */
  takeShortRest(heroes: ReadonlyArray<Hero>): boolean {
    if (!this.canTakeShortRest()) return false;
    this.shortRemaining -= 1;
    for (const hero of heroes) hero.shortRest();
    return true;
  }

  /** Spends one Long Rest charge and rests every hero passed in. No-op (returns false) if none remain. */
  takeLongRest(heroes: ReadonlyArray<Hero>): boolean {
    if (!this.canTakeLongRest()) return false;
    this.longRemaining -= 1;
    for (const hero of heroes) hero.longRest();
    return true;
  }
}
