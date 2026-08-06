import type { GridPosition } from "../systems/GridSystem";
import type { HeroDefinition, HeroControlMode } from "../data/heroes";
import type { Combatant } from "../systems/CombatSystem";
import { modifierFor, type AbilityScoreId, type AbilityScores } from "../data/abilityScores";
import { GEAR_SLOT_IDS, getEquipmentDefinition, type GearSlotId, type EquipmentDefinition } from "../data/equipment";
import { weaponAttackDamage, weaponRangeTiles, weaponAbilityModifier, averageDiceDamage } from "../systems/WeaponSystem";
import { GENERAL_SLOT_IDS, getPotionDefinition, type GeneralSlotId, type PotionDefinition } from "../data/potions";
import {
  combatStatsForClassLevel,
  spellSaveDC,
  savingThrowBonus as computeSavingThrowBonus,
  type LeveledCombatStats,
} from "../systems/CharacterSystem";
import { spellSlotsForClassAtLevel } from "../systems/SpellcastingSystem";
import { getClassDefinition, type CharacterClassDefinition } from "../data/classes";
import { getFeat, hitPointBonusFromFeat, type FeatDefinition } from "../data/feats";
import { getAbility } from "../data/abilities";
import {
  knownSpellIdsForClass,
  CLERIC_CANTRIP_IDS,
  DRUID_CANTRIP_IDS,
  WIZARD_CANTRIP_IDS,
  CLERIC_LEVELED_SPELL_IDS,
  DRUID_LEVELED_SPELL_IDS,
  WIZARD_LEVELED_SPELL_IDS,
} from "../data/characterCreation";
import { getSpell } from "../data/spells";
import { getBuffEffectDefinition, type ActiveBuff, type BuffEffectId } from "../data/buffEffects";
import { getStatusEffectDefinition, type ActiveStatus, type StatusEffectId } from "../data/statusEffects";

/**
 * Phase 13.2 (D-087): Second Wind's heal, flat and untuned (like every other
 * balance number here) rather than level-scaled — real per-class leveling
 * (13.3) is what should replace this with the SRD's 1dHitDie+level formula.
 */
const SECOND_WIND_HEAL = 6;

/**
 * Phase 13.4 (D-088): a Short Rest's HP recovery. This game has no Hit Dice
 * to spend (the SRD's real short-rest healing mechanism), so this is a flat
 * FRACTION of a hero's own max HP instead — Kevin's call, so a Short Rest
 * heals something meaningful for every hero (not just a Fighter's rest-gated
 * resources), scaling naturally with a tankier hero's bigger health pool the
 * same way real Hit Dice healing scales with a bigger hit die.
 */
const SHORT_REST_HEAL_FRACTION = 0.25;

/**
 * Phase 13.8 (D-093): flat, untuned constants for the eight new classes'
 * signature mechanics — same "first pass, untuned" treatment as
 * `SECOND_WIND_HEAL`/`SHORT_REST_HEAL_FRACTION` above, rather than
 * SRD-accurate by-level scaling tables (which would be real future-tuning
 * work, not this pass's job).
 */
const RAGE_USES_PER_REST = 3;
const RAGE_DAMAGE_BONUS = 3;
const RAGE_DURATION_TURNS = 5;
const KI_POINTS_PER_REST = 3;
const WILD_SHAPE_USES_PER_REST = 2;
const WILD_SHAPE_HEAL = 5;
const WILD_SHAPE_DURATION_TURNS = 5;
const BARDIC_INSPIRATION_USES_PER_REST = 3;
/** Flat bonus Bardic Inspiration grants its target's next attack roll and damage. */
export const BARDIC_INSPIRATION_BONUS = 4;
const SORCERY_POINTS_PER_REST = 2;

/**
 * Phase 13.3 (D-089): the SRD's real level cap. A hero built via
 * `CharacterCreationScene` and leveled through `levelUpClass` simply stops
 * gaining levels here — far above anything a real run's wave count reaches
 * today, this is a defensive ceiling, not a tuned target.
 */
const MAX_CLASS_LEVEL = 20;

/** Phase 13.6 (D-091): the SRD's ability-score ceiling an ASI may never raise a score past. */
const MAX_ABILITY_SCORE = 20;

/** Phase 13.9 (D-094): the SRD's real attunement cap — a hero may never be attuned to more than 3 items at once. */
export const MAX_ATTUNEMENTS = 3;

/**
 * Phase 13.10: a flat fallback for `Hero.savingThrowBonus` on the classic
 * fixed roster (no ability scores to derive a real one from) — same "flat,
 * untuned, tier-scaled" treatment `EnemyDefinition.savingThrowBonus` already
 * gets for the same reason.
 */
const HERO_DEFAULT_SAVING_THROW_BONUS = 2;

/**
 * Phase 13.11 (D-096): Champion's Improved Critical (level 3+) and Superior
 * Critical (level 15+) — the natural roll that counts as a critical hit,
 * widened from the default 20. See `Hero.critThreshold`.
 */
const CHAMPION_IMPROVED_CRIT_THRESHOLD = 19;
const CHAMPION_SUPERIOR_CRIT_THRESHOLD = 18;
const CHAMPION_SUPERIOR_CRIT_LEVEL = 15;

/** Phase 13.11 (D-096): Life Domain's Disciple of Life/Blessed Healer — flat, untuned bonus HP, same treatment as every other Phase 13 balance number. */
const LIFE_DOMAIN_HEAL_BONUS = 2;
const LIFE_DOMAIN_BLESSED_HEALER_LEVEL = 6;

/**
 * Phase 14 (D-097): the three new subclass hookups that clear the same bar
 * Champion/Life Domain did — a genuinely existing number to plug into, not a
 * new system invented for the occasion. Flat and untuned, like every other
 * balance constant here.
 */
const COLOSSUS_SLAYER_BONUS_DAMAGE = 4;
const DARK_ONES_BLESSING_HEAL = 5;

/**
 * Phase 14.2 (D-099): twelve original subclasses (one per class), each with
 * exactly one real hookup — the same bar as every hookup above. Flat and
 * untuned, like every other balance constant here.
 */
const SPELLBLADE_ARCANE_DEFLECTION_AC_BONUS = 1;
const IRONHIDE_STANCE_AC_BONUS = 2;
/** Battle Hymn (Bard)/Crusader's Wrath (Cleric)/Tactician's Precision (Fighter) — a flat, always-on to-hit bonus, same amount for all three. */
const SUBCLASS_ATTACK_BONUS = 1;
const WILDSURGE_BONUS_SORCERY_POINTS = 1;
const ASHEN_VEIL_WILD_SHAPE_HEAL_BONUS = 3;
const RETRIBUTION_SMITE_BONUS = 2;
const BEASTBOND_STRIKE_HEAL = 3;
const SHADOWBLADE_FIRST_STRIKE_BONUS = 5;

/**
 * Phase 18 (D-109): 13 new SRD 5.2.1 feats, added alongside the Phase 13.6
 * starter four. Flat, untuned balance numbers, same treatment as every
 * other constant here — `BOON_OF_FATE_ATTACK_BONUS` is Boon of Fate's
 * once-per-rest surge, auto-applied to this hero's next basic attack (the
 * same "spent on the first roll, no interrupt-prompt UI" precedent Lucky/
 * Vex/Bardic Inspiration already established in `BattleScene.tryBasicAttack`).
 */
const BOON_OF_FATE_ATTACK_BONUS = 3;

/** Magic Initiate's three SRD-legal spell lists — see `Hero.grantFeat`. */
export type MagicInitiateListId = "cleric" | "druid" | "wizard";
const MAGIC_INITIATE_CANTRIP_IDS: Record<MagicInitiateListId, string[]> = {
  cleric: CLERIC_CANTRIP_IDS,
  druid: DRUID_CANTRIP_IDS,
  wizard: WIZARD_CANTRIP_IDS,
};
const MAGIC_INITIATE_LEVELED_SPELL_IDS: Record<MagicInitiateListId, string[]> = {
  cleric: CLERIC_LEVELED_SPELL_IDS,
  druid: DRUID_LEVELED_SPELL_IDS,
  wizard: WIZARD_LEVELED_SPELL_IDS,
};

/** One Magic Initiate pick: which list, which 2 cantrips, and (if the list had one) which 1st-level spell. */
export interface MagicInitiateGrant {
  listId: MagicInitiateListId;
  cantripIds: string[];
  spellId?: string;
}

/**
 * Phase 12.1 (D-101): a plain-data copy of every field a live `Hero` carries —
 * identity (`HeroDefinition`'s own fields), plus every mutable/private bit of
 * in-battle progress (HP, position, gear, class level, every per-rest
 * resource pool, every per-turn flag). Built for `BattleStateSnapshot`, but
 * useful for any future feature needing a full hero round-trip (e.g. a
 * mid-battle autosave) — deliberately NOT limited to what Phase 12 alone
 * needs. See `Hero.toSnapshot`/`Hero.fromSnapshot`.
 */
export interface HeroSnapshot {
  id: string;
  name: string;
  movementTiles: number;
  attackRangeTiles: number;
  baseArmorClass: number;
  abilityId: string;
  controlledBy: HeroControlMode;
  classId?: string;
  abilityScores?: AbilityScores;
  maxHealth: number;
  attackDamage: number;
  attackBonus: number;
  position: GridPosition;
  health: number;
  equippedItems: Partial<Record<GearSlotId, string>>;
  equippedPotions: Partial<Record<GeneralSlotId, string>>;
  moved: boolean;
  acted: boolean;
  bonusMaxHealth: number;
  bonusAttackDamage: number;
  /** Phase 22 (magic-item expansion): Potion of Speed/Resistance's permanent-for-the-battle grants. */
  bonusMovementTiles: number;
  permanentDamageResistance: boolean;
  bonusActed: boolean;
  secondWindUsed: boolean;
  actionSurgeUsed: boolean;
  reactionAvailable: boolean;
  shadowbladeFirstStrikeUsed: boolean;
  classLevel: number;
  extraAttacks: number;
  feats: string[];
  luckyPointsRemaining: number;
  spellSlotsRemaining: number[];
  rageUsesRemaining: number;
  damageResistanceTurnsRemaining: number;
  kiPointsRemaining: number;
  wildShapeUsesRemaining: number;
  bardicInspirationUsesRemaining: number;
  inspirationBonus: number;
  sorceryPointsRemaining: number;
  quickenedSpellReadyFlag: boolean;
  markedTargetId: string | null;
  assignedSubclassId?: string;
  activeBuffs: ActiveBuff[];
  /** Phase 17 (D-108): see `HeroDefinition.classRiderDamage`'s own comment. */
  classRiderDamage: number;
  /** Phase 17 (D-108): the Vex weapon mastery's pending advantage target, if any — see `Hero.hasVexAgainst`. */
  vexTargetId: string | null;
  /** Phase 18 (D-109): Grappler's once-per-turn restrain use. */
  grapplerRestrainUsedThisTurn: boolean;
  /** Phase 18 (D-109): Boon of Combat Prowess's once-per-turn miss-to-hit use. */
  combatProwessUsedThisTurn: boolean;
  /** Phase 18 (D-109): Boon of Fate's once-per-rest charge. */
  boonOfFateChargeAvailable: boolean;
  /** Phase 18 (D-109): which ability Boon of Irresistible Offense raised, if held. */
  irresistibleOffenseAbility?: AbilityScoreId;
  /** Phase 18 (D-109): every Magic Initiate pick this hero has made. */
  magicInitiateGrants: MagicInitiateGrant[];
  /** Phase 18 (D-109): remaining free casts of each Magic Initiate grant's leveled spell, parallel to `magicInitiateGrants`. */
  magicInitiateSpellUsesRemaining: number[];
  /** Phase 19 (D-110): the off-hand attack's once-per-turn use. */
  offHandAttackUsedThisTurn: boolean;
  /** Phase 21 (D-112): every active status effect an ENEMY has inflicted on this hero, mirroring `Enemy.activeStatuses`. */
  activeStatuses: ActiveStatus[];
}

