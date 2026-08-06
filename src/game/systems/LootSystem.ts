import type { RandomService } from "./RandomService";
import type { EnemyRole } from "../data/enemies";
import {
  EQUIPMENT_ORDER,
  ENCHANT_RARITY,
  ENCHANT_LEVELS,
  enchantedItemId,
  enchantEligibleBaseIds,
  getEquipmentDefinition,
  type EquipmentRarity,
  type EnchantLevel,
} from "../data/equipment";
import { POTION_DEFINITIONS, POTION_ORDER, getPotionDefinition } from "../data/potions";

/**
 * LootSystem — Phase 22 (magic-item expansion)'s pure, tested loot-drop
 * engine. Kevin asked for enemy drop odds scaled by tier ("more powerful
 * enemies drop more powerful items"), an occasional one-tier-up lucky drop
 * from a lesser enemy, most enemies dropping nothing, campaign loot curated
 * as part of that campaign's own balance, and Free Play staying "more or
 * less random." This module is the whole design, kept deliberately simple:
 *
 * 1. **Drop chance by `EnemyRole`** (`DROP_CHANCE_BY_ROLE`): most minions
 *    drop nothing; a miniboss usually drops something; a boss/legendary
 *    always does. An enemy with no `role` (every pre-13.10 minion) is
 *    treated as `"minion"`.
 * 2. **Base rarity by role** (`BASE_RARITY_BY_ROLE`), with a flat
 *    `TIER_UP_CHANCE` roll to bump one tier higher — "every once in a while
 *    you get lucky and get something sweet from a lesser enemy," capped at
 *    `"legendary"` so nothing ever rolls off the top of the ladder.
 * 3. **What actually drops, at that rarity**: either a random NAMED catalog
 *    item (a potion or a hand-authored magic item of that rarity) or — for
 *    uncommon/rare/veryRare, where `ENCHANT_RARITY` maps to a real enchant
 *    level — a random enchant-ELIGIBLE mundane weapon/armor/shield, freshly
 *    generated as `"longsword+2"` via `equipment.ts`'s enchant overlay
 *    (Kevin's own scoping call, over a ~150-entry flat catalog — see
 *    `equipment.ts`'s own module comment). A coin flip between the two
 *    branches when both exist; the named-catalog branch alone when a
 *    rarity has no enchant level (`common`, `legendary`).
 *
 * Campaign-vs-Free-Play is a single `restrictToIds` parameter, not two code
 * paths: pass a campaign's own curated `lootPoolIds` (see
 * `data/campaigns.ts`) to restrict the NAMED-catalog branch to a themed
 * subset (falling back to the full pool if the restriction would leave a
 * rarity tier with nothing in it, so a narrow campaign pool can never
 * strand a drop); pass nothing (Free Play, and the classic 10-wave
 * campaign, which has no theme to curate around) for the full, unrestricted
 * pool. The enchant branch is NOT restricted by `restrictToIds` — a
 * themed campaign still curates which NAMED items it favors, but any
 * mundane weapon/armor is fair game to enchant regardless of theme.
 */

export interface LootDropResult {
  itemId: string;
  rarity: EquipmentRarity;
}

const DROP_CHANCE_PERCENT_BY_ROLE: Record<EnemyRole, number> = {
  minion: 12,
  miniboss: 55,
  boss: 90,
  legendary: 100,
};

const BASE_RARITY_BY_ROLE: Record<EnemyRole, EquipmentRarity> = {
  minion: "common",
  miniboss: "uncommon",
  boss: "rare",
  legendary: "veryRare",
};

const RARITY_STEP_UP: Record<EquipmentRarity, EquipmentRarity> = {
  common: "uncommon",
  uncommon: "rare",
  rare: "veryRare",
  veryRare: "legendary",
  legendary: "legendary",
};

/** "Every once in a while you get lucky" — a flat 12% chance to roll one tier above the enemy's normal drop rarity. */
const TIER_UP_CHANCE_PERCENT = 12;

/** True if `id` names a potion rather than an equipment item — the two catalogs share no ids. Exported so `BattleScene` can resolve a granted drop the same way. */
export function isPotionId(id: string): boolean {
  return id in POTION_DEFINITIONS;
}

function rarityOf(id: string): EquipmentRarity {
  return isPotionId(id) ? getPotionDefinition(id).rarity : getEquipmentDefinition(id).rarity;
}

/** Every named catalog id (potion or equipment) at `rarity`, optionally restricted to a themed subset. Falls back to the full match set if the restriction would leave nothing. */
function namedPoolFor(rarity: EquipmentRarity, restrictToIds?: readonly string[]): string[] {
  const all = [...EQUIPMENT_ORDER, ...POTION_ORDER].filter((id) => rarityOf(id) === rarity);
  if (!restrictToIds) return all;
  const restricted = all.filter((id) => restrictToIds.includes(id));
  return restricted.length > 0 ? restricted : all;
}

function enchantLevelFor(rarity: EquipmentRarity): EnchantLevel | null {
  return ENCHANT_LEVELS.find((level) => ENCHANT_RARITY[level] === rarity) ?? null;
}

/**
 * Roll a single loot drop for one defeated enemy. Returns null if this
 * enemy simply doesn't drop anything this time (the common case for a
 * minion) — always check for null before granting anything.
 */
export function rollLootDrop(
  role: EnemyRole | undefined,
  random: RandomService,
  restrictToIds?: readonly string[],
): LootDropResult | null {
  const effectiveRole: EnemyRole = role ?? "minion";
  if (random.rollPercent() >= DROP_CHANCE_PERCENT_BY_ROLE[effectiveRole]) return null;

  let rarity = BASE_RARITY_BY_ROLE[effectiveRole];
  if (random.rollPercent() < TIER_UP_CHANCE_PERCENT) rarity = RARITY_STEP_UP[rarity];

  const enchantLevel = enchantLevelFor(rarity);
  const namedPool = namedPoolFor(rarity, restrictToIds);
  const enchantPool = enchantLevel !== null ? enchantEligibleBaseIds() : [];

  const rollEnchant = enchantPool.length > 0 && (namedPool.length === 0 || random.rollPercent() < 50);
  if (rollEnchant && enchantLevel !== null) {
    const baseId = enchantPool[random.rollIndex(enchantPool.length)];
    return { itemId: enchantedItemId(baseId, enchantLevel), rarity };
  }
  if (namedPool.length === 0) return null;
  return { itemId: namedPool[random.rollIndex(namedPool.length)], rarity };
}
