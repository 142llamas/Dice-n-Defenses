import Phaser from "phaser";
import { COLORS } from "../config";
import { firebaseReady } from "../cloud/firebaseApp";
import { initAuth, signInWithGoogle, signOutAndResetAnonymous, type AuthState } from "../cloud/AuthClient";
import { computeCornerControlsRegion } from "../systems/mainMenuLayout";
import {
  createOrnateButton,
  centeredRowX,
  drawScreenBackdrop,
  spawnAmbientMotes,
  createSectionLabel,
  getViewport,
  onViewportResize,
  FONT_DISPLAY,
  FONT_BODY,
  type OrnateButtonHandle,
} from "./uiTheme";

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
 *
 * Phase 1 of the 2026-08-28 playtest batch: reorganized again per Kevin's
 * own proposed grouping (Campaign / Free Play / Co-op / Party Creation /
 * Knowledge Base / the 3 creator tools). Campaign is now the hero primary
 * action (bigger than a blank Free Play or Party Creation build — 6 regions,
 * 24 chapters, companions, a capstone), replacing the old "New Game" button;
 * "New Game" and "Build Party" both started `CharacterCreationScene` with no
 * init data (the exact same destination), so they're consolidated into one
 * "Party Creation" button rather than kept as two labels for one screen.
 * Campaign and Free Play now route through `ModeEntryScene`'s New/Load fork
 * instead of jumping straight to `CampaignSelectScene`/`FreePlayScene`, and
 * the standalone top-level "Load Game" button is retired since both modes'
 * own Load option now covers it. Compendium/Bestiary collapse into one
 * "Knowledge Base" button opening `KnowledgeBaseScene`. Settings and Sign-in
 * were already present as this screen's top-right corner controls before
 * this pass; unchanged here.
 */
export class MainMenuScene extends Phaser.Scene {
  private layoutRoot?: Phaser.GameObjects.Container;
  private authState: AuthState = { uid: null, isAnonymous: true, displayName: null };
  private authResolved = false;
  private accountButtonHandle?: OrnateButtonHandle;

  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    // D-16x: re-syncs the ScaleManager's tracked size against the real
    // canvas/parent element on every entry to Main Menu — a targeted
    // mitigation for a reported bug (a horizontal-only squish that appears
    // after exiting a battle and persists across every later screen) whose
    // exact mechanism couldn't be confirmed by reading the code alone (no
    // scale-mode-swap/setGameSize/canvas.style code exists anywhere in this
    // codebase to point at directly). Cheap and harmless if the scale state
    // was already correct.
    this.scale.refresh();

    // D-154: `initAuth` must only ever subscribe once per scene lifetime —
    // `rebuildLayout()` (below) recreates the Account button on every
    // resize, so its label refresh reads the live `this.authState`/
    // `this.authResolved` fields instead of re-subscribing a fresh closure
    // each time.
    if (firebaseReady) {
      initAuth((next) => {
        this.authState = next;
        this.authResolved = true;
        this.refreshAccountLabel();
      });
    }

    this.rebuildLayout();

