import { describe, it, expect } from "vitest";
import { isProficientWithHandsItem } from "../src/game/systems/ProficiencySystem";

// A simple weapon (no exceptions needed — universal), a blanket-martial
// weapon with no finesse/light property, and a real shield/focus/non-hands
// item, used across every class's table below.
const SIMPLE_WEAPON = "dagger";
const PLAIN_MARTIAL_WEAPON = "greatsword"; // heavy, twoHanded — no finesse/light
const SHIELD = "shield";
const FOCUS = "arcane-focus";
const NON_HANDS_ITEM = "leather-cap";

describe("isProficientWithHandsItem — universal cases", () => {
  it("every class is proficient with a Simple weapon", () => {
    for (const classId of ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"]) {
      expect(isProficientWithHandsItem(classId, SIMPLE_WEAPON)).toBe(true);
    }
  });

  it("every class is proficient with a real Shield — no shield-proficiency system exists", () => {
    for (const classId of ["wizard", "barbarian", "monk"]) {
      expect(isProficientWithHandsItem(classId, SHIELD)).toBe(true);
    }
  });

  it("every class is proficient with a non-hands item (nothing to gate)", () => {
    for (const classId of ["wizard", "barbarian", "rogue"]) {
      expect(isProficientWithHandsItem(classId, NON_HANDS_ITEM)).toBe(true);
    }
  });
});

describe("isProficientWithHandsItem — full martial classes", () => {
  it.each(["barbarian", "fighter", "paladin", "ranger"])("%s is proficient with any martial weapon", (classId) => {
    expect(isProficientWithHandsItem(classId, PLAIN_MARTIAL_WEAPON)).toBe(true);
  });
});

describe("isProficientWithHandsItem — Simple-only classes", () => {
  it.each(["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"])(
    "%s is NOT proficient with a plain martial weapon",
    (classId) => {
      expect(isProficientWithHandsItem(classId, PLAIN_MARTIAL_WEAPON)).toBe(false);
    },
  );
});

describe("isProficientWithHandsItem — Monk's Light-property exception", () => {
  it("is proficient with a martial weapon that has the Light property", () => {
    expect(isProficientWithHandsItem("monk", "shortsword")).toBe(true); // martial, finesse+light
  });

  it("is NOT proficient with a martial weapon lacking Light", () => {
    expect(isProficientWithHandsItem("monk", PLAIN_MARTIAL_WEAPON)).toBe(false);
    expect(isProficientWithHandsItem("monk", "rapier")).toBe(false); // finesse only, no light
  });
});

describe("isProficientWithHandsItem — Rogue's Finesse-or-Light exception", () => {
  it("is proficient with a martial weapon that has Finesse (even without Light)", () => {
    expect(isProficientWithHandsItem("rogue", "rapier")).toBe(true);
  });

  it("is proficient with a martial weapon that has Light (even without Finesse)", () => {
    expect(isProficientWithHandsItem("rogue", "shortsword")).toBe(true);
  });

  it("is NOT proficient with a martial weapon with neither property", () => {
    expect(isProficientWithHandsItem("rogue", PLAIN_MARTIAL_WEAPON)).toBe(false);
  });
});

describe("isProficientWithHandsItem — spellcasting focus gating", () => {
  it.each(["wizard", "sorcerer", "cleric", "druid", "bard", "warlock", "paladin", "ranger"])(
    "%s (a caster) is proficient with a spellcasting focus",
    (classId) => {
      expect(isProficientWithHandsItem(classId, FOCUS)).toBe(true);
    },
  );

  it.each(["fighter", "barbarian", "rogue", "monk"])("%s (not a caster) is NOT proficient with a spellcasting focus", (classId) => {
    expect(isProficientWithHandsItem(classId, FOCUS)).toBe(false);
  });
});
