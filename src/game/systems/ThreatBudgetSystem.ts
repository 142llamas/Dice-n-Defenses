import type { RandomService } from "./RandomService";
import type { DifficultyDefinition } from "../data/difficulty";
import type { WaveDefinition, WaveSpawnGroup } from "../data/waves";

/**
 * ThreatBudgetSystem — D-217 (item 3b): Difficulty's replacement for
 * touching character level/XP (that job now belongs entirely to
 * `LevelMilestoneSystem`, driven by Run Length/campaign data). Difficulty now
 * only shapes enemy-wave PRESSURE, via `applyThreatBudget`, a pure
 * post-processing transform applied once per `WaveDefinition` — hand-authored
 * campaign waves and `FreePlayWaveGenerator` output alike — before the wave
 * reaches `WaveSystem`, which itself is unchanged (it already scales enemy
 * count/HP live and now also reads the optional per-group `statMultiplier`
 * this system introduces; see `WaveSystem.spawnDueEnemies`).
 *
 * Four levers, each with an explicit safeguard against a disproportionate
 * result:
 * 1. Count — `tier.enemyCountMultiplier` is baked into each group's `count`
 *    HERE rather than left for `WaveSystem` to scale live, since splitting a
 *    group into elite/regular sub-groups (below) means `WaveSystem`'s own
 *    per-index count scaling would double-apply it. Callers of this function
 *    pass `enemyCountMultiplier: 1` into `WaveSystem` for any wave that's
 *    already been through `applyThreatBudget`. `tier.enemyHpMultiplier` is
 *    NOT baked in here — `WaveSystem` keeps applying it live, combined
 *    multiplicatively with each group's own `statMultiplier.hp`.
 * 2. Elite substitution — splits a scaled group into a regular sub-group and
 *    an elite sub-group of the SAME `enemyId` (reusing existing enemy
 *    content, not new "elite" `EnemyDefinition`s, matching this project's
 *    flat-multiplier-first-pass convention). Safeguard: never converts a
 *    group's LAST regular unit.
 * 3. Cadence — `intervalTurns' = max(1, round(intervalTurns *
 *    cadenceMultiplier))`. `startTurn`/`turnLimit` are never touched — the
 *    concrete mechanism behind "harder difficulty should primarily increase
 *    intensity rather than dramatically extending wave duration." Safeguard:
 *    a floor of 1 turn, so no tier can produce zero-interval spam.
 * 4. Extra lanes — a chance to duplicate one small, non-boss existing group
 *    onto a spare spawn point. Safeguard: capped by `maxSimultaneousLanes`,
 *    and `bossEnemyId` groups are never duplication candidates.
 */
export function applyThreatBudget(
  wave: WaveDefinition,
  tier: DifficultyDefinition,
  random: RandomService,
  spawnPointCount: number,
  bossEnemyId?: string,
): WaveDefinition {
  const scaledCount = (count: number): number => Math.max(1, Math.round(count * tier.enemyCountMultiplier));

  const spawns: WaveSpawnGroup[] = [];
  for (const group of wave.spawns) {
    const count = scaledCount(group.count);
    const isBossGroup = bossEnemyId !== undefined && group.enemyId === bossEnemyId;
    if (isBossGroup || tier.eliteFraction <= 0) {
      spawns.push({ ...group, count });
      continue;
    }
    const eliteCount = Math.min(
      Math.floor(count * tier.eliteFraction),
      Math.floor(count * tier.eliteFractionCap),
      count - 1,
    );
    if (eliteCount <= 0) {
      spawns.push({ ...group, count });
      continue;
    }
    spawns.push({ ...group, count: count - eliteCount });
    spawns.push({
      ...group,
      count: eliteCount,
      statMultiplier: {
        hp: (group.statMultiplier?.hp ?? 1) * tier.eliteStatMultiplier.hp,
        damage: (group.statMultiplier?.damage ?? 1) * tier.eliteStatMultiplier.damage,
      },
    });
  }

  // Extra lane: a chance to duplicate the smallest non-boss group of the
  // ORIGINAL wave onto a spawn point not already in use, if one exists and
  // the tier's own lane cap isn't already met.
  if (spawnPointCount > 1 && tier.extraLaneChance > 0) {
    const usedLanes = new Set(spawns.map((g) => g.spawnIndex ?? 0));
    const rolled = random.rollPercent() < tier.extraLaneChance * 100;
    if (rolled && usedLanes.size < tier.maxSimultaneousLanes) {
      const candidates = wave.spawns.filter((g) => !(bossEnemyId !== undefined && g.enemyId === bossEnemyId));
      let freeLane = -1;
      for (let i = 0; i < spawnPointCount; i++) {
        if (!usedLanes.has(i)) {
          freeLane = i;
          break;
        }
      }
      if (candidates.length > 0 && freeLane >= 0) {
        const smallest = candidates.reduce((min, g) => (g.count < min.count ? g : min), candidates[0]);
        spawns.push({ ...smallest, count: scaledCount(smallest.count), spawnIndex: freeLane });
      }
    }
  }

  const cadenced = spawns.map((g) => ({
    ...g,
    intervalTurns: Math.max(1, Math.round(g.intervalTurns * tier.cadenceMultiplier)),
  }));

  return { ...wave, spawns: cadenced };
}
