import type { StatusEffectId } from "./statusEffects";
import type { AbilityScoreId } from "./abilityScores";
import type { WeaponData, DamageType, DamageTypeSplit } from "./weapons";
import type { ArmorData } from "./armor";
import { WEAPON_DEFINITIONS, WEAPON_ORDER } from "./weapons";
import { ARMOR_DEFINITIONS, ARMOR_ORDER, SHIELD_DEFINITIONS, SHIELD_ORDER } from "./armor";
import { MAGIC_ITEM_DEFINITIONS, MAGIC_ITEM_ORDER } from "./magicItems";

/**
 * Equipment definitions â€” data, not code (Source of Truth "data-driven content").
 *
 * Phase 7 ("limited equipment," D-057) gave each hero exactly one flat-bonus
 * slot. Phase 11.5 (D-078) expands this into the classic RPG loadout Kevin
 * asked for: seven gear-slot INSTANCES across six slot TYPES â€” one Head,
 * Chest, Legs, Amulet, and Footwear each, plus two Rings (same type, two
 * instances so a hero can wear two different rings at once).
 *
 * Through Phase 11.5, every item granted only flat `attackDamage`/`armorClass`
 * bonuses â€” no "chance to X on hit" proc (D-047's original addendum cited the
 * lack of a dice/crit system as the reason; that was deferred to this
 * sub-phase). All items are ORIGINAL content, not SRD-derived â€” see
 * CONTENT_SOURCES.md. Three items (Iron Buckler, Whetstone Blade â€” renamed
 * "Whetstone Band" for its new ring slot â€” and Traveler's Cloak) carry over
 * from Phase 7 with identical stats/costs, now given a real slot.
 *
 * Phase 13.1 (D-086): the `defense` field is renamed `armorClass` and now
 * means an AC bonus (added to a hero's base 10 + Dex mod), not flat damage
 * reduction â€” see CombatSystem's module comment. The NUMBERS themselves are
 * unchanged from Phase 11.5's defense values; only their meaning changed,
 * and like every other balance number in this project they are first-pass
 * and untuned for the new model.
 *
 * Phase 13.9 (D-094): loot/equipment expansion, now that dice, saving
 * throws, ally-targeting, and per-class conditional bonuses all exist to
 * build real item effects on top of. Three additions, all requested by
 * Kevin at this sub-phase's scoping fork:
 *   - `rarity`: a real five-tier ladder (`RARITY_ORDER`), scaling bonus
 *     size and cost. The 12 Phase-11.5 items are retro-tagged common/
 *     uncommon by their existing (unchanged) power level; five new items
 *     fill rare through legendary.
 *   - `requiresAttunement`: every rare-and-up item requires one of a
 *     hero's `Hero.MAX_ATTUNEMENTS` (3) attunement slots. Gated at EQUIP
 *     time (`Hero.wouldExceedAttunementLimit`) rather than tracked as a
 *     separate "worn but inert" state â€” a hero can never end up wearing a
 *     dead-weight unattuned item, so `armorClass`/`effectiveAttackDamage`
 *     need no attunement check of their own.
 *   - `proc`: a real on-hit/on-kill magic effect (see `EquipmentProc`
 *     below), resolved by `BattleScene` against the same `AttackResult` a
 *     basic Attack action already produces â€” the exact shape Divine
 *     Smite/Hunter's Mark (D-093) established, just gated by equipment
 *     instead of class. Only wired into the basic Attack action, same
 *     scope boundary those two features already have.
 */

/**
 * Phase 17 (D-108): two new slot TYPES, "weapon" and "shield", plus the real
 * SRD 5.2.1 weapon/armor catalogues (data/weapons.ts, data/armor.ts, merged
 * into this module's EQUIPMENT_DEFINITIONS/EQUIPMENT_ORDER below) and real
 * weapon-mastery mechanics. A weapon REPLACES a hero's base attack-damage
 * and attack-range (see Hero.effectiveAttackDamage/.attackRangeTiles); real
 * armor (the `armor` field) REPLACES the unarmored-AC formula instead of
 * adding a flat bonus to it (see Hero.armorClass). Both are opt-in - a hero
 * with nothing in the new slots plays exactly as before this phase.
 */
