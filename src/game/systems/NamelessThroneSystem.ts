import type { WorldFlagState } from "./WorldFlagSystem";
import { getWorldFlag } from "./WorldFlagSystem";
import { SPARABLE_MINIBOSS_CHAPTERS, sparedFlagId } from "./ReturningMinibossSystem";
import { SORREL_FATE_FLAG_ID } from "./SorrelFateSystem";
import type { WaveDefinition } from "../data/waves";
import type { ParsedMap, TileType } from "../data/testMap";
import { NAMELESS_THRONE_HAZARD_POSITIONS } from "../data/namelessThroneMap";

/**
 * NamelessThroneSystem — CAMPAIGN_STORY_DESIGN.md §5 (D-188, closes the last
 * remaining item on the KI-098 item 13 epic).
 *
 * The capstone's ending is picked by the SAME choices the player already
 * made across the 6 regions — no new chapter-boundary prompts, per this
 * session's own scoping call. The signal: the 5 "Finish or Spare?" flags
 * (`ReturningMinibossSystem.sparedFlagId`, one per home miniboss) plus
 * Sorrel Thane's resolved fate (`SorrelFateSystem`).
 *
 * Valence (first-pass reading, not specified by the design doc itself):
 * sparing a miniboss, and Sorrel's Redeemed outcome, both read as "held onto
 * compassion/identity" — Ashen Sovereign. Finishing a miniboss outright (or
 * letting it breach unresolved — there is no `finished:<id>` flag anywhere,
 * "finished" is simply the absence of `spared:<id>`, and letting a threat
 * past you unresolved is its own kind of expedience), and Sorrel's Lost
 * outcome, read as "traded mercy for expedience" — the Hollow Empress.
 * Sorrel's Marked outcome is neutral, matching `resolveSorrelFate`'s own
 * support/press framing.
 *
 * Tie-break (including the "5 not-spared, Sorrel marked/unresolved" case)
 * resolves to Ashen Sovereign — CAMPAIGN_STORY_DESIGN.md §5 itself frames
 * Ashen as "Ending A," the true ending, with Hollow as the earned
 * alternate that requires a real, consistent letting-go pattern to reach.
 */

export type ThroneVariant = "ashen-sovereign" | "the-hollow-empress";

export interface MercyTally {
  ashen: number;
  hollow: number;
}

/**
 * The same ashen/hollow tally `resolveThroneVariant` uses to pick the
 * capstone's boss, factored out so other beats (companion dialogue tone,
 * KI-098 item 13 continuation) can read the player's accumulated
 * mercy-vs-expedience lean without duplicating this loop or waiting for the
 * capstone itself. Safe to call mid-campaign, before every region has been
 * played — an unresolved region's flags are simply absent, not miscounted.
 */
export function computeMercyTally(worldFlags: WorldFlagState): MercyTally {
  let ashen = 0;
  let hollow = 0;
  for (const enemyId of Object.values(SPARABLE_MINIBOSS_CHAPTERS)) {
    if (getWorldFlag(worldFlags, sparedFlagId(enemyId)) === true) ashen++;
    else hollow++;
  }
  const sorrelFate = getWorldFlag(worldFlags, SORREL_FATE_FLAG_ID);
  if (sorrelFate === "redeemed") ashen++;
  else if (sorrelFate === "lost") hollow++;
  return { ashen, hollow };
}

export function resolveThroneVariant(worldFlags: WorldFlagState): ThroneVariant {
  const { ashen, hollow } = computeMercyTally(worldFlags);
  return hollow > ashen ? "the-hollow-empress" : "ashen-sovereign";
}

/** Reusable outside the capstone — same lean as `resolveThroneVariant`, without its "tie defaults Ashen" ending-specific framing baked into a branded variant name. */
export function mercyTallyLeansHollow(worldFlags: WorldFlagState): boolean {
  const { ashen, hollow } = computeMercyTally(worldFlags);
  return hollow > ashen;
}

/**
 * Applies the ending's dressing to the fixed `NAMELESS_THRONE_MAP` grid.
 * `map` already carries `fire` at every `NAMELESS_THRONE_HAZARD_POSITIONS`
 * tile (the Ashen Sovereign baseline authored directly into the map data),
 * so the Ashen branch is a no-op returning the SAME reference; the Hollow
 * branch swaps just those 4 tiles to `water` via a narrow spine clone (only
 * the touched rows are copied) — never mutates the input, matching
 * `ReturningMinibossSystem.withReturningMinibossSwap`'s own discipline
 * around module-level data constants.
 */
export function withThroneVariant(map: ParsedMap, variant: ThroneVariant): ParsedMap {
  if (variant === "ashen-sovereign") return map;
  const touchedRows = new Set(NAMELESS_THRONE_HAZARD_POSITIONS.map((p) => p.y));
  const tiles: TileType[][] = map.tiles.map((row, y) => {
    if (!touchedRows.has(y)) return row;
    const next = [...row];
    for (const pos of NAMELESS_THRONE_HAZARD_POSITIONS) {
      if (pos.y === y) next[pos.x] = "water";
    }
    return next;
  });
  return { ...map, tiles };
}

/** Ashen garrison/boss id -> Hollow garrison/boss id, one entry per reskin pair plus the legendary boss itself. */
const ASHEN_TO_HOLLOW_ENEMY_IDS: Record<string, string> = {
  "ember-thane": "drowned-thane",
  "cinder-adept": "hollow-caller",
  "ashbound-honor-guard": "drowned-honor-captain",
  "ashen-sovereign": "the-hollow-empress",
};

/**
 * Same "spine clone, same reference when nothing changes" shape as
 * `withReturningMinibossSwap`, generalized from 1 id pair to N. `waves` is
 * the module-level `NAMELESS_THRONE_WAVES` constant — never mutated.
 */
export function withThroneEnemyReskins(waves: readonly WaveDefinition[], variant: ThroneVariant): WaveDefinition[] {
  if (variant === "ashen-sovereign") return waves as WaveDefinition[];
  return waves.map((wave) => {
    let spawns = wave.spawns;
    let changed = false;
    wave.spawns.forEach((group, i) => {
      const swapped = ASHEN_TO_HOLLOW_ENEMY_IDS[group.enemyId];
      if (!swapped) return;
      if (!changed) {
        spawns = [...wave.spawns];
        changed = true;
      }
      spawns[i] = { ...spawns[i], enemyId: swapped };
    });
    return changed ? { ...wave, spawns } : wave;
  });
}
