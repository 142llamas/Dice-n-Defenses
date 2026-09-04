import { parseMapRows, type ParsedMap } from "./testMap";

/**
 * Frostbound Hollow — Phase 23 (D-114) map-design pass. A static
 * verticality/flying-vs-ground showcase: a solid cliff ridge (cols 6-7,
 * rows 1-7) splits the map in two, with the only ground crossings at the
 * very top (row 0) and bottom (row 8) rows — a real detour for ground
 * enemies, while a flying enemy simply crosses the ridge directly (cliffs
 * are free for flying units via PathfindingSystem's existing `ignoreWalls`
 * mechanism — no new code needed to make this map demonstrate it). Two
 * small permanent frozen-lake patches (water) flank the ridge on each side.
 * Deliberately has NO dynamic terrain — a contrast with Drowning Vale/
 * Cinderfall Rift, so not every new map relies on the same trick.
 *
 * Legend: see testMap.ts's doc comment (^ cliff, ~ water, F fire, $ shop, T treasure).
 *
 * All content here is original placeholder data — no third-party IP.
 *
 * D-228 (KI-177 item 1): resized 14x9 (126 tiles) -> 28x18 (504 tiles,
 * exactly 4x) by scaling both dimensions 2x (each original tile becomes a
 * 2x2 block) — preserves the ridge-splits-the-map/ground-detour-vs-
 * flying-shortcut identity exactly, since doubling can't break that
 * topology. Two extra ground spawns were added on the west bank at
 * different heights (rows 4 and 12) alongside the original mid-height one
 * (rows 8-9, doubled) — `spawns` array order is [upper, mid x2, lower] —
 * so ground enemies now approach the ridge's top/bottom crossings from 3
 * different heights at once instead of funneling through a single spawn.
 */
const FROSTBOUND_HOLLOW_ROWS: string[] = [
  "..............FF......$$....",
  "..............FF......$$....",
  "............^^^^............",
  "............^^^^............",
  "S.HH..~~~~..^^^^............",
  "..HH..~~~~..^^^^............",
  "..HH..~~~~..^^^^............",
  "..HH..~~~~..^^^^............",
  "SSHH........^^^^..........XX",
  "SSHH........^^^^..........XX",
  "..HH........^^^^..~~~~......",
  "..HH........^^^^..~~~~......",
  "S...........^^^^..~~~~......",
  "............^^^^..~~~~......",
  "............^^^^............",
  "............^^^^............",
  "....TT........FF............",
  "....TT........FF............",
];

export const FROSTBOUND_HOLLOW_MAP: ParsedMap = parseMapRows(
  "frostbound-hollow-01",
  "Frostbound Hollow (verticality, frozen ridge)",
  FROSTBOUND_HOLLOW_ROWS,
  { hazardsAffectHeroes: true },
);
