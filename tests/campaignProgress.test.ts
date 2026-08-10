import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMPAIGN_PROGRESS,
  getHighestCompletedChapter,
  isCampaignCompleted,
  isChapterCompleted,
  loadCampaignProgress,
  markCampaignCompleted,
  markChapterCompleted,
  saveCampaignProgress,
  type CampaignProgressStorage,
} from "../src/game/systems/CampaignProgressSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): CampaignProgressStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("CampaignProgressSystem", () => {
  it("loadCampaignProgress returns an empty (nothing-completed) state when nothing is stored", () => {
    expect(loadCampaignProgress(fakeStorage(), "k")).toEqual(DEFAULT_CAMPAIGN_PROGRESS);
  });

  it("loadCampaignProgress returns an empty state on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadCampaignProgress(storage, "k")).toEqual(DEFAULT_CAMPAIGN_PROGRESS);
  });

  it("loadCampaignProgress drops individually corrupt entries instead of failing the whole load", () => {
    const storage = fakeStorage();
    storage.setItem(
      "k",
      JSON.stringify({ completedIds: { "emberford-reach": true, garbage: "yes" } }),
    );
    const progress = loadCampaignProgress(storage, "k");
    expect(isCampaignCompleted(progress, "emberford-reach")).toBe(true);
    expect(isCampaignCompleted(progress, "garbage")).toBe(false);
  });

  it("marking a campaign completed records it as completed", () => {
    const progress = markCampaignCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach");
    expect(isCampaignCompleted(progress, "emberford-reach")).toBe(true);
  });

  it("marking completed twice returns the same object reference (no-op, avoids a redundant save)", () => {
    const once = markCampaignCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach");
    const twice = markCampaignCompleted(once, "emberford-reach");
    expect(twice).toBe(once);
  });

  it("does not mutate the progress object passed in", () => {
    const original = markCampaignCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach");
    const updated = markCampaignCompleted(original, "saltmere-shallows");
    expect(isCampaignCompleted(original, "saltmere-shallows")).toBe(false);
    expect(isCampaignCompleted(updated, "emberford-reach")).toBe(true);
    expect(isCampaignCompleted(updated, "saltmere-shallows")).toBe(true);
  });

  it("saveCampaignProgress then loadCampaignProgress round-trips", () => {
    const storage = fakeStorage();
    let progress = markCampaignCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach");
    progress = markCampaignCompleted(progress, "saltmere-shallows");
    saveCampaignProgress(storage, "k", progress);
    const loaded = loadCampaignProgress(storage, "k");
    expect(loaded).toEqual(progress);
    expect(isCampaignCompleted(loaded, "emberford-reach")).toBe(true);
    expect(isCampaignCompleted(loaded, "saltmere-shallows")).toBe(true);
  });

  it("an unmentioned campaign id is reported as not completed", () => {
    const progress = markCampaignCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach");
    expect(isCampaignCompleted(progress, "saltmere-shallows")).toBe(false);
  });

  // D-118 — per-chapter completion tracking for CAMPAIGN_STORY_DESIGN.md's
  // "region" structure.
  describe("chapter completion (D-118)", () => {
    it("a campaign with no chapters completed reports -1 / not completed", () => {
      expect(getHighestCompletedChapter(DEFAULT_CAMPAIGN_PROGRESS, "test-region")).toBe(-1);
      expect(isChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "test-region", 0)).toBe(false);
    });

    it("marking chapter 0 completed makes it (and only it) reported completed", () => {
      const progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "test-region", 0);
      expect(getHighestCompletedChapter(progress, "test-region")).toBe(0);
      expect(isChapterCompleted(progress, "test-region", 0)).toBe(true);
      expect(isChapterCompleted(progress, "test-region", 1)).toBe(false);
    });

    it("completing a later chapter reports every earlier chapter as completed too", () => {
      const progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "test-region", 2);
      expect(isChapterCompleted(progress, "test-region", 0)).toBe(true);
      expect(isChapterCompleted(progress, "test-region", 1)).toBe(true);
      expect(isChapterCompleted(progress, "test-region", 2)).toBe(true);
      expect(isChapterCompleted(progress, "test-region", 3)).toBe(false);
    });

    it("re-marking an already-covered (or earlier) chapter is a same-reference no-op", () => {
      const afterCh2 = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "test-region", 2);
      const again = markChapterCompleted(afterCh2, "test-region", 2);
      expect(again).toBe(afterCh2);
      const earlier = markChapterCompleted(afterCh2, "test-region", 0);
      expect(earlier).toBe(afterCh2);
    });

    it("chapter progress is tracked independently per campaign id", () => {
      let progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "region-a", 1);
      progress = markChapterCompleted(progress, "region-b", 3);
      expect(getHighestCompletedChapter(progress, "region-a")).toBe(1);
      expect(getHighestCompletedChapter(progress, "region-b")).toBe(3);
    });

    it("does not mutate the progress object passed in", () => {
      const original = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "region-a", 0);
      markChapterCompleted(original, "region-a", 2);
      expect(getHighestCompletedChapter(original, "region-a")).toBe(0);
    });

    it("chapter completion and whole-campaign completion are tracked independently", () => {
      let progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "region-a", 1);
      expect(isCampaignCompleted(progress, "region-a")).toBe(false);
      progress = markCampaignCompleted(progress, "region-a");
      expect(isCampaignCompleted(progress, "region-a")).toBe(true);
      expect(getHighestCompletedChapter(progress, "region-a")).toBe(1);
    });

    it("saveCampaignProgress then loadCampaignProgress round-trips chapter completion", () => {
      const storage = fakeStorage();
      let progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "region-a", 2);
      progress = markCampaignCompleted(progress, "emberford-reach");
      saveCampaignProgress(storage, "k", progress);
      const loaded = loadCampaignProgress(storage, "k");
      expect(loaded).toEqual(progress);
      expect(getHighestCompletedChapter(loaded, "region-a")).toBe(2);
      expect(isCampaignCompleted(loaded, "emberford-reach")).toBe(true);
    });

    it("loads a pre-D-118 blob with no completedChapters field as an empty chapter-progress map", () => {
      const storage = fakeStorage();
      storage.setItem("k", JSON.stringify({ completedIds: { "emberford-reach": true } }));
      const loaded = loadCampaignProgress(storage, "k");
      expect(isCampaignCompleted(loaded, "emberford-reach")).toBe(true);
      expect(getHighestCompletedChapter(loaded, "emberford-reach")).toBe(-1);
    });

    it("drops corrupt completedChapters entries (wrong type, negative) instead of failing the whole load", () => {
      const storage = fakeStorage();
      storage.setItem(
        "k",
        JSON.stringify({
          completedIds: {},
          completedChapters: { "region-a": 2, "region-b": "not-a-number", "region-c": -1 },
        }),
      );
      const loaded = loadCampaignProgress(storage, "k");
      expect(getHighestCompletedChapter(loaded, "region-a")).toBe(2);
      expect(getHighestCompletedChapter(loaded, "region-b")).toBe(-1);
      expect(getHighestCompletedChapter(loaded, "region-c")).toBe(-1);
    });
  });
});
