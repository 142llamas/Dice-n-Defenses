import { describe, it, expect } from "vitest";
import { Hero, MAX_ATTUNEMENTS } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import {
  getEquipmentDefinition,
  gearSlotType,
  isTwoHandedWeapon,
  EQUIPMENT_DEFINITIONS,
  EQUIPMENT_ORDER,
  RARITY_ORDER,
  type EquipmentProc,
} from "../src/game/data/equipment";

/**
 * Phase 11.5 (D-078) multi-slot equipment tests. Equipment is looked up live
 * through `Hero.equippedItems` (see Hero.armorClass/effectiveAttackDamage)
 * rather than mutating stats on equip, so swapping or clearing a slot can
 * never leave a stale bonus behind — same guarantee as Phase 7's single-slot
 * model, now summed across seven slots.
 *
 * Phase 13.1 (D-086): `defense` is renamed `armorClass`. `baseArmorClass` 10
 * means an unequipped, unarmored hero's `armorClass` is 10, not 0
 * (KNOWN_ISSUES KI-013's old "no BASE defense" framing no longer applies —
 * every hero now has the standard unarmored AC).
 */

const WREN_TEST_HERO_DEF: HeroDefinition = {
  id: "hero-wren-test",
  name: "Test Hero",
  movementTiles: 3,
  maxHealth: 8,
  attackDamage: 3, // 3 base attack dmg
  attackRangeTiles: 3,
  attackBonus: 4,
  baseArmorClass: 10,
};

function wren(): Hero {
  return new Hero(WREN_TEST_HERO_DEF, { x: 0, y: 0 }); // 3 base attack dmg
}

describe("Hero equipment", () => {
  it("has base Armor Class and no attack bonus with nothing equipped", () => {
    const hero = wren();
    expect(hero.armorClass).toBe(10);
    expect(hero.effectiveAttackDamage).toBe(3);
  });

  it("grants an equipped item's bonuses immediately", () => {
    const hero = wren();
    hero.equippedItems.chest = "iron-buckler";
    expect(hero.armorClass).toBe(10 + (getEquipmentDefinition("iron-buckler").armorClass ?? 0));
    expect(hero.effectiveAttackDamage).toBe(3); // buckler grants no attack bonus

    delete hero.equippedItems.chest;
    hero.equippedItems.ring1 = "whetstone-band";
    expect(hero.armorClass).toBe(10); // swapping away drops the old bonus completely
    expect(hero.effectiveAttackDamage).toBe(5); // 3 + 2
  });

  it("clearing a slot removes only that slot's bonus", () => {
    const hero = wren();
    hero.equippedItems.legs = "travelers-cloak";
    expect(hero.armorClass).toBeGreaterThan(10);
    delete hero.equippedItems.legs;
    expect(hero.armorClass).toBe(10);
    expect(hero.effectiveAttackDamage).toBe(3);
  });

  it("stacks with level-up bonuses (Might + gear both apply)", () => {
    const hero = wren();
    hero.grantMight(1);
    hero.equippedItems.ring1 = "whetstone-band"; // +2
    expect(hero.effectiveAttackDamage).toBe(3 + 1 + 2);
  });

  it("grantBonusHealth (D-181) raises both max and current HP immediately, and stacks", () => {
    const hero = wren();
    const maxBefore = hero.effectiveMaxHealth;
    const healthBefore = hero.health;
    hero.grantBonusHealth(5);
    expect(hero.effectiveMaxHealth).toBe(maxBefore + 5);
    expect(hero.health).toBe(healthBefore + 5);
    hero.grantBonusHealth(3);
    expect(hero.effectiveMaxHealth).toBe(maxBefore + 8);
  });

  it("sums bonuses across every filled slot at once", () => {
    const hero = wren();
    hero.equippedItems.head = "leather-cap"; // +1 AC
    hero.equippedItems.chest = "chainmail-vest"; // +3 AC
    hero.equippedItems.ring1 = "whetstone-band"; // +2 atk
    hero.equippedItems.ring2 = "band-of-vigor"; // +1 AC, +1 atk
    expect(hero.armorClass).toBe(10 + 1 + 3 + 1);
    expect(hero.effectiveAttackDamage).toBe(3 + 2 + 1);
  });

  it("both ring slots accept ring-type items independently", () => {
    const hero = wren();
    hero.equippedItems.ring1 = "whetstone-band";
    hero.equippedItems.ring2 = "whetstone-band";
    expect(hero.effectiveAttackDamage).toBe(3 + 2 + 2);
  });

  it("every catalogue item's slot type matches a real gear slot", () => {
    for (const type of ["weapon", "shield", "head", "chest", "legs", "ring", "amulet", "footwear"] as const) {
      expect(gearSlotType(type === "ring" ? "ring1" : type)).toBe(type);
    }
    expect(getEquipmentDefinition("iron-buckler").slot).toBe("chest");
  });
});

