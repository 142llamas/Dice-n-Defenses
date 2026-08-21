import type { GridPosition } from "../systems/GridSystem";
import { getEnemyDefinition, type EnemyDefinition } from "../data/enemies";
import type { DamageType } from "../data/weapons";
import type { Combatant } from "../systems/CombatSystem";
import {
  getStatusEffectDefinition,
  type ActiveStatus,
  type StatusEffectId,
} from "../data/statusEffects";
import type { DeathCause } from "../systems/VisualFxSystem";

/**
 * Phase 21 (D-112): the Swarm archetype's real SRD condition immunities
 * (verified against two independent sources — see DECISIONS D-112), mapped
 * onto this game's actual status ids. The real SRD list also includes
 * frightened/grappled/paralyzed/petrified/prone, none of which this game
 * models as a distinct status; "toppled" is this project's own Prone
 * stand-in (see data/statusEffects.ts), so it's included here instead.
 */
const SWARM_IMMUNE_STATUSES: ReadonlySet<StatusEffectId> = new Set<StatusEffectId>([
  "charmed",
  "restrained",
  "stunned",
  "toppled",
]);

/**
 * Enemy AI/Movement Redesign §2 (D-140): the default Aggressiveness (0-100)
 * for an enemy definition with no explicit `def.aggressiveness` override —
 * derived from tags this roster already carries rather than a value hand-set
 * on all ~63 entries. Objective-focused archetypes (siege/trapSense/pure
 * runners) default low — they were never going to seek a fight, per §3 of
 * the redesign spec. Bosses/legendaries default low so they race the clock
 * per §1's whole point, unless they're ALSO one of the hunter-flavored tags
 * below (checked first, so a rare enrage-boss still reads as a hunter).
 * Berserker (`enrage`)/Lifedrinker (`lifedrinkPercent`)/stealth-ambush
 * archetypes default high — they're explicitly meant to seek a fight. Every
 * other enemy (the ordinary minion majority) gets a middling default.
 */
function defaultAggressiveness(def: EnemyDefinition): number {
  if (def.enrage || def.lifedrinkPercent || def.stealth) return 85;
  if (def.ignoresHeroes) return 0;
  if (def.trapSense || def.siegeDamageMultiplier) return 10;
  if (def.role === "boss" || def.role === "legendary") return 15;
  if (def.role === "miniboss") return 40;
  return 55;
}

/**
 * Phase 12.1 (D-101): a plain-data copy of one live `Enemy` instance, for
 * `BattleStateSnapshot`. Deliberately stores `defId` (looked up via
 * `getEnemyDefinition` on restore) rather than the whole `EnemyDefinition`
 * object — the definition is static content, not per-instance state.
 */
/** Phase 21 (D-112): the Multi-Phase Boss archetype's per-instance mechanic override — see `Enemy.activeDef`. */
export type EnemyPhaseOverride = Partial<
  Pick<EnemyDefinition, "attackDamage" | "attackBonus" | "armorClass" | "movementTiles" | "aoeAttack" | "callsReinforcements" | "savingThrowAttackDC">
>;

export interface EnemySnapshot {
  instanceId: string;
  defId: string;
  position: GridPosition;
  health: number;
  breached: boolean;
  activeStatuses: ActiveStatus[];
  /** Phase 20 (D-111): whether a stealthed enemy has broken cover yet. Phase 21 (D-112): also used by a Mimic's proximity reveal — same "has broken cover" boolean, a different trigger. */
  revealed: boolean;
  /** Phase 21 (D-112): the Shielded archetype's remaining damage-absorbing ward. 0 for an enemy with no `def.damageShieldHp`. */
  shieldHp: number;
  /** Phase 21 (D-112): the Multi-Phase Boss archetype's active override, if it has crossed its HP threshold. Null otherwise. */
  phaseOverride: EnemyPhaseOverride | null;
}

