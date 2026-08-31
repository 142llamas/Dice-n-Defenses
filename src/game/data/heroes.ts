import type { AbilityScores } from "./abilityScores";
import type { LevelUpPlan } from "../systems/LevelUpPlanSystem";
import type { GearSlotId } from "./equipment";

/**
 * Hero definitions — the shape a playable hero must have, and the shared
 * types every hero-producing path (`CharacterBuildSystem.heroDefinitionFromBuild`)
 * builds into. This file used to also hold the original classic fixed
 * 4-hero roster (Ash/Wren/Bram/Mira) and its flat Vigor/Might level-up
 * choice, both removed once the D&D-style character-creation/real-class-
 * leveling system that superseded them became feature-complete — see
 * DECISIONS.md for the removal record. Every hero in the game is now built
 * via `heroDefinitionFromBuild`.
 */

/**
 * Phase 11.4 (D-077): "human" is the classic default (the player clicks its
 * moves/attacks); "ai" means `BattleScene` acts for it automatically each
 * player phase via `HeroAISystem`, mirroring enemy AI's own attack-or-advance
 * choice. See `CharacterCreationScene`'s per-slot control toggle.
 *
 * Phase 12.3 (D-103): "remote" means a human, but not THIS client — a
 * cooperative-session participant's own hero, assigned via
 * `CoopSessionSystem.startCoopBattle`'s `heroOwners` map. `BattleScene`
 * never runs `HeroAISystem` for one (same `!== "ai"` check that already
 * skips a human hero), and gates hero selection so only the owning client
 * can click it. Never set by `CharacterCreationScene`'s own per-slot
 * toggle — only a coop battle start assigns it.
 */
export type HeroControlMode = "human" | "ai" | "remote";

