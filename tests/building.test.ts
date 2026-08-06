import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import {
  BuildSystem,
  BUILD_RANGE_TILES,
  MAX_STRUCTURES_PER_HERO,
} from "../src/game/systems/BuildSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { RewardSystem } from "../src/game/systems/RewardSystem";
import type { WaveDefinition } from "../src/game/data/waves";
import type { GridPosition } from "../src/game/systems/GridSystem";

/**
 * Phase 5 building/trap tests. These back the acceptance criteria "illegal path
 * blocking is rejected" and "traps trigger correctly", plus the general
 * placement rules (build only on empty floor, not on spawns/exits/units, and
 * not on top of another structure) and refund/removal.
 */

function buildOn(rows: string[]): { build: BuildSystem; map: GameMap; pf: PathfindingSystem } {
  const map = new GameMap(parseMapRows("m", "m", rows));
  const pf = new PathfindingSystem(map);
  return { build: new BuildSystem(map, pf), map, pf };
}

describe("BuildSystem placement rules", () => {
  it("places a wall on open floor", () => {
    // Two rows, so a wall at (1,0) still leaves a route along the bottom.
    const { build } = buildOn(["S.X", "..."]);
    const r = build.place("barricade", { x: 1, y: 0 });
    expect(r.ok).toBe(true);
    expect(build.isWallAt({ x: 1, y: 0 })).toBe(true);
    expect(build.structures).toHaveLength(1);
  });

  it("refuses to build on a wall tile, a spawn, or an exit", () => {
    const { build } = buildOn(["S#X", "..."]);
    expect(build.canPlace("barricade", { x: 1, y: 0 }).ok).toBe(false); // map wall
    expect(build.canPlace("barricade", { x: 0, y: 0 }).ok).toBe(false); // spawn
    expect(build.canPlace("barricade", { x: 2, y: 0 }).ok).toBe(false); // exit
  });

  it("refuses to build on a tile a unit stands on", () => {
    const { build } = buildOn(["S.X", "..."]);
    const occupied: GridPosition = { x: 1, y: 1 };
    const isOccupied = (p: GridPosition) => p.x === occupied.x && p.y === occupied.y;
    expect(build.canPlace("barricade", occupied, isOccupied).ok).toBe(false);
    expect(build.canPlace("barricade", { x: 1, y: 0 }, isOccupied).ok).toBe(true);
  });

  it("refuses to stack two structures on one tile", () => {
    const { build } = buildOn(["S.X", "..."]);
    expect(build.place("spike-trap", { x: 1, y: 1 }).ok).toBe(true);
    expect(build.canPlace("barricade", { x: 1, y: 1 }).ok).toBe(false);
  });
});

describe("BuildSystem path-block rejection (acceptance)", () => {
  it("rejects a wall that would seal the only route from spawn to exit", () => {
    // A one-wide corridor: the wall at (1,0) is the only path.
    const { build } = buildOn(["S.X"]);
    const check = build.canPlace("barricade", { x: 1, y: 0 });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/path/i);
    // And place() must refuse it too, leaving nothing built.
    expect(build.place("barricade", { x: 1, y: 0 }).ok).toBe(false);
    expect(build.structures).toHaveLength(0);
  });

  it("allows the same tile for a TRAP, since traps do not block", () => {
    const { build } = buildOn(["S.X"]);
    expect(build.place("spike-trap", { x: 1, y: 0 }).ok).toBe(true);
    expect(build.isWallAt({ x: 1, y: 0 })).toBe(false);
    expect(build.trapAt({ x: 1, y: 0 })).not.toBeNull();
  });

  it("rejects the wall that closes the LAST remaining route, not earlier ones", () => {
    // One spawn, one exit, a central map wall forcing a path down the left OR
    // right column â€” two genuinely disjoint routes.
    //   . S .
    //   . # .
    //   . X .
    const { build } = buildOn([".S.", ".#.", ".X."]);
    // Closing the left route (0,1) is fine â€” the right route remains.
    expect(build.place("barricade", { x: 0, y: 1 }).ok).toBe(true);
    // Now closing the right route (2,1) would seal the last path -> rejected.
    expect(build.canPlace("barricade", { x: 2, y: 1 }).ok).toBe(false);
  });
});

describe("BuildSystem removal and refund support", () => {
  it("removes a structure once and frees its tile", () => {
    const { build } = buildOn(["S.X", "..."]);
    const placed = build.place("barricade", { x: 1, y: 0 }).structure!;
    const removed = build.remove(placed.instanceId);
    expect(removed?.instanceId).toBe(placed.instanceId);
    expect(build.structures).toHaveLength(0);
    expect(build.isWallAt({ x: 1, y: 0 })).toBe(false);
    // Removing again does nothing.
    expect(build.remove(placed.instanceId)).toBeNull();
    // The tile is buildable again.
    expect(build.canPlace("barricade", { x: 1, y: 0 }).ok).toBe(true);
  });

  it("exposes a trap's attack profile and clears it on removal", () => {
    const { build } = buildOn(["S.X", "..."]);
    build.place("spike-trap", { x: 1, y: 1 });
    const profile = build.trapProfileAt({ x: 1, y: 1 });
    expect(profile?.damage).toBe(3);
    build.removeAt({ x: 1, y: 1 });
    expect(build.trapProfileAt({ x: 1, y: 1 })).toBeNull();
  });
});

