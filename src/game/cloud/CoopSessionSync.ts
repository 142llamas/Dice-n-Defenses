import { deleteDoc, doc, getDoc, onSnapshot, runTransaction, updateDoc, type Unsubscribe } from "firebase/firestore";
import {
  checkJoinSession,
  createSessionRecord,
  generateSessionCode,
  startCoopBattle,
  withParticipantAdded,
  type CoopParticipant,
  type CoopSessionRecord,
  type JoinOutcome,
} from "../systems/CoopSessionSystem";
import { firebaseReady, getFirebaseDb } from "./firebaseApp";

/**
 * CoopSessionSync — Phase 12.2 (D-102): a thin Firestore adapter over
 * `CoopSessionSystem`'s pure lobby rules, sitting beside `CloudSaveSync.ts`/
 * `MapSharingSync.ts` as the same deliberate exception to the `systems/`
 * split (real network IO, not a pure game rule — not unit-tested here; its
 * correctness is covered by `firestore-tests/rules.test.ts` against the
 * local emulator instead, same standing JDK 21+ limitation as Phase 10/
 * 11.10 — see KNOWN_ISSUES). Phase 12.3 (D-103) adds `startBattle`, the
 * host-only lobby -> battle transition.
 *
 * One document per session at `coopSessions/{code}` — see `firestore.rules`'
 * `coopSessions` block for the actual security boundary: readable by any
 * signed-in user (this app never lists/browses the collection, so reaching
 * a document at all requires already having its code — the "invite-only,
 * not public matchmaking" boundary lives in what UI exists, not just in
 * rules), writable only by its host (create) or via an append-only join
 * (update).
 *
 * `joinSession` uses a transaction: two players submitting a join at
 * nearly the same moment must not both land as the (single) remaining
 * seat — the transaction's read-then-write happens atomically against
 * Firestore's own server-side conflict detection, so the second submitter
 * sees the already-updated document and correctly gets `"full"` instead of
 * silently overwriting the first.
 */

function sessionDoc(code: string) {
  return doc(getFirebaseDb(), "coopSessions", code);
}

const CREATE_RETRY_ATTEMPTS = 5;

/**
 * Creates a new session with a random code, retrying on the (rare) chance
 * the code is already taken. Returns null if Firebase isn't configured.
 */
export async function createSession(host: CoopParticipant): Promise<CoopSessionRecord | null> {
  if (!firebaseReady) return null;
  for (let attempt = 0; attempt < CREATE_RETRY_ATTEMPTS; attempt++) {
    const code = generateSessionCode();
    const ref = sessionDoc(code);
    const record = createSessionRecord(code, host);
    const created = await runTransaction(getFirebaseDb(), async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists()) return false; // code collision — try another
      tx.set(ref, record);
      return true;
    });
    if (created) return record;
  }
  throw new Error("Could not generate an available session code — please try again.");
}

/** `"joined"` replaces `CoopSessionSystem`'s `"would-join"` here — this is what actually happened, not just what's eligible to happen. `"not-found"` covers a bad code or no Firebase project. */
export type SyncJoinOutcome = Exclude<JoinOutcome, "would-join"> | "joined" | "not-found";

export interface JoinResult {
  outcome: SyncJoinOutcome;
  record: CoopSessionRecord | null;
}

/** Joins an existing session by code. `{ outcome: "not-found", record: null }` if Firebase isn't configured or the code doesn't exist. */
export async function joinSession(code: string, participant: CoopParticipant): Promise<JoinResult> {
  if (!firebaseReady) return { outcome: "not-found", record: null };
  const ref = sessionDoc(code);
  return runTransaction(getFirebaseDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return { outcome: "not-found" as const, record: null };
    const record = snap.data() as CoopSessionRecord;
    const check = checkJoinSession(record, participant.uid);
    if (check !== "would-join") return { outcome: check, record };
    const updated = withParticipantAdded(record, participant);
    tx.update(ref, { participants: updated.participants, updatedAt: updated.updatedAt });
    return { outcome: "joined" as const, record: updated };
  });
}

/** Realtime updates for a session document (its participant list, as players join). No-op (never fires) if Firebase isn't configured. */
export function subscribeToSession(code: string, onChange: (record: CoopSessionRecord | null) => void): Unsubscribe {
  if (!firebaseReady) return () => {};
  return onSnapshot(sessionDoc(code), (snap) => onChange(snap.exists() ? (snap.data() as CoopSessionRecord) : null));
}

/** Host-only cleanup (enforced by `firestore.rules`, not re-checked here). No-op if Firebase isn't configured. */
export async function deleteSession(code: string): Promise<void> {
  if (!firebaseReady) return;
  await deleteDoc(sessionDoc(code));
}

/**
 * Phase 12.3 (D-103): the host starts the battle — reads the current
 * record, assigns hero ownership via `startCoopBattle`, and writes the
 * result. Not transaction-guarded (unlike `createSession`/`joinSession`):
 * only the host is ever authorized to call this (enforced by
 * `firestore.rules`), and the host's own client is the only caller, so
 * there is no concurrent-writer race to guard against here. Returns null if
 * Firebase isn't configured or the session no longer exists.
 */
export async function startBattle(code: string, heroIds: string[], startedAt: number): Promise<CoopSessionRecord | null> {
  if (!firebaseReady) return null;
  const ref = sessionDoc(code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const updated = startCoopBattle(snap.data() as CoopSessionRecord, heroIds, startedAt);
  await updateDoc(ref, { status: updated.status, heroOwners: updated.heroOwners, updatedAt: updated.updatedAt });
  return updated;
}
