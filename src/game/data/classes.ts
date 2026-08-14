import type { AbilityScoreId } from "./abilityScores";

/**
 * Character classes — Phase 11.1 (DECISIONS D-071/D-072). A class defines a
 * hit die, saving-throw proficiencies, how many attacks a basic "Attack"
 * action makes at a given level (Extra Attack), and a level-by-level feature
 * table.
 *
 * SRD-derived content (see CONTENT_SOURCES.md): the Fighter class's name,
 * hit die (d10), saving throw proficiencies (Strength/Constitution), and its
 * feature names/levels (Fighting Style, Second Wind, Action Surge, Extra
 * Attack, Indomitable, Ability Score Improvement, and the subclass-choice
 * level) follow SRD 5.2.1 under CC BY 4.0. All feature DESCRIPTIONS below are
 * original wording for this project, not copied SRD text.
 *
 * Deliberately deferred to later Phase 11 sub-phases, per D-071 — NOT missing
 * by oversight:
 * - Subclass CONTENT beyond one modeled option per class WAS this deferral's
 *   own example — Phase 14.2 (D-099) gave every class a second, original
 *   subclass once the SRD itself turned out to have no more free content to
 *   add (see `data/subclasses.ts`'s module doc).
 * - Actually usable saving throws (Indomitable does nothing without a
 *   save/dice system — D-047 addendum, still an explicit future item).
 * - Second Wind/Action Surge WERE this deferral's own example — Phase 13.2
 *   (D-087) wired both in against a new bonus-action slot on `Hero`, and
 *   Phase 13.4 (D-088) gave them the SRD's real once-per-rest cadence via a
 *   new `RestSystem`. Every "Ability Score Improvement" feature below is a
 *   further such example — Phase 11.3 added the feat catalog (`data/feats.ts`),
 *   and Phase 13.6 (D-091) wired the choice itself in (see `BattleScene`'s
 *   ASI-or-feat overlay), so every ASI entry is now `mechanicallyActive: true`.
 *
 * `mechanicallyActive: false` marks exactly those not-yet-usable features so
 * a future system can query "what does this class do RIGHT NOW" without
 * silently pretending an inert feature already works.
 */

export interface ClassFeature {
  level: number;
  name: string;
  description: string;
  mechanicallyActive: boolean;
  /**
   * Phase 15 follow-up (D-105): set only on a subclass feature that grants
   * specific bonus/always-prepared spells (Domain Spells, Oath Spells, an
   * Otherworldly Patron's Expanded Spell List, etc.) — the exact SRD-derived
   * `data/spells.ts` ids granted at this feature's level. Absent for every
   * ordinary feature, and for a granted-spells feature this game can't yet
   * make mechanically real (see `data/subclasses.ts`).
   */
  grantedSpellIds?: string[];
}

/**
 * Phase 11.2 (D-074): a caster class's spell-slot progression. Both tables
 * are sparse — only levels where the value CHANGES have an entry — read via
 * the same "highest key <= level" lookup as `attacksPerActionByLevel` (see
 * `SpellcastingSystem`).
 */
export interface SpellcastingProgression {
  /** The ability score used for this class's spell attacks (SRD: casting ability). */
  spellcastingAbility: AbilityScoreId;
  /** How many cantrips a character of this class knows, by level. */
  cantripsKnownByLevel: Record<number, number>;
  /** Spell slots per spell level (index 0 = 1st-level slots, index 1 = 2nd, ...), by character level. */
  spellSlotsByLevel: Record<number, number[]>;
}

export interface CharacterClassDefinition {
  id: string;
  name: string;
  hitDie: number;
  primaryAbility: AbilityScoreId;
  savingThrowProficiencies: AbilityScoreId[];
  /**
   * How many attacks a basic "Attack" action makes at a given level (Extra
   * Attack). Sparse: only levels where the count CHANGES have an entry —
   * look up the highest key <= the character's level (see
   * `CharacterSystem.attacksPerActionForClassAtLevel`).
   */
  attacksPerActionByLevel: Record<number, number>;
  /** Every named feature this class grants, one entry per (level, feature). */
  features: ClassFeature[];
  /** Present only for caster classes (Wizard, Cleric). */
  spellcasting?: SpellcastingProgression;
  /**
   * Flat rider damage added to every attack, by level (e.g. the Rogue's
   * Sneak Attack, Phase 11.3/D-075). Sparse, same "highest key <= level"
   * lookup as `attacksPerActionByLevel` — see
   * `CharacterSystem.bonusDamageForClassAtLevel`. Absent for classes with no
   * such rider.
   */
  bonusDamageByLevel?: Record<number, number>;
  /**
   * Phase 13.11 (D-096): the level this class's subclass choice (Martial
   * Archetype/Arcane Tradition/Divine Domain/etc.) happens, extracted out of
   * that feature's own `level` field so `Hero.levelUpClass()`/
   * `CharacterCreationScene` can query it generically instead of matching on
   * a feature name string. Present for every class (matching each class's
   * own "subclass choice" feature entry above) — as of Phase 14.2 (D-099),
   * every class has exactly two modeled subclasses (`subclassesForClass`
   * returns both), one SRD-derived and one original.
   */
  subclassChoiceLevel: number;
}

/**
 * Every SRD full-caster class shares the exact same cantrips-known and
 * spell-slot progression tables (Wizard, Cleric, and, in the future, any
 * other full caster this project adds) — factored out here once rather than
 * copy-pasted per class.
 */
const FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL: Record<number, number> = {
  1: 3,
  4: 4,
  10: 5,
};

