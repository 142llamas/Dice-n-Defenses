import type { CharacterBuild } from "../systems/CharacterBuildSystem";
import { StandardArrayAllocator, subclassIdForNewBuild } from "../systems/CharacterBuildSystem";

/**
 * Companion catalogue (D-118 engine scaffolding; content authored D-177;
 * pool/recruitment shape redesigned KI-098 item 13 Phase 1 — see that
 * session's `DECISIONS.md` entry for the full recruitment-flow rationale).
 *
 * `CAMPAIGN_STORY_DESIGN.md` §6 originally named six companions, each a
 * narrative "mirror" of one region's boss. Kevin's own extension (D-177):
 * the roster should cover EVERY playable class — exposing the player to
 * build variety across the campaign, BG3-style, even though only 3 of the
 * 12 are ever active alongside the PC at once (`MAX_ACTIVE_COMPANIONS`,
 * `CompanionRosterSystem.ts`).
 *
 * Two pools, split by `homeRegionId` presence (see `POOL_A_COMPANION_IDS`/
 * `POOL_B_COMPANION_IDS` below):
 * - **Pool B** (the original six mirror companions): each tied to one
 *   region's boss. None start in the party — each unlocks onto the bench
 *   the first time their own home region's Chapter 1 is completed
 *   (`BattleScene.maybeUnlockHomeRegionCompanion`).
 * - **Pool A** (six ordinary class-coverage recruits, no region tie): 3 are
 *   drawn at random to seed a brand-new campaign's starting party
 *   (`CompanionSeedSystem.seedStartingCompanions`); the other 3 stay
 *   locked, each with its own `sideMissionId` — a fixed, flat, one-time
 *   battle (`data/campaigns.ts`'s `SIDE_MISSIONS`) reachable from
 *   `CompanionRosterScene`'s own locked card, that recruits the companion
 *   onto the bench on victory (`BattleScene.maybeUnlockSideMissionCompanion`).
 *
 * Per the design doc's own framing: "each companion is just a named
 * `HeroDefinition` with a preset starting build the player can keep
 * customizing after recruitment — this reuses the existing custom-build
 * hero system entirely." A `CompanionDefinition` is therefore a thin wrapper
 * around a `CharacterBuild` (the exact type `CharacterCreationScene`/
 * `CharacterBuildSystem.heroDefinitionFromBuild` already knows how to turn
 * into a playable `HeroDefinition`) plus the story metadata
 * `CompanionRosterSystem`/`CompanionRosterScene` need.
 *
 * `homeRegionId` is set for all six mirror companions now that every region
 * has a real `CampaignDefinition` id: Tamsin → "emberford-reach", Fenna →
 * "saltmere-shallows" (both Phase 26/D-177), and, as of Phase 27 (D-180),
 * Dorian → "shattered-causeway", Hollis → "cinderfall-rift", Sorrel →
 * "drowning-vale", Isolde → "frostbound-hollow".
 *
 * Every subclass field below is set the same way `CharacterCreationScene`
 * sets one for a player-built hero: `subclassIdForNewBuild` only ever
 * returns a value for a level-1-choice class (Cleric/Sorcerer/Warlock) — the
 * other nine classes stay undefined here too, and get their subclass
 * assigned through the normal in-battle level-up queue once that companion
 * actually reaches their class's real choice level, exactly like any
 * player-built hero of that class.
 *
 * Original content — no D&D/SRD-derived names or lore (see
 * `CONTENT_SOURCES.md`). Class/subclass/race MECHANICS these builds use are
 * already logged there; nothing new is added by this file.
 */
export interface CompanionDefinition {
  id: string;
  name: string;
  /** A complete, valid starting build — the same shape a player-built hero uses. */
  build: CharacterBuild;
  /** The region (campaign id) this companion is narratively tied to (Pool B) — their recruitment region. Undefined for Pool A (class-coverage recruits, no region tie). */
  homeRegionId?: string;
  /** The flat, one-time side-quest mission (a `CampaignDefinition` id in `data/campaigns.ts`'s `SIDE_MISSIONS`) that recruits this companion on victory. Set for every Pool A companion (the three not drawn into the starting trio unlock this way); undefined for Pool B, which unlocks via `homeRegionId` instead. */
  sideMissionId?: string;
  /** A one-line story hook — not full dialogue (that's a separate, later writing pass per CAMPAIGN_STORY_DESIGN.md §9's "still open" list). */
  hook: string;
}

