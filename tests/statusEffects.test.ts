import { describe, it, expect, vi } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import type { Combatant } from "../src/game/systems/CombatSystem";
import { Enemy } from "../src/game/entities/Enemy";
import { getEnemyDefinition } from "../src/game/data/enemies";
import type { WaveDefinition } from "../src/game/data/waves";

/**
 * Phase 7 "status effects" tests. Covers the Enemy-level rules (apply/refresh/
 * expire, movement reduction) and their integration into WaveSystem's enemy
 * phase (burn ticks before the enemy acts, stun holds it, slow reduces how far
 * it walks). Un-statused behaviour is exhaustively covered by the pre-existing
 * 120 tests, which all still pass unchanged â€” these add ONLY the new rules.
 */

function laneWave(enemyId: string): WaveDefinition {
  return {
    id: "w",
    spawns: [{ enemyId, count: 1, startTurn: 1, intervalTurns: 1 }],
    completionGold: 0,
  };
}

describe("Enemy status effect bookkeeping", () => {
  it("applies, reports, and expires a status after its duration", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    expect(enemy.hasStatus("slowed")).toBe(false);
    enemy.applyStatus("slowed", 2);
    expect(enemy.hasStatus("slowed")).toBe(true);
    enemy.tickStatuses(); // 2 -> 1, still active
    expect(enemy.hasStatus("slowed")).toBe(true);
    enemy.tickStatuses(); // 1 -> 0, expires
    expect(enemy.hasStatus("slowed")).toBe(false);
  });

  it("refreshes to the LONGER duration instead of stacking", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    enemy.applyStatus("slowed", 1);
    enemy.applyStatus("slowed", 3); // refresh to the longer one
    enemy.tickStatuses();
    enemy.tickStatuses();
    expect(enemy.hasStatus("slowed")).toBe(true); // would have expired at 1
    enemy.tickStatuses();
    expect(enemy.hasStatus("slowed")).toBe(false);
  });

  it("reduces effective movement while slowed, never below 0", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 }); // 2 tiles
    expect(enemy.effectiveMovementTiles).toBe(2);
    enemy.applyStatus("slowed", 1); // -2
    expect(enemy.effectiveMovementTiles).toBe(0);
  });

  it("removeStatus() clears an active status early; a no-op if absent (D-138)", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    enemy.applyStatus("slowed", 5);
    expect(enemy.hasStatus("slowed")).toBe(true);
    enemy.removeStatus("slowed");
    expect(enemy.hasStatus("slowed")).toBe(false);
    enemy.removeStatus("slowed"); // already gone
    expect(enemy.hasStatus("slowed")).toBe(false);
  });
});

describe("WaveSystem integration: burning", () => {
  it("damages the enemy at the start of its phase, ignoring defense", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase(); // spawns the grunt (6 HP, defense 1)
    const grunt = t1.spawned[0];
    grunt.applyStatus("burning", 2);

    const t2 = ws.tickEnemyPhase();
    const tick = t2.statusEvents.find((e) => e.effectId === "burning");
    expect(tick).toBeDefined();
    expect(tick?.result?.damageDealt).toBe(2); // ignores defense: full 2 damage
    expect(grunt.health).toBe(4);
    // The enemy still moved after burning (it survived the tick).
    expect(t2.moves).toHaveLength(1);
  });

  it("kills the enemy on the burn tick, so it never acts or breaches that phase", () => {
    // A lane long enough that the runner (3 tiles/phase) can never reach the
    // exit before the second burn tick kills it, isolating the burn-kill from
    // a breach.
    const map = new GameMap(parseMapRows("lane", "lane", ["S.......X"]));
    const pf = new PathfindingSystem(map);
    const ws = new WaveSystem(map, pf, [laneWave("runner")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase(); // spawn + move to x=3
    const runner = t1.spawned[0]; // 3 HP
    runner.applyStatus("burning", 3); // 2 dmg/turn: two ticks defeat it

    ws.tickEnemyPhase(); // burn: 3 -> 1, survives, moves to x=6
    const t3 = ws.tickEnemyPhase(); // burn: 1 -> 0, defeated before it can move
    expect(runner.isAlive()).toBe(false);
    expect(t3.moves).toHaveLength(0); // burned to death before it could move
    expect(t3.breaches).toHaveLength(0);
  });
});

describe("WaveSystem integration: stunned", () => {
  it("holds the enemy â€” no attack, no movement â€” but the stun still ticks down", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const grunt = t1.spawned[0];
    const startPos = { ...grunt.position };
    grunt.applyStatus("stunned", 1);

    const t2 = ws.tickEnemyPhase();
    expect(t2.moves).toHaveLength(0);
    expect(t2.statusEvents.some((e) => e.effectId === "stunned")).toBe(true);
    expect(grunt.position).toEqual(startPos); // held in place

    // Stun has expired; the grunt marches normally again.
    const t3 = ws.tickEnemyPhase();
    expect(t3.moves).toHaveLength(1);
  });
});

