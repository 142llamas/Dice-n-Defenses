import Phaser from "phaser";
import { Hero } from "../entities/Hero";
import { type GearSlotId } from "../data/equipment";
import { type GeneralSlotId } from "../data/potions";
import { getClassDefinition } from "../data/classes";
import { sellValueForCost } from "../systems/EconomySystem";
import { onViewportResize, drawScreenBackdrop } from "./uiTheme";
import { GearPickerView, goldEconomy, type GearPickerBackend, type ArmorySlotId } from "./gearPickerView";
import type { BattleScene } from "./BattleScene";

/** 6 columns x 2 rows — the two Potion slots sit in the rightmost column, next to Legs/Footwear, per the agreed design. */
const PAPERDOLL_ROWS: ArmorySlotId[][] = [
  ["weapon", "shield", "head", "chest", "legs", "general1"],
  ["back", "ring1", "ring2", "amulet", "footwear", "general2"],
];

/**
 * GearShopScene — The Armory (D-209). Opened over a paused `BattleScene`
 * (same `scene.launch`/`scene.pause`/`scene.resume` mechanism `PauseMenuScene`/
 * `CharacterSheetScene` already established), replacing the old in-BattleScene
 * "click an item, then click a hero" Gear grid.
 *
 * D-240 (Batch D, items 3/5 of the 2026-09-09 playtest list): this scene is
 * now a thin `GearPickerBackend` adapter over `BattleScene` — all the actual
 * sidebar/tabs/compare-strip/catalog rendering lives in the shared
 * `gearPickerView.ts`, which `CharacterCreationScene`'s gear picker now
 * drives too (its own catalog has no gold economy — see `goldEconomy` vs.
 * `pointsEconomy`/`FREE_ECONOMY` there). Behavior here is unchanged from
 * before this split: buying into an occupied slot auto-sells the occupant
 * (still no general inventory) at half its cost — `EconomySystem
 * .sellValueForCost`, confirmed with Kevin as the real economy rule.
 */
export interface GearShopSceneData {
  battleScene: BattleScene;
}

export class GearShopScene extends Phaser.Scene {
  private battleScene!: BattleScene;
  private view!: GearPickerView;

  constructor() {
    super("GearShopScene");
  }

  init(data: GearShopSceneData): void {
    this.battleScene = data.battleScene;
  }

  create(): void {
    const backend: GearPickerBackend = {
      title: "The Armory",
      paperdollRows: PAPERDOLL_ROWS,
      economy: goldEconomy((heroId) => {
        const hero = this.battleScene.shopHeroes().find((h) => h.id === heroId);
        return hero ? this.battleScene.goldFor(hero) : 0;
      }, sellValueForCost),
      heroes: () =>
        this.battleScene.shopHeroes().map((h) => ({
          id: h.id,
          name: h.name,
          subtitle: `${h.classId ? getClassDefinition(h.classId).name : "Adventurer"} · Lv ${h.level}`,
        })),
      heroForPreview: (heroId) => this.battleScene.shopHeroes().find((h) => h.id === heroId) ?? null,
      candidateItemIds: () => this.battleScene.shopVisibleItemIds(),
      buyGear: (heroId, slot, itemId) => this.withHero(heroId, (hero) => this.battleScene.buyGearForHero(hero, slot, itemId)),
      sellGear: (heroId, slot) => this.withHero(heroId, (hero) => this.battleScene.sellGearFromHero(hero, slot)),
      buyPotion: (heroId, slot, itemId) => this.withHero(heroId, (hero) => this.battleScene.buyPotionForHero(hero, slot, itemId)),
      sellPotion: (heroId, slot) => this.withHero(heroId, (hero) => this.battleScene.sellPotionFromHero(hero, slot)),
    };

    this.view = new GearPickerView(this, backend, { onClose: () => this.close(), drawBackdrop: (scene) => drawScreenBackdrop(scene) });
    this.input.keyboard?.on("keydown-ESC", () => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.view.destroy();
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    this.view.attachInput();
    onViewportResize(this, () => this.view.refresh());
    this.view.refresh();
  }

  private withHero(heroId: string, action: (hero: Hero) => void): void {
    const hero = this.battleScene.shopHeroes().find((h) => h.id === heroId);
    if (hero) action(hero);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume("BattleScene");
  }
}

export type { GearSlotId, GeneralSlotId };
