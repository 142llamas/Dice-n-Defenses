import type { GridPosition } from "./GridSystem";
import { GridSystem } from "./GridSystem";
import { GameMap } from "./GameMap";
import { PathfindingSystem } from "./PathfindingSystem";
import type { AttackProfile } from "./CombatSystem";
import {
  getStructureDefinition,
  type StructureDefinition,
  type TrapTarget,
} from "../data/structures";
import type { StatusEffectId } from "../data/statusEffects";

/**
 * Phase 11.7 (D-071): "build anywhere" is replaced by proximity gating — a
 * structure may only be placed within this many Manhattan tiles of at least
 * one LIVING hero. Sanity-checked against TEST_MAP: its open floor plus this
 * radius still reaches every tile a wall/trap would sensibly go, from any of
 * the map's 4 hero-start tiles, without making the classic path unplayable.
 */
export const BUILD_RANGE_TILES = 3;

/**
 * Phase 11.7 (D-071): the maximum number of structures simultaneously
 * attributed to one hero (see `PlacedStructure.builtBy`). A hero must
 * already be near a tile to build there (BUILD_RANGE_TILES), so "which
 * nearby hero gets credit" is a low-risk, no-new-UI extension of that rule.
 */
export const MAX_STRUCTURES_PER_HERO = 3;

/**
 * BuildSystem: the pure rules for placing and removing structures. No Phaser.
 *
 * This is the heart of Phase 5. Following the Source of Truth ("rules
 * independent from visuals", "keep rules out of the scene"), every build
 * DECISION lives here and is unit-tested in plain Node; BattleScene only renders
 * the placed structures and turns clicks into build requests.
 *
 * It owns the set of placed structures and answers three questions the rest of
 * the game needs:
 *   1. "Can this structure go here?"  -> canPlace (validated placement)
 *   2. "Is this tile a wall?"         -> isWallAt   (fed to enemy routing so
 *                                        enemies march AROUND walls)
 *   3. "Does this tile damage an enemy that enters it?" -> trapProfileAt (fed to
 *                                        the enemy phase so traps trigger)
 *
 * The critical rule (Source of Truth DEFAULT, Phase 3/5): a wall may never be
 * placed if it removes every valid ground route from a spawn to an exit. That
 * check uses PathfindingSystem against ALL walls (existing + the tentative one),
 * considering walls only — not transient unit positions, since units move.
 */

export interface PlacedStructure {
  /** Unique per-instance id, e.g. "barricade#3". */
  instanceId: string;
  /** The definition id, e.g. "barricade" or "spike-trap". */
  defId: string;
  kind: StructureDefinition["kind"];
  position: GridPosition;
  /**
   * Phase 11.7 (D-071): the id of the hero this structure counts against for
   * the per-hero carry limit, resolved by the caller (BattleScene) as
   * whichever living hero was closest at placement time. Absent when the
   * caller doesn't supply one — same backward-compatible default as the
   * proximity gate below.
   */
  builtBy?: string;
  /**
   * Phase 20 (D-111): current hit points, copied from the definition's
   * `maxHp` at placement. Absent means indestructible (the definition
   * itself has no `maxHp`) — unchanged from every prior phase.
   */
  hp?: number;
}

/** The result of asking whether a structure may be placed on a tile. */
export interface PlacementCheck {
  ok: boolean;
  /** A short, player-facing reason when ok is false. */
  reason?: string;
}

/** The result of actually placing a structure. */
export interface PlaceResult extends PlacementCheck {
  structure?: PlacedStructure;
}

/**
 * Phase 12.1 (D-101): a plain-data copy of everything `BuildSystem` tracks,
 * for `BattleStateSnapshot`. `builtByCounts` is deliberately NOT included —
 * it's fully derivable from `structures`' own `builtBy` fields, so
 * `restoreFrom` recomputes it rather than trusting a second, redundant copy
 * that could fall out of sync.
 */
export interface BuildStateSnapshot {
  structures: PlacedStructure[];
  nextInstance: number;
}

const KEY = (p: GridPosition): string => `${p.x},${p.y}`;

export class BuildSystem {
  private placed: PlacedStructure[] = [];
  private byTile = new Map<string, PlacedStructure>();
  private nextInstance = 1;
  /** Phase 11.7 (D-071): active structure count per `builtBy` hero id. */
  private builtByCounts = new Map<string, number>();

  private readonly spawns: GridPosition[];
  private readonly exits: GridPosition[];

  constructor(
    private readonly map: GameMap,
    private readonly pathfinding: PathfindingSystem,
  ) {
    this.spawns = map.data.spawns;
    this.exits = map.data.exits;
  }

