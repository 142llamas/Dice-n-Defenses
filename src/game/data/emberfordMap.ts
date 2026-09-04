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
 *
 * D-228 (KI-177 item 1): resized 16x9 (144 tiles) -> 32x18 (576 tiles,
 * exactly 4x) — Kevin's "campaign combat is trivially easy" complaint, half
 * of which is that maps were too small to support more than a couple of
 * enemies on the field at once. Redesigned around an open cross-shaped
 * layout (mostly floor, so path connectivity is trivially guaranteed)
 * instead of the old two-lane flanking pattern: FOUR separate spawn points
 * (top x16y0, left x0y9, right x31y9, bottom x16y17 — `spawns` array order
 * is therefore [top, left, right, bottom], i.e. `spawnIndex` 0-3) each with
 * its own open corridor into a shared two-tile exit/hero-start cluster at
 * the center (rows 8-9), so a chapter's waves can spawn multiple groups on
 * the SAME turn from DIFFERENT points — see `EMBERFORD_CH1..4_WAVES`. The
 * cliff/fire/acid flavor tiles moved off the direct spawn->center lines
 * into the four diagonal quadrants, purely decorative now (not gating any
 * route). One shop, one treasure — same count as the original, still
 * reachable from the center.
 */
const EMBERFORD_ROWS: string[] = [
  "................S...............",
  "................................",
  "................................",
  "......^^................FF......",
  "......^^................FF......",
  "................................",
  "................................",
  "................................",
  "..............HXXH..............",
  "S..........$..H..H..T..........S",
  "................................",
  "................................",
  "................................",
  "......AA................^^......",
  "......AA................^^......",
  "................................",
  "................................",
  "................S...............",
];

export const EMBERFORD_MAP: ParsedMap = parseMapRows(
  "emberford-01",
  "Emberford Reach (volcanic, placeholder)",
  EMBERFORD_ROWS,
);
