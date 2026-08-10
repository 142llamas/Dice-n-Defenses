import type { DynamicTerrainEvent, ParsedMap, TileType } from "../data/testMap";

/**
 * DynamicTerrainSystem: pure logic for mid-battle terrain changes (Phase 23,
 * D-114) — a rising tide, a collapsing bridge. Generic and data-driven: a
 * map just lists `DynamicTerrainEvent`s keyed to a wave number (the same
 * number `BattleScene`'s "Wave N / M" banner already shows), so any future
 * map can describe its own without new engine code.
 *
 * Deliberately telegraphed rather than random or instant: every event names
 * the exact wave it fires at, and a warning appears `warnWavesBefore` waves
 * ahead of that — "engaging but not overbearing," the same design bar as
 * everything else in this pass. No Phaser dependency; `BattleScene` calls
 * these at its `betweenWave` transition and handles the actual re-render.
 */
export class DynamicTerrainSystem {
  /** The wave number a warning for `event` should first appear at. */
  static warningStartWave(event: DynamicTerrainEvent): number {
    return event.atWave - (event.warnWavesBefore ?? 1);
  }

  /** Events that fire exactly at `wave`, excluding any index already in `firedIndexes`. */
  static dueEvents(
    events: ReadonlyArray<DynamicTerrainEvent>,
    wave: number,
    firedIndexes: ReadonlySet<number>,
  ): { index: number; event: DynamicTerrainEvent }[] {
    return events
      .map((event, index) => ({ index, event }))
      .filter(({ index, event }) => event.atWave === wave && !firedIndexes.has(index));
  }

  /**
   * Events whose warning window has just opened at `wave` (the exact wave
   * `warningStartWave` names) and that haven't fired yet — used to log a
   * single warning line rather than repeating it every wave in the window.
   */
  static newWarningsAt(
    events: ReadonlyArray<DynamicTerrainEvent>,
    wave: number,
    firedIndexes: ReadonlySet<number>,
  ): { index: number; event: DynamicTerrainEvent }[] {
    return events
      .map((event, index) => ({ index, event }))
      .filter(
        ({ index, event }) =>
          !firedIndexes.has(index) && wave === DynamicTerrainSystem.warningStartWave(event),
      );
  }

  /**
   * Returns a NEW `ParsedMap` with `event`'s positions changed to its
   * `toTileType` — a pure tile-grid transform, matching this project's
   * immutable-data style elsewhere (e.g. `MapBuilderSystem.paintTile`).
   * Positions outside the map's bounds are silently ignored.
   */
  static applyEvent(map: ParsedMap, event: DynamicTerrainEvent): ParsedMap {
    const tiles: TileType[][] = map.tiles.map((row) => [...row]);
    for (const pos of event.positions) {
      if (pos.y >= 0 && pos.y < tiles.length && pos.x >= 0 && pos.x < tiles[pos.y].length) {
        tiles[pos.y][pos.x] = event.toTileType;
      }
    }
    return { ...map, tiles };
  }
}
