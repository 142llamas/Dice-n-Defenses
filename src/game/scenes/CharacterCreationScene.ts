import Phaser from "phaser";
import { GAME_WIDTH, SAVE_STORAGE_KEY } from "../config";
import { ABILITY_SCORE_IDS, ABILITY_SCORE_NAMES, modifierFor, type AbilityScoreId } from "../data/abilityScores";
import { CHARACTER_NAME_POOL, CREATABLE_CLASS_IDS, STARTING_GEAR_IDS, signatureActionIdsForClass } from "../data/characterCreation";
import { getAbility } from "../data/abilities";
import { getClassDefinition } from "../data/classes";
import { subclassesForClass, getSubclassDefinition } from "../data/subclasses";
import { getEquipmentDefinition } from "../data/equipment";
import { RACE_IDS, getRaceDefinition } from "../data/races";
import type { HeroDefinition, HeroControlMode } from "../data/heroes";
import { DIFFICULTY_IDS, getDifficultyDefinition, type DifficultyId } from "../data/difficulty";
import type { WaveDefinition } from "../data/waves";
import type { ParsedMap } from "../data/testMap";
import {
  StandardArrayAllocator,
  allocatorFromScores,
  heroDefinitionFromBuild,
  hasDuplicateAbilities,
  hasDuplicateNames,
  subclassIdForNewBuild,
  type CharacterBuild,
} from "../systems/CharacterBuildSystem";
import {
  MAX_SAVE_SLOTS,
  createSaveSlot,
  getSaveSlot,
  loadSaveFile,
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
 */

const MAX_PARTY_SIZE = 4;
const MIN_PARTY_SIZE = 1;
const COLUMN_WIDTH = 290;
const COLUMN_GAP = 10;
const FIRST_COLUMN_LEFT =
  (GAME_WIDTH - (MAX_PARTY_SIZE * COLUMN_WIDTH + (MAX_PARTY_SIZE - 1) * COLUMN_GAP)) / 2;

function columnCenterX(slot: number): number {
  return FIRST_COLUMN_LEFT + slot * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH / 2;
}

interface SlotState {
  nameIndex: number;
  classIndex: number;
  raceIndex: number;
  allocator: StandardArrayAllocator;
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
}

interface SlotWidgets {
  controlLabel: Phaser.GameObjects.Text;
  nameLabel: Phaser.GameObjects.Text;
  classLabel: Phaser.GameObjects.Text;
  raceLabel: Phaser.GameObjects.Text;
  abilityScoreLabels: Record<AbilityScoreId, Phaser.GameObjects.Text>;
  signatureLabel: Phaser.GameObjects.Text;
  gearLabel: Phaser.GameObjects.Text;
  subclassLabel: Phaser.GameObjects.Text;
  statsLabel: Phaser.GameObjects.Text;
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
  /** Phase 9 (D-083): the save slot this party was loaded from/saved to, if any. */
  private loadedSlotId?: string;
  private loadedParty?: CharacterBuild[];
  private saveFile!: SaveFile;
  /** Phase 10 (D-084): tracked so a save can be mirrored to the cloud when signed in with Google. */
  private authState: AuthState = { uid: null, isAnonymous: true, displayName: null };
  private savePartyButton!: Phaser.GameObjects.Rectangle;
  private savePartyLabel!: Phaser.GameObjects.Text;
  private saveStatusLabel!: Phaser.GameObjects.Text;

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
  }): void {
    this.campaignId = data?.campaignId;
    this.freePlayMapId = data?.freePlayMapId;
    this.freePlayWaves = data?.freePlayWaves;
    this.difficultyId = data?.difficultyId ?? "normal";
    this.loadedSlotId = data?.loadedSlotId;
    this.loadedParty = data?.loadedParty;
    this.customMapData = data?.customMapData;
  }

  create(): void {
    this.slots = [];
    this.widgets = [];
    this.saveFile = loadSaveFile(window.localStorage, SAVE_STORAGE_KEY);
    initAuth((state) => (this.authState = state));

    this.cameras.main.setBackgroundColor("#0e0e14");

    this.add
      .text(GAME_WIDTH / 2, 36, "BUILD YOUR PARTY", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "32px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        72,
        "Click a name, class, race, or ability to cycle it. Click an ability score to reassign it.",
        { fontFamily: "system-ui, Arial, sans-serif", fontSize: "15px", color: "#8a8aa0" },
      )
      .setOrigin(0.5);

    for (let slot = 0; slot < MAX_PARTY_SIZE; slot++) {
      const loadedBuild = this.loadedParty?.[slot];
      this.slots.push(
        loadedBuild
          ? this.slotStateFromBuild(loadedBuild)
          : {
              nameIndex: slot,
              classIndex: 0,
              raceIndex: 0,
              allocator: new StandardArrayAllocator(),
              abilityIndex: slot,
              controlledBy: "human",
              startingGearIndex: 0,
              subclassIndex: 0,
            },
      );
      this.widgets.push(this.buildSlotUi(slot));
    }
    if (this.loadedParty) {
      this.partySize = Math.min(MAX_PARTY_SIZE, Math.max(MIN_PARTY_SIZE, this.loadedParty.length));
    }

    this.buildBottomControls();
    this.buildStartButton();
    this.buildBackButton();
    this.refreshAll();
  }

  private buildSlotUi(slot: number): SlotWidgets {
    const x = columnCenterX(slot);
    const allObjects: Phaser.GameObjects.GameObject[] = [];
    const interactiveButtons: Phaser.GameObjects.Rectangle[] = [];

    // Spans the actual content range (Hero-N label at ~y121 through the
    // stats preview at ~y635), verified by adding up every row's height and
    // gap below (bounding-box math, no browser available here — same
    // discipline as D-046/D-055/D-059's HUD layout fixes). Grew by 40px in
    // Phase 11.3 (D-075) for the race row, another 40px in Phase 13.11
    // (D-096) for the Gear row, and another 40px in Phase 14.2 (D-099) for
    // the new Subclass row — top edge (y105) held fixed every time, so the
    // whole column grows downward, not into the title/subtitle above.
    const background = this.add
      .rectangle(x, 370, COLUMN_WIDTH, 530, 0x1a1a26)
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

    const nameButton = this.add
      .rectangle(x, 165, COLUMN_WIDTH - 20, 34, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const nameLabel = this.add
      .text(x, 165, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#e8e8f0", fontStyle: "bold" })
      .setOrigin(0.5);
    nameButton.on("pointerover", () => nameButton.setFillStyle(0x3a3a4a));
    nameButton.on("pointerout", () => nameButton.setFillStyle(0x2a2a3a));
    nameButton.on("pointerdown", () => {
      const s = this.slots[slot];
      s.nameIndex = (s.nameIndex + 1) % CHARACTER_NAME_POOL.length;
      this.refreshAll();
    });

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
      s.classIndex = (s.classIndex + 1) % CREATABLE_CLASS_IDS.length;
      s.abilityIndex = 0; // the new class's action list has a different shape — start from its first entry
      this.refreshAll();
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
      s.raceIndex = (s.raceIndex + 1) % RACE_IDS.length;
      this.refreshAll();
    });

    const abilityScoreLabels = {} as Record<AbilityScoreId, Phaser.GameObjects.Text>;
    const abilityRowsTop = 270;
    const abilityRowHeight = 30;
    ABILITY_SCORE_IDS.forEach((ability, row) => {
      const y = abilityRowsTop + row * abilityRowHeight;
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
        this.slots[slot].allocator.cycle(ability);
        this.refreshAll();
      });
      abilityScoreLabels[ability] = label;
      allObjects.push(rowButton);
      interactiveButtons.push(rowButton);
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
      s.startingGearIndex = (s.startingGearIndex + 1) % (STARTING_GEAR_IDS.length + 1);
      this.refreshAll();
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
      s.subclassIndex = (s.subclassIndex + 1) % options.length;
      this.refreshAll();
    });

    const statsLabel = this.add
      .text(x, subclassY + 45, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#9be0b4",
        align: "center",
      })
      .setOrigin(0.5);

    allObjects.push(
      nameButton,
      nameLabel,
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
      ...Object.values(abilityScoreLabels),
    );
    interactiveButtons.push(nameButton, classButton, raceButton, signatureButton, gearButton, subclassButton);

    return {
      controlLabel,
      nameLabel,
      classLabel,
      raceLabel,
      abilityScoreLabels,
      signatureLabel,
      gearLabel,
      subclassLabel,
      statsLabel,
      allObjects,
      interactiveButtons,
    };
  }

  // Phase 11.4 (D-077): party size + difficulty, sitting in the gap between
  // the slot columns and Start Battle. Phase 13.11 (D-096): shifted down
  // another +50px (600->650); Phase 14.2 (D-099): shifted down another +40px
  // (650->690), along with every row below it, to clear the column
  // background's new taller bottom edge (y635, after the Subclass row) —
  // same discipline as the race-row +40 shift and the 720->900->1000 canvas
  // bumps; GAME_HEIGHT (1080) has ample room to spare either way.
  private buildBottomControls(): void {
    const y = 690;
    const leftX = GAME_WIDTH / 2 - 150;
    const rightX = GAME_WIDTH / 2 + 150;

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

  // Phase 9 (D-083): Start Battle moves to the left half of the row,
  // mirroring the party-size/difficulty row's own leftX/rightX split one row
  // above — Save Party takes the right half. Phase 13.11 (D-096): this whole
  // row shifted down +50px (650->700); Phase 14.2 (D-099): another +40px
  // (700->740), same reason as buildBottomControls' own shift.
  private buildStartButton(): void {
    const leftX = GAME_WIDTH / 2 - 150;
    const rightX = GAME_WIDTH / 2 + 150;

    this.startButton = this.add
      .rectangle(leftX, 740, 260, 50, 0x4caf72)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(leftX, 740, "Start Battle", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "20px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.startButton.on("pointerdown", () => {
      if (!this.partyValid) return;
      if (this.loadedSlotId) {
        this.saveFile = updateSaveSlot(this.saveFile, this.loadedSlotId, {
          party: this.buildsFromSlots(),
          partySize: this.partySize,
          difficultyId: this.difficultyId,
          updatedAt: Date.now(),
        });
        saveSaveFile(window.localStorage, SAVE_STORAGE_KEY, this.saveFile);
        this.pushLoadedSlotToCloud();
      }
      // Party size isn't sent separately: BattleScene derives it from
      // heroDefinitions.length, which is always the true count.
      this.scene.start("BattleScene", {
        heroDefinitions: this.buildRoster(),
        difficultyId: this.difficultyId,
        campaignId: this.campaignId,
        freePlayMapId: this.freePlayMapId,
        freePlayWaves: this.freePlayWaves,
        customMapData: this.customMapData,
      });
    });

    this.savePartyButton = this.add
      .rectangle(rightX, 740, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.savePartyLabel = this.add
      .text(rightX, 740, "", {
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
      .text(rightX, 790, "", { fontFamily: "monospace", fontSize: "13px", color: "#8a8aa0" })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, 820, "", {
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
    const builds = this.buildsFromSlots();
    if (this.loadedSlotId) {
      this.saveFile = updateSaveSlot(this.saveFile, this.loadedSlotId, {
        party: builds,
        partySize: this.partySize,
        difficultyId: this.difficultyId,
        updatedAt: Date.now(),
      });
    } else {
      if (this.saveFile.slots.length >= MAX_SAVE_SLOTS) return;
      const id = `save-${Date.now()}`;
      this.saveFile = createSaveSlot(this.saveFile, {
        id,
        name: `${builds[0].name}'s Party`,
        createdAt: Date.now(),
        party: builds,
        partySize: this.partySize,
        difficultyId: this.difficultyId,
      });
      this.loadedSlotId = id;
    }
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
    const back = this.add
      .rectangle(GAME_WIDTH / 2, 870, 200, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(GAME_WIDTH / 2, 870, "Back to Menu", {
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
      nameIndex: Math.max(0, CHARACTER_NAME_POOL.indexOf(build.name)),
      classIndex: Math.max(0, CREATABLE_CLASS_IDS.indexOf(build.classId)),
      raceIndex: Math.max(0, RACE_IDS.indexOf(build.raceId)),
      allocator: allocatorFromScores(build.abilityScores),
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
        name: CHARACTER_NAME_POOL[s.nameIndex],
        raceId: RACE_IDS[s.raceIndex],
        classId,
        level: 1,
        abilityScores: s.allocator.scores(),
        abilityId: actionIds[s.abilityIndex % actionIds.length],
        controlledBy: s.controlledBy,
        // Phase 13.11 (D-096): a level-1-choice class (Cleric/Sorcerer/
        // Warlock) already has a modeled subclass the instant it's created —
        // Phase 14.2 (D-099): WHICH one is now the player's real choice, via
        // the Subclass row's cycle button (`s.subclassIndex`). Every other
        // class starts undefined (see BattleScene's subclass-choice queue).
        subclassId: subclassIdForNewBuild(classId, s.subclassIndex),
        startingEquipmentId: s.startingGearIndex > 0 ? STARTING_GEAR_IDS[s.startingGearIndex - 1] : undefined,
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
  }

  /** Re-render every active slot's text, dim inactive ones, and re-validate the party. */
  private refreshAll(): void {
    const builds = this.buildsFromSlots();
    builds.forEach((build, slot) => this.refreshSlot(slot, build));
    this.widgets.forEach((w, slot) => this.setSlotActive(w, slot < this.partySize));

    this.partySizeLabel.setText(`Party Size: ${this.partySize}`);
    this.difficultyLabel.setText(`Difficulty: ${getDifficultyDefinition(this.difficultyId).name}`);

    const duplicateNames = hasDuplicateNames(builds);
    const duplicateAbilities = hasDuplicateAbilities(builds);
    const valid = !duplicateNames && !duplicateAbilities;
    this.partyValid = valid;

    if (valid) {
      this.startButton.setFillStyle(0x4caf72);
      this.startButton.setInteractive({ useHandCursor: true });
      this.statusText.setText("");
    } else {
      this.startButton.setFillStyle(0x4a4a4a);
      this.startButton.disableInteractive();
      this.statusText.setText(
        duplicateNames && duplicateAbilities
          ? "Every hero needs a unique name AND a unique signature ability."
          : duplicateNames
            ? "Every hero needs a unique name."
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
    w.nameLabel.setText(build.name);
    w.classLabel.setText(`Class: ${getClassDefinition(build.classId).name}`);
    w.raceLabel.setText(`Race: ${getRaceDefinition(build.raceId).name}`);

    ABILITY_SCORE_IDS.forEach((ability) => {
      const score = build.abilityScores[ability];
      const mod = modifierFor(build.abilityScores, ability);
      const modText = mod >= 0 ? `+${mod}` : `${mod}`;
      w.abilityScoreLabels[ability].setText(`${ABILITY_SCORE_NAMES[ability].slice(0, 3).toUpperCase()} ${score} (${modText})`);
    });

    const ability = getAbility(build.abilityId);
    w.signatureLabel.setText(ability.name);

    w.gearLabel.setText(
      build.startingEquipmentId ? `Gear: ${getEquipmentDefinition(build.startingEquipmentId).name}` : "Gear: None",
    );

    w.subclassLabel.setText(this.subclassSummary(build.classId, build.subclassId));

    const def = heroDefinitionFromBuild(build);
    w.statsLabel.setText(
      `HP ${def.maxHealth}  ATK ${def.attackDamage}\nRange ${def.attackRangeTiles}  Move ${def.movementTiles}`,
    );
  }

  /**
   * Phase 13.11 (D-096): originally the third stats-preview line; Phase 14.2
   * (D-099) split it into its own clickable row. A level-1-choice class
   * (Cleric/Sorcerer/Warlock) now names the ACTUAL chosen subclass — a real
   * pick between two options, not an auto-assignment — with a "(click to
   * change)" hint; every other class still names the level its own
   * confirmation will appear at in battle, plus how many options it has.
   */
  private subclassSummary(classId: string, subclassId?: string): string {
    const options = subclassesForClass(classId);
    if (subclassId) {
      const hint = options.length > 1 ? " (click to change)" : "";
      return `Subclass: ${getSubclassDefinition(subclassId).name}${hint}`;
    }
    const classDef = getClassDefinition(classId);
    return `Subclass: chosen in battle at level ${classDef.subclassChoiceLevel} (${options.length} options)`;
  }
}
