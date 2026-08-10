import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";

/**
 * uiTheme — a shared fantasy/parchment presentation kit for Main Menu,
 * Compendium, and Bestiary (D-123). Kevin asked to "spruce up" the game's
 * visuals with a real, on-brand fantasy look, starting with these three
 * screens, with the explicit intent to carry the same branding through the
 * rest of the game later — so this lives as its own scene-agnostic module
 * (same "shared renderer, not duplicated per scene" precedent as
 * `dialogueBox.ts`) rather than being hand-rolled again inside each scene.
 *
 * Phaser-dependent presentation code, deliberately NOT in `systems/` — no
 * game rule lives here, only drawing.
 *
 * Two Google Fonts (Cinzel for display/headline text, EB Garamond for body/
 * button text — both SIL Open Font License 1.1, see `CONTENT_SOURCES.md`)
 * are loaded via a `<link>` in `index.html`. Every font-family string here
 * lists real system serif fallbacks first-choice-after, so a page that opens
 * offline (no CDN reachable) still renders a readable serif, not a jarring
 * sans-serif mismatch.
 */

export const FONT_DISPLAY = '"Cinzel", Georgia, "Times New Roman", serif';
export const FONT_BODY = '"EB Garamond", Georgia, "Times New Roman", serif';

type ButtonVariant = "primary" | "secondary" | "tool" | "tab";

export interface OrnateButtonOptions {
  fontSize?: number;
  font?: string;
  depth?: number;
  variant?: ButtonVariant;
  sublabel?: string;
  disabled?: boolean;
}

export interface OrnateButtonHandle {
  container: Phaser.GameObjects.Container;
  setLabel(text: string): void;
  setSelected(selected: boolean): void;
  setDisabled(disabled: boolean): void;
  destroy(): void;
}

const VARIANT_SIZE: Record<ButtonVariant, { radius: number; fontSize: number }> = {
  primary: { radius: 14, fontSize: 24 },
  secondary: { radius: 10, fontSize: 18 },
  tool: { radius: 8, fontSize: 14 },
  tab: { radius: 6, fontSize: 13 },
};

/**
 * A carved-wood-and-bronze plaque button: idle/hover/pressed/disabled/
 * selected states, a soft press "click" tween, and a hover brighten+lift
 * tween. One shared implementation for every button in the three restyled
 * screens (previously each scene hand-rolled its own plain
 * `add.rectangle().setStrokeStyle()` button with no hover/click feedback at
 * all — the exact flatness Kevin flagged).
 */
