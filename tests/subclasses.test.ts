import { describe, it, expect } from "vitest";
import {
  CHAMPION,
  SCHOOL_OF_EVOCATION,
  THIEF,
  LIFE_DOMAIN,
  PATH_OF_THE_BERSERKER,
  COLLEGE_OF_LORE,
  CIRCLE_OF_THE_LAND,
  CIRCLE_OF_THE_LAND_SPELLS,
  WAY_OF_THE_OPEN_HAND,
  OATH_OF_DEVOTION,
  HUNTER,
  DRACONIC_BLOODLINE,
  THE_FIEND,
  PATH_OF_THE_IRONHIDE,
  COLLEGE_OF_THE_BLADE,
  ZEAL_DOMAIN,
  CIRCLE_OF_THE_ASHEN_VEIL,
  BATTLE_TACTICIAN,
  WAY_OF_THE_IRON_BODY,
  OATH_OF_RETRIBUTION,
  BEASTBOND_WARDEN,
  SHADOWBLADE,
  WILDSURGE_ORIGIN,
  STARBOUND_PATRON,
  SPELLBLADE_TRADITION,
  SUBCLASS_DEFINITIONS,
  getSubclassDefinition,
  subclassesForClass,
} from "../src/game/data/subclasses";
import { isSpellId } from "../src/game/data/spells";
import {
  FIGHTER,
  WIZARD,
  ROGUE,
  CLERIC,
  BARBARIAN,
  BARD,
  DRUID,
  MONK,
  PALADIN,
  RANGER,
  SORCERER,
  WARLOCK,
} from "../src/game/data/classes";
import { featuresAtLevel, activeFeaturesUpToLevel } from "../src/game/systems/CharacterSystem";

/**
 * Phase 11.3's subclass-content follow-up (DECISIONS D-071/D-075/D-076):
 * one real, named subclass per class. Through Phase 13.10 every feature was
 * mechanically inert — see the module comment in `data/subclasses.ts` for
 * why — so these tests focused on data integrity (right class, right level)
 * rather than any gameplay effect. Phase 13.11 (D-096) makes subclass choice
 * itself reachable and wires in the two features that unlocked real gameplay
 * (Champion's Improved/Superior Critical, Life Domain's Disciple of Life/
 * Blessed Healer) — see `tests/classLeveling.test.ts` for the mechanical
 * behavior. Phase 14 (D-097) gives all twelve classes a modeled subclass and
 * wires in three more real features (Hunter's Colossus Slayer, The Fiend's
 * Dark One's Blessing, Draconic Bloodline's Draconic Resilience). Phase 14.1
 * (D-098) corrects Druid's subclass to the real SRD one, Circle of the Land
 * (Circle of the Moon was never SRD content). Phase 14.2 (D-099) gives every
 * class a SECOND, original subclass — this file covers plain data integrity
 * for all 24.
 */

