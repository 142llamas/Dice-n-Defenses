# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-146** — two
  pieces: (1) Enemy AI/Movement Redesign step 7, §3's AoE half: smart
  breath-weapon positioning for high-tier AoE enemies, and (2) a NEW
  mechanic Kevin raised in the same session, not originally part of the
  redesign spec — self-defense (provoked retaliation), so an enemy that's
  absorbing hits from a hero while doing something else (bashing a wall,
  disarming a trap) fights back instead of ignoring its attacker.
- **Date:** August 20, 2026 (same day as D-145). Continues the Enemy
  AI/Movement Redesign sessions of August 19 (D-139 through D-143) and
  earlier today (D-145) at the suggested next step; D-144 (drag-and-drop
  hero move) remains a separate, unrelated feature still awaiting Kevin's
  own in-browser pass (KI-095) — nothing here touches or depends on it.
- Tests: 1292 → **1299** (+7, all in `tests/enemyEngagementRedesign.test.ts`).
  Typecheck, all 1299 tests, and the production build (119 modules,
  unchanged — no new files) all pass. `npm run dev` was NOT re-checked this
  session — the only rendering-layer touch is a one-line addition inside an
  existing function (`BattleScene.showHeroHit`), no new input/rendering
  wiring.

## D-146: smart AoE positioning + self-defense — what it is

Read **D-146** in `DECISIONS.md` for the full write-up. In short:

