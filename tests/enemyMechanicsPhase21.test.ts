import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { CombatSystem, type Combatant } from "../src/game/systems/CombatSystem";
import { Enemy } from "../src/game/entities/Enemy";
import { getEnemyDefinition } from "../src/game/data/enemies";
import type { WaveDefinition, WaveSpawnGroup } from "../src/game/data/waves";
import type { GridPosition } from "../src/game/systems/GridSystem";
import type { StatusEffectId } from "../src/game/data/statusEffects";

/**
 * Phase 21 (D-112): behavioural tests for the second wave of enemy
 * archetypes — Berserker (enrage), Lifedrinker, Splitter/Carrier
 * (onDeathSpawns), Explosive (onDeathExplode), Shielded (damageShieldHp),
 * Gold Thief (goldTheftAmount — covered separately in tests/economy.test.ts,
 * since the actual gold deduction is a BattleScene-layer post-process),
 * Teleporter, Mimic, Healer (+ the Healer/Debuffer hybrid), Anti-caster,
 * Swarm, and the Multi-Phase Boss. Roster/data-only sanity checks live in
 * tests/enemyRoster.test.ts; this file exercises the mechanics themselves
 * through WaveSystem, same style as tests/enemyMechanics.test.ts (Phase 20).
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

/** A Combatant that records every `applyStatus` call, for inflictsStatusOnHit tests. */
function trackingHero(id: string, position: GridPosition): Combatant & { applied: { id: StatusEffectId; durationTurns: number }[] } {
  const applied: { id: StatusEffectId; durationTurns: number }[] = [];
  return {
    id,
    position,
    health: 20,
    armorClass: 10,
    savingThrowBonus: 0,
    applyStatus: (statusId: StatusEffectId, durationTurns: number) => applied.push({ id: statusId, durationTurns }),
    applied,
  };
}

// ----- Berserker: enrage -----------------------------------------------------

describe("Berserker enemies (def.enrage)", () => {
  it("adds no bonus at full health, and more bonus the lower its HP falls", () => {
    const { map, pf } = setup(["S.X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "frenzied-cultist", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(15),
    });
    ws.startWave(0);
    // A hero already adjacent to the spawn tile on the VERY FIRST tick, so
    // the enemy attacks immediately rather than getting a free, targetless
    // move (its own 2-tile movementTiles would otherwise reach this short
    // lane's exit before a hero ever enters the picture).
    const hero = heroAt("hero-1", { x: 1, y: 0 });
    // A 1-wide lane, so blocking the hero's own tile seals the only route —
    // forced melee (Enemy AI/Movement Redesign §1, D-139).
    const isBlocked = (p: GridPosition) => p.x === 1 && p.y === 0;
    const full = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked });
    const enemy = full.spawned[0];
    expect(full.attacks[0].result.damageDealt).toBe(3); // base attackDamage, no bonus yet

    enemy.health = 4; // 60% missing of 10 -> floor(60/25) = 2 steps
    const hero2 = heroAt("hero-2", { x: 1, y: 0 });
    const wounded = ws.tickEnemyPhase({ heroTargets: [hero2], isBlocked });
    expect(wounded.attacks[0].result.damageDealt).toBe(3 + 2); // +1 dmg/step * 2 steps
  });
});

// ----- Lifedrinker: heals itself off a landed hit ---------------------------

describe("Lifedrinker enemies (def.lifedrinkPercent)", () => {
  it("heals itself for a percent of the damage it lands, capped at maxHealth", () => {
    const { map, pf } = setup(["S.X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "bloodwisp", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(15),
    });
    ws.startWave(0);
    // Spawn AND attack on the same first tick (a hero already adjacent), so
    // the enemy never gets a free, targetless move that could otherwise
    // carry it straight to this short lane's exit.
    const hero = heroAt("hero-1", { x: 1, y: 0 });
    // A 1-wide lane, so blocking the hero's own tile seals the only route —
    // forced melee (Enemy AI/Movement Redesign §1, D-139).
    const isBlocked = (p: GridPosition) => p.x === 1 && p.y === 0;
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked });
    const enemy = t1.spawned[0]; // maxHealth 8
    enemy.health = 2; // wounded, so the heal-cap-at-maxHealth case isn't the one exercised here
    const t2 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked });
    expect(t2.attacks[0].result.damageDealt).toBe(3); // bloodwisp's attackDamage
    // lifedrinkPercent 50% of 3 = 1 (floored)
    expect(t2.lifedrinks).toHaveLength(1);
    expect(t2.lifedrinks[0].healed).toBe(1);
    expect(enemy.health).toBe(3);
  });

  it("never heals a Swarm — a swarm can't regain HP", () => {
    const { map, pf } = setup(["S.X"]);
    const hybridDef = { ...getEnemyDefinition("bloodwisp"), swarm: true };
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "bloodwisp", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(15),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const enemy = t1.spawned[0];
    // Swap in a swarm-flagged copy of the same definition to isolate the rule.
    Object.defineProperty(enemy, "def", { value: hybridDef });
    enemy.health = 2;
    const hero = heroAt("hero-1", { x: 1, y: 0 });
    const t2 = ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(t2.lifedrinks).toHaveLength(0);
    expect(enemy.health).toBe(2);
  });
});

