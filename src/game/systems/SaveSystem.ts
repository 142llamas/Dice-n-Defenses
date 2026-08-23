import type { AbilityScores } from "../data/abilityScores";
import type { HeroControlMode } from "../data/heroes";
import type { DifficultyId } from "../data/difficulty";
import type { CharacterBuild } from "./CharacterBuildSystem";

/**
 * SaveSystem — Phase 9 (D-083): locally-saved, named party builds.
 *
 * Pure and storage-agnostic, mirroring BestiarySystem's/CampaignProgressSystem's
 * exact pattern: this module never touches `window.localStorage` directly, so
 * it stays unit-testable with a fake in-memory store, the same "no Phaser
 * dependency" discipline every other system in this folder follows. A scene
 * wires it to the real `localStorage` via the tiny `SaveStorage` shape.
 *
 * Scope (see DECISIONS D-083 for the full reasoning): a save slot captures a
 * PARTY BUILD (the thing `CharacterCreationScene` otherwise makes you redo
 * from scratch every visit) — name/race/class/ability-scores/signature
 * ability/control-mode per hero, plus the party size and difficulty picked
 * alongside it. It deliberately does NOT capture mid-battle state (hero
 * position/HP/gold/wave progress) — Kevin chose "checkpoint between separate
 * runs only," and a campaign run is one continuous multi-wave `BattleScene`
 * session with no existing mid-run checkpoint to hang a save off of.
 * Campaign completion (`CampaignProgressSystem`) and the Bestiary
 * (`BestiarySystem`) stay global/unslotted, unchanged by this phase.
 */

export interface SaveSlot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  party: CharacterBuild[];
  partySize: number;
  difficultyId: DifficultyId;
}

export interface SaveFile {
  version: number;
  slots: SaveSlot[];
}

/** Bumped only if a future slot shape needs real migration logic. */
export const CURRENT_SAVE_VERSION = 1;

/** No scrolling list UI exists anywhere in this project yet — this keeps every slot on-screen. */
export const MAX_SAVE_SLOTS = 6;

export const DEFAULT_SAVE_FILE: SaveFile = { version: CURRENT_SAVE_VERSION, slots: [] };

/** The minimal storage shape SaveSystem needs — matches window.localStorage. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DIFFICULTY_IDS: DifficultyId[] = ["easy", "normal", "hard", "nightmare"];
const CONTROL_MODES: HeroControlMode[] = ["human", "ai", "remote"];

function isAbilityScores(value: unknown): value is AbilityScores {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (["str", "dex", "con", "int", "wis", "cha"] as const).every(
    (k) => typeof v[k] === "number",
  );
}

function isCharacterBuild(value: unknown): value is CharacterBuild {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.raceId === "string" &&
    typeof v.classId === "string" &&
    typeof v.level === "number" &&
    isAbilityScores(v.abilityScores) &&
    typeof v.abilityId === "string" &&
    typeof v.controlledBy === "string" &&
    CONTROL_MODES.includes(v.controlledBy as HeroControlMode)
  );
}

function isSaveSlot(value: unknown): value is SaveSlot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.createdAt === "number" &&
    typeof v.updatedAt === "number" &&
    typeof v.partySize === "number" &&
    typeof v.difficultyId === "string" &&
    DIFFICULTY_IDS.includes(v.difficultyId as DifficultyId) &&
    Array.isArray(v.party) &&
    v.party.length > 0 &&
    v.party.every(isCharacterBuild)
  );
}

/**
 * Read the save file from storage, falling back to an empty default on
 * missing/corrupt JSON, an incompatible version, or a malformed shape — a
 * corrupt or future-version save can never crash the game. Any individually
 * malformed slot is dropped rather than failing the whole load, so one bad
 * slot can't wipe every other save (same discipline as BestiarySystem's
 * `isBestiaryEntry` check).
 */
export function loadSaveFile(storage: SaveStorage, key: string): SaveFile {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_SAVE_FILE;
  try {
    const parsed = JSON.parse(raw) as Partial<SaveFile> | null;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.version !== CURRENT_SAVE_VERSION ||
      !Array.isArray(parsed.slots)
    ) {
      return DEFAULT_SAVE_FILE;
    }
    return { version: CURRENT_SAVE_VERSION, slots: parsed.slots.filter(isSaveSlot) };
  } catch {
    return DEFAULT_SAVE_FILE;
  }
}

export function saveSaveFile(storage: SaveStorage, key: string, file: SaveFile): void {
  storage.setItem(key, JSON.stringify(file));
}

