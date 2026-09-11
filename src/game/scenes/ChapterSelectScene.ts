import Phaser from "phaser";
import { CAMPAIGN_PROGRESS_STORAGE_KEY } from "../config";
import {
  getCampaignDefinition,
  getChapter,
  isChapteredCampaign,
  totalChapters,
  type CampaignDefinition,
  type ChapterDefinition,
} from "../data/campaigns";
import { getEnemyDefinition } from "../data/enemies";
import { loadCampaignProgress, getHighestCompletedChapter, type CampaignProgress } from "../systems/CampaignProgressSystem";
import type { DifficultyId } from "../data/difficulty";
import { startMissionFlow } from "./missionRouting";
import { getViewport, onViewportResize, createOrnateButton, drawScreenBackdrop, FONT_DISPLAY, FONT_BODY } from "./uiTheme";

/**
 * ChapterSelectScene — D-253 (Batch H, item 12): a region card in
 * `CampaignSelectScene` used to jump straight into the next unplayed
 * chapter with no picker at all. This scene sits between that click and the
 * existing `selectCampaign`/`RegionBonusChoiceScene` routing (shared via
 * `missionRouting.ts`'s `startMissionFlow`, since a private scene method
 * can't be called cross-scene): it lists every chapter of the chosen region
 * with a locked/unlocked/completed status, and lets a completed chapter be
 * replayed.
 *
 * Status is derived the same way `CampaignSelectScene.nextChapterIndexFor`
 * already computes "the next playable chapter" — this scene doesn't change
 * that underlying rule (only the NEXT unplayed chapter is ever playable),
 * it just makes it visible and adds replay of anything already cleared.
 *
 * Visual/structural conventions copied from `CampaignSelectScene
 * .buildCampaignCards`: one full-row `createOrnateButton` per chapter,
 * blank built-in label, title/description/status text added into the
 * button's own container afterward.
 */
export class ChapterSelectScene extends Phaser.Scene {
  private layoutRoot?: Phaser.GameObjects.Container;
  private campaignId = "";
  private difficultyId: DifficultyId = "normal";

  constructor() {
    super("ChapterSelectScene");
  }

  init(data: { campaignId: string; difficultyId: DifficultyId }): void {
    this.campaignId = data.campaignId;
    this.difficultyId = data.difficultyId;
  }

  create(): void {
    drawScreenBackdrop(this);

    // Defensive fallback (never strand the player) — the `CampaignSelectScene`
    // card click handler only ever routes here for a chaptered campaign, so
    // this shouldn't be reachable, but matches this codebase's established
    // defensiveness elsewhere (e.g. `UnlockMissionPartyScene`'s own
    // never-strand-the-player fallback).
    const campaign = getCampaignDefinition(this.campaignId);
    if (!isChapteredCampaign(campaign)) {
      startMissionFlow(this, campaign, 0, this.difficultyId);
      return;
    }

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    this.layoutRoot = this.add.container(0, 0);
    const { width } = getViewport(this);
    const campaign = getCampaignDefinition(this.campaignId);

    this.layoutRoot.add(
      this.add
        .text(width / 2, 40, `${campaign.name} — Select a Chapter`, {
          fontFamily: FONT_DISPLAY,
          fontSize: "32px",
          color: "#f0dfa8",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );

    const back = createOrnateButton(this, 110, 40, 160, 44, "Back (Esc)", () => this.leave(), { variant: "tool" });
    this.layoutRoot.add(back.container);

    this.layoutRoot.add(
      this.add
        .text(width / 2, 90, "Pick which chapter to play. Completed chapters can be replayed any time.", {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: "#a89058",
          fontStyle: "italic",
        })
        .setOrigin(0.5),
    );

    this.buildChapterCards(width, campaign);
  }

  private buildChapterCards(width: number, campaign: CampaignDefinition): void {
    const progress = loadCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY);
    const cardWidth = width - 160;
    const cardHeight = 104;
    const gap = 16;
    const startY = 172;
    const chapterCount = totalChapters(campaign);

    for (let chapterIndex = 0; chapterIndex < chapterCount; chapterIndex++) {
      const chapter = getChapter(campaign, chapterIndex);
      const status = this.statusOf(campaign.id, chapterIndex, progress);
      const locked = status === "locked";
      const y = startY + chapterIndex * (cardHeight + gap);

      const cardHandle = createOrnateButton(
        this,
        width / 2,
        y,
        cardWidth,
        cardHeight,
        "",
        () => startMissionFlow(this, campaign, chapterIndex, this.difficultyId),
        { variant: "secondary", disabled: locked },
      );
      if (status === "completed") cardHandle.setSelected(true);

      const leftInset = -cardWidth / 2 + 20;
      const title = this.add
        .text(leftInset, -cardHeight / 2 + 16, this.cardTitle(chapter.name, status), {
          fontFamily: FONT_DISPLAY,
          fontSize: "20px",
          color: locked ? "#7a6a4a" : "#f0e6c8",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      // A locked chapter's card deliberately withholds its intro/boss line —
      // avoids spoiling a chapter the player can't reach yet, same
      // convention as `CampaignSelectScene`'s own locked-region cards.
      const description = this.add
        .text(leftInset, 0, locked ? "Not yet reached." : (chapter.introText ?? ""), {
          fontFamily: FONT_BODY,
          fontSize: "13px",
          color: locked ? "#5a4a34" : "#c8b898",
          wordWrap: { width: cardWidth - 60 },
        })
        .setOrigin(0, 0.5);

      const lockedHint = `Complete Chapter ${chapterIndex} to unlock`;
      const bossLine = this.add
        .text(leftInset, cardHeight / 2 - 18, locked ? lockedHint : this.bossLineFor(campaign, chapter, chapterIndex, chapterCount), {
          fontFamily: locked ? FONT_BODY : "monospace",
          fontSize: "13px",
          color: locked ? "#a06a4a" : "#c8a458",
          fontStyle: locked ? "italic" : "normal",
        })
        .setOrigin(0, 0.5);

      cardHandle.container.add([title, description, bossLine]);
      this.layoutRoot?.add(cardHandle.container);
    }
  }

  /**
   * Reproduces `CampaignSelectScene.nextChapterIndexFor`'s own implicit
   * rule (only the next unplayed chapter is playable) as a per-chapter
   * 3-state status instead of a single "next" index — this scene doesn't
   * change what's reachable, only makes it visible and adds replay.
   */
  private statusOf(campaignId: string, chapterIndex: number, progress: CampaignProgress): "locked" | "unlocked" | "completed" {
    const highest = getHighestCompletedChapter(progress, campaignId);
    if (chapterIndex <= highest) return "completed";
    if (chapterIndex === highest + 1) return "unlocked";
    return "locked";
  }

  private cardTitle(chapterName: string, status: "locked" | "unlocked" | "completed"): string {
    if (status === "locked") return `${chapterName}   [Locked]`;
    return status === "completed" ? `${chapterName}   [Completed]` : chapterName;
  }

  private bossLineFor(campaign: CampaignDefinition, chapter: ChapterDefinition, chapterIndex: number, chapterCount: number): string {
    const boss = getEnemyDefinition(chapter.bossEnemyId ?? campaign.bossEnemyId);
    return `Chapter ${chapterIndex + 1} of ${chapterCount}  ·  Boss: ${boss.name}  ·  ${chapter.waves.length} waves`;
  }

  private leave(): void {
    this.scene.start("CampaignSelectScene");
  }
}
