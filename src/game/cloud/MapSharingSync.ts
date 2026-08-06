import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type CollectionReference,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { SharedMapRecord } from "../systems/MapSharingSystem";
import { firebaseReady, getFirebaseDb } from "./firebaseApp";

/**
 * MapSharingSync — Phase 11.10 (D-085): a thin Firestore adapter over
 * `MapSharingSystem`'s `SharedMapRecord`, sitting beside `CloudSaveSync.ts`
 * as the same deliberate exception to the `systems/` split (real network IO,
 * not a pure game rule).
 *
 * One document per shared map at `sharedMaps/{mapId}` — a single, PUBLIC
 * top-level collection (not owner-scoped under `users/{uid}/...` the way
 * saves are), since sharing means other players can browse and play it. See
 * `firestore.rules`' `sharedMaps` block for the actual security boundary:
 * public read, author-only write.
 *
 * Every function checks `firebaseReady` first and no-ops/returns empty —
 * identical discipline to `CloudSaveSync.ts`. No realtime listeners; every
 * call is checkpoint-triggered (a Publish click, opening Browse, a "load
 * more" click) — same "don't send every move/frame to Firestore" boundary
 * Phase 10 already established.
 */

function sharedMapsCollection(): CollectionReference {
  return collection(getFirebaseDb(), "sharedMaps");
}

/** No-op if Firebase isn't configured. Insert-or-replace (author publishing an update reuses the same id). */
export async function pushMap(record: SharedMapRecord): Promise<void> {
  if (!firebaseReady) return;
  await setDoc(doc(sharedMapsCollection(), record.id), record);
}

/** No-op if Firebase isn't configured. Only succeeds server-side if the caller is the author (enforced by rules). */
export async function deleteMapFromCloud(mapId: string): Promise<void> {
  if (!firebaseReady) return;
  await deleteDoc(doc(sharedMapsCollection(), mapId));
}

export interface SharedMapPage {
  maps: SharedMapRecord[];
  lastDoc: QueryDocumentSnapshot | null;
}

/** Paginated public browse, newest-first. Returns an empty page if Firebase isn't configured. */
export async function listSharedMaps(pageSize = 20, after?: QueryDocumentSnapshot): Promise<SharedMapPage> {
  if (!firebaseReady) return { maps: [], lastDoc: null };
  const constraints = after
    ? [orderBy("updatedAt", "desc"), startAfter(after), limit(pageSize)]
    : [orderBy("updatedAt", "desc"), limit(pageSize)];
  const snapshot = await getDocs(query(sharedMapsCollection(), ...constraints));
  return {
    maps: snapshot.docs.map((d) => d.data() as SharedMapRecord),
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/** Returns an empty list if Firebase isn't configured. Used for the publish-limit check and a future "my maps" list. */
export async function listMapsByAuthor(uid: string): Promise<SharedMapRecord[]> {
  if (!firebaseReady) return [];
  const snapshot = await getDocs(query(sharedMapsCollection(), where("authorUid", "==", uid)));
  return snapshot.docs.map((d) => d.data() as SharedMapRecord);
}
