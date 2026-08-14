import { describe, it, expect, vi } from "vitest";
import { CombatSystem, type Combatant } from "../src/game/systems/CombatSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import type { WaveDefinition } from "../src/game/data/waves";

/**
 * Phase 4 combat tests, updated for Phase 13.1 (DECISIONS D-086): combat now
 * rolls a d20 + attackBonus against the target's Armor Class instead of
 * deterministically subtracting a flat defense value. `RandomService.fixed()`
 * makes every roll's outcome an explicit, readable choice per test — see
 * CombatSystem's module comment for why 15 is a safe "always hits, never
 * crits" default across this project's data.
 */

const at = (id: string, x: number, y: number, health: number, armorClass = 10): Combatant => ({
  id,
  position: { x, y },
  health,
  armorClass,
});

describe("CombatSystem range and targeting", () => {
  it("uses Manhattan distance and excludes the attacker's own tile", () => {
    expect(CombatSystem.range({ x: 0, y: 0 }, { x: 2, y: 1 })).toBe(3);
    expect(CombatSystem.isInRange({ x: 0, y: 0 }, { x: 0, y: 0 }, 1)).toBe(false);
    expect(CombatSystem.isInRange({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)).toBe(true);
    expect(CombatSystem.isInRange({ x: 0, y: 0 }, { x: 2, y: 0 }, 1)).toBe(false);
  });

  it("lists only living candidates within range", () => {
    const from = { x: 0, y: 0 };
    const cands = [at("a", 1, 0, 5), at("b", 3, 0, 5), at("dead", 1, 0, 0)];
    const inRange = CombatSystem.targetsInRange(from, 2, cands);
    expect(inRange.map((c) => c.id)).toEqual(["a"]); // b too far, dead excluded
  });

  it("chooses the nearest target, breaking ties by lowest health then id", () => {
    const from = { x: 0, y: 0 };
    // Two at distance 1 (tie) -> lower health wins.
    const near = [at("z", 1, 0, 5), at("y", 0, 1, 3)];
    expect(CombatSystem.chooseTarget(from, 3, near)?.id).toBe("y");
    // Distance decides over health: closer full-health beats far low-health.
    const mixed = [at("far", 3, 0, 1), at("close", 1, 0, 9)];
    expect(CombatSystem.chooseTarget(from, 3, mixed)?.id).toBe("close");
    expect(CombatSystem.chooseTarget(from, 3, [])).toBeNull();
  });
});

describe("CombatSystem dice resolution", () => {
  it("hits when d20 + attackBonus meets or beats the target's AC", () => {
    const roll = CombatSystem.rollAttack(15, 3, RandomService.fixed(12)); // 12+3=15 >= 15
    expect(roll.hit).toBe(true);
    expect(roll.critical).toBe(false);
    expect(roll.total).toBe(15);
  });

  it("misses when the total falls short of AC", () => {
    const roll = CombatSystem.rollAttack(15, 3, RandomService.fixed(10)); // 13 < 15
    expect(roll.hit).toBe(false);
  });

  it("a natural 20 always hits and is a critical, even against a very high AC", () => {
    const roll = CombatSystem.rollAttack(30, 0, RandomService.fixed(20));
    expect(roll.hit).toBe(true);
    expect(roll.critical).toBe(true);
  });

  it("a natural 1 always misses, even with a huge bonus against a very low AC", () => {
    const roll = CombatSystem.rollAttack(1, 20, RandomService.fixed(1));
    expect(roll.hit).toBe(false);
    expect(roll.fumble).toBe(true);
  });

  it("computeDamage doubles on a critical hit and never goes negative", () => {
    expect(CombatSystem.computeDamage(4, false)).toBe(4);
    expect(CombatSystem.computeDamage(4, true)).toBe(8);
    expect(CombatSystem.computeDamage(-3)).toBe(0);
  });

  it("Phase 13.11 (D-096): a lowered critThreshold (Champion's Improved/Superior Critical) crits below a natural 20", () => {
    const normal = CombatSystem.rollAttack(15, 0, RandomService.fixed(19));
    expect(normal.critical).toBe(false); // default threshold (20) — a 19 is just a normal hit
    const champion = CombatSystem.rollAttack(15, 0, RandomService.fixed(19), "normal", 19);
    expect(champion.critical).toBe(true);
    expect(champion.hit).toBe(true);
  });

  it("critThreshold never turns a natural 1 into a crit", () => {
    const roll = CombatSystem.rollAttack(1, 20, RandomService.fixed(1), "normal", 18);
    expect(roll.critical).toBe(false);
    expect(roll.fumble).toBe(true);
    expect(roll.hit).toBe(false);
  });

  it("applyAttack: a hit deals full damage, a miss deals none", () => {
    const hit = at("h", 1, 0, 10, 12);
    const r = CombatSystem.applyAttack(hit, { rangeTiles: 1, damage: 4, attackBonus: 5 }, RandomService.fixed(15));
    expect(r.roll?.hit).toBe(true);
    expect(r.damageDealt).toBe(4);
    expect(hit.health).toBe(6);

    const miss = at("m", 1, 0, 10, 18);
    const r2 = CombatSystem.applyAttack(miss, { rangeTiles: 1, damage: 4, attackBonus: 0 }, RandomService.fixed(10));
    expect(r2.roll?.hit).toBe(false);
    expect(r2.damageDealt).toBe(0);
    expect(miss.health).toBe(10);
  });

  it("a critical hit doubles the damage dealt", () => {
    const target = at("t", 1, 0, 10, 8);
    const r = CombatSystem.applyAttack(target, { rangeTiles: 1, damage: 3, attackBonus: 0 }, RandomService.fixed(20));
    expect(r.roll?.critical).toBe(true);
    expect(r.damageDealt).toBe(6);
    expect(target.health).toBe(4);
  });

  it("applyAttack honors AttackProfile.critThreshold (Phase 13.11, D-096)", () => {
    const target = at("t", 1, 0, 10, 8);
    const r = CombatSystem.applyAttack(
      target,
      { rangeTiles: 1, damage: 3, attackBonus: 0, critThreshold: 19 },
      RandomService.fixed(19),
    );
    expect(r.roll?.critical).toBe(true);
    expect(r.damageDealt).toBe(6);
  });

  it("autoHit skips the roll entirely and always lands for full damage", () => {
    const target = at("t", 1, 0, 10, 99); // AC so high a rolled attack could never hit
    const r = CombatSystem.applyAttack(
      target,
      { rangeTiles: 1, damage: 3, attackBonus: 0, autoHit: true },
      RandomService.fixed(1), // even a natural 1 doesn't matter
    );
    expect(r.roll).toBeUndefined();
    expect(r.damageDealt).toBe(3);
    expect(target.health).toBe(7);
  });

  it("applies damage, reporting a defeat only on the transition to 0 HP", () => {
    const target = at("t", 1, 0, 5);
    const random = RandomService.fixed(15); // always hits at AC 10
    const r1 = CombatSystem.applyAttack(target, { rangeTiles: 1, damage: 3, attackBonus: 0 }, random);
    expect(r1.damageDealt).toBe(3);
    expect(target.health).toBe(2);
    expect(r1.defeated).toBe(false);

    CombatSystem.applyAttack(target, { rangeTiles: 1, damage: 1, attackBonus: 0 }, random);
    expect(target.health).toBe(1);
    const r3 = CombatSystem.applyAttack(target, { rangeTiles: 1, damage: 3, attackBonus: 0 }, random);
    expect(target.health).toBe(0);
    expect(r3.defeated).toBe(true); // exactly the killing blow
  });

  it("does nothing to an already-defeated target (removal happens once)", () => {
    const target = at("t", 1, 0, 2);
    const random = RandomService.fixed(15);
    CombatSystem.applyAttack(target, { rangeTiles: 1, damage: 5, attackBonus: 0 }, random); // -> 0, defeated
    const again = CombatSystem.applyAttack(target, { rangeTiles: 1, damage: 5, attackBonus: 0 }, random);
    expect(again.damageDealt).toBe(0);
    expect(again.defeated).toBe(false);
    expect(target.health).toBe(0);
  });
});

/**
 * D-127: nonmagical damage-type resistance (the real SRD Swarm trait,
 * previously not modeled — see `Enemy.isSwarm`'s comment). `RandomService
 * .fixed(15)` always hits at AC 10, same convention as every other
 * applyAttack test above.
 */
describe("CombatSystem damage-type resistance (D-127)", () => {
  const resistant = (id: string, health: number): Combatant => ({
    ...at(id, 1, 0, health),
    damageResistances: ["bludgeoning", "piercing", "slashing"],
  });

  it("halves (rounded down) a nonmagical matching-type hit", () => {
    const target = resistant("swarm", 20);
    const r = CombatSystem.applyAttack(
      target,
      { rangeTiles: 1, damage: 5, attackBonus: 0, damageType: "slashing" },
      RandomService.fixed(15),
    );
    expect(r.damageDealt).toBe(2); // floor(5 / 2)
    expect(target.health).toBe(18);
  });

  it("does not halve a magical matching-type hit (enchanted weapon / Boon of Irresistible Offense)", () => {
    const target = resistant("swarm", 20);
    const r = CombatSystem.applyAttack(
      target,
      { rangeTiles: 1, damage: 5, attackBonus: 0, damageType: "slashing", magical: true },
      RandomService.fixed(15),
    );
    expect(r.damageDealt).toBe(5);
  });

  it("does not resist an untyped attack (every spell, and a hero with no weapon equipped)", () => {
    const target = resistant("swarm", 20);
    const r = CombatSystem.applyAttack(target, { rangeTiles: 1, damage: 5, attackBonus: 0 }, RandomService.fixed(15));
    expect(r.damageDealt).toBe(5);
  });

  it("does not resist a non-matching damage type", () => {
    const target: Combatant = { ...at("t", 1, 0, 20), damageResistances: ["piercing"] };
    const r = CombatSystem.applyAttack(
      target,
      { rangeTiles: 1, damage: 5, attackBonus: 0, damageType: "slashing" },
      RandomService.fixed(15),
    );
    expect(r.damageDealt).toBe(5);
  });

  it("a non-resistant target is unaffected by a typed attack", () => {
    const target = at("t", 1, 0, 20);
    const r = CombatSystem.applyAttack(
      target,
      { rangeTiles: 1, damage: 5, attackBonus: 0, damageType: "slashing" },
      RandomService.fixed(15),
    );
    expect(r.damageDealt).toBe(5);
  });
});

describe("CombatSystem single- and area-attacks", () => {
  it("rejects an out-of-range single target (returns null)", () => {
    const target = at("t", 3, 0, 5);
    const miss = CombatSystem.attackSingle(
      { x: 0, y: 0 },
      target,
      { rangeTiles: 1, damage: 3, attackBonus: 0 },
      RandomService.fixed(15),
    );
    expect(miss).toBeNull();
    expect(target.health).toBe(5); // untouched
  });

  it("resolves a valid single target", () => {
    const target = at("t", 1, 0, 5, 10);
    const hit = CombatSystem.attackSingle(
      { x: 0, y: 0 },
      target,
      { rangeTiles: 1, damage: 4, attackBonus: 5 },
      RandomService.fixed(15),
    );
    expect(hit?.damageDealt).toBe(4);
    expect(target.health).toBe(1);
  });

  it("area attack strikes every enemy in range and no others", () => {
    const from = { x: 2, y: 2 };
    const cands = [
      at("adj1", 2, 1, 5),
      at("adj2", 3, 2, 5),
      at("far", 4, 4, 5),
    ];
    const results = CombatSystem.attackArea(
      from,
      cands,
      { rangeTiles: 1, damage: 2, attackBonus: 5 },
      RandomService.fixed(15),
    );
    expect(results.length).toBe(2);
    expect(cands.find((c) => c.id === "far")!.health).toBe(5); // untouched
    expect(cands.find((c) => c.id === "adj1")!.health).toBe(3);
  });
});

// ----- Enemy combat behaviour through WaveSystem -------------------------

function laneSystem(rows: string[], waves: WaveDefinition[], random: RandomService = RandomService.fixed()) {
  const map = new GameMap(parseMapRows("lane", "Lane", rows));
  const pf = new PathfindingSystem(map);
  const ws = new WaveSystem(map, pf, waves, { startingIntegrity: 20, random });
  ws.startWave(0);
  return ws;
}

const oneGrunt: WaveDefinition[] = [
  { id: "w", spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 },
];
const oneRunner: WaveDefinition[] = [
  { id: "w", spawns: [{ enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 },
];
const oneBlightcaller: WaveDefinition[] = [
  { id: "w", spawns: [{ enemyId: "blightcaller", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 },
];
const oneShadowfang: WaveDefinition[] = [
  { id: "w", spawns: [{ enemyId: "shadowfang", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 },
];

describe("WaveSystem enemy combat (melee vs ranged behaviour)", () => {
  it("a melee Grunt attacks an adjacent hero and holds position", () => {
    const ws = laneSystem(["S..X"], oneGrunt);
    const hero = at("h", 1, 0, 10); // one tile from the spawn at (0,0)
    const report = ws.tickEnemyPhase({
      heroTargets: [hero],
      isBlocked: (p) => p.x === 1 && p.y === 0,
    });
    expect(report.attacks.length).toBe(1);
    expect(report.moves.length).toBe(0); // it fought instead of moving
    expect(report.breaches.length).toBe(0);
    expect(hero.health).toBe(8); // grunt attackDamage 2, RandomService.fixed() guarantees a hit
    expect(ws.enemies[0].position).toEqual({ x: 0, y: 0 }); // held at spawn
  });

  it("a ranged Runner attacks a hero from two tiles away", () => {
    const ws = laneSystem(["S...X"], oneRunner);
    const hero = at("h", 2, 0, 10); // two tiles from the spawn at (0,0)
    const report = ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(report.attacks.length).toBe(1);
    expect(hero.health).toBe(9); // runner attackDamage 1, range 2
  });

  it("a save-based Blightcaller (Phase 13.10) forces a saving throw instead of a to-hit roll", () => {
    // RandomService.fixed() rolls a 15; the target's savingThrowBonus falls
    // back to 2 (unset here) -> total 17 beats Blightcaller's DC 12 -> the
    // save SUCCEEDS, so no damage lands despite the attack "connecting."
    const ws = laneSystem(["S...X"], oneBlightcaller);
    const hero = at("h", 2, 0, 10); // two tiles from the spawn, within range 2
    const report = ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(report.attacks.length).toBe(1);
    expect(hero.health).toBe(10); // saved — no damage
    expect(report.attacks[0].result.roll?.hit).toBe(false); // hit = the save FAILED
    expect(report.attacks[0].result.roll?.critical).toBe(false); // a save never crits here
  });

  it("a Blightcaller's forced save deals full damage on a failure (natural 1 always fails)", () => {
    const ws = laneSystem(["S...X"], oneBlightcaller, RandomService.fixed(1));
    const hero = at("h", 2, 0, 10);
    const report = ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(hero.health).toBe(7); // blightcaller attackDamage 3
    expect(report.attacks[0].result.roll?.hit).toBe(true);
  });

  it("a target's own savingThrowBonus can resist a Blightcaller that a lower bonus would not", () => {
    // total = 10 (fixed roll) + bonus; DC is 12, so bonus 2 fails (12) but bonus 3 succeeds (13).
    const ws1 = laneSystem(["S...X"], oneBlightcaller, RandomService.fixed(10));
    const weakHero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10, savingThrowBonus: 1 };
    ws1.tickEnemyPhase({ heroTargets: [weakHero] });
    expect(weakHero.health).toBeLessThan(10); // 10+1=11 < DC 12 -> fails, takes damage

    const ws2 = laneSystem(["S...X"], oneBlightcaller, RandomService.fixed(10));
    const strongHero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10, savingThrowBonus: 3 };
    ws2.tickEnemyPhase({ heroTargets: [strongHero] });
    expect(strongHero.health).toBe(10); // 10+3=13 >= DC 12 -> succeeds, no damage
  });

  // D-124: a target's own savingThrowAdvantage/evasionHalvesFailedSave/
  // rerollFailedSave hooks, consumed by resolveSavingThrowAttack — every one
  // of them optional on `Combatant`, so a plain object (no real Hero needed)
  // proves the wiring the exact way `savingThrowBonus` already is above.
  it("Danger Sense's Advantage rolls the forced save with 'advantage' (Barbarian, D-124)", () => {
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S...X"], oneBlightcaller, random);
    const hero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10, savingThrowAdvantage: "advantage" };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(spy).toHaveBeenCalledWith("advantage");
  });

  it("without Danger Sense, the same forced save rolls 'normal'", () => {
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S...X"], oneBlightcaller, random);
    const hero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10 };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(spy).toHaveBeenCalledWith("normal");
  });

  it("Evasion halves (instead of fully applying) a Blightcaller's damage on a FAILED save (Rogue/Monk, D-124)", () => {
    const ws = laneSystem(["S...X"], oneBlightcaller, RandomService.fixed(1)); // nat 1 always fails
    const hero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10, evasionHalvesFailedSave: true };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(hero.health).toBe(9); // blightcaller attackDamage 3, halved (floored) to 1
  });

  it("without Evasion, the same failed save deals full damage", () => {
    const ws = laneSystem(["S...X"], oneBlightcaller, RandomService.fixed(1));
    const hero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10 };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(hero.health).toBe(7); // full 3 damage
  });

  it("Indomitable's rerollFailedSave is invoked on a failed save and rerolls it (Fighter, D-124)", () => {
    const random = RandomService.fixed(1); // nat 1 always fails, on every roll
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S...X"], oneBlightcaller, random);
    const rerollFailedSave = vi.fn(() => true);
    const hero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10, rerollFailedSave };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(rerollFailedSave).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(2); // the original roll, then the reroll
  });

  it("Indomitable is never offered on a save that already succeeded", () => {
    const random = RandomService.fixed(20); // nat 20 always succeeds
    const ws = laneSystem(["S...X"], oneBlightcaller, random);
    const rerollFailedSave = vi.fn(() => true);
    const hero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10, rerollFailedSave };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(rerollFailedSave).not.toHaveBeenCalled();
  });

  it("declining to reroll (e.g. no charges left) leaves the original failed save in place", () => {
    const random = RandomService.fixed(1);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S...X"], oneBlightcaller, random);
    const rerollFailedSave = vi.fn(() => false);
    const hero: Combatant = { id: "h", position: { x: 2, y: 0 }, health: 10, rerollFailedSave };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(rerollFailedSave).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1); // no reroll actually happened
    expect(hero.health).toBe(7); // still takes full damage
  });

  it("Elusive denies an enemy's own Advantage on the regular to-hit roll, not just forced saves (Rogue, D-124)", () => {
    // Shadowfang's stealthed first strike always lands with Advantage —
    // Elusive downgrades that to Normal for a target that has it.
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S.X"], oneShadowfang, random);
    const hero: Combatant = { id: "h", position: { x: 1, y: 0 }, health: 10, armorClass: 10, deniesAttackerAdvantage: () => true };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(spy).toHaveBeenCalledWith("normal");
  });

  it("without Elusive, the same stealthed ambush still rolls with Advantage", () => {
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S.X"], oneShadowfang, random);
    const hero: Combatant = { id: "h", position: { x: 1, y: 0 }, health: 10, armorClass: 10 };
    ws.tickEnemyPhase({ heroTargets: [hero] });
    expect(spy).toHaveBeenCalledWith("advantage");
  });

  it("Reckless Attack's grantsAttackerAdvantage rolls an ordinary Grunt's attack with 'advantage' (Barbarian, D-125)", () => {
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S..X"], oneGrunt, random);
    const hero: Combatant = { id: "h", position: { x: 1, y: 0 }, health: 10, armorClass: 10, grantsAttackerAdvantage: true };
    ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 1 && p.y === 0 });
    expect(spy).toHaveBeenCalledWith("advantage");
  });

  it("without Reckless Attack active, the same Grunt attack rolls 'normal'", () => {
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S..X"], oneGrunt, random);
    const hero: Combatant = { id: "h", position: { x: 1, y: 0 }, health: 10, armorClass: 10 };
    ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 1 && p.y === 0 });
    expect(spy).toHaveBeenCalledWith("normal");
  });

  it("Elusive still denies Advantage even when Reckless Attack would otherwise grant it (D-125)", () => {
    const random = RandomService.fixed(15);
    const spy = vi.spyOn(random, "rollD20With");
    const ws = laneSystem(["S..X"], oneGrunt, random);
    const hero: Combatant = {
      id: "h",
      position: { x: 1, y: 0 },
      health: 10,
      armorClass: 10,
      grantsAttackerAdvantage: true,
      deniesAttackerAdvantage: () => true,
    };
    ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 1 && p.y === 0 });
    expect(spy).toHaveBeenCalledWith("normal");
  });

  it("enemies route around a blocking hero when no one is in reach", () => {
    // Two rows so a detour exists when (2,0) is blocked.
    const ws = laneSystem(["S..X", "...."], oneGrunt);
    const report = ws.tickEnemyPhase({ isBlocked: (p) => p.x === 2 && p.y === 0 });
    const grunt = ws.enemies[0];
    expect(grunt.position).not.toEqual({ x: 2, y: 0 }); // did not enter the blocked tile
    expect(grunt.position).not.toEqual({ x: 0, y: 0 }); // but did make progress
    expect(report.breaches.length).toBe(0);
  });
});

describe("WaveSystem removeDefeated (removal occurs exactly once)", () => {
  it("removes a slain enemy once and lets the wave complete", () => {
    const ws = laneSystem(["S..X"], oneGrunt);
    ws.tickEnemyPhase(); // spawns the grunt (no heroes to fight)
    expect(ws.enemies.length).toBe(1);
    ws.enemies[0].health = 0; // simulate a hero killing it
    const removed = ws.removeDefeated();
    expect(removed.length).toBe(1);
    expect(ws.enemies.length).toBe(0);
    expect(ws.removeDefeated().length).toBe(0); // nothing to remove a second time
    expect(ws.isCurrentWaveComplete()).toBe(true); // spawned + field empty
  });
});
