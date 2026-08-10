import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { BuildSystem } from "../src/game/systems/BuildSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import type { Combatant } from "../src/game/systems/CombatSystem";
import type { WaveDefinition, WaveSpawnGroup } from "../src/game/data/waves";
import type { GridPosition } from "../src/game/systems/GridSystem";

/**
 * Phase 25 (D-116): behavioural tests for this phase's two new enemy-AI
 * mechanics — the opportunistic (non-siege) wall bash any ordinary melee
 * enemy can now take when no hero is reachable, and the Saboteur/Warren
 * Stalker `trapSense` mechanic that detects and disarms a placed trap.
 * Roster/data-only sanity checks live in tests/enemyRoster.test.ts; this
 * file exercises the mechanics themselves through WaveSystem, same style as
 * tests/enemyMechanics.test.ts (Phase 20's siege tests).
 */

function setup(rows: string[]): { map: GameMap; pf: PathfindingSystem } {
  const map = new GameMap(parseMapRows("m", "m", rows));
  return { map, pf: new PathfindingSystem(map) };
}

function wave(spawns: WaveSpawnGroup[]): WaveDefinition {
  return { id: "w", spawns, completionGold: 0 };
}

function heroAt(id: string, position: GridPosition, overrides: Partial<Combatant> = {}): Combatant {
  return { id, position, health: 20, armorClass: 15, savingThrowBonus: 0, ...overrides };
}

function wallContext(build: BuildSystem) {
  return {
    isBlocked: (p: GridPosition) => build.isWallAt(p),
    wallHpAt: (p: GridPosition) => {
      const s = build.wallAt(p);
      return s && s.hp !== undefined ? { instanceId: s.instanceId, defId: s.defId } : null;
    },
    damageWall: (id: string, dmg: number) => build.damageStructure(id, dmg).destroyed,
  };
}

function trapContext(build: BuildSystem) {
  return {
    trapInstanceAt: (p: GridPosition) => {
      const s = build.trapAt(p);
      return s ? { instanceId: s.instanceId, defId: s.defId } : null;
    },
    disarmTrap: (id: string) => build.disarmTrap(id),
  };
}

// ----- Opportunistic wall bash (ordinary melee enemies) --------------------

describe("Opportunistic wall bash (ordinary melee enemies, D-116)", () => {
  it("bashes a destructible wall in range with its own attackDamage when no hero is reachable", () => {
    const { map, pf } = setup(["S..X", "...."]);
    const build = new BuildSystem(map, pf);
    build.place("barricade", { x: 1, y: 0 }); // hp 10, adjacent to the spawn
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);

    const t1 = ws.tickEnemyPhase(wallContext(build));
    expect(t1.structureAttacks).toHaveLength(1);
    expect(t1.structureAttacks[0].damage).toBe(2); // grunt's own attackDamage — no siege multiplier
    expect(t1.structureAttacks[0].opportunistic).toBe(true);
    expect(t1.moves).toHaveLength(0);
    expect(t1.attacks).toHaveLength(0);
  });

  it("prefers attacking a reachable hero over an opportunistic wall bash", () => {
    const { map, pf } = setup(["S..X", "...."]);
    const build = new BuildSystem(map, pf);
    build.place("barricade", { x: 1, y: 0 });
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);

    const t1 = ws.tickEnemyPhase({ heroTargets: [heroAt("hero-1", { x: 0, y: 1 })], ...wallContext(build) });
    expect(t1.attacks).toHaveLength(1);
    expect(t1.structureAttacks).toHaveLength(0);
  });

  it("does not apply to a ranged/caster enemy (attackRangeTiles > 1)", () => {
    const { map, pf } = setup(["S.X"]);
    const build = new BuildSystem(map, pf);
    build.place("barricade", { x: 1, y: 0 });
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "hexer", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase(wallContext(build));
    expect(t1.structureAttacks).toHaveLength(0);
  });

  it("does not apply to a pure runner (ignoresHeroes) — it never attacks anything, wall included", () => {
    // A synthetic wall (NOT placed via BuildSystem, which would refuse to
    // seal a single lane's only route) directly at the enemy's next step, so
    // it is genuinely stuck with zero other option this phase.
    const { map, pf } = setup(["S.X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "sprinter", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const wallPos = { x: 1, y: 0 };
    const t1 = ws.tickEnemyPhase({
      isBlocked: (p) => p.x === wallPos.x && p.y === wallPos.y,
      wallHpAt: (p) => (p.x === wallPos.x && p.y === wallPos.y ? { instanceId: "w#1", defId: "barricade" } : null),
      damageWall: () => false,
    });
    expect(t1.structureAttacks).toHaveLength(0);
    expect(t1.moves[0].path).toHaveLength(0); // fully blocked, holds in place
  });

  it("still lets a dedicated siege enemy use its own (multiplied) attack instead of the opportunistic tier", () => {
    const { map, pf } = setup(["S..X", "...."]);
    const build = new BuildSystem(map, pf);
    build.place("barricade", { x: 1, y: 0 });
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "siegebreaker", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase(wallContext(build));
    expect(t1.structureAttacks).toHaveLength(1);
    expect(t1.structureAttacks[0].damage).toBe(9); // 3 attackDamage * 3 siegeDamageMultiplier
    expect(t1.structureAttacks[0].opportunistic).toBeFalsy();
  });
});

