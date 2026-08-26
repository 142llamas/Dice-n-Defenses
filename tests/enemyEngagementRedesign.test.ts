import { describe, it, expect } from "vitest";
import { parseMapRows } from "../src/game/data/testMap";
import { GameMap } from "../src/game/systems/GameMap";
import { PathfindingSystem } from "../src/game/systems/PathfindingSystem";
import { BuildSystem } from "../src/game/systems/BuildSystem";
import { WaveSystem } from "../src/game/systems/WaveSystem";
import { RandomService } from "../src/game/systems/RandomService";
import { Enemy } from "../src/game/entities/Enemy";
import { ENEMY_DEFINITIONS, getEnemyDefinition } from "../src/game/data/enemies";
import type { Combatant } from "../src/game/systems/CombatSystem";
import type { WaveDefinition } from "../src/game/data/waves";
import type { GridPosition } from "../src/game/systems/GridSystem";

/**
 * Enemy AI/Movement Redesign §1/§2 (D-139/D-140): behavioural tests for the
 * new engagement priority — every enemy always attempts to advance by
 * default; forced melee happens only when a hero physically blocks its ONLY
 * route (no detour at all); short of that, Aggressiveness (0-100) is a
 * tolerance dial on how much EXTRA route length it accepts before giving up
 * on a detour and forcing the issue instead. See PHASE_HANDOFF.md's original
 * spec and DECISIONS.md D-139/D-140 for the full design.
 */

function heroAt(id: string, position: GridPosition): Combatant {
  return { id, position, health: 20, armorClass: 15, savingThrowBonus: 0 };
}

function oneEnemyWave(enemyId: string): WaveDefinition {
  return { id: "w", spawns: [{ enemyId, count: 1, startTurn: 1, intervalTurns: 1 }], completionGold: 0 };
}

function makeWs(rows: string[], enemyId = "grunt") {
  const map = new GameMap(parseMapRows("m", "m", rows));
  const pf = new PathfindingSystem(map);
  const ws = new WaveSystem(map, pf, [oneEnemyWave(enemyId)], { startingIntegrity: 20, random: RandomService.fixed() });
  ws.startWave(0);
  return ws;
}

describe("§1 (D-139): always advance by default, forced melee only when boxed in", () => {
  it("ignores an adjacent off-path hero and keeps advancing", () => {
    // A longer lane than before (D-172 doubled Grunt's speed to 4 tiles/
    // phase) so its full, undeflected move doesn't reach the exit.
    const ws = makeWs(["S.....X", "......."]);
    const hero = heroAt("hero-1", { x: 0, y: 1 }); // adjacent to spawn, off the row-0 route
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 0 && p.y === 1 });
    expect(t1.attacks).toHaveLength(0);
    expect(t1.moves).toHaveLength(1);
    expect(ws.enemies[0].position).toEqual({ x: 4, y: 0 }); // grunt's full 4-tile move, untouched
  });

  it("forces melee when a hero is the SOLE blocker (a dead end)", () => {
    const ws = makeWs(["S..X"]); // 1-wide: no detour possible at all
    const hero = heroAt("hero-1", { x: 1, y: 0 }); // directly ahead, adjacent
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 1 && p.y === 0 });
    expect(t1.attacks).toHaveLength(1);
    expect(t1.moves).toHaveLength(0); // held, didn't move
    expect(ws.enemies[0].position).toEqual({ x: 0, y: 0 });
  });

  it("reroutes around a hero blocking one of two open routes instead of fighting", () => {
    // A longer lane than before (D-172 doubled Grunt's speed to 4 tiles/
    // phase) so a full detour doesn't also reach the exit this same phase.
    const ws = makeWs(["S.....X", "......."]);
    const hero = heroAt("hero-1", { x: 1, y: 0 }); // blocks row 0's second tile only
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 1 && p.y === 0 });
    expect(t1.attacks).toHaveLength(0); // detoured instead of fighting
    expect(t1.moves).toHaveLength(1);
    const pos = ws.enemies[0].position;
    expect(pos).not.toEqual({ x: 1, y: 0 }); // never entered the blocked tile
    expect(pos).not.toEqual({ x: 0, y: 0 }); // but made real progress
  });
});

