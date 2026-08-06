import type { GridPosition } from "./GridSystem";
import { GameMap } from "./GameMap";

/**
 * MovementSystem: pure movement legality and pathfinding. No Phaser.
 *
 * Per the Phase 1 handoff, movement legality lives in this new system and asks
 * `GameMap.isWalkable` which tiles a unit may stand on. Rendering the range and
 * the path preview stays in BattleScene; this class only computes facts.
 *
 * Movement model (Phase 2 default, see DECISIONS D-016):
 *   - Four-directional movement (up/down/left/right), cost 1 tile per step.
 *     This matches the Manhattan distance helper already in GridSystem.
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

const NEIGHBOURS: ReadonlyArray<GridPosition> = [
  { x: 0, y: -1 }, // up
  { x: 0, y: 1 }, // down
  { x: -1, y: 0 }, // left
  { x: 1, y: 0 }, // right
];

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
   * Breadth-first flood fill from `start`, returning the shortest tile-distance
   * to every reachable tile within `budget`. The start tile itself has cost 0.
   * This never mutates its inputs.
   */
  private distances(query: MovementQuery): Map<string, number> {
    const { start, budget, isOccupied } = query;
    const dist = new Map<string, number>();
    dist.set(KEY(start), 0);

    // Simple queue-based BFS. Budget is small (a few tiles), so this is cheap.
    const queue: GridPosition[] = [start];
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      const currentDist = dist.get(KEY(current))!;
      if (currentDist >= budget) continue;
      for (const step of NEIGHBOURS) {
        const next = { x: current.x + step.x, y: current.y + step.y };
        const nextKey = KEY(next);
        if (dist.has(nextKey)) continue;
        if (!this.canEnter(next, isOccupied)) continue;
        dist.set(nextKey, currentDist + 1);
        queue.push(next);
      }
    }
    return dist;
  }

  /**
   * All tiles the unit could move to (excludes the start tile). Order is not
   * significant; the scene highlights the whole set.
   */
  reachableTiles(query: MovementQuery): GridPosition[] {
    const dist = this.distances(query);
    const result: GridPosition[] = [];
    for (const [key, d] of dist) {
      if (d === 0) continue; // skip the start tile itself
      const [x, y] = key.split(",").map(Number);
      const pos = { x, y };
      // D-067: passable but not stoppable (e.g. another hero) — reachable for
      // PASSING THROUGH, so it stays in `dist` for BFS continuation, but it
      // is not a legal place to end this move, so it's excluded here.
      if (query.blocksStopping && query.blocksStopping(pos)) continue;
      result.push(pos);
    }
    return result;
  }

  /** True if `dest` is a legal move target for this query. */
  isLegalDestination(dest: GridPosition, query: MovementQuery): boolean {
    const dist = this.distances(query);
    const d = dist.get(KEY(dest));
    if (d === undefined || d === 0) return false; // unreachable or the start tile
    if (query.blocksStopping && query.blocksStopping(dest)) return false;
    return true;
  }

  /**
   * Shortest path from start to dest as the sequence of steps to walk,
   * EXCLUDING the start tile and INCLUDING dest. Returns null when dest is the
   * start tile, is a wall, is occupied (or stopping-blocked), or is beyond the
   * movement budget. Never mutates its inputs.
   */
  findPath(dest: GridPosition, query: MovementQuery): GridPosition[] | null {
    const { start, budget, isOccupied, blocksStopping } = query;
    if (start.x === dest.x && start.y === dest.y) return null;
    if (!this.canEnter(dest, isOccupied)) return null;
    if (blocksStopping && blocksStopping(dest)) return null;

    const dist = new Map<string, number>();
    const cameFrom = new Map<string, GridPosition>();
    dist.set(KEY(start), 0);
    const queue: GridPosition[] = [start];
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      const currentDist = dist.get(KEY(current))!;
      if (current.x === dest.x && current.y === dest.y) break;
      if (currentDist >= budget) continue;
      for (const step of NEIGHBOURS) {
        const next = { x: current.x + step.x, y: current.y + step.y };
        const nextKey = KEY(next);
        if (dist.has(nextKey)) continue;
        if (!this.canEnter(next, isOccupied)) continue;
        dist.set(nextKey, currentDist + 1);
        cameFrom.set(nextKey, current);
        queue.push(next);
      }
    }

    if (!dist.has(KEY(dest))) return null; // never reached within budget

    // Walk backwards from dest to start using cameFrom, then reverse.
    const path: GridPosition[] = [];
    let step: GridPosition | undefined = dest;
    while (step && !(step.x === start.x && step.y === start.y)) {
      path.push(step);
      step = cameFrom.get(KEY(step));
    }
    path.reverse();
    return path;
  }
}
