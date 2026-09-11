import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMPAIGN_LEVEL_STATE,
  loadCampaignLevel,
  saveCampaignLevel,
  raiseCampaignLevel,
  highestReachedCampaignLevel,
  type CampaignLevelStorage,
} from "../src/game/systems/CampaignLevelSystem";
import { DEFAULT_CAMPAIGN_PROGRESS, markChapterCompleted } from "../src/game/systems/CampaignProgressSystem";
import { REGION_CAMPAIGN_IDS } from "../src/game/data/campaigns";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): CampaignLevelStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("CampaignLevelSystem", () => {
  it("loadCampaignLevel returns level 1 when nothing is stored", () => {
    expect(loadCampaignLevel(fakeStorage(), "k")).toEqual(DEFAULT_CAMPAIGN_LEVEL_STATE);
    expect(DEFAULT_CAMPAIGN_LEVEL_STATE.campaignLevel).toBe(1);
  });

  it("loadCampaignLevel returns level 1 on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadCampaignLevel(storage, "k")).toEqual(DEFAULT_CAMPAIGN_LEVEL_STATE);
  });

  it("loadCampaignLevel rejects a non-integer, negative, or missing campaignLevel", () => {
    const storage = fakeStorage();
    for (const bad of ['{"campaignLevel":"5"}', '{"campaignLevel":-1}', '{"campaignLevel":3.5}', "{}"]) {
      storage.setItem("k", bad);
      expect(loadCampaignLevel(storage, "k")).toEqual(DEFAULT_CAMPAIGN_LEVEL_STATE);
    }
  });

  it("loadCampaignLevel clamps a stored value above 20", () => {
    const storage = fakeStorage();
    storage.setItem("k", '{"campaignLevel":999}');
    expect(loadCampaignLevel(storage, "k")).toEqual({ campaignLevel: 20 });
  });

  it("saveCampaignLevel then loadCampaignLevel round-trips", () => {
    const storage = fakeStorage();
    saveCampaignLevel(storage, "k", { campaignLevel: 12 });
    expect(loadCampaignLevel(storage, "k")).toEqual({ campaignLevel: 12 });
  });

  it("raiseCampaignLevel advances to a higher level", () => {
    const result = raiseCampaignLevel({ campaignLevel: 5 }, 8);
    expect(result).toEqual({ campaignLevel: 8 });
  });

  it("raiseCampaignLevel is a same-object-reference no-op when the new level isn't higher", () => {
    const state = { campaignLevel: 8 };
    expect(raiseCampaignLevel(state, 8)).toBe(state);
    expect(raiseCampaignLevel(state, 3)).toBe(state);
  });

  it("raiseCampaignLevel never exceeds 20", () => {
    expect(raiseCampaignLevel({ campaignLevel: 18 }, 999)).toEqual({ campaignLevel: 20 });
  });

  // D-223 gap 5: the backfill for a save that predates campaignLevel.
  describe("highestReachedCampaignLevel", () => {
    it("returns 1 for a fresh progress state with nothing completed", () => {
      expect(highestReachedCampaignLevel(DEFAULT_CAMPAIGN_PROGRESS, REGION_CAMPAIGN_IDS)).toBe(1);
    });

    // D-253 (Batch H, item 13): the backfill now counts distinct completed
    // chapters (the new "+1 level per chapter clear" cadence), not each
    // region's old fixed `levelRange[1]` band — that formula belonged to a
    // leveling model this batch replaced.
    it("grants 1 + the number of chapters completed so far", () => {
      // Chapter 1 (index 0) of Emberford Reach — 1 chapter cleared.
      const progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach", 0);
      expect(highestReachedCampaignLevel(progress, REGION_CAMPAIGN_IDS)).toBe(2);
    });

    it("sums cleared chapters across multiple regions, regardless of play order", () => {
      // Emberford Reach Ch1-2 (index 1 = highest, 2 chapters) + Saltmere
      // Shallows Ch1-4 (index 3 = highest, 4 chapters) = 6 chapters cleared.
      let progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach", 1);
      progress = markChapterCompleted(progress, "saltmere-shallows", 3);
      expect(highestReachedCampaignLevel(progress, REGION_CAMPAIGN_IDS)).toBe(7);
    });

    it("ignores a campaign id outside the given region list", () => {
      const progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach", 2);
      expect(highestReachedCampaignLevel(progress, ["saltmere-shallows"])).toBe(1);
    });

    it("clamps a stale recorded chapter index that no longer exists after a region's chapter count changed", () => {
      // Emberford Reach only has 3 chapters (indices 0-2) post-D-253 — a save
      // recorded against the old 4-chapter shape (index 3) should count as
      // "cleared every chapter this region has now" rather than over-count.
      const progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach", 3);
      expect(highestReachedCampaignLevel(progress, REGION_CAMPAIGN_IDS)).toBe(4);
    });
  });
});
