import Phaser from "phaser";
import { CAMPAIGN_PROGRESS_STORAGE_KEY } from "../config";
import { TEST_MAP } from "../data/testMap";
import { EMBERFORD_MAP } from "../data/emberfordMap";
import { SALTMERE_MAP } from "../data/saltmereMap";
import { CAUSEWAY_MAP } from "../data/causewayMap";
import { DROWNING_VALE_MAP } from "../data/drowningValeMap";
import { CINDERFALL_RIFT_MAP } from "../data/cinderfallRiftMap";
import { FROSTBOUND_HOLLOW_MAP } from "../data/frostboundHollowMap";
import { getEnemyDefinition } from "../data/enemies";
import { getCampaignDefinition } from "../data/campaigns";
import { loadCampaignProgress, isCampaignCompleted } from "../systems/CampaignProgressSystem";
import { DIFFICULTY_IDS, getDifficultyDefinition, difficultyChoiceDescription, type DifficultyId } from "../data/difficulty";
import { generateFreePlayWaves } from "../systems/FreePlayWaveGenerator";
import {
  getViewport,
  onViewportResize,
  openChoiceList,
  createOrnateButton,
  drawScreenBackdrop,
  createSectionLabel,
  FONT_DISPLAY,
  FONT_BODY,
  type OrnateButtonHandle,
} from "./uiTheme";

/**
 * FreePlayScene — Phase 11.9 (D-071): a config screen for free-play mode
 * ("beat the story mode to unlock endless/custom mode on that content").
 *
 * Modeled visually on `CampaignSelectScene` (title, top-left Back button,
 * the same small rectangle-button style) so it reads as part of the same
 * game rather than a bolted-on screen. Unlike CampaignSelectScene, this
 * screen doesn't jump straight to `CharacterCreationScene` on a single
 * click — the player fills out several small pickers first, then presses
 * Start, which generates the wave list (via `generateFreePlayWaves`) and
 * THEN hands off to `CharacterCreationScene` with `{ freePlayMapId,
 * freePlayWaves }`, reusing the existing party-builder flow exactly like
 * campaigns do.
 *
 * D-21x: reskinned to the shared fantasy/parchment theme (D-123, `uiTheme.ts`)
 * — same recipe already applied to MainMenuScene/CompendiumScene/
 * BestiaryScene/CharacterCreationScene — replacing the old flat
 * `add.rectangle().setStrokeStyle()` buttons with `createOrnateButton`.
 * Presentation only: every option's selection/unlock/difficulty/wave-count/
 * minion-source state and the Start handoff below are untouched.
 *
 * Unlock model (D-071, this sub-phase; extended Phase 27/D-180): `TEST_MAP`/
 * `basalt-colossus` are always available. Every other map/boss pair unlocks
 * once its own region's campaign is completed (`EMBERFORD_MAP`/`cinderlord`
 * → "emberford-reach", `SALTMERE_MAP`/`tidelord` → "saltmere-shallows", and
 * as of D-180 the other four maps/eight bosses gate on their own new
 * campaign ids too). Locked options stay visible but disabled, with a short
 * "Complete X to unlock" hint — same spirit as BestiaryScene's "seen vs.
 * unseen" gating, just reusing `CampaignProgressSystem` (already built in
 * 11.8) instead of a new store.
 */

export interface GatedOption {
  id: string;
  name: string;
  /** `null` = always unlocked (the baseline TEST_MAP/basalt-colossus content). */
  unlockCampaignId: string | null;
}

export const MAP_OPTIONS: GatedOption[] = [
  { id: TEST_MAP.id, name: TEST_MAP.name, unlockCampaignId: null },
  { id: EMBERFORD_MAP.id, name: EMBERFORD_MAP.name, unlockCampaignId: "emberford-reach" },
  { id: SALTMERE_MAP.id, name: SALTMERE_MAP.name, unlockCampaignId: "saltmere-shallows" },
  // Phase 23 (D-114) built these four maps; Phase 27 (D-180) gave each its
  // own chaptered campaign, so they now gate the same way Emberford/Saltmere
  // already did.
  { id: CAUSEWAY_MAP.id, name: CAUSEWAY_MAP.name, unlockCampaignId: "shattered-causeway" },
  { id: DROWNING_VALE_MAP.id, name: DROWNING_VALE_MAP.name, unlockCampaignId: "drowning-vale" },
  { id: CINDERFALL_RIFT_MAP.id, name: CINDERFALL_RIFT_MAP.name, unlockCampaignId: "cinderfall-rift" },
  { id: FROSTBOUND_HOLLOW_MAP.id, name: FROSTBOUND_HOLLOW_MAP.name, unlockCampaignId: "frostbound-hollow" },
];

