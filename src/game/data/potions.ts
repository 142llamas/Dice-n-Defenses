import type { EquipmentRarity } from "./equipment";

/**
 * Potion definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 11.5 (D-078): the "general" half of the classic loadout Kevin asked
 * for. Each hero has two GENERAL slots (see `GENERAL_SLOT_IDS`) that hold
 * consumable potions instead of persistent gear — bought from the same
 * in-battle shop as equipment, then spent as the hero's ACTION in battle
 * (consuming this game's existing move-plus-one-action turn economy, so no
 * new action-economy system is needed — see D-071's boundary notes).
 *
 * Phase 22 (magic-item expansion) adds real SRD-sourced potions and three
 * more effect kinds, plus a `rarity` field (retro-tagging the original two
 * `common` by their existing, unchanged power — the same "tag by existing
 * power level, don't renumber" treatment Phase 13.9/D-094 gave equipment):
 *   - "heal": restores HP, capped at the hero's effective max HP.
 *   - "attackBuff": a permanent (for the rest of the battle) attack-damage
 *     increase — mechanically identical to a level-up Might choice
 *     (`Hero.grantMight`), just delivered by a consumable instead of a wave
 *     milestone.
 *   - "movementBuff": a permanent (for the rest of the battle) movement-tile
 *     increase (`Hero.grantHaste`) — Potion of Speed, simplified from the
 *     real SRD's "activate for 10 rounds" into an always-on bonus for the
 *     rest of the battle, the same treatment `attackBuff` already has.
 *   - "resistanceBuff": grants the SAME damage-halving resistance Rage/Wild
 *     Shape already provide (`Hero.grantResistance`/`hasDamageResistance`),
 *     for the rest of the battle — Potion of Resistance, simplified from
 *     the real SRD's single-damage-type resistance (this game has no
 *     damage-type system) into the general halving this game already models.
 *   - "cureAndHeal": clears every active status effect AND heals — the real
 *     SRD Restorative Ointment's "ends one condition, plus healing."
 *
 * All content here is ORIGINAL to this project, EXCEPT the eight new
 * potions' real SRD names/rarity — see CONTENT_SOURCES.md.
 */

export type PotionEffectId = "heal" | "attackBuff" | "movementBuff" | "resistanceBuff" | "cureAndHeal";

/** Two consumable slots per hero, separate from the ten gear slots. */
export type GeneralSlotId = "general1" | "general2";

export const GENERAL_SLOT_IDS: readonly GeneralSlotId[] = ["general1", "general2"];

export const GENERAL_SLOT_LABELS: Record<GeneralSlotId, string> = {
  general1: "Potion 1",
  general2: "Potion 2",
};

export interface PotionDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: PotionEffectId;
  /**
   * "heal"/"cureAndHeal": HP restored. "attackBuff": flat attack-damage
   * increase. "movementBuff": flat movement-tile increase. "resistanceBuff":
   * unused (the buff itself is boolean, not a magnitude) — always 0.
   */
  amount: number;
  /** Phase 22 (magic-item expansion): where this potion sits on the rarity ladder — the loot system's own tier key. */
  rarity: EquipmentRarity;
  /** Rendering hint (used later for real art); a colour is used for now. */
  assetKey: string;
}

export const POTION_DEFINITIONS: Record<string, PotionDefinition> = {
  "healing-draught": {
    id: "healing-draught",
    name: "Healing Draught",
    description: "Restores 6 HP on use, capped at max health.",
    cost: 10,
    effect: "heal",
    amount: 6,
    rarity: "common",
    assetKey: "potion-healing-draught",
  },
  "vigor-tonic": {
    id: "vigor-tonic",
    name: "Vigor Tonic",
    description: "+2 basic-attack damage for the rest of the battle.",
    cost: 12,
    effect: "attackBuff",
    amount: 2,
    rarity: "common",
    assetKey: "potion-vigor-tonic",
  },
  "potion-of-healing": {
    id: "potion-of-healing",
    name: "Potion of Healing",
    description: "Restores 7 HP on use, capped at max health.",
    cost: 12,
    effect: "heal",
    amount: 7,
    rarity: "common",
    assetKey: "potion-of-healing",
  },
  "potion-of-greater-healing": {
    id: "potion-of-greater-healing",
    name: "Potion of Greater Healing",
    description: "Restores 14 HP on use, capped at max health.",
    cost: 26,
    effect: "heal",
    amount: 14,
    rarity: "uncommon",
    assetKey: "potion-of-greater-healing",
  },
  "potion-of-superior-healing": {
    id: "potion-of-superior-healing",
    name: "Potion of Superior Healing",
    description: "Restores 28 HP on use, capped at max health.",
    cost: 54,
    effect: "heal",
    amount: 28,
    rarity: "rare",
    assetKey: "potion-of-superior-healing",
  },
  "potion-of-supreme-healing": {
    id: "potion-of-supreme-healing",
    name: "Potion of Supreme Healing",
    description: "Restores 45 HP on use, capped at max health.",
    cost: 90,
    effect: "heal",
    amount: 45,
    rarity: "veryRare",
    assetKey: "potion-of-supreme-healing",
  },
  "potion-of-heroism": {
    id: "potion-of-heroism",
    name: "Potion of Heroism",
    description: "+4 basic-attack damage for the rest of the battle.",
    cost: 40,
    effect: "attackBuff",
    amount: 4,
    rarity: "rare",
    assetKey: "potion-of-heroism",
  },
  "potion-of-speed": {
    id: "potion-of-speed",
    name: "Potion of Speed",
    description: "+4 movement tiles for the rest of the battle.",
    cost: 72,
    effect: "movementBuff",
    // D-172: 4 tiles = the real 20ft bonus, rescaled from 5ft/tile (was 2 tiles).
    amount: 4,
    rarity: "veryRare",
    assetKey: "potion-of-speed",
  },
  "potion-of-resistance": {
    id: "potion-of-resistance",
    name: "Potion of Resistance",
    description: "Halves incoming damage for the rest of the battle.",
    cost: 46,
    effect: "resistanceBuff",
    amount: 0,
    rarity: "rare",
    assetKey: "potion-of-resistance",
  },
  "restorative-ointment": {
    id: "restorative-ointment",
    name: "Restorative Ointment",
    description: "Clears every active status effect and restores 6 HP on use, capped at max health.",
    cost: 24,
    effect: "cureAndHeal",
    amount: 6,
    rarity: "uncommon",
    assetKey: "restorative-ointment",
  },
};

/** The potion catalogue in shop order (for the Gear UI's potion entries). */
export const POTION_ORDER: string[] = [
  "healing-draught",
  "vigor-tonic",
  "potion-of-healing",
  "potion-of-greater-healing",
  "potion-of-superior-healing",
  "potion-of-supreme-healing",
  "potion-of-heroism",
  "potion-of-speed",
  "potion-of-resistance",
  "restorative-ointment",
];

/** Look up a definition, throwing on an unknown id so typos fail loudly. */
export function getPotionDefinition(id: string): PotionDefinition {
  const def = POTION_DEFINITIONS[id];
  if (!def) throw new Error(`Unknown potion id "${id}".`);
  return def;
}