// ----- Splitter/Carrier + Explosive: death triggers -------------------------

describe("resolveDeathTriggers: Splitter/Carrier (def.onDeathSpawns)", () => {
  it("spawns weaker copies adjacent to where it died", () => {
    const { map, pf } = setup(["S.........X", "..........."]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "ooze-splitter", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const splitter = t1.spawned[0];
    splitter.health = 0; // defeated by some means
    // The real flow (BattleScene.resolveDeaths) always calls removeDefeated()
    // BEFORE resolveDeathTriggers — do the same here so `ws.enemies` reflects
    // reality (the splitter itself is gone before its replacements arrive).
    const removed = ws.removeDefeated();
    const report = ws.resolveDeathTriggers(removed, []);
    expect(report.deathSpawns).toHaveLength(1);
    expect(report.deathSpawns[0].spawned).toHaveLength(2);
    expect(report.deathSpawns[0].spawned.every((s) => s.def.id === "living-splinter")).toBe(true);
    expect(report.spawned).toHaveLength(2);
    expect(ws.enemies.length).toBe(2); // splitter already removed; 2 new arrivals only
  });

  it("spawns fewer (never crashes) when boxed in, and never lands on a living hero", () => {
    // A wide-open 3-row area so a centrally-placed enemy has all 4 orthogonal
    // neighbors walkable, isolating "one tile occupied by a hero" as the only
    // reason fewer than 4 spawn.
    const { map, pf } = setup(["...........", "S.........X", "..........."]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "the-husk", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const husk = t1.spawned[0];
    husk.position = { x: 5, y: 1 }; // dead center — all 4 neighbors walkable
    husk.health = 0;
    const heroOnTile = heroAt("hero-1", { x: 6, y: 1 }); // one of the 4 neighbors
    const removed = ws.removeDefeated();
    const report = ws.resolveDeathTriggers(removed, [heroOnTile]);
    // the-husk spawns up to 4 living-splinters on the 4 orthogonal tiles, but
    // one is occupied by a hero, so only 3 land.
    expect(report.deathSpawns[0].spawned).toHaveLength(3);
    expect(report.deathSpawns[0].spawned.some((s) => s.position.x === heroOnTile.position.x && s.position.y === heroOnTile.position.y)).toBe(false);
  });
});

describe("resolveDeathTriggers: Explosive (def.onDeathExplode)", () => {
  it("hits every hero within radius with a flat, unrolled AoE burst", () => {
    const { map, pf } = setup(["S.........X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "bomber-beetle", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const beetle = t1.spawned[0];
    beetle.health = 0;
    const near = heroAt("near", { x: beetle.position.x + 1, y: beetle.position.y }); // radius 2
    const far = heroAt("far", { x: beetle.position.x + 5, y: beetle.position.y }); // out of radius
    const report = ws.resolveDeathTriggers([beetle], [near, far]);
    expect(report.explosions).toHaveLength(1);
    expect(report.explosions[0].hits).toHaveLength(1);
    expect(report.explosions[0].hits[0].target.id).toBe("near");
    expect(report.explosions[0].hits[0].result.damageDealt).toBe(8); // bomber-beetle's onDeathExplode.damage
  });

  it("resolves nothing for a defeated enemy with no death trigger fields", () => {
    const { map, pf } = setup(["S.X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const grunt = t1.spawned[0];
    grunt.health = 0;
    const report = ws.resolveDeathTriggers([grunt], []);
    expect(report.spawned).toHaveLength(0);
    expect(report.deathSpawns).toHaveLength(0);
    expect(report.explosions).toHaveLength(0);
  });
});

// ----- Shielded: a damage-absorbing ward ------------------------------------

describe("Shielded enemies (def.damageShieldHp, Combatant.absorbDamage)", () => {
  it("absorbs damage before real HP loss, then lets damage through once broken", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("warded-sentinel"), { x: 0, y: 0 }); // shield 8, HP 10
    expect(enemy.shieldHpRemaining).toBe(8);
    const random = RandomService.fixed(15);
    const r1 = CombatSystem.applyAttack(enemy, { rangeTiles: 1, damage: 5, attackBonus: 10 }, random);
    expect(r1.damageDealt).toBe(0); // fully absorbed
    expect(enemy.shieldHpRemaining).toBe(3);
    expect(enemy.health).toBe(10); // untouched

    const r2 = CombatSystem.applyAttack(enemy, { rangeTiles: 1, damage: 5, attackBonus: 10 }, random);
    expect(enemy.shieldHpRemaining).toBe(0);
    expect(r2.damageDealt).toBe(2); // 3 shield left absorbs 3, 2 gets through
    expect(enemy.health).toBe(8);

    const r3 = CombatSystem.applyAttack(enemy, { rangeTiles: 1, damage: 5, attackBonus: 10 }, random);
    expect(r3.damageDealt).toBe(5); // shield gone — full damage now
    expect(enemy.health).toBe(3);
  });

  it("a shieldless enemy's absorbDamage is a pure pass-through no-op", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    expect(enemy.shieldHpRemaining).toBe(0);
    expect(enemy.absorbDamage(5)).toBe(5);
  });
});

// ----- Gold Thief: field presence only (the actual deduction is BattleScene-layer, see tests/economy.test.ts) -----

describe("Gold Thief enemies (def.goldTheftAmount)", () => {
  it("carries a positive theft amount and a landed hit is reported normally", () => {
    const { map, pf } = setup(["S.X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "pilferer", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(15),
    });
    ws.startWave(0);
    const hero = heroAt("hero-1", { x: 1, y: 0 });
    // A 1-wide lane, so blocking the hero's own tile seals the only route —
    // forced melee (Enemy AI/Movement Redesign §1, D-139).
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 1 && p.y === 0 }); // spawn + attack, same tick
    expect(t1.spawned[0].def.goldTheftAmount).toBeGreaterThan(0);
    expect(t1.attacks).toHaveLength(1);
    expect(t1.attacks[0].result.roll?.hit).toBe(true);
  });
});

// ----- Teleporter: jumps toward the exit ------------------------------------

describe("Teleporter enemies (def.teleportsEveryNTurns)", () => {
  it("jumps a real distance toward the exit only once the interval elapses", () => {
    const { map, pf } = setup(["S..........X"]); // long lane; blink-stalker moves 2/phase normally
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "blink-stalker", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    ws.tickEnemyPhase(); // spawn
    const t2 = ws.tickEnemyPhase(); // normal move (interval 3, not due)
    expect(t2.teleports).toHaveLength(0);
    expect(t2.moves).toHaveLength(1);
    const posBeforeT3 = { ...t2.moves[0].to };
    const t3 = ws.tickEnemyPhase(); // interval elapses on tick 3
    expect(t3.teleports).toHaveLength(1);
    const jumped = t3.teleports[0].to.x - posBeforeT3.x;
    expect(jumped).toBeGreaterThan(2); // further than its own 2-tile movementTiles
    expect(t3.attacks).toHaveLength(0); // teleporting instead of attacking/advancing normally
  });

  it("does nothing (no crash) once already at an exit", () => {
    const { map, pf } = setup(["SX"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "blink-stalker", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    expect(() => ws.tickEnemyPhase()).not.toThrow();
  });
});

// ----- Mimic: disguised until a hero gets adjacent --------------------------

describe("Mimic enemies (def.mimicDisguise)", () => {
  it("stays disguised (unrevealed, no action) until a hero moves adjacent", () => {
    const { map, pf } = setup(["S.........X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "mimic-chest", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const mimic = t1.spawned[0];
    expect(mimic.isRevealed).toBe(false);
    const far = heroAt("far", { x: mimic.position.x + 5, y: mimic.position.y });
    const t2 = ws.tickEnemyPhase({ heroTargets: [far] });
    expect(mimic.isRevealed).toBe(false);
    expect(t2.mimicReveals).toHaveLength(0);
    expect(t2.moves).toHaveLength(0); // disguised — takes no action while hidden
  });

  it("reveals itself the instant a hero moves adjacent, and acts the same phase", () => {
    const { map, pf } = setup(["S.X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "mimic-chest", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(15),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const mimic = t1.spawned[0];
    const adjacent = heroAt("hero-1", { x: mimic.position.x + 1, y: mimic.position.y });
    // A 1-wide lane, so blocking the hero's own tile seals the only route —
    // forced melee (Enemy AI/Movement Redesign §1, D-139).
    const t2 = ws.tickEnemyPhase({
      heroTargets: [adjacent],
      isBlocked: (p) => p.x === adjacent.position.x && p.y === adjacent.position.y,
    });
    expect(mimic.isRevealed).toBe(true);
    expect(t2.mimicReveals).toHaveLength(1);
    expect(t2.attacks).toHaveLength(1); // springs to life and attacks immediately
  });
});

// ----- Healer + the Healer/Debuffer hybrid ----------------------------------

describe("Healer enemies (def.healAura)", () => {
  it("heals a nearby wounded ally each phase, never itself, never past maxHealth", () => {
    const { map, pf } = setup(["S.S.........X"]); // battle-medic at (0,0), grunt at (2,0)
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "battle-medic", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.fixed() },
    );
    ws.startWave(0);
    // Pin everyone in place from the very first tick — otherwise both
    // enemies would take their own free, targetless move before either
    // health is adjusted, possibly drifting outside the heal radius.
    const t1 = ws.tickEnemyPhase({ isBlocked: () => true });
    const medic = t1.spawned.find((e) => e.def.id === "battle-medic")!;
    const grunt = t1.spawned.find((e) => e.def.id === "grunt")!;
    grunt.health = 1; // 6 max, badly wounded
    const t2 = ws.tickEnemyPhase({ isBlocked: () => true });
    expect(t2.healEvents).toHaveLength(1);
    expect(t2.healEvents[0].ally.def.id).toBe("grunt");
    expect(grunt.health).toBe(1 + 3); // battle-medic's healAmount
    expect(medic.health).toBe(medic.def.maxHealth); // the medic never heals itself
  });

  it("does not heal a fully-healthy ally", () => {
    const { map, pf } = setup(["S.S.........X"]);
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "battle-medic", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.fixed() },
    );
    ws.startWave(0);
    ws.tickEnemyPhase();
    const t2 = ws.tickEnemyPhase({ isBlocked: () => true });
    expect(t2.healEvents).toHaveLength(0);
  });
});

describe("Healer/Debuffer hybrid (def.healAura + def.inflictsStatusOnHit)", () => {
  it("both heals allies AND poisons a hero it hits, same enemy", () => {
    const { map, pf } = setup(["S.S.........X"]);
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "plague-warden", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.fixed(15) },
    );
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const warden = t1.spawned.find((e) => e.def.id === "plague-warden")!;
    const grunt = t1.spawned.find((e) => e.def.id === "grunt")!;
    grunt.health = 1;
    warden.position = { x: 5, y: 0 };
    const hero = trackingHero("hero-1", { x: warden.position.x + 1, y: warden.position.y });
    const t2 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: () => true });
    expect(t2.healEvents.some((e) => e.healer === warden)).toBe(true);
    expect(t2.attacks.some((a) => a.enemy === warden)).toBe(true);
    expect(hero.applied).toContainEqual({ id: "poisoned", durationTurns: 3 });
  });
});

