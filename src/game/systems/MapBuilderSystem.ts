import type { GridPosition } from "./GridSystem";
import { GameMap } from "./GameMap";
import { PathfindingSystem } from "./PathfindingSystem";
import type { ParsedMap, TileType } from "../data/testMap";

/**
 * MapBuilderSystem — Phase 11.10 (D-085): pure rules for authoring a
 * `ParsedMap` by hand (paint tiles, validate it's actually playable). No
 * Phaser dependency — `MapBuilderScene` renders the grid and turns clicks
 * into `paintTile` calls; this module owns every rule about what a valid
 * map is.
 *
 * There is deliberately no separate "draft" type — a `ParsedMap` mid-edit
 * has the exact same shape as a finished one, and whether it's passed
 * `validateDraft` yet is a runtime question, not a structural one.
 *
 * D-176 (KI-098 item 9): `BattleScene` used to render every map at a FIXED
 * `TILE_SIZE` (64px), which is what originally derived these caps. It now
 * computes a per-map tile size that shrinks to fit (`computeFittedTileSize`
 * in `GridSystem.ts`, mirroring `MapBuilderScene`'s own shrink-to-fit
 * pattern), clamped so it never exceeds the base 64px. The caps below
 * assume a chosen 40px legibility floor (not a hard technical limit —
 * tokens/HP text/VFX all scale off tile size, and much below this they get
 * hard to read) and are re-derived against the same fixed-HUD
 * bounding-box math as before: belowGridY = GRID_TOP_MARGIN(90) +
 * rows*tileSize + 16; cy (the button row) = belowGridY +
 * statusBlockHeight(78) + logBlockHeight(86) + 20; the Done button under
 * the taller shop/gear grid sits at cy + 4*38 + 30(pagination nav, worst
 * case) + 6, with its own half-height (15) below that — a fixed 403px of
 * HUD below the grid's top edge, independent of tile size. Requiring the
 * bottom edge to stay within the canvas (1080px) at the 40px floor caps
 * ROWS at 14 (587px available ÷ 40px). Columns have no HUD margin to
 * subtract (nothing else occupies the grid's horizontal band) — the
 * canvas's full 1280px width ÷ 40px caps COLS at 32. These are a
 * first-pass balance value (same status as `STARTING_GOLD`) — the 40px
 * floor, not the shrink-to-fit mechanism itself, is what's tunable.
 */
export const MIN_MAP_COLS = 6;
export const MAX_MAP_COLS = 32;
export const MIN_MAP_ROWS = 6;
export const MAX_MAP_ROWS = 14;
/** Matches `CharacterCreationScene`'s own `MAX_PARTY_SIZE`. */
export const MAX_HERO_STARTS = 4;

export type MarkerRole = "spawn" | "exit" | "hero-start" | "enemy-start" | "shop" | "treasure";

export type PaletteSelection =
  | { kind: "terrain"; tileType: TileType }
  | { kind: "marker"; role: MarkerRole };

/** A blank, all-floor map of the given size — the builder's starting point. */
export function createBlankDraft(id: string, name: string, cols: number, rows: number): ParsedMap {
  const tiles: TileType[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "floor" as TileType),
  );
  return {
    id,
    name,
    cols,
    rows,
    tiles,
    spawns: [],
    exits: [],
    heroStarts: [],
    enemyStarts: [],
    shops: [],
    treasures: [],
  };
}

function isInBounds(draft: ParsedMap, pos: GridPosition): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < draft.cols && pos.y < draft.rows;
}

function withoutPos(list: GridPosition[], pos: GridPosition): GridPosition[] {
  return list.filter((p) => !(p.x === pos.x && p.y === pos.y));
}

/**
 * Paint one tile. Pure — returns a new `ParsedMap`, or the SAME reference if
 * `pos` is out of bounds (nothing to do). A "marker" selection forces the
 * underlying tile to "floor" (matching what `parseMapRows` already assumes
 * about the legend — a spawn/exit/etc. is always floor-like) and removes
 * `pos` from every OTHER role array first, so a tile can never carry two
 * roles at once. A "terrain" selection sets the tile type and clears `pos`
 * from every role array (a wall/cliff/water/fire/acid tile cannot also be a
 * spawn/exit/hero-start/etc.).
 */