**Smart AoE/breath positioning** (closes the redesign's last pure-systems
piece, §3's AoE half):

- **`WaveSystem.qualifiesForSmartPositioning`** (new, private static): true
  for an `activeDef.aoeAttack` enemy whose `role` is `"boss"` or
  `"legendary"` — reusing `role` as this project's existing tier concept.
  Minion-tier AoE enemies (Cave Drake, Frost Warden) keep the old simple
  behavior unchanged.
- **`PathfindingSystem.reachableTiles`** (new): every tile reachable within
  a movement budget, each carrying its exact cumulative distance — for
  comparing many candidate stop tiles at once (unlike `routeToNearestGoal`,
  which targets one goal). Includes the start tile itself at distance 0.
- **`WaveSystem.bestPositioningTile`** (new, private static): among those
  tiles, the one hitting the most heroes within `attackRangeTiles` at
  once — null if the best any tile can do is 1 or fewer.
- Wired as the FIRST check inside `tickEnemyPhase`'s existing
  `canEngageHeroes` block, ahead of the §1/§2 detour/hunt logic — a
  qualifying enemy with a beneficial tile walks there and fights from it,
  even when nothing was otherwise blocking its path.

**Self-defense (provoked retaliation)** — a new mechanic, not in the
original redesign spec, added at Kevin's explicit request this session:

- **`Enemy.markProvoked()`/`.isProvoked`/`.clearProvoked()`** (new): a
  single boolean, set by `BattleScene.showHeroHit` (already the one funnel
  every hero-vs-enemy landed hit passes through for its flash flourish) and
  consumed the instant that enemy's own turn in `tickEnemyPhase` begins —
  genuinely temporary, never persisted.
- **`WaveSystem.tickEnemyPhase`**: a provoked enemy (not `ignoresHeroes`)
  still within a hero's attack range on its own turn fights that hero
  instead of its usual unconditional priority action (siege wall, trap
  disarm) — checked BEFORE those branches, then reverts to normal priority
  the very next phase. No movement, no chase — attacks from wherever it
  already stands, matching Kevin's literal ask.
- **`ignoresHeroes` is the exemption** Kevin explicitly asked for (an "uber
  powerful siege monster that literally doesn't care about the heroes at
  all") — the existing pure-runner flag, reused as-is.

**Next chat**: no browser pass is strictly required to verify the LOGIC
(pure `WaveSystem`/`Enemy`/one-line `BattleScene` hook, fully covered by
`tests/enemyEngagementRedesign.test.ts`'s new blocks), but the resulting
gameplay FEEL — does a legendary's breath attack visibly reposition to
catch multiple heroes, does a sieging enemy visibly turn and hit back when
attacked — needs Kevin's own pass eventually. See **KI-097** in
`KNOWN_ISSUES.md` for the checklist.

## The Enemy AI/Movement Redesign is now closed except for one piece

Every piece of the original design-session spec is now built EXCEPT:

#### §4's last piece — Hero-side split-movement UI (the only step needing a browser pass)

- The player needs a way to move partway, attack, then move again — touches
  `BattleScene`'s input/turn-sequencing, not just the systems layer.
  Sprint's hero-side half (a UI button) belongs here too.
- Build the underlying numeric remaining-budget tracking on `Hero` TOGETHER
  WITH this UI, not before it (the "no dead scaffolding" precedent).
- **Worth noting**: D-144's drag-and-drop work already added real
  multi-waypoint routing (`MovementSystem.routeThroughWaypoints`) and a
  tween-based `moveHeroToken` — whoever builds this piece should check
  whether either is directly reusable here, rather than duplicating them.
  D-145's `bestWallTarget`/D-146's `bestPositioningTile` (both "evaluate
  several candidates, walk toward the best one via `routeToNearestGoal` +
  `walkAlongRoute`, letting the walk stop naturally at the first real
  blocker") may also be a useful reference for how a hero-side "move, then
  commit to attacking from wherever you land" step could be structured,
  though the hero side has its own existing `MovementSystem`/`showRange`/
  `showPath` machinery that isn't a direct parallel.

If Kevin wants MORE self-defense/retaliation depth beyond what D-146 built
(e.g. a numeric aggro score instead of a one-shot boolean, or a provoked
enemy that chases rather than only fighting when already in range), that
would be a fresh, separate design decision — D-146's own writeup in
`DECISIONS.md` explains why the simpler one-shot-flag/in-range-only version
was chosen (it's what Kevin literally described, and matches this
project's "flat, untuned first-pass" convention for every other AI
behavior number).

## Important files

- **`src/game/systems/WaveSystem.ts`** (D-146) — new
  `qualifiesForSmartPositioning`/`bestPositioningTile` (private static),
  the smart-positioning branch inside the `canEngageHeroes` block (now also
  gated `&& !forcedFight`), the new `hasProvokedTarget` computation +
  `enemy.clearProvoked()` call right after the per-enemy loop's hoisted
  variables, and `&& !hasProvokedTarget` added to the siege/`trapSense`
  priority branches' conditions.
- **`src/game/systems/PathfindingSystem.ts`** (D-146) — new
  `reachableTiles` method.
- **`src/game/entities/Enemy.ts`** (D-146) — new private `provoked` field
  plus `isProvoked`/`markProvoked`/`clearProvoked`. Deliberately NOT part
  of `EnemySnapshot` (same documented imprecision as `WaveSystem`'s other
  per-instance timers).
- **`src/game/scenes/BattleScene.ts`** (D-146) — one new line inside the
  existing `showHeroHit` method (`enemy.markProvoked()`); no other call
  site touched, no new call sites added.
- **`tests/enemyEngagementRedesign.test.ts`** (D-146) — two new describe
  blocks: `§3 (D-146): smart AoE/breath positioning for high-tier enemies`
  (3 tests) and `Self-defense (D-146): a provoked enemy retaliates instead
  of continuing its priority action` (4 tests).

## Commands verified

- `npm run typecheck` — clean.
- `npm test` — **1299/1299** passing (1292 → 1299, all new tests in
  `tests/enemyEngagementRedesign.test.ts`).
- `npm run build` — production build succeeds, 119 modules (unchanged).
- `npm run dev` — NOT re-checked this session (no input/rendering wiring
  changed beyond the one-line `showHeroHit` addition).

## Manual tests completed

None — pure `src/game/systems/`/`src/game/entities/Enemy.ts` work plus one
line inside an existing `BattleScene.ts` method, fully covered by the new
automated tests. The gameplay FEEL still needs Kevin's own in-browser
pass — see **KI-097**'s checklist in `KNOWN_ISSUES.md`.

## Known issues

- **KI-097** (new, D-146): smart AoE positioning's and self-defense's
  gameplay feel are not yet confirmed by Kevin.
- Everything else unchanged from D-145's handoff (KI-096/KI-095/KI-094/
  KI-093/KI-092 and everything before them) — in particular, **D-144's
  drag-and-drop hero move (KI-095) is still Kevin's oldest outstanding
  in-browser checklist** and is completely independent of this session's
  work; either thread can be picked up next.

## Deferred items

Only the hero-side split-movement UI (§4's last piece) remains unbuilt from
the original Enemy AI/Movement Redesign spec — see above. If Kevin wants
deeper self-defense mechanics (a numeric aggro score, a provoked enemy that
chases rather than only fighting in-range), that's a fresh design decision,
not something this session self-scoped into.

## Decisions made

**D-146** — logged in full in `DECISIONS.md`. Per this project's
convention, log a new D-NNN as each further piece ships, whichever thread
(the hero-side split-movement UI, deeper self-defense, or a D-144 follow-up
once Kevin has playtested it) gets picked up next.

## Content or license additions

None — D-146 added no new spells/items/enemies/heroes, and no new
`EnemyDefinition` data fields (self-defense reuses the existing
`ignoresHeroes` flag for its opt-out; smart positioning reads the existing
`role`/`aoeAttack` fields rather than adding a new one).

## Next chat instructions

1. **Ask Kevin which thread he wants continued** if it isn't obvious from
   context — the hero-side split-movement UI (§4's last piece, needs a
   browser pass to build), D-144's own in-browser confirmation pass (still
   outstanding from two sessions ago), or feedback on this session's D-146
   work once Kevin has played it, are all independent of each other.
2. **If continuing with new AI/systems work**: the Enemy AI/Movement
   Redesign's original spec is fully closed except the hero-side UI piece —
   there's no more "next step" to look up in this document; any further AI
   work would be a fresh ask from Kevin.
3. **If Kevin reports feedback on D-146 (smart positioning or
   self-defense)**: check `KNOWN_ISSUES.md`'s KI-097 checklist first for
   what was already flagged as worth a specific look.
4. **If Kevin reports feedback on D-145 (siege wall-targeting)**: check
   KI-096's own checklist first.
5. **If Kevin reports feedback on D-144 (the drag-and-drop move, still
   unplayed as of this handoff)**: check KI-095's own checklist first.
6. **Log a new D-NNN as each further piece ships**, per this project's
   standing convention.

## Suggested git steps (not run here; use GitHub Desktop)

Commit `src/game/systems/WaveSystem.ts`, `src/game/systems/PathfindingSystem.ts`,
`src/game/entities/Enemy.ts`, `src/game/scenes/BattleScene.ts` (all D-146);
the updated test file (`tests/enemyEngagementRedesign.test.ts`); and the
doc updates (`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`,
`PROJECT_STATUS.md`, this file).

## Handoff package contents

- [x] Source files: `src/game/systems/WaveSystem.ts`,
      `src/game/systems/PathfindingSystem.ts`, `src/game/entities/Enemy.ts`,
      `src/game/scenes/BattleScene.ts` (all modified, no new files)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-146 appended)
- [x] KNOWN_ISSUES.md (updated — KI-097 added)
- [x] CHANGELOG.md (updated — a new Unreleased section)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PROJECT_STATUS.md (updated — the Enemy AI Redesign section folded D-146
      in and moved to the top; D-144's own section otherwise unchanged)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: 1292 → 1299 (+7 total this session)
- [x] No node_modules, dist, secrets, or service-account credentials
