import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, SETTINGS_STORAGE_KEY, COLORS } from "../config";
import {
  loadSettings,
  saveSettings,
  nextAnimationSpeed,
  type AnimationSpeed,
} from "../systems/SettingsSystem";
import { firebaseReady } from "../cloud/firebaseApp";
import { initAuth, signInWithGoogle, signOutAndResetAnonymous, type AuthState } from "../cloud/AuthClient";
import {
  createOrnateButton,
  centeredRowX,
  drawScreenBackdrop,
  spawnAmbientMotes,
  createSectionLabel,
  FONT_DISPLAY,
  FONT_BODY,
} from "./uiTheme";

const ANIMATION_SPEED_LABELS: Record<AnimationSpeed, string> = {
  normal: "Normal",
  fast: "Fast",
  instant: "Instant (reduced motion)",
};

/**
 * MainMenuScene: the game's title screen.
 *
 * D-123: restyled with a shared fantasy/parchment UI theme (`uiTheme.ts`) —
 * Kevin flagged the game as looking visually unfinished and asked for the
 * Main Menu (plus Compendium/Bestiary, restyled separately) to look
 * genuinely finished, on-brand, with real hover/click feedback on every
 * button. Also reorganized from one flat vertical stack of ten
 * identical-looking buttons (plus six more scattered in the corners) into
 * named groups by purpose — one hero action, then "Continue Your Journey"
 * (ways into a battle), "Know Your Foe" (reference screens), and a smaller,
 * deliberately muted "Creator Tools" row — so the hierarchy of what matters
 * most reads at a glance. Every `scene.start` target and keyboard shortcut
 * is unchanged; this is a presentation-only pass.
 *
 * The title shown here is a working placeholder. Per the Source of Truth, the
 * final shipped name must be original and must NOT contain "Dungeons & Dragons"
 * or "D&D" branding.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    drawScreenBackdrop(this);
    spawnAmbientMotes(this, 18);

    this.buildTitle();
    this.buildCrest();
    this.buildPrimaryAction();
    this.buildJourneyRow();
    this.buildReferenceRow();
    this.buildToolsRow();
    this.buildInstructions();
    this.buildVersionTag();

    // Keyboard shortcut: Enter or Space also starts a new game.
    this.input.keyboard?.on("keydown-ENTER", () => this.scene.start("CharacterCreationScene"));
    this.input.keyboard?.on("keydown-SPACE", () => this.scene.start("CharacterCreationScene"));

    this.buildSettingsControl();
    this.buildAccountControl();
  }

  private buildTitle(): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 100, "FANTASY TOWER DEFENSE", {
        fontFamily: FONT_DISPLAY,
        fontSize: "58px",
        color: "#f0dfa8",
        fontStyle: "bold",
        letterSpacing: 4 as unknown as number,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, "#000000", 10, true, true)
      .setDepth(1);

    const g = this.add.graphics().setDepth(1);
    const y = 156;
    g.lineStyle(2, COLORS.bronze, 0.9);
    g.lineBetween(cx - 300, y, cx - 26, y);
    g.lineBetween(cx + 26, y, cx + 300, y);
    g.fillStyle(COLORS.gilt, 1);
    g.fillCircle(cx, y, 5);
    g.lineStyle(1, COLORS.bronzeDark, 0.9);
    g.strokeCircle(cx, y, 9);

    this.add
      .text(cx, 196, "Command your heroes. Defend the Stronghold. Survive the siege.", {
        fontFamily: FONT_BODY,
        fontSize: "19px",
        color: "#b8a074",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(1);
  }

  /**
   * A drawn tower-and-shield emblem filling the otherwise-empty space below
   * the button groups — pure `Graphics`, no image asset, same "real drawing
   * code stands in for real art" treatment `dialogueBox.ts`'s parchment
   * panel and Phase 22's Cape of Billowing already established. Purely
   * decorative; not interactive.
   */
  private buildCrest(): void {
    const cx = GAME_WIDTH / 2;
    const cy = 850;
    const g = this.add.graphics().setDepth(0).setAlpha(0.85);

    // Shield outline.
    g.lineStyle(2, COLORS.bronze, 0.8);
    g.fillStyle(COLORS.woodPanel, 0.5);
    g.beginPath();
    g.moveTo(cx - 46, cy - 60);
    g.lineTo(cx + 46, cy - 60);
    g.lineTo(cx + 46, cy + 10);
    g.lineTo(cx, cy + 62);
    g.lineTo(cx - 46, cy + 10);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.lineStyle(1, COLORS.bronzeDark, 0.8);
    g.beginPath();
    g.moveTo(cx - 38, cy - 52);
    g.lineTo(cx + 38, cy - 52);
    g.lineTo(cx + 38, cy + 6);
    g.lineTo(cx, cy + 52);
    g.lineTo(cx - 38, cy + 6);
    g.closePath();
    g.strokePath();

    // A small tower silhouette (crenellations + a slit window) inside the shield.
    g.fillStyle(COLORS.gilt, 0.9);
    const towerW = 36;
    const towerX = cx - towerW / 2;
    const towerY = cy - 30;
    g.fillRect(towerX, towerY, towerW, 50);
    const teeth = 4;
    const toothW = towerW / teeth / 1.6;
    for (let i = 0; i < teeth; i++) {
      const tx = towerX + (i + 0.2) * (towerW / teeth);
      g.fillRect(tx, towerY - 8, toothW, 9);
    }
    g.fillStyle(COLORS.woodPanel, 1);
    g.fillRect(cx - 3, cy - 8, 6, 16);
  }

  private buildPrimaryAction(): void {
    createOrnateButton(
      this,
      GAME_WIDTH / 2,
      280,
      380,
      76,
      "New Game",
      () => this.scene.start("CharacterCreationScene"),
      { variant: "primary", sublabel: "Build a party and begin your first battle", depth: 5 },
    );
  }

  /** Every way to actually get into a battle: New Game (above) is the hero action, these are the alternates. */
  private buildJourneyRow(): void {
    createSectionLabel(this, GAME_WIDTH / 2, 366, "◆ Continue Your Journey ◆", 5);

    const entries: { label: string; onClick: () => void }[] = [
      { label: "Load Game", onClick: () => this.scene.start("LoadGameScene") },
      { label: "Campaigns", onClick: () => this.scene.start("CampaignSelectScene") },
      { label: "Free Play", onClick: () => this.scene.start("FreePlayScene") },
    ];
    if (firebaseReady) entries.push({ label: "Co-op", onClick: () => this.scene.start("CoopLobbyScene") });

    const width = 220;
    const xs = centeredRowX(entries.length, width, 20, GAME_WIDTH / 2);
    entries.forEach((entry, i) => {
      createOrnateButton(this, xs[i], 412, width, 58, entry.label, entry.onClick, {
        variant: "secondary",
        depth: 5,
      });
    });
  }

  /** Read-only reference screens — deliberately its own group, not mixed in with ways to start a battle. */
  private buildReferenceRow(): void {
    createSectionLabel(this, GAME_WIDTH / 2, 500, "◆ Know Your Foe ◆", 5);

    const entries: { label: string; onClick: () => void }[] = [
      { label: "Compendium", onClick: () => this.scene.start("CompendiumScene") },
      { label: "Bestiary", onClick: () => this.scene.start("BestiaryScene") },
    ];
    const width = 260;
    const xs = centeredRowX(entries.length, width, 24, GAME_WIDTH / 2);
    entries.forEach((entry, i) => {
      createOrnateButton(this, xs[i], 546, width, 58, entry.label, entry.onClick, {
        variant: "secondary",
        depth: 5,
      });
    });
  }

  /** Map Builder/Browse Shared Maps — smaller and visually quieter, since these are creator tools, not the main loop. */
  private buildToolsRow(): void {
    const y = 620;
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, COLORS.bronzeDark, 0.7);
    g.lineBetween(GAME_WIDTH / 2 - 220, y, GAME_WIDTH / 2 + 220, y);

    createSectionLabel(this, GAME_WIDTH / 2, y + 36, "Creator Tools", 5);

    const entries: { label: string; onClick: () => void }[] = [
      { label: "Map Builder", onClick: () => this.scene.start("MapBuilderScene") },
    ];
    if (firebaseReady) {
      entries.push({ label: "Browse Shared Maps", onClick: () => this.scene.start("BrowseSharedMapsScene") });
    }
    const width = 220;
    const xs = centeredRowX(entries.length, width, 20, GAME_WIDTH / 2);
    entries.forEach((entry, i) => {
      createOrnateButton(this, xs[i], y + 76, width, 46, entry.label, entry.onClick, {
        variant: "tool",
        depth: 5,
      });
    });
  }

  private buildInstructions(): void {
    const cx = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 66;
    this.add
      .text(
        cx,
        y,
        "Move your heroes, spend gold to Build walls & traps, and survive the waves.\n" +
          "Don't let the enemies breach your Stronghold. Click New Game or press Enter.",
        {
          fontFamily: FONT_BODY,
          fontSize: "17px",
          color: "#8a7658",
          align: "center",
          lineSpacing: 8,
          fontStyle: "italic",
        },
      )
      .setOrigin(0.5)
      .setDepth(1);
  }

  private buildVersionTag(): void {
    this.add
      .text(GAME_WIDTH - 28, GAME_HEIGHT - 20, "v0.2.0-dev", {
        fontFamily: FONT_BODY,
        fontSize: "12px",
        color: "#5a4a34",
      })
      .setOrigin(1)
      .setDepth(1);
  }

  /**
   * Phase 10 (D-084): a small account control. Rendered ONLY when
   * `firebaseReady` — with no Firebase project configured, there's nothing
   * for this control to do, so it simply doesn't appear rather than showing
   * a permanently-disabled button. D-123: moved from below the old top-left
   * Load Game button to sit under Settings in the top-right corner (Load
   * Game is now part of the "Continue Your Journey" row below), same
   * bounding-box discipline, same conditional.
   *
   * Every session is anonymous by default (see `AuthClient.initAuth`) —
   * this button's only job is the OPTIONAL upgrade to a real Google
   * identity, so cloud saves can follow the player across devices.
   */
  private buildAccountControl(): void {
    if (!firebaseReady) return;

    const x = GAME_WIDTH - 170;
    const y = 88;
    let state: AuthState = { uid: null, isAnonymous: true, displayName: null };

    const handle = createOrnateButton(this, x, y, 260, 44, "Connecting…", () => {
      const action = !state.isAnonymous ? signOutAndResetAnonymous() : signInWithGoogle();
      action.catch((err) => console.error("Account action failed:", err));
    }, { variant: "tool", depth: 20 });

    const refresh = () => {
      handle.setLabel(
        !state.isAnonymous
          ? `Signed in: ${state.displayName ?? "Google"} (tap to sign out)`
          : "Sign in with Google",
      );
    };

    initAuth((next) => {
      state = next;
      refresh();
    });
  }

  /**
   * Phase 8: a single settings control, top-right corner. Cycles the one
   * setting the game has (animation speed, which doubles as "reduced
   * motion" at its "instant" step) and persists the choice to localStorage —
   * BattleScene reads the same key on its own `create()`, so a change here
   * takes effect next battle.
   */
  private buildSettingsControl(): void {
    let settings = loadSettings(window.localStorage, SETTINGS_STORAGE_KEY);
    const x = GAME_WIDTH - 170;
    const y = 32;

    const handle = createOrnateButton(
      this,
      x,
      y,
      260,
      44,
      "",
      () => {
        settings = { animationSpeed: nextAnimationSpeed(settings.animationSpeed) };
        saveSettings(window.localStorage, SETTINGS_STORAGE_KEY, settings);
        refresh();
      },
      { variant: "tool", depth: 20 },
    );

    const refresh = () => handle.setLabel(`Animation: ${ANIMATION_SPEED_LABELS[settings.animationSpeed]}`);
    refresh();
  }
}
