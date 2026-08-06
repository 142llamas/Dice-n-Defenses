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
 * Phase 20 (D-111): behavioural tests for the six new enemy mechanics —
 * siege (destructible walls), stealth (hidden-until-ambush), aura buffs
 * (captain/banner), reinforcements (an enemy calling in more enemies),
 * AoE/breath attacks, and pure runners (ignoresHeroes). Roster/data-only
 * sanity checks live in tests/enemyRoster.test.ts; this file exercises the
 * mechanics themselves through WaveSystem.tickEnemyPhase.
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

// ----- Siege: destroying a wall in reach -----------------------------------

describe("Siege enemies (siegeDamageMultiplier)", () => {
  it("attacks a destructible wall in range instead of moving, destroying it after enough hits", () => {
    const { map, pf } = setup(["S..X", "...."]);
    const build = new BuildSystem(map, pf);
    build.place("barricade", { x: 1, y: 0 }); // hp 10, adjacent to the spawn
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "siegebreaker", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const context = {
      wallHpAt: (p: GridPosition) => {
        const s = build.wallAt(p);
        return s && s.hp !== undefined ? { instanceId: s.instanceId, defId: s.defId } : null;
      },
      damageWall: (id: string, dmg: number) => build.damageStructure(id, dmg).destroyed,
    };

    const t1 = ws.tickEnemyPhase(context);
    // Siegebreaker: attackDamage 3 * siegeDamageMultiplier 3 = 9 damage.
    expect(t1.structureAttacks).toHaveLength(1);
    expect(t1.structureAttacks[0].damage).toBe(9);
    expect(t1.structureAttacks[0].destroyed).toBe(false);
    expect(t1.moves).toHaveLength(0); // sieging holds position, like attacking a hero
    expect(t1.attacks).toHaveLength(0);
    expect(build.wallAt({ x: 1, y: 0 })?.hp).toBe(1);

    const t2 = ws.tickEnemyPhase(context);
    expect(t2.structureAttacks[0].destroyed).toBe(true);
    expect(build.isWallAt({ x: 1, y: 0 })).toBe(false);

    // With the wall gone, the siege enemy goes back to advancing normally.
    const t3 = ws.tickEnemyPhase(context);
    expect(t3.structureAttacks).toHaveLength(0);
    expect(t3.moves).toHaveLength(1);
  });

  it("attacks a hero normally when no wall is within its attack range", () => {
    const { map, pf } = setup(["S.X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "siegebreaker", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase({
      heroTargets: [heroAt("hero-1", { x: 1, y: 0 })],
      wallHpAt: () => null,
      damageWall: () => false,
    });
    expect(t1.structureAttacks).toHaveLength(0);
    expect(t1.attacks).toHaveLength(1);
    expect(t1.attacks[0].target.id).toBe("hero-1");
  });
});

// ----- Stealth: hidden until the ambush ------------------------------------

describe("Stealth enemies (def.stealth)", () => {
  it("stays hidden while it never gets a hero in range to strike", () => {
    const { map, pf } = setup(["S......X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "shadowfang", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase({}); // no heroes at all
    const enemy = t1.spawned[0];
    expect(enemy.isRevealed).toBe(false);
    expect(t1.moves).toHaveLength(1); // still advances normally while hidden
  });

  it("reveals itself permanently the instant it lands its first strike", () => {
    const { map, pf } = setup(["S..X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "shadowfang", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const hero = heroAt("hero-1", { x: 1, y: 0 }); // adjacent to the spawn tile
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(t1.attacks).toHaveLength(1);
    const enemy = t1.attacks[0].enemy;
    expect(enemy.isRevealed).toBe(true);

    // A second strike no longer counts as an ambush, but stays revealed.
    const t2 = ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(t2.attacks).toHaveLength(1);
    expect(t2.attacks[0].enemy.isRevealed).toBe(true);
  });
});

// ----- Aura buffs: captains/banners ----------------------------------------

describe("Aura buff enemies (def.auraBuff)", () => {
  it("buffs a DIFFERENT nearby ally's damage, but never its own", () => {
    const { map, pf } = setup(["S.S...X"]); // battlepriest at (0,0), grunt at (2,0)
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "battlepriest", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.fixed(15) }, // guarantees a hit, never a crit
    );
    ws.startWave(0);
    const hero = heroAt("hero-1", { x: 1, y: 0 }); // range 1 of both (0,0) and (2,0)
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(t1.attacks).toHaveLength(2);
    const byEnemyId = new Map(t1.attacks.map((a) => [a.enemy.def.id, a.result.damageDealt]));
    expect(byEnemyId.get("battlepriest")).toBe(2); // its own base damage, un-boosted
    expect(byEnemyId.get("grunt")).toBe(4); // base 2 + battlepriest's +2 damageBonus
  });

  it("does not reach an ally outside its radius", () => {
    const { map, pf } = setup(["S...S...X"]); // battlepriest at (0,0), grunt at (4,0) — distance 4 > radius 2
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "battlepriest", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.fixed(15) },
    );
    ws.startWave(0);
    const hero = heroAt("hero-1", { x: 3, y: 0 }); // adjacent only to grunt
    // Pin battlepriest in place (blocked from moving toward grunt) so this
    // test measures the ORIGINAL spawn distance (4, outside radius 2), not
    // a distance that closed during the same phase's movement.
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x >= 1 });
    expect(t1.attacks).toHaveLength(1);
    expect(t1.attacks[0].enemy.def.id).toBe("grunt");
    expect(t1.attacks[0].result.damageDealt).toBe(2); // un-boosted, out of range
  });
});

