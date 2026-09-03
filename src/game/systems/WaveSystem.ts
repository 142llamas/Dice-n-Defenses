import type { GridPosition } from "./GridSystem";
import { GameMap } from "./GameMap";
import { PathfindingSystem } from "./PathfindingSystem";
import { TILE_FEET, type RoutedPosition, roundToTileUnit } from "./DiagonalMovement";
import {
  CombatSystem,
  type Combatant,
  type AttackResult,
  type AttackProfile,
} from "./CombatSystem";
import { RandomService, type AdvantageMode } from "./RandomService";
import { SavingThrowSystem } from "./SavingThrowSystem";
import { InitiativeSystem } from "./InitiativeSystem";
import { Enemy, type EnemySnapshot } from "../entities/Enemy";
import { getEnemyDefinition, type EnemyDefinition } from "../data/enemies";
import type { TrapTarget } from "../data/structures";
import type { WaveDefinition } from "../data/waves";
import { getStatusEffectDefinition, type StatusEffectId } from "../data/statusEffects";

/**
 * WaveSystem: the enemy-side rules for Phase 3. Pure, no Phaser.
 *
 * It owns the enemy lifecycle: scheduling spawns from the map's spawn point(s),
 * advancing each enemy toward the nearest exit each enemy phase, applying breach
 * damage to Stronghold Integrity exactly once when an enemy reaches an exit, and
 * detecting when a wave is complete. The scene calls tickEnemyPhase() once per
 * enemy phase and renders the returned report; all the decisions live here so
 * they can be unit-tested without a browser.
 *
 * Terms (Source of Truth, LOCKED): Stronghold Integrity is the shared loss
 * resource; Breach Damage is what an escaping enemy removes from it.
 */

export interface EnemyMove {
  enemy: Enemy;
  from: GridPosition;
  /** Tiles walked this phase (excludes `from`, ends at the enemy's new tile). */
  path: GridPosition[];
  to: GridPosition;
}

export interface BreachEvent {
  enemy: Enemy;
  damage: number;
}

/** One enemy striking one hero during the enemy phase. */
export interface EnemyAttackEvent {
  enemy: Enemy;
  target: Combatant;
  result: AttackResult;
}

/** A trap damaging one enemy that entered its tile during the enemy phase. */
export interface TrapTrigger {
  enemy: Enemy;
  /** The trap tile the enemy stepped onto. */
  position: GridPosition;
  result: AttackResult;
}

/**
 * Phase 20 (D-111): a siege enemy striking a destructible wall structure
 * instead of a hero this phase.
 */
export interface StructureAttackEvent {
  enemy: Enemy;
  structureInstanceId: string;
  structureDefId: string;
  damage: number;
  destroyed: boolean;
  /**
   * Phase 25 (D-116): true when an ORDINARY (non-siege) melee enemy bashed
   * this wall out of opportunity — no hero was reachable this phase — rather
   * than a dedicated siege enemy's unconditional priority attack. Absent/
   * false for every siege attack, unchanged from before this field existed.
   */
  opportunistic?: boolean;
}

/**
 * Phase 20 (D-111): a reinforcement-calling enemy spawning more enemies
 * adjacent to itself this phase. Deliberately separate from the hero-ally
 * `SummonSystem`/`Summon` (Phase 16) — this is enemies calling in more
 * enemies, not a hero casting an ally.
 */
export interface ReinforcementEvent {
  source: Enemy;
  spawned: Enemy[];
}

/** Phase 21 (D-112), Lifedrinker: a self-heal from a landed hit against a hero this phase. */
export interface LifedrinkEvent {
  enemy: Enemy;
  healed: number;
}

/** Phase 21 (D-112), Teleporter: a jump straight toward the nearest exit this phase. */
export interface TeleportEvent {
  enemy: Enemy;
  from: GridPosition;
  to: GridPosition;
}

/** Phase 21 (D-112), Mimic: a disguised enemy breaking cover because a hero moved adjacent to it this phase. */
export interface MimicRevealEvent {
  enemy: Enemy;
}

/** Phase 21 (D-112), Multi-Phase Boss: an enemy crossing its HP threshold and entering its next mechanic set this phase. */
export interface PhaseChangeEvent {
  enemy: Enemy;
}

/** Phase 21 (D-112), Healer: one enemy healing one wounded ally this phase (the `auraBuff` shape, healing instead of buffing a stat). */
export interface HealAuraEvent {
  healer: Enemy;
  ally: Enemy;
  healed: number;
}

/** Phase 25 (D-116), Saboteur: a `trapSense` enemy disarming/destroying a placed trap this phase, instead of attacking a hero or advancing. */
export interface TrapDisarmEvent {
  enemy: Enemy;
  structureInstanceId: string;
  structureDefId: string;
}

/** Phase 21 (D-112), Splitter/Carrier: spawns produced by a defeated enemy's `onDeathSpawns`. */
export interface DeathSpawnEvent {
  source: Enemy;
  spawned: Enemy[];
}

/** Phase 21 (D-112), Explosive: an AoE burst produced by a defeated enemy's `onDeathExplode`. */
export interface ExplosionEvent {
  source: Enemy;
  hits: { target: Combatant; result: AttackResult }[];
}

/**
 * Phase 21 (D-112): the result of resolving every defeated enemy's
 * `onDeathSpawns`/`onDeathExplode`, once per removal. Deliberately a
 * SEPARATE call from `tickEnemyPhase` — a death trigger can fire from a
 * hero's own attack (resolved in `BattleScene`, not here), so the caller
 * invokes this right where it already calls `removeDefeated()`, regardless
 * of which phase (player or enemy) the kill happened in.
 */
export interface DeathTriggerReport {
  spawned: Enemy[];
  deathSpawns: DeathSpawnEvent[];
  explosions: ExplosionEvent[];
}

/**
 * One status effect resolving on one enemy during the enemy phase (Phase 7):
 * "burning" reports the damage-over-time hit; "stunned" reports that the
 * enemy held with no action or movement. "slowed" needs no event of its own —
 * it is silently reflected in how far the enemy actually moved.
 */
export interface StatusTickEvent {
  enemy: Enemy;
  effectId: StatusEffectId;
  /** Present only for "burning" (the damage-over-time hit). */
  result?: AttackResult;
}

/**
 * Optional per-phase context supplied by the scene. When omitted, the enemy
 * phase behaves exactly as in Phase 3: enemies simply march to the exit and
 * breach (no heroes to fight, nothing blocking but walls). This keeps all
 * existing tests and the "do nothing" integration path unchanged.
 */
export interface EnemyPhaseContext {
  /** Living hero combatants that enemies may attack. Absent = no targets. */
  heroTargets?: ReadonlyArray<Combatant>;
  /**
   * Extra impassable tiles for enemy routing (e.g. living heroes and placed
   * walls), on top of the map's own walls. Absent = only map walls block.
   * Enemies ALSO always block each other automatically (no two living enemies
   * ever share a tile) — that part needs no context from the caller.
   */
  isBlocked?: (pos: GridPosition) => boolean;
  /**
   * Which of the `isBlocked` tiles are PLACED WALLS (barricades), if the caller
   * can tell them apart. Flying enemies (Phase 7, D-048) ignore walls — both
   * static map walls and these placed ones — so for a flyer a tile that is
   * blocked ONLY because it is a wall does not block it, while a tile blocked
   * for another reason (a hero standing there) still does. Ground enemies never
   * consult this. Absent = the caller can't distinguish walls, so flyers simply
   * ignore static map walls but still respect the whole `isBlocked` set.
   */
  isWall?: (pos: GridPosition) => boolean;
  /**
   * The trap on a tile, as an attack profile, or null if none. When present,
   * an enemy that ENTERS a trap tile this phase takes that damage (Phase 5).
   * Absent = no traps, so the enemy phase is exactly as in Phase 3/4.
   */
  trapAt?: (pos: GridPosition) => AttackProfile | null;
  /**
   * Which movement types the trap on a tile affects (D-049). Paired with
   * `trapAt`: a trap only damages an enemy whose movement type it targets, so a
   * Sky Snare hits flyers only and a Spike Trap hits ground only. Absent = every
   * trap hits "any" enemy, exactly as before this field existed (so all prior
   * tests, which pass only `trapAt`, are unchanged).
   */
  trapTargets?: (pos: GridPosition) => TrapTarget;
  /**
   * A status effect the trap on this tile applies (Phase 7), or null/absent
   * for a trap with no effect (e.g. plain damage traps). Applied only if the
   * enemy survives the trap's damage this phase. Absent = no trap applies a
   * status, so every prior trap (spike/sky-snare) behaves unchanged.
   */
  trapStatusAt?: (
    pos: GridPosition,
  ) => { statusId: StatusEffectId; durationTurns: number } | null;
  /**
   * Phase 20 (D-111): the destructible wall structure at a tile, if any —
   * feeds a siege enemy's own attack-range scan for something to break
   * through. Returns null for an empty tile OR a wall with no HP at all
   * (indestructible). Absent context = no siege enemy ever finds a wall,
   * so it just behaves like an ordinary melee minion — every pre-Phase-20
   * caller/test (which never passes this) is unaffected.
   */
  wallHpAt?: (pos: GridPosition) => { instanceId: string; defId: string } | null;
  /**
   * Phase 20 (D-111): apply siege damage to a wall structure by instance
   * id; returns true if the hit destroyed it. Paired with `wallHpAt` —
   * both must be present for any siege enemy to act on a wall this phase.
   */
  damageWall?: (instanceId: string, damage: number) => boolean;
  /**
   * Phase 25 (D-116), Saboteur: the placed trap structure at a tile, if any
   * — feeds a `trapSense` enemy's own sense-range scan for something to
   * disarm. Returns null for an empty tile or a tile with no PLACED trap
   * (e.g. a terrain hazard, which has no structure to disarm). Absent
   * context = no trapSense enemy ever finds a trap, so it just behaves like
   * an ordinary minion — every pre-Phase-25 caller/test (which never passes
   * this) is unaffected.
   */
  trapInstanceAt?: (pos: GridPosition) => { instanceId: string; defId: string } | null;
  /**
   * Phase 25 (D-116): disarm/destroy a trap structure by instance id;
   * returns true if it was found and removed. Paired with `trapInstanceAt`
   * — both must be present for any trapSense enemy to act on a trap this
   * phase. A trap has no HP (D-039: it always hits, in full), so this is a
   * one-shot removal, never a partial-damage step like `damageWall`.
   */
  disarmTrap?: (instanceId: string) => boolean;
  /**
   * Enemy AI/Movement Redesign §3 (D-145): every destructible wall structure
   * currently on the board — an ARRAY, unlike `wallHpAt`'s single-tile
   * lookup, since picking the best one to target means comparing several at
   * once (see `WaveSystem.bestWallTarget`). Absent = no siege enemy ever
   * seeks out a wall beyond one already within its own attack range, same as
   * every siege enemy before this decision.
   */
  allWalls?: () => ReadonlyArray<{ instanceId: string; defId: string; position: GridPosition }>;
}

