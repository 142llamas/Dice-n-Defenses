import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { MovementSystem } from "../src/game/systems/MovementSystem";
import type { GridPosition } from "../src/game/systems/GridSystem";

/**
 * Phase 2 movement tests. These back the acceptance criterion "only legal
 * destinations are accepted": the range, path, and legality checks must respect
 * walls, occupancy, and the movement budget. All run without Phaser or a browser.
 */

// A small open room with one wall column to force pathing around it:
//   row0: .....
//   row1: ..#..     wall at (2,1)
//   row2: .....
const openRows = [".....", "..#..", "....."];
const openMap = new GameMap(parseMapRows("open", "Open Room", openRows));
const move = new MovementSystem(openMap);

const key = (p: GridPosition) => `${p.x},${p.y}`;
const has = (list: GridPosition[], p: GridPosition) =>
  list.some((q) => q.x === p.x && q.y === p.y);

describe("MovementSystem.reachableTiles", () => {
  it("returns tiles within budget and excludes the start tile", () => {
    const start = { x: 2, y: 2 };
    const tiles = move.reachableTiles({ start, budget: 1 });
    // From (2,2) with 1 tile: up (2,1) is a WALL, so only left/right/down.
    expect(has(tiles, start)).toBe(false);
    expect(has(tiles, { x: 1, y: 2 })).toBe(true);
    expect(has(tiles, { x: 3, y: 2 })).toBe(true);
    expect(has(tiles, { x: 2, y: 1 })).toBe(false); // wall
  });

  it("never includes walls or off-map tiles", () => {
    const tiles = move.reachableTiles({ start: { x: 2, y: 2 }, budget: 5 });
    expect(has(tiles, { x: 2, y: 1 })).toBe(false); // wall
    for (const t of tiles) {
      expect(openMap.isWalkable(t)).toBe(true);
    }
  });

  it("grows the reachable set as the budget increases", () => {
    const start = { x: 0, y: 0 };
    const small = move.reachableTiles({ start, budget: 1 });
    const large = move.reachableTiles({ start, budget: 4 });
    expect(large.length).toBeGreaterThan(small.length);
  });

  it("treats occupied tiles as impassable", () => {
    const start = { x: 0, y: 2 };
    const occupied = new Set([key({ x: 1, y: 2 })]);
    const tiles = move.reachableTiles({
      start,
      budget: 2,
      isOccupied: (p) => occupied.has(key(p)),
    });
    // (1,2) is occupied, so within 2 tiles we cannot reach (2,2) along that row.
    expect(has(tiles, { x: 1, y: 2 })).toBe(false);
    expect(has(tiles, { x: 2, y: 2 })).toBe(false);
    // But we can still go up and around the open top row.
    expect(has(tiles, { x: 0, y: 1 })).toBe(true);
  });
});

describe("MovementSystem.findPath", () => {
  it("finds a shortest path, excluding start and including dest", () => {
    const path = move.findPath({ x: 4, y: 2 }, { start: { x: 0, y: 2 }, budget: 4 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4); // 4 steps east along the open bottom row
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 2 });
    expect(has(path!, { x: 0, y: 2 })).toBe(false); // start excluded
  });

  it("routes around a wall", () => {
    // (1,1) to (3,1) straight across would pass through the wall at (2,1);
    // the path must detour and therefore be longer than the 2-tile straight line.
    const path = move.findPath({ x: 3, y: 1 }, { start: { x: 1, y: 1 }, budget: 6 });
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(2);
    expect(has(path!, { x: 2, y: 1 })).toBe(false); // never steps on the wall
  });

  it("returns null when the destination is beyond the budget", () => {
    const path = move.findPath({ x: 4, y: 2 }, { start: { x: 0, y: 2 }, budget: 3 });
    expect(path).toBeNull();
  });

  it("returns null for the start tile, walls, and off-map tiles", () => {
    expect(move.findPath({ x: 0, y: 0 }, { start: { x: 0, y: 0 }, budget: 3 })).toBeNull();
    expect(move.findPath({ x: 2, y: 1 }, { start: { x: 2, y: 2 }, budget: 3 })).toBeNull();
    expect(move.findPath({ x: 9, y: 9 }, { start: { x: 0, y: 0 }, budget: 3 })).toBeNull();
  });
});

