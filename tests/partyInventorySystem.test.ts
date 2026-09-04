import { describe, expect, it } from "vitest";
import {
  dropPoolEntriesForLostCompanion,
  resolvePartyInventory,
  unequipAllBenchedGear,
  visibleGearForOrigin,
} from "../src/game/systems/PartyInventorySystem";
import {
  DEFAULT_COMPANION_ROSTER_STATE,
  getPartyInventory,
  setPartyInventory,
  type CompanionRosterState,
  type PartyInventoryEntry,
} from "../src/game/systems/CompanionRosterSystem";
import type { GearSlotId } from "../src/game/data/equipment";

function entry(overrides: Partial<PartyInventoryEntry> = {}): PartyInventoryEntry {
  return { id: "pool-1", itemId: "longsword", originCompanionId: "hollis", originSlot: "weapon", ...overrides };
}

/** A simple deterministic id generator for tests — mirrors what a real caller (a counter, or Date.now()+random) would supply. */
function idCounter(prefix = "pool"): () => string {
  let n = 0;
  return () => `${prefix}-${n++}`;
}

const HOLLIS_KIT: Partial<Record<GearSlotId, string>> = { weapon: "longsword", chest: "chain-shirt", shield: "shield" };
const FENNA_KIT: Partial<Record<GearSlotId, string>> = { weapon: "quarterstaff", chest: "hide-armor", shield: "druidic-totem" };

function kitFor(kits: Record<string, Partial<Record<GearSlotId, string>>>): (id: string) => Partial<Record<GearSlotId, string>> {
  return (id) => kits[id] ?? {};
}

/**
 * Party Creation Overhaul Plan 2.3 — the shared XCOM2-style party inventory
 * pool. Pure/storage-agnostic, same convention as `CompanionRosterSystem`
 * itself: these tests operate on plain `CompanionRosterState` values, no
 * storage mocking needed (see `companionRosterSystem.test.ts` for the
 * load/save round-trip and defensive-parsing coverage of the `partyInventory`
 * field this module reads/writes through).
 */