export type GearSlotType = "head" | "chest" | "legs" | "ring" | "amulet" | "footwear" | "weapon" | "shield" | "back";

/** Phase 13.9 (D-094): a real five-tier magic-item rarity ladder. */
export type EquipmentRarity = "common" | "uncommon" | "rare" | "veryRare" | "legendary";

export const RARITY_ORDER: readonly EquipmentRarity[] = ["common", "uncommon", "rare", "veryRare", "legendary"];

export const RARITY_LABELS: Record<EquipmentRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  veryRare: "Very Rare",
  legendary: "Legendary",
};

/**
 * Ten slot INSTANCES a hero has, spanning nine slot TYPES ("ring" x2).
 * Phase 17 (D-108) added "weapon" and "shield", each a single instance.
 * Phase 22 (magic-item expansion) adds "back" — a cloak/cape slot, home to
 * Ring/Cloak-of-Protection-style items and the Cape of Billowing.
 */
export type GearSlotId =
  | "head"
  | "chest"
  | "legs"
  | "ring1"
  | "ring2"
  | "amulet"
  | "footwear"
  | "weapon"
  | "shield"
  | "back";

export const GEAR_SLOT_IDS: readonly GearSlotId[] = [
  "weapon",
  "shield",
  "head",
  "chest",
  "legs",
  "back",
  "ring1",
  "ring2",
  "amulet",
  "footwear",
];

/**
 * Phase 2 (2026-08-28 playtest batch, D-204): per-hero SLOT labels read
 * "Right hand"/"Left hand" instead of "Weapon"/"Shield" — the underlying
 * mechanic already treats "shield" as a generic off-hand slot (a Light
 * melee weapon fits there too, see Phase 17/D-108's dual-wielding). Deliberately
 * NOT applied to `GEAR_SLOT_TYPE_LABELS` below, which categorizes item
 * TYPES in the shop/Compendium catalogue, not per-hero slots.
 */
export const GEAR_SLOT_LABELS: Record<GearSlotId, string> = {
  weapon: "Right hand",
  shield: "Left hand",
  head: "Head",
  chest: "Chest",
  legs: "Legs",
  back: "Back",
  ring1: "Ring 1",
  ring2: "Ring 2",
  amulet: "Amulet",
  footwear: "Footwear",
};

/** Which slot TYPE a slot INSTANCE accepts (both rings accept "ring" items). */
export function gearSlotType(slotId: GearSlotId): GearSlotType {
  return slotId === "ring1" || slotId === "ring2" ? "ring" : slotId;
}

/** Display name for a slot TYPE (used in the shop catalogue, not per-hero messages). */
export const GEAR_SLOT_TYPE_LABELS: Record<GearSlotType, string> = {
  weapon: "Weapon",
  shield: "Shield",
  head: "Head",
  chest: "Chest",
  legs: "Legs",
  back: "Back",
  ring: "Ring",
  amulet: "Amulet",
  footwear: "Footwear",
};

/**
 * Phase 13.9 (D-094): a real on-hit/on-kill magic effect. Resolved by
 * `BattleScene.applyEquipmentProcs` against the same `AttackResult` a basic
 * Attack action already produced, mirroring Divine Smite/Hunter's Mark
 * (D-093)'s shape exactly, just gated by an equipped item instead of a class.
 */
export type EquipmentProc =
  /** On a landed hit, applies a status effect to the target â€” no save. */
  | { kind: "onHitStatus"; statusId: StatusEffectId; durationTurns: number }
  /**
   * On a landed hit, the target rolls a saving throw or takes bonus damage.
   * D-137: `damageType`/`damageTypes`/`magical` are optional and route the
   * bonus damage through `CombatSystem.applyResistance` (same shape as
   * `AttackProfile`) instead of hitting `enemy.health` unconditionally —
   * left absent, this proc behaves exactly as it always has (Flame
   * Tongue/Frost Brand don't set these, so their bonus damage stays
   * untyped/unresisted, unchanged). A future item that needs its bonus
   * damage split across two real types (a "frostfire" weapon, say) sets
   * `damageTypes` the same way `AbilityDefinition.damageTypes` does.
   */
  | {
      kind: "onHitSaveOrDamage";
      saveDC: number;
      bonusDamage: number;
      damageType?: DamageType;
      damageTypes?: ReadonlyArray<DamageTypeSplit>;
      magical?: boolean;
    }
  /** Whenever the wearer defeats an enemy, the nearest other living ally is healed. */
  | { kind: "onKillHealNearestAlly"; healAmount: number }
  /** On a landed hit while the wearer has an active damage-resistance buff (Rage/Wild Shape), deals bonus damage. */
  | { kind: "onHitWhileResistant"; bonusDamage: number };

