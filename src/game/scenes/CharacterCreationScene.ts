import Phaser from "phaser";
import {
  SAVE_STORAGE_KEY,
  COMPANION_ROSTER_STORAGE_KEY,
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  BLUEPRINT_LIBRARY_STORAGE_KEY,
  CHARACTER_LIBRARY_STORAGE_KEY,
} from "../config";
import { loadCampaignProgress, isCampaignCompleted } from "../systems/CampaignProgressSystem";
import { getCompanionDefinition } from "../data/companions";
import {
  loadCompanionRoster,
  saveCompanionRoster,
  getCompanionBuild,
  setCompanionBuild,
  getPcBuild,
  setPcBuild,
  getPartyInventory,
  type PartyInventoryEntry,
} from "../systems/CompanionRosterSystem";
import { visibleGearForOrigin, resolvePartyInventory } from "../systems/PartyInventorySystem";
import { seedStartingCompanions } from "../systems/CompanionSeedSystem";
import { RandomService } from "../systems/RandomService";
import {
  getViewport,
  onViewportResize,
  createOrnateButton,
  renderChoiceOverlay,
  clearChoiceOverlay,
  drawScreenBackdrop,
  drawParchmentPanel,
  FONT_DISPLAY,
  FONT_BODY,
  type OrnateButtonHandle,
} from "./uiTheme";
import {
  ABILITY_SCORE_IDS,
  ABILITY_SCORE_NAMES,
  STANDARD_ARRAY,
  modifierFor,
  type AbilityScoreId,
} from "../data/abilityScores";
import {
  CHARACTER_NAME_POOL,
  CREATABLE_CLASS_IDS,
  startingGearIdsForSlotType,
  startingGearPointCost,
  companionStartingGearForDifficulty,
} from "../data/characterCreation";
import { getAbility } from "../data/abilities";
import { getClassDefinition } from "../data/classes";
import { getSpell } from "../data/spells";
import { combatStatsForClassLevel } from "../systems/CharacterSystem";
import { cantripsKnownForClassAtLevel, spellSlotsForClassAtLevel } from "../systems/SpellcastingSystem";
import {
  spellPickStepsForClass,
  eligibleCantripPool,
  eligibleLeveledSpellPool,
  wizardSpellbookSizeAtLevel,
  preparedSpellCountForClassAtLevel,
  defaultFill,
  type SpellPickStepKind,
  type SpellSwapStepKind,
} from "../systems/SpellPreparationSystem";
import { subclassesForClass, getSubclassDefinition } from "../data/subclasses";
import {
  getEquipmentDefinition,
  gearSlotType,
  isTwoHandedWeapon,
  GEAR_SLOT_IDS,
  GEAR_SLOT_LABELS,
  type GearSlotId,
} from "../data/equipment";
import { FEAT_IDS, getFeat } from "../data/feats";
import { RACE_IDS, getRaceDefinition } from "../data/races";
import { BACKGROUND_IDS, getBackgroundDefinition, backgroundAbilityChoices } from "../data/backgrounds";
import { getSkillDefinition } from "../data/skills";
import type { HeroDefinition, HeroControlMode } from "../data/heroes";
import { Hero, MAX_CLASS_LEVEL, type MagicInitiateListId } from "../entities/Hero";
import {
  emptyLevelUpPlan,
  fastForwardHero,
  futureChoiceSteps,
  simulateHeroForPlanning,
  type LevelUpChoiceStep,
  type LevelUpPlan,
  type LevelUpPlanMode,
  type LevelUpSpellSwapChoice,
} from "../systems/LevelUpPlanSystem";
import {
  blueprintsForClass,
  deleteBlueprint,
  loadBlueprintLibrary,
  saveBlueprintLibrary,
  upsertBlueprint,
  type LevelUpBlueprint,
} from "../systems/BlueprintLibrarySystem";
import {
  MAX_LIBRARY_ENTRIES,
  deleteLibraryEntry,
  loadCharacterLibrary,
  saveCharacterLibrary,
  upsertLibraryEntry,
  type CharacterLibraryEntry,
  type CharacterLibraryState,
} from "../systems/CharacterLibrarySystem";
import { DIFFICULTY_IDS, getDifficultyDefinition, difficultyChoiceDescription, type DifficultyId } from "../data/difficulty";
import type { WaveDefinition } from "../data/waves";
import type { ParsedMap } from "../data/testMap";
import {
  StandardArrayAllocator,
  allocatorFromScores,
  PointBuyAllocator,
  pointBuyAllocatorFromScores,
  POINT_BUY_BUDGET,
  heroDefinitionFromBuild,
  hasDuplicateNames,
  subclassIdForNewBuild,
  defaultAbilityOrderForClass,
  type AbilityScoreAllocator,
  type CharacterBuild,
} from "../systems/CharacterBuildSystem";
import {
  MAX_SAVE_SLOTS,
  getSaveSlot,
  loadSaveFile,
  saveOrUpdatePartySlot,
  saveSaveFile,
  updateSaveSlot,
  type SaveFile,
} from "../systems/SaveSystem";
import { initAuth, type AuthState } from "../cloud/AuthClient";
import { pushSlot } from "../cloud/CloudSaveSync";

/**
 * CharacterCreationScene — Phase 11.1's "first pass" freeform party builder
 * (DECISIONS D-070/D-071/D-073). Lets the player build a full 4-hero party
 * (D-052's locked party size, unchanged) by, per hero: typing a name,
 * picking a class, and assigning ability scores via Standard Array (a
 * per-stat dropdown with auto-swap, Party Creation Overhaul Plan 1.1 — see
 * `StandardArrayAllocator.assign`) or Point Buy. Every class-level derived stat (HP, attack
 * damage/range) is computed live via `heroDefinitionFromBuild` and shown as
 * a preview. D-178 removed the old "pick a signature action" step — every
 * class's basic-Attack style/ability is now a fixed part of its own
 * identity (`CharacterClassDefinition.basicAttackStyle`/`primaryAbility`,
 * `data/classes.ts`), not a creation-time choice.
 *
 * This scene is now the ONLY way into a battle (`MainMenuScene`'s original
 * fixed 4-hero-roster START button and its flat Vigor/Might level-up choice
 * were removed once this builder became feature-complete — see
 * DECISIONS.md), reached via the "New Game" button, and hands BattleScene a
 * built roster via `scene.start("BattleScene", { heroDefinitions })`.
 *
 * Phase 11.2 (D-074) added a second, pickable class: Wizard, a spellcaster.
 *
 * Phase 11.3 (D-075) added a race-cycle button (all six SRD starter races)
 * and two further classes, Rogue and Cleric — all three flow through the
 * same class-cycle button, so none needed scene changes beyond the new race
 * row. A hero's race sets its `movementTiles` (Dwarf/Halfling move one tile
 * slower — see `data/races.ts`); every other race trait stays flavor-only.
 * Feats and subclasses remain deferred (recorded as class-table data, not
 * yet selectable — see `data/classes.ts` and `data/feats.ts`). Every ACTIVE
 * hero must have a distinct name (enforced before Start Battle is enabled)
 * — race is NOT required to be distinct (a full-Human party is exactly as
 * valid as a mixed one).
 *
 * Phase 11.4 (D-077) added three more controls, all fitted into the existing
 * layout rather than reshuffling it: a per-slot Human/AI toggle (folded into
 * the existing "Hero N" header — no new row, no y-shift needed), and a
 * PARTY SIZE + DIFFICULTY control pair in the gap between the slot columns
 * and Start Battle. All 4 slot columns always render (today's map has
 * exactly 4 hero-start tiles — D-077 deliberately keeps party size capped at
 * that, deferring true map flexibility to 11.7); picking a smaller party
 * size just dims and excludes the extra slots from validation and the
 * roster handed to BattleScene. Difficulty and party size both feed
 * `WaveSystem`'s enemy count/HP multiplier (see `data/difficulty.ts`) — the
 * classic fixed-roster path (MainMenuScene's START button) is unaffected,
 * since it never reaches this scene and so always plays at party-size-4,
 * Normal (1x, 1x) exactly as before this phase.
 *
 * Phase 11.8 (D-071) added an optional `campaignId` passthrough: when
 * reached from the new `CampaignSelectScene`, `init()` receives a
 * `campaignId` which is stored and forwarded unchanged to
 * `BattleScene`'s own `campaignId` data field. Reached the existing way (the
 * plain "Create Party" button on MainMenuScene, with no data), this stays
 * `undefined` — this scene's own party-building flow is otherwise identical
 * either way. D-177 added the same passthrough for `chapterIndex` —
 * `CampaignSelectScene` resolves which chapter of a chaptered campaign is
 * next before handing off here; this scene has no chapter UI of its own,
 * it's purely a relay hop on the way to `BattleScene`.
 *
 * Phase 11.9 (D-071) added the same passthrough pattern for free-play: when
 * reached from `FreePlayScene`, `init()` receives `freePlayMapId`/
 * `freePlayWaves` (the player's config, already resolved to a map id and a
 * generated wave list), stored and forwarded unchanged into `BattleScene`'s
 * own fields of the same name. `WaveDefinition[]` is plain serializable data
 * (no class instances/functions), so it's exactly as safe to pass through
 * scene-start data as `heroDefinitions` already is. `FreePlayScene` also has
 * its own difficulty picker (per D-071's spec for that screen); rather than
 * introduce a second, competing "difficulty" concept, its choice is passed
 * as an optional `difficultyId` that just pre-selects THIS scene's existing
 * difficulty control — the player can still change it here before Start
 * Battle, and this scene stays the one place that forwards the final
 * `difficultyId` to `BattleScene`, unchanged for every other path (classic/
 * campaign/campaign-less, all of which never pass this and keep defaulting
 * to "normal" exactly as before).
 *
 * Phase 9 (D-083) added local party saves: an optional `loadedSlotId`/
 * `loadedParty` passthrough, set when reached from the new `LoadGameScene`'s
 * "Load" button, seeds every slot's name/class/race/ability-scores/
 * signature-ability/control-mode from a previously saved `CharacterBuild[]`
 * instead of the usual fresh defaults (see `slotStateFromBuild`). A new
 * "Save Party" button (beside Start Battle) lets the player persist the
 * CURRENT build to a new or existing save slot at any time via the new
 * `SaveSystem`; Start Battle silently re-saves an already-loaded/saved slot
 * before starting (the "safe autosave" — it only ever touches a slot the
 * player explicitly created/loaded, never creates one on its own). A saved
 * party feeds ONLY this plain party-builder flow — it does not yet plug into
 * `CampaignSelectScene`/`FreePlayScene`'s own routes into this scene, which
 * is a deliberate scope boundary, not an oversight (see D-083).
 *
 * Phase 13.11 (D-096) — the last Phase 13 sub-phase — adds two real
 * character-creation-flow pieces on top of the existing name/class/race/
 * ability/signature-action picks: a new Gear row lets a hero pick one free
 * common/uncommon starting item (or "None") from the existing equipment
 * catalogue, granted straight into its matching slot before the first
 * battle (see `Hero`'s constructor); and a new Subclass row names a
 * level-1-choice class's subclass (Cleric/Sorcerer/Warlock), or the level a
 * later-choice class (Fighter/Wizard/Rogue/etc.) will offer its own
 * subclass confirmation at, in battle, via `BattleScene`'s subclass-choice
 * queue.
 *
 * Phase 14.2 (D-099): every class gained a second, original subclass (see
 * `data/subclasses.ts`), so the Subclass row for a level-1-choice class is
 * now a real CYCLE button — the player picks between the SRD one and the
 * original one at creation — instead of a fixed auto-assignment. A
 * later-choice class is unaffected here; its own second option shows up as
 * a second button in `BattleScene`'s existing overlay instead.
 *
 * D-147 (Character Creation overhaul, piece 1): Kevin's playtest feedback
 * called the click-to-cycle button system "sucks" and asked for a real
 * dropdown/list-style choice instead — see KI-098. Class, Race, Gear, and
 * Subclass now open a full-screen choice-picker overlay (`openChoicePicker`,
 * a thin wrapper around the existing `renderPlanPrompt` — the same overlay
 * primitive the Level Planner/Spell Picker wizards already share) listing
 * every option at once instead of cycling one at a time. Name (still a
 * cycle-through-a-preset-pool button; real free-text naming is piece 2) and
 * ability scores are unchanged in this piece.
 */

const MAX_PARTY_SIZE = 4;
const MIN_PARTY_SIZE = 1;
const COLUMN_WIDTH = 290;
const COLUMN_GAP = 10;

/**
 * D-156: takes the viewport width live instead of the old `GAME_WIDTH`-derived
 * module constant `FIRST_COLUMN_LEFT`. Every x-coordinate in this whole scene
 * (all 4 slot columns, the bottom controls, Start/Back, the wizard overlay)
 * reduces to this same shape — `width / 2 + a fixed offset` — which is what
 * lets `repositionLayout()` below handle a live resize with one constant
 * shift applied to every current child object, instead of rebuilding anything.
 */
function columnCenterX(width: number, slot: number): number {
  const firstColumnLeft = (width - (MAX_PARTY_SIZE * COLUMN_WIDTH + (MAX_PARTY_SIZE - 1) * COLUMN_GAP)) / 2;
  return firstColumnLeft + slot * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH / 2;
}

/**
 * D-202 (Plan 0.6's actual fix): a "plain" entry (Main Menu's New Game/
 * Build Party — no campaign, no Free Play/custom map) resumes the last
 * thing typed/picked here, instead of the previous "always reset to
 * CHARACTER_NAME_POOL defaults" behavior that silently discarded a typed
 * name (or any other in-progress pick) on a Back-to-Main-Menu-then-return
 * round trip. Module-level, not a class field, because the scene instance
 * itself is torn down and rebuilt by `scene.start()` — lost on a real page
 * reload (never touches `localStorage`), by design: this is a same-session
 * convenience, not a save. Reuses the exact `loadedParty` ->
 * `slotStateFromBuild` reconstruction Load Game already established,
 * sourced from `buildsFromSlots()`'s own already-tested serialization
 * instead of a real save slot — no new snapshot/restore logic needed.
 */
let lastPlainDraft: CharacterBuild[] | undefined;

interface SlotState {
  /** D-147 (piece 2): free-text hero name, editable via a DOM `<input>` (see `buildSlotUi`'s name row) — previously an index into `CHARACTER_NAME_POOL`. The pool is still used to seed a fresh slot's default. */
  name: string;
  classIndex: number;
  raceIndex: number;
  /** D-206: index into `BACKGROUND_IDS`. Defaults to 0 (a real selection, same "always some default" precedent Class/Race already use) — never an "unassigned" state. */
  backgroundIndex: number;
  /**
   * D-206: which of the current background's `abilityTriad`-derived
   * combinations (see `backgroundAbilityChoices`) was picked — undefined
   * means "not yet spent," which blocks Start Battle/Save Party exactly
   * like an unassigned Standard Array slot (D-192's precedent) so this
   * real choice is never silently defaulted. Reset to undefined whenever
   * the Background itself changes (a different triad invalidates any prior
   * pick).
   */
  backgroundAbilityChoice?: Partial<Record<AbilityScoreId, number>>;
  /** Party Creation Overhaul Plan 1.2: whichever kind matches THIS SLOT's own `abilityScoreMethod` — swapped wholesale (not converted) when this hero's own method pill is clicked. Was scene-wide/party-wide before Plan 1.2. */
  allocator: AbilityScoreAllocator;
  /** Party Creation Overhaul Plan 1.2: per-hero ability-score allocation method — was one scene-wide field before this. */
  abilityScoreMethod: "standardArray" | "pointBuy";
  controlledBy: HeroControlMode;
  /**
   * D-193 (Party Creation Overhaul Plan 2): one index per gear slot
   * (`GearSlotId`) into `startingGearIdsForSlotType(gearSlotType(slotId))`,
   * offset by 1 — 0/absent means "None" for that slot. All 10 slots are
   * independently pickable at creation (Kevin's explicit call, expanding
   * past this item's original weapon/chest/third-slot-only scope) —
   * replaces the old single `startingGearIndex`.
   */
  gearIndices: Partial<Record<GearSlotId, number>>;
  /**
   * D-194: a companion's (`identityLocked`) authored "normal"-difficulty
   * kit, snapshotted (defensive copy, never a bare reference into
   * `companions.ts`'s shared singleton) at `slotStateFromBuild` time.
   * `buildsFromSlots` recomputes this companion's ACTUAL kit fresh every
   * call via `companionStartingGearForDifficulty(baselineGearIds,
   * this.difficultyId)`, so a live Difficulty change updates it
   * immediately. Undefined for a non-companion slot — `gearIndices` above
   * is the only source of truth there.
   */
  baselineGearIds?: Partial<Record<GearSlotId, string>>;
  /**
   * Party Creation Overhaul Plan 2.3: pool entry id claimed for this gear
   * slot THIS SESSION — ephemeral, like `gearIndices`, not persisted until
   * Start Battle (see `openPoolPicker`). Wins over both a catalogue pick
   * and a companion's difficulty-trimmed baseline in `buildsFromSlots`.
   * Available to every active slot, not just companions — the PC can draw
   * from the pool too.
   */
  poolGearIds?: Partial<Record<GearSlotId, string>>;
  /**
   * Phase 14.2 (D-099): which of the current class's two modeled subclasses
   * to assign, for a level-1-choice class (Cleric/Sorcerer/Warlock) — 0 =
   * the SRD one, 1 = the original one, per `subclassesForClass`'s
   * registration order. Ignored (but harmless) for every other class, whose
   * subclass choice happens later, in battle.
   */
  subclassIndex: number;
  /** D-129: a pre-battle class level (1-20) to fast-forward to before wave 1 — see `BattleScene.fastForwardHeroToLevel`. */
  startingLevel: number;
  /** D-133: this hero's level-up planner blueprint — see `openLevelPlanner`. Defaults to "fresh" (no plan), identical to every pre-D-133 build. */
  levelUpPlan: LevelUpPlan;
  /**
   * D-135: this hero's manually-picked starting prepared leveled spells/
   * known cantrips/(Wizard) spellbook — see `openSpellPicker`. Each field
   * undefined means "keep `Hero.growSpellSelections()`'s silent auto-fill,"
   * identical to every pre-D-135 build.
   */
  spellPicks: { cantripIds?: string[]; leveledSpellIds?: string[]; spellbookIds?: string[] };
  /**
   * KI-098 item 13 (companion roster, Phase 1): true for a companion-
   * prefilled slot in campaign mode — class/race stay fixed to the
   * companion's own identity, and spells/hotkeys/starting level stay fully
   * editable, same as any other slot. Party Creation Overhaul Plan 3.2:
   * ALSO true for a returning PC (slot 0) once a persisted `pcBuild` exists
   * for this playthrough — identity is frozen the same way. Guards
   * Class/Race only — see `gearLocked`/`abilityScoreLocked` below for the
   * two places PC and companion locking (and, for 3.4, one companion vs.
   * another) diverge; `identityLocked` alone can no longer answer "is this
   * slot's ability score editable."
   */
  identityLocked: boolean;
  /**
   * Party Creation Overhaul Plan 3.2: whether GEAR specifically is locked to
   * a fixed/economy-derived kit. For a companion this is always equal to
   * `identityLocked` (D-194: a real campaign companion never gets a free
   * player-editable kit). For a returning PC (identity-locked once a
   * persisted `pcBuild` exists) this stays false — the PC's gear/spells/
   * level-plan/name remain editable "like a normal PC always could," only
   * class/race/ability-scores freeze. Split into its own field because
   * `identityLocked` alone can't distinguish "companion" from "returning
   * PC" for the Gear button/`baselineGearIds`/`buildsFromSlots` checks that
   * only ever wanted the companion behavior.
   */
  gearLocked: boolean;
  /**
   * Party Creation Overhaul Plan 3.4: whether ABILITY SCORES specifically
   * are locked. Equal to `identityLocked` for a returning PC (unchanged —
   * a PC's stats freeze the same as class/race, Plan 3.4 doesn't touch the
   * PC) and for a companion whose campaign hasn't been completed yet. For a
   * companion once `this.campaignId` has been fully cleared at least once
   * (`isCampaignCompleted`), this is false while `identityLocked` stays
   * true — class/race stay fixed to the companion's identity, but ability
   * scores become player-customizable, Kevin's own "completing a campaign
   * unlocks stat customization for its companions" reward. Split into its
   * own field for the same reason `gearLocked` was: `identityLocked` can't
   * distinguish "still locked" from "unlocked by 3.4" on its own.
   */
  abilityScoreLocked: boolean;
}

