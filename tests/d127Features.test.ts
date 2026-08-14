import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";

/**
 * D-127: four foundational systems closing long-documented "no system to
 * hook into yet" gaps (KI-069, KI-070, KI-082). This file covers the one
 * that's a plain `Hero` getter — `hasStealthSense` (Blindsense/Feral
 * Senses). The actual per-observer targeting exception it feeds
 * (`BattleScene.isEnemyTargetable`'s `observerHero` parameter) is
 * BattleScene-only and needs Phaser, the same standing "scene code isn't
 * unit-tested" limitation every other in-battle auto-apply mechanic in this
 * project has (Uncanny Dodge, Grappler, etc.) — see `KNOWN_ISSUES.md`.
 * Damage-type resistance (pure, in `CombatSystem`) is covered in
 * `tests/combat.test.ts`'s own D-127 block instead.
 */

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    abilityId: "cleave",
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

describe("Rogue's Blindsense / Ranger's Feral Senses — hasStealthSense (D-127)", () => {
  it("a level-1 Rogue/Ranger has no stealth sense yet", () => {
    expect(heroFromBuild({ classId: "rogue", abilityId: "cleave" }).hasStealthSense).toBe(false);
    expect(heroFromBuild({ classId: "ranger", abilityId: "cleave" }).hasStealthSense).toBe(false);
  });

  it("a Rogue gains Blindsense at level 14, not level 13", () => {
    const rogue = heroFromBuild({ classId: "rogue", abilityId: "cleave" });
    levelUpTo(rogue, 13);
    expect(rogue.hasStealthSense).toBe(false);
    rogue.levelUpClass();
    expect(rogue.level).toBe(14);
    expect(rogue.hasStealthSense).toBe(true);
  });

  it("a Ranger gains Feral Senses at level 18, not level 17", () => {
    const ranger = heroFromBuild({ classId: "ranger", abilityId: "cleave" });
    levelUpTo(ranger, 17);
    expect(ranger.hasStealthSense).toBe(false);
    ranger.levelUpClass();
    expect(ranger.level).toBe(18);
    expect(ranger.hasStealthSense).toBe(true);
  });

  it("a same-level Fighter never gains stealth sense", () => {
    const fighter = heroFromBuild();
    levelUpTo(fighter, 20);
    expect(fighter.hasStealthSense).toBe(false);
  });
});
