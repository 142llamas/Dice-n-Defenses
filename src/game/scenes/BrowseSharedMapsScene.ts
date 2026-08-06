import Phaser from "phaser";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { GAME_WIDTH } from "../config";
import { DIFFICULTY_IDS, getDifficultyDefinition, type DifficultyId } from "../data/difficulty";
import { generateFreePlayWaves } from "../systems/FreePlayWaveGenerator";
import { fromSharedMapRecord, type SharedMapRecord } from "../systems/MapSharingSystem";
import { listSharedMaps } from "../cloud/MapSharingSync";
import { firebaseReady } from "../cloud/firebaseApp";

/**
 * BrowseSharedMapsScene — Phase 11.10 (D-085): browse and play maps other
 * players have published (see `MapBuilderScene`'s Publish button and
 * `firestore.rules`' public-read `sharedMaps` collection).
 *
 * Modeled on `FreePlayScene`: the same wave-count/minion-source/difficulty
 * picker sections (duplicated here rather than shared, matching this
 * project's existing per-scene-duplication style), but the "what to play"
 * picker is a paginated, fetched list of `SharedMapRecord`s instead of a
 * fixed `GatedOption[]` — nothing here is lock-gated, everything published
 * is playable by anyone.
 *
 * Only reachable from `MainMenuScene` when `firebaseReady` (nothing to
 * browse otherwise) — the `!firebaseReady` branch below is a defensive
 * fallback, not the expected way in.
 */

const PAGE_SIZE = 10;

const WAVE_COUNT_PRESETS: { label: string; count: number }[] = [
  { label: "Short (4)", count: 4 },
  { label: "Medium (7)", count: 7 },
  { label: "Long (10)", count: 10 },
];

/** The 7 pre-11.6 minions ("Standard") — same list as FreePlayScene's. */
const STANDARD_MINIONS: string[] = ["grunt", "runner", "wisp", "brute", "swarmling", "warden", "razorwing"];
/** Standard plus the two 11.6 additions ("Expanded") — same list as FreePlayScene's. */
const EXPANDED_MINIONS: string[] = [...STANDARD_MINIONS, "hexer", "ravager"];
/** No community map can name a finale boss of its own yet — every browsed map uses this baseline boss, same as FreePlayScene's always-unlocked one. */
const BROWSE_BOSS_ID = "basalt-colossus";

type MinionSource = "standard" | "expanded";

interface MapRow {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
  record: SharedMapRecord;
}

export class BrowseSharedMapsScene extends Phaser.Scene {
  private maps: SharedMapRecord[] = [];
  private lastDoc: QueryDocumentSnapshot | null = null;
  private hasMore = true;
  private loading = false;
  private selectedMapId: string | null = null;

  private mapRows: MapRow[] = [];
  private loadMoreButton!: Phaser.GameObjects.Rectangle;
  private loadMoreLabel!: Phaser.GameObjects.Text;
  private emptyLabel!: Phaser.GameObjects.Text;

