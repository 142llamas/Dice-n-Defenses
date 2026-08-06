import { describe, it, expect } from "vitest";
import { averagePartyLevel, isRarityUnlockedAtLevel } from "../src/game/systems/ShopSystem";

/**
 * Phase 22 (magic-item expansion): "the shop should also have some magical
 * items, but based on the level of the party" — Kevin's own spec. Mundane
 * gear (common/uncommon) stays visible at every level; rare-and-up magic
 * items unlock progressively as the party's average class level rises.
 */

describe("averagePartyLevel", () => {
  it("averages a party's class levels, rounded down", () => {
    expect(averagePartyLevel([1, 1, 1, 1])).toBe(1);
    expect(averagePartyLevel([4, 5, 6, 5])).toBe(5);
    expect(averagePartyLevel([4, 5])).toBe(4); // 4.5 rounds down
  });

  it("defaults to 1 for an empty party (never NaN)", () => {
    expect(averagePartyLevel([])).toBe(1);
  });
});

describe("isRarityUnlockedAtLevel", () => {
  it("common and uncommon are always unlocked, even at level 1", () => {
    expect(isRarityUnlockedAtLevel("common", 1)).toBe(true);
    expect(isRarityUnlockedAtLevel("uncommon", 1)).toBe(true);
  });

  it("rare requires level 4+", () => {
    expect(isRarityUnlockedAtLevel("rare", 3)).toBe(false);
    expect(isRarityUnlockedAtLevel("rare", 4)).toBe(true);
  });

  it("veryRare requires level 8+", () => {
    expect(isRarityUnlockedAtLevel("veryRare", 7)).toBe(false);
    expect(isRarityUnlockedAtLevel("veryRare", 8)).toBe(true);
  });

  it("legendary requires level 13+", () => {
    expect(isRarityUnlockedAtLevel("legendary", 12)).toBe(false);
    expect(isRarityUnlockedAtLevel("legendary", 13)).toBe(true);
  });
});
