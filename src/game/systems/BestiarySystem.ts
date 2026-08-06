/**
 * BestiarySystem — persistent unlock-on-encounter enemy log (Phase 11.6,
 * D-079).
 *
 * Pure and storage-agnostic, mirroring SettingsSystem's exact pattern: this
 * module never touches `window.localStorage` directly, so it stays
 * unit-testable with a fake in-memory store, the same "no Phaser dependency"
 * discipline every other system in this folder follows. A scene wires it to
 * the real `localStorage` via the tiny `BestiaryStorage` shape (identical in
 * spirit to SettingsSystem's `SettingsStorage`).
 *
 * Tracks, per enemy DEFINITION id (not per-instance — see `entities/Enemy.ts`
 * for the instance/definition split), whether the player has SEEN it
 * (encountered in any battle) and whether they have KILLED at least one.
 * Killed always implies seen — there is no path to killing an enemy without
 * first meeting it, and every function here preserves that invariant.
 * `BestiaryScene` reads this to decide whether to reveal an enemy's name,
 * stats, and lore, or render it as a locked "???" placeholder.
 */

export interface BestiaryEntry {
  seen: boolean;
  killed: boolean;
}

export interface BestiaryProgress {
  entries: Record<string, BestiaryEntry>;
}

export const DEFAULT_BESTIARY_PROGRESS: BestiaryProgress = { entries: {} };

/** The minimal storage shape BestiarySystem needs — matches window.localStorage. */
export interface BestiaryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isBestiaryEntry(value: unknown): value is BestiaryEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.seen === "boolean" && typeof v.killed === "boolean";
}

/**
 * Read progress from storage, falling back to an empty (nothing-seen) state
 * on missing or corrupt data — same defensiveness as `SettingsSystem.
 * loadSettings`. Any individual corrupt entry is dropped rather than failing
 * the whole load, so one bad key can't wipe unrelated progress.
 */
export function loadBestiaryProgress(storage: BestiaryStorage, key: string): BestiaryProgress {
  const raw = storage.getItem(key);
  if (!raw) return { entries: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<BestiaryProgress> | null;
    if (typeof parsed !== "object" || parsed === null || typeof parsed.entries !== "object" || parsed.entries === null) {
      return { entries: {} };
    }
    const entries: Record<string, BestiaryEntry> = {};
    for (const [id, entry] of Object.entries(parsed.entries)) {
      if (isBestiaryEntry(entry)) entries[id] = entry;
    }
    return { entries };
  } catch {
    return { entries: {} };
  }
}

export function saveBestiaryProgress(
  storage: BestiaryStorage,
  key: string,
  progress: BestiaryProgress,
): void {
  storage.setItem(key, JSON.stringify(progress));
}

/**
 * Mark an enemy as SEEN, returning a new progress object (immutable-style,
 * matching this project's other pure systems). Returns the SAME object
 * reference, unchanged, when the enemy was already seen — callers can use
 * that reference equality to skip an unnecessary localStorage write.
 */
export function markSeen(progress: BestiaryProgress, enemyId: string): BestiaryProgress {
  const existing = progress.entries[enemyId];
  if (existing?.seen) return progress;
  return {
    entries: {
      ...progress.entries,
      [enemyId]: { seen: true, killed: existing?.killed ?? false },
    },
  };
}

/**
 * Mark an enemy as KILLED (which always implies SEEN too), returning a new
 * progress object. Same unchanged-reference short-circuit as `markSeen`.
 */
export function markKilled(progress: BestiaryProgress, enemyId: string): BestiaryProgress {
  const existing = progress.entries[enemyId];
  if (existing?.killed) return progress;
  return {
    entries: {
      ...progress.entries,
      [enemyId]: { seen: true, killed: true },
    },
  };
}

export function isSeen(progress: BestiaryProgress, enemyId: string): boolean {
  return progress.entries[enemyId]?.seen ?? false;
}

export function isKilled(progress: BestiaryProgress, enemyId: string): boolean {
  return progress.entries[enemyId]?.killed ?? false;
}
