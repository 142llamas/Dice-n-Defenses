import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import type { HeroDefinition } from "../src/game/data/heroes";

/**
 * D-173 (KI-098 item 8): hero-side split movement — move, act, then move
 * again with whatever budget is left, instead of a single `moveTo` call
 * consuming the whole turn's movement allowance outright (the old "MVP: one
 * move per turn" rule). `Hero.moveTo` now takes an optional `tilesUsed`; a
 * caller that omits it (every pre-D-173 call site, tests included) still
 * consumes the full remaining budget, so this file only covers the NEW
 * partial-consumption behavior — full-consumption is already covered by
 * `tests/turns.test.ts`.
 */

const BASE_DEF: Omit<HeroDefinition, "id" | "classId"> = {
  name: "Test Hero",
  movementTiles: 6,
  maxHealth: 10,
  attackDamage: 3,
  attackRangeTiles: 1,
  attackBonus: 4,
  baseArmorClass: 10,
};

function makeHero(classId?: string): Hero {
  return new Hero({ id: "h1", ...BASE_DEF, classId }, { x: 0, y: 0 });
}

describe("Hero.moveTo(dest, tilesUsed) — split movement (D-173)", () => {
  it("a partial move leaves the rest of the budget spendable", () => {
    const hero = makeHero();
    hero.moveTo({ x: 2, y: 0 }, 2);
    expect(hero.canMove()).toBe(true);
    expect(hero.movementBudget()).toBe(4);
    expect(hero.hasMoved).toBe(true);
  });

  it("move, act, then move again — the classic KI-098 item 8 sequence", () => {
    const hero = makeHero();
    hero.moveTo({ x: 2, y: 0 }, 2);
    hero.markActed();
    expect(hero.canAct()).toBe(false);
    expect(hero.canMove()).toBe(true);
    expect(hero.movementBudget()).toBe(4);
    hero.moveTo({ x: 4, y: 0 }, 4);
    expect(hero.position).toEqual({ x: 4, y: 0 });
    expect(hero.canMove()).toBe(false);
    expect(hero.movementBudget()).toBe(0);
  });

  it("several small partial moves in a row deplete the budget exactly, no overspend allowed by the caller's own bookkeeping", () => {
    const hero = makeHero();
    hero.moveTo({ x: 1, y: 0 }, 1);
    hero.moveTo({ x: 2, y: 0 }, 1);
    hero.moveTo({ x: 3, y: 0 }, 1);
    expect(hero.movementBudget()).toBe(3);
    hero.moveTo({ x: 6, y: 0 }, 3);
    expect(hero.movementBudget()).toBe(0);
    expect(hero.canMove()).toBe(false);
  });

  it("omitting tilesUsed still consumes the whole remaining budget (AI/legacy call sites)", () => {
    const hero = makeHero();
    hero.moveTo({ x: 2, y: 0 }, 2);
    hero.moveTo({ x: 3, y: 0 }); // no tilesUsed — consumes whatever's left (4)
    expect(hero.movementBudget()).toBe(0);
    expect(hero.canMove()).toBe(false);
  });

  it("resetForNewTurn clears the used-tiles counter, not just the moved flag", () => {
    const hero = makeHero();
    hero.moveTo({ x: 2, y: 0 }, 2);
    hero.resetForNewTurn();
    expect(hero.movementBudget()).toBe(6);
    expect(hero.canMove()).toBe(true);
  });

  it("a dead or incapacitated hero still reports zero budget regardless of partial usage", () => {
    const hero = makeHero();
    hero.moveTo({ x: 1, y: 0 }, 1);
    hero.health = 0;
    expect(hero.movementBudget()).toBe(0);
    expect(hero.canMove()).toBe(false);
  });

  it("survives a toSnapshot/fromSnapshot round trip mid-partial-move", () => {
    const hero = makeHero();
    hero.moveTo({ x: 2, y: 0 }, 2);
    const restored = Hero.fromSnapshot(hero.toSnapshot());
    expect(restored.movementBudget()).toBe(4);
    expect(restored.canMove()).toBe(true);
  });
});

describe("Cunning Action Dash real SRD math after a partial move (D-173, Rogue)", () => {
  it("grants a full extra speed ON TOP of unused budget, not just a move-slot refresh", () => {
    const hero = makeHero("rogue");
    hero.moveTo({ x: 2, y: 0 }, 2); // 2 of 6 tiles used, 4 left
    expect(hero.canUseCunningAction()).toBe(true);
    hero.useCunningActionDash();
    // 6 (normal speed) - 2 (already used) + 6 (Dash) = 10 remaining.
    expect(hero.movementBudget()).toBe(10);
  });

  it("after a fully-used move, Dash still grants exactly one full fresh speed (matches pre-D-173 behavior)", () => {
    const hero = makeHero("rogue");
    hero.moveTo({ x: 6, y: 0 }, 6); // whole budget spent
    hero.useCunningActionDash();
    expect(hero.movementBudget()).toBe(6);
  });
});
