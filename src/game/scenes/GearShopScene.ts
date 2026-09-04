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
} from "./uiTheme";
import { Hero } from "../entities/Hero";
import {
  getEquipmentDefinition,
  GEAR_SLOT_LABELS,
  RARITY_LABELS,
  type GearSlotId,
  type EquipmentRarity,
} from "../data/equipment";
import { getClassDefinition } from "../data/classes";
import { POTION_DEFINITIONS, getPotionDefinition, GENERAL_SLOT_LABELS, type GeneralSlotId } from "../data/potions";
import { sellValueForCost } from "../systems/EconomySystem";
import { isItemEligibleForSlot, previewGearSlotChange, formatGearDelta } from "../systems/GearCompareSystem";
import {
  decideSlotPairPlacement,
  decideHandsPlacement,
  applyCatalogFilters,
  isMagicItem,
  type HandsCategory,
  type WeaponGrip,
  type CatalogFilters,
} from "../systems/GearFilterSystem";
import { clampScrollOffset, contentHeight as scrollContentHeight } from "../systems/ScrollListMath";
import { renderScrollListRows, renderScrollbarVisual, attachWheelScroll, type ScrollListRect, type ScrollRegion } from "./uiScrollList";
import type { WeaponCategory } from "../data/weapons";
import type { BattleScene } from "./BattleScene";

/**
 * GearShopScene — The Armory (D-209). Opened over a paused `BattleScene`
 * (same `scene.launch`/`scene.pause`/`scene.resume` mechanism `PauseMenuScene`/
 * `CharacterSheetScene` already established), replacing the old in-BattleScene
 * "click an item, then click a hero" Gear grid.
 *
 * Flow: pick a hero → pick one of their 12 slots (10 gear + 2 potion, shown
 * as a paperdoll) → browse a catalog filtered to that slot. Every non-
 * occupant row shows Purchase directly if the slot is empty, or Compare
 * first if it's occupied — clicking Compare (or the row) shows the compare
 * strip above, and that same button becomes Purchase after `PRIME_DELAY_MS`,
 * so a reflexive double-click can't spend gold by accident. The occupant's
 * own row shows the same delayed-confirm shape for Sell instead. Buying
 * into an occupied slot auto-sells the occupant as part of the purchase
 * (still no general inventory) at half its cost — `EconomySystem.
 * sellValueForCost`, confirmed with Kevin as the real economy rule.
 *
 * Layout (reworked after the first ship drifted from the agreed mockup —
 * see `project_armory_mockup` memory): a narrow hero SIDEBAR on the left
 * (compact paperdoll per hero, no item text — just colored/bordered cells)
 * and one wide shopping panel on the right for whichever hero/slot is
 * selected (header, one row of slot tabs, compare strip, catalog). The
 * original ship instead put all heroes' full paperdolls in a row across the
 * top plus a second, redundant full-width slot-chip row, which left the
 * catalog squeezed into a small paginated strip at the bottom — the mockup
 * traded per-hero paperdoll detail for a much bigger catalog area instead.
 *
 * Holds NO game-rule logic itself — every read (`shopHeroes`/
 * `shopVisibleItemIds`/`goldFor`) and every mutation (`buyGearForHero`/
 * `sellGearFromHero`/`buyPotionForHero`/`sellPotionFromHero`) goes through
 * the live `BattleScene` passed in via `init(data)`, mirroring
 * `CharacterSheetScene`'s "call back into the paused scene" precedent
 * rather than duplicating validation here.
 */

const PRIME_DELAY_MS = 650;
/** D-234: no longer a "page size" — the fixed number of rows the scrollable catalog panel is tall enough to show at once. */
const CATALOG_VISIBLE_ROWS = 9;

// Sidebar-vs-content split (mockup layout): a narrow hero list on the left,
// one wide shopping panel on the right for the selected hero/slot.
const SIDEBAR_X = 40;
const SIDEBAR_WIDTH = 300;
const CONTENT_GAP = 24;
const CONTENT_TOP = 100;
const CONTENT_BOTTOM_MARGIN = 40;

type ArmorySlotId = GearSlotId | GeneralSlotId;

/** 6 columns x 2 rows — the two Potion slots sit in the rightmost column, next to Legs/Footwear, per the agreed design. */
const PAPERDOLL_ROWS: ArmorySlotId[][] = [
  ["weapon", "shield", "head", "chest", "legs", "general1"],
  ["back", "ring1", "ring2", "amulet", "footwear", "general2"],
];
/** D-228: tabs are FILTERS, not physical slots — "general2"/"ring2" never get their own tab, they share "general1"/"ring1"'s. */
const ALL_ARMORY_FILTERS: ArmorySlotId[] = Array.from(new Set(PAPERDOLL_ROWS.flat().map(normalizeFilterSlot)));

const INK = "#2a1a10";
const INK_MUTED = "#6a4a2a";
const CREAM = "#f0e6c8";
const OK_GREEN = "#2f5a34";
const BAD_RED = "#a34a3a";

function isGeneralSlot(slot: ArmorySlotId): slot is GeneralSlotId {
  return slot === "general1" || slot === "general2";
}

function slotLabel(slot: ArmorySlotId): string {
  return isGeneralSlot(slot) ? GENERAL_SLOT_LABELS[slot] : GEAR_SLOT_LABELS[slot];
}

/**
 * D-228 (KI-177 items 3/4/5): Potion 1/Potion 2, Ring 1/Ring 2, and
 * Weapon/Shield each collapse into ONE shop filter — "general2"/"ring2"/
 * "shield" are never stored as `selectedSlot` themselves, only ever
 * normalized to their group's first slot. The paperdoll still shows all
 * physical cells individually (`PAPERDOLL_ROWS`/`occupantOf` are
 * untouched) — only the filter/tab concept and the buy/sell flow are
 * pair-aware. Hands is asymmetric (see `isHandsFilter`/`decideHandsPlacement`
 * below) so it does NOT go through `pairSlotsFor`'s fixed-pair logic.
 */
const SLOT_GROUP: Partial<Record<ArmorySlotId, ArmorySlotId>> = { general2: "general1", ring2: "ring1", shield: "weapon" };

function normalizeFilterSlot(slot: ArmorySlotId): ArmorySlotId {
  return SLOT_GROUP[slot] ?? slot;
}

/** Non-null only for a slot that heads a FIXED consolidated pair (Potions/Rings) — the two physical slots it represents, in display order. Hands is handled separately (see `isHandsFilter`). */
function pairSlotsFor(filter: ArmorySlotId): [ArmorySlotId, ArmorySlotId] | null {
  if (filter === "general1") return ["general1", "general2"];
  if (filter === "ring1") return ["ring1", "ring2"];
  return null;
}

