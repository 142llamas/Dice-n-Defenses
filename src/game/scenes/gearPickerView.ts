import Phaser from "phaser";
import { FONT_DISPLAY, FONT_BODY, createOrnateButton, drawParchmentPanel, centeredRowX, getViewport } from "./uiTheme";
import { Hero } from "../entities/Hero";
import { getEquipmentDefinition, GEAR_SLOT_LABELS, RARITY_LABELS, type GearSlotId, type EquipmentRarity } from "../data/equipment";
import { getPotionDefinition, GENERAL_SLOT_LABELS, type GeneralSlotId } from "../data/potions";
import { isItemEligibleForSlot, previewGearSlotChange, formatGearDelta } from "../systems/GearCompareSystem";
import { isPotionId } from "../systems/LootSystem";
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

/**
 * gearPickerView — Batch D (items 3/5 of the 2026-09-09 playtest list):
 * the shared rendering component `GearShopScene` ("The Armory") and
 * `CharacterCreationScene`'s gear picker both drive, extracted from
 * `GearShopScene`'s original all-in-one implementation. Neither scene
 * duplicates this rendering layer anymore — each supplies its own
 * `GearPickerBackend` (heroes, catalog source, economy, mutate actions) and
 * this class owns the sidebar/tabs/filters/compare-strip/catalog UI and the
 * select→(delay)→confirm interaction shape, identically for both.
 *
 * Two economy shapes exist today (`goldEconomy`/`FREE_ECONOMY` below): gold
 * (the Armory, both the in-battle one and the between-missions
 * `CampaignArmoryScene` — real currency, half-cost trade-in, a
 * `PRIME_DELAY_MS` anti-misclick delay before a purchase/sale commits), and
 * free (Character Creation's Free Play heroes — no budget concept at all,
 * every pick always affordable). Both go through the exact same
 * select→confirm two-click shape — only the delay and the cost/credit
 * numbers shown differ; see `GearPickerEconomy`. A third shape, a "Gear
 * Points" budget for Character Creation's campaign PC, existed here until
 * `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` Plan 5 (D-246) retired it in favor of
 * a fixed per-class starting kit.
 */

const PRIME_DELAY_MS = 650;
const CATALOG_VISIBLE_ROWS = 9;

const SIDEBAR_X = 40;
const SIDEBAR_WIDTH = 300;
const CONTENT_GAP = 24;
const CONTENT_TOP = 100;
const CONTENT_BOTTOM_MARGIN = 40;

export type ArmorySlotId = GearSlotId | GeneralSlotId;

/** D-228: "general2"/"ring2"/"shield" are never a filter/tab themselves — they normalize to their group's first slot. Hands is asymmetric (see `isHandsFilter`), so it's not in here. */
const SLOT_GROUP: Partial<Record<ArmorySlotId, ArmorySlotId>> = { general2: "general1", ring2: "ring1", shield: "weapon" };

export function normalizeFilterSlot(slot: ArmorySlotId): ArmorySlotId {
  return SLOT_GROUP[slot] ?? slot;
}

function isGeneralSlot(slot: ArmorySlotId): slot is GeneralSlotId {
  return slot === "general1" || slot === "general2";
}

function slotLabel(slot: ArmorySlotId): string {
  return isGeneralSlot(slot) ? GENERAL_SLOT_LABELS[slot] : GEAR_SLOT_LABELS[slot];
}

/** Non-null only for a slot heading a FIXED consolidated pair (Potions/Rings) — the two physical slots it represents, in display order. Hands is handled separately (see `isHandsFilter`). */
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

function itemName(itemId: string): string {
  return isPotionId(itemId) ? getPotionDefinition(itemId).name : getEquipmentDefinition(itemId).name;
}

function itemGoldCost(itemId: string): number {
  return isPotionId(itemId) ? getPotionDefinition(itemId).cost : getEquipmentDefinition(itemId).cost;
}

function itemRarity(itemId: string): EquipmentRarity {
  return isPotionId(itemId) ? getPotionDefinition(itemId).rarity : getEquipmentDefinition(itemId).rarity;
}

function itemDescription(itemId: string): string {
  return isPotionId(itemId) ? getPotionDefinition(itemId).description : getEquipmentDefinition(itemId).description;
}

function rarityTag(itemId: string): string {
  const rarity = itemRarity(itemId);
  return rarity === "common" ? "" : ` · ${RARITY_LABELS[rarity]}`;
}

const INK = "#2a1a10";
const INK_MUTED = "#6a4a2a";
const CREAM = "#f0e6c8";
const OK_GREEN = "#2f5a34";
const BAD_RED = "#a34a3a";

/**
 * How this picker's "can I have this" economy works. `remainingFor` returns
 * `null` for an unbudgeted hero (always affordable, no cost UI at all).
 * `creditFor` is what giving up an already-equipped item is worth — half
 * cost for gold (a real trade-in), meaningless for free (never displayed,
 * `remainingFor` is always null so no row ever needs it).
 */