  // ----- Read-only queries ----------------------------------------------

  get structures(): ReadonlyArray<PlacedStructure> {
    return this.placed;
  }

  /** The structure on a tile, if any. */
  structureAt(pos: GridPosition): PlacedStructure | null {
    return this.byTile.get(KEY(pos)) ?? null;
  }

  /** The wall on a tile, if any (null for traps or empty tiles). */
  wallAt(pos: GridPosition): PlacedStructure | null {
    const s = this.structureAt(pos);
    return s && s.kind === "wall" ? s : null;
  }

  /** The trap on a tile, if any (null for walls or empty tiles). */
  trapAt(pos: GridPosition): PlacedStructure | null {
    const s = this.structureAt(pos);
    return s && s.kind === "trap" ? s : null;
  }

  /** True if a wall occupies this tile. Fed to enemy routing (ALWAYS blocked
   * by any wall-kind structure, including a Gate — see `blocksHeroAt` for the
   * hero-facing question, which a Gate answers differently). */
  isWallAt(pos: GridPosition): boolean {
    return this.wallAt(pos) !== null;
  }

  /**
   * True if the wall on this tile also blocks HEROES (Phase 7). A Barricade
   * does (the default); a Gate does not — enemies still route around it, but
   * the party may walk straight through. False when there is no wall here.
   */
  blocksHeroAt(pos: GridPosition): boolean {
    const wall = this.wallAt(pos);
    if (!wall) return false;
    return getStructureDefinition(wall.defId).blocksHeroes ?? true;
  }

  /**
   * The attack profile of the trap on this tile, or null if there is no trap.
   * WaveSystem applies this via CombatSystem when an enemy enters the tile, so
   * trap damage is deterministic and shares the combat rules. `rangeTiles` is
   * unused for an entered-tile trap (CombatSystem.applyAttack ignores range).
   */
  trapProfileAt(pos: GridPosition): AttackProfile | null {
    const trap = this.trapAt(pos);
    if (!trap) return null;
    const def = getStructureDefinition(trap.defId);
    // Phase 13.1 (D-086): every trap always hits (D-039) — attackBonus is
    // irrelevant when autoHit skips the roll entirely.
    return {
      rangeTiles: 0,
      damage: def.damage ?? 0,
      attackBonus: 0,
      autoHit: true,
    };
  }

  /**
   * Which movement types the trap on this tile affects (D-049), or "any" when
   * there is no trap or the trap declares no filter. WaveSystem pairs this with
   * `trapProfileAt` so a Sky Snare only bites flyers and a Spike Trap only bites
   * ground units. Kept separate from the profile so the combat arithmetic stays
   * a plain AttackProfile.
   */
  trapTargetsAt(pos: GridPosition): TrapTarget {
    const trap = this.trapAt(pos);
    if (!trap) return "any";
    return getStructureDefinition(trap.defId).targets ?? "any";
  }

  /**
   * The status effect the trap on this tile applies (Phase 7, e.g. Tangle
   * Root's slow), or null when there is no trap or it applies none (Spike
   * Trap, Sky Snare). Paired with `trapProfileAt`/`trapTargetsAt` — WaveSystem
   * only applies this if the enemy survives the trap's damage.
   */
  trapStatusAt(
    pos: GridPosition,
  ): { statusId: StatusEffectId; durationTurns: number } | null {
    const trap = this.trapAt(pos);
    if (!trap) return null;
    return getStructureDefinition(trap.defId).appliesStatus ?? null;
  }

  /**
   * The basic-attack bonus a hero gets for standing on the platform at `pos`
   * (Phase 7: a Melee Platform or Ranged Perch; Phase 24, D-115: a
   * Watchtower's `"any"` audience), or all-zero when there is no platform
   * here or its bonus doesn't apply to this hero's category. Melee vs ranged
   * is passed in by the caller (BattleScene knows the hero; this system only
   * knows the tile) so BuildSystem stays entity-agnostic. `"any"` matches
   * every hero regardless of `heroIsRanged`.
   */
  platformBonusFor(
    pos: GridPosition,
    heroIsRanged: boolean,
  ): { attackDamage: number; attackRangeTiles: number } {
    const none = { attackDamage: 0, attackRangeTiles: 0 };
    const structure = this.structureAt(pos);
    if (!structure || structure.kind !== "platform") return none;
    const bonus = getStructureDefinition(structure.defId).heroBonus;
    if (!bonus) return none;
    const matches = bonus.appliesTo === "any" || (bonus.appliesTo === "ranged") === heroIsRanged;
    if (!matches) return none;
    return {
      attackDamage: bonus.attackDamage ?? 0,
      attackRangeTiles: bonus.attackRangeTiles ?? 0,
    };
  }

