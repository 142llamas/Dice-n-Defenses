import type { EquipmentDefinition } from "./equipment";

/**
 * Weapon definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 17 (D-108) fills a gap `CharacterBuildSystem`'s own doc comment has
 * flagged since Phase 13.1 ("no weapon catalogue driving this yet"): every
 * hero's basic-attack damage came from a flat class/level formula
 * (`CharacterSystem.combatStatsForClassLevel`'s `BASE_WEAPON_DAMAGE`
 * constant), not a real weapon choice. This is the real SRD 5.2.1 (2024
 * rules) weapon table, released by Wizards of the Coast under the Creative
 * Commons Attribution 4.0 International License (CC-BY-4.0) — see
 * CONTENT_SOURCES.md for the required attribution notice. No D&D branding,
 * logos, or trademarked setting material accompanies any of this (SRD 5.2.1
 * §3, matching this project's existing standing rule).
 *
 * Every one of the 2024 SRD's 38 weapons is here EXCEPT the two core
 * firearms (Musket, Pistol) — a deliberate content-fit trim, not a
 * completeness gap: this is a fantasy setting with no gunpowder established
 * anywhere else in the game's world (every other item/spell/enemy is
 * unambiguously magical or medieval), so including them would read as a
 * jarring anachronism nothing else here sets up. "Net" (a 2014 SRD 5.1
 * weapon) was deliberately NOT carried over — the 2024 SRD 5.2.1 cut it
 * outright.
 *
 * Equipping a weapon (the new `"weapon"` gear slot) REPLACES a hero's base
 * attack-damage AND attack-range numbers, rather than adding a bonus on top
 * like every other gear slot — Kevin's explicit choice (see D-108): "your
 * weapon determines your damage" is the whole point of a real weapon
 * catalogue. See `systems/WeaponSystem.ts` for the actual math (dice
 * average, ability modifier, versatile/two-handed grip) and
 * `Hero.effectiveAttackDamage`/`Hero.attackRangeTiles` for where it's read.
 * A hero with no weapon equipped is completely unaffected — every existing
 * save/party keeps its old flat numbers exactly as before.
 *
 * Weapon Mastery (2024-rules-only — this concept doesn't exist in the 2014
 * SRD 5.1 the rest of this project's spell catalogue is sourced from) is a
 * REAL per-weapon mechanic here, applied automatically to whoever wields the
 * weapon — a deliberate simplification of the SRD's real rule (mastery only
 * triggers for a class that has "unlocked" that many weapons' masteries).
 * Modeling per-class mastery-slot allocation would be a whole separate
 * character-creation feature this pass didn't build; every one of the 8
 * mastery properties now has a real mechanical hook (Phase 19, D-110, gave
 * Nick its own once the dual-wielding system it needed got built). See
 * `BattleScene.applyWeaponMastery` for every hook's actual resolution, and
 * `WEAPON_MASTERIES.nick`'s own comment for Nick's real trigger.
 */

export type WeaponCategory = "simple" | "martial";
export type WeaponKind = "melee" | "ranged";
export type DamageType = "bludgeoning" | "piercing" | "slashing";

export type WeaponProperty =
  | "ammunition"
  | "finesse"
  | "heavy"
  | "light"
  | "loading"
  | "reach"
  | "thrown"
  | "twoHanded"
  | "versatile";

export const WEAPON_PROPERTY_LABELS: Record<WeaponProperty, string> = {
  ammunition: "Ammunition",
  finesse: "Finesse",
  heavy: "Heavy",
  light: "Light",
  loading: "Loading",
  reach: "Reach",
  thrown: "Thrown",
  twoHanded: "Two-Handed",
  versatile: "Versatile",
};

export type WeaponMasteryId = "cleave" | "graze" | "nick" | "push" | "sap" | "slow" | "topple" | "vex";

export interface WeaponMasteryDefinition {
  id: WeaponMasteryId;
  name: string;
  /** The SRD 5.2.1 rules text this mastery grants, condensed for an in-game tooltip. */
  description: string;
  /** False only for "nick" — see its own entry below for why no mechanical hook exists yet. */
  mechanicallyActive: boolean;
}