export interface EquipmentDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Which slot type this item goes into (a ring fits either ring instance). */
  slot: GearSlotType;
  /** Phase 13.9 (D-094): where this item sits on the rarity ladder. */
  rarity: EquipmentRarity;
  /** Flat bonus to a hero's basic-attack damage while equipped. */
  attackDamage?: number;
  /** Flat Armor Class bonus while equipped (see Hero.armorClass). */
  armorClass?: number;
  /** Phase 22 (magic-item expansion): flat bonus to saving throws while equipped (see Hero.savingThrowBonus). Real SRD items like Ring/Cloak of Protection grant this alongside AC. */
  savingThrowBonus?: number;
  /** Phase 22: flat bonus to movement tiles while equipped (see Hero.effectiveMovementTiles). Boots of Striding and Springing/Speed. */
  movementBonusTiles?: number;
  /** Phase 22: bonus to attack rolls ONLY while a ranged weapon is equipped (Bracers of Archery). Mirrors the Archery feat's own conditional-bonus shape. */
  rangedAttackBonus?: number;
  /** Phase 22: bonus to basic-attack damage ONLY while a ranged weapon is equipped (Bracers of Archery). */
  rangedAttackDamage?: number;
  /** Phase 22: statuses this item makes the wearer immune to (Ring of Free Action, Periapt of Proof against Poison) - checked by Hero.applyStatus. */
  grantsStatusImmunity?: StatusEffectId[];
  /** Phase 22: a purely cosmetic visual hook, checked by BattleScene - the string below trails an animated cape graphic behind the wearer's token. */
  visualEffect?: "flowingCape";
  /**
   * Phase 13.9 (D-094): true for rare-and-up items whose bonuses/proc
   * require one of a hero's limited attunement slots â€” see
   * `Hero.wouldExceedAttunementLimit`.
   */
  requiresAttunement?: boolean;
  /** Phase 13.9 (D-094): a real on-hit/on-kill magic effect. Absent for a purely flat-bonus item. */
  proc?: EquipmentProc;
  /**
   * D-127: a charge-based active item (wand/rod/staff) — grants `spellId` to
   * ANY hero while equipped (added to `Hero.knownSpellAbilityIds`, same
   * "castable even with no real spell slots" shape as Magic Initiate),
   * spending one of `maxCharges` per cast instead of a slot. Fully refills
   * on a Long Rest (this project's existing simplification for every other
   * per-rest resource — no partial-recharge dice roll). Absent for every
   * other item.
   */
  chargedSpell?: { spellId: string; maxCharges: number };
  /**
   * D-127: an ability-score-SETTING item (Gauntlets of Ogre Power, Headband
   * of Intellect, Amulet of Health) — sets `ability` to `value` while
   * equipped, with no effect if the hero's own score is already `value` or
   * higher (the real SRD rule — see `Hero.effectiveAbilityScore`). Absent
   * for every other item.
   */
  setsAbilityScore?: { ability: AbilityScoreId; value: number };
  /** Phase 17 (D-108): present only for a `slot: "weapon"` item — see data/weapons.ts. */
  weapon?: WeaponData;
  /** Phase 17 (D-108): present only for a `slot: "chest"` REAL ARMOR item (absent for a flavor chest item) — see data/armor.ts. */
  armor?: ArmorData;
  /** Phase 22 (magic-item expansion): present only on a synthesized `+1/+2/+3` enchanted weapon/armor/shield — see `enchantedItemId`/`getEquipmentDefinition`. Absent on every hand-authored catalog entry. */
  enchantLevel?: EnchantLevel;
  /** Phase 22: the mundane base item id an enchanted item was generated from. Absent on every hand-authored catalog entry. */
  baseItemId?: string;
  /** Rendering hint (used later for real art); a colour is used for now. */
  assetKey: string;
}