function isHandsFilter(filter: ArmorySlotId): boolean {
  return filter === "weapon";
}

/** Tab/header label for a (possibly consolidated) filter — "Potions"/"Rings"/"Hands" instead of "Potion 1"/"Ring 1"/"Right hand". */
function filterLabel(filter: ArmorySlotId): string {
  if (filter === "general1") return "Potions";
  if (filter === "ring1") return "Rings";
  if (filter === "weapon") return "Hands";
  return slotLabel(filter);
}

function isPotionItem(itemId: string): boolean {
  return itemId in POTION_DEFINITIONS;
}

function itemName(itemId: string): string {
  return isPotionItem(itemId) ? getPotionDefinition(itemId).name : getEquipmentDefinition(itemId).name;
}

function itemCost(itemId: string): number {
  return isPotionItem(itemId) ? getPotionDefinition(itemId).cost : getEquipmentDefinition(itemId).cost;
}

function itemRarity(itemId: string): EquipmentRarity {
  return isPotionItem(itemId) ? getPotionDefinition(itemId).rarity : getEquipmentDefinition(itemId).rarity;
}

function itemDescription(itemId: string): string {
  return isPotionItem(itemId) ? getPotionDefinition(itemId).description : getEquipmentDefinition(itemId).description;
}

function rarityTag(itemId: string): string {
  const rarity = itemRarity(itemId);
  return rarity === "common" ? "" : ` · ${RARITY_LABELS[rarity]}`;
}

export interface GearShopSceneData {
  battleScene: BattleScene;
}

export class GearShopScene extends Phaser.Scene {
  private battleScene!: BattleScene;
  private selectedHeroId: string | null = null;
  private selectedSlot: ArmorySlotId = "weapon";
  private selectedItemId: string | null = null;
  /**
   * D-228 (KI-177 items 3/4): the specific PHYSICAL slot a pending buy/sell
   * targets — always equal to `selectedSlot` for a non-consolidated slot,
   * but for a consolidated Potions/Rings filter this is what actually
   * distinguishes "general1" from "general2" (or "ring1" from "ring2").
   * Null while a compare-and-replace choice (both paired slots occupied)
   * hasn't picked a specific one yet.
   */
  private targetSlot: ArmorySlotId | null = null;
  private primed = false;
  private primeTimer: Phaser.Time.TimerEvent | null = null;
  /** D-234: scroll offset (px) replacing the old page index — see `uiScrollList.ts`. */
  private catalogScrollOffset = 0;
  /** Set each `buildCatalog()` call so the persistent wheel handler (registered once in `create()`) always reflects the current filter/list state; null while nothing scrollable is on screen. */
  private catalogViewportRect: ScrollListRect | null = null;
  private catalogContentHeight = 0;
  private contentObjects: Phaser.GameObjects.GameObject[] = [];

  /**
   * D-233 (item 5's extra layer): catalog sub-filters. Rarity/Magic Only
   * apply on every tab and deliberately persist across `navigateTo` (a
   * player browsing "only Rare+" across several slots shouldn't have to
   * reselect it each time) — only `init()` resets them for a fresh shop
   * session. The Hands-only three are harmless to leave set while browsing
   * a different tab, since they only ever affect `buildCatalog`'s
   * `applyCatalogFilters` call when `isHandsFilter(this.selectedSlot)`.
   */
  private rarityFilter: EquipmentRarity | "all" = "all";
  private magicOnlyFilter = false;
  private handsCategoryFilter: HandsCategory | "all" = "all";
  private weaponCategoryFilter: WeaponCategory | "all" = "all";
  private gripFilter: WeaponGrip | "all" = "all";
  /** Vertical space the filter-chip rows take this refresh — 0 outside Hands' extra row. Shifts the compare strip/catalog down instead of overlapping. */
  private extraFilterOffset = 0;

  constructor() {
    super("GearShopScene");
  }

  init(data: GearShopSceneData): void {
    this.battleScene = data.battleScene;
    this.selectedHeroId = this.battleScene.shopHeroes()[0]?.id ?? null;
    this.selectedSlot = "weapon";
    this.selectedItemId = null;
    this.targetSlot = null;
    this.primed = false;
    this.catalogScrollOffset = 0;
    this.rarityFilter = "all";
    this.magicOnlyFilter = false;
    this.handsCategoryFilter = "all";
    this.weaponCategoryFilter = "all";
    this.gripFilter = "all";
  }

  create(): void {
    this.input.keyboard?.on("keydown-ESC", () => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearPrimeTimer();
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.refresh());
    // D-234: registered once (not per-refresh) since this is a scene-level
    // subscription, not a GameObject — `activeCatalogScrollRegion` is
    // re-read on every wheel event so it always reflects the current filter/
    // scroll state.
    attachWheelScroll(
      this,
      () => this.activeCatalogScrollRegion(),
      (offset) => {
        this.catalogScrollOffset = offset;
        this.refresh();
      },
    );
    this.refresh();
  }

  private activeCatalogScrollRegion(): ScrollRegion | null {
    if (!this.catalogViewportRect) return null;
    return { rect: this.catalogViewportRect, totalContentHeight: this.catalogContentHeight, scrollOffset: this.catalogScrollOffset };
  }

  private close(): void {
    this.clearPrimeTimer();
    this.scene.stop();
    this.scene.resume("BattleScene");
  }

  private clearPrimeTimer(): void {
    this.primeTimer?.remove(false);
    this.primeTimer = null;
  }

  private selectedHero(): Hero | null {
    if (!this.selectedHeroId) return null;
    return this.battleScene.shopHeroes().find((h) => h.id === this.selectedHeroId) ?? null;
  }

  private occupantOf(hero: Hero, slot: ArmorySlotId): string | null {
    return (isGeneralSlot(slot) ? hero.equippedPotions[slot] : hero.equippedItems[slot]) ?? null;
  }

  /** Hero card / paperdoll slot / chip clicks: just change context, nothing chosen yet. */
  private navigateTo(heroId: string, slot: ArmorySlotId): void {
    this.clearPrimeTimer();
    this.selectedHeroId = heroId;
    this.selectedSlot = normalizeFilterSlot(slot);
    this.selectedItemId = null;
    this.targetSlot = null;
    this.primed = false;
    this.catalogScrollOffset = 0;
    this.refresh();
  }

  /** Arms `targetSlot`, either committing immediately (an empty/auto-placed slot) or after the usual delayed-confirm window (a slot with something already in it). */
  private armTarget(slot: ArmorySlotId, instant: boolean): void {
    this.targetSlot = slot;
    if (instant) {
      this.primed = true;
      this.refresh();
      return;
    }
    this.primed = false;
    this.primeTimer = this.time.delayedCall(PRIME_DELAY_MS, () => {
      this.primed = true;
      this.refresh();
    });
    this.refresh();
  }

