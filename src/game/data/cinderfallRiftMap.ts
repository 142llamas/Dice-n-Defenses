import { parseMapRows, type ParsedMap, type DynamicTerrainEvent } from "./testMap";

/**
 * Cinderfall Rift — Phase 23 (D-114) map-design pass. Three horizontal
 * lanes (a north path, a direct middle bridge, a south path), joined only at
 * the west and east ends by vertical connector strips — cliffs wall off the
 * middle rows everywhere else, so the middle bridge is genuinely the
 * shortest route while it lasts. This map's DynamicTerrainSystem showcase
 * is a ONE-WAY collapse (contrast with the Drowning Vale's cyclical tide):
 * the bridge's middle span permanently becomes a pit at Wave 4, forcing
 * everyone onto the longer, fire-lined north/south paths for the rest of
 * the battle. Always fully connected even after the collapse — see the
 * file-level reasoning in DECISIONS.md D-114.
 *
 * Phase 24 (D-115): a drift of loose ash-sand sits at both mouths of the
 * north/south connector strips (where rows 1/6/7 meet the open floor above
 * and below) — purely a build restriction (`GameMap.isBuildable`), no
 * terrain effect of its own; thematically the volcanic ash settling where
 * the rock gives way to open ground.
 *
 * Legend: see testMap.ts's doc comment (^ cliff, F fire, @ pit, D sand,
 * $ shop, T treasure).
 *
 * All content here is original placeholder data — no third-party IP.
 */
const CINDERFALL_RIFT_ROWS: string[] = [
  "...$..F..F......",
  "D.^^^^^^^^^^^^.D",
  ".H^^^^^^^^^^^^..",
  ".H^^^^^^^^^^^^..",
  "SH.............X",
  ".H^^^^^^^^^^^^..",
  "D.^^^^^^^^^^^^.D",
  "D.^^^^^^^^^^^^.D",
  "......F..F..T...",
];

const CINDERFALL_RIFT_EVENTS: DynamicTerrainEvent[] = [
  {
    label: "The Cinderfall bridge groans and collapses into the rift!",
    atWave: 4,
    warnWavesBefore: 2,
    positions: [
      { x: 7, y: 4 },
      { x: 8, y: 4 },
      { x: 9, y: 4 },
    ],
    toTileType: "pit",
  },
];

export const CINDERFALL_RIFT_MAP: ParsedMap = parseMapRows(
  "cinderfall-rift-01",
  "Cinderfall Rift (volcanic, collapsing bridge)",
  CINDERFALL_RIFT_ROWS,
  { hazardsAffectHeroes: true, dynamicTerrainEvents: CINDERFALL_RIFT_EVENTS },
);