/**
 * Enemy: a pure, Phaser-free model of one enemy instance on the board.
 *
 * Like Hero, this holds state only — no rendering. Movement and breach logic
 * live in WaveSystem/PathfindingSystem, and damage arithmetic lives in
 * CombatSystem; this class just remembers where the enemy is, how hurt it is,
 * and whether it has already breached the exit (so breach damage is applied
 * exactly once).
 *
 * Phase 4: Enemy implements the small `Combatant` shape (id/position/health/
 * armorClass) so heroes can target it and CombatSystem can resolve damage
 * against it. An enemy at 0 HP is defeated and removed exactly once.
 *
 * Phase 13.1 (D-086): real dice replace deterministic combat. `defense` is
 * replaced by `armorClass` (a hero's attack roll must meet or beat it to
 * hit), and this enemy's own `attackBonus` is its to-hit bonus against a
 * hero's Armor Class.
 *
 * Phase 13.5 (D-090): `savingThrowBonus` is a flat bonus this enemy rolls
 * against a save-based effect (e.g. the Cleric's Sacred Flame) — one number
 * reused for any save it's ever asked to make, since enemies have no
 * per-ability scores to derive a specific one from.
 *
 * Phase 7 (status effects): an enemy may carry a small set of active effects
 * (see data/statusEffects.ts) applied by a hero ability or a trap. Effects are
 * looked up by id so this class holds no rules of its own — WaveSystem decides
 * WHEN to apply burn damage or skip a stunned enemy's turn; this class only
 * stores which effects are active and how long they have left.
 *
 * Phase 20 (D-111): a `def.stealth` enemy tracks whether it has ever been
 * revealed. `WaveSystem` decides WHEN that happens (its first strike) and
 * `BattleScene` decides what it means for hero targeting
 * (`isEnemyTargetable`) — this class only remembers the fact.
 */
export class Enemy implements Combatant {
  /** Unique per-instance id, e.g. "grunt#3". Distinct from the definition id. */
  readonly instanceId: string;
  readonly def: EnemyDefinition;

  position: GridPosition;
  health: number;
  /** True once this enemy has reached an exit and dealt its breach damage. */
  breached = false;
  /**
   * D-122: a same-tick rendering hint only — set by `BattleScene` right
   * before it deals damage from a spell/status whose cause differs from the
   * "physical" default, read once if this hit is lethal to pick the death
   * animation, then irrelevant. Never persisted in `EnemySnapshot` — it has
   * no meaning outside the instant of the kill that set it.
   */
  lastDeathCause?: DeathCause;
  private activeStatuses: ActiveStatus[] = [];
  private revealed = false;
  /** Phase 21 (D-112): the Shielded archetype's remaining ward — see `absorbDamage`. */
  private shieldHp: number;
  /** Phase 21 (D-112): the Multi-Phase Boss archetype's active override, once its HP threshold is crossed — see `activeDef`. */
  private phaseOverride: EnemyPhaseOverride | null = null;
  /**
   * Enemy AI/Movement Redesign, self-defense (D-146): set by
   * `BattleScene.showHeroHit` the instant a hero's attack lands on this
   * enemy, and consumed by `WaveSystem.tickEnemyPhase` the moment this
   * enemy's own turn comes around — a genuinely TEMPORARY, one-phase aggro
   * spike, never a persisted grudge. Deliberately NOT part of
   * `EnemySnapshot`/`WaveStateSnapshot`, same documented imprecision as
   * `WaveSystem`'s other per-instance timers (a restored battle just starts
   * every enemy un-provoked).
   */
  private provoked = false;

  constructor(instanceId: string, def: EnemyDefinition, spawn: GridPosition) {
    this.instanceId = instanceId;
    this.def = def;
    this.position = { ...spawn };
    this.health = def.maxHealth;
    this.shieldHp = def.damageShieldHp ?? 0;
  }