/**
 * Hero: a pure, Phaser-free model of one player unit.
 *
 * This follows the "logic without visuals" rule (like GridSystem and GameMap):
 * a Hero knows where it is, what it may still do this turn, and how hurt it is,
 * but it knows nothing about sprites, colours, or the screen. BattleScene draws
 * heroes; this class holds their state so it can be unit-tested with no browser.
 *
 * MVP turn economy (Source of Truth "movement plus one action"):
 *   - One MOVE per turn: a hero may move up to `movementTiles` tiles, once.
 *   - One ACTION per turn: a basic attack OR an ability. Phase 2 tracked the
 *     action slot but nothing consumed it; Phase 4 wires real actions in. Move
 *     and action are independent and may be taken in either order (D-031).
 * Bonus actions, reactions, and readied actions are deferred, per the boundary.
 *
 * Combat state (Phase 4): a hero has health and can be attacked by enemies. A
 * hero reduced to 0 HP is DEFEATED and removed from the board — but this is NOT
 * a loss condition (that remains LOCKED to Stronghold Integrity = 0). Hero
 * implements the small `Combatant` shape so CombatSystem can target it.
 *
 * Phase 7 progression: for the classic fixed roster, `maxHealth` and
 * `attackDamage` stay the hero's BASE stats (as defined in data/heroes.ts);
 * the flat Vigor/Might level-up choice and equipment layer bonuses on top via
 * `bonusMaxHealth`/`bonusAttackDamage` and equipped gear, read through
 * `effectiveMaxHealth`/`effectiveAttackDamage`/`defense`. Combat code should
 * use the effective getters, not the base fields, so a hero's growth actually
 * shows up in a fight (see DECISIONS D-05x). Phase 13.3 (D-089): a D&D-built
 * hero instead has `maxHealth`/`attackDamage`/`attackBonus` REPLACED outright
 * by `levelUpClass()` (never touching `bonusMaxHealth`/`bonusAttackDamage`,
 * which stay reserved for potions on such a hero) — see that method's own
 * comment.
 *
 * Phase 11.5 (D-078): equipment grew from one flat-bonus slot into the
 * classic seven-slot loadout (`equippedItems`, keyed by `GearSlotId`) plus
 * two consumable potion slots (`equippedPotions`, keyed by `GeneralSlotId`).
 * `armorClass`/`effectiveAttackDamage` now SUM bonuses across every filled
 * gear slot rather than reading a single id.
 *
 * Phase 13.1 (D-086): real dice replace deterministic combat. The old flat
 * `defense` getter is replaced by `armorClass` (`baseArmorClass`, which
 * already includes the unarmored 10, plus every filled gear slot's AC
 * bonus), and a hero now carries a flat `attackBonus` (its to-hit bonus
 * against a target's Armor Class).
 *
 * Phase 13.2 (D-087): a first slice of the action economy. `moved`/`acted`
 * (above) cover Move + Action; this adds a `bonusActed` slot (Move + Action +
 * Bonus Action + Reaction is the full D&D turn) plus four class-gated
 * features that spend it — Second Wind and Action Surge (Fighter), Cunning
 * Action's Dash (Rogue), and Uncanny Dodge (Rogue, a reaction). A hero only
 * qualifies if `classId` (also new this phase) matches, so the classic
 * Ash/Wren/Bram/Mira roster and the two caster classes (Wizard/Cleric) never
 * see any of these buttons. Cunning Action and Uncanny Dodge have no rest
 * limit in the SRD, so they're gated only by their own per-turn resource
 * (the bonus action slot, or the reaction, both of which reset every turn).
 *
 * Phase 13.4 (D-088): Second Wind/Action Surge's real "once per rest" SRD
 * cadence — 13.2 shipped these capped at once per BATTLE, an explicit
 * placeholder, since no Rest system existed yet. `RestSystem` now owns a
 * per-run, difficulty-tuned pool of Short/Long Rest charges; `shortRest`/
 * `longRest` below are what it calls on every living hero when the player
 * opts into one between waves. `secondWindUsed`/`actionSurgeUsed` are no
 * longer reset by anything else — only an actual rest clears them.
 *
 * Phase 13.3 (D-089): real per-class leveling for a D&D-built hero
 * (`classId`/`abilityScores` both set). `levelUpClass()` advances `level` by
 * one and recomputes `maxHealth`/`attackDamage`/`attackBonus`/
 * `attacksPerAction` from `CharacterSystem.combatStatsForClassLevel` — the
 * SAME formula `CharacterBuildSystem.heroDefinitionFromBuild` used once at
 * creation. The classic fixed roster (no `classId`/`abilityScores`) never
 * calls this; it keeps the flat `grantVigor`/`grantMight` choice instead —
 * the two leveling mechanisms are deliberately unreconciled, exactly like
 * `CharacterSystem`'s own doc comment always said they eventually would be.
 *
 * Phase 13.5 (D-090): `spellSaveDC` exposes the DC a caster hero's
 * save-based effects (e.g. Sacred Flame) target — the one real gameplay
 * hookup this sub-phase's saving-throw math got; `SavingThrowSystem`/
 * `InitiativeSystem` themselves stay framework-only (built, tested, not
 * otherwise called anywhere yet).
 *
 * Phase 13.6 (D-091): the ASI-or-feat choice a D&D-built hero earns at every
 * level `CharacterSystem.asiFeatureGrantedAtLevel` flags. `improveAbilityScore`
 * raises one ability score in place (capped at `MAX_ABILITY_SCORE`) and
 * recomputes every ability-score-derived combat number via the same
 * `combatStatsForClassLevel` formula `levelUpClass` uses — both now share the
 * private `applyLeveledStats` helper. `grantFeat` records a chosen feat;
 * Tough's HP bonus (`featHitPointBonus`) folds into `effectiveMaxHealth`
 * alongside the classic roster's `bonusMaxHealth`, and Lucky's fixed reroll
 * pool (`luckyPointsRemaining`) is spent automatically on this hero's basic
 * attacks (no interrupt-prompt UI exists — same auto-apply precedent as
 * Uncanny Dodge, D-087) and recharges only on a Long Rest, matching the SRD.
 *
 * Phase 13.11 (D-096): `assignedSubclassId`/`grantSubclass`/`subclassId`
 * make a hero's subclass (Champion/School of Evocation/Thief/Life Domain —
 * `data/subclasses.ts`, D-076) real and reachable for the first time —
 * previously chosen by no one, ever. `critThreshold` (Champion's Improved/
 * Superior Critical) and `discipleOfLifeBonus`/`blessedHealerBonus` (Life
 * Domain) are the two subclasses' newly-wired real effects; every other
 * subclass feature stays exactly as inert as `data/subclasses.ts` documents.
 * A free starting-equipment pick from character creation is applied
 * straight into `equippedItems` in the constructor, below.
 *
 * Phase 14 (D-097): three more subclasses (one each for Barbarian/Bard/
 * Druid/Monk/Paladin/Ranger/Sorcerer/Warlock never had one before) get a
 * real mechanical hookup, same bar as Champion/Life Domain — `Hero
 * .colossusSlayerBonus` (Hunter), `.darkOnesBlessingHeal` (The Fiend), and
 * `.subclassHpPerLevelBonus` (Draconic Bloodline, folded into
 * `effectiveMaxHealth` via `flatHpBonusesTotal`). Every other new-subclass
 * feature stays exactly as inert as `data/subclasses.ts` documents.
 *
 * Phase 14.2 (D-099): every class's SECOND, original subclass gets its own
 * real hookup too — `subclassArmorClassBonus`/`subclassAttackBonus`/
 * `subclassSmiteBonus`/`beastbondStrikeHeal`/`shadowbladeFirstStrikeBonus`/
 * `subclassHpPerLevelBonus` (now shared by three subclasses, not just
 * Draconic Bloodline)/a Wild-Shape-heal bump/a Sorcery-Point-max bump. See
 * each getter's own comment for which subclass it belongs to.
 */
export class Hero implements Combatant {
  readonly id: string;
  readonly name: string;
  readonly movementTiles: number;
  maxHealth: number;
  attackDamage: number;
  /**
   * Phase 17 (D-108): renamed from the old `readonly attackRangeTiles`
   * field — this is now just the FALLBACK range used when no weapon is
   * equipped (unchanged meaning/values from before this phase). See the
   * `attackRangeTiles` getter below for the weapon-aware effective value
   * every caller should keep reading exactly as before.
   */
  private readonly baseAttackRangeTiles: number;
  attackBonus: number;
  readonly baseArmorClass: number;
  readonly abilityId: string;
  /** Phase 11.4 (D-077): "human" (default) waits for clicks; "ai" acts on its own. */
  readonly controlledBy: HeroControlMode;
  /** Phase 13.2 (D-087): which class-gated action-economy features this hero qualifies for, if any. */
  readonly classId?: string;
  /**
   * Phase 13.3 (D-089): set at creation, used to recompute stats on
   * `levelUpClass`. Phase 13.6 (D-091): no longer `readonly` — an Ability
   * Score Improvement mutates it in place via `improveAbilityScore`.
   */
  private abilityScores?: AbilityScores;
  /** Phase 13.3 (D-089): a D&D-built hero's real class level. Always 1 for the classic fixed roster. */
  private classLevel = 1;
  /** Phase 13.3 (D-089): how many basic attacks one Attack action makes (Fighter's Extra Attack). */
  private extraAttacks = 1;
  /** Phase 13.6 (D-091): feat ids chosen in place of an Ability Score Improvement. Always empty for the classic fixed roster. */
  private feats: string[] = [];
  /** Phase 13.6 (D-091): Lucky's reroll pool, if this hero has the feat. Recharges only on a Long Rest. */
  private luckyPointsRemaining = 0;
  /**
   * Phase 13.7 (D-092): a caster's remaining spell slots, index 0 = 1st-level.
   * Empty for a non-caster or the classic fixed roster. Restored to full only
   * by a Long Rest (matches the SRD — a Short Rest does not refill a
   * Wizard/Cleric's slots, unlike a Warlock's).
   */
  private spellSlotsRemaining: number[] = [];
  /** Phase 13.8 (D-093): Barbarian's Rage uses remaining this Long Rest. */
  private rageUsesRemaining = 0;
  /** Phase 13.8 (D-093): turns left on a Rage/Wild Shape damage-halving buff — shared field, a hero is single-class so only one class's mechanic ever sets it. */
  private damageResistanceTurnsRemaining = 0;
  /** Phase 13.8 (D-093): Monk's Ki points remaining, spent on Flurry of Blows. */
  private kiPointsRemaining = 0;
  /** Phase 13.8 (D-093): Druid's Wild Shape uses remaining this Long Rest. */
  private wildShapeUsesRemaining = 0;
  /** Phase 13.8 (D-093): Bard's Bardic Inspiration uses remaining this rest. */
  private bardicInspirationUsesRemaining = 0;
  /** Phase 13.8 (D-093): a pending Bardic Inspiration bonus on THIS hero's next attack (granted by a Bard, possibly to itself). */
  private inspirationBonus = 0;
  /** Phase 13.8 (D-093): Sorcerer's Sorcery Points remaining, spent on Metamagic: Quickened Spell. */
  private sorceryPointsRemaining = 0;
  /** Phase 13.8 (D-093): true after Quicken Spell, until the next spell cast consumes it instead of the action slot. */
  private quickenedSpellReadyFlag = false;
  /** Phase 13.8 (D-093): Ranger's Hunter's Mark target, if any. */
  private markedTargetId: string | null = null;
  /**
   * Phase 13.11 (D-096): this hero's subclass, once chosen — set at
   * creation for a level-1-choice class (Cleric/Sorcerer/Warlock), or later
   * via `grantSubclass` the first time `levelUpClass()` reaches the class's
   * own choice level (Fighter/Wizard/Rogue). Undefined for the classic
   * fixed roster, a class with no modeled subclass yet, or a hero that
   * hasn't reached its choice level.
   */
  private assignedSubclassId?: string;
  /**
   * Phase 16 (D-106): every lingering ally buff currently on this hero (e.g.
   * Bless), granted by another hero's (or its own) spell. See
   * `data/buffEffects.ts` — same apply/refresh/tick shape as `Enemy`'s
   * `activeStatuses`, just on the ally side.
   */
  private activeBuffs: ActiveBuff[] = [];
  /**
   * Phase 21 (D-112): every active status effect an ENEMY has inflicted on
   * this hero (e.g. "poisoned", "silenced") — mirrors `Enemy.activeStatuses`
   * field-for-field, reusing the exact same `StatusEffectId`/
   * `StatusEffectDefinition` data shape rather than a parallel hero-only
   * one. See `applyStatus`/`hasStatus`/`tickStatuses` below, and the
   * `armorClass`/`attacksWithDisadvantage`/`effectiveMovementTiles`/
   * `canMove`/`canAct`/`tickStatusDamage` call sites that consume it.
   */
  private activeStatuses: ActiveStatus[] = [];
  /**
   * Phase 17 (D-108): the class-rider portion of attack damage (see
   * `HeroDefinition.classRiderDamage`), applied on top of whatever a real
   * equipped weapon's own damage comes to. 0 for the classic fixed roster
   * and any class with no by-level bonus-damage table.
   */
  private classRiderDamage: number;
  /** Phase 17 (D-108): the Vex weapon mastery's pending advantage target, if any — see `hasVexAgainst`. */
  private vexTargetId: string | null = null;
  /** Phase 17 (D-108): the Cleave weapon mastery is once-per-turn — see `canUseCleaveMastery`. */
  private cleaveUsedThisTurn = false;
  /** Phase 18 (D-109): Grappler's once-per-turn restrain use — see `canUseGrapplerRestrain`. */
  private grapplerRestrainUsedThisTurn = false;
  /** Phase 19 (D-110): the once-per-turn off-hand attack (Two-Weapon Fighting's base mechanic) — see `canUseOffHandAttack`. */
  private offHandAttackUsedThisTurn = false;
  /** Phase 18 (D-109): Boon of Combat Prowess's once-per-turn miss-to-hit use — see `canUseCombatProwess`. */
  private combatProwessUsedThisTurn = false;
  /** Phase 18 (D-109): Boon of Fate's once-per-rest charge — see `canUseBoonOfFate`. */
  private boonOfFateChargeAvailable = false;
  /** Phase 18 (D-109): which ability Boon of Irresistible Offense raised, if this hero holds it. */
  private irresistibleOffenseAbility?: AbilityScoreId;
  /** Phase 18 (D-109): every Magic Initiate pick this hero has made (repeatable, one per spell list). */
  private magicInitiateGrants: MagicInitiateGrant[] = [];
  /** Phase 18 (D-109): remaining free casts of each grant's leveled spell, parallel to `magicInitiateGrants`. Refills on a Long Rest. */
  private magicInitiateSpellUsesRemaining: number[] = [];

