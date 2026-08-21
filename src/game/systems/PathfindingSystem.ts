import type { GridPosition } from "./GridSystem";
import { GameMap } from "./GameMap";
import { type RoutedPosition, TILE_FEET, reconstructRoute, roundToTileUnit, weightedDistances } from "./DiagonalMovement";

/**
 * PathfindingSystem: pure enemy routing. No Phaser.
 *
 * Where MovementSystem answers "which tiles can a hero reach within a small
 * budget", this answers "what is the full route from an enemy to the nearest
 * exit". Same weighted-search idea, but with no budget cap and multiple goal
 * tiles. Enemies use this each enemy phase to know which way to march.
 *
 * Movement model (Enemy AI/Movement Redesign §5, D-141): 8-directional
 * movement over walkable floor tiles — walls block, and diagonal steps cost
 * true Euclidean distance with no corner-cutting (see `DiagonalMovement`'s
 * own doc comment for the full cost model). Each returned tile carries its
 * exact cumulative distance from `start`; callers (`WaveSystem`) round that
 * against a movement budget to decide how far along the route an enemy
 * actually walks this phase — a route itself has no budget cap.
 *
 * By default enemies ignore other units so a valid route to the exit always
 * exists (the "Hero collision" question is still OPEN in the Source of
 * Truth); callers may pass `isBlocked` to treat extra tiles as impassable if
 * a later phase decides units should block.
 *
 * Phase 7 (flying, DECISIONS D-048): a route may set `ignoreWalls`. A flying
 * unit is not stopped by static map walls — it routes over them — but it still
 * cannot leave the map, and the caller's `isBlocked` (units, etc.) still
 * applies. Ground routing is unchanged: `ignoreWalls` defaults to false, so
 * every existing caller and test behaves exactly as before.
 */

export interface RouteQuery {
  start: GridPosition;
  goals: GridPosition[];
  /** Optional extra impassable tiles (e.g. units), on top of walls. */
  isBlocked?: (pos: GridPosition) => boolean;
  /**
   * When true, STATIC map walls do not block this route (flying units). The
   * route is still confined to the map and still honours `isBlocked`. Default
   * false — ordinary ground routing, where walls block.
   */
  ignoreWalls?: boolean;
}

const KEY = (p: GridPosition): string => `${p.x},${p.y}`;

export class PathfindingSystem {
  constructor(private readonly map: GameMap) {}

  private canEnter(
    pos: GridPosition,
    isBlocked?: (p: GridPosition) => boolean,
    ignoreWalls?: boolean,
  ): boolean {
    // Ground units need a walkable floor tile; flying units only need to stay
    // on the map (walls are flown over), but never leave its bounds.
    const onValidTile = ignoreWalls
      ? this.map.isInBounds(pos)
      : this.map.isWalkable(pos);
    if (!onValidTile) return false;
    if (isBlocked && isBlocked(pos)) return false;
    return true;
  }

  /**
   * Shortest (by true Euclidean distance, see D-141) route from `start` to
   * the NEAREST goal, as the sequence of tiles to walk EXCLUDING start and
   * INCLUDING the goal reached, each carrying its exact cumulative distance
   * in feet. Returns null when the start is already a goal, or when no goal
   * is reachable. Never mutates inputs.
   */
  routeToNearestGoal(query: RouteQuery): RoutedPosition[] | null {
    const { start, goals, isBlocked, ignoreWalls } = query;
    if (goals.length === 0) return null;

    const goalKeys = new Set(goals.map(KEY));
    if (goalKeys.has(KEY(start))) return null; // already at a goal

    const canEnter = (pos: GridPosition): boolean => this.canEnter(pos, isBlocked, ignoreWalls);
    const search = weightedDistances(start, canEnter, goalKeys);
    if (!search.reachedGoal) return null;

    return reconstructRoute(search.reachedGoal, start, search);
  }

  /** True if any goal is reachable from start (used by later build validation). */
  hasRoute(query: RouteQuery): boolean {
    return this.routeToNearestGoal(query) !== null;
  }

  /**
   * Enemy AI/Movement Redesign §3 (D-146), smart positioning: every tile
   * reachable from `start` within `budgetTiles` of movement (rounded to the
   * nearest 5ft tile-unit, the same threshold rule every other budget check
   * in this project uses), each carrying its exact cumulative distance.
   * Unlike `routeToNearestGoal`, this has no single destination in mind — a
   * caller comparing MANY candidate stop tiles at once (see
   * `WaveSystem.bestPositioningTile`) needs the whole reachable set, not a
   * route to one goal. Deliberately INCLUDES `start` itself at distance 0
   * (unlike `MovementSystem.reachableTiles`, which excludes it) — "don't
   * move at all" is a legitimate candidate for a positioning decision.
   */
  reachableTiles(
    start: GridPosition,
    budgetTiles: number,
    isBlocked?: (pos: GridPosition) => boolean,
    ignoreWalls?: boolean,
  ): RoutedPosition[] {
    const canEnter = (pos: GridPosition): boolean => this.canEnter(pos, isBlocked, ignoreWalls);
    const budgetFeet = budgetTiles * TILE_FEET;
    const { dist } = weightedDistances(start, canEnter, undefined, budgetFeet);
    const result: RoutedPosition[] = [];
    for (const [key, d] of dist) {
      if (roundToTileUnit(d) > budgetFeet) continue;
      const [x, y] = key.split(",").map(Number);
      result.push({ x, y, distanceFeet: d });
    }
    return result;
  }
}
