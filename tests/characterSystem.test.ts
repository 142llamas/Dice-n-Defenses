import { describe, it, expect } from "vitest";
import { abilityModifier, modifierFor, STANDARD_ARRAY, type AbilityScores } from "../src/game/data/abilityScores";
import { FIGHTER, WIZARD, ROGUE, CLERIC, getClassDefinition, CLASS_DEFINITIONS } from "../src/game/data/classes";
import {
  proficiencyBonusForLevel,
  fixedHitDieGain,
  maxHitPointsForClass,
  attacksPerActionForClassAtLevel,
  featuresUpToLevel,
  featuresAtLevel,
  activeFeaturesUpToLevel,
  bonusDamageForClassAtLevel,
  attackStyleForAbility,
  combatStatsForClassLevel,
  savingThrowBonus,
  spellSaveDC,
  asiFeatureGrantedAtLevel,
} from "../src/game/systems/CharacterSystem";

/**
 * Phase 11.1 ("D&D character foundation," DECISIONS D-071/D-072) — the first
 * slice of the D&D 5.5e character system: ability scores, proficiency bonus,
 * and one fully-built class (Fighter). Pure rules engine only; nothing here
 * is wired into `Hero`/`BattleScene` yet (see the module comments in
 * `data/classes.ts` and `systems/CharacterSystem.ts`).
 */

describe("ability scores", () => {
  it("computes the SRD modifier formula, rounding down", () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(9)).toBe(-1); // floor((9-10)/2) = floor(-0.5) = -1, not 0
    expect(abilityModifier(15)).toBe(2);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(20)).toBe(5);
  });

  it("reads a modifier out of a full score set", () => {
    const scores: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    expect(modifierFor(scores, "str")).toBe(2);
    expect(modifierFor(scores, "cha")).toBe(-1);
  });

  it("the standard array has exactly six values matching the SRD default set", () => {
    expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]);
  });
});

describe("proficiency bonus by level", () => {
  it("follows the SRD's +2 at 1-4, +1 every 4 levels thereafter, capped at +6", () => {
    expect(proficiencyBonusForLevel(1)).toBe(2);
    expect(proficiencyBonusForLevel(4)).toBe(2);
    expect(proficiencyBonusForLevel(5)).toBe(3);
    expect(proficiencyBonusForLevel(8)).toBe(3);
    expect(proficiencyBonusForLevel(9)).toBe(4);
    expect(proficiencyBonusForLevel(12)).toBe(4);
    expect(proficiencyBonusForLevel(13)).toBe(5);
    expect(proficiencyBonusForLevel(16)).toBe(5);
    expect(proficiencyBonusForLevel(17)).toBe(6);
    expect(proficiencyBonusForLevel(20)).toBe(6);
  });

  it("rejects levels outside 1-20", () => {
    expect(() => proficiencyBonusForLevel(0)).toThrow();
    expect(() => proficiencyBonusForLevel(21)).toThrow();
    expect(() => proficiencyBonusForLevel(1.5)).toThrow();
  });
});

