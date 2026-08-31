import type { GameMap } from "./GameMap";
import type { PathfindingSystem } from "./PathfindingSystem";
import { RandomService } from "./RandomService";
import { TurnSystem, type GamePhase } from "./TurnSystem";
import { EconomySystem } from "./EconomySystem";
import { WaveSystem, type WaveStateSnapshot } from "./WaveSystem";
import { BuildSystem, type BuildStateSnapshot } from "./BuildSystem";
import { RestSystem } from "./RestSystem";
import { Hero, type HeroSnapshot } from "../entities/Hero";
import type { WaveDefinition } from "../data/waves";

/**
 * BattleStateSnapshot — Phase 12.1 (D-101), the first sub-phase of
 * `PHASE_12_MULTIPLAYER_FEASIBILITY.md`'s proposed roadmap. Pure, no Phaser,
 * no networking — the "unglamorous prerequisite" that design doc named as
 * the single biggest unscoped unknown in the whole feasibility analysis.
 *
 * A live battle's mutable state is spread across several pure system
 * instances (`TurnSystem`/`EconomySystem`/`Hero`/`WaveSystem`/`BuildSystem`/
 * `RestSystem`) that `BattleScene` owns and mutates directly. None of them
 * were ever designed to be captured and rebuilt elsewhere — `SaveSystem`
 * (Phase 9, D-083) deliberately only saves PARTY BUILDS between runs, never
 * live battle state (see its own module doc). This file is the missing
 * piece: `captureBattleState` copies everything a live battle needs into
 * plain, JSON-serializable data; `restoreBattleState` rebuilds working
 * system instances from that data plus the static per-battle CONFIG
 * (map/pathfinding/wave list/difficulty multipliers/a `RandomService`) the
 * caller already has from however it originally started the battle.
 *
 * Deliberately excluded from the snapshot, and why:
 * - The map, wave list, and difficulty multipliers — static SETUP, not
 *   per-run state. A caller reconstructing a battle already knows which
 *   map/campaign/difficulty it is (the same data `BattleScene.init` already
 *   receives), so re-deriving these here would just be a second, riskier
 *   source of truth for the same facts.
 * - `RandomService`'s own internal PRNG stream. Per the design doc's §3
 *   finding, a multiplayer sync should broadcast combat RESULTS rather than
 *   have a second client replay the same roll sequence, so nothing here
 *   ever needs to reproduce a past dice stream bit-for-bit — a restored
 *   battle just needs a WORKING RandomService going forward, not an
 *   identical one.
 *
 * This module has no networking code and doesn't know Firestore exists —
 * per the design doc's 12.2/12.3, a future `CoopSessionSync.ts` would call
 * `captureBattleState`/`restoreBattleState` as its own IO boundary.
 */

export interface BattleStateSnapshot {
  phaseHistory: GamePhase[];
  /** D-208: one balance per economy pool owner (`SOLO_ECONOMY_OWNER` outside a coop session, a participant uid inside one) — see `EconomySystem`'s own header comment. */
  gold: Record<string, number>;
  heroes: HeroSnapshot[];
  wave: WaveStateSnapshot;
  structures: BuildStateSnapshot;
  shortRestsRemaining: number;
  longRestsRemaining: number;
  wavesCleared: number;
}

/** Every live pure-system instance a battle in progress needs. */
export interface LiveBattleState {
  turns: TurnSystem;
  economy: EconomySystem;
  heroes: Hero[];
  waveSystem: WaveSystem;
  buildSystem: BuildSystem;
  restSystem: RestSystem;
  wavesCleared: number;
}

/** The static per-battle setup `restoreBattleState` needs alongside a snapshot — see this file's header comment. */
export interface BattleStateRestoreConfig {
  map: GameMap;
  pathfinding: PathfindingSystem;
  waves: WaveDefinition[];
  enemyCountMultiplier?: number;
  enemyHpMultiplier?: number;
  random: RandomService;
}

/** Copy every live system's current state into plain, serializable data. */
export function captureBattleState(state: LiveBattleState): BattleStateSnapshot {
  return {
    phaseHistory: [...state.turns.history],
    gold: state.economy.goldByOwner(),
    heroes: state.heroes.map((hero) => hero.toSnapshot()),
    wave: state.waveSystem.toSnapshot(),
    structures: state.buildSystem.toSnapshot(),
    shortRestsRemaining: state.restSystem.shortRestsRemaining,
    longRestsRemaining: state.restSystem.longRestsRemaining,
    wavesCleared: state.wavesCleared,
  };
}

/** Rebuild every live system instance a battle needs from a snapshot plus its static config. */
export function restoreBattleState(
  snapshot: BattleStateSnapshot,
  config: BattleStateRestoreConfig,
): LiveBattleState {
  const turns = TurnSystem.fromHistory(snapshot.phaseHistory);
  const economy = new EconomySystem(snapshot.gold);
  const heroes = snapshot.heroes.map((heroSnapshot) => Hero.fromSnapshot(heroSnapshot));

  const waveSystem = new WaveSystem(config.map, config.pathfinding, config.waves, {
    startingIntegrity: snapshot.wave.integrity,
    enemyCountMultiplier: config.enemyCountMultiplier,
    enemyHpMultiplier: config.enemyHpMultiplier,
    random: config.random,
  });
  waveSystem.restoreFrom(snapshot.wave);

  const buildSystem = new BuildSystem(config.map, config.pathfinding);
  buildSystem.restoreFrom(snapshot.structures);

  const restSystem = new RestSystem({
    shortRestCharges: snapshot.shortRestsRemaining,
    longRestCharges: snapshot.longRestsRemaining,
  });

  return { turns, economy, heroes, waveSystem, buildSystem, restSystem, wavesCleared: snapshot.wavesCleared };
}
