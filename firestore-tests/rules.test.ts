import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

/**
 * firestore.rules coverage (Phase 10, D-084) — runs ONLY against the local
 * Firebase emulator (`npm run test:rules`), never real Firestore. Asserts
 * the two things the Source of Truth's Phase 10 acceptance criteria call
 * out by name: "users cannot access another user's private saves," and
 * every write is shape/size-validated (the concrete budget safeguard).
 */

const PROJECT_ID = "fantasy-td-rules-test";

function validSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: "slot-1",
    name: "Test Party",
    createdAt: 1,
    updatedAt: 1,
    partySize: 1,
    difficultyId: "normal",
    party: [
      {
        id: "party-1",
        name: "Kael",
        raceId: "human",
        classId: "fighter",
        level: 1,
        abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
        abilityId: "cleave",
        controlledBy: "human",
      },
    ],
    ...overrides,
  };
}

/**
 * Phase 11.10 (D-085): a valid `sharedMaps/{mapId}` document, matching
 * `MapSharingSystem.SharedMapRecord`'s shape (`tileRows`, not a nested
 * `tiles[][]` — see `firestore.rules`' own comment on why).
 */
function validSharedMap(overrides: Record<string, unknown> = {}) {
  return {
    id: "shared-map-1",
    name: "Test Map",
    authorUid: "alice",
    authorDisplayName: "Alice",
    createdAt: 1,
    updatedAt: 1,
    cols: 6,
    rows: 6,
    tileRows: ["S.....", "......", "......", "......", "......", ".....X"],
    ...overrides,
  };
}

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("firestore.rules — users/{uid}/saves/{slotId}", () => {
  it("lets a signed-in user read and write their own save slot", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "users/alice/saves/slot-1");
    await assertSucceeds(setDoc(ref, validSlot()));
    await assertSucceeds(getDoc(ref));
  });

  it("denies a signed-in user reading, writing, or deleting another user's save slot", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "users/alice/saves/slot-1"), validSlot()),
    );
    const bob = testEnv.authenticatedContext("bob");
    const bobReadingAlice = doc(bob.firestore(), "users/alice/saves/slot-1");
    await assertFails(getDoc(bobReadingAlice));
    await assertFails(setDoc(bobReadingAlice, validSlot()));
    await assertFails(deleteDoc(bobReadingAlice));
  });

  it("denies all access when signed out", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "users/alice/saves/slot-1");
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, validSlot()));
  });

  it("rejects a write with an extra, unexpected field", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "users/alice/saves/slot-1");
    await assertFails(setDoc(ref, validSlot({ extraField: "nope" })));
  });

  it("rejects a party larger than MAX_PARTY_SIZE (4)", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "users/alice/saves/slot-1");
    const oneBuild = validSlot().party[0];
    await assertFails(
      setDoc(ref, validSlot({ party: [oneBuild, oneBuild, oneBuild, oneBuild, oneBuild], partySize: 5 })),
    );
  });

  it("rejects an invalid difficultyId", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "users/alice/saves/slot-1");
    await assertFails(setDoc(ref, validSlot({ difficultyId: "impossible" })));
  });

  it("rejects a write where the document's own id field doesn't match its slot id", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "users/alice/saves/slot-1");
    await assertFails(setDoc(ref, validSlot({ id: "different-id" })));
  });

  it("rejects a build with an unexpected extra field", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "users/alice/saves/slot-1");
    const badBuild = { ...validSlot().party[0], sneakyField: true };
    await assertFails(setDoc(ref, validSlot({ party: [badBuild] })));
  });
});