  /** Clicking a catalog row (or its Compare/Sell button): explicitly choosing an item to look at. */
  private chooseItem(itemId: string): void {
    this.clearPrimeTimer();
    this.selectedItemId = itemId;
    const hero = this.selectedHero();
    if (hero && isHandsFilter(this.selectedSlot)) {
      const weaponOccupant = this.occupantOf(hero, "weapon");
      const shieldOccupant = this.occupantOf(hero, "shield");
      if (itemId === weaponOccupant) return this.armTarget("weapon", false);
      if (itemId === shieldOccupant) return this.armTarget("shield", false);
      const decision = decideHandsPlacement(itemId, weaponOccupant, shieldOccupant);
      if (decision.kind === "autoPlace") return this.armTarget(decision.slot, true);
      // A single-candidate item (a real shield, or a non-Light weapon) facing
      // its one occupied slot behaves exactly like a single-slot compare —
      // there's only one place it could go, nothing to choose between.
      if (decision.candidateSlots.length === 1) return this.armTarget(decision.candidateSlots[0], false);
      // A Light melee weapon with BOTH hands genuinely full — wait for an
      // explicit "Replace Right/Left hand" pick.
      this.targetSlot = null;
      this.primed = false;
      this.refresh();
      return;
    }
    const pair = pairSlotsFor(this.selectedSlot);
    if (hero && pair) {
      const [slotA, slotB] = pair;
      const occupantA = this.occupantOf(hero, slotA);
      const occupantB = this.occupantOf(hero, slotB);
      // Clicking an existing occupant's own row is a sell action for that
      // ONE physical slot, not a new-item placement decision.
      if (itemId === occupantA) return this.armTarget(slotA, false);
      if (itemId === occupantB) return this.armTarget(slotB, false);
      const decision = decideSlotPairPlacement(occupantA, occupantB, slotA, slotB);
      if (decision.kind === "autoPlace") return this.armTarget(decision.slot, true);
      // Both full — wait for an explicit "Replace Potion 1/2" pick (see buildPairReplaceButtons).
      this.targetSlot = null;
      this.primed = false;
      this.refresh();
      return;
    }
    const occupant = hero ? this.occupantOf(hero, this.selectedSlot) : null;
    this.armTarget(this.selectedSlot, !occupant);
  }

  private commitPurchase(itemId: string): void {
    const hero = this.selectedHero();
    const slot = this.targetSlot ?? this.selectedSlot;
    if (!hero) return;
    if (isGeneralSlot(slot)) this.battleScene.buyPotionForHero(hero, slot, itemId);
    else this.battleScene.buyGearForHero(hero, slot, itemId);
    this.clearPrimeTimer();
    this.selectedItemId = null;
    this.targetSlot = null;
    this.primed = false;
    this.refresh();
  }

  private commitSell(): void {
    const hero = this.selectedHero();
    const slot = this.targetSlot ?? this.selectedSlot;
    if (!hero) return;
    if (isGeneralSlot(slot)) this.battleScene.sellPotionFromHero(hero, slot);
    else this.battleScene.sellGearFromHero(hero, slot);
    this.clearPrimeTimer();
    this.selectedItemId = null;
    this.targetSlot = null;
    this.primed = false;
    this.refresh();
  }

  // D-154-style convention (see uiTheme.ts, CharacterSheetScene): destroy
  // and redraw everything on every state change rather than patching
  // individual objects — simpler to keep correct than incremental updates,
  // and this scene's content is cheap enough to fully rebuild on a click.
  private refresh(): void {
    for (const obj of this.contentObjects) obj.destroy();
    this.contentObjects = [];
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);

    drawScreenBackdrop(this);
    const { width, height } = getViewport(this);

    this.add
      .text(width / 2, 40, "The Armory", { fontFamily: FONT_DISPLAY, fontSize: "34px", color: "#f0dfa8", fontStyle: "bold" })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    createOrnateButton(this, 120, 40, 160, 44, "Close (Esc)", () => this.close(), { variant: "tool", depth: 5 });

    const hero = this.selectedHero();
    const goldLabel = hero ? `Gold: ${this.battleScene.goldFor(hero)}g` : "Gold: —";
    this.add
      .text(width - 130, 40, goldLabel, { fontFamily: FONT_BODY, fontSize: "20px", color: "#fff3d0" })
      .setOrigin(0.5)
      .setDepth(5);

    const contentX = SIDEBAR_X + SIDEBAR_WIDTH + CONTENT_GAP;
    const contentWidth = width - contentX - 40;

    const showHandsSubFilters = isHandsFilter(this.selectedSlot);
    this.extraFilterOffset = 34 + (showHandsSubFilters ? 34 : 0);

    this.buildHeroSidebar(height);
    this.buildShopHeader(contentX);
    this.buildSlotTabs(contentX, contentWidth);
    this.buildRarityFilterRow(contentX, contentWidth);
    if (showHandsSubFilters) this.buildHandsSubFilterRow(contentX, contentWidth);
    this.buildCompareStrip(contentX, contentWidth);
    this.buildCatalog(contentX, contentWidth);