/**
 * Phase 17 (D-108): weapons replace base attack damage/range; real armor
 * replaces the unarmored-AC formula outright (light/medium/heavy Dex
 * handling); a Shield stacks a flat bonus on top of either.
 */
describe("Hero weapon/armor (D-108)", () => {
  it("a weapon REPLACES base attack damage (classic roster, no ability scores -> ability modifier is 0)", () => {
    const hero = wren(); // base attackDamage 3
    hero.equippedItems.weapon = "dagger"; // 1d4 -> average 3, no ability score
    expect(hero.effectiveAttackDamage).toBe(3);
    hero.equippedItems.weapon = "greatsword"; // 2d6 -> average 8
    expect(hero.effectiveAttackDamage).toBe(8);
  });

  it("unequipping the weapon falls back to the hero's original base damage", () => {
    const hero = wren();
    hero.equippedItems.weapon = "greatsword";
    expect(hero.effectiveAttackDamage).toBe(8);
    delete hero.equippedItems.weapon;
    expect(hero.effectiveAttackDamage).toBe(3);
  });

  it("a weapon REPLACES base attack range", () => {
    const hero = wren(); // base attackRangeTiles 3 (Wren is ranged)
    hero.equippedItems.weapon = "mace"; // plain melee, no thrown/reach/ammunition -> 1 tile
    expect(hero.attackRangeTiles).toBe(1);
    hero.equippedItems.weapon = "longbow"; // ammunition -> 3 tiles
    expect(hero.attackRangeTiles).toBe(3);
    hero.equippedItems.weapon = "whip"; // reach -> 2 tiles
    expect(hero.attackRangeTiles).toBe(2);
    delete hero.equippedItems.weapon;
    expect(hero.attackRangeTiles).toBe(3); // back to the hero's own base range
  });

  it("a Versatile weapon uses its bigger two-handed die only without a Shield equipped", () => {
    const hero = wren();
    hero.equippedItems.weapon = "longsword"; // 1d8/1d10 versatile
    expect(hero.effectiveAttackDamage).toBe(6); // two-handed grip: 1d10 avg
    hero.equippedItems.shield = "shield";
    expect(hero.effectiveAttackDamage).toBe(5); // one-handed grip once a Shield is equipped: 1d8 avg
  });

  it("a Shield adds a flat +2 AC on top of whatever's in the chest slot (or nothing)", () => {
    const hero = wren();
    expect(hero.armorClass).toBe(10);
    hero.equippedItems.shield = "shield";
    expect(hero.armorClass).toBe(12);
  });

  it("light armor adds the hero's full Dex modifier, matching the old unarmored-10+Dex shape", () => {
    const hero = wren(); // classic roster: Dex modifier is always 0 here
    hero.equippedItems.chest = "leather-armor"; // AC 11, full Dex
    expect(hero.armorClass).toBe(11);
  });

  it("medium armor caps the Dex bonus", () => {
    const hero = wren();
    hero.equippedItems.chest = "breastplate"; // AC 14, Dex capped at +2
    expect(hero.armorClass).toBe(14); // 0 Dex mod either way for the classic roster
  });

  it("heavy armor ignores Dex entirely, replacing the unarmored base outright", () => {
    const hero = wren();
    hero.equippedItems.chest = "plate-armor"; // AC 18, no Dex
    expect(hero.armorClass).toBe(18);
  });

  it("real armor's own AC is NOT additionally treated as a flat bonus (no double-counting)", () => {
    const hero = wren();
    hero.equippedItems.chest = "plate-armor";
    hero.equippedItems.ring1 = "band-of-vigor"; // +1 AC, a real flat-bonus item, still stacks
    expect(hero.armorClass).toBe(18 + 1);
  });

  it("wouldConflictWithGrip refuses a Shield alongside an equipped Two-Handed weapon, and vice versa", () => {
    const hero = wren();
    hero.equippedItems.weapon = "greatsword"; // Two-Handed
    expect(hero.wouldConflictWithGrip("shield", "shield")).toBe(true);
    delete hero.equippedItems.weapon;
    hero.equippedItems.shield = "shield";
    expect(hero.wouldConflictWithGrip("greatsword", "weapon")).toBe(true);
    expect(hero.wouldConflictWithGrip("longsword", "weapon")).toBe(false); // Versatile, not Two-Handed
  });

  it("wouldConflictWithGrip is false for every non-weapon/shield slot", () => {
    const hero = wren();
    hero.equippedItems.weapon = "greatsword";
    expect(hero.wouldConflictWithGrip("leather-armor", "chest")).toBe(false);
  });

  it("Vex: hasVexAgainst/setVex/clearVex track a pending advantage target", () => {
    const hero = wren();
    expect(hero.hasVexAgainst("enemy-1")).toBe(false);
    hero.setVex("enemy-1");
    expect(hero.hasVexAgainst("enemy-1")).toBe(true);
    expect(hero.hasVexAgainst("enemy-2")).toBe(false);
    hero.clearVex();
    expect(hero.hasVexAgainst("enemy-1")).toBe(false);
  });

  it("Cleave: canUseCleaveMastery/consumeCleaveMastery is a once-per-turn gate reset by resetForNewTurn", () => {
    const hero = wren();
    expect(hero.canUseCleaveMastery).toBe(true);
    hero.consumeCleaveMastery();
    expect(hero.canUseCleaveMastery).toBe(false);
    hero.resetForNewTurn();
    expect(hero.canUseCleaveMastery).toBe(true);
  });

  it("weaponAbilityModifierNow and equippedWeaponDieAverage are 0 with no weapon equipped", () => {
    const hero = wren();
    expect(hero.weaponAbilityModifierNow).toBe(0);
    expect(hero.equippedWeaponDieAverage).toBe(0);
  });

  it("equippedWeaponDieAverage reflects the current grip's die with no ability modifier folded in", () => {
    const hero = wren();
    hero.equippedItems.weapon = "longsword";
    expect(hero.equippedWeaponDieAverage).toBe(6); // two-handed grip (no shield): 1d10 avg
    hero.equippedItems.shield = "shield";
    expect(hero.equippedWeaponDieAverage).toBe(5); // one-handed grip: 1d8 avg
  });

  it("a D&D-built hero's classRiderDamage (e.g. Sneak Attack) still applies on top of an equipped weapon's own damage", () => {
    const build: CharacterBuild = {
      id: "b1",
      name: "Kael",
      raceId: "human",
      classId: "rogue",
      level: 1,
      abilityScores: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      controlledBy: "human",
    };
    const def = heroDefinitionFromBuild(build);
    expect(def.classRiderDamage).toBe(4); // Sneak Attack at level 1
    const hero = new Hero(def, { x: 0, y: 0 });
    hero.equippedItems.weapon = "shortsword"; // 1d6 piercing, finesse -> DEX 14 (+2)
    expect(hero.effectiveAttackDamage).toBe(4 /* 1d6 avg */ + 2 /* DEX mod */ + 4 /* Sneak Attack */);
  });
});