const FULL_CASTER_SPELL_SLOTS_BY_LEVEL: Record<number, number[]> = {
  1: [2],
  2: [3],
  3: [4, 2],
  4: [4, 3],
  5: [4, 3, 2],
  6: [4, 3, 3],
  7: [4, 3, 3, 1],
  8: [4, 3, 3, 2],
  9: [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

export const FIGHTER: CharacterClassDefinition = {
  id: "fighter",
  name: "Fighter",
  hitDie: 10,
  primaryAbility: "str",
  savingThrowProficiencies: ["str", "con"],
  subclassChoiceLevel: 3,
  attacksPerActionByLevel: {
    1: 1,
    5: 2,
    11: 3,
    20: 4,
  },
  features: [
    {
      level: 1,
      name: "Fighting Style",
      description:
        "A combat specialization chosen at level 1 (e.g. favoring accuracy, defense, or two-handed power). Which styles exist and their exact numbers are a character-creation-UI concern for a later slice.",
      mechanicallyActive: false,
    },
    {
      level: 1,
      name: "Second Wind",
      description:
        "A bonus-action self-heal. Mechanically active as of Phase 13.2 (D-087); recharges on a Short or Long Rest as of Phase 13.4 (D-088), the SRD's real cadence.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Action Surge",
      description:
        "Take an extra action on your turn. Mechanically active as of Phase 13.2 (D-087); recharges on a Short or Long Rest as of Phase 13.4 (D-088), the SRD's real cadence.",
      mechanicallyActive: true,
    },
    {
      level: 3,
      name: "Martial Archetype",
      description:
        "A subclass choice that further specializes the Fighter. Two martial archetypes are modeled today (see data/subclasses.ts): Champion (SRD) and Battle Tactician (original, Phase 14.2/D-099) — this entry marks WHEN the choice happens; each has its own real hookup (Champion's crit-range widen; Battle Tactician's flat to-hit bonus), with every other feature honestly inert.",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "Raise ability scores or take a feat instead. Mechanically active as of Phase 13.6 (D-091): +2 to one ability score, or +1 to two; or a feat from data/feats.ts (see BattleScene's overlay).",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Extra Attack",
      description: "Attack twice, instead of once, whenever you take the Attack action.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 7,
      name: "Martial Archetype Feature",
      description: "A subclass-specific feature (see level 3's note on the modeled subclass).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 9,
      name: "Indomitable",
      description:
        "Reroll a failed saving throw once per rest. Mechanically active as of D-124, now that a real saving-throw/dice system exists (Phase 13.5/13.10, D-090) — see Hero.rerollFailedSave, consumed automatically the instant a forced saving throw fails (no interrupt-prompt UI, same auto-apply precedent as Uncanny Dodge/Lucky). Recharges on a Long Rest only, matching the SRD.",
      mechanicallyActive: true,
    },
    {
      level: 10,
      name: "Martial Archetype Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 11,
      name: "Extra Attack (2)",
      description: "Attack three times, instead of twice, whenever you take the Attack action.",
      mechanicallyActive: true,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 13,
      name: "Indomitable (2 uses)",
      description: "A second use of Indomitable per rest (see level 9). Mechanically active as of D-124 — see Hero.indomitableMaxUses.",
      mechanicallyActive: true,
    },
    {
      level: 14,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 15,
      name: "Martial Archetype Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A sixth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 17,
      name: "Action Surge (2 uses)",
      description: "A second use of Action Surge per rest (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 17,
      name: "Indomitable (3 uses)",
      description: "A third use of Indomitable per rest (see level 9). Mechanically active as of D-124 — see Hero.indomitableMaxUses.",
      mechanicallyActive: true,
    },
    {
      level: 18,
      name: "Martial Archetype Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A seventh Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Extra Attack (3)",
      description: "Attack four times, instead of three, whenever you take the Attack action.",
      mechanicallyActive: true,
    },
  ],
};

/**
 * Wizard — Phase 11.2's spellcasting engine (DECISIONS D-071/D-074).
 *
 * SRD-derived content (see CONTENT_SOURCES.md): the Wizard's name, hit die
 * (d6), saving throw proficiencies (Intelligence/Wisdom), casting ability
 * (Intelligence), the cantrips-known and spell-slot-by-level tables, and its
 * feature names/levels (Spellcasting, Arcane Tradition, Ability Score
 * Improvement, Spell Mastery, Signature Spells) follow SRD 5.2.1 under CC BY
 * 4.0. All feature DESCRIPTIONS are original wording, not copied SRD text —
 * same treatment as the Fighter class above.
 *
 * Like the Fighter, several features are `mechanicallyActive: false` until
 * this game grows the systems they depend on (subclasses, feats, an
 * action-economy hook for anything beyond a cantrip). Spellcasting itself IS
 * active — see `data/spells.ts` and `data/abilities.ts` for why cantrips,
 * specifically, need no new resource system to be real today.
 */
export const WIZARD: CharacterClassDefinition = {
  id: "wizard",
  name: "Wizard",
  hitDie: 6,
  primaryAbility: "int",
  savingThrowProficiencies: ["int", "wis"],
  subclassChoiceLevel: 2,
  attacksPerActionByLevel: {
    1: 1,
  },
  spellcasting: {
    spellcastingAbility: "int",
    cantripsKnownByLevel: FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL,
    spellSlotsByLevel: FULL_CASTER_SPELL_SLOTS_BY_LEVEL,
  },
  features: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "Cast spells using Intelligence. Today that means cantrips, cast at-will (see data/spells.ts) — leveled spells are recorded but inert until this game has a spell-slot resource to spend.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Arcane Tradition",
      description:
        "A subclass choice that further specializes the Wizard. Two arcane traditions are modeled today (see data/subclasses.ts): School of Evocation (SRD, fully inert — no saving-throw/backlash/downtime systems) and Spellblade Tradition (original, Phase 14.2/D-099, a flat AC bonus real).",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description:
        "Raise ability scores or take a feat instead. Mechanically active as of Phase 13.6 (D-091): +2 to one ability score, or +1 to two; or a feat from data/feats.ts (see BattleScene's overlay).",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Arcane Tradition Feature",
      description: "A subclass-specific feature (see level 2's note on the modeled subclass).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 10,
      name: "Arcane Tradition Feature",
      description: "A further subclass-specific feature (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 14,
      name: "Arcane Tradition Feature",
      description: "A further subclass-specific feature (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 18,
      name: "Spell Mastery",
      description:
        "Pick one known spell of level 1-5 (a one-time choice, offered the moment this level is reached) to cast at will, free, forever after.",
      mechanicallyActive: true,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Signature Spells",
      description:
        "Pick two known 3rd-level spells (a one-time choice, offered the moment this level is reached); each casts free once per Short or Long Rest.",
      mechanicallyActive: true,
    },
  ],
};

/**
 * Rogue — Phase 11.3's ranged/skirmisher role (DECISIONS D-071/D-075).
 *
 * SRD-derived content (see CONTENT_SOURCES.md): the Rogue's name, d8 hit
 * die, DEX/INT saving throw proficiencies, and feature names/levels
 * (Expertise, Sneak Attack, Cunning Action, Roguish Archetype, Uncanny
 * Dodge, Evasion, Reliable Talent, Blindsense, Slippery Mind, Elusive,
 * Stroke of Luck) follow SRD 5.2.1 under CC BY 4.0. Feature DESCRIPTIONS are
 * original wording, not copied SRD text — same treatment as Fighter/Wizard.
 *
 * Sneak Attack: a flat rider damage (`bonusDamageByLevel`) added to every
 * attack, converting the SRD's "Nd6" into a flat number the same way
 * `fixedHitDieGain` already does for HP (this game's basic damage numbers
 * stay flat even after Phase 13.1 brought real dice back for the HIT/MISS
 * roll, D-030/D-086). Unlike Fighter's Extra Attack (three feature entries,
 * one per level it changes), Sneak Attack gets ONE feature entry here —
 * restating it at all ten levels it changes would be pure boilerplate; the
 * actual numbers live in `bonusDamageByLevel` and
 * `CharacterSystem.bonusDamageForClassAtLevel`. Cunning Action (Dash) and
 * Uncanny Dodge are ALSO mechanically active as of Phase 13.2 (D-087) — see
 * their own feature entries below.
 */
