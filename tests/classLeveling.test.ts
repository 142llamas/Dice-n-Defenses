import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";
import {
  heroDefinitionFromBuild,
  subclassIdForNewBuild,
  type CharacterBuild,
} from "../src/game/systems/CharacterBuildSystem";
import { fixedHitDieGain, subclassGrantedAtLevel } from "../src/game/systems/CharacterSystem";
import { getClassDefinition } from "../src/game/data/classes";
import { ProgressionSystem } from "../src/game/systems/ProgressionSystem";
import { WIZARD_CANTRIP_IDS, WIZARD_LEVELED_SPELL_IDS } from "../src/game/data/characterCreation";
import { getSpell } from "../src/game/data/spells";

/**
 * Phase 13.3 (D-089): real per-class leveling. `Hero.levelUpClass()` is the
 * seam a D&D-built hero (classId + abilityScores, both set by
 * `heroDefinitionFromBuild`) advances through on the wave-clear cadence
 * `ProgressionSystem` tracks. `classId`/`abilityScores` are still optional on
 * `HeroDefinition` (see data/heroes.ts) — `levelUpClass()` stays a defensive
 * no-op for a hero built without them, covered below.
 */

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    controlledBy: "human",
    ...overrides,
  };
}

function heroFromBuild(overrides: Partial<CharacterBuild> = {}): Hero {
  return new Hero(heroDefinitionFromBuild(build(overrides)), { x: 0, y: 0 });
}

const NO_CLASS_HERO_DEF: HeroDefinition = {
  id: "hero-no-class",
  name: "Ash",
  movementTiles: 4,
  maxHealth: 12,
  attackDamage: 4,
  attackRangeTiles: 1,
  attackBonus: 4,
  baseArmorClass: 10,
};

function heroWithNoClass(): Hero {
  return new Hero(NO_CLASS_HERO_DEF, { x: 0, y: 0 });
}

describe("Hero.levelUpClass — a hero with no classId/abilityScores", () => {
  it("is a no-op", () => {
    const hero = heroWithNoClass();
    const before = {
      level: hero.level,
      maxHealth: hero.effectiveMaxHealth,
      attackDamage: hero.effectiveAttackDamage,
      attackBonus: hero.attackBonus,
      attacksPerAction: hero.attacksPerAction,
    };
    hero.levelUpClass();
    expect(hero.level).toBe(before.level);
    expect(hero.effectiveMaxHealth).toBe(before.maxHealth);
    expect(hero.effectiveAttackDamage).toBe(before.attackDamage);
    expect(hero.attackBonus).toBe(before.attackBonus);
    expect(hero.attacksPerAction).toBe(before.attacksPerAction);
  });
});

describe("Hero.levelUpClass — a D&D-built Fighter", () => {
  it("starts at level 1 with a single attack per action", () => {
    const hero = heroFromBuild();
    expect(hero.level).toBe(1);
    expect(hero.attacksPerAction).toBe(1);
  });

  it("advances one level, recomputing max HP and adding exactly the HP gained to current health (not a full heal)", () => {
    const hero = heroFromBuild(); // level-1 Fighter, CON+1: max HP = 10 + 1 = 11
    hero.health = 3; // simulate damage taken before leveling
    hero.levelUpClass();
    expect(hero.level).toBe(2);
    const gain = fixedHitDieGain(10) + 1; // per-level HP gain (+6) + CON mod (+1)
    expect(hero.effectiveMaxHealth).toBe(11 + gain);
    expect(hero.health).toBe(3 + gain); // healed by the gain only, still hurt otherwise
  });

  it("recomputes attackBonus from the new level's proficiency bonus", () => {
    const hero = heroFromBuild();
    for (let i = 1; i < 5; i++) hero.levelUpClass(); // level 5: proficiency rises to +3
    expect(hero.level).toBe(5);
    expect(hero.attackBonus).toBe(3 + 2); // proficiency(+3) + STR mod(+2)
  });

  it("gains Extra Attack at level 5 — attacksPerAction becomes 2", () => {
    const hero = heroFromBuild();
    expect(hero.attacksPerAction).toBe(1);
    for (let i = 1; i < 5; i++) hero.levelUpClass();
    expect(hero.attacksPerAction).toBe(2);
  });

  it("stops advancing at the SRD level cap (20) instead of throwing", () => {
    const hero = heroFromBuild();
    for (let i = 0; i < 30; i++) hero.levelUpClass();
    expect(hero.level).toBe(20);
    expect(() => hero.levelUpClass()).not.toThrow();
    expect(hero.level).toBe(20);
  });
});

describe("Hero.levelUpClass — a D&D-built Rogue's Sneak Attack rider scales with level", () => {
  it("grows the rider damage baked into attackDamage as the Rogue levels", () => {
    const hero = heroFromBuild({ classId: "rogue" });
    expect(hero.effectiveAttackDamage).toBe(8); // base 2 + DEX mod(+2) + Sneak Attack(+4)
    for (let i = 1; i < 5; i++) hero.levelUpClass();
    expect(hero.level).toBe(5);
    expect(hero.effectiveAttackDamage).toBe(16); // base 2 + DEX mod(+2) + Sneak Attack(+12)
  });
});

