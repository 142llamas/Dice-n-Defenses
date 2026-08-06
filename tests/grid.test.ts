import { describe, it, expect } from "vitest";
import { GridSystem } from "../src/game/systems/GridSystem";

/**
 * Tests for the pure grid logic. These prove the "coordinate conversion" target
 * from the Source of Truth testing section, and they run with no browser and no
 * Phaser — demonstrating the "logic is testable without visuals" architecture.
 */

// A small 4x3 grid, 10px tiles, offset by (100, 50), for easy hand-math.
const grid = new GridSystem(4, 3, 10, 100, 50);

describe("GridSystem.isInBounds", () => {
  it("accepts tiles inside the grid", () => {
    expect(grid.isInBounds({ x: 0, y: 0 })).toBe(true);
    expect(grid.isInBounds({ x: 3, y: 2 })).toBe(true);
  });

  it("rejects tiles outside the grid", () => {
    expect(grid.isInBounds({ x: -1, y: 0 })).toBe(false);
    expect(grid.isInBounds({ x: 4, y: 0 })).toBe(false);
    expect(grid.isInBounds({ x: 0, y: 3 })).toBe(false);
  });

  it("rejects non-integer coordinates", () => {
    expect(grid.isInBounds({ x: 1.5, y: 0 })).toBe(false);
  });
});

describe("GridSystem.tileToWorldCenter", () => {
  it("returns the pixel centre of a tile", () => {
    // Tile (0,0): origin (100,50) + half a 10px tile = (105, 55).
    expect(grid.tileToWorldCenter({ x: 0, y: 0 })).toEqual({ x: 105, y: 55 });
    // Tile (2,1): 100 + 2*10 + 5 = 125 ; 50 + 1*10 + 5 = 65.
    expect(grid.tileToWorldCenter({ x: 2, y: 1 })).toEqual({ x: 125, y: 65 });
  });
});

describe("GridSystem.worldToTile", () => {
  it("maps a pixel inside the grid to the correct tile", () => {
    // Pixel (105,55) is the centre of tile (0,0).
    expect(grid.worldToTile({ x: 105, y: 55 })).toEqual({ x: 0, y: 0 });
    // Anywhere inside tile (3,2): x in [130,140), y in [70,80).
    expect(grid.worldToTile({ x: 131, y: 71 })).toEqual({ x: 3, y: 2 });
  });

  it("returns null for pixels outside the grid", () => {
    expect(grid.worldToTile({ x: 0, y: 0 })).toBeNull(); // left of origin
    expect(grid.worldToTile({ x: 999, y: 999 })).toBeNull(); // far away
  });

  it("round-trips: tile -> centre pixel -> same tile", () => {
    for (let x = 0; x < grid.cols; x++) {
      for (let y = 0; y < grid.rows; y++) {
        const center = grid.tileToWorldCenter({ x, y });
        expect(grid.worldToTile(center)).toEqual({ x, y });
      }
    }
  });
});

describe("GridSystem static helpers", () => {
  it("equals compares two positions", () => {
    expect(GridSystem.equals({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(GridSystem.equals({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });

  it("manhattanDistance measures grid distance", () => {
    expect(GridSystem.manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(GridSystem.manhattanDistance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });
});
