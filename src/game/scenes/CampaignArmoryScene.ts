import Phaser from "phaser";
import { CAMPAIGN_GOLD_STORAGE_KEY, COMPANION_ROSTER_STORAGE_KEY, CAMPAIGN_LEVEL_STORAGE_KEY } from "../config";
import { getDifficultyDefinition, type DifficultyId } from "../data/difficulty";
import { EQUIPMENT_ORDER, getEquipmentDefinition, type GearSlotId } from "../data/equipment";
import { getClassDefinition } from "../data/classes";
import { getCompanionDefinition } from "../data/companions";
import { companionStartingGearForDifficulty } from "../data/characterCreation";
import { isItemEligibleForSlot } from "../systems/GearCompareSystem";
import { sellValueForCost } from "../systems/EconomySystem";
import { isRarityUnlockedAtLevel } from "../systems/ShopSystem";
import { simulateHeroForPlanning, emptyLevelUpPlan } from "../systems/LevelUpPlanSystem";
import type { CharacterBuild } from "../systems/CharacterBuildSystem";
import type { Hero } from "../entities/Hero";
import {
  loadCompanionRoster,
  saveCompanionRoster,
  getPcBuild,
  setPcBuild,
  setCompanionPurchasedGearSlot,
  applyPurchasedGearOverrides,
  getPartyInventory,
  MAX_ACTIVE_COMPANIONS,
  type CompanionRosterState,
} from "../systems/CompanionRosterSystem";
import { visibleGearForOrigin, sellPartyInventoryEntry } from "../systems/PartyInventorySystem";
import {
  loadCampaignGold,
  saveCampaignGold,
  grantStartingCampaignGoldIfNeeded,
  earnCampaignGold,
  spendCampaignGold,
  canAffordCampaignGold,
  type CampaignGoldState,
} from "../systems/CampaignGoldSystem";
import { loadCampaignLevel, type CampaignLevelState } from "../systems/CampaignLevelSystem";
import { GearPickerView, goldEconomy, type GearPickerBackend } from "./gearPickerView";
import { getViewport, onViewportResize, createOrnateButton, drawScreenBackdrop, openChoiceList } from "./uiTheme";

const PC_HERO_ID = "pc";

/** Same 5+5 split Character Creation's own gear picker uses — no Potions column (no between-missions potion persistence exists yet, see the plan doc's "explicitly out of scope" note). */
const PAPERDOLL_ROWS: GearSlotId[][] = [
  ["weapon", "shield", "head", "chest", "legs"],
  ["back", "ring1", "ring2", "amulet", "footwear"],
];

export interface CampaignArmorySceneData {
  campaignId: string;
  chapterIndex: number;
  difficultyId: DifficultyId;
  requiredCompanionIds?: string[];
  /** D-248 (Batch E): the region-bonus pick `RegionBonusChoiceScene` already made — forwarded on unchanged to `CharacterCreationScene`, ultimately read by `BattleScene` at chapter-start. Not used by this scene itself. */
  pendingRegionBonusId?: string;
  /** D-250 (Batch E gap 1): the equipment bonus's chosen recipient party-slot index, forwarded on the same way. Not used by this scene itself. */
  pendingRegionBonusHeroSlot?: number;
}

