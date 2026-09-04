import { describe, it, expect } from "vitest";
import { decideSlotPairPlacement, decideHandsPlacement } from "../src/game/systems/GearFilterSystem";

describe("decideSlotPairPlacement", () => {
  it("auto-places into slotA when both are empty", () => {
    expect(decideSlotPairPlacement(null, null, "general1", "general2")).toEqual({
      kind: "autoPlace",
      slot: "general1",
    });
  });

  it("auto-places into slotB when only slotA is occupied", () => {
    expect(decideSlotPairPlacement("potion-healing", null, "general1", "general2")).toEqual({
      kind: "autoPlace",
      slot: "general2",
    });
  });

  it("auto-places into slotA when only slotB is occupied", () => {
    expect(decideSlotPairPlacement(null, "potion-healing", "general1", "general2")).toEqual({
      kind: "autoPlace",
      slot: "general1",
    });
  });

  it("requires compare-and-replace when both are occupied", () => {
    expect(decideSlotPairPlacement("potion-healing", "potion-mana", "general1", "general2")).toEqual({
      kind: "compareAndReplace",
    });
  });

  it("works generically for the ring pair too", () => {
    expect(decideSlotPairPlacement("ring-of-protection", null, "ring1", "ring2")).toEqual({
      kind: "autoPlace",
      slot: "ring2",
    });
  });
});

describe("decideHandsPlacement", () => {
  it("a real shield only ever candidates for the shield slot", () => {
    expect(decideHandsPlacement("shield", null, null)).toEqual({ kind: "autoPlace", slot: "shield" });
    expect(decideHandsPlacement("shield", "dagger", "shield")).toEqual({
      kind: "compareAndReplace",
      candidateSlots: ["shield"],
    });
  });

  it("a two-handed weapon only ever candidates for the weapon slot", () => {
    expect(decideHandsPlacement("greatsword", null, null)).toEqual({ kind: "autoPlace", slot: "weapon" });
    expect(decideHandsPlacement("greatsword", "dagger", null)).toEqual({
      kind: "compareAndReplace",
      candidateSlots: ["weapon"],
    });
  });

  it("a light melee weapon candidates for either hand, preferring weapon when both are empty", () => {
    expect(decideHandsPlacement("dagger", null, null)).toEqual({ kind: "autoPlace", slot: "weapon" });
  });

  it("a light melee weapon auto-places into whichever hand is actually empty", () => {
    expect(decideHandsPlacement("dagger", "greatsword", null)).toEqual({ kind: "autoPlace", slot: "shield" });
    expect(decideHandsPlacement("dagger", null, "shield")).toEqual({ kind: "autoPlace", slot: "weapon" });
  });

  it("a light melee weapon needs a replace choice once both hands are full", () => {
    expect(decideHandsPlacement("dagger", "shortsword", "shield")).toEqual({
      kind: "compareAndReplace",
      candidateSlots: ["weapon", "shield"],
    });
  });
});
