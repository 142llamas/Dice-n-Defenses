import type { GridPosition } from "../systems/GridSystem";

/**
 * The Phase 1 test map, written as human-editable "string art".
 *
 * This is the data-driven content pattern from the Source of Truth: the map is
 * data, not code. To change the battlefield, edit the rows below — no scene code
 * needs to change. Later phases replace this with loaded map files (maps.json).
 *
 * Legend (one character per tile):
 *   .  floor      (walkable)
 *   #  wall       (blocked — cannot be selected or walked)
 *   S  spawn      (floor; where enemies will enter in later phases)
 *   X  exit       (floor; where enemies would leave)
 *   H  hero start (floor; placeholder hero token)
 *   E  enemy start(floor; still parsed, but UNUSED in this map since Phase 3 —
 *      real enemies now spawn from the S spawn point and march to the X exit)
 *   ^  cliff      (blocked for ground units, same as a wall; a flying unit
 *      crosses it for free via PathfindingSystem's existing `ignoreWalls`
 *      mechanism — no pathfinding change needed for this tile type)
 *   ~  water      (floor-like: WALKABLE, but carries a terrain effect — see
 *      GameMap.terrainEffectAt / data/terrain.ts. Phase 11.7, D-071.)
 *   F  fire       (floor-like: WALKABLE, terrain effect — burns an enemy that
 *      enters it. Phase 11.7, D-071.)
 *   A  acid       (floor-like: WALKABLE, terrain effect — damages a ground
 *      enemy that enters it. Phase 11.7, D-071.)
 *   @  pit        (blocked for ground units, same as cliff — a flying unit
 *      crosses it for free. The twist: a unit forced onto a pit tile by a
 *      push/forced-move effect falls in and is instantly defeated, rather
 *      than being stopped short like any other unwalkable tile. See
 *      BattleScene.pushEnemyAway. Phase 23, D-114 — the "holes" hazard the
 *      original Source of Truth vision named but never built.)
 *   D  sand       (floor-like: WALKABLE, no terrain effect — moves and
 *      routes exactly like plain floor. The one difference: nothing may be
 *      BUILT on it (see GameMap.isBuildable / BuildSystem.canPlace) — loose
 *      ground that won't hold a foundation. Phase 24, D-115: a build
 *      restriction, not a hazard, so it carries no entry in data/terrain.ts.)
 *   $  shop       (floor; a tile a hero must be near to access the Gear HUD)
 *   T  treasure   (floor; a hero landing here gets a one-time gold bonus)
 *
 * All content here is original placeholder data — no third-party IP.
 *
 * Phase 7: the roster grew from two heroes to four, so this map now carries
 * four H tiles instead of two — one per party slot, in build order (see
 * BattleScene.buildHeroes). Two more H's were added flanking the existing
 * pair rather than changing the map's shape.
 *
 * Phase 11.7 (D-071): the map system grew terrain types (cliff/water/fire/
 * acid), shop/treasure tiles, and support for multiple spawns/exits — this
 * parser was already generic for the latter (spawns/exits are arrays). None
 * of that touches TEST_MAP itself, which stays exactly as it was.
 */

export type TileType = "floor" | "blocked" | "cliff" | "water" | "fire" | "acid" | "pit" | "sand";

export interface ParsedMap {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** tiles[y][x] — indexed by row (y) then column (x). */
  tiles: TileType[][];
  spawns: GridPosition[];
  exits: GridPosition[];
  heroStarts: GridPosition[];
  enemyStarts: GridPosition[];
  /** Phase 11.7 (D-071): tiles that gate the Gear HUD by proximity. */
  shops: GridPosition[];
  /** Phase 11.7 (D-071): tiles that award a one-time gold bonus. */
  treasures: GridPosition[];
  /**
   * Phase 23 (D-114): when true, a hero standing on a hazardous tile
   * (water/fire/acid) suffers the same terrain effect an enemy already
   * does (see GameMap.heroTerrainEffectAt / data/terrain.ts). Opt-in per
   * map so Phase 11.7's original maps (Emberford/Saltmere) keep their
   * exact original enemy-only behavior — undefined/false everywhere except
   * maps that explicitly set it.
   */
  hazardsAffectHeroes?: boolean;
  /**
   * Phase 23 (D-114): mid-battle terrain changes keyed to a wave number
   * (the same number the "Wave N / M" banner shows) — a rising tide, a
   * collapsing bridge. See systems/DynamicTerrainSystem.ts for the pure
   * logic that fires/telegraphs these.
   */
  dynamicTerrainEvents?: DynamicTerrainEvent[];
}

/**
 * Phase 23 (D-114): one mid-battle terrain change. Generic and data-driven —
 * any map can describe its own "the water rises" or "the bridge collapses"
 * moment without new engine code; see DynamicTerrainSystem.
 */
