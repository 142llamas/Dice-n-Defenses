import type { HeroDefinition } from "../data/heroes";
import type { WaveDefinition } from "../data/waves";
import type { RunLengthId } from "../data/levelMilestones";
import type { DifficultyId } from "../data/difficulty";
import type { CharacterBuild } from "./CharacterBuildSystem";
import type { BattleStateSnapshot } from "./BattleStateSnapshot";

/**
 * AutosaveSystem — Batch F (item 18): a mid-BATTLE checkpoint, unlike
 * `SaveSystem.ts`'s party-build-only slots. Mirrors that file's exact
 * storage-agnostic pattern (pure, no `localStorage` access, a
 * `AutosaveStorage` shape a scene wires to the real thing) so this stays
 * unit-testable the same way every other system in this folder is.
 *
 * A slot captures everything `BattleScene.init()` needs to restart the
 * battle from scratch (`heroDefinitions`/`difficultyId`/campaign-or-
 * free-play identity) PLUS a `BattleStateSnapshot` (Phase 12.1, D-101 —
 * heroes/wave/gold/structures/rests, previously built for multiplayer sync
 * and never actually wired to any persistence until now) PLUS the
 * ALREADY-RESOLVED wave list (`resolvedWaves`) — `ThreatBudgetSystem`'s own
 * elite-split/extra-lane rolls are genuinely random and can't be
 * regenerated identically, so the exact post-roll list from the checkpoint
 * moment has to be persisted verbatim, not re-derived from raw campaign/
 * difficulty data on resume.
 *
 * Slots are keyed by a stable per-playthrough `id` (a "run id", generated
 * once when a battle starts and carried through a resume) and UPSERTED,
 * not blindly appended — checkpointing every wave clear against a naive
 * "always insert, evict oldest" pool would mean a single long playthrough
 * evicts its OWN earlier checkpoints, leaving no room for a second
 * in-progress run to ever show up in "Continue." Only a genuinely NEW run's
 * first checkpoint evicts the oldest *other* slot, once the pool is full.
 */

export interface AutosaveSlot {
  /** The run id this checkpoint belongs to — stable across every checkpoint of the same battle, including after a resume. */
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Precomputed, human-readable ("Emberford Reach — Ch. 2 (Wave 4)") — the scene layer knows campaign/map names, this module doesn't. */
  label: string;
  mode: "campaign" | "freeplay";
  heroDefinitions: HeroDefinition[];
  difficultyId: DifficultyId;
  campaignId?: string;
  chapterIndex?: number;
  freePlayMapId?: string;
  freePlayRunLengthId?: RunLengthId;
  freePlayBossEnemyId?: string;
  originalParty?: CharacterBuild[];
  /** The wave list AFTER `ThreatBudgetSystem`'s random elite-split/extra-lane rolls — see this file's own header comment for why this can't be regenerated. */
  resolvedWaves: WaveDefinition[];
  battleState: BattleStateSnapshot;
  /**
   * Not part of `BattleStateSnapshot` — a spell-placed terrain structure's
   * auto-expiry countdown (`BattleScene.temporaryStructures`) is tracked at
   * the scene layer, separately from `BuildSystem`'s own placement model.
   * Without carrying this forward, a resumed structure would still exist
   * (via `battleState.structures`) but never expire — permanent instead of
   * temporary.
   */
  temporaryStructures: { instanceId: string; remainingTurns: number }[];
  /**
   * Not part of `BattleStateSnapshot` (that module stays scoped to its
   * original multiplayer-feasibility purpose) — this battle's own running
   * total toward the persistent campaign gold pool, credited only once, at
   * chapter victory. Without carrying it forward, resuming and later
   * finishing the chapter would lose every wave's worth of gold earned
   * before the checkpoint.
   */
  campaignRewardGoldEarned: number;
}

export interface AutosaveFile {
  version: number;
  slots: AutosaveSlot[];
}

/** Bumped only if a future slot shape needs real migration logic. */
export const CURRENT_AUTOSAVE_VERSION = 1;

/** Kevin's own spec (item 18): a small rotating pool, oldest overwritten once full. */
export const MAX_AUTOSAVE_SLOTS = 3;

