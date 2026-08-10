import { parseMapRows, type ParsedMap, type DynamicTerrainEvent } from "./testMap";

/**
 * The Drowning Vale — Phase 23 (D-114) map-design pass. A marshland with a
 * permanent water fringe (rows 0/7) and a wide "flood zone" (cols 6-9, rows
 * 1-6) that starts as ordinary floor and turns to water mid-battle — this
 * map's DynamicTerrainSystem showcase: a telegraphed, CYCLICAL change (the
 * tide rises at Wave 3, recedes at Wave 6), rather than Cinderfall Rift's
 * one-way collapse. Water stays walkable, so the flood never blocks the
 * route to the exit — it just makes the direct crossing slower and (with
 * `hazardsAffectHeroes: true`) genuinely risky for whichever side is
 * standing in it when the tide turns.
 *
 * Phase 24 (D-115): a mudflat/sandbank borders each permanent water fringe
 * (rows 0/7) and a small dry hummock sits near the shop dock (row 6) — a
 * pure build restriction (`GameMap.isBuildable`), no terrain effect of its
 * own; thematically the sandy ground a marsh's open water always leaves
 * behind at its edge.
 *
 * Legend: see testMap.ts's doc comment ($ shop, T treasure, ~ water, D sand).
 *
 * All content here is original placeholder data — no third-party IP.
 */
const DROWNING_VALE_ROWS: string[] = [
  ".....D~~~~D.....",
  ".............T..",
  ".H..............",
  "SH.............X",
  "SH.............X",
  ".H..............",
  "..$.D...........",
  ".....D~~~~D.....",
];

const FLOOD_ZONE_POSITIONS = Array.from({ length: 6 }, (_, rowOffset) =>
  Array.from({ length: 4 }, (_, colOffset) => ({ x: 6 + colOffset, y: 1 + rowOffset })),
).flat();

const DROWNING_VALE_EVENTS: DynamicTerrainEvent[] = [
  {
    label: "The tide rises, flooding the marsh crossing",
    atWave: 3,
    warnWavesBefore: 2,
    positions: FLOOD_ZONE_POSITIONS,
    toTileType: "water",
  },
  {
    label: "The tide recedes, draining the marsh crossing",
    atWave: 6,
    warnWavesBefore: 1,
    positions: FLOOD_ZONE_POSITIONS,
    toTileType: "floor",
  },
];

export const DROWNING_VALE_MAP: ParsedMap = parseMapRows(
  "drowning-vale-01",
  "The Drowning Vale (tidal marsh)",
  DROWNING_VALE_ROWS,
  { hazardsAffectHeroes: true, dynamicTerrainEvents: DROWNING_VALE_EVENTS },
);
