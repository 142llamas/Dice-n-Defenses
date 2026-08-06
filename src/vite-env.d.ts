/// <reference types="vite/client" />

/**
 * Phase 10 (D-084): the Firebase client config, read from `.env` (gitignored
 * — see `.env.example` for the required keys). Every field is optional
 * because `.env` itself is optional: `src/game/cloud/firebaseApp.ts`
 * treats a missing key as "no Firebase project configured yet" and keeps
 * the whole cloud layer inert, never a type error.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
