import Phaser from "phaser";
import { COLORS } from "../config";
import { canSkipSequence, type DialogueLine } from "../systems/DialogueSystem";

/**
 * dialogueBox — a stylized, parchment-look modal for chapter-boundary story
 * text (D-119, presentation layer for `CAMPAIGN_STORY_DESIGN.md`'s
 * chapter `introText`/`outroText` and future companion dialogue). Built as
 * one shared, scene-agnostic renderer rather than duplicated per scene
 * (this project's usual "each scene hand-rolls its own small button
 * helper" convention doesn't fit here — this is substantially more drawing
 * code than a button, and it has at least two known callers already:
 * `CompendiumScene`'s preview tab now, and a future `BattleScene`
 * chapter-transition hookup once real chapter content exists).
 *
 * Two speaker styles, per Kevin's own call:
 * - An NPC line (`speakerName` set) gets a framed portrait slot + name
 *   plate. The portrait shows a real image once one is loaded for
 *   `portraitKey` (see `data/portraitManifest.ts`, currently empty); until
 *   then it shows a drawn placeholder silhouette, never a blank gap.
 * - A line with no `speakerName` (the player's own PC, or plain narration)
 *   renders as full-width text with no portrait at all — you're already
 *   looking at your own hero on the board.
 *
 * The parchment panel itself is drawn with `Phaser.GameObjects.Graphics`
 * (base fill + low-alpha "aged" mottling + a frame border), not an image —
 * same "real drawing code, no art asset needed" treatment Phase 22's Cape
 * of Billowing got. Nothing here needs an uploaded image to look finished;
 * only the per-speaker portrait needs one, and it degrades gracefully
 * without it.
 *
 * Same overlay idiom as every other modal in this codebase (`asiOverlay`/
 * `spellbookOverlay` in `BattleScene.ts`): a flat `GameObject[]`, all
 * destroyed together on dismiss. This module just owns that array itself
 * (via `DialogueBoxController`) instead of asking the calling scene to.
 *
 * D-120 (skip controls, Kevin's own request): advancing past a line is
 * ALWAYS instant and ALWAYS available — via the Continue button, clicking
 * anywhere on the panel/scrim, or pressing Space/Enter — so a fast reader
 * is never stuck waiting on this line's presentation ("skip past the
 * current dialogue screen"). Separately, a "Skip" button can jump straight
 * to the end of the WHOLE sequence at once ("skip the whole talking
 * section"), but only when no line anywhere in the sequence sets
 * `hasDecision` — skipping must never let a player miss a choice. Every
 * skip path funnels through `interruptCurrentLinePlayback()`, a no-op
 * today — this is deliberately the ONE seam a future text-reveal animation
 * or voice-over-audio-stop call belongs in, so neither has to be
 * rediscovered later; see that method's own comment.
 *
 * `DialogueLine` and `canSkipSequence` themselves live in
 * `systems/DialogueSystem.ts`, not here — this file imports `Phaser` at
 * module scope, which breaks in this project's Node-based Vitest
 * environment (no `window`), so anything meant to be unit-tested has to
 * live somewhere Phaser-free, per this project's own "rules live in
 * systems/, no Phaser dependency" architecture rule. Re-exported below so
 * existing callers can still import both from this one file.
 */

export { canSkipSequence, type DialogueLine };

const PANEL_WIDTH = 900;
const PANEL_HEIGHT = 280;
const PANEL_RADIUS = 16;

const PORTRAIT_WIDTH = 160;
const PORTRAIT_HEIGHT = 200;
const PORTRAIT_PADDING = 36;

const TEXT_RIGHT_PADDING = 40;
const TEXT_TOP_PADDING = 34;

/**
 * Renders one `DialogueLine` at a time inside a parchment panel, advancing
 * on "Continue"/closing on the last line's "Close". Call `destroy()`
 * directly if the calling scene needs to tear it down early (e.g. its own
 * SHUTDOWN handler) — safe to call twice.
 */
export class DialogueBoxController {
  private readonly scene: Phaser.Scene;
  private readonly lines: DialogueLine[];
  private readonly onComplete: () => void;
  private readonly canSkip: boolean;
  private index = 0;
  private objects: Phaser.GameObjects.GameObject[] = [];

  private portraitFrame!: Phaser.GameObjects.Rectangle;
  private portraitImage: Phaser.GameObjects.Image | undefined;
  private portraitPlaceholder!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private continueLabel!: Phaser.GameObjects.Text;

  private readonly onKeyAdvance = (): void => this.advance();

  constructor(scene: Phaser.Scene, lines: DialogueLine[], onComplete: () => void = () => {}) {
    if (lines.length === 0) throw new Error("DialogueBoxController requires at least one line.");
    this.scene = scene;
    this.lines = lines;
    this.onComplete = onComplete;
    this.canSkip = canSkipSequence(lines);
    this.build();
  }

