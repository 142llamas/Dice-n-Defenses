# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-159**: a
  revert of D-157's `Scale.RESIZE` cutover back to `Scale.FIT`, after
  Kevin's first real in-browser pass since D-154 started found it broken.
- **Date:** August 22, 2026 (same day as D-154 through D-158, the 12th
  decision logged in this long multi-day session).
- Tests: unchanged at **1349**. Typecheck, all 1349 tests, and the
  production build (126 modules, unchanged — no new files) all pass.

## What happened

Kevin reported, in his own words: "There are now large issues with the
game buttons. The settings and sign in buttons on main menu overlap with
the border so they don't look great. Also when I hit new game I can no
longer see any buttons for starting the game or going back to the main
menu. Pretty sure that is because of the new full screen sizing, so you
need to rethink how you are going about this." He was right on both counts
— see D-159 in `DECISIONS.md` for the full root-cause writeup, summarized
here:

`Scale.RESIZE` (D-157, shipped last session) makes the canvas's actual
pixel size track the real browser window exactly, with NO automatic
shrink-to-fit. `Scale.FIT` (now restored) was quietly doing something the
entire D-154/155/156 responsive-canvas roadmap had assumed away: every
scene's resize handling only ever recentered content HORIZONTALLY on a
resize — none of it handled a real window SHORTER than `GAME_HEIGHT`
(1080px), which is common on laptops once browser chrome is subtracted.
Under `FIT`, that gap was invisible (the whole 1280x1080 design just
visually shrank to fit, so nothing was ever actually clipped). Under
`RESIZE`, content positioned near the bottom of the old fixed design (like
Character Creation's Start/Back buttons) ended up below the visible
canvas, with nothing to scroll it into view — genuinely invisible, not just
smaller. Main Menu's corner-control overlap has the same root shape from
the width/aspect-ratio side.

**This session's fix**: reverted `main.ts`'s `scale.mode` back to
`Phaser.Scale.FIT`, and removed `BattleScene`'s runtime scale-mode-swap
code (which existed only to lock battles to `FIT` under the old `RESIZE`
default — pointless now, and its `SHUTDOWN` handler would have actively
re-broken every menu scene by flipping the whole game back to `RESIZE`
after any battle ended, had it been left in place). This restores the
EXACT `Scale.FIT` behavior that worked correctly across many prior
sessions — a high-confidence revert, not a new, equally-unverified fix.

**Not reverted**: D-157's fixes to `uiTheme.ts` (`drawScreenBackdrop`/
`spawnAmbientMotes`/`centeredRowX`), `tooltip.ts`, and `dialogueBox.ts` —
reading a scene's live `scale.width`/`height` instead of the fixed
`GAME_WIDTH`/`GAME_HEIGHT` constants. These are harmless no-ops under
`Scale.FIT` (the two are numerically identical again) and would still be
necessary groundwork if a real responsive-canvas attempt is made later.

## If the responsive-canvas roadmap is picked up again

D-159's own writeup in `DECISIONS.md` flags this explicitly: a real fix
needs a strategy for VERTICAL space, not just horizontal centering —
either (a) every scene reflows its vertical layout too, not just shifts/
rebuilds horizontally, or (b) keep `Scale.FIT`'s shrink-to-fit behavior but
raise the LOGICAL canvas size (`GAME_WIDTH`/`GAME_HEIGHT` themselves)
instead of switching scale modes at all. Worth raising as an explicit
choice with Kevin before attempting this a second time — this environment
still has no browser to catch the next edge case blind, and the last
attempt cost a real, confirmed regression in his hands.

## Important files

- **`src/main.ts`** — `scale.mode` back to `Phaser.Scale.FIT`.
- **`src/game/scenes/BattleScene.ts`** — removed the D-157 scale-mode-swap
  code from `create()` and its `SHUTDOWN` handler (3 lines each site).
- No other files touched this session.

## Commands verified

- `npm run typecheck` — clean.
- `npm test` — **1349/1349** passing (unchanged).
- `npm run build` — production build succeeds, 126 modules (unchanged).

## Manual tests completed

