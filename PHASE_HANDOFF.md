# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev. Every phase through Phase 25 (D-116) is complete;
  D-117 through D-125 (playtest fixes, campaign scaffolding, dialogue box,
  dialogue skip controls, the basic-attack lunge, spell-cast/death
  animations, the Main Menu/Compendium/Bestiary UI theme, an inert-class-
  feature batch, and five more deferred slices — Reckless Attack, Preserve
  Life, hero-side stealth, Wizard/Warlock's spell-mastery picker) are
  complete. **This session ran D-126**: a full UI-layout audit and fix
  across the whole game, not a new content/mechanics phase.
- **Why this ran this session:** Kevin said he's actively gathering images
  for different aspects of the game, but that right now there are "a lot of
  problems with clashing text boxes, boxes going over the edge of the
  screen, etc." and asked for a full audit and fix of these UI issues — an
  explicit, broad ask, not a narrow bug report about one screen. Given the
  scope, a general-purpose agent was used to read every scene file in full
  and compute real bounding-box math (against the 1280x1080 canvas and every
  real map/data-table's actual current size) rather than guessing which
  screens might be affected or fixing only what a quick look would surface.
  Every finding was independently re-verified against the actual source
  before any fix was made — the audit's own numbers were checked, not taken
  on faith.
- **Completed this session (D-126):**
  - **`CompendiumScene`'s category tabs (10 items) and class selector (12
    items)** rendered more than half off-canvas on BOTH edges, on the
    screen's own default tab — a deterministic bug present on literally
    every visit, not an edge case. Root cause: the shared `centeredRowX`
    helper (`uiTheme.ts`) computed positions for the requested item width
    unconditionally, with no ceiling on the row's total width. Fixed at the
    helper itself: `centeredRowX` now takes an optional `maxWidth` (default
    `GAME_WIDTH - 80`) and shrinks item width evenly to fit instead of
    letting the row grow past the canvas. All 7 call sites across
    `CompendiumScene`/`MainMenuScene` now destructure the returned
    `{ xs, itemWidth }` and size their buttons off the (possibly shrunk)
    `itemWidth`, not the original request.
  - **`MapBuilderScene`'s terrain palette** (8 swatches, shown by default on
    open): the identical off-canvas failure, hand-rolled separately rather
    than routed through `centeredRowX`. Now imports and uses the same fixed
    helper.
  - **`FreePlayScene`'s map (7 options) and boss (13 options) picker
    labels**: the button WIDTH already correctly shrinks to fit the option
    count, but the label TEXT had no word-wrap (only the locked-hint text
    below it did) and stayed at a fixed 16px font — a real map/boss name
    ("Cinderfall Rift (volcanic, collapsing bridge)", "The Hollow Empress")
    rendered far wider than its slot and visibly overlapped neighboring
    buttons. Fixed with `wordWrap` at the slot's own width plus a
    width-scaled font size (16px down to 10px as a row gets more crowded).
  - **The core Battle HUD's status line/combat log** (`BattleScene.buildHud`)
    — the single most-used screen in the game, and the one most likely to
    be what Kevin is actually hitting: `wrapWidth` was `this.map.cols *
    TILE_SIZE`, the GRID's own pixel width, not the canvas's — despite this
    exact spot's own prior comment claiming word-wrap already made a
    collision "impossible regardless of content length" (wrapping bounds
    line WIDTH, not the fixed 60px HEIGHT it was meant to protect).
    Computed against the REAL `refreshStatus` format (a full 4-hero party's
    status plus the `heroSelected`/`equipping` hint, using real hero-name/
    gear-description lengths from `data/`, not synthetic worst cases) on
    Frostbound Hollow — the narrowest built-in map at 14 columns, which is
    ALSO the tallest at 9 rows — the status line already reaches ~4-5
    wrapped lines in completely ordinary play (a hero simply selected, no
    item hover needed), bleeding into the combat log directly below it.
    Fixed at the root: `wrapWidth` is now `GAME_WIDTH - 80`, decoupled from
    the grid entirely (nothing else shares that row horizontally). Also
    bumped `statusBlockHeight` 60→78 as extra headroom, re-verified against
    `buildShopHud`'s own item-grid/Done-button bounding-box math to confirm
    it still clears `GAME_HEIGHT` on Frostbound Hollow's 9 rows (1069px vs.
    1080 — an 11px margin, tight but real and checked, not assumed).
    `combatLogText` also gained its own `wordWrap` for the first time — it
    had none at all before this session, so a single long combat-log line
    could render wider than the canvas and clip off both edges.
  - **`BrowseSharedMapsScene`'s shared-map list**: rendered one row per
    FETCHED map with no ceiling — grew into the fixed Wave Count/Minion/
    Difficulty/Start sections below it once more than ~6 maps were loaded
    (`Load more` fetches 10 at a time). A real, growing failure mode given
    Kevin is actively building out map-sharing content this cycle, not a
    hypothetical one. Fixed with a fixed local page size (5 maps at a time)
    and its own Prev/Next pagination, matching the pattern this project
    already uses elsewhere (Gear/Shop grids, Compendium's Spells tab); "Next"
    past the last locally-held page transparently fetches another remote
    page first.
  - **Investigated and deliberately left alone, with the reasoning recorded
    rather than silently dropped** (all in D-126): `renderAsiPrompt`'s
    title can mathematically overlap its own first button row at 15+
    simultaneous choices, but that's reachable only by the Epic Boon feat's
    ability-picker at character level 19+, which no run in this game
    currently reaches (10 waves max per run — same gap as KI-066). An
    aura-ring enemy's buff radius and the falling-judgment spell-cast VFX
    can both theoretically render a few pixels above the canvas top, but
    only for a spawn/target on row 0-1, which no built-in map has, and both
    are momentary self-correcting cosmetic effects. A suspected
    status-badge-stacking overflow (poisoned+silenced+hidden+… all active
    at once) turned out not to exist — both hero and enemy status badges
    render as ONE Text object with every active code concatenated into a
    single short string, not separate stacked boxes.
  - **Screens read and confirmed already sound, no changes needed**:
    `MainMenuScene`'s three `centeredRowX` rows (all well under the new
    `maxWidth` ceiling already), `BestiaryScene`'s pagination (already
    correctly capped at 10/page against 94 real entries),
    `CharacterCreationScene`, `CoopLobbyScene`, `CampaignSelectScene`,
    `LoadGameScene`, and `dialogueBox.ts`.
  - Tests: **unchanged at 1130** — every fix this session is Phaser-only
    presentation/layout code, the same standing "scene code isn't
    unit-tested" boundary every other visual-only fix in this project has.
    Typecheck, all 1130 tests, and the production build all pass unchanged
    (115 modules).