describe("PartyInventorySystem", () => {
  describe("unequipAllBenchedGear", () => {
    it("moves a benched companion's full kit into the pool, one entry per populated slot", () => {
      const state = unequipAllBenchedGear(
        DEFAULT_COMPANION_ROSTER_STATE,
        ["hollis"],
        kitFor({ hollis: HOLLIS_KIT }),
        idCounter(),
      );
      const pool = getPartyInventory(state);
      expect(pool).toHaveLength(3);
      expect(pool).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: "longsword", originCompanionId: "hollis", originSlot: "weapon" }),
          expect.objectContaining({ itemId: "chain-shirt", originCompanionId: "hollis", originSlot: "chest" }),
          expect.objectContaining({ itemId: "shield", originCompanionId: "hollis", originSlot: "shield" }),
        ]),
      );
      expect(new Set(pool.map((e) => e.id)).size).toBe(3); // distinct synthetic ids
    });

    it("only affects the companion ids passed in, not every benched companion implicitly", () => {
      const state = unequipAllBenchedGear(
        DEFAULT_COMPANION_ROSTER_STATE,
        ["hollis"],
        kitFor({ hollis: HOLLIS_KIT, fenna: FENNA_KIT }),
        idCounter(),
      );
      expect(getPartyInventory(state).every((e) => e.originCompanionId === "hollis")).toBe(true);
    });

    it("is idempotent — calling it twice in a row with the same inputs produces no duplicate entries", () => {
      let state = unequipAllBenchedGear(DEFAULT_COMPANION_ROSTER_STATE, ["hollis"], kitFor({ hollis: HOLLIS_KIT }), idCounter());
      state = unequipAllBenchedGear(state, ["hollis"], kitFor({ hollis: HOLLIS_KIT }), idCounter());
      expect(getPartyInventory(state)).toHaveLength(3);
    });

    it("handles multiple benched companions in one call, each contributing their own entries", () => {
      const state = unequipAllBenchedGear(
        DEFAULT_COMPANION_ROSTER_STATE,
        ["hollis", "fenna"],
        kitFor({ hollis: HOLLIS_KIT, fenna: FENNA_KIT }),
        idCounter(),
      );
      expect(getPartyInventory(state)).toHaveLength(6);
    });

    it("skips a slot with no populated item, adding no entry for it", () => {
      const state = unequipAllBenchedGear(DEFAULT_COMPANION_ROSTER_STATE, ["hollis"], kitFor({ hollis: { weapon: "dagger" } }), idCounter());
      expect(getPartyInventory(state)).toEqual([{ id: "pool-0", itemId: "dagger", originCompanionId: "hollis", originSlot: "weapon" }]);
    });
  });

  describe("visibleGearForOrigin", () => {
    it("hides exactly the pooled slot(s), leaves every other slot untouched", () => {
      const partyInventory = [entry({ originSlot: "weapon" })];
      const visible = visibleGearForOrigin("hollis", HOLLIS_KIT, partyInventory);
      expect(visible).toEqual({ chest: "chain-shirt", shield: "shield" });
    });

    it("returns the kit unchanged for a companion with nothing pooled", () => {
      expect(visibleGearForOrigin("fenna", FENNA_KIT, [entry({ originCompanionId: "hollis" })])).toEqual(FENNA_KIT);
    });

    it("only strips entries crediting THIS companion as origin, not another companion's identically-slotted entry", () => {
      const partyInventory = [entry({ originCompanionId: "someone-else", originSlot: "weapon" })];
      expect(visibleGearForOrigin("hollis", HOLLIS_KIT, partyInventory)).toEqual(HOLLIS_KIT);
    });
  });

  describe("resolvePartyInventory", () => {
    it("clears the entire pool", () => {
      const state = setPartyInventory(DEFAULT_COMPANION_ROSTER_STATE, [entry(), entry({ id: "pool-2", originSlot: "chest" })]);
      expect(getPartyInventory(resolvePartyInventory(state))).toEqual([]);
    });

    it("an unclaimed entry's auto-return needs no write-back — the origin's kit shows the item again the moment it's resolved", () => {
      let state: CompanionRosterState = unequipAllBenchedGear(
        DEFAULT_COMPANION_ROSTER_STATE,
        ["hollis"],
        kitFor({ hollis: HOLLIS_KIT }),
        idCounter(),
      );
      expect(visibleGearForOrigin("hollis", HOLLIS_KIT, getPartyInventory(state))).toEqual({});
      state = resolvePartyInventory(state);
      expect(visibleGearForOrigin("hollis", HOLLIS_KIT, getPartyInventory(state))).toEqual(HOLLIS_KIT);
    });

    it("is a no-op on an already-empty pool", () => {
      expect(getPartyInventory(resolvePartyInventory(DEFAULT_COMPANION_ROSTER_STATE))).toEqual([]);
    });
  });

  describe("dropPoolEntriesForLostCompanion", () => {
    it("removes only the lost companion's entries, leaving other origins' entries intact", () => {
      const state = setPartyInventory(DEFAULT_COMPANION_ROSTER_STATE, [
        entry({ id: "pool-1", originCompanionId: "hollis" }),
        entry({ id: "pool-2", originCompanionId: "fenna" }),
      ]);
      const next = dropPoolEntriesForLostCompanion(state, "hollis");
      expect(getPartyInventory(next)).toEqual([entry({ id: "pool-2", originCompanionId: "fenna" })]);
    });

    it("is a no-op when the companion has no pool entries", () => {
      const state = setPartyInventory(DEFAULT_COMPANION_ROSTER_STATE, [entry({ originCompanionId: "fenna" })]);
      expect(getPartyInventory(dropPoolEntriesForLostCompanion(state, "hollis"))).toEqual(getPartyInventory(state));
    });
  });

  it("does not mutate the state object passed in", () => {
    const original = setPartyInventory(DEFAULT_COMPANION_ROSTER_STATE, [entry()]);
    const snapshot = { ...original, partyInventory: [...(original.partyInventory ?? [])] };
    unequipAllBenchedGear(original, ["fenna"], kitFor({ fenna: FENNA_KIT }), idCounter());
    resolvePartyInventory(original);
    dropPoolEntriesForLostCompanion(original, "hollis");
    expect(original).toEqual(snapshot);
  });
});
