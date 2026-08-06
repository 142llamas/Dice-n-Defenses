import type { EquipmentDefinition } from "./equipment";
import { WEAPON_DEFINITIONS } from "./weapons";

/**
 * Magic item definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 22 (magic-item expansion): Kevin asked for "a more complete
 * repertoire of items... mostly magical," specifically potions, +1/+2/+3
 * weapon/armor/shield modifications (see `equipment.ts`'s enchant-overlay
 * system — NOT hand-authored here), and "lots of free access magic items."
 * A dedicated research pass confirmed the real SRD 5.1 magic-item list (CC
 * BY 4.0 / OGL 1.0a) is large — hundreds of named items across rings,
 * cloaks, boots, bracers, rods, staffs, wands, and named weapons — per this
 * project's own "verify against the actual document, don't assume" policy.
 *
 * Every item below reuses an EXISTING mechanical hook (flat AC/attack-
 * damage/saving-throw bonus, movement bonus, one of the four `EquipmentProc`
 * kinds Phase 13.9/D-094 already built, or a ranged-weapon-conditional bonus
 * mirroring the Archery feat's own shape) or ONE new generic hook built this
 * phase (`grantsStatusImmunity`) — no ability-score-setting, no charge-based
 * active items (wands/rods/staffs), and no new damage-type/creature-type
 * system. A deliberate, documented scope boundary, the same "honest first
 * pass" treatment this project gives every batch — see CONTENT_SOURCES.md
 * for exactly which real SRD items were left out and why (Amulet of Health/
 * Gauntlets of Ogre Power/Headband of Intellect and the rest of the
 * ability-score-setting family; Cloak of Displacement; Ioun Stones; any
 * charge-based wand/rod/staff).
 *
 * The three named weapons (Flame Tongue, Frost Brand, Dagger of Venom) each
 * reuse an EXISTING mundane weapon's `WeaponData` as their base stats, with
 * a real `proc` layered on top — the exact shape a "+1/+2/+3" enchant
 * doesn't have room for (a proc, not a bigger flat number).
 *
 * The Cape of Billowing is NOT SRD content — the real published item this
 * evokes ("Cloak of Billowing") is from Xanathar's Guide to Everything, not
 * the free SRD, so it is ORIGINAL to this project: its own name, its own
 * flavor, its own (modest) numbers — same treatment this project already
 * gave Tough/Lucky/Athlete after the Phase 18 sourcing correction. Its
 * `visualEffect: "flowingCape"` is read by `BattleScene` to trail an
 * animated cape graphic behind the wearer's token (see
 * `BattleScene.updateHeroCapes`) — a real, new bit of Phaser drawing code,
 * not a new art asset, the same "coloured shapes, no final art" treatment
 * Phase 20's aura ring already established.
 */

