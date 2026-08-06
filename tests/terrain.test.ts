import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
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
