import Phaser from "phaser";
import { CAMPAIGN_PROGRESS_STORAGE_KEY, COMPANION_ROSTER_STORAGE_KEY, WORLD_FLAG_STORAGE_KEY } from "../config";
import {
  CAMPAIGNS,
  PROLOGUE_CAMPAIGN_ID,
  NAMELESS_THRONE_CAMPAIGN_ID,
  REGION_CAMPAIGN_IDS,
  getChapter,
  isChapteredCampaign,
  totalChapters,
  type CampaignDefinition,
} from "../data/campaigns";
import { getEnemyDefinition } from "../data/enemies";
import {
  loadCampaignProgress,
  saveCampaignProgress,
  isCampaignCompleted,
  areCampaignsCompleted,
  getHighestCompletedChapter,
  DEFAULT_CAMPAIGN_PROGRESS,
  type CampaignProgress,
} from "../systems/CampaignProgressSystem";
import {
  loadCompanionRoster,
  saveCompanionRoster,
  DEFAULT_COMPANION_ROSTER_STATE,
} from "../systems/CompanionRosterSystem";
import { saveWorldFlags, DEFAULT_WORLD_FLAG_STATE } from "../systems/WorldFlagSystem";
import { seedStartingCompanions } from "../systems/CompanionSeedSystem";
import { resolveUnlockMissionCompanion } from "../systems/UnlockMissionSystem";
import { RandomService } from "../systems/RandomService";
import { DIFFICULTY_IDS, getDifficultyDefinition, difficultyChoiceDescription, type DifficultyId } from "../data/difficulty";
import {
  getViewport,
  onViewportResize,
  openChoiceList,
  createOrnateButton,
  drawScreenBackdrop,
  FONT_DISPLAY,
  FONT_BODY,
  type OrnateButtonHandle,
} from "./uiTheme";

/**
 * CampaignSelectScene — Phase 11.8 (D-071): lists the boss-themed campaigns
 * assembled from 11.6's roster and 11.7's maps, letting the player pick one
 * before building a party for it.
 *
 * Modeled on `BestiaryScene`'s visual conventions (title, Back button, the
 * shared `uiTheme.ts` ornate/parchment button style) so it reads as part of
 * the same game rather than a bolted-on screen. Unlike the Bestiary, every campaign
 * here is always fully visible (no unlock-on-encounter gating) — only the
 * "completed" tag depends on stored progress.
 *
 * Picking a campaign does NOT jump straight to `BattleScene`: it hands off
 * to the existing `CharacterCreationScene` with `{ campaignId }` in its init
 * data, so the player still builds/picks a party for that campaign exactly
 * like the classic "Create Party" flow — this scene reuses that party
 * builder entirely rather than inventing a separate hero-picking UI.
 */
