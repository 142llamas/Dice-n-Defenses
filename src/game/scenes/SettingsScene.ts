import Phaser from "phaser";
import { SETTINGS_STORAGE_KEY } from "../config";
import {
  ANIMATION_SPEEDS,
  ANIMATION_SPEED_LABELS,
  VOLUME_STEPS,
  loadSettings,
  saveSettings,
  toggleMuted,
  type Settings,
} from "../systems/SettingsSystem";
import {
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

export class SettingsScene extends Phaser.Scene {
  private returnScene = "MainMenuScene";
  private battleScene: BattleScene | null = null;
  private settings: Settings = loadSettings(window.localStorage, SETTINGS_STORAGE_KEY);
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private backdrop?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  /** D-16x: the shared full-screen list-picker overlay (`openChoiceList`), replacing the old click-to-cycle Game Speed/volume buttons. */
  private choiceOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("SettingsScene");
  }

  init(data: SettingsSceneData): void {
    this.returnScene = data.returnScene;
    this.battleScene = data.battleScene ?? null;
    this.settings = loadSettings(window.localStorage, SETTINGS_STORAGE_KEY);
  }

  create(): void {
    this.contentObjects = [];
    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.back());
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
    const width = 380;
    const rows = { gameSpeed: 190, master: 260, music: 330, sfx: 400, mute: 470, back: 570 };

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

    this.contentObjects.push(
      createOrnateButton(this, cx, rows.back, 200, 48, "Back", () => this.back(), {
        variant: "secondary",
        depth: 5,
      }).container,
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
