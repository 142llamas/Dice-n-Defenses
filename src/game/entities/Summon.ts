import type { GridPosition } from "../systems/GridSystem";
import { getSummonDefinition, type SummonDefinition } from "../data/summons";
import type { Combatant } from "../systems/CombatSystem";

/**
 * Phase 16 (D-106): a plain-data copy of one live `Summon` instance.
 */
export interface SummonSnapshot {
  instanceId: string;
  defId: string;
  ownerId: string;
  position: GridPosition;
  health: number;
  remainingTurns: number;
}

/**
 * Summon: a pure, Phaser-free model of one temporary ally on the board,
 * fighting for the party (Phase 16, D-106) — the mechanical stand-in for
 * every SRD conjuration/summoning spell. Modeled after `Enemy` (same
 * `Combatant` shape, same per-instance id pattern) rather than `Hero`: a
 * summon has no move/action economy of its own, no gear, no spell slots —
 * it just stands where it was placed and strikes the nearest enemy in reach
 * once per hero turn until its duration runs out or it's destroyed.
 */
export class Summon implements Combatant {
  readonly instanceId: string;
  readonly def: SummonDefinition;
  readonly ownerId: string;

  position: GridPosition;
  health: number;
  remainingTurns: number;

  constructor(instanceId: string, def: SummonDefinition, ownerId: string, spawn: GridPosition, durationTurns: number) {
    this.instanceId = instanceId;
    this.def = def;
    this.ownerId = ownerId;
    this.position = { ...spawn };
    this.health = def.maxHealth;
    this.remainingTurns = durationTurns;
  }

  get id(): string {
    return this.instanceId;
  }

  get armorClass(): number {
    return this.def.armorClass;
  }

  /** Alive while it has HP left AND its duration hasn't run out. */
  isAlive(): boolean {
    return this.health > 0 && this.remainingTurns > 0;
  }

  toSnapshot(): SummonSnapshot {
    return {
      instanceId: this.instanceId,
      defId: this.def.id,
      ownerId: this.ownerId,
      position: { ...this.position },
      health: this.health,
      remainingTurns: this.remainingTurns,
    };
  }

  static fromSnapshot(snapshot: SummonSnapshot): Summon {
    const summon = new Summon(
      snapshot.instanceId,
      getSummonDefinition(snapshot.defId),
      snapshot.ownerId,
      snapshot.position,
      snapshot.remainingTurns,
    );
    summon.health = snapshot.health;
    return summon;
  }
}
