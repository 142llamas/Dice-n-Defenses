import type { WeaponProperty } from "./weapons";

/**
 * Weapon proficiencies — D-235 (item 7). Real SRD 5.2.1 "Weapon
 * Proficiencies" line from each class's Core Traits table (verified against
 * a 2024-SRD mirror during implementation, not assumed from memory — see
 * `feedback_verify_srd_content_dont_assume`), matching this project's
 * existing SRD 5.2.1 sourcing for `data/classes.ts`/`data/weapons.ts`.
 *
 * Every one of the 12 classes gets Simple weapons — that's universal in the
 * real rules, not a per-class variable — so `simpleWeapons` is always
 * `true` here; it's still listed explicitly per class for the same reason
 * every class explicitly lists its own saving-throw proficiencies in
 * `classes.ts` rather than leaving a "same for everyone" case implicit.
 *
 * The 2024 SRD also gives Cleric (Divine Order → Protector) and Druid
 * (Primal Order → Warden) an OPTIONAL level-1 choice to gain full Martial
 * proficiency instead of the base Simple-only line. `classes.ts` never
 * modeled Divine Order/Primal Order (only Divine Domain/a different level-1
 * choice) — adding that choice mechanic is out of scope for a proficiency
 * FILTER pass, so both are modeled here as their base (Simple-only) line.
 *
 * `spellFociAllowed` is deliberately NOT a field here — whether a class can
 * use a spellcasting focus is fully derived from `getClassDefinition(id)
 * .spellcasting !== undefined` (already this project's own "present only
 * for caster classes" signal, see `ProficiencySystem.ts`), avoiding a
 * second source of truth that could drift out of sync with `classes.ts`.
 */
export interface ClassWeaponProficiency {
  readonly simpleWeapons: true;
  readonly martialWeapons: boolean;
  /** Martial weapons with ANY of these properties are usable even without full `martialWeapons`. */
  readonly martialExceptionProperties?: readonly WeaponProperty[];
}

export const WEAPON_PROFICIENCIES: Record<string, ClassWeaponProficiency> = {
  barbarian: { simpleWeapons: true, martialWeapons: true },
  fighter: { simpleWeapons: true, martialWeapons: true },
  paladin: { simpleWeapons: true, martialWeapons: true },
  ranger: { simpleWeapons: true, martialWeapons: true },
  monk: { simpleWeapons: true, martialWeapons: false, martialExceptionProperties: ["light"] },
  rogue: { simpleWeapons: true, martialWeapons: false, martialExceptionProperties: ["finesse", "light"] },
  bard: { simpleWeapons: true, martialWeapons: false },
  cleric: { simpleWeapons: true, martialWeapons: false },
  druid: { simpleWeapons: true, martialWeapons: false },
  sorcerer: { simpleWeapons: true, martialWeapons: false },
  warlock: { simpleWeapons: true, martialWeapons: false },
  wizard: { simpleWeapons: true, martialWeapons: false },
};