  /** Current tile. Only changes when a move is COMMITTED via moveTo(). */
  position: GridPosition;
  /** Current hit points. Reaches 0 when the hero is defeated. */
  health: number;
  /** Persistent gear, one item id per slot (Phase 11.5, D-078). Empty slots are absent keys. */
  equippedItems: Partial<Record<GearSlotId, string>> = {};
  /** Loaded potions, one per general slot. Using a potion removes its key. */
  equippedPotions: Partial<Record<GeneralSlotId, string>> = {};

  private moved = false;
  private acted = false;
  private bonusMaxHealth = 0;
  private bonusAttackDamage = 0;
  /** Phase 22 (magic-item expansion): a permanent-for-the-rest-of-the-battle movement bonus from Potion of Speed — never cleared by a rest, mirrors `bonusAttackDamage`. */
  private bonusMovementTiles = 0;
  /** Phase 22: a permanent-for-the-rest-of-the-battle damage-resistance grant from Potion of Resistance — unlike Rage/Wild Shape's `damageResistanceTurnsRemaining`, never expires or is cleared by a rest. */
  private permanentDamageResistance = false;
  /** Phase 13.2 (D-087): the bonus-action slot — Second Wind or Cunning Action's Dash. */
  private bonusActed = false;
  /** Phase 13.2/13.4 (D-087/D-088): once-per-REST resources — cleared only by `shortRest`/`longRest`. */
  private secondWindUsed = false;
  private actionSurgeUsed = false;
  /** Uncanny Dodge's reaction — recharges every turn, not once per battle. */
  private reactionAvailable = true;
  /** Phase 14.2 (D-099): Shadowblade's First Strike — spent the first time it's applied, never again this battle. */
  private shadowbladeFirstStrikeUsed = false;

  constructor(def: HeroDefinition, startPosition: GridPosition) {
    this.id = def.id;
    this.name = def.name;
    this.movementTiles = def.movementTiles;
    this.maxHealth = def.maxHealth;
    this.attackDamage = def.attackDamage;
    this.baseAttackRangeTiles = def.attackRangeTiles;
    this.attackBonus = def.attackBonus;
    this.classRiderDamage = def.classRiderDamage ?? 0;
    this.baseArmorClass = def.baseArmorClass;
    this.abilityId = def.abilityId;
    this.controlledBy = def.controlledBy ?? "human";
    this.classId = def.classId;
    this.abilityScores = def.abilityScores;
    this.assignedSubclassId = def.subclassId;
    this.position = { ...startPosition };
    // Phase 14 (D-097)/14.2 (D-099): a level-1 Draconic Bloodline
    // Sorcerer/Starbound Patron Warlock/Way of the Iron Body Monk's flat
    // per-level HP bonus is already in effect at creation (its subclass is
    // assigned before this line runs) — start at full effective HP, not one
    // level's worth short of it.
    this.health = def.maxHealth + this.subclassHpPerLevelBonus;
    // Phase 13.11 (D-096): a free starting-gear pick from character
    // creation, if any — placed straight into its matching slot instance
    // (a ring defaults to the first ring slot; nothing else contends for it
    // this early). See CharacterCreationScene's Gear row.
    if (def.startingEquipmentId) {
      const item = getEquipmentDefinition(def.startingEquipmentId);
      const slotId: GearSlotId = item.slot === "ring" ? "ring1" : item.slot;
      this.equippedItems[slotId] = def.startingEquipmentId;
    }
    if (this.classId && this.abilityScores) {
      const classDef = getClassDefinition(this.classId);
      if (classDef.spellcasting) this.spellSlotsRemaining = spellSlotsForClassAtLevel(classDef, this.classLevel);
    }
    // Phase 13.8 (D-093): each new class's signature resource pool, filled
    // to its flat per-rest max at creation — same pattern as `spellSlotsRemaining` above.
    if (this.classId === "barbarian") this.rageUsesRemaining = RAGE_USES_PER_REST;
    if (this.classId === "monk") this.kiPointsRemaining = KI_POINTS_PER_REST;
    if (this.classId === "bard") this.bardicInspirationUsesRemaining = BARDIC_INSPIRATION_USES_PER_REST;
    if (this.classId === "druid") this.wildShapeUsesRemaining = WILD_SHAPE_USES_PER_REST;
    if (this.classId === "sorcerer") this.sorceryPointsRemaining = SORCERY_POINTS_PER_REST + this.subclassSorceryPointBonus;
  }

  /** Phase 13.3 (D-089): a D&D-built hero's real class level (always 1 for the classic fixed roster). */
  get level(): number {
    return this.classLevel;
  }

  /** Phase 13.3 (D-089): basic attacks made per Attack action (Fighter's Extra Attack; 1 for everyone else). */
  get attacksPerAction(): number {
    return this.extraAttacks;
  }

  /** Phase 13.6 (D-091): one ability score's current value (post any Ability Score Improvement). Null for the classic fixed roster. */
  abilityScoreValue(ability: AbilityScoreId): number | null {
    return this.abilityScores ? this.abilityScores[ability] : null;
  }

  /**
   * Phase 13.5 (D-090): the DC a target must meet or beat to resist one of
   * this hero's save-based effects (e.g. Sacred Flame). Null for a hero with
   * no `classId`/`abilityScores` (the classic fixed roster) or whose class
   * has no spellcasting to derive a DC from (Fighter/Rogue).
   */
  get spellSaveDC(): number | null {
    if (!this.classId || !this.abilityScores) return null;
    const classDef = getClassDefinition(this.classId);
    if (!classDef.spellcasting) return null;
    return spellSaveDC(classDef, this.classLevel, this.abilityScores);
  }

  /**
   * Phase 13.10: this hero's bonus on a saving throw an enemy forces (e.g.
   * Blightcaller's attack, resolved by `WaveSystem` against `Combatant
   * .savingThrowBonus`). Uses DEX — the same ability Sacred Flame already
   * targets on an enemy, kept symmetric. A flat default for the classic
   * fixed roster (no ability scores to derive a real one from); real SRD
   * math (ability modifier + proficiency, if proficient) for a D&D-built
   * hero.
   */
  get savingThrowBonus(): number {
    const base = !this.classId || !this.abilityScores
      ? HERO_DEFAULT_SAVING_THROW_BONUS
      : computeSavingThrowBonus(getClassDefinition(this.classId), this.classLevel, this.abilityScores, "dex");
    return base + this.buffTotal("savingThrowBonusDelta") + this.gearBonus("savingThrowBonus");
  }

  /**
   * Phase 22 (magic-item expansion): sums one flat `EquipmentDefinition`
   * field across every filled gear slot — the exact shape `armorClass`'s
   * `otherGearBonus` and `effectiveAttackDamage`'s `gear` loop already used
   * independently before this phase, now shared by those two AND the two new
   * gear-driven bonuses below (`savingThrowBonus` above, `effectiveMovementTiles`).
   * `excludeSlots` lets a caller skip a slot it handles specially (e.g.
   * `armorClass` folds real armor's own AC into `base` instead of summing it
   * here; `effectiveAttackDamage` folds a real weapon's dice-average damage
   * into `base` the same way).
   */
  private gearBonus(
    field: "armorClass" | "attackDamage" | "savingThrowBonus" | "movementBonusTiles" | "rangedAttackBonus" | "rangedAttackDamage",
    excludeSlots: readonly GearSlotId[] = [],
  ): number {
    return GEAR_SLOT_IDS.filter((slot) => !excludeSlots.includes(slot)).reduce((total, slot) => {
      const itemId = this.equippedItems[slot];
      return total + (itemId ? getEquipmentDefinition(itemId)[field] ?? 0 : 0);
    }, 0);
  }

  // ----- Phase 16 (D-106): ally buffs (see data/buffEffects.ts) -----------

  /** Apply (or refresh, to the longer duration) a buff on this hero. */
  applyBuff(id: BuffEffectId, durationTurns: number): void {
    const existing = this.activeBuffs.find((b) => b.id === id);
    if (existing) existing.remainingTurns = Math.max(existing.remainingTurns, durationTurns);
    else this.activeBuffs.push({ id, remainingTurns: durationTurns });
  }

  hasBuff(id: BuffEffectId): boolean {
    return this.activeBuffs.some((b) => b.id === id);
  }

  /** Advance every active buff by one turn, dropping any that expire. */
  tickBuffs(): void {
    this.activeBuffs = this.activeBuffs.filter((b) => --b.remainingTurns > 0);
  }

  /** Every active buff and its remaining duration, for `toSnapshot`. */
  get buffs(): ReadonlyArray<ActiveBuff> {
    return this.activeBuffs;
  }

  private buffTotal(field: "attackBonusDelta" | "armorClassDelta" | "savingThrowBonusDelta"): number {
    return this.activeBuffs.reduce((sum, b) => sum + (getBuffEffectDefinition(b.id)[field] ?? 0), 0);
  }

  // ----- Phase 21 (D-112): hero-side status effects (see data/statusEffects.ts) -----

  /**
   * Apply (or refresh, to the longer duration) a status effect on this
   * hero — identical shape to `Enemy.applyStatus`, plus one addition: Phase
   * 22's `grantsStatusImmunity` (Ring of Free Action, Periapt of Proof
   * against Poison) silently no-ops the specific statuses it lists, the
   * same "immune, not just resisted" treatment Swarm's condition immunity
   * already established on the enemy side.
   */
  applyStatus(id: StatusEffectId, durationTurns: number): void {
    if (this.isImmuneToStatus(id)) return;
    const existing = this.activeStatuses.find((s) => s.id === id);
    if (existing) existing.remainingTurns = Math.max(existing.remainingTurns, durationTurns);
    else this.activeStatuses.push({ id, remainingTurns: durationTurns });
  }

  /** Phase 22 (magic-item expansion): true if any equipped item grants immunity to `id`. */
  private isImmuneToStatus(id: StatusEffectId): boolean {
    return GEAR_SLOT_IDS.some((slot) => {
      const itemId = this.equippedItems[slot];
      return itemId ? getEquipmentDefinition(itemId).grantsStatusImmunity?.includes(id) ?? false : false;
    });
  }

  hasStatus(id: StatusEffectId): boolean {
    return this.activeStatuses.some((s) => s.id === id);
  }

  /** Advance every active status by one turn, dropping any that expire. Called from `resetForNewTurn`. */
  tickStatuses(): void {
    this.activeStatuses = this.activeStatuses.filter((s) => --s.remainingTurns > 0);
  }

  /** Every active status and its remaining duration, for `toSnapshot`. */
  get statuses(): ReadonlyArray<ActiveStatus> {
    return this.activeStatuses;
  }

  private statusTotal(field: "movementReduction" | "armorClassDelta" | "damagePerTurn"): number {
    return this.activeStatuses.reduce((sum, s) => sum + (getStatusEffectDefinition(s.id)[field] ?? 0), 0);
  }

  /** True while ANY active status imposes disadvantage on this hero's own attack roll (e.g. "blinded"-family effects). */
  get attacksWithDisadvantage(): boolean {
    return this.activeStatuses.some((s) => getStatusEffectDefinition(s.id).attackRollDisadvantage);
  }

  /** True while ANY active status prevents this hero's class ability/spell from being cast (e.g. "silenced"). */
  get isSilenced(): boolean {
    return this.activeStatuses.some((s) => getStatusEffectDefinition(s.id).preventsCasting);
  }

  /** True while ANY active status holds this hero in place — no move, no action (e.g. "stunned"/"restrained"). */
  private get isIncapacitatedByStatus(): boolean {
    return this.activeStatuses.some((s) => getStatusEffectDefinition(s.id).preventsAction);
  }

  /**
   * This hero's movement allowance after status reductions (e.g. "slowed"),
   * plus Phase 22's gear-driven movement bonus (Boots of Striding and
   * Springing/Speed) and a permanent Potion of Speed bonus, never below 0.
   */
  get effectiveMovementTiles(): number {
    return Math.max(
      0,
      this.movementTiles - this.statusTotal("movementReduction") + this.gearBonus("movementBonusTiles") + this.bonusMovementTiles,
    );
  }

  /**
   * Apply this turn's damage-over-time statuses (e.g. "poisoned") to this
   * hero's own health, floored at 0, and return the total dealt (0 if none
   * or already defeated) so the caller (BattleScene) can log it — the same
   * split of responsibility `WaveSystem`'s own burning tick uses (the entity
   * only mutates state; the caller renders it). Called once per player
   * phase, alongside `tickStatuses`.
   */
  tickStatusDamage(): number {
    if (!this.isAlive()) return 0;
    const damage = this.statusTotal("damagePerTurn");
    if (damage <= 0) return 0;
    const before = this.health;
    this.health = Math.max(0, this.health - damage);
    return before - this.health;
  }

  /**
   * This hero's to-hit bonus (weapon or spell attack alike) after any active
   * buff (e.g. Bless). `BattleScene` should build every `AttackProfile` from
   * this, not the raw `attackBonus` field, so a buff actually shows up in a
   * fight.
   */
  get effectiveAttackBonus(): number {
    return (
      this.attackBonus +
      this.buffTotal("attackBonusDelta") +
      this.archeryAttackBonus +
      this.weaponEnchantBonus +
      this.rangedGearAttackBonus
    );
  }

  /** Phase 22 (magic-item expansion): Bracers of Archery's conditional to-hit bonus, only while wielding a ranged weapon. 0 otherwise. */
  private get rangedGearAttackBonus(): number {
    return this.equippedWeaponDef?.weapon?.kind === "ranged" ? this.gearBonus("rangedAttackBonus") : 0;
  }

