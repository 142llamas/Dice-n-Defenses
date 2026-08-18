import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import { getClassDefinition, CLASS_DEFINITIONS } from "../src/game/data/classes";
import { combatStatsForClassLevel, asiFeatureGrantedAtLevel } from "../src/game/systems/CharacterSystem";
import { spellSlotsForClassAtLevel, cantripsKnownForClassAtLevel } from "../src/game/systems/SpellcastingSystem";

/**
 * Phase 13.8 (DECISIONS D-093): the remaining eight core SRD classes
 * (Barbarian, Bard, Druid, Monk, Paladin, Ranger, Sorcerer, Warlock), each
 * with a genuinely active signature mechanic rather than the earlier
 * "one flashy hook, everything else inert" pattern.
 */

const NEW_CLASS_IDS = ["barbarian", "bard", "druid", "monk", "paladin", "ranger", "sorcerer", "warlock"];

function buildFor(classId: string, abilityId: string, overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: `build-${classId}`,
    name: "Test",
    raceId: "human",
    classId,
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    abilityId,
    controlledBy: "human",
    ...overrides,
  };
}

function heroFrom(build: CharacterBuild): Hero {
  return new Hero(heroDefinitionFromBuild(build), { x: 0, y: 0 });
}

function barbarian(): Hero {
  return heroFrom(buildFor("barbarian", "cleave"));
}
function bard(): Hero {
  return heroFrom(buildFor("bard", "vicious-mockery"));
}
function druid(): Hero {
  return heroFrom(buildFor("druid", "produce-flame"));
}
function monk(overrides: Partial<CharacterBuild> = {}): Hero {
  return heroFrom(buildFor("monk", "cleave", overrides));
}
function paladin(): Hero {
  return heroFrom(buildFor("paladin", "cleave"));
}
function ranger(): Hero {
  return heroFrom(buildFor("ranger", "cleave"));
}
function sorcerer(overrides: Partial<CharacterBuild> = {}): Hero {
  return heroFrom(buildFor("sorcerer", "fire-bolt", overrides));
}
function warlock(): Hero {
  return heroFrom(buildFor("warlock", "eldritch-blast"));
}

describe("CLASS_DEFINITIONS (Phase 13.8, D-093)", () => {
  it("registers all twelve classes, each reachable by id", () => {
    for (const id of ["fighter", "wizard", "rogue", "cleric", ...NEW_CLASS_IDS]) {
      expect(() => getClassDefinition(id)).not.toThrow();
    }
    expect(CLASS_DEFINITIONS.length).toBe(12);
  });

  it("gives Barbarian a d12 hit die and STR/CON saves", () => {
    const barb = getClassDefinition("barbarian");
    expect(barb.hitDie).toBe(12);
    expect(barb.savingThrowProficiencies).toEqual(["str", "con"]);
    expect(barb.attacksPerActionByLevel[5]).toBe(2); // Extra Attack
  });

  it("gives every full/half caster a spellcasting progression", () => {
    for (const id of ["bard", "druid", "sorcerer", "warlock", "paladin", "ranger"]) {
      expect(getClassDefinition(id).spellcasting).toBeDefined();
    }
  });

  it("Paladin/Ranger are half-casters: a real slot from level 1 (D-134: SRD 5.2.1 moved this earlier than 2014's level 2), no cantrips ever", () => {
    for (const id of ["paladin", "ranger"]) {
      const def = getClassDefinition(id);
      expect(spellSlotsForClassAtLevel(def, 1)).toEqual([2]);
      expect(spellSlotsForClassAtLevel(def, 2)).toEqual([2]);
      expect(cantripsKnownForClassAtLevel(def, 5)).toBe(0);
    }
  });

  it("Warlock shares the full-caster slot table (a deliberate D-093 simplification)", () => {
    expect(spellSlotsForClassAtLevel(getClassDefinition("warlock"), 1)).toEqual([2]);
  });

  it("asiFeatureGrantedAtLevel finds the level-4 Ability Score Improvement generically for a new class", () => {
    expect(asiFeatureGrantedAtLevel(getClassDefinition("barbarian"), 4)).toBe(true);
    expect(asiFeatureGrantedAtLevel(getClassDefinition("sorcerer"), 4)).toBe(true);
    expect(asiFeatureGrantedAtLevel(getClassDefinition("barbarian"), 5)).toBe(false);
  });
});