// ----- Trap disarm (Saboteur / Warren Stalker: trapSense) -------------------

describe("Trap disarm (trapSense: Saboteur / Warren Stalker, D-116)", () => {
  it("disarms a placed trap within sense range instead of advancing, when no hero is reachable", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("spike-trap", { x: 1, y: 0 });
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "saboteur", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);

    const t1 = ws.tickEnemyPhase(trapContext(build));
    expect(t1.trapDisarms).toHaveLength(1);
    expect(t1.trapDisarms[0].structureDefId).toBe("spike-trap");
    expect(t1.moves).toHaveLength(0);
    expect(build.trapAt({ x: 1, y: 0 })).toBeNull();
  });

  it("prefers disarming a trap over attacking a reachable hero (same unconditional priority as siege)", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("spike-trap", { x: 1, y: 0 });
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "saboteur", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);

    const t1 = ws.tickEnemyPhase({ heroTargets: [heroAt("hero-1", { x: 0, y: 0 })], ...trapContext(build) });
    expect(t1.trapDisarms).toHaveLength(1);
    expect(t1.attacks).toHaveLength(0);
  });

  it("respects each enemy's own rangeTiles — a trap 2 tiles off is missed by Saboteur but found by Warren Stalker", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("spike-trap", { x: 2, y: 0 }); // 2 tiles from the spawn at (0,0)

    const saboteurWave = wave([{ enemyId: "saboteur", count: 1, startTurn: 1, intervalTurns: 1 }]);
    const ws1 = new WaveSystem(map, pf, [saboteurWave], { startingIntegrity: 20, random: RandomService.fixed() });
    ws1.startWave(0);
    const t1 = ws1.tickEnemyPhase(trapContext(build));
    expect(t1.trapDisarms).toHaveLength(0); // out of Saboteur's rangeTiles: 1

    const stalkerWave = wave([{ enemyId: "warren-stalker", count: 1, startTurn: 1, intervalTurns: 1 }]);
    const ws2 = new WaveSystem(map, pf, [stalkerWave], { startingIntegrity: 20, random: RandomService.fixed() });
    ws2.startWave(0);
    const t2 = ws2.tickEnemyPhase(trapContext(build));
    expect(t2.trapDisarms).toHaveLength(1); // within Warren Stalker's rangeTiles: 2
  });

  it("goes back to advancing normally once no trap remains in range", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("spike-trap", { x: 1, y: 0 });
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "saboteur", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);

    const t1 = ws.tickEnemyPhase(trapContext(build));
    expect(t1.trapDisarms).toHaveLength(1);
    const t2 = ws.tickEnemyPhase(trapContext(build));
    expect(t2.trapDisarms).toHaveLength(0);
    expect(t2.moves).toHaveLength(1);
  });
});
