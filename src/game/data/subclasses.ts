import type { ClassFeature } from "./classes";

/**
 * Subclasses — Phase 11.3's follow-up (DECISIONS D-071/D-075/D-076). Every
 * class's top-level feature table already records WHEN its subclass choice
 * happens (Fighter: level 3, Wizard: level 2, Rogue: level 3, Cleric: level
 * 1) — this file records WHAT each class's modeled subclasses actually
 * grant, feature by feature. As of Phase 14.2 (D-099), every class has
 * exactly TWO: one SRD-derived (attributed below, per class) and one
 * original (Phase 14.2's own twelve, `PATH_OF_THE_IRONHIDE` onward).
 *
 * SRD-derived content (see CONTENT_SOURCES.md): the FIRST subclass listed
 * per class below (Champion/School of Evocation/Thief/Life Domain/Path of
 * the Berserker/College of Lore/Circle of the Land/Way of the Open
 * Hand/Oath of Devotion/Hunter/Draconic Bloodline/The Fiend) — its name and
 * feature names/levels follow SRD 5.1/5.2.1 under CC BY 4.0. Feature
 * DESCRIPTIONS are original wording, not copied SRD text — same treatment
 * as every class table. The SECOND subclass per class is entirely original
 * (name, flavor, and mechanics) — see the Phase 14.2 module doc below for
 * why there isn't a third, properly-licensed SRD option to add instead.
 *
 * Through Phase 13.10, EVERY feature below was `mechanicallyActive: false`.
 * That was not an oversight: a subclass's earliest feature never landed
 * before its class's own subclass-choice level, and every created character
 * was always level 1 (Phase 11.1's original boundary) with no way to ever
 * actually GET a subclass. Phase 13.11 (D-096) changes both halves of that:
 * `Hero.levelUpClass()` now really reaches these levels (13.3), and
 * `CharacterCreationScene`/`BattleScene`'s level-up flow now actually
 * ASSIGNS a hero's one modeled subclass once it does (Cleric at creation,
 * since its choice is level 1; Fighter/Wizard/Rogue via a queued
 * confirmation the first time `levelUpClass()` reaches level 3/2/3 — see
 * `CharacterSystem.subclassGrantedAtLevel`). With subclass choice now real,
 * this pass re-audited every feature below against everything Phase
 * 13.1-13.10 built (real dice/crits, saving throws, a bonus action, a Rest
 * system, ally healing) and wired in whichever ones that unlocked:
 * Champion's Improved Critical/Superior Critical (a real crit-range widen,
 * now that `CombatSystem` rolls real d20 crits — D-086) and Life Domain's
 * Disciple of Life/Blessed Healer (real bonus healing, now that Cure
 * Wounds — this game's first HP-restoring effect — exists — D-092). Every
 * OTHER feature stayed `mechanicallyActive: false`, but several had their
 * INERT REASON corrected where it had gone stale (e.g. Thief's Fast Hands
 * used to blame "no bonus action" — untrue since 13.2 — when the real
 * blocker is "no object-interaction mechanic"); nothing else was invented
 * or newly wired beyond what's noted above.
 *
 * Phase 14 (D-097): a real, named subclass for each of the eight classes
 * Phase 13.8 (D-093) added with no subclass yet — Barbarian, Bard, Druid,
 * Monk, Paladin, Ranger, Sorcerer, Warlock — same "one real subclass per
 * class, honestly scored against every existing system" treatment this
 * file already gave Fighter/Wizard/Rogue/Cleric (D-076), not a full menu of
 * alternatives. Three features clear the same bar Champion/Life Domain
 * did — a genuinely existing system to plug a flat number into, not a new
 * one invented for the occasion: Draconic Bloodline's Draconic Resilience
 * (flat bonus HP per level), Hunter's Colossus Slayer (bonus damage on the
 * Ranger's own Hunter's Mark target, extending
 * `BattleScene.applyHuntersMarkBonus`'s existing hookup — see
 * `Hero.colossusSlayerBonus`), and The Fiend's Dark One's Blessing (a flat
 * self-heal on a kill, the same shape as equipment's `onKillHealNearestAlly`
 * proc, just self-targeting and class-gated instead of item-gated — see
 * `Hero.darkOnesBlessingHeal`, applied in `BattleScene.applyDarkOnesBlessing`).
 *
 * Phase 14.1 (D-098): a correction. Druid's Phase 14 subclass was mistakenly
 * Circle of the Moon, which is genuine Player's Handbook content the free
 * SRD has never included (under either OGL 1.0a or CC BY 4.0). Replaced with
 * the real SRD-licensed circle, **Circle of the Land** — see that
 * definition below for the correction note, and D-098 for the full story.
 *
 * Phase 14.2 (D-099): every class now has a SECOND, ORIGINAL subclass —
 * `PATH_OF_THE_IRONHIDE` through `SPELLBLADE_TRADITION` below. Both SRD
 * versions were verified directly (not assumed) to only ever detail ONE
 * subclass per class; the rest of the real D&D subclass roster (Battle
 * Master, Totem Warrior, College of Valor, six more Cleric domains, Circle
 * of the Moon, Way of Shadow, Oath of Vengeance, Beast Master, Assassin,
 * Wild Magic, the other Warlock patrons, seven more Wizard schools) is
 * Player's Handbook-only content with no open license covering it. These
 * twelve are original names/flavor/mechanics instead — see the module doc
 * right above `PATH_OF_THE_IRONHIDE` for the full reasoning and design bar.
 *
 * Every other feature not named above stays `mechanicallyActive: false` for
 * the same kind of honest, specific reason every existing inert feature
 * already documents (no push/prone, no reaction-based damage reduction
 * beyond Uncanny Dodge's own Rogue gate, no creature-stat-block
 * transformation, no channel-divinity resource for a class that isn't
 * Cleric, no companion-entity/random-surge-table/enemy-weakness system,
 * etc.) — nothing invented beyond the hookups named throughout this file.
 *
 * Phase 15 follow-up (D-105): the "subclass-granted expanded spell list"
 * feature four SRD subclasses actually have in the real SRD 5.1 — Life
 * Domain's Domain Spells, Oath of Devotion's Oath Spells, The Fiend's
 * Expanded Spell List, and Circle of the Land's terrain-typed Circle
 * Spells — was previously missing from this file entirely (not merely
 * inert; the feature wasn't recorded at all for the first three). All four
 * are now recorded, verified against SRD 5.1 rather than assumed (see
 * D-105), each carrying real `grantedSpellIds` referencing `data/spells.ts`
 * (all 318 of whose entries already covered every spell needed — no new
 * spell had to be added for this). All four stay `mechanicallyActive:
 * false`: Life Domain/Oath of Devotion/The Fiend because this game's
 * known-spell list is fixed per CLASS, not extended per subclass, and none
 * of these specific spells (bar Cure Wounds, already known regardless of
 * domain) have a real abilityId yet; Circle of the Land for the additional,
 * bigger reason that its terrain CHOICE has no UI to make at all yet — see
 * `CIRCLE_OF_THE_LAND_SPELLS` below for its full reference table.
 */

