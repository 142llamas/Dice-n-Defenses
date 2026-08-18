import { describe, it, expect } from "vitest";
import {
  spellEconomyForClass,
  preparedSpellCountForClassAtLevel,
  canSwapLeveledSpellAt,
  canSwapCantripAt,
  wizardSpellbookSizeAtLevel,
  eligibleCantripPool,
  eligibleLeveledSpellPool,
  isValidSelection,
  defaultFill,
  spellPickStepsForClass,
  spellSwapStepsForClass,
  preparedSwapIsFullRelist,
  maxCastableSpellLevel,
} from "../src/game/systems/SpellPreparationSystem";

/**
 * D-134: SRD 5.2.1's real spell-preparation economy — verified against the
 * source (not assumed from 2014-era memory; see DECISIONS.md's D-134 for
 * the full research trail). Every class "prepares" now; they differ only
 * in swap cadence (full relist / replace-one-per-Long-Rest /
 * replace-one-per-level-up), modeled here as exactly two mechanisms.
 */

describe("spellEconomyForClass", () => {
  it("is undefined for a non-caster", () => {
    expect(spellEconomyForClass("fighter")).toBeUndefined();
    expect(spellEconomyForClass("rogue")).toBeUndefined();
  });

  it("is defined for all 8 caster classes", () => {
    for (const id of ["wizard", "cleric", "druid", "paladin", "ranger", "sorcerer", "bard", "warlock"]) {
      expect(spellEconomyForClass(id)).toBeDefined();
    }
  });
});

describe("preparedSpellCountForClassAtLevel (verified SRD 5.2.1 tables)", () => {
  it("Wizard's own table", () => {
    expect(preparedSpellCountForClassAtLevel("wizard", 1)).toBe(4);
    expect(preparedSpellCountForClassAtLevel("wizard", 5)).toBe(9);
    expect(preparedSpellCountForClassAtLevel("wizard", 20)).toBe(26);
  });

  it("Cleric/Druid/Sorcerer/Bard share one identical table", () => {
    for (const id of ["cleric", "druid", "sorcerer", "bard"]) {
      expect(preparedSpellCountForClassAtLevel(id, 1)).toBe(4);
      expect(preparedSpellCountForClassAtLevel(id, 9)).toBe(14);
      expect(preparedSpellCountForClassAtLevel(id, 20)).toBe(22);
    }
  });

  it("Paladin/Ranger share one identical half-caster table, starting at level 1 (D-134: SRD 5.2.1 moved this earlier than 2014's level 2)", () => {
    for (const id of ["paladin", "ranger"]) {
      expect(preparedSpellCountForClassAtLevel(id, 1)).toBe(2);
      expect(preparedSpellCountForClassAtLevel(id, 20)).toBe(15);
    }
  });

  it("Warlock's own table", () => {
    expect(preparedSpellCountForClassAtLevel("warlock", 1)).toBe(2);
    expect(preparedSpellCountForClassAtLevel("warlock", 10)).toBe(10);
    expect(preparedSpellCountForClassAtLevel("warlock", 20)).toBe(15);
  });

  it("is 0 for a non-caster at any level", () => {
    expect(preparedSpellCountForClassAtLevel("fighter", 20)).toBe(0);
  });

  it("only ever grows level over level, never shrinks, for every class", () => {
    for (const id of ["wizard", "cleric", "druid", "sorcerer", "bard", "paladin", "ranger", "warlock"]) {
      let previous = 0;
      for (let level = 1; level <= 20; level++) {
        const count = preparedSpellCountForClassAtLevel(id, level);
        expect(count).toBeGreaterThanOrEqual(previous);
        previous = count;
      }
    }
  });

  it("throws on an invalid level", () => {
    expect(() => preparedSpellCountForClassAtLevel("wizard", 0)).toThrow();
    expect(() => preparedSpellCountForClassAtLevel("wizard", 21)).toThrow();
  });
});

describe("canSwapLeveledSpellAt (the three-tier swap cadence)", () => {
  it("full-relist classes (Wizard/Cleric/Druid) only swap at Long Rest", () => {
    for (const id of ["wizard", "cleric", "druid"]) {
      expect(canSwapLeveledSpellAt(id, "longRest")).toBe(true);
      expect(canSwapLeveledSpellAt(id, "levelUp")).toBe(false);
    }
  });

  it("replace-one-per-Long-Rest classes (Paladin/Ranger) only swap at Long Rest", () => {
    for (const id of ["paladin", "ranger"]) {
      expect(canSwapLeveledSpellAt(id, "longRest")).toBe(true);
      expect(canSwapLeveledSpellAt(id, "levelUp")).toBe(false);
    }
  });

  it("replace-one-per-level-up classes (Sorcerer/Bard/Warlock) only swap on level-up", () => {
    for (const id of ["sorcerer", "bard", "warlock"]) {
      expect(canSwapLeveledSpellAt(id, "levelUp")).toBe(true);
      expect(canSwapLeveledSpellAt(id, "longRest")).toBe(false);
    }
  });

  it("is false at any trigger for a non-caster", () => {
    expect(canSwapLeveledSpellAt("fighter", "longRest")).toBe(false);
    expect(canSwapLeveledSpellAt("fighter", "levelUp")).toBe(false);
  });
});

