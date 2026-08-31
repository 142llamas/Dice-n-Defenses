import Phaser from "phaser";
import { COMPANION_ROSTER_STORAGE_KEY, COLORS } from "../config";
import { COMPANIONS, getCompanionDefinition, type CompanionDefinition } from "../data/companions";
import { getCampaignDefinition } from "../data/campaigns";
import { getClassDefinition } from "../data/classes";
import { companionStartingGearForDifficulty } from "../data/characterCreation";
import { type DifficultyId } from "../data/difficulty";
import {
  loadCompanionRoster,
  saveCompanionRoster,
  isCompanionActive,
  isCompanionBenched,
  isCompanionLost,
  benchCompanion,
  activateCompanion,
  getPartyInventory,
  type CompanionRosterState,
} from "../systems/CompanionRosterSystem";
import { unequipAllBenchedGear } from "../systems/PartyInventorySystem";
import {
  getViewport,
  onViewportResize,
  openChoiceList,
  createOrnateButton,
  drawScreenBackdrop,
  drawParchmentPanel,
  FONT_DISPLAY,
  FONT_BODY,
  type OrnateButtonHandle,
} from "./uiTheme";

const INK = "#2a1a10";
const INK_MUTED = "#6a4a2a";

/**
 * CompanionRosterScene — KI-098 item 13 (companion roster/recruitment,
 * Phase 1). Reached from `CampaignSelectScene`'s "Companions" button (a
 * plain `scene.start`/back pair, not `CharacterSheetScene`'s heavier
 * launch-over-a-paused-battle pattern — there's no live `Hero` to reflect
 * back here). Shows all 12 companions grouped by status and lets the
 * player freely swap the active 3 with anyone benched, any time outside
 * battle. Every mutation saves immediately.
 *
 * Reskinned to the D-123 ornate/parchment theme this session — a pure
 * presentation pass (`drawScreenBackdrop`, `createOrnateButton`,
 * `drawParchmentPanel`) with zero change to roster state, recruit/activate/
 * bench logic, or the unequip-all confirm timer.
 */
export class CompanionRosterScene extends Phaser.Scene {
  private layoutRoot?: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private roster: CompanionRosterState = { activeIds: [], benchedIds: [], lostIds: [] };
  /**
   * Party Creation Overhaul Plan 2.3: this campaign run's Difficulty,
   * forwarded from `CampaignSelectScene`'s own `selectedDifficultyId`
   * (same plumbing shape as `difficultyId` already forwarded to Character
   * Creation) — needed to compute a benched companion's CURRENTLY-equipped
   * kit via `companionStartingGearForDifficulty` before pooling it, so
   * "Unequip All Benched Heroes" never pools a chest/shield item a stricter
   * difficulty was already trimming away. Defaults to "normal" for any
   * direct navigation path that doesn't pass one.
   */
  private difficultyId: DifficultyId = "normal";
  private unequipArmed = false;
  private unequipArmTimer?: Phaser.Time.TimerEvent;
  private unequipButton?: OrnateButtonHandle;

  constructor() {
    super("CompanionRosterScene");
  }

  init(data: { difficultyId?: DifficultyId }): void {
    this.difficultyId = data.difficultyId ?? "normal";
  }

  create(): void {
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

    drawScreenBackdrop(this);

    this.layoutRoot.add(
      this.add
        .text(width / 2, 42, "Companions", {
          fontFamily: FONT_DISPLAY,
          fontSize: "34px",
          color: "#f0dfa8",
          fontStyle: "bold",
          letterSpacing: 2 as unknown as number,
        })
        .setOrigin(0.5)
        .setShadow(0, 2, "#000000", 6, true, true),
    );

    const back = createOrnateButton(this, 120, 42, 160, 44, "Back (Esc)", () => this.leave(), {
      variant: "tool",
      depth: 5,
    });
    this.layoutRoot.add(back.container);

    this.layoutRoot.add(
      this.add
        .text(
          width / 2,
          88,
          `Active (${this.roster.activeIds.length}/3) fight alongside you now. Click a Benched companion to swap them in, an Active one to bench them, or a locked one offering a side quest to attempt it.`,
          { fontFamily: FONT_BODY, fontSize: "13px", color: "#c8b078", wordWrap: { width: width - 160 } },
        )
        .setOrigin(0.5),
    );

    this.buildPartyInventoryRow(width);
    this.buildCompanionCards(width);
  }

