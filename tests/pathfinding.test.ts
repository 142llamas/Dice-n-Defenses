import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import type { GridPosition } from "../src/game/systems/GridSystem";

/**
 * Phase 3 pathfinding tests. These back the acceptance criterion "enemies follow
 * valid routes": the router must reach the nearest exit over walkable tiles and
 * route around walls, and must report unreachable exits honestly.
 */

const has = (list: GridPosition[], p: GridPosition) =>
  list.some((q) => q.x === p.x && q.y === p.y);

// A straight open lane with one exit on the right.
//   S....X   (row 0)
const laneMap = new GameMap(parseMapRows("lane", "Lane", ["S....X"]));
const lane = new PathfindingSystem(laneMap);

// A lane with a wall that forces a detour up and over:
//   row0: S.#..
//   row1: ...#.
//   row2: ....X
const detourRows = ["S.#..", "...#.", "....X"];
const detourMap = new GameMap(parseMapRows("detour", "Detour", detourRows));
const detour = new PathfindingSystem(detourMap);

describe("PathfindingSystem.routeToNearestGoal", () => {
  it("walks straight to the exit down an open lane", () => {
    const route = lane.routeToNearestGoal({
      start: { x: 0, y: 0 },
      goals: [{ x: 5, y: 0 }],
    });
    expect(route).not.toBeNull();
    expect(route!.length).toBe(5); // five steps east
    // D-141: route tiles now also carry `distanceFeet` (real Euclidean cost),
    // so match on x/y only rather than an exact object shape.
    expect(route![route!.length - 1]).toMatchObject({ x: 5, y: 0 });
    expect(has(route!, { x: 0, y: 0 })).toBe(false); // start excluded
  });

  it("routes around walls instead of through them", () => {
    const route = detour.routeToNearestGoal({
      start: { x: 0, y: 0 },
      goals: detourMap.data.exits,
    });
    expect(route).not.toBeNull();
    // It must never step on a wall tile.
    for (const step of route!) expect(detourMap.isWalkable(step)).toBe(true);
    expect(route![route!.length - 1]).toMatchObject({ x: 4, y: 2 });
  });

  it("picks the nearest of several exits", () => {
    // Exits at both ends; start nearer the left one.
    const m = new GameMap(parseMapRows("two", "Two Exits", ["X...S...X"]));
    const pf = new PathfindingSystem(m);
    const route = pf.routeToNearestGoal({ start: { x: 4, y: 0 }, goals: m.data.exits });
    expect(route).not.toBeNull();
    expect(route![route!.length - 1]).toMatchObject({ x: 0, y: 0 }); // the closer exit
    expect(route!.length).toBe(4);
  });

  it("returns null when already standing on an exit", () => {
    const route = lane.routeToNearestGoal({ start: { x: 5, y: 0 }, goals: [{ x: 5, y: 0 }] });
    expect(route).toBeNull();
  });

  it("returns null when no exit is reachable", () => {
    // A wall fully separates the start from the exit.
    const m = new GameMap(parseMapRows("sealed", "Sealed", ["S#X"]));
    const pf = new PathfindingSystem(m);
    expect(pf.routeToNearestGoal({ start: { x: 0, y: 0 }, goals: m.data.exits })).toBeNull();
    expect(pf.hasRoute({ start: { x: 0, y: 0 }, goals: m.data.exits })).toBe(false);
  });

  it("does not mutate the query start", () => {
    const start = { x: 0, y: 0 };
    lane.routeToNearestGoal({ start, goals: [{ x: 5, y: 0 }] });
    expect(start).toEqual({ x: 0, y: 0 });
  });
});
