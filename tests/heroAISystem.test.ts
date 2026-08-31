import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { MovementSystem } from "../src/game/systems/MovementSystem";
import { HeroAISystem } from "../src/game/systems/HeroAISystem";
import type { Combatant } from "../src/game/systems/CombatSystem";

/**
 * Phase 11.4 (D-077): the pure decision engine behind an AI-controlled
 * hero's automatic turn. Mirrors WaveSystem's enemy-phase tests in style —
 * a small open room, plain Combatant stand-ins, no Phaser.
 */

// A 5x1 open lane, no walls, so movement math is simple Manhattan distance.
const lane = new GameMap(parseMapRows("lane", "Lane", [".".repeat(6)]));
const movement = new MovementSystem(lane);
const ai = new HeroAISystem(movement);

function enemy(id: string, x: number, y = 0, health = 5): Combatant {
  return { id, position: { x, y }, health };
}

describe("HeroAISystem.decideTurn", () => {
  it("attacks in place when an enemy is already in range, spending no move", () => {
    const decision = ai.decideTurn({
      position: { x: 0, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 3,
      enemies: [enemy("e1", 1, 0)],
    });
    expect(decision.move).toBeNull();
    expect(decision.targetId).toBe("e1");
  });

  it("holds (no move, no target) when there are no living enemies", () => {
    const decision = ai.decideTurn({
      position: { x: 0, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 3,
      enemies: [],
    });
    expect(decision.move).toBeNull();
    expect(decision.targetId).toBeNull();
  });

  it("ignores a defeated (0 HP) enemy and holds", () => {
    const decision = ai.decideTurn({
      position: { x: 0, y: 0 },
      attackRangeTiles: 5,
      movementBudget: 3,
      enemies: [enemy("dead", 1, 0, 0)],
    });
    expect(decision.targetId).toBeNull();
  });

  it("moves toward the nearest enemy when none are in range yet", () => {
    const decision = ai.decideTurn({
      position: { x: 0, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 2,
      enemies: [enemy("e1", 5, 0)],
    });
    expect(decision.move).toEqual({ x: 2, y: 0 }); // closes the gap by its full budget
    expect(decision.targetId).toBeNull(); // still out of range (1) after moving
  });

  it("moves AND attacks in the same turn if the move closes into range", () => {
    // isOccupied blocks the enemy's own tile, same as BattleScene marking
    // living enemies (and other heroes) impassable for a real hero move.
    const decision = ai.decideTurn({
      position: { x: 0, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 3,
      enemies: [enemy("e1", 3, 0)],
      isOccupied: (p) => p.x === 3 && p.y === 0,
    });
    expect(decision.move).toEqual({ x: 2, y: 0 });
    expect(decision.targetId).toBe("e1"); // adjacent to (3,0) after moving
  });

  it("holds with no move when the movement budget is exhausted (already moved this turn)", () => {
    const decision = ai.decideTurn({
      position: { x: 0, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 0,
      enemies: [enemy("e1", 5, 0)],
    });
    expect(decision.move).toBeNull();
    expect(decision.targetId).toBeNull();
  });

  it("respects isOccupied when choosing where to move", () => {
    const decision = ai.decideTurn({
      position: { x: 0, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 3,
      enemies: [enemy("e1", 5, 0)],
      isOccupied: (p) => p.x === 2 && p.y === 0, // blocks the otherwise-closest tile
    });
    expect(decision.move).toEqual({ x: 1, y: 0 });
  });

  it("prefers the nearest enemy to chase when several are out of range", () => {
    const decision = ai.decideTurn({
      position: { x: 0, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 1,
      enemies: [enemy("far", 5, 0), enemy("near", 2, 0)],
    });
    // Moving 1 tile toward "near" (distance 2) closes it to 1; "far" stays distance 4.
    expect(decision.move).toEqual({ x: 1, y: 0 });
  });
});

describe("HeroAISystem.planApproachForAttack", () => {
  it("returns null (no move needed) when the target is already in range", () => {
    const dest = ai.planApproachForAttack({
      position: { x: 0, y: 0 },
      targetPosition: { x: 3, y: 0 },
      attackRangeTiles: 3,
      movementBudget: 5,
    });
    expect(dest).toBeNull();
  });

  it("approaches only as far as needed for a ranged attack range, not all the way adjacent", () => {
    const dest = ai.planApproachForAttack({
      position: { x: 0, y: 0 },
      targetPosition: { x: 5, y: 0 },
      attackRangeTiles: 2,
      movementBudget: 4,
      isOccupied: (p) => p.x === 5 && p.y === 0, // the target's own tile
    });
    // (3,0) is distance 2 from the target (in range) and costs only 3 tiles of
    // movement; (4,0) would also be in range but costs a full 4 tiles — the
    // cheaper approach should win rather than closing all the way in.
    expect(dest).toEqual({ x: 3, y: 0 });
  });

  it("returns null when the target is unreachable within the movement budget at any tile", () => {
    const dest = ai.planApproachForAttack({
      position: { x: 0, y: 0 },
      targetPosition: { x: 5, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 1,
    });
    expect(dest).toBeNull();
  });

  it("respects isOccupied — a blocked tile in the only path makes the target unreachable", () => {
    const dest = ai.planApproachForAttack({
      position: { x: 0, y: 0 },
      targetPosition: { x: 5, y: 0 },
      attackRangeTiles: 1,
      movementBudget: 3,
      isOccupied: (p) => p.x === 2 && p.y === 0, // blocks the lane partway through
    });
    expect(dest).toBeNull();
  });
});
