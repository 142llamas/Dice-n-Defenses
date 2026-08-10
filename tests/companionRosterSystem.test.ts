import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPANION_ROSTER_STATE,
  MAX_ACTIVE_COMPANIONS,
  activateCompanion,
  benchCompanion,
  isCompanionActive,
  isCompanionBenched,
  isCompanionLost,
  isCompanionRecruited,
  loadCompanionRoster,
  loseCompanion,
  recruitCompanion,
  saveCompanionRoster,
  type CompanionRosterState,
  type CompanionRosterStorage,
} from "../src/game/systems/CompanionRosterSystem";

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
});
