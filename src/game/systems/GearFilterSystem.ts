import { isItemEligibleForSlot } from "./GearCompareSystem";
import { getEquipmentDefinition, isTwoHandedWeapon, type GearSlotId, type EquipmentRarity } from "../data/equipment";
import type { WeaponCategory } from "../data/weapons";
import { isProficientWithHandsItem } from "./ProficiencySystem";

/**
 * GearFilterSystem — D-228 (KI-177 items 3/4): pure logic for consolidating
 * a pair of physically-separate-but-interchangeable equipment slots (Potion
 * 1/Potion 2, Ring 1/Ring 2) behind ONE shop filter. Kevin's own spec:
 * buying an item that fits either slot of the pair auto-places it into
 * whichever slot is empty; only when BOTH are already occupied does the
 * player need to see both current occupants and choose which one to
 * replace. No Phaser dependency — `GearShopScene`/`CharacterCreationScene`
 * call this and render whichever `PairPlacementDecision` comes back.
 */

export type PairPlacementDecision<S extends string> =
  | { kind: "autoPlace"; slot: S }
  | { kind: "compareAndReplace" };

/**
 * `slotA`/`slotB` are the two physical slots making up the pair (e.g.
 * "general1"/"general2" or "ring1"/"ring2"); `occupantA`/`occupantB` are
 * whatever item id (or null) currently sits in each. `slotA` wins when both
 * are empty, matching the existing convention that a fresh pick always
 * lands in the first slot.
 */
export function decideSlotPairPlacement<S extends string>(
  occupantA: string | null,
  occupantB: string | null,
  slotA: S,
  slotB: S,
): PairPlacementDecision<S> {
  if (!occupantA) return { kind: "autoPlace", slot: slotA };
  if (!occupantB) return { kind: "autoPlace", slot: slotB };
  return { kind: "compareAndReplace" };
}

/**
 * D-228 (item 5's base ask): the harder, asymmetric "Hands" consolidation
 * (Weapon="Right hand"/Shield="Left hand"). Unlike a potion/ring pair, an
 * item's CANDIDATE slot set depends on the item itself, via the exact same
 * eligibility rule the rest of the Armory already uses
 * (`isItemEligibleForSlot`/D-110's off-hand-light-weapon case): a real
 * shield only ever fits "shield"; a non-Light weapon only ever fits
 * "weapon"; a Light melee weapon fits either hand. This does NOT itself
 * enforce the SRD 2H-weapon/shield grip conflict — `Hero.
 * wouldConflictWithGrip` (already checked by `BattleScene.buyGearForHero`)
 * stays the single source of truth for that rejection, exactly as it is
 * for a single-slot purchase today; this only decides WHICH slot(s) to
 * even attempt.
 */
export type HandsPlacementDecision =
  | { kind: "autoPlace"; slot: GearSlotId }
  | { kind: "compareAndReplace"; candidateSlots: GearSlotId[] };

export function decideHandsPlacement(
  itemId: string,
  weaponOccupantId: string | null,
  shieldOccupantId: string | null,
): HandsPlacementDecision {
  const candidateSlots: GearSlotId[] = (["weapon", "shield"] as const).filter((slot) =>
    isItemEligibleForSlot(itemId, slot),
  );
  for (const slot of candidateSlots) {
    const occupant = slot === "weapon" ? weaponOccupantId : shieldOccupantId;
    if (!occupant) return { kind: "autoPlace", slot };
  }
  return { kind: "compareAndReplace", candidateSlots };
}

/**
 * D-233 (item 5's extra layer): the Hands tab's own category sub-filter —
 * separate from `decideHandsPlacement` above, which only decides where a
 * PURCHASE lands. This just classifies any weapon/shield-eligible item id
 * for display filtering. A real Shield (`slot: "shield"`, no `weapon`
 * field) is "shield"; a spellcasting focus (`slot: "shield"`, `itemKind:
 * "focus"` — D-232) is its own "focus" category, not lumped in with real
 * shields. Null for anything not eligible for either hand (a potion, a
 * ring, etc.).
 */
export type HandsCategory = "melee" | "ranged" | "focus" | "shield";

export function handsCategoryOf(itemId: string): HandsCategory | null {
  const def = getEquipmentDefinition(itemId);
  if (def.slot === "weapon" && def.weapon) return def.weapon.kind;
  if (def.slot === "shield") return def.itemKind === "focus" ? "focus" : "shield";
  return null;
}

/** D-233: 1H/2H grip, off `isTwoHandedWeapon` — null for a non-weapon (a real Shield/focus has no grip of its own). */
export type WeaponGrip = "oneHanded" | "twoHanded";

export function weaponGripOf(itemId: string): WeaponGrip | null {
  const def = getEquipmentDefinition(itemId);
  if (def.slot !== "weapon" || !def.weapon) return null;
  return isTwoHandedWeapon(itemId) ? "twoHanded" : "oneHanded";
}

/** D-233: the one place "magic" is defined for filtering/display purposes — anything above Common. */
export function isMagicItem(rarity: EquipmentRarity): boolean {
  return rarity !== "common";
}

export interface CatalogFilters {
  rarity: EquipmentRarity | "all";
  magicOnly: boolean;
  /** Hands tab only — callers on every other tab must pass "all". */
  handsCategory: HandsCategory | "all";
  /** Hands tab only — callers on every other tab must pass "all". */
  weaponCategory: WeaponCategory | "all";
  /** Hands tab only — callers on every other tab must pass "all". */
  grip: WeaponGrip | "all";
  /**
   * D-235 (item 7): non-null hides any Hands-tab item this class isn't
   * proficient with — Hands tab only, same "off unless it's the Hands tab"
   * pattern as `handsCategory`/`weaponCategory`/`grip` above, so
   * `isProficientWithHandsItem` (which assumes a weapon/shield/equipment
   * id) is never invoked on a potion id from a non-Hands tab.
   */
  proficiencyClassId: string | null;
}

/**
 * D-233: the Armory catalog's full filter pass, applied on top of the
 * existing slot-eligibility filter (`eligibleIds` in `GearShopScene
 * .buildCatalog`) and BEFORE its occupant-pinning step, so an already-
 * equipped item that a filter would hide still gets pinned back in as the
 * "Equipped"/"Carried" row (same guarantee slot-eligibility already gives).
 * `getRarity` is injected rather than assumed, since the catalog mixes
 * equipment ids (`getEquipmentDefinition`) and potion ids (a separate
 * registry) — every equipment-assuming check here (`handsCategoryOf`/
 * `weaponGripOf`/D-235's `isProficientWithHandsItem`) is only ever invoked
 * when its filter is off "all"/null (i.e. only on the Hands tab, whose
 * eligible ids are never potions), so a potion id never reaches them.
 */
export function applyCatalogFilters(
  itemIds: string[],
  getRarity: (id: string) => EquipmentRarity,
  filters: CatalogFilters,
): string[] {
  return itemIds.filter((id) => {
    const rarity = getRarity(id);
    if (filters.rarity !== "all" && rarity !== filters.rarity) return false;
    if (filters.magicOnly && !isMagicItem(rarity)) return false;
    if (filters.handsCategory !== "all" && handsCategoryOf(id) !== filters.handsCategory) return false;
    if (filters.weaponCategory !== "all" && getEquipmentDefinition(id).weapon?.category !== filters.weaponCategory) return false;
    if (filters.grip !== "all" && weaponGripOf(id) !== filters.grip) return false;
    if (filters.proficiencyClassId && !isProficientWithHandsItem(filters.proficiencyClassId, id)) return false;
    return true;
  });
}
