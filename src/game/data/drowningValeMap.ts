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
 *
 * D-228 (KI-177 item 1): resized 16x8 (128 tiles) -> 32x16 (512 tiles,
 * exactly 4x) by scaling both dimensions 2x (each original tile becomes a
 * 2x2 block) — preserves the flood-zone/tide mechanic exactly, since the
 * event's tile positions just get re-derived from the same doubled
 * coordinates (see `FLOOD_ZONE_POSITIONS` below). Two extra ground spawns
 * were added at different heights (rows 4 and 12) alongside the original
 * mid-height pair (rows 6-9, doubled) — `spawns` array order is
 * [upper, mid x8 clustered, lower] — so enemies now approach from 3
 * heights instead of funneling through one mid-height entry.
 */
const DROWNING_VALE_ROWS: string[] = [
  "..........DD~~~~~~~~DD..........",
  "..........DD~~~~~~~~DD..........",
  "..........................TT....",
  "..........................TT....",
  "S.HH............................",
  "..HH............................",
  "SSHH..........................XX",
  "SSHH..........................XX",
  "SSHH..........................XX",
  "SSHH..........................XX",
  "..HH............................",
  "..HH............................",
  "S...$$..DD......................",
  "....$$..DD......................",
  "..........DD~~~~~~~~DD..........",
  "..........DD~~~~~~~~DD..........",
];

const FLOOD_ZONE_POSITIONS = Array.from({ length: 12 }, (_, rowOffset) =>
  Array.from({ length: 8 }, (_, colOffset) => ({ x: 12 + colOffset, y: 2 + rowOffset })),
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