describe("WaveSystem integration: slowed", () => {
  it("reduces how far the enemy advances this phase", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S.......X"]));
    const pf = new PathfindingSystem(map);
    const ws = new WaveSystem(map, pf, [laneWave("runner")], { startingIntegrity: 20, random: RandomService.fixed() }); // 3 tiles/phase
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const runner = t1.spawned[0];
    runner.applyStatus("slowed", 1); // -2 movement this phase

    const t2 = ws.tickEnemyPhase();
    expect(t2.moves[0].path).toHaveLength(1); // 3 - 2 = 1 tile instead of 3
  });
});

// Phase 16 (D-106, "make all spells usable"): five more status effects, added
// so the SRD catalogue's debuff/control/divination spells have somewhere
// real to land. poisoned/restrained reuse burning/stunned's exact shape
// (already covered above) under a second flavor name, so these tests focus
// on the three genuinely new mechanics: blinded, exposed, charmed.

describe("WaveSystem integration: blinded", () => {
  it("rolls a blinded enemy's own attack with disadvantage", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const grunt = t1.spawned[0];
    grunt.position = { x: 3, y: 0 };
    grunt.applyStatus("blinded", 1);
    // Not the exit tile itself (a goal tile is always enterable regardless of
    // isBlocked, so a hero standing exactly on it can never fully seal a
    // route) — one tile short of it instead, so blocking it genuinely boxes
    // the grunt in with no detour (Enemy AI/Movement Redesign §1, D-139).
    const heroTarget: Combatant = { id: "hero1", position: { x: 4, y: 0 }, health: 20, armorClass: 10 };

    const t2 = ws.tickEnemyPhase({ heroTargets: [heroTarget], isBlocked: (p) => p.x === 4 && p.y === 0 });
    expect(t2.attacks).toHaveLength(1);
    expect(spy).toHaveBeenCalledWith("disadvantage");
  });
});

describe("Enemy: exposed", () => {
  it("lowers effective Armor Class while active", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    const baseAC = enemy.armorClass;
    enemy.applyStatus("exposed", 2);
    expect(enemy.armorClass).toBe(baseAC - 2);
    enemy.tickStatuses();
    enemy.tickStatuses();
    expect(enemy.armorClass).toBe(baseAC); // expired, AC restored
  });
});

describe("WaveSystem integration: charmed", () => {
  it("redirects a charmed enemy's attack to another enemy in range instead of a hero", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const wave: WaveDefinition = {
      id: "w",
      spawns: [
        { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 },
        { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 },
      ],
      completionGold: 0,
    };
    const ws = new WaveSystem(map, pf, [wave], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase(); // the second group's spawn tile is occupied, so only one spawns
    expect(t1.spawned).toHaveLength(1);
    const a = t1.spawned[0];
    const t2 = ws.tickEnemyPhase(); // the tile is clear now; the second grunt spawns
    expect(t2.spawned).toHaveLength(1);
    const b = t2.spawned[0];
    a.position = { x: 2, y: 0 };
    b.position = { x: 3, y: 0 }; // adjacent, within the grunt's melee range
    a.applyStatus("charmed", 1);
    const heroTarget: Combatant = { id: "hero1", position: { x: 5, y: 0 }, health: 20, armorClass: 10 };

    const t3 = ws.tickEnemyPhase({ heroTargets: [heroTarget] });
    const redirected = t3.attacks.find((ev) => ev.enemy === a);
    expect(redirected).toBeDefined();
    expect(redirected?.target.id).toBe(b.id); // attacked its ally, not the hero
  });
});