// ----- Traps triggering through the enemy phase (acceptance) -------------

function laneWave(enemyId: string): WaveDefinition {
  return {
    id: "w",
    spawns: [{ enemyId, count: 1, startTurn: 1, intervalTurns: 1 }],
    completionGold: 0,
  };
}

describe("Traps trigger correctly during the enemy phase", () => {
  it("damages an enemy that steps onto the trap tile, without blocking it", () => {
    // Lane S....X: spawn (0,0), exit (5,0). A grunt moves 2 tiles/phase.
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("spike-trap", { x: 2, y: 0 }); // grunt reaches (2,0) on phase 1

    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase({ trapAt: (p) => build.trapProfileAt(p) });

    // Grunt (6 HP) took the trap's full 3 damage (traps always auto-hit, D-086) and kept moving.
    expect(t1.trapTriggers).toHaveLength(1);
    expect(t1.trapTriggers[0].result.damageDealt).toBe(3);
    expect(t1.trapTriggers[0].position).toEqual({ x: 2, y: 0 });
    expect(t1.spawned[0].health).toBe(3);
    expect(t1.spawned[0].position).toEqual({ x: 2, y: 0 }); // passed onto the trap, still advancing
  });

  it("can defeat an enemy, which then does not breach", () => {
    // A runner has 3 HP and 0 defense, so a 3-damage trap defeats it outright.
    const map = new GameMap(parseMapRows("lane", "lane", ["S...X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("spike-trap", { x: 1, y: 0 }); // first tile the runner enters

    const ws = new WaveSystem(map, pf, [laneWave("runner")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase({ trapAt: (p) => build.trapProfileAt(p) });

    expect(t1.trapTriggers[0].result.defeated).toBe(true);
    expect(t1.breaches).toHaveLength(0); // died on the trap, never reached the exit
    expect(ws.integrity).toBe(20); // no breach damage
    // The slain enemy is removed once and yields its reward gold.
    const removed = ws.removeDefeated();
    expect(removed).toHaveLength(1);
    expect(RewardSystem.killGold(removed)).toBe(2); // runner rewardGold
  });

  it("does nothing when there are no traps (Phase 3/4 behaviour unchanged)", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S...X"]));
    const pf = new PathfindingSystem(map);
    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase(); // no context at all
    expect(t1.trapTriggers).toEqual([]);
  });
});

// ----- Phase 11.7 (D-071): proximity-gated building --------------------

describe("BuildSystem proximity gating (BUILD_RANGE_TILES)", () => {
  // Uses "spike-trap" (not "barricade") throughout: this is a single-wide
  // lane, so a WALL anywhere would always fail the separate "seals the only
  // route" check regardless of proximity â€” a trap isolates the proximity
  // rule under test, exactly like the existing "traps do not block" tests.
  it("rejects a placement with no hero within range when hero positions are supplied", () => {
    const { build } = buildOn(["S..........X"]);
    const farHero: GridPosition = { x: 0, y: 0 };
    const tile: GridPosition = { x: 10, y: 0 }; // Manhattan distance 10, way out of range
    const check = build.canPlace("spike-trap", tile, undefined, [farHero]);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/close enough/i);
    expect(build.place("spike-trap", tile, undefined, [farHero]).ok).toBe(false);
  });

  it("allows a placement within BUILD_RANGE_TILES of at least one hero", () => {
    const { build } = buildOn(["S..........X"]);
    const nearHero: GridPosition = { x: 5, y: 0 };
    const tile: GridPosition = { x: 5 + BUILD_RANGE_TILES, y: 0 }; // exactly at the edge of range
    expect(build.canPlace("spike-trap", tile, undefined, [nearHero]).ok).toBe(true);
  });

  it("does not enforce range when heroPositions is omitted (backward compatible)", () => {
    const { build } = buildOn(["S..........X"]);
    // Far from any conceivable hero position, but no heroPositions passed at all.
    expect(build.canPlace("spike-trap", { x: 10, y: 0 }).ok).toBe(true);
  });

  it("does not enforce range when heroPositions is an empty array", () => {
    const { build } = buildOn(["S..........X"]);
    expect(build.canPlace("spike-trap", { x: 10, y: 0 }, undefined, []).ok).toBe(true);
  });
});

describe("BuildSystem per-hero structure carry limit (MAX_STRUCTURES_PER_HERO)", () => {
  it("allows up to MAX_STRUCTURES_PER_HERO structures for one hero, rejects the next", () => {
    const { build } = buildOn(["S..........X"]);
    const tiles: GridPosition[] = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }];
    expect(MAX_STRUCTURES_PER_HERO).toBe(3);
    for (let i = 0; i < MAX_STRUCTURES_PER_HERO; i++) {
      const r = build.place("spike-trap", tiles[i], undefined, undefined, "hero-a");
      expect(r.ok).toBe(true);
    }
    // A fourth, still attributed to hero-a, is rejected purely on the count.
    const rejected = build.canPlace("spike-trap", tiles[3], undefined, undefined, "hero-a");
    expect(rejected.ok).toBe(false);
    expect(rejected.reason).toMatch(/limit/i);
  });

  it("frees a slot back up when a structure is removed", () => {
    const { build } = buildOn(["S..........X"]);
    const a = build.place("spike-trap", { x: 1, y: 0 }, undefined, undefined, "hero-a").structure!;
    build.place("spike-trap", { x: 2, y: 0 }, undefined, undefined, "hero-a");
    build.place("spike-trap", { x: 3, y: 0 }, undefined, undefined, "hero-a");
    expect(build.canPlace("spike-trap", { x: 4, y: 0 }, undefined, undefined, "hero-a").ok).toBe(false);
    build.remove(a.instanceId);
    expect(build.canPlace("spike-trap", { x: 4, y: 0 }, undefined, undefined, "hero-a").ok).toBe(true);
  });

  it("tracks each hero id's count independently", () => {
    const { build } = buildOn(["S..........X"]);
    build.place("spike-trap", { x: 1, y: 0 }, undefined, undefined, "hero-a");
    build.place("spike-trap", { x: 2, y: 0 }, undefined, undefined, "hero-a");
    build.place("spike-trap", { x: 3, y: 0 }, undefined, undefined, "hero-a");
    // hero-a is capped, but hero-b (a different id) is unaffected.
    expect(build.canPlace("spike-trap", { x: 4, y: 0 }, undefined, undefined, "hero-b").ok).toBe(true);
  });

  it("does not enforce the cap when builtBy is omitted (backward compatible)", () => {
    const { build } = buildOn(["S..........X"]);
    for (const x of [1, 2, 3, 4]) {
      expect(build.place("spike-trap", { x, y: 0 }).ok).toBe(true);
    }
  });
});

// ----- Phase 20 (D-111): destructible walls (siege) -----------------------

describe("BuildSystem.damageStructure (siege)", () => {
  it("reduces a wall's HP without removing it while HP remains", () => {
    const { build } = buildOn(["S.X", "..."]);
    const placed = build.place("barricade", { x: 1, y: 0 }).structure!;
    expect(placed.hp).toBe(10);
    const result = build.damageStructure(placed.instanceId, 4);
    expect(result.destroyed).toBe(false);
    expect(build.wallAt({ x: 1, y: 0 })?.hp).toBe(6);
    expect(build.structures).toHaveLength(1);
  });

  it("removes the structure once its HP reaches 0", () => {
    const { build } = buildOn(["S.X", "..."]);
    const placed = build.place("barricade", { x: 1, y: 0 }).structure!;
    const result = build.damageStructure(placed.instanceId, 10);
    expect(result.destroyed).toBe(true);
    expect(build.isWallAt({ x: 1, y: 0 })).toBe(false);
    expect(build.structures).toHaveLength(0);
  });

  it("clamps HP at 0 rather than going negative, and destroys on overkill", () => {
    const { build } = buildOn(["S.X", "..."]);
    const placed = build.place("barricade", { x: 1, y: 0 }).structure!;
    const result = build.damageStructure(placed.instanceId, 999);
    expect(result.destroyed).toBe(true);
    expect(build.structures).toHaveLength(0);
  });

  it("has no effect on an indestructible structure (no maxHp) — traps take the call but never break", () => {
    const { build } = buildOn(["S.X", "..."]);
    const placed = build.place("spike-trap", { x: 1, y: 1 }).structure!;
    expect(placed.hp).toBeUndefined();
    const result = build.damageStructure(placed.instanceId, 999);
    expect(result.destroyed).toBe(false);
    expect(build.structures).toHaveLength(1);
  });

  it("does nothing for an unknown instance id", () => {
    const { build } = buildOn(["S.X", "..."]);
    const result = build.damageStructure("nope#1", 5);
    expect(result.destroyed).toBe(false);
    expect(result.structure).toBeNull();
  });
});

describe("Walls reroute enemies (route manipulation)", () => {
  it("forces an enemy to detour around a placed wall", () => {
    //  S . . X   <- straight lane on row 0
    //  . . . .   <- detour available on row 1
    const map = new GameMap(parseMapRows("m", "m", ["S..X", "...."]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    // A wall directly in front of the spawn: the enemy must go around it.
    expect(build.place("barricade", { x: 1, y: 0 }).ok).toBe(true);

    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase({ isBlocked: (p) => build.isWallAt(p) });

    // Instead of walking straight to (2,0), the grunt detoured onto row 1 and
    // never stepped on the wall tile.
    const enemy = t1.spawned[0];
    expect(enemy.position.y).toBe(1);
    for (const step of t1.moves[0].path) {
      expect(build.isWallAt(step)).toBe(false);
    }
  });
});