const BOSS_OPTIONS: GatedOption[] = [
  { id: "basalt-colossus", name: getEnemyDefinition("basalt-colossus").name, unlockCampaignId: null },
  { id: "cinderlord", name: getEnemyDefinition("cinderlord").name, unlockCampaignId: "emberford-reach" },
  { id: "tidelord", name: getEnemyDefinition("tidelord").name, unlockCampaignId: "saltmere-shallows" },
  // Phase 13.10 (D-095)/20 (D-111)/21 (D-112): Gravemaw, Juggernaut/The
  // Devourer, Blightmother/The Husk, and Bloodrage Warlord/Sundered King
  // each got a real chaptered campaign in Phase 27 (D-180) and now gate the
  // same way Cinderlord/Tidelord already did.
  { id: "gravemaw", name: getEnemyDefinition("gravemaw").name, unlockCampaignId: "cinderfall-rift" },
  { id: "blightmother", name: getEnemyDefinition("blightmother").name, unlockCampaignId: "drowning-vale" },
  { id: "juggernaut", name: getEnemyDefinition("juggernaut").name, unlockCampaignId: "shattered-causeway" },
  { id: "warlord-korrath", name: getEnemyDefinition("warlord-korrath").name, unlockCampaignId: "cinderfall-rift" },
  { id: "the-devourer", name: getEnemyDefinition("the-devourer").name, unlockCampaignId: "shattered-causeway" },
  // The capstone-tier legendaries have no map/campaign of their own yet
  // (CAMPAIGN_STORY_DESIGN.md §5's "Nameless Throne" is still unbuilt) —
  // stay always-unlocked, same "don't leave real content unreachable"
  // reasoning the rest of this list already established.
  { id: "ashen-sovereign", name: getEnemyDefinition("ashen-sovereign").name, unlockCampaignId: null },
  { id: "the-hollow-empress", name: getEnemyDefinition("the-hollow-empress").name, unlockCampaignId: null },
  { id: "bloodrage-warlord", name: getEnemyDefinition("bloodrage-warlord").name, unlockCampaignId: "frostbound-hollow" },
  { id: "the-husk", name: getEnemyDefinition("the-husk").name, unlockCampaignId: "drowning-vale" },
  { id: "sundered-king", name: getEnemyDefinition("sundered-king").name, unlockCampaignId: "frostbound-hollow" },
];

const WAVE_COUNT_PRESETS: { label: string; count: number }[] = [
  { label: "Short (4)", count: 4 },
  { label: "Medium (7)", count: 7 },
  { label: "Long (10)", count: 10 },
];

/** The 7 pre-11.6 minions ("Standard"). */
const STANDARD_MINIONS: string[] = ["grunt", "runner", "wisp", "brute", "swarmling", "warden", "razorwing"];
/** Standard plus the 11.6 and 13.10 additions ("Expanded"). */
const PRE_20_EXPANDED_MINIONS: string[] = [...STANDARD_MINIONS, "hexer", "ravager", "marauder", "blightcaller"];
/** Phase 20 (D-111): every new minion-tier enemy, added to "Expanded" so none of it is dead scaffolding. */
const PRE_21_EXPANDED_MINIONS: string[] = [
  ...PRE_20_EXPANDED_MINIONS,
  "siegebreaker",
  "battering-brute",
  "shadowfang",
  "nightblade",
  "sprinter",
  "bolt-runner",
  "ironhide",
  "hoarder",
  "gilded-carrier",
  "cultist-caller",
  "bone-summoner",
  "warcaptain",
  "battlepriest",
  "bannerbearer",
  "cave-drake",
  "frost-warden",
];
/** Phase 21 (D-112): every new minion-tier enemy, added to "Expanded" so none of it is dead scaffolding. */
export const EXPANDED_MINIONS: string[] = [
  ...PRE_21_EXPANDED_MINIONS,
  "frenzied-cultist",
  "bloodwisp",
  "crimson-leech",
  "living-splinter",
  "ooze-splitter",
  "fungal-splitter",
  "warded-sentinel",
  "aegis-bearer",
  "cinder-wretch",
  "bomber-beetle",
  "pilferer",
  "coin-wraith",
  "blink-stalker",
  "rift-walker",
  "mimic-chest",
  "ambush-coffer",
  "battle-medic",
  "plague-warden",
  "hexbinder",
  "rat-swarm",
  "locust-swarm",
];

