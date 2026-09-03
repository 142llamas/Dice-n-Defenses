import { describe, it, expect } from "vitest";
import { computeCornerControlsRegion } from "../src/game/systems/mainMenuLayout";

describe("computeCornerControlsRegion (D-154)", () => {
  it("matches the current corner-control layout at the fixed canvas width (1280)", () => {
    // D-217: Settings/Account shrank from 260x44 text buttons to 44x44 icon
    // buttons (item 7), right edge held at viewportWidth - 40.
    expect(computeCornerControlsRegion(1280)).toEqual({ x: 1196, y: 26, width: 44, height: 100 });
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