export interface SubclassDefinition {
  id: string;
  name: string;
  classId: string;
  features: ClassFeature[];
}

export const CHAMPION: SubclassDefinition = {
  id: "champion",
  name: "Champion",
  classId: "fighter",
  features: [
    {
      level: 3,
      name: "Improved Critical",
      description:
        "Lands a critical hit on a natural 19 or 20, instead of only a 20. Mechanically active as of Phase 13.11 (D-096), now that combat rolls real d20 crits (Phase 13.1, D-086) — see Hero.critThreshold.",
      mechanicallyActive: true,
    },
    {
      level: 7,
      name: "Remarkable Athlete",
      description: "Excels at physical feats — running, jumping, athletic checks. Inert — this game has no skill-proficiency system.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Additional Fighting Style",
      description: "A second combat specialization (see the base Fighter's level-1 Fighting Style). Inert for the same reason that one is.",
      mechanicallyActive: false,
    },
    {
      level: 15,
      name: "Superior Critical",
      description:
        "Critical hits land on a natural 18, 19, or 20 (see level 3). Mechanically active as of Phase 13.11 (D-096) — see Hero.critThreshold.",
      mechanicallyActive: true,
    },
    {
      level: 18,
      name: "Survivor",
      description: "Recovers hit points automatically at the start of each turn when badly hurt. Inert — this game has no per-turn HP regeneration.",
      mechanicallyActive: false,
    },
  ],
};

export const SCHOOL_OF_EVOCATION: SubclassDefinition = {
  id: "school-of-evocation",
  name: "School of Evocation",
  classId: "wizard",
  features: [
    {
      level: 2,
      name: "Evocation Savant",
      description: "Copies evocation spells into a spellbook at half the usual cost. Inert — this game has no spellbook-cost/downtime system.",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Sculpt Spells",
      description: "Shields chosen allies from the caster's own area-damage spells. Inert — this game's area abilities only ever target enemies, so there is nothing to shield allies from.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Potent Cantrip",
      description:
        "A cantrip still deals half damage against a target that succeeds its save. Still inert — saving throws now exist (Phase 13.5, D-090), but neither Wizard cantrip (Fire Bolt, Ray of Frost) forces one; only Sacred Flame, a Cleric cantrip, does. Nothing for a Wizard to apply this to today.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Empowered Evocation",
      description: "Adds Intelligence to the damage of one evocation spell each turn. Inert today — wiring this in would mean re-deriving a spell attack's ability modifier at cast time, which the current signature-action model doesn't support yet.",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Overchannel",
      description: "Pushes a spell to maximum effect at the cost of self-inflicted harm on repeat use. Inert — this game has no self-damage/backlash mechanic.",
      mechanicallyActive: false,
    },
  ],
};

export const THIEF: SubclassDefinition = {
  id: "thief",
  name: "Thief",
  classId: "rogue",
  features: [
    {
      level: 3,
      name: "Fast Hands",
      description: "Uses Cunning Action to interact with objects or pick pockets. Still inert — the bonus action itself is real now (Phase 13.2, D-087, powers this class's own Cunning Action: Dash), but this game has no object-interaction/pickpocket mechanic for it to spend that bonus action on.",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Second-Story Work",
      description: "Climbs faster and jumps farther. Inert — this game has no climbing/jumping/terrain-cost mechanic.",
      mechanicallyActive: false,
    },
    {
      level: 9,
      name: "Supreme Sneak",
      description: "Moves at full speed and still stays hidden. Inert — this game has no stealth/hidden-state mechanic.",
      mechanicallyActive: false,
    },
    {
      level: 13,
      name: "Use Magic Device",
      description: "Operates unfamiliar magic items with ease. Inert — this game has no magic-item-use restriction to bypass.",
      mechanicallyActive: false,
    },
    {
      level: 17,
      name: "Thief's Reflexes",
      description: "Takes two turns during the first round of a fight. Inert — this game has no extra-turn/initiative-round concept (Phase 2 boundary).",
      mechanicallyActive: false,
    },
  ],
};

