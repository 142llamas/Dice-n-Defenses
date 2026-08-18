# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev. Every phase through Phase 25 (D-116) is complete;
  D-117 through D-137 (playtest fixes, campaign scaffolding, dialogue
  system, animations, UI theme, inert-feature batches, a full UI-layout
  audit, four foundational systems, a settable Starting Level, gear-
  purchase UX/level-up popup/live Game Speed/two-tier battle log, a full 5e
  damage-type mechanical engine, AC/damage visibility in the battle HUD,
  the level-by-level Character Creation planner, the full three-phase real
  SRD 5.2.1 spell-preparation economy, and a general dual-typed-damage
  system) are complete. **This session ran D-138: Test Mode** — KI-085's
  last remaining large item, closing that list out entirely.
- **Why this ran this session:** Kevin said "I think the only remaining
  thing to build is a test mode... let's build that," and confirmed via two
  scope-fork questions before implementation: a NEW dedicated Main Menu
  entry point (`TestModeScene`), not a toggle folded into Free Play; and a
  LIVE in-battle spawner for enemies/terrain (not just a pre-battle setup
  screen) for the "manual enemy/terrain placement" capability KI-085's
  original description named.
- **Completed this session:**
  - **`scenes/TestModeScene.ts` (new)**: a stripped-down picker — cycle
    buttons for Map (every built-in map, no unlock gating) and Wave Count
    only — that builds a wave list via the existing
    `generateFreePlayWaves`/`EXPANDED_MINIONS` and hands off to
    `CharacterCreationScene` exactly like Free Play does, plus one new
    flag: `testMode: true`. `MAP_OPTIONS`/`EXPANDED_MINIONS`/`GatedOption`
    were exported from `FreePlayScene.ts` (previously module-private) so
    Test Mode reuses the same map list/roster instead of duplicating it.
  - **`MainMenuScene.ts`**: one new "Test Mode" button in the Creator Tools
    row (`tool` variant), starting `TestModeScene`.
  - **`CharacterCreationScene.ts`/`BattleScene.ts`**: both gained a
    `testMode?: boolean` field, read from `init()`'s incoming data and
    forwarded unchanged (`CharacterCreationScene` → `BattleScene`'s own
    `scene.start` call). Every other entry point (New Game, Free Play,
    Campaigns, Co-op, Load Game) passes nothing, so `testMode` defaults
    `false` and none of this session's new UI ever appears for them.
  - **`systems/WaveSystem.ts` gains three members**: `setNoFail(value)`
    gates `isDefeated()` to always report `false` when set (integrity
    still visibly rises/falls on a breach — only the loss condition itself
    is suppressed; default OFF); `forceEndWave()` clears `active` and marks
    every spawn group fully spawned, so `isCurrentWaveComplete()` reads
    true immediately (Skip Wave's mechanism — no reward gold awarded, a
    bypass, not a real clear); `spawnAt(enemyId, pos)` mirrors
    `spawnDueEnemies`'s real entity-construction lines exactly (same
    `Enemy` constructor, same `active`/`nextInstance` bookkeeping, base
    definition, no wave HP-scaling).
  - **`entities/Hero.ts`/`entities/Enemy.ts` gain `removeStatus(id)`**,
    mirroring the existing `applyStatus`/`hasStatus` shape exactly. Status
    assignment in the debug UI is toggle-based: a status chip applies a
    fixed, long debug duration (`DEBUG_STATUS_DURATION_TURNS = 99`) if the
    target lacks it, or removes it early if the target already has it — no
    separate duration-picker UI needed.
  - **`scenes/BattleScene.ts`'s Test Mode debug toolbar** (rendered only
    when `this.testMode`): a single small corner button ("Debug Menu
    (F9)", bottom-right, anchored purely to `GAME_WIDTH`/`GAME_HEIGHT` so
    it can never collide with the grid-dependent HUD stack below the
    board) opens a full-screen modal (same dim+panel shape the existing
    Technical Log overlay already uses) listing Skip Wave, a No-Fail
    Stronghold toggle, and three mode-select buttons. Each mode-select
    button closes the modal and enters a new `Interaction` kind
    (`debugSpawnEnemy`/`debugPaintTerrain`/`debugStatus`), whose own picker
    grid appears in the EXACT SAME footprint the Shop/Gear grid already
    reserves — built via the existing `buildItemGrid` helper, same
    `ITEM_GRID_PAGE_SIZE` pagination, same keyboard-grid-focus/Tab/
    arrow-key wiring Build/Gear already use (`currentGridItems`,
    `moveGridFocus`, `refreshGridFocusVisual`, `refreshPageNav`,
    `turnGridPage`, `toggleKeyboardFocus`, `selectHeroByIndex` — all
    extended with new branches, none of the existing building/equipping
    behavior touched). A tile click while a debug mode is active spawns
    the selected enemy there, paints the selected terrain there, or
    toggles the selected status on whatever hero/enemy occupies it —
    mirroring Build mode's own "stay in this mode across repeated clicks
    until Done/Esc" pattern exactly.
  - **Terrain painting has NO placement validation** (no occupancy/
    buildability check) — a deliberate debug-tool simplification. Mutates
    `GameMap.data.tiles` directly (the same mutable array every system
    already holds a reference to) and repaints the one `tileRects` entry,
    mirroring `tickDynamicTerrain`'s own live single-tile repaint exactly.
  - **A small real gap fixed as a side effect**: `buildBoard`'s per-tile
    pit "✕" glyphs were previously untracked (fire-and-forget `Text`
    objects with no reference kept anywhere) — now stored in a new
    `pitGlyphs` map so the debug terrain-painter can find and destroy one
    if a tile is repainted away from "pit". Dynamic-terrain-driven pit
    glyphs remain untracked, same as before this session — no real map's
    authored dynamic-terrain events ever turn a pit back into something
    else, so that half of the gap was never actually reachable and wasn't
    touched.
  - Tests: 1251 → **1253** (+2: `WaveSystem.setNoFail`/`forceEndWave`/
    `spawnAt` cases in `tests/waves.test.ts`; `Hero`/`Enemy.removeStatus`
    cases in `tests/heroStatusEffects.test.ts`/`tests/statusEffects.test.ts`).
    No new test for the `BattleScene` UI wiring itself — consistent with
    this project's standing convention that `BattleScene` isn't
    unit-tested; every piece of real logic it calls into (`WaveSystem`,
    `Hero`/`Enemy`) is tested directly above.