describe("§2 (D-140): Aggressiveness — a tolerance dial on detour length", () => {
  // A hero blocking a single tile in a 2-row-tall chokepoint costs a modest
  // detour; blocking a whole 2-tile-wide column across two enclosed rows
  // (a wider hazard than one hero could physically make alone, but a clean
  // way to force a KNOWN, larger extra-route-length for this numeric test)
  // forces a much longer one — enough to separate a low-aggressiveness
  // enemy (always worth detouring) from a high-aggressiveness one (not
  // worth it past a much smaller extra cost).
  // A longer lane than before (D-172 nearly doubled both the Siegebreaker's
  // and the Shadowfang's speed) so neither can reach the exit within one
  // phase, detour or not.
  const rows = ["S.....X", ".......", "......."];
  const blocked = (p: GridPosition) => p.x === 1 && p.y <= 1;

  it("a low-aggressiveness enemy (siege archetype, default 10) always pays a long detour rather than fight", () => {
    const ws = makeWs(rows, "siegebreaker");
    const hero = heroAt("hero-1", { x: 1, y: 0 });
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: blocked });
    expect(t1.attacks).toHaveLength(0); // took the detour instead of forcing it
    expect(t1.moves).toHaveLength(1);
    expect(ws.enemies[0].position).not.toEqual({ x: 0, y: 0 }); // made progress
  });

  it("a high-aggressiveness enemy (stealth/hunter archetype, default 85) forces the issue instead of detouring", () => {
    const ws = makeWs(rows, "shadowfang");
    const hero = heroAt("hero-1", { x: 1, y: 0 }); // already adjacent to spawn
    const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: blocked });
    expect(t1.attacks).toHaveLength(1); // didn't bother with the long detour
    // Enemy AI/Movement Redesign step 5 (D-143): landing the attack no
    // longer ends the phase outright — the pre-attack walk spent NOTHING
    // (the hero was already adjacent), so the enemy's full movement budget
    // is still available afterward, and it's no longer "forcing" anything
    // once it's already struck. It spends that leftover budget on the very
    // detour it declined before attacking, so it ends up somewhere down
    // that route, not held at the spawn.
    expect(t1.moves).toHaveLength(1);
    expect(ws.enemies[0].position).not.toEqual({ x: 0, y: 0 });
  });

  it("an aggressiveness-100 enemy actively diverts to hunt a visible hero even with nothing blocking its goal-path", () => {
    // No roster enemy defaults to 100 (Kevin's own spec reserves it for a
    // dedicated future "true hunter" archetype) — a throwaway registry
    // entry with an explicit override exercises the top-end behavior
    // itself without touching any real content.
    const testDefId = "test-only-aggressive-100";
    ENEMY_DEFINITIONS[testDefId] = { ...getEnemyDefinition("grunt"), id: testDefId, aggressiveness: 100 };
    try {
      const ws = makeWs(["S....X", "......"], testDefId);
      const hero = heroAt("hero-1", { x: 2, y: 0 });
      const t1 = ws.tickEnemyPhase({
        heroTargets: [hero],
        isBlocked: (p) => p.x === hero.position.x && p.y === hero.position.y,
      });
      expect(t1.attacks).toHaveLength(1); // diverted off-path to chase and strike
    } finally {
      delete ENEMY_DEFINITIONS[testDefId];
    }
  });

  it("D-142 (closes KI-093): a hero diagonally adjacent to the spawn still gets attacked, even though the enemy holds position with no intermediate waypoint to move to", () => {
    // A hero at (1,1) from a spawn at (0,0) is reachable only by a single
    // diagonal hop directly onto the hero's own (blocked) tile — no
    // intermediate waypoint exists, so `walkAlongRoute` correctly refuses to
    // move at all and the enemy holds at (0,0) for the ATTACK itself. Before
    // D-142, that read as Manhattan distance 2 (out of a range-1 attack)
    // even though it's genuinely adjacent by the diagonal-aware distance
    // movement already used — this is the exact interim gap KI-093
    // documented.
    const testDefId = "test-only-aggressive-100";
    ENEMY_DEFINITIONS[testDefId] = { ...getEnemyDefinition("grunt"), id: testDefId, aggressiveness: 100 };
    try {
      const ws = makeWs(["S....X", "......"], testDefId);
      const hero = heroAt("hero-1", { x: 1, y: 1 });
      const t1 = ws.tickEnemyPhase({
        heroTargets: [hero],
        isBlocked: (p) => p.x === hero.position.x && p.y === hero.position.y,
      });
      expect(t1.attacks).toHaveLength(1); // correctly in range diagonally
      // Enemy AI/Movement Redesign step 5 (D-143): the pre-attack walk spent
      // nothing (there was no waypoint to take), so the enemy's whole
      // movement budget is still available afterward — since only the
      // hero's own single tile is blocked (not a real dead end), it detours
      // around with that leftover budget instead of holding at (0,0).
      expect(t1.moves).toHaveLength(1);
      expect(ws.enemies[0].position).not.toEqual({ x: 0, y: 0 });
    } finally {
      delete ENEMY_DEFINITIONS[testDefId];
    }
  });
});

