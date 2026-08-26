import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import type { WaveDefinition } from "../src/game/data/waves";
import { getEnemyDefinition } from "../src/game/data/enemies";

/**
 * Phase 3 wave tests. These back the acceptance criteria: enemies follow valid
 * routes, breach damage occurs once, and wave completion is detected reliably.
 * A short 4-wide lane (spawn to exit distance 3) keeps the arithmetic simple.
 */

// S..X  -> spawn at (0,0), exit at (3,0); distance 3.
function makeSystem(waves: WaveDefinition[], startingIntegrity = 20) {
  const map = new GameMap(parseMapRows("lane", "Lane", ["S..X"]));
  const pf = new PathfindingSystem(map);
  const ws = new WaveSystem(map, pf, waves, { startingIntegrity, random: RandomService.fixed() });
  ws.startWave(0);
  return ws;
}

// D-172: Grunt's real speed is now 4 tiles/phase (was 2) — the shared
// distance-3 lane above no longer needs two phases to cross (any test that
// wants a Grunt to survive at least one phase un-breached needs a longer
// lane). S.....X -> spawn at (0,0), exit at (6,0); distance 6.
function makeGruntLaneSystem(waves: WaveDefinition[], startingIntegrity = 20) {
  const map = new GameMap(parseMapRows("lane", "Lane", ["S.....X"]));
  const pf = new PathfindingSystem(map);
  const ws = new WaveSystem(map, pf, waves, { startingIntegrity, random: RandomService.fixed() });
  ws.startWave(0);
  return ws;
}

function makeScaledSystem(
  waves: WaveDefinition[],
  enemyCountMultiplier: number,
  enemyHpMultiplier: number,
) {
  const map = new GameMap(parseMapRows("lane", "Lane", ["S..X"]));
  const pf = new PathfindingSystem(map);
  const ws = new WaveSystem(map, pf, waves, {
    startingIntegrity: 20, random: RandomService.fixed(),
    enemyCountMultiplier,
    enemyHpMultiplier,
  });
  ws.startWave(0);
  return ws;
}

describe("WaveSystem spawning and movement", () => {
  it("spawns enemies on schedule at the spawn point", () => {
    const ws = makeSystem([
      {
        id: "w",
        spawns: [{ enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 }],
        completionGold: 0,
      },
    ]);
    const t1 = ws.tickEnemyPhase();
    expect(t1.spawned.length).toBe(1);
    expect(t1.spawned[0].position).not.toEqual({ x: 0, y: 0 }); // it also moved this phase
    // Runner moves 3 tiles: from (0,0) it reaches the exit (3,0) immediately and breaches.
    expect(t1.breaches.length).toBe(1);
  });

  it("advances a slow enemy over multiple phases before it breaches", () => {
    const ws = makeGruntLaneSystem([
      {
        id: "w",
        // Grunt moves 4 tiles/phase (D-172); distance is 6, so it needs two phases.
        spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }],
        completionGold: 0,
      },
    ]);
    const t1 = ws.tickEnemyPhase();
    expect(t1.spawned.length).toBe(1);
    expect(t1.breaches.length).toBe(0); // only reached (4,0) so far
    expect(t1.moves[0].to).toEqual({ x: 4, y: 0 });
    const t2 = ws.tickEnemyPhase();
    expect(t2.breaches.length).toBe(1);
    expect(t2.breaches[0].enemy.position).toEqual({ x: 6, y: 0 });
  });
});

describe("WaveSystem breach damage (acceptance: occurs once)", () => {
  it("removes exactly the breach damage and only once per enemy", () => {
    const ws = makeGruntLaneSystem(
      [
        {
          id: "w",
          spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }],
          completionGold: 0,
        },
      ],
      20,
    );
    ws.tickEnemyPhase(); // grunt to (4,0)
    const before = ws.integrity;
    const t2 = ws.tickEnemyPhase(); // grunt breaches: -2
    expect(t2.breaches.length).toBe(1);
    expect(ws.integrity).toBe(before - 2);
    // The breached enemy is gone from the field, so no further breaches happen.
    const t3 = ws.tickEnemyPhase();
    expect(t3.breaches.length).toBe(0);
    expect(ws.integrity).toBe(before - 2);
    expect(ws.enemies.length).toBe(0);
  });
});

describe("WaveSystem completion (acceptance: detected reliably)", () => {
  it("is not complete until every enemy has spawned and left the field", () => {
    const ws = makeSystem([
      {
        id: "w",
        spawns: [{ enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 2 }],
        completionGold: 0,
      },
    ]);
    // Runner reaches the exit the same phase it spawns (moves 3 >= distance 3).
    const t1 = ws.tickEnemyPhase(); // spawn+breach runner #1; runner #2 not due until turn 3
    expect(t1.waveComplete).toBe(false); // one runner still unspawned
    const t2 = ws.tickEnemyPhase(); // turn 2: nothing due, field empty but group not done
    expect(t2.waveComplete).toBe(false);
    const t3 = ws.tickEnemyPhase(); // turn 3: spawn+breach runner #2 -> all spawned, field empty
    expect(t3.waveComplete).toBe(true);
    expect(ws.isCurrentWaveComplete()).toBe(true);
  });
});

