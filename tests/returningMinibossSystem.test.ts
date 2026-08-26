import { describe, expect, it } from "vitest";
import {
  SALTMERE_FALLBACK_ENEMY_ID,
  CORRUPTED_SORREL_ENEMY_ID,
  SPARABLE_MINIBOSS_CHAPTERS,
  SPARE_MERCY_GOLD_REWARD,
  resolveSaltmereCh1Enemy,
  sparedFlagId,
  withReturningMinibossSwap,
} from "../src/game/systems/ReturningMinibossSystem";
import { setWorldFlag, type WorldFlagState } from "../src/game/systems/WorldFlagSystem";
import { SORREL_FATE_FLAG_ID } from "../src/game/systems/SorrelFateSystem";
import { CAMPAIGNS } from "../src/game/data/campaigns";
import type { WaveDefinition } from "../src/game/data/waves";

/**
 * KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §4 — the returning-miniboss
 * mechanic: Saltmere Shallows Ch1 spawns whichever earlier-region miniboss
 * the player spared, or the nameless tide-wretch fallback.
 */

const EMPTY_FLAGS: WorldFlagState = { flags: {} };

describe("SPARABLE_MINIBOSS_CHAPTERS", () => {
  it("every mapped chapter id is a real chapter in its campaign", () => {
    const allChapterIds = CAMPAIGNS.flatMap((c) => (c.chapters ?? []).map((ch) => ch.id));
    for (const chapterId of Object.keys(SPARABLE_MINIBOSS_CHAPTERS)) {
      expect(allChapterIds, chapterId).toContain(chapterId);
    }
  });

  it("every mapped enemy id matches that chapter's actual bossEnemyId", () => {
    const chapterById = new Map(CAMPAIGNS.flatMap((c) => (c.chapters ?? []).map((ch) => [ch.id, ch] as const)));
    for (const [chapterId, enemyId] of Object.entries(SPARABLE_MINIBOSS_CHAPTERS)) {
      expect(chapterById.get(chapterId)?.bossEnemyId, chapterId).toBe(enemyId);
    }
  });
});

describe("SPARE_MERCY_GOLD_REWARD", () => {
  // KI-098 item 13 continuation: real, bounded mechanical weight for the
  // Finish/Spare choice — a positive, modest amount, not tiered per-region
  // (every "home" Ch1 spans the same level band, 1-5, across all 6 regions).
  it("is a positive, modest flat amount", () => {
    expect(SPARE_MERCY_GOLD_REWARD).toBeGreaterThan(0);
    expect(SPARE_MERCY_GOLD_REWARD).toBeLessThanOrEqual(50);
  });
});

describe("sparedFlagId", () => {
  it("namespaces the enemy id", () => {
    expect(sparedFlagId("basalt-colossus")).toBe("spared:basalt-colossus");
  });
});

describe("resolveSaltmereCh1Enemy", () => {
  it("falls back to the nameless tide-wretch when nothing was spared", () => {
    expect(resolveSaltmereCh1Enemy(EMPTY_FLAGS)).toEqual({ enemyId: SALTMERE_FALLBACK_ENEMY_ID, isReturning: false });
  });

  it("resolves to the one spared miniboss when exactly one flag is set", () => {
    const flags = setWorldFlag(EMPTY_FLAGS, sparedFlagId("gravemaw"), true);
    expect(resolveSaltmereCh1Enemy(flags)).toEqual({ enemyId: "gravemaw", isReturning: true });
  });

  it("prefers the earliest region when multiple minibosses were spared", () => {
    let flags = setWorldFlag(EMPTY_FLAGS, sparedFlagId("bloodrage-warlord"), true); // region 6
    flags = setWorldFlag(flags, sparedFlagId("juggernaut"), true); // region 2
    flags = setWorldFlag(flags, sparedFlagId("the-husk"), true); // region 4
    expect(resolveSaltmereCh1Enemy(flags)).toEqual({ enemyId: "juggernaut", isReturning: true });
  });

  it("ignores a flag explicitly set to false", () => {
    const flags = setWorldFlag(EMPTY_FLAGS, sparedFlagId("basalt-colossus"), false);
    expect(resolveSaltmereCh1Enemy(flags)).toEqual({ enemyId: SALTMERE_FALLBACK_ENEMY_ID, isReturning: false });
  });

  // D-185: Sorrel Thane's own Lost outcome takes this slot outright, ahead
  // of every spared miniboss and the fallback.
  it("resolves to the corrupted-Sorrel encounter when she's Lost, even with no miniboss spared", () => {
    const flags = setWorldFlag(EMPTY_FLAGS, SORREL_FATE_FLAG_ID, "lost");
    expect(resolveSaltmereCh1Enemy(flags)).toEqual({ enemyId: CORRUPTED_SORREL_ENEMY_ID, isReturning: true });
  });

  it("prefers a Lost Sorrel over a spared miniboss, regardless of region order", () => {
    let flags = setWorldFlag(EMPTY_FLAGS, sparedFlagId("basalt-colossus"), true); // region 1, earliest
    flags = setWorldFlag(flags, SORREL_FATE_FLAG_ID, "lost");
    expect(resolveSaltmereCh1Enemy(flags)).toEqual({ enemyId: CORRUPTED_SORREL_ENEMY_ID, isReturning: true });
  });

  it("falls through to the normal spared-miniboss logic when Sorrel's fate is Redeemed or Marked", () => {
    let flags = setWorldFlag(EMPTY_FLAGS, sparedFlagId("gravemaw"), true);
    flags = setWorldFlag(flags, SORREL_FATE_FLAG_ID, "redeemed");
    expect(resolveSaltmereCh1Enemy(flags)).toEqual({ enemyId: "gravemaw", isReturning: true });
  });
});

describe("withReturningMinibossSwap", () => {
  const waves: WaveDefinition[] = [
    { id: "w1", spawns: [{ enemyId: "runner", count: 3, startTurn: 1, intervalTurns: 1 }], completionGold: 10 },
    {
      id: "w2",
      spawns: [
        { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
        { enemyId: SALTMERE_FALLBACK_ENEMY_ID, count: 1, startTurn: 3, intervalTurns: 1 },
      ],
      completionGold: 20,
    },
  ];

  it("returns the same array reference (no clone) when resolving to the fallback id", () => {
    expect(withReturningMinibossSwap(waves, SALTMERE_FALLBACK_ENEMY_ID)).toBe(waves);
  });

  it("swaps the tide-wretch spawn group's enemyId to the resolved miniboss", () => {
    const swapped = withReturningMinibossSwap(waves, "gravemaw");
    expect(swapped[1].spawns[1].enemyId).toBe("gravemaw");
    expect(swapped[1].spawns[0].enemyId).toBe("grunt");
    expect(swapped[0]).toBe(waves[0]); // untouched wave stays shared by reference
  });

  it("never mutates the input waves array or any of its nested objects", () => {
    const before = JSON.parse(JSON.stringify(waves));
    withReturningMinibossSwap(waves, "juggernaut");
    expect(waves).toEqual(before);
  });

  it("preserves every other field on the changed wave and spawn group", () => {
    const swapped = withReturningMinibossSwap(waves, "the-husk");
    expect(swapped[1].id).toBe("w2");
    expect(swapped[1].completionGold).toBe(20);
    expect(swapped[1].spawns[1].count).toBe(1);
    expect(swapped[1].spawns[1].startTurn).toBe(3);
  });
});
