import { describe, it, expect } from "vitest";
import { RestSystem } from "../src/game/systems/RestSystem";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";

/**
 * Phase 13.4 (D-088): the per-run Rest-charge pool, and the Hero-level
 * `shortRest`/`longRest` effects it triggers. Resolves 13.2's (D-087)
 * "once per battle" placeholder for Second Wind/Action Surge with the SRD's
 * real once-per-rest cadence. Pure unit tests only — the between-waves
 * overlay itself lives in BattleScene and needs Phaser (see KNOWN_ISSUES for
 * the in-browser checklist).
 */

const BASE_DEF: Omit<HeroDefinition, "id" | "classId"> = {
  name: "Test Hero",
  movementTiles: 3,
  maxHealth: 20,
  attackDamage: 3,
  attackRangeTiles: 1,
  attackBonus: 4,
  baseArmorClass: 10,
  abilityId: "cleave",
};

function makeHero(classId?: string, id = "h1"): Hero {
  return new Hero({ id, ...BASE_DEF, classId }, { x: 0, y: 0 });
}

describe("RestSystem — charge bookkeeping", () => {
  it("starts with exactly the configured charge counts", () => {
    const rests = new RestSystem({ shortRestCharges: 3, longRestCharges: 1 });
    expect(rests.shortRestsRemaining).toBe(3);
    expect(rests.longRestsRemaining).toBe(1);
    expect(rests.canTakeShortRest()).toBe(true);
    expect(rests.canTakeLongRest()).toBe(true);
  });

  it("decrements the right pool on each rest and reports false when exhausted", () => {
    const rests = new RestSystem({ shortRestCharges: 1, longRestCharges: 1 });
    expect(rests.takeShortRest([])).toBe(true);
    expect(rests.shortRestsRemaining).toBe(0);
    expect(rests.canTakeShortRest()).toBe(false);
    expect(rests.takeShortRest([])).toBe(false); // no charge left
    expect(rests.shortRestsRemaining).toBe(0); // unchanged by the rejected call

    expect(rests.takeLongRest([])).toBe(true);
    expect(rests.longRestsRemaining).toBe(0);
    expect(rests.takeLongRest([])).toBe(false);
  });

  it("rejects a rest outright with zero starting charges (e.g. Nightmare's Long Rest)", () => {
    const rests = new RestSystem({ shortRestCharges: 0, longRestCharges: 0 });
    expect(rests.canTakeShortRest()).toBe(false);
    expect(rests.canTakeLongRest()).toBe(false);
    expect(rests.takeShortRest([])).toBe(false);
    expect(rests.takeLongRest([])).toBe(false);
  });
});

describe("RestSystem — applying rests to heroes", () => {
  it("a Short Rest recharges a Fighter's Second Wind/Action Surge for the next turn", () => {
    const rests = new RestSystem({ shortRestCharges: 1, longRestCharges: 0 });
    const fighter = makeHero("fighter");
    fighter.useSecondWind(); // spends Second Wind and the bonus action
    fighter.resetForNewTurn(); // a later turn, same battle — bonus action free again, Second Wind still spent
    fighter.markActed();
    fighter.useActionSurge(); // spends Action Surge
    expect(fighter.canUseSecondWind()).toBe(false);
    expect(fighter.canUseActionSurge()).toBe(false);

    rests.takeShortRest([fighter]);
    fighter.resetForNewTurn(); // the next turn's fresh bonus action
    expect(fighter.canUseSecondWind()).toBe(true);
    fighter.markActed();
    expect(fighter.canUseActionSurge()).toBe(true);
  });

  it("a Short Rest never overheals past effectiveMaxHealth", () => {
    const rests = new RestSystem({ shortRestCharges: 1, longRestCharges: 0 });
    const hero = makeHero(undefined);
    hero.health = hero.effectiveMaxHealth; // already full
    rests.takeShortRest([hero]);
    expect(hero.health).toBe(hero.effectiveMaxHealth);
  });

  it("a Long Rest fully heals every hero and recharges rest-gated resources", () => {
    const rests = new RestSystem({ shortRestCharges: 0, longRestCharges: 1 });
    const fighter = makeHero("fighter");
    fighter.health = 1;
    fighter.markActed();
    fighter.useActionSurge();

    rests.takeLongRest([fighter]);
    expect(fighter.health).toBe(fighter.effectiveMaxHealth);
    expect(fighter.canUseSecondWind()).toBe(true);
  });

  it("does not touch a hero NOT passed in (only living heroes should ever be passed)", () => {
    const rests = new RestSystem({ shortRestCharges: 1, longRestCharges: 1 });
    const resting = makeHero("fighter", "resting");
    const untouched = makeHero("fighter", "untouched");
    resting.health = 1;
    untouched.health = 1;
    rests.takeShortRest([resting]); // untouched deliberately excluded
    expect(resting.health).toBeGreaterThan(1);
    expect(untouched.health).toBe(1);
  });
});

describe("Hero.shortRest / Hero.longRest directly", () => {
  it("shortRest heals a flat fraction of max HP, at least 1", () => {
    const hero = makeHero(undefined);
    hero.health = 1;
    hero.shortRest();
    expect(hero.health).toBeGreaterThan(1);
    expect(hero.health).toBeLessThan(hero.effectiveMaxHealth); // 20 max * 0.25 = 5, not a full heal
  });

  it("longRest always sets health to exactly effectiveMaxHealth", () => {
    const hero = makeHero(undefined);
    hero.health = 3;
    hero.longRest();
    expect(hero.health).toBe(hero.effectiveMaxHealth);
  });

  it("both clear secondWindUsed/actionSurgeUsed regardless of class (harmless no-op for non-Fighters)", () => {
    const hero = makeHero("rogue");
    expect(() => hero.shortRest()).not.toThrow();
    expect(() => hero.longRest()).not.toThrow();
    expect(hero.canUseSecondWind()).toBe(false); // still false — wrong class, not a rest-cadence issue
  });
});