export const WEAPON_MASTERIES: Record<WeaponMasteryId, WeaponMasteryDefinition> = {
  cleave: {
    id: "cleave",
    name: "Cleave",
    description:
      "On a hit, make a melee attack against a second creature within 5 ft of the first and within your reach (once per turn).",
    mechanicallyActive: true,
  },
  graze: {
    id: "graze",
    name: "Graze",
    description: "On a miss, still deal damage to the target equal to your ability modifier.",
    mechanicallyActive: true,
  },
  nick: {
    id: "nick",
    name: "Nick",
    description:
      "Make the extra attack a Light weapon grants as part of the Attack action instead of a bonus action (once per turn).",
    mechanicallyActive: true,
  },
  push: {
    id: "push",
    name: "Push",
    description: "On a hit, push the target up to 10 ft directly away from you.",
    mechanicallyActive: true,
  },
  sap: {
    id: "sap",
    name: "Sap",
    description: "On a hit, the target has disadvantage on its next attack roll before the start of your next turn.",
    mechanicallyActive: true,
  },
  slow: {
    id: "slow",
    name: "Slow",
    description: "On a hit that deals damage, reduce the target's speed by 10 ft until the start of your next turn.",
    mechanicallyActive: true,
  },
  topple: {
    id: "topple",
    name: "Topple",
    description: "On a hit, the target makes a Constitution save or is knocked prone.",
    mechanicallyActive: true,
  },
  vex: {
    id: "vex",
    name: "Vex",
    description: "On a hit that deals damage, gain advantage on your next attack against that target.",
    mechanicallyActive: true,
  },
};

/**
 * Phase 19 (D-110): Nick's real SRD trigger — the Light property's off-hand
 * extra attack via two-weapon fighting — used to need a dual-wielding/
 * off-hand-weapon system this game didn't have (there was exactly one
 * `"weapon"` gear slot, not a main-hand/off-hand pair). That system now
 * exists: a Light melee weapon may occupy the `"shield"` gear slot as an
 * off-hand weapon (see `Hero.offHandWeapon`). Nick's real mechanic —
 * making the off-hand attack ride along on the Attack action instead of
 * costing the bonus action — is resolved by `Hero.canUseOffHandAttack`/
 * `nickGrantsFreeOffHandAttack`, checked against EITHER equipped weapon
 * (main or off-hand) having this mastery.
 */

export interface WeaponData {
  category: WeaponCategory;
  kind: WeaponKind;
  /** e.g. "1d8", or a flat "1" for the Blowgun's non-dice damage. */
  damageDice: string;
  damageType: DamageType;
  properties: readonly WeaponProperty[];
  /** The two-handed damage die for a Versatile weapon; absent otherwise. */
  versatileDamageDice?: string;
  mastery: WeaponMasteryId;
}

const w = (
  id: string,
  name: string,
  cost: number,
  category: WeaponCategory,
  kind: WeaponKind,
  damageDice: string,
  damageType: DamageType,
  properties: readonly WeaponProperty[],
  mastery: WeaponMasteryId,
  versatileDamageDice?: string,
): [string, EquipmentDefinition] => [
  id,
  {
    id,
    name,
    description: `${category === "simple" ? "Simple" : "Martial"} ${kind} weapon — ${damageDice}${
      versatileDamageDice ? `/${versatileDamageDice} versatile` : ""
    } ${damageType}. ${properties.map((p) => WEAPON_PROPERTY_LABELS[p]).join(", ") || "No properties"}. Mastery: ${
      WEAPON_MASTERIES[mastery].name
    } — ${WEAPON_MASTERIES[mastery].description}`,
    cost,
    slot: "weapon",
    rarity: "common",
    assetKey: `weapon-${id}`,
    weapon: { category, kind, damageDice, damageType, properties, versatileDamageDice, mastery },
  },
];