- **Not built, permanently (deliberate simplifications, not oversights):**
  - **No duration picker for debug status assignment** — a fixed long
    duration plus toggle-off-with-a-second-click covers "free assignment"
    without a second UI control.
  - **No placement validation on the terrain painter** — a debug tool,
    tester's own responsibility; painting under a hero/structure/enemy is
    expected to "just work."
  - **Skip Wave awards no reward gold** — a bypass, not a real clear, by
    design.
- **No browser available in this environment** — every piece of this
  session's real logic (`WaveSystem`'s three new members, `Hero`/
  `Enemy.removeStatus`) has direct unit-test coverage; the `BattleScene` UI
  wiring (the corner button, the modal menu, the three picker grids, tile-
  click routing) is presentation-only and has NOT been seen on-screen — see
  the new KI-091 for the full in-browser checklist.
- **Last complete milestone:** Phase 6 (`v0.1.1`) through Phase 25 (D-116);
  D-117 through D-137; D-138 (this session — Test Mode). Phase 12 still has
  no live board sync. `BattleScene`'s own visual restyle (carried forward
  from D-123) still has not started.
- **Git branch:** no git in this environment; Kevin manages branching in
  GitHub Desktop. This session's changed files:
  `src/game/systems/WaveSystem.ts`, `src/game/entities/Hero.ts`,
  `src/game/entities/Enemy.ts`, `src/game/scenes/FreePlayScene.ts` (three
  exports widened, no behavior change), `src/game/scenes/MainMenuScene.ts`,
  `src/game/scenes/CharacterCreationScene.ts`, `src/game/scenes/BattleScene.ts`,
  `src/main.ts`; new file `src/game/scenes/TestModeScene.ts`; test changes
  in `tests/waves.test.ts`, `tests/heroStatusEffects.test.ts`,
  `tests/statusEffects.test.ts`; docs (`DECISIONS.md`, `KNOWN_ISSUES.md`,
  `CHANGELOG.md`, `PROJECT_STATUS.md`, this file). No git commit/tag made
  here.
- **Date:** August 17, 2026

## Why this batch was chosen

