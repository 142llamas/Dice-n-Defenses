import Phaser from "phaser";
import { COLORS } from "../config";
import { centeredRowX, getViewport, onViewportResize, openChoiceList } from "./uiTheme";
import { GridSystem, type GridPosition } from "../systems/GridSystem";
import { GameMap, type TileRole } from "../systems/GameMap";
import type { ParsedMap, TileType } from "../data/testMap";
import {
  MIN_MAP_COLS,
  MAX_MAP_COLS,
  MIN_MAP_ROWS,
  MAX_MAP_ROWS,
  createBlankDraft,
  isValidMapName,
  paintTile,
  validateDraft,
  type MarkerRole,
  type PaletteSelection,
} from "../systems/MapBuilderSystem";
import {
  MAX_PUBLISHED_MAPS_PER_AUTHOR,
  hasReachedPublishLimit,
  toSharedMapRecord,
} from "../systems/MapSharingSystem";
import { generateFreePlayWaves } from "../systems/FreePlayWaveGenerator";
import { firebaseReady } from "../cloud/firebaseApp";
import { initAuth, type AuthState } from "../cloud/AuthClient";
import { listMapsByAuthor, pushMap } from "../cloud/MapSharingSync";

/**
 * MapBuilderScene — Phase 11.10 (D-085): paint a custom map by hand, then
 * either Playtest it locally or Publish it for other players to browse
 * (see `BrowseSharedMapsScene`).
 *
 * NOT gated on `firebaseReady` — this project has no free-text input
 * anywhere (every "name" field is a cycle-through-a-preset-pool button, see
 * `CharacterCreationScene`'s name cycler), and painting/validating/
 * Playtesting a map needs no cloud at all. Only the Publish button is
 * affected when no Firebase project is configured — same "local-first
 * fallback" precedent as Phase 10's Account control.
 *
 * The 7 pre-11.6 minions and the always-available finale boss below mirror
 * `FreePlayScene`'s own `STANDARD_MINIONS`/baseline boss id exactly — small,
 * duplicated constants, matching this project's existing style of
 * duplicating tiny per-scene helpers/lists rather than sharing them.
 */

const STANDARD_MINIONS: string[] = ["grunt", "runner", "wisp", "brute", "swarmling", "warden", "razorwing"];
const PLAYTEST_BOSS_ID = "basalt-colossus";

/** D-154: only the STARTING default now — the name field itself is a real typed `<input>`, not a cycle-through-a-pool button. */
const DEFAULT_MAP_NAME = "Winding Pass";

const DEFAULT_COLS = 12;
const DEFAULT_ROWS = 8;

/** Placeholder debug colours for terrain types `config.ts`'s COLORS palette doesn't already cover. */
const TERRAIN_COLORS: Record<TileType, number> = {
  floor: COLORS.tileFloor,
  blocked: COLORS.tileBlocked,
  cliff: 0x4a4a5a,
  water: 0x2a4a6a,
  fire: 0x6a2a2a,
  acid: 0x4a6a2a,
  pit: 0x14141c,
  sand: 0xc2a878,
};

const TERRAIN_PALETTE: { tileType: TileType; label: string }[] = [
  { tileType: "floor", label: "Floor" },
  { tileType: "blocked", label: "Blocked" },
  { tileType: "cliff", label: "Cliff" },
  { tileType: "water", label: "Water" },
  { tileType: "fire", label: "Fire" },
  { tileType: "acid", label: "Acid" },
  { tileType: "pit", label: "Pit" },
  { tileType: "sand", label: "Sand" },
];

const ROLE_COLORS: Record<MarkerRole, number> = {
  spawn: COLORS.spawn,
  exit: COLORS.exit,
  "hero-start": COLORS.hero,
  "enemy-start": COLORS.enemy,
  shop: 0x6a5a2a,
  treasure: COLORS.gold,
};

const ROLE_GLYPHS: Record<MarkerRole, string> = {
  spawn: "S",
  exit: "X",
  "hero-start": "H",
  "enemy-start": "E",
  shop: "$",
  treasure: "T",
};

