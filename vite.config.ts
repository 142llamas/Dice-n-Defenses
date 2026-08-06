import { defineConfig } from "vite";

// Vite is the local development server and the production build tool.
// The `test` block configures Vitest so `npm test` can run without a browser.
export default defineConfig({
  // Base "./" keeps asset paths relative, which makes the built game work
  // both on Firebase Hosting later and when opened from a subfolder.
  base: "./",
  build: {
    outDir: "dist",
    // Phaser alone is ~1.5 MB; Phase 10 (D-084) added the Firebase SDK
    // (auth + firestore + app), pushing the single bundle to ~2.3 MB. Real
    // code-splitting was reconsidered here, as KI-005 said to once the
    // hosting phase arrived, and deliberately NOT done: every scene
    // (including MainMenuScene, which needs the cloud module immediately
    // for its Account control) is eagerly imported in `main.ts` to build
    // Phaser's `scene` array, so splitting `cloud/` into its own chunk
    // would still load before BootScene ever renders — no real
    // time-to-interactive win for the added async-loading complexity. This
    // limit bump keeps the build output clean while still catching a
    // genuinely runaway bundle; see KI-005 for the full reasoning.
    chunkSizeWarningLimit: 2500,
  },
  server: {
    // Vite picks a free port automatically; 5173 is its usual default.
    port: 5173,
    open: false,
  },
  test: {
    // Lets tests use describe/it/expect without importing them each time.
    globals: true,
    // Pure rules/logic tests run in Node, no browser or Phaser required.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