interface SlotWidgets {
  /** Party Creation Overhaul Plan 8: the Human/AI toggle, now an ornate button — its handle owns both the plaque and the label together. */
  controlHandle: OrnateButtonHandle;
  /** D-147 (piece 2): a real DOM `<input>`, not a Text label — its own value is read live on each "input" event, not re-set by `refreshSlot`. */
  nameInput: Phaser.GameObjects.DOMElement;
  /** The raw `<input>` node inside `nameInput`, kept separately so `setSlotActive` can toggle `.disabled` — a Phaser `Rectangle`'s `disableInteractive` doesn't apply to a real HTML element. */
  nameInputNode: HTMLInputElement;
  classHandle: OrnateButtonHandle;
  raceHandle: OrnateButtonHandle;
  /** D-206: opens the Background picker. */
  backgroundHandle: OrnateButtonHandle;
  /** D-206: opens the ability-bonus-choice picker (7 combinations of the current background's triad). */
  backgroundAbilityHandle: OrnateButtonHandle;
  /** Party Creation Overhaul Plan 1.2: this hero's own Standard Array/Point Buy toggle pill — replaces the old single party-wide button. */
  abilityMethodHandle: OrnateButtonHandle;
  /** Standard Array mode: one dropdown-trigger ornate button per ability, label IS the score text (Party Creation Overhaul Plan 1.1: opens a per-value dropdown instead of cycling). */
  standardArrayHandles: Record<AbilityScoreId, OrnateButtonHandle>;
  /**
   * Point Buy mode: a plain, non-clickable value readout between the
   * minus/plus buttons — `createOrnateButton` owns its label internally, so
   * once the ability score row's Standard-Array button and Point-Buy
   * steppers are all real ornate buttons, they can no longer share one Text
   * object riding on the row; this is Point Buy's own copy of the same
   * score text.
   */
  pointBuyValueLabels: Record<AbilityScoreId, Phaser.GameObjects.Text>;
  /** D-147 (piece 3): the six Standard-Array dropdown-trigger row handles — visible/interactive only while this hero's own method (Plan 1.2) is "standardArray". */
  standardArrayRowButtons: OrnateButtonHandle[];
  /** D-147 (piece 3): the twelve Point-Buy +/- handles (one pair per ability) — visible/interactive only while this hero's own method is "pointBuy". */
  pointBuyButtons: OrnateButtonHandle[];
  gearHandle: OrnateButtonHandle;
  /** Party Creation Overhaul Plan 2.3: "draw from the shared party inventory pool" — half-width, sharing `gearY`'s row with `gearHandle` (narrowed to match) rather than its own row, since every Y constant below cascades off `gearY`. Hidden entirely outside campaign mode. */
  poolHandle: OrnateButtonHandle;
  subclassHandle: OrnateButtonHandle;
  statsLabel: Phaser.GameObjects.Text;
  levelHandle: OrnateButtonHandle;
  /** D-133: the "Plan Levels" row — see `openLevelPlanner`. Party Creation Overhaul Plan 6.4: now half-width, sharing `planY` with `cadenceHandle` (D-133's old Auto/Prompted/Fresh mode picker, decoupled from the wizard). */
  planHandle: OrnateButtonHandle;
  /** Party Creation Overhaul Plan 6.4: the Auto/Prompted/Fresh cadence toggle, decoupled from "which plan" (`planHandle`) — click-cycles, locked to Auto (disabled) for an AI-controlled hero, same hard rule as D-198's Human/AI toggle. */
  cadenceHandle: OrnateButtonHandle;
  /** D-135: the "Spells" row — see `openSpellPicker`. */
  spellsHandle: OrnateButtonHandle;
  /** D-204: the "Save Character"/"Load Character" row — see `CharacterLibrarySystem`. */
  saveCharacterHandle: OrnateButtonHandle;
  loadCharacterHandle: OrnateButtonHandle;
  /** Playtest fix (Party Creation Overhaul, Plan 0): Point Buy's "Points Left" readout, now its own row instead of riding on the STR label. */
  pointsLeftLabel: Phaser.GameObjects.Text;
  /** Every GameObject this slot created, for dimming an inactive (beyond party size) slot. */
  allObjects: Phaser.GameObjects.GameObject[];
  /** The interactive handles among `allObjects`, for disabling an inactive slot's clicks. */
  interactiveButtons: OrnateButtonHandle[];
}

export class CharacterCreationScene extends Phaser.Scene {
  private slots: SlotState[] = [];
  private widgets: SlotWidgets[] = [];
  private startHandle!: OrnateButtonHandle;
  private statusText!: Phaser.GameObjects.Text;
  private partyValid = false;
  private partySize = MAX_PARTY_SIZE;
  private difficultyId: DifficultyId = "normal";
  private partySizeHandle!: OrnateButtonHandle;
  private difficultyHandle!: OrnateButtonHandle;
  /** D-129: the "set every slot's Starting Level at once" control — see `buildTeamLevelControl`. */
  private teamLevelValue = 1;
  private teamLevelHandle!: OrnateButtonHandle;
  /**
   * Party Creation Overhaul Plan 1.1: the single open ability-score dropdown
   * (at most one at a time — opening a new one closes whichever was open).
   * `null` when none is open.
   */
  private openDropdown: { close: () => void } | null = null;
  /** Phase 11.8 (D-071): forwarded unchanged to BattleScene; `undefined` when
   * reached via the plain "Create Party" button (no campaign selected). */
  private campaignId?: string;
  /** D-177: the chaptered campaign's chapter to play, forwarded unchanged to BattleScene; `undefined` for a flat/non-chaptered campaign or no campaign at all. */
  private chapterIndex?: number;
  /**
   * D-18x (KI-098 item 13, the "unlock mission must include them" rule):
   * set only when reached from `UnlockMissionPartyScene` — the exact 3
   * companion ids (in slot order: the unlock target, then the player's own
   * two free picks) to fill slots 2-4 with, overriding the normal "3 active
   * roster" auto-fill below. `undefined` for every other campaign entry
   * (a normal chapter replay, the Prologue, Free Play, Co-op, a loaded save).
   */
  private requiredCompanionIds?: string[];
  /**
   * Party Creation Overhaul Plan 3.1: which companion id (if any) each slot
   * was prefilled from — the write side of persisted companion builds needs
   * this at Start Battle time to know which roster entry to update.
   * `undefined` at slot 0 always (the PC is tracked via `setPcBuild`, not
   * this map) and at every slot for Free Play/a plain "Create Party" run.
   */
  private companionIdForSlot: (string | undefined)[] = [];
  /**
   * Party Creation Overhaul Plan 2.3: the shared party inventory pool as of
   * this scene's own `create()` — read once, alongside the same roster load
   * companion prefill already does (no second `localStorage` read). Used by
   * `openPoolPicker`/`buildsFromSlots` to source "draw from pool" options;
   * always empty for Free Play (no `campaignId`, no roster/pool concept).
   */
  private partyInventorySnapshot: PartyInventoryEntry[] = [];
  /** Phase 11.9 (D-071): forwarded unchanged to BattleScene; `undefined`
   * unless reached from `FreePlayScene`. */
  private freePlayMapId?: string;
  private freePlayWaves?: WaveDefinition[];
  /** Phase 11.10 (D-085): forwarded unchanged to BattleScene; set only when
   * reached from `MapBuilderScene`'s Playtest button or `BrowseSharedMapsScene`. */
  private customMapData?: ParsedMap;
  /** Test Mode (D-138): forwarded unchanged to BattleScene; set only when
   * reached from `TestModeScene`. */
  private testMode = false;
  /** Phase 9 (D-083): the save slot this party was loaded from/saved to, if any. */
  private loadedSlotId?: string;
  private loadedParty?: CharacterBuild[];
  private saveFile!: SaveFile;
  /** Phase 10 (D-084): tracked so a save can be mirrored to the cloud when signed in with Google. */
  private authState: AuthState = { uid: null, isAnonymous: true, displayName: null };
  private savePartyHandle!: OrnateButtonHandle;
  private saveStatusLabel!: Phaser.GameObjects.Text;

  /**
   * D-133: the "Plan Levels" wizard overlay's own working state — separate
   * from `slots[slot].levelUpPlan`, which only gets overwritten on a
   * confirmed "Save & Close" (see `closeLevelPlanner`). `planningSlot` is
   * non-null exactly while the overlay is shown.
   */
  private levelPlanOverlay: Phaser.GameObjects.GameObject[] = [];
  private planningSlot: number | null = null;
  private planningDraft: LevelUpPlan = emptyLevelUpPlan();
  private planningSteps: LevelUpChoiceStep[] = [];
  private planningStepIndex = 0;
  /**
   * Party Creation Overhaul Plan 6.2/6.3: which saved blueprint (if any)
   * `planningDraft` was loaded from via "Select a Saved Blueprint" → Edit —
   * `undefined` for "Create a New Blueprint"/"No Blueprint". Wizard-session-
   * scoped only (like `planningDraft` itself), never persisted — reopening
   * Plan Levels always starts fresh at `showBlueprintEntryChoice`. Drives
   * `showBlueprintSaveScreen`'s "Update" vs. "Save as New" choice.
   */
  private planningBlueprintId: string | undefined = undefined;
  /** Plan 6.2: which blueprint's Delete button is armed (two-click confirm, no timer — reset by navigating to any other button in the same submenu). */
  private blueprintDeleteArmedId: string | null = null;
  /** Plan 6.3: a fresh blueprint's synthetic id — `Date.now()` plus this (incremented per save) breaks a same-millisecond tie, same idiom `CompanionRosterScene.onUnequipAllClicked` already uses for pool-entry ids. */
  private blueprintSaveCounter = 0;

  /** D-204: the global per-character library (see `CharacterLibrarySystem`) — loaded once in `create()`, same treatment as `saveFile`. */
  private characterLibrary!: CharacterLibraryState;
  /** D-204: which library entry's Delete button is armed (two-click confirm, no timer) — same idiom as `blueprintDeleteArmedId`. */
  private libraryDeleteArmedId: string | null = null;
  /** D-204: a fresh library entry's synthetic id — same idiom as `blueprintSaveCounter`. */
  private librarySaveCounter = 0;

  /**
   * D-135: the "Spells" wizard overlay's own working state — reuses
   * `levelPlanOverlay`/`renderPlanPrompt`/`clearLevelPlanOverlay` above (both
   * wizards are never open at once, and that rendering machinery is already
   * fully generic — title + a choices array — with no `LevelUpPlan`-specific
   * typing in it). `spellPickSlot` is non-null exactly while this overlay is
   * shown.
   */
  private spellPickSlot: number | null = null;
  private spellPickDraft: { cantripIds: string[]; leveledSpellIds: string[]; spellbookIds: string[] } = {
    cantripIds: [],
    leveledSpellIds: [],
    spellbookIds: [],
  };
  private spellPickSteps: SpellPickStepKind[] = [];
  private spellPickStepIndex = 0;

  /**
   * D-156: the viewport width `create()` laid this scene out against. Every
   * x-coordinate in this scene is `width / 2 + a fixed offset` (see
   * `columnCenterX`'s own comment), so a live resize just shifts every
   * current child object's `x` by `(newWidth - this) / 2` — see
   * `repositionLayout()` — rather than destroying and rebuilding anything
   * (this scene has 4 persistent DOM `<input>` name fields that would lose
   * typed text and focus if rebuilt, the same constraint `CoopLobbyScene`
   * and `MapBuilderScene` already established their own reposition-in-place
   * mechanisms for).
   */
  private viewportWidthAtLastLayout = 0;

  constructor() {
    super("CharacterCreationScene");
  }

  init(data?: {
    campaignId?: string;
    chapterIndex?: number;
    requiredCompanionIds?: string[];
    freePlayMapId?: string;
    freePlayWaves?: WaveDefinition[];
    difficultyId?: DifficultyId;
    loadedSlotId?: string;
    loadedParty?: CharacterBuild[];
    customMapData?: ParsedMap;
    testMode?: boolean;
  }): void {
    this.campaignId = data?.campaignId;
    this.chapterIndex = data?.chapterIndex;
    this.requiredCompanionIds = data?.requiredCompanionIds;
    this.freePlayMapId = data?.freePlayMapId;
    this.freePlayWaves = data?.freePlayWaves;
    this.difficultyId = data?.difficultyId ?? "normal";
    this.loadedSlotId = data?.loadedSlotId;
    this.loadedParty = data?.loadedParty;
    this.customMapData = data?.customMapData;
    this.testMode = data?.testMode ?? false;

    // D-202: see `lastPlainDraft`'s own doc comment. Only kicks in when
    // this visit didn't already bring its own party (Load Game already
    // won above).
    if (!this.loadedParty && this.isPlainEntry()) {
      this.loadedParty = lastPlainDraft;
    }
  }

  /** D-202: no campaign, no Free Play/custom map — Main Menu's "New Game"/"Build Party", the only entry points `lastPlainDraft` applies to. */
  private isPlainEntry(): boolean {
    return !this.campaignId && !this.freePlayMapId && !this.customMapData;
  }

  create(): void {
    // D-162 precedent (see `MainMenuScene.create()`): re-syncs the
    // ScaleManager's tracked size against the real canvas/parent element on
    // every entry. This scene has the most real DOM `<input>` elements (the
    // 4 hero-name fields) of any scene — D-162's own finding was that a
    // canvas/ScaleManager desync leaves DOM elements positioned correctly
    // while the CANVAS content around them is squished/shifted, which would
    // read exactly like "the name fields are floating in the wrong place."
    // Cheap and harmless if the scale state was already correct; unconfirmed
    // like D-162's own mitigation — flag to Kevin whether this helps.
    this.scale.refresh();

    this.slots = [];
    this.widgets = [];
    this.saveFile = loadSaveFile(window.localStorage, SAVE_STORAGE_KEY);
    this.characterLibrary = loadCharacterLibrary(window.localStorage, CHARACTER_LIBRARY_STORAGE_KEY);
    initAuth((state) => (this.authState = state));

    // Party Creation Overhaul Plan 8: the ornate/parchment theme (D-123),
    // same recipe CompendiumScene/MainMenuScene already use. Deliberately no
    // `spawnAmbientMotes` here — this is a dense, click-heavy data-entry
    // screen, same category CompendiumScene reasoned motes out of.
    drawScreenBackdrop(this);
    const width = getViewport(this).width;
    this.viewportWidthAtLastLayout = width;

    this.add
      .text(width / 2, 42, "BUILD YOUR PARTY", {
        fontFamily: FONT_DISPLAY,
        fontSize: "34px",
        color: "#f0dfa8",
        fontStyle: "bold",
        letterSpacing: 2 as unknown as number,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    this.add
      .text(
        width / 2,
        76,
        "Type a hero's name directly. Click a class, race, gear, or subclass to choose from a list. In Standard Array mode, click an ability score to pick its value from a dropdown; in Point Buy, use the +/- buttons.",
        { fontFamily: FONT_BODY, fontSize: "15px", color: "#b8a074", fontStyle: "italic" },
      )
      .setOrigin(0.5)
      .setDepth(1);

    // KI-098 item 13 (companion roster, Phase 1): campaign mode's party is
    // slot 1 (the player-built hero) plus the roster's 3 active companions
    // in slots 2-4 — never for Free Play/a plain "Create Party" run.
    // Seeding here defends against reaching this scene without going
    // through CampaignSelectScene first (e.g. Load Game), and guarantees
    // the roster is settled before slot-building below ever reads it — no
    // async gap.
    //
    // D-201: this metadata (which slot maps to which companion) now runs
    // regardless of `loadedParty` — it's needed for `identityLocked`/
    // `gearLocked` below and for Start Battle's roster write-back
    // (`this.companionIdForSlot`), NOT just for supplying build VALUES. A
    // loaded save's own values still win (`loadedBuild` below prefers
    // `this.loadedParty` over `companionBuildsForSlots`) — this only fixes
    // a reloaded campaign party (from `LoadGameScene`) losing its
    // companion lock/gear-pool/point-buy behavior entirely. `roster`'s own
    // `seedStartingCompanions` call is idempotent (no-ops once the roster
    // is no longer default), so re-running it on every campaign visit,
    // loaded or not, is safe.
    const companionBuildsForSlots: (CharacterBuild | undefined)[] = [];
    this.companionIdForSlot = [];
    if (this.campaignId) {
      // Party Creation Overhaul Plan 2.3: read the pool snapshot from the
      // SAME roster load the companion prefill below already needs — no
      // second `localStorage` read.
      const roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
      this.partyInventorySnapshot = getPartyInventory(roster);

      // Party Creation Overhaul Plan 3.1: prefer a persisted build (this
      // playthrough's own edited gear/spells/level-plan/name) over the
      // static catalogue whenever one exists — falls back to the catalogue
      // build for a companion never yet used in a party this playthrough.
      companionBuildsForSlots[0] = getPcBuild(roster);
      // D-18x (KI-098 item 13, "unlock mission must include them"):
      // `UnlockMissionPartyScene` already resolved the exact 3 companions
      // for slots 2-4 (the unlock target plus the player's own 2 free
      // picks) — use those verbatim instead of the normal active-roster
      // auto-fill below, which would silently drop the not-yet-recruited
      // target companion.
      if (this.requiredCompanionIds && this.requiredCompanionIds.length > 0) {
        this.requiredCompanionIds.forEach((id, i) => {
          companionBuildsForSlots[i + 1] = getCompanionBuild(roster, id) ?? getCompanionDefinition(id).build;
          this.companionIdForSlot[i + 1] = id;
        });
      } else {
        const seededRoster = seedStartingCompanions(roster, RandomService.seeded());
        saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, seededRoster);
        seededRoster.activeIds.forEach((id, i) => {
          companionBuildsForSlots[i + 1] = getCompanionBuild(seededRoster, id) ?? getCompanionDefinition(id).build;
          this.companionIdForSlot[i + 1] = id;
        });
      }
    }

    // Party Creation Overhaul Plan 3.4: once this campaign has been fully
    // cleared at least once, companions get their ability-score lock lifted
    // (class/race stay fixed to their identity — only stats become
    // customizable). Computed once outside the loop since `this.campaignId`
    // is fixed for the scene's lifetime; `false` for Free Play/no campaign.
    const campaignCompleted = this.campaignId
      ? isCampaignCompleted(loadCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY), this.campaignId)
      : false;

    for (let slot = 0; slot < MAX_PARTY_SIZE; slot++) {
      const loadedBuild = this.loadedParty?.[slot] ?? companionBuildsForSlots[slot];
      // D-201: no longer gated on `!this.loadedParty` — a reloaded campaign
      // party (`loadedParty` AND `campaignId` both set, via Load Game) must
      // lock exactly like a fresh campaign entry. Harmless for a loaded
      // classic/Free Play party: `companionBuildsForSlots` stays empty
      // there since the block above only populates it `if (this.campaignId)`.
      const identityLocked = companionBuildsForSlots[slot] !== undefined;
      // Party Creation Overhaul Plan 3.2: a returning PC (slot 0) has its
      // identity locked just like a companion, but its gear/spells/
      // level-plan/name must stay editable — only a companion's gear is
      // ever locked to D-194's fixed economy kit.
      const gearLocked = identityLocked && slot !== 0;
      // Party Creation Overhaul Plan 3.4: a companion's (never the PC's —
      // 3.4 doesn't apply to slot 0) ability-score lock lifts once this
      // campaign has been fully cleared once.
      const abilityScoreLocked = identityLocked && !(slot !== 0 && campaignCompleted);
      // Party Creation Overhaul Plan 3.1: the companion's TRUE authored
      // baseline kit always comes from the static catalogue, never from a
      // persisted build (which may already be a difficulty-trimmed copy
      // from a previous visit) — otherwise D-194's difficulty-scaling
      // economy would double-apply against an already-trimmed kit.
      const companionId = this.companionIdForSlot[slot];
      const catalogueGearIds = companionId ? getCompanionDefinition(companionId).build.startingGearIds : undefined;
      this.slots.push(
        loadedBuild
          ? this.slotStateFromBuild(loadedBuild, identityLocked, gearLocked, catalogueGearIds, abilityScoreLocked)
          : {
              identityLocked: false,
              gearLocked: false,
              abilityScoreLocked: false,
              name: CHARACTER_NAME_POOL[slot % CHARACTER_NAME_POOL.length],
              classIndex: 0,
              raceIndex: 0,
              // D-206: a fresh slot always has a real Background selected
              // (index 0, same "never unassigned" precedent as Class/Race)
              // but no ability-bonus choice spent yet — see `SlotState`'s
              // own comment.
              backgroundIndex: 0,
              backgroundAbilityChoice: undefined,
              // D-204: a fresh slot's Standard Array defaults to slot 0's own
              // class (`CREATABLE_CLASS_IDS[0]`) rather than the flat
              // identity order — see `defaultAbilityOrderForClass`.
              allocator: new StandardArrayAllocator(defaultAbilityOrderForClass(CREATABLE_CLASS_IDS[0])),
              abilityScoreMethod: "standardArray",
              // D-129: default to 1 human, the rest AI-controlled — Kevin's
              // own request, so a fresh party is playtest-ready without
              // manually toggling three slots every time. Loading a saved
              // party (`slotStateFromBuild`, below) still uses whatever
              // control mix was actually saved, unaffected by this default.
              controlledBy: slot === 0 ? "human" : "ai",
              gearIndices: {},
              subclassIndex: 0,
              startingLevel: 1,
              // Party Creation Overhaul Plan 5.1 (D-198): an AI-controlled
              // slot starts on "auto" mode (the hard-rule-only-legal mode
              // for AI — the `cadenceHandle` toggle stays disabled/forced to
              // it, Plan 6.4) instead of "fresh" — matches the default
              // `controlledBy` set above.
              levelUpPlan: emptyLevelUpPlan(slot === 0 ? "fresh" : "auto"),
              spellPicks: {},
            },
      );
      this.widgets.push(this.buildSlotUi(width, slot));
    }
    if (this.loadedParty) {
      this.partySize = Math.min(MAX_PARTY_SIZE, Math.max(MIN_PARTY_SIZE, this.loadedParty.length));
    }
    // KI-098 item 13 (companion roster, Phase 1): a smaller campaign party
    // has no clean meaning once slots 2-4 are fixed companion slots — force
    // the full 4. Free Play's own 1-4 range (the `if (this.loadedParty)`
    // branch above, and the party-size picker itself) is untouched.
    if (this.campaignId) this.partySize = MAX_PARTY_SIZE;

    this.buildBottomControls(width);
    this.buildStartButton(width);
    this.buildBackButton();
    this.refreshAll();

    onViewportResize(this, () => this.repositionLayout());
  }

