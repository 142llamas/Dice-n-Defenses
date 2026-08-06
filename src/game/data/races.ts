/**
 * Races — Phase 11.3's starter race/species list (DECISIONS D-071/D-075).
 * SRD 5.2.1's starter six: Human, Elf, Dwarf, Halfling, Half-Elf, Half-Orc.
 *
 * SRD-derived content (see CONTENT_SOURCES.md): the race names, their SRD
 * speed (25ft vs. the default 30ft), and their named traits follow SRD 5.2.1
 * under CC BY 4.0. All trait DESCRIPTIONS are original wording, not copied
 * SRD text — same treatment as the Fighter/Wizard class tables.
 *
 * Speed is the ONE race trait that's mechanically active today: it directly
 * sets a created hero's `movementTiles` (see `CharacterBuildSystem`'s
 * `heroDefinitionFromBuild`) — this is the exact deferred item that
 * `CharacterBuildSystem`'s Phase 11.1 module comment flagged as "a flat
 * default... race-based speed is Phase 11.3." The default 3-tile speed maps
 * to the SRD's standard 30ft; the two 25ft races (Dwarf, Halfling) move one
 * tile slower.
 *
 * Every other named trait (Darkvision, Fey Ancestry, Lucky, etc.) is
 * `mechanicallyActive: false` — this game has no lighting/vision range, no
 * charm/fright/poison mechanics, no skill-proficiency system, and no dice to
 * reroll, so there's nothing for these traits to hook into yet. Recorded as
 * real data anyway, same as the Fighter's inert Second Wind: a future system
 * only has to WIRE these in, not invent them from scratch.
 */

export interface RaceTrait {
  name: string;
  description: string;
  mechanicallyActive: boolean;
}

export interface RaceDefinition {
  id: string;
  name: string;
  /** Movement tiles per turn — the SRD's 30ft/25ft speed, mapped to this game's tile scale. */
  speedTiles: number;
  traits: RaceTrait[];
}

const STANDARD_SPEED_TILES = 3;
const SLOW_SPEED_TILES = 2;

export const RACE_DEFINITIONS: RaceDefinition[] = [
  {
    id: "human",
    name: "Human",
    speedTiles: STANDARD_SPEED_TILES,
    traits: [
      {
        name: "Resourceful",
        description:
          "Humans adapt to nearly any role. This game has no skill-proficiency system yet, so today this is flavor only.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "elf",
    name: "Elf",
    speedTiles: STANDARD_SPEED_TILES,
    traits: [
      {
        name: "Darkvision",
        description: "Sees in the dark as if it were dim light. Inert — this game has no lighting/vision-range system.",
        mechanicallyActive: false,
      },
      {
        name: "Fey Ancestry",
        description: "Resists being charmed and cannot be put to sleep by magic. Inert — no charm/sleep mechanic exists yet.",
        mechanicallyActive: false,
      },
      {
        name: "Keen Senses",
        description: "Trained in observation. Inert — this game has no skill-proficiency system.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "dwarf",
    name: "Dwarf",
    speedTiles: SLOW_SPEED_TILES,
    traits: [
      {
        name: "Darkvision",
        description: "Sees in the dark as if it were dim light. Inert — no lighting/vision-range system.",
        mechanicallyActive: false,
      },
      {
        name: "Dwarven Resilience",
        description: "Naturally hardy against poison. Inert — this game has no poison damage type.",
        mechanicallyActive: false,
      },
      {
        name: "Stonecunning",
        description: "An instinct for stonework and tunnels. Inert — no terrain-knowledge mechanic exists yet.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "halfling",
    name: "Halfling",
    speedTiles: SLOW_SPEED_TILES,
    traits: [
      {
        name: "Lucky",
        description: "A knack for turning bad luck around. Inert — this game's combat is diceless (D-030).",
        mechanicallyActive: false,
      },
      {
        name: "Brave",
        description: "Steady nerves under pressure. Inert — this game has no fright/fear status effect.",
        mechanicallyActive: false,
      },
      {
        name: "Halfling Nimbleness",
        description:
          "Can slip through the space of a larger creature. This game's own pass-through movement rule (D-067) already covers same-type units, so this stays flavor only.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    speedTiles: STANDARD_SPEED_TILES,
    traits: [
      {
        name: "Darkvision",
        description: "Sees in the dark as if it were dim light. Inert — no lighting/vision-range system.",
        mechanicallyActive: false,
      },
      {
        name: "Fey Ancestry",
        description: "Resists being charmed and cannot be put to sleep by magic. Inert — no charm/sleep mechanic.",
        mechanicallyActive: false,
      },
      {
        name: "Skill Versatility",
        description: "Trained in two chosen skills. Inert — this game has no skill-proficiency system.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    speedTiles: STANDARD_SPEED_TILES,
    traits: [
      {
        name: "Darkvision",
        description: "Sees in the dark as if it were dim light. Inert — no lighting/vision-range system.",
        mechanicallyActive: false,
      },
      {
        name: "Relentless Endurance",
        description:
          "Once per rest, drop to 1 HP instead of 0 rather than falling. Inert today — this game has a rest concept for nothing yet (same boundary as the Fighter's Second Wind), and a good candidate for a future combat-integration slice.",
        mechanicallyActive: false,
      },
      {
        name: "Savage Attacks",
        description: "Hits especially hard on a lucky strike. Inert — this game's deterministic combat (D-030) has no critical hits.",
        mechanicallyActive: false,
      },
    ],
  },
];

export const RACE_IDS: string[] = RACE_DEFINITIONS.map((r) => r.id);

/** Look up a race definition, throwing on an unknown id so typos fail loudly. */
export function getRaceDefinition(id: string): RaceDefinition {
  const def = RACE_DEFINITIONS.find((r) => r.id === id);
  if (!def) throw new Error(`Unknown race id "${id}".`);
  return def;
}
