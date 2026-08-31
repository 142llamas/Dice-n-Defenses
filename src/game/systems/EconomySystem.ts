/**
 * EconomySystem: the party's gold balance(s). Pure, no Phaser.
 *
 * This is the single authority for how much gold the party has, following the
 * Source of Truth's "single authoritative game state" rule: nothing else keeps
 * its own copy of the number. The scene reads `gold(ownerId)` to render it and
 * calls `spend` / `award` / `refund`, each of which mutates exactly one pool
 * EXACTLY ONCE, which is what makes the Phase 5 acceptance criterion
 * "purchases update gold once" easy to guarantee — the scene performs one
 * `spend` per successful purchase and none on a rejected one.
 *
 * Gold sources (Phase 5): defeated enemies (their rewardGold), wave completion,
 * and an optional turn-limit time bonus. Gold sinks: buying a wall or a trap.
 * Removing a structure refunds its full cost.
 *
 * D-208 (Phase 4 of the 2026-08-28 playtest batch, "co-op economy"): gold is
 * now one or more independent pools, keyed by an arbitrary `ownerId` string,
 * instead of a single flat number. Solo play (and every campaign-only reward —
 * campaigns never run inside a coop session, see `CoopLobbyScene`) always
 * constructs exactly one pool, under `SOLO_ECONOMY_OWNER`; a coop session
 * constructs one pool per participant `uid`. Every method now takes the
 * `ownerId` it applies to, rather than defaulting to an implicit single pool —
 * a deliberate choice so a caller can never silently hit the wrong player's
 * gold: an unrecognized `ownerId` throws instead of quietly creating (or
 * misspending from) a pool nobody asked for. See `BattleScene.economyOwnerFor`
 * for how the scene decides which pool a given gold change belongs to.
 */

/** The pool id every non-coop battle (solo play, every campaign) uses — see this file's header comment. */
export const SOLO_ECONOMY_OWNER = "solo";

/**
 * D-209 (The Armory): selling gear/a potion back — either outright or as the
 * auto-trade-in on a purchase into an occupied slot — pays half its listed
 * cost, rounded down. This is a real economy rule (confirmed with Kevin,
 * not a guess), distinct from `refund`, which always pays back the FULL
 * cost for a reward/build-mode reason (removing a structure, an unequipped
 * item's old refund-on-toggle behavior this replaces, a loot drop nobody
 * had room for). Callers pass the result to `award`, not a dedicated
 * `EconomySystem` method — selling is "compute this number, then award it."
 */
export function sellValueForCost(cost: number): number {
  return Math.max(0, Math.floor(cost * 0.5));
}

/** The outcome of attempting to spend gold. */
export interface SpendResult {
  /** True if the balance covered the cost and gold was deducted. */
  ok: boolean;
  amount: number;
  goldBefore: number;
  goldAfter: number;
}

export class EconomySystem {
  private pools = new Map<string, number>();

  /** One pool per key in `startingGoldByOwner` — at least one is required. */
  constructor(startingGoldByOwner: Record<string, number>) {
    const entries = Object.entries(startingGoldByOwner);
    if (entries.length === 0) throw new Error("EconomySystem needs at least one gold pool.");
    for (const [ownerId, amount] of entries) {
      if (amount < 0) throw new Error("Starting gold cannot be negative.");
      this.pools.set(ownerId, Math.floor(amount));
    }
  }

  private balanceOf(ownerId: string): number {
    const balance = this.pools.get(ownerId);
    if (balance === undefined) throw new Error(`EconomySystem has no gold pool for owner "${ownerId}".`);
    return balance;
  }

  /** `ownerId`'s current gold on hand. */
  gold(ownerId: string): number {
    return this.balanceOf(ownerId);
  }

  /** Every owner id with a pool — e.g. to split an unattributable reward (a wave-completion bonus) evenly across everyone. */
  ownerIds(): string[] {
    return [...this.pools.keys()];
  }

  /** Every pool's current balance, keyed by owner id — for serialization (see `BattleStateSnapshot`). */
  goldByOwner(): Record<string, number> {
    return Object.fromEntries(this.pools);
  }

  /** True if `ownerId`'s pool currently covers `cost` gold. */
  canAfford(ownerId: string, cost: number): boolean {
    return this.balanceOf(ownerId) >= cost;
  }

  /**
   * Spend `cost` gold from `ownerId`'s pool. Deducts and reports success ONLY
   * if that pool covers it; otherwise nothing changes and `ok` is false.
   * Never lets a pool go negative, so a purchase can never be applied
   * "half-way".
   */
  spend(ownerId: string, cost: number): SpendResult {
    const goldBefore = this.balanceOf(ownerId);
    if (cost < 0) throw new Error("Cannot spend a negative amount.");
    if (goldBefore < cost) {
      return { ok: false, amount: cost, goldBefore, goldAfter: goldBefore };
    }
    const goldAfter = goldBefore - cost;
    this.pools.set(ownerId, goldAfter);
    return { ok: true, amount: cost, goldBefore, goldAfter };
  }

  /** Add `amount` gold to `ownerId`'s pool (a kill reward, wave reward, or time bonus). */
  award(ownerId: string, amount: number): number {
    if (amount < 0) throw new Error("Cannot award a negative amount.");
    const next = this.balanceOf(ownerId) + Math.floor(amount);
    this.pools.set(ownerId, next);
    return next;
  }

  /** Give back `amount` gold to `ownerId`'s pool (refund a removed structure's/unequipped item's full cost). */
  refund(ownerId: string, amount: number): number {
    if (amount < 0) throw new Error("Cannot refund a negative amount.");
    const next = this.balanceOf(ownerId) + Math.floor(amount);
    this.pools.set(ownerId, next);
    return next;
  }

  /**
   * Phase 21 (D-112): forcibly remove `amount` gold from `ownerId`'s pool (a
   * Gold Thief enemy's attack), floored at 0. Deliberately NOT gated by
   * `canAfford` like `spend` — an enemy theft isn't a purchase the party can
   * decline, and a pool at 0 gold should still "lose" the attempted amount
   * (nothing to steal, but the attack still landed) rather than the theft
   * silently failing. Returns the amount actually removed (may be less than
   * `amount` if the pool couldn't cover it).
   */
  deduct(ownerId: string, amount: number): number {
    if (amount < 0) throw new Error("Cannot deduct a negative amount.");
    const current = this.balanceOf(ownerId);
    const removed = Math.min(current, Math.floor(amount));
    this.pools.set(ownerId, current - removed);
    return removed;
  }
}
