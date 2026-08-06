import { describe, it, expect } from "vitest";
import {
  SPELLS,
  getSpell,
  isSpellId,
  spellsAtLevel,
  mechanicallyActiveCantrips,
  abilityForSpell,
} from "../src/game/data/spells";
import { getAbility } from "../src/game/data/abilities";

/**
 * Phase 11.2's curated spell list (DECISIONS D-071/D-074), extended in
 * Phase 11.3 (D-075) for the Cleric, in Phase 13.8 (D-093) for four more
 * casters, in Phase 15 (D-104) into a full 318-entry SRD catalogue, and in
 * Phase 16 (D-106, "make all spells usable") into a catalogue where MOST
 * spells carry a real `abilityId` — 198 of 318, as of this phase. The
 * remaining 120 are genuinely non-combat (pure information/social/utility/
 * ritual/exploration/crafting/travel spells like Comprehend Languages,
 * Identify, Scrying, Water Walk) with no plausible battle application in a
 * tactical-combat-only game — left data-only on purpose, same "honest,
 * inert until it fits" treatment every prior phase gave a handful of
 * spells. These tests check structural properties of the full catalogue
 * (counts, that every wired spell resolves to a real ability) rather than
 * hardcoding all 318 ids or every wired/unwired id individually.
 */

describe("getSpell / isSpellId", () => {
  it("looks up a known spell", () => {
    expect(getSpell("fire-bolt").name).toBe("Fire Bolt");
  });

  it("throws on an unknown id", () => {
    expect(() => getSpell("nonexistent")).toThrow();
  });

  it("distinguishes spell ids from ordinary ability ids", () => {
    expect(isSpellId("fire-bolt")).toBe(true);
    expect(isSpellId("cleave")).toBe(false); // a Fighter ability, not a spell
  });
});

describe("the full SRD catalogue (Phase 15, D-104; +1 Phase 16 follow-up fix)", () => {
  it("has exactly 319 unique spells (318 from Phase 15, +1 Hellish Rebuke added as a Phase 16 follow-up fix for a Phase 15 catalogue omission)", () => {
    expect(Object.keys(SPELLS).length).toBe(319);
  });

  it("every spell has a valid level (0-9) and a valid school", () => {
    const schools = new Set([
      "abjuration",
      "conjuration",
      "divination",
      "enchantment",
      "evocation",
      "illusion",
      "necromancy",
      "transmutation",
    ]);
    for (const spell of Object.values(SPELLS)) {
      expect(Number.isInteger(spell.level)).toBe(true);
      expect(spell.level).toBeGreaterThanOrEqual(0);
      expect(spell.level).toBeLessThanOrEqual(9);
      expect(schools.has(spell.school)).toBe(true);
      expect(spell.description.length).toBeGreaterThan(0);
    }
  });

  it("every spell's object key matches its own id field", () => {
    for (const [key, spell] of Object.entries(SPELLS)) {
      expect(spell.id).toBe(key);
    }
  });

  it("spellsAtLevel matches the catalogue's own level distribution", () => {
    const expectedCounts: Record<number, number> = {
      0: 24,
      1: 49,
      2: 54,
      3: 42,
      4: 31,
      5: 37,
      6: 31,
      7: 20,
      8: 16,
      9: 15,
    };
    for (const [level, count] of Object.entries(expectedCounts)) {
      expect(spellsAtLevel(Number(level)).length).toBe(count);
    }
  });

  it("still includes every pre-Phase-15 curated spell unchanged", () => {
    const preExisting = [
      "fire-bolt",
      "ray-of-frost",
      "magic-missile",
      "burning-hands",
      "mage-armor",
      "sacred-flame",
      "guidance",
      "cure-wounds",
      "bless",
      "shield-of-faith",
      "vicious-mockery",
      "healing-word",
      "produce-flame",
      "eldritch-blast",
    ];
    for (const id of preExisting) {
      expect(isSpellId(id)).toBe(true);
    }
  });

  it("Phase 16 (D-106) gives most of the catalogue a real abilityId; the rest stay honestly non-combat", () => {
    const wired = Object.values(SPELLS).filter((s) => s.abilityId !== undefined);
    const notWired = Object.values(SPELLS).filter((s) => s.abilityId === undefined);
    expect(wired.length).toBe(199);
    expect(notWired.length).toBe(120);
    expect(wired.length + notWired.length).toBe(319);
  });

  it("every wired spell's abilityId resolves to a real AbilityDefinition", () => {
    for (const spell of Object.values(SPELLS)) {
      if (spell.abilityId === undefined) continue;
      expect(() => getAbility(spell.abilityId!)).not.toThrow();
    }
  });

  it("every wired LEVELED spell's ability carries the matching spellSlotLevel; every wired cantrip's ability carries none", () => {
    for (const spell of Object.values(SPELLS)) {
      if (spell.abilityId === undefined) continue;
      const ability = getAbility(spell.abilityId);
      if (spell.level === 0) expect(ability.spellSlotLevel).toBeUndefined();
      else expect(ability.spellSlotLevel).toBe(spell.level);
    }
  });
});

describe("mechanicallyActiveCantrips", () => {
  it("returns only cantrips that carry a real abilityId", () => {
    const active = mechanicallyActiveCantrips();
    expect(active.length).toBe(14);
    expect(active.every((s) => s.level === 0 && s.abilityId !== undefined)).toBe(true);
  });
});

describe("abilityForSpell", () => {
  it("resolves a mechanically-active cantrip to its real combat numbers", () => {
    const spell = getSpell("fire-bolt");
    expect(abilityForSpell(spell)).toBe(getAbility("fire-bolt"));
  });

  it("resolves the two original mechanically-active leveled spells (Phase 13.7, D-092)", () => {
    expect(abilityForSpell(getSpell("magic-missile"))).toBe(getAbility("magic-missile"));
    expect(abilityForSpell(getSpell("cure-wounds"))).toBe(getAbility("cure-wounds"));
  });

  it("resolves Bless/Burning Hands/Mage Armor/Shield of Faith now that Phase 16 (D-106) wired them", () => {
    expect(abilityForSpell(getSpell("bless"))).toBe(getAbility("bless"));
    expect(abilityForSpell(getSpell("burning-hands"))).toBe(getAbility("burning-hands"));
    expect(abilityForSpell(getSpell("mage-armor"))).toBe(getAbility("mage-armor"));
    expect(abilityForSpell(getSpell("shield-of-faith"))).toBe(getAbility("shield-of-faith"));
  });

  it("throws for a spell still genuinely non-combat (Comprehend Languages — no dialogue/translation system)", () => {
    expect(() => abilityForSpell(getSpell("comprehend-languages"))).toThrow();
  });
});
