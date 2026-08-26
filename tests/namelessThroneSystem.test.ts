import { describe, expect, it } from "vitest";
import {
  resolveThroneVariant,
  withThroneVariant,
  withThroneEnemyReskins,
} from "../src/game/systems/NamelessThroneSystem";
import { SPARABLE_MINIBOSS_CHAPTERS, sparedFlagId } from "../src/game/systems/ReturningMinibossSystem";
import { SORREL_FATE_FLAG_ID } from "../src/game/systems/SorrelFateSystem";
import { setWorldFlag, type WorldFlagState } from "../src/game/systems/WorldFlagSystem";
import { NAMELESS_THRONE_MAP, NAMELESS_THRONE_HAZARD_POSITIONS } from "../src/game/data/namelessThroneMap";
import type { WaveDefinition } from "../src/game/data/waves";

/**
 * D-188 (CAMPAIGN_STORY_DESIGN.md §5): the campaign capstone's own ending
 * resolver and its two "same fixed grid/wave list, branch-swapped dressing"
 * helpers — mirrors `returningMinibossSystem.test.ts`'s structure.
 */

const EMPTY_FLAGS: WorldFlagState = { flags: {} };
const MINIBOSS_IDS = Object.values(SPARABLE_MINIBOSS_CHAPTERS);

function spareAll(ids: readonly string[]): WorldFlagState {
  let flags = EMPTY_FLAGS;
  for (const id of ids) flags = setWorldFlag(flags, sparedFlagId(id), true);
  return flags;
}

describe("resolveThroneVariant", () => {
  it("resolves to Hollow when nothing was spared and Sorrel's fate wasn't recorded (5 not-spared vs. 0 spared is not a tie)", () => {
    expect(resolveThroneVariant(EMPTY_FLAGS)).toBe("the-hollow-empress");
  });

  it("resolves to Ashen when every miniboss was spared", () => {
    expect(resolveThroneVariant(spareAll(MINIBOSS_IDS))).toBe("ashen-sovereign");
  });

  it("resolves to Ashen when a majority were spared", () => {
    expect(resolveThroneVariant(spareAll(MINIBOSS_IDS.slice(0, 3)))).toBe("ashen-sovereign");
  });

  it("resolves to Hollow when a majority were not spared", () => {
    expect(resolveThroneVariant(spareAll(MINIBOSS_IDS.slice(0, 2)))).toBe("the-hollow-empress");
  });

  it("Sorrel Redeemed nudges a genuine tie to Ashen", () => {
    let flags = spareAll(MINIBOSS_IDS.slice(0, 2)); // 2 ashen, 3 hollow
    flags = setWorldFlag(flags, SORREL_FATE_FLAG_ID, "redeemed"); // 3 ashen, 3 hollow -> tie
    expect(resolveThroneVariant(flags)).toBe("ashen-sovereign");
  });

  it("Sorrel Lost still resolves a genuine tie to Ashen (the tie-break, not the signal, decides it)", () => {
    let flags = spareAll(MINIBOSS_IDS.slice(0, 3)); // 3 ashen, 2 hollow
    flags = setWorldFlag(flags, SORREL_FATE_FLAG_ID, "lost"); // 3 ashen, 3 hollow -> tie
    expect(resolveThroneVariant(flags)).toBe("ashen-sovereign");
  });

  it("Sorrel Lost tips a near-even split to Hollow when it's not a tie", () => {
    let flags = spareAll(MINIBOSS_IDS.slice(0, 2)); // 2 ashen, 3 hollow
    flags = setWorldFlag(flags, SORREL_FATE_FLAG_ID, "lost"); // 2 ashen, 4 hollow
    expect(resolveThroneVariant(flags)).toBe("the-hollow-empress");
  });

  it("Sorrel Marked is neutral — same result as if her fate were never recorded", () => {
    let flags = spareAll(MINIBOSS_IDS.slice(0, 2)); // 2 ashen, 3 hollow
    flags = setWorldFlag(flags, SORREL_FATE_FLAG_ID, "marked");
    expect(resolveThroneVariant(flags)).toBe("the-hollow-empress");
  });
});

