import { defineConfig } from "vitest/config";

// A SEPARATE Vitest config from the repo root's `vite.config.ts` (whose
// `test.include` only ever matches `tests/**/*.test.ts`) — this suite needs
// the Firebase Local Emulator running (see `package.json`'s `test:rules`
// script), so it's deliberately excluded from the plain `npm test` run,
// which never needs the emulator.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["firestore-tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
