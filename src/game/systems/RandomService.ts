/**
 * RandomService — Phase 13.1's dice core (DECISIONS D-086).
 *
 * D-036 deliberately deferred a RandomService because deterministic combat
 * (D-030) had no random roll to seed. Kevin's Phase 13 vision explicitly
 * reverses D-030: real d20 attack rolls, advantage/disadvantage, and crits
 * are now part of combat, so this is that service's first real consumer, per
 * the Source of Truth's "controlled randomness" architecture rule (a service
 * tests can seed) and D-036's own promise ("introduced by the first phase
 * that adds a genuine random element, together with a real consumer").
 *
 * A seedable PRNG (mulberry32 — small, fast, and deterministic for a given
 * seed) so a real battle gets real unpredictability while tests stay
 * reproducible. `RandomService.fixed()` is the test-facing escape hatch:
 * every roll returns the same value, so tests that don't care about combat
 * randomness (movement, building, waves, economy, etc.) can pass one in and
 * keep asserting exact outcomes — see CombatSystem's module comment for how
 * `fixed()`'s default (15) was chosen to guarantee a hit against every
 * armor-class value in this project's data without ever rolling a natural
 * 20 (a crit) or a natural 1 (a fumble).
 */

export type AdvantageMode = "normal" | "advantage" | "disadvantage";

export class RandomService {
  private state: number;
  private readonly fixedValue: number | null;

  private constructor(seed: number, fixedValue: number | null = null) {
    this.state = (seed >>> 0) || 1;
    this.fixedValue = fixedValue;
  }

  /** A real, seedable RandomService. Omit `seed` to self-seed from the clock. */
  static seeded(seed?: number): RandomService {
    return new RandomService(seed ?? Date.now());
  }

  /**
   * A deterministic test double: every roll returns exactly `value`. Defaults
   * to 15 — high enough to beat every armor-class value currently in this
   * project's data, but not a natural 20/1, so no test accidentally exercises
   * crit/fumble behaviour unless it asks for one explicitly (pass 20 or 1).
   */
  static fixed(value = 15): RandomService {
    return new RandomService(1, value);
  }

  /** mulberry32: deterministic for a given seed, returns a float in [0, 1). */
  private next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A single d20 roll (1-20). */
  rollD20(): number {
    if (this.fixedValue !== null) return this.fixedValue;
    return Math.floor(this.next() * 20) + 1;
  }

  /** A d20 roll under advantage/disadvantage (2d20, keep higher/lower) or normal (1d20). */
  rollD20With(mode: AdvantageMode = "normal"): number {
    if (this.fixedValue !== null) return this.fixedValue;
    if (mode === "normal") return this.rollD20();
    const a = this.rollD20();
    const b = this.rollD20();
    return mode === "advantage" ? Math.max(a, b) : Math.min(a, b);
  }

  /**
   * Phase 18 (D-109): a single d4 roll (1-4) — Boon of Spell Recall's "roll
   * 1d4; a match against the slot's level spares it" check. `fixed()`'s
   * value is folded into range with a simple modulo rather than reused
   * as-is (its default, 15, is meaningful for a d20 roll but not a d4 one).
   */
  rollD4(): number {
    if (this.fixedValue !== null) return ((this.fixedValue - 1) % 4) + 1;
    return Math.floor(this.next() * 4) + 1;
  }

  /**
   * Phase 22 (loot system): a percentage roll in [0, 100) — drop-chance and
   * tier-up-luck checks against a flat threshold. Under `fixed()`, returns
   * the fixed value capped at 99 so a test can force a specific outcome
   * (e.g. `fixed(0)` always clears a drop-chance check, `fixed(99)` never
   * does) without needing a dedicated always-succeeds/always-fails double.
   */
  rollPercent(): number {
    if (this.fixedValue !== null) return Math.min(99, this.fixedValue);
    return Math.floor(this.next() * 100);
  }

  /**
   * Phase 22 (loot system): a uniform random index in [0, count) — "pick one
   * item from this pool." Under `fixed()`, always returns 0 (the pool's
   * first entry) so a test can assert deterministically.
   */
  rollIndex(count: number): number {
    if (count <= 0) return 0;
    if (this.fixedValue !== null) return 0;
    return Math.floor(this.next() * count);
  }
}
