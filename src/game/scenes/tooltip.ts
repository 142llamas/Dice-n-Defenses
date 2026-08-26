import Phaser from "phaser";

/**
 * tooltip — a shared floating, canvas-clamped hover tooltip (same "shared
 * renderer, not duplicated per scene" precedent as `dialogueBox.ts`/
 * `uiTheme.ts`). D-148: generalized from `BattleScene`'s original
 * `unitTooltip`/`updateUnitTooltip`/`showUnitTooltipAt` (D-132), which was
 * wired only to grid-tile hover — this lets any interactive Phaser object
 * (a spell button, a hotkey slot) show a hover tooltip the same way.
 *
 * One controller (one underlying Text object) per scene, reused across every
 * `attachHoverTooltip` call in that scene, rather than one Text object per
 * hoverable target.
 */

export interface TooltipController {
  /** Shows `text` centered above (`x`, `y`), clamped so it never runs off either canvas edge. */
  showAt(x: number, y: number, text: string): void;
  hide(): void;
  destroy(): void;
}

export function createTooltipController(scene: Phaser.Scene): TooltipController {
  const tooltip = scene.add
    .text(0, 0, "", {
      fontFamily: "system-ui, Arial, sans-serif",
      fontSize: "13px",
      color: "#0e0e14",
      backgroundColor: "#e8e0c0",
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
      align: "center",
      wordWrap: { width: 280 },
    })
    .setOrigin(0.5, 1)
    // Above every other UI element in either scene this is used from —
    // matches `unitTooltip`'s original D-132 depth-50 rationale.
    .setDepth(200)
    .setVisible(false);

  return {
    showAt(x: number, y: number, text: string): void {
      if (!text) return;
      // D-157: clamp against the scene's live canvas width, not the fixed
      // GAME_WIDTH constant — a no-op today under Scale.FIT (D-159
      // reverted the Scale.RESIZE cutover, so this is always identical to
      // GAME_WIDTH again), kept as groundwork if that's attempted again.
      const clampedX = Math.min(Math.max(x, 90), scene.scale.width - 90);
      tooltip.setText(text).setPosition(clampedX, y).setVisible(true);
    },
    hide(): void {
      tooltip.setVisible(false);
    },
    destroy(): void {
      tooltip.destroy();
    },
  };
}

/**
 * Wires `target`'s pointerover/pointerout to show/hide `controller`'s
 * tooltip above (`x`, `y`) — `target` must already be interactive
 * (`setInteractive()`). `textProvider` is called fresh on every hover so the
 * text can depend on state that changes after `target` was created.
 */
export function attachHoverTooltip(
  controller: TooltipController,
  target: Phaser.GameObjects.GameObject,
  x: number,
  y: number,
  textProvider: () => string,
): void {
  target.on("pointerover", () => controller.showAt(x, y, textProvider()));
  target.on("pointerout", () => controller.hide());
}