describe("firestore.rules — sharedMaps/{mapId}", () => {
  it("lets a signed-in user (including an anonymous session) publish their own map", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertSucceeds(setDoc(ref, validSharedMap()));

    const anon = testEnv.authenticatedContext("anon-uid");
    const anonRef = doc(anon.firestore(), "sharedMaps/shared-map-2");
    await assertSucceeds(
      setDoc(anonRef, validSharedMap({ id: "shared-map-2", authorUid: "anon-uid", authorDisplayName: null })),
    );
  });

  it("lets anyone — signed out or a different signed-in user — read a published map", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "sharedMaps/shared-map-1"), validSharedMap()),
    );
    const anon = testEnv.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(anon.firestore(), "sharedMaps/shared-map-1")));
    const bob = testEnv.authenticatedContext("bob");
    await assertSucceeds(getDoc(doc(bob.firestore(), "sharedMaps/shared-map-1")));
  });

  it("denies publishing while signed out", async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(setDoc(doc(anon.firestore(), "sharedMaps/shared-map-1"), validSharedMap()));
  });

  it("denies creating a map whose authorUid doesn't match the caller", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertFails(setDoc(ref, validSharedMap({ authorUid: "someone-else" })));
  });

  it("denies another user updating or deleting someone else's map, but lets the author", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "sharedMaps/shared-map-1"), validSharedMap()),
    );
    const bob = testEnv.authenticatedContext("bob");
    const bobRef = doc(bob.firestore(), "sharedMaps/shared-map-1");
    await assertFails(setDoc(bobRef, validSharedMap({ name: "Hijacked" })));
    await assertFails(deleteDoc(bobRef));

    const alice = testEnv.authenticatedContext("alice");
    const aliceRef = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertSucceeds(setDoc(aliceRef, validSharedMap({ name: "Renamed by Author" })));
    await assertSucceeds(deleteDoc(aliceRef));
  });

  it("denies an update that changes authorUid to a different value", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "sharedMaps/shared-map-1"), validSharedMap()),
    );
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertFails(setDoc(ref, validSharedMap({ authorUid: "alice-2" })));
  });

  it("rejects a write with an extra, unexpected field", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertFails(setDoc(ref, validSharedMap({ extraField: "nope" })));
  });

  it("rejects a write where the document's own id field doesn't match its doc id", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertFails(setDoc(ref, validSharedMap({ id: "different-id" })));
  });

  it("rejects tileRows.length not matching rows", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertFails(setDoc(ref, validSharedMap({ rows: 5 })));
  });

  it("rejects a row string whose length doesn't match cols", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    const badRows = ["S.....", "......", "......", "......", "......", ".....X."]; // last row is 7 chars, not 6
    await assertFails(setDoc(ref, validSharedMap({ tileRows: badRows })));
  });

  it("rejects cols/rows outside the allowed bounds", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertFails(setDoc(ref, validSharedMap({ cols: 5 })));
    await assertFails(setDoc(ref, validSharedMap({ cols: 21 })));
    await assertFails(setDoc(ref, validSharedMap({ rows: 5 })));
    await assertFails(setDoc(ref, validSharedMap({ rows: 10 })));
  });

  it("rejects a non-string or oversized authorDisplayName", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "sharedMaps/shared-map-1");
    await assertFails(setDoc(ref, validSharedMap({ authorDisplayName: 12345 })));
    await assertFails(setDoc(ref, validSharedMap({ authorDisplayName: "x".repeat(101) })));
  });
});

/**
 * Phase 12.2 (D-102)/12.3 (D-103): a valid `coopSessions/{sessionId}`
 * document, matching `CoopSessionSystem.CoopSessionRecord`'s shape.
 */
function validCoopSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "ABCDEF",
    protocolVersion: 1,
    hostUid: "alice",
    participants: [{ uid: "alice", displayName: "Alice", joinedAt: 1 }],
    createdAt: 1,
    updatedAt: 1,
    status: "lobby",
    heroOwners: {},
    ...overrides,
  };
}