/**
 * CampaignArmoryScene — `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` Plan 3: a
 * between-missions shop, reached at the `CampaignSelectScene ->
 * CharacterCreationScene` seam whenever a campaign PC build already exists
 * (never shown before Chapter 1 — see `CampaignSelectScene`/
 * `UnlockMissionPartyScene`'s routing, gated on `getPcBuild`). Spends the
 * persistent `CampaignGoldSystem` balance on gear for the WHOLE party (PC +
 * every active companion), reusing the same shared `GearPickerView`/
 * `GearPickerBackend` contract `GearShopScene` (the in-battle Armory) and
 * `CharacterCreationScene`'s own gear picker already drive — this is a
 * THIRD backend for that shared component, not a fourth hand-rolled
 * gear-shopping UI.
 *
 * Full rarity (matching the in-battle Armory's level-gated catalog) is
 * supported for both the PC and every companion — the PC's gear used to
 * round-trip through a common/uncommon-only lookup table
 * (`CharacterCreationScene.gearIndicesFromBuild`) that would silently drop
 * anything rarer; that scene's new `pinnedGearIds` mechanism (shipped the
 * same session as this file) closes that gap, so a rare-or-better purchase
 * made here survives a later Character Creation visit untouched. A
 * companion's purchases/sales persist via the new
 * `companionPurchasedGear` layer (`CompanionRosterSystem`), read back by
 * both this scene and Character Creation so they always agree on "what
 * does this companion currently have."
 *
 * The one-time `startingCampaignGold` kit (per difficulty) is granted the
 * first time THIS scene is reached, not literally "before Chapter 1" as
 * originally floated when Plan 1 was scoped — there's no PC identity to
 * shop for until Character Creation builds one, so this scene (and the
 * grant) can only start from the Chapter 2 visit onward.
 *
 * Free Play is entirely unaffected — it never reaches `CampaignSelectScene`
 * (or, therefore, this scene) at all.
 */