export function createOrnateButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  opts: OrnateButtonOptions = {},
): OrnateButtonHandle {
  const variant = opts.variant ?? "secondary";
  const sizing = VARIANT_SIZE[variant];
  const fontSize = opts.fontSize ?? sizing.fontSize;
  const font = opts.font ?? (variant === "primary" ? FONT_DISPLAY : FONT_BODY);
  const depth = opts.depth ?? 10;

  const container = scene.add.container(x, y).setDepth(depth);
  const g = scene.add.graphics();
  const text = scene.add
    .text(0, opts.sublabel ? -8 : 0, label, {
      fontFamily: font,
      fontSize: `${fontSize}px`,
      color: "#f0e6c8",
      fontStyle: variant === "tab" ? "normal" : "bold",
      align: "center",
    })
    .setOrigin(0.5);
  container.add([g, text]);

  let sub: Phaser.GameObjects.Text | undefined;
  if (opts.sublabel) {
    sub = scene.add
      .text(0, 15, opts.sublabel, {
        fontFamily: FONT_BODY,
        fontSize: "12px",
        color: "#a89058",
      })
      .setOrigin(0.5);
    container.add(sub);
  }

  let hovered = false;
  let disabled = opts.disabled ?? false;
  let selected = false;

  const draw = (): void => {
    g.clear();
    const w = width;
    const h = height;
    const r = sizing.radius;

    if (disabled) {
      g.fillStyle(COLORS.woodPanelDisabled, 1);
    } else if (selected) {
      g.fillStyle(COLORS.woodPanelHover, 1);
    } else if (hovered) {
      g.fillStyle(COLORS.woodPanelHover, 1);
    } else {
      g.fillStyle(COLORS.woodPanel, 1);
    }
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    const borderColor = disabled ? COLORS.bronzeDark : selected || hovered ? COLORS.gilt : COLORS.bronze;
    g.lineStyle(2, borderColor, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(1, COLORS.bronzeDark, 0.7);
    g.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, Math.max(2, r - 4));

    // Small corner "caps" — a cheap ornamental touch distinguishing this
    // from a plain rectangle, cheaper than a real corner-flourish asset.
    if (variant !== "tab" && w > 90) {
      const capColor = disabled ? COLORS.bronzeDark : COLORS.gilt;
      drawDiamond(g, -w / 2 + 12, 0, 3.5, capColor);
      drawDiamond(g, w / 2 - 12, 0, 3.5, capColor);
    }
  };
  draw();

  text.setColor(disabled ? "#7a6a4a" : selected || hovered ? "#fff3d0" : "#f0e6c8");
  sub?.setColor(disabled ? "#5a4a34" : "#a89058");

  const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
  g.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

  const refreshTextColor = (): void => {
    text.setColor(disabled ? "#7a6a4a" : selected || hovered ? "#fff3d0" : "#f0e6c8");
  };

  g.on("pointerover", () => {
    if (disabled) return;
    hovered = true;
    draw();
    refreshTextColor();
    scene.tweens.add({ targets: container, scale: 1.035, duration: 130, ease: "Sine.easeOut" });
  });
  g.on("pointerout", () => {
    if (disabled) return;
    hovered = false;
    draw();
    refreshTextColor();
    scene.tweens.add({ targets: container, scale: 1, duration: 130, ease: "Sine.easeOut" });
  });
  g.on("pointerdown", () => {
    if (disabled) return;
    scene.tweens.add({ targets: container, scale: 0.955, duration: 60, ease: "Sine.easeOut", yoyo: true });
    onClick();
  });

  if (disabled) g.disableInteractive();

  return {
    container,
    setLabel: (t: string) => text.setText(t),
    setSelected: (s: boolean) => {
      selected = s;
      draw();
      refreshTextColor();
    },
    setDisabled: (d: boolean) => {
      disabled = d;
      if (d) g.disableInteractive();
      else g.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
      draw();
      refreshTextColor();
    },
    destroy: () => container.destroy(),
  };
}

function drawDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
  g.fillPath();
}

/**
 * Evenly-centered x positions for `count` same-width items around `centerX`
 * — the exact centering arithmetic `CompendiumScene` already hand-rolled
 * per-selector (`buildClassSelector`, `buildSpellLevelSelector`, `buildTabs`);
 * pulled out here so every restyled row (including MainMenuScene's new
 * grouped rows, which didn't have this at all before) shares one formula.
 */
export function centeredRowX(count: number, itemWidth: number, gap: number, centerX: number): number[] {
  const totalWidth = count * itemWidth + (count - 1) * gap;
  const startX = centerX - totalWidth / 2 + itemWidth / 2;
  return Array.from({ length: count }, (_, i) => startX + i * (itemWidth + gap));
}

/**
 * The full-screen backdrop shared by all three restyled screens: a vertical
 * wood/stone gradient, a soft vignette, and a double gold/bronze frame with
 * corner diamonds — replaces the previous flat `setBackgroundColor("#0e0e14")`
 * every menu-adjacent scene used. Drawn once at a low depth; callers add
 * their own content on top.
 */
export function drawScreenBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(-10);
  g.fillGradientStyle(COLORS.menuBgNear, COLORS.menuBgNear, COLORS.menuBgFar, COLORS.menuBgFar, 1, 1, 1, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Vignette: darken the four corners without an image asset — four soft
  // radial-ish blots via low-alpha filled circles, same "deterministic
  // blotch" technique the parchment panel already established.
  g.fillStyle(COLORS.menuVignette, 0.35);
  const corners: [number, number][] = [
    [0, 0],
    [GAME_WIDTH, 0],
    [0, GAME_HEIGHT],
    [GAME_WIDTH, GAME_HEIGHT],
  ];
  for (const [cx, cy] of corners) g.fillCircle(cx, cy, GAME_WIDTH * 0.42);

  // An inset double frame with corner diamonds — the "carved border" look
  // an ornate menu screen needs, cheap to draw, no asset required.
  const margin = 18;
  g.lineStyle(3, COLORS.bronze, 0.9);
  g.strokeRect(margin, margin, GAME_WIDTH - margin * 2, GAME_HEIGHT - margin * 2);
  g.lineStyle(1, COLORS.bronzeDark, 0.8);
  g.strokeRect(margin + 8, margin + 8, GAME_WIDTH - (margin + 8) * 2, GAME_HEIGHT - (margin + 8) * 2);
  for (const [cx, cy] of corners) {
    const dx = cx === 0 ? margin + 8 : -margin - 8;
    const dy = cy === 0 ? margin + 8 : -margin - 8;
    drawDiamond(g, cx + dx, cy + dy, 7, COLORS.gilt);
  }
  return g;
}

