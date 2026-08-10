import { getClassDefinition, type CharacterClassDefinition, type ClassFeature } from "../data/classes";
import { getAbility } from "../data/abilities";
import { isSpellId } from "../data/spells";
import { modifierFor, type AbilityScoreId, type AbilityScores } from "../data/abilityScores";

/**
 * CharacterSystem: pure derived-stat math for the D&D 5.5e character system
 * (Phase 11.1, DECISIONS D-071/D-072/D-073). No Phaser, no dependency on
 * `Hero` directly — `systems/CharacterBuildSystem.ts` is the seam that turns
 * this math into a `HeroDefinition` `BattleScene` can actually play (reached
 * via `CharacterCreationScene`, D-073).
 *
 * Combat stays fully deterministic (D-030): HP-per-level uses the SRD's fixed
 * "average of the hit die, rounded up" option rather than rolling, matching
 * this project's existing no-dice philosophy.
 *
 * Phase 13.3 (D-089): `combatStatsForClassLevel` (near the bottom of this
 * file) computes what a D&D character LEVEL (1-20, tied to a class)
 * provides. Every hero advances a REAL class level on the wave-clear cadence
 * `ProgressionSystem` tracks, via `Hero.levelUpClass()`, which calls this
 * function. It was moved/added here (rather than `CharacterBuildSystem.ts`,
 * which used to own this exact math for level 1 only) so `Hero` — an entity,
 * not a Phaser-touching scene — can reuse the identical formula at any later
 * level without a system depending on another system's build-only helper.
 */

const MIN_LEVEL = 1;
const MAX_LEVEL = 20;

function assertValidLevel(level: number): void {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new Error(`Character level must be an integer between ${MIN_LEVEL} and ${MAX_LEVEL}, got ${level}.`);
  }
}

/**
 * Standard SRD proficiency-bonus-by-level progression: +2 at levels 1-4,
 * rising by 1 every 4 levels, capping at +6 at level 17-20.
 */
export function proficiencyBonusForLevel(level: number): number {
  assertValidLevel(level);
  return 2 + Math.floor((level - 1) / 4);
}

/**
 * Fixed (non-rolled) HP gain for one level beyond the first, per the SRD's
 * "average hit die value, rounded up" rule: half the die plus one.
 */
export function fixedHitDieGain(hitDie: number): number {
  return Math.floor(hitDie / 2) + 1;
}

/**
 * Max HP for a character of this class at this level: max hit die + CON
 * modifier at level 1, then the fixed average gain + CON modifier for every
 * level after. Never returns less than 1 HP per level, mirroring the SRD's
 * per-level floor.
 */
export function maxHitPointsForClass(
  classDef: CharacterClassDefinition,
  level: number,
  constitutionModifier: number,
): number {
  assertValidLevel(level);
  let total = classDef.hitDie + constitutionModifier;
  const perLevelGain = fixedHitDieGain(classDef.hitDie);
  for (let lvl = 2; lvl <= level; lvl++) {
    total += perLevelGain + constitutionModifier;
  }
  return Math.max(total, level);
}

/**
 * How many attacks a basic "Attack" action makes at this level (Extra
 * Attack), by looking up the highest `attacksPerActionByLevel` key at or
 * below the given level.
 */
export function attacksPerActionForClassAtLevel(classDef: CharacterClassDefinition, level: number): number {
  assertValidLevel(level);
  const eligibleLevels = Object.keys(classDef.attacksPerActionByLevel)
    .map(Number)
    .filter((lvl) => lvl <= level)
    .sort((a, b) => b - a);
  if (eligibleLevels.length === 0) {
    throw new Error(`Class "${classDef.id}" has no attacksPerActionByLevel entry at or below level ${level}.`);
  }
  return classDef.attacksPerActionByLevel[eligibleLevels[0]];
}

/**
 * Anything with a `features` list in the class-table shape — satisfied by
 * both `CharacterClassDefinition` and `SubclassDefinition` (Phase 11.3's
 * subclass-content follow-up, D-076), so the three functions below work
 * identically for a class's top-level features or a subclass's.
 */
