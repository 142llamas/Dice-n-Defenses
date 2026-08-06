import type { WaveDefinition } from "../data/waves";

/**
 * FreePlayWaveGenerator — Phase 11.9 (D-071): a pure, deterministic wave-list
 * generator for free-play mode's configurable "wave count / minion source /
 * boss" axes.
 *
 * Pure and Phaser-free per this project's architecture rule (game logic lives
 * in `systems/`) — `FreePlayScene` calls this with the player's picks and
 * hands the result straight to `BattleScene` as `freePlayWaves`, the same
 * plain-data `WaveDefinition[]` shape `data/waves.ts`/`data/campaigns.ts`
 * already use.
 *
 * Deterministic BY DESIGN (no `Math.random`/`Date.now`): this project's
 * combat is deliberately diceless (D-030/D-047 addendum), and a deterministic
 * generator stays reproducible and unit-testable the same way every other
 * rule here is. The scheme is intentionally simple, like every other wave
 * list in this project (KI-015's "first pass, untuned" caveat applies here
 * too):
 *   - Each NON-FINALE wave's primary enemy is `minionPool[waveIndex % minionPool.length]`
 *     (round-robin), with `count`/`turnLimit`/`completionGold` scaling up
 *     gently and monotonically as `waveIndex` increases.
 *   - The FINAL wave (`waveIndex === waveCount - 1`) mixes in 2-3 minion-pool
 *     enemies as an escort PLUS exactly one `bossEnemyId` enemy, mirroring
 *     `WAVES`' wave-10 and the 11.8 campaigns' wave-6 finales.
 */

export interface FreePlayWaveOptions {
  /** Any positive integer; the UI restricts this to the Short/Medium/Long presets (4/7/10). */
  waveCount: number;
  /** Enemy ids eligible for non-finale waves (and the finale's escort). */
  minionPool: string[];
  /** The finale enemy id, placed only in the LAST wave. */
  bossEnemyId: string;
}

/** Non-finale wave enemy count at `waveIndex` (0-based): a gentle, monotonic climb. */
function countForWave(waveIndex: number): number {
  return 3 + waveIndex;
}

/** Non-finale wave turn limit at `waveIndex` (0-based): scales with the enemy count above. */
function turnLimitForWave(waveIndex: number): number {
  return 8 + waveIndex;
}

/** Non-finale wave completion gold at `waveIndex` (0-based): scales gently, same curve family. */
function completionGoldForWave(waveIndex: number): number {
  return 10 + waveIndex * 4;
}

/** How many distinct escort enemies (from `minionPool`) the finale wave mixes in. */
function finaleEscortSize(poolSize: number): number {
  return Math.max(1, Math.min(3, poolSize));
}

export function generateFreePlayWaves(options: FreePlayWaveOptions): WaveDefinition[] {
  const { waveCount, minionPool, bossEnemyId } = options;
  const waves: WaveDefinition[] = [];

  for (let waveIndex = 0; waveIndex < waveCount; waveIndex++) {
    const isFinale = waveIndex === waveCount - 1;
    const id = `free-play-wave-${waveIndex + 1}`;
    const turnLimit = turnLimitForWave(waveIndex) + (isFinale ? 4 : 0);
    const completionGold = completionGoldForWave(waveIndex) + (isFinale ? 20 : 0);
    const timeBonusGold = Math.round(completionGold * 0.35);

    if (!isFinale) {
      const enemyId = minionPool[waveIndex % minionPool.length];
      waves.push({
        id,
        turnLimit,
        spawns: [
          { enemyId, count: countForWave(waveIndex), startTurn: 1, intervalTurns: 1 },
        ],
        completionGold,
        timeBonusGold,
      });
      continue;
    }

    // Finale: a small escort (2-3 minion-pool enemies, round-robin from the
    // wave right after where the escort loop left off) plus exactly one boss.
    const escortSize = finaleEscortSize(minionPool.length);
    const spawns: WaveDefinition["spawns"] = [];
    for (let i = 0; i < escortSize; i++) {
      const enemyId = minionPool[(waveIndex + i) % minionPool.length];
      spawns.push({
        enemyId,
        count: Math.max(1, countForWave(waveIndex) - 1),
        startTurn: 1,
        intervalTurns: 1,
      });
    }
    spawns.push({
      enemyId: bossEnemyId,
      count: 1,
      startTurn: 3,
      intervalTurns: 1,
    });

    waves.push({
      id,
      turnLimit,
      spawns,
      completionGold,
      timeBonusGold,
    });
  }

  return waves;
}