export const WEAPON_DEFINITIONS: Record<string, EquipmentDefinition> = Object.fromEntries([
  // ----- Simple melee (10) -----
  w("club", "Club", 4, "simple", "melee", "1d4", "bludgeoning", ["light"], "slow"),
  w("dagger", "Dagger", 6, "simple", "melee", "1d4", "piercing", ["finesse", "light", "thrown"], "nick"),
  w("greatclub", "Greatclub", 4, "simple", "melee", "1d8", "bludgeoning", ["twoHanded"], "push"),
  w("handaxe", "Handaxe", 8, "simple", "melee", "1d6", "slashing", ["light", "thrown"], "vex"),
  w("javelin", "Javelin", 6, "simple", "melee", "1d6", "piercing", ["thrown"], "slow"),
  w("light-hammer", "Light Hammer", 6, "simple", "melee", "1d4", "bludgeoning", ["light", "thrown"], "nick"),
  w("mace", "Mace", 8, "simple", "melee", "1d6", "bludgeoning", [], "sap"),
  w("quarterstaff", "Quarterstaff", 4, "simple", "melee", "1d6", "bludgeoning", ["versatile"], "topple", "1d8"),
  w("sickle", "Sickle", 5, "simple", "melee", "1d4", "slashing", ["light"], "nick"),
  w("spear", "Spear", 5, "simple", "melee", "1d6", "piercing", ["thrown", "versatile"], "sap", "1d8"),

  // ----- Simple ranged (4) -----
  w("dart", "Dart", 4, "simple", "ranged", "1d4", "piercing", ["finesse", "thrown"], "vex"),
  w("light-crossbow", "Light Crossbow", 14, "simple", "ranged", "1d8", "piercing", ["ammunition", "loading", "twoHanded"], "slow"),
  w("shortbow", "Shortbow", 14, "simple", "ranged", "1d6", "piercing", ["ammunition", "twoHanded"], "vex"),
  w("sling", "Sling", 6, "simple", "ranged", "1d4", "bludgeoning", ["ammunition"], "slow"),

  // ----- Martial melee (18) -----
  w("battleaxe", "Battleaxe", 16, "martial", "melee", "1d8", "slashing", ["versatile"], "topple", "1d10"),
  w("flail", "Flail", 16, "martial", "melee", "1d8", "bludgeoning", [], "sap"),
  w("glaive", "Glaive", 28, "martial", "melee", "1d10", "slashing", ["heavy", "reach", "twoHanded"], "graze"),
  w("greataxe", "Greataxe", 32, "martial", "melee", "1d12", "slashing", ["heavy", "twoHanded"], "cleave"),
  w("greatsword", "Greatsword", 36, "martial", "melee", "2d6", "slashing", ["heavy", "twoHanded"], "graze"),
  w("halberd", "Halberd", 28, "martial", "melee", "1d10", "slashing", ["heavy", "reach", "twoHanded"], "cleave"),
  w("lance", "Lance", 18, "martial", "melee", "1d10", "piercing", ["heavy", "reach", "twoHanded"], "topple"),
  w("longsword", "Longsword", 20, "martial", "melee", "1d8", "slashing", ["versatile"], "sap", "1d10"),
  w("maul", "Maul", 22, "martial", "melee", "2d6", "bludgeoning", ["heavy", "twoHanded"], "topple"),
  w("morningstar", "Morningstar", 18, "martial", "melee", "1d8", "piercing", [], "sap"),
  w("pike", "Pike", 14, "martial", "melee", "1d10", "piercing", ["heavy", "reach", "twoHanded"], "push"),
  w("rapier", "Rapier", 26, "martial", "melee", "1d8", "piercing", ["finesse"], "vex"),
  w("scimitar", "Scimitar", 24, "martial", "melee", "1d6", "slashing", ["finesse", "light"], "nick"),
  w("shortsword", "Shortsword", 14, "martial", "melee", "1d6", "piercing", ["finesse", "light"], "vex"),
  w("trident", "Trident", 10, "martial", "melee", "1d8", "piercing", ["thrown", "versatile"], "topple", "1d10"),
  w("warhammer", "Warhammer", 18, "martial", "melee", "1d8", "bludgeoning", ["versatile"], "push", "1d10"),
  w("war-pick", "War Pick", 10, "martial", "melee", "1d8", "piercing", ["versatile"], "sap", "1d10"),
  w("whip", "Whip", 6, "martial", "melee", "1d4", "slashing", ["finesse", "reach"], "slow"),

  // ----- Martial ranged (4, excludes the SRD's 2 core firearms — see module comment) -----
  w("blowgun", "Blowgun", 18, "martial", "ranged", "1", "piercing", ["ammunition", "loading"], "vex"),
  w("hand-crossbow", "Hand Crossbow", 40, "martial", "ranged", "1d6", "piercing", ["ammunition", "light", "loading"], "vex"),
  w("heavy-crossbow", "Heavy Crossbow", 30, "martial", "ranged", "1d10", "piercing", ["ammunition", "heavy", "loading", "twoHanded"], "push"),
  w("longbow", "Longbow", 30, "martial", "ranged", "1d8", "piercing", ["ammunition", "heavy", "twoHanded"], "slow"),
]);

export const WEAPON_ORDER: string[] = Object.keys(WEAPON_DEFINITIONS);