// Phase 17 (D-108, weapons/armor/weapon mastery): two more effects, both
// reusing "blinded"'s exact attackRollDisadvantage shape — the Sap and
// Topple weapon-mastery properties' real mechanical hooks.

describe("Enemy status effect bookkeeping: sapped/toppled", () => {
  it("applies and expires sapped like any other timed status", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    expect(enemy.hasStatus("sapped")).toBe(false);
    enemy.applyStatus("sapped", 1);
    expect(enemy.hasStatus("sapped")).toBe(true);
    enemy.tickStatuses();
    expect(enemy.hasStatus("sapped")).toBe(false);
  });

  it("applies and expires toppled like any other timed status", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    enemy.applyStatus("toppled", 2);
    expect(enemy.hasStatus("toppled")).toBe(true);
    enemy.tickStatuses();
    expect(enemy.hasStatus("toppled")).toBe(true);
    enemy.tickStatuses();
    expect(enemy.hasStatus("toppled")).toBe(false);
  });
});

describe("WaveSystem integration: sapped/toppled roll the enemy's own attack with disadvantage", () => {
  it.each(["sapped", "toppled"] as const)("%s", (statusId) => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const grunt = t1.spawned[0];
    grunt.position = { x: 3, y: 0 };
    grunt.applyStatus(statusId, 1);
    // Not the exit tile itself — see the blinded test above for why.
    const heroTarget: Combatant = { id: "hero1", position: { x: 4, y: 0 }, health: 20, armorClass: 10 };

    const t2 = ws.tickEnemyPhase({ heroTargets: [heroTarget], isBlocked: (p) => p.x === 4 && p.y === 0 });
    expect(t2.attacks).toHaveLength(1);
    expect(spy).toHaveBeenCalledWith("disadvantage");
  });
});

// D-124: "frightened" reuses "blinded"/"sapped"/"toppled"'s exact
// attackRollDisadvantage shape — the Barbarian's Intimidating Presence's
// real hookup (`BattleScene.applyIntimidatingPresence`, not unit-testable
// here, same standing Phaser limitation as every other BattleScene-only
// mechanic). This file's job is proving the STATUS ITSELF behaves like
// every other timed effect and rolls the afflicted enemy's own attack with
// disadvantage, exactly like sapped/toppled above.

describe("Enemy status effect bookkeeping: frightened (D-124)", () => {
  it("applies and expires like any other timed status", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    expect(enemy.hasStatus("frightened")).toBe(false);
    enemy.applyStatus("frightened", 2);
    expect(enemy.hasStatus("frightened")).toBe(true);
    enemy.tickStatuses();
    expect(enemy.hasStatus("frightened")).toBe(true);
    enemy.tickStatuses();
    expect(enemy.hasStatus("frightened")).toBe(false);
  });
});

describe("WaveSystem integration: frightened rolls the enemy's own attack with disadvantage", () => {
  it("rolls with disadvantage while frightened", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S....X"]));
    const pf = new PathfindingSystem(map);
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const grunt = t1.spawned[0];
    grunt.position = { x: 3, y: 0 };
    grunt.applyStatus("frightened", 1);
    // Not the exit tile itself — see the blinded test above for why.
    const heroTarget: Combatant = { id: "hero1", position: { x: 4, y: 0 }, health: 20, armorClass: 10 };

    const t2 = ws.tickEnemyPhase({ heroTargets: [heroTarget], isBlocked: (p) => p.x === 4 && p.y === 0 });
    expect(t2.attacks).toHaveLength(1);
    expect(spy).toHaveBeenCalledWith("disadvantage");
  });
});
