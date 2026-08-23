import { describe, it, expect } from "vitest";
import { computeCornerControlsRegion } from "../src/game/systems/mainMenuLayout";

describe("computeCornerControlsRegion (D-154)", () => {
  it("matches the original hardcoded region at the current fixed canvas width (1280)", () => {
    // MainMenuScene.buildTitle used to hardcode `new Rectangle(980, 10, 260, 100)`
    // before this was parameterized by viewport width — pins the extraction
    // to that exact known-good baseline.
    expect(computeCornerControlsRegion(1280)).toEqual({ x: 980, y: 10, width: 260, height: 100 });
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