export const ROGUE: CharacterClassDefinition = {
  id: "rogue",
  name: "Rogue",
  hitDie: 8,
  primaryAbility: "dex",
  savingThrowProficiencies: ["dex", "int"],
  subclassChoiceLevel: 3,
  attacksPerActionByLevel: {
    1: 1,
  },
  bonusDamageByLevel: {
    1: 4,
    3: 8,
    5: 12,
    7: 16,
    9: 20,
    11: 24,
    13: 28,
    15: 32,
    17: 36,
    19: 40,
  },
  features: [
    {
      level: 1,
      name: "Expertise",
      description: "Doubled proficiency on two chosen skills. Inert — this game has no skill-proficiency system.",
      mechanicallyActive: false,
    },
    {
      level: 1,
      name: "Sneak Attack",
      description:
        "Extra damage on a well-placed hit, scaling with level (see `bonusDamageByLevel`). The one Rogue feature that's mechanically active today.",
      mechanicallyActive: true,
    },
    {
      level: 1,
      name: "Thieves' Cant",
      description: "A secret coded dialect. Flavor only — this game has no dialogue/social system.",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Cunning Action",
      description:
        "Dash, Disengage, or Hide as a bonus action. Mechanically active as of Phase 13.2 (D-087), Dash only — a bonus-action second move; Disengage/Hide stay inert (no opportunity-attack or stealth system exists).",
      mechanicallyActive: true,
    },
    {
      level: 3,
      name: "Roguish Archetype",
      description:
        "A subclass choice that further specializes the Rogue. Two roguish archetypes are modeled today (see data/subclasses.ts): Thief (SRD, fully inert — no bonus-action/stealth/extra-turn systems) and Shadowblade (original, Phase 14.2/D-099, a real bonus-damage-on-first-hit feature).",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Uncanny Dodge",
      description:
        "Halve the damage of an attack as a reaction. Mechanically active as of Phase 13.2 (D-087) — auto-applied (no interrupt-prompt UI exists), halving the first hit against this hero each enemy phase once available.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Expertise (2)",
      description: "A second pair of doubled-proficiency skills (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 7,
      name: "Evasion",
      description:
        "Take no damage on a successful Dexterity save against an area effect. Mechanically active as of D-124: a successful forced save already took 0 damage (SavingThrowSystem's existing rule); this hero's Evasion now also HALVES the damage on a FAILED one, instead of taking it in full — see Hero.evasionHalvesFailedSave.",
      mechanicallyActive: true,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 9,
      name: "Roguish Archetype Feature",
      description: "A subclass-specific feature (see level 3's note on the modeled subclass).",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 11,
      name: "Reliable Talent",
      description: "Never fail an easy check on a trained skill. Inert — no skill-proficiency system.",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 13,
      name: "Roguish Archetype Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Blindsense",
      description:
        "Senses hidden/stealthed ENEMIES nearby. Real (D-127): a still-hidden stealth enemy within 2 tiles becomes targetable to THIS Rogue specifically, without revealing it to any other hero or the enemy AI's own targeting.",
      mechanicallyActive: true,
    },
    {
      level: 15,
      name: "Slippery Mind",
      description: "Gains proficiency in Wisdom saving throws. Inert — no saving-throw system.",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 17,
      name: "Roguish Archetype Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 18,
      name: "Elusive",
      description:
        "Attacks against a steady Rogue rarely land clean. Mechanically active as of D-124, now that real Advantage/Disadvantage exists (Phase 13.1, D-086): while this Rogue isn't incapacitated, no enemy attack against it may roll with Advantage (an ambush or a blinded attacker's own Advantage downgrades to Normal) — see Hero.deniesAttackerAdvantage, consumed by WaveSystem's single-target enemy attack.",
      mechanicallyActive: true,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A sixth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Stroke of Luck",
      description: "Once per rest, treat a roll as a guaranteed success. Inert — this game's combat is diceless (D-030).",
      mechanicallyActive: false,
    },
  ],
};

/**
 * Cleric — Phase 11.3's support/healer role (DECISIONS D-071/D-075).
 *
 * SRD-derived content (see CONTENT_SOURCES.md): the Cleric's name, d8 hit
 * die, WIS/CHA saving throw proficiencies, WIS casting ability, and feature
 * names/levels (Spellcasting, Divine Domain, Channel Divinity, Destroy
 * Undead, Divine Intervention, Ability Score Improvement) follow SRD 5.2.1
 * under CC BY 4.0. Feature DESCRIPTIONS are original wording, not copied
 * SRD text — same treatment as Fighter/Wizard/Rogue.
 *
 * Notably, the Cleric's subclass choice (Divine Domain) happens at level 1,
 * not level 2/3 like Wizard/Fighter/Rogue — the SRD's real, class-specific
 * timing, correctly recorded (Phase 11.3's "subclass choice at the correct
 * levels"). Life Domain (`data/subclasses.ts`, D-076) and, as of Phase 14.2
 * (D-099), the original Zeal Domain are the two modeled today.
 *
 * Shares Wizard's exact cantrips-known/spell-slot tables (every SRD full
 * caster does) — see `FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL`/
 * `FULL_CASTER_SPELL_SLOTS_BY_LEVEL` above. Its one mechanically-active
 * cantrip is Sacred Flame (`data/abilities.ts`/`data/spells.ts`) — a
 * "support" caster with no heal mechanic to grant yet reads mechanically
 * like a second blaster today; that's an honest, deliberate simplification,
 * not an oversight (this game has no HP-restoring effect at all).
 */