describe("Hero.spellSaveDC (Phase 13.5, D-090)", () => {
  it("is null for the hero with no classId/abilityScores", () => {
    expect(heroWithNoClass().spellSaveDC).toBeNull();
  });

  it("is null for a D&D-built hero whose class has no spellcasting (Fighter/Rogue)", () => {
    expect(heroFromBuild({ classId: "fighter" }).spellSaveDC).toBeNull();
    expect(heroFromBuild({ classId: "rogue" }).spellSaveDC).toBeNull();
  });

  it("computes 8 + proficiency + spellcasting-ability modifier for a Cleric", () => {
    const hero = heroFromBuild({
      classId: "cleric",
      abilityScores: { str: 8, dex: 12, con: 13, int: 10, wis: 16, cha: 10 },
    });
    // WIS 16 -> +3 mod; level 1 proficiency +2; DC = 8 + 2 + 3 = 13.
    expect(hero.spellSaveDC).toBe(13);
  });

  it("rises as the Cleric levels up (proficiency bonus rising)", () => {
    const hero = heroFromBuild({
      classId: "cleric",
      abilityScores: { str: 8, dex: 12, con: 13, int: 10, wis: 16, cha: 10 },
    });
    for (let i = 1; i < 5; i++) hero.levelUpClass(); // level 5: proficiency +3
    expect(hero.spellSaveDC).toBe(14);
  });
});

describe("Hero.savingThrowBonus (Phase 13.10) — resolved by an enemy like Blightcaller", () => {
  it("is a flat default for the hero with no classId/abilityScores", () => {
    expect(heroWithNoClass().savingThrowBonus).toBe(2);
  });

  it("is the DEX modifier alone for a class NOT proficient in DEX saves (Fighter: STR/CON)", () => {
    const hero = heroFromBuild(); // Fighter, DEX 14 -> +2 mod, no proficiency
    expect(hero.savingThrowBonus).toBe(2);
  });

  it("adds proficiency bonus for a class that IS proficient in DEX saves (Rogue: DEX/INT)", () => {
    const hero = heroFromBuild({ classId: "rogue" }); // DEX 14 -> +2 mod, proficient
    expect(hero.savingThrowBonus).toBe(2 + 2); // mod(+2) + level-1 proficiency(+2)
  });

  it("rises as a proficient class levels up (proficiency bonus rising)", () => {
    const hero = heroFromBuild({ classId: "rogue" });
    for (let i = 1; i < 5; i++) hero.levelUpClass(); // level 5: proficiency +3
    expect(hero.savingThrowBonus).toBe(2 + 3);
  });
});

describe("ProgressionSystem.acknowledgeLevelUp (Phase 13.3, D-089)", () => {
  it("marks the threshold granted without touching any hero", () => {
    const hero = heroFromBuild();
    const p = new ProgressionSystem();
    p.acknowledgeLevelUp();
    expect(p.levelsSoFar).toBe(1);
    expect(hero.level).toBe(1); // untouched — this method never calls into Hero
  });
});

describe("Hero.improveAbilityScore (Phase 13.6, D-091)", () => {
  it("is a no-op for the hero with no classId/abilityScores", () => {
    const hero = heroWithNoClass();
    const before = hero.effectiveAttackDamage;
    hero.improveAbilityScore("str", 2);
    expect(hero.effectiveAttackDamage).toBe(before);
    expect(hero.abilityScoreValue("str")).toBeNull();
  });

  it("+2 to one ability raises that score and recomputes attackBonus/attackDamage", () => {
    const hero = heroFromBuild(); // Fighter, STR 15 (+2 mod), attackBonus = prof(2) + 2 = 4
    expect(hero.attackBonus).toBe(4);
    hero.improveAbilityScore("str", 2); // STR 15 -> 17, still +3 mod
    expect(hero.abilityScoreValue("str")).toBe(17);
    expect(hero.attackBonus).toBe(5); // prof(2) + 3
  });

  it("+1 to two abilities (two separate calls) raises both independently", () => {
    const hero = heroFromBuild();
    hero.improveAbilityScore("str", 1);
    hero.improveAbilityScore("dex", 1);
    expect(hero.abilityScoreValue("str")).toBe(16);
    expect(hero.abilityScoreValue("dex")).toBe(15);
  });

  it("adds the level-up's max-HP delta to current health, same convention as levelUpClass", () => {
    const hero = heroFromBuild({ abilityScores: { str: 15, dex: 14, con: 14, int: 12, wis: 10, cha: 8 } });
    hero.health = 3; // simulate damage taken
    const maxBefore = hero.effectiveMaxHealth;
    hero.improveAbilityScore("con", 2); // CON 14 -> 16: mod rises +2 -> +3
    expect(hero.effectiveMaxHealth).toBe(maxBefore + 1); // +1 CON mod at level 1
    expect(hero.health).toBe(3 + 1);
  });

  it("never raises an ability score past 20", () => {
    const hero = heroFromBuild({ abilityScores: { str: 19, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } });
    hero.improveAbilityScore("str", 2);
    expect(hero.abilityScoreValue("str")).toBe(20);
    hero.improveAbilityScore("str", 2);
    expect(hero.abilityScoreValue("str")).toBe(20); // capped, not 22
  });
});

describe("Hero.grantFeat (Phase 13.6, D-091)", () => {
  it("Tough grants +2 HP per level immediately, healing the hero for the same amount", () => {
    const hero = heroFromBuild(); // level 1
    const maxBefore = hero.effectiveMaxHealth;
    hero.health -= 3; // simulate damage taken
    const healthBefore = hero.health;
    hero.grantFeat("tough");
    expect(hero.effectiveMaxHealth).toBe(maxBefore + 2); // 2 * level 1
    expect(hero.health).toBe(healthBefore + 2);
  });

  it("Tough's bonus grows with the hero's class level, adding to the level-up's own HP gain", () => {
    const hero = heroFromBuild(); // level-1 Fighter, CON+1
    hero.grantFeat("tough"); // +2 HP at level 1
    const maxAtLevel1 = hero.effectiveMaxHealth;
    hero.levelUpClass(); // level 2: Tough's bonus rises from 2 to 4 (+2 more)
    const classGain = fixedHitDieGain(10) + 1;
    expect(hero.effectiveMaxHealth).toBe(maxAtLevel1 + classGain + 2);
    expect(hero.featIds).toContain("tough");
  });

  it("granting the same feat twice is a no-op the second time", () => {
    const hero = heroFromBuild();
    hero.grantFeat("tough");
    const maxAfterFirst = hero.effectiveMaxHealth;
    hero.grantFeat("tough");
    expect(hero.effectiveMaxHealth).toBe(maxAfterFirst);
    expect(hero.featIds.filter((id) => id === "tough")).toHaveLength(1);
  });

  it("Alert/Athlete grant no HP and no Lucky points (still inert)", () => {
    const hero = heroFromBuild();
    const before = hero.effectiveMaxHealth;
    hero.grantFeat("alert");
    hero.grantFeat("athlete");
    expect(hero.effectiveMaxHealth).toBe(before);
    expect(hero.canUseLucky()).toBe(false);
  });
});

