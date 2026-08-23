import Phaser from "phaser";
import { FONT_DISPLAY, FONT_BODY, createOrnateButton, drawScreenBackdrop, drawParchmentPanel, getViewport, onViewportResize } from "./uiTheme";
import type { BattleScene } from "./BattleScene";

/**
 * PauseMenuScene — D-152: a real in-battle pause menu, opened over a paused
 * `BattleScene` (`scene.launch` + `scene.pause()`/`scene.resume()`, the exact
 * mechanism D-148's `CharacterSheetScene` already established and de-risked
 * — nothing new architecturally here).
 *
 * Replaces what used to be `BattleScene.handleEscape`'s unwarned fallback:
 * pressing Esc with nothing else going on used to call
 * `scene.start("MainMenuScene")` immediately, with no confirmation and no
 * chance to save. This scene is that fallback now.
 *
 * `init(data)` receives the LIVE `BattleScene` instance (not serialized —
 * same "in-process, no sync step needed" reasoning D-148 used for `Hero`),
 * so Save/Game Speed act on the exact same object the battle itself uses.
 *
 * Scope, deliberately: "Save" here means "save this party's build for reuse
 * in a future battle" (`BattleScene.saveParty`, same `SaveSystem` every
 * other save flow uses) — it does NOT preserve this battle's own progress
 * (wave/gold/built structures). No mechanism for that exists anywhere in
 * this project; building one would mean wiring the currently-unused
 * `BattleStateSnapshot` (D-101) into `SaveSystem`, real new scope well
 * beyond "add a menu." D-153: the inline "Game Speed" row this menu used to
 * carry moved onto the new `SettingsScene` (launched as an overlay over this
 * paused menu, same nested-scene mechanism this menu itself uses over
 * `BattleScene`) — Settings now also covers real Master/Music/SFX
 * volume/mute controls (KI-105), even with no audio asset in the game yet.
 */

export interface PauseMenuSceneData {
  battleScene: BattleScene;
}

type ConfirmPrompt = { message: string; confirmLabel: string; onConfirm: () => void };

const CONTROLS_TEXT = [
  "Movement & selection",
  "  Click a hero, then click a tile — or arrow keys + Enter/Space",
  "  Click-and-hold a hero to drag; right-click while dragging pins a waypoint",
  "  1-4 — select hero by party slot     Tab — toggle keyboard focus board/grid",
  "",
  "Actions (while a hero is selected)",
  "  Q — Ability     P — Potion     R — Bonus Action     F — Action Surge",
  "  T — Class Action     C — Character Sheet",
  "",
  "Battle",
  "  E — End Turn     B — Build mode     G — Gear/Equip mode",
  "  S — Cycle Game Speed     H — Reopen Tutorial     L — Technical Log",
  "  Esc — Back / this Menu",
  "",
  "Test Mode only",
  "  F9 — Debug Menu (Skip Wave, No-Fail, Spawn Enemy, Paint Terrain, Set Status)",
].join("\n");

export class PauseMenuScene extends Phaser.Scene {
  private battleScene!: BattleScene;
  private view: "menu" | "controls" = "menu";
  private confirmPrompt: ConfirmPrompt | null = null;
  private saveResultText = "";
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private backdrop?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;

  constructor() {
    super("PauseMenuScene");
  }

  init(data: PauseMenuSceneData): void {
    this.battleScene = data.battleScene;
  }

