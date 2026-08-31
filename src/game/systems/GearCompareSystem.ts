/**
 * GearCompareSystem: pure slot-eligibility and before/after math for The
 * Armory (D-209). Pure, no Phaser — moved out of `BattleScene` (where it
 * lived as `targetGearSlot`/`previewEquipDelta`/`isOffHandEligibleWeapon`
 * for the old click-item-then-click-hero Gear grid) because none of it
 * actually depended on scene state.
 *
 * The old flow picked an item first and had to GUESS which slot it should
 * land in (`targetGearSlot`'s ring1→ring2, weapon→shield fallback rules).
 * The Armory's flow picks the slot first (a paperdoll click), so the
 * catalog only ever needs the inverse question — "does this item fit the
 * slot already chosen?" — which is `isItemEligibleForSlot` below.
 * `targetGearSlot` itself has no equivalent here; nothing needs to guess a
 * slot anymore.
 */

import { Hero } from "../entities/Hero";
import { getEquipmentDefinition, gearSlotType, type EquipmentDefinition, type GearSlotId } from "../data/equipment";

/**
 * True for a Light melee weapon — the one item type that may target EITHER
 * hand slot (Phase 19, D-110's dual-wielding system). Every other weapon
 * only ever targets `"weapon"` (Right hand).
 */
export function isOffHandEligibleWeapon(def: EquipmentDefinition): boolean {
  return def.slot === "weapon" && def.weapon?.kind === "melee" && def.weapon.properties.includes("light");
}

/**
 * Does `itemId` belong in `slotId`? True for every slot's own matching
 * type, plus the one cross-type case D-110 established: a Light melee
 * weapon also fits the `"shield"` (Left hand) slot, since a shield and an
 * off-hand weapon occupy the same hand and are mutually exclusive anyway.
 */
export function isItemEligibleForSlot(itemId: string, slotId: GearSlotId): boolean {
  const def = getEquipmentDefinition(itemId);
  if (gearSlotType(slotId) === def.slot) return true;
  return slotId === "shield" && isOffHandEligibleWeapon(def);
}

/** The outcome of an Armory buy/sell attempt (`BattleScene.buyGearForHero` & co.) — a rejection carries a human-readable reason rather than throwing, since a stale/invalid request from a paused overlay scene is an expected case, not a bug. */
export type ShopActionResult = { ok: true; message: string } | { ok: false; reason: string };

/** A before/after snapshot of the stats an Armory compare panel cares about. */
export interface GearSlotPreview {
  beforeAC: number;
  afterAC: number;
  beforeAttackBonus: number;
  afterAttackBonus: number;
  beforeAttackDamage: number;
  afterAttackDamage: number;
}

/**
 * What would change if `hero` equipped `itemId` into `slot` right now.
 * Simulates on a throwaway `Hero.fromSnapshot` clone (bypassing cost/
 * attunement/grip validation, which only matters for a REAL equip) so a
 * hover/compare preview never touches the live hero or the player's gold.
 */
export function previewGearSlotChange(hero: Hero, slot: GearSlotId, itemId: string): GearSlotPreview {
  const clone = Hero.fromSnapshot(hero.toSnapshot());
  clone.equippedItems[slot] = itemId;
  clone.onGearChanged();
  return {
    beforeAC: hero.armorClass,
    afterAC: clone.armorClass,
    beforeAttackBonus: hero.effectiveAttackBonus,
    afterAttackBonus: clone.effectiveAttackBonus,
    beforeAttackDamage: hero.effectiveAttackDamage,
    afterAttackDamage: clone.effectiveAttackDamage,
  };
}

/** A short "AC 14→16, attack +2→+4" summary of a `GearSlotPreview` — the same one-line format the old (deleted) `BattleScene.previewEquipDelta` produced, for the Armory's compare panel. Silent on attack damage since weapon-for-weapon swaps vary too widely in shape (dice vs. flat) for one clean line; AC/attack bonus are the two numbers that stay comparable across any two items. */
export function formatGearDelta(preview: GearSlotPreview): string {
  const parts: string[] = [];
  if (preview.afterAC !== preview.beforeAC) parts.push(`AC ${preview.beforeAC}→${preview.afterAC}`);
  const fmt = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
  if (preview.afterAttackBonus !== preview.beforeAttackBonus) {
    parts.push(`attack ${fmt(preview.beforeAttackBonus)}→${fmt(preview.afterAttackBonus)}`);
  }
  return parts.length > 0 ? parts.join(", ") : "No AC/attack change";
}
