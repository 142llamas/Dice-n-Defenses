/**
 * CompanionRosterSystem — recruit/bench/lose state for the companion catalog
 * (D-118, engine scaffolding for `CAMPAIGN_STORY_DESIGN.md` §6).
 *
 * Pure and storage-agnostic, same pattern as `CampaignProgressSystem`/
 * `WorldFlagSystem`: never touches `window.localStorage` directly, works
 * purely on companion ID strings (see `data/companions.ts`'s
 * `CompanionDefinition`, currently an empty catalogue — this system doesn't
 * need real companion content to be correct, only real ids to be passed in).
 *
 * `CAMPAIGN_STORY_DESIGN.md` §6: party size is fixed at 4 (1 PC + 3 active
 * companions) in `CharacterCreationScene`'s own `MAX_PARTY_SIZE`. Because the
 * party is always full from Region 1 Ch1 onward, every recruitment past the
 * opening trio is inherently a bench decision — there's no such thing as a
 * free slot. This system models exactly three states a companion can be in:
 * **active** (currently in the 3-companion bench), **benched** (recruited,
 * available, not currently active), and **lost** (permanently removed —
 * §6's Sorrel Thane "Lost" outcome: can never be recruited or activated
 * again). A companion not yet recruited is simply absent from all three
 * lists.
 */

export interface CompanionRosterState {
  activeIds: string[];
  benchedIds: string[];
  lostIds: string[];
}

export const DEFAULT_COMPANION_ROSTER_STATE: CompanionRosterState = {
  activeIds: [],
  benchedIds: [],
  lostIds: [],
};

/** 1 PC + 3 active companions = the existing hardcoded MAX_PARTY_SIZE (CharacterCreationScene.ts). */
export const MAX_ACTIVE_COMPANIONS = 3;

/** The minimal storage shape CompanionRosterSystem needs — matches window.localStorage. */
export interface CompanionRosterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isValidIdArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string");
}

/**
 * Read roster state from storage, falling back to the default (nobody
 * recruited) state on missing or corrupt data — same defensiveness as
 * `loadCampaignProgress`/`loadWorldFlags`. A malformed individual list
 * (wrong type) falls back to empty rather than failing the whole load.
 */
export function loadCompanionRoster(storage: CompanionRosterStorage, key: string): CompanionRosterState {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_COMPANION_ROSTER_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<CompanionRosterState> | null;
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_COMPANION_ROSTER_STATE;
    return {
      activeIds: isValidIdArray(parsed.activeIds) ? parsed.activeIds : [],
      benchedIds: isValidIdArray(parsed.benchedIds) ? parsed.benchedIds : [],
      lostIds: isValidIdArray(parsed.lostIds) ? parsed.lostIds : [],
    };
  } catch {
    return DEFAULT_COMPANION_ROSTER_STATE;
  }
}

export function saveCompanionRoster(
  storage: CompanionRosterStorage,
  key: string,
  state: CompanionRosterState,
): void {
  storage.setItem(key, JSON.stringify(state));
}

export function isCompanionActive(state: CompanionRosterState, companionId: string): boolean {
  return state.activeIds.includes(companionId);
}

export function isCompanionBenched(state: CompanionRosterState, companionId: string): boolean {
  return state.benchedIds.includes(companionId);
}

export function isCompanionLost(state: CompanionRosterState, companionId: string): boolean {
  return state.lostIds.includes(companionId);
}

/** True if this companion has ever been recruited (active or benched), regardless of current slot. */
export function isCompanionRecruited(state: CompanionRosterState, companionId: string): boolean {
  return isCompanionActive(state, companionId) || isCompanionBenched(state, companionId);
}

/**
 * Recruit a new companion: fills an active slot if one is free (fewer than
 * `MAX_ACTIVE_COMPANIONS` active), otherwise joins the bench. Throws if
 * `companionId` was permanently lost (§6: a "Lost" companion can never be
 * recruited again) — this is a logic error for a caller to attempt, not a
 * normal outcome to no-op through. Returns the SAME object reference
 * (no-op) if already recruited, active or benched.
 */
export function recruitCompanion(state: CompanionRosterState, companionId: string): CompanionRosterState {
  if (isCompanionLost(state, companionId)) {
    throw new Error(`Cannot recruit "${companionId}": permanently lost.`);
  }
  if (isCompanionRecruited(state, companionId)) return state;
  if (state.activeIds.length < MAX_ACTIVE_COMPANIONS) {
    return { ...state, activeIds: [...state.activeIds, companionId] };
  }
  return { ...state, benchedIds: [...state.benchedIds, companionId] };
}

/**
 * Move an active companion to the bench (a story-forced swap, or the player
 * choosing to bench someone to make room). Throws if `companionId` isn't
 * currently active or was permanently lost — both are logic errors, not
 * normal no-ops. Returns the SAME object reference if already benched.
 */
export function benchCompanion(state: CompanionRosterState, companionId: string): CompanionRosterState {
  if (isCompanionLost(state, companionId)) {
    throw new Error(`Cannot bench "${companionId}": permanently lost.`);
  }
  if (isCompanionBenched(state, companionId)) return state;
  if (!isCompanionActive(state, companionId)) {
    throw new Error(`Cannot bench "${companionId}": not currently active.`);
  }
  return {
    ...state,
    activeIds: state.activeIds.filter((id) => id !== companionId),
    benchedIds: [...state.benchedIds, companionId],
  };
}

/**
 * Move a benched companion into an active slot. Throws if the active roster
 * is already full (the caller must bench someone else first — this system
 * deliberately never auto-benches on a caller's behalf, since which
 * companion to displace is exactly the kind of choice
 * `CAMPAIGN_STORY_DESIGN.md` §6 says should sometimes be offered to the
 * player, not decided for them), if `companionId` isn't currently benched,
 * or if it was permanently lost. Returns the SAME object reference if
 * already active.
 */
export function activateCompanion(state: CompanionRosterState, companionId: string): CompanionRosterState {
  if (isCompanionLost(state, companionId)) {
    throw new Error(`Cannot activate "${companionId}": permanently lost.`);
  }
  if (isCompanionActive(state, companionId)) return state;
  if (!isCompanionBenched(state, companionId)) {
    throw new Error(`Cannot activate "${companionId}": not currently benched.`);
  }
  if (state.activeIds.length >= MAX_ACTIVE_COMPANIONS) {
    throw new Error(`Cannot activate "${companionId}": active roster is full (bench someone first).`);
  }
  return {
    ...state,
    benchedIds: state.benchedIds.filter((id) => id !== companionId),
    activeIds: [...state.activeIds, companionId],
  };
}

/**
 * Permanently remove a companion (§6's "Lost" outcome) — cleared from
 * active/benched and added to `lostIds`, never recruitable or activatable
 * again. Returns the SAME object reference if already lost (idempotent, so
 * a branch-resolution step can call this unconditionally without checking
 * first).
 */
export function loseCompanion(state: CompanionRosterState, companionId: string): CompanionRosterState {
  if (isCompanionLost(state, companionId)) return state;
  return {
    activeIds: state.activeIds.filter((id) => id !== companionId),
    benchedIds: state.benchedIds.filter((id) => id !== companionId),
    lostIds: [...state.lostIds, companionId],
  };
}