export const CLERIC: CharacterClassDefinition = {
  id: "cleric",
  name: "Cleric",
  hitDie: 8,
  primaryAbility: "wis",
  savingThrowProficiencies: ["wis", "cha"],
  subclassChoiceLevel: 1,
  attacksPerActionByLevel: {
    1: 1,
  },
  spellcasting: {
    spellcastingAbility: "wis",
    cantripsKnownByLevel: FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL,
    spellSlotsByLevel: FULL_CASTER_SPELL_SLOTS_BY_LEVEL,
  },
  features: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "Cast spells using Wisdom. Today that means cantrips, cast at-will (see data/spells.ts) — leveled spells are recorded but inert until this game has a spell-slot resource to spend.",
      mechanicallyActive: true,
    },
    {
      level: 1,
      name: "Divine Domain",
      description:
        "A subclass choice, made immediately at level 1 (unlike most classes). Two domains are modeled today (see data/subclasses.ts): Life Domain (SRD, its Disciple of Life/Blessed Healer real) and Zeal Domain (original, Phase 14.2/D-099, a flat to-hit bonus real).",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Channel Divinity",
      description: "A limited-use divine effect, once per rest. Inert — no rest/limited-use-resource system exists yet.",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Divine Domain Feature",
      description: "A domain-specific feature (see level 1's note on the Divine Domain choice).",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Destroy Undead",
      description: "Turned undead of low enough threat are destroyed outright. Inert — no undead/threat-rating mechanic exists yet.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Channel Divinity (2/rest)",
      description: "A second use of Channel Divinity per rest (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 7,
      name: "Divine Domain Feature",
      description: "A further domain-specific feature (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 9,
      name: "Divine Domain Feature",
      description: "A further domain-specific feature (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Divine Intervention",
      description: "Call directly on your deity for aid. Inert — this game has no DM-adjudicated/petition mechanic.",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 14,
      name: "Divine Domain Feature",
      description: "A further domain-specific feature (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 18,
      name: "Channel Divinity (3/rest)",
      description: "A third use of Channel Divinity per rest (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Divine Intervention Improvement",
      description: "Divine Intervention becomes far more reliable (see level 10).",
      mechanicallyActive: false,
    },
  ],
};

/**
 * Phase 13.8 (D-093): the remaining eight core SRD classes. Kevin rejected
 * the earlier "one flashy hook, everything else inert" pattern outright —
 * every class below gets its real, iconic mechanic wired in and playable
 * (adding small new supporting concepts on `Hero` where genuinely needed:
 * a Rage/Wild Shape damage-resistance duration, a Ki/Sorcery-Points resource
 * pool, Bardic Inspiration's ally buff, Divine Smite/Hunter's Mark spending a
 * spell slot on a landed hit), not just one showcase feature per class with
 * the rest waved off as "no system exists." See D-093 for the full scoping
 * notes and exactly which mechanic each class got.
 *
 * SRD-derived content (see CONTENT_SOURCES.md): every class's name, hit die,
 * saving-throw proficiencies, spellcasting ability/progression, and feature
 * names/levels follow SRD 5.2.1 under CC BY 4.0. Feature DESCRIPTIONS are
 * original wording, not copied SRD text — same treatment as Fighter/Wizard/
 * Rogue/Cleric above. A handful of feature descriptions explicitly note
 * where this game's diceless/no-advantage/no-skill/no-initiative boundaries
 * (D-030, D-047, D-086) leave a real SRD feature honestly inert, exactly
 * like every existing class's own inert entries.
 */
const HALF_CASTER_SPELL_SLOTS_BY_LEVEL: Record<number, number[]> = {
  1: [],
  2: [2],
  3: [3],
  4: [3],
  5: [4, 2],
  7: [4, 3],
  9: [4, 3, 2],
  11: [4, 3, 3],
  13: [4, 3, 3, 1],
  15: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2],
};

export const BARBARIAN: CharacterClassDefinition = {
  id: "barbarian",
  name: "Barbarian",
  hitDie: 12,
  primaryAbility: "str",
  savingThrowProficiencies: ["str", "con"],
  subclassChoiceLevel: 3,
  attacksPerActionByLevel: {
    1: 1,
    5: 2,
  },
  features: [
    {
      level: 1,
      name: "Rage",
      description:
        "A bonus-action battle fury: while raging, incoming damage is halved and every attack deals extra damage, for a limited number of turns and a limited number of uses per Long Rest. Mechanically active this phase (D-093) — see Hero.useRage/isRaging.",
      mechanicallyActive: true,
    },
    {
      level: 1,
      name: "Unarmored Defense",
      description:
        "Armor Class of 10 + Dexterity + Constitution while unarmored. Inert — this game has no armor-catalogue/conditional-AC system (same boundary as every class's flat baseArmorClass).",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Reckless Attack",
      description:
        "A per-turn toggle (no action cost): attack with advantage this turn, at the cost of granting advantage to every attack against you until your next turn.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Danger Sense",
      description:
        "Advantage on Dexterity saves against effects you can see. Mechanically active as of D-124: every forced saving throw this game gives a hero rolls DEX (WaveSystem.resolveSavingThrowAttack), matching this feature's real SRD scope exactly — see Hero.savingThrowAdvantage.",
      mechanicallyActive: true,
    },
    {
      level: 3,
      name: "Primal Path",
      description: "A subclass choice that further specializes the Barbarian. Two primal paths are modeled today (see data/subclasses.ts): Path of the Berserker (SRD, Phase 14/D-097, fully inert) and Path of the Ironhide (original, Phase 14.2/D-099, a real +AC-while-raging bonus).",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Extra Attack",
      description: "Attack twice, instead of once, whenever you take the Attack action.",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Fast Movement",
      description: "+10ft speed while unarmored. Inert — a created hero's movementTiles comes fixed from its race, with no per-class speed modifier hookup yet.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Primal Path Feature",
      description: "A subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 7,
      name: "Feral Instinct",
      description: "Advantage on initiative; act normally even when surprised. Inert — no initiative/surprise system (InitiativeSystem stays framework-only, D-090).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 9,
      name: "Brutal Critical (1 die)",
      description: "An extra weapon damage die on a critical hit. Inert — this game's damage is a flat number, not rolled dice (D-030), so there's no extra die to add.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Primal Path Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 11,
      name: "Relentless Rage",
      description: "Avoid dropping to 0 HP while raging on a successful Constitution save. Inert — no saving-throw-triggered death-prevention hook exists.",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 13,
      name: "Brutal Critical (2 dice)",
      description: "A second extra weapon damage die on a crit (see level 9).",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Primal Path Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 15,
      name: "Persistent Rage",
      description: "Rage no longer ends early from a quiet turn. Inert today — this game's simplified Rage just runs a fixed turn counter regardless (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 17,
      name: "Brutal Critical (3 dice)",
      description: "A third extra weapon damage die on a crit (see level 9).",
      mechanicallyActive: false,
    },
    {
      level: 18,
      name: "Indomitable Might",
      description: "A Strength check total below your Strength score is treated as your Strength score. Inert — no skill-check system.",
      mechanicallyActive: false,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Primal Champion",
      description: "+4 Strength and Constitution, above the usual 20 cap. Inert — this game's Ability Score Improvement is capped at 20 for every class (see Hero.improveAbilityScore).",
      mechanicallyActive: false,
    },
  ],
};

