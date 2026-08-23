import Phaser from "phaser";
import { SAVE_STORAGE_KEY } from "../config";
import { getViewport, onViewportResize } from "./uiTheme";
import { ABILITY_SCORE_IDS, ABILITY_SCORE_NAMES, modifierFor, type AbilityScoreId } from "../data/abilityScores";
import { CHARACTER_NAME_POOL, CREATABLE_CLASS_IDS, STARTING_GEAR_IDS, signatureActionIdsForClass } from "../data/characterCreation";
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
} from "../systems/SpellPreparationSystem";
import { subclassesForClass, getSubclassDefinition } from "../data/subclasses";
import { getEquipmentDefinition } from "../data/equipment";
import { FEAT_IDS, getFeat } from "../data/feats";
import { RACE_IDS, getRaceDefinition } from "../data/races";
import type { HeroDefinition, HeroControlMode } from "../data/heroes";
import { Hero, MAX_CLASS_LEVEL, type MagicInitiateListId } from "../entities/Hero";
import {
  emptyLevelUpPlan,
  fastForwardHero,
  futureChoiceSteps,
  type LevelUpChoiceStep,
  type LevelUpPlan,
} from "../systems/LevelUpPlanSystem";
import { DIFFICULTY_IDS, getDifficultyDefinition, type DifficultyId } from "../data/difficulty";
import type { WaveDefinition } from "../data/waves";
import type { ParsedMap } from "../data/testMap";
import {
  StandardArrayAllocator,
  allocatorFromScores,
  PointBuyAllocator,
  pointBuyAllocatorFromScores,
  POINT_BUY_BUDGET,
  heroDefinitionFromBuild,
  hasDuplicateAbilities,
  hasDuplicateNames,
  subclassIdForNewBuild,
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
 * (D-052's locked party size, unchanged) by, per hero: cycling a preset
 * name, picking a class, assigning the standard array across six ability
 * scores (click a score to swap it with the next slot — see
 * `StandardArrayAllocator`), and picking a signature action from whatever
 * that class offers. Every class-level derived stat (HP, attack
 * damage/range) is computed live via
 * `heroDefinitionFromBuild` and shown as a preview.
 *
 * This scene is now the ONLY way into a battle (`MainMenuScene`'s original
 * fixed 4-hero-roster START button and its flat Vigor/Might level-up choice
 * were removed once this builder became feature-complete — see
 * DECISIONS.md), reached via the "New Game" button, and hands BattleScene a
 * built roster via `scene.start("BattleScene", { heroDefinitions })`.
 *
 * Phase 11.2 (D-074) added a second, pickable class: Wizard, a spellcaster
 * whose signature action is a cantrip (Fire Bolt or Ray of Frost) instead of
 * one of the Fighter's four martial abilities — see `data/characterCreation.ts`'s
 * `signatureActionIdsForClass` for the one place that decides which list a
 * given class picks from.
 *
 * Phase 11.3 (D-075) added a race-cycle button (all six SRD starter races)
 * and two further classes, Rogue and Cleric — both already flow through the
 * same class-cycle button and `signatureActionIdsForClass` seam added for
 * Wizard, so neither needed scene changes beyond the new race row. A hero's
 * race sets its `movementTiles` (Dwarf/Halfling move one tile slower — see
 * `data/races.ts`); every other race trait stays flavor-only. Feats and
 * subclasses remain deferred (recorded as class-table data, not yet
 * selectable — see `data/classes.ts` and `data/feats.ts`). Every ACTIVE hero
 * must have a distinct name and a distinct signature action (enforced before
 * Start Battle is enabled), matching today's "every hero feels different"
 * property — race is NOT required to be distinct (a full-Human party is
 * exactly as valid as a mixed one).
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
 * either way.
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
 * cycle-through-a-preset-pool button; real free-text naming is piece 2),
 * ability scores, and Signature Action are unchanged in this piece.
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

interface SlotState {
  /** D-147 (piece 2): free-text hero name, editable via a DOM `<input>` (see `buildSlotUi`'s name row) — previously an index into `CHARACTER_NAME_POOL`. The pool is still used to seed a fresh slot's default. */
  name: string;
  classIndex: number;
  raceIndex: number;
  /** D-147 (piece 3): whichever kind matches the scene's current party-wide `abilityScoreMethod` — swapped wholesale (not converted) when the method toggle is clicked. */
  allocator: AbilityScoreAllocator;
  abilityIndex: number;
  controlledBy: HeroControlMode;
  /** Phase 13.11 (D-096): index into `STARTING_GEAR_IDS`, offset by 1 — 0 means "None". */
  startingGearIndex: number;
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
}

interface SlotWidgets {
  controlLabel: Phaser.GameObjects.Text;
  /** D-147 (piece 2): a real DOM `<input>`, not a Text label — its own value is read live on each "input" event, not re-set by `refreshSlot`. */
  nameInput: Phaser.GameObjects.DOMElement;
  /** The raw `<input>` node inside `nameInput`, kept separately so `setSlotActive` can toggle `.disabled` — a Phaser `Rectangle`'s `disableInteractive` doesn't apply to a real HTML element. */
  nameInputNode: HTMLInputElement;
  classLabel: Phaser.GameObjects.Text;
  raceLabel: Phaser.GameObjects.Text;
  abilityScoreLabels: Record<AbilityScoreId, Phaser.GameObjects.Text>;
  /** D-147 (piece 3): the six Standard-Array cycle-row rectangles — visible/interactive only while the party-wide method is "standardArray". */
  standardArrayRowButtons: Phaser.GameObjects.Rectangle[];
  /** D-147 (piece 3): the twelve Point-Buy +/- rectangles (one pair per ability) — visible/interactive only while the method is "pointBuy". */
  pointBuyButtons: Phaser.GameObjects.Rectangle[];
  signatureLabel: Phaser.GameObjects.Text;
  gearLabel: Phaser.GameObjects.Text;
  subclassLabel: Phaser.GameObjects.Text;
  statsLabel: Phaser.GameObjects.Text;
  levelLabel: Phaser.GameObjects.Text;
  /** D-133: the "Plan Levels" row's label — see `openLevelPlanner`. */
  planLabel: Phaser.GameObjects.Text;
  /** D-135: the "Spells" row's label — see `openSpellPicker`. */
  spellsLabel: Phaser.GameObjects.Text;
  /** Every GameObject this slot created, for dimming an inactive (beyond party size) slot. */
  allObjects: Phaser.GameObjects.GameObject[];
  /** The interactive rectangles among `allObjects`, for disabling an inactive slot's clicks. */
  interactiveButtons: Phaser.GameObjects.Rectangle[];
}

export class CharacterCreationScene extends Phaser.Scene {
  private slots: SlotState[] = [];
  private widgets: SlotWidgets[] = [];
  private startButton!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private partyValid = false;
  private partySize = MAX_PARTY_SIZE;
  private difficultyId: DifficultyId = "normal";
  private partySizeButton!: Phaser.GameObjects.Rectangle;
  private partySizeLabel!: Phaser.GameObjects.Text;
  private difficultyButton!: Phaser.GameObjects.Rectangle;
  private difficultyLabel!: Phaser.GameObjects.Text;
  /** D-129: the "set every slot's Starting Level at once" control — see `buildTeamLevelControl`. */
  private teamLevelValue = 1;
  private teamLevelButton!: Phaser.GameObjects.Rectangle;
  private teamLevelLabel!: Phaser.GameObjects.Text;
  /**
   * D-147 (piece 3): a party-wide ability-score allocation method — real 5e
   * practice treats this as a table-wide ruleset choice, not a per-hero one.
   * Switching it resets every slot's allocator to a FRESH instance of the
   * new kind (no attempted conversion between the two).
   */
  private abilityScoreMethod: "standardArray" | "pointBuy" = "standardArray";
  private abilityScoreMethodButton!: Phaser.GameObjects.Rectangle;
  private abilityScoreMethodLabel!: Phaser.GameObjects.Text;
  /** Phase 11.8 (D-071): forwarded unchanged to BattleScene; `undefined` when
   * reached via the plain "Create Party" button (no campaign selected). */
  private campaignId?: string;
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
  private savePartyButton!: Phaser.GameObjects.Rectangle;
  private savePartyLabel!: Phaser.GameObjects.Text;
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
    freePlayMapId?: string;
    freePlayWaves?: WaveDefinition[];
    difficultyId?: DifficultyId;
    loadedSlotId?: string;
    loadedParty?: CharacterBuild[];
    customMapData?: ParsedMap;
    testMode?: boolean;
  }): void {
    this.campaignId = data?.campaignId;
    this.freePlayMapId = data?.freePlayMapId;
    this.freePlayWaves = data?.freePlayWaves;
    this.difficultyId = data?.difficultyId ?? "normal";
    this.loadedSlotId = data?.loadedSlotId;
    this.loadedParty = data?.loadedParty;
    this.customMapData = data?.customMapData;
    this.testMode = data?.testMode ?? false;
  }

  create(): void {
    this.slots = [];
    this.widgets = [];
    this.saveFile = loadSaveFile(window.localStorage, SAVE_STORAGE_KEY);
    initAuth((state) => (this.authState = state));

    this.cameras.main.setBackgroundColor("#0e0e14");
    const width = getViewport(this).width;
    this.viewportWidthAtLastLayout = width;

    this.add
      .text(width / 2, 36, "BUILD YOUR PARTY", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "32px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        72,
        "Type a hero's name directly. Click a class, race, gear, or subclass to choose from a list. Click an ability score or signature action to cycle it.",
        { fontFamily: "system-ui, Arial, sans-serif", fontSize: "15px", color: "#8a8aa0" },
      )
      .setOrigin(0.5);

    // D-147 (piece 3): the method is party-wide, so it's read once from
    // whichever build a loaded party's first slot used — every slot in a
    // save made through this scene shares the same method, since it can
    // only ever be changed via the one party-wide toggle below.
    this.abilityScoreMethod = this.loadedParty?.[0]?.abilityScoreMethod === "pointBuy" ? "pointBuy" : "standardArray";

    for (let slot = 0; slot < MAX_PARTY_SIZE; slot++) {
      const loadedBuild = this.loadedParty?.[slot];
      this.slots.push(
        loadedBuild
          ? this.slotStateFromBuild(loadedBuild)
          : {
              name: CHARACTER_NAME_POOL[slot % CHARACTER_NAME_POOL.length],
              classIndex: 0,
              raceIndex: 0,
              allocator: new StandardArrayAllocator(),
              abilityIndex: slot,
              // D-129: default to 1 human, the rest AI-controlled — Kevin's
              // own request, so a fresh party is playtest-ready without
              // manually toggling three slots every time. Loading a saved
              // party (`slotStateFromBuild`, below) still uses whatever
              // control mix was actually saved, unaffected by this default.
              controlledBy: slot === 0 ? "human" : "ai",
              startingGearIndex: 0,
              subclassIndex: 0,
              startingLevel: 1,
              levelUpPlan: emptyLevelUpPlan(),
              spellPicks: {},
            },
      );
      this.widgets.push(this.buildSlotUi(width, slot));
    }
    if (this.loadedParty) {
      this.partySize = Math.min(MAX_PARTY_SIZE, Math.max(MIN_PARTY_SIZE, this.loadedParty.length));
    }

    this.buildBottomControls(width);
    this.buildStartButton(width);
    this.buildBackButton(width);
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
      const positionable = obj as unknown as { x?: unknown };
      if (typeof positionable.x === "number") (positionable as { x: number }).x += shift;
    }
    this.viewportWidthAtLastLayout = newWidth;
  }

  private buildSlotUi(width: number, slot: number): SlotWidgets {
    const x = columnCenterX(width, slot);
    const allObjects: Phaser.GameObjects.GameObject[] = [];
    const interactiveButtons: Phaser.GameObjects.Rectangle[] = [];

    // Spans the actual content range (Hero-N label at ~y121 through the new
    // Spells row at ~y710), verified by adding up every row's height
    // and gap below (bounding-box math, no browser available here — same
    // discipline as D-046/D-055/D-059's HUD layout fixes). Grew by 40px in
    // Phase 11.3 (D-075) for the race row, another 40px in Phase 13.11
    // (D-096) for the Gear row, another 40px in Phase 14.2 (D-099) for the
    // Subclass row, another 40px in D-129 for the Starting Level row,
    // another 40px in D-133 for the Plan Levels row, and another 40px in
    // D-135 for the Spells row — top edge (y105) held fixed every time, so
    // the whole column grows downward, not into the title/subtitle above
    // (every row below this column, from `buildBottomControls` down,
    // shifted +40px to match).
    const background = this.add
      .rectangle(x, 430, COLUMN_WIDTH, 650, 0x1a1a26)
      .setStrokeStyle(1, 0x2a2a3a)
      .setDepth(0);
    allObjects.push(background);

    // Phase 11.4 (D-077): the old plain "Hero N" label became a clickable
    // Human/AI toggle in the SAME spot, so no other row on this slot moves.
    const controlButton = this.add
      .rectangle(x, 130, COLUMN_WIDTH - 20, 26, 0x24242e)
      .setStrokeStyle(1, 0x3a3a4a)
      .setInteractive({ useHandCursor: true });
    const controlLabel = this.add
      .text(x, 130, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#8a8aa0" })
      .setOrigin(0.5);
    controlButton.on("pointerover", () => controlButton.setFillStyle(0x2e2e3a));
    controlButton.on("pointerout", () => controlButton.setFillStyle(0x24242e));
    controlButton.on("pointerdown", () => {
      const s = this.slots[slot];
      s.controlledBy = s.controlledBy === "human" ? "ai" : "human";
      this.refreshAll();
    });
    allObjects.push(controlButton, controlLabel);
    interactiveButtons.push(controlButton);

    // D-147 (piece 2): a real DOM `<input>` (this project's second use of one
    // — see `CoopLobbyScene`'s join-code field, KI-062, for the first and
    // `main.ts`'s `dom.createContainer` config both rely on). The starting
    // value is set as a JS property, not baked into the HTML string, so a
    // loaded save's name can't break/inject into the markup. Typing updates
    // `s.name` live and re-runs `refreshAll` (for duplicate/blank-name
    // validation) but never writes back INTO the input itself, so the
    // player's cursor position/selection is never disturbed mid-edit.
    const nameInput = this.add
      .dom(
        x,
        165,
      )
      .createFromHTML(
        `<input type="text" maxlength="24" placeholder="Hero Name" style="
          width: ${COLUMN_WIDTH - 20}px; height: 34px; font-size: 16px;
          font-family: system-ui, Arial, sans-serif; font-weight: bold;
          text-align: center; background: #2a2a3a; color: #e8e8f0;
          border: 1px solid #4a4a5a; border-radius: 4px; outline: none;
          box-sizing: border-box;
        " />`,
      )
      .setOrigin(0.5);
    const nameNode = nameInput.node.querySelector("input") as HTMLInputElement;
    nameNode.value = this.slots[slot].name;
    nameNode.addEventListener("input", () => {
      this.slots[slot].name = nameNode.value;
      this.refreshAll();
    });
    nameNode.addEventListener("keydown", (e: KeyboardEvent) => e.stopPropagation());

    const classButton = this.add
      .rectangle(x, 200, COLUMN_WIDTH - 20, 26, 0x222a2e)
      .setStrokeStyle(1, 0x3a4a4a)
      .setInteractive({ useHandCursor: true });
    const classLabel = this.add
      .text(x, 200, "", { fontFamily: "monospace", fontSize: "13px", color: "#8aa0c0" })
      .setOrigin(0.5);
    classButton.on("pointerover", () => classButton.setFillStyle(0x2a3a3a));
    classButton.on("pointerout", () => classButton.setFillStyle(0x222a2e));
    classButton.on("pointerdown", () => {
      const s = this.slots[slot];
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
            s.abilityIndex = 0; // the new class's action list has a different shape — start from its first entry
            // D-133: a different class has an entirely different choice ladder —
            // a stale plan would be meaningless at best, wrong at worst.
            s.levelUpPlan = emptyLevelUpPlan();
            // D-135: same reasoning — a different class has an entirely different
            // spell list, so a stale manual pick would be meaningless too.
            s.spellPicks = {};
          },
        })),
      );
    });

    const raceButton = this.add
      .rectangle(x, 233, COLUMN_WIDTH - 20, 26, 0x2a2622)
      .setStrokeStyle(1, 0x4a4436)
      .setInteractive({ useHandCursor: true });
    const raceLabel = this.add
      .text(x, 233, "", { fontFamily: "monospace", fontSize: "13px", color: "#c0a880" })
      .setOrigin(0.5);
    raceButton.on("pointerover", () => raceButton.setFillStyle(0x352f28));
    raceButton.on("pointerout", () => raceButton.setFillStyle(0x2a2622));
    raceButton.on("pointerdown", () => {
      const s = this.slots[slot];
      // D-147 (piece 5): each option's desc shows what's actually real
      // (speed, flavor traits) — deliberately no invented ability-score
      // bonus. This project's spell-prep economy (D-134) already committed
      // to real SRD 5.2.1, which moved ability-score increases from Race to
      // Background — no race grants one there either, so nothing is
      // missing here, and the picker's title says so plainly.
      this.openChoicePicker(
        "Choose a Race — SRD 5.2.1 ties ability-score increases to Background, not Race, so none are missing below.",
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
    });

    const abilityScoreLabels = {} as Record<AbilityScoreId, Phaser.GameObjects.Text>;
    // D-147 (piece 3): kept OUT of `interactiveButtons` — their interactivity
    // is managed by `refreshAbilityScoreControls` (which also has to weigh
    // the party-wide method), not the generic active/inactive-slot toggle.
    const standardArrayRowButtons: Phaser.GameObjects.Rectangle[] = [];
    const pointBuyButtons: Phaser.GameObjects.Rectangle[] = [];
    const abilityRowsTop = 270;
    const abilityRowHeight = 30;
    ABILITY_SCORE_IDS.forEach((ability, row) => {
      const y = abilityRowsTop + row * abilityRowHeight;

      // Standard Array mode: the whole row is one cycle button (unchanged since Phase 11.1).
      const rowButton = this.add
        .rectangle(x, y, COLUMN_WIDTH - 20, 24, 0x22222e)
        .setStrokeStyle(1, 0x32324a)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, y, "", { fontFamily: "monospace", fontSize: "13px", color: "#c8c8d8" })
        .setOrigin(0.5);
      rowButton.on("pointerover", () => rowButton.setFillStyle(0x2a2a3a));
      rowButton.on("pointerout", () => rowButton.setFillStyle(0x22222e));
      rowButton.on("pointerdown", () => {
        if (this.abilityScoreMethod !== "standardArray") return;
        (this.slots[slot].allocator as StandardArrayAllocator).cycle(ability);
        this.refreshAll();
      });

      // D-147 (piece 3): Point Buy mode — a +/- stepper layered at the same
      // row position (higher depth so it visually and input-wise sits above
      // `rowButton`), shown/interactive only while the method is "pointBuy"
      // (`refreshAbilityScoreControls` toggles both sets' visibility and
      // interactivity together, so only one set is ever clickable). `label`
      // above is shared by both modes — the score/modifier text it shows is
      // computed identically either way (see `refreshSlot`).
      const minusButton = this.add
        .rectangle(x - 100, y, 26, 22, 0x2a2a3a)
        .setStrokeStyle(1, 0x4a4a5a)
        .setDepth(1)
        .setInteractive({ useHandCursor: true });
      const minusLabel = this.add
        .text(x - 100, y, "-", { fontFamily: "monospace", fontSize: "16px", color: "#e8e8f0", fontStyle: "bold" })
        .setOrigin(0.5)
        .setDepth(2);
      minusButton.on("pointerover", () => minusButton.setFillStyle(0x3a3a4a));
      minusButton.on("pointerout", () => minusButton.setFillStyle(0x2a2a3a));
      minusButton.on("pointerdown", () => {
        if (this.abilityScoreMethod !== "pointBuy") return;
        (this.slots[slot].allocator as PointBuyAllocator).decrease(ability);
        this.refreshAll();
      });

      const plusButton = this.add
        .rectangle(x + 100, y, 26, 22, 0x2a2a3a)
        .setStrokeStyle(1, 0x4a4a5a)
        .setDepth(1)
        .setInteractive({ useHandCursor: true });
      const plusLabel = this.add
        .text(x + 100, y, "+", { fontFamily: "monospace", fontSize: "16px", color: "#e8e8f0", fontStyle: "bold" })
        .setOrigin(0.5)
        .setDepth(2);
      plusButton.on("pointerover", () => plusButton.setFillStyle(0x3a3a4a));
      plusButton.on("pointerout", () => plusButton.setFillStyle(0x2a2a3a));
      plusButton.on("pointerdown", () => {
        if (this.abilityScoreMethod !== "pointBuy") return;
        (this.slots[slot].allocator as PointBuyAllocator).increase(ability);
        this.refreshAll();
      });

      abilityScoreLabels[ability] = label;
      standardArrayRowButtons.push(rowButton);
      pointBuyButtons.push(minusButton, plusButton);
      allObjects.push(rowButton, label, minusButton, minusLabel, plusButton, plusLabel);
    });

    const signatureY = abilityRowsTop + ABILITY_SCORE_IDS.length * abilityRowHeight + 15;
    const signatureButton = this.add
      .rectangle(x, signatureY, COLUMN_WIDTH - 20, 34, 0x3a2a4a)
      .setStrokeStyle(1, 0x5a4a7a)
      .setInteractive({ useHandCursor: true });
    const signatureLabel = this.add
      .text(x, signatureY, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#f0e8ff", fontStyle: "bold" })
      .setOrigin(0.5);
    signatureButton.on("pointerover", () => signatureButton.setFillStyle(0x4a3a5a));
    signatureButton.on("pointerout", () => signatureButton.setFillStyle(0x3a2a4a));
    signatureButton.on("pointerdown", () => {
      const s = this.slots[slot];
      const actionIds = signatureActionIdsForClass(CREATABLE_CLASS_IDS[s.classIndex]);
      s.abilityIndex = (s.abilityIndex + 1) % actionIds.length;
      this.refreshAll();
    });

    // Phase 13.11 (D-096): a free starting-gear pick, cycling "None" plus
    // every common/uncommon catalogue item — sits between the signature
    // ability and the stats preview, pushing the latter down 40px (same
    // bounding-box-driven relayout discipline as D-075's race row).
    const gearY = signatureY + 40;
    const gearButton = this.add
      .rectangle(x, gearY, COLUMN_WIDTH - 20, 26, 0x22282a)
      .setStrokeStyle(1, 0x3a4a4c)
      .setInteractive({ useHandCursor: true });
    const gearLabel = this.add
      .text(x, gearY, "", { fontFamily: "monospace", fontSize: "13px", color: "#a8c8c0" })
      .setOrigin(0.5);
    gearButton.on("pointerover", () => gearButton.setFillStyle(0x2a3436));
    gearButton.on("pointerout", () => gearButton.setFillStyle(0x22282a));
    gearButton.on("pointerdown", () => {
      const s = this.slots[slot];
      this.openChoicePicker("Choose Starting Gear", [
        {
          label: "None",
          highlighted: s.startingGearIndex === 0,
          onPick: () => {
            s.startingGearIndex = 0;
          },
        },
        ...STARTING_GEAR_IDS.map((id, i) => ({
          label: getEquipmentDefinition(id).name,
          highlighted: s.startingGearIndex === i + 1,
          onPick: () => {
            s.startingGearIndex = i + 1;
          },
        })),
      ]);
    });

    // Phase 14.2 (D-099): a subclass-picker row. Only actually cycles
    // anything for a level-1-choice class with 2+ modeled subclasses today
    // (Cleric/Sorcerer/Warlock) — clicking it for any other class is a
    // harmless no-op, same "always interactive, handler checks eligibility"
    // pattern the other cycle buttons already use (their behavior doesn't
    // depend on any OTHER slot's state either). A later-choice class's
    // subclass is still picked in battle, via BattleScene's own overlay.
    const subclassY = gearY + 40;
    const subclassButton = this.add
      .rectangle(x, subclassY, COLUMN_WIDTH - 20, 26, 0x2a2438)
      .setStrokeStyle(1, 0x4a3a5a)
      .setInteractive({ useHandCursor: true });
    const subclassLabel = this.add
      .text(x, subclassY, "", { fontFamily: "monospace", fontSize: "13px", color: "#c8a8e0" })
      .setOrigin(0.5);
    subclassButton.on("pointerover", () => subclassButton.setFillStyle(0x342a44));
    subclassButton.on("pointerout", () => subclassButton.setFillStyle(0x2a2438));
    subclassButton.on("pointerdown", () => {
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
    });

    const statsLabel = this.add
      .text(x, subclassY + 45, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#9be0b4",
        align: "center",
      })
      .setOrigin(0.5);

    // D-129: a pre-battle "Starting Level" control — cycles 1-20, wrapping,
    // same interaction shape as every other cycle button in this column.
    // Kevin asked for this specifically to stop every playtest from having
    // to grind a party up from level 1; see the Team Level control in
    // `buildBottomControls` for setting every slot at once instead.
    const levelY = subclassY + 85;
    const levelButton = this.add
      .rectangle(x, levelY, COLUMN_WIDTH - 20, 26, 0x28241c)
      .setStrokeStyle(1, 0x4a4030)
      .setInteractive({ useHandCursor: true });
    const levelLabel = this.add
      .text(x, levelY, "", { fontFamily: "monospace", fontSize: "13px", color: "#e0c890" })
      .setOrigin(0.5);
    levelButton.on("pointerover", () => levelButton.setFillStyle(0x342e22));
    levelButton.on("pointerout", () => levelButton.setFillStyle(0x28241c));
    levelButton.on("pointerdown", () => {
      const s = this.slots[slot];
      s.startingLevel = s.startingLevel >= MAX_CLASS_LEVEL ? 1 : s.startingLevel + 1;
      this.refreshAll();
    });

    // D-133: the level-by-level Character Creation planner — opens a
    // full-screen wizard (see `openLevelPlanner`) letting the player pick
    // every future ASI/subclass/spell-pick choice for this hero in advance.
    const planY = levelY + 40;
    const planButton = this.add
      .rectangle(x, planY, COLUMN_WIDTH - 20, 26, 0x2c2020)
      .setStrokeStyle(1, 0x5a3a3a)
      .setInteractive({ useHandCursor: true });
    const planLabel = this.add
      .text(x, planY, "", { fontFamily: "monospace", fontSize: "13px", color: "#e0a0a0" })
      .setOrigin(0.5);
    planButton.on("pointerover", () => planButton.setFillStyle(0x362828));
    planButton.on("pointerout", () => planButton.setFillStyle(0x2c2020));
    planButton.on("pointerdown", () => this.openLevelPlanner(slot));

    // D-135: the starting spell-selection wizard — opens a full-screen
    // picker (see `openSpellPicker`) letting the player choose this hero's
    // starting prepared spells/known cantrips/(Wizard) spellbook, instead of
    // silently taking `Hero.growSpellSelections()`'s auto-fill. A harmless
    // no-op for a class with no real picks to make (see
    // `spellPickStepsForClass`'s own doc comment for why Paladin/Ranger, in
    // particular, land here despite having a real spell-slot economy).
    const spellsY = planY + 40;
    const spellsButton = this.add
      .rectangle(x, spellsY, COLUMN_WIDTH - 20, 26, 0x202c2c)
      .setStrokeStyle(1, 0x3a5a5a)
      .setInteractive({ useHandCursor: true });
    const spellsLabel = this.add
      .text(x, spellsY, "", { fontFamily: "monospace", fontSize: "13px", color: "#a0e0e0" })
      .setOrigin(0.5);
    spellsButton.on("pointerover", () => spellsButton.setFillStyle(0x283838));
    spellsButton.on("pointerout", () => spellsButton.setFillStyle(0x202c2c));
    spellsButton.on("pointerdown", () => this.openSpellPicker(slot));

    allObjects.push(
      nameInput,
      classButton,
      classLabel,
      raceButton,
      raceLabel,
      signatureButton,
      signatureLabel,
      gearButton,
      gearLabel,
      subclassButton,
      subclassLabel,
      statsLabel,
      levelButton,
      levelLabel,
      planButton,
      planLabel,
      spellsButton,
      spellsLabel,
      ...Object.values(abilityScoreLabels),
    );
    interactiveButtons.push(
      classButton,
      raceButton,
      signatureButton,
      gearButton,
      subclassButton,
      levelButton,
      planButton,
      spellsButton,
    );

    return {
      controlLabel,
      nameInput,
      nameInputNode: nameNode,
      classLabel,
      raceLabel,
      abilityScoreLabels,
      standardArrayRowButtons,
      pointBuyButtons,
      signatureLabel,
      gearLabel,
      subclassLabel,
      statsLabel,
      levelLabel,
      planLabel,
      spellsLabel,
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
    this.buildPartyWideAbilityControls(width, 810);
    const y = 860;
    const leftX = width / 2 - 150;
    const rightX = width / 2 + 150;

    this.partySizeButton = this.add
      .rectangle(leftX, y, 280, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.partySizeLabel = this.add
      .text(leftX, y, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#e8e8f0" })
      .setOrigin(0.5);
    this.partySizeButton.on("pointerover", () => this.partySizeButton.setFillStyle(0x3a3a4a));
    this.partySizeButton.on("pointerout", () => this.partySizeButton.setFillStyle(0x2a2a3a));
    this.partySizeButton.on("pointerdown", () => {
      this.partySize = this.partySize >= MAX_PARTY_SIZE ? MIN_PARTY_SIZE : this.partySize + 1;
      this.refreshAll();
    });

    this.difficultyButton = this.add
      .rectangle(rightX, y, 280, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.difficultyLabel = this.add
      .text(rightX, y, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#e8e8f0" })
      .setOrigin(0.5);
    this.difficultyButton.on("pointerover", () => this.difficultyButton.setFillStyle(0x3a3a4a));
    this.difficultyButton.on("pointerout", () => this.difficultyButton.setFillStyle(0x2a2a3a));
    this.difficultyButton.on("pointerdown", () => {
      const next = (DIFFICULTY_IDS.indexOf(this.difficultyId) + 1) % DIFFICULTY_IDS.length;
      this.difficultyId = DIFFICULTY_IDS[next];
      this.refreshAll();
    });
  }

  /**
   * D-147 (piece 3): two party-wide controls sharing one row, left/right
   * split like the party-size/difficulty row just below — this scene's
   * column already sits close to `GAME_HEIGHT`'s headroom (see KI-083), so
   * a NEW control reuses an existing row's vertical space rather than
   * adding one. Left: the Ability Score Method toggle (Standard Array /
   * Point Buy), which resets every slot's allocator to a FRESH instance of
   * the newly chosen kind. Right: D-129's pre-existing "set every slot's
   * Starting Level at once" control, unchanged in behavior, just relocated
   * from its own single centered button into this row's right half.
   */
  private buildPartyWideAbilityControls(width: number, y: number): void {
    const leftX = width / 2 - 150;
    const rightX = width / 2 + 150;

    this.abilityScoreMethodButton = this.add
      .rectangle(leftX, y, 280, 40, 0x28241c)
      .setStrokeStyle(1, 0x4a4030)
      .setInteractive({ useHandCursor: true });
    this.abilityScoreMethodLabel = this.add
      .text(leftX, y, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "15px", color: "#e0c890" })
      .setOrigin(0.5);
    this.abilityScoreMethodButton.on("pointerover", () => this.abilityScoreMethodButton.setFillStyle(0x342e22));
    this.abilityScoreMethodButton.on("pointerout", () => this.abilityScoreMethodButton.setFillStyle(0x28241c));
    this.abilityScoreMethodButton.on("pointerdown", () => {
      this.abilityScoreMethod = this.abilityScoreMethod === "standardArray" ? "pointBuy" : "standardArray";
      this.slots.forEach((s) => {
        s.allocator = this.abilityScoreMethod === "pointBuy" ? new PointBuyAllocator() : new StandardArrayAllocator();
      });
      this.refreshAll();
    });

    this.teamLevelButton = this.add
      .rectangle(rightX, y, 280, 40, 0x28241c)
      .setStrokeStyle(1, 0x4a4030)
      .setInteractive({ useHandCursor: true });
    this.teamLevelLabel = this.add
      .text(rightX, y, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#e0c890" })
      .setOrigin(0.5);
    this.teamLevelButton.on("pointerover", () => this.teamLevelButton.setFillStyle(0x342e22));
    this.teamLevelButton.on("pointerout", () => this.teamLevelButton.setFillStyle(0x28241c));
    this.teamLevelButton.on("pointerdown", () => {
      this.teamLevelValue = this.teamLevelValue >= MAX_CLASS_LEVEL ? 1 : this.teamLevelValue + 1;
      this.slots.forEach((s) => (s.startingLevel = this.teamLevelValue));
      this.refreshAll();
    });
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

    this.startButton = this.add
      .rectangle(leftX, 910, 260, 50, 0x4caf72)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(leftX, 910, "Start Battle", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "20px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.startButton.on("pointerdown", () => {
      if (!this.partyValid) return;
      const builds = this.buildsFromSlots();
      if (this.loadedSlotId) {
        this.saveFile = updateSaveSlot(this.saveFile, this.loadedSlotId, {
          party: builds,
          partySize: this.partySize,
          difficultyId: this.difficultyId,
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
        freePlayMapId: this.freePlayMapId,
        freePlayWaves: this.freePlayWaves,
        customMapData: this.customMapData,
        testMode: this.testMode,
        originalParty: builds,
        loadedSlotId: this.loadedSlotId,
      });
    });

    this.savePartyButton = this.add
      .rectangle(rightX, 910, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.savePartyLabel = this.add
      .text(rightX, 910, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#e8e8f0",
      })
      .setOrigin(0.5);
    this.savePartyButton.on("pointerover", () => {
      if (this.savePartyButton.input?.enabled) this.savePartyButton.setFillStyle(0x3a3a4a);
    });
    this.savePartyButton.on("pointerout", () => this.savePartyButton.setFillStyle(0x2a2a3a));
    this.savePartyButton.on("pointerdown", () => this.onSaveParty());

    this.saveStatusLabel = this.add
      .text(rightX, 960, "", { fontFamily: "monospace", fontSize: "13px", color: "#8a8aa0" })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(width / 2, 990, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#d0a0a0",
      })
      .setOrigin(0.5);
  }

  /**
   * Save the current build to a new slot, or update the already-loaded one
   * (Phase 9, D-083). Gated by `refreshAll`'s own enable/disable of
   * `savePartyButton` (invalid party, or a new save at `MAX_SAVE_SLOTS`) —
   * re-checked here too since a disabled Rectangle can still be clicked.
   */
  private onSaveParty(): void {
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

  private buildBackButton(width: number): void {
    const back = this.add
      .rectangle(width / 2, 1040, 200, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(width / 2, 1040, "Back to Menu", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);
    back.on("pointerover", () => back.setFillStyle(0x3a3a4a));
    back.on("pointerout", () => back.setFillStyle(0x2a2a3a));
    back.on("pointerdown", () => this.scene.start("MainMenuScene"));
    label.setName("back-button-label");
  }

  /**
   * Rebuild a slot's editable state from a previously saved `CharacterBuild`
   * (Phase 9, D-083). `indexOf` returning -1 (a name/class/race/ability the
   * save no longer matches, e.g. data changed since it was saved) falls back
   * to index 0 via `Math.max(0, ...)` — same defensive spirit as the rest of
   * this scene.
   */
  private slotStateFromBuild(build: CharacterBuild): SlotState {
    return {
      name: build.name,
      classIndex: Math.max(0, CREATABLE_CLASS_IDS.indexOf(build.classId)),
      raceIndex: Math.max(0, RACE_IDS.indexOf(build.raceId)),
      allocator:
        build.abilityScoreMethod === "pointBuy"
          ? pointBuyAllocatorFromScores(build.abilityScores)
          : allocatorFromScores(build.abilityScores),
      abilityIndex: Math.max(0, signatureActionIdsForClass(build.classId).indexOf(build.abilityId)),
      controlledBy: build.controlledBy,
      // Phase 13.11 (D-096): -1 (no starting item, or one the catalogue no
      // longer has) plus 1 lands on 0 — "None" — the same safe fallback
      // `Math.max(0, ...)` gives every other indexOf lookup above.
      startingGearIndex: build.startingEquipmentId ? STARTING_GEAR_IDS.indexOf(build.startingEquipmentId) + 1 : 0,
      // Phase 14.2 (D-099): reconstruct which of the class's subclasses was
      // picked, same safe `Math.max(0, ...)` fallback as everything above —
      // undefined `build.subclassId` (a later-choice class) also lands on 0,
      // harmlessly unused since `subclassIdForNewBuild` ignores it for those.
      subclassIndex: Math.max(0, subclassesForClass(build.classId).findIndex((s) => s.id === build.subclassId)),
      startingLevel: build.startingLevel ?? 1,
      levelUpPlan: build.levelUpPlan ?? emptyLevelUpPlan(),
      spellPicks: {
        leveledSpellIds: build.preparedSpellIds,
        cantripIds: build.knownCantripIds,
        spellbookIds: build.spellbookIds,
      },
    };
  }

  /**
   * Every ACTIVE slot's finished build (length `partySize`), ids stable per
   * slot (`party-1`..`party-4`) — a slot dimmed out by a smaller party size
   * contributes nothing here, so it's excluded from both validation and the
   * roster BattleScene receives.
   */
  private buildsFromSlots(): CharacterBuild[] {
    return this.slots.slice(0, this.partySize).map((s, i) => {
      const classId = CREATABLE_CLASS_IDS[s.classIndex];
      const actionIds = signatureActionIdsForClass(classId);
      return {
        id: `party-${i + 1}`,
        name: s.name,
        raceId: RACE_IDS[s.raceIndex],
        classId,
        level: 1,
        abilityScores: s.allocator.scores(),
        abilityScoreMethod: this.abilityScoreMethod === "pointBuy" ? "pointBuy" : undefined,
        abilityId: actionIds[s.abilityIndex % actionIds.length],
        controlledBy: s.controlledBy,
        // Phase 13.11 (D-096): a level-1-choice class (Cleric/Sorcerer/
        // Warlock) already has a modeled subclass the instant it's created —
        // Phase 14.2 (D-099): WHICH one is now the player's real choice, via
        // the Subclass row's cycle button (`s.subclassIndex`). Every other
        // class starts undefined (see BattleScene's subclass-choice queue).
        subclassId: subclassIdForNewBuild(classId, s.subclassIndex),
        startingEquipmentId: s.startingGearIndex > 0 ? STARTING_GEAR_IDS[s.startingGearIndex - 1] : undefined,
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
    });
  }

  private buildRoster(): HeroDefinition[] {
    return this.buildsFromSlots().map((b) => heroDefinitionFromBuild(b));
  }

  /** Dim and disable an inactive (beyond party size) slot, or restore an active one. */
  private setSlotActive(widgets: SlotWidgets, active: boolean): void {
    const alpha = active ? 1 : 0.32;
    widgets.allObjects.forEach((o) => (o as Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text).setAlpha(alpha));
    widgets.interactiveButtons.forEach((b) => (active ? b.setInteractive({ useHandCursor: true }) : b.disableInteractive()));
    // D-147 (piece 2): the name row is a real HTML `<input>`, not a Phaser
    // `Rectangle` — `disableInteractive()` above doesn't reach it.
    widgets.nameInputNode.disabled = !active;
  }

  /**
   * D-147 (piece 3): shows/enables exactly one of the two ability-score
   * control sets per slot — Standard Array's cycle-row buttons, or Point
   * Buy's +/- steppers — matching the current party-wide method. Runs
   * AFTER `setSlotActive` in `refreshAll` so it has the final say on both
   * sets' interactivity (an inactive slot beyond `partySize` stays fully
   * disabled either way).
   */
  private refreshAbilityScoreControls(): void {
    const standardArray = this.abilityScoreMethod === "standardArray";
    this.widgets.forEach((w, slot) => {
      const active = slot < this.partySize;
      w.standardArrayRowButtons.forEach((b) => {
        b.setVisible(standardArray);
        if (active && standardArray) b.setInteractive({ useHandCursor: true });
        else b.disableInteractive();
      });
      w.pointBuyButtons.forEach((b) => {
        b.setVisible(!standardArray);
        if (active && !standardArray) b.setInteractive({ useHandCursor: true });
        else b.disableInteractive();
      });
    });
  }

  /** Re-render every active slot's text, dim inactive ones, and re-validate the party. */
  private refreshAll(): void {
    const builds = this.buildsFromSlots();
    builds.forEach((build, slot) => this.refreshSlot(slot, build));
    this.widgets.forEach((w, slot) => this.setSlotActive(w, slot < this.partySize));
    this.refreshAbilityScoreControls();

    this.partySizeLabel.setText(`Party Size: ${this.partySize}`);
    this.difficultyLabel.setText(`Difficulty: ${getDifficultyDefinition(this.difficultyId).name}`);
    this.abilityScoreMethodLabel.setText(
      `Ability Scores: ${this.abilityScoreMethod === "pointBuy" ? "Point Buy" : "Standard Array"}`,
    );
    this.teamLevelLabel.setText(`Team Level: ${this.teamLevelValue} (all heroes)`);

    const duplicateNames = hasDuplicateNames(builds);
    // D-147 (piece 2): a hero name is now free text, so an empty/whitespace
    // field is newly possible — it isn't caught by `hasDuplicateNames`
    // unless two heroes are BOTH blank.
    const blankName = builds.some((b) => !b.name.trim());
    const duplicateAbilities = hasDuplicateAbilities(builds);
    const invalidNames = duplicateNames || blankName;
    const valid = !invalidNames && !duplicateAbilities;
    this.partyValid = valid;

    if (valid) {
      this.startButton.setFillStyle(0x4caf72);
      this.startButton.setInteractive({ useHandCursor: true });
      this.statusText.setText("");
    } else {
      this.startButton.setFillStyle(0x4a4a4a);
      this.startButton.disableInteractive();
      const nameMessage = blankName ? "Every hero needs a name." : "Every hero needs a unique name.";
      this.statusText.setText(
        invalidNames && duplicateAbilities
          ? `${nameMessage} Every hero also needs a unique signature ability.`
          : invalidNames
            ? nameMessage
            : "Every hero needs a unique signature ability.",
      );
    }

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
    this.savePartyLabel.setText(this.loadedSlotId ? "Update Saved Party" : "Save New Party");

    if (valid && !atCap) {
      this.savePartyButton.setInteractive({ useHandCursor: true });
      this.savePartyButton.setAlpha(1);
    } else {
      this.savePartyButton.disableInteractive();
      this.savePartyButton.setAlpha(0.5);
    }

    const currentSlot = this.loadedSlotId ? getSaveSlot(this.saveFile, this.loadedSlotId) : undefined;
    this.saveStatusLabel.setText(
      currentSlot
        ? `Saved as "${currentSlot.name}"`
        : atCap
          ? "Save slots full (max 6) — delete one first"
          : "Unsaved party",
    );
  }

  private refreshSlot(slot: number, build: CharacterBuild): void {
    const w = this.widgets[slot];
    w.controlLabel.setText(
      `Hero ${slot + 1} · ${build.controlledBy === "ai" ? "AI" : "Human"} (click to toggle)`,
    );
    // D-147 (piece 2): the name field is a live-typed DOM `<input>`, not a
    // Text label re-rendered from `build.name` — writing to it here would
    // fight the player's own typing/cursor position. Nothing to set.
    w.classLabel.setText(`Class: ${getClassDefinition(build.classId).name}`);
    w.raceLabel.setText(`Race: ${getRaceDefinition(build.raceId).name}`);

    ABILITY_SCORE_IDS.forEach((ability, i) => {
      const score = build.abilityScores[ability];
      const mod = modifierFor(build.abilityScores, ability);
      const modText = mod >= 0 ? `+${mod}` : `${mod}`;
      let text = `${ABILITY_SCORE_NAMES[ability].slice(0, 3).toUpperCase()} ${score} (${modText})`;
      // D-147 (piece 3): Point Buy's remaining-points readout rides on the
      // first ability row's own label rather than a new row, so it can't
      // disturb this scene's already-tight, hardcoded vertical layout (see
      // KI-083's documented fragility around exactly that).
      if (i === 0 && this.abilityScoreMethod === "pointBuy") {
        const allocator = this.slots[slot].allocator as PointBuyAllocator;
        text += `   Points Left: ${allocator.remainingPoints()}/${POINT_BUY_BUDGET}`;
      }
      w.abilityScoreLabels[ability].setText(text);
      if (i === 0) this.fitLabelToColumnWidth(w.abilityScoreLabels[ability]);
    });

    const ability = getAbility(build.abilityId);
    w.signatureLabel.setText(ability.name);

    w.gearLabel.setText(
      build.startingEquipmentId ? `Gear: ${getEquipmentDefinition(build.startingEquipmentId).name}` : "Gear: None",
    );

    w.subclassLabel.setText(this.subclassSummary(build.classId, build.subclassId, this.slots[slot].levelUpPlan));
    this.fitLabelToColumnWidth(w.subclassLabel);

    const def = heroDefinitionFromBuild(build);
    // D-129: the stats preview now reflects the chosen Starting Level, not
    // always level 1 — `combatStatsForClassLevel` is the same pure function
    // `heroDefinitionFromBuild` itself calls, just re-run at `startingLevel`
    // instead of the build's fixed `level: 1`. Range/Move don't change by
    // level, so those two still come from `def` unchanged. This preview
    // does NOT include any Ability Score Improvement a real fast-forward
    // would apply (see `BattleScene.fastForwardHeroToLevel`) — a deliberate
    // simplification, since ASI always targets whichever ability is highest
    // AT THE TIME, something only the actual fast-forward can resolve.
    const leveledStats = combatStatsForClassLevel(
      build.classId,
      build.startingLevel ?? 1,
      build.abilityScores,
      build.abilityId,
    );
    w.statsLabel.setText(
      `HP ${leveledStats.maxHealth}  ATK ${leveledStats.attackDamage}\nRange ${def.attackRangeTiles}  Move ${def.movementTiles}`,
    );
    w.levelLabel.setText(`Starting Level: ${build.startingLevel ?? 1}`);

    const plan = this.slots[slot].levelUpPlan;
    const planStatus = plan.mode === "auto" ? "Auto" : plan.mode === "prompt" ? "Prompt" : "Off";
    w.planLabel.setText(`Plan Levels: ${planStatus}`);

    w.spellsLabel.setText(this.spellsSummary(slot, build.classId, build.startingLevel ?? 1));
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
   */
  private subclassSummary(classId: string, subclassId: string | undefined, plan: LevelUpPlan): string {
    const options = subclassesForClass(classId);
    if (subclassId) {
      const hint = options.length > 1 ? " (click to change)" : "";
      return `Subclass: ${getSubclassDefinition(subclassId).name}${hint}`;
    }
    const classDef = getClassDefinition(classId);
    if (plan.subclassId) {
      return `Subclass: ${getSubclassDefinition(plan.subclassId).name} (planned via Plan Levels)`;
    }
    return `Subclass: pick via "Plan Levels" below, or in battle at level ${classDef.subclassChoiceLevel} (${options.length} options)`;
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
   * D-147 (piece 3): also reused for the first ability-score row's label,
   * which grows a "Points Left: N/27" suffix in Point Buy mode — same
   * "computed text, fixed-width button" overflow risk, same fix.
   */
  private fitLabelToColumnWidth(label: Phaser.GameObjects.Text): void {
    const maxWidth = COLUMN_WIDTH - 20 - 8;
    const baseFontSizePx = 13;
    const minFontSizePx = 9;
    label.setFontSize(baseFontSizePx);
    let size = baseFontSizePx;
    while (label.width > maxWidth && size > minFontSizePx) {
      size -= 1;
      label.setFontSize(size);
    }
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
    };
    const classId = CREATABLE_CLASS_IDS[this.slots[slot].classIndex];
    this.planningSteps = futureChoiceSteps(classId);
    this.planningStepIndex = 0;
    this.showPlanModeSelect();
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
    for (const obj of this.levelPlanOverlay) obj.destroy();
    this.levelPlanOverlay = [];
  }

  private showPlanModeSelect(): void {
    this.renderPlanPrompt("How should this hero's future level-ups be handled?", [
      {
        label: "Auto-follow a blueprint",
        desc: "Every choice you plan next applies silently, in battle — no popups at all for this hero.",
        onClick: () => {
          this.planningDraft.mode = "auto";
          this.planningStepIndex = 0;
          this.showNextPlanStep();
        },
        highlighted: this.planningDraft.mode === "auto",
      },
      {
        label: "Prompted each level",
        desc: "You'll still get the usual in-battle popup — pre-highlighted with whatever you plan next.",
        onClick: () => {
          this.planningDraft.mode = "prompt";
          this.planningStepIndex = 0;
          this.showNextPlanStep();
        },
        highlighted: this.planningDraft.mode === "prompt",
      },
      {
        label: "Always choose fresh",
        desc: "No blueprint at all — every future choice is made unprompted, in battle, exactly as today.",
        onClick: () => {
          this.planningDraft = emptyLevelUpPlan("fresh");
          this.closeLevelPlanner(true);
        },
        highlighted: this.planningDraft.mode === "fresh",
      },
      {
        label: "Cancel",
        desc: "Discard any changes made in this session and keep this hero's previously saved plan.",
        onClick: () => this.closeLevelPlanner(false),
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
    else this.showPlanSpellPickStep(step);
  }

  private advancePlanStep(): void {
    this.planningStepIndex += 1;
    this.showNextPlanStep();
  }

  private goBackPlanStep(): void {
    if (this.planningStepIndex === 0) {
      this.showPlanModeSelect();
      return;
    }
    this.planningStepIndex -= 1;
    this.showNextPlanStep();
  }

  private showPlanDoneScreen(): void {
    this.renderPlanPrompt("Blueprint complete", [
      { label: "Save & Close", desc: "Commits every choice made in this session to this hero.", onClick: () => this.closeLevelPlanner(true) },
      { label: "◀ Back", onClick: () => this.goBackPlanStep() },
      { label: "Cancel", desc: "Discard this session's edits and keep the previously saved plan.", onClick: () => this.closeLevelPlanner(false) },
    ]);
  }

  private planBackChoice(): { label: string; onClick: () => void } {
    return { label: "◀ Back", onClick: () => this.goBackPlanStep() };
  }

  private planSkipChoice(): { label: string; desc: string; onClick: () => void } {
    return {
      label: "Skip (use default here)",
      desc: "Leaves this level unset — resolved with the usual default (or still prompted live, if this hero's mode is Prompted).",
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
    this.clearLevelPlanOverlay();
    const { width: viewportWidth, height: viewportHeight } = getViewport(this);
    const dim = this.add
      .rectangle(viewportWidth / 2, viewportHeight / 2, viewportWidth, viewportHeight, 0x000000, 0.85)
      .setDepth(60)
      .setInteractive();
    const titleText = this.add
      .text(viewportWidth / 2, 90, title, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "24px",
        color: "#f0e070",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: viewportWidth - 160 },
      })
      .setOrigin(0.5)
      .setDepth(61);
    this.levelPlanOverlay.push(dim, titleText);

    const hasDesc = choices.some((c) => c.desc);
    const usableWidth = viewportWidth - 80;
    const width = Math.min(220, Math.max(120, Math.floor(usableWidth / Math.min(choices.length, 6)) - 14));
    const height = hasDesc ? 82 : 44;
    const spacing = width + 14;
    const maxPerRow = Math.max(1, Math.floor(usableWidth / spacing));
    const rowSpacing = height + 14;
    const rowStartY = 170 + rowSpacing / 2;

    choices.forEach((choice, i) => {
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const itemsInRow = Math.min(maxPerRow, choices.length - row * maxPerRow);
      const rowStartX = viewportWidth / 2 - ((itemsInRow - 1) * spacing) / 2;
      const x = rowStartX + col * spacing;
      const y = rowStartY + row * rowSpacing;
      const btn = this.add
        .rectangle(x, y, width, height, 0x3a5a8a)
        .setInteractive({ useHandCursor: true })
        .setDepth(61);
      if (choice.highlighted) btn.setStrokeStyle(3, 0xf0c040);
      const name = this.add
        .text(x, y - (choice.desc ? 18 : 0), choice.highlighted ? `★ ${choice.label}` : choice.label, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: choice.highlighted ? "#ffe58a" : "#e8e8f0",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: width - 14 },
        })
        .setOrigin(0.5)
        .setDepth(62);
      this.levelPlanOverlay.push(btn, name);
      if (choice.desc) {
        const desc = this.add
          .text(x, y + 16, choice.desc, {
            fontFamily: "system-ui, Arial, sans-serif",
            fontSize: "10px",
            color: "#c8c8d8",
            align: "center",
            wordWrap: { width: width - 14 },
          })
          .setOrigin(0.5)
          .setDepth(62);
        this.levelPlanOverlay.push(desc);
      }
      btn.on("pointerover", () => btn.setFillStyle(0x4a6a9a));
      btn.on("pointerout", () => btn.setFillStyle(0x3a5a8a));
      btn.on("pointerdown", () => choice.onClick());
    });
  }
}
