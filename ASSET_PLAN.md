# Original Asset Plan

Phase 8 (`SOURCE_OF_TRUTH.md` §"Phase 8") lists "original asset plan" as an
in-scope item. This document is that plan: what exists today, what will
eventually replace it, and the constraints any future art work must follow.
It commits to no art style or timeline on its own — those are open questions
for Kevin to decide when real art production actually starts (a later phase;
see "Sequencing" below). Until then, the placeholder approach stays exactly
as it is (operating instruction #1: preserve working systems).

## What exists today (placeholder art)

Everything on screen is a Phaser primitive (`add.circle`/`add.rectangle`)
plus `add.text` glyphs, coloured from the single palette in
`src/game/config.ts` (`COLORS`). Specifically:

- **Heroes/enemies**: a coloured circle, a bold single-letter initial, an
  HP readout. The miniboss additionally gets a larger radius, a thicker
  gold outline, and a persistent name banner (Phase 8, KI-023); flyers get a
  white ring (D-048); status effects get a small lettered badge (Phase 8,
  KI-027).
- **Structures**: a coloured rectangle with a single-letter glyph
  (`STRUCTURE_COLORS` in `data/structures.ts`).
- **Board**: flat-coloured tiles (floor/wall) plus a thin grid line overlay;
  `IN`/`OUT` text markers at spawn/exit.
- **UI chrome**: rectangles with text labels for every button, panel, and
  modal (shop grid, gear grid, level-up overlay, tutorial overlay, end
  screen). No icons anywhere — every affordance is a text label.

This is intentionally minimal (KI-004) and has carried the project through
Phase 7 without issue. It is **not** a placeholder in the "temporary and
broken" sense — it is legible, consistent, and colour-plus-shape
differentiated (Phase 8 made the differentiation less colour-dependent; see
KNOWN_ISSUES).

## What real art would eventually replace

In rough priority order — highest-visibility, most-repeated elements first,
since that's where a viewer's eye spends the most time:

1. **Hero and enemy tokens.** Seen every turn, every wave. A sprite (even a
   simple one) per hero archetype and per enemy type would read far better
   than a coloured circle. The miniboss in particular wants a genuinely
   distinct silhouette, not just a bigger circle.
2. **Structures.** Walls/gates/traps/platforms/perches — seven distinct
   silhouettes would be more readable than seven colours on the same
   rectangle shape.
3. **Status effect icons.** Small, recognisable icons (a snowflake, a flame,
   stars) instead of the current lettered badge — same information, faster
   to read at a glance.
4. **UI chrome.** Button/panel textures, a title-screen background/logo
   treatment. Lowest gameplay priority — the current flat rectangles are
   functional and unambiguous — but the biggest single lever on "does this
   look like a finished game."
5. **Board/background.** Tile textures, a background treatment behind the
   grid. Lowest priority: the flat colours are already legible and
   information-dense (walkable vs. blocked, spawn vs. exit) and a texture
   pass here has to be careful not to *reduce* that legibility.

## Constraints on any future art (non-negotiable)

- **100% original.** No Dungeons & Dragons / D&D branding, no SRD-derived
  imagery, no third-party IP of any kind — this is a repo-wide rule
  (`SOURCE_OF_TRUTH.md` §3), not new to this document.
- **No unlicensed stock or scraped reference.** If an artist works from
  reference images, those references must be either owned/licensed or
  public-domain/CC0, tracked the same way `CONTENT_SOURCES.md` already
  tracks every named hero/enemy/item's originality.
- **AI-generated art is an open question, not a default.** If image-generation
  tooling is used for production art, Kevin should decide that explicitly
  first (licensing and provenance implications differ from
  human-illustrated work) — this plan does not assume either answer.
- **Style consistency over individual asset quality.** A consistent, simple
  style across all tokens/structures beats a few beautifully detailed pieces
  next to a lot of unfinished placeholders. If art production happens in
  batches, batch by category (all heroes, then all enemies, ...), not by
  whichever asset seems most fun to draw first.

## Technical notes for whoever implements this later

- **The loading/rendering plumbing for hero tokens already exists (D-117),
  with no real art yet.** `HeroDefinition.assetKey` is set by
  `heroDefinitionFromBuild`; `data/spriteManifest.ts` exports the (currently
  EMPTY) `SPRITE_MANIFEST: Record<assetKey, imagePath>`;
  `BattleScene.preload()` loads whatever it lists via `this.load.image`; and
  `createTokenSprite` swaps a token's circle for a real sprite once
  `this.textures.exists(assetKey)` is true, hiding (not destroying) the
  circle as the fallback. To add a real hero sprite: drop the image under
  `public/assets/images/`, add one entry to `SPRITE_MANIFEST`, done — no
  rendering code changes. Enemy/structure tokens already carry a populated
  `assetKey` too but do NOT yet call `createTokenSprite` — each has its own
  per-token mutation logic (stealth dimming, aura rings, boss-size variants)
  worth reconciling with a sprite swap once real art exists to test against,
  not speculatively (see KNOWN_ISSUES KI-074).
- A texture atlas (one sheet, multiple frames) is the standard way to keep
  many small sprites from bloating load time once there are enough of them
  to matter, and pairs naturally with "replace tokens first" above (one hero
  atlas, one enemy atlas, ...) — `SPRITE_MANIFEST`'s current one-image-per-key
  shape would need to grow into `this.load.atlas` calls at that point, not a
  rewrite of the fallback logic itself.
- Watch the bundle-size ceiling noted in KNOWN_ISSUES (KI-005): the JS bundle
  is already ~1.5 MB before any art asset is added. Images are separate
  files served alongside the JS bundle (not inlined into it), so this mostly
  affects total page-weight/load time, not the `chunkSizeWarningLimit`
  itself — but it's worth remembering when choosing image resolution/format.
- Data-driven content stays data-driven: an asset key belongs on the
  relevant `data/*.ts` definition (heroes/enemies/structures/equipment all
  have `assetKey`), not hardcoded in scene code.

## Sequencing

This plan does not schedule art production — that depends on a decision
Kevin hasn't made yet (art style, budget/tooling, whether it's hand-drawn or
AI-assisted). The natural trigger point is after the Phase 7 balance pass and
the rest of Phase 8's functional items land, so art direction can be chosen
against a feature-complete, balanced vertical slice rather than a moving
target.