  /** Phase 18 (D-109): the Archery Fighting Style feat's flat to-hit bonus, only while a ranged weapon is equipped. 0 otherwise. */
  private get archeryAttackBonus(): number {
    if (!this.feats.includes("archery")) return 0;
    return this.equippedWeaponDef?.weapon?.kind === "ranged" ? getFeat("archery").flatAttackBonus ?? 0 : 0;
  }

  /** Phase 13.11 (D-096): this hero's subclass, once chosen. Undefined until then (see `grantSubclass`). */
  get subclassId(): string | undefined {
    return this.assignedSubclassId;
  }

  /**
   * Phase 13.11 (D-096): assign this hero's subclass — called once, either
   * at creation (a level-1-choice class, via `CharacterBuildSystem
   * .subclassIdForNewBuild`) or by `BattleScene`'s subclass-choice queue the
   * first time `levelUpClass()` reaches the class's own choice level.
   */
  grantSubclass(subclassId: string): void {
    this.assignedSubclassId = subclassId;
  }

  /**
   * Phase 13.11 (D-096): Champion only — the natural roll (out of 20) that
   * counts as a critical hit. 20 (only a natural 20 crits) for every other
   * hero; 19 from Improved Critical (level 3+, the level Champion is
   * granted at), 18 from Superior Critical (level 15+).
   */
  get critThreshold(): number {
    if (this.assignedSubclassId !== "champion") return 20;
    return this.classLevel >= CHAMPION_SUPERIOR_CRIT_LEVEL
      ? CHAMPION_SUPERIOR_CRIT_THRESHOLD
      : CHAMPION_IMPROVED_CRIT_THRESHOLD;
  }

  /**
   * Phase 13.11 (D-096): Life Domain only — Disciple of Life's bonus HP
   * added when this hero casts a healing spell on someone. 0 for every
   * other hero, or a Life Domain Cleric that hasn't chosen its subclass yet
   * (impossible in practice — Cleric's choice is level 1 — but a safe
   * default all the same).
   */
  get discipleOfLifeBonus(): number {
    return this.assignedSubclassId === "life-domain" ? LIFE_DOMAIN_HEAL_BONUS : 0;
  }

  /**
   * Phase 13.11 (D-096): Life Domain only, level 6+ — Blessed Healer's bonus
   * HP this hero itself regains when it heals someone ELSE (not itself).
   */
  get blessedHealerBonus(): number {
    return this.assignedSubclassId === "life-domain" && this.classLevel >= LIFE_DOMAIN_BLESSED_HEALER_LEVEL
      ? LIFE_DOMAIN_HEAL_BONUS
      : 0;
  }

  /**
   * Phase 14 (D-097): Hunter only — Colossus Slayer's bonus damage on a
   * landed hit against this Ranger's own Hunter's Mark target. Applied in
   * `BattleScene.applyHuntersMarkBonus`, right alongside Hunter's Mark's own
   * bonus damage.
   */
  get colossusSlayerBonus(): number {
    return this.assignedSubclassId === "hunter" ? COLOSSUS_SLAYER_BONUS_DAMAGE : 0;
  }

  /**
   * Phase 14 (D-097): The Fiend only — Dark One's Blessing's flat self-heal
   * whenever this Warlock reduces a hostile creature to 0 HP. Applied in
   * `BattleScene.applyDarkOnesBlessing`.
   */
  get darkOnesBlessingHeal(): number {
    return this.assignedSubclassId === "the-fiend" ? DARK_ONES_BLESSING_HEAL : 0;
  }

  /**
   * Phase 14 (D-097)/14.2 (D-099): every subclass granting a flat max-HP
   * bonus that scales with class level (the SRD's real Draconic Resilience
   * formula, reused for two original subclasses too) — Draconic Bloodline,
   * Way of the Iron Body's Iron Skin, Starbound Patron's Umbral Ward.
   * Folded into `effectiveMaxHealth` alongside `featHitPointBonus`, and
   * given the same "before/after" treatment on level-up (see
   * `applyLeveledStats`) so a level-up's HP gain includes this bonus's own
   * growth, not just the class's base hit-die gain.
   */
  private get subclassHpPerLevelBonus(): number {
    const ids = ["draconic-bloodline", "way-of-the-iron-body", "starbound-patron"];
    return this.assignedSubclassId && ids.includes(this.assignedSubclassId) ? this.classLevel : 0;
  }

  /** The sum of every flat max-HP bonus outside `bonusMaxHealth`/gear — a feat's, and now a subclass's. */
  private get flatHpBonusesTotal(): number {
    return this.featHitPointBonus + this.subclassHpPerLevelBonus;
  }

  /**
   * Phase 14.2 (D-099): Spellblade Tradition's always-on Arcane Deflection,
   * and Path of the Ironhide's Ironhide Stance (while raging only). Folded
   * into `armorClass`.
   */
  private get subclassArmorClassBonus(): number {
    if (this.assignedSubclassId === "spellblade-tradition") return SPELLBLADE_ARCANE_DEFLECTION_AC_BONUS;
    if (this.assignedSubclassId === "path-of-the-ironhide" && this.isRaging) return IRONHIDE_STANCE_AC_BONUS;
    return 0;
  }

  /**
   * Phase 14.2 (D-099): College of the Blade's Battle Hymn, Zeal Domain's
   * Crusader's Wrath, Battle Tactician's Tactician's Precision — a flat,
   * always-on to-hit bonus on this hero's basic Attack. Read by
   * `BattleScene.attackProfileFor`, same wiring shape as `critThreshold`.
   */
  get subclassAttackBonus(): number {
    const ids = ["college-of-the-blade", "zeal-domain", "battle-tactician"];
    return this.assignedSubclassId && ids.includes(this.assignedSubclassId) ? SUBCLASS_ATTACK_BONUS : 0;
  }

  /**
   * Phase 14.2 (D-099): Oath of Retribution's Retributive Smite — Divine
   * Smite deals more bonus damage for this Oath. Read by
   * `BattleScene.applyPaladinSmite`. 0 for every other Paladin.
   */
  get subclassSmiteBonus(): number {
    return this.assignedSubclassId === "oath-of-retribution" ? RETRIBUTION_SMITE_BONUS : 0;
  }

  /**
   * Phase 14.2 (D-099): Beastbond Warden's Bonded Strike — a flat self-heal
   * whenever this Ranger hits its own Hunter's Mark target. Read by
   * `BattleScene.applyHuntersMarkBonus`, alongside Hunter's own Colossus
   * Slayer bonus. 0 for every other Ranger.
   */
  get beastbondStrikeHeal(): number {
    return this.assignedSubclassId === "beastbond-warden" ? BEASTBOND_STRIKE_HEAL : 0;
  }

  /**
   * Phase 14.2 (D-099): Shadowblade's First Strike — bonus damage on this
   * Rogue's first landed hit each battle. Consumed via
   * `consumeShadowbladeFirstStrike` the instant it's applied (see
   * `BattleScene`'s basic-attack resolution), so it never fires twice.
   */
  get shadowbladeFirstStrikeBonus(): number {
    return this.assignedSubclassId === "shadowblade" && !this.shadowbladeFirstStrikeUsed
      ? SHADOWBLADE_FIRST_STRIKE_BONUS
      : 0;
  }

  /** Spends Shadowblade's one-time First Strike bonus for this battle. */
  consumeShadowbladeFirstStrike(): void {
    this.shadowbladeFirstStrikeUsed = true;
  }

  /** Phase 14.2 (D-099): Wildsurge Origin's Volatile Magic — +1 maximum Sorcery Point. Read wherever `sorceryPointsRemaining` is (re)filled. */
  private get subclassSorceryPointBonus(): number {
    return this.assignedSubclassId === "wildsurge-origin" ? WILDSURGE_BONUS_SORCERY_POINTS : 0;
  }

  /** Phase 14.2 (D-099): Circle of the Ashen Veil's Ember Shape — Wild Shape heals for more. Read by `useWildShape`. */
  private get subclassWildShapeHealBonus(): number {
    return this.assignedSubclassId === "circle-of-the-ashen-veil" ? ASHEN_VEIL_WILD_SHAPE_HEAL_BONUS : 0;
  }

  /** Phase 17 (D-108): this hero's Dexterity modifier, or 0 for the classic fixed roster (no ability scores). */
  private get dexMod(): number {
    return this.abilityScores ? modifierFor(this.abilityScores, "dex") : 0;
  }

  /** Phase 17 (D-108): this hero's Strength modifier, or 0 for the classic fixed roster (no ability scores). */
  private get strMod(): number {
    return this.abilityScores ? modifierFor(this.abilityScores, "str") : 0;
  }

  /** Phase 17 (D-108): the real weapon in this hero's new `"weapon"` gear slot, or null if empty. */
  private get equippedWeaponDef(): EquipmentDefinition | null {
    const itemId = this.equippedItems.weapon;
    if (!itemId) return null;
    const def = getEquipmentDefinition(itemId);
    return def.weapon ? def : null;
  }

  /**
   * Phase 17 (D-108): a Versatile weapon is gripped two-handed (using its
   * bigger damage die) whenever no Shield is equipped alongside it — the
   * real SRD tradeoff (a shield occupies the hand a two-handed grip needs).
   */
  private get usingTwoHandedGrip(): boolean {
    return !this.equippedItems.shield;
  }

  /**
   * Armor Class: real armor in the chest slot (the `armor` field) REPLACES
   * the unarmored base formula outright — light armor adds this hero's full
   * Dex modifier (mechanically identical to the old unarmored-AC formula,
   * so nothing changes for a hero who never equips one), medium armor caps
   * the Dex bonus, heavy armor ignores Dex entirely (Phase 17, D-108). A
   * flavor chest item (no `armor` field, e.g. Iron Buckler) keeps working
   * exactly as before: a flat bonus ON TOP of the unarmored base. Every
   * other slot (including the new Shield) always adds a flat bonus, same as
   * always.
   */
  get armorClass(): number {
    const chestItemId = this.equippedItems.chest;
    const chestDef = chestItemId ? getEquipmentDefinition(chestItemId) : null;
    let base = this.baseArmorClass;
    let chestFlatBonus = chestDef?.armorClass ?? 0;
    if (chestDef?.armor) {
      const dexMod = this.dexMod;
      const effectiveDexMod =
        chestDef.armor.dexMode === "none" ? 0 : chestDef.armor.dexMode === "capped" ? Math.min(dexMod, chestDef.armor.dexCap ?? 2) : dexMod;
      base = chestDef.armor.baseAC + effectiveDexMod;
      chestFlatBonus = 0; // real armor's own bonus is already folded into `base` above
    }
    const otherGearBonus = this.gearBonus("armorClass", ["chest"]);
    return (
      base +
      chestFlatBonus +
      otherGearBonus +
      this.subclassArmorClassBonus +
      this.defenseArmorClassBonus +
      this.buffTotal("armorClassDelta") +
      this.statusTotal("armorClassDelta")
    );
  }

  /** Phase 18 (D-109): the Defense Fighting Style feat's flat AC bonus, only while real armor (not just a flavor chest item) is worn. 0 otherwise. */
  private get defenseArmorClassBonus(): number {
    if (!this.feats.includes("defense")) return 0;
    const chestId = this.equippedItems.chest;
    const chestDef = chestId ? getEquipmentDefinition(chestId) : null;
    return chestDef?.armor ? getFeat("defense").armorClassBonus ?? 0 : 0;
  }

  /** Max HP after level-up bonuses, any feat HP bonus, and a flat-HP subclass bonus (equipment does not affect max HP). */
  get effectiveMaxHealth(): number {
    return this.maxHealth + this.bonusMaxHealth + this.flatHpBonusesTotal;
  }

  /** Phase 13.6 (D-091): Tough's HP bonus, scaled to this hero's current class level. 0 without the feat. */
  private get featHitPointBonus(): number {
    return this.feats.includes("tough") ? hitPointBonusFromFeat(getFeat("tough"), this.classLevel) : 0;
  }

  /**
   * Basic-attack damage after level-up bonuses, equipped gear (summed across
   * every slot), and a Barbarian's Rage bonus while raging.
   *
   * Phase 17 (D-108): a real equipped weapon REPLACES the base attackDamage
   * number with its own dice-average damage (Monk's melee-scales-off-DEX
   * exception aside, `weaponAbilityModifier` picks STR/DEX/finesse-best the
   * same way `CharacterSystem.combatStatsForClassLevel` already did) plus
   * this hero's `classRiderDamage` (a class's own by-level bonus, e.g. Sneak
   * Attack, kept separate exactly so it still applies here) — a hero with no
   * weapon equipped is completely unaffected, same `this.attackDamage` as
   * before this phase.
   */
  get effectiveAttackDamage(): number {
    const weaponDef = this.equippedWeaponDef;
    const base = weaponDef?.weapon
      ? weaponAttackDamage(weaponDef.weapon, {
          abilityModifier: weaponAbilityModifier(weaponDef.weapon, this.strMod, this.dexMod),
          twoHandedGrip: this.usingTwoHandedGrip,
        }) + this.classRiderDamage
      : this.attackDamage;
    const gear = this.gearBonus("attackDamage", ["weapon"]);
    const rageBonus = this.isRaging ? RAGE_DAMAGE_BONUS : 0;
    return (
      Math.max(1, base) +
      this.bonusAttackDamage +
      gear +
      rageBonus +
      this.savageAttackerDamageBonus +
      this.greatWeaponFightingDamageBonus +
      this.weaponEnchantBonus +
      this.rangedGearAttackDamageBonus
    );
  }

