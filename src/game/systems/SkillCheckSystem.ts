import { RandomService, type AdvantageMode } from "./RandomService";

/**
 * SkillCheckSystem — D-125. No Phaser, mirrors `SavingThrowSystem`'s
 * dice-resolution shape: a d20 roll plus a modifier against a target number.
 * Unlike a saving throw or an attack roll, the SRD does NOT give a plain
 * ability/skill check a natural-20-always-succeeds or natural-1-always-fails
 * rule — so, deliberately unlike `SavingThrowSystem.rollSave`, this is a
 * plain "total meets or beats the DC" comparison with no auto-success/fail
 * carve-out.
 *
 * `data/skills.ts`'s `skillCheckModifier` computes the modifier this system
 * rolls against; this system resolves the roll. First real consumer: hero
 * stealth (Ranger's Vanish, a Stealth check — see `Hero.canAttemptHide`).
 */

export interface SkillCheckResult {
  d20: number;
  total: number;
  dc: number;
  success: boolean;
}

export class SkillCheckSystem {
  static rollCheck(modifier: number, dc: number, random: RandomService, advantage: AdvantageMode = "normal"): SkillCheckResult {
    const d20 = random.rollD20With(advantage);
    const total = d20 + modifier;
    return { d20, total, dc, success: total >= dc };
  }
}
