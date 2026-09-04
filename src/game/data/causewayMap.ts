import { parseMapRows, type ParsedMap } from "./testMap";

/**
 * Shattered Causeway — Phase 23 (D-114) map-design pass. A genuinely
 * different GEOMETRY from every prior map (TEST_MAP/Emberford/Saltmere are
 * all the same 16x9 skeleton with hazard tiles swapped): a single 2-tile
 * bridge across a chasm is the ONLY ground crossing, flanked by open floor
 * on both banks. This is the "pit" tile's showcase — a hero standing at the
 * crossing with a Push weapon mastery or a forced-move spell (Thunderwave,
 * Gust of Wind) can shove an enemy clean off the causeway for an
 * environmental kill (see BattleScene.pushEnemyAway). Fire tiles past the
 * crossing punish overextending once a hero clears it.
 *
 * `hazardsAffectHeroes: true` (Phase 23, D-114) — this map opts in to
 * terrain affecting heroes too, unlike Emberford/Saltmere which keep their
 * original enemy-only behavior unchanged.
 *
 * Phase 24 (D-115): a few loose-sand patches (canyon-rim dunes) sit right
 * where the far bank's fire lane would otherwise be trivially wallable —
 * an enemy that survives the dash across the causeway still has to be
 * fought there, not walled into an inescapable kill box, since nothing can
 * be built on sand (`GameMap.isBuildable`). Purely a build restriction —
 * sand carries no terrain effect of its own.
 *
 * Legend: see testMap.ts's doc comment (^ cliff, ~ water, F fire, A acid,
 * @ pit, D sand, $ shop, T treasure).
 *
 * All content here is original placeholder data — no third-party IP.
 *
 * D-228 (KI-177 item 1): resized 19x8 (152 tiles) -> 34x18 (612 tiles,
 * ~4.03x) — kept the map's whole signature mechanic intact (ONE 2-row-tall
 * bridge gap through an otherwise-solid pit wall is still the only ground
 * crossing) rather than replacing it with the open cross layout the other
 * regions use, since that chokepoint IS this map's identity. What changed:
 * the west bank grew tall enough for 4 separate spawn rows (y=3,7,10,14,
 * all at x6 — `spawns` array order, i.e. `spawnIndex` 0-3, is therefore
 * [top, upper-mid, lower-mid, bottom]) instead of the original's 2 stacked
 * spawns, so a chapter's waves can pour multiple groups toward the SAME
 * bridge on the same turn — real pressure on a genuinely defensible
 * chokepoint, not spread thin across the map. Heroes (still 4, x2) sit
 * right at the bridge's west mouth (y7-10). Sand/fire keep their original
 * placement logic (sand runs the full pit-wall's depth so nothing walls in
 * an enemy who survives the crossing; fire skips the two bridge-mouth rows
 * so the landing itself stays a clean fight, exactly as before).
 */
const CAUSEWAY_ROWS: string[] = [
  "..................@@.D..F.........",
  "..................@@.D..F.........",
  "..................@@.D..F.........",
  "..$...S...........@@.D..F.........",
  "..................@@.D..F.........",
  "..................@@.D..F.........",
  "..................@@.D..F.........",
  "..H...S...........@@.D..F.........",
  "..H..................D...........X",
  "..H..................D...........X",
  "..H...S...........@@.D..F.........",
  "..................@@.D..F.........",
  "..................@@.D..F.........",
  "..................@@.D..F.........",
  "......S...........@@.D..F.....T...",
  "..................@@.D..F.........",
  "..................@@.D..F.........",
  "..................@@.D..F.........",
];

export const CAUSEWAY_MAP: ParsedMap = parseMapRows(
  "causeway-01",
  "Shattered Causeway (chasm crossing)",
  CAUSEWAY_ROWS,
  { hazardsAffectHeroes: true },
);
