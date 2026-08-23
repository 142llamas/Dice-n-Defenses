import Phaser from "phaser";
import { TEST_MAP } from "../data/testMap";
import { generateFreePlayWaves } from "../systems/FreePlayWaveGenerator";
import { MAP_OPTIONS, EXPANDED_MINIONS } from "./FreePlayScene";
import { getViewport, onViewportResize } from "./uiTheme";

/**
 * TestModeScene — D-138: the entry point for Test Mode, KI-085's last
 * remaining large feature request. Deliberately minimal, unlike
 * `FreePlayScene`: nothing here is gated (every map is available regardless
 * of campaign progress) and there's no boss/minion/difficulty picker — Test
 * Mode's own live in-battle debug spawner (`BattleScene`) lets a tester put
 * ANY enemy on the board on demand, so a curated pre-battle composition
 * doesn't matter here the way it does for a real Free Play run. Just a map
 * and a wave count, then straight to `CharacterCreationScene` (which already
 * has Starting Level/Team Level, D-129 — that alone covers "playable at any
 * level") with `testMode: true`.
 */

const WAVE_COUNT_PRESETS: { label: string; count: number }[] = [
  { label: "Short (4)", count: 4 },
  { label: "Medium (7)", count: 7 },
  { label: "Long (10)", count: 10 },
];

/** Test Mode always uses the full/expanded roster and a fixed always-unlocked boss — the live spawner covers everything else. */
const TEST_MODE_BOSS_ID = "basalt-colossus";

export class TestModeScene extends Phaser.Scene {
  private mapButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; id: string }[] = [];
  private waveCountButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; count: number }[] = [];
  private startButton!: Phaser.GameObjects.Rectangle;

  private selectedMapId = TEST_MAP.id;
  private selectedWaveCount = 7;
  private layoutRoot?: Phaser.GameObjects.Container;

  constructor() {
    super("TestModeScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0e0e14");
    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds this scene's whole layout against the current viewport
  // (snapshot-diff into a fresh container, same convention `MainMenuScene`
  // established); also re-runs `refreshAll()` since the map/wave-count
  // button arrays get recreated fresh each time.
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    const { width } = getViewport(this);

    this.add
      .text(width / 2, 40, "Test Mode", {
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
        "A battle unlocked for balance testing: pick a map and wave count, then set party\n" +
          "Starting Level in Character Creation. In battle, use the Debug toolbar to skip\n" +
          "waves, disable the loss condition, spawn any enemy, paint any terrain, or toggle\n" +
          "any status effect on demand.",
        {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "14px",
          color: "#8a8aa0",
          align: "center",
        },
      )
      .setOrigin(0.5);

    this.buildMapSection(width, 180);
    this.buildWaveCountSection(width, 340);
    this.buildStartButton(width, 440);

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);

    this.refreshAll();
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  /** Small button+label pair, matching FreePlayScene/CampaignSelectScene's simple rectangle-button style. */
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

  /** Every map, unconditionally selectable — Test Mode has no unlock gating. */
  private buildMapSection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Map", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#c8c8d8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const y = labelY + 40;
    const gap = 16;
    const w = Math.min(280, (width - 100 - (MAP_OPTIONS.length - 1) * gap) / MAP_OPTIONS.length);
    const h = 48;
    const totalWidth = MAP_OPTIONS.length * w + (MAP_OPTIONS.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + w / 2;
    const fontSize = w >= 200 ? 14 : 11;

    this.mapButtons = MAP_OPTIONS.map((option, i) => {
      const x = startX + i * (w + gap);
      const rect = this.add
        .rectangle(x, y, w, h, 0x2a2a3a)
        .setStrokeStyle(1, 0x4a4a5a)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, y, option.name, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: `${fontSize}px`,
          color: "#e8e8f0",
          align: "center",
          wordWrap: { width: w - 8 },
        })
        .setOrigin(0.5);
      rect.on("pointerdown", () => {
        this.selectedMapId = option.id;
        this.refreshAll();
      });
      return { rect, label, id: option.id };
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

  private buildStartButton(width: number, y: number): void {
    this.startButton = this.add
      .rectangle(width / 2, y, 260, 54, 0x4caf72)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, y, "Start Test Battle", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.startButton.on("pointerdown", () => this.startTestMode());
  }

  private startTestMode(): void {
    const waves = generateFreePlayWaves({
      waveCount: this.selectedWaveCount,
      minionPool: EXPANDED_MINIONS,
      bossEnemyId: TEST_MODE_BOSS_ID,
    });
    this.scene.start("CharacterCreationScene", {
      freePlayMapId: this.selectedMapId,
      freePlayWaves: waves,
      difficultyId: "normal",
      testMode: true,
    });
  }

  private refreshAll(): void {
    for (const btn of this.mapButtons) {
      const selected = btn.id === this.selectedMapId;
      btn.rect.setFillStyle(selected ? 0x3a5a3a : 0x2a2a3a);
      btn.rect.setStrokeStyle(1, selected ? 0x6aab7a : 0x4a4a5a);
    }
    for (const btn of this.waveCountButtons) {
      const selected = btn.count === this.selectedWaveCount;
      btn.rect.setFillStyle(selected ? 0x3a5a3a : 0x2a2a3a);
      btn.rect.setStrokeStyle(1, selected ? 0x6aab7a : 0x4a4a5a);
    }
  }
}
