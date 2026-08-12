import type { Combatant } from "./CombatSystem";
import { RandomService, type AdvantageMode } from "./RandomService";

/**
 * SavingThrowSystem — Phase 13.5 (DECISIONS D-090). No Phaser, mirrors
 * `CombatSystem`'s dice-resolution shape exactly: a d20 roll against a target
 * number, natural 20 always succeeds, natural 1 always fails (SRD 5.2.1's
 * general "d20 Test" rule — the same auto-succeed/fail treatment this
 * project already gives an attack roll vs. Armor Class, D-086).
 *
 * `CharacterSystem.savingThrowBonus`/`spellSaveDC` compute the two numbers a
 * save needs (a target's bonus, a DC); this system resolves the roll and, for
 * `applySaveOrDamage`, the resulting damage — the save-or-take-damage
 * equivalent of `CombatSystem.applyAttack` for an ability that targets a
 * saving throw instead of an attack roll (e.g. the Cleric's Sacred Flame).
 */

/** Detail on the d20 roll itself. */
export interface SavingThrowResult {
  d20: number;
  total: number;
  dc: number;
  success: boolean;
}

/** The outcome of a save-or-take-damage effect applied to one target. */
export interface SavingThrowAttackResult {
  targetId: string;
  rawDamage: number;
  /** 0 on a successful save (or an already-defeated target). */
  damageDealt: number;
  healthBefore: number;
  healthAfter: number;
  /** True only on the strike that takes the target from alive to 0 HP. */
  defeated: boolean;
  save: SavingThrowResult;
}

export class SavingThrowSystem {
  /**
   * Roll a saving throw: `bonus` added to a d20, compared to `dc`. A natural
   * 20 always succeeds and a natural 1 always fails, regardless of bonus —
   * matching how this project's attack rolls already treat nat 20/1.
   */
  static rollSave(bonus: number, dc: number, random: RandomService, advantage: AdvantageMode = "normal"): SavingThrowResult {
    const d20 = random.rollD20With(advantage);
    const total = d20 + bonus;
    if (d20 === 20) return { d20, total, dc, success: true };
    if (d20 === 1) return { d20, total, dc, success: false };
    return { d20, total, dc, success: total >= dc };
  }

  /**
   * Apply a save-or-take-damage effect to a single target: roll its saving
   * throw against `dc`; full `damage` on a failed save, none on a success.
   * MUTATES only the target's health, exactly like `CombatSystem.applyAttack`
   * — an already-defeated target takes no damage and rolls no save.
   *
   * D-124: `options.halveOnFail` (Evasion) takes HALF damage instead of full
   * on a failed save; `options.rerollFailedSave` (Indomitable) is offered
   * the chance to reroll a failed save once — if it returns true, a fresh
   * roll REPLACES the first outright (even if worse), matching the SRD's own
   * "you must use the new roll" wording, and only that final roll is
   * reflected in the returned `save`.
   */
  static applySaveOrDamage(
    target: Combatant,
    damage: number,
    dc: number,
    savingThrowBonus: number,
    random: RandomService,
    advantage: AdvantageMode = "normal",
    options?: { halveOnFail?: boolean; rerollFailedSave?: () => boolean },
  ): SavingThrowAttackResult {
    const healthBefore = target.health;
    let save = SavingThrowSystem.rollSave(savingThrowBonus, dc, random, advantage);
    if (!save.success && options?.rerollFailedSave?.()) {
      save = SavingThrowSystem.rollSave(savingThrowBonus, dc, random, advantage);
    }
    if (healthBefore <= 0 || save.success) {
      return { targetId: target.id, rawDamage: damage, damageDealt: 0, healthBefore, healthAfter: healthBefore, defeated: false, save };
    }
    const damageDealt = Math.max(0, options?.halveOnFail ? Math.floor(damage / 2) : damage);
    const healthAfter = Math.max(0, healthBefore - damageDealt);
    target.health = healthAfter;
    return {
      targetId: target.id,
      rawDamage: damage,
      damageDealt,
      healthBefore,
      healthAfter,
      defeated: healthBefore > 0 && healthAfter <= 0,
      save,
    };
  }
}
