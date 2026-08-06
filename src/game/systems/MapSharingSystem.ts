import type { ParsedMap } from "../data/testMap";
import { encodeMapRows, parseMapRows } from "../data/testMap";

/**
 * MapSharingSystem — Phase 11.10 (D-085): the pure transform layer between a
 * built `ParsedMap` and `SharedMapRecord`, the shape actually stored in
 * Firestore's public `sharedMaps` collection (see `cloud/MapSharingSync.ts`
 * and `firestore.rules`).
 *
 * `tileRows` (the row-string authoring format, not `ParsedMap`'s nested
 * `tiles: TileType[][]`) is the actual stored map data — a flat array of
 * strings is what keeps `firestore.rules`' shape validation tractable
 * (simple `.size()` string-length checks; rules have no loop construct to
 * validate a 2D array cell-by-cell). `fromSharedMapRecord` routes through
 * the existing, already-hardened `parseMapRows` — that's the real
 * gatekeeper against a malformed character on load, exactly as it already
 * is for the hardcoded maps.
 */
export const MAX_PUBLISHED_MAPS_PER_AUTHOR = 5;

export interface SharedMapRecord {
  /** Also the Firestore document id. */
  id: string;
  name: string;
  authorUid: string;
  /** null for an author who hasn't linked a Google account (still allowed to publish anonymously). */
  authorDisplayName: string | null;
  createdAt: number;
  updatedAt: number;
  /** Redundant with `tileRows.length`, kept for a cheap Firestore-rule check (same pattern as SaveSlot's `partySize`). */
  cols: number;
  rows: number;
  tileRows: string[];
}

export function hasReachedPublishLimit(publishedCount: number): boolean {
  return publishedCount >= MAX_PUBLISHED_MAPS_PER_AUTHOR;
}

export function toSharedMapRecord(
  draft: ParsedMap,
  id: string,
  author: { uid: string; displayName: string | null },
  timestamps: { createdAt: number; updatedAt: number },
): SharedMapRecord {
  return {
    id,
    name: draft.name,
    authorUid: author.uid,
    authorDisplayName: author.displayName,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    cols: draft.cols,
    rows: draft.rows,
    tileRows: encodeMapRows(draft),
  };
}

export function fromSharedMapRecord(record: SharedMapRecord): ParsedMap {
  return parseMapRows(record.id, record.name, record.tileRows);
}
