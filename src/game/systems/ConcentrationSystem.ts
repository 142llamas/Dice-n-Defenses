import { SavingThrowSystem, type SavingThrowResult } from "./SavingThrowSystem";
import { RandomService, type AdvantageMode } from "./RandomService";

/**
 * ConcentrationSystem — Phase 13.7 (DECISIONS D-092). Framework-only, by
 * Kevin's explicit choice: no spell in this game currently has an ongoing
 * duration effect to protect (Bless/Shield of Faith, the SRD's natural
 * concentration spells, both stay data-only — see `data/spells.ts`), so
 * nothing calls this yet. Built and tested now so whichever future spell
 * needs it (a buff, a summon, a lasting battlefield effect) has a correct,
 * ready-made mechanic to hook into — the same "framework only, no caller
 * yet" treatment `InitiativeSystem` got in Phase 13.5 (D-090).
 *
 * No Phaser, no dependency on `Hero`/`Enemy` — entity-agnostic, mirroring
 * every other pure system in this folder.
 */

/**
 * The SRD's concentration-check DC: half the damage taken (rounded down),
 * minimum 10. `damageTaken` should be the amount from a SINGLE source of
 * damage, not a running total — the SRD rolls one check per hit, not once
 * per turn.
 */
export function concentrationSaveDC(damageTaken: number): number {
  return Math.max(10, Math.floor(damageTaken / 2));
}

/**
 * Roll the Constitution saving throw a concentrating creature makes after
 * taking damage — success means concentration (and whatever spell it's
 * sustaining) continues; failure means it breaks. Thin wrapper over
 * `SavingThrowSystem.rollSave` using `concentrationSaveDC`, so a future
 * caller doesn't need to know the DC formula itself.
 */
export function checkConcentration(
  damageTaken: number,
  constitutionSaveBonus: number,
  random: RandomService,
  advantage: AdvantageMode = "normal",
): SavingThrowResult {
  return SavingThrowSystem.rollSave(constitutionSaveBonus, concentrationSaveDC(damageTaken), random, advantage);
}
