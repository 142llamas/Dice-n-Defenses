/**
 * portraitKey -> image file path, for the eventual real front-facing NPC
 * dialogue portraits (see `scenes/dialogueBox.ts`, D-119). Empty today — no
 * art exists yet — so any scene's preload loop over this object does
 * nothing and no image request is ever made. `dialogueBox.ts`'s renderer
 * already checks `this.textures.exists(portraitKey)` and falls back to a
 * drawn placeholder silhouette when it's not loaded (always true while this
 * is empty).
 *
 * Deliberately a SEPARATE manifest from `data/spriteManifest.ts` — that one
 * is small circular hero/enemy/structure BOARD tokens; this one is a larger
 * front-facing bust portrait for a dialogue box, a different image category
 * and aspect ratio with no reason to share one lookup table.
 *
 * To add a real portrait later: drop the image file under the existing
 * `public/assets/images/` folder and add one entry here, e.g.
 * `"portrait-hollis-vane": "assets/images/portrait-hollis-vane.png"` — no
 * rendering code needs to change. Remember to log it in
 * `CONTENT_SOURCES.md`, per that folder's own README.
 */
export const PORTRAIT_MANIFEST: Record<string, string> = {};