export interface GearPickerEconomy {
  /** Header readout (top-right), e.g. "Gold: 45g" / "Gear Points: 6/9"; null hides it entirely. */
  headerLabel(heroId: string): string | null;
  /** Remaining budget for a hero+slot right now; null = unlimited. */
  remainingFor(heroId: string, slot: ArmorySlotId): number | null;
  costOf(itemId: string): number;
  creditFor(itemId: string): number;
  formatAmount(n: number): string;
  /** Only real, semi-irreversible spending (gold) needs the anti-misclick delay. */
  requiresConfirmDelay: boolean;
  verbs: { acquire: string; release: string };
}

export function goldEconomy(goldFor: (heroId: string) => number, sellValueForCost: (cost: number) => number): GearPickerEconomy {
  return {
    headerLabel: (heroId) => `Gold: ${goldFor(heroId)}g`,
    remainingFor: (heroId) => goldFor(heroId),
    costOf: (itemId) => itemGoldCost(itemId),
    creditFor: (itemId) => sellValueForCost(itemGoldCost(itemId)),
    formatAmount: (n) => `${n}g`,
    requiresConfirmDelay: true,
    verbs: { acquire: "Purchase", release: "Sell" },
  };
}

export const FREE_ECONOMY: GearPickerEconomy = {
  headerLabel: () => null,
  remainingFor: () => null,
  costOf: () => 0,
  creditFor: () => 0,
  formatAmount: (n) => `${n}`,
  requiresConfirmDelay: false,
  verbs: { acquire: "Equip", release: "Unequip" },
};

export interface GearPickerHeroSummary {
  id: string;
  name: string;
  subtitle: string;
}

export interface GearPickerBackend {
  /** Header title, e.g. "The Armory" / "Party Gear". */
  title: string;
  /** Paperdoll grid shape — Character Creation's has no Potions column, unlike the Armory's 6x2. */
  paperdollRows: ArmorySlotId[][];
  economy: GearPickerEconomy;
  heroes(): GearPickerHeroSummary[];
  /** A Hero-shaped read of this hero's current equipped items/potions, for occupant lookups and AC/attack-delta previews. */
  heroForPreview(heroId: string): Hero | null;
  /** Every item id this backend could ever offer, unfiltered by slot/rarity/proficiency — the view applies those. */
  candidateItemIds(): string[];
  buyGear(heroId: string, slot: GearSlotId, itemId: string): void;
  sellGear(heroId: string, slot: GearSlotId): void;
  buyPotion(heroId: string, slot: GeneralSlotId, itemId: string): void;
  sellPotion(heroId: string, slot: GeneralSlotId): void;
}

export interface GearPickerOptions {
  /** Called when the picker's own Close/Done control is used, or Esc (if the host wires that up) — the host decides what "closing" means (stop+resume a scene, or clear an overlay). */
  onClose: () => void;
  closeLabel?: string;
  /**
   * Every depth this view assigns internally (1-5) gets this added before
   * rendering, uniformly, so a host that's a real empty `Phaser.Scene`
   * (`GearShopScene`) can leave it at 0 while a host that's an OVERLAY
   * inside a busier scene (`CharacterCreationScene`, whose own UI already
   * occupies low depths) can push the whole picker above everything else
   * without this file needing to know what that scene's own depths are.
   */
  depthBase?: number;
  /**
   * Drawn first, before anything else this refresh — a real Scene wants its
   * own themed background (`drawScreenBackdrop`); an in-scene overlay wants
   * a dim, input-blocking rect over whatever's behind it instead. Whatever
   * this creates is swept into the same destroy-and-rebuild/depth-shift
   * handling as everything else, as long as it's created via `scene.add`
   * during this call.
   */
  drawBackdrop?: (scene: Phaser.Scene) => void;
}

/**
 * Owns the picker's own UI state and renders it into whatever `Phaser.Scene`
 * hosts it — a real second Scene (`GearShopScene`) or an in-scene overlay
 * (`CharacterCreationScene`). Destroy-and-rebuild on every state change, same
 * convention every overlay in this project already uses.
 */
export class GearPickerView {
  private scene: Phaser.Scene;
  private backend: GearPickerBackend;
  private options: GearPickerOptions;

  private selectedHeroId: string | null;
  private selectedSlot: ArmorySlotId;
  private selectedItemId: string | null = null;
  private targetSlot: ArmorySlotId | null = null;
  private primed = false;
  private primeTimer: Phaser.Time.TimerEvent | null = null;
  private catalogScrollOffset = 0;
  private catalogViewportRect: ScrollListRect | null = null;
  private catalogContentHeight = 0;
  private contentObjects: Phaser.GameObjects.GameObject[] = [];

  private rarityFilter: EquipmentRarity | "all" = "all";
  private magicOnlyFilter = false;
  private handsCategoryFilter: HandsCategory | "all" = "all";
  private weaponCategoryFilter: WeaponCategory | "all" = "all";
  private gripFilter: WeaponGrip | "all" = "all";
  private extraFilterOffset = 0;

  private allFilters: ArmorySlotId[];

