import Phaser from "phaser";
import { COMPANION_ROSTER_STORAGE_KEY } from "../config";
import { COMPANIONS, getCompanionDefinition, type CompanionDefinition } from "../data/companions";
import { getCampaignDefinition } from "../data/campaigns";
import { getClassDefinition } from "../data/classes";
import {
  loadCompanionRoster,
  saveCompanionRoster,
  isCompanionActive,
  isCompanionBenched,
  isCompanionLost,
  benchCompanion,
  activateCompanion,
  type CompanionRosterState,
} from "../systems/CompanionRosterSystem";
import { getViewport, onViewportResize, openChoiceList } from "./uiTheme";

/**
 * CompanionRosterScene — KI-098 item 13 (companion roster/recruitment,
 * Phase 1). Reached from `CampaignSelectScene`'s "Companions" button (a
 * plain `scene.start`/back pair, not `CharacterSheetScene`'s heavier
 * launch-over-a-paused-battle pattern — there's no live `Hero` to reflect
 * back here). Shows all 12 companions grouped by status and lets the
 * player freely swap the active 3 with anyone benched, any time outside
 * battle. Every mutation saves immediately.
 */
export class CompanionRosterScene extends Phaser.Scene {
  private layoutRoot?: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private roster: CompanionRosterState = { activeIds: [], benchedIds: [], lostIds: [] };

  constructor() {
    super("CompanionRosterScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0e0e14");
    this.roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  private leave(): void {
    this.scene.start("CampaignSelectScene");
  }

  private save(next: CompanionRosterState): void {
    this.roster = next;
    saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, next);
    this.rebuildLayout();
  }

  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    this.layoutRoot = this.add.container(0, 0);
    const { width } = getViewport(this);

    this.layoutRoot.add(
      this.add
        .text(width / 2, 40, "Companions", {
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
          88,
          `Active (${this.roster.activeIds.length}/3) fight alongside you now. Click a Benched companion to swap them in, an Active one to bench them, or a locked one offering a side quest to attempt it.`,
          { fontFamily: "system-ui, Arial, sans-serif", fontSize: "13px", color: "#8a8aa0", wordWrap: { width: width - 160 } },
        )
        .setOrigin(0.5),
    );

    this.buildCompanionCards(width);
  }

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
      .text(x, y, text, { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#e8e8f0" })
      .setOrigin(0.5);
    rect.on("pointerdown", onClick);
    return { rect, label };
  }

  private statusOf(id: string): "active" | "benched" | "lost" | "locked" {
    if (isCompanionActive(this.roster, id)) return "active";
    if (isCompanionBenched(this.roster, id)) return "benched";
    if (isCompanionLost(this.roster, id)) return "lost";
    return "locked";
  }

  private lockedHint(companion: CompanionDefinition): string {
    if (companion.sideMissionId) return "Click to attempt this recruit's side quest.";
    return `Unlocks: ${getCampaignDefinition(companion.homeRegionId!).name} Ch. 1`;
  }

  private buildCompanionCards(width: number): void {
    const cardWidth = 270;
    const cardHeight = 130;
    const gapX = 20;
    const gapY = 20;
    const cols = 4;
    const startX = (width - (cols * cardWidth + (cols - 1) * gapX)) / 2 + cardWidth / 2;
    const startY = 160;

    const statusColor: Record<ReturnType<CompanionRosterScene["statusOf"]>, number> = {
      active: 0x6a8a6a,
      benched: 0x4a6a8a,
      lost: 0x4a2a2a,
      locked: 0x2a2a3a,
    };
    const statusLabel: Record<ReturnType<CompanionRosterScene["statusOf"]>, string> = {
      active: "ACTIVE",
      benched: "BENCHED — click to activate",
      lost: "LOST",
      locked: "LOCKED",
    };

    COMPANIONS.forEach((companion, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY) + cardHeight / 2;
      const status = this.statusOf(companion.id);
      const canAttemptSideMission = status === "locked" && !!companion.sideMissionId;
      const clickable = status === "active" || status === "benched" || canAttemptSideMission;

      const card = this.add
        .rectangle(x, y, cardWidth, cardHeight, 0x1a1a26)
        .setStrokeStyle(2, statusColor[status]);
      if (clickable) {
        card.setInteractive({ useHandCursor: true });
        card.on("pointerover", () => card.setFillStyle(0x22222e));
        card.on("pointerout", () => card.setFillStyle(0x1a1a26));
        card.on("pointerdown", () => this.onCardClicked(companion, status));
      }

      const dimmed = status === "locked" || status === "lost";
      const name = this.add
        .text(x, y - cardHeight / 2 + 18, dimmed ? "???" : companion.name, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "17px",
          color: dimmed ? "#5a5a68" : "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      const classLine = this.add
        .text(x, y - cardHeight / 2 + 42, dimmed ? "" : getClassDefinition(companion.build.classId).name, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: "#a0a0b0",
        })
        .setOrigin(0.5);

      const hook = this.add
        .text(x, y + 4, status === "locked" ? this.lockedHint(companion) : companion.hook, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "11px",
          color: status === "locked" ? "#8a8aa0" : "#7a7a8a",
          wordWrap: { width: cardWidth - 24 },
          align: "center",
        })
        .setOrigin(0.5, 0);

      const badge = this.add
        .text(x, y + cardHeight / 2 - 14, canAttemptSideMission ? "LOCKED — click for a side quest" : statusLabel[status], {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#c8c8d8",
        })
        .setOrigin(0.5);

      this.layoutRoot?.add([card, name, classLine, hook, badge]);
    });
  }

  /**
   * Active -> bench directly. Benched -> pick which active member to swap
   * out for this one. Locked (Pool A, with a side mission) -> launch it via
   * the same party-builder flow `CampaignSelectScene.selectCampaign` uses.
   * Widened to the full `statusOf` union rather than just "active"/"benched"
   * so this stays a straightforward runtime guard instead of leaning on
   * `clickable`'s own boolean narrowing "lost" out for us.
   */
  private onCardClicked(companion: CompanionDefinition, status: ReturnType<CompanionRosterScene["statusOf"]>): void {
    if (status === "locked") {
      if (!companion.sideMissionId) return;
      // D-18x: side missions are always flat/chapter-agnostic — the "must
      // include them" party-selection screen resolves the target itself.
      this.scene.start("UnlockMissionPartyScene", { campaignId: companion.sideMissionId, chapterIndex: 0 });
      return;
    }
    if (status === "lost") return;
    if (status === "active") {
      this.save(benchCompanion(this.roster, companion.id));
      return;
    }
    const options = this.roster.activeIds.map((activeId) => {
      const activeCompanion = getCompanionDefinition(activeId);
      return {
        label: activeCompanion.name,
        onPick: () => {
          const benched = benchCompanion(this.roster, activeId);
          this.save(activateCompanion(benched, companion.id));
        },
      };
    });
    openChoiceList(this, this.overlay, `Bench whom to activate ${companion.name}?`, options);
  }
}
