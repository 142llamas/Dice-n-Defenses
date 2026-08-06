import { describe, it, expect } from "vitest";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { BuildSystem } from "../src/game/systems/BuildSystem";
import { EconomySystem } from "../src/game/systems/EconomySystem";
import { RewardSystem } from "../src/game/systems/RewardSystem";
import { CombatSystem, type AttackProfile } from "../src/game/systems/CombatSystem";
import { TEST_MAP } from "../src/game/data/testMap";
import { WAVES } from "../src/game/data/waves";
import {
  ENEMY_DEFINITIONS,
  ENEMY_COLORS,
  getEnemyDefinition,
} from "../src/game/data/enemies";
import { STARTING_GOLD, STRONGHOLD_START } from "../src/game/config";

/**
 * Phase 7 (D-050 / D-051) â€” the expanded roster and the ten-wave campaign.
 *
 * This file is the spec for the content added in this slice. It has two jobs:
 *
 *   1. STRUCTURE â€” lock down the shape of the roster and the campaign as data,
 *      so a later chat adding content can't silently break the phase's
 *      deliverables ("six to eight enemies", "ten waves and one miniboss"): the
 *      miniboss must exist, be unique, and appear only in the final wave; every
 *      wave must reference real, renderable enemies; the economy must not go
 *      backwards across the campaign.
 *
 *   2. WINNABILITY â€” prove the full ten-wave campaign can be PLAYED TO VICTORY
 *      through the real fighting-building-spending loop, and (via the existing
 *      mvp-integration "doing nothing loses" test) that it is still losable.
 *
 * As with mvp-integration, the "player" here is an UPPER BOUND on skill: both
 * heroes focus the enemy nearest the exit every player phase, and the player
 * spends wave rewards on a trapped lane between waves. This can prove a run is
 * *possible*; it cannot set the true difficulty. Real balance/feel is Kevin's
 * in-browser call (KNOWN_ISSUES KI-015) â€” see the note atop data/waves.ts.
 */

// ---------------------------------------------------------------------------
// 1. Roster structure
// ---------------------------------------------------------------------------