/**
 * Phase 22 (magic-item expansion): the SRD's real "+1/+2/+3" enchantment —
 * a MODIFIER on a mundane weapon/armor/shield, not a separate hand-authored
 * catalog item. Kevin's own scoping call (over a ~150-entry flat cross-
 * product): an enchanted item is a `${baseId}+${level}` composite id,
 * synthesized on demand by `getEquipmentDefinition` from its base item's own
 * real data — so a loot roll can generate "Longsword +2" for ANY of the 36
 * weapons/12 armors/1 shield without a single new catalog entry, and any
 * weapon/armor added in the future is enchantable for free.
 *
 * Only a `rarity: "common"` weapon, shield, or REAL-armor chest item is
 * enchantable — matches the real SRD rule (basic +N gear is a mundane item
 * made magical, not an already-magical named item made MORE magical) and
 * keeps every hand-authored magic item (Ring of Frostbite, Flame Tongue,
 * etc.) out of the enchant pool. A `+N` weapon/armor/shield does NOT require
 * attunement — also the real SRD rule; only specific NAMED magic items do.
 */
export type EnchantLevel = 1 | 2 | 3;

export const ENCHANT_LEVELS: readonly EnchantLevel[] = [1, 2, 3];

/** Where each enchant level sits on the rarity ladder — the loot system's tier-to-enchant-level mapping. */
export const ENCHANT_RARITY: Record<EnchantLevel, EquipmentRarity> = {
  1: "uncommon",
  2: "rare",
  3: "veryRare",
};

/** First-pass, untuned gold cost added on top of the base item's own cost. */
const ENCHANT_COST_BONUS: Record<EnchantLevel, number> = {
  1: 40,
  2: 100,
  3: 220,
};

export function enchantedItemId(baseId: string, level: EnchantLevel): string {
  return `${baseId}+${level}`;
}

/** Parses a `${baseId}+${level}` composite id, or null if `id` isn't shaped like one. */
export function parseEnchantedItemId(id: string): { baseId: string; level: EnchantLevel } | null {
  const match = /^(.+)\+([123])$/.exec(id);
  if (!match) return null;
  return { baseId: match[1], level: Number(match[2]) as EnchantLevel };
}

/** True for a mundane (common-rarity) weapon, shield, or real-armor chest item — the only bases the enchant overlay accepts. */
function isEnchantableBase(def: EquipmentDefinition): boolean {
  if (def.rarity !== "common") return false;
  return def.slot === "weapon" || def.slot === "shield" || (def.slot === "chest" && !!def.armor);
}

/**
 * Every base item id the enchant overlay can generate a `+1/+2/+3` version
 * of — the loot system's own pool of "roll a random enchant-eligible base."
 */
export function enchantEligibleBaseIds(): readonly string[] {
  return EQUIPMENT_ORDER.filter((id) => isEnchantableBase(EQUIPMENT_DEFINITIONS[id]));
}

/** Builds the synthesized `EquipmentDefinition` for a `${baseId}+${level}` composite id. `base` must already satisfy `isEnchantableBase`. */
function synthesizeEnchantedDefinition(base: EquipmentDefinition, level: EnchantLevel): EquipmentDefinition {
  const enchantText = `A magical +${level} enchantment: `;
  if (base.armor) {
    // Real armor: the bonus folds straight into its own base AC (see
    // Hero.armorClass, which reads `chestDef.armor.baseAC` directly — no
    // Hero.ts change needed for this case).
    return {
      ...base,
      id: enchantedItemId(base.id, level),
      name: `${base.name} +${level}`,
      description: `${base.description} ${enchantText}+${level} Armor Class.`,
      cost: base.cost + ENCHANT_COST_BONUS[level],
      rarity: ENCHANT_RARITY[level],
      armor: { ...base.armor, baseAC: base.armor.baseAC + level },
      enchantLevel: level,
      baseItemId: base.id,
    };
  }
  if (base.slot === "shield") {
    // A flat AC item in its own slot — already summed generically by
    // Hero.armorClass's gear loop, so a bigger `armorClass` is all this needs.
    return {
      ...base,
      id: enchantedItemId(base.id, level),
      name: `${base.name} +${level}`,
      description: `${base.description} ${enchantText}+${level} Armor Class.`,
      cost: base.cost + ENCHANT_COST_BONUS[level],
      rarity: ENCHANT_RARITY[level],
      armorClass: (base.armorClass ?? 0) + level,
      enchantLevel: level,
      baseItemId: base.id,
    };
  }
  // A weapon: the bonus applies to both the attack ROLL and the damage roll
  // — read via `enchantLevel` by Hero.effectiveAttackBonus/effectiveAttackDamage,
  // since weapon damage comes from a dice-average calculation, not a flat field.
  return {
    ...base,
    id: enchantedItemId(base.id, level),
    name: `${base.name} +${level}`,
    description: `${base.description} ${enchantText}+${level} to attack and damage rolls.`,
    cost: base.cost + ENCHANT_COST_BONUS[level],
    rarity: ENCHANT_RARITY[level],
    enchantLevel: level,
    baseItemId: base.id,
  };
}