describe("Enemy AI/Movement Redesign step 5 (D-143): move-attack-move + Sprint", () => {
  it("spends leftover movement budget continuing toward the exit after a landed attack, instead of holding in place", () => {
    const testDefId = "test-only-forced-8-tile-mover";
    ENEMY_DEFINITIONS[testDefId] = {
      ...getEnemyDefinition("grunt"),
      id: testDefId,
      movementTiles: 4, // pre-attack walk spends 1 of these; 3 remain afterward
      aggressiveness: 100, // never worth a detour — forces the direct approach
    };
    try {
      // A long, mostly-open 2-row map: plenty of room for the post-attack
      // leftover budget to make real progress without ever reaching the
      // exit this same phase (which would breach and remove the enemy,
      // muddying this test's real point).
      const ws = makeWs(["S......X", "........"], testDefId);
      const hero = heroAt("hero-1", { x: 1, y: 0 }); // one tile ahead of the spawn
      const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 1 && p.y === 0 });
      expect(t1.attacks).toHaveLength(1); // the pre-attack walk closed to melee range
      expect(t1.moves).toHaveLength(1); // both movement legs are reported as one move event
      expect(ws.enemies).toHaveLength(1); // didn't reach the exit this phase
      const pos = ws.enemies[0].position;
      expect(pos).not.toEqual({ x: 0, y: 0 }); // moved at all (the pre-attack leg)
      expect(pos).not.toEqual({ x: 1, y: 0 }); // never enters the hero's own tile
      // The real point of this test: the enemy is somewhere PAST where the
      // pre-attack walk alone would have stopped it (adjacent to the hero,
      // at distance 1 from the spawn) — proving the leftover budget after
      // the attack was actually spent, not wasted.
      const preAttackOnlyDistance = 1;
      const actualDistance = Math.abs(pos.x) + Math.abs(pos.y);
      expect(actualDistance).toBeGreaterThan(preAttackOnlyDistance);
    } finally {
      delete ENEMY_DEFINITIONS[testDefId];
    }
  });

  it("Sprint doubles this phase's movement budget when the enemy isn't fighting", () => {
    const sprintDefId = "test-only-sprinter";
    // D-172: matches the real Grunt's current 4-tile speed (not the old 2),
    // so the plain-vs-sprint comparison below is still an apples-to-apples
    // "same base speed, one of them doubled" check.
    ENEMY_DEFINITIONS[sprintDefId] = { ...getEnemyDefinition("grunt"), id: sprintDefId, movementTiles: 4, sprints: true };
    try {
      // A single-row map keeps every step cardinal (5ft each) — no diagonal
      // rounding to account for, so the exact tile reached is a plain
      // budget/5ft calculation either way. Long enough that the sprinting
      // enemy's doubled 8-tile budget doesn't reach the exit (which would
      // breach and remove it before the position assertion below).
      const sprintWs = makeWs(["S..........X"], sprintDefId);
      const plainWs = makeWs(["S..........X"], "grunt");
      const t1 = sprintWs.tickEnemyPhase({});
      const t2 = plainWs.tickEnemyPhase({});
      expect(t1.moves).toHaveLength(1);
      expect(t2.moves).toHaveLength(1);
      expect(plainWs.enemies[0].position).toEqual({ x: 4, y: 0 }); // plain movementTiles: 4
      expect(sprintWs.enemies[0].position).toEqual({ x: 8, y: 0 }); // doubled: 8
    } finally {
      delete ENEMY_DEFINITIONS[sprintDefId];
    }
  });

  it("Sprint never applies on a phase the enemy attacks (the SRD Dash trade — the whole action goes to one or the other)", () => {
    const testDefId = "test-only-sprinting-attacker";
    ENEMY_DEFINITIONS[testDefId] = {
      ...getEnemyDefinition("grunt"),
      id: testDefId,
      movementTiles: 2,
      sprints: true,
    };
    try {
      const ws = makeWs(["S..X"], testDefId); // 1-wide: no detour possible at all
      const hero = heroAt("hero-1", { x: 1, y: 0 }); // directly ahead, adjacent
      const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === 1 && p.y === 0 });
      expect(t1.attacks).toHaveLength(1);
      expect(t1.moves).toHaveLength(0); // held — a genuine dead end, sprint or not
      expect(ws.enemies[0].position).toEqual({ x: 0, y: 0 });
    } finally {
      delete ENEMY_DEFINITIONS[testDefId];
    }
  });
});