export interface EnemyPhaseReport {
  /** Enemy-phase number within the current wave (1-based). */
  turn: number;
  spawned: Enemy[];
  moves: EnemyMove[];
  attacks: EnemyAttackEvent[];
  trapTriggers: TrapTrigger[];
  breaches: BreachEvent[];
  /** Status effects resolving this phase (Phase 7: burn ticks, stun holds). */
  statusEvents: StatusTickEvent[];
  /** Phase 20 (D-111): siege enemies attacking a wall instead of a hero this phase. */
  structureAttacks: StructureAttackEvent[];
  /** Phase 20 (D-111): reinforcement-calling enemies spawning more enemies this phase. */
  reinforcements: ReinforcementEvent[];
  /** Phase 21 (D-112): Lifedrinker self-heals resolving this phase. */
  lifedrinks: LifedrinkEvent[];
  /** Phase 21 (D-112): Teleporter jumps resolving this phase. */
  teleports: TeleportEvent[];
  /** Phase 21 (D-112): Mimics breaking cover this phase. */
  mimicReveals: MimicRevealEvent[];
  /** Phase 21 (D-112): Multi-Phase Bosses entering their next mechanic set this phase. */
  phaseChanges: PhaseChangeEvent[];
  /** Phase 21 (D-112): Healer heals landing on wounded allies this phase. */
  healEvents: HealAuraEvent[];
  /** Phase 25 (D-116): Saboteur/Warren Stalker disarming a placed trap this phase. */
  trapDisarms: TrapDisarmEvent[];
  integrityBefore: number;
  integrityAfter: number;
  waveComplete: boolean;
  defeated: boolean;
}

export interface WaveSystemOptions {
  startingIntegrity: number;
  /**
   * Phase 11.4 (D-077): scales each wave group's spawn count and every
   * spawned enemy's max HP — difficulty tier and party-size scaling
   * combined by the caller (see `data/difficulty.ts` and `BattleScene`'s
   * WaveSystem construction). Absent/1 reproduces every prior wave/balance
   * test byte-for-byte; a group always spawns at least 1 regardless of a
   * multiplier below 1/count.
   */
  enemyCountMultiplier?: number;
  enemyHpMultiplier?: number;
  /**
   * Phase 13.1 (D-086): the RandomService every enemy attack roll and trap
   * trigger draws on this phase. Required (not defaulted internally) so
   * every caller makes an explicit, visible choice — `RandomService.seeded()`
   * for real play, `RandomService.fixed()` for a test that doesn't care
   * about combat-roll randomness.
   */
  random: RandomService;
}

/**
 * Phase 12.1 (D-101): a plain-data copy of everything `WaveSystem` tracks
 * about the CURRENT run, for `BattleStateSnapshot`. Deliberately excludes
 * the map/pathfinding/wave-list/difficulty multipliers/`RandomService` — all
 * static per-battle CONFIG the caller already has and passes back into
 * `WaveSystem`'s own constructor when restoring, not per-run state (see
 * `PHASE_12_MULTIPLAYER_FEASIBILITY.md` §3 for why `RandomService`'s own
 * internal PRNG stream is never part of any snapshot).
 */
export interface WaveStateSnapshot {
  integrity: number;
  waveIndex: number;
  waveTurn: number;
  active: EnemySnapshot[];
  /** `spawnedCounts`, as [groupIndex, spawnedCount] pairs (a `Map` isn't itself serializable). */
  spawnedCounts: [number, number][];
  /** `pendingRetry`, as a plain array (a `Set` isn't itself serializable). */
  pendingRetry: number[];
  nextInstance: number;
}

/**
 * Phase 21 (D-112), Teleporter: how far a jump travels along its route
 * toward the nearest exit, ignoring the enemy's own (typically much
 * smaller) `movementTiles` for that one phase — flat and untuned, like
 * every other balance number in this project.
 */
const TELEPORT_JUMP_TILES = 6;

export class WaveSystem {
  private integrityValue: number;
  private waveIndex = 0;
  private waveTurn = 0;
  private active: Enemy[] = [];
  private spawnedCounts = new Map<number, number>(); // group index -> spawned
  private pendingRetry = new Set<number>(); // group indices whose spawn tile was blocked
  private nextInstance = 1;
  /**
   * KI-098 item 10 (D-175): per-group initiative — enemy type id
   * (`EnemyDefinition.id`) -> its rolled initiative for THIS wave, via the
   * previously-unused `InitiativeSystem`. Rolled once, the first time a
   * type appears this wave (bonus 0 — enemies have no ability-score-derived
   * modifier in this data model); cleared in `startWave`. Not part of
   * `WaveStateSnapshot` — same accepted gap as `reinforcementCooldowns`
   * below, a Coop resync just re-rolls it, which only reshuffles enemy
   * ACT ORDER, never anything that affects fairness/outcome.
   */
  private groupInitiativeRolls = new Map<string, number>();
  /**
   * Phase 20 (D-111): per-instance phases-remaining until a reinforcement-
   * calling enemy summons again. Deliberately NOT part of `WaveStateSnapshot`
   * (a restored battle just resets each caller's timer to its full interval
   * — a minor, documented imprecision, same "first pass" bar as everything
   * else in this snapshot) — same reasoning as `RandomService`'s own PRNG
   * stream being excluded (see `BattleStateSnapshot`'s comment).
   */
  private reinforcementCooldowns = new Map<string, number>();
  /**
   * Phase 21 (D-112): per-instance phases-remaining until a Teleporter jumps
   * again. Deliberately NOT part of `WaveStateSnapshot`, same documented
   * imprecision as `reinforcementCooldowns` above (a restored battle just
   * resets each Teleporter's timer to its full interval).
   */
  private teleportCooldowns = new Map<string, number>();
  /**
   * Enemy AI/Movement Redesign §3 (D-145): per-instance, which wall
   * structure a `siegeTargeting: "committed"` enemy has already picked to
   * walk toward — instance id -> wall instance id. Deliberately NOT part of
   * `WaveStateSnapshot`, same documented imprecision as
   * `reinforcementCooldowns`/`teleportCooldowns` above (a restored battle
   * just lets a committed enemy re-pick fresh). Never read for a
   * `"reassessing"` enemy, which always re-evaluates instead.
   */
  private siegeCommittedWalls = new Map<string, string>();
  /**
   * Test Mode (D-138): when true, `isDefeated()` always reports false
   * regardless of `integrityValue` — a debug toggle, not a balance change.
   * Integrity still visibly decreases on a breach; this only suppresses the
   * loss condition itself.
   */
  private noFail = false;

  private readonly spawns: GridPosition[];
  private readonly exits: GridPosition[];
  private readonly enemyCountMultiplier: number;
  private readonly enemyHpMultiplier: number;
  private readonly random: RandomService;

  constructor(
    private readonly map: GameMap,
    private readonly pathfinding: PathfindingSystem,
    private readonly waves: WaveDefinition[],
    options: WaveSystemOptions,
  ) {
    this.integrityValue = options.startingIntegrity;
    this.spawns = map.data.spawns;
    this.exits = map.data.exits;
    this.enemyCountMultiplier = options.enemyCountMultiplier ?? 1;
    this.enemyHpMultiplier = options.enemyHpMultiplier ?? 1;
    this.random = options.random;
  }

  /** A wave group's spawn count scaled by difficulty/party size, min 1. */
  private scaledGroupCount(count: number): number {
    return Math.max(1, Math.round(count * this.enemyCountMultiplier));
  }

  // ----- Read-only state -------------------------------------------------

  get integrity(): number {
    return this.integrityValue;
  }

  get enemies(): ReadonlyArray<Enemy> {
    return this.active;
  }