describe("MovementSystem.isLegalDestination (acceptance criterion)", () => {
  it("accepts reachable floor tiles", () => {
    expect(move.isLegalDestination({ x: 2, y: 2 }, { start: { x: 0, y: 2 }, budget: 2 })).toBe(true);
  });

  it("rejects the start tile, walls, off-map, and out-of-budget tiles", () => {
    const start = { x: 0, y: 2 };
    expect(move.isLegalDestination(start, { start, budget: 3 })).toBe(false); // no move
    expect(move.isLegalDestination({ x: 2, y: 1 }, { start, budget: 5 })).toBe(false); // wall
    expect(move.isLegalDestination({ x: -1, y: 0 }, { start, budget: 5 })).toBe(false); // off-map
    expect(move.isLegalDestination({ x: 4, y: 2 }, { start, budget: 3 })).toBe(false); // too far
  });
});

describe("MovementSystem.blocksStopping (D-067: pass through, never stop)", () => {
  it("reachableTiles excludes a stopping-blocked tile but still includes tiles beyond it", () => {
    const start = { x: 0, y: 2 };
    // (1,2) is stopping-blocked (e.g. another hero) but NOT occupied, so a
    // unit may walk THROUGH it to reach (2,2).
    const tiles = move.reachableTiles({
      start,
      budget: 2,
      blocksStopping: (p) => p.x === 1 && p.y === 2,
    });
    expect(has(tiles, { x: 1, y: 2 })).toBe(false); // can't end the move here
    expect(has(tiles, { x: 2, y: 2 })).toBe(true); // but can end one tile past it
  });

  it("isLegalDestination rejects the stopping-blocked tile itself but accepts tiles reached by passing through it", () => {
    const start = { x: 0, y: 2 };
    const blocksStopping = (p: GridPosition) => p.x === 1 && p.y === 2;
    expect(move.isLegalDestination({ x: 1, y: 2 }, { start, budget: 2, blocksStopping })).toBe(false);
    expect(move.isLegalDestination({ x: 2, y: 2 }, { start, budget: 2, blocksStopping })).toBe(true);
  });

  it("findPath routes THROUGH a stopping-blocked tile to a destination beyond it, and returns null if dest IS that tile", () => {
    const start = { x: 0, y: 2 };
    const blocksStopping = (p: GridPosition) => p.x === 1 && p.y === 2;
    const path = move.findPath({ x: 2, y: 2 }, { start, budget: 2, blocksStopping });
    expect(path).not.toBeNull();
    expect(path).toEqual([{ x: 1, y: 2 }, { x: 2, y: 2 }]); // walked straight through (1,2)
    expect(move.findPath({ x: 1, y: 2 }, { start, budget: 2, blocksStopping })).toBeNull();
  });

  it("isOccupied (hard block) and blocksStopping (soft block) are independent", () => {
    const start = { x: 0, y: 2 };
    // (1,2) is a hard block (e.g. an enemy) — nothing may pass through it at
    // all, unlike blocksStopping which only forbids ENDING a move there.
    const tiles = move.reachableTiles({
      start,
      budget: 2,
      isOccupied: (p) => p.x === 1 && p.y === 2,
    });
    expect(has(tiles, { x: 2, y: 2 })).toBe(false); // cannot route past a hard block
  });
});

