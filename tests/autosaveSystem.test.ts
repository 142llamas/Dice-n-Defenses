import { describe, expect, it } from "vitest";
import {
  CURRENT_AUTOSAVE_VERSION,
  DEFAULT_AUTOSAVE_FILE,
  MAX_AUTOSAVE_SLOTS,
  autosaveSlotsForMode,
  checkpointAutosave,
  deleteAutosaveSlot,
  generateRunId,
  getAutosaveSlot,
  loadAutosaveFile,
  saveAutosaveFile,
  type AutosaveFile,
  type AutosaveSlot,
  type AutosaveStorage,
} from "../src/game/systems/AutosaveSystem";
import type { HeroDefinition } from "../src/game/data/heroes";
import type { BattleStateSnapshot } from "../src/game/systems/BattleStateSnapshot";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): AutosaveStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

const heroDefinitions = [{ id: "h1", name: "Kael" }] as unknown as HeroDefinition[];
const battleState = { phaseHistory: ["preparation", "player"], wavesCleared: 1 } as unknown as BattleStateSnapshot;

function slot(overrides: Partial<AutosaveSlot> = {}): AutosaveSlot {
  return {
    id: "run-1",
    createdAt: 100,
    updatedAt: 100,
    label: "Emberford Reach — Ch. 1 (Wave 2)",
    mode: "campaign",
    heroDefinitions,
    difficultyId: "normal",
    campaignId: "emberford-reach",
    chapterIndex: 0,
    resolvedWaves: [],
    battleState,
    campaignRewardGoldEarned: 15,
    temporaryStructures: [],
    ...overrides,
  };
}

describe("AutosaveSystem", () => {
  it("loadAutosaveFile returns the default (empty) file when nothing is stored", () => {
    expect(loadAutosaveFile(fakeStorage(), "k")).toEqual(DEFAULT_AUTOSAVE_FILE);
  });

  it("loadAutosaveFile returns the default file on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadAutosaveFile(storage, "k")).toEqual(DEFAULT_AUTOSAVE_FILE);
  });

  it("loadAutosaveFile returns the default file on a version mismatch", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ version: 999, slots: [] }));
    expect(loadAutosaveFile(storage, "k")).toEqual(DEFAULT_AUTOSAVE_FILE);
  });

  it("loadAutosaveFile drops an individually malformed slot instead of failing the whole load", () => {
    const storage = fakeStorage();
    const good = slot();
    storage.setItem(
      "k",
      JSON.stringify({
        version: CURRENT_AUTOSAVE_VERSION,
        slots: [good, { id: "broken" /* missing everything else */ }],
      }),
    );
    const file = loadAutosaveFile(storage, "k");
    expect(file.slots).toHaveLength(1);
    expect(file.slots[0].id).toBe("run-1");
  });

  it("checkpointAutosave inserts a new run's first checkpoint", () => {
    const file = checkpointAutosave(DEFAULT_AUTOSAVE_FILE, slot());
    expect(file.slots).toHaveLength(1);
    expect(getAutosaveSlot(file, "run-1")).toEqual(slot());
  });

  it("checkpointAutosave upserts (replaces wholesale) a later checkpoint of the SAME run, not appending a duplicate", () => {
    const first = checkpointAutosave(DEFAULT_AUTOSAVE_FILE, slot({ updatedAt: 100, battleState: { wavesCleared: 1 } as unknown as BattleStateSnapshot }));
    const second = checkpointAutosave(first, slot({ updatedAt: 200, battleState: { wavesCleared: 2 } as unknown as BattleStateSnapshot }));
    expect(second.slots).toHaveLength(1);
    expect(getAutosaveSlot(second, "run-1")?.updatedAt).toBe(200);
    expect(getAutosaveSlot(second, "run-1")?.battleState).toEqual({ wavesCleared: 2 });
  });

  it("checkpointAutosave evicts the oldest OTHER run once the pool is full, keeping a single long-running playthrough from starving other runs", () => {
    let file: AutosaveFile = DEFAULT_AUTOSAVE_FILE;
    for (let i = 0; i < MAX_AUTOSAVE_SLOTS; i++) {
      file = checkpointAutosave(file, slot({ id: `run-${i}`, updatedAt: i }));
    }
    expect(file.slots).toHaveLength(MAX_AUTOSAVE_SLOTS);

    // A single run re-checkpointing repeatedly (upsert) never evicts anything.
    file = checkpointAutosave(file, slot({ id: "run-0", updatedAt: 999 }));
    expect(file.slots).toHaveLength(MAX_AUTOSAVE_SLOTS);
    expect(getAutosaveSlot(file, "run-0")?.updatedAt).toBe(999);

    // A genuinely new run's first checkpoint evicts the oldest OTHER slot (run-1, updatedAt 1).
    file = checkpointAutosave(file, slot({ id: "run-new", updatedAt: 1000 }));
    expect(file.slots).toHaveLength(MAX_AUTOSAVE_SLOTS);
    expect(getAutosaveSlot(file, "run-1")).toBeUndefined();
    expect(getAutosaveSlot(file, "run-new")).toBeDefined();
  });

  it("deleteAutosaveSlot removes the matching slot", () => {
    const file = checkpointAutosave(DEFAULT_AUTOSAVE_FILE, slot());
    expect(deleteAutosaveSlot(file, "run-1").slots).toHaveLength(0);
  });

  it("deleteAutosaveSlot returns the same file reference, unchanged, for an unknown id", () => {
    const file = checkpointAutosave(DEFAULT_AUTOSAVE_FILE, slot());
    expect(deleteAutosaveSlot(file, "missing")).toBe(file);
  });

  it("getAutosaveSlot returns undefined for an unknown id", () => {
    expect(getAutosaveSlot(DEFAULT_AUTOSAVE_FILE, "missing")).toBeUndefined();
  });

  it("autosaveSlotsForMode filters by mode and orders newest-first", () => {
    let file: AutosaveFile = DEFAULT_AUTOSAVE_FILE;
    file = checkpointAutosave(file, slot({ id: "c1", mode: "campaign", updatedAt: 100 }));
    file = checkpointAutosave(file, slot({ id: "f1", mode: "freeplay", updatedAt: 300, campaignId: undefined, chapterIndex: undefined, freePlayMapId: "sundered-pass" }));
    file = checkpointAutosave(file, slot({ id: "c2", mode: "campaign", updatedAt: 200 }));

    const campaignSlots = autosaveSlotsForMode(file, "campaign");
    expect(campaignSlots.map((s) => s.id)).toEqual(["c2", "c1"]);

    const freeplaySlots = autosaveSlotsForMode(file, "freeplay");
    expect(freeplaySlots.map((s) => s.id)).toEqual(["f1"]);
  });

  it("saveAutosaveFile then loadAutosaveFile round-trips", () => {
    const storage = fakeStorage();
    const file = checkpointAutosave(DEFAULT_AUTOSAVE_FILE, slot());
    saveAutosaveFile(storage, "k", file);
    expect(loadAutosaveFile(storage, "k")).toEqual(file);
  });

  it("generateRunId produces distinct ids for distinct calls", () => {
    const a = generateRunId(1000);
    const b = generateRunId(1000);
    expect(a).not.toBe(b);
    expect(a.startsWith("autosave-1000-")).toBe(true);
  });
});
