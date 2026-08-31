import type { AbilityScoreId } from "./abilityScores";
import type { MagicInitiateListId } from "../entities/Hero";

/**
 * Backgrounds — Phase 2.5 (2026-08-28 playtest batch), D-206. SRD 5.2.1/5.5e
 * moved a character's ability-score bonuses from Race to Background; this
 * file is that system's data.
 *
 * IMPORTANT SOURCING NOTE: the real SRD 5.2.1 (CC BY 4.0) contains exactly
 * FOUR backgrounds — Acolyte, Criminal, Sage, Soldier — not the full 2024
 * Player's Handbook's sixteen. This was verified directly against
 * dndbeyond.com's own SRD changelog ("Added 3 Backgrounds: Criminal, Sage,
 * Soldier" on top of Acolyte already in 5.1/5.2) before writing any of this,
 * per this project's own "verify real docs, don't assume" policy (the same
 * one that caught Tough/Lucky/Athlete being PHB-only feats, see
 * `CONTENT_SOURCES.md`). The remaining 6 backgrounds below (`ORIGINAL_BACKGROUND_IDS`)
 * are original content, at Kevin's explicit direction, drawing on this
 * game's own world — the tower-defense/siege genre itself, and
 * `CAMPAIGN_STORY_DESIGN.md`'s "Unremembering" throughline — rather than
 * reskinning the 12 PHB backgrounds this project isn't licensed to use.
 *
 * Every background grants: 2 skill proficiencies (`skillIds`, into
 * `data/skills.ts`'s now-12-skill set — see that file's own D-206 note), a
 * tool/trade proficiency (`toolProficiencyFlavor` — honestly flavor-only,
 * this game has no tool-check/crafting system to hook it into, the same
 * treatment `feats.ts` already gives the Skilled feat), a choice of ability-
 * score improvement among 3 named abilities (`abilityTriad` — either +2 to
 * one and +1 to another, or +1 to all three; see
 * `CharacterBuildSystem.applyBackgroundAbilityBonus`), a single Origin Feat
 * (`originFeatId`, into the existing D-109 feat system — `magicInitiateList`
 * is set only for the two backgrounds granting Magic Initiate, since that
 * feat needs to know which spell list), and a starting-equipment nod
 * (`startingWeaponId` — granted free into an open gear slot if set, real
 * weapons already in `data/weapons.ts` — plus `startingGold`, this game's
 * mechanical stand-in for the rest of each SRD package's tools/books/
 * clothes, which stay descriptive only in `description`).
 */

export interface BackgroundDefinition {
  id: string;
  name: string;
  description: string;
  skillIds: [string, string];
  toolProficiencyFlavor: string;
  abilityTriad: [AbilityScoreId, AbilityScoreId, AbilityScoreId];
  originFeatId: string;
  magicInitiateList?: MagicInitiateListId;
  startingWeaponId?: string;
  startingGold: number;
}