/**
 * Phase 13.9 (D-094): loot/equipment expansion — rarity ladder, attunement,
 * and real on-hit/on-kill procs.
 */
describe("Equipment rarity, attunement, and procs (D-094)", () => {
  it("every catalogue item has a rarity from the real ladder", () => {
    for (const id of EQUIPMENT_ORDER) {
      expect(RARITY_ORDER).toContain(EQUIPMENT_DEFINITIONS[id].rarity);
    }
  });

  it("no common item requires attunement", () => {
    // Phase 13.9 (D-094)'s original 5 attunement items were all rare-and-up
    // by the project's OWN choice, not an SRD rule — Phase 22's real
    // SRD-sourced magic items (e.g. Cloak of Protection, Boots of Striding
    // and Springing) genuinely require attunement at `uncommon` too, per
    // the actual rules. The one invariant that still holds universally: a
    // mundane, `common` item never needs attunement.
    for (const id of EQUIPMENT_ORDER) {
      const def = EQUIPMENT_DEFINITIONS[id];
      if (def.requiresAttunement) {
        expect(def.rarity).not.toBe("common");
      }
    }
  });

  it("every proc kind Kevin asked for exists at least once in the catalogue", () => {
    const kinds = new Set<EquipmentProc["kind"]>();
    for (const id of EQUIPMENT_ORDER) {
      const proc = EQUIPMENT_DEFINITIONS[id].proc;
      if (proc) kinds.add(proc.kind);
    }
    expect(kinds).toEqual(new Set(["onHitStatus", "onHitSaveOrDamage", "onKillHealNearestAlly", "onHitWhileResistant"]));
  });

  it("a hero starts attuned to nothing and can attune up to the cap", () => {
    const hero = wren();
    expect(hero.attunedItemIds).toEqual([]);
    expect(hero.canAttuneToAnother()).toBe(true);
  });

  it("equipping an attunement item is reflected immediately in attunedItemIds", () => {
    const hero = wren();
    hero.equippedItems.ring1 = "ring-of-frostbite";
    expect(hero.attunedItemIds).toEqual(["ring-of-frostbite"]);
    delete hero.equippedItems.ring1;
    expect(hero.attunedItemIds).toEqual([]);
  });

  it(`wouldExceedAttunementLimit blocks a ${MAX_ATTUNEMENTS + 1}th attunement item but allows the ${MAX_ATTUNEMENTS}rd`, () => {
    const hero = wren();
    hero.equippedItems.ring1 = "ring-of-frostbite";
    hero.equippedItems.amulet = "amulet-of-withering";
    expect(hero.attunedItemIds.length).toBe(2);
    // A third attunement item into an EMPTY slot: allowed, right at the cap.
    expect(hero.wouldExceedAttunementLimit("signet-of-kinship", "ring2")).toBe(false);
    hero.equippedItems.ring2 = "signet-of-kinship";
    expect(hero.attunedItemIds.length).toBe(MAX_ATTUNEMENTS);
    expect(hero.canAttuneToAnother()).toBe(false);
    // A fourth, into yet another empty slot: blocked.
    expect(hero.wouldExceedAttunementLimit("aegis-of-the-first-ward", "chest")).toBe(true);
  });

  it("wouldExceedAttunementLimit allows swapping one attuned item for another in the SAME slot", () => {
    const hero = wren();
    hero.equippedItems.ring1 = "ring-of-frostbite";
    hero.equippedItems.amulet = "amulet-of-withering";
    hero.equippedItems.ring2 = "signet-of-kinship"; // at the cap (3)
    // Replacing ring1's attuned item with a DIFFERENT attuned item in the
    // SAME slot frees one attunement before spending it — net zero, allowed.
    expect(hero.wouldExceedAttunementLimit("signet-of-kinship", "ring1")).toBe(false);
  });

  it("wouldExceedAttunementLimit is always false for an item that doesn't require attunement", () => {
    const hero = wren();
    hero.equippedItems.ring1 = "ring-of-frostbite";
    hero.equippedItems.amulet = "amulet-of-withering";
    hero.equippedItems.ring2 = "signet-of-kinship"; // at the cap (3)
    expect(hero.wouldExceedAttunementLimit("whetstone-band", "footwear")).toBe(false);
  });

  it("equippedProcItems returns only equipped items that carry a proc, in slot order", () => {
    const hero = wren();
    expect(hero.equippedProcItems()).toEqual([]);
    hero.equippedItems.chest = "iron-buckler"; // no proc
    hero.equippedItems.ring1 = "ring-of-frostbite"; // proc
    hero.equippedItems.amulet = "amulet-of-withering"; // proc
    const procIds = hero.equippedProcItems().map((def) => def.id);
    expect(procIds).toEqual(["ring-of-frostbite", "amulet-of-withering"]);
  });

  it("a rare item's flat bonuses still sum through armorClass/effectiveAttackDamage like any other item", () => {
    const hero = wren();
    hero.equippedItems.legs = "greaves-of-the-berserker"; // +2 atk, +1 AC
    expect(hero.armorClass).toBe(11);
    expect(hero.effectiveAttackDamage).toBe(3 + 2);
  });
});

