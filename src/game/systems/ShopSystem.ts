import type { EquipmentRarity } from "../data/equipment";

/**
 * ShopSystem — Phase 22 (magic-item expansion)'s pure, tested "the shop's
 * magic-item selection scales with the party's level" rule. Kevin asked for
 * this directly: "The shop should also have some magical items, but based
 * on the level of the party (average character level)."
 *
 * Mundane gear (every `rarity: "common"` weapon/armor/shield, and the
 * original common/uncommon flavor items) stays visible at every level —
 * zero regression for a fresh level-1 party, exactly like before this
 * phase. Only `rare`/`veryRare`/`legendary` items — the genuinely powerful
 * magic items, including the ones Phase 13.9 (D-094) already added before
 * this rule existed — are gated behind an average-party-level floor. A
 * first-pass, untuned set of thresholds, same standing caveat every other
 * balance number in this project carries.
 */

const RARITY_LEVEL_THRESHOLD: Record<EquipmentRarity, number> = {
  common: 1,
  uncommon: 1,
  rare: 4,
  veryRare: 8,
  legendary: 13,
};

/** The average of a party's class levels, rounded down — the classic fixed roster (no `classLevel` growth) and a level-1 D&D-built party both average to 1. Never below 1, and never NaN on an empty party. */
export function averagePartyLevel(levels: readonly number[]): number {
  if (levels.length === 0) return 1;
  return Math.floor(levels.reduce((sum, l) => sum + l, 0) / levels.length);
}

/** True if a magic item of `rarity` is unlocked for purchase at `avgLevel`. */
export function isRarityUnlockedAtLevel(rarity: EquipmentRarity, avgLevel: number): boolean {
  return avgLevel >= RARITY_LEVEL_THRESHOLD[rarity];
}
