import { GridSystem, type GridPosition } from "./GridSystem";
import { RandomService } from "./RandomService";
import type { AdvantageMode } from "./RandomService";
import type { StatusEffectId } from "../data/statusEffects";
import type { DamageType } from "../data/weapons";

/**
 * CombatSystem: pure combat rules. No Phaser, no entity classes.
 *
 * Per the Source of Truth ("rules independent from visuals") and the Phase 3
 * handoff ("combat is a new pure CombatSystem ... keep rules out of the scene"),
 * every combat DECISION lives here and is unit-tested in plain Node. BattleScene
 * only renders the results; WaveSystem calls in here for enemy attacks.
 *
 * The system is deliberately entity-agnostic: it works on a tiny `Combatant`
 * shape ({ id, position, health, armorClass? }) so both Hero and Enemy can be
 * fed in without CombatSystem depending on either class.
 *
 * Phase 13.1 (DECISIONS D-086) reverses D-030's deterministic-combat design:
 * an attack now rolls a d20 (+ the attacker's `attackBonus`) against the
 * target's Armor Class. A natural 20 always hits and is a critical hit
 * (double damage); a natural 1 always misses. `AttackProfile.autoHit` skips
 * the roll entirely and always lands for full damage — traps and a few
 * "ignores armor" effects use this, preserving exactly what D-030's old
 * `ignoreDefense` flag meant for them (see DECISIONS D-086 for the full
 * per-caller migration notes). Damage is still a flat number, not a dice
 * expression — only the HIT/MISS/CRIT determination is randomized this pass.
 *
 * Every method that can roll dice takes an explicit `RandomService` (Source
 * of Truth "controlled randomness": rolls flow through a service tests can
 * seed). `RandomService.fixed()` is the test-facing deterministic double.
 *
 * Range uses Manhattan distance, matching the game's four-directional movement
 * and `GridSystem.manhattanDistance`. Range does NOT consider walls or line of
 * sight (LOS is a later grid-layer concern in the Source of Truth).
 */

/** The minimum a combatant must expose to take part in combat. */
export interface Combatant {
  readonly id: string;
  position: GridPosition;
  health: number;
  /** Armor Class. Absent is treated as 10 (unarmored, no bonuses). */
  readonly armorClass?: number;
  /**
   * Phase 13.10: this combatant's bonus on a saving throw someone else's
   * attack forces (e.g. an enemy like Blightcaller, whose attack targets a
   * save instead of rolling to hit — see `WaveSystem`'s per-attack branch).
   * Absent is treated as a flat, untuned default by whichever caller needs
   * it, same "no ability scores to derive one from" fallback every enemy
   * stat already gets.
   */
  readonly savingThrowBonus?: number;
  /**
   * Phase 21 (D-112): an optional flat damage-absorbing ward (the Shielded
   * archetype). Given the raw HP damage a landed hit is about to deal,
   * returns the reduced amount that should actually come off `health`,
   * decrementing any internal shield pool as a side effect. Absent means no
   * shield — full damage applies, exactly as every pre-Phase-21 caller.
   */
  absorbDamage?(amount: number): number;
  /**
   * Phase 21 (D-112): apply a status effect to this combatant, if it
   * supports one. Both `Enemy.applyStatus` and `Hero.applyStatus` satisfy
   * this signature structurally — it's what lets `WaveSystem` apply
   * `EnemyDefinition.inflictsStatusOnHit` to whichever `Combatant` a hit
   * landed on (a hero, for every enemy that carries the field today) with
   * no per-side special-casing.
   */
  applyStatus?(id: StatusEffectId, durationTurns: number): void;
  /**
   * D-124: this combatant's advantage mode on a saving throw someone else's
   * attack forces (e.g. Barbarian's Danger Sense, always Advantage against a
   * DEX-based forced save — the only kind `WaveSystem` forces on a hero
   * today). Absent is treated as "normal", same fallback `savingThrowBonus`
   * already gets.
   */
  readonly savingThrowAdvantage?: AdvantageMode;
  /**
   * D-124: Rogue/Monk's Evasion — true halves (instead of fully applies) the
   * damage from a FAILED forced saving throw; a successful save already
   * takes 0 damage regardless (SavingThrowSystem's existing rule). Absent
   * (or false) means no change, the pre-D-124 full-damage-on-fail behavior.
   */
  readonly evasionHalvesFailedSave?: boolean;
  /**
   * D-124: Fighter's Indomitable — given a forced saving throw this
   * combatant just FAILED, returns true if it chose (and could afford) to
   * reroll it, consuming a per-rest charge as a side effect. The caller
   * rerolls once more and uses that new result unconditionally, matching
   * the SRD's own "you must use the new roll" wording. Absent means never
   * offered a reroll.
   */
  rerollFailedSave?(): boolean;
  /**
   * D-124: Rogue's Elusive — true means no attack roll against this
   * combatant may have Advantage (an ambush/blinded-enemy Advantage is
   * downgraded to Normal; a Disadvantage from some other source is
   * unaffected). Absent (or false) means no change.
   */
  deniesAttackerAdvantage?(): boolean;
  /**
   * D-125: Barbarian's Reckless Attack — true means every attack roll
   * AGAINST this combatant has Advantage until the start of its next turn
   * (the trade for Advantage on its own attacks, applied directly in
   * `BattleScene.attackProfileFor`). Absent (or false) means no change.
   */
  readonly grantsAttackerAdvantage?: boolean;
  /**
   * D-127: damage types this combatant resists (halves incoming damage from,
   * rounded down) when the attack isn't `magical` — the real SRD Swarm
   * trait's bludgeoning/piercing/slashing resistance. Absent means no
   * resistance, same as every combatant before this decision.
   */
  readonly damageResistances?: ReadonlyArray<DamageType>;
}

