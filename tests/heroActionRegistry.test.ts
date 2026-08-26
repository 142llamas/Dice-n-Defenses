import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import type { HeroDefinition } from "../src/game/data/heroes";
import { listHeroActions, firstAvailableHeroAction, hotkeyDisplayLabel } from "../src/game/systems/HeroActionRegistry";

/**
 * D-148: regression harness for the extraction of BattleScene's
 * `showBonusActionButtonFor`/`showClassActionButtonFor` if/else chains into
 * `HeroActionRegistry` — proves the registry's availability matches each
 * class feature's own `canUseX()` getter exactly, so the refactor changed
 * no behavior.
 */

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Test",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    controlledBy: "human",
    ...overrides,
  };
}

function heroFrom(overrides: Partial<CharacterBuild> = {}): Hero {
  return new Hero(heroDefinitionFromBuild(build(overrides)), { x: 0, y: 0 });
}

function levelUp(hero: Hero, times: number): Hero {
  for (let i = 0; i < times; i++) hero.levelUpClass();
  return hero;
}

describe("HeroActionRegistry", () => {
  it("shows nothing available for the classic fixed roster (no classId at all)", () => {
    const classicDef: HeroDefinition = {
      id: "classic-1",
      name: "Classic Hero",
      movementTiles: 3,
      maxHealth: 10,
      attackDamage: 3,
      attackRangeTiles: 1,
      attackBonus: 4,
      baseArmorClass: 10,
    };
    const hero = new Hero(classicDef, { x: 0, y: 0 });
    const entries = listHeroActions(hero);
    expect(entries.every((e) => !e.available)).toBe(true);
    expect(firstAvailableHeroAction(hero, "bonusAction")).toBeUndefined();
    expect(firstAvailableHeroAction(hero, "classAction")).toBeUndefined();
  });

  it("Second Wind (Fighter) matches canUseSecondWind", () => {
    const hero = heroFrom({ classId: "fighter" });
    expect(hero.canUseSecondWind()).toBe(true);
    const action = firstAvailableHeroAction(hero, "bonusAction");
    expect(action?.id).toBe("secondWind");
    expect(action?.label).toBe("Bonus: Second Wind (R)");
  });

  it("Cunning Action Dash (Rogue) matches canUseCunningAction, only once moved", () => {
    const hero = heroFrom({ classId: "rogue" });
    expect(firstAvailableHeroAction(hero, "bonusAction")).toBeUndefined();
    hero.moveTo({ x: 1, y: 0 });
    expect(hero.canUseCunningAction()).toBe(true);
    expect(firstAvailableHeroAction(hero, "bonusAction")?.id).toBe("cunningActionDash");
  });

  it("Rage (Barbarian) matches canUseRage", () => {
    const hero = heroFrom({ classId: "barbarian" });
    expect(hero.canUseRage()).toBe(true);
    expect(firstAvailableHeroAction(hero, "bonusAction")?.id).toBe("rage");
  });

  it("Wild Shape (Druid) matches canUseWildShape, unlocked at level 2", () => {
    const hero = heroFrom({ classId: "druid" });
    expect(firstAvailableHeroAction(hero, "bonusAction")).toBeUndefined();
    levelUp(hero, 1);
    expect(hero.canUseWildShape()).toBe(true);
    expect(firstAvailableHeroAction(hero, "bonusAction")?.id).toBe("wildShape");
  });

  it("Flurry of Blows (Monk) matches canUseFlurryOfBlows, unlocked at level 2 and after acting", () => {
    const hero = heroFrom({ classId: "monk" });
    levelUp(hero, 1);
    expect(firstAvailableHeroAction(hero, "bonusAction")).toBeUndefined();
    hero.markActed();
    expect(hero.canUseFlurryOfBlows()).toBe(true);
    expect(firstAvailableHeroAction(hero, "bonusAction")?.id).toBe("flurryOfBlows");
  });

  it("Bardic Inspiration (Bard) matches canUseBardicInspiration", () => {
    const hero = heroFrom({ classId: "bard" });
    expect(hero.canUseBardicInspiration()).toBe(true);
    expect(firstAvailableHeroAction(hero, "bonusAction")?.id).toBe("bardicInspiration");
  });

  it("Hunter's Mark (Ranger) matches canUseHuntersMark, unlocked at level 2", () => {
    const hero = heroFrom({ classId: "ranger" });
    expect(firstAvailableHeroAction(hero, "bonusAction")).toBeUndefined();
    levelUp(hero, 1);
    expect(hero.canUseHuntersMark()).toBe(true);
    expect(firstAvailableHeroAction(hero, "bonusAction")?.id).toBe("huntersMark");
  });

  it("Quickened Spell (Sorcerer) matches canUseQuickenSpell, unlocked at level 3", () => {
    const hero = heroFrom({ classId: "sorcerer" });
    levelUp(hero, 1);
    expect(firstAvailableHeroAction(hero, "bonusAction")).toBeUndefined();
    levelUp(hero, 1);
    expect(hero.canUseQuickenSpell()).toBe(true);
    expect(firstAvailableHeroAction(hero, "bonusAction")?.id).toBe("quickenSpell");
  });

  it("Reckless Attack (Barbarian) matches canUseRecklessAttack, unlocked at level 2, coexists with Rage", () => {
    const hero = heroFrom({ classId: "barbarian" });
    expect(firstAvailableHeroAction(hero, "classAction")).toBeUndefined();
    levelUp(hero, 1);
    expect(hero.canUseRecklessAttack()).toBe(true);
    expect(firstAvailableHeroAction(hero, "classAction")?.id).toBe("recklessAttack");
    expect(firstAvailableHeroAction(hero, "bonusAction")?.id).toBe("rage");
  });

  it("Channel Divinity: Preserve Life (Life Domain Cleric) matches canUsePreserveLife, unlocked at level 2", () => {
    const hero = heroFrom({ classId: "cleric", subclassId: "life-domain" });
    expect(firstAvailableHeroAction(hero, "classAction")).toBeUndefined();
    levelUp(hero, 1);
    expect(hero.canUsePreserveLife()).toBe(true);
    expect(firstAvailableHeroAction(hero, "classAction")?.id).toBe("preserveLife");
  });

  it("Vanish (Ranger) matches canUseVanish, unlocked at level 14", () => {
    const hero = heroFrom({ classId: "ranger" });
    levelUp(hero, 12);
    expect(firstAvailableHeroAction(hero, "classAction")).toBeUndefined();
    levelUp(hero, 1);
    expect(hero.canUseVanish()).toBe(true);
    expect(firstAvailableHeroAction(hero, "classAction")?.id).toBe("vanish");
  });

  it("Cunning Action: Hide (Rogue) matches canUseCunningActionHide, unlocked at level 2", () => {
    const hero = heroFrom({ classId: "rogue" });
    expect(firstAvailableHeroAction(hero, "classAction")).toBeUndefined();
    levelUp(hero, 1);
    expect(hero.canUseCunningActionHide()).toBe(true);
    expect(firstAvailableHeroAction(hero, "classAction")?.id).toBe("cunningActionHide");
  });

  it("Empty Body (Monk) matches canUseEmptyBody, unlocked at a high level", () => {
    const hero = heroFrom({ classId: "monk" });
    levelUp(hero, 17);
    expect(hero.canUseEmptyBody()).toBe(true);
    expect(firstAvailableHeroAction(hero, "classAction")?.id).toBe("emptyBody");
  });
});

