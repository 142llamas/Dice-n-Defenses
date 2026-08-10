/**
 * CampaignProgressSystem — persistent campaign-completion log (Phase 11.8,
 * D-071).
 *
 * Pure and storage-agnostic, mirroring BestiarySystem's exact pattern (which
 * itself mirrors SettingsSystem): this module never touches
 * `window.localStorage` directly, so it stays unit-testable with a fake
 * in-memory store, the same "no Phaser dependency" discipline every other
 * system in this folder follows. A scene wires it to the real
 * `localStorage` via the tiny `CampaignProgressStorage` shape (identical in
 * spirit to BestiarySystem's `BestiaryStorage`).
 *
 * Deliberately its OWN small system rather than folded into BestiarySystem —
 * a campaign completion and an enemy-seen/killed flag are different
 * concerns, even though the persistence mechanism is identical (this
 * project's existing "one system, one job" convention: SettingsSystem and
 * BestiarySystem already stay separate despite sharing the same
 * localStorage pattern).
 *
 * Tracks, per campaign DEFINITION id (see `data/campaigns.ts`), whether the
 * player has completed it at least once. `CampaignSelectScene` reads this to
 * show a "completed" tag. `isCampaignCompleted` is the ONE exported query
 * function Phase 11.9 (free-play unlock gating, NOT this sub-phase's job)
 * will need to read from — kept clean and reusable rather than a buried
 * implementation detail.
 *
 * D-118 (engine scaffolding for CAMPAIGN_STORY_DESIGN.md's "region"
 * structure): also tracks, per chaptered campaign id, the highest 0-based
 * chapter index completed so far (`completedChapters`). A flat campaign
 * (`data/campaigns.ts`'s `ChapterDefinition`-less campaigns, e.g. today's
 * Emberford Reach/Saltmere Shallows) never gets an entry here — it uses
 * `completedIds` alone, unchanged. This field is additive and optional in
 * stored data, so an old `localStorage` blob saved before D-118 still loads
 * cleanly (see `loadCampaignProgress`).
 */

export interface CampaignProgress {
  completedIds: Record<string, boolean>;
  completedChapters: Record<string, number>;
}

export const DEFAULT_CAMPAIGN_PROGRESS: CampaignProgress = {
  completedIds: {},
  completedChapters: {},
};

/** The minimal storage shape CampaignProgressSystem needs — matches window.localStorage. */
export interface CampaignProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read progress from storage, falling back to an empty (nothing-completed)
 * state on missing or corrupt data — same defensiveness as
 * `BestiarySystem.loadBestiaryProgress`. Any individual corrupt entry is
 * dropped rather than failing the whole load, so one bad key can't wipe
 * unrelated progress.
 */
export function loadCampaignProgress(
  storage: CampaignProgressStorage,
  key: string,
): CampaignProgress {
  const raw = storage.getItem(key);
  if (!raw) return DEFAULT_CAMPAIGN_PROGRESS;
  try {
    const parsed = JSON.parse(raw) as Partial<CampaignProgress> | null;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.completedIds !== "object" ||
      parsed.completedIds === null
    ) {
      return DEFAULT_CAMPAIGN_PROGRESS;
    }
    const completedIds: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(parsed.completedIds)) {
      if (value === true) completedIds[id] = true;
    }
    // completedChapters is new in D-118 — absent entirely in any blob saved
    // before this decision, so its absence (rather than corruption) is the
    // common case, not just a defensive edge case.
    const completedChapters: Record<string, number> = {};
    if (typeof parsed.completedChapters === "object" && parsed.completedChapters !== null) {
      for (const [id, value] of Object.entries(parsed.completedChapters)) {
        if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
          completedChapters[id] = value;
        }
      }
    }
    return { completedIds, completedChapters };
  } catch {
    return DEFAULT_CAMPAIGN_PROGRESS;
  }
}

export function saveCampaignProgress(
  storage: CampaignProgressStorage,
  key: string,
  progress: CampaignProgress,
): void {
  storage.setItem(key, JSON.stringify(progress));
}

/**
 * Mark a campaign as COMPLETED, returning a new progress object
 * (immutable-style, matching this project's other pure systems). Returns
 * the SAME object reference, unchanged, when the campaign was already
 * completed — callers can use that reference equality to skip an
 * unnecessary localStorage write.
 */
export function markCampaignCompleted(
  progress: CampaignProgress,
  campaignId: string,
): CampaignProgress {
  if (progress.completedIds[campaignId]) return progress;
  return {
    ...progress,
    completedIds: { ...progress.completedIds, [campaignId]: true },
  };
}

export function isCampaignCompleted(progress: CampaignProgress, campaignId: string): boolean {
  return progress.completedIds[campaignId] ?? false;
}

/** -1 means no chapter of this campaign has been completed yet. */
export function getHighestCompletedChapter(progress: CampaignProgress, campaignId: string): number {
  return progress.completedChapters[campaignId] ?? -1;
}

export function isChapterCompleted(
  progress: CampaignProgress,
  campaignId: string,
  chapterIndex: number,
): boolean {
  return getHighestCompletedChapter(progress, campaignId) >= chapterIndex;
}

/**
 * Record chapter `chapterIndex` of `campaignId` as completed. Only ever
 * moves the highest-completed marker forward — same same-object-reference
 * no-op discipline as `markCampaignCompleted` when `chapterIndex` is already
 * covered (completing chapter 1 again, or completing chapter 1 after
 * chapter 3 is already recorded, are both no-ops), so callers can use `===`
 * to skip a redundant `saveCampaignProgress` write.
 */
export function markChapterCompleted(
  progress: CampaignProgress,
  campaignId: string,
  chapterIndex: number,
): CampaignProgress {
  if (getHighestCompletedChapter(progress, campaignId) >= chapterIndex) return progress;
  return {
    ...progress,
    completedChapters: { ...progress.completedChapters, [campaignId]: chapterIndex },
  };
}