describe("Enemy.aggressiveness default bucketing (D-140)", () => {
  const base = getEnemyDefinition("grunt");
  const withOverride = (overrides: Partial<typeof base>) => new Enemy("e#1", { ...base, ...overrides }, { x: 0, y: 0 });

  it("defaults an ordinary minion to a middling value", () => {
    expect(withOverride({}).aggressiveness).toBe(55);
  });

  it("defaults a boss/legendary low, so it races the clock", () => {
    expect(withOverride({ role: "boss" }).aggressiveness).toBe(15);
    expect(withOverride({ role: "legendary" }).aggressiveness).toBe(15);
  });

  it("defaults a miniboss between minion and boss", () => {
    expect(withOverride({ role: "miniboss" }).aggressiveness).toBe(40);
  });

  it("defaults objective-focused archetypes (siege/trapSense/pure runner) low", () => {
    expect(withOverride({ siegeDamageMultiplier: 3 }).aggressiveness).toBe(10);
    expect(withOverride({ trapSense: { rangeTiles: 2 } }).aggressiveness).toBe(10);
    expect(withOverride({ ignoresHeroes: true }).aggressiveness).toBe(0);
  });

  it("defaults hunter-flavored archetypes (enrage/lifedrink/stealth) high", () => {
    expect(withOverride({ enrage: { stepPercent: 25 } }).aggressiveness).toBe(85);
    expect(withOverride({ lifedrinkPercent: 50 }).aggressiveness).toBe(85);
    expect(withOverride({ stealth: true }).aggressiveness).toBe(85);
  });

  it("an explicit def.aggressiveness override always wins over any default", () => {
    expect(withOverride({ role: "boss", aggressiveness: 72 }).aggressiveness).toBe(72);
  });
});

describe("Enemy.siegeTargeting default (D-145)", () => {
  it("defaults to reassessing when absent", () => {
    const e = new Enemy("e#1", getEnemyDefinition("siegebreaker"), { x: 0, y: 0 });
    expect(e.siegeTargeting).toBe("reassessing");
  });

  it("an explicit def.siegeTargeting override wins", () => {
    const def = { ...getEnemyDefinition("siegebreaker"), siegeTargeting: "committed" as const };
    const e = new Enemy("e#1", def, { x: 0, y: 0 });
    expect(e.siegeTargeting).toBe("committed");
  });
});

