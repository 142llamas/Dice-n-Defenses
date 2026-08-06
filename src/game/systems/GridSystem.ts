/**
 * GridSystem: pure grid/coordinate logic with NO Phaser dependency.
 *
 * This is the reference example of the Source of Truth architecture rule
 * "Rules independent from visuals: ... should be testable without needing to
 * render sprites." Everything here can be unit-tested in plain Node.
 *
 * Later phases (movement range, pathfinding, building validation) will build
 * on this same pattern: logic here, rendering in the scenes.
 */

export interface GridPosition {
  x: number; // column index, 0-based
  y: number; // row index, 0-based
}

export interface PixelPosition {
  x: number;
  y: number;
}

export class GridSystem {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly originX: number;
  readonly originY: number;

  constructor(
    cols: number,
    rows: number,
    tileSize: number,
    originX: number,
    originY: number,
  ) {
    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;
    this.originX = originX;
    this.originY = originY;
  }

  /** True if the given column/row is a real tile on the board. */
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

  /** Pixel coordinate of the CENTRE of a tile (used to place sprites). */
  tileToWorldCenter(pos: GridPosition): PixelPosition {
    return {
      x: this.originX + pos.x * this.tileSize + this.tileSize / 2,
      y: this.originY + pos.y * this.tileSize + this.tileSize / 2,
    };
  }

  /** Pixel coordinate of the TOP-LEFT corner of a tile (used to draw rects). */
  tileToWorldTopLeft(pos: GridPosition): PixelPosition {
    return {
      x: this.originX + pos.x * this.tileSize,
      y: this.originY + pos.y * this.tileSize,
    };
  }

  /**
   * Convert a pixel position (e.g. a mouse click) to a grid tile.
   * Returns null when the pixel is outside the grid area.
   */
  worldToTile(pixel: PixelPosition): GridPosition | null {
    const col = Math.floor((pixel.x - this.originX) / this.tileSize);
    const row = Math.floor((pixel.y - this.originY) / this.tileSize);
    const pos = { x: col, y: row };
    return this.isInBounds(pos) ? pos : null;
  }

  /** True when two grid positions refer to the same tile. */
  static equals(a: GridPosition, b: GridPosition): boolean {
    return a.x === b.x && a.y === b.y;
  }

  /**
   * Manhattan (grid) distance in tiles between two positions.
   * Used later for movement range and attack range; included now so the
   * coordinate module already has the helper future phases expect.
   */
  static manhattanDistance(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}
