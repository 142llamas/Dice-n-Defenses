import { describe, expect, it } from "vitest";
import {
  DEFAULT_BESTIARY_PROGRESS,
  isKilled,
  isSeen,
  loadBestiaryProgress,
  markKilled,
  markSeen,
  saveBestiaryProgress,
  type BestiaryStorage,
} from "../src/game/systems/BestiarySystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): BestiaryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("BestiarySystem", () => {
  it("loadBestiaryProgress returns an empty (nothing-seen) state when nothing is stored", () => {
    expect(loadBestiaryProgress(fakeStorage(), "k")).toEqual(DEFAULT_BESTIARY_PROGRESS);
  });

  it("loadBestiaryProgress returns an empty state on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadBestiaryProgress(storage, "k")).toEqual(DEFAULT_BESTIARY_PROGRESS);
  });

  it("loadBestiaryProgress drops individually corrupt entries instead of failing the whole load", () => {
    const storage = fakeStorage();
    storage.setItem(
      "k",
      JSON.stringify({ entries: { grunt: { seen: true, killed: false }, garbage: { seen: "yes" } } }),
    );
    const progress = loadBestiaryProgress(storage, "k");
    expect(isSeen(progress, "grunt")).toBe(true);
    expect(isSeen(progress, "garbage")).toBe(false);
  });

  it("marking an enemy seen records it as seen but not killed", () => {
    const progress = markSeen(DEFAULT_BESTIARY_PROGRESS, "grunt");
    expect(isSeen(progress, "grunt")).toBe(true);
    expect(isKilled(progress, "grunt")).toBe(false);
  });

  it("marking an enemy killed also marks it seen (killed implies seen)", () => {
    const progress = markKilled(DEFAULT_BESTIARY_PROGRESS, "grunt");
    expect(isSeen(progress, "grunt")).toBe(true);
    expect(isKilled(progress, "grunt")).toBe(true);
  });

  it("marking killed after seen preserves seen and adds killed", () => {
    let progress = markSeen(DEFAULT_BESTIARY_PROGRESS, "grunt");
    progress = markKilled(progress, "grunt");
    expect(isSeen(progress, "grunt")).toBe(true);
    expect(isKilled(progress, "grunt")).toBe(true);
  });

  it("marking seen twice returns the same object reference (no-op, avoids a redundant save)", () => {
    const once = markSeen(DEFAULT_BESTIARY_PROGRESS, "grunt");
    const twice = markSeen(once, "grunt");
    expect(twice).toBe(once);
  });

  it("marking killed twice returns the same object reference (no-op, avoids a redundant save)", () => {
    const once = markKilled(DEFAULT_BESTIARY_PROGRESS, "grunt");
    const twice = markKilled(once, "grunt");
    expect(twice).toBe(once);
  });

  it("does not mutate the progress object passed in", () => {
    const original = markSeen(DEFAULT_BESTIARY_PROGRESS, "runner");
    const updated = markKilled(original, "grunt");
    expect(isSeen(original, "grunt")).toBe(false);
    expect(isSeen(updated, "runner")).toBe(true);
    expect(isKilled(updated, "grunt")).toBe(true);
  });

  it("saveBestiaryProgress then loadBestiaryProgress round-trips", () => {
    const storage = fakeStorage();
    let progress = markSeen(DEFAULT_BESTIARY_PROGRESS, "wisp");
    progress = markKilled(progress, "grunt");
    saveBestiaryProgress(storage, "k", progress);
    const loaded = loadBestiaryProgress(storage, "k");
    expect(loaded).toEqual(progress);
    expect(isSeen(loaded, "wisp")).toBe(true);
    expect(isKilled(loaded, "wisp")).toBe(false);
    expect(isKilled(loaded, "grunt")).toBe(true);
  });

  it("an unmentioned enemy id is reported as neither seen nor killed", () => {
    const progress = markSeen(DEFAULT_BESTIARY_PROGRESS, "grunt");
    expect(isSeen(progress, "cinderlord")).toBe(false);
    expect(isKilled(progress, "cinderlord")).toBe(false);
  });
});