const MARKER_PALETTE: { role: MarkerRole; label: string }[] = [
  { role: "spawn", label: "Spawn (In)" },
  { role: "exit", label: "Exit (Out)" },
  { role: "hero-start", label: "Hero Start" },
  { role: "enemy-start", label: "Enemy Start" },
  { role: "shop", label: "Shop" },
  { role: "treasure", label: "Treasure" },
];

type PaletteTab = "terrain" | "markers";

// Reserved screen region for the editing grid — everything above is header/
// controls/palette, everything below is validation status + action buttons.
// D-156: the right edge is computed live from the viewport width inside
// `rebuildGridSystem()` instead of a `GAME_WIDTH`-derived constant, so a
// future `Scale.RESIZE` cutover actually grows the buildable area.
const GRID_AREA_TOP = 300;
const GRID_AREA_BOTTOM = 780;
const GRID_AREA_LEFT = 40;

export class MapBuilderScene extends Phaser.Scene {
  private draft!: ParsedMap;
  private paletteTab: PaletteTab = "terrain";
  private selectedPalette: PaletteSelection = { kind: "terrain", tileType: "floor" };
  private builderGrid!: GridSystem;

  private widthLabel!: Phaser.GameObjects.Text;
  private heightLabel!: Phaser.GameObjects.Text;
  /** D-16x: the shared full-screen list-picker overlay (`openChoiceList`), replacing the old click-to-cycle Width/Height buttons. */
  private choiceOverlay: Phaser.GameObjects.GameObject[] = [];

