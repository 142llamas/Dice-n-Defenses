/**
 * ScrollListMath — D-234 (item 6): pure scroll/clip math shared by every
 * scrollable list in the game (GearShopScene/CharacterCreationScene
 * catalogs, the BattleScene spellbook and in-battle shop grid,
 * BestiaryScene) — everywhere pagination is being replaced EXCEPT
 * CompendiumScene, which stays paginated (Kevin's explicit exception).
 *
 * Works over an array of per-row heights rather than one fixed height, so
 * the same functions serve both the uniform-row consumers (a fixed height
 * repeated N times) and BestiaryScene's variable-height wrapped entries.
 * No Phaser dependency — see `scenes/uiScrollList.ts` for the glue that
 * actually draws a masked, wheel/drag-scrollable list using this math.
 */

export function cumulativeOffsets(rowHeights: readonly number[], gap: number): number[] {
  const offsets: number[] = [];
  let y = 0;
  for (const h of rowHeights) {
    offsets.push(y);
    y += h + gap;
  }
  return offsets;
}

export function contentHeight(rowHeights: readonly number[], gap: number): number {
  if (rowHeights.length === 0) return 0;
  return rowHeights.reduce((sum, h) => sum + h, 0) + gap * (rowHeights.length - 1);
}

export function clampScrollOffset(offset: number, totalContentHeight: number, viewportHeight: number): number {
  const maxOffset = Math.max(0, totalContentHeight - viewportHeight);
  return Math.min(Math.max(0, offset), maxOffset);
}

export interface VisibleRowRange {
  /** Inclusive first visible row index. */
  start: number;
  /** Inclusive last visible row index — `end < start` (e.g. `-1`) means nothing is visible (an empty list). */
  end: number;
}

/** Which rows (by index) currently fall inside `[scrollOffset, scrollOffset + viewportHeight)`. */
export function visibleRowRange(
  offsets: readonly number[],
  rowHeights: readonly number[],
  scrollOffset: number,
  viewportHeight: number,
): VisibleRowRange {
  if (offsets.length === 0) return { start: 0, end: -1 };
  let start = 0;
  while (start < offsets.length - 1 && offsets[start] + rowHeights[start] <= scrollOffset) start++;
  let end = start;
  while (end < offsets.length - 1 && offsets[end + 1] < scrollOffset + viewportHeight) end++;
  return { start, end };
}

/**
 * The scroll offset that brings row `index` fully into view, nudging as
 * little as possible from `currentOffset` — used by keyboard/gamepad grid
 * navigation (`BattleScene.moveGridFocus`) so the cursor scrolls the list
 * into view instead of hard-jumping pages.
 */
export function scrollOffsetToReveal(
  index: number,
  offsets: readonly number[],
  rowHeights: readonly number[],
  currentOffset: number,
  viewportHeight: number,
): number {
  if (index < 0 || index >= offsets.length) return currentOffset;
  const rowTop = offsets[index];
  const rowBottom = rowTop + rowHeights[index];
  if (rowTop < currentOffset) return rowTop;
  if (rowBottom > currentOffset + viewportHeight) return rowBottom - viewportHeight;
  return currentOffset;
}

export interface ScrollbarThumbMetrics {
  thumbHeight: number;
  /** Offset from the top of the scrollbar track. */
  thumbY: number;
}

const MIN_THUMB_HEIGHT = 20;

/** Where to draw the draggable scrollbar thumb for the current scroll position. */
export function scrollbarThumbMetrics(
  scrollOffset: number,
  totalContentHeight: number,
  viewportHeight: number,
  trackHeight: number,
): ScrollbarThumbMetrics {
  if (totalContentHeight <= viewportHeight) {
    return { thumbHeight: trackHeight, thumbY: 0 };
  }
  const thumbHeight = Math.max(MIN_THUMB_HEIGHT, (viewportHeight / totalContentHeight) * trackHeight);
  const maxScroll = totalContentHeight - viewportHeight;
  const maxThumbY = trackHeight - thumbHeight;
  const thumbY = maxScroll > 0 ? clamp01(scrollOffset / maxScroll) * maxThumbY : 0;
  return { thumbHeight, thumbY };
}

/** Inverse of `scrollbarThumbMetrics`'s `thumbY` — converts a dragged thumb position back into a scroll offset. */
export function scrollOffsetForThumbY(
  thumbY: number,
  totalContentHeight: number,
  viewportHeight: number,
  trackHeight: number,
): number {
  if (totalContentHeight <= viewportHeight) return 0;
  const thumbHeight = Math.max(MIN_THUMB_HEIGHT, (viewportHeight / totalContentHeight) * trackHeight);
  const maxThumbY = trackHeight - thumbHeight;
  const maxScroll = totalContentHeight - viewportHeight;
  if (maxThumbY <= 0) return 0;
  return clampScrollOffset(clamp01(thumbY / maxThumbY) * maxScroll, totalContentHeight, viewportHeight);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