export const LIFE_DOMAIN: SubclassDefinition = {
  id: "life-domain",
  name: "Life Domain",
  classId: "cleric",
  features: [
    {
      level: 1,
      name: "Disciple of Life",
      description:
        "Healing spells restore extra hit points. Mechanically active as of Phase 13.11 (D-096), now that Cure Wounds exists (Phase 13.7, D-092) as this game's first HP-restoring effect: a Life Domain Cleric's Cure Wounds heals its target for +2 HP — see Hero.discipleOfLifeBonus, applied in BattleScene.castHealSpellOn.",
      mechanicallyActive: true,
    },
    // Phase 15 follow-up (D-105): the real "Domain Spells" feature — always
    // prepared, granted for free, verified against SRD 5.1 (two independent
    // mirrors agreed). Inert: this game's known-spell list is fixed per
    // CLASS (`characterCreation.ts`'s knownSpellIdsForClass), not extended
    // per subclass, and every one of these spells except Cure Wounds still
    // has no real abilityId to cast with — Cure Wounds itself changes
    // nothing here since a Cleric already knows it via the base class
    // regardless of domain (see data/characterCreation.ts).
    {
      level: 1,
      name: "Domain Spells (1st level)",
      description: "Bless and Cure Wounds are always prepared, free of any spell known-slot. Inert — see the note above this feature.",
      mechanicallyActive: false,
      grantedSpellIds: ["bless", "cure-wounds"],
    },
    {
      level: 3,
      name: "Domain Spells (3rd level)",
      description: "Lesser Restoration and Spiritual Weapon are always prepared, free of any spell known-slot. Inert — same reason as the 1st-level Domain Spells above.",
      mechanicallyActive: false,
      grantedSpellIds: ["lesser-restoration", "spiritual-weapon"],
    },
    {
      level: 5,
      name: "Domain Spells (5th level)",
      description: "Beacon of Hope and Revivify are always prepared, free of any spell known-slot. Inert — same reason as the 1st-level Domain Spells above.",
      mechanicallyActive: false,
      grantedSpellIds: ["beacon-of-hope", "revivify"],
    },
    {
      level: 7,
      name: "Domain Spells (7th level)",
      description: "Death Ward and Guardian of Faith are always prepared, free of any spell known-slot. Inert — same reason as the 1st-level Domain Spells above.",
      mechanicallyActive: false,
      grantedSpellIds: ["death-ward", "guardian-of-faith"],
    },
    {
      level: 9,
      name: "Domain Spells (9th level)",
      description: "Mass Cure Wounds and Raise Dead are always prepared, free of any spell known-slot. Inert — same reason as the 1st-level Domain Spells above.",
      mechanicallyActive: false,
      grantedSpellIds: ["mass-cure-wounds", "raise-dead"],
    },
    {
      level: 2,
      name: "Channel Divinity: Preserve Life",
      description: "Spends a limited-use divine effect to heal several injured allies at once. Still inert — a limited-use resource is real now (Phase 13.4's Rest system) and a heal effect exists now (Cure Wounds), but this game's healing only ever targets ONE ally at a time; a real AoE-ally-heal targeting mode doesn't exist yet.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Blessed Healer",
      description:
        "Healing spells also restore some HP to the caster. Mechanically active as of Phase 13.11 (D-096), same hookup as Disciple of Life (level 1): a level-6+ Life Domain Cleric also regains +2 HP whenever it casts Cure Wounds on someone else — see Hero.blessedHealerBonus.",
      mechanicallyActive: true,
    },
    {
      level: 8,
      name: "Divine Strike",
      description: "A weapon attack occasionally lands with extra radiant force. Inert today — this game's basic-attack damage is a fixed per-level number with no random proc-chance mechanic to hook an \"occasionally\" effect into (equipment procs, D-094, are the closest analog and are gated by an ITEM, not a class feature).",
      mechanicallyActive: false,
    },
    {
      level: 17,
      name: "Supreme Healing",
      description: "Healing spells restore the maximum possible amount instead of a rolled amount. Inert — Disciple of Life/Blessed Healer are real now (see level 1/6), but this game's Cure Wounds heal is already a flat, non-rolled number (D-030's \"damage is a flat number\" boundary applies to healing too), so there's no \"maximum vs. rolled\" distinction left to grant.",
      mechanicallyActive: false,
    },
  ],
};

export const PATH_OF_THE_BERSERKER: SubclassDefinition = {
  id: "path-of-the-berserker",
  name: "Path of the Berserker",
  classId: "barbarian",
  features: [
    {
      level: 3,
      name: "Frenzy",
      description:
        "While raging, an extra attack as a bonus action, at the cost of exhaustion once the rage ends. Inert — this game's Rage has no bonus-action-attack button, and no exhaustion mechanic to charge for using one.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Mindless Rage",
      description: "Can't be frightened or charmed while raging. Inert — this game has no fear/charm status effect.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Intimidating Presence",
      description: "Frighten a creature as an action. Inert — this game has no fear status effect.",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Retaliation",
      description: "A reaction attack against whoever just hit you. Inert — this game has no reaction-triggered-attack mechanic (Uncanny Dodge's reaction only reduces damage, it doesn't swing back).",
      mechanicallyActive: false,
    },
  ],
};

export const COLLEGE_OF_LORE: SubclassDefinition = {
  id: "college-of-lore",
  name: "College of Lore",
  classId: "bard",
  features: [
    {
      level: 3,
      name: "Bonus Proficiencies",
      description: "Proficiency in three chosen skills. Inert — this game has no skill-proficiency system.",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Cutting Words",
      description: "A reaction, spending Bardic Inspiration, to weaken a nearby enemy's roll. Inert — this game has no reaction-triggered roll-modification mechanic to hook a spent Inspiration die into.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Additional Magical Secrets",
      description: "Learn two more spells from any class's list. Inert — same reason as the base class's own Magical Secrets (no free-pick mechanism against a fixed known-spell list).",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Peerless Skill",
      description: "Add a Bardic Inspiration die to your own ability check. Inert — this game has no ability-check system for it to add to.",
      mechanicallyActive: false,
    },
  ],
};