  /**
   * Phase 22 (magic-item expansion): the enchant overlay's `+1/+2/+3` bonus
   * on this hero's equipped weapon, applied to BOTH the attack roll
   * (`effectiveAttackBonus`) and the damage roll (here) — the real SRD rule.
   * 0 with no weapon equipped, or a weapon with no enchant level.
   */
  private get weaponEnchantBonus(): number {
    return this.equippedWeaponDef?.enchantLevel ?? 0;
  }

  /** Phase 22: Bracers of Archery's conditional damage bonus, only while wielding a ranged weapon. 0 otherwise. */
  private get rangedGearAttackDamageBonus(): number {
    return this.equippedWeaponDef?.weapon?.kind === "ranged" ? this.gearBonus("rangedAttackDamage") : 0;
  }

  /** Phase 18 (D-109): Savage Attacker's flat damage bonus — always on. This game's flat (never dice-rolled) damage model can't model a literal "reroll and keep the better result," so this is the diceless-conversion treatment every other SRD dice mechanic here already gets. 0 without the feat. */
  private get savageAttackerDamageBonus(): number {
    return this.feats.includes("savage-attacker") ? getFeat("savage-attacker").flatDamageBonus ?? 0 : 0;
  }

  /** Phase 18 (D-109): Great Weapon Fighting's flat damage bonus, only while wielding a weapon two-handed (a real Two-Handed weapon, or a Versatile one gripped two-handed — see `usingTwoHandedGrip`). Same diceless-conversion treatment as `savageAttackerDamageBonus`. 0 otherwise. */
  private get greatWeaponFightingDamageBonus(): number {
    if (!this.feats.includes("great-weapon-fighting")) return 0;
    const weapon = this.equippedWeaponDef?.weapon;
    if (!weapon) return 0;
    const grippedTwoHanded = weapon.properties.includes("twoHanded") || (weapon.properties.includes("versatile") && this.usingTwoHandedGrip);
    return grippedTwoHanded ? getFeat("great-weapon-fighting").flatDamageBonus ?? 0 : 0;
  }

  /**
   * Basic-attack reach in tiles. Phase 17 (D-108): a real equipped weapon
   * REPLACES the base range (see `WeaponSystem.weaponRangeTiles`) — a hero
   * with no weapon equipped keeps `baseAttackRangeTiles` exactly as before
   * this phase (the class/signature-ability-derived value it always was).
   */
  get attackRangeTiles(): number {
    const weaponDef = this.equippedWeaponDef;
    return weaponDef?.weapon ? weaponRangeTiles(weaponDef.weapon) : this.baseAttackRangeTiles;
  }

  // ----- Phase 17 (D-108): weapon mastery state -----------------------------

  /**
   * The Vex weapon mastery: true once this hero has advantage on its next
   * attack against `targetId` (granted by a prior landed hit with a Vex
   * weapon). Consumed by `clearVex` the instant it's used, so it never
   * lingers past the one attack the SRD grants it for.
   */
  hasVexAgainst(targetId: string): boolean {
    return this.vexTargetId === targetId;
  }

  /** Grant Vex's pending advantage against `targetId` (replaces any earlier pending target). */
  setVex(targetId: string): void {
    this.vexTargetId = targetId;
  }

  /** Spend (or otherwise clear) any pending Vex advantage. */
  clearVex(): void {
    this.vexTargetId = null;
  }

  /** Phase 17 (D-108): the real weapon in this hero's `"weapon"` slot, or null — read by `BattleScene` to resolve Cleave/Graze's own weapon-die math. */
  get equippedWeapon(): EquipmentDefinition | null {
    return this.equippedWeaponDef;
  }

  /**
   * Phase 19 (D-110): a Light melee weapon may occupy this hero's `"shield"`
   * gear slot as an off-hand weapon instead of a Shield (mutually
   * exclusive — see `BattleScene.equipGearOnHero`'s equip-time guard). Null
   * if that slot is empty or holds a real Shield.
   */
  private get offHandWeaponDef(): EquipmentDefinition | null {
    const itemId = this.equippedItems.shield;
    if (!itemId) return null;
    const def = getEquipmentDefinition(itemId);
    return def.weapon ? def : null;
  }

  /** Phase 19 (D-110): the off-hand weapon in this hero's `"shield"` slot, or null — read by `BattleScene` to resolve the off-hand attack. */
  get offHandWeapon(): EquipmentDefinition | null {
    return this.offHandWeaponDef;
  }

  /**
   * Phase 19 (D-110): true if this hero is wielding a Light melee weapon in
   * BOTH hands — the SRD's base prerequisite for a two-weapon-fighting
   * bonus-action attack, independent of whether this hero has the
   * Two-Weapon Fighting FEAT (that feat only changes whether the off-hand
   * attack's damage adds an ability modifier — see `offHandAttackDamage`).
   */
  get isDualWieldingLightWeapons(): boolean {
    const main = this.equippedWeaponDef?.weapon;
    const off = this.offHandWeaponDef?.weapon;
    return !!main && main.kind === "melee" && main.properties.includes("light") && !!off && off.properties.includes("light");
  }

  /** Phase 19 (D-110): true if either equipped weapon (main or off-hand) carries the Nick mastery — its real SRD effect: the off-hand attack rides along on the Attack action instead of costing the bonus action. */
  private get nickGrantsFreeOffHandAttack(): boolean {
    return this.equippedWeaponDef?.weapon?.mastery === "nick" || this.offHandWeaponDef?.weapon?.mastery === "nick";
  }

  /**
   * Phase 19 (D-110): true if this hero can make its off-hand attack right
   * now — dual-wielding Light weapons, already took the Attack action this
   * turn, hasn't already made this turn's one off-hand attack, and either
   * has the bonus action free or carries Nick (which makes it free).
   */
  canUseOffHandAttack(): boolean {
    if (!this.isDualWieldingLightWeapons || !this.acted || this.offHandAttackUsedThisTurn) return false;
    return this.nickGrantsFreeOffHandAttack || this.canUseBonusAction();
  }

  /** Spends this turn's one off-hand attack — the bonus action too, unless Nick makes it free. */
  useOffHandAttack(): void {
    this.offHandAttackUsedThisTurn = true;
    if (!this.nickGrantsFreeOffHandAttack) this.bonusActed = true;
  }

  /**
   * Phase 19 (D-110): the off-hand weapon's attack damage. The SRD's base
   * rule skips this hero's ability modifier for an off-hand attack; the
   * Two-Weapon Fighting FEAT is what adds it back in. 0 without a valid
   * off-hand weapon.
   */
  get offHandAttackDamage(): number {
    const weapon = this.offHandWeaponDef?.weapon;
    if (!weapon) return 0;
    const abilityModifier = this.feats.includes("two-weapon-fighting") ? weaponAbilityModifier(weapon, this.strMod, this.dexMod) : 0;
    return weaponAttackDamage(weapon, { abilityModifier, twoHandedGrip: false });
  }

  /** Phase 17 (D-108): the ability modifier this hero's CURRENT weapon attack uses (0 with no weapon equipped). */
  get weaponAbilityModifierNow(): number {
    const def = this.equippedWeaponDef;
    return def?.weapon ? weaponAbilityModifier(def.weapon, this.strMod, this.dexMod) : 0;
  }

  /**
   * Phase 17 (D-108): the Cleave weapon mastery's "no ability modifier
   * added" second-target damage — this weapon's dice average alone (current
   * grip's die if Versatile), or 0 with no weapon equipped.
   */
  get equippedWeaponDieAverage(): number {
    const def = this.equippedWeaponDef;
    if (!def?.weapon) return 0;
    const dice = this.usingTwoHandedGrip && def.weapon.versatileDamageDice ? def.weapon.versatileDamageDice : def.weapon.damageDice;
    return averageDiceDamage(dice);
  }

  /** Cleave (weapon mastery): true if this hero hasn't already used it this turn. */
  get canUseCleaveMastery(): boolean {
    return !this.cleaveUsedThisTurn;
  }

  /** Spends this turn's one Cleave use. */
  consumeCleaveMastery(): void {
    this.cleaveUsedThisTurn = true;
  }

  /**
   * True if equipping `itemId` into `slot` would leave this hero holding a
   * Two-Handed weapon AND a Shield at once — the real SRD rule (a
   * Two-Handed weapon needs both hands; a Shield occupies one). Accounts for
   * whatever `slot` already holds being replaced by the swap, same shape as
   * `wouldExceedAttunementLimit`.
   */
  wouldConflictWithGrip(itemId: string, slot: GearSlotId): boolean {
    if (slot !== "weapon" && slot !== "shield") return false;
    const def = getEquipmentDefinition(itemId);
    if (slot === "shield") {
      const weaponId = this.equippedItems.weapon;
      const weaponDef = weaponId ? getEquipmentDefinition(weaponId) : null;
      return !!weaponDef?.weapon?.properties.includes("twoHanded");
    }
    // slot === "weapon": does the INCOMING weapon conflict with an already-equipped Shield?
    return !!def.weapon?.properties.includes("twoHanded") && !!this.equippedItems.shield;
  }

  // ----- Phase 13.9 (D-094): loot expansion — attunement and item procs ---

  /**
   * Every currently-equipped item id that requires attunement. Derived
   * straight from `equippedItems` rather than tracked as separate state —
   * equipping such an item is gated by `wouldExceedAttunementLimit` (see
   * `BattleScene.equipGearOnHero`), so a hero can never end up wearing one
   * it isn't attuned to; there is nothing to fall out of sync.
   */
  get attunedItemIds(): string[] {
    return GEAR_SLOT_IDS.reduce<string[]>((ids, slot) => {
      const itemId = this.equippedItems[slot];
      if (itemId && getEquipmentDefinition(itemId).requiresAttunement) ids.push(itemId);
      return ids;
    }, []);
  }

  /** True if attuning to one more item would stay at or under `MAX_ATTUNEMENTS`. */
  canAttuneToAnother(): boolean {
    return this.attunedItemIds.length < MAX_ATTUNEMENTS;
  }

  /**
   * True if equipping `itemId` into `slot` would push this hero's attunement
   * past `MAX_ATTUNEMENTS` — accounting for whatever `slot` already holds
   * being freed by the swap (so replacing one attuned ring with another
   * never itself counts against the cap).
   */
  wouldExceedAttunementLimit(itemId: string, slot: GearSlotId): boolean {
    const def = getEquipmentDefinition(itemId);
    if (!def.requiresAttunement) return false;
    const prevId = this.equippedItems[slot];
    const freed = prevId && getEquipmentDefinition(prevId).requiresAttunement ? 1 : 0;
    return this.attunedItemIds.length - freed + 1 > MAX_ATTUNEMENTS;
  }

  /** Every currently-equipped item that carries a real on-hit/on-kill proc, in slot order. Read by `BattleScene.applyEquipmentProcs`. */
  equippedProcItems(): EquipmentDefinition[] {
    return GEAR_SLOT_IDS.reduce<EquipmentDefinition[]>((defs, slot) => {
      const itemId = this.equippedItems[slot];
      if (!itemId) return defs;
      const def = getEquipmentDefinition(itemId);
      if (def.proc) defs.push(def);
      return defs;
    }, []);
  }

  /** True if any general slot currently holds a potion. */
  hasAnyPotion(): boolean {
    return GENERAL_SLOT_IDS.some((slot) => this.equippedPotions[slot] !== undefined);
  }

  /** The lowest-numbered filled general slot, or null if both are empty. */
  firstLoadedPotionSlot(): GeneralSlotId | null {
    return GENERAL_SLOT_IDS.find((slot) => this.equippedPotions[slot] !== undefined) ?? null;
  }

  /**
   * Consume the potion in the given slot: applies its effect, then empties
   * the slot. Returns the potion's definition (for logging) or null if the
   * slot was already empty.
   *
   * Phase 22 (magic-item expansion) adds three effect branches alongside the
   * original "heal"/"attackBuff": "movementBuff"/"resistanceBuff" (both
   * permanent for the rest of the battle, mirroring "attackBuff"'s own
   * treatment) and "cureAndHeal" (clears every active status, then heals).
   */
  usePotion(slot: GeneralSlotId): PotionDefinition | null {
    const itemId = this.equippedPotions[slot];
    if (!itemId) return null;
    const def = getPotionDefinition(itemId);
    if (def.effect === "heal") {
      this.health = Math.min(this.effectiveMaxHealth, this.health + def.amount);
    } else if (def.effect === "attackBuff") {
      this.grantMight(def.amount);
    } else if (def.effect === "movementBuff") {
      this.grantHaste(def.amount);
    } else if (def.effect === "resistanceBuff") {
      this.grantResistance();
    } else {
      this.cureAllStatuses();
      this.health = Math.min(this.effectiveMaxHealth, this.health + def.amount);
    }
    delete this.equippedPotions[slot];
    return def;
  }

  /** Level-up choice: raise max HP and heal the hero for the same amount. */
  grantVigor(amount: number): void {
    this.bonusMaxHealth += amount;
    this.health += amount;
  }

  /** Level-up choice: raise basic-attack damage. */
  grantMight(amount: number): void {
    this.bonusAttackDamage += amount;
  }

  /** Phase 22 (magic-item expansion): Potion of Speed — a permanent-for-the-rest-of-the-battle movement bonus. */
  grantHaste(amount: number): void {
    this.bonusMovementTiles += amount;
  }

  /** Phase 22: Potion of Resistance — a permanent-for-the-rest-of-the-battle damage-halving grant (see `hasDamageResistance`). */
  grantResistance(): void {
    this.permanentDamageResistance = true;
  }

