import Phaser from "phaser";
import { SAVE_STORAGE_KEY, CAMPAIGN_PROGRESS_STORAGE_KEY } from "../config";
import { getClassDefinition } from "../data/classes";
import { getDifficultyDefinition } from "../data/difficulty";
import { getCampaignDefinition, totalChapters } from "../data/campaigns";
import { loadCampaignProgress, getHighestCompletedChapter } from "../systems/CampaignProgressSystem";
import { deleteSaveSlot, loadSaveFile, saveSaveFile, type SaveSlot } from "../systems/SaveSystem";
import { firebaseReady } from "../cloud/firebaseApp";
import { initAuth, type AuthState } from "../cloud/AuthClient";
import { deleteSlotFromCloud, syncNow } from "../cloud/CloudSaveSync";
import {
  getViewport,
  onViewportResize,
  drawScreenBackdrop,
  drawParchmentPanel,
  createOrnateButton,
  FONT_DISPLAY,
  FONT_BODY,
  type OrnateButtonHandle,
} from "./uiTheme";

/**
 * LoadGameScene — Phase 9 (D-083): lists every locally-saved party build,
 * with a Load and a Delete button per slot.
 *
 * Card layout is copied from `CampaignSelectScene`'s pattern (rather than
 * `BestiaryScene`/`CompendiumScene`'s plain text-block pattern) because each
 * row here needs two independent buttons, which the card shape already
 * supports. `MAX_SAVE_SLOTS` (enforced in `CharacterCreationScene`, not
 * here) keeps every slot on-screen with no scrolling — no scrolling list
 * exists anywhere else in this project either.
 *
 * "Load" hands the slot's saved party straight to `CharacterCreationScene`
 * via `{ loadedSlotId, loadedParty, difficultyId }` — the SAME init-data
 * shape `CampaignSelectScene`/`FreePlayScene` already use to pre-fill that
 * scene, just with different fields (see D-083's scope note: a loaded save
 * feeds the plain party-builder flow only, not a specific campaign/free-play
 * run — those still start from `MainMenuScene`'s own buttons).
 *
 * "Delete" removes a slot immediately — no confirmation dialog exists
 * anywhere in this project today, so this matches that established norm
 * (flagged as a low-priority nit in KNOWN_ISSUES, same tier as KI-033).
 *
 * Phase 1 of the 2026-08-28 playtest batch: accepts an optional
 * `filterMode: "campaign" | "freeplay"` from `ModeEntryScene`'s Load
 * Campaign/Load Game buttons, showing only slots with (or without) a
 * `campaignId`. Omitted entirely when reached from `PauseMenuScene`'s
 * in-battle "Load Game" button, which still shows every slot exactly as
 * before this change. When a filter is active, "Back" returns to
 * `ModeEntryScene` (preserving the New/Load choice) instead of straight to
 * Main Menu.
 *
 * Phase 10 (D-084) added a "Sync with Cloud" button (only meaningful once
 * signed in with Google — see `MainMenuScene`'s Account control; syncing
 * an anonymous-only session is pointless, nothing else can ever reach that
 * uid) that pulls/merges/pushes via `CloudSaveSync.syncNow`, then restarts
 * this scene to re-render from the merged result — the same
 * `scene.restart()` `deleteSlot` already used. Deleting a slot now also
 * mirrors the delete to the cloud when signed in, so a synced-away slot
 * doesn't reappear on the next sync.
 */
interface LoadGameData {
  filterMode?: "campaign" | "freeplay";
}

export class LoadGameScene extends Phaser.Scene {
  private authState: AuthState = { uid: null, isAnonymous: true, displayName: null };
  private syncButtonHandle?: OrnateButtonHandle;
  private syncStatusLabel?: Phaser.GameObjects.Text;
  private layoutRoot?: Phaser.GameObjects.Container;
  private filterMode?: "campaign" | "freeplay";

  constructor() {
    super("LoadGameScene");
  }

  init(data: LoadGameData): void {
    this.filterMode = data?.filterMode;
  }

