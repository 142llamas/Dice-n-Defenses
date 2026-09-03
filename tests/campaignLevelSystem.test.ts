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

    it("maps a completed chapter to that chapter's own levelRange[1]", () => {
      // Chapter 1 (index 0) of any region is levelRange [1, 5].
      const progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach", 0);
      expect(highestReachedCampaignLevel(progress, REGION_CAMPAIGN_IDS)).toBe(5);
    });

    it("takes the max across multiple regions, regardless of play order", () => {
      let progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach", 1); // levelRange [6, 10]
      progress = markChapterCompleted(progress, "saltmere-shallows", 3); // levelRange [16, 20]
      expect(highestReachedCampaignLevel(progress, REGION_CAMPAIGN_IDS)).toBe(20);
    });

    it("ignores a campaign id outside the given region list", () => {
      const progress = markChapterCompleted(DEFAULT_CAMPAIGN_PROGRESS, "emberford-reach", 3); // levelRange [16, 20]
      expect(highestReachedCampaignLevel(progress, ["saltmere-shallows"])).toBe(1);
    });
  });
});
