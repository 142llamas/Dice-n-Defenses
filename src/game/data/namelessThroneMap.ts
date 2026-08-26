import { parseMapRows, type ParsedMap } from "./testMap";
import type { GridPosition } from "../systems/GridSystem";

/**
 * The Nameless Throne — the campaign capstone (D-188, CAMPAIGN_STORY_DESIGN.md
 * §5). A grand hall: an outer gallery strip (rows 0 and 8-10) walled off by a
 * pillar line with two crossing-gaps (rows 1 and 9, `^` cliff — blocked to
 * ground, free to flying, same as every other cliff tile), opening onto a
 * single wide nave (rows 2-7) that carries the real spawn-to-exit lane. A
 * hero never needs the galleries to win — they're flavor/side-space, not on
 * the critical path.
 *
 * Per the design doc's own call, the SAME fixed grid is used for both
 * endings — only 4 hazard tiles (flanking the dais in two symmetric pairs)
 * differ, and only in which effect they carry, never their position or the
 * surrounding geometry. This file bakes them as `fire` (the Ashen Sovereign
 * baseline); `NamelessThroneSystem.withThroneVariant` swaps them to `water`
 * for the Hollow Empress ending at battle-load time. `NAMELESS_THRONE_
 * HAZARD_POSITIONS` is exported specifically so that system never hardcodes
 * a second copy of these 4 coordinates.
 */

export const NAMELESS_THRONE_HAZARD_POSITIONS: readonly GridPosition[] = [
  { x: 7, y: 3 },
  { x: 14, y: 4 },
  { x: 14, y: 6 },
  { x: 7, y: 7 },
];

const NAMELESS_THRONE_ROWS: string[] = [
  ".................",
  "^^.^^^^^^^^^^^.^^",
  "..$..............",
  ".......F.........",
  ".H............F..",
  "SH..............X",
  ".H............F..",
  ".H.....F.......T.",
  ".................",
  "^^.^^^^^^^^^^^.^^",
  ".................",
];

export const NAMELESS_THRONE_MAP: ParsedMap = parseMapRows(
  "nameless-throne-01",
  "The Nameless Throne",
  NAMELESS_THRONE_ROWS,
  { hazardsAffectHeroes: true },
);