describe("firestore.rules — coopSessions/{sessionId}", () => {
  it("lets a signed-in user create a session naming themselves as host", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertSucceeds(setDoc(ref, validCoopSession()));
  });

  it("denies creating a session naming someone else as host", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertFails(setDoc(ref, validCoopSession({ hostUid: "bob", participants: [{ uid: "bob", displayName: "Bob", joinedAt: 1 }] })));
  });

  it("denies creating or reading a session while signed out", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "coopSessions/ABCDEF");
    await assertFails(setDoc(ref, validCoopSession()));
    await assertFails(getDoc(ref));
  });

  it("lets ANY signed-in user read a session by its exact code (invite-only via the code itself, not a read restriction)", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "coopSessions/ABCDEF"), validCoopSession()),
    );
    const bob = testEnv.authenticatedContext("bob");
    await assertSucceeds(getDoc(doc(bob.firestore(), "coopSessions/ABCDEF")));
  });

  it("lets a second player join by appending themselves", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "coopSessions/ABCDEF"), validCoopSession()),
    );
    const bob = testEnv.authenticatedContext("bob");
    const ref = doc(bob.firestore(), "coopSessions/ABCDEF");
    await assertSucceeds(
      setDoc(ref, validCoopSession({
        participants: [
          { uid: "alice", displayName: "Alice", joinedAt: 1 },
          { uid: "bob", displayName: "Bob", joinedAt: 2 },
        ],
        updatedAt: 2,
      })),
    );
  });

  it("denies a join once the session already has 2 participants", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(
        doc(ctx.firestore(), "coopSessions/ABCDEF"),
        validCoopSession({
          participants: [
            { uid: "alice", displayName: "Alice", joinedAt: 1 },
            { uid: "bob", displayName: "Bob", joinedAt: 2 },
          ],
        }),
      ),
    );
    const carol = testEnv.authenticatedContext("carol");
    const ref = doc(carol.firestore(), "coopSessions/ABCDEF");
    await assertFails(
      setDoc(ref, validCoopSession({
        participants: [
          { uid: "alice", displayName: "Alice", joinedAt: 1 },
          { uid: "bob", displayName: "Bob", joinedAt: 2 },
          { uid: "carol", displayName: "Carol", joinedAt: 3 },
        ],
        updatedAt: 3,
      })),
    );
  });

  it("denies a 'join' that rewrites the host's own existing participant entry instead of appending", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "coopSessions/ABCDEF"), validCoopSession()),
    );
    const bob = testEnv.authenticatedContext("bob");
    const ref = doc(bob.firestore(), "coopSessions/ABCDEF");
    await assertFails(
      setDoc(ref, validCoopSession({
        participants: [{ uid: "bob", displayName: "Bob", joinedAt: 2 }],
        updatedAt: 2,
      })),
    );
  });

  it("denies an update that changes hostUid or protocolVersion", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "coopSessions/ABCDEF"), validCoopSession()),
    );
    const bob = testEnv.authenticatedContext("bob");
    const ref = doc(bob.firestore(), "coopSessions/ABCDEF");
    await assertFails(setDoc(ref, validCoopSession({ hostUid: "bob" })));
    await assertFails(setDoc(ref, validCoopSession({ protocolVersion: 2 })));
  });

  it("lets only the host delete a session", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "coopSessions/ABCDEF"), validCoopSession()),
    );
    const bob = testEnv.authenticatedContext("bob");
    await assertFails(deleteDoc(doc(bob.firestore(), "coopSessions/ABCDEF")));
    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(deleteDoc(doc(alice.firestore(), "coopSessions/ABCDEF")));
  });

  it("rejects a write with an extra, unexpected field", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertFails(setDoc(ref, validCoopSession({ extraField: "nope" })));
  });

  it("rejects a session id that doesn't match its own document id", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertFails(setDoc(ref, validCoopSession({ id: "ZZZZZZ" })));
  });

  // Phase 12.3 (D-103): the host starting the battle — a one-way
  // status "lobby" -> "battle" flip that also assigns heroOwners.
  it("lets the host start the battle, assigning hero ownership", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(
        doc(ctx.firestore(), "coopSessions/ABCDEF"),
        validCoopSession({
          participants: [
            { uid: "alice", displayName: "Alice", joinedAt: 1 },
            { uid: "bob", displayName: "Bob", joinedAt: 2 },
          ],
        }),
      ),
    );
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertSucceeds(
      setDoc(ref, validCoopSession({
        participants: [
          { uid: "alice", displayName: "Alice", joinedAt: 1 },
          { uid: "bob", displayName: "Bob", joinedAt: 2 },
        ],
        status: "battle",
        heroOwners: { "hero-ash": "alice", "hero-wren": "bob" },
        updatedAt: 3,
      })),
    );
  });

  it("denies a non-host trying to start the battle", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(
        doc(ctx.firestore(), "coopSessions/ABCDEF"),
        validCoopSession({
          participants: [
            { uid: "alice", displayName: "Alice", joinedAt: 1 },
            { uid: "bob", displayName: "Bob", joinedAt: 2 },
          ],
        }),
      ),
    );
    const bob = testEnv.authenticatedContext("bob");
    const ref = doc(bob.firestore(), "coopSessions/ABCDEF");
    await assertFails(
      setDoc(ref, validCoopSession({
        participants: [
          { uid: "alice", displayName: "Alice", joinedAt: 1 },
          { uid: "bob", displayName: "Bob", joinedAt: 2 },
        ],
        status: "battle",
        heroOwners: { "hero-ash": "bob" },
        updatedAt: 3,
      })),
    );
  });

  it("denies starting a battle with no hero owners assigned", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "coopSessions/ABCDEF"), validCoopSession()),
    );
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertFails(
      setDoc(ref, validCoopSession({ status: "battle", heroOwners: {}, updatedAt: 3 })),
    );
  });

  it("denies a 'battle' update that also changes the participant list", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(
        doc(ctx.firestore(), "coopSessions/ABCDEF"),
        validCoopSession({
          participants: [
            { uid: "alice", displayName: "Alice", joinedAt: 1 },
            { uid: "bob", displayName: "Bob", joinedAt: 2 },
          ],
        }),
      ),
    );
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertFails(
      setDoc(ref, validCoopSession({
        participants: [{ uid: "alice", displayName: "Alice", joinedAt: 1 }],
        status: "battle",
        heroOwners: { "hero-ash": "alice" },
        updatedAt: 3,
      })),
    );
  });

  it("denies reverting status from 'battle' back to 'lobby'", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      setDoc(
        doc(ctx.firestore(), "coopSessions/ABCDEF"),
        validCoopSession({ status: "battle", heroOwners: { "hero-ash": "alice" } }),
      ),
    );
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertFails(
      setDoc(ref, validCoopSession({ status: "lobby", heroOwners: {}, updatedAt: 3 })),
    );
  });

  it("rejects an invalid status value", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "coopSessions/ABCDEF");
    await assertFails(setDoc(ref, validCoopSession({ status: "in-progress" })));
  });
});
