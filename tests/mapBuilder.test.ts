import { describe, expect, it } from "vitest";
import {
  MAX_CUSTOM_WAVES,
  MAX_HERO_STARTS,
  MAX_MAP_COLS,
  MAX_MAP_ROWS,
  MAX_SPAWN_GROUPS_PER_WAVE,
  MIN_MAP_COLS,
  MIN_MAP_ROWS,
  addSpawnGroup,
  addWave,
  createBlankDraft,
  isValidMapName,
  paintTile,
  removeSpawnGroup,
  removeWave,
  updateSpawnGroup,
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

    describe("author-designed waves", () => {
      function validBaseDraft() {
        let draft = createBlankDraft("d", "D", 6, 6);
        draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "spawn" });
        draft = paintTile(draft, { x: 5, y: 5 }, { kind: "marker", role: "exit" });
        draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "hero-start" });
        return draft;
      }

      it("fails when a wave has no spawn groups", () => {
        const draft = addWave(validBaseDraft());
        const result = validateDraft(draft);
        expect(result.ok).toBe(false);
        expect(result.reasons.some((r) => r.includes("Wave 1") && r.includes("no enemies"))).toBe(true);
      });

      it("fails when a spawn group references an unknown enemy id", () => {
        let draft = addWave(validBaseDraft());
        draft = addSpawnGroup(draft, 0, "not-a-real-enemy-id");
        const result = validateDraft(draft);
        expect(result.ok).toBe(false);
        expect(result.reasons.some((r) => r.includes("unknown enemy"))).toBe(true);
      });

      it("fails when a spawn group's spawnIndex has no matching spawn tile", () => {
        let draft = addWave(validBaseDraft());
        draft = addSpawnGroup(draft, 0, "grunt");
        draft = updateSpawnGroup(draft, 0, 0, { spawnIndex: 3 }); // only 1 spawn tile exists
        const result = validateDraft(draft);
        expect(result.ok).toBe(false);
        expect(result.reasons.some((r) => r.includes("spawn point that no longer exists"))).toBe(true);
      });

      it("passes with a well-formed custom wave", () => {
        let draft = addWave(validBaseDraft());
        draft = addSpawnGroup(draft, 0, "grunt");
        const result = validateDraft(draft);
        expect(result.ok).toBe(true);
        expect(result.reasons).toEqual([]);
      });
    });
  });

  describe("author-designed wave editing", () => {
    function validBaseDraft() {
      let draft = createBlankDraft("d", "D", 6, 6);
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "spawn" });
      draft = paintTile(draft, { x: 5, y: 5 }, { kind: "marker", role: "exit" });
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "hero-start" });
      return draft;
    }

    it("addWave appends a blank wave and stops at MAX_CUSTOM_WAVES", () => {
      let draft = validBaseDraft();
      for (let i = 0; i < MAX_CUSTOM_WAVES; i++) draft = addWave(draft);
      expect(draft.customWaves).toHaveLength(MAX_CUSTOM_WAVES);
      expect(draft.customWaves?.every((w) => w.spawns.length === 0)).toBe(true);

      const atCap = addWave(draft);
      expect(atCap).toBe(draft); // no-op at the cap
    });

    it("removeWave removes the wave at the given index; out-of-range is a no-op", () => {
      let draft = addWave(addWave(validBaseDraft()));
      draft = removeWave(draft, 0);
      expect(draft.customWaves).toHaveLength(1);

      const result = removeWave(draft, 5);
      expect(result).toBe(draft);
    });

    it("addSpawnGroup appends a default group and stops at MAX_SPAWN_GROUPS_PER_WAVE", () => {
      let draft = addWave(validBaseDraft());
      for (let i = 0; i < MAX_SPAWN_GROUPS_PER_WAVE; i++) draft = addSpawnGroup(draft, 0, "grunt");
      expect(draft.customWaves?.[0].spawns).toHaveLength(MAX_SPAWN_GROUPS_PER_WAVE);
      expect(draft.customWaves?.[0].spawns[0]).toEqual({ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 });

      const atCap = addSpawnGroup(draft, 0, "grunt");
      expect(atCap).toBe(draft); // no-op at the cap

      const badWave = addSpawnGroup(draft, 9, "grunt");
      expect(badWave).toBe(draft); // no-op for an out-of-range wave index
    });

    it("removeSpawnGroup removes the group at the given index; out-of-range is a no-op", () => {
      let draft = addWave(validBaseDraft());
      draft = addSpawnGroup(draft, 0, "grunt");
      draft = addSpawnGroup(draft, 0, "runner");
      draft = removeSpawnGroup(draft, 0, 0);
      expect(draft.customWaves?.[0].spawns).toEqual([{ enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 }]);

      const result = removeSpawnGroup(draft, 0, 5);
      expect(result).toBe(draft);
    });

    it("updateSpawnGroup merges a patch into the targeted group only; out-of-range is a no-op", () => {
      let draft = addWave(validBaseDraft());
      draft = addSpawnGroup(draft, 0, "grunt");
      draft = addSpawnGroup(draft, 0, "runner");
      draft = updateSpawnGroup(draft, 0, 1, { count: 5, startTurn: 2 });
      expect(draft.customWaves?.[0].spawns).toEqual([
        { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
        { enemyId: "runner", count: 5, startTurn: 2, intervalTurns: 1, spawnIndex: 0 },
      ]);

      const result = updateSpawnGroup(draft, 0, 9, { count: 9 });
      expect(result).toBe(draft);
    });
  });

  describe("isValidMapName (D-154)", () => {
    it("rejects an empty or whitespace-only name", () => {
      expect(isValidMapName("")).toBe(false);
      expect(isValidMapName("   ")).toBe(false);
    });

    it("accepts a normal typed name, trimming surrounding whitespace", () => {
      expect(isValidMapName("Winding Pass")).toBe(true);
      expect(isValidMapName("  Winding Pass  ")).toBe(true);
    });

    it("rejects a name longer than 40 characters (trimmed)", () => {
      expect(isValidMapName("a".repeat(40))).toBe(true);
      expect(isValidMapName("a".repeat(41))).toBe(false);
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
