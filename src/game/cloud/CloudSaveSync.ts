import { collection, deleteDoc, doc, getDocs, setDoc, type CollectionReference } from "firebase/firestore";
import { getSaveSlot, upsertSaveSlot, type SaveFile, type SaveSlot } from "../systems/SaveSystem";
import { firebaseReady, getFirebaseDb } from "./firebaseApp";

/**
 * CloudSaveSync — Phase 10 (D-084): a thin Firestore adapter over Phase 9's
 * `SaveSystem`. Deliberately NOT pure/unit-tested the way `SaveSystem.ts`
 * is — this is real network IO. Its correctness (ownership, shape/size
 * limits) is covered by `firestore-tests/rules.test.ts` against the local
 * emulator instead; the MERGE policy below reuses `SaveSystem`'s own pure
 * `getSaveSlot`/`upsertSaveSlot` primitives rather than reimplementing
 * slot-array logic here.
 *
 * One Firestore document per save slot, at `users/{uid}/saves/{slotId}` —
 * mirrors Phase 9's existing per-slot create/update/delete shape (not one
 * big array document), so `firestore.rules` can validate/scope ownership
 * per document rather than parsing an array inside one.
 *
 * Sync is CHECKPOINT-TRIGGERED ONLY — called from a save/delete/explicit
 * "Sync with Cloud" click, never on a timer or a realtime listener. This is
 * the direct implementation of the Source of Truth's "do not send every
 * move, frame, or hover to Firestore" boundary.
 */

function savesCollection(uid: string): CollectionReference {
  return collection(getFirebaseDb(), "users", uid, "saves");
}

/** No-op if Firebase isn't configured. */
export async function pushSlot(uid: string, slot: SaveSlot): Promise<void> {
  if (!firebaseReady) return;
  await setDoc(doc(savesCollection(uid), slot.id), slot);
}

/** No-op if Firebase isn't configured. */
export async function deleteSlotFromCloud(uid: string, slotId: string): Promise<void> {
  if (!firebaseReady) return;
  await deleteDoc(doc(savesCollection(uid), slotId));
}

/** Returns an empty list if Firebase isn't configured. */
export async function pullSlots(uid: string): Promise<SaveSlot[]> {
  if (!firebaseReady) return [];
  const snapshot = await getDocs(savesCollection(uid));
  return snapshot.docs.map((d) => d.data() as SaveSlot);
}

/**
 * The one merge entry point. Pulls every cloud slot; for each, keeps
 * whichever of the local/cloud copy has the newer `updatedAt`
 * (LAST-WRITE-WINS per slot id — simplest correct policy, consistent with
 * this project's "deliberately simple" style elsewhere). Then pushes back
 * up anything that's local-only or was locally newer. Returns the merged
 * file — the caller is responsible for persisting it locally too (via
 * `saveSaveFile`), same as every other `SaveSystem` mutation.
 */
export async function syncNow(uid: string, localFile: SaveFile): Promise<SaveFile> {
  if (!firebaseReady) return localFile;
  const cloudSlots = await pullSlots(uid);
  const cloudById = new Map(cloudSlots.map((slot) => [slot.id, slot]));

  let merged = localFile;
  for (const cloudSlot of cloudSlots) {
    const localSlot = getSaveSlot(merged, cloudSlot.id);
    if (!localSlot || cloudSlot.updatedAt > localSlot.updatedAt) {
      merged = upsertSaveSlot(merged, cloudSlot);
    }
  }

  const toPush = merged.slots.filter((slot) => {
    const cloudSlot = cloudById.get(slot.id);
    return !cloudSlot || slot.updatedAt > cloudSlot.updatedAt;
  });
  await Promise.all(toPush.map((slot) => pushSlot(uid, slot)));

  return merged;
}
