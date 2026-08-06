import type { GridPosition } from "./GridSystem";
import { GameMap } from "./GameMap";

/**
 * PathfindingSystem: pure enemy routing. No Phaser.
 *
 * Where MovementSystem answers "which tiles can a hero reach within a small
 * budget", this answers "what is the full route from an enemy to the nearest
 * exit". Same breadth-first idea, but with no budget cap and multiple goal
 * tiles. Enemies use this each enemy phase to know which way to march.
 *
 * Movement model matches the rest of the game: four-directional steps over
 * walkable floor tiles (walls block). By default enemies ignore other units so
 * a valid route to the exit always exists (the "Hero collision" question is
 * still OPEN in the Source of Truth); callers may pass `isBlocked` to treat
 * extra tiles as impassable if a later phase decides units should block.
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

const NEIGHBOURS: ReadonlyArray<GridPosition> = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

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
   * Shortest route from `start` to the NEAREST goal, as the sequence of tiles to
   * walk EXCLUDING start and INCLUDING the goal reached. Returns null when the
   * start is already a goal, or when no goal is reachable. Never mutates inputs.
   */
  routeToNearestGoal(query: RouteQuery): GridPosition[] | null {
    const { start, goals, isBlocked, ignoreWalls } = query;
    if (goals.length === 0) return null;

    const goalKeys = new Set(goals.map(KEY));
    if (goalKeys.has(KEY(start))) return null; // already at a goal

    const dist = new Map<string, number>();
    const cameFrom = new Map<string, GridPosition>();
    dist.set(KEY(start), 0);
    const queue: GridPosition[] = [start];
    let head = 0;
    let reached: GridPosition | null = null;

    while (head < queue.length) {
      const current = queue[head++];
      if (goalKeys.has(KEY(current))) {
        reached = current;
        break;
      }
      for (const step of NEIGHBOURS) {
        const next = { x: current.x + step.x, y: current.y + step.y };
        const nextKey = KEY(next);
        if (dist.has(nextKey)) continue;
        // A goal tile is always enterable even if isBlocked would flag it, so a
        // reachable exit is never accidentally sealed off by occupancy.
        const enterable =
          goalKeys.has(nextKey) || this.canEnter(next, isBlocked, ignoreWalls);
        if (!enterable) continue;
        dist.set(nextKey, dist.get(KEY(current))! + 1);
        cameFrom.set(nextKey, current);
        queue.push(next);
      }
    }

    if (!reached) return null;

    const path: GridPosition[] = [];
    let step: GridPosition | undefined = reached;
    while (step && !(step.x === start.x && step.y === start.y)) {
      path.push(step);
      step = cameFrom.get(KEY(step));
    }
    path.reverse();
    return path;
  }

  /** True if any goal is reachable from start (used by later build validation). */
  hasRoute(query: RouteQuery): boolean {
    return this.routeToNearestGoal(query) !== null;
  }
}
