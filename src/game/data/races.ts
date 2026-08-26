/**
 * Races — Phase 11.3's starter race/species list (DECISIONS D-071/D-075),
 * expanded by D-170 (KI-098 item 6), rescaled to real feet by D-172
 * (KI-098 item 7's map-size follow-up).
 *
 * SRD-derived content (see CONTENT_SOURCES.md): every race's name, speed,
 * and named traits are drawn from an actual SRD edition under CC BY 4.0 —
 * NOT uniformly SRD 5.2.1 as this comment used to (incorrectly) claim. A
 * D-170 verification pass against the real SRD 5.2.1 species chapter found
 * two mismatches in the original six, corrected here (attribution only,
 * data then unchanged by D-170 itself):
 * - **Half-Elf and Half-Orc are SRD 5.1 (2014) species — the 2024 ruleset's
 *   SRD 5.2.1 dropped both as standalone species entirely** (folded into
 *   Human/Custom Lineage options, with Orc promoted to its own full
 *   species instead). Both stay in this roster exactly as before — SRD 5.1
 *   content is equally allowed under this project's own sourcing policy —
 *   just correctly attributed now instead of misattributed to 5.2.1.
 * - **SRD 5.2.1 actually gives every species the same 30ft base speed**
 *   (Dwarf and Halfling included) — the 25ft-for-Dwarf/Halfling split this
 *   file has always used is SRD 5.1's rule, not 5.2.1's. D-170 left this
 *   UNCHANGED as a mechanical/balance decision outside its own "pure
 *   content" scope — **D-172 now uses BOTH real values on purpose**: this
 *   project keeps the SRD 5.1 25ft/30ft split (a deliberate house rule,
 *   not a 5.2.1 sourcing claim), converted to exact tiles instead of the
 *   old rounded approximation (see below).
 *
 * Human/Elf/Dwarf/Halfling (original four) and Dragonborn/Gnome/Goliath/
 * Orc/Tiefling (D-170's five new ones) are real SRD 5.2.1 species. All
 * trait DESCRIPTIONS are original wording, not copied SRD text — same
 * treatment as the Fighter/Wizard class tables.
 *
 * Speed is the ONE race trait that's mechanically active today: it directly
 * sets a created hero's `movementTiles` (see `CharacterBuildSystem`'s
 * `heroDefinitionFromBuild`) — this is the exact deferred item that
 * `CharacterBuildSystem`'s Phase 11.1 module comment flagged as "a flat
 * default... race-based speed is Phase 11.3."
 *
 * **D-172: 1 tile = 5ft, exactly** (was an abstracted "1 tile ≈ 10ft" — the
 * old 3-tile standard/2-tile slow split was never a precise conversion of
 * 30ft/25ft, just a rounded approximation). Every real-feet speed in this
 * file now divides cleanly by 5: standard 30ft → 6 tiles, Dwarf/Halfling's
 * 25ft → 5 tiles (not simply the old "2" doubled to "4" — that would still
 * be the old rounding, just at finer granularity; 25÷5=5 is the actual
 * exact value), and Goliath's 35ft → 7 tiles — no longer flattened to
 * standard for lack of a "faster than standard" tier (D-170's own
 * limitation), since a real tier now exists. This finer grid also required
 * doubling every OTHER movement-tied number in the game (enemy
 * `movementTiles`, gear/potion movement bonuses, the `slowed` status's
 * `movementReduction`, the Monk/Barbarian class movement bonus) so
 * relative hero-vs-enemy pacing is unchanged — see D-172 in
 * `DECISIONS.md` for the full accounting.
 *
 * Every other named trait (Darkvision, Fey Ancestry, Lucky, Breath Weapon,
 * etc.) is `mechanicallyActive: false` — this game has no lighting/vision
 * range, no charm/fright/poison mechanics, no skill-proficiency system, no
 * dice to reroll, no grapple-escape/size/flight mechanic, and no per-race
 * damage-resistance hook (the item-based resistance system from D-127/D-131
 * has nothing wiring a RACE to a damage type yet), so there's nothing for
 * these traits to hook into yet. Recorded as real data anyway, same as the
 * Fighter's inert Second Wind: a future system only has to WIRE these in,
 * not invent them from scratch.
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

const STANDARD_SPEED_TILES = 6; // 30ft ÷ 5ft/tile
const SLOW_SPEED_TILES = 5; // 25ft ÷ 5ft/tile (Dwarf, Halfling)
/** D-172: Goliath's real 35ft — D-170 flattened this to standard for lack of a "faster than standard" tier; this rescale finally gives it one. */
const FAST_SPEED_TILES = 7; // 35ft ÷ 5ft/tile (Goliath)

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
  {
    id: "dragonborn",
    name: "Dragonborn",
    speedTiles: STANDARD_SPEED_TILES,
    traits: [
      {
        name: "Draconic Ancestry",
        description:
          "Traces its bloodline to a particular kind of dragon, which sets a signature damage type. Inert — no ancestry-choice system exists yet.",
        mechanicallyActive: false,
      },
      {
        name: "Breath Weapon",
        description:
          "Can exhale a damaging blast in a cone or line once per rest. Inert — this game has no race-granted breath-weapon action yet, a good candidate for a future combat-integration slice.",
        mechanicallyActive: false,
      },
      {
        name: "Damage Resistance",
        description:
          "Resists whichever damage type its Draconic Ancestry sets. Inert — the item-based damage-resistance system (D-127/D-131) has no race-granted hook yet.",
        mechanicallyActive: false,
      },
      {
        name: "Darkvision",
        description: "Sees in the dark as if it were dim light. Inert — no lighting/vision-range system.",
        mechanicallyActive: false,
      },
      {
        name: "Draconic Flight",
        description:
          "Gains a short burst of real flight at higher levels in the tabletop rules. Inert — this game has no flight/aerial-movement mechanic.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "gnome",
    name: "Gnome",
    speedTiles: STANDARD_SPEED_TILES,
    traits: [
      {
        name: "Darkvision",
        description: "Sees in the dark as if it were dim light. Inert — no lighting/vision-range system.",
        mechanicallyActive: false,
      },
      {
        name: "Gnomish Cunning",
        description:
          "Unusually hard to fool or overwhelm mentally. Inert — this game has no Intelligence/Wisdom/Charisma saving-throw mechanic for it to improve.",
        mechanicallyActive: false,
      },
      {
        name: "Gnomish Lineage",
        description:
          "Chooses a Forest or Rock lineage for a small supernatural knack. Inert — no lineage-choice system exists yet.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "goliath",
    name: "Goliath",
    // D-172: SRD 5.2.1's real 35ft — D-170 flattened this to standard for
    // lack of a "faster than standard" tile tier; this rescale added one.
    speedTiles: FAST_SPEED_TILES,
    traits: [
      {
        name: "Giant Ancestry",
        description:
          "Chooses one giant-blooded benefit usable once per rest. Inert — no ancestry-choice system exists yet.",
        mechanicallyActive: false,
      },
      {
        name: "Large Form",
        description:
          "Can grow to Large size for a short time at higher levels in the tabletop rules. Inert — this game has no creature-size mechanic.",
        mechanicallyActive: false,
      },
      {
        name: "Powerful Build",
        description:
          "Has an easier time shrugging off being grabbed. Inert — this game's restrain-style statuses (Grappler, Frost Trap, etc.) have no escape-roll step for this to ease.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "orc",
    name: "Orc",
    speedTiles: STANDARD_SPEED_TILES,
    traits: [
      {
        name: "Adrenaline Rush",
        description:
          "Can Dash as a bonus action and gain a short burst of extra toughness. Inert — this game has no race-granted bonus-action-Dash/temporary-HP hook (Cunning Action's Dash is class-granted, not race-granted).",
        mechanicallyActive: false,
      },
      {
        name: "Darkvision",
        description: "Sees especially far in the dark, as if it were dim light. Inert — no lighting/vision-range system.",
        mechanicallyActive: false,
      },
      {
        name: "Relentless Endurance",
        description:
          "Once per rest, drops to 1 HP instead of 0 rather than falling. Inert today — same boundary as Half-Orc's identical trait, and the same future combat-integration candidate.",
        mechanicallyActive: false,
      },
    ],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    speedTiles: STANDARD_SPEED_TILES,
    traits: [
      {
        name: "Darkvision",
        description: "Sees in the dark as if it were dim light. Inert — no lighting/vision-range system.",
        mechanicallyActive: false,
      },
      {
        name: "Fiendish Legacy",
        description:
          "Chooses an Abyssal, Chthonic, or Infernal legacy for a small set of supernatural spells. Inert — no legacy-choice system exists yet.",
        mechanicallyActive: false,
      },
      {
        name: "Otherworldly Presence",
        description: "Knows the Thaumaturgy cantrip. Inert — this game has no non-combat utility-cantrip slot to place it in.",
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