/** A single-target attack profile (a basic attack or a single-target ability). */
export interface AttackProfile {
  rangeTiles: number;
  damage: number;
  /** The attacker's to-hit bonus, added to the d20 roll against the target's AC. */
  attackBonus: number;
  /**
   * When true, this attack always hits for full damage with no roll at all —
   * traps (D-039's "traps trigger every time") and the handful of abilities
   * that used to "ignore defense" (armor-piercing shots, save-based spells).
   */
  autoHit?: boolean;
  /** Advantage/disadvantage on the attack roll. Default "normal". Ignored when `autoHit`. */
  advantage?: AdvantageMode;
  /**
   * Phase 13.11 (D-096): the natural roll (out of 20) that counts as a
   * critical hit. Default 20 (only a natural 20 crits) — Champion's Improved
   * Critical/Superior Critical (`Hero.critThreshold`) lower this to 19 or 18.
   * Ignored when `autoHit` (no roll takes place to be critical).
   */
  critThreshold?: number;
  /**
   * D-127: this attack's damage type, for resistance purposes. Absent for
   * every spell/ability attack (this game has no damage-type field on
   * spells) and for a hero with no weapon equipped — resistance only ever
   * applies to a real weapon's B/P/S damage, matching the real SRD Swarm
   * trait's "nonmagical" scope without needing a damage-type field on every
   * spell.
   */
  damageType?: DamageType;
  /**
   * D-127: true bypasses `damageResistances` entirely (an enchanted weapon,
   * or Boon of Irresistible Offense's "damage always ignores Resistance"
   * clause). Ignored when `damageType` is absent.
   */
  magical?: boolean;
}

/** Detail on the d20 roll itself, present whenever an attack actually rolled (not `autoHit`). */
export interface AttackRoll {
  d20: number;
  total: number;
  targetArmorClass: number;
  hit: boolean;
  /** A natural 20: always a hit, and damage is doubled. */
  critical: boolean;
  /** A natural 1: always a miss, regardless of bonuses. */
  fumble: boolean;
}

/** The outcome of applying damage to one target. */
export interface AttackResult {
  targetId: string;
  rawDamage: number;
  /** HP actually removed. 0 on a miss. */
  damageDealt: number;
  healthBefore: number;
  healthAfter: number;
  /** True only on the strike that takes the target from alive to 0 HP. */
  defeated: boolean;
  /** Absent for an `autoHit` attack (no roll took place). */
  roll?: AttackRoll;
}

export class CombatSystem {
  /** Tiles between two positions (Manhattan). 0 means the same tile. */
  static range(a: GridPosition, b: GridPosition): number {
    return GridSystem.manhattanDistance(a, b);
  }

  /** True if `to` is a distinct tile within `rangeTiles` of `from`. */
  static isInRange(from: GridPosition, to: GridPosition, rangeTiles: number): boolean {
    const d = CombatSystem.range(from, to);
    return d > 0 && d <= rangeTiles;
  }

  /** True if a combatant is still on the field and able to be targeted. */
  static isAlive(c: Combatant): boolean {
    return c.health > 0;
  }

  /**
   * Every living candidate within `rangeTiles` of `from` (excludes the tile the
   * attacker stands on). Never mutates its inputs.
   */
  static targetsInRange<T extends Combatant>(
    from: GridPosition,
    rangeTiles: number,
    candidates: ReadonlyArray<T>,
  ): T[] {
    return candidates.filter(
      (c) => CombatSystem.isAlive(c) && CombatSystem.isInRange(from, c.position, rangeTiles),
    );
  }

  /**
   * Deterministically choose the "best" target within range, or null if none.
   * Priority: nearest first, then lowest current health, then lowest id. This
   * makes both the enemy AI and any auto-target fully predictable and testable.
   */
  static chooseTarget<T extends Combatant>(
    from: GridPosition,
    rangeTiles: number,
    candidates: ReadonlyArray<T>,
  ): T | null {
    const inRange = CombatSystem.targetsInRange(from, rangeTiles, candidates);
    if (inRange.length === 0) return null;
    return inRange.reduce((best, c) => {
      const db = CombatSystem.range(from, best.position);
      const dc = CombatSystem.range(from, c.position);
      if (dc !== db) return dc < db ? c : best;
      if (c.health !== best.health) return c.health < best.health ? c : best;
      return c.id < best.id ? c : best;
    });
  }