  /**
   * Phase 21 (D-112): this enemy's definition, overlaid with its Multi-Phase
   * Boss override once one has been entered (`enterNextPhase`). Every
   * behavior-affecting getter below (`armorClass`, `attackBonus`,
   * `attackDamage`, `movementTiles`, `attackRangeTiles`) reads through this
   * instead of `def` directly, so a phase-change override needs no other
   * call-site changes anywhere in `WaveSystem`/`BattleScene` — the same
   * "generic getter, no new call sites" convention `armorClass`'s own status
   * folding already established. A non-boss enemy (no `phaseOverride` ever
   * set) always gets back `def` unchanged.
   */
  get activeDef(): EnemyDefinition {
    return this.phaseOverride ? { ...this.def, ...this.phaseOverride } : this.def;
  }

  /** True once this Multi-Phase Boss has crossed its `def.phaseChange.hpPercent` threshold. Always false otherwise. */
  get hasEnteredNextPhase(): boolean {
    return this.phaseOverride !== null;
  }

  /** Enter this Multi-Phase Boss's next mechanic set. Idempotent-by-caller: `WaveSystem` only calls this once, on the crossing phase. */
  enterNextPhase(overrides: EnemyPhaseOverride): void {
    this.phaseOverride = overrides;
  }

  /** Combatant id: the per-instance id, so each enemy on the field is distinct. */
  get id(): string {
    return this.instanceId;
  }

  /**
   * Combatant Armor Class: this enemy type's fixed AC, lowered by any active
   * "exposed"-style status (Phase 16, D-106) — folded in here rather than at
   * each call site so every existing attack path (hero abilities, CombatSystem,
   * traps) automatically respects it with zero other changes.
   */
  get armorClass(): number {
    let delta = 0;
    for (const s of this.activeStatuses) {
      delta += getStatusEffectDefinition(s.id).armorClassDelta ?? 0;
    }
    return this.activeDef.armorClass + delta;
  }

  /**
   * True while ANY active status imposes disadvantage on this enemy's own
   * attack roll ("blinded", and Phase 17/D-108's "sapped"/"toppled" weapon-
   * mastery statuses) — generic over `StatusEffectDefinition
   * .attackRollDisadvantage` the same way `armorClass` above generalizes
   * over `armorClassDelta`, so a future disadvantage-imposing status needs
   * no new call site in `WaveSystem`.
   */
  get attacksWithDisadvantage(): boolean {
    return this.activeStatuses.some((s) => getStatusEffectDefinition(s.id).attackRollDisadvantage);
  }

  /** This enemy's basic-attack to-hit bonus. */
  get attackBonus(): number {
    return this.activeDef.attackBonus;
  }

  /** Phase 13.5 (D-090): this enemy's flat bonus on any saving throw it's asked to make. */
  get savingThrowBonus(): number {
    return this.def.savingThrowBonus;
  }

  get movementTiles(): number {
    return this.activeDef.movementTiles;
  }

  /** Enemy AI/Movement Redesign §2 (D-140): this enemy's detour-tolerance stat — see `defaultAggressiveness` for the fallback when `def.aggressiveness` is absent. */
  get aggressiveness(): number {
    return this.activeDef.aggressiveness ?? defaultAggressiveness(this.activeDef);
  }

  /** Enemy AI/Movement Redesign step 5 (D-143): true doubles this enemy's movement budget on a phase it doesn't attack — see `EnemyDefinition.sprints`'s own comment. Absent (default) means false, unchanged from every enemy before this decision. */
  get sprints(): boolean {
    return this.activeDef.sprints ?? false;
  }

  /** Enemy AI/Movement Redesign §3 (D-145): which siege wall-targeting behavior this enemy uses once no wall is already in its own attack range — see `EnemyDefinition.siegeTargeting`'s own comment. Absent defaults to `"reassessing"`. */
  get siegeTargeting(): "committed" | "reassessing" {
    return this.activeDef.siegeTargeting ?? "reassessing";
  }

  /**
   * Movement tiles after status reductions (e.g. "slowed"), never below 0.
   * WaveSystem uses this instead of `movementTiles` when advancing an enemy,
   * so an un-statused enemy moves exactly as before this field existed.
   */
  get effectiveMovementTiles(): number {
    let reduction = 0;
    for (const s of this.activeStatuses) {
      reduction += getStatusEffectDefinition(s.id).movementReduction ?? 0;
    }
    return Math.max(0, this.activeDef.movementTiles - reduction);
  }

