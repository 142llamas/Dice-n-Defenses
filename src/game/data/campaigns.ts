import type { WaveDefinition } from "./waves";
import { EMBERFORD_MAP } from "./emberfordMap";
import { SALTMERE_MAP } from "./saltmereMap";
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
      levelRange: [1, 20],
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

export const CAMPAIGNS: CampaignDefinition[] = [
  {
    id: "emberford-reach",
    name: "Emberford Reach",
    description:
      "A volcanic crossing scarred by cliff and cinder. Something with a furnace for a heart is waiting at the far shore.",
    mapId: EMBERFORD_MAP.id,
    waves: EMBERFORD_WAVES,
    bossEnemyId: "cinderlord",
    lootPoolIds: EMBERFORD_LOOT_POOL,
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
  },
];

/** Every campaign's map, keyed by its `mapId` — the one seam that resolves a
 * `CampaignDefinition`'s `mapId` string back to the actual `ParsedMap` data
 * `BattleScene` needs to build a `GameMap` from. */
const CAMPAIGN_MAPS: Record<string, ParsedMap> = {
  [EMBERFORD_MAP.id]: EMBERFORD_MAP,
  [SALTMERE_MAP.id]: SALTMERE_MAP,
};

/** Look up a campaign, throwing on an unknown id — matches `getEnemyDefinition`'s convention. */
export function getCampaignDefinition(id: string): CampaignDefinition {
  const def = CAMPAIGNS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown campaign id "${id}".`);
  return def;
}

/** Resolve a campaign's `mapId` to its actual `ParsedMap`, throwing on an unknown id. */
export function getCampaignMap(mapId: string): ParsedMap {
  const map = CAMPAIGN_MAPS[mapId];
  if (!map) throw new Error(`Unknown campaign map id "${mapId}".`);
  return map;
}