/**
 * Phase 22 (magic-item expansion): the `+1/+2/+3` enchant overlay
 * (`equipment.ts`'s `enchantedItemId`/`getEquipmentDefinition`), the new
 * "back" gear slot, and the new flat-bonus fields (`savingThrowBonus`,
 * `movementBonusTiles`, `grantsStatusImmunity`, `rangedAttackBonus`/
 * `rangedAttackDamage`).
 */
describe("Magic-item expansion (Phase 22)", () => {
  it("synthesizes a +1/+2/+3 weapon on demand, adding to both the attack roll and the damage roll", () => {
    const hero = wren();
    hero.equippedItems.weapon = "longsword";
    const baseAttack = hero.effectiveAttackDamage;
    const baseBonus = hero.effectiveAttackBonus;
    hero.equippedItems.weapon = "longsword+2";
    expect(getEquipmentDefinition("longsword+2").enchantLevel).toBe(2);
    expect(getEquipmentDefinition("longsword+2").baseItemId).toBe("longsword");
    expect(hero.effectiveAttackDamage).toBe(baseAttack + 2);
    expect(hero.effectiveAttackBonus).toBe(baseBonus + 2);
  });

  it("synthesizes a +N real-armor item by folding the bonus into its own base AC", () => {
    const hero = wren();
    hero.equippedItems.chest = "leather-armor";
    const baseAC = hero.armorClass;
    hero.equippedItems.chest = "leather-armor+1";
    expect(hero.armorClass).toBe(baseAC + 1);
  });

  it("synthesizes a +N shield as a bigger flat AC bonus", () => {
    const hero = wren();
    hero.equippedItems.shield = "shield";
    const baseAC = hero.armorClass;
    hero.equippedItems.shield = "shield+3";
    expect(hero.armorClass).toBe(baseAC + 3);
  });

  it("refuses to enchant an already-magic (non-common) item or a non-weapon/armor/shield slot", () => {
    expect(() => getEquipmentDefinition("ring-of-frostbite+1")).toThrow();
    expect(() => getEquipmentDefinition("leather-cap+1")).toThrow();
  });

  it("an unknown plain id still throws (enchant parsing doesn't swallow real typos)", () => {
    expect(() => getEquipmentDefinition("not-a-real-item")).toThrow();
  });

  it("the Cape of Billowing occupies the new back slot and carries the flowingCape visual hook", () => {
    const hero = wren();
    expect(gearSlotType("back")).toBe("back");
    hero.equippedItems.back = "cape-of-billowing";
    expect(hero.armorClass).toBe(11);
    expect(getEquipmentDefinition("cape-of-billowing").visualEffect).toBe("flowingCape");
  });

  it("savingThrowBonus sums across gear the same way armorClass/attackDamage do", () => {
    const hero = wren();
    const base = hero.savingThrowBonus;
    hero.equippedItems.ring1 = "ring-of-protection";
    expect(hero.savingThrowBonus).toBe(base + 1);
  });

  it("movementBonusTiles from gear raises effectiveMovementTiles", () => {
    const hero = wren();
    const base = hero.effectiveMovementTiles;
    hero.equippedItems.footwear = "boots-of-speed";
    expect(hero.effectiveMovementTiles).toBe(base + 4); // D-172: Boots of Speed rescaled to +4 tiles
  });

  it("grantsStatusImmunity silently blocks the listed status from ever being applied", () => {
    const hero = wren();
    // Baseline: with nothing equipped, poisoned applies normally.
    hero.applyStatus("poisoned", 3);
    expect(hero.hasStatus("poisoned")).toBe(true);
    hero.cureAllStatuses();

    hero.equippedItems.amulet = "periapt-of-proof-against-poison";
    hero.applyStatus("poisoned", 3);
    expect(hero.hasStatus("poisoned")).toBe(false);
    hero.applyStatus("restrained", 2); // not in THIS item's immunity list
    expect(hero.hasStatus("restrained")).toBe(true);

    hero.equippedItems.ring1 = "ring-of-free-action";
    hero.applyStatus("stunned", 2);
    expect(hero.hasStatus("stunned")).toBe(false);
  });

  it("rangedAttackBonus/rangedAttackDamage only apply while wielding a ranged weapon", () => {
    const hero = wren();
    hero.equippedItems.amulet = "bracers-of-archery";
    hero.equippedItems.weapon = "longsword"; // melee — no bonus yet
    const meleeAttack = hero.effectiveAttackDamage;
    const meleeBonus = hero.effectiveAttackBonus;
    hero.equippedItems.weapon = "shortbow"; // ranged — bonus applies
    expect(hero.effectiveAttackBonus).toBe(hero.attackBonus + 1);
    expect(hero.effectiveAttackDamage).toBeGreaterThan(0);
    delete hero.equippedItems.weapon;
    hero.equippedItems.weapon = "longsword";
    expect(hero.effectiveAttackDamage).toBe(meleeAttack);
    expect(hero.effectiveAttackBonus).toBe(meleeBonus);
  });
});

