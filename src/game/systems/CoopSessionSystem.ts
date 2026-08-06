/**
 * CoopSessionSystem — Phase 12.2 (D-102): the pure rules for a cooperative
 * multiplayer LOBBY session — who's in it, whether a join should succeed,
 * and the plain-data shape a session document holds. No Phaser, no
 * Firebase — mirrors the existing `MapSharingSystem.ts`/`cloud/
 * MapSharingSync.ts` split (a pure transform/rules layer here, a thin
 * Firestore adapter in `cloud/CoopSessionSync.ts`).
 *
 * Per `PHASE_12_MULTIPLAYER_FEASIBILITY.md`'s own §4/§8: sessions are
 * INVITE-ONLY via a short, human-shareable code (never a browsable public
 * list — that would be the "public matchmaking" the Phase 12 boundary
 * explicitly excludes), and every session records a `protocolVersion` so a
 * client on a different build refuses to join rather than silently
 * diverging mid-battle.
 *
 * Scope (12.2, "local-only stub" per the design doc's roadmap): just the
 * lobby — who has joined, and the code/version bookkeeping. No battle
 * state, no turn ownership, no hero assignment yet — those are 12.3's job,
 * once `BattleScene` itself is involved.
 *
 * Phase 12.3 (D-103): adds `status`/`heroOwners` and `startCoopBattle`/
 * `canActOnHero` — the ownership half of "turn lock" (§5/§7 of the design
 * doc). Deliberately narrower than the design doc's full sketch: no
 * `turnQueue`/`battleState`/`lastActionSeq` yet, because those exist to
 * support live result-broadcast sync between two clients' boards, and that
 * sync is EXPLICITLY DEFERRED this sub-phase (no existing scaffolding to
 * reconcile dynamically-spawned enemy/structure visuals from a restored
 * snapshot, and no way to verify it without a browser two-tab pass — see
 * `PHASE_HANDOFF.md`). What ships here: a hero-ownership assignment made
 * once when the host starts the battle, and the rule for whether a given
 * uid may act on a given hero. `BattleScene` uses this to gate hero
 * selection (you can't click a hero you don't own), but the two clients'
 * boards do NOT yet stay in sync — that's the next sub-phase's job.
 */

export const COOP_PROTOCOL_VERSION = 1;

/** Two players for this phase's scope, matching the Source of Truth's MVP party-size default (see D-100's design doc). */
export const MAX_COOP_PARTICIPANTS = 2;

export const SESSION_CODE_LENGTH = 6;

/** Excludes visually confusable characters (0/O, 1/I) so a spoken or hand-typed code is less error-prone. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export interface CoopParticipant {
  uid: string;
  /** null for an anonymous session or a participant who hasn't linked Google. */
  displayName: string | null;
  joinedAt: number;
}

/** Phase 12.3 (D-103): "lobby" until the host starts the battle; "battle" from then on (one-way, never reverts). */
export type CoopSessionStatus = "lobby" | "battle";

export interface CoopSessionRecord {
  /** Also the Firestore document id, and the code players type/paste to join. */
  id: string;
  protocolVersion: number;
  hostUid: string;
  /** The host is always participants[0]. Capped at `MAX_COOP_PARTICIPANTS`. */
  participants: CoopParticipant[];
  createdAt: number;
  updatedAt: number;
  status: CoopSessionStatus;
  /** Empty in the lobby. Populated once, by `startCoopBattle`, mapping every hero id in the party to the uid that controls it. */
  heroOwners: Record<string, string>;
}

/** A random session code. Accepts an injectable random source (defaulting to `Math.random`) so tests can assert exact output. */
export function generateSessionCode(randomFn: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(randomFn() * CODE_ALPHABET.length)];
  }
  return code;
}

/** A freshly created session: just the host, as its sole participant. */
export function createSessionRecord(code: string, host: CoopParticipant): CoopSessionRecord {
  return {
    id: code,
    protocolVersion: COOP_PROTOCOL_VERSION,
    hostUid: host.uid,
    participants: [host],
    createdAt: host.joinedAt,
    updatedAt: host.joinedAt,
    status: "lobby",
    heroOwners: {},
  };
}

export type JoinOutcome =
  | "would-join"
  | "already-in-session"
  | "full"
  | "version-mismatch";

/**
 * Whether `uid` may join `record` right now. Rejoining a session you're
 * already in is explicitly OK (`"already-in-session"`, not an error) — a
 * host or participant re-entering their own code (e.g. after a refresh)
 * should land back in the lobby, not be told the session is full.
 */
export function checkJoinSession(record: CoopSessionRecord, uid: string): JoinOutcome {
  if (record.participants.some((p) => p.uid === uid)) return "already-in-session";
  if (record.protocolVersion !== COOP_PROTOCOL_VERSION) return "version-mismatch";
  if (record.participants.length >= MAX_COOP_PARTICIPANTS) return "full";
  return "would-join";
}

/** Appends `participant` to `record`. Callers should check `checkJoinSession` returns `"would-join"` first. */
export function withParticipantAdded(record: CoopSessionRecord, participant: CoopParticipant): CoopSessionRecord {
  return {
    ...record,
    participants: [...record.participants, participant],
    updatedAt: participant.joinedAt,
  };
}

/** True once every seat (`MAX_COOP_PARTICIPANTS`) is filled — the lobby's "ready to start" signal. */
export function isSessionFull(record: CoopSessionRecord): boolean {
  return record.participants.length >= MAX_COOP_PARTICIPANTS;
}

/** True once the host has started the battle — the signal every participant's client watches to auto-navigate into `BattleScene`. */
export function isCoopBattleActive(record: CoopSessionRecord): boolean {
  return record.status === "battle";
}

/**
 * Phase 12.3 (D-103): the host starts the battle — assigns every hero in
 * `heroIds` (in party-slot order) to a participant, alternating host/guest/
 * host/guest..., and flips `status` to `"battle"`. A flat, untuned first
 * assignment scheme (like every other "first pass" number in this project)
 * rather than the design doc's own per-hero picker UI (§4) — that stays a
 * deferred, explicitly scoped-out follow-up (see this file's header
 * comment). Callers should only call this once `isSessionFull(record)`, but
 * it degrades gracefully (alternates across however many participants exist)
 * if called earlier.
 */
export function startCoopBattle(record: CoopSessionRecord, heroIds: string[], startedAt: number): CoopSessionRecord {
  const heroOwners: Record<string, string> = {};
  heroIds.forEach((heroId, i) => {
    heroOwners[heroId] = record.participants[i % record.participants.length].uid;
  });
  return { ...record, status: "battle", heroOwners, updatedAt: startedAt };
}

/** Whether `uid` is allowed to act on `heroId` right now — the turn-lock check `BattleScene` gates hero selection with. */
export function canActOnHero(heroOwners: Record<string, string>, heroId: string, uid: string): boolean {
  return heroOwners[heroId] === uid;
}