// ----- Anti-caster -----------------------------------------------------------

describe("Anti-caster enemies (def.inflictsStatusOnHit: silenced)", () => {
  it("silences a hero it lands a hit on", () => {
    const { map, pf } = setup(["S..........X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "hexbinder", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(15),
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const enemy = t1.spawned[0];
    enemy.position = { x: 5, y: 0 }; // pin it, ignoring wherever its free move landed
    const hero = trackingHero("hero-1", { x: enemy.position.x + 2, y: enemy.position.y }); // range 2
    const t2 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: () => true });
    expect(t2.attacks).toHaveLength(1);
    expect(hero.applied).toContainEqual({ id: "silenced", durationTurns: 2 });
  });

  it("does not inflict anything on a miss", () => {
    const { map, pf } = setup(["S..........X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "hexbinder", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(1), // natural 1 always misses
    });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase();
    const enemy = t1.spawned[0];
    enemy.position = { x: 5, y: 0 };
    const hero = trackingHero("hero-1", { x: enemy.position.x + 2, y: enemy.position.y });
    const t2 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: () => true });
    expect(t2.attacks).toHaveLength(1);
    expect(t2.attacks[0].result.roll?.hit).toBe(false);
    expect(hero.applied).toHaveLength(0);
  });
});

// ----- Swarm: verified against the real SRD 5.2.1/2024 "Swarm" trait -------