// ----- §3 (D-145): siege wall-targeting ------------------------------------

/**
 * A 2-row corridor (row 0 the direct route, row 1 an always-open detour) plus
 * a BuildSystem so a test can place real destructible walls and wire the
 * `wallHpAt`/`damageWall`/`allWalls` context siege targeting needs — the same
 * context shape `BattleScene` wires in production (see `WaveSystem.ts`'s
 * `EnemyPhaseContext.allWalls` doc comment).
 */
function setupSiege(rows: string[], enemyId = "siegebreaker") {
  const map = new GameMap(parseMapRows("m", "m", rows));
  const pf = new PathfindingSystem(map);
  const build = new BuildSystem(map, pf);
  const ws = new WaveSystem(map, pf, [oneEnemyWave(enemyId)], { startingIntegrity: 20, random: RandomService.fixed() });
  ws.startWave(0);
  return { map, pf, build, ws };
}

function siegeContext(build: BuildSystem) {
  return {
    isBlocked: (p: GridPosition) => build.isWallAt(p),
    isWall: (p: GridPosition) => build.isWallAt(p),
    wallHpAt: (p: GridPosition) => {
      const s = build.wallAt(p);
      return s && s.hp !== undefined ? { instanceId: s.instanceId, defId: s.defId } : null;
    },
    damageWall: (id: string, dmg: number) => build.damageStructure(id, dmg).destroyed,
    allWalls: () =>
      build.structures
        .filter((s) => s.kind === "wall" && s.hp !== undefined)
        .map((s) => ({ instanceId: s.instanceId, defId: s.defId, position: { ...s.position } })),
  };
}

