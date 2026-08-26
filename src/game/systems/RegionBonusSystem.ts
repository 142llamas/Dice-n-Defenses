import type { RandomService } from "./RandomService";
import type { RegionBonusOption } from "../data/regionBonuses";

/**
 * RegionBonusSystem — D-181 (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §8):
 * the pure "randomly draw N of a region's curated bonus pool" rule.
 *
 * `RandomService` has no ready-made "pick N without replacement" primitive
 * (`LootSystem.rollLootDrop` is its only other consumer, and only ever
 * needs a single `rollIndex` pick) — this is a small partial Fisher-Yates
 * shuffle built from repeated `rollIndex` calls over a shrinking working
 * copy, the same primitive `LootSystem` already uses.
 */

/**
 * Draw `count` distinct options from `pool`, in random order. If `pool` has
 * `count` or fewer options, returns all of them (still order-shuffled) —
 * every curated pool in `data/regionBonuses.ts` has more than 3, so this is
 * a defensive fallback, not the expected path.
 */
export function drawRegionBonusChoices(
  pool: readonly RegionBonusOption[],
  random: RandomService,
  count = 3,
): RegionBonusOption[] {
  const remaining = [...pool];
  const drawn: RegionBonusOption[] = [];
  while (remaining.length > 0 && drawn.length < count) {
    const index = random.rollIndex(remaining.length);
    drawn.push(remaining[index]);
    remaining.splice(index, 1);
  }
  return drawn;
}
