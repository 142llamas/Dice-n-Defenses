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
import { listHeroActions } from "../systems/HeroActionRegistry";
import { getAbility } from "../data/abilities";

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
 */

type SheetTab = "stats" | "spellbook" | "hotkeys";

const TAB_DEFS: { id: SheetTab; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "spellbook", label: "Spellbook" },
  { id: "hotkeys", label: "Hotkeys" },
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
    else this.renderHotkeysTab();
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
    const availableLines: string[] = [];
    if (hero.knownSpellAbilityIds().length > 0) {
      availableLines.push("Action: Cast a Spell (see Spellbook tab)");
    } else {
      availableLines.push(`Action: ${getAbility(hero.abilityId).name}`);
    }
    if (hero.hasAnyPotion()) availableLines.push("Bonus/free: drink a carried potion");
    for (const action of listHeroActions(hero).filter((a) => a.available)) {
      availableLines.push(action.label.replace(" (R)", "").replace(" (T)", ""));
    }
    for (const line of availableLines) {
      this.addStatLine(left, y, `• ${line}`, "15px", "#2a1a10");
      y += lineHeight - 4;
    }
  }

  private addStatLine(x: number, y: number, text: string, fontSize: string, color: string, bold = false): void {
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
      this.contentObjects.push(btn, label);
    });
  }

  // ----- Hotkeys tab (edit the hotkey bar) --------------------------------

  private hotkeyLabel(id: string | undefined): string {
    if (!id) return "(empty)";
    const registryMatch = listHeroActions(this.hero).find((a) => a.id === id);
    if (registryMatch) return registryMatch.label.replace(" (R)", "").replace(" (T)", "");
    if (id === this.hero.abilityId) return getAbility(id).name;
    if (this.hero.knownSpellAbilityIds().includes(id)) return getAbility(id).name;
    return id;
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

    const assignable = [
      ...listHeroActions(this.hero)
        .filter((a) => a.available)
        .map((a) => ({ id: a.id, label: a.label.replace(" (R)", "").replace(" (T)", "") })),
      ...(this.hero.knownSpellAbilityIds().length === 0
        ? [{ id: this.hero.abilityId, label: getAbility(this.hero.abilityId).name }]
        : this.hero.knownSpellAbilityIds().map((id) => ({ id, label: getAbility(id).name }))),
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