    // Keyboard shortcut: Enter or Space also triggers the primary action (Campaign).
    this.input.keyboard?.on("keydown-ENTER", () => this.scene.start("ModeEntryScene", { mode: "campaign" }));
    this.input.keyboard?.on("keydown-SPACE", () => this.scene.start("ModeEntryScene", { mode: "campaign" }));

    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds the whole menu against the scene's live viewport size.
  // Reuses every buildX() method's existing positioning code verbatim by
  // snapshotting the scene's display list before/after and reparenting
  // whatever got added into a single destroy-and-recreate container —
  // simpler and less error-prone than hand-editing each `this.add` call
  // site to explicitly target a container.
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);

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
    this.buildExitControl();
    this.buildSettingsControl();
    this.buildAccountControl();

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);
  }

  private accountLabel(): string {
    if (!this.authResolved) return "Connecting…";
    return !this.authState.isAnonymous
      ? `Signed in: ${this.authState.displayName ?? "Google"} (tap to sign out)`
      : "Sign in with Google";
  }

  private refreshAccountLabel(): void {
    // D-217 (item 7): the account control is icon-only now — the dynamic
    // sign-in/sign-out text lives in its hover tooltip, not on-button text.
    this.accountButtonHandle?.setTooltip(this.accountLabel());
  }

  private buildTitle(): void {
    const { width } = getViewport(this);
    const cx = width / 2;

    const titleText = this.add
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

    // Confirmed bug (Kevin, 2026-08-21): at its full size the title's real
    // rendered width can reach into the top-right Settings/Account corner
    // controls' bounding box. Rather than guess a fixed font size that
    // happens to clear whatever font actually loads, measure the real
    // bounds (same approach `uiTheme.fitLabelToWidth` already uses for
    // buttons) and shrink until they no longer overlap. D-154: the region
    // itself is now computed from the live viewport width (`
    // computeCornerControlsRegion`, unit-tested in
    // `tests/mainMenuLayout.test.ts`) instead of a fixed-1280-canvas magic
    // rectangle, so this still holds if the corner controls ever move with
    // the canvas.
    const region = computeCornerControlsRegion(width);
    const cornerControlsRegion = new Phaser.Geom.Rectangle(region.x, region.y, region.width, region.height);
    let titleFontSize = 58;
    while (
      titleFontSize > 40 &&
      Phaser.Geom.Rectangle.Overlaps(titleText.getBounds(), cornerControlsRegion)
    ) {
      titleFontSize -= 2;
      titleText.setFontSize(titleFontSize);
    }

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
    const cx = getViewport(this).width / 2;
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
      getViewport(this).width / 2,
      280,
      380,
      76,
      "Campaign",
      () => this.scene.start("ModeEntryScene", { mode: "campaign" }),
      { variant: "primary", sublabel: "Six regions, twenty-four chapters, a capstone finale", depth: 5 },
    );
  }

  /**
   * Every other way to actually get into a battle: Campaign (above) is the
   * hero action, these are the alternates. "Party Creation" consolidates
   * the old "New Game" and "Build Party" buttons, which both started
   * `CharacterCreationScene` with no init data — the exact same screen —
   * into one honestly-labeled entry point (still lets a player Save Party
   * and Back out without ever pressing Start Battle).
   */
  private buildJourneyRow(): void {
    const cx = getViewport(this).width / 2;
    createSectionLabel(this, cx, 366, "◆ Continue Your Journey ◆", 5);

    const entries: { label: string; onClick: () => void }[] = [
      { label: "Free Play", onClick: () => this.scene.start("ModeEntryScene", { mode: "freeplay" }) },
    ];
    if (firebaseReady) entries.push({ label: "Co-op", onClick: () => this.scene.start("CoopLobbyScene") });
    entries.push({ label: "Party Creation", onClick: () => this.scene.start("CharacterCreationScene") });

    const width = 220;
    const { xs, itemWidth } = centeredRowX(entries.length, width, 20, cx, getViewport(this).width - 80);
    entries.forEach((entry, i) => {
      createOrnateButton(this, xs[i], 412, itemWidth, 58, entry.label, entry.onClick, {
        variant: "secondary",
        depth: 5,
      });
    });
  }

  /** Read-only reference screens — deliberately its own group, not mixed in with ways to start a battle. */
  private buildReferenceRow(): void {
    const cx = getViewport(this).width / 2;
    createSectionLabel(this, cx, 500, "◆ Know Your Foe ◆", 5);

    createOrnateButton(this, cx, 546, 260, 58, "Knowledge Base", () => this.scene.start("KnowledgeBaseScene"), {
      variant: "secondary",
      depth: 5,
    });
  }

  /** Map Builder/Browse Shared Maps — smaller and visually quieter, since these are creator tools, not the main loop. */
  private buildToolsRow(): void {
    const cx = getViewport(this).width / 2;
    const y = 620;
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, COLORS.bronzeDark, 0.7);
    g.lineBetween(cx - 220, y, cx + 220, y);

    createSectionLabel(this, cx, y + 36, "Creator Tools", 5);

    const entries: { label: string; onClick: () => void }[] = [
      { label: "Map Builder", onClick: () => this.scene.start("MapBuilderScene") },
      { label: "Test Mode", onClick: () => this.scene.start("TestModeScene") },
    ];
    if (firebaseReady) {
      entries.push({ label: "Browse Shared Maps", onClick: () => this.scene.start("BrowseSharedMapsScene") });
    }
    const width = 220;
    const { xs, itemWidth } = centeredRowX(entries.length, width, 20, cx, getViewport(this).width - 80);
    entries.forEach((entry, i) => {
      createOrnateButton(this, xs[i], y + 76, itemWidth, 46, entry.label, entry.onClick, {
        variant: "tool",
        depth: 5,
      });
    });
  }

  private buildInstructions(): void {
    const { width, height } = getViewport(this);
    const cx = width / 2;
    const y = height - 66;
    this.add
      .text(
        cx,
        y,
        "Move your heroes, spend gold to Build walls & traps, and survive the waves.\n" +
          "Don't let the enemies breach your Stronghold. Click Campaign or press Enter.",
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
    const { width, height } = getViewport(this);
    this.add
      .text(width - 28, height - 20, "v0.2.0-dev", {
        fontFamily: FONT_BODY,
        fontSize: "12px",
        color: "#5a4a34",
      })
      .setOrigin(1)
      .setDepth(1);
  }

  /**
   * D-151: KI-098's "add an Exit Game control" — mirrors the version tag's
   * bottom corner on the opposite side, well clear of every other row.
   *
   * A page's own script cannot force-close a tab/window the BROWSER opened
   * (only one it opened itself via `window.open`, or a future desktop/PWA
   * wrapper) — `window.close()` silently no-ops in the overwhelmingly common
   * case of a normal browser tab. Rather than ship a button that looks
   * broken (click, nothing visibly happens), this still attempts it (so it
   * DOES work in whichever context actually allows it) and then always
   * swaps in an honest fallback message, so the click reliably does
   * something either way.
   */
  private buildExitControl(): void {
    // D-16x: was `height - 40` (only 4px clear of `drawScreenBackdrop`'s
    // frame border on hover) — real clearance now.
    // D-217 (item 7): shrunk to a 44x44 icon button, matching Settings/
    // Account — its full explanation moved to the hover tooltip.
    const handle = createOrnateButton(this, 94, getViewport(this).height - 56, 44, 44, "", () => {
      window.close();
      handle.setTooltip("You may now close this tab");
      handle.setDisabled(true);
    }, { variant: "tool", depth: 5, icon: drawExitIcon, tooltip: "Exit Game" });
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

    const x = getViewport(this).width - 62;
    const y = 104; // D-16x: was 88 — shifted down to match Settings clearing the frame border

    // D-154: shows "Connecting…" only until the FIRST auth callback ever
    // resolves (`this.authResolved`), matching this project's original
    // first-render behavior — a later rebuild (e.g. from a resize) after
    // the real state is already known shows it immediately instead of
    // flashing back to "Connecting…" every time.
    // D-217 (item 7): shrunk to a 44x44 icon button — the dynamic sign-in/
    // sign-out label now lives in the hover tooltip instead of on-button
    // text (see `refreshAccountLabel`, which calls `setTooltip` now).
    this.accountButtonHandle = createOrnateButton(
      this,
      x,
      y,
      44,
      44,
      "",
      () => {
        const action = !this.authState.isAnonymous ? signOutAndResetAnonymous() : signInWithGoogle();
        action.catch((err) => console.error("Account action failed:", err));
      },
      { variant: "tool", depth: 20, icon: drawPersonIcon, tooltip: this.accountLabel() },
    );
  }

  /**
   * Phase 8, top-right corner. Used to be a single button that cycled Game
   * Speed directly; D-153 moved every setting (Game Speed plus the new
   * Master/Music/SFX volume + Mute controls, KI-105) onto its own
   * `SettingsScene` instead of growing this corner into a row of cycle
   * buttons — this button just opens it (standalone mode: no live
   * `BattleScene` to hand it, so Game Speed there reads/writes localStorage
   * directly, same as before).
   */
  private buildSettingsControl(): void {
    const x = getViewport(this).width - 62;
    const y = 48; // D-16x: was 32 — its top edge (10) sat above drawScreenBackdrop's frame line (18), a real overlap

    // D-217 (item 7): shrunk to a 44x44 icon button, full label moved to tooltip.
    createOrnateButton(
      this,
      x,
      y,
      44,
      44,
      "",
      () => this.scene.start("SettingsScene", { returnScene: "MainMenuScene" }),
      { variant: "tool", depth: 20, icon: drawGearIcon, tooltip: "Settings" },
    );
  }
}

