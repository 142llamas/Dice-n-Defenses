import { describe, expect, it } from "vitest";
import {
  SORREL_CHOICE_FLAG_IDS,
  SORREL_FATE_FLAG_ID,
  SORREL_REDEEMED_REWARD_EQUIPMENT_ID,
  SORREL_MARKED_GOLD_REWARD,
  recordSorrelChoice,
  resolveSorrelFate,
  isSorrelLost,
} from "../src/game/systems/SorrelFateSystem";
import { setWorldFlag, getWorldFlag, type WorldFlagState } from "../src/game/systems/WorldFlagSystem";
import { getEquipmentDefinition } from "../src/game/data/equipment";

/**
 * KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §6 — Sorrel Thane's Drowning
 * Vale branch chain: a choice recorded each of Chapters 1-3, converging by
 * Chapter 4 on Redeemed/Marked/Lost.
 */

const EMPTY_FLAGS: WorldFlagState = { flags: {} };

describe("recordSorrelChoice", () => {
  it("records a chapter's choice under its own flag id", () => {
    const flags = recordSorrelChoice(EMPTY_FLAGS, 0, "support");
    expect(getWorldFlag(flags, SORREL_CHOICE_FLAG_IDS[0])).toBe("support");
  });

  it("records each of the 3 chapters independently", () => {
    let flags = recordSorrelChoice(EMPTY_FLAGS, 0, "support");
    flags = recordSorrelChoice(flags, 1, "press");
    flags = recordSorrelChoice(flags, 2, "support");
    expect(getWorldFlag(flags, SORREL_CHOICE_FLAG_IDS[0])).toBe("support");
    expect(getWorldFlag(flags, SORREL_CHOICE_FLAG_IDS[1])).toBe("press");
    expect(getWorldFlag(flags, SORREL_CHOICE_FLAG_IDS[2])).toBe("support");
  });

  it("a replayed chapter overwrites its own earlier choice", () => {
    let flags = recordSorrelChoice(EMPTY_FLAGS, 0, "support");
    flags = recordSorrelChoice(flags, 0, "press");
    expect(getWorldFlag(flags, SORREL_CHOICE_FLAG_IDS[0])).toBe("press");
  });

  it("throws for any chapter index outside 0-2 (chapter 4 never records a choice)", () => {
    expect(() => recordSorrelChoice(EMPTY_FLAGS, 3, "support")).toThrow();
    expect(() => recordSorrelChoice(EMPTY_FLAGS, -1, "support")).toThrow();
  });
});

describe("resolveSorrelFate", () => {
  it("defaults to Marked when no choice was ever recorded (e.g. a pre-D-185 save)", () => {
    expect(resolveSorrelFate(EMPTY_FLAGS)).toBe("marked");
  });

  it("resolves Redeemed when support outnumbers press", () => {
    let flags = recordSorrelChoice(EMPTY_FLAGS, 0, "support");
    flags = recordSorrelChoice(flags, 1, "support");
    flags = recordSorrelChoice(flags, 2, "press");
    expect(resolveSorrelFate(flags)).toBe("redeemed");
  });

  it("resolves Lost when press outnumbers support", () => {
    let flags = recordSorrelChoice(EMPTY_FLAGS, 0, "press");
    flags = recordSorrelChoice(flags, 1, "press");
    flags = recordSorrelChoice(flags, 2, "support");
    expect(resolveSorrelFate(flags)).toBe("lost");
  });

  it("resolves Marked on a tie", () => {
    let flags = recordSorrelChoice(EMPTY_FLAGS, 0, "support");
    flags = recordSorrelChoice(flags, 1, "press");
    expect(resolveSorrelFate(flags)).toBe("marked");
  });

  it("all 3 support resolves Redeemed; all 3 press resolves Lost", () => {
    let redeemed = recordSorrelChoice(EMPTY_FLAGS, 0, "support");
    redeemed = recordSorrelChoice(redeemed, 1, "support");
    redeemed = recordSorrelChoice(redeemed, 2, "support");
    expect(resolveSorrelFate(redeemed)).toBe("redeemed");

    let lost = recordSorrelChoice(EMPTY_FLAGS, 0, "press");
    lost = recordSorrelChoice(lost, 1, "press");
    lost = recordSorrelChoice(lost, 2, "press");
    expect(resolveSorrelFate(lost)).toBe("lost");
  });

  it("does not itself write the fate flag — resolution is a pure read", () => {
    const flags = recordSorrelChoice(EMPTY_FLAGS, 0, "press");
    resolveSorrelFate(flags);
    expect(getWorldFlag(flags, SORREL_FATE_FLAG_ID)).toBeUndefined();
  });
});

describe("Redeemed/Marked reward constants (KI-098 item 13 continuation, D-185 addendum close)", () => {
  it("SORREL_REDEEMED_REWARD_EQUIPMENT_ID resolves to a real equipment definition", () => {
    expect(() => getEquipmentDefinition(SORREL_REDEEMED_REWARD_EQUIPMENT_ID)).not.toThrow();
  });

  it("SORREL_MARKED_GOLD_REWARD is real but strictly less than the Redeemed item's value — \"survived, not unscathed\"", () => {
    const redeemedValue = getEquipmentDefinition(SORREL_REDEEMED_REWARD_EQUIPMENT_ID).cost;
    expect(SORREL_MARKED_GOLD_REWARD).toBeGreaterThan(0);
    expect(SORREL_MARKED_GOLD_REWARD).toBeLessThan(redeemedValue);
  });
});

describe("isSorrelLost", () => {
  it("is false when the fate flag is unset", () => {
    expect(isSorrelLost(EMPTY_FLAGS)).toBe(false);
  });

  it("is true only when the fate flag is exactly \"lost\"", () => {
    const lost = setWorldFlag(EMPTY_FLAGS, SORREL_FATE_FLAG_ID, "lost");
    const redeemed = setWorldFlag(EMPTY_FLAGS, SORREL_FATE_FLAG_ID, "redeemed");
    expect(isSorrelLost(lost)).toBe(true);
    expect(isSorrelLost(redeemed)).toBe(false);
  });
});
