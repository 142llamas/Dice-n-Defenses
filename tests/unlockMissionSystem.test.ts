import { describe, expect, it } from "vitest";
import {
  UNLOCK_MISSION_FLEX_SLOTS,
  defaultFlexPicks,
  eligibleFlexCompanions,
  resolveUnlockMissionCompanion,
} from "../src/game/systems/UnlockMissionSystem";
import { DEFAULT_COMPANION_ROSTER_STATE, type CompanionRosterState } from "../src/game/systems/CompanionRosterSystem";

/**
 * D-18x (KI-098 item 13, "a companion's own unlock mission must include
 * them" — Kevin's own clarified rule): a battle that would recruit a new
 * companion must include that companion in the party for the battle
 * itself, resolved here as pure logic so `CampaignSelectScene`/
 * `CompanionRosterScene`/`UnlockMissionPartyScene` all share one source of
 * truth for "is this an unlock mission, and who does it unlock."
 */

function stateWith(overrides: Partial<CompanionRosterState>): CompanionRosterState {
  return { ...DEFAULT_COMPANION_ROSTER_STATE, ...overrides };
}

describe("resolveUnlockMissionCompanion", () => {
  it("resolves a Pool A side mission id, regardless of chapterIndex, when that companion isn't yet recruited", () => {
    const companion = resolveUnlockMissionCompanion("side-brand-ashcairn", 0, DEFAULT_COMPANION_ROSTER_STATE);
    expect(companion?.id).toBe("brand-ashcairn");
    expect(resolveUnlockMissionCompanion("side-brand-ashcairn", 3, DEFAULT_COMPANION_ROSTER_STATE)?.id).toBe(
      "brand-ashcairn",
    );
  });

  it("returns undefined for a Pool A side mission once that companion is already recruited or lost", () => {
    expect(
      resolveUnlockMissionCompanion("side-brand-ashcairn", 0, stateWith({ activeIds: ["brand-ashcairn"] })),
    ).toBeUndefined();
    expect(
      resolveUnlockMissionCompanion("side-brand-ashcairn", 0, stateWith({ benchedIds: ["brand-ashcairn"] })),
    ).toBeUndefined();
    expect(
      resolveUnlockMissionCompanion("side-brand-ashcairn", 0, stateWith({ lostIds: ["brand-ashcairn"] })),
    ).toBeUndefined();
  });

  it("resolves a Pool B region's Chapter 1 (index 0) only, when that companion isn't yet recruited", () => {
    const companion = resolveUnlockMissionCompanion("emberford-reach", 0, DEFAULT_COMPANION_ROSTER_STATE);
    expect(companion?.id).toBe("tamsin-rourke");
    expect(resolveUnlockMissionCompanion("emberford-reach", 1, DEFAULT_COMPANION_ROSTER_STATE)).toBeUndefined();
    expect(resolveUnlockMissionCompanion("emberford-reach", 2, DEFAULT_COMPANION_ROSTER_STATE)).toBeUndefined();
    expect(resolveUnlockMissionCompanion("emberford-reach", 3, DEFAULT_COMPANION_ROSTER_STATE)).toBeUndefined();
  });

  it("returns undefined for a Pool B region's Chapter 1 once that companion is already recruited or lost", () => {
    expect(
      resolveUnlockMissionCompanion("emberford-reach", 0, stateWith({ benchedIds: ["tamsin-rourke"] })),
    ).toBeUndefined();
    expect(
      resolveUnlockMissionCompanion("drowning-vale", 0, stateWith({ lostIds: ["sorrel-thane"] })),
    ).toBeUndefined();
  });

  it("returns undefined for a non-companion campaign id (e.g. the Prologue) and an unknown id", () => {
    expect(resolveUnlockMissionCompanion("prologue", 0, DEFAULT_COMPANION_ROSTER_STATE)).toBeUndefined();
    expect(resolveUnlockMissionCompanion("nonexistent", 0, DEFAULT_COMPANION_ROSTER_STATE)).toBeUndefined();
  });
});

describe("eligibleFlexCompanions / defaultFlexPicks", () => {
  it("eligibleFlexCompanions excludes the target, and anyone not recruited or lost", () => {
    const roster = stateWith({
      activeIds: ["brand-ashcairn", "wren-calloway", "perrin-holt"],
      benchedIds: ["hollis-vane"],
      lostIds: ["sorrel-thane"],
    });
    const eligible = eligibleFlexCompanions(roster, "brand-ashcairn");
    expect(eligible).toContain("wren-calloway");
    expect(eligible).toContain("perrin-holt");
    expect(eligible).toContain("hollis-vane");
    expect(eligible).not.toContain("brand-ashcairn");
    expect(eligible).not.toContain("sorrel-thane");
    expect(eligible).not.toContain("mira-quill");
  });

  it("defaultFlexPicks prefers the current active roster, in slot order, excluding the target", () => {
    const roster = stateWith({ activeIds: ["mira-quill", "cass-ferrow", "ellery-vance"] });
    expect(defaultFlexPicks(roster, "mira-quill")).toEqual(["cass-ferrow", "ellery-vance"]);
  });

  it("defaultFlexPicks never returns more than UNLOCK_MISSION_FLEX_SLOTS ids", () => {
    const roster = stateWith({ activeIds: ["brand-ashcairn", "wren-calloway", "perrin-holt"] });
    expect(defaultFlexPicks(roster, "ellery-vance")).toHaveLength(UNLOCK_MISSION_FLEX_SLOTS);
  });

  it("defaultFlexPicks falls back to any other eligible (benched) companion when active alone isn't enough", () => {
    const roster = stateWith({ activeIds: ["brand-ashcairn"], benchedIds: ["hollis-vane"] });
    const picks = defaultFlexPicks(roster, "brand-ashcairn");
    expect(picks).toContain("hollis-vane");
    expect(picks).toHaveLength(1);
  });

  it("defaultFlexPicks returns an empty list when nobody else is recruited yet", () => {
    expect(defaultFlexPicks(DEFAULT_COMPANION_ROSTER_STATE, "brand-ashcairn")).toEqual([]);
  });
});