  private build(): void {
    const { scene } = this;
    // D-157: reads the scene's live canvas size (was fixed GAME_WIDTH/
    // GAME_HEIGHT) so the scrim fills the true canvas post-Scale.RESIZE.
    // Known limitation, same as CharacterCreationScene's wizard overlay: a
    // resize firing while this dialogue is already open won't re-size an
    // already-drawn scrim (only a fresh `build()`/`renderLine()` reads the
    // live size) — not fixed here, since this box is dismissed/advanced far
    // more often than a browser window is actually resized mid-read.
    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;

    // Clicking anywhere on the dim background also advances (D-120's "skip
    // past the current screen" ask) — topOnly input (Phaser's default)
    // means a click on a higher-depth object below (Continue, Skip) is
    // never double-counted here, as long as those stay at a higher depth
    // than this scrim.
    const scrim = scene.add
      .rectangle(cx, cy, scene.scale.width, scene.scale.height, 0x000000, 0.65)
      .setDepth(40)
      .setInteractive();
    scrim.on("pointerdown", () => this.advance());

    const panel = scene.add.graphics().setDepth(41);
    this.drawParchmentPanel(panel, cx, cy);
    // Same click-to-advance convenience, over the panel itself (most of
    // where a reader's eyes/mouse actually are).
    panel.setInteractive(
      new Phaser.Geom.Rectangle(cx - PANEL_WIDTH / 2, cy - PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    panel.on("pointerdown", () => this.advance());

    const portraitX = cx - PANEL_WIDTH / 2 + PORTRAIT_PADDING + PORTRAIT_WIDTH / 2;
    const portraitY = cy - PANEL_HEIGHT / 2 + TEXT_TOP_PADDING + PORTRAIT_HEIGHT / 2;

    this.portraitFrame = scene.add
      .rectangle(portraitX, portraitY, PORTRAIT_WIDTH, PORTRAIT_HEIGHT, COLORS.portraitPlaceholderBg)
      .setStrokeStyle(3, COLORS.parchmentBorder)
      .setDepth(42)
      .setVisible(false);

    this.portraitPlaceholder = scene.add.graphics().setDepth(43).setVisible(false);
    this.drawPlaceholderSilhouette(portraitX, portraitY);

    this.nameText = scene.add
      .text(portraitX, portraitY + PORTRAIT_HEIGHT / 2 + 20, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#3a2410",
      })
      .setOrigin(0.5, 0)
      .setDepth(42)
      .setVisible(false);

    this.bodyText = scene.add.text(0, 0, "", {
      fontFamily: "system-ui, Arial, sans-serif",
      fontSize: "17px",
      color: "#2a1a10",
      lineSpacing: 6,
    });
    this.bodyText.setDepth(42);

    this.counterText = scene.add
      .text(cx + PANEL_WIDTH / 2 - 20, cy - PANEL_HEIGHT / 2 + 16, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#6a4a2a",
      })
      .setOrigin(1, 0)
      .setDepth(42);

    const buttonY = cy + PANEL_HEIGHT / 2 - 32;
    const buttonX = cx + PANEL_WIDTH / 2 - 90;
    const continueButton = scene.add
      .rectangle(buttonX, buttonY, 140, 36, COLORS.parchmentBorder)
      .setStrokeStyle(1, 0x2a1a10)
      .setDepth(44)
      .setInteractive({ useHandCursor: true });
    this.continueLabel = scene.add
      .text(buttonX, buttonY, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#f0e0c0",
      })
      .setOrigin(0.5)
      .setDepth(45);
    continueButton.on("pointerdown", () => this.advance());

