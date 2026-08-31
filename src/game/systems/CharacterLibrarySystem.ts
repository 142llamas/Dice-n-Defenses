import type { CharacterBuild } from "./CharacterBuildSystem";

/**
 * CharacterLibrarySystem — Phase 2 (2026-08-28 playtest batch, D-204): a
 * named, reusable single-hero `CharacterBuild`, global across every save/
 * campaign, forever — same shape and same reasoning as
 * `BlueprintLibrarySystem`'s `LevelUpBlueprint` library, just for a whole
 * character build instead of a level-up plan.
 *
 * Pure and storage-agnostic, same pattern as `BlueprintLibrarySystem`/
 * `CompanionRosterSystem`/`CampaignProgressSystem`: never touches
 * `window.localStorage` directly. Deliberately LOCAL-ONLY, not synced to
 * Firestore — same "personal preset list, not a publicly shareable thing"
 * reasoning D-199 gave for the blueprint library.
 *
 * Scope, kept deliberately proportionate to the actual ask ("a way to pull
 * in one individually-saved character" — `SaveSystem` only saves/loads a
 * whole 4-hero party at once): Save always creates a NEW entry, there is no
 * update-in-place/"loaded from" tracking the way `SaveSystem.
 * saveOrUpdatePartySlot` has for a party slot. Re-saving a tweaked character
 * just adds another entry; `deleteLibraryEntry` covers pruning the library
 * back down.
 */

export interface CharacterLibraryEntry {
  id: string;
  name: string;
  createdAt: number;
  build: CharacterBuild;
}

export interface CharacterLibraryState {
  entries: CharacterLibraryEntry[];
}

export const DEFAULT_CHARACTER_LIBRARY_STATE: CharacterLibraryState = { entries: [] };

/** No scrolling list UI exists anywhere in this project yet — same ceiling reasoning as `SaveSystem.MAX_SAVE_SLOTS`. */
export const MAX_LIBRARY_ENTRIES = 12;

/** The minimal storage shape this system needs — matches window.localStorage. */
export interface CharacterLibraryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * A plausibility check, not a full schema validator — same spirit as
 * `BlueprintLibrarySystem.isPlausibleBlueprint`: just enough to reject junk
 * without hand-maintaining a field-by-field validator that would drift from
 * `CharacterBuild`'s real (frequently-extended) shape.
 */
function isPlausibleLibraryEntry(value: unknown): value is CharacterLibraryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<CharacterLibraryEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.name !== "string" ||
    typeof entry.createdAt !== "number" ||
    typeof entry.build !== "object" ||
    entry.build === null
  ) {
    return false;
  }
  const build = entry.build as Partial<CharacterBuild>;
  return (
    typeof build.id === "string" &&
    typeof build.name === "string" &&
    typeof build.raceId === "string" &&
    typeof build.classId === "string" &&
    typeof build.level === "number" &&
    typeof build.abilityScores === "object" &&
    build.abilityScores !== null &&
    typeof build.controlledBy === "string"
  );
}

/**
 * Read the library from storage, falling back to the default (empty) state
 * on missing or corrupt data — same defensiveness as
 * `loadBlueprintLibrary`/`loadCompanionRoster`. A malformed individual entry
 * is dropped rather than failing the whole load.
 */
export function loadCharacterLibrary(storage: CharacterLibraryStorage, key: string): CharacterLibraryState {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_CHARACTER_LIBRARY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<CharacterLibraryState> | null;
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_CHARACTER_LIBRARY_STATE;
    const entries = Array.isArray(parsed.entries) ? parsed.entries.filter(isPlausibleLibraryEntry) : [];
    return { entries };
  } catch {
    return DEFAULT_CHARACTER_LIBRARY_STATE;
  }
}

export function saveCharacterLibrary(storage: CharacterLibraryStorage, key: string, state: CharacterLibraryState): void {
  storage.setItem(key, JSON.stringify(state));
}

/**
 * Add a new entry (an id not already in the library) or overwrite an
 * existing one in place (an id that IS already present) — same operation
 * either way, the caller decides which by whatever id it passes.
 */
export function upsertLibraryEntry(state: CharacterLibraryState, entry: CharacterLibraryEntry): CharacterLibraryState {
  const exists = state.entries.some((e) => e.id === entry.id);
  return {
    entries: exists ? state.entries.map((e) => (e.id === entry.id ? entry : e)) : [...state.entries, entry],
  };
}

/** Removes an entry by id. No-ops (returns the same reference) if the id isn't found. */
export function deleteLibraryEntry(state: CharacterLibraryState, id: string): CharacterLibraryState {
  if (!state.entries.some((e) => e.id === id)) return state;
  return { entries: state.entries.filter((e) => e.id !== id) };
}