/**
 * @deprecated legacy path — Phase 13.11 (D-096)'s original single starting-
 * equipment pick, applied straight into `equippedItems` by the Hero
 * constructor. Kept only as a back-compat regression test for a pre-Plan-2
 * (D-193) save's `HeroDefinition.startingEquipmentId` — see the
 * `startingGearIds` describe block below for the real, current path.
 */
describe("Hero starting equipment — LEGACY startingEquipmentId (Phase 13.11, D-096; back-compat per D-193)", () => {
  function heroWithStartingGear(startingEquipmentId?: string): Hero {
    return new Hero({ ...WREN_TEST_HERO_DEF, startingEquipmentId }, { x: 0, y: 0 });
  }

  it("is unaffected when no starting item was picked", () => {
    const hero = heroWithStartingGear(undefined);
    expect(hero.equippedItems).toEqual({});
    expect(hero.armorClass).toBe(10);
  });

  it("places a non-ring item into its matching slot", () => {
    const hero = heroWithStartingGear("iron-buckler"); // chest, +2 AC
    expect(hero.equippedItems.chest).toBe("iron-buckler");
    expect(hero.armorClass).toBe(12);
  });

  it("places a ring item into ring1", () => {
    const hero = heroWithStartingGear("whetstone-band"); // ring, +2 attack damage
    expect(hero.equippedItems.ring1).toBe("whetstone-band");
    expect(hero.effectiveAttackDamage).toBe(3 + 2);
  });
});

