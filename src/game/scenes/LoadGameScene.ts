import Phaser from "phaser";
import { GAME_WIDTH, SAVE_STORAGE_KEY } from "../config";
import { getClassDefinition } from "../data/classes";
import { getDifficultyDefinition } from "../data/difficulty";
import { deleteSaveSlot, loadSaveFile, saveSaveFile, type SaveSlot } from "../systems/SaveSystem";
import { firebaseReady } from "../cloud/firebaseApp";
import { initAuth, type AuthState } from "../cloud/AuthClient";
import { deleteSlotFromCloud, syncNow } from "../cloud/CloudSaveSync";

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
 * Phase 10 (D-084) added a "Sync with Cloud" button (only meaningful once
 * signed in with Google — see `MainMenuScene`'s Account control; syncing
 * an anonymous-only session is pointless, nothing else can ever reach that
 * uid) that pulls/merges/pushes via `CloudSaveSync.syncNow`, then restarts
 * this scene to re-render from the merged result — the same
 * `scene.restart()` `deleteSlot` already used. Deleting a slot now also
 * mirrors the delete to the cloud when signed in, so a synced-away slot
 * doesn't reappear on the next sync.
 */
export class LoadGameScene extends Phaser.Scene {
  private authState: AuthState = { uid: null, isAnonymous: true, displayName: null };
  private syncButton?: Phaser.GameObjects.Rectangle;
  private syncLabel?: Phaser.GameObjects.Text;
  private syncStatusLabel?: Phaser.GameObjects.Text;

  constructor() {
    super("LoadGameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0e0e14");

    this.add
      .text(GAME_WIDTH / 2, 40, "Load Game", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.buildButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());

    this.add
      .text(GAME_WIDTH / 2, 90, "Load a previously saved party, or delete one you no longer need.", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#8a8aa0",
      })
      .setOrigin(0.5);

    this.buildSyncControl();
    this.buildSlotCards();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Load Game visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
  }

  private leave(): void {
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
  private buildSyncControl(): void {
    if (!firebaseReady) return;

    const x = GAME_WIDTH / 2;
    const y = 130;

    this.syncButton = this.add
      .rectangle(x, y, 240, 36, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    this.syncLabel = this.add
      .text(x, y, "", { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#c8c8d8" })
      .setOrigin(0.5);
    this.syncStatusLabel = this.add
      .text(x, y + 26, "", { fontFamily: "monospace", fontSize: "12px", color: "#8a8aa0" })
      .setOrigin(0.5);

    this.syncButton.on("pointerover", () => {
      if (this.syncButton?.input?.enabled) this.syncButton.setFillStyle(0x3a3a4a);
    });
    this.syncButton.on("pointerout", () => this.syncButton?.setFillStyle(0x2a2a3a));
    this.syncButton.on("pointerdown", () => this.onSyncWithCloud());

    initAuth((state) => {
      this.authState = state;
      this.refreshSyncControl();
    });
    this.refreshSyncControl();
  }

  private refreshSyncControl(): void {
    if (!this.syncButton || !this.syncLabel) return;
    const canSync = !this.authState.isAnonymous;
    this.syncLabel.setText(canSync ? "Sync with Cloud" : "Sign in with Google (main menu) to sync");
    if (canSync) {
      this.syncButton.setInteractive({ useHandCursor: true });
      this.syncButton.setAlpha(1);
    } else {
      this.syncButton.disableInteractive();
      this.syncButton.setAlpha(0.5);
    }
  }

  private onSyncWithCloud(): void {
    if (this.authState.isAnonymous || !this.authState.uid) return;
    this.syncLabel?.setText("Syncing…");
    this.syncButton?.disableInteractive();
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

  /** Small button+label pair, matching CampaignSelectScene/BestiaryScene's simple rectangle-button style. */
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

  /** One clickable card per save slot, stacked vertically below the intro text, or an empty-state line. */
  private buildSlotCards(): void {
    const file = loadSaveFile(window.localStorage, SAVE_STORAGE_KEY);

    if (file.slots.length === 0) {
      this.add
        .text(GAME_WIDTH / 2, 260, 'No saved parties yet — build one in Create Party and click "Save Party."', {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "16px",
          color: "#6a6a80",
        })
        .setOrigin(0.5);
      return;
    }

    const cardWidth = GAME_WIDTH - 160;
    const cardHeight = 120;
    const gap = 20;
    const startY = 220;

    // Most-recently-updated first, so a slot the player keeps re-saving stays near the top.
    const slots = [...file.slots].sort((a, b) => b.updatedAt - a.updatedAt);

    slots.forEach((slot, i) => {
      const y = startY + i * (cardHeight + gap);

      this.add.rectangle(GAME_WIDTH / 2, y, cardWidth, cardHeight, 0x1a1a26).setStrokeStyle(1, 0x2a2a3a);

      this.add
        .text(90, y - cardHeight / 2 + 16, slot.name, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "20px",
          color: "#e8e8f0",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(90, y, this.partySummary(slot), {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: "#a0a0b0",
          wordWrap: { width: cardWidth - 300 },
        })
        .setOrigin(0, 0.5);

      this.add
        .text(90, y + cardHeight / 2 - 18, `Party size ${slot.partySize}  ·  ${getDifficultyDefinition(slot.difficultyId).name}`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#8aa0c0",
        })
        .setOrigin(0, 0.5);

      this.buildButton(GAME_WIDTH - 220, y - 20, 160, 40, "Load", 0x2a3a2e, () => this.loadSlot(slot));
      this.buildButton(GAME_WIDTH - 220, y + 26, 160, 40, "Delete", 0x3a2a2a, () => this.deleteSlot(slot.id));
    });
  }

  private partySummary(slot: SaveSlot): string {
    return slot.party
      .map((build) => `${build.name} (${getClassDefinition(build.classId).name})`)
      .join(", ");
  }

  private loadSlot(slot: SaveSlot): void {
    this.scene.start("CharacterCreationScene", {
      loadedSlotId: slot.id,
      loadedParty: slot.party,
      difficultyId: slot.difficultyId,
    });
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