  /**
   * D-156: shifts every current child object's `x` by however much the
   * viewport's center has moved — correct for every object in this scene
   * (see `columnCenterX`'s comment) without destroying/rebuilding anything,
   * so the 4 name `<input>`s keep their typed text and keyboard focus. A
   * no-op under today's `Scale.FIT` (the viewport width never actually
   * changes), same as every other D-154/D-155/D-156 conversion.
   *
   * Known limitation: if the wizard overlay (`renderPlanPrompt`) happens to
   * be open at the exact moment a resize fires, its dim backdrop's WIDTH/
   * HEIGHT (not just position) would need updating too to stay full-screen —
   * this shift only moves it, since it reads live `getViewport(this)` sizing
   * only when freshly (re)drawn. Self-heals the instant the player clicks
   * any option, which redraws it from scratch at the current size. Not worth
   * a dedicated fix while `Scale.RESIZE` isn't live yet.
   */
  private repositionLayout(): void {
    const newWidth = getViewport(this).width;
    const shift = (newWidth - this.viewportWidthAtLastLayout) / 2;
    if (shift === 0) return;
    for (const obj of this.children.list) {
      // Anchored to the left edge (like every other scene's top-left Back
      // button), not to the viewport center — must stay put, not shift.
      if (obj.name === "back-button-anchor") continue;
      const positionable = obj as unknown as { x?: unknown };
      if (typeof positionable.x === "number") (positionable as { x: number }).x += shift;
    }
    this.viewportWidthAtLastLayout = newWidth;
  }