export const BARD: CharacterClassDefinition = {
  id: "bard",
  name: "Bard",
  hitDie: 8,
  primaryAbility: "cha",
  savingThrowProficiencies: ["dex", "cha"],
  subclassChoiceLevel: 3,
  attacksPerActionByLevel: {
    1: 1,
  },
  spellcasting: {
    spellcastingAbility: "cha",
    cantripsKnownByLevel: FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL,
    spellSlotsByLevel: FULL_CASTER_SPELL_SLOTS_BY_LEVEL,
  },
  features: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "Cast spells using Charisma — a cantrip (Vicious Mockery) and, from a 1st-level slot, Healing Word (this game's second ally-targeted spell, after Cure Wounds). See data/spells.ts.",
      mechanicallyActive: true,
    },
    {
      level: 1,
      name: "Bardic Inspiration",
      description:
        "A bonus action grants a nearby ally a flat bonus to their next attack roll and damage, a limited number of times per Long Rest. Mechanically active this phase (D-093) — see Hero.useBardicInspiration/receiveInspiration.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Jack of All Trades",
      description: "Half proficiency bonus on ability checks you aren't otherwise proficient in. Inert — no skill-proficiency system.",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Song of Rest",
      description: "Extra healing for the party during a Short Rest. Inert — this pass's one new ally-support mechanic is Bardic Inspiration itself (see level 1); a Rest-tied heal bonus is a natural future slice.",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Bard College",
      description: "A subclass choice that further specializes the Bard. Two colleges are modeled today (see data/subclasses.ts): College of Lore (SRD, Phase 14/D-097, fully inert) and College of the Blade (original, Phase 14.2/D-099, a real flat to-hit bonus).",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Expertise",
      description: "Doubled proficiency on two chosen skills. Inert — no skill-proficiency system.",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Bardic Inspiration (d8)",
      description: "Bardic Inspiration's die size grows (see level 1) — this game's flat bonus is unaffected by die size, so nothing further to wire.",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Font of Inspiration",
      description: "Bardic Inspiration now recharges on a Short Rest, not just a Long Rest. Mechanically active — see Hero.shortRest's level-gated Bard branch.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Countercharm",
      description: "Shields nearby allies from being frightened or charmed. Inert — no fear/charm status effect exists.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Bard College Feature",
      description: "A subclass-specific feature (see level 3's note on Bard College).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 9,
      name: "Song of Rest (d8)",
      description: "Song of Rest's die size grows (see level 2). Still inert for the same reason.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Bardic Inspiration (d10)",
      description: "Bardic Inspiration's die size grows again (see level 1). Still mechanically active, unaffected by die size.",
      mechanicallyActive: true,
    },
    {
      level: 10,
      name: "Expertise (2)",
      description: "A second pair of doubled-proficiency skills (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Magical Secrets",
      description: "Learn spells from any class's spell list. Inert — this game's known-spell list is fixed per class (data/characterCreation.ts), no free-pick mechanism.",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 13,
      name: "Song of Rest (d10)",
      description: "Song of Rest's die size grows again (see level 2). Still inert.",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Magical Secrets (2)",
      description: "A second pair of borrowed spells (see level 10). Still inert.",
      mechanicallyActive: false,
    },
    {
      level: 15,
      name: "Bardic Inspiration (d12)",
      description: "Bardic Inspiration's die size grows a final time (see level 1). Still mechanically active.",
      mechanicallyActive: true,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 18,
      name: "Song of Rest (d12)",
      description: "Song of Rest's die size grows a final time (see level 2). Still inert.",
      mechanicallyActive: false,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Superior Inspiration",
      description: "Regain one use of Bardic Inspiration on rolling initiative with none left. Inert — no initiative system.",
      mechanicallyActive: false,
    },
  ],
};

export const DRUID: CharacterClassDefinition = {
  id: "druid",
  name: "Druid",
  hitDie: 8,
  primaryAbility: "wis",
  savingThrowProficiencies: ["int", "wis"],
  subclassChoiceLevel: 2,
  attacksPerActionByLevel: {
    1: 1,
  },
  spellcasting: {
    spellcastingAbility: "wis",
    cantripsKnownByLevel: FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL,
    spellSlotsByLevel: FULL_CASTER_SPELL_SLOTS_BY_LEVEL,
  },
  features: [
    {
      level: 1,
      name: "Druidic",
      description: "A secret druidic language. Flavor only — this game has no dialogue/social system.",
      mechanicallyActive: false,
    },
    {
      level: 1,
      name: "Spellcasting",
      description:
        "Cast spells using Wisdom — a cantrip (Produce Flame) and, from a 1st-level slot, Cure Wounds (shared with the Cleric's own spell of the same name). See data/spells.ts.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Wild Shape",
      description:
        "A bonus action that assumes a beast's resilience: heals a flat amount and halves incoming damage for a limited number of turns, a limited number of times per Long Rest. Mechanically active this phase (D-093), simplified — see Hero.useWildShape. Not a real stat-block transformation (no creature-stat-block system exists), just its defensive payoff.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Druid Circle",
      description: "A subclass choice that further specializes the Druid. Two circles are modeled today (see data/subclasses.ts): Circle of the Land (SRD, corrected in Phase 14.1/D-098 from a mistaken Circle of the Moon — its Natural Recovery is real) and Circle of the Ashen Veil (original, Phase 14.2/D-099, a real Wild-Shape-heal bonus).",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 4,
      name: "Wild Shape Improvement",
      description: "Wild Shape can assume higher-CR beasts. Inert — this game's Wild Shape has no creature stat blocks to unlock (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Druid Circle Feature",
      description: "A subclass-specific feature (see level 2's note on Druid Circle).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 8,
      name: "Wild Shape Improvement (Fly)",
      description: "Wild Shape can assume flying beasts. Inert — same reason as level 4's improvement.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Druid Circle Feature",
      description: "A further subclass-specific feature (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 14,
      name: "Druid Circle Feature",
      description: "A further subclass-specific feature (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 18,
      name: "Timeless Body",
      description: "Ages far slower. Flavor only — this game has no aging/time-passage mechanic.",
      mechanicallyActive: false,
    },
    {
      level: 18,
      name: "Beast Spells",
      description: "Cast spells while Wild Shaped. Inert — this game's Wild Shape isn't a real transformation to cast around (see level 2).",
      mechanicallyActive: false,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Archdruid",
      description: "Unlimited Wild Shape uses. Inert today — this game's Wild Shape keeps a flat per-Long-Rest cap regardless of level (see level 2).",
      mechanicallyActive: false,
    },
  ],
};

