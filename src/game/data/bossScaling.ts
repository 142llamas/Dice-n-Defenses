import type { WaveSpawnGroup } from "./waves";

/**
 * bossScaling — D-217 (item 3.5): today, the same boss id is reused with
 * IDENTICAL stats across different level bands (e.g. Emberford's `cinderlord`
 * is both Ch2's boss at levels [6,10] and Ch4's boss at [16,20]) — no
 * level-aware boss scaling exists anywhere before this. Rather than
 * hand-authoring per-boss-per-cap stat blocks (a large, unnecessary content
 * burden for a first pass — ~14 Free Play bosses × 3 Run Length caps, plus
 * every campaign chapter-boss × its own band), this is ONE continuous growth
 * curve applied to every boss's CURRENT authored stats as its "level 1"
 * baseline, same first-pass/untuned standing as every other multiplier in
 * `data/difficulty.ts`.
 *
 * The result is a `WaveSpawnGroup.statMultiplier` — the exact same field
 * `ThreatBudgetSystem`'s elite substitution already introduced — so
 * `WaveSystem` gains one new concept for both features, not two. Applied by
 * `BattleScene` to a wave's finale spawn group, using whichever level the
 * boss should be fought at: Free Play's `RunLengthDefinition.levelCap`, or
 * Campaign's `ChapterDefinition.levelRange[1]`.
 */
export interface BossScalingCurve {
  /** Multiplicative HP growth per level above the baseline. */
  hpGrowthPerLevel: number;
  /** Multiplicative damage growth per level above the baseline. */
  damageGrowthPerLevel: number;
  /** Additive to-hit bonus growth per level above the baseline — a higher-level party's AC climbs enough that a static boss to-hit bonus would otherwise fall behind. */
  attackBonusGrowthPerLevel: number;
}

export const BOSS_SCALING_CURVE: BossScalingCurve = {
  hpGrowthPerLevel: 0.12,
  damageGrowthPerLevel: 0.08,
  attackBonusGrowthPerLevel: 0.5,
};

/**
 * Escape hatch: a specific boss's stat multiplier at a specific target
 * level, overriding the curve entirely for that one (boss, level) pair —
 * for later hand-tuning (e.g. a phase-change threshold) without forcing
 * every boss to need one. Empty today; every boss uses the shared curve.
 */
export const BOSS_LEVEL_OVERRIDES: Record<string, Partial<Record<number, WaveSpawnGroup["statMultiplier"]>>> = {};

/**
 * The stat multiplier a boss (`enemyId`) should carry when fought at
 * `targetLevel`, relative to its authored stats at `baseLevel` (default 1 —
 * every existing boss's current stats ARE its level-1 baseline). Pure and
 * deterministic; `targetLevel <= baseLevel` returns a no-op multiplier
 * rather than ever shrinking a boss.
 */
export function statMultiplierForBoss(
  enemyId: string,
  targetLevel: number,
  baseLevel = 1,
): NonNullable<WaveSpawnGroup["statMultiplier"]> {
  const override = BOSS_LEVEL_OVERRIDES[enemyId]?.[targetLevel];
  if (override) return override;

  const levelsAbove = Math.max(0, targetLevel - baseLevel);
  return {
    hp: 1 + BOSS_SCALING_CURVE.hpGrowthPerLevel * levelsAbove,
    damage: 1 + BOSS_SCALING_CURVE.damageGrowthPerLevel * levelsAbove,
    attackBonusAdd: Math.round(BOSS_SCALING_CURVE.attackBonusGrowthPerLevel * levelsAbove),
  };
}
