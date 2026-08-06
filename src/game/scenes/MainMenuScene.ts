import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, SETTINGS_STORAGE_KEY } from "../config";
import {
  loadSettings,
  saveSettings,
  nextAnimationSpeed,
  type AnimationSpeed,
} from "../systems/SettingsSystem";
import { firebaseReady } from "../cloud/firebaseApp";
import { initAuth, signInWithGoogle, signOutAndResetAnonymous, type AuthState } from "../cloud/AuthClient";

const ANIMATION_SPEED_LABELS: Record<AnimationSpeed, string> = {
  normal: "Normal",
  fast: "Fast",
  instant: "Instant (reduced motion)",
};

/**
 * MainMenuScene: a simple original title screen.
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
    this.cameras.main.setBackgroundColor("#0e0e14");

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, "FANTASY TOWER DEFENSE", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "56px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 60,
        "The complete five-wave MVP · working title",
        {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "22px",
          color: "#8a8aa0",
        },
      )
      .setOrigin(0.5);

    // A clickable Start button (a rectangle + label).
    const button = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 220, 64, 0x4caf72)
      .setInteractive({ useHandCursor: true });

    const buttonLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, "START", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "28px",
        color: "#0e0e14",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    button.on("pointerover", () => button.setFillStyle(0x66c98c));
    button.on("pointerout", () => button.setFillStyle(0x4caf72));
    button.on("pointerdown", () => this.scene.start("BattleScene"));

    // Keyboard shortcut: Enter or Space also starts.
    this.input.keyboard?.on("keydown-ENTER", () =>
      this.scene.start("BattleScene"),
    );
    this.input.keyboard?.on("keydown-SPACE", () =>
      this.scene.start("BattleScene"),
    );

    // Phase 11.1 (D-070/D-073): a SEPARATE entry point into the new freeform
    // party builder. Deliberately not a replacement for START above — that
    // button keeps using the original fixed 4-hero roster (Ash/Wren/Bram/
    // Mira) unchanged, so it stays safe for Kevin's still-open browser
    // checklist and the Phase 7 balance pass. Placed well below START with a
    // comfortable gap so neither button's hit area can ever overlap.
    const createPartyButton = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const createPartyLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130, "Create Party (new)", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);
    createPartyButton.on("pointerover", () => createPartyButton.setFillStyle(0x3a3a4a));
    createPartyButton.on("pointerout", () => createPartyButton.setFillStyle(0x2a2a3a));
    createPartyButton.on("pointerdown", () => this.scene.start("CharacterCreationScene"));
    createPartyLabel.setName("create-party-button-label");

    // Phase 11.5 (D-078): a third, independent entry point — a read-only
    // rules/spell/feat/equipment lookup index. Placed below Create Party
    // with the same gap discipline, so it can't overlap either button above.
    const compendiumButton = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 200, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const compendiumLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 200, "Compendium", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);
    compendiumButton.on("pointerover", () => compendiumButton.setFillStyle(0x3a3a4a));
    compendiumButton.on("pointerout", () => compendiumButton.setFillStyle(0x2a2a3a));
    compendiumButton.on("pointerdown", () => this.scene.start("CompendiumScene"));
    compendiumLabel.setName("compendium-button-label");

    // Phase 11.6 (D-079): a fourth, independent entry point — a read-only,
    // unlock-on-encounter enemy log. Same gap discipline as Compendium below
    // it, so it can't overlap any button above.
    const bestiaryButton = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 270, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const bestiaryLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 270, "Bestiary", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);
    bestiaryButton.on("pointerover", () => bestiaryButton.setFillStyle(0x3a3a4a));
    bestiaryButton.on("pointerout", () => bestiaryButton.setFillStyle(0x2a2a3a));
    bestiaryButton.on("pointerdown", () => this.scene.start("BestiaryScene"));
    bestiaryLabel.setName("bestiary-button-label");

    // Phase 11.8 (D-071): a fifth, independent entry point — boss-themed
    // campaigns assembled from 11.6's roster and 11.7's maps. Same gap
    // discipline as Bestiary above it, so it can't overlap any button above.
    const campaignsButton = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 340, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const campaignsLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 340, "Campaigns", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);
    campaignsButton.on("pointerover", () => campaignsButton.setFillStyle(0x3a3a4a));
    campaignsButton.on("pointerout", () => campaignsButton.setFillStyle(0x2a2a3a));
    campaignsButton.on("pointerdown", () => this.scene.start("CampaignSelectScene"));
    campaignsLabel.setName("campaigns-button-label");

    // Phase 11.9 (D-071): a sixth, independent entry point — free-play mode's
    // configurable wave count/boss/minion source/map/difficulty. Same gap
    // discipline as Campaigns above it, so it can't overlap any button above.
    const freePlayButton = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 410, 260, 50, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const freePlayLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 410, "Free Play", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);
    freePlayButton.on("pointerover", () => freePlayButton.setFillStyle(0x3a3a4a));
    freePlayButton.on("pointerout", () => freePlayButton.setFillStyle(0x2a2a3a));
    freePlayButton.on("pointerdown", () => this.scene.start("FreePlayScene"));
    freePlayLabel.setName("free-play-button-label");

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 52,
        "Move your heroes, spend gold to Build walls & traps, and survive five waves.\n" +
          "Don't let the enemies breach your Stronghold. Click START or press Enter.",
        {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "18px",
          color: "#6a6a80",
          align: "center",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);

    // Keep a reference so linters see buttonLabel as used.
    buttonLabel.setName("start-button-label");

    this.buildSettingsControl();
    this.buildLoadGameButton();
    this.buildAccountControl();
    this.buildMapBuilderButton();
    this.buildBrowseSharedMapsButton();
    this.buildCoopButton();
  }

  /**
   * Phase 12.2 (D-102): top-right corner, one slot below Browse Shared Maps
   * (same x, y=182 continuing that column's 50px spacing). Rendered ONLY
   * when `firebaseReady` — same "nothing to do without a Firebase project"
   * reasoning as Browse Shared Maps above it. Leads to `CoopLobbyScene`
   * (create-or-join a session by code) — no battle integration yet, see
   * that scene's own header comment.
   */
  private buildCoopButton(): void {
    if (!firebaseReady) return;

    const x = GAME_WIDTH - 170;
    const y = 182;

    const button = this.add
      .rectangle(x, y, 260, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, "Co-op", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);

    button.on("pointerover", () => button.setFillStyle(0x3a3a4a));
    button.on("pointerout", () => button.setFillStyle(0x2a2a3a));
    button.on("pointerdown", () => this.scene.start("CoopLobbyScene"));
    label.setName("coop-button-label");
  }

  /**
   * Phase 11.10 (D-085): top-right corner, mirroring the top-left Load
   * Game/Account pair (y=32/y=82) — the vertical button column is already
   * at capacity (a 7th slot there would collide with the bottom instructions
   * text, see `buildLoadGameButton`'s own comment). Always rendered: unlike
   * Publish inside the scene itself, building/playtesting a map needs no
   * Firebase at all (no free-text input exists anywhere in this project —
   * every "name" is a cycle-through-a-preset-pool button — so nothing here
   * depends on the cloud either).
   */
  private buildMapBuilderButton(): void {
    const x = GAME_WIDTH - 170;
    const y = 82;

    const button = this.add
      .rectangle(x, y, 260, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, "Map Builder", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);

    button.on("pointerover", () => button.setFillStyle(0x3a3a4a));
    button.on("pointerout", () => button.setFillStyle(0x2a2a3a));
    button.on("pointerdown", () => this.scene.start("MapBuilderScene"));
    label.setName("map-builder-button-label");
  }

  /**
   * Phase 11.10 (D-085): top-right corner, one slot below Map Builder.
   * Rendered ONLY when `firebaseReady` — with no Firebase project
   * configured there is nothing to browse, matching the Account control's
   * own "don't render an always-empty/always-disabled control" precedent.
   */
  private buildBrowseSharedMapsButton(): void {
    if (!firebaseReady) return;

    const x = GAME_WIDTH - 170;
    const y = 132;

    const button = this.add
      .rectangle(x, y, 260, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, "Browse Shared Maps", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);

    button.on("pointerover", () => button.setFillStyle(0x3a3a4a));
    button.on("pointerout", () => button.setFillStyle(0x2a2a3a));
    button.on("pointerdown", () => this.scene.start("BrowseSharedMapsScene"));
    label.setName("browse-shared-maps-button-label");
  }

  /**
   * Phase 10 (D-084): a small account control directly under the top-left
   * "Load Game" button (12-52 -> this at 62-102, matching that button's own
   * bounding-box discipline). Rendered ONLY when `firebaseReady` — with no
   * Firebase project configured, there's nothing for this control to do,
   * so it simply doesn't appear rather than showing a permanently-disabled
   * button (the "local-first fallback" this phase's acceptance criteria
   * asks for, made visible rather than just a silent no-op).
   *
   * Every session is anonymous by default (see `AuthClient.initAuth`) —
   * this button's only job is the OPTIONAL upgrade to a real Google
   * identity, so cloud saves can follow the player across devices.
   */
  private buildAccountControl(): void {
    if (!firebaseReady) return;

    const x = 170;
    const y = 82;
    let state: AuthState = { uid: null, isAnonymous: true, displayName: null };

    const button = this.add
      .rectangle(x, y, 260, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, "Connecting…", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);

    const refresh = () => {
      label.setText(
        !state.isAnonymous
          ? `Signed in: ${state.displayName ?? "Google"} (tap to sign out)`
          : "Sign in with Google",
      );
    };

    button.on("pointerover", () => button.setFillStyle(0x3a3a4a));
    button.on("pointerout", () => button.setFillStyle(0x2a2a3a));
    button.on("pointerdown", () => {
      const action = !state.isAnonymous ? signOutAndResetAnonymous() : signInWithGoogle();
      action.catch((err) => console.error("Account action failed:", err));
    });

    initAuth((next) => {
      state = next;
      refresh();
    });
    label.setName("account-button-label");
  }

  /**
   * Phase 9 (D-083): a top-left mirror of the top-right Settings control
   * (same y=32, same height) rather than a 7th entry in the vertical button
   * column — that column already sits close to the bottom instructions text
   * (a would-be 7th button at `GAME_HEIGHT/2 + 480 = 1020` would overlap the
   * instructions block, which spans roughly y=1007-1049), so this avoids
   * that bounding-box conflict entirely instead of re-spacing the whole
   * column.
   */
  private buildLoadGameButton(): void {
    const x = 170;
    const y = 32;

    const button = this.add
      .rectangle(x, y, 260, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, "Load Game", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);

    button.on("pointerover", () => button.setFillStyle(0x3a3a4a));
    button.on("pointerout", () => button.setFillStyle(0x2a2a3a));
    button.on("pointerdown", () => this.scene.start("LoadGameScene"));
    label.setName("load-game-button-label");
  }

  /**
   * Phase 8: a single settings control, top-right corner, well clear of the
   * centered title/button/instructions. Cycles the one setting the game has
   * (animation speed, which doubles as "reduced motion" at its "instant"
   * step) and persists the choice to localStorage — BattleScene reads the
   * same key on its own `create()`, so a change here takes effect next battle.
   */
  private buildSettingsControl(): void {
    let settings = loadSettings(window.localStorage, SETTINGS_STORAGE_KEY);
    const x = GAME_WIDTH - 170;
    const y = 32;

    const button = this.add
      .rectangle(x, y, 260, 40, 0x2a2a3a)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#c8c8d8",
      })
      .setOrigin(0.5);

    const refresh = () => label.setText(`Animation: ${ANIMATION_SPEED_LABELS[settings.animationSpeed]}`);
    refresh();

    button.on("pointerover", () => button.setFillStyle(0x3a3a4a));
    button.on("pointerout", () => button.setFillStyle(0x2a2a3a));
    button.on("pointerdown", () => {
      settings = { animationSpeed: nextAnimationSpeed(settings.animationSpeed) };
      saveSettings(window.localStorage, SETTINGS_STORAGE_KEY, settings);
      refresh();
    });
  }
}
