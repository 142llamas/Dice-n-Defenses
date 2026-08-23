# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-158**: KI-034's
  redesign — replaced `BattleScene`'s packed bottom status/hint line with a
  real hero roster strip, a much smaller contextual message line, and hover
  tooltips for item descriptions.
- **Date:** August 22, 2026 (same day as D-154 through D-157, the 11th
  decision logged in this long multi-day session).
- Tests: unchanged at **1349** — presentation-layer-only pass, no new pure-
  system rule, no new test file needed (`BattleScene.ts` has zero test
  coverage by this project's own architecture rule). Typecheck, all 1349
  tests, and the production build (126 modules, unchanged — no new files)
  all pass. `npm run dev` + an HTTP check confirmed the server boots (200).

## What Kevin picked this session

Asked directly (again) whether to scope KI-034 or keep going on the
responsive-canvas roadmap — this time, after a fourth confirmed mention, he
picked **KI-034**. Offered three concrete redesign directions with ASCII
mockups (roster strip + short hint / roster strip + help-on-demand /
contextual action bar with real buttons); he picked the **contextual action
bar** direction. Given the size and delicacy of rewriting live, untestable
battle UI, this went through `EnterPlanMode` before any code changed — see
the approved plan's reasoning (also captured in full in `DECISIONS.md`
D-158) for why most of the old hint text turned out to already be redundant
with something else on screen.

## D-158: what it is (see D-158 in DECISIONS.md for the complete writeup)

1. **A real hero roster strip** — per-hero boxed widgets (name/level, a
   green/yellow/red HP bar with exact numbers overlaid, a green border
   matching the existing board-token selection-ring color when selected,
   and a reserved-but-usually-blank AC/move/act/gear detail line for
   whichever hero is selected) replaces the old packed `heroPart` text.
   First HP-bar-style widget in this codebase — no prior convention
   existed to match (confirmed via an Explore pass during planning).
2. **`Enemies: N`** moved to a new small `enemyCountText` in the top HUD,
   next to Integrity/Gold — updated directly inside `refreshStatus()` (not
   folded into `updateHud()`, which runs at different, less frequent call
   sites, to avoid it ever going stale).
