import { ABILITY_SCORE_IDS, type AbilityScoreId } from "./abilityScores";

/**
 * Feats — Phase 11.3's starter feat list (DECISIONS D-071/D-075), expanded
 * in Phase 18 (D-109) to every feat the free SRD 5.2.1 (CC BY 4.0) actually
 * contains.
 *
 * IMPORTANT SOURCING CORRECTION (Phase 18, D-109): Phase 11.3's original doc
 * comment here claimed Tough/Alert/Lucky/Athlete all came from SRD 5.2.1.
 * A verification pass against the real SRD 5.2.1 PDF found this was only
 * true for Alert — the SRD's actual Feats chapter is just 17 feats total,
 * and Tough/Lucky/Athlete are PHB-exclusive content NOT in the free
 * document. Those three stay exactly as they were (already-shipped,
 * balanced, tested mechanics) but are now correctly attributed in
 * CONTENT_SOURCES.md as original content inspired by common tabletop feat
 * concepts, not licensed SRD text. Every feat added below IS real,
 * verified SRD 5.2.1 content: names/categories/prerequisites/general
 * mechanics follow the SRD; every DESCRIPTION here is still original
 * wording, never copied SRD text — same treatment as every other class
 * table in this project.
 *
 * A feat is picked in place of an Ability Score Improvement — see
 * `BattleScene`'s ASI-or-feat overlay, offered whenever `CharacterSystem
 * .asiFeatureGrantedAtLevel` fires. `Hero.meetsFeatPrerequisites` (Phase 18,
 * D-109) is the first general prerequisite check in this codebase, built
 * from each feat's `prerequisite` record below.
 *
 * The SRD's real feat categories:
 * - **Origin** feats have no prerequisite (Magic Initiate, Savage Attacker,
 *   Skilled — plus the pre-existing Tough/Alert/Lucky/Athlete).
 * - **General** feats need level 4+, sometimes an ability-score minimum
 *   (Grappler).
 * - **Fighting Style** feats need a class Fighting Style feature (Fighter
 *   L1, Paladin/Ranger L2) — Archery, Defense, Great Weapon Fighting,
 *   Two-Weapon Fighting.
 * - **Epic Boon** feats need level 19+ — real content, but practically
 *   unreachable in this game's current run lengths (10 waves max per run,
 *   nothing persists a hero's class level between runs) — the same honest
 *   "real but currently unreachable" treatment `data/classes.ts` already
 *   gives Barbarian's level-20 Primal Champion.
 *
 * This game's damage numbers are flat, never dice-rolled (see
 * `WeaponSystem`/`CombatSystem`'s own module comments), so any SRD feat
 * built around rerolling or adjusting a damage DIE (Savage Attacker, Great
 * Weapon Fighting) becomes a flat bonus number here instead — the same
 * diceless-conversion treatment `CharacterSystem.fixedHitDieGain` already
 * gives every class's hit die, and Colossus Slayer/Tough already gave their
 * own SRD dice expressions.
 *
 * Skilled stays honestly inert — this game has no per-character skill-
 * proficiency list to grant proficiency into. Three Epic Boons (Dimensional
 * Travel, the Night Spirit, Truesight) are inert for the same reason — no
 * reposition-after-acting, lighting, or invisibility/stealth-detection
 * system exists to hook them into.
 *
 * Phase 19 (D-110): Two-Weapon Fighting was originally left inert too (no
 * dual-wielding system existed), matching the SRD's own Nick weapon mastery
 * gap. Kevin asked for it to be built rather than left inert — this added
 * this game's first real dual-wielding mechanic (a Light melee weapon may
 * now occupy the `"shield"` gear slot as an off-hand weapon; see
 * `Hero.offHandWeapon`/`canUseOffHandAttack`), which also finally gave Nick
 * a real mechanical hookup (`WEAPON_MASTERIES.nick`, `data/weapons.ts`) —
 * the same root gap, closed once for both.
 */

export type FeatCategory = "origin" | "general" | "fightingStyle" | "epicBoon";

/** What a hero must satisfy for `meetsFeatPrerequisites` to offer this feat. */
export interface FeatPrerequisite {
  minLevel?: number;
  /** True if the hero's class grants a Fighting Style feature (Fighter L1, Paladin/Ranger L2). */
  requiresFightingStyleFeature?: boolean;
  /** True if the hero's class has a `spellcasting` block (Boon of Spell Recall). */
  requiresSpellcastingFeature?: boolean;
  /** Satisfied if ANY listed ability meets its score (Grappler: Str OR Dex 13+). */
  minAbilityScoreAnyOf?: { ability: AbilityScoreId; score: number }[];
}

/** A feat-granted ability-score bump (Grappler: +1 Str/Dex; every Epic Boon: +1, capped at 30 instead of the usual 20). */
export interface AbilityScoreBoost {
  amount: number;
  allowedAbilities: AbilityScoreId[];
  hardCap: number;
}

