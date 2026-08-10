import { describe, it, expect } from "vitest";
import { parseMapRows, type DynamicTerrainEvent } from "../src/game/data/testMap";
import { DynamicTerrainSystem } from "../src/game/systems/DynamicTerrainSystem";

/**
 * Phase 23 (D-114): DynamicTerrainSystem — mid-battle terrain changes keyed
 * to a wave number (a rising tide, a collapsing bridge). Pure, no Phaser.
 */

const FLOOD: DynamicTerrainEvent = {
  label: "The tide rises",
  atWave: 3,
  warnWavesBefore: 2,
  positions: [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ],
  toTileType: "water",
};

const COLLAPSE: DynamicTerrainEvent = {
  label: "The bridge collapses",
  atWave: 4,
  // warnWavesBefore omitted -> defaults to 1
  positions: [{ x: 0, y: 1 }],
  toTileType: "pit",
};

describe("DynamicTerrainSystem.warningStartWave", () => {
  it("subtracts warnWavesBefore from atWave", () => {
    expect(DynamicTerrainSystem.warningStartWave(FLOOD)).toBe(1);
  });

  it("defaults warnWavesBefore to 1 when omitted", () => {
    expect(DynamicTerrainSystem.warningStartWave(COLLAPSE)).toBe(3);
  });
});

describe("DynamicTerrainSystem.dueEvents", () => {
  it("returns an event exactly at its atWave, with its index", () => {
    const due = DynamicTerrainSystem.dueEvents([FLOOD, COLLAPSE], 3, new Set());
    expect(due).toEqual([{ index: 0, event: FLOOD }]);
  });

  it("returns nothing on a wave with no due event", () => {
    expect(DynamicTerrainSystem.dueEvents([FLOOD, COLLAPSE], 1, new Set())).toEqual([]);
  });

  it("excludes an event whose index is already fired", () => {
    expect(DynamicTerrainSystem.dueEvents([FLOOD, COLLAPSE], 3, new Set([0]))).toEqual([]);
  });

  it("can return more than one event due on the same wave", () => {
    const sameWave: DynamicTerrainEvent = { ...COLLAPSE, atWave: 3 };
    const due = DynamicTerrainSystem.dueEvents([FLOOD, sameWave], 3, new Set());
    expect(due.map((d) => d.index)).toEqual([0, 1]);
  });
});

describe("DynamicTerrainSystem.newWarningsAt", () => {
  it("fires exactly at the warning-start wave, not before or after", () => {
    expect(DynamicTerrainSystem.newWarningsAt([FLOOD], 0, new Set())).toEqual([]);
    expect(DynamicTerrainSystem.newWarningsAt([FLOOD], 1, new Set())).toEqual([{ index: 0, event: FLOOD }]);
    expect(DynamicTerrainSystem.newWarningsAt([FLOOD], 2, new Set())).toEqual([]);
  });

  it("does not warn again once the event has already fired", () => {
    expect(DynamicTerrainSystem.newWarningsAt([FLOOD], 1, new Set([0]))).toEqual([]);
  });
});

describe("DynamicTerrainSystem.applyEvent", () => {
  it("returns a NEW ParsedMap with the event's positions changed, without mutating the input", () => {
    const map = parseMapRows("dyn-tiny", "Dyn Tiny", ["...", "..."]);
    const originalTiles = map.tiles;
    const next = DynamicTerrainSystem.applyEvent(map, FLOOD);

    expect(next.tiles[0][1]).toBe("water");
    expect(next.tiles[0][2]).toBe("water");
    expect(next.tiles[0][0]).toBe("floor"); // untouched position
    // the input map is completely unchanged (pure function)
    expect(map.tiles).toBe(originalTiles);
    expect(map.tiles[0][1]).toBe("floor");
  });

  it("silently ignores an out-of-bounds position", () => {
    const map = parseMapRows("dyn-tiny2", "Dyn Tiny 2", ["..", ".."]);
    const outOfBounds: DynamicTerrainEvent = {
      label: "off-map",
      atWave: 1,
      positions: [{ x: 99, y: 99 }],
      toTileType: "water",
    };
    expect(() => DynamicTerrainSystem.applyEvent(map, outOfBounds)).not.toThrow();
  });

  it("can convert floor to pit (the one-way bridge-collapse case)", () => {
    const map = parseMapRows("dyn-tiny3", "Dyn Tiny 3", ["...", "..."]);
    const next = DynamicTerrainSystem.applyEvent(map, COLLAPSE);
    expect(next.tiles[1][0]).toBe("pit");
  });
});
