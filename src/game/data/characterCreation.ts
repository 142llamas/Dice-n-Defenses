/**
 * Character-creation content — Phase 11.1's first-pass creator (DECISIONS
 * D-070/D-071/D-073), extended in Phase 11.2 for a second, pickable class
 * (D-074), and again in Phase 11.3 (D-075) for race and two further
 * classes. A short preset name pool, since this project has no free-text
 * input UI anywhere yet (Phaser has no native text field, and adding a DOM
 * text overlay would be a new UI pattern this small first pass doesn't
 * need). All names are original, no IP.
 *
 * D-178: there is no more player-chosen "signature action." Every class's
 * baseline basic-Attack style/ability (`CharacterClassDefinition
 * .basicAttackStyle`/`primaryAbility`, `data/classes.ts`) is a fixed part of
 * that class's own identity now, not a creation-time pick — a non-caster's
 * real weapon Attack (`Hero.tryBasicAttack`) and class bonus/class actions
 * (`HeroActionRegistry`) already work independently of any such pick, and a
 * caster's full known-spell list (`knownSpellIdsForClass` below) was already
 * independent of it before this change too. Race, unlike class, has no
 * per-race action list — every race uses the full six-race pool from
 * `data/races.ts` directly.
 *
 * Phase 13.11 (D-096) originally gave a created hero ONE free gear pick from
 * a flat common/uncommon pool. Party Creation Overhaul Plan 2 (D-193)
 * replaced that with `startingGearIdsForSlotType` below: a real loadout
 * covering all 10 gear slots (Kevin's explicit call, expanding past this
 * plan item's original weapon/chest/third-slot-only scope), still
 * restricted to common/uncommon rarity for the same "no free rare-and-up
 * gear at level 1" reason as before. No slot is class-gated — every class
 * sees every slot's full pool (matches `EquipmentDefinition` having no
 * class-restriction field anywhere in this game).
 *
 * D-194: that free-pick-everything model is CAMPAIGN-MODE-ONLY as of this
 * decision — Free Play/manual Create Party keeps it unchanged, but a real
 * campaign run now gives companions a FIXED kit (`companionStartingGearForDifficulty`,
 * scaled by difficulty, never player-edited). `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md`
 * Plan 5 (D-246) later gave the campaign PC the same fixed-kit treatment —
 * see `defaultStartingGearForClass` below — retiring the point-buy "Gear
 * Points" budget this comment used to describe (`DifficultyDefinition
 * .startingGearPoints` no longer exists; `.companionDiscretionaryGearSlots`,
 * `data/difficulty.ts`, is unaffected and still companion-only).
 *
 * Phase 13.7 (D-092): in BATTLE, every caster gets its FULL real known-spell
 * list — `knownSpellIdsForClass` lists EVERY mechanically-active spell for a
 * class, and `BattleScene`'s spellbook overlay lets the player pick any of
 * them as their action each turn, spending a spell slot for a leveled one.
 * Fighter/Rogue and the other non-casters use their real weapon Attack plus
 * whatever `HeroActionRegistry` class actions they qualify for instead.
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

import {
  equipmentForSlotType,
  getEquipmentDefinition,
  type GearSlotType,
  type GearSlotId,
} from "./equipment";
import { getDifficultyDefinition, type DifficultyId } from "./difficulty";

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
 * Every catalogue item of a given slot type at common/uncommon rarity, in
 * catalogue order — the pool a starting-gear picker offers for that slot.
 * Used for all 10 gear slots (`GEAR_SLOT_IDS`), each independently pickable
 * at character creation — see `CharacterCreationScene.openGearPicker`.
 */
export function startingGearIdsForSlotType(slot: GearSlotType): string[] {
  return equipmentForSlotType(slot)
    .filter((def) => def.rarity === "common" || def.rarity === "uncommon")
    .map((def) => def.id);
}

/**
 * `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` Plan 5 (D-246): a brand-new campaign
 * PC's fixed, non-editable starting kit — retires the old "Gear Points"
 * free-pick-with-budget system entirely (there's no Armory to shop at
 * before Chapter 1 exists, per D-243, so a fixed floor loadout replaces the
 * point-buy pick that used to fill that gap). Confirmed with Kevin: no
 * player choice here, matching a companion's own fixed kit — each entry
 * reuses the EXACT item ids that class's own established companion carries
 * (`data/companions.ts`), for flavor consistency and zero new content. A
 * RETURNING campaign PC (once a build actually persists) never reads this —
 * their real gear comes from `CharacterCreationScene.startingGearIdsFromIndices`
 * reading back their persisted `startingGearIds`, which already reflects
 * whatever they bought in the between-missions Armory (D-243).
 */