export const MONK: CharacterClassDefinition = {
  id: "monk",
  name: "Monk",
  hitDie: 8,
  primaryAbility: "dex",
  savingThrowProficiencies: ["str", "dex"],
  subclassChoiceLevel: 3,
  attacksPerActionByLevel: {
    1: 1,
    5: 2,
  },
  features: [
    {
      level: 1,
      name: "Martial Arts",
      description:
        "Unarmed strikes scale off Dexterity instead of Strength (mechanically active — see CharacterSystem.combatStatsForClassLevel's Monk branch). The SRD's free bonus-action unarmed strike is folded into this game's Ki/Flurry of Blows below (level 2), a deliberate simplification rather than two separate bonus-action mechanics.",
      mechanicallyActive: true,
    },
    {
      level: 1,
      name: "Unarmored Defense",
      description: "Armor Class of 10 + Dexterity + Wisdom while unarmored and unarmed. Inert — same boundary as the Barbarian's own Unarmored Defense.",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Ki",
      description:
        "A resource pool spent on Flurry of Blows: a bonus action, after the Attack action, for another attack. Mechanically active this phase (D-093) — see Hero.useFlurryOfBlows. Ki's other SRD uses (Patient Defense, Step of the Wind, and later Stunning Strike) are a natural future slice, not built this pass.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Unarmored Movement",
      description: "+10ft speed while unarmored. Inert — same boundary as the Barbarian's Fast Movement.",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Monastic Tradition",
      description: "A subclass choice that further specializes the Monk. Two traditions are modeled today (see data/subclasses.ts): Way of the Open Hand (SRD, Phase 14/D-097, fully inert) and Way of the Iron Body (original, Phase 14.2/D-099, a real flat max-HP-per-level bonus).",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Deflect Missiles",
      description: "Reduce damage from a ranged weapon attack, and sometimes catch and throw it back. Inert — no reaction-based damage-reduction hook beyond Uncanny Dodge's own class gate.",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 4,
      name: "Slow Fall",
      description: "Reduce fall damage. Inert — this game has no falling/fall-damage mechanic.",
      mechanicallyActive: false,
    },
    {
      level: 5,
      name: "Extra Attack",
      description: "Attack twice, instead of once, whenever you take the Attack action.",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Stunning Strike",
      description: "Spend a Ki point on a hit to force a Constitution save or be stunned. Inert this pass — Flurry of Blows was chosen as this class's one Ki-spending mechanic (see level 2); a save-based stun is a natural next slice.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Ki-Empowered Strikes",
      description: "Unarmed strikes count as magical for the purpose of resistance/immunity. Inert — this game has no damage-type resistance/immunity system.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Monastic Tradition Feature",
      description: "A subclass-specific feature (see level 3's note on Monastic Tradition).",
      mechanicallyActive: false,
    },
    {
      level: 7,
      name: "Evasion",
      description:
        "Take no damage on a successful Dexterity save against an area effect. Mechanically active as of D-124 — see the Rogue's own level-7 Evasion note above; identical rule, same Hero.evasionHalvesFailedSave getter.",
      mechanicallyActive: true,
    },
    {
      level: 7,
      name: "Stillness of Mind",
      description: "End your own frightened or charmed condition at will. Inert — no fear/charm status effect exists.",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 9,
      name: "Unarmored Movement Improvement",
      description: "Move along vertical surfaces and across liquids. Inert — no wall-climb/water-walk movement rule.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Purity of Body",
      description: "Immunity to disease and poison. Inert — no disease/poison status effect exists.",
      mechanicallyActive: false,
    },
    {
      level: 11,
      name: "Monastic Tradition Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 13,
      name: "Tongue of the Sun and Moon",
      description: "Understand and be understood by any spoken language. Flavor only — no dialogue/social system.",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Diamond Soul",
      description: "Proficiency in all saving throws; spend Ki to reroll a failed save. Inert — no full saving-throw-proficiency system beyond the fixed per-class list.",
      mechanicallyActive: false,
    },
    {
      level: 15,
      name: "Timeless Body",
      description: "Ages far slower; no longer needs food or water. Flavor only — no such mechanic exists.",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 17,
      name: "Monastic Tradition Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 18,
      name: "Empty Body",
      description:
        "Spends this hero's whole Ki pool (the SRD's real 4-point cost exceeds this game's flat 3-per-rest simplification) and the action to turn invisible outright, hidden from enemy targeting until it attacks or casts. (Astral Projection is not modeled — no plane-shifting mechanic exists.)",
      mechanicallyActive: true,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Perfect Self",
      description: "Regain Ki points on rolling initiative with none left. Inert — no initiative system.",
      mechanicallyActive: false,
    },
  ],
};

export const PALADIN: CharacterClassDefinition = {
  id: "paladin",
  name: "Paladin",
  hitDie: 10,
  primaryAbility: "str",
  savingThrowProficiencies: ["wis", "cha"],
  subclassChoiceLevel: 3,
  attacksPerActionByLevel: {
    1: 1,
    5: 2,
  },
  spellcasting: {
    spellcastingAbility: "cha",
    cantripsKnownByLevel: {},
    spellSlotsByLevel: HALF_CASTER_SPELL_SLOTS_BY_LEVEL,
  },
  features: [
    {
      level: 1,
      name: "Divine Sense",
      description: "Detect the presence of undead/fiends nearby. Inert — no such enemy-type tagging system.",
      mechanicallyActive: false,
    },
    {
      level: 1,
      name: "Lay on Hands",
      description: "A pool of HP spent to heal on touch. Inert this pass — Divine Smite (level 2) was chosen as this class's one signature mechanic; a healing-pool is a natural future slice, distinct from Cure Wounds/Healing Word's slot-based heals.",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Fighting Style",
      description: "A combat specialization chosen at level 2 (see the Fighter's own level-1 Fighting Style note).",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Spellcasting",
      description:
        "A half-caster's spell slots, using Charisma — starting at level 2, half the pace of a full caster (Wizard/Cleric/Bard/Druid/Sorcerer/Warlock). No cantrips (the SRD's real Paladin has none). Its one real consequence today is powering Divine Smite below.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Divine Smite",
      description:
        "Spending a spell slot on a landed melee hit deals extra radiant damage. Auto-applied the instant a hit lands whenever a slot remains (no interrupt-prompt UI exists, same precedent as Uncanny Dodge/Lucky). Mechanically active this phase (D-093) — see BattleScene's applyPaladinSmite.",
      mechanicallyActive: true,
    },
    {
      level: 3,
      name: "Divine Health",
      description: "Immunity to disease. Inert — no disease status effect exists.",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Sacred Oath",
      description: "A subclass choice that further specializes the Paladin. Two oaths are modeled today (see data/subclasses.ts): Oath of Devotion (SRD, Phase 14/D-097, fully inert) and Oath of Retribution (original, Phase 14.2/D-099, a real Divine-Smite-bonus increase).",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Extra Attack",
      description: "Attack twice, instead of once, whenever you take the Attack action.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Aura of Protection",
      description: "Nearby allies add your Charisma modifier to their saving throws. Inert — no proximity-aura system.",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 10,
      name: "Aura of Courage",
      description: "Nearby allies can't be frightened while you're conscious. Inert — no fear status effect exists.",
      mechanicallyActive: false,
    },
    {
      level: 11,
      name: "Improved Divine Smite",
      description: "Every weapon hit deals bonus radiant damage, at no slot cost. Inert this pass — this game's Divine Smite stays the flat, slot-spending version (see level 2); a passive always-on upgrade is a natural future slice.",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 14,
      name: "Cleansing Touch",
      description: "End a spell affecting you or an ally. Inert — this game has no dispellable-ongoing-spell-effect concept.",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 18,
      name: "Aura Improvements",
      description: "Aura of Protection/Courage's range grows. Inert — same boundary as level 6/10.",
      mechanicallyActive: false,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Sacred Oath Capstone",
      description: "A subclass-specific capstone feature (see level 3). Oath of Devotion's own capstone, Holy Nimbus, is modeled but inert for its own reasons (see data/subclasses.ts).",
      mechanicallyActive: false,
    },
  ],
};