describe("Swarm enemies (def.swarm)", () => {
  it("deals half damage once Bloodied (half HP or fewer)", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("rat-swarm"), { x: 0, y: 0 }); // maxHealth 12, attackDamage 4
    expect(enemy.attackDamage).toBe(4);
    enemy.health = 6; // exactly half — Bloodied
    expect(enemy.attackDamage).toBe(2);
    enemy.health = 7; // not yet Bloodied
    expect(enemy.attackDamage).toBe(4);
  });

  it("is immune to charmed/restrained/stunned/toppled (the real SRD condition list, mapped to this game's status ids)", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("rat-swarm"), { x: 0, y: 0 });
    for (const id of ["charmed", "restrained", "stunned", "toppled"] as const) {
      enemy.applyStatus(id, 5);
      expect(enemy.hasStatus(id)).toBe(false);
    }
  });

  it("is NOT immune to burning/poisoned/slowed/blinded/exposed/sapped (not in the real SRD list)", () => {
    const enemy = new Enemy("e#1", getEnemyDefinition("rat-swarm"), { x: 0, y: 0 });
    for (const id of ["burning", "poisoned", "slowed", "blinded", "exposed", "sapped"] as const) {
      enemy.applyStatus(id, 5);
      expect(enemy.hasStatus(id)).toBe(true);
    }
  });

  it("lands exactly on another living enemy's tile instead of backing off (real SRD 'occupies another creature's space')", () => {
    const { map, pf } = setup(["S.S..........X", ".............."]);
    const ws = new WaveSystem(
      map,
      pf,
      [
        wave([
          { enemyId: "rat-swarm", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 0 },
          { enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1, spawnIndex: 1 },
        ]),
      ],
      { startingIntegrity: 20, random: RandomService.fixed() },
    );
    ws.startWave(0);
    // Pin both at their spawn tick so no free movement happens yet, then
    // place them precisely: the swarm 4 tiles (its full movementTiles,
    // D-172) behind the grunt, directly on the grunt's own path to the exit.
    const t1 = ws.tickEnemyPhase({ isBlocked: () => true });
    const swarm = t1.spawned.find((e) => e.def.id === "rat-swarm")!;
    const grunt = t1.spawned.find((e) => e.def.id === "grunt")!;
    swarm.position = { x: 3, y: 0 };
    grunt.position = { x: 7, y: 0 };
    const gruntPosBefore = { ...grunt.position };

    const t2 = ws.tickEnemyPhase(); // normal movement, no isBlocked
    // The swarm's own 4-tile movement budget lands it exactly where the
    // grunt was standing — it was never backed off by the occupancy check.
    expect(swarm.position).toEqual(gruntPosBefore);
    expect(t2.moves.find((m) => m.enemy === swarm)?.path).toHaveLength(4);
  });
});