export interface DynamicTerrainEvent {
  /** Shown in the combat log when this fires, and in the warning shown ahead of time, e.g. "The tide rises". */
  label: string;
  /** The wave number this event fires at (matches the "Wave N / M" banner). */
  atWave: number;
  /** How many waves before `atWave` a warning appears. Defaults to 1. */
  warnWavesBefore?: number;
  /** The tiles that change when this event fires. */
  positions: GridPosition[];
  /** What those tiles become. */
  toTileType: TileType;
}

const TEST_MAP_ROWS: string[] = [
  "................",
  "....##....##....",
  "....##....##....",
  "..H.............",
  "S..............X",
  "..HHH...........",
  "....##....##....",
  "....##....##....",
  "................",
];

/**
 * Turn an array of equal-length strings into a ParsedMap.
 * Throws if the rows are not all the same width, which catches typos early.
 */
export function parseMapRows(
  id: string,
  name: string,
  rows: string[],
  options?: {
    hazardsAffectHeroes?: boolean;
    dynamicTerrainEvents?: DynamicTerrainEvent[];
  },
): ParsedMap {
  if (rows.length === 0) {
    throw new Error(`Map "${id}" has no rows.`);
  }
  const width = rows[0].length;

  const tiles: TileType[][] = [];
  const spawns: GridPosition[] = [];
  const exits: GridPosition[] = [];
  const heroStarts: GridPosition[] = [];
  const enemyStarts: GridPosition[] = [];
  const shops: GridPosition[] = [];
  const treasures: GridPosition[] = [];

  rows.forEach((rowText, y) => {
    if (rowText.length !== width) {
      throw new Error(
        `Map "${id}" row ${y} has width ${rowText.length}, expected ${width}.`,
      );
    }
    const tileRow: TileType[] = [];
    for (let x = 0; x < width; x++) {
      const char = rowText[x];
      switch (char) {
        case "#":
          tileRow.push("blocked");
          break;
        case ".":
          tileRow.push("floor");
          break;
        case "S":
          tileRow.push("floor");
          spawns.push({ x, y });
          break;
        case "X":
          tileRow.push("floor");
          exits.push({ x, y });
          break;
        case "H":
          tileRow.push("floor");
          heroStarts.push({ x, y });
          break;
        case "E":
          tileRow.push("floor");
          enemyStarts.push({ x, y });
          break;
        case "^":
          tileRow.push("cliff");
          break;
        case "~":
          tileRow.push("water");
          break;
        case "F":
          tileRow.push("fire");
          break;
        case "A":
          tileRow.push("acid");
          break;
        case "@":
          tileRow.push("pit");
          break;
        case "D":
          tileRow.push("sand");
          break;
        case "$":
          tileRow.push("floor");
          shops.push({ x, y });
          break;
        case "T":
          tileRow.push("floor");
          treasures.push({ x, y });
          break;
        default:
          throw new Error(
            `Map "${id}" has unknown character "${char}" at (${x}, ${y}).`,
          );
      }
    }
    tiles.push(tileRow);
  });

  return {
    id,
    name,
    cols: width,
    rows: rows.length,
    tiles,
    spawns,
    exits,
    heroStarts,
    enemyStarts,
    shops,
    treasures,
    hazardsAffectHeroes: options?.hazardsAffectHeroes,
    dynamicTerrainEvents: options?.dynamicTerrainEvents,
  };
}

export const TEST_MAP: ParsedMap = parseMapRows(
  "test-map-01",
  "Training Yard (placeholder)",
  TEST_MAP_ROWS,
);

/**
 * The exact inverse of `parseMapRows` (Phase 11.10, D-085): turns a `ParsedMap`
 * back into the row-string "string art" format above. Priority-checks role
 * arrays in the SAME order `GameMap.roleAt` does (spawn > exit > hero-start >
 * enemy-start > shop > treasure) so a tile that happens to appear in more than
 * one role array (shouldn't happen by construction, but this stays consistent
 * with the read-side priority regardless) round-trips predictably. This is
 * what turns a map-builder draft into the string form stored in Firestore
 * (`MapSharingSystem.toSharedMapRecord`) — `parseMapRows` is what reads it
 * back, so the pair is exercised together in `tests/mapBuilder.test.ts`.
 */
export function encodeMapRows(map: ParsedMap): string[] {
  const roleChar = (x: number, y: number): string | null => {
    const at = (list: GridPosition[]): boolean => list.some((p) => p.x === x && p.y === y);
    if (at(map.spawns)) return "S";
    if (at(map.exits)) return "X";
    if (at(map.heroStarts)) return "H";
    if (at(map.enemyStarts)) return "E";
    if (at(map.shops)) return "$";
    if (at(map.treasures)) return "T";
    return null;
  };

  const terrainChar: Record<TileType, string> = {
    floor: ".",
    blocked: "#",
    cliff: "^",
    water: "~",
    fire: "F",
    acid: "A",
    pit: "@",
    sand: "D",
  };

  const rows: string[] = [];
  for (let y = 0; y < map.rows; y++) {
    let row = "";
    for (let x = 0; x < map.cols; x++) {
      row += roleChar(x, y) ?? terrainChar[map.tiles[y][x]];
    }
    rows.push(row);
  }
  return rows;
}
