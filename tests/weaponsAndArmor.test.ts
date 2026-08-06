import { describe, it, expect } from "vitest";
import { WEAPON_DEFINITIONS, WEAPON_ORDER, WEAPON_MASTERIES, type WeaponMasteryId } from "../src/game/data/weapons";
import { ARMOR_DEFINITIONS, ARMOR_ORDER, SHIELD_DEFINITIONS } from "../src/game/data/armor";
import { EQUIPMENT_DEFINITIONS, EQUIPMENT_ORDER, getEquipmentDefinition } from "../src/game/data/equipment";

/**
 * Phase 17 (D-108): the real SRD 5.2.1 (2024 rules, CC-BY-4.0) weapon/armor
 * catalogue and weapon-mastery property table. These tests check STRUCTURAL
 * properties of the full catalogue (counts, every mastery id resolves, every
 * item merges correctly into the shared equipment registry) rather than
 * hardcoding all 36+12 ids individually — same style as `tests/spells.test.ts`'s
 * catalogue-count checks.
 */

describe("WEAPON_DEFINITIONS", () => {
  it("has exactly 36 weapons (the SRD's 38 core weapons minus the 2 firearms this fantasy setting excludes)", () => {
    expect(WEAPON_ORDER.length).toBe(36);
    expect(Object.keys(WEAPON_DEFINITIONS).length).toBe(36);
  });

  it("every weapon has a real mastery id, a valid dice expression, and lands in the weapon slot", () => {
    const diceRe = /^(\d+d\d+|\d+)$/;
    for (const id of WEAPON_ORDER) {
      const def = WEAPON_DEFINITIONS[id];
      expect(def.slot).toBe("weapon");
      expect(def.weapon).toBeDefined();
      const w = def.weapon!;
      expect(WEAPON_MASTERIES[w.mastery]).toBeDefined();
      expect(w.damageDice).toMatch(diceRe);
      if (w.versatileDamageDice) expect(w.versatileDamageDice).toMatch(diceRe);
      expect(["simple", "martial"]).toContain(w.category);
      expect(["melee", "ranged"]).toContain(w.kind);
      expect(["bludgeoning", "piercing", "slashing"]).toContain(w.damageType);
    }
  });

  it("every one of the 8 real SRD mastery properties is assigned to at least one weapon", () => {
    const used = new Set<WeaponMasteryId>(WEAPON_ORDER.map((id) => WEAPON_DEFINITIONS[id].weapon!.mastery));
    expect(used).toEqual(new Set(Object.keys(WEAPON_MASTERIES) as WeaponMasteryId[]));
    expect(used.size).toBe(8);
  });

  it("all 8 mastery properties are mechanically active, including Nick (Phase 19, D-110's dual-wielding system)", () => {
    for (const id of Object.keys(WEAPON_MASTERIES) as WeaponMasteryId[]) {
      expect(WEAPON_MASTERIES[id].mechanicallyActive).toBe(true);
    }
  });

  it("only a Versatile weapon carries a versatileDamageDice", () => {
    for (const id of WEAPON_ORDER) {
      const w = WEAPON_DEFINITIONS[id].weapon!;
      if (w.versatileDamageDice) expect(w.properties).toContain("versatile");
      if (w.properties.includes("versatile")) expect(w.versatileDamageDice).toBeDefined();
    }
  });

  it("Net (a 2014 SRD 5.1 weapon cut from the 2024 SRD) and the two core firearms are NOT present", () => {
    expect(WEAPON_DEFINITIONS["net"]).toBeUndefined();
    expect(WEAPON_DEFINITIONS["musket"]).toBeUndefined();
    expect(WEAPON_DEFINITIONS["pistol"]).toBeUndefined();
  });
});

describe("ARMOR_DEFINITIONS / SHIELD_DEFINITIONS", () => {
  it("has exactly 12 armors (3 light + 5 medium + 4 heavy, the SRD's complete list) plus 1 shield", () => {
    expect(ARMOR_ORDER.length).toBe(12);
    expect(Object.keys(SHIELD_DEFINITIONS).length).toBe(1);
  });

  it("every armor lands in the chest slot with a real armor field, every shield in its own slot with a flat bonus", () => {
    for (const id of ARMOR_ORDER) {
      const def = ARMOR_DEFINITIONS[id];
      expect(def.slot).toBe("chest");
      expect(def.armor).toBeDefined();
      expect(["light", "medium", "heavy"]).toContain(def.armor!.category);
      expect(["full", "capped", "none"]).toContain(def.armor!.dexMode);
    }
    const shield = SHIELD_DEFINITIONS["shield"];
    expect(shield.slot).toBe("shield");
    expect(shield.armorClass).toBe(2);
    expect(shield.armor).toBeUndefined();
  });

  it("only medium armor carries a dexCap; light is full, heavy is none", () => {
    for (const id of ARMOR_ORDER) {
      const armor = ARMOR_DEFINITIONS[id].armor!;
      if (armor.category === "light") expect(armor.dexMode).toBe("full");
      if (armor.category === "heavy") expect(armor.dexMode).toBe("none");
      if (armor.category === "medium") {
        expect(armor.dexMode).toBe("capped");
        expect(armor.dexCap).toBe(2);
      }
    }
  });

  it("heavy armor's real Strength requirements match the SRD (Ring Mail: none, Chain Mail/Splint/Plate: 13/15/15)", () => {
    expect(ARMOR_DEFINITIONS["ring-mail"].armor!.strengthRequirement).toBeUndefined();
    expect(ARMOR_DEFINITIONS["chain-mail"].armor!.strengthRequirement).toBe(13);
    expect(ARMOR_DEFINITIONS["splint-armor"].armor!.strengthRequirement).toBe(15);
    expect(ARMOR_DEFINITIONS["plate-armor"].armor!.strengthRequirement).toBe(15);
  });
});

describe("Merged equipment registry", () => {
  it("every weapon/armor/shield id is reachable through the shared getEquipmentDefinition lookup", () => {
    for (const id of [...WEAPON_ORDER, ...ARMOR_ORDER, "shield"]) {
      expect(getEquipmentDefinition(id).id).toBe(id);
    }
  });

  it("EQUIPMENT_ORDER and EQUIPMENT_DEFINITIONS both include every new item exactly once, with no id collisions", () => {
    const ids = [...WEAPON_ORDER, ...ARMOR_ORDER, "shield"];
    for (const id of ids) {
      expect(EQUIPMENT_ORDER.filter((x) => x === id)).toHaveLength(1);
    }
    expect(Object.keys(EQUIPMENT_DEFINITIONS).length).toBe(EQUIPMENT_ORDER.length);
    expect(new Set(EQUIPMENT_ORDER).size).toBe(EQUIPMENT_ORDER.length); // no duplicates anywhere in the merged order
  });

  it("no real weapon/armor requires attunement or has a rarity above common (they're mundane, not magic)", () => {
    for (const id of [...WEAPON_ORDER, ...ARMOR_ORDER, "shield"]) {
      const def = getEquipmentDefinition(id);
      expect(def.rarity).toBe("common");
      expect(def.requiresAttunement).toBeUndefined();
    }
  });
});