describe("WaveSystem Test Mode debug hooks (D-138)", () => {
  it("setNoFail(true) keeps isDefeated() false even at 0 integrity", () => {
    const ws = makeSystem(
      [{ id: "w", spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 }],
      1,
    );
    ws.tickEnemyPhase(); // grunt to (2,0)
    ws.tickEnemyPhase(); // grunt breaches: integrity -> max(0, 1-2) = 0
    expect(ws.integrity).toBe(0);
    expect(ws.isDefeated()).toBe(true);
    ws.setNoFail(true);
    expect(ws.isDefeated()).toBe(false);
    ws.setNoFail(false);
    expect(ws.isDefeated()).toBe(true);
  });

  it("forceEndWave() empties active enemies and flips isCurrentWaveComplete() true", () => {
    const ws = makeGruntLaneSystem([
      {
        id: "w",
        spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 5 }],
        completionGold: 0,
      },
    ]);
    ws.tickEnemyPhase(); // spawns grunt #1 only; two more still scheduled
    expect(ws.enemies.length).toBe(1);
    expect(ws.isCurrentWaveComplete()).toBe(false);
    ws.forceEndWave();
    expect(ws.enemies.length).toBe(0);
    expect(ws.isCurrentWaveComplete()).toBe(true);
  });

  it("spawnAt() adds a real Enemy of the requested definition at the exact tile", () => {
    const ws = makeSystem([{ id: "w", spawns: [], completionGold: 0 }]);
    const enemy = ws.spawnAt("grunt", { x: 1, y: 0 });
    expect(ws.enemies).toContain(enemy);
    expect(enemy.def).toBe(getEnemyDefinition("grunt"));
    expect(enemy.position).toEqual({ x: 1, y: 0 });
    expect(enemy.health).toBe(getEnemyDefinition("grunt").maxHealth);
  });
});

describe("WaveSystem defeat", () => {
  it("reports defeat when Stronghold Integrity hits zero", () => {
    // Three grunts (2 breach each = 6) against 5 integrity -> defeat.
    const ws = makeSystem(
      [
        {
          id: "w",
          spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }],
          completionGold: 0,
        },
      ],
      5,
    );
    let defeated = false;
    for (let i = 0; i < 8 && !defeated; i++) {
      const r = ws.tickEnemyPhase();
      defeated = r.defeated;
    }
    expect(defeated).toBe(true);
    expect(ws.integrity).toBe(0);
    expect(ws.isDefeated()).toBe(true);
  });
});

describe("WaveSystem wave progression", () => {
  it("moves to the next wave and tracks last-wave status", () => {
    const ws = makeSystem([
      { id: "w1", spawns: [{ enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 },
      { id: "w2", spawns: [{ enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 },
    ]);
    expect(ws.waveNumber).toBe(1);
    expect(ws.isLastWave()).toBe(false);
    ws.advanceToNextWave();
    expect(ws.waveNumber).toBe(2);
    expect(ws.isLastWave()).toBe(true);
  });
});

describe("WaveSystem difficulty/party-size scaling (Phase 11.4, D-077)", () => {
  it("with no multipliers supplied, behaves exactly as before (1x)", () => {
    const ws = makeScaledSystem(
      [{ id: "w", spawns: [{ enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 0 }],
      1,
      1,
    );
    const t1 = ws.tickEnemyPhase();
    expect(t1.spawned[0].def.maxHealth).toBe(6); // grunt's base maxHealth, unscaled
  });

  it("scales a group's spawn count, rounded, minimum 1", () => {
    // Runner moves 3 tiles/phase, matching the lane's spawn-to-exit distance,
    // so it breaches the same phase it spawns (see the very first test above)
    // â€” that keeps this test to exactly one tick per scaled-up spawn.
    const ws = makeScaledSystem(
      [{ id: "w", spawns: [{ enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1 }], completionGold: 0 }],
      1.5, // 2 * 1.5 = 3
      1,
    );
    expect(ws.isCurrentWaveComplete()).toBe(false);
    for (let i = 0; i < 3; i++) ws.tickEnemyPhase();
    // All three scaled-up runners have spawned and breached.
    expect(ws.isCurrentWaveComplete()).toBe(true);
  });

  it("never scales a group's count down to zero even with a small multiplier", () => {
    const ws = makeScaledSystem(
      [{ id: "w", spawns: [{ enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 }],
      0.1,
      1,
    );
    const t1 = ws.tickEnemyPhase();
    expect(t1.spawned.length).toBe(1); // still spawns the one runner, not zero
  });

  it("scales spawned enemies' max HP, rounded, without mutating the shared enemy definition", () => {
    const ws = makeScaledSystem(
      [{ id: "w", spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 }],
      1,
      1.5, // 6 * 1.5 = 9
    );
    const t1 = ws.tickEnemyPhase();
    expect(t1.spawned[0].def.maxHealth).toBe(9);
    expect(t1.spawned[0].health).toBe(9);
    expect(getEnemyDefinition("grunt").maxHealth).toBe(6); // registry untouched
  });
});
