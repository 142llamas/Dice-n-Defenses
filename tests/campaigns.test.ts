import { describe, it, expect } from "vitest";
import {
  CAMPAIGNS,
  SIDE_MISSIONS,
  PROLOGUE_CAMPAIGN_ID,
  NAMELESS_THRONE_CAMPAIGN_ID,
  REGION_CAMPAIGN_IDS,
  getCampaignDefinition,
  getCampaignMap,
  getChapter,
  chapterLevelMilestones,
  isChapteredCampaign,
  totalChapters,
  type CampaignDefinition,
  type ChapterDefinition,
} from "../src/game/data/campaigns";
import { COMPANIONS } from "../src/game/data/companions";
import { PROLOGUE_MAP } from "../src/game/data/prologueMap";
import { getEnemyDefinition } from "../src/game/data/enemies";
import { EMBERFORD_MAP } from "../src/game/data/emberfordMap";
import { SALTMERE_MAP } from "../src/game/data/saltmereMap";
import { CAUSEWAY_MAP } from "../src/game/data/causewayMap";
import { CINDERFALL_RIFT_MAP } from "../src/game/data/cinderfallRiftMap";
import { DROWNING_VALE_MAP } from "../src/game/data/drowningValeMap";
import { FROSTBOUND_HOLLOW_MAP } from "../src/game/data/frostboundHollowMap";
import { NAMELESS_THRONE_MAP } from "../src/game/data/namelessThroneMap";
import { getEquipmentDefinition } from "../src/game/data/equipment";
import { POTION_DEFINITIONS } from "../src/game/data/potions";

/**
 * Phase 11.8 (D-071) — boss-themed campaigns, originally two (Emberford
 * Reach/Saltmere Shallows). Phase 27 (D-180) added the other four regions
 * (Shattered Causeway/Cinderfall Rift/The Drowning Vale/Frostbound Hollow),
 * so `CAMPAIGNS` now holds all six of `CAMPAIGN_STORY_DESIGN.md` §3's
 * regions. This is the spec every campaign must meet: retrievable by id,
 * references a real map and only real enemy ids (catches typos against
 * ENEMY_DEFINITIONS), and its finale wave must actually include its
 * declared `bossEnemyId`.
 */

const CAMPAIGN_MAP_BY_ID: Record<string, { id: string; name: string }> = {
  "emberford-reach": EMBERFORD_MAP,
  "saltmere-shallows": SALTMERE_MAP,
  "shattered-causeway": CAUSEWAY_MAP,
  "cinderfall-rift": CINDERFALL_RIFT_MAP,
  "drowning-vale": DROWNING_VALE_MAP,
  "frostbound-hollow": FROSTBOUND_HOLLOW_MAP,
};

// D-184/D-188: the six CAMPAIGN_STORY_DESIGN.md §3 regions, excluding the
// flat, non-chaptered prologue mission that gates them AND the flat capstone
// that gates behind them — several assertions below are genuinely
// region-only (exactly 6 waves, genuinely chaptered) and would fail against
// either flat campaign's own deliberately different shape.
const REGIONS = CAMPAIGNS.filter((c) => REGION_CAMPAIGN_IDS.includes(c.id));