export const DEFAULT_AUTOSAVE_FILE: AutosaveFile = { version: CURRENT_AUTOSAVE_VERSION, slots: [] };

/** The minimal storage shape this system needs — matches window.localStorage. */
export interface AutosaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MODES: AutosaveSlot["mode"][] = ["campaign", "freeplay"];

function isAutosaveSlot(value: unknown): value is AutosaveSlot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.createdAt === "number" &&
    typeof v.updatedAt === "number" &&
    typeof v.label === "string" &&
    MODES.includes(v.mode as AutosaveSlot["mode"]) &&
    Array.isArray(v.heroDefinitions) &&
    typeof v.difficultyId === "string" &&
    Array.isArray(v.resolvedWaves) &&
    typeof v.battleState === "object" &&
    v.battleState !== null &&
    typeof v.campaignRewardGoldEarned === "number" &&
    Array.isArray(v.temporaryStructures)
  );
}

/**
 * Read the autosave file from storage, falling back to an empty default on
 * missing/corrupt JSON, an incompatible version, or a malformed shape — a
 * corrupt or future-version file can never crash the game. Any individually
 * malformed slot is dropped rather than failing the whole load, same
 * discipline as `SaveSystem.loadSaveFile`'s own `isSaveSlot` check.
 */
export function loadAutosaveFile(storage: AutosaveStorage, key: string): AutosaveFile {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_AUTOSAVE_FILE;
  try {
    const parsed = JSON.parse(raw) as Partial<AutosaveFile> | null;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.version !== CURRENT_AUTOSAVE_VERSION ||
      !Array.isArray(parsed.slots)
    ) {
      return DEFAULT_AUTOSAVE_FILE;
    }
    return { version: CURRENT_AUTOSAVE_VERSION, slots: parsed.slots.filter(isAutosaveSlot) };
  } catch {
    return DEFAULT_AUTOSAVE_FILE;
  }
}

export function saveAutosaveFile(storage: AutosaveStorage, key: string, file: AutosaveFile): void {
  storage.setItem(key, JSON.stringify(file));
}

export function getAutosaveSlot(file: AutosaveFile, id: string): AutosaveSlot | undefined {
  return file.slots.find((s) => s.id === id);
}

/**
 * Upsert `slot` by its own `id` — replaces an existing checkpoint of the
 * SAME run wholesale (same "insert or replace" primitive as
 * `SaveSystem.upsertSaveSlot`), or inserts a new one. When inserting a
 * genuinely new run's first checkpoint would exceed `MAX_AUTOSAVE_SLOTS`,
 * evicts whichever OTHER slot has the oldest `updatedAt` first.
 */
export function checkpointAutosave(file: AutosaveFile, slot: AutosaveSlot): AutosaveFile {
  const existingIndex = file.slots.findIndex((s) => s.id === slot.id);
  if (existingIndex !== -1) {
    const slots = [...file.slots];
    slots[existingIndex] = slot;
    return { version: file.version, slots };
  }
  if (file.slots.length < MAX_AUTOSAVE_SLOTS) {
    return { version: file.version, slots: [...file.slots, slot] };
  }
  const oldest = file.slots.reduce((a, b) => (a.updatedAt <= b.updatedAt ? a : b));
  return { version: file.version, slots: [...file.slots.filter((s) => s.id !== oldest.id), slot] };
}

/** Returns the SAME `file` reference, unchanged, if `id` doesn't match any slot. */
export function deleteAutosaveSlot(file: AutosaveFile, id: string): AutosaveFile {
  if (!file.slots.some((s) => s.id === id)) return file;
  return { version: file.version, slots: file.slots.filter((s) => s.id !== id) };
}

/** Every slot for a given mode, newest-first — what a "Continue" list shows. */
export function autosaveSlotsForMode(file: AutosaveFile, mode: AutosaveSlot["mode"]): AutosaveSlot[] {
  return file.slots.filter((s) => s.mode === mode).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** A short, collision-resistant run id — no real UUID library used anywhere else in this project. */
export function generateRunId(now: number): string {
  return `autosave-${now}-${Math.random().toString(36).slice(2, 8)}`;
}
