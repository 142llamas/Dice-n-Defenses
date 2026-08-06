import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * firebaseApp — Phase 10 (D-084): the ONE place Firebase is initialized.
 *
 * Deliberately a new top-level `src/game/cloud/` folder rather than
 * `src/game/systems/` — this is IO/infrastructure glue to an external
 * service, not a pure game rule, so it doesn't belong alongside the
 * unit-tested engines in `systems/` (see that folder's own "no Phaser
 * dependency, fully unit-testable" discipline, which this can't meet: it's
 * real network IO).
 *
 * Every other cloud module reads `firebaseReady` before doing anything. If
 * any required `VITE_FIREBASE_*` env var is missing (no `.env` — a fresh
 * clone, or before a Firebase project has been created — see
 * `.env.example`), the whole cloud layer stays inert and the game behaves
 * exactly as it did at the end of Phase 9 (local saves only). This IS the
 * "local-first fallback" / "offline-or-signed-out behavior" the Source of
 * Truth's Phase 10 acceptance criteria asks for — not a separate mode to
 * build, just what naturally happens when config is absent.
 */

interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readEnvConfig(): FirebaseEnvConfig | null {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
}

const envConfig = readEnvConfig();

/** True only when every required Firebase env var is present. */
export const firebaseReady = envConfig !== null;

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (envConfig) {
  app = initializeApp(envConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

/** Throws if called when `firebaseReady` is false — every caller checks that first. */
export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error("Firebase is not configured (see .env.example) — check firebaseReady first.");
  return auth;
}

/** Throws if called when `firebaseReady` is false — every caller checks that first. */
export function getFirebaseDb(): Firestore {
  if (!db) throw new Error("Firebase is not configured (see .env.example) — check firebaseReady first.");
  return db;
}
