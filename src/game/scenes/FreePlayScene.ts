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
import { DIFFICULTY_IDS, getDifficultyDefinition, type DifficultyId } from "../data/difficulty";
import { generateFreePlayWaves } from "../systems/FreePlayWaveGenerator";
import { getViewport, onViewportResize } from "./uiTheme";

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
 * Unlock model (D-071, this sub-phase): `TEST_MAP`/`basalt-colossus` are
 * always available. `EMBERFORD_MAP`/`cinderlord` unlock once the "Emberford
 * Reach" campaign is completed; `SALTMERE_MAP`/`tidelord` unlock once
 * "Saltmere Shallows" is completed. Locked options stay visible but
 * disabled, with a short "Complete X to unlock" hint — same spirit as
 * BestiaryScene's "seen vs. unseen" gating, just reusing
 * `CampaignProgressSystem` (already built in 11.8) instead of a new store.
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
  // Phase 23 (D-114): four new maps, none with a campaign of their own yet —
  // always unlocked, same staging every prior boss/enemy got before it had one.
  { id: CAUSEWAY_MAP.id, name: CAUSEWAY_MAP.name, unlockCampaignId: null },
  { id: DROWNING_VALE_MAP.id, name: DROWNING_VALE_MAP.name, unlockCampaignId: null },
  { id: CINDERFALL_RIFT_MAP.id, name: CINDERFALL_RIFT_MAP.name, unlockCampaignId: null },
  { id: FROSTBOUND_HOLLOW_MAP.id, name: FROSTBOUND_HOLLOW_MAP.name, unlockCampaignId: null },
];

const BOSS_OPTIONS: GatedOption[] = [
  { id: "basalt-colossus", name: getEnemyDefinition("basalt-colossus").name, unlockCampaignId: null },
  { id: "cinderlord", name: getEnemyDefinition("cinderlord").name, unlockCampaignId: "emberford-reach" },
  { id: "tidelord", name: getEnemyDefinition("tidelord").name, unlockCampaignId: "saltmere-shallows" },
  // Phase 13.10 (D-095): Gravemaw/Blightmother have no campaign of their own
  // yet (same staging Cinderlord/Tidelord had before Phase 11.8), so both
  // stay always-unlocked here — the alternative would be dead scaffolding:
  // data that exists but is unreachable in any actual mode.
  { id: "gravemaw", name: getEnemyDefinition("gravemaw").name, unlockCampaignId: null },
  { id: "blightmother", name: getEnemyDefinition("blightmother").name, unlockCampaignId: null },
  // Phase 20 (D-111): the new miniboss/boss/legendary tier, same
  // always-unlocked treatment — none of these has a campaign of its own
  // yet either, so leaving them out would be dead scaffolding.
  { id: "juggernaut", name: getEnemyDefinition("juggernaut").name, unlockCampaignId: null },
  { id: "warlord-korrath", name: getEnemyDefinition("warlord-korrath").name, unlockCampaignId: null },
  { id: "the-devourer", name: getEnemyDefinition("the-devourer").name, unlockCampaignId: null },
  { id: "ashen-sovereign", name: getEnemyDefinition("ashen-sovereign").name, unlockCampaignId: null },
  { id: "the-hollow-empress", name: getEnemyDefinition("the-hollow-empress").name, unlockCampaignId: null },
  // Phase 21 (D-112): the new miniboss/boss tier, same always-unlocked
  // treatment — none has a campaign of its own yet.
  { id: "bloodrage-warlord", name: getEnemyDefinition("bloodrage-warlord").name, unlockCampaignId: null },
  { id: "the-husk", name: getEnemyDefinition("the-husk").name, unlockCampaignId: null },
  { id: "sundered-king", name: getEnemyDefinition("sundered-king").name, unlockCampaignId: null },
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
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hint?: Phaser.GameObjects.Text;
  option: GatedOption;
  locked: boolean;
}