describe("MovementSystem.routeThroughWaypoints (drag-and-drop pinned corners)", () => {
  it("a single waypoint matches findPath's own result and distance", () => {
    const start = { x: 0, y: 2 };
    const dest = { x: 4, y: 2 };
    const route = move.routeThroughWaypoints([dest], { start, budget: 4 });
    expect(route).not.toBeNull();
    expect(route!.path).toEqual(move.findPath(dest, { start, budget: 4 }));
    expect(route!.usedTiles).toBe(4);
    expect(route!.withinBudget).toBe(true);
  });

  it("sums each leg's OWN rounded distance rather than rounding the raw grand total once", () => {
    // (3,0) -> (4,1) -> (3,2): two single-diagonal-hop legs, well clear of
    // the (2,1) wall so neither leg's corner-cutting check is involved. A
    // lone diagonal hop costs 5*sqrt(2)~=7.071ft, which rounds to 5ft (1
    // tile) on its own — so two of them sum to 2 tiles (10ft) under this
    // method's "round after each leg" rule. Rounding the raw 14.142ft
    // grand total just once would instead give 3 tiles (15ft) — this test
    // pins down which convention is actually implemented.
    const start = { x: 3, y: 0 };
    const route = move.routeThroughWaypoints([{ x: 4, y: 1 }, { x: 3, y: 2 }], { start, budget: 10 });
    expect(route).not.toBeNull();
    expect(route!.usedTiles).toBe(2);
    expect(route!.path).toEqual([{ x: 4, y: 1 }, { x: 3, y: 2 }]);
  });

  it("withinBudget is false when the summed legs exceed budget, but the full route/distance are still returned, not null", () => {
    const start = { x: 3, y: 0 };
    const route = move.routeThroughWaypoints([{ x: 4, y: 1 }, { x: 3, y: 2 }], { start, budget: 1 });
    expect(route).not.toBeNull();
    expect(route!.usedTiles).toBe(2);
    expect(route!.withinBudget).toBe(false);
    expect(route!.path).toEqual([{ x: 4, y: 1 }, { x: 3, y: 2 }]);
  });

  it("returns null when an intermediate waypoint (not just the final one) is a wall", () => {
    const start = { x: 1, y: 1 };
    const route = move.routeThroughWaypoints([{ x: 2, y: 1 }, { x: 3, y: 1 }], { start, budget: 10 });
    expect(route).toBeNull();
  });

  it("returns null when an intermediate waypoint is occupied", () => {
    const start = { x: 0, y: 0 };
    const route = move.routeThroughWaypoints([{ x: 1, y: 0 }, { x: 2, y: 0 }], {
      start,
      budget: 10,
      isOccupied: (p) => p.x === 1 && p.y === 0,
    });
    expect(route).toBeNull();
  });

  it("a waypoint equal to the current running position collapses to a no-op leg, not a null result", () => {
    const start = { x: 0, y: 2 };
    const dest = { x: 2, y: 2 };
    // First waypoint duplicates `start` itself.
    const withNoOp = move.routeThroughWaypoints([start, dest], { start, budget: 4 });
    const plain = move.routeThroughWaypoints([dest], { start, budget: 4 });
    expect(withNoOp).toEqual(plain);
    // Two consecutive identical pins mid-chain.
    const pin = { x: 1, y: 2 };
    const withDuplicatePin = move.routeThroughWaypoints([pin, pin, dest], { start, budget: 4 });
    expect(withDuplicatePin).toEqual(plain);
  });

  it("blocksStopping rejects only the FINAL waypoint — an intermediate pin on a stopping-blocked (but enterable) tile is fine", () => {
    const start = { x: 0, y: 2 };
    const blocksStopping = (p: GridPosition) => p.x === 1 && p.y === 2;
    const asFinal = move.routeThroughWaypoints([{ x: 1, y: 2 }], { start, budget: 5, blocksStopping });
    expect(asFinal).toBeNull();
    const asIntermediate = move.routeThroughWaypoints([{ x: 1, y: 2 }, { x: 3, y: 2 }], {
      start,
      budget: 5,
      blocksStopping,
    });
    expect(asIntermediate).not.toBeNull();
    expect(asIntermediate!.path[asIntermediate!.path.length - 1]).toEqual({ x: 3, y: 2 });
  });

  it("still routes around a wall within a single leg (no-corner-cutting is unchanged — already covered by findPath/DiagonalMovement's own tests, this just confirms routeThroughWaypoints doesn't bypass it)", () => {
    const route = move.routeThroughWaypoints([{ x: 3, y: 1 }], { start: { x: 1, y: 1 }, budget: 10 });
    expect(route).not.toBeNull();
    expect(route!.path.length).toBeGreaterThan(2);
    expect(has(route!.path, { x: 2, y: 1 })).toBe(false); // never steps on the wall
  });
});

describe("MovementSystem purity", () => {
  it("does not mutate the query's start position", () => {
    const start = { x: 0, y: 0 };
    move.reachableTiles({ start, budget: 3 });
    move.findPath({ x: 2, y: 0 }, { start, budget: 3 });
    expect(start).toEqual({ x: 0, y: 0 });
  });
});
