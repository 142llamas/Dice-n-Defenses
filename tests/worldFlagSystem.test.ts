import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_FLAG_STATE,
  clearWorldFlag,
  getWorldFlag,
  hasWorldFlag,
  loadWorldFlags,
  saveWorldFlags,
  setWorldFlag,
  type WorldFlagStorage,
} from "../src/game/systems/WorldFlagSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): WorldFlagStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/**
 * D-118 — engine scaffolding for CAMPAIGN_STORY_DESIGN.md's per-choice story
 * flags (e.g. which miniboss was spared, Sorrel Thane's branch outcome).
 * Same conventions as CampaignProgressSystem's own test suite.
 */
describe("WorldFlagSystem", () => {
  it("loadWorldFlags returns the default (empty) state when nothing is stored", () => {
    expect(loadWorldFlags(fakeStorage(), "k")).toEqual(DEFAULT_WORLD_FLAG_STATE);
  });

  it("loadWorldFlags returns the default state on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadWorldFlags(storage, "k")).toEqual(DEFAULT_WORLD_FLAG_STATE);
  });

  it("loadWorldFlags drops individually malformed entries instead of failing the whole load", () => {
    const storage = fakeStorage();
    storage.setItem(
      "k",
      JSON.stringify({ flags: { "sorrel-outcome": "lost", garbage: { nested: true } } }),
    );
    const state = loadWorldFlags(storage, "k");
    expect(getWorldFlag(state, "sorrel-outcome")).toBe("lost");
    expect(hasWorldFlag(state, "garbage")).toBe(false);
  });

  it("setWorldFlag supports boolean, string, and number values", () => {
    let state = setWorldFlag(DEFAULT_WORLD_FLAG_STATE, "spared-boss", true);
    state = setWorldFlag(state, "sorrel-outcome", "redeemed");
    state = setWorldFlag(state, "ending-lean", 3);
    expect(getWorldFlag(state, "spared-boss")).toBe(true);
    expect(getWorldFlag(state, "sorrel-outcome")).toBe("redeemed");
    expect(getWorldFlag(state, "ending-lean")).toBe(3);
  });

  it("setWorldFlag returns the same object reference when the value is unchanged (no-op)", () => {
    const once = setWorldFlag(DEFAULT_WORLD_FLAG_STATE, "spared-boss", true);
    const twice = setWorldFlag(once, "spared-boss", true);
    expect(twice).toBe(once);
  });

  it("setWorldFlag does not mutate the state object passed in", () => {
    const original = setWorldFlag(DEFAULT_WORLD_FLAG_STATE, "a", 1);
    const updated = setWorldFlag(original, "b", 2);
    expect(hasWorldFlag(original, "b")).toBe(false);
    expect(getWorldFlag(updated, "a")).toBe(1);
    expect(getWorldFlag(updated, "b")).toBe(2);
  });

  it("getWorldFlag returns undefined for a flag never set", () => {
    expect(getWorldFlag(DEFAULT_WORLD_FLAG_STATE, "never-set")).toBeUndefined();
    expect(hasWorldFlag(DEFAULT_WORLD_FLAG_STATE, "never-set")).toBe(false);
  });

  it("clearWorldFlag removes a flag, and is a same-reference no-op if it was already absent", () => {
    const withFlag = setWorldFlag(DEFAULT_WORLD_FLAG_STATE, "a", 1);
    const cleared = clearWorldFlag(withFlag, "a");
    expect(hasWorldFlag(cleared, "a")).toBe(false);

    const noop = clearWorldFlag(cleared, "a");
    expect(noop).toBe(cleared);
  });

  it("saveWorldFlags then loadWorldFlags round-trips", () => {
    const storage = fakeStorage();
    let state = setWorldFlag(DEFAULT_WORLD_FLAG_STATE, "spared-boss", "gravemaw");
    state = setWorldFlag(state, "held-on-count", 4);
    saveWorldFlags(storage, "k", state);
    const loaded = loadWorldFlags(storage, "k");
    expect(loaded).toEqual(state);
  });
});
