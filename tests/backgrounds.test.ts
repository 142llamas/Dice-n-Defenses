import { describe, it, expect } from "vitest";
import {
  BACKGROUND_IDS,
  SRD_BACKGROUND_IDS,
  ORIGINAL_BACKGROUND_IDS,
  getBackgroundDefinition,
  backgroundAbilityChoices,
} from "../src/game/data/backgrounds";
import { FEAT_IDS } from "../src/game/data/feats";
import { SKILL_ORDER } from "../src/game/data/skills";
import { ABILITY_SCORE_IDS } from "../src/game/data/abilityScores";

/**
 * Phase 2.5 (2026-08-28 playtest batch), D-206. The SRD 5.2.1 (CC BY 4.0)
 * contains exactly 4 backgrounds — Acolyte, Criminal, Sage, Soldier — NOT
 * the full 2024 PHB's sixteen (verified directly against dndbeyond.com's own
 * SRD changelog before writing any of this, per
 * `feedback_verify_srd_content_dont_assume`). The other 6 are original
 * content, Kevin's explicit direction.
 */

describe("BACKGROUNDS", () => {
  it("has exactly 4 real SRD backgrounds plus 6 original ones", () => {
    expect(SRD_BACKGROUND_IDS.sort()).toEqual(["acolyte", "criminal", "sage", "soldier"].sort());
    expect(ORIGINAL_BACKGROUND_IDS).toHaveLength(6);
    expect(BACKGROUND_IDS).toHaveLength(10);
    expect(new Set([...SRD_BACKGROUND_IDS, ...ORIGINAL_BACKGROUND_IDS])).toEqual(new Set(BACKGROUND_IDS));
  });

  it("every background's 2 skillIds are real, known skills", () => {
    BACKGROUND_IDS.forEach((id) => {
      const bg = getBackgroundDefinition(id);
      expect(bg.skillIds).toHaveLength(2);
      bg.skillIds.forEach((skillId) => expect(SKILL_ORDER as readonly string[]).toContain(skillId));
    });
  });

  it("every background's abilityTriad has exactly 3 distinct real abilities", () => {
    BACKGROUND_IDS.forEach((id) => {
      const bg = getBackgroundDefinition(id);
      expect(bg.abilityTriad).toHaveLength(3);
      expect(new Set(bg.abilityTriad).size).toBe(3);
      bg.abilityTriad.forEach((a) => expect(ABILITY_SCORE_IDS).toContain(a));
    });
  });

  it("every background's originFeatId is a real, known feat", () => {
    BACKGROUND_IDS.forEach((id) => {
      expect(FEAT_IDS).toContain(getBackgroundDefinition(id).originFeatId);
    });
  });

  it("only the two Magic-Initiate-granting backgrounds set magicInitiateList, and never the same list twice", () => {
    const withList = BACKGROUND_IDS.filter((id) => getBackgroundDefinition(id).magicInitiateList);
    const lists = withList.map((id) => getBackgroundDefinition(id).magicInitiateList);
    withList.forEach((id) => expect(getBackgroundDefinition(id).originFeatId).toBe("magic-initiate"));
    expect(new Set(lists).size).toBe(lists.length);
  });

  it("Acolyte/Sage/Soldier match the verified real SRD data exactly", () => {
    expect(getBackgroundDefinition("acolyte")).toMatchObject({
      skillIds: ["insight", "religion"],
      abilityTriad: ["int", "wis", "cha"],
      originFeatId: "magic-initiate",
      magicInitiateList: "cleric",
    });
    expect(getBackgroundDefinition("sage")).toMatchObject({
      skillIds: ["arcana", "history"],
      abilityTriad: ["con", "int", "wis"],
      originFeatId: "magic-initiate",
      magicInitiateList: "wizard",
    });
    expect(getBackgroundDefinition("soldier")).toMatchObject({
      skillIds: ["athletics", "intimidation"],
      abilityTriad: ["str", "dex", "con"],
      originFeatId: "savage-attacker",
    });
  });

  it("throws on an unknown background id", () => {
    expect(() => getBackgroundDefinition("guard")).toThrow();
  });
});

describe("backgroundAbilityChoices", () => {
  it("produces 7 combinations for a 3-ability triad: every +2/+1 ordered pair, plus +1/+1/+1", () => {
    const choices = backgroundAbilityChoices(["str", "dex", "con"]);
    expect(choices).toHaveLength(7);
    expect(choices).toContainEqual({ str: 2, dex: 1 });
    expect(choices).toContainEqual({ con: 2, str: 1 });
    expect(choices).toContainEqual({ str: 1, dex: 1, con: 1 });
  });

  it("every +2/+1 combination totals 3 points, and the +1/+1/+1 one also totals 3", () => {
    const choices = backgroundAbilityChoices(["str", "dex", "con"]);
    choices.forEach((c) => {
      const total = Object.values(c).reduce((sum, n) => sum + (n ?? 0), 0);
      expect(total).toBe(3);
    });
  });
});
