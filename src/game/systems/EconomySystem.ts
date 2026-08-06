/**
 * EconomySystem: the party's gold balance. Pure, no Phaser.
 *
 * This is the single authority for how much gold the party has, following the
 * Source of Truth's "single authoritative game state" rule: nothing else keeps
 * its own copy of the number. The scene reads `gold` to render it and calls
 * `spend` / `award` / `refund`, each of which mutates the balance EXACTLY ONCE,
 * which is what makes the Phase 5 acceptance criterion "purchases update gold
 * once" easy to guarantee — the scene performs one `spend` per successful
 * purchase and none on a rejected one.
 *
 * Gold sources (Phase 5): defeated enemies (their rewardGold), wave completion,
 * and an optional turn-limit time bonus. Gold sinks: buying a wall or a trap.
 * Removing a structure refunds its full cost.
 */

/** The outcome of attempting to spend gold. */
export interface SpendResult {
  /** True if the balance covered the cost and gold was deducted. */
  ok: boolean;
  amount: number;
  goldBefore: number;
  goldAfter: number;
}

export class EconomySystem {
  private goldValue: number;

  constructor(startingGold: number) {
    if (startingGold < 0) throw new Error("Starting gold cannot be negative.");
    this.goldValue = Math.floor(startingGold);
  }

  /** Current gold on hand. */
  get gold(): number {
    return this.goldValue;
  }

  /** True if the party can currently afford `cost` gold. */
  canAfford(cost: number): boolean {
    return this.goldValue >= cost;
  }

  /**
   * Spend `cost` gold. Deducts and reports success ONLY if the party can afford
   * it; otherwise nothing changes and `ok` is false. Never lets gold go
   * negative, so a purchase can never be applied "half-way".
   */
  spend(cost: number): SpendResult {
    const goldBefore = this.goldValue;
    if (cost < 0) throw new Error("Cannot spend a negative amount.");
    if (!this.canAfford(cost)) {
      return { ok: false, amount: cost, goldBefore, goldAfter: goldBefore };
    }
    this.goldValue = goldBefore - cost;
    return { ok: true, amount: cost, goldBefore, goldAfter: this.goldValue };
  }

  /** Add `amount` gold (a kill reward, wave reward, or time bonus). */
  award(amount: number): number {
    if (amount < 0) throw new Error("Cannot award a negative amount.");
    this.goldValue += Math.floor(amount);
    return this.goldValue;
  }

  /** Give back `amount` gold (refund a removed structure's full cost). */
  refund(amount: number): number {
    if (amount < 0) throw new Error("Cannot refund a negative amount.");
    this.goldValue += Math.floor(amount);
    return this.goldValue;
  }

  /**
   * Phase 21 (D-112): forcibly remove `amount` gold (a Gold Thief enemy's
   * attack), floored at 0. Deliberately NOT gated by `canAfford` like `spend`
   * — an enemy theft isn't a purchase the party can decline, and a party at 0
   * gold should still "lose" the attempted amount (nothing to steal, but the
   * attack still landed) rather than the theft silently failing. Returns the
   * amount actually removed (may be less than `amount` if the party couldn't
   * cover it).
   */
  deduct(amount: number): number {
    if (amount < 0) throw new Error("Cannot deduct a negative amount.");
    const removed = Math.min(this.goldValue, Math.floor(amount));
    this.goldValue -= removed;
    return removed;
  }
}
