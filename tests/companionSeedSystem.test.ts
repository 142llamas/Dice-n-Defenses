import { describe, expect, it } from "vitest";
import { isDefaultCompanionRoster, seedStartingCompanions } from "../src/game/systems/CompanionSeedSystem";
import { DEFAULT_COMPANION_ROSTER_STATE, recruitCompanion, type CompanionRosterState } from "../src/game/systems/CompanionRosterSystem";
import { POOL_A_COMPANION_IDS, POOL_B_COMPANION_IDS } from "../src/game/data/companions";
import { RandomService } from "../src/game/systems/RandomService";

/**
 * KI-098 item 13 (companion roster/recruitment, Phase 1): the pure
 * "draw a random starting trio from Pool A" seeding rule.
 */

describe("isDefaultCompanionRoster", () => {
  it("true for the untouched default state", () => {
    expect(isDefaultCompanionRoster(DEFAULT_COMPANION_ROSTER_STATE)).toBe(true);
  });

  it("false once anything has been recruited, benched, or lost", () => {
    expect(isDefaultCompanionRoster(recruitCompanion(DEFAULT_COMPANION_ROSTER_STATE, POOL_A_COMPANION_IDS[0]))).toBe(false);
    const benched: CompanionRosterState = { activeIds: [], benchedIds: [POOL_A_COMPANION_IDS[0]], lostIds: [] };
    expect(isDefaultCompanionRoster(benched)).toBe(false);
    const lost: CompanionRosterState = { activeIds: [], benchedIds: [], lostIds: [POOL_A_COMPANION_IDS[0]] };
    expect(isDefaultCompanionRoster(lost)).toBe(false);
  });
});

describe("seedStartingCompanions", () => {
  it("draws exactly 3 distinct Pool A companions into activeIds from a default roster", () => {
    const next = seedStartingCompanions(DEFAULT_COMPANION_ROSTER_STATE, RandomService.seeded(42));
    expect(next.activeIds).toHaveLength(3);
    expect(new Set(next.activeIds).size).toBe(3);
    next.activeIds.forEach((id) => expect(POOL_A_COMPANION_IDS).toContain(id));
    expect(next.benchedIds).toEqual([]);
    expect(next.lostIds).toEqual([]);
  });

  it("never draws a Pool B (region-mirror) companion", () => {
    const next = seedStartingCompanions(DEFAULT_COMPANION_ROSTER_STATE, RandomService.seeded(7));
    next.activeIds.forEach((id) => expect(POOL_B_COMPANION_IDS).not.toContain(id));
  });

  it("is a no-op (same reference) on an already-seeded roster", () => {
    const seeded = seedStartingCompanions(DEFAULT_COMPANION_ROSTER_STATE, RandomService.seeded(1));
    const again = seedStartingCompanions(seeded, RandomService.seeded(2));
    expect(again).toBe(seeded);
  });

  it("is a no-op on a roster that already has any recruited/benched/lost companion, even if active is empty", () => {
    const partial: CompanionRosterState = { activeIds: [], benchedIds: [POOL_B_COMPANION_IDS[0]], lostIds: [] };
    expect(seedStartingCompanions(partial, RandomService.seeded(1))).toBe(partial);
  });

  it("different seeds can draw a different trio (not hardcoded to one order)", () => {
    const a = seedStartingCompanions(DEFAULT_COMPANION_ROSTER_STATE, RandomService.seeded(1)).activeIds;
    const b = seedStartingCompanions(DEFAULT_COMPANION_ROSTER_STATE, RandomService.seeded(2)).activeIds;
    // Not a strict guarantee for arbitrary seeds, but true for these two.
    expect([...a].sort()).not.toEqual([...b].sort());
  });
});
