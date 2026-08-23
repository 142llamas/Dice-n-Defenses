import Phaser from "phaser";
import { CAMPAIGN_PROGRESS_STORAGE_KEY } from "../config";
import { CAMPAIGNS, type CampaignDefinition } from "../data/campaigns";
import { getEnemyDefinition } from "../data/enemies";
import { loadCampaignProgress, isCampaignCompleted } from "../systems/CampaignProgressSystem";
import { getViewport, onViewportResize } from "./uiTheme";

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

  constructor() {
    super("CampaignSelectScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0e0e14");
    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Campaigns visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
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

    this.buildCampaignCards(width);
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

  /** One clickable card per campaign, stacked vertically below the intro text. */
  private buildCampaignCards(width: number): void {
    const progress = loadCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY);

    const cardWidth = width - 160;
    const cardHeight = 120;
    const gap = 20;
    const startY = 180;

    CAMPAIGNS.forEach((campaign, i) => {
      const y = startY + i * (cardHeight + gap);
      const completed = isCampaignCompleted(progress, campaign.id);

      const card = this.add
        .rectangle(width / 2, y, cardWidth, cardHeight, 0x1a1a26)
        .setStrokeStyle(1, completed ? 0x6a8a6a : 0x2a2a3a)
        .setInteractive({ useHandCursor: true });
      card.on("pointerover", () => card.setFillStyle(0x22222e));
      card.on("pointerout", () => card.setFillStyle(0x1a1a26));
      card.on("pointerdown", () => this.selectCampaign(campaign));

      const title = this.add
        .text(90, y - cardHeight / 2 + 16, this.cardTitle(campaign, completed), {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "20px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      const description = this.add
        .text(90, y, campaign.description, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: "#a0a0b0",
          wordWrap: { width: cardWidth - 60 },
        })
        .setOrigin(0, 0.5);

      const boss = getEnemyDefinition(campaign.bossEnemyId);
      const bossLine = this.add
        .text(90, y + cardHeight / 2 - 18, `Boss: ${boss.name}  ·  ${campaign.waves.length} waves`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#8aa0c0",
        })
        .setOrigin(0, 0.5);

      this.layoutRoot?.add([card, title, description, bossLine]);
    });
  }

  private cardTitle(campaign: CampaignDefinition, completed: boolean): string {
    return completed ? `${campaign.name}   [Completed]` : campaign.name;
  }

  private selectCampaign(campaign: CampaignDefinition): void {
    this.scene.start("CharacterCreationScene", { campaignId: campaign.id });
  }
}
