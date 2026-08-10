import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { BuildSystem } from "../src/game/systems/BuildSystem";
import { EconomySystem } from "../src/game/systems/EconomySystem";
import { RestSystem } from "../src/game/systems/RestSystem";
import { TurnSystem } from "../src/game/systems/TurnSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { Hero } from "../src/game/entities/Hero";
import { Enemy } from "../src/game/entities/Enemy";
import { getEnemyDefinition } from "../src/game/data/enemies";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import type { WaveDefinition } from "../src/game/data/waves";
import { captureBattleState, restoreBattleState, type LiveBattleState } from "../src/game/systems/BattleStateSnapshot";

/**
 * Phase 12.1 (D-101): `BattleStateSnapshot` is the first sub-phase of
 * `PHASE_12_MULTIPLAYER_FEASIBILITY.md`'s proposed roadmap — a pure,
 * fully-tested serialize/deserialize round trip for everything a live
 * battle needs, with no networking or Phaser involved. These tests exist
 * independently of any multiplayer code and are useful on their own merit
 * (e.g. a future mid-battle autosave) — Phase 12 is simply what motivated
 * building them now.
 *
 * The core assertion pattern throughout: `toSnapshot()` -> `fromSnapshot()`
 * -> `toSnapshot()` again should produce the exact same plain data as the
 * first call. This is stronger than asserting individual getters — it
 * proves EVERY field survives the round trip, not just the ones a test
 * author remembered to check by hand.
 */

function makeBarbarianBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Grud",
    raceId: "human",
    classId: "barbarian",
    level: 1,
    abilityScores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8 },
    abilityId: "cleave",
    controlledBy: "human",
    ...overrides,
  };
}

describe("Hero.toSnapshot / Hero.fromSnapshot — full round trip", () => {
  it("round-trips a hero after a mix of in-battle mutations", () => {
    const hero = new Hero(heroDefinitionFromBuild(makeBarbarianBuild({ id: "build-mix" })), { x: 0, y: 0 });
    hero.moveTo({ x: 1, y: 0 });
    hero.markActed();
    hero.grantMight(2);
    hero.equippedItems.head = "leather-cap";
    hero.equippedPotions.general1 = "healing-draught";
    hero.health -= 3;

    const before = hero.toSnapshot();
    const restored = Hero.fromSnapshot(before);
    const after = restored.toSnapshot();

    expect(after).toEqual(before);
  });

  it("round-trips a D&D-built hero's full class/subclass/resource state", () => {
    const def = heroDefinitionFromBuild(makeBarbarianBuild());
    const hero = new Hero(def, { x: 2, y: 0 });

    hero.levelUpClass();
    hero.levelUpClass();
    hero.grantSubclass("path-of-the-ironhide");
    hero.useRage();
    hero.grantFeat("tough");
    hero.improveAbilityScore("str", 2);
    hero.moveTo({ x: 3, y: 0 });
    hero.markActed();
    hero.health -= 4;

    const before = hero.toSnapshot();
    const restored = Hero.fromSnapshot(before);
    const after = restored.toSnapshot();

    expect(after).toEqual(before);
    // Spot-check a few derived getters too, not just the raw snapshot fields —
    // these prove the restored hero actually BEHAVES like the original, not
    // just that its private fields happen to match.
    expect(restored.level).toBe(hero.level);
    expect(restored.isRaging).toBe(hero.isRaging);
    expect(restored.armorClass).toBe(hero.armorClass);
    expect(restored.effectiveMaxHealth).toBe(hero.effectiveMaxHealth);
    expect(restored.subclassId).toBe("path-of-the-ironhide");
  });
});

