import Phaser from "phaser";
import { createOrnateButton, drawScreenBackdrop, getViewport, onViewportResize, FONT_DISPLAY, FONT_BODY } from "./uiTheme";

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
 * Reskinned to the shared D-123 ornate/parchment theme (`uiTheme.ts`) —
 * `CampaignSelectScene`/`FreePlayScene`/`LoadGameScene` (its two immediate
 * downstream neighbors) haven't been reskinned yet, so this screen is
 * visually ahead of them for now.
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

    drawScreenBackdrop(this);

    const title = this.mode === "campaign" ? "Campaigns" : "Free Play";
    this.add
      .text(width / 2, 40, title, {
        fontFamily: FONT_DISPLAY,
        fontSize: "36px",
        color: "#f0dfa8",
        fontStyle: "bold",
        letterSpacing: 2 as unknown as number,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    createOrnateButton(this, 110, 40, 160, 44, "Back (Esc)", () => this.leave(), { variant: "tool", depth: 5 });

    this.add
      .text(width / 2, 110, "Start something new, or pick up a saved party where you left off.", {
        fontFamily: FONT_BODY,
        fontSize: "14px",
        color: "#a89058",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(1);

    const newLabel = this.mode === "campaign" ? "New Campaign" : "New Game";
    const loadLabel = this.mode === "campaign" ? "Load Campaign" : "Load Game";
    const cy = height / 2 - 20;
    createOrnateButton(
      this,
      width / 2,
      cy,
      340,
      74,
      newLabel,
      () => {
        this.scene.start(this.mode === "campaign" ? "CampaignSelectScene" : "FreePlayScene");
      },
      { variant: "primary", depth: 5 },
    );
    createOrnateButton(
      this,
      width / 2,
      cy + 100,
      340,
      74,
      loadLabel,
      () => {
        this.scene.start("LoadGameScene", { filterMode: this.mode });
      },
      { variant: "secondary", depth: 5 },
    );

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }
}