describe("canSwapCantripAt (an independent trigger from canSwapLeveledSpellAt)", () => {
  it("Wizard swaps a cantrip on Long Rest, matching its own leveled-spell cadence", () => {
    expect(canSwapCantripAt("wizard", "longRest")).toBe(true);
    expect(canSwapCantripAt("wizard", "levelUp")).toBe(false);
  });

  it("Cleric/Druid swap a cantrip on level-up, even though their LEVELED spells fully relist every Long Rest instead", () => {
    for (const id of ["cleric", "druid"]) {
      expect(canSwapCantripAt(id, "levelUp")).toBe(true);
      expect(canSwapCantripAt(id, "longRest")).toBe(false);
      expect(canSwapLeveledSpellAt(id, "longRest")).toBe(true); // the other mechanism, different trigger
    }
  });

  it("Sorcerer/Bard/Warlock swap a cantrip on level-up, same trigger as their leveled spells", () => {
    for (const id of ["sorcerer", "bard", "warlock"]) {
      expect(canSwapCantripAt(id, "levelUp")).toBe(true);
    }
  });
});

describe("wizardSpellbookSizeAtLevel", () => {
  it("starts at 6 (level 1) and grows by 2 per level thereafter", () => {
    expect(wizardSpellbookSizeAtLevel(1)).toBe(6);
    expect(wizardSpellbookSizeAtLevel(2)).toBe(8);
    expect(wizardSpellbookSizeAtLevel(20)).toBe(6 + 2 * 19);
  });
});

describe("eligibleCantripPool / eligibleLeveledSpellPool", () => {
  it("are empty for a non-caster", () => {
    expect(eligibleCantripPool("fighter")).toEqual([]);
    expect(eligibleLeveledSpellPool("fighter")).toEqual([]);
  });

  it("are non-empty for every real caster class", () => {
    for (const id of ["wizard", "cleric", "druid", "sorcerer", "bard", "warlock"]) {
      expect(eligibleCantripPool(id).length).toBeGreaterThan(0);
      expect(eligibleLeveledSpellPool(id).length).toBeGreaterThan(0);
    }
  });

  it("is empty for Paladin/Ranger even though they have a real spell-slot economy — their slots spend on Divine Smite/Hunter's Mark, not a spellbook pick", () => {
    for (const id of ["paladin", "ranger"]) {
      expect(eligibleCantripPool(id)).toEqual([]);
      expect(eligibleLeveledSpellPool(id)).toEqual([]);
    }
  });
});

describe("isValidSelection", () => {
  const pool = ["a", "b", "c"];

  it("accepts a selection within the pool and under the max count", () => {
    expect(isValidSelection(pool, ["a", "b"], 2)).toBe(true);
  });

  it("rejects too many selections", () => {
    expect(isValidSelection(pool, ["a", "b", "c"], 2)).toBe(false);
  });

  it("rejects a duplicate", () => {
    expect(isValidSelection(pool, ["a", "a"], 2)).toBe(false);
  });

  it("rejects an id not in the pool", () => {
    expect(isValidSelection(pool, ["z"], 2)).toBe(false);
  });
});

describe("defaultFill (the interim deterministic default)", () => {
  it("fills up to count with the first not-yet-selected ids from the pool, in order", () => {
    expect(defaultFill(["a", "b", "c", "d"], [], 2)).toEqual(["a", "b"]);
  });

  it("keeps everything already selected and only adds what's missing", () => {
    expect(defaultFill(["a", "b", "c", "d"], ["c"], 3)).toEqual(["c", "a", "b"]);
  });

  it("never adds a duplicate of something already selected", () => {
    expect(defaultFill(["a", "b"], ["a"], 2)).toEqual(["a", "b"]);
  });

  it("stops early if the pool runs out before reaching count", () => {
    expect(defaultFill(["a"], [], 5)).toEqual(["a"]);
  });
});