type MinionSource = "standard" | "expanded";

interface OptionButton {
  handle: OrnateButtonHandle;
  hint?: Phaser.GameObjects.Text;
  option: GatedOption;
  locked: boolean;
}

export class FreePlayScene extends Phaser.Scene {
  private unlockedCampaigns = new Set<string>();
  private mapButtons: OptionButton[] = [];
  private bossButtons: OptionButton[] = [];
  private waveCountButtons: { handle: OrnateButtonHandle; count: number }[] = [];
  private minionButtons: { handle: OrnateButtonHandle; source: MinionSource }[] = [];
  private difficultyButton!: OrnateButtonHandle;
  /** D-16x: the shared full-screen list-picker overlay (`openChoiceList`), replacing the old click-to-cycle Difficulty button. */
  private choiceOverlay: Phaser.GameObjects.GameObject[] = [];

  private selectedMapId = TEST_MAP.id;
  private selectedBossId = "basalt-colossus";
  private selectedWaveCount = 7;
  private selectedMinionSource: MinionSource = "standard";
  private selectedDifficultyId: DifficultyId = "normal";
  private layoutRoot?: Phaser.GameObjects.Container;

  constructor() {
    super("FreePlayScene");
  }

  create(): void {
    const progress = loadCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY);
    this.unlockedCampaigns = new Set(
      [
        "emberford-reach",
        "saltmere-shallows",
        "shattered-causeway",
        "cinderfall-rift",
        "drowning-vale",
        "frostbound-hollow",
      ].filter((id) => isCampaignCompleted(progress, id)),
    );

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds this scene's whole layout against the current viewport,
  // reusing the existing build methods verbatim (snapshot-diff into a fresh
  // container, same convention `LoadGameScene`/`CampaignSelectScene` established).
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    const { width } = getViewport(this);

    // D-21x: the ornate/parchment theme (D-123), same recipe every other
    // reskinned menu-adjacent scene uses.
    drawScreenBackdrop(this);

