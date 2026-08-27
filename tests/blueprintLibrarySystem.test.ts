import { describe, expect, it } from "vitest";
import {
  DEFAULT_BLUEPRINT_LIBRARY_STATE,
  blueprintsForClass,
  deleteBlueprint,
  loadBlueprintLibrary,
  saveBlueprintLibrary,
  upsertBlueprint,
  type BlueprintLibraryState,
  type BlueprintLibraryStorage,
  type LevelUpBlueprint,
} from "../src/game/systems/BlueprintLibrarySystem";
import { emptyLevelUpPlan } from "../src/game/systems/LevelUpPlanSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): BlueprintLibraryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function blueprint(overrides: Partial<LevelUpBlueprint> = {}): LevelUpBlueprint {
  return { id: "bp-1", name: "Tank Fighter", classId: "fighter", plan: emptyLevelUpPlan("auto"), ...overrides };
}

/**
 * Party Creation Overhaul Plan 6.1 — the global level-up blueprint library.
 * Pure/storage-agnostic, same convention as `CompanionRosterSystem`/
 * `CampaignProgressSystem`.
 */
describe("loadBlueprintLibrary / saveBlueprintLibrary (D-199)", () => {
  it("returns the default (empty) state when nothing is stored", () => {
    expect(loadBlueprintLibrary(fakeStorage(), "k")).toEqual(DEFAULT_BLUEPRINT_LIBRARY_STATE);
  });

  it("returns the default state on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadBlueprintLibrary(storage, "k")).toEqual(DEFAULT_BLUEPRINT_LIBRARY_STATE);
  });

  it("round-trips a saved library", () => {
    const storage = fakeStorage();
    const state: BlueprintLibraryState = { blueprints: [blueprint(), blueprint({ id: "bp-2", name: "Glass Cannon" })] };
    saveBlueprintLibrary(storage, "k", state);
    expect(loadBlueprintLibrary(storage, "k")).toEqual(state);
  });

  it("drops a malformed blueprint entry but keeps the well-formed ones", () => {
    const storage = fakeStorage();
    storage.setItem(
      "k",
      JSON.stringify({ blueprints: [blueprint(), { id: "bp-bad" /* missing name/classId/plan */ }] }),
    );
    expect(loadBlueprintLibrary(storage, "k")).toEqual({ blueprints: [blueprint()] });
  });

  it("falls back to an empty list for a non-array blueprints field rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ blueprints: "not an array" }));
    expect(loadBlueprintLibrary(storage, "k")).toEqual(DEFAULT_BLUEPRINT_LIBRARY_STATE);
  });
});

describe("blueprintsForClass (D-199)", () => {
  it("returns only blueprints matching the given class id", () => {
    const state: BlueprintLibraryState = {
      blueprints: [blueprint({ id: "bp-1", classId: "fighter" }), blueprint({ id: "bp-2", classId: "wizard" })],
    };
    expect(blueprintsForClass(state, "fighter")).toEqual([blueprint({ id: "bp-1", classId: "fighter" })]);
  });

  it("returns an empty array when no blueprint matches", () => {
    expect(blueprintsForClass(DEFAULT_BLUEPRINT_LIBRARY_STATE, "fighter")).toEqual([]);
  });
});

describe("upsertBlueprint (D-199)", () => {
  it("adds a new blueprint when the id isn't already present", () => {
    const next = upsertBlueprint(DEFAULT_BLUEPRINT_LIBRARY_STATE, blueprint());
    expect(next.blueprints).toEqual([blueprint()]);
  });

  it("overwrites an existing blueprint in place when the id already exists", () => {
    const original = { blueprints: [blueprint({ name: "Old Name" })] };
    const next = upsertBlueprint(original, blueprint({ name: "New Name" }));
    expect(next.blueprints).toEqual([blueprint({ name: "New Name" })]);
    expect(next.blueprints).toHaveLength(1);
  });
});

describe("deleteBlueprint (D-199)", () => {
  it("removes a blueprint by id", () => {
    const state: BlueprintLibraryState = { blueprints: [blueprint({ id: "bp-1" }), blueprint({ id: "bp-2" })] };
    expect(deleteBlueprint(state, "bp-1").blueprints).toEqual([blueprint({ id: "bp-2" })]);
  });

  it("no-ops (same reference) when the id isn't found", () => {
    const state: BlueprintLibraryState = { blueprints: [blueprint()] };
    expect(deleteBlueprint(state, "not-real")).toBe(state);
  });
});
