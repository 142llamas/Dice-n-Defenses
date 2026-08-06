import { describe, it, expect } from "vitest";
import { EconomySystem } from "../src/game/systems/EconomySystem";

/**
 * Phase 5 economy tests. These back the acceptance criterion "purchases update
 * gold once": a spend deducts exactly the cost and only when affordable; an
 * unaffordable spend changes nothing; awards and refunds add gold back.
 */

describe("EconomySystem spending", () => {
  it("starts with the given gold", () => {
    expect(new EconomySystem(20).gold).toBe(20);
  });

  it("deducts the cost exactly once on an affordable purchase", () => {
    const econ = new EconomySystem(20);
    const r = econ.spend(5);
    expect(r.ok).toBe(true);
    expect(r.goldBefore).toBe(20);
    expect(r.goldAfter).toBe(15);
    expect(econ.gold).toBe(15); // and not 10 — a single deduction
  });

  it("rejects a purchase it cannot afford and changes nothing", () => {
    const econ = new EconomySystem(3);
    const r = econ.spend(5);
    expect(r.ok).toBe(false);
    expect(econ.gold).toBe(3);
  });

  it("allows spending down to exactly zero but never below", () => {
    const econ = new EconomySystem(8);
    expect(econ.spend(8).ok).toBe(true);
    expect(econ.gold).toBe(0);
    expect(econ.spend(1).ok).toBe(false);
    expect(econ.gold).toBe(0);
  });

  it("reports affordability", () => {
    const econ = new EconomySystem(5);
    expect(econ.canAfford(5)).toBe(true);
    expect(econ.canAfford(6)).toBe(false);
  });
});

describe("EconomySystem awards and refunds", () => {
  it("adds award gold to the balance", () => {
    const econ = new EconomySystem(0);
    expect(econ.award(10)).toBe(10);
    expect(econ.award(5)).toBe(15);
  });

  it("refunds a removed structure's full cost", () => {
    const econ = new EconomySystem(20);
    econ.spend(8); // buy a trap -> 12
    expect(econ.gold).toBe(12);
    econ.refund(8); // remove it -> back to 20
    expect(econ.gold).toBe(20);
  });

  it("rejects negative amounts loudly", () => {
    const econ = new EconomySystem(10);
    expect(() => econ.spend(-1)).toThrow();
    expect(() => econ.award(-1)).toThrow();
    expect(() => econ.refund(-1)).toThrow();
    expect(() => new EconomySystem(-1)).toThrow();
  });
});

// Phase 21 (D-112), Gold Thief: an enemy attack forcibly removes gold — NOT
// gated by affordability like `spend` (a theft still "lands" even against an
// empty purse; there's simply nothing left to take).

describe("EconomySystem.deduct (Phase 21, D-112, Gold Thief)", () => {
  it("removes the full amount when the party can cover it", () => {
    const econ = new EconomySystem(20);
    expect(econ.deduct(8)).toBe(8);
    expect(econ.gold).toBe(12);
  });

  it("floors at 0 instead of going negative, returning only what was actually removed", () => {
    const econ = new EconomySystem(5);
    expect(econ.deduct(20)).toBe(5);
    expect(econ.gold).toBe(0);
  });

  it("is a no-op (returns 0) against an already-empty purse", () => {
    const econ = new EconomySystem(0);
    expect(econ.deduct(10)).toBe(0);
    expect(econ.gold).toBe(0);
  });

  it("rejects a negative amount loudly", () => {
    const econ = new EconomySystem(10);
    expect(() => econ.deduct(-1)).toThrow();
  });
});