  /**
   * Party Creation Overhaul Plan 2.3: a small control row between the
   * instructions text and the card grid (`buildCompanionCards`'s own
   * `startY=160` leaves the same kind of slack `CampaignSelectScene
   * .buildControlRow` already uses at its own `y=136`) — "Unequip All
   * Benched Heroes" moves every benched companion's current kit into the
   * shared pool, and a small label shows how many items are sitting there.
   * Reskinned to `createOrnateButton` this session (D-123 ornate theme) —
   * the two-click arm-then-confirm STATE lives entirely in
   * `onUnequipAllClicked`/`unequipArmed`, unaffected by the button's visual
   * construction.
   */
  private buildPartyInventoryRow(width: number): void {
    const y = 124;

    this.unequipArmed = false;
    this.unequipArmTimer?.remove();
    this.unequipButton = createOrnateButton(this, width / 2 - 150, y, 300, 34, "Unequip All Benched Heroes", () =>
      this.onUnequipAllClicked(),
      { variant: "tool", fontSize: 13 },
    );
    this.layoutRoot?.add(this.unequipButton.container);

    const itemCount = getPartyInventory(this.roster).length;
    const countLabel = this.add
      .text(width / 2 + 20, y, `Party Inventory: ${itemCount} item${itemCount === 1 ? "" : "s"}`, {
        fontFamily: FONT_BODY,
        fontSize: "13px",
        color: "#c8b078",
      })
      .setOrigin(0, 0.5);
    this.layoutRoot?.add(countLabel);
  }

