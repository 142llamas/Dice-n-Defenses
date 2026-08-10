/**
 * WorldFlagSystem — a persisted store of per-choice campaign-story flags
 * (D-118, engine scaffolding for `CAMPAIGN_STORY_DESIGN.md`).
 *
 * Pure and storage-agnostic, matching `CampaignProgressSystem`'s exact
 * pattern: never touches `window.localStorage` directly, so it stays
 * unit-testable with a fake in-memory store; a scene would wire it to the
 * real `localStorage` via the tiny `WorldFlagStorage` shape.
 *
 * What this is for: `CAMPAIGN_STORY_DESIGN.md` §4-§6 describes choices whose
 * consequences need to be readable much later — which miniboss a player
 * spared (read by Saltmere's Ch1, region 5), Sorrel Thane's 3-outcome branch
 * chain (read by the same slot), and the accumulated pattern across all six
 * regions that picks the capstone's ending (§5). None of that story content
 * exists yet — this is only the generic mechanism a future content pass
 * would read/write through. A flag's VALUE is deliberately generic
 * (boolean/string/number) rather than a fixed enum, since the eventual
 * flags (a spared-or-destroyed miniboss id, a 3-way outcome, a numeric
 * "held-on vs. let-go" counter) don't share one shape.
 *
 * Deliberately its own small system rather than folded into
 * `CampaignProgressSystem` — a campaign-completion flag and a per-choice
 * story flag are different concerns, even though the persistence mechanism
 * is identical (this project's established "one system, one job" pattern:
 * `SettingsSystem`/`BestiarySystem`/`CampaignProgressSystem` already stay
 * separate for the same reason).
 */

export type WorldFlagValue = boolean | string | number;

export interface WorldFlagState {
  flags: Record<string, WorldFlagValue>;
}

export const DEFAULT_WORLD_FLAG_STATE: WorldFlagState = { flags: {} };

/** The minimal storage shape WorldFlagSystem needs — matches window.localStorage. */
export interface WorldFlagStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isWorldFlagValue(value: unknown): value is WorldFlagValue {
  return typeof value === "boolean" || typeof value === "string" || typeof value === "number";
}

/**
 * Read flag state from storage, falling back to an empty state on missing
 * or corrupt data — same defensiveness as `loadCampaignProgress`. Any
 * individual malformed entry (wrong value type) is dropped rather than
 * failing the whole load.
 */
export function loadWorldFlags(storage: WorldFlagStorage, key: string): WorldFlagState {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_WORLD_FLAG_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<WorldFlagState> | null;
    if (typeof parsed !== "object" || parsed === null || typeof parsed.flags !== "object" || parsed.flags === null) {
      return DEFAULT_WORLD_FLAG_STATE;
    }
    const flags: Record<string, WorldFlagValue> = {};
    for (const [id, value] of Object.entries(parsed.flags)) {
      if (isWorldFlagValue(value)) flags[id] = value;
    }
    return { flags };
  } catch {
    return DEFAULT_WORLD_FLAG_STATE;
  }
}

export function saveWorldFlags(storage: WorldFlagStorage, key: string, state: WorldFlagState): void {
  storage.setItem(key, JSON.stringify(state));
}

/**
 * Set flag `flagId` to `value`, returning a new state (immutable-style,
 * matching this project's other pure systems). Returns the SAME object
 * reference, unchanged, when the flag already holds this exact value —
 * callers can use that reference equality to skip an unnecessary
 * localStorage write, same discipline as `markCampaignCompleted`.
 */
export function setWorldFlag(state: WorldFlagState, flagId: string, value: WorldFlagValue): WorldFlagState {
  if (state.flags[flagId] === value) return state;
  return { flags: { ...state.flags, [flagId]: value } };
}

export function getWorldFlag(state: WorldFlagState, flagId: string): WorldFlagValue | undefined {
  return state.flags[flagId];
}

export function hasWorldFlag(state: WorldFlagState, flagId: string): boolean {
  return flagId in state.flags;
}

/** Remove flag `flagId` entirely. Returns the SAME object reference if it was already absent. */
export function clearWorldFlag(state: WorldFlagState, flagId: string): WorldFlagState {
  if (!(flagId in state.flags)) return state;
  const flags = { ...state.flags };
  delete flags[flagId];
  return { flags };
}
