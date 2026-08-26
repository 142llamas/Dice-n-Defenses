import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import type { WaveDefinition, WaveSpawnGroup } from "../src/game/data/waves";

/**
 * KI-098 item 10 (D-175): per-group initiative. `WaveSystem.tickEnemyPhase`
 * used to process `this.active` in raw spawn order, with no turn-order
 * concept at all. It now groups enemies by TYPE (`EnemyDefinition.id`),
 * rolls each group's initiative once per WAVE (via the previously-unused
 * `InitiativeSystem`), and processes groups highest-roll-first each phase —
 * members within a group keep their original relative order.
 */

function setup(rows: string[]): { map: GameMap; pf: PathfindingSystem } {
  const map = new GameMap(parseMapRows("m", "m", rows));
  return { map, pf: new PathfindingSystem(map) };
}

function wave(spawns: WaveSpawnGroup[]): WaveDefinition {
  return { id: "w", spawns, completionGold: 0 };
}

describe("WaveSystem per-group initiative (D-175)", () => {
  it("groups same-type enemies contiguously — never interleaved with another type", () => {
    // Two spawn points so both types can spawn turn 1 with no tile conflict.
    const { map, pf } = setup(["S.S........X"]); // grunt at (0,0), runner at (2,0)
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "runner", count: 2, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.fixed() },
    );
    ws.startWave(0);
    ws.tickEnemyPhase();

    const typeSequence = ws.enemies.map((e) => e.def.id);
    // No type may reappear after a DIFFERENT type has been seen following it
    // (i.e. every type occupies one contiguous run).
    const seenAndClosed = new Set<string>();
    let lastType: string | null = null;
    for (const t of typeSequence) {
      if (t !== lastType) {
        expect(seenAndClosed.has(t)).toBe(false); // this type was never closed out before
        if (lastType !== null) seenAndClosed.add(lastType);
        lastType = t;
      }
    }
  });

  it("ties (RandomService.fixed() rolls the same value for every group) break deterministically by enemy-type id, alphabetically", () => {
    const { map, pf } = setup(["S.S........X"]);
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.fixed() },
    );
    ws.startWave(0);
    ws.tickEnemyPhase();

    // "grunt" < "runner" alphabetically — even though "runner" was listed
    // (and would have spawned) first in the wave's own spawns array.
    expect(ws.enemies.map((e) => e.def.id)).toEqual(["grunt", "runner"]);
  });

  it("a group's initiative is rolled once per wave, not re-rolled every phase", () => {
    const seed = 777;
    // A parallel, identically-seeded predictor: `applyGroupInitiativeOrder`
    // rolls exactly one d20 per NEW type, in the order `this.active` first
    // contains it — grunt (spawnIndex 0, listed first) then runner
    // (spawnIndex 1) both spawn turn 1, so the real sequence is exactly
    // these two rolls, in this order, and never again for the rest of the
    // wave (no attacks/heals/other randomness happen in this no-context,
    // no-hero-targets scenario).
    const predictor = RandomService.seeded(seed);
    const gruntRoll = predictor.rollD20();
    const runnerRoll = predictor.rollD20();
    const expectedOrder =
      gruntRoll !== runnerRoll
        ? gruntRoll > runnerRoll
          ? ["grunt", "runner"]
          : ["runner", "grunt"]
        : ["grunt", "runner"]; // tie -> alphabetical, matching the production tiebreak

    const { map, pf } = setup(["S.S............X"]);
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.seeded(seed) },
    );
    ws.startWave(0);

    const t1 = ws.tickEnemyPhase();
    expect(t1.moves.map((m) => m.enemy.def.id)).toEqual(expectedOrder);

    const t2 = ws.tickEnemyPhase();
    // Same order again next phase, same wave — proves the roll is cached,
    // not re-drawn (a fresh draw would advance the shared PRNG stream and
    // could easily flip which group leads).
    expect(t2.moves.map((m) => m.enemy.def.id)).toEqual(expectedOrder);
  });
});
