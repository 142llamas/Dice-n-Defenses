import { describe, it, expect } from "vitest";
import { CAUSEWAY_MAP } from "../src/game/data/causewayMap";
import { DROWNING_VALE_MAP } from "../src/game/data/drowningValeMap";
import { CINDERFALL_RIFT_MAP } from "../src/game/data/cinderfallRiftMap";
import { FROSTBOUND_HOLLOW_MAP } from "../src/game/data/frostboundHollowMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { DynamicTerrainSystem } from "../src/game/systems/DynamicTerrainSystem";
import type { ParsedMap } from "../src/game/data/testMap";

/**
 * Phase 23 (D-114): the four new maps. Basic parsing/role checks mirror
 * newMaps.test.ts's existing convention for Emberford/Saltmere; the
 * connectivity checks (every spawn can reach an exit) are the important new
 * part — these maps were hand-authored as row-strings, and a typo could
 * easily strand a spawn with no route out without ever throwing a parse
 * error, since `parseMapRows` only validates row width, not solvability.
 */

function everySpawnCanReachAnExit(map: ParsedMap): boolean {
  const gameMap = new GameMap(map);
  const pathfinding = new PathfindingSystem(gameMap);
  return map.spawns.every((spawn) => pathfinding.hasRoute({ start: spawn, goals: map.exits }));
}

describe("CAUSEWAY_MAP (chasm crossing, pit showcase)", () => {
  it("parses without throwing and reports its id/name", () => {
    expect(CAUSEWAY_MAP.id).toBe("causeway-01");
    expect(CAUSEWAY_MAP.name).toMatch(/Causeway/);
  });

  // D-228 (KI-177 item 1): resized 19x8 -> 34x18 for "at least 4x bigger
  // maps" — 2 spawns -> 4 (one per bridge-mouth row), 4 hero-starts
  // unchanged, still 2 exits (both at the bridge's east mouth).
  it("has 4 spawns, 2 exits, and 4 hero-starts", () => {
    expect(CAUSEWAY_MAP.spawns.length).toBe(4);
    expect(CAUSEWAY_MAP.exits.length).toBe(2);
    expect(CAUSEWAY_MAP.heroStarts.length).toBe(4);
  });

  it("includes a pit and opts in to hazardsAffectHeroes", () => {
    expect(CAUSEWAY_MAP.tiles.flat()).toContain("pit");
    expect(CAUSEWAY_MAP.hazardsAffectHeroes).toBe(true);
  });

  it("every spawn can reach an exit (the bridge is a real crossing, not an accidental dead end)", () => {
    expect(everySpawnCanReachAnExit(CAUSEWAY_MAP)).toBe(true);
  });

  it("Phase 24 (D-115): includes sand, walkable but unbuildable, without breaking connectivity", () => {
    expect(CAUSEWAY_MAP.tiles.flat()).toContain("sand");
    const gameMap = new GameMap(CAUSEWAY_MAP);
    expect(gameMap.isWalkable({ x: 21, y: 0 })).toBe(true);
    expect(gameMap.isBuildable({ x: 21, y: 0 })).toBe(false);
    expect(everySpawnCanReachAnExit(CAUSEWAY_MAP)).toBe(true);
  });
});

describe("DROWNING_VALE_MAP (tidal marsh, cyclical dynamic terrain)", () => {
  it("parses without throwing and reports its id/name", () => {
    expect(DROWNING_VALE_MAP.id).toBe("drowning-vale-01");
    expect(DROWNING_VALE_MAP.name).toMatch(/Drowning Vale/);
  });

  // D-228 (KI-177 item 1): resized 16x8 -> 32x16 (exact 2x2 tile doubling)
  // for "at least 4x bigger maps," plus 2 extra spawns at different
  // heights — see that file's own doc comment for the exact counts this
  // doubling produces.
  it("has 10 spawns, 8 exits, 16 hero-starts, a shop, and a treasure", () => {
    expect(DROWNING_VALE_MAP.spawns.length).toBe(10);
    expect(DROWNING_VALE_MAP.exits.length).toBe(8);
    expect(DROWNING_VALE_MAP.heroStarts.length).toBe(16);
    expect(DROWNING_VALE_MAP.shops.length).toBeGreaterThanOrEqual(1);
    expect(DROWNING_VALE_MAP.treasures.length).toBeGreaterThanOrEqual(1);
  });

  it("declares a rising-tide event and a receding event, in that order", () => {
    const events = DROWNING_VALE_MAP.dynamicTerrainEvents;
    expect(events).toBeDefined();
    expect(events![0].atWave).toBe(3);
    expect(events![0].toTileType).toBe("water");
    expect(events![1].atWave).toBe(6);
    expect(events![1].toTileType).toBe("floor");
  });

  it("stays fully connected before, during, and after the tide cycle", () => {
    expect(everySpawnCanReachAnExit(DROWNING_VALE_MAP)).toBe(true);
    const flooded = DynamicTerrainSystem.applyEvent(DROWNING_VALE_MAP, DROWNING_VALE_MAP.dynamicTerrainEvents![0]);
    expect(everySpawnCanReachAnExit(flooded)).toBe(true);
    const receded = DynamicTerrainSystem.applyEvent(flooded, DROWNING_VALE_MAP.dynamicTerrainEvents![1]);
    expect(everySpawnCanReachAnExit(receded)).toBe(true);
  });

  it("Phase 24 (D-115): includes sand bordering the water fringe, walkable but unbuildable", () => {
    expect(DROWNING_VALE_MAP.tiles.flat()).toContain("sand");
    const gameMap = new GameMap(DROWNING_VALE_MAP);
    expect(gameMap.isWalkable({ x: 10, y: 0 })).toBe(true);
    expect(gameMap.isBuildable({ x: 10, y: 0 })).toBe(false);
  });
});