describe("§3 (D-145): siege wall-targeting — seeking a wall not yet in range", () => {
  it("(reassessing, the default) walks toward a wall outside its own attack range, attacking once close enough, then resumes ordinary siege behavior once it's destroyed", () => {
    const { build, ws } = setupSiege(["S....X", "......"]);
    const wallA = build.place("barricade", { x: 2, y: 0 }).structure!;
    const ctx = siegeContext(build);

    // Phase 1: not yet in range (dist 2 > attackRangeTiles 1) — walks 1 tile
    // toward it (as far as its 2-tile budget gets before the wall itself
    // blocks the next step) and, now adjacent, attacks the same phase.
    const t1 = ws.tickEnemyPhase(ctx);
    expect(t1.moves).toHaveLength(1);
    expect(ws.enemies[0].position).toEqual({ x: 1, y: 0 });
    expect(t1.structureAttacks).toHaveLength(1);
    expect(t1.structureAttacks[0].structureInstanceId).toBe(wallA.instanceId);
    expect(t1.structureAttacks[0].damage).toBe(9); // 3 attackDamage * 3 siegeDamageMultiplier
    expect(t1.structureAttacks[0].destroyed).toBe(false); // barricade hp 10 - 9 = 1

    // Phase 2: already adjacent — the pre-existing immediate-range priority
    // (unchanged by this decision) finishes it off.
    const t2 = ws.tickEnemyPhase(ctx);
    expect(t2.structureAttacks[0].destroyed).toBe(true);
    expect(t2.moves).toHaveLength(0);

    // Phase 3: wall gone — resumes ordinary advance, same as before D-145.
    const t3 = ws.tickEnemyPhase(ctx);
    expect(t3.structureAttacks).toHaveLength(0);
    expect(t3.moves).toHaveLength(1);
  });

  it("prefers a wall that actually shortens its route over a decoy that changes nothing", () => {
    // A third row gives the decoy somewhere to sit that's within reach of the
    // spawn (so bestWallTarget genuinely considers and rejects it) but off
    // both the direct row and the row-1 detour around wallA, so removing it
    // can never shorten anything.
    const { build, ws } = setupSiege(["S....X", "......", "......"]);
    const wallA = build.place("barricade", { x: 2, y: 0 }).structure!; // blocks the direct row — genuinely helps
    build.place("barricade", { x: 0, y: 2 }); // off on its own row — removing it changes nothing
    const ctx = siegeContext(build);

    const t1 = ws.tickEnemyPhase(ctx);
    expect(ws.enemies[0].position).toEqual({ x: 1, y: 0 }); // walked toward wallA, not the decoy
    expect(t1.structureAttacks).toHaveLength(1);
    expect(t1.structureAttacks[0].structureInstanceId).toBe(wallA.instanceId);
  });

  it("is bounded to the enemy's current movement speed — a wall far outside reach doesn't distract it from its ordinary advance", () => {
    const { build, ws } = setupSiege(["S......X", "........"]);
    build.place("barricade", { x: 6, y: 0 }); // Manhattan distance 6, just past reach (movement 4 + range 1 = 5, D-172)
    const ctx = siegeContext(build);

    const t1 = ws.tickEnemyPhase(ctx);
    expect(t1.structureAttacks).toHaveLength(0);
    expect(t1.moves).toHaveLength(1);
    expect(ws.enemies[0].position).toEqual({ x: 4, y: 0 }); // its plain 4-tile advance, untouched
  });

  it("(committed) re-picks a fresh target once its original committed wall is destroyed, rather than getting stuck on a dead reference", () => {
    const testDefId = "test-only-committed-siege";
    ENEMY_DEFINITIONS[testDefId] = { ...getEnemyDefinition("siegebreaker"), id: testDefId, siegeTargeting: "committed" };
    try {
      const { build, ws } = setupSiege(["S....X", "......"], testDefId);
      const wallA = build.place("barricade", { x: 2, y: 0 }).structure!;
      const ctx = siegeContext(build);

      const t1 = ws.tickEnemyPhase(ctx); // commits to wallA, walks adjacent, attacks
      expect(t1.structureAttacks[0].structureInstanceId).toBe(wallA.instanceId);
      const t2 = ws.tickEnemyPhase(ctx); // finishes wallA off
      expect(t2.structureAttacks[0].destroyed).toBe(true);

      // wallA's stored commitment now points at a wall that no longer
      // exists — a fresh wallB appears, and the committed enemy must not
      // stay silently stuck on the dead reference.
      const wallB = build.place("barricade", { x: 3, y: 0 }).structure!;
      const t3 = ws.tickEnemyPhase(ctx);
      expect(t3.structureAttacks).toHaveLength(1);
      expect(t3.structureAttacks[0].structureInstanceId).toBe(wallB.instanceId);
    } finally {
      delete ENEMY_DEFINITIONS[testDefId];
    }
  });
});

// ----- §3 (D-146): smart AoE/breath positioning ----------------------------