  /**
   * Phase 24 (D-115): true if the trap on this tile is single-use (e.g. a
   * Bear Trap) — spent and removed the first time it triggers, unlike every
   * other persistent trap. False for a tile with no trap, or a trap that
   * omits the flag. `BattleScene` is the actual caller that removes the
   * structure once it has triggered; this is the pure lookup it consults.
   */
  trapIsSingleUseAt(pos: GridPosition): boolean {
    const trap = this.trapAt(pos);
    if (!trap) return false;
    return getStructureDefinition(trap.defId).singleUse ?? false;
  }

  // ----- Placement validation -------------------------------------------

  /**
   * Whether `defId` may be built on `pos`. Shared by the UI (to preview
   * validity) and by place() (to enforce it). `isOccupied` reports tiles held
   * by a living unit (hero or enemy); the caller supplies it so this system
   * stays independent of the entity classes.
   *
   * Phase 11.7 (D-071): `heroPositions`, when supplied and non-empty, gates
   * placement to within `BUILD_RANGE_TILES` of at least one of them
   * ("build anywhere" is replaced by proximity to a living hero).
   * `builtBy`, when supplied, is checked against that hero's active
   * structure count (`MAX_STRUCTURES_PER_HERO`). Both are OPTIONAL and, when
   * omitted, enforce nothing — this keeps every pre-existing caller/test
   * (which passes neither) working exactly as before.
   */
  canPlace(
    defId: string,
    pos: GridPosition,
    isOccupied?: (p: GridPosition) => boolean,
    heroPositions?: GridPosition[],
    builtBy?: string,
  ): PlacementCheck {
    const def = getStructureDefinition(defId);

    if (!this.map.isWalkable(pos)) {
      return { ok: false, reason: "You can only build on open floor." };
    }
    if (!this.map.isBuildable(pos)) {
      return { ok: false, reason: "This sand is too loose to build on." };
    }
    const role = this.map.roleAt(pos);
    if (role === "spawn" || role === "exit") {
      return { ok: false, reason: "You cannot build on a spawn or exit tile." };
    }
    if (this.structureAt(pos)) {
      return { ok: false, reason: "There is already a structure here." };
    }
    if (isOccupied && isOccupied(pos)) {
      return { ok: false, reason: "A unit is standing on that tile." };
    }
    if (heroPositions && heroPositions.length > 0) {
      const inRange = heroPositions.some(
        (hp) => GridSystem.manhattanDistance(hp, pos) <= BUILD_RANGE_TILES,
      );
      if (!inRange) {
        return { ok: false, reason: "No hero is close enough to build here." };
      }
    }
    if (builtBy && (this.builtByCounts.get(builtBy) ?? 0) >= MAX_STRUCTURES_PER_HERO) {
      return { ok: false, reason: "This hero has reached its structure limit." };
    }

    // Walls are blockers: reject any wall that would seal off every route from
    // a spawn to an exit. Traps do not block, so they skip this check.
    if (def.kind === "wall" && !this.routesRemainWith(pos)) {
      return {
        ok: false,
        reason: "That would block the enemies' only path — build rejected.",
      };
    }

    return { ok: true };
  }

  /**
   * True if, with a wall added at `extraWall` (on top of all existing walls),
   * every spawn still has a route to some exit. Considers walls only, never
   * transient unit positions. This is the Source of Truth's "a blocking
   * structure cannot eliminate all valid routes" rule.
   */
  private routesRemainWith(extraWall: GridPosition): boolean {
    const blockedKeys = new Set<string>();
    for (const s of this.placed) {
      if (s.kind === "wall") blockedKeys.add(KEY(s.position));
    }
    blockedKeys.add(KEY(extraWall));
    const isBlocked = (p: GridPosition): boolean => blockedKeys.has(KEY(p));

    // Every spawn must still reach an exit. (A spawn sitting on an exit would
    // trivially "arrive"; our maps keep them distinct.)
    return this.spawns.every((spawn) =>
      this.pathfinding.hasRoute({ start: spawn, goals: this.exits, isBlocked }),
    );
  }

  // ----- Mutations -------------------------------------------------------