export class FreePlayScene extends Phaser.Scene {
  private unlockedCampaigns = new Set<string>();
  private mapButtons: OptionButton[] = [];
  private bossButtons: OptionButton[] = [];
  private waveCountButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; count: number }[] = [];
  private minionButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; source: MinionSource }[] = [];
  private difficultyButton!: Phaser.GameObjects.Rectangle;
  private difficultyLabel!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Rectangle;

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
      ["emberford-reach", "saltmere-shallows"].filter((id) => isCampaignCompleted(progress, id)),
    );

    this.cameras.main.setBackgroundColor("#0e0e14");

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

    this.add
      .text(width / 2, 40, "Free Play", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.buildSmallButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());

    this.add
      .text(
        width / 2,
        90,
        "Mix and match: pick a map, a finale boss, a wave count, a minion pool, and a difficulty, then Start.",
        { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#8a8aa0" },
      )
      .setOrigin(0.5);

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

  /** Small button+label pair, matching CampaignSelectScene/BestiaryScene's simple rectangle-button style. */
  private buildSmallButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    color: number,
    onClick: () => void,
  ): { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const rect = this.add
      .rectangle(x, y, w, h, color)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, text, { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#e8e8f0" })
      .setOrigin(0.5);
    rect.on("pointerdown", onClick);
    return { rect, label };
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
    // button in the row to fit the tallest one needed.
    const measured = options.map((option) => {
      const probe = this.add.text(0, 0, option.name, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: `${labelFontSize}px`,
        fontStyle: "bold",
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
      const rect = this.add.rectangle(x, y, w, h, 0x2a2a3a).setStrokeStyle(1, 0x4a4a5a);
      const label = this.add
        .text(x, y, option.name, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: `${labelFontSize}px`,
          color: "#e8e8f0",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: w - 8 },
        })
        .setOrigin(0.5);
      let hint: Phaser.GameObjects.Text | undefined;
      if (locked) {
        hint = this.add
          .text(x, y + h / 2 + 14, this.unlockHintFor(option), {
            fontFamily: "system-ui, Arial, sans-serif",
            fontSize: "12px",
            color: "#a06a4a",
            align: "center",
            wordWrap: { width: w },
          })
          .setOrigin(0.5);
      }
      if (!locked) {
        rect.setInteractive({ useHandCursor: true });
        rect.on("pointerdown", () => onSelect(option.id));
      }
      return { rect, label, hint, option, locked };
    });
  }

  private buildMapSection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Map", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#c8c8d8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.mapButtons = this.buildOptionRow(width, labelY + 40, MAP_OPTIONS, (id) => {
      this.selectedMapId = id;
      this.refreshAll();
    });
  }

  private buildBossSection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Finale Boss", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#c8c8d8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.bossButtons = this.buildOptionRow(width, labelY + 40, BOSS_OPTIONS, (id) => {
      this.selectedBossId = id;
      this.refreshAll();
    });
  }

  private buildWaveCountSection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Wave Count", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#c8c8d8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const w = 300;
    const h = 44;
    const gap = 20;
    const totalWidth = WAVE_COUNT_PRESETS.length * w + (WAVE_COUNT_PRESETS.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + w / 2;
    const y = labelY + 40;

    this.waveCountButtons = WAVE_COUNT_PRESETS.map((preset, i) => {
      const x = startX + i * (w + gap);
      const rect = this.add
        .rectangle(x, y, w, h, 0x2a2a3a)
        .setStrokeStyle(1, 0x4a4a5a)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, y, preset.label, { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#e8e8f0" })
        .setOrigin(0.5);
      rect.on("pointerdown", () => {
        this.selectedWaveCount = preset.count;
        this.refreshAll();
      });
      return { rect, label, count: preset.count };
    });
  }

  private buildMinionSection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Minion Source", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#c8c8d8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

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
      const rect = this.add
        .rectangle(x, y, w, h, 0x2a2a3a)
        .setStrokeStyle(1, 0x4a4a5a)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, y, opt.text, { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#e8e8f0" })
        .setOrigin(0.5);
      rect.on("pointerdown", () => {
        this.selectedMinionSource = opt.source;
        this.refreshAll();
      });
      return { rect, label, source: opt.source };
    });
  }

  /** Reuses `CharacterCreationScene`'s existing difficulty-picker pattern: one button that cycles the tier. */
  private buildDifficultySection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Difficulty", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#c8c8d8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const y = labelY + 40;
    this.difficultyButton = this.add
      .rectangle(width / 2, y, 280, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.difficultyLabel = this.add
      .text(width / 2, y, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#e8e8f0" })
      .setOrigin(0.5);
    this.difficultyButton.on("pointerover", () => this.difficultyButton.setFillStyle(0x3a3a4a));
    this.difficultyButton.on("pointerout", () => this.difficultyButton.setFillStyle(0x2a2a3a));
    this.difficultyButton.on("pointerdown", () => {
      const next = (DIFFICULTY_IDS.indexOf(this.selectedDifficultyId) + 1) % DIFFICULTY_IDS.length;
      this.selectedDifficultyId = DIFFICULTY_IDS[next];
      this.refreshAll();
    });
  }

  private buildStartButton(width: number, y: number): void {
    this.startButton = this.add
      .rectangle(width / 2, y, 260, 54, 0x4caf72)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, y, "Start", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "20px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.startButton.on("pointerdown", () => this.startFreePlay());
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
      const selected = btn.count === this.selectedWaveCount;
      btn.rect.setFillStyle(selected ? 0x3a5a3a : 0x2a2a3a);
      btn.rect.setStrokeStyle(1, selected ? 0x6aab7a : 0x4a4a5a);
    }

    for (const btn of this.minionButtons) {
      const selected = btn.source === this.selectedMinionSource;
      btn.rect.setFillStyle(selected ? 0x3a5a3a : 0x2a2a3a);
      btn.rect.setStrokeStyle(1, selected ? 0x6aab7a : 0x4a4a5a);
    }

    this.difficultyLabel.setText(`Difficulty: ${getDifficultyDefinition(this.selectedDifficultyId).name}`);
  }

  private refreshOptionRow(buttons: OptionButton[], selectedId: string): void {
    for (const btn of buttons) {
      if (btn.locked) {
        btn.rect.setFillStyle(0x1a1a26);
        btn.rect.setStrokeStyle(1, 0x2a2a3a);
        btn.rect.setAlpha(0.55);
        btn.label.setAlpha(0.55);
        continue;
      }
      const selected = btn.option.id === selectedId;
      btn.rect.setFillStyle(selected ? 0x3a5a3a : 0x2a2a3a);
      btn.rect.setStrokeStyle(1, selected ? 0x6aab7a : 0x4a4a5a);
      btn.rect.setAlpha(1);
      btn.label.setAlpha(1);
    }
  }
}
