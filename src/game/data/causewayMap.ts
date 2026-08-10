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
 */
const CAUSEWAY_ROWS: string[] = [
  "..$.....@@..D.....",
  "........@@..D.F...",
  ".H......@@..D.F...",
  ".H...S...........X",
  ".H...S...........X",
  ".H......@@..D.F...",
  "........@@..D.F...",
  "........@@..D..T..",
];

export const CAUSEWAY_MAP: ParsedMap = parseMapRows(
  "causeway-01",
  "Shattered Causeway (chasm crossing)",
  CAUSEWAY_ROWS,
  { hazardsAffectHeroes: true },
);