interface HasFeatures {
  features: ClassFeature[];
}

/** Every feature granted by (i.e. at or before) the given level, in level order. */
export function featuresUpToLevel(source: HasFeatures, level: number): ClassFeature[] {
  assertValidLevel(level);
  return source.features.filter((f) => f.level <= level).sort((a, b) => a.level - b.level);
}

/** Only the feature(s) newly granted AT exactly this level (for a "you leveled up" reveal). */
export function featuresAtLevel(source: HasFeatures, level: number): ClassFeature[] {
  assertValidLevel(level);
  return source.features.filter((f) => f.level === level);
}

/** Features granted so far that actually do something in this game today (see `ClassFeature.mechanicallyActive`). */
export function activeFeaturesUpToLevel(source: HasFeatures, level: number): ClassFeature[] {
  return featuresUpToLevel(source, level).filter((f) => f.mechanicallyActive);
}

/**
 * A class's flat rider damage at this level (e.g. the Rogue's Sneak Attack,
 * Phase 11.3/D-075) — 0 for a class with no such rider. Diceless by design
 * (D-030): converts the SRD's "Nd6" into a flat number using the same
 * "average die value, rounded up" treatment `fixedHitDieGain` already uses
 * for HP, so a class table only needs to record the FLAT total per level,
 * not a die count. Sparse lookup, same shape as `attacksPerActionForClassAtLevel`.
 */
export function bonusDamageForClassAtLevel(classDef: CharacterClassDefinition, level: number): number {
  assertValidLevel(level);
  if (!classDef.bonusDamageByLevel) return 0;
  const eligibleLevels = Object.keys(classDef.bonusDamageByLevel)
    .map(Number)
    .filter((lvl) => lvl <= level)
    .sort((a, b) => b - a);
  if (eligibleLevels.length === 0) return 0;
  return classDef.bonusDamageByLevel[eligibleLevels[0]];
}

const BASE_WEAPON_DAMAGE = 2;
/** An ability with reach at or below this is treated as a melee kit. */
const MELEE_ABILITY_RANGE_THRESHOLD = 1;

/** Melee if the signature ability's reach is short, ranged otherwise. */
export function attackStyleForAbility(abilityId: string): "melee" | "ranged" {
  return getAbility(abilityId).rangeTiles <= MELEE_ABILITY_RANGE_THRESHOLD ? "melee" : "ranged";
}

/** The class-level-dependent combat numbers `heroDefinitionFromBuild`/`Hero.levelUpClass` need. */
export interface LeveledCombatStats {
  maxHealth: number;
  attackDamage: number;
  attackBonus: number;
  attacksPerAction: number;
  /**
   * Phase 17 (D-108): the class-rider portion of `attackDamage` alone (e.g.
   * a future by-level bonus-damage table), WITHOUT `BASE_WEAPON_DAMAGE` or
   * the ability modifier baked in. `Hero.effectiveAttackDamage` adds this on
   * top of a real equipped weapon's own damage, so a class's rider bonus
   * still applies even though the weapon (not this function) now supplies
   * the base+ability-modifier portion. 0 for every class with no
   * `bonusDamageByLevel` table (most of them).
   */
  bonusRiderDamage: number;
}

/**
 * Every combat number that changes when a D&D-built hero's class level
 * changes, computed fresh from the character's fixed ability scores/class/
 * signature ability — the SAME formula `CharacterBuildSystem
 * .heroDefinitionFromBuild` used to compute inline for level 1 only, now
 * reusable at any level so a hero can be re-leveled in place (Phase 13.3,
 * D-089) instead of only ever being built once.
 */