export const EQUIPMENT_DEFINITIONS: Record<string, EquipmentDefinition> = {
  "leather-cap": {
    id: "leather-cap",
    name: "Leather Cap",
    description: "+1 AC.",
    cost: 8,
    slot: "head",
    rarity: "common",
    armorClass: 1,
    assetKey: "equipment-leather-cap",
  },
  "circlet-of-focus": {
    id: "circlet-of-focus",
    name: "Circlet of Focus",
    description: "+1 AC and +1 basic-attack damage.",
    cost: 14,
    slot: "head",
    rarity: "uncommon",
    armorClass: 1,
    attackDamage: 1,
    assetKey: "equipment-circlet-of-focus",
  },
  "iron-buckler": {
    id: "iron-buckler",
    name: "Iron Buckler",
    description: "+2 AC (harder to hit).",
    cost: 10,
    slot: "chest",
    rarity: "common",
    armorClass: 2,
    assetKey: "equipment-iron-buckler",
  },
  "chainmail-vest": {
    id: "chainmail-vest",
    name: "Chainmail Vest",
    description: "+3 AC.",
    cost: 16,
    slot: "chest",
    rarity: "uncommon",
    armorClass: 3,
    assetKey: "equipment-chainmail-vest",
  },
  "travelers-cloak": {
    id: "travelers-cloak",
    name: "Traveler's Cloak",
    description: "+1 AC and +1 basic-attack damage.",
    cost: 14,
    slot: "legs",
    rarity: "uncommon",
    armorClass: 1,
    attackDamage: 1,
    assetKey: "equipment-travelers-cloak",
  },
  "swift-greaves": {
    id: "swift-greaves",
    name: "Swift Greaves",
    description: "+1 AC.",
    cost: 10,
    slot: "legs",
    rarity: "common",
    armorClass: 1,
    assetKey: "equipment-swift-greaves",
  },
  "whetstone-band": {
    id: "whetstone-band",
    name: "Whetstone Band",
    description: "+2 basic-attack damage.",
    cost: 10,
    slot: "ring",
    rarity: "common",
    attackDamage: 2,
    assetKey: "equipment-whetstone-band",
  },
  "band-of-vigor": {
    id: "band-of-vigor",
    name: "Band of Vigor",
    description: "+1 AC and +1 basic-attack damage.",
    cost: 12,
    slot: "ring",
    rarity: "uncommon",
    armorClass: 1,
    attackDamage: 1,
    assetKey: "equipment-band-of-vigor",
  },
  "amulet-of-warding": {
    id: "amulet-of-warding",
    name: "Amulet of Warding",
    description: "+2 AC.",
    cost: 12,
    slot: "amulet",
    rarity: "uncommon",
    armorClass: 2,
    assetKey: "equipment-amulet-of-warding",
  },
  "amulet-of-fury": {
    id: "amulet-of-fury",
    name: "Amulet of Fury",
    description: "+2 basic-attack damage.",
    cost: 12,
    slot: "amulet",
    rarity: "uncommon",
    attackDamage: 2,
    assetKey: "equipment-amulet-of-fury",
  },
  // Party Creation Overhaul Plan 2 (D-193): four basic spellcasting foci,
  // part of the amulet slot's own starting-gear pool (any hero may pick
  // one, same as any other amulet — no class gating). Reuses the
  // pre-existing "amulet" slot (already a generic misc-trinket slot for
  // bracers/wands/gauntlets, not literally amulet-shaped) rather than
  // adding a new slot type — zero blast radius on GEAR_SLOT_IDS/
  // attunement/slot-enumerating UI.
  "holy-symbol": {
    id: "holy-symbol",
    name: "Holy Symbol",
    description: "+1 AC. A cleric's channel for divine magic.",
    cost: 6,
    slot: "amulet",
    rarity: "common",
    armorClass: 1,
    assetKey: "equipment-holy-symbol",
  },
  "arcane-focus": {
    id: "arcane-focus",
    name: "Arcane Focus",
    description: "+1 basic-attack damage. A wizard or sorcerer's channel for arcane magic.",
    cost: 6,
    slot: "amulet",
    rarity: "common",
    attackDamage: 1,
    assetKey: "equipment-arcane-focus",
  },
  "druidic-totem": {
    id: "druidic-totem",
    name: "Druidic Totem",
    description: "+1 AC. A druid's channel for primal magic.",
    cost: 6,
    slot: "amulet",
    rarity: "common",
    armorClass: 1,
    assetKey: "equipment-druidic-totem",
  },
  "component-pouch": {
    id: "component-pouch",
    name: "Component Pouch",
    description: "+1 basic-attack damage. A warlock or bard's spellcasting component kit.",
    cost: 6,
    slot: "amulet",
    rarity: "common",
    attackDamage: 1,
    assetKey: "equipment-component-pouch",
  },
  "boots-of-striding": {
    id: "boots-of-striding",
    name: "Boots of Striding",
    description: "+1 AC.",
    cost: 8,
    slot: "footwear",
    rarity: "common",
    armorClass: 1,
    assetKey: "equipment-boots-of-striding",
  },
  "boots-of-the-brawler": {
    id: "boots-of-the-brawler",
    name: "Boots of the Brawler",
    description: "+1 AC and +1 basic-attack damage.",
    cost: 12,
    slot: "footwear",
    rarity: "uncommon",
    armorClass: 1,
    attackDamage: 1,
    assetKey: "equipment-boots-of-the-brawler",
  },

  /**
   * Phase 13.9 (D-094): five new rare-and-up items, one per proc kind
   * Kevin asked for, plus a legendary flat-bonus item completing the
   * rarity ladder's top end. All require attunement (see `EquipmentProc`'s
   * module comment for why that's an equip-time gate, not a separate
   * "worn but inert" state).
   */
  "ring-of-frostbite": {
    id: "ring-of-frostbite",
    name: "Ring of Frostbite",
    description:
      "+1 AC. On a landed hit, chills the target with Slowed for 2 turns. Requires attunement.",
    cost: 32,
    slot: "ring",
    rarity: "rare",
    armorClass: 1,
    requiresAttunement: true,
    proc: { kind: "onHitStatus", statusId: "slowed", durationTurns: 2 },
    assetKey: "equipment-ring-of-frostbite",
  },
  "amulet-of-withering": {
    id: "amulet-of-withering",
    name: "Amulet of Withering",
    description:
      "+1 basic-attack damage. On a landed hit, the target must succeed on a DC 13 save or take 3 extra damage. Requires attunement.",
    cost: 34,
    slot: "amulet",
    rarity: "rare",
    attackDamage: 1,
    requiresAttunement: true,
    proc: { kind: "onHitSaveOrDamage", saveDC: 13, bonusDamage: 3 },
    assetKey: "equipment-amulet-of-withering",
  },
  "signet-of-kinship": {
    id: "signet-of-kinship",
    name: "Signet of Kinship",
    description:
      "+1 AC. Whenever the wearer defeats an enemy, the nearest other living ally is healed for 4 HP. Requires attunement.",
    cost: 30,
    slot: "ring",
    rarity: "rare",
    armorClass: 1,
    requiresAttunement: true,
    proc: { kind: "onKillHealNearestAlly", healAmount: 4 },
    assetKey: "equipment-signet-of-kinship",
  },
  "greaves-of-the-berserker": {
    id: "greaves-of-the-berserker",
    name: "Greaves of the Berserker",
    description:
      "+2 basic-attack damage, +1 AC. While the wearer has an active damage-resistance buff (Rage/Wild Shape), a landed hit deals 3 extra damage. Requires attunement.",
    cost: 46,
    slot: "legs",
    rarity: "veryRare",
    attackDamage: 2,
    armorClass: 1,
    requiresAttunement: true,
    proc: { kind: "onHitWhileResistant", bonusDamage: 3 },
    assetKey: "equipment-greaves-of-the-berserker",
  },
  "aegis-of-the-first-ward": {
    id: "aegis-of-the-first-ward",
    name: "Aegis of the First Ward",
    description: "+4 AC and +2 basic-attack damage. Requires attunement.",
    cost: 70,
    slot: "chest",
    rarity: "legendary",
    armorClass: 4,
    attackDamage: 2,
    requiresAttunement: true,
    assetKey: "equipment-aegis-of-the-first-ward",
  },

  // Phase 17 (D-108): the real SRD 5.2.1 weapon/armor/shield catalogues,
  // merged into this same registry so every existing lookup
  // (getEquipmentDefinition, the Gear shop grid, the Compendium tab,
  // attunement/proc checks) keeps working with zero special-casing.
  ...WEAPON_DEFINITIONS,
  ...ARMOR_DEFINITIONS,
  ...SHIELD_DEFINITIONS,
  // Phase 22 (magic-item expansion): the real SRD 5.1 free-access magic-item
  // catalogue (rings/cloaks/boots/named weapons) plus the original Cape of
  // Billowing — see data/magicItems.ts.
  ...MAGIC_ITEM_DEFINITIONS,
};

