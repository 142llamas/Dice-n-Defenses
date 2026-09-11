import Phaser from "phaser";
import { COMPANION_ROSTER_STORAGE_KEY } from "../config";
import type { DifficultyId } from "../data/difficulty";
import { REGION_BONUS_POOLS, type RegionBonusOption } from "../data/regionBonuses";
import { getEquipmentDefinition } from "../data/equipment";
import { getCompanionDefinition } from "../data/companions";
import { getClassDefinition } from "../data/classes";
import { drawRegionBonusChoices } from "../systems/RegionBonusSystem";
import { RandomService } from "../systems/RandomService";
import {
  getPcBuild,
  loadCompanionRoster,
  MAX_ACTIVE_COMPANIONS,
  type CompanionRosterState,
} from "../systems/CompanionRosterSystem";
import { drawScreenBackdrop, onViewportResize, renderChoiceOverlay, clearChoiceOverlay } from "./uiTheme";

export interface RegionBonusChoiceSceneData {
  campaignId: string;
  chapterIndex: number;
  difficultyId: DifficultyId;
  requiredCompanionIds?: string[];
}

/**
 * RegionBonusChoiceScene — D-248 (Batch E): moves the "Choose a Bonus" pick
 * to before Character Creation/the between-missions Armory, reached from
 * every `CampaignSelectScene`/`UnlockMissionPartyScene` routing site instead
 * of going straight to `CampaignArmoryScene`/`CharacterCreationScene` (this
 * scene now owns that `getPcBuild` ternary, consolidated from the 3 places
 * that used to duplicate it). Forwards the exact same data those two scenes
 * already expect, plus the new `pendingRegionBonusId` field —
 * `BattleScene.showRegionBonusChoiceIfAny` reads it at chapter-start and
 * applies the pick directly, with no second prompt.
 *
 * Deciding this earlier (rather than at battle-start, as before D-248) means
 * an equipment bonus is known before the player shops/builds, instead of
 * silently colliding with a slot they already filled — the actual granting
 * still happens at chapter-start exactly as before (unchanged timing for
 * gold banking, see `BattleScene.grantRegionBonusGold`'s own anti-farm
 * comment), only the ASKING moved earlier.
 *
 * A no-op passthrough (shows nothing, no `pendingRegionBonusId`) for any
 * campaign without a curated pool — the Prologue and the Nameless Throne
 * capstone are the only two real cases — same guard
 * `showRegionBonusChoiceIfAny` used before this scene existed.
 */
export class RegionBonusChoiceScene extends Phaser.Scene {
  private sceneData!: RegionBonusChoiceSceneData;
  private roster!: CompanionRosterState;
  private drawn: RegionBonusOption[] = [];
  private overlay: Phaser.GameObjects.GameObject[] = [];
  /** Non-null while the recipient-picker (second screen) is showing — lets a resize re-render THAT screen instead of always reverting to the bonus-card list. */
  private pendingEquipmentOption: RegionBonusOption | null = null;

  constructor() {
    super("RegionBonusChoiceScene");
  }

  init(data: RegionBonusChoiceSceneData): void {
    this.sceneData = data;
  }

  create(): void {
    this.roster = loadCompanionRoster(window.localStorage, COMPANION_ROSTER_STORAGE_KEY);
    this.pendingEquipmentOption = null;
    const pool = REGION_BONUS_POOLS[this.sceneData.campaignId];
    if (!pool || pool.length === 0) {
      this.proceed();
      return;
    }

    this.drawn = drawRegionBonusChoices(pool, RandomService.seeded(), 3);

    drawScreenBackdrop(this);
    this.rebuild();
    onViewportResize(this, () => {
      if (this.pendingEquipmentOption) this.rebuildRecipientPicker(this.pendingEquipmentOption);
      else this.rebuild();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearChoiceOverlay(this.overlay));
  }

  private rebuild(): void {
    renderChoiceOverlay(
      this,
      this.overlay,
      "Choose a Bonus",
      this.drawn.map((option) => ({
        label: option.name,
        desc: option.description,
        onClick: () => {
          clearChoiceOverlay(this.overlay);
          if (option.category === "equipment") {
            this.pendingEquipmentOption = option;
            this.rebuildRecipientPicker(option);
            return;
          }
          this.proceed(option.id);
        },
      })),
    );
  }

  /**
   * D-250 (Batch E gap 1): a second pick, shown only for an "equipment"
   * bonus — "First available hero" (preserves the old auto-assign behavior
   * as an explicit choice, not a silent default) plus every known party
   * member, in the SAME order `CharacterCreationScene`/`this.heroes` will
   * end up using (PC first if one already exists, then companions in
   * `requiredCompanionIds`/`roster.activeIds` order) — so the slot index
   * picked here is safe to use verbatim as `pendingRegionBonusHeroSlot`.
   * Labeled by name/class only (not gear) — a companion's CURRENT gear
   * state can still change in the Armory/Character Creation between this
   * pick and battle-start, so `BattleScene.grantEquipmentOrSellForGold`
   * re-validates room for the chosen hero at grant time regardless.
   */
  private rebuildRecipientPicker(option: RegionBonusOption): void {
    const pcBuild = getPcBuild(this.roster);
    const companionIds =
      this.sceneData.requiredCompanionIds && this.sceneData.requiredCompanionIds.length > 0
        ? this.sceneData.requiredCompanionIds
        : this.roster.activeIds.slice(0, MAX_ACTIVE_COMPANIONS);
    const partyLabels: string[] = [
      ...(pcBuild ? [`${pcBuild.name} (${getClassDefinition(pcBuild.classId).name})`] : []),
      ...companionIds.map((id) => {
        const build = getCompanionDefinition(id).build;
        return `${build.name} (${getClassDefinition(build.classId).name})`;
      }),
    ];
    const itemName = getEquipmentDefinition(option.equipmentId!).name;
    renderChoiceOverlay(this, this.overlay, `Who receives ${itemName}?`, [
      {
        label: "First available hero",
        desc: "Auto-assign to the first hero with a free matching slot.",
        onClick: () => {
          clearChoiceOverlay(this.overlay);
          this.proceed(option.id);
        },
      },
      ...partyLabels.map((label, i) => ({
        label,
        onClick: () => {
          clearChoiceOverlay(this.overlay);
          this.proceed(option.id, i);
        },
      })),
    ]);
  }

  private proceed(pendingRegionBonusId?: string, pendingRegionBonusHeroSlot?: number): void {
    this.scene.start(getPcBuild(this.roster) ? "CampaignArmoryScene" : "CharacterCreationScene", {
      ...this.sceneData,
      pendingRegionBonusId,
      pendingRegionBonusHeroSlot,
    });
  }
}
