import { describe, it, expect } from "vitest";
import { computeCornerControlsRegion } from "../src/game/systems/mainMenuLayout";

describe("computeCornerControlsRegion (D-154)", () => {
  it("matches the current corner-control layout at the fixed canvas width (1280)", () => {
    // D-16x: Settings/Account both shifted down 16px (32->48, 88->104) so
    // Settings clears drawScreenBackdrop's frame border with real margin.
    expect(computeCornerControlsRegion(1280)).toEqual({ x: 980, y: 26, width: 260, height: 100 });
  });

  it("stays fully on-canvas and tracks the right edge at other viewport widths", () => {
    for (const width of [1920, 1366, 800]) {
      const region = computeCornerControlsRegion(width);
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(width);
      // The region is anchored to the right edge (where Settings/Account live).
      expect(region.x + region.width).toBe(width - 40);
    }
  });
});
