import { cantripIdsForClass, leveledSpellIdsForClass } from "../data/characterCreation";
import { getClassDefinition } from "../data/classes";
import { cantripsKnownForClassAtLevel, spellSlotsForClassAtLevel } from "./SpellcastingSystem";

/**
 * SpellPreparationSystem — D-134's real SRD 5.2.1 spell-preparation
 * economy. Pure logic only, no Phaser, no `Hero` dependency (mirrors this
 * project's other systems' "rules live here, entities/scenes just call
 * in" separation).
 *
 * SRD 5.2.1 (2024 rules) eliminated the classic 2014 "some classes KNOW a
 * fixed list, others PREPARE from the full list" split — verified directly
 * against the source (not assumed from memory, see D-134's decision entry
 * for the full research trail). Every class "prepares" now; they differ
 * only in how OFTEN/how MUCH they can change what's prepared. That leaves
 * exactly two reusable mechanisms, not eight bespoke ones:
 *
 * - `"fullRelistLongRest"` (Wizard/Cleric/Druid): every Long Rest, replace
 *   the ENTIRE prepared list with any other spells from the eligible pool.
 * - `"replaceOneLongRest"` (Paladin/Ranger) / `"replaceOneLevelUp"`
 *   (Sorcerer/Bard/Warlock): change exactly ONE spell, only at that
 *   specific trigger.
 *
 * Cantrips use the exact same trigger concept as a SEPARATE, independent
 * setting per class (`cantripSwapTrigger`) — e.g. a Cleric fully relists
 * its LEVELED spells every Long Rest, but only swaps one CANTRIP on
 * level-up; a Wizard swaps a cantrip on Long Rest, matching its own
 * leveled-spell cadence exactly.
 *
 * A Wizard's spellbook is a third, additive layer: an ever-growing list of
 * "known" spells (no swap/forget) that its Long-Rest full relist chooses
 * FROM, instead of the full class list every other full/half caster draws
 * from directly.
 *
 * Phase 1 (this decision) is data + these pure functions only — no
 * Character Creation UI, no in-battle "Prepare Spells"/swap UI yet (see
 * `DECISIONS.md`'s D-134 for the full phased plan). `Hero.ts` uses
 * `defaultFill` to auto-populate a sane starting/growing selection in the
 * meantime, the same "silent default until a real picker exists" precedent
 * D-129/D-133 already established elsewhere in this project.
 */

const MIN_LEVEL = 1;
const MAX_LEVEL = 20;

function assertValidLevel(level: number): void {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new Error(`Character level must be an integer between ${MIN_LEVEL} and ${MAX_LEVEL}, got ${level}.`);
  }
}

export type SpellSwapTier = "fullRelistLongRest" | "replaceOneLongRest" | "replaceOneLevelUp";
export type SpellSwapTrigger = "longRest" | "levelUp";

export interface SpellEconomy {
  /** How many leveled spells this class has prepared at a given level — a flat SRD 5.2.1 table, no ability-modifier term (a real change from the 2014 rules). */
  preparedCountByLevel: Record<number, number>;
  /** How often/how much this class's PREPARED LEVELED SPELLS can change. */
  swapTier: SpellSwapTier;
  /** How often this class's KNOWN CANTRIPS can change — independent of `swapTier`; several classes differ between the two (see module comment). */
  cantripSwapTrigger: SpellSwapTrigger;
}

// ---------------------------------------------------------------------
// Verified SRD 5.2.1 prepared-spell-count tables (D-134). Every class's
// count only ever grows level over level, never shrinks.
// ---------------------------------------------------------------------

const WIZARD_PREPARED_BY_LEVEL: Record<number, number> = {
  1: 4,
  2: 5,
  3: 6,
  4: 7,
  5: 9,
  6: 10,
  7: 11,
  8: 12,
  9: 14,
  10: 15,
  11: 16,
  12: 16,
  13: 17,
  14: 18,
  15: 19,
  16: 21,
  17: 22,
  18: 23,
  19: 24,
  20: 26,
};

