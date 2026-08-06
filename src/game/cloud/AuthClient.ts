import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseReady, getFirebaseAuth } from "./firebaseApp";

/**
 * AuthClient — Phase 10 (D-084): thin wrapper around Firebase Auth.
 *
 * Every session starts ANONYMOUS automatically (no login screen needed for
 * the base case) so a uid always exists for `CloudSaveSync` to key saves
 * on. "Sign in with Google" UPGRADES that same anonymous identity via
 * account LINKING, so anything already pushed under the anonymous uid
 * carries forward rather than starting over under a new one. The one
 * exception is `auth/credential-already-in-use`: that Google account is
 * already linked to a DIFFERENT, pre-existing Firebase user — signing into
 * THAT identity instead is the right call, since it's the one with real
 * prior cloud history; the anonymous session's own (likely empty) data is
 * abandoned in that case, which only ever affects a device that was never
 * synced anyway.
 *
 * Every exported function checks `firebaseReady` first and no-ops (or
 * returns a signed-out state) rather than letting a Firebase call throw —
 * this module is inert with no Firebase project configured, same as every
 * other file in `cloud/`.
 */

export interface AuthState {
  uid: string | null;
  isAnonymous: boolean;
  displayName: string | null;
}

const SIGNED_OUT: AuthState = { uid: null, isAnonymous: true, displayName: null };

function toAuthState(user: User | null): AuthState {
  if (!user) return SIGNED_OUT;
  return { uid: user.uid, isAnonymous: user.isAnonymous, displayName: user.displayName };
}

function isCredentialInUseError(err: unknown): err is FirebaseError {
  return err instanceof FirebaseError && err.code === "auth/credential-already-in-use";
}

/**
 * Subscribes to auth state and auto-signs-in anonymously whenever there's
 * no session yet. Calls `onChange` once a real user exists, then again on
 * every subsequent change (sign-in with Google, sign-out). Never calls
 * `onChange` at all if Firebase isn't configured — callers should treat
 * that identically to "signed out."
 */
export function initAuth(onChange: (state: AuthState) => void): void {
  if (!firebaseReady) return;
  const auth = getFirebaseAuth();
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch((err) => console.error("Anonymous sign-in failed:", err));
      return;
    }
    onChange(toAuthState(user));
  });
}

/** Upgrades the current anonymous session to a real Google identity (or signs into an existing one — see header comment). */
export async function signInWithGoogle(): Promise<AuthState> {
  if (!firebaseReady) return SIGNED_OUT;
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;
  try {
    const credential = current ? await linkWithPopup(current, provider) : await signInWithPopup(auth, provider);
    return toAuthState(credential.user);
  } catch (err) {
    if (current && isCredentialInUseError(err)) {
      const existingCredential = GoogleAuthProvider.credentialFromError(err);
      if (existingCredential) {
        const result = await signInWithCredential(auth, existingCredential);
        return toAuthState(result.user);
      }
    }
    throw err;
  }
}

/** Signs out, then immediately re-establishes a fresh anonymous session — the app always has a usable uid. */
export async function signOutAndResetAnonymous(): Promise<void> {
  if (!firebaseReady) return;
  const auth = getFirebaseAuth();
  await signOut(auth);
  await signInAnonymously(auth);
}
