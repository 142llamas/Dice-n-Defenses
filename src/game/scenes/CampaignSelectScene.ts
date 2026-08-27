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
import { getViewport, onViewportResize, openChoiceList } from "./uiTheme";

/**
 * CampaignSelectScene — Phase 11.8 (D-071): lists the boss-themed campaigns
 * assembled from 11.6's roster and 11.7's maps, letting the player pick one
 * before building a party for it.
 *
 * Modeled on `BestiaryScene`'s visual conventions (title, Back button, the
 * same small `buildButton` helper style) so it reads as part of the same
 * game rather than a bolted-on screen. Unlike the Bestiary, every campaign
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
  private resetButton?: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
  private resetArmed = false;
  private resetArmTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("CampaignSelectScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0e0e14");
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
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "36px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );

    const back = this.buildButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());
    this.layoutRoot.add([back.rect, back.label]);

    const companions = this.buildButton(width - 110, 40, 180, 44, "Companions", 0x2a2a3a, () =>
      // Party Creation Overhaul Plan 2.3: forwards the currently-selected
      // difficulty so "Unequip All Benched Heroes" can compute each
      // companion's actual currently-equipped kit
      // (`companionStartingGearForDifficulty`) rather than assuming one.
      this.scene.start("CompanionRosterScene", { difficultyId: this.selectedDifficultyId }),
    );
    this.layoutRoot.add([companions.rect, companions.label]);

    this.layoutRoot.add(
      this.add
        .text(
          width / 2,
          90,
          "Pick a boss-themed campaign, then build a party for it. Each campaign has its own map and enemy lineup.",
          {
            fontFamily: "system-ui, Arial, sans-serif",
            fontSize: "14px",
            color: "#8a8aa0",
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

    const difficultyButton = this.add
      .rectangle(width / 2 - 170, y, 300, 36, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const difficultyLabel = this.add
      .text(width / 2 - 170, y, `Difficulty: ${getDifficultyDefinition(this.selectedDifficultyId).name}`, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#e8e8f0",
      })
      .setOrigin(0.5);
    difficultyButton.on("pointerover", () => difficultyButton.setFillStyle(0x3a3a4a));
    difficultyButton.on("pointerout", () => difficultyButton.setFillStyle(0x2a2a3a));
    difficultyButton.on("pointerdown", () => {
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
          difficultyLabel.setText(`Difficulty: ${getDifficultyDefinition(this.selectedDifficultyId).name}`);
        },
      );
    });
    this.layoutRoot?.add([difficultyButton, difficultyLabel]);

    this.resetArmed = false;
    this.resetArmTimer?.remove();
    const resetRect = this.add
      .rectangle(width / 2 + 170, y, 300, 36, 0x3a2424)
      .setStrokeStyle(1, 0x5a3a3a)
      .setInteractive({ useHandCursor: true });
    const resetLabel = this.add
      .text(width / 2 + 170, y, "Reset Campaign Progress", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#e8b8b8",
      })
      .setOrigin(0.5);
    this.resetButton = { rect: resetRect, label: resetLabel };
    resetRect.on("pointerdown", () => this.onResetButtonClicked());
    this.layoutRoot?.add([resetRect, resetLabel]);
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
      this.resetButton?.label.setText("Click again to confirm — wipes ALL campaign progress");
      this.resetArmTimer?.remove();
      this.resetArmTimer = this.time.delayedCall(4000, () => {
        this.resetArmed = false;
        this.resetButton?.label.setText("Reset Campaign Progress");
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

  /** Small button+label pair, matching BestiaryScene/CompendiumScene's simple rectangle-button style. */
  private buildButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    color: number,
    onClick: () => void,
  ): { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const rect = this.add
      .rectangle(x, y, w, h, color)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, text, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#e8e8f0",
      })
      .setOrigin(0.5);
    rect.on("pointerdown", onClick);
    return { rect, label };
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

      const card = this.add
        .rectangle(width / 2, y, cardWidth, cardHeight, 0x1a1a26)
        .setStrokeStyle(1, completed ? 0x6a8a6a : 0x2a2a3a);
      if (locked) {
        card.setAlpha(0.55);
      } else {
        card.setInteractive({ useHandCursor: true });
        card.on("pointerover", () => card.setFillStyle(0x22222e));
        card.on("pointerout", () => card.setFillStyle(0x1a1a26));
        card.on("pointerdown", () => this.selectCampaign(campaign, nextChapterIndex));
      }

      const title = this.add
        .text(90, y - cardHeight / 2 + 16, this.cardTitle(campaign, completed, locked), {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "20px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5)
        .setAlpha(locked ? 0.55 : 1);

      const description = this.add
        .text(90, y, campaign.description, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: "#a0a0b0",
          wordWrap: { width: cardWidth - 60 },
        })
        .setOrigin(0, 0.5)
        .setAlpha(locked ? 0.55 : 1);

      // Locked cards show the unlock hint in place of the boss/wave line
      // (also avoids spoiling a region's next boss while it's still locked).
      const lockedHint =
        campaign.id === NAMELESS_THRONE_CAMPAIGN_ID
          ? "Complete all 6 regions to unlock"
          : "Complete The Proving Ground to unlock";
      const bossLine = this.add
        .text(
          90,
          y + cardHeight / 2 - 18,
          locked ? lockedHint : this.bossLineFor(campaign, nextChapterIndex),
          {
            fontFamily: locked ? "system-ui, Arial, sans-serif" : "monospace",
            fontSize: "13px",
            color: locked ? "#a06a4a" : "#8aa0c0",
          },
        )
        .setOrigin(0, 0.5);

      this.layoutRoot?.add([card, title, description, bossLine]);
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