  constructor(scene: Phaser.Scene, backend: GearPickerBackend, options: GearPickerOptions, initialHeroId?: string) {
    this.scene = scene;
    this.backend = backend;
    this.options = options;
    this.allFilters = Array.from(new Set(backend.paperdollRows.flat().map(normalizeFilterSlot)));
    this.selectedHeroId = initialHeroId ?? backend.heroes()[0]?.id ?? null;
    this.selectedSlot = this.allFilters[0] ?? "weapon";
  }

  /**
   * (Re-)opens the picker fresh, for a host that keeps ONE `GearPickerView`
   * instance alive across multiple open/close cycles instead of a
   * `GearShopScene`-style one-shot Scene launch (`CharacterCreationScene`'s
   * "Gear" button can be clicked many times over the scene's life). Resets
   * every transient selection/filter, preselects `initialHeroId` if given,
   * and renders.
   */
  open(initialHeroId?: string): void {
    this.clearPrimeTimer();
    this.selectedHeroId = initialHeroId ?? this.backend.heroes()[0]?.id ?? null;
    this.selectedSlot = this.allFilters[0] ?? "weapon";
    this.selectedItemId = null;
    this.targetSlot = null;
    this.primed = false;
    this.catalogScrollOffset = 0;
    this.rarityFilter = "all";
    this.magicOnlyFilter = false;
    this.handsCategoryFilter = "all";
    this.weaponCategoryFilter = "all";
    this.gripFilter = "all";
    this.refresh();
  }

  /** Whether this picker is currently rendered on screen — a reusable-instance host (`CharacterCreationScene`) uses this to guard navigation away while it's open, the same way this project's other overlays already guard themselves. */
  isOpen(): boolean {
    return this.contentObjects.length > 0;
  }

  /** Call once, when the host is ready to accept input (mirrors `GearShopScene.create()`'s one-time `attachWheelScroll`). */
  attachInput(): void {
    attachWheelScroll(
      this.scene,
      () => this.activeCatalogScrollRegion(),
      (offset) => {
        this.catalogScrollOffset = offset;
        this.refresh();
      },
    );
  }

  /** Call when the host is closing this picker for good. */
  destroy(): void {
    this.clearPrimeTimer();
    for (const obj of this.contentObjects) obj.destroy();
    this.contentObjects = [];
  }

  private activeCatalogScrollRegion(): ScrollRegion | null {
    if (!this.catalogViewportRect) return null;
    return { rect: this.catalogViewportRect, totalContentHeight: this.catalogContentHeight, scrollOffset: this.catalogScrollOffset };
  }

  private clearPrimeTimer(): void {
    this.primeTimer?.remove(false);
    this.primeTimer = null;
  }

  /**
   * `heroForPreview` can be non-trivial work (`CharacterCreationScene`'s own
   * backend runs a full level-up simulation to build it) and this view
   * calls it many times in one `refresh()` (once per sidebar card, several
   * more for the active hero) — cached per refresh so each hero is only
   * ever actually built once per render. Cleared at the top of `refresh()`.
   */
  private heroPreviewCache = new Map<string, Hero | null>();
  private heroForPreview(heroId: string): Hero | null {
    if (!this.heroPreviewCache.has(heroId)) {
      this.heroPreviewCache.set(heroId, this.backend.heroForPreview(heroId));
    }
    return this.heroPreviewCache.get(heroId) ?? null;
  }

  private selectedHero(): Hero | null {
    if (!this.selectedHeroId) return null;
    return this.heroForPreview(this.selectedHeroId);
  }

  private occupantOf(hero: Hero, slot: ArmorySlotId): string | null {
    return (isGeneralSlot(slot) ? hero.equippedPotions[slot] : hero.equippedItems[slot]) ?? null;
  }

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

