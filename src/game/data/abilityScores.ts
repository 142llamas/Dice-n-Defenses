/**
 * Ability scores — Phase 11.1, first slice of the D&D 5.5e character system
 * (DECISIONS D-071/D-072). This is the foundation everything else in the
 * character system (classes, races, feats, spellcasting) is built on top of.
 *
 * SRD-derived content (SOURCE_OF_TRUTH §3 / CONTENT_SOURCES.md): the six
 * ability scores, their abbreviations, and the "modifier = floor((score-10)/2)"
 * formula are basic SRD 5.2.1 mechanics, used here under CC BY 4.0. Nothing
 * about HOW this project applies them (which classes/heroes use which score,
 * balance numbers) is copied from any published source.
 *
 * Wired in (D-073) via `CharacterCreationScene` and
 * `systems/CharacterBuildSystem.ts` — a created character's ability scores
 * feed `CharacterSystem`'s derived-stat math, which produces the
 * `HeroDefinition` `BattleScene` actually plays. The ORIGINAL fixed 4-hero
 * roster (`data/heroes.ts`) does not use ability scores at all and is
 * untouched — the two hero sources simply coexist (see D-073).
 */

export type AbilityScoreId = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITY_SCORE_IDS: AbilityScoreId[] = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_SCORE_NAMES: Record<AbilityScoreId, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** A full set of six ability scores, e.g. for one character build. */
export type AbilityScores = Record<AbilityScoreId, number>;

/**
 * The standard array (SRD 5.2.1): the default set of six scores a new
 * character assigns to their abilities in whatever order suits their class.
 * Point-buy is deliberately not included yet — it's a character-creation-UI
 * concern (Phase 11.1's later "wire it in" slice), not a rules-engine one.
 */
export const STANDARD_ARRAY: number[] = [15, 14, 13, 12, 10, 8];

/**
 * The SRD modifier formula. Rounds DOWN (Math.floor), not toward zero, so a
 * score of 9 correctly gives -1, not 0.
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Convenience for reading one modifier out of a full score set. */
export function modifierFor(scores: AbilityScores, ability: AbilityScoreId): number {
  return abilityModifier(scores[ability]);
}
