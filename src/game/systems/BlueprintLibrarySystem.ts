import type { LevelUpPlan } from "./LevelUpPlanSystem";

/**
 * BlueprintLibrarySystem — Party Creation Overhaul Plan 6.1: a named,
 * reusable `LevelUpPlan` per class, global across every save/campaign,
 * forever (Kevin's own spec — not scoped to one save file the way
 * `SlotState.levelUpPlan`/`CharacterBuild.levelUpPlan` are).
 *
 * Pure and storage-agnostic, same pattern as `CompanionRosterSystem`/
 * `CampaignProgressSystem`/`WorldFlagSystem`: never touches
 * `window.localStorage` directly. Deliberately LOCAL-ONLY, not synced to
 * Firestore like `CloudSaveSync`/`MapSharingSync` — those three sibling
 * "global" systems (roster/progress/world-flags) aren't cloud-synced
 * either, and a blueprint library is a personal preset list, not a
 * publicly shareable thing like a map. See D-199 for the full reasoning;
 * cheap to add cloud sync later as a separate follow-up if ever wanted.
 *
 * A blueprint's stored `plan.mode` is vestigial — Plan 6.4 decoupled
 * "how a hero applies its plan" (Auto/Prompted/Fresh, now a per-hero
 * control in `CharacterCreationScene`) from "which choices the plan
 * makes" (this library). Applying a blueprint to a hero always
 * overwrites `mode` with that hero's own current setting; whatever mode
 * happened to be active when the blueprint was saved is never read back.
 */

export interface LevelUpBlueprint {
  id: string;
  name: string;
  classId: string;
  plan: LevelUpPlan;
}

export interface BlueprintLibraryState {
  blueprints: LevelUpBlueprint[];
}

export const DEFAULT_BLUEPRINT_LIBRARY_STATE: BlueprintLibraryState = { blueprints: [] };

/** The minimal storage shape this system needs — matches window.localStorage. */
export interface BlueprintLibraryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * A plausibility check, not a full schema validator — same spirit as
 * `CompanionRosterSystem.isPlausibleCharacterBuild`: just enough to reject
 * junk without hand-maintaining a field-by-field validator that would
 * drift from `LevelUpPlan`'s real (frequently-extended) shape.
 */
function isPlausibleBlueprint(value: unknown): value is LevelUpBlueprint {
  if (typeof value !== "object" || value === null) return false;
  const bp = value as Partial<LevelUpBlueprint>;
  return (
    typeof bp.id === "string" &&
    typeof bp.name === "string" &&
    typeof bp.classId === "string" &&
    typeof bp.plan === "object" &&
    bp.plan !== null
  );
}

/**
 * Read the library from storage, falling back to the default (empty)
 * state on missing or corrupt data — same defensiveness as
 * `loadCompanionRoster`/`loadCampaignProgress`. A malformed individual
 * blueprint is dropped rather than failing the whole load.
 */
export function loadBlueprintLibrary(storage: BlueprintLibraryStorage, key: string): BlueprintLibraryState {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_BLUEPRINT_LIBRARY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<BlueprintLibraryState> | null;
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_BLUEPRINT_LIBRARY_STATE;
    const blueprints = Array.isArray(parsed.blueprints) ? parsed.blueprints.filter(isPlausibleBlueprint) : [];
    return { blueprints };
  } catch {
    return DEFAULT_BLUEPRINT_LIBRARY_STATE;
  }
}

export function saveBlueprintLibrary(storage: BlueprintLibraryStorage, key: string, state: BlueprintLibraryState): void {
  storage.setItem(key, JSON.stringify(state));
}

/** Every blueprint saved for `classId`, in save order. */
export function blueprintsForClass(state: BlueprintLibraryState, classId: string): LevelUpBlueprint[] {
  return state.blueprints.filter((bp) => bp.classId === classId);
}

/**
 * Add a new blueprint (an id not already in the library) or overwrite an
 * existing one in place (an id that IS already present) — same operation
 * either way, the caller decides which by whatever id it passes.
 */
export function upsertBlueprint(state: BlueprintLibraryState, blueprint: LevelUpBlueprint): BlueprintLibraryState {
  const exists = state.blueprints.some((bp) => bp.id === blueprint.id);
  return {
    blueprints: exists
      ? state.blueprints.map((bp) => (bp.id === blueprint.id ? blueprint : bp))
      : [...state.blueprints, blueprint],
  };
}

/** Removes a blueprint by id. No-ops (returns the same reference) if the id isn't found. */
export function deleteBlueprint(state: BlueprintLibraryState, id: string): BlueprintLibraryState {
  if (!state.blueprints.some((bp) => bp.id === id)) return state;
  return { blueprints: state.blueprints.filter((bp) => bp.id !== id) };
}
