import type { AttackProfile } from "../systems/CombatSystem";
import type { TrapTarget } from "./structures";
import type { StatusEffectId } from "./statusEffects";
import type { TileType } from "./testMap";

/**
 * Terrain effects — data, not code (Source of Truth "data-driven content").
 *
 * Phase 11.7 (D-071): the map system overhaul adds terrain tiles (water/fire/
 * acid) that are WALKABLE but hazardous, on top of "cliff" (a mechanically
 * plain blocker — see GameMap.isWalkable). Rather than a new pathfinding
 * layer, this reuses the exact shape the enemy-phase TRAP mechanism already
 * consumes (WaveSystem.tickEnemyPhase's `trapAt`/`trapTargets`/`trapStatusAt`
 * callbacks) — BattleScene composes a terrain-effect fallback behind the
 * existing trap-query callbacks, so WaveSystem itself needs no changes at
 * all. This is deliberately the lower-risk substitute for a weighted-cost
 * pathfinding system.
 *
 * Scope (deliberate): terrain effects apply to ENEMIES only during the enemy
 * phase, exactly like traps do today. Heroes walking across these tiles are
 * unaffected — extending this to heroes/MovementSystem is out of scope here.
 *
 * All content here is ORIGINAL to this project — values are invented, not
 * copied or adapted from any published source. See CONTENT_SOURCES.
 */
export interface TerrainEffect {
  /** Instant damage on entry, or null when the effect is a status only. */
  profile: AttackProfile | null;
  /** Which movement types this terrain affects (mirrors trap `targets`). */
  targets: TrapTarget;
  /** A status effect applied if the enemy survives the tile's damage. */
  status: { statusId: StatusEffectId; durationTurns: number } | null;
}

const TERRAIN_EFFECTS: Partial<Record<TileType, TerrainEffect>> = {
  // Fire: no instant damage — the "burning" damage-over-time status is the
  // whole effect, so an enemy isn't double-dipped (once on entry, again on
  // its own next phase from the DoT).
  fire: {
    profile: null,
    targets: "any",
    status: { statusId: "burning", durationTurns: 2 },
  },
  // Acid: a modest flat hit, ground only — flyers cross an acid pool for
  // free, same semantics as the existing anti-ground Spike Trap.
  acid: {
    // Phase 13.1 (D-086): terrain damage always hits, same as a trap.
    profile: { rangeTiles: 0, damage: 2, attackBonus: 0, autoHit: true },
    targets: "ground",
    status: null,
  },
  // Water: no instant damage, just a lingering slow — ground only, since a
  // flyer passing over water isn't wading through it.
  water: {
    profile: null,
    targets: "ground",
    status: { statusId: "slowed", durationTurns: 1 },
  },
};

/** The mechanical effect for a tile type, or null for a tile with none. */
export function terrainEffectFor(tileType: TileType): TerrainEffect | null {
  return TERRAIN_EFFECTS[tileType] ?? null;
}
