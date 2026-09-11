import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMPAIGN_GOLD_STATE,
  loadCampaignGold,
  saveCampaignGold,
  earnCampaignGold,
  canAffordCampaignGold,
  spendCampaignGold,
  grantStartingCampaignGoldIfNeeded,
  creditScaledCampaignGold,
  type CampaignGoldStorage,
} from "../src/game/systems/CampaignGoldSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): CampaignGoldStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("CampaignGoldSystem", () => {
  it("loadCampaignGold returns the flat default when nothing is stored", () => {
    expect(loadCampaignGold(fakeStorage(), "k")).toEqual(DEFAULT_CAMPAIGN_GOLD_STATE);
    expect(DEFAULT_CAMPAIGN_GOLD_STATE.gold).toBe(0);
    expect(DEFAULT_CAMPAIGN_GOLD_STATE.starterGrantClaimed).toBe(false);
  });

  it("loadCampaignGold returns the default on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadCampaignGold(storage, "k")).toEqual(DEFAULT_CAMPAIGN_GOLD_STATE);
  });

  it("loadCampaignGold rejects a non-numeric, negative, or missing gold field", () => {
    const storage = fakeStorage();
    for (const bad of ['{"gold":"5"}', '{"gold":-1}', "{}", '{"gold":null}']) {
      storage.setItem("k", bad);
      expect(loadCampaignGold(storage, "k")).toEqual(DEFAULT_CAMPAIGN_GOLD_STATE);
    }
  });

  it("loadCampaignGold floors a fractional stored value", () => {
    const storage = fakeStorage();
    storage.setItem("k", '{"gold":42.9,"starterGrantClaimed":true}');
    expect(loadCampaignGold(storage, "k")).toEqual({ gold: 42, starterGrantClaimed: true });
  });

  it("loadCampaignGold treats an absent starterGrantClaimed as false (back-compat with a D-242 blob)", () => {
    const storage = fakeStorage();
    storage.setItem("k", '{"gold":50}');
    expect(loadCampaignGold(storage, "k")).toEqual({ gold: 50, starterGrantClaimed: false });
  });

  it("saveCampaignGold then loadCampaignGold round-trips", () => {
    const storage = fakeStorage();
    saveCampaignGold(storage, "k", { gold: 75, starterGrantClaimed: true });
    expect(loadCampaignGold(storage, "k")).toEqual({ gold: 75, starterGrantClaimed: true });
  });

  describe("earnCampaignGold", () => {
    it("adds to the balance", () => {
      expect(earnCampaignGold({ gold: 10, starterGrantClaimed: true }, 15)).toEqual({ gold: 25, starterGrantClaimed: true });
    });

    it("is a same-object-reference no-op for a zero amount", () => {
      const state = { gold: 10, starterGrantClaimed: false };
      expect(earnCampaignGold(state, 0)).toBe(state);
    });

    it("throws on a negative amount", () => {
      expect(() => earnCampaignGold({ gold: 10, starterGrantClaimed: false }, -5)).toThrow();
    });

    it("floors a fractional amount", () => {
      expect(earnCampaignGold({ gold: 10, starterGrantClaimed: false }, 5.9)).toEqual({ gold: 15, starterGrantClaimed: false });
    });
  });

  describe("canAffordCampaignGold", () => {
    it("is true when the balance covers the amount, false otherwise", () => {
      expect(canAffordCampaignGold({ gold: 50, starterGrantClaimed: false }, 50)).toBe(true);
      expect(canAffordCampaignGold({ gold: 50, starterGrantClaimed: false }, 51)).toBe(false);
    });
  });

  describe("spendCampaignGold", () => {
    it("deducts and reports ok:true when the balance covers it", () => {
      const result = spendCampaignGold({ gold: 50, starterGrantClaimed: true }, 30);
      expect(result).toEqual({ ok: true, state: { gold: 20, starterGrantClaimed: true } });
    });

    it("reports ok:false and returns the SAME state reference when unaffordable", () => {
      const state = { gold: 10, starterGrantClaimed: false };
      const result = spendCampaignGold(state, 11);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
    });

    it("is a same-object-reference no-op for a zero amount", () => {
      const state = { gold: 10, starterGrantClaimed: false };
      const result = spendCampaignGold(state, 0);
      expect(result).toEqual({ ok: true, state });
      expect(result.state).toBe(state);
    });

    it("throws on a negative amount", () => {
      expect(() => spendCampaignGold({ gold: 10, starterGrantClaimed: false }, -5)).toThrow();
    });
  });

  describe("grantStartingCampaignGoldIfNeeded", () => {
    it("grants the amount and marks the flag claimed on first call", () => {
      const result = grantStartingCampaignGoldIfNeeded({ gold: 0, starterGrantClaimed: false }, 70);
      expect(result).toEqual({ gold: 70, starterGrantClaimed: true });
    });

    it("adds on top of any existing balance", () => {
      const result = grantStartingCampaignGoldIfNeeded({ gold: 15, starterGrantClaimed: false }, 70);
      expect(result).toEqual({ gold: 85, starterGrantClaimed: true });
    });

    it("is a same-object-reference no-op once already claimed, even at 0 gold", () => {
      const state = { gold: 0, starterGrantClaimed: true };
      expect(grantStartingCampaignGoldIfNeeded(state, 70)).toBe(state);
    });
  });

  describe("creditScaledCampaignGold", () => {
    it("scales the raw amount by the multiplier before crediting", () => {
      const state = { gold: 10, starterGrantClaimed: true };
      expect(creditScaledCampaignGold(state, 100, 1.25)).toEqual({ gold: 135, starterGrantClaimed: true });
    });

    it("floors a fractional scaled result", () => {
      const state = { gold: 0, starterGrantClaimed: false };
      expect(creditScaledCampaignGold(state, 100, 0.75)).toEqual({ gold: 75, starterGrantClaimed: false });
      expect(creditScaledCampaignGold({ gold: 0, starterGrantClaimed: false }, 33, 0.5)).toEqual({
        gold: 16,
        starterGrantClaimed: false,
      });
    });

    it("applies a 1x multiplier as a plain pass-through", () => {
      const state = { gold: 5, starterGrantClaimed: false };
      expect(creditScaledCampaignGold(state, 40, 1)).toEqual({ gold: 45, starterGrantClaimed: false });
    });

    it("is a same-object-reference no-op when the scaled result floors to 0", () => {
      const state = { gold: 5, starterGrantClaimed: false };
      expect(creditScaledCampaignGold(state, 1, 0.4)).toBe(state);
    });

    it("is a same-object-reference no-op for a zero raw amount", () => {
      const state = { gold: 5, starterGrantClaimed: false };
      expect(creditScaledCampaignGold(state, 0, 1.25)).toBe(state);
    });
  });
});