export interface NewSaveSlotInput {
  id: string;
  name: string;
  createdAt: number;
  party: CharacterBuild[];
  partySize: number;
  difficultyId: DifficultyId;
}

/** Appends a new slot. Caller is responsible for enforcing `MAX_SAVE_SLOTS` before calling. */
export function createSaveSlot(file: SaveFile, input: NewSaveSlotInput): SaveFile {
  const slot: SaveSlot = { ...input, updatedAt: input.createdAt };
  return { version: file.version, slots: [...file.slots, slot] };
}

export interface SaveSlotUpdate {
  party: CharacterBuild[];
  partySize: number;
  difficultyId: DifficultyId;
  updatedAt: number;
}

/**
 * Overwrite an existing slot's mutable fields (party/partySize/difficulty/
 * updatedAt) in place. Returns the SAME `file` reference, unchanged, if
 * `slotId` doesn't match any slot — callers can use that reference equality
 * to skip an unnecessary localStorage write.
 */
export function updateSaveSlot(file: SaveFile, slotId: string, update: SaveSlotUpdate): SaveFile {
  if (!file.slots.some((s) => s.id === slotId)) return file;
  return {
    version: file.version,
    slots: file.slots.map((s) => (s.id === slotId ? { ...s, ...update } : s)),
  };
}

/** Returns the SAME `file` reference, unchanged, if `slotId` doesn't match any slot. */
export function deleteSaveSlot(file: SaveFile, slotId: string): SaveFile {
  if (!file.slots.some((s) => s.id === slotId)) return file;
  return { version: file.version, slots: file.slots.filter((s) => s.id !== slotId) };
}

export function getSaveSlot(file: SaveFile, slotId: string): SaveSlot | undefined {
  return file.slots.find((s) => s.id === slotId);
}

export interface SavePartyInput {
  loadedSlotId: string | undefined;
  builds: CharacterBuild[];
  partySize: number;
  difficultyId: DifficultyId;
  /** Caller-supplied timestamp (e.g. `Date.now()`) — kept out of this pure function so it stays deterministically testable. */
  now: number;
}

export interface SavePartyResult {
  file: SaveFile;
  slotId: string;
  slotName: string;
  createdNew: boolean;
}

/**
 * D-152: the create-or-update decision `CharacterCreationScene.onSaveParty`
 * and the in-battle pause menu's "Save Party" both need — update the
 * already-loaded slot if there is one, else create a new one (capped at
 * `MAX_SAVE_SLOTS`), so both callers share one tested decision instead of
 * duplicating it. Returns `null` when a new slot was needed but the cap is
 * already reached, or when `loadedSlotId` doesn't match any existing slot.
 */
export function saveOrUpdatePartySlot(file: SaveFile, input: SavePartyInput): SavePartyResult | null {
  if (input.loadedSlotId) {
    const updated = updateSaveSlot(file, input.loadedSlotId, {
      party: input.builds,
      partySize: input.partySize,
      difficultyId: input.difficultyId,
      updatedAt: input.now,
    });
    const slot = getSaveSlot(updated, input.loadedSlotId);
    if (!slot) return null;
    return { file: updated, slotId: slot.id, slotName: slot.name, createdNew: false };
  }
  if (file.slots.length >= MAX_SAVE_SLOTS) return null;
  const id = `save-${input.now}`;
  const name = `${input.builds[0].name}'s Party`;
  const created = createSaveSlot(file, {
    id,
    name,
    createdAt: input.now,
    party: input.builds,
    partySize: input.partySize,
    difficultyId: input.difficultyId,
  });
  return { file: created, slotId: id, slotName: name, createdNew: true };
}

/**
 * Insert or replace a slot WHOLESALE, preserving every one of its own
 * fields (including its own `createdAt`/`updatedAt`) — unlike
 * `createSaveSlot`/`updateSaveSlot`, which each derive `updatedAt` from a
 * timestamp the CALLER hands in for a LOCAL mutation. This is the right
 * primitive for merging in a slot that already has its own authoritative
 * timestamps from elsewhere (Phase 10, D-084: a slot pulled down from
 * `CloudSaveSync` during a cloud sync).
 */
export function upsertSaveSlot(file: SaveFile, slot: SaveSlot): SaveFile {
  const exists = file.slots.some((s) => s.id === slot.id);
  return {
    version: file.version,
    slots: exists ? file.slots.map((s) => (s.id === slot.id ? slot : s)) : [...file.slots, slot],
  };
}
