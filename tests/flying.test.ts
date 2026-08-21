import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { BuildSystem } from "../src/game/systems/BuildSystem";
import type { WaveDefinition } from "../src/game/data/waves";
import type { GridPosition } from "../src/game/systems/GridSystem";

/**
 * Phase 7 (DECISIONS D-048): flying enemies.
 *
 * A flyer routes over walls â€” both STATIC map walls and PLACED barricades â€”
 * straight toward the exit, so construction can't re-route it the way it can a
 * ground enemy. It is still confined to the map and is still stopped by units
 * (heroes and other enemies never share its tile). These tests pin all of that
 * down at the pure-systems level, and prove ground routing is unchanged.
 */

const at = (p: GridPosition, x: number, y: number) => p.x === x && p.y === y;

function wave(enemyId: string, count = 1): WaveDefinition {
  return {
    id: `w-${enemyId}`,
    spawns: [{ enemyId, count, startTurn: 1, intervalTurns: 1 }],
    completionGold: 0,
  };
}

describe("PathfindingSystem ignoreWalls (flying)", () => {
  it("a flyer crosses a static map wall that seals a ground unit out", () => {
    // S#X â€” a single wall fully separates start and exit on a one-row lane.
    const map = new GameMap(parseMapRows("sealed", "Sealed", ["S#X"]));
    const pf = new PathfindingSystem(map);
    const start = { x: 0, y: 0 };
    const goals = map.data.exits;

    // Ground routing (default) cannot get through.
    expect(pf.routeToNearestGoal({ start, goals })).toBeNull();

    // Flying routing flies straight over the wall to the exit.
    const route = pf.routeToNearestGoal({ start, goals, ignoreWalls: true });
    expect(route).not.toBeNull();
    // D-141: route tiles now also carry `distanceFeet`, so match x/y only.
    expect(route![route!.length - 1]).toMatchObject({ x: 2, y: 0 });
    // It DID step on the wall tile (that's the point) but never left the map.
    expect(route!.some((p) => at(p, 1, 0))).toBe(true);
    for (const step of route!) expect(map.isInBounds(step)).toBe(true);
  });

  it("a flyer is still confined to the map (never routes off-board)", () => {
    // A wall ring around the exit: ignoring walls must not tempt an off-map hop.
    const map = new GameMap(
      parseMapRows("ring", "Ring", ["S....", ".###.", ".#X#.", ".###."]),
    );
    const pf = new PathfindingSystem(map);
    const route = pf.routeToNearestGoal({
      start: { x: 0, y: 0 },
      goals: map.data.exits,
      ignoreWalls: true,
    });
    expect(route).not.toBeNull();
    expect(route![route!.length - 1]).toMatchObject({ x: 2, y: 2 });
    for (const step of route!) expect(map.isInBounds(step)).toBe(true);
  });
});