describe("§3 (D-146): smart AoE/breath positioning for high-tier enemies", () => {
  it("a high-tier AoE attacker (legendary, aoeAttack) repositions to line up multiple heroes instead of just walking toward the exit", () => {
    const testDefId = "test-only-smart-aoe";
    // Based on Ashen Sovereign (legendary, aoeAttack, attackRangeTiles 2) —
    // movementTiles trimmed to 1 so the positioning tile costs its ENTIRE
    // budget, leaving nothing for D-143's post-attack leftover-movement
    // step to complicate the final-position assertion below.
    ENEMY_DEFINITIONS[testDefId] = { ...getEnemyDefinition("ashen-sovereign"), id: testDefId, movementTiles: 1 };
    try {
      const ws = makeWs(["S......X", "........", "........", "........"], testDefId);
      const heroA = heroAt("hero-a", { x: 3, y: 1 });
      const heroB = heroAt("hero-b", { x: 1, y: 3 });
      const heroTargets = [heroA, heroB];
      // Neither hero is in this enemy's range-2 reach from the spawn (0,0);
      // (1,1) — one diagonal tile away, affordable within a 1-tile budget —
      // is the unique cheapest tile that gets BOTH heroes within range 2 at
      // once, so a smart positioner should walk there instead of its
      // ordinary toward-the-exit advance (which would land at (1,0) and
      // catch neither).
      const t1 = ws.tickEnemyPhase({
        heroTargets,
        isBlocked: (p) => heroTargets.some((h) => h.position.x === p.x && h.position.y === p.y),
      });
      expect(ws.enemies[0].position).toEqual({ x: 1, y: 1 });
      expect(t1.attacks).toHaveLength(2);
      expect(t1.attacks.map((a) => a.target.id).sort()).toEqual(["hero-a", "hero-b"]);
    } finally {
      delete ENEMY_DEFINITIONS[testDefId];
    }
  });

  it("a minion-tier AoE attacker (Cave Drake) keeps the simple 'walk toward the exit, attack whoever ends up in range' behavior, even though repositioning would hit more heroes", () => {
    const ws = makeWs(["S......X", "........", "........", "........"], "cave-drake");
    const heroA = heroAt("hero-a", { x: 3, y: 1 });
    const heroB = heroAt("hero-b", { x: 1, y: 3 });
    const heroTargets = [heroA, heroB];
    const t1 = ws.tickEnemyPhase({
      heroTargets,
      isBlocked: (p) => heroTargets.some((h) => h.position.x === p.x && h.position.y === p.y),
    });
    // Cave Drake's own 4-tile movement (D-172), walked straight down the
    // open row toward the exit — never diverting toward (1,1) the way a
    // qualifying high-tier attacker would. Neither hero blocks that direct
    // route at all (§1/D-139: no detour needed means nothing forces a
    // fight), so — unlike the qualifying legendary above, which
    // proactively seeks a fight — it doesn't even attack this phase,
    // despite ending up within range 1 of heroA. This is the starkest
    // possible contrast with the legendary case above (0 attacks here vs.
    // 2 there).
    expect(ws.enemies[0].position).toEqual({ x: 4, y: 0 });
    expect(t1.attacks).toHaveLength(0);
  });

  it("a high-tier AoE attacker with nothing to gain (only one hero on the board at all) falls through to its ordinary behavior unchanged", () => {
    const testDefId = "test-only-smart-aoe-no-benefit";
    ENEMY_DEFINITIONS[testDefId] = { ...getEnemyDefinition("ashen-sovereign"), id: testDefId };
    try {
      const ws = makeWs(["S......X", "........"], testDefId);
      const hero = heroAt("hero-a", { x: 5, y: 0 }); // far down the direct route, not blocking anything
      const t1 = ws.tickEnemyPhase({ heroTargets: [hero], isBlocked: (p) => p.x === hero.position.x && p.y === hero.position.y });
      // No tile could ever hit more than this one hero, so
      // `bestPositioningTile` finds nothing worth deviating for — the
      // enemy just takes its plain, ordinary `advanceEnemy` route toward
      // the exit. That route still has to detour around the hero's own
      // blocked tile at (5,0) (same as any enemy would for any blocker),
      // which the OLD 2-tile budget (D-172: now 4) never reached far enough
      // to reveal — the affordable prefix stopped at a tile the detour and
      // the straight line still agreed on. At 4 tiles it's far enough
      // along that the route has already stepped off row 0 to go around
      // (5,0), landing one row down rather than at the naively-expected
      // straight-line (4,0).
      expect(ws.enemies[0].position).toEqual({ x: 4, y: 1 });
      expect(t1.attacks).toHaveLength(0); // not close enough yet to attack either way
    } finally {
      delete ENEMY_DEFINITIONS[testDefId];
    }
  });
});

// ----- Self-defense (D-146): a provoked enemy retaliates ------------------