describe("CINDERFALL_RIFT_MAP (volcanic, one-way bridge collapse)", () => {
  it("parses without throwing and reports its id/name", () => {
    expect(CINDERFALL_RIFT_MAP.id).toBe("cinderfall-rift-01");
    expect(CINDERFALL_RIFT_MAP.name).toMatch(/Cinderfall/);
  });

  // D-228 (KI-177 item 1): resized 16x9 -> 32x18 (exact 2x2 tile doubling)
  // for "at least 4x bigger maps," plus 2 extra spawns (north/south lanes)
  // — see that file's own doc comment for the exact counts this produces.
  it("has 6 spawns, 4 exits, 16 hero-starts, cliffs, and fire", () => {
    expect(CINDERFALL_RIFT_MAP.spawns.length).toBe(6);
    expect(CINDERFALL_RIFT_MAP.exits.length).toBe(4);
    expect(CINDERFALL_RIFT_MAP.heroStarts.length).toBe(16);
    expect(CINDERFALL_RIFT_MAP.tiles.flat()).toContain("cliff");
    expect(CINDERFALL_RIFT_MAP.tiles.flat()).toContain("fire");
  });

  it("declares exactly one collapse event, turning bridge tiles to pit", () => {
    const events = CINDERFALL_RIFT_MAP.dynamicTerrainEvents;
    expect(events).toHaveLength(1);
    expect(events![0].toTileType).toBe("pit");
    expect(events![0].positions.length).toBeGreaterThan(0);
  });

  it("is connected via the direct bridge BEFORE the collapse", () => {
    expect(everySpawnCanReachAnExit(CINDERFALL_RIFT_MAP)).toBe(true);
  });

  it("stays connected via the longer north/south paths AFTER the collapse", () => {
    const collapsed = DynamicTerrainSystem.applyEvent(CINDERFALL_RIFT_MAP, CINDERFALL_RIFT_MAP.dynamicTerrainEvents![0]);
    expect(everySpawnCanReachAnExit(collapsed)).toBe(true);
    // the collapsed span itself is now a real pit, not still floor
    const collapsedMap = new GameMap(collapsed);
    for (const pos of CINDERFALL_RIFT_MAP.dynamicTerrainEvents![0].positions) {
      expect(collapsedMap.isPit(pos)).toBe(true);
    }
  });

  it("Phase 24 (D-115): includes ash-sand at the connector mouths, walkable but unbuildable", () => {
    expect(CINDERFALL_RIFT_MAP.tiles.flat()).toContain("sand");
    const gameMap = new GameMap(CINDERFALL_RIFT_MAP);
    expect(gameMap.isWalkable({ x: 0, y: 2 })).toBe(true);
    expect(gameMap.isBuildable({ x: 0, y: 2 })).toBe(false);
    expect(everySpawnCanReachAnExit(CINDERFALL_RIFT_MAP)).toBe(true);
  });
});

describe("FROSTBOUND_HOLLOW_MAP (verticality, static — no dynamic terrain)", () => {
  it("parses without throwing and reports its id/name", () => {
    expect(FROSTBOUND_HOLLOW_MAP.id).toBe("frostbound-hollow-01");
    expect(FROSTBOUND_HOLLOW_MAP.name).toMatch(/Frostbound Hollow/);
  });

  // D-228 (KI-177 item 1): resized 14x9 -> 28x18 (exact 2x2 tile doubling)
  // for "at least 4x bigger maps," plus 2 extra spawns (upper/lower ground
  // lanes) — see that file's own doc comment for the exact counts.
  it("has 6 spawns, 4 exits, 16 hero-starts, cliffs, and water, but no dynamic events", () => {
    expect(FROSTBOUND_HOLLOW_MAP.spawns.length).toBe(6);
    expect(FROSTBOUND_HOLLOW_MAP.exits.length).toBe(4);
    expect(FROSTBOUND_HOLLOW_MAP.heroStarts.length).toBe(16);
    expect(FROSTBOUND_HOLLOW_MAP.tiles.flat()).toContain("cliff");
    expect(FROSTBOUND_HOLLOW_MAP.tiles.flat()).toContain("water");
    expect(FROSTBOUND_HOLLOW_MAP.dynamicTerrainEvents).toBeUndefined();
  });

  it("ground routes only via the top/bottom rows around the central ridge, and every spawn can still reach an exit", () => {
    expect(everySpawnCanReachAnExit(FROSTBOUND_HOLLOW_MAP)).toBe(true);
    // the ridge really is a ground barrier in the middle rows, not decorative
    const map = new GameMap(FROSTBOUND_HOLLOW_MAP);
    expect(map.isWalkable({ x: 12, y: 8 })).toBe(false);
    expect(map.isWalkable({ x: 13, y: 8 })).toBe(false);
  });
});