  /**
   * Phase 21 (D-112): true for a `def.swarm` enemy (the Swarm archetype).
   * Verified against the real SRD 5.2.1/2024 "Swarm" trait (two independent
   * sources): a swarm may occupy another creature's space and vice versa
   * (see `WaveSystem`'s swarm-aware occupancy checks), is immune to a fixed
   * set of conditions (`SWARM_IMMUNE_STATUSES` below), can't regain HP (see
   * `Lifedrinker`/`Healer` archetypes' own skip-if-swarm checks), and deals
   * half damage once Bloodied (see `attackDamage` below). The trait's
   * bludgeoning/piercing/slashing damage resistance is modeled separately —
   * see `damageResistances` below (D-127).
   */
  get isSwarm(): boolean {
    return this.def.swarm === true;
  }

  /** D-127: this enemy's nonmagical damage-type resistance, if any — see `data/enemies.ts`'s `damageResistances` field and `CombatSystem.applyAttack`. */
  get damageResistances(): DamageType[] | undefined {
    return this.activeDef.damageResistances;
  }

  /** D-131: this enemy's damage-type vulnerability, if any — see `data/enemies.ts`'s `damageVulnerabilities` field and `CombatSystem.applyResistance`. */
  get damageVulnerabilities(): DamageType[] | undefined {
    return this.activeDef.damageVulnerabilities;
  }

  /** D-131: this enemy's damage-type immunity, if any — see `data/enemies.ts`'s `damageImmunities` field and `CombatSystem.applyResistance`. */
  get damageImmunities(): DamageType[] | undefined {
    return this.activeDef.damageImmunities;
  }

  /** True once this enemy is at half its BASE max HP or fewer ("Bloodied", the real SRD term). */
  get isBloodied(): boolean {
    return this.health <= this.def.maxHealth / 2;
  }

  /**
   * This enemy's basic-attack damage (before the target's Armor Class/any
   * shield). A Bloodied Swarm deals half damage — the real SRD swarm rule,
   * folded in here (rather than at each call site) so every existing attack
   * path respects it with zero other changes, the same convention
   * `armorClass`/`attackBonus`/`movementTiles` already established for their
   * own modifiers.
   */
  get attackDamage(): number {
    const base = this.activeDef.attackDamage;
    return this.isSwarm && this.isBloodied ? Math.floor(base / 2) : base;
  }

  /** Apply (or refresh, to the longer duration) a status effect on this enemy. A Swarm is immune to a fixed set of conditions (see `SWARM_IMMUNE_STATUSES`) — applying one of those to a swarm is silently a no-op, same as the real SRD trait. */
  applyStatus(id: StatusEffectId, durationTurns: number): void {
    if (this.isSwarm && SWARM_IMMUNE_STATUSES.has(id)) return;
    const existing = this.activeStatuses.find((s) => s.id === id);
    if (existing) existing.remainingTurns = Math.max(existing.remainingTurns, durationTurns);
    else this.activeStatuses.push({ id, remainingTurns: durationTurns });
  }

  hasStatus(id: StatusEffectId): boolean {
    return this.activeStatuses.some((s) => s.id === id);
  }

  /** Test Mode (D-138): remove a status effect early, if present. A no-op otherwise. */
  removeStatus(id: StatusEffectId): void {
    this.activeStatuses = this.activeStatuses.filter((s) => s.id !== id);
  }

  /** Advance every active status by one phase, dropping any that expire. */
  tickStatuses(): void {
    this.activeStatuses = this.activeStatuses.filter((s) => --s.remainingTurns > 0);
  }

  get breachDamage(): number {
    return this.def.breachDamage;
  }

  /** This enemy's basic-attack reach in tiles (Manhattan). */
  get attackRangeTiles(): number {
    return this.activeDef.attackRangeTiles;
  }

  /** True while the enemy still has hit points. */
  isAlive(): boolean {
    return this.health > 0;
  }

