import Phaser from "phaser";
import { COLORS } from "../config";
import {
  cumulativeOffsets,
  contentHeight,
  clampScrollOffset,
  visibleRowRange,
  scrollbarThumbMetrics,
  scrollOffsetForThumbY,
} from "../systems/ScrollListMath";

/**
 * uiScrollList — D-234 (item 6): Phaser glue for `systems/ScrollListMath.ts`,
 * replacing pagination everywhere except `CompendiumScene` (Kevin's explicit
 * exception). Matches this codebase's existing "destroy and redraw
 * everything on refresh" convention (see `GearShopScene`/
 * `CharacterCreationScene`'s own per-refresh rebuild) rather than a
 * persistent-widget lifecycle — `renderScrollListRows`/`renderScrollbarVisual`
 * are called fresh every refresh, and whatever they create is either picked
 * up by the caller's existing "diff what got added to the display list"
 * capture (GearShopScene) or pushed into an explicit `overlay` array the
 * caller destroys itself (CharacterCreationScene) when an `overlay` param is
 * given.
 *
 * `BattleScene`'s in-battle item grid uses a different idiom entirely
 * (persistent buttons, toggled visible/invisible rather than destroyed) — it
 * calls the pure `ScrollListMath` functions directly instead of these, and
 * only reuses `renderScrollbarVisual` for its scrollbar visual.
 *
 * Mouse-wheel scrolling is registered ONCE per scene via `attachWheelScroll`
 * (call from `create()`, not from a per-refresh method) since
 * `scene.input.on("wheel", ...)` is a scene-level subscription, not a
 * GameObject — registering it per-refresh would stack duplicate handlers.
 * `getActiveRegion` is re-invoked on every wheel event so it always reflects
 * whatever is currently on screen (current filter/page state).
 */

export interface ScrollListRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SCROLLBAR_WIDTH = 10;
const SCROLLBAR_GAP = 6;

/** The row-drawing area's width once a scrollbar is reserved (or the full width, when the list fits without one). */
export function scrollableRowAreaWidth(rect: ScrollListRect, rowHeights: readonly number[], gap: number): number {
  const needsScrollbar = contentHeight(rowHeights, gap) > rect.height;
  return needsScrollbar ? rect.width - SCROLLBAR_WIDTH - SCROLLBAR_GAP : rect.width;
}

/**
 * A Graphics-backed clip mask over `rect` — kept on the display list (so a
 * before/after-diff capture convention still sees it) but invisible, since
 * `createGeometryMask` renders its shape as a mask regardless of the source
 * object's own visibility. Callers `.setMask()` this onto whatever container
 * or object needs clipping.
 */
export function createViewportMask(
  scene: Phaser.Scene,
  rect: ScrollListRect,
  overlay?: Phaser.GameObjects.GameObject[],
): Phaser.Display.Masks.GeometryMask {
  const maskGfx = scene.add.graphics().setVisible(false);
  overlay?.push(maskGfx);
  maskGfx.fillStyle(0xffffff);
  maskGfx.fillRect(rect.x, rect.y, rect.width, rect.height);
  return maskGfx.createGeometryMask();
}

/**
 * Draws only the currently-visible rows inside a masked (clipped) viewport.
 * `renderRow` draws one row at the given absolute position and returns
 * whatever GameObjects it created — this module owns clipping/scrolling
 * only, never row visuals.
 */
export function renderScrollListRows(
  scene: Phaser.Scene,
  rect: ScrollListRect,
  rowHeights: readonly number[],
  gap: number,
  scrollOffset: number,
  depth: number,
  renderRow: (index: number, rowX: number, rowY: number, rowWidth: number) => Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[],
  overlay?: Phaser.GameObjects.GameObject[],
): void {
  if (rowHeights.length === 0) return;
  const offsets = cumulativeOffsets(rowHeights, gap);
  const rowAreaWidth = scrollableRowAreaWidth(rect, rowHeights, gap);

  const container = scene.add.container(0, 0).setDepth(depth);
  overlay?.push(container);
  container.setMask(createViewportMask(scene, { ...rect, width: rowAreaWidth }, overlay));

  const { start, end } = visibleRowRange(offsets, rowHeights, scrollOffset, rect.height);
  for (let i = start; i <= end; i++) {
    const rowY = rect.y + offsets[i] - scrollOffset;
    const result = renderRow(i, rect.x, rowY, rowAreaWidth);
    for (const obj of Array.isArray(result) ? result : [result]) container.add(obj);
  }
}

/** Draws the thin draggable scrollbar track+thumb along the right edge of `rect` — draws nothing when the content already fits. */
export function renderScrollbarVisual(
  scene: Phaser.Scene,
  rect: ScrollListRect,
  totalHeight: number,
  scrollOffset: number,
  depth: number,
  onDrag: (newOffset: number) => void,
  overlay?: Phaser.GameObjects.GameObject[],
): void {
  if (totalHeight <= rect.height) return;
  const trackX = rect.x + rect.width - SCROLLBAR_WIDTH / 2;

  const track = scene.add.rectangle(trackX, rect.y + rect.height / 2, SCROLLBAR_WIDTH, rect.height, COLORS.bronze, 0.3).setDepth(depth);
  overlay?.push(track);

  const { thumbHeight, thumbY } = scrollbarThumbMetrics(scrollOffset, totalHeight, rect.height, rect.height);
  const thumb = scene.add
    .rectangle(trackX, rect.y + thumbY + thumbHeight / 2, SCROLLBAR_WIDTH - 2, thumbHeight, COLORS.gilt, 0.9)
    .setDepth(depth + 1)
    .setInteractive({ useHandCursor: true, draggable: true });
  overlay?.push(thumb);
  scene.input.setDraggable(thumb);
  thumb.on("drag", (_pointer: Phaser.Input.Pointer, _dragX: number, dragY: number) => {
    const clampedThumbY = Phaser.Math.Clamp(dragY - rect.y - thumbHeight / 2, 0, rect.height - thumbHeight);
    onDrag(scrollOffsetForThumbY(clampedThumbY, totalHeight, rect.height, rect.height));
  });
}

export interface ScrollRegion {
  rect: ScrollListRect;
  totalContentHeight: number;
  scrollOffset: number;
}

/**
 * Registers ONE persistent mouse-wheel handler for the scene — call once
 * from `create()`. `getActiveRegion` returns the currently on-screen
 * scrollable region (or null if none/not scrollable right now); re-invoked
 * on every wheel event so it always reflects the latest filter/page state.
 */
export function attachWheelScroll(scene: Phaser.Scene, getActiveRegion: () => ScrollRegion | null, onScroll: (newOffset: number) => void): void {
  scene.input.on("wheel", (pointer: Phaser.Input.Pointer, _over: unknown, _deltaX: number, deltaY: number) => {
    const region = getActiveRegion();
    if (!region) return;
    const { rect, totalContentHeight, scrollOffset } = region;
    if (pointer.x < rect.x || pointer.x > rect.x + rect.width || pointer.y < rect.y || pointer.y > rect.y + rect.height) return;
    const next = clampScrollOffset(scrollOffset + deltaY, totalContentHeight, rect.height);
    if (next !== scrollOffset) onScroll(next);
  });
}
