import { describe, expect, it } from "vitest";
import { COMPANIONS, getCompanionDefinition } from "../src/game/data/companions";

/**
 * D-118 — companion catalogue engine scaffolding. Deliberately EMPTY today
 * (see companions.ts's own comment) — the six named companions
 * CAMPAIGN_STORY_DESIGN.md §6 describes are a separate, not-yet-done
 * writing pass. This just locks the current "declared, not yet consumed"
 * state and the lookup helper's contract, same treatment
 * `data/spriteManifest.ts` got in D-117.
 */
describe("COMPANIONS", () => {
  it("is empty until real companion content is authored", () => {
    expect(COMPANIONS).toEqual([]);
  });

  it("getCompanionDefinition throws on any id while the catalogue is empty", () => {
    expect(() => getCompanionDefinition("hollis-vane")).toThrow();
  });
});