const DEFAULT_STARTING_GEAR_BY_CLASS: Record<string, Partial<Record<GearSlotId, string>>> = {
  fighter: { weapon: "longsword", chest: "chain-shirt", shield: "shield" },
  wizard: { weapon: "dagger", chest: "padded-armor", shield: "arcane-focus" },
  rogue: { weapon: "shortsword", chest: "leather-armor" },
  cleric: { weapon: "mace", chest: "chain-shirt", shield: "holy-symbol" },
  barbarian: { weapon: "greataxe", chest: "hide-armor" },
  bard: { weapon: "rapier", chest: "leather-armor", shield: "component-pouch" },
  druid: { weapon: "quarterstaff", chest: "hide-armor", shield: "druidic-totem" },
  // D-193: no chest armor — Monk's `Hero.armorClass` only applies its
  // favorable unarmored formula when the chest slot is empty (same reason
  // the Monk companion, Mira Quill, carries no chest piece either).
  monk: { weapon: "quarterstaff" },
  paladin: { weapon: "warhammer", chest: "chain-mail", shield: "shield" },
  ranger: { weapon: "longbow", chest: "leather-armor" },
  sorcerer: { weapon: "dagger", chest: "padded-armor", shield: "arcane-focus" },
  warlock: { weapon: "dagger", chest: "leather-armor", shield: "component-pouch" },
};

/** Looks up `DEFAULT_STARTING_GEAR_BY_CLASS`, falling back to an empty kit for an unrecognized class id (defensive only — every `CREATABLE_CLASS_IDS` entry has an authored kit above). */
export function defaultStartingGearForClass(classId: string): Partial<Record<GearSlotId, string>> {
  return DEFAULT_STARTING_GEAR_BY_CLASS[classId] ?? {};
}

/**
 * D-194: a campaign companion's fixed starting kit at a given difficulty,
 * derived from their authored "normal" baseline (`CharacterBuild
 * .startingGearIds`, D-193 Plan 2.2) — never player-editable in campaign
 * mode (see `CharacterCreationScene`'s Gear button `identityLocked` guard).
 * `weapon` and `amulet` always survive, since they're what makes the
 * companion's class actually function. D-232: a caster's spellcasting focus
 * (holy symbol/wand/etc.) now lives in the `shield` slot instead of
 * `amulet` (`itemKind: "focus"`, see `equipment.ts`) — it ALSO always
 * survives and does NOT spend the discretionary budget below, same
 * treatment `amulet` used to give it. A real Shield in that same slot is
 * unaffected: `chest` then a non-focus `shield` stay discretionary and get
 * trimmed on harder difficulty, up to `companionDiscretionaryGearSlots` of
 * them surviving.
 */
export function companionStartingGearForDifficulty(
  baselineGearIds: Partial<Record<GearSlotId, string>>,
  difficultyId: DifficultyId,
): Partial<Record<GearSlotId, string>> {
  const kept: Partial<Record<GearSlotId, string>> = {};
  if (baselineGearIds.weapon) kept.weapon = baselineGearIds.weapon;
  if (baselineGearIds.amulet) kept.amulet = baselineGearIds.amulet;

  const shieldId = baselineGearIds.shield;
  const shieldIsFocus = !!shieldId && getEquipmentDefinition(shieldId).itemKind === "focus";
  if (shieldIsFocus) kept.shield = shieldId;

  let discretionaryBudget = getDifficultyDefinition(difficultyId).companionDiscretionaryGearSlots;
  for (const slotId of ["chest", "shield"] as const) {
    if (shieldIsFocus && slotId === "shield") continue; // already always-kept above, not part of the discretionary budget
    if (discretionaryBudget <= 0) break;
    if (baselineGearIds[slotId]) {
      kept[slotId] = baselineGearIds[slotId];
      discretionaryBudget -= 1;
    }
  }
  return kept;
}

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
 * Phase 16 (D-106): every cantrip on the Wizard's real SRD spell list that
 * this game can actually cast (7 of the SRD's 14 — Dancing Lights, Light,
 * Mage Hand, Mending, Message, Minor Illusion, and Prestidigitation stay
 * non-combat).
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
