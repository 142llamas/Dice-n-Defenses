import Phaser from "phaser";
import { GAME_WIDTH, COLORS } from "../config";

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
  /**
   * D-213: an optional hover tooltip — a short parchment card shown above
   * the button while the pointer is over it, hidden on pointerout. Added
   * for the cadence pill (its Auto/Prompt/Fresh options had zero in-UI
   * explanation), but scene-agnostic like the rest of this file so any
   * future button can use it without a one-off implementation.
   */
  tooltip?: string;
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

  // Playtest fix: `centeredRowX` shrinks the BOX to fit a crowded row (10+
  // Compendium tabs, 12 classes), but the label text itself never shrank to
  // match, so a normal-length label could still render wider than its own
  // now-narrower box and spill into its neighbors. Shrinks the font (down to
  // a readable floor) against the button's REAL measured text width, the
  // same "measure, don't guess" approach `BattleScene.fitBannerToWidth` uses.
  const labelPadding = 10;
  const minLabelFontSizePx = 9;
  const fitLabelToWidth = (): void => {
    text.setFontSize(fontSize);
    let size = fontSize;
    while (text.width > width - labelPadding && size > minLabelFontSizePx) {
      size -= 1;
      text.setFontSize(size);
    }
  };
  fitLabelToWidth();

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

  // D-213: a small parchment card floating just above the button, hidden
  // until hover — added last so it renders on top of this button's own
  // graphics/label within the container's own paint order.
  let tooltipBg: Phaser.GameObjects.Graphics | undefined;
  let tooltipText: Phaser.GameObjects.Text | undefined;
  if (opts.tooltip) {
    tooltipText = scene.add
      .text(0, 0, opts.tooltip, {
        fontFamily: FONT_BODY,
        fontSize: "13px",
        color: "#2a1a10",
        align: "center",
        wordWrap: { width: Math.max(180, width) },
      })
      .setOrigin(0.5, 1);
    const tw = tooltipText.width + 16;
    const th = tooltipText.height + 12;
    tooltipText.setPosition(0, -height / 2 - 10);
    tooltipBg = scene.add.graphics();
    tooltipBg.fillStyle(COLORS.parchmentBase, 0.98);
    tooltipBg.lineStyle(1, COLORS.parchmentBorder, 1);
    tooltipBg.fillRoundedRect(-tw / 2, -height / 2 - 10 - th, tw, th, 6);
    tooltipBg.strokeRoundedRect(-tw / 2, -height / 2 - 10 - th, tw, th, 6);
    tooltipBg.setVisible(false);
    tooltipText.setVisible(false);
    container.add([tooltipBg, tooltipText]);
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
    if (tooltipBg && tooltipText) {
      tooltipBg.setVisible(true);
      tooltipText.setVisible(true);
      container.setDepth(depth + 100);
    }
  });
  g.on("pointerout", () => {
    if (disabled) return;
    hovered = false;
    draw();
    refreshTextColor();
    scene.tweens.add({ targets: container, scale: 1, duration: 130, ease: "Sine.easeOut" });
    if (tooltipBg && tooltipText) {
      tooltipBg.setVisible(false);
      tooltipText.setVisible(false);
      container.setDepth(depth);
    }
  });
  g.on("pointerdown", () => {
    if (disabled) return;
    scene.tweens.add({ targets: container, scale: 0.955, duration: 60, ease: "Sine.easeOut", yoyo: true });
    onClick();
  });

  if (disabled) g.disableInteractive();

  return {
    container,
    setLabel: (t: string) => {
      text.setText(t);
      fitLabelToWidth();
    },
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
 *
 * Playtest fix: this used to return positions for the REQUESTED itemWidth
 * unconditionally, so a row sized for a smaller roster silently ran off both
 * edges of the canvas once the underlying data grew (12 Compendium classes
 * at 138px each, 10 category tabs at 138px each — both well past 1280px
 * wide). `maxWidth` (callers pass canvas width minus a 40px margin each
 * side) shrinks every item evenly to fit instead; callers use the returned
 * `itemWidth` to size their button/box so the drawn box always matches the
 * positions actually used.
 *
 * D-157: this function has no `scene` parameter, so its `maxWidth` default
 * can't read a live viewport — every call site now passes an explicit
 * `maxWidth` derived from its own already-in-scope live width instead of
 * relying on a default. The parameter (and its old `GAME_WIDTH`-derived
 * default) stays for now as a documented fallback, not because anything
 * still uses it.
 */
export function centeredRowX(
  count: number,
  itemWidth: number,
  gap: number,
  centerX: number,
  maxWidth: number = GAME_WIDTH - 80,
): { xs: number[]; itemWidth: number } {
  let w = itemWidth;
  if (count > 0) {
    const requestedWidth = count * w + (count - 1) * gap;
    if (requestedWidth > maxWidth) {
      w = Math.max(1, (maxWidth - (count - 1) * gap) / count);
    }
  }
  const totalWidth = count * w + (count - 1) * gap;
  const startX = centerX - totalWidth / 2 + w / 2;
  const xs = Array.from({ length: count }, (_, i) => startX + i * (w + gap));
  return { xs, itemWidth: w };
}

/**
 * The full-screen backdrop shared by all three restyled screens: a vertical
 * wood/stone gradient, a soft vignette, and a double gold/bronze frame with
 * corner diamonds — replaces the previous flat `setBackgroundColor("#0e0e14")`
 * every menu-adjacent scene used. Drawn once at a low depth; callers add
 * their own content on top.
 *
 * D-157: reads the scene's live `scale.width`/`scale.height` instead of the
 * fixed `GAME_WIDTH`/`GAME_HEIGHT` constants — under the old `Scale.FIT`
 * these were always numerically identical, so this was a no-op change in
 * behavior; under the new `Scale.RESIZE` cutover the real canvas size can
 * now differ, and every caller already redraws this from scratch inside its
 * own resize-triggered `rebuildLayout()`, so this alone makes the backdrop
 * fill the true live canvas on every resize with no caller changes needed.
 */
export function drawScreenBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const { width, height } = scene.scale;
  const g = scene.add.graphics().setDepth(-10);
  g.fillGradientStyle(COLORS.menuBgNear, COLORS.menuBgNear, COLORS.menuBgFar, COLORS.menuBgFar, 1, 1, 1, 1);
  g.fillRect(0, 0, width, height);

  // Vignette: darken the four corners without an image asset — four soft
  // radial-ish blots via low-alpha filled circles, same "deterministic
  // blotch" technique the parchment panel already established.
  g.fillStyle(COLORS.menuVignette, 0.35);
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];
  for (const [cx, cy] of corners) g.fillCircle(cx, cy, width * 0.42);

  // An inset double frame with corner diamonds — the "carved border" look
  // an ornate menu screen needs, cheap to draw, no asset required.
  const margin = 18;
  g.lineStyle(3, COLORS.bronze, 0.9);
  g.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
  g.lineStyle(1, COLORS.bronzeDark, 0.8);
  g.strokeRect(margin + 8, margin + 8, width - (margin + 8) * 2, height - (margin + 8) * 2);
  for (const [cx, cy] of corners) {
    const dx = cx === 0 ? margin + 8 : -margin - 8;
    const dy = cy === 0 ? margin + 8 : -margin - 8;
    drawDiamond(g, cx + dx, cy + dy, 7, COLORS.gilt);
  }
  return g;
}

