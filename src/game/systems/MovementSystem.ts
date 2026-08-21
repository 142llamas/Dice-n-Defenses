import type { GridPosition } from "./GridSystem";
import { GameMap } from "./GameMap";
import { budgetTilesToFeet, reconstructRoute, roundToTileUnit, weightedDistances, TILE_FEET } from "./DiagonalMovement";

/**
 * MovementSystem: pure movement legality and pathfinding. No Phaser.
 *
 * Per the Phase 1 handoff, movement legality lives in this new system and asks
 * `GameMap.isWalkable` which tiles a unit may stand on. Rendering the range and
 * the path preview stays in BattleScene; this class only computes facts.
 *
 * Movement model (Enemy AI/Movement Redesign §5, D-141 — supersedes the
 * original Phase 2 four-directional default, D-016): 8-directional movement,
 * true Euclidean cost per diagonal step, no corner-cutting — see
 * `DiagonalMovement`'s own doc comment for the full cost model and rounding
 * rule. `budget` keeps its existing shape (a plain integer tile count, e.g.
 * `Hero.movementBudget()`); it is converted to feet internally and a tile
 * only counts as reachable once its ROUNDED cumulative distance fits.
 *   - A unit may not enter or pass through a tile that is a wall (not walkable)
 *     or that is occupied by another unit. Occupancy is supplied by the caller
 *     via `isOccupied`, so this class stays independent of who is on the board.
 *   - A SEPARATE, softer rule (see D-067): a tile may be walked THROUGH but
 *     not stood on, via `blocksStopping`. Callers use this for same-type
 *     units (e.g. another hero) that shouldn't block a path through them but
 *     must still never share a final tile with the mover.
 */

export interface MovementQuery {
  /** The tile the unit is moving from. */
  start: GridPosition;
  /** How many tiles the unit may travel (e.g. Hero.movementBudget()). */
  budget: number;
  /**
   * True if a tile is occupied by ANOTHER unit and therefore cannot be entered
   * or passed. The caller should exclude the moving unit itself. Optional: when
   * omitted, only walls block movement.
   */
  isOccupied?: (pos: GridPosition) => boolean;
  /**
   * True if a tile may be walked THROUGH but never ends a move (D-067). Unlike
   * `isOccupied`, this does not block traversal — only stopping there. Optional:
   * when omitted, no tile is stopping-only blocked.
   */
  blocksStopping?: (pos: GridPosition) => boolean;
}

const KEY = (p: GridPosition): string => `${p.x},${p.y}`;

export class MovementSystem {
  constructor(private readonly map: GameMap) {}

  /** A tile a unit may move onto: walkable floor and not occupied by another. */
  private canEnter(
    pos: GridPosition,
    isOccupied?: (p: GridPosition) => boolean,
  ): boolean {
    if (!this.map.isWalkable(pos)) return false;
    if (isOccupied && isOccupied(pos)) return false;
    return true;
  }

  /**
   * Weighted search from `start` (see D-141), returning the exact cumulative
   * feet-distance to every tile visited within `budget`. The start tile
   * itself has cost 0. This never mutates its inputs.
   */
  private distances(query: MovementQuery) {
    const { start, budget, isOccupied } = query;
    const canEnter = (pos: GridPosition): boolean => this.canEnter(pos, isOccupied);
    return weightedDistances(start, canEnter, undefined, budgetTilesToFeet(budget));
  }

  /**
   * All tiles the unit could move to (excludes the start tile). Order is not
   * significant; the scene highlights the whole set.
   */
  reachableTiles(query: MovementQuery): GridPosition[] {
    const budgetFeet = budgetTilesToFeet(query.budget);
    const { dist } = this.distances(query);
    const result: GridPosition[] = [];
    for (const [key, d] of dist) {
      if (d === 0) continue; // skip the start tile itself
      if (roundToTileUnit(d) > budgetFeet) continue;
      const [x, y] = key.split(",").map(Number);
      const pos = { x, y };
      // D-067: passable but not stoppable (e.g. another hero) — reachable for
      // PASSING THROUGH, so it stays in `dist` for search continuation, but it
      // is not a legal place to end this move, so it's excluded here.
      if (query.blocksStopping && query.blocksStopping(pos)) continue;
      result.push(pos);
    }
    return result;
  }

  /** True if `dest` is a legal move target for this query. */
  isLegalDestination(dest: GridPosition, query: MovementQuery): boolean {
    const budgetFeet = budgetTilesToFeet(query.budget);
    const { dist } = this.distances(query);
    const d = dist.get(KEY(dest));
    if (d === undefined || d === 0) return false; // unreachable or the start tile
    if (roundToTileUnit(d) > budgetFeet) return false;
    if (query.blocksStopping && query.blocksStopping(dest)) return false;
    return true;
  }

  /**
   * Shortest (by true Euclidean distance, see D-141) path from start to dest
   * as the sequence of steps to walk, EXCLUDING the start tile and INCLUDING
   * dest. Returns null when dest is the start tile, is a wall, is occupied
   * (or stopping-blocked), or is beyond the movement budget. Never mutates
   * its inputs.
   */
  findPath(dest: GridPosition, query: MovementQuery): GridPosition[] | null {
    return this.findPathWithDistance(dest, query)?.path ?? null;
  }

