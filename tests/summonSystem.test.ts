import { describe, it, expect } from "vitest";
import { SummonSystem } from "../src/game/systems/SummonSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { Enemy } from "../src/game/entities/Enemy";
import { getEnemyDefinition } from "../src/game/data/enemies";

/**
 * Phase 16 (D-106, "make all spells usable"): SummonSystem — a temporary
 * ally combatant that strikes the nearest enemy in reach once per hero turn
 * until its duration runs out or it's destroyed. Pure Hero/Enemy-adjacent
 * unit tests only, no Phaser — see `tests/statusEffects.test.ts` for the
 * house style this follows.
 */

describe("SummonSystem.spawn", () => {
  it("places a summon on the field with full HP and the requested duration", () => {
    const system = new SummonSystem();
    const summon = system.spawn("spectral-blade", "hero1", { x: 2, y: 2 }, 3);
    expect(summon.health).toBe(summon.def.maxHealth);
    expect(summon.remainingTurns).toBe(3);
    expect(summon.isAlive()).toBe(true);
    expect(system.summons).toHaveLength(1);
  });
});

describe("SummonSystem.actAndTick", () => {
  it("strikes the nearest enemy in range and ticks its own duration down", () => {
    const system = new SummonSystem();
    const summon = system.spawn("spectral-blade", "hero1", { x: 0, y: 0 }, 2);
    const enemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 1, y: 0 }); // adjacent

    const events = system.actAndTick([enemy], RandomService.fixed(15));
    expect(events).toHaveLength(1);
    expect(events[0].target.id).toBe(enemy.id);
    expect(enemy.health).toBeLessThan(enemy.def.maxHealth);
    expect(summon.remainingTurns).toBe(1);
  });

  it("does nothing when no enemy is in range, but still ticks down", () => {
    const system = new SummonSystem();
    const summon = system.spawn("spectral-blade", "hero1", { x: 0, y: 0 }, 1);
    const farEnemy = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 9, y: 9 });

    const events = system.actAndTick([farEnemy], RandomService.fixed(15));
    expect(events).toHaveLength(0);
    expect(summon.isAlive()).toBe(false); // duration hit 0
    expect(system.summons).toHaveLength(0); // removed
  });

  it("is removed once its duration expires", () => {
    const system = new SummonSystem();
    system.spawn("spectral-blade", "hero1", { x: 0, y: 0 }, 1);
    system.actAndTick([], RandomService.fixed(15));
    expect(system.summons).toHaveLength(0);
  });

  it("is removed once reduced to 0 HP", () => {
    const system = new SummonSystem();
    const summon = system.spawn("spectral-blade", "hero1", { x: 0, y: 0 }, 5);
    summon.health = 0;
    system.actAndTick([], RandomService.fixed(15));
    expect(system.summons).toHaveLength(0);
  });
});