/**
 * D-193 (Party Creation Overhaul Plan 2): the real per-slot starting-gear
 * loadout, applied straight into `equippedItems` by the Hero constructor.
 */
describe("Hero starting equipment — startingGearIds (D-193)", () => {
  function heroWithStartingGearIds(startingGearIds?: Partial<Record<string, string>>): Hero {
    return new Hero({ ...WREN_TEST_HERO_DEF, startingGearIds }, { x: 0, y: 0 });
  }

  it("is unaffected when startingGearIds is absent", () => {
    const hero = heroWithStartingGearIds(undefined);
    expect(hero.equippedItems).toEqual({});
    expect(hero.armorClass).toBe(10);
  });

  it("fills all 3 slots at once, and AC/attack damage compose correctly across them", () => {
    // longsword (weapon, no flat bonus), chain-shirt (chest, AC 13 capped-Dex
    // armor — replaces the base formula; WREN_TEST_HERO_DEF has no
    // abilityScores, so Dex mod is 0), shield (+2 AC on top).
    const hero = heroWithStartingGearIds({ weapon: "longsword", chest: "chain-shirt", shield: "shield" });
    expect(hero.equippedItems).toEqual({ weapon: "longsword", chest: "chain-shirt", shield: "shield" });
    expect(hero.armorClass).toBe(13 + 0 + 2);
  });

  it("fills a caster's focus (shield/off-hand slot) third slot alongside weapon+chest", () => {
    const hero = heroWithStartingGearIds({ weapon: "dagger", chest: "padded-armor", shield: "arcane-focus" });
    expect(hero.equippedItems).toEqual({ weapon: "dagger", chest: "padded-armor", shield: "arcane-focus" });
    // arcane-focus grants +1 attack damage — confirm it's actually summed in.
    const withoutFocus = heroWithStartingGearIds({ weapon: "dagger", chest: "padded-armor" });
    expect(hero.effectiveAttackDamage).toBe(withoutFocus.effectiveAttackDamage + 1);
  });

  it("fills all 10 real gear slots at once (Kevin's expanded scope: every slot is a free creation-time pick, not just weapon/chest/third)", () => {
    const gearIds = {
      weapon: "longsword",
      shield: "shield",
      head: "circlet-of-focus",
      chest: "chain-shirt",
      legs: "swift-greaves",
      back: "cape-of-billowing",
      ring1: "whetstone-band",
      ring2: "band-of-vigor",
      amulet: "amulet-of-warding",
      footwear: "boots-of-striding",
    };
    const hero = heroWithStartingGearIds(gearIds);
    expect(hero.equippedItems).toEqual(gearIds);
    // Every one of these grants a flat AC and/or attack-damage bonus — a
    // sanity check that nothing overwrites another slot's contribution.
    expect(hero.armorClass).toBeGreaterThan(13); // chain-shirt's own base AC alone
    expect(hero.effectiveAttackDamage).toBeGreaterThan(3); // WREN_TEST_HERO_DEF's base 3
  });
});