    this.contentObjects = this.children.list.filter((c) => !before.has(c));
  }

  /**
   * The left-hand hero list: compact cards stacked vertically, each with a
   * 6x2 paperdoll of colored/bordered cells only — no per-cell item text.
   * Item detail for whichever slot is active lives in the compare strip
   * instead, which is what keeps this legible at sidebar width; the original
   * ship crammed both the slot label AND the occupant's name into every
   * ~90px-wide cell across 4 full-size hero cards in a single row, which is
   * the clutter Kevin flagged against the agreed mockup.
   */
  private buildHeroSidebar(height: number): void {
    const heroes = this.battleScene.shopHeroes();
    const sidebarCenterX = SIDEBAR_X + SIDEBAR_WIDTH / 2;
    if (heroes.length === 0) {
      this.add
        .text(sidebarCenterX, CONTENT_TOP + 40, "No hero is available to shop for.", { fontFamily: FONT_BODY, fontSize: "16px", color: CREAM, wordWrap: { width: SIDEBAR_WIDTH } })
        .setOrigin(0.5, 0)
        .setDepth(3);
      return;
    }

    const gap = 14;
    const availableHeight = height - CONTENT_TOP - CONTENT_BOTTOM_MARGIN;
    const cardHeight = Math.min(260, (availableHeight - gap * (heroes.length - 1)) / heroes.length);
    const headerHeight = 42;

    heroes.forEach((hero, i) => {
      const cardTop = CONTENT_TOP + i * (cardHeight + gap);
      const isActiveHero = hero.id === this.selectedHeroId;

      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0x2a1d12, 1);
      g.fillRoundedRect(SIDEBAR_X, cardTop, SIDEBAR_WIDTH, cardHeight, 6);
      g.lineStyle(2, isActiveHero ? 0xe8c25a : 0x5a4222, 1);
      g.strokeRoundedRect(SIDEBAR_X, cardTop, SIDEBAR_WIDTH, cardHeight, 6);

      const headerHit = this.add
        .rectangle(sidebarCenterX, cardTop + headerHeight / 2, SIDEBAR_WIDTH, headerHeight, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      headerHit.on("pointerdown", () => this.navigateTo(hero.id, this.selectedSlot));

      const classLabel = hero.classId ? getClassDefinition(hero.classId).name : "Adventurer";
      this.add
        .text(SIDEBAR_X + 14, cardTop + 6, hero.name, { fontFamily: FONT_BODY, fontSize: "16px", color: isActiveHero ? "#fff3d0" : CREAM, fontStyle: "bold" })
        .setDepth(3);
      this.add
        .text(SIDEBAR_X + 14, cardTop + 25, `${classLabel} · Lv ${hero.level}`, { fontFamily: FONT_BODY, fontSize: "11px", color: "#a89058" })
        .setDepth(3);

      // 6x2 paperdoll grid.
      const gridTop = cardTop + headerHeight + 6;
      const gridPad = 12;
      const cols = PAPERDOLL_ROWS[0].length;
      const cellGap = 4;
      const cellWidth = (SIDEBAR_WIDTH - gridPad * 2 - cellGap * (cols - 1)) / cols;
      const cellHeight = Math.max(28, Math.min(40, (cardHeight - headerHeight - 6 - gridPad - cellGap) / 2));

      PAPERDOLL_ROWS.forEach((row, rowIdx) => {
        row.forEach((slot, colIdx) => {
          const sx = SIDEBAR_X + gridPad + colIdx * (cellWidth + cellGap) + cellWidth / 2;
          const sy = gridTop + rowIdx * (cellHeight + cellGap) + cellHeight / 2;
          const occupantId = this.occupantOf(hero, slot);
          const isActiveSlot = isActiveHero && normalizeFilterSlot(slot) === this.selectedSlot;

          const cellG = this.add.graphics().setDepth(3);
          cellG.fillStyle(isActiveSlot ? 0x3a2c14 : 0x1a1108, 1);
          cellG.fillRoundedRect(sx - cellWidth / 2, sy - cellHeight / 2, cellWidth, cellHeight, 3);
          cellG.lineStyle(isActiveSlot ? 2 : 1, isActiveSlot ? 0xe8c25a : occupantId ? 0x9a7a3e : 0x4a3a24, 1);
          cellG.strokeRoundedRect(sx - cellWidth / 2, sy - cellHeight / 2, cellWidth, cellHeight, 3);

          const hit = this.add
            .rectangle(sx, sy, cellWidth, cellHeight, 0xffffff, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(4);
          hit.on("pointerdown", () => this.navigateTo(hero.id, slot));

          this.add
            .text(sx, sy, slotLabel(slot), {
              fontFamily: FONT_BODY,
              fontSize: "8px",
              color: isActiveSlot ? "#fff3d0" : occupantId ? "#d8c090" : "#6a5a3e",
              align: "center",
              wordWrap: { width: cellWidth - 4 },
            })
            .setOrigin(0.5)
            .setDepth(5);
        });
      });
    });
  }

  private buildShopHeader(contentX: number): void {
    const hero = this.selectedHero();
    const label = hero ? `Shopping for ${hero.name} — ${filterLabel(this.selectedSlot)}` : "Shopping";
    this.add
      .text(contentX, CONTENT_TOP - 8, label, { fontFamily: FONT_DISPLAY, fontSize: "20px", color: "#f0dfa8" })
      .setOrigin(0, 1)
      .setDepth(3);
  }

  /** One shared row of slot tabs (wraps to a second row) for the selected hero — not duplicated per hero like the original ship. */
  private buildSlotTabs(contentX: number, contentWidth: number): void {
    const chipWidth = 118;
    const rowGap = 8;
    const half = Math.ceil(ALL_ARMORY_FILTERS.length / 2);
    const rows = [ALL_ARMORY_FILTERS.slice(0, half), ALL_ARMORY_FILTERS.slice(half)];
    const topY = CONTENT_TOP + 24;

    rows.forEach((rowSlots, rowIdx) => {
      const { xs, itemWidth } = centeredRowX(rowSlots.length, chipWidth, 8, contentX + contentWidth / 2, contentWidth);
      const y = topY + rowIdx * (34 + rowGap);
      rowSlots.forEach((slot, i) => {
        const active = slot === this.selectedSlot;
        createOrnateButton(this, xs[i], y, itemWidth, 34, filterLabel(slot), () => {
          const hero = this.selectedHero();
          this.navigateTo(hero?.id ?? this.selectedHeroId ?? "", slot);
        }, { variant: "tab", fontSize: 12, depth: 4 }).setSelected(active);
      });
    });
  }

  /** D-233: rarity + Magic Only — always shown, every tab, and (unlike everything else in this scene) deliberately survives a tab switch. */
  private buildRarityFilterRow(contentX: number, contentWidth: number): void {
    const options: Array<{ id: EquipmentRarity | "all"; label: string }> = [
      { id: "all", label: "All Rarities" },
      { id: "common", label: "Common" },
      { id: "uncommon", label: "Uncommon" },
      { id: "rare", label: "Rare" },
      { id: "veryRare", label: RARITY_LABELS.veryRare },
      { id: "legendary", label: "Legendary" },
    ];
    const chipWidth = 96;
    const y = CONTENT_TOP + 94;
    const { xs, itemWidth } = centeredRowX(options.length + 1, chipWidth, 6, contentX + contentWidth / 2, contentWidth);
    options.forEach((opt, i) => {
      createOrnateButton(this, xs[i], y, itemWidth, 28, opt.label, () => {
        this.rarityFilter = opt.id;
        this.catalogScrollOffset = 0;
        this.refresh();
      }, { variant: "tab", fontSize: 10, depth: 4 }).setSelected(this.rarityFilter === opt.id);
    });
    createOrnateButton(this, xs[options.length], y, itemWidth, 28, "✦ Magic Only", () => {
      this.magicOnlyFilter = !this.magicOnlyFilter;
      this.catalogScrollOffset = 0;
      this.refresh();
    }, { variant: "tab", fontSize: 10, depth: 4 }).setSelected(this.magicOnlyFilter);
  }

  /** D-233 (item 5's extra layer): Hands-only category/weapon-type/grip chips — one row, `centeredRowX` shrinks chip width to fit rather than overflowing. */
  private buildHandsSubFilterRow(contentX: number, contentWidth: number): void {
    const categories: Array<{ id: HandsCategory | "all"; label: string }> = [
      { id: "all", label: "All" },
      { id: "melee", label: "Melee" },
      { id: "ranged", label: "Ranged" },
      { id: "shield", label: "Shields" },
      { id: "focus", label: "Spell Focus" },
    ];
    const weaponCategories: Array<{ id: WeaponCategory | "all"; label: string }> = [
      { id: "all", label: "Any Type" },
      { id: "simple", label: "Simple" },
      { id: "martial", label: "Martial" },
    ];
    const grips: Array<{ id: WeaponGrip | "all"; label: string }> = [
      { id: "all", label: "Any Grip" },
      { id: "oneHanded", label: "1H" },
      { id: "twoHanded", label: "2H" },
    ];
    const total = categories.length + weaponCategories.length + grips.length;
    const chipWidth = 84;
    const y = CONTENT_TOP + 94 + 34;
    const { xs, itemWidth } = centeredRowX(total, chipWidth, 6, contentX + contentWidth / 2, contentWidth);
    let i = 0;
    categories.forEach((c) => {
      createOrnateButton(this, xs[i++], y, itemWidth, 26, c.label, () => {
        this.handsCategoryFilter = c.id;
        this.catalogScrollOffset = 0;
        this.refresh();
      }, { variant: "tab", fontSize: 9, depth: 4 }).setSelected(this.handsCategoryFilter === c.id);
    });
    weaponCategories.forEach((w) => {
      createOrnateButton(this, xs[i++], y, itemWidth, 26, w.label, () => {
        this.weaponCategoryFilter = w.id;
        this.catalogScrollOffset = 0;
        this.refresh();
      }, { variant: "tab", fontSize: 9, depth: 4 }).setSelected(this.weaponCategoryFilter === w.id);
    });
    grips.forEach((g) => {
      createOrnateButton(this, xs[i++], y, itemWidth, 26, g.label, () => {
        this.gripFilter = g.id;
        this.catalogScrollOffset = 0;
        this.refresh();
      }, { variant: "tab", fontSize: 9, depth: 4 }).setSelected(this.gripFilter === g.id);
    });
  }

  private buildCompareStrip(contentX: number, contentWidth: number): void {
    if (isHandsFilter(this.selectedSlot)) {
      this.buildHandsCompareStrip(contentX, contentWidth);
      return;
    }
    const pair = pairSlotsFor(this.selectedSlot);
    if (pair) {
      this.buildPairCompareStrip(contentX, contentWidth, pair);
      return;
    }

    const panelCenterX = contentX + contentWidth / 2;
    const panelTop = CONTENT_TOP + 94 + this.extraFilterOffset;
    const panelWidth = contentWidth;
    const panelHeight = 100;
    drawParchmentPanel(this, panelCenterX, panelTop + panelHeight / 2, panelWidth, panelHeight, 2);

    const hero = this.selectedHero();
    if (!hero) return;
    const potions = isGeneralSlot(this.selectedSlot);
    const occupantId = this.occupantOf(hero, this.selectedSlot);
    const sel = this.selectedItemId;

    const leftX = panelCenterX - panelWidth / 2 + 24;
    this.add
      .text(leftX, panelTop + 14, potions ? "Currently carried" : "Currently equipped", {
        fontFamily: FONT_BODY,
        fontSize: "11px",
        color: INK_MUTED,
      })
      .setDepth(3);
    if (occupantId) {
      this.add.text(leftX, panelTop + 32, itemName(occupantId), { fontFamily: FONT_BODY, fontSize: "16px", color: INK, fontStyle: "bold" }).setDepth(3);
      this.add
        .text(leftX, panelTop + 56, itemDescription(occupantId), { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED, wordWrap: { width: panelWidth * 0.4 } })
        .setDepth(3);
    } else {
      this.add.text(leftX, panelTop + 38, "— empty —", { fontFamily: FONT_BODY, fontSize: "13px", color: INK_MUTED }).setDepth(3);
    }

    const midX = panelCenterX - panelWidth * 0.08;
    this.add.text(midX, panelTop + 14, "Selected", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
    if (sel) {
      this.add.text(midX, panelTop + 32, itemName(sel), { fontFamily: FONT_BODY, fontSize: "16px", color: INK, fontStyle: "bold" }).setDepth(3);
      this.add
        .text(midX, panelTop + 56, itemDescription(sel), { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED, wordWrap: { width: panelWidth * 0.32 } })
        .setDepth(3);
      if (!potions && !isGeneralSlot(this.selectedSlot) && occupantId !== sel) {
        const preview = previewGearSlotChange(hero, this.selectedSlot as GearSlotId, sel);
        this.add
          .text(midX, panelTop + 76, formatGearDelta(preview), { fontFamily: FONT_BODY, fontSize: "11px", color: OK_GREEN, fontStyle: "italic" })
          .setDepth(3);
      }
    } else {
      this.add.text(midX, panelTop + 38, "Pick an item below.", { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED }).setDepth(3);
    }

    if (sel) this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, hero, sel, occupantId, 190, 40, 13);
  }

  /**
   * D-228 (KI-177 items 3/4): the Potions/Rings compare strip — shows BOTH
   * physical slots' current occupants (Kevin's own spec: "they would need
   * to see both potion spots and what occupies them") instead of one. Only
   * rendered when a real choice is needed: an empty-slot auto-place case
   * never reaches here selected-and-unresolved (see `chooseItem`'s
   * `armTarget(decision.slot, true)` branch — it's already primed by the
   * time this runs, same one-click purchase shape a single empty slot has
   * today), so this only really needs to earn its keep for the both-full
   * "which one do I replace" moment.
   */
  private buildPairCompareStrip(contentX: number, contentWidth: number, pair: [ArmorySlotId, ArmorySlotId]): void {
    const panelCenterX = contentX + contentWidth / 2;
    const panelTop = CONTENT_TOP + 94 + this.extraFilterOffset;
    const panelWidth = contentWidth;
    const panelHeight = 100;
    drawParchmentPanel(this, panelCenterX, panelTop + panelHeight / 2, panelWidth, panelHeight, 2);

    const hero = this.selectedHero();
    if (!hero) return;
    const [slotA, slotB] = pair;
    const occupantA = this.occupantOf(hero, slotA);
    const occupantB = this.occupantOf(hero, slotB);
    const sel = this.selectedItemId;
    const potions = isGeneralSlot(slotA);

    const colWidth = panelWidth * 0.27;
    const colAX = panelCenterX - panelWidth / 2 + 24;
    const colBX = colAX + colWidth + 12;
    for (const [x, slot, occupantId] of [
      [colAX, slotA, occupantA],
      [colBX, slotB, occupantB],
    ] as const) {
      this.add.text(x, panelTop + 14, slotLabel(slot), { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
      if (occupantId) {
        this.add
          .text(x, panelTop + 32, itemName(occupantId), { fontFamily: FONT_BODY, fontSize: "14px", color: INK, fontStyle: "bold" })
          .setDepth(3);
        this.add
          .text(x, panelTop + 54, itemDescription(occupantId), { fontFamily: FONT_BODY, fontSize: "10px", color: INK_MUTED, wordWrap: { width: colWidth - 8 } })
          .setDepth(3);
      } else {
        this.add.text(x, panelTop + 38, "— empty —", { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED }).setDepth(3);
      }
    }

    const midX = colBX + colWidth + 4;
    this.add.text(midX, panelTop + 14, "Selected", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
    if (sel) {
      this.add.text(midX, panelTop + 32, itemName(sel), { fontFamily: FONT_BODY, fontSize: "13px", color: INK, fontStyle: "bold" }).setDepth(3);
    } else {
      this.add.text(midX, panelTop + 38, potions ? "Pick a potion below." : "Pick an item below.", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED, wordWrap: { width: panelWidth * 0.16 } }).setDepth(3);
    }

    // Both occupied and a NEW item (not either current occupant) is
    // selected: the player must explicitly choose which slot to replace.
    if (sel && occupantA && occupantB && sel !== occupantA && sel !== occupantB) {
      this.buildPairReplaceButtons(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, hero, sel, [slotA, slotB]);
    } else if (sel) {
      // Either an empty-slot auto-place (already primed) or the selected
      // item IS one of the two occupants (a sell in progress) — both
      // resolve to exactly one target slot, so the shared single-slot
      // button works unchanged.
      const occupantId = sel === occupantA ? occupantA : sel === occupantB ? occupantB : null;
      this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, hero, sel, occupantId, 190, 40, 13);
    }
  }

  /** The two "Replace Potion 1/2"-style buttons for the both-full case — stacked, each computing its own trade-in independently. */
  private buildPairReplaceButtons(x: number, centerY: number, hero: Hero, itemId: string, slots: [ArmorySlotId, ArmorySlotId]): void {
    const cost = itemCost(itemId);
    const buttonHeight = 32;
    const gap = 6;
    slots.forEach((slot, i) => {
      const occupantId = this.occupantOf(hero, slot);
      if (!occupantId) return;
      const tradeIn = sellValueForCost(itemCost(occupantId));
      const netCost = cost - tradeIn;
      const afford = netCost <= this.battleScene.goldFor(hero);
      const primedForThis = this.targetSlot === slot && this.primed;
      const y = centerY - (buttonHeight + gap) / 2 + i * (buttonHeight + gap);
      const label = primedForThis
        ? `Confirm — ${netCost}g net`
        : afford
          ? `Replace ${slotLabel(slot)} — ${netCost}g net`
          : `Need ${netCost}g`;
      createOrnateButton(this, x, y, 220, buttonHeight, label, () => {
        if (primedForThis) this.commitPurchase(itemId);
        else if (afford) this.armTarget(slot, false);
      }, { variant: "tool", fontSize: 12, depth: 5, disabled: !afford && !primedForThis });
    });
  }

  /**
   * D-228 (item 5's base ask): the "Hands" compare strip — always shows
   * BOTH Right hand (weapon) and Left hand (shield), same "see both spots"
   * spec as Potions/Rings, but the action area's shape depends on the
   * SELECTED item's own candidate slot(s) (`decideHandsPlacement`): a real
   * shield or a Two-Handed weapon only ever has one candidate (behaves
   * exactly like a single-slot pick), while a Light melee weapon can have
   * two (needs the same "Replace Right/Left hand" choice Potions/Rings use).
   */
  private buildHandsCompareStrip(contentX: number, contentWidth: number): void {
    const panelCenterX = contentX + contentWidth / 2;
    const panelTop = CONTENT_TOP + 94 + this.extraFilterOffset;
    const panelWidth = contentWidth;
    const panelHeight = 100;
    drawParchmentPanel(this, panelCenterX, panelTop + panelHeight / 2, panelWidth, panelHeight, 2);

    const hero = this.selectedHero();
    if (!hero) return;
    const weaponOccupant = this.occupantOf(hero, "weapon");
    const shieldOccupant = this.occupantOf(hero, "shield");
    const sel = this.selectedItemId;

    const colWidth = panelWidth * 0.27;
    const colAX = panelCenterX - panelWidth / 2 + 24;
    const colBX = colAX + colWidth + 12;
    for (const [x, slot, occupantId] of [
      [colAX, "weapon", weaponOccupant],
      [colBX, "shield", shieldOccupant],
    ] as const) {
      this.add.text(x, panelTop + 14, slotLabel(slot), { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
      if (occupantId) {
        this.add.text(x, panelTop + 32, itemName(occupantId), { fontFamily: FONT_BODY, fontSize: "14px", color: INK, fontStyle: "bold" }).setDepth(3);
        this.add
          .text(x, panelTop + 54, itemDescription(occupantId), { fontFamily: FONT_BODY, fontSize: "10px", color: INK_MUTED, wordWrap: { width: colWidth - 8 } })
          .setDepth(3);
      } else {
        this.add.text(x, panelTop + 38, "— empty —", { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED }).setDepth(3);
      }
    }

    const midX = colBX + colWidth + 4;
    this.add.text(midX, panelTop + 14, "Selected", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
    if (sel) {
      this.add.text(midX, panelTop + 32, itemName(sel), { fontFamily: FONT_BODY, fontSize: "13px", color: INK, fontStyle: "bold" }).setDepth(3);
    } else {
      this.add.text(midX, panelTop + 38, "Pick an item below.", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED, wordWrap: { width: panelWidth * 0.16 } }).setDepth(3);
    }

    if (!sel) return;
    if (sel === weaponOccupant || sel === shieldOccupant) {
      const occupantId = sel === weaponOccupant ? weaponOccupant : shieldOccupant;
      this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, hero, sel, occupantId, 190, 40, 13);
      return;
    }
    const decision = decideHandsPlacement(sel, weaponOccupant, shieldOccupant);
    if (decision.kind === "autoPlace") {
      this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, hero, sel, null, 190, 40, 13);
    } else if (decision.candidateSlots.length === 1) {
      const slot = decision.candidateSlots[0];
      this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, hero, sel, this.occupantOf(hero, slot), 190, 40, 13);
    } else {
      this.buildPairReplaceButtons(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, hero, sel, [decision.candidateSlots[0], decision.candidateSlots[1]]);
    }
  }

  private buildCatalog(contentX: number, contentWidth: number): void {
    const panelCenterX = contentX + contentWidth / 2;
    const panelTop = CONTENT_TOP + 210 + this.extraFilterOffset;
    const panelWidth = contentWidth;
    const rowHeight = 58;
    const rowGap = 8;
    const listHeight = CATALOG_VISIBLE_ROWS * (rowHeight + rowGap) - rowGap + 24;
    drawParchmentPanel(this, panelCenterX, panelTop + listHeight / 2, panelWidth, listHeight, 2);

    const hero = this.selectedHero();
    if (!hero) {
      this.catalogViewportRect = null;
      return;
    }

    // D-228 (KI-177 items 3/4/5): a consolidated Potions/Rings/Hands filter
    // has TWO physical occupants instead of one — everything below that
    // used to read a single `occupantId` now reads `occupantIds` (0-2
    // entries). Hands is asymmetric (see `isHandsFilter`) so it's handled
    // alongside, not through, `pairSlotsFor`'s fixed-pair shape.
    const hands = isHandsFilter(this.selectedSlot);
    const pair = hands ? null : pairSlotsFor(this.selectedSlot);
    const occupantId = pair || hands ? null : this.occupantOf(hero, this.selectedSlot);
    const occupantA = hands ? this.occupantOf(hero, "weapon") : pair ? this.occupantOf(hero, pair[0]) : null;
    const occupantB = hands ? this.occupantOf(hero, "shield") : pair ? this.occupantOf(hero, pair[1]) : null;
    const occupantIds = pair || hands ? [occupantA, occupantB].filter((v): v is string => v !== null) : occupantId ? [occupantId] : [];
    const potions = isGeneralSlot(this.selectedSlot);
    const allIds = this.battleScene.shopVisibleItemIds();
    const eligibleIds = potions
      ? allIds.filter((id) => isPotionItem(id))
      : hands
        ? allIds.filter((id) => !isPotionItem(id) && (isItemEligibleForSlot(id, "weapon") || isItemEligibleForSlot(id, "shield")))
        : allIds.filter((id) => !isPotionItem(id) && isItemEligibleForSlot(id, this.selectedSlot as GearSlotId));
    // D-233: rarity/Magic Only apply on every tab; the Hands-only three only
    // ever leave "all" when this IS the Hands tab (their chips don't even
    // render otherwise), so they're no-ops for every other slot filter.
    // D-235 (item 7): proficiency is likewise Hands-only, and not a chip the
    // player toggles — it's always on for whichever hero is being shopped
    // for, with a footer reporting how many it hid (see below).
    const proficiencyClassId = hands ? (hero.classId ?? null) : null;
    const filters: CatalogFilters = {
      rarity: this.rarityFilter,
      magicOnly: this.magicOnlyFilter,
      handsCategory: hands ? this.handsCategoryFilter : "all",
      weaponCategory: hands ? this.weaponCategoryFilter : "all",
      grip: hands ? this.gripFilter : "all",
      proficiencyClassId,
    };
    const filteredIds = applyCatalogFilters(eligibleIds, itemRarity, filters);
    const proficiencyHiddenCount = proficiencyClassId
      ? applyCatalogFilters(eligibleIds, itemRarity, { ...filters, proficiencyClassId: null }).length - filteredIds.length
      : 0;
    // Either occupant may be a unique/starting item outside the level-gated
    // visible catalog, or hidden by the active filters — still pin it at the
    // top of the list as the Equipped/Carried row so its Sell action is
    // always reachable.
    const missingOccupantIds = occupantIds.filter((id) => !filteredIds.includes(id));
    const list = missingOccupantIds.length > 0 ? [...new Set([...missingOccupantIds, ...filteredIds])] : filteredIds;

    if (list.length === 0) {
      this.catalogViewportRect = null;
      const filtersActive =
        filters.rarity !== "all" || filters.magicOnly || filters.handsCategory !== "all" || filters.weaponCategory !== "all" || filters.grip !== "all";
      const message =
        proficiencyHiddenCount > 0
          ? `No items available (${proficiencyHiddenCount} hidden — not proficient).`
          : filtersActive && eligibleIds.length > 0
            ? "No items match these filters."
            : "Nothing available for this slot yet.";
      this.add
        .text(panelCenterX, panelTop + 30, message, { fontFamily: FONT_BODY, fontSize: "14px", color: INK_MUTED })
        .setOrigin(0.5)
        .setDepth(3);
      return;
    }

    // D-234: scrollable instead of paginated — see `uiScrollList.ts`.
    const rowHeights = list.map(() => rowHeight);
    const totalRowsHeight = scrollContentHeight(rowHeights, rowGap);
    const rowsRect: ScrollListRect = {
      x: panelCenterX - panelWidth / 2 + 10,
      y: panelTop + 12,
      width: panelWidth - 20,
      height: listHeight - 24,
    };
    this.catalogScrollOffset = clampScrollOffset(this.catalogScrollOffset, totalRowsHeight, rowsRect.height);
    this.catalogViewportRect = rowsRect;
    this.catalogContentHeight = totalRowsHeight;

    renderScrollListRows(this, rowsRect, rowHeights, rowGap, this.catalogScrollOffset, 3, (index, rowX, rowTopY, rowWidth) => {
      const id = list[index];
      const objs: Phaser.GameObjects.GameObject[] = [];
      const rowCenterX = rowX + rowWidth / 2;
      const rowCenterY = rowTopY + rowHeight / 2;
      const isOccupant = occupantIds.includes(id);
      const isSelected = this.selectedItemId === id;

      const rowBg = this.add
        .rectangle(rowCenterX, rowCenterY, rowWidth, rowHeight, 0xffffff, isSelected ? 0.18 : 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      rowBg.on("pointerdown", () => this.chooseItem(id));
      objs.push(rowBg);

      // D-233: a thin gold border marks any non-common (magic) row.
      if (isMagicItem(itemRarity(id))) {
        objs.push(
          this.add
            .graphics()
            .lineStyle(2, 0xc9a227, 0.9)
            .strokeRect(rowCenterX - rowWidth / 2, rowCenterY - rowHeight / 2, rowWidth, rowHeight)
            .setDepth(3),
        );
      }

      const leftX = rowCenterX - rowWidth / 2 + 16;
      objs.push(
        this.add
          .text(leftX, rowCenterY - 8, `${itemName(id)}${rarityTag(id)}`, {
            fontFamily: FONT_BODY,
            fontSize: "15px",
            color: INK,
            fontStyle: isSelected ? "bold" : "normal",
          })
          .setDepth(4),
      );
      objs.push(
        this.add
          .text(leftX, rowCenterY + 12, itemDescription(id), { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED, wordWrap: { width: rowWidth - 260 } })
          .setDepth(4),
      );

      if (isOccupant) {
        objs.push(
          this.add
            .text(rowCenterX + rowWidth / 2 - 260, rowCenterY, potions ? "Carried" : "Equipped", {
              fontFamily: FONT_BODY,
              fontSize: "11px",
              color: "#fff3d0",
              backgroundColor: "#2a1a10",
              padding: { x: 6, y: 2 },
            })
            .setOrigin(0, 0.5)
            .setDepth(4),
        );
      } else {
        // For a pair/Hands filter, a row's trade-in is 0 (nothing to sell)
        // when at least one physical slot is still empty (auto-place); once
        // BOTH are full, which occupant gets traded in depends on which the
        // player picks below — not knowable at the row-preview level, so
        // this shows base cost only until that choice is made.
        const cost = itemCost(id);
        const tradeIn = pair || hands ? 0 : occupantId ? sellValueForCost(itemCost(occupantId)) : 0;
        const netCost = cost - tradeIn;
        const afford = netCost <= this.battleScene.goldFor(hero);
        objs.push(
          this.add
            .text(rowCenterX + rowWidth / 2 - 300, rowCenterY, tradeIn > 0 ? `${cost}g  (+${tradeIn}g trade-in)` : `${cost}g`, {
              fontFamily: FONT_BODY,
              fontSize: "12px",
              color: afford ? OK_GREEN : BAD_RED,
            })
            .setOrigin(0, 0.5)
            .setDepth(4),
        );
      }

      const showSelectButton = (): void => {
        // Both candidate slots are full — the real "which one to replace"
        // action lives in the compare strip above once selected here.
        objs.push(
          createOrnateButton(
            this,
            rowCenterX + rowWidth / 2 - 100,
            rowCenterY,
            170,
            34,
            isSelected ? "Selected ▴" : "Select",
            () => this.chooseItem(id),
            { variant: "tool", fontSize: 11, depth: 5, disabled: isSelected },
          ).container,
        );
      };

      if (isOccupant) {
        // Sell branch — works unchanged for a pair/Hands filter too, since
        // `chooseItem` already resolves WHICH physical slot `id` occupies.
        objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, hero, id, id, 170, 34, 11));
      } else if (hands) {
        const decision = decideHandsPlacement(id, occupantA, occupantB);
        if (decision.kind === "autoPlace") {
          objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, hero, id, null, 170, 34, 11));
        } else if (decision.candidateSlots.length === 1) {
          // Only one possible slot (a real shield, or a non-Light weapon) —
          // behaves exactly like a single-slot Compare-then-Purchase.
          objs.push(
            this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, hero, id, this.occupantOf(hero, decision.candidateSlots[0]), 170, 34, 11),
          );
        } else {
          showSelectButton();
        }
      } else if (!pair) {
        objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, hero, id, occupantId, 170, 34, 11));
      } else {
        const decision = decideSlotPairPlacement(occupantA, occupantB, pair[0], pair[1]);
        if (decision.kind === "autoPlace") {
          objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, hero, id, null, 170, 34, 11));
        } else {
          showSelectButton();
        }
      }

      return objs;
    });

    renderScrollbarVisual(this, rowsRect, totalRowsHeight, this.catalogScrollOffset, 3, (offset) => {
      this.catalogScrollOffset = offset;
      this.refresh();
    });

    // D-235 (item 7): a one-line footer rather than a toggle — matches this
    // project's own existing convention that a gear-point overspend item
    // "simply doesn't appear in the list at all" (CharacterCreationScene
    // .refreshGearPicker), just with a count so it doesn't read as a bug.
    if (proficiencyHiddenCount > 0) {
      this.add
        .text(panelCenterX, panelTop + listHeight + 14, `${proficiencyHiddenCount} hidden — not proficient`, {
          fontFamily: FONT_BODY,
          fontSize: "12px",
          color: INK_MUTED,
          fontStyle: "italic",
        })
        .setOrigin(0.5)
        .setDepth(3);
    }
  }

  /**
   * The one shared action button shape (row or compare strip): an empty
   * slot's item buys directly; an occupied slot's occupant sells (delayed
   * confirm); any other item in an occupied slot compares first, then buys
   * (delayed confirm) — see this scene's own doc comment for the full rule.
   */
  private buildActionButton(
    x: number,
    y: number,
    hero: Hero,
    id: string,
    occupantId: string | null,
    width: number,
    height: number,
    fontSize: number,
  ): Phaser.GameObjects.Container {
    const isOccupant = occupantId === id;
    const isSelected = this.selectedItemId === id;
    const primedForThis = isSelected && this.primed;

    if (isOccupant) {
      const sellVal = sellValueForCost(itemCost(id));
      const label = primedForThis ? `Confirm Sell +${sellVal}g` : `Sell — ${sellVal}g`;
      return createOrnateButton(this, x, y, width, height, label, () => {
        if (primedForThis) this.commitSell();
        else this.chooseItem(id);
      }, { variant: "tool", fontSize, depth: 5 }).container;
    }

    const cost = itemCost(id);
    const tradeIn = occupantId ? sellValueForCost(itemCost(occupantId)) : 0;
    const netCost = cost - tradeIn;
    const afford = netCost <= this.battleScene.goldFor(hero);
    const needsCompareStep = !!occupantId;

    if (!needsCompareStep || primedForThis) {
      let label: string;
      if (!afford) label = `Need ${netCost}g`;
      else if (netCost > 0) label = `Purchase — ${netCost}g net`;
      else if (netCost < 0) label = `Purchase (+${-netCost}g back)`;
      else label = "Purchase — free";
      return createOrnateButton(this, x, y, width, height, label, () => {
        if (!afford) return;
        // A fresh, not-yet-primed click resolves `targetSlot` via
        // `chooseItem` first — for a consolidated Potions/Rings filter
        // (see `pairSlotsFor`) that's what picks the actual empty physical
        // slot rather than trusting a possibly-stale `targetSlot`. Skipped
        // once already `primedForThis`, which would otherwise restart its
        // delay timer instead of confirming.
        if (!needsCompareStep) this.chooseItem(id);
        this.commitPurchase(id);
      }, { variant: "tool", fontSize, depth: 5, disabled: !afford }).container;
    }
    return createOrnateButton(this, x, y, width, height, "Compare", () => this.chooseItem(id), { variant: "tool", fontSize, depth: 5 }).container;
  }
}