describe("SUBCLASS_DEFINITIONS", () => {
  it("registers exactly two subclasses per class, for all twelve classes", () => {
    expect(SUBCLASS_DEFINITIONS).toHaveLength(24);
    const counts = new Map<string, number>();
    for (const s of SUBCLASS_DEFINITIONS) counts.set(s.classId, (counts.get(s.classId) ?? 0) + 1);
    expect(counts.size).toBe(12);
    for (const count of counts.values()) expect(count).toBe(2);
  });

  it("throws on an unknown subclass id", () => {
    expect(() => getSubclassDefinition("nonexistent")).toThrow();
  });

  it("every subclass id is unique", () => {
    const ids = SUBCLASS_DEFINITIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("subclassesForClass", () => {
  it("returns [SRD subclass, original subclass] for each of the twelve classes, in that order", () => {
    expect(subclassesForClass("fighter")).toEqual([CHAMPION, BATTLE_TACTICIAN]);
    expect(subclassesForClass("wizard")).toEqual([SCHOOL_OF_EVOCATION, SPELLBLADE_TRADITION]);
    expect(subclassesForClass("rogue")).toEqual([THIEF, SHADOWBLADE]);
    expect(subclassesForClass("cleric")).toEqual([LIFE_DOMAIN, ZEAL_DOMAIN]);
    expect(subclassesForClass("barbarian")).toEqual([PATH_OF_THE_BERSERKER, PATH_OF_THE_IRONHIDE]);
    expect(subclassesForClass("bard")).toEqual([COLLEGE_OF_LORE, COLLEGE_OF_THE_BLADE]);
    expect(subclassesForClass("druid")).toEqual([CIRCLE_OF_THE_LAND, CIRCLE_OF_THE_ASHEN_VEIL]);
    expect(subclassesForClass("monk")).toEqual([WAY_OF_THE_OPEN_HAND, WAY_OF_THE_IRON_BODY]);
    expect(subclassesForClass("paladin")).toEqual([OATH_OF_DEVOTION, OATH_OF_RETRIBUTION]);
    expect(subclassesForClass("ranger")).toEqual([HUNTER, BEASTBOND_WARDEN]);
    expect(subclassesForClass("sorcerer")).toEqual([DRACONIC_BLOODLINE, WILDSURGE_ORIGIN]);
    expect(subclassesForClass("warlock")).toEqual([THE_FIEND, STARBOUND_PATRON]);
  });

  it("returns an empty list for an unknown class id", () => {
    expect(subclassesForClass("not-a-class")).toEqual([]);
  });
});

describe("every SRD subclass's first feature lands at its class's recorded subclass-choice level", () => {
  it("Champion's first feature is at level 3, matching Fighter's Martial Archetype", () => {
    expect(Math.min(...CHAMPION.features.map((f) => f.level))).toBe(3);
    expect(featuresAtLevel(FIGHTER, 3).map((f) => f.name)).toContain("Martial Archetype");
  });

  it("School of Evocation's first feature is at level 2, matching Wizard's Arcane Tradition", () => {
    expect(Math.min(...SCHOOL_OF_EVOCATION.features.map((f) => f.level))).toBe(2);
    expect(featuresAtLevel(WIZARD, 2).map((f) => f.name)).toContain("Arcane Tradition");
  });

  it("Thief's first feature is at level 3, matching Rogue's Roguish Archetype", () => {
    expect(Math.min(...THIEF.features.map((f) => f.level))).toBe(3);
    expect(featuresAtLevel(ROGUE, 3).map((f) => f.name)).toContain("Roguish Archetype");
  });

  it("Life Domain's first feature is at level 1, matching Cleric's Divine Domain — earlier than every other class", () => {
    expect(Math.min(...LIFE_DOMAIN.features.map((f) => f.level))).toBe(1);
    expect(featuresAtLevel(CLERIC, 1).map((f) => f.name)).toContain("Divine Domain");
  });

  it("Path of the Berserker's first feature is at level 3, matching Barbarian's Primal Path", () => {
    expect(Math.min(...PATH_OF_THE_BERSERKER.features.map((f) => f.level))).toBe(3);
    expect(featuresAtLevel(BARBARIAN, 3).map((f) => f.name)).toContain("Primal Path");
  });

  it("College of Lore's first feature is at level 3, matching Bard's Bard College", () => {
    expect(Math.min(...COLLEGE_OF_LORE.features.map((f) => f.level))).toBe(3);
    expect(featuresAtLevel(BARD, 3).map((f) => f.name)).toContain("Bard College");
  });

  it("Circle of the Land's first feature is at level 2, matching Druid's Druid Circle (D-098 correction)", () => {
    expect(Math.min(...CIRCLE_OF_THE_LAND.features.map((f) => f.level))).toBe(2);
    expect(featuresAtLevel(DRUID, 2).map((f) => f.name)).toContain("Druid Circle");
  });

  it("Way of the Open Hand's first feature is at level 3, matching Monk's Monastic Tradition", () => {
    expect(Math.min(...WAY_OF_THE_OPEN_HAND.features.map((f) => f.level))).toBe(3);
    expect(featuresAtLevel(MONK, 3).map((f) => f.name)).toContain("Monastic Tradition");
  });

  it("Oath of Devotion's first feature is at level 3, matching Paladin's Sacred Oath", () => {
    expect(Math.min(...OATH_OF_DEVOTION.features.map((f) => f.level))).toBe(3);
    expect(featuresAtLevel(PALADIN, 3).map((f) => f.name)).toContain("Sacred Oath");
  });

  it("Hunter's first feature is at level 3, matching Ranger's Ranger Conclave", () => {
    expect(Math.min(...HUNTER.features.map((f) => f.level))).toBe(3);
    expect(featuresAtLevel(RANGER, 3).map((f) => f.name)).toContain("Ranger Conclave");
  });

  it("Draconic Bloodline's first feature is at level 1, matching Sorcerer's Sorcerous Origin", () => {
    expect(Math.min(...DRACONIC_BLOODLINE.features.map((f) => f.level))).toBe(1);
    expect(featuresAtLevel(SORCERER, 1).map((f) => f.name)).toContain("Sorcerous Origin");
  });

  it("The Fiend's first feature is at level 1, matching Warlock's Otherworldly Patron", () => {
    expect(Math.min(...THE_FIEND.features.map((f) => f.level))).toBe(1);
    expect(featuresAtLevel(WARLOCK, 1).map((f) => f.name)).toContain("Otherworldly Patron");
  });
});

describe("every original subclass's first feature also lands at its class's recorded subclass-choice level (Phase 14.2, D-099)", () => {
  it("Battle Tactician (Fighter, level 3)", () => {
    expect(Math.min(...BATTLE_TACTICIAN.features.map((f) => f.level))).toBe(3);
  });
  it("Spellblade Tradition (Wizard, level 2)", () => {
    expect(Math.min(...SPELLBLADE_TRADITION.features.map((f) => f.level))).toBe(2);
  });
  it("Shadowblade (Rogue, level 3)", () => {
    expect(Math.min(...SHADOWBLADE.features.map((f) => f.level))).toBe(3);
  });
  it("Zeal Domain (Cleric, level 1)", () => {
    expect(Math.min(...ZEAL_DOMAIN.features.map((f) => f.level))).toBe(1);
  });
  it("Path of the Ironhide (Barbarian, level 3)", () => {
    expect(Math.min(...PATH_OF_THE_IRONHIDE.features.map((f) => f.level))).toBe(3);
  });
  it("College of the Blade (Bard, level 3)", () => {
    expect(Math.min(...COLLEGE_OF_THE_BLADE.features.map((f) => f.level))).toBe(3);
  });
  it("Circle of the Ashen Veil (Druid, level 2)", () => {
    expect(Math.min(...CIRCLE_OF_THE_ASHEN_VEIL.features.map((f) => f.level))).toBe(2);
  });
  it("Way of the Iron Body (Monk, level 3)", () => {
    expect(Math.min(...WAY_OF_THE_IRON_BODY.features.map((f) => f.level))).toBe(3);
  });
  it("Oath of Retribution (Paladin, level 3)", () => {
    expect(Math.min(...OATH_OF_RETRIBUTION.features.map((f) => f.level))).toBe(3);
  });
  it("Beastbond Warden (Ranger, level 3)", () => {
    expect(Math.min(...BEASTBOND_WARDEN.features.map((f) => f.level))).toBe(3);
  });
  it("Wildsurge Origin (Sorcerer, level 1)", () => {
    expect(Math.min(...WILDSURGE_ORIGIN.features.map((f) => f.level))).toBe(1);
  });
  it("Starbound Patron (Warlock, level 1)", () => {
    expect(Math.min(...STARBOUND_PATRON.features.map((f) => f.level))).toBe(1);
  });
});

describe("every modeled subclass's mechanically-active features (D-096/D-097/D-098/D-099)", () => {
  it("Champion has exactly Improved Critical (3) and Superior Critical (15) active; nothing else", () => {
    expect(activeFeaturesUpToLevel(CHAMPION, 20).map((f) => f.name)).toEqual([
      "Improved Critical",
      "Superior Critical",
    ]);
  });

  it("Life Domain has exactly Disciple of Life (1) and Blessed Healer (6) active; nothing else", () => {
    expect(activeFeaturesUpToLevel(LIFE_DOMAIN, 20).map((f) => f.name)).toEqual([
      "Disciple of Life",
      "Blessed Healer",
    ]);
  });

  it("Hunter has exactly Colossus Slayer (3) active; nothing else", () => {
    expect(activeFeaturesUpToLevel(HUNTER, 20).map((f) => f.name)).toEqual(["Colossus Slayer"]);
  });

  it("The Fiend has exactly Dark One's Blessing (1) active; nothing else", () => {
    expect(activeFeaturesUpToLevel(THE_FIEND, 20).map((f) => f.name)).toEqual(["Dark One's Blessing"]);
  });

  it("Draconic Bloodline has exactly Draconic Resilience (1) active; nothing else", () => {
    expect(activeFeaturesUpToLevel(DRACONIC_BLOODLINE, 20).map((f) => f.name)).toEqual(["Draconic Resilience"]);
  });

  it("Circle of the Land has exactly Natural Recovery (2) active (D-098 correction); nothing else", () => {
    expect(activeFeaturesUpToLevel(CIRCLE_OF_THE_LAND, 20).map((f) => f.name)).toEqual(["Natural Recovery"]);
  });

  it("School of Evocation and Thief stay fully inert — nothing in this game's cantrip/bonus-action kit hooks their features", () => {
    expect(activeFeaturesUpToLevel(SCHOOL_OF_EVOCATION, 20)).toEqual([]);
    expect(activeFeaturesUpToLevel(THIEF, 20)).toEqual([]);
  });

  it("the four SRD subclasses with no real hookup stay fully inert", () => {
    expect(activeFeaturesUpToLevel(PATH_OF_THE_BERSERKER, 20)).toEqual([]);
    expect(activeFeaturesUpToLevel(COLLEGE_OF_LORE, 20)).toEqual([]);
    expect(activeFeaturesUpToLevel(WAY_OF_THE_OPEN_HAND, 20)).toEqual([]);
    expect(activeFeaturesUpToLevel(OATH_OF_DEVOTION, 20)).toEqual([]);
  });

  it("each of the twelve original subclasses (Phase 14.2, D-099) has exactly one active feature", () => {
    const originals = [
      PATH_OF_THE_IRONHIDE,
      COLLEGE_OF_THE_BLADE,
      ZEAL_DOMAIN,
      CIRCLE_OF_THE_ASHEN_VEIL,
      BATTLE_TACTICIAN,
      WAY_OF_THE_IRON_BODY,
      OATH_OF_RETRIBUTION,
      BEASTBOND_WARDEN,
      SHADOWBLADE,
      WILDSURGE_ORIGIN,
      STARBOUND_PATRON,
      SPELLBLADE_TRADITION,
    ];
    for (const subclass of originals) {
      expect(activeFeaturesUpToLevel(subclass, 20)).toHaveLength(1);
    }
  });

  it("a hero below a feature's level never sees it as active", () => {
    expect(activeFeaturesUpToLevel(CHAMPION, 2)).toEqual([]);
    expect(activeFeaturesUpToLevel(LIFE_DOMAIN, 1).map((f) => f.name)).toEqual(["Disciple of Life"]);
    expect(activeFeaturesUpToLevel(HUNTER, 2)).toEqual([]);
    expect(activeFeaturesUpToLevel(CIRCLE_OF_THE_LAND, 1)).toEqual([]);
  });
});

/**
 * Phase 15 follow-up (D-105): four SRD subclasses grant bonus/always-
 * prepared spells (Life Domain's Domain Spells, Oath of Devotion's Oath
 * Spells, The Fiend's Expanded Spell List, Circle of the Land's terrain-
 * typed Circle Spells) — a real SRD feature that was simply missing from
 * this file before now (not merely inert). Verified against SRD 5.1 rather
 * than assumed (see D-105); every referenced spell id must resolve in
 * `data/spells.ts`, and all four stay `mechanicallyActive: false` for the
 * reasons documented in `data/subclasses.ts`'s own module comment.
 */
describe("subclass-granted spell lists (Phase 15 follow-up, D-105)", () => {
  it("every grantedSpellIds entry across every subclass resolves to a real spell (catches id typos)", () => {
    for (const subclass of SUBCLASS_DEFINITIONS) {
      for (const feature of subclass.features) {
        if (!feature.grantedSpellIds) continue;
        for (const id of feature.grantedSpellIds) {
          expect(isSpellId(id)).toBe(true);
        }
      }
    }
  });

  it("Life Domain grants exactly the SRD 5.1 Domain Spells at levels 1/3/5/7/9, all inert", () => {
    const bySpells = LIFE_DOMAIN.features.filter((f) => f.grantedSpellIds);
    expect(bySpells.map((f) => [f.level, f.grantedSpellIds])).toEqual([
      [1, ["bless", "cure-wounds"]],
      [3, ["lesser-restoration", "spiritual-weapon"]],
      [5, ["beacon-of-hope", "revivify"]],
      [7, ["death-ward", "guardian-of-faith"]],
      [9, ["mass-cure-wounds", "raise-dead"]],
    ]);
    expect(bySpells.every((f) => !f.mechanicallyActive)).toBe(true);
  });

  it("Oath of Devotion grants exactly the SRD 5.1 Oath Spells at levels 3/5/9/13/17, all inert", () => {
    const bySpells = OATH_OF_DEVOTION.features.filter((f) => f.grantedSpellIds);
    expect(bySpells.map((f) => [f.level, f.grantedSpellIds])).toEqual([
      [3, ["protection-from-evil-and-good", "sanctuary"]],
      [5, ["lesser-restoration", "zone-of-truth"]],
      [9, ["beacon-of-hope", "dispel-magic"]],
      [13, ["freedom-of-movement", "guardian-of-faith"]],
      [17, ["commune", "flame-strike"]],
    ]);
    expect(bySpells.every((f) => !f.mechanicallyActive)).toBe(true);
  });

  it("The Fiend grants exactly the SRD 5.1 Expanded Spell List at levels 1/3/5/7/9 (1st-5th spell level), all inert", () => {
    const bySpells = THE_FIEND.features.filter((f) => f.grantedSpellIds);
    expect(bySpells.map((f) => [f.level, f.grantedSpellIds])).toEqual([
      [1, ["burning-hands", "command"]],
      [3, ["blindness-deafness", "scorching-ray"]],
      [5, ["fireball", "stinking-cloud"]],
      [7, ["fire-shield", "wall-of-fire"]],
      [9, ["flame-strike", "hallow"]],
    ]);
    expect(bySpells.every((f) => !f.mechanicallyActive)).toBe(true);
  });

  it("Circle of the Land's own feature list carries no grantedSpellIds directly (the terrain choice isn't made yet — see CIRCLE_OF_THE_LAND_SPELLS instead)", () => {
    expect(CIRCLE_OF_THE_LAND.features.every((f) => f.grantedSpellIds === undefined)).toBe(true);
  });

  it("CIRCLE_OF_THE_LAND_SPELLS covers exactly the 7 SRD terrains, each with 4 leveled tiers of 2 spells", () => {
    const terrains = Object.keys(CIRCLE_OF_THE_LAND_SPELLS).sort();
    expect(terrains).toEqual(["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp"]);
    for (const terrain of terrains as (keyof typeof CIRCLE_OF_THE_LAND_SPELLS)[]) {
      const tiers = CIRCLE_OF_THE_LAND_SPELLS[terrain];
      expect(Object.keys(tiers).map(Number).sort((a, b) => a - b)).toEqual([3, 5, 7, 9]);
      for (const spellIds of Object.values(tiers)) {
        expect(spellIds).toHaveLength(2);
        for (const id of spellIds) expect(isSpellId(id)).toBe(true);
      }
    }
  });
});
