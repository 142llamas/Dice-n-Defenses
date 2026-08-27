import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPANION_ROSTER_STATE,
  MAX_ACTIVE_COMPANIONS,
  activateCompanion,
  benchCompanion,
  getCompanionBuild,
  getPartyInventory,
  getPcBuild,
  isCompanionActive,
  isCompanionBenched,
  isCompanionLost,
  isCompanionRecruited,
  loadCompanionRoster,
  loseCompanion,
  recruitCompanion,
  saveCompanionRoster,
  setCompanionBuild,
  setPartyInventory,
  setPcBuild,
  type CompanionRosterState,
  type CompanionRosterStorage,
  type PartyInventoryEntry,
} from "../src/game/systems/CompanionRosterSystem";
import type { CharacterBuild } from "../src/game/systems/CharacterBuildSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): CompanionRosterStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function fullActiveState(): CompanionRosterState {
  let state = DEFAULT_COMPANION_ROSTER_STATE;
  state = recruitCompanion(state, "hollis");
  state = recruitCompanion(state, "fenna");
  state = recruitCompanion(state, "isolde");
  return state;
}

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    controlledBy: "human",
    ...overrides,
  };
}

/**
 * D-118 — engine scaffolding for CAMPAIGN_STORY_DESIGN.md §6's companion
 * catalogue: active (in the 3-slot bench)/benched (recruited, not active)/
 * lost (permanently removed) roster tracking. Operates purely on id
 * strings — the actual six-companion catalogue is a separate, not-yet-done
 * content pass (see data/companions.ts).
 */
describe("CompanionRosterSystem", () => {
  it("MAX_ACTIVE_COMPANIONS is 3 (1 PC + 3 = the existing fixed party size of 4)", () => {
    expect(MAX_ACTIVE_COMPANIONS).toBe(3);
  });

  it("recruiting fills an active slot while one is free", () => {
    const state = fullActiveState();
    expect(state.activeIds).toEqual(["hollis", "fenna", "isolde"]);
    expect(state.benchedIds).toEqual([]);
    expect(isCompanionActive(state, "hollis")).toBe(true);
  });

  it("recruiting past the active cap benches instead", () => {
    const full = fullActiveState();
    const state = recruitCompanion(full, "tamsin");
    expect(isCompanionActive(state, "tamsin")).toBe(false);
    expect(isCompanionBenched(state, "tamsin")).toBe(true);
    expect(isCompanionRecruited(state, "tamsin")).toBe(true);
  });

  it("recruiting an already-recruited companion is a same-reference no-op", () => {
    const state = recruitCompanion(DEFAULT_COMPANION_ROSTER_STATE, "hollis");
    const again = recruitCompanion(state, "hollis");
    expect(again).toBe(state);
  });

  it("recruiting a permanently-lost companion throws", () => {
    let state = recruitCompanion(DEFAULT_COMPANION_ROSTER_STATE, "sorrel");
    state = loseCompanion(state, "sorrel");
    expect(() => recruitCompanion(state, "sorrel")).toThrow();
  });

  it("benching an active companion moves them to the bench, freeing a slot", () => {
    const full = fullActiveState();
    const state = benchCompanion(full, "hollis");
    expect(isCompanionActive(state, "hollis")).toBe(false);
    expect(isCompanionBenched(state, "hollis")).toBe(true);
    expect(state.activeIds.length).toBe(2);
  });

  it("benching a companion who isn't active throws", () => {
    expect(() => benchCompanion(DEFAULT_COMPANION_ROSTER_STATE, "nobody")).toThrow();
  });

  it("benching an already-benched companion is a same-reference no-op", () => {
    let state = recruitCompanion(fullActiveState(), "tamsin");
    const again = benchCompanion(state, "tamsin");
    expect(again).toBe(state);
  });

  it("activating a benched companion moves them into a freed active slot", () => {
    let state = recruitCompanion(fullActiveState(), "tamsin"); // benched (roster full)
    state = benchCompanion(state, "hollis"); // frees a slot
    state = activateCompanion(state, "tamsin");
    expect(isCompanionActive(state, "tamsin")).toBe(true);
    expect(isCompanionBenched(state, "hollis")).toBe(true);
    expect(state.activeIds.length).toBe(3);
  });

  it("activating into a full active roster throws (caller must bench someone first)", () => {
    let state = recruitCompanion(fullActiveState(), "tamsin"); // benched
    expect(() => activateCompanion(state, "tamsin")).toThrow();
  });

  it("activating a companion who was never recruited throws", () => {
    expect(() => activateCompanion(DEFAULT_COMPANION_ROSTER_STATE, "nobody")).toThrow();
  });

  it("activating an already-active companion is a same-reference no-op", () => {
    const state = fullActiveState();
    const again = activateCompanion(state, "hollis");
    expect(again).toBe(state);
  });

  it("losing a companion removes them from active/benched permanently", () => {
    const full = fullActiveState();
    const state = loseCompanion(full, "fenna");
    expect(isCompanionActive(state, "fenna")).toBe(false);
    expect(isCompanionBenched(state, "fenna")).toBe(false);
    expect(isCompanionLost(state, "fenna")).toBe(true);
    expect(state.activeIds.length).toBe(2);
  });

  it("losing an already-lost companion is a same-reference no-op", () => {
    let state = loseCompanion(fullActiveState(), "fenna");
    const again = loseCompanion(state, "fenna");
    expect(again).toBe(state);
  });

  it("a lost companion can never be re-recruited, benched, or activated", () => {
    const state = loseCompanion(fullActiveState(), "fenna");
    expect(() => recruitCompanion(state, "fenna")).toThrow();
    expect(() => benchCompanion(state, "fenna")).toThrow();
    expect(() => activateCompanion(state, "fenna")).toThrow();
  });

  it("does not mutate the state object passed in", () => {
    const original = fullActiveState();
    const snapshot = { ...original, activeIds: [...original.activeIds] };
    benchCompanion(original, "hollis");
    expect(original).toEqual(snapshot);
  });

  it("loadCompanionRoster returns the default state when nothing is stored", () => {
    expect(loadCompanionRoster(fakeStorage(), "k")).toEqual(DEFAULT_COMPANION_ROSTER_STATE);
  });

  it("loadCompanionRoster returns the default state on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadCompanionRoster(storage, "k")).toEqual(DEFAULT_COMPANION_ROSTER_STATE);
  });

  it("saveCompanionRoster then loadCompanionRoster round-trips", () => {
    const storage = fakeStorage();
    let state = fullActiveState();
    state = recruitCompanion(state, "tamsin");
    state = loseCompanion(state, "dorian");
    saveCompanionRoster(storage, "k", state);
    expect(loadCompanionRoster(storage, "k")).toEqual(state);
  });

  it("losing a companion preserves companionBuilds/pcBuild (Plan 3.1 — loseCompanion used to drop unlisted fields)", () => {
    let state = setPcBuild(fullActiveState(), build({ id: "pc" }));
    state = setCompanionBuild(state, "hollis", build({ id: "hollis-build" }));
    state = loseCompanion(state, "fenna");
    expect(getPcBuild(state)?.id).toBe("pc");
    expect(getCompanionBuild(state, "hollis")?.id).toBe("hollis-build");
  });
});

