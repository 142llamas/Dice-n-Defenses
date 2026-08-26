import { COMPANIONS, type CompanionDefinition } from "../data/companions";
import { isCompanionLost, isCompanionRecruited, type CompanionRosterState } from "./CompanionRosterSystem";

/**
 * UnlockMissionSystem — Kevin's own rule (KI-098 item 13, following D-186):
 * a battle that would recruit a new companion must actually include that
 * companion in the fighting party, not just award them silently on victory.
 * Concretely, per Kevin's own description: the party for such a battle is
 * the player's own PC (always slot 1, unaffected by any of this) plus the
 * companion being unlocked (forced in, can't be removed) plus exactly TWO
 * more slots freely chosen from anyone already recruited — effectively a
 * 3-hero squad (not 4) for this one battle, since one seat always belongs
 * to the newcomer.
 *
 * Pure and storage-agnostic, same pattern as `CompanionRosterSystem`/
 * `CompanionSeedSystem` — scenes (`CampaignSelectScene`,
 * `CompanionRosterScene`, the new `UnlockMissionPartyScene`) call these to
 * decide routing and default selections; none of the actual recruit-on-
 * victory logic changes (`BattleScene.maybeUnlockHomeRegionCompanion`/
 * `maybeUnlockSideMissionCompanion` are unaffected by how the party for
 * that battle was assembled).
 */

/** At most this many companions fill the two free slots alongside the PC and the unlock target. */
export const UNLOCK_MISSION_FLEX_SLOTS = 2;

/**
 * True "unlock mission" resolution: given a campaign id and chapter index,
 * returns the companion that battle would recruit — or `undefined` if this
 * campaign/chapter isn't an unlock mission at all (a normal region chapter,
 * the Prologue, Free Play, Co-op, a replayed Pool B Chapter 1 after that
 * companion is already recruited, or a Pool A side mission for an already-
 * recruited/lost companion).
 *
 * - **Pool A** (a `sideMissionId` match): always chapter-index-agnostic
 *   (every side mission is flat) — unlocks unless already recruited or lost.
 * - **Pool B** (a `homeRegionId` match): only Chapter 1 unlocks anyone —
 *   Chapters 2-4 of the same region are never unlock missions, even before
 *   the region's own companion is recruited (that can only happen via Ch1).
 */
export function resolveUnlockMissionCompanion(
  campaignId: string,
  chapterIndex: number,
  roster: CompanionRosterState,
): CompanionDefinition | undefined {
  const bySideMission = COMPANIONS.find((c) => c.sideMissionId === campaignId);
  if (bySideMission) {
    return isCompanionRecruited(roster, bySideMission.id) || isCompanionLost(roster, bySideMission.id)
      ? undefined
      : bySideMission;
  }
  if (chapterIndex !== 0) return undefined;
  const byRegion = COMPANIONS.find((c) => c.homeRegionId === campaignId);
  if (!byRegion) return undefined;
  return isCompanionRecruited(roster, byRegion.id) || isCompanionLost(roster, byRegion.id) ? undefined : byRegion;
}

/** Every other companion currently recruited (active or benched) and not lost — eligible to fill one of the two free party slots alongside the PC and the unlock target. */
export function eligibleFlexCompanions(roster: CompanionRosterState, targetCompanionId: string): string[] {
  return COMPANIONS.filter(
    (c) => c.id !== targetCompanionId && isCompanionRecruited(roster, c.id) && !isCompanionLost(roster, c.id),
  ).map((c) => c.id);
}

/**
 * Default picks for the two free slots. Prefers the CURRENT active roster,
 * in slot order — whoever's active right now is, by definition, the party
 * the player has most recently been fighting with — falling back to any
 * other eligible (benched) companion if active alone doesn't reach two
 * (only possible very early, before enough companions are recruited).
 */
export function defaultFlexPicks(roster: CompanionRosterState, targetCompanionId: string): string[] {
  const picks = roster.activeIds.filter((id) => id !== targetCompanionId);
  for (const id of eligibleFlexCompanions(roster, targetCompanionId)) {
    if (picks.length >= UNLOCK_MISSION_FLEX_SLOTS) break;
    if (!picks.includes(id)) picks.push(id);
  }
  return picks.slice(0, UNLOCK_MISSION_FLEX_SLOTS);
}
