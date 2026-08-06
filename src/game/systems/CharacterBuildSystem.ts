import {
  ABILITY_SCORE_IDS,
  STANDARD_ARRAY,
  modifierFor,
  type AbilityScoreId,
  type AbilityScores,
} from "../data/abilityScores";
import { getRaceDefinition } from "../data/races";
import type { HeroDefinition, HeroControlMode } from "../data/heroes";
import { getClassDefinition } from "../data/classes";
import { subclassesForClass } from "../data/subclasses";
import { attackStyleForAbility, combatStatsForClassLevel } from "./CharacterSystem";

// Re-exported for existing callers/tests — this function now lives in
// CharacterSystem.ts (Phase 13.3, D-089) alongside the rest of the pure
// class-level math it's used by, but this file is still where a build
// becomes a playable HeroDefinition.
export { attackStyleForAbility };

/**
 * CharacterBuildSystem: Phase 11.1's "first pass" freeform character creator
 * (DECISIONS D-070/D-071/D-073), extended in Phase 11.2 (D-074) for a second
 * class and again in Phase 11.3 (D-075) for race and two further classes.
 * Pure logic only — no Phaser. Two jobs:
 *
 * 1. `StandardArrayAllocator` lets a player assign the SRD standard array
 *    (15/14/13/12/10/8) across the six ability scores by repeatedly
 *    "cycling" one ability forward — an adjacent swap with whichever
 *    ability currently holds the next slot. This guarantees the assigned
 *    scores are ALWAYS exactly the standard array (a permutation), so a
 *    UI button never needs to validate "did the total change" — it can't.
 *
 * 2. `heroDefinitionFromBuild` turns a finished `CharacterBuild` (name,
 *    race, class, ability scores, a chosen signature action) into the
 *    existing `HeroDefinition` shape `BattleScene` already knows how to
 *    play — this is the ONLY seam between the new D&D character system and
 *    the live game. See BattleScene's `init()`/`buildHeroes()` for where
 *    it's read.
 *
 * Deliberately simple, matching this being level 1 with a still-small class
 * roster:
 * - `attackDamage`/`attackRangeTiles`/`attackBonus`/`maxHealth` all come from
 *   `CharacterSystem.combatStatsForClassLevel` — the ability-modifier/rider-
 *   damage math (STR/DEX for a mundane attack, or the caster's spellcasting
 *   ability (Wizard/Cleric: INT/WIS) if the chosen action is a spell) lives
 *   there now, not here, so `Hero.levelUpClass()` (Phase 13.3, D-089) can
 *   reuse the identical formula at any later level, not just level 1. There's
 *   still no weapon catalogue (that's Phase 11.5).
 * - `movementTiles` comes from the build's race (`getRaceDefinition`,
 *   Phase 11.3, D-075) — the SRD's 30ft/25ft speed split.
 * - `level` is always 1 here — a build always STARTS at level 1. What
 *   happens after character creation is Phase 13.3's job: a D&D-built hero
 *   (this file's product) now advances a REAL class level on the existing
 *   wave-based cadence via `Hero.levelUpClass()`, instead of the classic
 *   fixed roster's flat Vigor/Might `ProgressionSystem` choice — see D-089.
 * - Phase 13.1 (D-086): `attackBonus` is real SRD math — proficiency bonus
 *   (`proficiencyBonusForLevel`) plus the same ability modifier used for
 *   `attackDamage`'s rider. `baseArmorClass` is 10 + the build's Dex
 *   modifier (unarmored AC — there's no armor-item catalogue driving this
 *   yet, same boundary as `attackDamage`'s "no weapon catalogue" note).
 */

const MELEE_RANGE_TILES = 1;
const RANGED_RANGE_TILES = 3;

export class StandardArrayAllocator {
  private order: AbilityScoreId[];

  constructor(initialOrder: AbilityScoreId[] = ABILITY_SCORE_IDS) {
    this.order = [...initialOrder];
  }

  /** The current assignment: each ability mapped to its standard-array value. */
  scores(): AbilityScores {
    const result = {} as AbilityScores;
    this.order.forEach((ability, i) => {
      result[ability] = STANDARD_ARRAY[i];
    });
    return result;
  }

  /**
   * Advance `ability` to the next standard-array slot, swapping with
   * whichever ability currently holds it. Six calls on the same ability
   * return the allocator to its starting assignment. Repeatedly cycling
   * DIFFERENT abilities can reach any permutation (adjacent-swap sort).
   */
  cycle(ability: AbilityScoreId): void {
    const i = this.order.indexOf(ability);
    const j = (i + 1) % this.order.length;
    const tmp = this.order[i];
    this.order[i] = this.order[j];
    this.order[j] = tmp;
  }
}

/**
 * Reconstruct an allocator whose `.scores()` matches a stored `AbilityScores`
 * object — the inverse of `.scores()` (Phase 9, D-083: loading a saved party
 * needs to seed a fresh allocator from what was saved). `STANDARD_ARRAY`'s
 * values are all distinct, so sorting abilities by "which standard-array slot
 * holds this ability's score" reconstructs the exact order that produced it.
 * Falls back to the default order if `scores` isn't a valid standard-array
 * permutation (e.g. hand-edited or corrupt save data) — same "deliberately
 * simple, defensive" style as the rest of this file.
 */