/** Party Creation Overhaul Plan 3.1: persisted mutable builds per companion/PC. */
describe("CompanionRosterSystem — persisted builds (Plan 3.1)", () => {
  it("getCompanionBuild/getPcBuild are undefined on the default state", () => {
    expect(getCompanionBuild(DEFAULT_COMPANION_ROSTER_STATE, "hollis")).toBeUndefined();
    expect(getPcBuild(DEFAULT_COMPANION_ROSTER_STATE)).toBeUndefined();
  });

  it("setCompanionBuild/getCompanionBuild round-trip without clobbering roster lists or other companions", () => {
    let state = fullActiveState();
    state = setCompanionBuild(state, "hollis", build({ id: "hollis-build", name: "Hollis" }));
    expect(getCompanionBuild(state, "hollis")?.name).toBe("Hollis");
    expect(getCompanionBuild(state, "fenna")).toBeUndefined();
    expect(state.activeIds).toEqual(["hollis", "fenna", "isolde"]);
  });

  it("setCompanionBuild overwrites a prior copy for the same companion", () => {
    let state = setCompanionBuild(DEFAULT_COMPANION_ROSTER_STATE, "hollis", build({ name: "First" }));
    state = setCompanionBuild(state, "hollis", build({ name: "Second" }));
    expect(getCompanionBuild(state, "hollis")?.name).toBe("Second");
  });

  it("setPcBuild/getPcBuild round-trip, independent of companionBuilds", () => {
    let state = setCompanionBuild(DEFAULT_COMPANION_ROSTER_STATE, "hollis", build({ id: "hollis-build" }));
    state = setPcBuild(state, build({ id: "pc-build", name: "Player" }));
    expect(getPcBuild(state)?.name).toBe("Player");
    expect(getCompanionBuild(state, "hollis")?.id).toBe("hollis-build");
  });

  it("loadCompanionRoster/saveCompanionRoster round-trip includes companionBuilds and pcBuild", () => {
    const storage = fakeStorage();
    let state = setCompanionBuild(DEFAULT_COMPANION_ROSTER_STATE, "hollis", build({ id: "hollis-build" }));
    state = setPcBuild(state, build({ id: "pc-build" }));
    saveCompanionRoster(storage, "k", state);
    const loaded = loadCompanionRoster(storage, "k");
    expect(loaded.companionBuilds).toEqual({ hollis: build({ id: "hollis-build" }) });
    expect(loaded.pcBuild).toEqual(build({ id: "pc-build" }));
  });

  it("loadCompanionRoster drops a malformed companionBuilds entry but keeps the rest", () => {
    const storage = fakeStorage();
    storage.setItem(
      "k",
      JSON.stringify({
        ...DEFAULT_COMPANION_ROSTER_STATE,
        companionBuilds: { hollis: build({ id: "ok" }), fenna: { junk: true } },
      }),
    );
    const loaded = loadCompanionRoster(storage, "k");
    expect(getCompanionBuild(loaded, "hollis")?.id).toBe("ok");
    expect(getCompanionBuild(loaded, "fenna")).toBeUndefined();
  });

  it("loadCompanionRoster falls back to undefined for a malformed pcBuild rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ ...DEFAULT_COMPANION_ROSTER_STATE, pcBuild: "not a build" }));
    expect(getPcBuild(loadCompanionRoster(storage, "k"))).toBeUndefined();
  });

  it("a pre-Plan-3 blob (no companionBuilds/pcBuild keys at all) loads both as undefined, everything else intact — proves no migration is needed", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ activeIds: ["hollis"], benchedIds: ["fenna"], lostIds: ["sorrel"] }));
    const loaded = loadCompanionRoster(storage, "k");
    expect(loaded.companionBuilds).toBeUndefined();
    expect(loaded.pcBuild).toBeUndefined();
    expect(loaded.activeIds).toEqual(["hollis"]);
    expect(loaded.benchedIds).toEqual(["fenna"]);
    expect(loaded.lostIds).toEqual(["sorrel"]);
  });
});