describe("spellPickStepsForClass (D-135's Character Creation picker step sequence)", () => {
  it("Wizard: spellbook first, then cantrips, then prepared", () => {
    expect(spellPickStepsForClass("wizard", 1)).toEqual(["spellbook", "cantrips", "prepared"]);
  });

  it("Cleric/Druid/Sorcerer/Bard: cantrips then prepared, no spellbook", () => {
    for (const id of ["cleric", "druid", "sorcerer", "bard"]) {
      expect(spellPickStepsForClass(id, 1)).toEqual(["cantrips", "prepared"]);
    }
  });

  it("Warlock: cantrips then prepared, no spellbook", () => {
    expect(spellPickStepsForClass("warlock", 1)).toEqual(["cantrips", "prepared"]);
  });

  it("Paladin/Ranger: no steps at all — a nonzero prepared count but an empty eligible pool (Divine Smite/Hunter's Mark live outside the spell list)", () => {
    for (const id of ["paladin", "ranger"]) {
      expect(spellPickStepsForClass(id, 1)).toEqual([]);
    }
  });

  it("is empty for a non-caster", () => {
    expect(spellPickStepsForClass("fighter", 1)).toEqual([]);
  });
});

describe("spellSwapStepsForClass (D-136's in-battle swap-opportunity step sequence)", () => {
  it("Wizard @ longRest: both cantrips and prepared (full relist of both)", () => {
    expect(spellSwapStepsForClass("wizard", 5, "longRest")).toEqual(["cantrips", "prepared"]);
  });

  it("Wizard @ levelUp: nothing — its own swap cadence is Long-Rest only", () => {
    expect(spellSwapStepsForClass("wizard", 5, "levelUp")).toEqual([]);
  });

  it("Cleric/Druid @ longRest: prepared only (full relist) — cantrip cadence is level-up, not Long Rest", () => {
    for (const id of ["cleric", "druid"]) {
      expect(spellSwapStepsForClass(id, 5, "longRest")).toEqual(["prepared"]);
    }
  });

  it("Cleric/Druid @ levelUp: cantrips only — their prepared list only fully relists at Long Rest", () => {
    for (const id of ["cleric", "druid"]) {
      expect(spellSwapStepsForClass(id, 5, "levelUp")).toEqual(["cantrips"]);
    }
  });

  it("Sorcerer/Bard/Warlock @ levelUp: both cantrips and prepared (replace-one)", () => {
    for (const id of ["sorcerer", "bard", "warlock"]) {
      expect(spellSwapStepsForClass(id, 5, "levelUp")).toEqual(["cantrips", "prepared"]);
    }
  });

  it("Sorcerer/Bard/Warlock @ longRest: nothing — their swap cadence is level-up only", () => {
    for (const id of ["sorcerer", "bard", "warlock"]) {
      expect(spellSwapStepsForClass(id, 5, "longRest")).toEqual([]);
    }
  });

  it("Paladin/Ranger: nothing at either trigger — moot, same empty-pool reason as spellPickStepsForClass", () => {
    for (const id of ["paladin", "ranger"]) {
      expect(spellSwapStepsForClass(id, 5, "longRest")).toEqual([]);
      expect(spellSwapStepsForClass(id, 5, "levelUp")).toEqual([]);
    }
  });

  it("is empty for a non-caster at either trigger", () => {
    expect(spellSwapStepsForClass("fighter", 5, "longRest")).toEqual([]);
    expect(spellSwapStepsForClass("fighter", 5, "levelUp")).toEqual([]);
  });
});

describe("preparedSwapIsFullRelist", () => {
  it("is true for Wizard/Cleric/Druid", () => {
    for (const id of ["wizard", "cleric", "druid"]) {
      expect(preparedSwapIsFullRelist(id)).toBe(true);
    }
  });

  it("is false for Paladin/Ranger/Sorcerer/Bard/Warlock", () => {
    for (const id of ["paladin", "ranger", "sorcerer", "bard", "warlock"]) {
      expect(preparedSwapIsFullRelist(id)).toBe(false);
    }
  });

  it("is false for a non-caster", () => {
    expect(preparedSwapIsFullRelist("fighter")).toBe(false);
  });
});

describe("maxCastableSpellLevel", () => {
  it("is 0 for a non-caster at any level", () => {
    expect(maxCastableSpellLevel("fighter", 20)).toBe(0);
  });

  it("grows with level for a real caster and never exceeds a legal spell level", () => {
    const low = maxCastableSpellLevel("wizard", 1);
    const high = maxCastableSpellLevel("wizard", 20);
    expect(low).toBeGreaterThanOrEqual(1);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(9);
  });
});
