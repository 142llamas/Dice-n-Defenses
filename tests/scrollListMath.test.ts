import { describe, it, expect } from "vitest";
import {
  cumulativeOffsets,
  contentHeight,
  clampScrollOffset,
  visibleRowRange,
  scrollOffsetToReveal,
  scrollbarThumbMetrics,
  scrollOffsetForThumbY,
} from "../src/game/systems/ScrollListMath";

const UNIFORM = [50, 50, 50, 50, 50]; // 5 rows, offsets 0/60/120/180/240 at gap=10
const GAP = 10;

describe("cumulativeOffsets", () => {
  it("returns an empty array for no rows", () => {
    expect(cumulativeOffsets([], GAP)).toEqual([]);
  });

  it("stacks uniform rows with a gap between each", () => {
    expect(cumulativeOffsets(UNIFORM, GAP)).toEqual([0, 60, 120, 180, 240]);
  });

  it("handles variable row heights", () => {
    expect(cumulativeOffsets([20, 40, 30], GAP)).toEqual([0, 30, 80]);
  });
});

describe("contentHeight", () => {
  it("is 0 for no rows", () => {
    expect(contentHeight([], GAP)).toBe(0);
  });

  it("is just the row height for a single row (no trailing gap)", () => {
    expect(contentHeight([50], GAP)).toBe(50);
  });

  it("sums heights plus (n-1) gaps", () => {
    expect(contentHeight(UNIFORM, GAP)).toBe(250 + 40);
  });
});

describe("clampScrollOffset", () => {
  it("clamps negative offsets to 0", () => {
    expect(clampScrollOffset(-50, 300, 120)).toBe(0);
  });

  it("clamps past the max scroll to content height minus viewport", () => {
    expect(clampScrollOffset(1000, 300, 120)).toBe(180);
  });

  it("is always 0 when content fits entirely in the viewport", () => {
    expect(clampScrollOffset(50, 100, 120)).toBe(0);
  });

  it("passes through an in-range offset unchanged", () => {
    expect(clampScrollOffset(90, 300, 120)).toBe(90);
  });
});

describe("visibleRowRange", () => {
  const offsets = cumulativeOffsets(UNIFORM, GAP);

  it("returns an empty range for an empty list", () => {
    expect(visibleRowRange([], [], 0, 120)).toEqual({ start: 0, end: -1 });
  });

  it("finds the rows visible at the top of the list", () => {
    expect(visibleRowRange(offsets, UNIFORM, 0, 120)).toEqual({ start: 0, end: 1 });
  });

  it("scrolls past fully-hidden rows at the top", () => {
    // row 0 spans [0,50] — scrolling to 70 hides it entirely, so row 1 [60,110] becomes first.
    // Window is [70,190); row 3 [180,230] starts before 190 so it still counts as (partly) visible.
    expect(visibleRowRange(offsets, UNIFORM, 70, 120)).toEqual({ start: 1, end: 3 });
  });

  it("includes the last row when scrolled to the bottom", () => {
    expect(visibleRowRange(offsets, UNIFORM, 130, 120)).toEqual({ start: 2, end: 4 });
  });
});

describe("scrollOffsetToReveal", () => {
  const offsets = cumulativeOffsets(UNIFORM, GAP);

  it("does not move when the row is already fully visible", () => {
    expect(scrollOffsetToReveal(1, offsets, UNIFORM, 0, 120)).toBe(0);
  });

  it("scrolls up when the target row is above the viewport", () => {
    expect(scrollOffsetToReveal(0, offsets, UNIFORM, 100, 120)).toBe(0);
  });

  it("scrolls down when the target row is below the viewport", () => {
    // row 4 spans [240,290]; viewport [0,120) needs to move so 290 is the bottom edge.
    expect(scrollOffsetToReveal(4, offsets, UNIFORM, 0, 120)).toBe(170);
  });

  it("returns the current offset unchanged for an out-of-range index", () => {
    expect(scrollOffsetToReveal(99, offsets, UNIFORM, 42, 120)).toBe(42);
  });
});

describe("scrollbarThumbMetrics", () => {
  it("fills the whole track when content fits in the viewport", () => {
    expect(scrollbarThumbMetrics(0, 100, 200, 300)).toEqual({ thumbHeight: 300, thumbY: 0 });
  });

  it("sizes the thumb proportionally to the visible fraction", () => {
    // viewport is half the content, track is 300 -> thumb should be ~150.
    expect(scrollbarThumbMetrics(0, 400, 200, 300).thumbHeight).toBeCloseTo(150);
  });

  it("never shrinks the thumb below the minimum", () => {
    expect(scrollbarThumbMetrics(0, 100000, 50, 300).thumbHeight).toBeGreaterThanOrEqual(20);
  });

  it("places the thumb at the bottom of the track when scrolled to the max", () => {
    const metrics = scrollbarThumbMetrics(200, 400, 200, 300);
    expect(metrics.thumbY + metrics.thumbHeight).toBeCloseTo(300);
  });
});

describe("scrollOffsetForThumbY", () => {
  it("is the inverse of scrollbarThumbMetrics", () => {
    const totalContentHeight = 400;
    const viewportHeight = 200;
    const trackHeight = 300;
    for (const original of [0, 50, 120, 200]) {
      const { thumbY } = scrollbarThumbMetrics(original, totalContentHeight, viewportHeight, trackHeight);
      expect(scrollOffsetForThumbY(thumbY, totalContentHeight, viewportHeight, trackHeight)).toBeCloseTo(original, 0);
    }
  });

  it("is always 0 when content fits in the viewport", () => {
    expect(scrollOffsetForThumbY(150, 100, 200, 300)).toBe(0);
  });
});
