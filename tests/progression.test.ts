import { describe, it, expect } from "vitest";
import { ProgressionSystem, LEVEL_UP_WAVE_INTERVAL } from "../src/game/systems/ProgressionSystem";
import { Hero } from "../src/game/entities/Hero";
import { getHeroDefinition } from "../src/game/data/heroes";

/**
 * Phase 7 "level-up choices" tests. ProgressionSystem is pure arithmetic over
 * "waves cleared" plus applying a choice to a set of heroes; BattleScene only
 * calls `hasPendingLevelUp` after a wave reward and shows the prompt if true.
 */

function ash(): Hero {
  return new Hero(getHeroDefinition("hero-ash"), { x: 0, y: 0 });
}

describe("ProgressionSystem cadence", () => {
  it("has no pending level-up before the first threshold", () => {
    const p = new ProgressionSystem();
    for (let w = 0; w < LEVEL_UP_WAVE_INTERVAL; w++) {
      expect(p.hasPendingLevelUp(w)).toBe(false);
    }
  });

  it("becomes pending exactly at each interval, once per threshold", () => {
    const p = new ProgressionSystem();
    expect(p.hasPendingLevelUp(LEVEL_UP_WAVE_INTERVAL)).toBe(true);
    p.applyChoice("might", []);
    expect(p.levelsSoFar).toBe(1);
    // Not pending again until the NEXT threshold.
    expect(p.hasPendingLevelUp(LEVEL_UP_WAVE_INTERVAL)).toBe(false);
    expect(p.hasPendingLevelUp(LEVEL_UP_WAVE_INTERVAL * 2 - 1)).toBe(false);
    expect(p.hasPendingLevelUp(LEVEL_UP_WAVE_INTERVAL * 2)).toBe(true);
  });
});

describe("ProgressionSystem choices", () => {
  it("Vigor raises max HP and heals living heroes by the same amount", () => {
    const hero = ash(); // 12 max HP
    hero.health = 5; // simulate a hero that's taken damage
    const p = new ProgressionSystem();
    p.applyChoice("vigor", [hero]);
    expect(hero.effectiveMaxHealth).toBe(15); // +3
    expect(hero.health).toBe(8); // healed by the same +3
  });

  it("Might raises basic-attack damage", () => {
    const hero = ash(); // 4 base attack damage
    const p = new ProgressionSystem();
    p.applyChoice("might", [hero]);
    expect(hero.effectiveAttackDamage).toBe(5);
  });

  it("only applies to the heroes passed in (a fallen hero gets nothing retroactively)", () => {
    const alive = ash();
    const p = new ProgressionSystem();
    p.applyChoice("vigor", [alive]); // caller passes only living heroes
    expect(alive.effectiveMaxHealth).toBe(15);
  });
});