describe("withThroneVariant", () => {
  it("returns the SAME map reference for the Ashen variant (the base map is already Ashen-dressed)", () => {
    expect(withThroneVariant(NAMELESS_THRONE_MAP, "ashen-sovereign")).toBe(NAMELESS_THRONE_MAP);
  });

  it("swaps exactly the 4 hazard positions to water for the Hollow variant, and nothing else", () => {
    const swapped = withThroneVariant(NAMELESS_THRONE_MAP, "the-hollow-empress");
    for (const pos of NAMELESS_THRONE_HAZARD_POSITIONS) {
      expect(swapped.tiles[pos.y][pos.x]).toBe("water");
    }
    for (let y = 0; y < NAMELESS_THRONE_MAP.rows; y++) {
      for (let x = 0; x < NAMELESS_THRONE_MAP.cols; x++) {
        const isHazard = NAMELESS_THRONE_HAZARD_POSITIONS.some((p) => p.x === x && p.y === y);
        if (!isHazard) expect(swapped.tiles[y][x]).toBe(NAMELESS_THRONE_MAP.tiles[y][x]);
      }
    }
  });

  it("never mutates the input map's tiles", () => {
    const before = JSON.parse(JSON.stringify(NAMELESS_THRONE_MAP.tiles));
    withThroneVariant(NAMELESS_THRONE_MAP, "the-hollow-empress");
    expect(NAMELESS_THRONE_MAP.tiles).toEqual(before);
  });
});

describe("withThroneEnemyReskins", () => {
  const waves: WaveDefinition[] = [
    { id: "w1", spawns: [{ enemyId: "runner", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10 },
    {
      id: "w2",
      spawns: [
        { enemyId: "ember-thane", count: 2, startTurn: 1, intervalTurns: 1 },
        { enemyId: "cinder-adept", count: 1, startTurn: 3, intervalTurns: 1 },
      ],
      completionGold: 20,
    },
    {
      id: "w3",
      spawns: [
        { enemyId: "ashbound-honor-guard", count: 1, startTurn: 2, intervalTurns: 1 },
        { enemyId: "ashen-sovereign", count: 1, startTurn: 5, intervalTurns: 1 },
      ],
      completionGold: 90,
    },
  ];

  it("returns the SAME waves array reference for the Ashen variant", () => {
    expect(withThroneEnemyReskins(waves, "ashen-sovereign")).toBe(waves);
  });

  it("swaps every Ashen reskin/boss id to its Hollow counterpart", () => {
    const swapped = withThroneEnemyReskins(waves, "the-hollow-empress");
    expect(swapped[1].spawns[0].enemyId).toBe("drowned-thane");
    expect(swapped[1].spawns[1].enemyId).toBe("hollow-caller");
    expect(swapped[2].spawns[0].enemyId).toBe("drowned-honor-captain");
    expect(swapped[2].spawns[1].enemyId).toBe("the-hollow-empress");
  });

  it("leaves an untouched wave shared by reference", () => {
    const swapped = withThroneEnemyReskins(waves, "the-hollow-empress");
    expect(swapped[0]).toBe(waves[0]);
  });

  it("never mutates the input waves array or any of its nested objects", () => {
    const before = JSON.parse(JSON.stringify(waves));
    withThroneEnemyReskins(waves, "the-hollow-empress");
    expect(waves).toEqual(before);
  });

  it("preserves every other field on a changed wave and spawn group", () => {
    const swapped = withThroneEnemyReskins(waves, "the-hollow-empress");
    expect(swapped[1].id).toBe("w2");
    expect(swapped[1].completionGold).toBe(20);
    expect(swapped[1].spawns[0].count).toBe(2);
    expect(swapped[1].spawns[1].startTurn).toBe(3);
  });
});
