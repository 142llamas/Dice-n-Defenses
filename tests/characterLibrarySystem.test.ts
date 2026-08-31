import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHARACTER_LIBRARY_STATE,
  deleteLibraryEntry,
  loadCharacterLibrary,
  saveCharacterLibrary,
  upsertLibraryEntry,
  type CharacterLibraryEntry,
  type CharacterLibraryState,
  type CharacterLibraryStorage,
} from "../src/game/systems/CharacterLibrarySystem";
import type { CharacterBuild } from "../src/game/systems/CharacterBuildSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): CharacterLibraryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "party-1",
    name: "Tharion",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    controlledBy: "human",
    ...overrides,
  };
}

function entry(overrides: Partial<CharacterLibraryEntry> = {}): CharacterLibraryEntry {
  return { id: "char-1", name: "Tharion the Bold", createdAt: 1000, build: build(), ...overrides };
}

/**
 * Phase 2 (2026-08-28 playtest batch, D-204) — the global per-character
 * library. Pure/storage-agnostic, same convention as
 * `BlueprintLibrarySystem`/`CompanionRosterSystem`.
 */
describe("loadCharacterLibrary / saveCharacterLibrary (D-204)", () => {
  it("returns the default (empty) state when nothing is stored", () => {
    expect(loadCharacterLibrary(fakeStorage(), "k")).toEqual(DEFAULT_CHARACTER_LIBRARY_STATE);
  });

  it("returns the default state on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadCharacterLibrary(storage, "k")).toEqual(DEFAULT_CHARACTER_LIBRARY_STATE);
  });

  it("round-trips a saved library", () => {
    const storage = fakeStorage();
    const state: CharacterLibraryState = { entries: [entry(), entry({ id: "char-2", name: "Voss" })] };
    saveCharacterLibrary(storage, "k", state);
    expect(loadCharacterLibrary(storage, "k")).toEqual(state);
  });

  it("drops a malformed library entry but keeps the well-formed ones", () => {
    const storage = fakeStorage();
    storage.setItem(
      "k",
      JSON.stringify({ entries: [entry(), { id: "char-bad" /* missing name/createdAt/build */ }] }),
    );
    expect(loadCharacterLibrary(storage, "k")).toEqual({ entries: [entry()] });
  });

  it("drops an entry whose build is missing required fields", () => {
    const storage = fakeStorage();
    storage.setItem(
      "k",
      JSON.stringify({
        entries: [entry(), { id: "char-bad", name: "Bad", createdAt: 1, build: { id: "x" } }],
      }),
    );
    expect(loadCharacterLibrary(storage, "k")).toEqual({ entries: [entry()] });
  });

  it("falls back to an empty list for a non-array entries field rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ entries: "not an array" }));
    expect(loadCharacterLibrary(storage, "k")).toEqual(DEFAULT_CHARACTER_LIBRARY_STATE);
  });
});

describe("upsertLibraryEntry (D-204)", () => {
  it("adds a new entry when the id isn't already present", () => {
    const next = upsertLibraryEntry(DEFAULT_CHARACTER_LIBRARY_STATE, entry());
    expect(next.entries).toEqual([entry()]);
  });

  it("overwrites an existing entry in place when the id already exists", () => {
    const original: CharacterLibraryState = { entries: [entry({ name: "Old Name" })] };
    const next = upsertLibraryEntry(original, entry({ name: "New Name" }));
    expect(next.entries).toEqual([entry({ name: "New Name" })]);
    expect(next.entries).toHaveLength(1);
  });
});

describe("deleteLibraryEntry (D-204)", () => {
  it("removes an entry by id", () => {
    const state: CharacterLibraryState = { entries: [entry({ id: "char-1" }), entry({ id: "char-2" })] };
    expect(deleteLibraryEntry(state, "char-1").entries).toEqual([entry({ id: "char-2" })]);
  });

  it("no-ops (same reference) when the id isn't found", () => {
    const state: CharacterLibraryState = { entries: [entry()] };
    expect(deleteLibraryEntry(state, "not-real")).toBe(state);
  });
});