describe("Hero Lucky feat (Phase 13.6, D-091)", () => {
  it("grants 3 rerolls, spendable and tracked", () => {
    const hero = heroFromBuild();
    expect(hero.canUseLucky()).toBe(false);
    hero.grantFeat("lucky");
    expect(hero.canUseLucky()).toBe(true);
    expect(hero.luckyPointsAvailable).toBe(3);
    hero.spendLuckyPoint();
    hero.spendLuckyPoint();
    expect(hero.luckyPointsAvailable).toBe(1);
    hero.spendLuckyPoint();
    expect(hero.luckyPointsAvailable).toBe(0);
    expect(hero.canUseLucky()).toBe(false);
    hero.spendLuckyPoint(); // spending with none left is a safe no-op
    expect(hero.luckyPointsAvailable).toBe(0);
  });

  it("recharges only on a Long Rest, not a Short Rest", () => {
    const hero = heroFromBuild();
    hero.grantFeat("lucky");
    hero.spendLuckyPoint();
    hero.spendLuckyPoint();
    hero.shortRest();
    expect(hero.luckyPointsAvailable).toBe(1); // unchanged by Short Rest
    hero.longRest();
    expect(hero.luckyPointsAvailable).toBe(3);
  });

  it("a hero without the feat is unaffected by a Long Rest's Lucky recharge", () => {
    const hero = heroFromBuild();
    hero.longRest();
    expect(hero.luckyPointsAvailable).toBe(0);
    expect(hero.canUseLucky()).toBe(false);
  });
});

describe("CharacterSystem.subclassGrantedAtLevel (Phase 13.11, D-096)", () => {
  it("is true only at exactly a class's own subclassChoiceLevel", () => {
    expect(subclassGrantedAtLevel(getClassDefinition("fighter"), 3)).toBe(true);
    expect(subclassGrantedAtLevel(getClassDefinition("fighter"), 2)).toBe(false);
    expect(subclassGrantedAtLevel(getClassDefinition("fighter"), 4)).toBe(false);
    expect(subclassGrantedAtLevel(getClassDefinition("wizard"), 2)).toBe(true);
    expect(subclassGrantedAtLevel(getClassDefinition("cleric"), 1)).toBe(true);
  });
});

describe("CharacterBuildSystem.subclassIdForNewBuild (Phase 13.11, D-096)", () => {
  it("auto-assigns the one modeled subclass for a level-1-choice class (Cleric)", () => {
    expect(subclassIdForNewBuild("cleric")).toBe("life-domain");
  });

  it("returns undefined for a class whose choice lands later (Fighter/Wizard/Rogue)", () => {
    expect(subclassIdForNewBuild("fighter")).toBeUndefined();
    expect(subclassIdForNewBuild("wizard")).toBeUndefined();
    expect(subclassIdForNewBuild("rogue")).toBeUndefined();
  });

  it("auto-assigns the one modeled subclass for the other two level-1-choice classes (Sorcerer/Warlock, Phase 14/D-097)", () => {
    expect(subclassIdForNewBuild("sorcerer")).toBe("draconic-bloodline");
    expect(subclassIdForNewBuild("warlock")).toBe("the-fiend");
  });
});

describe("Hero.grantSubclass/subclassId (Phase 13.11, D-096)", () => {
  it("starts undefined and is set exactly once by grantSubclass", () => {
    const hero = heroFromBuild();
    expect(hero.subclassId).toBeUndefined();
    hero.grantSubclass("champion");
    expect(hero.subclassId).toBe("champion");
  });

  it("HeroDefinition.subclassId (from a level-1-choice build) is applied by the constructor", () => {
    const hero = heroFromBuild({ classId: "cleric", subclassId: "life-domain" });
    expect(hero.subclassId).toBe("life-domain");
  });
});

describe("Hero.critThreshold — Champion's Improved/Superior Critical (Phase 13.11, D-096)", () => {
  it("is 20 (default) for a hero with no subclass, or a non-Champion subclass", () => {
    expect(heroFromBuild().critThreshold).toBe(20);
    const cleric = heroFromBuild({ classId: "cleric", subclassId: "life-domain" });
    expect(cleric.critThreshold).toBe(20);
  });

  it("is 19 for a Champion below level 15", () => {
    const hero = heroFromBuild();
    hero.grantSubclass("champion");
    expect(hero.critThreshold).toBe(19);
  });

  it("widens to 18 once a Champion reaches level 15 (Superior Critical)", () => {
    const hero = heroFromBuild();
    hero.grantSubclass("champion");
    for (let i = 1; i < 15; i++) hero.levelUpClass();
    expect(hero.level).toBe(15);
    expect(hero.critThreshold).toBe(18);
  });
});

