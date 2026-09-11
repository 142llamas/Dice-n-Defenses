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
import { ABILITY_SCORE_IDS, ABILITY_SCORE_NAMES, type AbilityScoreId } from "../data/abilityScores";
import { getStatusEffectDefinition, type StatusEffectId } from "../data/statusEffects";
import { getSpell } from "../data/spells";

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
  /** Item 4 (Batch B): a `savingThrowBonus` item's effect — Ring/Cloak of Protection, Stone of Good Luck. */
  beforeSavingThrow: number;
  afterSavingThrow: number;
  /** Item 4: a `movementBonusTiles` item's effect — Boots of Striding and Springing/Speed. */
  beforeMovementTiles: number;
  afterMovementTiles: number;
  /** Item 4: every ability this slot change actually moves, via a `setsAbilityScore` item (Gauntlets of Ogre Power and siblings). Empty when the item has no such effect — always empty for a hero with no ability scores (the classic fixed roster), same as every other ability-score-derived getter on `Hero`. */
  abilityScoreChanges: Array<{ ability: AbilityScoreId; before: number; after: number }>;
  /** Item 4: statuses this slot change grants immunity to that the previous occupant didn't (Ring of Free Action, Periapt of Proof against Poison). */
  statusImmunityGained: StatusEffectId[];
  /** Item 4: statuses the previous occupant granted immunity to that this item doesn't. */
  statusImmunityLost: StatusEffectId[];
  /** Item 4: a `chargedSpell` this slot change grants (a wand/rod/staff) that the previous occupant didn't. */
  chargedSpellGained?: { spellId: string; maxCharges: number };
  /** Item 4: a `chargedSpell` the previous occupant granted that this item doesn't. */
  chargedSpellLost?: { spellId: string; maxCharges: number };
}

/**
 * What would change if `hero` equipped `itemId` into `slot` right now.
 * Simulates on a throwaway `Hero.fromSnapshot` clone (bypassing cost/
 * attunement/grip validation, which only matters for a REAL equip) so a
 * hover/compare preview never touches the live hero or the player's gold.
 */
export function previewGearSlotChange(hero: Hero, slot: GearSlotId, itemId: string): GearSlotPreview {
  const beforeItemId = hero.equippedItems[slot];
  const beforeDef = beforeItemId ? getEquipmentDefinition(beforeItemId) : undefined;
  const afterDef = getEquipmentDefinition(itemId);

  const clone = Hero.fromSnapshot(hero.toSnapshot());
  clone.equippedItems[slot] = itemId;
  clone.onGearChanged();

  const abilityScoreChanges: GearSlotPreview["abilityScoreChanges"] = [];
  for (const ability of ABILITY_SCORE_IDS) {
    const before = hero.effectiveAbilityScore(ability);
    const after = clone.effectiveAbilityScore(ability);
    if (before !== after) abilityScoreChanges.push({ ability, before, after });
  }

  const beforeImmunities = new Set(beforeDef?.grantsStatusImmunity ?? []);
  const afterImmunities = new Set(afterDef.grantsStatusImmunity ?? []);
  const statusImmunityGained = [...afterImmunities].filter((id) => !beforeImmunities.has(id));
  const statusImmunityLost = [...beforeImmunities].filter((id) => !afterImmunities.has(id));

  return {
    beforeAC: hero.armorClass,
    afterAC: clone.armorClass,
    beforeAttackBonus: hero.effectiveAttackBonus,
    afterAttackBonus: clone.effectiveAttackBonus,
    beforeAttackDamage: hero.effectiveAttackDamage,
    afterAttackDamage: clone.effectiveAttackDamage,
    beforeSavingThrow: hero.savingThrowBonus,
    afterSavingThrow: clone.savingThrowBonus,
    beforeMovementTiles: hero.effectiveMovementTiles,
    afterMovementTiles: clone.effectiveMovementTiles,
    abilityScoreChanges,
    statusImmunityGained,
    statusImmunityLost,
    chargedSpellGained: !beforeDef?.chargedSpell && afterDef.chargedSpell ? afterDef.chargedSpell : undefined,
    chargedSpellLost: beforeDef?.chargedSpell && !afterDef.chargedSpell ? beforeDef.chargedSpell : undefined,
  };
}

/**
 * A short "AC 14→16, attack +2→+4" summary of a `GearSlotPreview` — the same
 * one-line format the old (deleted) `BattleScene.previewEquipDelta` produced,
 * for the Armory's compare panel.
 *
 * Item 4 (Batch B, KI-187): previously silent on anything but AC/attack
 * bonus, so any item whose real effect was damage dice, saving throws,
 * movement, an ability-score-setting effect, a granted status immunity, or a
 * granted charged spell fell through to a flatly wrong "No AC/attack change"
 * — the exact playtest complaint. Every field `EquipmentDefinition` can
 * actually carry is covered now; the fallback string no longer claims "AC/
 * attack" specifically since it means "this item does nothing measurable."
 */
export function formatGearDelta(preview: GearSlotPreview): string {
  const parts: string[] = [];
  const fmt = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
  if (preview.afterAC !== preview.beforeAC) parts.push(`AC ${preview.beforeAC}→${preview.afterAC}`);
  if (preview.afterAttackBonus !== preview.beforeAttackBonus) {
    parts.push(`attack ${fmt(preview.beforeAttackBonus)}→${fmt(preview.afterAttackBonus)}`);
  }
  if (preview.afterAttackDamage !== preview.beforeAttackDamage) {
    parts.push(`dmg ${preview.beforeAttackDamage}→${preview.afterAttackDamage}`);
  }
  if (preview.afterSavingThrow !== preview.beforeSavingThrow) {
    parts.push(`save ${fmt(preview.beforeSavingThrow)}→${fmt(preview.afterSavingThrow)}`);
  }
  if (preview.afterMovementTiles !== preview.beforeMovementTiles) {
    parts.push(`move ${preview.beforeMovementTiles}→${preview.afterMovementTiles}`);
  }
  for (const change of preview.abilityScoreChanges) {
    const abbrev = ABILITY_SCORE_NAMES[change.ability].slice(0, 3).toUpperCase();
    parts.push(`${abbrev} ${change.before}→${change.after}`);
  }
  for (const id of preview.statusImmunityGained) parts.push(`+immune: ${getStatusEffectDefinition(id).name}`);
  for (const id of preview.statusImmunityLost) parts.push(`-immune: ${getStatusEffectDefinition(id).name}`);
  if (preview.chargedSpellGained) {
    parts.push(`+${getSpell(preview.chargedSpellGained.spellId).name} (${preview.chargedSpellGained.maxCharges} charges)`);
  }
  if (preview.chargedSpellLost) parts.push(`-${getSpell(preview.chargedSpellLost.spellId).name}`);
  return parts.length > 0 ? parts.join(", ") : "No change";
}