- **What's NOT done, and why:** `BattleScene`'s full HUD visual RESTYLE
  (carried forward since D-123, Kevin's own stated next step) still hasn't
  happened — this session fixed concrete overlap/overflow BUGS in the
  existing layout, it did not redesign that layout's look. If Kevin's next
  playtest still finds the HUD visually cluttered/flat (as opposed to
  literally overlapping), that's the restyle work, not more of this
  session's fixes.
- **A real limitation of this environment, stated plainly:** every fix this
  session lives inside Phaser scene code with no browser available here —
  the bounding-box arithmetic behind each fix was verified by hand against
  real constants and real data-table lengths (shown in D-126's own writeup),
  not assumed, but none of it has actually been SEEN rendered. See **KI-083**
  for the exact in-browser checklist.
- **Recommended next step:** Kevin should open Compendium and Map Builder
  first (both were broken on their own DEFAULT tab, so this is the fastest
  possible confirmation), then play at least one battle on Frostbound Hollow
  specifically with a full 4-hero party (the narrowest+tallest built-in map,
  and the exact case the Battle HUD fix targets) — see **KI-083** for the
  full checklist, including what's still knowingly NOT fixed (the ASI-prompt
  edge case) and why.
- **Last complete milestone:** Phase 6 (`v0.1.1`) through Phase 25 (D-116);
  D-117 through D-125; D-126 (this session — UI-layout audit and fix, no new
  content/mechanics). Phase 12 still has no live board sync. `BattleScene`'s
  own visual restyle (carried forward from D-123) still has not started.
- **Git branch:** no git in this environment; Kevin manages branching in
  GitHub Desktop. This session's changed files: `src/game/scenes/
  uiTheme.ts` (shared `centeredRowX` helper), `src/game/scenes/
  CompendiumScene.ts`, `src/game/scenes/MainMenuScene.ts`, `src/game/
  scenes/MapBuilderScene.ts`, `src/game/scenes/FreePlayScene.ts`,
  `src/game/scenes/BattleScene.ts`, `src/game/scenes/
  BrowseSharedMapsScene.ts`; docs (`DECISIONS.md`, `PROJECT_STATUS.md`,
  `CHANGELOG.md`, `KNOWN_ISSUES.md`, this file). No test file changed. No
  git commit/tag made here.
- **Date:** August 12, 2026

## Why this batch was chosen

Kevin's ask was explicitly broad ("a full audit and fix," not "fix the thing
I noticed") and came while he's investing in real art assets for the game —
a reasonable moment to also want the surrounding UI to actually hold
together, since new art dropped into a layout that's already clashing would
just clash differently. Given `BattleScene`'s HUD has never had a layout
pass despite 25+ phases of purely additive changes, and several menu
screens' button rows are sized off data tables (class list, category list,
terrain palette, map/boss options) that have grown well past their
original design point, this was treated as a real systemic sweep rather
than a guess-and-check pass over whichever screen came to mind first.

## What works now

- Everything from every prior phase through D-125, unchanged in gameplay
  behavior — this session touched ONLY layout/positioning code in scene
  files, no game rule, data value, or mechanic changed.
- Compendium's category tabs and class selector, Map Builder's terrain
  palette, Free Play's map/boss picker labels, the core Battle HUD's status
  line/combat log, and Browse Shared Maps' list are all now correct by the
  verified arithmetic in D-126 — pending Kevin's own in-browser confirmation
  (KI-083).

## What changed

- **Six scene files edited, no new files, no test file changed**:
  `src/game/scenes/uiTheme.ts` (`centeredRowX` gained an optional
  `maxWidth` and now returns `{ xs, itemWidth }` instead of a plain array),
  `src/game/scenes/CompendiumScene.ts` (4 call sites updated to the new
  `centeredRowX` shape), `src/game/scenes/MainMenuScene.ts` (3 call sites,
  same update, no behavior change since none of its rows exceeded the new
  ceiling), `src/game/scenes/MapBuilderScene.ts` (now imports and uses
  `centeredRowX` for its terrain/marker palette instead of hand-rolled
  math), `src/game/scenes/FreePlayScene.ts` (`buildOptionRow`'s label text
  gained `wordWrap` and a width-scaled font size), `src/game/scenes/
  BattleScene.ts` (`buildHud`'s `wrapWidth`/`statusBlockHeight`,
  `combatLogText` gained `wordWrap`), `src/game/scenes/
  BrowseSharedMapsScene.ts` (the map list gained a fixed local page size and
  its own Prev/Next controls, replacing the old uncapped "Load more"-only
  list).
- **Docs**: `DECISIONS.md` (new D-126), `PROJECT_STATUS.md` (new top
  section), `CHANGELOG.md` (new entry), `KNOWN_ISSUES.md` (new KI-083),
  this file (rewritten). No `CONTENT_SOURCES.md` change — no new content of
  any kind this session, purely layout-code fixes.

## Important files

- **`DECISIONS.md`'s D-126** — the full method: every deterministic bug
  found with its exact arithmetic, the core-HUD fix's real-data
  verification (not a synthetic worst case), and the complete list of what
  was investigated and deliberately left alone with the reasoning for each.
- **`src/game/scenes/uiTheme.ts`'s `centeredRowX`** — the one shared fix
  point for the off-canvas button-row bug class; any FUTURE screen that
  hand-rolls its own centered-row math instead of using this helper is at
  risk of the same bug recurring.
- **`KNOWN_ISSUES.md`'s KI-083** — the full in-browser verification
  checklist for every fix this session, including exactly which screen to
  open first for the fastest possible confirmation (Compendium/Map Builder,
  both broken on their own default tab before this session).

## Commands verified

- `npm run typecheck` — pass.
- `npm test` — pass, **1130/1130** (unchanged from last session — no test
  file touched, this session is layout-code only).
- `npm run build` — pass, **115 modules** (unchanged).
- `npm run dev` — not re-checked this session (no `main.ts`/`config.ts`/
  `index.html` file touched; last confirmed serving HTTP 200 in an earlier
  session).

## Manual tests completed

**None** — no browser is available in this environment, and this entire
session is visual/layout-only code that needs a real screen to actually
confirm. Every fix's correctness was verified by re-deriving the exact
bounding-box arithmetic against real constants and real data (shown in
D-126), not assumed — but "the math says it fits" and "Kevin saw it render
correctly" are different claims, and only the first one is true right now.
See **KI-083** for the exact checklist.

## Known issues

- **KI-083** (new this session) — every D-126 layout fix not yet confirmed
  by Kevin in a browser; full checklist in `KNOWN_ISSUES.md`, including the
  one edge case (`renderAsiPrompt` at 15+ choices) that was found but
  deliberately NOT fixed since it has no reachable path in the game today.
- **KI-082** — D-125's five slices, still open.
- **KI-081** — D-124's batch of wired-real class/subclass features, still
  open.
- **KI-080** — D-123's Main Menu/Compendium/Bestiary restyle, still open.
- **KI-079** — Kevin's spellbook-access/level-up-choice playtest reports,
  investigated in code, no defect found, still needs his own confirmation.
- **KI-074** through **KI-078** — five earlier content/mechanics/UI phases,
  still not yet confirmed in a browser (KI-074 now TEN sessions overdue).
- **KI-065** through **KI-073** — nine consecutive earlier content/
  mechanics phases, still not yet confirmed in a browser.
- Unchanged: every other issue in `KNOWN_ISSUES.md`.

## Deferred items

- **`BattleScene`'s full HUD visual restyle** (carried forward from D-123) —
  this session fixed overlap/overflow BUGS in the existing layout, it is
  still not a visual redesign. Still the other major standing to-do.
- **`renderAsiPrompt`'s 15+-choice title overlap** — real by the math, but
  unreachable below character level 19 (no run currently reaches it, same
  gap as KI-066) — not worth fixing until a run can actually reach that many
  simultaneous choices.
- Everything already deferred from D-117 through D-125 and earlier phases —
  untouched this session (no gameplay/mechanic code changed at all).

## Decisions made

- **D-126** — a full UI-layout audit and fix: `uiTheme.ts`'s `centeredRowX`
  gained a max-width shrink-to-fit; Compendium/Map Builder's off-canvas
  button rows, Free Play's overlapping picker labels, the core Battle HUD's
  status/combat-log wrap-width bug, and Browse Shared Maps' uncapped list
  were all fixed; several other spots were investigated and deliberately
  left alone with reasoning recorded. See `DECISIONS.md` for the full method.

## Content or license additions

None this session — no new SRD text, fonts, art, or audio; no new game
content, mechanics, or data of any kind. Purely layout/positioning fixes in
existing Phaser scene code.

## Next chat instructions

1. **Ask Kevin to open Compendium and Map Builder first** — both had a
   bug reachable on their own DEFAULT tab before this session, so these are
   the fastest possible confirmation that the fix actually landed.
2. **Ask Kevin to play at least one battle on Frostbound Hollow** with a
   full 4-hero party — the specific narrowest+tallest built-in map the core
   Battle HUD fix targets — and report whether the status line/combat log
   ever visually collide, in both ordinary play and while hovering a long
   item description in Build/Gear mode.
3. **If Kevin confirms this session's fixes hold**: the `BattleScene` HUD
   visual restyle (carried forward from D-123, Kevin's own stated next
   step) is still the other major standing to-do, separate from this
   session's bug-fixing work entirely — worth asking directly whether he
   wants that tackled next, especially now that the layout underneath it no
   longer has known overlap bugs to fight during a restyle.
4. Also ask about the long tail of still-unconfirmed content phases
   (KI-065 through KI-082) if there's time — KI-074 is now ten sessions
   overdue.
5. **If Kevin reports a NEW clashing/off-canvas spot this session's audit
   didn't catch**: check first whether it's in a screen this session marked
   "read and confirmed already sound" (`MainMenuScene`, `BestiaryScene`,
   `CharacterCreationScene`, `CoopLobbyScene`, `CampaignSelectScene`,
   `LoadGameScene`, `dialogueBox.ts`) — if so, the data driving it may have
   grown since this session's read, the same pattern that caused this
   session's Compendium/Map Builder bugs in the first place.

## Suggested git steps (not run here; use GitHub Desktop)

1. This session's diff touches six existing scene files and docs — no new
   source file, no test file — a coherent single unit (one decision, D-126),
   safe as its own commit.
2. Not deployed anywhere from this session directly — Kevin's existing
   GitHub Actions workflow deploys automatically on push to `main`. Very low
   risk to deploy (pure layout/positioning fixes, no gameplay logic touched,
   all 1130 existing tests still pass unchanged) — probably worth deploying
   promptly given the fixes directly address bugs Kevin is actively hitting.

## Handoff package contents

- [x] Source files (see "What changed" above)
- [x] package.json / package-lock.json (unchanged — no new deps)
- [x] README.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new top section)
- [x] DECISIONS.md (updated — new D-126)
- [x] KNOWN_ISSUES.md (updated — new KI-083)
- [x] CHANGELOG.md (updated — new entry)
- [x] CONTENT_SOURCES.md (unchanged — no new content this session)
- [x] ASSET_PLAN.md (unchanged — not touched this session)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PHASE_HANDOFF.md (this file, rewritten)
- [x] Tests (1130, unchanged — no test file touched this session)
- [x] No node_modules, dist, secrets, or service-account credentials