/**
 * D-127: charge-based active items (wands/staves) — previously a deliberate
 * scope cut (see `data/magicItems.ts`'s top comment). Grants a spell to ANY
 * hero (even one with no `classId` at all, like `wren()` below), spent as
 * item charges rather than a class spell slot.
 */
describe("Charge-based items (D-127)", () => {
  it("grants its spell to a non-caster the moment it's equipped", () => {
    const hero = wren();
    expect(hero.knownSpellAbilityIds()).not.toContain("magic-missile");
    hero.equippedItems.amulet = "wand-of-magic-missile";
    hero.onGearChanged();
    expect(hero.knownSpellAbilityIds()).toContain("magic-missile");
    expect(hero.canCastSpell("magic-missile")).toBe(true);
    expect(hero.chargeInfoForSpell("magic-missile")).toEqual({ remaining: 7, max: 7 });
  });

  it("spends a charge per cast, and denies casting once exhausted", () => {
    const hero = wren();
    hero.equippedItems.amulet = "wand-of-magic-missile";
    hero.onGearChanged();
    for (let i = 0; i < 7; i++) {
      expect(hero.canCastSpell("magic-missile")).toBe(true);
      hero.spendSpellSlotFor("magic-missile", 1, 4);
    }
    expect(hero.chargeInfoForSpell("magic-missile")?.remaining).toBe(0);
    expect(hero.canCastSpell("magic-missile")).toBe(false); // wren() has no class, so no slot to fall back to
  });

  it("removes the spell from the known list on unequip, but preserves remaining charges", () => {
    const hero = wren();
    hero.equippedItems.amulet = "wand-of-magic-missile";
    hero.onGearChanged();
    hero.spendSpellSlotFor("magic-missile", 1, 4);
    expect(hero.chargeInfoForSpell("magic-missile")?.remaining).toBe(6);

    delete hero.equippedItems.amulet;
    expect(hero.knownSpellAbilityIds()).not.toContain("magic-missile");

    hero.equippedItems.amulet = "wand-of-magic-missile";
    hero.onGearChanged(); // already-tracked item id — charges are NOT reset to max
    expect(hero.chargeInfoForSpell("magic-missile")?.remaining).toBe(6);
  });

  it("fully refills on a Long Rest", () => {
    const hero = wren();
    hero.equippedItems.amulet = "wand-of-magic-missile";
    hero.onGearChanged();
    hero.spendSpellSlotFor("magic-missile", 1, 4);
    hero.spendSpellSlotFor("magic-missile", 1, 4);
    expect(hero.chargeInfoForSpell("magic-missile")?.remaining).toBe(5);
    hero.longRest();
    expect(hero.chargeInfoForSpell("magic-missile")?.remaining).toBe(7);
  });
});