describe("Hero.discipleOfLifeBonus/blessedHealerBonus — Life Domain (Phase 13.11, D-096)", () => {
  function lifeDomainCleric(): Hero {
    return heroFromBuild({
      classId: "cleric",
      subclassId: "life-domain",
      abilityScores: { str: 8, dex: 12, con: 13, int: 10, wis: 16, cha: 10 },
    });
  }

  it("discipleOfLifeBonus is 0 without the subclass", () => {
    expect(heroFromBuild().discipleOfLifeBonus).toBe(0);
  });

  it("discipleOfLifeBonus is a flat +2 for a Life Domain Cleric at level 1", () => {
    expect(lifeDomainCleric().discipleOfLifeBonus).toBe(2);
  });

  it("blessedHealerBonus is 0 below level 6, even with the subclass", () => {
    expect(lifeDomainCleric().blessedHealerBonus).toBe(0);
  });

  it("blessedHealerBonus becomes +2 once the Cleric reaches level 6", () => {
    const hero = lifeDomainCleric();
    for (let i = 1; i < 6; i++) hero.levelUpClass();
    expect(hero.level).toBe(6);
    expect(hero.blessedHealerBonus).toBe(2);
  });

  it("blessedHealerBonus stays 0 for a non-Life-Domain caster at level 6+", () => {
    const hero = heroFromBuild({ classId: "cleric" }); // no subclass assigned
    for (let i = 1; i < 6; i++) hero.levelUpClass();
    expect(hero.blessedHealerBonus).toBe(0);
  });
});

describe("CharacterBuildSystem.subclassIdForNewBuild — picking the original subclass (Phase 14.2, D-099)", () => {
  it("index 1 assigns the original subclass for each level-1-choice class", () => {
    expect(subclassIdForNewBuild("cleric", 1)).toBe("zeal-domain");
    expect(subclassIdForNewBuild("sorcerer", 1)).toBe("wildsurge-origin");
    expect(subclassIdForNewBuild("warlock", 1)).toBe("starbound-patron");
  });

  it("an out-of-range index returns undefined rather than throwing", () => {
    expect(subclassIdForNewBuild("cleric", 2)).toBeUndefined();
  });
});

describe("Hero.armorClass — subclass AC bonuses (Phase 14.2, D-099)", () => {
  it("Path of the Ironhide adds +2 AC only while raging", () => {
    const hero = heroFromBuild({ classId: "barbarian", subclassId: "path-of-the-ironhide" });
    const baseAC = hero.armorClass;
    hero.useRage();
    expect(hero.armorClass).toBe(baseAC + 2);
    for (let i = 0; i < 10; i++) hero.resetForNewTurn(); // rage ends
    expect(hero.armorClass).toBe(baseAC);
  });

  it("a Berserker Barbarian gets no AC bonus from raging", () => {
    const hero = heroFromBuild({ classId: "barbarian", subclassId: "path-of-the-berserker" });
    const baseAC = hero.armorClass;
    hero.useRage();
    expect(hero.armorClass).toBe(baseAC);
  });

  it("Spellblade Tradition adds a flat, always-on +1 AC", () => {
    const withSubclass = heroFromBuild({ classId: "wizard", subclassId: "spellblade-tradition" });
    const without = heroFromBuild({ classId: "wizard" });
    expect(withSubclass.armorClass).toBe(without.armorClass + 1);
  });
});

describe("Hero.subclassAttackBonus (Phase 14.2, D-099)", () => {
  it("is +1 for College of the Blade/Zeal Domain/Battle Tactician", () => {
    expect(heroFromBuild({ classId: "bard", subclassId: "college-of-the-blade" }).subclassAttackBonus).toBe(1);
    expect(heroFromBuild({ classId: "cleric", subclassId: "zeal-domain" }).subclassAttackBonus).toBe(1);
    expect(heroFromBuild({ classId: "fighter", subclassId: "battle-tactician" }).subclassAttackBonus).toBe(1);
  });

  it("is 0 for every other subclass or none", () => {
    expect(heroFromBuild().subclassAttackBonus).toBe(0); // Fighter, no subclass
    expect(heroFromBuild({ subclassId: "champion" }).subclassAttackBonus).toBe(0);
  });
});

describe("Hero.subclassSmiteBonus — Oath of Retribution (Phase 14.2, D-099)", () => {
  it("is +2 for Oath of Retribution, 0 for Oath of Devotion or none", () => {
    expect(heroFromBuild({ classId: "paladin", subclassId: "oath-of-retribution" }).subclassSmiteBonus).toBe(2);
    expect(heroFromBuild({ classId: "paladin", subclassId: "oath-of-devotion" }).subclassSmiteBonus).toBe(0);
    expect(heroFromBuild({ classId: "paladin" }).subclassSmiteBonus).toBe(0);
  });
});

describe("Hero.beastbondStrikeHeal — Beastbond Warden (Phase 14.2, D-099)", () => {
  it("is +3 for Beastbond Warden, 0 for Hunter or none", () => {
    expect(heroFromBuild({ classId: "ranger", subclassId: "beastbond-warden" }).beastbondStrikeHeal).toBe(3);
    expect(heroFromBuild({ classId: "ranger", subclassId: "hunter" }).beastbondStrikeHeal).toBe(0);
    expect(heroFromBuild({ classId: "ranger" }).beastbondStrikeHeal).toBe(0);
  });
});

describe("Hero.shadowbladeFirstStrikeBonus/consumeShadowbladeFirstStrike (Phase 14.2, D-099)", () => {
  it("is a flat bonus once, then 0 for the rest of the battle", () => {
    const hero = heroFromBuild({ classId: "rogue", subclassId: "shadowblade" });
    expect(hero.shadowbladeFirstStrikeBonus).toBe(5);
    hero.consumeShadowbladeFirstStrike();
    expect(hero.shadowbladeFirstStrikeBonus).toBe(0);
  });

  it("is 0 for Thief or no subclass", () => {
    expect(heroFromBuild({ classId: "rogue", subclassId: "thief" }).shadowbladeFirstStrikeBonus).toBe(0);
    expect(heroFromBuild({ classId: "rogue" }).shadowbladeFirstStrikeBonus).toBe(0);
  });
});