  private waveCountButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; count: number }[] = [];
  private minionButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; source: MinionSource }[] = [];
  private difficultyLabel!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Rectangle;

  private selectedWaveCount = 7;
  private selectedMinionSource: MinionSource = "standard";
  private selectedDifficultyId: DifficultyId = "normal";

  constructor() {
    super("BrowseSharedMapsScene");
  }

  create(): void {
    this.maps = [];
    this.lastDoc = null;
    this.hasMore = true;
    this.loading = false;
    this.selectedMapId = null;
    this.mapRows = [];
    this.waveCountButtons = [];
    this.minionButtons = [];
    this.selectedWaveCount = 7;
    this.selectedMinionSource = "standard";
    this.selectedDifficultyId = "normal";

    this.cameras.main.setBackgroundColor("#0e0e14");

    this.add
      .text(GAME_WIDTH / 2, 40, "Browse Shared Maps", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.buildSmallButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });

    if (!firebaseReady) {
      this.add
        .text(GAME_WIDTH / 2, 200, "Shared maps need a configured Firebase project.", {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "16px",
          color: "#e0a860",
        })
        .setOrigin(0.5);
      return;
    }

    this.emptyLabel = this.add
      .text(GAME_WIDTH / 2, 200, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#8a8aa0" })
      .setOrigin(0.5);

    this.buildWaveCountSection(430);
    this.buildMinionSection(520);
    this.buildDifficultySection(610);
    this.buildStartButton(690);

    this.loadMoreButton = this.add
      .rectangle(GAME_WIDTH / 2, 380, 200, 36, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.loadMoreLabel = this.add
      .text(GAME_WIDTH / 2, 380, "Load more", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#e8e8f0" })
      .setOrigin(0.5);
    this.loadMoreButton.on("pointerdown", () => this.loadPage());
    this.loadMoreButton.setVisible(false);
    this.loadMoreLabel.setVisible(false);

    this.refreshBottomSections();
    this.loadPage();
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  /** Small button+label pair, matching this project's simple rectangle-button style. */
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

  private loadPage(): void {
    if (this.loading || !this.hasMore) return;
    this.loading = true;
    this.loadMoreLabel.setText("Loading…");
    listSharedMaps(PAGE_SIZE, this.lastDoc ?? undefined)
      .then((page) => {
        this.maps = [...this.maps, ...page.maps];
        this.lastDoc = page.lastDoc;
        this.hasMore = page.maps.length === PAGE_SIZE;
        this.loading = false;
        this.renderMapList();
      })
      .catch((err) => {
        console.error("Failed to load shared maps:", err);
        this.loading = false;
        this.loadMoreLabel.setText("Load more");
      });
  }

  private renderMapList(): void {
    this.mapRows.forEach((r) => {
      r.rect.destroy();
      r.label.destroy();
      r.meta.destroy();
    });
    this.mapRows = [];

    this.emptyLabel.setText(this.maps.length === 0 ? "No maps have been published yet — be the first!" : "");

    const top = 150;
    const rowHeight = 44;
    const w = 900;
    this.maps.forEach((record, i) => {
      const y = top + i * rowHeight;
      const rect = this.add
        .rectangle(GAME_WIDTH / 2, y, w, rowHeight - 6, 0x2a2a3a)
        .setStrokeStyle(1, 0x4a4a5a)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(GAME_WIDTH / 2 - w / 2 + 16, y, record.name, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "16px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      const updated = new Date(record.updatedAt).toLocaleDateString();
      const meta = this.add
        .text(GAME_WIDTH / 2 + w / 2 - 16, y, `by ${record.authorDisplayName ?? "Anonymous"} · updated ${updated}`, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#8a8aa0",
        })
        .setOrigin(1, 0.5);
      rect.on("pointerdown", () => {
        this.selectedMapId = record.id;
        this.refreshMapHighlight();
      });
      this.mapRows.push({ rect, label, meta, record });
    });

    const loadMoreY = top + this.maps.length * rowHeight + 20;
    this.loadMoreButton.setPosition(GAME_WIDTH / 2, loadMoreY);
    this.loadMoreLabel.setPosition(GAME_WIDTH / 2, loadMoreY);
    this.loadMoreButton.setVisible(this.hasMore);
    this.loadMoreLabel.setVisible(this.hasMore);
    this.loadMoreLabel.setText("Load more");

    this.refreshMapHighlight();
  }

  private refreshMapHighlight(): void {
    this.mapRows.forEach((row) => {
      const selected = row.record.id === this.selectedMapId;
      row.rect.setFillStyle(selected ? 0x3a5a3a : 0x2a2a3a);
      row.rect.setStrokeStyle(1, selected ? 0x6aab7a : 0x4a4a5a);
    });
    this.refreshBottomSections();
  }

  private buildWaveCountSection(labelY: number): void {
    this.add
      .text(GAME_WIDTH / 2, labelY, "Wave Count", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#c8c8d8", fontStyle: "bold" })
      .setOrigin(0.5);

    const w = 300;
    const h = 44;
    const gap = 20;
    const totalWidth = WAVE_COUNT_PRESETS.length * w + (WAVE_COUNT_PRESETS.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + w / 2;
    const y = labelY + 40;

    this.waveCountButtons = WAVE_COUNT_PRESETS.map((preset, i) => {
      const x = startX + i * (w + gap);
      const { rect, label } = this.buildSmallButton(x, y, w, h, preset.label, 0x2a2a3a, () => {
        this.selectedWaveCount = preset.count;
        this.refreshBottomSections();
      });
      return { rect, label, count: preset.count };
    });
  }

  private buildMinionSection(labelY: number): void {
    this.add
      .text(GAME_WIDTH / 2, labelY, "Minion Source", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#c8c8d8", fontStyle: "bold" })
      .setOrigin(0.5);

    const options: { source: MinionSource; text: string }[] = [
      { source: "standard", text: "Standard (7 minions)" },
      { source: "expanded", text: "Expanded (9 minions, adds Hexer/Ravager)" },
    ];
    const w = 340;
    const h = 44;
    const gap = 30;
    const totalWidth = options.length * w + (options.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + w / 2;
    const y = labelY + 40;

    this.minionButtons = options.map((opt, i) => {
      const x = startX + i * (w + gap);
      const { rect, label } = this.buildSmallButton(x, y, w, h, opt.text, 0x2a2a3a, () => {
        this.selectedMinionSource = opt.source;
        this.refreshBottomSections();
      });
      return { rect, label, source: opt.source };
    });
  }

  private buildDifficultySection(labelY: number): void {
    this.add
      .text(GAME_WIDTH / 2, labelY, "Difficulty", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#c8c8d8", fontStyle: "bold" })
      .setOrigin(0.5);

    const y = labelY + 40;
    this.difficultyLabel = this.buildSmallButton(GAME_WIDTH / 2, y, 280, 40, "", 0x2a2a3a, () => {
      const next = (DIFFICULTY_IDS.indexOf(this.selectedDifficultyId) + 1) % DIFFICULTY_IDS.length;
      this.selectedDifficultyId = DIFFICULTY_IDS[next];
      this.refreshBottomSections();
    }).label;
  }

  private buildStartButton(y: number): void {
    this.startButton = this.add
      .rectangle(GAME_WIDTH / 2, y, 260, 54, 0x4caf72)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME_WIDTH / 2, y, "Start", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "20px", color: "#0e0e14", fontStyle: "bold" })
      .setOrigin(0.5);
    this.startButton.on("pointerdown", () => this.startWithSelectedMap());
  }

  private startWithSelectedMap(): void {
    const record = this.maps.find((m) => m.id === this.selectedMapId);
    if (!record) return;
    const minionPool = this.selectedMinionSource === "expanded" ? EXPANDED_MINIONS : STANDARD_MINIONS;
    const waves = generateFreePlayWaves({ waveCount: this.selectedWaveCount, minionPool, bossEnemyId: BROWSE_BOSS_ID });
    this.scene.start("CharacterCreationScene", {
      customMapData: fromSharedMapRecord(record),
      freePlayWaves: waves,
      difficultyId: this.selectedDifficultyId,
    });
  }

  /** Re-render every button's selected highlight, and gate Start on a map actually being selected. */
  private refreshBottomSections(): void {
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
    this.difficultyLabel?.setText(`Difficulty: ${getDifficultyDefinition(this.selectedDifficultyId).name}`);

    const canStart = this.selectedMapId !== null;
    this.startButton?.setFillStyle(canStart ? 0x4caf72 : 0x4a4a4a);
    if (canStart) this.startButton?.setInteractive({ useHandCursor: true });
    else this.startButton?.disableInteractive();
  }
}