describe("CAMPAIGNS", () => {
  it("has the six CAMPAIGN_STORY_DESIGN.md §3 regions, the D-184 prologue, and the D-188 capstone", () => {
    expect(CAMPAIGNS.length).toBe(8);
    const regionIds = REGIONS.map((c) => c.id);
    expect(regionIds.sort()).toEqual(Object.keys(CAMPAIGN_MAP_BY_ID).sort());
    expect(CAMPAIGNS.some((c) => c.id === PROLOGUE_CAMPAIGN_ID)).toBe(true);
    expect(CAMPAIGNS.some((c) => c.id === NAMELESS_THRONE_CAMPAIGN_ID)).toBe(true);
  });

  it("getCampaignDefinition retrieves each campaign by id", () => {
    for (const id of Object.keys(CAMPAIGN_MAP_BY_ID)) {
      expect(() => getCampaignDefinition(id)).not.toThrow();
    }
  });

  it("getCampaignDefinition throws on an unknown id", () => {
    expect(() => getCampaignDefinition("nonexistent")).toThrow();
  });

  it("each campaign's mapId resolves to a real, matching ParsedMap", () => {
    for (const [id, map] of Object.entries(CAMPAIGN_MAP_BY_ID)) {
      const campaign = getCampaignDefinition(id);
      expect(getCampaignMap(campaign.mapId)).toBe(map);
      expect(campaign.mapId).toBe(map.id);
    }
  });

  it("getCampaignMap throws on an unknown map id", () => {
    expect(() => getCampaignMap("nonexistent-map")).toThrow();
  });

  it("keeps each region to exactly 6 waves (deliberate Phase 11.8 scope, not a full 10-wave design)", () => {
    for (const campaign of REGIONS) {
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

  it("gives each campaign an original name and description, distinct from every other campaign's", () => {
    for (const campaign of CAMPAIGNS) {
      expect(campaign.description.length).toBeGreaterThan(0);
    }
    expect(new Set(CAMPAIGNS.map((c) => c.name)).size).toBe(CAMPAIGNS.length);
    expect(new Set(CAMPAIGNS.map((c) => c.description)).size).toBe(CAMPAIGNS.length);
  });
});

/**
 * D-118 — engine scaffolding for CAMPAIGN_STORY_DESIGN.md's "region"
 * structure (4 chapters per region), exercised here against a SYNTHETIC
 * flat campaign fixture (not `CAMPAIGNS`'s real entries, which became
 * genuinely chaptered as of D-177 — see the "Chapters (D-177)" block below
 * for coverage of the real content).
 */
describe("Chapters (D-118)", () => {
  const flatCampaign: CampaignDefinition = {
    id: "flat-test-campaign",
    name: "Flat Test Campaign",
    description: "A flat, non-chaptered test campaign.",
    mapId: "does-not-matter",
    waves: [{ id: "w1", spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 10 }],
    bossEnemyId: "cinderlord",
  };

  it("a flat campaign (no chapters field) is not chaptered", () => {
    expect(isChapteredCampaign(flatCampaign)).toBe(false);
    expect(totalChapters(flatCampaign)).toBe(1);
  });

  it("getChapter synthesizes a flat campaign's own fields as chapter 0", () => {
    const chapter = getChapter(flatCampaign, 0);
    expect(chapter.waves).toBe(flatCampaign.waves);
    expect(chapter.bossEnemyId).toBe(flatCampaign.bossEnemyId);
    expect(chapter.lootPoolIds).toBe(flatCampaign.lootPoolIds);
  });

  it("getChapter throws for any non-zero index on a flat campaign", () => {
    expect(() => getChapter(flatCampaign, 1)).toThrow();
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

/**
 * D-177/D-180 (KI-098 item 13): real content coverage for all six regions'
 * 4 chapters each (D-177 shipped Emberford Reach/Saltmere Shallows; D-180
 * added the other four) — the top-level "CAMPAIGNS" describe block above
 * only ever validates the finale-describing top-level `waves`/`bossEnemyId`
 * fields, so without this, chapters 1-3's content would be otherwise
 * completely unvalidated (enemy id typos, gold ramp, boss-only-in-its-own-
 * finale-wave).
 */
describe("Chapters (D-177): real chapter content", () => {
  it("every region is genuinely chaptered with exactly 4 chapters, levels 1-20 with no gaps", () => {
    for (const campaign of REGIONS) {
      expect(isChapteredCampaign(campaign)).toBe(true);
      expect(totalChapters(campaign)).toBe(4);
      const ranges = campaign.chapters!.map((c) => c.levelRange);
      expect(ranges).toEqual([
        [1, 5],
        [6, 10],
        [11, 15],
        [16, 20],
      ]);
    }
  });

  it("chapter 4 is an exact reuse of the existing flat finale (zero regression risk)", () => {
    const emberford = getCampaignDefinition("emberford-reach");
    const saltmere = getCampaignDefinition("saltmere-shallows");
    expect(getChapter(emberford, 3).waves).toBe(emberford.waves);
    expect(getChapter(saltmere, 3).waves).toBe(saltmere.waves);
  });

  it("every chapter references only real, renderable enemies with valid spawn schedules", () => {
    for (const campaign of CAMPAIGNS) {
      for (let i = 0; i < totalChapters(campaign); i++) {
        const chapter = getChapter(campaign, i);
        expect(chapter.waves.length).toBeGreaterThan(0);
        for (const wave of chapter.waves) {
          expect(wave.spawns.length).toBeGreaterThan(0);
          for (const group of wave.spawns) {
            expect(() => getEnemyDefinition(group.enemyId)).not.toThrow();
            expect(group.count).toBeGreaterThan(0);
            expect(group.startTurn).toBeGreaterThanOrEqual(1);
            expect(group.intervalTurns).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });

  it("each chapter's own bossEnemyId (when set) is real and appears only in that chapter's own finale wave", () => {
    for (const campaign of CAMPAIGNS) {
      for (let i = 0; i < totalChapters(campaign); i++) {
        const chapter = getChapter(campaign, i);
        if (!chapter.bossEnemyId) continue;
        expect(() => getEnemyDefinition(chapter.bossEnemyId!)).not.toThrow();
        const finale = chapter.waves[chapter.waves.length - 1];
        expect(finale.spawns.some((g) => g.enemyId === chapter.bossEnemyId)).toBe(true);
        for (const wave of chapter.waves.slice(0, -1)) {
          expect(wave.spawns.some((g) => g.enemyId === chapter.bossEnemyId)).toBe(false);
        }
      }
    }
  });

  it("completion gold never decreases within a chapter, and never decreases from one chapter's finale into the next chapter's opener", () => {
    for (const campaign of CAMPAIGNS) {
      for (let i = 0; i < totalChapters(campaign); i++) {
        const gold = getChapter(campaign, i).waves.map((w) => w.completionGold);
        for (let w = 1; w < gold.length; w++) {
          expect(gold[w]).toBeGreaterThanOrEqual(gold[w - 1]);
        }
      }
      for (let i = 1; i < totalChapters(campaign); i++) {
        const prevFinaleGold = getChapter(campaign, i - 1).waves.slice(-1)[0].completionGold;
        const nextOpenerGold = getChapter(campaign, i).waves[0].completionGold;
        expect(nextOpenerGold).toBeGreaterThanOrEqual(0);
        expect(prevFinaleGold).toBeGreaterThan(0);
      }
    }
  });

  it("Emberford Ch1's miniboss is basalt-colossus; Saltmere Ch1's is the tide-wretch fallback (no earlier region completable yet)", () => {
    expect(getChapter(getCampaignDefinition("emberford-reach"), 0).bossEnemyId).toBe("basalt-colossus");
    expect(getChapter(getCampaignDefinition("saltmere-shallows"), 0).bossEnemyId).toBe("tide-wretch");
    expect(getEnemyDefinition("tide-wretch").role).toBe("miniboss");
    expect(getEnemyDefinition("tide-wretch").loreText).toBeUndefined();
  });

  it("D-180: each of the other four regions' Ch1 miniboss and Ch4/finale boss match CAMPAIGN_STORY_DESIGN.md §3's table", () => {
    const expected: Record<string, { miniboss: string; boss: string }> = {
      "shattered-causeway": { miniboss: "juggernaut", boss: "the-devourer" },
      "cinderfall-rift": { miniboss: "gravemaw", boss: "warlord-korrath" },
      "drowning-vale": { miniboss: "the-husk", boss: "blightmother" },
      "frostbound-hollow": { miniboss: "bloodrage-warlord", boss: "sundered-king" },
    };
    for (const [id, { miniboss, boss }] of Object.entries(expected)) {
      const campaign = getCampaignDefinition(id);
      expect(campaign.bossEnemyId).toBe(boss);
      expect(getChapter(campaign, 0).bossEnemyId).toBe(miniboss);
      expect(getChapter(campaign, 1).bossEnemyId).toBe(boss);
      expect(getChapter(campaign, 3).bossEnemyId).toBe(boss);
      expect(getEnemyDefinition(miniboss).role).toBe("miniboss");
      expect(getEnemyDefinition(boss).role).toBe("boss");
    }
  });

  it("KI-098 item 13 continuation: every region chapter has real introText/outroText (the writing pass CAMPAIGN_STORY_DESIGN.md §9 flagged as still open)", () => {
    for (const campaign of REGIONS) {
      for (let i = 0; i < totalChapters(campaign); i++) {
        const chapter = getChapter(campaign, i);
        expect(chapter.introText, `${chapter.id} introText`).toBeTruthy();
        expect(chapter.introText!.trim().length).toBeGreaterThan(0);
        expect(chapter.outroText, `${chapter.id} outroText`).toBeTruthy();
        expect(chapter.outroText!.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * D-184 (KI-098 item 13): The Proving Ground — the new one-time prologue
 * mission that gates the six regions above. Deliberately flat (no
 * `chapters`), so it needs its own small coverage separate from every
 * region-only assertion in the describe blocks above.
 */
describe("Prologue (D-184)", () => {
  it("is retrievable, flat (not chaptered), and resolves to its own map", () => {
    const prologue = getCampaignDefinition(PROLOGUE_CAMPAIGN_ID);
    expect(isChapteredCampaign(prologue)).toBe(false);
    expect(totalChapters(prologue)).toBe(1);
    expect(getCampaignMap(prologue.mapId)).toBe(PROLOGUE_MAP);
  });

  it("is a short, low-difficulty battle whose finale wave includes its bossEnemyId only", () => {
    const prologue = getCampaignDefinition(PROLOGUE_CAMPAIGN_ID);
    expect(prologue.waves.length).toBe(3);
    expect(() => getEnemyDefinition(prologue.bossEnemyId)).not.toThrow();

    const finale = prologue.waves[prologue.waves.length - 1];
    expect(finale.spawns.some((g) => g.enemyId === prologue.bossEnemyId)).toBe(true);
    for (const wave of prologue.waves.slice(0, -1)) {
      expect(wave.spawns.some((g) => g.enemyId === prologue.bossEnemyId)).toBe(false);
    }
  });

  it("references only real, renderable enemies and a real curated loot pool", () => {
    const prologue = getCampaignDefinition(PROLOGUE_CAMPAIGN_ID);
    for (const wave of prologue.waves) {
      for (const group of wave.spawns) {
        expect(() => getEnemyDefinition(group.enemyId)).not.toThrow();
      }
    }
    expect(prologue.lootPoolIds).toBeDefined();
    expect(prologue.lootPoolIds!.length).toBeGreaterThan(0);
  });

  it("D-217: grants no level-ups — a short level-1 intro shouldn't ramp the player up at all", () => {
    const prologue = getCampaignDefinition(PROLOGUE_CAMPAIGN_ID);
    expect(chapterLevelMilestones(prologue, 0)).toEqual([]);
  });
});

/**
 * D-188 (CAMPAIGN_STORY_DESIGN.md §5): The Nameless Throne — the campaign
 * capstone. Deliberately flat (no `chapters`), same shape as the Prologue,
 * so it needs its own small coverage separate from every region-only
 * assertion above. Belt-and-suspenders alongside `namelessThroneSystem.
 * test.ts`'s own unit coverage of the resolver/swap functions themselves.
 */
describe("The Nameless Throne (D-188 capstone)", () => {
  it("is retrievable, flat (not chaptered), and resolves to its own map", () => {
    const capstone = getCampaignDefinition(NAMELESS_THRONE_CAMPAIGN_ID);
    expect(isChapteredCampaign(capstone)).toBe(false);
    expect(totalChapters(capstone)).toBe(1);
    expect(getCampaignMap(capstone.mapId)).toBe(NAMELESS_THRONE_MAP);
  });

  it("is a 6-wave finale whose last wave includes its bossEnemyId only", () => {
    const capstone = getCampaignDefinition(NAMELESS_THRONE_CAMPAIGN_ID);
    expect(capstone.waves.length).toBe(6);
    expect(() => getEnemyDefinition(capstone.bossEnemyId)).not.toThrow();

    const finale = capstone.waves[capstone.waves.length - 1];
    expect(finale.spawns.some((g) => g.enemyId === capstone.bossEnemyId)).toBe(true);
    for (const wave of capstone.waves.slice(0, -1)) {
      expect(wave.spawns.some((g) => g.enemyId === capstone.bossEnemyId)).toBe(false);
    }
  });

  it("references only real, renderable enemies, including all 6 new reskins, and a real curated loot pool", () => {
    const capstone = getCampaignDefinition(NAMELESS_THRONE_CAMPAIGN_ID);
    const reskinIds = [
      "ember-thane",
      "cinder-adept",
      "ashbound-honor-guard",
      "drowned-thane",
      "hollow-caller",
      "drowned-honor-captain",
    ];
    for (const id of reskinIds) {
      expect(() => getEnemyDefinition(id)).not.toThrow();
    }
    for (const wave of capstone.waves) {
      for (const group of wave.spawns) {
        expect(() => getEnemyDefinition(group.enemyId)).not.toThrow();
      }
    }
    expect(capstone.lootPoolIds).toBeDefined();
    expect(capstone.lootPoolIds!.length).toBeGreaterThan(0);
  });

  it("D-217: grants no level-ups — gated behind all 6 regions, the player should already be at the level cap", () => {
    const capstone = getCampaignDefinition(NAMELESS_THRONE_CAMPAIGN_ID);
    expect(chapterLevelMilestones(capstone, 0)).toEqual([]);
  });
});

/**
 * D-18x (KI-098 item 13, closes D-183's own deferred "side-quest missions"
 * item): one fixed, flat, one-time mission per Pool A companion. Kept in
 * their own `SIDE_MISSIONS` array, deliberately NOT part of `CAMPAIGNS` (so
 * `CampaignSelectScene` never renders them as a region card) — this suite
 * exercises that array directly rather than `CAMPAIGNS`.
 */
describe("Side missions (KI-098 item 13)", () => {
  it("has exactly 6 missions, one per Pool A companion's own sideMissionId, none overlapping CAMPAIGNS' ids", () => {
    expect(SIDE_MISSIONS).toHaveLength(6);
    const poolA = COMPANIONS.filter((c) => !c.homeRegionId);
    expect(poolA).toHaveLength(6);
    expect(SIDE_MISSIONS.map((m) => m.id).sort()).toEqual(poolA.map((c) => c.sideMissionId).sort());
    const campaignIds = new Set(CAMPAIGNS.map((c) => c.id));
    SIDE_MISSIONS.forEach((m) => expect(campaignIds.has(m.id)).toBe(false));
  });

  it("getCampaignDefinition resolves every side mission id (not just CAMPAIGNS)", () => {
    SIDE_MISSIONS.forEach((m) => expect(getCampaignDefinition(m.id)).toBe(m));
  });

  it("every mission is flat (not chaptered), a short 3-wave battle whose finale includes its bossEnemyId only", () => {
    SIDE_MISSIONS.forEach((mission) => {
      expect(isChapteredCampaign(mission)).toBe(false);
      expect(totalChapters(mission)).toBe(1);
      expect(mission.waves.length).toBe(3);

      const finale = mission.waves[mission.waves.length - 1];
      expect(finale.spawns.some((g) => g.enemyId === mission.bossEnemyId)).toBe(true);
      for (const wave of mission.waves.slice(0, -1)) {
        expect(wave.spawns.some((g) => g.enemyId === mission.bossEnemyId)).toBe(false);
      }
    });
  });

  it("every mission's finale enemy is a real, non-miniboss/boss/legendary regular — can never collide with the returning-miniboss mechanic", () => {
    SIDE_MISSIONS.forEach((mission) => {
      const boss = getEnemyDefinition(mission.bossEnemyId);
      expect(["miniboss", "boss", "legendary"]).not.toContain(boss.role);
    });
  });

  it("every mission resolves to a real, shared region map (no new map authored) and references only real enemies", () => {
    SIDE_MISSIONS.forEach((mission) => {
      expect(() => getCampaignMap(mission.mapId)).not.toThrow();
      for (const wave of mission.waves) {
        expect(wave.spawns.length).toBeGreaterThan(0);
        for (const group of wave.spawns) {
          expect(() => getEnemyDefinition(group.enemyId)).not.toThrow();
        }
      }
    });
  });

  it("never lets wave completion gold go backwards, and gives each mission an original, distinct name/description", () => {
    SIDE_MISSIONS.forEach((mission) => {
      const gold = mission.waves.map((w) => w.completionGold);
      for (let i = 1; i < gold.length; i++) expect(gold[i]).toBeGreaterThanOrEqual(gold[i - 1]);
    });
    expect(new Set(SIDE_MISSIONS.map((m) => m.name)).size).toBe(SIDE_MISSIONS.length);
    expect(new Set(SIDE_MISSIONS.map((m) => m.description)).size).toBe(SIDE_MISSIONS.length);
  });

  it("D-217 (item 3d): every mission is marked isSideMission and grants no level-ups, structurally, regardless of its own waves/levelRange", () => {
    SIDE_MISSIONS.forEach((mission) => {
      expect(mission.isSideMission).toBe(true);
      expect(chapterLevelMilestones(mission, 0)).toEqual([]);
    });
  });

  it("D-217: every companion referenced by a sideMissionId points at a mission actually marked isSideMission, and vice versa", () => {
    const poolA = COMPANIONS.filter((c) => !c.homeRegionId);
    const sideMissionIds = new Set(poolA.map((c) => c.sideMissionId));
    SIDE_MISSIONS.forEach((mission) => {
      expect(sideMissionIds.has(mission.id)).toBe(true);
      expect(mission.isSideMission).toBe(true);
    });
    CAMPAIGNS.forEach((c) => {
      if (sideMissionIds.has(c.id)) {
        // No CAMPAIGNS entry currently shares an id with a side mission
        // (asserted above too), so this only guards against future drift.
        expect(c.isSideMission).toBe(true);
      } else {
        expect(c.isSideMission).toBeFalsy();
      }
    });
  });
});

/**
 * D-217 (item 3a/3c): every REGION chapter's default (unauthored)
 * `levelMilestones` track — derived from its own `levelRange`/`waves.length`
 * via `chapterLevelMilestones` — reaches exactly that chapter's target level
 * after clearing its second-to-last wave, same guarantee
 * `tests/levelMilestones.test.ts` already covers for Free Play's Run Length
 * presets, now exercised across all 24 real region chapters.
 */
describe("Level milestones (D-217, item 3c)", () => {
  it("reaches exactly levelRange[1] after the second-to-last wave, for every chapter of every region", () => {
    REGIONS.forEach((region) => {
      for (let i = 0; i < totalChapters(region); i++) {
        const chapter = getChapter(region, i);
        const track = chapterLevelMilestones(region, i);
        expect(track.length).toBeGreaterThan(0);
        const last = track[track.length - 1];
        expect(last.afterWave).toBe(chapter.waves.length - 1);
        expect(last.level).toBe(chapter.levelRange[1]);
        expect(track.every((m) => m.afterWave < chapter.waves.length)).toBe(true);
      }
    });
  });

  it("never regresses within one chapter's track, and never implies a level below levelRange[0]", () => {
    REGIONS.forEach((region) => {
      for (let i = 0; i < totalChapters(region); i++) {
        const chapter = getChapter(region, i);
        const track = chapterLevelMilestones(region, i);
        for (const m of track) expect(m.level).toBeGreaterThanOrEqual(chapter.levelRange[0]);
        for (let j = 1; j < track.length; j++) {
          expect(track[j].level).toBeGreaterThan(track[j - 1].level);
          expect(track[j].afterWave).toBeGreaterThan(track[j - 1].afterWave);
        }
      }
    });
  });
});