/**
 * D-127: ability-score-SETTING items (Gauntlets of Ogre Power, Headband of
 * Intellect, Amulet of Health) — the one genuinely risky piece of this
 * decision, since ability scores feed several different baked (not
 * live-recomputed) `Hero` fields. These need a real D&D-built hero (`wren()`
 * above has no ability scores at all), so tests build one directly.
 */
describe("Ability-score-setting items (D-127)", () => {
  function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
    return {
      id: "build-1",
      name: "Kael",
      raceId: "human",
      classId: "fighter",
      level: 1,
      abilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 8 },
      controlledBy: "human",
      ...overrides,
    };
  }

  function heroFromBuild(overrides: Partial<CharacterBuild> = {}): Hero {
    return new Hero(heroDefinitionFromBuild(build(overrides)), { x: 0, y: 0 });
  }

  it("Gauntlets of Ogre Power raises STR-derived attack damage, and reverts exactly on unequip", () => {
    const hero = heroFromBuild(); // STR 10 -> +0 mod
    const baseAttackDamage = hero.attackDamage;
    hero.equippedItems.amulet = "gauntlets-of-ogre-power"; // sets STR to 19 -> +4 mod
    hero.onGearChanged();
    expect(hero.attackDamage).toBe(baseAttackDamage + 4);

    delete hero.equippedItems.amulet;
    hero.onGearChanged();
    expect(hero.attackDamage).toBe(baseAttackDamage);
  });

  it("has no effect if the hero's own Strength is already 19 or higher", () => {
    const hero = heroFromBuild({ abilityScores: { str: 20, dex: 14, con: 10, int: 10, wis: 10, cha: 8 } });
    const baseAttackDamage = hero.attackDamage;
    hero.equippedItems.amulet = "gauntlets-of-ogre-power";
    hero.onGearChanged();
    expect(hero.attackDamage).toBe(baseAttackDamage); // 20 is already higher than 19
  });

  it("Amulet of Health raises CON-derived max HP, adjusting current health by the same delta", () => {
    const hero = heroFromBuild(); // CON 10 -> +0 mod
    const baseMaxHealth = hero.effectiveMaxHealth;
    const baseHealth = hero.health;
    hero.equippedItems.amulet = "amulet-of-health"; // sets CON to 19 -> +4 mod
    hero.onGearChanged();
    expect(hero.effectiveMaxHealth).toBeGreaterThan(baseMaxHealth);
    const hpDelta = hero.effectiveMaxHealth - baseMaxHealth;
    expect(hero.health).toBe(baseHealth + hpDelta); // gained immediately, same as a level-up's HP gain

    delete hero.equippedItems.amulet;
    hero.onGearChanged();
    expect(hero.effectiveMaxHealth).toBe(baseMaxHealth);
  });

  it("Headband of Intellect raises an Int-caster's spell save DC", () => {
    const hero = heroFromBuild({ classId: "wizard", abilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 8 } });
    const baseDC = hero.spellSaveDC;
    hero.equippedItems.head = "headband-of-intellect"; // sets INT to 19 -> +4 mod
    hero.onGearChanged();
    expect(hero.spellSaveDC).toBe((baseDC ?? 0) + 4);
  });
});

describe("isTwoHandedWeapon (D-204)", () => {
  it("is true for a Two-Handed weapon", () => {
    expect(isTwoHandedWeapon("greatsword")).toBe(true);
    expect(isTwoHandedWeapon("longbow")).toBe(true);
  });

  it("is false for a one-handed weapon", () => {
    expect(isTwoHandedWeapon("dagger")).toBe(false);
    expect(isTwoHandedWeapon("rapier")).toBe(false);
  });

  it("is false for a Versatile weapon (usable one- or two-handed, but not exclusively two-handed)", () => {
    expect(isTwoHandedWeapon("longsword")).toBe(false);
  });

  it("is false for a non-weapon item", () => {
    expect(isTwoHandedWeapon("amulet-of-health")).toBe(false);
  });
});
