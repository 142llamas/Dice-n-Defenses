/**
 * Character-creation content — Phase 11.1's first-pass creator (DECISIONS
 * D-070/D-071/D-073), extended in Phase 11.2 for a second, pickable class
 * (D-074), and again in Phase 11.3 (D-075) for race and two further
 * classes. A short preset name pool, since this project has no free-text
 * input UI anywhere yet (Phaser has no native text field, and adding a DOM
 * text overlay would be a new UI pattern this small first pass doesn't
 * need). All names are original, no IP.
 *
 * The four signature abilities available to a Fighter OR a Rogue are the
 * project's existing four (Cleave, Piercing Shot, Taunting Slam, Frost
 * Bolt) — no new abilities were invented for either. A Wizard or Cleric
 * instead picks a signature action from its mechanically-active cantrips
 * (Wizard: Fire Bolt, Ray of Frost; Cleric: Sacred Flame — see
 * `data/spells.ts`) at character creation — this ONE choice still only
 * drives the hero's baseline combat stats (attack style/scaling via
 * `CharacterSystem.combatStatsForClassLevel`), unchanged since Phase 11.2.
 * `signatureActionIdsForClass` is the one place that decides which list a
 * given class picks from — a future fifth class only needs an entry here,
 * not a `CharacterCreationScene` rewrite. Race, unlike class, has no
 * per-race action list — every race uses the full six-race pool from
 * `data/races.ts` directly.
 *
 * Phase 13.11 (D-096): `STARTING_GEAR_IDS` is the pool a created hero may
 * pick ONE item from at creation, granted for free (see
 * `CharacterBuildSystem.heroDefinitionFromBuild`) — deliberately just the
 * twelve common/uncommon items from Phase 11.5, not the five rare-and-up
 * items Phase 13.9 added (a free legendary chest piece at level 1 would be
 * a real balance problem, not a starting package).
 *
 * Phase 13.7 (D-092): in BATTLE, a caster is no longer limited to just the
 * one signature action chosen above — `knownSpellIdsForClass` lists EVERY
 * mechanically-active spell for a class, and `BattleScene`'s spellbook
 * overlay lets the player pick any of them as their action each turn,
 * spending a spell slot for a leveled one. Fighter/Rogue are not casters
 * and are unaffected — they still have exactly one ability.
 *
 * Phase 16 (D-106, "make all spells usable"): the six full-caster classes'
 * (Wizard/Cleric/Bard/Druid/Sorcerer/Warlock) cantrip/leveled-spell arrays
 * below grew from a curated handful (1-2 leveled spells) to their FULL real
 * SRD 5.1 spell list, filtered to whatever `data/spells.ts` can actually
 * cast today (most of the 318-entry catalogue now carries a real
 * `abilityId` — see that file's own module comment for the ~120 genuinely
 * non-combat spells still excluded). A spell legitimately appears on more
 * than one class's array when the SRD itself shares it (e.g. Fire Bolt on
 * both Wizard and Sorcerer) — that's not a bug. Paladin and Ranger are
 * deliberately NOT expanded this way: their half-caster spell slots are
 * already spent automatically on Divine Smite/Hunter's Mark (Phase 13.8,
 * D-093), not through a spellbook pick, and giving them one too would mean
 * the same slot pool getting double-booked — a bigger, separate decision
 * left for a future session, not an oversight.
 */

import { EQUIPMENT_ORDER, getEquipmentDefinition } from "./equipment";

export const CHARACTER_NAME_POOL: string[] = [
  "Kael",
  "Sable",
  "Doran",
  "Lyra",
  "Finn",
  "Rue",
  "Torin",
  "Wynn",
  "Briar",
  "Odessa",
  "Garrick",
  "Nessa",
];

/**
 * Phase 13.11 (D-096): the starting-gear pool a created hero can pick one
 * item from (see this file's module comment) — every catalogue item at
 * common or uncommon rarity, in catalogue order.
 */