export function allocatorFromScores(scores: AbilityScores): StandardArrayAllocator {
  const order = [...ABILITY_SCORE_IDS].sort(
    (a, b) => STANDARD_ARRAY.indexOf(scores[a]) - STANDARD_ARRAY.indexOf(scores[b]),
  );
  const sortedValues = order.map((ability) => scores[ability]).sort((a, b) => a - b);
  const sortedStandard = [...STANDARD_ARRAY].sort((a, b) => a - b);
  const isValidPermutation = sortedValues.every((v, i) => v === sortedStandard[i]);
  return new StandardArrayAllocator(isValidPermutation ? order : ABILITY_SCORE_IDS);
}

export interface CharacterBuild {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  level: number;
  abilityScores: AbilityScores;
  abilityId: string;
  /** Phase 11.4 (D-077): who plays this slot in battle. Defaults to "human". */
  controlledBy: HeroControlMode;
  /**
   * Phase 13.11 (D-096): set only for a class whose subclass choice lands at
   * level 1 (see `subclassIdForNewBuild`) — every other class starts
   * undefined and gets a subclass assigned later, in battle. Computed
   * alongside the rest of a fresh build, from `CharacterCreationScene`'s own
   * subclass-picker cycle button (Phase 14.2, D-099 — two options exist per
   * class now, so this is a real player choice, not an auto-pick).
   */
  subclassId?: string;
  /** Phase 13.11 (D-096): one common/uncommon item picked at creation, or undefined for "None". */
  startingEquipmentId?: string;
}

/**
 * Phase 13.11 (D-096): a class whose subclass choice lands at level 1
 * (Cleric, Sorcerer, Warlock today) already has one the instant it's
 * created — there's no later level-up moment to assign it at, unlike
 * Fighter/Wizard/Rogue (see `BattleScene`'s subclass-choice queue). Returns
 * undefined for every other class.
 *
 * Phase 14.2 (D-099): `subclassIndex` picks WHICH of that class's two
 * modeled subclasses to assign (0 = the SRD one, 1 = the original one, per
 * `subclassesForClass`'s registration order) — `CharacterCreationScene`'s
 * new subclass-picker cycle button passes the player's actual choice
 * through here. Defaults to 0 so every existing caller (including tests)
 * keeps its prior behavior unchanged.
 */
export function subclassIdForNewBuild(classId: string, subclassIndex = 0): string | undefined {
  if (getClassDefinition(classId).subclassChoiceLevel !== 1) return undefined;
  return subclassesForClass(classId)[subclassIndex]?.id;
}

/**
 * Turn a finished character build into the HeroDefinition shape BattleScene
 * plays. Phase 13.3 (D-089): also carries the build's `abilityScores`
 * forward onto the definition — `Hero.levelUpClass()` needs them to redo
 * this same math at any later level, not just level 1.
 */
export function heroDefinitionFromBuild(build: CharacterBuild): HeroDefinition {
  const stats = combatStatsForClassLevel(build.classId, build.level, build.abilityScores, build.abilityId);
  const style = attackStyleForAbility(build.abilityId);
  const dexMod = modifierFor(build.abilityScores, "dex");
  return {
    id: build.id,
    name: build.name,
    movementTiles: getRaceDefinition(build.raceId).speedTiles,
    maxHealth: stats.maxHealth,
    attackDamage: stats.attackDamage,
    attackRangeTiles: style === "melee" ? MELEE_RANGE_TILES : RANGED_RANGE_TILES,
    attackBonus: stats.attackBonus,
    baseArmorClass: 10 + dexMod,
    abilityId: build.abilityId,
    controlledBy: build.controlledBy,
    // Phase 13.2 (D-087): the seam that lets class-gated action-economy
    // features (Second Wind, Action Surge, Cunning Action, Uncanny Dodge)
    // know which hero qualifies. See HeroDefinition's own comment.
    classId: build.classId,
    // Phase 13.3 (D-089): kept so a later class level-up can redo this
    // file's math (recompute maxHealth/attackDamage/attackBonus) itself.
    abilityScores: build.abilityScores,
    // Phase 13.11 (D-096): a level-1-choice class's subclass, if any; a
    // later-choice class stays undefined until BattleScene assigns one.
    subclassId: build.subclassId,
    startingEquipmentId: build.startingEquipmentId,
    // Phase 17 (D-108): the class-rider portion of attackDamage (e.g. a
    // future by-level bonus-damage table), kept SEPARATE from the base+
    // ability-modifier portion so a real equipped weapon can replace just
    // that portion later — see Hero.effectiveAttackDamage.
    classRiderDamage: stats.bonusRiderDamage,
  };
}

/** True if two or more builds share a signature ability (each hero should feel distinct). */
export function hasDuplicateAbilities(builds: ReadonlyArray<CharacterBuild>): boolean {
  const ids = builds.map((b) => b.abilityId);
  return new Set(ids).size !== ids.length;
}

/** True if two or more builds share a name. */
export function hasDuplicateNames(builds: ReadonlyArray<CharacterBuild>): boolean {
  const names = builds.map((b) => b.name);
  return new Set(names).size !== names.length;
}