/** Shared by Cleric, Druid, Sorcerer, and Bard — identical table, verified independently across all four. */
const NINE_LEVEL_CASTER_PREPARED_BY_LEVEL: Record<number, number> = {
  1: 4,
  2: 5,
  3: 6,
  4: 7,
  5: 9,
  6: 10,
  7: 11,
  8: 12,
  9: 14,
  10: 15,
  11: 16,
  12: 16,
  13: 17,
  14: 17,
  15: 18,
  16: 18,
  17: 19,
  18: 20,
  19: 21,
  20: 22,
};

/** Shared by Paladin and Ranger — starts at level 1 (D-134: SRD 5.2.1 moved this earlier than the 2014 rules' level 2). */
const HALF_CASTER_PREPARED_BY_LEVEL: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 6,
  7: 7,
  8: 7,
  9: 9,
  10: 9,
  11: 10,
  12: 10,
  13: 11,
  14: 11,
  15: 12,
  16: 12,
  17: 14,
  18: 14,
  19: 15,
  20: 15,
};

/** Warlock's own table (Pact Magic's "Prepared Spells" count — distinct from its slot count, which stays the D-093 full-caster-table simplification, unchanged by this decision). */
const WARLOCK_PREPARED_BY_LEVEL: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  10: 10,
  11: 11,
  12: 11,
  13: 12,
  14: 12,
  15: 13,
  16: 13,
  17: 14,
  18: 14,
  19: 15,
  20: 15,
};

const SPELL_ECONOMIES: Record<string, SpellEconomy> = {
  wizard: { preparedCountByLevel: WIZARD_PREPARED_BY_LEVEL, swapTier: "fullRelistLongRest", cantripSwapTrigger: "longRest" },
  cleric: { preparedCountByLevel: NINE_LEVEL_CASTER_PREPARED_BY_LEVEL, swapTier: "fullRelistLongRest", cantripSwapTrigger: "levelUp" },
  druid: { preparedCountByLevel: NINE_LEVEL_CASTER_PREPARED_BY_LEVEL, swapTier: "fullRelistLongRest", cantripSwapTrigger: "levelUp" },
  sorcerer: { preparedCountByLevel: NINE_LEVEL_CASTER_PREPARED_BY_LEVEL, swapTier: "replaceOneLevelUp", cantripSwapTrigger: "levelUp" },
  bard: { preparedCountByLevel: NINE_LEVEL_CASTER_PREPARED_BY_LEVEL, swapTier: "replaceOneLevelUp", cantripSwapTrigger: "levelUp" },
  warlock: { preparedCountByLevel: WARLOCK_PREPARED_BY_LEVEL, swapTier: "replaceOneLevelUp", cantripSwapTrigger: "levelUp" },
  paladin: { preparedCountByLevel: HALF_CASTER_PREPARED_BY_LEVEL, swapTier: "replaceOneLongRest", cantripSwapTrigger: "levelUp" },
  ranger: { preparedCountByLevel: HALF_CASTER_PREPARED_BY_LEVEL, swapTier: "replaceOneLongRest", cantripSwapTrigger: "levelUp" },
};

/** This class's full spell economy, or undefined for a non-caster. */
export function spellEconomyForClass(classId: string): SpellEconomy | undefined {
  return SPELL_ECONOMIES[classId];
}

/** How many leveled spells this class has prepared/known at this level. 0 for a non-caster. */
export function preparedSpellCountForClassAtLevel(classId: string, level: number): number {
  assertValidLevel(level);
  return SPELL_ECONOMIES[classId]?.preparedCountByLevel[level] ?? 0;
}

/** True if this class's PREPARED LEVELED SPELLS can change at this trigger. `"fullRelistLongRest"`/`"replaceOneLongRest"` both answer this at `"longRest"`; only the UI (a future phase) needs to know whether that means "pick your whole list again" or "swap exactly one." */
export function canSwapLeveledSpellAt(classId: string, trigger: SpellSwapTrigger): boolean {
  const economy = SPELL_ECONOMIES[classId];
  if (!economy) return false;
  if (economy.swapTier === "replaceOneLevelUp") return trigger === "levelUp";
  return trigger === "longRest";
}