/**
 * A small drifting-ember/dust-mote ambience layer — cheap atmosphere, no
 * image asset. Deterministic starting positions (this project's stated
 * preference over per-run randomness for anything visual).
 *
 * D-157: same live-viewport fix as `drawScreenBackdrop` above — reads the
 * scene's real `scale.width`/`scale.height` instead of the fixed
 * `GAME_WIDTH`/`GAME_HEIGHT` constants, so motes spread across the whole
 * live canvas once `Scale.RESIZE` makes that differ from 1280x1080.
 */
export function spawnAmbientMotes(scene: Phaser.Scene, count = 16): Phaser.GameObjects.GameObject[] {
  const { width, height } = scene.scale;
  const motes: Phaser.GameObjects.GameObject[] = [];
  for (let i = 0; i < count; i++) {
    // A fixed, spread-out deterministic layout (golden-angle placement) —
    // looks organically scattered without calling RandomService (a gameplay
    // system this purely-cosmetic loop has no business touching).
    const angle = i * 137.5;
    const x = (Math.abs(Math.sin(angle)) * width * 0.94 + width * 0.03) % width;
    const y = height - ((i * 97) % height);
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
        dot.y = height + 20;
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
 * D-211: corrects a real, root-caused misalignment between Phaser's DOM
 * Element container (`game.domContainer`, used by every real HTML
 * `<input>` this project has — `CharacterCreationScene`'s 4 hero-name
 * fields, `CoopLobbyScene`'s join-code field) and the actual canvas.
 *
 * Phaser's own `ScaleManager.refresh()` keeps `domContainer` aligned with
 * the canvas by copying the CANVAS's own `style.marginLeft`/`marginTop`
 * onto it (`node_modules/phaser/src/scale/ScaleManager.js`) — this is how
 * Phaser's built-in `Scale.CENTER_BOTH`/etc. centers BOTH elements
 * together, since that centering itself works by setting the canvas's
 * margin. This project deliberately uses `autoCenter: NO_CENTER` instead
 * (see `main.ts`) and lets an external CSS flexbox (`#game-root` in
 * `index.html`) center the canvas — a real fix for a real double-centering
 * bug hit before. But flexbox centering never touches the canvas's margin
 * at all, so the value Phaser copies onto `domContainer` is always empty —
 * `domContainer` (an unpositioned `position: absolute` div with no
 * `top`/`left` of its own, per `CreateDOMContainer.js`) never tracks the
 * canvas's real, flex-computed position. The result is a CONSTANT
 * (non-drifting) offset, present from the very first frame — exactly what
 * Kevin's screenshot showed (the hero-name fields rendering up near the
 * subtitle instead of inside their column) and not the runtime-desync
 * theory an earlier version of this fix assumed.
 *
 * The fix measures both elements' REAL on-screen position directly
 * (`getBoundingClientRect()`, which forces a synchronous layout so it's
 * always current) rather than reasoning about which CSS mechanism produced
 * it, and nudges `domContainer`'s margin by the exact delta needed to make
 * its top-left corner match the canvas's. `transform-origin: left top` on
 * `domContainer` (Phaser's own default) means its scale transform doesn't
 * move that corner, so a margin correction made AFTER `scene.scale.refresh()`
 * stays correct through the transform.
 *
 * Call once in `create()` (after `scene.scale.refresh()`) AND register via
 * `onViewportResize` — a real window resize re-runs Phaser's own
 * `ScaleManager.refresh()` internally, which recopies the (still-empty)
 * canvas margin and undoes this correction.
 */
export function fixDomContainerAlignment(scene: Phaser.Scene): void {
  const game = scene.sys.game;
  const canvas = game.canvas;
  const dom = game.domContainer;
  if (!canvas || !dom) return;
  const canvasRect = canvas.getBoundingClientRect();
  const domRect = dom.getBoundingClientRect();
  const currentMarginLeft = parseFloat(dom.style.marginLeft) || 0;
  const currentMarginTop = parseFloat(dom.style.marginTop) || 0;
  dom.style.marginLeft = `${currentMarginLeft + (canvasRect.left - domRect.left)}px`;
  dom.style.marginTop = `${currentMarginTop + (canvasRect.top - domRect.top)}px`;
}

/**
 * D-154: the start of a shared responsive-layout convention. Reads the
 * scene's OWN live canvas size rather than the fixed `GAME_WIDTH`/
 * `GAME_HEIGHT` constants. D-157 briefly flipped the game to
 * `Scale.RESIZE`, then D-159 reverted it back to `Scale.FIT` after it broke
 * Main Menu/Character Creation in real-browser testing (see `main.ts`) — so
 * today `scene.scale.width/height` is always the fixed `GAME_WIDTH`/
 * `GAME_HEIGHT` (1280x1080) regardless of the real window, the same as
 * before D-157. Kept as groundwork for if a real responsive-canvas attempt
 * is made again later (see `PHASE_HANDOFF.md`).
 */
export function getViewport(scene: Phaser.Scene): { width: number; height: number } {
  return { width: scene.scale.width, height: scene.scale.height };
}

/**
 * Registers `rebuild` to run whenever the scene's canvas size changes, and
 * unregisters it on scene shutdown so a stale handler never fires against a
 * torn-down scene. Currently a no-op in practice under `Scale.FIT` (see
 * `getViewport`'s comment above) — nothing changes `scene.scale.width/
 * height` outside of a real window resize event, and `Scale.FIT` reports
 * the same fixed size regardless of the window. Kept as groundwork for the
 * same reason.
 */
export function onViewportResize(scene: Phaser.Scene, rebuild: () => void): void {
  const handler = (): void => rebuild();
  scene.scale.on(Phaser.Scale.Events.RESIZE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, handler));
}

export interface ChoiceOverlayOption {
  label: string;
  desc?: string;
  onClick: () => void;
  highlighted?: boolean;
}

/**
 * D-16x: the general-purpose "full-screen list of options, pick one"
 * overlay — lifted out of `CharacterCreationScene`'s D-147 `renderPlanPrompt`
 * (a dim backdrop + title + wrapping button grid, with the same `highlighted`
 * gold-outline "★ " treatment its Level Planner/Spell Picker wizards use) so
 * any scene can replace an old "click cycles A→B→C→A" button with a real
 * picker. Every created object is pushed onto the caller-owned `overlay`
 * array (cleared first) rather than returned, so `clearChoiceOverlay` can
 * destroy exactly what was drawn without the caller tracking anything else.
 */
export function renderChoiceOverlay(scene: Phaser.Scene, overlay: Phaser.GameObjects.GameObject[], title: string, choices: ChoiceOverlayOption[]): void {
  clearChoiceOverlay(overlay);
  const { width: viewportWidth, height: viewportHeight } = getViewport(scene);
  const dim = scene.add
    .rectangle(viewportWidth / 2, viewportHeight / 2, viewportWidth, viewportHeight, 0x000000, 0.85)
    .setDepth(60)
    .setInteractive();
  const titleText = scene.add
    .text(viewportWidth / 2, 90, title, {
      fontFamily: "system-ui, Arial, sans-serif",
      fontSize: "24px",
      color: "#f0e070",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: viewportWidth - 160 },
    })
    .setOrigin(0.5)
    .setDepth(61);
  overlay.push(dim, titleText);

  const hasDesc = choices.some((c) => c.desc);
  const usableWidth = viewportWidth - 80;
  const width = Math.min(220, Math.max(120, Math.floor(usableWidth / Math.min(choices.length, 6)) - 14));
  const minHeight = hasDesc ? 82 : 44;
  const spacing = width + 14;
  const maxPerRow = Math.max(1, Math.floor(usableWidth / spacing));
  const rowGap = 14;
  const topPad = 10;
  const nameDescGap = 6;

  // Playtest fix (Party Creation Overhaul, Plan 0): the old fixed `height`
  // constant assumed every `desc` fit in ~2 lines — a long one (e.g. a
  // class's `previewSummary`) wraps to far more and used to run into the
  // next row. Measure each choice's real wrapped height first (via
  // throwaway probe Text objects, destroyed immediately after), then size
  // each ROW to its own tallest item instead of a shared constant.
  const rowHeights: number[] = [];
  for (let i = 0; i < choices.length; i += maxPerRow) {
    const rowChoices = choices.slice(i, i + maxPerRow);
    const tallest = rowChoices.reduce((max, choice) => {
      const nameProbe = scene.add.text(0, 0, choice.label, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 14 },
      });
      let contentHeight = nameProbe.height;
      nameProbe.destroy();
      if (choice.desc) {
        const descProbe = scene.add.text(0, 0, choice.desc, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "12px",
          align: "center",
          wordWrap: { width: width - 14 },
        });
        contentHeight += nameDescGap + descProbe.height;
        descProbe.destroy();
      }
      return Math.max(max, contentHeight + topPad * 2);
    }, minHeight);
    rowHeights.push(tallest);
  }

  let rowTop = 170;
  let choiceIndex = 0;
  rowHeights.forEach((rowHeight) => {
    const rowChoices = choices.slice(choiceIndex, choiceIndex + maxPerRow);
    const itemsInRow = rowChoices.length;
    const rowStartX = viewportWidth / 2 - ((itemsInRow - 1) * spacing) / 2;
    const boxTop = rowTop;
    const boxCenterY = boxTop + rowHeight / 2;

    rowChoices.forEach((choice, col) => {
      const x = rowStartX + col * spacing;
      const btn = scene.add
        .rectangle(x, boxCenterY, width, rowHeight, 0x3a5a8a)
        .setInteractive({ useHandCursor: true })
        .setDepth(61);
      if (choice.highlighted) btn.setStrokeStyle(3, 0xf0c040);
      const name = scene.add
        .text(x, boxTop + topPad, choice.highlighted ? `★ ${choice.label}` : choice.label, {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "13px",
          color: choice.highlighted ? "#ffe58a" : "#e8e8f0",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: width - 14 },
        })
        .setOrigin(0.5, 0)
        .setDepth(62);
      overlay.push(btn, name);
      if (choice.desc) {
        const desc = scene.add
          .text(x, boxTop + topPad + name.height + nameDescGap, choice.desc, {
            fontFamily: "system-ui, Arial, sans-serif",
            fontSize: "12px",
            color: "#c8c8d8",
            align: "center",
            wordWrap: { width: width - 14 },
          })
          .setOrigin(0.5, 0)
          .setDepth(62);
        overlay.push(desc);
      }
      btn.on("pointerover", () => btn.setFillStyle(0x4a6a9a));
      btn.on("pointerout", () => btn.setFillStyle(0x3a5a8a));
      btn.on("pointerdown", () => choice.onClick());
    });

    rowTop += rowHeight + rowGap;
    choiceIndex += maxPerRow;
  });
}

export function clearChoiceOverlay(overlay: Phaser.GameObjects.GameObject[]): void {
  for (const obj of overlay) obj.destroy();
  overlay.length = 0;
}

/**
 * A one-shot "pick exactly one, then close" wrapper around
 * `renderChoiceOverlay` for the common case (D-147's Class/Race/Gear/
 * Subclass pickers, and every cycle-button this replaces elsewhere) — picking
 * an option applies it and closes; Cancel discards the click and closes.
 * `onClose` runs after either (e.g. a scene's own `refreshAll()`); pass
 * nothing if the caller's `onPick` already does everything it needs to.
 */
export function openChoiceList(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.GameObject[],
  title: string,
  options: Array<{ label: string; desc?: string; highlighted?: boolean; onPick: () => void }>,
  onClose?: () => void,
): void {
  renderChoiceOverlay(scene, overlay, title, [
    ...options.map((opt) => ({
      label: opt.label,
      desc: opt.desc,
      highlighted: opt.highlighted,
      onClick: () => {
        opt.onPick();
        clearChoiceOverlay(overlay);
        onClose?.();
      },
    })),
    { label: "Cancel", onClick: () => clearChoiceOverlay(overlay) },
  ]);
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