export const STARTING_GEAR_IDS: string[] = EQUIPMENT_ORDER.filter((id) => {
  const rarity = getEquipmentDefinition(id).rarity;
  return rarity === "common" || rarity === "uncommon";
});

/** Every class a created character can currently pick, in cycle order. */
export const CREATABLE_CLASS_IDS: string[] = [
  "fighter",
  "wizard",
  "rogue",
  "cleric",
  "barbarian",
  "bard",
  "druid",
  "monk",
  "paladin",
  "ranger",
  "sorcerer",
  "warlock",
];

/**
 * The signature abilities a non-spellbook-caster class picks at creation, in
 * cycle order. Phase 13.8 (D-093): Barbarian/Monk/Paladin/Ranger join
 * Fighter/Rogue here — each has its OWN real mechanic (Rage, Ki/Flurry,
 * Divine Smite, Hunter's Mark) that lives outside the spellbook (on the
 * bonus-action button), so their one Q-button action is still this same
 * fixed signature-ability choice, unchanged in shape since Phase 11.1.
 */
export const SIGNATURE_ABILITY_IDS: string[] = ["cleave", "piercing-shot", "taunting-slam", "frost-bolt"];

/**
 * Phase 16 (D-106): every cantrip on the Wizard's real SRD spell list that
 * this game can actually cast (7 of the SRD's 14 — Dancing Lights, Light,
 * Mage Hand, Mending, Message, Minor Illusion, and Prestidigitation stay
 * non-combat). Also the pool `signatureActionIdsForClass` cycles through at
 * creation for the one-time baseline-stat pick.
 */
export const WIZARD_CANTRIP_IDS: string[] = [
  "acid-splash",
  "chill-touch",
  "fire-bolt",
  "poison-spray",
  "ray-of-frost",
  "shocking-grasp",
  "true-strike",
];

/** Phase 16 (D-106): every cantrip on the Cleric's real SRD spell list this game can actually cast (3 of the SRD's 7). */
export const CLERIC_CANTRIP_IDS: string[] = ["guidance", "resistance", "sacred-flame"];

/** Phase 16 (D-106): every cantrip on the Bard's real SRD spell list this game can actually cast (2 of the SRD's 9). */
export const BARD_CANTRIP_IDS: string[] = ["true-strike", "vicious-mockery"];

/** Phase 16 (D-106): every cantrip on the Druid's real SRD spell list this game can actually cast (5 of the SRD's 7). */
export const DRUID_CANTRIP_IDS: string[] = ["guidance", "poison-spray", "produce-flame", "resistance", "shillelagh"];

/** Phase 16 (D-106): every cantrip on the Sorcerer's real SRD spell list this game can actually cast (shares its full list with the Wizard). */
export const SORCERER_CANTRIP_IDS: string[] = [
  "acid-splash",
  "chill-touch",
  "fire-bolt",
  "poison-spray",
  "ray-of-frost",
  "shocking-grasp",
  "true-strike",
];

/** Phase 16 (D-106): every cantrip on the Warlock's real SRD spell list this game can actually cast (4 of the SRD's 7). */
export const WARLOCK_CANTRIP_IDS: string[] = ["chill-touch", "eldritch-blast", "poison-spray", "true-strike"];

const NON_CASTER_CLASS_IDS = ["fighter", "rogue", "barbarian", "monk", "paladin", "ranger"];

/** Which signature-action id list a given class picks from. Throws on an unknown class id. */
export function signatureActionIdsForClass(classId: string): string[] {
  if (NON_CASTER_CLASS_IDS.includes(classId)) return SIGNATURE_ABILITY_IDS;
  if (classId === "wizard") return WIZARD_CANTRIP_IDS;
  if (classId === "cleric") return CLERIC_CANTRIP_IDS;
  if (classId === "bard") return BARD_CANTRIP_IDS;
  if (classId === "druid") return DRUID_CANTRIP_IDS;
  if (classId === "sorcerer") return SORCERER_CANTRIP_IDS;
  if (classId === "warlock") return WARLOCK_CANTRIP_IDS;
  throw new Error(`No signature-action list for class id "${classId}".`);
}