/** True if this class's KNOWN CANTRIPS can change at this trigger — a separate setting from `canSwapLeveledSpellAt` (see module comment). */
export function canSwapCantripAt(classId: string, trigger: SpellSwapTrigger): boolean {
  return SPELL_ECONOMIES[classId]?.cantripSwapTrigger === trigger;
}

// ---------------------------------------------------------------------
// Wizard's spellbook — an ever-growing, never-shrinking "known" pool the
// full-relist mechanism prepares FROM, instead of the full class list.
// ---------------------------------------------------------------------

export const WIZARD_SPELLBOOK_STARTING_COUNT = 6;
export const WIZARD_SPELLBOOK_GROWTH_PER_LEVEL = 2;

/** How many spells a Wizard's spellbook holds by this level (6 at level 1, +2 per level thereafter — SRD 5.2.1, verified). Meaningless for any other class. */
export function wizardSpellbookSizeAtLevel(level: number): number {
  assertValidLevel(level);
  return WIZARD_SPELLBOOK_STARTING_COUNT + WIZARD_SPELLBOOK_GROWTH_PER_LEVEL * (level - 1);
}

// ---------------------------------------------------------------------
// Eligible pools — wrap `characterCreation.ts`'s existing per-class arrays
// unchanged. Re-verifying which of the 319 existing spells truly belong to
// each class's real 5.2.1 list is a separate, much larger research task,
// explicitly out of scope for this decision (D-134).
// ---------------------------------------------------------------------

/** Every cantrip a hero of this class could know — the pool `chooseCantrips`/a future picker UI selects from. Empty for a non-caster. */
export function eligibleCantripPool(classId: string): string[] {
  return cantripIdsForClass(classId);
}

/** Every leveled spell a hero of this class could prepare/know (and, for a Wizard, could learn into its spellbook) — the pool a future picker UI selects from. Empty for a non-caster. */
export function eligibleLeveledSpellPool(classId: string): string[] {
  return leveledSpellIdsForClass(classId);
}

// ---------------------------------------------------------------------
// Validation + the interim default-fill helper.
// ---------------------------------------------------------------------

/** True if `selectedIds` is a legal selection: no duplicates, every id drawn from `pool`, and no more than `maxCount` of them. Used to validate a real player pick (a future phase's job) — never chooses FOR the player. */
export function isValidSelection(pool: readonly string[], selectedIds: readonly string[], maxCount: number): boolean {
  if (selectedIds.length > maxCount) return false;
  if (new Set(selectedIds).size !== selectedIds.length) return false;
  return selectedIds.every((id) => pool.includes(id));
}

/**
 * Deterministically extends `alreadySelected` with the first not-yet-picked
 * ids from `pool`, in list order, until it reaches `count` (or the pool
 * runs out) — the same "sane, silent default" this project's level-up
 * machinery already uses wherever a real choice-UI doesn't exist yet for a
 * slice (D-129's Starting Level fast-forward, D-133's plan-less hero
 * fallback). `Hero.ts` uses this to auto-populate a starting/growing
 * prepared-spell list, cantrip list, and Wizard spellbook until a future
 * phase adds the real picker.
 */