  /**
   * Party Creation Overhaul Plan 2.3: moves every benched companion's
   * currently-equipped kit into the shared pool — same two-click-confirm
   * pattern as `CampaignSelectScene.onResetButtonClicked` (D-195), since
   * this is a roster-wide bulk action, not something to fire on a single
   * accidental click. Commits (and saves) immediately on confirm — unlike
   * the ephemeral per-hero pool PICKS `CharacterCreationScene` will stage,
   * this isn't scoped to one mission's setup.
   */
  private onUnequipAllClicked(): void {
    if (!this.unequipArmed) {
      this.unequipArmed = true;
      this.unequipButton?.setLabel("Click again to confirm");
      this.unequipArmTimer?.remove();
      this.unequipArmTimer = this.time.delayedCall(4000, () => {
        this.unequipArmed = false;
        this.unequipButton?.setLabel("Unequip All Benched Heroes");
      });
      return;
    }
    this.unequipArmed = false;
    this.unequipArmTimer?.remove();
    let counter = 0;
    const next = unequipAllBenchedGear(
      this.roster,
      this.roster.benchedIds,
      (companionId) =>
        companionStartingGearForDifficulty(getCompanionDefinition(companionId).build.startingGearIds ?? {}, this.difficultyId),
      () => `pool-${Date.now()}-${counter++}`,
    );
    this.save(next);
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

  /**
   * Reskinned to the D-123 ornate theme this session: each card is a
   * `drawParchmentPanel` backing with a status-colored accent border, ink/
   * cream text (`INK`/`INK_MUTED`), and a `createOrnateButton` as the click
   * target — a disabled button for the two non-interactive states (Lost,
   * Locked with no side mission) doubles as that state's visual ("greyed
   * plaque"), matching `createOrnateButton`'s own disabled look elsewhere.
   * All status/eligibility computation (`statusOf`, `canAttemptSideMission`,
   * `clickable`) is unchanged from before the reskin.
   */
  private buildCompanionCards(width: number): void {
    const cardWidth = 270;
    const cardHeight = 170;
    const gapX = 20;
    const gapY = 20;
    const cols = 4;
    const startX = (width - (cols * cardWidth + (cols - 1) * gapX)) / 2 + cardWidth / 2;
    const startY = 160;

    type Status = ReturnType<CompanionRosterScene["statusOf"]>;
    const statusAccentNum: Record<Status, number> = {
      active: 0x2f6a3a,
      benched: 0x2a4a7a,
      lost: 0x6a2a2a,
      locked: COLORS.bronze,
    };
    const statusAccentHex: Record<Status, string> = {
      active: "#2f6a3a",
      benched: "#2a4a7a",
      lost: "#6a2a2a",
      locked: "#6a4a2a",
    };
    const statusCaption: Record<Status, string> = {
      active: "ACTIVE",
      benched: "BENCHED",
      lost: "LOST",
      locked: "LOCKED",
    };
    const sideMissionAccentNum = COLORS.gilt;
    const sideMissionAccentHex = "#8a5a10";

    COMPANIONS.forEach((companion, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY) + cardHeight / 2;
      const cardTop = y - cardHeight / 2;
      const status = this.statusOf(companion.id);
      const canAttemptSideMission = status === "locked" && !!companion.sideMissionId;
      const clickable = status === "active" || status === "benched" || canAttemptSideMission;
      const dimmed = status === "locked" || status === "lost";

      const panel = drawParchmentPanel(this, x, y, cardWidth, cardHeight, 2);

      const accentColorNum = canAttemptSideMission ? sideMissionAccentNum : statusAccentNum[status];
      const accentColorHex = canAttemptSideMission ? sideMissionAccentHex : statusAccentHex[status];
      const accent = this.add.graphics().setDepth(3);
      accent.lineStyle(3, accentColorNum, 1);
      accent.strokeRoundedRect(x - cardWidth / 2, y - cardHeight / 2, cardWidth, cardHeight, 14);

      const name = this.add
        .text(x, cardTop + 20, dimmed ? "???" : companion.name, {
          fontFamily: FONT_BODY,
          fontSize: "17px",
          color: dimmed ? INK_MUTED : INK,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(4);

      const classLine = this.add
        .text(x, cardTop + 42, dimmed ? "" : getClassDefinition(companion.build.classId).name, {
          fontFamily: FONT_BODY,
          fontSize: "13px",
          color: INK_MUTED,
        })
        .setOrigin(0.5)
        .setDepth(4);

      const caption = this.add
        .text(x, cardTop + 60, canAttemptSideMission ? "SIDE QUEST AVAILABLE" : statusCaption[status], {
          fontFamily: FONT_BODY,
          fontSize: "11px",
          color: accentColorHex,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(4);

      const hook = this.add
        .text(x, cardTop + 78, status === "locked" ? this.lockedHint(companion) : companion.hook, {
          fontFamily: FONT_BODY,
          fontSize: "11px",
          color: INK_MUTED,
          wordWrap: { width: cardWidth - 28 },
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setDepth(4);

      if (dimmed) {
        panel.setAlpha(0.7);
        accent.setAlpha(0.7);
        name.setAlpha(0.7);
        classLine.setAlpha(0.7);
        caption.setAlpha(0.7);
        hook.setAlpha(0.7);
      }

      let buttonLabel: string;
      if (status === "active") buttonLabel = "Bench";
      else if (status === "benched") buttonLabel = "Activate";
      else if (canAttemptSideMission) buttonLabel = "Attempt Side Quest";
      else if (status === "lost") buttonLabel = "Lost";
      else buttonLabel = "Locked";

      const button = createOrnateButton(
        this,
        x,
        cardTop + cardHeight - 24,
        cardWidth - 30,
        30,
        buttonLabel,
        () => this.onCardClicked(companion, status),
        { variant: "tool", fontSize: 12, depth: 4, disabled: !clickable },
      );

      this.layoutRoot?.add([panel, accent, name, classLine, caption, hook, button.container]);
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
