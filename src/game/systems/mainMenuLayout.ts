/**
 * D-154: pure layout math extracted from `MainMenuScene.buildTitle` so it can
 * be unit-tested without a live Phaser renderer. Deliberately has no Phaser
 * import (unlike every scene file, including `uiTheme.ts`) — this is the
 * regression-test pattern future scene-to-viewport conversions should
 * follow for any layout math worth pinning down, per the responsive-canvas
 * foundation this decision built.
 *
 * The Settings button sits at `(viewportWidth - 62, 48)` and the Account
 * control at `(viewportWidth - 62, 104)`, both 44x44 icon buttons (D-217,
 * item 7 — shrunk from 260x44 text buttons to icon-only placeholders,
 * `MainMenuScene.buildSettingsControl`/`buildAccountControl`) — this is
 * their combined bounding box, used to keep the title from overlapping
 * either one. Right edge stays anchored at `viewportWidth - 40`, unchanged
 * from before D-217, so the buttons keep the same margin from the frame.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeCornerControlsRegion(viewportWidth: number): Rect {
  return { x: viewportWidth - 84, y: 26, width: 44, height: 100 };
}
