import { describe, it, expect } from "vitest";
import { SkillCheckSystem } from "../src/game/systems/SkillCheckSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { skillCheckModifier, isProficientInSkill } from "../src/game/data/skills";

/**
 * D-125: SkillCheckSystem mirrors SavingThrowSystem's dice resolution (see
 * tests/savingThrowSystem.test.ts) but WITHOUT a saving throw's natural-20/1
 * auto-succeed/fail carve-out — a plain ability/skill check has no such SRD
 * rule.
 */

describe("SkillCheckSystem.rollCheck", () => {
  it("succeeds when the total meets or beats the DC", () => {
    const result = SkillCheckSystem.rollCheck(5, 15, RandomService.fixed(10)); // 10 + 5 = 15
    expect(result.success).toBe(true);
    expect(result.total).toBe(15);
  });

  it("fails when the total falls short of the DC", () => {
    const result = SkillCheckSystem.rollCheck(2, 15, RandomService.fixed(10)); // 10 + 2 = 12
    expect(result.success).toBe(false);
  });

  it("a natural 20 does NOT auto-succeed against an unbeatable DC — unlike a saving throw", () => {
    const result = SkillCheckSystem.rollCheck(-5, 30, RandomService.fixed(20));
    expect(result.d20).toBe(20);
    expect(result.total).toBe(15);
    expect(result.success).toBe(false);
  });

  it("a natural 1 does NOT auto-fail against an easy DC — unlike a saving throw", () => {
    const result = SkillCheckSystem.rollCheck(20, 10, RandomService.fixed(1));
    expect(result.d20).toBe(1);
    expect(result.total).toBe(21);
    expect(result.success).toBe(true);
  });
});

describe("data/skills.ts proficiency (D-125)", () => {
  const scores = { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }; // +3 DEX

  it("isProficientInSkill matches SKILL_PROFICIENCIES_BY_CLASS exactly", () => {
    expect(isProficientInSkill("rogue", "stealth")).toBe(true);
    expect(isProficientInSkill("wizard", "stealth")).toBe(false);
    expect(isProficientInSkill(undefined, "stealth")).toBe(false);
  });

  it("skillCheckModifier adds the proficiency bonus only when proficient", () => {
    const proficient = skillCheckModifier(scores, "stealth", "rogue", 1); // +3 DEX + prof (2 at level 1)
    const notProficient = skillCheckModifier(scores, "stealth", "wizard", 1); // +3 DEX only
    expect(proficient).toBe(5);
    expect(notProficient).toBe(3);
  });

  it("skillCheckModifier's proficiency bonus scales with level, same as a saving throw", () => {
    const level1 = skillCheckModifier(scores, "stealth", "rogue", 1); // +3 + 2
    const level17 = skillCheckModifier(scores, "stealth", "rogue", 17); // +3 + 6
    expect(level1).toBe(5);
    expect(level17).toBe(9);
  });
});