/** The equipment catalogue in shop order (for the Gear UI), grouped by slot. */
export const EQUIPMENT_ORDER: string[] = [
  "leather-cap",
  "circlet-of-focus",
  "iron-buckler",
  "chainmail-vest",
  "aegis-of-the-first-ward",
  "travelers-cloak",
  "swift-greaves",
  "greaves-of-the-berserker",
  "whetstone-band",
  "band-of-vigor",
  "ring-of-frostbite",
  "signet-of-kinship",
  "amulet-of-warding",
  "amulet-of-fury",
  "amulet-of-withering",
  "holy-symbol",
  "arcane-focus",
  "druidic-totem",
  "component-pouch",
  "boots-of-striding",
  "boots-of-the-brawler",
  ...WEAPON_ORDER,
  ...ARMOR_ORDER,
  ...SHIELD_ORDER,
  ...MAGIC_ITEM_ORDER,
];

/**
 * Look up a definition, throwing on an unknown id so typos fail loudly.
 *
 * Phase 22 (magic-item expansion): a hand-authored catalog entry is checked
 * FIRST; if `id` isn't one, it's tried as a `${baseId}+${level}` enchanted
 * composite (see `parseEnchantedItemId`) and synthesized on demand from its
 * base item — the loot system's own "generate any enchanted item without a
 * catalog entry" mechanism.
 */
