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
 *
 * D-228 (KI-177 item 1): resized 16x9 (144 tiles) -> 32x18 (576 tiles,
 * exactly 4x) by scaling BOTH dimensions exactly 2x (each original tile
 * becomes a 2x2 block) — the safest possible transform for a map whose
 * whole identity is its 3-lane topology (a north path, the direct middle
 * bridge, a south path, joined only at the far west/east connector
 * columns): doubling preserves every wall/connector/lane relationship by
 * construction, so connectivity needs no re-verification. Two extra spawn
 * points were then added, one in the north lane (top row) and one in the
 * south lane (bottom row), both landing on the same doubled west connector
 * column the mid-lane spawn already uses — so a chapter's waves can now
 * pressure the player from all 3 lanes on the same turn (`spawns` array
 * order is [north, mid x4 clustered at the west mouth, south], see the
 * scratch-verified indices this file's own tests confirm), not just funnel
 * everything down the one bridge as before.
 */
const CINDERFALL_RIFT_ROWS: string[] = [
  "..S...$$....FF....FF............",
  "......$$....FF....FF............",
  "DD..^^^^^^^^^^^^^^^^^^^^^^^^..DD",
  "DD..^^^^^^^^^^^^^^^^^^^^^^^^..DD",
  "..HH^^^^^^^^^^^^^^^^^^^^^^^^....",
  "..HH^^^^^^^^^^^^^^^^^^^^^^^^....",
  "..HH^^^^^^^^^^^^^^^^^^^^^^^^....",
  "..HH^^^^^^^^^^^^^^^^^^^^^^^^....",
  "SSHH..........................XX",
  "SSHH..........................XX",
  "..HH^^^^^^^^^^^^^^^^^^^^^^^^....",
  "..HH^^^^^^^^^^^^^^^^^^^^^^^^....",
  "DD..^^^^^^^^^^^^^^^^^^^^^^^^..DD",
  "DD..^^^^^^^^^^^^^^^^^^^^^^^^..DD",
  "DD..^^^^^^^^^^^^^^^^^^^^^^^^..DD",
  "DD..^^^^^^^^^^^^^^^^^^^^^^^^..DD",
  "..S.........FF....FF....TT......",
  "............FF....FF....TT......",
];

const CINDERFALL_RIFT_EVENTS: DynamicTerrainEvent[] = [
  {
    label: "The Cinderfall bridge groans and collapses into the rift!",
    atWave: 4,
    warnWavesBefore: 2,
    // D-228: each original (x,y) tile doubled into its own 2x2 block —
    // (7,4)/(8,4)/(9,4) -> x in [14,15]/[16,17]/[18,19], y in [8,9].
    positions: [
      { x: 14, y: 8 },
      { x: 15, y: 8 },
      { x: 16, y: 8 },
      { x: 17, y: 8 },
      { x: 18, y: 8 },
      { x: 19, y: 8 },
      { x: 14, y: 9 },
      { x: 15, y: 9 },
      { x: 16, y: 9 },
      { x: 17, y: 9 },
      { x: 18, y: 9 },
      { x: 19, y: 9 },
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