export function paintTile(draft: ParsedMap, pos: GridPosition, selection: PaletteSelection): ParsedMap {
  if (!isInBounds(draft, pos)) return draft;

  const tiles = draft.tiles.map((row) => [...row]);
  const spawns = withoutPos(draft.spawns, pos);
  const exits = withoutPos(draft.exits, pos);
  const heroStarts = withoutPos(draft.heroStarts, pos);
  const enemyStarts = withoutPos(draft.enemyStarts, pos);
  const shops = withoutPos(draft.shops, pos);
  const treasures = withoutPos(draft.treasures, pos);

  if (selection.kind === "terrain") {
    tiles[pos.y][pos.x] = selection.tileType;
    return { ...draft, tiles, spawns, exits, heroStarts, enemyStarts, shops, treasures };
  }

  tiles[pos.y][pos.x] = "floor";
  const next: ParsedMap = { ...draft, tiles, spawns, exits, heroStarts, enemyStarts, shops, treasures };
  const marker: GridPosition = { x: pos.x, y: pos.y };
  switch (selection.role) {
    case "spawn":
      next.spawns = [...spawns, marker];
      break;
    case "exit":
      next.exits = [...exits, marker];
      break;
    case "hero-start":
      next.heroStarts = [...heroStarts, marker];
      break;
    case "enemy-start":
      next.enemyStarts = [...enemyStarts, marker];
      break;
    case "shop":
      next.shops = [...shops, marker];
      break;
    case "treasure":
      next.treasures = [...treasures, marker];
      break;
  }
  return next;
}

/**
 * D-154: a real, player-typed map name (replacing the old fixed 8-name
 * cycle pool) needs its own validation independent of the DOM `<input>`'s
 * `maxlength` attribute, which a caller bypassing the UI (a future import,
 * a test) wouldn't be bound by.
 */
export function isValidMapName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 40;
}

export interface MapValidationResult {
  ok: boolean;
  /** Every failing reason at once (not just the first), for a full checklist in the UI. */
  reasons: string[];
}

/**
 * Whether a drafted map is complete AND playable. Checks dimensions, that
 * every row's actual width matches `cols` (defensive — `paintTile`/
 * `createBlankDraft` make this impossible by construction, but a map coming
 * from elsewhere, e.g. a future import, might not), spawn/exit/hero-start
 * counts, and — the one genuinely new RULE here — that every spawn has a
 * route to some exit. That route check reuses `PathfindingSystem.hasRoute`,
 * the exact same call `BuildSystem.routesRemainWith` already makes for wall
 * placement, rather than reimplementing routing.
 */
export function validateDraft(draft: ParsedMap): MapValidationResult {
  const reasons: string[] = [];

  if (draft.cols < MIN_MAP_COLS || draft.cols > MAX_MAP_COLS) {
    reasons.push(`Width must be between ${MIN_MAP_COLS} and ${MAX_MAP_COLS} tiles (currently ${draft.cols}).`);
  }
  if (draft.rows < MIN_MAP_ROWS || draft.rows > MAX_MAP_ROWS) {
    reasons.push(`Height must be between ${MIN_MAP_ROWS} and ${MAX_MAP_ROWS} tiles (currently ${draft.rows}).`);
  }
  const rowsWellFormed = draft.tiles.length === draft.rows && draft.tiles.every((row) => row.length === draft.cols);
  if (!rowsWellFormed) {
    reasons.push("Every row must have the same width as the map.");
  }
  if (draft.spawns.length < 1) reasons.push("Add at least one spawn tile.");
  if (draft.exits.length < 1) reasons.push("Add at least one exit tile.");
  if (draft.heroStarts.length < 1 || draft.heroStarts.length > MAX_HERO_STARTS) {
    reasons.push(`Add between 1 and ${MAX_HERO_STARTS} hero-start tiles (currently ${draft.heroStarts.length}).`);
  }

  if (rowsWellFormed && draft.spawns.length > 0 && draft.exits.length > 0) {
    const map = new GameMap(draft);
    const pathfinding = new PathfindingSystem(map);
    const everySpawnReachesAnExit = draft.spawns.every((spawn) =>
      pathfinding.hasRoute({ start: spawn, goals: draft.exits }),
    );
    if (!everySpawnReachesAnExit) {
      reasons.push("Every spawn must have a clear route to an exit — check for a sealed-off area.");
    }
  }

  return { ok: reasons.length === 0, reasons };
}