  /** Phase 22: Restorative Ointment — clears every active status effect outright. */
  cureAllStatuses(): void {
    this.activeStatuses = [];
  }

  /**
   * Phase 13.3 (D-089): advance this hero's real D&D class level by one and
   * recompute every level-dependent combat number from
   * `CharacterSystem.combatStatsForClassLevel`. A no-op for a hero with no
   * `classId`/`abilityScores` (the classic fixed roster — callers should
   * already be filtering to a D&D-built party, this is a defensive guard,
   * not the intended gate) or already at `MAX_CLASS_LEVEL`.
   *
   * HP gained on level-up is added to CURRENT health immediately (the SRD's
   * real rule — a level-up isn't a full heal, but the new HP is genuinely
   * yours the instant you gain it), not just to the max.
   */
  levelUpClass(): void {
    if (!this.classId || !this.abilityScores) return;
    if (this.classLevel >= MAX_CLASS_LEVEL) return;
    const flatHpBonusesBefore = this.flatHpBonusesTotal;
    const oldLevel = this.classLevel;
    this.classLevel += 1;
    const stats = combatStatsForClassLevel(this.classId, this.classLevel, this.abilityScores, this.abilityId);
    this.applyLeveledStats(stats, flatHpBonusesBefore);
    const classDef = getClassDefinition(this.classId);
    if (classDef.spellcasting) this.growSpellSlots(classDef, oldLevel, this.classLevel);
  }

  /**
   * Phase 13.7 (D-092): grow `spellSlotsRemaining` by however much MAX slots
   * increased at each spell level between `oldLevel` and `newLevel` — a
   * level-up doesn't refill spent slots outright (only a Long Rest does),
   * but it DOES grant the newly-unlocked capacity immediately, the same
   * "delta added, not reset" treatment `applyLeveledStats` gives HP.
   */
  private growSpellSlots(classDef: CharacterClassDefinition, oldLevel: number, newLevel: number): void {
    const oldMax = spellSlotsForClassAtLevel(classDef, oldLevel);
    const newMax = spellSlotsForClassAtLevel(classDef, newLevel);
    const grown: number[] = [];
    for (let i = 0; i < newMax.length; i++) {
      grown[i] = (this.spellSlotsRemaining[i] ?? 0) + (newMax[i] - (oldMax[i] ?? 0));
    }
    this.spellSlotsRemaining = grown;
  }

  /**
   * Phase 13.6 (D-091): shared by `levelUpClass` and `improveAbilityScore` —
   * both recompute the same ability-score-derived numbers, differing only in
   * whether `classLevel` also changed. `flatHpBonusesBefore` lets a Tough
   * hero's per-level HP bonus (and, since Phase 14/D-097, a Draconic
   * Bloodline Sorcerer's Draconic Resilience) contribute to `hpGain` exactly
   * like the class's own hit-die gain, so leveling heals for the FULL new
   * HP, not just the base class amount.
   */
  private applyLeveledStats(stats: LeveledCombatStats, flatHpBonusesBefore: number): void {
    const hpGain = stats.maxHealth - this.maxHealth + (this.flatHpBonusesTotal - flatHpBonusesBefore);
    this.maxHealth = stats.maxHealth;
    this.health += hpGain;
    this.attackDamage = stats.attackDamage;
    this.attackBonus = stats.attackBonus;
    this.extraAttacks = stats.attacksPerAction;
    this.classRiderDamage = stats.bonusRiderDamage;
  }

  /**
   * Phase 13.6 (D-091): an Ability Score Improvement, applied in place at the
   * hero's CURRENT class level (no level change) — raises one ability score
   * by `amount` (capped at `MAX_ABILITY_SCORE`) and recomputes every
   * ability-score-derived combat number the same way `levelUpClass` does. A
   * "+2 to one ability" choice calls this once with `amount = 2`; a "+1 to
   * two abilities" choice calls this twice with `amount = 1`. A no-op for a
   * hero with no `classId`/`abilityScores` (the classic fixed roster).
   */
  improveAbilityScore(ability: AbilityScoreId, amount: number): void {
    if (!this.classId || !this.abilityScores) return;
    const flatHpBonusesBefore = this.flatHpBonusesTotal;
    this.abilityScores = {
      ...this.abilityScores,
      [ability]: Math.min(MAX_ABILITY_SCORE, this.abilityScores[ability] + amount),
    };
    const stats = combatStatsForClassLevel(this.classId, this.classLevel, this.abilityScores, this.abilityId);
    this.applyLeveledStats(stats, flatHpBonusesBefore);
  }

  /** Feat ids chosen so far in place of an Ability Score Improvement (Phase 13.6, D-091). Always empty for the classic fixed roster. */
  get featIds(): readonly string[] {
    return this.feats;
  }

  /**
   * Phase 13.6 (D-091): grant a feat chosen in place of an Ability Score
   * Improvement. A no-op if this hero already has it (a feat is a one-time
   * pick here — this game's feat list has no "may be taken more than once"
   * entry, unlike the SRD's real ASI-style feats). Tough's HP bonus applies
   * immediately (current health rises by the same amount, matching how any
   * other max-HP increase is handled); Lucky's reroll pool fills to its full
   * value.
   */
  grantFeat(featId: string, options?: { chosenAbility?: AbilityScoreId; magicInitiateList?: MagicInitiateListId }): void {
    const feat = getFeat(featId);
    if (this.feats.includes(featId) && !feat.repeatable) return;
    const hpBefore = this.featHitPointBonus;
    this.feats = [...this.feats, featId];
    this.health += this.featHitPointBonus - hpBefore;
    if (featId === "lucky") this.luckyPointsRemaining = getFeat("lucky").luckyPoints ?? 0;
    if (featId === "boon-of-fate") this.boonOfFateChargeAvailable = true;
    if (feat.abilityScoreBoost && options?.chosenAbility) this.applyFeatAbilityBoost(feat, options.chosenAbility);
    if (featId === "magic-initiate" && options?.magicInitiateList) this.applyMagicInitiateGrant(options.magicInitiateList);
  }

  /**
   * Phase 18 (D-109): Grappler's/every Epic Boon's ability-score bump —
   * same recompute shape `improveAbilityScore` already uses, just
   * parameterized by the feat's own `hardCap` (30 for an Epic Boon, 20 for
   * Grappler) instead of the universal `MAX_ABILITY_SCORE`.
   */
  private applyFeatAbilityBoost(feat: FeatDefinition, chosenAbility: AbilityScoreId): void {
    if (!this.classId || !this.abilityScores || !feat.abilityScoreBoost) return;
    if (feat.id === "boon-of-irresistible-offense") this.irresistibleOffenseAbility = chosenAbility;
    const { amount, hardCap } = feat.abilityScoreBoost;
    const flatHpBonusesBefore = this.flatHpBonusesTotal;
    this.abilityScores = {
      ...this.abilityScores,
      [chosenAbility]: Math.min(hardCap, this.abilityScores[chosenAbility] + amount),
    };
    const stats = combatStatsForClassLevel(this.classId, this.classLevel, this.abilityScores, this.abilityId);
    this.applyLeveledStats(stats, flatHpBonusesBefore);
  }

  /** Phase 18 (D-109): grants Magic Initiate's 2 cantrips + (if the list has one) 1 first-level spell from `listId`, plus one free-cast use of the leveled spell. */
  private applyMagicInitiateGrant(listId: MagicInitiateListId): void {
    const cantripIds = MAGIC_INITIATE_CANTRIP_IDS[listId].slice(0, 2);
    const spellId = MAGIC_INITIATE_LEVELED_SPELL_IDS[listId].find((id) => getSpell(id).level === 1);
    this.magicInitiateGrants = [...this.magicInitiateGrants, { listId, cantripIds, spellId }];
    this.magicInitiateSpellUsesRemaining = [...this.magicInitiateSpellUsesRemaining, spellId ? 1 : 0];
  }

  /**
   * Phase 18 (D-109): the first general prerequisite check in this
   * codebase — every other class-gated feature (`canUseSecondWind`, etc.)
   * hardcodes its own condition. `BattleScene`'s feat picker filters on
   * this instead of the old bare "doesn't already have it" check. Always
   * false for the classic fixed roster (no `classId`/`abilityScores`) —
   * it never reaches the ASI-or-feat overlay this gates in the first place.
   */
  meetsFeatPrerequisites(featId: string): boolean {
    if (!this.classId || !this.abilityScores) return false;
    const feat = getFeat(featId);
    const alreadyHeld = this.feats.includes(featId);
    if (featId === "magic-initiate") {
      if (this.magicInitiateGrants.length >= Object.keys(MAGIC_INITIATE_CANTRIP_IDS).length) return false;
    } else if (alreadyHeld) {
      return false;
    }
    const prereq = feat.prerequisite;
    if (!prereq) return true;
    if (prereq.minLevel && this.classLevel < prereq.minLevel) return false;
    if (prereq.requiresFightingStyleFeature && !["fighter", "paladin", "ranger"].includes(this.classId)) return false;
    if (prereq.requiresSpellcastingFeature && !getClassDefinition(this.classId).spellcasting) return false;
    if (prereq.minAbilityScoreAnyOf) {
      const satisfied = prereq.minAbilityScoreAnyOf.some((req) => (this.abilityScores?.[req.ability] ?? 0) >= req.score);
      if (!satisfied) return false;
    }
    return true;
  }

  /** Grappler only: true if this hero hasn't already used its once-per-turn restrain this turn. */
  get canUseGrapplerRestrain(): boolean {
    return this.feats.includes("grappler") && !this.grapplerRestrainUsedThisTurn;
  }

  /** Spends this turn's one Grappler restrain use. */
  consumeGrapplerRestrain(): void {
    this.grapplerRestrainUsedThisTurn = true;
  }

  /** Boon of Combat Prowess only: true if this hero hasn't already turned a miss into a hit this turn. */
  get canUseCombatProwess(): boolean {
    return this.feats.includes("boon-of-combat-prowess") && !this.combatProwessUsedThisTurn;
  }

  /** Spends this turn's one Boon of Combat Prowess use. */
  consumeCombatProwess(): void {
    this.combatProwessUsedThisTurn = true;
  }

  /** Boon of Fate only: true if this hero has an unspent charge available right now. */
  get canUseBoonOfFate(): boolean {
    return this.feats.includes("boon-of-fate") && this.boonOfFateChargeAvailable;
  }

  /** Spends Boon of Fate's charge (auto-applied as a flat bonus on this hero's next basic attack — see `BattleScene`). */
  useBoonOfFate(): void {
    this.boonOfFateChargeAvailable = false;
  }

  /** Boon of Fate's flat attack-roll/damage bonus, for `BattleScene` to apply when `useBoonOfFate` is spent. */
  get boonOfFateBonus(): number {
    return BOON_OF_FATE_ATTACK_BONUS;
  }

  /** Boon of Irresistible Offense only: the bonus damage a natural-20 attack deals (equal to the ability score this boon raised). 0 without the feat. */
  get irresistibleOffenseBonusDamage(): number {
    if (!this.feats.includes("boon-of-irresistible-offense") || !this.irresistibleOffenseAbility || !this.abilityScores) return 0;
    return this.abilityScores[this.irresistibleOffenseAbility];
  }

  /** Lucky only: rerolls remaining. 0 without the feat, or once exhausted until a Long Rest. */
  get luckyPointsAvailable(): number {
    return this.luckyPointsRemaining;
  }

  /** True if this hero has an unspent Lucky point available right now. */
  canUseLucky(): boolean {
    return this.luckyPointsRemaining > 0;
  }

  /** Spend one Lucky point (auto-applied as Advantage on this hero's next roll — see BattleScene). */
  spendLuckyPoint(): void {
    if (this.luckyPointsRemaining > 0) this.luckyPointsRemaining -= 1;
  }

  /**
   * Phase 13.7 (D-092): every spell this hero can pick from a spellbook —
   * every cantrip its class knows plus every leveled spell this game can
   * cast today, NOT just the one signature action chosen at creation.
   * Empty for a non-caster or the classic fixed roster.
   */
  knownSpellAbilityIds(): string[] {
    if (!this.classId) return [];
    return [...knownSpellIdsForClass(this.classId), ...this.magicInitiateSpellIds];
  }

  /** Phase 18 (D-109): every cantrip/spell id every Magic Initiate pick has granted, flattened across every list this hero has chosen. */
  private get magicInitiateSpellIds(): string[] {
    return this.magicInitiateGrants.flatMap((g) => (g.spellId ? [...g.cantripIds, g.spellId] : g.cantripIds));
  }

  /** Phase 18 (D-109): the Magic Initiate lists this hero has already picked (repeatable once per list) — read by `BattleScene`'s feat-picker to exclude them. */
  get magicInitiateListsTaken(): readonly MagicInitiateListId[] {
    return this.magicInitiateGrants.map((g) => g.listId);
  }

  /** Remaining spell slots of this level. 0 for a non-caster, or once exhausted until a Long Rest. */
  spellSlotsRemainingAt(level: number): number {
    return this.spellSlotsRemaining[level - 1] ?? 0;
  }

  /** True if this ability is castable right now — always true for a cantrip/mundane ability, slot-gated for a leveled spell (unless a Magic Initiate free use covers it). */
  canCastSpell(abilityId: string): boolean {
    const ability = getAbility(abilityId);
    if (!ability.spellSlotLevel) return true;
    if (this.hasMagicInitiateFreeUse(abilityId)) return true;
    return this.spellSlotsRemainingAt(ability.spellSlotLevel) > 0;
  }

