import type { WaveDefinition } from "../data/waves";

/**
 * RewardSystem: pure gold-reward arithmetic. No Phaser, no state.
 *
 * The Source of Truth carries the economy fields in data already (enemies have
 * `rewardGold`; waves have `completionGold` and an optional `timeBonusGold`),
 * so this system just turns game events into gold amounts. Keeping it separate
 * and static makes the "gold rewards increase across the campaign, with a bonus
 * for completing a round within a turn limit" rule testable in isolation, apart
 * from the EconomySystem that actually holds the balance.
 */

/** A minimal shape for anything that awards gold when defeated. */
export interface GoldBearer {
  readonly def: {
    readonly rewardGold: number;
    /** Phase 20 (D-111): extra gold a "treasure-laden" enemy drops on top of `rewardGold`. */
    readonly treasureBonusGold?: number;
  };
}

/** The gold a completed wave grants, split so the UI can show the breakdown. */
export interface WaveReward {
  completionGold: number;
  /** The time bonus actually earned (0 when not earned or not offered). */
  timeBonusGold: number;
  /** True if the wave was cleared within its turn limit (if it had one). */
  withinTurnLimit: boolean;
  total: number;
}

export class RewardSystem {
  /**
   * Total kill gold for a set of defeated enemies — `rewardGold` plus any
   * `treasureBonusGold` (Phase 20, D-111), summed. A breach never calls this
   * (breaching enemies are removed by `WaveSystem` without going through
   * `removeDefeated`), so the bonus really is "the party kills it," never
   * "it slips past."
   */
  static killGold(defeated: ReadonlyArray<GoldBearer>): number {
    return defeated.reduce((sum, e) => sum + e.def.rewardGold + (e.def.treasureBonusGold ?? 0), 0);
  }

  /**
   * The reward for completing `wave` on enemy-phase `completionTurn` (1-based).
   * Always grants `completionGold`. Grants `timeBonusGold` only when the wave
   * defines a `turnLimit` AND the wave was cleared on or before that turn — the
   * "optional turn-limit bonus". A wave with no `turnLimit` never grants a
   * bonus (there is nothing to beat), so withinTurnLimit is false.
   */
  static waveReward(wave: WaveDefinition, completionTurn: number): WaveReward {
    const completionGold = wave.completionGold;
    const hasLimit = typeof wave.turnLimit === "number";
    const withinTurnLimit = hasLimit && completionTurn <= (wave.turnLimit as number);
    const timeBonusGold = withinTurnLimit ? wave.timeBonusGold ?? 0 : 0;
    return {
      completionGold,
      timeBonusGold,
      withinTurnLimit,
      total: completionGold + timeBonusGold,
    };
  }
}
