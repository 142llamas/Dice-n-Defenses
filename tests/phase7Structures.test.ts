import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { BuildSystem } from "../src/game/systems/BuildSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import type { WaveDefinition } from "../src/game/data/waves";

/**
 * Phase 7 structure tests: Gate (blocks enemies, not heroes), Melee Platform /
 * Ranged Perch (a standing-hero combat bonus), and Tangle Root (the third
 * trap â€” light damage plus a slow). These are ADDITIVE to the Phase 5 rules
 * already covered by building.test.ts; the wall-seal and trap-trigger
 * mechanics themselves are unchanged and stay covered there.
 */

function buildOn(rows: string[]): { build: BuildSystem; map: GameMap; pf: PathfindingSystem } {
  const map = new GameMap(parseMapRows("m", "m", rows));
  const pf = new PathfindingSystem(map);
  return { build: new BuildSystem(map, pf), map, pf };
}

function laneWave(enemyId: string): WaveDefinition {
  return {
    id: "w",
    spawns: [{ enemyId, count: 1, startTurn: 1, intervalTurns: 1 }],
    completionGold: 0,
  };
}

describe("Gate: blocks enemies but not heroes", () => {
  it("counts as a wall for enemy routing and the route-seal check", () => {
    const { build } = buildOn(["S.X"]); // one-wide corridor
    const check = build.canPlace("gate", { x: 1, y: 0 });
    expect(check.ok).toBe(false); // a gate can seal the only path too
    expect(build.place("gate", { x: 1, y: 0 }).ok).toBe(false);
  });

  it("blocks heroes according to blocksHeroAt for a Barricade, but not a Gate", () => {
    const { build } = buildOn(["S..X", "...."]);
    build.place("barricade", { x: 1, y: 0 });
    build.place("gate", { x: 2, y: 0 });
    expect(build.blocksHeroAt({ x: 1, y: 0 })).toBe(true); // Barricade blocks heroes
    expect(build.blocksHeroAt({ x: 2, y: 0 })).toBe(false); // Gate does not
    expect(build.isWallAt({ x: 1, y: 0 })).toBe(true); // both still block enemies
    expect(build.isWallAt({ x: 2, y: 0 })).toBe(true);
  });

  it("reports no hero-block on a tile with no wall at all", () => {
    const { build } = buildOn(["S.X"]);
    expect(build.blocksHeroAt({ x: 1, y: 0 })).toBe(false);
  });
});

describe("Melee Platform / Ranged Perch: standing-hero attack bonus", () => {
  it("gives a melee hero bonus damage only, and only while standing on it", () => {
    const { build } = buildOn(["S..X"]);
    build.place("melee-platform", { x: 1, y: 0 });
    const onPlatform = build.platformBonusFor({ x: 1, y: 0 }, false); // melee hero
    expect(onPlatform).toEqual({ attackDamage: 2, attackRangeTiles: 0 });

    const offPlatform = build.platformBonusFor({ x: 2, y: 0 }, false);
    expect(offPlatform).toEqual({ attackDamage: 0, attackRangeTiles: 0 });
  });

  it("does not grant its bonus to the wrong hero category", () => {
    const { build } = buildOn(["S..X"]);
    build.place("melee-platform", { x: 1, y: 0 });
    const rangedHeroHere = build.platformBonusFor({ x: 1, y: 0 }, true); // ranged hero
    expect(rangedHeroHere).toEqual({ attackDamage: 0, attackRangeTiles: 0 });
  });

  it("gives a ranged hero bonus range only", () => {
    const { build } = buildOn(["S..X"]);
    build.place("ranged-perch", { x: 1, y: 0 });
    expect(build.platformBonusFor({ x: 1, y: 0 }, true)).toEqual({
      attackDamage: 0,
      attackRangeTiles: 1,
    });
    expect(build.platformBonusFor({ x: 1, y: 0 }, false)).toEqual({
      attackDamage: 0,
      attackRangeTiles: 0,
    });
  });

  it("never blocks movement (not a wall)", () => {
    const { build } = buildOn(["S.X"]);
    expect(build.place("melee-platform", { x: 1, y: 0 }).ok).toBe(true);
    expect(build.isWallAt({ x: 1, y: 0 })).toBe(false);
    expect(build.blocksHeroAt({ x: 1, y: 0 })).toBe(false);
  });
});