describe("Hero.effectiveMaxHealth — Way of the Iron Body / Starbound Patron flat HP-per-level bonuses (Phase 14.2, D-099)", () => {
  it("Iron Skin adds +1 max HP per Monk level, same shape as Draconic Resilience", () => {
    const withSubclass = heroFromBuild({ classId: "monk", subclassId: "way-of-the-iron-body" });
    const without = heroFromBuild({ classId: "monk" });
    expect(withSubclass.effectiveMaxHealth).toBe(without.effectiveMaxHealth + 1);
    expect(withSubclass.health).toBe(withSubclass.effectiveMaxHealth); // starts fully healed
  });

  it("Umbral Ward adds +1 max HP per Warlock level", () => {
    const withSubclass = heroFromBuild({ classId: "warlock", subclassId: "starbound-patron" });
    const without = heroFromBuild({ classId: "warlock" });
    expect(withSubclass.effectiveMaxHealth).toBe(without.effectiveMaxHealth + 1);
  });

  it("grows by 1 more each level-up, same as Draconic Resilience", () => {
    const hero = heroFromBuild({ classId: "monk", subclassId: "way-of-the-iron-body" });
    const maxAtLevel1 = hero.effectiveMaxHealth;
    hero.levelUpClass();
    expect(hero.effectiveMaxHealth).toBeGreaterThan(maxAtLevel1 + 1); // class HP gain + 1 more from Iron Skin
  });
});

describe("Hero.useWildShape — Circle of the Ashen Veil's Ember Shape heal bonus (Phase 14.2, D-099)", () => {
  it("heals more than Circle of the Land's Wild Shape", () => {
    const ashenVeil = heroFromBuild({ classId: "druid", subclassId: "circle-of-the-ashen-veil" });
    const land = heroFromBuild({ classId: "druid", subclassId: "circle-of-the-land" });
    ashenVeil.health = 1;
    land.health = 1;
    ashenVeil.useWildShape();
    land.useWildShape();
    expect(ashenVeil.health).toBe(land.health + 3);
  });
});

describe("Hero Sorcery Points — Wildsurge Origin's Volatile Magic (Phase 14.2, D-099)", () => {
  it("grants one more Sorcery Point than a Sorcerer without the subclass", () => {
    const wildsurge = heroFromBuild({ classId: "sorcerer", subclassId: "wildsurge-origin" });
    const plain = heroFromBuild({ classId: "sorcerer" });
    for (let i = 1; i < 3; i++) {
      wildsurge.levelUpClass();
      plain.levelUpClass();
    } // level 3: Quicken Spell unlocked
    let wildsurgeUses = 0;
    while (wildsurge.canUseQuickenSpell()) {
      wildsurge.useQuickenSpell();
      wildsurgeUses += 1;
      wildsurge.resetForNewTurn();
    }
    let plainUses = 0;
    while (plain.canUseQuickenSpell()) {
      plain.useQuickenSpell();
      plainUses += 1;
      plain.resetForNewTurn();
    }
    expect(wildsurgeUses).toBe(plainUses + 1);
  });
});

describe("Hero.colossusSlayerBonus — Hunter (Phase 14, D-097)", () => {
  it("is 0 without the subclass", () => {
    expect(heroFromBuild({ classId: "ranger" }).colossusSlayerBonus).toBe(0);
  });

  it("is a flat +4 for a Hunter", () => {
    const hero = heroFromBuild({ classId: "ranger", subclassId: "hunter" });
    expect(hero.colossusSlayerBonus).toBe(4);
  });

  it("stays 0 for a non-Ranger with an unrelated subclass id somehow set", () => {
    const hero = heroFromBuild({ classId: "fighter", subclassId: "champion" });
    expect(hero.colossusSlayerBonus).toBe(0);
  });
});

describe("Hero.darkOnesBlessingHeal — The Fiend (Phase 14, D-097)", () => {
  it("is 0 without the subclass", () => {
    expect(heroFromBuild({ classId: "warlock" }).darkOnesBlessingHeal).toBe(0);
  });

  it("is a flat +5 for a Fiend Warlock", () => {
    const hero = heroFromBuild({ classId: "warlock", subclassId: "the-fiend" });
    expect(hero.darkOnesBlessingHeal).toBe(5);
  });
});

describe("Hero.effectiveMaxHealth — Draconic Bloodline's Draconic Resilience (Phase 14, D-097)", () => {
  it("adds nothing for a Sorcerer without the subclass", () => {
    const withSubclass = heroFromBuild({ classId: "sorcerer", subclassId: "draconic-bloodline" });
    const without = heroFromBuild({ classId: "sorcerer" });
    expect(withSubclass.effectiveMaxHealth).toBe(without.effectiveMaxHealth + 1); // +1 HP at level 1
  });

  it("starts a fresh level-1 Draconic Bloodline Sorcerer at full effective health, not one HP short", () => {
    const hero = heroFromBuild({ classId: "sorcerer", subclassId: "draconic-bloodline" });
    expect(hero.health).toBe(hero.effectiveMaxHealth);
  });

  it("grows by 1 more HP each level, added to current health on level-up like any other HP gain", () => {
    const hero = heroFromBuild({ classId: "sorcerer", subclassId: "draconic-bloodline" });
    const maxAtLevel1 = hero.effectiveMaxHealth;
    hero.levelUpClass();
    const classGain = fixedHitDieGain(6) + 1; // Sorcerer d6 + CON mod(+1)
    expect(hero.effectiveMaxHealth).toBe(maxAtLevel1 + classGain + 1); // +1 more from Draconic Resilience
    expect(hero.health).toBe(hero.effectiveMaxHealth); // still fully healed — no damage was taken
  });

  it("stacks correctly with Tough (both are flat HP bonuses read through flatHpBonusesTotal)", () => {
    const hero = heroFromBuild({ classId: "sorcerer", subclassId: "draconic-bloodline" });
    const before = hero.effectiveMaxHealth;
    hero.grantFeat("tough");
    expect(hero.effectiveMaxHealth).toBe(before + 2); // Tough: 2 * level 1
  });
});

