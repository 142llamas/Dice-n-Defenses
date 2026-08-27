import Phaser from "phaser";
import {
  FONT_DISPLAY,
  FONT_BODY,
  createOrnateButton,
  drawScreenBackdrop,
  drawParchmentPanel,
  centeredRowX,
  getViewport,
  onViewportResize,
  type OrnateButtonHandle,
} from "./uiTheme";
import { createTooltipController, attachHoverTooltip, type TooltipController } from "./tooltip";
import { Hero, ACTION_HOTKEY_SLOT_COUNT } from "../entities/Hero";
import { ABILITY_SCORE_IDS, ABILITY_SCORE_NAMES, abilityModifier } from "../data/abilityScores";
import { getClassDefinition } from "../data/classes";
import { getSubclassDefinition } from "../data/subclasses";
import { proficiencyBonusForLevel } from "../systems/CharacterSystem";
import { classProgressionTable, type ProgressionLevelEntry } from "../systems/ClassProgressionSystem";
import { listHeroActions, hotkeyDisplayLabel } from "../systems/HeroActionRegistry";
import { getAbility } from "../data/abilities";
import type { BattleScene } from "./BattleScene";

/**
 * CharacterSheetScene — D-148: opened over a paused `BattleScene` (a real
 * second Phaser scene via `scene.launch`/`scene.pause`/`scene.resume`, not
 * an in-battle overlay Container — nothing in this codebase had exercised
 * that pause/resume path before this, so treat the mechanism itself as
 * worth a careful in-browser check, not just this scene's content).
 *
 * `init(data)` receives the LIVE `Hero` instance (not an id) — Phaser scene
 * data isn't serialized for an in-process `scene.launch`, so edits made
 * here (hotkeys) are reflected instantly back in `BattleScene` on resume
 * with no extra sync step, and every stat shown is read straight off the
 * same object `BattleScene` itself uses.
 *
 * D-165 (KI-098 item 4): the Stats tab's "Available Right Now" list and the
 * Spellbook tab's per-spell cards are now real click targets, not just a
 * read-only reference — clicking one closes the sheet and fires it on the
 * resumed `BattleScene` (`castAbilityAndClose`/`usePotionAndClose`, which
 * call the new public `BattleScene.castAbilityFromCharacterSheet`/
 * `usePotionFromCharacterSheet`), landing the player right back on the
 * board mid-aim exactly as if they'd pressed Q/R/F/T themselves.
 */

type SheetTab = "stats" | "spellbook" | "hotkeys" | "progression";

const TAB_DEFS: { id: SheetTab; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "spellbook", label: "Spellbook" },
  { id: "hotkeys", label: "Hotkeys" },
  { id: "progression", label: "Progression" },
];

const SPELL_LEVEL_LABELS = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

export interface CharacterSheetSceneData {
  hero: Hero;
}

export class CharacterSheetScene extends Phaser.Scene {
  private hero!: Hero;
  private tab: SheetTab = "stats";
  private tabButtons: OrnateButtonHandle[] = [];
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private tooltip!: TooltipController;

  private spellLevelFilter = 0;
  private spellLevelButtons: OrnateButtonHandle[] = [];

  private armedHotkeySlot: number | null = null;
  private hotkeySlotButtons: OrnateButtonHandle[] = [];
  private layoutRoot?: Phaser.GameObjects.Container;

  constructor() {
    super("CharacterSheetScene");
  }

  init(data: CharacterSheetSceneData): void {
    this.hero = data.hero;
  }