/**
 * Phase 16 (D-106): every leveled (1st-9th) spell on the Wizard's real SRD
 * spell list that this game can actually cast today (106 of them). The
 * remaining SRD entries (e.g. Identify, Comprehend Languages, Scrying) stay
 * genuinely non-combat — see `data/spells.ts`'s own module comment.
 */
export const WIZARD_LEVELED_SPELL_IDS: string[] = [
  "acid-arrow", "alter-self", "animate-dead", "animate-objects", "arcane-hand", "arcane-sword",
  "banishment", "bestow-curse", "black-tentacles", "blight", "blindness-deafness", "blink", "blur",
  "burning-hands", "chain-lightning", "charm-person", "circle-of-death", "cloudkill", "color-spray",
  "cone-of-cold", "confusion", "conjure-elemental", "conjure-minor-elementals", "create-undead",
  "darkness", "delayed-blast-fireball", "dimension-door", "disintegrate", "dispel-magic",
  "dominate-monster", "dominate-person", "enlarge-reduce", "eyebite", "faithful-hound", "false-life",
  "fear", "feeblemind", "finger-of-death", "fire-shield", "fireball", "flaming-sphere", "flesh-to-stone",
  "fly", "fog-cloud", "forcecage", "foresight", "freezing-sphere", "gaseous-form", "gate",
  "globe-of-invulnerability", "grease", "greater-invisibility", "gust-of-wind", "haste",
  "hideous-laughter", "hold-monster", "hold-person", "hypnotic-pattern", "ice-storm",
  "incendiary-cloud", "invisibility", "irresistible-dance", "levitate", "lightning-bolt", "mage-armor",
  "magic-circle", "magic-missile", "magic-weapon", "mass-suggestion", "meteor-swarm", "mirror-image",
  "mislead", "misty-step", "phantasmal-killer", "planar-binding", "plane-shift", "polymorph",
  "power-word-kill", "power-word-stun", "prismatic-spray", "prismatic-wall", "protection-from-energy",
  "protection-from-evil-and-good", "ray-of-enfeeblement", "resilient-sphere", "reverse-gravity",
  "scorching-ray", "seeming", "shatter", "shield", "sleep", "sleet-storm", "slow", "spider-climb",
  "stinking-cloud", "stoneskin", "suggestion", "sunbeam", "sunburst", "telekinesis", "teleport",
  "thunderwave", "time-stop", "true-seeing", "vampiric-touch", "wall-of-fire", "wall-of-force",
  "wall-of-ice", "wall-of-stone", "web", "weird", "wish",
];

/** Phase 16 (D-106): every leveled spell on the Cleric's real SRD spell list this game can actually cast today (56 of them). */
export const CLERIC_LEVELED_SPELL_IDS: string[] = [
  "aid", "animate-dead", "bane", "banishment", "beacon-of-hope", "bestow-curse", "blade-barrier",
  "bless", "blindness-deafness", "calm-emotions", "command", "conjure-celestial", "contagion",
  "create-undead", "cure-wounds", "daylight", "death-ward", "dispel-evil-and-good", "dispel-magic",
  "divine-word", "earthquake", "enhance-ability", "fire-storm", "flame-strike", "forbiddance",
  "freedom-of-movement", "gate", "greater-restoration", "guardian-of-faith", "guiding-bolt", "hallow",
  "harm", "heal", "healing-word", "heroes-feast", "hold-person", "holy-aura", "inflict-wounds",
  "insect-plague", "lesser-restoration", "magic-circle", "mass-cure-wounds", "mass-heal",
  "mass-healing-word", "planar-ally", "planar-binding", "plane-shift", "prayer-of-healing",
  "protection-from-energy", "protection-from-evil-and-good", "protection-from-poison", "regenerate",
  "sanctuary", "shield-of-faith", "spirit-guardians", "spiritual-weapon", "true-seeing", "warding-bond",
];

