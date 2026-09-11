/**
 * CampaignGoldSystem — `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` Plan 1: a
 * persistent, SHARED campaign gold balance (one number for the whole
 * roster, same "shared, not per-hero" shape as `CampaignLevelSystem`'s
 * `campaignLevel`), replacing the campaign PC's old point-buy "Gear Points"
 * budget — fully retired by Plan 5 (D-246), which gave the PC a fixed
 * per-class starting kit instead (`data/characterCreation.ts`'s
 * `defaultStartingGearForClass`); `DifficultyDefinition.startingGearPoints`
 * no longer exists.
 *
 * Deliberately its own small system rather than folded into
 * `CampaignProgressSystem`/`CampaignLevelSystem`, matching this project's
 * established "one system, one job" convention (see those two files' own
 * header comments for the identical reasoning). Pure and storage-agnostic
 * — no Phaser dependency, unit-testable with a fake in-memory store; a
 * scene wires it to the real `localStorage` via `CampaignGoldStorage`.
 *
 * No backfill function for a pre-existing save, unlike
 * `CampaignLevelSystem.highestReachedCampaignLevel` — confirmed with Kevin
 * (see the plan doc's "Open questions" section): a mid-campaign save that
 * predates this system has no recorded gold-earning history to reconstruct
 * from, so it simply starts at the same flat default a fresh campaign
 * would.
 *
 * Plan 3 (the between-missions Armory): `starterGrantClaimed` tracks
 * whether the one-time `startingCampaignGold` kit (per difficulty,
 * `data/difficulty.ts`) has already been granted, so a player who spends it
 * all down to 0 gold doesn't get re-granted a fresh kit on their next
 * Armory visit — see `grantStartingCampaignGoldIfNeeded`.
 */

export interface CampaignGoldState {
  gold: number;
  starterGrantClaimed: boolean;
}

export const DEFAULT_CAMPAIGN_GOLD_STATE: CampaignGoldState = { gold: 0, starterGrantClaimed: false };

/** The minimal storage shape CampaignGoldSystem needs — matches window.localStorage. */
export interface CampaignGoldStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read the campaign gold balance from storage, falling back to the flat
 * default on missing or corrupt data — same defensiveness as
 * `CampaignLevelSystem.loadCampaignLevel`/`CampaignProgressSystem.loadCampaignProgress`.
 */
export function loadCampaignGold(storage: CampaignGoldStorage, key: string): CampaignGoldState {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_CAMPAIGN_GOLD_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<CampaignGoldState> | null;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.gold !== "number" ||
      !Number.isFinite(parsed.gold) ||
      parsed.gold < 0
    ) {
      return DEFAULT_CAMPAIGN_GOLD_STATE;
    }
    // starterGrantClaimed is new since this field's introduction — absent
    // (a blob saved before this session) or non-boolean both mean "not yet
    // claimed," same read-time-migration spirit as this project's other
    // additive-field systems.
    return { gold: Math.floor(parsed.gold), starterGrantClaimed: parsed.starterGrantClaimed === true };
  } catch {
    return DEFAULT_CAMPAIGN_GOLD_STATE;
  }
}

export function saveCampaignGold(storage: CampaignGoldStorage, key: string, state: CampaignGoldState): void {
  storage.setItem(key, JSON.stringify(state));
}

/**
 * Credit `amount` gold (a kill/wave reward, a region bonus — see the plan
 * doc's Plan 2). Returns a new state object (immutable-style, matching
 * `CampaignLevelSystem`/`CampaignProgressSystem`'s own mutators); returns
 * the SAME reference, unchanged, for a zero amount, so a caller can use
 * `===` to skip an unnecessary `saveCampaignGold` write.
 */
export function earnCampaignGold(state: CampaignGoldState, amount: number): CampaignGoldState {
  if (amount < 0) throw new Error("Cannot earn a negative amount.");
  if (amount === 0) return state;
  return { ...state, gold: state.gold + Math.floor(amount) };
}

/** True if the current balance covers `amount` gold. */
export function canAffordCampaignGold(state: CampaignGoldState, amount: number): boolean {
  return state.gold >= amount;
}

/** The outcome of attempting to spend campaign gold. */
export interface SpendCampaignGoldResult {
  /** True if the balance covered `amount` and it was deducted. */
  ok: boolean;
  state: CampaignGoldState;
}

/**
 * Spend `amount` gold (the between-missions Armory — see the plan doc's
 * Plan 3). Deducts and reports success ONLY if the balance covers it;
 * otherwise returns the SAME state reference, unchanged, and `ok: false` —
 * same "never half-applies a purchase" discipline as `EconomySystem.spend`,
 * adapted to this system's immutable-state shape.
 */
export function spendCampaignGold(state: CampaignGoldState, amount: number): SpendCampaignGoldResult {
  if (amount < 0) throw new Error("Cannot spend a negative amount.");
  if (!canAffordCampaignGold(state, amount)) return { ok: false, state };
  if (amount === 0) return { ok: true, state };
  return { ok: true, state: { ...state, gold: state.gold - amount } };
}

/**
 * Plan 3: grant the one-time `startingCampaignGold` kit (per difficulty),
 * the first time this is called for a given persisted state — a no-op
 * (SAME state reference) on every call after that, so a player who spends
 * their kit down to 0 gold before their next Armory visit doesn't get
 * re-granted a fresh one. The "Reset Campaign Progress" button already
 * resets this flag to `false` alongside everything else it wipes.
 */
export function grantStartingCampaignGoldIfNeeded(state: CampaignGoldState, amount: number): CampaignGoldState {
  if (state.starterGrantClaimed) return state;
  return { gold: state.gold + Math.floor(amount), starterGrantClaimed: true };
}

/**
 * Plan 2: credit a difficulty-scaled amount — `rawAmount` (gross kill/wave/
 * region-bonus gold earned in one battle, BEFORE any multiplier) times this
 * difficulty's `campaignGoldMultiplier`, floored. Delegates to
 * `earnCampaignGold` for the actual credit (and its same-reference
 * no-op-on-zero/negative-throws behavior) — this function's only job is
 * the scaling arithmetic, kept as its own small, independently-testable
 * step rather than inlined at each of Plan 2's call sites.
 */
export function creditScaledCampaignGold(state: CampaignGoldState, rawAmount: number, multiplier: number): CampaignGoldState {
  return earnCampaignGold(state, Math.floor(rawAmount * multiplier));
}