/** Party Creation Overhaul Plan 2.3: the shared party inventory pool. */
describe("CompanionRosterSystem — party inventory (Plan 2.3)", () => {
  function entry(overrides: Partial<PartyInventoryEntry> = {}): PartyInventoryEntry {
    return { id: "pool-1", itemId: "longsword", originCompanionId: "hollis", originSlot: "weapon", ...overrides };
  }

  it("getPartyInventory is empty on the default state", () => {
    expect(getPartyInventory(DEFAULT_COMPANION_ROSTER_STATE)).toEqual([]);
  });

  it("setPartyInventory/getPartyInventory round-trip without clobbering roster lists or builds", () => {
    let state = setPcBuild(fullActiveState(), build({ id: "pc" }));
    state = setPartyInventory(state, [entry()]);
    expect(getPartyInventory(state)).toEqual([entry()]);
    expect(getPcBuild(state)?.id).toBe("pc");
    expect(state.activeIds).toEqual(["hollis", "fenna", "isolde"]);
  });

  it("setPartyInventory with an empty array stores undefined, matching the field's own absent-means-empty convention", () => {
    const state = setPartyInventory(DEFAULT_COMPANION_ROSTER_STATE, [entry()]);
    const cleared = setPartyInventory(state, []);
    expect(cleared.partyInventory).toBeUndefined();
    expect(getPartyInventory(cleared)).toEqual([]);
  });

  it("loadCompanionRoster/saveCompanionRoster round-trip includes partyInventory", () => {
    const storage = fakeStorage();
    const state = setPartyInventory(DEFAULT_COMPANION_ROSTER_STATE, [entry(), entry({ id: "pool-2", itemId: "chain-shirt", originSlot: "chest" })]);
    saveCompanionRoster(storage, "k", state);
    expect(getPartyInventory(loadCompanionRoster(storage, "k"))).toEqual(getPartyInventory(state));
  });

  it("loadCompanionRoster drops a malformed partyInventory entry but keeps well-formed ones", () => {
    const storage = fakeStorage();
    storage.setItem(
      "k",
      JSON.stringify({ ...DEFAULT_COMPANION_ROSTER_STATE, partyInventory: [entry(), { junk: true }, { id: "pool-3" }] }),
    );
    expect(getPartyInventory(loadCompanionRoster(storage, "k"))).toEqual([entry()]);
  });

  it("loadCompanionRoster falls back to empty for a non-array partyInventory rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ ...DEFAULT_COMPANION_ROSTER_STATE, partyInventory: "not an array" }));
    expect(getPartyInventory(loadCompanionRoster(storage, "k"))).toEqual([]);
  });

  it("a pre-Plan-2.3 blob (no partyInventory key at all) loads as empty — proves no migration is needed", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ activeIds: ["hollis"], benchedIds: [], lostIds: [] }));
    expect(getPartyInventory(loadCompanionRoster(storage, "k"))).toEqual([]);
  });

  it("DEFAULT_COMPANION_ROSTER_STATE has no partyInventory (Reset Campaign Progress wipes the pool for free)", () => {
    expect(DEFAULT_COMPANION_ROSTER_STATE.partyInventory).toBeUndefined();
  });
});