/** Phase 16 (D-106): every leveled spell on the Bard's real SRD spell list this game can actually cast today (51 of them). */
export const BARD_LEVELED_SPELL_IDS: string[] = [
  "animate-objects", "arcane-sword", "bane", "bestow-curse", "blindness-deafness", "calm-emotions",
  "charm-person", "compulsion", "confusion", "cure-wounds", "dimension-door", "dispel-magic",
  "dominate-monster", "dominate-person", "enhance-ability", "enthrall", "eyebite", "faerie-fire",
  "fear", "feeblemind", "forcecage", "foresight", "freedom-of-movement", "greater-invisibility",
  "greater-restoration", "healing-word", "heat-metal", "heroism", "hideous-laughter", "hold-monster",
  "hold-person", "hypnotic-pattern", "invisibility", "irresistible-dance", "lesser-restoration",
  "mass-cure-wounds", "mass-suggestion", "mislead", "planar-binding", "plant-growth", "polymorph",
  "power-word-kill", "power-word-stun", "regenerate", "seeming", "shatter", "sleep", "stinking-cloud",
  "suggestion", "teleport", "thunderwave", "true-seeing",
];

/** Phase 16 (D-106): every leveled spell on the Druid's real SRD spell list this game can actually cast today (61 of them). */
export const DRUID_LEVELED_SPELL_IDS: string[] = [
  "animal-shapes", "antilife-shell", "barkskin", "blight", "call-lightning", "charm-person",
  "confusion", "conjure-animals", "conjure-elemental", "conjure-fey", "conjure-minor-elementals",
  "conjure-woodland-beings", "contagion", "cure-wounds", "daylight", "dispel-magic", "dominate-beast",
  "earthquake", "enhance-ability", "entangle", "faerie-fire", "feeblemind", "fire-storm", "flame-blade",
  "flaming-sphere", "fog-cloud", "foresight", "freedom-of-movement", "giant-insect",
  "greater-restoration", "gust-of-wind", "heal", "healing-word", "heat-metal", "heroes-feast",
  "hold-person", "ice-storm", "insect-plague", "lesser-restoration", "mass-cure-wounds", "moonbeam",
  "pass-without-trace", "planar-binding", "plane-shift", "plant-growth", "polymorph",
  "protection-from-energy", "protection-from-poison", "regenerate", "reverse-gravity", "sleet-storm",
  "spike-growth", "stoneskin", "storm-of-vengeance", "sunbeam", "sunburst", "thunderwave", "tree-stride",
  "wall-of-fire", "wall-of-stone", "wall-of-thorns", "wind-wall",
];

/** Phase 16 (D-106): every leveled spell on the Sorcerer's real SRD spell list this game can actually cast today (83 of them). */
export const SORCERER_LEVELED_SPELL_IDS: string[] = [
  "alter-self", "animate-objects", "banishment", "blight", "blindness-deafness", "blink", "blur",
  "burning-hands", "chain-lightning", "charm-person", "circle-of-death", "cloudkill", "color-spray",
  "cone-of-cold", "confusion", "darkness", "daylight", "delayed-blast-fireball", "dimension-door",
  "disintegrate", "dispel-magic", "dominate-beast", "dominate-monster", "dominate-person",
  "earthquake", "enhance-ability", "enlarge-reduce", "eyebite", "false-life", "fear", "finger-of-death",
  "fire-storm", "fireball", "fly", "fog-cloud", "gaseous-form", "gate", "globe-of-invulnerability",
  "greater-invisibility", "gust-of-wind", "haste", "hold-monster", "hold-person", "hypnotic-pattern",
  "ice-storm", "incendiary-cloud", "insect-plague", "invisibility", "levitate", "lightning-bolt",
  "mage-armor", "magic-missile", "mass-suggestion", "meteor-swarm", "mirror-image", "misty-step",
  "plane-shift", "polymorph", "power-word-kill", "power-word-stun", "prismatic-spray",
  "protection-from-energy", "reverse-gravity", "scorching-ray", "seeming", "shatter", "shield",
  "sleep", "sleet-storm", "slow", "spider-climb", "stinking-cloud", "stoneskin", "suggestion",
  "sunbeam", "sunburst", "telekinesis", "teleport", "thunderwave", "time-stop", "true-seeing",
  "wall-of-fire", "wall-of-stone", "web", "wish",
];