None run here (no browser in this environment) — but this revert restores
previously-working, many-sessions-verified behavior rather than
introducing something new, so it's high-confidence. Still worth Kevin's
quick look to confirm both his reported bugs (Main Menu corner-control
overlap, Character Creation's missing Start/Back buttons) are actually
gone, and that nothing else regressed in the process.

## Known issues

- **KI-109**: updated in place — the two bugs Kevin found are logged as
  fixed-by-revert (D-159); its own checklist is now mostly moot since the
  feature it was testing (`Scale.RESIZE`) no longer exists.
- **KI-110** (D-158, KI-034's redesign): still needs Kevin's own in-browser
  confirmation — unaffected by this session's revert (that redesign lives
  entirely inside `BattleScene`, touched by D-158 not D-157/D-159).
- **KI-108** (D-156), **KI-107** (D-155), **KI-106** (D-154): unchanged —
  their own "Update (D-157)" notes are now further annotated to say D-157
  was reverted, so their ORIGINAL text (resizing does nothing) is accurate
  again.
- **KI-105** (D-153) through **KI-092** and earlier: unchanged, still
  outstanding — see prior handoffs for the full list.
- KI-098's remaining threads, unchanged: Progression systems, and the
  lower-priority overworld campaign redesign.

## Deferred items — the responsive-canvas roadmap (status changed this session)

1. ~~The remaining ~5 harder scenes~~ **DONE (D-155)**.
2. ~~`CharacterCreationScene`/`MapBuilderScene`'s own resize-reactivity~~
   **DONE (D-156)**.
3. **The actual `Scale.RESIZE` cutover — REVERTED (D-159) after shipping
   broken (D-157).** Back to NOT DONE. See "If the responsive-canvas
   roadmap is picked up again" above before retrying — this needs a
   different strategy, not a repeat attempt.
4. **`BattleScene`'s `TILE_SIZE` dynamic-scaling** — NOT STARTED, still
   gated on step 3 (now doubly so, given step 3 just failed once already).
5. **Raising `MAX_MAP_COLS`/`MAX_MAP_ROWS`** — pointless until step 4.

## Decisions made

**D-159** — logged in full in `DECISIONS.md`: reverted D-157's
`Scale.RESIZE` cutover back to `Scale.FIT` after Kevin's first real
in-browser pass found it broken (Main Menu corner-control overlap,
Character Creation's Start/Back buttons invisible). Root cause and what a
real fix would need are both documented there. No new `CONTENT_SOURCES.md`
entry needed.

## Content or license additions

None.

## Next chat instructions

1. **Confirm with Kevin that both his reported bugs are gone** (Main Menu
   corner controls, Character Creation Start/Back buttons) — this is a
   high-confidence revert but hasn't been seen in a real browser yet
   either.
2. **KI-110 (D-158's roster-strip redesign) still needs its own separate
   in-browser confirmation** — unrelated to this session's revert, still
   open from before.
3. **Do NOT re-attempt the `Scale.RESIZE` cutover the same way.** If "bigger
   maps" comes back up, raise the two options in this file's "If the
   responsive-canvas roadmap is picked up again" section with Kevin
   directly before writing any code — a second blind attempt at the same
   approach already cost one real regression.
4. **If picking up more of KI-098**: Progression systems (initiative, XP
   distribution, 1-20 campaign pacing) is the one remaining unscoped
   thread besides the responsive-canvas roadmap and the lower-priority
   overworld campaign redesign.
5. **Log a new D-NNN as each further piece ships** (next number: D-160).

## Suggested git steps (not run here; use GitHub Desktop)

Commit `src/main.ts`, `src/game/scenes/BattleScene.ts` (both modified, no
new files). Plus the doc updates (`DECISIONS.md`, `KNOWN_ISSUES.md`,
`CHANGELOG.md`, `PROJECT_STATUS.md`, this file).

## Handoff package contents

- [x] Source files: `src/main.ts`, `src/game/scenes/BattleScene.ts` (both
      modified, no new files)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-159 appended, after D-158)
- [x] KNOWN_ISSUES.md (updated — Open bugs section + KI-109 rewritten;
      KI-106/107/108's "Update (D-157)" notes further annotated)
- [x] CHANGELOG.md (updated — a new Unreleased section)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new D-159 section added at the top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: unchanged at 1349
- [x] No node_modules, dist, secrets, or service-account credentials
