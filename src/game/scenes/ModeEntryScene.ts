import Phaser from "phaser";
import { getViewport, onViewportResize } from "./uiTheme";

export type ModeEntryMode = "campaign" | "freeplay";

interface ModeEntryData {
  mode: ModeEntryMode;
}

/**
 * ModeEntryScene — Phase 1 of the 2026-08-28 playtest batch: a New/Load
 * fork Kevin asked for ahead of both Campaign and Free Play, rather than
 * jumping straight into each mode's own config/region-list screen. One
 * parameterized scene instead of two near-duplicates, since both modes need
 * the exact same shape (title, Back, "New X" / "Load X").
 *
 * "Load X" hands off to `LoadGameScene` with a `filterMode` matching this
 * scene's own `mode`, so Campaign's Load list only shows campaign-linked
 * saves and Free Play's only shows the rest — see `LoadGameScene` for the
 * filter itself. `LoadGameScene`'s Back button returns here (not straight to
 * Main Menu) when it was reached this way, so the New/Load choice isn't lost.
 *
 * Matches `CampaignSelectScene`/`FreePlayScene`/`LoadGameScene`'s existing
 * plain-rectangle button style (not the newer D-123 ornate theme) since
 * those are its two immediate downstream neighbors and neither has been
 * reskinned yet.
 */
export class ModeEntryScene extends Phaser.Scene {
  private mode: ModeEntryMode = "campaign";
  private layoutRoot?: Phaser.GameObjects.Container;

  constructor() {
    super("ModeEntryScene");
  }

  init(data: ModeEntryData): void {
    this.mode = data.mode;
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

  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    const { width, height } = getViewport(this);

    const title = this.mode === "campaign" ? "Campaigns" : "Free Play";
    this.add
      .text(width / 2, 40, title, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.buildButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());

    this.add
      .text(width / 2, 110, "Start something new, or pick up a saved party where you left off.", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#8a8aa0",
      })
      .setOrigin(0.5);

    const newLabel = this.mode === "campaign" ? "New Campaign" : "New Game";
    const loadLabel = this.mode === "campaign" ? "Load Campaign" : "Load Game";
    const cy = height / 2 - 20;
    this.buildButton(width / 2, cy, 340, 74, newLabel, 0x2a3a2e, () => {
      this.scene.start(this.mode === "campaign" ? "CampaignSelectScene" : "FreePlayScene");
    });
    this.buildButton(width / 2, cy + 100, 340, 74, loadLabel, 0x2a2a3a, () => {
      this.scene.start("LoadGameScene", { filterMode: this.mode });
    });

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  /** Matches CampaignSelectScene/FreePlayScene/LoadGameScene's shared button style. */
  private buildButton(
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
      .text(x, y, text, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    rect.on("pointerdown", onClick);
    return { rect, label };
  }
}
