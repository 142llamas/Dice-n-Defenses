import type { RandomService } from "./RandomService";
import type { RegionBonusCategory, RegionBonusOption } from "../data/regionBonuses";

/**
 * RegionBonusSystem — D-181 (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §8):
 * the pure "randomly draw N of a region's curated bonus pool" rule.
 *
 * `RandomService` has no ready-made "pick N without replacement" primitive
 * (`LootSystem.rollLootDrop` is its only other consumer, and only ever
 * needs a single `rollIndex` pick) — this is a small partial Fisher-Yates
 * shuffle built from repeated `rollIndex` calls over a shrinking working
 * copy, the same primitive `LootSystem` already uses.
 *
 * D-248 (Batch E, the dominance fix): every real pool has exactly two
 * options per category (gold/equipment/structure) — a plain distinct draw
 * over the whole pool could put both gold tiers (or both equipment/
 * structure options) in the same 3-choice offer, leaving no real choice
 * (the bigger option always wins). `drawRegionBonusChoices` now draws AT
 * MOST one option per category first, so the real `count=3` call against a
 * 3-category pool always returns exactly one of each. The second pass below
 * only exists so this stays correct as a general "distinct draw" primitive
 * for a `count` larger than the number of categories — not exercised by any
 * real caller today, but covered by this project's own test suite.
 */

/**
 * Draw `count` distinct options from `pool`, in random order, with at most
 * one option per category among the first `min(count, category count)`
 * picks. If `pool` has `count` or fewer options, returns all of them (still
 * order-shuffled) — every curated pool in `data/regionBonuses.ts` has more
 * than 3, so this is a defensive fallback, not the expected path.
 */
export function drawRegionBonusChoices(
  pool: readonly RegionBonusOption[],
  random: RandomService,
  count = 3,
): RegionBonusOption[] {
  const byCategory = new Map<RegionBonusCategory, RegionBonusOption[]>();
  for (const option of pool) {
    const list = byCategory.get(option.category);
    if (list) list.push(option);
    else byCategory.set(option.category, [option]);
  }

  const drawn: RegionBonusOption[] = [];

  // Pass 1 — one option per category, category order randomized too.
  const remainingCategories = [...byCategory.keys()];
  while (remainingCategories.length > 0 && drawn.length < count) {
    const catIndex = random.rollIndex(remainingCategories.length);
    const category = remainingCategories.splice(catIndex, 1)[0];
    const options = byCategory.get(category)!;
    const optIndex = random.rollIndex(options.length);
    drawn.push(options.splice(optIndex, 1)[0]);
  }

  // Pass 2 — only reached once every category has already contributed one
  // option (`count` exceeds the number of categories): keep drawing from
  // whatever's left, across categories, same shrinking-copy technique.
  const remaining = Array.from(byCategory.values()).flat();
  while (remaining.length > 0 && drawn.length < count) {
    const index = random.rollIndex(remaining.length);
    drawn.push(remaining.splice(index, 1)[0]);
  }

  return drawn;
}
