import {
  ABILITY_SCORE_IDS,
  STANDARD_ARRAY,
  modifierFor,
  type AbilityScoreId,
  type AbilityScores,
} from "../data/abilityScores";
import { getRaceDefinition, RACE_IDS } from "../data/races";
import type { HeroDefinition, HeroControlMode } from "../data/heroes";
import { getClassDefinition } from "../data/classes";
import { subclassesForClass } from "../data/subclasses";
import { attackStyleForClass, combatStatsForClassLevel } from "./CharacterSystem";
import { CREATABLE_CLASS_IDS, CHARACTER_NAME_POOL } from "../data/characterCreation";
import type { LevelUpPlan } from "./LevelUpPlanSystem";
import type { GearSlotId } from "../data/equipment";

// Re-exported for existing callers/tests — this function now lives in
// CharacterSystem.ts (Phase 13.3, D-089) alongside the rest of the pure
// class-level math it's used by, but this file is still where a build
// becomes a playable HeroDefinition.
export { attackStyleForClass };

/**
 * CharacterBuildSystem: Phase 11.1's "first pass" freeform character creator
 * (DECISIONS D-070/D-071/D-073), extended in Phase 11.2 (D-074) for a second
 * class and again in Phase 11.3 (D-075) for race and two further classes.
 * Pure logic only — no Phaser. Two jobs:
 *
 * 1. `StandardArrayAllocator` lets a player assign the SRD standard array
 *    (15/14/13/12/10/8) across the six ability scores directly, one ability
 *    at a time (Party Creation Overhaul Plan 1.1's `assign()`) — picking a
 *    value already claimed by another ability swaps the two abilities'
 *    values instead of rejecting the pick, and an ability can sit unset
 *    ("—", `null`) mid-edit. This still guarantees every ASSIGNED score is
 *    exactly one of the standard array's six values (never invented), but
 *    unlike the old cycle-only model, the allocator can be genuinely
 *    incomplete — see `isComplete()`.
 *
 * 2. `heroDefinitionFromBuild` turns a finished `CharacterBuild` (name,
 *    race, class, ability scores) into the existing `HeroDefinition` shape
 *    `BattleScene` already knows how to play — this is the ONLY seam between
 *    the new D&D character system and the live game. See BattleScene's
 *    `init()`/`buildHeroes()` for where it's read.
 *
 * Deliberately simple, matching this being level 1 with a still-small class
 * roster:
 * - `attackDamage`/`attackRangeTiles`/`attackBonus`/`maxHealth` all come from
 *   `CharacterSystem.combatStatsForClassLevel` — the ability-modifier/rider-
 *   damage math (each class's own fixed `primaryAbility`/`basicAttackStyle`,
 *   D-178 — no more player-chosen "signature action") lives there now, not
 *   here, so `Hero.levelUpClass()` (Phase 13.3, D-089) can reuse the
 *   identical formula at any later level, not just level 1. There's still no
 *   weapon catalogue baked into this baseline (a real equipped weapon
 *   overrides it — see `Hero.effectiveAttackDamage`/`attackRangeTiles`).
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

/**
 * D-147 (Character Creation overhaul, piece 3): the shared contract both
 * ability-score allocation methods implement, so `CharacterCreationScene`
 * can hold either kind in one `SlotState.allocator` field and read a build's
 * final scores the same way regardless of which method the player picked.
 */
export interface AbilityScoreAllocator {
  scores(): AbilityScores;
}

export class StandardArrayAllocator implements AbilityScoreAllocator {
  private assignments: Partial<Record<AbilityScoreId, number>>;

  constructor(initialOrder: AbilityScoreId[] = ABILITY_SCORE_IDS) {
    this.assignments = {};
    initialOrder.forEach((ability, i) => {
      this.assignments[ability] = STANDARD_ARRAY[i];
    });
  }

