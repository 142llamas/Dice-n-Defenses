import { modifierFor, type AbilityScoreId, type AbilityScores } from "./abilityScores";

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

export const SKILL_ORDER = [
  "athletics",
  "acrobatics",
  "stealth",
  "investigation",
  "perception",
  "insight",
  "persuasion",
  "intimidation",
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
 * A skill check's ability-modifier contribution — this game doesn't model
 * per-character skill PROFICIENCY yet (no skill-picker UI exists, and no
 * skill check exists in actual gameplay to spend one on), so this is just
 * the raw ability modifier, framework-only like the rest of this file.
 */
export function skillModifier(abilityScores: AbilityScores, skillId: string): number {
  return modifierFor(abilityScores, getSkillDefinition(skillId).ability);
}
