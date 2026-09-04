import { parseMapRows, type ParsedMap } from "./testMap";

/**
 * Saltmere Shallows — Phase 11.7 (D-071) terrain showcase map, tidal flavor
 * (cliffs + water). Additive: does NOT touch TEST_MAP or anything that feeds
 * the classic fixed-roster START path. Not wired into any scene/menu yet —
 * a map-select UI is Phase 11.8's job, not this one's. The second of the two
 * required showcase maps: this one deliberately carries NO fire/acid, so a
 * later fire-themed vs. water-themed map split (11.8) has a clean water-only
 * example to build from.
 *
 * Legend: see the doc-comment at the top of `testMap.ts` (^ cliff, ~ water,
 * $ shop, T treasure — same characters, same meaning, every map).
 *
 * All content here is original placeholder data — no third-party IP.
 *
 * Phase 11.8 (D-071): added four 'H' hero-start tiles on the open top row so
 * this map is actually playable once wired into a campaign (it previously
 * had none, which is fine for the "parseable data" showcase 11.7 needed but
 * not for a real battle — `BattleScene.buildHeroes` needs one hero-start
 * tile per party slot, same as `TEST_MAP`'s four).
 *
 * D-228 (KI-177 item 1): resized 16x9 (144 tiles) -> 32x18 (576 tiles,
 * exactly 4x), same open cross-shaped layout as `EMBERFORD_MAP` (see that
 * file's own doc comment for the full rationale) — FOUR spawn points (top
 * x16y0, left x0y9, right x31y9, bottom x16y17; `spawns` array order is
 * [top, left, right, bottom], `spawnIndex` 0-3) feeding a shared exit/
 * hero-start cluster at the center, cliff/water flavor tiles moved into the
 * four diagonal quadrants (decorative, off every spawn->center route).
 */
const SALTMERE_ROWS: string[] = [
  "................S...............",
  "................................",
  "................................",
  "......^^................~~......",
  "......^^................~~......",
  "................................",
  "................................",
  "................................",
  "..............HXXH..............",
  "S..........$..H..H..T..........S",
  "................................",
  "................................",
  "................................",
  "......~~................^^......",
  "......~~................^^......",
  "................................",
  "................................",
  "................S...............",
];

export const SALTMERE_MAP: ParsedMap = parseMapRows(
  "saltmere-01",
  "Saltmere Shallows (tidal, placeholder)",
  SALTMERE_ROWS,
);
