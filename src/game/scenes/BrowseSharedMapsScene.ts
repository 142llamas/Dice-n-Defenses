import Phaser from "phaser";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { DIFFICULTY_IDS, getDifficultyDefinition, type DifficultyId } from "../data/difficulty";
import { generateFreePlayWaves } from "../systems/FreePlayWaveGenerator";
import { fromSharedMapRecord, type SharedMapRecord } from "../systems/MapSharingSystem";
import { listSharedMaps } from "../cloud/MapSharingSync";
import { firebaseReady } from "../cloud/firebaseApp";
import { getViewport, onViewportResize } from "./uiTheme";

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
  // Playtest fix: the list used to render ONE ROW PER FETCHED MAP, uncapped,
  // stacking straight into the fixed Wave Count/Minion/Difficulty/Start
  // sections below once more than ~6 maps were published — a real, growing
  // problem as more maps get shared, not a one-off. A fixed local page size
  // (`mapsPerPage`) keeps the rendered list's height constant regardless of
  // how many maps exist; "Next" past the last locally-held page transparently
  // fetches another remote page first.
  private readonly mapsPerPage = 5;
  private mapListPage = 0;
  private prevPageButton!: Phaser.GameObjects.Rectangle;
  private prevPageLabel!: Phaser.GameObjects.Text;
  private nextPageButton!: Phaser.GameObjects.Rectangle;
  private nextPageLabel!: Phaser.GameObjects.Text;
  private pageInfoLabel!: Phaser.GameObjects.Text;
  private emptyLabel!: Phaser.GameObjects.Text;

  private waveCountButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; count: number }[] = [];
  private minionButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; source: MinionSource }[] = [];
  private difficultyLabel!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Rectangle;

  private selectedWaveCount = 7;
  private selectedMinionSource: MinionSource = "standard";
  private selectedDifficultyId: DifficultyId = "normal";
  private layoutRoot?: Phaser.GameObjects.Container;
  // D-154: guards `rebuildLayout` from rendering a premature "no maps
  // published" message on the very first frame, before the initial
  // `loadPage()` fetch has resolved — flips true once it (or its error
  // handler) resolves at least once.
  private hasLoadedOnce = false;

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
    this.mapListPage = 0;
    this.hasLoadedOnce = false;
    this.selectedWaveCount = 7;
    this.selectedMinionSource = "standard";
    this.selectedDifficultyId = "normal";

    this.cameras.main.setBackgroundColor("#0e0e14");

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());

    // Fetched exactly once per scene lifetime, NOT from `rebuildLayout` — a
    // resize must re-render the already-loaded `this.maps` state, never
    // re-hit the network (see D-154's `LoadGameScene`/`MainMenuScene`
    // precedent for "subscribe/fetch once in create(), refresh display on
    // every rebuild").
    if (firebaseReady) this.loadPage();
  }

  // D-154: rebuilds the chrome (title/Back/sections/pagination controls)
  // against the current viewport, then re-renders the map list from
  // whatever's already in `this.maps` (no network call here).
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    this.waveCountButtons = [];
    this.minionButtons = [];
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    const { width } = getViewport(this);

    this.add
      .text(width / 2, 40, "Browse Shared Maps", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.buildSmallButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());

    if (!firebaseReady) {
      this.add
        .text(width / 2, 200, "Shared maps need a configured Firebase project.", {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "16px",
          color: "#e0a860",
        })
        .setOrigin(0.5);

      const created = this.children.list.filter((c) => !before.has(c));
      this.layoutRoot = this.add.container(0, 0);
      this.layoutRoot.add(created);
      return;
    }

    this.emptyLabel = this.add
      .text(width / 2, 200, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#8a8aa0" })
      .setOrigin(0.5);

    this.buildWaveCountSection(width, 430);
    this.buildMinionSection(width, 520);
    this.buildDifficultySection(width, 610);
    this.buildStartButton(width, 690);

    // Fixed position, independent of how many maps have loaded — see the
    // `mapsPerPage` comment on the field declarations.
    const navY = 150 + this.mapsPerPage * 44 + 20;
    const prev = this.buildSmallButton(width / 2 - 130, navY, 130, 36, "◀ Prev", 0x2a2a3a, () => {
      if (this.mapListPage > 0) {
        this.mapListPage--;
        this.renderMapList();
      }
    });
    this.prevPageButton = prev.rect;
    this.prevPageLabel = prev.label;
    this.pageInfoLabel = this.add
      .text(width / 2, navY, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "13px", color: "#c8c8d8" })
      .setOrigin(0.5);
    const next = this.buildSmallButton(width / 2 + 130, navY, 130, 36, "Next ▶", 0x2a2a3a, () => {
      const totalPages = Math.max(1, Math.ceil(this.maps.length / this.mapsPerPage));
      if (this.mapListPage + 1 < totalPages) {
        this.mapListPage++;
        this.renderMapList();
      } else if (this.hasMore) {
        this.mapListPage++;
        this.loadPage();
      }
    });
    this.nextPageButton = next.rect;
    this.nextPageLabel = next.label;
    this.prevPageButton.setVisible(false);
    this.prevPageLabel.setVisible(false);
    this.nextPageButton.setVisible(false);
    this.nextPageLabel.setVisible(false);

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);

    this.refreshBottomSections();
    // Only re-render the map list if a fetch has actually resolved at least
    // once — on the very first `create()` call this runs BEFORE `loadPage()`
    // fires, and rendering now would flash a false "no maps published" line.
    if (this.hasLoadedOnce) this.renderMapList();
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
    this.nextPageLabel.setText("Loading…");
    listSharedMaps(PAGE_SIZE, this.lastDoc ?? undefined)
      .then((page) => {
        this.maps = [...this.maps, ...page.maps];
        this.lastDoc = page.lastDoc;
        this.hasMore = page.maps.length === PAGE_SIZE;
        this.loading = false;
        this.hasLoadedOnce = true;
        this.renderMapList();
      })
      .catch((err) => {
        console.error("Failed to load shared maps:", err);
        this.loading = false;
        this.hasLoadedOnce = true;
        this.mapListPage = Math.max(0, this.mapListPage - 1);
        this.renderMapList();
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

    const { width } = getViewport(this);
    const top = 150;
    const rowHeight = 44;
    const w = 900;
    const totalPages = Math.max(1, Math.ceil(this.maps.length / this.mapsPerPage));
    this.mapListPage = Math.min(this.mapListPage, totalPages - 1);
    const pageStart = this.mapListPage * this.mapsPerPage;
    const pageMaps = this.maps.slice(pageStart, pageStart + this.mapsPerPage);

    pageMaps.forEach((record, i) => {
      const y = top + i * rowHeight;
      const rect = this.add
        .rectangle(width / 2, y, w, rowHeight - 6, 0x2a2a3a)
        .setStrokeStyle(1, 0x4a4a5a)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(width / 2 - w / 2 + 16, y, record.name, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "16px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      const updated = new Date(record.updatedAt).toLocaleDateString();
      const meta = this.add
        .text(width / 2 + w / 2 - 16, y, `by ${record.authorDisplayName ?? "Anonymous"} · updated ${updated}`, {
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

    const showNav = this.maps.length > 0;
    this.prevPageButton.setVisible(showNav);
    this.prevPageLabel.setVisible(showNav);
    this.nextPageButton.setVisible(showNav);
    this.nextPageLabel.setVisible(showNav);
    if (showNav) {
      this.pageInfoLabel.setText(`Page ${this.mapListPage + 1}/${totalPages}${this.hasMore ? "+" : ""}`);
      this.nextPageLabel.setText(this.loading ? "Loading…" : "Next ▶");
      const canGoNext = this.mapListPage + 1 < totalPages || this.hasMore;
      this.nextPageButton.setFillStyle(canGoNext ? 0x2a2a3a : 0x1c1c26);
      this.prevPageButton.setFillStyle(this.mapListPage > 0 ? 0x2a2a3a : 0x1c1c26);
    }

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

  private buildWaveCountSection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Wave Count", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#c8c8d8", fontStyle: "bold" })
      .setOrigin(0.5);

    const w = 300;
    const h = 44;
    const gap = 20;
    const totalWidth = WAVE_COUNT_PRESETS.length * w + (WAVE_COUNT_PRESETS.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + w / 2;
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

  private buildMinionSection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Minion Source", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#c8c8d8", fontStyle: "bold" })
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
      const { rect, label } = this.buildSmallButton(x, y, w, h, opt.text, 0x2a2a3a, () => {
        this.selectedMinionSource = opt.source;
        this.refreshBottomSections();
      });
      return { rect, label, source: opt.source };
    });
  }

  private buildDifficultySection(width: number, labelY: number): void {
    this.add
      .text(width / 2, labelY, "Difficulty", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "16px", color: "#c8c8d8", fontStyle: "bold" })
      .setOrigin(0.5);

    const y = labelY + 40;
    this.difficultyLabel = this.buildSmallButton(width / 2, y, 280, 40, "", 0x2a2a3a, () => {
      const next = (DIFFICULTY_IDS.indexOf(this.selectedDifficultyId) + 1) % DIFFICULTY_IDS.length;
      this.selectedDifficultyId = DIFFICULTY_IDS[next];
      this.refreshBottomSections();
    }).label;
  }

  private buildStartButton(width: number, y: number): void {
    this.startButton = this.add
      .rectangle(width / 2, y, 260, 54, 0x4caf72)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, y, "Start", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "20px", color: "#0e0e14", fontStyle: "bold" })
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
