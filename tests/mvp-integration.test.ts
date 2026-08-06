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
import { STARTING_GOLD, STRONGHOLD_START } from "../src/game/config";

/**
 * Phase 6 â€” Integrated MVP loop (originally the five-wave MVP).
 *
 * Phase 7 (D-051) extended the campaign to TEN waves; because this harness
 * loops `WAVES.length`, it now drives the FULL ten-wave campaign end to end
 * (one Spike Trap, both heroes focus-firing) â€” a free upgrade in coverage. The
 * dedicated ten-wave structure + building-loop proof lives in campaign.test.ts.
 *
 * These tests exercise the WHOLE loop through the real systems at once â€”
 * TurnSystem is the only piece not involved (it only orders phases; the
 * player/enemy alternation is modelled directly here). Everything else is the
 * production code: the real map, the real WAVES, WaveSystem spawning and
 * routing, CombatSystem damage, BuildSystem placement, the trapâ†’enemy-phase
 * interaction, EconomySystem gold, and RewardSystem rewards.
 *
 * The point is to show the integrated MVP is coherent: a clean start can be
 * PLAYED TO VICTORY with sensible play, and doing nothing leads to DEFEAT â€” the
 * two ends of Phase 6's "clean install can play from start to win/lose".
 *
 * The "player" here is a simple competent strategy: each turn both heroes
 * focus-fire the enemy nearest the exit (Ash with a basic strike, Wren with her
 * armour-piercing shot), and one Spike Trap sits early in the lane. Enemies are
 * given NO hero targets, so they never stall to attack â€” they always march,
 * which is the harshest case for the defender.
 */

// Real hero output, taken from data/heroes.ts + data/abilities.ts. A fixed
// roll that always hits keeps this an upper-bound simulation, same spirit as
// the pre-D-086 deterministic version (see RandomService.fixed()'s doc comment).
const SIM_ROLL = RandomService.fixed(15);
const ASH_STRIKE: AttackProfile = { rangeTiles: 1, damage: 4, attackBonus: 4 };
const WREN_PIERCE: AttackProfile = { rangeTiles: 4, damage: 4, attackBonus: 4, autoHit: true };

function freshGame() {
  const map = new GameMap(TEST_MAP);
  const pathfinding = new PathfindingSystem(map);
  const waves = new WaveSystem(map, pathfinding, WAVES, {
    startingIntegrity: STRONGHOLD_START, random: RandomService.fixed(),
  });
  const economy = new EconomySystem(STARTING_GOLD);
  const build = new BuildSystem(map, pathfinding);
  return { map, pathfinding, waves, economy, build };
}

/** Both heroes strike the living, un-breached enemy closest to the exit. */
function heroesAct(waves: WaveSystem): void {
  for (const profile of [ASH_STRIKE, WREN_PIERCE]) {
    const living = waves.enemies.filter((e) => e.isAlive() && !e.breached);
    if (living.length === 0) return;
    const frontmost = living.reduce((a, b) => (b.position.x > a.position.x ? b : a));
    CombatSystem.applyAttack(frontmost, profile, SIM_ROLL);
  }
}

describe("Integrated MVP â€” a sensible player can win the whole campaign", () => {
  it("plays from a clean start to victory across every wave, integrity intact", () => {
    const { waves, economy, build } = freshGame();

    // Spend gold on one Spike Trap early in the lane (the fighting-building-
    // spending loop). It must be a legal, affordable buy.
    const trapDef = "spike-trap";
    const trapTile = { x: 2, y: 4 };
    expect(build.canPlace(trapDef, trapTile).ok).toBe(true);
    const cost = 8;
    expect(economy.spend(cost).ok).toBe(true);
    expect(build.place(trapDef, trapTile).ok).toBe(true);
    const goldAfterBuying = economy.gold; // 20 - 8 = 12

    let anyTrapTriggered = false;
    let wavesCleared = 0;

    for (let w = 0; w < WAVES.length; w++) {
      waves.startWave(w);
      let guard = 0;
      let cleared = false;

      while (guard++ < 60) {
        // --- Player phase: heroes act, then collect kills and gold. ---
        heroesAct(waves);
        economy.award(RewardSystem.killGold(waves.removeDefeated()));
        if (waves.isCurrentWaveComplete()) {
          economy.award(RewardSystem.waveReward(waves.currentWave, guard).total);
          cleared = true;
          break;
        }

        // --- Enemy phase: enemies march (no targets => never stall), traps bite. ---
        const report = waves.tickEnemyPhase({
          trapAt: (p) => build.trapProfileAt(p),
          trapTargets: (p) => build.trapTargetsAt(p),
        });
        if (report.trapTriggers.length > 0) anyTrapTriggered = true;
        economy.award(RewardSystem.killGold(waves.removeDefeated()));

        expect(waves.isDefeated()).toBe(false); // integrity must never hit 0 here
        if (report.waveComplete) {
          economy.award(RewardSystem.waveReward(waves.currentWave, report.turn).total);
          cleared = true;
          break;
        }
      }

      expect(cleared).toBe(true);
      wavesCleared++;
    }

    // Victory: every wave cleared, stronghold still standing.
    expect(wavesCleared).toBe(WAVES.length);
    expect(waves.integrity).toBeGreaterThan(0);
    expect(waves.enemies.length).toBe(0);
    // The economy actually flowed: the trap earned its keep, and rewards left
    // the party richer than it was after buying the trap.
    expect(anyTrapTriggered).toBe(true);
    expect(economy.gold).toBeGreaterThan(goldAfterBuying);
  });
});

describe("Integrated MVP â€” doing nothing loses", () => {
  it("reaches Defeat when the player never acts (loss condition works)", () => {
    const { waves } = freshGame();
    let defeated = false;

    for (let w = 0; w < WAVES.length && !defeated; w++) {
      waves.startWave(w);
      let guard = 0;
      while (guard++ < 60) {
        const report = waves.tickEnemyPhase(); // no heroes, no traps: pure breach
        if (report.defeated) {
          defeated = true;
          break;
        }
        if (report.waveComplete) break; // this wave leaked through; next wave
      }
    }

    expect(defeated).toBe(true);
    expect(waves.integrity).toBe(0);
  });
});
