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
import { POTION_DEFINITIONS, getPotionDefinition, GENERAL_SLOT_LABELS, type GeneralSlotId } from "../data/potions";
import { sellValueForCost } from "../systems/EconomySystem";
import { isItemEligibleForSlot, previewGearSlotChange, formatGearDelta } from "../systems/GearCompareSystem";
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
 * Holds NO game-rule logic itself — every read (`shopHeroes`/
 * `shopVisibleItemIds`/`goldFor`) and every mutation (`buyGearForHero`/
 * `sellGearFromHero`/`buyPotionForHero`/`sellPotionFromHero`) goes through
 * the live `BattleScene` passed in via `init(data)`, mirroring
 * `CharacterSheetScene`'s "call back into the paused scene" precedent
 * rather than duplicating validation here.
 */

const PRIME_DELAY_MS = 650;
const CATALOG_PAGE_SIZE = 6;

type ArmorySlotId = GearSlotId | GeneralSlotId;

/** 6 columns x 2 rows — the two Potion slots sit in the rightmost column, next to Legs/Footwear, per the agreed design. */
const PAPERDOLL_ROWS: ArmorySlotId[][] = [
  ["weapon", "shield", "head", "chest", "legs", "general1"],
  ["back", "ring1", "ring2", "amulet", "footwear", "general2"],
];
const ALL_ARMORY_SLOTS: ArmorySlotId[] = PAPERDOLL_ROWS.flat();

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
  private primed = false;
  private primeTimer: Phaser.Time.TimerEvent | null = null;
  private catalogPage = 0;
  private contentObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("GearShopScene");
  }

  init(data: GearShopSceneData): void {
    this.battleScene = data.battleScene;
    this.selectedHeroId = this.battleScene.shopHeroes()[0]?.id ?? null;
    this.selectedSlot = "weapon";
    this.selectedItemId = null;
    this.primed = false;
    this.catalogPage = 0;
  }

  create(): void {
    this.input.keyboard?.on("keydown-ESC", () => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearPrimeTimer();
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.refresh());
    this.refresh();
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
    this.selectedSlot = slot;
    this.selectedItemId = null;
    this.primed = false;
    this.catalogPage = 0;
    this.refresh();
  }

  /** Clicking a catalog row (or its Compare/Sell button): explicitly choosing an item to look at. */
  private chooseItem(itemId: string): void {
    this.clearPrimeTimer();
    this.selectedItemId = itemId;
    const hero = this.selectedHero();
    const occupant = hero ? this.occupantOf(hero, this.selectedSlot) : null;
    if (!occupant) {
      this.primed = true;
    } else {
      this.primed = false;
      this.primeTimer = this.time.delayedCall(PRIME_DELAY_MS, () => {
        this.primed = true;
        this.refresh();
      });
    }
    this.refresh();
  }

  private commitPurchase(itemId: string): void {
    const hero = this.selectedHero();
    if (!hero) return;
    if (isGeneralSlot(this.selectedSlot)) this.battleScene.buyPotionForHero(hero, this.selectedSlot, itemId);
    else this.battleScene.buyGearForHero(hero, this.selectedSlot, itemId);
    this.clearPrimeTimer();
    this.selectedItemId = null;
    this.primed = false;
    this.refresh();
  }

  private commitSell(): void {
    const hero = this.selectedHero();
    if (!hero) return;
    if (isGeneralSlot(this.selectedSlot)) this.battleScene.sellPotionFromHero(hero, this.selectedSlot);
    else this.battleScene.sellGearFromHero(hero, this.selectedSlot);
    this.clearPrimeTimer();
    this.selectedItemId = null;
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
    const { width } = getViewport(this);

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

    this.buildHeroRail(width);
    this.buildSlotChips(width);
    this.buildCompareStrip(width);
    this.buildCatalog(width);

    this.contentObjects = this.children.list.filter((c) => !before.has(c));
  }

  private buildHeroRail(width: number): void {
    const heroes = this.battleScene.shopHeroes();
    if (heroes.length === 0) {
      this.add
        .text(width / 2, 140, "No hero is available to shop for.", { fontFamily: FONT_BODY, fontSize: "18px", color: CREAM })
        .setOrigin(0.5)
        .setDepth(3);
      return;
    }

    const cardWidth = 280;
    const cardHeight = 260;
    const top = 92;
    const { xs } = centeredRowX(heroes.length, cardWidth, 16, width / 2, width - 80);

    heroes.forEach((hero, i) => {
      const cx = xs[i];
      const isActiveHero = hero.id === this.selectedHeroId;
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0x2a1d12, 1);
      g.fillRoundedRect(cx - cardWidth / 2, top, cardWidth, cardHeight, 6);
      g.lineStyle(2, isActiveHero ? 0xe8c25a : 0x5a4222, 1);
      g.strokeRoundedRect(cx - cardWidth / 2, top, cardWidth, cardHeight, 6);
      const headerHit = this.add
        .rectangle(cx, top + 20, cardWidth, 40, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      headerHit.on("pointerdown", () => this.navigateTo(hero.id, this.selectedSlot));

      this.add
        .text(cx - cardWidth / 2 + 14, top + 12, `${hero.name}  ·  Lv ${hero.level}`, {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: isActiveHero ? "#fff3d0" : CREAM,
          fontStyle: "bold",
        })
        .setDepth(3);

      // 6x2 paperdoll grid.
      const gridTop = top + 44;
      const gridPad = 12;
      const cols = PAPERDOLL_ROWS[0].length;
      const cellGap = 4;
      const cellWidth = (cardWidth - gridPad * 2 - cellGap * (cols - 1)) / cols;
      const cellHeight = 96;

      PAPERDOLL_ROWS.forEach((row, rowIdx) => {
        row.forEach((slot, colIdx) => {
          const sx = cx - cardWidth / 2 + gridPad + colIdx * (cellWidth + cellGap) + cellWidth / 2;
          const sy = gridTop + rowIdx * (cellHeight + cellGap) + cellHeight / 2;
          const occupantId = this.occupantOf(hero, slot);
          const isActiveSlot = isActiveHero && slot === this.selectedSlot;

          const cellG = this.add.graphics().setDepth(3);
          cellG.fillStyle(0x1a1108, 1);
          cellG.fillRoundedRect(sx - cellWidth / 2, sy - cellHeight / 2, cellWidth, cellHeight, 3);
          cellG.lineStyle(isActiveSlot ? 2 : 1, isActiveSlot ? 0xe8c25a : occupantId ? 0x9a7a3e : 0x5a4222, 1);
          cellG.strokeRoundedRect(sx - cellWidth / 2, sy - cellHeight / 2, cellWidth, cellHeight, 3);

          const hit = this.add
            .rectangle(sx, sy, cellWidth, cellHeight, 0xffffff, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(4);
          hit.on("pointerdown", () => this.navigateTo(hero.id, slot));

          this.add
            .text(sx, sy - cellHeight / 2 + 12, slotLabel(slot), {
              fontFamily: FONT_BODY,
              fontSize: "10px",
              color: isActiveSlot ? "#fff3d0" : "#a89058",
              align: "center",
              wordWrap: { width: cellWidth - 6 },
            })
            .setOrigin(0.5, 0)
            .setDepth(5);

          this.add
            .text(sx, sy + 6, occupantId ? itemName(occupantId) : "— empty —", {
              fontFamily: FONT_BODY,
              fontSize: "10.5px",
              color: occupantId ? "#f0e6c8" : "#5a4a34",
              align: "center",
              wordWrap: { width: cellWidth - 6 },
            })
            .setOrigin(0.5, 0)
            .setDepth(5);
        });
      });
    });
  }

  private buildSlotChips(width: number): void {
    const chipWidth = 96;
    const { xs, itemWidth } = centeredRowX(ALL_ARMORY_SLOTS.length, chipWidth, 8, width / 2, width - 80);
    const y = 372;
    ALL_ARMORY_SLOTS.forEach((slot, i) => {
      const active = slot === this.selectedSlot;
      createOrnateButton(this, xs[i], y, itemWidth, 34, slotLabel(slot), () => {
        const hero = this.selectedHero();
        this.navigateTo(hero?.id ?? this.selectedHeroId ?? "", slot);
      }, { variant: "tab", fontSize: 11, depth: 4 }).setSelected(active);
    });
  }

  private buildCompareStrip(width: number): void {
    const panelCenterX = width / 2;
    const panelTop = 410;
    const panelWidth = width - 100;
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

  private buildCatalog(width: number): void {
    const panelCenterX = width / 2;
    const panelTop = 528;
    const panelWidth = width - 100;
    const rowHeight = 58;
    const rowGap = 8;
    const listHeight = CATALOG_PAGE_SIZE * (rowHeight + rowGap) - rowGap + 24;
    drawParchmentPanel(this, panelCenterX, panelTop + listHeight / 2, panelWidth, listHeight, 2);

    const hero = this.selectedHero();
    if (!hero) return;

    const occupantId = this.occupantOf(hero, this.selectedSlot);
    const potions = isGeneralSlot(this.selectedSlot);
    const allIds = this.battleScene.shopVisibleItemIds();
    const eligibleIds = potions
      ? allIds.filter((id) => isPotionItem(id))
      : allIds.filter((id) => !isPotionItem(id) && isItemEligibleForSlot(id, this.selectedSlot as GearSlotId));
    // The occupant may be a unique/starting item outside the level-gated
    // visible catalog — still pin it at the top of the list as the
    // Equipped/Carried row so its Sell action is always reachable.
    const list = occupantId && !eligibleIds.includes(occupantId) ? [occupantId, ...eligibleIds] : eligibleIds;

    if (list.length === 0) {
      this.add
        .text(panelCenterX, panelTop + 30, "Nothing available for this slot yet.", { fontFamily: FONT_BODY, fontSize: "14px", color: INK_MUTED })
        .setOrigin(0.5)
        .setDepth(3);
      return;
    }

    const pageCount = Math.max(1, Math.ceil(list.length / CATALOG_PAGE_SIZE));
    const page = Math.min(this.catalogPage, pageCount - 1);
    const pageItems = list.slice(page * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE + CATALOG_PAGE_SIZE);

    pageItems.forEach((id, idx) => {
      const rowY = panelTop + 12 + idx * (rowHeight + rowGap) + rowHeight / 2;
      const isOccupant = occupantId === id;
      const isSelected = this.selectedItemId === id;

      const rowBg = this.add
        .rectangle(panelCenterX, rowY, panelWidth - 20, rowHeight, 0xffffff, isSelected ? 0.18 : 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      rowBg.on("pointerdown", () => this.chooseItem(id));

      const leftX = panelCenterX - panelWidth / 2 + 16;
      this.add
        .text(leftX, rowY - 8, `${itemName(id)}${rarityTag(id)}`, {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: INK,
          fontStyle: isSelected ? "bold" : "normal",
        })
        .setDepth(4);
      this.add
        .text(leftX, rowY + 12, itemDescription(id), { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED, wordWrap: { width: panelWidth - 260 } })
        .setDepth(4);

      if (isOccupant) {
        this.add
          .text(panelCenterX + panelWidth / 2 - 260, rowY, potions ? "Carried" : "Equipped", {
            fontFamily: FONT_BODY,
            fontSize: "11px",
            color: "#fff3d0",
            backgroundColor: "#2a1a10",
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0, 0.5)
          .setDepth(4);
      } else {
        const cost = itemCost(id);
        const tradeIn = occupantId ? sellValueForCost(itemCost(occupantId)) : 0;
        const netCost = cost - tradeIn;
        const afford = netCost <= this.battleScene.goldFor(hero);
        this.add
          .text(panelCenterX + panelWidth / 2 - 300, rowY, tradeIn > 0 ? `${cost}g  (+${tradeIn}g trade-in)` : `${cost}g`, {
            fontFamily: FONT_BODY,
            fontSize: "12px",
            color: afford ? OK_GREEN : BAD_RED,
          })
          .setOrigin(0, 0.5)
          .setDepth(4);
      }

      this.buildActionButton(panelCenterX + panelWidth / 2 - 100, rowY, hero, id, occupantId, 170, 34, 11);
    });

    if (pageCount > 1) {
      const navY = panelTop + listHeight + 24;
      createOrnateButton(this, panelCenterX - 90, navY, 110, 34, "< Prev", () => {
        if (page > 0) {
          this.catalogPage = page - 1;
          this.refresh();
        }
      }, { variant: "tool", fontSize: 12, depth: 4, disabled: page === 0 });
      this.add
        .text(panelCenterX, navY, `Page ${page + 1}/${pageCount}`, { fontFamily: FONT_BODY, fontSize: "13px", color: CREAM })
        .setOrigin(0.5)
        .setDepth(4);
      createOrnateButton(this, panelCenterX + 90, navY, 110, 34, "Next >", () => {
        if (page < pageCount - 1) {
          this.catalogPage = page + 1;
          this.refresh();
        }
      }, { variant: "tool", fontSize: 12, depth: 4, disabled: page === pageCount - 1 });
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
  ): void {
    const isOccupant = occupantId === id;
    const isSelected = this.selectedItemId === id;
    const primedForThis = isSelected && this.primed;

    if (isOccupant) {
      const sellVal = sellValueForCost(itemCost(id));
      const label = primedForThis ? `Confirm Sell +${sellVal}g` : `Sell — ${sellVal}g`;
      createOrnateButton(this, x, y, width, height, label, () => {
        if (primedForThis) this.commitSell();
        else this.chooseItem(id);
      }, { variant: "tool", fontSize, depth: 5 });
      return;
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
      createOrnateButton(this, x, y, width, height, label, () => {
        if (afford) this.commitPurchase(id);
      }, { variant: "tool", fontSize, depth: 5, disabled: !afford });
    } else {
      createOrnateButton(this, x, y, width, height, "Compare", () => this.chooseItem(id), { variant: "tool", fontSize, depth: 5 });
    }
  }
}
