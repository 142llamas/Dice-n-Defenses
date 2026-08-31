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
import {
  getViewport,
  onViewportResize,
  openChoiceList,
  drawScreenBackdrop,
  drawParchmentPanel,
  createOrnateButton,
  FONT_DISPLAY,
  FONT_BODY,
} from "./uiTheme";
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
    // D-123 ornate/parchment theme: same recipe every other menu-adjacent
    // screen uses (Main Menu, Compendium, Bestiary, Character Creation) —
    // replaces the old flat `setBackgroundColor("#0e0e14")`. Drawn once here
    // (not inside `rebuildLayout`, which also runs on resize) so it isn't
    // redrawn on top of itself.
    drawScreenBackdrop(this);

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

  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    this.layoutRoot = this.add.container(0, 0);
    if (!this.target) return;
    const { width } = getViewport(this);

    this.layoutRoot.add(
      this.add
        .text(width / 2, 40, "Prepare the Mission", {
          fontFamily: FONT_DISPLAY,
          fontSize: "34px",
          color: "#f0dfa8",
          fontStyle: "bold",
          letterSpacing: 2 as unknown as number,
        })
        .setOrigin(0.5)
        .setShadow(0, 2, "#000000", 6, true, true),
    );

    const back = createOrnateButton(this, 110, 40, 160, 44, "Back (Esc)", () => this.leave(), {
      variant: "tool",
      depth: 5,
    });
    this.layoutRoot.add(back.container);

    this.layoutRoot.add(
      this.add
        .text(
          width / 2,
          92,
          `Winning this battle recruits ${this.target.name} — they'll fight alongside you for it. Your own hero and ${this.target.name} are locked into this party; choose your other two from anyone already recruited.`,
          { fontFamily: FONT_BODY, fontSize: "14px", color: "#c8b888", wordWrap: { width: width - 200 }, align: "center" },
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

    const pcCard = this.buildInfoCard(startX, y, cardWidth, cardHeight, {
      title: "Your Hero",
      subtitle: "Built on the next screen",
      body: "Always slot 1 — unaffected by this screen.",
      color: 0x6a6a8a,
    });
    this.layoutRoot?.add(pcCard);

    const targetCard = this.buildInfoCard(startX + (cardWidth + gap), y, cardWidth, cardHeight, {
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
      const card = this.buildFlexCard(x, y, cardWidth, cardHeight, {
        title: flexCompanion?.name ?? "Choose a companion",
        subtitle: flexCompanion ? getClassDefinition(flexCompanion.build.classId).name : "Empty slot",
        body: flexCompanion ? "Click to swap." : "Click to choose.",
        filled: !!flexCompanion,
        onClick: () => this.openFlexPicker(i),
      });
      this.layoutRoot?.add(card);
    }
  }

  /**
   * A non-interactive parchment info card (Your Hero / the locked recruit) —
   * a role-color accent bar along the top preserves the old per-role
   * color-coding (`opts.color`, previously the card's whole stroke color)
   * without breaking the parchment look.
   */
  private buildInfoCard(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { title: string; subtitle: string; body: string; color: number },
  ): Phaser.GameObjects.GameObject[] {
    const panel = drawParchmentPanel(this, x, y, w, h, 2);
    const accent = this.add.graphics().setDepth(3);
    accent.fillStyle(opts.color, 0.9);
    accent.fillRoundedRect(x - (w - 32) / 2, y - h / 2 + 10, w - 32, 6, 3);

    const title = this.add
      .text(x, y - h / 2 + 32, opts.title, {
        fontFamily: FONT_DISPLAY,
        fontSize: "16px",
        color: "#2a1a10",
        fontStyle: "bold",
        wordWrap: { width: w - 24 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(3);
    const subtitle = this.add
      .text(x, y - h / 2 + 60, opts.subtitle, {
        fontFamily: FONT_BODY,
        fontSize: "13px",
        color: "#6a4a2a",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(3);
    const body = this.add
      .text(x, y + 6, opts.body, {
        fontFamily: FONT_BODY,
        fontSize: "12px",
        color: "#6a4a2a",
        wordWrap: { width: w - 24 },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(3);
    return [panel, accent, title, subtitle, body];
  }

  /**
   * A clickable flex-slot card — an ornate button sized to the same card
   * footprint as `buildInfoCard`, with an extra body line and a role-color
   * accent bar (same blue-filled/orange-empty coding the old stroke color
   * used) added into its container. `setSelected` gives the currently-filled
   * slots the theme's gilt "locked in" border so a filled slot still reads
   * clearly distinct from an empty one, matching the flat version's
   * blue-vs-orange contrast.
   */
  private buildFlexCard(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { title: string; subtitle: string; body: string; filled: boolean; onClick: () => void },
  ): Phaser.GameObjects.GameObject {
    const handle = createOrnateButton(this, x, y, w, h, opts.title, opts.onClick, {
      variant: "secondary",
      sublabel: opts.subtitle,
      depth: 2,
    });
    handle.setSelected(opts.filled);

    const accent = this.add.graphics();
    accent.fillStyle(opts.filled ? 0x4a6a8a : 0x8a5a3a, 0.9);
    accent.fillRoundedRect(-(w - 32) / 2, -h / 2 + 10, w - 32, 5, 3);
    handle.container.add(accent);

    const body = this.add
      .text(0, h / 2 - 26, opts.body, {
        fontFamily: FONT_BODY,
        fontSize: "12px",
        color: "#f0e6c8",
        align: "center",
      })
      .setOrigin(0.5);
    handle.container.add(body);

    return handle.container;
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
    const button = createOrnateButton(
      this,
      width / 2,
      430,
      280,
      52,
      ready ? "Start Mission" : "Choose your other two companions",
      () => {
        if (!ready) return;
        this.scene.start("CharacterCreationScene", {
          campaignId: this.campaignId,
          chapterIndex: this.chapterIndex,
          requiredCompanionIds: [target.id, ...(this.flexIds as string[])],
          difficultyId: this.difficultyId,
        });
      },
      { variant: "primary", depth: 5, disabled: !ready },
    );
    this.layoutRoot?.add(button.container);
  }
}