describe("Tangle Root: the third trap (damage + slow)", () => {
  it("damages and slows a ground enemy that steps on it", () => {
    // A runner (6 tiles/phase, D-172, so -4 from the slow leaves 2, not 0 —
    // see the "fully slowed" case covered separately below). A longer lane
    // than before so the runner's slowed move doesn't land exactly on the
    // exit tile (which is always enterable regardless of distance, and
    // would turn this into a breach instead of an ordinary move).
    const map = new GameMap(parseMapRows("lane", "lane", ["S..............X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("tangle-root", { x: 1, y: 0 });

    const ws = new WaveSystem(map, pf, [laneWave("runner")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase({
      trapAt: (p) => build.trapProfileAt(p),
      trapTargets: (p) => build.trapTargetsAt(p),
      trapStatusAt: (p) => build.trapStatusAt(p),
    });

    expect(t1.trapTriggers).toHaveLength(1);
    const runner = t1.spawned[0];
    expect(runner.hasStatus("slowed")).toBe(true);

    // The slow reduces its movement on the VERY NEXT phase (6 -> 2 tiles).
    const beforeX = runner.position.x;
    const t2 = ws.tickEnemyPhase({ trapAt: (p) => build.trapProfileAt(p) });
    expect(t2.moves[0].path).toHaveLength(2); // normally 6 tiles/phase
    expect(runner.position.x).toBe(beforeX + 2);
  });

  it("a fully-slowed enemy holds in place rather than corrupting its position", () => {
    // A grunt moves exactly 4 tiles/phase (D-172), which the slow's -4
    // cancels out entirely â€” the edge case that exposed the advanceEnemy
    // 0-steps bug.
    const map = new GameMap(parseMapRows("lane", "lane", ["S.......X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("tangle-root", { x: 1, y: 0 });

    const ws = new WaveSystem(map, pf, [laneWave("grunt")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    ws.tickEnemyPhase({
      trapAt: (p) => build.trapProfileAt(p),
      trapTargets: (p) => build.trapTargetsAt(p),
      trapStatusAt: (p) => build.trapStatusAt(p),
    });
    const grunt = ws.enemies[0];
    const beforeX = grunt.position.x;

    const t2 = ws.tickEnemyPhase({ trapAt: (p) => build.trapProfileAt(p) });
    expect(t2.moves[0].path).toHaveLength(0);
    expect(grunt.position).toEqual({ x: beforeX, y: 0 }); // held, not corrupted
  });

  it("ignores flying enemies end to end (ground-only, like Spike Trap)", () => {
    const map = new GameMap(parseMapRows("lane", "lane", ["S.......X"]));
    const pf = new PathfindingSystem(map);
    const build = new BuildSystem(map, pf);
    build.place("tangle-root", { x: 1, y: 0 }); // a wisp (3 tiles/phase) crosses it turn 1
    expect(build.trapTargetsAt({ x: 1, y: 0 })).toBe("ground");

    const ws = new WaveSystem(map, pf, [laneWave("wisp")], { startingIntegrity: 20, random: RandomService.fixed() });
    ws.startWave(0);
    const t1 = ws.tickEnemyPhase({
      trapAt: (p) => build.trapProfileAt(p),
      trapTargets: (p) => build.trapTargetsAt(p),
      trapStatusAt: (p) => build.trapStatusAt(p),
    });

    expect(t1.trapTriggers).toHaveLength(0); // flew over it untouched
    expect(t1.spawned[0].hasStatus("slowed")).toBe(false);
  });
});