/**
 * Phase 14.1 (D-098): a correction, not new content. This project's own
 * license terms only cover the actual SRD 5.1/5.2.1 text — Druid's real
 * SRD-licensed circle is **Circle of the Land**, not Circle of the Moon
 * (which is genuine Player's Handbook content the SRD has never included,
 * under either license version). This slot briefly held the wrong one; see
 * D-098 for the full correction note. Natural Recovery is mechanically
 * active — a Circle of the Land Druid's spell slots also refill (partially,
 * simplified to a full top-up) on a Short Rest, the same shape as the
 * Warlock's own Pact Magic short-rest cadence (`Hero.shortRest`'s Warlock
 * branch) — see `Hero.shortRest`'s Circle of the Land branch.
 */
export const CIRCLE_OF_THE_LAND: SubclassDefinition = {
  id: "circle-of-the-land",
  name: "Circle of the Land",
  classId: "druid",
  features: [
    {
      level: 2,
      name: "Bonus Cantrip",
      description: "Learn one additional druid cantrip. Inert — this game's known-cantrip list is fixed per class, no free-pick mechanism (same reason the Bard's Magical Secrets stays inert).",
      mechanicallyActive: false,
    },
    {
      level: 2,
      name: "Natural Recovery",
      description:
        "Recover spent spell slots on a Short Rest, not just a Long Rest. Mechanically active as of Phase 14.1 (D-098), simplified to a full slot top-up — the same shape as the Warlock's own Pact Magic Short-Rest cadence — see Hero.shortRest.",
      mechanicallyActive: true,
    },
    {
      level: 3,
      name: "Circle Spells",
      description:
        "At character creation, a Circle of the Land Druid picks ONE terrain (arctic, coast, desert, forest, grassland, mountain, or swamp — verified against SRD 5.1, three independent mirrors agreed there is no eighth Underdark option, that being full-PHB-only content); the chosen terrain then grants two always-prepared spells at levels 3, 5, 7, and 9 (see CIRCLE_OF_THE_LAND_SPELLS below for the full verified table). Inert for TWO separate reasons, bigger than every other inert feature in this file: this game has no terrain-choice UI anywhere in character creation (a real new choice, not just a wiring job), AND its known-spell list is fixed per class regardless. Building the choice UI is a properly-scoped future slice, not folded into this pass — see D-105.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Land's Stride",
      description: "Moves through difficult terrain at full speed, with advantage on saves against magically grasping plants. Inert — this game has no difficult-terrain movement cost, and no plant-specific saving-throw trigger.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Nature's Ward",
      description: "Immune to poison/disease and to being charmed/frightened by elementals or fey. Inert — this game has no poison/disease/charm/fear status effects.",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Nature's Sanctuary",
      description: "Beasts and plants must save or be unable to attack you. Inert — this game has no creature-type tagging (beast/plant) or attack-prevention-via-save mechanic.",
      mechanicallyActive: false,
    },
  ],
};

export type CircleOfTheLandTerrain = "arctic" | "coast" | "desert" | "forest" | "grassland" | "mountain" | "swamp";

/**
 * Phase 15 follow-up (D-105): the full Circle Spells table referenced by
 * CIRCLE_OF_THE_LAND's own "Circle Spells" feature above — every terrain's
 * two spells at Druid levels 3/5/7/9. Verified against SRD 5.1 (three
 * independent mirrors agreed; confirmed exactly 7 terrains, no Underdark —
 * that's full-PHB-only content, not SRD). Reference data only: nothing
 * reads this yet, since the terrain CHOICE itself has no UI to make in
 * `CharacterCreationScene` — see the module comment above. A future slice
 * that builds the choice can consume this directly rather than
 * re-researching it.
 */
export const CIRCLE_OF_THE_LAND_SPELLS: Record<CircleOfTheLandTerrain, Record<number, string[]>> = {
  arctic: {
    3: ["hold-person", "spike-growth"],
    5: ["sleet-storm", "slow"],
    7: ["freedom-of-movement", "ice-storm"],
    9: ["commune-with-nature", "cone-of-cold"],
  },
  coast: {
    3: ["mirror-image", "misty-step"],
    5: ["water-breathing", "water-walk"],
    7: ["control-water", "freedom-of-movement"],
    9: ["conjure-elemental", "scrying"],
  },
  desert: {
    3: ["blur", "silence"],
    5: ["create-food-and-water", "protection-from-energy"],
    7: ["blight", "hallucinatory-terrain"],
    9: ["insect-plague", "wall-of-stone"],
  },
  forest: {
    3: ["barkskin", "spider-climb"],
    5: ["call-lightning", "plant-growth"],
    7: ["divination", "freedom-of-movement"],
    9: ["commune-with-nature", "tree-stride"],
  },
  grassland: {
    3: ["invisibility", "pass-without-trace"],
    5: ["daylight", "haste"],
    7: ["divination", "freedom-of-movement"],
    9: ["dream", "insect-plague"],
  },
  mountain: {
    3: ["spider-climb", "spike-growth"],
    5: ["lightning-bolt", "meld-into-stone"],
    7: ["stone-shape", "stoneskin"],
    9: ["passwall", "wall-of-stone"],
  },
  swamp: {
    3: ["acid-arrow", "darkness"],
    5: ["water-walk", "stinking-cloud"],
    7: ["freedom-of-movement", "locate-creature"],
    9: ["insect-plague", "scrying"],
  },
};

