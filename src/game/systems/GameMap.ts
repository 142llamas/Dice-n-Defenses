import type { GridPosition } from "./GridSystem";
import { GridSystem } from "./GridSystem";
import type { ParsedMap, TileType } from "../data/testMap";
import { terrainEffectFor, type TerrainEffect } from "../data/terrain";

/**
 * GameMap: pure logic over a ParsedMap. No Phaser dependency, fully testable.
 *
 * This answers the questions the scene needs without knowing anything about
 * rendering: what type is this tile, is it selectable, what role does it play.
 * It is the natural home for Phase 3's pathfinding queries later.
 *
 * Phase 11.7 (D-071): "cliff" joins "blocked" as a ground-impassable tile
 * (flying units already cross both for free via PathfindingSystem's
 * `ignoreWalls`); "water"/"fire"/"acid" are all WALKABLE but carry a terrain
 * EFFECT (see `terrainEffectAt`) — that mechanical data lives entirely in
 * `data/terrain.ts` so this class stays a pure query layer.
 */

export type TileRole =
  | "spawn"
  | "exit"
  | "hero-start"
  | "enemy-start"
  | "shop"
  | "treasure"
  | null;

export class GameMap {
  readonly data: ParsedMap;

  constructor(data: ParsedMap) {
    this.data = data;
  }

  get cols(): number {
    return this.data.cols;
  }

  get rows(): number {
    return this.data.rows;
  }

  isInBounds(pos: GridPosition): boolean {
    return (
      Number.isInteger(pos.x) &&
      Number.isInteger(pos.y) &&
      pos.x >= 0 &&
      pos.y >= 0 &&
      pos.x < this.cols &&
      pos.y < this.rows
    );
  }

  /** The tile type at a position, or null if the position is off the map. */
  getTileType(pos: GridPosition): TileType | null {
    if (!this.isInBounds(pos)) return null;
    return this.data.tiles[pos.y][pos.x];
  }

  isBlocked(pos: GridPosition): boolean {
    return this.getTileType(pos) === "blocked";
  }

  /**
   * A tile a ground unit could stand on: in bounds and not a hard blocker.
   * Written as "walkable unless blocked or cliff" (rather than an allow-list
   * of every walkable type) so a future terrain addition needs no edit here.
   */
  isWalkable(pos: GridPosition): boolean {
    const type = this.getTileType(pos);
    return type !== null && type !== "blocked" && type !== "cliff";
  }

  /**
   * Whether a tile can be selected by a click.
   * Phase 1 acceptance criterion: invalid tiles cannot be selected.
   * "Invalid" = off the map OR a blocked wall tile.
   */
  isSelectable(pos: GridPosition): boolean {
    return this.isWalkable(pos);
  }

  /** The special role of a tile, if any (spawn/exit/hero-start/enemy-start/shop/treasure). */
  roleAt(pos: GridPosition): TileRole {
    if (this.contains(this.data.spawns, pos)) return "spawn";
    if (this.contains(this.data.exits, pos)) return "exit";
    if (this.contains(this.data.heroStarts, pos)) return "hero-start";
    if (this.contains(this.data.enemyStarts, pos)) return "enemy-start";
    if (this.contains(this.data.shops, pos)) return "shop";
    if (this.contains(this.data.treasures, pos)) return "treasure";
    return null;
  }

  /**
   * The mechanical terrain effect at a tile (Phase 11.7, D-071), or null for
   * a tile with none (floor, blocked, cliff, shop, treasure, or off-map).
   * The one place terrain mechanics live — callers (BattleScene) just read
   * this and don't know terrain rules themselves.
   */
  terrainEffectAt(pos: GridPosition): TerrainEffect | null {
    const type = this.getTileType(pos);
    if (type === null) return null;
    return terrainEffectFor(type);
  }

  /** A short human-readable description of a tile, for the debug overlay. */
  describe(pos: GridPosition): string {
    const type = this.getTileType(pos);
    if (type === null) return "off-map";
    const role = this.roleAt(pos);
    const roleText = role ? ` (${role})` : "";
    switch (type) {
      case "blocked":
        return "wall — blocked";
      case "cliff":
        return "cliff — blocked (ground)";
      case "water":
      case "fire":
      case "acid":
        return `${type}${roleText}`;
      default:
        return `floor${roleText}`;
    }
  }

  private contains(list: GridPosition[], pos: GridPosition): boolean {
    return list.some((p) => GridSystem.equals(p, pos));
  }
}