Kevin explicitly asked for this, and it closes KI-085's feature-request list
entirely — every other item on it (Starting Level, the level-up planner,
damage types, the spell-prep economy) had already shipped across prior
sessions. Before writing any code, two genuine architecture forks were
surfaced and answered directly (matching this project's standing D-070/
D-078/D-113 practice for a system this size): where Test Mode is entered
from, and what "manual enemy/terrain placement" actually means. Both were
answered toward the more complete option — a dedicated entry point and a
live in-battle spawner — consistent with Kevin's established pattern of
picking the bigger/more-complete option on a scope fork.

## What works now

- Everything from every prior phase through D-137, unchanged.
- A "Test Mode" button on the Main Menu opens a minimal, ungated map/wave-
  count picker, then the normal Character Creation flow (any Starting Level,
  any party composition).
- In a Test Mode battle only, a "Debug Menu (F9)" button opens a menu with:
  **Skip Wave** (force-clears the current wave, no reward gold, then runs
  the normal post-clear continuation); **No-Fail Stronghold** (a toggle —
  integrity still visibly changes, the run just can't end in Defeat via
  integrity loss while it's on); **Spawn Enemy** (pick any of the full
  enemy roster, then click any tile, repeatedly, to spawn real, fully
  functional enemies on demand); **Paint Terrain** (pick any terrain type,
  then click any tile, repeatedly, to repaint it — no placement checks);
  **Set Status** (pick any status effect, then click a hero/enemy tile to
  toggle it on or off).
- Every one of these tools is invisible and inert on every other entry
  point into a battle — `this.testMode` defaults `false` everywhere else.
- All headless verification (typecheck/tests/build) passes; nothing here
  has been confirmed on-screen yet (see KI-091).

## What changed

- **`src/game/scenes/TestModeScene.ts`** (new): the Test Mode entry-point
  scene.
- **`src/game/scenes/MainMenuScene.ts`**: one new button.
- **`src/game/scenes/FreePlayScene.ts`**: `MAP_OPTIONS`, `EXPANDED_MINIONS`,
  and the `GatedOption` interface are now exported (were module-private) —
  no behavior change to Free Play itself.
- **`src/game/scenes/CharacterCreationScene.ts`**: `testMode?: boolean`
  field, read in `init()`, forwarded into its own `BattleScene` `scene.start`
  call.
- **`src/game/systems/WaveSystem.ts`**: `setNoFail`, `forceEndWave`,
  `spawnAt` — see D-138 for the exact mechanics.
- **`src/game/entities/Hero.ts`/`src/game/entities/Enemy.ts`**:
  `removeStatus(id)`.
- **`src/game/scenes/BattleScene.ts`**: `testMode?: boolean` on `init()`;
  three new `Interaction` kinds; a debug toolbar/modal menu; three new
  picker grids sharing the Shop/Gear grid's footprint; tile-click routing
  for all three debug modes; a tracked `pitGlyphs` map (was untracked
  before this session).
- **`src/main.ts`**: registers `TestModeScene`.
- **Tests**: new cases in `tests/waves.test.ts`,
  `tests/heroStatusEffects.test.ts`, `tests/statusEffects.test.ts` — see
  "Completed this session" for the exact list.
- **Docs**: `DECISIONS.md` (new D-138), `KNOWN_ISSUES.md` (new KI-091;
  KI-085's stale debug-mode bullet marked BUILT), `CHANGELOG.md` (new
  entry), `PROJECT_STATUS.md` (new top section), this file (rewritten).

## Important files

- **`DECISIONS.md`'s D-138** — the complete design rationale (why terrain
  painting skips validation, why status assignment is toggle-based instead
  of a duration picker, why Skip Wave awards no gold) — read this before
  touching Test Mode again.
- **`src/game/scenes/BattleScene.ts`'s `Interaction` union and
  `setInteraction`** — the three new debug kinds slot into the exact same
  state machine Build/Gear/every aiming mode already uses; any new debug
  tool should follow the same pattern (a new `Interaction` kind, a branch
  in `handleClick`, a picker grid built via `buildItemGrid`) rather than a
  bespoke mechanism.
- **`src/game/systems/WaveSystem.ts`'s `spawnAt`/`forceEndWave`** — the one
  place a debug spawn/skip's mechanics live; any future debug hook into
  wave state should extend this class, not duplicate its bookkeeping
  (`active`/`nextInstance`/`spawnedCounts`) elsewhere.