export class CampaignSelectScene extends Phaser.Scene {
  private layoutRoot?: Phaser.GameObjects.Container;
  /** Party Creation Overhaul Plan 3.5: this campaign run's difficulty, chosen here now instead of in Character Creation. */
  private selectedDifficultyId: DifficultyId = "normal";
  /** D-16x-style shared full-screen list-picker overlay (`openChoiceList`). */
  private choiceOverlay: Phaser.GameObjects.GameObject[] = [];
  /** Plan 3 (new, additive): "Reset Campaign Progress" needs a real button reference to flip its label for the two-click confirm. */
  private resetButton?: OrnateButtonHandle;
  private resetArmed = false;
  private resetArmTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("CampaignSelectScene");
  }

  create(): void {
    drawScreenBackdrop(this);
    // KI-098 item 13 (companion roster, Phase 1): the earliest real "entering
    // Campaign mode" choke point — seeds a brand-new playthrough's random
    // starting trio before the player can reach the Companions screen or
    // Character Creation's own companion prefill (both would otherwise see
    // an empty roster). No-ops instantly on every later visit.
    const roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
    const seeded = seedStartingCompanions(roster, RandomService.seeded());
    if (seeded !== roster) saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, seeded);
    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Campaigns visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
      this.resetArmTimer?.remove();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds this scene's whole layout against the current viewport,
  // safe to call repeatedly since it destroys its own prior output first.
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    this.layoutRoot = this.add.container(0, 0);
    const { width } = getViewport(this);

    this.layoutRoot.add(
      this.add
        .text(width / 2, 40, "Campaigns", {
          fontFamily: FONT_DISPLAY,
          fontSize: "36px",
          color: "#f0dfa8",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );

    const back = createOrnateButton(this, 110, 40, 160, 44, "Back (Esc)", () => this.leave(), { variant: "tool" });
    this.layoutRoot.add(back.container);

    const companions = createOrnateButton(
      this,
      width - 110,
      40,
      180,
      44,
      "Companions",
      // Party Creation Overhaul Plan 2.3: forwards the currently-selected
      // difficulty so "Unequip All Benched Heroes" can compute each
      // companion's actual currently-equipped kit
      // (`companionStartingGearForDifficulty`) rather than assuming one.
      () => this.scene.start("CompanionRosterScene", { difficultyId: this.selectedDifficultyId }),
      { variant: "tool" },
    );
    this.layoutRoot.add(companions.container);

    this.layoutRoot.add(
      this.add
        .text(
          width / 2,
          90,
          "Pick a boss-themed campaign, then build a party for it. Each campaign has its own map and enemy lineup.",
          {
            fontFamily: FONT_BODY,
            fontSize: "15px",
            color: "#a89058",
            fontStyle: "italic",
          },
        )
        .setOrigin(0.5),
    );

    this.buildControlRow(width);
    this.buildCampaignCards(width);
  }

  /**
   * Party Creation Overhaul Plan 3.5/Plan 3 (new): a compact control row
   * between the intro text and the campaign card list — this campaign run's
   * Difficulty (moved here from Character Creation, which used to be the
   * only place it could be set, with no `campaignId` guard at all) on the
   * left, and the new "Reset Campaign Progress" clean-slate action on the
   * right.
   */
  private buildControlRow(width: number): void {
    const y = 136;

    const difficultyHandle = createOrnateButton(
      this,
      width / 2 - 170,
      y,
      300,
      36,
      `Difficulty: ${getDifficultyDefinition(this.selectedDifficultyId).name}`,
      () => {
        openChoiceList(
          this,
          this.choiceOverlay,
          "Choose Difficulty",
          DIFFICULTY_IDS.map((id) => ({
            label: getDifficultyDefinition(id).name,
            desc: difficultyChoiceDescription(id),
            highlighted: id === this.selectedDifficultyId,
            onPick: () => (this.selectedDifficultyId = id),
          })),
          () => {
            difficultyHandle.setLabel(`Difficulty: ${getDifficultyDefinition(this.selectedDifficultyId).name}`);
          },
        );
      },
      { variant: "secondary", fontSize: 14 },
    );
    this.layoutRoot?.add(difficultyHandle.container);

    this.resetArmed = false;
    this.resetArmTimer?.remove();
    const resetHandle = createOrnateButton(
      this,
      width / 2 + 170,
      y,
      300,
      36,
      "Reset Campaign Progress",
      () => this.onResetButtonClicked(),
      { variant: "secondary", fontSize: 13 },
    );
    this.resetButton = resetHandle;
    this.layoutRoot?.add(resetHandle.container);
  }

  /**
   * Plan 3 (new, additive): wipes the shared companion roster/persisted
   * builds, campaign progress, and world flags back to their defaults — a
   * real "start a brand-new playthrough" option now that all three stay one
   * shared blob across every region (see D-NNN's Track A writeup). Explicitly
   * does NOT touch `SaveSystem`'s Free Play save slots — unrelated state,
   * same boundary D-194 already established. Two-click confirm: the first
   * click just arms it (label flips, reverts after a few seconds if
   * unconfirmed); the second click within that window actually resets.
   */
  private onResetButtonClicked(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetButton?.setLabel("Click again to confirm — wipes ALL campaign progress");
      this.resetArmTimer?.remove();
      this.resetArmTimer = this.time.delayedCall(4000, () => {
        this.resetArmed = false;
        this.resetButton?.setLabel("Reset Campaign Progress");
      });
      return;
    }
    this.resetArmed = false;
    this.resetArmTimer?.remove();
    saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, DEFAULT_COMPANION_ROSTER_STATE);
    saveCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY, DEFAULT_CAMPAIGN_PROGRESS);
    saveWorldFlags(window.localStorage, WORLD_FLAG_STORAGE_KEY, DEFAULT_WORLD_FLAG_STATE);
    this.rebuildLayout();
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  /**
   * One clickable card per campaign, stacked vertically below the intro
   * text. D-184: the 6 story regions now stay locked (dimmed, not
   * interactive) until The Proving Ground is cleared once — same visual
   * language as `FreePlayScene`'s existing "Complete X to unlock" locked
   * options, reused rather than reinvented. `cardHeight`/`gap` shrank
   * slightly from the original 120/20 to fit 7 cards on screen with real
   * margin instead of the 7th card's bottom landing on the viewport edge.
   */
  private buildCampaignCards(width: number): void {
    const progress = loadCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY);
    const prologueCleared = isCampaignCompleted(progress, PROLOGUE_CAMPAIGN_ID);
    const allRegionsCleared = areCampaignsCompleted(progress, REGION_CAMPAIGN_IDS);

    const cardWidth = width - 160;
    const cardHeight = 104;
    const gap = 16;
    // Party Creation Overhaul Plan 3.5/Plan 3: 172 -> 202, room for the new
    // Difficulty/Reset control row (`buildControlRow`) above the card list.
    const startY = 202;

    CAMPAIGNS.forEach((campaign, i) => {
      const y = startY + i * (cardHeight + gap);
      const completed = isCampaignCompleted(progress, campaign.id);
      const locked =
        campaign.id === PROLOGUE_CAMPAIGN_ID
          ? false
          : campaign.id === NAMELESS_THRONE_CAMPAIGN_ID
            ? !allRegionsCleared
            : !prologueCleared;
      const nextChapterIndex = this.nextChapterIndexFor(campaign, progress);

      // Whole card is one ornate button (a wood/bronze plaque) — its own
      // built-in label is left blank and the card's real title/description/
      // boss-line text is added into its container afterward, positioned
      // relative to the container's own center (same left-inset the plain
      // rectangle version used, just container-local now). `setDisabled`
      // reproduces the old locked-card dimming + non-interactivity;
      // `setSelected` on a completed campaign reproduces the old
      // green-tinted stroke as a gilt highlighted border instead.
      const cardHandle = createOrnateButton(
        this,
        width / 2,
        y,
        cardWidth,
        cardHeight,
        "",
        () => this.selectCampaign(campaign, nextChapterIndex),
        { variant: "secondary", disabled: locked },
      );
      if (completed) cardHandle.setSelected(true);

      const leftInset = -cardWidth / 2 + 20;
      const title = this.add
        .text(leftInset, -cardHeight / 2 + 16, this.cardTitle(campaign, completed, locked), {
          fontFamily: FONT_DISPLAY,
          fontSize: "20px",
          color: locked ? "#7a6a4a" : "#f0e6c8",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      const description = this.add
        .text(leftInset, 0, campaign.description, {
          fontFamily: FONT_BODY,
          fontSize: "13px",
          color: locked ? "#5a4a34" : "#c8b898",
          wordWrap: { width: cardWidth - 60 },
        })
        .setOrigin(0, 0.5);

      // Locked cards show the unlock hint in place of the boss/wave line
      // (also avoids spoiling a region's next boss while it's still locked).
      const lockedHint =
        campaign.id === NAMELESS_THRONE_CAMPAIGN_ID
          ? "Complete all 6 regions to unlock"
          : "Complete The Proving Ground to unlock";
      const bossLine = this.add
        .text(leftInset, cardHeight / 2 - 18, locked ? lockedHint : this.bossLineFor(campaign, nextChapterIndex), {
          fontFamily: locked ? FONT_BODY : "monospace",
          fontSize: "13px",
          color: locked ? "#a06a4a" : "#c8a458",
          fontStyle: locked ? "italic" : "normal",
        })
        .setOrigin(0, 0.5);

      cardHandle.container.add([title, description, bossLine]);
      this.layoutRoot?.add(cardHandle.container);
    });
  }

  private cardTitle(campaign: CampaignDefinition, completed: boolean, locked: boolean): string {
    if (locked) return `${campaign.name}   [Locked]`;
    return completed ? `${campaign.name}   [Completed]` : campaign.name;
  }

  /**
   * D-177: the next unplayed chapter for a chaptered campaign — clamped to
   * the finale once every chapter is completed, so replaying it stays
   * possible rather than the index running off the end. Always 0 for a
   * flat (non-chaptered) campaign.
   */
  private nextChapterIndexFor(campaign: CampaignDefinition, progress: CampaignProgress): number {
    if (!isChapteredCampaign(campaign)) return 0;
    return Math.min(getHighestCompletedChapter(progress, campaign.id) + 1, totalChapters(campaign) - 1);
  }

  /**
   * D-177: for a chaptered campaign, describes the UPCOMING chapter (its own
   * boss if it has one at this point in the region, else the region's
   * overall boss as flavor) rather than always naming the region's finale
   * boss up front — avoids spoiling the finale before a player has even
   * started Chapter 1.
   */
  private bossLineFor(campaign: CampaignDefinition, chapterIndex: number): string {
    if (!isChapteredCampaign(campaign)) {
      const boss = getEnemyDefinition(campaign.bossEnemyId);
      return `Boss: ${boss.name}  ·  ${campaign.waves.length} waves`;
    }
    const chapter = getChapter(campaign, chapterIndex);
    const boss = getEnemyDefinition(chapter.bossEnemyId ?? campaign.bossEnemyId);
    return `Chapter ${chapterIndex + 1} of ${totalChapters(campaign)}  ·  Boss: ${boss.name}  ·  ${chapter.waves.length} waves`;
  }

  /**
   * D-18x (KI-098 item 13, "unlock mission must include them"): a region's
   * own Chapter 1, played before that region's Pool B companion is
   * recruited, is an unlock mission — route through `UnlockMissionPartyScene`
   * first so the player locks that companion (and 2 of their own choosing)
   * into the party before building it. Every other case (a later chapter,
   * a Chapter 1 replay after the companion's already recruited, or that
   * companion having been permanently lost) goes straight to Character
   * Creation exactly as before.
   */
  private selectCampaign(campaign: CampaignDefinition, chapterIndex: number): void {
    const roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
    if (resolveUnlockMissionCompanion(campaign.id, chapterIndex, roster)) {
      this.scene.start("UnlockMissionPartyScene", {
        campaignId: campaign.id,
        chapterIndex,
        difficultyId: this.selectedDifficultyId,
      });
      return;
    }
    this.scene.start("CharacterCreationScene", {
      campaignId: campaign.id,
      chapterIndex,
      difficultyId: this.selectedDifficultyId,
    });
  }
}
