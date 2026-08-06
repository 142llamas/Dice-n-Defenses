import { describe, it, expect } from "vitest";
import { TurnSystem, type GamePhase } from "../src/game/systems/TurnSystem";
import { Hero } from "../src/game/entities/Hero";

/**
 * Phase 2 turn + hero tests. These back two acceptance criteria:
 *   - phase changes occur ONCE and in the CORRECT order,
 *   - a hero's move/action budget behaves as the MVP economy specifies and
 *     resets each turn (which is what makes "cancel restores prior state"
 *     meaningful at the scene level: an uncommitted move never touches state).
 */

describe("TurnSystem ordering", () => {
  it("starts in preparation", () => {
    const t = new TurnSystem();
    expect(t.current).toBe("preparation");
    expect(t.transitionCount).toBe(0);
  });

  it("advances through the normal wave loop in order", () => {
    const t = new TurnSystem();
    const seen: GamePhase[] = [t.current];
    // preparation -> player -> enemy -> resolution -> betweenWave -> player
    for (let i = 0; i < 5; i++) {
      const next = t.advance();
      expect(next).not.toBeNull();
      seen.push(next!);
    }
    expect(seen).toEqual([
      "preparation",
      "player",
      "enemy",
      "resolution",
      "betweenWave",
      "player",
    ]);
  });

  it("fires onChange exactly once per transition, with correct args", () => {
    const t = new TurnSystem();
    const calls: Array<{ next: GamePhase; prev: GamePhase }> = [];
    t.onChange = (next, prev) => calls.push({ next, prev });
    t.advance(); // preparation -> player
    t.advance(); // player -> enemy
    expect(calls).toEqual([
      { next: "player", prev: "preparation" },
      { next: "enemy", prev: "player" },
    ]);
    expect(t.transitionCount).toBe(2);
  });

  it("does not fire onChange or change state on an illegal transition", () => {
    const t = new TurnSystem();
    let fired = 0;
    t.onChange = () => fired++;
    // From preparation, jumping straight to enemy is illegal.
    expect(t.transitionTo("enemy")).toBe(false);
    expect(t.current).toBe("preparation");
    expect(t.transitionCount).toBe(0);
    expect(fired).toBe(0);
  });

  it("allows resolution to loop back to player within a wave", () => {
    const t = new TurnSystem();
    t.advance(); // player
    t.advance(); // enemy
    t.advance(); // resolution
    expect(t.canTransitionTo("player")).toBe(true); // continue the same wave
    expect(t.transitionTo("player")).toBe(true);
    expect(t.current).toBe("player");
  });

  it("allows resolution and betweenWave to reach victory/defeat", () => {
    const t = new TurnSystem();
    t.advance(); // player
    t.advance(); // enemy
    t.advance(); // resolution
    expect(t.canTransitionTo("victory")).toBe(true);
    expect(t.canTransitionTo("defeat")).toBe(true);
    expect(t.transitionTo("defeat")).toBe(true);
    expect(t.current).toBe("defeat");
    expect(t.isTerminal()).toBe(true);
    expect(t.advance()).toBeNull(); // nothing follows a terminal phase
  });

  it("records history and resets cleanly", () => {
    const t = new TurnSystem();
    t.advance();
    t.advance();
    expect(t.history).toEqual(["preparation", "player", "enemy"]);
    t.reset();
    expect(t.current).toBe("preparation");
    expect(t.transitionCount).toBe(0);
    expect(t.history).toEqual(["preparation"]);
  });
});

describe("Hero turn economy", () => {
  // The movement economy tested here is independent of combat stats. This helper
  // supplies the Phase 4 combat fields (health/attack/ability) so a Hero can be
  // built, while the assertions below still only exercise move/action behaviour.
  const makeHero = (movementTiles: number) =>
    new Hero(
      {
        id: "h1",
        name: "Ash",
        movementTiles,
        maxHealth: 10,
        attackDamage: 3,
        attackRangeTiles: 1,
        attackBonus: 4,
        baseArmorClass: 10,
        abilityId: "cleave",
      },
      { x: 0, y: 0 },
    );

  it("starts able to move and act, at its start position", () => {
    const hero = new Hero(
      {
        id: "h1",
        name: "Ash",
        movementTiles: 4,
        maxHealth: 10,
        attackDamage: 3,
        attackRangeTiles: 1,
        attackBonus: 4,
        baseArmorClass: 10,
        abilityId: "cleave",
      },
      { x: 2, y: 3 },
    );
    expect(hero.position).toEqual({ x: 2, y: 3 });
    expect(hero.canMove()).toBe(true);
    expect(hero.canAct()).toBe(true);
    expect(hero.movementBudget()).toBe(4);
  });

  it("spends its move once committed and reports zero remaining budget", () => {
    const hero = makeHero(4);
    hero.moveTo({ x: 1, y: 0 });
    expect(hero.position).toEqual({ x: 1, y: 0 });
    expect(hero.hasMoved).toBe(true);
    expect(hero.canMove()).toBe(false);
    expect(hero.movementBudget()).toBe(0);
  });

  it("resets move and action flags for a new turn", () => {
    const hero = makeHero(4);
    hero.moveTo({ x: 1, y: 0 });
    hero.markActed();
    expect(hero.canMove()).toBe(false);
    expect(hero.canAct()).toBe(false);
    hero.resetForNewTurn();
    expect(hero.canMove()).toBe(true);
    expect(hero.canAct()).toBe(true);
    expect(hero.movementBudget()).toBe(4);
    // Position is unchanged by a reset — only the per-turn flags clear.
    expect(hero.position).toEqual({ x: 1, y: 0 });
  });

  it("copies the destination so external edits cannot corrupt hero state", () => {
    const hero = makeHero(4);
    const dest = { x: 2, y: 2 };
    hero.moveTo(dest);
    dest.x = 99;
    expect(hero.position).toEqual({ x: 2, y: 2 });
  });
});