/**
 * D-217 (item 7): placeholder icon glyphs for the Settings/Account/Exit
 * corner controls — Kevin has no real icon art yet and said appearance
 * doesn't matter for now ("just placeholders"), so these are hand-drawn
 * `Graphics` shapes, same "real drawing code stands in for real art"
 * treatment `buildCrest`'s tower-and-shield emblem already uses. Swap these
 * out for real image-based icons once art is supplied — nothing else about
 * `createOrnateButton`'s `icon` option needs to change to support that later.
 */
function drawGearIcon(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const outerR = size / 2;
  const innerR = outerR * 0.42;
  const teeth = 8;
  const toothDepth = outerR * 0.26;
  g.fillStyle(color, 1);
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (Math.PI * i) / teeth;
    const r = i % 2 === 0 ? outerR : outerR - toothDepth;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
  g.fillStyle(COLORS.woodPanel, 1);
  g.fillCircle(0, 0, innerR);
}

function drawPersonIcon(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(0, -size * 0.22, size * 0.18);
  g.beginPath();
  g.moveTo(-size * 0.28, size * 0.32);
  g.lineTo(size * 0.28, size * 0.32);
  g.lineTo(size * 0.16, -size * 0.02);
  g.lineTo(-size * 0.16, -size * 0.02);
  g.closePath();
  g.fillPath();
}

function drawExitIcon(g: Phaser.GameObjects.Graphics, size: number, color: number): void {
  const w = size * 0.5;
  const h = size * 0.82;
  const frameX = -size * 0.12;
  g.lineStyle(Math.max(2, size * 0.07), color, 1);
  g.strokeRect(frameX - w / 2, -h / 2, w, h);
  const arrowStartX = frameX + w / 2 - size * 0.06;
  const arrowTipX = size * 0.34;
  g.lineBetween(arrowStartX, 0, arrowTipX, 0);
  g.lineBetween(arrowTipX, 0, arrowTipX - size * 0.14, -size * 0.14);
  g.lineBetween(arrowTipX, 0, arrowTipX - size * 0.14, size * 0.14);
}
