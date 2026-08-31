import type { GridPosition } from "./GridSystem";
import { CombatSystem, type Combatant } from "./CombatSystem";
import { MovementSystem } from "./MovementSystem";

/**
 * HeroAISystem: pure decision logic for an AI-controlled hero's turn
 * (Phase 11.4, D-077 — "human picks level-ups, AI plays"). No Phaser.
 *
 * Deliberately mirrors WaveSystem's enemy-phase choice ("prefer to attack; if
 * nothing is in range, advance") rather than inventing a separate policy:
 *   1. If an enemy is already in range, attack it and hold position — no
 *      move spent (see `WaveSystem.tickEnemyPhase`'s identical preference).
 *   2. Otherwise, move toward the NEAREST living enemy as far as this turn's
 *      movement budget allows (reusing `MovementSystem.reachableTiles`, the
 *      same reachability a human's move-highlight uses), then attack from
 *      the new position if that closed enough distance to land a hit.
 *   3. If no enemy exists, or moving cannot get any closer, hold with no
 *      move and no attack.
 *
 * `BattleScene` is responsible for checking `hero.canAct()`/`canMove()`
 * before calling this (this system, like CombatSystem, knows nothing about a
 * hero's per-turn move/act flags) and for actually applying the returned
 * move/attack through its existing hero-action code.
 */
export interface HeroAIQuery {
  position: GridPosition;
  attackRangeTiles: number;
  /** Tiles this hero may still move this turn (0 if it has already moved). */
  movementBudget: number;
  enemies: ReadonlyArray<Combatant>;
  /** Tiles a move may not enter or end on (walls, enemies, the spawn tile). */
  isOccupied?: (pos: GridPosition) => boolean;
  /** Tiles that may be walked THROUGH but never ended on (D-067: other heroes). */
  blocksStopping?: (pos: GridPosition) => boolean;
}

export interface HeroAIDecision {
  /** Tile to move to before acting, or null to stay put. */
  move: GridPosition | null;
  /** The enemy to attack from the post-move position, or null to hold. */
  targetId: string | null;
}

/**
 * Phase 3 (D-205): "move-then-attack" for a HUMAN player's own click — unlike
 * `decideTurn` (which always walks toward the NEAREST enemy), this targets
 * whichever enemy was specifically clicked.
 */
export interface ApproachForAttackQuery {
  position: GridPosition;
  targetPosition: GridPosition;
  attackRangeTiles: number;
  /** Tiles this hero may still move this turn (0 if it has already moved). */
  movementBudget: number;
  isOccupied?: (pos: GridPosition) => boolean;
  blocksStopping?: (pos: GridPosition) => boolean;
}

export class HeroAISystem {
  constructor(private readonly movement: MovementSystem) {}

  decideTurn(query: HeroAIQuery): HeroAIDecision {
    const { position, attackRangeTiles, movementBudget, enemies, isOccupied, blocksStopping } = query;

    const immediateTarget = CombatSystem.chooseTarget(position, attackRangeTiles, enemies);
    if (immediateTarget) return { move: null, targetId: immediateTarget.id };

    // No range cap here: this picks the nearest living enemy to walk toward,
    // regardless of this hero's attack reach.
    const nearestEnemy = CombatSystem.chooseTarget(position, Number.POSITIVE_INFINITY, enemies);
    if (!nearestEnemy) return { move: null, targetId: null };

    const reachable = this.movement.reachableTiles({
      start: position,
      budget: movementBudget,
      isOccupied,
      blocksStopping,
    });
    let bestTile: GridPosition | null = null;
    let bestDist = CombatSystem.range(position, nearestEnemy.position);
    for (const tile of reachable) {
      const d = CombatSystem.range(tile, nearestEnemy.position);
      if (d < bestDist) {
        bestDist = d;
        bestTile = tile;
      }
    }
    if (!bestTile) return { move: null, targetId: null };

    const postMoveTarget = CombatSystem.chooseTarget(bestTile, attackRangeTiles, enemies);
    return { move: bestTile, targetId: postMoveTarget?.id ?? null };
  }

  /**
   * Phase 3 (D-205): a specific-target move-then-attack, for a player's own
   * click on an out-of-range enemy (`BattleScene.tryAttackWithApproach`).
   * Returns the LEAST-movement reachable tile that lands `targetPosition`
   * within `attackRangeTiles` — approaching just far enough to be in range,
   * not necessarily adjacent, which matters for a ranged hero (a 2-3 tile
   * `weaponRangeTiles()`) who shouldn't be walked into melee distance when a
   * shorter approach already puts the target in range. Returns null if
   * `targetPosition` is already in range (no move needed) or unreachable
   * within `movementBudget` from ANY tile.
   */
  planApproachForAttack(query: ApproachForAttackQuery): GridPosition | null {
    const { position, targetPosition, attackRangeTiles, movementBudget, isOccupied, blocksStopping } = query;
    if (CombatSystem.isInRange(position, targetPosition, attackRangeTiles)) return null;

    const reachable = this.movement.reachableTiles({ start: position, budget: movementBudget, isOccupied, blocksStopping });
    const inRange = reachable.filter((tile) => CombatSystem.isInRange(tile, targetPosition, attackRangeTiles));
    if (inRange.length === 0) return null;

    let best: GridPosition | null = null;
    let bestSteps = Number.POSITIVE_INFINITY;
    for (const tile of inRange) {
      const path = this.movement.findPath(tile, { start: position, budget: movementBudget, isOccupied, blocksStopping });
      if (path && path.length < bestSteps) {
        bestSteps = path.length;
        best = tile;
      }
    }
    return best;
  }
}
