import type { GridPosition } from "./GridSystem";
import { CombatSystem, type AttackResult, type Combatant } from "./CombatSystem";
import type { RandomService } from "./RandomService";
import { Summon } from "../entities/Summon";
import { getSummonDefinition } from "../data/summons";
import type { Enemy } from "../entities/Enemy";

/**
 * SummonSystem: pure rules for temporary ally combatants (Phase 16, D-106,
 * "make all spells usable"). No Phaser, no rendering — `BattleScene` places
 * a token when `spawn()` returns, and removes one whenever `actAndTick()`
 * drops it from `summons`.
 *
 * A summon has no move/action economy of its own (unlike `Hero`) and no
 * per-enemy targeting AI of its own to write (unlike `WaveSystem`'s much
 * bigger enemy phase) — it simply strikes the nearest enemy in reach once
 * per hero turn, the same `CombatSystem.chooseTarget`/`applyAttack` pair
 * every other attacker in this game already uses.
 *
 * Not yet part of `BattleStateSnapshot` (Phase 12.1, D-101) — a documented
 * gap, not an oversight: this system has no consumer for it yet (a coop
 * battle's full-state round trip is the only thing that reads a snapshot
 * today, and Phase 16 doesn't touch Phase 12). A future session wiring
 * summons into that round trip should follow `Enemy`'s exact
 * toSnapshot/fromSnapshot shape.
 */
export interface SummonAttackEvent {
  summon: Summon;
  target: Combatant;
  result: AttackResult;
}

export class SummonSystem {
  private active: Summon[] = [];
  private nextInstance = 1;

  /** Every summon currently on the field, for any caller that needs to render or query them. */
  get summons(): ReadonlyArray<Summon> {
    return this.active;
  }

  /** Place a new summon on the field, owned by `ownerId` (the casting hero's id). */
  spawn(defId: string, ownerId: string, position: GridPosition, durationTurns: number): Summon {
    const def = getSummonDefinition(defId);
    const summon = new Summon(`${def.id}#${this.nextInstance++}`, def, ownerId, position, durationTurns);
    this.active.push(summon);
    return summon;
  }

  /**
   * Each living summon strikes the nearest living enemy within its own
   * reach (if any is in range), then its duration ticks down by one turn.
   * A summon reduced to 0 HP or whose duration just expired is removed
   * before this returns. Call once per hero turn.
   */
  actAndTick(enemies: ReadonlyArray<Enemy>, random: RandomService): SummonAttackEvent[] {
    const events: SummonAttackEvent[] = [];
    for (const summon of this.active) {
      if (!summon.isAlive()) continue;
      const target = CombatSystem.chooseTarget(summon.position, summon.def.attackRangeTiles, enemies);
      if (target) {
        const result = CombatSystem.applyAttack(
          target,
          {
            rangeTiles: summon.def.attackRangeTiles,
            damage: summon.def.attackDamage,
            attackBonus: summon.def.attackBonus,
          },
          random,
        );
        events.push({ summon, target, result });
      }
      summon.remainingTurns -= 1;
    }
    this.active = this.active.filter((s) => s.isAlive());
    return events;
  }
}