  create(): void {
    // D-154: subscribe once per scene lifetime — `rebuildLayout()` (below)
    // recreates the sync button/labels on every resize, so its refresh
    // reads the live `this.authState` field instead of resubscribing.
    if (firebaseReady) {
      initAuth((state) => {
        this.authState = state;
        this.refreshSyncControl();
      });
    }

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Load Game visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds this scene's whole layout against the current viewport,
  // reusing the existing build methods verbatim (snapshot-diff into a fresh
  // container, same convention `MainMenuScene` established).
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    const { width } = getViewport(this);

    drawScreenBackdrop(this);

    const title = this.filterMode === "campaign" ? "Load Campaign" : "Load Game";
    this.add
      .text(width / 2, 42, title, {
        fontFamily: FONT_DISPLAY,
        fontSize: "34px",
        color: "#f0dfa8",
        fontStyle: "bold",
        letterSpacing: 2 as unknown as number,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    createOrnateButton(this, 120, 42, 160, 44, "Back (Esc)", () => this.leave(), { variant: "tool", depth: 5 });

    const subtitle =
      this.filterMode === "campaign"
        ? "Load a saved campaign party, or delete one you no longer need."
        : this.filterMode === "freeplay"
          ? "Load a saved Free Play/classic party, or delete one you no longer need."
          : "Load a previously saved party, or delete one you no longer need.";
    this.add
      .text(width / 2, 90, subtitle, {
        fontFamily: FONT_BODY,
        fontSize: "15px",
        color: "#a89058",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.buildSyncControl(width);
    this.buildSlotCards(width);

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);
  }

  private leave(): void {
    if (this.filterMode) {
      this.scene.start("ModeEntryScene", { mode: this.filterMode });
      return;
    }
    this.scene.start("MainMenuScene");
  }

  /**
   * Not rendered at all when `!firebaseReady` — nothing to sync without a
   * Firebase project configured, same "don't show an always-disabled
   * button" call as `MainMenuScene`'s Account control. When rendered, the
   * space it occupies (y=130, between the y=90 subtitle and the y=220 card
   * list) is reserved either way, so the layout doesn't shift depending on
   * whether Firebase happens to be configured.
   */
  private buildSyncControl(width: number): void {
    if (!firebaseReady) return;

    const x = width / 2;
    const y = 130;

    this.syncButtonHandle = createOrnateButton(this, x, y, 240, 36, "", () => this.onSyncWithCloud(), {
      variant: "tool",
      depth: 5,
    });
    this.syncStatusLabel = this.add
      .text(x, y + 26, "", { fontFamily: FONT_BODY, fontSize: "12px", color: "#a89058" })
      .setOrigin(0.5)
      .setDepth(5);

    this.refreshSyncControl();
  }

  private refreshSyncControl(): void {
    if (!this.syncButtonHandle) return;
    const canSync = !this.authState.isAnonymous;
    this.syncButtonHandle.setLabel(canSync ? "Sync with Cloud" : "Sign in with Google (main menu) to sync");
    this.syncButtonHandle.setDisabled(!canSync);
  }

  private onSyncWithCloud(): void {
    if (this.authState.isAnonymous || !this.authState.uid) return;
    this.syncButtonHandle?.setLabel("Syncing…");
    this.syncButtonHandle?.setDisabled(true);
    syncNow(this.authState.uid, loadSaveFile(window.localStorage, SAVE_STORAGE_KEY))
      .then((merged) => {
        saveSaveFile(window.localStorage, SAVE_STORAGE_KEY, merged);
        this.scene.restart();
      })
      .catch((err) => {
        console.error("Cloud sync failed:", err);
        this.syncStatusLabel?.setText("Sync failed — see console for details.");
        this.refreshSyncControl();
      });
  }

  /** One clickable card per save slot, stacked vertically below the intro text, or an empty-state line. */
  private buildSlotCards(width: number): void {
    const file = loadSaveFile(window.localStorage, SAVE_STORAGE_KEY);
    const filtered = file.slots.filter((slot) => {
      if (this.filterMode === "campaign") return slot.campaignId !== undefined;
      if (this.filterMode === "freeplay") return slot.campaignId === undefined;
      return true;
    });

    if (filtered.length === 0) {
      const emptyMessage =
        this.filterMode === "campaign"
          ? "No saved campaign parties yet — save one from a campaign battle's pause menu."
          : this.filterMode === "freeplay"
            ? 'No saved parties yet — build one in Party Creation and click "Save Party."'
            : 'No saved parties yet — build one in Create Party and click "Save Party."';
      this.add
        .text(width / 2, 260, emptyMessage, {
          fontFamily: FONT_BODY,
          fontSize: "16px",
          color: "#a89058",
          fontStyle: "italic",
        })
        .setOrigin(0.5)
        .setDepth(1);
      return;
    }

    const cardWidth = width - 160;
    const cardHeight = 120;
    const gap = 20;
    const startY = 220;

    // Most-recently-updated first, so a slot the player keeps re-saving stays near the top.
    const slots = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);

    slots.forEach((slot, i) => {
      const y = startY + i * (cardHeight + gap);

      drawParchmentPanel(this, width / 2, y, cardWidth, cardHeight, 2);

      this.add
        .text(90, y - cardHeight / 2 + 16, slot.name, {
          fontFamily: FONT_BODY,
          fontSize: "20px",
          color: "#2a1a10",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5)
        .setDepth(3);

      this.add
        .text(90, y, this.partySummary(slot), {
          fontFamily: FONT_BODY,
          fontSize: "13px",
          color: "#6a4a2a",
          wordWrap: { width: cardWidth - 300 },
        })
        .setOrigin(0, 0.5)
        .setDepth(3);

      this.add
        .text(90, y + cardHeight / 2 - 18, `Party size ${slot.partySize}  ·  ${getDifficultyDefinition(slot.difficultyId).name}`, {
          fontFamily: FONT_BODY,
          fontSize: "13px",
          color: "#6a4a2a",
          fontStyle: "italic",
        })
        .setOrigin(0, 0.5)
        .setDepth(3);

      createOrnateButton(this, width - 220, y - 20, 160, 40, "Load", () => this.loadSlot(slot), { variant: "tool", depth: 3 });
      createOrnateButton(this, width - 220, y + 26, 160, 40, "Delete", () => this.deleteSlot(slot.id), { variant: "tool", depth: 3 });
    });
  }

  private partySummary(slot: SaveSlot): string {
    return slot.party
      .map((build) => `${build.name} (${getClassDefinition(build.classId).name})`)
      .join(", ");
  }

  private loadSlot(slot: SaveSlot): void {
    // D-201: forward a campaign-linked slot's campaignId/chapterIndex too —
    // without this, a saved campaign party re-entered Character Creation
    // as fully free-pick (no companion lock, no point-buy, wrong party
    // size). Both are simply undefined for a classic/Free Play slot.
    //
    // D-228 (KI-177 item 9 bug): `chapterIndex` is NO LONGER taken verbatim
    // from the slot — `slot.chapterIndex` is whatever chapter was being
    // fought the moment Save Party/Save & Exit was last clicked, which goes
    // stale the instant the player progresses further chapters via Campaign
    // Select's own "Continue" flow without re-saving that exact slot
    // (Kevin's report: loading a campaign he'd played several chapters into
    // dropped him back "before mission 1"). Recomputed here the same way
    // `CampaignSelectScene.nextChapterIndexFor` does — the real source of
    // truth for "which chapter is next" is `CampaignProgressSystem`, not a
    // save-time snapshot.
    const chapterIndex = slot.campaignId ? this.resumeChapterIndexFor(slot.campaignId) : slot.chapterIndex;
    this.scene.start("CharacterCreationScene", {
      loadedSlotId: slot.id,
      loadedParty: slot.party,
      difficultyId: slot.difficultyId,
      campaignId: slot.campaignId,
      chapterIndex,
    });
  }

  /** D-228: mirrors `CampaignSelectScene.nextChapterIndexFor` exactly. */
  private resumeChapterIndexFor(campaignId: string): number {
    const campaign = getCampaignDefinition(campaignId);
    const progress = loadCampaignProgress(window.localStorage, CAMPAIGN_PROGRESS_STORAGE_KEY);
    return Math.min(getHighestCompletedChapter(progress, campaignId) + 1, totalChapters(campaign) - 1);
  }

  private deleteSlot(slotId: string): void {
    const file = loadSaveFile(window.localStorage, SAVE_STORAGE_KEY);
    saveSaveFile(window.localStorage, SAVE_STORAGE_KEY, deleteSaveSlot(file, slotId));
    // Mirror the delete to the cloud (fire-and-forget — the local delete
    // already succeeded regardless) so a synced-away slot doesn't come
    // back on the next "Sync with Cloud." Only when actually signed in
    // with Google; an anonymous uid's cloud data (if any) is abandoned
    // wholesale on sign-out, not worth reaching for here.
    if (!this.authState.isAnonymous && this.authState.uid) {
      deleteSlotFromCloud(this.authState.uid, slotId).catch((err) =>
        console.error("Cloud delete failed:", err),
      );
    }
    this.scene.restart();
  }
}
