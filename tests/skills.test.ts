import { describe, it, expect } from "vitest";
import { SKILLS, SKILL_ORDER, getSkillDefinition, skillModifier } from "../src/game/data/skills";
import type { AbilityScores } from "../src/game/data/abilityScores";

/**
 * Phase 13.5 (DECISIONS D-090): a slim, reference-only skill list — nothing
 * in this game calls a skill check yet, so these tests cover the data and
 * the one pure helper (`skillModifier`), same "framework only" treatment as
 * InitiativeSystem.
 */

describe("SKILL_ORDER / SKILLS", () => {
  it("every id in SKILL_ORDER has a matching definition", () => {
    for (const id of SKILL_ORDER) {
      expect(SKILLS[id]).toBeDefined();
      expect(SKILLS[id].id).toBe(id);
    }
  });

  it("covers five of the six abilities (Constitution genuinely has no SRD skills)", () => {
    const abilities = new Set(SKILL_ORDER.map((id) => SKILLS[id].ability));
    expect(abilities.has("con")).toBe(false);
    expect(abilities.size).toBe(5);
  });
});

describe("getSkillDefinition", () => {
  it("looks up a known skill", () => {
    expect(getSkillDefinition("stealth").ability).toBe("dex");
  });

  it("throws on an unknown id", () => {
    expect(() => getSkillDefinition("juggling")).toThrow();
  });
});

describe("skillModifier", () => {
  const scores: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

  it("reads the governing ability's modifier for a given skill", () => {
    expect(skillModifier(scores, "athletics")).toBe(2); // STR 15 -> +2
    expect(skillModifier(scores, "stealth")).toBe(2); // DEX 14 -> +2
    expect(skillModifier(scores, "persuasion")).toBe(-1); // CHA 8 -> -1
  });

  it("throws on an unknown skill id", () => {
    expect(() => skillModifier(scores, "not-a-skill")).toThrow();
  });
});