export const RANGER: CharacterClassDefinition = {
  id: "ranger",
  name: "Ranger",
  hitDie: 10,
  primaryAbility: "dex",
  savingThrowProficiencies: ["str", "dex"],
  subclassChoiceLevel: 3,
  attacksPerActionByLevel: {
    1: 1,
    5: 2,
  },
  spellcasting: {
    spellcastingAbility: "wis",
    cantripsKnownByLevel: {},
    spellSlotsByLevel: HALF_CASTER_SPELL_SLOTS_BY_LEVEL,
  },
  features: [
    {
      level: 1,
      name: "Favored Enemy",
      description: "Bonus knowledge/tracking against a chosen enemy type. Inert — no enemy-type tagging system.",
      mechanicallyActive: false,
    },
    {
      level: 1,
      name: "Natural Explorer",
      description: "Bonuses while traveling a favored terrain. Inert — no terrain-travel bonus system beyond the existing terrain-effect tiles.",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Fighting Style",
      description: "A combat specialization chosen at level 2 (see the Fighter's own level-1 Fighting Style note).",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Spellcasting",
      description:
        "A half-caster's spell slots, using Wisdom — starting at level 2, same pace as the Paladin. No cantrips. Its one real consequence today is powering Hunter's Mark below.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Signature Spell: Hunter's Mark",
      description:
        "A bonus action, spending a 1st-level slot, marks the nearest enemy in reach — attacks against a marked target deal bonus damage until it falls. Auto-targets rather than a separate aim step (same auto-apply precedent as Uncanny Dodge/Lucky). Mechanically active this phase (D-093) — see Hero.useHuntersMark/markedTargetId.",
      mechanicallyActive: true,
    },
    {
      level: 3,
      name: "Ranger Conclave",
      description: "A subclass choice that further specializes the Ranger. Two conclaves are modeled today (see data/subclasses.ts): Hunter (SRD, Phase 14/D-097 — Colossus Slayer's bonus damage against this Ranger's own Hunter's Mark target is real, see Hero.colossusSlayerBonus) and Beastbond Warden (original, Phase 14.2/D-099 — Bonded Strike's self-heal on the same marked target is real, see Hero.beastbondStrikeHeal).",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Primeval Awareness",
      description: "Sense certain creature types nearby. Inert — no enemy-type tagging system.",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 5,
      name: "Extra Attack",
      description: "Attack twice, instead of once, whenever you take the Attack action.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Favored Enemy Improvement",
      description: "A second favored enemy type (see level 1). Still inert.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Natural Explorer Improvement",
      description: "A second favored terrain (see level 1). Still inert.",
      mechanicallyActive: false,
    },
    {
      level: 7,
      name: "Ranger Conclave Feature",
      description: "A subclass-specific feature (see level 3's note on Ranger Conclave).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 8,
      name: "Land's Stride",
      description: "Move through difficult terrain at full speed. Inert — this game's terrain-effect tiles apply uniformly, no per-class terrain exemption.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Natural Explorer Improvement",
      description: "A third favored terrain (see level 1). Still inert.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Hide in Plain Sight",
      description: "A flat +10 to a Stealth check made while camouflaged and standing still — auto-applied to Vanish's check below.",
      mechanicallyActive: true,
    },
    {
      level: 11,
      name: "Ranger Conclave Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 14,
      name: "Vanish",
      description:
        "A bonus action attempting a Stealth check against nearby enemies; success hides this hero from enemy targeting until it attacks or casts. (\"Can't be tracked non-magically\" is not separately modeled — no tracking mechanic exists.)",
      mechanicallyActive: true,
    },
    {
      level: 15,
      name: "Ranger Conclave Feature",
      description: "A further subclass-specific feature (see level 3).",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 18,
      name: "Feral Senses",
      description:
        "Senses invisible/hidden ENEMIES nearby. Real (D-127): a still-hidden stealth enemy within 2 tiles becomes targetable to THIS Ranger specifically, without revealing it to any other hero or the enemy AI's own targeting.",
      mechanicallyActive: true,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Foe Slayer",
      description: "Add your Wisdom modifier to one attack or damage roll against a favored enemy each turn. Inert — depends on Favored Enemy's tagging system (see level 1).",
      mechanicallyActive: false,
    },
  ],
};

