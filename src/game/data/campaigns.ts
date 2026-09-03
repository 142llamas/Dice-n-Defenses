import type { WaveDefinition } from "./waves";
import type { LevelMilestoneTrack } from "../systems/LevelMilestoneSystem";
import { generateLevelMilestones } from "./levelMilestones";
import { PROLOGUE_MAP } from "./prologueMap";
import { EMBERFORD_MAP } from "./emberfordMap";
import { SALTMERE_MAP } from "./saltmereMap";
import { CAUSEWAY_MAP } from "./causewayMap";
import { CINDERFALL_RIFT_MAP } from "./cinderfallRiftMap";
import { DROWNING_VALE_MAP } from "./drowningValeMap";
import { FROSTBOUND_HOLLOW_MAP } from "./frostboundHollowMap";
import { NAMELESS_THRONE_MAP } from "./namelessThroneMap";
import type { ParsedMap } from "./testMap";
import { POTION_ORDER } from "./potions";

/**
 * Campaign definitions — data, not code (Phase 11.8, D-071).
 *
 * A "campaign" pairs one of Phase 11.7's showcase maps with its own short,
 * boss-themed wave list and names the finale boss for UI display. This is
 * deliberately SEPARATE from `data/waves.ts`'s `WAVES` — the classic
 * fixed-roster START path keeps using `WAVES`/`TEST_MAP` completely
 * unchanged; nothing here is read by that path.
 *
 * Scope decision: each campaign below is 6 WAVES, not a full 10-wave design
 * matching the original campaign. A full 10-wave-per-campaign treatment is
 * out of scope for this sub-phase (deliberately smaller, not an oversight).
 * As with every other wave list in this project, every number here is a
 * FIRST-PASS, untuned guess (same KI-015 caveat `data/waves.ts` carries) —
 * real balance is Kevin's in-browser call.
 *
 * All names/flavor text are ORIGINAL to this project — no D&D/SRD-derived
 * content (see CONTENT_SOURCES.md).
 */

export interface CampaignDefinition {
  id: string;
  name: string;
  description: string;
  /** Matches a ParsedMap's own `.id` field — resolved via `getCampaignMap`. */
  mapId: string;
  /** This campaign's own wave list — NOT the shared `WAVES`. */
  waves: WaveDefinition[];
  /** The finale enemy id, for UI display purposes. */
  bossEnemyId: string;
  /**
   * Phase 22 (magic-item expansion): a curated subset of named potion/magic-
   * item ids this campaign's loot drops favor, part of THIS campaign's own
   * balance (Kevin's own framing: "for campaigns it should be pretty well
   * thought out"), passed straight to `LootSystem.rollLootDrop`. Omitted
   * entirely for the classic 10-wave campaign (no theme to curate around —
   * it uses the same full, unrestricted pool Free Play does).
   */
  lootPoolIds?: readonly string[];
  /**
   * D-118 (engine scaffolding for CAMPAIGN_STORY_DESIGN.md's "region"
   * structure): a "region" campaign is 4 chapters (1-5/6-10/11-15/16-20)
   * instead of one flat wave list. Optional and unused by both existing
   * campaigns on purpose — they stay flat, single-chapter campaigns with
   * zero behavior change. When present, `waves`/`bossEnemyId`/`lootPoolIds`
   * above should still describe the FINALE chapter (chapter index
   * `chapters.length - 1`), so any code that isn't chapter-aware yet keeps
   * reading a sensible value. Always go through `getChapter`/`totalChapters`/
   * `isChapteredCampaign` rather than reading this field directly — they
   * give a flat campaign the same chapter-shaped access pattern (a single
   * synthesized chapter at index 0), so callers never need to branch on
   * "is this campaign chaptered."
   */
  chapters?: ChapterDefinition[];
  /**
   * D-217 (item 3c/3d): overrides the level band a FLAT (non-chaptered)
   * campaign's synthesized single chapter targets — `getChapter` defaults
   * this to `[1, 20]` when absent, which is right for the six ordinary
   * `SIDE_MISSIONS` (whose leveling is moot anyway, see `isSideMission`
   * below) but wrong for the Prologue (a short level-1 intro that shouldn't
   * ramp the player up at all — `[1, 1]`) and the Nameless Throne capstone
   * (fought entirely at the level the player should already be by the time
   * every region is cleared — `[20, 20]`). A CHAPTERED campaign ignores
   * this entirely; each of its `ChapterDefinition`s carries its own
   * `levelRange` instead.
   */
  levelRange?: readonly [number, number];
  /**
   * D-217 (item 3d): true for a Pool-A companion side mission (see
   * `data/companions.ts`'s `sideMissionId`) — grants no character XP/levels
   * at all, its only reward is unlocking the companion. Structurally
   * enforced by `chapterLevelMilestones` returning an empty track
   * regardless of `levelRange`/waves, rather than a policy flag scattered
   * through leveling code. Default false (a main mission).
   */
  isSideMission?: boolean;
}

/**
 * D-118: one chapter of a "region" campaign (see `CampaignDefinition.chapters`
 * and `CAMPAIGN_STORY_DESIGN.md` §2). Deliberately has NO `mapId` of its own
 * — all four chapters of a region share the parent campaign's one map; only
 * the wave list, level band, and (for chapters 1/4) a named threat differ.
 */
export interface ChapterDefinition {
  id: string;
  name: string;
  /** The SRD character-level band this chapter targets, e.g. `[1, 5]`. Matches CAMPAIGN_STORY_DESIGN.md §2's four bands. */
  levelRange: readonly [number, number];
  waves: WaveDefinition[];
  /** Chapters 1 and 4 name a real miniboss/boss per the design doc's §2/§3; chapters 2-3 may still name one, but it's not required. */
  bossEnemyId?: string;
  lootPoolIds?: readonly string[];
  /** Minimal chapter-boundary storytelling (CAMPAIGN_STORY_DESIGN.md §7's "no need for a full dialogue engine yet") — shown before/after the chapter's waves. No rendering exists for these yet; declared for content to fill in once that UI does. */
  introText?: string;
  outroText?: string;
  /**
   * D-217 (item 3c): an optional hand-authored milestone track for THIS
   * chapter's own wave list. Omitted (every chapter today) derives a
   * default even spread from `levelRange`/`waves.length` via
   * `chapterLevelMilestones` — the same `generateLevelMilestones` Free
   * Play's Run Length presets use, just parameterized on this chapter's own
   * band instead of always starting at level 1. Ignored entirely for a
   * side mission (`CampaignDefinition.isSideMission`), which always grants
   * an empty track regardless of this field.
   */
  levelMilestones?: LevelMilestoneTrack;
}

/**
 * True if `def` uses the D-118 chapter structure. Both existing campaigns
 * (Emberford Reach, Saltmere Shallows) return false — they stay flat.
 */
export function isChapteredCampaign(def: CampaignDefinition): boolean {
  return !!def.chapters && def.chapters.length > 0;
}

/** Total playable chapters — 1 for a flat (non-chaptered) campaign. */
export function totalChapters(def: CampaignDefinition): number {
  return isChapteredCampaign(def) ? def.chapters!.length : 1;
}

/**
 * Resolve chapter `chapterIndex` of `def`, throwing on an out-of-range index
 * — matches `getCampaignDefinition`/`getCampaignMap`'s throw-on-unknown-id
 * convention. A flat (non-chaptered) campaign synthesizes a single chapter
 * at index 0 from its own top-level fields, so callers never need to branch
 * on `isChapteredCampaign` themselves — they can always call `getChapter`.
 */
export function getChapter(def: CampaignDefinition, chapterIndex: number): ChapterDefinition {
  if (!isChapteredCampaign(def)) {
    if (chapterIndex !== 0) {
      throw new Error(`Campaign "${def.id}" is not chaptered; only chapter index 0 exists.`);
    }
    return {
      id: def.id,
      name: def.name,
      levelRange: def.levelRange ?? [1, 20],
      waves: def.waves,
      bossEnemyId: def.bossEnemyId,
      lootPoolIds: def.lootPoolIds,
    };
  }
  const chapter = def.chapters![chapterIndex];
  if (!chapter) {
    throw new Error(`Campaign "${def.id}" has no chapter at index ${chapterIndex}.`);
  }
  return chapter;
}