describe("the Fighter class table", () => {
  it("is registered and reachable by id", () => {
    expect(getClassDefinition("fighter")).toBe(FIGHTER);
    expect(CLASS_DEFINITIONS).toContain(FIGHTER);
    expect(getClassDefinition("wizard")).toBe(WIZARD); // added Phase 11.2
    expect(getClassDefinition("rogue")).toBe(ROGUE); // added Phase 11.3
    expect(getClassDefinition("cleric")).toBe(CLERIC); // added Phase 11.3
    expect(getClassDefinition("bard")).toBeDefined(); // added Phase 13.8 (D-093)
    expect(() => getClassDefinition("necromancer")).toThrow(); // still not a real class
  });

  it("has a d10 hit die and STR/CON saving throw proficiencies", () => {
    expect(FIGHTER.hitDie).toBe(10);
    expect(FIGHTER.savingThrowProficiencies).toEqual(["str", "con"]);
  });

  it("grants Extra Attack at 5, 11, and 20, and only those levels", () => {
    expect(attacksPerActionForClassAtLevel(FIGHTER, 1)).toBe(1);
    expect(attacksPerActionForClassAtLevel(FIGHTER, 4)).toBe(1);
    expect(attacksPerActionForClassAtLevel(FIGHTER, 5)).toBe(2);
    expect(attacksPerActionForClassAtLevel(FIGHTER, 10)).toBe(2);
    expect(attacksPerActionForClassAtLevel(FIGHTER, 11)).toBe(3);
    expect(attacksPerActionForClassAtLevel(FIGHTER, 19)).toBe(3);
    expect(attacksPerActionForClassAtLevel(FIGHTER, 20)).toBe(4);
  });

  it("lists every feature gained by level 1 (Fighting Style, Second Wind) and no more", () => {
    const atOne = featuresAtLevel(FIGHTER, 1);
    expect(atOne.map((f) => f.name).sort()).toEqual(["Fighting Style", "Second Wind"]);
  });

  it("accumulates features across levels without losing earlier ones", () => {
    const upToFive = featuresUpToLevel(FIGHTER, 5);
    const names = upToFive.map((f) => f.name);
    expect(names).toContain("Fighting Style"); // level 1
    expect(names).toContain("Action Surge"); // level 2
    expect(names).toContain("Extra Attack"); // level 5
    expect(upToFive.every((f) => f.level <= 5)).toBe(true);
  });

  it("marks features this game still can't act on yet as mechanicallyActive: false", () => {
    const archetypeFeature = FIGHTER.features.find((f) => f.level === 10 && f.name === "Martial Archetype Feature")!;
    expect(archetypeFeature.mechanicallyActive).toBe(false);
  });

  it("marks Indomitable (all three use tiers) as mechanically active (D-124)", () => {
    const indomitable = FIGHTER.features.find((f) => f.name === "Indomitable")!;
    const indomitable2 = FIGHTER.features.find((f) => f.name === "Indomitable (2 uses)")!;
    const indomitable3 = FIGHTER.features.find((f) => f.name === "Indomitable (3 uses)")!;
    expect(indomitable.mechanicallyActive).toBe(true);
    expect(indomitable2.mechanicallyActive).toBe(true);
    expect(indomitable3.mechanicallyActive).toBe(true);
  });

  it("marks Extra Attack as mechanically active — it's just a derived number today", () => {
    const extraAttack5 = FIGHTER.features.find((f) => f.level === 5 && f.name === "Extra Attack")!;
    expect(extraAttack5.mechanicallyActive).toBe(true);
  });

  it("marks Second Wind and Action Surge as mechanically active (Phase 13.2, D-087)", () => {
    const secondWind = FIGHTER.features.find((f) => f.name === "Second Wind")!;
    const actionSurge = FIGHTER.features.find((f) => f.name === "Action Surge")!;
    expect(secondWind.mechanicallyActive).toBe(true);
    expect(actionSurge.mechanicallyActive).toBe(true);
  });

  it("activeFeaturesUpToLevel only surfaces features that do something right now", () => {
    const active20 = activeFeaturesUpToLevel(FIGHTER, 20);
    // Phase 13.6 (D-091): every "Ability Score Improvement" entry is now
    // mechanically active too (Fighter gets two bonus ones, at 6 and 14, on
    // top of the standard 4/8/12/16/19 every class shares). D-124: all three
    // Indomitable tiers (9/13/17) are now active too — Action Surge's own
    // "2 uses" tier (also 17) stays inert, a separate, smaller, still-deferred item.
    expect(active20.map((f) => f.name)).toEqual([
      "Second Wind",
      "Action Surge",
      "Ability Score Improvement",
      "Extra Attack",
      "Ability Score Improvement",
      "Ability Score Improvement",
      "Indomitable",
      "Extra Attack (2)",
      "Ability Score Improvement",
      "Indomitable (2 uses)",
      "Ability Score Improvement",
      "Ability Score Improvement",
      "Indomitable (3 uses)",
      "Ability Score Improvement",
      "Extra Attack (3)",
    ]);
  });
});

