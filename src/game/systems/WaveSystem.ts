import type { GridPosition } from "./GridSystem";
import { GameMap } from "./GameMap";
import { PathfindingSystem } from "./PathfindingSystem";
import {
  CombatSystem,
  type Combatant,
  type AttackResult,
  type AttackProfile,
} from "./CombatSystem";
import { RandomService, type AdvantageMode } from "./RandomService";
import { SavingThrowSystem } from "./SavingThrowSystem";
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
    return this.integrityValue <= 0;
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
    this.active = [];
  }

  /** Move on to the next wave. Caller should check isLastWave() first. */
  advanceToNextWave(): void {
    this.startWave(this.waveIndex + 1);
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
      // over a hero.
      if (enemy.def.siegeDamageMultiplier && context.wallHpAt && context.damageWall) {
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

      // Phase 20 (D-111): an AoE/breath attacker hits EVERY hero in its
      // range at once instead of picking one via chooseTarget. Combined
      // with a saving-throw DC, each hero in range rolls its own save
      // instead of the enemy rolling once to hit.
      if (canEngageHeroes && enemy.def.aoeAttack) {
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
          enemy.tickStatuses();
          continue;
        }
      }

      // Prefer to attack: if a living hero is within reach, strike it and hold.
      const target = canEngageHeroes
        ? CombatSystem.chooseTarget(enemy.position, enemy.attackRangeTiles, heroTargets)
        : null;
      if (target) {
        // Phase 13.10: an enemy like Blightcaller forces a saving throw
        // instead of rolling to hit — see `resolveSavingThrowAttack`'s own
        // comment for why this still produces a normal `AttackResult`.
        // Phase 16 (D-106)/17 (D-108)/20 (D-111): an enemy under "blinded",
        // "sapped", or "toppled" rolls its own attack with disadvantage
        // (see `Enemy.attacksWithDisadvantage`); a still-hidden stealth
        // enemy's ambush overrides that with Advantage instead (see
        // `advantage`, computed above).
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
                advantage,
              },
              this.random,
            );
        attacks.push({ enemy, target, result });
        this.applyOnHitHeroEffects(enemy, target, result, lifedrinks);
        if (wasHidden) enemy.reveal();
        enemy.tickStatuses();
        continue; // an attacking enemy does not also move this phase
      }

      // Otherwise advance toward the exit, routing around walls and blockers.
      // D-067: an enemy may walk THROUGH another living enemy's current tile
      // (so a queue doesn't force a long detour) but may never END its move
      // there — advanceEnemy() backs off to the nearest earlier tile on its
      // route that isn't occupied. The exit tile itself is always enterable
      // regardless (PathfindingSystem's rule), so enemies still queue through
      // it cleanly rather than getting stuck right at the goal. Movement uses
      // `effectiveMovementTiles`, which a "slowed" status quietly reduces.
      const from = { ...enemy.position };
      const flying = enemy.def.movementType === "flying";
      const isBlocked = (pos: GridPosition): boolean => {
        // A flyer ignores walls: a tile blocked ONLY because it is a placed
        // wall does not stop it, but a tile blocked for another reason (a hero)
        // still does.
        if (flying && context.isWall?.(pos)) return false;
        return context.isBlocked?.(pos) ?? false;
      };
      const walked = this.advanceEnemy(enemy, isBlocked, flying, aura.movementBonus);

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

      moves.push({ enemy, from, path: walked, to: { ...enemy.position } });

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
      const def: EnemyDefinition =
        this.enemyHpMultiplier === 1
          ? baseDef
          : { ...baseDef, maxHealth: Math.max(1, Math.round(baseDef.maxHealth * this.enemyHpMultiplier)) };
      const enemy = new Enemy(`${def.id}#${this.nextInstance++}`, def, spawnPos);
      this.active.push(enemy);
      spawned.push(enemy);
      this.spawnedCounts.set(i, already + 1);
    });
    return spawned;
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
   */
  private advanceEnemy(
    enemy: Enemy,
    isBlocked?: (pos: GridPosition) => boolean,
    ignoreWalls = false,
    movementBonus = 0,
  ): GridPosition[] {
    if (this.isExit(enemy.position)) return [];
    const route = this.pathfinding.routeToNearestGoal({
      start: enemy.position,
      goals: this.exits,
      isBlocked,
      ignoreWalls,
    });
    if (!route || route.length === 0) return [];
    let steps = Math.min(enemy.effectiveMovementTiles + movementBonus, route.length);
    // Phase 7: a fully "slowed" enemy can have 0 effective movement this
    // phase. Guard this the same way as "no route" — no steps means no walk,
    // and position must NOT be touched (spreading an empty walked[-1] would
    // silently corrupt it to `{}`).
    while (steps > 0 && this.isOccupiedByOtherEnemy(route[steps - 1], enemy)) {
      steps -= 1;
    }
    if (steps === 0) return [];
    const walked = route.slice(0, steps);
    enemy.position = { ...walked[walked.length - 1] };
    return walked;
  }

  private isExit(pos: GridPosition): boolean {
    return this.exits.some((e) => e.x === pos.x && e.y === pos.y);
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
    let steps = Math.min(TELEPORT_JUMP_TILES, route.length);
    while (steps > 0 && this.isOccupiedByOtherEnemy(route[steps - 1], enemy)) steps -= 1;
    if (steps === 0) return null;
    const from = { ...enemy.position };
    const walked = route.slice(0, steps);
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
