import { describe, it, expect } from "vitest";
import { EconomySystem, SOLO_ECONOMY_OWNER, sellValueForCost } from "../src/game/systems/EconomySystem";

/**
 * Phase 5 economy tests. These back the acceptance criterion "purchases update
 * gold once": a spend deducts exactly the cost and only when affordable; an
 * unaffordable spend changes nothing; awards and refunds add gold back.
 *
 * D-208 ("co-op economy"): every method now takes the pool's owner id.
 * `SOLO_ECONOMY_OWNER` stands in for "the only pool" in every test below that
 * isn't specifically about having more than one pool.
 */

const SOLO = SOLO_ECONOMY_OWNER;

describe("EconomySystem spending", () => {
  it("starts with the given gold", () => {
    expect(new EconomySystem({ [SOLO]: 20 }).gold(SOLO)).toBe(20);
  });

  it("deducts the cost exactly once on an affordable purchase", () => {
    const econ = new EconomySystem({ [SOLO]: 20 });
    const r = econ.spend(SOLO, 5);
    expect(r.ok).toBe(true);
    expect(r.goldBefore).toBe(20);
    expect(r.goldAfter).toBe(15);
    expect(econ.gold(SOLO)).toBe(15); // and not 10 — a single deduction
  });

  it("rejects a purchase it cannot afford and changes nothing", () => {
    const econ = new EconomySystem({ [SOLO]: 3 });
    const r = econ.spend(SOLO, 5);
    expect(r.ok).toBe(false);
    expect(econ.gold(SOLO)).toBe(3);
  });

  it("allows spending down to exactly zero but never below", () => {
    const econ = new EconomySystem({ [SOLO]: 8 });
    expect(econ.spend(SOLO, 8).ok).toBe(true);
    expect(econ.gold(SOLO)).toBe(0);
    expect(econ.spend(SOLO, 1).ok).toBe(false);
    expect(econ.gold(SOLO)).toBe(0);
  });

  it("reports affordability", () => {
    const econ = new EconomySystem({ [SOLO]: 5 });
    expect(econ.canAfford(SOLO, 5)).toBe(true);
    expect(econ.canAfford(SOLO, 6)).toBe(false);
  });
});

describe("EconomySystem awards and refunds", () => {
  it("adds award gold to the balance", () => {
    const econ = new EconomySystem({ [SOLO]: 0 });
    expect(econ.award(SOLO, 10)).toBe(10);
    expect(econ.award(SOLO, 5)).toBe(15);
  });

  it("refunds a removed structure's full cost", () => {
    const econ = new EconomySystem({ [SOLO]: 20 });
    econ.spend(SOLO, 8); // buy a trap -> 12
    expect(econ.gold(SOLO)).toBe(12);
    econ.refund(SOLO, 8); // remove it -> back to 20
    expect(econ.gold(SOLO)).toBe(20);
  });

  it("rejects negative amounts loudly", () => {
    const econ = new EconomySystem({ [SOLO]: 10 });
    expect(() => econ.spend(SOLO, -1)).toThrow();
    expect(() => econ.award(SOLO, -1)).toThrow();
    expect(() => econ.refund(SOLO, -1)).toThrow();
    expect(() => new EconomySystem({ [SOLO]: -1 })).toThrow();
  });

  it("rejects an empty pool map loudly", () => {
    expect(() => new EconomySystem({})).toThrow();
  });
});

// Phase 21 (D-112), Gold Thief: an enemy attack forcibly removes gold — NOT
// gated by affordability like `spend` (a theft still "lands" even against an
// empty purse; there's simply nothing left to take).

describe("EconomySystem.deduct (Phase 21, D-112, Gold Thief)", () => {
  it("removes the full amount when the party can cover it", () => {
    const econ = new EconomySystem({ [SOLO]: 20 });
    expect(econ.deduct(SOLO, 8)).toBe(8);
    expect(econ.gold(SOLO)).toBe(12);
  });

  it("floors at 0 instead of going negative, returning only what was actually removed", () => {
    const econ = new EconomySystem({ [SOLO]: 5 });
    expect(econ.deduct(SOLO, 20)).toBe(5);
    expect(econ.gold(SOLO)).toBe(0);
  });

  it("is a no-op (returns 0) against an already-empty purse", () => {
    const econ = new EconomySystem({ [SOLO]: 0 });
    expect(econ.deduct(SOLO, 10)).toBe(0);
    expect(econ.gold(SOLO)).toBe(0);
  });

  it("rejects a negative amount loudly", () => {
    const econ = new EconomySystem({ [SOLO]: 10 });
    expect(() => econ.deduct(SOLO, -1)).toThrow();
  });
});

// D-209 (The Armory): selling gear/a potion — outright, or as the auto
// trade-in on a purchase into an occupied slot — pays half of cost, rounded
// down. Distinct from `refund` (always full cost, for a reward/build reason).

describe("sellValueForCost (D-209, The Armory)", () => {
  it("halves an even cost", () => {
    expect(sellValueForCost(10)).toBe(5);
  });

  it("rounds down on an odd cost", () => {
    expect(sellValueForCost(11)).toBe(5);
  });

  it("floors a cost of 1 to 0, rather than a fractional sell value", () => {
    expect(sellValueForCost(1)).toBe(0);
  });

  it("returns 0 for a free item", () => {
    expect(sellValueForCost(0)).toBe(0);
  });

  it("never returns a negative value", () => {
    expect(sellValueForCost(-10)).toBe(0);
  });
});

// D-208: co-op's "fully separate per-player pools" choice — each participant
// uid gets its own independent balance, unaffected by the other's spending.

describe("EconomySystem multi-pool (D-208, co-op economy)", () => {
  it("keeps each owner's pool independent", () => {
    const econ = new EconomySystem({ hostUid: 50, guestUid: 30 });
    econ.spend("hostUid", 20);
    econ.award("guestUid", 10);
    expect(econ.gold("hostUid")).toBe(30);
    expect(econ.gold("guestUid")).toBe(40);
  });

  it("throws on an unrecognized owner id, rather than silently creating a pool", () => {
    const econ = new EconomySystem({ [SOLO]: 10 });
    expect(() => econ.gold("nobody")).toThrow();
    expect(() => econ.award("nobody", 5)).toThrow();
  });

  it("lists every owner id and every pool's balance", () => {
    const econ = new EconomySystem({ hostUid: 50, guestUid: 30 });
    expect(econ.ownerIds().sort()).toEqual(["guestUid", "hostUid"]);
    expect(econ.goldByOwner()).toEqual({ hostUid: 50, guestUid: 30 });
  });
});