describe("the Wizard class table (Phase 11.2, D-074)", () => {
  it("has a d6 hit die, INT/WIS saving throw proficiencies, and INT as its primary ability", () => {
    expect(WIZARD.hitDie).toBe(6);
    expect(WIZARD.savingThrowProficiencies).toEqual(["int", "wis"]);
    expect(WIZARD.primaryAbility).toBe("int");
  });

  it("never grants Extra Attack — the same attacksPerActionByLevel lookup stays 1 forever", () => {
    expect(attacksPerActionForClassAtLevel(WIZARD, 1)).toBe(1);
    expect(attacksPerActionForClassAtLevel(WIZARD, 20)).toBe(1);
  });

  it("marks Spellcasting as mechanically active — cantrips are real today", () => {
    const spellcasting = WIZARD.features.find((f) => f.name === "Spellcasting")!;
    expect(spellcasting.mechanicallyActive).toBe(true);
  });

  it("marks the subclass placeholder features as inert for now, but Ability Score Improvement/Spell Mastery/Signature Spells as active (Phase 13.6 D-091, Phase 5 D-125)", () => {
    const others = WIZARD.features.filter(
      (f) =>
        f.name !== "Spellcasting" &&
        f.name !== "Ability Score Improvement" &&
        f.name !== "Spell Mastery" &&
        f.name !== "Signature Spells",
    );
    expect(others.every((f) => f.mechanicallyActive === false)).toBe(true);
    const active = WIZARD.features.filter(
      (f) => f.name === "Ability Score Improvement" || f.name === "Spell Mastery" || f.name === "Signature Spells",
    );
    expect(active.every((f) => f.mechanicallyActive === true)).toBe(true);
  });
});

describe("the Rogue class table (Phase 11.3, D-075)", () => {
  it("has a d8 hit die and DEX/INT saving throw proficiencies", () => {
    expect(ROGUE.hitDie).toBe(8);
    expect(ROGUE.savingThrowProficiencies).toEqual(["dex", "int"]);
    expect(ROGUE.primaryAbility).toBe("dex");
  });

  it("never gains Extra Attack — the lookup stays 1 forever", () => {
    expect(attacksPerActionForClassAtLevel(ROGUE, 1)).toBe(1);
    expect(attacksPerActionForClassAtLevel(ROGUE, 20)).toBe(1);
  });

  it("chooses its subclass (Roguish Archetype) at level 3", () => {
    expect(featuresAtLevel(ROGUE, 3).map((f) => f.name)).toContain("Roguish Archetype");
  });

  it("marks Sneak Attack, Cunning Action, and Uncanny Dodge as mechanically active (Phase 13.2, D-087 wired the latter two)", () => {
    const active = activeFeaturesUpToLevel(ROGUE, 20);
    // Phase 13.6 (D-091): every "Ability Score Improvement" entry (4/8/10/12/16/19) is now active too.
    // D-124: Evasion (7) and Elusive (18) are now active too.
    // D-127: Blindsense (14) is now active too.
    expect(active.map((f) => f.name)).toEqual([
      "Sneak Attack",
      "Cunning Action",
      "Ability Score Improvement",
      "Uncanny Dodge",
      "Evasion",
      "Ability Score Improvement",
      "Ability Score Improvement",
      "Ability Score Improvement",
      "Blindsense",
      "Ability Score Improvement",
      "Elusive",
      "Ability Score Improvement",
    ]);
  });
});

describe("the Cleric class table (Phase 11.3, D-075)", () => {
  it("has a d8 hit die, WIS/CHA saving throw proficiencies, and WIS as its primary ability", () => {
    expect(CLERIC.hitDie).toBe(8);
    expect(CLERIC.savingThrowProficiencies).toEqual(["wis", "cha"]);
    expect(CLERIC.primaryAbility).toBe("wis");
  });

  it("chooses its subclass (Divine Domain) at level 1 — earlier than Fighter/Wizard/Rogue", () => {
    expect(featuresAtLevel(CLERIC, 1).map((f) => f.name)).toContain("Divine Domain");
  });

  it("shares the exact same cantrips-known and spell-slot tables as the Wizard (every SRD full caster does)", () => {
    expect(CLERIC.spellcasting?.cantripsKnownByLevel).toEqual(WIZARD.spellcasting?.cantripsKnownByLevel);
    expect(CLERIC.spellcasting?.spellSlotsByLevel).toEqual(WIZARD.spellcasting?.spellSlotsByLevel);
    expect(CLERIC.spellcasting?.spellcastingAbility).toBe("wis");
  });

  it("marks Spellcasting and every Ability Score Improvement as mechanically active (Phase 13.6, D-091)", () => {
    const active = activeFeaturesUpToLevel(CLERIC, 20);
    expect(active.map((f) => f.name)).toEqual([
      "Spellcasting",
      "Ability Score Improvement",
      "Ability Score Improvement",
      "Ability Score Improvement",
      "Ability Score Improvement",
      "Ability Score Improvement",
    ]);
  });
});

