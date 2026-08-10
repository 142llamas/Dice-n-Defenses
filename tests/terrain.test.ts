import { describe, it, expect } from "vitest";
import { parseMapRows, encodeMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";

/**
 * Phase 11.7 (D-071) terrain tests: the new tile types (cliff/water/fire/acid)
 * and the shop/treasure roles. Pure, no Phaser — see gameMap.test.ts for the
 * Phase 1 conventions this follows.
 *
 * Legend under test: ^ cliff, ~ water, F fire, A acid, $ shop, T treasure.
 */

// row0: S.^~FA X   -> spawn, floor, cliff, water, fire, acid, floor, exit
// row1: .$T.....   -> shop, treasure, floor
const rows = ["S.^~FA..X", ".$T......"];
const parsed = parseMapRows("terrain-tiny", "Terrain Tiny", rows);
const map = new GameMap(parsed);

describe("parseMapRows: new terrain/shop/treasure characters", () => {
  it("parses cliff, water, fire, acid into their own tile types", () => {
    expect(parsed.tiles[0][2]).toBe("cliff");
    expect(parsed.tiles[0][3]).toBe("water");
    expect(parsed.tiles[0][4]).toBe("fire");
    expect(parsed.tiles[0][5]).toBe("acid");
  });

  it("parses shop and treasure tiles as floor underneath, recorded separately", () => {
    expect(parsed.tiles[1][1]).toBe("floor");
    expect(parsed.tiles[1][2]).toBe("floor");
    expect(parsed.shops).toEqual([{ x: 1, y: 1 }]);
    expect(parsed.treasures).toEqual([{ x: 2, y: 1 }]);
  });

  it("still throws on an unknown character", () => {
    expect(() => parseMapRows("bad", "Bad", ["?"])).toThrow();
  });
});

describe("GameMap.isWalkable with the new tile types", () => {
  it("treats water, fire, and acid as walkable", () => {
    expect(map.isWalkable({ x: 3, y: 0 })).toBe(true); // water
    expect(map.isWalkable({ x: 4, y: 0 })).toBe(true); // fire
    expect(map.isWalkable({ x: 5, y: 0 })).toBe(true); // acid
  });

  it("treats cliff as NOT walkable, same as blocked", () => {
    expect(map.isWalkable({ x: 2, y: 0 })).toBe(false); // cliff
    expect(map.isBlocked({ x: 2, y: 0 })).toBe(false); // cliff is not "blocked" itself...
    expect(map.getTileType({ x: 2, y: 0 })).toBe("cliff"); // ...it's its own type
  });

  it("still treats plain floor as walkable", () => {
    expect(map.isWalkable({ x: 1, y: 0 })).toBe(true);
  });
});

describe("GameMap.roleAt reports shop and treasure", () => {
  it("identifies the shop tile", () => {
    expect(map.roleAt({ x: 1, y: 1 })).toBe("shop");
  });

  it("identifies the treasure tile", () => {
    expect(map.roleAt({ x: 2, y: 1 })).toBe("treasure");
  });

  it("returns null for a plain floor tile", () => {
    expect(map.roleAt({ x: 4, y: 1 })).toBeNull();
  });
});

describe("Phase 23 (D-114): pit — parsing and GameMap", () => {
  const pitRows = ["S.@..X", "..@..."];
  const pitParsed = parseMapRows("pit-tiny", "Pit Tiny", pitRows);
  const pitMap = new GameMap(pitParsed);

  it("parses '@' as a pit tile", () => {
    expect(pitParsed.tiles[0][2]).toBe("pit");
    expect(pitParsed.tiles[1][2]).toBe("pit");
  });

  it("treats pit as NOT walkable, same as cliff/blocked", () => {
    expect(pitMap.isWalkable({ x: 2, y: 0 })).toBe(false);
    expect(pitMap.isBlocked({ x: 2, y: 0 })).toBe(false); // pit is not "blocked" itself, its own type
    expect(pitMap.getTileType({ x: 2, y: 0 })).toBe("pit");
  });

  it("isPit is true only for a pit tile", () => {
    expect(pitMap.isPit({ x: 2, y: 0 })).toBe(true);
    expect(pitMap.isPit({ x: 0, y: 0 })).toBe(false);
    expect(pitMap.isPit({ x: -1, y: 0 })).toBe(false);
  });

  it("terrainEffectAt returns null for a pit (its mechanic is push-resolution, not a standing effect)", () => {
    expect(pitMap.terrainEffectAt({ x: 2, y: 0 })).toBeNull();
  });

  it("describe() reports the pit hazard", () => {
    expect(pitMap.describe({ x: 2, y: 0 })).toMatch(/pit/);
  });

  it("encodeMapRows round-trips '@' for pit", () => {
    expect(encodeMapRows(pitParsed)).toEqual(pitRows);
  });
});

describe("Phase 23 (D-114): GameMap.setTiles mutates in place", () => {
  it("overwrites the live tile grid without replacing the ParsedMap object", () => {
    const parsed = parseMapRows("mutate-tiny", "Mutate Tiny", ["..", ".."]);
    const map = new GameMap(parsed);
    expect(map.getTileType({ x: 1, y: 0 })).toBe("floor");
    map.setTiles([
      ["floor", "water"],
      ["floor", "floor"],
    ]);
    expect(map.getTileType({ x: 1, y: 0 })).toBe("water");
    // the SAME ParsedMap object was mutated, not swapped for a new one —
    // this is what lets every other system holding this same GameMap
    // reference see the change (see GameMap.setTiles's doc comment).
    expect(map.data).toBe(parsed);
  });
});

describe("Phase 23 (D-114): GameMap.heroTerrainEffectAt", () => {
  const rows = ["S.~FA.X", "......."];

  it("returns null when the map does not opt in via hazardsAffectHeroes", () => {
    const parsed = parseMapRows("hero-terrain-off", "Hero Terrain Off", rows);
    const map = new GameMap(parsed);
    expect(map.heroTerrainEffectAt({ x: 2, y: 0 })).toBeNull(); // water
    expect(map.heroTerrainEffectAt({ x: 3, y: 0 })).toBeNull(); // fire
  });

  it("returns the same effect an enemy would suffer when opted in", () => {
    const parsed = parseMapRows("hero-terrain-on", "Hero Terrain On", rows, {
      hazardsAffectHeroes: true,
    });
    const map = new GameMap(parsed);
    expect(map.heroTerrainEffectAt({ x: 2, y: 0 })).toEqual(map.terrainEffectAt({ x: 2, y: 0 })); // water
    expect(map.heroTerrainEffectAt({ x: 3, y: 0 })).toEqual(map.terrainEffectAt({ x: 3, y: 0 })); // fire
    expect(map.heroTerrainEffectAt({ x: 4, y: 0 })).toEqual(map.terrainEffectAt({ x: 4, y: 0 })); // acid
  });

  it("still returns null for a tile with no terrain effect even when opted in", () => {
    const parsed = parseMapRows("hero-terrain-on2", "Hero Terrain On 2", rows, {
      hazardsAffectHeroes: true,
    });
    const map = new GameMap(parsed);
    expect(map.heroTerrainEffectAt({ x: 0, y: 0 })).toBeNull(); // spawn/floor
  });
});

describe("Phase 24 (D-115): sand — parsing and GameMap", () => {
  const sandRows = ["S.D..X", "..D..."];
  const sandParsed = parseMapRows("sand-tiny", "Sand Tiny", sandRows);
  const sandMap = new GameMap(sandParsed);

  it("parses 'D' as a sand tile", () => {
    expect(sandParsed.tiles[0][2]).toBe("sand");
    expect(sandParsed.tiles[1][2]).toBe("sand");
  });

  it("treats sand as WALKABLE, unlike cliff/pit/blocked", () => {
    expect(sandMap.isWalkable({ x: 2, y: 0 })).toBe(true);
  });

  it("treats sand as NOT buildable, unlike plain floor", () => {
    expect(sandMap.isBuildable({ x: 2, y: 0 })).toBe(false);
    expect(sandMap.isBuildable({ x: 1, y: 0 })).toBe(true); // plain floor
  });

  it("isBuildable is false off-map or on a hard blocker too, same as isWalkable", () => {
    expect(sandMap.isBuildable({ x: -1, y: 0 })).toBe(false);
  });

  it("terrainEffectAt returns null for sand (a build restriction, not a hazard)", () => {
    expect(sandMap.terrainEffectAt({ x: 2, y: 0 })).toBeNull();
  });

  it("describe() reports sand as walkable but not buildable", () => {
    expect(sandMap.describe({ x: 2, y: 0 })).toMatch(/sand/);
    expect(sandMap.describe({ x: 2, y: 0 })).toMatch(/not buildable/);
  });

  it("encodeMapRows round-trips 'D' for sand", () => {
    expect(encodeMapRows(sandParsed)).toEqual(sandRows);
  });
});

describe("GameMap.terrainEffectAt", () => {
  it("returns null for floor, blocked, cliff, shop, and treasure tiles", () => {
    expect(map.terrainEffectAt({ x: 1, y: 0 })).toBeNull(); // floor
    expect(map.terrainEffectAt({ x: 2, y: 0 })).toBeNull(); // cliff
    expect(map.terrainEffectAt({ x: 1, y: 1 })).toBeNull(); // shop (floor underneath)
    expect(map.terrainEffectAt({ x: 2, y: 1 })).toBeNull(); // treasure (floor underneath)
    expect(map.terrainEffectAt({ x: -1, y: 0 })).toBeNull(); // off-map
  });

  it("returns the burning status with no instant damage for fire", () => {
    const effect = map.terrainEffectAt({ x: 4, y: 0 });
    expect(effect).not.toBeNull();
    expect(effect?.profile).toBeNull();
    expect(effect?.targets).toBe("any");
    expect(effect?.status).toEqual({ statusId: "burning", durationTurns: 2 });
  });

  it("returns a flat ground-only damage profile with no status for acid", () => {
    const effect = map.terrainEffectAt({ x: 5, y: 0 });
    expect(effect).not.toBeNull();
    expect(effect?.profile).toEqual({ rangeTiles: 0, damage: 2, attackBonus: 0, autoHit: true });
    expect(effect?.targets).toBe("ground");
    expect(effect?.status).toBeNull();
  });

  it("returns a slow status with no instant damage, ground-only, for water", () => {
    const effect = map.terrainEffectAt({ x: 3, y: 0 });
    expect(effect).not.toBeNull();
    expect(effect?.profile).toBeNull();
    expect(effect?.targets).toBe("ground");
    expect(effect?.status).toEqual({ statusId: "slowed", durationTurns: 1 });
  });
});
