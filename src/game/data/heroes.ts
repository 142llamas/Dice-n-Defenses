import type { AbilityScores } from "./abilityScores";

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
  /** The id of this hero's one distinct ability (see data/abilities.ts). */
  abilityId: string;
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
   * Phase 13.11 (D-096): one common/uncommon equipment item chosen at
   * character creation (see `CharacterCreationScene`'s Gear row), granted
   * for free into the matching gear slot before the first battle — closer
   * to a real 5e starting-equipment package than starting every hero
   * bare-handed. Absent for any build that picked "None".
   */
  startingEquipmentId?: string;
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
}
