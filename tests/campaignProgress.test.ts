import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMPAIGN_PROGRESS,
  isCampaignCompleted,
  loadCampaignProgress,
  markCampaignCompleted,
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
});