  /**
   * Validate and place a structure. On success returns the created structure;
   * on failure returns the reason and places nothing. This never touches gold —
   * the caller spends gold exactly once around a successful placement, keeping
   * the "purchases update gold once" guarantee in one place.
   */
  place(
    defId: string,
    pos: GridPosition,
    isOccupied?: (p: GridPosition) => boolean,
    heroPositions?: GridPosition[],
    builtBy?: string,
  ): PlaceResult {
    const check = this.canPlace(defId, pos, isOccupied, heroPositions, builtBy);
    if (!check.ok) return check;

    const def = getStructureDefinition(defId);
    const structure: PlacedStructure = {
      instanceId: `${def.id}#${this.nextInstance++}`,
      defId: def.id,
      kind: def.kind,
      position: { ...pos },
      builtBy,
      hp: def.maxHp,
    };
    this.placed.push(structure);
    this.byTile.set(KEY(pos), structure);
    if (builtBy) this.builtByCounts.set(builtBy, (this.builtByCounts.get(builtBy) ?? 0) + 1);
    return { ok: true, structure };
  }

  /**
   * Remove a structure by instance id and return it (so the caller can refund
   * its cost and destroy its token). Returns null if the id is unknown. A
   * structure is removed exactly once: after this it is no longer in
   * `structures` and its tile is free to build on again.
   */
  remove(instanceId: string): PlacedStructure | null {
    const idx = this.placed.findIndex((s) => s.instanceId === instanceId);
    if (idx === -1) return null;
    const [removed] = this.placed.splice(idx, 1);
    this.byTile.delete(KEY(removed.position));
    if (removed.builtBy) {
      const count = this.builtByCounts.get(removed.builtBy) ?? 0;
      if (count <= 1) this.builtByCounts.delete(removed.builtBy);
      else this.builtByCounts.set(removed.builtBy, count - 1);
    }
    return removed;
  }

  /** Remove the structure on a tile (if any) and return it. */
  removeAt(pos: GridPosition): PlacedStructure | null {
    const s = this.structureAt(pos);
    return s ? this.remove(s.instanceId) : null;
  }

  /**
   * Phase 20 (D-111): apply siege damage to a structure by instance id. A
   * structure with no `hp` at all (indestructible — the vast majority)
   * takes the hit with no effect. Reaching 0 HP removes it exactly once,
   * the same "remove once, free the tile" guarantee `remove()` already
   * gives a refunded structure.
   */
  damageStructure(instanceId: string, damage: number): { destroyed: boolean; structure: PlacedStructure | null } {
    const structure = this.placed.find((s) => s.instanceId === instanceId);
    if (!structure || structure.hp === undefined) return { destroyed: false, structure: structure ?? null };
    structure.hp = Math.max(0, structure.hp - Math.max(0, damage));
    if (structure.hp > 0) return { destroyed: false, structure };
    const removed = this.remove(instanceId);
    return { destroyed: true, structure: removed };
  }

  /**
   * Phase 25 (D-116), Saboteur: destroy a trap outright by instance id — a
   * trap has no HP to whittle down (D-039: it always hits, in full, every
   * time), so a trapSense enemy that finds one always removes it completely
   * in a single phase rather than damaging it toward zero. Returns false (no
   * effect) if the id is unknown or the structure isn't a trap. Never
   * refunds gold, same as `damageStructure`/`remove` — this is the enemy
   * destroying the player's investment, not the player reclaiming it.
   */
  disarmTrap(instanceId: string): boolean {
    const structure = this.placed.find((s) => s.instanceId === instanceId);
    if (!structure || structure.kind !== "trap") return false;
    return this.remove(instanceId) !== null;
  }

  // ----- Phase 12.1 (D-101): full state snapshot/restore ------------------

  /** A plain-data copy of every structure currently placed. See `BuildStateSnapshot`. */
  toSnapshot(): BuildStateSnapshot {
    return {
      structures: this.placed.map((s) => ({ ...s, position: { ...s.position } })),
      nextInstance: this.nextInstance,
    };
  }

  /**
   * Bulk-load every structure from a snapshot into this (freshly constructed,
   * empty) `BuildSystem` — trusts the snapshot as already-valid (no
   * `canPlace` re-validation, unlike `place()`), the same "restore trusts
   * saved state" convention `WaveSystem.restoreFrom`/`Hero.fromSnapshot` use.
   * `builtByCounts` is recomputed from `structures` rather than stored
   * separately (see `BuildStateSnapshot`'s own comment).
   */
  restoreFrom(snapshot: BuildStateSnapshot): void {
    this.placed = snapshot.structures.map((s) => ({ ...s, position: { ...s.position } }));
    this.byTile = new Map(this.placed.map((s) => [KEY(s.position), s]));
    this.nextInstance = snapshot.nextInstance;
    this.builtByCounts = new Map();
    for (const s of this.placed) {
      if (s.builtBy) this.builtByCounts.set(s.builtBy, (this.builtByCounts.get(s.builtBy) ?? 0) + 1);
    }
  }
}
