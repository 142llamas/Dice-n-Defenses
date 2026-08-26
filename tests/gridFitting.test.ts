import { describe, it, expect } from "vitest";
import { computeFittedTileSize } from "../src/game/systems/GridSystem";

/**
 * D-176 (KI-098 item 9): shrink-to-fit tile size for BattleScene's dynamic
 * per-map grid — same math MapBuilderScene.rebuildGridSystem() already uses
 * inline, extracted into a pure, unit-testable function.
 */

describe("computeFittedTileSize", () => {
  it("clamps at maxTileSize when the map fits with room to spare", () => {
    expect(computeFittedTileSize(4, 3, 1000, 1000, 64)).toBe(64);
  });

  it("never upscales past maxTileSize even when there's abundant room", () => {
    expect(computeFittedTileSize(2, 2, 5000, 5000, 64)).toBe(64);
  });

  it("shrinks to the width-bound dimension when width is tighter", () => {
    // 10 cols into 300px width -> 30px/tile; height has plenty of room.
    expect(computeFittedTileSize(10, 3, 300, 1000, 64)).toBe(30);
  });

  it("shrinks to the height-bound dimension when height is tighter", () => {
    // 10 rows into 300px height -> 30px/tile; width has plenty of room.
    expect(computeFittedTileSize(3, 10, 1000, 300, 64)).toBe(30);
  });

  it("floors fractional results", () => {
    expect(computeFittedTileSize(3, 1, 100, 1000, 64)).toBe(33);
  });

  it("regression: every shipped map's real dimensions still fit at the base 64px tile", () => {
    // BattleScene's real available area (D-176: 1280 wide, 587 tall).
    const availableWidth = 1280;
    const availableHeight = 587;
    const shippedMapSizes: Array<[cols: number, rows: number]> = [
      [16, 9], // Test Map / Emberford Reach / Saltmere Shallows / Cinderfall Rift
      [18, 8], // Shattered Causeway
      [16, 8], // The Drowning Vale
      [14, 9], // Frostbound Hollow
    ];
    for (const [cols, rows] of shippedMapSizes) {
      expect(computeFittedTileSize(cols, rows, availableWidth, availableHeight, 64)).toBe(64);
    }
  });

  it("shrinks a map at the new, larger caps (32x14) below the 64px base", () => {
    const availableWidth = 1280;
    const availableHeight = 587;
    expect(computeFittedTileSize(32, 14, availableWidth, availableHeight, 64)).toBe(40);
  });
});