  private armTarget(slot: ArmorySlotId, instant: boolean): void {
    this.targetSlot = slot;
    if (instant || !this.backend.economy.requiresConfirmDelay) {
      this.primed = true;
      this.refresh();
      return;
    }
    this.primed = false;
    this.primeTimer = this.scene.time.delayedCall(PRIME_DELAY_MS, () => {
      this.primed = true;
      this.refresh();
    });
    this.refresh();
  }

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
      if (decision.candidateSlots.length === 1) return this.armTarget(decision.candidateSlots[0], false);
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
      if (itemId === occupantA) return this.armTarget(slotA, false);
      if (itemId === occupantB) return this.armTarget(slotB, false);
      const decision = decideSlotPairPlacement(occupantA, occupantB, slotA, slotB);
      if (decision.kind === "autoPlace") return this.armTarget(decision.slot, true);
      this.targetSlot = null;
      this.primed = false;
      this.refresh();
      return;
    }
    const occupant = hero ? this.occupantOf(hero, this.selectedSlot) : null;
    this.armTarget(this.selectedSlot, !occupant);
  }

  private commitAcquire(itemId: string): void {
    if (!this.selectedHeroId) return;
    const slot = this.targetSlot ?? this.selectedSlot;
    if (isGeneralSlot(slot)) this.backend.buyPotion(this.selectedHeroId, slot, itemId);
    else this.backend.buyGear(this.selectedHeroId, slot, itemId);
    this.clearPrimeTimer();
    this.selectedItemId = null;
    this.targetSlot = null;
    this.primed = false;
    this.refresh();
  }

  private commitRelease(): void {
    if (!this.selectedHeroId) return;
    const slot = this.targetSlot ?? this.selectedSlot;
    if (isGeneralSlot(slot)) this.backend.sellPotion(this.selectedHeroId, slot);
    else this.backend.sellGear(this.selectedHeroId, slot);
    this.clearPrimeTimer();
    this.selectedItemId = null;
    this.targetSlot = null;
    this.primed = false;
    this.refresh();
  }

  refresh(): void {
    for (const obj of this.contentObjects) obj.destroy();
    this.contentObjects = [];
    this.heroPreviewCache.clear();
    const before = new Set<Phaser.GameObjects.GameObject>(this.scene.children.list);

    this.options.drawBackdrop?.(this.scene);

    const { width, height } = getViewport(this.scene);

    this.scene.add
      .text(width / 2, 40, this.backend.title, { fontFamily: FONT_DISPLAY, fontSize: "34px", color: "#f0dfa8", fontStyle: "bold" })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    createOrnateButton(this.scene, 120, 40, 160, 44, this.options.closeLabel ?? "Close (Esc)", () => this.options.onClose(), { variant: "tool", depth: 5 });

    const heroId = this.selectedHeroId;
    const headerLabel = heroId ? this.backend.economy.headerLabel(heroId) : null;
    if (headerLabel) {
      this.scene.add
        .text(width - 130, 40, headerLabel, { fontFamily: FONT_BODY, fontSize: "20px", color: "#fff3d0" })
        .setOrigin(0.5)
        .setDepth(5);
    }

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

    this.contentObjects = this.scene.children.list.filter((c) => !before.has(c));
    const depthBase = this.options.depthBase ?? 0;
    if (depthBase) {
      for (const obj of this.contentObjects) {
        const depthed = obj as unknown as { depth: number };
        depthed.depth += depthBase;
      }
    }
  }

  private buildHeroSidebar(height: number): void {
    const heroes = this.backend.heroes();
    const sidebarCenterX = SIDEBAR_X + SIDEBAR_WIDTH / 2;
    if (heroes.length === 0) {
      this.scene.add
        .text(sidebarCenterX, CONTENT_TOP + 40, "No hero is available to shop for.", { fontFamily: FONT_BODY, fontSize: "16px", color: CREAM, wordWrap: { width: SIDEBAR_WIDTH } })
        .setOrigin(0.5, 0)
        .setDepth(3);
      return;
    }

    const gap = 14;
    const availableHeight = height - CONTENT_TOP - CONTENT_BOTTOM_MARGIN;
    const cardHeight = Math.min(260, (availableHeight - gap * (heroes.length - 1)) / heroes.length);
    const headerHeight = 42;

    heroes.forEach((heroSummary, i) => {
      const cardTop = CONTENT_TOP + i * (cardHeight + gap);
      const isActiveHero = heroSummary.id === this.selectedHeroId;
      const hero = this.heroForPreview(heroSummary.id);

      const g = this.scene.add.graphics().setDepth(2);
      g.fillStyle(0x2a1d12, 1);
      g.fillRoundedRect(SIDEBAR_X, cardTop, SIDEBAR_WIDTH, cardHeight, 6);
      g.lineStyle(2, isActiveHero ? 0xe8c25a : 0x5a4222, 1);
      g.strokeRoundedRect(SIDEBAR_X, cardTop, SIDEBAR_WIDTH, cardHeight, 6);

      const headerHit = this.scene.add
        .rectangle(sidebarCenterX, cardTop + headerHeight / 2, SIDEBAR_WIDTH, headerHeight, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      headerHit.on("pointerdown", () => this.navigateTo(heroSummary.id, this.selectedSlot));

      this.scene.add
        .text(SIDEBAR_X + 14, cardTop + 6, heroSummary.name, { fontFamily: FONT_BODY, fontSize: "16px", color: isActiveHero ? "#fff3d0" : CREAM, fontStyle: "bold" })
        .setDepth(3);
      this.scene.add
        .text(SIDEBAR_X + 14, cardTop + 25, heroSummary.subtitle, { fontFamily: FONT_BODY, fontSize: "11px", color: "#a89058" })
        .setDepth(3);

      const gridTop = cardTop + headerHeight + 6;
      const gridPad = 12;
      const cols = this.backend.paperdollRows[0]?.length ?? 1;
      const rowCount = this.backend.paperdollRows.length;
      const cellGap = 4;
      const cellWidth = (SIDEBAR_WIDTH - gridPad * 2 - cellGap * (cols - 1)) / cols;
      const cellHeight = Math.max(28, Math.min(40, (cardHeight - headerHeight - 6 - gridPad - cellGap * (rowCount - 1)) / rowCount));

      this.backend.paperdollRows.forEach((row, rowIdx) => {
        row.forEach((slot, colIdx) => {
          const sx = SIDEBAR_X + gridPad + colIdx * (cellWidth + cellGap) + cellWidth / 2;
          const sy = gridTop + rowIdx * (cellHeight + cellGap) + cellHeight / 2;
          const occupantId = hero ? this.occupantOf(hero, slot) : null;
          const isActiveSlot = isActiveHero && normalizeFilterSlot(slot) === this.selectedSlot;

          const cellG = this.scene.add.graphics().setDepth(3);
          cellG.fillStyle(isActiveSlot ? 0x3a2c14 : 0x1a1108, 1);
          cellG.fillRoundedRect(sx - cellWidth / 2, sy - cellHeight / 2, cellWidth, cellHeight, 3);
          cellG.lineStyle(isActiveSlot ? 2 : 1, isActiveSlot ? 0xe8c25a : occupantId ? 0x9a7a3e : 0x4a3a24, 1);
          cellG.strokeRoundedRect(sx - cellWidth / 2, sy - cellHeight / 2, cellWidth, cellHeight, 3);

          const hit = this.scene.add
            .rectangle(sx, sy, cellWidth, cellHeight, 0xffffff, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(4);
          hit.on("pointerdown", () => this.navigateTo(heroSummary.id, slot));

          this.scene.add
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
    const heroes = this.backend.heroes();
    const heroSummary = heroes.find((h) => h.id === this.selectedHeroId);
    const label = heroSummary ? `Shopping for ${heroSummary.name} — ${filterLabel(this.selectedSlot)}` : "Shopping";
    this.scene.add
      .text(contentX, CONTENT_TOP - 8, label, { fontFamily: FONT_DISPLAY, fontSize: "20px", color: "#f0dfa8" })
      .setOrigin(0, 1)
      .setDepth(3);
  }

  private buildSlotTabs(contentX: number, contentWidth: number): void {
    const chipWidth = 118;
    const rowGap = 8;
    const half = Math.ceil(this.allFilters.length / 2);
    const rows = [this.allFilters.slice(0, half), this.allFilters.slice(half)];
    const topY = CONTENT_TOP + 24;

    rows.forEach((rowSlots, rowIdx) => {
      const { xs, itemWidth } = centeredRowX(rowSlots.length, chipWidth, 8, contentX + contentWidth / 2, contentWidth);
      const y = topY + rowIdx * (34 + rowGap);
      rowSlots.forEach((slot, i) => {
        const active = slot === this.selectedSlot;
        createOrnateButton(this.scene, xs[i], y, itemWidth, 34, filterLabel(slot), () => {
          this.navigateTo(this.selectedHeroId ?? this.backend.heroes()[0]?.id ?? "", slot);
        }, { variant: "tab", fontSize: 12, depth: 4 }).setSelected(active);
      });
    });
  }

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
      createOrnateButton(this.scene, xs[i], y, itemWidth, 28, opt.label, () => {
        this.rarityFilter = opt.id;
        this.catalogScrollOffset = 0;
        this.refresh();
      }, { variant: "tab", fontSize: 10, depth: 4 }).setSelected(this.rarityFilter === opt.id);
    });
    createOrnateButton(this.scene, xs[options.length], y, itemWidth, 28, "✦ Magic Only", () => {
      this.magicOnlyFilter = !this.magicOnlyFilter;
      this.catalogScrollOffset = 0;
      this.refresh();
    }, { variant: "tab", fontSize: 10, depth: 4 }).setSelected(this.magicOnlyFilter);
  }

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
      createOrnateButton(this.scene, xs[i++], y, itemWidth, 26, c.label, () => {
        this.handsCategoryFilter = c.id;
        this.catalogScrollOffset = 0;
        this.refresh();
      }, { variant: "tab", fontSize: 9, depth: 4 }).setSelected(this.handsCategoryFilter === c.id);
    });
    weaponCategories.forEach((w) => {
      createOrnateButton(this.scene, xs[i++], y, itemWidth, 26, w.label, () => {
        this.weaponCategoryFilter = w.id;
        this.catalogScrollOffset = 0;
        this.refresh();
      }, { variant: "tab", fontSize: 9, depth: 4 }).setSelected(this.weaponCategoryFilter === w.id);
    });
    grips.forEach((g) => {
      createOrnateButton(this.scene, xs[i++], y, itemWidth, 26, g.label, () => {
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
    drawParchmentPanel(this.scene, panelCenterX, panelTop + panelHeight / 2, panelWidth, panelHeight, 2);

    const hero = this.selectedHero();
    if (!hero) return;
    const potions = isGeneralSlot(this.selectedSlot);
    const occupantId = this.occupantOf(hero, this.selectedSlot);
    const sel = this.selectedItemId;

    const leftX = panelCenterX - panelWidth / 2 + 24;
    this.scene.add
      .text(leftX, panelTop + 14, potions ? "Currently carried" : "Currently equipped", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED })
      .setDepth(3);
    if (occupantId) {
      this.scene.add.text(leftX, panelTop + 32, itemName(occupantId), { fontFamily: FONT_BODY, fontSize: "16px", color: INK, fontStyle: "bold" }).setDepth(3);
      this.scene.add
        .text(leftX, panelTop + 56, itemDescription(occupantId), { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED, wordWrap: { width: panelWidth * 0.4 } })
        .setDepth(3);
    } else {
      this.scene.add.text(leftX, panelTop + 38, "— empty —", { fontFamily: FONT_BODY, fontSize: "13px", color: INK_MUTED }).setDepth(3);
    }

    const midX = panelCenterX - panelWidth * 0.08;
    this.scene.add.text(midX, panelTop + 14, "Selected", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
    if (sel) {
      this.scene.add.text(midX, panelTop + 32, itemName(sel), { fontFamily: FONT_BODY, fontSize: "16px", color: INK, fontStyle: "bold" }).setDepth(3);
      this.scene.add
        .text(midX, panelTop + 56, itemDescription(sel), { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED, wordWrap: { width: panelWidth * 0.32 } })
        .setDepth(3);
      if (!potions && !isGeneralSlot(this.selectedSlot) && occupantId !== sel) {
        const preview = previewGearSlotChange(hero, this.selectedSlot as GearSlotId, sel);
        this.scene.add
          .text(midX, panelTop + 76, formatGearDelta(preview), { fontFamily: FONT_BODY, fontSize: "11px", color: OK_GREEN, fontStyle: "italic" })
          .setDepth(3);
      }
    } else {
      this.scene.add.text(midX, panelTop + 38, "Pick an item below.", { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED }).setDepth(3);
    }

    if (sel) this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, sel, occupantId, 190, 40, 13);
  }

  private buildPairCompareStrip(contentX: number, contentWidth: number, pair: [ArmorySlotId, ArmorySlotId]): void {
    const panelCenterX = contentX + contentWidth / 2;
    const panelTop = CONTENT_TOP + 94 + this.extraFilterOffset;
    const panelWidth = contentWidth;
    const panelHeight = 100;
    drawParchmentPanel(this.scene, panelCenterX, panelTop + panelHeight / 2, panelWidth, panelHeight, 2);

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
      this.scene.add.text(x, panelTop + 14, slotLabel(slot), { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
      if (occupantId) {
        this.scene.add.text(x, panelTop + 32, itemName(occupantId), { fontFamily: FONT_BODY, fontSize: "14px", color: INK, fontStyle: "bold" }).setDepth(3);
        this.scene.add
          .text(x, panelTop + 54, itemDescription(occupantId), { fontFamily: FONT_BODY, fontSize: "10px", color: INK_MUTED, wordWrap: { width: colWidth - 8 } })
          .setDepth(3);
      } else {
        this.scene.add.text(x, panelTop + 38, "— empty —", { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED }).setDepth(3);
      }
    }

    const midX = colBX + colWidth + 4;
    this.scene.add.text(midX, panelTop + 14, "Selected", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
    if (sel) {
      this.scene.add.text(midX, panelTop + 32, itemName(sel), { fontFamily: FONT_BODY, fontSize: "13px", color: INK, fontStyle: "bold" }).setDepth(3);
    } else {
      this.scene.add.text(midX, panelTop + 38, potions ? "Pick a potion below." : "Pick an item below.", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED, wordWrap: { width: panelWidth * 0.16 } }).setDepth(3);
    }

    if (sel && occupantA && occupantB && sel !== occupantA && sel !== occupantB) {
      this.buildPairReplaceButtons(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, hero, sel, [slotA, slotB]);
    } else if (sel) {
      const occupantId = sel === occupantA ? occupantA : sel === occupantB ? occupantB : null;
      this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, sel, occupantId, 190, 40, 13);
    }
  }

  private buildPairReplaceButtons(x: number, centerY: number, hero: Hero, itemId: string, slots: [ArmorySlotId, ArmorySlotId]): void {
    const econ = this.backend.economy;
    const cost = econ.costOf(itemId);
    const buttonHeight = 32;
    const gap = 6;
    slots.forEach((slot, i) => {
      const occupantId = this.occupantOf(hero, slot);
      if (!occupantId) return;
      const tradeIn = econ.creditFor(occupantId);
      const netCost = cost - tradeIn;
      const remaining = this.selectedHeroId ? econ.remainingFor(this.selectedHeroId, this.selectedSlot) : null;
      const afford = remaining === null || netCost <= remaining;
      const primedForThis = this.targetSlot === slot && this.primed;
      const y = centerY - (buttonHeight + gap) / 2 + i * (buttonHeight + gap);
      const label = primedForThis
        ? `Confirm — ${econ.formatAmount(netCost)} net`
        : afford
          ? `Replace ${slotLabel(slot)}${remaining === null ? "" : ` — ${econ.formatAmount(netCost)} net`}`
          : `Need ${econ.formatAmount(netCost)}`;
      createOrnateButton(this.scene, x, y, 220, buttonHeight, label, () => {
        if (primedForThis) this.commitAcquire(itemId);
        else if (afford) this.armTarget(slot, false);
      }, { variant: "tool", fontSize: 12, depth: 5, disabled: !afford && !primedForThis });
    });
  }

  private buildHandsCompareStrip(contentX: number, contentWidth: number): void {
    const panelCenterX = contentX + contentWidth / 2;
    const panelTop = CONTENT_TOP + 94 + this.extraFilterOffset;
    const panelWidth = contentWidth;
    const panelHeight = 100;
    drawParchmentPanel(this.scene, panelCenterX, panelTop + panelHeight / 2, panelWidth, panelHeight, 2);

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
      this.scene.add.text(x, panelTop + 14, slotLabel(slot), { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
      if (occupantId) {
        this.scene.add.text(x, panelTop + 32, itemName(occupantId), { fontFamily: FONT_BODY, fontSize: "14px", color: INK, fontStyle: "bold" }).setDepth(3);
        this.scene.add
          .text(x, panelTop + 54, itemDescription(occupantId), { fontFamily: FONT_BODY, fontSize: "10px", color: INK_MUTED, wordWrap: { width: colWidth - 8 } })
          .setDepth(3);
      } else {
        this.scene.add.text(x, panelTop + 38, "— empty —", { fontFamily: FONT_BODY, fontSize: "12px", color: INK_MUTED }).setDepth(3);
      }
    }

    const midX = colBX + colWidth + 4;
    this.scene.add.text(midX, panelTop + 14, "Selected", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED }).setDepth(3);
    if (sel) {
      this.scene.add.text(midX, panelTop + 32, itemName(sel), { fontFamily: FONT_BODY, fontSize: "13px", color: INK, fontStyle: "bold" }).setDepth(3);
    } else {
      this.scene.add.text(midX, panelTop + 38, "Pick an item below.", { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED, wordWrap: { width: panelWidth * 0.16 } }).setDepth(3);
    }

    if (!sel) return;
    if (sel === weaponOccupant || sel === shieldOccupant) {
      const occupantId = sel === weaponOccupant ? weaponOccupant : shieldOccupant;
      this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, sel, occupantId, 190, 40, 13);
      return;
    }
    const decision = decideHandsPlacement(sel, weaponOccupant, shieldOccupant);
    if (decision.kind === "autoPlace") {
      this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, sel, null, 190, 40, 13);
    } else if (decision.candidateSlots.length === 1) {
      const slot = decision.candidateSlots[0];
      this.buildActionButton(panelCenterX + panelWidth / 2 - 110, panelTop + panelHeight / 2, sel, this.occupantOf(hero, slot), 190, 40, 13);
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
    drawParchmentPanel(this.scene, panelCenterX, panelTop + listHeight / 2, panelWidth, listHeight, 2);

    const hero = this.selectedHero();
    if (!hero) {
      this.catalogViewportRect = null;
      return;
    }

    const hands = isHandsFilter(this.selectedSlot);
    const pair = hands ? null : pairSlotsFor(this.selectedSlot);
    const occupantId = pair || hands ? null : this.occupantOf(hero, this.selectedSlot);
    const occupantA = hands ? this.occupantOf(hero, "weapon") : pair ? this.occupantOf(hero, pair[0]) : null;
    const occupantB = hands ? this.occupantOf(hero, "shield") : pair ? this.occupantOf(hero, pair[1]) : null;
    const occupantIds = pair || hands ? [occupantA, occupantB].filter((v): v is string => v !== null) : occupantId ? [occupantId] : [];
    const potions = isGeneralSlot(this.selectedSlot);
    const allIds = this.backend.candidateItemIds();
    const eligibleIds = potions
      ? allIds.filter((id) => isPotionId(id))
      : hands
        ? allIds.filter((id) => !isPotionId(id) && (isItemEligibleForSlot(id, "weapon") || isItemEligibleForSlot(id, "shield")))
        : allIds.filter((id) => !isPotionId(id) && isItemEligibleForSlot(id, this.selectedSlot as GearSlotId));
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
      this.scene.add
        .text(panelCenterX, panelTop + 30, message, { fontFamily: FONT_BODY, fontSize: "14px", color: INK_MUTED })
        .setOrigin(0.5)
        .setDepth(3);
      return;
    }

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

    const econ = this.backend.economy;
    renderScrollListRows(this.scene, rowsRect, rowHeights, rowGap, this.catalogScrollOffset, 3, (index, rowX, rowTopY, rowWidth) => {
      const id = list[index];
      const objs: Phaser.GameObjects.GameObject[] = [];
      const rowCenterX = rowX + rowWidth / 2;
      const rowCenterY = rowTopY + rowHeight / 2;
      const isOccupant = occupantIds.includes(id);
      const isSelected = this.selectedItemId === id;

      const rowBg = this.scene.add
        .rectangle(rowCenterX, rowCenterY, rowWidth, rowHeight, 0xffffff, isSelected ? 0.18 : 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      rowBg.on("pointerdown", () => this.chooseItem(id));
      objs.push(rowBg);

      if (isMagicItem(itemRarity(id))) {
        objs.push(
          this.scene.add
            .graphics()
            .lineStyle(2, 0xc9a227, 0.9)
            .strokeRect(rowCenterX - rowWidth / 2, rowCenterY - rowHeight / 2, rowWidth, rowHeight)
            .setDepth(3),
        );
      }

      const leftX = rowCenterX - rowWidth / 2 + 16;
      objs.push(
        this.scene.add
          .text(leftX, rowCenterY - 8, `${itemName(id)}${rarityTag(id)}`, { fontFamily: FONT_BODY, fontSize: "15px", color: INK, fontStyle: isSelected ? "bold" : "normal" })
          .setDepth(4),
      );
      objs.push(
        this.scene.add
          .text(leftX, rowCenterY + 12, itemDescription(id), { fontFamily: FONT_BODY, fontSize: "11px", color: INK_MUTED, wordWrap: { width: rowWidth - 260 } })
          .setDepth(4),
      );

      if (isOccupant) {
        objs.push(
          this.scene.add
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
        const remaining = this.selectedHeroId ? econ.remainingFor(this.selectedHeroId, this.selectedSlot) : null;
        if (remaining !== null) {
          const cost = econ.costOf(id);
          const tradeIn = pair || hands ? 0 : occupantId ? econ.creditFor(occupantId) : 0;
          const netCost = cost - tradeIn;
          const afford = netCost <= remaining;
          objs.push(
            this.scene.add
              .text(rowCenterX + rowWidth / 2 - 300, rowCenterY, tradeIn > 0 ? `${econ.formatAmount(cost)}  (+${econ.formatAmount(tradeIn)} trade-in)` : econ.formatAmount(cost), {
                fontFamily: FONT_BODY,
                fontSize: "12px",
                color: afford ? OK_GREEN : BAD_RED,
              })
              .setOrigin(0, 0.5)
              .setDepth(4),
          );
        }
      }

      const showSelectButton = (): void => {
        objs.push(
          createOrnateButton(
            this.scene,
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
        objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, id, id, 170, 34, 11));
      } else if (hands) {
        const decision = decideHandsPlacement(id, occupantA, occupantB);
        if (decision.kind === "autoPlace") {
          objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, id, null, 170, 34, 11));
        } else if (decision.candidateSlots.length === 1) {
          objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, id, this.occupantOf(hero, decision.candidateSlots[0]), 170, 34, 11));
        } else {
          showSelectButton();
        }
      } else if (!pair) {
        objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, id, occupantId, 170, 34, 11));
      } else {
        const decision = decideSlotPairPlacement(occupantA, occupantB, pair[0], pair[1]);
        if (decision.kind === "autoPlace") {
          objs.push(this.buildActionButton(rowCenterX + rowWidth / 2 - 100, rowCenterY, id, null, 170, 34, 11));
        } else {
          showSelectButton();
        }
      }

      return objs;
    });

    renderScrollbarVisual(this.scene, rowsRect, totalRowsHeight, this.catalogScrollOffset, 3, (offset) => {
      this.catalogScrollOffset = offset;
      this.refresh();
    });

    if (proficiencyHiddenCount > 0) {
      this.scene.add
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

  private buildActionButton(
    x: number,
    y: number,
    id: string,
    occupantId: string | null,
    width: number,
    height: number,
    fontSize: number,
  ): Phaser.GameObjects.Container {
    const econ = this.backend.economy;
    const heroId = this.selectedHeroId!;
    const isOccupant = occupantId === id;
    const isSelected = this.selectedItemId === id;
    const primedForThis = isSelected && this.primed;

    if (isOccupant) {
      const remaining = econ.remainingFor(heroId, this.selectedSlot);
      const credit = remaining === null ? 0 : econ.creditFor(id);
      const suffix = remaining === null || credit <= 0 ? "" : ` +${econ.formatAmount(credit)}`;
      const label = primedForThis ? `Confirm ${econ.verbs.release}${suffix}` : `${econ.verbs.release}${remaining === null ? "" : ` — ${econ.formatAmount(credit)}`}`;
      return createOrnateButton(this.scene, x, y, width, height, label, () => {
        if (primedForThis) this.commitRelease();
        else this.chooseItem(id);
      }, { variant: "tool", fontSize, depth: 5 }).container;
    }

    const cost = econ.costOf(id);
    const tradeIn = occupantId ? econ.creditFor(occupantId) : 0;
    const netCost = cost - tradeIn;
    const remaining = econ.remainingFor(heroId, this.selectedSlot);
    const afford = remaining === null || netCost <= remaining;
    const needsCompareStep = !!occupantId;

    if (!needsCompareStep || primedForThis) {
      let label: string;
      if (remaining === null) label = econ.verbs.acquire;
      else if (!afford) label = `Need ${econ.formatAmount(netCost)}`;
      else if (netCost > 0) label = `${econ.verbs.acquire} — ${econ.formatAmount(netCost)} net`;
      else if (netCost < 0) label = `${econ.verbs.acquire} (+${econ.formatAmount(-netCost)} back)`;
      else label = `${econ.verbs.acquire} — free`;
      return createOrnateButton(this.scene, x, y, width, height, label, () => {
        if (!afford) return;
        if (!needsCompareStep) this.chooseItem(id);
        this.commitAcquire(id);
      }, { variant: "tool", fontSize, depth: 5, disabled: !afford }).container;
    }
    return createOrnateButton(this.scene, x, y, width, height, "Compare", () => this.chooseItem(id), { variant: "tool", fontSize, depth: 5 }).container;
  }
}
