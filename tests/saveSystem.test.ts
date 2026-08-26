import { describe, expect, it } from "vitest";
import {
  CURRENT_SAVE_VERSION,
  DEFAULT_SAVE_FILE,
  MAX_SAVE_SLOTS,
  createSaveSlot,
  deleteSaveSlot,
  getSaveSlot,
  loadSaveFile,
  saveOrUpdatePartySlot,
  saveSaveFile,
  updateSaveSlot,
  upsertSaveSlot,
  type SaveFile,
  type SaveStorage,
} from "../src/game/systems/SaveSystem";
import type { CharacterBuild } from "../src/game/systems/CharacterBuildSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): SaveStorage {
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
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    controlledBy: "human",
    ...overrides,
  };
}

describe("SaveSystem", () => {
  it("loadSaveFile returns the default (empty) file when nothing is stored", () => {
    expect(loadSaveFile(fakeStorage(), "k")).toEqual(DEFAULT_SAVE_FILE);
  });

  it("loadSaveFile returns the default file on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadSaveFile(storage, "k")).toEqual(DEFAULT_SAVE_FILE);
  });

  it("loadSaveFile returns the default file on a version mismatch", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ version: 999, slots: [] }));
    expect(loadSaveFile(storage, "k")).toEqual(DEFAULT_SAVE_FILE);
  });

  it("loadSaveFile drops an individually malformed slot instead of failing the whole load", () => {
    const storage = fakeStorage();
    const good = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Good Party",
      createdAt: 1,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    }).slots[0];
    storage.setItem(
      "k",
      JSON.stringify({
        version: CURRENT_SAVE_VERSION,
        slots: [good, { id: "b", name: "Broken" /* missing everything else */ }],
      }),
    );
    const file = loadSaveFile(storage, "k");
    expect(file.slots).toHaveLength(1);
    expect(file.slots[0].id).toBe("a");
  });

  it("createSaveSlot appends a new slot with matching createdAt/updatedAt", () => {
    const file = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    });
    expect(file.slots).toHaveLength(1);
    expect(file.slots[0]).toMatchObject({ id: "a", name: "Ash's Party", createdAt: 100, updatedAt: 100 });
  });

  it("updateSaveSlot overwrites party/partySize/difficulty/updatedAt on the matching slot", () => {
    const created = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    });
    const updated = updateSaveSlot(created, "a", {
      party: [build({ name: "Renamed" })],
      partySize: 2,
      difficultyId: "hard",
      updatedAt: 200,
    });
    const slot = getSaveSlot(updated, "a");
    expect(slot?.party[0].name).toBe("Renamed");
    expect(slot?.partySize).toBe(2);
    expect(slot?.difficultyId).toBe("hard");
    expect(slot?.updatedAt).toBe(200);
    expect(slot?.createdAt).toBe(100); // untouched
    expect(slot?.name).toBe("Ash's Party"); // untouched
  });

  it("updateSaveSlot returns the same file reference, unchanged, for an unknown slot id", () => {
    const file = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    });
    const result = updateSaveSlot(file, "missing", {
      party: [build()],
      partySize: 1,
      difficultyId: "easy",
      updatedAt: 200,
    });
    expect(result).toBe(file);
  });

  it("deleteSaveSlot removes the matching slot", () => {
    const file = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    });
    const deleted = deleteSaveSlot(file, "a");
    expect(deleted.slots).toHaveLength(0);
  });

  it("deleteSaveSlot returns the same file reference, unchanged, for an unknown slot id", () => {
    const file = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    });
    expect(deleteSaveSlot(file, "missing")).toBe(file);
  });

  it("getSaveSlot returns undefined for an unknown slot id", () => {
    expect(getSaveSlot(DEFAULT_SAVE_FILE, "missing")).toBeUndefined();
  });

  it("upsertSaveSlot appends a slot that doesn't exist yet, preserving its own timestamps", () => {
    const slot = {
      id: "cloud-a",
      name: "Cloud Party",
      createdAt: 50,
      updatedAt: 900,
      party: [build()],
      partySize: 1,
      difficultyId: "normal" as const,
    };
    const file = upsertSaveSlot(DEFAULT_SAVE_FILE, slot);
    expect(getSaveSlot(file, "cloud-a")).toEqual(slot);
  });

  it("upsertSaveSlot replaces an existing slot wholesale, including its timestamps", () => {
    const file = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    });
    const replacement = {
      id: "a",
      name: "Newer From Cloud",
      createdAt: 100,
      updatedAt: 500,
      party: [build({ name: "Different" })],
      partySize: 1,
      difficultyId: "hard" as const,
    };
    const updated = upsertSaveSlot(file, replacement);
    expect(getSaveSlot(updated, "a")).toEqual(replacement);
    expect(updated.slots).toHaveLength(1);
  });

  it("saveOrUpdatePartySlot creates a new slot when no loadedSlotId is given", () => {
    const result = saveOrUpdatePartySlot(DEFAULT_SAVE_FILE, {
      loadedSlotId: undefined,
      builds: [build()],
      partySize: 1,
      difficultyId: "normal",
      now: 100,
    });
    expect(result).not.toBeNull();
    expect(result?.createdNew).toBe(true);
    expect(result?.slotName).toBe("Kael's Party");
    expect(result?.file.slots).toHaveLength(1);
    expect(getSaveSlot(result!.file, result!.slotId)).toMatchObject({
      name: "Kael's Party",
      createdAt: 100,
      updatedAt: 100,
      partySize: 1,
      difficultyId: "normal",
    });
  });

  it("saveOrUpdatePartySlot updates the existing slot in place when loadedSlotId matches", () => {
    const file = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    });
    const result = saveOrUpdatePartySlot(file, {
      loadedSlotId: "a",
      builds: [build({ name: "Renamed" })],
      partySize: 2,
      difficultyId: "hard",
      now: 200,
    });
    expect(result?.createdNew).toBe(false);
    expect(result?.slotId).toBe("a");
    expect(result?.file.slots).toHaveLength(1);
    const slot = getSaveSlot(result!.file, "a");
    expect(slot?.party[0].name).toBe("Renamed");
    expect(slot?.partySize).toBe(2);
    expect(slot?.difficultyId).toBe("hard");
    expect(slot?.updatedAt).toBe(200);
    expect(slot?.name).toBe("Ash's Party"); // untouched, matching updateSaveSlot's own behavior
  });

  it("saveOrUpdatePartySlot returns null when loadedSlotId doesn't match any slot", () => {
    const file = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build()],
      partySize: 1,
      difficultyId: "normal",
    });
    const result = saveOrUpdatePartySlot(file, {
      loadedSlotId: "missing",
      builds: [build()],
      partySize: 1,
      difficultyId: "normal",
      now: 200,
    });
    expect(result).toBeNull();
  });

  it("saveOrUpdatePartySlot returns null when creating a new slot would exceed MAX_SAVE_SLOTS", () => {
    let file: SaveFile = DEFAULT_SAVE_FILE;
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      file = createSaveSlot(file, {
        id: `slot-${i}`,
        name: `Party ${i}`,
        createdAt: i,
        party: [build()],
        partySize: 1,
        difficultyId: "normal",
      });
    }
    expect(file.slots).toHaveLength(MAX_SAVE_SLOTS);
    const result = saveOrUpdatePartySlot(file, {
      loadedSlotId: undefined,
      builds: [build()],
      partySize: 1,
      difficultyId: "normal",
      now: 999,
    });
    expect(result).toBeNull();
  });

  it("saveSaveFile then loadSaveFile round-trips", () => {
    const storage = fakeStorage();
    const file = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "a",
      name: "Ash's Party",
      createdAt: 100,
      party: [build(), build({ id: "party-2", name: "Wren" })],
      partySize: 2,
      difficultyId: "nightmare",
    });
    saveSaveFile(storage, "k", file);
    const loaded = loadSaveFile(storage, "k");
    expect(loaded).toEqual(file);
  });
});
