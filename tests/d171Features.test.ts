import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import { getRaceDefinition } from "../src/game/data/races";

/**
 * D-171 (KI-098 item 7): the Monk's Unarmored Movement (level 2+) and the
 * Barbarian's Fast Movement (level 5+) — both previously data-only,
 * `mechanicallyActive: false` SRD features (see `data/classes.ts`) — now
 * grant a real +2 tiles via `Hero.classMovementBonus`, a derived value
 * folded into `effectiveMovementTiles` alongside gear/potion bonuses.
 * (+2, not +1: D-172 rescaled the whole game to 5ft/tile, and this
 * represents a flat 10ft bonus — 10ft ÷ 5ft = 2.)
 */

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    controlledBy: "human",
    ...overrides,
  };
}

function heroFromBuild(overrides: Partial<CharacterBuild> = {}): Hero {
  return new Hero(heroDefinitionFromBuild(build(overrides)), { x: 0, y: 0 });
}

function levelUpTo(hero: Hero, level: number): void {
  for (let i = hero.level; i < level; i++) hero.levelUpClass();
}

describe("Monk's Unarmored Movement / Barbarian's Fast Movement — Hero.classMovementBonus (D-171)", () => {
  it("a level-1 Monk has no bonus yet", () => {
    const hero = heroFromBuild({ classId: "monk" });
    expect(hero.effectiveMovementTiles).toBe(getRaceDefinition("human").speedTiles);
  });

  it("a level-2 Monk gains +2 tiles", () => {
    const hero = heroFromBuild({ classId: "monk" });
    levelUpTo(hero, 2);
    expect(hero.effectiveMovementTiles).toBe(getRaceDefinition("human").speedTiles + 2);
  });

  it("a level-4 Barbarian has no bonus yet", () => {
    const hero = heroFromBuild({ classId: "barbarian" });
    levelUpTo(hero, 4);
    expect(hero.effectiveMovementTiles).toBe(getRaceDefinition("human").speedTiles);
  });

  it("a level-5 Barbarian gains +2 tiles", () => {
    const hero = heroFromBuild({ classId: "barbarian" });
    levelUpTo(hero, 5);
    expect(hero.effectiveMovementTiles).toBe(getRaceDefinition("human").speedTiles + 2);
  });

  it("a non-Monk, non-Barbarian class never gets this bonus, even at a high level", () => {
    const hero = heroFromBuild({ classId: "fighter" });
    levelUpTo(hero, 10);
    expect(hero.effectiveMovementTiles).toBe(getRaceDefinition("human").speedTiles);
  });

  it("stacks with a race's own speed and a gear/potion movement bonus", () => {
    const hero = heroFromBuild({ classId: "monk", raceId: "dwarf" });
    levelUpTo(hero, 2);
    const base = getRaceDefinition("dwarf").speedTiles + 2; // dwarf's slower base + the Monk bonus
    expect(hero.effectiveMovementTiles).toBe(base);
    hero.equippedPotions.general1 = "potion-of-speed"; // +4 tiles
    hero.usePotion("general1");
    expect(hero.effectiveMovementTiles).toBe(base + 4);
  });
});
