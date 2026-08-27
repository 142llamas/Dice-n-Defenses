import Phaser from "phaser";
import { COMPANION_ROSTER_STORAGE_KEY } from "../config";
import { getCompanionDefinition, type CompanionDefinition } from "../data/companions";
import { getClassDefinition } from "../data/classes";
import { loadCompanionRoster, saveCompanionRoster, type CompanionRosterState } from "../systems/CompanionRosterSystem";
import { seedStartingCompanions } from "../systems/CompanionSeedSystem";
import { RandomService } from "../systems/RandomService";
import {
  resolveUnlockMissionCompanion,
  eligibleFlexCompanions,
  defaultFlexPicks,
  UNLOCK_MISSION_FLEX_SLOTS,
} from "../systems/UnlockMissionSystem";
import { getViewport, onViewportResize, openChoiceList } from "./uiTheme";
import type { DifficultyId } from "../data/difficulty";

/**
 * UnlockMissionPartyScene — Kevin's own rule (KI-098 item 13, following
 * D-186): a battle that would recruit a new companion must include that
 * companion in the fighting party for the battle itself, not just award
 * them silently afterward. Reached instead of jumping straight from
 * `CampaignSelectScene` (a Pool B region's own Chapter 1) or
 * `CompanionRosterScene` (a locked Pool A card) to `CharacterCreationScene`
 * — this screen locks in the PC's own slot (untouched, still built on the
 * next screen) and the companion being unlocked, and lets the player freely
 * choose the other two of the four party slots from anyone already
 * recruited. Confirming hands off to `CharacterCreationScene` with
 * `requiredCompanionIds` set, which fills slots 2-4 from exactly those
 * three ids instead of the normal "3 active roster" auto-fill.
 */
export class UnlockMissionPartyScene extends Phaser.Scene {
  private layoutRoot?: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private campaignId = "";
  private chapterIndex?: number;
  /** Party Creation Overhaul Plan 3.5: forwarded unchanged from `CampaignSelectScene` into `CharacterCreationScene`. */
  private difficultyId?: DifficultyId;
  private roster: CompanionRosterState = { activeIds: [], benchedIds: [], lostIds: [] };
  private target?: CompanionDefinition;
  private flexIds: (string | undefined)[] = new Array(UNLOCK_MISSION_FLEX_SLOTS).fill(undefined);

  constructor() {
    super("UnlockMissionPartyScene");
  }

  init(data?: { campaignId?: string; chapterIndex?: number; difficultyId?: DifficultyId }): void {
    this.campaignId = data?.campaignId ?? "";
    this.chapterIndex = data?.chapterIndex;
    this.difficultyId = data?.difficultyId;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0e0e14");

    // Same defensive re-seed every companion-roster-reading scene performs
    // (CampaignSelectScene/CharacterCreationScene/CompanionRosterScene) —
    // idempotent, guards against reaching this scene by an unusual path.
    let roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
    const seeded = seedStartingCompanions(roster, RandomService.seeded());
    if (seeded !== roster) {
      roster = seeded;
      saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, roster);
    }
    this.roster = roster;
    this.target = resolveUnlockMissionCompanion(this.campaignId, this.chapterIndex ?? 0, this.roster);

    // Callers only ever route here for a genuine unlock mission — but never
    // strand the player on a broken screen if that assumption somehow fails
    // (a stale link, a corrupted save). Falls back to the normal flow.
    if (!this.target) {
      this.scene.start("CharacterCreationScene", {
        campaignId: this.campaignId,
        chapterIndex: this.chapterIndex,
        difficultyId: this.difficultyId,
      });
      return;
    }
    this.flexIds = defaultFlexPicks(this.roster, this.target.id);

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

  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    this.layoutRoot = this.add.container(0, 0);
    if (!this.target) return;
    const { width } = getViewport(this);