export interface FeatDefinition {
  id: string;
  name: string;
  category: FeatCategory;
  description: string;
  mechanicallyActive: boolean;
  /** True only for Magic Initiate — may be picked more than once (a different spell list each time). */
  repeatable?: boolean;
  prerequisite?: FeatPrerequisite;
  abilityScoreBoost?: AbilityScoreBoost;
  /** Set only for Tough — a flat HP bonus that scales with the hero's level. */
  hitPointBonusPerLevel?: number;
  /** Set only for Lucky — a fixed pool of rerolls, recharged on Long Rest. */
  luckyPoints?: number;
  /** Set for Savage Attacker (always-on) and Great Weapon Fighting (two-handed weapons only). */
  flatDamageBonus?: number;
  /** Set only for Archery — bonus to attack rolls with a ranged weapon equipped. */
  flatAttackBonus?: number;
  /** Set only for Defense — bonus Armor Class while any armor is worn. */
  armorClassBonus?: number;
}

const EPIC_BOON_PREREQUISITE: FeatPrerequisite = { minLevel: 19 };
const ALL_ABILITIES: AbilityScoreId[] = [...ABILITY_SCORE_IDS];

export const FEATS: Record<string, FeatDefinition> = {
  tough: {
    id: "tough",
    name: "Tough",
    category: "origin",
    description: "Hardier than most — gains extra hit points for every level of experience.",
    mechanicallyActive: true,
    hitPointBonusPerLevel: 2,
  },
  alert: {
    id: "alert",
    name: "Alert",
    category: "origin",
    description:
      "Always ready for danger, acting first when it matters. Inert — this game's turn order is a fixed phase sequence, not per-unit initiative.",
    mechanicallyActive: false,
  },
  lucky: {
    id: "lucky",
    name: "Lucky",
    category: "origin",
    description:
      "A handful of fated chances to turn failure into success. Mechanically active as of Phase 13.6 (D-091): grants Advantage on this hero's basic-attack rolls, spent automatically while a point remains; recharges on a Long Rest.",
    mechanicallyActive: true,
    luckyPoints: 3,
  },
  athlete: {
    id: "athlete",
    name: "Athlete",
    category: "general",
    description: "Trained for climbing, jumping, and rough terrain. Inert — this game has no climbing/jumping/terrain-cost mechanic.",
    mechanicallyActive: false,
  },

  // ----- Phase 18 (D-109): every remaining SRD 5.2.1 feat --------------------

  "magic-initiate": {
    id: "magic-initiate",
    name: "Magic Initiate",
    category: "origin",
    description:
      "Studies a slice of arcane or divine lore outside this hero's own training — learns two cantrips and one first-level spell from the Cleric, Druid, or Wizard list; the leveled spell can be cast once between Long Rests without spending a spell slot. May be taken more than once, choosing a different list each time.",
    mechanicallyActive: true,
    repeatable: true,
  },
  "savage-attacker": {
    id: "savage-attacker",
    name: "Savage Attacker",
    category: "origin",
    description: "Swings with brutal, practiced force — this hero's basic attacks deal extra damage.",
    mechanicallyActive: true,
    flatDamageBonus: 2,
  },
  skilled: {
    id: "skilled",
    name: "Skilled",
    category: "origin",
    description:
      "A broad, practical education across three skills or trades. Inert — this game has no per-character skill-proficiency list or skill-check mechanic to grant proficiency into.",
    mechanicallyActive: false,
  },
  grappler: {
    id: "grappler",
    name: "Grappler",
    category: "general",
    description:
      "Trained to grab and pin a foe bodily — raises Strength or Dexterity by 1, and once per turn a landed basic-attack hit can wrestle an enemy down; while an enemy is held that way, this hero's attacks against it land more easily.",
    mechanicallyActive: true,
    prerequisite: { minLevel: 4, minAbilityScoreAnyOf: [{ ability: "str", score: 13 }, { ability: "dex", score: 13 }] },
    abilityScoreBoost: { amount: 1, allowedAbilities: ["str", "dex"], hardCap: 20 },
  },
  archery: {
    id: "archery",
    name: "Archery",
    category: "fightingStyle",
    description: "A Fighting Style built around the bow and the sling — ranged attacks land more easily.",
    mechanicallyActive: true,
    prerequisite: { requiresFightingStyleFeature: true },
    flatAttackBonus: 2,
  },
  defense: {
    id: "defense",
    name: "Defense",
    category: "fightingStyle",
    description: "A Fighting Style built around bracing behind armor — Armor Class rises while any armor is worn.",
    mechanicallyActive: true,
    prerequisite: { requiresFightingStyleFeature: true },
    armorClassBonus: 1,
  },
  "great-weapon-fighting": {
    id: "great-weapon-fighting",
    name: "Great Weapon Fighting",
    category: "fightingStyle",
    description: "A Fighting Style built around swinging a weapon with both hands — two-handed weapon attacks deal extra damage.",
    mechanicallyActive: true,
    prerequisite: { requiresFightingStyleFeature: true },
    flatDamageBonus: 2,
  },
  "two-weapon-fighting": {
    id: "two-weapon-fighting",
    name: "Two-Weapon Fighting",
    category: "fightingStyle",
    description:
      "A Fighting Style built around a blade in each hand — adds this hero's ability modifier to the damage of its off-hand attack (normally skipped for that attack).",
    mechanicallyActive: true,
    prerequisite: { requiresFightingStyleFeature: true },
  },
  "boon-of-combat-prowess": {
    id: "boon-of-combat-prowess",
    name: "Boon of Combat Prowess",
    category: "epicBoon",
    description:
      "A legend's certainty in a fight — raises one ability score, and once per turn a missed attack can be willed into a hit instead.",
    mechanicallyActive: true,
    prerequisite: EPIC_BOON_PREREQUISITE,
    abilityScoreBoost: { amount: 1, allowedAbilities: ALL_ABILITIES, hardCap: 30 },
  },
  "boon-of-dimensional-travel": {
    id: "boon-of-dimensional-travel",
    name: "Boon of Dimensional Travel",
    category: "epicBoon",
    description:
      "A legend's mastery of space itself — raises one ability score. Inert — this game has no reposition-after-acting mechanic to hook the short teleport into.",
    mechanicallyActive: false,
    prerequisite: EPIC_BOON_PREREQUISITE,
    abilityScoreBoost: { amount: 1, allowedAbilities: ALL_ABILITIES, hardCap: 30 },
  },
  "boon-of-fate": {
    id: "boon-of-fate",
    name: "Boon of Fate",
    category: "epicBoon",
    description:
      "A legend's grip on destiny — raises one ability score, and grants a once-per-rest surge of fortune that boosts this hero's next attack roll.",
    mechanicallyActive: true,
    prerequisite: EPIC_BOON_PREREQUISITE,
    abilityScoreBoost: { amount: 1, allowedAbilities: ALL_ABILITIES, hardCap: 30 },
  },
  "boon-of-irresistible-offense": {
    id: "boon-of-irresistible-offense",
    name: "Boon of Irresistible Offense",
    category: "epicBoon",
    description:
      "A legend's blows brush aside any ward — raises Strength or Dexterity, and a natural-20 attack deals extra damage equal to the raised score. The damage-resistance-piercing half stays inert — this game has no damage-resistance system.",
    mechanicallyActive: true,
    prerequisite: EPIC_BOON_PREREQUISITE,
    abilityScoreBoost: { amount: 1, allowedAbilities: ["str", "dex"], hardCap: 30 },
  },
  "boon-of-spell-recall": {
    id: "boon-of-spell-recall",
    name: "Boon of Spell Recall",
    category: "epicBoon",
    description:
      "A legend's spellcasting that barely spends itself — raises Intelligence, Wisdom, or Charisma, and casting a spell has a real chance of not spending its slot.",
    mechanicallyActive: true,
    prerequisite: { ...EPIC_BOON_PREREQUISITE, requiresSpellcastingFeature: true },
    abilityScoreBoost: { amount: 1, allowedAbilities: ["int", "wis", "cha"], hardCap: 30 },
  },
  "boon-of-the-night-spirit": {
    id: "boon-of-the-night-spirit",
    name: "Boon of the Night Spirit",
    category: "epicBoon",
    description:
      "A legend's kinship with darkness — raises one ability score. Inert — this game has no day/night or lighting system to hook the invisibility-in-darkness into.",
    mechanicallyActive: false,
    prerequisite: EPIC_BOON_PREREQUISITE,
    abilityScoreBoost: { amount: 1, allowedAbilities: ALL_ABILITIES, hardCap: 30 },
  },
  "boon-of-truesight": {
    id: "boon-of-truesight",
    name: "Boon of Truesight",
    category: "epicBoon",
    description:
      "A legend's sight beyond the visible — raises one ability score. Inert — this game has no invisibility/stealth-detection mechanic for Truesight to pierce.",
    mechanicallyActive: false,
    prerequisite: EPIC_BOON_PREREQUISITE,
    abilityScoreBoost: { amount: 1, allowedAbilities: ALL_ABILITIES, hardCap: 30 },
  },
};

export const FEAT_IDS: string[] = Object.keys(FEATS);

/** Look up a feat, throwing on an unknown id so typos fail loudly. */
export function getFeat(id: string): FeatDefinition {
  const def = FEATS[id];
  if (!def) throw new Error(`Unknown feat id "${id}".`);
  return def;
}

/** The extra HP a feat grants at this level (Tough: `hitPointBonusPerLevel * level`). 0 for a feat with no HP bonus. */
export function hitPointBonusFromFeat(feat: FeatDefinition, level: number): number {
  return (feat.hitPointBonusPerLevel ?? 0) * level;
}
