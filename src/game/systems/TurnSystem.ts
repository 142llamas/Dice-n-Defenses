/**
 * TurnSystem: the game's phase state machine. Pure, no Phaser.
 *
 * The Source of Truth requires an "explicit phase state machine: the game must
 * know whether it is in preparation, player action, enemy action, resolution,
 * between-wave, victory, or defeat." This class is that machine. It enforces
 * the two Phase 2 acceptance criteria that concern turns:
 *   - phase changes happen ONCE per transition (onChange fires exactly once),
 *   - phase changes happen in the CORRECT order (illegal transitions are
 *     rejected and leave the state unchanged).
 *
 * The normal wave loop is:
 *   preparation -> player -> enemy -> resolution -> betweenWave -> player -> ...
 * with victory and defeat as terminal outcomes that resolution or betweenWave
 * may enter. In Phase 2 there is no combat or waves yet, so the enemy,
 * resolution, and betweenWave phases are pass-through: the scene advances the
 * machine to prove the ordering works. Real content fills them in later phases.
 */

export type GamePhase =
  | "preparation"
  | "player"
  | "enemy"
  | "resolution"
  | "betweenWave"
  | "victory"
  | "defeat";

/** Human-readable labels for the on-screen phase banner. */
export const PHASE_LABELS: Record<GamePhase, string> = {
  preparation: "Preparation",
  player: "Player Phase",
  enemy: "Enemy Phase",
  resolution: "Resolution",
  betweenWave: "Between Waves",
  victory: "Victory",
  defeat: "Defeat",
};

/** Every legal transition. Anything not listed here is rejected. */
const ALLOWED: Record<GamePhase, ReadonlyArray<GamePhase>> = {
  preparation: ["player"],
  // player -> enemy is the normal End Turn path. player -> betweenWave/victory
  // is an early-finish shortcut: if a hero's own action clears the wave (no
  // more enemies due to spawn, none left alive), there is nothing left for an
  // Enemy Phase to resolve, so the scene may skip straight there instead of
  // making the player click End Turn on an empty field. Defeat is not listed
  // here because nothing in the player phase can reduce Stronghold Integrity
  // (only a breach can, and breaches only happen in the enemy phase).
  player: ["enemy", "betweenWave", "victory"],
  enemy: ["resolution"],
  // resolution -> player continues the SAME wave (waves span several turns);
  // resolution -> betweenWave when the wave is complete; or a terminal outcome.
  resolution: ["player", "betweenWave", "victory", "defeat"],
  betweenWave: ["player", "victory", "defeat"],
  victory: [],
  defeat: [],
};

/** The single "natural next" phase used by advance() for the normal loop. */
const NORMAL_NEXT: Partial<Record<GamePhase, GamePhase>> = {
  preparation: "player",
  player: "enemy",
  enemy: "resolution",
  resolution: "betweenWave",
  betweenWave: "player",
};

export class TurnSystem {
  private phase: GamePhase = "preparation";
  private count = 0;
  private log: GamePhase[] = ["preparation"];

  /**
   * Called exactly once each time the phase actually changes, with the new and
   * previous phase. The scene uses this to update the banner and reset heroes.
   */
  onChange?: (next: GamePhase, previous: GamePhase) => void;

  /** The phase the game is currently in. */
  get current(): GamePhase {
    return this.phase;
  }

  /** How many phase changes have happened (useful for tests and debugging). */
  get transitionCount(): number {
    return this.count;
  }

  /** The ordered history of phases entered, starting with "preparation". */
  get history(): ReadonlyArray<GamePhase> {
    return this.log;
  }

  /** True when the game has reached a terminal phase (victory or defeat). */
  isTerminal(): boolean {
    return ALLOWED[this.phase].length === 0;
  }

  /** True if moving to `next` from the current phase is a legal transition. */
  canTransitionTo(next: GamePhase): boolean {
    return ALLOWED[this.phase].includes(next);
  }

  /**
   * Attempt an explicit transition. Returns true and fires onChange once when
   * the transition is legal; returns false and changes nothing when it is not.
   */
  transitionTo(next: GamePhase): boolean {
    if (!this.canTransitionTo(next)) return false;
    const previous = this.phase;
    this.phase = next;
    this.count += 1;
    this.log.push(next);
    this.onChange?.(next, previous);
    return true;
  }

  /**
   * Advance to the natural next phase in the normal wave loop. Returns the new
   * phase, or null if the current phase has no natural next (victory/defeat).
   */
  advance(): GamePhase | null {
    const next = NORMAL_NEXT[this.phase];
    if (!next) return null;
    return this.transitionTo(next) ? next : null;
  }

  /** Reset the machine to the start of a fresh game. */
  reset(): void {
    this.phase = "preparation";
    this.count = 0;
    this.log = ["preparation"];
  }

  /**
   * Phase 12.1 (D-101): reconstruct a `TurnSystem` at the exact phase/history
   * `history` describes, for `BattleStateSnapshot` — replays every
   * transition after the initial "preparation" through the normal
   * `transitionTo` (so the same legality guard a live game always went
   * through still runs), rather than adding a second, parallel way to set
   * `phase` directly.
   */
  static fromHistory(history: ReadonlyArray<GamePhase>): TurnSystem {
    const turns = new TurnSystem();
    for (const phase of history.slice(1)) {
      turns.transitionTo(phase);
    }
    return turns;
  }
}
