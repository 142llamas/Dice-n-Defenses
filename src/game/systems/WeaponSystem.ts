import type { WeaponData } from "../data/weapons";

/**
 * WeaponSystem: pure weapon-damage/range math. No Phaser, no entity classes —
 * `Hero` calls in here for `effectiveAttackDamage`/`attackRangeTiles` once a
 * weapon is equipped (Phase 17, D-108).
 *
 * Damage is still a flat number, not a real dice roll (matching this
 * project's existing "damage is deterministic, only hit/miss/crit is
 * randomized" rule, D-086) — `averageDiceDamage` converts a weapon's real
 * SRD damage dice into a flat average using the EXACT SAME "round half up
 * per die" convention `CharacterSystem.fixedHitDieGain` already established
 * for hit-die averages (`floor(size / 2) + 1` per die), so a longsword's
 * 1d8 becomes a flat 5, not a newly-invented rounding rule.
 */

/** Parses "NdM" (e.g. "2d6") or a flat integer string (e.g. "1", the Blowgun). */
function parseDice(dice: string): { count: number; size: number } | { flat: number } {
  const match = /^(\d+)d(\d+)$/.exec(dice.trim());
  if (!match) return { flat: Number(dice) };
  return { count: Number(match[1]), size: Number(match[2]) };
}

/** The flat average damage of a dice expression like "2d6", or a flat number like "1". */
export function averageDiceDamage(dice: string): number {
  const parsed = parseDice(dice);
  if ("flat" in parsed) return parsed.flat;
  return parsed.count * (Math.floor(parsed.size / 2) + 1);
}

/**
 * A weapon's flat attack damage: its dice average (the two-handed
 * `versatileDamageDice` if `twoHandedGrip` and the weapon has one) plus the
 * wielder's relevant ability modifier. Never below 1, matching
 * `CharacterSystem.combatStatsForClassLevel`'s same floor.
 */
export function weaponAttackDamage(weapon: WeaponData, opts: { abilityModifier: number; twoHandedGrip: boolean }): number {
  const dice = opts.twoHandedGrip && weapon.versatileDamageDice ? weapon.versatileDamageDice : weapon.damageDice;
  return Math.max(1, averageDiceDamage(dice) + opts.abilityModifier);
}

/**
 * A weapon's effective reach in this game's grid tiles — abstracted from the
 * SRD's real feet (this game's existing melee/ranged split was already a
 * flat 1-vs-3-tile band; reach/thrown weapons sit at 2, in between):
 * Ammunition weapons (bows, crossbows, sling, blowgun) reach 3 tiles; a
 * Thrown weapon (with no Ammunition property) or a Reach weapon reaches 2;
 * everything else (plain melee) reaches 1.
 */
export function weaponRangeTiles(weapon: WeaponData): number {
  if (weapon.properties.includes("ammunition")) return 3;
  if (weapon.properties.includes("thrown") || weapon.properties.includes("reach")) return 2;
  return 1;
}

/**
 * Which ability modifier a weapon attack uses: a Finesse weapon lets the
 * wielder pick the better of Strength/Dexterity; otherwise a ranged weapon
 * always uses Dexterity and a melee weapon always uses Strength — the exact
 * SRD rule (Dart, a Finesse "ranged"-category weapon, correctly still gets
 * the Finesse choice since that check runs first).
 */
export function weaponAbilityModifier(weapon: WeaponData, strMod: number, dexMod: number): number {
  if (weapon.properties.includes("finesse")) return Math.max(strMod, dexMod);
  return weapon.kind === "ranged" ? dexMod : strMod;
}
