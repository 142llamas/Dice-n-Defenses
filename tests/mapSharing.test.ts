import { describe, expect, it } from "vitest";
import {
  MAX_PUBLISHED_MAPS_PER_AUTHOR,
  fromSharedMapRecord,
  hasReachedPublishLimit,
  toSharedMapRecord,
} from "../src/game/systems/MapSharingSystem";
import { addSpawnGroup, addWave, createBlankDraft, paintTile, updateSpawnGroup } from "../src/game/systems/MapBuilderSystem";

describe("MapSharingSystem", () => {
  describe("hasReachedPublishLimit", () => {
    it("is false below the cap and true at/above it", () => {
      expect(hasReachedPublishLimit(MAX_PUBLISHED_MAPS_PER_AUTHOR - 1)).toBe(false);
      expect(hasReachedPublishLimit(MAX_PUBLISHED_MAPS_PER_AUTHOR)).toBe(true);
      expect(hasReachedPublishLimit(MAX_PUBLISHED_MAPS_PER_AUTHOR + 1)).toBe(true);
    });
  });

  describe("toSharedMapRecord / fromSharedMapRecord", () => {
    it("round-trips a drafted map through the Firestore record shape", () => {
      let draft = createBlankDraft("draft-1", "Winding Pass", 8, 6);
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "spawn" });
      draft = paintTile(draft, { x: 7, y: 5 }, { kind: "marker", role: "exit" });
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "hero-start" });
      draft = paintTile(draft, { x: 3, y: 3 }, { kind: "terrain", tileType: "fire" });

      const record = toSharedMapRecord(
        draft,
        "sharedMap-alice-123",
        { uid: "alice", displayName: "Alice" },
        { createdAt: 111, updatedAt: 222 },
      );

      expect(record.id).toBe("sharedMap-alice-123");
      expect(record.name).toBe("Winding Pass");
      expect(record.authorUid).toBe("alice");
      expect(record.authorDisplayName).toBe("Alice");
      expect(record.cols).toBe(8);
      expect(record.rows).toBe(6);
      expect(record.tileRows).toHaveLength(6);

      const restored = fromSharedMapRecord(record);
      expect(restored).toEqual({ ...draft, id: record.id, name: record.name, customWaves: [] });
    });

    it("supports a null authorDisplayName (an anonymous author)", () => {
      const draft = createBlankDraft("draft-2", "Anon Map", 6, 6);
      const record = toSharedMapRecord(
        draft,
        "sharedMap-anon-1",
        { uid: "anon-uid", displayName: null },
        { createdAt: 1, updatedAt: 1 },
      );
      expect(record.authorDisplayName).toBeNull();
    });

    it("round-trips author-designed customWaves", () => {
      let draft = createBlankDraft("draft-3", "Wave Map", 8, 6);
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "spawn" });
      draft = paintTile(draft, { x: 7, y: 5 }, { kind: "marker", role: "exit" });
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "hero-start" });
      draft = addWave(draft);
      draft = addSpawnGroup(draft, 0, "grunt");

      const record = toSharedMapRecord(
        draft,
        "sharedMap-wave-1",
        { uid: "bob", displayName: "Bob" },
        { createdAt: 1, updatedAt: 1 },
      );
      expect(record.customWaves).toEqual(draft.customWaves);

      const restored = fromSharedMapRecord(record);
      expect(restored.customWaves).toEqual(draft.customWaves);
    });

    it("drops a spawn group with an unknown enemy id or an out-of-range spawnIndex on load", () => {
      let draft = createBlankDraft("draft-4", "Bad Wave Map", 8, 6);
      draft = paintTile(draft, { x: 0, y: 0 }, { kind: "marker", role: "spawn" });
      draft = paintTile(draft, { x: 7, y: 5 }, { kind: "marker", role: "exit" });
      draft = paintTile(draft, { x: 1, y: 1 }, { kind: "marker", role: "hero-start" });
      draft = addWave(draft);
      draft = addSpawnGroup(draft, 0, "grunt");
      draft = updateSpawnGroup(draft, 0, 0, { spawnIndex: 5 }); // only 1 spawn exists (index 0)
      draft = addWave(draft);
      draft = addSpawnGroup(draft, 1, "not-a-real-enemy-id");

      const record = toSharedMapRecord(
        draft,
        "sharedMap-bad-1",
        { uid: "carol", displayName: "Carol" },
        { createdAt: 1, updatedAt: 1 },
      );
      const restored = fromSharedMapRecord(record);
      // Both waves lose their only spawn group, so both waves are dropped entirely.
      expect(restored.customWaves).toEqual([]);
    });
  });
});
