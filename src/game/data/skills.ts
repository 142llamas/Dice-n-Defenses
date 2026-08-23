import { modifierFor, type AbilityScoreId, type AbilityScores } from "./abilityScores";
import { proficiencyBonusForLevel } from "../systems/CharacterSystem";

/**
 * Skills — Phase 13.5 (DECISIONS D-086 item scope, D-090). SRD 5.2.1 has 18
 * skills; nothing in this game currently calls for a skill check (no
 * stealth, no perception, no social encounters), so this is deliberately a
 * SLIM, reference-only list — "framework" data for the Compendium and any
 * future consumer, same treatment D-086 asked for on `InitiativeSystem`. One
 * or two representative skills per ability that has SRD skills at all
 * (Constitution genuinely has none in 5e, so it's absent here too).
 *
 * Skill NAMES and their governing ability are SRD 5.2.1 mechanics (CC BY
 * 4.0, see CONTENT_SOURCES.md); every `description` below is original
 * wording for this project, not copied SRD text.
 */

export interface SkillDefinition {
  id: string;
  name: string;
  ability: AbilityScoreId;
  description: string;
}

// D-150: alphabetical by name (Kevin's Compendium-organization request) — the
// only consumer of this array's order is the Compendium's own Skills tab;
// `SKILL_PROFICIENCIES_BY_CLASS` and every other lookup here is keyed by id,
// not position, so reordering is safe.
export const SKILL_ORDER = [
  "acrobatics",
  "athletics",
  "insight",
  "intimidation",
  "investigation",
  "perception",
  "persuasion",
  "stealth",
] as const;

export const SKILLS: Record<string, SkillDefinition> = {
  athletics: {
    id: "athletics",
    name: "Athletics",
    ability: "str",
    description: "Climbing, jumping, swimming, grappling — any feat of raw physical effort.",
  },
  acrobatics: {
    id: "acrobatics",
    name: "Acrobatics",
    ability: "dex",
    description: "Staying upright and in control somewhere tricky: tumbling, balancing, slipping free of a grip.",
  },
  stealth: {
    id: "stealth",
    name: "Stealth",
    ability: "dex",
    description: "Moving quietly and staying out of sight.",
  },
  investigation: {
    id: "investigation",
    name: "Investigation",
    ability: "int",
    description: "Piecing together clues, or working out how something is built or where it leads.",
  },
  perception: {
    id: "perception",
    name: "Perception",
    ability: "wis",
    description: "Noticing what's actually there — a sound, a hidden door, an ambush before it lands.",
  },
  insight: {
    id: "insight",
    name: "Insight",
    ability: "wis",
    description: "Reading true intent: a lie, a bluff, a nervous tell someone's trying to hide.",
  },
  persuasion: {
    id: "persuasion",
    name: "Persuasion",
    ability: "cha",
    description: "Winning someone over honestly, with tact, charm, or a good argument.",
  },
  intimidation: {
    id: "intimidation",
    name: "Intimidation",
    ability: "cha",
    description: "Winning someone over through threats, hostility, or sheer force of presence.",
  },
};

/** Look up a skill definition, throwing on an unknown id so typos fail loudly. */
export function getSkillDefinition(id: string): SkillDefinition {
  const def = SKILLS[id];
  if (!def) throw new Error(`Unknown skill id "${id}".`);
  return def;
}

/**
 * A skill check's ability-modifier contribution alone, with no proficiency
 * — kept for any existing caller that only wants the raw modifier (e.g. the
 * Compendium's reference display, which has no notion of a specific hero's
 * level/proficiency to apply).
 */
export function skillModifier(abilityScores: AbilityScores, skillId: string): number {
  return modifierFor(abilityScores, getSkillDefinition(skillId).ability);
}

/**
 * D-125: real per-class skill proficiency, finally with a real consumer
 * (the Stealth check behind hero-side stealth — see `SkillCheckSystem` and
 * `Hero.canAttemptHide`). Each class's real SRD skill list offers a CHOICE
 * of several ("choose 2 from: ..."); this game has no proficiency-picker UI,
 * so each class gets a fixed, representative subset of its real options,
 * filtered to whichever of those options exist in this file's own slim
 * `SKILL_ORDER` (8 of the SRD's 18 skills) — same "framework, not the full
 * list" simplification the rest of this file already makes. Every class not
 * listed here is proficient in none of these 8 (still a real SRD gap, not a
 * fabrication — its real proficiencies just don't fall inside this slim
 * set).
 */
export const SKILL_PROFICIENCIES_BY_CLASS: Record<string, string[]> = {
  barbarian: ["athletics", "intimidation"],
  bard: ["persuasion", "insight", "investigation"],
  cleric: ["insight", "persuasion"],
  druid: ["insight", "perception"],
  fighter: ["athletics", "perception"],
  monk: ["acrobatics", "stealth"],
  paladin: ["athletics", "persuasion"],
  ranger: ["stealth", "perception"],
  rogue: ["stealth", "acrobatics", "perception", "investigation"],
  sorcerer: ["persuasion", "intimidation"],
  warlock: ["intimidation", "investigation"],
  wizard: ["investigation", "insight"],
};

/** True if a character of this class is proficient in this skill (see `SKILL_PROFICIENCIES_BY_CLASS`). */
export function isProficientInSkill(classId: string | undefined, skillId: string): boolean {
  return !!classId && (SKILL_PROFICIENCIES_BY_CLASS[classId]?.includes(skillId) ?? false);
}

/**
 * The full skill-check modifier: ability modifier, plus proficiency bonus
 * only if this class is proficient in this skill — the exact formula
 * `CharacterSystem.savingThrowBonus` already uses for saving throws, applied
 * to skills instead.
 */
export function skillCheckModifier(
  abilityScores: AbilityScores,
  skillId: string,
  classId: string | undefined,
  level: number,
): number {
  const base = skillModifier(abilityScores, skillId);
  return base + (isProficientInSkill(classId, skillId) ? proficiencyBonusForLevel(level) : 0);
}
