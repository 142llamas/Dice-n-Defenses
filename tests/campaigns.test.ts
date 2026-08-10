import { describe, it, expect } from "vitest";
import {
  CAMPAIGNS,
  getCampaignDefinition,
  getCampaignMap,
  getChapter,
  isChapteredCampaign,
  totalChapters,
  type CampaignDefinition,
  type ChapterDefinition,
} from "../src/game/data/campaigns";
import { getEnemyDefinition } from "../src/game/data/enemies";
import { EMBERFORD_MAP } from "../src/game/data/emberfordMap";
import { SALTMERE_MAP } from "../src/game/data/saltmereMap";
import { getEquipmentDefinition } from "../src/game/data/equipment";
import { POTION_DEFINITIONS } from "../src/game/data/potions";

/**
 * Phase 11.8 (D-071) — boss-themed campaigns. This is the spec for the two
 * campaigns added this slice: each must be retrievable by id, reference a
 * real map and only real enemy ids (catches typos against ENEMY_DEFINITIONS),
 * and its finale wave must actually include its declared `bossEnemyId`.
 */

describe("CAMPAIGNS", () => {
  it("has exactly the two Phase 11.8 campaigns", () => {
    expect(CAMPAIGNS.length).toBe(2);
    const ids = CAMPAIGNS.map((c) => c.id);
    expect(ids).toContain("emberford-reach");
    expect(ids).toContain("saltmere-shallows");
  });

  it("getCampaignDefinition retrieves each campaign by id", () => {
    expect(getCampaignDefinition("emberford-reach").name).toBe("Emberford Reach");
    expect(getCampaignDefinition("saltmere-shallows").name).toBe("Saltmere Shallows");
  });

  it("getCampaignDefinition throws on an unknown id", () => {
    expect(() => getCampaignDefinition("nonexistent")).toThrow();
  });

  it("each campaign's mapId resolves to a real, matching ParsedMap", () => {
    const emberford = getCampaignDefinition("emberford-reach");
    const saltmere = getCampaignDefinition("saltmere-shallows");
    expect(getCampaignMap(emberford.mapId)).toBe(EMBERFORD_MAP);
    expect(getCampaignMap(saltmere.mapId)).toBe(SALTMERE_MAP);
    expect(emberford.mapId).toBe(EMBERFORD_MAP.id);
    expect(saltmere.mapId).toBe(SALTMERE_MAP.id);
  });

  it("getCampaignMap throws on an unknown map id", () => {
    expect(() => getCampaignMap("nonexistent-map")).toThrow();
  });

  it("keeps each campaign to exactly 6 waves (deliberate Phase 11.8 scope, not a full 10-wave design)", () => {
    for (const campaign of CAMPAIGNS) {
      expect(campaign.waves.length).toBe(6);
    }
  });

  it("references only real, renderable enemies with valid spawn schedules", () => {
    for (const campaign of CAMPAIGNS) {
      for (const wave of campaign.waves) {
        expect(wave.spawns.length).toBeGreaterThan(0);
        for (const group of wave.spawns) {
          expect(() => getEnemyDefinition(group.enemyId)).not.toThrow();
          expect(group.count).toBeGreaterThan(0);
          expect(group.startTurn).toBeGreaterThanOrEqual(1);
          expect(group.intervalTurns).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("declares a real bossEnemyId and includes it in the finale wave only", () => {
    for (const campaign of CAMPAIGNS) {
      // Throws on a typo'd boss id.
      expect(() => getEnemyDefinition(campaign.bossEnemyId)).not.toThrow();

      const finale = campaign.waves[campaign.waves.length - 1];
      const finaleHasBoss = finale.spawns.some((g) => g.enemyId === campaign.bossEnemyId);
      expect(finaleHasBoss).toBe(true);

      // The boss should not appear in any earlier wave.
      for (const wave of campaign.waves.slice(0, -1)) {
        const hasBossEarly = wave.spawns.some((g) => g.enemyId === campaign.bossEnemyId);
        expect(hasBossEarly).toBe(false);
      }
    }
  });

  it("never lets wave completion gold go backwards within a campaign, and pays the most at the finale", () => {
    for (const campaign of CAMPAIGNS) {
      const gold = campaign.waves.map((w) => w.completionGold);
      for (let i = 1; i < gold.length; i++) {
        expect(gold[i]).toBeGreaterThanOrEqual(gold[i - 1]);
      }
      expect(gold[gold.length - 1]).toBe(Math.max(...gold));
    }
  });

  it("each campaign's curated loot pool (Phase 22) references only real potion/equipment ids", () => {
    for (const campaign of CAMPAIGNS) {
      expect(campaign.lootPoolIds).toBeDefined();
      expect(campaign.lootPoolIds!.length).toBeGreaterThan(0);
      for (const id of campaign.lootPoolIds!) {
        const isReal = id in POTION_DEFINITIONS || (() => {
          try {
            getEquipmentDefinition(id);
            return true;
          } catch {
            return false;
          }
        })();
        expect(isReal).toBe(true);
      }
    }
  });

  it("gives each campaign an original name and description, distinct from each other", () => {
    const [a, b] = CAMPAIGNS;
    expect(a.name).not.toBe(b.name);
    expect(a.description.length).toBeGreaterThan(0);
    expect(b.description.length).toBeGreaterThan(0);
    expect(a.description).not.toBe(b.description);
  });
});

/**
 * D-118 — engine scaffolding for CAMPAIGN_STORY_DESIGN.md's "region"
 * structure (4 chapters per region). Neither shipped campaign uses
 * `chapters` yet — both must behave exactly as before (a flat, single
 * "chapter" wrapping their existing waves/boss/loot).
 */
describe("Chapters (D-118)", () => {
  it("neither existing campaign is chaptered", () => {
    for (const campaign of CAMPAIGNS) {
      expect(isChapteredCampaign(campaign)).toBe(false);
      expect(totalChapters(campaign)).toBe(1);
    }
  });

  it("getChapter synthesizes a flat campaign's own fields as chapter 0", () => {
    const emberford = getCampaignDefinition("emberford-reach");
    const chapter = getChapter(emberford, 0);
    expect(chapter.waves).toBe(emberford.waves);
    expect(chapter.bossEnemyId).toBe(emberford.bossEnemyId);
    expect(chapter.lootPoolIds).toBe(emberford.lootPoolIds);
  });

  it("getChapter throws for any non-zero index on a flat campaign", () => {
    const emberford = getCampaignDefinition("emberford-reach");
    expect(() => getChapter(emberford, 1)).toThrow();
  });

  it("a chaptered campaign reports its real chapter count and resolves each by index", () => {
    const chapters: ChapterDefinition[] = [
      { id: "ch1", name: "Arrival", levelRange: [1, 5], waves: [], bossEnemyId: "grunt" },
      { id: "ch2", name: "Escalation", levelRange: [6, 10], waves: [] },
      { id: "ch3", name: "Branch Payoff", levelRange: [11, 15], waves: [] },
      { id: "ch4", name: "Finale", levelRange: [16, 20], waves: [], bossEnemyId: "cinderlord" },
    ];
    const region: CampaignDefinition = {
      id: "test-region",
      name: "Test Region",
      description: "A test region.",
      mapId: "does-not-matter",
      waves: chapters[3].waves,
      bossEnemyId: "cinderlord",
      chapters,
    };
    expect(isChapteredCampaign(region)).toBe(true);
    expect(totalChapters(region)).toBe(4);
    expect(getChapter(region, 0)).toBe(chapters[0]);
    expect(getChapter(region, 3)).toBe(chapters[3]);
  });

  it("getChapter throws for an out-of-range index on a chaptered campaign", () => {
    const region: CampaignDefinition = {
      id: "test-region",
      name: "Test Region",
      description: "A test region.",
      mapId: "does-not-matter",
      waves: [],
      bossEnemyId: "cinderlord",
      chapters: [{ id: "ch1", name: "Arrival", levelRange: [1, 5], waves: [] }],
    };
    expect(() => getChapter(region, 1)).toThrow();
  });
});
