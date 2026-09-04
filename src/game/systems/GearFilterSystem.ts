import { isItemEligibleForSlot } from "./GearCompareSystem";
import type { GearSlotId } from "../data/equipment";

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