export function defaultFill(pool: readonly string[], alreadySelected: readonly string[], count: number): string[] {
  const result = [...alreadySelected];
  for (const id of pool) {
    if (result.length >= count) break;
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

// ---------------------------------------------------------------------
// Phase 2 (D-135): a Character Creation spell-picker UI's own step
// sequence — which screens a class needs, in order, at a given level.
// ---------------------------------------------------------------------

export type SpellPickStepKind = "spellbook" | "cantrips" | "prepared";

/**
 * Which spell-pick screens a class needs at a given level, in order — a
 * Wizard's `"spellbook"` step comes first since its result is the pool the
 * `"prepared"` step draws from (mirrors `Hero.growSpellSelections`'s own
 * pool choice); `"cantrips"`/`"prepared"` are each included only if the
 * class both has a nonzero count at this level AND an actual eligible pool
 * to pick from. That second check matters for Paladin/Ranger specifically:
 * both have a real, nonzero `preparedSpellCountForClassAtLevel` (their half-
 * caster spell-slot economy is real), but an EMPTY eligible pool — their
 * one in-game consequence (Divine Smite/Hunter's Mark) lives outside the
 * normal spell list (see `eligibleLeveledSpellPool`'s own test coverage) —
 * so they'd otherwise get an unsatisfiable "pick 2 of 0" step. Empty for a
 * non-caster.
 */
export function spellPickStepsForClass(classId: string, level: number): SpellPickStepKind[] {
  const steps: SpellPickStepKind[] = [];
  if (classId === "wizard") steps.push("spellbook");
  if (cantripsKnownForClassAtLevel(getClassDefinition(classId), level) > 0 && eligibleCantripPool(classId).length > 0) {
    steps.push("cantrips");
  }
  if (preparedSpellCountForClassAtLevel(classId, level) > 0 && eligibleLeveledSpellPool(classId).length > 0) {
    steps.push("prepared");
  }
  return steps;
}

// ---------------------------------------------------------------------
// Phase 3 (D-136): the in-battle swap-opportunity step sequence — which
// swap screens a class needs at a given LIVE trigger (a Long Rest just
// taken, or a level just gained), as opposed to `spellPickStepsForClass`'s
// one-time Character Creation starting pick. No "spellbook" kind here —
// Phase 3 never re-relists a Wizard's spellbook, only what's prepared FROM
// it (see D-136 for why that's deliberately out of scope).
// ---------------------------------------------------------------------

export type SpellSwapStepKind = "cantrips" | "prepared";

/**
 * Which swap screens a class needs right now, at this trigger — mirrors
 * `spellPickStepsForClass`'s own double-check (a nonzero count AND a real
 * eligible pool), so Paladin/Ranger correctly get zero steps at either
 * trigger, matching their existing "moot" Character Creation treatment
 * (their one in-game consequence lives outside the normal spell list).
 * Empty for a non-caster or a class/trigger combination with nothing to
 * swap (e.g. Cleric/Druid's PREPARED list only at `"longRest"`, never
 * `"levelUp"` — their prepared cadence is a full relist, Long-Rest only).
 */
export function spellSwapStepsForClass(classId: string, level: number, trigger: SpellSwapTrigger): SpellSwapStepKind[] {
  const steps: SpellSwapStepKind[] = [];
  const classDef = getClassDefinition(classId);
  if (
    canSwapCantripAt(classId, trigger) &&
    cantripsKnownForClassAtLevel(classDef, level) > 0 &&
    eligibleCantripPool(classId).length > 0
  ) {
    steps.push("cantrips");
  }
  if (
    canSwapLeveledSpellAt(classId, trigger) &&
    preparedSpellCountForClassAtLevel(classId, level) > 0 &&
    eligibleLeveledSpellPool(classId).length > 0
  ) {
    steps.push("prepared");
  }
  return steps;
}

/**
 * True if this class's PREPARED-spell swap is a full relist (a toggle-many-
 * then-confirm screen); false means "replace exactly one" (a drop-then-
 * learn two-screen flow). Only meaningful for the `"prepared"` step kind —
 * a cantrip swap is always "replace one," matching the real SRD rule (no
 * class ever fully re-relists its cantrips), so `spellSwapStepsForClass`'s
 * `"cantrips"` step never consults this.
 */
export function preparedSwapIsFullRelist(classId: string): boolean {
  return spellEconomyForClass(classId)?.swapTier === "fullRelistLongRest";
}

/**
 * Highest spell level this class can actually cast at `level` — the same
 * castable-level DISPLAY filter D-135's Character Creation spell picker
 * uses (there as a private `CharacterCreationScene.maxCastableSpellLevel`),
 * promoted here so Phase 3's in-battle screens can filter against a hero's
 * CURRENT level without duplicating the math. Never changes the canonical
 * eligible pool itself, only what a picker screen displays.
 */
export function maxCastableSpellLevel(classId: string, level: number): number {
  const slots = spellSlotsForClassAtLevel(getClassDefinition(classId), level);
  let max = 0;
  slots.forEach((count, i) => {
    if (count > 0) max = i + 1;
  });
  return max;
}