  /** Phase 18 (D-109): true if `abilityId` is a Magic Initiate-granted leveled spell with an unspent free cast remaining. */
  private hasMagicInitiateFreeUse(abilityId: string): boolean {
    const idx = this.magicInitiateGrants.findIndex((g) => g.spellId === abilityId);
    return idx >= 0 && (this.magicInitiateSpellUsesRemaining[idx] ?? 0) > 0;
  }

  /** Phase 18 (D-109): true if this hero holds Boon of Spell Recall (its 1d4-vs-slot-level roll is made by the caller — see `spendSpellSlotWithRecallRoll`). */
  get hasBoonOfSpellRecall(): boolean {
    return this.feats.includes("boon-of-spell-recall");
  }

  /**
   * Phase 18 (D-109): spend a spell slot for `abilityId` cast at this level —
   * a Magic Initiate free use is spent first if this exact spell has one
   * remaining; otherwise a normal spell slot, protected by Boon of Spell
   * Recall's roll if this hero holds it. `recallRoll` is a 1d4 already
   * rolled by the caller's `RandomService` (see `RandomService.rollD4`) —
   * this game's "controlled randomness" convention keeps dice rolls on the
   * caller side, not inside a pure entity — ignored if this hero doesn't
   * have the boon.
   */
  spendSpellSlotFor(abilityId: string, level: number, recallRoll: number): void {
    if (this.hasMagicInitiateFreeUse(abilityId)) {
      const idx = this.magicInitiateGrants.findIndex((g) => g.spellId === abilityId);
      this.magicInitiateSpellUsesRemaining[idx] -= 1;
      return;
    }
    this.spendSpellSlotWithRecallRoll(level, recallRoll);
  }

  /** Spend one spell slot of this level. A no-op if none remain (defensive — callers should check `canCastSpell` first). */
  spendSpellSlot(level: number): void {
    const idx = level - 1;
    if ((this.spellSlotsRemaining[idx] ?? 0) > 0) this.spellSlotsRemaining[idx] -= 1;
  }

  /**
   * Phase 18 (D-109): Boon of Spell Recall — `recallRoll` is a 1d4 already
   * rolled by the caller's `RandomService` (see `RandomService.rollD4`); a
   * match against `level` (1-4) spares the slot instead of spending it.
   */
  spendSpellSlotWithRecallRoll(level: number, recallRoll: number): void {
    if (this.hasBoonOfSpellRecall && level >= 1 && level <= 4 && recallRoll === level) return;
    this.spendSpellSlot(level);
  }

  get hasMoved(): boolean {
    return this.moved;
  }

  get hasActed(): boolean {
    return this.acted;
  }

  /** True while the hero still has hit points. */
  isAlive(): boolean {
    return this.health > 0;
  }

  /**
   * A hero may move only if it is alive, hasn't already moved this turn, and
   * isn't held by a "stunned"/"restrained"-family status (Phase 21, D-112).
   */
  canMove(): boolean {
    return this.isAlive() && !this.moved && !this.isIncapacitatedByStatus;
  }

  /**
   * A hero may act only if it is alive, hasn't already acted this turn, and
   * isn't held by a "stunned"/"restrained"-family status (Phase 21, D-112).
   */
  canAct(): boolean {
    return this.isAlive() && !this.acted && !this.isIncapacitatedByStatus;
  }

  get hasBonusActed(): boolean {
    return this.bonusActed;
  }

  /** A hero may use its bonus action only if it is alive and hasn't spent it this turn. */
  canUseBonusAction(): boolean {
    return this.isAlive() && !this.bonusActed;
  }

  /** Fighter only: a bonus-action self-heal, once per battle (see class doc comment). */
  canUseSecondWind(): boolean {
    return this.classId === "fighter" && this.canUseBonusAction() && !this.secondWindUsed;
  }

  /** Spends the bonus action and this battle's Second Wind use; heals up to `effectiveMaxHealth`. */
  useSecondWind(): void {
    this.health = Math.min(this.effectiveMaxHealth, this.health + SECOND_WIND_HEAL);
    this.secondWindUsed = true;
    this.bonusActed = true;
  }

  /**
   * Fighter only: grants a second action this turn, once per battle. Gated on
   * having already acted — using it before acting would just be a wasted
   * once-per-battle resource, since `canAct()` would already be true.
   */
  canUseActionSurge(): boolean {
    return this.classId === "fighter" && this.isAlive() && this.acted && !this.actionSurgeUsed;
  }

  /** Un-consumes this turn's action slot; spends this battle's Action Surge use. */
  useActionSurge(): void {
    this.actionSurgeUsed = true;
    this.acted = false;
  }

  /**
   * Rogue only: Cunning Action's Dash — a bonus-action second move. No rest
   * limit in the SRD (unlike Second Wind/Action Surge above), so this is
   * gated only by the bonus-action slot. Gated on having already moved, for
   * the same "don't offer a wasted click" reasoning as Action Surge.
   */
  canUseCunningAction(): boolean {
    return this.classId === "rogue" && this.canUseBonusAction() && this.moved;
  }

  /** Un-consumes this turn's move slot; spends the bonus action. */
  useCunningActionDash(): void {
    this.bonusActed = true;
    this.moved = false;
  }

  /**
   * Rogue only: Uncanny Dodge, a reaction that halves one incoming hit's
   * damage. No rest limit — recharges every turn (see `resetForNewTurn`).
   * Kevin chose auto-apply (no interrupt-prompt UI exists) — see
   * BattleScene's `runEnemyPhase` for where this actually fires.
   */
  canUseUncannyDodge(): boolean {
    return this.classId === "rogue" && this.isAlive() && this.reactionAvailable;
  }

  /** Spends this turn's reaction. */
  useUncannyDodge(): void {
    this.reactionAvailable = false;
  }

  // ----- Phase 13.8 (D-093): the eight new classes' signature mechanics ---

  /**
   * True while a damage-halving buff is active — Barbarian's Rage, Druid's
   * Wild Shape, OR (Phase 22, magic-item expansion) a permanent-for-the-
   * rest-of-the-battle grant from Potion of Resistance. Read by
   * `BattleScene`'s enemy-phase damage post-process. `isRaging`/
   * `canUseRage`/`canUseWildShape` deliberately check
   * `damageResistanceTurnsRemaining` directly instead of this getter, so a
   * Resistance-potion grant never blocks or falsely implies an active Rage.
   */
  get hasDamageResistance(): boolean {
    return this.damageResistanceTurnsRemaining > 0 || this.permanentDamageResistance;
  }

  /** Barbarian only: true while an active Rage is halving incoming damage and boosting attack damage (see `effectiveAttackDamage`). */
  get isRaging(): boolean {
    return this.classId === "barbarian" && this.damageResistanceTurnsRemaining > 0;
  }

  /** Barbarian only: a bonus action, a limited number of times per Long Rest, not while already raging. */
  canUseRage(): boolean {
    return this.classId === "barbarian" && this.canUseBonusAction() && this.rageUsesRemaining > 0 && this.damageResistanceTurnsRemaining <= 0;
  }

  /** Spends the bonus action and a Rage use; incoming damage is halved and attacks deal bonus damage for `RAGE_DURATION_TURNS`. */
  useRage(): void {
    this.rageUsesRemaining -= 1;
    this.bonusActed = true;
    this.damageResistanceTurnsRemaining = RAGE_DURATION_TURNS;
  }

  /**
   * Druid only, from level 2: a bonus action, a limited number of times per
   * Long Rest, not while already shaped. Simplified (D-093): grants the same
   * damage-halving buff as Rage, plus an immediate flat heal — not a real
   * creature-stat-block transformation (this game has no such system).
   */
  canUseWildShape(): boolean {
    return (
      this.classId === "druid" &&
      this.level >= 2 &&
      this.canUseBonusAction() &&
      this.wildShapeUsesRemaining > 0 &&
      this.damageResistanceTurnsRemaining <= 0
    );
  }

  /** Spends the bonus action and a Wild Shape use; heals a flat amount (more for Circle of the Ashen Veil, D-099) and halves incoming damage for `WILD_SHAPE_DURATION_TURNS`. */
  useWildShape(): void {
    this.wildShapeUsesRemaining -= 1;
    this.bonusActed = true;
    this.damageResistanceTurnsRemaining = WILD_SHAPE_DURATION_TURNS;
    this.health = Math.min(this.effectiveMaxHealth, this.health + WILD_SHAPE_HEAL + this.subclassWildShapeHealBonus);
  }

  /**
   * Monk only, from level 2: Ki spent on Flurry of Blows — a bonus action,
   * after the Attack action, for another attack. Un-consumes the action
   * slot exactly like Action Surge, but spends the bonus action and a Ki
   * point too (D-093's deliberate simplification — the SRD's other Ki uses,
   * and a separate free level-1 unarmed strike, are folded into this one
   * mechanic; see data/classes.ts's Martial Arts note).
   */
  canUseFlurryOfBlows(): boolean {
    return this.classId === "monk" && this.level >= 2 && this.canUseBonusAction() && this.acted && this.kiPointsRemaining > 0;
  }

  /** Spends a Ki point and the bonus action; un-consumes the action slot for another attack. */
  useFlurryOfBlows(): void {
    this.kiPointsRemaining -= 1;
    this.bonusActed = true;
    this.acted = false;
  }

  /** Bard only: a bonus action, a limited number of times per rest, granting an ally (or itself) a flat attack/damage bonus — see `receiveInspiration`. */
  canUseBardicInspiration(): boolean {
    return this.classId === "bard" && this.canUseBonusAction() && this.bardicInspirationUsesRemaining > 0;
  }

  /** Spends the bonus action and a Bardic Inspiration use. The caller (BattleScene) picks the target and calls `receiveInspiration` on it. */
  useBardicInspiration(): void {
    this.bardicInspirationUsesRemaining -= 1;
    this.bonusActed = true;
  }

  /** Grants THIS hero a flat bonus applied to its own next attack roll and damage (Bardic Inspiration's target — may be the Bard itself). */
  receiveInspiration(amount: number): void {
    this.inspirationBonus = amount;
  }

  /** A pending Bardic Inspiration bonus on this hero's next attack, if any. 0 otherwise. */
  get pendingInspirationBonus(): number {
    return this.inspirationBonus;
  }

  /** Consumes this hero's pending inspiration bonus (spent on the attack it just boosted). */
  clearInspiration(): void {
    this.inspirationBonus = 0;
  }

  /**
   * Sorcerer only, from level 3: Metamagic: Quickened Spell — a bonus
   * action and Sorcery Points spent BEFORE casting, so the upcoming spell
   * consumes the (already-spent) bonus action instead of the main action.
   * Gated on not having acted yet this turn (the point is to keep the
   * action free for something else, e.g. a basic attack, afterward).
   */
  canUseQuickenSpell(): boolean {
    return this.classId === "sorcerer" && this.level >= 3 && this.canUseBonusAction() && !this.acted && this.sorceryPointsRemaining > 0;
  }

  /** Spends a Sorcery Point and the bonus action; the next spell cast consumes this instead of the action slot (see `markActedForSpellCast`). */
  useQuickenSpell(): void {
    this.sorceryPointsRemaining -= 1;
    this.bonusActed = true;
    this.quickenedSpellReadyFlag = true;
  }

  /**
   * Marks the action spent for a spell cast, UNLESS a Quickened Spell is in
   * effect (Sorcerer's Metamagic) — in which case the action stays free and
   * the quicken flag clears instead. Safe to call for every hero (a no-op
   * fallback to the ordinary `markActed` behavior for anyone who never set
   * the flag), so `BattleScene`'s spell-cast resolvers can call this
   * unconditionally instead of branching on class.
   */
  markActedForSpellCast(): void {
    if (this.quickenedSpellReadyFlag) {
      this.quickenedSpellReadyFlag = false;
      return;
    }
    this.acted = true;
  }

  /**
   * Ranger only, from level 2: Hunter's Mark — a bonus action, spending a
   * 1st-level spell slot, marking an enemy for bonus damage (see
   * `markedEnemyId`, read by `BattleScene.applyHuntersMarkBonus`).
   */
  canUseHuntersMark(): boolean {
    return this.classId === "ranger" && this.level >= 2 && this.canUseBonusAction() && this.spellSlotsRemainingAt(1) > 0;
  }

  /** Spends a 1st-level spell slot and the bonus action; marks `targetId` for Hunter's Mark's bonus damage. */
  useHuntersMark(targetId: string): void {
    this.spendSpellSlot(1);
    this.bonusActed = true;
    this.markedTargetId = targetId;
  }

  /** The enemy id currently marked by Hunter's Mark, if any. Null for a non-Ranger or before any mark is cast. */
  get markedEnemyId(): string | null {
    return this.markedTargetId;
  }

