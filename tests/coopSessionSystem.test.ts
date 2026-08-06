import { describe, it, expect } from "vitest";
import {
  COOP_PROTOCOL_VERSION,
  MAX_COOP_PARTICIPANTS,
  SESSION_CODE_LENGTH,
  generateSessionCode,
  createSessionRecord,
  checkJoinSession,
  withParticipantAdded,
  isSessionFull,
  isCoopBattleActive,
  startCoopBattle,
  canActOnHero,
  type CoopParticipant,
  type CoopSessionRecord,
} from "../src/game/systems/CoopSessionSystem";

/**
 * Phase 12.2 (D-102): the pure lobby rules — session-code generation, and
 * whether a join should succeed — that `cloud/CoopSessionSync.ts` and
 * `CoopLobbyScene` build on. No Firebase, no Phaser.
 *
 * Phase 12.3 (D-103) adds the turn-lock ownership rules — `startCoopBattle`/
 * `canActOnHero`/`isCoopBattleActive` — that `BattleScene` gates hero
 * selection with.
 */

function host(uid = "host-1", joinedAt = 1000): CoopParticipant {
  return { uid, displayName: "Host Player", joinedAt };
}

function guest(uid = "guest-1", joinedAt = 2000): CoopParticipant {
  return { uid, displayName: "Guest Player", joinedAt };
}

describe("generateSessionCode", () => {
  it("produces a code of the expected length using only unambiguous characters", () => {
    const code = generateSessionCode(() => 0.5);
    expect(code).toHaveLength(SESSION_CODE_LENGTH);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("is deterministic for a fixed random source, and varies with a different one", () => {
    const a = generateSessionCode(() => 0);
    const b = generateSessionCode(() => 0);
    const c = generateSessionCode(() => 0.99);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("createSessionRecord", () => {
  it("starts with exactly the host as its sole participant", () => {
    const record = createSessionRecord("ABCDEF", host());
    expect(record.id).toBe("ABCDEF");
    expect(record.hostUid).toBe("host-1");
    expect(record.participants).toEqual([host()]);
    expect(record.protocolVersion).toBe(COOP_PROTOCOL_VERSION);
    expect(record.createdAt).toBe(1000);
    expect(record.updatedAt).toBe(1000);
    expect(isSessionFull(record)).toBe(false);
    expect(record.status).toBe("lobby");
    expect(record.heroOwners).toEqual({});
    expect(isCoopBattleActive(record)).toBe(false);
  });
});

describe("startCoopBattle / canActOnHero", () => {
  function fullSession(): CoopSessionRecord {
    return withParticipantAdded(createSessionRecord("ABCDEF", host()), guest());
  }

  it("alternates hero ownership across participants in party-slot order", () => {
    const started = startCoopBattle(fullSession(), ["hero-ash", "hero-wren", "hero-bram", "hero-mira"], 3000);
    expect(started.status).toBe("battle");
    expect(started.updatedAt).toBe(3000);
    expect(started.heroOwners).toEqual({
      "hero-ash": "host-1",
      "hero-wren": "guest-1",
      "hero-bram": "host-1",
      "hero-mira": "guest-1",
    });
    expect(isCoopBattleActive(started)).toBe(true);
  });

  it("lets only a hero's owner act on it", () => {
    const started = startCoopBattle(fullSession(), ["hero-ash", "hero-wren"], 3000);
    expect(canActOnHero(started.heroOwners, "hero-ash", "host-1")).toBe(true);
    expect(canActOnHero(started.heroOwners, "hero-ash", "guest-1")).toBe(false);
    expect(canActOnHero(started.heroOwners, "hero-wren", "guest-1")).toBe(true);
    expect(canActOnHero(started.heroOwners, "hero-wren", "host-1")).toBe(false);
  });

  it("a session not yet started has no hero owners, so no one may act", () => {
    const session = fullSession();
    expect(canActOnHero(session.heroOwners, "hero-ash", "host-1")).toBe(false);
  });
});

describe("checkJoinSession / withParticipantAdded", () => {
  function freshSession(): CoopSessionRecord {
    return createSessionRecord("ABCDEF", host());
  }

  it("allows a new participant to join an open session", () => {
    const session = freshSession();
    expect(checkJoinSession(session, "guest-1")).toBe("would-join");
    const joined = withParticipantAdded(session, guest());
    expect(joined.participants).toEqual([host(), guest()]);
    expect(joined.updatedAt).toBe(2000);
    expect(isSessionFull(joined)).toBe(true);
  });

  it("treats rejoining your own already-in-progress session as OK, not an error", () => {
    const session = freshSession();
    expect(checkJoinSession(session, "host-1")).toBe("already-in-session");
  });

  it("rejects a third participant once the session is full", () => {
    const full = withParticipantAdded(freshSession(), guest());
    expect(isSessionFull(full)).toBe(true);
    expect(checkJoinSession(full, "third-player")).toBe("full");
  });

  it("rejects a join against a session from a different protocol version", () => {
    const session = { ...freshSession(), protocolVersion: COOP_PROTOCOL_VERSION + 1 };
    expect(checkJoinSession(session, "guest-1")).toBe("version-mismatch");
  });

  it("MAX_COOP_PARTICIPANTS matches the number of joins isSessionFull actually requires", () => {
    let session = freshSession();
    for (let i = 0; i < MAX_COOP_PARTICIPANTS - 1; i++) {
      expect(isSessionFull(session)).toBe(false);
      session = withParticipantAdded(session, guest(`guest-${i}`, 2000 + i));
    }
    expect(isSessionFull(session)).toBe(true);
  });
});