export const MAGIC_ITEM_DEFINITIONS: Record<string, EquipmentDefinition> = {
  "cape-of-billowing": {
    id: "cape-of-billowing",
    name: "Cape of Billowing",
    description: "+1 AC. A cape that always flows and billows dramatically, even indoors, even underwater.",
    cost: 12,
    slot: "back",
    rarity: "common",
    armorClass: 1,
    visualEffect: "flowingCape",
    assetKey: "magic-cape-of-billowing",
  },
  "ring-of-protection": {
    id: "ring-of-protection",
    name: "Ring of Protection",
    description: "+1 AC and +1 saving throws. Requires attunement.",
    cost: 60,
    slot: "ring",
    rarity: "rare",
    armorClass: 1,
    savingThrowBonus: 1,
    requiresAttunement: true,
    assetKey: "magic-ring-of-protection",
  },
  "cloak-of-protection": {
    id: "cloak-of-protection",
    name: "Cloak of Protection",
    description: "+1 AC and +1 saving throws. Requires attunement.",
    cost: 44,
    slot: "back",
    rarity: "uncommon",
    armorClass: 1,
    savingThrowBonus: 1,
    requiresAttunement: true,
    assetKey: "magic-cloak-of-protection",
  },
  "bracers-of-defense": {
    id: "bracers-of-defense",
    name: "Bracers of Defense",
    description: "+2 AC. Requires attunement.",
    cost: 58,
    slot: "amulet",
    rarity: "rare",
    armorClass: 2,
    requiresAttunement: true,
    assetKey: "magic-bracers-of-defense",
  },
  "luckstone": {
    id: "luckstone",
    name: "Stone of Good Luck",
    description: "+1 saving throws. Requires attunement.",
    cost: 36,
    slot: "ring",
    rarity: "uncommon",
    savingThrowBonus: 1,
    requiresAttunement: true,
    assetKey: "magic-luckstone",
  },
  "ring-of-resistance": {
    id: "ring-of-resistance",
    name: "Ring of Resistance",
    description: "+1 AC — a warding charm against harm. Requires attunement.",
    cost: 40,
    slot: "ring",
    rarity: "rare",
    armorClass: 1,
    requiresAttunement: true,
    assetKey: "magic-ring-of-resistance",
  },
  "ring-of-free-action": {
    id: "ring-of-free-action",
    name: "Ring of Free Action",
    description: "The wearer can't be Restrained or Stunned. Requires attunement.",
    cost: 64,
    slot: "ring",
    rarity: "rare",
    grantsStatusImmunity: ["restrained", "stunned"],
    requiresAttunement: true,
    assetKey: "magic-ring-of-free-action",
  },
  "periapt-of-proof-against-poison": {
    id: "periapt-of-proof-against-poison",
    name: "Periapt of Proof against Poison",
    description: "The wearer can't be Poisoned. Requires attunement.",
    cost: 38,
    slot: "amulet",
    rarity: "uncommon",
    grantsStatusImmunity: ["poisoned"],
    requiresAttunement: true,
    assetKey: "magic-periapt-of-proof-against-poison",
  },
  "boots-of-striding-and-springing": {
    id: "boots-of-striding-and-springing",
    name: "Boots of Striding and Springing",
    description: "+1 movement tile. Requires attunement.",
    cost: 34,
    slot: "footwear",
    rarity: "uncommon",
    movementBonusTiles: 1,
    requiresAttunement: true,
    assetKey: "magic-boots-of-striding-and-springing",
  },
  "boots-of-speed": {
    id: "boots-of-speed",
    name: "Boots of Speed",
    description: "+2 movement tiles. Requires attunement.",
    cost: 78,
    slot: "footwear",
    rarity: "veryRare",
    movementBonusTiles: 2,
    requiresAttunement: true,
    assetKey: "magic-boots-of-speed",
  },
  "bracers-of-archery": {
    id: "bracers-of-archery",
    name: "Bracers of Archery",
    description: "+1 attack rolls and +2 basic-attack damage, but only while wielding a ranged weapon. Requires attunement.",
    cost: 36,
    slot: "amulet",
    rarity: "uncommon",
    rangedAttackBonus: 1,
    rangedAttackDamage: 2,
    requiresAttunement: true,
    assetKey: "magic-bracers-of-archery",
  },
  "robe-of-the-archmagi": {
    id: "robe-of-the-archmagi",
    name: "Robe of the Archmagi",
    description: "+2 AC and +2 saving throws. Requires attunement.",
    cost: 120,
    slot: "chest",
    rarity: "legendary",
    armorClass: 2,
    savingThrowBonus: 2,
    requiresAttunement: true,
    assetKey: "magic-robe-of-the-archmagi",
  },
  "flame-tongue": {
    id: "flame-tongue",
    name: "Flame Tongue",
    description:
      "Martial melee weapon — 1d8/1d10 versatile slashing. Mastery: Sap. On a landed hit, the target must succeed on a DC 13 save or take 4 extra fire damage. Requires attunement.",
    cost: 68,
    slot: "weapon",
    rarity: "rare",
    weapon: WEAPON_DEFINITIONS["longsword"].weapon,
    proc: { kind: "onHitSaveOrDamage", saveDC: 13, bonusDamage: 4 },
    requiresAttunement: true,
    assetKey: "magic-flame-tongue",
  },
  "frost-brand": {
    id: "frost-brand",
    name: "Frost Brand",
    description:
      "Martial melee weapon — 2d6 slashing, Heavy, Two-Handed. Mastery: Graze. On a landed hit, the target must succeed on a DC 15 save or take 6 extra cold damage. Requires attunement.",
    cost: 130,
    slot: "weapon",
    rarity: "veryRare",
    weapon: WEAPON_DEFINITIONS["greatsword"].weapon,
    proc: { kind: "onHitSaveOrDamage", saveDC: 15, bonusDamage: 6 },
    requiresAttunement: true,
    assetKey: "magic-frost-brand",
  },
  "dagger-of-venom": {
    id: "dagger-of-venom",
    name: "Dagger of Venom",
    description:
      "Simple melee weapon — 1d4 piercing, Finesse, Light, Thrown. Mastery: Nick. On a landed hit, chills the target with Poisoned for 2 turns. Requires attunement.",
    cost: 62,
    slot: "weapon",
    rarity: "rare",
    weapon: WEAPON_DEFINITIONS["dagger"].weapon,
    proc: { kind: "onHitStatus", statusId: "poisoned", durationTurns: 2 },
    requiresAttunement: true,
    assetKey: "magic-dagger-of-venom",
  },
};

/** The magic-item catalogue in shop order — see `equipment.ts`'s `EQUIPMENT_ORDER`. */
export const MAGIC_ITEM_ORDER: string[] = [
  "cape-of-billowing",
  "ring-of-protection",
  "cloak-of-protection",
  "bracers-of-defense",
  "luckstone",
  "ring-of-resistance",
  "ring-of-free-action",
  "periapt-of-proof-against-poison",
  "boots-of-striding-and-springing",
  "boots-of-speed",
  "bracers-of-archery",
  "robe-of-the-archmagi",
  "flame-tongue",
  "frost-brand",
  "dagger-of-venom",
];