describe("Enemy.toSnapshot / Enemy.fromSnapshot — full round trip", () => {
  it("round-trips position, health, breach state, and active statuses", () => {
    const enemy = new Enemy("grunt#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    enemy.position = { x: 2, y: 1 };
    enemy.health = 3;
    enemy.applyStatus("slowed", 2);
    enemy.applyStatus("burning", 3);

    const before = enemy.toSnapshot();
    const restored = Enemy.fromSnapshot(before);
    const after = restored.toSnapshot();

    expect(after).toEqual(before);
    expect(restored.hasStatus("slowed")).toBe(true);
    expect(restored.hasStatus("burning")).toBe(true);
    expect(restored.effectiveMovementTiles).toBe(enemy.effectiveMovementTiles);
  });
});

function makeLaneBattle(): {
  map: GameMap;
  pathfinding: PathfindingSystem;
  waves: WaveDefinition[];
  liveState: LiveBattleState;
} {
  const map = new GameMap(parseMapRows("lane", "Lane", ["S..X", "...."]));
  const pathfinding = new PathfindingSystem(map);
  const waves: WaveDefinition[] = [
    {
      id: "w1",
      spawns: [{ enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 }],
      completionGold: 10,
    },
    {
      id: "w2",
      spawns: [{ enemyId: "runner", count: 1, startTurn: 1, intervalTurns: 1 }],
      completionGold: 15,
    },
  ];
  const random = RandomService.fixed();
  const waveSystem = new WaveSystem(map, pathfinding, waves, { startingIntegrity: 20, random });
  waveSystem.startWave(0);
  waveSystem.tickEnemyPhase(); // spawns a grunt, gives it real position/turn progress
  waveSystem.enemies[0]?.applyStatus("slowed", 2);

  const buildSystem = new BuildSystem(map, pathfinding);
  buildSystem.place("spike-trap", { x: 1, y: 0 });
  buildSystem.place("barricade", { x: 2, y: 0 }, undefined, undefined, "hero-ash");

  const economy = new EconomySystem(100);
  economy.spend(30);
  economy.award(12);

  const restSystem = new RestSystem({ shortRestCharges: 3, longRestCharges: 1 });
  restSystem.takeShortRest([]);

  const turns = new TurnSystem();
  turns.transitionTo("player");
  turns.transitionTo("enemy");
  turns.transitionTo("resolution");

  const heroA = new Hero(heroDefinitionFromBuild(makeBarbarianBuild({ id: "build-a" })), { x: 0, y: 0 });
  heroA.moveTo({ x: 1, y: 0 });
  heroA.grantMight(4);
  heroA.equippedItems.head = "leather-cap";

  const heroB = new Hero(heroDefinitionFromBuild(makeBarbarianBuild()), { x: 2, y: 0 });
  heroB.levelUpClass();
  heroB.grantSubclass("path-of-the-ironhide");
  heroB.useRage();

  const liveState: LiveBattleState = {
    turns,
    economy,
    heroes: [heroA, heroB],
    waveSystem,
    buildSystem,
    restSystem,
    wavesCleared: 2,
  };

  return { map, pathfinding, waves, liveState };
}

describe("captureBattleState / restoreBattleState — full battle round trip", () => {
  it("reproduces every live system's state exactly, from fresh instances", () => {
    const { pathfinding: pathfinding1, waves, liveState } = makeLaneBattle();
    const before = captureBattleState(liveState);

    // Deliberately restore against BRAND NEW map/pathfinding instances (not
    // the ones the original battle used) — proves the snapshot is really
    // self-contained data, not something quietly relying on shared object
    // identity with the live battle it came from.
    const map2 = new GameMap(parseMapRows("lane", "Lane", ["S..X", "...."]));
    const pathfinding2 = new PathfindingSystem(map2);
    void pathfinding1;
    const restored = restoreBattleState(before, {
      map: map2,
      pathfinding: pathfinding2,
      waves,
      random: RandomService.fixed(),
    });
    const after = captureBattleState(restored);

    expect(after).toEqual(before);
  });

  it("restored systems behave like the originals, not just match on paper", () => {
    const { waves, liveState } = makeLaneBattle();
    const snapshot = captureBattleState(liveState);
    const map2 = new GameMap(parseMapRows("lane", "Lane", ["S..X", "...."]));
    const pathfinding2 = new PathfindingSystem(map2);
    const restored = restoreBattleState(snapshot, {
      map: map2,
      pathfinding: pathfinding2,
      waves,
      random: RandomService.fixed(),
    });

    expect(restored.turns.current).toBe(liveState.turns.current);
    expect(restored.economy.gold).toBe(liveState.economy.gold);
    expect(restored.wavesCleared).toBe(liveState.wavesCleared);
    expect(restored.restSystem.shortRestsRemaining).toBe(liveState.restSystem.shortRestsRemaining);
    expect(restored.restSystem.longRestsRemaining).toBe(liveState.restSystem.longRestsRemaining);
    expect(restored.waveSystem.integrity).toBe(liveState.waveSystem.integrity);
    expect(restored.waveSystem.waveNumber).toBe(liveState.waveSystem.waveNumber);
    expect(restored.waveSystem.enemies.length).toBe(liveState.waveSystem.enemies.length);
    expect(restored.waveSystem.enemies[0]?.hasStatus("slowed")).toBe(true);
    expect(restored.buildSystem.structures.length).toBe(liveState.buildSystem.structures.length);
    expect(restored.buildSystem.wallAt({ x: 2, y: 0 })).not.toBeNull();
    expect(restored.buildSystem.trapAt({ x: 1, y: 0 })).not.toBeNull();
    // A restored BuildSystem's `byTile` index must be rebuilt from the
    // snapshot, not left empty — placing on an already-occupied tile should
    // still be rejected exactly like it would be on the original instance.
    const onOccupiedTile = restored.buildSystem.place("barricade", { x: 1, y: 0 });
    expect(onOccupiedTile.ok).toBe(false);

    expect(restored.heroes[0].position).toEqual(liveState.heroes[0].position);
    expect(restored.heroes[0].effectiveMaxHealth).toBe(liveState.heroes[0].effectiveMaxHealth);
    expect(restored.heroes[1].subclassId).toBe("path-of-the-ironhide");
    expect(restored.heroes[1].isRaging).toBe(true);
    expect(restored.heroes[1].armorClass).toBe(liveState.heroes[1].armorClass);
  });
});
