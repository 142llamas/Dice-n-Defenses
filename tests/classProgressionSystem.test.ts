import { describe, it, expect } from "vitest";
import { classProgressionTable } from "../src/game/systems/ClassProgressionSystem";

describe("classProgressionTable", () => {
  it("always returns exactly levels 1-20 in order", () => {
    const table = classProgressionTable("fighter");
    expect(table).toHaveLength(20);
    expect(table[0].level).toBe(1);
    expect(table[19].level).toBe(20);
  });

  it("Fighter is a non-caster at every level: no slots/cantrips/prepared/spellbook", () => {
    for (const entry of classProgressionTable("fighter")) {
      expect(entry.isCaster).toBe(false);
      expect(entry.spellSlots).toEqual([]);
      expect(entry.cantripsKnown).toBe(0);
      expect(entry.preparedCount).toBe(0);
      expect(entry.spellbookSize).toBeUndefined();
    }
  });

  it("Fighter's Ability Score Improvement features land at levels 4/6/8/12/14/16/19", () => {
    const table = classProgressionTable("fighter");
    const asiLevels = table
      .filter((e) => e.classFeatures.some((f) => f.name.startsWith("Ability Score Improvement")))
      .map((e) => e.level);
    expect(asiLevels).toEqual([4, 6, 8, 12, 14, 16, 19]);
  });

  it("Wizard's spellbook size matches wizardSpellbookSizeAtLevel directly", () => {
    const table = classProgressionTable("wizard");
    expect(table[0].spellbookSize).toBe(6); // level 1
    expect(table[1].spellbookSize).toBe(8); // level 2
    expect(table[19].spellbookSize).toBe(6 + 2 * 19); // level 20
  });

  it("spellbookSize is undefined for every non-Wizard class, caster or not", () => {
    for (const id of ["fighter", "cleric", "sorcerer", "warlock"]) {
      for (const entry of classProgressionTable(id)) {
        expect(entry.spellbookSize).toBeUndefined();
      }
    }
  });

  it("Wizard's prepared count matches the already-tested SpellPreparationSystem values", () => {
    const table = classProgressionTable("wizard");
    expect(table[0].preparedCount).toBe(4); // level 1
    expect(table[4].preparedCount).toBe(9); // level 5
    expect(table[19].preparedCount).toBe(26); // level 20
  });

  it("with no subclassId, subclassFeatures is empty at every level", () => {
    for (const entry of classProgressionTable("fighter")) {
      expect(entry.subclassFeatures).toEqual([]);
    }
  });

  it("with a real matching subclassId, its features appear only at their declared levels", () => {
    const table = classProgressionTable("fighter", "champion");
    const withFeatures = table.filter((e) => e.subclassFeatures.length > 0).map((e) => e.level);
    expect(withFeatures).toEqual([3, 7, 10, 15, 18]);
    expect(table[2].subclassFeatures[0].name).toBe("Improved Critical");
  });

  it("a subclass id belonging to a different class is ignored, not thrown", () => {
    const table = classProgressionTable("wizard", "champion"); // champion is a fighter subclass
    for (const entry of table) {
      expect(entry.subclassFeatures).toEqual([]);
    }
  });
});