  create(): void {
    this.view = "menu";
    this.confirmPrompt = null;
    this.saveResultText = "";
    this.contentObjects = [];

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.handleEscape());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds the backdrop/title/current sub-view from scratch against
  // the scene's live viewport size — safe to call repeatedly (destroys its
  // own prior output first), which is what lets a resize event just call
  // this again instead of needing a separate incremental-reposition path.
  private rebuildLayout(): void {
    this.backdrop?.destroy();
    this.titleText?.destroy();
    const { width } = getViewport(this);

    this.backdrop = drawScreenBackdrop(this);
    this.titleText = this.add
      .text(width / 2, 60, "Paused", {
        fontFamily: FONT_DISPLAY,
        fontSize: "40px",
        color: "#f0dfa8",
        fontStyle: "bold",
        letterSpacing: 2 as unknown as number,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    this.renderView();
  }

  private handleEscape(): void {
    if (this.confirmPrompt) {
      this.confirmPrompt = null;
      this.renderView();
    } else if (this.view === "controls") {
      this.view = "menu";
      this.renderView();
    } else {
      this.resumeBattle();
    }
  }

  private resumeBattle(): void {
    this.scene.stop();
    this.scene.resume("BattleScene");
  }

  private clearContent(): void {
    this.contentObjects.forEach((o) => o.destroy());
    this.contentObjects = [];
  }

  private renderView(): void {
    this.clearContent();
    if (this.confirmPrompt) this.renderConfirm(this.confirmPrompt);
    else if (this.view === "controls") this.renderControls();
    else this.renderMenu();
  }

  // ----- Main menu ---------------------------------------------------------

  // Fixed row Y positions (not incrementally computed) so the reserved
  // result-text slot between Save Party and Save & Exit never risks
  // crowding either button regardless of how many lines it wraps to.
  private static readonly ROW_Y = {
    resume: 170,
    saveParty: 260,
    saveResult: 310,
    saveAndExit: 362,
    loadGame: 432,
    exitToMainMenu: 502,
    controls: 572,
    settings: 642,
  };

  private renderMenu(): void {
    const cx = getViewport(this).width / 2;
    const width = 340;
    const { resume, saveParty, saveResult, saveAndExit, loadGame, exitToMainMenu, controls, settings } =
      PauseMenuScene.ROW_Y;

    this.contentObjects.push(
      createOrnateButton(this, cx, resume, width, 64, "Resume Battle", () => this.resumeBattle(), {
        variant: "primary",
        depth: 5,
      }).container,
    );

    const canSave = this.battleScene.canSaveParty();
    this.contentObjects.push(
      createOrnateButton(
        this,
        cx,
        saveParty,
        width,
        54,
        canSave ? "Save Party" : "Save Party (unavailable in Co-op)",
        () => this.onSaveParty(),
        { variant: "secondary", depth: 5, disabled: !canSave },
      ).container,
    );
    if (this.saveResultText) {
      this.contentObjects.push(
        this.add
          .text(cx, saveResult, this.saveResultText, {
            fontFamily: FONT_BODY,
            fontSize: "14px",
            color: "#a8c890",
            align: "center",
            wordWrap: { width: 500 },
          })
          .setOrigin(0.5)
          .setDepth(5),
      );
    }

    this.contentObjects.push(
      createOrnateButton(
        this,
        cx,
        saveAndExit,
        width,
        54,
        canSave ? "Save & Exit" : "Save & Exit (unavailable in Co-op)",
        () => this.onSaveAndExit(),
        { variant: "secondary", depth: 5, disabled: !canSave },
      ).container,
    );

    this.contentObjects.push(
      createOrnateButton(this, cx, loadGame, width, 54, "Load Game", () => this.onLoadGame(), {
        variant: "secondary",
        depth: 5,
      }).container,
    );

    this.contentObjects.push(
      createOrnateButton(this, cx, exitToMainMenu, width, 54, "Exit to Main Menu", () => this.onExitToMainMenu(), {
        variant: "secondary",
        depth: 5,
      }).container,
    );

    this.contentObjects.push(
      createOrnateButton(
        this,
        cx,
        controls,
        width,
        54,
        "Controls",
        () => {
          this.view = "controls";
          this.renderView();
        },
        { variant: "secondary", depth: 5 },
      ).container,
    );

    this.contentObjects.push(
      createOrnateButton(
        this,
        cx,
        settings,
        width,
        54,
        "Settings",
        () => {
          this.scene.launch("SettingsScene", { returnScene: "PauseMenuScene", battleScene: this.battleScene });
          this.scene.pause();
        },
        { variant: "secondary", depth: 5 },
      ).container,
    );
  }

  private onSaveParty(): void {
    const result = this.battleScene.saveParty();
    this.saveResultText = result
      ? `Saved as "${result.slotName}". This does not save this battle's own progress — only your party's build.`
      : "Could not save — all save slots are full. Delete one from Load Game first.";
    this.renderView();
  }

  private onSaveAndExit(): void {
    const result = this.battleScene.saveParty();
    if (!result) {
      this.saveResultText = "Could not save — all save slots are full. Delete one from Load Game first.";
      this.renderView();
      return;
    }
    this.scene.stop("BattleScene");
    this.scene.start("MainMenuScene");
  }

  private onLoadGame(): void {
    this.confirmPrompt = {
      message: "Loading will exit this battle — its progress will be lost. Continue?",
      confirmLabel: "Load Game",
      onConfirm: () => {
        this.scene.stop("BattleScene");
        this.scene.start("LoadGameScene");
      },
    };
    this.renderView();
  }

  private onExitToMainMenu(): void {
    this.confirmPrompt = {
      message: "This battle's progress will be lost. Continue?",
      confirmLabel: "Exit to Main Menu",
      onConfirm: () => {
        this.scene.stop("BattleScene");
        this.scene.start("MainMenuScene");
      },
    };
    this.renderView();
  }

  // ----- Confirm sub-view ----------------------------------------------------

  private renderConfirm(prompt: ConfirmPrompt): void {
    const cx = getViewport(this).width / 2;
    this.contentObjects.push(
      this.add
        .text(cx, 260, prompt.message, {
          fontFamily: FONT_BODY,
          fontSize: "20px",
          color: "#e8c06a",
          align: "center",
          wordWrap: { width: 700 },
        })
        .setOrigin(0.5)
        .setDepth(5),
    );
    this.contentObjects.push(
      createOrnateButton(
        this,
        cx - 170,
        360,
        280,
        56,
        prompt.confirmLabel,
        () => prompt.onConfirm(),
        { variant: "secondary", depth: 5 },
      ).container,
    );
    this.contentObjects.push(
      createOrnateButton(
        this,
        cx + 170,
        360,
        280,
        56,
        "Cancel",
        () => {
          this.confirmPrompt = null;
          this.renderView();
        },
        { variant: "secondary", depth: 5 },
      ).container,
    );
  }

  // ----- Controls reference sub-view -----------------------------------------

  private renderControls(): void {
    const cx = getViewport(this).width / 2;
    this.contentObjects.push(drawParchmentPanel(this, cx, 560, 900, 640, 2));
    this.contentObjects.push(
      this.add
        .text(cx - 400, 270, CONTROLS_TEXT, {
          fontFamily: FONT_BODY,
          fontSize: "16px",
          color: "#2a1a10",
          lineSpacing: 6,
        })
        .setDepth(3),
    );
    this.contentObjects.push(
      createOrnateButton(
        this,
        cx,
        900,
        200,
        48,
        "Back",
        () => {
          this.view = "menu";
          this.renderView();
        },
        { variant: "secondary", depth: 5 },
      ).container,
    );
  }
}
