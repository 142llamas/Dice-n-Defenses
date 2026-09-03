import { describe, expect, it } from "vitest";
import { REGION_BONUS_POOLS, getRegionBonusPool, type RegionBonusOption } from "../src/game/data/regionBonuses";
import { drawRegionBonusChoices } from "../src/game/systems/RegionBonusSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { CAMPAIGNS, PROLOGUE_CAMPAIGN_ID, NAMELESS_THRONE_CAMPAIGN_ID } from "../src/game/data/campaigns";
import { getEquipmentDefinition } from "../src/game/data/equipment";
import { getStructureDefinition } from "../src/game/data/structures";

/**
 * D-181 (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §8) — the pre-region
 * bonus-choice pools and the random-draw-3 rule that picks from them.
 */

describe("REGION_BONUS_POOLS", () => {
  it("every real region campaign has its own bonus pool", () => {
    // D-184: The Proving Ground (the new one-time prologue mission)
    // deliberately has no curated pool — `BattleScene.showRegionBonusChoiceIfAny`
    // already no-ops safely on a missing pool, same as Free Play/the classic
    // flat campaign always did before any region had one.
    // D-188: the capstone deliberately has no bonus screen either (this
    // session's own scoping call, CAMPAIGN_STORY_DESIGN.md §8's own "not
    // decided yet" left open) — same no-op safety.
    for (const campaign of CAMPAIGNS) {
      if (campaign.id === PROLOGUE_CAMPAIGN_ID || campaign.id === NAMELESS_THRONE_CAMPAIGN_ID) continue;
      expect(REGION_BONUS_POOLS[campaign.id]).toBeDefined();
      expect(REGION_BONUS_POOLS[campaign.id].length).toBeGreaterThanOrEqual(3);
    }
  });

  it("getRegionBonusPool retrieves a known pool and throws on an unknown id", () => {
    expect(getRegionBonusPool("emberford-reach").length).toBeGreaterThan(0);
    expect(() => getRegionBonusPool("nonexistent")).toThrow();
  });

  it("every option id is globally unique", () => {
    const allIds = Object.values(REGION_BONUS_POOLS)
      .flat()
      .map((o) => o.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("every pool covers all three categories at least once (D-217 dropped 'xp')", () => {
    for (const [campaignId, pool] of Object.entries(REGION_BONUS_POOLS)) {
      const categories = new Set(pool.map((o) => o.category));
      expect(categories, `pool for ${campaignId}`).toEqual(new Set(["gold", "equipment", "structure"]));
    }
  });

  it("D-217: every pool now has TWO gold options (filling the slot the removed 'xp' category left)", () => {
    for (const [campaignId, pool] of Object.entries(REGION_BONUS_POOLS)) {
      expect(pool.filter((o) => o.category === "gold").length, `pool for ${campaignId}`).toBe(2);
    }
  });

  it("every option carries exactly the payload field its own category needs, with a positive amount", () => {
    const fieldFor: Record<RegionBonusOption["category"], keyof RegionBonusOption> = {
      gold: "goldAmount",
      equipment: "equipmentId",
      structure: "structureId",
    };
    for (const pool of Object.values(REGION_BONUS_POOLS)) {
      for (const option of pool) {
        const expectedField = fieldFor[option.category];
        expect(option[expectedField], `${option.id}.${expectedField}`).toBeDefined();
        if (option.category === "gold") {
          expect(option[expectedField] as number).toBeGreaterThan(0);
        }
      }
    }
  });

  it("every referenced equipment id is real, common/uncommon, and requires no attunement", () => {
    for (const pool of Object.values(REGION_BONUS_POOLS)) {
      for (const option of pool.filter((o) => o.category === "equipment")) {
        const def = getEquipmentDefinition(option.equipmentId!);
        expect(["common", "uncommon"]).toContain(def.rarity);
        expect(def.requiresAttunement).toBeFalsy();
      }
    }
  });

  it("every referenced structure id is real and not a spell-only (cost 0) structure", () => {
    for (const pool of Object.values(REGION_BONUS_POOLS)) {
      for (const option of pool.filter((o) => o.category === "structure")) {
        const def = getStructureDefinition(option.structureId!);
        expect(def.cost).toBeGreaterThan(0);
      }
    }
  });

  it("both gold bonus tiers escalate through CAMPAIGN_STORY_DESIGN.md §3's own region order", () => {
    const order = [
      "emberford-reach",
      "shattered-causeway",
      "cinderfall-rift",
      "drowning-vale",
      "saltmere-shallows",
      "frostbound-hollow",
    ];
    const goldOptionsByRegion = order.map((id) => REGION_BONUS_POOLS[id].filter((o) => o.category === "gold").map((o) => o.goldAmount!));
    const lowerTierByRegion = goldOptionsByRegion.map((amounts) => Math.min(...amounts));
    const higherTierByRegion = goldOptionsByRegion.map((amounts) => Math.max(...amounts));
    for (let i = 1; i < order.length; i++) {
      expect(lowerTierByRegion[i]).toBeGreaterThan(lowerTierByRegion[i - 1]);
      expect(higherTierByRegion[i]).toBeGreaterThan(higherTierByRegion[i - 1]);
    }
    // Within each region, the two gold tiers are genuinely different amounts.
    for (let i = 0; i < order.length; i++) expect(higherTierByRegion[i]).toBeGreaterThan(lowerTierByRegion[i]);
  });
});

describe("drawRegionBonusChoices", () => {
  const pool = REGION_BONUS_POOLS["emberford-reach"];

  it("draws exactly 3 distinct options by default", () => {
    const drawn = drawRegionBonusChoices(pool, RandomService.seeded(42));
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn.map((o) => o.id)).size).toBe(3);
    drawn.forEach((o) => expect(pool).toContain(o));
  });

  it("respects an explicit count", () => {
    expect(drawRegionBonusChoices(pool, RandomService.seeded(1), 2)).toHaveLength(2);
    expect(drawRegionBonusChoices(pool, RandomService.seeded(1), pool.length)).toHaveLength(pool.length);
  });

  it("never draws more than the pool has, and never duplicates when count exceeds the pool size", () => {
    const drawn = drawRegionBonusChoices(pool, RandomService.seeded(7), pool.length + 5);
    expect(drawn).toHaveLength(pool.length);
    expect(new Set(drawn.map((o) => o.id)).size).toBe(pool.length);
  });

  it("under a fixed RandomService (always index 0), draws the pool's first N in order", () => {
    const drawn = drawRegionBonusChoices(pool, RandomService.fixed());
    expect(drawn).toEqual(pool.slice(0, 3));
  });

  it("different seeds can produce different draws (not hardcoded to one order)", () => {
    const a = drawRegionBonusChoices(pool, RandomService.seeded(1)).map((o) => o.id);
    const b = drawRegionBonusChoices(pool, RandomService.seeded(2)).map((o) => o.id);
    // Not a strict guarantee for arbitrary seeds, but true for these two against this pool.
    expect(a).not.toEqual(b);
  });
});