export const BACKGROUNDS: Record<string, BackgroundDefinition> = {
  // ----- 4 real SRD 5.2.1 backgrounds -------------------------------------

  acolyte: {
    id: "acolyte",
    name: "Acolyte",
    description:
      "Raised in service to a temple, tending its rites and its records long before anyone trusted you with anything sharper than a candle-snuffer.",
    skillIds: ["insight", "religion"],
    toolProficiencyFlavor: "Calligrapher's Supplies",
    abilityTriad: ["int", "wis", "cha"],
    originFeatId: "magic-initiate",
    magicInitiateList: "cleric",
    startingGold: 8,
  },
  criminal: {
    id: "criminal",
    name: "Criminal",
    description: "Made a living where the law didn't reach, or pretended not to notice — quick hands, quieter feet.",
    skillIds: ["sleight-of-hand", "stealth"],
    toolProficiencyFlavor: "Thieves' Tools",
    abilityTriad: ["dex", "con", "int"],
    originFeatId: "alert",
    startingWeaponId: "dagger",
    startingGold: 16,
  },
  sage: {
    id: "sage",
    name: "Sage",
    description: "Spent years buried in someone else's library, chasing a question most people had stopped asking.",
    skillIds: ["arcana", "history"],
    toolProficiencyFlavor: "Calligrapher's Supplies",
    abilityTriad: ["con", "int", "wis"],
    originFeatId: "magic-initiate",
    magicInitiateList: "wizard",
    startingWeaponId: "quarterstaff",
    startingGold: 8,
  },
  soldier: {
    id: "soldier",
    name: "Soldier",
    description: "Served in a real fighting company — drilled, marched, and bled alongside people who mattered more than the cause did.",
    skillIds: ["athletics", "intimidation"],
    toolProficiencyFlavor: "a Gaming Set",
    abilityTriad: ["str", "dex", "con"],
    originFeatId: "savage-attacker",
    startingWeaponId: "spear",
    startingGold: 14,
  },

  // ----- 6 original backgrounds (D-206, Kevin's explicit direction) -------

  "siege-engineer": {
    id: "siege-engineer",
    name: "Siege Engineer",
    description:
      "Learned fortification the hard way — which walls hold, which gates fail first, and how to put both back together under fire.",
    skillIds: ["athletics", "investigation"],
    toolProficiencyFlavor: "Engineer's Tools",
    abilityTriad: ["str", "con", "int"],
    originFeatId: "tough",
    startingGold: 12,
  },
  "ashfall-scout": {
    id: "ashfall-scout",
    name: "Ashfall Scout",
    description:
      "Reads unstable, ash-choked ground for a living — where it's solid, where it isn't, and how long you have before it stops mattering.",
    skillIds: ["perception", "stealth"],
    toolProficiencyFlavor: "Cartographer's Tools",
    abilityTriad: ["dex", "wis", "con"],
    originFeatId: "lucky",
    startingWeaponId: "shortbow",
    startingGold: 10,
  },
  harborhand: {
    id: "harborhand",
    name: "Harborhand",
    description: "Hauled nets and cargo on a working dock since before you could carry your own weight in fish.",
    skillIds: ["athletics", "persuasion"],
    toolProficiencyFlavor: "Fishing Tackle",
    abilityTriad: ["str", "con", "cha"],
    originFeatId: "savage-attacker",
    startingWeaponId: "spear",
    startingGold: 12,
  },
  "hedge-warden": {
    id: "hedge-warden",
    name: "Hedge-Warden",
    description:
      "The person a village actually goes to — part healer, part half-remembered nature-rite, held together by whoever needed holding together that week.",
    skillIds: ["insight", "religion"],
    toolProficiencyFlavor: "an Herbalism Kit",
    abilityTriad: ["wis", "int", "cha"],
    originFeatId: "magic-initiate",
    magicInitiateList: "druid",
    startingWeaponId: "quarterstaff",
    startingGold: 8,
  },
  "ledger-keeper": {
    id: "ledger-keeper",
    name: "Ledger-Keeper",
    description: "Kept the accounts for a company that couldn't afford to lose track of who owed what, or to whom.",
    skillIds: ["history", "persuasion"],
    toolProficiencyFlavor: "a Merchant's Scale",
    abilityTriad: ["int", "cha", "wis"],
    originFeatId: "lucky",
    startingWeaponId: "dagger",
    startingGold: 20,
  },
  "ember-marked": {
    id: "ember-marked",
    name: "Ember-Marked",
    description:
      "Something is already eroding — a name half-forgotten, a face in the mirror that takes a second too long to place. Perpetually watching, because memory alone can't be trusted to warn you twice.",
    skillIds: ["stealth", "insight"],
    toolProficiencyFlavor: "a set of memory-knots — a private, half-superstitious tally of what's still true",
    abilityTriad: ["dex", "wis", "int"],
    originFeatId: "alert",
    startingGold: 6,
  },
};

export const BACKGROUND_IDS: string[] = Object.keys(BACKGROUNDS);

/** The 4 real SRD 5.2.1 backgrounds — see this file's own module comment. */
export const SRD_BACKGROUND_IDS: string[] = ["acolyte", "criminal", "sage", "soldier"];

/** The 6 original (non-SRD) backgrounds — see this file's own module comment. */
export const ORIGINAL_BACKGROUND_IDS: string[] = ["siege-engineer", "ashfall-scout", "harborhand", "hedge-warden", "ledger-keeper", "ember-marked"];

/** Look up a background, throwing on an unknown id so typos fail loudly. */
export function getBackgroundDefinition(id: string): BackgroundDefinition {
  const def = BACKGROUNDS[id];
  if (!def) throw new Error(`Unknown background id "${id}".`);
  return def;
}

/**
 * The 7 valid ability-score-improvement combinations for a background's
 * 3-ability `abilityTriad` (SRD rule: +2 to one and +1 to a different one,
 * or +1 to all three) — every `+2/+1` ordered pair among the 3 abilities (6
 * of them) plus the one `+1/+1/+1` option. Used by
 * `CharacterCreationScene`'s ability-bonus picker to build its option list,
 * and by `CharacterBuildSystem.applyBackgroundAbilityBonus` to apply
 * whichever one was chosen.
 */
export function backgroundAbilityChoices(triad: readonly AbilityScoreId[]): Partial<Record<AbilityScoreId, number>>[] {
  const choices: Partial<Record<AbilityScoreId, number>>[] = [];
  for (const plusTwo of triad) {
    for (const plusOne of triad) {
      if (plusOne === plusTwo) continue;
      choices.push({ [plusTwo]: 2, [plusOne]: 1 });
    }
  }
  choices.push({ [triad[0]]: 1, [triad[1]]: 1, [triad[2]]: 1 });
  return choices;
}
