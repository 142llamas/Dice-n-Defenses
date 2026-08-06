import { describe, it, expect } from "vitest";
import { EMBERFORD_MAP } from "../src/game/data/emberfordMap";
import { SALTMERE_MAP } from "../src/game/data/saltmereMap";
import { GameMap } from "../src/game/systems/GameMap";

/**
 * Phase 11.7 (D-071): the two new terrain-showcase maps. Additive data only —
 * neither is wired into any scene (that's Phase 11.8). These tests just
 * confirm each parses without throwing and has the expected role counts, the
 * same way gameMap.test.ts checks TEST_MAP's parsing.
 */

describe("EMBERFORD_MAP (volcanic: cliff + fire + acid)", () => {
  it("parses without throwing and reports its id/name", () => {
    expect(EMBERFORD_MAP.id).toBe("emberford-01");
    expect(EMBERFORD_MAP.name).toMatch(/Emberford/);
  });

  it("has at least 2 spawns and 2 exits", () => {
    expect(EMBERFORD_MAP.spawns.length).toBeGreaterThanOrEqual(2);
    expect(EMBERFORD_MAP.exits.length).toBeGreaterThanOrEqual(2);
  });

  it("has at least one shop tile and one treasure tile", () => {
    expect(EMBERFORD_MAP.shops.length).toBeGreaterThanOrEqual(1);
    expect(EMBERFORD_MAP.treasures.length).toBeGreaterThanOrEqual(1);
  });

  // Phase 11.8 (D-071): this map is now wired into a real campaign, so it
  // needs one hero-start tile per max party slot, same as TEST_MAP's four —
  // BattleScene.buildHeroes falls back to starts[0] with no starts at all,
  // which would place every hero on an undefined tile.
  it("has at least 4 hero-start tiles (Phase 11.8: wired into a real campaign)", () => {
    expect(EMBERFORD_MAP.heroStarts.length).toBeGreaterThanOrEqual(4);
  });

  it("includes cliff, fire, and acid tiles, but no water", () => {
    const flat = EMBERFORD_MAP.tiles.flat();
    expect(flat).toContain("cliff");
    expect(flat).toContain("fire");
    expect(flat).toContain("acid");
    expect(flat).not.toContain("water");
  });

  it("reports the shop and treasure roles via GameMap", () => {
    const map = new GameMap(EMBERFORD_MAP);
    for (const shop of EMBERFORD_MAP.shops) {
      expect(map.roleAt(shop)).toBe("shop");
    }
    for (const treasure of EMBERFORD_MAP.treasures) {
      expect(map.roleAt(treasure)).toBe("treasure");
    }
  });
});

describe("SALTMERE_MAP (tidal: cliff + water)", () => {
  it("parses without throwing and reports its id/name", () => {
    expect(SALTMERE_MAP.id).toBe("saltmere-01");
    expect(SALTMERE_MAP.name).toMatch(/Saltmere/);
  });

  it("has at least 2 spawns and 2 exits", () => {
    expect(SALTMERE_MAP.spawns.length).toBeGreaterThanOrEqual(2);
    expect(SALTMERE_MAP.exits.length).toBeGreaterThanOrEqual(2);
  });

  it("has at least one shop tile and one treasure tile", () => {
    expect(SALTMERE_MAP.shops.length).toBeGreaterThanOrEqual(1);
    expect(SALTMERE_MAP.treasures.length).toBeGreaterThanOrEqual(1);
  });

  // Phase 11.8 (D-071): same rationale as EMBERFORD_MAP's equivalent test above.
  it("has at least 4 hero-start tiles (Phase 11.8: wired into a real campaign)", () => {
    expect(SALTMERE_MAP.heroStarts.length).toBeGreaterThanOrEqual(4);
  });

  it("includes cliff and water tiles, but no fire or acid (the other elemental flavor)", () => {
    const flat = SALTMERE_MAP.tiles.flat();
    expect(flat).toContain("cliff");
    expect(flat).toContain("water");
    expect(flat).not.toContain("fire");
    expect(flat).not.toContain("acid");
  });

  it("reports the shop and treasure roles via GameMap", () => {
    const map = new GameMap(SALTMERE_MAP);
    for (const shop of SALTMERE_MAP.shops) {
      expect(map.roleAt(shop)).toBe("shop");
    }
    for (const treasure of SALTMERE_MAP.treasures) {
      expect(map.roleAt(treasure)).toBe("treasure");
    }
  });
});