export const WAY_OF_THE_OPEN_HAND: SubclassDefinition = {
  id: "way-of-the-open-hand",
  name: "Way of the Open Hand",
  classId: "monk",
  features: [
    {
      level: 3,
      name: "Open Hand Technique",
      description: "A Flurry of Blows hit can knock a target prone, push it back, or deny its reaction. Inert — this game has no prone/knockback/reaction-denial mechanic for a landed hit to trigger.",
      mechanicallyActive: false,
    },
    {
      level: 6,
      name: "Wholeness of Body",
      description: "Heal yourself for a flat amount as an action, once per rest. Inert this pass — this game has no generic class self-heal action button (Second Wind/Wild Shape's heals are both bonus-action-gated); a real action-spending self-heal is a natural future slice.",
      mechanicallyActive: false,
    },
    {
      level: 11,
      name: "Tranquility",
      description: "Passive invisibility to divination magic between rests. Flavor only — this game has no divination-magic concept.",
      mechanicallyActive: false,
    },
    {
      level: 17,
      name: "Quivering Palm",
      description: "Spend Ki to set up a later save-or-die strike. Inert — Flurry of Blows was chosen as this class's one Ki-spending mechanic (see the base class's own Ki note); a save-or-die finisher is a natural future slice.",
      mechanicallyActive: false,
    },
  ],
};

export const OATH_OF_DEVOTION: SubclassDefinition = {
  id: "oath-of-devotion",
  name: "Oath of Devotion",
  classId: "paladin",
  features: [
    // Phase 15 follow-up (D-105): the real "Oath Spells" feature — always
    // prepared, granted for free, verified against SRD 5.1 (three
    // independent mirrors agreed; one WebSearch snippet surfacing a wrong
    // variant was caught and discarded — see D-105). Inert: Paladin has no
    // spellbook in this game at all (see `characterCreation.ts`'s
    // `knownSpellIdsForClass`, which returns nothing for Paladin — its one
    // spell-like mechanic, Divine Smite, lives on the bonus-action button
    // instead), so there's nowhere for an Oath Spell to even be offered yet.
    {
      level: 3,
      name: "Oath Spells (3rd level)",
      description: "Protection from Evil and Good and Sanctuary are always prepared, free of any spell known-slot. Inert — see the note above this feature.",
      mechanicallyActive: false,
      grantedSpellIds: ["protection-from-evil-and-good", "sanctuary"],
    },
    {
      level: 5,
      name: "Oath Spells (5th level)",
      description: "Lesser Restoration and Zone of Truth are always prepared, free of any spell known-slot. Inert — same reason as the 3rd-level Oath Spells above.",
      mechanicallyActive: false,
      grantedSpellIds: ["lesser-restoration", "zone-of-truth"],
    },
    {
      level: 9,
      name: "Oath Spells (9th level)",
      description: "Beacon of Hope and Dispel Magic are always prepared, free of any spell known-slot. Inert — same reason as the 3rd-level Oath Spells above.",
      mechanicallyActive: false,
      grantedSpellIds: ["beacon-of-hope", "dispel-magic"],
    },
    {
      level: 13,
      name: "Oath Spells (13th level)",
      description: "Freedom of Movement and Guardian of Faith are always prepared, free of any spell known-slot. Inert — same reason as the 3rd-level Oath Spells above.",
      mechanicallyActive: false,
      grantedSpellIds: ["freedom-of-movement", "guardian-of-faith"],
    },
    {
      level: 17,
      name: "Oath Spells (17th level)",
      description: "Commune and Flame Strike are always prepared, free of any spell known-slot. Inert — same reason as the 3rd-level Oath Spells above.",
      mechanicallyActive: false,
      grantedSpellIds: ["commune", "flame-strike"],
    },
    {
      level: 3,
      name: "Sacred Weapon",
      description: "Channel Divinity to add Charisma to attack rolls and shed light, briefly. Inert — this game has no Channel-Divinity-style limited-use resource for a Paladin (the base class's own Channel Divinity note doesn't apply here — Paladin has none in this game's model).",
      mechanicallyActive: false,
    },
    {
      level: 3,
      name: "Turn the Unholy",
      description: "Channel Divinity to frighten fiends/undead. Inert — same missing resource as Sacred Weapon, plus no fear status effect or undead/fiend tagging.",
      mechanicallyActive: false,
    },
    {
      level: 7,
      name: "Aura of Devotion",
      description: "Nearby allies can't be charmed while you're conscious. Inert — this game has no charm status effect or proximity-aura system.",
      mechanicallyActive: false,
    },
    {
      level: 15,
      name: "Purity of Spirit",
      description: "Constant protection from possession effects. Flavor only — no possession mechanic exists.",
      mechanicallyActive: false,
    },
    {
      level: 20,
      name: "Holy Nimbus",
      description: "An aura that damages fiends/undead and grants fear immunity, once per Long Rest. Inert — no proximity-aura, fear-status, or undead/fiend-tagging system exists.",
      mechanicallyActive: false,
    },
  ],
};

export const HUNTER: SubclassDefinition = {
  id: "hunter",
  name: "Hunter",
  classId: "ranger",
  features: [
    {
      level: 3,
      name: "Colossus Slayer",
      description:
        "A landed hit against the Hunter's own Hunter's Mark target deals extra damage. Mechanically active as of Phase 14 (D-097), extending the base class's own Hunter's Mark hookup — see Hero.colossusSlayerBonus, applied in BattleScene.applyHuntersMarkBonus. The SRD's other Hunter's Prey options (Giant Killer, Horde Breaker) and this level's Defensive Tactics/Multiattack Defense features stay a future slice.",
      mechanicallyActive: true,
    },
    {
      level: 7,
      name: "Defensive Tactics",
      description: "Better odds against being flanked or swarmed. Inert — this game has no flanking/swarm-adjacency mechanic.",
      mechanicallyActive: false,
    },
    {
      level: 11,
      name: "Multiattack",
      description: "Attack every creature within reach once per turn, in exchange for accuracy. Inert — this game's Extra Attack (see the base class) already covers multiple attacks against ONE target; a separate all-adjacent-targets mode doesn't exist.",
      mechanicallyActive: false,
    },
    {
      level: 15,
      name: "Superior Hunter's Defense",
      description: "A reaction to reduce or negate an incoming hit. Inert — Uncanny Dodge is this game's one reaction-based damage-reduction hook, gated to Rogue only; a second, parallel version doesn't exist.",
      mechanicallyActive: false,
    },
  ],
};