export function getEquipmentDefinition(id: string): EquipmentDefinition {
  const def = EQUIPMENT_DEFINITIONS[id];
  if (def) return def;
  const parsed = parseEnchantedItemId(id);
  if (parsed) {
    const base = EQUIPMENT_DEFINITIONS[parsed.baseId];
    if (base && isEnchantableBase(base)) return synthesizeEnchantedDefinition(base, parsed.level);
  }
  throw new Error(`Unknown equipment id "${id}".`);
}

/** Every catalogue item that fits a given slot type, in catalogue order. */
export function equipmentForSlotType(slot: GearSlotType): EquipmentDefinition[] {
  return EQUIPMENT_ORDER.map(getEquipmentDefinition).filter((def) => def.slot === slot);
}

/**
 * Phase 2 (2026-08-28 playtest batch, D-204): true if `itemId` is a
 * Two-Handed weapon — the real SRD grip rule (a Two-Handed weapon needs both
 * hands, so it can't coexist with anything in the Shield/off-hand slot).
 * Mirrors the same check `Hero.wouldConflictWithGrip` does against a live
 * hero's `equippedItems`, just against a bare item id — used by
 * `CharacterCreationScene`, which works in gear-slot indices before any
 * `Hero` exists.
 */
export function isTwoHandedWeapon(itemId: string): boolean {
  return !!getEquipmentDefinition(itemId).weapon?.properties.includes("twoHanded");
}