// ----- Multi-Phase Boss ------------------------------------------------------

describe("Multi-Phase Boss (def.phaseChange)", () => {
  it("enters its next phase exactly once, at or below the HP threshold, and the override sticks", () => {
    const { map, pf } = setup(["S.X"]);
    const ws = new WaveSystem(map, pf, [wave([{ enemyId: "sundered-king", count: 1, startTurn: 1, intervalTurns: 1 }])], {
      startingIntegrity: 20,
      random: RandomService.fixed(15),
    });
    ws.startWave(0);
    // A hero already adjacent on the very first tick, so the king attacks
    // immediately rather than getting a free, targetless move that could
    // otherwise carry it straight to this short lane's exit.
    const hero = heroAt("hero-1", { x: 1, y: 0 });
    // A 1-wide lane, so blocking the hero's own tile seals the only route —
    // forced melee (Enemy AI/Movement Redesign §1, D-139).
    const isBlocked = (p: GridPosition) => p.x === 1 && p.y === 0;
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked });
    const king = t1.spawned[0]; // maxHealth 60, attackDamage 5, no aoeAttack yet
    expect(king.hasEnteredNextPhase).toBe(false);
    expect(king.attackDamage).toBe(5);

    king.health = 30; // exactly 50% — crosses the threshold
    const t2 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked });
    expect(t2.phaseChanges).toHaveLength(1);
    expect(king.hasEnteredNextPhase).toBe(true);
    expect(king.attackDamage).toBe(9); // the override's new attackDamage
    expect(t2.attacks[0].result.damageDealt).toBe(9); // takes effect the SAME phase it crosses

    // Doesn't re-fire on a later phase.
    const t3 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked });
    expect(t3.phaseChanges).toHaveLength(0);
  });

  it("does not affect other instances of the same enemy TYPE, or the shared definition object", () => {
    const def = getEnemyDefinition("sundered-king");
    const a = new Enemy("a#1", def, { x: 0, y: 0 });
    const b = new Enemy("b#1", def, { x: 0, y: 0 });
    a.enterNextPhase(def.phaseChange!.overrides);
    expect(a.attackDamage).toBe(9);
    expect(b.attackDamage).toBe(5); // untouched
    expect(def.attackDamage).toBe(5); // shared def itself untouched
  });
});