  /** 1-based wave number for display. */
  get waveNumber(): number {
    return this.waveIndex + 1;
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  get currentWave(): WaveDefinition {
    return this.waves[this.waveIndex];
  }

  /**
   * Enemy phases completed so far in the CURRENT wave. Used to compute the
   * turn-limit time bonus even when a wave is cleared by hero action during
   * the player phase (no enemy phase needed to report a `turn` number).
   */
  get turnsElapsed(): number {
    return this.waveTurn;
  }

  isDefeated(): boolean {
    return this.noFail ? false : this.integrityValue <= 0;
  }

  /** Test Mode (D-138): toggle the stronghold-cannot-fall debug flag. */
  setNoFail(value: boolean): void {
    this.noFail = value;
  }

  isLastWave(): boolean {
    return this.waveIndex >= this.waves.length - 1;
  }

  private allGroupsSpawned(): boolean {
    return this.currentWave.spawns.every(
      (group, i) => (this.spawnedCounts.get(i) ?? 0) >= this.scaledGroupCount(group.count),
    );
  }

  isCurrentWaveComplete(): boolean {
    return this.allGroupsSpawned() && this.active.length === 0;
  }

  // ----- Wave control ----------------------------------------------------

  /** Reset counters for the wave at `index` (does not tick it). */
  startWave(index: number): void {
    this.waveIndex = index;
    this.waveTurn = 0;
    this.spawnedCounts.clear();
    this.pendingRetry.clear();
    this.reinforcementCooldowns.clear();
    this.groupInitiativeRolls.clear();
    this.active = [];
  }

  /** Move on to the next wave. Caller should check isLastWave() first. */
  advanceToNextWave(): void {
    this.startWave(this.waveIndex + 1);
  }

  /**
   * Test Mode (D-138): force the CURRENT wave into its "cleared" state —
   * clears every active enemy and marks every spawn group as fully spawned,
   * so `isCurrentWaveComplete()` reads true immediately afterward. A bypass,
   * not a real clear: awards no reward gold (the caller's job, and
   * deliberately skipped for a debug skip).
   */
  forceEndWave(): void {
    this.active = [];
    this.currentWave.spawns.forEach((group, i) => {
      this.spawnedCounts.set(i, this.scaledGroupCount(group.count));
    });
  }

  /**
   * Remove every enemy that has been reduced to 0 HP (defeated by the heroes in
   * combat) and return the removed instances so the caller can clean up tokens
   * (and, in a later phase, award their reward gold). A defeated enemy leaves
   * the field exactly once: after removal it is no longer in `enemies`, so it
   * cannot march, attack, breach, or be counted again. This mirrors the
   * breach-once removal and is what lets a wave complete when heroes clear it.
   */
  removeDefeated(): Enemy[] {
    const removed = this.active.filter((e) => !e.isAlive());
    if (removed.length > 0) {
      this.active = this.active.filter((e) => e.isAlive());
    }
    return removed;
  }

  // ----- The enemy phase -------------------------------------------------

  /**
   * Run one enemy phase for the current wave. For each active enemy, in order:
   * spawn any due enemies, then each enemy either ATTACKS a hero in range (and
   * holds position) or ADVANCES toward the nearest exit (routing around walls
   * and any blocked tiles). Enemies that reach an exit deal Breach Damage once
   * and are removed. Returns a full report of what happened.
   *
   * With no context (Phase 3 behaviour) there are no hero targets and nothing
   * but walls blocks routing, so every enemy simply advances and may breach —
   * identical to before.
   */
  tickEnemyPhase(context: EnemyPhaseContext = {}): EnemyPhaseReport {
    const integrityBefore = this.integrityValue;
    this.waveTurn += 1;

    const spawned = this.spawnDueEnemies();
    this.applyGroupInitiativeOrder();
    const moves: EnemyMove[] = [];
    const attacks: EnemyAttackEvent[] = [];
    const trapTriggers: TrapTrigger[] = [];
    const breaches: BreachEvent[] = [];
    const statusEvents: StatusTickEvent[] = [];
    const structureAttacks: StructureAttackEvent[] = [];
    const reinforcements: ReinforcementEvent[] = [];
    const lifedrinks: LifedrinkEvent[] = [];
    const teleports: TeleportEvent[] = [];
    const mimicReveals: MimicRevealEvent[] = [];
    const phaseChanges: PhaseChangeEvent[] = [];
    const healEvents: HealAuraEvent[] = [];
    const trapDisarms: TrapDisarmEvent[] = [];

    const heroTargets = context.heroTargets ?? [];

    // Phase 21 (D-112), Healer: resolve every healing aura ONCE per phase,
    // before any individual enemy takes its own turn below — a healer may
    // still also attack or advance normally afterward in the main loop.
    for (const healer of this.active) {
      if (!healer.isAlive() || healer.breached || !healer.def.healAura) continue;
      const cfg = healer.def.healAura;
      for (const ally of this.active) {
        if (ally === healer || !ally.isAlive() || ally.breached || ally.isSwarm) continue;
        if (ally.health >= ally.def.maxHealth) continue;
        if (CombatSystem.range(healer.position, ally.position) > cfg.radiusTiles) continue;
        const healed = Math.min(cfg.healAmount, ally.def.maxHealth - ally.health);
        if (healed <= 0) continue;
        ally.health += healed;
        healEvents.push({ healer, ally, healed });
      }
    }

    for (const enemy of this.active) {
      if (enemy.breached) continue;
      // A freshly spawned enemy defeated by a trap earlier this phase (or by a
      // hero last phase before removeDefeated ran) takes no further action.
      if (!enemy.isAlive()) continue;

      // Phase 21 (D-112), Multi-Phase Boss: check BEFORE anything else this
      // phase (even burning) so a boss that crosses its threshold from a
      // burn tick still enters its next phase the same turn it happens.
      if (
        enemy.def.phaseChange &&
        !enemy.hasEnteredNextPhase &&
        enemy.health <= enemy.def.maxHealth * (enemy.def.phaseChange.hpPercent / 100)
      ) {
        enemy.enterNextPhase(enemy.def.phaseChange.overrides);
        phaseChanges.push({ enemy });
      }

      // Phase 21 (D-112), Mimic: disguised as scenery/treasure and
      // untargetable until a hero moves adjacent to it. Checked before
      // anything else — a still-disguised Mimic takes no action at all,
      // it just waits.
      if (enemy.def.mimicDisguise && !enemy.isRevealed) {
        const adjacent = heroTargets.some(
          (h) => CombatSystem.isAlive(h) && CombatSystem.range(enemy.position, h.position) <= 1,
        );
        if (adjacent) {
          enemy.reveal();
          mimicReveals.push({ enemy });
          // Falls through to act normally this same phase — the "gotcha"
          // moment of a Mimic springing to life the instant it's approached.
        } else {
          continue;
        }
      }

      // Burning resolves BEFORE the enemy takes its turn (Phase 7, status
      // effects): a damage-over-time tick that can kill it before it acts.
      if (enemy.hasStatus("burning")) {
        const def = getStatusEffectDefinition("burning");
        const result = CombatSystem.applyAttack(
          enemy,
          { rangeTiles: 0, damage: def.damagePerTurn ?? 0, attackBonus: 0, autoHit: true },
          this.random,
        );
        statusEvents.push({ enemy, effectId: "burning", result });
        if (!enemy.isAlive()) continue; // burned to death; no turn, no move
      }

      // A stunned enemy holds: no attack, no movement — but its statuses
      // (including this stun) still tick down at the end of its own phase.
      if (enemy.hasStatus("stunned")) {
        statusEvents.push({ enemy, effectId: "stunned" });
        enemy.tickStatuses();
        continue;
      }

      // Phase 16 (D-106): a "charmed" enemy attacks another enemy in range
      // instead of a hero, if one is available — the stand-in for every SRD
      // charm/dominate spell. Checked before normal hero-targeting so a
      // charmed enemy never also considers the party this phase.
      if (getStatusEffectDefinition("charmed").redirectsAttackToAllies && enemy.hasStatus("charmed")) {
        const others = this.active.filter((e) => e !== enemy && e.isAlive());
        const allyTarget = CombatSystem.chooseTarget(enemy.position, enemy.attackRangeTiles, others);
        if (allyTarget) {
          const result = CombatSystem.applyAttack(
            allyTarget,
            { rangeTiles: enemy.attackRangeTiles, damage: enemy.attackDamage, attackBonus: enemy.attackBonus },
            this.random,
          );
          attacks.push({ enemy, target: allyTarget, result });
        }
        enemy.tickStatuses();
        continue; // charmed: holds position either way, same as before acting
      }

      // D-145: hoisted up from their original spot (right before the
      // canEngageHeroes block below) so the new siege wall-seeking logic
      // — which needs `isBlocked`/`flying` for its own routing, and must
      // capture `from` before it does any moving of its own — can use them
      // too. Nothing here depends on anything computed between here and
      // their old spot, so this is a pure reorder, not a behavior change.
      const from = { ...enemy.position };
      const flying = enemy.def.movementType === "flying";
      const isBlocked = (pos: GridPosition): boolean => {
        // A flyer ignores walls: a tile blocked ONLY because it is a placed
        // wall does not stop it, but a tile blocked for another reason (a hero)
        // still does.
        if (flying && context.isWall?.(pos)) return false;
        return context.isBlocked?.(pos) ?? false;
      };
      let walked: GridPosition[] = [];
      let forcedFight = false;
      let movementResolved = false;
      // Enemy AI/Movement Redesign step 5 (D-143): whether this enemy's
      // fight actually landed this phase, and how much of its movement
      // budget the pre-attack walk (if any) already spent — the two things
      // the post-attack "move the rest of the budget" leftover-movement
      // step below needs to know.
      let attackedThisPhase = false;
      let preAttackFeetUsed = 0;

      // Enemy AI/Movement Redesign, self-defense (D-146): a hero's landed
      // hit marks this enemy "provoked" for exactly one enemy-phase turn
      // (`Enemy.markProvoked`, called by `BattleScene.showHeroHit`). If a
      // hero is STILL within this enemy's own `attackRangeTiles` when its
      // turn comes around, it strikes back this phase instead of whatever
      // unconditional priority action (siege wall, trap disarm) or detour it
      // would otherwise take — so an enemy under attack doesn't just stand
      // there and take it without even trying to hit back. `ignoresHeroes`
      // (the deliberate "doesn't care about heroes at all" archetype) is
      // exempt. The flag is consumed right here, immediately — whether or
      // not it ends up mattering this phase; an enemy that never reaches
      // this point at all this phase (stunned/charmed/burned to death above)
      // simply carries it into its next real turn instead.
      const hasProvokedTarget =
        !enemy.def.ignoresHeroes &&
        enemy.isProvoked &&
        CombatSystem.targetsInRange(enemy.position, enemy.attackRangeTiles, heroTargets).length > 0;
      enemy.clearProvoked();
      if (hasProvokedTarget) forcedFight = true;

      // Phase 20 (D-111): a reinforcement caller spawns more enemies beside
      // itself on a cooldown — a passive, ongoing effect that never
      // consumes this enemy's own turn (it still attacks or advances
      // normally afterward, below).
      if (enemy.def.callsReinforcements) {
        const cfg = enemy.def.callsReinforcements;
        const remaining = (this.reinforcementCooldowns.get(enemy.instanceId) ?? cfg.intervalTurns) - 1;
        if (remaining <= 0) {
          const spawnedNow = this.trySpawnReinforcements(enemy, cfg, context);
          if (spawnedNow.length > 0) reinforcements.push({ source: enemy, spawned: spawnedNow });
          this.reinforcementCooldowns.set(enemy.instanceId, cfg.intervalTurns);
        } else {
          this.reinforcementCooldowns.set(enemy.instanceId, remaining);
        }
      }

      // Phase 20 (D-111): a siege enemy attacks a destructible wall within
      // its own attack range before considering anything else — it exists
      // to open holes in the player's defenses, so a wall in reach wins
      // over a hero. D-146: EXCEPT when self-defense just forced the issue —
      // a siege enemy that's already being cut down doesn't ignore its
      // attacker to keep bashing masonry.
      if (enemy.def.siegeDamageMultiplier && context.wallHpAt && context.damageWall && !hasProvokedTarget) {
        const wall = WaveSystem.findWallInRange(enemy, context.wallHpAt);
        if (wall) {
          const damage = Math.round(enemy.attackDamage * enemy.def.siegeDamageMultiplier);
          const destroyed = context.damageWall(wall.instanceId, damage);
          structureAttacks.push({
            enemy,
            structureInstanceId: wall.instanceId,
            structureDefId: wall.defId,
            damage,
            destroyed,
          });
          enemy.tickStatuses();
          continue;
        }

        // Enemy AI/Movement Redesign §3 (D-145): no wall is already in reach
        // — seek out the destructible wall whose removal would shorten THIS
        // enemy's own route to the exit the most (bounded to what it can
        // actually reach with its current movement, see `bestWallTarget`),
        // and walk toward it instead of falling through to ordinary
        // hero-engagement/advance below. "Committed" (`enemy.siegeTargeting`)
        // keeps whatever wall it already picked until it's destroyed;
        // "Reassessing" (the default) re-evaluates fresh every phase.
        if (context.allWalls) {
          const walls = context.allWalls();
          let target =
            enemy.siegeTargeting === "committed"
              ? walls.find((w) => w.instanceId === this.siegeCommittedWalls.get(enemy.instanceId)) ?? null
              : null;
          if (!target) {
            target = WaveSystem.bestWallTarget(enemy, walls, this.exits, isBlocked, flying, this.pathfinding);
            if (target && enemy.siegeTargeting === "committed") {
              this.siegeCommittedWalls.set(enemy.instanceId, target.instanceId);
            }
          }
          if (target) {
            const route = this.pathfinding.routeToNearestGoal({
              start: enemy.position,
              goals: [target.position],
              isBlocked,
              ignoreWalls: flying,
            });
            if (route) {
              const approach = this.walkAlongRoute(
                enemy,
                route,
                enemy.effectiveMovementTiles + this.auraBonusFor(enemy).movementBonus,
                isBlocked,
              );
              if (approach.path.length > 0) {
                const nowInRange = WaveSystem.findWallInRange(enemy, context.wallHpAt);
                if (nowInRange) {
                  const damage = Math.round(enemy.attackDamage * enemy.def.siegeDamageMultiplier);
                  const destroyed = context.damageWall(nowInRange.instanceId, damage);
                  structureAttacks.push({
                    enemy,
                    structureInstanceId: nowInRange.instanceId,
                    structureDefId: nowInRange.defId,
                    damage,
                    destroyed,
                  });
                }
                moves.push({ enemy, from, path: approach.path, to: { ...enemy.position } });
                enemy.tickStatuses();
                continue;
              }
            }
          }
          // No beneficial/reachable wall found — falls through to ordinary
          // hero-engagement/advance below, same as when `context.allWalls`
          // is absent entirely.
        }
      }

      // Phase 25 (D-116): a Saboteur/Warren Stalker (`trapSense`) detects a
      // placed trap within its own sense range and disarms/destroys it
      // BEFORE considering anything else this phase — the same unconditional
      // priority a siege enemy gives a wall in reach. A trap has no HP (it
      // always hits, in full, every time — D-039), so this always removes it
      // outright in one phase rather than damaging it down. D-146: same
      // self-defense exception as the siege branch above.
      if (enemy.def.trapSense && context.trapInstanceAt && context.disarmTrap && !hasProvokedTarget) {
        const trap = WaveSystem.findTrapInRange(enemy, enemy.def.trapSense.rangeTiles, context.trapInstanceAt);
        if (trap && context.disarmTrap(trap.instanceId)) {
          trapDisarms.push({ enemy, structureInstanceId: trap.instanceId, structureDefId: trap.defId });
          enemy.tickStatuses();
          continue;
        }
      }

      // Phase 21 (D-112), Teleporter: every `teleportsEveryNTurns` phases,
      // jump straight toward the nearest exit instead of attacking or
      // advancing normally this phase — ignoring walls/blockers and the
      // normal movement-tile limit (but never landing ON another living,
      // non-swarm enemy's tile).
      if (enemy.def.teleportsEveryNTurns) {
        const interval = enemy.def.teleportsEveryNTurns;
        const remaining = (this.teleportCooldowns.get(enemy.instanceId) ?? interval) - 1;
        if (remaining <= 0) {
          this.teleportCooldowns.set(enemy.instanceId, interval);
          const teleported = this.tryTeleport(enemy);
          if (teleported) teleports.push(teleported);
          enemy.tickStatuses();
          continue;
        } else {
          this.teleportCooldowns.set(enemy.instanceId, remaining);
        }
      }

      const aura = this.auraBonusFor(enemy);
      const enrage = WaveSystem.enrageBonusFor(enemy);
      // Phase 20 (D-111): a stealthed enemy's first strike (before it has
      // ever been revealed) lands with Advantage — the ambush — and
      // permanently breaks its own stealth from that point on.
      const wasHidden = enemy.def.stealth === true && !enemy.isRevealed;
      const canEngageHeroes = !enemy.def.ignoresHeroes && heroTargets.length > 0;
      const advantage: AdvantageMode = wasHidden
        ? "advantage"
        : enemy.attacksWithDisadvantage
          ? "disadvantage"
          : "normal";

      // Enemy AI/Movement Redesign §1 (D-139): every enemy always attempts
      // to ADVANCE by default — ranged damage taken along the way never
      // slows or redirects it. Forced melee happens ONLY when a hero
      // physically blocks its one and only route (no detour exists at all).
      // §2 (D-140): short of that, Aggressiveness is a tolerance dial on how
      // much EXTRA route length this enemy accepts to avoid a hero blocking
      // its shortest one — low aggressiveness always pays the detour, high
      // aggressiveness forces the issue with whoever's in the way instead,
      // and the very top end (100) actively diverts off its goal-path to
      // chase a hero it can see even when nothing is blocking it at all.
      // D-146: skip entirely when self-defense already forced the fight
      // above — the retaliation target is already in range from the
      // enemy's CURRENT position, so none of the detour/hunt/positioning
      // decisions below should move it or reconsider anything.
      if (canEngageHeroes && !this.isExit(enemy.position) && !forcedFight) {
        // Enemy AI/Movement Redesign §3's AoE half (D-146): a high-tier AoE
        // attacker (`qualifiesForSmartPositioning`) evaluates every tile it
        // could stop on this phase and, if one would line up 2+ heroes at
        // once, walks there and fights from it instead of the ordinary
        // detour/hunt decision below — a real breath weapon is wasted on a
        // single target when standing one tile over would catch the whole
        // party. Lower-tier AoE enemies (and every non-AoE enemy) are
        // untouched, falling straight through to the existing logic.
        const budgetTiles = enemy.effectiveMovementTiles + aura.movementBonus;
        if (WaveSystem.qualifiesForSmartPositioning(enemy)) {
          const best = WaveSystem.bestPositioningTile(enemy, heroTargets, budgetTiles, isBlocked, flying, this.pathfinding);
          if (best) {
            if (best.distanceFeet > 0) {
              const route = this.pathfinding.routeToNearestGoal({
                start: enemy.position,
                goals: [{ x: best.x, y: best.y }],
                isBlocked,
                ignoreWalls: flying,
              });
              if (route) {
                const posWalk = this.walkAlongRoute(enemy, route, budgetTiles, isBlocked);
                walked = posWalk.path;
                preAttackFeetUsed = posWalk.usedFeet;
              }
            }
            forcedFight = true;
            movementResolved = true;
          }
        }

        if (!forcedFight) {
          const wallsOnlyBlocked = (pos: GridPosition): boolean =>
            flying ? false : (context.isWall?.(pos) ?? false);
          const routeIgnoringHeroes = this.pathfinding.routeToNearestGoal({
            start: enemy.position,
            goals: this.exits,
            isBlocked: wallsOnlyBlocked,
            ignoreWalls: flying,
          });
          const routeAroundHeroes = this.pathfinding.routeToNearestGoal({
            start: enemy.position,
            goals: this.exits,
            isBlocked,
            ignoreWalls: flying,
          });

          if (routeIgnoringHeroes && !routeAroundHeroes) {
            // A hero is the SOLE way through (a dead end) — forced melee.
            forcedFight = true;
          } else if (routeIgnoringHeroes && routeAroundHeroes) {
            // D-141: "extra route length" is now compared in feet (rounded to
            // the nearest tile-unit, same threshold-comparison rule as every
            // other budget check), not a raw tile-array-length difference —
            // diagonal shortcuts mean array length no longer equals distance.
            const directFeet = routeIgnoringHeroes[routeIgnoringHeroes.length - 1]?.distanceFeet ?? 0;
            const detourFeet = routeAroundHeroes[routeAroundHeroes.length - 1]?.distanceFeet ?? 0;
            const extraFeet = roundToTileUnit(detourFeet - directFeet);
            const tolerance = WaveSystem.detourTolerance(enemy.aggressiveness);
            const toleranceFeet = tolerance * TILE_FEET;
            if (extraFeet > 0 && extraFeet > toleranceFeet) {
              // Not worth the detour: walks the direct route instead, stopping
              // short of any hero tile rather than rerouting around it, then
              // checks for a fight from its new position below.
              const directWalk = this.walkAlongRoute(enemy, routeIgnoringHeroes, budgetTiles, isBlocked);
              walked = directWalk.path;
              preAttackFeetUsed = directWalk.usedFeet;
              forcedFight = true;
              movementResolved = true;
            }
          }

          if (!forcedFight && enemy.aggressiveness >= 100) {
            const huntRoute = this.huntRoute(enemy, heroTargets, isBlocked, flying);
            if (huntRoute) {
              const huntWalk = this.walkAlongRoute(enemy, huntRoute, budgetTiles, isBlocked);
              walked = huntWalk.path;
              preAttackFeetUsed = huntWalk.usedFeet;
              forcedFight = true;
              movementResolved = true;
            }
          }
        }
      }

      if (forcedFight) {
        // Phase 20 (D-111): an AoE/breath attacker hits EVERY hero in its
        // range at once instead of picking one via chooseTarget. Combined
        // with a saving-throw DC, each hero in range rolls its own save
        // instead of the enemy rolling once to hit.
        if (enemy.def.aoeAttack) {
          const inRange = CombatSystem.targetsInRange(enemy.position, enemy.attackRangeTiles, heroTargets);
          if (inRange.length > 0) {
            if (enemy.def.savingThrowAttackDC) {
              for (const hero of inRange) {
                const result = WaveSystem.resolveSavingThrowAttack(
                  enemy,
                  hero,
                  enemy.def.savingThrowAttackDC,
                  this.random,
                  aura.damageBonus + enrage.damageBonus,
                );
                attacks.push({ enemy, target: hero, result });
                this.applyOnHitHeroEffects(enemy, hero, result, lifedrinks);
              }
            } else {
              const profile: AttackProfile = {
                rangeTiles: enemy.attackRangeTiles,
                damage: enemy.attackDamage + aura.damageBonus + enrage.damageBonus,
                attackBonus: enemy.attackBonus + aura.attackBonus + enrage.attackBonus,
                advantage,
              };
              const results = CombatSystem.attackArea(enemy.position, heroTargets, profile, this.random);
              for (const result of results) {
                const target = heroTargets.find((h) => h.id === result.targetId)!;
                attacks.push({ enemy, target, result });
                this.applyOnHitHeroEffects(enemy, target, result, lifedrinks);
              }
            }
            if (wasHidden) enemy.reveal();
            attackedThisPhase = true;
          }
        }

        const target = attackedThisPhase
          ? null
          : CombatSystem.chooseTarget(enemy.position, enemy.attackRangeTiles, heroTargets);
        if (target) {
          // Phase 13.10: an enemy like Blightcaller forces a saving throw
          // instead of rolling to hit — see `resolveSavingThrowAttack`'s own
          // comment for why this still produces a normal `AttackResult`.
          // Phase 16 (D-106)/17 (D-108)/20 (D-111): an enemy under "blinded",
          // "sapped", or "toppled" rolls its own attack with disadvantage
          // (see `Enemy.attacksWithDisadvantage`); a still-hidden stealth
          // enemy's ambush overrides that with Advantage instead (see
          // `advantage`, computed above).
          // D-124: Rogue's Elusive denies the ATTACKER's Advantage against
          // this specific target (an ambush/blinded-enemy Advantage downgrades
          // to Normal; a Disadvantage source is untouched) — computed per
          // target, unlike `advantage` above, since only this branch resolves
          // a single known target.
          // D-125: Barbarian's Reckless Attack grants the ATTACKER Advantage
          // against this specific target while active — folded in before the
          // Elusive check above so Elusive can still deny it.
          const baseAdvantage: AdvantageMode = advantage === "advantage" || target.grantsAttackerAdvantage ? "advantage" : advantage;
          const targetAdvantage: AdvantageMode =
            baseAdvantage === "advantage" && target.deniesAttackerAdvantage?.() ? "normal" : baseAdvantage;
          const result = enemy.def.savingThrowAttackDC
            ? WaveSystem.resolveSavingThrowAttack(
                enemy,
                target,
                enemy.def.savingThrowAttackDC,
                this.random,
                aura.damageBonus + enrage.damageBonus,
              )
            : CombatSystem.applyAttack(
                target,
                {
                  rangeTiles: enemy.attackRangeTiles,
                  damage: enemy.attackDamage + aura.damageBonus + enrage.damageBonus,
                  attackBonus: enemy.attackBonus + aura.attackBonus + enrage.attackBonus,
                  advantage: targetAdvantage,
                },
                this.random,
              );
          attacks.push({ enemy, target, result });
          this.applyOnHitHeroEffects(enemy, target, result, lifedrinks);
          if (wasHidden) enemy.reveal();
          attackedThisPhase = true;
        }
        // A "fight" was decided (boxed in, or chose the direct route) but
        // nothing is actually in range yet (e.g. a ranged enemy blocked
        // beyond its own reach) — falls through to the ordinary advance
        // below, which finds itself just as blocked and holds in place.
      }

      // Enemy AI/Movement Redesign step 5 (D-143): "move-attack-move" — an
      // attack landing does not end the phase outright anymore. Whatever
      // movement budget the pre-attack walk (if any) didn't spend continues
      // toward the exit right now, using the ordinary hero-respecting route
      // (no more "forcing" — that was only to get within striking range).
      // A true dead-end attack (case (a) above: no pre-attack walk at all,
      // so the FULL budget is still available here) naturally finds no
      // route around the hero blocking it and simply holds, same as today;
      // an aggressiveness-forced or top-end hunt attack that didn't need
      // its whole budget to close the distance keeps going afterward
      // instead of standing still — the actual "hit and run" a racing-the-
      // clock boss needs. This also fixes a pre-existing reporting gap: an
      // attacking enemy's pre-attack walk previously never appeared in
      // `moves` at all (the old `continue` skipped the `moves.push` below
      // entirely) even though `enemy.position` had already changed — now
      // every case falls through to the same shared tail.
      if (attackedThisPhase) {
        const totalBudgetTiles = enemy.effectiveMovementTiles + aura.movementBonus;
        const usedTiles = roundToTileUnit(preAttackFeetUsed) / TILE_FEET;
        const remainingTiles = Math.max(0, totalBudgetTiles - usedTiles);
        if (remainingTiles > 0) {
          const more = this.advanceEnemy(enemy, isBlocked, flying, 0, remainingTiles);
          walked = walked.concat(more);
        }
      }

      // Phase 25 (D-116): "opportunity" — no hero fight is happening this
      // phase, so a MELEE enemy (attackRangeTiles <= 1) with a destructible
      // wall within that same reach takes a swing at the wall instead of just
      // walking past/around it. This is every ordinary minion's "personality"
      // (a ranged/caster enemy usually doesn't need the wall gone at all —
      // its range already reaches past it — so this is scoped to melee); a
      // dedicated siege enemy (`siegeDamageMultiplier`) is excluded because
      // it already has its OWN unconditional priority tier above, checked
      // before hero-targeting even runs — and a pure runner (`ignoresHeroes`)
      // never attacks anything, wall included, unchanged from its existing
      // "never thrown a punch" personality. Deals plain `attackDamage` (plus
      // any aura/enrage bonus already in play) — no siege multiplier, since
      // this is an improvised bash, not a dedicated demolition attack.
      if (
        !forcedFight &&
        !enemy.def.ignoresHeroes &&
        !enemy.def.siegeDamageMultiplier &&
        enemy.attackRangeTiles <= 1 &&
        context.wallHpAt &&
        context.damageWall
      ) {
        const wall = WaveSystem.findWallInRange(enemy, context.wallHpAt);
        if (wall) {
          const damage = enemy.attackDamage + aura.damageBonus + enrage.damageBonus;
          const destroyed = context.damageWall(wall.instanceId, damage);
          structureAttacks.push({
            enemy,
            structureInstanceId: wall.instanceId,
            structureDefId: wall.defId,
            damage,
            destroyed,
            opportunistic: true,
          });
          enemy.tickStatuses();
          continue;
        }
      }

      // Otherwise advance toward the exit, routing around walls and blockers
      // (unless the branch above already moved this phase — an aggressive
      // enemy's direct approach or its top-end hunt, both of which must NOT
      // be overwritten by recomputing the safe detour route here — or this
      // phase's attack already used the leftover-movement step above).
      // D-067: an enemy may walk THROUGH another living enemy's current tile
      // (so a queue doesn't force a long detour) but may never END its move
      // there — advanceEnemy() backs off to the nearest earlier tile on its
      // route that isn't occupied. The exit tile itself is always enterable
      // regardless (PathfindingSystem's rule), so enemies still queue through
      // it cleanly rather than getting stuck right at the goal. Movement uses
      // `effectiveMovementTiles`, which a "slowed" status quietly reduces.
      // Enemy AI/Movement Redesign step 5 (D-143), Sprint: `EnemyDefinition
      // .sprints` doubles this phase's movement budget — the real SRD Dash
      // trade (whole action spent moving) costs nothing extra to enforce
      // here, since this branch structurally never also attacks.
      if (!movementResolved && !attackedThisPhase) {
        const budgetOverride = enemy.sprints
          ? (enemy.effectiveMovementTiles + aura.movementBonus) * 2
          : undefined;
        walked = this.advanceEnemy(enemy, isBlocked, flying, aura.movementBonus, budgetOverride);
      }

      // Traps: any trap tile the enemy STEPS ONTO this phase damages it, in the
      // order walked. If a trap defeats the enemy, it stops on that tile and
      // does not continue to the exit (so it cannot breach when already dead).
      if (context.trapAt) {
        for (const tile of walked) {
          const profile = context.trapAt(tile);
          if (!profile) continue;
          // A trap only bites the movement types it targets (D-049): a Sky
          // Snare ignores ground units, a Spike Trap ignores flyers.
          const targets = context.trapTargets?.(tile) ?? "any";
          if (targets !== "any" && targets !== enemy.def.movementType) continue;
          const result = CombatSystem.applyAttack(enemy, profile, this.random);
          trapTriggers.push({ enemy, position: { ...tile }, result });
          const status = context.trapStatusAt?.(tile);
          if (status && enemy.isAlive()) enemy.applyStatus(status.statusId, status.durationTurns);
          if (!enemy.isAlive()) {
            enemy.position = { ...tile };
            break;
          }
        }
      }

      // An ordinary (non-attacking) advance always reports a move event,
      // even an empty one (fully blocked/slowed this phase) — the
      // pre-D-143 contract callers already rely on to distinguish "this
      // enemy took its ordinary-advance turn" from an early-`continue`
      // branch (siege/trap/teleport/wall-bash/charmed/stunned) that never
      // reaches this tail at all. An attack, however, only reports one when
      // it actually moved (a pre-attack walk and/or D-143's post-attack
      // leftover-budget leg) — a dead-end attack with nothing left to spend
      // afterward reports none, matching every attack before D-143 (which
      // always `continue`d before ever reaching here).
      if (!attackedThisPhase || walked.length > 0) {
        moves.push({ enemy, from, path: walked, to: { ...enemy.position } });
      }

      if (enemy.isAlive() && this.isExit(enemy.position) && !enemy.breached) {
        enemy.breached = true;
        const damage = enemy.breachDamage;
        this.integrityValue = Math.max(0, this.integrityValue - damage);
        breaches.push({ enemy, damage });
      }

      if (enemy.isAlive()) enemy.tickStatuses();
    }

    // Remove enemies that breached this phase.
    this.active = this.active.filter((e) => !e.breached);

    return {
      turn: this.waveTurn,
      spawned,
      moves,
      attacks,
      trapTriggers,
      breaches,
      statusEvents,
      structureAttacks,
      reinforcements,
      lifedrinks,
      teleports,
      mimicReveals,
      phaseChanges,
      healEvents,
      trapDisarms,
      integrityBefore,
      integrityAfter: this.integrityValue,
      waveComplete: this.isCurrentWaveComplete(),
      defeated: this.isDefeated(),
    };
  }

  /**
   * Phase 13.10: an enemy whose attack forces a saving throw instead of a
   * to-hit roll (e.g. Blightcaller — `EnemyDefinition.savingThrowAttackDC`).
   * The DC comes from the enemy (a flat number, same "no ability scores to
   * derive one from" treatment every other enemy stat gets); the roll is
   * the TARGET's own `savingThrowBonus` (`Combatant`'s optional field —
   * `Hero.savingThrowBonus` falls back to a flat default for the classic
   * fixed roster, which has no ability scores).
   *
   * Reuses `SavingThrowSystem.applySaveOrDamage` for the actual roll/damage/
   * mutation, then repackages its `SavingThrowAttackResult` into a normal
   * `AttackResult` with a SYNTHESIZED `roll` (`hit` = the save FAILED, never
   * a critical) so every existing render path in `BattleScene`
   * (`didHit`/`attackVerb`/the combat log) works completely unchanged —
   * `roll.targetArmorClass` holds the DC here, not an Armor Class; it is
   * never rendered as text, only read by `didHit`/`attackVerb`.
   *
   * Phase 20 (D-111): `damageBonus` folds in a nearby aura buff's
   * `damageBonus` (default 0, so every pre-Phase-20 caller is unaffected).
   *
   * D-124: also reads the target's own `savingThrowAdvantage` (Danger
   * Sense), `evasionHalvesFailedSave` (Evasion), and `rerollFailedSave`
   * (Indomitable) — every one of them optional on `Combatant`, so an enemy
   * target (no such hooks) behaves exactly as before this decision.
   */
  private static resolveSavingThrowAttack(
    enemy: Enemy,
    target: Combatant,
    dc: number,
    random: RandomService,
    damageBonus = 0,
  ): AttackResult {
    const outcome = SavingThrowSystem.applySaveOrDamage(
      target,
      enemy.attackDamage + damageBonus,
      dc,
      target.savingThrowBonus ?? 2,
      random,
      target.savingThrowAdvantage ?? "normal",
      { halveOnFail: target.evasionHalvesFailedSave, rerollFailedSave: target.rerollFailedSave?.bind(target) },
    );
    return {
      targetId: outcome.targetId,
      rawDamage: outcome.rawDamage,
      damageDealt: outcome.damageDealt,
      healthBefore: outcome.healthBefore,
      healthAfter: outcome.healthAfter,
      defeated: outcome.defeated,
      roll: {
        d20: outcome.save.d20,
        total: outcome.save.total,
        targetArmorClass: dc,
        hit: !outcome.save.success,
        critical: false,
        fumble: false,
        advantage: target.savingThrowAdvantage ?? "normal",
      },
    };
  }

  private spawnDueEnemies(): Enemy[] {
    const spawned: Enemy[] = [];
    this.currentWave.spawns.forEach((group, i) => {
      const already = this.spawnedCounts.get(i) ?? 0;
      const groupCount = this.scaledGroupCount(group.count);
      if (already >= groupCount) return;
      const interval = Math.max(1, group.intervalTurns);
      const scheduledDue =
        this.waveTurn >= group.startTurn &&
        (this.waveTurn - group.startTurn) % interval === 0;
      // A spawn blocked last phase (its tile was occupied) keeps trying every
      // phase after, instead of being silently dropped or stacking on top of
      // whatever is standing there.
      const due = scheduledDue || this.pendingRetry.has(i);
      if (!due) return;

      const spawnPos = this.spawns[group.spawnIndex ?? 0];
      if (!spawnPos) return; // no such spawn point; skip safely

      if (this.isOccupiedByAnyEnemy(spawnPos)) {
        this.pendingRetry.add(i);
        return;
      }
      this.pendingRetry.delete(i);

      const baseDef: EnemyDefinition = getEnemyDefinition(group.enemyId);
      // D-217 (item 3b/3.5): `group.statMultiplier` (ThreatBudgetSystem's
      // elite substitution, or bossScaling's level-cap boss scaling) combines
      // with the difficulty tier's own `enemyHpMultiplier` — absent on both
      // is today's exact behavior.
      const hpMultiplier = this.enemyHpMultiplier * (group.statMultiplier?.hp ?? 1);
      const damageMultiplier = group.statMultiplier?.damage ?? 1;
      const attackBonusAdd = group.statMultiplier?.attackBonusAdd ?? 0;
      const def: EnemyDefinition =
        hpMultiplier === 1 && damageMultiplier === 1 && attackBonusAdd === 0
          ? baseDef
          : {
              ...baseDef,
              maxHealth: Math.max(1, Math.round(baseDef.maxHealth * hpMultiplier)),
              attackDamage: Math.max(1, Math.round(baseDef.attackDamage * damageMultiplier)),
              attackBonus: baseDef.attackBonus + attackBonusAdd,
            };
      const enemy = new Enemy(`${def.id}#${this.nextInstance++}`, def, spawnPos);
      this.active.push(enemy);
      spawned.push(enemy);
      this.spawnedCounts.set(i, already + 1);
    });
    return spawned;
  }

  /**
   * KI-098 item 10 (D-175): sorts `this.active` IN PLACE into per-group
   * initiative order — every enemy of the same TYPE (`EnemyDefinition.id`)
   * acts as one group, groups act highest-roll-first, and members within a
   * group keep their original relative (spawn) order (`Array.sort` is a
   * stable sort, so two entries with an equal comparison never swap).
   * Sorting `this.active` itself, rather than iterating a separately
   * materialized snapshot array, matters for one reason: `tickEnemyPhase`'s
   * main loop is a `for...of` over the live `this.active` array, and a
   * same-phase reinforcement/summon (`trySpawnReinforcements` et al.) is
   * appended to it mid-loop — a `for...of` over a live array still visits
   * items appended during iteration, so this preserves that existing
   * "a reinforcement can act the same phase it spawns" behavior exactly.
   * Called once per phase, right after `spawnDueEnemies` — before that
   * call's own newly-spawned enemies get a chance to act this same phase,
   * they need a place in the order too.
   */
  private applyGroupInitiativeOrder(): void {
    for (const enemy of this.active) {
      if (this.groupInitiativeRolls.has(enemy.def.id)) continue;
      const [entry] = InitiativeSystem.rollInitiative([{ id: enemy.def.id, bonus: 0 }], this.random);
      this.groupInitiativeRolls.set(enemy.def.id, entry.roll);
    }
    this.active.sort((a, b) => {
      const rollDiff = (this.groupInitiativeRolls.get(b.def.id) ?? 0) - (this.groupInitiativeRolls.get(a.def.id) ?? 0);
      if (rollDiff !== 0) return rollDiff;
      return a.def.id < b.def.id ? -1 : a.def.id > b.def.id ? 1 : 0;
    });
  }

  /**
   * Test Mode (D-138): spawn one enemy by id at an exact tile, on demand,
   * outside the normal wave schedule. Mirrors `spawnDueEnemies`'s own entity
   * construction (same `Enemy` constructor, same `active`/`nextInstance`
   * bookkeeping) so a debug-spawned enemy is indistinguishable from a real
   * one to every other system — but uses the enemy's BASE definition, with
   * no wave HP-scaling applied. No occupancy check: a debug tool, tester's
   * responsibility.
   */
  spawnAt(enemyId: string, pos: GridPosition): Enemy {
    const def = getEnemyDefinition(enemyId);
    const enemy = new Enemy(`${def.id}#${this.nextInstance++}`, def, pos);
    this.active.push(enemy);
    return enemy;
  }

  /**
   * True if any living, un-breached, NON-SWARM enemy already stands at
   * `pos`. Phase 21 (D-112): a Swarm never counts as "occupying" a tile for
   * this check — the real SRD "Swarm" trait lets it share a tile with
   * anything, so a swarm at `pos` never blocks a spawn/reinforcement/
   * death-spawn from landing there too.
   */
  private isOccupiedByAnyEnemy(pos: GridPosition): boolean {
    return this.active.some(
      (e) => e.isAlive() && !e.breached && !e.def.swarm && e.position.x === pos.x && e.position.y === pos.y,
    );
  }

  /**
   * True if a living, un-breached enemy OTHER than `self` blocks `self` from
   * landing at `pos`. Phase 21 (D-112): a Swarm mover is never blocked by
   * ANY other enemy (it can stack with anyone); a non-swarm mover is blocked
   * only by another NON-SWARM enemy (a swarm at `pos` never blocks it) —
   * together these reproduce the real SRD rule that a swarm and another
   * creature may always occupy the same space, in both directions.
   */
  private isOccupiedByOtherEnemy(pos: GridPosition, self: Enemy): boolean {
    if (self.def.swarm) return false;
    return this.active.some(
      (e) =>
        e !== self &&
        e.isAlive() &&
        !e.breached &&
        !e.def.swarm &&
        e.position.x === pos.x &&
        e.position.y === pos.y,
    );
  }

  /**
   * Advance one enemy up to its movement allowance along the shortest route to
   * the nearest exit. Returns the tiles walked (may be empty if already at an
   * exit or genuinely stuck). Mutates only this enemy's position.
   *
   * D-067: `isBlocked` (walls/heroes/context) is a hard block on the ROUTE
   * itself, but another living enemy's tile is not — the route may pass
   * straight through one. What it may NOT do is END there: starting from the
   * movement-budget-limited landing tile, this backs off one tile at a time
   * until it finds one that isn't currently occupied by another enemy. If
   * even the very first step is occupied, the enemy holds in place this
   * phase (same as being fully blocked).
   *
   * Phase 20 (D-111): `movementBonus` folds in a nearby aura buff's
   * `movementBonus` (default 0, so every pre-Phase-20 caller is unaffected).
   *
   * Enemy AI/Movement Redesign step 5 (D-143): `budgetTilesOverride`, when
   * given, replaces `effectiveMovementTiles + movementBonus` as the tile
   * budget outright — used for Sprint (double budget) and for the leftover
   * movement after a landed attack (whatever the pre-attack walk didn't
   * spend). Absent means the exact pre-D-143 computation, unchanged.
   */
  private advanceEnemy(
    enemy: Enemy,
    isBlocked?: (pos: GridPosition) => boolean,
    ignoreWalls = false,
    movementBonus = 0,
    budgetTilesOverride?: number,
  ): GridPosition[] {
    if (this.isExit(enemy.position)) return [];
    const route = this.pathfinding.routeToNearestGoal({
      start: enemy.position,
      goals: this.exits,
      isBlocked,
      ignoreWalls,
    });
    if (!route || route.length === 0) return [];
    // D-141: budget is now a distance (feet, rounded to the nearest tile-unit
    // for the threshold check), not a raw array-index count — a route's
    // steps no longer cost the same amount uniformly once diagonal shortcuts
    // are involved. `affordablePrefixLength` finds how far along the route
    // (in tile-array terms) the enemy's movement budget actually reaches.
    const budgetTiles = budgetTilesOverride ?? enemy.effectiveMovementTiles + movementBonus;
    let steps = WaveSystem.affordablePrefixLength(route, budgetTiles);
    // Phase 7: a fully "slowed" enemy can have 0 effective movement this
    // phase. Guard this the same way as "no route" — no steps means no walk,
    // and position must NOT be touched (spreading an empty walked[-1] would
    // silently corrupt it to `{}`).
    while (steps > 0 && this.isOccupiedByOtherEnemy(route[steps - 1], enemy)) {
      steps -= 1;
    }
    if (steps === 0) return [];
    // D-141: strip `distanceFeet` before this crosses back into plain
    // GridPosition territory (`enemy.position`, the public `EnemyMove.path`)
    // — a bare route tile carries it for budget math, nothing downstream
    // should ever see it.
    const walked: GridPosition[] = route.slice(0, steps).map((p) => ({ x: p.x, y: p.y }));
    enemy.position = { ...walked[walked.length - 1] };
    return walked;
  }

  /**
   * D-141: the largest prefix of a distance-annotated route (see
   * `RoutedPosition`) affordable within `budgetTiles` of movement — the
   * shared "slice a weighted route to a budget" primitive `advanceEnemy`,
   * `walkAlongRoute`, and `tryTeleport` all use. Route distances are
   * monotonically increasing (positive edge costs), so a simple forward
   * scan is correct.
   */
  private static affordablePrefixLength(route: RoutedPosition[], budgetTiles: number): number {
    const budgetFeet = budgetTiles * TILE_FEET;
    let n = 0;
    while (n < route.length && roundToTileUnit(route[n].distanceFeet) <= budgetFeet) {
      n += 1;
    }
    return n;
  }

  private isExit(pos: GridPosition): boolean {
    return this.exits.some((e) => e.x === pos.x && e.y === pos.y);
  }

  // ----- Enemy AI/Movement Redesign §2 (D-140): Aggressiveness ------------

  /**
   * The extra route length (in tiles) this enemy tolerates before it stops
   * bothering to detour around a hero blocking its shortest route. 0
   * aggressiveness always takes the detour, however long (infinite
   * tolerance); 100 never takes ANY extra-length detour (a tolerance of -1,
   * so even a 0-tile "extra" length still isn't checked here — that case is
   * `extraTiles > 0` failing first). Linear in between: a flat, untuned
   * first-pass number like every other balance value in this project.
   */
  private static detourTolerance(aggressiveness: number): number {
    if (aggressiveness <= 0) return Infinity;
    if (aggressiveness >= 100) return -1;
    return Math.round((100 - aggressiveness) / 10);
  }

  /**
   * Walk `enemy` along a PRECOMPUTED route (rather than re-pathing around
   * blockers), up to `movementBudget` tiles, stopping the instant the next
   * tile is hard-blocked (a hero, or — for a ground enemy — a wall) or
   * occupied by another living enemy. Used for the two Aggressiveness (§2)
   * cases where the enemy deliberately does NOT take the safe detour around
   * a hero: it walks straight at the obstacle and stops adjacent (or at
   * whatever range it can reach) instead of rerouting around it. Mutates
   * `enemy.position` only if at least one step is taken, same convention as
   * `advanceEnemy`.
   *
   * Enemy AI/Movement Redesign step 5 (D-143): also returns `usedFeet` — the
   * exact (unrounded) cumulative distance actually walked, i.e. the last
   * stepped-onto route tile's own `distanceFeet` (0 if no step was taken) —
   * so the caller can work out how much of this phase's movement budget is
   * still left to spend after the attack this walk was closing distance for.
   */
  private walkAlongRoute(
    enemy: Enemy,
    route: RoutedPosition[],
    movementBudgetTiles: number,
    isBlocked: (pos: GridPosition) => boolean,
  ): { path: GridPosition[]; usedFeet: number } {
    // D-141: budget is a distance now (see `affordablePrefixLength`'s own
    // comment) — a diagonal-heavy stretch of `route` can afford fewer tiles
    // than a purely orthogonal one of the same array length.
    const budgetFeet = movementBudgetTiles * TILE_FEET;
    const steps: GridPosition[] = [];
    let usedFeet = 0;
    for (const tile of route) {
      if (roundToTileUnit(tile.distanceFeet) > budgetFeet) break;
      if (isBlocked(tile)) break;
      if (this.isOccupiedByOtherEnemy(tile, enemy)) break;
      steps.push({ x: tile.x, y: tile.y }); // D-141: strip `distanceFeet` — see `advanceEnemy`'s note
      usedFeet = tile.distanceFeet;
    }
    if (steps.length === 0) return { path: [], usedFeet: 0 };
    enemy.position = { ...steps[steps.length - 1] };
    return { path: steps, usedFeet };
  }

  /**
   * Enemy AI/Movement Redesign §2 top end (D-140): for an aggressiveness-100
   * enemy with nothing already blocking its goal-path, a route toward the
   * NEAREST living hero it could plausibly close on and strike this very
   * phase (Manhattan distance within its own movement + attack reach) — or
   * null if no hero is that close. `walkAlongRoute` (above) then walks this
   * route and naturally stops adjacent (or at whatever range applies) since
   * the hero's own tile is always hard-blocked.
   */
  private huntRoute(
    enemy: Enemy,
    heroTargets: ReadonlyArray<Combatant>,
    isBlocked: (pos: GridPosition) => boolean,
    flying: boolean,
  ): RoutedPosition[] | null {
    const reach = enemy.effectiveMovementTiles + enemy.attackRangeTiles;
    let nearest: Combatant | null = null;
    let nearestDist = Infinity;
    for (const hero of heroTargets) {
      if (!CombatSystem.isAlive(hero)) continue;
      const dist = CombatSystem.range(enemy.position, hero.position);
      if (dist <= reach && dist < nearestDist) {
        nearest = hero;
        nearestDist = dist;
      }
    }
    if (!nearest) return null;
    return this.pathfinding.routeToNearestGoal({
      start: enemy.position,
      goals: [nearest.position],
      isBlocked,
      ignoreWalls: flying,
    });
  }

  // ----- Phase 20 (D-111): new enemy mechanics ----------------------------

  /**
   * The combined buff every OTHER living, un-breached `auraBuff` enemy
   * within its own `radiusTiles` grants `enemy` this phase. Recomputed
   * fresh every time (never a persisted status) — a captain's buff stops
   * the instant it dies or its target steps out of range. An enemy never
   * buffs itself, even if its own radius would technically include its
   * own tile (`CombatSystem.range` of 0).
   */
  private auraBonusFor(enemy: Enemy): { attackBonus: number; damageBonus: number; movementBonus: number } {
    let attackBonus = 0;
    let damageBonus = 0;
    let movementBonus = 0;
    for (const source of this.active) {
      if (source === enemy || !source.isAlive() || source.breached) continue;
      const aura = source.def.auraBuff;
      if (!aura) continue;
      if (CombatSystem.range(source.position, enemy.position) <= aura.radiusTiles) {
        attackBonus += aura.attackBonus ?? 0;
        damageBonus += aura.damageBonus ?? 0;
        movementBonus += aura.movementBonus ?? 0;
      }
    }
    return { attackBonus, damageBonus, movementBonus };
  }

  /**
   * The nearest destructible wall (by scan order, not distance) within a
   * siege enemy's own attack range, or null if none. Manhattan distance,
   * matching every other range check in this system.
   */
  private static findWallInRange(
    enemy: Enemy,
    wallHpAt: (pos: GridPosition) => { instanceId: string; defId: string } | null,
  ): { instanceId: string; defId: string } | null {
    const range = enemy.attackRangeTiles;
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist === 0 || dist > range) continue;
        const wall = wallHpAt({ x: enemy.position.x + dx, y: enemy.position.y + dy });
        if (wall) return wall;
      }
    }
    return null;
  }

  /**
   * Enemy AI/Movement Redesign §3 (D-145): among `walls`, the one whose
   * removal shortens THIS enemy's own weighted route to the nearest exit the
   * most — or null if none would help at all (the enemy's route is already
   * unobstructed, or every candidate is too far away to matter this phase).
   * `reach` (Manhattan, matching every other range/reach scan in this file)
   * is a cheap prefilter — "bounded to the enemy's current movement speed
   * only" — so this doesn't run a full weighted route for every wall on the
   * map, only ones plausibly within striking distance soon. The actual
   * comparison uses real weighted routing distance (feet), the same metric
   * every other movement decision in this file already uses.
   */
  private static bestWallTarget(
    enemy: Enemy,
    walls: ReadonlyArray<{ instanceId: string; defId: string; position: GridPosition }>,
    exits: GridPosition[],
    isBlocked: (pos: GridPosition) => boolean,
    flying: boolean,
    pathfinding: PathfindingSystem,
  ): { instanceId: string; defId: string; position: GridPosition } | null {
    const reach = enemy.effectiveMovementTiles + enemy.attackRangeTiles;
    const baselineRoute = pathfinding.routeToNearestGoal({ start: enemy.position, goals: exits, isBlocked, ignoreWalls: flying });
    let bestFeet = baselineRoute ? baselineRoute[baselineRoute.length - 1].distanceFeet : Infinity;
    let best: { instanceId: string; defId: string; position: GridPosition } | null = null;

    for (const wall of walls) {
      const dist = Math.abs(wall.position.x - enemy.position.x) + Math.abs(wall.position.y - enemy.position.y);
      if (dist > reach) continue;
      const withoutThisWall = (pos: GridPosition): boolean => {
        if (pos.x === wall.position.x && pos.y === wall.position.y) return false;
        return isBlocked(pos);
      };
      const route = pathfinding.routeToNearestGoal({ start: enemy.position, goals: exits, isBlocked: withoutThisWall, ignoreWalls: flying });
      const feet = route ? route[route.length - 1].distanceFeet : Infinity;
      if (feet < bestFeet) {
        bestFeet = feet;
        best = wall;
      }
    }
    return best;
  }

  // ----- Enemy AI/Movement Redesign §3, AoE half (D-146) ------------------

  /**
   * True for a "high-intelligence/high-tier" AoE/breath attacker, per
   * Kevin's own spec wording for smart positioning — `role` already IS this
   * project's tier concept (it's what `defaultAggressiveness` itself keys
   * off of for the same "boss/legendary reads differently" distinction), so
   * this reuses it rather than inventing a new, unused stat. Reads
   * `activeDef.aoeAttack` (not `def.aoeAttack`) so a Multi-Phase Boss that
   * only GAINS `aoeAttack` via `phaseChange.overrides` (e.g. Sundered King)
   * correctly qualifies once it crosses that threshold, not before. Every
   * current minion-tier AoE enemy (Cave Drake, Frost Warden) is deliberately
   * excluded — they keep today's simpler "walk toward the exit, attack
   * whoever ends up in range" behavior, per the spec.
   */
  private static qualifiesForSmartPositioning(enemy: Enemy): boolean {
    return enemy.activeDef.aoeAttack === true && (enemy.def.role === "boss" || enemy.def.role === "legendary");
  }

  /**
   * Among every tile `enemy` could stop on this phase (`PathfindingSystem
   * .reachableTiles`, which includes its own current tile at distance 0 —
   * "don't move" is a legitimate answer), the one hitting the most heroes
   * within `attackRangeTiles` at once — or null if the best any tile can do
   * is 1 or fewer (not worth abandoning the ordinary advance/detour/hunt
   * decision for a result no better than what it would get anyway, since a
   * single target is what that existing logic already produces). Ties
   * prefer the CHEAPEST tile to reach (least movement spent, `enemy
   * .position` itself — distance 0 — winning any tie against a tile that
   * requires moving at all).
   */
  private static bestPositioningTile(
    enemy: Enemy,
    heroTargets: ReadonlyArray<Combatant>,
    budgetTiles: number,
    isBlocked: (pos: GridPosition) => boolean,
    flying: boolean,
    pathfinding: PathfindingSystem,
  ): RoutedPosition | null {
    const candidates = pathfinding.reachableTiles(enemy.position, budgetTiles, isBlocked, flying);
    let best: RoutedPosition | null = null;
    let bestCount = 1;
    for (const tile of candidates) {
      const count = CombatSystem.targetsInRange({ x: tile.x, y: tile.y }, enemy.attackRangeTiles, heroTargets).length;
      const better = count > bestCount || (best !== null && count === bestCount && tile.distanceFeet < best.distanceFeet);
      if (better) {
        bestCount = count;
        best = tile;
      }
    }
    return best;
  }

  /**
   * Phase 25 (D-116): the nearest placed trap (by scan order, not distance)
   * within `rangeTiles` of a `trapSense` enemy's own position, or null if
   * none. Unlike `findWallInRange`, `dist === 0` is NOT excluded — an enemy
   * can be standing on an already-placed, not-yet-triggered trap (it only
   * triggers when STEPPED ONTO, not while holding position), and it should
   * still notice/disarm that one.
   */
  private static findTrapInRange(
    enemy: Enemy,
    rangeTiles: number,
    trapInstanceAt: (pos: GridPosition) => { instanceId: string; defId: string } | null,
  ): { instanceId: string; defId: string } | null {
    for (let dx = -rangeTiles; dx <= rangeTiles; dx++) {
      for (let dy = -rangeTiles; dy <= rangeTiles; dy++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > rangeTiles) continue;
        const trap = trapInstanceAt({ x: enemy.position.x + dx, y: enemy.position.y + dy });
        if (trap) return trap;
      }
    }
    return null;
  }

  /**
   * Spawn up to `cfg.count` more of `cfg.enemyId` on free tiles orthogonally
   * adjacent to `source` (map-walkable, not occupied by another living
   * enemy, and not blocked by the caller's own `isBlocked` — heroes/walls).
   * Returns however many actually found room; a fully boxed-in caller
   * simply spawns fewer (never none of them silently crash).
   */
  private trySpawnReinforcements(
    source: Enemy,
    cfg: NonNullable<EnemyDefinition["callsReinforcements"]>,
    context: EnemyPhaseContext,
  ): Enemy[] {
    const deltas: GridPosition[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    const def = getEnemyDefinition(cfg.enemyId);
    const spawned: Enemy[] = [];
    for (const d of deltas) {
      if (spawned.length >= cfg.count) break;
      const pos = { x: source.position.x + d.x, y: source.position.y + d.y };
      if (!this.map.isWalkable(pos)) continue;
      if (this.isOccupiedByAnyEnemy(pos)) continue;
      if (context.isBlocked?.(pos)) continue;
      const reinforcement = new Enemy(`${def.id}#${this.nextInstance++}`, def, pos);
      this.active.push(reinforcement);
      spawned.push(reinforcement);
    }
    return spawned;
  }

  // ----- Phase 21 (D-112): more new enemy mechanics -----------------------

  /**
   * Berserker's flat attack/damage bonus, one step per `stepPercent`-sized
   * band of HP this enemy has already lost — recomputed fresh every phase
   * (never a persisted status), same "live, not stored" treatment
   * `auraBonusFor` already established for captains.
   */
  private static enrageBonusFor(enemy: Enemy): { attackBonus: number; damageBonus: number } {
    const cfg = enemy.def.enrage;
    if (!cfg) return { attackBonus: 0, damageBonus: 0 };
    const missingPercent = 100 - (enemy.health / enemy.def.maxHealth) * 100;
    const steps = Math.floor(missingPercent / cfg.stepPercent);
    return {
      attackBonus: steps * (cfg.attackBonusPerStep ?? 0),
      damageBonus: steps * (cfg.damageBonusPerStep ?? 0),
    };
  }

  /**
   * Lifedrinker's self-heal and the generic `inflictsStatusOnHit` hook
   * (Healer/Debuffer hybrid, Anti-caster), both resolved right after a
   * landed single-target OR AoE hit against a hero — shared by both attack
   * branches in `tickEnemyPhase` so neither mechanic needs its own copy.
   */
  private applyOnHitHeroEffects(
    enemy: Enemy,
    target: Combatant,
    result: AttackResult,
    lifedrinks: LifedrinkEvent[],
  ): void {
    if (result.roll?.hit !== true) return;
    if (enemy.def.lifedrinkPercent && !enemy.isSwarm && result.damageDealt > 0) {
      const heal = Math.floor((result.damageDealt * enemy.def.lifedrinkPercent) / 100);
      if (heal > 0) {
        enemy.health = Math.min(enemy.def.maxHealth, enemy.health + heal);
        lifedrinks.push({ enemy, healed: heal });
      }
    }
    if (enemy.def.inflictsStatusOnHit) {
      target.applyStatus?.(enemy.def.inflictsStatusOnHit.id, enemy.def.inflictsStatusOnHit.durationTurns);
    }
  }

  /**
   * Teleporter: jump straight toward the nearest exit, ignoring walls and
   * hero-blocking (but never landing on another living, non-swarm enemy's
   * tile — `isOccupiedByOtherEnemy` still applies) and the normal
   * movement-tile limit. Returns null if there's simply nowhere to go (at
   * an exit already, or fully boxed in by other enemies).
   */
  private tryTeleport(enemy: Enemy): TeleportEvent | null {
    if (this.isExit(enemy.position)) return null;
    const route = this.pathfinding.routeToNearestGoal({
      start: enemy.position,
      goals: this.exits,
      ignoreWalls: true,
    });
    if (!route || route.length === 0) return null;
    let steps = WaveSystem.affordablePrefixLength(route, TELEPORT_JUMP_TILES);
    while (steps > 0 && this.isOccupiedByOtherEnemy(route[steps - 1], enemy)) steps -= 1;
    if (steps === 0) return null;
    const from = { ...enemy.position };
    const walked: GridPosition[] = route.slice(0, steps).map((p) => ({ x: p.x, y: p.y })); // D-141: strip `distanceFeet`
    enemy.position = { ...walked[walked.length - 1] };
    if (this.isExit(enemy.position) && !enemy.breached) {
      enemy.breached = true;
      this.integrityValue = Math.max(0, this.integrityValue - enemy.breachDamage);
    }
    return { enemy, from, to: { ...enemy.position } };
  }

  /**
   * Splitter/Carrier + Explosive: resolve every defeated enemy's
   * `onDeathSpawns`/`onDeathExplode`. Deliberately separate from
   * `tickEnemyPhase` — a death can happen from a HERO's own attack
   * (resolved in `BattleScene`), so the caller invokes this right where it
   * already calls `removeDefeated()`, in either phase.
   */
  resolveDeathTriggers(defeated: ReadonlyArray<Enemy>, heroTargets: ReadonlyArray<Combatant>): DeathTriggerReport {
    const spawned: Enemy[] = [];
    const deathSpawns: DeathSpawnEvent[] = [];
    const explosions: ExplosionEvent[] = [];
    for (const enemy of defeated) {
      if (enemy.def.onDeathSpawns) {
        const cfg = enemy.def.onDeathSpawns;
        const spawnedNow = this.trySpawnAt(enemy.position, cfg.enemyId, cfg.count, heroTargets);
        if (spawnedNow.length > 0) {
          deathSpawns.push({ source: enemy, spawned: spawnedNow });
          spawned.push(...spawnedNow);
        }
      }
      if (enemy.def.onDeathExplode) {
        const cfg = enemy.def.onDeathExplode;
        const profile: AttackProfile = { rangeTiles: cfg.radiusTiles, damage: cfg.damage, attackBonus: 0, autoHit: true };
        const results = CombatSystem.attackArea(enemy.position, heroTargets, profile, this.random);
        if (results.length > 0) {
          const hits = results.map((result) => ({
            target: heroTargets.find((h) => h.id === result.targetId)!,
            result,
          }));
          explosions.push({ source: enemy, hits });
        }
      }
    }
    return { spawned, deathSpawns, explosions };
  }

  /**
   * Spawn up to `count` of `enemyId` on free tiles orthogonally adjacent to
   * `center` (map-walkable, not occupied by another living non-swarm enemy,
   * and not standing on a living hero). Shares its adjacency shape with
   * `trySpawnReinforcements` but isn't the same method — this one has no
   * `EnemyPhaseContext` to consult (it runs outside the enemy phase, from
   * `resolveDeathTriggers`), so it checks hero occupancy directly instead of
   * via `context.isBlocked`.
   */
  private trySpawnAt(
    center: GridPosition,
    enemyId: string,
    count: number,
    heroTargets: ReadonlyArray<Combatant>,
  ): Enemy[] {
    const deltas: GridPosition[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    const def = getEnemyDefinition(enemyId);
    const spawned: Enemy[] = [];
    for (const d of deltas) {
      if (spawned.length >= count) break;
      const pos = { x: center.x + d.x, y: center.y + d.y };
      if (!this.map.isWalkable(pos)) continue;
      if (this.isOccupiedByAnyEnemy(pos)) continue;
      if (heroTargets.some((h) => CombatSystem.isAlive(h) && h.position.x === pos.x && h.position.y === pos.y)) continue;
      const spawnedEnemy = new Enemy(`${def.id}#${this.nextInstance++}`, def, pos);
      this.active.push(spawnedEnemy);
      spawned.push(spawnedEnemy);
    }
    return spawned;
  }

  // ----- Phase 12.1 (D-101): full state snapshot/restore ------------------

  /** A plain-data copy of this run's current wave/enemy/integrity progress. See `WaveStateSnapshot`. */
  toSnapshot(): WaveStateSnapshot {
    return {
      integrity: this.integrityValue,
      waveIndex: this.waveIndex,
      waveTurn: this.waveTurn,
      active: this.active.map((e) => e.toSnapshot()),
      spawnedCounts: [...this.spawnedCounts.entries()],
      pendingRetry: [...this.pendingRetry],
      nextInstance: this.nextInstance,
    };
  }

  /**
   * Bulk-restore this (freshly constructed, wave-0) `WaveSystem`'s run
   * progress from a snapshot — same "restore trusts saved state, no
   * re-validation" convention as `BuildSystem.restoreFrom`.
   */
  restoreFrom(snapshot: WaveStateSnapshot): void {
    this.integrityValue = snapshot.integrity;
    this.waveIndex = snapshot.waveIndex;
    this.waveTurn = snapshot.waveTurn;
    this.active = snapshot.active.map((e) => Enemy.fromSnapshot(e));
    this.spawnedCounts = new Map(snapshot.spawnedCounts);
    this.pendingRetry = new Set(snapshot.pendingRetry);
    this.nextInstance = snapshot.nextInstance;
  }
}