    this.add
      .text(width / 2, 42, "Free Play", {
        fontFamily: FONT_DISPLAY,
        fontSize: "34px",
        color: "#f0dfa8",
        fontStyle: "bold",
        letterSpacing: 2 as unknown as number,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    createOrnateButton(this, 120, 42, 160, 44, "Back (Esc)", () => this.leave(), { variant: "tool", depth: 5 });

    this.add
      .text(
        width / 2,
        84,
        "Mix and match: pick a map, a finale boss, a wave count, a minion pool, and a difficulty, then Start.",
        { fontFamily: FONT_BODY, fontSize: "15px", color: "#a89058", fontStyle: "italic" },
      )
      .setOrigin(0.5)
      .setDepth(1);

    this.buildMapSection(width, 130);
    this.buildBossSection(width, 255);
    this.buildWaveCountSection(width, 370);
    this.buildMinionSection(width, 460);
    this.buildDifficultySection(width, 550);
    this.buildStartButton(width, 650);

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);

    this.refreshAll();
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  private isUnlocked(option: GatedOption): boolean {
    return option.unlockCampaignId === null || this.unlockedCampaigns.has(option.unlockCampaignId);
  }

  private unlockHintFor(option: GatedOption): string {
    if (option.unlockCampaignId === null) return "";
    return `Complete ${getCampaignDefinition(option.unlockCampaignId).name} to unlock.`;
  }

  /**
   * One row of gated option buttons (map or boss pickers share this shape).
   * Phase 13.10 (D-095): button width is now COMPUTED, not a fixed 380 —
   * the boss row grew from 3 options to 5 (Gravemaw/Blightmother added),
   * and 5 fixed-380px buttons would overflow `GAME_WIDTH` (1280) outright.
   * `Math.min(380, ...)` keeps every EXISTING 3-option row (the map row,
   * and the boss row before this chat) pixel-identical — `(1180-40)/3`
   * already equals 380 exactly, same bounding-box-math precedent as
   * D-046/D-055/D-085.
   */
  private buildOptionRow(
    width: number,
    y: number,
    options: GatedOption[],
    onSelect: (id: string) => void,
  ): OptionButton[] {
    const maxTotalWidth = width - 100; // matches the original 1280-wide 1180 margin
    const gap = 20;
    const w = Math.min(380, (maxTotalWidth - (options.length - 1) * gap) / options.length);
    const baseH = 56;
    const totalWidth = options.length * w + (options.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + w / 2;
    // Playtest fix: the label had no wordWrap (only the locked hint below it
    // did), so a real map/boss name ("Cinderfall Rift (volcanic, collapsing
    // bridge)", "The Hollow Empress") rendered at a fixed 16px overflowed a
    // narrow computed slot and visibly overlapped the neighboring buttons —
    // wordWrap plus a width-scaled font size keeps every name inside its own
    // button regardless of how many options a row now has.
    const labelFontSize = w >= 300 ? 16 : w >= 180 ? 14 : w >= 110 ? 12 : 10;

    // Playtest fix: the box height stayed fixed at 56 regardless of how many
    // lines a name actually wrapped to. With the boss row now at 13 options
    // (down to a ~72px-wide, 10px-font tile), a long name like "The Hollow
    // Empress" wraps to 3 lines and, at 56px tall, spilled past its own box
    // into the locked-hint line below (or the next section, for an unlocked
    // option). Measure every label's REAL wrapped height first and grow every
    // button in the row to fit the tallest one needed. Measured with
    // `createOrnateButton`'s own "tab" variant style (normal weight, EB
    // Garamond) so the estimate matches what's actually drawn.
    const measured = options.map((option) => {
      const probe = this.add.text(0, 0, option.name, {
        fontFamily: FONT_BODY,
        fontSize: `${labelFontSize}px`,
        align: "center",
        wordWrap: { width: w - 8 },
      });
      const measuredHeight = probe.height;
      probe.destroy();
      return measuredHeight;
    });
    const h = Math.max(baseH, Math.max(...measured) + 16);

    return options.map((option, i) => {
      const x = startX + i * (w + gap);
      const locked = !this.isUnlocked(option);
      const handle = createOrnateButton(this, x, y, w, h, option.name, () => onSelect(option.id), {
        variant: "tab",
        fontSize: labelFontSize,
        disabled: locked,
      });

      // `createOrnateButton` only auto-shrinks a single line to fit its
      // width; on a crowded row (the boss row runs to 13 options) that would
      // crush a long name like "The Hollow Empress" down to an unreadably
      // tiny font that STILL overflows. Reach into the button's own label
      // Text (added as the container's 2nd child, right after its
      // background Graphics — see `createOrnateButton`) to reapply this
      // row's computed font size and real word-wrap, the same
      // "measure, don't guess" technique this row used before the reskin.
      const label = handle.container.list[1] as Phaser.GameObjects.Text;
      label.setFontSize(labelFontSize);
      label.setWordWrapWidth(w - 8, true);

      let hint: Phaser.GameObjects.Text | undefined;
      if (locked) {
        hint = this.add
          .text(x, y + h / 2 + 14, this.unlockHintFor(option), {
            fontFamily: FONT_BODY,
            fontSize: "12px",
            color: "#a06a4a",
            align: "center",
            wordWrap: { width: w },
          })
          .setOrigin(0.5);
      }
      return { handle, hint, option, locked };
    });
  }

  private buildMapSection(width: number, labelY: number): void {
    createSectionLabel(this, width / 2, labelY, "Map");
    this.mapButtons = this.buildOptionRow(width, labelY + 40, MAP_OPTIONS, (id) => {
      this.selectedMapId = id;
      this.refreshAll();
    });
  }

  private buildBossSection(width: number, labelY: number): void {
    createSectionLabel(this, width / 2, labelY, "Finale Boss");
    this.bossButtons = this.buildOptionRow(width, labelY + 40, BOSS_OPTIONS, (id) => {
      this.selectedBossId = id;
      this.refreshAll();
    });
  }

  private buildWaveCountSection(width: number, labelY: number): void {
    createSectionLabel(this, width / 2, labelY, "Wave Count");

    const w = 300;
    const h = 44;
    const gap = 20;
    const totalWidth = WAVE_COUNT_PRESETS.length * w + (WAVE_COUNT_PRESETS.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + w / 2;
    const y = labelY + 40;

    this.waveCountButtons = WAVE_COUNT_PRESETS.map((preset, i) => {
      const x = startX + i * (w + gap);
      const handle = createOrnateButton(
        this,
        x,
        y,
        w,
        h,
        preset.label,
        () => {
          this.selectedWaveCount = preset.count;
          this.refreshAll();
        },
        { variant: "tab", fontSize: 16 },
      );
      return { handle, count: preset.count };
    });
  }

  private buildMinionSection(width: number, labelY: number): void {
    createSectionLabel(this, width / 2, labelY, "Minion Source");

    const options: { source: MinionSource; text: string }[] = [
      { source: "standard", text: "Standard (7 minions)" },
      { source: "expanded", text: "Expanded (9 minions, adds Hexer/Ravager)" },
    ];
    const w = 340;
    const h = 44;
    const gap = 30;
    const totalWidth = options.length * w + (options.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + w / 2;
    const y = labelY + 40;

    this.minionButtons = options.map((opt, i) => {
      const x = startX + i * (w + gap);
      const handle = createOrnateButton(
        this,
        x,
        y,
        w,
        h,
        opt.text,
        () => {
          this.selectedMinionSource = opt.source;
          this.refreshAll();
        },
        { variant: "tab", fontSize: 14 },
      );
      return { handle, source: opt.source };
    });
  }

  private buildDifficultySection(width: number, labelY: number): void {
    createSectionLabel(this, width / 2, labelY, "Difficulty");

    const y = labelY + 40;
    this.difficultyButton = createOrnateButton(
      this,
      width / 2,
      y,
      280,
      40,
      "",
      () => {
        openChoiceList(
          this,
          this.choiceOverlay,
          "Choose Difficulty",
          DIFFICULTY_IDS.map((id) => ({
            label: getDifficultyDefinition(id).name,
            desc: difficultyChoiceDescription(id),
            highlighted: id === this.selectedDifficultyId,
            onPick: () => (this.selectedDifficultyId = id),
          })),
          () => this.refreshAll(),
        );
      },
      { variant: "secondary", fontSize: 16 },
    );
  }

  private buildStartButton(width: number, y: number): void {
    // Party Creation Overhaul Plan 8's precedent (see
    // `CharacterCreationScene.buildStartButton`): `OrnateButtonHandle` has no
    // direct green-fill equivalent for "ready to click" — the "primary"
    // variant's own larger/brighter styling carries that read instead of a
    // custom fill color.
    createOrnateButton(this, width / 2, y, 260, 54, "Start", () => this.startFreePlay(), {
      variant: "primary",
    });
  }

  private startFreePlay(): void {
    const minionPool = this.selectedMinionSource === "expanded" ? EXPANDED_MINIONS : STANDARD_MINIONS;
    const waves = generateFreePlayWaves({
      waveCount: this.selectedWaveCount,
      minionPool,
      bossEnemyId: this.selectedBossId,
    });
    this.scene.start("CharacterCreationScene", {
      freePlayMapId: this.selectedMapId,
      freePlayWaves: waves,
      difficultyId: this.selectedDifficultyId,
    });
  }

  /** Re-render every button's selected/locked highlight after any pick changes. */
  private refreshAll(): void {
    this.refreshOptionRow(this.mapButtons, this.selectedMapId);
    this.refreshOptionRow(this.bossButtons, this.selectedBossId);

    for (const btn of this.waveCountButtons) {
      btn.handle.setSelected(btn.count === this.selectedWaveCount);
    }

    for (const btn of this.minionButtons) {
      btn.handle.setSelected(btn.source === this.selectedMinionSource);
    }

    this.difficultyButton.setLabel(`Difficulty: ${getDifficultyDefinition(this.selectedDifficultyId).name}`);
  }

  private refreshOptionRow(buttons: OptionButton[], selectedId: string): void {
    for (const btn of buttons) {
      if (btn.locked) continue; // stays disabled/dimmed via createOrnateButton, never selectable
      btn.handle.setSelected(btn.option.id === selectedId);
    }
  }
}