/** A small drifting-ember/dust-mote ambience layer — cheap atmosphere, no image asset. Deterministic starting positions (this project's stated preference over per-run randomness for anything visual). */
export function spawnAmbientMotes(scene: Phaser.Scene, count = 16): Phaser.GameObjects.GameObject[] {
  const motes: Phaser.GameObjects.GameObject[] = [];
  for (let i = 0; i < count; i++) {
    // A fixed, spread-out deterministic layout (golden-angle placement) —
    // looks organically scattered without calling RandomService (a gameplay
    // system this purely-cosmetic loop has no business touching).
    const angle = i * 137.5;
    const x = (Math.abs(Math.sin(angle)) * GAME_WIDTH * 0.94 + GAME_WIDTH * 0.03) % GAME_WIDTH;
    const y = GAME_HEIGHT - ((i * 97) % GAME_HEIGHT);
    const size = 1.5 + (i % 4) * 0.6;
    const dot = scene.add.circle(x, y, size, COLORS.gilt, 0.35 + (i % 3) * 0.1).setDepth(-5);
    motes.push(dot);
    scene.tweens.add({
      targets: dot,
      y: y - (140 + (i % 5) * 40),
      alpha: 0,
      duration: 7000 + (i % 6) * 900,
      delay: (i * 260) % 4000,
      repeat: -1,
      ease: "Sine.easeInOut",
      onRepeat: () => {
        dot.y = GAME_HEIGHT + 20;
        dot.setAlpha(0.35 + (i % 3) * 0.1);
      },
    });
  }
  return motes;
}

/**
 * A small-caps-styled section label with flanking flourish lines — used to
 * group buttons into named clusters (e.g. "Continue Your Journey") instead
 * of one undifferentiated vertical stack of identical buttons.
 */
export function createSectionLabel(scene: Phaser.Scene, x: number, y: number, text: string, depth = 10): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text.toUpperCase(), {
      fontFamily: FONT_BODY,
      fontSize: "15px",
      color: "#a89058",
      fontStyle: "italic",
      letterSpacing: 2 as unknown as number,
    })
    .setOrigin(0.5)
    .setDepth(depth);
}

/**
 * A raised parchment panel (base fill + aged mottling + double border) —
 * the same drawing technique `dialogueBox.ts` established for the chapter
 * dialogue panel, generalized here for a plain rectangular content area
 * (Compendium's detail text, Bestiary's roster list) rather than a fixed
 * 900x280 dialogue box.
 */
export function drawParchmentPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  depth = 5,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const left = x - width / 2;
  const top = y - height / 2;
  const radius = 14;

  g.fillStyle(COLORS.parchmentBase, 1);
  g.fillRoundedRect(left, top, width, height, radius);

  g.fillStyle(COLORS.parchmentMottle, 0.18);
  g.fillEllipse(left + width * 0.15, top + height * 0.18, width * 0.22, height * 0.12);
  g.fillEllipse(left + width * 0.82, top + height * 0.72, width * 0.24, height * 0.14);
  g.fillEllipse(left + width * 0.5, top + height * 0.5, width * 0.3, height * 0.2);
  g.fillEllipse(left + width * 0.25, top + height * 0.85, width * 0.18, height * 0.1);

  g.lineStyle(4, COLORS.parchmentBorder, 1);
  g.strokeRoundedRect(left, top, width, height, radius);
  g.lineStyle(1, COLORS.parchmentBorder, 0.5);
  g.strokeRoundedRect(left + 9, top + 9, width - 18, height - 18, radius - 4);
  return g;
}
