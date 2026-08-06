import { describe, expect, it } from "vitest";
import {
  MAX_HERO_STARTS,
  MAX_MAP_COLS,
  MAX_MAP_ROWS,
  MIN_MAP_COLS,
  MIN_MAP_ROWS,
  createBlankDraft,
  paintTile,
  validateDraft,
} from "../src/game/systems/MapBuilderSystem";
import { TEST_MAP, encodeMapRows, parseMapRows } from "../src/game/data/testMap";

describe("MapBuilderSystem", () => {
  describe("createBlankDraft", () => {
    it("creates an all-floor map with no markers", () => {
      const draft = createBlankDraft("draft-1", "Untitled", 8, 7);
      expect(draft.cols).toBe(8);
      expect(draft.rows).toBe(7);
      expect(draft.tiles).toHaveLength(7);
      expect(draft.tiles.every((row) => row.length === 8 && row.every((t) => t === "floor"))).toBe(true);
      expect(draft.spawns).toEqual([]);
      expect(draft.exits).toEqual([]);
      expect(draft.heroStarts).toEqual([]);
    });
  });

  describe("paintTile", () => {
    it("paints a terrain tile and clears any prior role at that position", () => {
      let draft = createBlankDraft("d", "D", 6, 6);
      draft = paintTile(draft, { x: 2, y: 2 }, { kind: "marker", role: "spawn" });
      expect(draft.spawns).toEqual([{ x: 2, y: 2 }]);

      draft = paintTile(draft, { x: 2, y: 2 }, { kind: "terrain", tileType: "blocked" });
      expect(draft.tiles[2][2]).toBe("blocked");
      expect(draft.spawns).toEqual([]);
    });

    it("painting a marker forces the underlying tile to floor and clears other roles at that tile", () => {
      let draft = createBlankDraft("d", "D", 6, 6);
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "terrain", tileType: "water" });
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "exit" });
      expect(draft.tiles[1][1]).toBe("floor");
      expect(draft.exits).toEqual([{ x: 1, y: 1 }]);

      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "shop" });
      expect(draft.exits).toEqual([]);
      expect(draft.shops).toEqual([{ x: 1, y: 1 }]);
    });

    it("repeated marker paints on the same tile do not duplicate an entry", () => {
      let draft = createBlankDraft("d", "D", 6, 6);
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "hero-start" });
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "hero-start" });
      expect(draft.heroStarts).toEqual([{ x: 0, y: 0 }]);
    });

    it("returns the same reference (no-op) for an out-of-bounds position", () => {
      const draft = createBlankDraft("d", "D", 6, 6);
      const result = paintTile(draft, { x: 99, y: 99 }, { kind: "terrain", tileType: "blocked" });
      expect(result).toBe(draft);
    });
  });

  describe("validateDraft", () => {
    it("fails when narrower than MIN_MAP_COLS or wider than MAX_MAP_COLS", () => {
      const tooNarrow = createBlankDraft("d", "D", MIN_MAP_COLS - 1, MIN_MAP_ROWS);
      expect(validateDraft(tooNarrow).ok).toBe(false);
      const tooWide = createBlankDraft("d", "D", MAX_MAP_COLS + 1, MIN_MAP_ROWS);
      expect(validateDraft(tooWide).ok).toBe(false);
    });

    it("fails when shorter than MIN_MAP_ROWS or taller than MAX_MAP_ROWS", () => {
      const tooShort = createBlankDraft("d", "D", MIN_MAP_COLS, MIN_MAP_ROWS - 1);
      expect(validateDraft(tooShort).ok).toBe(false);
      const tooTall = createBlankDraft("d", "D", MIN_MAP_COLS, MAX_MAP_ROWS + 1);
      expect(validateDraft(tooTall).ok).toBe(false);
    });

    it("fails with zero spawns, zero exits, or too many hero-starts", () => {
      let draft = createBlankDraft("d", "D", 8, 8);
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "exit" });
      draft = paintTile(draft, { x: 1, y: 0 }, { kind: "marker", role: "hero-start" });
      let result = validateDraft(draft);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes("spawn"))).toBe(true);

      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "terrain", tileType: "floor" });
      draft = paintTile(draft, { x: 2, y: 0 }, { kind: "marker", role: "spawn" });
      result = validateDraft(draft);
      expect(result.ok).toBe(false); // now missing an exit again

      for (let i = 0; i < MAX_HERO_STARTS; i++) {
        draft = paintTile(draft, { x: i, y: 3 }, { kind: "marker", role: "hero-start" });
      }
      draft = paintTile(draft, { x: 0, y: 4 }, { kind: "marker", role: "hero-start" });
      draft = paintTile(draft, { x: 3, y: 0 }, { kind: "marker", role: "exit" });
      result = validateDraft(draft);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.includes("hero-start"))).toBe(true);
    });

    it("fails when a spawn has no route to any exit", () => {
      let draft = createBlankDraft("d", "D", 6, 6);
      // Wall off (0,0) completely, then put a spawn inside the box.
      draft = paintTile(draft, { x: 1, y: 0 }, { kind: "terrain", tileType: "blocked" });
      draft = paintTile(draft, { x: 0, y: 1 }, { kind: "terrain", tileType: "blocked" });
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "terrain", tileType: "blocked" });
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "spawn" });
      draft = paintTile(draft, { x: 5, y: 5 }, { kind: "marker", role: "exit" });
      draft = paintTile(draft, { x: 2, y: 2 }, { kind: "marker", role: "hero-start" });

      const result = validateDraft(draft);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((r) => r.toLowerCase().includes("route"))).toBe(true);
    });

    it("passes for a valid, small, fully-connected map", () => {
      let draft = createBlankDraft("d", "D", 6, 6);
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "spawn" });
      draft = paintTile(draft, { x: 5, y: 5 }, { kind: "marker", role: "exit" });
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "hero-start" });

      const result = validateDraft(draft);
      expect(result.ok).toBe(true);
      expect(result.reasons).toEqual([]);
    });
  });

  describe("encodeMapRows", () => {
    it("round-trips TEST_MAP through encode then parse", () => {
      const encoded = encodeMapRows(TEST_MAP);
      const reparsed = parseMapRows(TEST_MAP.id, TEST_MAP.name, encoded);
      expect(reparsed).toEqual(TEST_MAP);
    });

    it("round-trips a freshly-painted draft", () => {
      let draft = createBlankDraft("d", "Round Trip", 8, 6);
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "spawn" });
      draft = paintTile(draft, { x: 7, y: 5 }, { kind: "marker", role: "exit" });
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "hero-start" });
      draft = paintTile(draft, { x: 3, y: 3 }, { kind: "terrain", tileType: "water" });
      draft = paintTile(draft, { x: 4, y: 3 }, { kind: "marker", role: "shop" });
      draft = paintTile(draft, { x: 4, y: 4 }, { kind: "marker", role: "treasure" });
      draft = paintTile(draft, { x: 2, y: 2 }, { kind: "terrain", tileType: "blocked" });

      const encoded = encodeMapRows(draft);
      const reparsed = parseMapRows(draft.id, draft.name, encoded);
      expect(reparsed).toEqual(draft);
    });
  });
});