describe("bonusDamageForClassAtLevel (Phase 11.3, D-075 — the Rogue's Sneak Attack)", () => {
  it("is always 0 for a class with no rider (Fighter, Wizard, Cleric)", () => {
    expect(bonusDamageForClassAtLevel(FIGHTER, 20)).toBe(0);
    expect(bonusDamageForClassAtLevel(WIZARD, 20)).toBe(0);
    expect(bonusDamageForClassAtLevel(CLERIC, 20)).toBe(0);
  });

  it("gives the Rogue +4 at level 1, growing every odd level, capping at +40 by level 19", () => {
    expect(bonusDamageForClassAtLevel(ROGUE, 1)).toBe(4);
    expect(bonusDamageForClassAtLevel(ROGUE, 2)).toBe(4); // unchanged until the next odd level
    expect(bonusDamageForClassAtLevel(ROGUE, 5)).toBe(12);
    expect(bonusDamageForClassAtLevel(ROGUE, 19)).toBe(40);
    expect(bonusDamageForClassAtLevel(ROGUE, 20)).toBe(40);
  });
});

describe("HP by class level", () => {
  it("level 1 is max hit die + CON modifier", () => {
    expect(maxHitPointsForClass(FIGHTER, 1, 2)).toBe(10 + 2);
    expect(maxHitPointsForClass(FIGHTER, 1, -1)).toBe(10 - 1);
  });

  it("each level after the first adds the fixed average die value + CON modifier", () => {
    // d10 average, rounded up: floor(10/2)+1 = 6
    expect(fixedHitDieGain(10)).toBe(6);
    // level 2 Fighter, CON +2: 12 (L1) + 6 + 2 (L2) = 20
    expect(maxHitPointsForClass(FIGHTER, 2, 2)).toBe(12 + 8);
  });

  it("never drops below 1 HP per level even with a very negative CON modifier", () => {
    expect(maxHitPointsForClass(FIGHTER, 3, -5)).toBeGreaterThanOrEqual(3);
  });
});

describe("combatStatsForClassLevel (Phase 13.3, D-089)", () => {
  const kaelScores: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

  it("matches heroDefinitionFromBuild's own level-1 math for a Fighter (regression check for the D-089 refactor)", () => {
    const stats = combatStatsForClassLevel("fighter", 1, kaelScores, "cleave");
    expect(stats.maxHealth).toBe(11); // hitDie(10) + CON mod(+1)
    expect(stats.attackDamage).toBe(4); // base 2 + STR mod(+2)
    expect(stats.attackBonus).toBe(4); // proficiency(+2) + STR mod(+2)
    expect(stats.attacksPerAction).toBe(1);
  });

  it("recomputes every number at a later Fighter level, including Extra Attack at 5", () => {
    const stats = combatStatsForClassLevel("fighter", 5, kaelScores, "cleave");
    expect(stats.maxHealth).toBe(11 + fixedHitDieGain(10) * 4 + 1 * 4); // levels 2-5, CON +1 each
    expect(stats.attackBonus).toBe(3 + 2); // proficiency(+3 at 5) + STR mod(+2)
    expect(stats.attacksPerAction).toBe(2);
  });

  it("scales a Rogue's Sneak Attack rider into attackDamage as level rises", () => {
    const level1 = combatStatsForClassLevel("rogue", 1, kaelScores, "piercing-shot");
    const level5 = combatStatsForClassLevel("rogue", 5, kaelScores, "piercing-shot");
    expect(level1.attackDamage).toBe(8); // base 2 + DEX mod(+2) + Sneak Attack(+4)
    expect(level5.attackDamage).toBe(16); // base 2 + DEX mod(+2) + Sneak Attack(+12)
  });

  it("uses the spellcasting ability, not STR/DEX, for a caster's spell-based signature action", () => {
    const stats = combatStatsForClassLevel("wizard", 1, kaelScores, "fire-bolt");
    // INT 12 -> +1 mod, not DEX 14 -> +2 (fire-bolt is ranged, but it's a spell).
    expect(stats.attackDamage).toBe(3);
  });
});