describe("Hero.meetsFeatPrerequisites (Phase 18, D-109)", () => {
  it("is false for the hero with no classId/abilityScores", () => {
    expect(heroWithNoClass().meetsFeatPrerequisites("tough")).toBe(false);
    expect(heroWithNoClass().meetsFeatPrerequisites("archery")).toBe(false);
  });

  it("allows every Origin feat with no prerequisite at level 1", () => {
    const hero = heroFromBuild(); // level-1 Fighter
    expect(hero.meetsFeatPrerequisites("tough")).toBe(true);
    expect(hero.meetsFeatPrerequisites("magic-initiate")).toBe(true);
    expect(hero.meetsFeatPrerequisites("savage-attacker")).toBe(true);
    expect(hero.meetsFeatPrerequisites("skilled")).toBe(true);
  });

  it("gates Grappler on level 4+ even with Str/Dex already 13+", () => {
    const hero = heroFromBuild(); // level-1 Fighter, STR 15/DEX 14
    expect(hero.meetsFeatPrerequisites("grappler")).toBe(false);
    hero.levelUpClass();
    hero.levelUpClass();
    hero.levelUpClass();
    expect(hero.level).toBe(4);
    expect(hero.meetsFeatPrerequisites("grappler")).toBe(true);
  });

  it("gates Grappler on Str OR Dex 13+ (fails when both are below 13)", () => {
    const hero = heroFromBuild({ abilityScores: { str: 8, dex: 8, con: 13, int: 12, wis: 10, cha: 8 } });
    for (let i = 0; i < 3; i++) hero.levelUpClass(); // level 4
    expect(hero.meetsFeatPrerequisites("grappler")).toBe(false);
  });

  it("allows Fighting Style feats for a level-1 Fighter, but not a Wizard/Rogue (no Fighting Style feature)", () => {
    expect(heroFromBuild().meetsFeatPrerequisites("archery")).toBe(true);
    expect(heroFromBuild({ classId: "wizard" }).meetsFeatPrerequisites("archery")).toBe(false);
    expect(heroFromBuild({ classId: "rogue" }).meetsFeatPrerequisites("defense")).toBe(false);
  });

  it("gates every Epic Boon on level 19+", () => {
    const hero = heroFromBuild();
    expect(hero.meetsFeatPrerequisites("boon-of-combat-prowess")).toBe(false);
    for (let i = 1; i < 19; i++) hero.levelUpClass();
    expect(hero.level).toBe(19);
    expect(hero.meetsFeatPrerequisites("boon-of-combat-prowess")).toBe(true);
  });

  it("gates Boon of Spell Recall additionally on a spellcasting class", () => {
    const fighter = heroFromBuild();
    for (let i = 1; i < 19; i++) fighter.levelUpClass();
    expect(fighter.meetsFeatPrerequisites("boon-of-spell-recall")).toBe(false); // Fighter has no spellcasting
    const wizard = heroFromBuild({ classId: "wizard" });
    for (let i = 1; i < 19; i++) wizard.levelUpClass();
    expect(wizard.meetsFeatPrerequisites("boon-of-spell-recall")).toBe(true);
  });

  it("stops offering Magic Initiate once all 3 lists are taken, but not before", () => {
    const hero = heroFromBuild();
    expect(hero.meetsFeatPrerequisites("magic-initiate")).toBe(true);
    hero.grantFeat("magic-initiate", { magicInitiateList: "wizard" });
    expect(hero.meetsFeatPrerequisites("magic-initiate")).toBe(true);
    hero.grantFeat("magic-initiate", { magicInitiateList: "cleric" });
    hero.grantFeat("magic-initiate", { magicInitiateList: "druid" });
    expect(hero.meetsFeatPrerequisites("magic-initiate")).toBe(false);
  });

  it("returns false for a non-repeatable feat already held", () => {
    const hero = heroFromBuild();
    hero.grantFeat("tough");
    expect(hero.meetsFeatPrerequisites("tough")).toBe(false);
  });
});

describe("Hero.grantFeat — Grappler (Phase 18, D-109)", () => {
  it("raises the chosen ability by 1 (capped at 20) and recomputes derived stats", () => {
    const hero = heroFromBuild(); // Fighter, STR 15 (+2 mod) -> attackBonus = prof(2) + 2 = 4
    expect(hero.attackBonus).toBe(4);
    hero.grantFeat("grappler", { chosenAbility: "str" });
    expect(hero.abilityScoreValue("str")).toBe(16); // +3 mod now
    expect(hero.attackBonus).toBe(5);
    expect(hero.featIds).toContain("grappler");
  });

  it("does nothing to ability scores if no chosenAbility option is passed", () => {
    const hero = heroFromBuild();
    const before = hero.abilityScoreValue("str");
    hero.grantFeat("grappler");
    expect(hero.abilityScoreValue("str")).toBe(before);
    expect(hero.featIds).toContain("grappler");
  });

  it("never raises the ability past Grappler's own 20 cap", () => {
    const hero = heroFromBuild({ abilityScores: { str: 20, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } });
    hero.grantFeat("grappler", { chosenAbility: "str" });
    expect(hero.abilityScoreValue("str")).toBe(20);
  });

  it("canUseGrapplerRestrain starts true, is spent by consumeGrapplerRestrain, and resets each turn", () => {
    const hero = heroFromBuild();
    hero.grantFeat("grappler");
    expect(hero.canUseGrapplerRestrain).toBe(true);
    hero.consumeGrapplerRestrain();
    expect(hero.canUseGrapplerRestrain).toBe(false);
    hero.resetForNewTurn();
    expect(hero.canUseGrapplerRestrain).toBe(true);
  });
});

