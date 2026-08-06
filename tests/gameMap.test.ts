import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";

/**
 * Phase 1 tests: map parsing and the tile/selection rules.
 * These back the acceptance criteria: clicks map to correct logical tiles, and
 * invalid tiles cannot be selected. All run without a browser or Phaser.
 */

// A tiny hand-checkable map:
//   row0: S..#     spawn at (0,0), wall at (3,0)
//   row1: .HE.     hero at (1,1), enemy at (2,1)
//   row2: ...X     exit at (3,2)
const rows = ["S..#", ".HE.", "...X"];
const parsed = parseMapRows("tiny", "Tiny Test", rows);
const map = new GameMap(parsed);

describe("parseMapRows", () => {
  it("reads dimensions from the string art", () => {
    expect(parsed.cols).toBe(4);
    expect(parsed.rows).toBe(3);
  });

  it("records special positions", () => {
    expect(parsed.spawns).toEqual([{ x: 0, y: 0 }]);
    expect(parsed.exits).toEqual([{ x: 3, y: 2 }]);
    expect(parsed.heroStarts).toEqual([{ x: 1, y: 1 }]);
    expect(parsed.enemyStarts).toEqual([{ x: 2, y: 1 }]);
  });

  it("marks walls as blocked and everything else as floor", () => {
    expect(parsed.tiles[0][3]).toBe("blocked");
    expect(parsed.tiles[0][0]).toBe("floor"); // spawn is floor underneath
    expect(parsed.tiles[1][1]).toBe("floor"); // hero start is floor underneath
  });

  it("throws on ragged rows", () => {
    expect(() => parseMapRows("bad", "Bad", ["..", "..."])).toThrow();
  });

  it("throws on unknown characters", () => {
    expect(() => parseMapRows("bad", "Bad", ["?"])).toThrow();
  });
});

describe("GameMap tile queries", () => {
  it("returns tile types and null off-map", () => {
    expect(map.getTileType({ x: 0, y: 0 })).toBe("floor");
    expect(map.getTileType({ x: 3, y: 0 })).toBe("blocked");
    expect(map.getTileType({ x: -1, y: 0 })).toBeNull();
    expect(map.getTileType({ x: 4, y: 0 })).toBeNull();
  });

  it("reports blocked and walkable correctly", () => {
    expect(map.isBlocked({ x: 3, y: 0 })).toBe(true);
    expect(map.isWalkable({ x: 3, y: 0 })).toBe(false);
    expect(map.isWalkable({ x: 0, y: 0 })).toBe(true);
  });

  it("identifies tile roles", () => {
    expect(map.roleAt({ x: 0, y: 0 })).toBe("spawn");
    expect(map.roleAt({ x: 3, y: 2 })).toBe("exit");
    expect(map.roleAt({ x: 1, y: 1 })).toBe("hero-start");
    expect(map.roleAt({ x: 2, y: 1 })).toBe("enemy-start");
    expect(map.roleAt({ x: 0, y: 1 })).toBeNull();
  });
});

describe("GameMap.isSelectable (acceptance criterion)", () => {
  it("allows floor tiles", () => {
    expect(map.isSelectable({ x: 0, y: 0 })).toBe(true);
    expect(map.isSelectable({ x: 1, y: 1 })).toBe(true);
  });

  it("rejects wall tiles", () => {
    expect(map.isSelectable({ x: 3, y: 0 })).toBe(false);
  });

  it("rejects off-map tiles", () => {
    expect(map.isSelectable({ x: -1, y: 0 })).toBe(false);
    expect(map.isSelectable({ x: 99, y: 99 })).toBe(false);
  });
});
