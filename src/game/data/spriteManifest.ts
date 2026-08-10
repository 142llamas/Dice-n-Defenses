/**
 * assetKey -> image file path, for the eventual real hero/enemy/structure
 * art ASSET_PLAN.md describes. Empty today — no art exists yet (KI-004) —
 * so `BattleScene.preload()`'s loop over this object does nothing and no
 * image request is ever made. Every token-drawing method already checks
 * `this.textures.exists(assetKey)` and falls back to the current colored-
 * shape rendering when it's not loaded (always true while this is empty).
 *
 * To add real art later: drop the image file under the existing
 * `public/assets/images/` folder and add one entry here, e.g.
 * `"hero-fighter": "assets/images/hero-fighter.png"` — no rendering code
 * needs to change (see ASSET_PLAN.md's own "Technical notes for whoever
 * implements this later"). Remember to log it in CONTENT_SOURCES.md, per
 * that folder's own README.
 */
export const SPRITE_MANIFEST: Record<string, string> = {};
