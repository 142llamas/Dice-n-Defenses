import type Phaser from "phaser";
import { COMPANION_ROSTER_STORAGE_KEY } from "../config";
import type { CampaignDefinition } from "../data/campaigns";
import type { DifficultyId } from "../data/difficulty";
import { loadCompanionRoster } from "../systems/CompanionRosterSystem";
import { resolveUnlockMissionCompanion } from "../systems/UnlockMissionSystem";

/**
 * D-253 (Batch H, item 12): the routing logic that used to live only inside
 * `CampaignSelectScene.selectCampaign` — extracted so `ChapterSelectScene`
 * can share it without duplicating it (a private scene method can't be
 * called from another scene). Picking a chapter that would recruit a new
 * companion routes through `UnlockMissionPartyScene` first (KI-098 item 13's
 * "unlock mission must include them" rule); every other case goes straight
 * to `RegionBonusChoiceScene`, which itself owns the Armory-vs-Character-
 * Creation ternary (D-248).
 */
export function startMissionFlow(
  scene: Phaser.Scene,
  campaign: CampaignDefinition,
  chapterIndex: number,
  difficultyId: DifficultyId,
): void {
  const roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
  if (resolveUnlockMissionCompanion(campaign.id, chapterIndex, roster)) {
    scene.scene.start("UnlockMissionPartyScene", { campaignId: campaign.id, chapterIndex, difficultyId });
    return;
  }
  scene.scene.start("RegionBonusChoiceScene", { campaignId: campaign.id, chapterIndex, difficultyId });
}