  /**
   * The current assignment. An unset ability (Party Creation Overhaul,
   * Plan 1.1's "—" dropdown option) reads as 10 (neutral, no modifier) here
   * purely so preview math (scratch-Hero HP/AC, etc.) never sees
   * `undefined` mid-edit — this never reaches Save/Start, which are gated
   * on `isComplete()` until every ability is really assigned.
   */
  scores(): AbilityScores {
    const result = {} as AbilityScores;
    ABILITY_SCORE_IDS.forEach((ability) => {
      result[ability] = this.assignments[ability] ?? 10;
    });
    return result;
  }

  /** The raw assigned value, or null if this ability is unset ("—"). */
  valueFor(ability: AbilityScoreId): number | null {
    return this.assignments[ability] ?? null;
  }

  /** True once every ability has a real assigned value (no "—" left). */
  isComplete(): boolean {
    return ABILITY_SCORE_IDS.every((ability) => this.assignments[ability] !== undefined);
  }

  /**
   * Party Creation Overhaul Plan 1.1: assign `value` directly to `ability`.
   * `value === null` clears it to "—" (unset). Otherwise, if another
   * ability already holds `value`, the two swap — Kevin's exact spec
   * (picking a value already claimed elsewhere trades the two abilities'
   * values rather than rejecting the pick).
   */
  assign(ability: AbilityScoreId, value: number | null): void {
    if (value === null) {
      delete this.assignments[ability];
      return;
    }
    const holder = ABILITY_SCORE_IDS.find((id) => id !== ability && this.assignments[id] === value);
    const previous = this.assignments[ability];
    if (holder) {
      if (previous === undefined) delete this.assignments[holder];
      else this.assignments[holder] = previous;
    }
    this.assignments[ability] = value;
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

/**
 * D-147 (piece 3): the real SRD 5.2.1 point-buy cost table — every score
 * from 8 (free) to 15 (the pre-racial cap), each costing progressively more
 * of a fixed 27-point budget. 13->14 and 14->15 cost 2 points instead of the
 * even 1-per-point pattern below that, matching the real published table
 * exactly (not an approximation).
 */
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN_SCORE = 8;
export const POINT_BUY_MAX_SCORE = 15;
const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

/**
 * D-147 (piece 3): SRD 5.2.1 Point Buy, alongside `StandardArrayAllocator`
 * as a second, selectable ability-score method (`CharacterCreationScene`'s
 * new party-wide toggle). Every ability starts at the floor (8, cost 0);
 * `increase`/`decrease` step one score at a time and silently refuse a move
 * the remaining budget can't afford or that would leave the 8-15 range —
 * the same "can't produce an invalid state" guarantee `StandardArrayAllocator`
 * gives by construction, just enforced per-call instead of by the type
 * itself.
 */
export class PointBuyAllocator implements AbilityScoreAllocator {
  private values: Record<AbilityScoreId, number>;

  constructor(initialValues?: Partial<Record<AbilityScoreId, number>>) {
    this.values = {} as Record<AbilityScoreId, number>;
    ABILITY_SCORE_IDS.forEach((id) => {
      this.values[id] = initialValues?.[id] ?? POINT_BUY_MIN_SCORE;
    });
  }

  scores(): AbilityScores {
    return { ...this.values } as AbilityScores;
  }

  spentPoints(): number {
    return ABILITY_SCORE_IDS.reduce((total, id) => total + POINT_BUY_COST[this.values[id]], 0);
  }

  remainingPoints(): number {
    return POINT_BUY_BUDGET - this.spentPoints();
  }

  canIncrease(ability: AbilityScoreId): boolean {
    const current = this.values[ability];
    if (current >= POINT_BUY_MAX_SCORE) return false;
    const stepCost = POINT_BUY_COST[current + 1] - POINT_BUY_COST[current];
    return this.remainingPoints() >= stepCost;
  }

  canDecrease(ability: AbilityScoreId): boolean {
    return this.values[ability] > POINT_BUY_MIN_SCORE;
  }

  increase(ability: AbilityScoreId): void {
    if (this.canIncrease(ability)) this.values[ability] += 1;
  }

  decrease(ability: AbilityScoreId): void {
    if (this.canDecrease(ability)) this.values[ability] -= 1;
  }
}

/**
 * Reconstruct a `PointBuyAllocator` from a saved build's scores (Phase 9,
 * D-083's load path) — same defensive spirit as `allocatorFromScores`. Any
 * score outside the valid 8-15 point-buy range (e.g. a save made under
 * Standard Array, which can produce 8-15 too, so no ambiguity there, but
 * hand-edited/corrupt data could still be out of range) falls back to the
 * floor for that ability rather than throwing.
 */
export function pointBuyAllocatorFromScores(scores: AbilityScores): PointBuyAllocator {
  const clamped: Partial<Record<AbilityScoreId, number>> = {};
  ABILITY_SCORE_IDS.forEach((id) => {
    const v = scores[id];
    clamped[id] = v >= POINT_BUY_MIN_SCORE && v <= POINT_BUY_MAX_SCORE ? v : POINT_BUY_MIN_SCORE;
  });
  return new PointBuyAllocator(clamped);
}

export interface CharacterBuild {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  level: number;
  abilityScores: AbilityScores;
  /**
   * D-147 (piece 3): which allocation method produced `abilityScores` —
   * undefined means "standardArray," identical to every pre-D-147 build
   * (this project's real ruleset choice is party-wide, not per-hero, but
   * it's recorded per-build so `CharacterCreationScene` can reconstruct the
   * right allocator kind on load without guessing from the numbers alone).
   */
  abilityScoreMethod?: "standardArray" | "pointBuy";
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
  /**
   * @deprecated Phase 13.11 (D-096)'s original single-item pick — kept ONLY
   * so a pre-Plan-2 `SaveSystem` save still type-checks and can be migrated
   * on read (see `CharacterCreationScene.slotStateFromBuild`). Every build
   * created after Plan 2 (D-193) uses `startingGearIds` below instead.
   */
  startingEquipmentId?: string;
  /**
   * D-193 (Party Creation Overhaul Plan 2): the real per-slot starting
   * loadout — one optional pick per gear slot (`GearSlotId`; "None" means
   * absent for that key). Every slot's pool is open to every class (no
   * class gating — matches `EquipmentDefinition` having no class-
   * restriction field anywhere). Replaces the old single-item
   * `startingEquipmentId` pick.
   */
  startingGearIds?: Partial<Record<GearSlotId, string>>;
  /**
   * D-129: a pre-battle class level to fast-forward to before wave 1, set at
   * party-setup time (individually per hero, or all at once via the team
   * control) — separate from `level` above, which stays 1 (the level
   * `heroDefinitionFromBuild`'s own base-stat math is computed from; the
   * Hero entity is then leveled up for real, level by level, once built —
   * see `BattleScene.fastForwardHeroToLevel`). Undefined/1 means "no
   * fast-forward," matching every existing build's behavior unchanged.
   */
  startingLevel?: number;
  /**
   * D-133: this hero's Character Creation level-up planner blueprint, set by
   * `CharacterCreationScene`'s "Plan Levels" overlay. Undefined means no
   * plan — every existing build is unaffected. Passed straight through to
   * `HeroDefinition.levelUpPlan` by `heroDefinitionFromBuild`.
   */
  levelUpPlan?: LevelUpPlan;
  /**
   * D-135 (Phase 2 of D-134's real spell-preparation economy): a caster's
   * manually-picked starting prepared leveled spells / known cantrips /
   * (Wizard only) spellbook, set by `CharacterCreationScene`'s "Spells"
   * picker overlay. Undefined (the default for every non-caster and every
   * caster the player never opened the picker for) means "keep the silent
   * `Hero.growSpellSelections()` auto-fill" — every existing build is
   * unaffected. Passed straight through to the matching `HeroDefinition`
   * fields by `heroDefinitionFromBuild`; `BattleScene.buildHeroes` applies
   * them as a wholesale override once the hero's Starting-Level fast-
   * forward finishes.
   */
  preparedSpellIds?: string[];
  knownCantripIds?: string[];
  spellbookIds?: string[];
  /**
   * D-148: this hero's curated action hotkey bar, set by the Character
   * Sheet's Hotkeys tab. Undefined (every build before this feature, and
   * every build the player never opened that tab for) means every slot
   * starts empty. Passed straight through to `HeroDefinition.actionHotkeys`
   * by `heroDefinitionFromBuild`.
   */
  actionHotkeys?: (string | undefined | null)[];
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
  const stats = combatStatsForClassLevel(build.classId, build.level, build.abilityScores);
  const style = attackStyleForClass(build.classId);
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
    // D-193: startingEquipmentId is legacy-only now (undefined on any build
    // created post-Plan-2) — both are passed through unconditionally so
    // Hero's constructor can fold a legacy pick in alongside real slot picks.
    startingEquipmentId: build.startingEquipmentId,
    startingGearIds: build.startingGearIds,
    // Phase 17 (D-108): the class-rider portion of attackDamage (e.g. a
    // future by-level bonus-damage table), kept SEPARATE from the base+
    // ability-modifier portion so a real equipped weapon can replace just
    // that portion later — see Hero.effectiveAttackDamage.
    classRiderDamage: stats.bonusRiderDamage,
    // Rendering hint for a future real hero sprite — see HeroDefinition's own comment.
    assetKey: `hero-${build.classId}`,
    // D-129: passed straight through — `BattleScene.buildHeroes` fast-forwards
    // the constructed Hero entity to this level, once, right after it's built.
    startingLevel: build.startingLevel,
    // D-133: passed straight through — `BattleScene.heroLevelUpPlans` reads
    // it to resolve every future ASI/subclass/spell-pick trigger.
    levelUpPlan: build.levelUpPlan,
    // D-135: passed straight through — `BattleScene.buildHeroes` applies
    // these (when set) as a wholesale override right after the hero's
    // Starting-Level fast-forward finishes.
    preparedSpellIds: build.preparedSpellIds,
    knownCantripIds: build.knownCantripIds,
    spellbookIds: build.spellbookIds,
    // D-148: passed straight through — `BattleScene.buildHeroes` applies it
    // right after construction, same treatment as the spell-selection fields above.
    actionHotkeys: build.actionHotkeys,
  };
}

/**
 * A small, fixed party of fresh level-1 D&D builds — for a path with no real
 * character-creation UI of its own yet (Co-op's lobby has no hero-picker,
 * see `CoopLobbyScene`), so a battle still has something valid to play.
 * Deterministic (first `size` entries of `CREATABLE_CLASS_IDS`, standard
 * ability-score order, the default race) so two calls with the same `size`
 * always produce the same ids — a caller that needs the roster twice (once
 * for hero ids, once for the actual `HeroDefinition`s) can call this twice
 * rather than caching it.
 */
export function defaultPartyBuilds(size: number): CharacterBuild[] {
  return Array.from({ length: size }, (_, i) => {
    const classId = CREATABLE_CLASS_IDS[i % CREATABLE_CLASS_IDS.length];
    return {
      id: `default-hero-${i}`,
      name: CHARACTER_NAME_POOL[i % CHARACTER_NAME_POOL.length],
      raceId: RACE_IDS[0],
      classId,
      level: 1,
      abilityScores: new StandardArrayAllocator().scores(),
      controlledBy: "human",
      subclassId: subclassIdForNewBuild(classId),
    };
  });
}

/** True if two or more builds share a name. */
export function hasDuplicateNames(builds: ReadonlyArray<CharacterBuild>): boolean {
  const names = builds.map((b) => b.name);
  return new Set(names).size !== names.length;
}