    this.layoutRoot.add(
      this.add
        .text(width / 2, 40, "Prepare the Mission", {
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
          92,
          `Winning this battle recruits ${this.target.name} — they'll fight alongside you for it. Your own hero and ${this.target.name} are locked into this party; choose your other two from anyone already recruited.`,
          { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#8a8aa0", wordWrap: { width: width - 200 }, align: "center" },
        )
        .setOrigin(0.5),
    );

    this.buildSlotCards(width);
    this.buildContinueButton(width);
  }

  private buildSlotCards(width: number): void {
    if (!this.target) return;
    const cardWidth = 260;
    const cardHeight = 180;
    const gap = 24;
    const cols = 4;
    const startX = (width - (cols * cardWidth + (cols - 1) * gap)) / 2 + cardWidth / 2;
    const y = 260;

    const pcCard = this.buildCard(startX, y, cardWidth, cardHeight, {
      title: "Your Hero",
      subtitle: "Built on the next screen",
      body: "Always slot 1 — unaffected by this screen.",
      color: 0x6a6a8a,
    });
    this.layoutRoot?.add(pcCard);

    const targetCard = this.buildCard(startX + (cardWidth + gap), y, cardWidth, cardHeight, {
      title: this.target.name,
      subtitle: getClassDefinition(this.target.build.classId).name,
      body: "LOCKED — joins this battle and your roster on victory.",
      color: 0x6a8a6a,
    });
    this.layoutRoot?.add(targetCard);

    for (let i = 0; i < UNLOCK_MISSION_FLEX_SLOTS; i++) {
      const flexId = this.flexIds[i];
      const flexCompanion = flexId ? getCompanionDefinition(flexId) : undefined;
      const x = startX + (cardWidth + gap) * (2 + i);
      const card = this.buildCard(x, y, cardWidth, cardHeight, {
        title: flexCompanion?.name ?? "Choose a companion",
        subtitle: flexCompanion ? getClassDefinition(flexCompanion.build.classId).name : "",
        body: "Click to swap.",
        color: flexCompanion ? 0x4a6a8a : 0x8a5a3a,
        onClick: () => this.openFlexPicker(i),
      });
      this.layoutRoot?.add(card);
    }
  }

  private buildCard(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { title: string; subtitle: string; body: string; color: number; onClick?: () => void },
  ): Phaser.GameObjects.GameObject[] {
    const card = this.add.rectangle(x, y, w, h, 0x1a1a26).setStrokeStyle(2, opts.color);
    if (opts.onClick) {
      card.setInteractive({ useHandCursor: true });
      card.on("pointerover", () => card.setFillStyle(0x22222e));
      card.on("pointerout", () => card.setFillStyle(0x1a1a26));
      card.on("pointerdown", opts.onClick);
    }
    const title = this.add
      .text(x, y - h / 2 + 24, opts.title, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "17px",
        color: "#e8e8f0",
        fontStyle: "bold",
        wordWrap: { width: w - 24 },
        align: "center",
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(x, y - h / 2 + 54, opts.subtitle, { fontFamily: "system-ui, Arial, sans-serif", fontSize: "13px", color: "#a0a0b0" })
      .setOrigin(0.5);
    const body = this.add
      .text(x, y + 4, opts.body, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "11px",
        color: "#7a7a8a",
        wordWrap: { width: w - 24 },
        align: "center",
      })
      .setOrigin(0.5, 0);
    return [card, title, subtitle, body];
  }

  private openFlexPicker(slotIndex: number): void {
    if (!this.target) return;
    const otherSlotIds = this.flexIds.filter((_, i) => i !== slotIndex);
    const options = eligibleFlexCompanions(this.roster, this.target.id)
      .filter((id) => !otherSlotIds.includes(id))
      .map((id) => {
        const companion = getCompanionDefinition(id);
        return {
          label: `${companion.name} (${getClassDefinition(companion.build.classId).name})`,
          onPick: () => {
            this.flexIds[slotIndex] = id;
            this.rebuildLayout();
          },
        };
      });
    openChoiceList(this, this.overlay, "Choose a companion", options);
  }

  private buildContinueButton(width: number): void {
    if (!this.target) return;
    const target = this.target;
    const ready = this.flexIds.every((id) => !!id);
    const button = this.buildButton(
      width / 2,
      430,
      280,
      52,
      ready ? "Start Mission" : "Choose your other two companions",
      ready ? 0x3a5a3a : 0x2a2a3a,
      () => {
        if (!ready) return;
        this.scene.start("CharacterCreationScene", {
          campaignId: this.campaignId,
          chapterIndex: this.chapterIndex,
          requiredCompanionIds: [target.id, ...(this.flexIds as string[])],
          difficultyId: this.difficultyId,
        });
      },
    );
    this.layoutRoot?.add([button.rect, button.label]);
  }
}