export interface HeroDefinition {
  id: string;
  name: string;
  /** Tiles this hero may move in a single move, per turn. */
  movementTiles: number;
  /** Combat: total hit points. A hero at 0 HP is defeated and removed. */
  maxHealth: number;
  /** Combat: damage a basic attack deals on a hit. */
  attackDamage: number;
  /** Combat: basic-attack reach in tiles (Manhattan distance). 1 = adjacent. */
  attackRangeTiles: number;
  /** Combat (Phase 13.1, D-086): to-hit bonus added to this hero's attack rolls. */
  attackBonus: number;
  /** Combat (Phase 13.1, D-086): Armor Class before equipped gear (10 = unarmored). */
  baseArmorClass: number;
  /** Absent means "human". */
  controlledBy?: HeroControlMode;
  /**
   * Phase 13.2 (D-087): the id of this hero's D&D class (see data/classes.ts).
   * The seam that lets class-gated action-economy features (Second Wind,
   * Action Surge, Cunning Action, Uncanny Dodge) know which hero qualifies,
   * WITHOUT yet building the full race/class/level identity that's 13.3's
   * job (real per-class leveling). Always present now that every hero is
   * built via `heroDefinitionFromBuild`.
   */
  classId?: string;
  /**
   * D-206: which Background this hero was built with, if any — set by
   * `heroDefinitionFromBuild` from `CharacterBuild.backgroundId`. Drives the
   * origin-feat grant (`BattleScene.buildHeroes`) and a real Stealth-
   * proficiency bonus (`Hero.stealthCheckModifier`). Undefined for the
   * classic fixed roster and any hero built before this feature.
   */
  backgroundId?: string;
  /**
   * Phase 13.3 (D-089): a D&D-built hero's fixed six ability scores, carried
   * forward from `CharacterBuild` so `Hero.levelUpClass()` can redo
   * `CharacterSystem.combatStatsForClassLevel`'s math at any later level.
   */
  abilityScores?: AbilityScores;
  /**
   * Phase 13.11 (D-096): a D&D-built hero's subclass, if already chosen.
   * Present at creation only for a class whose subclass choice lands at
   * level 1 (Cleric, Sorcerer, Warlock — see `CharacterClassDefinition
   * .subclassChoiceLevel`); every other class starts undefined and gets one
   * assigned later, in battle, the first time `Hero.levelUpClass()` reaches
   * its own choice level (see `BattleScene`'s subclass-choice queue).
   */
  subclassId?: string;
  /**
   * @deprecated Phase 13.11 (D-096)'s original single-item pick. Kept ONLY
   * as a legacy fallback for a pre-Plan-2 save's build (see
   * `CharacterBuild.startingEquipmentId`) — `Hero`'s constructor folds it
   * in alongside `startingGearIds` below for any slot the latter didn't
   * already claim. Every build created after Plan 2 (D-193) leaves this
   * undefined.
   */
  startingEquipmentId?: string;
  /**
   * D-193 (Party Creation Overhaul Plan 2): the real per-slot starting
   * loadout chosen at character creation (see `CharacterCreationScene`'s
   * Gear row) — weapon + chest armor + a class-appropriate third slot,
   * each optional. Granted for free into the matching gear slots before
   * the first battle. Absent/empty-for-a-slot means "None" for that slot.
   */
  startingGearIds?: Partial<Record<GearSlotId, string>>;
  /**
   * Phase 17 (D-108): the class-rider portion of a D&D-built hero's
   * `attackDamage` (e.g. a future by-level bonus-damage table), kept
   * separate from the base+ability-modifier portion `CharacterSystem
   * .combatStatsForClassLevel` folds into `attackDamage` itself — so that
   * once a real weapon is equipped (replacing the base+modifier portion),
   * this class rider still applies on top. Absent/0 for any class with no
   * `bonusDamageByLevel` table.
   */
  classRiderDamage?: number;
  /**
   * Rendering hint for a future real hero sprite (see ASSET_PLAN.md) — a
   * colored shape/text token is used for now, same "declared, not yet
   * consumed" treatment `EnemyDefinition`/`StructureDefinition.assetKey`
   * already have. Set by `heroDefinitionFromBuild` from the hero's class,
   * e.g. `"hero-fighter"`.
   */
  assetKey?: string;
  /**
   * D-129: a pre-battle class level to fast-forward this hero to before wave
   * 1 — set by `heroDefinitionFromBuild` from `CharacterBuild.startingLevel`.
   * Undefined/1 means no fast-forward (every existing definition/caller is
   * unaffected). See `BattleScene.fastForwardHeroToLevel`.
   */
  startingLevel?: number;
  /**
   * D-133: this hero's Character Creation level-up planner blueprint, if one
   * was set — set by `heroDefinitionFromBuild` from `CharacterBuild
   * .levelUpPlan`. Undefined means no plan at all: every ASI/subclass/
   * spell-pick trigger resolves exactly as it always has (D-129's fixed
   * defaults pre-battle, unprompted in-battle popups) — every existing
   * definition/caller is unaffected. See `BattleScene.heroLevelUpPlans`.
   */
  levelUpPlan?: LevelUpPlan;
  /**
   * D-135: a caster's manually-picked starting prepared leveled spells /
   * known cantrips / (Wizard only) spellbook, set by `heroDefinitionFromBuild`
   * from the matching `CharacterBuild` fields. Undefined means "keep the
   * silent `Hero.growSpellSelections()` auto-fill" — every existing
   * definition/caller is unaffected. See `BattleScene.buildHeroes`, which
   * applies these as a wholesale override once a hero's Starting-Level
   * fast-forward finishes.
   */
  preparedSpellIds?: string[];
  knownCantripIds?: string[];
  spellbookIds?: string[];
  /**
   * D-148: this hero's curated action hotkey bar, set by
   * `heroDefinitionFromBuild` from `CharacterBuild.actionHotkeys`. Undefined
   * means every slot starts empty — every existing definition/caller is
   * unaffected. See `BattleScene.buildHeroes`.
   */
  actionHotkeys?: (string | undefined | null)[];
}
