import Phaser from "phaser";
import { SETTINGS_STORAGE_KEY, KEYBINDINGS_STORAGE_KEY } from "../config";
import {
  ANIMATION_SPEEDS,
  ANIMATION_SPEED_LABELS,
  DEFAULT_SETTINGS,
  VOLUME_STEPS,
  loadSettings,
  resetSettings,
  saveSettings,
  toggleMuted,
  type Settings,
} from "../systems/SettingsSystem";
import {
  loadKeyBindings,
  saveKeyBindings,
  resetKeyBindings,
  keyBindingConflict,
  formatKeyCode,
  REBINDABLE_ACTION_LABELS,
  type KeyBindings,
  type RebindableAction,
} from "../systems/KeyBindingSystem";
import {
  FONT_BODY,
  FONT_DISPLAY,
  createOrnateButton,
  drawScreenBackdrop,
  getViewport,
  onViewportResize,
  openChoiceList,
  type OrnateButtonHandle,
} from "./uiTheme";
import { audioManager } from "./AudioManager";
import type { BattleScene } from "./BattleScene";

/**
 * SettingsScene (D-153) — the one screen every settings control lives on now:
 * Game Speed (moved out of Main Menu's old single corner button) plus real
 * Master/Music/SFX volume and a Mute toggle (KI-105), applied live to
 * `AudioManager`/Phaser's shared sound manager even though no audio asset
 * exists yet (KI-029) — genuinely working plumbing waiting on content, not
 * dead scaffolding for a system that doesn't exist.
 *
 * Two entry modes, mirroring D-148/D-152's already-proven nested-scene
 * pattern rather than inventing a new one:
 * - **Standalone** (`battleScene` omitted) — reached via `scene.start` from
 *   `MainMenuScene`; Back returns to `returnScene` the same way.
 * - **Overlay** (`battleScene` present) — reached via `scene.launch` +
 *   `scene.pause()` from `PauseMenuScene` while a battle is paused, so Game
 *   Speed can change LIVE mid-battle (D-130) exactly like the pause menu's
 *   old inline Game Speed row did; Back stops this scene and resumes
 *   `returnScene` instead of starting it fresh.
 */

export interface SettingsSceneData {
  returnScene: string;
  battleScene?: BattleScene;
}

/** Batch G (item 19): same shape/pattern as `PauseMenuScene`'s own confirm-before-destructive-action prompt. */
type ConfirmPrompt = { message: string; confirmLabel: string; onConfirm: () => void };

export class SettingsScene extends Phaser.Scene {
  private returnScene = "MainMenuScene";
  private battleScene: BattleScene | null = null;
  private settings: Settings = loadSettings(window.localStorage, SETTINGS_STORAGE_KEY);
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private backdrop?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  /** D-16x: the shared full-screen list-picker overlay (`openChoiceList`), replacing the old click-to-cycle Game Speed/volume buttons. */
  private choiceOverlay: Phaser.GameObjects.GameObject[] = [];
  /** Phase 3 (D-205): the three rebindable in-battle keys — Controls section, below. */
  private keyBindings: KeyBindings = loadKeyBindings(window.localStorage, KEYBINDINGS_STORAGE_KEY);
  /** Set while a Controls row is "listening" for the next keypress to rebind to. */
  private awaitingRebindFor: RebindableAction | null = null;
  /** A transient rejection message (conflict) shown under the Controls rows, cleared on the next successful/cancelled rebind. */
  private keyBindingMessage: string | null = null;
  /** Batch G (item 19): set while the "Reset to Default" confirmation is showing. */
  private confirmPrompt: ConfirmPrompt | null = null;

  constructor() {
    super("SettingsScene");
  }

  init(data: SettingsSceneData): void {
    this.returnScene = data.returnScene;
    this.battleScene = data.battleScene ?? null;
    this.settings = loadSettings(window.localStorage, SETTINGS_STORAGE_KEY);
    this.keyBindings = loadKeyBindings(window.localStorage, KEYBINDINGS_STORAGE_KEY);
    this.awaitingRebindFor = null;
    this.keyBindingMessage = null;
    this.confirmPrompt = null;
  }