describe("attackStyleForAbility (Phase 13.3, D-089: moved here from CharacterBuildSystem)", () => {
  it("still classifies melee/ranged abilities the same way", () => {
    expect(attackStyleForAbility("cleave")).toBe("melee");
    expect(attackStyleForAbility("piercing-shot")).toBe("ranged");
  });
});

describe("savingThrowBonus (Phase 13.5, D-090)", () => {
  const kaelScores: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

  it("adds proficiency bonus on top of the ability modifier when the class is proficient", () => {
    // Fighter is proficient in STR/CON. STR 15 -> +2 mod; level 1 proficiency +2.
    expect(savingThrowBonus(FIGHTER, 1, kaelScores, "str")).toBe(4);
  });

  it("is just the ability modifier, no proficiency, when the class is NOT proficient", () => {
    // Fighter is not proficient in WIS. WIS 10 -> +0 mod, no proficiency added.
    expect(savingThrowBonus(FIGHTER, 1, kaelScores, "wis")).toBe(0);
  });

  it("scales the proficiency bonus with level, for a class that IS proficient", () => {
    // Cleric is proficient in WIS. WIS 10 -> +0 mod; level 9 proficiency +4.
    expect(savingThrowBonus(CLERIC, 9, kaelScores, "wis")).toBe(4);
  });
});

describe("spellSaveDC (Phase 13.5, D-090)", () => {
  const clericScores: AbilityScores = { str: 8, dex: 12, con: 13, int: 10, wis: 16, cha: 10 };

  it("is 8 + proficiency bonus + the caster's spellcasting ability modifier", () => {
    // WIS 16 -> +3 mod; level 1 proficiency +2; DC = 8 + 2 + 3 = 13.
    expect(spellSaveDC(CLERIC, 1, clericScores)).toBe(13);
  });

  it("rises with level as proficiency bonus rises", () => {
    // Level 5 proficiency +3; DC = 8 + 3 + 3 = 14.
    expect(spellSaveDC(CLERIC, 5, clericScores)).toBe(14);
  });

  it("throws for a class with no spellcasting to derive a DC from", () => {
    expect(() => spellSaveDC(FIGHTER, 1, clericScores)).toThrow();
    expect(() => spellSaveDC(ROGUE, 1, clericScores)).toThrow();
  });
});

describe("asiFeatureGrantedAtLevel (Phase 13.6, D-091)", () => {
  it("is true at the standard 4/8/12/16/19 levels for a class with no bonus ASIs (Wizard, Cleric)", () => {
    for (const level of [4, 8, 12, 16, 19]) {
      expect(asiFeatureGrantedAtLevel(WIZARD, level)).toBe(true);
      expect(asiFeatureGrantedAtLevel(CLERIC, level)).toBe(true);
    }
  });

  it("is true at the standard levels PLUS the Fighter's two bonus ASIs (6 and 14)", () => {
    for (const level of [4, 6, 8, 12, 14, 16, 19]) {
      expect(asiFeatureGrantedAtLevel(FIGHTER, level)).toBe(true);
    }
  });

  it("is true at the Rogue's own ASI levels (4/8/10/12/16/19)", () => {
    for (const level of [4, 8, 10, 12, 16, 19]) {
      expect(asiFeatureGrantedAtLevel(ROGUE, level)).toBe(true);
    }
  });

  it("is false at every level that doesn't grant one", () => {
    for (const level of [1, 2, 3, 5, 7, 9, 11, 13, 15, 17, 18, 20]) {
      expect(asiFeatureGrantedAtLevel(FIGHTER, level)).toBe(false);
    }
    expect(asiFeatureGrantedAtLevel(WIZARD, 6)).toBe(false); // Fighter-only bonus ASI level
    expect(asiFeatureGrantedAtLevel(CLERIC, 10)).toBe(false); // Rogue-only ASI level
  });
});