export const DRACONIC_BLOODLINE: SubclassDefinition = {
  id: "draconic-bloodline",
  name: "Draconic Bloodline",
  classId: "sorcerer",
  features: [
    {
      level: 1,
      name: "Dragon Ancestor",
      description: "A chosen dragon type flavors your bloodline and lets you speak Draconic. Flavor only — no dialogue/social system.",
      mechanicallyActive: false,
    },
    {
      level: 1,
      name: "Draconic Resilience",
      description:
        "Bonus max HP (1 per Sorcerer level) and a higher unarmored Armor Class. Mechanically active as of Phase 14 (D-097) for its HP half — see Hero.draconicResilienceBonus, folded into effectiveMaxHealth. The AC half stays inert — this game's armorClass is a flat baseArmorClass plus gear, with no per-class unarmored-Dex-AC formula to swap in.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Elemental Affinity",
      description: "Add Charisma to one damage roll of your bloodline's element, and resist that element for an hour. Inert — this game has no damage-type resistance system, and spell damage isn't tagged by element.",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Dragon Wings",
      description: "Sprout wings and fly, as a bonus action. Inert — this game has no player-controlled flight; `movementType` is a fixed per-enemy tag, not something a hero can toggle mid-battle.",
      mechanicallyActive: false,
    },
    {
      level: 18,
      name: "Draconic Presence",
      description: "An aura that frightens or charms nearby creatures. Inert — no fear/charm status effect or proximity-aura system.",
      mechanicallyActive: false,
    },
  ],
};

export const THE_FIEND: SubclassDefinition = {
  id: "the-fiend",
  name: "The Fiend",
  classId: "warlock",
  features: [
    // Phase 15 follow-up (D-105): the real "Expanded Spell List" feature —
    // the SRD grants these by SPELL level (1st-5th) as the Warlock's own
    // spell slots reach that level, not by a fixed character level. This
    // game's Warlock deliberately shares the full-caster slot table rather
    // than real Pact Magic's own shape (documented simplification, Phase
    // 13.8/D-093) — the character levels below are where each matching
    // spell-level slot FIRST appears on that shared table
    // (FULL_CASTER_SPELL_SLOTS_BY_LEVEL in `data/classes.ts`: 1st-level
    // slots at level 1, 2nd at level 3, 3rd at level 5, 4th at level 7, 5th
    // at level 9). Verified against SRD 5.1 (three independent mirrors
    // agreed). Inert: none of these ten spells have a real abilityId yet,
    // so even though Warlock DOES have a spellbook in this game (unlike
    // Paladin/Ranger), there is nothing here it could actually cast.
    {
      level: 1,
      name: "Expanded Spell List (1st-level spells)",
      description: "Burning Hands and Command are always available to be known, without using a spell known-slot. Inert — see the note above this feature.",
      mechanicallyActive: false,
      grantedSpellIds: ["burning-hands", "command"],
    },
    {
      level: 3,
      name: "Expanded Spell List (2nd-level spells)",
      description: "Blindness/Deafness and Scorching Ray are always available to be known, without using a spell known-slot. Inert — same reason as the 1st-level Expanded Spell List above.",
      mechanicallyActive: false,
      grantedSpellIds: ["blindness-deafness", "scorching-ray"],
    },
    {
      level: 5,
      name: "Expanded Spell List (3rd-level spells)",
      description: "Fireball and Stinking Cloud are always available to be known, without using a spell known-slot. Inert — same reason as the 1st-level Expanded Spell List above.",
      mechanicallyActive: false,
      grantedSpellIds: ["fireball", "stinking-cloud"],
    },
    {
      level: 7,
      name: "Expanded Spell List (4th-level spells)",
      description: "Fire Shield and Wall of Fire are always available to be known, without using a spell known-slot. Inert — same reason as the 1st-level Expanded Spell List above.",
      mechanicallyActive: false,
      grantedSpellIds: ["fire-shield", "wall-of-fire"],
    },
    {
      level: 9,
      name: "Expanded Spell List (5th-level spells)",
      description: "Flame Strike and Hallow are always available to be known, without using a spell known-slot. Inert — same reason as the 1st-level Expanded Spell List above.",
      mechanicallyActive: false,
      grantedSpellIds: ["flame-strike", "hallow"],
    },
    {
      level: 1,
      name: "Dark One's Blessing",
      description:
        "Reducing a hostile creature to 0 HP grants a flat self-heal. Mechanically active as of Phase 14 (D-097) — see Hero.darkOnesBlessingHeal, applied in BattleScene.applyDarkOnesBlessing right after a killing blow, the same shape as an on-kill equipment proc (D-094) but class-gated instead of item-gated.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Dark One's Own Luck",
      description: "Add a bonus to one failed ability check or saving throw. Inert — this game has no ability-check system, and Lucky's own reroll mechanic already covers the one dice-facing hook that exists (attack rolls), gated to the Lucky feat, not this subclass.",
      mechanicallyActive: false,
    },
    {
      level: 10,
      name: "Fiendish Resilience",
      description: "Choose a damage type to resist until your next rest. Inert — this game has no damage-type resistance system.",
      mechanicallyActive: false,
    },
    {
      level: 14,
      name: "Hurl Through Hell",
      description: "Banish a struck creature briefly, dealing psychic damage. Inert — this game has no banishment/psychic-damage-type mechanic.",
      mechanicallyActive: false,
    },
  ],
};

