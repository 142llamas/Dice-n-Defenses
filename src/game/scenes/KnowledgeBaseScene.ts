import Phaser from "phaser";
import {
  createOrnateButton,
  centeredRowX,
  drawScreenBackdrop,
  spawnAmbientMotes,
  getViewport,
  onViewportResize,
  FONT_DISPLAY,
  FONT_BODY,
} from "./uiTheme";

/**
 * KnowledgeBaseScene — Phase 1 of the 2026-08-28 playtest batch: Kevin asked
 * for Main Menu's separate Compendium/Bestiary buttons to be folded into one
 * "Knowledge Base" entry point. Uses the D-123 ornate uiTheme components
 * (not the plain style `ModeEntryScene` uses) since it sits directly between
 * two already-reskinned screens — Main Menu and Compendium/Bestiary
 * themselves.
 */
export class KnowledgeBaseScene extends Phaser.Scene {
  private layoutRoot?: Phaser.GameObjects.Container;

  constructor() {
    super("KnowledgeBaseScene");
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
    const cx = width / 2;

    drawScreenBackdrop(this);
    spawnAmbientMotes(this, 12);

    this.add
      .text(cx, 100, "Knowledge Base", {
        fontFamily: FONT_DISPLAY,
        fontSize: "44px",
        color: "#f0dfa8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(0, 3, "#000000", 10, true, true)
      .setDepth(1);

    this.add
      .text(cx, 150, "Everything you've learned about heroes, classes, and the foes you've faced.", {
        fontFamily: FONT_BODY,
        fontSize: "17px",
        color: "#b8a074",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(1);

    createOrnateButton(this, 120, 42, 160, 44, "Back (Esc)", () => this.leave(), {
      variant: "tool",
      depth: 5,
    });

    const entries: { label: string; sublabel: string; onClick: () => void }[] = [
      {
        label: "Compendium",
        sublabel: "Classes, subclasses, feats, and spells",
        onClick: () => this.scene.start("CompendiumScene"),
      },
      {
        label: "Bestiary",
        sublabel: "Every enemy you've encountered",
        onClick: () => this.scene.start("BestiaryScene"),
      },
    ];
    const width_ = 320;
    const { xs, itemWidth } = centeredRowX(entries.length, width_, 30, cx, width - 80);
    const cy = height / 2;
    entries.forEach((entry, i) => {
      createOrnateButton(this, xs[i], cy, itemWidth, 92, entry.label, entry.onClick, {
        variant: "secondary",
        sublabel: entry.sublabel,
        depth: 5,
      });
    });

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }
}
