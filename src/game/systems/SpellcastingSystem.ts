import type { CharacterClassDefinition } from "../data/classes";

/**
 * SpellcastingSystem: pure derived math for the spell-slot/known-spells side
 * of the D&D 5.5e character system (Phase 11.2, DECISIONS D-071/D-074). No
 * Phaser, no dependency on `Hero` — mirrors `CharacterSystem`'s treatment of
 * the Fighter's class table, just for a caster's spellcasting progression.
 *
 * Combat stays fully deterministic (D-030) and Phase-2-boundary-honest: this
 * file computes what a Wizard KNOWS/HAS by level (cantrips, slots, prepared
 * spells), but does not spend or track slots during a battle — this game has
 * no resource-spending action economy yet (same boundary as the Fighter's
 * inert Second Wind/Action Surge). Only cantrips (no slot cost) are actually
 * castable in `BattleScene` today, via `data/spells.ts`'s `abilityId` seam.
 */

const MIN_LEVEL = 1;
const MAX_LEVEL = 20;

function assertValidLevel(level: number): void {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new Error(`Character level must be an integer between ${MIN_LEVEL} and ${MAX_LEVEL}, got ${level}.`);
  }
}

/** True if this class has a spellcasting progression at all (e.g. Wizard, not Fighter). */
export function isSpellcaster(classDef: CharacterClassDefinition): boolean {
  return classDef.spellcasting !== undefined;
}

/** How many cantrips a character of this class knows at this level. 0 for a non-caster. */
export function cantripsKnownForClassAtLevel(classDef: CharacterClassDefinition, level: number): number {
  assertValidLevel(level);
  if (!classDef.spellcasting) return 0;
  return lookupSparse(classDef.spellcasting.cantripsKnownByLevel, level) ?? 0;
}

/**
 * Spell slots per spell level at this character level: index 0 is 1st-level
 * slots, index 1 is 2nd-level, etc. Empty array for a non-caster or a level
 * with no slots yet. Always a FRESH array, never a live reference into
 * `classDef.spellcasting.spellSlotsByLevel` — Phase 13.7 (D-092) found the
 * hard way that a caller mutating the returned array (`Hero`'s spell-slot
 * bookkeeping spends a slot by decrementing in place) would otherwise
 * corrupt the shared, module-level data table for every future lookup.
 */
export function spellSlotsForClassAtLevel(classDef: CharacterClassDefinition, level: number): number[] {
  assertValidLevel(level);
  if (!classDef.spellcasting) return [];
  return [...(lookupSparse(classDef.spellcasting.spellSlotsByLevel, level) ?? [])];
}

function lookupSparse<T>(table: Record<number, T>, level: number): T | undefined {
  const eligibleLevels = Object.keys(table)
    .map(Number)
    .filter((lvl) => lvl <= level)
    .sort((a, b) => b - a);
  if (eligibleLevels.length === 0) return undefined;
  return table[eligibleLevels[0]];
}

/**
 * A Wizard prepares a number of spells from their spellbook equal to their
 * Intelligence modifier + Wizard level (SRD 5.2.1, minimum 1). Meaningless
 * for a non-caster.
 */
export function preparedSpellsKnownForWizardAtLevel(level: number, intelligenceModifier: number): number {
  assertValidLevel(level);
  return Math.max(1, level + intelligenceModifier);
}