// ----- Reinforcements: an enemy calling in more enemies --------------------

describe("Reinforcement-calling enemies (def.callsReinforcements)", () => {
  it("spawns more enemies adjacent to itself only once the interval elapses", () => {
    const { map, pf } = setup(["S.........X", "..........."]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "cultist-caller", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase({});
    expect(t1.reinforcements).toHaveLength(0);
    const t2 = ws.tickEnemyPhase({});
    expect(t2.reinforcements).toHaveLength(0);
    // The caller's position AT THE MOMENT reinforcements are computed (the
    // start of tick 3, before it moves again later in that same phase) —
    // captured now since `Enemy.position` is a live, mutable field, not a
    // snapshot the report freezes.
    const posBeforeT3 = { ...ws.enemies.find((e) => e.def.id === "cultist-caller")!.position };
    // Pin everyone in place for this one tick (nothing may end up more than 1
    // tile from where the caller stood at the start of it) so the spawned
    // reinforcements — which get their OWN turn later in this same phase,
    // same as the caller falling through to its own move afterward — can't
    // wander before this test inspects their positions.
    const t3 = ws.tickEnemyPhase({
      isBlocked: (p) => Math.abs(p.x - posBeforeT3.x) + Math.abs(p.y - posBeforeT3.y) > 1,
    });
    // cultist-caller: intervalTurns 3, count 2 swarmlings.
    expect(t3.reinforcements).toHaveLength(1);
    expect(t3.reinforcements[0].spawned).toHaveLength(2);
    expect(t3.reinforcements[0].spawned.every((s) => s.def.id === "swarmling")).toBe(true);
    // Every reinforcement landed orthogonally adjacent to the caller AT SPAWN TIME.
    for (const s of t3.reinforcements[0].spawned) {
      const dist = Math.abs(s.position.x - posBeforeT3.x) + Math.abs(s.position.y - posBeforeT3.y);
      expect(dist).toBe(1);
    }
    // The new arrivals are now part of the active roster.
    expect(ws.enemies.length).toBe(3);
  });

  it("spawns nothing (without crashing) when completely boxed in", () => {
    const { map, pf } = setup(["S.........X", "..........."]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "cultist-caller", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const blockedContext = { isBlocked: () => true };
    ws.tickEnemyPhase(blockedContext);
    ws.tickEnemyPhase(blockedContext);
    const t3 = ws.tickEnemyPhase(blockedContext);
    expect(t3.reinforcements).toHaveLength(0);
    expect(ws.enemies.length).toBe(1); // still just the caller
  });
});

// ----- AoE / breath attacks -------------------------------------------------

describe("AoE/breath enemies (def.aoeAttack)", () => {
  it("hits every hero within range at once, each independently rolled", () => {
    const { map, pf } = setup(["S...X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "cave-drake", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(15), // guarantees a hit on both heroes
    });
    ws.startWave(0);
    const heroA = heroAt("hero-a", { x: 1, y: 0 });
    const heroB = heroAt("hero-b", { x: 2, y: 0 });
    const t1 = ws.tickEnemyPhase({ heroTargets: [heroA, heroB] });
    expect(t1.attacks).toHaveLength(2);
    const ids = t1.attacks.map((a) => a.target.id).sort();
    expect(ids).toEqual(["hero-a", "hero-b"]);
    for (const atk of t1.attacks) expect(atk.result.damageDealt).toBe(3); // cave-drake's attackDamage
    expect(t1.moves).toHaveLength(0); // breathing fire holds position
  });

  it("combined with a saving-throw DC, rolls one save per hero in the cone", () => {
    const { map, pf } = setup(["S...X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "frost-warden", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(5), // a low roll that fails a DC-12 save
    });
    ws.startWave(0);
    const heroA = heroAt("hero-a", { x: 1, y: 0 });
    const heroB = heroAt("hero-b", { x: 2, y: 0 });
    const t1 = ws.tickEnemyPhase({ heroTargets: [heroA, heroB] });
    expect(t1.attacks).toHaveLength(2);
    for (const atk of t1.attacks) {
      expect(atk.result.roll?.hit).toBe(true); // "hit" means the save failed
      expect(atk.result.damageDealt).toBe(3); // frost-warden's attackDamage
    }
  });
});

// ----- Pure runners: never engage heroes ------------------------------------

describe("Pure runner enemies (def.ignoresHeroes)", () => {
  it("never attacks a hero, even one standing right next to it, and always advances", () => {
    const { map, pf } = setup(["S...X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "sprinter", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const hero = heroAt("hero-1", { x: 1, y: 0 }); // adjacent to the spawn tile
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(t1.attacks).toHaveLength(0);
    expect(t1.moves).toHaveLength(1);
  });
});
