import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { TurnSystem } from "../src/game/systems/TurnSystem";
import { CombatSystem } from "../src/game/systems/CombatSystem";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";
import type { WaveDefinition } from "../src/game/data/waves";

const TEST_HERO_DEF: HeroDefinition = {
  id: "hero-test",
  name: "Test Hero",
  movementTiles: 4,
  maxHealth: 12,
  attackDamage: 4,
  attackRangeTiles: 1,
  attackBonus: 4,
  baseArmorClass: 10,
  abilityId: "cleave",
};

/**
 * Phase 4 unlocks VICTORY. Phase 3's integration test proved that doing nothing
 * ends in defeat; this is the honest counterpart: with combat, a hero that
 * defeats enemies before they breach can clear every wave and WIN with
 * Stronghold Integrity intact. It drives the real TurnSystem, WaveSystem, and
 * CombatSystem through the same phase decisions BattleScene makes, exercising
 * enemy attacks, hero attacks, hero-blocking, enemy removal, and wave-to-wave
 * progression all the way to a real victory.
 */
describe("victory is reachable once heroes can fight", () => {
  it("clears both waves and wins with integrity intact", () => {
    const map = new GameMap(parseMapRows("lane", "Lane", ["S..X"]));
    const pf = new PathfindingSystem(map);
    const waves: WaveDefinition[] = [
      { id: "w1", spawns: [{ enemyId: "grunt", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 },
      { id: "w2", spawns: [{ enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 },
    ];
    const ws = new WaveSystem(map, pf, waves, { startingIntegrity: 20, random: RandomService.fixed() });
    const turns = new TurnSystem();

    // One melee hero standing one tile from the spawn, holding the lane.
    const hero = new Hero(TEST_HERO_DEF, { x: 1, y: 0 });

    ws.startWave(0);
    turns.advance(); // preparation -> player

    let guard = 0;
    while (!turns.isTerminal() && guard < 1000) {
      guard++;
      const phase = turns.current;
      if (phase === "player") {
        // The hero attacks the nearest enemy it can reach (same rule the scene
        // uses), then defeated enemies leave the field.
        if (hero.isAlive()) {
          const target = CombatSystem.chooseTarget(hero.position, hero.attackRangeTiles, ws.enemies);
          if (target) {
            CombatSystem.applyAttack(
              target,
              { rangeTiles: hero.attackRangeTiles, damage: hero.attackDamage, attackBonus: hero.attackBonus },
              RandomService.fixed(),
            );
            ws.removeDefeated();
          }
        }
        turns.advance(); // -> enemy
      } else if (phase === "enemy") {
        ws.tickEnemyPhase({
          heroTargets: hero.isAlive() ? [hero] : [],
          isBlocked: (p) => hero.isAlive() && p.x === hero.position.x && p.y === hero.position.y,
        });
        turns.transitionTo("resolution");
      } else if (phase === "resolution") {
        if (ws.isDefeated()) {
          turns.transitionTo("defeat");
        } else if (ws.isCurrentWaveComplete()) {
          if (ws.isLastWave()) turns.transitionTo("victory");
          else turns.transitionTo("betweenWave");
        } else {
          turns.transitionTo("player");
        }
      } else if (phase === "betweenWave") {
        ws.advanceToNextWave();
        turns.transitionTo("player");
      }
    }

    expect(guard).toBeLessThan(1000); // it terminated
    expect(turns.current).toBe("victory");
    expect(ws.integrity).toBe(20); // nothing breached
    expect(hero.isAlive()).toBe(true);
  });
});
