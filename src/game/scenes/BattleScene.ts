import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  GRID_TOP_MARGIN,
  STRONGHOLD_START,
  STARTING_GOLD,
  COLORS,
  SETTINGS_STORAGE_KEY,
  TUTORIAL_STORAGE_KEY,
  BESTIARY_STORAGE_KEY,
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  WORLD_FLAG_STORAGE_KEY,
  COMPANION_ROSTER_STORAGE_KEY,
  SAVE_STORAGE_KEY,
} from "../config";
import { SPRITE_MANIFEST } from "../data/spriteManifest";
import { GridSystem, computeFittedTileSize, type GridPosition } from "../systems/GridSystem";
import { GameMap } from "../systems/GameMap";
import { MovementSystem } from "../systems/MovementSystem";
import { PathfindingSystem } from "../systems/PathfindingSystem";
import {
  WaveSystem,
  type EnemyPhaseReport,
  type EnemyAttackEvent,
  type TrapTrigger,
  type StatusTickEvent,
  type StructureAttackEvent,
  type TrapDisarmEvent,
} from "../systems/WaveSystem";
import {
  CombatSystem,
  type AttackProfile,
  type AttackResult,
} from "../systems/CombatSystem";
import { RandomService } from "../systems/RandomService";
import { SavingThrowSystem } from "../systems/SavingThrowSystem";
import { SkillCheckSystem } from "../systems/SkillCheckSystem";
import { TurnSystem, PHASE_LABELS, type GamePhase } from "../systems/TurnSystem";
import { EconomySystem } from "../systems/EconomySystem";
import { BuildSystem, type PlacedStructure } from "../systems/BuildSystem";
import { SummonSystem } from "../systems/SummonSystem";
import { RewardSystem } from "../systems/RewardSystem";
import { rollLootDrop, isPotionId, type LootDropResult } from "../systems/LootSystem";
import { drawRegionBonusChoices } from "../systems/RegionBonusSystem";
import { REGION_BONUS_POOLS, type RegionBonusOption } from "../data/regionBonuses";
import { averagePartyLevel, isRarityUnlockedAtLevel } from "../systems/ShopSystem";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { RestSystem } from "../systems/RestSystem";
import { firstAvailableHeroAction, listHeroActions, hotkeyDisplayLabel } from "../systems/HeroActionRegistry";
import { createTooltipController, attachHoverTooltip, type TooltipController } from "./tooltip";
import { centeredRowX } from "./uiTheme";
import { showDialogue, type DialogueBoxController, type DialogueLine } from "./dialogueBox";
import { asiFeatureGrantedAtLevel, subclassGrantedAtLevel } from "../systems/CharacterSystem";
import { subclassesForClass, getSubclassDefinition } from "../data/subclasses";
import { getClassDefinition } from "../data/classes";
import { ABILITY_SCORE_IDS, ABILITY_SCORE_NAMES, type AbilityScoreId } from "../data/abilityScores";
import { FEAT_IDS, getFeat } from "../data/feats";
import {
  Hero,
  BARDIC_INSPIRATION_BONUS,
  MAX_ATTUNEMENTS,
  ACTION_HOTKEY_SLOT_COUNT,
  type MagicInitiateListId,
} from "../entities/Hero";
import {
  fastForwardHero,
  resolveAsiForLevel,
  resolveSubclassForClass,
  resolveSpellPickForRequest,
  spellPickTriggerLevel,
  levelUpDeltaSummary,
  type LevelUpPlan,
  type LevelUpStatSnapshot,
  type LevelUpChoiceStep,
} from "../systems/LevelUpPlanSystem";
import {
  spellSwapStepsForClass,
  preparedSwapIsFullRelist,
  maxCastableSpellLevel,
  eligibleCantripPool,
  eligibleLeveledSpellPool,
  preparedSpellCountForClassAtLevel,
  type SpellSwapTrigger,
  type SpellSwapStepKind,
} from "../systems/SpellPreparationSystem";
import { cantripsKnownForClassAtLevel } from "../systems/SpellcastingSystem";
import { getSpell } from "../data/spells";
import { Enemy } from "../entities/Enemy";
import type { Summon } from "../entities/Summon";
import { TEST_MAP, type ParsedMap, type TileType } from "../data/testMap";
import { DynamicTerrainSystem } from "../systems/DynamicTerrainSystem";
import { WAVES, type WaveDefinition } from "../data/waves";
import {
  getCampaignDefinition,
  getCampaignMap,
  getChapter,
  isChapteredCampaign,
  totalChapters,
  NAMELESS_THRONE_CAMPAIGN_ID,
  type ChapterDefinition,
  type CampaignDefinition,
} from "../data/campaigns";
import { COMPANIONS, getCompanionDefinition, type CompanionDefinition } from "../data/companions";
import { COMPANION_RECRUITMENT_DIALOGUE, COMPANION_MIRROR_REACTION_DIALOGUE } from "../data/companionDialogue";
import {
  loadCompanionRoster,
  saveCompanionRoster,
  recruitCompanion,
  isCompanionRecruited,
  isCompanionLost,
  loseCompanion,
  DEFAULT_COMPANION_ROSTER_STATE,
  type CompanionRosterState,
} from "../systems/CompanionRosterSystem";
import {
  recordSorrelChoice,
  resolveSorrelFate,
  SORREL_FATE_FLAG_ID,
  SORREL_CHOICE_PROMPTS,
  SORREL_FATE_FLAVOR_TEXT,
  SORREL_REDEEMED_REWARD_EQUIPMENT_ID,
  SORREL_MARKED_GOLD_REWARD,
  type SorrelChoice,
} from "../systems/SorrelFateSystem";
import { getMapById } from "../data/maps";
import { ENEMY_COLORS, ENEMY_DEFINITIONS, getEnemyDefinition, type EnemyRole } from "../data/enemies";
import type { HeroDefinition } from "../data/heroes";
import { HeroAISystem } from "../systems/HeroAISystem";
import { canActOnHero } from "../systems/CoopSessionSystem";
import {
  getDifficultyDefinition,
  partySizeScalingFactor,
  type DifficultyId,
} from "../data/difficulty";
import { getAbility, type AbilityDefinition } from "../data/abilities";
import {
  getCastVisual,
  deathCauseForAbility,
  getDeathVisual,
  type CastVisualDescriptor,
  type DeathCause,
  type DeathShape,
} from "../systems/VisualFxSystem";
import {
  getStructureDefinition,
  SHOP_ORDER,
  STRUCTURE_COLORS,
} from "../data/structures";
import {
  EQUIPMENT_ORDER,
  getEquipmentDefinition,
  GEAR_SLOT_IDS,
  GEAR_SLOT_LABELS,
  GEAR_SLOT_TYPE_LABELS,
  RARITY_LABELS,
  gearSlotType,
  type GearSlotId,
  type EquipmentDefinition,
} from "../data/equipment";
import {
  POTION_ORDER,
  POTION_DEFINITIONS,
  getPotionDefinition,
  GENERAL_SLOT_IDS,
  GENERAL_SLOT_LABELS,
  type GeneralSlotId,
} from "../data/potions";
import { WEAPON_MASTERIES } from "../data/weapons";
import {
  getStatusEffectDefinition,
  STATUS_EFFECT_ORDER,
  type StatusEffectId,
} from "../data/statusEffects";
import { getBuffEffectDefinition } from "../data/buffEffects";
import {
  durationScaleFor,
  loadSettings,
  saveSettings,
  nextAnimationSpeed,
  ANIMATION_SPEED_LABELS,
  hasSeenTutorial,
  markTutorialSeen,
  type AnimationSpeed,
} from "../systems/SettingsSystem";
import {
  loadBestiaryProgress,
  saveBestiaryProgress,
  markSeen as markEnemyIdSeen,
  markKilled as markEnemyIdKilled,
  DEFAULT_BESTIARY_PROGRESS,
  type BestiaryProgress,
} from "../systems/BestiarySystem";
import {
  loadCampaignProgress,
  saveCampaignProgress,
  markCampaignCompleted,
  markChapterCompleted,
  DEFAULT_CAMPAIGN_PROGRESS,
  type CampaignProgress,
} from "../systems/CampaignProgressSystem";
import type { CharacterBuild } from "../systems/CharacterBuildSystem";
import { saveOrUpdatePartySlot, loadSaveFile, saveSaveFile, type SavePartyResult } from "../systems/SaveSystem";
import { loadWorldFlags, saveWorldFlags, setWorldFlag, hasWorldFlag, DEFAULT_WORLD_FLAG_STATE, type WorldFlagState } from "../systems/WorldFlagSystem";
import {
  SPARABLE_MINIBOSS_CHAPTERS,
  RETURNING_MINIBOSS_FLAVOR_TEXT,
  resolveSaltmereCh1Enemy,
  withReturningMinibossSwap,
  sparedFlagId,
  SPARE_MERCY_GOLD_REWARD,
} from "../systems/ReturningMinibossSystem";
import {
  resolveThroneVariant,
  withThroneVariant,
  withThroneEnemyReskins,
  mercyTallyLeansHollow,
  type ThroneVariant,
} from "../systems/NamelessThroneSystem";

/**
 * Phase 23 (D-114): the actual battle board's per-tile color. Every non-
 * floor/blocked type (cliff/water/fire/acid, and now pit) previously
 * rendered as plain floor here — mechanically distinct but visually
 * invisible, a real pre-existing gap. Kept separate from
 * `MapBuilderScene`'s own `TERRAIN_COLORS` (that scene has its own
 * debug/editing palette needs) rather than sharing one constant.
 */
const BOARD_TERRAIN_COLORS: Record<TileType, number> = {
  floor: COLORS.tileFloor,
  blocked: COLORS.tileBlocked,
  cliff: 0x4a4a5a,
  water: 0x2a4a6a,
  fire: 0x6a2a2a,
  acid: 0x4a6a2a,
  pit: 0x14141c,
  sand: 0xc2a878,
};

/** Test Mode (D-138): every enemy id, for the debug spawner's picker grid. */
const DEBUG_ENEMY_IDS: string[] = Object.keys(ENEMY_DEFINITIONS);
/** Test Mode (D-138): every terrain type, for the debug terrain-painter's picker grid. */
const DEBUG_TERRAIN_TYPES: TileType[] = Object.keys(BOARD_TERRAIN_COLORS) as TileType[];
/**
 * Test Mode (D-138): a fixed, generously long duration for a debug-applied
 * status effect — long enough to observe without babysitting a countdown; a
 * second click on the same status chip removes it early regardless of how
 * much time is left (see `handleDebugStatusClick`).
 */
const DEBUG_STATUS_DURATION_TURNS = 99;

/**
 * BattleScene — Phase 4: Combat MVP.
 *
 * Builds on Phase 3 (waves + enemy pathfinding). Heroes can now act: a basic
 * attack (in range) or one distinct ability each. Enemies fight back — the melee
 * Grunt strikes an adjacent hero, the ranged Runner from two tiles — and living
 * heroes now BLOCK enemy routes, so body-blocking the lane is a real tactic.
 * Defeated enemies are removed; a hero at 0 HP is removed too, but that is NOT a
 * loss (the only loss condition remains Stronghold Integrity = 0). With enemies
 * now stoppable, VICTORY (clear all waves with Integrity > 0) is reachable.
 *
 * All combat DECISIONS live in CombatSystem/WaveSystem; this scene only renders
 * reports, drives phase transitions, and turns clicks into requested actions.
 * NOT here yet: building/traps/gold/shop (Phase 5).
 */

type Interaction =
  | { kind: "idle" }
  | { kind: "heroSelected"; heroId: string }
  | { kind: "confirmingMove"; heroId: string; dest: GridPosition }
  | { kind: "building"; defId: string }
  | { kind: "equipping"; itemId: string | null }
  | { kind: "choosingSpell"; heroId: string }
  | { kind: "aimingSpell"; heroId: string; abilityId: string }
  /**
   * Phase 16 (D-106): the next click picks a TILE, not a hero/enemy — for a
   * ranged-AoE spell (any tile within range), a self-teleport or summon
   * placement (an empty tile within range), or a terrain-shaping spell (an
   * empty, placeable tile within range). One shared variant rather than one
   * per spell kind; `castTileSpellOn` branches on the ability's own fields.
   */
  | { kind: "aimingTileSpell"; heroId: string; abilityId: string }
  /** Test Mode (D-138): the next tile click spawns this enemy id on it. */
  | { kind: "debugSpawnEnemy"; enemyId: string }
  /** Test Mode (D-138): the next tile click repaints it to this terrain type. */
  | { kind: "debugPaintTerrain"; tileType: TileType }
  /** Test Mode (D-138): the next tile click toggles this status on whatever hero/enemy occupies it. */
  | { kind: "debugStatus"; statusId: StatusEffectId };

/** D-125: one pending Wizard/Warlock spell-mastery-family pick — see `showSpellPickChoiceQueue`. */
interface SpellPickRequest {
  hero: Hero;
  kind: "mastery" | "signature" | "arcanum";
  tier?: number;
}

const ANIM_MS = 420;

/** D-122: base durations for the cast-visual/death-visual flourishes, before each ability's own `durationScale`. */
const CAST_FX_BASE_MS = 260;
const DEATH_FX_BASE_MS = 320;

/** Phase 11.7 (D-071): one-time gold bonus for a hero landing on a treasure tile. */
const TREASURE_GOLD_BONUS = 10;

/**
 * Phase 13.8 (D-093): flat, untuned constants for two of the new classes'
 * on-hit bonuses — same "first pass" treatment as every other balance
 * number in this project.
 */
const DIVINE_SMITE_BONUS_DAMAGE = 6;
const HUNTERS_MARK_BONUS_DAMAGE = 4;
/** Hunter's Mark auto-targets the nearest enemy within this many tiles (no separate aim step — see BattleScene.onBonusActionButton). */
const HUNTERS_MARK_RANGE_TILES = 3;
/** D-127: Rogue's Blindsense/Ranger's Feral Senses see a hidden enemy within this many tiles — a "close, not board-wide" reading of the real SRD's ~10ft, since this game has no feet-per-tile scale defined anywhere else to convert precisely — see `isEnemyTargetable`. */
const STEALTH_SENSE_RANGE_TILES = 2;

/**
 * Phase 11.5 (D-078): the Gear grid now shops equipment AND potions from one
 * combined, generically-sized list (same `buildItemGrid` used by Build/the
 * old single-slot Gear) — equipping/potion-use logic branches on catalogue
 * membership rather than needing a separate UI mode.
 */
const ALL_GEAR_CATALOG_IDS: string[] = [...EQUIPMENT_ORDER, ...POTION_ORDER];

/**
 * Phase 17 (D-108): the real weapon/armor catalogue nearly quadrupled
 * `ALL_GEAR_CATALOG_IDS`'s size — a flat, un-paged grid (D-078's original
 * design) would now run many rows past the canvas. `showEquipUI` shows only
 * one page's worth (4 cols x 4 rows) at a time, keyed off the SAME
 * `gridFocusIndex` keyboard/mouse selection already tracks (its page is
 * just `floor(index / ITEM_GRID_PAGE_SIZE)`) — no separate page field needed,
 * and arrow-key navigation across a page boundary "just works" for free.
 *
 * Phase 25 (D-116): renamed from `GEAR_GRID_PAGE_SIZE` — the shop grid grew
 * past 20 structures this phase and now paginates through the exact same
 * mechanism (`showShopUI`/`turnGridPage`, sharing one nav control with the
 * Gear grid since the two are never shown at once). This caps BOTH grids at
 * a fixed 4 rows regardless of catalogue size, so neither can ever grow past
 * the canvas again.
 */
const ITEM_GRID_PAGE_SIZE = 16;

/** D-158: matches `CharacterCreationScene`'s own `MAX_PARTY_SIZE` — the hero roster strip builds this many slot widgets, then hides whichever aren't in play. */
const MAX_ROSTER_SLOTS = 4;

interface GearCatalogEntry {
  id: string;
  name: string;
  cost: number;
  description: string;
  isPotion: boolean;
}

function gearCatalogEntry(id: string): GearCatalogEntry {
  if (id in POTION_DEFINITIONS) {
    const def = getPotionDefinition(id);
    return { id, name: def.name, cost: def.cost, description: def.description, isPotion: true };
  }
  const def = getEquipmentDefinition(id);
  return { id, name: def.name, cost: def.cost, description: def.description, isPotion: false };
}

/**
 * Button label: equipment shows its slot type, potions just say "Potion".
 * Phase 13.9 (D-094): an equipment item above "common" also shows its
 * rarity, so a rare-and-up item stands out in the grid before it's clicked.
 */
function gearCatalogButtonLabel(id: string): string {
  const entry = gearCatalogEntry(id);
  if (entry.isPotion) return `${entry.name} · Potion (${entry.cost}g)`;
  const def = getEquipmentDefinition(id);
  const tag = GEAR_SLOT_TYPE_LABELS[def.slot];
  const rarityTag = def.rarity === "common" ? "" : ` · ${RARITY_LABELS[def.rarity]}`;
  return `${entry.name} · ${tag}${rarityTag} (${entry.cost}g)`;
}

/** Phase 13.7 (D-092): "1st"/"2nd"/"3rd"/"Nth" for a spell-slot level in the spellbook overlay. */
function ordinalSpellLevel(level: number): string {
  if (level === 1) return "1st";
  if (level === 2) return "2nd";
  if (level === 3) return "3rd";
  return `${level}th`;
}

interface Token {
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
  /**
   * A real sprite, drawn over the (hidden) circle above, once one exists for
   * this token's `assetKey` — see `SPRITE_MANIFEST`/`createTokenSprite`.
   * Always undefined today (the manifest is empty, ASSET_PLAN.md/KI-004);
   * this field exists so the eventual real art only needs an entry added to
   * the manifest, not a rendering rewrite.
   */
  sprite?: Phaser.GameObjects.Sprite;
}

/** A placed wall/trap's visual (a tile fill, an outline, and a glyph). */
interface StructureToken {
  rect: Phaser.GameObjects.Rectangle;
  glyph: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private map!: GameMap;
  private grid!: GridSystem;
  private movement!: MovementSystem;
  private pathfinding!: PathfindingSystem;
  private waveSystem!: WaveSystem;
  /** Phase 13.1 (D-086): the single RandomService every dice roll in this battle draws on. */
  private random!: RandomService;
  private turns!: TurnSystem;
  private economy!: EconomySystem;
  private buildSystem!: BuildSystem;
  private progression!: ProgressionSystem;
  /** Phase 13.4 (D-088): the per-run Short/Long Rest charge pool. */
  private restSystem!: RestSystem;
  private heroAI!: HeroAISystem;
  private wavesCleared = 0;

  private heroes: Hero[] = [];
  private heroTokens = new Map<string, Token>();
  /** Phase 21 (D-112): a hero's on-token status badge — mirrors `enemyStatusBadges`. */
  private heroStatusBadges = new Map<string, Phaser.GameObjects.Text>();
  /** Phase 22 (magic-item expansion): an animated cape graphic trailing a hero wearing a `visualEffect: "flowingCape"` item (Cape of Billowing) — drawn under the token, redrawn every frame in `update()`. */
  private heroCapes = new Map<string, Phaser.GameObjects.Graphics>();
  /** Phase 22: this battle's own curated loot pool (a campaign's `lootPoolIds`), or undefined for the full unrestricted pool (classic/campaign-less/Free Play) — see `LootSystem.rollLootDrop`. */
  private currentLootPoolIds: readonly string[] | undefined;
  private enemyTokens = new Map<string, Token>();
  /** Phase 23 (D-114): each board tile's rectangle, keyed "x,y" — kept so a dynamic terrain event can recolor just the tiles it changes without rebuilding the whole board. */
  private tileRects = new Map<string, Phaser.GameObjects.Rectangle>();
  /** Phase 23 (D-114): indexes into `this.map.data.dynamicTerrainEvents` that have already fired this battle. */
  private firedDynamicTerrainEvents = new Set<number>();
  /** Phase 16 (D-106): temporary ally combatants a summon spell places on the field. */
  private summonSystem = new SummonSystem();
  private summonTokens = new Map<string, Token>();
  /** Phase 16 (D-106): a terrain-shaping spell's placed structure, ticking down to auto-removal. */
  private temporaryStructures: { instanceId: string; remainingTurns: number }[] = [];
  private structureTokens = new Map<string, StructureToken>();
  /** Phase 8 (KI-027): a small text badge of active-status initials (e.g.
   * "SB" for slowed+burning), kept independent of the token's fill colour. */
  private enemyStatusBadges = new Map<string, Phaser.GameObjects.Text>();
  /** Phase 8 (KI-023): a persistent name banner above the miniboss token, so
   * "this is the boss" doesn't depend on recognising its fill colour. */
  private enemyBossBanners = new Map<string, Phaser.GameObjects.Text>();
  /** Phase 20 (D-111): a translucent ring under a captain/banner enemy's
   * token, sized to its `auraBuff.radiusTiles`, so the buff reads as a real
   * on-board effect rather than a silent stat change. */
  private enemyAuraRings = new Map<string, Phaser.GameObjects.Arc>();

  private rangeTiles: Phaser.GameObjects.Rectangle[] = [];
  private targetMarks: Phaser.GameObjects.Rectangle[] = [];
  /** Phase 8: a small corner glyph on ability-targetable enemies, so "attack
   * range" vs "ability range" doesn't rely solely on two similar warm hues. */
  private targetGlyphs: Phaser.GameObjects.Text[] = [];
  private pathDots: Phaser.GameObjects.Arc[] = [];
  /**
   * Drag-and-drop hero move: the hero id whose OWN tile a `pointerdown` just
   * landed on while it was already `heroSelected` — armed but not yet a
   * real drag until the pointer actually moves off that tile (see
   * `wireInput`'s `pointermove`). A plain click (down then up with no
   * movement in between) never promotes past this, so it stays exactly as
   * cheap/no-op as any other click.
   */
  private dragArmedHeroId: string | null = null;
  /**
   * The in-progress drag itself, once armed and the pointer has moved off
   * the hero's own tile. `pins` are right-click-placed waypoints, oldest
   * first — the previewed/final route runs hero.position -> pins... ->
   * wherever the pointer currently is (see `MovementSystem.routeThroughWaypoints`).
   */
  private heroDrag: { heroId: string; pins: GridPosition[] } | null = null;
  /** Right-click-pinned waypoint markers, drawn only during an active drag. */
  private dragPinMarks: Phaser.GameObjects.Arc[] = [];
  private activeRing!: Phaser.GameObjects.Arc;
  private hoverRect!: Phaser.GameObjects.Rectangle;
  /** D-132: the HP/AC (and, while a hero is selected and aiming at an enemy, hit%) hover tooltip. D-148: generalized to the shared `tooltip.ts` controller. */
  private tooltip!: TooltipController;
  private pendingRect!: Phaser.GameObjects.Rectangle;

  private bannerText!: Phaser.GameObjects.Text;
  // The widest pixel width the banner may render at before it would reach
  // the Gear button's left edge (KI-033) — set once in buildHud from the
  // buttons' own real coordinates, consumed by fitBannerToWidth().
  private bannerMaxWidth = 0;
  private integrityText!: Phaser.GameObjects.Text;
  /** D-158: the live enemy count, moved off the old packed status line into the top HUD, next to Integrity/Gold. */
  private enemyCountText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  /**
   * D-158 (KI-034 redesign): the hero roster strip — real per-hero widgets
   * (box/name/HP bar/detail line), one set of parallel arrays per slot,
   * replacing the old single packed `statusText` string. Built once for
   * `MAX_ROSTER_SLOTS` in `buildHud()`; `layoutHeroSlots()` positions
   * exactly `this.heroes.length` of them (party size never changes
   * mid-battle) and hides the rest; `refreshStatus()` only updates content.
   */
  private heroSlotBoxes: Phaser.GameObjects.Rectangle[] = [];
  private heroSlotNameText: Phaser.GameObjects.Text[] = [];
  private heroSlotHpBarBg: Phaser.GameObjects.Rectangle[] = [];
  private heroSlotHpBarFg: Phaser.GameObjects.Rectangle[] = [];
  private heroSlotHpText: Phaser.GameObjects.Text[] = [];
  private heroSlotDetailText: Phaser.GameObjects.Text[] = [];
  /**
   * D-158: the small amount of `statusText`'s old content that wasn't
   * redundant with an already-visible button/highlight — mode-specific
   * aiming/focus hints and `rejectAt()`'s transient rejection messages.
   * Usually empty; overwritten by the next `refreshStatus()`/`rejectAt()`
   * call, same "persists until the next real state change" behavior the
   * old shared text had.
   */
  private messageText!: Phaser.GameObjects.Text;
  private combatLogText!: Phaser.GameObjects.Text;
  private endTurnButton!: Phaser.GameObjects.Rectangle;
  private endTurnLabel!: Phaser.GameObjects.Text;
  private confirmButton!: Phaser.GameObjects.Rectangle;
  private confirmLabel!: Phaser.GameObjects.Text;
  private cancelButton!: Phaser.GameObjects.Rectangle;
  private cancelLabel!: Phaser.GameObjects.Text;
  private abilityButton!: Phaser.GameObjects.Rectangle;
  private abilityLabel!: Phaser.GameObjects.Text;
  private potionButton!: Phaser.GameObjects.Rectangle;
  private potionLabel!: Phaser.GameObjects.Text;
  /** Phase 13.2 (D-087): Second Wind (Fighter) or Cunning Action's Dash (Rogue) — whichever the selected hero's class grants. */
  private bonusActionButton!: Phaser.GameObjects.Rectangle;
  private bonusActionLabel!: Phaser.GameObjects.Text;
  /** Phase 13.2 (D-087): Fighter-only, a separate once-per-battle resource from the bonus action above. */
  private actionSurgeButton!: Phaser.GameObjects.Rectangle;
  private actionSurgeLabel!: Phaser.GameObjects.Text;

  // D-125: a third single-purpose HUD button, shared by several unrelated
  // class features that each need their own toggle/spend button but never
  // apply to the same hero at once (a hero is single-class) — Barbarian's
  // Reckless Attack, Cleric's Channel Divinity: Preserve Life, Ranger's
  // Vanish, Monk's Empty Body. One dispatcher (`showClassActionButtonFor`),
  // same shape as `showBonusActionButtonFor`.
  private classActionButton!: Phaser.GameObjects.Rectangle;
  private classActionLabel!: Phaser.GameObjects.Text;
  /** D-148: opens the Character Sheet for the currently selected hero — visible whenever a hero is selected, regardless of `canAct()` (viewing stats needs no action). */
  private characterSheetButton!: Phaser.GameObjects.Rectangle;
  private characterSheetLabel!: Phaser.GameObjects.Text;
  /**
   * D-165 (KI-098 item 2): the in-battle hotkey bar — one small button per
   * `ACTION_HOTKEY_SLOT_COUNT` slot, firing whatever `Hero.actionHotkeys()`
   * holds there (see `triggerHotkey`). Built once in `buildHud()` for the
   * fixed slot count, same "always allocate the max, show/hide per state"
   * convention `heroSlotBoxes` already uses for the roster strip.
   */
  private hotkeyButtons: Phaser.GameObjects.Rectangle[] = [];
  private hotkeyLabels: Phaser.GameObjects.Text[] = [];
  /** Phase 13.2 (D-087): attacks Uncanny-Dodged this enemy phase, so the combat log can say so (reference identity, not a data field on EnemyAttackEvent). */
  private uncannyDodgedThisPhase = new Set<EnemyAttackEvent>();
  /** Phase 13.8 (D-093): attacks halved by Rage/Wild Shape this enemy phase, so the combat log can say so. */
  private damageResistedThisPhase = new Set<EnemyAttackEvent>();
  /** D-124: attacks weakened by College of Lore's Cutting Words this enemy phase — the reacting Bard's name, so the combat log can say so. */
  private cuttingWordsAppliedThisPhase = new Map<EnemyAttackEvent, string>();
  private goldText!: Phaser.GameObjects.Text;
  private previewText!: Phaser.GameObjects.Text;
  private buildButton!: Phaser.GameObjects.Rectangle;
  private buildLabel!: Phaser.GameObjects.Text;
  private equipButton!: Phaser.GameObjects.Rectangle;
  private equipLabel!: Phaser.GameObjects.Text;
  private shopButtons: Phaser.GameObjects.Rectangle[] = [];
  private shopLabels: Phaser.GameObjects.Text[] = [];
  private equipItemButtons: Phaser.GameObjects.Rectangle[] = [];
  private equipItemLabels: Phaser.GameObjects.Text[] = [];
  /**
   * Phase 17 (D-108): page nav for whichever item grid is active — its page
   * is derived from `gridFocusIndex`, no separate page field. Phase 25
   * (D-116): shared between the Gear AND Shop grids (renamed from
   * `gearPage*`) since the two are never shown at once.
   */
  private pageNavPrevButton!: Phaser.GameObjects.Text;
  private pageNavNextButton!: Phaser.GameObjects.Text;
  private pageNavLabel!: Phaser.GameObjects.Text;
  private doneButton!: Phaser.GameObjects.Rectangle;
  private doneLabel!: Phaser.GameObjects.Text;
  /** Phase 11.7 (D-071): shown instead of the Gear grid when no living hero
   * is near a "shop" tile — proximity-gated shopping's fallback message. */
  private equipLockLabel!: Phaser.GameObjects.Text;
  private buildGhost!: Phaser.GameObjects.Rectangle;
  /** Phase 8: a check/cross glyph on the build ghost, so "can I build here"
   * doesn't rely solely on green-vs-red. */
  private buildGhostGlyph!: Phaser.GameObjects.Text;
  private endOverlay: Phaser.GameObjects.GameObject[] = [];
  /** Phase 13.4 (D-088): the between-waves Rest-choice overlay (Short/Long Rest/Continue). */
  private restOverlay: Phaser.GameObjects.GameObject[] = [];
  private pendingAfterRest: (() => void) | null = null;
  /** True while the rest-choice overlay is up, so the board ignores input under it. */
  private choosingRest = false;
  /**
   * Phase 13.6 (D-091): the Ability-Score-Improvement-or-feat overlay, shown
   * once per hero that just reached an ASI-granting level, one at a time.
   * `asiQueue` holds the heroes still waiting.
   */
  private asiOverlay: Phaser.GameObjects.GameObject[] = [];
  // D-16x: carries the triggering level explicitly (not just the hero) so a
  // choice deferred from a pre-battle fast-forward can be resolved against
  // the RIGHT level's plan entry, not whatever level the hero has already
  // reached by the time the prompt is shown.
  private asiQueue: { hero: Hero; level: number }[] = [];
  private pendingAfterAsi: (() => void) | null = null;
  /** True while the ASI-or-feat overlay is up, so the board ignores input under it. */
  private choosingAsi = false;
  /** D-181: true while the pre-region bonus-choice overlay is up (reuses `asiOverlay`/`renderAsiPrompt`), so the board ignores input under it. */
  private choosingRegionBonus = false;
  /** KI-098 item 13: true while the "finish or spare?" overlay for this chapter's miniboss is up (reuses `asiOverlay`/`renderAsiPrompt`), so the board ignores input under it. */
  private choosingSparableKill = false;
  /** D-185: true while Sorrel Thane's Drowning Vale Ch1-3 choice overlay is up (reuses `asiOverlay`/`renderAsiPrompt`), so the board ignores input under it. */
  private choosingSorrelFateChoice = false;
  /**
   * Phase 13.11 (D-096): the subclass-choice confirmation overlay, shown
   * once per hero that just reached its class's subclass-choice level
   * (Fighter/Wizard/Rogue — Cleric/Sorcerer/Warlock get theirs at creation
   * instead, since their choice level is 1). Reuses `renderAsiPrompt`/
   * `asiOverlay`'s rendering — this queue never runs concurrently with the
   * ASI queue (see `afterWaveCleared`'s chaining), so sharing that overlay
   * array is safe.
   */
  private subclassQueue: Hero[] = [];
  private pendingAfterSubclass: (() => void) | null = null;
  /** True while the subclass-choice overlay is up, so the board ignores input under it. */
  private choosingSubclass = false;
  /**
   * D-125: the Spell Mastery/Signature Spells (Wizard)/Mystic Arcanum
   * (Warlock) one-time spell-pick overlay — same "queue and pop" shape as
   * `asiQueue`/`subclassQueue`, shares `asiOverlay`'s rendering (never runs
   * concurrently with either).
   */
  private spellPickQueue: SpellPickRequest[] = [];
  private pendingAfterSpellPick: (() => void) | null = null;
  /** True while the spell-pick overlay is up, so the board ignores input under it. */
  private choosingSpellPick = false;
  /**
   * A plain "You reached level N!" confirmation, shown once per hero whose
   * level-up this wave grants no other choice (no ASI/subclass/spell-pick
   * popup of its own to announce it) — closing KI-079's gap where such a
   * hero previously only got a combat-log line, no on-screen popup at all.
   * Same "queue and pop" shape as `asiQueue`/`subclassQueue`, shares
   * `asiOverlay`'s rendering.
   */
  private levelUpAckQueue: Hero[] = [];
  private pendingAfterLevelUpAck: (() => void) | null = null;
  /** True while the level-up acknowledgment overlay is up, so the board ignores input under it. */
  private choosingLevelUpAck = false;
  /** D-148: this level-up's real stat/feature delta text, keyed by hero id — populated in `applyClassLevelUps`, read (and left in place) by `advanceLevelUpAckQueue`. */
  private levelUpDeltaByHeroId = new Map<string, string>();
  /**
   * D-136 (Phase 3 of the spell-preparation economy): the in-battle spell-
   * swap overlay, shown once per hero (queue-and-pop, same shape as
   * `asiQueue`/`subclassQueue`, shares `asiOverlay`'s rendering) at either a
   * Long Rest just taken (`chooseRest`) or a level just gained
   * (`applyClassLevelUps`) — whichever trigger `spellPrepTrigger` names.
   * `spellPrepSteps`/`spellPrepStepIndex` track this hero's own step ladder
   * (`spellSwapStepsForClass`); the "replace one" flow's first pick is
   * threaded directly as a parameter between its two screens, no field
   * needed.
   */
  private spellPrepQueue: Hero[] = [];
  private spellPrepTrigger: SpellSwapTrigger = "longRest";
  private spellPrepSteps: SpellSwapStepKind[] = [];
  private spellPrepStepIndex = 0;
  private pendingAfterSpellPrep: (() => void) | null = null;
  /** True while the spell-prep overlay is up, so the board ignores input under it. */
  private choosingSpellPrep = false;
  /**
   * Phase 13.7 (D-092): the spellbook overlay — shown when a caster hero
   * (Wizard/Cleric) opens "Cast a Spell" instead of using the old
   * single-ability flow. Gated entirely through `Interaction`'s
   * `"choosingSpell"` kind (like Build/Gear mode), not `inputLocked()` — this
   * is a normal in-turn action choice, not a forced between-wave modal.
   */
  private spellbookOverlay: Phaser.GameObjects.GameObject[] = [];
  /**
   * Phase 16 (D-106): which page of the spellbook grid is showing. A
   * full-caster's known-spell list can now run past 100 entries (see
   * `characterCreation.ts`), far more than the single-row layout Phase
   * 13.7 designed for a 2-6-spell list — reset to 0 every time the
   * overlay opens.
   */
  private spellbookPage = 0;

  /**
   * KI-030 ("full keyboard-only play"): a keyboard-driven tile cursor,
   * independent of the mouse. Arrow keys move it; Enter/Space act on
   * whatever tile it's over via the SAME `handleClick`/`updateHoverAt` paths
   * the mouse already uses, so no combat/build/equip rule is duplicated.
   */
  private cursorPos: GridPosition = { x: 0, y: 0 };
  /**
   * Which arrow-key target is active while the shop/Gear grid is on screen:
   * "grid" navigates its buttons, "board" moves the tile cursor underneath
   * it. Outside build/equip mode this is always "board" (there is no grid to
   * focus). Toggled with Tab.
   */
  private keyboardFocus: "board" | "grid" = "board";
  /** Row-major index into the currently visible shop/equip item grid. */
  private gridFocusIndex = 0;

  private ui: Interaction = { kind: "idle" };
  private lastReport: EnemyPhaseReport | null = null;
  private combatLog: string[] = [];
  /**
   * KI-085/D-130: the "technical" tier of a two-tier battle log — every d20
   * attack/save roll's raw numbers (die, bonus, target number, advantage
   * mode) — kept separate from `combatLog`'s plain-English lines rather than
   * folded into them, per Kevin's own ask. Viewed in its own overlay (see
   * `showTechnicalLogOverlay`), not the small always-on HUD line
   * `combatLog` uses, so it can hold far more history (200 vs. 5 lines).
   */
  private technicalLog: string[] = [];
  private technicalLogOverlay: Phaser.GameObjects.GameObject[] = [];
  /**
   * Test Mode (D-138): the top-level debug menu (Skip Wave, No-Fail toggle,
   * and the three mode-select buttons) — same dim+panel modal shape as
   * `technicalLogOverlay`. Only ever populated when `this.testMode`.
   */
  private debugMenuOverlay: Phaser.GameObjects.GameObject[] = [];
  /** Test Mode (D-138): mirrors `WaveSystem.setNoFail`'s own flag, for the toggle button's label. */
  private debugNoFailEnabled = false;
  private debugEnemyButtons: Phaser.GameObjects.Rectangle[] = [];
  private debugEnemyLabels: Phaser.GameObjects.Text[] = [];
  private debugTerrainButtons: Phaser.GameObjects.Rectangle[] = [];
  private debugTerrainLabels: Phaser.GameObjects.Text[] = [];
  private debugStatusButtons: Phaser.GameObjects.Rectangle[] = [];
  private debugStatusLabels: Phaser.GameObjects.Text[] = [];
  /**
   * The board's own pit "✕" glyph, one per pit tile, keyed "x,y" — tracked
   * (rather than fire-and-forget, as it was before D-138) so Test Mode's
   * debug terrain-painter can find and remove a tile's glyph if it repaints
   * that tile away from "pit".
   */
  private pitGlyphs = new Map<string, Phaser.GameObjects.Text>();
  /** Phase 11.7 (D-071): treasure tiles already consumed this battle, by "x,y" key. */
  private consumedTreasureTiles = new Set<string>();
  /** D-068: which loss condition ended the run, for the end-screen message. */
  private defeatReason: "integrity" | "party" | null = null;

  /** Phase 8 setting: scales/skips tween durations ("instant" = reduced motion). */
  private animationSpeed: AnimationSpeed = "normal";
  private tutorialOverlay: Phaser.GameObjects.GameObject[] = [];
  private pendingAfterTutorial: (() => void) | null = null;
  /** D-177: the chapter intro/outro dialogue box, while one is showing — see `showChapterIntroIfAny`/`showChapterOutroIfAny`. */
  private chapterDialogue: DialogueBoxController | null = null;

  /**
   * Phase 11.6 (D-079): unlock-on-encounter Bestiary progress. Loaded once in
   * `create()` and only written back to localStorage when it actually
   * changes (see `markEnemySeen`/`markEnemyKilled`) — this scene never
   * spams a write every frame.
   */
  private bestiaryProgress: BestiaryProgress = DEFAULT_BESTIARY_PROGRESS;

  /**
   * Phase 11.8 (D-071): campaign-completion progress, loaded once in
   * `create()` and only written back to localStorage when a campaign is
   * actually completed for the first time (see the "victory" phase-change
   * hook) — same "don't spam localStorage" discipline as `bestiaryProgress`.
   */
  private campaignProgress: CampaignProgress = DEFAULT_CAMPAIGN_PROGRESS;

  /**
   * KI-098 item 13 (CAMPAIGN_STORY_DESIGN.md §4): persisted per-choice story
   * flags, loaded once in `create()`. Only the "spared this miniboss" flags
   * are written yet (see `pendingSparableKill`'s resolution below) — same
   * "don't spam localStorage" discipline as `bestiaryProgress`/
   * `campaignProgress`.
   */
  private worldFlags: WorldFlagState = DEFAULT_WORLD_FLAG_STATE;

  /**
   * KI-098 item 13 (companion roster/recruitment, Phase 1): loaded once in
   * `create()`, same "don't spam localStorage" discipline as `worldFlags`.
   * Only mutated here by `maybeUnlockHomeRegionCompanion` (bench a Pool B
   * companion on their home region's Chapter 1 completion) — everything
   * else (seeding, active/bench swaps) happens in menu scenes, not here.
   */
  private companionRoster: CompanionRosterState = DEFAULT_COMPANION_ROSTER_STATE;

  /**
   * Set by `resolveDeaths` when a wave's `removed` list includes the current
   * chapter's own sparable miniboss (`SPARABLE_MINIBOSS_CHAPTERS`). Consumed
   * and cleared by `afterWaveCleared`, which must ask "finish or spare?"
   * BEFORE checking `isLastWave()` — the miniboss is always the finale spawn
   * of its chapter, so resolving this any later would race the victory
   * transition.
   */
  private pendingSparableKill: Enemy | null = null;

  /**
   * Set at chapter load (see `create()`) only when Saltmere Ch1 resolved to
   * an actual returning miniboss rather than the nameless tide-wretch
   * fallback. Read once, when that enemy id first spawns, to log its
   * one-time "washed up on Saltmere's shore" flavor line — see
   * `RETURNING_MINIBOSS_FLAVOR_TEXT`.
   */
  private saltmereReturningEnemyId: string | null = null;

  /**
   * D-188: set once at chapter load (same spot the Saltmere resolution
   * above runs from) when this battle is the Nameless Throne capstone.
   * Read again at victory time to pick the matching epilogue — resolving
   * it twice from `this.worldFlags` would also be safe (nothing writes to
   * `this.worldFlags` during a flat, chapter-less capstone battle), but
   * storing it once matches `saltmereReturningEnemyId`'s own idiom.
   */
  private resolvedThroneVariant: ThroneVariant | null = null;

  /**
   * KI-098 item 13 continuation: set by `maybeUnlockHomeRegionCompanion` when
   * this battle's victory just recruited a Pool B companion, consumed by
   * `showCompanionRecruitmentIfAny` in the victory dialogue chain. Null the
   * rest of the time (most battles recruit nobody).
   */
  private pendingCompanionRecruitment: CompanionDefinition | null = null;

  /**
   * The party for this battle, built by `CharacterCreationScene` (or, for a
   * Co-op battle with no hero-picker UI yet, `CoopLobbyScene`'s small
   * built-in default party — see `CharacterBuildSystem.defaultPartyBuilds`).
   * Always non-empty: every entry point into this scene now passes one — see
   * `init()`.
   */
  private heroDefinitions: HeroDefinition[] = [];
  /**
   * D-133: each hero's Character Creation level-up planner blueprint, if one
   * was set, keyed by hero id — built once in `buildHeroes()` from
   * `HeroDefinition.levelUpPlan`. D-16x: a hero with no entry here (or no
   * plan entry for a given level) gets no ASI/subclass/spell-pick choice
   * resolved silently anymore — see `pendingFastForwardAsi` etc. below and
   * `applyClassLevelUps`'s in-battle path.
   */
  private heroLevelUpPlans: Map<string, LevelUpPlan> = new Map();
  /**
   * D-16x: whatever `buildHeroes()`'s pre-battle Starting Level/Team Level
   * fast-forward couldn't resolve from an explicit plan entry, bucketed by
   * choice kind — presented once, right before wave 1, by
   * `presentPendingFastForwardChoices` via the exact same queues
   * `afterWaveCleared` uses after every wave clear. Never silently
   * defaulted, regardless of the hero's Plan Levels mode.
   */
  private pendingFastForwardAsi: { hero: Hero; level: number }[] = [];
  private pendingFastForwardSubclass: Hero[] = [];
  private pendingFastForwardSpellPicks: SpellPickRequest[] = [];
  /**
   * Phase 11.4 (D-077): the difficulty tier picked in `CharacterCreationScene`,
   * or "normal" (1x/1x) when omitted.
   */
  private difficultyId: DifficultyId = "normal";
  /**
   * Phase 11.8 (D-071): an optional campaign id, passed via
   * `scene.start("BattleScene", { campaignId })` (ultimately from
   * `CampaignSelectScene` via `CharacterCreationScene`). `null` for a
   * campaign-less run (Free Play, Co-op, or a plain "Create Party" run),
   * which keeps `create()` wiring up `TEST_MAP`/`WAVES` — this is the ONE
   * chokepoint that changes based on this field.
   */
  private campaignId: string | null = null;
  /**
   * D-177: which chapter of a CHAPTERED campaign to play (0-based), passed
   * via `scene.start("BattleScene", { chapterIndex })` (ultimately from
   * `CampaignSelectScene` via `CharacterCreationScene`). `0` for a flat
   * (non-chaptered) campaign or no campaign at all — `getChapter` already
   * synthesizes chapter 0 from a flat campaign's own top-level fields, so
   * this default is always safe to resolve against.
   */
  private chapterIndex = 0;
  /**
   * D-177: the chapter actually resolved this battle (see the chokepoint in
   * `create()`) — `null` for a campaign-less run (Free Play, Co-op, a plain
   * "Create Party" run). Set alongside `currentWaves`/`currentLootPoolIds`;
   * read by the victory hook (`markCampaignCompletedIfAny`) and the chapter
   * intro/outro dialogue hooks.
   */
  private currentChapter: ChapterDefinition | null = null;
  /**
   * Phase 12.3 (D-103): an optional cooperative-battle context, passed via
   * `scene.start("BattleScene", { coopSession })` from `CoopLobbyScene`'s
   * "Start Battle". `null` for every other path. `heroOwners` maps each
   * hero id in `heroDefinitions` to the uid that controls it (see this
   * field's own assignment in `CoopSessionSystem.startCoopBattle`). Gates
   * hero selection (`heroAt`'s callers) so a client can only act on heroes
   * it owns; does NOT yet sync either client's board with the other's
   * actions (no result-broadcast this sub-phase — see `PHASE_HANDOFF.md`).
   */
  private coopSession: { code: string; localUid: string; heroOwners: Record<string, string>; partnerName: string } | null = null;
  /**
   * Phase 11.9 (D-071): an optional free-play map id, passed via
   * `scene.start("BattleScene", { freePlayMapId, freePlayWaves })`
   * (ultimately from `FreePlayScene` via `CharacterCreationScene`). `null`
   * when omitted — a campaign run or a campaign-less custom party both leave
   * this unset. Only consulted when `campaignId` is ALSO unset (campaigns
   * always take priority — see the resolution chokepoint in `create()`).
   */
  private freePlayMapId: string | null = null;
  /**
   * Phase 11.9 (D-071): the free-play wave list generated by
   * `generateFreePlayWaves` and handed through unchanged (plain serializable
   * data, safe to pass through Phaser scene-start data same as
   * `heroDefinitions`). `null` when free-play wasn't used.
   */
  private freePlayWaves: WaveDefinition[] | null = null;
  /**
   * Phase 11.10 (D-085): an optional, fully-formed `ParsedMap` handed in
   * directly (a map-builder draft being playtested, or a fetched
   * `SharedMapRecord` decoded via `fromSharedMapRecord`) — bypasses the
   * by-id `MAPS` registry entirely, since `getMapById` throws on an unknown
   * id and was never designed to be mutated at runtime with user content.
   * `null` on every other path. Checked in the SAME resolution chokepoint as
   * `freePlayMapId`, immediately after it, so a custom map still uses
   * whatever `freePlayWaves` was passed alongside it.
   */
  private customMapData: ParsedMap | null = null;
  /**
   * Phase 11.8 (D-071): the wave list actually in play this battle — `WAVES`
   * on the classic/campaign-less path, or a campaign's own list. Set once in
   * `create()` alongside `this.map`/`this.waveSystem`; `updateWavePreview`
   * reads THIS rather than the bare `WAVES` import so the "Next wave" preview
   * stays correct in campaign mode too.
   */
  private currentWaves: WaveDefinition[] = WAVES;
  /**
   * Test Mode (D-138): true only when this battle was entered via
   * `TestModeScene` → `CharacterCreationScene`. Gates the debug toolbar
   * (Skip Wave, No-Fail, Spawn Enemy, Paint Terrain, Set Status) — every
   * other path into a battle is completely unaffected.
   */
  private testMode = false;
  /**
   * D-152: the exact `CharacterBuild[]` `CharacterCreationScene` built this
   * party from, forwarded ONLY so the in-battle pause menu's "Save Party"
   * has real data to save — `heroDefinitions` above has already discarded
   * race id by the time it reaches here (see `CharacterBuildSystem.
   * heroDefinitionFromBuild`), so there is no way back to a `CharacterBuild`
   * from it. `undefined` for a coop battle (`CoopLobbyScene` has no
   * `CharacterBuild[]` to hand over) — Save is simply unavailable there.
   */
  private originalParty: CharacterBuild[] | undefined = undefined;
  /**
   * D-152: the save slot this party was already loaded from, if any — kept
   * in sync with a fresh id after the pause menu's first Save this battle,
   * so a second Save updates rather than duplicating (same convention
   * `CharacterCreationScene.loadedSlotId` already follows).
   */
  private loadedSlotId: string | undefined = undefined;

  constructor() {
    super("BattleScene");
  }

  init(data: {
    heroDefinitions: HeroDefinition[];
    difficultyId?: DifficultyId;
    campaignId?: string;
    chapterIndex?: number;
    freePlayMapId?: string;
    freePlayWaves?: WaveDefinition[];
    customMapData?: ParsedMap;
    coopSession?: { code: string; localUid: string; heroOwners: Record<string, string>; partnerName: string };
    testMode?: boolean;
    originalParty?: CharacterBuild[];
    loadedSlotId?: string;
  }): void {
    if (!data?.heroDefinitions?.length) {
      throw new Error(
        "BattleScene requires a non-empty heroDefinitions — every entry point must build a party first.",
      );
    }
    this.heroDefinitions = data.heroDefinitions;
    this.difficultyId = data?.difficultyId ?? "normal";
    this.campaignId = data?.campaignId ?? null;
    this.chapterIndex = data?.chapterIndex ?? 0;
    this.freePlayMapId = data?.freePlayMapId ?? null;
    this.freePlayWaves = data?.freePlayWaves ?? null;
    this.customMapData = data?.customMapData ?? null;
    this.coopSession = data?.coopSession ?? null;
    this.testMode = data?.testMode ?? false;
    this.originalParty = data?.originalParty;
    this.loadedSlotId = data?.loadedSlotId;
  }

  /**
   * Loads whatever real art `SPRITE_MANIFEST` lists, keyed by the same
   * `assetKey` a hero/enemy/structure definition already carries — see
   * `createTokenSprite`. The manifest is empty today (ASSET_PLAN.md/KI-004,
   * no art exists yet), so this loop makes zero requests; once an entry is
   * added there, this is the only line that needs to run to load it.
   */
  preload(): void {
    for (const [assetKey, path] of Object.entries(SPRITE_MANIFEST)) {
      this.load.image(assetKey, path);
    }
  }

  create(): void {
    // Reset all mutable state so returning from the menu starts a clean game
    // (Phaser reuses the scene instance, so fields must be cleared here).
    this.heroes = [];
    this.heroTokens.clear();
    for (const cape of this.heroCapes.values()) cape.destroy();
    this.heroCapes.clear();
    this.enemyTokens.clear();
    this.summonSystem = new SummonSystem();
    this.summonTokens.clear();
    this.temporaryStructures = [];
    this.structureTokens.clear();
    this.enemyAuraRings.clear();
    this.enemyStatusBadges.clear();
    this.enemyBossBanners.clear();
    this.consumedTreasureTiles.clear();
    this.rangeTiles = [];
    this.targetMarks = [];
    this.targetGlyphs = [];
    this.pathDots = [];
    this.shopButtons = [];
    this.shopLabels = [];
    this.equipItemButtons = [];
    this.equipItemLabels = [];
    this.endOverlay = [];
    this.restOverlay = [];
    this.pendingAfterRest = null;
    this.choosingRest = false;
    this.asiOverlay = [];
    this.asiQueue = [];
    this.pendingAfterAsi = null;
    this.choosingAsi = false;
    this.choosingRegionBonus = false;
    this.choosingSparableKill = false;
    this.pendingSparableKill = null;
    this.saltmereReturningEnemyId = null;
    this.resolvedThroneVariant = null;
    this.pendingCompanionRecruitment = null;
    this.subclassQueue = [];
    this.pendingAfterSubclass = null;
    this.choosingSubclass = false;
    this.spellPickQueue = [];
    this.pendingAfterSpellPick = null;
    this.choosingSpellPick = false;
    this.pendingFastForwardAsi = [];
    this.pendingFastForwardSubclass = [];
    this.pendingFastForwardSpellPicks = [];
    this.levelUpAckQueue = [];
    this.pendingAfterLevelUpAck = null;
    this.choosingLevelUpAck = false;
    this.levelUpDeltaByHeroId.clear();
    this.spellPrepQueue = [];
    this.spellPrepTrigger = "longRest";
    this.spellPrepSteps = [];
    this.spellPrepStepIndex = 0;
    this.pendingAfterSpellPrep = null;
    this.choosingSpellPrep = false;
    this.spellbookOverlay = [];
    this.spellbookPage = 0;
    this.ui = { kind: "idle" };
    this.lastReport = null;
    this.combatLog = [];
    this.technicalLog = [];
    this.technicalLogOverlay = [];
    this.defeatReason = null;
    this.wavesCleared = 0;
    this.tutorialOverlay = [];
    this.pendingAfterTutorial = null;
    this.chapterDialogue = null;
    this.keyboardFocus = "board";
    this.gridFocusIndex = 0;
    this.animationSpeed = loadSettings(window.localStorage, SETTINGS_STORAGE_KEY).animationSpeed;
    this.bestiaryProgress = loadBestiaryProgress(window.localStorage, BESTIARY_STORAGE_KEY);
    this.campaignProgress = loadCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY);
    this.worldFlags = loadWorldFlags(window.localStorage, WORLD_FLAG_STORAGE_KEY);
    this.companionRoster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);

    // Phase 11.8/11.9 (D-071): the ONE chokepoint that picks which map/wave-
    // list this battle plays. `campaignId` omitted (a campaign-less "Create
    // Party" run, or Co-op) resolves to plain TEST_MAP/WAVES. Free-play
    // (`freePlayMapId`+`freePlayWaves`) is checked only when `campaignId` is
    // ALSO unset — a campaign always wins if somehow both were passed — and
    // falls back to TEST_MAP/WAVES if either free-play field is missing.
    const campaign = this.campaignId ? getCampaignDefinition(this.campaignId) : null;
    // D-177: for a chaptered campaign, resolve THIS chapter's own waves/
    // lootPoolIds instead of the top-level (finale-describing) fields —
    // `getChapter` synthesizes a flat campaign's own fields as chapter 0, so
    // this resolves correctly (and `this.chapterIndex` stays 0) for every
    // pre-D-177 path unchanged.
    this.currentChapter = campaign ? getChapter(campaign, this.chapterIndex) : null;
    // Phase 22 (magic-item expansion): a campaign's own curated loot pool
    // (undefined for the plain 10-wave path, a campaign-less party, or
    // Free Play — all of which use LootSystem's full, unrestricted pool).
    this.currentLootPoolIds = this.currentChapter?.lootPoolIds ?? campaign?.lootPoolIds;
    let mapData = campaign ? getCampaignMap(campaign.mapId) : TEST_MAP;
    let waveList: WaveDefinition[] = this.currentChapter ? this.currentChapter.waves : WAVES;
    // KI-098 item 13 (CAMPAIGN_STORY_DESIGN.md §4): Saltmere Ch1's finale spot
    // is whichever earlier-region miniboss the player spared, or the nameless
    // tide-wretch fallback if none was. Resolved here, once, at chapter load.
    if (this.currentChapter?.id === "saltmere-ch1") {
      const resolved = resolveSaltmereCh1Enemy(this.worldFlags);
      waveList = withReturningMinibossSwap(waveList, resolved.enemyId);
      if (resolved.isReturning) this.saltmereReturningEnemyId = resolved.enemyId;
    }
    // D-188 (CAMPAIGN_STORY_DESIGN.md §5): the capstone's ending is picked by
    // the same choices already recorded above/earlier this playthrough — the
    // 5 spare-or-finish miniboss flags plus Sorrel Thane's resolved fate.
    // Resolved once, here, before GameMap/WaveSystem are constructed below —
    // must run before `showNamelessThroneIntroIfAny` too, but that method
    // re-derives the same pure result from the same (by-then-unwritten-to)
    // `this.worldFlags`, so both stay consistent regardless of order.
    if (this.currentChapter?.id === NAMELESS_THRONE_CAMPAIGN_ID) {
      const variant = resolveThroneVariant(this.worldFlags);
      mapData = withThroneVariant(mapData, variant);
      waveList = withThroneEnemyReskins(waveList, variant);
      this.resolvedThroneVariant = variant;
    }
    if (!campaign && this.freePlayMapId && this.freePlayWaves) {
      mapData = getMapById(this.freePlayMapId);
      waveList = this.freePlayWaves;
    }
    // Phase 11.10 (D-085): a map-builder draft (Playtest) or a fetched shared
    // map takes priority over the by-id free-play lookup above, when both a
    // custom map and a wave list are present — checked last so every earlier
    // path (campaign/campaign-less/free-play) is completely unaffected when
    // this is unset (the common case).
    if (!campaign && this.customMapData && this.freePlayWaves) {
      mapData = this.customMapData;
      waveList = this.freePlayWaves;
    }
    this.currentWaves = waveList;

    this.map = new GameMap(mapData);
    this.movement = new MovementSystem(this.map);
    this.pathfinding = new PathfindingSystem(this.map);
    this.heroAI = new HeroAISystem(this.movement);
    const difficulty = getDifficultyDefinition(this.difficultyId);
    const heroCount = this.heroDefinitions.length;
    this.random = RandomService.seeded();
    this.waveSystem = new WaveSystem(this.map, this.pathfinding, waveList, {
      startingIntegrity: STRONGHOLD_START,
      enemyCountMultiplier: difficulty.enemyCountMultiplier * partySizeScalingFactor(heroCount),
      enemyHpMultiplier: difficulty.enemyHpMultiplier * partySizeScalingFactor(heroCount),
      random: this.random,
    });
    this.economy = new EconomySystem(STARTING_GOLD);
    this.buildSystem = new BuildSystem(this.map, this.pathfinding);
    this.progression = new ProgressionSystem();
    this.restSystem = new RestSystem({
      shortRestCharges: difficulty.shortRestCharges,
      longRestCharges: difficulty.longRestCharges,
    });

    // D-176 (KI-098 item 9): dynamic per-map tile size, mirroring
    // MapBuilderScene's own shrink-to-fit pattern — never touches the global
    // canvas/scale mode (see DECISIONS.md D-172/D-176). GRID_BOTTOM_HUD_RESERVED_PX
    // is the fixed vertical space every HUD row below the grid needs,
    // independent of tile size: roster/status block (78) + combat log (86) +
    // gap (20) + gear/shop grid (4 rows * 38px = 152) + pagination nav row
    // (30, worst case both catalogs paginated) + gap (6) + Done button
    // half-height (15) = 403. Bottom edge = GRID_TOP_MARGIN + rows*tileSize +
    // 403, must stay within GAME_HEIGHT — matches MapBuilderSystem.ts's own
    // MAX_MAP_ROWS derivation exactly. Available width has no HUD margin to
    // subtract (nothing else occupies the grid's horizontal band).
    const GRID_BOTTOM_HUD_RESERVED_PX = 403;
    const availableGridWidth = GAME_WIDTH;
    const availableGridHeight = GAME_HEIGHT - GRID_TOP_MARGIN - GRID_BOTTOM_HUD_RESERVED_PX;
    const tileSize = computeFittedTileSize(
      this.map.cols,
      this.map.rows,
      availableGridWidth,
      availableGridHeight,
      TILE_SIZE,
    );
    const gridPixelWidth = this.map.cols * tileSize;
    const originX = Math.round((GAME_WIDTH - gridPixelWidth) / 2);
    this.grid = new GridSystem(
      this.map.cols,
      this.map.rows,
      tileSize,
      originX,
      GRID_TOP_MARGIN,
    );

    this.cameras.main.setBackgroundColor("#0e0e14");

    this.buildBoard();
    this.buildHeroes();
    this.buildHighlightObjects();
    this.buildHud();
    this.buildPauseMenuButton();
    if (this.testMode) this.buildDebugToolbar();

    this.turns = new TurnSystem();
    this.turns.onChange = (next, prev) => this.onPhaseChange(next, prev);

    this.wireInput();
    // KI-030: start the keyboard cursor on the first hero, and show it
    // immediately, so a mouse-free player has a visible starting point
    // without needing to touch the mouse at all.
    this.cursorPos = this.heroes[0]?.position ?? { x: 0, y: 0 };
    this.updateHoverAt(this.cursorPos);

    // D-185 (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §6): resolves Sorrel
    // Thane's fate once Drowning Vale Chapter 4 loads, reading back
    // Chapters 1-3's own choices. Runs after `buildHud()` (its own flavor
    // line calls `logCombat`, which needs `combatLogText` to already
    // exist) but still before this chapter's own wave 1 begins — safe
    // relative to Saltmere Ch1 ever reading `SORREL_FATE_FLAG_ID`, since
    // regions play in the fixed order the design doc's §3 table lays out
    // (Drowning Vale is region 4, Saltmere is region 5).
    this.resolveSorrelFateIfAny();

    this.waveSystem.startWave(0);
    // Phase 8 ("tutorial prompts"): a one-time how-to-play overlay before the
    // very first player phase, gated the same way a level-up choice gates the
    // next phase transition — advance() only runs once it's dismissed.
    const startBattleTurns = () => {
      if (!hasSeenTutorial(window.localStorage, TUTORIAL_STORAGE_KEY)) {
        this.showTutorial(() => this.turns.advance());
      } else {
        this.turns.advance(); // preparation -> player (wave 1 begins)
      }
    };
    // D-16x: any hero fast-forwarded past a level whose ASI/subclass/
    // spell-pick choice had no explicit plan entry surfaces here as the
    // very first popup(s) of the battle, before wave 1 — never silently
    // defaulted, regardless of that hero's Plan Levels mode.
    // D-177: a chaptered campaign's introText (when written) shows before
    // even the fast-forward choices, so a chapter's own opening beat is
    // always the very first thing the player sees.
    // D-181: the pre-region bonus choice comes right after the chapter
    // intro (if any) and before the fast-forward ASI/subclass/spell-pick
    // prompts — a HOMM3-style "pick 1 of 3" that applies before anything
    // else about the battle is decided.
    this.showChapterIntroIfAny(() =>
      this.showNamelessThroneIntroIfAny(() =>
        this.showSorrelChoiceIfAny(() =>
          this.showRegionBonusChoiceIfAny(() => this.presentPendingFastForwardChoices(startBattleTurns)),
        ),
      ),
    );
  }

  /**
   * D-185 (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §6): Sorrel Thane's own
   * branch-chain choice, shown at the start of Drowning Vale Chapters 1-3
   * only — a no-op (calls `onComplete` immediately) for every other
   * campaign/chapter. Deliberately NOT gated on whether Sorrel is currently
   * an active party hero: she isn't recruited onto the roster until this
   * region's own Chapter 1 clears (`maybeUnlockHomeRegionCompanion`,
   * unchanged), so Chapter 1's own choice is about a field encounter with
   * her before recruitment — gating on party membership would also let
   * benching her mid-region silently cancel her own fate choices, which
   * would be a confusing, unintended side effect.
   */
  private showSorrelChoiceIfAny(onComplete: () => void): void {
    if (this.campaignId !== "drowning-vale" || this.chapterIndex > 2) {
      onComplete();
      return;
    }
    const prompt = SORREL_CHOICE_PROMPTS[this.chapterIndex];
    this.choosingSorrelFateChoice = true;
    this.renderAsiPrompt(
      prompt.title,
      (["support", "press"] as SorrelChoice[]).map((choice) => ({
        label: prompt[choice].label,
        desc: prompt[choice].desc,
        onClick: () => {
          this.clearAsiOverlay();
          this.choosingSorrelFateChoice = false;
          this.worldFlags = recordSorrelChoice(this.worldFlags, this.chapterIndex, choice);
          saveWorldFlags(window.localStorage, WORLD_FLAG_STORAGE_KEY, this.worldFlags);
          onComplete();
        },
      })),
    );
  }

  /**
   * D-185: resolves Sorrel Thane's fate once, at Drowning Vale Chapter 4's
   * own battle-start — no player input needed, just reading back whatever
   * Chapters 1-3 recorded. Runs synchronously alongside the other chapter-
   * load resolution work (same spot `resolveSaltmereCh1Enemy` runs from),
   * not as part of the async prompt chain above. A `"lost"` outcome calls
   * the already-built, idempotent `loseCompanion` — safe to call even if
   * she was benched (not activated) after her Chapter-1 recruit, matching
   * how every other roster mutation in this scene already works.
   */
  private resolveSorrelFateIfAny(): void {
    if (this.campaignId !== "drowning-vale" || this.chapterIndex !== 3) return;
    if (hasWorldFlag(this.worldFlags, SORREL_FATE_FLAG_ID)) return;
    const fate = resolveSorrelFate(this.worldFlags);
    this.worldFlags = setWorldFlag(this.worldFlags, SORREL_FATE_FLAG_ID, fate);
    saveWorldFlags(window.localStorage, WORLD_FLAG_STORAGE_KEY, this.worldFlags);
    if (fate === "lost") {
      this.companionRoster = loseCompanion(this.companionRoster, "sorrel-thane");
      saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, this.companionRoster);
    }
    this.logCombat(SORREL_FATE_FLAVOR_TEXT[fate]);
    // KI-098 item 13 continuation (D-185 addendum close): Redeemed/Marked now
    // carry real mechanical weight, not just the flavor line above.
    if (fate === "redeemed") {
      this.grantSorrelRedeemedReward();
    } else if (fate === "marked") {
      this.economy.award(SORREL_MARKED_GOLD_REWARD);
      this.updateGoldHud();
      this.logCombat(`Sorrel presses something into your hand before she goes quiet again — +${SORREL_MARKED_GOLD_REWARD}g.`);
    }
  }

  /**
   * D-181 (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §8): if this battle
   * belongs to a campaign with a curated bonus pool (`data/regionBonuses.ts`
   * — every real campaign has one), draw 3 at random and let the player
   * pick one before continuing. A no-op (calls `onComplete` immediately)
   * for Free Play, the classic flat campaign, or any campaign id without a
   * pool — never a hard requirement to add one.
   *
   * Deliberately shown at the start of EVERY chapter, not just once per
   * region: this engine treats each chapter as its own fresh, self-
   * contained battle (D-179's own explicit "no cross-chapter continuity"
   * architecture) with no existing per-region "already chose this" state
   * to persist against. Re-offering it each chapter is the interpretation
   * that fits that architecture without inventing new save-state, at the
   * cost of not being a literal one-time "per region" offer per the design
   * doc's own wording — a deliberate, documented first-pass call.
   */
  private showRegionBonusChoiceIfAny(onComplete: () => void): void {
    const pool = this.campaignId ? REGION_BONUS_POOLS[this.campaignId] : undefined;
    if (!pool || pool.length === 0) {
      onComplete();
      return;
    }
    const drawn = drawRegionBonusChoices(pool, this.random, 3);
    this.choosingRegionBonus = true;
    this.renderAsiPrompt(
      "Choose a Bonus",
      drawn.map((option) => ({
        label: option.name,
        desc: option.description,
        onClick: () => {
          this.clearAsiOverlay();
          this.choosingRegionBonus = false;
          this.applyRegionBonus(option);
          onComplete();
        },
      })),
    );
  }

  private applyRegionBonus(option: RegionBonusOption): void {
    switch (option.category) {
      case "gold":
        this.grantRegionBonusGold(option.goldAmount!);
        return;
      case "xp":
        this.grantRegionBonusXp(option.bonusHealth!);
        return;
      case "equipment":
        this.grantRegionBonusEquipment(option.equipmentId!);
        return;
      case "structure":
        this.grantRegionBonusStructure(option.structureId!);
        return;
    }
  }

  private grantRegionBonusGold(amount: number): void {
    this.economy.award(amount);
    this.updateGoldHud();
    this.logCombat(`Region bonus: +${amount} starting gold!`);
  }

  private grantRegionBonusXp(amount: number): void {
    for (const hero of this.heroes) {
      if (hero.isAlive()) hero.grantBonusHealth(amount);
    }
    this.logCombat(`Region bonus: +${amount} max HP for every hero!`);
  }

  /**
   * Same shape as `grantLootDrop`'s equipment branch (first living hero
   * with a matching empty slot that isn't attunement/grip-blocked; sold
   * for gold if nobody has room) — shared by the region-bonus equipment
   * category and Sorrel's Redeemed reward (`grantSorrelRedeemedReward`
   * below). `sourceLabel` only changes the combat-log prefix.
   */
  private grantEquipmentOrSellForGold(itemId: string, sourceLabel: string): void {
    const def = getEquipmentDefinition(itemId);
    for (const hero of this.heroes) {
      if (!hero.isAlive()) continue;
      const slot = GEAR_SLOT_IDS.find((s) => gearSlotType(s) === def.slot && !hero.equippedItems[s]);
      if (!slot) continue;
      if (hero.wouldExceedAttunementLimit(itemId, slot)) continue;
      if (hero.wouldConflictWithGrip(itemId, slot)) continue;
      hero.equippedItems[slot] = itemId;
      this.ensureHeroCape(hero);
      hero.onGearChanged();
      this.logCombat(`${sourceLabel}: ${hero.name} starts equipped with ${def.name}!`);
      this.updateGoldHud();
      return;
    }
    this.economy.award(def.cost);
    this.logCombat(`${sourceLabel} (${def.name}) — no hero has room to equip it, sold for ${def.cost}g instead.`);
    this.updateGoldHud();
  }

  private grantRegionBonusEquipment(itemId: string): void {
    this.grantEquipmentOrSellForGold(itemId, "Region bonus");
  }

  /** KI-098 item 13 continuation (D-185 addendum close): Sorrel's Redeemed reward, same mechanism as a region-bonus equipment grant. */
  private grantSorrelRedeemedReward(): void {
    this.grantEquipmentOrSellForGold(SORREL_REDEEMED_REWARD_EQUIPMENT_ID, "Sorrel's gratitude");
  }

  /**
   * Places a free structure on the first valid buildable tile found
   * (reusing `BuildSystem.canPlace`/`place`'s own validation — buildable,
   * unoccupied, not a spawn/exit, doesn't seal off a wall's only route —
   * rather than trusting a hardcoded position), near the party's own
   * starting positions. Silently does nothing on the (practically
   * unreachable, every map has open floor near a hero start) case where no
   * tile validates, matching this project's degrade-gracefully convention.
   */
  private grantRegionBonusStructure(structureId: string): void {
    const heroPositions = this.heroes.filter((h) => h.isAlive()).map((h) => h.position);
    for (let y = 0; y < this.map.rows; y++) {
      for (let x = 0; x < this.map.cols; x++) {
        const pos = { x, y };
        if (!this.buildSystem.canPlace(structureId, pos, undefined, heroPositions).ok) continue;
        const result = this.buildSystem.place(structureId, pos, undefined, heroPositions);
        if (result.ok && result.structure) {
          this.renderStructure(result.structure);
          this.logCombat(`Region bonus: a free ${getStructureDefinition(structureId).name} is already on the field!`);
        }
        return;
      }
    }
  }

  private presentPendingFastForwardChoices(onDone: () => void): void {
    const asi = this.pendingFastForwardAsi;
    const subclass = this.pendingFastForwardSubclass;
    const spellPicks = this.pendingFastForwardSpellPicks;
    this.pendingFastForwardAsi = [];
    this.pendingFastForwardSubclass = [];
    this.pendingFastForwardSpellPicks = [];

    const afterSpellPicks = onDone;
    const afterAsi = () => (spellPicks.length > 0 ? this.showSpellPickChoiceQueue(spellPicks, afterSpellPicks) : afterSpellPicks());
    const afterSubclass = () => (asi.length > 0 ? this.showAsiChoiceQueue(asi, afterAsi) : afterAsi());
    if (subclass.length > 0) this.showSubclassChoiceQueue(subclass, afterSubclass);
    else afterSubclass();
  }

  // ----- Board -----------------------------------------------------------

  private buildBoard(): void {
    this.tileRects.clear();
    this.pitGlyphs.clear();
    for (let y = 0; y < this.map.rows; y++) {
      for (let x = 0; x < this.map.cols; x++) {
        const pos = { x, y };
        const tl = this.grid.tileToWorldTopLeft(pos);
        const type = this.map.getTileType(pos) ?? "floor";
        const rect = this.add
          .rectangle(tl.x + this.grid.tileSize / 2, tl.y + this.grid.tileSize / 2, this.grid.tileSize, this.grid.tileSize, BOARD_TERRAIN_COLORS[type], 1)
          .setDepth(0);
        this.tileRects.set(`${x},${y}`, rect);
        if (type === "pit") {
          const glyph = this.add
            .text(tl.x + this.grid.tileSize / 2, tl.y + this.grid.tileSize / 2, "✕", {
              fontFamily: "system-ui, Arial, sans-serif",
              fontSize: "20px",
              color: "#6a3a3a",
            })
            .setOrigin(0.5)
            .setDepth(1);
          this.pitGlyphs.set(`${x},${y}`, glyph);
        }
      }
    }

    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, COLORS.gridLine, 1);
    const ox = this.grid.originX;
    const oy = this.grid.originY;
    for (let col = 0; col <= this.map.cols; col++) {
      const x = ox + col * this.grid.tileSize;
      g.lineBetween(x, oy, x, oy + this.map.rows * this.grid.tileSize);
    }
    for (let row = 0; row <= this.map.rows; row++) {
      const y = oy + row * this.grid.tileSize;
      g.lineBetween(ox, y, ox + this.map.cols * this.grid.tileSize, y);
    }

    for (const pos of this.map.data.spawns) this.drawMarker(pos, "IN", COLORS.spawn);
    for (const pos of this.map.data.exits) this.drawMarker(pos, "OUT", COLORS.exit);
  }

  /**
   * Phase 23 (D-114): fire any dynamic terrain events due at the wave just
   * entered, and log a one-time warning for any whose window just opened.
   * Called once per `betweenWave` transition, right after the wave number
   * advances — no-op for the vast majority of maps, which set no events.
   */
  private tickDynamicTerrain(): void {
    const events = this.map.data.dynamicTerrainEvents;
    if (!events || events.length === 0) return;
    const wave = this.waveSystem.waveNumber;

    for (const { event } of DynamicTerrainSystem.newWarningsAt(events, wave, this.firedDynamicTerrainEvents)) {
      this.logCombat(`⚠ ${event.label} — coming at Wave ${event.atWave}`);
    }

    for (const { index, event } of DynamicTerrainSystem.dueEvents(events, wave, this.firedDynamicTerrainEvents)) {
      // Mutate the SAME GameMap instance in place (see `GameMap.setTiles`'s
      // doc comment) rather than swapping `this.map` for a new one — every
      // other system holds its own reference to this exact object.
      this.map.setTiles(DynamicTerrainSystem.applyEvent(this.map.data, event).tiles);
      this.firedDynamicTerrainEvents.add(index);
      this.logCombat(event.label);
      for (const pos of event.positions) {
        const rect = this.tileRects.get(`${pos.x},${pos.y}`);
        if (rect) rect.setFillStyle(BOARD_TERRAIN_COLORS[event.toTileType], 1);
        if (event.toTileType === "pit") {
          const tl = this.grid.tileToWorldTopLeft(pos);
          this.add
            .text(tl.x + this.grid.tileSize / 2, tl.y + this.grid.tileSize / 2, "✕", {
              fontFamily: "system-ui, Arial, sans-serif",
              fontSize: "20px",
              color: "#6a3a3a",
            })
            .setOrigin(0.5)
            .setDepth(1);
        }
      }
    }
  }

  private drawMarker(pos: GridPosition, label: string, color: number): void {
    const tl = this.grid.tileToWorldTopLeft(pos);
    this.add
      .rectangle(tl.x + this.grid.tileSize / 2, tl.y + this.grid.tileSize / 2, this.grid.tileSize - 6, this.grid.tileSize - 6, color, 0.5)
      .setStrokeStyle(2, color)
      .setDepth(3);
    this.add
      .text(tl.x + this.grid.tileSize / 2, tl.y + this.grid.tileSize / 2, label, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "15px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  /**
   * Phase 22 (magic-item expansion): Phaser's own per-frame lifecycle hook —
   * this scene's first use of it. Redraws every active hero cape (Cape of
   * Billowing) each frame so it stays glued to its wearer's CURRENT token
   * position without needing to hook every hero-movement call site
   * individually (there are several: AI turns, human move confirmation,
   * teleports) — the same reason a hero's on-token status badge doesn't
   * tween-follow movement today (a known, pre-existing gap, not one this
   * phase introduces).
   */
  update(time: number): void {
    this.updateHeroCapes(time);
  }

  /**
   * Phase 22: create or destroy a hero's cape graphic to match whether it
   * currently has a `visualEffect: "flowingCape"` item equipped anywhere
   * (today, only the "back" slot's Cape of Billowing) — idempotent, safe to
   * call after every equip/unequip and at hero creation.
   */
  private ensureHeroCape(hero: Hero): void {
    const hasFlowingCape = GEAR_SLOT_IDS.some((slot) => {
      const itemId = hero.equippedItems[slot];
      return itemId ? getEquipmentDefinition(itemId).visualEffect === "flowingCape" : false;
    });
    const existing = this.heroCapes.get(hero.id);
    if (hasFlowingCape && !existing) {
      this.heroCapes.set(hero.id, this.add.graphics().setDepth(9));
    } else if (!hasFlowingCape && existing) {
      existing.destroy();
      this.heroCapes.delete(hero.id);
    }
  }

  /** Phase 22: redraw every active hero cape as a wavy shape trailing its wearer's token, animated with a sine-wave flutter. */
  private updateHeroCapes(time: number): void {
    for (const [heroId, graphic] of this.heroCapes) {
      const token = this.heroTokens.get(heroId);
      if (!token) continue;
      const cx = token.circle.x;
      const cy = token.circle.y;
      const flutter = Math.sin(time / 180 + cx) * 5;
      const r = this.grid.tileSize * 0.34;
      graphic.clear();
      graphic.fillStyle(COLORS.capeBillowingPlaceholder, 0.85);
      graphic.beginPath();
      graphic.moveTo(cx - r * 0.6, cy - r * 0.2);
      graphic.lineTo(cx + r * 0.6, cy - r * 0.2);
      graphic.lineTo(cx + r * 0.9 + flutter, cy + r * 1.3);
      graphic.lineTo(cx - r * 0.9 + flutter * 0.6, cy + r * 1.1);
      graphic.closePath();
      graphic.fillPath();
    }
  }

  private buildHeroes(): void {
    const starts = this.map.data.heroStarts;
    const baseDefinitions = this.heroDefinitions;
    this.heroLevelUpPlans = new Map(
      baseDefinitions.filter((def) => def.levelUpPlan).map((def) => [def.id, def.levelUpPlan as LevelUpPlan]),
    );
    // Phase 12.3 (D-103): a coop battle overrides `controlledBy` per hero,
    // from the session's `heroOwners` — "human" for whichever heroes THIS
    // client's uid owns, "remote" for the partner's (never "ai": coop v1
    // assigns every hero in the party to one of the two participants).
    const definitions = this.coopSession
      ? baseDefinitions.map((def) => ({
          ...def,
          controlledBy: (canActOnHero(this.coopSession!.heroOwners, def.id, this.coopSession!.localUid)
            ? "human"
            : "remote") as HeroDefinition["controlledBy"],
        }))
      : baseDefinitions;
    definitions.forEach((def, i) => {
      const start = starts[i] ?? starts[0];
      const hero = new Hero(def, start);
      if (def.startingLevel && def.startingLevel > 1) {
        // D-16x: whatever the fast-forward couldn't resolve from an
        // explicit plan entry gets queued, not silently defaulted — see
        // `presentPendingFastForwardChoices`, fired once from `create()`.
        for (const step of this.fastForwardHeroToLevel(hero, def.startingLevel)) {
          if (step.kind === "asi") this.pendingFastForwardAsi.push({ hero, level: step.level });
          else if (step.kind === "subclass") this.pendingFastForwardSubclass.push(hero);
          else this.pendingFastForwardSpellPicks.push({ hero, kind: step.spellPickKind!, tier: step.tier });
        }
      }
      // D-135: a Character Creation manual spell pick is a wholesale
      // override of whatever `growSpellSelections()`'s auto-fill produced
      // during construction/fast-forward above — applied once, here, after
      // the hero's level is already final. Spellbook first so a Wizard's
      // subsequent `preparedSpellIds` (drawn from the picker's own spellbook
      // step) lines up with `growSpellSelections`'s own pool choice, even
      // though neither setter actually reads the other's state.
      if (def.spellbookIds) hero.chooseSpellbook(def.spellbookIds);
      if (def.knownCantripIds) hero.chooseCantrips(def.knownCantripIds);
      if (def.preparedSpellIds) hero.choosePreparedSpells(def.preparedSpellIds);
      if (def.actionHotkeys) hero.setActionHotkeys(def.actionHotkeys);
      this.heroes.push(hero);
      const c = this.grid.tileToWorldCenter(start);
      const color = COLORS.hero;
      const circle = this.add.circle(c.x, c.y, this.grid.tileSize * 0.34, color).setDepth(10);
      const label = this.add
        .text(c.x, c.y - 4, def.name[0], {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "22px",
          color: "#0e0e14",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(10);
      const hp = this.add
        .text(c.x, c.y + this.grid.tileSize * 0.22, "", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#0e0e14",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(11);
      const sprite = this.createTokenSprite(def.assetKey, circle, 10);
      const token: Token = { circle, label, hp, sprite };
      this.heroTokens.set(def.id, token);
      this.updateHpText(token, hero.health, hero.effectiveMaxHealth);
      // Phase 21 (D-112): a hero can now carry enemy-inflicted statuses too
      // (e.g. "poisoned", "silenced") — same on-token badge shape as
      // `enemyStatusBadges` (KI-027), just on the hero side.
      const badge = this.add
        .text(c.x, c.y - this.grid.tileSize * 0.34 - 14, "", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#0e0e14",
          backgroundColor: "#f0e070",
          padding: { left: 4, right: 4, top: 1, bottom: 1 },
        })
        .setOrigin(0.5)
        .setDepth(11)
        .setVisible(false);
      this.heroStatusBadges.set(def.id, badge);
      // Phase 22 (magic-item expansion): a hero created with a free starting
      // Cape of Billowing (Phase 13.11's "every common/uncommon item is a
      // free starting-gear option" rule) already has its cape flying before
      // its first turn.
      this.ensureHeroCape(hero);
      // D-127: same rule can start a hero with a charge-based item already
      // equipped (Wand of Magic Missile/Web are uncommon) — initialize its
      // charge pool before its first turn, same as the cape above.
      hero.onGearChanged();
    });
  }

  /**
   * D-129: pre-battle level fast-forward, for Free Play/New Game's new
   * per-hero/team "Starting Level" control. D-133: the actual level-by-level
   * walk and choice-trigger resolution lives in
   * `LevelUpPlanSystem.fastForwardHero` (shared with that system's own
   * `simulateHeroForPlanning`, used by the Character Creation planner UI) —
   * this hero's plan (if any) resolves each trigger explicitly covered by
   * it. D-16x: anything NOT covered is no longer silently defaulted — it's
   * returned here so `buildHeroes()` can queue it as a real prompt,
   * presented right before wave 1 (see `presentPendingFastForwardChoices`).
   */
  private fastForwardHeroToLevel(hero: Hero, targetLevel: number): LevelUpChoiceStep[] {
    return fastForwardHero(hero, targetLevel, this.heroLevelUpPlans.get(hero.id));
  }

  private buildHighlightObjects(): void {
    this.activeRing = this.add
      .circle(0, 0, this.grid.tileSize * 0.44)
      .setStrokeStyle(3, COLORS.heroActive)
      .setDepth(6)
      .setVisible(false);
    this.hoverRect = this.add
      .rectangle(0, 0, this.grid.tileSize, this.grid.tileSize, COLORS.tileHover, 0.35)
      .setDepth(5)
      .setVisible(false);
    this.pendingRect = this.add
      .rectangle(0, 0, this.grid.tileSize, this.grid.tileSize, COLORS.moveConfirm, 0.35)
      .setStrokeStyle(3, COLORS.moveConfirm)
      .setDepth(6)
      .setVisible(false);
    // D-132/D-148: the shared tooltip controller — depth 200 (see tooltip.ts),
    // above every token/badge/highlight, so it's never obscured by whatever
    // it's floating over.
    this.tooltip = createTooltipController(this);
  }

  // ----- HUD -------------------------------------------------------------

  private buildHud(): void {
    this.add
      .text(GAME_WIDTH / 2, 16, "FANTASY TOWER DEFENSE", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.bannerText = this.add
      .text(GAME_WIDTH / 2, 42, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "20px",
        color: "#9be0b4",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.integrityText = this.add
      .text(this.grid.originX, 12, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#e8c06a",
        fontStyle: "bold",
      })
      .setDepth(30);

    // A short "recent phases" debug log — kept to the last 3 entries and given
    // its own row well clear of the centered banner above, so long histories
    // can never run into it (playtest fix: this used to sit right under the
    // banner and could visually collide with it).
    this.logText = this.add
      .text(this.grid.originX, 56, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#6a6a80",
      })
      .setDepth(30);

    // D-158 (KI-034 redesign): the live enemy count, previously baked into
    // the old packed status line — moved up here next to Integrity/Gold
    // rather than given a whole new HUD row.
    this.enemyCountText = this.add
      .text(this.grid.originX, 74, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#9a9ab0",
      })
      .setDepth(30);

    // Phase 7 ("improved wave preview"): a small centered line naming the NEXT
    // wave's composition, so the player can plan a build before it starts.
    // Sits directly under the banner, comfortably clear of the grid below (see
    // the GRID_TOP_MARGIN/GAME_HEIGHT comments in config.ts for the math).
    this.previewText = this.add
      .text(GAME_WIDTH / 2, 68, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#8aa0c0",
      })
      .setOrigin(0.5, 0)
      .setDepth(30);

    // Anchored to a fixed right-hand margin (NOT the grid's originX) so this
    // button — and Build, to its left — stay clear of the centered title and
    // banner regardless of the grid's width. Playtest fix: previously these
    // were positioned relative to the (narrower) grid width and could overlap
    // the longest banner text ("Wave 5 / 5 · Between Waves").
    const rightMargin = 24;
    const bx = GAME_WIDTH - rightMargin - 90;
    this.endTurnButton = this.add
      .rectangle(bx, 34, 180, 44, 0x3a5a8a)
      .setInteractive({ useHandCursor: true })
      .setDepth(30);
    this.endTurnLabel = this.add
      .text(bx, 34, "End Turn (E)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.endTurnButton.on("pointerover", () => this.endTurnButton.setFillStyle(0x4a6a9a));
    this.endTurnButton.on("pointerout", () => this.endTurnButton.setFillStyle(0x3a5a8a));
    this.endTurnButton.on("pointerdown", () => this.endPlayerTurn());

    // ----- Below the grid: hero roster strip, then a small message line,
    // then the combat log, then the action buttons — STACKED vertically,
    // each with reserved room, rather than status-left / log-right on the
    // same row.
    //
    // Playtest fix (pre-D-158 history): `wrapWidth` used to be
    // `this.map.cols * TILE_SIZE` — the GRID's own pixel width, not the
    // canvas's. On a narrow map (Frostbound Hollow's 14 cols, or any Map
    // Builder map down to 6) that squeezed a full 4-hero party's status into
    // far fewer characters per line than the reserved height assumed,
    // wrapping into `combatLogText` directly below it. Nothing else shares
    // this row horizontally, so there's no reason to tie the wrap width to
    // the grid at all — using the canvas's own width instead (minus a
    // margin) gives every map the same generous line length regardless of
    // how narrow its grid is.
    const belowGridY = this.grid.originY + this.map.rows * this.grid.tileSize + 16;
    const wrapWidth = GAME_WIDTH - 80;

    // D-158 (KI-034 redesign): `MAX_ROSTER_SLOTS` per-hero boxes, real
    // widgets instead of one packed text line — see the roster-slot fields'
    // own doc comment. Built at a placeholder position/size here;
    // `layoutHeroSlots()` (called once at the end of this method, after
    // `this.heroes` already exists — `buildHeroes()` runs before
    // `buildHud()`) positions exactly `this.heroes.length` of them via
    // `centeredRowX` and hides the rest, since party size (1-4) never
    // changes mid-battle.
    const rosterBoxWidth = 272;
    const rosterBoxHeight = 56;
    const rosterY = belowGridY + rosterBoxHeight / 2;
    for (let slot = 0; slot < MAX_ROSTER_SLOTS; slot++) {
      const box = this.add
        .rectangle(0, rosterY, rosterBoxWidth, rosterBoxHeight, 0x1a1a26, 0.9)
        .setStrokeStyle(2, 0x3a3a4a)
        .setDepth(30)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
      // D-165 (KI-098 item 3): a real click target — selects this hero
      // normally, or targets it directly with equip mode's currently
      // selected item (see `onRosterBoxClick`).
      box.on("pointerdown", () => this.onRosterBoxClick(slot));
      box.on("pointerover", () => this.showRosterHoverTooltip(slot));
      box.on("pointerout", () => this.tooltip.hide());
      const nameText = this.add
        .text(0, rosterY - 18, "", {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(31)
        .setVisible(false);
      const hpBarBg = this.add
        .rectangle(0, rosterY + 2, 230, 10, 0x2a2a3a)
        .setOrigin(0, 0.5)
        .setDepth(31)
        .setVisible(false);
      const hpBarFg = this.add
        .rectangle(0, rosterY + 2, 230, 10, COLORS.hero)
        .setOrigin(0, 0.5)
        .setDepth(32)
        .setVisible(false);
      const hpText = this.add
        .text(0, rosterY + 2, "", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#0e0e14",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(33)
        .setVisible(false);
      const detailText = this.add
        .text(0, rosterY + 20, "", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#9a9ab0",
        })
        .setOrigin(0.5)
        .setDepth(31)
        .setVisible(false);
      this.heroSlotBoxes.push(box);
      this.heroSlotNameText.push(nameText);
      this.heroSlotHpBarBg.push(hpBarBg);
      this.heroSlotHpBarFg.push(hpBarFg);
      this.heroSlotHpText.push(hpText);
      this.heroSlotDetailText.push(detailText);
    }

    // D-158: the small remainder of the old packed status line that wasn't
    // redundant with an already-visible button/highlight — see this field's
    // own doc comment.
    const messageY = rosterY + rosterBoxHeight / 2 + 6;
    this.messageText = this.add
      .text(GAME_WIDTH / 2, messageY, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#9a9ab0",
        align: "center",
        wordWrap: { width: wrapWidth },
      })
      .setOrigin(0.5, 0)
      .setDepth(30);
    // Roster boxes + the message line's own reserved room — same
    // bounding-box discipline as every other HUD change in this file (see
    // the Frostbound-Hollow-9-rows comments elsewhere in this method):
    // rosterBoxHeight (56) + a 6px gap + ~16px for one short message line.
    const statusBlockHeight = rosterBoxHeight + 6 + 16;

    this.combatLogText = this.add
      .text(GAME_WIDTH / 2, belowGridY + statusBlockHeight, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#c0a0a0",
        align: "center",
        // Playtest fix: this had no wordWrap at all — a single long combat-log
        // line (a multi-clause weapon-mastery/spell/status message) could
        // render wider than the 1280px canvas and clip off both edges.
        wordWrap: { width: wrapWidth },
      })
      .setOrigin(0.5, 0)
      .setDepth(30);
    const logBlockHeight = 86; // reserves the actual 5-line cap (see logCombat)

    const cy = belowGridY + statusBlockHeight + logBlockHeight + 20;
    this.confirmButton = this.add
      .rectangle(GAME_WIDTH / 2 - 150, cy, 150, 32, 0x4caf72)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.confirmLabel = this.add
      .text(GAME_WIDTH / 2 - 150, cy, "Confirm (Enter)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "15px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.cancelButton = this.add
      .rectangle(GAME_WIDTH / 2, cy, 150, 32, 0x7a3a3a)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.cancelLabel = this.add
      .text(GAME_WIDTH / 2, cy, "Cancel (Esc)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "15px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.confirmButton.on("pointerdown", () => this.confirmMove());
    this.cancelButton.on("pointerdown", () => this.cancelMove());

    // Ability button: visible when a hero that can still act is selected.
    this.abilityButton = this.add
      .rectangle(GAME_WIDTH / 2 + 150, cy, 190, 32, 0x6a4a8a)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.abilityLabel = this.add
      .text(GAME_WIDTH / 2 + 150, cy, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#f0e8ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.abilityButton.on("pointerdown", () => this.onAbilityButton());

    // Potion button (Phase 11.5, D-078): visible when a hero that can still
    // act carries at least one potion. Placed to the right of Ability with
    // the same gap discipline as every other button row in this HUD.
    this.potionButton = this.add
      .rectangle(GAME_WIDTH / 2 + 360, cy, 150, 32, 0x4a6a4a)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.potionLabel = this.add
      .text(GAME_WIDTH / 2 + 360, cy, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#e8ffe8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.potionButton.on("pointerdown", () => this.onPotionButton());

    // Bonus Action / Action Surge buttons (Phase 13.2, D-087): a new row
    // BELOW the Confirm/Cancel/Ability/Potion row above, not to its right —
    // there's no horizontal room left in the 1280px canvas past Potion's
    // right edge. Only ever visible together with Ability/Potion (all four
    // gated on "heroSelected"), never with Confirm/Cancel or the Build/Gear
    // item grid (mutually exclusive UI states — the same space-sharing trick
    // already used for the row above, see its own comment).
    const cy2 = cy + 40;
    this.bonusActionButton = this.add
      .rectangle(GAME_WIDTH / 2 + 150, cy2, 190, 32, 0x8a6a3a)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.bonusActionLabel = this.add
      .text(GAME_WIDTH / 2 + 150, cy2, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#fff0e0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.bonusActionButton.on("pointerdown", () => this.onBonusActionButton());

    this.actionSurgeButton = this.add
      .rectangle(GAME_WIDTH / 2 + 360, cy2, 150, 32, 0xb04a4a)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.actionSurgeLabel = this.add
      .text(GAME_WIDTH / 2 + 360, cy2, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#ffe8e8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.actionSurgeButton.on("pointerdown", () => this.onActionSurgeButton());

    // D-125: a third row below Bonus Action/Action Surge — no horizontal
    // room left on their row (Action Surge already reaches close to the
    // canvas's right edge at 1280px), so this reuses the same "add a new
    // row" precedent that produced the Bonus Action/Action Surge row itself.
    const cy3 = cy2 + 40;
    this.classActionButton = this.add
      .rectangle(GAME_WIDTH / 2 + 150, cy3, 260, 32, 0x4a6a8a)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.classActionLabel = this.add
      .text(GAME_WIDTH / 2 + 150, cy3, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#e0f0ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.classActionButton.on("pointerdown", () => this.onClassActionButton());

    // D-148: same row as Class Action, to its right — plenty of horizontal
    // room left before the 1280px canvas edge (classActionButton's own
    // right edge sits at x=920).
    this.characterSheetButton = this.add
      .rectangle(GAME_WIDTH / 2 + 460, cy3, 170, 32, 0x6a5a3a)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.characterSheetLabel = this.add
      .text(GAME_WIDTH / 2 + 460, cy3, "Character (C)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#f0e8d0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.characterSheetButton.on("pointerdown", () => this.openCharacterSheet());

    // D-165 (KI-098 item 2): the pinned hotkey bar — a 4th row below Class
    // Action/Character, same "add a new row, no horizontal room left"
    // precedent as every row above it. `showHotkeyButtonsFor` hides an
    // empty slot entirely and dims (but keeps clickable-looking) one whose
    // id isn't currently usable — a pinned-but-not-castable spell is a
    // normal state (see `Hero.setActionHotkey`), not an error.
    const cy4 = cy3 + 40;
    const { xs: hotkeyXs, itemWidth: hotkeyWidth } = centeredRowX(ACTION_HOTKEY_SLOT_COUNT, 80, 8, GAME_WIDTH / 2 + 283, 525);
    for (let slot = 0; slot < ACTION_HOTKEY_SLOT_COUNT; slot++) {
      const x = hotkeyXs[slot];
      const button = this.add
        .rectangle(x, cy4, hotkeyWidth, 28, 0x5a4a7a)
        .setInteractive({ useHandCursor: true })
        .setDepth(31)
        .setVisible(false);
      const label = this.add
        .text(x, cy4, "", {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "11px",
          color: "#f0e8ff",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: hotkeyWidth - 8 },
        })
        .setOrigin(0.5)
        .setDepth(32)
        .setVisible(false);
      button.on("pointerdown", () => this.triggerHotkey(slot));
      attachHoverTooltip(this.tooltip, button, x, cy4 - 20, () => this.hotkeyTooltipText(slot));
      this.hotkeyButtons.push(button);
      this.hotkeyLabels.push(label);
    }

    this.buildShopHud(cy);
    // `buildHeroes()` runs before `buildHud()` (see `create()`), so
    // `this.heroes` is already final — safe to position the roster strip
    // for the real party size right here, once.
    this.layoutHeroSlots();
  }

  /**
   * D-158: positions exactly `this.heroes.length` roster-strip slots (see
   * the roster-slot fields' own doc comment), centered via `centeredRowX`
   * the same way every other variable-count centered row in this codebase
   * does, and hides any slot beyond the real party size (1-4). Called once,
   * from the end of `buildHud()` — party size never changes mid-battle, so
   * `refreshStatus()` only ever updates content, never repositions.
   */
  private layoutHeroSlots(): void {
    const rosterBoxWidth = 272;
    const gap = 16;
    const count = this.heroes.length;
    const { xs } = centeredRowX(count, rosterBoxWidth, gap, GAME_WIDTH / 2, GAME_WIDTH - 80);
    for (let slot = 0; slot < MAX_ROSTER_SLOTS; slot++) {
      const inPlay = slot < count;
      this.heroSlotBoxes[slot].setVisible(inPlay);
      this.heroSlotNameText[slot].setVisible(inPlay);
      this.heroSlotHpBarBg[slot].setVisible(inPlay);
      this.heroSlotHpBarFg[slot].setVisible(inPlay);
      this.heroSlotHpText[slot].setVisible(inPlay);
      this.heroSlotDetailText[slot].setVisible(inPlay);
      if (!inPlay) continue;
      const cx = xs[slot];
      this.heroSlotBoxes[slot].setPosition(cx, this.heroSlotBoxes[slot].y);
      this.heroSlotNameText[slot].setPosition(cx, this.heroSlotNameText[slot].y);
      // HP bar rectangles use setOrigin(0, 0.5) (left-anchored, so the
      // filled portion shrinks from the right as health drops) — their `x`
      // is the bar's LEFT edge, not its center, unlike every other roster
      // widget here.
      const barLeftX = cx - this.heroSlotHpBarBg[slot].width / 2;
      this.heroSlotHpBarBg[slot].setPosition(barLeftX, this.heroSlotHpBarBg[slot].y);
      this.heroSlotHpBarFg[slot].setPosition(barLeftX, this.heroSlotHpBarFg[slot].y);
      this.heroSlotHpText[slot].setPosition(cx, this.heroSlotHpText[slot].y);
      this.heroSlotDetailText[slot].setPosition(cx, this.heroSlotDetailText[slot].y);
    }
  }

  // ----- Shop / build HUD (Phase 5, relaid out in Phase 7) ---------------

  private buildShopHud(cy: number): void {
    // Gold counter, top-left — stacked between Integrity (y=12) and the
    // phase-order log (y=56) with clear gaps on both sides.
    this.goldText = this.add
      .text(this.grid.originX, 32, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f0c850",
        fontStyle: "bold",
      })
      .setDepth(30);

    // "Build" and "Gear" toggles, top strip left of End Turn (fixed gaps
    // between all three, all anchored to the canvas edge — see the End Turn
    // button's comment above).
    const rightMargin = 24;
    const gapBetweenButtons = 20;
    const endTurnLeftEdge = GAME_WIDTH - rightMargin - 180;
    const bbx = endTurnLeftEdge - gapBetweenButtons - 75;
    this.buildButton = this.add
      .rectangle(bbx, 34, 150, 44, 0x5a6a3a)
      .setInteractive({ useHandCursor: true })
      .setDepth(30);
    this.buildLabel = this.add
      .text(bbx, 34, "Build (B)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.buildButton.on("pointerover", () => this.buildButton.setFillStyle(0x6a7a4a));
    this.buildButton.on("pointerout", () => this.buildButton.setFillStyle(0x5a6a3a));
    this.buildButton.on("pointerdown", () => this.toggleBuildMode());

    // Phase 8 playtest fix: this used to be `bbx - gapBetweenButtons - 75`,
    // which re-subtracted Build's own half-width against Build's CENTER
    // (bbx) instead of its left edge, landing Gear 55px too far right and
    // overlapping Build. Build's left edge is `bbx - 75`; step the same gap
    // and half-width past THAT to get Gear's center.
    const gbx = bbx - 75 - gapBetweenButtons - 75;
    // KI-033: the banner (centered on GAME_WIDTH/2) and this button (anchored
    // to the right margin) are positioned independently, so a wide banner
    // string ("Wave 10 / 10  ·  Between Waves") can reach right up to (or
    // past) Gear's left edge. Rather than guess a padding number, record the
    // real safe half-width here and have fitBannerToWidth() shrink the
    // banner's font, using its ACTUAL measured width, to whatever fits —
    // correct regardless of font metrics or future label-text changes.
    const gearLeftEdge = gbx - 75;
    const bannerSafetyGap = 12;
    this.bannerMaxWidth = 2 * (gearLeftEdge - GAME_WIDTH / 2 - bannerSafetyGap);
    this.equipButton = this.add
      .rectangle(gbx, 34, 150, 44, 0x5a3a6a)
      .setInteractive({ useHandCursor: true })
      .setDepth(30);
    this.equipLabel = this.add
      .text(gbx, 34, "Gear (G)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.equipButton.on("pointerover", () => this.equipButton.setFillStyle(0x6a4a7a));
    this.equipButton.on("pointerout", () => this.equipButton.setFillStyle(0x5a3a6a));
    this.equipButton.on("pointerdown", () => this.toggleEquipMode());

    // Ghost preview rectangle for the tile under the cursor while building.
    this.buildGhost = this.add
      .rectangle(0, 0, this.grid.tileSize - 6, this.grid.tileSize - 6, COLORS.buildValid, 0.35)
      .setStrokeStyle(3, COLORS.buildValid)
      .setDepth(7)
      .setVisible(false);
    this.buildGhostGlyph = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(7)
      .setVisible(false);

    // Shop buttons (one per buildable structure) and the equip catalogue share
    // the SAME grid area below the bottom row — never at the same time, since
    // build mode and equip mode are mutually exclusive (setInteraction hides
    // whichever one isn't active). Phase 7 grew the shop from 3 items to 7, so
    // a single row of fixed slots (the Phase 5 layout) no longer fits; this is
    // a small, generic grid instead, verified by the same bounding-box math as
    // D-046 (see the GAME_HEIGHT comment in config.ts for the room it needs).
    // Phase 25 (D-116): the shop catalogue passed the one-page limit, so it
    // now paginates via `ITEM_GRID_PAGE_SIZE` exactly like the Gear grid does.
    const shopItems = SHOP_ORDER.map((defId) => ({
      id: defId,
      label: `${getStructureDefinition(defId).name} (${getStructureDefinition(defId).cost}g)`,
    }));
    const shop = this.buildItemGrid(
      cy,
      shopItems,
      (id) => this.selectShopItem(id),
      (id) => this.setHoveredItem(id),
      ITEM_GRID_PAGE_SIZE,
    );
    this.shopButtons = shop.buttons;
    this.shopLabels = shop.labels;

    const equipItems = this.visibleGearCatalog().map((itemId) => ({
      id: itemId,
      label: gearCatalogButtonLabel(itemId),
    }));
    const equip = this.buildItemGrid(
      cy,
      equipItems,
      (id) => this.selectEquipItem(id),
      (id) => this.setHoveredItem(id),
      ITEM_GRID_PAGE_SIZE,
    );
    this.equipItemButtons = equip.buttons;
    this.equipItemLabels = equip.labels;

    // Test Mode (D-138): three more grids sharing this exact same footprint —
    // never shown at the same time as each other, Shop, or Gear (all mutually
    // exclusive via `this.ui.kind`). Only ever built; only ever SHOWN when
    // `this.testMode`.
    const debugEnemyItems = DEBUG_ENEMY_IDS.map((id) => ({ id, label: getEnemyDefinition(id).name }));
    const debugEnemy = this.buildItemGrid(
      cy,
      debugEnemyItems,
      (id) => this.selectDebugEnemy(id),
      undefined,
      ITEM_GRID_PAGE_SIZE,
    );
    this.debugEnemyButtons = debugEnemy.buttons;
    this.debugEnemyLabels = debugEnemy.labels;

    const debugTerrainItems = DEBUG_TERRAIN_TYPES.map((type) => ({ id: type, label: type }));
    const debugTerrain = this.buildItemGrid(
      cy,
      debugTerrainItems,
      (id) => this.selectDebugTerrain(id as TileType),
      undefined,
      ITEM_GRID_PAGE_SIZE,
    );
    this.debugTerrainButtons = debugTerrain.buttons;
    this.debugTerrainLabels = debugTerrain.labels;

    const debugStatusItems = STATUS_EFFECT_ORDER.map((id) => ({ id, label: getStatusEffectDefinition(id).name }));
    const debugStatus = this.buildItemGrid(
      cy,
      debugStatusItems,
      (id) => this.selectDebugStatus(id as StatusEffectId),
      undefined,
      ITEM_GRID_PAGE_SIZE,
    );
    this.debugStatusButtons = debugStatus.buttons;
    this.debugStatusLabels = debugStatus.labels;

    // Phase 11.7 (D-071): shown in place of the Gear grid when no living
    // hero is close enough to a shop tile — see showEquipUI/isAnyHeroNearShop.
    this.equipLockLabel = this.add
      .text(GAME_WIDTH / 2, cy + 40, "Move a hero to a Shop tile to buy/equip Gear", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#e0a860",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);

    // One Done button shared by both modes, positioned below the TALLER of
    // the two grids. Phase 17 (D-108)/Phase 25 (D-116): BOTH the Gear and
    // Shop catalogues' real ROW COUNTs now cap at one page (
    // `ITEM_GRID_PAGE_SIZE` / cols = 4 rows) regardless of the underlying
    // catalogue's total size, since both are paginated — otherwise either
    // the ~90-item weapon/armor catalogue or the now-22-item shop would make
    // this grid dozens of rows tall.
    const cols = 4;
    const shopRows = Math.min(Math.ceil(SHOP_ORDER.length / cols), ITEM_GRID_PAGE_SIZE / cols);
    const gearRows = Math.min(Math.ceil(this.visibleGearCatalog().length / cols), ITEM_GRID_PAGE_SIZE / cols);
    const rows = Math.max(shopRows, gearRows);
    const rowHeight = 38; // button height (30) + vertical gap (8)
    const shopPageCount = Math.ceil(SHOP_ORDER.length / ITEM_GRID_PAGE_SIZE);
    const gearPageCount = Math.ceil(this.visibleGearCatalog().length / ITEM_GRID_PAGE_SIZE);
    // The page nav row sits just under the (capped) taller of the two grids;
    // Done sits under THAT, so it never collides with a wider grid on
    // another page. Only one of shop/gear nav is ever actually visible at a
    // time (`refreshPageNav` decides which, from `this.ui.kind`), but both
    // share this one Y position since `rows` already accounts for whichever
    // grid is taller.
    const navY = cy + rows * rowHeight + 14;
    this.pageNavPrevButton = this.add
      .text(GAME_WIDTH / 2 - 90, navY, "◀ Prev", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#8ad0f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.pageNavPrevButton.on("pointerdown", () => this.turnGridPage(-1));
    this.pageNavLabel = this.add
      .text(GAME_WIDTH / 2, navY, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.pageNavNextButton = this.add
      .text(GAME_WIDTH / 2 + 90, navY, "Next ▶", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#8ad0f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.pageNavNextButton.on("pointerdown", () => this.turnGridPage(1));
    const navRowHeight = gearPageCount > 1 || shopPageCount > 1 ? 30 : 0;
    const doneY = cy + rows * rowHeight + navRowHeight + 6;
    this.doneButton = this.add
      .rectangle(GAME_WIDTH / 2, doneY, 120, 30, 0x7a5a3a)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .setVisible(false);
    this.doneLabel = this.add
      .text(GAME_WIDTH / 2, doneY, "Done (Esc)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.doneButton.on("pointerdown", () => {
      if (this.ui.kind === "building") this.exitBuildMode();
      else if (this.ui.kind === "equipping") this.exitEquipMode();
      else if (this.isDebugGridKind(this.ui.kind)) this.setInteraction({ kind: "idle" });
    });
  }

  /**
   * Build a row-major grid of small buttons, one per item, hidden until the
   * caller shows them. Shared by the shop grid and the equip-item grid so
   * both use identical, generically-sized slots regardless of catalogue size.
   * `onHover` (Phase 8 tooltip) fires with the item id on pointerover and
   * `null` on pointerout, so the status hint can preview a description
   * without the player having to click/select first.
   */
  private buildItemGrid(
    cy: number,
    items: ReadonlyArray<{ id: string; label: string }>,
    onClick: (id: string) => void,
    onHover?: (id: string | null) => void,
    perPage: number = items.length || 1,
  ): { buttons: Phaser.GameObjects.Rectangle[]; labels: Phaser.GameObjects.Text[] } {
    const cols = 4;
    const btnW = 150;
    const btnH = 30;
    const gapX = 10;
    const gapY = 8;
    const gridWidth = cols * btnW + (cols - 1) * gapX;
    const startX = GAME_WIDTH / 2 - gridWidth / 2 + btnW / 2;

    const buttons: Phaser.GameObjects.Rectangle[] = [];
    const labels: Phaser.GameObjects.Text[] = [];
    items.forEach((item, i) => {
      // Phase 17 (D-108): position by the WITHIN-PAGE slot (i % perPage), not
      // the flat catalogue index — every page reuses the same on-screen
      // slots, `showEquipUI` decides which item occupies them right now.
      const onPageIndex = i % perPage;
      const col = onPageIndex % cols;
      const row = Math.floor(onPageIndex / cols);
      const x = startX + col * (btnW + gapX);
      const y = cy + row * (btnH + gapY);
      const btn = this.add
        .rectangle(x, y, btnW, btnH, 0x3a4a6a)
        .setInteractive({ useHandCursor: true })
        .setDepth(31)
        .setVisible(false);
      const lbl = this.add
        .text(x, y, item.label, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "12px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(31)
        .setVisible(false);
      btn.on("pointerdown", () => onClick(item.id));
      if (onHover) {
        btn.on("pointerover", () => onHover(item.id));
        btn.on("pointerout", () => onHover(null));
      }
      buttons.push(btn);
      labels.push(lbl);
    });
    return { buttons, labels };
  }

  // ----- Phase machine ---------------------------------------------------

  private onPhaseChange(next: GamePhase, _prev: GamePhase): void {
    this.setInteraction({ kind: "idle" });

    switch (next) {
      case "player": {
        for (const hero of this.heroes) hero.resetForNewTurn();
        // Phase 21 (D-112): an enemy-inflicted "poisoned"-family status
        // ticks its damage once per player phase, same cadence as
        // `resetForNewTurn`'s own buff/status ticking just above — mirrors
        // `WaveSystem`'s burning tick, just on the hero side.
        let statusDefeat = false;
        for (const hero of this.heroes) {
          const damage = hero.tickStatusDamage();
          if (damage > 0) {
            this.logCombat(`${hero.name} takes ${damage} damage from a lingering effect`);
            if (!hero.isAlive()) {
              this.logCombat(`${hero.name} has fallen`);
              statusDefeat = true;
            }
          }
        }
        // Phase 23 (D-114): on a map that opts in (`hazardsAffectHeroes`), a
        // hero standing on a hazardous tile suffers the same terrain effect
        // an enemy already does — same cadence as the status tick just
        // above. Every existing map leaves this undefined/false, so heroes
        // stay completely unaffected exactly as before this phase.
        for (const hero of this.heroes) {
          if (!hero.isAlive()) continue;
          const effect = this.map.heroTerrainEffectAt(hero.position);
          if (!effect) continue;
          const tileType = this.map.getTileType(hero.position);
          if (effect.profile) {
            const result = CombatSystem.applyAttack(hero, effect.profile, this.random);
            if (result.damageDealt > 0) {
              this.logCombat(`${hero.name} takes ${result.damageDealt} damage from the ${tileType}`);
            }
          }
          if (effect.status && hero.isAlive()) {
            hero.applyStatus(effect.status.statusId, effect.status.durationTurns);
            this.logCombat(
              `${hero.name} is ${getStatusEffectDefinition(effect.status.statusId).name.toLowerCase()} by the ${tileType}`,
            );
          }
          if (!hero.isAlive()) {
            this.logCombat(`${hero.name} has fallen`);
            statusDefeat = true;
          }
        }
        this.syncHeroTokens();
        // D-068's party-wipe check normally only runs after an enemy phase
        // (hero death was previously only possible there) — a status tick
        // can now also wipe the party at the START of a player phase, so
        // check again here rather than leaving the game in limbo until the
        // next enemy phase resolves.
        if (statusDefeat && this.livingHeroes().length === 0) {
          this.time.delayedCall(0, () => {
            this.defeatReason = "party";
            this.turns.transitionTo("defeat");
          });
          break;
        }
        this.runAIHeroTurns();
        break;
      }
      case "enemy":
        this.runEnemyPhase();
        break;
      case "resolution":
        this.resolvePhase();
        break;
      case "betweenWave":
        this.waveSystem.advanceToNextWave();
        this.tickDynamicTerrain();
        for (const hero of this.heroes) hero.resetForNewTurn();
        // KI-085/D-130: same Game Speed scaling as resolvePhase's pause above.
        this.time.delayedCall(this.scaledDuration(650), () => this.turns.transitionTo("player"));
        break;
      case "victory":
        this.markCampaignCompletedIfAny();
        // D-177: a chapter's outroText (when written) shows before the end
        // screen, so a chapter's own closing beat lands before "Victory!".
        // KI-098 item 13 continuation: a Ch4 mirror-boss reaction beat (if
        // any) and a companion's own recruitment beat (if any — these two
        // never both fire the same battle, chapterIndex 3 vs. 0) land next.
        // D-188: the capstone's own branch-determined ending beat shows
        // right after that, still before "Victory!".
        this.showChapterOutroIfAny(() =>
          this.showMirrorBossReactionIfAny(() =>
            this.showCompanionRecruitmentIfAny(() =>
              this.showNamelessThroneEndingIfAny(() => this.showEndScreen("Victory!", "#9be0b4")),
            ),
          ),
        );
        break;
      case "defeat":
        this.showEndScreen(
          this.defeatReason === "party"
            ? "Defeat — your party has fallen"
            : "Defeat — the stronghold has fallen",
          "#e07a7a",
        );
        break;
      default:
        break;
    }

    this.updateHud();
  }

  /**
   * Phase 11.4 (D-077): "human picks level-ups, AI plays" — every AI-controlled
   * hero acts immediately at the start of its player phase, via `HeroAISystem`
   * (attack if something's already in range, else close in on the nearest
   * enemy). Runs right after the per-hero reset above, so AI heroes start each
   * turn with a full move+action just like a human-controlled one.
   *
   * A hero's own attack can occasionally clear the wave outright (see
   * `finishWaveEarlyIfComplete`), synchronously advancing `this.turns` away
   * from "player" mid-loop — the phase check below stops any further AI
   * heroes from acting into a phase that has already moved on.
   */
  private runAIHeroTurns(): void {
    for (const hero of this.heroes) {
      if (this.turns.current !== "player" || this.inputLocked()) break;
      if (hero.controlledBy !== "ai" || !hero.isAlive()) continue;
      this.runAIHeroTurn(hero);
    }
    this.setInteraction({ kind: "idle" });
  }

  private runAIHeroTurn(hero: Hero): void {
    if (!hero.canMove() && !hero.canAct()) return;
    const decision = this.heroAI.decideTurn({
      position: hero.position,
      attackRangeTiles: hero.attackRangeTiles,
      movementBudget: hero.movementBudget(),
      // Phase 20 (D-111): an AI-controlled hero can't target a still-hidden
      // stealth enemy either — same rule as a human clicking one. D-127: an
      // AI-controlled hero with Blindsense/Feral Senses still gets its own
      // per-observer exception here, same as a human-controlled one.
      enemies: this.waveSystem.enemies.filter((e) => this.isEnemyTargetable(e, hero)),
      isOccupied: (p) => this.isHeroMovementBlocked(p),
      blocksStopping: (p) => this.isHeroStoppingBlocked(p, hero.id),
    });

    if (decision.move && hero.canMove()) {
      hero.moveTo(decision.move);
      const token = this.heroTokens.get(hero.id);
      if (token) this.placeToken(token, hero.position);
      this.checkTreasureAt(hero);
    }

    if (decision.targetId && hero.canAct()) {
      const enemy = this.enemyById(decision.targetId);
      if (enemy) this.tryBasicAttack(hero, enemy);
    }
  }

  private endPlayerTurn(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    this.setInteraction({ kind: "idle" });
    this.turns.advance(); // player -> enemy
  }

  /** Run one enemy phase: spawn, then each enemy attacks a hero or advances. */
  private runEnemyPhase(): void {
    // Phase 16 (D-106): a summoned ally strikes before the enemies get to
    // act, and any spell-placed terrain ticks one turn closer to expiring.
    const before = new Set(this.summonSystem.summons.map((s) => s.instanceId));
    const summonEvents = this.summonSystem.actAndTick(this.waveSystem.enemies, this.random);
    for (const evt of summonEvents) {
      const verb = BattleScene.attackVerb(evt.result);
      const suffix = BattleScene.didHit(evt.result) ? ` for ${evt.result.damageDealt}` : "";
      const targetName = evt.target instanceof Enemy ? evt.target.def.name : "its target";
      this.logCombat(`${evt.summon.def.name} ${verb} ${targetName}${suffix}`);
      this.logTechnical(BattleScene.technicalAttackLine(evt.summon.def.name, targetName, evt.result));
    }
    this.resolveDeaths(this.waveSystem.removeDefeated());
    for (const instanceId of before) {
      if (!this.summonSystem.summons.some((s) => s.instanceId === instanceId)) this.removeSummonToken(instanceId);
    }
    this.syncEnemyTokens();
    this.tickTemporaryStructures();

    const report = this.waveSystem.tickEnemyPhase({
      // D-125: a hidden hero (Ranger's Vanish/Monk's Empty Body) can't be
      // picked as an attack target — it still physically occupies its tile
      // (movement/pathfinding blocking, `isLivingHeroAt` below, is
      // deliberately untouched; only TARGETING changes).
      heroTargets: this.livingHeroes().filter((h) => !h.isHidden),
      // Ground enemies route around living heroes AND placed walls.
      isBlocked: (p) => this.isLivingHeroAt(p) || this.buildSystem.isWallAt(p),
      // Flying enemies (D-048) ignore walls; telling the WaveSystem which
      // blocked tiles are walls lets a flyer pass a barricade while still being
      // stopped by a hero. Ground enemies never consult this.
      isWall: (p) => this.buildSystem.isWallAt(p),
      // A trap on a tile an enemy steps onto damages it (Phase 5) — but only if
      // the trap targets that enemy's movement type (D-049: spikes vs flyers).
      // Phase 11.7 (D-071): when there's no PLACED trap on the tile, fall
      // back to the map's terrain effect (water/fire/acid) — the same
      // trap-callback shape WaveSystem already consumes, so WaveSystem
      // itself needed no changes. A trap always wins if one is somehow on
      // the same tile as a terrain hazard (shouldn't normally happen given
      // today's build rules, but this stays defensive about it).
      trapAt: (p) => this.buildSystem.trapProfileAt(p) ?? this.map.terrainEffectAt(p)?.profile ?? null,
      trapTargets: (p) =>
        this.buildSystem.trapAt(p)
          ? this.buildSystem.trapTargetsAt(p)
          : this.map.terrainEffectAt(p)?.targets ?? "any",
      // Phase 7: a trap (Tangle Root) may also apply a lingering status effect
      // if the enemy survives its damage. Phase 11.7: same terrain fallback.
      trapStatusAt: (p) => this.buildSystem.trapStatusAt(p) ?? this.map.terrainEffectAt(p)?.status ?? null,
      // Phase 20 (D-111): a siege enemy's own attack-range scan for a
      // destructible wall to break through, and the callback that actually
      // damages one.
      wallHpAt: (p) => {
        const s = this.buildSystem.wallAt(p);
        return s && s.hp !== undefined ? { instanceId: s.instanceId, defId: s.defId } : null;
      },
      damageWall: (instanceId, damage) => this.buildSystem.damageStructure(instanceId, damage).destroyed,
      // Enemy AI/Movement Redesign §3 (D-145): every destructible wall on the
      // board, for a siege enemy's own "which wall should I seek out?" scan
      // once none is already within its immediate attack range.
      allWalls: () =>
        this.buildSystem.structures
          .filter((s) => s.kind === "wall" && s.hp !== undefined)
          .map((s) => ({ instanceId: s.instanceId, defId: s.defId, position: { ...s.position } })),
      // Phase 25 (D-116): a Saboteur/Warren Stalker's own sense-range scan
      // for a placed trap to disarm, and the callback that actually removes
      // one.
      trapInstanceAt: (p) => {
        const s = this.buildSystem.trapAt(p);
        return s ? { instanceId: s.instanceId, defId: s.defId } : null;
      },
      disarmTrap: (instanceId) => this.buildSystem.disarmTrap(instanceId),
    });
    this.lastReport = report;
    this.applyUncannyDodges(report);
    this.applyDamageResistanceBuffs(report);
    this.applyCuttingWords(report);
    this.applyRetaliations(report);
    // Phase 24 (D-115): resolve each trap trigger's REAL name (and whether
    // it's single-use) while the structure is still on the tile — the
    // structure may be removed (single-use) or the terrain fallback has no
    // structure at all (only acid carries an instant-damage profile among
    // water/fire/acid, so that's the one case this can reach), so it can't
    // be looked up lazily inside the delayedCall below. Previously this
    // always logged "Spike Trap" regardless of which trap (or terrain
    // hazard) actually fired — a real pre-existing bug this pass's new trap
    // variety made worth fixing.
    const trapTriggerInfo = report.trapTriggers.map((t) => {
      const s = this.buildSystem.trapAt(t.position);
      const def = s ? getStructureDefinition(s.defId) : null;
      const terrainType = s ? null : this.map.getTileType(t.position);
      const name = def?.name ?? (terrainType ? terrainType.charAt(0).toUpperCase() + terrainType.slice(1) : "Trap");
      return { name, instanceId: s?.instanceId, singleUse: def?.singleUse === true };
    });

    for (const enemy of report.spawned) {
      this.spawnEnemyToken(enemy);
      this.markEnemySeen(enemy.def.id);
      // KI-098 item 13 (CAMPAIGN_STORY_DESIGN.md §4): one-time flavor line
      // the first time Saltmere Ch1's returning miniboss actually spawns.
      if (this.saltmereReturningEnemyId === enemy.def.id) {
        this.saltmereReturningEnemyId = null;
        const flavor = RETURNING_MINIBOSS_FLAVOR_TEXT[enemy.def.id];
        if (flavor) this.logCombat(flavor);
      }
    }
    for (const move of report.moves) this.moveEnemyToken(move.enemy, move.to);
    // Phase 20 (D-111): reinforcements arrive with their own token right
    // away — the loop that spawned them may still act on them later this
    // same phase, so their token needs to exist before that renders.
    for (const evt of report.reinforcements) {
      for (const spawnedEnemy of evt.spawned) {
        this.spawnEnemyToken(spawnedEnemy);
        this.markEnemySeen(spawnedEnemy.def.id);
      }
      this.logCombat(
        `${evt.source.def.name} calls reinforcements — ${evt.spawned.length}x ${evt.spawned[0].def.name} arrive!`,
      );
    }

    this.time.delayedCall(this.scaledDuration(ANIM_MS) + 40, () => {
      for (const atk of report.attacks) this.showEnemyAttack(atk);
      // Phase 21 (D-112), Gold Thief: a landed attack against a hero also
      // steals gold — resolved here (a BattleScene-layer post-process over
      // the attack event) since `WaveSystem` has no `EconomySystem` access.
      for (const atk of report.attacks) {
        if (!atk.enemy.def.goldTheftAmount || atk.result.roll?.hit !== true) continue;
        const stolen = this.economy.deduct(atk.enemy.def.goldTheftAmount);
        if (stolen > 0) {
          this.logCombat(`${atk.enemy.def.name} steals ${stolen}g!`);
          this.updateGoldHud();
        }
      }
      report.trapTriggers.forEach((trip, i) => {
        const info = trapTriggerInfo[i];
        this.showTrapTrigger(trip, info.name);
        // Phase 24 (D-115): a single-use trap (Bear Trap) is spent after its
        // first trigger — remove it and its token right after the flash.
        if (info.singleUse && info.instanceId) {
          this.buildSystem.remove(info.instanceId);
          this.destroyStructureToken(info.instanceId);
        }
      });
      for (const evt of report.statusEvents) this.showStatusTick(evt);
      for (const sa of report.structureAttacks) this.showStructureAttack(sa);
      for (const td of report.trapDisarms) this.showTrapDisarm(td);
      for (const breach of report.breaches) this.breachEnemyToken(breach.enemy);
      // Phase 21 (D-112): render every new mechanic's events this phase.
      for (const evt of report.lifedrinks) {
        this.logCombat(`${evt.enemy.def.name} drains ${evt.healed} HP from the strike`);
      }
      for (const evt of report.teleports) {
        this.moveEnemyToken(evt.enemy, evt.to);
        this.logCombat(`${evt.enemy.def.name} blinks toward the stronghold`);
      }
      for (const evt of report.mimicReveals) {
        this.applyStealthVisual(evt.enemy);
        this.logCombat(`${evt.enemy.def.name} was a Mimic all along!`);
      }
      for (const evt of report.phaseChanges) {
        this.logCombat(`${evt.enemy.def.name} enters a new phase!`);
      }
      for (const evt of report.healEvents) {
        this.logCombat(`${evt.healer.def.name} heals ${evt.ally.def.name} for ${evt.healed}`);
      }
      this.syncEnemyTokens();
      // Enemies slain by traps this phase are removed (and reward gold awarded)
      // exactly once, just like hero kills.
      this.resolveDeaths(this.waveSystem.removeDefeated());
      this.syncHeroTokens();
      this.updateHud();
      this.turns.transitionTo("resolution");
    });
  }

  /**
   * Phase 21 (D-112): the single funnel for every enemy removal, regardless
   * of cause (hero attack, trap, burn/poison tick, enemy-vs-enemy) — awards
   * kill gold exactly as before this phase, then resolves Splitter/
   * Carrier's `onDeathSpawns` and Explosive's `onDeathExplode`. Chosen here
   * specifically because `removeDefeated()` already funnels through every
   * one of its 3 call sites into `awardKillGold`, so a death trigger fires
   * no matter which phase or source caused the kill.
   */
  private resolveDeaths(removed: Enemy[]): void {
    // KI-098 item 13 (CAMPAIGN_STORY_DESIGN.md §4): if this chapter's own
    // sparable miniboss just went down, stash it for `afterWaveCleared` to
    // ask "finish or spare?" — it's always this chapter's finale spawn, so
    // this never fires more than once per battle. Reward handling below is
    // unaffected either way; sparing is a narrative flag, not a payout cut.
    const sparableId = this.currentChapter ? SPARABLE_MINIBOSS_CHAPTERS[this.currentChapter.id] : undefined;
    if (sparableId) {
      const miniboss = removed.find((e) => e.def.id === sparableId);
      if (miniboss) this.pendingSparableKill = miniboss;
    }
    this.awardKillGold(removed);
    if (removed.length === 0) return;
    const report = this.waveSystem.resolveDeathTriggers(removed, this.livingHeroes());
    for (const enemy of report.spawned) {
      this.spawnEnemyToken(enemy);
      this.markEnemySeen(enemy.def.id);
    }
    for (const evt of report.deathSpawns) {
      this.logCombat(`${evt.source.def.name} splits into ${evt.spawned.length}x ${evt.spawned[0].def.name}!`);
    }
    let explosionHit = false;
    for (const evt of report.explosions) {
      this.logCombat(`${evt.source.def.name} detonates!`);
      for (const hit of evt.hits) {
        if (hit.result.damageDealt <= 0) continue;
        explosionHit = true;
        const heroName = hit.target instanceof Hero ? hit.target.name : "something";
        this.logCombat(`The blast hits ${heroName} for ${hit.result.damageDealt}`);
      }
    }
    if (explosionHit) {
      this.syncHeroTokens();
      this.updateHud();
      // D-068's party-wipe check normally only runs after an enemy phase —
      // an on-death explosion can now also wipe the party from a HERO's own
      // attack, mid-player-phase, so check again here (deferred, to avoid
      // re-entering the turn machine synchronously from inside a call
      // stack that may itself be mid-transition).
      if (this.livingHeroes().length === 0) {
        this.time.delayedCall(0, () => {
          this.defeatReason = "party";
          this.turns.transitionTo("defeat");
        });
      }
    }
  }

  /** Decide what follows the enemy phase. */
  private resolvePhase(): void {
    // KI-085/D-130: this fixed post-phase pause now scales with Game Speed
    // too, not just tween durations — otherwise "Instant" still felt slow
    // between phases even with every tween itself skipped.
    this.time.delayedCall(this.scaledDuration(400), () => {
      if (this.waveSystem.isDefeated()) {
        this.defeatReason = "integrity";
        this.turns.transitionTo("defeat");
        return;
      }
      // D-068: a wiped party is now ALSO a loss, alongside Stronghold
      // Integrity reaching 0 (previously the only loss condition, D-034).
      // Hero death only ever happens from an enemy attack during the enemy
      // phase just finished, so checking here — the one place that already
      // decides what follows it — needs no new hook elsewhere.
      if (this.livingHeroes().length === 0) {
        this.defeatReason = "party";
        this.turns.transitionTo("defeat");
        return;
      }
      if (this.lastReport?.waveComplete) {
        // Grant the wave's completion gold (plus the time bonus if it was
        // cleared within the turn limit) exactly once, on the clearing phase.
        this.awardWaveReward(this.lastReport?.turn ?? 0);
        this.afterWaveCleared();
      } else {
        this.turns.transitionTo("player"); // same wave continues
      }
    });
  }

  private awardWaveReward(completionTurn: number): void {
    const wave = this.waveSystem.currentWave;
    const reward = RewardSystem.waveReward(wave, completionTurn);
    this.economy.award(reward.total);
    this.wavesCleared += 1;
    let msg = `Wave ${this.waveSystem.waveNumber} cleared: +${reward.completionGold}g`;
    if (reward.timeBonusGold > 0) msg += ` (+${reward.timeBonusGold}g time bonus)`;
    this.logCombat(msg);
    this.updateGoldHud();
  }

  /**
   * After a wave's reward is granted: move on to Victory/Between Waves, but
   * first offer a level-up choice if one has just been earned (Phase 7,
   * ProgressionSystem — every LEVEL_UP_WAVE_INTERVAL waves cleared), THEN a
   * Rest choice (Phase 13.4, D-088 — opt-in, only if a charge remains and
   * there's a next wave to rest before). Both transitions are deferred until
   * the player resolves any overlay, so neither can be skipped by the phase
   * machine racing ahead of it.
   *
   * A hero has no CHOICE to make on a level that ISN'T an Ability Score
   * Improvement — real per-class leveling is automatic. KI-085/D-130: such a
   * hero now also gets a plain "reaches level N!" popup (`showLevelUpAckQueue`)
   * on top of the log line, since a log-only confirmation was Kevin's own
   * reported gap. Phase 13.6 (D-091): a level that DOES grant an ASI queues
   * `showAsiChoiceQueue` for every hero who just reached one, before moving
   * on to any Rest choice.
   */
  private afterWaveCleared(): void {
    const afterSparableChoice = () => {
      const proceed = () => {
        if (this.waveSystem.isLastWave()) this.turns.transitionTo("victory");
        else this.turns.transitionTo("betweenWave");
      };
      const afterLevelUp = () => {
        // Resting "before the next wave" is meaningless with no next wave.
        if (this.waveSystem.isLastWave()) proceed();
        else this.showRestChoice(proceed);
      };
      if (this.progression.hasPendingLevelUp(this.wavesCleared)) {
        const { asiHeroes, subclassHeroes, spellPickHeroes, spellSwapHeroes, plainHeroes } = this.applyClassLevelUps();
        // D-125/D-130/D-136: plain ack -> subclass -> ASI -> spell-mastery-
        // family pick -> level-up spell swap -> rest, same deferred-queue
        // chaining `showAsiChoiceQueue`/`showSubclassChoiceQueue` already use.
        const afterSpellPick = () => {
          if (spellSwapHeroes.length > 0) this.showSpellPrepQueue(spellSwapHeroes, "levelUp", afterLevelUp);
          else afterLevelUp();
        };
        const afterAsi = () => {
          if (spellPickHeroes.length > 0) this.showSpellPickChoiceQueue(spellPickHeroes, afterSpellPick);
          else afterSpellPick();
        };
        const afterSubclass = () => {
          if (asiHeroes.length > 0) this.showAsiChoiceQueue(asiHeroes, afterAsi);
          else afterAsi();
        };
        const afterPlainAck = () => {
          if (subclassHeroes.length > 0) this.showSubclassChoiceQueue(subclassHeroes, afterSubclass);
          else afterSubclass();
        };
        if (plainHeroes.length > 0) this.showLevelUpAckQueue(plainHeroes, afterPlainAck);
        else afterPlainAck();
      } else {
        afterLevelUp();
      }
    };
    // KI-098 item 13 (CAMPAIGN_STORY_DESIGN.md §4): this MUST run before
    // `isLastWave()` is ever checked — the sparable miniboss is always its
    // chapter's finale spawn, so any later hook would race the victory
    // transition (`proceed` above) before the player could click anything.
    if (this.pendingSparableKill) {
      const miniboss = this.pendingSparableKill;
      this.pendingSparableKill = null;
      this.showSparableKillChoice(miniboss, afterSparableChoice);
    } else {
      afterSparableChoice();
    }
  }

  /**
   * KI-098 item 13 (CAMPAIGN_STORY_DESIGN.md §4): the "finish or spare?"
   * choice for a chapter's own sparable miniboss. Reuses `renderAsiPrompt`/
   * `asiOverlay`, same as every other mandatory mid-battle choice. Kill
   * gold/loot/bestiary credit are unaffected by either option — the enemy
   * is at 0 HP regardless. Sparing persists a narrative flag (read back by
   * `resolveSaltmereCh1Enemy` far later, in a different region) AND
   * (KI-098 item 13 continuation) grants an immediate, modest
   * `SPARE_MERCY_GOLD_REWARD` — mercy has a real in-the-moment payoff, not
   * just a downstream one.
   */
  private showSparableKillChoice(enemy: Enemy, onDone: () => void): void {
    this.choosingSparableKill = true;
    const finish = () => {
      this.clearAsiOverlay();
      this.choosingSparableKill = false;
      onDone();
    };
    const spare = () => {
      const next = setWorldFlag(this.worldFlags, sparedFlagId(enemy.def.id), true);
      if (next !== this.worldFlags) {
        this.worldFlags = next;
        saveWorldFlags(window.localStorage, WORLD_FLAG_STORAGE_KEY, next);
      }
      this.logCombat(`${enemy.def.name} is spared, and slips away wounded.`);
      this.economy.award(SPARE_MERCY_GOLD_REWARD);
      this.updateGoldHud();
      this.logCombat(`${enemy.def.name} owes you now — +${SPARE_MERCY_GOLD_REWARD}g.`);
      this.clearAsiOverlay();
      this.choosingSparableKill = false;
      onDone();
    };
    this.renderAsiPrompt(`${enemy.def.name} is defeated.`, [
      { label: `Finish ${enemy.def.name}`, desc: "The killing blow lands. Nothing more to it.", onClick: finish },
      {
        label: `Spare ${enemy.def.name}`,
        desc: "Let it go — some say a spared foe never truly forgets.",
        onClick: spare,
      },
    ]);
  }

  /**
   * Phase 13.3 (D-089): advance every LIVING hero one real class level
   * (`Hero.levelUpClass`), logging each one that actually changed (a fallen
   * hero gets nothing retroactively, same convention `ProgressionSystem
   * .applyChoice` already uses) and marking the threshold granted so
   * `hasPendingLevelUp` won't refire for it. Phase 13.6 (D-091): returns
   * every hero whose NEW level grants an Ability Score Improvement, so the
   * caller can queue `showAsiChoiceQueue` for exactly those heroes. Phase
   * 13.11 (D-096): also returns every hero whose NEW level grants a
   * subclass (`CharacterSystem.subclassGrantedAtLevel`) and doesn't already
   * have one, so the caller can queue `showSubclassChoiceQueue` first. D-125:
   * also returns every hero whose NEW level unlocks a Spell Mastery/
   * Signature Spells (Wizard)/Mystic Arcanum (Warlock) pick it hasn't made
   * yet — `levelUpClass()` only ever advances one level per call, and these
   * six trigger levels (11/13/15/17/18/20) are all distinct, so a hero can
   * trigger at most ONE of these three kinds per call. D-130: also returns
   * every OTHER hero that leveled with none of the above — the caller queues
   * `showLevelUpAckQueue` for exactly those, so every leveled hero gets some
   * on-screen popup, not just the ones with a real choice to make.
   */
  private applyClassLevelUps(): {
    asiHeroes: { hero: Hero; level: number }[];
    subclassHeroes: Hero[];
    spellPickHeroes: SpellPickRequest[];
    spellSwapHeroes: Hero[];
    plainHeroes: Hero[];
  } {
    const needsAsi: { hero: Hero; level: number }[] = [];
    const needsSubclass: Hero[] = [];
    const needsSpellPick: SpellPickRequest[] = [];
    const needsSpellSwap: Hero[] = [];
    const plainHeroes: Hero[] = [];
    const arcanumTiers = [6, 7, 8, 9];
    for (const hero of this.livingHeroes()) {
      const beforeLevel = hero.level;
      const beforeAttacks = hero.attacksPerAction;
      const beforeStats: LevelUpStatSnapshot = {
        maxHealth: hero.effectiveMaxHealth,
        armorClass: hero.armorClass,
        attackBonus: hero.effectiveAttackBonus,
      };
      hero.levelUpClass();
      if (hero.level > beforeLevel) {
        let msg = `${hero.name} reaches level ${hero.level}!`;
        if (hero.attacksPerAction > beforeAttacks) msg += ` (now attacks ${hero.attacksPerAction}x per turn)`;
        this.logCombat(msg);
        this.levelUpDeltaByHeroId.set(
          hero.id,
          levelUpDeltaSummary(
            beforeStats,
            { maxHealth: hero.effectiveMaxHealth, armorClass: hero.armorClass, attackBonus: hero.effectiveAttackBonus },
            hero.classId,
            hero.level,
          ),
        );
        // D-16x: an "auto" plan only skips the prompt when the resolver
        // actually applied an explicit plan entry — an "auto" hero with no
        // entry for this level still gets queued exactly like a
        // "prompt"/"fresh"/unset hero would, instead of a silently invented
        // default (see D-16x in DECISIONS.md and LevelUpPlanSystem.ts).
        const plan = this.heroLevelUpPlans.get(hero.id);
        const autoMode = plan?.mode === "auto";
        let hasChoice = false;
        if (hero.classId) {
          const classDef = getClassDefinition(hero.classId);
          if (asiFeatureGrantedAtLevel(classDef, hero.level)) {
            hasChoice = true;
            if (!(autoMode && resolveAsiForLevel(hero, hero.level, plan))) needsAsi.push({ hero, level: hero.level });
          }
          if (
            !hero.subclassId &&
            subclassGrantedAtLevel(classDef, hero.level) &&
            subclassesForClass(hero.classId).length > 0
          ) {
            hasChoice = true;
            if (!(autoMode && resolveSubclassForClass(hero, hero.classId, plan))) needsSubclass.push(hero);
          }
          if (hero.needsSpellMasteryPick()) {
            hasChoice = true;
            const request: SpellPickRequest = { hero, kind: "mastery" };
            if (!(autoMode && resolveSpellPickForRequest(hero, request, plan))) needsSpellPick.push(request);
          } else if (hero.needsSignatureSpellsPick()) {
            hasChoice = true;
            const request: SpellPickRequest = { hero, kind: "signature" };
            if (!(autoMode && resolveSpellPickForRequest(hero, request, plan))) needsSpellPick.push(request);
          } else {
            const tier = arcanumTiers.find((t) => hero.needsMysticArcanumPick(t));
            if (tier !== undefined) {
              hasChoice = true;
              const request: SpellPickRequest = { hero, kind: "arcanum", tier };
              if (!(autoMode && resolveSpellPickForRequest(hero, request, plan))) needsSpellPick.push(request);
            }
          }
          // D-136: a level-up is ALSO the trigger for Sorcerer/Bard/Warlock's
          // replace-one prepared-spell swap, and for every cantrip-having
          // class but Wizard's replace-one cantrip swap. Unlike the three
          // checks above, this recurs at EVERY level-up for a caster's whole
          // career, not a one-time unlock — there's no plannable slot for it
          // (see D-136 for why), so "auto" mode just skips it silently
          // (equivalent to "keep current selection") instead of resolving a
          // plan entry that doesn't exist for this trigger.
          if (spellSwapStepsForClass(hero.classId, hero.level, "levelUp").length > 0) {
            hasChoice = true;
            if (!autoMode) needsSpellSwap.push(hero);
          }
        }
        if (!hasChoice) plainHeroes.push(hero);
      }
    }
    this.progression.acknowledgeLevelUp();
    this.syncHeroTokens();
    return {
      asiHeroes: needsAsi,
      subclassHeroes: needsSubclass,
      spellPickHeroes: needsSpellPick,
      spellSwapHeroes: needsSpellSwap,
      plainHeroes,
    };
  }

  // KI-033 fix: shrink the banner's font size, using its real measured
  // width, until it fits inside bannerMaxWidth (set in buildHud from the
  // Gear button's actual left edge) — guaranteed never to reach the button
  // row regardless of how long a future phase label or wave count gets.
  // Reset to the base size first so a later SHORT string (e.g. "Victory")
  // renders at full size again rather than staying shrunk from a prior long one.
  private fitBannerToWidth(): void {
    const baseFontSizePx = 20;
    const minFontSizePx = 10;
    this.bannerText.setFontSize(baseFontSizePx);
    let size = baseFontSizePx;
    while (this.bannerText.width > this.bannerMaxWidth && size > minFontSizePx) {
      size -= 1;
      this.bannerText.setFontSize(size);
    }
  }

  private updateHud(): void {
    const phase = this.turns.current;
    this.bannerText.setText(
      `Wave ${this.waveSystem.waveNumber} / ${this.waveSystem.totalWaves}  ·  ${PHASE_LABELS[phase]}`,
    );
    this.fitBannerToWidth();
    const integ = this.waveSystem.integrity;
    const low = integ <= 5;
    // Phase 8: the low-integrity warning is also spelled out in text, not
    // conveyed by the colour swap alone.
    this.integrityText
      .setText(`Stronghold Integrity: ${integ} / ${STRONGHOLD_START}${low ? "  ⚠ LOW" : ""}`)
      .setColor(low ? "#e07a7a" : "#e8c06a");

    const recent = this.turns.history.slice(-3).map((p) => PHASE_LABELS[p]);
    this.logText.setText(`recent: ${recent.join(" -> ")}`);

    const playerActive = phase === "player";
    this.endTurnButton.setAlpha(playerActive ? 1 : 0.4);
    this.endTurnLabel.setAlpha(playerActive ? 1 : 0.4);
    if (playerActive) this.endTurnButton.setInteractive({ useHandCursor: true });
    else this.endTurnButton.disableInteractive();

    // The Build and Gear toggles are available only during the player phase.
    this.buildButton.setAlpha(playerActive ? 1 : 0.4);
    this.buildLabel.setAlpha(playerActive ? 1 : 0.4);
    if (playerActive) this.buildButton.setInteractive({ useHandCursor: true });
    else this.buildButton.disableInteractive();

    this.equipButton.setAlpha(playerActive ? 1 : 0.4);
    this.equipLabel.setAlpha(playerActive ? 1 : 0.4);
    if (playerActive) this.equipButton.setInteractive({ useHandCursor: true });
    else this.equipButton.disableInteractive();

    this.updateGoldHud();
    this.updateWavePreview();
    this.refreshStatus();
  }

  /**
   * Phase 7 ("improved wave preview"): name the NEXT wave's enemy composition
   * so the player can plan a build before it starts. Pure lookup into
   * `this.currentWaves` (Phase 11.8, D-071: the resolved wave list for
   * whichever map/campaign this battle is playing) — no new system needed,
   * the data was always there.
   */
  private updateWavePreview(): void {
    const next = this.currentWaves[this.waveSystem.waveNumber]; // waveNumber is 1-based current
    if (!next) {
      this.previewText.setText("");
      return;
    }
    const parts = next.spawns.map((g) => `${getEnemyDefinition(g.enemyId).name} x${g.count}`);
    this.previewText.setText(`Next: Wave ${this.waveSystem.waveNumber + 1} — ${parts.join(", ")}`);
  }

  // ----- Enemy tokens ----------------------------------------------------

  private spawnEnemyToken(enemy: Enemy): void {
    const c = this.grid.tileToWorldCenter(enemy.position);
    const color = ENEMY_COLORS[enemy.def.id] ?? COLORS.enemy;
    // Phase 20 (D-111): a captain/banner enemy's buff radius gets a real,
    // visible ring on the board — a translucent circle roughly the size of
    // its `radiusTiles`, drawn UNDER the token — so the effect reads as
    // something actually happening, not a silent stat change.
    if (enemy.def.auraBuff) {
      const ring = this.add
        .circle(c.x, c.y, this.grid.tileSize * (enemy.def.auraBuff.radiusTiles + 0.5), color, 0.12)
        .setStrokeStyle(2, color, 0.5)
        .setDepth(8);
      this.enemyAuraRings.set(enemy.instanceId, ring);
    }
    // KI-023: a miniboss/boss reads as distinct by SIZE and a persistent
    // name banner, not by colour alone — a bigger token plus role text
    // works the same for a colour-blind player as for anyone else.
    // Phase 13.10 (D-095): this used to check ONLY "miniboss" — the true
    // "boss" role tier (Cinderlord/Tidelord, added in 11.6) had silently
    // never gotten this treatment. Both tiers now qualify.
    const isBoss = BattleScene.isBossRole(enemy.def.role);
    const radius = this.grid.tileSize * (isBoss ? 0.44 : 0.32);
    const circle = this.add.circle(c.x, c.y, radius, color).setDepth(9);
    // Flying enemies (D-048) read differently on the board: a pale ring marks a
    // unit that ignores walls, so the player can tell at a glance why it isn't
    // being re-routed by their barricades. Purely cosmetic; rules live in data.
    if (enemy.def.movementType === "flying") {
      circle.setStrokeStyle(3, 0xffffff, 0.9);
    }
    if (isBoss) {
      circle.setStrokeStyle(4, 0xf0e070, 1);
    }
    const label = this.add
      .text(c.x, c.y - 4, enemy.def.name[0], {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: isBoss ? "28px" : "20px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(9);
    const hp = this.add
      .text(c.x, c.y + this.grid.tileSize * 0.2, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(11);
    const token: Token = { circle, label, hp };
    this.enemyTokens.set(enemy.instanceId, token);
    this.updateHpText(token, enemy.health, enemy.def.maxHealth);

    if (isBoss) {
      const banner = this.add
        .text(c.x, c.y - radius - 14, `${enemy.def.name} ${BattleScene.bossBannerSuffix(enemy.def.role)}`, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: "#f0e070",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(11);
      this.enemyBossBanners.set(enemy.instanceId, banner);
    }

    // KI-027: active status effects get a persistent on-token badge (an
    // initial-letter code, e.g. "SB" for slowed+burning) rather than relying
    // on a one-off coloured flash the player might have missed.
    const badge = this.add
      .text(c.x, c.y - radius - (isBoss ? 32 : 14), "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#0e0e14",
        backgroundColor: "#f0e070",
        padding: { left: 4, right: 4, top: 1, bottom: 1 },
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setVisible(false);
    this.enemyStatusBadges.set(enemy.instanceId, badge);
    this.applyStealthVisual(enemy);
  }

  /**
   * Phase 20 (D-111): a still-hidden `def.stealth` enemy reads as a vague
   * "something is here" shape — low opacity, a "?" instead of its name
   * initial, HP hidden — rather than either a full normal token (which
   * would spoil the ambush) or a fully invisible one (which would make the
   * tile itself unreadable). Idempotent and safe to call every phase: once
   * revealed it just renders normally from then on, forever.
   */
  private applyStealthVisual(enemy: Enemy): void {
    if (enemy.def.stealth === true) {
      const token = this.enemyTokens.get(enemy.instanceId);
      if (!token) return;
      const hidden = !enemy.isRevealed;
      token.circle.setAlpha(hidden ? 0.35 : 1);
      token.label.setText(hidden ? "?" : enemy.def.name[0]);
      token.hp.setVisible(!hidden);
      return;
    }
    // Phase 21 (D-112): a Mimic renders as ordinary "scenery" (a plain
    // brown square glyph, full opacity — deliberately NOT the stealth
    // enemy's dim "?" token, since the whole point is that it doesn't read
    // as hostile at all) until a hero moves adjacent to it, which reveals it
    // permanently — after that it's a completely normal token, forever.
    if (enemy.def.mimicDisguise === true) {
      const token = this.enemyTokens.get(enemy.instanceId);
      if (!token) return;
      const hidden = !enemy.isRevealed;
      token.circle.setFillStyle(hidden ? 0x8a6a3a : ENEMY_COLORS[enemy.def.id] ?? COLORS.enemy);
      token.label.setText(hidden ? "?" : enemy.def.name[0]);
      token.hp.setVisible(!hidden);
    }
  }

  private moveEnemyToken(enemy: Enemy, to: GridPosition): void {
    const token = this.enemyTokens.get(enemy.instanceId);
    if (!token) return;
    const c = this.grid.tileToWorldCenter(to);
    const duration = this.scaledDuration(ANIM_MS);
    const isBoss = BattleScene.isBossRole(enemy.def.role);
    const radius = this.grid.tileSize * (isBoss ? 0.44 : 0.32);
    const badge = this.enemyStatusBadges.get(enemy.instanceId);
    const banner = this.enemyBossBanners.get(enemy.instanceId);
    const ring = this.enemyAuraRings.get(enemy.instanceId);
    const badgeY = c.y - radius - (isBoss ? 32 : 14);
    if (duration <= 0) {
      // Reduced motion / instant speed: skip the tween, snap straight there.
      token.circle.setPosition(c.x, c.y);
      token.label.setPosition(c.x, c.y - 4);
      token.hp.setPosition(c.x, c.y + this.grid.tileSize * 0.2);
      badge?.setPosition(c.x, badgeY);
      banner?.setPosition(c.x, c.y - radius - 14);
      ring?.setPosition(c.x, c.y);
      return;
    }
    this.tweens.add({ targets: [token.circle, token.label], x: c.x, y: c.y, duration });
    this.tweens.add({ targets: token.hp, x: c.x, y: c.y + this.grid.tileSize * 0.2, duration });
    if (badge) this.tweens.add({ targets: badge, x: c.x, y: badgeY, duration });
    if (banner) this.tweens.add({ targets: banner, x: c.x, y: c.y - radius - 14, duration });
    if (ring) this.tweens.add({ targets: ring, x: c.x, y: c.y, duration });
  }

  /** Scale a base tween duration by the player's animation-speed setting. */
  private scaledDuration(baseMs: number): number {
    return Math.round(baseMs * durationScaleFor(this.animationSpeed));
  }

  /**
   * KI-085/D-130: cycle Game Speed (Normal -> Fast -> Instant -> Normal),
   * persisting immediately so the Main Menu's own control (and the next
   * battle) picks up the same value. Every tween/pause this scene plays
   * reads `this.animationSpeed` live via `scaledDuration`, so this takes
   * effect on the very next one — no need to restart the battle. D-152:
   * public (was private) and now RETURNS the new speed, so the pause
   * menu's own "Game Speed" button can reuse this exact logic (rather than
   * a second copy of it) and relabel itself from the result.
   */
  cycleGameSpeed(): AnimationSpeed {
    return this.setAnimationSpeed(nextAnimationSpeed(this.animationSpeed));
  }

  /** D-16x: sets Game Speed directly (SettingsScene's list-picker button, replacing its old click-to-cycle), sharing `cycleGameSpeed`'s exact persist/log behavior. */
  setAnimationSpeed(speed: AnimationSpeed): AnimationSpeed {
    this.animationSpeed = speed;
    // Preserve every other stored setting (D-153's volume/mute fields) rather
    // than overwriting the whole record with just this one field.
    saveSettings(window.localStorage, SETTINGS_STORAGE_KEY, {
      ...loadSettings(window.localStorage, SETTINGS_STORAGE_KEY),
      animationSpeed: this.animationSpeed,
    });
    this.logCombat(`Game speed: ${ANIMATION_SPEED_LABELS[this.animationSpeed]}`);
    return this.animationSpeed;
  }

  /** D-152: the pause menu's initial "Game Speed: {label}" text, without cycling it. */
  animationSpeedLabel(): string {
    return ANIMATION_SPEED_LABELS[this.animationSpeed];
  }

  /**
   * D-152: false only for a coop battle (`CoopLobbyScene` has no
   * `CharacterBuild[]` to save — see `originalParty`'s own doc comment).
   */
  canSaveParty(): boolean {
    return this.originalParty !== undefined;
  }

  /**
   * D-152: the in-battle pause menu's "Save Party"/"Save & Exit" action —
   * saves the party's ORIGINAL (pre-battle) build, same as
   * `CharacterCreationScene.onSaveParty` does, via the same shared
   * `SaveSystem.saveOrUpdatePartySlot` decision. Does NOT capture this
   * battle's own progress (wave/gold/structures) — no mechanism for that
   * exists anywhere in this project yet (see D-152's own writeup). Returns
   * `null` if `canSaveParty()` is false, or if the save slot cap was
   * reached while creating a new slot.
   */
  saveParty(): SavePartyResult | null {
    if (!this.originalParty) return null;
    const file = loadSaveFile(window.localStorage, SAVE_STORAGE_KEY);
    const result = saveOrUpdatePartySlot(file, {
      loadedSlotId: this.loadedSlotId,
      builds: this.originalParty,
      partySize: this.heroDefinitions.length,
      difficultyId: this.difficultyId,
      now: Date.now(),
    });
    if (!result) return null;
    saveSaveFile(window.localStorage, SAVE_STORAGE_KEY, result.file);
    this.loadedSlotId = result.slotId;
    return result;
  }

  private breachEnemyToken(enemy: Enemy): void {
    const c = this.grid.tileToWorldCenter(enemy.position);
    this.flashTile(c.x, c.y, COLORS.breachFlash, 0.7, 360);
    this.destroyEnemyToken(enemy.instanceId);
    this.logCombat(`${enemy.def.name} breached the exit (-${enemy.breachDamage})`);
  }

  private destroyEnemyToken(instanceId: string): void {
    const token = this.enemyTokens.get(instanceId);
    if (!token) return;
    token.circle.destroy();
    token.label.destroy();
    token.hp.destroy();
    this.enemyTokens.delete(instanceId);
    this.enemyStatusBadges.get(instanceId)?.destroy();
    this.enemyStatusBadges.delete(instanceId);
    this.enemyBossBanners.get(instanceId)?.destroy();
    this.enemyBossBanners.delete(instanceId);
    this.enemyAuraRings.get(instanceId)?.destroy();
    this.enemyAuraRings.delete(instanceId);
  }

  /** Phase 13.10 (D-095)/20 (D-111): every tier above ordinary minions gets the big-token/banner treatment. */
  private static isBossRole(role: EnemyRole | undefined): boolean {
    return role === "miniboss" || role === "boss" || role === "legendary";
  }

  /** The boss banner's trailing label — distinguishes a miniboss/boss/legendary from each other. */
  private static bossBannerSuffix(role: EnemyRole | undefined): string {
    if (role === "legendary") return "(Legendary)";
    return role === "boss" ? "(Boss)" : "(Miniboss)";
  }

  /**
   * Phase 20 (D-111): false only for a `def.stealth` enemy that hasn't
   * broken cover yet — every hero-initiated targeting path (basic attack,
   * ability aiming, spellbook aiming, the AI's own candidate list) filters
   * through this so a hidden assassin can't be clicked or auto-targeted
   * before its ambush. Enemy-initiated pathing/occupancy checks (movement
   * blocking, build-tile occupancy) do NOT use this — a hidden enemy still
   * physically occupies its tile.
   *
   * D-127: `observerHero`, when given, lets Rogue's Blindsense/Ranger's
   * Feral Senses see through the global-hidden check for THAT hero
   * specifically — a still-hidden enemy stays untargetable to every other
   * hero (and to the AI candidate list when no specific hero is passed),
   * exactly the "per-observer" exception `data/classes.ts` previously
   * flagged as needing its own targeting model.
   */
  private isEnemyTargetable(enemy: Enemy, observerHero?: Hero): boolean {
    if (enemy.def.stealth === true && !enemy.isRevealed) {
      if (!observerHero?.hasStealthSense) return false;
      if (CombatSystem.range(observerHero.position, enemy.position) > STEALTH_SENSE_RANGE_TILES) return false;
    }
    // Phase 21 (D-112): a still-disguised Mimic reads as scenery/treasure,
    // not a hostile token — untargetable the same way a hidden stealth
    // enemy is, but revealed by PROXIMITY (see `WaveSystem.tickEnemyPhase`)
    // rather than its own first strike. Blindsense/Feral Senses are a
    // stealth-specific sense (SRD wording: "hidden or invisible creatures"),
    // not a disguise-piercing one, so a Mimic gets no exception here.
    if (enemy.def.mimicDisguise === true && !enemy.isRevealed) return false;
    return true;
  }

  /**
   * Phase 13.1 (D-086): true if an attack result actually connected — an
   * `autoHit` attack has no `roll` at all (it always lands), so absence of a
   * roll counts as a hit; otherwise it's whatever the d20 roll decided.
   */
  private static didHit(result: AttackResult): boolean {
    return result.roll ? result.roll.hit : true;
  }

  /** "defeats"/"critically hits"/"hits"/"misses", for a combat log line. */
  private static attackVerb(result: AttackResult): string {
    if (result.defeated) return "defeats";
    if (!BattleScene.didHit(result)) return "misses";
    return result.roll?.critical ? "critically hits" : "hits";
  }

  /** An enemy strikes a hero: flash the hero and log it (HP synced by caller). */
  private showEnemyAttack(atk: EnemyAttackEvent): void {
    const verb = BattleScene.attackVerb(atk.result);
    const enemyToken = this.enemyTokens.get(atk.enemy.instanceId);
    if (enemyToken) this.lungeToward(enemyToken, atk.enemy.position, atk.target.position);
    if (BattleScene.didHit(atk.result)) {
      const c = this.grid.tileToWorldCenter(atk.target.position);
      this.flashTile(c.x, c.y, COLORS.heroHurtFlash, 0.6, 320);
    }
    const suffix = BattleScene.didHit(atk.result) ? ` for ${atk.result.damageDealt}` : "";
    const dodgeSuffix = this.uncannyDodgedThisPhase.has(atk) ? " (halved by Uncanny Dodge)" : "";
    const resistSuffix = this.damageResistedThisPhase.has(atk) ? " (halved by Rage/Wild Shape)" : "";
    const cuttingWordsBard = this.cuttingWordsAppliedThisPhase.get(atk);
    const cuttingWordsSuffix = cuttingWordsBard ? ` (weakened by ${cuttingWordsBard}'s Cutting Words)` : "";
    this.logCombat(
      `${atk.enemy.def.name} ${verb} ${this.nameOfCombatant(atk.target.id)}${suffix}${dodgeSuffix}${resistSuffix}${cuttingWordsSuffix}`,
    );
    this.logTechnical(BattleScene.technicalAttackLine(atk.enemy.def.name, this.nameOfCombatant(atk.target.id), atk.result));
  }

  /**
   * Phase 13.2 (D-087): Uncanny Dodge auto-applies (Kevin's call — no
   * interrupt-prompt UI exists) the instant `tickEnemyPhase` returns, before
   * any animation/log renders, so what the player sees already reflects the
   * halved damage. `CombatSystem`/`WaveSystem` stay unaware of hero-specific
   * class features (same layering as potions/equipment) — this is a
   * BattleScene-only post-process over the report's `AttackResult` objects.
   */
  private applyUncannyDodges(report: EnemyPhaseReport): void {
    this.uncannyDodgedThisPhase = new Set();
    for (const atk of report.attacks) {
      if (atk.result.damageDealt <= 0) continue;
      const hero = this.heroById(atk.target.id);
      if (!hero || !hero.canUseUncannyDodge()) continue;
      const halved = Math.floor(atk.result.damageDealt / 2);
      const restored = atk.result.damageDealt - halved;
      hero.health = Math.min(hero.effectiveMaxHealth, hero.health + restored);
      atk.result.damageDealt = halved;
      atk.result.healthAfter = hero.health;
      atk.result.defeated = atk.result.healthBefore > 0 && hero.health <= 0;
      hero.useUncannyDodge();
      this.uncannyDodgedThisPhase.add(atk);
    }
  }

  /**
   * Phase 13.8 (D-093): Rage (Barbarian)/Wild Shape (Druid) auto-applies the
   * same way Uncanny Dodge does (called right after it) — halves damage
   * from every hit against a hero with an active damage-resistance buff.
   * Independent of Uncanny Dodge (a hero is single-class, never both).
   */
  private applyDamageResistanceBuffs(report: EnemyPhaseReport): void {
    this.damageResistedThisPhase = new Set();
    for (const atk of report.attacks) {
      if (atk.result.damageDealt <= 0) continue;
      const hero = this.heroById(atk.target.id);
      if (!hero || !hero.hasDamageResistance) continue;
      const halved = Math.floor(atk.result.damageDealt / 2);
      const restored = atk.result.damageDealt - halved;
      hero.health = Math.min(hero.effectiveMaxHealth, hero.health + restored);
      atk.result.damageDealt = halved;
      atk.result.healthAfter = hero.health;
      atk.result.defeated = atk.result.healthBefore > 0 && hero.health <= 0;
      this.damageResistedThisPhase.add(atk);
    }
  }

  /**
   * D-124: College of Lore's Cutting Words — spends a Bard's own reaction
   * (not the target's) and a Bardic Inspiration use to weaken a landed blow
   * against ANY living hero, reusing Uncanny Dodge's exact "reduce the
   * already-computed `AttackResult` before it renders" shape
   * (`applyUncannyDodges`, above), generalized to a flat reduction
   * (`BARDIC_INSPIRATION_BONUS`, the same number Bardic Inspiration's own
   * bonus already uses) and to protecting any ally, not just the Bard
   * itself. Called right after the self-mitigation passes above, so it
   * reduces whatever damage those already left standing.
   */
  private applyCuttingWords(report: EnemyPhaseReport): void {
    this.cuttingWordsAppliedThisPhase = new Map();
    for (const atk of report.attacks) {
      if (atk.result.damageDealt <= 0) continue;
      const target = this.heroById(atk.target.id);
      if (!target || !target.isAlive()) continue;
      const bard = this.heroes.find((h) => h.canUseCuttingWords());
      if (!bard) continue;
      bard.useCuttingWords();
      const reduction = Math.min(atk.result.damageDealt, BARDIC_INSPIRATION_BONUS);
      target.health = Math.min(target.effectiveMaxHealth, target.health + reduction);
      atk.result.damageDealt -= reduction;
      atk.result.healthAfter = target.health;
      atk.result.defeated = atk.result.healthBefore > 0 && target.health <= 0;
      this.cuttingWordsAppliedThisPhase.set(atk, bard.name);
    }
  }

  /**
   * D-124: Path of the Berserker's Retaliation (level 14+) — once per turn,
   * a hero that just took damage from an ADJACENT attacker immediately
   * strikes back, spending its own reaction. `removeDefeated()`/
   * `resolveDeaths()` (called later, inside `tickEnemyPhase`'s own
   * `delayedCall`) already funnel through every enemy-removal cause
   * generically, so a Retaliation kill gets the exact same gold/loot/
   * death-trigger handling as any other — nothing extra to wire here.
   */
  private applyRetaliations(report: EnemyPhaseReport): void {
    for (const atk of report.attacks) {
      if (atk.result.damageDealt <= 0 || !atk.enemy.isAlive()) continue;
      if (CombatSystem.range(atk.enemy.position, atk.target.position) > 1) continue;
      const hero = this.heroById(atk.target.id);
      if (!hero || !hero.canUseRetaliation()) continue;
      hero.useRetaliation();
      const profile: AttackProfile = {
        rangeTiles: 1,
        damage: hero.effectiveAttackDamage,
        attackBonus: hero.effectiveAttackBonus,
      };
      const result = CombatSystem.applyAttack(atk.enemy, profile, this.random);
      const verb = BattleScene.attackVerb(result);
      const suffix = BattleScene.didHit(result) ? ` for ${result.damageDealt}` : "";
      this.logCombat(`${hero.name} retaliates and ${verb} ${atk.enemy.def.name}${suffix}`);
      this.logTechnical(BattleScene.technicalAttackLine(hero.name, atk.enemy.def.name, result));
    }
  }

  /** Refresh every hero token's HP/status badge and remove any hero that has fallen. */
  private syncHeroTokens(): void {
    for (const hero of this.heroes) {
      const token = this.heroTokens.get(hero.id);
      if (!token) continue;
      if (!hero.isAlive()) {
        token.circle.destroy();
        token.label.destroy();
        token.hp.destroy();
        token.sprite?.destroy();
        this.heroTokens.delete(hero.id);
        this.heroStatusBadges.get(hero.id)?.destroy();
        this.heroStatusBadges.delete(hero.id);
        this.heroCapes.get(hero.id)?.destroy();
        this.heroCapes.delete(hero.id);
      } else {
        this.updateHpText(token, hero.health, hero.effectiveMaxHealth);
        this.updateHeroStatusBadge(hero);
      }
    }
  }

  /** Phase 21 (D-112): refresh a hero's on-token status badge from its active enemy-inflicted effects — mirrors `updateStatusBadge`. */
  private updateHeroStatusBadge(hero: Hero): void {
    const badge = this.heroStatusBadges.get(hero.id);
    if (!badge) return;
    const codes = STATUS_EFFECT_ORDER.filter((id) => hero.hasStatus(id)).map(
      (id) => getStatusEffectDefinition(id).name[0],
    );
    // D-125: Reckless Attack/hidden aren't enemy-inflicted `StatusEffectId`s
    // (both are self-toggled Hero flags), so neither can join the loop
    // above — added as their own letter codes instead, same visible-badge
    // treatment.
    if (hero.grantsAttackerAdvantage) codes.push("K");
    if (hero.isHidden) codes.push("V");
    if (codes.length === 0) {
      badge.setVisible(false);
      return;
    }
    badge.setText(codes.join("")).setVisible(true);
  }

  // ----- Hero interaction (movement carried from Phase 2) ---------------

  private setInteraction(next: Interaction): void {
    const prevKind = this.ui.kind;
    this.ui = next;
    // D-158: also hides any lingering item-preview tooltip from whatever
    // mode this is leaving.
    this.setHoveredItem(null);

    // KI-030: entering build/equip mode from anywhere else defaults keyboard
    // focus to the item grid (there's nothing useful to place/equip until an
    // item is picked); leaving it returns focus to the board. Switching
    // between items WITHIN the same mode (e.g. clicking a different shop
    // slot) keeps whatever focus/index already matches the new selection, so
    // keyboard and mouse selection never fight over grid position.
    const enteringGridMode =
      next.kind === "building" || next.kind === "equipping" || this.isDebugGridKind(next.kind);
    if (enteringGridMode) {
      if (prevKind !== "building" && prevKind !== "equipping" && !this.isDebugGridKind(prevKind)) this.keyboardFocus = "grid";
      const items = this.currentGridItems(); // this.ui already === next, set above
      const currentId =
        next.kind === "building"
          ? next.defId
          : next.kind === "equipping"
            ? next.itemId
            : next.kind === "debugSpawnEnemy"
              ? next.enemyId
              : next.kind === "debugPaintTerrain"
                ? next.tileType
                : next.kind === "debugStatus"
                  ? next.statusId
                  : undefined;
      const idx = currentId ? items.indexOf(currentId) : -1;
      this.gridFocusIndex = idx >= 0 ? idx : 0;
    } else {
      this.keyboardFocus = "board";
    }
    this.clearRange();
    this.clearTargets();
    this.clearPath();
    this.pendingRect.setVisible(false);
    this.showConfirmButtons(false);
    this.showAbilityButton(false);
    this.showPotionButton(false);
    this.showBonusActionButton(false);
    this.showActionSurgeButton(false);
    this.showClassActionButton(false);
    this.showCharacterSheetButton(false);
    this.showHotkeyButtons(false);
    this.activeRing.setVisible(false);
    this.buildGhost.setVisible(false);
    this.buildGhostGlyph.setVisible(false);
    this.showShopUI(next.kind === "building", next.kind === "building" ? next.defId : undefined);
    this.showEquipUI(next.kind === "equipping", next.kind === "equipping" ? next.itemId : undefined);
    this.showDebugPickerUI();
    this.refreshPageNav();
    const modeActive = next.kind === "building" || next.kind === "equipping" || this.isDebugGridKind(next.kind);
    this.doneButton.setVisible(modeActive);
    this.doneLabel.setVisible(modeActive);
    // Phase 13.7 (D-092): the spellbook overlay only ever exists while
    // ui.kind is "choosingSpell" — leaving that state (for any reason,
    // including Esc/re-selecting/attacking) always tears it down.
    this.clearSpellbookOverlay();

    if (
      next.kind === "heroSelected" ||
      next.kind === "confirmingMove" ||
      next.kind === "aimingSpell" ||
      next.kind === "aimingTileSpell"
    ) {
      const hero = this.heroById(next.heroId);
      if (hero) {
        const c = this.grid.tileToWorldCenter(hero.position);
        this.activeRing.setPosition(c.x, c.y).setVisible(true);
        if (next.kind === "heroSelected") {
          this.showRange(hero);
          this.showBasicAttackTargets(hero);
          this.showAbilityButtonFor(hero);
          this.showPotionButtonFor(hero);
          this.showBonusActionButtonFor(hero);
          this.showActionSurgeButtonFor(hero);
          this.showClassActionButtonFor(hero);
          this.showCharacterSheetButton(true);
          this.showHotkeyButtonsFor(hero);
        }
        if (next.kind === "aimingSpell") {
          this.showSpellTargets(hero, next.abilityId);
        }
        if (next.kind === "aimingTileSpell") {
          this.showTileSpellTargets(hero, next.abilityId);
        }
      }
    }
    if (next.kind === "confirmingMove") {
      const c = this.grid.tileToWorldCenter(next.dest);
      this.pendingRect.setPosition(c.x, c.y).setVisible(true);
      this.showConfirmButtons(true);
    }
    if (next.kind === "choosingSpell") {
      this.spellbookPage = 0;
      const hero = this.heroById(next.heroId);
      if (hero) this.renderSpellbookOverlay(hero);
    }
    this.refreshStatus();
    // D-132: selecting/deselecting a hero can change whether a hit-chance
    // line belongs on the tooltip for whatever tile the mouse already sits
    // on, even with no mouse movement of its own.
    this.updateUnitTooltip(this.cursorPos);
  }

  private showRange(hero: Hero): void {
    if (!hero.canMove()) return;
    const tiles = this.movement.reachableTiles({
      start: hero.position,
      budget: hero.movementBudget(),
      isOccupied: (p) => this.isHeroMovementBlocked(p),
      blocksStopping: (p) => this.isHeroStoppingBlocked(p, hero.id),
    });
    for (const tile of tiles) {
      const c = this.grid.tileToWorldCenter(tile);
      this.rangeTiles.push(
        this.add.rectangle(c.x, c.y, this.grid.tileSize - 4, this.grid.tileSize - 4, COLORS.moveRange, 0.35).setDepth(2),
      );
    }
  }

  private clearRange(): void {
    for (const r of this.rangeTiles) r.destroy();
    this.rangeTiles = [];
  }

  /** Outline enemies a selected hero could basic-attack right now. */
  private showBasicAttackTargets(hero: Hero): void {
    if (!hero.canAct()) return;
    const profile = this.attackProfileFor(hero);
    const targets = CombatSystem.targetsInRange(
      hero.position,
      profile.rangeTiles,
      this.waveSystem.enemies,
    );
    for (const enemy of targets) this.markTarget(enemy.position, COLORS.attackTarget);
  }

  /**
   * A hero's basic-attack profile: base stats (Phase 7: level-up bonuses and
   * one equipped item, via `Hero.effectiveAttackDamage`) plus any Melee
   * Platform / Ranged Perch bonus for the tile the hero is currently standing
   * on. Used both to resolve the attack and to preview its targets, so the
   * highlighted enemies always match what the attack will actually reach.
   */
  private attackProfileFor(hero: Hero): AttackProfile {
    const bonus = this.buildSystem.platformBonusFor(hero.position, hero.attackRangeTiles > 1);
    return {
      rangeTiles: hero.attackRangeTiles + bonus.attackRangeTiles,
      damage: hero.effectiveAttackDamage + bonus.attackDamage,
      // Phase 14.2 (D-099): College of the Blade/Zeal Domain/Battle
      // Tactician's flat, always-on to-hit bonus — 0 for every other hero.
      // Phase 16 (D-106): `effectiveAttackBonus` folds in any active ally
      // buff (e.g. Bless) on top of the raw `attackBonus` field.
      attackBonus: hero.effectiveAttackBonus + hero.subclassAttackBonus,
      // Phase 13.11 (D-096): Champion's Improved/Superior Critical widen this
      // hero's crit range on a weapon attack; 20 (the default) for everyone
      // else. Ability-based attacks (castAbilityOn, etc.) don't read this —
      // the SRD's own Improved Critical applies to weapon attacks, not spells.
      critThreshold: hero.critThreshold,
      // Phase 21 (D-112): an enemy-inflicted "blinded"-family status rolls
      // this hero's own attack with disadvantage, same as an enemy under
      // "blinded"/"sapped"/"toppled" already does. D-125: Reckless Attack
      // overrides that with Advantage (same "no cancellation modeled"
      // simplification every other Advantage source here already makes).
      advantage: hero.recklessAttackAdvantage ? "advantage" : hero.attacksWithDisadvantage ? "disadvantage" : undefined,
      // D-127: a real weapon's damage type, for Swarm-style resistance —
      // undefined with no weapon equipped, so resistance never applies to a
      // flat/unarmed attack.
      damageType: hero.attackDamageType,
      magical: hero.attackIsMagical,
    };
  }

  /**
   * Phase 13.7 (D-092): outline whatever a chosen spell could hit — enemies
   * for a normal spell, or living allies (INCLUDING the caster itself) for
   * a `targetsAlly` spell like Cure Wounds.
   */
  private showSpellTargets(hero: Hero, abilityId: string): void {
    const ability = getAbility(abilityId);
    if (ability.targetsAlly) {
      for (const ally of this.livingAlliesInRange(hero.position, ability.rangeTiles)) {
        this.markTarget(ally.position, COLORS.abilityTarget, "◆");
      }
      return;
    }
    const targets = CombatSystem.targetsInRange(hero.position, ability.rangeTiles, this.waveSystem.enemies);
    for (const enemy of targets) this.markTarget(enemy.position, COLORS.abilityTarget, "◆");
  }

  /**
   * Phase 16 (D-106): true if a hero could stand on `pos` right now — no
   * hero, no enemy, no wall/blocking structure, not the spawn tile. Shared
   * by every tile-targeting spell (teleport, summon placement, terrain
   * placement) that needs an EMPTY tile, as opposed to `aoeAtRange`, which
   * may target any tile at all (including one an enemy stands on).
   */
  private isTileEmptyForPlacement(pos: GridPosition): boolean {
    return (
      this.map.isInBounds(pos) &&
      this.map.isWalkable(pos) &&
      !this.isHeroMovementBlocked(pos) &&
      !this.isLivingHeroAt(pos)
    );
  }

  /** Outline every valid target tile for a tile-aimed spell (`aoeAtRange`/teleport/summon/terrain). */
  private showTileSpellTargets(hero: Hero, abilityId: string): void {
    const ability = getAbility(abilityId);
    for (let y = 0; y < this.map.rows; y++) {
      for (let x = 0; x < this.map.cols; x++) {
        const tile = { x, y };
        if (GridSystem.diagonalDistance(hero.position, tile) > ability.rangeTiles) continue;
        if (ability.kind === "aoeAtRange") {
          this.markTarget(tile, COLORS.abilityTarget, "◆");
        } else if (this.isTileEmptyForPlacement(tile)) {
          this.markTarget(tile, COLORS.abilityTarget, "◆");
        }
      }
    }
  }

  /**
   * Living heroes within `rangeTiles` of `from`, INCLUDING one standing
   * exactly on `from` itself (self-targeting) — unlike
   * `CombatSystem.targetsInRange`, which only ever considers distinct
   * tiles. The one targeting rule an ally-heal spell needs that no existing
   * enemy-targeting helper provides.
   */
  private livingAlliesInRange(from: GridPosition, rangeTiles: number): Hero[] {
    return this.heroes.filter((h) => h.isAlive() && GridSystem.diagonalDistance(from, h.position) <= rangeTiles);
  }

  /**
   * `glyph` (Phase 8): ability targets get a small corner marker in addition
   * to their outline colour, since attackTarget/abilityTarget are both warm
   * hues that read too similarly for colour-blind players otherwise.
   */
  private markTarget(pos: GridPosition, color: number, glyph?: string): void {
    const c = this.grid.tileToWorldCenter(pos);
    this.targetMarks.push(
      this.add
        .rectangle(c.x, c.y, this.grid.tileSize - 8, this.grid.tileSize - 8, color, 0)
        .setStrokeStyle(3, color)
        .setDepth(8),
    );
    if (glyph) {
      this.targetGlyphs.push(
        this.add
          .text(c.x + this.grid.tileSize * 0.28, c.y - this.grid.tileSize * 0.28, glyph, {
            fontFamily: "system-ui, Arial, sans-serif",
            fontSize: "14px",
            color: "#ffffff",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setDepth(8),
      );
    }
  }

  private clearTargets(): void {
    for (const t of this.targetMarks) t.destroy();
    this.targetMarks = [];
    for (const g of this.targetGlyphs) g.destroy();
    this.targetGlyphs = [];
  }

  private showPath(hero: Hero, dest: GridPosition): void {
    this.clearPath();
    const path = this.movement.findPath(dest, {
      start: hero.position,
      budget: hero.movementBudget(),
      isOccupied: (p) => this.isHeroMovementBlocked(p),
      blocksStopping: (p) => this.isHeroStoppingBlocked(p, hero.id),
    });
    if (!path) return;
    for (const step of path) {
      const c = this.grid.tileToWorldCenter(step);
      this.pathDots.push(this.add.circle(c.x, c.y, 6, COLORS.pathStep, 0.95).setDepth(4));
    }
  }

  private clearPath(): void {
    for (const d of this.pathDots) d.destroy();
    this.pathDots = [];
  }

  private clearDragPinMarks(): void {
    for (const m of this.dragPinMarks) m.destroy();
    this.dragPinMarks = [];
  }

  /**
   * Drag-and-drop hero move: right-click while `heroDrag` is active pins a
   * waypoint at the pointer's current tile — pinning again adds ANOTHER
   * waypoint in a chain, so a long move can be routed around several
   * corners one pin at a time. A duplicate of the last pin (or of the
   * hero's own position, if there are no pins yet) is ignored rather than
   * added, matching `MovementSystem.routeThroughWaypoints`'s own "adjacent
   * duplicate waypoint is a no-op" rule. A no-op when no drag is active
   * (the native context menu is already suppressed scene-wide regardless).
   */
  private addDragPin(tile: GridPosition | null, worldX: number, worldY: number): void {
    if (!this.heroDrag || !tile) return;
    const hero = this.heroById(this.heroDrag.heroId);
    if (!hero) return;
    const last = this.heroDrag.pins[this.heroDrag.pins.length - 1] ?? hero.position;
    if (GridSystem.equals(last, tile)) return;
    this.heroDrag.pins.push({ ...tile });
    this.updateDragRangeHighlight();
    this.updateDragPreview(tile, worldX, worldY);
  }

  /**
   * Redraws the move-range highlight (normally `showRange`'s job) rooted at
   * the LATEST pinned waypoint with whatever budget is left after the
   * already-pinned legs, instead of leaving `showRange`'s original
   * from-the-hero's-own-tile highlight sitting there stale throughout a
   * multi-pin drag. Called whenever the pin chain changes.
   */
  private updateDragRangeHighlight(): void {
    if (!this.heroDrag) return;
    const hero = this.heroById(this.heroDrag.heroId);
    if (!hero) return;
    this.clearRange();
    let start = hero.position;
    let usedTiles = 0;
    if (this.heroDrag.pins.length > 0) {
      const pinRoute = this.movement.routeThroughWaypoints(this.heroDrag.pins, {
        start: hero.position,
        budget: hero.movementBudget(),
        isOccupied: (p) => this.isHeroMovementBlocked(p),
      });
      if (!pinRoute) return; // the pinned chain itself is unreachable — nothing to preview
      start = this.heroDrag.pins[this.heroDrag.pins.length - 1];
      usedTiles = pinRoute.usedTiles;
    }
    const remaining = hero.movementBudget() - usedTiles;
    if (remaining <= 0) return;
    const tiles = this.movement.reachableTiles({
      start,
      budget: remaining,
      isOccupied: (p) => this.isHeroMovementBlocked(p),
      blocksStopping: (p) => this.isHeroStoppingBlocked(p, hero.id),
    });
    for (const tile of tiles) {
      const c = this.grid.tileToWorldCenter(tile);
      this.rangeTiles.push(
        this.add.rectangle(c.x, c.y, this.grid.tileSize - 4, this.grid.tileSize - 4, COLORS.moveRange, 0.35).setDepth(2),
      );
    }
  }

  /**
   * Drag-and-drop hero move: called on every `pointermove` while `heroDrag`
   * is active (in place of the normal `updateHoverAt`/`showPath` hover
   * flow) and once more right after a pin is added. Moves the dragged
   * token to the raw pointer position (the "picked up" feel — not snapped
   * to a tile), then redraws the pinned-corner markers and the previewed
   * route through them to `tile`, reusing `showPath`'s own dot styling
   * (recolored to the existing "rejected" tint when the full pinned route
   * is unreachable or over budget) and a live tile-count readout via the
   * existing hover tooltip object (mutually exclusive with its normal
   * hero/enemy-hover use, since that's skipped entirely while dragging).
   */
  private updateDragPreview(tile: GridPosition | null, worldX: number, worldY: number): void {
    if (!this.heroDrag) return;
    const hero = this.heroById(this.heroDrag.heroId);
    const token = hero ? this.heroTokens.get(hero.id) : undefined;
    if (!hero || !token) return;

    token.circle.setPosition(worldX, worldY);
    token.label.setPosition(worldX, worldY - 4);
    token.hp.setPosition(worldX, worldY + this.grid.tileSize * 0.2);
    token.sprite?.setPosition(worldX, worldY);

    if (tile) {
      const c = this.grid.tileToWorldCenter(tile);
      this.hoverRect.setPosition(c.x, c.y).setVisible(true);
    } else {
      this.hoverRect.setVisible(false);
    }

    this.clearPath();
    this.clearDragPinMarks();
    for (const pin of this.heroDrag.pins) {
      const c = this.grid.tileToWorldCenter(pin);
      this.dragPinMarks.push(this.add.circle(c.x, c.y, 8, COLORS.abilityTarget, 0.9).setDepth(5));
    }

    if (!tile) {
      this.tooltip.hide();
      return;
    }
    const route = this.movement.routeThroughWaypoints([...this.heroDrag.pins, tile], {
      start: hero.position,
      budget: hero.movementBudget(),
      isOccupied: (p) => this.isHeroMovementBlocked(p),
      blocksStopping: (p) => this.isHeroStoppingBlocked(p, hero.id),
    });
    const dotColor = route && route.withinBudget ? COLORS.pathStep : COLORS.tileRejected;
    for (const step of route?.path ?? []) {
      const c = this.grid.tileToWorldCenter(step);
      this.pathDots.push(this.add.circle(c.x, c.y, 6, dotColor, 0.95).setDepth(4));
    }
    const label = route
      ? `${route.usedTiles} tile${route.usedTiles === 1 ? "" : "s"}${route.withinBudget ? "" : " — out of range"}`
      : "Blocked";
    this.showUnitTooltipAt(tile, label);
  }

  /**
   * Drag-and-drop hero move: releasing the left button while `heroDrag` is
   * active. `tile` is wherever the pointer was released (null off-board).
   * Picking the hero up and putting it straight back down (no pins, drop
   * tile is its own tile) is a silent cancel; a route that's unreachable or
   * over budget snaps the token back with the same rejection flash/message
   * `handleClick`'s illegal-move path already uses, staying in
   * `heroSelected` rather than falling back to `idle` — a deliberate drag
   * is a stronger signal than a stray illegal click. A real, in-budget
   * route commits exactly like `confirmMove`.
   */
  private resolveDrop(tile: GridPosition | null): void {
    const drag = this.heroDrag;
    this.heroDrag = null;
    this.clearDragPinMarks();
    this.clearPath();
    this.tooltip.hide();
    if (!drag) return;

    const hero = this.heroById(drag.heroId);
    const token = hero ? this.heroTokens.get(hero.id) : undefined;
    if (!hero || !token) return;

    if (!tile || (drag.pins.length === 0 && GridSystem.equals(tile, hero.position))) {
      this.placeToken(token, hero.position); // picked up, put back down — snap back, no message
      return;
    }

    const route = this.movement.routeThroughWaypoints([...drag.pins, tile], {
      start: hero.position,
      budget: hero.movementBudget(),
      isOccupied: (p) => this.isHeroMovementBlocked(p),
      blocksStopping: (p) => this.isHeroStoppingBlocked(p, hero.id),
    });
    if (!route || !route.withinBudget) {
      this.rejectAt(tile, "Out of range");
      this.placeToken(token, hero.position);
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }

    // D-173: pass the route's real tile cost so a partial drag-move leaves
    // any leftover budget spendable later this turn instead of consuming it
    // all outright.
    hero.moveTo(tile, route.usedTiles);
    this.moveHeroToken(token, hero.position);
    this.checkTreasureAt(hero);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Esc while a drag is active cancels it — same "picked up, put back
   * down" snap-back `resolveDrop` uses for a no-op drop, just triggered by
   * the keyboard instead of a pointer release. Checked first in
   * `handleEscape` so it takes priority over every other Esc behavior.
   */
  private cancelDrag(): void {
    const drag = this.heroDrag;
    this.heroDrag = null;
    this.dragArmedHeroId = null;
    this.clearDragPinMarks();
    this.clearPath();
    this.tooltip.hide();
    if (!drag) return;
    const hero = this.heroById(drag.heroId);
    const token = hero ? this.heroTokens.get(hero.id) : undefined;
    if (hero && token) this.placeToken(token, hero.position);
  }

  /**
   * Tweens a hero's token to `to` with the same pacing/instant-speed
   * fallback `moveEnemyToken` already established for enemies — used by
   * both `confirmMove` and a successful drag-and-drop drop, so a hero's
   * move reads with the same polish an enemy's already has.
   */
  private moveHeroToken(token: Token, to: GridPosition): void {
    const c = this.grid.tileToWorldCenter(to);
    const duration = this.scaledDuration(ANIM_MS);
    if (duration <= 0) {
      this.placeToken(token, to);
      return;
    }
    this.tweens.add({ targets: token.circle, x: c.x, y: c.y, duration });
    this.tweens.add({ targets: token.label, x: c.x, y: c.y - 4, duration });
    this.tweens.add({ targets: token.hp, x: c.x, y: c.y + this.grid.tileSize * 0.2, duration });
    if (token.sprite) this.tweens.add({ targets: token.sprite, x: c.x, y: c.y, duration });
  }

  private showConfirmButtons(show: boolean): void {
    this.confirmButton.setVisible(show);
    this.confirmLabel.setVisible(show);
    this.cancelButton.setVisible(show);
    this.cancelLabel.setVisible(show);
  }

  private showAbilityButton(show: boolean): void {
    this.abilityButton.setVisible(show);
    this.abilityLabel.setVisible(show);
  }

  /**
   * D-178: a non-caster hero has no Q-button action at all anymore — its
   * real weapon Attack is click-to-attack, and its class bonus/class
   * actions already have their own buttons (`showBonusActionButtonFor`/
   * `showClassActionButtonFor`). Only a real caster (`isCasterHero`) gets
   * this button, opening its full spellbook.
   */
  private showAbilityButtonFor(hero: Hero): void {
    if (!hero.canAct() || !this.isCasterHero(hero)) return;
    this.abilityLabel.setText("Cast a Spell (Q)");
    this.showAbilityButton(true);
  }

  /**
   * True for a hero with a real spellbook (`Hero.knownSpellAbilityIds`
   * non-empty) — Wizard/Cleric/Bard/Druid/Sorcerer/Warlock. Phase 13.8
   * (D-093): deliberately checks the KNOWN spell list, not
   * `classDef.spellcasting` presence — Paladin/Ranger are real half-casters
   * with their own slot economy (see data/classes.ts), but that slot
   * economy's one consequence today (Divine Smite, Hunter's Mark) lives on
   * the bonus-action button, not a spellbook, so they have no "Cast a
   * Spell" menu at all.
   */
  private isCasterHero(hero: Hero): boolean {
    return hero.knownSpellAbilityIds().length > 0;
  }

  private showPotionButton(show: boolean): void {
    this.potionButton.setVisible(show);
    this.potionLabel.setVisible(show);
  }

  /** Phase 11.5 (D-078): visible only when the hero can act AND carries a potion. */
  private showPotionButtonFor(hero: Hero): void {
    if (!hero.canAct() || !hero.hasAnyPotion()) return;
    const slot = hero.firstLoadedPotionSlot();
    if (!slot) return;
    const itemId = hero.equippedPotions[slot];
    if (!itemId) return;
    const potion = getPotionDefinition(itemId);
    this.potionLabel.setText(`Potion: ${potion.name} (P)`);
    this.showPotionButton(true);
  }

  private showBonusActionButton(show: boolean): void {
    this.bonusActionButton.setVisible(show);
    this.bonusActionLabel.setVisible(show);
  }

  /**
   * Phase 13.2 (D-087), extended Phase 13.8 (D-093), extracted to
   * `HeroActionRegistry` at D-148: a hero is single-class, so at most one
   * bonus-action feature ever applies at once.
   */
  private showBonusActionButtonFor(hero: Hero): void {
    const action = firstAvailableHeroAction(hero, "bonusAction");
    if (!action) return;
    this.bonusActionLabel.setText(action.label);
    this.showBonusActionButton(true);
  }

  private showActionSurgeButton(show: boolean): void {
    this.actionSurgeButton.setVisible(show);
    this.actionSurgeLabel.setVisible(show);
  }

  /** Phase 13.2 (D-087): Fighter only, once already acted (see Hero.canUseActionSurge). */
  private showActionSurgeButtonFor(hero: Hero): void {
    if (!hero.canUseActionSurge()) return;
    this.actionSurgeLabel.setText("Action Surge (F)");
    this.showActionSurgeButton(true);
  }

  private showClassActionButton(show: boolean): void {
    this.classActionButton.setVisible(show);
    this.classActionLabel.setVisible(show);
  }

  /**
   * D-125, extracted to `HeroActionRegistry` at D-148: a hero is
   * single-class, so at most one of these ever applies — Barbarian's
   * Reckless Attack, Cleric's Channel Divinity: Preserve Life, Ranger's
   * Vanish, Monk's Empty Body. Reckless Attack/Preserve Life spend neither
   * the action nor bonus action's shared slot in `showBonusActionButtonFor`,
   * so this button can be visible AT THE SAME TIME as Rage (Barbarian) — a
   * real Barbarian very often wants both in one turn. Vanish DOES spend the
   * same bonus-action slot Hunter's Mark uses (both set `bonusActed`), so a
   * Ranger may see both buttons but can only actually use one.
   */
  private showClassActionButtonFor(hero: Hero): void {
    const action = firstAvailableHeroAction(hero, "classAction");
    if (!action) return;
    this.classActionLabel.setText(action.label);
    this.showClassActionButton(true);
  }

  private showCharacterSheetButton(show: boolean): void {
    this.characterSheetButton.setVisible(show);
    this.characterSheetLabel.setVisible(show);
  }

  /**
   * D-148: pauses this scene and launches `CharacterSheetScene` for the
   * currently selected hero — a real second Phaser scene (not an in-battle
   * overlay Container), so the sheet can carry its own tabs/`uiTheme`
   * styling without growing this already-large file further. Passes the
   * LIVE `Hero` instance, not an id — scene data isn't serialized for an
   * in-process `scene.launch`, so hotkey edits made there apply directly to
   * this same object, live, with no sync step needed on resume.
   */
  private openCharacterSheet(): void {
    if (this.ui.kind !== "heroSelected") return;
    const hero = this.heroById(this.ui.heroId);
    if (!hero) return;
    this.scene.launch("CharacterSheetScene", { hero });
    this.scene.pause();
  }

  private showHotkeyButtons(show: boolean): void {
    this.hotkeyButtons.forEach((b) => b.setVisible(show));
    this.hotkeyLabels.forEach((l) => l.setVisible(show));
  }

  /**
   * D-165 (KI-098 item 2): shows only the FILLED slots of `hero`'s hotkey
   * bar (an empty slot has nothing worth a button for), dimming one whose
   * id isn't currently usable rather than hiding it — matches
   * `Hero.setActionHotkey`'s own "pinned but not usable right now is
   * normal" precedent.
   */
  private showHotkeyButtonsFor(hero: Hero): void {
    if (!hero.canAct()) return;
    const hotkeys = hero.actionHotkeys();
    for (let slot = 0; slot < ACTION_HOTKEY_SLOT_COUNT; slot++) {
      const id = hotkeys[slot];
      if (!id) continue;
      const usable = this.hotkeyUsable(hero, id);
      this.hotkeyButtons[slot].setVisible(true).setAlpha(usable ? 1 : 0.45);
      this.hotkeyLabels[slot].setVisible(true).setAlpha(usable ? 1 : 0.45).setText(`${slot + 1}: ${hotkeyDisplayLabel(hero, id)}`);
    }
  }

  /** D-165: a display-only approximation of whether `id` would actually fire right now — `triggerHotkey` re-derives the real gate itself before acting, this only controls the button's dim/bright look. */
  private hotkeyUsable(hero: Hero, id: string): boolean {
    const registryMatch = listHeroActions(hero).find((a) => a.id === id);
    if (registryMatch) return registryMatch.available;
    if (hero.knownSpellAbilityIds().includes(id)) return !hero.isSilenced && hero.canCastSpell(id);
    return false;
  }

  /** D-165: the hotkey bar's hover tooltip — the full ability/spell description, or the registry action's own label (which has no separate description text). Empty string (no tooltip shown) for an empty slot or a mid-drag/no-selection moment. */
  private hotkeyTooltipText(slot: number): string {
    if (this.ui.kind !== "heroSelected") return "";
    const hero = this.heroById(this.ui.heroId);
    if (!hero) return "";
    const id = hero.actionHotkeys()[slot];
    if (!id) return "";
    if (listHeroActions(hero).some((a) => a.id === id)) return hotkeyDisplayLabel(hero, id);
    return getAbility(id).description;
  }

  /**
   * D-165 (KI-098 item 2): fires whatever `Hero.actionHotkeys()[slot]`
   * holds for the selected hero, via `dispatchAbilityId` — see that
   * method for the actual resolution rule. An empty slot is a silent
   * no-op; everything else `dispatchAbilityId` itself already handles.
   */
  private triggerHotkey(slot: number): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (this.ui.kind !== "heroSelected") return;
    const hero = this.heroById(this.ui.heroId);
    if (!hero) return;
    const abilityId = hero.actionHotkeys()[slot];
    if (!abilityId) return;
    this.dispatchAbilityId(hero, abilityId);
  }

  /**
   * D-165 (KI-098 items 2 and 4): resolves `abilityId` for `hero` to the
   * exact same handler its own un-hotkeyed, un-sheeted path already
   * uses — `chooseSpell` for a known spell/cantrip (the spellbook
   * overlay's own per-button handler), `onBonusActionButton`/
   * `onClassActionButton` for a registry action (kind alone identifies
   * which one fires, since a hero has at most one available action of
   * either kind at once — see `HeroActionRegistry`). An id that isn't
   * currently usable (out of spell slots, silenced, wrong turn) is a
   * silent no-op — matches `Hero.setActionHotkey`'s own "pinned but not
   * usable right now is normal" precedent, not an error state. Shared by
   * `triggerHotkey` (the in-battle hotkey bar) and
   * `castAbilityFromCharacterSheet` (the Character Sheet's own "cast from
   * here" entry points).
   */
  private dispatchAbilityId(hero: Hero, abilityId: string): void {
    if (!hero.canAct()) {
      this.refreshStatus();
      return;
    }
    const registryMatch = listHeroActions(hero).find((a) => a.id === abilityId);
    if (registryMatch) {
      if (!registryMatch.available) return;
      if (registryMatch.kind === "bonusAction") this.onBonusActionButton();
      else this.onClassActionButton();
      return;
    }
    if (hero.knownSpellAbilityIds().includes(abilityId)) {
      if (hero.isSilenced) {
        this.logCombat(`${hero.name} is Silenced and can't cast right now`);
        return;
      }
      if (!hero.canCastSpell(abilityId)) return;
      this.chooseSpell(hero, abilityId);
    }
  }

  /**
   * D-165 (KI-098 item 4): the Character Sheet's "cast a spell/use an
   * action from here" entry point — called right after
   * `CharacterSheetScene.close()` resumes this (paused) scene, so the
   * caster ends up right back on the battle board mid-aim, exactly as if
   * they'd pressed Q/R/F/T or a hotkey themselves. Public since it's
   * invoked from a different scene instance. Re-validates `heroId`
   * against whichever hero is actually still selected — should always be
   * the sheet's own hero, since opening the sheet requires a hero already
   * selected and pausing/resuming this scene never changes `ui.kind` —
   * rather than trusting the caller blindly.
   */
  public castAbilityFromCharacterSheet(heroId: string, abilityId: string): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (this.ui.kind !== "heroSelected" || this.ui.heroId !== heroId) return;
    const hero = this.heroById(heroId);
    if (!hero) return;
    this.dispatchAbilityId(hero, abilityId);
  }

  /** D-165 (KI-098 item 4): the Character Sheet's "drink a potion from here" entry point — same re-validation as `castAbilityFromCharacterSheet`, then just delegates to the existing `onPotionButton` (which already re-derives everything else from `this.ui`). */
  public usePotionFromCharacterSheet(heroId: string): void {
    if (this.ui.kind !== "heroSelected" || this.ui.heroId !== heroId) return;
    this.onPotionButton();
  }

  /**
   * D-125: a flat, documented simplification standing in for a real
   * passive-Perception DC — enemies have no ability scores to derive one
   * from (same "enemies are data, not full combatants" boundary this
   * project already draws elsewhere, e.g. `savingThrowBonus`'s own
   * untuned-default fallback). Keyed by the highest-role living enemy still
   * on the board — a legendary-tier threat is a harder audience to slip
   * past than a minion.
   */
  private static readonly STEALTH_DC_BY_ROLE: Record<string, number> = {
    minion: 10,
    miniboss: 13,
    boss: 16,
    legendary: 19,
  };

  private stealthDcForBoard(): number {
    const roleRank: Record<string, number> = { minion: 0, miniboss: 1, boss: 2, legendary: 3 };
    let highest = "minion";
    for (const enemy of this.waveSystem.enemies) {
      const role = enemy.def.role ?? "minion";
      if (roleRank[role] > roleRank[highest]) highest = role;
    }
    return BattleScene.STEALTH_DC_BY_ROLE[highest];
  }

  private wireInput(): void {
    // Drag-and-drop hero move: a right-click while dragging pins a
    // waypoint, so the native browser context menu must never appear over
    // the canvas. Safe scene-wide — no other right-click behavior exists
    // anywhere else in BattleScene.
    this.input.mouse?.disableContextMenu();

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const tile = this.grid.worldToTile({ x: pointer.worldX, y: pointer.worldY });
      // The mouse and the keyboard cursor share one "current tile" concept,
      // so pressing Enter/Space right after a mouse move acts on wherever the
      // pointer last was, and moving the mouse never leaves a stale keyboard
      // cursor position behind.
      if (tile) this.cursorPos = tile;

      if (this.dragArmedHeroId && tile) {
        const armedHero = this.heroById(this.dragArmedHeroId);
        if (armedHero && !GridSystem.equals(tile, armedHero.position)) {
          this.heroDrag = { heroId: this.dragArmedHeroId, pins: [] };
          this.dragArmedHeroId = null;
        }
      }
      if (this.heroDrag) {
        this.updateDragPreview(tile, pointer.worldX, pointer.worldY);
        return;
      }
      this.updateHoverAt(tile);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const tile = this.grid.worldToTile({ x: pointer.worldX, y: pointer.worldY });
      if (pointer.rightButtonDown()) {
        this.addDragPin(tile, pointer.worldX, pointer.worldY);
        return;
      }
      this.handleClick(tile);
      // Arm a potential drag only when this click just (re)selected the
      // hero whose own tile it landed on — mirrors `handleClick`'s existing
      // "clicking a hero (re)selects it" branch exactly, and only while a
      // move is actually legal to attempt (same `hero.canMove()` gate
      // `showRange`/`isLegalMove` already use).
      if (this.turns.current === "player" && !this.inputLocked() && tile && this.ui.kind === "heroSelected") {
        const heroHere = this.heroAt(tile);
        if (heroHere && heroHere.id === this.ui.heroId && heroHere.canMove()) {
          this.dragArmedHeroId = heroHere.id;
        }
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      // A right-click's own release must NOT resolve/end the drag — it's the
      // other half of the pin gesture `pointerdown`'s `rightButtonDown()`
      // branch already handled. Only a LEFT-button release ends a drag.
      if (pointer.rightButtonReleased()) return;
      this.dragArmedHeroId = null;
      if (!this.heroDrag) return;
      const tile = this.grid.worldToTile({ x: pointer.worldX, y: pointer.worldY });
      this.resolveDrop(tile);
    });

    this.input.keyboard?.on("keydown-E", () => this.endPlayerTurn());
    this.input.keyboard?.on("keydown-B", () => this.toggleBuildMode());
    this.input.keyboard?.on("keydown-G", () => this.toggleEquipMode());
    this.input.keyboard?.on("keydown-Q", () => {
      if (this.ui.kind === "heroSelected") this.onAbilityButton();
    });
    this.input.keyboard?.on("keydown-P", () => {
      if (this.ui.kind === "heroSelected") this.onPotionButton();
    });
    // Phase 13.2 (D-087): R (bonus action: Second Wind/Cunning Action) and F
    // (Action Surge) — both class-gated, so they're no-ops for most heroes.
    this.input.keyboard?.on("keydown-R", () => {
      if (this.ui.kind === "heroSelected") this.onBonusActionButton();
    });
    this.input.keyboard?.on("keydown-F", () => {
      if (this.ui.kind === "heroSelected") this.onActionSurgeButton();
    });
    // D-125: T (a single shared "class action" slot: Reckless Attack/
    // Preserve Life/etc. — see `showClassActionButtonFor`).
    this.input.keyboard?.on("keydown-T", () => {
      if (this.ui.kind === "heroSelected") this.onClassActionButton();
    });
    // D-148: opens the Character Sheet for the selected hero.
    this.input.keyboard?.on("keydown-C", () => {
      if (this.ui.kind === "heroSelected") this.openCharacterSheet();
    });
    this.input.keyboard?.on("keydown-ENTER", () => this.handlePrimaryActivate());
    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      event.preventDefault(); // SPACE otherwise scrolls the page
      this.handlePrimaryActivate();
    });
    this.input.keyboard?.on("keydown-ESC", () => this.handleEscape());

    // KI-030 ("full keyboard-only play"): arrow keys move either the board
    // tile cursor or, while the shop/Gear grid is open and focused (TAB),
    // the item highlighted in that grid — see handleArrowKey().
    const arrowDeltas: Record<string, [number, number]> = {
      UP: [0, -1],
      DOWN: [0, 1],
      LEFT: [-1, 0],
      RIGHT: [1, 0],
    };
    Object.entries(arrowDeltas).forEach(([key, [dx, dy]]) => {
      this.input.keyboard?.on(`keydown-${key}`, () => this.handleArrowKey(dx, dy));
    });
    this.input.keyboard?.on("keydown-TAB", (event: KeyboardEvent) => {
      event.preventDefault(); // TAB otherwise moves browser focus off the canvas
      this.toggleKeyboardFocus();
    });
    // Stop the browser's own scrolling/focus-cycling on these keys while the
    // game canvas has focus, without which the arrow keys/space would also
    // scroll the page underneath the game.
    this.input.keyboard?.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE", "TAB"]);

    // Phase 8 ("keyboard support"): number-row hotkeys select a hero by its
    // party-slot position, matching the order heroes appear in
    // heroDefinitions/heroStarts, so a key always means the same hero
    // regardless of who else has fallen.
    ["ONE", "TWO", "THREE", "FOUR"].forEach((key, i) => {
      this.input.keyboard?.on(`keydown-${key}`, () => this.selectHeroByIndex(i));
    });

    // Reopen the how-to-play overlay any time (Phase 8 "tutorial prompts").
    // Guarded against stacking on top of itself or another modal.
    this.input.keyboard?.on("keydown-H", () => {
      if (this.inputLocked() || this.endOverlay.length > 0) return;
      this.showTutorial();
    });

    // KI-085/D-130: cycle Game Speed live, mid-battle, without needing to
    // exit to the Main Menu (the only place it could be changed before).
    // Always available (not gated on `inputLocked()`) since it never touches
    // board state, only how fast future tweens/pauses play out.
    this.input.keyboard?.on("keydown-S", () => this.cycleGameSpeed());

    // KI-085/D-130: the technical log overlay — guarded against stacking on
    // top of another modal, same "informational, not a forced choice"
    // treatment as H's tutorial reopen above.
    this.input.keyboard?.on("keydown-L", () => {
      if ((this.inputLocked() && this.technicalLogOverlay.length === 0) || this.endOverlay.length > 0) return;
      this.toggleTechnicalLogOverlay();
    });

    // Restart safety: Phaser already tears down a scene's input plugin on
    // shutdown, but we remove our own pointer/keyboard listeners explicitly so
    // that returning to the menu and starting a new battle can never accumulate
    // duplicate handlers (Phase 6 acceptance: "restart does not duplicate
    // listeners"). Game-object button listeners go away with the objects.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
  }

  private handleClick(tile: GridPosition | null): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (!tile) return;

    // Build mode: a click builds on an empty tile or refunds a structure.
    if (this.ui.kind === "building") {
      this.handleBuildClick(tile);
      return;
    }

    // Test Mode (D-138): the three debug-picker modes, each a click-and-stay
    // mode exactly like Build — the picked enemy/terrain/status stays
    // selected across repeated clicks until the tester picks a different one
    // or exits via Done/Esc.
    if (this.ui.kind === "debugSpawnEnemy") {
      this.handleDebugSpawnClick(tile);
      return;
    }
    if (this.ui.kind === "debugPaintTerrain") {
      this.handleDebugTerrainClick(tile);
      return;
    }
    if (this.ui.kind === "debugStatus") {
      this.handleDebugStatusClick(tile);
      return;
    }

    // Equip mode: a click on a hero equips (or unequips) the selected item.
    if (this.ui.kind === "equipping") {
      this.handleEquipClick(tile);
      return;
    }

    // Phase 13.7 (D-092): the spellbook overlay is modal — its own buttons
    // (or Esc) are the only way to pick a spell; a board click does nothing.
    if (this.ui.kind === "choosingSpell") return;

    // Aiming a spell picked from the spellbook: the next click chooses the
    // target — an ally tile or an enemy tile, depending on the spell.
    if (this.ui.kind === "aimingSpell") {
      const hero = this.heroById(this.ui.heroId);
      if (hero) this.castChosenSpellOn(hero, this.ui.abilityId, tile);
      else this.setInteraction({ kind: "idle" });
      return;
    }

    // Phase 16 (D-106): aiming a tile-targeted spell (ranged AoE, teleport,
    // summon, or terrain placement) — the next click chooses the tile.
    if (this.ui.kind === "aimingTileSpell") {
      const hero = this.heroById(this.ui.heroId);
      if (hero) this.castTileSpellOn(hero, this.ui.abilityId, tile);
      else this.setInteraction({ kind: "idle" });
      return;
    }

    // Clicking an enemy while a hero is selected attempts a basic attack.
    // Phase 20 (D-111): a still-hidden stealth enemy can't be clicked at all.
    // D-127: the hero lookup moves ahead of the targetability check so a
    // Blindsense/Feral Senses hero's own per-observer exception applies here.
    const enemyHere = this.enemyAt(tile);
    if (enemyHere && (this.ui.kind === "heroSelected" || this.ui.kind === "confirmingMove")) {
      const hero = this.heroById(this.ui.heroId);
      if (hero && this.isEnemyTargetable(enemyHere, hero)) {
        this.tryBasicAttack(hero, enemyHere);
        return;
      }
    }

    // Clicking a hero (re)selects it.
    const heroHere = this.heroAt(tile);
    if (heroHere) {
      if (!this.canLocallyControl(heroHere)) {
        this.rejectAt(tile, `Waiting for ${this.coopSession!.partnerName}'s turn…`);
        return;
      }
      this.setInteraction({ kind: "heroSelected", heroId: heroHere.id });
      return;
    }

    // Otherwise, movement handling (unchanged from Phase 2).
    if (this.ui.kind === "heroSelected") {
      const hero = this.heroById(this.ui.heroId);
      if (hero && this.isLegalMove(hero, tile)) {
        this.setInteraction({ kind: "confirmingMove", heroId: hero.id, dest: tile });
      } else {
        this.setInteraction({ kind: "idle" });
      }
      return;
    }

    if (this.ui.kind === "confirmingMove") {
      const hero = this.heroById(this.ui.heroId);
      if (hero && this.isLegalMove(hero, tile)) {
        this.setInteraction({ kind: "confirmingMove", heroId: hero.id, dest: tile });
      } else {
        this.setInteraction({ kind: "heroSelected", heroId: this.ui.heroId });
      }
    }
  }

  /**
   * The shared "what's under the cursor" logic — positions the hover
   * highlight and, depending on mode, refreshes the move-path preview or the
   * build ghost. Used by BOTH the mouse (`pointermove`) and the keyboard
   * cursor (`moveBoardCursor`), so the two input methods can never disagree
   * about what a given tile currently shows.
   */
  private updateHoverAt(tile: GridPosition | null): void {
    if (tile) {
      const c = this.grid.tileToWorldCenter(tile);
      this.hoverRect.setPosition(c.x, c.y).setVisible(true);
    } else {
      this.hoverRect.setVisible(false);
    }
    if (this.ui.kind === "heroSelected" && this.turns.current === "player") {
      const hero = this.heroById(this.ui.heroId);
      if (hero && tile && this.isLegalMove(hero, tile)) this.showPath(hero, tile);
      else this.clearPath();
    }
    if (this.ui.kind === "building") this.updateBuildGhost(tile);
    this.updateUnitTooltip(tile);
  }

  /**
   * D-132: a hover tooltip — a hero's tile shows its HP/AC; an enemy's tile
   * shows the same, plus (only while a hero is selected and this enemy is a
   * legal basic-attack target for it) a "N% to hit" line from
   * `previewHitChance`. A still-hidden stealth/Mimic enemy shows nothing at
   * all, the same "nothing to see here" treatment its token/name already get
   * (see `applyStealthVisual`) — its HP/AC would otherwise leak information
   * the player hasn't earned yet.
   */
  private updateUnitTooltip(tile: GridPosition | null): void {
    if (!tile) {
      this.tooltip.hide();
      return;
    }
    const hero = this.heroAt(tile);
    if (hero) {
      let text = `${hero.name}\nHP ${hero.health}/${hero.effectiveMaxHealth}  ·  AC ${hero.armorClass}`;
      // D-148 (KI-098, a small slice of "equip UX needs a rethink"): while an
      // item is selected in equip mode, hovering a hero previews what it
      // would change before any gold is spent.
      if (this.ui.kind === "equipping" && this.ui.itemId && !gearCatalogEntry(this.ui.itemId).isPotion) {
        text += `\n${this.previewEquipDelta(hero, this.ui.itemId)}`;
      }
      this.showUnitTooltipAt(tile, text);
      return;
    }
    const enemy = this.enemyAt(tile);
    if (enemy) {
      const stillHidden = (enemy.def.stealth === true || enemy.def.mimicDisguise === true) && !enemy.isRevealed;
      if (stillHidden) {
        this.tooltip.hide();
        return;
      }
      let text = `${enemy.def.name}\nHP ${enemy.health}/${enemy.def.maxHealth}  ·  AC ${enemy.armorClass}`;
      if (this.ui.kind === "heroSelected") {
        const selectedHero = this.heroById(this.ui.heroId);
        const chance = selectedHero ? this.previewHitChance(selectedHero, enemy) : null;
        if (chance !== null) text += `\n${Math.round(chance * 100)}% to hit`;
      }
      this.showUnitTooltipAt(tile, text);
      return;
    }
    this.tooltip.hide();
  }

  private showUnitTooltipAt(tile: GridPosition, text: string): void {
    const c = this.grid.tileToWorldCenter(tile);
    this.tooltip.showAt(c.x, c.y - this.grid.tileSize * 0.6, text);
  }

  /**
   * KI-030: Enter and Space both mean "act on whatever is focused" — the one
   * activation key a keyboard-only player needs. If a move is pending it
   * commits (unchanged from the original Enter-only hotkey); otherwise, if
   * the shop/Gear grid currently has keyboard focus, it picks the
   * highlighted item; otherwise it's exactly equivalent to clicking the tile
   * under the board cursor.
   */
  private handlePrimaryActivate(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (this.ui.kind === "confirmingMove") {
      this.confirmMove();
      return;
    }
    if ((this.ui.kind === "building" || this.ui.kind === "equipping") && this.keyboardFocus === "grid") {
      this.activateFocusedGridItem();
      return;
    }
    this.handleClick(this.cursorPos);
  }

  /** Route an arrow-key press to whichever thing currently has keyboard focus. */
  private handleArrowKey(dx: number, dy: number): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (
      (this.ui.kind === "building" || this.ui.kind === "equipping" || this.isDebugGridKind(this.ui.kind)) &&
      this.keyboardFocus === "grid"
    ) {
      this.moveGridFocus(dx, dy);
      return;
    }
    this.moveBoardCursor(dx, dy);
  }

  private moveBoardCursor(dx: number, dy: number): void {
    const next = { x: this.cursorPos.x + dx, y: this.cursorPos.y + dy };
    if (!this.map.isInBounds(next)) return;
    this.cursorPos = next;
    this.updateHoverAt(next);
  }

  /** Row-major navigation within the currently visible shop/equip/debug-picker grid. */
  private moveGridFocus(dx: number, dy: number): void {
    const items = this.currentGridItems();
    if (items.length === 0) return;
    const cols = 4;
    let idx = this.gridFocusIndex + dx + dy * cols;
    idx = Math.max(0, Math.min(items.length - 1, idx));
    if (idx === this.gridFocusIndex) return;
    this.gridFocusIndex = idx;
    this.setHoveredItem(items[idx]); // preview its description, same as a mouse hover
    this.refreshGridFocusVisual();
  }

  /** Toggle whether arrow keys drive the shop/Gear/debug-picker grid or the board cursor. */
  private toggleKeyboardFocus(): void {
    if (this.ui.kind !== "building" && this.ui.kind !== "equipping" && !this.isDebugGridKind(this.ui.kind)) return;
    this.keyboardFocus = this.keyboardFocus === "grid" ? "board" : "grid";
    // D-158: routes through `setHoveredItem` (not a raw field set) so
    // switching focus INTO the grid previews the newly-focused item's
    // tooltip immediately, not just on the next arrow-key move.
    this.setHoveredItem(this.keyboardFocus === "grid" ? this.currentGridItems()[this.gridFocusIndex] ?? null : null);
    this.refreshGridFocusVisual();
    this.refreshStatus();
  }

  /** Test Mode (D-138): true for any of the three debug-picker interaction kinds. */
  private isDebugGridKind(kind: Interaction["kind"]): boolean {
    return kind === "debugSpawnEnemy" || kind === "debugPaintTerrain" || kind === "debugStatus";
  }

  private currentGridItems(): readonly string[] {
    if (this.ui.kind === "building") return SHOP_ORDER;
    if (this.ui.kind === "equipping") return this.visibleGearCatalog();
    if (this.ui.kind === "debugSpawnEnemy") return DEBUG_ENEMY_IDS;
    if (this.ui.kind === "debugPaintTerrain") return DEBUG_TERRAIN_TYPES;
    if (this.ui.kind === "debugStatus") return STATUS_EFFECT_ORDER;
    return [];
  }

  /** Pick the item currently highlighted by keyboard focus in the shop/Gear grid. */
  private activateFocusedGridItem(): void {
    const items = this.currentGridItems();
    const id = items[this.gridFocusIndex];
    if (!id) return;
    if (this.ui.kind === "building") this.selectShopItem(id);
    else if (this.ui.kind === "equipping") this.selectEquipItem(id);
    else if (this.ui.kind === "debugSpawnEnemy") this.selectDebugEnemy(id);
    else if (this.ui.kind === "debugPaintTerrain") this.selectDebugTerrain(id as TileType);
    else if (this.ui.kind === "debugStatus") this.selectDebugStatus(id as StatusEffectId);
  }

  /** Redraw the grid's keyboard-focus ring without tearing down the whole mode. */
  private refreshGridFocusVisual(): void {
    if (this.ui.kind === "building") this.showShopUI(true, this.ui.defId);
    else if (this.ui.kind === "equipping") this.showEquipUI(true, this.ui.itemId);
    else if (this.isDebugGridKind(this.ui.kind)) this.showDebugPickerUI();
    this.refreshPageNav();
  }

  /** Phase 8 keyboard hotkey: select the hero at this fixed roster index. */
  private selectHeroByIndex(i: number): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (this.ui.kind === "building" || this.ui.kind === "equipping" || this.isDebugGridKind(this.ui.kind)) return;
    const hero = this.heroes[i];
    if (!hero || !hero.isAlive() || !this.canLocallyControl(hero)) return;
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * D-165 (KI-098 item 3, "equip-flow UX rethink"): clicking a roster-strip
   * box now does something, instead of being purely decorative — in equip
   * mode it targets that hero directly (`resolveEquipOnHero`), the same
   * click-item-then-click-a-hero flow as before, just aimed at the always-
   * visible roster box instead of hunting for a small board token that
   * might be tucked behind terrain/other units. Outside equip mode it's a
   * second way to select a hero, identical to `selectHeroByIndex`'s own
   * gates (this doesn't replace clicking the board token, which still
   * works exactly as before either way).
   */
  private onRosterBoxClick(slot: number): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    const hero = this.heroes[slot];
    if (!hero) return;
    if (this.ui.kind === "equipping") {
      if (!hero.isAlive()) return;
      // Phase 11.7 (D-071): the same proximity gate `handleEquipClick`
      // enforces for a board-tile click.
      if (!this.isAnyHeroNearShop()) {
        this.rejectAt(hero.position, "Move a hero to a Shop tile to access Gear");
        return;
      }
      this.resolveEquipOnHero(hero);
      return;
    }
    if (this.ui.kind === "building" || this.isDebugGridKind(this.ui.kind)) return;
    if (!hero.isAlive() || !this.canLocallyControl(hero)) return;
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * D-165: the roster box's own hover tooltip — the same HP/AC text (and,
   * in equip mode with a non-potion item selected, the same before/after
   * `previewEquipDelta` line) `updateUnitTooltip` already shows for a
   * board-token hover, so the two entry points read identically.
   */
  private showRosterHoverTooltip(slot: number): void {
    const hero = this.heroes[slot];
    if (!hero) return;
    const box = this.heroSlotBoxes[slot];
    let text = `${hero.name}\nHP ${hero.health}/${hero.effectiveMaxHealth}  ·  AC ${hero.armorClass}`;
    if (this.ui.kind === "equipping" && this.ui.itemId && !gearCatalogEntry(this.ui.itemId).isPotion) {
      text += `\n${this.previewEquipDelta(hero, this.ui.itemId)}`;
    }
    this.tooltip.showAt(box.x, box.y - box.height / 2 - 4, text);
  }

  private handleEscape(): void {
    // Drag-and-drop hero move: Esc cancels an in-progress drag before any
    // other Esc behavior gets a chance to run.
    if (this.heroDrag) {
      this.cancelDrag();
      return;
    }
    if (
      this.choosingAsi ||
      this.choosingSubclass ||
      this.choosingSpellPick ||
      this.choosingLevelUpAck ||
      this.choosingRest ||
      this.choosingSpellPrep
    )
      return; // must resolve the choice, no Esc shortcut
    if (this.tutorialOverlay.length > 0) {
      this.dismissTutorial(); // the tutorial is informational, not a forced choice
      return;
    }
    if (this.technicalLogOverlay.length > 0) {
      this.closeTechnicalLogOverlay(); // also informational, not a forced choice
      return;
    }
    if (this.debugMenuOverlay.length > 0) {
      this.closeDebugMenu(); // also informational, not a forced choice
      return;
    }
    if (this.endOverlay.length > 0) {
      this.scene.start("MainMenuScene");
    } else if (this.ui.kind === "building") {
      this.exitBuildMode();
    } else if (this.ui.kind === "equipping") {
      this.exitEquipMode();
    } else if (this.isDebugGridKind(this.ui.kind)) {
      this.setInteraction({ kind: "idle" });
    } else if (
      this.ui.kind === "choosingSpell" ||
      this.ui.kind === "aimingSpell" ||
      this.ui.kind === "aimingTileSpell"
    ) {
      this.setInteraction({ kind: "heroSelected", heroId: this.ui.heroId });
    } else if (this.ui.kind === "confirmingMove") {
      this.cancelMove();
    } else if (this.ui.kind === "heroSelected") {
      this.setInteraction({ kind: "idle" });
    } else {
      // D-152: previously an immediate, unwarned `scene.start("MainMenuScene")`
      // — the pause menu now owns "leave the battle," with a real Save/
      // Exit-with-warning choice instead of a silent unconfirmed exit.
      this.openPauseMenu();
    }
  }

  /**
   * D-152: opens the pause menu (`PauseMenuScene`) over a paused
   * `BattleScene` — same `scene.launch` + `scene.pause()` mechanism D-148's
   * `CharacterSheetScene` already established. Self-guarding so it's safe
   * to call both from `handleEscape`'s own fallback (where these are
   * already known false) AND from the always-visible "Menu" HUD button
   * (which bypasses that priority chain entirely) — never opens on top of
   * an active drag, a forced choice that must be resolved, or another
   * full-screen overlay.
   */
  private openPauseMenu(): void {
    if (
      this.heroDrag ||
      this.choosingAsi ||
      this.choosingSubclass ||
      this.choosingSpellPick ||
      this.choosingLevelUpAck ||
      this.choosingRest ||
      this.choosingSpellPrep ||
      this.tutorialOverlay.length > 0 ||
      this.technicalLogOverlay.length > 0 ||
      this.debugMenuOverlay.length > 0 ||
      this.endOverlay.length > 0
    ) {
      return;
    }
    this.scene.launch("PauseMenuScene", { battleScene: this });
    this.scene.pause();
  }

  private confirmMove(): void {
    if (this.ui.kind !== "confirmingMove") return;
    const hero = this.heroById(this.ui.heroId);
    if (!hero) return;
    // D-173: the dest was already validated reachable (isLegalMove) when
    // this state was entered — recompute its real tile cost here so a move
    // shorter than the full budget leaves the rest spendable later this
    // turn, same as the drag-move flow (`resolveDrop`) already does.
    const route = this.movement.routeThroughWaypoints([this.ui.dest], {
      start: hero.position,
      budget: hero.movementBudget(),
      isOccupied: (p) => this.isHeroMovementBlocked(p),
      blocksStopping: (p) => this.isHeroStoppingBlocked(p, hero.id),
    });
    hero.moveTo(this.ui.dest, route?.usedTiles);
    const token = this.heroTokens.get(hero.id);
    if (token) this.moveHeroToken(token, hero.position);
    this.checkTreasureAt(hero);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  private cancelMove(): void {
    if (this.ui.kind !== "confirmingMove") return;
    this.setInteraction({ kind: "heroSelected", heroId: this.ui.heroId });
  }

  // ----- Combat actions --------------------------------------------------

  /**
   * Phase 13.3 (D-089): a hero with Extra Attack (`attacksPerAction` > 1,
   * Fighter only, from level 5) rolls that many independent attacks against
   * the SAME clicked target when they take the Attack action — the SRD lets
   * you split Extra Attack's attacks across different targets, but this
   * game's single-click targeting UI doesn't support choosing a target per
   * swing, so all of them land on whatever was clicked. If an earlier swing
   * defeats the target, `attackSingle` returns null for the rest (it only
   * targets the living) and the loop simply stops early.
   */
  /**
   * D-132: every advantage/bonus source a basic attack against a SPECIFIC
   * enemy would apply, computed read-only (no resource spent, no dice
   * rolled) — shared by the real attack (`tryBasicAttack`, which spends the
   * flags this returns) and the hover-preview hit-chance calculator
   * (`previewHitChance`, which only reads them). Keeping this one place
   * means the preview can never drift from what actually happens when the
   * hero swings.
   */
  private computeBasicAttackProfile(
    hero: Hero,
    enemy: Enemy,
  ): {
    profile: AttackProfile;
    usingLuck: boolean;
    vexed: boolean;
    inspired: boolean;
    fated: boolean;
  } {
    const profile = this.attackProfileFor(hero);
    const usingLuck = hero.canUseLucky();
    if (usingLuck) profile.advantage = "advantage";
    // Phase 17 (D-108): the Vex weapon mastery's pending advantage — spent on
    // just this ONE attack roll (the SRD's real scope), unlike Lucky above,
    // which (pre-existing behavior, unchanged) applies to every swing of an
    // Extra Attack action.
    const vexed = !usingLuck && hero.hasVexAgainst(enemy.id);
    if (vexed) profile.advantage = "advantage";
    // Phase 18 (D-109): Grappler's advantage against an enemy IT has
    // restrained (see `applyGrapplerRestrain`) — same "spent on the first
    // roll" scope as Lucky/Vex above.
    const grapplerAdvantage = !usingLuck && !vexed && hero.featIds.includes("grappler") && enemy.hasStatus("restrained");
    if (grapplerAdvantage) profile.advantage = "advantage";
    // Phase 13.8 (D-093): a pending Bardic Inspiration bonus (granted by a
    // Bard, possibly to itself) boosts this attack's to-hit and damage, then
    // is consumed — same "spent on the first roll" treatment as Lucky above.
    const inspired = hero.pendingInspirationBonus > 0;
    if (inspired) {
      profile.attackBonus += hero.pendingInspirationBonus;
      profile.damage += hero.pendingInspirationBonus;
    }
    // Phase 18 (D-109): Boon of Fate's once-per-rest flat bonus, auto-applied
    // to this hero's next basic-attack roll — same auto-apply-no-picker
    // precedent as Lucky/Bardic Inspiration.
    const fated = hero.canUseBoonOfFate;
    if (fated) profile.attackBonus += hero.boonOfFateBonus;
    return { profile, usingLuck, vexed, inspired, fated };
  }

  /**
   * D-132: the hover-tooltip's "N% to hit" line — null when the enemy is out
   * of this hero's current attack range (or already dead), the same cases
   * `tryBasicAttack`'s own `CombatSystem.attackSingle` silently refuses.
   * Read-only: calls `computeBasicAttackProfile` for the exact bonuses a real
   * swing would use, then resolves them analytically instead of rolling.
   */
  private previewHitChance(hero: Hero, enemy: Enemy): number | null {
    if (!enemy.isAlive()) return null;
    const { profile } = this.computeBasicAttackProfile(hero, enemy);
    if (!CombatSystem.isInRange(hero.position, enemy.position, profile.rangeTiles)) return null;
    return CombatSystem.hitChance(profile.attackBonus, enemy.armorClass, profile.advantage ?? "normal", profile.critThreshold);
  }

  private tryBasicAttack(hero: Hero, enemy: Enemy): void {
    if (!hero.canAct()) {
      this.rejectAt(enemy.position, `${hero.name} has already acted this turn`);
      return;
    }
    // D-125: a basic attack always breaks this hero's own hidden state,
    // mirroring a stealthed enemy's "first strike reveals it" rule.
    if (hero.isHidden) hero.reveal();
    const { profile, usingLuck, vexed, inspired, fated } = this.computeBasicAttackProfile(hero, enemy);
    const firstResult = CombatSystem.attackSingle(hero.position, enemy, profile, this.random);
    if (!firstResult) {
      this.rejectAt(enemy.position, `${enemy.def.name} is out of range`);
      return;
    }
    const heroToken = this.heroTokens.get(hero.id);
    if (heroToken) this.lungeToward(heroToken, hero.position, enemy.position);
    if (usingLuck) {
      hero.spendLuckyPoint();
      this.logCombat(`${hero.name} spends a Lucky point (Advantage) — ${hero.luckyPointsAvailable} left`);
    }
    if (vexed) {
      hero.clearVex();
      profile.advantage = "normal";
    }
    if (inspired) {
      hero.clearInspiration();
      this.logCombat(`${hero.name} channels Bardic Inspiration into the attack`);
    }
    if (fated) {
      hero.useBoonOfFate();
      this.logCombat(`${hero.name}'s Boon of Fate empowers the attack (+${hero.boonOfFateBonus})`);
    }
    // Phase 18 (D-109): Boon of Combat Prowess — once per turn, a miss on
    // this first roll can be willed into a hit instead (mirrors the Graze/
    // Topple mastery precedent of mutating an already-resolved result).
    if (firstResult.roll && !firstResult.roll.hit && hero.canUseCombatProwess) {
      hero.consumeCombatProwess();
      const dmg = CombatSystem.computeDamage(profile.damage, false);
      enemy.health = Math.max(0, enemy.health - dmg);
      firstResult.damageDealt = dmg;
      firstResult.healthAfter = enemy.health;
      firstResult.defeated = firstResult.healthBefore > 0 && enemy.health <= 0;
      this.logCombat(`${hero.name}'s Boon of Combat Prowess turns the miss into a hit`);
    }
    hero.markActed();
    const results = [firstResult];
    for (let i = 1; i < hero.attacksPerAction; i++) {
      const extra = CombatSystem.attackSingle(hero.position, enemy, profile, this.random);
      if (!extra) break;
      results.push(extra);
    }
    for (const result of results) {
      const verb = BattleScene.attackVerb(result);
      const suffix = BattleScene.didHit(result) ? ` for ${result.damageDealt}` : "";
      this.logCombat(`${hero.name} ${verb} ${enemy.def.name}${suffix}`);
      this.logTechnical(BattleScene.technicalAttackLine(hero.name, enemy.def.name, result));
      this.applyPaladinSmite(hero, enemy, result);
      this.applyHuntersMarkBonus(hero, enemy, result);
      this.applyEquipmentProcs(hero, enemy, result);
      this.applyWeaponMastery(hero, enemy, result);
      this.applyReflectorDamage(hero, enemy, result);
      this.applyGrapplerRestrain(hero, enemy, result);
      this.applyIntimidatingPresence(hero, enemy, result);
      this.applyIrresistibleOffenseBonus(hero, enemy, result);
      this.applyDarkOnesBlessing(hero, result);
      this.applyShadowbladeFirstStrike(hero, enemy, result);
      if (BattleScene.didHit(result)) this.showHeroHit(enemy);
    }
    this.tryOffHandAttack(hero, enemy);
    const clearedEarly = this.afterHeroDamage();
    if (!clearedEarly) this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 19 (D-110): Two-Weapon Fighting's base mechanic — dual-wielding a
   * Light melee weapon in each hand lets this hero make one extra attack
   * with the off-hand weapon right after its Attack action, normally
   * costing the bonus action (free instead if either weapon carries Nick —
   * see `Hero.canUseOffHandAttack`). Deliberately simple compared to the
   * main-hand swing above: no weapon-mastery/proc resolution on this
   * attack, matching the same "keep a bonus/secondary attack simple"
   * precedent the Cleave mastery's own second attack already set.
   */
  private tryOffHandAttack(hero: Hero, enemy: Enemy): void {
    if (!hero.canUseOffHandAttack()) return;
    hero.useOffHandAttack();
    const profile: AttackProfile = {
      rangeTiles: 1,
      damage: hero.offHandAttackDamage,
      attackBonus: hero.effectiveAttackBonus,
      critThreshold: hero.critThreshold,
    };
    const result = CombatSystem.attackSingle(hero.position, enemy, profile, this.random);
    if (!result) return;
    const verb = BattleScene.attackVerb(result);
    const suffix = BattleScene.didHit(result) ? ` for ${result.damageDealt}` : "";
    this.logCombat(`${hero.name}'s off-hand ${verb} ${enemy.def.name}${suffix}`);
    this.logTechnical(BattleScene.technicalAttackLine(`${hero.name}'s off-hand`, enemy.def.name, result));
    if (BattleScene.didHit(result)) this.showHeroHit(enemy);
  }

  /**
   * Phase 17 (D-108): resolve this hero's equipped weapon's mastery property
   * (if any) against the same landed/missed swing — same scope boundary as
   * Divine Smite/Hunter's Mark/equipment procs above (the basic Attack
   * action only). Mastery applies to whoever wields the weapon, regardless
   * of class — a deliberate simplification of the SRD's real "unlocked
   * mastery slots" rule (see `data/weapons.ts`'s module comment). Nick has
   * no case here — it's honestly left mechanically inert (see
   * `WEAPON_MASTERIES.nick`'s own comment for why).
   */
  private applyWeaponMastery(hero: Hero, enemy: Enemy, result: AttackResult): void {
    const weaponDef = hero.equippedWeapon;
    if (!weaponDef?.weapon) return;
    const masteryId = weaponDef.weapon.mastery;
    const masteryName = WEAPON_MASTERIES[masteryId].name;
    const landedDamage = result.damageDealt > 0;
    switch (masteryId) {
      case "vex": {
        if (!landedDamage || !enemy.isAlive()) return;
        hero.setVex(enemy.id);
        this.logCombat(`${hero.name}'s ${masteryName} mastery lines up the next strike against ${enemy.def.name}`);
        return;
      }
      case "push": {
        if (!landedDamage || !enemy.isAlive()) return;
        this.pushEnemyAway(hero.position, enemy, 2);
        if (enemy.isAlive()) {
          const token = this.enemyTokens.get(enemy.instanceId);
          if (token) this.placeToken(token, enemy.position);
          this.logCombat(`${hero.name}'s ${masteryName} mastery shoves ${enemy.def.name} back`);
        }
        return;
      }
      case "sap": {
        if (!landedDamage || !enemy.isAlive()) return;
        enemy.applyStatus("sapped", 1);
        this.logCombat(`${hero.name}'s ${masteryName} mastery saps ${enemy.def.name}'s next attack`);
        return;
      }
      case "slow": {
        if (!landedDamage || !enemy.isAlive()) return;
        enemy.applyStatus("slowed", 1);
        this.logCombat(`${hero.name}'s ${masteryName} mastery slows ${enemy.def.name}`);
        return;
      }
      case "topple": {
        if (!landedDamage || !enemy.isAlive()) return;
        const dc = 8 + hero.effectiveAttackBonus;
        const save = SavingThrowSystem.rollSave(enemy.savingThrowBonus, dc, this.random);
        if (save.success) {
          this.logCombat(`${enemy.def.name} keeps its footing against ${hero.name}'s ${masteryName} mastery (save ${save.total} vs DC ${dc})`);
          return;
        }
        enemy.applyStatus("toppled", 2);
        this.logCombat(`${hero.name}'s ${masteryName} mastery knocks ${enemy.def.name} down (save ${save.total} vs DC ${dc})`);
        return;
      }
      case "graze": {
        // Only on an actual MISS (a roll happened and didn't hit) — autoHit
        // attacks never reach this action, and a defeated target can't graze.
        if (landedDamage || !result.roll || result.roll.hit || !enemy.isAlive()) return;
        const bonus = hero.weaponAbilityModifierNow;
        if (bonus <= 0) return;
        enemy.health = Math.max(0, enemy.health - bonus);
        result.damageDealt += bonus;
        result.healthAfter = enemy.health;
        result.defeated = result.healthBefore > 0 && enemy.health <= 0;
        this.logCombat(`${hero.name}'s ${masteryName} mastery still grazes ${enemy.def.name} for ${bonus} damage`);
        return;
      }
      case "cleave": {
        if (!landedDamage || !hero.canUseCleaveMastery) return;
        const others = CombatSystem.targetsInRange(enemy.position, 1, this.waveSystem.enemies).filter(
          (e) => e.instanceId !== enemy.instanceId,
        );
        const second = CombatSystem.chooseTarget(enemy.position, 1, others);
        if (!second) return;
        hero.consumeCleaveMastery();
        const cleaveResult = CombatSystem.attackSingle(
          enemy.position,
          second,
          {
            rangeTiles: 1,
            damage: hero.equippedWeaponDieAverage,
            attackBonus: hero.effectiveAttackBonus,
            critThreshold: hero.critThreshold,
          },
          this.random,
        );
        if (!cleaveResult) return;
        const verb = BattleScene.attackVerb(cleaveResult);
        const suffix = BattleScene.didHit(cleaveResult) ? ` for ${cleaveResult.damageDealt}` : "";
        this.logCombat(`${hero.name}'s ${masteryName} mastery ${verb} ${second.def.name}${suffix}`);
        this.logTechnical(BattleScene.technicalAttackLine(`${hero.name}'s ${masteryName}`, second.def.name, cleaveResult));
        if (BattleScene.didHit(cleaveResult)) this.showHeroHit(second);
        return;
      }
      case "nick":
        return;
    }
  }

  /**
   * Phase 21 (D-112), Reflector: while this enemy's shield still holds
   * (`shieldHpRemaining > 0` — pairs with `damageShieldHp`), reflects a % of
   * this landed hit's actual HP damage back at the attacking hero, bypassing
   * armor (a flat, autoHit application, same shape as an equipment proc).
   */
  private applyReflectorDamage(hero: Hero, enemy: Enemy, result: AttackResult): void {
    if (!enemy.def.reflectsDamagePercent) return;
    if (!BattleScene.didHit(result) || result.damageDealt <= 0) return;
    if (enemy.shieldHpRemaining <= 0) return;
    const reflected = Math.floor((result.damageDealt * enemy.def.reflectsDamagePercent) / 100);
    if (reflected <= 0) return;
    hero.health = Math.max(0, hero.health - reflected);
    this.logCombat(`${enemy.def.name}'s ward reflects ${reflected} damage back at ${hero.name}`);
    const token = this.heroTokens.get(hero.id);
    if (token) this.updateHpText(token, hero.health, hero.effectiveMaxHealth);
  }

  /**
   * Phase 18 (D-109): Grappler feat only — once per hero turn, a landed
   * basic-attack hit rolls a save to restrain the target, mirroring the
   * Topple weapon mastery's own save-then-`applyStatus` shape exactly
   * (`applyWeaponMastery`'s `"topple"` case, above). While restrained, this
   * hero's own attacks against the same enemy get Advantage (see
   * `tryBasicAttack`'s `grapplerAdvantage`).
   */
  private applyGrapplerRestrain(hero: Hero, enemy: Enemy, result: AttackResult): void {
    if (!hero.featIds.includes("grappler") || result.damageDealt <= 0 || !enemy.isAlive()) return;
    if (!hero.canUseGrapplerRestrain) return;
    hero.consumeGrapplerRestrain();
    const dc = 8 + hero.effectiveAttackBonus;
    const save = SavingThrowSystem.rollSave(enemy.savingThrowBonus, dc, this.random);
    if (save.success) {
      this.logCombat(`${enemy.def.name} slips out of ${hero.name}'s Grappler attempt (save ${save.total} vs DC ${dc})`);
      return;
    }
    enemy.applyStatus("restrained", 1);
    this.logCombat(`${hero.name}'s Grappler feat restrains ${enemy.def.name} (save ${save.total} vs DC ${dc})`);
  }

  /**
   * D-124: Path of the Berserker's Intimidating Presence (level 10+) — a
   * landed basic-attack hit also frightens the target on a failed save,
   * mirroring Grappler's own "rider on an already-resolved hit, own save
   * roll" shape exactly (`applyGrapplerRestrain`, above).
   */
  private applyIntimidatingPresence(hero: Hero, enemy: Enemy, result: AttackResult): void {
    if (!hero.hasIntimidatingPresence || result.damageDealt <= 0 || !enemy.isAlive()) return;
    const dc = 8 + hero.effectiveAttackBonus;
    const save = SavingThrowSystem.rollSave(enemy.savingThrowBonus, dc, this.random);
    if (save.success) {
      this.logCombat(`${enemy.def.name} resists ${hero.name}'s Intimidating Presence (save ${save.total} vs DC ${dc})`);
      return;
    }
    enemy.applyStatus("frightened", 2);
    this.logCombat(`${hero.name}'s Intimidating Presence frightens ${enemy.def.name} (save ${save.total} vs DC ${dc})`);
  }

  /**
   * Phase 18 (D-109): Boon of Irresistible Offense only — a natural-20 hit
   * deals bonus damage equal to the ability score the boon raised
   * (`Hero.irresistibleOffenseBonusDamage`). The boon's other half (its
   * damage always ignores Resistance) is now real too (D-127) — see
   * `Hero.attackIsMagical`, applied in `attackProfileFor` before the base hit
   * even resolves, so this bonus-damage add-on needs no separate handling.
   */
  private applyIrresistibleOffenseBonus(hero: Hero, enemy: Enemy, result: AttackResult): void {
    if (!result.roll?.critical || result.damageDealt <= 0 || !enemy.isAlive()) return;
    const bonus = hero.irresistibleOffenseBonusDamage;
    if (bonus <= 0) return;
    enemy.health = Math.max(0, enemy.health - bonus);
    result.damageDealt += bonus;
    result.healthAfter = enemy.health;
    result.defeated = result.healthBefore > 0 && enemy.health <= 0;
    this.logCombat(`${hero.name}'s Boon of Irresistible Offense adds ${bonus} more damage`);
  }

  /**
   * Phase 13.8 (D-093): Paladin only — auto-spends a 1st-level spell slot on
   * a landed melee hit for bonus radiant damage, whenever one remains (no
   * interrupt-prompt UI exists, same precedent as Uncanny Dodge/Lucky). Only
   * wired into the basic Attack action (`tryBasicAttack`) — Divine Smite is
   * a melee WEAPON-attack feature in the SRD, not a spell/ability effect.
   */
  private applyPaladinSmite(hero: Hero, enemy: Enemy, result: AttackResult): void {
    if (hero.classId !== "paladin" || result.damageDealt <= 0) return;
    if (hero.spellSlotsRemainingAt(1) <= 0) return;
    hero.spendSpellSlot(1);
    const bonus = DIVINE_SMITE_BONUS_DAMAGE + hero.subclassSmiteBonus;
    enemy.health = Math.max(0, enemy.health - bonus);
    result.damageDealt += bonus;
    result.healthAfter = enemy.health;
    result.defeated = result.healthBefore > 0 && enemy.health <= 0;
    this.logCombat(`${hero.name} empowers the strike with Divine Smite for ${bonus} more damage`);
  }

  /**
   * Phase 13.8 (D-093): Ranger only — a landed hit against the enemy
   * currently marked by Hunter's Mark deals bonus damage. Only wired into
   * the basic Attack action, same scope as Divine Smite above. Phase 14
   * (D-097): a Hunter also adds Colossus Slayer's own bonus on the same hit
   * (`hero.colossusSlayerBonus`, 0 for every other Ranger subclass/none).
   */
  private applyHuntersMarkBonus(hero: Hero, enemy: Enemy, result: AttackResult): void {
    if (hero.classId !== "ranger" || result.damageDealt <= 0) return;
    if (enemy.id !== hero.markedEnemyId) return;
    const bonus = HUNTERS_MARK_BONUS_DAMAGE + hero.colossusSlayerBonus;
    enemy.health = Math.max(0, enemy.health - bonus);
    result.damageDealt += bonus;
    result.healthAfter = enemy.health;
    result.defeated = result.healthBefore > 0 && enemy.health <= 0;
    const suffix = hero.colossusSlayerBonus > 0 ? " (Colossus Slayer)" : "";
    this.logCombat(`${hero.name}'s Hunter's Mark sears ${enemy.def.name} for ${bonus} more damage${suffix}`);
    // Phase 14.2 (D-099): Beastbond Warden's Bonded Strike — the same landed
    // hit against the marked target also heals the Ranger. 0 for every
    // other Ranger subclass/none.
    const healed = Math.min(hero.beastbondStrikeHeal, hero.effectiveMaxHealth - hero.health);
    if (healed <= 0) return;
    hero.health += healed;
    this.logCombat(`${hero.name}'s Bonded Strike restores ${healed} HP`);
    const token = this.heroTokens.get(hero.id);
    if (token) this.updateHpText(token, hero.health, hero.effectiveMaxHealth);
  }

  /**
   * Phase 14 (D-097): The Fiend only — a killing blow heals the Warlock a
   * flat amount (`hero.darkOnesBlessingHeal`, 0 for every other Warlock
   * subclass/none). Same scope as Divine Smite/Hunter's Mark above (basic
   * Attack action only), and the same shape as an on-kill equipment proc
   * (D-094) but self-targeting and class-gated instead of item-gated.
   */
  private applyDarkOnesBlessing(hero: Hero, result: AttackResult): void {
    if (!result.defeated || hero.darkOnesBlessingHeal <= 0) return;
    const healed = Math.min(hero.darkOnesBlessingHeal, hero.effectiveMaxHealth - hero.health);
    if (healed <= 0) return;
    hero.health += healed;
    this.logCombat(`${hero.name}'s Dark One's Blessing restores ${healed} HP`);
    const token = this.heroTokens.get(hero.id);
    if (token) this.updateHpText(token, hero.health, hero.effectiveMaxHealth);
  }

  /**
   * Phase 14.2 (D-099): Shadowblade only — bonus damage on this Rogue's
   * first landed hit each battle. Same scope as Divine Smite/Hunter's Mark
   * above (basic Attack action only); consumed via
   * `consumeShadowbladeFirstStrike` the instant it applies, so it can never
   * fire twice in one battle.
   */
  private applyShadowbladeFirstStrike(hero: Hero, enemy: Enemy, result: AttackResult): void {
    if (result.damageDealt <= 0 || hero.shadowbladeFirstStrikeBonus <= 0) return;
    const bonus = hero.shadowbladeFirstStrikeBonus;
    hero.consumeShadowbladeFirstStrike();
    enemy.health = Math.max(0, enemy.health - bonus);
    result.damageDealt += bonus;
    result.healthAfter = enemy.health;
    result.defeated = result.healthBefore > 0 && enemy.health <= 0;
    this.logCombat(`${hero.name}'s First Strike lands for ${bonus} more damage`);
  }

  /**
   * Phase 13.9 (D-094): resolve every proc on every item the hero currently
   * has equipped, against this same landed swing — same scope boundary as
   * Divine Smite/Hunter's Mark above (basic Attack action only). A hero can
   * wear several proc items at once; each resolves independently in slot
   * order (`Hero.equippedProcItems`).
   */
  private applyEquipmentProcs(hero: Hero, enemy: Enemy, result: AttackResult): void {
    for (const def of hero.equippedProcItems()) {
      this.applyEquipmentProc(hero, enemy, result, def);
    }
  }

  private applyEquipmentProc(hero: Hero, enemy: Enemy, result: AttackResult, def: EquipmentDefinition): void {
    const proc = def.proc;
    if (!proc) return;
    switch (proc.kind) {
      case "onHitStatus": {
        if (result.damageDealt <= 0 || !enemy.isAlive()) return;
        enemy.applyStatus(proc.statusId, proc.durationTurns);
        this.logCombat(`${def.name} afflicts ${enemy.def.name} with ${getStatusEffectDefinition(proc.statusId).name}`);
        return;
      }
      case "onHitSaveOrDamage": {
        if (result.damageDealt <= 0 || !enemy.isAlive()) return;
        const save = SavingThrowSystem.rollSave(enemy.savingThrowBonus, proc.saveDC, this.random);
        if (save.success) {
          this.logCombat(`${enemy.def.name} resists ${def.name}'s effect (save ${save.total} vs DC ${proc.saveDC})`);
          return;
        }
        // D-137: a proc that declares its own damageType/damageTypes routes
        // through the same resistance math as a spell/attack; one that
        // doesn't (every item before this decision) keeps hitting health
        // directly, unchanged.
        const bonusDamage =
          proc.damageType || proc.damageTypes
            ? CombatSystem.applyResistance(
                proc.bonusDamage,
                {
                  rangeTiles: 0,
                  damage: proc.bonusDamage,
                  attackBonus: 0,
                  damageType: proc.damageType,
                  damageTypes: proc.damageTypes,
                  magical: proc.magical,
                },
                enemy,
              )
            : proc.bonusDamage;
        enemy.health = Math.max(0, enemy.health - bonusDamage);
        result.damageDealt += bonusDamage;
        result.healthAfter = enemy.health;
        result.defeated = result.healthBefore > 0 && enemy.health <= 0;
        this.logCombat(`${def.name} sears ${enemy.def.name} for ${bonusDamage} more damage`);
        return;
      }
      case "onKillHealNearestAlly": {
        if (!result.defeated) return;
        const target = this.nearestOtherLivingAlly(hero) ?? hero;
        const healed = Math.min(proc.healAmount, target.effectiveMaxHealth - target.health);
        target.health += healed;
        this.logCombat(`${def.name} channels ${enemy.def.name}'s defeat into ${healed} HP for ${target.name}`);
        const token = this.heroTokens.get(target.id);
        if (token) this.updateHpText(token, target.health, target.effectiveMaxHealth);
        return;
      }
      case "onHitWhileResistant": {
        if (result.damageDealt <= 0 || !hero.hasDamageResistance) return;
        enemy.health = Math.max(0, enemy.health - proc.bonusDamage);
        result.damageDealt += proc.bonusDamage;
        result.healthAfter = enemy.health;
        result.defeated = result.healthBefore > 0 && enemy.health <= 0;
        this.logCombat(`${def.name} flares with ${hero.name}'s fury for ${proc.bonusDamage} more damage`);
        return;
      }
    }
  }

  /**
   * D-178: a non-caster hero never reaches this handler at all anymore
   * (`showAbilityButtonFor` only shows the Q button for a real caster) — Q
   * always opens the full spellbook now, one resolver instead of a
   * caster/non-caster branch.
   */
  private onAbilityButton(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (this.ui.kind !== "heroSelected") return;
    const hero = this.heroById(this.ui.heroId);
    if (!hero) return;
    if (!hero.canAct()) {
      this.refreshStatus();
      return;
    }
    // Phase 21 (D-112), Anti-caster: "silenced" blocks a spell/ability cast
    // specifically (the hero can still move or make a basic Attack) — the
    // mechanical stand-in for a Silence/Anti-Magic-Field effect.
    if (hero.isSilenced) {
      this.logCombat(`${hero.name} is Silenced and can't cast right now`);
      return;
    }
    if (!this.isCasterHero(hero)) return;
    this.setInteraction({ kind: "choosingSpell", heroId: hero.id });
  }

  /**
   * Resolves an enemy-targeted spell — shared by every spellbook-driven
   * cast (`aimingSpell`'s `showSpellTargets`/`castChosenSpellOn`), so
   * there's one resolver, not a parallel copy per caller.
   */
  private castAbilityOn(hero: Hero, enemy: Enemy, ability: AbilityDefinition): void {
    if (!hero.canAct()) {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    // D-125: an offensive ability breaks this hero's own hidden state, same as a basic attack.
    if (hero.isHidden) hero.reveal();
    if (ability.savingThrow) {
      this.castSavingThrowAbilityOn(hero, ability, enemy);
      return;
    }
    const inspired = hero.pendingInspirationBonus > 0;
    const result = CombatSystem.attackSingle(
      hero.position,
      enemy,
      {
        rangeTiles: ability.rangeTiles,
        damage: ability.damage + (inspired ? hero.pendingInspirationBonus : 0),
        attackBonus: hero.effectiveAttackBonus + (inspired ? hero.pendingInspirationBonus : 0),
        autoHit: ability.autoHit,
        damageType: ability.damageType,
        damageTypes: ability.damageTypes,
        magical: true,
      },
      this.random,
    );
    if (!result) {
      this.rejectAt(enemy.position, `${enemy.def.name} is out of range`);
      this.returnToAimingMode(hero, ability.id);
      return;
    }
    if (inspired) {
      hero.clearInspiration();
      this.logCombat(`${hero.name} channels Bardic Inspiration into the attack`);
    }
    this.spendSpellSlotIfNeeded(hero, ability);
    hero.markActedForSpellCast();
    this.playCastVisual(ability, hero.position, enemy.position);
    this.applyHeroResults(hero, ability.name, [result], ability.appliesStatus, deathCauseForAbility(ability));
    // Phase 16 (D-106): a forced-movement spell shoves a surviving hit target
    // away from the caster, after damage/status but before the wave-clear
    // check (a pushed-then-dead enemy has nowhere to go, so this is skipped).
    if (ability.forcedMoveTiles && BattleScene.didHit(result) && enemy.isAlive()) {
      this.pushEnemyAway(hero.position, enemy, ability.forcedMoveTiles);
      if (enemy.isAlive()) {
        const token = this.enemyTokens.get(enemy.instanceId);
        if (token) this.placeToken(token, enemy.position);
      }
    }
    const clearedEarly = this.afterHeroDamage();
    if (!clearedEarly) this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 16 (D-106): push `enemy` directly away from `from`, up to `tiles`
   * steps along whichever axis has the larger displacement, stopping early
   * at the first blocked tile (wall, boundary, another combatant) — the
   * mechanical stand-in for every SRD forced-movement spell. `from` is the
   * CASTER's tile for a single-target push, or the blast's own center tile
   * for an `aoeAtRange` push (see `castAoeAtRangeSpell`) — pushing away
   * from wherever the effect actually originated.
   */
  private pushEnemyAway(from: GridPosition, enemy: Enemy, tiles: number): void {
    const dx = enemy.position.x - from.x;
    const dy = enemy.position.y - from.y;
    const stepX = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
    const stepY = stepX === 0 ? Math.sign(dy) : 0;
    if (stepX === 0 && stepY === 0) return;
    let pos = { ...enemy.position };
    for (let i = 0; i < tiles; i++) {
      const next = { x: pos.x + stepX, y: pos.y + stepY };
      if (!this.map.isInBounds(next)) break;
      // Phase 23 (D-114): a pit is the one exception to "stop before an
      // unwalkable tile" — a unit shoved onto one falls in and is instantly
      // defeated, resolved through the same death-trigger funnel as any
      // other kill (gold, Splitter/Carrier, Explosive, etc.), rather than
      // just being stopped short like a wall or cliff would.
      if (this.map.isPit(next)) {
        enemy.position = next;
        enemy.health = 0;
        this.logCombat(`${enemy.def.name} is shoved into a pit and falls to its doom!`);
        this.resolveDeaths(this.waveSystem.removeDefeated());
        return;
      }
      if (!this.map.isWalkable(next)) break;
      if (this.buildSystem.isWallAt(next)) break;
      if (this.isLivingHeroAt(next) || this.enemyAt(next)) break;
      pos = next;
    }
    enemy.position = pos;
  }

  /** A rejected target click re-enters the spellbook's aiming mode so the player can pick a different target. */
  private returnToAimingMode(hero: Hero, abilityId: string): void {
    this.setInteraction({ kind: "aimingSpell", heroId: hero.id, abilityId });
  }

  /** Spends a spell slot if this ability actually costs one (leveled spells only — cantrips/mundane abilities are free). */
  /**
   * Phase 18 (D-109): also the choke point for Magic Initiate's free-cast
   * use (spent instead of a real slot, if this exact spell has one
   * remaining) and Boon of Spell Recall's 1d4-vs-slot-level roll — the roll
   * itself is made HERE (this scene owns `this.random`), not inside `Hero`,
   * matching this project's "controlled randomness flows through a service"
   * convention (see `RandomService`'s own module comment). Rolling only
   * when the hero actually holds the boon avoids nudging the shared RNG
   * sequence for every other spell cast.
   */
  private spendSpellSlotIfNeeded(hero: Hero, ability: AbilityDefinition): void {
    if (!ability.spellSlotLevel) return;
    const recallRoll = hero.hasBoonOfSpellRecall ? this.random.rollD4() : 0;
    hero.spendSpellSlotFor(ability.id, ability.spellSlotLevel, recallRoll);
  }

  /**
   * Phase 13.5 (D-090): resolve a save-based ability (currently only Sacred
   * Flame) via `SavingThrowSystem` instead of `CombatSystem`'s attack roll —
   * the target rolls its saving throw against the caster's `spellSaveDC`;
   * full damage on a failed save, none on a success. `hero.spellSaveDC`
   * should always be set for a hero casting a `savingThrow`-tagged spell
   * (only a caster ever gets one), but a defensive fallback DC keeps this
   * from ever throwing if that invariant is broken.
   */
  private castSavingThrowAbilityOn(hero: Hero, ability: AbilityDefinition, enemy: Enemy): void {
    if (!CombatSystem.isInRange(hero.position, enemy.position, ability.rangeTiles) || !enemy.isAlive()) {
      this.rejectAt(enemy.position, `${enemy.def.name} is out of range`);
      this.returnToAimingMode(hero, ability.id);
      return;
    }
    const dc = hero.spellSaveDC ?? 10;
    this.spendSpellSlotIfNeeded(hero, ability);
    this.playCastVisual(ability, hero.position, enemy.position);
    enemy.lastDeathCause = deathCauseForAbility(ability);
    const result = SavingThrowSystem.applySaveOrDamage(enemy, ability.damage, dc, enemy.savingThrowBonus, this.random, "normal", {
      damageType: ability.damageType,
      damageTypes: ability.damageTypes,
      magical: true,
    });
    hero.markActedForSpellCast();
    if (result.save.success) {
      this.logCombat(`${enemy.def.name} resists ${hero.name}'s ${ability.name} (save ${result.save.total} vs DC ${dc})`);
    } else {
      const verb = result.defeated ? "defeats" : "sears";
      this.logCombat(`${hero.name}'s ${ability.name} ${verb} ${enemy.def.name} for ${result.damageDealt}`);
      this.showHeroHit(enemy);
      if (ability.appliesStatus && enemy.isAlive()) {
        enemy.applyStatus(ability.appliesStatus.statusId, ability.appliesStatus.durationTurns);
        this.logCombat(`${enemy.def.name} is ${getStatusEffectDefinition(ability.appliesStatus.statusId).name.toLowerCase()}`);
      }
    }
    const clearedEarly = this.afterHeroDamage();
    if (!clearedEarly) this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 13.7 (D-092): resolve a `targetsAlly` spell (currently only Cure
   * Wounds) — this game's first ally-targeted effect, so unlike
   * `castAbilityOn`/`castSavingThrowAbilityOn` there's no existing
   * enemy-targeting resolver to share. Heals `target` (which may be the
   * caster itself — `livingAlliesInRange` includes distance 0) for
   * `ability.healAmount`, capped at their max HP.
   *
   * Phase 13.11 (D-096): a Life Domain caster's Disciple of Life adds
   * `hero.discipleOfLifeBonus` to the TARGET's heal; Blessed Healer
   * (level 6+) separately heals the CASTER when it heals someone else (not
   * itself — that would double-count against the same cast).
   */
  private castHealSpellOn(hero: Hero, ability: AbilityDefinition, target: Hero): void {
    if (!hero.canAct()) {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    if (GridSystem.diagonalDistance(hero.position, target.position) > ability.rangeTiles) {
      this.rejectAt(target.position, `${target.name} is out of range`);
      this.returnToAimingMode(hero, ability.id);
      return;
    }
    // D-125: casting any spell breaks this hero's own hidden state, same as a basic attack.
    if (hero.isHidden) hero.reveal();
    this.spendSpellSlotIfNeeded(hero, ability);
    hero.markActedForSpellCast();
    this.playCastVisual(ability, hero.position, target.position);
    const disciplineBonus = ability.healAmount ? hero.discipleOfLifeBonus : 0;
    if (ability.healAmount) {
      const healed = Math.min(ability.healAmount + disciplineBonus, target.effectiveMaxHealth - target.health);
      target.health += healed;
      let msg = `${hero.name} channels ${ability.name}, healing ${target.name} for ${healed}`;
      if (disciplineBonus > 0) msg += " (Disciple of Life)";
      this.logCombat(msg);
      const token = this.heroTokens.get(target.id);
      if (token) this.updateHpText(token, target.health, target.effectiveMaxHealth);
    }
    // Phase 16 (D-106): a spell may ALSO (or instead) grant a lingering ally
    // buff — see data/buffEffects.ts.
    if (ability.appliesBuff) {
      target.applyBuff(ability.appliesBuff.buffId, ability.appliesBuff.durationTurns);
      this.logCombat(`${hero.name}'s ${ability.name} leaves ${target.name} ${getBuffEffectDefinition(ability.appliesBuff.buffId).name.toLowerCase()}`);
    }

    if (target.id !== hero.id && ability.healAmount) {
      const selfBonus = hero.blessedHealerBonus;
      if (selfBonus > 0) {
        const selfHealed = Math.min(selfBonus, hero.effectiveMaxHealth - hero.health);
        if (selfHealed > 0) {
          hero.health += selfHealed;
          this.logCombat(`${hero.name} also regains ${selfHealed} HP (Blessed Healer)`);
          const casterToken = this.heroTokens.get(hero.id);
          if (casterToken) this.updateHpText(casterToken, hero.health, hero.effectiveMaxHealth);
        }
      }
    }
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 16 (D-106): resolve an `areaAllies` spell — heals and/or buffs
   * EVERY living ally at once, no aiming needed (same "no per-target UI"
   * simplification `aoeAdjacent` already makes for enemies).
   */
  private castAreaAllySpell(hero: Hero, ability: AbilityDefinition): void {
    if (!hero.canAct()) {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    // D-125: casting any spell breaks this hero's own hidden state, same as a basic attack.
    if (hero.isHidden) hero.reveal();
    this.spendSpellSlotIfNeeded(hero, ability);
    hero.markActedForSpellCast();
    this.playCastVisual(ability, hero.position, hero.position);
    const targets = this.livingAlliesInRange(hero.position, ability.rangeTiles);
    for (const target of targets) {
      if (ability.healAmount) {
        const healed = Math.min(ability.healAmount, target.effectiveMaxHealth - target.health);
        target.health += healed;
        const token = this.heroTokens.get(target.id);
        if (token) this.updateHpText(token, target.health, target.effectiveMaxHealth);
      }
      if (ability.appliesBuff) target.applyBuff(ability.appliesBuff.buffId, ability.appliesBuff.durationTurns);
    }
    this.logCombat(`${hero.name} channels ${ability.name} across the party`);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 16 (D-106): resolve an `aoeAtRange` spell — every enemy within
   * `ability.radiusTiles` of the CHOSEN tile takes damage/status, reusing
   * `CombatSystem.attackArea` centered there instead of on the caster.
   */
  private castAoeAtRangeSpell(hero: Hero, ability: AbilityDefinition, tile: GridPosition): void {
    if (!hero.canAct()) {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    // D-125: casting any spell breaks this hero's own hidden state, same as a basic attack.
    if (hero.isHidden) hero.reveal();
    if (GridSystem.diagonalDistance(hero.position, tile) > ability.rangeTiles) {
      this.rejectAt(tile, "Out of range");
      this.setInteraction({ kind: "aimingTileSpell", heroId: hero.id, abilityId: ability.id });
      return;
    }
    const radius = ability.radiusTiles ?? 1;
    const targets = CombatSystem.targetsInRange(tile, radius, this.waveSystem.enemies);
    if (targets.length === 0) {
      this.rejectAt(tile, `No enemies within the blast`);
      this.setInteraction({ kind: "aimingTileSpell", heroId: hero.id, abilityId: ability.id });
      return;
    }
    this.spendSpellSlotIfNeeded(hero, ability);
    hero.markActedForSpellCast();
    this.playCastVisual(ability, hero.position, tile);
    const aoeDeathCause = deathCauseForAbility(ability);

    if (ability.savingThrow) {
      // Phase 16 follow-up (D-106): an aoeAtRange spell may force a SAVE
      // instead of an attack roll, mirroring `castSavingThrowAbilityOn`'s
      // single-target rule — every enemy in the blast rolls independently
      // against the caster's spellSaveDC.
      const dc = hero.spellSaveDC ?? 10;
      for (const enemy of targets) {
        enemy.lastDeathCause = aoeDeathCause;
        const result = SavingThrowSystem.applySaveOrDamage(enemy, ability.damage, dc, enemy.savingThrowBonus, this.random, "normal", {
          damageType: ability.damageType,
          damageTypes: ability.damageTypes,
          magical: true,
        });
        if (result.save.success) {
          this.logCombat(`${enemy.def.name} resists ${hero.name}'s ${ability.name} (save ${result.save.total} vs DC ${dc})`);
        } else {
          const verb = result.defeated ? "defeats" : "sears";
          this.logCombat(`${hero.name}'s ${ability.name} ${verb} ${enemy.def.name} for ${result.damageDealt}`);
          this.showHeroHit(enemy);
          if (ability.appliesStatus && enemy.isAlive()) {
            enemy.applyStatus(ability.appliesStatus.statusId, ability.appliesStatus.durationTurns);
            this.logCombat(`${enemy.def.name} is ${getStatusEffectDefinition(ability.appliesStatus.statusId).name.toLowerCase()}`);
          }
          if (ability.forcedMoveTiles && enemy.isAlive()) {
            this.pushEnemyAway(tile, enemy, ability.forcedMoveTiles);
            if (enemy.isAlive()) {
              const token = this.enemyTokens.get(enemy.instanceId);
              if (token) this.placeToken(token, enemy.position);
            }
          }
        }
      }
      this.syncEnemyTokens();
    } else {
      const results = CombatSystem.attackArea(
        tile,
        this.waveSystem.enemies,
        {
          rangeTiles: radius,
          damage: ability.damage,
          attackBonus: hero.effectiveAttackBonus,
          autoHit: ability.autoHit,
          damageType: ability.damageType,
          damageTypes: ability.damageTypes,
          magical: true,
        },
        this.random,
      );
      this.applyHeroResults(hero, ability.name, results, ability.appliesStatus, aoeDeathCause);
      // Phase 16 follow-up (D-106): a forced-movement AoE (Thunderwave,
      // Gust of Wind, Reverse Gravity) previously never actually pushed
      // anyone — `forcedMoveTiles` was only wired into the single-target
      // resolver. Push every surviving hit target away from the BLAST tile
      // (not the caster), since that's where an aoeAtRange effect
      // originates.
      if (ability.forcedMoveTiles) {
        for (const enemy of targets) {
          if (!enemy.isAlive()) continue;
          this.pushEnemyAway(tile, enemy, ability.forcedMoveTiles);
          if (enemy.isAlive()) {
            const token = this.enemyTokens.get(enemy.instanceId);
            if (token) this.placeToken(token, enemy.position);
          }
        }
      }
    }
    const clearedEarly = this.afterHeroDamage();
    if (!clearedEarly) this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 16 (D-106): resolve a `teleportSelf` spell — the caster jumps
   * straight to an empty tile the player chose, up to `ability.rangeTiles`
   * away. Does not spend the move slot (a real teleport, not a walk).
   */
  private castTeleportSelfSpell(hero: Hero, ability: AbilityDefinition, tile: GridPosition): void {
    if (!hero.canAct()) {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    // D-125: casting any spell breaks this hero's own hidden state, same as a basic attack.
    if (hero.isHidden) hero.reveal();
    if (GridSystem.diagonalDistance(hero.position, tile) > ability.rangeTiles || !this.isTileEmptyForPlacement(tile)) {
      this.rejectAt(tile, "Can't teleport there");
      this.setInteraction({ kind: "aimingTileSpell", heroId: hero.id, abilityId: ability.id });
      return;
    }
    this.spendSpellSlotIfNeeded(hero, ability);
    hero.markActedForSpellCast();
    const originPosition = { ...hero.position };
    this.playCastVisual(ability, originPosition, tile);
    hero.position = { ...tile };
    const token = this.heroTokens.get(hero.id);
    if (token) this.placeToken(token, hero.position);
    this.logCombat(`${hero.name} teleports away with ${ability.name}`);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 16 (D-106): resolve a `summonsId` spell — places a temporary ally
   * (see `data/summons.ts`/`SummonSystem`) on an empty tile the player
   * chose, up to `ability.rangeTiles` away.
   */
  private castSummonSpell(hero: Hero, ability: AbilityDefinition, tile: GridPosition): void {
    if (!hero.canAct() || !ability.summonsId) {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    // D-125: casting any spell breaks this hero's own hidden state, same as a basic attack.
    if (hero.isHidden) hero.reveal();
    if (GridSystem.diagonalDistance(hero.position, tile) > ability.rangeTiles || !this.isTileEmptyForPlacement(tile)) {
      this.rejectAt(tile, "Can't summon there");
      this.setInteraction({ kind: "aimingTileSpell", heroId: hero.id, abilityId: ability.id });
      return;
    }
    this.spendSpellSlotIfNeeded(hero, ability);
    hero.markActedForSpellCast();
    this.playCastVisual(ability, hero.position, tile);
    const summon = this.summonSystem.spawn(ability.summonsId, hero.id, tile, ability.summonDurationTurns ?? 3);
    this.spawnSummonToken(summon);
    this.logCombat(`${hero.name} summons ${summon.def.name} with ${ability.name}`);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /** A minimal token for a summoned ally — same shape as a hero/enemy token, a distinct teal fill. */
  private spawnSummonToken(summon: Summon): void {
    const c = this.grid.tileToWorldCenter(summon.position);
    const circle = this.add.circle(c.x, c.y, this.grid.tileSize * 0.3, 0x2fa89a).setDepth(9).setStrokeStyle(2, 0xd8f5f0, 0.9);
    const label = this.add
      .text(c.x, c.y - 4, summon.def.name[0], {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(9);
    const hp = this.add
      .text(c.x, c.y + this.grid.tileSize * 0.2, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(11);
    const token: Token = { circle, label, hp };
    this.summonTokens.set(summon.instanceId, token);
    this.updateHpText(token, summon.health, summon.def.maxHealth);
  }

  private removeSummonToken(instanceId: string): void {
    const token = this.summonTokens.get(instanceId);
    if (!token) return;
    token.circle.destroy();
    token.label.destroy();
    token.hp.destroy();
    this.summonTokens.delete(instanceId);
  }

  /**
   * Phase 16 (D-106): resolve an `altersTerrainId` spell — places a
   * temporary structure (see `data/structures.ts`) on an empty, placeable
   * tile the player chose, reusing `BuildSystem.place`'s exact validation
   * (including never sealing off every spawn-to-exit route) a built wall
   * already gets. Tracked in `temporaryStructures` for auto-removal once
   * `terrainDurationTurns` runs out (see `tickTemporaryStructures`).
   */
  private castTerrainSpell(hero: Hero, ability: AbilityDefinition, tile: GridPosition): void {
    if (!hero.canAct() || !ability.altersTerrainId) {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    // D-125: casting any spell breaks this hero's own hidden state, same as a basic attack.
    if (hero.isHidden) hero.reveal();
    if (GridSystem.diagonalDistance(hero.position, tile) > ability.rangeTiles) {
      this.rejectAt(tile, "Out of range");
      this.setInteraction({ kind: "aimingTileSpell", heroId: hero.id, abilityId: ability.id });
      return;
    }
    const heroPositions = this.livingHeroes().map((h) => h.position);
    const result = this.buildSystem.place(
      ability.altersTerrainId,
      tile,
      (p) => this.isUnitAt(p),
      heroPositions,
      hero.id,
    );
    if (!result.ok || !result.structure) {
      this.rejectAt(tile, result.reason ?? "Can't place that there");
      this.setInteraction({ kind: "aimingTileSpell", heroId: hero.id, abilityId: ability.id });
      return;
    }
    this.spendSpellSlotIfNeeded(hero, ability);
    hero.markActedForSpellCast();
    this.playCastVisual(ability, hero.position, tile);
    this.temporaryStructures.push({
      instanceId: result.structure.instanceId,
      remainingTurns: ability.terrainDurationTurns ?? 3,
    });
    this.renderStructure(result.structure);
    this.logCombat(`${hero.name} shapes the battlefield with ${ability.name}`);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 16 (D-106): decrement every spell-placed structure's remaining
   * duration by one and remove any that just expired. Called once per hero
   * turn, alongside `summonSystem.actAndTick`.
   */
  private tickTemporaryStructures(): void {
    const expired: string[] = [];
    for (const entry of this.temporaryStructures) {
      entry.remainingTurns -= 1;
      if (entry.remainingTurns <= 0) expired.push(entry.instanceId);
    }
    this.temporaryStructures = this.temporaryStructures.filter((e) => e.remainingTurns > 0);
    for (const instanceId of expired) {
      this.buildSystem.remove(instanceId);
      this.destroyStructureToken(instanceId);
    }
  }

  /**
   * Phase 16 (D-106): dispatch a click while a tile-aimed spell
   * (`aimingTileSpell`) is being resolved, to whichever resolver its own
   * fields call for.
   */
  private castTileSpellOn(hero: Hero, abilityId: string, tile: GridPosition): void {
    const ability = getAbility(abilityId);
    if (ability.kind === "aoeAtRange") {
      this.castAoeAtRangeSpell(hero, ability, tile);
    } else if (ability.teleportSelf) {
      this.castTeleportSelfSpell(hero, ability, tile);
    } else if (ability.summonsId) {
      this.castSummonSpell(hero, ability, tile);
    } else if (ability.altersTerrainId) {
      this.castTerrainSpell(hero, ability, tile);
    } else {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
    }
  }

  /**
   * Phase 13.7 (D-092): open the spellbook overlay — every spell
   * `hero.knownSpellAbilityIds()` lists that the hero can actually afford
   * right now (`Hero.canCastSpell` — every cantrip, plus a leveled spell
   * only while a slot remains). Filters out an unaffordable leveled spell
   * entirely rather than showing a disabled button, same "don't offer a
   * dead-end choice" treatment `showRestChoice` already uses.
   *
   * Phase 16 (D-106): a full caster's known-spell list can now run well
   * past 100 entries (see `characterCreation.ts`'s expanded per-class
   * arrays) — the original single centered row (sized for a 2-6-spell
   * list) would render most buttons off-canvas. This lays out a grid,
   * `SPELLBOOK_COLUMNS` × `SPELLBOOK_ROWS` per page, with Prev/Next paging
   * once the castable list overflows one page — same paging pattern
   * `CompendiumScene`'s Spells tab already uses for the same reason.
   */
  private renderSpellbookOverlay(hero: Hero): void {
    this.clearSpellbookOverlay();
    const castable = hero.knownSpellAbilityIds().filter((id) => hero.canCastSpell(id));
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setDepth(40)
      .setInteractive();
    dim.on("pointerdown", () => this.setInteraction({ kind: "heroSelected", heroId: hero.id }));

    const columns = 4;
    const rows = 3;
    const perPage = columns * rows;
    const pageCount = Math.max(1, Math.ceil(castable.length / perPage));
    this.spellbookPage = Math.min(this.spellbookPage, pageCount - 1);
    const pageLabel = pageCount > 1 ? ` (page ${this.spellbookPage + 1}/${pageCount})` : "";
    const title = this.add
      .text(GAME_WIDTH / 2, 130, `${hero.name} — Cast a Spell${pageLabel}`, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "28px",
        color: "#8ad0f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(41);
    this.spellbookOverlay.push(dim, title);

    const width = 260;
    const height = 130;
    const colGap = 20;
    const rowGap = 16;
    const gridWidth = columns * width + (columns - 1) * colGap;
    const startX = GAME_WIDTH / 2 - gridWidth / 2 + width / 2;
    const startY = 200;
    const pageItems = castable.slice(this.spellbookPage * perPage, this.spellbookPage * perPage + perPage);
    pageItems.forEach((id, i) => {
      const ability = getAbility(id);
      // D-127: a charge-based item's granted spell shows its own charge
      // count instead of a spell-slot count — it isn't spent from either.
      const chargeInfo = hero.chargeInfoForSpell(id);
      const costLabel = chargeInfo
        ? `${chargeInfo.remaining}/${chargeInfo.max} charges`
        : ability.spellSlotLevel
          ? `${ordinalSpellLevel(ability.spellSlotLevel)}-level (${hero.spellSlotsRemainingAt(ability.spellSlotLevel)} left)`
          : "cantrip";
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = startX + col * (width + colGap);
      const y = startY + row * (height + rowGap);
      const btn = this.add
        .rectangle(x, y, width, height, 0x3a5a8a)
        .setInteractive({ useHandCursor: true })
        .setDepth(41);
      const name = this.add
        .text(x, y - height / 2 + 22, `${ability.name} · ${costLabel}`, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: "#e8e8f0",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: width - 16 },
        })
        .setOrigin(0.5)
        .setDepth(42);
      const desc = this.add
        .text(x, y + 16, ability.description, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "10px",
          color: "#c8c8d8",
          align: "center",
          wordWrap: { width: width - 16 },
        })
        .setOrigin(0.5)
        .setDepth(42);
      btn.on("pointerover", () => btn.setFillStyle(0x4a6a9a));
      btn.on("pointerout", () => btn.setFillStyle(0x3a5a8a));
      btn.on("pointerdown", () => this.chooseSpell(hero, id));
      this.spellbookOverlay.push(btn, name, desc);
    });

    if (pageCount > 1) {
      const navY = startY + rows * (height + rowGap) + 30;
      const prev = this.add
        .text(GAME_WIDTH / 2 - 80, navY, "◀ Prev", {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "18px",
          color: this.spellbookPage > 0 ? "#8ad0f0" : "#555560",
        })
        .setOrigin(0.5)
        .setDepth(41)
        .setInteractive({ useHandCursor: this.spellbookPage > 0 });
      prev.on("pointerdown", () => {
        if (this.spellbookPage > 0) {
          this.spellbookPage -= 1;
          this.renderSpellbookOverlay(hero);
        }
      });
      const next = this.add
        .text(GAME_WIDTH / 2 + 80, navY, "Next ▶", {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "18px",
          color: this.spellbookPage < pageCount - 1 ? "#8ad0f0" : "#555560",
        })
        .setOrigin(0.5)
        .setDepth(41)
        .setInteractive({ useHandCursor: this.spellbookPage < pageCount - 1 });
      next.on("pointerdown", () => {
        if (this.spellbookPage < pageCount - 1) {
          this.spellbookPage += 1;
          this.renderSpellbookOverlay(hero);
        }
      });
      this.spellbookOverlay.push(prev, next);
    }
  }

  private clearSpellbookOverlay(): void {
    for (const obj of this.spellbookOverlay) obj.destroy();
    this.spellbookOverlay = [];
  }

  /**
   * A spell picked from the spellbook — most need a target, so enter the
   * matching aiming mode; a few (Phase 16, D-106) resolve immediately with
   * no aiming at all, same as a signature `aoeAdjacent` ability.
   */
  private chooseSpell(hero: Hero, abilityId: string): void {
    const ability = getAbility(abilityId);
    if (ability.targetsAlly && ability.areaAllies) {
      this.castAreaAllySpell(hero, ability);
    } else if (ability.kind === "aoeAdjacent" && !ability.targetsAlly) {
      this.castAoeAdjacentSpell(hero, ability);
    } else if (
      ability.kind === "aoeAtRange" ||
      ability.teleportSelf ||
      ability.summonsId ||
      ability.altersTerrainId
    ) {
      this.setInteraction({ kind: "aimingTileSpell", heroId: hero.id, abilityId });
    } else {
      this.setInteraction({ kind: "aimingSpell", heroId: hero.id, abilityId });
    }
  }

  /**
   * Phase 16 (D-106): an `aoeAdjacent` spell picked from the spellbook (as
   * opposed to a non-caster's fixed signature ability, handled inline in
   * `onAbilityButton`) — hits every enemy adjacent to the caster, no aiming.
   */
  private castAoeAdjacentSpell(hero: Hero, ability: AbilityDefinition): void {
    if (!hero.canAct()) {
      this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    const results = CombatSystem.attackArea(
      hero.position,
      this.waveSystem.enemies,
      {
        rangeTiles: ability.rangeTiles,
        damage: ability.damage,
        attackBonus: hero.effectiveAttackBonus,
        autoHit: ability.autoHit,
        damageType: ability.damageType,
        damageTypes: ability.damageTypes,
        magical: true,
      },
      this.random,
    );
    if (results.length === 0) {
      this.rejectAt(hero.position, `No enemies within reach of ${ability.name}`);
      return;
    }
    // D-125: casting any spell breaks this hero's own hidden state, same as a basic attack.
    if (hero.isHidden) hero.reveal();
    this.spendSpellSlotIfNeeded(hero, ability);
    hero.markActedForSpellCast();
    this.playCastVisual(ability, hero.position, hero.position);
    this.applyHeroResults(hero, ability.name, results, ability.appliesStatus, deathCauseForAbility(ability));
    const clearedEarly = this.afterHeroDamage();
    if (!clearedEarly) this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 13.7 (D-092): resolve a click on a target tile while a spellbook
   * pick is being aimed — an ally tile for a `targetsAlly` spell, an enemy
   * tile otherwise. Called from `handleClick`'s `aimingSpell` branch.
   */
  private castChosenSpellOn(hero: Hero, abilityId: string, tile: GridPosition): void {
    const ability = getAbility(abilityId);
    if (ability.targetsAlly) {
      const target = this.heroAt(tile);
      if (target) this.castHealSpellOn(hero, ability, target);
      else this.setInteraction({ kind: "heroSelected", heroId: hero.id });
      return;
    }
    const enemy = this.enemyAt(tile);
    if (enemy && this.isEnemyTargetable(enemy, hero)) this.castAbilityOn(hero, enemy, ability);
    else this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 11.5 (D-078): drinking a potion spends the hero's ACTION (same
   * one-move-plus-one-action turn every other action uses — no new
   * action-economy hook needed). Always the lowest-numbered loaded slot;
   * with only two general slots, a picker for "which one" would be more UI
   * than the choice is worth (see data/potions.ts).
   */
  private onPotionButton(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    const heroId = this.ui.kind === "heroSelected" ? this.ui.heroId : null;
    if (!heroId) return;
    const hero = this.heroById(heroId);
    if (!hero) return;
    if (!hero.canAct()) {
      this.refreshStatus();
      return;
    }
    const slot = hero.firstLoadedPotionSlot();
    if (!slot) return;
    const used = hero.usePotion(slot);
    if (!used) return;
    hero.markActed();
    const effectText = used.effect === "heal" ? `heals ${used.amount} HP` : `+${used.amount} attack for the battle`;
    this.logCombat(`${hero.name} drinks ${used.name} (${effectText})`);
    const token = this.heroTokens.get(hero.id);
    if (token) this.updateHpText(token, hero.health, hero.effectiveMaxHealth);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /**
   * Phase 13.2 (D-087): Second Wind (Fighter, a bonus-action heal) or Cunning
   * Action's Dash (Rogue, a bonus-action second move) — whichever the
   * selected hero's class grants (see `showBonusActionButtonFor`, which only
   * shows this button when exactly one of the two applies).
   */
  private onBonusActionButton(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    const heroId = this.ui.kind === "heroSelected" ? this.ui.heroId : null;
    if (!heroId) return;
    const hero = this.heroById(heroId);
    if (!hero) return;
    if (hero.canUseSecondWind()) {
      const before = hero.health;
      hero.useSecondWind();
      this.logCombat(`${hero.name} uses Second Wind, healing ${hero.health - before} HP`);
    } else if (hero.canUseCunningAction()) {
      hero.useCunningActionDash();
      this.logCombat(`${hero.name} uses Cunning Action to Dash, gaining another move`);
    } else if (hero.canUseRage()) {
      hero.useRage();
      this.logCombat(`${hero.name} flies into a Rage — resisting harm and hitting harder`);
    } else if (hero.canUseWildShape()) {
      const before = hero.health;
      hero.useWildShape();
      this.logCombat(`${hero.name} assumes Wild Shape, gaining ${hero.health - before} HP and resisting harm`);
    } else if (hero.canUseFlurryOfBlows()) {
      hero.useFlurryOfBlows();
      this.logCombat(`${hero.name} unleashes a Flurry of Blows, gaining another attack`);
    } else if (hero.canUseBardicInspiration()) {
      const target = this.nearestOtherLivingAlly(hero) ?? hero;
      hero.useBardicInspiration();
      target.receiveInspiration(BARDIC_INSPIRATION_BONUS);
      this.logCombat(`${hero.name} inspires ${target.name} with Bardic Inspiration`);
    } else if (hero.canUseHuntersMark()) {
      const target = CombatSystem.chooseTarget(hero.position, HUNTERS_MARK_RANGE_TILES, this.waveSystem.enemies);
      if (!target) {
        this.rejectAt(hero.position, "No enemy within reach to mark");
        return;
      }
      hero.useHuntersMark(target.id);
      this.logCombat(`${hero.name} marks ${target.def.name} with Hunter's Mark`);
    } else if (hero.canUseQuickenSpell()) {
      hero.useQuickenSpell();
      this.logCombat(`${hero.name} readies Metamagic: Quickened Spell`);
    } else {
      return;
    }
    const token = this.heroTokens.get(hero.id);
    if (token) this.updateHpText(token, hero.health, hero.effectiveMaxHealth);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /** Phase 13.8 (D-093): Bardic Inspiration's auto-picked target — the nearest OTHER living ally (no separate aim step, same auto-apply precedent as Uncanny Dodge/Lucky). Null if the Bard is alone. */
  private nearestOtherLivingAlly(hero: Hero): Hero | null {
    const others = this.heroes.filter((h) => h.id !== hero.id && h.isAlive());
    if (others.length === 0) return null;
    return others.reduce((best, h) =>
      GridSystem.diagonalDistance(hero.position, h.position) < GridSystem.diagonalDistance(hero.position, best.position)
        ? h
        : best,
    );
  }

  /** Phase 13.2 (D-087): Fighter only — grants a second action this turn, once per battle. */
  private onActionSurgeButton(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    const heroId = this.ui.kind === "heroSelected" ? this.ui.heroId : null;
    if (!heroId) return;
    const hero = this.heroById(heroId);
    if (!hero || !hero.canUseActionSurge()) return;
    hero.useActionSurge();
    this.logCombat(`${hero.name} uses Action Surge, gaining an extra action`);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /** D-125: whichever single class action `showClassActionButtonFor` found eligible — see that method for why these can coexist with the bonus-action button. */
  private onClassActionButton(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    const heroId = this.ui.kind === "heroSelected" ? this.ui.heroId : null;
    if (!heroId) return;
    const hero = this.heroById(heroId);
    if (!hero) return;
    if (hero.canUseRecklessAttack()) {
      hero.activateRecklessAttack();
      this.logCombat(`${hero.name} attacks recklessly — advantage on its attacks, but attacks against it gain advantage too`);
    } else if (hero.canUsePreserveLife()) {
      const healed = hero.usePreserveLife(this.livingHeroes());
      const total = healed.reduce((sum, h) => sum + h.amount, 0);
      this.logCombat(`${hero.name} channels divinity, Preserve Life, restoring ${total} HP across the party`);
      for (const { hero: ally } of healed) {
        const token = this.heroTokens.get(ally.id);
        if (token) this.updateHpText(token, ally.health, ally.effectiveMaxHealth);
      }
    } else if (hero.canUseVanish()) {
      hero.useVanish();
      this.attemptHide(hero, "Vanish");
    } else if (hero.canUseCunningActionHide()) {
      hero.useCunningActionHide();
      this.attemptHide(hero, "Cunning Action's Hide");
    } else if (hero.canUseEmptyBody()) {
      hero.useEmptyBody();
      this.logCombat(`${hero.name} uses Empty Body, turning invisible`);
    } else {
      return;
    }
    this.updateHeroStatusBadge(hero);
    this.setInteraction({ kind: "heroSelected", heroId: hero.id });
  }

  /** D-125: rolls the shared Stealth check both Vanish and Cunning Action's Hide attempt, hiding the hero on success. */
  private attemptHide(hero: Hero, actionName: string): void {
    const dc = this.stealthDcForBoard();
    const result = SkillCheckSystem.rollCheck(hero.stealthCheckModifier(), dc, this.random, hero.stealthCheckAdvantage);
    if (result.success) {
      hero.hide();
      this.logCombat(`${hero.name} uses ${actionName}, vanishing from sight (Stealth ${result.total} vs DC ${dc})`);
    } else {
      this.logCombat(`${hero.name} tries ${actionName} but fails to stay hidden (Stealth ${result.total} vs DC ${dc})`);
    }
  }

  private applyHeroResults(
    hero: Hero,
    abilityName: string,
    results: AttackResult[],
    appliesStatus?: { statusId: StatusEffectId; durationTurns: number },
    deathCause?: DeathCause,
  ): void {
    for (const r of results) {
      const enemy = this.enemyById(r.targetId);
      const name = enemy ? enemy.def.name : "enemy";
      const verb = BattleScene.attackVerb(r);
      const suffix = BattleScene.didHit(r) ? ` for ${r.damageDealt}` : "";
      this.logCombat(`${hero.name}'s ${abilityName} ${verb} ${name}${suffix}`);
      this.logTechnical(BattleScene.technicalAttackLine(`${hero.name}'s ${abilityName}`, name, r));
      if (enemy && BattleScene.didHit(r)) {
        if (deathCause) enemy.lastDeathCause = deathCause;
        this.showHeroHit(enemy);
        // Phase 7 "spell-like abilities": an ability may chill/stun its target
        // in addition to damaging it, but only if the hit didn't kill it.
        if (appliesStatus && enemy.isAlive()) {
          enemy.applyStatus(appliesStatus.statusId, appliesStatus.durationTurns);
          this.logCombat(`${name} is ${getStatusEffectDefinition(appliesStatus.statusId).name.toLowerCase()}`);
        }
      }
    }
  }

  /**
   * Update enemy HP labels, remove any enemy the heroes have defeated, and
   * check whether that just cleared the whole wave. Returns true when it did
   * — in which case the game has already moved on (to Between Waves or
   * Victory) and the CALLER must NOT re-select the hero afterward.
   */
  private afterHeroDamage(): boolean {
    this.syncEnemyTokens();
    // Enemies the heroes defeated are removed and their reward gold awarded
    // exactly once (removeDefeated returns each slain enemy a single time).
    this.resolveDeaths(this.waveSystem.removeDefeated());
    this.updateHud();
    // Phase 21 (D-112): the Reflector archetype is the first way a hero's
    // OWN attack can kill that same hero (a reflected hit) — D-068's
    // party-wipe check otherwise only runs after an enemy phase, so check
    // again here rather than leaving the game in limbo until the next one.
    if (this.livingHeroes().length === 0) {
      this.defeatReason = "party";
      this.turns.transitionTo("defeat");
      return true;
    }
    return this.finishWaveEarlyIfComplete();
  }

  /**
   * Playtest fix: if a hero's own attack/ability just cleared the wave (no
   * more enemies due to spawn, none left alive), there is nothing for an
   * Enemy Phase to do — so skip straight to Between Waves or Victory instead
   * of forcing the player to click End Turn on an empty field first. Returns
   * true if it resolved the wave this way.
   */
  private finishWaveEarlyIfComplete(): boolean {
    if (this.turns.current !== "player") return false;
    if (!this.waveSystem.isCurrentWaveComplete()) return false;
    this.awardWaveReward(this.waveSystem.turnsElapsed);
    this.afterWaveCleared();
    return true;
  }

  /** Refresh HP labels and status badges for every living enemy on the field. */
  private syncEnemyTokens(): void {
    for (const enemy of this.waveSystem.enemies) {
      const token = this.enemyTokens.get(enemy.instanceId);
      if (token) this.updateHpText(token, enemy.health, enemy.def.maxHealth);
      this.updateStatusBadge(enemy);
      this.applyStealthVisual(enemy);
    }
  }

  /** KI-027: refresh an enemy's on-token status badge from its active effects. */
  private updateStatusBadge(enemy: Enemy): void {
    const badge = this.enemyStatusBadges.get(enemy.instanceId);
    if (!badge) return;
    const codes = STATUS_EFFECT_ORDER.filter((id) => enemy.hasStatus(id)).map(
      (id) => getStatusEffectDefinition(id).name[0],
    );
    if (codes.length === 0) {
      badge.setVisible(false);
      return;
    }
    badge.setText(codes.join("")).setVisible(true);
  }

  /**
   * Phase 11.7 (D-071): a hero landing on a "treasure" tile for the first
   * time this battle gets a one-time gold bonus. Consumed per-tile-instance
   * (not per-battle-globally), so a SECOND treasure tile elsewhere still
   * pays out even after the first has been claimed; per-battle only, not
   * persisted, since `consumedTreasureTiles` is reset on scene create.
   */
  private checkTreasureAt(hero: Hero): void {
    if (this.map.roleAt(hero.position) !== "treasure") return;
    const key = `${hero.position.x},${hero.position.y}`;
    if (this.consumedTreasureTiles.has(key)) return;
    this.consumedTreasureTiles.add(key);
    this.economy.award(TREASURE_GOLD_BONUS);
    this.logCombat(`${hero.name} finds a treasure cache (+${TREASURE_GOLD_BONUS}g)`);
    this.updateGoldHud();
  }

  /** Award reward gold for a set of removed enemies and clear their tokens. */
  private awardKillGold(removed: Enemy[]): void {
    if (removed.length === 0) return;
    const gold = RewardSystem.killGold(removed);
    if (gold > 0) this.economy.award(gold);
    for (const enemy of removed) {
      this.playEnemyDeathVisual(enemy);
      // Phase 20 (D-111): a treasure-laden enemy's bonus is called out on
      // its own, on top of its ordinary reward gold, RewardSystem.killGold
      // already totalled both into the `gold` awarded above.
      const treasureSuffix = enemy.def.treasureBonusGold
        ? ` (+${enemy.def.treasureBonusGold}g treasure!)`
        : "";
      this.logCombat(`${enemy.def.name} defeated (+${enemy.def.rewardGold}g${treasureSuffix})`);
      this.markEnemyKilled(enemy.def.id);
      // Phase 22 (magic-item expansion): most enemies drop nothing — see
      // LootSystem.rollLootDrop's per-role odds — so this is a no-op far
      // more often than not, same "the common case is nothing happens"
      // shape as every other per-kill check in this loop.
      const drop = rollLootDrop(enemy.def.role, this.random, this.currentLootPoolIds);
      if (drop) this.grantLootDrop(drop, enemy.def.name);
    }
    this.updateGoldHud();
  }

  /**
   * Phase 22 (magic-item expansion): resolve one loot drop — auto-equip it
   * into the first LIVING hero with a matching empty slot (skipping a hero
   * for whom it would exceed the attunement cap or conflict with its
   * current grip, same gates the shop's own equip flow enforces), or, if no
   * hero can currently take it, auto-sell it for its listed gold cost. No
   * "found but not equipped" inventory/browsing UI exists this pass — a
   * deliberate, documented scope boundary (see KNOWN_ISSUES).
   */
  private grantLootDrop(drop: LootDropResult, sourceName: string): void {
    const rarityTag = drop.rarity === "common" ? "" : ` (${RARITY_LABELS[drop.rarity]})`;
    if (isPotionId(drop.itemId)) {
      const def = getPotionDefinition(drop.itemId);
      for (const hero of this.heroes) {
        if (!hero.isAlive()) continue;
        const slot = GENERAL_SLOT_IDS.find((s) => !hero.equippedPotions[s]);
        if (!slot) continue;
        hero.equippedPotions[slot] = drop.itemId;
        this.logCombat(`${sourceName} drops ${def.name}${rarityTag} — ${hero.name} picks it up!`);
        this.updateGoldHud();
        return;
      }
      this.economy.award(def.cost);
      this.logCombat(`${sourceName} drops ${def.name}${rarityTag}, but no one has room to carry it — sold for ${def.cost}g`);
      this.updateGoldHud();
      return;
    }
    const def = getEquipmentDefinition(drop.itemId);
    for (const hero of this.heroes) {
      if (!hero.isAlive()) continue;
      const slot = GEAR_SLOT_IDS.find((s) => gearSlotType(s) === def.slot && !hero.equippedItems[s]);
      if (!slot) continue;
      if (hero.wouldExceedAttunementLimit(drop.itemId, slot)) continue;
      if (hero.wouldConflictWithGrip(drop.itemId, slot)) continue;
      hero.equippedItems[slot] = drop.itemId;
      this.ensureHeroCape(hero);
      hero.onGearChanged();
      this.logCombat(`${sourceName} drops ${def.name}${rarityTag} — ${hero.name} equips it!`);
      this.updateGoldHud();
      return;
    }
    this.economy.award(def.cost);
    this.logCombat(`${sourceName} drops ${def.name}${rarityTag}, but no hero can equip it right now — sold for ${def.cost}g`);
    this.updateGoldHud();
  }

  /**
   * Phase 11.6 (D-079): record an enemy DEFINITION id as SEEN in the Bestiary,
   * persisting only when its progress actually changes (markSeen returns the
   * SAME object reference when nothing changed, so this never writes to
   * localStorage on an already-seen enemy).
   */
  private markEnemySeen(enemyDefId: string): void {
    const next = markEnemyIdSeen(this.bestiaryProgress, enemyDefId);
    if (next === this.bestiaryProgress) return;
    this.bestiaryProgress = next;
    saveBestiaryProgress(window.localStorage, BESTIARY_STORAGE_KEY, next);
  }

  /** Phase 11.6 (D-079): record an enemy DEFINITION id as KILLED in the Bestiary. */
  private markEnemyKilled(enemyDefId: string): void {
    const next = markEnemyIdKilled(this.bestiaryProgress, enemyDefId);
    if (next === this.bestiaryProgress) return;
    this.bestiaryProgress = next;
    saveBestiaryProgress(window.localStorage, BESTIARY_STORAGE_KEY, next);
  }

  /**
   * Phase 11.8 (D-071): on reaching "victory", mark this campaign completed
   * if this battle was actually a campaign run (`campaignId` set). A no-op
   * for the classic path or a campaign-less custom party (`campaignId` is
   * `null`), and only writes to localStorage when completion actually
   * changes something new — same "don't spam localStorage" discipline as
   * `markEnemySeen`/`markEnemyKilled` above.
   *
   * D-177: for a CHAPTERED campaign, clearing a non-finale chapter only
   * advances `completedChapters` (`markChapterCompleted`) — the whole-
   * campaign `completedIds` flag (and its "[Completed]" tag on
   * `CampaignSelectScene`'s cards) is reserved for clearing the FINAL
   * chapter, matching a flat campaign's own single-battle-clears-it-all
   * behavior exactly once a region's whole arc is actually done.
   */
  private markCampaignCompletedIfAny(): void {
    if (!this.campaignId) return;
    const campaign = getCampaignDefinition(this.campaignId);
    if (isChapteredCampaign(campaign)) {
      const isFinalChapter = this.chapterIndex === totalChapters(campaign) - 1;
      let next = markChapterCompleted(this.campaignProgress, this.campaignId, this.chapterIndex);
      if (isFinalChapter) next = markCampaignCompleted(next, this.campaignId);
      if (next === this.campaignProgress) return;
      this.campaignProgress = next;
      saveCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY, next);
      if (this.chapterIndex === 0) {
        this.maybeUnlockHomeRegionCompanion(campaign);
        this.maybeUnlockSideMissionCompanion(campaign);
      }
      return;
    }
    const next = markCampaignCompleted(this.campaignProgress, this.campaignId);
    if (next === this.campaignProgress) return;
    this.campaignProgress = next;
    saveCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY, next);
    if (this.chapterIndex === 0) {
      this.maybeUnlockHomeRegionCompanion(campaign);
      this.maybeUnlockSideMissionCompanion(campaign);
    }
  }

  /**
   * KI-098 item 13 (companion roster, Phase 1): reaching a region's Chapter 1
   * finale (the FIRST time it's completed, per the no-op guards above) benches
   * that region's Pool B "mirror" companion, if it has one and isn't already
   * recruited or permanently lost. Never forces a swap into the active 3 —
   * `recruitCompanion` only fills an active slot if one is free, which never
   * happens here since seeding (`CompanionSeedSystem`, run in Campaign Select/
   * Character Creation before any battle can start) always fills all 3 active
   * slots first — see `CompanionRosterScene` for the player's own later
   * choice of whether to swap this companion in.
   */
  private maybeUnlockHomeRegionCompanion(campaign: CampaignDefinition): void {
    const companion = COMPANIONS.find((c) => c.homeRegionId === campaign.id);
    if (!companion) return;
    if (isCompanionRecruited(this.companionRoster, companion.id) || isCompanionLost(this.companionRoster, companion.id)) {
      return;
    }
    const next = recruitCompanion(this.companionRoster, companion.id);
    if (next === this.companionRoster) return;
    this.companionRoster = next;
    saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, next);
    this.logCombat(`${companion.name} has joined your roster (bench) — manage companions from Campaign Select.`);
    this.pendingCompanionRecruitment = companion;
  }

  /**
   * KI-098 item 13 (Pool A side-quest missions): clearing a companion's own
   * side mission (`data/campaigns.ts`'s `SIDE_MISSIONS`) recruits them onto
   * the bench, same no-force-active reasoning and no-op guards as
   * `maybeUnlockHomeRegionCompanion` above. A no-op for any non-side-mission
   * campaign (no companion's `sideMissionId` matches its id).
   */
  private maybeUnlockSideMissionCompanion(campaign: CampaignDefinition): void {
    const companion = COMPANIONS.find((c) => c.sideMissionId === campaign.id);
    if (!companion) return;
    if (isCompanionRecruited(this.companionRoster, companion.id) || isCompanionLost(this.companionRoster, companion.id)) {
      return;
    }
    const next = recruitCompanion(this.companionRoster, companion.id);
    if (next === this.companionRoster) return;
    this.companionRoster = next;
    saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, next);
    this.logCombat(`${companion.name} has joined your roster (bench) — manage companions from Campaign Select.`);
  }

  private showHeroHit(enemy: Enemy): void {
    // D-146: every hero-vs-enemy landed-hit call site in this scene already
    // funnels through here for the flash flourish, which makes this the one
    // place to also mark the enemy provoked for `WaveSystem`'s self-defense
    // check — no need to touch each individual attack/spell/ability call site.
    enemy.markProvoked();
    const c = this.grid.tileToWorldCenter(enemy.position);
    this.flashTile(c.x, c.y, COLORS.hitFlash, 0.7, 260);
  }

  /**
   * A trap (or terrain hazard) strikes an enemy that entered its tile: flash
   * the tile and log it. Phase 24 (D-115): `trapName` is the ACTUAL
   * structure's name (previously hardcoded to "Spike Trap" regardless of
   * which trap — or terrain hazard — actually fired, a real pre-existing
   * bug this pass's new trap variety made worth fixing), resolved by the
   * caller via `trapTriggerInfo` before the structure could be removed.
   */
  private showTrapTrigger(trip: TrapTrigger, trapName: string): void {
    const c = this.grid.tileToWorldCenter(trip.position);
    this.flashTile(c.x, c.y, COLORS.trapFlash, 0.7, 300);
    const verb = trip.result.defeated ? "defeats" : "hits";
    this.logCombat(
      `${trapName} ${verb} ${trip.enemy.def.name} for ${trip.result.damageDealt}`,
    );
  }

  /** A status effect resolving on an enemy during the enemy phase (Phase 7). */
  private showStatusTick(evt: StatusTickEvent): void {
    if (evt.effectId === "burning" && evt.result) {
      evt.enemy.lastDeathCause = "fire";
      const c = this.grid.tileToWorldCenter(evt.enemy.position);
      this.flashTile(c.x, c.y, COLORS.trapFlash, 0.6, 260);
      const verb = evt.result.defeated ? "defeats" : "hits";
      this.logCombat(`Burning ${verb} ${evt.enemy.def.name} for ${evt.result.damageDealt}`);
    } else if (evt.effectId === "stunned") {
      this.logCombat(`${evt.enemy.def.name} is stunned and holds`);
    }
  }

  /** Phase 20 (D-111): a siege enemy strikes a destructible wall instead of a hero. */
  private showStructureAttack(evt: StructureAttackEvent): void {
    const token = this.structureTokens.get(evt.structureInstanceId);
    if (token) this.flashTile(token.rect.x, token.rect.y, COLORS.hitFlash, 0.6, 300);
    const structureName = getStructureDefinition(evt.structureDefId).name;
    const verb = evt.destroyed ? "smashes apart" : "pounds";
    // Phase 25 (D-116): an opportunistic (non-siege) wall bash reads as a
    // stuck enemy taking a swing, not a dedicated siege enemy's specialty.
    const lead = evt.opportunistic
      ? `${evt.enemy.def.name}, unable to reach a hero,`
      : evt.enemy.def.name;
    this.logCombat(`${lead} ${verb} the ${structureName} for ${evt.damage}`);
    if (evt.destroyed) this.destroyStructureToken(evt.structureInstanceId);
  }

  /** Phase 25 (D-116): a trapSense enemy (Saboteur/Warren Stalker) disarms/destroys a placed trap instead of attacking a hero or advancing. */
  private showTrapDisarm(evt: TrapDisarmEvent): void {
    const token = this.structureTokens.get(evt.structureInstanceId);
    if (token) this.flashTile(token.rect.x, token.rect.y, COLORS.hitFlash, 0.6, 300);
    const structureName = getStructureDefinition(evt.structureDefId).name;
    this.logCombat(`${evt.enemy.def.name} disarms the ${structureName}`);
    this.destroyStructureToken(evt.structureInstanceId);
  }

  // ----- Building / shop (Phase 5) ---------------------------------------

  private toggleBuildMode(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (this.ui.kind === "building") this.exitBuildMode();
    else this.setInteraction({ kind: "building", defId: SHOP_ORDER[0] });
  }

  private exitBuildMode(): void {
    this.setInteraction({ kind: "idle" });
  }

  private selectShopItem(defId: string): void {
    if (this.ui.kind !== "building") return;
    this.setInteraction({ kind: "building", defId });
  }

  /** Test Mode (D-138): pick which enemy the next tile click spawns. */
  private selectDebugEnemy(enemyId: string): void {
    if (this.ui.kind !== "debugSpawnEnemy") return;
    this.setInteraction({ kind: "debugSpawnEnemy", enemyId });
  }

  /** Test Mode (D-138): pick which terrain type the next tile click paints. */
  private selectDebugTerrain(tileType: TileType): void {
    if (this.ui.kind !== "debugPaintTerrain") return;
    this.setInteraction({ kind: "debugPaintTerrain", tileType });
  }

  /** Test Mode (D-138): pick which status the next tile click toggles on its occupant. */
  private selectDebugStatus(statusId: StatusEffectId): void {
    if (this.ui.kind !== "debugStatus") return;
    this.setInteraction({ kind: "debugStatus", statusId });
  }

  /**
   * Show/hide the shop buttons and highlight the selected, affordable items.
   * Phase 25 (D-116): only the current PAGE (`ITEM_GRID_PAGE_SIZE` slots) is
   * shown, the same pagination `showEquipUI` already used — see
   * `refreshPageNav` for the shared nav control both grids drive.
   */
  private showShopUI(show: boolean, selectedDefId?: string): void {
    const page = Math.floor(this.gridFocusIndex / ITEM_GRID_PAGE_SIZE);
    this.shopButtons.forEach((btn, i) => {
      const onThisPage = Math.floor(i / ITEM_GRID_PAGE_SIZE) === page;
      const visible = show && onThisPage;
      btn.setVisible(visible);
      this.shopLabels[i].setVisible(visible);
      if (visible) {
        const defId = SHOP_ORDER[i];
        const selected = defId === selectedDefId;
        const affordable = this.economy.canAfford(getStructureDefinition(defId).cost);
        btn.setFillStyle(selected ? 0x5a7ab0 : 0x3a4a6a);
        this.shopLabels[i].setColor(affordable ? "#e8e8f0" : "#8a8a8a");
        this.applyGridFocusRing(btn, "building", i);
      }
    });
  }

  /**
   * Show/hide the equip-item buttons and highlight the selected, affordable
   * ones. Phase 11.7 (D-071): "shop anywhere" is replaced by proximity — the
   * grid itself is only shown when a living hero is near a shop tile;
   * otherwise `equipLockLabel` explains why, rather than the HUD silently
   * doing nothing. Recomputed every time the mode is (re)entered, which is
   * the existing cadence this method is already called on (mode toggle,
   * grid-focus refresh) — no new per-frame poll needed.
   */
  private showEquipUI(show: boolean, selectedItemId?: string | null): void {
    const gridVisible = show && this.isAnyHeroNearShop();
    this.equipLockLabel.setVisible(show && !gridVisible);
    // Phase 17 (D-108): only one PAGE of the catalogue is visible at once —
    // its page is derived from `gridFocusIndex` (the same index keyboard nav
    // and mouse selection already track), so opening the grid on a specific
    // item (or arrowing past a page boundary) lands on the right page for
    // free, with no separate page field to keep in sync.
    const page = Math.floor(this.gridFocusIndex / ITEM_GRID_PAGE_SIZE);
    this.equipItemButtons.forEach((btn, i) => {
      const onThisPage = Math.floor(i / ITEM_GRID_PAGE_SIZE) === page;
      const visible = gridVisible && onThisPage;
      btn.setVisible(visible);
      this.equipItemLabels[i].setVisible(visible);
      if (visible) {
        const itemId = this.visibleGearCatalog()[i];
        const selected = itemId === selectedItemId;
        const affordable = this.economy.canAfford(gearCatalogEntry(itemId).cost);
        btn.setFillStyle(selected ? 0x5a7ab0 : 0x3a4a6a);
        this.equipItemLabels[i].setColor(affordable ? "#e8e8f0" : "#8a8a8a");
        this.applyGridFocusRing(btn, "equipping", i);
      }
    });
  }

  /**
   * Test Mode (D-138): show/hide whichever debug-picker grid (Spawn Enemy,
   * Paint Terrain, Set Status) matches `this.ui.kind`, one page at a time —
   * same pagination shape as `showShopUI`/`showEquipUI`. Hides all three
   * grids outright when `this.ui.kind` isn't one of them (called
   * unconditionally from `setInteraction`, same as those two).
   */
  private showDebugPickerUI(): void {
    const ui = this.ui;
    const page = Math.floor(this.gridFocusIndex / ITEM_GRID_PAGE_SIZE);
    const render = (
      show: boolean,
      buttons: Phaser.GameObjects.Rectangle[],
      labels: Phaser.GameObjects.Text[],
      items: readonly string[],
      selectedId: string | undefined,
    ): void => {
      buttons.forEach((btn, i) => {
        const onThisPage = Math.floor(i / ITEM_GRID_PAGE_SIZE) === page;
        const visible = show && onThisPage;
        btn.setVisible(visible);
        labels[i].setVisible(visible);
        if (visible) {
          const selected = items[i] === selectedId;
          btn.setFillStyle(selected ? 0x5a7ab0 : 0x3a4a6a);
          btn.setStrokeStyle(this.keyboardFocus === "grid" && i === this.gridFocusIndex ? 3 : 0, 0xffffff);
        }
      });
    };
    render(
      ui.kind === "debugSpawnEnemy",
      this.debugEnemyButtons,
      this.debugEnemyLabels,
      DEBUG_ENEMY_IDS,
      ui.kind === "debugSpawnEnemy" ? ui.enemyId : undefined,
    );
    render(
      ui.kind === "debugPaintTerrain",
      this.debugTerrainButtons,
      this.debugTerrainLabels,
      DEBUG_TERRAIN_TYPES,
      ui.kind === "debugPaintTerrain" ? ui.tileType : undefined,
    );
    render(
      ui.kind === "debugStatus",
      this.debugStatusButtons,
      this.debugStatusLabels,
      STATUS_EFFECT_ORDER,
      ui.kind === "debugStatus" ? ui.statusId : undefined,
    );
  }

  /**
   * Phase 17 (D-108)/Phase 25 (D-116): the page-nav control shared by
   * whichever item grid is active (Shop, Gear, or a Test Mode debug picker —
   * never more than one at once), refreshed after any change to
   * `gridFocusIndex` or mode. Hidden entirely when no grid is showing, or
   * when the active grid's whole catalogue fits on one page.
   */
  private refreshPageNav(): void {
    const kind = this.ui.kind;
    const gridVisible =
      kind === "building" || (kind === "equipping" && this.isAnyHeroNearShop()) || this.isDebugGridKind(kind);
    const items = this.currentGridItems();
    const pageCount = Math.max(1, Math.ceil(items.length / ITEM_GRID_PAGE_SIZE));
    const page = Math.floor(this.gridFocusIndex / ITEM_GRID_PAGE_SIZE);
    const showNav = gridVisible && pageCount > 1;
    this.pageNavPrevButton.setVisible(showNav).setColor(page > 0 ? "#8ad0f0" : "#555560");
    this.pageNavNextButton.setVisible(showNav).setColor(page < pageCount - 1 ? "#8ad0f0" : "#555560");
    this.pageNavLabel.setVisible(showNav).setText(`Page ${page + 1}/${pageCount}`);
  }

  /** Phase 17 (D-108)/Phase 25 (D-116): jump the active grid's (Shop, Gear, or a Test Mode debug picker) page by moving `gridFocusIndex` to the start of the adjacent page. */
  private turnGridPage(direction: 1 | -1): void {
    if (this.ui.kind !== "building" && this.ui.kind !== "equipping" && !this.isDebugGridKind(this.ui.kind)) return;
    const items = this.currentGridItems();
    const pageCount = Math.max(1, Math.ceil(items.length / ITEM_GRID_PAGE_SIZE));
    const page = Math.floor(this.gridFocusIndex / ITEM_GRID_PAGE_SIZE);
    const nextPage = Math.max(0, Math.min(pageCount - 1, page + direction));
    if (nextPage === page) return;
    this.gridFocusIndex = nextPage * ITEM_GRID_PAGE_SIZE;
    this.setHoveredItem(items[this.gridFocusIndex] ?? null);
    this.refreshGridFocusVisual();
  }

  /**
   * KI-030: a white outline on whichever grid button currently has keyboard
   * focus (via Tab + arrow keys), independent of the blue "selected" fill
   * both grids already used — a keyboard user needs to see where the cursor
   * is BEFORE committing to an item, the same way a mouse user sees it via
   * pointer position alone.
   */
  private applyGridFocusRing(
    btn: Phaser.GameObjects.Rectangle,
    kind: "building" | "equipping",
    index: number,
  ): void {
    const focused = this.keyboardFocus === "grid" && this.ui.kind === kind && index === this.gridFocusIndex;
    btn.setStrokeStyle(focused ? 3 : 0, 0xffffff);
  }

  /** Update the ghost placement preview at the hovered tile while building. */
  private updateBuildGhost(tile: GridPosition | null): void {
    if (this.ui.kind !== "building" || !tile) {
      this.buildGhost.setVisible(false);
      this.buildGhostGlyph.setVisible(false);
      return;
    }
    const def = getStructureDefinition(this.ui.defId);
    const check = this.buildSystem.canPlace(
      this.ui.defId,
      tile,
      (p) => this.isUnitAt(p),
      this.livingHeroes().map((h) => h.position),
      this.nearestLivingHeroId(tile),
    );
    const ok = check.ok && this.economy.canAfford(def.cost);
    const c = this.grid.tileToWorldCenter(tile);
    const color = ok ? COLORS.buildValid : COLORS.buildInvalid;
    this.buildGhost
      .setPosition(c.x, c.y)
      .setFillStyle(color, 0.3)
      .setStrokeStyle(3, color)
      .setVisible(true);
    // Phase 8: a check/cross glyph so "can I build here" reads without
    // depending on distinguishing green from red.
    this.buildGhostGlyph
      .setPosition(c.x, c.y)
      .setText(ok ? "✓" : "✗")
      .setVisible(true);
  }

  /** In build mode, a click removes a structure on the tile, else buys one. */
  private handleBuildClick(tile: GridPosition): void {
    if (this.ui.kind !== "building") return;
    const existing = this.buildSystem.structureAt(tile);
    if (existing) {
      this.refundStructure(existing);
      return;
    }
    this.tryBuild(this.ui.defId, tile);
  }

  private tryBuild(defId: string, tile: GridPosition): void {
    const def = getStructureDefinition(defId);
    if (!this.economy.canAfford(def.cost)) {
      this.rejectAt(tile, `Not enough gold for ${def.name} (need ${def.cost}g)`);
      return;
    }
    const heroPositions = this.livingHeroes().map((h) => h.position);
    const builtBy = this.nearestLivingHeroId(tile);
    const check = this.buildSystem.canPlace(defId, tile, (p) => this.isUnitAt(p), heroPositions, builtBy);
    if (!check.ok) {
      this.rejectAt(tile, check.reason ?? "You cannot build there.");
      return;
    }
    // Spend once, then place. canPlace already guarantees place() succeeds, so
    // gold changes exactly once per successful purchase.
    this.economy.spend(def.cost);
    const result = this.buildSystem.place(defId, tile, (p) => this.isUnitAt(p), heroPositions, builtBy);
    if (result.structure) this.renderStructure(result.structure);
    this.logCombat(`Built ${def.name} for ${def.cost}g`);
    this.updateGoldHud();
    // Stay in build mode to place several in a row.
    this.setInteraction({ kind: "building", defId });
  }

  private refundStructure(structure: PlacedStructure): void {
    const def = getStructureDefinition(structure.defId);
    const removed = this.buildSystem.remove(structure.instanceId);
    if (!removed) return;
    this.economy.refund(def.cost);
    this.destroyStructureToken(structure.instanceId);
    this.logCombat(`Removed ${def.name} (+${def.cost}g refunded)`);
    this.updateGoldHud();
    this.setInteraction({ kind: "building", defId: this.currentBuildDefId() });
  }

  private currentBuildDefId(): string {
    return this.ui.kind === "building" ? this.ui.defId : SHOP_ORDER[0];
  }

  private renderStructure(structure: PlacedStructure): void {
    const c = this.grid.tileToWorldCenter(structure.position);
    const isWall = structure.kind === "wall";
    const isPlatform = structure.kind === "platform";
    const fill = STRUCTURE_COLORS[structure.defId] ?? (isWall ? COLORS.wall : COLORS.trap);
    const edge = isWall ? COLORS.wallEdge : COLORS.trapEdge;
    const alpha = isWall ? 0.95 : isPlatform ? 0.6 : 0.5;
    const def = getStructureDefinition(structure.defId);
    const rect = this.add
      .rectangle(c.x, c.y, this.grid.tileSize - 6, this.grid.tileSize - 6, fill, alpha)
      .setStrokeStyle(3, edge)
      .setDepth(isWall ? 6 : 3);
    const glyph = this.add
      .text(c.x, c.y, def.name[0], {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: isWall ? "#0e0e14" : "#2a0e18",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(isWall ? 6 : 3);
    this.structureTokens.set(structure.instanceId, { rect, glyph });
  }

  private destroyStructureToken(instanceId: string): void {
    const token = this.structureTokens.get(instanceId);
    if (!token) return;
    token.rect.destroy();
    token.glyph.destroy();
    this.structureTokens.delete(instanceId);
  }

  /**
   * Phase 8 tooltip, D-158: preview the hovered (or keyboard-focused)
   * shop/gear item's name/cost/description via the shared board tooltip
   * (`this.tooltip`, D-132) rather than the old packed status line. Called
   * from mouse `pointerover` (`buildItemGrid`'s `onHover`), keyboard
   * grid-focus navigation (`moveGridFocus`/`toggleKeyboardFocus`), and mode
   * changes (`setInteraction`, to hide a stale tooltip) — all of which
   * already funnelled through this one method before this redesign, so the
   * tooltip stays exactly as keyboard-accessible as the text it replaced
   * (KI-034's own checklist). Every button in `shopButtons`/
   * `equipItemButtons` sits at a fixed, known `(x, y)` per grid slot
   * (`buildItemGrid`), found here by matching `id`'s position in the same
   * ordered list `currentGridItems()` already uses.
   */
  private setHoveredItem(id: string | null): void {
    if (id === null) {
      this.tooltip.hide();
    } else if (this.ui.kind === "building") {
      const btn = this.shopButtons[SHOP_ORDER.indexOf(id)];
      const def = getStructureDefinition(id);
      if (btn) this.tooltip.showAt(btn.x, btn.y - 22, `${def.name} (${def.cost}g): ${def.description}`);
    } else if (this.ui.kind === "equipping") {
      const btn = this.equipItemButtons[this.visibleGearCatalog().indexOf(id)];
      const entry = gearCatalogEntry(id);
      if (btn) this.tooltip.showAt(btn.x, btn.y - 22, `${entry.name} (${entry.cost}g): ${entry.description}`);
    }
    this.refreshStatus();
  }

  private updateGoldHud(): void {
    this.goldText.setText(`Gold: ${this.economy.gold}g`);
  }

  /** True if a living hero or an enemy stands on a tile (build occupancy). */
  private isUnitAt(pos: GridPosition): boolean {
    return this.heroAt(pos) !== undefined || this.enemyAt(pos) !== undefined;
  }

  // ----- Equipment (Phase 7, "limited equipment") -------------------------

  private toggleEquipMode(): void {
    if (this.turns.current !== "player" || this.inputLocked()) return;
    if (this.ui.kind === "equipping") this.exitEquipMode();
    else this.setInteraction({ kind: "equipping", itemId: null });
  }

  private exitEquipMode(): void {
    this.setInteraction({ kind: "idle" });
  }

  private selectEquipItem(itemId: string): void {
    if (this.ui.kind !== "equipping") return;
    // Clicking the already-selected item deselects it (so a click on a hero
    // afterward unequips instead of swapping).
    const next = this.ui.itemId === itemId ? null : itemId;
    this.setInteraction({ kind: "equipping", itemId: next });
  }

  /**
   * In equip mode, a click on a hero equips the selected item into whichever
   * slot fits it, or unequips it if that hero already carries it somewhere
   * (Phase 11.5, D-078). Equipment and potions live in separate id
   * namespaces, so checking both slot maps unambiguously finds "does this
   * hero already have this exact item" without needing to track kind.
   */
  private handleEquipClick(tile: GridPosition): void {
    if (this.ui.kind !== "equipping") return;
    // Phase 11.7 (D-071): the same proximity gate the Gear grid's visibility
    // uses, enforced again here so a stale keyboard-focused selection can't
    // bypass the hidden grid.
    if (!this.isAnyHeroNearShop()) {
      this.rejectAt(tile, "Move a hero to a Shop tile to access Gear");
      return;
    }
    const hero = this.heroAt(tile);
    if (!hero) return;
    this.resolveEquipOnHero(hero);
  }

  /**
   * D-165 (KI-098 item 3): the equip-resolution core both `handleEquipClick`
   * (a board-tile click) and the roster-strip click (`onRosterBoxClick`)
   * funnel through — given a hero and the item currently selected in equip
   * mode, equips it into whichever slot fits, or unequips it if this hero
   * already carries it. Callers are responsible for their own proximity/
   * liveness gates first (each needs its own rejection message/target tile).
   */
  private resolveEquipOnHero(hero: Hero): void {
    if (this.ui.kind !== "equipping") return;
    const itemId = this.ui.itemId;
    if (!itemId) return;

    if (itemId in POTION_DEFINITIONS) {
      const slot = this.findGeneralSlotHolding(hero, itemId);
      if (slot) this.unequipPotionFromHero(hero, slot);
      else this.equipPotionOnHero(hero, itemId);
      return;
    }
    const slot = this.findGearSlotHolding(hero, itemId);
    if (slot) this.unequipGearFromHero(hero, slot);
    else this.equipGearOnHero(hero, itemId);
  }

  private findGearSlotHolding(hero: Hero, itemId: string): GearSlotId | null {
    return GEAR_SLOT_IDS.find((slot) => hero.equippedItems[slot] === itemId) ?? null;
  }

  private findGeneralSlotHolding(hero: Hero, itemId: string): GeneralSlotId | null {
    return GENERAL_SLOT_IDS.find((slot) => hero.equippedPotions[slot] === itemId) ?? null;
  }

  /**
   * True for a Light melee weapon — the one item type that may target
   * EITHER hand slot (Phase 19, D-110's dual-wielding system). Every other
   * weapon only ever targets `"weapon"`, same as before this phase.
   */
  private static isOffHandEligibleWeapon(def: EquipmentDefinition): boolean {
    return def.slot === "weapon" && def.weapon?.kind === "melee" && def.weapon.properties.includes("light");
  }

  /**
   * Both ring slots share one type; other slot types map 1:1 to their
   * instance id. Phase 19 (D-110): a Light melee weapon targets the empty
   * `"weapon"` slot first, then falls back to `"shield"` (the off-hand) —
   * same "first empty slot" rule ring1/ring2 already use. `equipGearOnHero`
   * rejects the one case this fallback can't safely resolve (main hand
   * already filled AND the off-hand already holds a real Shield) before
   * this is ever called, so `"shield"` is always safe to return here.
   */
  private targetGearSlot(hero: Hero, itemId: string): GearSlotId {
    const def = getEquipmentDefinition(itemId);
    if (def.slot === "ring") {
      if (!hero.equippedItems.ring1) return "ring1";
      if (!hero.equippedItems.ring2) return "ring2";
      return "ring1"; // both full — replace the first ring
    }
    if (BattleScene.isOffHandEligibleWeapon(def)) {
      return hero.equippedItems.weapon ? "shield" : "weapon";
    }
    return def.slot;
  }

  /**
   * D-148 (KI-098, a small slice of "equip UX needs a rethink"): a before/
   * after AC/attack-bonus preview for hovering a hero while an item is
   * selected in equip mode — the flow itself (click item, then click a hero
   * token) is untouched; this only answers "what would change" before
   * committing gold. Simulates on a throwaway `Hero.fromSnapshot` clone
   * (bypassing cost/attunement/grip validation, which only matters for the
   * REAL equip in `equipGearOnHero`) so hovering never touches the live
   * hero or the player's gold.
   */
  private previewEquipDelta(hero: Hero, itemId: string): string {
    const slot = this.targetGearSlot(hero, itemId);
    const clone = Hero.fromSnapshot(hero.toSnapshot());
    clone.equippedItems[slot] = itemId;
    clone.onGearChanged();
    const parts: string[] = [];
    if (clone.armorClass !== hero.armorClass) parts.push(`AC ${hero.armorClass}→${clone.armorClass}`);
    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    if (clone.effectiveAttackBonus !== hero.effectiveAttackBonus) {
      parts.push(`attack ${fmt(hero.effectiveAttackBonus)}→${fmt(clone.effectiveAttackBonus)}`);
    }
    return parts.length > 0 ? parts.join(", ") : "No AC/attack change";
  }

  /**
   * Phase 22 (magic-item expansion): the Gear grid's actual visible catalog
   * — every mundane item (`common`/`uncommon`, unchanged from before this
   * phase — no regression for a fresh level-1 party) plus whichever
   * `rare`/`veryRare`/`legendary` magic items this party's AVERAGE class
   * level has unlocked (`ShopSystem.isRarityUnlockedAtLevel`). Kevin's own
   * ask: "the shop should also have some magical items, but based on the
   * level of the party." A fresh level-1 party averages to level 1, so it
   * only ever sees the always-unlocked common/uncommon tier until it levels.
   */
  private visibleGearCatalog(): string[] {
    const avgLevel = averagePartyLevel(this.heroes.map((h) => h.level));
    return ALL_GEAR_CATALOG_IDS.filter((id) => {
      const rarity = id in POTION_DEFINITIONS ? getPotionDefinition(id).rarity : getEquipmentDefinition(id).rarity;
      return isRarityUnlockedAtLevel(rarity, avgLevel);
    });
  }

  private equipGearOnHero(hero: Hero, itemId: string): void {
    const def = getEquipmentDefinition(itemId);
    if (!this.economy.canAfford(def.cost)) {
      this.rejectAt(hero.position, `Not enough gold for ${def.name} (need ${def.cost}g)`);
      return;
    }
    // Phase 19 (D-110): a Light melee weapon can dual-wield into the
    // off-hand ("shield") slot, but not while a real Shield already sits
    // there — reject explicitly (same "reject before any gold changes
    // hands" shape as the attunement/grip gates below) rather than letting
    // `targetGearSlot`'s fallback silently displace the main-hand weapon
    // instead.
    if (BattleScene.isOffHandEligibleWeapon(def) && hero.equippedItems.weapon) {
      const shieldItemId = hero.equippedItems.shield;
      const shieldItemDef = shieldItemId ? getEquipmentDefinition(shieldItemId) : null;
      if (shieldItemId && !shieldItemDef?.weapon) {
        this.rejectAt(hero.position, `${hero.name}'s Shield is in the way — unequip it first to dual-wield`);
        return;
      }
    }
    const slot = this.targetGearSlot(hero, itemId);
    // Phase 13.9 (D-094): a rare-and-up item requires attunement — gated
    // here, before any gold changes hands, rather than letting a hero wear
    // a dead-weight unattuned item (see Hero.wouldExceedAttunementLimit).
    if (hero.wouldExceedAttunementLimit(itemId, slot)) {
      this.rejectAt(hero.position, `${hero.name} is already attuned to ${MAX_ATTUNEMENTS} items — unequip one first`);
      return;
    }
    // Phase 17 (D-108): a Two-Handed weapon needs both hands — refuse
    // equipping it alongside a Shield (or, since Phase 19/D-110, an
    // off-hand weapon — `wouldConflictWithGrip`'s "shield" branch just
    // checks the slot isn't empty, so it already covers both), and vice
    // versa (see Hero.wouldConflictWithGrip). Same "reject before any gold
    // changes hands" shape as the attunement gate above.
    if (hero.wouldConflictWithGrip(itemId, slot)) {
      this.rejectAt(hero.position, `${hero.name} can't wear a Shield with a Two-Handed weapon equipped`);
      return;
    }
    // Swap: refund whatever this hero already had in the target slot, then
    // spend once for the new item — gold changes at most twice, and only on
    // success.
    const prevId = hero.equippedItems[slot];
    if (prevId) this.economy.refund(getEquipmentDefinition(prevId).cost);
    this.economy.spend(def.cost);
    hero.equippedItems[slot] = itemId;
    this.logCombat(`${hero.name} equips ${def.name} into ${GEAR_SLOT_LABELS[slot]} (${def.cost}g)`);
    this.ensureHeroCape(hero);
    hero.onGearChanged();
    this.updateGoldHud();
    this.setInteraction({ kind: "equipping", itemId });
  }

  private unequipGearFromHero(hero: Hero, slot: GearSlotId): void {
    const itemId = hero.equippedItems[slot];
    if (!itemId) return;
    const def = getEquipmentDefinition(itemId);
    delete hero.equippedItems[slot];
    this.economy.refund(def.cost);
    this.logCombat(`${hero.name} unequips ${def.name} from ${GEAR_SLOT_LABELS[slot]} (+${def.cost}g refunded)`);
    this.ensureHeroCape(hero);
    hero.onGearChanged();
    this.updateGoldHud();
    this.setInteraction({ kind: "equipping", itemId: this.currentEquipItemId() });
  }

  private equipPotionOnHero(hero: Hero, itemId: string): void {
    const def = getPotionDefinition(itemId);
    if (!this.economy.canAfford(def.cost)) {
      this.rejectAt(hero.position, `Not enough gold for ${def.name} (need ${def.cost}g)`);
      return;
    }
    const slot: GeneralSlotId = hero.equippedPotions.general1 === undefined ? "general1"
      : hero.equippedPotions.general2 === undefined ? "general2"
      : "general1"; // both full — replace the first potion
    const prevId = hero.equippedPotions[slot];
    if (prevId) this.economy.refund(getPotionDefinition(prevId).cost);
    this.economy.spend(def.cost);
    hero.equippedPotions[slot] = itemId;
    this.logCombat(`${hero.name} stocks ${def.name} in ${GENERAL_SLOT_LABELS[slot]} (${def.cost}g)`);
    this.updateGoldHud();
    this.setInteraction({ kind: "equipping", itemId });
  }

  private unequipPotionFromHero(hero: Hero, slot: GeneralSlotId): void {
    const itemId = hero.equippedPotions[slot];
    if (!itemId) return;
    const def = getPotionDefinition(itemId);
    delete hero.equippedPotions[slot];
    this.economy.refund(def.cost);
    this.logCombat(`${hero.name} removes ${def.name} from ${GENERAL_SLOT_LABELS[slot]} (+${def.cost}g refunded)`);
    this.updateGoldHud();
    this.setInteraction({ kind: "equipping", itemId: this.currentEquipItemId() });
  }

  private currentEquipItemId(): string | null {
    return this.ui.kind === "equipping" ? this.ui.itemId : null;
  }

  // ----- Helpers ---------------------------------------------------------

  private isLegalMove(hero: Hero, tile: GridPosition): boolean {
    if (!hero.canMove()) return false;
    return this.movement.isLegalDestination(tile, {
      start: hero.position,
      budget: hero.movementBudget(),
      isOccupied: (p) => this.isHeroMovementBlocked(p),
      blocksStopping: (p) => this.isHeroStoppingBlocked(p, hero.id),
    });
  }

  /**
   * Hard block for hero movement: a hero may never enter OR pass through
   * these tiles at all. A placed wall is impassable to heroes too — UNLESS
   * it's a Gate, which blocks enemies but lets the party walk straight
   * through (Phase 7). Enemies also fully block (attack them instead).
   * D-069: the spawn ("In") tile is off-limits to heroes entirely — a hero
   * standing there (or spawning enemies landing on top of one) was the root
   * cause of enemies piling up at the spawn point instead of marching in.
   */
  private isHeroMovementBlocked(pos: GridPosition): boolean {
    if (this.map.roleAt(pos) === "spawn") return true;
    if (this.buildSystem.blocksHeroAt(pos)) return true;
    return this.waveSystem.enemies.some(
      (enemy) => enemy.position.x === pos.x && enemy.position.y === pos.y,
    );
  }

  /**
   * D-067: another living hero's tile is a SOFT block — a hero may walk
   * THROUGH it but may never end a move there, so the party can pass each
   * other in a narrow lane without ever sharing a tile.
   */
  private isHeroStoppingBlocked(pos: GridPosition, movingHeroId: string): boolean {
    return this.heroes.some(
      (hero) =>
        hero.id !== movingHeroId &&
        hero.isAlive() &&
        hero.position.x === pos.x &&
        hero.position.y === pos.y,
    );
  }

  private livingHeroes(): Hero[] {
    return this.heroes.filter((h) => h.isAlive());
  }

  /**
   * Phase 11.7 (D-071): true if any living hero stands ON a "shop" tile or
   * on a tile adjacent to one (Manhattan distance <= 1) — the gate for the
   * Gear HUD, replacing "shop anywhere".
   *
   * Backward-compatible default: a map that defines NO shop tiles at all
   * (TEST_MAP, today's only wired-in map) can never satisfy this gate, so
   * treat "no shop tiles exist" as "nothing to gate" rather than
   * permanently locking Gear with no way to unlock it. The lock only bites
   * once a map actually opts in by placing at least one shop tile.
   */
  private isAnyHeroNearShop(): boolean {
    const shops = this.map.data.shops;
    if (shops.length === 0) return true;
    return this.livingHeroes().some((hero) =>
      shops.some((shop) => GridSystem.manhattanDistance(hero.position, shop) <= 1),
    );
  }

  /**
   * Phase 11.7 (D-071): the living hero CLOSEST (Manhattan) to `pos`, or
   * undefined if no hero is alive. Ties go to whichever hero appears first
   * in `this.heroes`. Used to auto-attribute a newly placed structure to a
   * hero for the per-hero carry limit — no new hero-selection UI needed,
   * since a hero must already be nearby to build there at all.
   */
  private nearestLivingHeroId(pos: GridPosition): string | undefined {
    const living = this.livingHeroes();
    if (living.length === 0) return undefined;
    let best = living[0];
    let bestDist = GridSystem.manhattanDistance(best.position, pos);
    for (const hero of living.slice(1)) {
      const dist = GridSystem.manhattanDistance(hero.position, pos);
      if (dist < bestDist) {
        best = hero;
        bestDist = dist;
      }
    }
    return best.id;
  }

  private isLivingHeroAt(pos: GridPosition): boolean {
    return this.heroes.some(
      (h) => h.isAlive() && h.position.x === pos.x && h.position.y === pos.y,
    );
  }

  private heroAt(pos: GridPosition): Hero | undefined {
    return this.heroes.find(
      (h) => h.isAlive() && h.position.x === pos.x && h.position.y === pos.y,
    );
  }

  /**
   * Phase 12.3 (D-103): the turn-lock check gating hero SELECTION (not
   * every downstream action — a hero already legally selected/AI-driven
   * still runs its normal `canMove`/`canAct` checks). Always true outside a
   * coop battle. Inside one, true only for a hero this client's uid owns —
   * `hero.controlledBy` was already set to `"human"`/`"remote"` by
   * `buildHeroes` from the same `heroOwners` map, so this is really just
   * `!== "remote"`, spelled out via `canActOnHero` for symmetry with
   * `CoopSessionSystem`'s own naming.
   */
  private canLocallyControl(hero: Hero): boolean {
    if (!this.coopSession) return true;
    return canActOnHero(this.coopSession.heroOwners, hero.id, this.coopSession.localUid);
  }

  private enemyAt(pos: GridPosition): Enemy | undefined {
    return this.waveSystem.enemies.find(
      (e) => e.position.x === pos.x && e.position.y === pos.y,
    );
  }

  private heroById(id: string): Hero | undefined {
    return this.heroes.find((h) => h.id === id);
  }

  private enemyById(id: string): Enemy | undefined {
    return this.waveSystem.enemies.find((e) => e.instanceId === id);
  }

  private nameOfCombatant(id: string): string {
    return this.heroById(id)?.name ?? this.enemyById(id)?.def.name ?? "unit";
  }

  private placeToken(token: Token, pos: GridPosition): void {
    const c = this.grid.tileToWorldCenter(pos);
    token.circle.setPosition(c.x, c.y);
    token.label.setPosition(c.x, c.y - 4);
    token.hp.setPosition(c.x, c.y + this.grid.tileSize * 0.2);
    token.sprite?.setPosition(c.x, c.y);
  }

  /**
   * If real art has been loaded for `assetKey` (see `SPRITE_MANIFEST`),
   * create a sprite sized to match the given circle's diameter and hide
   * that circle so it doesn't show through — the sprite becomes the token's
   * visible face while the circle stays alive underneath for its existing
   * role (depth ordering, and a same-shape fallback if the sprite is ever
   * removed). Returns undefined when no art exists for this key (always
   * true today — the manifest is empty).
   */
  private createTokenSprite(
    assetKey: string | undefined,
    circle: Phaser.GameObjects.Arc,
    depth: number,
  ): Phaser.GameObjects.Sprite | undefined {
    if (!assetKey || !this.textures.exists(assetKey)) return undefined;
    const diameter = circle.radius * 2;
    circle.setVisible(false);
    return this.add
      .sprite(circle.x, circle.y, assetKey)
      .setDisplaySize(diameter, diameter)
      .setDepth(depth);
  }

  private updateHpText(token: Token, health: number, maxHealth: number): void {
    token.hp.setText(`${health}/${maxHealth}`);
  }

  private flashTile(x: number, y: number, color: number, alpha: number, ms: number): void {
    const flash = this.add.rectangle(x, y, this.grid.tileSize, this.grid.tileSize, color, alpha).setDepth(12);
    const duration = this.scaledDuration(ms);
    if (duration <= 0) {
      // Reduced motion: show the flash without an animated fade, just briefly.
      this.time.delayedCall(80, () => flash.destroy());
      return;
    }
    this.tweens.add({ targets: flash, alpha: 0, duration, onComplete: () => flash.destroy() });
  }

  /**
   * Phase 26 (D-121): a basic-attack lunge — the attacker's own token nudges
   * a short distance toward its target and springs back (a `yoyo` tween),
   * layered on top of the existing hit-flash on the target tile. The first
   * tween-based ATTACK animation in this project (movement and the Cape of
   * Billowing already used Phaser Tweens, but for repositioning/ambient
   * effects, not a swing) — kept deliberately small and attacker-agnostic
   * (works for a hero or an enemy token) rather than building a generic
   * "animation system" speculatively; see PHASE_HANDOFF.md's own
   * recommendation to prototype one concrete animation first.
   */
  private lungeToward(token: Token, from: GridPosition, to: GridPosition): void {
    const duration = this.scaledDuration(140);
    if (duration <= 0) return; // reduced motion: skip the lunge, the hit-flash alone still reads
    const fromC = this.grid.tileToWorldCenter(from);
    const toC = this.grid.tileToWorldCenter(to);
    const dx = toC.x - fromC.x;
    const dy = toC.y - fromC.y;
    const dist = Math.hypot(dx, dy) || 1;
    const offsetX = (dx / dist) * this.grid.tileSize * 0.28;
    const offsetY = (dy / dist) * this.grid.tileSize * 0.28;
    const targets = [token.circle, token.label, token.hp, token.sprite].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    );
    this.tweens.add({
      targets,
      x: `+=${offsetX}`,
      y: `+=${offsetY}`,
      duration: duration / 2,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  // ----- Cast & death visual effects (D-122) ------------------------------

  /**
   * D-122: every spell/ability cast plays a flourish picked by
   * `VisualFxSystem.getCastVisual` — a shape (from the ability's own
   * mechanical fields) plus a color (from its real SRD school, refined by a
   * best-effort name/description keyword guess) plus a small hashed
   * variation, so two different spells sharing a shape+color family still
   * don't animate identically. `casterPos` is always the caster's own tile;
   * `focusPos` is whatever this cast is actually aimed at — an enemy, a
   * chosen tile, an ally, or (for a caster-centered effect like Cleave or a
   * party-wide buff) the caster's own tile again.
   */
  private playCastVisual(ability: AbilityDefinition, casterPos: GridPosition, focusPos: GridPosition): void {
    const visual = getCastVisual(ability);
    const duration = this.scaledDuration(Math.round(CAST_FX_BASE_MS * visual.durationScale));
    if (duration <= 0) return; // reduced motion: skip the flourish, the existing hit-flash/log still reads
    const from = this.grid.tileToWorldCenter(casterPos);
    const to = this.grid.tileToWorldCenter(focusPos);
    switch (visual.shape) {
      case "bolt":
        this.drawCastBolt(from, to, visual, duration);
        break;
      case "homingOrb":
        this.drawCastHomingOrb(from, to, visual, duration);
        break;
      case "fallingJudgment":
        this.drawCastFallingJudgment(to, visual, duration);
        break;
      case "novaBurst":
        this.spawnRing(
          to.x,
          to.y,
          this.grid.tileSize * 0.5,
          0.05,
          Math.max(1, ability.radiusTiles ?? 1) * 2 * visual.sizeScale,
          visual.color,
          duration,
        );
        this.spawnBurstMotes(
          to.x,
          to.y,
          visual.color,
          visual.particleCount,
          this.grid.tileSize * (ability.radiusTiles ?? 1) * visual.sizeScale,
          duration,
          visual.rotationDir,
        );
        break;
      case "ringPulse":
      case "radiantPulse":
        this.spawnRing(
          from.x,
          from.y,
          this.grid.tileSize * 0.5,
          0.05,
          Math.max(1, ability.rangeTiles) * 2 * visual.sizeScale,
          visual.color,
          duration,
          5,
        );
        break;
      case "gustCone":
        this.drawCastGustCone(from, to, visual, duration);
        break;
      case "sparkleRise":
        this.spawnDriftMotes(
          to.x,
          to.y + this.grid.tileSize * 0.3,
          visual.color,
          visual.particleCount,
          0,
          -this.grid.tileSize * 0.9 * visual.sizeScale,
          duration,
        );
        break;
      case "groundRune":
        this.drawCastGroundRune(to, visual, duration);
        break;
      case "conjureCircle":
        this.spawnRing(to.x, to.y, this.grid.tileSize * 0.45, 0.05, 1.3 * visual.sizeScale, visual.color, duration, 4);
        break;
      case "blink":
        this.drawCastBlink(from, to, visual, duration);
        break;
    }
  }

  /** A straight traveling mote, caster to target — the default for a plain attack-roll bolt spell. */
  private drawCastBolt(
    from: { x: number; y: number },
    to: { x: number; y: number },
    visual: CastVisualDescriptor,
    duration: number,
  ): void {
    const r = this.grid.tileSize * 0.14 * visual.sizeScale;
    const mote = this.add.circle(from.x, from.y, r, visual.color, 0.95).setDepth(13);
    this.tweens.add({
      targets: mote,
      x: to.x,
      y: to.y,
      duration,
      ease: "Cubic.easeIn",
      onComplete: () => {
        this.tweens.add({ targets: mote, alpha: 0, scale: 1.6, duration: 120, onComplete: () => mote.destroy() });
      },
    });
  }

  /** A mote that curves toward its target instead of traveling straight — an `autoHit` spell's signature. */
  private drawCastHomingOrb(
    from: { x: number; y: number },
    to: { x: number; y: number },
    visual: CastVisualDescriptor,
    duration: number,
  ): void {
    const r = this.grid.tileSize * 0.16 * visual.sizeScale;
    const orb = this.add.circle(from.x, from.y, r, visual.color, 0.95).setDepth(13).setStrokeStyle(2, 0xffffff, 0.5);
    const midX = (from.x + to.x) / 2 - (to.y - from.y) * 0.25 * visual.rotationDir;
    const midY = (from.y + to.y) / 2 + (to.x - from.x) * 0.25 * visual.rotationDir;
    this.tweens.chain({
      targets: orb,
      tweens: [
        { x: midX, y: midY, duration: duration * 0.5, ease: "Sine.easeOut" },
        { x: to.x, y: to.y, duration: duration * 0.5, ease: "Sine.easeIn" },
      ],
      onComplete: () => {
        this.tweens.add({ targets: orb, alpha: 0, scale: 1.8, duration: 120, onComplete: () => orb.destroy() });
      },
    });
  }

  /** A mote descending from above onto the target, then a flash — a saving-throw spell's signature. */
  private drawCastFallingJudgment(
    to: { x: number; y: number },
    visual: CastVisualDescriptor,
    duration: number,
  ): void {
    const r = this.grid.tileSize * 0.18 * visual.sizeScale;
    const mote = this.add.circle(to.x, to.y - this.grid.tileSize * 2.2, r, visual.color, 0.95).setDepth(13);
    this.tweens.add({
      targets: mote,
      y: to.y,
      duration,
      ease: "Cubic.easeIn",
      onComplete: () => {
        this.flashTile(to.x, to.y, visual.color, 0.6, 200);
        mote.destroy();
      },
    });
  }

  /** A directional shockwave wedge from caster to target — any `forcedMoveTiles` spell's signature. */
  private drawCastGustCone(
    from: { x: number; y: number },
    to: { x: number; y: number },
    visual: CastVisualDescriptor,
    duration: number,
  ): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const length = Math.hypot(to.x - from.x, to.y - from.y) || this.grid.tileSize;
    const gust = this.add
      .rectangle(from.x, from.y, length, this.grid.tileSize * 0.7 * visual.sizeScale, visual.color, 0.35)
      .setOrigin(0, 0.5)
      .setRotation(angle)
      .setDepth(13);
    this.tweens.add({
      targets: gust,
      alpha: 0,
      scaleY: 1.4,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => gust.destroy(),
    });
  }

  /** A diamond rune that snaps in then lingers briefly — any `altersTerrainId` spell's signature. */
  private drawCastGroundRune(to: { x: number; y: number }, visual: CastVisualDescriptor, duration: number): void {
    const size = this.grid.tileSize * 0.7 * visual.sizeScale;
    const rune = this.add
      .rectangle(to.x, to.y, size, size, visual.color, 0)
      .setStrokeStyle(3, visual.color, 0.9)
      .setRotation(Math.PI / 4)
      .setDepth(8)
      .setScale(0.2)
      .setAlpha(0);
    this.tweens.add({
      targets: rune,
      scale: 1,
      alpha: 0.85,
      duration: duration * 0.6,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: rune,
          alpha: 0,
          duration: duration * 0.6,
          delay: 200,
          onComplete: () => rune.destroy(),
        });
      },
    });
  }

  /** A fade-out puff at the origin, then a fade-in puff at the destination — a `teleportSelf` spell's signature. */
  private drawCastBlink(
    from: { x: number; y: number },
    to: { x: number; y: number },
    visual: CastVisualDescriptor,
    duration: number,
  ): void {
    const puff = (x: number, y: number, grow: boolean) => {
      const c = this.add
        .circle(x, y, this.grid.tileSize * 0.32 * visual.sizeScale, visual.color, 0.7)
        .setDepth(13)
        .setScale(grow ? 0.2 : 1);
      this.tweens.add({
        targets: c,
        scale: grow ? 1 : 0.1,
        alpha: 0,
        duration: duration * 0.6,
        ease: grow ? "Back.easeOut" : "Cubic.easeIn",
        onComplete: () => c.destroy(),
      });
    };
    puff(from.x, from.y, false);
    this.time.delayedCall(duration * 0.3, () => puff(to.x, to.y, true));
  }

  /**
   * A ring outline that grows or shrinks between two scales while fading —
   * shared by nova-burst/ring-pulse/conjure-circle casts and the
   * dissolve/radiant-burst/arcane-fade death flourishes below.
   */
  private spawnRing(
    x: number,
    y: number,
    baseRadius: number,
    fromScale: number,
    toScale: number,
    color: number,
    duration: number,
    strokeWidth = 4,
  ): void {
    const ring = this.add
      .circle(x, y, baseRadius, color, 0)
      .setDepth(13)
      .setStrokeStyle(strokeWidth, color, 0.85)
      .setScale(fromScale);
    this.tweens.add({
      targets: ring,
      scale: toScale,
      alpha: 0,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /** `count` motes flying straight outward from a point — shared by nova-burst and a couple of death flourishes. */
  private spawnBurstMotes(
    x: number,
    y: number,
    color: number,
    count: number,
    dist: number,
    duration: number,
    rotationDir: 1 | -1 = 1,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 * rotationDir;
      const mote = this.add.circle(x, y, this.grid.tileSize * 0.07, color, 0.9).setDepth(13);
      this.tweens.add({
        targets: mote,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration,
        ease: "Cubic.easeOut",
        onComplete: () => mote.destroy(),
      });
    }
  }

  /** `count` motes drifting a fixed distance in one direction — shared by sparkle-rise and a couple of death flourishes. */
  private spawnDriftMotes(
    x: number,
    y: number,
    color: number,
    count: number,
    dx: number,
    dy: number,
    duration: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * this.grid.tileSize * 0.18;
      const mote = this.add.circle(x + offset, y, this.grid.tileSize * 0.07, color, 0.9).setDepth(13);
      this.tweens.add({
        targets: mote,
        x: x + offset + dx,
        y: y + dy,
        alpha: 0,
        duration,
        delay: i * 40,
        ease: "Sine.easeOut",
        onComplete: () => mote.destroy(),
      });
    }
  }

  /**
   * D-122: replaces the old instant token removal on a real kill (NOT a
   * breach — an enemy reaching the exit still uses its own existing breach
   * flash/removal, untouched) with a brief squash-and-fade plus a
   * cause-specific flourish first. `enemy.lastDeathCause` is a same-tick
   * hint set by whichever cast/status code just dealt the killing blow (see
   * `VisualFxSystem`); it defaults to "physical" for every ordinary weapon/
   * trap/explosion kill that never sets it.
   */
  private playEnemyDeathVisual(enemy: Enemy): void {
    const token = this.enemyTokens.get(enemy.instanceId);
    if (!token) {
      this.destroyEnemyToken(enemy.instanceId);
      return;
    }
    const cause: DeathCause = enemy.lastDeathCause ?? "physical";
    const visual = getDeathVisual(cause);
    const isBoss = BattleScene.isBossRole(enemy.def.role);
    const duration = this.scaledDuration(Math.round(DEATH_FX_BASE_MS * (isBoss ? 1.5 : 1)));
    if (duration <= 0) {
      this.destroyEnemyToken(enemy.instanceId);
      return;
    }
    const c = this.grid.tileToWorldCenter(enemy.position);
    this.playDeathFlourish(c, visual.shape, visual.color, isBoss ? 1.5 : 1, duration);
    const targets = [token.circle, token.label, token.hp, token.sprite].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    );
    this.tweens.add({
      targets,
      alpha: 0,
      scaleY: 0.2,
      scaleX: visual.shape === "collapse" ? 1.15 : 0.6,
      duration,
      onComplete: () => this.destroyEnemyToken(enemy.instanceId),
    });
  }

  /** The cause-specific flourish half of a defeated enemy's animation — see `playEnemyDeathVisual`. */
  private playDeathFlourish(
    c: { x: number; y: number },
    shape: DeathShape,
    color: number,
    sizeScale: number,
    duration: number,
  ): void {
    switch (shape) {
      case "collapse":
        this.spawnBurstMotes(c.x, c.y, color, 3, this.grid.tileSize * 0.3 * sizeScale, duration * 0.6);
        break;
      case "emberFade":
        this.spawnDriftMotes(c.x, c.y, color, 5, 0, -this.grid.tileSize * 0.8 * sizeScale, duration);
        break;
      case "shatter":
        this.spawnBurstMotes(c.x, c.y, color, 6, this.grid.tileSize * 0.7 * sizeScale, duration * 0.7, -1);
        break;
      case "dissolve":
        this.spawnRing(c.x, c.y, this.grid.tileSize * 0.42 * sizeScale, 1, 0.05, color, duration);
        break;
      case "wither":
        this.spawnDriftMotes(c.x, c.y, color, 4, 0, this.grid.tileSize * 0.4 * sizeScale, duration);
        break;
      case "radiantBurst":
        this.spawnRing(c.x, c.y, this.grid.tileSize * 0.35 * sizeScale, 0.2, 1.8 * sizeScale, color, duration, 5);
        break;
      case "sparkCrackle":
        this.spawnBurstMotes(c.x, c.y, color, 7, this.grid.tileSize * 0.5 * sizeScale, duration * 0.5, 1);
        break;
      case "arcaneFade":
        this.spawnRing(c.x, c.y, this.grid.tileSize * 0.4 * sizeScale, 0.8, 0.1, color, duration);
        break;
    }
  }

  private rejectAt(pos: GridPosition, message: string): void {
    const c = this.grid.tileToWorldCenter(pos);
    this.flashTile(c.x, c.y, COLORS.tileRejected, 0.6, 300);
    this.messageText.setText(message);
  }

  private logCombat(line: string): void {
    this.combatLog.push(line);
    if (this.combatLog.length > 5) this.combatLog.shift();
    this.combatLogText.setText(this.combatLog.join("\n"));
  }

  /** KI-085/D-130: append a line to the technical log's own history (see `technicalLog`'s doc comment). */
  private logTechnical(line: string): void {
    this.technicalLog.push(line);
    if (this.technicalLog.length > 200) this.technicalLog.shift();
  }

  /**
   * KI-085/D-130: the full dice-roll detail behind one attack/save result —
   * die, bonus, target number, advantage mode, and the raw outcome — for the
   * technical log's own line, alongside (never instead of) the existing
   * plain-English `logCombat` line at the same call site. Absent `roll`
   * means an `autoHit` attack (a trap, or any ability that skips the d20
   * entirely) — reported as such rather than inventing roll numbers that
   * never happened.
   */
  private static technicalAttackLine(attackerName: string, targetName: string, result: AttackResult): string {
    if (!result.roll) {
      const dmg = result.damageDealt > 0 ? ` for ${result.damageDealt}` : "";
      return `${attackerName} -> ${targetName}: auto-hit (no roll)${dmg}`;
    }
    const { d20, total, targetArmorClass, hit, critical, fumble, advantage } = result.roll;
    const bonus = total - d20;
    const bonusText = bonus >= 0 ? `+${bonus}` : `${bonus}`;
    const advText = advantage === "normal" ? "" : ` (${advantage})`;
    const outcome = fumble ? "FUMBLE" : critical ? "CRITICAL HIT" : hit ? "HIT" : "MISS";
    const dmgText = hit && result.damageDealt > 0 ? `, ${result.damageDealt} damage` : "";
    return `${attackerName} -> ${targetName}: d20 ${d20} ${bonusText} = ${total} vs ${targetArmorClass}${advText} -> ${outcome}${dmgText}`;
  }

  /**
   * D-158 (KI-034 redesign): updates the roster-strip widgets' content
   * (never their position — `layoutHeroSlots()` did that once) plus the
   * live enemy count and `messageText`'s short, mode-dependent remainder.
   * See this method's own history in `DECISIONS.md` D-158 for what moved
   * where and why — most of the old packed hint text turned out to be
   * redundant with an already-visible button label or board highlight.
   */
  private refreshStatus(): void {
    this.heroes.forEach((h, i) => {
      if (i >= MAX_ROSTER_SLOTS) return; // can't happen (party size is capped at MAX_ROSTER_SLOTS), guards the parallel arrays anyway
      const box = this.heroSlotBoxes[i];
      const isSelected =
        (this.ui.kind === "heroSelected" ||
          this.ui.kind === "confirmingMove" ||
          this.ui.kind === "choosingSpell" ||
          this.ui.kind === "aimingSpell" ||
          this.ui.kind === "aimingTileSpell") &&
        this.ui.heroId === h.id;
      box.setStrokeStyle(2, isSelected ? COLORS.heroActive : 0x3a3a4a);
      if (!h.isAlive()) {
        box.setFillStyle(0x1a1a26, 0.5);
        this.heroSlotNameText[i].setText(`${h.name} (down)`).setColor("#6a6a80");
        this.heroSlotHpBarBg[i].setVisible(false);
        this.heroSlotHpBarFg[i].setVisible(false);
        this.heroSlotHpText[i].setVisible(false);
        this.heroSlotDetailText[i].setText("");
        return;
      }
      box.setFillStyle(0x1a1a26, 0.9);
      // Phase 13.3 (D-089): only a D&D-built hero has a meaningful class level to show.
      const level = h.classId !== undefined ? ` Lv${h.level}` : "";
      this.heroSlotNameText[i].setText(`${h.name}${level}`).setColor("#e8e8f0");
      const fraction = h.effectiveMaxHealth > 0 ? Phaser.Math.Clamp(h.health / h.effectiveMaxHealth, 0, 1) : 0;
      const barMaxWidth = this.heroSlotHpBarBg[i].width;
      const barColor = fraction > 0.5 ? COLORS.hero : fraction > 0.25 ? 0xe8c06a : COLORS.enemy;
      this.heroSlotHpBarFg[i].setSize(Math.max(1, barMaxWidth * fraction), this.heroSlotHpBarFg[i].height).setFillStyle(barColor);
      this.heroSlotHpBarBg[i].setVisible(true);
      this.heroSlotHpBarFg[i].setVisible(true);
      this.heroSlotHpText[i].setVisible(true).setText(`${h.health}/${h.effectiveMaxHealth}`);
      // D-148/D-158: this detail line is the one place per-hero AC/move/act/
      // gear readiness still shows — only for the selected, living hero, same
      // as before this redesign, just in its own reserved slot rather than
      // string-appended into a shared paragraph.
      if (!isSelected) {
        this.heroSlotDetailText[i].setText("");
        return;
      }
      const move = h.canMove() ? "move:ready" : "move:used";
      const act = h.canAct() ? "act:ready" : "act:used";
      const gearCount = GEAR_SLOT_IDS.filter((s) => h.equippedItems[s]).length;
      const potionCount = GENERAL_SLOT_IDS.filter((s) => h.equippedPotions[s]).length;
      const gear = gearCount || potionCount ? ` gear ${gearCount}/${GEAR_SLOT_IDS.length} pot ${potionCount}/${GENERAL_SLOT_IDS.length}` : "";
      this.heroSlotDetailText[i].setText(`AC${h.armorClass} ${move} ${act}${gear}`);
    });

    this.enemyCountText.setText(`Enemies: ${this.waveSystem.enemies.length}`);

    // D-158: the small remainder of the old hint that wasn't redundant with
    // an already-visible button/highlight (see this method's own doc
    // comment) — aiming-mode instructions (no Cancel button exists for
    // these) and the Tab focus indicator (genuinely non-obvious keyboard
    // state with no other display surface). Every other `ui.kind` — idle,
    // heroSelected, confirmingMove, and the enemy-turn "resolving" case
    // (already shown by the banner's own `PHASE_LABELS[phase]`) — leaves
    // this blank.
    let message = "";
    if (this.ui.kind === "choosingSpell") message = "Pick a spell to cast · Esc to cancel";
    else if (this.ui.kind === "aimingSpell") message = "Click an outlined ally or enemy to cast the spell · Esc to cancel";
    else if (this.ui.kind === "aimingTileSpell") message = "Click an outlined tile to cast the spell · Esc to cancel";
    else if (this.ui.kind === "building") {
      const focusHint = this.keyboardFocus === "grid" ? "Tab: aim on board" : "Tab: pick item";
      message = `${focusHint} · Esc when done`;
    } else if (this.ui.kind === "equipping") {
      const focusHint = this.keyboardFocus === "grid" ? "Tab: aim on board" : "Tab: pick item";
      message = `${focusHint} · Esc when done`;
    } else if (this.ui.kind === "debugSpawnEnemy") {
      const focusHint = this.keyboardFocus === "grid" ? "Tab: aim on board" : "Tab: pick item";
      message = `Test Mode: click a tile to spawn ${getEnemyDefinition(this.ui.enemyId).name} there · ${focusHint} · Esc when done`;
    } else if (this.ui.kind === "debugPaintTerrain") {
      const focusHint = this.keyboardFocus === "grid" ? "Tab: aim on board" : "Tab: pick item";
      message = `Test Mode: click a tile to paint it "${this.ui.tileType}" · no placement checks · ${focusHint} · Esc when done`;
    } else if (this.ui.kind === "debugStatus") {
      const focusHint = this.keyboardFocus === "grid" ? "Tab: aim on board" : "Tab: pick item";
      message = `Test Mode: click a hero/enemy to toggle "${getStatusEffectDefinition(this.ui.statusId).name}" on it · ${focusHint} · Esc when done`;
    }
    this.messageText.setText(message);
  }

  /**
   * Phase 13.4 (D-088): offer a Short/Long Rest between waves, opt-in — same
   * "defer the transition until the player resolves it" pattern the
   * ASI/subclass-choice overlays use. Skips the overlay entirely (calls `onDone`
   * immediately) if NEITHER rest type has a charge left, so the player is
   * never forced to click through a modal with nothing real to offer.
   */
  private showRestChoice(onDone: () => void): void {
    if (!this.restSystem.canTakeShortRest() && !this.restSystem.canTakeLongRest()) {
      onDone();
      return;
    }
    this.choosingRest = true;
    this.pendingAfterRest = onDone;

    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
      .setDepth(40);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, "Rest before the next wave?", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "32px",
        color: "#8ad0f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(41);
    this.restOverlay.push(dim, title);

    const choices: Array<{ label: string; desc: string; onClick: () => void }> = [];
    if (this.restSystem.canTakeShortRest()) {
      choices.push({
        label: `Short Rest (${this.restSystem.shortRestsRemaining} left)`,
        desc: "Heals a fraction of max HP for the whole party; recharges Second Wind/Action Surge for any Fighter.",
        onClick: () => this.chooseRest("short"),
      });
    }
    if (this.restSystem.canTakeLongRest()) {
      choices.push({
        label: `Long Rest (${this.restSystem.longRestsRemaining} left)`,
        desc: "Fully heals the whole party; recharges Second Wind/Action Surge for any Fighter.",
        onClick: () => this.chooseRest("long"),
      });
    }
    choices.push({
      label: "Continue",
      desc: "Press on without resting, saving any remaining charges for later.",
      onClick: () => this.chooseRest("none"),
    });

    const spacing = 260;
    const startX = GAME_WIDTH / 2 - ((choices.length - 1) * spacing) / 2;
    choices.forEach((choice, i) => {
      const x = startX + i * spacing;
      const y = GAME_HEIGHT / 2 - 10;
      const btn = this.add
        .rectangle(x, y, 240, 110, 0x3a5a8a)
        .setInteractive({ useHandCursor: true })
        .setDepth(41);
      const name = this.add
        .text(x, y - 30, choice.label, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "18px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(42);
      const desc = this.add
        .text(x, y + 20, choice.desc, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "12px",
          color: "#c8c8d8",
          align: "center",
          wordWrap: { width: 210 },
        })
        .setOrigin(0.5)
        .setDepth(42);
      btn.on("pointerover", () => btn.setFillStyle(0x4a6a9a));
      btn.on("pointerout", () => btn.setFillStyle(0x3a5a8a));
      btn.on("pointerdown", () => choice.onClick());
      this.restOverlay.push(btn, name, desc);
    });
  }

  private chooseRest(kind: "short" | "long" | "none"): void {
    if (kind === "short") this.restSystem.takeShortRest(this.livingHeroes());
    else if (kind === "long") this.restSystem.takeLongRest(this.livingHeroes());
    this.syncHeroTokens(); // a rest may have healed heroes, refresh HP labels
    for (const obj of this.restOverlay) obj.destroy();
    this.restOverlay = [];
    this.choosingRest = false;
    const proceed = this.pendingAfterRest;
    this.pendingAfterRest = null;
    // D-136: a Long Rest is the trigger for Wizard/Cleric/Druid's full spell
    // relist (and Wizard's own cantrip swap) — offer it here, deferring
    // `proceed` past it the same way `afterWaveCleared` defers past every
    // other overlay. Paladin/Ranger's own Long-Rest tier stays moot (empty
    // eligible pool), so they never actually appear in this filter.
    if (kind === "long") {
      const heroesNeedingPrep = this.livingHeroes().filter(
        (hero) => hero.classId && spellSwapStepsForClass(hero.classId, hero.level, "longRest").length > 0,
      );
      if (heroesNeedingPrep.length > 0) {
        this.showSpellPrepQueue(heroesNeedingPrep, "longRest", () => proceed?.());
        return;
      }
    }
    proceed?.();
  }

  /**
   * KI-085/D-130: a plain "reaches level N!" confirmation for a hero whose
   * level-up this wave grants no other choice — the subclass/ASI/spell-pick
   * overlays already announce their own hero's new level in their title, so
   * this queue is populated with only the LEFTOVER heroes (see
   * `applyClassLevelUps`'s `plainHeroes`), never both for the same hero.
   * Same "queue and pop" shape as `showSubclassChoiceQueue`.
   */
  private showLevelUpAckQueue(heroes: Hero[], onDone: () => void): void {
    this.levelUpAckQueue = [...heroes];
    this.pendingAfterLevelUpAck = onDone;
    this.choosingLevelUpAck = true;
    this.advanceLevelUpAckQueue();
  }

  /** Pop the next hero off `levelUpAckQueue` and show their confirmation, or finish if the queue is empty. */
  private advanceLevelUpAckQueue(): void {
    const hero = this.levelUpAckQueue.shift();
    if (!hero) {
      this.clearAsiOverlay();
      this.choosingLevelUpAck = false;
      const proceed = this.pendingAfterLevelUpAck;
      this.pendingAfterLevelUpAck = null;
      proceed?.();
      return;
    }
    const desc = this.levelUpDeltaByHeroId.get(hero.id);
    this.renderAsiPrompt(`${hero.name} reaches level ${hero.level}!`, [
      { label: "Continue", desc, onClick: () => this.advanceLevelUpAckQueue() },
    ]);
  }

  /**
   * Phase 13.11 (D-096): the subclass-choice confirmation overlay. Shown
   * once per hero in `heroes` (already filtered to those who just reached
   * their class's subclass-choice level with no subclass yet), one at a
   * time via `subclassQueue` — the exact same "queue and pop" shape
   * `showAsiChoiceQueue` already established, reused here rather than
   * duplicated.
   */
  private showSubclassChoiceQueue(heroes: Hero[], onDone: () => void): void {
    this.subclassQueue = [...heroes];
    this.pendingAfterSubclass = onDone;
    this.choosingSubclass = true;
    this.advanceSubclassQueue();
  }

  /** Pop the next hero off `subclassQueue` and show their confirmation, or finish if the queue is empty. */
  private advanceSubclassQueue(): void {
    const hero = this.subclassQueue.shift();
    if (!hero) {
      this.clearAsiOverlay();
      this.choosingSubclass = false;
      const proceed = this.pendingAfterSubclass;
      this.pendingAfterSubclass = null;
      proceed?.();
      return;
    }
    this.showSubclassConfirm(hero);
  }

  /**
   * Phase 14.2 (D-099): every class now has two modeled subclasses, so this
   * renders one button per option — a real choice, not just a confirmation.
   * `renderAsiPrompt` already supports an arbitrary number of buttons (see
   * the ASI/feat overlay), so this needed no new rendering code, only
   * mapping over every subclass instead of hardcoding index 0 — exactly
   * what this method's own prior comment said a future second option would
   * do.
   */
  private showSubclassConfirm(hero: Hero): void {
    if (!hero.classId) {
      this.advanceSubclassQueue();
      return;
    }
    const options = subclassesForClass(hero.classId);
    if (options.length === 0) {
      this.advanceSubclassQueue();
      return;
    }
    const classDef = getClassDefinition(hero.classId);
    const plannedSubclassId = this.heroLevelUpPlans.get(hero.id)?.subclassId;
    // Titles off `classDef.subclassChoiceLevel`, not `hero.level` — for a
    // choice deferred from a pre-battle fast-forward, `hero.level` is
    // already the hero's final Starting Level by the time this prompt
    // shows, not the level that actually granted this subclass pick.
    this.renderAsiPrompt(
      `${hero.name} reaches level ${classDef.subclassChoiceLevel}!`,
      options.map((subclass) => ({
        label: `Choose: ${subclass.name}`,
        desc: `A ${classDef.name} path chosen at level ${classDef.subclassChoiceLevel}.`,
        onClick: () => this.finishSubclassChoice(hero, subclass.id),
        highlighted: subclass.id === plannedSubclassId,
      })),
    );
  }

  private finishSubclassChoice(hero: Hero, subclassId: string): void {
    hero.grantSubclass(subclassId);
    this.logCombat(`${hero.name} becomes a ${getSubclassDefinition(subclassId).name}!`);
    this.advanceSubclassQueue();
  }

  /**
   * D-125: Wizard's Spell Mastery (level 18)/Signature Spells (level 20) and
   * Warlock's Mystic Arcanum (levels 11/13/15/17) — a ONE-TIME pick from a
   * hero's own already-known spell list, made the instant the feature is
   * gained. Same "queue and pop" shape as `showAsiChoiceQueue`/
   * `showSubclassChoiceQueue`, reusing `renderAsiPrompt`/`asiOverlay`.
   */
  private showSpellPickChoiceQueue(requests: SpellPickRequest[], onDone: () => void): void {
    this.spellPickQueue = [...requests];
    this.pendingAfterSpellPick = onDone;
    this.choosingSpellPick = true;
    this.advanceSpellPickQueue();
  }

  /** Pop the next request off `spellPickQueue` and show its picker, or finish if the queue is empty. */
  private advanceSpellPickQueue(): void {
    const request = this.spellPickQueue.shift();
    if (!request) {
      this.clearAsiOverlay();
      this.choosingSpellPick = false;
      const proceed = this.pendingAfterSpellPick;
      this.pendingAfterSpellPick = null;
      proceed?.();
      return;
    }
    this.showSpellPickPrompt(request);
  }

  private showSpellPickPrompt(request: SpellPickRequest): void {
    const { hero, kind, tier } = request;
    // D-16x: a hero's "prompt" plan keys its spell picks by trigger LEVEL,
    // which isn't necessarily `hero.level` anymore — a choice deferred from
    // a pre-battle fast-forward is presented after the hero's level has
    // already moved past the level that actually triggered it.
    const triggerLevel = spellPickTriggerLevel(request);
    const plannedPick = triggerLevel !== undefined ? this.heroLevelUpPlans.get(hero.id)?.spellPicks[triggerLevel] : undefined;
    if (kind === "mastery") {
      const eligible = hero.eligibleSpellMasterySpells();
      if (eligible.length === 0) {
        this.advanceSpellPickQueue(); // nothing known yet at a low enough level — nothing to pick from
        return;
      }
      const plannedSpellId = plannedPick?.kind === "mastery" ? plannedPick.spellId : undefined;
      this.renderAsiPrompt(
        `${hero.name} — Spell Mastery: Choose a Spell`,
        eligible.map((id) => ({
          label: getAbility(id).name,
          onClick: () => {
            hero.chooseSpellMasterySpell(id);
            this.logCombat(`${hero.name} masters ${getAbility(id).name} — castable at will, free, forever`);
            this.advanceSpellPickQueue();
          },
          highlighted: id === plannedSpellId,
        })),
      );
    } else if (kind === "signature") {
      const eligible = hero.eligibleSignatureSpells();
      if (eligible.length < 2) {
        this.advanceSpellPickQueue(); // fewer than 2 known 3rd-level spells to choose from
        return;
      }
      const plannedFirst = plannedPick?.kind === "signature" ? plannedPick.spellIds[0] : undefined;
      this.renderAsiPrompt(
        `${hero.name} — Signature Spells: Choose the First`,
        eligible.map((id) => ({
          label: getAbility(id).name,
          onClick: () => this.showSignatureSpellSecondPick(hero, id, eligible),
          highlighted: id === plannedFirst,
        })),
      );
    } else if (kind === "arcanum" && tier !== undefined) {
      const eligible = hero.eligibleMysticArcanumSpells(tier);
      if (eligible.length === 0) {
        this.advanceSpellPickQueue(); // nothing known yet at this exact spell level
        return;
      }
      const plannedSpellId =
        plannedPick?.kind === "arcanum" && plannedPick.tier === tier ? plannedPick.spellId : undefined;
      this.renderAsiPrompt(
        `${hero.name} — Mystic Arcanum (${tier}th level): Choose a Spell`,
        eligible.map((id) => ({
          label: getAbility(id).name,
          onClick: () => {
            hero.chooseMysticArcanumSpell(tier, id);
            this.logCombat(`${hero.name} learns the Mystic Arcanum ${getAbility(id).name} — one free cast per Long Rest`);
            this.advanceSpellPickQueue();
          },
          highlighted: id === plannedSpellId,
        })),
      );
    } else {
      this.advanceSpellPickQueue();
    }
  }

  /** Signature Spells' second pick — excludes whichever spell was already picked first. */
  private showSignatureSpellSecondPick(hero: Hero, first: string, eligible: string[]): void {
    const remaining = eligible.filter((id) => id !== first);
    const triggerLevel = spellPickTriggerLevel({ hero, kind: "signature" });
    const plannedPick = triggerLevel !== undefined ? this.heroLevelUpPlans.get(hero.id)?.spellPicks[triggerLevel] : undefined;
    const plannedSecond =
      plannedPick?.kind === "signature" && plannedPick.spellIds[0] === first ? plannedPick.spellIds[1] : undefined;
    this.renderAsiPrompt(
      `${hero.name} — Signature Spells: Choose the Second`,
      remaining.map((id) => ({
        label: getAbility(id).name,
        onClick: () => {
          hero.chooseSignatureSpells([first, id]);
          this.logCombat(`${hero.name} picks ${getAbility(first).name} and ${getAbility(id).name} as Signature Spells — one free cast each per rest`);
          this.advanceSpellPickQueue();
        },
        highlighted: id === plannedSecond,
      })),
    );
  }

  /**
   * D-136 (Phase 3): the two building blocks a "prepared"/"cantrips" swap
   * step needs — the eligible pool (filtered to what's actually castable at
   * this hero's CURRENT level, same display-only filter D-135's Character
   * Creation picker applies at Starting Level) and the hero's live current
   * selection/cap for that kind. No draft object: these screens write
   * straight to the `Hero` via `chooseCantrips`/`choosePreparedSpells` on
   * every click and re-render from the hero's own live state, since Phase 3
   * never edits a Wizard's spellbook (the one case Phase 2 needed a draft
   * for, to prune stranded prepared picks mid-edit).
   */
  private spellPrepPool(hero: Hero, kind: SpellSwapStepKind): string[] {
    if (!hero.classId) return [];
    if (kind === "cantrips") return eligibleCantripPool(hero.classId);
    const maxLevel = maxCastableSpellLevel(hero.classId, hero.level);
    const pool = hero.classId === "wizard" ? hero.spellbookIds : eligibleLeveledSpellPool(hero.classId);
    return pool.filter((id) => getSpell(id).level <= maxLevel);
  }

  private spellPrepCurrent(hero: Hero, kind: SpellSwapStepKind): readonly string[] {
    return kind === "cantrips" ? hero.knownCantripIds : hero.preparedSpellIds;
  }

  private spellPrepMaxCount(hero: Hero, kind: SpellSwapStepKind): number {
    if (!hero.classId) return 0;
    return kind === "cantrips"
      ? cantripsKnownForClassAtLevel(getClassDefinition(hero.classId), hero.level)
      : preparedSpellCountForClassAtLevel(hero.classId, hero.level);
  }

  private spellPrepTriggerLabel(): string {
    return this.spellPrepTrigger === "longRest" ? "Long Rest" : "Level-Up";
  }

  /**
   * D-136 (Phase 3): the in-battle counterpart to D-135's Character Creation
   * spell picker — offers each hero in `heroes` (already filtered to those
   * with a real swap opportunity at `trigger` via `spellSwapStepsForClass`)
   * its cantrip/prepared swap step(s), one hero at a time via `spellPrepQueue`
   * — same "queue and pop" shape as `asiQueue`/`subclassQueue`/`spellPickQueue`,
   * sharing `asiOverlay`'s rendering (never runs concurrently with any of
   * them — see `chooseRest`/`afterWaveCleared`'s own chaining).
   */
  private showSpellPrepQueue(heroes: Hero[], trigger: SpellSwapTrigger, onDone: () => void): void {
    this.spellPrepQueue = [...heroes];
    this.spellPrepTrigger = trigger;
    this.pendingAfterSpellPrep = onDone;
    this.choosingSpellPrep = true;
    this.advanceSpellPrepQueue();
  }

  /** Pop the next hero off `spellPrepQueue` and compute their own step ladder, or finish if the queue is empty. */
  private advanceSpellPrepQueue(): void {
    const hero = this.spellPrepQueue.shift();
    if (!hero || !hero.classId) {
      this.clearAsiOverlay();
      this.choosingSpellPrep = false;
      const proceed = this.pendingAfterSpellPrep;
      this.pendingAfterSpellPrep = null;
      proceed?.();
      return;
    }
    this.spellPrepSteps = spellSwapStepsForClass(hero.classId, hero.level, this.spellPrepTrigger);
    this.spellPrepStepIndex = 0;
    this.showSpellPrepStep(hero);
  }

  /** Show this hero's next swap-step screen, or advance to the next hero once their own ladder is exhausted. */
  private showSpellPrepStep(hero: Hero): void {
    if (this.spellPrepStepIndex >= this.spellPrepSteps.length) {
      this.advanceSpellPrepQueue();
      return;
    }
    const kind = this.spellPrepSteps[this.spellPrepStepIndex];
    if (kind === "prepared" && hero.classId && preparedSwapIsFullRelist(hero.classId)) {
      this.showSpellPrepRelistScreen(hero, kind);
    } else {
      this.showSpellPrepDropScreen(hero, kind);
    }
  }

  private advanceSpellPrepStep(hero: Hero): void {
    this.spellPrepStepIndex += 1;
    this.showSpellPrepStep(hero);
  }

  /**
   * The full-relist screen (Wizard/Cleric/Druid's PREPARED list at Long
   * Rest only — cantrips never take this path, see `preparedSwapIsFullRelist`'s
   * own doc comment): a toggle-multiple-then-confirm interaction, ported
   * from `CharacterCreationScene.showSpellStepScreen` but writing straight
   * to the live `Hero` instead of a scene-local draft (see `spellPrepPool`'s
   * comment for why no draft is needed here). Re-invoked on every toggle
   * click so `highlighted` stays in sync with the hero's own live list.
   */
  private showSpellPrepRelistScreen(hero: Hero, kind: SpellSwapStepKind): void {
    const pool = this.spellPrepPool(hero, kind);
    const current = this.spellPrepCurrent(hero, kind);
    const max = this.spellPrepMaxCount(hero, kind);
    const title = kind === "cantrips" ? "Known Cantrips" : "Prepared Spells";

    const choices: Array<{ label: string; desc?: string; onClick: () => void; highlighted?: boolean }> = pool.map(
      (id) => {
        const spell = getSpell(id);
        const isSelected = current.includes(id);
        return {
          label: spell.name,
          desc: spell.level === 0 ? "Cantrip" : `Level ${spell.level}`,
          highlighted: isSelected,
          onClick: () => {
            let next: string[];
            if (isSelected) next = current.filter((existingId) => existingId !== id);
            else if (current.length < max) next = [...current, id];
            else return; // already at the cap, and this id isn't currently selected — no-op
            if (kind === "cantrips") hero.chooseCantrips(next);
            else hero.choosePreparedSpells(next);
            this.showSpellPrepRelistScreen(hero, kind);
          },
        };
      },
    );

    const count = current.length;
    choices.push({
      label: `Confirm (${count}/${max})`,
      onClick: () => (count === max ? this.advanceSpellPrepStep(hero) : undefined),
    });

    this.renderAsiPrompt(`${hero.name} — ${title} (${this.spellPrepTriggerLabel()}) — Choose ${max}`, choices);
  }

  /**
   * The "replace exactly one" flow (every cantrip swap; Paladin/Ranger's
   * PREPARED list, moot in practice — see D-136): screen A picks which
   * currently-known entry to drop (or bails out via "Keep current"), screen
   * B (`showSpellPrepLearnScreen`) picks its replacement from the eligible
   * pool minus what's already known. Nothing is committed until the Learn
   * screen's own click, so "◀ Back" from there is a free undo.
   */
  private showSpellPrepDropScreen(hero: Hero, kind: SpellSwapStepKind): void {
    const current = this.spellPrepCurrent(hero, kind);
    const label = kind === "cantrips" ? "Cantrip" : "Prepared Spell";
    const choices: Array<{ label: string; desc?: string; onClick: () => void }> = current.map((id) => {
      const spell = getSpell(id);
      return {
        label: spell.name,
        desc: spell.level === 0 ? "Cantrip" : `Level ${spell.level}`,
        onClick: () => this.showSpellPrepLearnScreen(hero, kind, id),
      };
    });
    choices.push({
      label: "Keep current — no swap",
      desc: `Skip this ${label.toLowerCase()} swap and move on.`,
      onClick: () => this.advanceSpellPrepStep(hero),
    });
    this.renderAsiPrompt(`${hero.name} — ${this.spellPrepTriggerLabel()}: Replace a ${label}`, choices);
  }

  private showSpellPrepLearnScreen(hero: Hero, kind: SpellSwapStepKind, dropId: string): void {
    const current = this.spellPrepCurrent(hero, kind);
    const pool = this.spellPrepPool(hero, kind).filter((id) => !current.includes(id));
    if (pool.length === 0) {
      // Nothing eligible to learn instead — same auto-skip idiom the Spell
      // Mastery/Signature Spells/Mystic Arcanum screens already use when
      // there's genuinely nothing to pick from.
      this.advanceSpellPrepStep(hero);
      return;
    }
    const dropLabel = getSpell(dropId).name;
    const label = kind === "cantrips" ? "Cantrip" : "Prepared Spell";

    const choices: Array<{ label: string; desc?: string; onClick: () => void }> = pool.map((id) => {
      const spell = getSpell(id);
      return {
        label: spell.name,
        desc: spell.level === 0 ? "Cantrip" : `Level ${spell.level}`,
        onClick: () => {
          const next = current.filter((existingId) => existingId !== dropId).concat(id);
          if (kind === "cantrips") hero.chooseCantrips(next);
          else hero.choosePreparedSpells(next);
          this.logCombat(`${hero.name} swaps ${dropLabel} for ${spell.name}`);
          this.advanceSpellPrepStep(hero);
        },
      };
    });
    choices.push({ label: "◀ Back", onClick: () => this.showSpellPrepDropScreen(hero, kind) });

    this.renderAsiPrompt(`${hero.name} — ${this.spellPrepTriggerLabel()}: Learn a New ${label}`, choices);
  }

  /**
   * Phase 13.6 (D-091): the Ability-Score-Improvement-or-feat overlay. Shown
   * once per hero in `heroes` (already filtered to those who just reached an
   * ASI-granting level), one at a time via `asiQueue` — the same "queue and
   * pop" shape a multi-hero level-up would need, but nothing else in this
   * project queues per-hero overlays yet, so it's local to this feature.
   */
  private showAsiChoiceQueue(entries: { hero: Hero; level: number }[], onDone: () => void): void {
    this.asiQueue = [...entries];
    this.pendingAfterAsi = onDone;
    this.choosingAsi = true;
    this.advanceAsiQueue();
  }

  /** Pop the next entry off `asiQueue` and show its path choice, or finish if the queue is empty. */
  private advanceAsiQueue(): void {
    const entry = this.asiQueue.shift();
    if (!entry) {
      this.clearAsiOverlay();
      this.choosingAsi = false;
      const proceed = this.pendingAfterAsi;
      this.pendingAfterAsi = null;
      proceed?.();
      return;
    }
    this.showAsiPathChoice(entry.hero, entry.level);
  }

  /** Step 1: raise ability scores, or take a feat instead. */
  private showAsiPathChoice(hero: Hero, level: number): void {
    const planned = this.heroLevelUpPlans.get(hero.id)?.asiChoices[level];
    this.renderAsiPrompt(`${hero.name} — Ability Score Improvement`, [
      {
        label: "Raise Ability Scores",
        desc: "+2 to one ability score, or +1 to two different ones.",
        onClick: () => this.showAsiModeChoice(hero, level),
        highlighted: planned?.path === "ability",
      },
      {
        label: "Take a Feat",
        desc: "A special talent instead of raw ability scores.",
        onClick: () => this.showFeatChoice(hero, level),
        highlighted: planned?.path === "feat",
      },
    ]);
  }

  /** Step 2a (Raise Ability Scores path): the SRD's real split — +2 to one, or +1 to two. */
  private showAsiModeChoice(hero: Hero, level: number): void {
    const planned = this.heroLevelUpPlans.get(hero.id)?.asiChoices[level];
    const plannedAbility = planned?.path === "ability" ? planned : undefined;
    this.renderAsiPrompt(`${hero.name} — Raise Ability Scores`, [
      {
        label: "+2 to one ability",
        desc: "Raise a single ability score by 2.",
        onClick: () =>
          this.showAsiAbilityPicker(
            hero,
            (ability) => this.finishAsiSingle(hero, ability),
            undefined,
            plannedAbility?.abilityMode === "single" ? plannedAbility.ability : undefined,
          ),
        highlighted: plannedAbility?.abilityMode === "single",
      },
      {
        label: "+1 to two abilities",
        desc: "Raise two different ability scores by 1 each.",
        onClick: () => {
          const splitPlan = plannedAbility?.abilityMode === "split" ? plannedAbility : undefined;
          this.showAsiAbilityPicker(
            hero,
            (first) => {
              const secondHighlight = splitPlan && splitPlan.first === first ? splitPlan.second : undefined;
              this.showAsiAbilityPicker(hero, (second) => this.finishAsiSplit(hero, first, second), first, secondHighlight);
            },
            undefined,
            splitPlan?.first,
          );
        },
        highlighted: plannedAbility?.abilityMode === "split",
      },
    ]);
  }

  /** Step 3 (Raise Ability Scores path): pick which ability score(s) to raise, one pick at a time. */
  private showAsiAbilityPicker(
    hero: Hero,
    onPick: (ability: AbilityScoreId) => void,
    exclude?: AbilityScoreId,
    highlightAbility?: AbilityScoreId,
  ): void {
    const choices = ABILITY_SCORE_IDS.filter((id) => id !== exclude).map((id) => ({
      label: `${ABILITY_SCORE_NAMES[id]} (${hero.abilityScoreValue(id)})`,
      onClick: () => onPick(id),
      highlighted: id === highlightAbility,
    }));
    this.renderAsiPrompt(`${hero.name} — Choose an Ability`, choices);
  }

  private finishAsiSingle(hero: Hero, ability: AbilityScoreId): void {
    hero.improveAbilityScore(ability, 2);
    this.logCombat(`${hero.name}'s ${ABILITY_SCORE_NAMES[ability]} rises to ${hero.abilityScoreValue(ability)}`);
    this.syncHeroTokens();
    this.advanceAsiQueue();
  }

  private finishAsiSplit(hero: Hero, first: AbilityScoreId, second: AbilityScoreId): void {
    hero.improveAbilityScore(first, 1);
    hero.improveAbilityScore(second, 1);
    this.logCombat(`${hero.name} raises ${ABILITY_SCORE_NAMES[first]} and ${ABILITY_SCORE_NAMES[second]} by 1 each`);
    this.syncHeroTokens();
    this.advanceAsiQueue();
  }

  /**
   * Step 2b (Take a Feat path): every feat this hero both doesn't already
   * have (or, for the repeatable Magic Initiate, hasn't taken every spell
   * list of yet) AND meets the prerequisites for (Phase 18, D-109's
   * `Hero.meetsFeatPrerequisites` — level, ability score, Fighting Style/
   * spellcasting class, etc.). Falls back to the ability-score path instead
   * of a dead-end screen on the case where nothing qualifies.
   */
  private showFeatChoice(hero: Hero, level: number): void {
    const available = FEAT_IDS.filter((id) => hero.meetsFeatPrerequisites(id));
    if (available.length === 0) {
      this.showAsiModeChoice(hero, level);
      return;
    }
    const planned = this.heroLevelUpPlans.get(hero.id)?.asiChoices[level];
    const plannedFeatId = planned?.path === "feat" ? planned.featId : undefined;
    const choices = available.map((id) => {
      const feat = getFeat(id);
      return {
        label: feat.name,
        desc: feat.description,
        onClick: () => this.beginFeatGrant(hero, id, level),
        highlighted: id === plannedFeatId,
      };
    });
    this.renderAsiPrompt(`${hero.name} — Choose a Feat`, choices);
  }

  /**
   * Phase 18 (D-109): routes a chosen feat through whatever follow-up pick
   * it needs before actually granting it — an ability-score choice
   * (Grappler/every Epic Boon) and/or a spell-list choice (Magic Initiate,
   * repeatable across up to three picks) — reusing `renderAsiPrompt`
   * exactly like every other ASI/feat step, no new overlay component.
   */
  private beginFeatGrant(hero: Hero, featId: string, level: number): void {
    const feat = getFeat(featId);
    const planned = this.heroLevelUpPlans.get(hero.id)?.asiChoices[level];
    const plannedForThisFeat = planned?.path === "feat" && planned.featId === featId ? planned : undefined;
    if (feat.abilityScoreBoost) {
      const allowed = feat.abilityScoreBoost.allowedAbilities;
      const choices = ABILITY_SCORE_IDS.filter((id) => allowed.includes(id)).map((id) => ({
        label: `${ABILITY_SCORE_NAMES[id]} (${hero.abilityScoreValue(id)})`,
        onClick: () => this.continueFeatGrant(hero, featId, { chosenAbility: id }, level),
        highlighted: id === plannedForThisFeat?.chosenAbility,
      }));
      this.renderAsiPrompt(`${hero.name} — ${feat.name}: Choose an Ability`, choices);
      return;
    }
    this.continueFeatGrant(hero, featId, {}, level);
  }

  /** Magic Initiate's own follow-up: which of the (still-unpicked) spell lists this pick draws from. */
  private continueFeatGrant(hero: Hero, featId: string, partial: { chosenAbility?: AbilityScoreId }, level: number): void {
    if (featId === "magic-initiate") {
      const lists: Array<{ id: MagicInitiateListId; label: string }> = [
        { id: "cleric", label: "Cleric" },
        { id: "druid", label: "Druid" },
        { id: "wizard", label: "Wizard" },
      ];
      const remaining = lists.filter((l) => !hero.magicInitiateListsTaken.includes(l.id));
      const planned = this.heroLevelUpPlans.get(hero.id)?.asiChoices[level];
      const plannedList = planned?.path === "feat" && planned.featId === featId ? planned.magicInitiateList : undefined;
      this.renderAsiPrompt(
        `${hero.name} — Magic Initiate: Choose a List`,
        remaining.map((l) => ({
          label: l.label,
          onClick: () => this.finishAsiFeat(hero, featId, { ...partial, magicInitiateList: l.id }),
          highlighted: l.id === plannedList,
        })),
      );
      return;
    }
    this.finishAsiFeat(hero, featId, partial);
  }

  private finishAsiFeat(
    hero: Hero,
    featId: string,
    options?: { chosenAbility?: AbilityScoreId; magicInitiateList?: MagicInitiateListId },
  ): void {
    hero.grantFeat(featId, options);
    this.logCombat(`${hero.name} gains the ${getFeat(featId).name} feat`);
    this.syncHeroTokens();
    this.advanceAsiQueue();
  }

  private clearAsiOverlay(): void {
    for (const obj of this.asiOverlay) obj.destroy();
    this.asiOverlay = [];
  }

  /**
   * Shared renderer for every ASI/feat step above: a dim backdrop, a title,
   * and a row (or wrapped rows) of buttons sized to fit however many choices
   * this step has (2 for a path/mode choice, up to 6 for an ability pick, up
   * to 4 for a feat pick) — one general layout instead of a bespoke one per
   * step, since the step count/shape varies but the "pick one of these"
   * interaction never does.
   */
  /**
   * D-133: `highlighted` marks whichever option matches this hero's
   * "prompt" mode level-up plan, if any — a gold outline and a "★ " label
   * prefix, still exactly as clickable as every other option (a suggestion,
   * not a lock). Every queue below (`showAsiPathChoice` through
   * `showSignatureSpellSecondPick`) looks up its own hero's plan and passes
   * this through; a hero with no plan (or mode "fresh") never sets it, so
   * this is a pure additive rendering feature.
   */
  private renderAsiPrompt(
    title: string,
    choices: Array<{ label: string; desc?: string; onClick: () => void; highlighted?: boolean }>,
  ): void {
    this.clearAsiOverlay();
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
      .setDepth(40);
    const titleText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 160, title, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "28px",
        color: "#f0e070",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(41);
    this.asiOverlay.push(dim, titleText);

    const hasDesc = choices.some((c) => c.desc);
    const usableWidth = GAME_WIDTH - 40;
    const width = Math.min(300, Math.max(140, Math.floor(usableWidth / choices.length) - 16));
    const height = hasDesc ? 100 : 56;
    const spacing = width + 16;
    const maxPerRow = Math.max(1, Math.floor(usableWidth / spacing));
    const rows = Math.ceil(choices.length / maxPerRow);
    const rowStartY = GAME_HEIGHT / 2 - 20 - ((rows - 1) * (height + 16)) / 2;

    choices.forEach((choice, i) => {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const itemsInRow = Math.min(maxPerRow, choices.length - row * maxPerRow);
      const rowStartX = GAME_WIDTH / 2 - ((itemsInRow - 1) * spacing) / 2;
      const x = rowStartX + col * spacing;
      const y = rowStartY + row * (height + 16);
      const btn = this.add
        .rectangle(x, y, width, height, 0x3a5a8a)
        .setInteractive({ useHandCursor: true })
        .setDepth(41);
      if (choice.highlighted) btn.setStrokeStyle(3, 0xf0c040);
      const name = this.add
        .text(x, y - (choice.desc ? 20 : 0), choice.highlighted ? `★ ${choice.label}` : choice.label, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "14px",
          color: choice.highlighted ? "#ffe58a" : "#e8e8f0",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: width - 16 },
        })
        .setOrigin(0.5)
        .setDepth(42);
      this.asiOverlay.push(btn, name);
      if (choice.desc) {
        const desc = this.add
          .text(x, y + 18, choice.desc, {
            fontFamily: "system-ui, Arial, sans-serif",
            fontSize: "11px",
            color: "#c8c8d8",
            align: "center",
            wordWrap: { width: width - 16 },
          })
          .setOrigin(0.5)
          .setDepth(42);
        this.asiOverlay.push(desc);
      }
      btn.on("pointerover", () => btn.setFillStyle(0x4a6a9a));
      btn.on("pointerout", () => btn.setFillStyle(0x3a5a8a));
      btn.on("pointerdown", () => choice.onClick());
    });
  }

  /** True while a modal (ASI/feat choice, subclass choice, spell-pick choice, spell-prep swap choice, rest choice, the pre-region bonus choice, the spare-or-destroy miniboss choice, the tutorial, the technical log, or Test Mode's debug menu) should block board input. */
  private inputLocked(): boolean {
    return (
      this.choosingAsi ||
      this.choosingRegionBonus ||
      this.choosingSparableKill ||
      this.choosingSorrelFateChoice ||
      this.choosingSubclass ||
      this.choosingSpellPick ||
      this.choosingLevelUpAck ||
      this.choosingRest ||
      this.choosingSpellPrep ||
      this.tutorialOverlay.length > 0 ||
      this.technicalLogOverlay.length > 0 ||
      this.debugMenuOverlay.length > 0 ||
      this.chapterDialogue !== null
    );
  }

  /**
   * D-177: shows a chaptered campaign's `introText` (if this chapter has
   * one written) before `onComplete` runs — a no-op that calls `onComplete`
   * immediately for a flat campaign, a campaign-less run, or a chapter with
   * no `introText` yet (every chapter today — the writing pass is a
   * separate, later session; see CAMPAIGN_STORY_DESIGN.md §9).
   */
  private showChapterIntroIfAny(onComplete: () => void): void {
    const introText = this.currentChapter?.introText;
    if (!introText) {
      onComplete();
      return;
    }
    this.chapterDialogue = showDialogue(this, [{ text: introText }], () => {
      this.chapterDialogue = null;
      onComplete();
    });
  }

  /** D-177: the outroText counterpart to `showChapterIntroIfAny`, shown right before the victory end screen. */
  private showChapterOutroIfAny(onComplete: () => void): void {
    const outroText = this.currentChapter?.outroText;
    if (!outroText) {
      onComplete();
      return;
    }
    this.chapterDialogue = showDialogue(this, [{ text: outroText }], () => {
      this.chapterDialogue = null;
      onComplete();
    });
  }

  /**
   * KI-098 item 13 continuation: shown once, right after
   * `maybeUnlockHomeRegionCompanion` just recruited a Pool B companion (that
   * companion's own home region Chapter 1 clearing). A no-op for every
   * battle that recruited nobody. Falls back to the companion's plain `hook`
   * if `companionDialogue.ts` somehow has no entry for them, so this stays
   * safe even against a not-yet-authored id.
   */
  private showCompanionRecruitmentIfAny(onComplete: () => void): void {
    const companion = this.pendingCompanionRecruitment;
    this.pendingCompanionRecruitment = null;
    if (!companion) {
      onComplete();
      return;
    }
    const lines = COMPANION_RECRUITMENT_DIALOGUE[companion.id] ?? [{ speakerName: companion.name, text: companion.hook }];
    this.chapterDialogue = showDialogue(this, lines, () => {
      this.chapterDialogue = null;
      onComplete();
    });
  }

  /**
   * KI-098 item 13 continuation: a Pool B companion's own reaction to their
   * home region's Chapter 4 mirror boss going down — the "homecoming beat"
   * CAMPAIGN_STORY_DESIGN.md §9 names explicitly. A no-op outside a region's
   * own Chapter 4 finale, for a region with no companion (shouldn't happen —
   * every region has one), or for a Lost companion (only ever Sorrel, whose
   * fate is already resolved earlier this same chapter — see
   * `resolveSorrelFateIfAny`). Two entries (Fenna/Isolde) pick between
   * pre-written ashen/hollow variants via the shared mercy-tally helper
   * instead of a single fixed sequence, giving dialogue tone real
   * reactivity to earlier choices.
   */
  private showMirrorBossReactionIfAny(onComplete: () => void): void {
    if (this.chapterIndex !== 3 || !this.campaignId) {
      onComplete();
      return;
    }
    const companion = COMPANIONS.find((c) => c.homeRegionId === this.campaignId);
    if (!companion || isCompanionLost(this.companionRoster, companion.id)) {
      onComplete();
      return;
    }
    const entry = COMPANION_MIRROR_REACTION_DIALOGUE[companion.id];
    if (!entry) {
      onComplete();
      return;
    }
    const lines = Array.isArray(entry) ? entry : entry[mercyTallyLeansHollow(this.worldFlags) ? "hollow" : "ashen"];
    this.chapterDialogue = showDialogue(this, lines, () => {
      this.chapterDialogue = null;
      onComplete();
    });
  }

  /**
   * D-188: a single flavor line before wave 1 of the Nameless Throne
   * capstone, distinct per resolved ending — a no-op for every other
   * campaign. Reuses `this.chapterDialogue`/`showDialogue` exactly like
   * `showChapterIntroIfAny`; no new `inputLocked()` entry needed (that
   * check already covers `this.chapterDialogue !== null`).
   */
  private showNamelessThroneIntroIfAny(onComplete: () => void): void {
    if (this.campaignId !== NAMELESS_THRONE_CAMPAIGN_ID) {
      onComplete();
      return;
    }
    const variant = resolveThroneVariant(this.worldFlags);
    const flavor =
      variant === "ashen-sovereign"
        ? "The hall ahead still holds a shape you recognize — ash and ember, a throne that at least remembers being one."
        : "The hall ahead has gone quiet and cold in a way nothing else on this road has. Even the dust seems to have stopped remembering what it was.";
    this.chapterDialogue = showDialogue(this, [{ text: flavor }], () => {
      this.chapterDialogue = null;
      onComplete();
    });
  }

  /**
   * D-188 (CAMPAIGN_STORY_DESIGN.md §5): the capstone's own closing beat,
   * shown right before the victory end screen — a no-op for every other
   * campaign. Ending A (Ashen Sovereign, "held on"): the PC names every
   * companion still on the roster (active or benched — `lostIds` are
   * excluded by construction, see `CompanionRosterSystem.loseCompanion`)
   * out loud. Ending B (Hollow Empress, "let it be useful"): the PC reaches
   * for a name and it isn't there.
   */
  private showNamelessThroneEndingIfAny(onComplete: () => void): void {
    if (this.campaignId !== NAMELESS_THRONE_CAMPAIGN_ID || !this.resolvedThroneVariant) {
      onComplete();
      return;
    }
    const survivorNames = [...this.companionRoster.activeIds, ...this.companionRoster.benchedIds].map(
      (id) => getCompanionDefinition(id).name,
    );
    const lines: DialogueLine[] =
      this.resolvedThroneVariant === "ashen-sovereign"
        ? [
            { text: "The compulsion breaks, not the body. Something that was a throne, once, simply stops." },
            {
              text:
                survivorNames.length > 0
                  ? `You say their names, out loud, one at a time: ${survivorNames.join(", ")}. Every one of them lands.`
                  : "You try to say a name, out loud. The list should be longer than this — but you remember every one of them anyway, and that is the whole point.",
            },
          ]
        : [
            { text: "The Hollow Empress falls, and something that used to be a court falls quiet with her." },
            { text: "You go to say a name — anyone's — and find the shape of it is already gone." },
          ];
    this.chapterDialogue = showDialogue(this, lines, () => {
      this.chapterDialogue = null;
      onComplete();
    });
  }

  /**
   * Phase 8 ("tutorial prompts"): a dismissible how-to-play overlay. Shown
   * once automatically before the first player phase (see `create()`), and
   * reopenable any time via the "H" key (see `wireInput`). `onDismiss` is
   * only used for the first-run case, to resume the deferred phase advance.
   */
  private showTutorial(onDismiss?: () => void): void {
    this.pendingAfterTutorial = onDismiss ?? null;

    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(45);
    const title = this.add
      // KI-030 added two more lines to the body below; the title and the
      // dismiss button both moved further from center (220 -> 300px) to keep
      // a safe bounding-box margin around the longer text, following the
      // same worst-case-string approach as D-046 rather than eyeballing it.
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 300, "How to Play", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "32px",
        color: "#f0e070",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(46);
    const body = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        "Click a hero to select it, or press 1-4. Blue tiles are where it\n" +
          "can move — click one, then Confirm. Red outlines are enemies it\n" +
          "can attack — click one to strike. Each hero gets one move and one\n" +
          "action (attack OR ability) per turn; ability targets get a ◆\n" +
          "marker too.\n\n" +
          "Q or the Ability button uses a hero's special move; P (or the Potion\n" +
          "button) drinks a carried potion. E or End Turn finishes your turn and\n" +
          "lets the enemies act. B opens Build (walls, traps, platforms); G opens\n" +
          "Gear — seven equipment slots (Head/Chest/Legs/2 Rings/Amulet/\n" +
          "Footwear) plus two potion slots. Gold comes from defeating enemies\n" +
          "and clearing waves.\n\n" +
          "Playing with no mouse: arrow keys move a tile cursor; Enter or Space\n" +
          "acts on it (select, move, attack, aim, build, equip). In Build/Gear\n" +
          "mode, Tab switches arrow keys between the item grid and the board.\n\n" +
          "Don't let enemies reach the OUT tile — that damages your Stronghold\n" +
          "Integrity. Lose it all and the run ends. Press H any time to see\n" +
          "this again, S to cycle Game Speed (Normal/Fast/Instant), or L to see\n" +
          "the technical log (every attack/save roll's raw dice and bonuses).",
        {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "16px",
          color: "#e8e8f0",
          align: "left",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(46);
    const btn = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 300, 220, 52, 0x4caf72)
      .setInteractive({ useHandCursor: true })
      .setDepth(46);
    const btnLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 300, "Got it! (Esc)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "20px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(46);
    btn.on("pointerover", () => btn.setFillStyle(0x66c98c));
    btn.on("pointerout", () => btn.setFillStyle(0x4caf72));
    btn.on("pointerdown", () => this.dismissTutorial());
    this.tutorialOverlay.push(dim, title, body, btn, btnLabel);
  }

  private dismissTutorial(): void {
    for (const obj of this.tutorialOverlay) obj.destroy();
    this.tutorialOverlay = [];
    markTutorialSeen(window.localStorage, TUTORIAL_STORAGE_KEY);
    const after = this.pendingAfterTutorial;
    this.pendingAfterTutorial = null;
    after?.();
  }

  /** Toggle the technical log overlay open or closed (the "L" hotkey). */
  private toggleTechnicalLogOverlay(): void {
    if (this.technicalLogOverlay.length > 0) this.closeTechnicalLogOverlay();
    else this.showTechnicalLogOverlay();
  }

  /**
   * KI-085/D-130: the technical log's own dedicated screen (not folded into
   * the always-on `combatLogText` line, per Kevin's explicit ask) — the last
   * 24 entries of `technicalLog`, most recent at the bottom, same dim+panel
   * shape `showTutorial` already established. Blocks board input while open
   * (see `inputLocked`), same as every other modal overlay in this scene.
   */
  private showTechnicalLogOverlay(): void {
    this.closeTechnicalLogOverlay();
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setDepth(45);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 300, "Technical Log", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "28px",
        color: "#f0e070",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(46);
    const subtitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 264, "Every attack/save roll's raw dice, bonuses, and outcome", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#9a9ab0",
      })
      .setOrigin(0.5)
      .setDepth(46);
    const recent = this.technicalLog.slice(-24);
    const bodyText = recent.length > 0 ? recent.join("\n") : "No attack or save rolls have happened yet this battle.";
    const body = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, bodyText, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#e8e8f0",
        align: "left",
        lineSpacing: 4,
        wordWrap: { width: GAME_WIDTH - 160 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(46);
    const btn = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 300, 220, 52, 0x4caf72)
      .setInteractive({ useHandCursor: true })
      .setDepth(46);
    const btnLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 300, "Close (L or Esc)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "20px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(46);
    btn.on("pointerover", () => btn.setFillStyle(0x66c98c));
    btn.on("pointerout", () => btn.setFillStyle(0x4caf72));
    btn.on("pointerdown", () => this.closeTechnicalLogOverlay());
    this.technicalLogOverlay.push(dim, title, subtitle, body, btn, btnLabel);
  }

  private closeTechnicalLogOverlay(): void {
    for (const obj of this.technicalLogOverlay) obj.destroy();
    this.technicalLogOverlay = [];
  }

  /**
   * D-152: a single small always-visible button, bottom-LEFT corner —
   * mirrors Test Mode's own Debug Menu button (bottom-right, only ever
   * visible in Test Mode), confirmed clear of every other HUD element and
   * of the centered shop/gear/debug-picker grid stack below the board.
   * Opens the pause menu; guarded the same way the Esc key already is (see
   * `openPauseMenu`'s own doc comment).
   */
  private buildPauseMenuButton(): void {
    const x = 110;
    const y = GAME_HEIGHT - 24;
    const btn = this.add
      .rectangle(x, y, 180, 36, 0x3a3a4a)
      .setInteractive({ useHandCursor: true })
      .setDepth(30);
    this.add
      .text(x, y, "Menu (Esc)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);
    btn.on("pointerover", () => btn.setFillStyle(0x4a4a5e));
    btn.on("pointerout", () => btn.setFillStyle(0x3a3a4a));
    btn.on("pointerdown", () => this.openPauseMenu());
  }

  // ----- Test Mode debug tools (D-138) ------------------------------------

  /**
   * Test Mode (D-138): a single small button, bottom-right corner — the only
   * always-visible new HUD element `this.testMode` adds. Anchored purely to
   * `GAME_WIDTH`/`GAME_HEIGHT` (not the grid), well clear of the centered
   * shop/gear/debug-picker grid stack below the board on every built-in map.
   */
  private buildDebugToolbar(): void {
    const x = GAME_WIDTH - 110;
    const y = GAME_HEIGHT - 24;
    const btn = this.add
      .rectangle(x, y, 180, 36, 0x8a3a3a)
      .setInteractive({ useHandCursor: true })
      .setDepth(30);
    this.add
      .text(x, y, "Debug Menu (F9)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#ffd8d8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);
    btn.on("pointerover", () => btn.setFillStyle(0xa04a4a));
    btn.on("pointerout", () => btn.setFillStyle(0x8a3a3a));
    btn.on("pointerdown", () => this.toggleDebugMenu());

    this.input.keyboard?.on("keydown-F9", () => {
      if ((this.inputLocked() && this.debugMenuOverlay.length === 0) || this.endOverlay.length > 0) return;
      this.toggleDebugMenu();
    });
  }

  /** Toggle the Test Mode debug menu open or closed (the "F9" hotkey, or its corner button). */
  private toggleDebugMenu(): void {
    if (this.debugMenuOverlay.length > 0) this.closeDebugMenu();
    else this.showDebugMenu();
  }

  /**
   * Test Mode (D-138): the top-level debug menu — Skip Wave, the No-Fail
   * toggle, and the three mode-select buttons (Spawn Enemy/Paint Terrain/Set
   * Status). Each mode-select button closes this menu and enters the
   * matching debug-picker `Interaction` kind, whose own grid then appears in
   * the same footprint the Shop/Gear grid already uses. Same dim+panel modal
   * shape as `showTechnicalLogOverlay`.
   */
  private showDebugMenu(): void {
    this.closeDebugMenu();
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setDepth(45);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 220, "Test Mode: Debug Menu", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "28px",
        color: "#f0e070",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(46);
    const subtitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 184, "Balance-testing tools — never available outside Test Mode", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#9a9ab0",
      })
      .setOrigin(0.5)
      .setDepth(46);
    this.debugMenuOverlay.push(dim, title, subtitle);

    const makeButton = (menuY: number, label: string, color: number, onClick: () => void): void => {
      const btn = this.add
        .rectangle(GAME_WIDTH / 2, menuY, 340, 48, color)
        .setInteractive({ useHandCursor: true })
        .setDepth(46);
      const lbl = this.add
        .text(GAME_WIDTH / 2, menuY, label, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "16px",
          color: "#0e0e14",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(46);
      btn.on("pointerover", () => btn.setAlpha(0.85));
      btn.on("pointerout", () => btn.setAlpha(1));
      btn.on("pointerdown", onClick);
      this.debugMenuOverlay.push(btn, lbl);
    };

    makeButton(GAME_HEIGHT / 2 - 120, "Skip Wave", 0x4caf72, () => this.debugSkipWave());
    makeButton(
      GAME_HEIGHT / 2 - 60,
      `No-Fail Stronghold: ${this.debugNoFailEnabled ? "ON" : "OFF"}`,
      this.debugNoFailEnabled ? 0xe0b050 : 0x8a8a4a,
      () => this.debugToggleNoFail(),
    );
    makeButton(GAME_HEIGHT / 2, "Spawn Enemy…", 0x5a6a8a, () => {
      this.closeDebugMenu();
      this.setInteraction({ kind: "debugSpawnEnemy", enemyId: DEBUG_ENEMY_IDS[0] });
    });
    makeButton(GAME_HEIGHT / 2 + 60, "Paint Terrain…", 0x5a6a8a, () => {
      this.closeDebugMenu();
      this.setInteraction({ kind: "debugPaintTerrain", tileType: DEBUG_TERRAIN_TYPES[0] });
    });
    makeButton(GAME_HEIGHT / 2 + 120, "Set Status…", 0x5a6a8a, () => {
      this.closeDebugMenu();
      this.setInteraction({ kind: "debugStatus", statusId: STATUS_EFFECT_ORDER[0] });
    });

    const closeBtn = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 200, 220, 44, 0x7a5a3a)
      .setInteractive({ useHandCursor: true })
      .setDepth(46);
    const closeLbl = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 200, "Close (F9 or Esc)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(46);
    closeBtn.on("pointerdown", () => this.closeDebugMenu());
    this.debugMenuOverlay.push(closeBtn, closeLbl);
  }

  private closeDebugMenu(): void {
    for (const obj of this.debugMenuOverlay) obj.destroy();
    this.debugMenuOverlay = [];
  }

  /**
   * Test Mode (D-138): force-clear the CURRENT wave — no reward gold (a
   * bypass, not a real clear) — then run the exact same post-clear
   * continuation a real wave-clear uses (`afterWaveCleared`): any pending
   * level-up/rest overlay, then the next wave or Victory.
   */
  private debugSkipWave(): void {
    if (this.turns.current !== "player") return;
    const cleared = [...this.waveSystem.enemies];
    this.waveSystem.forceEndWave();
    for (const enemy of cleared) this.destroyEnemyToken(enemy.instanceId);
    this.logCombat("Test Mode: wave skipped.");
    this.closeDebugMenu();
    this.afterWaveCleared();
  }

  /**
   * Test Mode (D-138): toggle whether the stronghold can ever actually
   * fall — integrity still visibly rises/falls on a breach, this only
   * suppresses the loss condition itself (`WaveSystem.isDefeated`).
   */
  private debugToggleNoFail(): void {
    this.debugNoFailEnabled = !this.debugNoFailEnabled;
    this.waveSystem.setNoFail(this.debugNoFailEnabled);
    this.logCombat(`Test Mode: No-Fail Stronghold ${this.debugNoFailEnabled ? "enabled" : "disabled"}.`);
    this.showDebugMenu(); // rebuild in place so the toggle button's own label reflects the new state
  }

  /** Test Mode (D-138): spawn the selected enemy at the clicked tile — stays in this mode for repeated spawns. */
  private handleDebugSpawnClick(tile: GridPosition): void {
    if (this.ui.kind !== "debugSpawnEnemy") return;
    const enemy = this.waveSystem.spawnAt(this.ui.enemyId, tile);
    this.spawnEnemyToken(enemy);
    this.markEnemySeen(enemy.def.id);
    this.logCombat(`Test Mode: spawned ${enemy.def.name}.`);
  }

  /**
   * Test Mode (D-138): repaint the clicked tile to the selected terrain type
   * — no placement validation (occupancy, buildability) at all, a deliberate
   * debug-tool simplification; the tester is responsible for what they
   * paint under a hero/enemy/structure. Mirrors `tickDynamicTerrain`'s own
   * live single-tile repaint exactly (mutate the SAME `GameMap.data.tiles`
   * array every system already holds a reference to, then restyle the one
   * `tileRects` entry).
   */
  private handleDebugTerrainClick(tile: GridPosition): void {
    if (this.ui.kind !== "debugPaintTerrain") return;
    const type = this.ui.tileType;
    this.map.data.tiles[tile.y][tile.x] = type;
    const rect = this.tileRects.get(`${tile.x},${tile.y}`);
    if (rect) rect.setFillStyle(BOARD_TERRAIN_COLORS[type], 1);
    const key = `${tile.x},${tile.y}`;
    const existingGlyph = this.pitGlyphs.get(key);
    if (existingGlyph) {
      existingGlyph.destroy();
      this.pitGlyphs.delete(key);
    }
    if (type === "pit") {
      const tl = this.grid.tileToWorldTopLeft(tile);
      const glyph = this.add
        .text(tl.x + this.grid.tileSize / 2, tl.y + this.grid.tileSize / 2, "✕", {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "20px",
          color: "#6a3a3a",
        })
        .setOrigin(0.5)
        .setDepth(1);
      this.pitGlyphs.set(key, glyph);
    }
    this.logCombat(`Test Mode: painted (${tile.x}, ${tile.y}) as ${type}.`);
  }

  /**
   * Test Mode (D-138): toggle the selected status on whatever hero/enemy
   * occupies the clicked tile — applies it (a fixed, long debug duration) if
   * absent, removes it early if already present. A no-op on an empty tile.
   */
  private handleDebugStatusClick(tile: GridPosition): void {
    if (this.ui.kind !== "debugStatus") return;
    const statusId = this.ui.statusId;
    const target = this.heroAt(tile) ?? this.enemyAt(tile);
    if (!target) return;
    if (target.hasStatus(statusId)) {
      target.removeStatus(statusId);
      this.logCombat(`Test Mode: cleared ${getStatusEffectDefinition(statusId).name} from ${this.debugTargetName(target)}.`);
    } else {
      target.applyStatus(statusId, DEBUG_STATUS_DURATION_TURNS);
      this.logCombat(`Test Mode: applied ${getStatusEffectDefinition(statusId).name} to ${this.debugTargetName(target)}.`);
    }
    if (target instanceof Hero) this.updateHeroStatusBadge(target);
    else this.updateStatusBadge(target);
  }

  private debugTargetName(target: Hero | Enemy): string {
    return target instanceof Hero ? target.name : target.def.name;
  }

  private showEndScreen(message: string, colorHex: string): void {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(40);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, message, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "44px",
        color: colorHex,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(41);

    // Playtest fix: the end screen used to offer only a small "press Esc"
    // text hint with no clickable control, which is easy to miss (or simply
    // not work if the browser's keyboard focus isn't on the game canvas) and
    // left players stuck looking at the win/lose screen with no visible way
    // out. A real button is now the primary path; Esc still works too.
    const buttonY = GAME_HEIGHT / 2 + 20;
    const menuButton = this.add
      .rectangle(GAME_WIDTH / 2, buttonY, 260, 56, 0x3a5a8a)
      .setInteractive({ useHandCursor: true })
      .setDepth(41);
    const menuLabel = this.add
      .text(GAME_WIDTH / 2, buttonY, "Return to Menu", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "22px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(41);
    menuButton.on("pointerover", () => menuButton.setFillStyle(0x4a6a9a));
    menuButton.on("pointerout", () => menuButton.setFillStyle(0x3a5a8a));
    menuButton.on("pointerdown", () => this.scene.start("MainMenuScene"));

    const hint = this.add
      .text(GAME_WIDTH / 2, buttonY + 46, "or press Esc  ·  then START to play again", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5)
      .setDepth(41);
    this.endOverlay.push(dim, title, menuButton, menuLabel, hint);
  }
}
