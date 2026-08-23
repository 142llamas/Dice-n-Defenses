/**
 * D-154: pure layout math extracted from `MainMenuScene.buildTitle` so it can
 * be unit-tested without a live Phaser renderer. Deliberately has no Phaser
 * import (unlike every scene file, including `uiTheme.ts`) — this is the
 * regression-test pattern future scene-to-viewport conversions should
 * follow for any layout math worth pinning down, per the responsive-canvas
 * foundation this decision built.
 *
 * The Settings button sits at `(viewportWidth - 170, 32)` and the Account
 * control at `(viewportWidth - 170, 88)`, both 260 wide x 44 tall
 * (`MainMenuScene.buildSettingsControl`/`buildAccountControl`) — this is
 * their combined bounding box, used to keep the title from overlapping
 * either one.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeCornerControlsRegion(viewportWidth: number): Rect {
  return { x: viewportWidth - 300, y: 10, width: 260, height: 100 };
}