  /** Damage dealt by a hit: full `rawDamage`, doubled on a critical hit. */
  static computeDamage(rawDamage: number, critical = false): number {
    const dmg = Math.max(0, rawDamage);
    return critical ? dmg * 2 : dmg;
  }

  /**
   * D-127: halve (round down) a landed hit's raw damage if `target` resists
   * `profile.damageType` and the attack isn't `magical`. A no-op for an
   * untyped attack (every spell, and every hero with no weapon equipped) or a
   * target with no matching resistance — every attack before this decision
   * behaves identically.
   */
  private static applyResistance(rawDamage: number, profile: AttackProfile, target: Combatant): number {
    if (!profile.damageType || profile.magical) return rawDamage;
    if (!target.damageResistances?.includes(profile.damageType)) return rawDamage;
    return Math.floor(rawDamage / 2);
  }

  /**
   * Roll an attack against a target's Armor Class. A natural 20 always hits
   * (and crits); a natural 1 always misses regardless of bonuses; otherwise
   * `d20 + attackBonus >= targetArmorClass` decides it.
   */
  static rollAttack(
    targetArmorClass: number,
    attackBonus: number,
    random: RandomService,
    advantage: AdvantageMode = "normal",
    critThreshold = 20,
  ): AttackRoll {
    const d20 = random.rollD20With(advantage);
    const fumble = d20 === 1;
    const critical = !fumble && d20 >= critThreshold;
    const total = d20 + attackBonus;
    const hit = !fumble && (critical || total >= targetArmorClass);
    return { d20, total, targetArmorClass, hit, critical, fumble };
  }

  /**
   * Apply damage to a single target, MUTATING only that target's health, and
   * report the outcome. `defeated` is true only on the transition to 0 HP, so a
   * later phase can react (remove token, award gold) exactly once. Applying an
   * attack to an already-defeated target deals nothing and is not a defeat.
   */
  static applyAttack(target: Combatant, profile: AttackProfile, random: RandomService): AttackResult {
    const healthBefore = target.health;
    if (healthBefore <= 0) {
      return {
        targetId: target.id,
        rawDamage: profile.damage,
        damageDealt: 0,
        healthBefore,
        healthAfter: healthBefore,
        defeated: false,
      };
    }

    if (profile.autoHit) {
      const rawHit = CombatSystem.applyResistance(Math.max(0, profile.damage), profile, target);
      const damageDealt = target.absorbDamage ? target.absorbDamage(rawHit) : rawHit;
      const healthAfter = Math.max(0, healthBefore - damageDealt);
      target.health = healthAfter;
      return {
        targetId: target.id,
        rawDamage: profile.damage,
        damageDealt,
        healthBefore,
        healthAfter,
        defeated: healthBefore > 0 && healthAfter <= 0,
      };
    }

    const roll = CombatSystem.rollAttack(
      target.armorClass ?? 10,
      profile.attackBonus,
      random,
      profile.advantage ?? "normal",
      profile.critThreshold,
    );
    const rawHit = roll.hit
      ? CombatSystem.applyResistance(CombatSystem.computeDamage(profile.damage, roll.critical), profile, target)
      : 0;
    const damageDealt = target.absorbDamage ? target.absorbDamage(rawHit) : rawHit;
    const healthAfter = Math.max(0, healthBefore - damageDealt);
    target.health = healthAfter;
    return {
      targetId: target.id,
      rawDamage: profile.damage,
      damageDealt,
      healthBefore,
      healthAfter,
      defeated: healthBefore > 0 && healthAfter <= 0,
      roll,
    };
  }

  /**
   * Single-target attack that first checks range. Returns null (nothing happens)
   * when the target is out of range or already defeated, so the caller can
   * reject invalid targets cleanly. On success it rolls (or auto-hits) and
   * applies damage.
   */
  static attackSingle(
    from: GridPosition,
    target: Combatant,
    profile: AttackProfile,
    random: RandomService,
  ): AttackResult | null {
    if (!CombatSystem.isAlive(target)) return null;
    if (!CombatSystem.isInRange(from, target.position, profile.rangeTiles)) return null;
    return CombatSystem.applyAttack(target, profile, random);
  }

  /**
   * Area attack: roll (or auto-hit) against EVERY living candidate within
   * `rangeTiles` of `from`, each independently against the same profile.
   * Returns one result per candidate actually in range (a miss still produces
   * a result with `damageDealt: 0`). Order follows `chooseTarget`-style
   * determinism (nearest, then lowest health, then id) so logs read
   * predictably.
   */
  static attackArea<T extends Combatant>(
    from: GridPosition,
    candidates: ReadonlyArray<T>,
    profile: AttackProfile,
    random: RandomService,
  ): AttackResult[] {
    const hit = CombatSystem.targetsInRange(from, profile.rangeTiles, candidates).sort((a, b) => {
      const da = CombatSystem.range(from, a.position);
      const db = CombatSystem.range(from, b.position);
      if (da !== db) return da - db;
      if (a.health !== b.health) return a.health - b.health;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return hit.map((t) => CombatSystem.applyAttack(t, profile, random));
  }
}