/**
 * Phase 14.2 (D-099): a second, ORIGINAL subclass for every class — not SRD
 * content. Both SRD 5.1 and SRD 5.2.1 (verified directly, not assumed) only
 * ever fully detail ONE subclass per class; every other real D&D subclass
 * name (Battle Master, Totem Warrior, College of Valor, the other six
 * Cleric domains, Circle of the Moon, Way of Shadow, Oath of Vengeance,
 * Beast Master, Assassin, Wild Magic, the Archfey/Great Old One, the other
 * seven Wizard schools, etc.) is genuine Player's Handbook content, not
 * covered by OGL 1.0a or CC BY 4.0 under either license. Kevin asked to
 * explore a properly-licensed path to more options; there isn't one beyond
 * what's already here — so these twelve are original names, original
 * flavor text, and independently-designed mechanics (not copied numbers or
 * wording from any book), the same treatment this project already gives
 * every enemy/equipment/map it invents. General game-mechanic CONCEPTS
 * (a defensive rager, a martial bard, a combat-focused cleric, etc.) are
 * not copyrightable — only a book's specific expression of them is — but
 * nothing here even reuses a real subclass's specific numbers; each is its
 * own original design.
 *
 * Each gets exactly ONE real, mechanically-active feature (this project's
 * demonstrated bar for "does it actually work," not a full SRD-style
 * feature table) plus one honestly-inert feature for texture, reusing
 * EXISTING systems only — no new subsystem was invented to force a feature
 * active. See each subclass below for its specific hookup.
 */
export const PATH_OF_THE_IRONHIDE: SubclassDefinition = {
  id: "path-of-the-ironhide",
  name: "Path of the Ironhide",
  classId: "barbarian",
  features: [
    {
      level: 3,
      name: "Ironhide Stance",
      description:
        "Skin toughens like stone while raging, adding to Armor Class. Mechanically active — a +2 AC bonus while raging, see Hero.subclassArmorClassBonus, folded into the armorClass getter.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Grudge Bearer",
      description: "Advantage on resisting being moved or knocked down while raging. Inert — this game has no forced-movement/knockdown mechanic to resist.",
      mechanicallyActive: false,
    },
  ],
};

export const COLLEGE_OF_THE_BLADE: SubclassDefinition = {
  id: "college-of-the-blade",
  name: "College of the Blade",
  classId: "bard",
  features: [
    {
      level: 3,
      name: "Battle Hymn",
      description:
        "A martial cadence sharpens every strike. Mechanically active — a flat +1 to-hit bonus on this Bard's basic Attack, always on, see Hero.subclassAttackBonus, applied in BattleScene.attackProfileFor.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Warrior's Verse",
      description: "Bardic Inspiration can grant its target extra movement instead of an attack bonus. Inert — this game has no ally-targeted movement-bonus mechanic.",
      mechanicallyActive: false,
    },
  ],
};

export const ZEAL_DOMAIN: SubclassDefinition = {
  id: "zeal-domain",
  name: "Zeal Domain",
  classId: "cleric",
  features: [
    {
      level: 1,
      name: "Crusader's Wrath",
      description:
        "Righteous fervor sharpens this Cleric's strikes. Mechanically active — a flat +1 to-hit bonus on this Cleric's basic Attack, always on, see Hero.subclassAttackBonus, applied in BattleScene.attackProfileFor.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Aura of Zeal",
      description: "Nearby allies share the same attack bonus while this Cleric is conscious. Inert — this game has no proximity-aura system for allies.",
      mechanicallyActive: false,
    },
  ],
};

export const CIRCLE_OF_THE_ASHEN_VEIL: SubclassDefinition = {
  id: "circle-of-the-ashen-veil",
  name: "Circle of the Ashen Veil",
  classId: "druid",
  features: [
    {
      level: 2,
      name: "Ember Shape",
      description:
        "Wild Shape draws on banked heat to mend deeper wounds. Mechanically active — Wild Shape's self-heal is larger for this circle, see Hero.subclassWildShapeHealBonus, applied in Hero.useWildShape.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Smoldering Ward",
      description: "Attacks that land on this Druid while Wild Shaped scorch the attacker back. Inert — this game has no retaliation-damage-on-being-hit mechanic.",
      mechanicallyActive: false,
    },
  ],
};

export const BATTLE_TACTICIAN: SubclassDefinition = {
  id: "battle-tactician",
  name: "Battle Tactician",
  classId: "fighter",
  features: [
    {
      level: 3,
      name: "Tactician's Precision",
      description:
        "Reads an enemy's stance before every swing. Mechanically active — a flat +1 to-hit bonus on this Fighter's basic Attack, always on, see Hero.subclassAttackBonus, applied in BattleScene.attackProfileFor.",
      mechanicallyActive: true,
    },
    {
      level: 7,
      name: "Calculated Risk",
      description: "Reads an incoming blow well enough to blunt it. Inert — Uncanny Dodge is this game's one reaction-based damage-reduction hook, gated to Rogue only; a second, parallel version doesn't exist.",
      mechanicallyActive: false,
    },
  ],
};

export const WAY_OF_THE_IRON_BODY: SubclassDefinition = {
  id: "way-of-the-iron-body",
  name: "Way of the Iron Body",
  classId: "monk",
  features: [
    {
      level: 3,
      name: "Iron Skin",
      description:
        "Conditions the body itself into living armor. Mechanically active — a flat +1 max HP per Monk level, see Hero.subclassHpPerLevelBonus, folded into effectiveMaxHealth alongside the Tough feat/Draconic Resilience.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Steady Breath",
      description: "Meditative breathing during a Short Rest also clears a point of exhaustion. Inert — this game has no exhaustion mechanic.",
      mechanicallyActive: false,
    },
  ],
};