describe("Monk's Martial Arts: melee attacks scale off DEX, not STR (Phase 13.8, D-093)", () => {
  it("a Monk's melee attackBonus/damage move with DEX, unaffected by STR", () => {
    const scores = { str: 8, dex: 18, con: 13, int: 10, wis: 10, cha: 10 };
    const monkStats = combatStatsForClassLevel("monk", 1, scores, "cleave"); // cleave: rangeTiles 1 -> melee
    const fighterStats = combatStatsForClassLevel("fighter", 1, scores, "cleave");
    expect(monkStats.attackBonus).toBeGreaterThan(fighterStats.attackBonus);
  });
});

describe("Barbarian Rage (Phase 13.8, D-093)", () => {
  it("is only usable by a Barbarian, as a bonus action", () => {
    expect(barbarian().canUseRage()).toBe(true);
    expect(paladin().canUseRage()).toBe(false);
  });

  it("halves incoming damage and boosts attack damage while raging, for a limited number of turns", () => {
    const hero = barbarian();
    const baseDamage = hero.effectiveAttackDamage;
    expect(hero.isRaging).toBe(false);
    hero.useRage();
    expect(hero.isRaging).toBe(true);
    expect(hero.hasDamageResistance).toBe(true);
    expect(hero.effectiveAttackDamage).toBeGreaterThan(baseDamage);
    for (let i = 0; i < 10; i++) hero.resetForNewTurn();
    expect(hero.isRaging).toBe(false); // duration ran out
  });

  it("has a limited number of uses per Long Rest, restored only by a Long Rest", () => {
    const hero = barbarian();
    let uses = 0;
    while (hero.canUseRage()) {
      hero.useRage();
      uses += 1;
      for (let i = 0; i < 10; i++) hero.resetForNewTurn(); // end the buff so canUseRage isn't blocked by "already raging"
      hero.resetForNewTurn(); // clear bonusActed too
    }
    expect(uses).toBeGreaterThan(0);
    expect(hero.canUseRage()).toBe(false);
    hero.shortRest();
    expect(hero.canUseRage()).toBe(false); // Rage does NOT recharge on a Short Rest
    hero.longRest();
    expect(hero.canUseRage()).toBe(true);
  });

  it("a Short Rest ends an active Rage early", () => {
    const hero = barbarian();
    hero.useRage();
    expect(hero.isRaging).toBe(true);
    hero.shortRest();
    expect(hero.isRaging).toBe(false);
  });
});

describe("Druid Wild Shape (Phase 13.8, D-093)", () => {
  it("is locked out at level 1 (SRD: Wild Shape starts at level 2)", () => {
    const hero = druid();
    expect(hero.canUseWildShape()).toBe(false);
    hero.levelUpClass();
    expect(hero.canUseWildShape()).toBe(true);
  });

  it("heals a flat amount and grants damage resistance", () => {
    const hero = druid();
    hero.levelUpClass();
    hero.health = Math.max(1, hero.health - 3);
    const before = hero.health;
    hero.useWildShape();
    expect(hero.health).toBeGreaterThan(before);
    expect(hero.hasDamageResistance).toBe(true);
  });
});

describe("Monk Ki / Flurry of Blows (Phase 13.8, D-093)", () => {
  it("is locked out at level 1 (SRD: Ki starts at level 2)", () => {
    const hero = monk();
    hero.markActed();
    expect(hero.canUseFlurryOfBlows()).toBe(false); // level 1, even though acted
    hero.levelUpClass(); // level 2
    expect(hero.canUseFlurryOfBlows()).toBe(true);
  });

  it("requires having already acted this turn", () => {
    const hero = monk();
    hero.levelUpClass(); // level 2
    expect(hero.canUseFlurryOfBlows()).toBe(false); // hasn't acted yet
    hero.markActed();
    expect(hero.canUseFlurryOfBlows()).toBe(true);
  });

  it("un-consumes the action slot for another attack, spending a Ki point and the bonus action", () => {
    const hero = monk();
    hero.levelUpClass(); // level 2
    hero.markActed();
    expect(hero.canUseFlurryOfBlows()).toBe(true);
    hero.useFlurryOfBlows();
    expect(hero.canAct()).toBe(true); // action un-consumed
    expect(hero.canUseBonusAction()).toBe(false); // bonus action spent
  });

  it("Ki points recharge on both a Short Rest and a Long Rest (unlike Rage)", () => {
    const hero = monk();
    hero.levelUpClass();
    let uses = 0;
    hero.markActed();
    while (hero.canUseFlurryOfBlows()) {
      hero.useFlurryOfBlows();
      uses += 1;
      hero.resetForNewTurn(); // clears bonusActed so the next iteration's gate is ki alone
      hero.markActed();
    }
    expect(uses).toBeGreaterThan(0);
    expect(hero.canUseFlurryOfBlows()).toBe(false);
    hero.shortRest();
    hero.markActed();
    expect(hero.canUseFlurryOfBlows()).toBe(true);
  });
});

