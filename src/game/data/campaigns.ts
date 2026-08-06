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