  create(): void {
    this.tab = "stats";
    this.armedHotkeySlot = null;

    this.tooltip = createTooltipController(this);

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds the chrome (backdrop/title/Close/tabs) against the
  // current viewport, preserving `this.tab`/`this.spellLevelFilter`/
  // `this.armedHotkeySlot` (only `create()` resets those) so a resize
  // doesn't bounce the player off whatever tab they were looking at. This
  // scene is launched as an overlay over a PAUSED `BattleScene`
  // (`scene.launch`/`scene.pause`), not started fresh, so a resize firing
  // while it's on top must not disturb the underlying battle.
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    this.tabButtons = [];
    this.contentObjects = [];
    this.spellLevelButtons = [];
    this.hotkeySlotButtons = [];
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    const { width } = getViewport(this);

    drawScreenBackdrop(this);

    this.add
      .text(width / 2, 42, this.hero.name, {
        fontFamily: FONT_DISPLAY,
        fontSize: "34px",
        color: "#f0dfa8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    createOrnateButton(this, 120, 42, 160, 44, "Close (Esc)", () => this.close(), { variant: "tool", depth: 5 });

    this.buildTabs(width);

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);

    this.renderTab();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume("BattleScene");
  }

  /**
   * D-165 (KI-098 item 4): closes the sheet and immediately fires
   * `abilityId` for this hero on the now-resumed `BattleScene` — a spell/
   * cantrip from the Spellbook tab, or a registry action from the Stats
   * tab's "Available Right Now" list. Single-target spells land
   * the player right back on the board mid-aim, exactly as if they'd
   * pressed Q/R/F/T themselves; an AoE/instant one resolves immediately.
   * An id that isn't actually usable right now (out of slots, Silenced,
   * already acted) is a silent no-op, same as every other trigger path
   * for the same reason — see `BattleScene.dispatchAbilityId`.
   */
  private castAbilityAndClose(abilityId: string): void {
    const heroId = this.hero.id;
    this.close();
    (this.scene.get("BattleScene") as BattleScene).castAbilityFromCharacterSheet(heroId, abilityId);
  }

  /** D-165 (KI-098 item 4): closes the sheet and drinks this hero's first loaded potion on the resumed battle — same "cast from the sheet" idea as `castAbilityAndClose`, for the one action potions don't share an id namespace with. */
  private usePotionAndClose(): void {
    const heroId = this.hero.id;
    this.close();
    (this.scene.get("BattleScene") as BattleScene).usePotionFromCharacterSheet(heroId);
  }

  /** D-165: a clickable "Available Right Now" row — same hover-color-shift, mouse-only pattern `CompendiumScene`'s row list (D-165) already uses, not a full ornate button (this list can run several rows deep). */
  private addActionRow(x: number, y: number, label: string, onClick: () => void): void {
    const t = this.add
      .text(x, y, `▸ ${label}`, {
        fontFamily: FONT_BODY,
        fontSize: "15px",
        color: "#2a1a10",
        fontStyle: "bold",
        wordWrap: { width: 1040 },
      })
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    t.on("pointerover", () => t.setColor("#7a3a10"));
    t.on("pointerout", () => t.setColor("#2a1a10"));
    t.on("pointerdown", onClick);
    this.contentObjects.push(t);
  }

  private buildTabs(width: number): void {
    const y = 100;
    const w = 200;
    const gap = 12;
    const { xs, itemWidth } = centeredRowX(TAB_DEFS.length, w, gap, width / 2, width - 80);
    TAB_DEFS.forEach((def, i) => {
      const handle = createOrnateButton(
        this,
        xs[i],
        y,
        itemWidth,
        38,
        def.label,
        () => {
          this.tab = def.id;
          this.armedHotkeySlot = null;
          this.renderTab();
        },
        { variant: "tab", depth: 5 },
      );
      this.tabButtons.push(handle);
    });
  }

  private refreshTabHighlights(): void {
    TAB_DEFS.forEach((def, i) => this.tabButtons[i].setSelected(def.id === this.tab));
  }

  private clearContent(): void {
    this.contentObjects.forEach((o) => o.destroy());
    this.contentObjects = [];
    this.spellLevelButtons.forEach((b) => b.destroy());
    this.spellLevelButtons = [];
    this.hotkeySlotButtons.forEach((b) => b.destroy());
    this.hotkeySlotButtons = [];
  }

  private renderTab(): void {
    this.refreshTabHighlights();
    this.clearContent();
    this.tooltip.hide();
    if (this.tab === "stats") this.renderStatsTab();
    else if (this.tab === "spellbook") this.renderSpellbookTab();
    else if (this.tab === "hotkeys") this.renderHotkeysTab();
    else this.renderProgressionTab();
  }

  // ----- Stats tab (read-only) --------------------------------------------

  private renderStatsTab(): void {
    const hero = this.hero;
    const viewportWidth = getViewport(this).width;
    this.contentObjects.push(drawParchmentPanel(this, viewportWidth / 2, 560, 1120, 840, 2));

    const left = viewportWidth / 2 - 520;
    const lineHeight = 26;
    let y = 165;
    const identity = hero.classId
      ? `${getClassDefinition(hero.classId).name}${hero.subclassId ? ` (${getSubclassDefinition(hero.subclassId).name})` : ""} — Level ${hero.level}`
      : "Classic Hero";
    this.addStatLine(left, y, identity, "20px", "#3a2a10", true);
    y += lineHeight + 6;

    this.addStatLine(left, y, `HP ${hero.health}/${hero.effectiveMaxHealth}    AC ${hero.armorClass}    Movement ${hero.effectiveMovementTiles} tiles`, "16px", "#2a1a10");
    y += lineHeight;
    if (hero.classId) {
      this.addStatLine(left, y, `Proficiency Bonus +${proficiencyBonusForLevel(hero.level)}`, "16px", "#2a1a10");
      y += lineHeight;
    }
    y += 14;

    if (hero.abilityScoreValue("str") !== null) {
      this.addStatLine(left, y, "Ability Scores", "18px", "#3a2a10", true);
      y += lineHeight + 4;
      for (const id of ABILITY_SCORE_IDS) {
        const score = hero.abilityScoreValue(id) ?? 10;
        const mod = abilityModifier(score);
        const modText = mod >= 0 ? `+${mod}` : `${mod}`;
        this.addStatLine(left, y, `${ABILITY_SCORE_NAMES[id]}: ${score} (${modText})`, "15px", "#2a1a10");
        y += lineHeight - 4;
      }
      y += 14;
    }

    this.addStatLine(left, y, "Available Right Now", "18px", "#3a2a10", true);
    y += lineHeight + 4;
    // D-165 (KI-098 item 4): every line below is now a real click target —
    // clicking one closes the sheet and fires it on the resumed battle
    // (`castAbilityAndClose`/`usePotionAndClose`), instead of only being
    // readable here. A caster's own line stays plain text: its actual
    // spells live on the Spellbook tab, which already has its own click-
    // to-cast cards (see `renderSpellbookTab`).
    if (hero.knownSpellAbilityIds().length > 0) {
      this.addStatLine(left, y, "• Action: Cast a Spell (see Spellbook tab to pick one)", "15px", "#2a1a10");
      y += lineHeight - 4;
    } else {
      this.addStatLine(left, y, "• Action: Attack (click an enemy on the board)", "15px", "#2a1a10");
      y += lineHeight - 4;
    }
    if (hero.hasAnyPotion()) {
      this.addActionRow(left, y, "Bonus/free: drink a carried potion", () => this.usePotionAndClose());
      y += lineHeight - 4;
    }
    for (const action of listHeroActions(hero).filter((a) => a.available)) {
      const label = action.label.replace(" (R)", "").replace(" (T)", "");
      this.addActionRow(left, y, label, () => this.castAbilityAndClose(action.id));
      y += lineHeight - 4;
    }
  }

  private addStatLine(x: number, y: number, text: string, fontSize: string, color: string, bold = false): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT_BODY,
        fontSize,
        color,
        fontStyle: bold ? "bold" : "normal",
        wordWrap: { width: 1040 },
      })
      .setDepth(3);
    this.contentObjects.push(t);
    return t;
  }

  // ----- Progression tab (D-200, Party Creation Overhaul Plan 7) ---------
  // A read-only 1-20 level reference for this hero's class/subclass,
  // dimming levels not yet reached. See ClassProgressionSystem.ts.

  private renderProgressionTab(): void {
    const hero = this.hero;
    const viewportWidth = getViewport(this).width;
    this.contentObjects.push(drawParchmentPanel(this, viewportWidth / 2, 560, 1120, 840, 2));

    if (!hero.classId) {
      this.addStatLine(
        viewportWidth / 2 - 300,
        300,
        "This hero has no class progression to show (classic fixed-roster hero).",
        "16px",
        "#2a1a10",
      );
      return;
    }

    const table = classProgressionTable(hero.classId, hero.subclassId);
    const left = viewportWidth / 2 - 520;
    const rowHeight = 34;
    let y = 165;
    for (const entry of table) {
      const t = this.addStatLine(left, y, this.progressionRowText(entry), "15px", "#2a1a10");
      if (entry.level > hero.level) t.setAlpha(0.55); // not yet reached
      const tooltipText = this.progressionRowTooltip(entry);
      if (tooltipText) attachHoverTooltip(this.tooltip, t, left, y - 12, () => tooltipText);
      y += rowHeight;
    }
  }

  private progressionRowText(entry: ProgressionLevelEntry): string {
    const classNames = entry.classFeatures.map((f) => f.name).join(", ");
    const subclassNames = entry.subclassFeatures.map((f) => f.name).join(", ");
    const parts = [`Lv ${entry.level}`];
    if (classNames) parts.push(classNames);
    if (subclassNames) parts.push(`(${subclassNames})`);
    if (entry.isCaster) {
      const bits: string[] = [];
      if (entry.cantripsKnown > 0) bits.push(`${entry.cantripsKnown} cantrips`);
      if (entry.preparedCount > 0) bits.push(`${entry.preparedCount} prepared`);
      const slots = entry.spellSlots.filter((n) => n > 0);
      if (slots.length > 0) bits.push(`slots ${entry.spellSlots.join("/")}`.replace(/(\/0)+$/, ""));
      if (entry.spellbookSize !== undefined) bits.push(`spellbook ${entry.spellbookSize}`);
      if (bits.length > 0) parts.push(bits.join(", "));
    }
    return parts.length > 1 ? parts.join(" — ") : `Lv ${entry.level} —`;
  }

  private progressionRowTooltip(entry: ProgressionLevelEntry): string {
    return [...entry.classFeatures, ...entry.subclassFeatures].map((f) => f.description).join("\n\n");
  }

  // ----- Spellbook tab (level-grouped, hover for full rules text) --------

  private spellsByLevel(): Map<number, string[]> {
    const byLevel = new Map<number, string[]>();
    for (const id of this.hero.knownSpellAbilityIds()) {
      const ability = getAbility(id);
      const level = ability.spellSlotLevel ?? 0;
      const list = byLevel.get(level) ?? [];
      list.push(id);
      byLevel.set(level, list);
    }
    return byLevel;
  }

  private renderSpellbookTab(): void {
    const byLevel = this.spellsByLevel();
    const levels = [...byLevel.keys()].sort((a, b) => a - b);
    const viewportWidth = getViewport(this).width;

    this.contentObjects.push(drawParchmentPanel(this, viewportWidth / 2, 560, 1120, 840, 2));

    if (levels.length === 0) {
      this.addStatLine(viewportWidth / 2 - 200, 200, "This hero knows no spells.", "16px", "#2a1a10");
      return;
    }
    if (!levels.includes(this.spellLevelFilter)) this.spellLevelFilter = levels[0];

    const y = 155;
    const w = 110;
    const gap = 8;
    const { xs, itemWidth } = centeredRowX(levels.length, w, gap, viewportWidth / 2, viewportWidth - 80);
    levels.forEach((level, i) => {
      const handle = createOrnateButton(
        this,
        xs[i],
        y,
        itemWidth,
        32,
        SPELL_LEVEL_LABELS[level],
        () => {
          this.spellLevelFilter = level;
          this.renderTab();
        },
        { variant: "tab", depth: 5 },
      );
      handle.setSelected(level === this.spellLevelFilter);
      this.spellLevelButtons.push(handle);
    });

    const ids = byLevel.get(this.spellLevelFilter) ?? [];
    const columns = 3;
    const cardW = 340;
    const height = 60;
    const colGap = 20;
    const rowGap = 14;
    const gridWidth = columns * cardW + (columns - 1) * colGap;
    const startX = viewportWidth / 2 - gridWidth / 2 + cardW / 2;
    const startY = 220;
    ids.forEach((id, i) => {
      const ability = getAbility(id);
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = startX + col * (cardW + colGap);
      const yPos = startY + row * (height + rowGap);
      const costLabel = ability.spellSlotLevel ? `${SPELL_LEVEL_LABELS[ability.spellSlotLevel]}-level` : "cantrip";
      const btn = this.add
        .rectangle(x, yPos, cardW, height, 0x5a4a30)
        .setStrokeStyle(1, 0x8a7a50)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      const label = this.add
        .text(x, yPos, `${ability.name}\n${costLabel}`, {
          fontFamily: FONT_BODY,
          fontSize: "14px",
          color: "#f0e6c8",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(4);
      attachHoverTooltip(this.tooltip, btn, x, yPos - height / 2 - 4, () => ability.description);
      // D-165 (KI-098 item 4): clicking a known spell/cantrip now actually
      // casts it (closes the sheet, resumes the battle mid-aim or
      // resolved), instead of the card being a pure hover-for-rules-text
      // display.
      btn.on("pointerdown", () => this.castAbilityAndClose(id));
      this.contentObjects.push(btn, label);
    });
  }

  // ----- Hotkeys tab (edit the hotkey bar) --------------------------------

  private hotkeyLabel(id: string | undefined): string {
    return hotkeyDisplayLabel(this.hero, id);
  }

  private renderHotkeysTab(): void {
    const viewportWidth = getViewport(this).width;
    this.contentObjects.push(drawParchmentPanel(this, viewportWidth / 2, 560, 1120, 840, 2));

    this.addStatLine(
      viewportWidth / 2 - 520,
      150,
      this.armedHotkeySlot === null
        ? "Click a slot below, then click an action/spell to pin it there."
        : `Slot ${this.armedHotkeySlot + 1} armed — click an action/spell below to pin it, or Clear.`,
      "15px",
      "#3a2a10",
      true,
    );

    const hotkeys = this.hero.actionHotkeys();
    const slotW = 170;
    const slotGap = 10;
    const { xs, itemWidth } = centeredRowX(ACTION_HOTKEY_SLOT_COUNT, slotW, slotGap, viewportWidth / 2, viewportWidth - 80);
    for (let slot = 0; slot < ACTION_HOTKEY_SLOT_COUNT; slot++) {
      const handle = createOrnateButton(
        this,
        xs[slot],
        200,
        itemWidth,
        56,
        `${slot + 1}: ${this.hotkeyLabel(hotkeys[slot] ?? undefined)}`,
        () => {
          this.armedHotkeySlot = this.armedHotkeySlot === slot ? null : slot;
          this.renderTab();
        },
        { variant: "secondary", depth: 5 },
      );
      handle.setSelected(this.armedHotkeySlot === slot);
      this.hotkeySlotButtons.push(handle);
    }

    const clearHandle = createOrnateButton(
      this,
      viewportWidth / 2,
      260,
      160,
      32,
      "Clear Slot",
      () => {
        if (this.armedHotkeySlot === null) return;
        this.hero.setActionHotkey(this.armedHotkeySlot, undefined);
        this.armedHotkeySlot = null;
        this.renderTab();
      },
      { variant: "tool", depth: 5, disabled: this.armedHotkeySlot === null },
    );
    this.hotkeySlotButtons.push(clearHandle);

    this.addStatLine(viewportWidth / 2 - 520, 305, "Assignable actions & spells", "17px", "#3a2a10", true);

    // D-178: a non-caster has no more single frozen ability to pin — its
    // real weapon Attack is click-to-attack, not a hotkey-able id, so its
    // assignable pool is just its available registry actions.
    const assignable = [
      ...listHeroActions(this.hero)
        .filter((a) => a.available)
        .map((a) => ({ id: a.id, label: a.label.replace(" (R)", "").replace(" (T)", "") })),
      ...this.hero.knownSpellAbilityIds().map((id) => ({ id, label: getAbility(id).name })),
    ];

    const columns = 4;
    const cardW = 250;
    const height = 44;
    const colGap = 16;
    const rowGap = 12;
    const gridWidth = columns * cardW + (columns - 1) * colGap;
    const startX = viewportWidth / 2 - gridWidth / 2 + cardW / 2;
    const startY = 350;
    assignable.forEach((entry, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = startX + col * (cardW + colGap);
      const y = startY + row * (height + rowGap);
      const isPinned = hotkeys.includes(entry.id);
      const btn = this.add
        .rectangle(x, y, cardW, height, isPinned ? 0x4a6a3a : 0x3a5a8a)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      const label = this.add
        .text(x, y, entry.label, {
          fontFamily: FONT_BODY,
          fontSize: "13px",
          color: "#f0e6c8",
          align: "center",
          wordWrap: { width: cardW - 16 },
        })
        .setOrigin(0.5)
        .setDepth(4);
      btn.on("pointerdown", () => {
        if (this.armedHotkeySlot === null) return;
        this.hero.setActionHotkey(this.armedHotkeySlot, entry.id);
        this.armedHotkeySlot = null;
        this.renderTab();
      });
      this.contentObjects.push(btn, label);
    });
  }
}