export class CampaignArmoryScene extends Phaser.Scene {
  private armoryData!: CampaignArmorySceneData;
  private roster!: CompanionRosterState;
  private goldState!: CampaignGoldState;
  private campaignLevelState!: CampaignLevelState;
  private pcBuild!: CharacterBuild;
  private companionIds: string[] = [];
  private view!: GearPickerView;
  private poolOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("CampaignArmoryScene");
  }

  init(data: CampaignArmorySceneData): void {
    this.armoryData = data;
  }

  create(): void {
    this.roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
    this.goldState = loadCampaignGold(window.localStorage, CAMPAIGN_GOLD_STORAGE_KEY);
    this.campaignLevelState = loadCampaignLevel(window.localStorage, CAMPAIGN_LEVEL_STORAGE_KEY);

    const granted = grantStartingCampaignGoldIfNeeded(
      this.goldState,
      getDifficultyDefinition(this.armoryData.difficultyId).startingCampaignGold,
    );
    if (granted !== this.goldState) {
      this.goldState = granted;
      saveCampaignGold(window.localStorage, CAMPAIGN_GOLD_STORAGE_KEY, this.goldState);
    }

    // Guaranteed defined — routing only reaches this scene once it is (see
    // CampaignSelectScene.selectCampaign/UnlockMissionPartyScene).
    this.pcBuild = getPcBuild(this.roster)!;

    // Same slot-filling precedent as CharacterCreationScene.ts's own
    // campaign prefill: `requiredCompanionIds` verbatim (an unlock-mission
    // hand-off) if present, else the active roster capped to the party
    // size.
    this.companionIds =
      this.armoryData.requiredCompanionIds && this.armoryData.requiredCompanionIds.length > 0
        ? [...this.armoryData.requiredCompanionIds]
        : this.roster.activeIds.slice(0, MAX_ACTIVE_COMPANIONS);

    const backend: GearPickerBackend = {
      title: "The Armory",
      paperdollRows: PAPERDOLL_ROWS,
      economy: goldEconomy(() => this.goldState.gold, sellValueForCost),
      heroes: () => [
        {
          id: PC_HERO_ID,
          name: this.pcBuild.name,
          subtitle: `${getClassDefinition(this.pcBuild.classId).name} · Lv ${this.campaignLevelState.campaignLevel}`,
        },
        ...this.companionIds.map((id) => {
          const build = this.effectiveCompanionBuild(id);
          return {
            id,
            name: build.name,
            subtitle: `${getClassDefinition(build.classId).name} · Lv ${this.campaignLevelState.campaignLevel}`,
          };
        }),
      ],
      heroForPreview: (heroId) => this.previewHero(heroId),
      candidateItemIds: () =>
        EQUIPMENT_ORDER.filter((id) =>
          isRarityUnlockedAtLevel(getEquipmentDefinition(id).rarity, this.campaignLevelState.campaignLevel),
        ),
      buyGear: (heroId, slot, itemId) => this.buyGear(heroId, slot, itemId),
      sellGear: (heroId, slot) => this.sellGear(heroId, slot),
      // No between-missions potion persistence exists yet — same
      // established no-op precedent Character Creation's own backend uses
      // for the same reason (`paperdollRows` never includes a Potions slot,
      // so the view can never call these).
      buyPotion: () => {},
      sellPotion: () => {},
    };

    this.view = new GearPickerView(this, backend, {
      onClose: () => this.scene.start("CampaignSelectScene"),
      closeLabel: "Back to Campaigns",
      drawBackdrop: (scene) => drawScreenBackdrop(scene),
    });
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("CampaignSelectScene"));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.view.destroy();
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    this.view.attachInput();
    onViewportResize(this, () => this.view.refresh());
    this.view.refresh();

    this.buildChrome();
  }

  /** This companion's current effective gear: authored kit -> difficulty trim -> Armory purchases/sales layered on top -> anything currently sitting unclaimed in the party inventory pool stripped back out. Mirrors `CharacterCreationScene.resolveGearIdsForSlot`'s `gearLocked` branch exactly, so both scenes always agree on "what does this companion have." */
  private effectiveCompanionBuild(companionId: string): CharacterBuild {
    const authored = getCompanionDefinition(companionId).build;
    const gearIds = visibleGearForOrigin(
      companionId,
      applyPurchasedGearOverrides(
        companionStartingGearForDifficulty(authored.startingGearIds ?? {}, this.armoryData.difficultyId),
        this.roster.companionPurchasedGear?.[companionId],
      ),
      getPartyInventory(this.roster),
    );
    return { ...authored, startingGearIds: gearIds };
  }

  /** A scratch, throwaway Hero (never added to any battle) fast-forwarded to the shared campaign level — same technique `LevelUpPlanSystem.simulateHeroForPlanning` already provides for exactly this kind of out-of-battle preview. */
  private previewHero(heroId: string): Hero | null {
    if (heroId === PC_HERO_ID) {
      return simulateHeroForPlanning(this.pcBuild, this.pcBuild.levelUpPlan ?? emptyLevelUpPlan(), this.campaignLevelState.campaignLevel);
    }
    if (!this.companionIds.includes(heroId)) return null;
    const build = this.effectiveCompanionBuild(heroId);
    return simulateHeroForPlanning(build, build.levelUpPlan ?? emptyLevelUpPlan(), this.campaignLevelState.campaignLevel);
  }

  /**
   * Mirrors `BattleScene.buyGearForHero`'s validation and net-cost math
   * (eligibility, attunement, grip conflict, trade-in credit against the
   * FULL cost) against `CampaignGoldSystem`'s immutable state instead of a
   * live `EconomySystem`/`Hero`. A grip conflict REJECTS the purchase
   * outright (no gold moves) rather than auto-clearing the other slot the
   * way Character Creation's own free-pick picker does — this is real
   * money changing hands, so it follows the in-battle Armory's stricter
   * precedent, not the free picker's more forgiving one.
   */
  private buyGear(heroId: string, slot: GearSlotId, itemId: string): void {
    const hero = this.previewHero(heroId);
    if (!hero) return;
    if (!isItemEligibleForSlot(itemId, slot)) return;
    const def = getEquipmentDefinition(itemId);
    if (hero.equippedItems[slot] === itemId) return;
    if (hero.wouldExceedAttunementLimit(itemId, slot)) return;
    if (hero.wouldConflictWithGrip(itemId, slot)) return;

    const occupantId = hero.equippedItems[slot];
    const tradeIn = occupantId ? sellValueForCost(getEquipmentDefinition(occupantId).cost) : 0;
    const netCost = def.cost - tradeIn;
    if (netCost > 0 && !canAffordCampaignGold(this.goldState, netCost)) return;

    if (occupantId) this.goldState = earnCampaignGold(this.goldState, tradeIn);
    const spent = spendCampaignGold(this.goldState, def.cost);
    if (!spent.ok) return; // defensive — the afford check above already guarantees this
    this.goldState = spent.state;

    this.setHeroGear(heroId, slot, itemId);
    this.persist();
  }

  /** Sells whatever `heroId` has equipped in `slot` outright, for half its cost — mirrors `BattleScene.sellGearFromHero`. */
  private sellGear(heroId: string, slot: GearSlotId): void {
    const hero = this.previewHero(heroId);
    if (!hero) return;
    const occupantId = hero.equippedItems[slot];
    if (!occupantId) return;
    this.goldState = earnCampaignGold(this.goldState, sellValueForCost(getEquipmentDefinition(occupantId).cost));
    this.setHeroGear(heroId, slot, null);
    this.persist();
  }

  /** Persists a gear change to its correct source of truth: the PC's own `startingGearIds` directly, or a companion's `companionPurchasedGear` override layer (`null` records an explicit sale of an authored item, distinct from "never touched"). */
  private setHeroGear(heroId: string, slot: GearSlotId, itemId: string | null): void {
    if (heroId === PC_HERO_ID) {
      const startingGearIds = { ...(this.pcBuild.startingGearIds ?? {}) };
      if (itemId === null) delete startingGearIds[slot];
      else startingGearIds[slot] = itemId;
      this.pcBuild = { ...this.pcBuild, startingGearIds };
      this.roster = setPcBuild(this.roster, this.pcBuild);
    } else {
      this.roster = setCompanionPurchasedGearSlot(this.roster, heroId, slot, itemId);
    }
  }

  private persist(): void {
    saveCampaignGold(window.localStorage, CAMPAIGN_GOLD_STORAGE_KEY, this.goldState);
    saveCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY, this.roster);
  }

  /**
   * Scene-level chrome layered above the shared view's own content: the
   * Party Inventory sell list and the Continue button. Created once —
   * survives the view's own internal `refresh()` calls, same "host owns
   * its own persistent UI alongside a `GearPickerView` instance" precedent
   * `CharacterCreationScene` already established.
   */
  private buildChrome(): void {
    const { width, height } = getViewport(this);

    createOrnateButton(this, 120, 80, 220, 30, "Party Inventory", () => this.openPoolSellList(), {
      variant: "tool",
      fontSize: 12,
      depth: 20,
    });

    createOrnateButton(
      this,
      width / 2,
      height - 20,
      320,
      36,
      "Continue",
      () => this.scene.start("CharacterCreationScene", this.armoryData),
      { variant: "primary", depth: 20 },
    );
  }

  /** The plan doc's "Sell" action for a currently-unclaimed party-inventory pool entry — claiming stays Character Creation's job, unchanged; this only adds a way to convert an unclaimed item to gold instead of losing it for nothing at Start Battle. */
  private openPoolSellList(): void {
    const pool = getPartyInventory(this.roster);
    if (pool.length === 0) {
      openChoiceList(this, this.poolOverlay, "Party Inventory — nothing unclaimed right now", []);
      return;
    }
    openChoiceList(
      this,
      this.poolOverlay,
      "Party Inventory — Sell",
      pool.map((entry) => {
        const def = getEquipmentDefinition(entry.itemId);
        return {
          label: `${def.name} (+${sellValueForCost(def.cost)}g)`,
          desc: `From ${getCompanionDefinition(entry.originCompanionId).build.name}`,
          onPick: () => {
            const result = sellPartyInventoryEntry(this.roster, entry.id);
            if (!result) return;
            this.roster = result.state;
            this.goldState = earnCampaignGold(this.goldState, sellValueForCost(getEquipmentDefinition(result.itemId).cost));
            this.persist();
          },
        };
      }),
      () => this.view.refresh(),
    );
  }
}
