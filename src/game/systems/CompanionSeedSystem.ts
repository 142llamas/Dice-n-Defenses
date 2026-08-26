import type { RandomService } from "./RandomService";
import { POOL_A_COMPANION_IDS } from "../data/companions";
import { recruitCompanion, type CompanionRosterState } from "./CompanionRosterSystem";

/**
 * CompanionSeedSystem — KI-098 item 13 (companion roster/recruitment,
 * Phase 1): the pure "draw a random starting trio" rule.
 *
 * Kevin's own design: a brand-new campaign playthrough starts with the PC
 * plus 3 randomly-drawn Pool A companions (the six class-coverage recruits
 * with no home region) already active. The other 3 Pool A companions stay
 * locked, meant to unlock via their own side-quest missions — a separate,
 * not-yet-built item-13 slice. Pool B (the six region-mirror companions)
 * is untouched by seeding — they unlock individually via
 * `BattleScene.maybeUnlockHomeRegionCompanion` instead.
 *
 * `RandomService` has no ready-made "pick N without replacement" primitive
 * (`RegionBonusSystem.drawRegionBonusChoices` is the only other consumer of
 * this shape) — same small partial Fisher-Yates over `rollIndex`, duplicated
 * here rather than shared, matching this project's one-system-one-job
 * convention.
 */

const STARTING_COMPANION_COUNT = 3;

/** True iff nothing has ever been recruited, benched, or lost — i.e. a genuinely fresh roster. */
export function isDefaultCompanionRoster(state: CompanionRosterState): boolean {
  return state.activeIds.length === 0 && state.benchedIds.length === 0 && state.lostIds.length === 0;
}

/**
 * Seeds a fresh roster with 3 randomly-drawn Pool A companions, all active.
 * No-ops (returns the SAME object reference) unless the roster is still
 * fully default — safe to call from more than one scene without double-
 * seeding an in-progress playthrough.
 */
export function seedStartingCompanions(state: CompanionRosterState, random: RandomService): CompanionRosterState {
  if (!isDefaultCompanionRoster(state)) return state;

  const remaining = [...POOL_A_COMPANION_IDS];
  const drawn: string[] = [];
  while (remaining.length > 0 && drawn.length < STARTING_COMPANION_COUNT) {
    const index = random.rollIndex(remaining.length);
    drawn.push(remaining[index]);
    remaining.splice(index, 1);
  }

  return drawn.reduce((acc, id) => recruitCompanion(acc, id), state);
}