describe("Bard Bardic Inspiration (Phase 13.8, D-093)", () => {
  it("grants a target hero (possibly itself) a flat bonus, consumed on its next attack", () => {
    const singer = bard();
    const other = barbarian();
    expect(other.pendingInspirationBonus).toBe(0);
    singer.useBardicInspiration();
    other.receiveInspiration(4);
    expect(other.pendingInspirationBonus).toBe(4);
    other.clearInspiration();
    expect(other.pendingInspirationBonus).toBe(0);
  });

  it("has a limited number of uses, restored only by a Long Rest until Font of Inspiration (level 5)", () => {
    const hero = bard();
    let uses = 0;
    while (hero.canUseBardicInspiration()) {
      hero.useBardicInspiration();
      uses += 1;
      hero.resetForNewTurn();
    }
    expect(uses).toBeGreaterThan(0);
    hero.shortRest();
    expect(hero.canUseBardicInspiration()).toBe(false); // level 1: no Font of Inspiration yet
    for (let i = 0; i < 4; i++) hero.levelUpClass(); // level 5
    hero.shortRest();
    expect(hero.canUseBardicInspiration()).toBe(true); // Font of Inspiration: Short Rest now recharges it
  });
});

describe("Sorcerer Metamagic: Quickened Spell (Phase 13.8, D-093)", () => {
  it("is locked out before level 3 and once the action is already spent", () => {
    const hero = sorcerer();
    expect(hero.canUseQuickenSpell()).toBe(false); // level 1
    for (let i = 0; i < 2; i++) hero.levelUpClass(); // level 3
    expect(hero.canUseQuickenSpell()).toBe(true);
    hero.markActed();
    expect(hero.canUseQuickenSpell()).toBe(false); // already acted
  });

  it("markActedForSpellCast consumes the quicken flag instead of the action slot, exactly once", () => {
    const hero = sorcerer();
    for (let i = 0; i < 2; i++) hero.levelUpClass();
    hero.useQuickenSpell();
    expect(hero.canAct()).toBe(true); // not yet consumed
    hero.markActedForSpellCast();
    expect(hero.canAct()).toBe(true); // quicken absorbed it — action stays free
    hero.markActedForSpellCast();
    expect(hero.canAct()).toBe(false); // quicken already spent — this one really consumes the action
  });

  it("a hero who never used Quicken just has markActedForSpellCast behave like markActed", () => {
    const hero = sorcerer();
    expect(hero.canAct()).toBe(true);
    hero.markActedForSpellCast();
    expect(hero.canAct()).toBe(false);
  });
});

describe("Ranger Hunter's Mark (Phase 13.8, D-093)", () => {
  it("is locked out at level 1 (spellcasting starts at level 2) and requires a 1st-level slot", () => {
    const hero = ranger();
    expect(hero.canUseHuntersMark()).toBe(false);
    hero.levelUpClass(); // level 2: gains a 1st-level slot
    expect(hero.canUseHuntersMark()).toBe(true);
  });

  it("marks a target, spending a 1st-level slot and the bonus action", () => {
    const hero = ranger();
    hero.levelUpClass();
    const before = hero.spellSlotsRemainingAt(1);
    hero.useHuntersMark("enemy-1");
    expect(hero.markedEnemyId).toBe("enemy-1");
    expect(hero.spellSlotsRemainingAt(1)).toBe(before - 1);
    expect(hero.canUseBonusAction()).toBe(false);
  });
});

describe("Warlock Pact Magic (Phase 13.8, D-093)", () => {
  it("restores spell slots on a SHORT rest, unlike every other caster class here", () => {
    const hero = warlock();
    hero.spendSpellSlot(1);
    hero.spendSpellSlot(1);
    expect(hero.spellSlotsRemainingAt(1)).toBe(0);
    hero.shortRest();
    expect(hero.spellSlotsRemainingAt(1)).toBe(2);
  });
});

describe("Paladin Divine Smite's slot economy (Phase 13.8, D-093)", () => {
  it("has a real 1st-level slot from level 1 (D-134: SRD 5.2.1 moved this earlier than 2014's level 2)", () => {
    const hero = paladin();
    expect(hero.spellSlotsRemainingAt(1)).toBeGreaterThan(0);
  });
});
