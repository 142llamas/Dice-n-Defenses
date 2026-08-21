import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { MovementSystem } from "../src/game/systems/MovementSystem";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { roundToTileUnit, DIAGONAL_COST_FEET } from "../src/game/systems/DiagonalMovement";

/**
 * Enemy AI/Movement Redesign §5 (D-141): diagonal movement, true Euclidean
 * cost, cumulative (not per-step) rounding, and no corner-cutting. These
 * tests exercise the new capability directly — `tests/movement.test.ts` and
 * `tests/pathfinding.test.ts` continue to cover the pre-existing
 * orthogonal-only behavior, still fully intact.
 */

// A fully open 5x5 room — nothing to route around, so any shortest path is
// purely a function of the cost model itself.
const openRows = [".....", ".....", ".....", ".....", "....."];
const openMap = new GameMap(parseMapRows("open5", "Open Room", openRows));

describe("D-141: diagonal cost model", () => {
  it("rounds a single diagonal step's cost to the same 5ft as a cardinal step", () => {
    expect(roundToTileUnit(DIAGONAL_COST_FEET)).toBe(5);
  });

  it("rounds TWO diagonal steps to 15ft, not 5+5=10ft (cumulative, not per-step, rounding)", () => {
    expect(roundToTileUnit(DIAGONAL_COST_FEET * 2)).toBe(15);
  });

  it("PathfindingSystem: a diagonal route is shorter (fewer tiles) than an orthogonal-only one over open ground", () => {
    const pf = new PathfindingSystem(openMap);
    const route = pf.routeToNearestGoal({ start: { x: 0, y: 0 }, goals: [{ x: 4, y: 4 }] });
    expect(route).not.toBeNull();
    // Old four-directional BFS needed 8 steps (dx+dy). Diagonal movement
    // covers this in 4 (four diagonal hops straight to the corner).
    expect(route!.length).toBe(4);
    expect(route![route!.length - 1]).toMatchObject({ x: 4, y: 4 });
  });

  it("PathfindingSystem: route tiles report exact, monotonically increasing cumulative distance", () => {
    const pf = new PathfindingSystem(openMap);
    const route = pf.routeToNearestGoal({ start: { x: 0, y: 0 }, goals: [{ x: 4, y: 4 }] })!;
    let prev = 0;
    for (const step of route) {
      expect(step.distanceFeet).toBeGreaterThan(prev);
      prev = step.distanceFeet;
    }
    // Four diagonal steps: exact cumulative should be 4 * 5*sqrt(2).
    expect(route[route.length - 1].distanceFeet).toBeCloseTo(4 * DIAGONAL_COST_FEET, 5);
  });

  it("MovementSystem: reachableTiles includes a diagonal neighbor in open ground", () => {
    const move = new MovementSystem(openMap);
    const tiles = move.reachableTiles({ start: { x: 2, y: 2 }, budget: 1 });
    // (1,1) is a diagonal neighbor; its rounded cost (5ft) fits a 1-tile budget.
    expect(tiles.some((t) => t.x === 1 && t.y === 1)).toBe(true);
  });

  it("no corner-cutting: a diagonal step next to a wall is illegal even though the destination is open", () => {
    // Use a map where the wall sits BESIDE (not on) the diagonal destination,
    // so the corner-cut rule — not plain unreachability — is what's tested.
    const rows = ["....", ".#..", "...."];
    const map = new GameMap(parseMapRows("cut", "Cut", rows));
    const mv = new MovementSystem(map);
    // (0,0) -> (1,1): destination (1,1) is the wall itself — not the case we
    // want. Instead: (0,1) -> (1,0) diagonal move. Flank tiles are (1,1)
    // (the wall) and (0,0) (open). One flank is blocked, so this diagonal
    // must be illegal even though (1,0) itself is open floor.
    const tiles = mv.reachableTiles({ start: { x: 0, y: 1 }, budget: 1 });
    expect(tiles.some((t) => t.x === 1 && t.y === 0)).toBe(false);
    // Sanity: the same tile IS reachable with a larger budget via the
    // orthogonal detour, proving it's the corner-cut rule (not a general
    // unreachability) blocking the budget-1 case above.
    const withRoom = mv.reachableTiles({ start: { x: 0, y: 1 }, budget: 2 });
    expect(withRoom.some((t) => t.x === 1 && t.y === 0)).toBe(true);
  });

  it("no corner-cutting applies to enemy routing too (PathfindingSystem)", () => {
    const rows = ["....", ".#..", "...."];
    const map = new GameMap(parseMapRows("cut2", "Cut2", rows));
    const pf = new PathfindingSystem(map);
    const route = pf.routeToNearestGoal({ start: { x: 0, y: 1 }, goals: [{ x: 1, y: 0 }] });
    expect(route).not.toBeNull();
    // Must NOT be the single illegal diagonal hop — a real route takes at
    // least 2 steps (around the wall).
    expect(route!.length).toBeGreaterThan(1);
  });
});