/**
 * D-217 (item 3c/3d): the level-up milestone track for chapter
 * `chapterIndex` of `def` — a side mission always gets an empty track (no
 * XP/levels, structurally, regardless of what its waves/levelRange say);
 * otherwise an explicit `ChapterDefinition.levelMilestones` wins, and
 * absent that, a default even spread is derived from the chapter's own
 * `levelRange`/`waves.length` via `generateLevelMilestones` — the same
 * generator Free Play's Run Length presets use.
 */
export function chapterLevelMilestones(def: CampaignDefinition, chapterIndex: number): LevelMilestoneTrack {
  if (def.isSideMission) return [];
  const chapter = getChapter(def, chapterIndex);
  if (chapter.levelMilestones) return chapter.levelMilestones;
  return generateLevelMilestones(chapter.waves.length, chapter.levelRange[1], chapter.levelRange[0]);
}

// ----- The Proving Ground (D-184: the one-time prologue mission) ----------

/**
 * D-184 (KI-098 item 13, the "forced starting mission" gate D-183's own
 * handoff deferred): a brand-new, fixed one-time mission every fresh
 * campaign save must clear once before any of the 6 story regions below
 * unlock in `CampaignSelectScene`. Deliberately generic and lore-free —
 * NOT a 7th region, not tied to any region's theme — Kevin's own explicit
 * call when this session picked up the deferred gate. `brute` (an existing
 * minion with no `loreText`) stands in as the finale "boss" purely for the
 * card's display text; no new enemy was authored for this, on purpose.
 */
export const PROLOGUE_CAMPAIGN_ID = "prologue";

/**
 * D-188: the 6 CAMPAIGN_STORY_DESIGN.md §3 regions — excludes the Proving
 * Ground prologue and the Nameless Throne capstone. Single source of truth
 * for both `CampaignSelectScene`'s capstone-gate check and
 * `tests/campaigns.test.ts`'s own region filter, so the two can't drift.
 */
export const REGION_CAMPAIGN_IDS: string[] = [
  "emberford-reach",
  "shattered-causeway",
  "cinderfall-rift",
  "drowning-vale",
  "saltmere-shallows",
  "frostbound-hollow",
];

/** D-188: the campaign capstone, CAMPAIGN_STORY_DESIGN.md §5. */
export const NAMELESS_THRONE_CAMPAIGN_ID = "nameless-throne";

