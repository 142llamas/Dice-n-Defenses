/**
 * PartyInventorySystem — Party Creation Overhaul Plan 2.3: an XCOM2-style
 * shared gear pool between a campaign's active and benched companions.
 *
 * Pure and storage-agnostic, same pattern as `CompanionRosterSystem` itself
 * (which owns the actual `partyInventory` field this module reads/writes
 * through). "Unequip All Benched Heroes" moves a benched companion's
 * current kit into the pool; any active hero can then claim a pooled item
 * during party setup. At Start Battle, claimed entries are simply dropped
 * (the claiming hero's own build already carries the item — see
 * `CharacterCreationScene.buildsFromSlots`); unclaimed entries are ALSO
 * dropped, with no write-back needed, because a companion's effective kit
 * is always a DERIVED view (`visibleGearForOrigin`) that re-includes a slot
 * automatically the moment nothing in the pool still claims it. No item is
 * ever lost or duplicated: it's either equipped on exactly one hero, or
 * sitting in exactly one pool entry, never both.
 */

import type { GearSlotId } from "../data/equipment";
import type { CompanionRosterState, PartyInventoryEntry } from "./CompanionRosterSystem";
import { getPartyInventory, setPartyInventory } from "./CompanionRosterSystem";

/**
 * Move every benched companion's currently-equipped kit into the pool.
 * `fullKitFor(companionId)` supplies that companion's currently-equipped
 * slots (the caller passes `companionStartingGearForDifficulty(baseline,
 * difficultyId)` — this module stays free of any data/difficulty coupling).
 * `nextEntryId()` supplies a fresh synthetic id per pool entry (the caller
 * owns id generation so this function stays pure/deterministic-testable).
 *
 * Idempotent: a (companionId, slot) pair already represented by an
 * unclaimed pool entry is skipped, so calling this twice in a row with the
 * same inputs produces no duplicate entries.
 */
export function unequipAllBenchedGear(
  state: CompanionRosterState,
  benchedIds: string[],
  fullKitFor: (companionId: string) => Partial<Record<GearSlotId, string>>,
  nextEntryId: () => string,
): CompanionRosterState {
  const pool = [...getPartyInventory(state)];
  for (const companionId of benchedIds) {
    const kit = fullKitFor(companionId);
    for (const slotId of Object.keys(kit) as GearSlotId[]) {
      const itemId = kit[slotId];
      if (!itemId) continue;
      const alreadyPooled = pool.some((e) => e.originCompanionId === companionId && e.originSlot === slotId);
      if (alreadyPooled) continue;
      pool.push({ id: nextEntryId(), itemId, originCompanionId: companionId, originSlot: slotId });
    }
  }
  return setPartyInventory(state, pool);
}

/**
 * A companion's kit as it should actually display/apply right now: `fullKit`
 * (whatever the caller's own gear computation — e.g.
 * `companionStartingGearForDifficulty` — produced) with any slot that
 * currently has an UNCLAIMED pool entry crediting `companionId` as origin
 * stripped out. Must be applied to every companion's own gear computation
 * unconditionally (not just while they're benched) — a companion reactivated
 * after their gear was pooled must not show (or let a hero equip) an item
 * that's simultaneously claimable by someone else from the pool. A
 * companion who's never had anything pooled sees no change (no matching
 * entries), so this is safe to always apply.
 */
export function visibleGearForOrigin(
  companionId: string,
  fullKit: Partial<Record<GearSlotId, string>>,
  partyInventory: PartyInventoryEntry[],
): Partial<Record<GearSlotId, string>> {
  const pooledSlots = new Set(partyInventory.filter((e) => e.originCompanionId === companionId).map((e) => e.originSlot));
  if (pooledSlots.size === 0) return fullKit;
  const result: Partial<Record<GearSlotId, string>> = { ...fullKit };
  for (const slot of pooledSlots) delete result[slot];
  return result;
}

/**
 * Start Battle resolution: "mission start" is the one commit point for the
 * ENTIRE pool, not just entries an active hero claimed this session — every
 * entry still present is resolved one way or the other. A claimed entry's
 * item is already baked into the claiming hero's own build elsewhere
 * (`CharacterCreationScene`'s `poolGearIds` override, applied before this is
 * called); an unclaimed entry silently returns to its origin, which needs
 * no write-back of its own since a companion's kit is a derived view
 * (`visibleGearForOrigin`) that re-includes a slot the instant nothing in
 * the pool still claims it. Either way, every entry leaves the pool.
 */
export function resolvePartyInventory(state: CompanionRosterState): CompanionRosterState {
  return setPartyInventory(state, []);
}

/**
 * A permanently-lost companion's still-unclaimed pool entries are deleted
 * outright rather than orphaned — the item's origin fiction disappears with
 * the companion, matching "no item silently duplicated," not "silently
 * un-loseable." Call this alongside the one existing `loseCompanion` call
 * site (`BattleScene`'s Sorrel Thane fate resolution, D-185).
 */
export function dropPoolEntriesForLostCompanion(state: CompanionRosterState, companionId: string): CompanionRosterState {
  return setPartyInventory(
    state,
    getPartyInventory(state).filter((e) => e.originCompanionId !== companionId),
  );
}