  /**
   * Phase 13.4 (D-088): a Short Rest — recharges Second Wind/Action Surge (if
   * this hero has them) and heals a flat fraction of max HP (a stand-in for
   * spending a Hit Die, which this game doesn't track; see
   * `SHORT_REST_HEAL_FRACTION`). Called by `RestSystem.takeShortRest` for
   * every LIVING hero — the caller is responsible for filtering out the
   * fallen, same convention `ProgressionSystem.applyChoice` already uses.
   */
  shortRest(): void {
    this.secondWindUsed = false;
    this.actionSurgeUsed = false;
    // Phase 13.8 (D-093): any active Rage/Wild Shape ends the instant its
    // hero rests. Ki recharges on a Short Rest too (the SRD's real cadence,
    // unlike Rage/Wild Shape/Bardic Inspiration/Sorcery Points below, which
    // stay Long-Rest-only). Font of Inspiration (Bard level 5) upgrades
    // Bardic Inspiration to the same Short-Rest cadence.
    this.damageResistanceTurnsRemaining = 0;
    if (this.classId === "monk") this.kiPointsRemaining = KI_POINTS_PER_REST;
    if (this.classId === "bard" && this.classLevel >= 5) this.bardicInspirationUsesRemaining = BARDIC_INSPIRATION_USES_PER_REST;
    // Pact Magic's real, distinctive cadence (D-093): a Warlock's spell
    // slots restore on a SHORT Rest, unlike every other caster class here.
    if (this.classId === "warlock" && this.abilityScores) {
      const classDef = getClassDefinition("warlock");
      if (classDef.spellcasting) this.spellSlotsRemaining = spellSlotsForClassAtLevel(classDef, this.classLevel);
    }
    const heal = Math.max(1, Math.round(this.effectiveMaxHealth * SHORT_REST_HEAL_FRACTION));
    this.health = Math.min(this.effectiveMaxHealth, this.health + heal);
  }

  /**
   * Phase 13.4 (D-088): a Long Rest — full HP restore, plus everything a
   * Short Rest recharges. Called by `RestSystem.takeLongRest` for every
   * LIVING hero. Phase 13.7 (D-092): also fully restores a caster's spell
   * slots — the SRD's real cadence (a Short Rest does NOT refill them).
   */
  longRest(): void {
    this.secondWindUsed = false;
    this.actionSurgeUsed = false;
    this.health = this.effectiveMaxHealth;
    this.damageResistanceTurnsRemaining = 0;
    // Phase 13.8 (D-093): every new class's resource pool refills on a Long
    // Rest — Ki/Bardic Inspiration ALSO refill on a Short Rest (see
    // `shortRest`); Rage/Wild Shape/Sorcery Points stay Long-Rest-only.
    if (this.classId === "barbarian") this.rageUsesRemaining = RAGE_USES_PER_REST;
    if (this.classId === "monk") this.kiPointsRemaining = KI_POINTS_PER_REST;
    if (this.classId === "bard") this.bardicInspirationUsesRemaining = BARDIC_INSPIRATION_USES_PER_REST;
    if (this.classId === "druid") this.wildShapeUsesRemaining = WILD_SHAPE_USES_PER_REST;
    if (this.classId === "sorcerer") this.sorceryPointsRemaining = SORCERY_POINTS_PER_REST + this.subclassSorceryPointBonus;
    if (this.feats.includes("lucky")) this.luckyPointsRemaining = getFeat("lucky").luckyPoints ?? 0;
    // Phase 18 (D-109): Magic Initiate's free-cast use(s) and Boon of Fate's charge both recharge on a Long Rest only.
    this.magicInitiateSpellUsesRemaining = this.magicInitiateGrants.map((g) => (g.spellId ? 1 : 0));
    if (this.feats.includes("boon-of-fate")) this.boonOfFateChargeAvailable = true;
    if (this.classId && this.abilityScores) {
      const classDef = getClassDefinition(this.classId);
      if (classDef.spellcasting) this.spellSlotsRemaining = spellSlotsForClassAtLevel(classDef, this.classLevel);
    }
  }

  /**
   * Tiles this hero may still travel this turn: its full movement allowance
   * before it has moved, and 0 afterwards (MVP: one move per turn).
   */
  movementBudget(): number {
    return this.canMove() ? this.effectiveMovementTiles : 0;
  }

  /**
   * Commit a move to a new tile. This is the ONLY thing that changes a hero's
   * position, which is what makes "cancel restores prior state" simple: cancel
   * just never calls this, so the hero stays exactly where it was.
   */
  moveTo(dest: GridPosition): void {
    this.position = { ...dest };
    this.moved = true;
  }

  /** Consume this turn's action slot (a basic attack or an ability). */
  markActed(): void {
    this.acted = true;
  }

  /**
   * Clear per-turn flags so the hero can move and act again next turn.
   * `secondWindUsed`/`actionSurgeUsed` deliberately do NOT reset here — they
   * only clear via `shortRest`/`longRest` (Phase 13.4, D-088), matching the
   * SRD's real once-per-rest cadence, not once-per-turn.
   */
  resetForNewTurn(): void {
    this.moved = false;
    this.acted = false;
    this.bonusActed = false;
    this.reactionAvailable = true;
    // Phase 17 (D-108): Cleave's once-per-turn weapon mastery use.
    this.cleaveUsedThisTurn = false;
    // Phase 18 (D-109): Grappler's/Boon of Combat Prowess's once-per-turn uses.
    this.grapplerRestrainUsedThisTurn = false;
    this.combatProwessUsedThisTurn = false;
    // Phase 19 (D-110): the off-hand attack's once-per-turn use.
    this.offHandAttackUsedThisTurn = false;
    // Phase 13.8 (D-093): Rage/Wild Shape's duration ticks down once per
    // turn (this game's "turn" = one player phase, per resetForNewTurn's
    // call site) until it runs out on its own.
    if (this.damageResistanceTurnsRemaining > 0) this.damageResistanceTurnsRemaining -= 1;
    // Defensive: an unused Quickened Spell shouldn't silently carry into a
    // future turn.
    this.quickenedSpellReadyFlag = false;
    // Phase 16 (D-106): ally buffs tick down once per hero turn, same cadence
    // as the Rage/Wild Shape resistance timer just above.
    this.tickBuffs();
    // Phase 21 (D-112): enemy-inflicted debuffs tick down the same way.
    this.tickStatuses();
  }

  // ----- Phase 12.1 (D-101): full state snapshot/restore ------------------

  /** A plain-data copy of this hero's entire current state. See `HeroSnapshot`. */
  toSnapshot(): HeroSnapshot {
    return {
      id: this.id,
      name: this.name,
      movementTiles: this.movementTiles,
      // Phase 17 (D-108): the BASE (fallback) range, not the weapon-aware
      // effective getter — restoring re-derives the effective value live
      // from `equippedItems`, same as `armorClass`/`effectiveAttackDamage`.
      attackRangeTiles: this.baseAttackRangeTiles,
      baseArmorClass: this.baseArmorClass,
      abilityId: this.abilityId,
      controlledBy: this.controlledBy,
      classId: this.classId,
      abilityScores: this.abilityScores ? { ...this.abilityScores } : undefined,
      maxHealth: this.maxHealth,
      attackDamage: this.attackDamage,
      attackBonus: this.attackBonus,
      position: { ...this.position },
      health: this.health,
      equippedItems: { ...this.equippedItems },
      equippedPotions: { ...this.equippedPotions },
      moved: this.moved,
      acted: this.acted,
      bonusMaxHealth: this.bonusMaxHealth,
      bonusAttackDamage: this.bonusAttackDamage,
      bonusMovementTiles: this.bonusMovementTiles,
      permanentDamageResistance: this.permanentDamageResistance,
      bonusActed: this.bonusActed,
      secondWindUsed: this.secondWindUsed,
      actionSurgeUsed: this.actionSurgeUsed,
      reactionAvailable: this.reactionAvailable,
      shadowbladeFirstStrikeUsed: this.shadowbladeFirstStrikeUsed,
      classLevel: this.classLevel,
      extraAttacks: this.extraAttacks,
      feats: [...this.feats],
      luckyPointsRemaining: this.luckyPointsRemaining,
      spellSlotsRemaining: [...this.spellSlotsRemaining],
      rageUsesRemaining: this.rageUsesRemaining,
      damageResistanceTurnsRemaining: this.damageResistanceTurnsRemaining,
      kiPointsRemaining: this.kiPointsRemaining,
      wildShapeUsesRemaining: this.wildShapeUsesRemaining,
      bardicInspirationUsesRemaining: this.bardicInspirationUsesRemaining,
      inspirationBonus: this.inspirationBonus,
      sorceryPointsRemaining: this.sorceryPointsRemaining,
      quickenedSpellReadyFlag: this.quickenedSpellReadyFlag,
      markedTargetId: this.markedTargetId,
      assignedSubclassId: this.assignedSubclassId,
      activeBuffs: this.activeBuffs.map((b) => ({ ...b })),
      classRiderDamage: this.classRiderDamage,
      vexTargetId: this.vexTargetId,
      grapplerRestrainUsedThisTurn: this.grapplerRestrainUsedThisTurn,
      combatProwessUsedThisTurn: this.combatProwessUsedThisTurn,
      boonOfFateChargeAvailable: this.boonOfFateChargeAvailable,
      irresistibleOffenseAbility: this.irresistibleOffenseAbility,
      magicInitiateGrants: this.magicInitiateGrants.map((g) => ({ ...g })),
      magicInitiateSpellUsesRemaining: [...this.magicInitiateSpellUsesRemaining],
      offHandAttackUsedThisTurn: this.offHandAttackUsedThisTurn,
      activeStatuses: this.activeStatuses.map((s) => ({ ...s })),
    };
  }

  /**
   * Reconstruct a `Hero` exactly as `toSnapshot` captured it. Builds a
   * minimal `HeroDefinition` from the snapshot's identity fields (so the
   * constructor's readonly fields land correctly), then overwrites every
   * mutable field directly — deliberately NOT re-deriving anything the
   * constructor would normally compute from `startingEquipmentId`/`classId`
   * (spell slots, per-rest resource pools, starting gear), since the
   * snapshot already holds their exact current values.
   */
  static fromSnapshot(snapshot: HeroSnapshot): Hero {
    const def: HeroDefinition = {
      id: snapshot.id,
      name: snapshot.name,
      movementTiles: snapshot.movementTiles,
      maxHealth: snapshot.maxHealth,
      attackDamage: snapshot.attackDamage,
      attackRangeTiles: snapshot.attackRangeTiles,
      attackBonus: snapshot.attackBonus,
      baseArmorClass: snapshot.baseArmorClass,
      abilityId: snapshot.abilityId,
      controlledBy: snapshot.controlledBy,
      classId: snapshot.classId,
      abilityScores: snapshot.abilityScores,
      classRiderDamage: snapshot.classRiderDamage,
    };
    const hero = new Hero(def, snapshot.position);
    hero.restoreMutableState(snapshot);
    return hero;
  }

  private restoreMutableState(snapshot: HeroSnapshot): void {
    this.maxHealth = snapshot.maxHealth;
    this.attackDamage = snapshot.attackDamage;
    this.attackBonus = snapshot.attackBonus;
    this.position = { ...snapshot.position };
    this.health = snapshot.health;
    this.equippedItems = { ...snapshot.equippedItems };
    this.equippedPotions = { ...snapshot.equippedPotions };
    this.moved = snapshot.moved;
    this.acted = snapshot.acted;
    this.bonusMaxHealth = snapshot.bonusMaxHealth;
    this.bonusAttackDamage = snapshot.bonusAttackDamage;
    this.bonusMovementTiles = snapshot.bonusMovementTiles;
    this.permanentDamageResistance = snapshot.permanentDamageResistance;
    this.bonusActed = snapshot.bonusActed;
    this.secondWindUsed = snapshot.secondWindUsed;
    this.actionSurgeUsed = snapshot.actionSurgeUsed;
    this.reactionAvailable = snapshot.reactionAvailable;
    this.shadowbladeFirstStrikeUsed = snapshot.shadowbladeFirstStrikeUsed;
    this.classLevel = snapshot.classLevel;
    this.extraAttacks = snapshot.extraAttacks;
    this.feats = [...snapshot.feats];
    this.luckyPointsRemaining = snapshot.luckyPointsRemaining;
    this.spellSlotsRemaining = [...snapshot.spellSlotsRemaining];
    this.rageUsesRemaining = snapshot.rageUsesRemaining;
    this.damageResistanceTurnsRemaining = snapshot.damageResistanceTurnsRemaining;
    this.kiPointsRemaining = snapshot.kiPointsRemaining;
    this.wildShapeUsesRemaining = snapshot.wildShapeUsesRemaining;
    this.bardicInspirationUsesRemaining = snapshot.bardicInspirationUsesRemaining;
    this.inspirationBonus = snapshot.inspirationBonus;
    this.sorceryPointsRemaining = snapshot.sorceryPointsRemaining;
    this.quickenedSpellReadyFlag = snapshot.quickenedSpellReadyFlag;
    this.markedTargetId = snapshot.markedTargetId;
    this.assignedSubclassId = snapshot.assignedSubclassId;
    this.activeBuffs = snapshot.activeBuffs.map((b) => ({ ...b }));
    this.classRiderDamage = snapshot.classRiderDamage;
    this.vexTargetId = snapshot.vexTargetId;
    this.grapplerRestrainUsedThisTurn = snapshot.grapplerRestrainUsedThisTurn;
    this.combatProwessUsedThisTurn = snapshot.combatProwessUsedThisTurn;
    this.boonOfFateChargeAvailable = snapshot.boonOfFateChargeAvailable;
    this.irresistibleOffenseAbility = snapshot.irresistibleOffenseAbility;
    this.magicInitiateGrants = snapshot.magicInitiateGrants.map((g) => ({ ...g }));
    this.magicInitiateSpellUsesRemaining = [...snapshot.magicInitiateSpellUsesRemaining];
    this.offHandAttackUsedThisTurn = snapshot.offHandAttackUsedThisTurn;
    this.activeStatuses = snapshot.activeStatuses.map((s) => ({ ...s }));
  }
}
