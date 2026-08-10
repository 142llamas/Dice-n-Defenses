import Phaser from "phaser";
import { GAME_WIDTH, COLORS } from "../config";
import { GridSystem, type GridPosition } from "../systems/GridSystem";
import { GameMap, type TileRole } from "../systems/GameMap";
import type { ParsedMap, TileType } from "../data/testMap";
import {
  MIN_MAP_COLS,
  MAX_MAP_COLS,
  MIN_MAP_ROWS,
  MAX_MAP_ROWS,
  createBlankDraft,
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

const MAP_NAME_POOL: string[] = [
  "Winding Pass",
  "Ember Hollow",
  "Frostgate Reach",
  "Sunken Vale",
  "Ashen Crossing",
  "Moonlit Bastion",
  "Stonewatch Ridge",
  "Thornwood Bend",
];

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
const GRID_AREA_TOP = 300;
const GRID_AREA_BOTTOM = 780;
const GRID_AREA_LEFT = 40;
const GRID_AREA_RIGHT = GAME_WIDTH - 40;

export class MapBuilderScene extends Phaser.Scene {
  private draft!: ParsedMap;
  private nameIndex = 0;
  private paletteTab: PaletteTab = "terrain";
  private selectedPalette: PaletteSelection = { kind: "terrain", tileType: "floor" };
  private builderGrid!: GridSystem;

  private nameLabel!: Phaser.GameObjects.Text;
  private widthLabel!: Phaser.GameObjects.Text;
  private heightLabel!: Phaser.GameObjects.Text;

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

  constructor() {
    super("MapBuilderScene");
  }

  create(): void {
    this.draft = createBlankDraft("map-builder-draft", MAP_NAME_POOL[0], DEFAULT_COLS, DEFAULT_ROWS);
    this.nameIndex = 0;
    this.paletteTab = "terrain";
    this.selectedPalette = { kind: "terrain", tileType: "floor" };
    this.tabButtons = [];
    this.swatchButtons = [];
    this.swatchLabels = [];
    this.tileObjects = [];
    this.publishedMapId = null;
    this.publishedMapCreatedAt = 0;
    this.publishedCountForAuthor = 0;

    this.cameras.main.setBackgroundColor("#0e0e14");

    this.add
      .text(GAME_WIDTH / 2, 40, "Map Builder", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.buildSmallButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());

    this.add
      .text(
        GAME_WIDTH / 2,
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

    this.buildSizeAndNameControls(150);
    this.buildPaletteTabs(210);
    this.gridGraphics = this.add.graphics().setDepth(1);
    this.buildFooter();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handleBoardClick(pointer));
    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });

    initAuth((state) => {
      this.authState = state;
      this.refreshPublishedCount();
    });

    this.rebuildGridSystem();
    this.renderPaletteSwatches();
    this.renderGrid();
    this.refreshAll();
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

  private buildSizeAndNameControls(y: number): void {
    const w = 260;
    const gap = 20;
    const totalWidth = 3 * w + 2 * gap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + w / 2;

    this.nameLabel = this.buildSmallButton(startX, y, w, 40, "", 0x2a2a3a, () => {
      this.nameIndex = (this.nameIndex + 1) % MAP_NAME_POOL.length;
      this.draft = { ...this.draft, name: MAP_NAME_POOL[this.nameIndex] };
      this.refreshAll();
    }).label;

    // Resizing rebuilds a blank draft at the new size — resizing an
    // in-progress draft while preserving existing paint is out of scope for
    // this pass (pick a size, THEN paint).
    this.widthLabel = this.buildSmallButton(startX + w + gap, y, w, 40, "", 0x2a2a3a, () => {
      const next = this.draft.cols >= MAX_MAP_COLS ? MIN_MAP_COLS : this.draft.cols + 1;
      this.draft = createBlankDraft(this.draft.id, this.draft.name, next, this.draft.rows);
      this.rebuildGridSystem();
      this.renderGrid();
      this.refreshAll();
    }).label;

    this.heightLabel = this.buildSmallButton(startX + 2 * (w + gap), y, w, 40, "", 0x2a2a3a, () => {
      const next = this.draft.rows >= MAX_MAP_ROWS ? MIN_MAP_ROWS : this.draft.rows + 1;
      this.draft = createBlankDraft(this.draft.id, this.draft.name, this.draft.cols, next);
      this.rebuildGridSystem();
      this.renderGrid();
      this.refreshAll();
    }).label;
  }

  // ----- Palette -----------------------------------------------------------

  private buildPaletteTabs(y: number): void {
    const tabs: { tab: PaletteTab; label: string }[] = [
      { tab: "terrain", label: "Terrain" },
      { tab: "markers", label: "Markers" },
    ];
    const w = 180;
    const gap = 10;
    const totalWidth = tabs.length * w + (tabs.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + w / 2;

    this.tabButtons = tabs.map((t, i) => {
      const x = startX + i * (w + gap);
      const { rect, label } = this.buildSmallButton(x, y, w, 34, t.label, 0x2a2a3a, () => {
        this.paletteTab = t.tab;
        this.renderPaletteSwatches();
      });
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
    const totalWidth = items.length * w + (items.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + w / 2;

    items.forEach((item, i) => {
      const x = startX + i * (w + gap);
      const { rect, label } = this.buildSmallButton(x, y, w, 32, item.label, 0x2a2a3a, () => {
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
    const availableWidth = GRID_AREA_RIGHT - GRID_AREA_LEFT;
    const availableHeight = GRID_AREA_BOTTOM - GRID_AREA_TOP;
    const tileSize = Math.floor(Math.min(64, availableWidth / this.draft.cols, availableHeight / this.draft.rows));
    const originX = Math.round(GRID_AREA_LEFT + (availableWidth - this.draft.cols * tileSize) / 2);
    const originY = Math.round(GRID_AREA_TOP + (availableHeight - this.draft.rows * tileSize) / 2);
    this.builderGrid = new GridSystem(this.draft.cols, this.draft.rows, tileSize, originX, originY);
  }

  private handleBoardClick(pointer: Phaser.Input.Pointer): void {
    const tile = this.builderGrid.worldToTile({ x: pointer.worldX, y: pointer.worldY });
    if (!tile) return;
    this.draft = paintTile(this.draft, tile, this.selectedPalette);
    this.renderGrid();
    this.refreshValidation();
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

  private buildFooter(): void {
    this.validationText = this.add
      .text(GAME_WIDTH / 2, GRID_AREA_BOTTOM + 15, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#e0a860",
        align: "center",
        wordWrap: { width: GAME_WIDTH - 160 },
      })
      .setOrigin(0.5, 0);

    const y = GRID_AREA_BOTTOM + 95;
    const leftX = GAME_WIDTH / 2 - 150;
    const rightX = GAME_WIDTH / 2 + 150;

    this.playtestButton = this.add
      .rectangle(leftX, y, 260, 50, 0x4caf72)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(leftX, y, "Playtest", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "20px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.playtestButton.on("pointerdown", () => this.onPlaytest());

    this.publishButton = this.add
      .rectangle(rightX, y, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.publishLabel = this.add
      .text(rightX, y, "Publish", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "18px", color: "#e8e8f0" })
      .setOrigin(0.5);
    this.publishButton.on("pointerdown", () => this.onPublish());

    this.publishStatusText = this.add
      .text(rightX, y + 40, "", { fontFamily: "monospace", fontSize: "12px", color: "#8a8aa0" })
      .setOrigin(0.5);

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
    this.nameLabel.setText(`Name: ${this.draft.name} (click to cycle)`);
    this.widthLabel.setText(`Width: ${this.draft.cols} tiles`);
    this.heightLabel.setText(`Height: ${this.draft.rows} tiles`);
    this.refreshValidation();
  }
}
