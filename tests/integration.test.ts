import { describe, it, expect } from "vitest";
import { TEST_MAP } from "../src/game/data/testMap";
import { WAVES } from "../src/game/data/waves";
import { STRONGHOLD_START } from "../src/game/config";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { TurnSystem } from "../src/game/systems/TurnSystem";

/**
 * End-to-end sanity check on the SHIPPED data (real map, real waves, real
 * starting integrity), driven through the exact phase decisions BattleScene
 * makes. This is not about visuals â€” it proves the systems cooperate: waves
 * spawn, enemies always find a route to the exit, breaches occur, and the game
 * reaches a real end state (defeat or victory) in a bounded number of turns
 * rather than hanging.
 */
describe("full game loop on shipped data", () => {
  it("reaches an end state without stalling", () => {
    const map = new GameMap(TEST_MAP);
    const pf = new PathfindingSystem(map);
    const ws = new WaveSystem(map, pf, WAVES, { startingIntegrity: STRONGHOLD_START, random: RandomService.fixed() });
    const turns = new TurnSystem();

    ws.startWave(0);
    turns.advance(); // preparation -> player

    let guard = 0;
    // Simulate: player ends turn immediately (no combat exists to stop enemies).
    while (!turns.isTerminal() && guard < 1000) {
      guard++;
      if (turns.current === "player") {
        turns.advance(); // -> enemy
      } else if (turns.current === "enemy") {
        ws.tickEnemyPhase();
        turns.transitionTo("resolution");
      } else if (turns.current === "resolution") {
        if (ws.isDefeated()) {
          turns.transitionTo("defeat");
        } else if (ws.isCurrentWaveComplete()) {
          if (ws.isLastWave()) turns.transitionTo("victory");
          else turns.transitionTo("betweenWave");
        } else {
          turns.transitionTo("player");
        }
      } else if (turns.current === "betweenWave") {
        ws.advanceToNextWave();
        turns.transitionTo("player");
      }
    }

    expect(guard).toBeLessThan(1000); // it terminated, it did not hang
    expect(turns.isTerminal()).toBe(true);
    // With no combat yet, enemies cannot be stopped, so the shipped balance ends
    // in defeat. (This is the honest Phase 3 outcome; victory needs Phase 4.)
    expect(turns.current).toBe("defeat");
    expect(ws.integrity).toBe(0);
  });
});