  /**
   * Same as `findPath`, but also returns the rounded tile-distance actually
   * spent reaching `dest` — the drag-and-drop multi-waypoint route
   * (`routeThroughWaypoints`, below) needs this to know how much movement
   * budget one leg consumed before computing the next.
   */
  private findPathWithDistance(
    dest: GridPosition,
    query: MovementQuery,
  ): { path: GridPosition[]; usedTiles: number } | null {
    const { start, budget, isOccupied, blocksStopping } = query;
    if (start.x === dest.x && start.y === dest.y) return null;
    if (!this.canEnter(dest, isOccupied)) return null;
    if (blocksStopping && blocksStopping(dest)) return null;

    const budgetFeet = budgetTilesToFeet(budget);
    const canEnter = (pos: GridPosition): boolean => this.canEnter(pos, isOccupied);
    const search = weightedDistances(start, canEnter, undefined, budgetFeet);

    const d = search.dist.get(KEY(dest));
    if (d === undefined || roundToTileUnit(d) > budgetFeet) return null; // never reached within budget

    // D-141: strip `distanceFeet` — callers expect plain GridPosition tiles.
    const path = reconstructRoute(dest, start, search).map((p) => ({ x: p.x, y: p.y }));
    return { path, usedTiles: roundToTileUnit(d) / TILE_FEET };
  }

  /**
   * A large-enough-for-any-real-map tile budget, used internally by
   * `routeThroughWaypoints` to compute a leg's true shape/distance even when
   * it turns out to exceed the caller's real budget — see that method's own
   * comment for why the full (possibly over-budget) route is still useful.
   */
  private static readonly UNBOUNDED_BUDGET_TILES = 1_000_000;

  /**
   * Enemy AI/Movement Redesign-adjacent, drag-and-drop hero move: route
   * through `waypoints` IN ORDER (typically the player's pinned corners,
   * then wherever the pointer currently is), each leg computed the same way
   * `findPath` computes a single-destination path. `blocksStopping` (D-067)
   * only ever applies to the LAST waypoint — every earlier one is a
   * pass-through corner, not a place the mover actually stops, so it may sit
   * on a tile that blocks STOPPING (though never one that's genuinely
   * unenterable — a wall or occupied tile fails the whole call, even as an
   * intermediate waypoint).
   *
   * Each leg is computed against `UNBOUNDED_BUDGET_TILES`, not the caller's
   * real budget — so the full route (and its real total distance) is always
   * returned for rendering/preview purposes even when it turns out to be
   * over budget; `withinBudget` is the caller's own signal for what to do
   * about that (e.g. render the preview in a "too far" color and refuse the
   * drop), rather than this method silently truncating the route. Returns
   * `null` only when some leg is genuinely unreachable at ANY budget (a
   * wall, an occupied tile, or a stopping-blocked final waypoint) — there is
   * no route to show at all in that case.
   *
   * A waypoint identical to the current running position (the very first
   * one matching `query.start`, or two pins placed on the same tile) is a
   * no-op leg, not an error — `findPathWithDistance` would otherwise reject
   * it as "already there."
   *
   * Per-leg tile-distance is rounded (`findPathWithDistance`'s own rule) and
   * then SUMMED across legs — the same "round after each leg, then treat
   * the remainder as the next leg's budget" convention `WaveSystem`'s D-143
   * leftover-movement math already established, rather than an unrounded
   * grand-total rounded once at the very end.
   */
  routeThroughWaypoints(waypoints: readonly GridPosition[], query: MovementQuery): WaypointRoute | null {
    const path: GridPosition[] = [];
    let usedTiles = 0;
    let current = query.start;
    const legQueryBase = { isOccupied: query.isOccupied };

    for (let i = 0; i < waypoints.length; i++) {
      const waypoint = waypoints[i];
      if (waypoint.x === current.x && waypoint.y === current.y) continue; // no-op leg

      const isFinal = i === waypoints.length - 1;
      const leg = this.findPathWithDistance(waypoint, {
        ...legQueryBase,
        start: current,
        budget: MovementSystem.UNBOUNDED_BUDGET_TILES,
        blocksStopping: isFinal ? query.blocksStopping : undefined,
      });
      if (!leg) return null;

      path.push(...leg.path);
      usedTiles += leg.usedTiles;
      current = waypoint;
    }

    return { path, usedTiles, withinBudget: usedTiles <= query.budget };
  }
}

/** The result of `MovementSystem.routeThroughWaypoints` — see its own doc comment. */
export interface WaypointRoute {
  /** Every leg's steps concatenated, in order — excludes the start, includes every waypoint. */
  path: GridPosition[];
  /** Total tiles spent, each leg's own rounding summed (not one grand-total round). */
  usedTiles: number;
  /** True when `usedTiles` fits within `query.budget`. False still returns the full route. */
  withinBudget: boolean;
}
