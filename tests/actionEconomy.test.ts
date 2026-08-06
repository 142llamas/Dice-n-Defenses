import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";

/**
 * Phase 13.2 (D-087): the first slice of the action economy — a bonus-action
 * slot on `Hero`, plus four class-gated features that spend it (Second Wind,
 * Action Surge, Cunning Action's Dash, Uncanny Dodge). Pure Hero-level tests
 * only; Uncanny Dodge's auto-apply against a real enemy attack lives in
 * `BattleScene.applyUncannyDodges`, which needs Phaser and can't be
 * unit-tested here (see KNOWN_ISSUES for the in-browser checklist).
 */

const BASE_DEF: Omit<HeroDefinition, "id" | "classId"> = {
  name: "Test Hero",
  movementTiles: 3,
  maxHealth: 10,
  attackDamage: 3,
  attackRangeTiles: 1,
  attackBonus: 4,
  baseArmorClass: 10,
  abilityId: "cleave",
};

function makeHero(classId?: string, id = "h1"): Hero {
  return new Hero({ id, ...BASE_DEF, classId }, { x: 0, y: 0 });
}

describe("Hero bonus-action slot", () => {
  it("starts available and is independent of move/act", () => {
    const hero = makeHero("fighter");
    expect(hero.canUseBonusAction()).toBe(true);
    hero.moveTo({ x: 1, y: 0 });
    hero.markActed();
    expect(hero.canUseBonusAction()).toBe(true);
  });

  it("resets every turn, unlike the once-per-battle resources it gates", () => {
    const hero = makeHero("fighter");
    hero.useSecondWind();
    expect(hero.canUseBonusAction()).toBe(false);
    hero.resetForNewTurn();
    expect(hero.canUseBonusAction()).toBe(true);
    // Second Wind itself does NOT come back — once per battle.
    expect(hero.canUseSecondWind()).toBe(false);
  });
});

describe("Second Wind (Fighter)", () => {
  it("is unavailable to a non-Fighter or a hero with no class at all", () => {
    expect(makeHero("rogue").canUseSecondWind()).toBe(false);
    expect(makeHero(undefined).canUseSecondWind()).toBe(false);
  });

  it("heals the Fighter, capped at max health, and spends the bonus action", () => {
    const hero = makeHero("fighter");
    hero.health = 1;
    expect(hero.canUseSecondWind()).toBe(true);
    hero.useSecondWind();
    expect(hero.health).toBeGreaterThan(1);
    expect(hero.health).toBeLessThanOrEqual(hero.effectiveMaxHealth);
    expect(hero.hasBonusActed).toBe(true);
  });

  it("never overheals past effectiveMaxHealth", () => {
    const hero = makeHero("fighter");
    hero.health = hero.effectiveMaxHealth; // already full
    hero.useSecondWind();
    expect(hero.health).toBe(hero.effectiveMaxHealth);
  });

  it("is a once-per-BATTLE resource — does not come back on resetForNewTurn", () => {
    const hero = makeHero("fighter");
    hero.useSecondWind();
    hero.resetForNewTurn();
    hero.resetForNewTurn();
    expect(hero.canUseSecondWind()).toBe(false);
  });
});

describe("Action Surge (Fighter)", () => {
  it("is unavailable to a non-Fighter", () => {
    const hero = makeHero("rogue");
    hero.markActed();
    expect(hero.canUseActionSurge()).toBe(false);
  });

  it("is unavailable to a Fighter who hasn't acted yet (nothing to surge for)", () => {
    const hero = makeHero("fighter");
    expect(hero.canUseActionSurge()).toBe(false);
  });

  it("un-consumes the action slot once the Fighter has acted, once per battle", () => {
    const hero = makeHero("fighter");
    hero.markActed();
    expect(hero.canAct()).toBe(false);
    expect(hero.canUseActionSurge()).toBe(true);
    hero.useActionSurge();
    expect(hero.canAct()).toBe(true);
    expect(hero.canUseActionSurge()).toBe(false);
  });

  it("does not touch the bonus-action slot (a separate resource from Second Wind)", () => {
    const hero = makeHero("fighter");
    hero.markActed();
    hero.useActionSurge();
    expect(hero.canUseBonusAction()).toBe(true);
  });

  it("stays spent across a resetForNewTurn (once per battle, not per turn)", () => {
    const hero = makeHero("fighter");
    hero.markActed();
    hero.useActionSurge();
    hero.resetForNewTurn();
    hero.markActed();
    expect(hero.canUseActionSurge()).toBe(false);
  });
});

describe("Cunning Action / Dash (Rogue)", () => {
  it("is unavailable to a non-Rogue", () => {
    const hero = makeHero("fighter");
    hero.moveTo({ x: 1, y: 0 });
    expect(hero.canUseCunningAction()).toBe(false);
  });

  it("is unavailable to a Rogue who hasn't moved yet", () => {
    const hero = makeHero("rogue");
    expect(hero.canUseCunningAction()).toBe(false);
  });

  it("un-consumes the move slot once the Rogue has moved, spending the bonus action", () => {
    const hero = makeHero("rogue");
    hero.moveTo({ x: 1, y: 0 });
    expect(hero.canMove()).toBe(false);
    expect(hero.canUseCunningAction()).toBe(true);
    hero.useCunningActionDash();
    expect(hero.canMove()).toBe(true);
    expect(hero.hasBonusActed).toBe(true);
    expect(hero.canUseCunningAction()).toBe(false); // bonus action now spent
  });

  it("has NO once-per-battle limit — available again next turn", () => {
    const hero = makeHero("rogue");
    hero.moveTo({ x: 1, y: 0 });
    hero.useCunningActionDash();
    hero.resetForNewTurn();
    hero.moveTo({ x: 2, y: 0 });
    expect(hero.canUseCunningAction()).toBe(true);
  });
});

describe("Uncanny Dodge (Rogue)", () => {
  it("is unavailable to a non-Rogue", () => {
    expect(makeHero("fighter").canUseUncannyDodge()).toBe(false);
  });

  it("is available to a living Rogue by default", () => {
    expect(makeHero("rogue").canUseUncannyDodge()).toBe(true);
  });

  it("spends the reaction, unavailable again until the next turn", () => {
    const hero = makeHero("rogue");
    hero.useUncannyDodge();
    expect(hero.canUseUncannyDodge()).toBe(false);
    hero.resetForNewTurn();
    expect(hero.canUseUncannyDodge()).toBe(true);
  });

  it("is unavailable to a defeated hero", () => {
    const hero = makeHero("rogue");
    hero.health = 0;
    expect(hero.canUseUncannyDodge()).toBe(false);
  });
});

describe("classId (Phase 13.2, D-087)", () => {
  it("is absent for a hero built with no classId (the classic fixed roster)", () => {
    const hero = makeHero(undefined);
    expect(hero.classId).toBeUndefined();
    expect(hero.canUseSecondWind()).toBe(false);
    expect(hero.canUseActionSurge()).toBe(false);
    expect(hero.canUseCunningAction()).toBe(false);
    expect(hero.canUseUncannyDodge()).toBe(false);
  });

  it("is carried through from HeroDefinition", () => {
    expect(makeHero("fighter").classId).toBe("fighter");
    expect(makeHero("rogue").classId).toBe("rogue");
  });
});
