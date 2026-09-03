/**
 * Wave definitions — data, not code.
 *
 * Shape is based on the Source of Truth WaveDefinition. A wave is a set of spawn
 * groups; each group releases `count` enemies of one type, beginning on
 * `startTurn` (counted in enemy phases within the wave) and then every
 * `intervalTurns` after that, from spawn point `spawnIndex` (default 0).
 *
 * Phase 5 SPENDS the economy fields: `completionGold` is granted when a wave is
 * cleared, and `timeBonusGold` is granted as well when the wave is cleared on or
 * before its `turnLimit` (counted in enemy phases within the wave). A wave
 * without a `turnLimit` simply never grants the bonus.
 *
 * Phase 7 (D-051): the campaign grows from five waves to the phase's TEN waves
 * plus a miniboss finale. Waves 1–5 are UNCHANGED from the v0.1.1 MVP (they were
 * play-shaped already and are the historical MVP loop); waves 6–10 are new and
 * introduce the expanded roster progressively, ending on the Basalt Colossus.
 *
 * NOTE (balance): every `turnLimit`, `completionGold`, and `timeBonusGold` value
 * here — and the new waves' composition — is a FIRST-PASS guess made WITHOUT
 * in-browser play (there is no browser in this environment). The numbers are
 * tuned only so the headless campaign simulation proves the loop remains
 * winnable-with-skill and losable-if-idle (see tests/mvp-integration.test.ts);
 * that simulation is an UPPER BOUND on player skill and cannot set the true
 * difficulty. Real feel — how many of each enemy belongs where, and whether the
 * economy keeps pace — is Kevin's in-browser tuning call (KNOWN_ISSUES KI-015).
 */

export interface WaveSpawnGroup {
  enemyId: string;
  count: number;
  /** First enemy phase (1-based) of the wave on which this group spawns. */
  startTurn: number;
  /** Enemy phases between successive spawns in this group. */
  intervalTurns: number;
  /** Which spawn point to use (index into the map's spawn list). Default 0. */
  spawnIndex?: number;
  /**
   * D-217 (item 3b/3.5): optional per-group stat bump, consumed by
   * `WaveSystem.spawnDueEnemies` on top of the difficulty tier's own
   * `enemyHpMultiplier` — absent means today's exact behavior. Introduced by
   * `ThreatBudgetSystem`'s elite-substitution step (a group split into a
   * regular sub-group and an elite sub-group of the same `enemyId`) and
   * reused by `bossScaling.ts`'s level-cap boss scaling, so `WaveSystem`
   * gains exactly one new concept for both features rather than two.
   * `attackBonusAdd` is additive (a small flat to-hit bonus, unlike the
   * multiplicative `hp`/`damage`) — only `bossScaling.ts` sets it, since a
   * higher-level party's AC climbs enough that a static boss to-hit bonus
   * would fall increasingly behind without it; elite substitution never
   * touches it.
   */
  statMultiplier?: { hp: number; damage: number; attackBonusAdd?: number };
}

export interface WaveDefinition {
  id: string;
  turnLimit?: number;
  spawns: WaveSpawnGroup[];
  completionGold: number;
  timeBonusGold?: number;
}

export const WAVES: WaveDefinition[] = [
  // ----- Waves 1–5: the v0.1.1 MVP loop, unchanged -----------------------
  {
    id: "wave-1",
    turnLimit: 8,
    spawns: [{ enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 }],
    completionGold: 10,
    timeBonusGold: 5,
  },
  {
    id: "wave-2",
    turnLimit: 9,
    spawns: [{ enemyId: "grunt", count: 4, startTurn: 1, intervalTurns: 1 }],
    completionGold: 12,
    timeBonusGold: 5,
  },
  {
    id: "wave-3",
    turnLimit: 10,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "runner", count: 2, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 15,
    timeBonusGold: 6,
  },
  {
    id: "wave-4",
    turnLimit: 9,
    spawns: [{ enemyId: "runner", count: 5, startTurn: 1, intervalTurns: 1 }],
    completionGold: 18,
    timeBonusGold: 6,
  },
  {
    id: "wave-5",
    turnLimit: 11,
    spawns: [
      { enemyId: "grunt", count: 4, startTurn: 1, intervalTurns: 1 },
      { enemyId: "runner", count: 3, startTurn: 2, intervalTurns: 1 },
      // The campaign's first FLYER (D-048/D-049): it ignores barricades and
      // flies straight for the exit, so it must be shot down or caught by a Sky
      // Snare. Count is intentionally small.
      { enemyId: "wisp", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 25,
    timeBonusGold: 10,
  },

  // ----- Waves 6–10: Phase 7 expansion (D-051) ---------------------------

  // Wave 6 — the BRUTE debuts. A slow armoured wall behind a screen of grunts:
  // the player meets the "big single threat" that focus fire / walls answer.
  {
    id: "wave-6",
    turnLimit: 12,
    spawns: [
      { enemyId: "grunt", count: 3, startTurn: 1, intervalTurns: 1 },
      { enemyId: "brute", count: 1, startTurn: 2, intervalTurns: 1 },
    ],
    completionGold: 28,
    timeBonusGold: 10,
  },

  // Wave 7 — the SWARM. A wall of fragile swarmlings that single-target fire
  // cannot clear alone; this is the wave that sells area damage and a trapped
  // lane. A couple of runners keep pressure on.
  {
    id: "wave-7",
    turnLimit: 12,
    spawns: [
      { enemyId: "swarmling", count: 6, startTurn: 1, intervalTurns: 1 },
      { enemyId: "runner", count: 2, startTurn: 2, intervalTurns: 2 },
    ],
    completionGold: 30,
    timeBonusGold: 10,
  },

  // Wave 8 — AIR PRESSURE. Two razorwings plus a wisp ignore any walls the
  // player has built; grunts pressure the ground. Anti-air (Sky Snare) plus
  // ranged fire is the lesson here.
  {
    id: "wave-8",
    turnLimit: 13,
    spawns: [
      { enemyId: "grunt", count: 2, startTurn: 1, intervalTurns: 1 },
      { enemyId: "razorwing", count: 2, startTurn: 2, intervalTurns: 2 },
      { enemyId: "wisp", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 34,
    timeBonusGold: 12,
  },

  // Wave 9 — ARMOUR. Wardens shrug off ordinary hits (Wren's pierce is the
  // answer), escorted by runners and one razorwing to keep the air honest.
  {
    id: "wave-9",
    turnLimit: 13,
    spawns: [
      { enemyId: "warden", count: 2, startTurn: 1, intervalTurns: 2 },
      { enemyId: "runner", count: 3, startTurn: 2, intervalTurns: 1 },
      { enemyId: "razorwing", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 38,
    timeBonusGold: 12,
  },

  // Wave 10 — the MINIBOSS FINALE. The Basalt Colossus arrives behind an escort
  // of a brute, a swarm, and a wisp: clear the escort, then focus the boss down
  // before it breaches. Pays a large purse on completion.
  {
    id: "wave-10",
    turnLimit: 16,
    spawns: [
      { enemyId: "swarmling", count: 4, startTurn: 1, intervalTurns: 1 },
      { enemyId: "brute", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "wisp", count: 1, startTurn: 2, intervalTurns: 1 },
      { enemyId: "basalt-colossus", count: 1, startTurn: 3, intervalTurns: 1 },
    ],
    completionGold: 60,
    timeBonusGold: 20,
  },
];