const PROLOGUE_WAVES: WaveDefinition[] = [
  { id: "prologue-wave-1", turnLimit: 6, spawns: [{ enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 8, timeBonusGold: 4 },
  {
    id: "prologue-wave-2",
    turnLimit: 7,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "grunt", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 10,
    timeBonusGold: 4,
  },
  {
    id: "prologue-wave-3",
    turnLimit: 8,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "brute", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 14,
    timeBonusGold: 5,
  },
];

// ----- Emberford Reach (volcanic: fire + acid + cliff) --------------------

const EMBERFORD_WAVES: WaveDefinition[] = [
  // Wave 1 — GRUNTS ONLY. A plain opener on unfamiliar (fire/acid) terrain.
  {
    id: "emberford-wave-1",
    turnLimit: 8,
    spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }],
    completionGold: 10,
    timeBonusGold: 5,
  },
  // Wave 2 — RAVAGERS debut alongside a grunt screen: the fastest mover in
  // the roster, teaching "don't let anything close distance unanswered."
  {
    id: "emberford-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 14,
    timeBonusGold: 6,
  },
  // Wave 3 — HEXERS debut: back-line range-3 pokes while runners pressure
  // from the front, so the player must choose who to intercept first.
  {
    id: "emberford-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "hexer", count: 3, startTurn: 1, intervalTurns: 2 },
      { enemyId: "runner", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 18,
    timeBonusGold: 7,
  },
  // Wave 4 — ARMOUR. A warden pair plus a brute wall: defense-piercing tools
  // and focus fire both matter here.
  {
    id: "emberford-wave-4",
    turnLimit: 11,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "brute", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  // Wave 5 — FULL MUSTER. Every regular the campaign has used so far, mixed,
  // as the escalation step right before the finale.
  {
    id: "emberford-wave-5",
    turnLimit: 12,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 30,
    timeBonusGold: 10,
  },
  // Wave 6 — THE FINALE. The Cinderlord arrives behind a mixed escort;
  // clear the escort, then focus the boss down before it breaches. Pays the
  // campaign's largest purse.
  {
    id: "emberford-wave-6",
    turnLimit: 15,
    spawns: [
      { enemyId: "brute", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "cinderlord", count: 1, startTurn: 4, intervalTurns: 1 },
    ],
    completionGold: 55,
    timeBonusGold: 18,
  },
];

// ----- Saltmere Shallows (tidal: water + cliff) ----------------------------

const SALTMERE_WAVES: WaveDefinition[] = [
  // Wave 1 — RUNNERS ONLY. A fast, fragile opener on the tidal flats.
  {
    id: "saltmere-wave-1",
    turnLimit: 8,
    spawns: [{ enemyId: "runner", count: 3, startTurn: 1, intervalTurns: 1 }],
    completionGold: 10,
    timeBonusGold: 5,
  },
  // Wave 2 — RAVAGERS join the runners: two closing threats at once.
  {
    id: "saltmere-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 14,
    timeBonusGold: 6,
  },
  // Wave 3 — HEXERS debut with a wisp overhead: a back-line poke plus the
  // campaign's first flyer, ignoring any walls the player has built.
  {
    id: "saltmere-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "hexer", count: 3, startTurn: 1, intervalTurns: 2 },
      { enemyId: "wisp", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 19,
    timeBonusGold: 7,
  },
  // Wave 4 — THE DEEP GUARD. Armoured wardens escorted by a swarm of
  // throwaway swarmlings — single-target fire alone won't clear the swarm.
  {
    id: "saltmere-wave-4",
    turnLimit: 11,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "swarmling", count: 4, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  // Wave 5 — SWELL. Razorwings add air pressure to the returning ravagers
  // and a hexer, right before the finale.
  {
    id: "saltmere-wave-5",
    turnLimit: 12,
    spawns: [
      { enemyId: "razorwing", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
      { enemyId: "hexer", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 31,
    timeBonusGold: 10,
  },
  // Wave 6 — THE FINALE. The Tidelord surges in behind a warden, a razorwing,
  // and a swarm of swarmlings. Pays the campaign's largest purse.
  {
    id: "saltmere-wave-6",
    turnLimit: 15,
    spawns: [
      { enemyId: "warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "razorwing", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "swarmling", count: 3, startTurn: 2, intervalTurns: 1 },
      { enemyId: "tidelord", count: 1, startTurn: 4, intervalTurns: 1 },
    ],
    completionGold: 58,
    timeBonusGold: 18,
  },
];

/**
 * Phase 22 (magic-item expansion): Emberford Reach's own curated loot pool —
 * every potion (universal, no theme to gate) plus a fire/aggressive-themed
 * equipment subset. Every hero's basic-attack/AC-relevant magic item stays
 * reachable; nothing here is a new item, just a themed SELECTION of the
 * full catalog (see `data/magicItems.ts`/`data/equipment.ts`).
 */
const EMBERFORD_LOOT_POOL: string[] = [
  ...POTION_ORDER,
  "flame-tongue",
  "amulet-of-withering",
  "ring-of-resistance",
  "bracers-of-defense",
  "aegis-of-the-first-ward",
  "cape-of-billowing",
  "ring-of-protection",
];

/** Phase 22: Saltmere Shallows' own curated loot pool — every potion plus a water/defensive-themed equipment subset. */
const SALTMERE_LOOT_POOL: string[] = [
  ...POTION_ORDER,
  "frost-brand",
  "signet-of-kinship",
  "ring-of-free-action",
  "cloak-of-protection",
  "robe-of-the-archmagi",
  "luckstone",
  "boots-of-speed",
];

/**
 * D-177 (KI-098 item 13): the first real use of D-118's `chapters` structure
 * — Emberford Reach and Saltmere Shallows each split into the 4-chapter
 * region shape `CAMPAIGN_STORY_DESIGN.md` §2 specifies (Ch1 levels 1-5 ends
 * in a miniboss, Ch2 6-10 a first, lighter encounter with the region's real
 * boss, Ch3 11-15 a branch-payoff chapter reusing the established roster at
 * higher counts, Ch4 16-20 the boss at full strength). Chapter names are
 * deliberately bare/structural, not narrative — the actual chapter-boundary
 * story writing (`introText`/`outroText`) is a separate, later pass (see
 * CAMPAIGN_STORY_DESIGN.md §9's "still open" list); this pass is pure
 * structure/content-authoring, matching what Kevin asked for this session.
 *
 * Ch4 in both regions is an EXACT reuse of the existing flat 6-wave
 * `EMBERFORD_WAVES`/`SALTMERE_WAVES` (same array, same top-level `waves`/
 * `bossEnemyId` fields per `ChapterDefinition`'s own "describe the finale"
 * contract) — zero regression risk for the one chapter every existing test
 * already validates.
 *
 * Saltmere's Ch1 uses `tide-wretch` (`data/enemies.ts`) instead of a real
 * named miniboss — see that enemy's own comment for why (the design doc's
 * "returning miniboss" mechanic isn't buildable yet).
 */
const EMBERFORD_CH1_WAVES: WaveDefinition[] = [
  { id: "emberford-ch1-wave-1", turnLimit: 8, spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "emberford-ch1-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 13,
    timeBonusGold: 6,
  },
  {
    id: "emberford-ch1-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
  {
    id: "emberford-ch1-wave-4",
    turnLimit: 12,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "basalt-colossus", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 32,
    timeBonusGold: 10,
  },
];

const EMBERFORD_CH2_WAVES: WaveDefinition[] = [
  {
    id: "emberford-ch2-wave-1",
    turnLimit: 10,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 20,
    timeBonusGold: 7,
  },
  {
    id: "emberford-ch2-wave-2",
    turnLimit: 11,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "emberford-ch2-wave-3",
    turnLimit: 12,
    spawns: [
      { enemyId: "warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "blightcaller", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 28,
    timeBonusGold: 9,
  },
  {
    id: "emberford-ch2-wave-4",
    turnLimit: 13,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "cinderlord", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 40,
    timeBonusGold: 12,
  },
];

const EMBERFORD_CH3_WAVES: WaveDefinition[] = [
  {
    id: "emberford-ch3-wave-1",
    turnLimit: 12,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 34,
    timeBonusGold: 10,
  },
  {
    id: "emberford-ch3-wave-2",
    turnLimit: 13,
    spawns: [
      { enemyId: "brute", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 38,
    timeBonusGold: 11,
  },
  {
    id: "emberford-ch3-wave-3",
    turnLimit: 14,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "brute", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 42,
    timeBonusGold: 12,
  },
  {
    id: "emberford-ch3-wave-4",
    turnLimit: 14,
    spawns: [
      { enemyId: "ravager", count: 3, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 46,
    timeBonusGold: 13,
  },
];

const SALTMERE_CH1_WAVES: WaveDefinition[] = [
  { id: "saltmere-ch1-wave-1", turnLimit: 8, spawns: [{ enemyId: "runner", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "saltmere-ch1-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 13,
    timeBonusGold: 6,
  },
  {
    id: "saltmere-ch1-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "runner", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
  {
    id: "saltmere-ch1-wave-4",
    turnLimit: 12,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "tide-wretch", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 32,
    timeBonusGold: 10,
  },
];

const SALTMERE_CH2_WAVES: WaveDefinition[] = [
  {
    id: "saltmere-ch2-wave-1",
    turnLimit: 10,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "cave-drake", count: 1, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 20,
    timeBonusGold: 7,
  },
  {
    id: "saltmere-ch2-wave-2",
    turnLimit: 11,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "frost-warden", count: 1, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "saltmere-ch2-wave-3",
    turnLimit: 12,
    spawns: [
      { enemyId: "warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "swarmling", count: 2, startTurn: 2, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 28,
    timeBonusGold: 9,
  },
  {
    id: "saltmere-ch2-wave-4",
    turnLimit: 13,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "tidelord", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 42,
    timeBonusGold: 12,
  },
];

const SALTMERE_CH3_WAVES: WaveDefinition[] = [
  {
    id: "saltmere-ch3-wave-1",
    turnLimit: 12,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "swarmling", count: 3, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 34,
    timeBonusGold: 10,
  },
  {
    id: "saltmere-ch3-wave-2",
    turnLimit: 13,
    spawns: [
      { enemyId: "razorwing", count: 1, startTurn: 1, intervalTurns: 2 },
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 38,
    timeBonusGold: 11,
  },
  {
    id: "saltmere-ch3-wave-3",
    turnLimit: 14,
    spawns: [
      { enemyId: "warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "wisp", count: 1, startTurn: 1, intervalTurns: 2 },
      { enemyId: "swarmling", count: 3, startTurn: 2, intervalTurns: 1 },
      { enemyId: "razorwing", count: 1, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 42,
    timeBonusGold: 12,
  },
  {
    id: "saltmere-ch3-wave-4",
    turnLimit: 14,
    spawns: [
      { enemyId: "razorwing", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 46,
    timeBonusGold: 13,
  },
];

/**
 * D-180 (KI-098 item 13, continuing D-179): the other four of
 * `CAMPAIGN_STORY_DESIGN.md` §3's six regions — Shattered Causeway,
 * Cinderfall Rift, The Drowning Vale, Frostbound Hollow — none of which had
 * a `CampaignDefinition` at all before this pass (unlike Emberford/Saltmere,
 * which existed as flat campaigns already; these four maps were Free-Play-
 * only). Each gets the same 4-chapter shape D-179 established: Ch1 (1-5)
 * ends in its own miniboss, Ch2 (6-10) a lighter first encounter with the
 * region's real boss, Ch3 (11-15) remixes the established roster at higher
 * counts, Ch4 (16-20) is the same flat 6-wave finale used as this
 * campaign's own top-level `waves` (same array reference, zero regression
 * risk, matching D-179's own "describe the finale" contract for
 * `ChapterDefinition`). Boss assignments are `CAMPAIGN_STORY_DESIGN.md` §3's
 * own table: Causeway (Juggernaut / The Devourer), Cinderfall Rift
 * (Gravemaw / Warlord Korrath), Drowning Vale (The Husk / Blightmother),
 * Frostbound Hollow (Bloodrage Warlord / Sundered King) — all eight enemies
 * already existed in `data/enemies.ts` (Phase 20/21), so unlike D-179's
 * Saltmere fallback, no new enemy was needed here.
 */

// ----- Shattered Causeway (chasm/pit crossing) -----------------------------

const CAUSEWAY_CH1_WAVES: WaveDefinition[] = [
  { id: "causeway-ch1-wave-1", turnLimit: 8, spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "causeway-ch1-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "runner", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 13,
    timeBonusGold: 6,
  },
  {
    id: "causeway-ch1-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
  {
    id: "causeway-ch1-wave-4",
    turnLimit: 12,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "juggernaut", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 32,
    timeBonusGold: 10,
  },
];

const CAUSEWAY_CH2_WAVES: WaveDefinition[] = [
  {
    id: "causeway-ch2-wave-1",
    turnLimit: 10,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 20,
    timeBonusGold: 7,
  },
  {
    id: "causeway-ch2-wave-2",
    turnLimit: 11,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "causeway-ch2-wave-3",
    turnLimit: 12,
    spawns: [
      { enemyId: "warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "gilded-carrier", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 28,
    timeBonusGold: 9,
  },
  {
    id: "causeway-ch2-wave-4",
    turnLimit: 13,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "the-devourer", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 41,
    timeBonusGold: 12,
  },
];

const CAUSEWAY_CH3_WAVES: WaveDefinition[] = [
  {
    id: "causeway-ch3-wave-1",
    turnLimit: 12,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 34,
    timeBonusGold: 10,
  },
  {
    id: "causeway-ch3-wave-2",
    turnLimit: 13,
    spawns: [
      { enemyId: "marauder", count: 3, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
    ],
    completionGold: 38,
    timeBonusGold: 11,
  },
  {
    id: "causeway-ch3-wave-3",
    turnLimit: 14,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "bolt-runner", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 42,
    timeBonusGold: 12,
  },
  {
    id: "causeway-ch3-wave-4",
    turnLimit: 14,
    spawns: [
      { enemyId: "ravager", count: 3, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 46,
    timeBonusGold: 13,
  },
];

const CAUSEWAY_WAVES: WaveDefinition[] = [
  { id: "causeway-wave-1", turnLimit: 8, spawns: [{ enemyId: "runner", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "causeway-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 14,
    timeBonusGold: 6,
  },
  {
    id: "causeway-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "hexer", count: 3, startTurn: 1, intervalTurns: 2 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 18,
    timeBonusGold: 7,
  },
  {
    id: "causeway-wave-4",
    turnLimit: 11,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "brute", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "causeway-wave-5",
    turnLimit: 12,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "gilded-carrier", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 30,
    timeBonusGold: 10,
  },
  {
    id: "causeway-wave-6",
    turnLimit: 15,
    spawns: [
      { enemyId: "brute", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "the-devourer", count: 1, startTurn: 4, intervalTurns: 1 },
    ],
    completionGold: 56,
    timeBonusGold: 18,
  },
];

const CAUSEWAY_LOOT_POOL: string[] = [
  ...POTION_ORDER,
  "boots-of-striding-and-springing",
  "swift-greaves",
  "wand-of-web",
  "dagger-of-venom",
  "travelers-cloak",
  "iron-buckler",
];

// ----- Cinderfall Rift (volcanic, collapsing bridge) -----------------------

const CINDERFALL_CH1_WAVES: WaveDefinition[] = [
  { id: "cinderfall-ch1-wave-1", turnLimit: 8, spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "cinderfall-ch1-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 13,
    timeBonusGold: 6,
  },
  {
    id: "cinderfall-ch1-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "marauder", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
  {
    id: "cinderfall-ch1-wave-4",
    turnLimit: 12,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "gravemaw", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 32,
    timeBonusGold: 10,
  },
];

const CINDERFALL_CH2_WAVES: WaveDefinition[] = [
  {
    id: "cinderfall-ch2-wave-1",
    turnLimit: 10,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 20,
    timeBonusGold: 7,
  },
  {
    id: "cinderfall-ch2-wave-2",
    turnLimit: 11,
    spawns: [
      { enemyId: "warcaptain", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "cinderfall-ch2-wave-3",
    turnLimit: 12,
    spawns: [
      { enemyId: "bannerbearer", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 28,
    timeBonusGold: 9,
  },
  {
    id: "cinderfall-ch2-wave-4",
    turnLimit: 13,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "warlord-korrath", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 40,
    timeBonusGold: 12,
  },
];

const CINDERFALL_CH3_WAVES: WaveDefinition[] = [
  {
    id: "cinderfall-ch3-wave-1",
    turnLimit: 12,
    spawns: [
      { enemyId: "warcaptain", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 34,
    timeBonusGold: 10,
  },
  {
    id: "cinderfall-ch3-wave-2",
    turnLimit: 13,
    spawns: [
      { enemyId: "bannerbearer", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "battlepriest", count: 1, startTurn: 1, intervalTurns: 2 },
      { enemyId: "grunt", count: 2, startTurn: 2, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 38,
    timeBonusGold: 11,
  },
  {
    id: "cinderfall-ch3-wave-3",
    turnLimit: 14,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "marauder", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "warcaptain", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 42,
    timeBonusGold: 12,
  },
  {
    id: "cinderfall-ch3-wave-4",
    turnLimit: 14,
    spawns: [
      { enemyId: "ravager", count: 3, startTurn: 1, intervalTurns: 1 },
      { enemyId: "bannerbearer", count: 1, startTurn: 1, intervalTurns: 2 },
      { enemyId: "battlepriest", count: 1, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 46,
    timeBonusGold: 13,
  },
];

const CINDERFALL_WAVES: WaveDefinition[] = [
  { id: "cinderfall-wave-1", turnLimit: 8, spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "cinderfall-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 14,
    timeBonusGold: 6,
  },
  {
    id: "cinderfall-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "marauder", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "warcaptain", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 18,
    timeBonusGold: 7,
  },
  {
    id: "cinderfall-wave-4",
    turnLimit: 11,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "bannerbearer", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "cinderfall-wave-5",
    turnLimit: 12,
    spawns: [
      { enemyId: "battlepriest", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "marauder", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 30,
    timeBonusGold: 10,
  },
  {
    id: "cinderfall-wave-6",
    turnLimit: 15,
    spawns: [
      { enemyId: "warcaptain", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "bannerbearer", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "warlord-korrath", count: 1, startTurn: 4, intervalTurns: 1 },
    ],
    completionGold: 55,
    timeBonusGold: 18,
  },
];

const CINDERFALL_LOOT_POOL: string[] = [
  ...POTION_ORDER,
  "greaves-of-the-berserker",
  "amulet-of-fury",
  "whetstone-band",
  "gauntlets-of-ogre-power",
  "boots-of-the-brawler",
  "chainmail-vest",
];

// ----- The Drowning Vale (tidal marsh) -------------------------------------

const DROWNING_VALE_CH1_WAVES: WaveDefinition[] = [
  { id: "drowning-vale-ch1-wave-1", turnLimit: 8, spawns: [{ enemyId: "runner", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "drowning-vale-ch1-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "hexer", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 13,
    timeBonusGold: 6,
  },
  {
    id: "drowning-vale-ch1-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "fungal-splitter", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
  {
    id: "drowning-vale-ch1-wave-4",
    turnLimit: 12,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "the-husk", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 32,
    timeBonusGold: 10,
  },
];

const DROWNING_VALE_CH2_WAVES: WaveDefinition[] = [
  {
    id: "drowning-vale-ch2-wave-1",
    turnLimit: 10,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "blightcaller", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 20,
    timeBonusGold: 7,
  },
  {
    id: "drowning-vale-ch2-wave-2",
    turnLimit: 11,
    spawns: [
      { enemyId: "fungal-splitter", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "hexer", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "drowning-vale-ch2-wave-3",
    turnLimit: 12,
    spawns: [
      { enemyId: "plague-warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "blightcaller", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "hexer", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 28,
    timeBonusGold: 9,
  },
  {
    id: "drowning-vale-ch2-wave-4",
    turnLimit: 13,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "blightmother", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 40,
    timeBonusGold: 12,
  },
];

const DROWNING_VALE_CH3_WAVES: WaveDefinition[] = [
  {
    id: "drowning-vale-ch3-wave-1",
    turnLimit: 12,
    spawns: [
      { enemyId: "blightcaller", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "fungal-splitter", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 34,
    timeBonusGold: 10,
  },
  {
    id: "drowning-vale-ch3-wave-2",
    turnLimit: 13,
    spawns: [
      { enemyId: "plague-warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexbinder", count: 1, startTurn: 1, intervalTurns: 2 },
      { enemyId: "blightcaller", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 38,
    timeBonusGold: 11,
  },
  {
    id: "drowning-vale-ch3-wave-3",
    turnLimit: 14,
    spawns: [
      { enemyId: "fungal-splitter", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "plague-warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 42,
    timeBonusGold: 12,
  },
  {
    id: "drowning-vale-ch3-wave-4",
    turnLimit: 14,
    spawns: [
      { enemyId: "blightcaller", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexbinder", count: 1, startTurn: 1, intervalTurns: 2 },
      { enemyId: "plague-warden", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "hexer", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 46,
    timeBonusGold: 13,
  },
];

const DROWNING_VALE_WAVES: WaveDefinition[] = [
  { id: "drowning-vale-wave-1", turnLimit: 8, spawns: [{ enemyId: "runner", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "drowning-vale-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 14,
    timeBonusGold: 6,
  },
  {
    id: "drowning-vale-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "fungal-splitter", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "blightcaller", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 18,
    timeBonusGold: 7,
  },
  {
    id: "drowning-vale-wave-4",
    turnLimit: 11,
    spawns: [
      { enemyId: "plague-warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexbinder", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "drowning-vale-wave-5",
    turnLimit: 12,
    spawns: [
      { enemyId: "blightcaller", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "fungal-splitter", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "plague-warden", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 30,
    timeBonusGold: 10,
  },
  {
    id: "drowning-vale-wave-6",
    turnLimit: 15,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "plague-warden", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "blightmother", count: 1, startTurn: 4, intervalTurns: 1 },
    ],
    completionGold: 55,
    timeBonusGold: 18,
  },
];

const DROWNING_VALE_LOOT_POOL: string[] = [
  ...POTION_ORDER,
  "amulet-of-withering",
  "periapt-of-proof-against-poison",
  "staff-of-healing",
  "amulet-of-warding",
  "circlet-of-focus",
  "band-of-vigor",
];

// ----- Frostbound Hollow (verticality, frozen ridge) -----------------------

const FROSTBOUND_CH1_WAVES: WaveDefinition[] = [
  { id: "frostbound-ch1-wave-1", turnLimit: 8, spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "frostbound-ch1-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "wisp", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 13,
    timeBonusGold: 6,
  },
  {
    id: "frostbound-ch1-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "frost-warden", count: 1, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
  {
    id: "frostbound-ch1-wave-4",
    turnLimit: 12,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "bloodrage-warlord", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 32,
    timeBonusGold: 10,
  },
];

const FROSTBOUND_CH2_WAVES: WaveDefinition[] = [
  {
    id: "frostbound-ch2-wave-1",
    turnLimit: 10,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "frost-warden", count: 1, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 20,
    timeBonusGold: 7,
  },
  {
    id: "frostbound-ch2-wave-2",
    turnLimit: 11,
    spawns: [
      { enemyId: "razorwing", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "frostbound-ch2-wave-3",
    turnLimit: 12,
    spawns: [
      { enemyId: "ironhide", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ravager", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 28,
    timeBonusGold: 9,
  },
  {
    id: "frostbound-ch2-wave-4",
    turnLimit: 13,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "sundered-king", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 40,
    timeBonusGold: 12,
  },
];

const FROSTBOUND_CH3_WAVES: WaveDefinition[] = [
  {
    id: "frostbound-ch3-wave-1",
    turnLimit: 12,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "frost-warden", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 34,
    timeBonusGold: 10,
  },
  {
    id: "frostbound-ch3-wave-2",
    turnLimit: 13,
    spawns: [
      { enemyId: "razorwing", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ironhide", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 38,
    timeBonusGold: 11,
  },
  {
    id: "frostbound-ch3-wave-3",
    turnLimit: 14,
    spawns: [
      { enemyId: "frost-warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "razorwing", count: 1, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 42,
    timeBonusGold: 12,
  },
  {
    id: "frostbound-ch3-wave-4",
    turnLimit: 14,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ironhide", count: 1, startTurn: 1, intervalTurns: 2 },
      { enemyId: "frost-warden", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "razorwing", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 46,
    timeBonusGold: 13,
  },
];

const FROSTBOUND_WAVES: WaveDefinition[] = [
  { id: "frostbound-wave-1", turnLimit: 8, spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10, timeBonusGold: 5 },
  {
    id: "frostbound-wave-2",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "wisp", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 14,
    timeBonusGold: 6,
  },
  {
    id: "frostbound-wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "frost-warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 18,
    timeBonusGold: 7,
  },
  {
    id: "frostbound-wave-4",
    turnLimit: 11,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "razorwing", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 24,
    timeBonusGold: 8,
  },
  {
    id: "frostbound-wave-5",
    turnLimit: 12,
    spawns: [
      { enemyId: "ironhide", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "frost-warden", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "razorwing", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 30,
    timeBonusGold: 10,
  },
  {
    id: "frostbound-wave-6",
    turnLimit: 15,
    spawns: [
      { enemyId: "warden", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ironhide", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "frost-warden", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "sundered-king", count: 1, startTurn: 4, intervalTurns: 1 },
    ],
    completionGold: 55,
    timeBonusGold: 18,
  },
];

const FROSTBOUND_LOOT_POOL: string[] = [
  ...POTION_ORDER,
  "frost-brand",
  "ring-of-frostbite",
  "bracers-of-archery",
  "headband-of-intellect",
  "amulet-of-health",
  "leather-cap",
];

// ----- The Nameless Throne (D-188: the campaign capstone) -----------------

/**
 * D-188 (CAMPAIGN_STORY_DESIGN.md §5, KI-098 item 13's last remaining
 * piece): one climactic finale battle, not a second 4-chapter region —
 * deliberately flat, same shape as the Proving Ground prologue. Scaled
 * above every region's own Chapter 4 finale. This is the Ashen Sovereign-
 * dressed baseline; `NamelessThroneSystem.withThroneEnemyReskins` derives
 * the Hollow Empress variant from this exact same list at battle-load
 * time — no second wave list is authored.
 */
const NAMELESS_THRONE_WAVES: WaveDefinition[] = [
  {
    id: "nameless-throne-wave-1",
    turnLimit: 10,
    spawns: [
      { enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 22,
    timeBonusGold: 8,
  },
  {
    id: "nameless-throne-wave-2",
    turnLimit: 11,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ember-thane", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 28,
    timeBonusGold: 9,
  },
  {
    id: "nameless-throne-wave-3",
    turnLimit: 12,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "cinder-adept", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 34,
    timeBonusGold: 10,
  },
  {
    id: "nameless-throne-wave-4",
    turnLimit: 13,
    spawns: [
      { enemyId: "ember-thane", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "cinder-adept", count: 2, startTurn: 2, intervalTurns: 1 },
      { enemyId: "ironhide", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 42,
    timeBonusGold: 13,
  },
  {
    id: "nameless-throne-wave-5",
    turnLimit: 14,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ashbound-honor-guard", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 52,
    timeBonusGold: 16,
  },
  {
    id: "nameless-throne-wave-6",
    turnLimit: 18,
    spawns: [
      { enemyId: "ember-thane", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "cinder-adept", count: 1, startTurn: 2, intervalTurns: 2 },
      { enemyId: "warden", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "ashen-sovereign", count: 1, startTurn: 5, intervalTurns: 1 },
    ],
    completionGold: 95,
    timeBonusGold: 26,
  },
];

/**
 * D-188: deliberately theme-agnostic (combines the fire- and frost/water-
 * themed pools rather than picking one) since the finale itself is
 * theme-agnostic until `NamelessThroneSystem.resolveThroneVariant` resolves.
 */
const NAMELESS_THRONE_LOOT_POOL: string[] = [
  ...POTION_ORDER,
  "flame-tongue",
  "frost-brand",
  "robe-of-the-archmagi",
  "aegis-of-the-first-ward",
  "boots-of-speed",
  "ring-of-free-action",
];

export const CAMPAIGNS: CampaignDefinition[] = [
  {
    id: PROLOGUE_CAMPAIGN_ID,
    name: "The Proving Ground",
    description:
      "Before the six roads open, every party proves itself here first. No banners, no names — just the first real fight.",
    mapId: PROLOGUE_MAP.id,
    waves: PROLOGUE_WAVES,
    bossEnemyId: "brute",
    lootPoolIds: [...POTION_ORDER],
    // D-217: a short level-1 intro — every new campaign starts at
    // campaignLevel 1, and this mission shouldn't ramp that up at all.
    levelRange: [1, 1],
  },
  {
    id: "emberford-reach",
    name: "Emberford Reach",
    description:
      "A volcanic crossing scarred by cliff and cinder. Something with a furnace for a heart is waiting at the far shore.",
    mapId: EMBERFORD_MAP.id,
    waves: EMBERFORD_WAVES,
    bossEnemyId: "cinderlord",
    lootPoolIds: EMBERFORD_LOOT_POOL,
    chapters: [
      {
        id: "emberford-ch1",
        name: "Emberford Reach — Chapter 1",
        levelRange: [1, 5],
        waves: EMBERFORD_CH1_WAVES,
        bossEnemyId: "basalt-colossus",
        introText:
          "The road into Emberford Reach is scorched black, cliffs cut by old lava scars. Whatever's raiding this crossing hits hard and fast, and it isn't finished yet.",
        outroText:
          "The immediate threat is down, but the smoke over Emberford hasn't cleared — and somewhere past it, a forge is still burning that shouldn't be.",
      },
      {
        id: "emberford-ch2",
        name: "Emberford Reach — Chapter 2",
        levelRange: [6, 10],
        waves: EMBERFORD_CH2_WAVES,
        bossEnemyId: "cinderlord",
        introText:
          "Deeper into Emberford Reach, the heat gets worse before it gets honest — this is close enough to Cinderlord's furnace to feel it for the first time.",
        outroText:
          "Cinderlord retreats deeper into the furnace-heart of the Reach, wounded but far from finished. Whatever's left of the smith in him hasn't shown itself yet.",
      },
      {
        id: "emberford-ch3",
        name: "Emberford Reach — Chapter 3",
        levelRange: [11, 15],
        waves: EMBERFORD_CH3_WAVES,
        introText: "Emberford's ash fields stretch wider than the maps say — every step here is a step Cinderlord's forge has already claimed.",
        outroText: "The ash fields are cleared, and the road ahead runs straight for the furnace. There's no plausible detour left.",
      },
      {
        id: "emberford-ch4",
        name: "Emberford Reach — Chapter 4",
        levelRange: [16, 20],
        waves: EMBERFORD_WAVES,
        bossEnemyId: "cinderlord",
        lootPoolIds: EMBERFORD_LOOT_POOL,
        introText: "The furnace-heart of Emberford Reach: Cinderlord's forge, and Cinderlord himself, still hammering at something that was a name once.",
        outroText: "Cinderlord's hammer finally stops. Emberford Reach is quiet, for the first time in longer than anyone here can remember.",
      },
    ],
  },
  {
    id: "saltmere-shallows",
    name: "Saltmere Shallows",
    description:
      "A drowned village's tideflats, walked by things that shouldn't still be walking. The sea wall gave out for a reason.",
    mapId: SALTMERE_MAP.id,
    waves: SALTMERE_WAVES,
    bossEnemyId: "tidelord",
    lootPoolIds: SALTMERE_LOOT_POOL,
    chapters: [
      {
        id: "saltmere-ch1",
        name: "Saltmere Shallows — Chapter 1",
        levelRange: [1, 5],
        waves: SALTMERE_CH1_WAVES,
        bossEnemyId: "tide-wretch",
        introText: "Saltmere's sea wall gave out for a reason, and the tideflats it flooded are still full of things that shouldn't still be walking.",
        outroText:
          "The shallows are quieter now, though the tide doesn't feel finished with this place. Somewhere out past the wreckage, Tidelord is still listening.",
      },
      {
        id: "saltmere-ch2",
        name: "Saltmere Shallows — Chapter 2",
        levelRange: [6, 10],
        waves: SALTMERE_CH2_WAVES,
        bossEnemyId: "tidelord",
        introText: "Deeper into the drowned village, the water gets stranger — Tidelord has never once let go of a single thing the tide brought it.",
        outroText: "Tidelord slips back under the tide, unhurried. It has all the time the sea has ever had.",
      },
      {
        id: "saltmere-ch3",
        name: "Saltmere Shallows — Chapter 3",
        levelRange: [11, 15],
        waves: SALTMERE_CH3_WAVES,
        introText: "The flooded streets of Saltmere run deeper than any map admits. Whatever the tide still holds onto is close now.",
        outroText: "The last dry ground in Saltmere is behind you. Ahead is nothing but Tidelord's own water, all the way down.",
      },
      {
        id: "saltmere-ch4",
        name: "Saltmere Shallows — Chapter 4",
        levelRange: [16, 20],
        waves: SALTMERE_WAVES,
        bossEnemyId: "tidelord",
        lootPoolIds: SALTMERE_LOOT_POOL,
        introText: "The deep shallows, where Tidelord keeps its drowned crew close and still calls every one of them by name.",
        outroText: "Tidelord goes still in the shallows, and for the first time in longer than anyone can say, the water here is just water.",
      },
    ],
  },
  {
    id: "shattered-causeway",
    name: "Shattered Causeway",
    description:
      "A single unstable bridge is the only way across the chasm — and something that has never once gone around anything is waiting on the far side.",
    mapId: CAUSEWAY_MAP.id,
    waves: CAUSEWAY_WAVES,
    bossEnemyId: "the-devourer",
    lootPoolIds: CAUSEWAY_LOOT_POOL,
    chapters: [
      {
        id: "causeway-ch1",
        name: "Shattered Causeway — Chapter 1",
        levelRange: [1, 5],
        waves: CAUSEWAY_CH1_WAVES,
        bossEnemyId: "juggernaut",
        introText:
          "The Shattered Causeway is one unstable bridge over a chasm that doesn't forgive a wrong step — and something big enough to feel through the stone is already crossing from the other side.",
        outroText: "The bridge holds, for now. Whatever's waiting at the far end of the Causeway has had a very long time to get hungry.",
      },
      {
        id: "causeway-ch2",
        name: "Shattered Causeway — Chapter 2",
        levelRange: [6, 10],
        waves: CAUSEWAY_CH2_WAVES,
        bossEnemyId: "the-devourer",
        introText:
          "Past the first crossing, the chasm walls are lined with old wreckage — everything The Devourer has ever swallowed, still down there, still not quite gone.",
        outroText: "The Devourer pulls back into the deep chasm dark, unsatisfied. It has never once needed to be patient before.",
      },
      {
        id: "causeway-ch3",
        name: "Shattered Causeway — Chapter 3",
        levelRange: [11, 15],
        waves: CAUSEWAY_CH3_WAVES,
        introText:
          "The Causeway narrows further here — every bridge on this stretch was clearly built to be crossed once, by someone who didn't plan on coming back.",
        outroText: "The far side of the chasm is finally in sight. There's nowhere left for The Devourer to retreat to.",
      },
      {
        id: "causeway-ch4",
        name: "Shattered Causeway — Chapter 4",
        levelRange: [16, 20],
        waves: CAUSEWAY_WAVES,
        bossEnemyId: "the-devourer",
        lootPoolIds: CAUSEWAY_LOOT_POOL,
        introText: "The chasm floor, at last — a hoard of everything The Devourer has ever taken, with The Devourer still sitting in the middle of it, still keeping.",
        outroText: "The Devourer stops moving, and for the first time in a long time, everything it was keeping stays still too.",
      },
    ],
  },
  {
    id: "cinderfall-rift",
    name: "Cinderfall Rift",
    description:
      "Three roads cross an old battlefield on a volcanic rift, and the middle one won't hold forever. Something that has never had to swing a blade itself is watching from behind the line.",
    mapId: CINDERFALL_RIFT_MAP.id,
    waves: CINDERFALL_WAVES,
    bossEnemyId: "warlord-korrath",
    lootPoolIds: CINDERFALL_LOOT_POOL,
    chapters: [
      {
        id: "cinderfall-ch1",
        name: "Cinderfall Rift — Chapter 1",
        levelRange: [1, 5],
        waves: CINDERFALL_CH1_WAVES,
        bossEnemyId: "gravemaw",
        introText:
          "Cinderfall Rift was a battlefield once, and it never quite stopped being one — the middle road across the rift is already giving way underfoot.",
        outroText: "The rift road holds, barely. Whatever remembers this battlefield best is still out there, and it isn't finished remembering.",
      },
      {
        id: "cinderfall-ch2",
        name: "Cinderfall Rift — Chapter 2",
        levelRange: [6, 10],
        waves: CINDERFALL_CH2_WAVES,
        bossEnemyId: "warlord-korrath",
        introText:
          "Deeper into the Rift, old banners are still standing where they fell — Warlord Korrath has never once needed to fight for any of this himself.",
        outroText: "Korrath pulls his line back rather than risk it, and lets someone else take the losses instead — same as always.",
      },
      {
        id: "cinderfall-ch3",
        name: "Cinderfall Rift — Chapter 3",
        levelRange: [11, 15],
        waves: CINDERFALL_CH3_WAVES,
        introText: "The bridge over Cinderfall Rift's deepest crossing groans with every step now. It won't hold much longer, for anyone.",
        outroText: "The bridge is still standing, somehow. Korrath's own war is running out of road to fall back across.",
      },
      {
        id: "cinderfall-ch4",
        name: "Cinderfall Rift — Chapter 4",
        levelRange: [16, 20],
        waves: CINDERFALL_WAVES,
        bossEnemyId: "warlord-korrath",
        lootPoolIds: CINDERFALL_LOOT_POOL,
        introText:
          "The bridge finally starts to go, and on the far side of it, Warlord Korrath is standing exactly where he's always stood — behind the line.",
        outroText: "The bridge collapses behind what's left of Korrath's war. For the first time, he's the one with nowhere left to point.",
      },
    ],
  },
  {
    id: "drowning-vale",
    name: "The Drowning Vale",
    description:
      "A flooding marsh where nothing stays green for long. What looks like the worst thing out here almost never is.",
    mapId: DROWNING_VALE_MAP.id,
    waves: DROWNING_VALE_WAVES,
    bossEnemyId: "blightmother",
    lootPoolIds: DROWNING_VALE_LOOT_POOL,
    chapters: [
      {
        id: "drowning-vale-ch1",
        name: "The Drowning Vale — Chapter 1",
        levelRange: [1, 5],
        waves: DROWNING_VALE_CH1_WAVES,
        bossEnemyId: "the-husk",
        introText:
          "The Drowning Vale floods a little more every season, and nothing that stays green out here stays green for long — including, it turns out, the people who patrol it.",
        outroText: "The Vale's edge is cleared. What looked like the worst thing out here almost never is — and something worse is still watching from deeper in.",
      },
      {
        id: "drowning-vale-ch2",
        name: "The Drowning Vale — Chapter 2",
        levelRange: [6, 10],
        waves: DROWNING_VALE_CH2_WAVES,
        bossEnemyId: "blightmother",
        introText:
          "Further into the marsh, the ground itself starts working against you — Blightmother's ground, and it knows every inch of it better than any map does.",
        outroText: "Blightmother retreats into the deep marsh, and the ground she leaves behind doesn't feel any safer for it.",
      },
      {
        id: "drowning-vale-ch3",
        name: "The Drowning Vale — Chapter 3",
        levelRange: [11, 15],
        waves: DROWNING_VALE_CH3_WAVES,
        introText: "The Vale's deepest reaches barely count as solid ground anymore. Whatever's still fighting for itself out here is running out of places to stand.",
        outroText: "The marsh is nearly crossed. Whatever Blightmother's ground has left to claim, it's running out of time to claim it.",
      },
      {
        id: "drowning-vale-ch4",
        name: "The Drowning Vale — Chapter 4",
        levelRange: [16, 20],
        waves: DROWNING_VALE_WAVES,
        bossEnemyId: "blightmother",
        lootPoolIds: DROWNING_VALE_LOOT_POOL,
        introText: "Blightmother's own ground, at the Vale's rotten heart — the one place in this whole marsh that never lets go of anything.",
        outroText: "Blightmother's hold over the Vale finally breaks, and the ground underfoot feels like ground again for the first time in this whole fight.",
      },
    ],
  },
  {
    id: "frostbound-hollow",
    name: "Frostbound Hollow",
    description:
      "A frozen ridge splits the hollow clean in two, and something on the far side has been waiting a very long time to stop waiting.",
    mapId: FROSTBOUND_HOLLOW_MAP.id,
    waves: FROSTBOUND_WAVES,
    bossEnemyId: "sundered-king",
    lootPoolIds: FROSTBOUND_LOOT_POOL,
    chapters: [
      {
        id: "frostbound-ch1",
        name: "Frostbound Hollow — Chapter 1",
        levelRange: [1, 5],
        waves: FROSTBOUND_CH1_WAVES,
        bossEnemyId: "bloodrage-warlord",
        introText:
          "Frostbound Hollow is split clean in two by a ridge that's been frozen mid-collapse for longer than anyone alive remembers — and something on the far side has finally stopped waiting.",
        outroText: "This side of the ridge is cleared. The Sundered King hasn't moved yet — he's had a very long time to learn patience isn't the same as safety.",
      },
      {
        id: "frostbound-ch2",
        name: "Frostbound Hollow — Chapter 2",
        levelRange: [6, 10],
        waves: FROSTBOUND_CH2_WAVES,
        bossEnemyId: "sundered-king",
        introText:
          "Crossing the split ridge properly for the first time, the cold here isn't just weather — it's close enough now to feel like the King's own court, what's left of it.",
        outroText: "The Sundered King withdraws deeper into his fallen court without a word. He has never once needed to explain a retreat to anyone.",
      },
      {
        id: "frostbound-ch3",
        name: "Frostbound Hollow — Chapter 3",
        levelRange: [11, 15],
        waves: FROSTBOUND_CH3_WAVES,
        introText: "The far side of Frostbound Hollow's ridge is a court in ruins, still arranged as if someone were coming back to sit in it.",
        outroText: "The ruined court is nearly crossed. Whatever the Sundered King has been waiting for, this is clearly it.",
      },
      {
        id: "frostbound-ch4",
        name: "Frostbound Hollow — Chapter 4",
        levelRange: [16, 20],
        waves: FROSTBOUND_WAVES,
        bossEnemyId: "sundered-king",
        lootPoolIds: FROSTBOUND_LOOT_POOL,
        introText: "The Sundered King's own throne, what's left of it — and the King still seated on it, exactly where he's been sitting since the ridge split.",
        outroText: "The Sundered King finally falls, decades of waiting ending in one motion. Frostbound Hollow's ridge feels, for the first time, like it might actually be done splitting.",
      },
    ],
  },
  {
    id: NAMELESS_THRONE_CAMPAIGN_ID,
    name: "The Nameless Throne",
    description:
      "Six regions, six choices, one throne that was never really anyone's. Whatever answers there is the last thing standing between you and remembering your own name.",
    mapId: NAMELESS_THRONE_MAP.id,
    waves: NAMELESS_THRONE_WAVES,
    // D-188: static display baseline only — the real fight is resolved at
    // battle-load time by NamelessThroneSystem.resolveThroneVariant, per
    // this session's own scoping call (a deliberate non-spoiler, matching
    // how Saltmere's card always says "Boss: Tidelord" regardless of which
    // returning miniboss is actually incoming).
    bossEnemyId: "ashen-sovereign",
    lootPoolIds: NAMELESS_THRONE_LOOT_POOL,
    // D-217: gated behind clearing all 6 regions, so the player should
    // already be at campaignLevel 20 by the time they reach it — fought
    // entirely at the cap, no further ramp.
    levelRange: [20, 20],
  },
];

// ----- Pool A companion side-quest missions (KI-098 item 13, closes D-183's -
// ----- own deferred "side-quest missions" item) ----------------------------

/**
 * D-18x: one fixed, flat, one-time mission per Pool A companion (`data/
 * companions.ts`'s six class-coverage recruits) — the 3 not drawn into a
 * fresh save's random starting trio (`CompanionSeedSystem`) stay locked
 * until their own mission is cleared, at which point `BattleScene.
 * maybeUnlockSideMissionCompanion` recruits them onto the bench (never
 * force-active, same reasoning as the Pool B home-region unlock). Reached
 * from `CompanionRosterScene`'s own locked Pool A card, any time — unlike
 * The Proving Ground (D-184), nothing gates these.
 *
 * Deliberately NOT added to `CAMPAIGNS` — that array is exactly what
 * `CampaignSelectScene.buildCampaignCards` renders as a region card, and
 * these aren't regions. `getCampaignDefinition` below checks both arrays so
 * every other consumer (`BattleScene`, `CharacterCreationScene`) needs no
 * changes at all; a side mission is just a `campaignId` like any other flat
 * campaign as far as they're concerned.
 *
 * Each mission reuses one of the six existing region maps (no new map
 * authored — these are personal, not regional, so there's no map of their
 * own to build) and ends on an existing REGULAR-tier enemy loosely themed
 * to the companion, never a miniboss/boss/legendary — deliberately, so
 * these can never collide with the returning-miniboss spare/destroy
 * mechanic (`ReturningMinibossSystem`). Same 3-wave shape and low, fixed
 * difficulty as The Proving Ground (D-184) — first-pass numbers, same
 * every-campaign disclaimer: real balance is Kevin's own in-browser call,
 * doubly so here since these can be attempted at any point in a playthrough,
 * not just at level 1.
 */
const SIDE_MISSION_LOOT_POOL: string[] = [...POTION_ORDER];

const BRAND_ASHCAIRN_WAVES: WaveDefinition[] = [
  { id: "side-brand-wave-1", turnLimit: 7, spawns: [{ enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 9, timeBonusGold: 4 },
  {
    id: "side-brand-wave-2",
    turnLimit: 8,
    spawns: [
      { enemyId: "ravager", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "grunt", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 12,
    timeBonusGold: 5,
  },
  {
    id: "side-brand-wave-3",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "warcaptain", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
];

const WREN_CALLOWAY_WAVES: WaveDefinition[] = [
  { id: "side-wren-wave-1", turnLimit: 7, spawns: [{ enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 9, timeBonusGold: 4 },
  {
    id: "side-wren-wave-2",
    turnLimit: 8,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "runner", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 12,
    timeBonusGold: 5,
  },
  {
    id: "side-wren-wave-3",
    turnLimit: 9,
    spawns: [
      { enemyId: "hexer", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "gilded-carrier", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
];

const PERRIN_HOLT_WAVES: WaveDefinition[] = [
  { id: "side-perrin-wave-1", turnLimit: 7, spawns: [{ enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 9, timeBonusGold: 4 },
  {
    id: "side-perrin-wave-2",
    turnLimit: 8,
    spawns: [
      { enemyId: "hexer", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "runner", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 12,
    timeBonusGold: 5,
  },
  {
    id: "side-perrin-wave-3",
    turnLimit: 9,
    spawns: [
      { enemyId: "hexer", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "blightcaller", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
];

const MIRA_QUILL_WAVES: WaveDefinition[] = [
  { id: "side-mira-wave-1", turnLimit: 7, spawns: [{ enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 9, timeBonusGold: 4 },
  {
    id: "side-mira-wave-2",
    turnLimit: 8,
    spawns: [
      { enemyId: "wisp", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "grunt", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 12,
    timeBonusGold: 5,
  },
  {
    id: "side-mira-wave-3",
    turnLimit: 9,
    spawns: [
      { enemyId: "ravager", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "frost-warden", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
];

const CASS_FERROW_WAVES: WaveDefinition[] = [
  { id: "side-cass-wave-1", turnLimit: 7, spawns: [{ enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 9, timeBonusGold: 4 },
  {
    id: "side-cass-wave-2",
    turnLimit: 8,
    spawns: [
      { enemyId: "hexer", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ravager", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 12,
    timeBonusGold: 5,
  },
  {
    id: "side-cass-wave-3",
    turnLimit: 9,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "ironhide", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
];

const ELLERY_VANCE_WAVES: WaveDefinition[] = [
  { id: "side-ellery-wave-1", turnLimit: 7, spawns: [{ enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 9, timeBonusGold: 4 },
  {
    id: "side-ellery-wave-2",
    turnLimit: 8,
    spawns: [
      { enemyId: "wisp", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "hexer", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 12,
    timeBonusGold: 5,
  },
  {
    id: "side-ellery-wave-3",
    turnLimit: 9,
    spawns: [
      { enemyId: "hexer", count: 1, startTurn: 1, intervalTurns: 1 },
      { enemyId: "razorwing", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 16,
    timeBonusGold: 6,
  },
];

export const SIDE_MISSIONS: CampaignDefinition[] = [
  {
    id: "side-brand-ashcairn",
    name: "Brand Ashcairn — A Fair Wage",
    description:
      "A caravan job Brand took for coin turns into a real fight before the road's even half done — which, if anyone asked him, is usually how it goes.",
    mapId: CINDERFALL_RIFT_MAP.id,
    waves: BRAND_ASHCAIRN_WAVES,
    bossEnemyId: "warcaptain",
    lootPoolIds: SIDE_MISSION_LOOT_POOL,
    isSideMission: true,
  },
  {
    id: "side-wren-calloway",
    name: "Wren Calloway — Paid in Secrets",
    description:
      "Wren traded a song for a rumor about a courier route worth robbing — the rumor was good, the courier's escort less so.",
    mapId: CAUSEWAY_MAP.id,
    waves: WREN_CALLOWAY_WAVES,
    bossEnemyId: "gilded-carrier",
    lootPoolIds: SIDE_MISSION_LOOT_POOL,
    isSideMission: true,
  },
  {
    id: "side-perrin-holt",
    name: "Perrin Holt — Stopped Asking Why",
    description:
      "Word reaches Perrin of a sickness spreading through a waystation. They stopped asking why they always end up in these places years ago.",
    mapId: DROWNING_VALE_MAP.id,
    waves: PERRIN_HOLT_WAVES,
    bossEnemyId: "blightcaller",
    lootPoolIds: SIDE_MISSION_LOOT_POOL,
    isSideMission: true,
  },
  {
    id: "side-mira-quill",
    name: "Mira Quill — Outside the Walls",
    description:
      "Mira's discipline was easy inside a monastery. Whether it holds up out here, against something that never breaks its own stance either, is the actual question.",
    mapId: FROSTBOUND_HOLLOW_MAP.id,
    waves: MIRA_QUILL_WAVES,
    bossEnemyId: "frost-warden",
    lootPoolIds: SIDE_MISSION_LOOT_POOL,
    isSideMission: true,
  },
  {
    id: "side-cass-ferrow",
    name: "Cass Ferrow — Reading the Room",
    description:
      "Cass clocked the opening in this fight before anyone else finished walking into it. Whether that opening is actually there or just what they want to see is the part that gets tested.",
    mapId: EMBERFORD_MAP.id,
    waves: CASS_FERROW_WAVES,
    bossEnemyId: "ironhide",
    lootPoolIds: SIDE_MISSION_LOOT_POOL,
    isSideMission: true,
  },
  {
    id: "side-ellery-vance",
    name: "Ellery Vance — Surfacing",
    description:
      "Ellery's blood-magic picks its own moments. This time it picks a bad one, and something on the tideflats is drawn to it before Ellery even meant to reach for it.",
    mapId: SALTMERE_MAP.id,
    waves: ELLERY_VANCE_WAVES,
    bossEnemyId: "razorwing",
    lootPoolIds: SIDE_MISSION_LOOT_POOL,
    isSideMission: true,
  },
];

/** Every campaign's map, keyed by its `mapId` — the one seam that resolves a
 * `CampaignDefinition`'s `mapId` string back to the actual `ParsedMap` data
 * `BattleScene` needs to build a `GameMap` from. */
const CAMPAIGN_MAPS: Record<string, ParsedMap> = {
  [PROLOGUE_MAP.id]: PROLOGUE_MAP,
  [EMBERFORD_MAP.id]: EMBERFORD_MAP,
  [SALTMERE_MAP.id]: SALTMERE_MAP,
  [CAUSEWAY_MAP.id]: CAUSEWAY_MAP,
  [CINDERFALL_RIFT_MAP.id]: CINDERFALL_RIFT_MAP,
  [DROWNING_VALE_MAP.id]: DROWNING_VALE_MAP,
  [FROSTBOUND_HOLLOW_MAP.id]: FROSTBOUND_HOLLOW_MAP,
  [NAMELESS_THRONE_MAP.id]: NAMELESS_THRONE_MAP,
};

/** Look up a campaign, throwing on an unknown id — matches `getEnemyDefinition`'s convention. Checks both the region/prologue list and the Pool A side missions (kept as a separate array so they never render as `CampaignSelectScene` cards). */
export function getCampaignDefinition(id: string): CampaignDefinition {
  const def = CAMPAIGNS.find((c) => c.id === id) ?? SIDE_MISSIONS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown campaign id "${id}".`);
  return def;
}

/** Resolve a campaign's `mapId` to its actual `ParsedMap`, throwing on an unknown id. */
export function getCampaignMap(mapId: string): ParsedMap {
  const map = CAMPAIGN_MAPS[mapId];
  if (!map) throw new Error(`Unknown campaign map id "${mapId}".`);
  return map;
}