  create(): void {
    this.contentObjects = [];
    this.rebuildLayout();

    // Phase 3 (D-205): while a Controls row is capturing, Esc only cancels
    // the capture (see the generic `keydown` listener below) — it must NOT
    // also back out of Settings entirely.
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.awaitingRebindFor) return;
      if (this.confirmPrompt) {
        this.confirmPrompt = null;
        this.render();
        return;
      }
      this.back();
    });
    // The rebind capture itself: any key while `awaitingRebindFor` is set.
    // A raw `keydown` listener (not Phaser's `keydown-KEYNAME` sugar) so it
    // can read whatever key was actually pressed, generically.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!this.awaitingRebindFor) return;
      event.preventDefault();
      const action = this.awaitingRebindFor;
      if (event.code === "Escape") {
        this.awaitingRebindFor = null;
        this.render();
        return;
      }
      const conflict = keyBindingConflict(this.keyBindings, action, event.code);
      if (conflict) {
        this.keyBindingMessage =
          conflict === "reserved"
            ? "That key is already used elsewhere — pick another."
            : `That key is already bound to ${REBINDABLE_ACTION_LABELS[conflict]}.`;
        this.render();
        return;
      }
      this.keyBindings = { ...this.keyBindings, [action]: event.code };
      saveKeyBindings(window.localStorage, KEYBINDINGS_STORAGE_KEY, this.keyBindings);
      this.awaitingRebindFor = null;
      this.keyBindingMessage = null;
      this.render();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  private rebuildLayout(): void {
    this.backdrop?.destroy();
    this.titleText?.destroy();
    const { width } = getViewport(this);

    this.backdrop = drawScreenBackdrop(this);
    this.titleText = this.add
      .text(width / 2, 60, "Settings", {
        fontFamily: FONT_DISPLAY,
        fontSize: "40px",
        color: "#f0dfa8",
        fontStyle: "bold",
        letterSpacing: 2 as unknown as number,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    this.render();
  }

  private back(): void {
    if (this.battleScene) {
      this.scene.stop();
      this.scene.resume(this.returnScene);
    } else {
      this.scene.start(this.returnScene);
    }
  }

  private persistAndApply(): void {
    saveSettings(window.localStorage, SETTINGS_STORAGE_KEY, this.settings);
    audioManager.applySettings(this, this.settings);
  }

  private render(): void {
    this.contentObjects.forEach((o) => o.destroy());
    this.contentObjects = [];

    const cx = getViewport(this).width / 2;

    if (this.confirmPrompt) {
      this.renderConfirmPrompt(this.confirmPrompt, cx);
      return;
    }

    const width = 380;
    const rows = {
      gameSpeed: 190,
      master: 260,
      music: 330,
      sfx: 400,
      mute: 470,
      confirm: 550,
      cancel: 620,
      bonusAction: 690,
      keyBindingMessage: 730,
      reset: 800,
      back: 880,
    };

    this.contentObjects.push(this.buildGameSpeedButton(cx, rows.gameSpeed, width).container);
    this.contentObjects.push(
      this.buildVolumeButton(
        cx,
        rows.master,
        width,
        "Master Volume",
        () => this.settings.masterVolume,
        (v) => (this.settings = { ...this.settings, masterVolume: v }),
      ).container,
    );
    this.contentObjects.push(
      this.buildVolumeButton(
        cx,
        rows.music,
        width,
        "Music Volume",
        () => this.settings.musicVolume,
        (v) => (this.settings = { ...this.settings, musicVolume: v }),
      ).container,
    );
    this.contentObjects.push(
      this.buildVolumeButton(
        cx,
        rows.sfx,
        width,
        "SFX Volume",
        () => this.settings.sfxVolume,
        (v) => (this.settings = { ...this.settings, sfxVolume: v }),
      ).container,
    );
    this.contentObjects.push(this.buildMuteButton(cx, rows.mute, width).container);

    // Phase 3 (D-205): Controls — Confirm/Cancel/Bonus Action, the three
    // rebindable in-battle keys (full replace, not an additive extra key —
    // see KeyBindingSystem.ts's own doc comment for what that means).
    this.contentObjects.push(this.buildKeyBindingButton(cx, rows.confirm, width, "confirm").container);
    this.contentObjects.push(this.buildKeyBindingButton(cx, rows.cancel, width, "cancel").container);
    this.contentObjects.push(this.buildKeyBindingButton(cx, rows.bonusAction, width, "bonusAction").container);
    if (this.keyBindingMessage) {
      this.contentObjects.push(
        this.add
          .text(cx, rows.keyBindingMessage, this.keyBindingMessage, {
            fontFamily: FONT_DISPLAY,
            fontSize: "14px",
            color: "#e07a7a",
            align: "center",
            wordWrap: { width: width + 40 },
          })
          .setOrigin(0.5)
          .setDepth(5),
      );
    }

    // Batch G (item 19): defaults already exist as named constants
    // (`DEFAULT_SETTINGS`/`DEFAULT_KEY_BINDINGS`) — this just exposes a way
    // back to them without deleting localStorage by hand. Confirmed first,
    // same as any other destructive-feeling action on this screen (Load
    // Game/Exit follow the identical `ConfirmPrompt` pattern in
    // `PauseMenuScene`).
    this.contentObjects.push(
      createOrnateButton(
        this,
        cx,
        rows.reset,
        width,
        54,
        "Reset to Default",
        () => {
          this.confirmPrompt = {
            message: "This resets Game Speed, Volume, Mute, and Key Bindings to their defaults. Continue?",
            confirmLabel: "Reset to Default",
            onConfirm: () => this.resetToDefaults(),
          };
          this.render();
        },
        { variant: "secondary", depth: 5 },
      ).container,
    );

    this.contentObjects.push(
      createOrnateButton(this, cx, rows.back, 200, 48, "Back", () => this.back(), {
        variant: "secondary",
        depth: 5,
      }).container,
    );
  }

  /** Batch G (item 19): resets Settings and Key Bindings to their defaults, syncing a live in-battle `BattleScene`'s Game Speed too if this is the overlay entry mode. */
  private resetToDefaults(): void {
    this.settings = resetSettings(window.localStorage, SETTINGS_STORAGE_KEY);
    this.keyBindings = resetKeyBindings(window.localStorage, KEYBINDINGS_STORAGE_KEY);
    if (this.battleScene) {
      this.battleScene.setAnimationSpeed(DEFAULT_SETTINGS.animationSpeed);
    }
    audioManager.applySettings(this, this.settings);
    this.confirmPrompt = null;
    this.awaitingRebindFor = null;
    this.keyBindingMessage = null;
    this.render();
  }

  /** Same layout `PauseMenuScene.renderConfirm` established for a destructive-action prompt — message plus Confirm/Cancel side by side. */
  private renderConfirmPrompt(prompt: ConfirmPrompt, cx: number): void {
    this.contentObjects.push(
      this.add
        .text(cx, 400, prompt.message, {
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
      createOrnateButton(this, cx - 170, 500, 280, 56, prompt.confirmLabel, () => prompt.onConfirm(), {
        variant: "secondary",
        depth: 5,
      }).container,
    );
    this.contentObjects.push(
      createOrnateButton(
        this,
        cx + 170,
        500,
        280,
        56,
        "Cancel",
        () => {
          this.confirmPrompt = null;
          this.render();
        },
        { variant: "secondary", depth: 5 },
      ).container,
    );
  }

  private buildGameSpeedButton(x: number, y: number, width: number): OrnateButtonHandle {
    const currentSpeed = () => (this.battleScene ? this.battleScene.animationSpeedLabel() : ANIMATION_SPEED_LABELS[this.settings.animationSpeed]);
    const label = () => `Game Speed: ${currentSpeed()}`;
    const handle = createOrnateButton(
      this,
      x,
      y,
      width,
      54,
      label(),
      () => {
        openChoiceList(
          this,
          this.choiceOverlay,
          "Choose Game Speed",
          ANIMATION_SPEEDS.map((speed) => ({
            label: ANIMATION_SPEED_LABELS[speed],
            highlighted: currentSpeed() === ANIMATION_SPEED_LABELS[speed],
            onPick: () => {
              if (this.battleScene) {
                this.battleScene.setAnimationSpeed(speed);
              } else {
                this.settings = { ...this.settings, animationSpeed: speed };
                saveSettings(window.localStorage, SETTINGS_STORAGE_KEY, this.settings);
              }
              handle.setLabel(label());
            },
          })),
        );
      },
      { variant: "secondary", depth: 5 },
    );
    return handle;
  }

  private buildVolumeButton(
    x: number,
    y: number,
    width: number,
    label: string,
    get: () => number,
    set: (value: number) => void,
  ): OrnateButtonHandle {
    const text = () => `${label}: ${get()}%`;
    const handle = createOrnateButton(
      this,
      x,
      y,
      width,
      54,
      text(),
      () => {
        openChoiceList(
          this,
          this.choiceOverlay,
          `Choose ${label}`,
          VOLUME_STEPS.map((v) => ({
            label: `${v}%`,
            highlighted: v === get(),
            onPick: () => {
              set(v);
              this.persistAndApply();
              handle.setLabel(text());
            },
          })),
        );
      },
      { variant: "secondary", depth: 5 },
    );
    return handle;
  }

  /**
   * Phase 3 (D-205): one Controls row — clicking arms `awaitingRebindFor` and
   * a full `render()` relabels every row (simpler than tracking individual
   * handles across capture-state changes, matching this file's existing
   * "cheap full rebuild" style already used by `rebuildLayout`). The actual
   * key capture happens in `create()`'s generic `keydown` listener, not here.
   */
  private buildKeyBindingButton(x: number, y: number, width: number, action: RebindableAction): OrnateButtonHandle {
    const label = REBINDABLE_ACTION_LABELS[action];
    const text =
      this.awaitingRebindFor === action
        ? `${label}: Press a key… (Esc cancels)`
        : `${label}: ${formatKeyCode(this.keyBindings[action])}`;
    return createOrnateButton(
      this,
      x,
      y,
      width,
      54,
      text,
      () => {
        this.awaitingRebindFor = action;
        this.keyBindingMessage = null;
        this.render();
      },
      { variant: "secondary", depth: 5 },
    );
  }

  private buildMuteButton(x: number, y: number, width: number): OrnateButtonHandle {
    const text = () => `Mute All: ${this.settings.muted ? "On" : "Off"}`;
    const handle = createOrnateButton(
      this,
      x,
      y,
      width,
      54,
      text(),
      () => {
        this.settings = { ...this.settings, muted: toggleMuted(this.settings.muted) };
        this.persistAndApply();
        handle.setLabel(text());
      },
      { variant: "secondary", depth: 5 },
    );
    return handle;
  }
}