describe("Hero — Fighting Style/Origin feat damage and AC bonuses (Phase 18, D-109)", () => {
  it("Archery adds +2 attack bonus only while a ranged weapon is equipped", () => {
    const hero = heroFromBuild();
    hero.grantFeat("archery");
    const withoutWeapon = hero.effectiveAttackBonus;
    hero.equippedItems.weapon = "dagger";
    expect(hero.effectiveAttackBonus).toBe(withoutWeapon); // melee weapon, no bonus
    hero.equippedItems.weapon = "longbow";
    expect(hero.effectiveAttackBonus).toBe(withoutWeapon + 2);
  });

  it("Defense adds +1 AC only while real armor is worn", () => {
    const withFeat = heroFromBuild();
    withFeat.grantFeat("defense");
    const withoutFeat = heroFromBuild();
    expect(withFeat.armorClass).toBe(withoutFeat.armorClass); // no armor yet, no bonus
    withFeat.equippedItems.chest = "leather-armor";
    withoutFeat.equippedItems.chest = "leather-armor";
    expect(withFeat.armorClass).toBe(withoutFeat.armorClass + 1);
  });

  it("Great Weapon Fighting adds flat damage only for a two-handed weapon", () => {
    const withFeat = heroFromBuild();
    withFeat.grantFeat("great-weapon-fighting");
    const withoutFeat = heroFromBuild();
    withFeat.equippedItems.weapon = "greatsword"; // twoHanded
    withoutFeat.equippedItems.weapon = "greatsword";
    expect(withFeat.effectiveAttackDamage).toBe(withoutFeat.effectiveAttackDamage + 2);
    withFeat.equippedItems.weapon = "dagger"; // not two-handed
    withoutFeat.equippedItems.weapon = "dagger";
    expect(withFeat.effectiveAttackDamage).toBe(withoutFeat.effectiveAttackDamage);
  });

  it("Savage Attacker adds a flat damage bonus to every basic attack, regardless of weapon", () => {
    const withFeat = heroFromBuild();
    withFeat.grantFeat("savage-attacker");
    const withoutFeat = heroFromBuild();
    expect(withFeat.effectiveAttackDamage).toBe(withoutFeat.effectiveAttackDamage + 2);
  });
});

describe("Hero.grantFeat — Magic Initiate (Phase 18, D-109)", () => {
  it("grants 2 cantrips and 1 first-level spell from the chosen list, available to a non-caster too", () => {
    const hero = heroFromBuild(); // Fighter — a non-caster, per the SRD's real "any class" rule
    hero.grantFeat("magic-initiate", { magicInitiateList: "wizard" });
    const expectedCantrips = WIZARD_CANTRIP_IDS.slice(0, 2);
    const expectedSpell = WIZARD_LEVELED_SPELL_IDS.find((id) => getSpell(id).level === 1);
    const known = hero.knownSpellAbilityIds();
    for (const id of expectedCantrips) expect(known).toContain(id);
    expect(known).toContain(expectedSpell);
    expect(hero.magicInitiateListsTaken).toEqual(["wizard"]);
  });

  it("is repeatable across all 3 lists", () => {
    const hero = heroFromBuild();
    hero.grantFeat("magic-initiate", { magicInitiateList: "wizard" });
    hero.grantFeat("magic-initiate", { magicInitiateList: "cleric" });
    hero.grantFeat("magic-initiate", { magicInitiateList: "druid" });
    expect(hero.magicInitiateListsTaken).toEqual(["wizard", "cleric", "druid"]);
    expect(hero.featIds.filter((id) => id === "magic-initiate")).toHaveLength(3);
  });

  it("the granted leveled spell is castable once free per Long Rest, even for a non-caster with no spell slots", () => {
    const hero = heroFromBuild(); // Fighter, no spell slots at all
    hero.grantFeat("magic-initiate", { magicInitiateList: "wizard" });
    const spellId = WIZARD_LEVELED_SPELL_IDS.find((id) => getSpell(id).level === 1)!;
    expect(hero.canCastSpell(spellId)).toBe(true);
    hero.spendSpellSlotFor(spellId, 1, 0);
    expect(hero.canCastSpell(spellId)).toBe(false); // free use spent, and a Fighter has no real slots either
    hero.longRest();
    expect(hero.canCastSpell(spellId)).toBe(true); // refilled
  });
});

describe("Hero — Epic Boon hookups (Phase 18, D-109)", () => {
  it("Boon of Combat Prowess: once-per-turn use, reset by resetForNewTurn", () => {
    const hero = heroFromBuild();
    hero.grantFeat("boon-of-combat-prowess", { chosenAbility: "str" });
    expect(hero.abilityScoreValue("str")).toBe(16);
    expect(hero.canUseCombatProwess).toBe(true);
    hero.consumeCombatProwess();
    expect(hero.canUseCombatProwess).toBe(false);
    hero.resetForNewTurn();
    expect(hero.canUseCombatProwess).toBe(true);
  });

  it("Boon of Fate: once-per-rest charge, spent immediately and recharged only on a Long Rest", () => {
    const hero = heroFromBuild();
    hero.grantFeat("boon-of-fate", { chosenAbility: "cha" });
    expect(hero.canUseBoonOfFate).toBe(true);
    expect(hero.boonOfFateBonus).toBe(3);
    hero.useBoonOfFate();
    expect(hero.canUseBoonOfFate).toBe(false);
    hero.shortRest();
    expect(hero.canUseBoonOfFate).toBe(false); // a Short Rest does not recharge it
    hero.longRest();
    expect(hero.canUseBoonOfFate).toBe(true);
  });

  it("Boon of Irresistible Offense: bonus damage equals the score of whichever ability it raised", () => {
    const hero = heroFromBuild(); // STR 15
    expect(hero.irresistibleOffenseBonusDamage).toBe(0);
    hero.grantFeat("boon-of-irresistible-offense", { chosenAbility: "str" });
    expect(hero.abilityScoreValue("str")).toBe(16);
    expect(hero.irresistibleOffenseBonusDamage).toBe(16);
  });

  it("Boon of Spell Recall: the caller's 1d4 roll spares a matching-level slot, and misses spend it normally", () => {
    const hero = heroFromBuild({ classId: "wizard" });
    expect(hero.hasBoonOfSpellRecall).toBe(false);
    hero.grantFeat("boon-of-spell-recall", { chosenAbility: "int" });
    expect(hero.hasBoonOfSpellRecall).toBe(true);
    const before = hero.spellSlotsRemainingAt(1);
    hero.spendSpellSlotWithRecallRoll(1, 1); // roll matches level 1 -> spared
    expect(hero.spellSlotsRemainingAt(1)).toBe(before);
    hero.spendSpellSlotWithRecallRoll(1, 2); // roll doesn't match -> spent normally
    expect(hero.spellSlotsRemainingAt(1)).toBe(before - 1);
  });

  it("a hero without Boon of Spell Recall always spends the slot, regardless of the roll passed in", () => {
    const hero = heroFromBuild({ classId: "wizard" });
    const before = hero.spellSlotsRemainingAt(1);
    hero.spendSpellSlotWithRecallRoll(1, 1);
    expect(hero.spellSlotsRemainingAt(1)).toBe(before - 1);
  });
});

