import type { AbilityScores } from "./abilityScores";

/**
 * Hero definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 2 kept the two hero definitions inline in BattleScene. Phase 4 promotes
 * them to this data file (the Source of Truth folder structure lists a heroes
 * data file), because heroes now carry combat identity — health, a basic attack,
 * and one distinct ability each — and that content belongs in data, not scene
 * code. The scene reads these to build heroes and to drive combat.
 *
 * All values here are ORIGINAL, invented for this project. Nothing is copied or
 * adapted from any published source (no D&D / SRD content). See CONTENT_SOURCES.
 *
 * MVP action economy (see DECISIONS D-019/D-031): one MOVE and one ACTION per
 * turn, in either order. A basic attack OR an ability spends the single action.
 *
 * Phase 7 grows the roster from two heroes to the vertical slice's FOUR (the
 * Source of Truth's §9 "Final party size" item: "two in MVP, four in vertical
 * slice"). Bram and Mira are deliberately shaped as the answers to what Ash and
 * Wren can't do: Bram is a tankier melee unit whose ability buys the party a
 * turn (a stun) rather than more damage; Mira is a second ranged unit whose
 * ability buys time (a slow) instead of raw damage, at shorter range and lower
 * damage than Wren so she isn't just "a second Wren".
 *
 * Phase 13.1 (D-086): real dice replace deterministic combat. Every hero
 * definition gains `baseArmorClass` (10, unarmored — this fixed roster has no
 * ability scores to derive a Dex bonus from, unlike the D&D character-build
 * path; see `CharacterBuildSystem.heroDefinitionFromBuild`) and a flat
 * `attackBonus` (+4 for all four — a first-pass, untuned number, same as
 * every other balance value here).
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
  /** Absent means "human" — the classic roster and any prior build stay unaffected. */
  controlledBy?: HeroControlMode;
  /**
   * Phase 13.2 (D-087): the id of this hero's D&D class (see data/classes.ts),
   * present only for a hero built via `CharacterBuildSystem.heroDefinitionFromBuild`.
   * Absent for the classic fixed roster below, which predates the class system —
   * this is the minimal seam that lets class-gated action-economy features
   * (Second Wind, Action Surge, Cunning Action, Uncanny Dodge) know which hero
   * qualifies, WITHOUT yet building the full race/class/level identity that's
   * 13.3's job (real per-class leveling).
   */
  classId?: string;
  /**
   * Phase 13.3 (D-089): a D&D-built hero's fixed six ability scores, carried
   * forward from `CharacterBuild` so `Hero.levelUpClass()` can redo
   * `CharacterSystem.combatStatsForClassLevel`'s math at any later level.
   * Absent for the classic fixed roster below, which has no ability scores
   * and never levels this way — it stays on the flat wave-based Vigor/Might
   * `ProgressionSystem` choice instead.
   */
  abilityScores?: AbilityScores;
  /**
   * Phase 13.11 (D-096): a D&D-built hero's subclass, if already chosen.
   * Present at creation only for a class whose subclass choice lands at
   * level 1 (Cleric, Sorcerer, Warlock — see `CharacterClassDefinition
   * .subclassChoiceLevel`); every other class starts undefined and gets one
   * assigned later, in battle, the first time `Hero.levelUpClass()` reaches
   * its own choice level (see `BattleScene`'s subclass-choice queue).
   * Absent for the classic fixed roster, which has no class/subclass system.
   */
  subclassId?: string;
  /**
   * Phase 13.11 (D-096): one common/uncommon equipment item chosen at
   * character creation (see `CharacterCreationScene`'s Gear row), granted
   * for free into the matching gear slot before the first battle — closer
   * to a real 5e starting-equipment package than starting every hero
   * bare-handed. Absent for the classic fixed roster and for any build that
   * picked "None".
   */
  startingEquipmentId?: string;
  /**
   * Phase 17 (D-108): the class-rider portion of a D&D-built hero's
   * `attackDamage` (e.g. a future by-level bonus-damage table), kept
   * separate from the base+ability-modifier portion `CharacterSystem
   * .combatStatsForClassLevel` folds into `attackDamage` itself — so that
   * once a real weapon is equipped (replacing the base+modifier portion),
   * this class rider still applies on top. Absent/0 for the classic fixed
   * roster and any class with no `bonusDamageByLevel` table.
   */
  classRiderDamage?: number;
}

export const HERO_DEFINITIONS: HeroDefinition[] = [
  {
    id: "hero-ash",
    name: "Ash",
    movementTiles: 4,
    maxHealth: 12,
    // Ash is the front-line bruiser: durable, hits hard, but only at melee range.
    attackDamage: 4,
    attackRangeTiles: 1,
    attackBonus: 4,
    baseArmorClass: 10,
    abilityId: "cleave",
  },
  {
    id: "hero-wren",
    name: "Wren",
    movementTiles: 3,
    maxHealth: 8,
    // Wren is the ranged skirmisher: softer, but strikes from a safe distance.
    attackDamage: 3,
    attackRangeTiles: 3,
    attackBonus: 4,
    baseArmorClass: 10,
    abilityId: "piercing-shot",
  },
  {
    id: "hero-bram",
    name: "Bram",
    movementTiles: 3,
    // Bram is the guardian: the tankiest hero, melee range like Ash but built
    // to hold a line rather than hit hardest — his ability trades damage for a
    // stun that buys the party a free turn against everything adjacent.
    maxHealth: 14,
    attackDamage: 3,
    attackRangeTiles: 1,
    attackBonus: 4,
    baseArmorClass: 10,
    abilityId: "taunting-slam",
  },
  {
    id: "hero-mira",
    name: "Mira",
    movementTiles: 3,
    // Mira is the frostcaller: a second ranged hero, but shorter-ranged and
    // softer-hitting than Wren so she isn't a duplicate — her value is the
    // slow her bolt applies, a route-manipulation tool at range.
    maxHealth: 7,
    attackDamage: 2,
    attackRangeTiles: 3,
    attackBonus: 4,
    baseArmorClass: 10,
    abilityId: "frost-bolt",
  },
];

/** A short display colour per hero id (placeholder art; original, no IP). */
export const HERO_COLORS: Record<string, number> = {
  "hero-ash": 0x4caf72,
  "hero-wren": 0x5aa0d0,
  "hero-bram": 0xb0965a,
  "hero-mira": 0x7ad0e0,
};

/** Look up a hero definition, throwing on an unknown id so typos fail loudly. */
export function getHeroDefinition(id: string): HeroDefinition {
  const def = HERO_DEFINITIONS.find((h) => h.id === id);
  if (!def) throw new Error(`Unknown hero id "${id}".`);
  return def;
}