  private buildSlotUi(width: number, slot: number): SlotWidgets {
    const x = columnCenterX(width, slot);
    const allObjects: Phaser.GameObjects.GameObject[] = [];
    const interactiveButtons: OrnateButtonHandle[] = [];

    // Party Creation Overhaul Plan 8: the column backdrop is now a real
    // parchment panel (`drawParchmentPanel`, depth 5) instead of a flat dark
    // rectangle — every button below defaults to depth 10, so it naturally
    // renders on top with no extra work. Top edge stays fixed at y105 (the
    // KI-083 convention every prior row addition preserved); height grew to
    // 680 (was 650) and centerY to 445 (was 430) to keep pace with the
    // taller ornate rows below (see `gearY`/`subclassY`/etc.).
    const background = drawParchmentPanel(this, x, 445, COLUMN_WIDTH, 680, 5);
    allObjects.push(background);

    // Phase 11.4 (D-077): the old plain "Hero N" label became a clickable
    // Human/AI toggle in the SAME spot, so no other row on this slot moves.
    // Party Creation Overhaul Plan 8: height 26 -> 32 (ornate buttons need
    // more room than a bare rectangle).
    const controlHandle = createOrnateButton(
      this,
      x,
      130,
      COLUMN_WIDTH - 20,
      32,
      "",
      () => {
        const s = this.slots[slot];
        s.controlledBy = s.controlledBy === "human" ? "ai" : "human";
        // Party Creation Overhaul Plan 5.1 (D-198): the hard rule — an
        // AI-controlled hero's level-up mode is always "auto" (the
        // `cadenceHandle` pill, Plan 6.4, stays disabled/forced to it too).
        // Forced here too, not just at slot creation, so toggling Human ->
        // AI on an already-built hero can't leave it on Prompted/Fresh with
        // nobody there to answer it. Toggling back to
        // Human leaves the mode as "auto" rather than reverting it — the
        // player can freely repick via the `cadenceHandle` pill if they
        // want prompts back.
        if (s.controlledBy === "ai") s.levelUpPlan = { ...s.levelUpPlan, mode: "auto" };
        this.refreshAll();
      },
      { variant: "tab" },
    );
    allObjects.push(controlHandle.container);
    interactiveButtons.push(controlHandle);

    // D-147 (piece 2): a real DOM `<input>` (this project's second use of one
    // — see `CoopLobbyScene`'s join-code field, KI-062, for the first and
    // `main.ts`'s `dom.createContainer` config both rely on). The starting
    // value is set as a JS property, not baked into the HTML string, so a
    // loaded save's name can't break/inject into the markup. Typing updates
    // `s.name` live and re-runs `refreshAll` (for duplicate/blank-name
    // validation) but never writes back INTO the input itself, so the
    // player's cursor position/selection is never disturbed mid-edit.
    // Party Creation Overhaul Plan 8: cosmetic-only colors so the field sits
    // on the new parchment backdrop instead of the old dark panel — no
    // behavior change.
    const nameInput = this.add
      .dom(
        x,
        165,
      )
      .createFromHTML(
        `<input type="text" maxlength="24" placeholder="Hero Name" style="
          width: ${COLUMN_WIDTH - 20}px; height: 34px; font-size: 16px;
          font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; font-weight: bold;
          text-align: center; background: #e8d8ae; color: #2a1a10;
          border: 1px solid #5a3a20; border-radius: 4px; outline: none;
          box-sizing: border-box;
        " />`,
      )
      .setOrigin(0.5)
      .setDepth(10);
    const nameNode = nameInput.node.querySelector("input") as HTMLInputElement;
    nameNode.value = this.slots[slot].name;
    nameNode.addEventListener("input", () => {
      this.slots[slot].name = nameNode.value;
      this.refreshAll();
    });
    nameNode.addEventListener("keydown", (e: KeyboardEvent) => e.stopPropagation());
    // Party Creation Overhaul Plan 1.1: a click landing on a real DOM
    // `<input>` doesn't reach the dropdown's own full-canvas Phaser catcher
    // rectangle (DOM elements sit outside Phaser's pointer pipeline) — close
    // explicitly on focus so a stray dropdown never gets left open/orphaned.
    nameNode.addEventListener("focus", () => this.closeDropdown());

    const classHandle = createOrnateButton(
      this,
      x,
      200,
      COLUMN_WIDTH - 20,
      32,
      "",
      () => {
        const s = this.slots[slot];
        if (s.identityLocked) return;
        this.openChoicePicker(
          "Choose a Class",
          CREATABLE_CLASS_IDS.map((id, i) => ({
            label: getClassDefinition(id).name,
            // D-147 (piece 4): a one-sentence "what does this class play
            // like" preview, shown right on the picker so the player doesn't
            // have to leave Character Creation to find out.
            desc: getClassDefinition(id).previewSummary,
            highlighted: i === s.classIndex,
            onPick: () => {
              s.classIndex = i;
              // D-133: a different class has an entirely different choice ladder —
              // a stale plan would be meaningless at best, wrong at worst.
              s.levelUpPlan = emptyLevelUpPlan();
              // D-135: same reasoning — a different class has an entirely different
              // spell list, so a stale manual pick would be meaningless too.
              s.spellPicks = {};
              // D-193: gear picks are NOT reset on class change — every slot's
              // pool is class-independent (no class gating on any item).
            },
          })),
        );
      },
      { variant: "tab" },
    );

    const raceHandle = createOrnateButton(
      this,
      x,
      233,
      COLUMN_WIDTH - 20,
      32,
      "",
      () => {
        const s = this.slots[slot];
        if (s.identityLocked) return;
        // D-147 (piece 5): each option's desc shows what's actually real
        // (speed, flavor traits) — deliberately no invented ability-score
        // bonus. SRD 5.2.1 moved ability-score increases from Race to
        // Background (D-206, see the Background row below) — no race grants
        // one here, by design, not a gap.
        this.openChoicePicker(
          "Choose a Race — ability-score increases come from Background now, see the row below.",
          RACE_IDS.map((id, i) => {
            const race = getRaceDefinition(id);
            return {
              label: race.name,
              desc: `Speed: ${race.speedTiles} tiles/turn · ${race.traits.map((t) => t.name).join(", ")}`,
              highlighted: i === s.raceIndex,
              onPick: () => {
                s.raceIndex = i;
              },
            };
          }),
        );
      },
      { variant: "tab" },
    );

    // D-206: Background — half-width split with its ability-bonus choice,
    // same `rowGap`/`halfWidth` technique as Gear|Pool and Plan Levels|
    // Cadence elsewhere in this file (computed locally since the shared
    // `rowGap`/`halfWidth` consts below are declared later in this method).
    // Playtest fix: 6 -> 10. At 6px the two buttons' bronze borders sat close
    // enough to read as a stray vertical line between "Background: X" and
    // "Ability Bonus: Y" rather than a clear gap.
    const bgRowGap = 10;
    const bgHalfWidth = (COLUMN_WIDTH - 20 - bgRowGap) / 2;
    const backgroundY = 266;
    const backgroundHandle = createOrnateButton(
      this,
      x - bgHalfWidth / 2 - bgRowGap / 2,
      backgroundY,
      bgHalfWidth,
      32,
      "",
      () => {
        const s = this.slots[slot];
        if (s.identityLocked) return;
        this.openChoicePicker(
          "Choose a Background",
          BACKGROUND_IDS.map((id, i) => {
            const bg = getBackgroundDefinition(id);
            return {
              label: bg.name,
              desc: `${bg.skillIds.map((sid) => getSkillDefinition(sid).name).join(", ")} · ${bg.abilityTriad
                .map((a) => ABILITY_SCORE_NAMES[a])
                .join("/")} · ${getFeat(bg.originFeatId).name}`,
              highlighted: i === s.backgroundIndex,
              onPick: () => {
                s.backgroundIndex = i;
                // A different background has a different ability triad — any
                // prior ability-bonus pick no longer makes sense.
                s.backgroundAbilityChoice = undefined;
                // Pre-fill the background's starting weapon, ONLY if that
                // slot is still empty — visible and freely changeable
                // afterward, never a silent overwrite of the player's own pick.
                if (bg.startingWeaponId && !s.gearIndices.weapon) {
                  const pool = startingGearIdsForSlotType(gearSlotType("weapon"));
                  const index = pool.indexOf(bg.startingWeaponId);
                  if (index >= 0) s.gearIndices.weapon = index + 1;
                }
              },
            };
          }),
        );
      },
      { variant: "tab" },
    );
    const backgroundAbilityHandle = createOrnateButton(
      this,
      x + bgHalfWidth / 2 + bgRowGap / 2,
      backgroundY,
      bgHalfWidth,
      32,
      "",
      () => {
        const s = this.slots[slot];
        if (s.abilityScoreLocked) return;
        const background = getBackgroundDefinition(BACKGROUND_IDS[s.backgroundIndex]);
        this.openChoicePicker(
          "Choose the Background's Ability Bonus",
          backgroundAbilityChoices(background.abilityTriad).map((choice) => ({
            label: this.backgroundAbilityChoiceLabel(choice),
            highlighted: JSON.stringify(s.backgroundAbilityChoice ?? null) === JSON.stringify(choice),
            onPick: () => {
              s.backgroundAbilityChoice = choice;
            },
          })),
        );
      },
      { variant: "tab" },
    );

    // Playtest fix (Party Creation Overhaul, Plan 0): Point Buy's
    // "Points Left" readout used to be concatenated onto the STR row's own
    // label text, pushing STR itself off the edge of the button. It now
    // gets its own slim, dedicated line above the ability-score block —
    // always present (so nothing else needs to shift when the method
    // toggles), just left blank in Standard Array mode. `abilityRowsTop`
    // shifts down slightly (270 -> 292) to make room; every row below it
    // (`gearY`/`subclassY`/`levelY`/`planY`/`spellsY`) is already computed
    // relative to `abilityRowsTop`, so they cascade automatically.
    // Party Creation Overhaul Plan 8: dark ink color for the new parchment
    // backdrop (was a dim green on near-black).
    // D-206: shifted down (258 -> 302) to make room for the new Background
    // row above — `abilityRowsTop` below shifts by the same amount so
    // everything cascades exactly like the Point Buy note above describes.
    // Playtest fix: 302 -> 324. D-206 shifted this row down to clear the new
    // Background row (bottom edge y=282) but left only 20px before it, which
    // the Standard Array/Point Buy pill below (`abilityMethodHandle`, moved
    // to y=300 in the same fix) also needed to fit into — the two rows
    // collided into the Background row above them. `abilityRowsTop` (below)
    // is untouched, so nothing else in the column shifts.
    const pointsLeftY = 324;
    const pointsLeftLabel = this.add
      .text(x, pointsLeftY, "", { fontFamily: FONT_BODY, fontSize: "11px", color: "#2f4a34" })
      .setOrigin(0.5)
      .setDepth(10);

    // Party Creation Overhaul Plan 1.2: this hero's own Standard Array/Point
    // Buy toggle — was one scene-wide button (`buildTeamLevelControl`'s old
    // "leftX" half) before this. A dedicated slim row rather than sharing
    // `pointsLeftLabel`'s row — Plan 0.4 already fixed exactly this class of
    // bug once (two labels sharing one row pushing each other off). Own row
    // pushes `abilityRowsTop` down another 292 -> 300, same cascade as the
    // 270 -> 292 shift above.
    // Playtest fix: 280 -> 300. This pill's top edge (280-10=270) overlapped
    // the Background/Ability-Bonus row above it (D-206 added that row at
    // y=266, bottom edge 282) by 12px — visible in Kevin's own screenshot as
    // the Standard Array pill crowding into the row above. `pointsLeftY`
    // (below) moved 302 -> 324 in the same fix to keep its own gap under
    // this pill; `abilityRowsTop` is untouched.
    const abilityMethodHandle = createOrnateButton(
      this,
      x,
      300,
      140,
      20,
      "",
      () => {
        const s = this.slots[slot];
        s.abilityScoreMethod = s.abilityScoreMethod === "standardArray" ? "pointBuy" : "standardArray";
        // D-204: switching back INTO Standard Array seeds a fresh allocator
        // from this hero's CURRENT class's own default order, not the flat
        // identity order — same reasoning as the initial slot default.
        s.allocator =
          s.abilityScoreMethod === "pointBuy"
            ? new PointBuyAllocator()
            : new StandardArrayAllocator(defaultAbilityOrderForClass(CREATABLE_CLASS_IDS[s.classIndex]));
        this.closeDropdown();
        this.refreshAll();
      },
      { variant: "tool" },
    );
    allObjects.push(abilityMethodHandle.container);
    interactiveButtons.push(abilityMethodHandle);

    // Party Creation Overhaul Plan 8: `createOrnateButton` owns its label
    // internally, so Standard Array's dropdown-trigger row and Point Buy's
    // value readout can no longer share one Text object riding on the
    // shared row position — `pointBuyValueLabels` is Point Buy's own copy.
    const standardArrayHandles = {} as Record<AbilityScoreId, OrnateButtonHandle>;
    const pointBuyValueLabels = {} as Record<AbilityScoreId, Phaser.GameObjects.Text>;
    // D-147 (piece 3): kept OUT of `interactiveButtons` — their interactivity
    // is managed by `refreshAbilityScoreControls` (which also has to weigh
    // this hero's own method, Plan 1.2), not the generic active/inactive-slot
    // toggle.
    const standardArrayRowButtons: OrnateButtonHandle[] = [];
    const pointBuyButtons: OrnateButtonHandle[] = [];
    // D-206: shifted down 300 -> 344, same reason as `pointsLeftY` above.
    const abilityRowsTop = 344;
    // Party Creation Overhaul Plan 8: 30 -> 34 (ornate rows need more room).
    const abilityRowHeight = 34;
    ABILITY_SCORE_IDS.forEach((ability, row) => {
      const y = abilityRowsTop + row * abilityRowHeight;

      // Standard Array mode: the whole row is one button that opens a
      // per-value dropdown (Party Creation Overhaul Plan 1.1 — was a
      // click-to-cycle button before this). Height 24 -> 28 (Plan 8).
      const rowHandle = createOrnateButton(
        this,
        x,
        y,
        COLUMN_WIDTH - 20,
        28,
        "",
        () => {
          if (this.slots[slot].abilityScoreLocked) return;
          if (this.slots[slot].abilityScoreMethod !== "standardArray") return;
          this.openAbilityDropdown(slot, ability, x, y);
        },
        { variant: "tab" },
      );

      // D-147 (piece 3): Point Buy mode — a +/- stepper at the same row
      // position, shown/interactive only while this hero's own method is
      // "pointBuy" (`refreshAbilityScoreControls` toggles both sets'
      // visibility and interactivity together, so only one set is ever
      // clickable/visible — stacking order between them doesn't matter).
      // `pointBuyValueLabels` shows the score/modifier text, computed
      // identically to Standard Array's own label either way (see
      // `refreshSlot`). Size 26x22 -> 30x28 (Plan 8).
      const minusHandle = createOrnateButton(
        this,
        x - 100,
        y,
        30,
        28,
        "−",
        () => {
          if (this.slots[slot].abilityScoreLocked) return;
          if (this.slots[slot].abilityScoreMethod !== "pointBuy") return;
          (this.slots[slot].allocator as PointBuyAllocator).decrease(ability);
          this.refreshAll();
        },
        { variant: "secondary", fontSize: 16 },
      );

      const plusHandle = createOrnateButton(
        this,
        x + 100,
        y,
        30,
        28,
        "+",
        () => {
          if (this.slots[slot].abilityScoreLocked) return;
          if (this.slots[slot].abilityScoreMethod !== "pointBuy") return;
          (this.slots[slot].allocator as PointBuyAllocator).increase(ability);
          this.refreshAll();
        },
        { variant: "secondary", fontSize: 16 },
      );

      const valueLabel = this.add
        .text(x, y, "", { fontFamily: FONT_BODY, fontSize: "13px", color: "#2a1a10" })
        .setOrigin(0.5)
        .setDepth(10);

      standardArrayHandles[ability] = rowHandle;
      pointBuyValueLabels[ability] = valueLabel;
      standardArrayRowButtons.push(rowHandle);
      pointBuyButtons.push(minusHandle, plusHandle);
      allObjects.push(rowHandle.container, minusHandle.container, plusHandle.container, valueLabel);
    });

    // Phase 13.11 (D-096): a free starting-gear pick, cycling "None" plus
    // every common/uncommon catalogue item. D-178: now the first row below
    // ability scores — sits where the removed "signature action" row used
    // to, since every class's basic attack is a fixed part of its own
    // identity now, not a creation-time pick — everything below this row
    // cascades off `gearY` unchanged. Party Creation Overhaul Plan 8: the
    // "+15"/"+40" gaps below grew slightly (see each row's own comment) to
    // match the taller ornate rows.
    const gearY = abilityRowsTop + ABILITY_SCORE_IDS.length * abilityRowHeight + 20;
    // Party Creation Overhaul Plan 2.3: split this row into Gear (left half)
    // and Pool (right half) instead of adding a new row — this scene's
    // layout is self-documented as fragile (KI-083), and everything below
    // (`subclassY = gearY + 44`, etc.) cascades off `gearY` unchanged;
    // inserting a whole new row would mean re-deriving every one of those
    // constants. `rowGap` mirrors the small gaps used elsewhere in this file
    // between same-row controls.
    const rowGap = 6;
    const halfWidth = (COLUMN_WIDTH - 20 - rowGap) / 2;
    const gearHandle = createOrnateButton(
      this,
      x - halfWidth / 2 - rowGap / 2,
      gearY,
      halfWidth,
      32,
      "",
      () => {
        // D-194: a campaign companion's gear is fixed (difficulty-scaled,
        // never player-edited) — same guard style Class/Race already use.
        // Party Creation Overhaul Plan 3.2: checks `gearLocked`, not
        // `identityLocked` — a returning PC has identity locked but gear
        // stays editable, unlike a companion (see `SlotState.gearLocked`).
        if (this.slots[slot].gearLocked) return;
        this.openGearPicker(slot);
      },
      { variant: "tab" },
    );
    // Party Creation Overhaul Plan 2.3: NOT gated by `gearLocked` — a
    // companion draws from the pool too, that's the entire point (their
    // fixed catalogue/difficulty kit and the pool are two separate gear
    // sources). Hidden entirely outside campaign mode below (no
    // `campaignId`, no roster/pool concept at all).
    const poolHandle = createOrnateButton(
      this,
      x + halfWidth / 2 + rowGap / 2,
      gearY,
      halfWidth,
      32,
      "",
      () => this.openPoolPicker(slot),
      { variant: "tab" },
    );
    if (!this.campaignId || this.partyInventorySnapshot.length === 0) poolHandle.container.setVisible(false);

    // Phase 14.2 (D-099): a subclass-picker row. Only actually cycles
    // anything for a level-1-choice class with 2+ modeled subclasses today
    // (Cleric/Sorcerer/Warlock) — clicking it for any other class is a
    // harmless no-op, same "always interactive, handler checks eligibility"
    // pattern the other cycle buttons already use (their behavior doesn't
    // depend on any OTHER slot's state either). A later-choice class's
    // subclass is still picked in battle, via BattleScene's own overlay.
    const subclassY = gearY + 44;
    const subclassHandle = createOrnateButton(
      this,
      x,
      subclassY,
      COLUMN_WIDTH - 20,
      32,
      "",
      () => {
        const s = this.slots[slot];
        const classId = CREATABLE_CLASS_IDS[s.classIndex];
        const options = subclassesForClass(classId);
        if (getClassDefinition(classId).subclassChoiceLevel !== 1 || options.length < 2) return;
        this.openChoicePicker(
          "Choose a Subclass",
          options.map((opt, i) => ({
            label: opt.name,
            highlighted: i === s.subclassIndex,
            onPick: () => {
              s.subclassIndex = i;
            },
          })),
        );
      },
      { variant: "tab" },
    );

    const statsLabel = this.add
      .text(x, subclassY + 48, "", {
        fontFamily: FONT_BODY,
        fontSize: "13px",
        color: "#2a1a10",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(10);

    // D-129: a pre-battle "Starting Level" control — cycles 1-20, wrapping,
    // same interaction shape as every other cycle button in this column.
    // Kevin asked for this specifically to stop every playtest from having
    // to grind a party up from level 1; see the Team Level control in
    // `buildBottomControls` for setting every slot at once instead.
    const levelY = subclassY + 88;
    const levelHandle = createOrnateButton(
      this,
      x,
      levelY,
      COLUMN_WIDTH - 20,
      32,
      "",
      () => {
        const s = this.slots[slot];
        const levels: number[] = [];
        for (let n = 1; n <= MAX_CLASS_LEVEL; n++) levels.push(n);
        this.openChoicePicker(
          "Choose Starting Level",
          levels.map((n) => ({
            label: `${n}`,
            highlighted: n === s.startingLevel,
            onPick: () => (s.startingLevel = n),
          })),
        );
      },
      { variant: "tab" },
    );

    // D-133: the level-by-level Character Creation planner — opens a
    // full-screen wizard (see `openLevelPlanner`) letting the player pick
    // every future ASI/subclass/spell-pick choice for this hero in advance.
    // Party Creation Overhaul Plan 6.4: split into two half-width buttons
    // (same technique D-197 used for Gear|Pool, `rowGap`/`halfWidth` above)
    // instead of a new row — "Plan Levels" (which plan) and a cadence
    // toggle (how it's applied, D-133's old Auto/Prompted/Fresh choice,
    // decoupled from the wizard entirely).
    const planY = levelY + 44;
    const planHandle = createOrnateButton(
      this,
      x - halfWidth / 2 - rowGap / 2,
      planY,
      halfWidth,
      32,
      "",
      () => this.openLevelPlanner(slot),
      { variant: "tab" },
    );
    const cadenceHandle = createOrnateButton(
      this,
      x + halfWidth / 2 + rowGap / 2,
      planY,
      halfWidth,
      32,
      "",
      () => {
        const s = this.slots[slot];
        // Party Creation Overhaul Plan 5.1 (D-198): the hard rule — an
        // AI-controlled hero's mode is always "auto." `setDisabled` below
        // already blocks the click, this is a defensive no-op backstop.
        if (s.controlledBy === "ai") return;
        const next: Record<LevelUpPlanMode, LevelUpPlanMode> = { auto: "prompt", prompt: "fresh", fresh: "auto" };
        s.levelUpPlan.mode = next[s.levelUpPlan.mode];
        this.refreshAll();
      },
      { variant: "tab" },
    );

    // D-135: the starting spell-selection wizard — opens a full-screen
    // picker (see `openSpellPicker`) letting the player choose this hero's
    // starting prepared spells/known cantrips/(Wizard) spellbook, instead of
    // silently taking `Hero.growSpellSelections()`'s auto-fill. A harmless
    // no-op for a class with no real picks to make (see
    // `spellPickStepsForClass`'s own doc comment for why Paladin/Ranger, in
    // particular, land here despite having a real spell-slot economy).
    const spellsY = planY + 44;
    const spellsHandle = createOrnateButton(
      this,
      x,
      spellsY,
      COLUMN_WIDTH - 20,
      32,
      "",
      () => this.openSpellPicker(slot),
      { variant: "tab" },
    );

    // D-204: a global per-character library — save this slot's current
    // build for reuse in a later party, or load a previously-saved one in.
    // Half-width split, same `rowGap`/`halfWidth` technique as Gear|Pool and
    // Plan Levels|Cadence above, one more row below Spells.
    const libraryY = spellsY + 44;
    const saveCharacterHandle = createOrnateButton(
      this,
      x - halfWidth / 2 - rowGap / 2,
      libraryY,
      halfWidth,
      32,
      "",
      () => this.openSaveCharacterScreen(slot),
      { variant: "tab" },
    );
    const loadCharacterHandle = createOrnateButton(
      this,
      x + halfWidth / 2 + rowGap / 2,
      libraryY,
      halfWidth,
      32,
      "",
      () => {
        // Same guard as Class/Race — loading replaces class/race identity,
        // so a locked companion slot can't take it.
        if (this.slots[slot].identityLocked) return;
        this.openCharacterLibraryPicker(slot);
      },
      { variant: "tab" },
    );

    allObjects.push(
      nameInput,
      classHandle.container,
      raceHandle.container,
      backgroundHandle.container,
      backgroundAbilityHandle.container,
      gearHandle.container,
      poolHandle.container,
      subclassHandle.container,
      statsLabel,
      levelHandle.container,
      planHandle.container,
      cadenceHandle.container,
      spellsHandle.container,
      saveCharacterHandle.container,
      loadCharacterHandle.container,
      pointsLeftLabel,
    );
    interactiveButtons.push(
      classHandle,
      raceHandle,
      backgroundHandle,
      backgroundAbilityHandle,
      gearHandle,
      poolHandle,
      subclassHandle,
      levelHandle,
      planHandle,
      cadenceHandle,
      spellsHandle,
      saveCharacterHandle,
      loadCharacterHandle,
    );

    return {
      controlHandle,
      nameInput,
      nameInputNode: nameNode,
      classHandle,
      raceHandle,
      backgroundHandle,
      backgroundAbilityHandle,
      abilityMethodHandle,
      standardArrayHandles,
      pointBuyValueLabels,
      standardArrayRowButtons,
      pointBuyButtons,
      gearHandle,
      poolHandle,
      subclassHandle,
      statsLabel,
      levelHandle,
      planHandle,
      cadenceHandle,
      spellsHandle,
      saveCharacterHandle,
      loadCharacterHandle,
      pointsLeftLabel,
      allObjects,
      interactiveButtons,
    };
  }

  // Phase 11.4 (D-077): party size + difficulty, sitting in the gap between
  // the slot columns and Start Battle. Phase 13.11 (D-096): shifted down
  // another +50px (600->650); Phase 14.2 (D-099): shifted down another +40px
  // (650->690); D-129 shifted down another +90px (690->780); D-133 shifted
  // down another +40px (780->820) for the Plan Levels row; D-135 shifted
  // down another +40px (820->860, see below) for the new Spells row, same
  // discipline as the race-row +40 shift and the 720->900->1000 canvas
  // bumps; GAME_HEIGHT (1080) has ample room to spare either way.
  private buildBottomControls(width: number): void {
    // Party Creation Overhaul Plan 8: shifted +30 (810->840/860->890) to
    // keep pace with the taller ornate column above.
    this.buildTeamLevelControl(width, 840);
    const y = 890;
    const leftX = width / 2 - 150;
    const rightX = width / 2 + 150;

    this.partySizeHandle = createOrnateButton(
      this,
      leftX,
      y,
      280,
      44,
      "",
      () => {
        // KI-098 item 13 (companion roster, Phase 1): campaign mode's party
        // size is fixed at 4 (PC + 3 active companions) — see the `create()`
        // note by `this.partySize = MAX_PARTY_SIZE`.
        if (this.campaignId) return;
        const sizes: number[] = [];
        for (let n = MIN_PARTY_SIZE; n <= MAX_PARTY_SIZE; n++) sizes.push(n);
        this.openChoicePicker(
          "Choose Party Size",
          sizes.map((n) => ({
            label: `${n}`,
            highlighted: n === this.partySize,
            onPick: () => (this.partySize = n),
          })),
        );
      },
      { variant: "secondary" },
    );
    // Party Creation Overhaul Plan 3.6: hidden entirely in campaign mode
    // (was disabled-and-grayed with a "(fixed for campaigns)" label) — party
    // size has no meaning to show once it's permanently fixed.
    if (this.campaignId) this.partySizeHandle.container.setVisible(false);

    this.difficultyHandle = createOrnateButton(
      this,
      rightX,
      y,
      280,
      44,
      "",
      () => {
        this.openChoicePicker(
          "Choose Difficulty",
          DIFFICULTY_IDS.map((id) => ({
            label: getDifficultyDefinition(id).name,
            desc: difficultyChoiceDescription(id),
            highlighted: id === this.difficultyId,
            onPick: () => (this.difficultyId = id),
          })),
        );
      },
      { variant: "secondary" },
    );
    // Party Creation Overhaul Plan 3.5: hidden in campaign mode —
    // `CampaignSelectScene` now owns this choice, pre-seeding it in via
    // `init()`'s `difficultyId`.
    if (this.campaignId) this.difficultyHandle.container.setVisible(false);
  }

  /**
   * D-129's "set every slot's Starting Level at once" control. Party
   * Creation Overhaul Plan 1.2: this row used to be split left/right with
   * the party-wide Ability Score Method toggle — that toggle is now a
   * per-hero pill inside each column instead (`abilityMethodHandle`), so
   * this control is alone on its row again, centered.
   */
  private buildTeamLevelControl(width: number, y: number): void {
    this.teamLevelHandle = createOrnateButton(
      this,
      width / 2,
      y,
      280,
      44,
      "",
      () => {
        const levels: number[] = [];
        for (let n = 1; n <= MAX_CLASS_LEVEL; n++) levels.push(n);
        this.openChoicePicker(
          "Choose Team Level (all heroes)",
          levels.map((n) => ({
            label: `${n}`,
            highlighted: n === this.teamLevelValue,
            onPick: () => {
              this.teamLevelValue = n;
              this.slots.forEach((s) => (s.startingLevel = n));
            },
          })),
        );
      },
      { variant: "secondary" },
    );
  }

  // Phase 9 (D-083): Start Battle moves to the left half of the row,
  // mirroring the party-size/difficulty row's own leftX/rightX split one row
  // above — Save Party takes the right half. Phase 13.11 (D-096): this whole
  // row shifted down +50px (650->700); Phase 14.2 (D-099): another +40px
  // (700->740); D-129: another +90px (740->830); D-133: another +40px
  // (830->870); D-135: another +40px (870->910), same reason as
  // buildBottomControls' own shift.
  private buildStartButton(width: number): void {
    const leftX = width / 2 - 150;
    const rightX = width / 2 + 150;

    // Party Creation Overhaul Plan 8: `OrnateButtonHandle` has no direct
    // green-fill equivalent for "valid, ready to click" — `refreshAll`
    // drives this with `setDisabled` alone (see there), relying on the
    // "primary" variant's own larger/brighter styling plus the disabled
    // state's dim wood-panel look to carry the same read.
    this.startHandle = createOrnateButton(
      this,
      leftX,
      940,
      260,
      54,
      "Start Battle",
      () => {
        if (!this.partyValid) return;
        // D-202: a plain session that actually starts a battle is done
        // being "resumed" — clear the draft so the next Build Party visit
        // starts fresh instead of resurrecting a party already in play. A
        // campaign/Free-Play/Load-Game battle start leaves any OTHER
        // plain draft (from a previous, unrelated session) untouched.
        if (this.isPlainEntry()) lastPlainDraft = undefined;
        const builds = this.buildsFromSlots();
        // Party Creation Overhaul Plan 3.1: Start Battle is the real commit
        // point ("resolution at mission start," matching Plan 2.3's own
        // framing) — persist the PC's and every active companion's
        // just-edited build so it's still there on the next chapter visit.
        if (this.campaignId) {
          let roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
          roster = setPcBuild(roster, builds[0]);
          for (let slot = 1; slot < builds.length; slot++) {
            const companionId = this.companionIdForSlot[slot];
            if (companionId) roster = setCompanionBuild(roster, companionId, builds[slot]);
          }
          // Party Creation Overhaul Plan 2.3: "mission start" is the pool's
          // own commit point too — every hero's `startingGearIds` above
          // already carries any pool item they drew (see `buildsFromSlots`),
          // so all that's left is pool bookkeeping: the whole pool resolves
          // here (claimed items are already baked into the builds just
          // persisted above; unclaimed items silently return to their
          // origin, needing no write of their own — see
          // `resolvePartyInventory`'s own doc comment).
          roster = resolvePartyInventory(roster);
          saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, roster);
        }
        if (this.loadedSlotId) {
          this.saveFile = updateSaveSlot(this.saveFile, this.loadedSlotId, {
            party: builds,
            partySize: this.partySize,
            difficultyId: this.difficultyId,
            // D-201: keep a Load-Game-originated slot's campaign linkage
            // (or lack of one) accurate — undefined for a classic/Free
            // Play party, same as everywhere else campaignId is forwarded.
            campaignId: this.campaignId,
            chapterIndex: this.chapterIndex,
            updatedAt: Date.now(),
          });
          saveSaveFile(window.localStorage, SAVE_STORAGE_KEY, this.saveFile);
          this.pushLoadedSlotToCloud();
        }
        // Party size isn't sent separately: BattleScene derives it from
        // heroDefinitions.length, which is always the true count.
        // D-152: `originalParty`/`loadedSlotId` are forwarded ONLY so the new
        // in-battle pause menu's "Save Party" has a real `CharacterBuild[]` to
        // save — `HeroDefinition` (what `buildRoster()` sends) has already
        // discarded race id by this point, so there is no way back to a
        // `CharacterBuild` from it. Not used for anything else.
        this.scene.start("BattleScene", {
          heroDefinitions: this.buildRoster(),
          difficultyId: this.difficultyId,
          campaignId: this.campaignId,
          chapterIndex: this.chapterIndex,
          freePlayMapId: this.freePlayMapId,
          freePlayWaves: this.freePlayWaves,
          customMapData: this.customMapData,
          testMode: this.testMode,
          originalParty: builds,
          loadedSlotId: this.loadedSlotId,
        });
      },
      { variant: "primary" },
    );

    this.savePartyHandle = createOrnateButton(this, rightX, 940, 260, 54, "", () => this.onSaveParty(), {
      variant: "secondary",
    });

    this.saveStatusLabel = this.add
      .text(rightX, 990, "", { fontFamily: FONT_BODY, fontSize: "13px", color: "#b8a074" })
      .setOrigin(0.5)
      .setDepth(1);

    // Party Creation Overhaul Plan 3.7: hidden in campaign mode — Plan 3.1
    // now persists a campaign party's build automatically at Start Battle,
    // so the generic Free-Play-only save-slot flow has nothing to do here.
    if (this.campaignId) {
      this.savePartyHandle.container.setVisible(false);
      this.saveStatusLabel.setVisible(false);
    }

    this.statusText = this.add
      .text(width / 2, 1020, "", {
        fontFamily: FONT_BODY,
        fontSize: "13px",
        color: "#c86a5a",
      })
      .setOrigin(0.5)
      .setDepth(1);
  }

  /**
   * Save the current build to a new slot, or update the already-loaded one
   * (Phase 9, D-083). Gated by `refreshAll`'s own enable/disable of
   * `savePartyHandle` (invalid party, or a new save at `MAX_SAVE_SLOTS`) —
   * re-checked here too since a disabled button's own guard is layered on
   * top of, not a substitute for, this method's own check.
   */
  private onSaveParty(): void {
    // Party Creation Overhaul Plan 3.7: defense-in-depth matching the Party
    // Size button's own click-guard-plus-hide pattern — the button itself
    // is hidden in campaign mode, this guards any other future call path.
    if (this.campaignId) return;
    if (!this.partyValid) return;
    // D-152: shared with the in-battle pause menu's "Save Party" — same
    // create-or-update decision, one tested place (`SaveSystem.
    // saveOrUpdatePartySlot`) instead of two copies of the same branching.
    const result = saveOrUpdatePartySlot(this.saveFile, {
      loadedSlotId: this.loadedSlotId,
      builds: this.buildsFromSlots(),
      partySize: this.partySize,
      difficultyId: this.difficultyId,
      now: Date.now(),
    });
    if (!result) return; // at MAX_SAVE_SLOTS with no loadedSlotId — same silent no-op as before
    this.saveFile = result.file;
    this.loadedSlotId = result.slotId;
    saveSaveFile(window.localStorage, SAVE_STORAGE_KEY, this.saveFile);
    this.pushLoadedSlotToCloud();
    this.refreshAll();
  }

  /**
   * Mirror the just-saved slot to the cloud, fire-and-forget (Phase 10,
   * D-084) — the local save already succeeded regardless, cloud sync is
   * best-effort on top of it. No-ops when anonymous (not signed in with
   * Google — see `MainMenuScene`'s Account control) or when Firebase isn't
   * configured at all (`AuthClient`/`CloudSaveSync` already no-op then too;
   * this check just avoids the pointless call).
   */
  private pushLoadedSlotToCloud(): void {
    if (!this.loadedSlotId || this.authState.isAnonymous || !this.authState.uid) return;
    const slot = getSaveSlot(this.saveFile, this.loadedSlotId);
    if (slot) pushSlot(this.authState.uid, slot).catch((err) => console.error("Cloud push failed:", err));
  }

  private buildBackButton(): void {
    // Standard top-left slot every other back-navigating scene uses
    // (Compendium, Bestiary, Load Game, Map Builder, etc.) — this scene used
    // to be the one outlier, centered at the bottom edge, easy to miss.
    createOrnateButton(this, 120, 42, 160, 44, "Back (Esc)", () => this.leaveToMainMenu(), {
      variant: "tool",
      depth: 5,
    }).container.setName("back-button-anchor");
    this.input.keyboard?.on("keydown-ESC", () => this.leaveToMainMenu());
  }

  private leaveToMainMenu(): void {
    // Don't abandon the scene while a picker/wizard overlay is open — Esc
    // (or a stray click) shouldn't discard in-progress choices; Cancel/Back
    // inside the overlay itself is the way out of it.
    if (this.levelPlanOverlay.length > 0) return;
    // D-202: capture the draft `init()` will resume on the next plain
    // entry — a loaded classic party is fair game too (no lock to leak),
    // a campaign/Free-Play/custom-map session is not (would otherwise let
    // a locked companion resurface as freely editable next time).
    if (this.isPlainEntry()) lastPlainDraft = this.buildsFromSlots();
    this.scene.start("MainMenuScene");
  }

  /**
   * D-193: reconstruct all 10 gear-slot indices from a saved build's
   * `startingGearIds`. If a build predates Plan 2 (no `startingGearIds` at
   * all, only the legacy single `startingEquipmentId`), fold that single
   * pick into its own matching slot instance — same "a ring defaults to
   * ring1" rule `Hero`'s own constructor fallback uses, so a legacy build
   * now round-trips fully through this 10-slot UI with nothing dropped
   * (unlike the earlier 3-row design, every slot has a real row here).
   */
  private gearIndicesFromBuild(build: CharacterBuild): Partial<Record<GearSlotId, number>> {
    const gearIds: Partial<Record<GearSlotId, string>> = { ...build.startingGearIds };
    if (!build.startingGearIds && build.startingEquipmentId) {
      const item = getEquipmentDefinition(build.startingEquipmentId);
      const slotId: GearSlotId = item.slot === "ring" ? "ring1" : item.slot;
      gearIds[slotId] = build.startingEquipmentId;
    }

    const indices: Partial<Record<GearSlotId, number>> = {};
    for (const slotId of GEAR_SLOT_IDS) {
      const id = gearIds[slotId];
      if (!id) continue;
      const index = startingGearIdsForSlotType(gearSlotType(slotId)).indexOf(id) + 1;
      if (index > 0) indices[slotId] = index;
    }
    return indices;
  }

  /**
   * Rebuild a slot's editable state from a previously saved `CharacterBuild`
   * (Phase 9, D-083). `indexOf` returning -1 (a name/class/race/ability the
   * save no longer matches, e.g. data changed since it was saved) falls back
   * to index 0 via `Math.max(0, ...)` — same defensive spirit as the rest of
   * this scene.
   */
  private slotStateFromBuild(
    build: CharacterBuild,
    identityLocked = false,
    gearLocked = identityLocked,
    catalogueGearIds?: Partial<Record<GearSlotId, string>>,
    abilityScoreLocked = identityLocked,
  ): SlotState {
    // D-206: undefined `build.backgroundId` (any build made before this
    // feature) falls back to index 0, same defensive spirit as everything
    // else here.
    const backgroundIndex = Math.max(0, BACKGROUND_IDS.indexOf(build.backgroundId ?? ""));
    return {
      identityLocked,
      gearLocked,
      abilityScoreLocked,
      name: build.name,
      classIndex: Math.max(0, CREATABLE_CLASS_IDS.indexOf(build.classId)),
      raceIndex: Math.max(0, RACE_IDS.indexOf(build.raceId)),
      backgroundIndex,
      // A read-time migration for any save made before this feature (never
      // had a chance to record a real choice) — silently backfills the
      // neutral "+1 to all three" option rather than blocking Start Battle
      // on old data, the same "read-time migration, not a version bump"
      // precedent KI-143 used for an old save gaining new gear-slot data. A
      // genuinely FRESH slot starts with this undefined instead (see the
      // slot-construction default), so a brand-new hero still gets the
      // real, visible choice.
      backgroundAbilityChoice:
        build.backgroundAbilityChoice ??
        backgroundAbilityChoices(getBackgroundDefinition(BACKGROUND_IDS[backgroundIndex]).abilityTriad).find(
          (c) => Object.keys(c).length === 3,
        ),
      allocator:
        build.abilityScoreMethod === "pointBuy"
          ? pointBuyAllocatorFromScores(build.abilityScores)
          : allocatorFromScores(build.abilityScores),
      abilityScoreMethod: build.abilityScoreMethod === "pointBuy" ? "pointBuy" : "standardArray",
      controlledBy: build.controlledBy,
      gearIndices: this.gearIndicesFromBuild(build),
      // D-194: a defensive spread copy (never a bare reference into
      // companions.ts's shared singleton build) of this companion's
      // authored "normal" kit — undefined for a non-gear-locked slot, where
      // gearIndices above is the only source of truth. Party Creation
      // Overhaul Plan 3.1: sourced from `catalogueGearIds` (the static
      // catalogue build) when given, NOT from `build.startingGearIds` —
      // `build` may itself be a persisted, already difficulty-trimmed copy.
      baselineGearIds: gearLocked ? { ...(catalogueGearIds ?? build.startingGearIds ?? {}) } : undefined,
      // Phase 14.2 (D-099): reconstruct which of the class's subclasses was
      // picked, same safe `Math.max(0, ...)` fallback as everything above —
      // undefined `build.subclassId` (a later-choice class) also lands on 0,
      // harmlessly unused since `subclassIdForNewBuild` ignores it for those.
      subclassIndex: Math.max(0, subclassesForClass(build.classId).findIndex((s) => s.id === build.subclassId)),
      startingLevel: build.startingLevel ?? 1,
      // Party Creation Overhaul Plan 5.1 (D-198): coerce mode to "auto" for
      // an AI-controlled build loaded from an older save — defense in depth
      // alongside `BattleScene.applyClassLevelUps`'s own `controlledBy`
      // check, so this hard rule can't be bypassed by a save predating it.
      levelUpPlan:
        build.controlledBy === "ai"
          ? { ...(build.levelUpPlan ?? emptyLevelUpPlan()), mode: "auto" }
          : (build.levelUpPlan ?? emptyLevelUpPlan()),
      spellPicks: {
        leveledSpellIds: build.preparedSpellIds,
        cantripIds: build.knownCantripIds,
        spellbookIds: build.spellbookIds,
      },
    };
  }

  /** D-193: the inverse of `gearIndicesFromBuild` — all 10 gear-slot indices back into a `startingGearIds` map. */
  private startingGearIdsFromIndices(s: SlotState): Partial<Record<GearSlotId, string>> {
    const ids: Partial<Record<GearSlotId, string>> = {};
    for (const slotId of GEAR_SLOT_IDS) {
      const index = s.gearIndices[slotId];
      if (!index) continue;
      ids[slotId] = startingGearIdsForSlotType(gearSlotType(slotId))[index - 1];
    }
    return ids;
  }

  /**
   * Party Creation Overhaul Plan 2.3: `slotIndex`'s finished gear-id map,
   * folding the shared party inventory pool in on top of whatever
   * `s.gearLocked` would normally produce. A `gearLocked` slot's base kit is
   * run through `visibleGearForOrigin` (keyed on THIS slot's own companion
   * id, whoever currently occupies it — not only while they're benched) so
   * a reactivated companion never shows an item simultaneously claimable by
   * someone else from the pool. Then, for EVERY slot (locked or not), this
   * session's own pool picks (`s.poolGearIds`) override the base kit
   * slot-by-slot — a pool pick always wins.
   */
  private resolveGearIdsForSlot(s: SlotState, slotIndex: number): Partial<Record<GearSlotId, string>> {
    const baseGearIds = s.gearLocked
      ? visibleGearForOrigin(
          this.companionIdForSlot[slotIndex] ?? "",
          companionStartingGearForDifficulty(s.baselineGearIds ?? {}, this.difficultyId),
          this.partyInventorySnapshot,
        )
      : this.startingGearIdsFromIndices(s);
    const withPool: Partial<Record<GearSlotId, string>> = { ...baseGearIds };
    for (const [poolSlotId, entryId] of Object.entries(s.poolGearIds ?? {})) {
      const claimedEntry = this.partyInventorySnapshot.find((e) => e.id === entryId);
      if (claimedEntry) withPool[poolSlotId as GearSlotId] = claimedEntry.itemId;
    }
    return withPool;
  }

  /**
   * Every ACTIVE slot's finished build (length `partySize`), ids stable per
   * slot (`party-1`..`party-4`) — a slot dimmed out by a smaller party size
   * contributes nothing here, so it's excluded from both validation and the
   * roster BattleScene receives.
   */
  /** D-204: extracted from `buildsFromSlots` so a single slot's build can be snapshotted on its own — see `openSaveCharacterScreen`. */
  private buildFromSlot(i: number): CharacterBuild {
    const s = this.slots[i];
    const classId = CREATABLE_CLASS_IDS[s.classIndex];
    return {
      id: `party-${i + 1}`,
      name: s.name,
      raceId: RACE_IDS[s.raceIndex],
      backgroundId: BACKGROUND_IDS[s.backgroundIndex],
      backgroundAbilityChoice: s.backgroundAbilityChoice,
      classId,
      level: 1,
      abilityScores: s.allocator.scores(),
      abilityScoreMethod: s.abilityScoreMethod === "pointBuy" ? "pointBuy" : undefined,
      controlledBy: s.controlledBy,
      // Phase 13.11 (D-096): a level-1-choice class (Cleric/Sorcerer/
      // Warlock) already has a modeled subclass the instant it's created —
      // Phase 14.2 (D-099): WHICH one is now the player's real choice, via
      // the Subclass row's cycle button (`s.subclassIndex`). Every other
      // class starts undefined (see BattleScene's subclass-choice queue).
      subclassId: subclassIdForNewBuild(classId, s.subclassIndex),
      // D-193: pure new-shape gear from here on — `startingEquipmentId`
      // (legacy) is intentionally left undefined for every freshly-built
      // party; it's read-only back-compat, see `gearIndicesFromBuild`.
      // D-194: a campaign companion (`gearLocked`) never reads
      // `s.gearIndices` (their Gear button is a no-op, see the guard
      // above) — their kit is always freshly derived from their
      // authored baseline + the CURRENT difficulty instead, so a live
      // Difficulty change updates it immediately. Party Creation Overhaul
      // Plan 3.2: checks `gearLocked`, not `identityLocked` — a returning
      // PC has identity locked but keeps its own freely-edited gear.
      // Plan 2.3: see `resolveGearIdsForSlot` — a `gearLocked` slot's base
      // kit is stripped of anything currently sitting claimable in the
      // pool, then this session's own pool picks (`s.poolGearIds`) are
      // applied on top for every slot, locked or not.
      startingGearIds: this.resolveGearIdsForSlot(s, i),
      startingLevel: s.startingLevel,
      // D-133: undefined for a "fresh"/never-planned hero — identical to
      // every pre-D-133 build.
      levelUpPlan: s.levelUpPlan.mode === "fresh" ? undefined : s.levelUpPlan,
      // D-135: undefined for any field the player never customized —
      // identical to every pre-D-135 build.
      preparedSpellIds: s.spellPicks.leveledSpellIds,
      knownCantripIds: s.spellPicks.cantripIds,
      spellbookIds: s.spellPicks.spellbookIds,
    };
  }

  private buildsFromSlots(): CharacterBuild[] {
    return this.slots.slice(0, this.partySize).map((_, i) => this.buildFromSlot(i));
  }

  private buildRoster(): HeroDefinition[] {
    return this.buildsFromSlots().map((b) => heroDefinitionFromBuild(b));
  }

  /** Dim and disable an inactive (beyond party size) slot, or restore an active one. */
  private setSlotActive(widgets: SlotWidgets, active: boolean): void {
    const alpha = active ? 1 : 0.32;
    widgets.allObjects.forEach((o) => (o as unknown as { setAlpha(v: number): unknown }).setAlpha(alpha));
    // Party Creation Overhaul Plan 8: was `.setInteractive()`/`.disableInteractive()`
    // on a raw Rectangle — `OrnateButtonHandle.setDisabled()` does the same
    // click-block plus its own dimmed-plaque redraw.
    widgets.interactiveButtons.forEach((b) => b.setDisabled(!active));
    // D-147 (piece 2): the name row is a real HTML `<input>`, not a Phaser
    // button — `setDisabled()` above doesn't reach it.
    widgets.nameInputNode.disabled = !active;
  }

  /**
   * D-147 (piece 3), per-hero since Party Creation Overhaul Plan 1.2: shows/
   * enables exactly one of the two ability-score control sets per slot —
   * Standard Array's dropdown-trigger buttons, or Point Buy's +/- steppers —
   * matching THIS SLOT's own method. Runs AFTER `setSlotActive` in
   * `refreshAll` so it has the final say on both sets' interactivity (an
   * inactive slot beyond `partySize` stays fully disabled either way).
   */
  private refreshAbilityScoreControls(): void {
    this.widgets.forEach((w, slot) => {
      const standardArray = this.slots[slot].abilityScoreMethod === "standardArray";
      const active = slot < this.partySize;
      w.standardArrayRowButtons.forEach((b) => {
        b.container.setVisible(standardArray);
        b.setDisabled(!(active && standardArray));
      });
      w.pointBuyButtons.forEach((b) => {
        b.container.setVisible(!standardArray);
        b.setDisabled(!(active && !standardArray));
      });
      Object.values(w.pointBuyValueLabels).forEach((t) => (t as Phaser.GameObjects.Text).setVisible(!standardArray));
    });
  }

  /** Re-render every active slot's text, dim inactive ones, and re-validate the party. */
  private refreshAll(): void {
    const builds = this.buildsFromSlots();
    builds.forEach((build, slot) => this.refreshSlot(slot, build));
    this.widgets.forEach((w, slot) => this.setSlotActive(w, slot < this.partySize));
    this.refreshAbilityScoreControls();

    // Party Creation Overhaul Plan 3.6: unconditional now that the button
    // itself is hidden (not just disabled) in campaign mode.
    this.partySizeHandle.setLabel(`Party Size: ${this.partySize}`);
    this.difficultyHandle.setLabel(`Difficulty: ${getDifficultyDefinition(this.difficultyId).name}`);
    this.teamLevelHandle.setLabel(`Team Level: ${this.teamLevelValue} (all heroes)`);

    const duplicateNames = hasDuplicateNames(builds);
    // D-147 (piece 2): a hero name is now free text, so an empty/whitespace
    // field is newly possible — it isn't caught by `hasDuplicateNames`
    // unless two heroes are BOTH blank.
    const blankName = builds.some((b) => !b.name.trim());
    const invalidNames = duplicateNames || blankName;
    // Party Creation Overhaul Plan 1.1: a Standard Array slot can now sit
    // mid-edit with an unset ("—") ability — block Start/Save until every
    // active hero using Standard Array has all six assigned. Point Buy never
    // fails this (floor 8 on every stat, always complete by construction).
    const incompleteSlot = this.slots
      .slice(0, this.partySize)
      .findIndex(
        (s) => s.abilityScoreMethod === "standardArray" && !(s.allocator as StandardArrayAllocator).isComplete(),
      );
    // D-206: same "real, non-silent choice" treatment as the Standard Array
    // check above — a background is always selected (never unassigned,
    // index 0 default), but its ability-score bonus must be explicitly
    // spent, not silently defaulted.
    const unspentBackgroundSlot = this.slots.slice(0, this.partySize).findIndex((s) => !s.backgroundAbilityChoice);
    // D-194: the PC's (slot 0) gear point-buy budget — checked ONLY in
    // campaign mode, and ONLY against slot 0 specifically (a companion's
    // `gearIndices` is reconstructed but never actually spent from, see
    // `buildsFromSlots`, so it must never factor into this check). Reachable
    // in practice: raising Difficulty after already spending gear points
    // shrinks the budget without touching existing picks.
    const gearPointsOverBudget =
      !!this.campaignId &&
      this.gearPointsSpent(this.slots[0]) > getDifficultyDefinition(this.difficultyId).startingGearPoints;
    const valid = !invalidNames && incompleteSlot === -1 && unspentBackgroundSlot === -1 && !gearPointsOverBudget;
    this.partyValid = valid;

    // Party Creation Overhaul Plan 8: `OrnateButtonHandle` has no direct
    // green/gray fill-swap equivalent — `setDisabled` alone carries the
    // valid/invalid read (see `buildStartButton`'s own comment).
    this.startHandle.setDisabled(!valid);
    this.statusText.setText(
      valid
        ? ""
        : blankName
          ? "Every hero needs a name."
          : duplicateNames
            ? "Every hero needs a unique name."
            : incompleteSlot !== -1
              ? `Hero ${incompleteSlot + 1} still has unassigned ability scores (Standard Array).`
              : unspentBackgroundSlot !== -1
                ? `Hero ${unspentBackgroundSlot + 1} still needs to pick an Ability Bonus (the button next to Background).`
                : "Gear Points over budget — remove some gear or lower the difficulty.",
    );

    this.refreshSaveControls(valid);
  }

  /**
   * Phase 9 (D-083): keep the Save Party button/label and the save-status
   * line in sync with `partyValid` and whether a NEW save would exceed
   * `MAX_SAVE_SLOTS` (updating an already-loaded slot is always allowed —
   * the cap only blocks creating another one).
   */
  private refreshSaveControls(valid: boolean): void {
    const atCap = !this.loadedSlotId && this.saveFile.slots.length >= MAX_SAVE_SLOTS;
    this.savePartyHandle.setLabel(this.loadedSlotId ? "Update Saved Party" : "Save New Party");
    this.savePartyHandle.setDisabled(!(valid && !atCap));

    const currentSlot = this.loadedSlotId ? getSaveSlot(this.saveFile, this.loadedSlotId) : undefined;
    this.saveStatusLabel.setText(
      currentSlot
        ? `Saved as "${currentSlot.name}"`
        : atCap
          ? "Save slots full (max 6) — delete one first"
          : "Unsaved party",
    );
  }

  /** D-206: "+2 Strength, +1 Dexterity" or "+1 to all three" — shared by the ability-bonus picker's own option list and its button's current-choice label. */
  private backgroundAbilityChoiceLabel(choice: Partial<Record<AbilityScoreId, number>>): string {
    const entries = Object.entries(choice) as [AbilityScoreId, number][];
    if (entries.length === 3) return "+1 to all three";
    return entries.map(([ability, amount]) => `+${amount} ${ABILITY_SCORE_NAMES[ability]}`).join(", ");
  }

  private refreshSlot(slot: number, build: CharacterBuild): void {
    const w = this.widgets[slot];
    // Party Creation Overhaul Plan 5.2 (D-198): plain gray text with zero
    // color-coding made the state and its clickability both easy to miss
    // (Kevin's own playtest note). Reuses `createOrnateButton`'s existing
    // `setSelected` (gilt border + brighter fill vs. the plain bronze/wood
    // idle look) as the "AI" state's distinct background, rather than
    // inventing a new icon/asset this environment can't produce — the same
    // "reuse an existing component" precedent as every other Plan 5-8 UI
    // addition in this scene.
    const isAiControlled = build.controlledBy === "ai";
    w.controlHandle.setLabel(`Hero ${slot + 1} — ${isAiControlled ? "AI-Controlled" : "Human-Controlled"}`);
    w.controlHandle.setSelected(isAiControlled);
    // D-147 (piece 2): the name field is a live-typed DOM `<input>`, not a
    // Text label re-rendered from `build.name` — writing to it here would
    // fight the player's own typing/cursor position. Nothing to set.
    // Party Creation Overhaul Plan 3.2: excludes slot 0 — a returning PC is
    // also `identityLocked` now, but is never a "(Companion)". Plan 3.4:
    // once this campaign's been cleared once, a companion's stats unlock —
    // the tag says so, since otherwise the only signal is the ability-score
    // buttons quietly starting to work.
    const isUnlockedCompanion = slot !== 0 && this.slots[slot].identityLocked && !this.slots[slot].abilityScoreLocked;
    const companionTag =
      slot !== 0 && this.slots[slot].identityLocked ? (isUnlockedCompanion ? " (Companion — Stats Unlocked)" : " (Companion)") : "";
    // Party Creation Overhaul Plan 8: `OrnateButtonHandle.setLabel` already
    // auto-shrinks to fit the button's fixed width (same 9px floor
    // `fitLabelToColumnWidth` used) — the old explicit shrink-to-fit calls
    // for Class/Race/the first ability row/Subclass are no longer needed.
    w.classHandle.setLabel(`Class: ${getClassDefinition(build.classId).name}${companionTag}`);
    w.raceHandle.setLabel(`Race: ${getRaceDefinition(build.raceId).name}`);
    // D-206: `build.backgroundId` is only undefined for a pre-D-206 build
    // that somehow reached this method without going through
    // `slotStateFromBuild`'s own fallback (shouldn't normally happen) —
    // defensively falls back to the same index-0 default that path uses.
    w.backgroundHandle.setLabel(`Background: ${getBackgroundDefinition(build.backgroundId ?? BACKGROUND_IDS[0]).name}`);
    const backgroundAbilityChoice = this.slots[slot].backgroundAbilityChoice;
    w.backgroundAbilityHandle.setLabel(
      `Ability Bonus: ${backgroundAbilityChoice ? this.backgroundAbilityChoiceLabel(backgroundAbilityChoice) : "not chosen"}`,
    );
    // Party Creation Overhaul Plan 1.2: this hero's own method pill.
    const method = this.slots[slot].abilityScoreMethod;
    w.abilityMethodHandle.setLabel(method === "pointBuy" ? "Point Buy" : "Standard Array");

    const isStandardArray = method === "standardArray";
    ABILITY_SCORE_IDS.forEach((ability) => {
      const score = build.abilityScores[ability];
      const mod = modifierFor(build.abilityScores, ability);
      const modText = mod >= 0 ? `+${mod}` : `${mod}`;
      const abbrev = ABILITY_SCORE_NAMES[ability].slice(0, 3).toUpperCase();
      const text = `${abbrev} ${score} (${modText})`;
      // Party Creation Overhaul Plan 1.1: an unset ("—") Standard Array
      // ability shows the raw placeholder, not a modifier computed off the
      // 10-placeholder `allocator.scores()` fills in for preview math.
      const isUnset =
        isStandardArray && (this.slots[slot].allocator as StandardArrayAllocator).valueFor(ability) === null;
      w.standardArrayHandles[ability].setLabel(isUnset ? `${abbrev} —` : text);
      // Party Creation Overhaul Plan 8: Point Buy's value readout is a plain
      // Text squeezed between the minus/plus buttons (a narrower slot than
      // the full column width) — still needs explicit overflow protection,
      // unlike the button-owned labels above.
      w.pointBuyValueLabels[ability].setText(text);
      this.fitLabelToColumnWidth(w.pointBuyValueLabels[ability], 13, 160);
    });

    // Playtest fix (Party Creation Overhaul, Plan 0): now its own row
    // (see `pointsLeftLabel` in `buildSlotUi`) instead of appended onto the
    // STR row's own text, which used to push STR itself off the button.
    w.pointsLeftLabel.setText(
      method === "pointBuy"
        ? `Points Left: ${(this.slots[slot].allocator as PointBuyAllocator).remainingPoints()}/${POINT_BUY_BUDGET}`
        : "",
    );

    // D-193: summarize every populated slot (skipping "None" ones). A short
    // list (<=3, the common case) is spelled out by name; more than that
    // (up to all 10) collapses to a count instead — 10 full item names
    // would never fit a hero-column button even at the auto-shrink floor.
    const gearNames = GEAR_SLOT_IDS.map((slotId) => build.startingGearIds?.[slotId])
      .filter((id): id is string => !!id)
      .map((id) => getEquipmentDefinition(id).name);
    w.gearHandle.setLabel(
      gearNames.length === 0
        ? "Gear: None"
        : gearNames.length <= 3
          ? `Gear: ${gearNames.join(", ")}`
          : `Gear: ${gearNames.length}/${GEAR_SLOT_IDS.length} equipped`,
    );

    // Party Creation Overhaul Plan 2.3: how many of this slot's gear slots
    // are currently drawing from the shared pool this session — the pool
    // button is already hidden entirely outside campaign mode/an empty pool
    // (see `buildSlotUi`), so this only ever renders when it's meaningful.
    const poolCount = Object.values(this.slots[slot].poolGearIds ?? {}).filter((id): id is string => !!id).length;
    w.poolHandle.setLabel(poolCount === 0 ? "Pool: —" : `Pool: ${poolCount} drawn`);

    w.subclassHandle.setLabel(this.subclassSummary(build.classId, build.subclassId, this.slots[slot].levelUpPlan));

    const def = heroDefinitionFromBuild(build);
    // D-129: the HP preview reflects the chosen Starting Level, not always
    // level 1 — `combatStatsForClassLevel` is the same pure function
    // `heroDefinitionFromBuild` itself calls, just re-run at `startingLevel`
    // instead of the build's fixed `level: 1`. Move doesn't change by level,
    // so it still comes from `def` unchanged.
    const leveledStats = combatStatsForClassLevel(build.classId, build.startingLevel ?? 1, build.abilityScores);
    // Party Creation Overhaul Plan 4: ATK/Range replaced with AC — ATK was a
    // flat class/ability-mod number that never factored in equipped weapons,
    // and Range was purely melee-vs-ranged off the class's fixed attack
    // style, never the real weapon-aware range every other surface in the
    // game uses. AC folds in equipped gear/subclass/feat bonuses correctly
    // (`Hero.armorClass`), so it's computed off a real scratch `Hero`
    // fast-forwarded to this hero's Starting Level under its own level-up
    // plan — same precedent as `simulateHeroUpToChoice`/the planner UI, so
    // this preview genuinely reflects ASI-granted feats (e.g. Defense
    // fighting style) once a plan resolves them, not just level-1 gear.
    const previewHero = simulateHeroForPlanning(build, this.slots[slot].levelUpPlan, build.startingLevel ?? 1);
    w.statsLabel.setText(`HP ${leveledStats.maxHealth}  AC ${previewHero.armorClass}\nMove ${def.movementTiles}`);
    w.levelHandle.setLabel(`Starting Level: ${build.startingLevel ?? 1}`);

    // Party Creation Overhaul Plan 6.4 (D-199): "which plan" (this button)
    // and "how it's applied" (`cadenceHandle`) are now two independent
    // controls — "Plan Levels" itself no longer carries mode text.
    w.planHandle.setLabel("Plan Levels");
    const plan = this.slots[slot].levelUpPlan;
    const cadenceLabel = plan.mode === "auto" ? "Auto" : plan.mode === "prompt" ? "Prompt" : "Fresh";
    w.cadenceHandle.setLabel(`Cadence: ${cadenceLabel}`);
    w.cadenceHandle.setDisabled(isAiControlled);

    w.spellsHandle.setLabel(this.spellsSummary(slot, build.classId, build.startingLevel ?? 1));

    // D-204: static labels — this row's meaning never depends on the slot's
    // own state (unlike Gear's live item count), it just needs re-setting
    // here like every other button (`createOrnateButton` starts blank).
    w.saveCharacterHandle.setLabel("Save Character");
    w.loadCharacterHandle.setLabel("Load Character");
  }

  /**
   * D-135: "Spells" row summary — N/A (dim) for a class with no real spell
   * pick to make at this level (see `spellPickStepsForClass`'s own doc
   * comment for why Paladin/Ranger land here despite having a real spell
   * slot economy), otherwise whether the player has customized any of the
   * three fields yet.
   */
  private spellsSummary(slot: number, classId: string, level: number): string {
    if (spellPickStepsForClass(classId, level).length === 0) return "Spells: N/A";
    const picks = this.slots[slot].spellPicks;
    const customized = picks.cantripIds || picks.leveledSpellIds || picks.spellbookIds;
    return customized ? "Spells: Customized (click to edit)" : "Spells: Auto-fill (click to customize)";
  }

  /**
   * Phase 13.11 (D-096): originally the third stats-preview line; Phase 14.2
   * (D-099) split it into its own clickable row. A level-1-choice class
   * (Cleric/Sorcerer/Warlock) now names the ACTUAL chosen subclass — a real
   * pick between two options, not an auto-assignment — with a "(click to
   * change)" hint; every other class still names the level its own
   * confirmation will appear at in battle, plus how many options it has.
   */
  /**
   * D-147 (piece 5): a later-choice class's subclass isn't just "unavailable
   * at creation" — it's already plannable ahead of time via the "Plan
   * Levels" wizard (D-133), which this label now says explicitly instead of
   * only naming the in-battle fallback level/option count.
   *
   * Playtest fix (Party Creation Overhaul, Plan 0): all three variants used
   * to run noticeably long (e.g. `Subclass: Circle of the Ashen Veil
   * (click to change)` or the full `pick via "Plan Levels" below, or in
   * battle at level N (M options)` sentence) — long enough to still overrun
   * the row even at `fitLabelToColumnWidth`'s 9px font floor, since that
   * helper only shrinks a single line, it doesn't wrap or truncate.
   * Shortened all three so they reliably fit without losing information.
   */
  private subclassSummary(classId: string, subclassId: string | undefined, plan: LevelUpPlan): string {
    const options = subclassesForClass(classId);
    if (subclassId) {
      const hint = options.length > 1 ? " (change)" : "";
      return `Subclass: ${getSubclassDefinition(subclassId).name}${hint}`;
    }
    const classDef = getClassDefinition(classId);
    if (plan.subclassId) {
      return `Subclass: ${getSubclassDefinition(plan.subclassId).name} (planned)`;
    }
    return `Subclass: Lv ${classDef.subclassChoiceLevel} in battle (${options.length} opts)`;
  }

  /**
   * Playtest fix: this label's text is computed (a class name, a level
   * number, an option count all vary), and the longer "chosen in battle at
   * level N (M options)" phrasing measured wider than its own
   * `COLUMN_WIDTH - 20` button at the fixed 13px it was created with — it ran
   * over the tile on both sides. Shrinks the font (same measure-then-shrink
   * approach as `BattleScene.fitBannerToWidth`) to whatever the real text
   * width needs, rather than guessing a smaller fixed size that would still
   * break the moment the phrasing changes again.
   *
   * D-147 (piece 3): also applied to the Class/Race row labels and the
   * first ability-score row's label — same "computed text, fixed-width
   * button" overflow risk, same fix. (Point Buy's "Points Left" readout
   * used to ride on the STR row's own text here too; Party Creation
   * Overhaul Plan 0 gave it its own dedicated row instead — see
   * `pointsLeftLabel` in `buildSlotUi` — since a long enough string could
   * still overrun even at this helper's 9px font floor.)
   *
   * Playtest fix (Party Creation Overhaul, Plan 0): `baseFontSizePx` is now
   * a parameter — the Race row was reported too small to read at the
   * original fixed 13px, so it opts into a slightly larger starting size
   * (still shrinking from there if it would otherwise overflow) instead of
   * every row being forced to the same base size.
   *
   * Party Creation Overhaul Plan 8: `maxWidthPx` is now a parameter too —
   * every remaining caller is Point Buy's ability-score value readout,
   * squeezed into the narrower gap between the minus/plus buttons rather
   * than the full column width the default still assumes.
   */
  private fitLabelToColumnWidth(
    label: Phaser.GameObjects.Text,
    baseFontSizePx = 13,
    maxWidthPx = COLUMN_WIDTH - 20 - 8,
  ): void {
    const maxWidth = maxWidthPx;
    const minFontSizePx = 9;
    label.setFontSize(baseFontSizePx);
    let size = baseFontSizePx;
    while (label.width > maxWidth && size > minFontSizePx) {
      size -= 1;
      label.setFontSize(size);
    }
  }

  /**
   * D-194: total point-buy cost of everything currently in `s.gearIndices`
   * — only meaningful for the campaign PC (a companion never populates
   * `gearIndices` at all, see the `identityLocked` guard on the Gear
   * button), but harmless to call for any slot.
   */
  private gearPointsSpent(s: SlotState): number {
    return GEAR_SLOT_IDS.reduce((total, slotId) => {
      const index = s.gearIndices[slotId];
      if (!index) return total;
      const itemId = startingGearIdsForSlotType(gearSlotType(slotId))[index - 1];
      return total + startingGearPointCost(getEquipmentDefinition(itemId).rarity);
    }, 0);
  }

  /**
   * D-193 (Party Creation Overhaul Plan 2): the real per-slot starting-gear
   * picker — every one of the 10 gear slots (`GEAR_SLOT_IDS`) independently
   * pickable, Kevin's explicit call expanding past this item's original
   * weapon/chest/third-slot-only scope. No slot is class-gated. Deliberately
   * built on `renderPlanPrompt` directly rather than `openChoicePicker`
   * (below): that wrapper tears down the whole overlay right after any
   * option's `onPick()` returns, which would break a picker-inside-a-picker
   * — the same multi-step-wizard pattern `openLevelPlanner`'s screens
   * already use.
   *
   * D-194: a campaign companion never reaches this method (the Gear
   * button's own `identityLocked` guard stops it before this call) — the
   * only slot that can reach it in campaign mode is the PC, so
   * `this.campaignId` alone is enough to mean "point-buy applies here."
   * Free Play/manual Create Party is completely unaffected (no cost
   * labels, nothing omitted, identical to D-193's original behavior).
   */
  private openGearPicker(slot: number): void {
    const s = this.slots[slot];
    const pointBuy = !!this.campaignId;
    const title = pointBuy
      ? `Choose Starting Gear — Gear Points: ${this.gearPointsSpent(s)}/${getDifficultyDefinition(this.difficultyId).startingGearPoints}`
      : "Choose Starting Gear";
    this.renderPlanPrompt(title, [
      ...GEAR_SLOT_IDS.map((slotId) => {
        const pool = startingGearIdsForSlotType(gearSlotType(slotId));
        const index = s.gearIndices[slotId] ?? 0;
        const itemName = index > 0 ? getEquipmentDefinition(pool[index - 1]).name : "None";
        return {
          label: `${GEAR_SLOT_LABELS[slotId]}: ${itemName}`,
          onClick: () => this.openGearItemPicker(slot, slotId, pool),
        };
      }),
      {
        label: "Done",
        onClick: () => {
          this.clearLevelPlanOverlay();
          this.refreshAll();
        },
      },
    ]);
  }

  /**
   * D-193: one slot's item list, reached from `openGearPicker` — picking
   * (or "None") applies immediately and returns to the 10-row Gear menu.
   *
   * D-194: in campaign mode (point-buy — see `openGearPicker`'s own
   * comment), every item's label gets its point cost appended, and any
   * item whose cost would net-overspend the PC's budget (accounting for
   * the points this very slot's own current pick would free up) is
   * omitted from the list entirely — a swap that overspends never even
   * appears as an option. "None" is always free and always shown.
   */
  private openGearItemPicker(slot: number, slotId: GearSlotId, pool: string[]): void {
    const s = this.slots[slot];
    const pointBuy = !!this.campaignId;
    const budget = pointBuy ? getDifficultyDefinition(this.difficultyId).startingGearPoints : Infinity;
    const currentIndex = s.gearIndices[slotId] ?? 0;
    const currentItemId = currentIndex > 0 ? pool[currentIndex - 1] : undefined;
    const currentCost = currentItemId ? startingGearPointCost(getEquipmentDefinition(currentItemId).rarity) : 0;
    // Points available for a NEW pick in this slot: the budget minus
    // everything spent elsewhere (i.e. minus everything spent, plus back
    // whatever this slot itself currently costs).
    const availableForThisSlot = budget - this.gearPointsSpent(s) + currentCost;
    this.renderPlanPrompt(`Choose ${GEAR_SLOT_LABELS[slotId]}`, [
      {
        label: "None",
        highlighted: (s.gearIndices[slotId] ?? 0) === 0,
        onClick: () => {
          delete s.gearIndices[slotId];
          this.openGearPicker(slot);
        },
      },
      ...pool
        .map((id, i) => ({ id, i, cost: startingGearPointCost(getEquipmentDefinition(id).rarity) }))
        .filter(({ cost }) => !pointBuy || cost <= availableForThisSlot)
        .map(({ id, i, cost }) => ({
          label: pointBuy ? `${getEquipmentDefinition(id).name} (${cost} pt${cost === 1 ? "" : "s"})` : getEquipmentDefinition(id).name,
          highlighted: (s.gearIndices[slotId] ?? 0) === i + 1,
          onClick: () => {
            s.gearIndices[slotId] = i + 1;
            // D-204: the SRD grip rule — a Two-Handed weapon needs both
            // hands, so it can't coexist with anything in the other hand
            // slot. Force-clears the conflicting slot instead of rejecting
            // the pick (BattleScene's mid-battle equip flow rejects instead —
            // this is Character Creation's own, more forgiving, pre-battle
            // picker).
            if (slotId === "weapon" && isTwoHandedWeapon(id)) delete s.gearIndices.shield;
            if (slotId === "shield") {
              const weaponIndex = s.gearIndices.weapon;
              const weaponId = weaponIndex ? startingGearIdsForSlotType("weapon")[weaponIndex - 1] : undefined;
              if (weaponId && isTwoHandedWeapon(weaponId)) delete s.gearIndices.weapon;
            }
            this.openGearPicker(slot);
          },
        })),
      { label: "◀ Back", onClick: () => this.openGearPicker(slot) },
    ]);
  }

  /**
   * Party Creation Overhaul Plan 2.3: this hero's "draw from the shared
   * party inventory" menu — one row per gear slot, same two-level shape as
   * `openGearPicker`/`openGearItemPicker` above, just sourced from
   * `this.partyInventorySnapshot` instead of the static catalogue. Available
   * to every active slot regardless of `gearLocked` — a companion's fixed
   * catalogue kit and the pool are two independent gear sources.
   */
  private openPoolPicker(slot: number): void {
    const claimedElsewhere: Set<string> = new Set(
      this.slots.flatMap((s2, i2) => (i2 === slot ? [] : Object.values(s2.poolGearIds ?? {}))),
    );
    this.renderPlanPrompt("Draw From Party Inventory", [
      ...GEAR_SLOT_IDS.map((slotId) => {
        const claimedId = this.slots[slot].poolGearIds?.[slotId];
        const claimedEntry = claimedId ? this.partyInventorySnapshot.find((e) => e.id === claimedId) : undefined;
        const label = claimedEntry ? getEquipmentDefinition(claimedEntry.itemId).name : "—";
        return {
          label: `${GEAR_SLOT_LABELS[slotId]}: ${label}`,
          onClick: () => this.openPoolItemPicker(slot, slotId, claimedElsewhere),
        };
      }),
      {
        label: "Done",
        onClick: () => {
          this.clearLevelPlanOverlay();
          this.refreshAll();
        },
      },
    ]);
  }

  /**
   * One slot's pool item list, reached from `openPoolPicker` — picking (or
   * "None") applies immediately and returns to the 10-row pool menu.
   * `claimedElsewhere` (every OTHER slot's current pool picks, computed once
   * by the caller) is excluded so two hero slots can never claim the same
   * pool entry at once.
   */
  private openPoolItemPicker(slot: number, slotId: GearSlotId, claimedElsewhere: Set<string>): void {
    const s = this.slots[slot];
    const matching = this.partyInventorySnapshot.filter(
      (e) => getEquipmentDefinition(e.itemId).slot === gearSlotType(slotId) && !claimedElsewhere.has(e.id),
    );
    this.renderPlanPrompt(`Choose ${GEAR_SLOT_LABELS[slotId]} From Pool`, [
      {
        label: "None",
        highlighted: !s.poolGearIds?.[slotId],
        onClick: () => {
          if (s.poolGearIds) delete s.poolGearIds[slotId];
          this.openPoolPicker(slot);
        },
      },
      ...matching.map((e) => ({
        label: `${getEquipmentDefinition(e.itemId).name} (from ${getCompanionDefinition(e.originCompanionId).name})`,
        highlighted: s.poolGearIds?.[slotId] === e.id,
        onClick: () => {
          s.poolGearIds = { ...s.poolGearIds, [slotId]: e.id };
          this.openPoolPicker(slot);
        },
      })),
      { label: "◀ Back", onClick: () => this.openPoolPicker(slot) },
    ]);
  }

  /**
   * D-147: a general-purpose "pick one from a list" overlay — replaces the
   * old click-to-cycle interaction for Class/Race/Gear/Subclass. Reuses
   * `renderPlanPrompt` directly (the same dim-backdrop/title/button-grid
   * primitive the Level Planner and Spell Picker wizards already share via
   * `levelPlanOverlay`/`clearLevelPlanOverlay`), but unlike those multi-step
   * wizards this is always exactly one screen: picking an option applies it
   * and closes the overlay immediately, or Cancel discards the click.
   */
  private openChoicePicker(
    title: string,
    options: Array<{ label: string; desc?: string; highlighted?: boolean; onPick: () => void }>,
  ): void {
    this.renderPlanPrompt(title, [
      ...options.map((opt) => ({
        label: opt.label,
        desc: opt.desc,
        highlighted: opt.highlighted,
        onClick: () => {
          opt.onPick();
          this.clearLevelPlanOverlay();
          this.refreshAll();
        },
      })),
      { label: "Cancel", onClick: () => this.clearLevelPlanOverlay() },
    ]);
  }

  /** Party Creation Overhaul Plan 1.1: closes whichever ability-score dropdown is currently open, if any. Safe to call when none is open. */
  private closeDropdown(): void {
    this.openDropdown?.close();
    this.openDropdown = null;
  }

  /**
   * Party Creation Overhaul Plan 1.1: a small dropdown anchored just below
   * one Standard Array row, offering the 6 standard values (15/14/13/12/10/8)
   * plus "—" (unset). No existing `uiTheme.ts` component fits — `
   * renderChoiceOverlay`/`openChoiceList` are both full-screen centered
   * modals — so this is scene-local and deliberately simple: always opens
   * directly below the trigger row (verified against real layout numbers —
   * even the lowest ability row leaves ample room above `gearY`, so a
   * flip-to-above branch isn't needed), with one defensive clamp if it would
   * ever run past the bottom of the viewport.
   */
  private openAbilityDropdown(slot: number, ability: AbilityScoreId, anchorX: number, anchorY: number): void {
    this.closeDropdown();

    const rowHeight = 24;
    const rowGap = 4;
    const panelWidth = COLUMN_WIDTH - 20;
    const values: Array<number | null> = [...STANDARD_ARRAY, null];
    const panelHeight = values.length * (rowHeight + rowGap) + rowGap + 10;

    const { width: viewportWidth, height: viewportHeight } = getViewport(this);
    let panelTop = anchorY + 18;
    if (panelTop + panelHeight > viewportHeight - 20) panelTop = viewportHeight - 20 - panelHeight;
    const panelCenterY = panelTop + panelHeight / 2;

    const objects: Phaser.GameObjects.GameObject[] = [];
    // Full-canvas invisible click-away-to-close catcher — same modal-dismiss
    // pattern `renderChoiceOverlay`'s own `dim` rectangle already uses.
    const catcher = this.add
      .rectangle(viewportWidth / 2, viewportHeight / 2, viewportWidth, viewportHeight, 0x000000, 0)
      .setDepth(79)
      .setInteractive();
    catcher.on("pointerdown", () => this.closeDropdown());
    objects.push(catcher);

    const panel = drawParchmentPanel(this, anchorX, panelCenterY, panelWidth, panelHeight, 80);
    objects.push(panel);

    const allocator = this.slots[slot].allocator as StandardArrayAllocator;
    const currentValue = allocator.valueFor(ability);
    values.forEach((value, i) => {
      const rowY = panelTop + rowGap + rowHeight / 2 + i * (rowHeight + rowGap);
      const handle = createOrnateButton(
        this,
        anchorX,
        rowY,
        panelWidth - 16,
        rowHeight,
        value === null ? "—" : `${value}`,
        () => {
          allocator.assign(ability, value);
          this.closeDropdown();
          this.refreshAll();
        },
        { variant: "tool", depth: 81 },
      );
      handle.setSelected(value === currentValue);
      objects.push(handle.container);
    });

    this.openDropdown = {
      close: () => objects.forEach((o) => o.destroy()),
    };
  }

  // ---------------------------------------------------------------------
  // D-133: the level-by-level Character Creation planner. A full-screen
  // wizard overlay — the same button-grid modal shape `BattleScene
  // .renderAsiPrompt` established for its own in-battle ASI/subclass/
  // spell-pick queues, reimplemented locally (this scene has no mechanism
  // to share a private method from another scene) — that walks the player
  // through every future level-up choice point for the slot's current
  // class (`LevelUpPlanSystem.futureChoiceSteps`), storing picks into a
  // working draft only committed to `slots[slot].levelUpPlan` on a
  // confirmed "Save & Close."
  // ---------------------------------------------------------------------

  private openLevelPlanner(slot: number): void {
    this.planningSlot = slot;
    const existing = this.slots[slot].levelUpPlan;
    this.planningDraft = {
      mode: existing.mode,
      subclassId: existing.subclassId,
      asiChoices: { ...existing.asiChoices },
      spellPicks: { ...existing.spellPicks },
      spellSwaps: { ...existing.spellSwaps },
    };
    this.planningBlueprintId = undefined;
    const classId = CREATABLE_CLASS_IDS[this.slots[slot].classIndex];
    this.planningSteps = futureChoiceSteps(classId);
    this.planningStepIndex = 0;
    this.showBlueprintEntryChoice();
  }

  private closeLevelPlanner(commit: boolean): void {
    if (commit && this.planningSlot !== null) {
      this.slots[this.planningSlot].levelUpPlan = this.planningDraft;
    }
    this.planningSlot = null;
    this.clearLevelPlanOverlay();
    this.refreshAll();
  }

  private clearLevelPlanOverlay(): void {
    clearChoiceOverlay(this.levelPlanOverlay);
    this.setNameInputsVisible(true);
  }

  /**
   * The 4 hero-name fields are real HTML `<input>` DOM elements (Phaser's
   * DOM plugin renders them in a layer above the canvas, outside normal
   * depth sorting), so they'd otherwise stay visible on top of every
   * full-screen picker/wizard overlay `renderPlanPrompt` draws.
   */
  private setNameInputsVisible(visible: boolean): void {
    for (const w of this.widgets) {
      w.nameInputNode.style.visibility = visible ? "visible" : "hidden";
    }
  }

  /**
   * Party Creation Overhaul Plan 6.2 (D-199): the wizard's real first
   * screen now — Auto/Prompted/Fresh moved OUT to the per-hero `cadenceHandle`
   * pill (Plan 6.4), decoupled from "which plan" entirely. Three ways in:
   * a fresh one-off blueprint, a saved one from the library (Edit or Use
   * As-Is), or today's plain throwaway per-character plan (unchanged).
   */
  private showBlueprintEntryChoice(): void {
    const classId = CREATABLE_CLASS_IDS[this.slots[this.planningSlot as number].classIndex];
    const className = getClassDefinition(classId).name;
    this.renderPlanPrompt(`Plan Levels — ${className}`, [
      {
        label: "Create a New Blueprint",
        desc: "Build a fresh future level-up plan for this hero, from scratch — you'll be offered a chance to save it to the library at the end.",
        onClick: () => {
          this.planningDraft = emptyLevelUpPlan(this.planningDraft.mode);
          this.planningBlueprintId = undefined;
          this.planningStepIndex = 0;
          this.showNextPlanStep();
        },
      },
      {
        label: "Select a Saved Blueprint",
        desc: "Reuse or edit a blueprint already saved for this class — global to every save/campaign.",
        onClick: () => this.showBlueprintPicker(),
      },
      {
        label: "No Blueprint",
        desc: "Just build/edit this hero's own one-off plan, exactly as before — nothing saved to the library unless you choose to at the end.",
        onClick: () => {
          this.planningStepIndex = 0;
          this.showNextPlanStep();
        },
      },
      {
        label: "Cancel",
        desc: "Discard any changes made in this session and keep this hero's previously saved plan.",
        onClick: () => this.closeLevelPlanner(false),
      },
    ]);
  }

  /** Plan 6.2: lists every blueprint saved for this hero's current class. */
  private showBlueprintPicker(): void {
    const classId = CREATABLE_CLASS_IDS[this.slots[this.planningSlot as number].classIndex];
    const library = loadBlueprintLibrary(window.localStorage, BLUEPRINT_LIBRARY_STORAGE_KEY);
    const options = blueprintsForClass(library, classId);
    if (options.length === 0) {
      this.renderPlanPrompt("Select a Saved Blueprint", [
        { label: "No blueprints saved for this class yet.", onClick: () => {} },
        { label: "◀ Back", onClick: () => this.showBlueprintEntryChoice() },
      ]);
      return;
    }
    this.renderPlanPrompt(
      "Select a Saved Blueprint",
      options
        .map((bp) => ({ label: bp.name, onClick: () => this.showBlueprintSubmenu(bp) }))
        .concat([{ label: "◀ Back", onClick: () => this.showBlueprintEntryChoice() }]),
    );
  }

  /** Plan 6.2: Use As-Is (apply and close immediately) / Edit (load into the wizard) / Delete (two-click confirm, no timer) / Back. */
  private showBlueprintSubmenu(blueprint: LevelUpBlueprint): void {
    const armed = this.blueprintDeleteArmedId === blueprint.id;
    this.renderPlanPrompt(`Blueprint: ${blueprint.name}`, [
      {
        label: "Use As-Is",
        desc: "Apply this blueprint's choices to this hero immediately — skips the wizard entirely.",
        onClick: () => {
          this.blueprintDeleteArmedId = null;
          // Plan 6.4: mode is always this hero's OWN cadence setting, never
          // the blueprint's own frozen one — see LevelUpPlanSystem.ts's
          // `LevelUpPlan.mode` doc comment for why.
          this.planningDraft = { ...blueprint.plan, mode: this.planningDraft.mode };
          this.closeLevelPlanner(true);
        },
      },
      {
        label: "Edit",
        desc: "Load this blueprint into the planner so you can tweak it before applying.",
        onClick: () => {
          this.blueprintDeleteArmedId = null;
          this.planningDraft = {
            ...blueprint.plan,
            mode: this.planningDraft.mode,
            asiChoices: { ...blueprint.plan.asiChoices },
            spellPicks: { ...blueprint.plan.spellPicks },
            spellSwaps: { ...blueprint.plan.spellSwaps },
          };
          this.planningBlueprintId = blueprint.id;
          this.planningStepIndex = 0;
          this.showNextPlanStep();
        },
      },
      {
        label: armed ? "Confirm Delete?" : "Delete",
        desc: armed
          ? "Click again to permanently remove this blueprint from the library."
          : "Permanently remove this blueprint from the library.",
        onClick: () => {
          if (!armed) {
            this.blueprintDeleteArmedId = blueprint.id;
            this.showBlueprintSubmenu(blueprint);
            return;
          }
          const library = loadBlueprintLibrary(window.localStorage, BLUEPRINT_LIBRARY_STORAGE_KEY);
          saveBlueprintLibrary(window.localStorage, BLUEPRINT_LIBRARY_STORAGE_KEY, deleteBlueprint(library, blueprint.id));
          this.blueprintDeleteArmedId = null;
          this.showBlueprintPicker();
        },
      },
      {
        label: "◀ Back",
        onClick: () => {
          this.blueprintDeleteArmedId = null;
          this.showBlueprintPicker();
        },
      },
    ]);
  }

  /**
   * Plan 6.3: offered from `showPlanDoneScreen` — saving is always a
   * distinct extra step, never implied by "Save & Close" (which stays
   * this-hero-only, unchanged, per the plan's own "applying without saving
   * stays the default" framing).
   */
  private showBlueprintSaveScreen(): void {
    if (this.planningBlueprintId !== undefined) {
      const classId = CREATABLE_CLASS_IDS[this.slots[this.planningSlot as number].classIndex];
      const library = loadBlueprintLibrary(window.localStorage, BLUEPRINT_LIBRARY_STORAGE_KEY);
      const existing = blueprintsForClass(library, classId).find((bp) => bp.id === this.planningBlueprintId);
      if (existing) {
        this.renderPlanPrompt("Save Blueprint", [
          {
            label: `Update "${existing.name}"`,
            desc: "Overwrites this blueprint's saved choices with what you just built.",
            onClick: () => {
              const next = upsertBlueprint(library, { ...existing, plan: this.planningDraft });
              saveBlueprintLibrary(window.localStorage, BLUEPRINT_LIBRARY_STORAGE_KEY, next);
              this.showPlanDoneScreen();
            },
          },
          {
            label: "Save as New Blueprint",
            desc: "Keeps the original blueprint untouched — saves this as a separate one instead.",
            onClick: () => this.showBlueprintNameEntryScreen(),
          },
          { label: "◀ Back", onClick: () => this.showPlanDoneScreen() },
        ]);
        return;
      }
    }
    this.showBlueprintNameEntryScreen();
  }

  /** Plan 6.3: a fresh blueprint's name — reuses the exact hero-name DOM `<input>` technique (`buildSlotUi`), cleaned up automatically by `levelPlanOverlay`'s own next-screen `clearChoiceOverlay`. */
  private showBlueprintNameEntryScreen(): void {
    const classId = CREATABLE_CLASS_IDS[this.slots[this.planningSlot as number].classIndex];
    const className = getClassDefinition(classId).name;
    let nameNode!: HTMLInputElement;
    this.renderPlanPrompt("Name This Blueprint", [
      {
        label: "Save",
        onClick: () => {
          const name = nameNode.value.trim() || `${className} Blueprint`;
          const library = loadBlueprintLibrary(window.localStorage, BLUEPRINT_LIBRARY_STORAGE_KEY);
          const id = `blueprint-${Date.now()}-${this.blueprintSaveCounter++}`;
          const next = upsertBlueprint(library, { id, name, classId, plan: this.planningDraft });
          saveBlueprintLibrary(window.localStorage, BLUEPRINT_LIBRARY_STORAGE_KEY, next);
          this.planningBlueprintId = id;
          this.showPlanDoneScreen();
        },
      },
      { label: "◀ Back", onClick: () => this.showPlanDoneScreen() },
    ]);
    const nameInput = this.add
      .dom(getViewport(this).width / 2, 140)
      .createFromHTML(
        `<input type="text" maxlength="40" placeholder="${className} Blueprint" style="
          width: 320px; height: 34px; font-size: 16px;
          font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; font-weight: bold;
          text-align: center; background: #e8d8ae; color: #2a1a10;
          border: 1px solid #5a3a20; border-radius: 4px; outline: none;
          box-sizing: border-box;
        " />`,
      )
      .setOrigin(0.5)
      .setDepth(65);
    nameNode = nameInput.node.querySelector("input") as HTMLInputElement;
    nameNode.addEventListener("keydown", (e: KeyboardEvent) => e.stopPropagation());
    this.levelPlanOverlay.push(nameInput);
  }

  /**
   * D-204: snapshot this slot's CURRENT build into the global character
   * library, named by the player — see `CharacterLibrarySystem`. Reuses the
   * exact DOM `<input>` name-entry technique `showBlueprintNameEntryScreen`
   * above already established. Available on any slot, including a locked
   * companion — unlike Load, this only READS the slot, so there's nothing
   * for a lock to protect against.
   */
  private openSaveCharacterScreen(slot: number): void {
    if (this.characterLibrary.entries.length >= MAX_LIBRARY_ENTRIES) {
      this.renderPlanPrompt("Save Character", [
        {
          label: `Library is full (${MAX_LIBRARY_ENTRIES} max) — delete a character from Load Character first.`,
          onClick: () => {},
        },
        { label: "◀ Back", onClick: () => this.clearLevelPlanOverlay() },
      ]);
      return;
    }
    const defaultName = this.slots[slot].name.trim() || "Unnamed Hero";
    let nameNode!: HTMLInputElement;
    this.renderPlanPrompt("Name This Character", [
      {
        label: "Save",
        onClick: () => {
          const name = nameNode.value.trim() || defaultName;
          const id = `character-${Date.now()}-${this.librarySaveCounter++}`;
          this.characterLibrary = upsertLibraryEntry(this.characterLibrary, {
            id,
            name,
            createdAt: Date.now(),
            build: this.buildFromSlot(slot),
          });
          saveCharacterLibrary(window.localStorage, CHARACTER_LIBRARY_STORAGE_KEY, this.characterLibrary);
          this.clearLevelPlanOverlay();
        },
      },
      { label: "◀ Back", onClick: () => this.clearLevelPlanOverlay() },
    ]);
    const nameInput = this.add
      .dom(getViewport(this).width / 2, 140)
      .createFromHTML(
        `<input type="text" maxlength="40" placeholder="${defaultName}" style="
          width: 320px; height: 34px; font-size: 16px;
          font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; font-weight: bold;
          text-align: center; background: #e8d8ae; color: #2a1a10;
          border: 1px solid #5a3a20; border-radius: 4px; outline: none;
          box-sizing: border-box;
        " />`,
      )
      .setOrigin(0.5)
      .setDepth(65);
    nameNode = nameInput.node.querySelector("input") as HTMLInputElement;
    nameNode.addEventListener("keydown", (e: KeyboardEvent) => e.stopPropagation());
    this.levelPlanOverlay.push(nameInput);
  }

  /**
   * D-204: lists every library entry (list-of-rows, same shape as
   * `showBlueprintPicker`) — clicking one opens a submenu to load it into
   * this slot or delete it from the library.
   */
  private openCharacterLibraryPicker(slot: number): void {
    if (this.characterLibrary.entries.length === 0) {
      this.renderPlanPrompt("Load Character", [
        { label: "No characters saved to the library yet.", onClick: () => {} },
        { label: "◀ Back", onClick: () => this.clearLevelPlanOverlay() },
      ]);
      return;
    }
    this.renderPlanPrompt(
      "Load Character",
      this.characterLibrary.entries
        .map((entry) => ({
          label: `${entry.name} (${getClassDefinition(entry.build.classId).name})`,
          onClick: () => this.showCharacterLibraryEntrySubmenu(slot, entry),
        }))
        .concat([{ label: "◀ Back", onClick: () => this.clearLevelPlanOverlay() }]),
    );
  }

  /** D-204: Load Into This Slot (applies immediately) / Delete (two-click confirm, no timer, same idiom as `showBlueprintSubmenu`) / Back. */
  private showCharacterLibraryEntrySubmenu(slot: number, entry: CharacterLibraryEntry): void {
    const armed = this.libraryDeleteArmedId === entry.id;
    this.renderPlanPrompt(`Character: ${entry.name}`, [
      {
        label: "Load Into This Slot",
        desc: "Overwrites this slot's class/race/ability scores/gear/level/spells with this saved character.",
        onClick: () => {
          this.libraryDeleteArmedId = null;
          // `slotStateFromBuild` already fully reconstructs a SlotState
          // (allocator, gear indices, subclass, level, level-up plan, spell
          // picks) from a CharacterBuild — same reconstruction Load Game
          // uses. Not identity/gear/ability-locked: a library-loaded
          // character is always freely editable afterward.
          this.slots[slot] = this.slotStateFromBuild(entry.build, false, false, undefined, false);
          // The name field is a real DOM <input> whose value isn't re-set by
          // `refreshSlot` (see `SlotWidgets.nameInput`'s own doc comment) —
          // sync it explicitly.
          this.widgets[slot].nameInputNode.value = this.slots[slot].name;
          this.clearLevelPlanOverlay();
          this.refreshAll();
        },
      },
      {
        label: armed ? "Confirm Delete?" : "Delete",
        desc: armed
          ? "Click again to permanently remove this character from the library."
          : "Permanently remove this character from the library.",
        onClick: () => {
          if (!armed) {
            this.libraryDeleteArmedId = entry.id;
            this.showCharacterLibraryEntrySubmenu(slot, entry);
            return;
          }
          this.characterLibrary = deleteLibraryEntry(this.characterLibrary, entry.id);
          saveCharacterLibrary(window.localStorage, CHARACTER_LIBRARY_STORAGE_KEY, this.characterLibrary);
          this.libraryDeleteArmedId = null;
          this.openCharacterLibraryPicker(slot);
        },
      },
      {
        label: "◀ Back",
        onClick: () => {
          this.libraryDeleteArmedId = null;
          this.openCharacterLibraryPicker(slot);
        },
      },
    ]);
  }

  private showNextPlanStep(): void {
    if (this.planningStepIndex >= this.planningSteps.length) {
      this.showPlanDoneScreen();
      return;
    }
    const step = this.planningSteps[this.planningStepIndex];
    if (step.kind === "subclass") this.showPlanSubclassStep(step);
    else if (step.kind === "asi") this.showPlanAsiStep(step);
    else if (step.kind === "spellSwap") this.showPlanSpellSwapStep(step);
    else this.showPlanSpellPickStep(step);
  }

  private advancePlanStep(): void {
    this.planningStepIndex += 1;
    this.showNextPlanStep();
  }

  private goBackPlanStep(): void {
    if (this.planningStepIndex === 0) {
      this.showBlueprintEntryChoice();
      return;
    }
    this.planningStepIndex -= 1;
    this.showNextPlanStep();
  }

  private showPlanDoneScreen(): void {
    this.renderPlanPrompt("Blueprint Complete", [
      { label: "Save & Close", desc: "Commits every choice made in this session to this hero.", onClick: () => this.closeLevelPlanner(true) },
      {
        label: "Save as Blueprint",
        desc: "Also save these choices to the library, for any future character of this class.",
        onClick: () => this.showBlueprintSaveScreen(),
      },
      { label: "◀ Back", onClick: () => this.goBackPlanStep() },
      { label: "Cancel", desc: "Discard this session's edits and keep the previously saved plan.", onClick: () => this.closeLevelPlanner(false) },
    ]);
  }

  private planBackChoice(): { label: string; onClick: () => void } {
    return { label: "◀ Back", onClick: () => this.goBackPlanStep() };
  }

  private planSkipChoice(): { label: string; desc: string; onClick: () => void } {
    // Party Creation Overhaul Plan 5.1 (D-198): an AI-controlled hero never
    // gets a real in-battle prompt at all (its `cadenceHandle` pill is
    // locked to "auto", Plan 6.4) — an unset level resolves to a safe
    // default automatically instead.
    const isAiControlled = this.planningSlot !== null && this.slots[this.planningSlot].controlledBy === "ai";
    return {
      label: "Skip (decide later)",
      desc: isAiControlled
        ? "Leaves this level unset — it'll resolve to a safe default automatically in battle (AI-controlled heroes never get a real prompt)."
        : "Leaves this level unset — you'll be prompted for a real choice when it comes up, regardless of this hero's mode.",
      onClick: () => this.advancePlanStep(),
    };
  }

  /**
   * Builds a scratch, throwaway `Hero` (never added to any battle) fast-
   * forwarded to exactly `atLevel`, with every trigger BELOW `atLevel`
   * resolved against `planningDraft` — but `atLevel`'s own trigger
   * deliberately left unresolved, so this method's caller can inspect real
   * eligibility (feats/spells) for the choice about to be made, then apply
   * whatever the player picks afterward.
   */
  private simulateHeroUpToChoice(atLevel: number): Hero {
    const build = this.buildsFromSlots()[this.planningSlot as number];
    const hero = new Hero(heroDefinitionFromBuild(build), { x: 0, y: 0 });
    if (atLevel > 1) {
      fastForwardHero(hero, atLevel - 1, this.planningDraft);
      if (hero.level < atLevel) hero.levelUpClass();
    }
    return hero;
  }

  private showPlanSubclassStep(step: LevelUpChoiceStep): void {
    const classId = CREATABLE_CLASS_IDS[this.slots[this.planningSlot as number].classIndex];
    const options = subclassesForClass(classId);
    this.renderPlanPrompt(`Level ${step.level} — Choose a Subclass`, [
      ...options.map((opt) => ({
        label: opt.name,
        onClick: () => {
          this.planningDraft.subclassId = opt.id;
          this.advancePlanStep();
        },
        highlighted: this.planningDraft.subclassId === opt.id,
      })),
      this.planBackChoice(),
      this.planSkipChoice(),
    ]);
  }

  private showPlanAsiStep(step: LevelUpChoiceStep): void {
    const hero = this.simulateHeroUpToChoice(step.level);
    const existing = this.planningDraft.asiChoices[step.level];
    const featChoices = FEAT_IDS.filter((id) => hero.meetsFeatPrerequisites(id)).map((id) => {
      const feat = getFeat(id);
      return {
        label: `Feat: ${feat.name}`,
        desc: feat.description,
        onClick: () => this.showPlanFeatSubChoice(step.level, id, hero),
        highlighted: existing?.path === "feat" && existing.featId === id,
      };
    });
    this.renderPlanPrompt(`Level ${step.level} — Ability Score Improvement`, [
      {
        label: "+2 to one ability",
        desc: "Raise a single ability score by 2.",
        onClick: () => this.showPlanAbilityPicker(step.level, "single"),
        highlighted: existing?.path === "ability" && existing.abilityMode === "single",
      },
      {
        label: "+1 to two abilities",
        desc: "Raise two different ability scores by 1 each.",
        onClick: () => this.showPlanAbilityPicker(step.level, "split"),
        highlighted: existing?.path === "ability" && existing.abilityMode === "split",
      },
      ...featChoices,
      this.planBackChoice(),
      this.planSkipChoice(),
    ]);
  }

  private showPlanAbilityPicker(level: number, mode: "single" | "split", firstPicked?: AbilityScoreId): void {
    if (mode === "single") {
      this.renderPlanPrompt(
        `Level ${level} — Choose an Ability (+2)`,
        ABILITY_SCORE_IDS.map((id) => ({
          label: ABILITY_SCORE_NAMES[id],
          onClick: () => {
            this.planningDraft.asiChoices[level] = { path: "ability", abilityMode: "single", ability: id };
            this.advancePlanStep();
          },
        })).concat([this.planBackChoice()]),
      );
      return;
    }
    if (firstPicked === undefined) {
      this.renderPlanPrompt(
        `Level ${level} — Choose the First Ability (+1)`,
        ABILITY_SCORE_IDS.map((id) => ({
          label: ABILITY_SCORE_NAMES[id],
          onClick: () => this.showPlanAbilityPicker(level, "split", id),
        })).concat([this.planBackChoice()]),
      );
      return;
    }
    this.renderPlanPrompt(
      `Level ${level} — Choose the Second Ability (+1)`,
      ABILITY_SCORE_IDS.filter((id) => id !== firstPicked)
        .map((id) => ({
          label: ABILITY_SCORE_NAMES[id],
          onClick: () => {
            this.planningDraft.asiChoices[level] = { path: "ability", abilityMode: "split", first: firstPicked, second: id };
            this.advancePlanStep();
          },
        }))
        .concat([this.planBackChoice()]),
    );
  }

  private showPlanFeatSubChoice(level: number, featId: string, hero: Hero): void {
    const feat = getFeat(featId);
    if (feat.abilityScoreBoost) {
      const allowed = feat.abilityScoreBoost.allowedAbilities;
      this.renderPlanPrompt(
        `Level ${level} — ${feat.name}: Choose an Ability`,
        ABILITY_SCORE_IDS.filter((id) => allowed.includes(id))
          .map((id) => ({
            label: ABILITY_SCORE_NAMES[id],
            onClick: () => this.finishPlanFeat(level, featId, { chosenAbility: id }),
          }))
          .concat([this.planBackChoice()]),
      );
      return;
    }
    if (featId === "magic-initiate") {
      const lists: Array<{ id: MagicInitiateListId; label: string }> = [
        { id: "cleric", label: "Cleric" },
        { id: "druid", label: "Druid" },
        { id: "wizard", label: "Wizard" },
      ];
      const remaining = lists.filter((l) => !hero.magicInitiateListsTaken.includes(l.id));
      this.renderPlanPrompt(
        `Level ${level} — Magic Initiate: Choose a List`,
        remaining
          .map((l) => ({
            label: l.label,
            onClick: () => this.finishPlanFeat(level, featId, { magicInitiateList: l.id }),
          }))
          .concat([this.planBackChoice()]),
      );
      return;
    }
    this.finishPlanFeat(level, featId, {});
  }

  private finishPlanFeat(
    level: number,
    featId: string,
    options: { chosenAbility?: AbilityScoreId; magicInitiateList?: MagicInitiateListId },
  ): void {
    this.planningDraft.asiChoices[level] = { path: "feat", featId, ...options };
    this.advancePlanStep();
  }

  private showPlanSpellPickStep(step: LevelUpChoiceStep): void {
    const hero = this.simulateHeroUpToChoice(step.level);
    const existing = this.planningDraft.spellPicks[step.level];

    if (step.spellPickKind === "mastery") {
      const eligible = hero.eligibleSpellMasterySpells();
      if (eligible.length === 0) {
        this.advancePlanStep(); // nothing known yet at a low enough level — mirrors the live queue's own skip
        return;
      }
      this.renderPlanPrompt(`Level ${step.level} — Spell Mastery: Choose a Spell`, [
        ...eligible.map((id) => ({
          label: getAbility(id).name,
          onClick: () => {
            this.planningDraft.spellPicks[step.level] = { kind: "mastery" as const, spellId: id };
            this.advancePlanStep();
          },
          highlighted: existing?.kind === "mastery" && existing.spellId === id,
        })),
        this.planBackChoice(),
        this.planSkipChoice(),
      ]);
    } else if (step.spellPickKind === "signature") {
      const eligible = hero.eligibleSignatureSpells();
      if (eligible.length < 2) {
        this.advancePlanStep();
        return;
      }
      this.renderPlanPrompt(`Level ${step.level} — Signature Spells: Choose the First`, [
        ...eligible.map((id) => ({
          label: getAbility(id).name,
          onClick: () => this.showPlanSignatureSecond(step.level, id, eligible),
          highlighted: existing?.kind === "signature" && existing.spellIds[0] === id,
        })),
        this.planBackChoice(),
        this.planSkipChoice(),
      ]);
    } else if (step.spellPickKind === "arcanum" && step.tier !== undefined) {
      const tier = step.tier;
      const eligible = hero.eligibleMysticArcanumSpells(tier);
      if (eligible.length === 0) {
        this.advancePlanStep();
        return;
      }
      this.renderPlanPrompt(`Level ${step.level} — Mystic Arcanum (${tier}th level)`, [
        ...eligible.map((id) => ({
          label: getAbility(id).name,
          onClick: () => {
            this.planningDraft.spellPicks[step.level] = { kind: "arcanum" as const, tier, spellId: id };
            this.advancePlanStep();
          },
          highlighted: existing?.kind === "arcanum" && existing.spellId === id,
        })),
        this.planBackChoice(),
        this.planSkipChoice(),
      ]);
    } else {
      this.advancePlanStep();
    }
  }

  private showPlanSignatureSecond(level: number, first: string, eligible: string[]): void {
    const remaining = eligible.filter((id) => id !== first);
    this.renderPlanPrompt(
      `Level ${level} — Signature Spells: Choose the Second`,
      remaining
        .map((id) => ({
          label: getAbility(id).name,
          onClick: () => {
            this.planningDraft.spellPicks[level] = { kind: "signature", spellIds: [first, id] };
            this.advancePlanStep();
          },
        }))
        .concat([this.planBackChoice()]),
    );
  }

  /**
   * Party Creation Overhaul Plan 6.5 (D-199): a level-up-triggered spell
   * swap becomes plannable — mirrors `BattleScene.showSpellPrepDropScreen`/
   * `showSpellPrepLearnScreen`'s exact two-screen drop-then-learn shape,
   * but writes into `planningDraft.spellSwaps[level]` (an array — a level
   * can need both a cantrip AND a prepared swap, e.g. Sorcerer) instead of
   * mutating a live Hero. Uses `simulateHeroUpToChoice` for real
   * eligibility, same as the ASI/spell-pick steps above.
   */
  private showPlanSpellSwapStep(step: LevelUpChoiceStep): void {
    const kind = step.spellSwapKind as SpellSwapStepKind;
    const hero = this.simulateHeroUpToChoice(step.level);
    const current = kind === "cantrips" ? hero.knownCantripIds : hero.preparedSpellIds;
    const label = kind === "cantrips" ? "Cantrip" : "Prepared Spell";
    const existing = this.planningDraft.spellSwaps[step.level]?.find((c) => c.kind === kind);
    this.renderPlanPrompt(`Level ${step.level} — Replace a ${label}`, [
      ...current.map((id) => {
        const spell = getSpell(id);
        return {
          label: spell.name,
          desc: spell.level === 0 ? "Cantrip" : `Level ${spell.level}`,
          onClick: () => this.showPlanSpellSwapLearnStep(step, kind, id),
          highlighted: existing?.dropId === id,
        };
      }),
      this.planBackChoice(),
      this.planSkipChoice(),
    ]);
  }

  private showPlanSpellSwapLearnStep(step: LevelUpChoiceStep, kind: SpellSwapStepKind, dropId: string): void {
    const classId = CREATABLE_CLASS_IDS[this.slots[this.planningSlot as number].classIndex];
    const hero = this.simulateHeroUpToChoice(step.level);
    const current = kind === "cantrips" ? hero.knownCantripIds : hero.preparedSpellIds;
    const maxLevel = this.maxCastableSpellLevel(classId, step.level);
    const pool = (
      kind === "cantrips" ? eligibleCantripPool(classId) : eligibleLeveledSpellPool(classId).filter((id) => getSpell(id).level <= maxLevel)
    ).filter((id) => !current.includes(id));
    if (pool.length === 0) {
      // Nothing eligible to learn instead — same auto-skip idiom the ASI/
      // spell-pick steps already use when there's genuinely nothing to pick.
      this.advancePlanStep();
      return;
    }
    const dropLabel = getSpell(dropId).name;
    const label = kind === "cantrips" ? "Cantrip" : "Prepared Spell";
    const existing = this.planningDraft.spellSwaps[step.level]?.find((c) => c.kind === kind);
    this.renderPlanPrompt(`Level ${step.level} — Learn a New ${label} (replacing ${dropLabel})`, [
      ...pool.map((id) => {
        const spell = getSpell(id);
        return {
          label: spell.name,
          desc: spell.level === 0 ? "Cantrip" : `Level ${spell.level}`,
          onClick: () => {
            const others = this.planningDraft.spellSwaps[step.level]?.filter((c) => c.kind !== kind) ?? [];
            const choice: LevelUpSpellSwapChoice = { kind, dropId, learnId: id };
            this.planningDraft.spellSwaps[step.level] = [...others, choice];
            this.advancePlanStep();
          },
          highlighted: existing?.dropId === dropId && existing.learnId === id,
        };
      }),
      { label: "◀ Back", onClick: () => this.showPlanSpellSwapStep(step) },
    ]);
  }

  // ---------------------------------------------------------------------
  // D-135: Character Creation's starting spell-selection wizard. Reuses
  // `renderPlanPrompt`/`clearLevelPlanOverlay`/`levelPlanOverlay` above (both
  // wizards are never open at once, and that rendering machinery has no
  // `LevelUpPlan`-specific typing in it). Unlike the Level Planner's
  // click-one-advance screens, every screen here is toggle-multiple-then-
  // confirm, since a spell pick is a multi-select up to a cap.
  // ---------------------------------------------------------------------

  /** Highest spell level this class can actually cast at `level` — a Character-Creation-only DISPLAY filter (the canonical eligible pool in `SpellPreparationSystem` is unchanged) so the picker doesn't show a level-1 hero 100+ spells it can't cast for another 10+ levels. */
  private maxCastableSpellLevel(classId: string, level: number): number {
    const slots = spellSlotsForClassAtLevel(getClassDefinition(classId), level);
    let max = 0;
    slots.forEach((count, i) => {
      if (count > 0) max = i + 1;
    });
    return max;
  }

  private openSpellPicker(slot: number): void {
    const classId = CREATABLE_CLASS_IDS[this.slots[slot].classIndex];
    const level = this.slots[slot].startingLevel;
    this.spellPickSteps = spellPickStepsForClass(classId, level);
    if (this.spellPickSteps.length === 0) return; // nothing this class can actually pick — see spellPickStepsForClass's own doc comment
    this.spellPickSlot = slot;
    const existing = this.slots[slot].spellPicks;
    const maxLevel = this.maxCastableSpellLevel(classId, level);

    // Seed each field from the hero's existing pick if it has one, else
    // reproduce `Hero.growSpellSelections()`'s own `defaultFill` math over
    // the (level-filtered) pool — the player opens the picker already
    // looking at a valid, capped selection they can freely toggle, not a
    // blank slate. Spellbook seeded first: the "prepared" pool below reads
    // it, same pool choice `growSpellSelections` itself makes for a Wizard.
    const spellbookPool = eligibleLeveledSpellPool("wizard").filter((id) => getSpell(id).level <= maxLevel);
    const spellbookSize = classId === "wizard" ? wizardSpellbookSizeAtLevel(level) : 0;
    const spellbookIds = existing.spellbookIds ?? (classId === "wizard" ? defaultFill(spellbookPool, [], spellbookSize) : []);

    const cantripCount = cantripsKnownForClassAtLevel(getClassDefinition(classId), level);
    const cantripIds = existing.cantripIds ?? defaultFill(eligibleCantripPool(classId), [], cantripCount);

    const preparedPool =
      classId === "wizard" ? spellbookIds : eligibleLeveledSpellPool(classId).filter((id) => getSpell(id).level <= maxLevel);
    const preparedCount = preparedSpellCountForClassAtLevel(classId, level);
    const leveledSpellIds = existing.leveledSpellIds ?? defaultFill(preparedPool, [], preparedCount);

    this.spellPickDraft = { cantripIds, leveledSpellIds, spellbookIds };
    this.spellPickStepIndex = 0;
    this.showNextSpellPickStep();
  }

  private closeSpellPicker(commit: boolean): void {
    if (commit && this.spellPickSlot !== null) {
      // Only ever commit a field this class's step ladder actually offered —
      // e.g. a non-Wizard never gets a `spellbookIds` entry, matching
      // `existing` staying undefined for it on every future re-open too.
      this.slots[this.spellPickSlot].spellPicks = {
        cantripIds: this.spellPickSteps.includes("cantrips") ? this.spellPickDraft.cantripIds : undefined,
        leveledSpellIds: this.spellPickSteps.includes("prepared") ? this.spellPickDraft.leveledSpellIds : undefined,
        spellbookIds: this.spellPickSteps.includes("spellbook") ? this.spellPickDraft.spellbookIds : undefined,
      };
    }
    this.spellPickSlot = null;
    this.clearLevelPlanOverlay();
    this.refreshAll();
  }

  private showNextSpellPickStep(): void {
    if (this.spellPickStepIndex >= this.spellPickSteps.length) {
      this.showSpellPickDoneScreen();
      return;
    }
    this.showSpellStepScreen(this.spellPickSteps[this.spellPickStepIndex]);
  }

  private advanceSpellPickStep(): void {
    this.spellPickStepIndex += 1;
    this.showNextSpellPickStep();
  }

  private goBackSpellPickStep(): void {
    this.spellPickStepIndex -= 1;
    this.showNextSpellPickStep();
  }

  private showSpellPickDoneScreen(): void {
    this.renderPlanPrompt("Spell Selection Complete", [
      { label: "Save & Close", desc: "Commits every pick made in this session to this hero.", onClick: () => this.closeSpellPicker(true) },
      { label: "◀ Back", onClick: () => this.goBackSpellPickStep() },
      {
        label: "Cancel",
        desc: "Discard this session's edits and keep this hero's previous selection (or auto-fill).",
        onClick: () => this.closeSpellPicker(false),
      },
    ]);
  }

  /** Step 0's "back" target is closing the wizard outright — there's no mode-select screen before the ladder here (unlike the Level Planner's). */
  private spellPickBackChoice(): { label: string; onClick: () => void } {
    if (this.spellPickStepIndex === 0) {
      return { label: "Cancel", onClick: () => this.closeSpellPicker(false) };
    }
    return { label: "◀ Back", onClick: () => this.goBackSpellPickStep() };
  }

  /**
   * One shared toggle-multiple-then-confirm screen for all three step kinds
   * — they differ only in which pool/draft field/cap apply, not in
   * interaction shape. Re-invoked on every toggle click (not just once) so
   * the `highlighted` state stays in sync with the live draft.
   */
  private showSpellStepScreen(kind: SpellPickStepKind): void {
    const slot = this.spellPickSlot as number;
    const classId = CREATABLE_CLASS_IDS[this.slots[slot].classIndex];
    const level = this.slots[slot].startingLevel;
    const maxLevel = this.maxCastableSpellLevel(classId, level);

    let title: string;
    let pool: string[];
    let draftKey: "cantripIds" | "leveledSpellIds" | "spellbookIds";
    let max: number;

    if (kind === "spellbook") {
      title = "Wizard Spellbook";
      pool = eligibleLeveledSpellPool("wizard").filter((id) => getSpell(id).level <= maxLevel);
      draftKey = "spellbookIds";
      max = wizardSpellbookSizeAtLevel(level);
    } else if (kind === "cantrips") {
      title = "Known Cantrips";
      pool = eligibleCantripPool(classId);
      draftKey = "cantripIds";
      max = cantripsKnownForClassAtLevel(getClassDefinition(classId), level);
    } else {
      title = classId === "wizard" ? "Prepared Spells (from your Spellbook)" : "Prepared Spells";
      pool =
        classId === "wizard"
          ? this.spellPickDraft.spellbookIds
          : eligibleLeveledSpellPool(classId).filter((id) => getSpell(id).level <= maxLevel);
      draftKey = "leveledSpellIds";
      max = preparedSpellCountForClassAtLevel(classId, level);
    }

    const selected = this.spellPickDraft[draftKey];
    const choices: Array<{ label: string; desc?: string; onClick: () => void; highlighted?: boolean }> = pool.map((id) => {
      const spell = getSpell(id);
      const isSelected = selected.includes(id);
      return {
        label: spell.name,
        desc: spell.level === 0 ? "Cantrip" : `Level ${spell.level}`,
        highlighted: isSelected,
        onClick: () => {
          if (isSelected) {
            this.spellPickDraft[draftKey] = selected.filter((existingId) => existingId !== id);
          } else if (selected.length < max) {
            this.spellPickDraft[draftKey] = [...selected, id];
          } else {
            return; // already at the cap, and this id isn't currently selected — no-op
          }
          // Editing the spellbook can strand previously-prepared picks no
          // longer in it — `Hero.growSpellSelections()` has the same
          // "prepared draws from the spellbook" invariant to keep.
          if (kind === "spellbook") {
            this.spellPickDraft.leveledSpellIds = this.spellPickDraft.leveledSpellIds.filter((preparedId) =>
              this.spellPickDraft.spellbookIds.includes(preparedId),
            );
          }
          this.showSpellStepScreen(kind);
        },
      };
    });

    const count = selected.length;
    choices.push({ label: `Confirm (${count}/${max})`, onClick: () => (count === max ? this.advanceSpellPickStep() : undefined) });
    choices.push(this.spellPickBackChoice());

    this.renderPlanPrompt(`${title} — Choose ${max}`, choices);
  }

  /**
   * A scene-local analog of `BattleScene.renderAsiPrompt` (same dim-rect +
   * title + wrapping button-grid shape, including the same `highlighted`
   * gold-outline treatment) — this scene has no mechanism to share a
   * private method from another scene, so it's reimplemented here rather
   * than exported for one caller. The dim backdrop is itself interactive
   * (captures and swallows clicks, no handler) so it blocks every ordinary
   * slot button underneath while the wizard is open, since this scene's
   * existing buttons have no shared "input locked" flag to check.
   */
  private renderPlanPrompt(
    title: string,
    choices: Array<{ label: string; desc?: string; onClick: () => void; highlighted?: boolean }>,
  ): void {
    // Party Creation Overhaul Plan 1.1: makes "both a dropdown and this
    // full-screen overlay open at once" impossible by construction, rather
    // than relying on z-order/depth alone.
    this.closeDropdown();
    this.setNameInputsVisible(false);
    renderChoiceOverlay(this, this.levelPlanOverlay, title, choices);
  }
}
