import { parseMapRows, type ParsedMap } from "./testMap";

/**
 * Emberford Reach — Phase 11.7 (D-071) terrain showcase map, volcanic flavor
 * (cliffs + fire + acid). Additive: does NOT touch TEST_MAP or anything that
 * feeds the classic fixed-roster START path. Not wired into any scene/menu
 * yet — a map-select UI is Phase 11.8's job, not this one's. This exists
 * purely as valid, parseable, tested data demonstrating: multiple spawns/
 * exits, a mix of the new terrain types, and shop/treasure tiles.
 *
 * Legend: see the doc-comment at the top of `testMap.ts` (^ cliff, F fire,
 * A acid, $ shop, T treasure — same characters, same meaning, every map).
 *
 * All content here is original placeholder data — no third-party IP.
 *
 * Phase 11.8 (D-071): added four 'H' hero-start tiles on the open top row so
 * this map is actually playable once wired into a campaign (it previously
 * had none, which is fine for the "parseable data" showcase 11.7 needed but
 * not for a real battle — `BattleScene.buildHeroes` needs one hero-start
 * tile per party slot, same as `TEST_MAP`'s four).
 */
const EMBERFORD_ROWS: string[] = [
  ".H.H.H.H........",
  "....^^....^^....",
  "S...^^....^^...X",
  "....FF....AA....",
  "................",
  "....FF....AA....",
  "S...^^....^^...X",
  "....^^....^^....",
  "...$........T...",
];

export const EMBERFORD_MAP: ParsedMap = parseMapRows(
  "emberford-01",
  "Emberford Reach (volcanic, placeholder)",
  EMBERFORD_ROWS,
);