export function combatStatsForClassLevel(
  classId: string,
  level: number,
  abilityScores: AbilityScores,
  abilityId: string,
): LeveledCombatStats {
  const classDef = getClassDefinition(classId);
  const style = attackStyleForAbility(abilityId);
  const conMod = modifierFor(abilityScores, "con");
  // A cast spell scales off the caster's spellcasting ability (Wizard: INT),
  // not the melee/ranged STR-or-DEX split a mundane weapon attack uses — see
  // data/spells.ts for which signature-action ids are spells.
  // Phase 13.8 (D-093): Martial Arts lets a Monk's melee (unarmed) attacks
  // scale off Dexterity instead of Strength — every other class's melee
  // attack still uses Strength.
  const meleeAbility = classId === "monk" ? "dex" : "str";
  const attackMod = isSpellId(abilityId)
    ? modifierFor(abilityScores, classDef.spellcasting?.spellcastingAbility ?? "int")
    : modifierFor(abilityScores, style === "melee" ? meleeAbility : "dex");
  const riderDamage = bonusDamageForClassAtLevel(classDef, level);
  return {
    maxHealth: maxHitPointsForClass(classDef, level, conMod),
    attackDamage: Math.max(1, BASE_WEAPON_DAMAGE + attackMod + riderDamage),
    attackBonus: proficiencyBonusForLevel(level) + attackMod,
    attacksPerAction: attacksPerActionForClassAtLevel(classDef, level),
    bonusRiderDamage: riderDamage,
  };
}

/**
 * Phase 13.5 (D-090): the SRD saving-throw formula — an ability modifier,
 * plus proficiency bonus only if this class is proficient in that saving
 * throw (`classDef.savingThrowProficiencies`, authored since Phase 11.1 but
 * never mechanically read until now).
 */
export function savingThrowBonus(
  classDef: CharacterClassDefinition,
  level: number,
  abilityScores: AbilityScores,
  ability: AbilityScoreId,
): number {
  const proficient = classDef.savingThrowProficiencies.includes(ability);
  return modifierFor(abilityScores, ability) + (proficient ? proficiencyBonusForLevel(level) : 0);
}

/**
 * Phase 13.5 (D-090): the SRD spell save DC formula (8 + proficiency bonus +
 * spellcasting ability modifier) — what a target must meet or beat on a
 * saving throw to resist one of this caster's save-based effects (e.g. the
 * Cleric's Sacred Flame). Throws if the class has no spellcasting to derive
 * a DC from (this should only ever be called for an actual caster).
 */
export function spellSaveDC(classDef: CharacterClassDefinition, level: number, abilityScores: AbilityScores): number {
  if (!classDef.spellcasting) {
    throw new Error(`Class "${classDef.id}" has no spellcasting to derive a spell save DC from.`);
  }
  return 8 + proficiencyBonusForLevel(level) + modifierFor(abilityScores, classDef.spellcasting.spellcastingAbility);
}

/**
 * Phase 13.6 (D-091): true if this class grants an "Ability Score
 * Improvement" choice at EXACTLY this level — every class table names the
 * feature identically ("Ability Score Improvement"), including the
 * Fighter's two bonus ones (levels 6/14, on top of the standard 4/8/12/16/19
 * every class shares), so a single name check works generically instead of
 * hardcoding a level list per class. Used right after `Hero.levelUpClass()`
 * to decide whether the newly-reached level owes the player a choice.
 */
export function asiFeatureGrantedAtLevel(classDef: CharacterClassDefinition, level: number): boolean {
  return featuresAtLevel(classDef, level).some((f) => f.name === "Ability Score Improvement");
}

/**
 * Phase 13.11 (D-096): true if this class's subclass choice (Martial
 * Archetype/Arcane Tradition/Divine Domain/etc.) lands at EXACTLY this
 * level. Used right after `Hero.levelUpClass()`, mirroring
 * `asiFeatureGrantedAtLevel`'s own "just reached it" check — a level of 1
 * (Cleric, Sorcerer, Warlock) is handled separately, at character creation,
 * since `levelUpClass()` never fires for a level a hero already starts at.
 */
export function subclassGrantedAtLevel(classDef: CharacterClassDefinition, level: number): boolean {
  return classDef.subclassChoiceLevel === level;
}