describe("Self-defense (D-146): a provoked enemy retaliates instead of continuing its priority action", () => {
  it("a siege enemy ignores a hero in range while unprovoked, retaliates against it for exactly one phase once provoked, then resumes bashing the wall", () => {
    const { build, ws } = setupSiege(["S....X", "......"]);
    build.place("barricade", { x: 1, y: 0 }).structure!; // already in the siege enemy's attack range at spawn
    const hero = heroAt("hero-1", { x: 0, y: 1 }); // also in range (1) of the spawn, orthogonally
    const ctx = {
      ...siegeContext(build),
      heroTargets: [hero],
      // Real BattleScene wiring always includes hero tiles in `isBlocked`
      // (see `EnemyPhaseContext.isBlocked`'s own doc comment) — folded in
      // here too so the D-143 post-attack leftover-movement step can't walk
      // the enemy onto/through the hero's own tile.
      isBlocked: (p: GridPosition) => build.isWallAt(p) || (p.x === hero.position.x && p.y === hero.position.y),
    };

    // Phase 1: unprovoked — siege priority wins, the hero standing right
    // next to it is completely ignored.
    const t1 = ws.tickEnemyPhase(ctx);
    expect(t1.structureAttacks).toHaveLength(1);
    expect(t1.attacks).toHaveLength(0);

    // Simulate a hero's landed hit during the player phase in between.
    ws.enemies[0].markProvoked();

    // Phase 2: provoked AND the hero is still in range — retaliates instead
    // of bashing the wall this phase, even though the wall is STILL in
    // range too.
    const t2 = ws.tickEnemyPhase(ctx);
    expect(t2.attacks).toHaveLength(1);
    expect(t2.attacks[0].target.id).toBe("hero-1");
    expect(t2.structureAttacks).toHaveLength(0);

    // Phase 3: the provoked flag was consumed last phase — back to
    // ordinary siege priority, hero ignored again.
    const t3 = ws.tickEnemyPhase(ctx);
    expect(t3.structureAttacks).toHaveLength(1);
    expect(t3.attacks).toHaveLength(0);
  });

  it("does nothing if provoked but no hero is currently in range — the ordinary siege priority is untouched", () => {
    const { build, ws } = setupSiege(["S....X", "......"]);
    build.place("barricade", { x: 1, y: 0 }).structure!;
    const hero = heroAt("hero-1", { x: 5, y: 1 }); // far away, not in range
    const ctx = { ...siegeContext(build), heroTargets: [hero] };

    ws.tickEnemyPhase(ctx); // phase 1: spawns and bashes the wall, unprovoked
    ws.enemies[0].markProvoked();
    const t1 = ws.tickEnemyPhase(ctx);
    expect(t1.structureAttacks).toHaveLength(1); // still bashes the wall — nothing to retaliate against
    expect(t1.attacks).toHaveLength(0);
  });

  it("an ignoresHeroes pure runner is exempt — it never retaliates even when provoked with a hero in range", () => {
    const ws = makeWs(["S...........X", "............."], "sprinter");
    ws.tickEnemyPhase({}); // phase 1: spawns and advances its full 5-tile budget, unprovoked
    const pos = ws.enemies[0].position;
    const hero = heroAt("hero-1", { x: pos.x, y: pos.y + 1 }); // orthogonally adjacent to wherever it ended up
    ws.enemies[0].markProvoked();
    const t1 = ws.tickEnemyPhase({
      heroTargets: [hero],
      isBlocked: (p) => p.x === hero.position.x && p.y === hero.position.y,
    });
    expect(t1.attacks).toHaveLength(0); // ignores the hero, provoked or not
    expect(t1.moves).toHaveLength(1); // just advances, per its usual personality
  });

  it("Enemy.markProvoked/isProvoked/clearProvoked behave as a simple one-shot flag", () => {
    const e = new Enemy("e#1", getEnemyDefinition("grunt"), { x: 0, y: 0 });
    expect(e.isProvoked).toBe(false);
    e.markProvoked();
    expect(e.isProvoked).toBe(true);
    e.clearProvoked();
    expect(e.isProvoked).toBe(false);
  });
});