## Commands verified

- `npm run typecheck` — pass.
- `npm test` — pass, **1253/1253** (up from 1251 — 2 new tests).
- `npm run build` — pass, **118 modules** (up from 117 — the new
  `TestModeScene.ts`).
- `npm run dev` — not re-checked this session.

## Manual tests completed

**None this session — no browser available.** Every piece of this
session's pure logic (`WaveSystem.setNoFail`/`forceEndWave`/`spawnAt`,
`Hero`/`Enemy.removeStatus`) has direct unit-test coverage; the entire
`BattleScene` UI surface (corner button, modal menu, three picker grids,
tile-click routing, hint text) is new Phaser presentation code that has
never been seen on-screen. See KI-091 for the complete in-browser checklist
— this is a large enough UI surface that it genuinely needs Kevin's own
pass before it can be called done.

## Known issues

- No new bugs opened this session (nothing confirmed broken, since nothing
  has been run in a browser yet).
- **KI-091** (new): Test Mode's entire in-battle debug toolbar/menu/picker
  grids are unconfirmed in a browser — see `KNOWN_ISSUES.md` for the full
  checklist.
- Everything before, unchanged.

## Deferred items

- **KI-085's feature-request list is now fully closed** — Test Mode was its
  last remaining large item.
- Nothing new deferred this session — every capability Kevin asked for
  (playable at any level, no-fail stronghold, free status assignment,
  wave-skip, manual enemy/terrain placement) was built, using the two
  scope-fork answers he gave directly.
- Everything already deferred from D-117 through D-137 — untouched this
  session.

## Decisions made

- **D-138** — Test Mode: a dedicated `TestModeScene` Main Menu entry point,
  `WaveSystem.setNoFail`/`forceEndWave`/`spawnAt`, `Hero`/
  `Enemy.removeStatus`, and a live in-battle debug menu (Skip Wave, No-Fail
  Stronghold, Spawn Enemy, Paint Terrain, Set Status). See `DECISIONS.md`
  for the complete method and every deliberate simplification.

## Content or license additions

None new this session — no new spells/items/enemies/heroes were added; this
is entirely new tooling/systems code, no SRD-derived content.

## Next chat instructions

1. **No specific follow-up is required** — KI-085's list is now fully
   closed, and this session's own scope (a debug/test mode) is complete as
   asked.
2. **Kevin's next browser pass should include Test Mode** — see KI-091's
   checklist. If he finds a real layout collision (the corner button, the
   modal menu, or a picker grid overlapping something), that's the first
   thing to fix; this session's placement choices were made carefully but
   without any way to see them rendered.
3. **If Kevin wants per-status duration control in the debug Set Status
   tool**, or wants Skip Wave to award reward gold after all, both are
   small, targeted changes to `handleDebugStatusClick`/`debugSkipWave`
   respectively — confirm the exact behavior wanted first, since both were
   deliberate simplifications, not oversights.
4. **With KI-085 fully closed**, the next large open item is `BattleScene`'s
   own full visual restyle (carried forward from D-123) — worth asking
   Kevin directly whether that's next, per this project's standing
   practice for a system that size.

## Suggested git steps (not run here; use GitHub Desktop)

1. This session's diff spans one new scene file, six modified source files,
   three modified test files, and five doc files — one coherent feature;
   safe as a single commit.
2. Kevin's site was last confirmed current as of D-128/D-129/D-130's report
   (D-131 through D-138 haven't been pushed/confirmed live yet per prior
   handoffs) — this diff is a normal next push whenever convenient,
   alongside those if they haven't gone out yet.

## Handoff package contents

- [x] Source files (see "What changed" above)
- [x] package.json / package-lock.json (unchanged — no new deps)
- [x] README.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new top section)
- [x] DECISIONS.md (updated — new D-138)
- [x] KNOWN_ISSUES.md (updated — new KI-091; KI-085's stale bullet fixed)
- [x] CHANGELOG.md (updated — new entry)
- [x] CONTENT_SOURCES.md (unchanged — no new content this session)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PHASE_HANDOFF.md (this file, rewritten)
- [x] Tests (1253, up from 1251 — 2 new tests)
- [x] No node_modules, dist, secrets, or service-account credentials