describe("Phase 7 roster (D-050), extended by Phase 11.6 (D-079)", () => {
  const all = Object.values(ENEMY_DEFINITIONS);
  // NOTE: "minion" covers both explicit role: "minion" and the omitted-role
  // convention every pre-11.6 definition uses ("omitted = ordinary minion").
  // Filtering minions as "not miniboss" (the original Phase 7 test) silently
  // swept the new "boss" role (D-079) in as a "minion" too â€” fixed here to
  // check each role bucket explicitly instead.
  const minions = all.filter((e) => e.role === undefined || e.role === "minion");
  const minibosses = all.filter((e) => e.role === "miniboss");
  const bosses = all.filter((e) => e.role === "boss");

  it("delivers six-plus regular enemies, at least one miniboss, and (as of D-112) six true bosses", () => {
    expect(minions.length).toBeGreaterThanOrEqual(6);
    expect(minibosses.length).toBeGreaterThanOrEqual(1); // D-095 (13.10) adds a second: gravemaw; D-111 (20) a third: juggernaut; D-112 (21) two more: bloodrage-warlord, the-husk
    expect(bosses.length).toBe(6); // D-095 adds a third (blightmother); D-111 (20) two more: warlord-korrath, the-devourer; D-112 (21) one more: sundered-king
  });

  it("names the miniboss basalt-colossus and makes it the beefiest MINION-tier threat", () => {
    expect(minibosses[0].id).toBe("basalt-colossus");
    const maxMinionHealth = Math.max(...minions.map((e) => e.maxHealth));
    // The miniboss should out-scale every ordinary minion in raw staying power.
    expect(minibosses[0].maxHealth).toBeGreaterThan(maxMinionHealth);
  });

  it("D-079/D-095/D-111: every true boss meaningfully out-scales the original miniboss", () => {
    const colossus = getEnemyDefinition("basalt-colossus");
    for (const boss of bosses) {
      expect(boss.maxHealth).toBeGreaterThan(colossus.maxHealth);
      expect(boss.armorClass).toBeGreaterThanOrEqual(colossus.armorClass);
      expect(boss.breachDamage).toBeGreaterThan(colossus.breachDamage);
      expect(boss.rewardGold).toBeGreaterThan(colossus.rewardGold);
    }
  });

  it("D-079: retrieves both new minions and both new bosses by id, with lore on the bosses", () => {
    for (const id of ["hexer", "ravager", "cinderlord", "tidelord"]) {
      expect(getEnemyDefinition(id).id).toBe(id);
    }
    expect(getEnemyDefinition("cinderlord").loreText).toBeTruthy();
    expect(getEnemyDefinition("tidelord").loreText).toBeTruthy();
    expect(getEnemyDefinition("cinderlord").role).toBe("boss");
    expect(getEnemyDefinition("tidelord").role).toBe("boss");
  });

  it("gives every enemy a placeholder colour and self-consistent id", () => {
    for (const def of all) {
      expect(def.id in ENEMY_COLORS).toBe(true);
      // the record key and the definition's own id must agree (catches typos)
      expect(ENEMY_DEFINITIONS[def.id]).toBe(def);
    }
  });

  it("keeps every enemy's numeric fields sane", () => {
    for (const def of all) {
      expect(def.maxHealth).toBeGreaterThan(0);
      expect(def.movementTiles).toBeGreaterThan(0);
      expect(def.breachDamage).toBeGreaterThan(0);
      expect(def.armorClass).toBeGreaterThanOrEqual(0);
      expect(["ground", "flying"]).toContain(def.movementType);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Campaign structure
// ---------------------------------------------------------------------------

describe("Ten-wave campaign (D-051)", () => {
  it("has exactly ten waves", () => {
    expect(WAVES.length).toBe(10);
  });

  it("references only real, renderable enemies with valid spawn schedules", () => {
    for (const wave of WAVES) {
      expect(wave.spawns.length).toBeGreaterThan(0);
      for (const group of wave.spawns) {
        // resolves to a definition (throws on a bad id) and has a colour
        const def = getEnemyDefinition(group.enemyId);
        expect(def.id in ENEMY_COLORS).toBe(true);
        expect(group.count).toBeGreaterThan(0);
        expect(group.startTurn).toBeGreaterThanOrEqual(1);
        expect(group.intervalTurns).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("puts the miniboss in the final wave only, exactly once", () => {
    const bossWaves = WAVES.filter((w) =>
      w.spawns.some((g) => getEnemyDefinition(g.enemyId).role === "miniboss"),
    );
    expect(bossWaves.length).toBe(1);
    expect(bossWaves[0]).toBe(WAVES[WAVES.length - 1]);
    const bossGroups = bossWaves[0].spawns.filter(
      (g) => getEnemyDefinition(g.enemyId).role === "miniboss",
    );
    expect(bossGroups.reduce((n, g) => n + g.count, 0)).toBe(1);
  });

  it("never lets wave completion gold go backwards, and pays the most at the finale", () => {
    const gold = WAVES.map((w) => w.completionGold);
    for (let i = 1; i < gold.length; i++) {
      expect(gold[i]).toBeGreaterThanOrEqual(gold[i - 1]);
    }
    expect(gold[gold.length - 1]).toBe(Math.max(...gold));
  });
});

// ---------------------------------------------------------------------------
// 3. Winnability through the real fighting-building-spending loop
// ---------------------------------------------------------------------------

// Real hero output, from data/heroes.ts + data/abilities.ts. A fixed roll
// that always hits keeps this an upper-bound simulation, same spirit as the
// pre-D-086 deterministic version (see RandomService.fixed()'s doc comment).
const SIM_ROLL = RandomService.fixed(15);
const ASH_STRIKE: AttackProfile = { rangeTiles: 1, damage: 4, attackBonus: 4 };
const WREN_PIERCE: AttackProfile = { rangeTiles: 4, damage: 4, attackBonus: 4, autoHit: true };

// A lane of trap tiles on the open middle row (y = 4) between spawn and exit.
// The Sky Snare goes late in the lane to catch flyers; spikes chip ground units.
const SNARE_TILE = { x: 14, y: 4 };
const SPIKE_TILES = [
  { x: 3, y: 4 },
  { x: 6, y: 4 },
  { x: 9, y: 4 },
  { x: 12, y: 4 },
];

describe("Ten-wave campaign is winnable via the real loop", () => {
  it("clears all ten waves â€” heroes focus fire, gold buys a trapped lane", () => {
    const map = new GameMap(TEST_MAP);
    const pathfinding = new PathfindingSystem(map);
    const waves = new WaveSystem(map, pathfinding, WAVES, {
      startingIntegrity: STRONGHOLD_START, random: RandomService.fixed(),
    });
    const economy = new EconomySystem(STARTING_GOLD);
    const build = new BuildSystem(map, pathfinding);

    let snarePlaced = false;
    let spikeIdx = 0;
    let boughtAnti = false;
    let anyTimeBonus = false;

    // The player's between-wave spend: an anti-air Sky Snare first (the only
    // answer to flyers), then as many Spike Traps as gold and legality allow.
    const buyDefenses = (): void => {
      if (!snarePlaced && economy.canAfford(7) && build.canPlace("sky-snare", SNARE_TILE).ok) {
        if (economy.spend(7).ok && build.place("sky-snare", SNARE_TILE).ok) {
          snarePlaced = true;
          boughtAnti = true;
        }
      }
      while (
        spikeIdx < SPIKE_TILES.length &&
        economy.canAfford(8) &&
        build.canPlace("spike-trap", SPIKE_TILES[spikeIdx]).ok
      ) {
        if (economy.spend(8).ok && build.place("spike-trap", SPIKE_TILES[spikeIdx]).ok) {
          spikeIdx++;
        } else break;
      }
    };

    const heroesAct = (): void => {
      for (const profile of [ASH_STRIKE, WREN_PIERCE]) {
        const living = waves.enemies.filter((e) => e.isAlive() && !e.breached);
        if (living.length === 0) return;
        const frontmost = living.reduce((a, b) => (b.position.x > a.position.x ? b : a));
        CombatSystem.applyAttack(frontmost, profile, SIM_ROLL);
      }
    };

    let wavesCleared = 0;

    for (let w = 0; w < WAVES.length; w++) {
      buyDefenses(); // spend the accumulated rewards before the wave begins
      waves.startWave(w);
      let guard = 0;
      let cleared = false;

      while (guard++ < 100) {
        heroesAct();
        economy.award(RewardSystem.killGold(waves.removeDefeated()));
        if (waves.isCurrentWaveComplete()) {
          const r = RewardSystem.waveReward(waves.currentWave, guard);
          economy.award(r.total);
          if (r.timeBonusGold > 0) anyTimeBonus = true;
          cleared = true;
          break;
        }

        const report = waves.tickEnemyPhase({
          trapAt: (p) => build.trapProfileAt(p),
          trapTargets: (p) => build.trapTargetsAt(p),
        });
        economy.award(RewardSystem.killGold(waves.removeDefeated()));

        expect(waves.isDefeated()).toBe(false); // integrity must never hit 0
        if (report.waveComplete) {
          const r = RewardSystem.waveReward(waves.currentWave, report.turn);
          economy.award(r.total);
          if (r.timeBonusGold > 0) anyTimeBonus = true;
          cleared = true;
          break;
        }
      }

      expect(cleared).toBe(true);
      wavesCleared++;
    }

    // Victory: all ten waves cleared, stronghold still standing, field empty.
    expect(wavesCleared).toBe(10);
    expect(waves.integrity).toBeGreaterThan(0);
    expect(waves.enemies.length).toBe(0);
    // The building-and-spending loop actually ran: anti-air was affordable and
    // bought, and the turn-limit bonus was earned on at least one wave.
    expect(boughtAnti).toBe(true);
    expect(anyTimeBonus).toBe(true);
  });
});