describe("Hero — dual-wielding / Two-Weapon Fighting (Phase 19, D-110)", () => {
  it("isDualWieldingLightWeapons is false with no weapons, or only a main-hand weapon", () => {
    const hero = heroFromBuild();
    expect(hero.isDualWieldingLightWeapons).toBe(false);
    hero.equippedItems.weapon = "dagger";
    expect(hero.isDualWieldingLightWeapons).toBe(false);
    expect(hero.offHandWeapon).toBeNull();
  });

  it("isDualWieldingLightWeapons is true only when BOTH hands hold a Light melee weapon", () => {
    const hero = heroFromBuild();
    hero.equippedItems.weapon = "dagger";
    hero.equippedItems.shield = "shortsword";
    expect(hero.isDualWieldingLightWeapons).toBe(true);
    expect(hero.offHandWeapon?.id).toBe("shortsword");
  });

  it("is false if the main-hand weapon isn't Light, even with a Light weapon in the off-hand", () => {
    const hero = heroFromBuild();
    hero.equippedItems.weapon = "greatsword"; // heavy, twoHanded — not light
    hero.equippedItems.shield = "dagger";
    expect(hero.isDualWieldingLightWeapons).toBe(false);
  });

  it("offHandWeapon is null when the shield slot holds a real Shield, not a weapon", () => {
    const hero = heroFromBuild();
    hero.equippedItems.weapon = "dagger";
    hero.equippedItems.shield = "shield"; // the real Shield item, not an off-hand weapon
    expect(hero.offHandWeapon).toBeNull();
    expect(hero.isDualWieldingLightWeapons).toBe(false);
  });

  it("canUseOffHandAttack requires dual-wielding AND having already acted this turn", () => {
    const hero = heroFromBuild();
    hero.equippedItems.weapon = "shortsword";
    hero.equippedItems.shield = "handaxe"; // neither weapon has Nick
    expect(hero.canUseOffHandAttack()).toBe(false); // hasn't acted yet
    hero.markActed();
    expect(hero.canUseOffHandAttack()).toBe(true);
  });

  it("useOffHandAttack spends the bonus action for a non-Nick pair, and can't be used twice in one turn", () => {
    const hero = heroFromBuild();
    hero.equippedItems.weapon = "shortsword";
    hero.equippedItems.shield = "handaxe";
    hero.markActed();
    expect(hero.canUseBonusAction()).toBe(true);
    hero.useOffHandAttack();
    expect(hero.canUseBonusAction()).toBe(false); // bonus action spent
    expect(hero.canUseOffHandAttack()).toBe(false); // already used this turn
  });

  it("Nick (on either weapon) makes the off-hand attack free — the bonus action stays available", () => {
    const hero = heroFromBuild();
    hero.equippedItems.weapon = "dagger"; // Nick
    hero.equippedItems.shield = "shortsword"; // Vex, not Nick — but Nick on EITHER weapon qualifies
    hero.markActed();
    hero.useOffHandAttack();
    expect(hero.canUseBonusAction()).toBe(true); // untouched — Nick made it free
    expect(hero.canUseOffHandAttack()).toBe(false); // still only once per turn
  });

  it("resetForNewTurn clears the once-per-turn off-hand attack use", () => {
    const hero = heroFromBuild();
    hero.equippedItems.weapon = "shortsword";
    hero.equippedItems.shield = "handaxe";
    hero.markActed();
    hero.useOffHandAttack();
    hero.resetForNewTurn();
    hero.markActed();
    expect(hero.canUseOffHandAttack()).toBe(true);
  });

  it("offHandAttackDamage skips this hero's ability modifier without the Two-Weapon Fighting feat", () => {
    const hero = heroFromBuild(); // Fighter, STR 15 (+2 mod)
    hero.equippedItems.weapon = "shortsword";
    hero.equippedItems.shield = "handaxe"; // 1d6, no Finesse — pure STR weapon, unambiguous
    expect(hero.offHandAttackDamage).toBe(4); // averageDiceDamage("1d6") = 4, no ability mod
  });

  it("offHandAttackDamage adds this hero's ability modifier WITH the Two-Weapon Fighting feat", () => {
    const hero = heroFromBuild(); // Fighter, STR 15 (+2 mod)
    hero.equippedItems.weapon = "shortsword";
    hero.equippedItems.shield = "handaxe";
    hero.grantFeat("two-weapon-fighting");
    expect(hero.offHandAttackDamage).toBe(6); // 4 + STR mod(+2)
  });

  it("offHandAttackDamage is 0 without a valid off-hand weapon", () => {
    const hero = heroFromBuild();
    hero.equippedItems.weapon = "shortsword";
    expect(hero.offHandAttackDamage).toBe(0);
  });
});