  /**
   * Phase 20 (D-111): true once a `def.stealth` enemy has broken cover
   * (its first strike, win or lose). Meaningless for a non-stealth enemy —
   * always false, since nothing ever calls `reveal()` on one.
   */
  get isRevealed(): boolean {
    return this.revealed;
  }

  /** Break this enemy's stealth (or a Mimic's disguise) permanently for the rest of the battle. */
  reveal(): void {
    this.revealed = true;
  }

  /**
   * Enemy AI/Movement Redesign, self-defense (D-146): true if a hero has
   * landed a hit on this enemy since its last own turn. `WaveSystem` reads
   * this to let an enemy that's already within its own attack range of a
   * hero strike back THIS phase instead of whatever unconditional priority
   * action (siege wall, trap disarm, a detour) it would otherwise take —
   * see `WaveSystem.tickEnemyPhase`'s own comment for the full mechanic.
   * `def.ignoresHeroes` enemies (the deliberate "doesn't care about heroes
   * at all" archetype) are exempted by `WaveSystem`, not here.
   */
  get isProvoked(): boolean {
    return this.provoked;
  }

  /** Called by `BattleScene` whenever a hero's attack lands on this enemy. */
  markProvoked(): void {
    this.provoked = true;
  }

  /**
   * Consumed once this enemy's own turn has been resolved, whether or not it
   * actually had a target to retaliate against this phase — a genuinely
   * TEMPORARY spike, not a persisted grudge. An enemy that never reaches its
   * own turn this phase at all (stunned, charmed, killed by a burn tick
   * first) simply carries the flag into its next real turn instead.
   */
  clearProvoked(): void {
    this.provoked = false;
  }

  /** Phase 21 (D-112): this enemy's remaining damage-absorbing ward (the Shielded archetype). 0 if it never had one, or it's been broken through. */
  get shieldHpRemaining(): number {
    return this.shieldHp;
  }

  /**
   * Phase 21 (D-112): `Combatant.absorbDamage` — the Shielded archetype's
   * ward absorbs damage before real HP loss. Called by
   * `CombatSystem.applyAttack` for every hit this enemy takes, hero-inflicted
   * or otherwise. A shieldless enemy (the overwhelming majority) returns the
   * full amount unchanged — this method exists on every `Enemy` but is a
   * no-op unless `def.damageShieldHp` was set.
   */
  absorbDamage(amount: number): number {
    if (this.shieldHp <= 0) return amount;
    const absorbed = Math.min(this.shieldHp, amount);
    this.shieldHp -= absorbed;
    return amount - absorbed;
  }

  /** Phase 12.1 (D-101): every active status and its remaining duration, for `toSnapshot`. */
  get statuses(): ReadonlyArray<ActiveStatus> {
    return this.activeStatuses;
  }

  /** Phase 12.1 (D-101): a plain-data copy of this enemy's current state, for `BattleStateSnapshot`. */
  toSnapshot(): EnemySnapshot {
    return {
      instanceId: this.instanceId,
      defId: this.def.id,
      position: { ...this.position },
      health: this.health,
      breached: this.breached,
      activeStatuses: this.activeStatuses.map((s) => ({ ...s })),
      revealed: this.revealed,
      shieldHp: this.shieldHp,
      phaseOverride: this.phaseOverride ? { ...this.phaseOverride } : null,
    };
  }

  /** Phase 12.1 (D-101): reconstruct an `Enemy` exactly as `toSnapshot` captured it. */
  static fromSnapshot(snapshot: EnemySnapshot): Enemy {
    const enemy = new Enemy(snapshot.instanceId, getEnemyDefinition(snapshot.defId), snapshot.position);
    enemy.health = snapshot.health;
    enemy.breached = snapshot.breached;
    enemy.activeStatuses = snapshot.activeStatuses.map((s) => ({ ...s }));
    enemy.revealed = snapshot.revealed;
    enemy.shieldHp = snapshot.shieldHp;
    enemy.phaseOverride = snapshot.phaseOverride ? { ...snapshot.phaseOverride } : null;
    return enemy;
  }
}
