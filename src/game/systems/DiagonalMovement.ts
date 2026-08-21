import type { GridPosition } from "./GridSystem";

/**
 * DiagonalMovement: the shared weighted-pathfinding core for both
 * `MovementSystem` (hero reachable-tiles/path) and `PathfindingSystem` (enemy
 * routing). No Phaser dependency.
 *
 * Enemy AI/Movement Redesign §5 (D-141), Kevin's exact cost model:
 *   - A cardinal (orthogonal) step costs 5ft. A diagonal step costs
 *     5*sqrt(2) (~7.071ft) — true Euclidean distance, not a flattened 5ft.
 *   - Cumulative distance along a route is tracked EXACTLY (unrounded) as
 *     you move. Only when that cumulative value is compared against a
 *     movement budget (or displayed) does it round to the nearest 5ft. This
 *     means two diagonal steps in a row cost round(14.142) = 15ft, NOT
 *     5+5 = 10ft — rounding the running total is not the same as rounding
 *     each step and summing, and the difference compounds with more steps.
 *   - No corner-cutting: a diagonal step is illegal if EITHER of its two
 *     flanking orthogonal tiles is not enterable (the same combined
 *     wall/occupancy predicate the caller already uses for orthogonal
 *     entry) — a unit cannot cut through the gap next to an impassable
 *     tile, it must go around.
 *
 * A "movement budget" elsewhere in this codebase (`Hero`/`Enemy`
 * .movementTiles/.effectiveMovementTiles`) is unchanged in shape: still a
 * plain integer counted in 5ft tile-units. `budgetTilesToFeet` converts it
 * to the feet unit this module works in.
 */

export const TILE_FEET = 5;
export const DIAGONAL_COST_FEET = TILE_FEET * Math.SQRT2;

/** Convert an integer movement-tile budget (Hero/Enemy's existing field shape) to feet. */
export function budgetTilesToFeet(budgetTiles: number): number {
  return budgetTiles * TILE_FEET;
}

/** Round a cumulative distance to the nearest 5ft tile-unit — for budget comparisons/display only. */
export function roundToTileUnit(feet: number): number {
  return Math.round(feet / TILE_FEET) * TILE_FEET;
}

export interface RoutedPosition extends GridPosition {
  /** Exact (unrounded) cumulative distance from the route's start to this tile, in feet. */
  readonly distanceFeet: number;
}

const KEY = (p: GridPosition): string => `${p.x},${p.y}`;

interface NeighbourStep {
  dx: number;
  dy: number;
  cost: number;
}

// Order matters for tie-breaking parity with the previous plain-BFS behaviour
// (up/down/left/right first, diagonals after) — see D-141's own test-parity
// notes. Cardinal steps cost 5ft; diagonals cost the true hypotenuse.
const NEIGHBOURS: ReadonlyArray<NeighbourStep> = [
  { dx: 0, dy: -1, cost: TILE_FEET },
  { dx: 0, dy: 1, cost: TILE_FEET },
  { dx: -1, dy: 0, cost: TILE_FEET },
  { dx: 1, dy: 0, cost: TILE_FEET },
  { dx: -1, dy: -1, cost: DIAGONAL_COST_FEET },
  { dx: 1, dy: -1, cost: DIAGONAL_COST_FEET },
  { dx: -1, dy: 1, cost: DIAGONAL_COST_FEET },
  { dx: 1, dy: 1, cost: DIAGONAL_COST_FEET },
];

export interface WeightedSearchResult {
  /** Exact (unrounded) cumulative feet-distance from start to every visited tile. */
  dist: Map<string, number>;
  cameFrom: Map<string, GridPosition>;
  /** When `goalKeys` was supplied, the nearest goal actually reached (Dijkstra-optimal), if any. */
  reachedGoal: GridPosition | null;
}

/**
 * Dijkstra over 8-directional movement with the cost model above. `canEnter`
 * should already combine whatever the caller considers impassable (walls,
 * occupancy) — it is reused unmodified as the corner-cutting flank check.
 * When `goalKeys` is supplied, a goal tile is always enterable (even if
 * `canEnter` would say no) and the search stops the instant a goal is popped,
 * since Dijkstra guarantees that is the nearest one. `maxFeet`, when given,
 * prunes expansion from any node whose already-rounded distance exceeds it
 * (safe: edge costs are positive, so rounded distance is non-decreasing along
 * any path).
 */
export function weightedDistances(
  start: GridPosition,
  canEnter: (pos: GridPosition) => boolean,
  goalKeys?: Set<string>,
  maxFeet?: number,
): WeightedSearchResult {
  const dist = new Map<string, number>();
  const cameFrom = new Map<string, GridPosition>();
  const visited = new Set<string>();
  const startKey = KEY(start);
  dist.set(startKey, 0);
  const frontier: GridPosition[] = [start];
  let reachedGoal: GridPosition | null = null;

  while (frontier.length > 0) {
    let bestIdx = 0;
    let bestDist = dist.get(KEY(frontier[0]))!;
    for (let i = 1; i < frontier.length; i++) {
      const d = dist.get(KEY(frontier[i]))!;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const current = frontier.splice(bestIdx, 1)[0];
    const currentKey = KEY(current);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    if (goalKeys && goalKeys.has(currentKey) && currentKey !== startKey) {
      reachedGoal = current;
      break;
    }

    const currentDist = dist.get(currentKey)!;
    if (maxFeet !== undefined && roundToTileUnit(currentDist) > maxFeet) continue;

    for (const step of NEIGHBOURS) {
      const next = { x: current.x + step.dx, y: current.y + step.dy };
      const nextKey = KEY(next);
      if (visited.has(nextKey)) continue;

      const isDiagonal = step.dx !== 0 && step.dy !== 0;
      if (isDiagonal) {
        const flankA = { x: current.x + step.dx, y: current.y };
        const flankB = { x: current.x, y: current.y + step.dy };
        if (!canEnter(flankA) || !canEnter(flankB)) continue;
      }

      const enterable = (goalKeys && goalKeys.has(nextKey)) || canEnter(next);
      if (!enterable) continue;

      const newDist = currentDist + step.cost;
      const known = dist.get(nextKey);
      if (known === undefined || newDist < known) {
        dist.set(nextKey, newDist);
        cameFrom.set(nextKey, current);
        frontier.push(next);
      }
    }
  }

  return { dist, cameFrom, reachedGoal };
}

/** Reconstruct the route from `cameFrom`, EXCLUDING start and INCLUDING goal, with cumulative distance per tile. */
export function reconstructRoute(
  goal: GridPosition,
  start: GridPosition,
  search: WeightedSearchResult,
): RoutedPosition[] {
  const path: RoutedPosition[] = [];
  let step: GridPosition | undefined = goal;
  while (step && !(step.x === start.x && step.y === start.y)) {
    path.push({ ...step, distanceFeet: search.dist.get(KEY(step))! });
    step = search.cameFrom.get(KEY(step));
  }
  path.reverse();
  return path;
}