export const SORCERER: CharacterClassDefinition = {
  id: "sorcerer",
  name: "Sorcerer",
  hitDie: 6,
  primaryAbility: "cha",
  savingThrowProficiencies: ["con", "cha"],
  subclassChoiceLevel: 1,
  attacksPerActionByLevel: {
    1: 1,
  },
  spellcasting: {
    spellcastingAbility: "cha",
    cantripsKnownByLevel: FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL,
    spellSlotsByLevel: FULL_CASTER_SPELL_SLOTS_BY_LEVEL,
  },
  features: [
    {
      level: 1,
      name: "Spellcasting",
      description:
        "Cast spells using Charisma — a cantrip (Fire Bolt, shared with the Wizard's) and, from a 1st-level slot, Magic Missile (also shared). See data/spells.ts.",
      mechanicallyActive: true,
    },
    {
      level: 1,
      name: "Sorcerous Origin",
      description: "A subclass choice that further specializes the Sorcerer, made immediately at level 1 (like the Cleric's Divine Domain). Two origins are modeled today (see data/subclasses.ts): Draconic Bloodline (SRD, Phase 14/D-097 — Draconic Resilience's bonus HP is real, see Hero.subclassHpPerLevelBonus) and Wildsurge Origin (original, Phase 14.2/D-099 — Volatile Magic's +1 Sorcery Point is real).",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Font of Magic",
      description:
        "A Sorcery Points resource pool, recharging on a Long Rest. Mechanically active this phase (D-093) — it powers Metamagic: Quickened Spell below (converting slots to points and back is a natural future slice, not built this pass).",
      mechanicallyActive: true,
    },
    {
      level: 3,
      name: "Metamagic: Quickened Spell",
      description:
        "Spend a bonus action and Sorcery Points to cast your next spell using your bonus action instead of your action, freeing your action for a basic attack the same turn. Mechanically active this phase (D-093) — see Hero.useQuickenSpell/quickenedSpellReady. The SRD's other Metamagic options (Twinned, Subtle, etc.) stay a future slice.",
      mechanicallyActive: true,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Sorcerous Origin Feature",
      description: "A subclass-specific feature (see level 1's note on Sorcerous Origin).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 10,
      name: "Metamagic (2nd option)",
      description: "A second Metamagic option (see level 3). Inert this pass — only Quickened Spell is modeled.",
      mechanicallyActive: false,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 14,
      name: "Sorcerous Origin Feature",
      description: "A further subclass-specific feature (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 17,
      name: "Sorcerous Origin Feature",
      description: "A further subclass-specific feature (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 18,
      name: "Metamagic (3rd option)",
      description: "A third Metamagic option (see level 3). Still inert.",
      mechanicallyActive: false,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Sorcerous Restoration",
      description: "Regain 4 Sorcery Points on a Short Rest. Inert — this game's Sorcery Points stay Long-Rest-only regardless of level (see level 2).",
      mechanicallyActive: false,
    },
  ],
};

export const WARLOCK: CharacterClassDefinition = {
  id: "warlock",
  name: "Warlock",
  hitDie: 8,
  primaryAbility: "cha",
  savingThrowProficiencies: ["wis", "cha"],
  subclassChoiceLevel: 1,
  attacksPerActionByLevel: {
    1: 1,
  },
  spellcasting: {
    spellcastingAbility: "cha",
    // Phase 13.8 (D-093): a deliberate simplification, per Kevin's own
    // scoping call — the SRD's real Pact Magic uses far fewer slots, always
    // at the caster's highest available level, not this shared full-caster
    // table. What actually makes this a Warlock, mechanically, is the
    // SHORT-rest recharge below (Hero.shortRest's Warlock branch) — the
    // SRD's real, distinctive Pact Magic cadence — not the slot count/shape.
    cantripsKnownByLevel: FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL,
    spellSlotsByLevel: FULL_CASTER_SPELL_SLOTS_BY_LEVEL,
  },
  features: [
    {
      level: 1,
      name: "Otherworldly Patron",
      description: "A subclass choice that further specializes the Warlock, made immediately at level 1 (like the Cleric's Divine Domain/the Sorcerer's Sorcerous Origin). Two patrons are modeled today (see data/subclasses.ts): The Fiend (SRD, Phase 14/D-097 — Dark One's Blessing's kill-heal is real, see Hero.darkOnesBlessingHeal) and Starbound Patron (original, Phase 14.2/D-099 — Umbral Ward's bonus HP is real, see Hero.subclassHpPerLevelBonus).",
      mechanicallyActive: false,
    },
    {
      level: 1,
      name: "Pact Magic",
      description:
        "Cast spells using Charisma — a cantrip (Eldritch Blast) and, from a 1st-level slot, Magic Missile (shared with the Wizard/Sorcerer). Mechanically active this phase (D-093), including its real, distinctive cadence: these slots restore on a SHORT Rest, not just a Long Rest (unlike every other caster class here) — see Hero.shortRest's Warlock branch.",
      mechanicallyActive: true,
    },
    {
      level: 2,
      name: "Eldritch Invocations",
      description: "A menu of small always-on magical upgrades. Inert — no invocation-picker UI exists.",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Pact Boon",
      description: "A further subclass-adjacent choice (Blade/Chain/Tome). Inert — no pact-boon system.",
      mechanicallyActive: false,
    },
    {
      level: 4,
      name: "Ability Score Improvement",
      description: "Raise ability scores or take a feat (see the Fighter's level 4 note in this file).",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Otherworldly Patron Feature",
      description: "A subclass-specific feature (see level 1's note on Otherworldly Patron).",
      mechanicallyActive: false,
    },
    {
      level: 8,
      name: "Ability Score Improvement",
      description: "A second Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 10,
      name: "Otherworldly Patron Feature",
      description: "A further subclass-specific feature (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 11,
      name: "Mystic Arcanum (6th level)",
      description: "Pick one known 6th-level spell (a one-time choice, offered the moment this level is reached) to cast free, once per Long Rest.",
      mechanicallyActive: true,
    },
    {
      level: 12,
      name: "Ability Score Improvement",
      description: "A third Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 13,
      name: "Mystic Arcanum (7th level)",
      description: "A further once-per-Long-Rest free spell pick (see level 11's 6th-level tier) — a known 7th-level spell this time.",
      mechanicallyActive: true,
    },
    {
      level: 14,
      name: "Otherworldly Patron Feature",
      description: "A further subclass-specific feature (see level 1).",
      mechanicallyActive: false,
    },
    {
      level: 15,
      name: "Mystic Arcanum (8th level)",
      description: "A further once-per-Long-Rest free spell pick (see level 11's 6th-level tier) — a known 8th-level spell this time.",
      mechanicallyActive: true,
    },
    {
      level: 16,
      name: "Ability Score Improvement",
      description: "A fourth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 17,
      name: "Mystic Arcanum (9th level)",
      description: "A final once-per-Long-Rest free spell pick (see level 11's 6th-level tier) — a known 9th-level spell this time.",
      mechanicallyActive: true,
    },
    {
      level: 19,
      name: "Ability Score Improvement",
      description: "A fifth Ability Score Improvement (see level 4).",
      mechanicallyActive: true,
    },
    {
      level: 20,
      name: "Eldritch Master",
      description: "Regain all spell slots by entreating your patron once per Long Rest. Inert — this game's Pact Magic already recharges on a Short Rest (see level 1), making this redundant today.",
      mechanicallyActive: false,
    },
  ],
};

export const CLASS_DEFINITIONS: CharacterClassDefinition[] = [
  FIGHTER,
  WIZARD,
  ROGUE,
  CLERIC,
  BARBARIAN,
  BARD,
  DRUID,
  MONK,
  PALADIN,
  RANGER,
  SORCERER,
  WARLOCK,
];

/** Look up a class definition, throwing on an unknown id so typos fail loudly. */
export function getClassDefinition(id: string): CharacterClassDefinition {
  const def = CLASS_DEFINITIONS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown class id "${id}".`);
  return def;
}