    // D-120: "skip the whole talking section" — only ever shown when no
    // line in this sequence requires a decision (see `canSkipSequence`).
    // Top-left, mirroring the counter's top-right placement, since the
    // bottom-left corner is the portrait's territory.
    const skipY = cy - PANEL_HEIGHT / 2 + 20;
    const skipX = cx - PANEL_WIDTH / 2 + 75;
    const skipButton = scene.add
      .rectangle(skipX, skipY, 130, 30, COLORS.parchmentBorder)
      .setStrokeStyle(1, 0x2a1a10)
      .setDepth(44)
      .setInteractive({ useHandCursor: true })
      .setVisible(this.canSkip);
    const skipLabel = scene.add
      .text(skipX, skipY, "Skip ▶▶", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#f0e0c0",
      })
      .setOrigin(0.5)
      .setDepth(45)
      .setVisible(this.canSkip);
    skipButton.on("pointerdown", () => this.skipSequence());

    const keyboard = scene.input.keyboard;
    keyboard?.on("keydown-SPACE", this.onKeyAdvance);
    keyboard?.on("keydown-ENTER", this.onKeyAdvance);

    this.objects.push(
      scrim,
      panel,
      this.portraitFrame,
      this.portraitPlaceholder,
      this.nameText,
      this.bodyText,
      this.counterText,
      continueButton,
      this.continueLabel,
      skipButton,
      skipLabel,
    );

    this.renderLine();
  }

  private drawParchmentPanel(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    const left = cx - PANEL_WIDTH / 2;
    const top = cy - PANEL_HEIGHT / 2;

    g.fillStyle(COLORS.parchmentBase, 1);
    g.fillRoundedRect(left, top, PANEL_WIDTH, PANEL_HEIGHT, PANEL_RADIUS);

    // A few fixed, low-alpha blotches for an "aged paper" look — deterministic
    // (not randomized) so the panel always looks the same, matching this
    // project's preference for reproducible rendering over per-run variance.
    g.fillStyle(COLORS.parchmentMottle, 0.22);
    g.fillEllipse(left + PANEL_WIDTH * 0.18, top + PANEL_HEIGHT * 0.22, 140, 70);
    g.fillEllipse(left + PANEL_WIDTH * 0.78, top + PANEL_HEIGHT * 0.75, 170, 90);
    g.fillEllipse(left + PANEL_WIDTH * 0.55, top + PANEL_HEIGHT * 0.15, 110, 50);

    g.lineStyle(4, COLORS.parchmentBorder, 1);
    g.strokeRoundedRect(left, top, PANEL_WIDTH, PANEL_HEIGHT, PANEL_RADIUS);
    g.lineStyle(1, COLORS.parchmentBorder, 0.5);
    g.strokeRoundedRect(left + 10, top + 10, PANEL_WIDTH - 20, PANEL_HEIGHT - 20, PANEL_RADIUS - 4);
  }

  /** A simple bust silhouette (head + shoulders) — a placeholder shape, not real art. */
  private drawPlaceholderSilhouette(x: number, y: number): void {
    const g = this.portraitPlaceholder;
    g.clear();
    g.fillStyle(COLORS.portraitPlaceholderFg, 1);
    g.fillCircle(x, y - 30, 36);
    g.fillEllipse(x, y + 50, 100, 90);
  }

  private renderLine(): void {
    const line = this.lines[this.index];
    const cx = this.scene.scale.width / 2;
    const cy = this.scene.scale.height / 2;
    const hasPortrait = !!line.speakerName;

    this.portraitFrame.setVisible(hasPortrait);
    this.portraitPlaceholder.setVisible(hasPortrait);
    this.nameText.setVisible(hasPortrait);
    this.portraitImage?.destroy();
    this.portraitImage = undefined;

    let textLeft: number;
    if (hasPortrait) {
      this.nameText.setText(line.speakerName ?? "");
      textLeft = cx - PANEL_WIDTH / 2 + PORTRAIT_PADDING * 2 + PORTRAIT_WIDTH;

      if (line.portraitKey && this.scene.textures.exists(line.portraitKey)) {
        this.portraitPlaceholder.setVisible(false);
        const portraitX = this.portraitFrame.x;
        const portraitY = this.portraitFrame.y;
        this.portraitImage = this.scene.add
          .image(portraitX, portraitY, line.portraitKey)
          .setDisplaySize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)
          .setDepth(42);
      }
    } else {
      textLeft = cx - PANEL_WIDTH / 2 + PORTRAIT_PADDING;
    }

    const textWidth = cx + PANEL_WIDTH / 2 - TEXT_RIGHT_PADDING - textLeft;
    this.bodyText.setPosition(textLeft, cy - PANEL_HEIGHT / 2 + TEXT_TOP_PADDING);
    this.bodyText.setWordWrapWidth(textWidth);
    this.bodyText.setText(line.text);

    this.counterText.setText(this.lines.length > 1 ? `${this.index + 1} / ${this.lines.length}` : "");
    this.continueLabel.setText(this.isLastLine() ? "Close" : "Continue ▶");
  }

  private isLastLine(): boolean {
    return this.index >= this.lines.length - 1;
  }

  /**
   * D-120: the ONE place any skip path routes through before ending this
   * line's presentation early. No-op today — nothing in a line's
   * presentation plays out over time yet (text renders in full instantly,
   * there's no audio). When a text-reveal animation or voice-over playback
   * is added later, THIS is where its "stop now" call belongs — every
   * advance/skip path (Continue, click-anywhere, Space/Enter, Skip-all)
   * already funnels through here, so that future work is a one-method
   * change, not a re-audit of every input path.
   */
  private interruptCurrentLinePlayback(): void {
    // Intentionally empty — see comment above.
  }

  private advance(): void {
    this.interruptCurrentLinePlayback();
    if (this.isLastLine()) {
      this.destroy();
      this.onComplete();
      return;
    }
    this.index++;
    this.renderLine();
  }

  /** D-120: "skip the whole talking section" — jumps straight to the end, only ever reachable when `canSkip` is true. */
  private skipSequence(): void {
    if (!this.canSkip) return;
    this.interruptCurrentLinePlayback();
    this.destroy();
    this.onComplete();
  }

  /** Safe to call more than once — a no-op after the first call. */
  destroy(): void {
    this.portraitImage?.destroy();
    this.portraitImage = undefined;
    for (const obj of this.objects) obj.destroy();
    this.objects = [];
    const keyboard = this.scene.input.keyboard;
    keyboard?.off("keydown-SPACE", this.onKeyAdvance);
    keyboard?.off("keydown-ENTER", this.onKeyAdvance);
  }
}

/** Convenience wrapper matching this codebase's "one function to call" style for other one-off scene features. */
export function showDialogue(
  scene: Phaser.Scene,
  lines: DialogueLine[],
  onComplete?: () => void,
): DialogueBoxController {
  return new DialogueBoxController(scene, lines, onComplete);
}
