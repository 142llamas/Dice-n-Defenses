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
 */
const FROSTBOUND_HOLLOW_ROWS: string[] = [
  ".......F...$..",
  "......^^......",
  ".H.~~.^^......",
  ".H.~~.^^......",
  "SH....^^.....X",
  ".H....^^.~~...",
  "......^^.~~...",
  "......^^......",
  "..T....F......",
];

export const FROSTBOUND_HOLLOW_MAP: ParsedMap = parseMapRows(
  "frostbound-hollow-01",
  "Frostbound Hollow (verticality, frozen ridge)",
  FROSTBOUND_HOLLOW_ROWS,
  { hazardsAffectHeroes: true },
);