export const COMPANIONS: CompanionDefinition[] = [
  // ----- Pool B (region-mirror companions, part 1 of 2) — unlock onto ----
  // ----- the bench when their own home region's Chapter 1 completes. ----

  {
    id: "hollis-vane",
    name: "Hollis Vane",
    homeRegionId: "cinderfall-rift",
    hook: 'Called "Two-Step" by his old company — a deserter from Warlord Korrath\'s warband who always let others fight for him. Joins Region 3 (Cinderfall Rift) — his own homecoming.',
    build: {
      id: "hollis-vane",
      name: "Hollis Vane",
      raceId: "human",
      classId: "fighter",
      level: 1,
      abilityScores: new StandardArrayAllocator(["str", "con", "dex", "wis", "cha", "int"]).scores(),
      controlledBy: "human",
      startingGearIds: { weapon: "longsword", chest: "chain-shirt", shield: "shield" },
    },
  },
  {
    id: "fenna-duskwater",
    name: "Fenna Duskwater",
    homeRegionId: "saltmere-shallows",
    hook: "A sailor who still talks to Tidelord's drowned crew as if the tide never took them. Joins Region 5 (Saltmere Shallows) — her own homecoming.",
    build: {
      id: "fenna-duskwater",
      name: "Fenna Duskwater",
      raceId: "half-elf",
      classId: "druid",
      level: 1,
      abilityScores: new StandardArrayAllocator(["wis", "con", "dex", "cha", "int", "str"]).scores(),
      controlledBy: "human",
      startingGearIds: { weapon: "quarterstaff", chest: "hide-armor", amulet: "druidic-totem" },
    },
  },
  {
    id: "isolde-varnhall",
    name: "Isolde Varnhall",
    homeRegionId: "frostbound-hollow",
    hook: "Exiled nobility from the Sundered King's fallen court, who waits and watches exactly like the King does. Joins Region 6 (Frostbound Hollow) — her own homecoming, right before the capstone.",
    build: {
      id: "isolde-varnhall",
      name: "Isolde Varnhall",
      raceId: "elf",
      classId: "wizard",
      level: 1,
      abilityScores: new StandardArrayAllocator(["int", "con", "dex", "wis", "cha", "str"]).scores(),
      controlledBy: "human",
      startingGearIds: { weapon: "dagger", chest: "padded-armor", amulet: "arcane-focus" },
    },
  },

  // ----- Pool B (region-mirror companions, part 2 of 2) -------------------

  {
    id: "tamsin-rourke",
    name: "Tamsin Rourke",
    homeRegionId: "emberford-reach",
    hook: "A smith's apprentice, afraid that her own obsession with craft and vengeance is exactly how Cinderlord started. Joins Region 1 (Emberford Reach).",
    build: {
      id: "tamsin-rourke",
      name: "Tamsin Rourke",
      raceId: "dwarf",
      classId: "paladin",
      level: 1,
      abilityScores: new StandardArrayAllocator(["str", "cha", "con", "wis", "dex", "int"]).scores(),
      controlledBy: "human",
      startingGearIds: { weapon: "warhammer", chest: "chain-mail", shield: "shield" },
    },
  },
  {
    id: "dorian-wick",
    name: "Dorian Wick",
    homeRegionId: "shattered-causeway",
    hook: "Lost family to The Devourer; grief burning down slow, like a wick, into the same hollow hunger if left unchecked. Joins Region 2 (Shattered Causeway).",
    build: {
      id: "dorian-wick",
      name: "Dorian Wick",
      raceId: "tiefling",
      classId: "warlock",
      level: 1,
      abilityScores: new StandardArrayAllocator(["cha", "con", "dex", "wis", "int", "str"]).scores(),
      controlledBy: "human",
      subclassId: subclassIdForNewBuild("warlock"),
      startingGearIds: { weapon: "dagger", chest: "leather-armor", amulet: "component-pouch" },
    },
  },
  {
    id: "sorrel-thane",
    name: "Sorrel Thane",
    homeRegionId: "drowning-vale",
    hook: "A warden who's spent too long on Blightmother's ground and is visibly, slowly losing themselves to it. Joins Region 4 (The Drowning Vale) — see CAMPAIGN_STORY_DESIGN.md §6's branch chain for their fate.",
    build: {
      id: "sorrel-thane",
      name: "Sorrel Thane",
      raceId: "goliath",
      classId: "ranger",
      level: 1,
      abilityScores: new StandardArrayAllocator(["dex", "wis", "con", "str", "cha", "int"]).scores(),
      controlledBy: "human",
      startingGearIds: { weapon: "longbow", chest: "leather-armor" },
    },
  },

  // ----- Pool A (D-177): one per remaining class, no boss-mirror weight — -
  // ----- 3 seed a fresh campaign's starting party at random, the other 3 -
  // ----- stay locked behind their own not-yet-built side-quest missions. -

  {
    id: "brand-ashcairn",
    name: "Brand Ashcairn",
    sideMissionId: "side-brand-ashcairn",
    hook: "A wandering strongman who hires on for coin and stays for the fight.",
    build: {
      id: "brand-ashcairn",
      name: "Brand Ashcairn",
      raceId: "half-orc",
      classId: "barbarian",
      level: 1,
      abilityScores: new StandardArrayAllocator(["str", "con", "dex", "wis", "cha", "int"]).scores(),
      controlledBy: "human",
      startingGearIds: { weapon: "greataxe", chest: "hide-armor" },
    },
  },
  {
    id: "wren-calloway",
    name: "Wren Calloway",
    sideMissionId: "side-wren-calloway",
    hook: "A traveling performer who trades as much in secrets as in songs, and isn't afraid to swing a blade to protect either.",
    build: {
      id: "wren-calloway",
      name: "Wren Calloway",
      raceId: "gnome",
      classId: "bard",
      level: 1,
      abilityScores: new StandardArrayAllocator(["cha", "dex", "con", "wis", "int", "str"]).scores(),
      controlledBy: "human",
      startingGearIds: { weapon: "rapier", chest: "leather-armor", amulet: "component-pouch" },
    },
  },
  {
    id: "perrin-holt",
    name: "Perrin Holt",
    sideMissionId: "side-perrin-holt",
    hook: "A quiet field medic who's patched up more strangers than they can count, and has stopped asking why.",
    build: {
      id: "perrin-holt",
      name: "Perrin Holt",
      raceId: "human",
      classId: "cleric",
      level: 1,
      abilityScores: new StandardArrayAllocator(["wis", "con", "str", "dex", "cha", "int"]).scores(),
      controlledBy: "human",
      subclassId: subclassIdForNewBuild("cleric"),
      startingGearIds: { weapon: "mace", chest: "chain-shirt", amulet: "holy-symbol" },
    },
  },
  {
    id: "mira-quill",
    name: "Mira Quill",
    sideMissionId: "side-mira-quill",
    hook: "A monastic wanderer who left her order to see whether its discipline holds up outside monastery walls.",
    build: {
      id: "mira-quill",
      name: "Mira Quill",
      raceId: "halfling",
      classId: "monk",
      level: 1,
      abilityScores: new StandardArrayAllocator(["dex", "wis", "con", "str", "cha", "int"]).scores(),
      controlledBy: "human",
      // D-193: no chest armor — Monk's `Hero.armorClass` only applies its
      // favorable unarmored formula when the chest slot is empty.
      startingGearIds: { weapon: "quarterstaff" },
    },
  },
  {
    id: "cass-ferrow",
    name: "Cass Ferrow",
    sideMissionId: "side-cass-ferrow",
    hook: "A quick-fingered opportunist who reads a room — or a battlefield — before anyone else has finished walking into it.",
    build: {
      id: "cass-ferrow",
      name: "Cass Ferrow",
      raceId: "orc",
      classId: "rogue",
      level: 1,
      abilityScores: new StandardArrayAllocator(["dex", "con", "wis", "int", "cha", "str"]).scores(),
      controlledBy: "human",
      startingGearIds: { weapon: "shortsword", chest: "leather-armor" },
    },
  },
  {
    id: "ellery-vance",
    name: "Ellery Vance",
    sideMissionId: "side-ellery-vance",
    hook: "Magic runs in Ellery's blood, unpredictably — dragon-touched ancestry that surfaces as much as it's summoned.",
    build: {
      id: "ellery-vance",
      name: "Ellery Vance",
      raceId: "dragonborn",
      classId: "sorcerer",
      level: 1,
      abilityScores: new StandardArrayAllocator(["cha", "con", "dex", "wis", "int", "str"]).scores(),
      controlledBy: "human",
      subclassId: subclassIdForNewBuild("sorcerer"),
      startingGearIds: { weapon: "dagger", chest: "padded-armor", amulet: "arcane-focus" },
    },
  },
];

/** Look up a companion, throwing on an unknown id — matches `getCampaignDefinition`'s convention. */
export function getCompanionDefinition(id: string): CompanionDefinition {
  const def = COMPANIONS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown companion id "${id}".`);
  return def;
}

/** Pool A: class-coverage recruits with no home region — 3 seed a fresh campaign's starting party at random. */
export const POOL_A_COMPANION_IDS: string[] = COMPANIONS.filter((c) => !c.homeRegionId).map((c) => c.id);

/** Pool B: region-mirror companions — each unlocks onto the bench when their own home region's Chapter 1 completes. */
export const POOL_B_COMPANION_IDS: string[] = COMPANIONS.filter((c) => c.homeRegionId).map((c) => c.id);
