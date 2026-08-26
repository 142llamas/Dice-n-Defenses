import type { WorldFlagState } from "./WorldFlagSystem";
import { getWorldFlag } from "./WorldFlagSystem";
import { isSorrelLost } from "./SorrelFateSystem";
import type { WaveDefinition } from "../data/waves";

/**
 * ReturningMinibossSystem — CAMPAIGN_STORY_DESIGN.md §4 (KI-098 item 13).
 *
 * Saltmere Shallows (region 5) has no unique Chapter-1 miniboss of its own —
 * its Ch1 encounter is whichever of the 5 "home" minibosses the player
 * SPARED, rather than destroyed, in an earlier region's own Ch1 fight, now
 * "washed up corrupted/allied with the tide." Falls back to the nameless
 * `tide-wretch` (already shipped) if nothing was spared.
 *
 * Priority order per §4, fully resolved as of D-185: Sorrel Thane's own
 * Lost outcome (§6's Drowning Vale branch chain, `SorrelFateSystem`) takes
 * this slot outright, checked before the spared-miniboss loop below —
 * whatever happened to her in Drowning Vale (region 4) is already resolved
 * by the time Saltmere (region 5) plays, since regions play in the fixed
 * order this doc's §3 table lays out.
 *
 * Tie-break when more than one miniboss was spared: earliest region wins.
 * There's no timestamp to do better than flag-presence + region order, and
 * "an earlier act of mercy has had more time to fester into something
 * corrupted" is a reasonable first-pass reading of the doc's own framing.
 */

export const SALTMERE_FALLBACK_ENEMY_ID = "tide-wretch";
export const CORRUPTED_SORREL_ENEMY_ID = "corrupted-sorrel";

/** The 5 "home" Ch1 chapters, in region order (Saltmere itself is region 5). */
export const SPARABLE_MINIBOSS_CHAPTERS: Record<string, string> = {
  "emberford-ch1": "basalt-colossus", // Region 1
  "causeway-ch1": "juggernaut", // Region 2
  "cinderfall-ch1": "gravemaw", // Region 3
  "drowning-vale-ch1": "the-husk", // Region 4
  "frostbound-ch1": "bloodrage-warlord", // Region 6
};

/** Region order used for the spared-miniboss tie-break, earliest first. */
const MINIBOSS_PRIORITY_ORDER = ["basalt-colossus", "juggernaut", "gravemaw", "the-husk", "bloodrage-warlord"];

/**
 * One-sentence "washed up on Saltmere's shore" flavor for each miniboss's
 * return, logged when it actually spawns in Saltmere Ch1. Reuses each
 * miniboss's existing enemy id/stat block verbatim — no new "corrupted
 * variant" enemy data — so this is the only new narrative content the
 * return adds. New original content, logged in CONTENT_SOURCES.md.
 */
export const RETURNING_MINIBOSS_FLAVOR_TEXT: Record<string, string> = {
  "basalt-colossus": "Something with the Colossus's shape washes up on Saltmere's tideline, stone limbs crusted in brine.",
  juggernaut: "The Juggernaut drags itself out of the surf, its old momentum bent now toward the tide's own hunger.",
  gravemaw: "Gravemaw rises from the shallows trailing seaweed and rust, remembering a different battlefield.",
  "the-husk": "The Husk floats in on the tide, hollower than before — whatever it wasn't, the water claimed the rest.",
  "bloodrage-warlord": "The Bloodrage Warlord wades in from the shallows, rage gone quiet and cold as the water itself.",
  [CORRUPTED_SORREL_ENEMY_ID]:
    "Sorrel Thane wades out of the shallows, and whatever answers to that name now doesn't recognize any of you.",
};

export function sparedFlagId(enemyId: string): string {
  return `spared:${enemyId}`;
}

export interface SaltmereCh1Resolution {
  enemyId: string;
  isReturning: boolean;
}

/**
 * Resolve which enemy should stand in Saltmere Ch1's finale spawn: the
 * earliest-region spared miniboss found, or the nameless fallback. Regions
 * are freely selectable (no unlock-gating) so this must degrade correctly
 * to the fallback when no earlier region has been played yet.
 */
export function resolveSaltmereCh1Enemy(worldFlags: WorldFlagState): SaltmereCh1Resolution {
  if (isSorrelLost(worldFlags)) {
    return { enemyId: CORRUPTED_SORREL_ENEMY_ID, isReturning: true };
  }
  for (const enemyId of MINIBOSS_PRIORITY_ORDER) {
    if (getWorldFlag(worldFlags, sparedFlagId(enemyId)) === true) {
      return { enemyId, isReturning: true };
    }
  }
  return { enemyId: SALTMERE_FALLBACK_ENEMY_ID, isReturning: false };
}

/**
 * Swap `resolvedEnemyId` into the wave spawn group that currently spawns
 * `SALTMERE_FALLBACK_ENEMY_ID`, without mutating the input. Returns the SAME
 * `waves` array reference (no clone at all) when `resolvedEnemyId` is the
 * fallback id, so the common case (no earlier miniboss spared) is free.
 *
 * A narrow "spine" clone — only the array and objects on the path to the
 * changed field are copied; everything else stays shared by reference.
 * `waves` for a real chapter is a module-level data constant, not a
 * per-battle copy, so mutating any nested field in place would permanently
 * corrupt it for the rest of the session.
 */
export function withReturningMinibossSwap(waves: readonly WaveDefinition[], resolvedEnemyId: string): WaveDefinition[] {
  if (resolvedEnemyId === SALTMERE_FALLBACK_ENEMY_ID) return waves as WaveDefinition[];
  return waves.map((wave) => {
    const spawnIndex = wave.spawns.findIndex((group) => group.enemyId === SALTMERE_FALLBACK_ENEMY_ID);
    if (spawnIndex === -1) return wave;
    const spawns = [...wave.spawns];
    spawns[spawnIndex] = { ...spawns[spawnIndex], enemyId: resolvedEnemyId };
    return { ...wave, spawns };
  });
}
