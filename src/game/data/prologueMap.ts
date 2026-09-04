import { parseMapRows, type ParsedMap } from "./testMap";

/**
 * The Proving Ground — D-184's new one-time prologue mission map.
 *
 * Deliberately theme-neutral: unlike every other campaign map, this one
 * isn't paired with a region or a lore identity (see `data/campaigns.ts`'s
 * `PROLOGUE_*` block for why) — floor/blocked tiles only, no cliff/water/
 * fire/acid, no shop/treasure. A small, plain first battle every fresh
 * campaign save clears exactly once, not a showcase of anything.
 *
 * Legend: see the doc-comment at the top of `testMap.ts`.
 *
 * All content here is original — no third-party IP.
 *
 * D-228 (KI-177 item 1): Kevin specifically played this mission ("3 waves,
 * super easy") when reporting campaign combat as trivially easy — left the
 * map's deliberate small/plain footprint alone (a level-1 party's very
 * first battle doesn't need a sprawling field), but added a second spawn
 * point (row 5) so `PROLOGUE_WAVES` can put more than one enemy on the
 * field at a time — see that wave list's own updated `spawnIndex` usage.
 */
const PROLOGUE_ROWS: string[] = [
  "..H.H.H.H...",
  "............",
  "S..........X",
  "............",
  ".....##.....",
  "S...........",
  "............",
];

export const PROLOGUE_MAP: ParsedMap = parseMapRows(
  "prologue-01",
  "The Proving Ground",
  PROLOGUE_ROWS,
);
