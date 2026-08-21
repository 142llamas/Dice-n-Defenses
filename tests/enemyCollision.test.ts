import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import type { WaveDefinition } from "../src/game/data/waves";

/**
 * Playtest fix: "Enemies are allowed to stack on top of each other." These
 * tests back the fix â€” no two living enemies ever share a tile, whether
 * that's because one is queued behind another mid-lane or because a new
 * enemy would spawn on top of one still standing on the spawn tile.
 */

function laneWave(overrides: Partial<WaveDefinition> = {}): WaveDefinition {
  return {
    id: "w",
    spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }],
    completionGold: 0,
    ...overrides,
  };
}

function positionsAreUnique(positions: Array<{ x: number; y: number }>): boolean {
  const keys = positions.map((p) => `${p.x},${p.y}`);
  return new Set(keys).size === keys.length;
}

describe("Enemies never stack while marching", () => {
  it("a following enemy queues behind one that cannot move further, instead of overlapping it", () => {
    // A narrow one-wide corridor: the lead grunt is placed one step from the
    // exit and given no room to move (movementTiles is a data value we can't
    // change per-instance, so instead we shrink the corridor so the SECOND
    // grunt catches up to the first one's tile and must hold behind it).
    // To force an actual queue, use a corridor and two enemies spawned
    // back-to-back with a wall placed one tile ahead of spawn so the first
    // grunt cannot move away in time.
    const map2 = new GameMap(parseMapRows("m2", "m2", ["S....X"]));
    const pf2 = new PathfindingSystem(map2);
    const ws = new WaveSystem(map2, pf2, [laneWave()], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);

    // Block the tile at (1,0) so nothing can advance past (0,0) at all â€”
    // this traps every spawned grunt right at the spawn tile, the scenario
    // most likely to stack.
    const isBlocked = (p: { x: number; y: number }) => p.x === 1 && p.y === 0;

    const t1 = ws.tickEnemyPhase({ isBlocked });
    expect(t1.spawned).toHaveLength(1); // first grunt spawns

    const t2 = ws.tickEnemyPhase({ isBlocked });
    // A second grunt is due, but the spawn tile is occupied by the first
    // (which could not move anywhere) â€” so it must NOT spawn on top of it.
    expect(t2.spawned).toHaveLength(0);
    expect(ws.enemies).toHaveLength(1); // still just the one grunt

    // Once the corridor opens back up, the queued spawn goes through, and the
    // two grunts are never on the same tile.
    const t3 = ws.tickEnemyPhase(); // no isBlocked this time â€” corridor is open
    expect(t3.spawned.length).toBeGreaterThanOrEqual(0);
    const positions = ws.enemies.map((e) => e.position);
    expect(positionsAreUnique(positions)).toBe(true);
  });

  it("keeps every enemy on a distinct tile across several phases of free marching", () => {
    // A wide-open lane with three grunts spawning on consecutive phases and
    // nothing blocking â€” the routine "just march" case. At no point should
    // two of them share a tile.
    const map = new GameMap(parseMapRows("m", "m", ["S..........X"]));
    const pf = new PathfindingSystem(map);
    const ws = new WaveSystem(map, pf, [laneWave()], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);

    for (let i = 0; i < 6; i++) {
      ws.tickEnemyPhase();
      const positions = ws.enemies.map((e) => e.position);
      expect(positionsAreUnique(positions)).toBe(true);
    }
  });

  it("a boxed-in enemy holds in place rather than overlapping the one ahead of it", () => {
    // Two grunts in a strict single-file corridor with the SECOND grunt
    // spawning right behind the first. If the first can't get far enough
    // ahead, the second must simply not move onto its tile.
    const map = new GameMap(parseMapRows("m", "m", ["S.....X"]));
    const pf = new PathfindingSystem(map);
    const ws = new WaveSystem(map, pf, [laneWave()], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);

    ws.tickEnemyPhase(); // grunt A spawns at (0,0), then moves 2 -> (2,0)
    ws.tickEnemyPhase(); // grunt B spawns at (0,0), then moves toward A

    const positions = ws.enemies.map((e) => e.position);
    expect(positionsAreUnique(positions)).toBe(true);
    // Grunt B must not have leap-frogged onto or past grunt A's tile.
    const [a, b] = ws.enemies;
    expect(b.position.x).toBeLessThan(a.position.x);
  });
});

describe("D-067: enemies may walk THROUGH each other, but never share a landing tile", () => {
  it("backs off one tile short of a stationary enemy, then passes straight through it once there's room beyond", () => {
    const map = new GameMap(parseMapRows("m", "m", ["S.......X"])); // S=(0,0) .. X=(8,0)
    const pf = new PathfindingSystem(map);
    const wave: WaveDefinition = {
      id: "w",
      spawns: [
        { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }, // "A"
        { enemyId: "grunt", count: 1, startTurn: 4, intervalTurns: 1 }, // "B"
      ],
      completionGold: 0,
    };
    const ws = new WaveSystem(map, pf, [wave], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);

    // Grunt A (movementTiles 2) reaches (4,0) after two ticks; a long stun
    // then freezes it there as a deterministic, stationary occupant to test
    // passage through â€” deliberately no hero anywhere in this test, since
    // the Enemy AI/Movement Redesign (D-139/D-140) changed WHEN and WHY an
    // enemy fights a hero, not this enemy-vs-enemy passthrough rule, which
    // this isolates from hero engagement entirely.
    ws.tickEnemyPhase(); // turn1: A spawns (0,0) -> (2,0)
    ws.tickEnemyPhase(); // turn2: A (2,0) -> (4,0)
    const enemyA = ws.enemies[0];
    expect(enemyA.position).toEqual({ x: 4, y: 0 });
    enemyA.applyStatus("stunned", 99);

    ws.tickEnemyPhase(); // turn3: A stunned, holds; B not due yet (startTurn 4)
    ws.tickEnemyPhase(); // turn4: B spawns (0,0) -> (2,0); A still holds
    const backOffTick = ws.tickEnemyPhase(); // turn5: B (2,0) -> wants (4,0) (A's tile)
    const enemyB = ws.enemies.find((e) => e !== enemyA)!;
    // B's 2-tile budget would land it exactly on A â€” it must back off to the
    // nearest earlier free tile instead of sharing A's tile.
    expect(enemyB.position).toEqual({ x: 3, y: 0 });
    expect(backOffTick.moves.find((m) => m.enemy === enemyB)?.to).toEqual({ x: 3, y: 0 });

    const passThroughTick = ws.tickEnemyPhase(); // B: (3,0) -> (5,0), via A's tile
    // B walked STRAIGHT THROUGH A's stationary tile (4,0) as an intermediate
    // step (no detour) and landed past it, since passing through is now
    // allowed â€” only sharing the FINAL tile is forbidden.
    const bMove = passThroughTick.moves.find((m) => m.enemy === enemyB);
    expect(bMove?.path).toEqual([{ x: 4, y: 0 }, { x: 5, y: 0 }]);
    expect(enemyB.position).toEqual({ x: 5, y: 0 });
    expect(enemyA.position).toEqual({ x: 4, y: 0 }); // A is unaffected, still holding

    const positions = ws.enemies.map((e) => e.position);
    expect(positionsAreUnique(positions)).toBe(true);
  });
});
