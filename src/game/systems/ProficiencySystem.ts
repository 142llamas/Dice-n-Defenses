import { getEquipmentDefinition } from "../data/equipment";
import { getClassDefinition } from "../data/classes";
import { WEAPON_PROFICIENCIES } from "../data/proficiencies";
import { handsCategoryOf } from "./GearFilterSystem";

/**
 * ProficiencySystem — D-235 (item 7): the answer to "is there a weapon-
 * proficiency system? If so, auto-filter out items a class can't use."
 * Pure, no Phaser dependency — `GearFilterSystem.applyCatalogFilters`/
 * `GearShopScene`/`CharacterCreationScene` all call this to decide whether
 * a Hands-tab item should be hidden for a given hero's class.
 *
 * A real Shield's own proficiency isn't modeled (no armor/shield-
 * proficiency system exists or is being added this pass — this is a
 * WEAPON-proficiency system, matching exactly what was asked) — every class
 * can use a real Shield. A spellcasting focus is gated by whether the class
 * casts spells at all, not by weapon category.
 */
export function isProficientWithHandsItem(classId: string, itemId: string): boolean {
  const category = handsCategoryOf(itemId);
  if (category === null) return true; // not a weapon/shield/focus item — weapon proficiency doesn't apply
  if (category === "shield") return true;
  if (category === "focus") return getClassDefinition(classId).spellcasting !== undefined;

  const def = getEquipmentDefinition(itemId);
  const weapon = def.weapon;
  if (!weapon) return true; // unreachable in practice (handsCategoryOf already implies a weapon here), kept for type safety
  const proficiency = WEAPON_PROFICIENCIES[classId];
  if (!proficiency) return true; // an unrecognized/non-creatable classId — fail open rather than hide everything
  if (proficiency.martialWeapons || weapon.category === "simple") return true;
  return (proficiency.martialExceptionProperties ?? []).some((p) => weapon.properties.includes(p));
}