/**
 * Phase 16 (D-106, follow-up fix): every leveled spell on the Warlock's
 * real SRD spell list this game can actually cast today (38 of them).
 * Hellish Rebuke was originally missing here because it had never been
 * added to `data/spells.ts`'s catalogue at all — a Phase 15 (D-104) gap,
 * found and fixed in a follow-up session (modeled as a normal action-cost
 * attack, not the SRD's reaction — see that spell's own comment in
 * `data/spells.ts`).
 */
export const WARLOCK_LEVELED_SPELL_IDS: string[] = [
  "banishment", "blight", "charm-person", "circle-of-death", "conjure-fey", "create-undead",
  "darkness", "dimension-door", "dispel-magic", "dominate-monster", "enthrall", "eyebite", "fear",
  "feeblemind", "finger-of-death", "flesh-to-stone", "fly", "forcecage", "foresight", "gaseous-form",
  "hellish-rebuke", "hold-monster", "hold-person", "hypnotic-pattern", "invisibility", "magic-circle",
  "mass-suggestion", "mirror-image", "misty-step", "plane-shift", "power-word-kill", "power-word-stun",
  "protection-from-evil-and-good", "ray-of-enfeeblement", "shatter", "spider-climb", "suggestion",
  "true-seeing", "vampiric-touch",
];

/**
 * Phase 13.7 (D-092): every spell a caster of this class actually KNOWS and
 * can cast in battle — every cantrip (not just the one picked as a
 * "signature action" at creation) plus every leveled spell this game can
 * cast today. Empty for a non-spellbook-caster class (Fighter/Rogue/
 * Barbarian/Monk/Paladin/Ranger, Phase 13.8) — Paladin/Ranger DO have a
 * real half-caster spell-slot economy (see data/classes.ts), but its one
 * consequence today (Divine Smite, Hunter's Mark) lives outside the
 * spellbook, on the bonus-action button, so they still have no known-spell
 * list here — see `BattleScene.isCasterHero`, which keys off THIS list
 * being non-empty, not off a class merely having `spellcasting` data.
 */
export function knownSpellIdsForClass(classId: string): string[] {
  return [...cantripIdsForClass(classId), ...leveledSpellIdsForClass(classId)];
}

/** D-134: just the cantrip half of `knownSpellIdsForClass` — the eligible pool `SpellPreparationSystem` draws a caster's known cantrips from. Empty for a non-caster. */
export function cantripIdsForClass(classId: string): string[] {
  if (classId === "wizard") return WIZARD_CANTRIP_IDS;
  if (classId === "cleric") return CLERIC_CANTRIP_IDS;
  if (classId === "bard") return BARD_CANTRIP_IDS;
  if (classId === "druid") return DRUID_CANTRIP_IDS;
  if (classId === "sorcerer") return SORCERER_CANTRIP_IDS;
  if (classId === "warlock") return WARLOCK_CANTRIP_IDS;
  return [];
}

/** D-134: just the leveled-spell half of `knownSpellIdsForClass` — the eligible pool `SpellPreparationSystem` draws a caster's prepared/known leveled spells (and a Wizard's spellbook) from. Empty for a non-caster. */
export function leveledSpellIdsForClass(classId: string): string[] {
  if (classId === "wizard") return WIZARD_LEVELED_SPELL_IDS;
  if (classId === "cleric") return CLERIC_LEVELED_SPELL_IDS;
  if (classId === "bard") return BARD_LEVELED_SPELL_IDS;
  if (classId === "druid") return DRUID_LEVELED_SPELL_IDS;
  if (classId === "sorcerer") return SORCERER_LEVELED_SPELL_IDS;
  if (classId === "warlock") return WARLOCK_LEVELED_SPELL_IDS;
  return [];
}