export const OATH_OF_RETRIBUTION: SubclassDefinition = {
  id: "oath-of-retribution",
  name: "Oath of Retribution",
  classId: "paladin",
  features: [
    {
      level: 3,
      name: "Retributive Smite",
      description:
        "This Oath channels its conviction into every smite. Mechanically active — Divine Smite deals more bonus damage for this Oath, see Hero.subclassSmiteBonus, applied in BattleScene.applyPaladinSmite.",
      mechanicallyActive: true,
    },
    {
      level: 7,
      name: "Vow of Wrath",
      description: "Advantage against a creature that damaged an ally this round. Inert — this game has no per-round damage-tracking/advantage-granting trigger for this condition.",
      mechanicallyActive: false,
    },
  ],
};

export const BEASTBOND_WARDEN: SubclassDefinition = {
  id: "beastbond-warden",
  name: "Beastbond Warden",
  classId: "ranger",
  features: [
    {
      level: 3,
      name: "Bonded Strike",
      description:
        "A spectral bond channels stolen vitality back to its Warden. Mechanically active — hitting this Ranger's own Hunter's Mark target also heals the Ranger, see Hero.beastbondStrikeHeal, applied in BattleScene.applyHuntersMarkBonus.",
      mechanicallyActive: true,
    },
    {
      level: 7,
      name: "Loyal Vigil",
      description: "A spectral companion grants advantage on this Ranger's first attack each battle. Inert — this game has no companion-entity system; a real one is a future system, not a wiring job.",
      mechanicallyActive: false,
    },
  ],
};

export const SHADOWBLADE: SubclassDefinition = {
  id: "shadowblade",
  name: "Shadowblade",
  classId: "rogue",
  features: [
    {
      level: 3,
      name: "First Strike",
      description:
        "The opening blow of a fight lands hardest. Mechanically active — bonus damage on this Rogue's first landed hit each battle, see Hero.shadowbladeFirstStrikeBonus, applied in BattleScene's basic-attack resolution.",
      mechanicallyActive: true,
    },
    {
      level: 9,
      name: "Silent Step",
      description: "Moving before attacking grants advantage on that attack. Inert — nothing tracks a move-then-attack sequence to grant Advantage for it specifically.",
      mechanicallyActive: false,
    },
  ],
};

export const WILDSURGE_ORIGIN: SubclassDefinition = {
  id: "wildsurge-origin",
  name: "Wildsurge Origin",
  classId: "sorcerer",
  features: [
    {
      level: 1,
      name: "Volatile Magic",
      description:
        "Raw, untamed magic swells this Sorcerer's reserves. Mechanically active — +1 maximum Sorcery Point, see Hero.subclassSorceryPointBonus, applied wherever Sorcery Points refill.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Chaotic Backlash",
      description: "Casting a spell has a chance to trigger a random minor surge effect. Inert — this game has no random-surge-table mechanic; a real one is a future system, not a wiring job.",
      mechanicallyActive: false,
    },
  ],
};

export const STARBOUND_PATRON: SubclassDefinition = {
  id: "starbound-patron",
  name: "Starbound Patron",
  classId: "warlock",
  features: [
    {
      level: 1,
      name: "Umbral Ward",
      description:
        "A distant patron's protection thickens this Warlock's hide. Mechanically active — a flat +1 max HP per Warlock level, see Hero.subclassHpPerLevelBonus, folded into effectiveMaxHealth alongside the Tough feat/Draconic Resilience/Iron Skin.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Starlit Whisper",
      description: "Once per Long Rest, reveal a hidden enemy weakness for bonus damage. Inert — this game has no enemy-weakness/damage-type-vulnerability system.",
      mechanicallyActive: false,
    },
  ],
};

export const SPELLBLADE_TRADITION: SubclassDefinition = {
  id: "spellblade-tradition",
  name: "Spellblade Tradition",
  classId: "wizard",
  features: [
    {
      level: 2,
      name: "Arcane Deflection",
      description:
        "A standing shimmer of force wards off incoming blows. Mechanically active — a flat +1 Armor Class, always on, see Hero.subclassArmorClassBonus, folded into the armorClass getter.",
      mechanicallyActive: true,
    },
    {
      level: 6,
      name: "Spellstrike",
      description: "A basic Attack crackles with a small burst of force damage. Inert this pass — deliberately left unwired to keep this subclass to one clear hookup like every other new subclass; a future pass could extend the same per-swing rider-damage pattern already used for Divine Smite/Hunter's Mark here.",
      mechanicallyActive: false,
    },
  ],
};

export const SUBCLASS_DEFINITIONS: SubclassDefinition[] = [
  CHAMPION,
  SCHOOL_OF_EVOCATION,
  THIEF,
  LIFE_DOMAIN,
  PATH_OF_THE_BERSERKER,
  COLLEGE_OF_LORE,
  CIRCLE_OF_THE_LAND,
  WAY_OF_THE_OPEN_HAND,
  OATH_OF_DEVOTION,
  HUNTER,
  DRACONIC_BLOODLINE,
  THE_FIEND,
  PATH_OF_THE_IRONHIDE,
  COLLEGE_OF_THE_BLADE,
  ZEAL_DOMAIN,
  CIRCLE_OF_THE_ASHEN_VEIL,
  BATTLE_TACTICIAN,
  WAY_OF_THE_IRON_BODY,
  OATH_OF_RETRIBUTION,
  BEASTBOND_WARDEN,
  SHADOWBLADE,
  WILDSURGE_ORIGIN,
  STARBOUND_PATRON,
  SPELLBLADE_TRADITION,
];

/** Look up a subclass, throwing on an unknown id so typos fail loudly. */
export function getSubclassDefinition(id: string): SubclassDefinition {
  const def = SUBCLASS_DEFINITIONS.find((s) => s.id === id);
  if (!def) throw new Error(`Unknown subclass id "${id}".`);
  return def;
}

/** Every modeled subclass for a class — two apiece as of Phase 14.2 (D-099), one SRD-derived and one original. */
export function subclassesForClass(classId: string): SubclassDefinition[] {
  return SUBCLASS_DEFINITIONS.filter((s) => s.classId === classId);
}
