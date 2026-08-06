import { describe, it, expect } from "vitest";
import { HERO_DEFINITIONS, HERO_COLORS } from "../src/game/data/heroes";
import { getAbility } from "../src/game/data/abilities";
import { TEST_MAP } from "../src/game/data/testMap";

/**
 * Phase 7 ("four hero archetypes") — locks down the shape of the roster so a
 * later change can't silently drop below the phase's party-size deliverable
 * (Source of Truth §9: "Final party size: two in MVP, four in vertical
 * slice") or leave a hero pointing at a missing ability/colour/start tile.
 */

describe("Phase 7 hero roster", () => {
  it("delivers exactly four heroes with unique ids", () => {
    expect(HERO_DEFINITIONS).toHaveLength(4);
    const ids = HERO_DEFINITIONS.map((h) => h.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("gives every hero a real ability and a display colour", () => {
    for (const hero of HERO_DEFINITIONS) {
      expect(() => getAbility(hero.abilityId)).not.toThrow();
      expect(HERO_COLORS[hero.id]).toBeDefined();
    }
  });

  it("gives the two new heroes (Bram, Mira) a spell-like, status-applying ability", () => {
    const bram = getAbility(HERO_DEFINITIONS.find((h) => h.id === "hero-bram")!.abilityId);
    const mira = getAbility(HERO_DEFINITIONS.find((h) => h.id === "hero-mira")!.abilityId);
    expect(bram.appliesStatus?.statusId).toBe("stunned");
    expect(mira.appliesStatus?.statusId).toBe("slowed");
  });

  it("the test map provides at least one hero-start tile per hero", () => {
    expect(TEST_MAP.heroStarts.length).toBeGreaterThanOrEqual(HERO_DEFINITIONS.length);
  });
});