3. **A new, much smaller `messageText`** carries only what had no other
   home: aiming-mode instructions (no Cancel button exists for those), the
   `Tab: aim on board` / `Tab: pick item` keyboard-focus indicator
   (genuinely non-obvious state, no other display surface — exactly what
   KI-034's own checklist tests), Test Mode's 3 debug-picker one-liners,
   and `rejectAt()`'s transient rejection messages (same "persists until
   the next refresh" behavior as before, just isolated to its own line).
4. **Building/equipping item-description previews moved to a hover
   tooltip** — `setHoveredItem(id)` now calls the SAME shared
   `this.tooltip` (D-132's `TooltipController`, already used for board-
   tile/hero/enemy hover) instead of rebuilding text, positioned at the
   hovered item's own button. Still driven by BOTH mouse `pointerover` and
   keyboard grid-focus navigation — the exact dual-input wiring KI-034's
   own checklist depends on, preserved deliberately. Fixed a related gap
   while doing this: pressing Tab to enter the item grid used to bypass
   this path entirely (it set the old field directly), so it never
   previewed the newly-focused item until the next arrow key — now it does,
   immediately.
5. **Removed the fully-unused `hoveredItemId` field** — caught by `tsc`'s
   unused-property check once every read site (all inside the deleted hint
   text) was gone.
6. **"How to Play"** gained one clause ("or press 1-4") — the only mention
   of that hotkey left once the live hint's universal tail was removed.

**Deliberate, flagged tradeoff**: `idle`/`heroSelected`/`confirmingMove`'s
old hints (move/attack color legend, "Ability (Q) · Potion (P) · Character
(C)", "Confirm or Cancel the move") are gone entirely, not shortened —
every piece already has a visible button label or board highlight. This
relies on that being self-evident on a repeat playthrough, with "How to
Play" (H) as the fallback. Kevin picked this direction knowing it was the
outcome, not a default assumed on his behalf.

## Important files

- **`src/game/scenes/BattleScene.ts`** — the only file touched:
  - New fields: `heroSlotBoxes`/`heroSlotNameText`/`heroSlotHpBarBg`/
    `heroSlotHpBarFg`/`heroSlotHpText`/`heroSlotDetailText` (parallel
    arrays, one entry per roster slot), `enemyCountText`, `messageText`.
    Removed: `statusText`, `hoveredItemId`.
  - `buildHud()`: builds the roster-slot widgets + `enemyCountText` +
    `messageText`; no longer builds a single wrapped `statusText`.
  - New `layoutHeroSlots()`: called once at the end of `buildHud()`
    (`buildHeroes()` already ran earlier in `create()`, so `this.heroes` is
    final) — positions exactly `this.heroes.length` slots via
    `centeredRowX` (newly imported from `./uiTheme`), hides the rest.
  - `refreshStatus()`: rewritten — updates roster-slot content, HP bar
    width via `.setSize()` (NOT a direct `.width =` assignment — Phaser
    `Rectangle` shapes need `setSize()` to actually redraw their geometry),
    `enemyCountText`, and `messageText`'s now much-shorter mode-dependent
    content.
  - `rejectAt()`: writes to `messageText` instead of the removed
    `statusText`.
  - `setHoveredItem()`: routes through `this.tooltip.showAt()`/`.hide()`.
  - `setInteraction()`: calls `this.setHoveredItem(null)` (not a raw field
    reset) so a stale tooltip is hidden on every mode change too.
  - `toggleKeyboardFocus()`: calls `this.setHoveredItem(...)` (not a raw
    field set) — the fix for item #4's Tab-into-grid gap above.
  - `showTutorial()`: one added clause.
  - No changes needed to `buildItemGrid`, `showShopUI`/`showEquipUI`/
    `showDebugPickerUI`, or any other keyboard-focus/Tab logic.

## Commands verified

- `npm run typecheck` — clean.
- `npm test` — **1349/1349** passing (unchanged from last session).
- `npm run build` — production build succeeds, 126 modules (unchanged — no
  new files this pass).
- `npm run dev` — booted and served HTTP 200.

## Manual tests completed

None — no browser available in this environment, and this is a
substantial, delicate rewrite of LIVE battle UI (not a menu screen), so
Kevin's own in-browser pass matters more here than almost anything else
logged this session. See **KI-110**'s own checklist — in particular,
re-confirm KI-034's own keyboard-only-play behaviors under this rewrite
specifically (arrow-key cursor, Enter/Space parity, Tab grid/board focus
switching, no page-scroll on arrows/space, a full mouse-free battle), not
just assume they still hold because the surrounding code "looks similar."
Also worth a specific look: the HP bar's color thresholds at full/half/
near-death HP, the hover tooltip appearing correctly for BOTH a mouse hover
and pure-keyboard grid navigation, and no HUD overlap on Frostbound Hollow
(9 rows, this file's own recurring tightness stress-test).

## Known issues

- **KI-110** (new, D-158): this session's own in-browser checklist.
- **KI-034**: the system Kevin hated is gone — addressed by D-158. Left
  open (not deleted) since its own remaining checklist items need a fresh
  confirmation pass under the new implementation, tracked via KI-110.
- **KI-109** (D-157): still outstanding from last session — the
  `Scale.RESIZE` cutover's own in-browser checklist, and the FIRST point in
  the whole responsive-canvas roadmap where that confirmation is
  load-bearing (everything converted so far was correct-by-construction but
  never actually exercised under a changing viewport). Step 4
  (`BattleScene`'s `TILE_SIZE` dynamic-scaling) still should NOT start until
  this ships and is confirmed.
- **KI-108** (D-156), **KI-107** (D-155), **KI-106** (D-154): still
  outstanding, unchanged.
- **KI-105** (D-153), **KI-104** (D-152), **KI-103** (D-151), **KI-102**
  (D-150), **KI-101** (D-149) — all from earlier this same multi-day
  session — still outstanding.
- **KI-100** (D-148) and **KI-099** (D-147): still outstanding, untouched.
- KI-098's remaining threads, unchanged: Progression systems, and the
  lower-priority overworld campaign redesign.
- **KI-097/096/095/094/093/092** (Enemy AI/Movement Redesign) and D-148's
  deferred pieces 6b/9b remain unchanged.

## Deferred items — the responsive-canvas roadmap (unchanged this session)

D-154's original numbered list — this session worked KI-034 instead, so
nothing here moved:

1. ~~The remaining ~5 harder scenes~~ **DONE (D-155)**.
2. ~~`CharacterCreationScene`/`MapBuilderScene`'s own resize-reactivity~~
   **DONE (D-156)**.
3. ~~The actual `Scale.RESIZE` cutover~~ **DONE (D-157) — still awaiting
   Kevin's in-browser confirmation (KI-109), which is now load-bearing.**
4. **`BattleScene`'s `TILE_SIZE` dynamic-scaling** — NOT STARTED. Deserves
   its own fully dedicated session(s). Do NOT start until KI-109 is
   confirmed in a real browser.
5. **Raising `MAX_MAP_COLS`/`MAX_MAP_ROWS`** — pointless until step 4 ships.

## Decisions made

**D-158** — logged in full in `DECISIONS.md`: the hero roster strip,
decluttered message line, hover-tooltip item previews, and the
`hoveredItemId` field removal. No new `CONTENT_SOURCES.md` entry needed —
no new content, no new art/audio assets, all original UI code.

## Content or license additions

None.

## Next chat instructions

1. **Get Kevin's own in-browser confirmation of BOTH KI-109 (D-157's
   `Scale.RESIZE` cutover) and KI-110 (D-158's roster-strip redesign)
   before either the responsive-canvas roadmap or anything else in
   `BattleScene` proceeds.** Both are substantial, delicate, previously-
   untestable-here changes; neither has had a single real browser check
   yet. If he reports anything wrong, KI-110's checklist is the first place
   to check (this session's change touches the most recently-edited code).
2. **If continuing the responsive-canvas roadmap once KI-109 is
   confirmed**: step 4, `BattleScene`'s own `TILE_SIZE` dynamic-scaling,
   deserves its own fully dedicated session — do not tack it onto
   something else, and do not start it before KI-109 ships.
3. **KI-034 no longer needs asking about** — it shipped as D-158 this
   session. Don't re-offer it as an open scope choice next time.
4. **If picking up more of KI-098**: Progression systems (initiative, XP
   distribution, 1-20 campaign pacing) is the one remaining unscoped
   thread besides the responsive-canvas roadmap and the lower-priority
   overworld campaign redesign.
5. **Log a new D-NNN as each further piece ships** (next number: D-159).

## Suggested git steps (not run here; use GitHub Desktop)

Commit `src/game/scenes/BattleScene.ts` (modified, no new files). Plus the
doc updates (`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`,
`PROJECT_STATUS.md`, this file).

## Handoff package contents

- [x] Source files: `src/game/scenes/BattleScene.ts` (modified, no new files)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-158 appended, after D-157)
- [x] KNOWN_ISSUES.md (updated — KI-110 added; KI-034 marked addressed,
      left open pending re-confirmation)
- [x] CHANGELOG.md (updated — a new Unreleased section)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new D-158 section added at the top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: unchanged at 1349 (no new tests needed — presentation-only,
      zero existing coverage of the touched file)
- [x] No node_modules, dist, secrets, or service-account credentials