/**
 * D-165 (KI-098 item 2): `hotkeyDisplayLabel` is the shared label
 * `CharacterSheetScene`'s hotkey editor and `BattleScene`'s in-battle
 * hotkey bar both call — proves it correctly identifies all three id
 * sources `Hero.setActionHotkey` accepts.
 */
describe("hotkeyDisplayLabel", () => {
  it("returns '(empty)' for an unset slot", () => {
    const hero = heroFrom({ classId: "fighter" });
    expect(hotkeyDisplayLabel(hero, undefined)).toBe("(empty)");
  });

  it("strips the keyboard-shortcut suffix from a registry action's label", () => {
    const hero = heroFrom({ classId: "fighter" });
    expect(hotkeyDisplayLabel(hero, "secondWind")).toBe("Bonus: Second Wind");
  });

  it("returns a known spell/cantrip's real name", () => {
    const hero = heroFrom({ classId: "wizard" });
    expect(hotkeyDisplayLabel(hero, "fire-bolt")).toBe("Fire Bolt");
  });

  it("falls back to the raw id for something that isn't a registry action or a known spell", () => {
    const hero = heroFrom({ classId: "fighter" });
    expect(hotkeyDisplayLabel(hero, "not-a-real-id")).toBe("not-a-real-id");
  });
});
