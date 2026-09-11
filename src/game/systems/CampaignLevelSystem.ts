/**
 * CampaignLevelSystem — D-217 (item 3c): a persistent, SHARED campaign
 * level (1-20) for the whole roster — one number, not per-hero. Replaces the
 * per-hero `CharacterBuild.startingLevel` picker's role for campaign mode
 * specifically (Free Play/Create Party keep that manual picker unchanged);
 * every campaign hero — PC and every companion alike — is fielded at
 * whatever `campaignLevel` currently is.
 *
 * Deliberately its OWN small system rather than folded into
 * `CampaignProgressSystem`, mirroring that module's own stated reasoning for
 * staying separate from `BestiarySystem` despite an identical persistence
 * pattern: a campaign level and a completion log are different concerns,
 * even though both are "one small piece of localStorage state." Pure and
 * storage-agnostic, same `CampaignProgressSystem`/`BestiarySystem` shape —
 * no Phaser dependency, unit-testable with a fake in-memory store.
 *
 * Advancing `campaignLevel` is monotonic (`raiseCampaignLevel` never lowers
 * it) — mission-defined level milestones (`ChapterDefinition.levelMilestones`,
 * `LevelMilestoneSystem`) are the only thing that raises it, at chapter-clear,
 * so a mid-chapter loss/quit never locks in a level gain.
 */

import { getCampaignDefinition, totalChapters } from "../data/campaigns";
import { getHighestCompletedChapter, type CampaignProgress } from "./CampaignProgressSystem";

export interface CampaignLevelState {
  campaignLevel: number;
}

export const DEFAULT_CAMPAIGN_LEVEL_STATE: CampaignLevelState = { campaignLevel: 1 };

/** The minimal storage shape CampaignLevelSystem needs — matches window.localStorage. */
export interface CampaignLevelStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read the campaign level from storage, falling back to level 1 on missing
 * or corrupt data — same defensiveness as `CampaignProgressSystem.loadCampaignProgress`.
 */
export function loadCampaignLevel(storage: CampaignLevelStorage, key: string): CampaignLevelState {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_CAMPAIGN_LEVEL_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<CampaignLevelState> | null;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.campaignLevel !== "number" ||
      !Number.isInteger(parsed.campaignLevel) ||
      parsed.campaignLevel < 1
    ) {
      return DEFAULT_CAMPAIGN_LEVEL_STATE;
    }
    return { campaignLevel: Math.min(20, parsed.campaignLevel) };
  } catch {
    return DEFAULT_CAMPAIGN_LEVEL_STATE;
  }
}

export function saveCampaignLevel(storage: CampaignLevelStorage, key: string, state: CampaignLevelState): void {
  storage.setItem(key, JSON.stringify(state));
}

/**
 * Raises `campaignLevel` to `newLevel`, returning a new state object
 * (immutable-style). Returns the SAME object reference, unchanged, when
 * `newLevel` is no higher than the current level — callers can use that
 * reference equality to skip an unnecessary localStorage write, same
 * discipline as `CampaignProgressSystem.markCampaignCompleted`/
 * `markChapterCompleted`.
 */
export function raiseCampaignLevel(state: CampaignLevelState, newLevel: number): CampaignLevelState {
  const clamped = Math.min(20, newLevel);
  if (clamped <= state.campaignLevel) return state;
  return { campaignLevel: clamped };
}

/**
 * D-223 gap 5, reworked by D-253 (Batch H, item 13): a best-effort backfill
 * for a save that predates `campaignLevel` entirely — `loadCampaignLevel`
 * defaults such a save to level 1, which is a real regression for anyone
 * already mid-campaign (their roster would suddenly re-field at level 1
 * despite `CampaignProgress` showing several chapters already cleared).
 *
 * Derives the level the party would ALREADY be at, had `campaignLevel` been
 * tracked from the start, using the SAME "+1 level per chapter clear,
 * order-independent" cadence `chapterLevelMilestones` now grants live: the
 * total count of distinct completed chapters across every id in
 * `regionCampaignIds`, plus the starting level of 1, capped at 20. (Before
 * D-253 this maxed each region's highest-completed chapter's `levelRange[1]`
 * instead — that formula matched the old per-chapter-band leveling model,
 * which no longer exists.) The `Math.min(chapterIndex, totalChapters(def) -
 * 1)` clamp defends a stale save whose recorded chapter index no longer
 * exists after a region's chapter count changed (Emberford Reach's Ch3 cut).
 * Pure — takes progress data in, returns a level out; the caller decides
 * whether/when to apply it (via `raiseCampaignLevel`, which already no-ops
 * if the state doesn't need raising — a fresh save with no completed
 * chapters returns 1, a no-op).
 */
export function highestReachedCampaignLevel(
  progress: CampaignProgress,
  regionCampaignIds: readonly string[],
): number {
  let clearedChapters = 0;
  for (const campaignId of regionCampaignIds) {
    const chapterIndex = getHighestCompletedChapter(progress, campaignId);
    if (chapterIndex < 0) continue;
    const def = getCampaignDefinition(campaignId);
    clearedChapters += Math.min(chapterIndex, totalChapters(def) - 1) + 1;
  }
  return Math.min(20, 1 + clearedChapters);
}