  private tabButtons: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; tab: PaletteTab }[] = [];
  private swatchButtons: Phaser.GameObjects.Rectangle[] = [];
  private swatchLabels: Phaser.GameObjects.Text[] = [];

  private gridGraphics!: Phaser.GameObjects.Graphics;
  private tileObjects: Phaser.GameObjects.GameObject[] = [];

  private validationText!: Phaser.GameObjects.Text;
  private playtestButton!: Phaser.GameObjects.Rectangle;
  private publishButton!: Phaser.GameObjects.Rectangle;
  private publishLabel!: Phaser.GameObjects.Text;
  private publishStatusText!: Phaser.GameObjects.Text;

  private authState: AuthState = { uid: null, isAnonymous: true, displayName: null };
  private publishedMapId: string | null = null;
  private publishedMapCreatedAt = 0;
  private publishedCountForAuthor = 0;

  // D-154: real click-and-drag continuous painting — `isPainting` tracks a
  // held-down stroke, `lastPaintedTile` avoids repainting the same tile on
  // every `pointermove` tick while the pointer sits still within it.
  private isPainting = false;
  private lastPaintedTile: GridPosition | null = null;

  private nameInput?: Phaser.GameObjects.DOMElement;
  private nameInputEl?: HTMLInputElement;

  // D-156: this scene's chrome (title, description, size/name controls,
  // palette tabs, footer) is built ONCE in `create()` and never destroyed —
  // same shape as `CoopLobbyScene` (D-155), and for the same reason: the
  // name field's DOM `<input>` would drop typed text and keyboard focus if
  // rebuilt from scratch on a resize. Each entry repositions to
  // `viewportWidth / 2 + dx` at a fixed `y` instead.
  private centeredObjects: { obj: { setPosition(x: number, y: number): unknown }; dx: number; y: number }[] = [];

  constructor() {
    super("MapBuilderScene");
  }

  create(): void {
    this.draft = createBlankDraft("map-builder-draft", DEFAULT_MAP_NAME, DEFAULT_COLS, DEFAULT_ROWS);
    this.paletteTab = "terrain";
    this.selectedPalette = { kind: "terrain", tileType: "floor" };
    this.tabButtons = [];
    this.swatchButtons = [];
    this.swatchLabels = [];
    this.tileObjects = [];
    this.publishedMapId = null;
    this.publishedMapCreatedAt = 0;
    this.publishedCountForAuthor = 0;
    this.centeredObjects = [];

    this.cameras.main.setBackgroundColor("#0e0e14");
    const cx = getViewport(this).width / 2;

    const title = this.add
      .text(cx, 40, "Map Builder", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.centeredObjects.push({ obj: title, dx: 0, y: 40 });

    this.buildSmallButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());

    const description = this.add
      .text(
        cx,
        86,
        "Pick a size and name, choose a tile from the palette, then click the board to paint. Every map needs at\n" +
          "least one Spawn, one Exit, 1-4 Hero Starts, and a clear path from every Spawn to an Exit.",
        {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "14px",
          color: "#8a8aa0",
          align: "center",
        },
      )
      .setOrigin(0.5, 0);
    this.centeredObjects.push({ obj: description, dx: 0, y: 86 });

    this.buildSizeAndNameControls(cx, 150);
    this.buildPaletteTabs(cx, 210);
    this.gridGraphics = this.add.graphics().setDepth(1);
    this.buildFooter(cx);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    this.input.on("pointerup", () => this.handlePointerUp());
    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.repositionLayout());

    initAuth((state) => {
      this.authState = state;
      this.refreshPublishedCount();
    });

    this.rebuildGridSystem();
    this.renderPaletteSwatches();
    this.renderGrid();
    this.refreshAll();
  }

  // D-156: moves every registered chrome object back to `viewportWidth / 2 +
  // dx` at its own fixed `y` (including the name `<input>`, which keeps its
  // typed value and focus since it's never rebuilt), then re-derives the
  // grid's geometry and repaints the palette swatches and grid tiles — both
  // already fully destroy-and-recreate on every call, so re-running them
  // against the live viewport width is enough to keep them correctly sized/
  // positioned too.
  private repositionLayout(): void {
    const cx = getViewport(this).width / 2;
    for (const { obj, dx, y } of this.centeredObjects) obj.setPosition(cx + dx, y);
    this.validationText.setWordWrapWidth(getViewport(this).width - 160);
    this.rebuildGridSystem();
    this.renderPaletteSwatches();
    this.renderGrid();
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

  // ----- Size + name controls ---------------------------------------------

  private buildSizeAndNameControls(cx: number, y: number): void {
    const w = 260;
    const gap = 20;
    const totalWidth = 3 * w + 2 * gap;
    const dx0 = -totalWidth / 2 + w / 2;
    const startX = cx + dx0;

    this.buildNameField(startX, y, w);
    if (this.nameInput) this.centeredObjects.push({ obj: this.nameInput, dx: dx0, y });

    // Resizing rebuilds a blank draft at the new size — resizing an
    // in-progress draft while preserving existing paint is out of scope for
    // this pass (pick a size, THEN paint).
    const widthBtn = this.buildSmallButton(startX + w + gap, y, w, 40, "", 0x2a2a3a, () => {
      const widths: number[] = [];
      for (let n = MIN_MAP_COLS; n <= MAX_MAP_COLS; n++) widths.push(n);
      openChoiceList(
        this,
        this.choiceOverlay,
        "Choose Map Width",
        widths.map((n) => ({
          label: `${n} tiles`,
          highlighted: n === this.draft.cols,
          onPick: () => {
            this.draft = createBlankDraft(this.draft.id, this.draft.name, n, this.draft.rows);
            this.rebuildGridSystem();
            this.renderGrid();
          },
        })),
        () => this.refreshAll(),
      );
    });
    this.widthLabel = widthBtn.label;
    this.centeredObjects.push({ obj: widthBtn.rect, dx: dx0 + w + gap, y }, { obj: widthBtn.label, dx: dx0 + w + gap, y });

    const heightBtn = this.buildSmallButton(startX + 2 * (w + gap), y, w, 40, "", 0x2a2a3a, () => {
      const heights: number[] = [];
      for (let n = MIN_MAP_ROWS; n <= MAX_MAP_ROWS; n++) heights.push(n);
      openChoiceList(
        this,
        this.choiceOverlay,
        "Choose Map Height",
        heights.map((n) => ({
          label: `${n} tiles`,
          highlighted: n === this.draft.rows,
          onPick: () => {
            this.draft = createBlankDraft(this.draft.id, this.draft.name, this.draft.cols, n);
            this.rebuildGridSystem();
            this.renderGrid();
          },
        })),
        () => this.refreshAll(),
      );
    });
    this.heightLabel = heightBtn.label;
    this.centeredObjects.push(
      { obj: heightBtn.rect, dx: dx0 + 2 * (w + gap), y },
      { obj: heightBtn.label, dx: dx0 + 2 * (w + gap), y },
    );
  }

  /**
   * D-154: a real, player-typed map name — this project's third DOM
   * `<input>`, following the exact pattern `CharacterCreationScene`'s hero
   * name field (D-147) and `CoopLobbyScene`'s join-code field (D-102)
   * already established. Replaces the old fixed 8-name cycle pool.
   */
  private buildNameField(x: number, y: number, width: number): void {
    this.nameInput = this.add
      .dom(x, y)
      .createFromHTML(
        `<input type="text" maxlength="40" placeholder="Map Name" style="
          width: ${width - 20}px; height: 34px; font-size: 15px;
          font-family: system-ui, Arial, sans-serif; font-weight: bold;
          text-align: center; background: #2a2a3a; color: #e8e8f0;
          border: 1px solid #4a4a5a; border-radius: 4px; outline: none;
          box-sizing: border-box;
        " />`,
      )
      .setOrigin(0.5);
    this.nameInputEl = this.nameInput.node.querySelector("input") as HTMLInputElement;
    this.nameInputEl.value = this.draft.name;
    this.nameInputEl.addEventListener("input", () => {
      this.draft = { ...this.draft, name: this.nameInputEl!.value };
      this.refreshValidation();
    });
    this.nameInputEl.addEventListener("keydown", (e: KeyboardEvent) => e.stopPropagation());
  }

  // ----- Palette -----------------------------------------------------------

  private buildPaletteTabs(cx: number, y: number): void {
    const tabs: { tab: PaletteTab; label: string }[] = [
      { tab: "terrain", label: "Terrain" },
      { tab: "markers", label: "Markers" },
    ];
    const w = 180;
    const gap = 10;
    const totalWidth = tabs.length * w + (tabs.length - 1) * gap;
    const dx0 = -totalWidth / 2 + w / 2;
    const startX = cx + dx0;

    this.tabButtons = tabs.map((t, i) => {
      const dx = dx0 + i * (w + gap);
      const x = startX + i * (w + gap);
      const { rect, label } = this.buildSmallButton(x, y, w, 34, t.label, 0x2a2a3a, () => {
        this.paletteTab = t.tab;
        this.renderPaletteSwatches();
      });
      this.centeredObjects.push({ obj: rect, dx, y }, { obj: label, dx, y });
      return { rect, label, tab: t.tab };
    });
  }

  private renderPaletteSwatches(): void {
    this.swatchButtons.forEach((b) => b.destroy());
    this.swatchLabels.forEach((l) => l.destroy());
    this.swatchButtons = [];
    this.swatchLabels = [];

    this.tabButtons.forEach((b) => b.rect.setFillStyle(b.tab === this.paletteTab ? 0x4a6a9a : 0x2a2a3a));

    const y = 255;
    const w = 180;
    const gap = 10;
    const items =
      this.paletteTab === "terrain"
        ? TERRAIN_PALETTE.map((t) => ({ label: t.label, selection: { kind: "terrain" as const, tileType: t.tileType } }))
        : MARKER_PALETTE.map((m) => ({ label: m.label, selection: { kind: "marker" as const, role: m.role } }));
    // Playtest fix: at the fixed 180px width this row (8 terrain swatches)
    // ran off both edges of the 1280px canvas — centeredRowX shrinks item
    // width to fit instead once the palette outgrows the available space.
    const { xs, itemWidth } = centeredRowX(items.length, w, gap, getViewport(this).width / 2, getViewport(this).width - 80);

    items.forEach((item, i) => {
      const { rect, label } = this.buildSmallButton(xs[i], y, itemWidth, 32, item.label, 0x2a2a3a, () => {
        this.selectedPalette = item.selection;
        this.refreshPaletteHighlight();
      });
      this.swatchButtons.push(rect);
      this.swatchLabels.push(label);
    });
    this.refreshPaletteHighlight();
  }

  private refreshPaletteHighlight(): void {
    if (this.paletteTab === "terrain") {
      this.swatchButtons.forEach((btn, i) => {
        const selected = this.selectedPalette.kind === "terrain" && this.selectedPalette.tileType === TERRAIN_PALETTE[i].tileType;
        btn.setFillStyle(selected ? 0x4a6a9a : 0x2a2a3a);
      });
    } else {
      this.swatchButtons.forEach((btn, i) => {
        const selected = this.selectedPalette.kind === "marker" && this.selectedPalette.role === MARKER_PALETTE[i].role;
        btn.setFillStyle(selected ? 0x4a6a9a : 0x2a2a3a);
      });
    }
  }

  // ----- Grid ---------------------------------------------------------------

  private rebuildGridSystem(): void {
    const gridAreaRight = getViewport(this).width - 40;
    const availableWidth = gridAreaRight - GRID_AREA_LEFT;
    const availableHeight = GRID_AREA_BOTTOM - GRID_AREA_TOP;
    const tileSize = Math.floor(Math.min(64, availableWidth / this.draft.cols, availableHeight / this.draft.rows));
    const originX = Math.round(GRID_AREA_LEFT + (availableWidth - this.draft.cols * tileSize) / 2);
    const originY = Math.round(GRID_AREA_TOP + (availableHeight - this.draft.rows * tileSize) / 2);
    this.builderGrid = new GridSystem(this.draft.cols, this.draft.rows, tileSize, originX, originY);
  }

  /** Paints whatever tile `pointer` is over, if any. Shared by the initial press and every drag-move tick. */
  private paintAt(pointer: Phaser.Input.Pointer): GridPosition | null {
    const tile = this.builderGrid.worldToTile({ x: pointer.worldX, y: pointer.worldY });
    if (!tile) return null;
    this.draft = paintTile(this.draft, tile, this.selectedPalette);
    this.renderGrid();
    this.refreshValidation();
    return tile;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const tile = this.paintAt(pointer);
    this.isPainting = tile !== null;
    this.lastPaintedTile = tile;
  }

  /** Real click-and-drag continuous paint: while the button is held, every NEW tile the pointer crosses over gets painted too, not just the one under the initial click. */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isPainting) return;
    const tile = this.builderGrid.worldToTile({ x: pointer.worldX, y: pointer.worldY });
    if (!tile) return;
    if (this.lastPaintedTile && tile.x === this.lastPaintedTile.x && tile.y === this.lastPaintedTile.y) return;
    this.lastPaintedTile = tile;
    this.draft = paintTile(this.draft, tile, this.selectedPalette);
    this.renderGrid();
    this.refreshValidation();
  }

  // Registered scene-wide (not just over the grid) since a drag can end
  // after the pointer has moved off the grid area entirely.
  private handlePointerUp(): void {
    this.isPainting = false;
    this.lastPaintedTile = null;
  }

  private renderGrid(): void {
    this.tileObjects.forEach((o) => o.destroy());
    this.tileObjects = [];
    this.gridGraphics.clear();

    const map = new GameMap(this.draft);
    const size = this.builderGrid.tileSize;

    for (let y = 0; y < this.draft.rows; y++) {
      for (let x = 0; x < this.draft.cols; x++) {
        const pos: GridPosition = { x, y };
        const tl = this.builderGrid.tileToWorldTopLeft(pos);
        const type = this.draft.tiles[y][x];
        const rect = this.add
          .rectangle(tl.x + size / 2, tl.y + size / 2, size - 2, size - 2, TERRAIN_COLORS[type])
          .setDepth(0);
        this.tileObjects.push(rect);

        const role: TileRole = map.roleAt(pos);
        if (role) {
          const ring = this.add
            .rectangle(tl.x + size / 2, tl.y + size / 2, size - 6, size - 6, ROLE_COLORS[role], 0.55)
            .setStrokeStyle(2, ROLE_COLORS[role])
            .setDepth(2);
          const glyph = this.add
            .text(tl.x + size / 2, tl.y + size / 2, ROLE_GLYPHS[role], {
              fontFamily: "system-ui, Arial, sans-serif",
              fontSize: `${Math.max(10, Math.floor(size * 0.35))}px`,
              color: "#0e0e14",
              fontStyle: "bold",
            })
            .setOrigin(0.5)
            .setDepth(2);
          this.tileObjects.push(ring, glyph);
        }
      }
    }

    this.gridGraphics.lineStyle(1, COLORS.gridLine, 1);
    const ox = this.builderGrid.originX;
    const oy = this.builderGrid.originY;
    for (let col = 0; col <= this.draft.cols; col++) {
      const x = ox + col * size;
      this.gridGraphics.lineBetween(x, oy, x, oy + this.draft.rows * size);
    }
    for (let row = 0; row <= this.draft.rows; row++) {
      const y = oy + row * size;
      this.gridGraphics.lineBetween(ox, y, ox + this.draft.cols * size, y);
    }
  }

  // ----- Footer: validation + Playtest/Publish ------------------------------

  private buildFooter(cx: number): void {
    this.validationText = this.add
      .text(cx, GRID_AREA_BOTTOM + 15, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#e0a860",
        align: "center",
        wordWrap: { width: cx * 2 - 160 },
      })
      .setOrigin(0.5, 0);
    this.centeredObjects.push({ obj: this.validationText, dx: 0, y: GRID_AREA_BOTTOM + 15 });

    const y = GRID_AREA_BOTTOM + 95;
    const leftX = cx - 150;
    const rightX = cx + 150;

    this.playtestButton = this.add
      .rectangle(leftX, y, 260, 50, 0x4caf72)
      .setInteractive({ useHandCursor: true });
    const playtestLabel = this.add
      .text(leftX, y, "Playtest", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "20px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.playtestButton.on("pointerdown", () => this.onPlaytest());
    this.centeredObjects.push({ obj: this.playtestButton, dx: -150, y }, { obj: playtestLabel, dx: -150, y });

    this.publishButton = this.add
      .rectangle(rightX, y, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.publishLabel = this.add
      .text(rightX, y, "Publish", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "18px", color: "#e8e8f0" })
      .setOrigin(0.5);
    this.publishButton.on("pointerdown", () => this.onPublish());
    this.centeredObjects.push({ obj: this.publishButton, dx: 150, y }, { obj: this.publishLabel, dx: 150, y });

    this.publishStatusText = this.add
      .text(rightX, y + 40, "", { fontFamily: "monospace", fontSize: "12px", color: "#8a8aa0" })
      .setOrigin(0.5);
    this.centeredObjects.push({ obj: this.publishStatusText, dx: 150, y: y + 40 });

    if (!firebaseReady) {
      this.publishButton.setVisible(false);
      this.publishLabel.setVisible(false);
      this.publishStatusText.setText("Publish needs a configured Firebase project.");
    }
  }

  private onPlaytest(): void {
    if (!validateDraft(this.draft).ok) return;
    const waves = generateFreePlayWaves({
      waveCount: 4,
      minionPool: STANDARD_MINIONS,
      bossEnemyId: PLAYTEST_BOSS_ID,
    });
    this.scene.start("CharacterCreationScene", {
      customMapData: this.draft,
      freePlayWaves: waves,
      difficultyId: "normal",
    });
  }

  private isPublishAllowed(): boolean {
    if (!firebaseReady || !this.authState.uid) return false;
    if (!isValidMapName(this.draft.name)) return false;
    if (!validateDraft(this.draft).ok) return false;
    if (this.publishedMapId) return true; // updating your own already-published map is never blocked by the cap
    return !hasReachedPublishLimit(this.publishedCountForAuthor);
  }

  private onPublish(): void {
    if (!this.isPublishAllowed() || !this.authState.uid) return;
    const now = Date.now();
    const id = this.publishedMapId ?? `sharedMap-${this.authState.uid}-${now}`;
    const record = toSharedMapRecord(
      this.draft,
      id,
      { uid: this.authState.uid, displayName: this.authState.displayName },
      { createdAt: this.publishedMapId ? this.publishedMapCreatedAt : now, updatedAt: now },
    );
    this.publishStatusText.setText("Publishing…");
    pushMap(record)
      .then(() => {
        this.publishedMapId = id;
        this.publishedMapCreatedAt = record.createdAt;
        this.publishStatusText.setText(`Published as "${record.name}".`);
        this.refreshPublishedCount();
      })
      .catch((err) => {
        console.error("Map publish failed:", err);
        this.publishStatusText.setText("Publish failed — try again.");
      });
  }

  private refreshPublishedCount(): void {
    if (!firebaseReady || !this.authState.uid) {
      this.publishedCountForAuthor = 0;
      this.refreshAll();
      return;
    }
    listMapsByAuthor(this.authState.uid)
      .then((maps) => {
        this.publishedCountForAuthor = maps.length;
        this.refreshAll();
      })
      .catch((err) => console.error("Failed to check published map count:", err));
  }

  // ----- Refresh -------------------------------------------------------------

  private refreshValidation(): void {
    const result = validateDraft(this.draft);
    this.validationText.setText(result.ok ? "This map is valid and ready to Playtest or Publish." : result.reasons.join("  ·  "));
    this.validationText.setColor(result.ok ? "#9be0b4" : "#e0a860");

    this.playtestButton.setFillStyle(result.ok ? 0x4caf72 : 0x4a4a4a);
    if (result.ok) this.playtestButton.setInteractive({ useHandCursor: true });
    else this.playtestButton.disableInteractive();

    const publishOk = this.isPublishAllowed();
    if (firebaseReady) {
      this.publishButton.setFillStyle(publishOk ? 0x5a3a6a : 0x2a2a3a);
      if (publishOk) this.publishButton.setInteractive({ useHandCursor: true });
      else this.publishButton.disableInteractive();

      if (!this.authState.uid) {
        this.publishStatusText.setText("Connecting…");
      } else if (!isValidMapName(this.draft.name)) {
        this.publishStatusText.setText("Give this map a name before publishing.");
      } else if (!result.ok) {
        this.publishStatusText.setText("Fix the issues above to publish.");
      } else if (!this.publishedMapId && hasReachedPublishLimit(this.publishedCountForAuthor)) {
        this.publishStatusText.setText(`You've published the max of ${MAX_PUBLISHED_MAPS_PER_AUTHOR} maps.`);
      } else if (this.publishedMapId) {
        this.publishStatusText.setText(`Published as "${this.draft.name}" — Publish again to update it.`);
      } else {
        this.publishStatusText.setText("");
      }
    }
  }

  private refreshAll(): void {
    // Keeps the input in sync with `this.draft.name` for paths that change
    // it programmatically (e.g. a resize preserving the current name) —
    // never overwrites it while the player is actively typing, since typing
    // itself already keeps `this.draft.name` and the input's own value equal.
    if (this.nameInputEl && this.nameInputEl.value !== this.draft.name) {
      this.nameInputEl.value = this.draft.name;
    }
    this.widthLabel.setText(`Width: ${this.draft.cols} tiles`);
    this.heightLabel.setText(`Height: ${this.draft.rows} tiles`);
    this.refreshValidation();
  }
}