describe("WaveSystem flying enemies", () => {
  const lane = () => new GameMap(parseMapRows("lane", "Lane", ["S....X"]));

  it("a flyer passes a PLACED barricade; a ground enemy is stopped by it", () => {
    // Same one-row lane, same mid-lane blocked tile at (2,0) reported as a WALL.
    // A freshly spawned enemy also moves in its spawn phase, so one tick both
    // spawns the unit and advances it â€” enough to show whether it crossed x=2.
    const blockedWall = (p: GridPosition) => at(p, 2, 0);

    // Flyer: ignores the wall and, in its very first phase, advances past x=2.
    const map1 = lane();
    const flyer = new WaveSystem(map1, new PathfindingSystem(map1), [wave("wisp")], {
      startingIntegrity: 20, random: RandomService.fixed(),
    });
    flyer.startWave(0);
    const rep = flyer.tickEnemyPhase({ isBlocked: blockedWall, isWall: blockedWall });
    const flew = rep.moves.find((m) => m.enemy.def.id === "wisp");
    expect(flew).toBeDefined();
    expect(flew!.to.x).toBeGreaterThan(2); // it flew over the barricade

    // Ground: the same barricade seals the one-row lane, so it can't cross.
    const map2 = lane();
    const ground = new WaveSystem(map2, new PathfindingSystem(map2), [wave("grunt")], {
      startingIntegrity: 20, random: RandomService.fixed(),
    });
    ground.startWave(0);
    ground.tickEnemyPhase({ isBlocked: blockedWall, isWall: blockedWall });
    expect(ground.enemies[0].position.x).toBeLessThanOrEqual(2); // stopped at the wall
  });

  it("a flyer is still blocked by a hero (a non-wall blocker)", () => {
    // The blocked tile is a HERO this time (isBlocked set, isWall NOT set), so
    // the flyer must respect it â€” it ignores walls, not units.
    const hero = (p: GridPosition) => at(p, 2, 0);
    const map = lane();
    const ws = new WaveSystem(map, new PathfindingSystem(map), [wave("wisp")], {
      startingIntegrity: 20, random: RandomService.fixed(),
    });
    ws.startWave(0);
    ws.tickEnemyPhase({ isBlocked: hero }); // spawn (no isWall â†’ hero, not a wall)
    ws.tickEnemyPhase({ isBlocked: hero }); // try to advance
    expect(ws.enemies[0].position.x).toBeLessThanOrEqual(2); // held by the hero
  });

  it("two flyers never share a tile (enemy collision still applies)", () => {
    // A hero pins the lead wisp on the spawn tile; the second must not spawn on
    // top of it â€” the same no-stacking guarantee ground enemies already have.
    const hero = (p: GridPosition) => at(p, 1, 0);
    const map = lane();
    const ws = new WaveSystem(map, new PathfindingSystem(map), [wave("wisp", 2)], {
      startingIntegrity: 20, random: RandomService.fixed(),
    });
    ws.startWave(0);
    ws.tickEnemyPhase({ isBlocked: hero }); // wisp #1 spawns, can't pass the hero
    const t2 = ws.tickEnemyPhase({ isBlocked: hero }); // wisp #2 is due
    expect(t2.spawned).toHaveLength(0); // spawn tile occupied â†’ not stacked
    expect(ws.enemies).toHaveLength(1);
  });

  it("ground routing is unchanged: a ground enemy still routes around walls", () => {
    // Regression guard: with no flying, ignoreWalls defaults false everywhere.
    const map = new GameMap(parseMapRows("detour", "Detour", ["S.#..", "...#.", "....X"]));
    const ws = new WaveSystem(map, new PathfindingSystem(map), [wave("grunt")], {
      startingIntegrity: 20, random: RandomService.fixed(),
    });
    ws.startWave(0);
    ws.tickEnemyPhase(); // spawn
    ws.tickEnemyPhase(); // advance
    // Wherever it is, it never stood on a wall tile.
    expect(map.isWalkable(ws.enemies[0].position)).toBe(true);
  });
});

describe("Movement-type-aware traps (D-049)", () => {
  // One-row lane with a trap tile at (2,0). Both enemy types walk onto it on
  // their first phase (grunt moves 2, wisp moves 3), so the only variable is
  // whether the trap is allowed to bite that movement type.
  const lane = () => new GameMap(parseMapRows("lane", "Lane", ["S....X"]));

  function runWithTrap(structureId: string, enemyId: string) {
    const map = lane();
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    expect(build.place(structureId, { x: 2, y: 0 }).ok).toBe(true);
    const ws = new WaveSystem(map, pf, [wave(enemyId)], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    return ws.tickEnemyPhase({
      trapAt: (p) => build.trapProfileAt(p),
      trapTargets: (p) => build.trapTargetsAt(p),
    });
  }

  it("a Sky Snare catches a flyer", () => {
    const rep = runWithTrap("sky-snare", "wisp");
    expect(rep.trapTriggers).toHaveLength(1);
    expect(rep.trapTriggers[0].result.defeated).toBe(true); // 4 dmg vs 4 HP
  });

  it("a Sky Snare ignores a ground enemy", () => {
    const rep = runWithTrap("sky-snare", "grunt");
    expect(rep.trapTriggers).toHaveLength(0);
  });

  it("a Spike Trap ignores a flyer", () => {
    const rep = runWithTrap("spike-trap", "wisp");
    expect(rep.trapTriggers).toHaveLength(0);
  });

  it("a Spike Trap still bites a ground enemy", () => {
    const rep = runWithTrap("spike-trap", "grunt");
    expect(rep.trapTriggers).toHaveLength(1);
  });
});
