# Decisions

Permanent design and architecture decisions. New chats should read this before
changing structure. Do not reverse a LOCKED decision without Kevin's approval.

## Phase 0 decisions

### D-001 — Tooling: Phaser 3 + Vite + TypeScript, no UI framework
Matches the Source of Truth. No React/Vue/Svelte/Angular. Kept deliberately minimal
so the game loop and rules engine stay the focus.

### D-002 — Test runner: Vitest
Chosen because it shares Vite's configuration and runs TypeScript with no extra
setup. Tests run in a Node environment (no browser) so pure logic can be tested
without rendering, satisfying the "logic testable without visuals" rule.

### D-003 — Vitest pinned to v3
The initial install pulled Vitest 2.x, whose bundled older Vite carried transitive
`esbuild` security advisories. Upgrading to Vitest 3 cleared them (`npm audit` reports
0 vulnerabilities). No functional impact.

### D-004 — Strict TypeScript
`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, and
`noFallthroughCasesInSwitch` are enabled. Fixes real mistakes early. Avoid `any`.

### D-005 — Fixed internal resolution 1280 x 720, scaled with Phaser.Scale.FIT
Game math uses a fixed logical size; the canvas scales to fit the browser while
preserving aspect ratio. Desktop-first, per the Source of Truth. This satisfies the
acceptance criterion that grid clicks map to the correct tile at different browser
sizes (Phaser converts pointer positions back into game-space coordinates).

### D-006 — Grid logic lives in a pure `GridSystem` class, separate from scenes
Coordinate conversion, bounds checking, and grid helpers have no Phaser dependency.
This is the reference pattern every later system (movement, pathfinding, building
validation, combat) should follow: rules in `systems/`, rendering in `scenes/`.

### D-007 — `base: "./"` in Vite config
Produces relative asset paths so the built game works from a subfolder and will
drop cleanly onto Firebase Hosting later without path surprises.

### D-008 — Placeholder map data kept in a data file
`src/game/data/placeholderMap.ts` holds spawn/exit/marker positions instead of
hardcoding them in the scene, establishing the data-driven content pattern early.

### D-009 — `.ts` extensions allowed in imports
`allowImportingTsExtensions` + `isolatedModules` are on to keep imports explicit
under Vite's bundler resolution. Type-only imports use `import type`.

## Phase 1 decisions

### D-010 — Maps are data, authored as "string art"
The test map lives in `src/game/data/testMap.ts` as an array of equal-length
strings with a small legend (`.` floor, `#` wall, `S/X/H/E` special). A parser
turns it into a `ParsedMap`. This keeps content data-driven and easy for a
non-programmer to edit, and gives a clean seam for real map files (maps.json) later.
The parser throws on ragged rows or unknown characters to catch typos early.

### D-011 — Map queries live in a pure `GameMap` system
`GameMap` (no Phaser) answers tile-type, walkable/blocked, role, and selectable
questions. Rendering stays in `BattleScene`. This is the same logic/visual split
as `GridSystem` and is where Phase 3 pathfinding will attach.

### D-012 — Grid dimensions moved from config to the map
`config.ts` no longer hardcodes columns/rows. The loaded map defines its size and
the scene centres it on screen. Adding a bigger/smaller map no longer requires
editing config.

### D-013 — "Invalid tile" = off-map OR wall
For Phase 1 selection, a tile is selectable only if it is in bounds and is floor.
Clicking a wall or off the grid is rejected (brief red flash) and does NOT change
the current selection. This makes the acceptance criterion directly demonstrable.

### D-014 — Phase 0's hero-move interaction was replaced, not kept
Phase 0 let you click the hero and move it anywhere. That was an explicit Phase 0
placeholder (see old KI-003). Phase 1 replaces it with proper tile selection,
because unrestricted movement belongs to the Phase 2 turn/movement system. Tokens
are now display-only until Phase 2 adds real movement rules.

### D-015 — No camera pan/zoom added
The board fits the 1280x720 canvas, which scales to the window. Pan/zoom was not
in the Phase 1 in-scope list and would be an unrequested feature, so it was not
added. Tile mapping is already correct at any window size via scale-aware pointer
coordinates.

## Phase 2 decisions

### D-016 — Four-directional movement, cost 1 per tile
Heroes move up/down/left/right, one tile per step (no diagonals). This matches
the `GridSystem.manhattanDistance` helper already in the codebase and keeps
range and path math simple and predictable. If diagonal movement is wanted
later it is a deliberate design change, not an accident. `MovementSystem` is the
single place this rule lives.

### D-017 — Movement legality is a pure `MovementSystem`, rendering stays in the scene
Per the Phase 1 handoff. `MovementSystem` (no Phaser) computes reachable tiles
(BFS within a budget), shortest paths, and a legality check by asking
`GameMap.isWalkable`. `BattleScene` only draws the results. This is the same
logic/visual split as `GridSystem` and `GameMap`, and it is where Phase 3 enemy
pathfinding will attach (the BFS pattern generalises to enemy routing).

### D-018 — Units block movement (provisional Phase 2 default)
A hero cannot move onto or through a tile occupied by another unit (another hero
or an enemy). Occupancy is passed into `MovementSystem` by the scene, so the
system stays independent of who is on the board. This is the minimum needed for
sane movement and is a DEFAULT, not a LOCKED rule. It is related to the still
**OPEN** Source-of-Truth item "Hero collision — do heroes block, engage, or
allow passage?"; that question (especially heroes vs. enemies and engagement)
remains open and will be settled when combat and enemy movement exist.

**Update (D-067):** refined, not reversed — another HERO's tile is no longer a
full block. A hero may walk through a tile another hero occupies but may never
end its move there. Heroes vs. enemies (and walls) are unaffected: still a full
block in both directions, unchanged from this original decision.

### D-019 — MVP turn economy: one move + one action, action slot deferred
A hero has one move and one action per turn (Source of Truth "movement plus one
action"). Phase 2 fully implements the MOVE. The ACTION slot exists and resets
each turn on the `Hero` entity, but nothing consumes it yet because the action
itself (attacks, abilities) is Phase 4. Bonus actions, reactions, and readied
actions are deferred per the phase boundary. Modelling one move as "move up to N
tiles, once" (rather than tile-by-tile spending) keeps confirm/cancel simple and
makes "cancel restores prior state" exact: state changes only on `Hero.moveTo`.

### D-020 — Empty phases auto-advance in Phase 2
There is no combat, enemy movement, or wave outcome yet, so the enemy,
resolution, and between-wave phases have no work to do. To make the ordering
visible and keep the loop moving, the scene schedules a single short timer on
entering each of those phases and then advances. Because `TurnSystem.onChange`
fires exactly once per transition, each auto-advance is scheduled exactly once.
Phase 3+ will replace these timers with real per-phase work.

### D-021 — Version-neutral page title; menu subtitle tracks the phase
`index.html`'s `<title>` was "Fantasy Tower Defense (Phase 0)" and had gone
stale. It is now just "Fantasy Tower Defense" so it never needs a per-phase edit.
The `MainMenuScene` subtitle is the one intentional place that names the current
phase for a human running the build.

### D-022 — Build chunk-size warning limit raised to 2000 kB
Phaser alone is ~1.5 MB, so the single production bundle sits just above the old
1500 kB warning threshold and will keep growing. The limit was raised to 2000 kB
so the build output stays clean for a non-developer. This is cosmetic only; real
code-splitting remains deferred to the hosting phase (KNOWN_ISSUES KI-005).

## Phase 3 decisions — Enemy Pathfinding and Wave Movement

### D-023 — Enemy routing is a separate `PathfindingSystem`, not part of `MovementSystem`
The Source of Truth architecture lists both `MovementSystem` and
`PathfindingSystem`. They answer different questions: `MovementSystem` computes
which tiles a hero can reach within a small budget (with a specific clicked
destination); `PathfindingSystem` computes the full shortest route from an enemy
to the nearest of several exits with no budget cap. Keeping them separate keeps
each one small and testable rather than overloading one class with two jobs.

### D-024 — Enemies path around walls only; they ignore unit occupancy (for now)
Enemy routing treats walls as the only obstacles and ignores heroes/other
enemies. This guarantees a route to the exit always exists and prevents deadlocks
before combat exists. It also matches the still-OPEN "Hero collision" question in
the Source of Truth: whether heroes block, engage, or let enemies pass is a
combat-era decision (Phase 4), so Phase 3 deliberately does not let a hero body-
block the lane. `PathfindingSystem` already accepts an optional `isBlocked`
predicate, so a later phase can turn on unit-blocking without a rewrite.

### D-025 — Placeholder `E` enemy-start markers retired from the test map
In Phases 1–2, `E` tiles rendered as static placeholder enemy tokens. Now that
real enemies spawn from the `S` spawn point and march to `X`, those static tokens
are redundant and confusing, so they were removed from `testMap.ts` (the `E`
character is still parsed for possible future maps, just unused here). Heroes now
flank an open lane, which sets up nicely for Phase 4 attacks.

### D-026 — Starting Stronghold Integrity = 20 (a balance value in config)
`STRONGHOLD_START` lives in `config.ts`, not scene code, so it is a data-driven
balance knob. 20 is tuned so a human tester sees several full waves, breaches,
wave transitions, and finally a defeat within one sitting.

### D-027 — Phase 3 honestly ends in defeat; victory is wired but unreachable yet
With no combat (Phase 4) there is no way to stop enemies, so every enemy
eventually breaches and Stronghold Integrity falls to zero. Rather than fake a
win, the shipped balance ends in **defeat** and this is documented as the
expected outcome. The victory path is fully wired (all waves cleared with
Integrity > 0) and becomes reachable once combat exists. This follows operating
instruction #8: do not claim success that has not actually happened.

### D-028 — `resolution` may loop back to `player` within a wave
A wave spans several turns (enemies spawn and march over multiple phases), so the
turn machine needed `resolution -> player` in addition to
`resolution -> betweenWave / victory / defeat`. `betweenWave` now only occurs when
a wave actually completes. The Phase 2 auto-advance behaviour is replaced by
explicit, tested decisions in the scene's `resolvePhase()`.

### D-029 — `BattleScene` resets all mutable fields in `create()`
Phaser reuses the scene instance across restarts, so returning to the menu and
starting again would otherwise accumulate stale heroes/tokens. `create()` now
clears every mutable field first. This pre-empts the restart-cleanliness concern
that the Source of Truth flags for Phase 6.

## Phase 4 decisions — Combat MVP

### D-030 — Deterministic combat (resolves the OPEN "dice visibility" item for the MVP)
There is no to-hit roll. A valid target in range is always struck for a
predictable amount: `damageDealt = ignoreDefense ? damage : max(1, damage −
defense)`. This directly serves the "turns must be readable" pillar — the player
can always see why an action succeeded and exactly what it will do — and lets
tactics be planned precisely, which suits a tower-defense/tactics hybrid where
the Source of Truth already moved *away* from Armour-Class semantics (Stronghold
Integrity is HP, not AC). The Source of Truth "dice visibility" item is therefore
resolved as **deterministic, no dice shown** for the MVP; it can be revisited if
playtesting wants more variance.

### D-031 — Action economy: one move + one action, either order
A hero has one MOVE and one ACTION per turn (Source of Truth "movement plus one
action"). The single action is a basic attack OR an ability. Move and action are
independent and may be taken in either order (move-then-act or act-then-move),
which is the "explicit order" the DEFAULT rule asks for and keeps play flexible.
Bonus actions, reactions, and readied actions remain deferred per the boundary.

### D-032 — Grunt = melee behaviour, Runner = ranged behaviour
Phase 4 requires "one melee enemy behaviour and one ranged enemy behaviour."
Rather than add a third enemy (outside the phase's content), the two existing
enemies now differ: the Grunt keeps `attackRangeTiles: 1` (melee) and the Runner
becomes `attackRangeTiles: 2` (a fast, fragile ranged skirmisher). This is a
DEFAULT balance/behaviour choice; ids and names are unchanged so Phase 3 tests
still pass. An enemy that has a hero in reach attacks and holds position rather
than also moving, which keeps each enemy phase readable.

### D-033 — Heroes block enemy routes (resolves the OPEN "Hero collision" item)
Now that combat exists, the Source-of-Truth "Hero collision" question is settled:
**living heroes block enemy movement.** The scene passes an `isBlocked`
predicate (living-hero tiles) into the enemy phase, so enemies route around
heroes (using the predicate `PathfindingSystem` already accepted — no rewrite).
Combined with enemies attacking blockers (D-032), body-blocking the lane is now a
real, costed tactic. Enemies still do **not** block each other (avoids traffic
jams / deadlocks and keeps routing deterministic). Exit tiles remain always
enterable, so a hero cannot seal the exit tile itself. This supersedes the
Phase 3 provisional "enemies ignore occupancy" default (old D-024 / KI-009).

### D-034 — Heroes have HP and can be defeated, but hero death is NOT a loss
Heroes now have hit points and can be attacked. A hero reduced to 0 HP is removed
from the board (once). Crucially, this is **not** a second loss condition: the
loss condition remains LOCKED to Stronghold Integrity = 0. If every hero falls,
enemies simply breach freely and Integrity reaches 0 in the normal way (the same
outcome the "do-nothing" integration test already models). Keeping a single loss
condition respects the LOCKED rule and avoids inventing new game-over rules.
Heroes take full damage (no hero defense stat yet); that can be added later.

**Update (D-068, reversed — not a refinement):** Kevin explicitly asked, in
chat, for a wiped party to also end the run. This is a genuine reversal of
this decision's central LOCKED claim, done on Kevin's direct request (the
bar CLAUDE.md sets for touching a LOCKED decision). See D-068.

### D-035 — Hero definitions promoted to a data file
Phase 2 kept the two hero definitions inline in `BattleScene`. Because heroes now
carry combat identity (health, a basic attack, an ability), those definitions
moved to `src/game/data/heroes.ts`, matching the Source of Truth folder structure
and operating instruction #4 ("keep rules and content data-driven"). The scene
reads `HERO_DEFINITIONS`; balance is edited in data, not scene code.

### D-036 — RandomService deliberately deferred (no dead code)
The Phase 3 handoff suggested adding a seedable RandomService. Because combat is
deterministic (D-030), there is no random roll to seed, so adding the service now
would be unused infrastructure — which operating instruction #3 warns against.
The service will be introduced by the first phase that adds a genuine random
element, together with a real consumer. Deterministic combat is trivially
deterministic in tests, which was the original motivation for the service.

### D-037 — Economy, building, and rewards are separate pure systems
Phase 5 rules live in three new pure systems — `EconomySystem` (the gold
balance), `BuildSystem` (placement rules), and `RewardSystem` (reward
arithmetic) — with `BattleScene` only rendering and wiring them, per the Source
of Truth ("rules independent from visuals", operating instruction #5). Gold is
held in one place (single authoritative state), so the "purchases update gold
once" guarantee is a single `spend` call per purchase.

### D-038 — A wall may never seal the last spawn→exit route
Implements the Source of Truth DEFAULT ("construction is rejected if no valid
path remains"). `BuildSystem.canPlace` runs a `PathfindingSystem` check that
every spawn still reaches an exit with the tentative wall added, considering
**walls only** — not transient hero/enemy positions, since units move. Traps do
not block and skip this check. This keeps enemies from ever being fully sealed,
which is also why enemies never need to attack walls (see D-041).

### D-039 — Traps resolve through CombatSystem on tile entry
A trap damages an enemy that **enters** its tile during the enemy phase (any tile
in the walked path, in order), applied via `CombatSystem.applyAttack` so trap
damage shares the game's deterministic combat and is unit-testable. A trap that
reduces an enemy to 0 HP stops it on that tile (it does not continue to the exit
or breach). Traps are **persistent** in the MVP (they trigger every time), and
they affect enemies only (heroes may stand on their own traps safely). Charges
or an upgrade tree are deferred past the phase boundary. An enemy that only holds
to attack (does not move) does not re-trigger a trap it is standing on.

### D-040 — Shop/building happens during the Player Phase
The Source of Truth lists the shop as a preparation/between-wave activity, but
the current `TurnSystem` transitions through `preparation` and `betweenWave`
instantly to the `player` phase (they are pass-through). Rather than re-architect
the working phase machine (out of scope and risky), Phase 5 makes building and
shopping available during the **Player Phase** — the single interactive window.
This preserves all turn tests and still delivers the fighting-building-spending
loop. A dedicated dwell-time shop phase can be added later without changing the
build rules; revisit in Phase 6/8.

### D-041 — Provisional wave turn limits; structure destruction stays OPEN
`waves.ts` now carries `turnLimit` values so the "optional turn-limit bonus" is
reachable, but these numbers are a first-pass guess made without in-browser play
testing and are flagged for tuning (KI-015); the bonus **mechanism** is unit
tested independently in `tests/rewards.test.ts`. The OPEN "structure destruction"
question (when enemies may attack walls) is intentionally **not** answered here —
because a wall can never seal the only route (D-038), enemies always route around
walls and never need to attack them in the MVP.

**Partially resolved by D-111 (Phase 20):** a SIEGE enemy now really can
attack and destroy a wall it finds within its own attack range, instead of
routing around it — see D-111 for the full mechanic. This still doesn't
answer the general question for every enemy: an ordinary (non-siege) enemy
still always routes around a wall exactly as this decision originally
described, unchanged.

### D-042 — v0.1.0 MVP ships with Phase 5 balance unchanged; the simulation IS the balancing pass
Phase 6 lists a "basic balancing pass". Rather than guess at numbers, that pass
took the form of `tests/mvp-integration.test.ts`: a headless run of all five real
waves through every system. It proves the integrated loop is **winnable** (a
sensible player clears all waves with integrity intact) and **losable** (doing
nothing reaches defeat) — the two ends of the phase's acceptance goal. The same
simulation shows that under *perfect* focus-fire play the game currently errs
**easy and gold-rich** (0 leaks, ~191 surplus gold; every wave earns the time
bonus). The gameplay numbers were nonetheless left **unchanged** for v0.1.0
because: (a) the simulation is an upper bound (perfect targeting, no movement
constraint) and cannot establish the *correct* difficulty — only in-browser play
can; (b) operating instruction #3 warns against changing working systems without
a tested reason; and (c) a forgiving economy is the right failure mode for a
first playable MVP (too little gold frustrates a new player more than too much).
Tightening (fewer completion gold, tighter turn limits, or more/tougher enemies)
is the first Phase 7 task, tracked in KNOWN_ISSUES KI-015.

### D-043 — Explicit input-listener teardown on scene shutdown
To satisfy the Phase 6 acceptance "restart does not duplicate listeners", the
BattleScene now removes its own pointer and keyboard listeners on the scene
`shutdown` event. Phaser already tears the input plugin down per scene, and all
mutable fields are reset in `create()`, so this is defensive insurance rather
than a fix for a known leak. Game-object button listeners need no handling —
they are destroyed with their objects when the scene stops. There are no global
listeners (`this.scale.on`, `window`, etc.) anywhere, which is what makes the
menu→battle→menu→battle cycle safe.

### D-044 — A hero action that clears a wave resolves immediately (early-finish)
Playtest fix: previously, if a hero's own attack/ability defeated the last enemy
of an already-fully-spawned wave, the game still made the player click End Turn
and sit through an empty Enemy Phase before Resolution noticed the wave was
clear. `TurnSystem.ALLOWED` now also permits `player -> betweenWave` and
`player -> enemy` (unchanged) `-> victory`, and `BattleScene` checks
`waveSystem.isCurrentWaveComplete()` right after any hero kill; if true, it
awards the wave reward and transitions straight to Victory/Between Waves,
skipping the pointless Enemy Phase. `player -> defeat` was deliberately NOT
added: nothing in the player phase reduces Stronghold Integrity (only a breach
does, and breaches only happen in the enemy phase), so it would be unreachable,
unused infrastructure (operating instruction #3).

### D-045 — Enemies now block each other; a blocked spawn retries instead of stacking
Playtest fix: enemies could end up standing on the same tile, both mid-lane
(routing never considered other enemies) and at the spawn point (a new enemy
could spawn on top of one still standing there). `WaveSystem` now treats every
OTHER living, un-breached enemy's CURRENT tile as blocked when computing an
enemy's route (`isOccupiedByOtherEnemy`), evaluated dynamically as the phase's
loop proceeds so each enemy reacts to already-moved neighbours. An enemy with
nowhere to go simply holds its tile that phase (queueing) rather than
overlapping — this cannot deadlock because the exit tile is always enterable
regardless of `isBlocked` (PathfindingSystem's existing rule), so the lane
always drains. Spawning uses the same check: if the spawn tile is occupied, that
scheduled spawn is retried every subsequent phase (`pendingRetry`) instead of
being silently dropped or stacked. This supersedes the note in KI-009 that
enemies deliberately don't block each other "to avoid deadlocks" — the
exit-always-enterable rule already prevents that deadlock, so blocking was safe
to add. Covered by `tests/enemyCollision.test.ts`.

**Update (D-067):** refined, not reversed — the "no two enemies ever share a
tile" invariant this decision established is still absolute, but ROUTING no
longer treats another enemy's tile as impassable. An enemy may walk through it;
only the tile it actually ends the phase's move on is checked against
occupancy (backing off a step at a time if needed). Spawn-blocking/retry is
unaffected.

### D-046 — HUD relayout: taller canvas, stacked (not side-by-side) status/log, edge-anchored buttons
Playtest fix ("text and menu items overlap all over the place"). Three
compounding causes, found by computing exact bounding boxes for the worst-case
(longest) on-screen strings rather than guessing: (1) the area below the grid
only had ~54px before the canvas edge for a status line, up to a 5-line combat
log, AND a button row — nowhere near enough; (2) the status line and combat log
sat side-by-side on the same row, so a long hint (e.g. the building-mode hint)
could run into the log regardless of spacing; (3) the centered title/banner
text could reach far enough horizontally to touch the Build/End Turn buttons,
which were positioned relative to the grid's (narrower) width rather than the
canvas edge. Fixes: `GAME_HEIGHT` raised from 720 to 900 (safe — `Scale.FIT` +
`autoCenter` in `main.ts` means the canvas is always scaled to fit the window
regardless of its logical size, so this is a purely cosmetic constant change);
status text is now centered and word-wrapped above the combat log (stacked
vertically, each with reserved height) instead of beside it; the phase-order
debug log was shortened (last 3 phases, not 6) and moved to its own row; and
the Build/End Turn buttons are now anchored to a fixed right-hand margin
instead of the grid's `originX`, freeing much more horizontal room for the
center title/banner. Verified with a bounding-box check using worst-case
content strings (no browser available in this environment) rather than typical
strings, so real content has margin to spare. Kevin's browser pass (KI-001)
should still confirm the actual on-screen result.

### D-047 — The end (victory/defeat) screen gets a real clickable button
Playtest fix ("I can't navigate past that"). The end screen previously offered
only a small "press Esc" text hint with no clickable control — easy to miss,
and it silently does nothing if the browser's keyboard focus isn't on the game
canvas, which can happen with no visible symptom other than "nothing happens
when I press a key." `showEndScreen` now adds a real "Return to Menu" button
(same `scene.start("MainMenuScene")` the Esc handler already used); Esc still
works as a shortcut. This directly serves the Phase 6 acceptance criterion that
a clean install can play from start through win/lose.

### Clarifications (playtest questions that are working as designed, not bugs)
Two playtest observations were NOT changed, to avoid silently inventing answers
to design questions the Source of Truth deliberately leaves open or already
settled:
- **Enemies don't avoid traps.** This is intentional (see D-039): pathfinding
  has no knowledge of traps, only walls/heroes, specifically so a trap can
  actually damage a passing enemy. Enemies dodging traps would make spending
  gold on them pointless. Not changed.
- **"Everything is an automatic hit."** Combat has been fully deterministic
  (no misses) since D-030, and this DECISIONS log describes that as resolving
  the Source of Truth's "Dice visibility" question for the MVP — but the
  Source of Truth's own MVP Rules Status table (§9) still lists **Dice
  visibility as OPEN**. That's a real inconsistency worth flagging rather than
  quietly perpetuating: a past chat effectively made this call by
  implementation rather than by an explicit Kevin decision. Nothing was changed
  here — adding a hit/miss system would equally be inventing an answer to an
  OPEN question without approval. Kevin should either confirm deterministic
  combat is the intended answer (and the Source of Truth table should be
  updated to LOCKED/DEFAULT) or ask a future chat to design a hit-chance system
  (which would also need the deferred `RandomService`, D-036).
  **Update (this chat):** Kevin's KNOWN_ISSUES annotation answers this — "A
  dice-based hit-chance system will be implemented later." That settles the
  question for now: combat STAYS deterministic through Phase 7 (nothing here
  changed), and a hit-chance system is explicitly a FUTURE addition, not part
  of this or any current milestone. It is out of scope for this chat (it would
  need the deferred `RandomService`, D-036, and touches every combat call
  site) — flagged here so a future chat picks it up deliberately rather than
  guessing from the old inconsistency.

### D-048 — Flying enemies ignore walls (first Phase 7 systems change)
Phase 7's one genuine engine extension (everything else in the phase is more
data on top of existing systems): the Source of Truth's `movementType` field
finally does something. A `"flying"` enemy routes **over** walls — both static
map walls and placed barricades — straight toward the nearest exit. It is still
confined to the map, and it is still stopped by **units** (heroes and other
enemies never share its tile). Ground routing is byte-for-byte unchanged.

Design intent: a flyer is the answer to "route manipulation shouldn't be the
*only* tool." Walls and barricades can't re-route it, so it must be intercepted
and killed — which is why the first flyer (`wisp`, in `data/enemies.ts`) is
deliberately fragile and low-value. The intended hard counter, an **anti-air
hazard**, is Phase 7 content that is NOT built yet (see KNOWN_ISSUES).

Implementation, kept in the pure/tested layer:
- `PathfindingSystem.RouteQuery` gains `ignoreWalls?` (default false). When set,
  `canEnter` uses `map.isInBounds` instead of `map.isWalkable`, so walls are
  flown over but the map edge still isn't. Every existing caller omits it, so
  ground routing and all prior tests are untouched.
- `WaveSystem` routes each enemy with `ignoreWalls = def.movementType ===
  "flying"`, and builds a per-enemy blocker set: for a flyer, a tile blocked
  **only** because it is a wall does not block (a new optional
  `EnemyPhaseContext.isWall` tells it which blocked tiles are walls), while a
  tile blocked for another reason (a hero) still does. Enemy-enemy collision
  (D-045) applies to both types.
- `BattleScene` passes `isWall` to the tick and draws flyers with a pale ring so
  the player can see *why* their barricades aren't re-routing that unit. The
  scene change is tiny; all the rules are in data + pure systems.

Covered by `tests/flying.test.ts` (flyer crosses a static wall a ground unit
can't; flyer passes a placed barricade a ground unit can't; flyer still confined
to the map; flyer still stopped by a hero; two flyers never stack; ground
routing regression). Not decided here: whether flyers should be blocked by
heroes at all — chosen yes for a uniform, simple collision rule; revisit if it
feels wrong in play. The `wisp` is defined but **not yet placed in any campaign
wave** on purpose (see KNOWN_ISSUES / PHASE_HANDOFF: balance tuning is Kevin's
browser task and comes first).

### D-049 — Traps are movement-type aware; the Sky Snare is flying's counter
Following straight on from D-048: giving enemies a movement type is only half a
mechanic if defenses can't respond to it. Two linked decisions:

1. **Traps target a movement type.** A trap definition may declare
   `targets: "ground" | "flying" | "any"` (default `"any"`). WaveSystem only
   applies a trap to an enemy whose type it targets. The existing **Spike Trap**
   is now `"ground"` — spikes on the floor no longer (incorrectly) bite flyers
   passing overhead. This also fixes a latent bug: before this, a flyer walking
   a trap tile took spike damage.
2. **A dedicated anti-air trap, `sky-snare` ("Sky Snare"),** targets `"flying"`
   only (KI-022's counter). Because a flyer can't be re-routed by walls, the
   Snare is how a player punishes a flight lane: place it under the path and the
   flyer takes damage crossing it, while ground units ignore it. It ignores
   defense (4 dmg) and costs 7g. All ORIGINAL content.

Implementation stays data-driven and in pure systems: the filter is a data field
(`structures.ts`), `BuildSystem.trapTargetsAt` exposes it, WaveSystem gains an
optional `EnemyPhaseContext.trapTargets` used alongside `trapAt`, and the scene
passes it. The field is opt-in and defaults to `"any"`, so every prior test
(which passes only `trapAt`) is unchanged. Covered by four new tests in
`tests/flying.test.ts` (Snare catches a flyer / ignores ground; Spike ignores a
flyer / still bites ground).

**Also this round (provisional, not a locked balance decision):** wave 5 now
spawns **one** `wisp` so flying is visible in real play and the Sky Snare has a
reason to exist on the board. This is deliberately minimal; the actual number
and spread of flyers across the campaign is Kevin's in-browser tuning call
(KI-015). The integration test (`mvp-integration.test.ts`, now honouring trap
targeting like the real scene) confirms the five-wave loop is still winnable and
losable with the flyer present.

### D-050 — Phase 7 roster expansion: four minions built as answers, not stats
The vertical slice needs "six to eight enemies." Rather than add four
interchangeable stat blocks, each new enemy is designed so an existing player
tool becomes its intended answer — which is what makes "multiple viable
strategies" (the Phase 7 acceptance criterion) real rather than nominal:

- **Brute** — a slow, high-HP, big-breach ground threat. Answer: focus fire, or
  a wall that lengthens its route so the party can catch it.
- **Swarmling** — a 2-HP unit that arrives in packs. Single-target fire can only
  delete one per turn, so the answer is area damage (Ash's Cleave) or a lane
  lined with traps. This is the enemy that gives AoE and trap-spam a purpose.
- **Warden** — high `defense`, modest HP. Ash's basic strike is reduced to a
  chip (`max(1, 4 - 3)`), so the clean answer is Wren's `ignoreDefense` pierce.
  This makes the defense stat, and armour-piercing, matter tactically.
- **Razorwing** — a tougher, faster flyer than the Wisp. It still ignores walls
  (D-048), so the answer is the Sky Snare (D-049) plus ranged fire — a real
  reason to invest in anti-air rather than treat the Wisp as a one-off.

All original content, all pure data in `enemies.ts` (op. instruction #4); no
system or scene code changed. The scene already renders any enemy by its colour
with a flying ring, so the four appear automatically.

### D-051 — Ten-wave campaign with a miniboss finale; a `role` data tag
Phase 7 calls for "ten waves and one miniboss." Decisions:

1. **Waves 1–5 are frozen.** They are the play-shaped v0.1.1 loop; re-tuning them
   now would throw away Kevin's earlier playtest findings. Waves 6–10 are new and
   layer the roster in one idea at a time (Brute → swarm → air → armour →
   finale), so each new enemy is met in a wave built to teach its counter.
2. **The miniboss is data, tagged, and unique to the finale.** `basalt-colossus`
   is an ordinary `EnemyDefinition` with an optional `role: "miniboss"` tag — no
   special engine path; combat, routing, and rewards treat it as a (beefy)
   enemy. A distinct boss *presentation* is deferred to Phase 8 UX. Tests enforce
   that exactly one miniboss exists and appears only in wave 10.
3. **These numbers are a starting point, not a balance verdict.** The headless
   simulation is an upper bound on player skill; under it the ten-wave campaign
   clears with full integrity and ends gold-rich — the *same* "errs easy /
   gold-rich" result the MVP had (D-042). Real difficulty is Kevin's in-browser
   call (KI-015). What the sim *does* prove, and what `tests/campaign.test.ts`
   locks in, is that the campaign is coherent, winnable through the real
   fighting-building-spending loop, and still losable if the player is idle.

## Phase 7 (this chat) — remaining vertical-slice content

The prior Phase 7 chat delivered flying/anti-air and the roster/campaign
(D-048–D-051) and explicitly deferred the rest: heroes 2→4, more structures
(needs a shop relayout first), status effects, level-up choices, limited
equipment, spell-like abilities, and an improved wave preview/shop. This chat
does all of it in one sitting (Kevin: "tackle as much as you can as long as
doing so doesn't cause you to screw up anything"), as a sequence of small,
individually-tested additions rather than one big rewrite — each piece below
is independently covered by its own test file and the full 150-test suite
(101 → 120 → **150**) stays green throughout.

### D-052 — Party grows to four heroes: Bram (guardian) and Mira (frostcaller)
Resolves the Source of Truth §9 "Final party size" item for the vertical slice
("four in vertical slice"). `heroes.ts` gains two entries; the scene needed
**no changes** to render or select them — `buildHeroes()` already loops over
`HERO_DEFINITIONS`, and every other hero-facing code path (status line, action
button, HP labels) already loops over `this.heroes` generically. The only real
work was content: two archetypes that aren't a straight upgrade of Ash/Wren —
Bram trades damage for a stun (**Taunting Slam**, `aoeAdjacent` + `stunned`),
Mira trades damage for a slow at shorter range than Wren (**Frost Bolt**,
`single` + `slowed`) — see D-053. `testMap.ts` gained two more `H` tiles
**appended after** Wren's, in scan order, so Ash and Wren keep their exact
original start tiles and only the two new heroes land on new ground
(`tests/heroRoster.test.ts` locks the roster shape at exactly four).

### D-053 — Status effects: three effects, refresh-not-stack, burn-before-turn
"Status effects" is delivered as three small, composable rules in
`data/statusEffects.ts` rather than a general buff/debuff framework (op #3: no
unrequested scope) — this is also what makes an ability or a trap read as
**spell-like** rather than a bigger flat hit (the "spell-like abilities" item):
- **slowed** reduces an enemy's movement allowance for its phase.
- **stunned** skips the enemy's action AND movement for its phase.
- **burning** deals damage-over-time, resolved BEFORE the enemy takes its own
  turn each phase (so it can be killed by a burn tick before it ever moves).
Reapplying an active effect REFRESHES it to the longer duration rather than
stacking (simplest rule that avoids infinite-duration bugs from repeated
hits). `Enemy` carries the active-status bookkeeping (mirroring how `Hero`
already carries its own per-turn flags); `WaveSystem.tickEnemyPhase` is the
only system that interprets what an effect DOES, via `data/statusEffects.ts`
lookups, so the rule lives in exactly one place. **Bug found and fixed by this
work:** a fully-slowed enemy (0 effective movement) exposed a latent
`WaveSystem.advanceEnemy` bug — spreading an empty walked-path's last element
silently corrupted `enemy.position` to `{}`. No enemy could ever have 0
movement before "slowed" existed, so this was unreachable until now; fixed by
returning early on zero steps, covered by
`tests/phase7Structures.test.ts`'s "fully-slowed" case.

### D-054 — Structures: Gate, Melee Platform, Ranged Perch, Tangle Root
Delivers the phase's structure list ("walls, gates, platforms, perches, three
traps") as two small flags on the existing `"wall"`/`"trap"` kinds plus one new
kind, instead of growing the kind enum per idea:
- **Gate** = a `"wall"` definition with `blocksHeroes: false`. It obeys the
  exact same "never seal the only route" rule as a Barricade (BuildSystem
  treats every wall-kind structure identically for routing/seal-checking), but
  `BuildSystem.blocksHeroAt` — a new query separate from `isWallAt` — lets the
  scene's hero-movement check pass through it while enemy routing still can't.
- **Melee Platform** / **Ranged Perch** = the new `"platform"` kind. Blocks
  nothing; `BuildSystem.platformBonusFor(pos, heroIsRanged)` returns a small
  basic-attack bonus (`+2 damage` / `+1 range`) filtered to the matching hero
  category. Applied only to the BASIC ATTACK, not abilities — a deliberate
  scope cut to keep the surface area small.
- **Tangle Root** = the third trap: light damage plus `appliesStatus: slowed`,
  the "slowing terrain" idea from the Source of Truth's structure list. Traps
  gained a parallel `trapStatusAt` accessor (alongside the existing
  `trapProfileAt`/`trapTargetsAt`) so `WaveSystem` applies a status ONLY if the
  enemy survives the trap's damage that phase.
All original content; see `tests/phase7Structures.test.ts`.

### D-055 — Shop/Gear UI: a generic item grid; canvas height 900 → 1000
The Phase 5 shop had exactly three fixed x-slots in one row — hardcoded to the
two structures that existed then. Growing the shop to seven buildables (D-054)
plus a three-item equipment catalogue (D-057) needed a real relayout, done
ONCE as a reusable `buildItemGrid(cy, items, onClick)` helper (row-major, 4
columns) shared by both the shop grid and the new Gear grid — adding an eighth
buildable or a fourth equipment item later needs no layout code, just a data
entry. The two-row grid needs more room below the play grid than 900px height
left (same squeeze that drove the 720→900 change in D-046), so `GAME_HEIGHT`
moves to 1000 — verified by the same bounding-box arithmetic as D-046, not by
eye (no browser here). One "Done" button is now shared by build mode AND
equip mode (they're mutually exclusive, so it can't ambiguously close the
wrong one).

### D-056 — Level-up choices: every 2 waves, Vigor vs Might, DEFAULT cadence
Answers the Source of Truth §9 "Level cadence" OPEN item with a DEFAULT (not
LOCKED) choice: a level-up every `LEVEL_UP_WAVE_INTERVAL` (2) waves cleared —
five choices across the ten-wave campaign — rather than a full XP-per-kill
economy, which the phase boundary doesn't ask for. `ProgressionSystem` is pure
arithmetic (`hasPendingLevelUp(wavesCleared)` / `applyChoice`); the choice
itself — **Vigor** (+3 max HP to every living hero, healing them for it) or
**Might** (+1 basic-attack damage to every living hero) — is deliberately a
real trade-off (survive more hits vs end fights sooner), serving the phase's
"multiple viable strategies" acceptance criterion. `BattleScene` gates the
Victory/Between-Waves transition behind the choice via a stored `onDone`
callback, so the prompt can never be raced past; a `choosingLevelUp` flag
blocks board input while it's up (there is no full input-blocking layer in
this engine, so this is a targeted guard on the entry points that matter, not
a generic modal system). Only heroes ALIVE at the moment of the choice benefit
— a fallen hero gets nothing retroactively, which is a known, accepted edge
case (see KNOWN_ISSUES).

### D-057 — Limited equipment: one slot, looked up live (not stat mutation)
"Limited" is literal: one equipment slot per hero, a three-item catalogue
(`data/equipment.ts`), bought from a new Gear panel (D-055) and swapped freely
(the old item refunds in full, same as removing a structure). The bonus is
computed by a LIVE lookup through `Hero.equippedItemId` every time
`Hero.defense` / `Hero.effectiveAttackDamage` is read, rather than mutating a
stat field on equip and reverting it on unequip — this makes a swap or
unequip structurally impossible to leave a stale bonus behind, at the cost of
one extra lookup per read (irrelevant at this scale). This is also the first
time a hero's `defense` can be non-zero (KNOWN_ISSUES KI-013 — heroes still
have 0 BASE defense; the Iron Buckler is now a way to gain some).

### D-058 — Improved wave preview: a pure data lookup, no new system
"Improved wave preview & shop" turned out to need zero new pure-system code:
`WAVES` already fully describes every wave's composition, so
`BattleScene.updateWavePreview()` just formats
`WAVES[waveSystem.waveNumber]` (the next wave) into a short "Next: Wave N —
Enemy x count, ..." line refreshed every `updateHud()`. The shop's other
"improvement" is a `description` field added to every `StructureDefinition`
(and shown in equipment too), surfaced in the build/equip status hint instead
of the player needing to infer what an item does from its name and cost alone.

## Phase 8 — UX, Accessibility, and Presentation (this chat)

Kevin asked to start Phase 8 and specifically to fix the Gear/Build button
overlap "during the process." This chat covers the Source of Truth's full
Phase 8 in-scope list except volume controls (no audio system exists to
control — see KNOWN_ISSUES KI-029) and the actual production art (a planning
document only, D-065) — as a sequence of small, individually-tested pieces,
the same pacing precedent as the Phase 7 chat. Typecheck/build stayed clean
throughout; the suite grew 150 → **157 tests**.

### D-059 — Fix: Gear button overlapped Build button
Playtest finding (Kevin). Root cause in `BattleScene.buildShopHud()`: Build's
x-position (`bbx`) is End Turn's left edge minus a gap minus Build's own
half-width — correctly converting an edge to a center. Gear's x-position
(`gbx`) reused that same `- gap - halfWidth` step directly against `bbx`
(Build's CENTER) instead of first subtracting Build's half-width to reach
Build's LEFT EDGE, landing Gear 55px too far right and overlapping Build's
left edge. Fixed by stepping past Build's full width (`bbx - 75 - gap - 75`
instead of `bbx - gap - 75`). One-line fix; both buttons' positions are now
computed the same way (edge-to-edge, not edge-to-center).

### D-060 — Settings: a single "animation speed" control covers both "speed" and "reduced motion"; no volume control
The Source of Truth lists "volume and speed controls" and "reduced motion" as
separate items, but they collapse cleanly into one axis here: `SettingsSystem`
(new, pure, `systems/SettingsSystem.ts`) exposes one setting,
`animationSpeed: "normal" | "fast" | "instant"`, where "instant" skips
tweening entirely — that IS reduced motion, not a separate toggle bolted on
next to it. Modelling them as two overlapping controls would be an
unrequested abstraction (operating instruction #2). **No volume control was
added** — there is no audio system anywhere in the codebase to control one
(KNOWN_ISSUES KI-029); building settings UI for a system that doesn't exist
would be exactly the kind of dead scaffolding operating instruction #3 warns
against. `SettingsSystem` is storage-agnostic (a `SettingsStorage` interface
matching `localStorage`'s shape) so it stays unit-testable with a fake
in-memory store (`tests/settings.test.ts`, 7 tests) without needing a
browser or jsdom — the same "no Phaser dependency" pattern every other
system in that folder follows. `MainMenuScene` gets one button that cycles
the setting and saves it; `BattleScene` reads it once per `create()` and
scales every tween duration (`scaledDuration()`) — `moveEnemyToken` and
`flashTile` both snap directly to the end state with no tween at "instant,"
and the enemy-phase's post-move delay (`ANIM_MS + 40`) scales with it too, so
"instant" doesn't leave the game waiting out an animation that no longer
plays. This satisfies "settings persist locally": both scenes read/write the
same `SETTINGS_STORAGE_KEY`.

### D-061 — Keyboard support: hero-select hotkeys, a help key, visible key hints
E/B/G/Q/Enter/Esc already existed (Phase 4-7) but had no on-screen
indication beyond guessing; Q specifically wasn't labelled at all. This chat:
adds number-row hotkeys **1-4** to select a hero by its FIXED roster
position (1=Ash, 2=Wren, 3=Bram, 4=Mira, matching `HERO_DEFINITIONS` order),
so a key always means the same hero regardless of who else has fallen
(rejected as a no-op if that hero is down); adds **H** to open the new
how-to-play overlay (D-064) on demand; adds "(Q)" to the ability button's own
label; and appends "1-4: select hero" / "H: help" to the persistent status
hint. Full keyboard-only play (arrow-key tile navigation, keyboard-driven
build-item picking) was NOT attempted — a substantially larger feature,
tracked honestly as still-pointer-only in KNOWN_ISSUES KI-030 rather than
silently left unstated.

### D-062 — Tooltips: hover previews shop/gear item descriptions without spending a click
`buildItemGrid` (the shared shop/gear grid helper, D-055) gains an optional
`onHover` callback alongside its existing `onClick`; both grids now report
`pointerover`/`pointerout` on their buttons. A new `hoveredItemId` field
takes priority over the actually-selected item when composing the status
hint's description line, so moving the mouse over an item previews its
name/cost/description before the player commits to selecting (and
implicitly, before spending gold on) it. Moving off reverts to whatever is
actually selected. No new UI surface was added — this reuses the existing
status-hint text that already showed a selected item's description (D-058),
just makes it available a step earlier in the interaction.

### D-063 — Color-independent indicators: miniboss visual, on-token status badges, build-ghost glyph, ability-target glyph, integrity warning text
Resolves KI-023 and KI-027 directly, plus tightens two more spots that
otherwise relied on colour alone (the Phase 8 acceptance criterion: "no
critical information relies on color alone"):
- **Miniboss (KI-023):** a `role: "miniboss"` enemy (currently only
  `basalt-colossus`) spawns with a larger token radius, a thicker gold
  outline, AND a persistent name banner ("Basalt Colossus (Boss)") above it —
  size and text carry the signal, not its fill colour.
- **Status badges (KI-027):** every enemy token gets a small lettered badge
  (initials of its active effects, e.g. "SB" for slowed+burning, via the new
  `STATUS_EFFECT_ORDER` data export) that persists above the token for as
  long as the effect lasts, refreshed by `syncEnemyTokens` every time it
  already runs — not just a one-off coloured flash the player could miss.
  Positioning and movement/destruction are tracked in two small new maps
  (`enemyStatusBadges`, `enemyBossBanners`) rather than growing the shared
  `Token` interface (heroes never need either).
- **Build-ghost glyph:** the build-mode ghost tile now shows a ✓ or ✗ text
  glyph in addition to its green/red tint.
- **Ability-target glyph:** an ability's target outline gets a small ◆
  corner marker the basic-attack outline doesn't — `attackTarget` and
  `abilityTarget` are both warm hues close enough to be genuinely hard to
  tell apart for a colour-blind player; `markTarget` gained an optional
  `glyph` parameter for this.
- **Integrity warning text:** "⚠ LOW" is now appended to the Stronghold
  Integrity readout at ≤5, not just a colour swap to red.

### D-064 — Tutorial prompt: a dismissible how-to-play overlay, gated like a level-up choice
Delivers "tutorial prompts" as one overlay (not a multi-step guided tour —
op #2, no unrequested scope) shown automatically before the very first
player phase of a fresh browser (persisted via `hasSeenTutorial`/
`markTutorialSeen` in `SettingsSystem`, keyed on `TUTORIAL_STORAGE_KEY`),
and reopenable any time via **H**. Structurally it reuses the exact pattern
`showLevelUpChoice`/`chooseLevelUp` already established: `create()` defers
`turns.advance()` behind the overlay via a stored callback
(`pendingAfterTutorial`) instead of racing it, and a new `inputLocked()`
helper (`choosingLevelUp || tutorialOverlay.length > 0`) replaces the
scattered `|| this.choosingLevelUp` guards so the tutorial blocks board
input the same way a level-up choice already did — one helper, same call
sites, instead of adding a parallel set of `tutorialShowing` checks
everywhere. Unlike a level-up choice, the tutorial is informational, not a
forced decision: Esc dismisses it (and marks it seen) rather than being
blocked.

### D-065 — Original asset plan: a planning document, not art production
`ASSET_PLAN.md` (new, repo root) satisfies the "original asset plan" scope
item as what it actually is — a plan — rather than inventing an art
direction Kevin hasn't chosen. It inventories the current placeholder
approach, priority-orders what real art would eventually replace
(tokens/structures first, board texture last), restates the repo-wide
originality constraint (no D&D/SRD IP, no unlicensed reference, AI-generated
art treated as an explicit open question rather than a default), and notes
the Phaser-side technical shape (texture atlases via `preload()`, the
existing `assetKey`-shaped data fields) for whoever eventually implements it.
Deliberately does not schedule production — that depends on an art-direction
decision only Kevin can make.

## Phase 8, continued — Full keyboard-only play (KI-030)

### D-066 — Keyboard nav reuses the mouse's own dispatch, adding only a cursor + a grid-focus toggle
D-061 left tile movement/targeting and shop/gear item picking pointer-only
(KI-030). This chat closes that gap without adding a second combat/build/
equip rule path: a keyboard "cursor" (`cursorPos`, a `GridPosition` field)
is fed through the exact same `handleClick(tile)` / `updateHoverAt(tile)`
methods the mouse already drives — `updateHoverAt` is `pointermove`'s old
inline logic, extracted so both input methods share it byte-for-byte.

- **Arrow keys** move `cursorPos` one tile (clamped to `GameMap.isInBounds`)
  and re-run the same hover logic (path preview / build ghost) the mouse's
  `pointermove` already produced for that tile.
- **Enter or Space** — both bound to one `handlePrimaryActivate()` — act on
  whatever is focused: confirm a pending move if one exists (Enter's
  original, unchanged meaning), else pick the highlighted shop/Gear item if
  the grid has focus, else `handleClick(cursorPos)` — i.e., exactly what a
  mouse click on that tile would do. No new selection/attack/build/equip
  rule was written; every one of those still lives in `handleClick` alone.
- **The shop/Gear grid needed one genuinely new concept**, because unlike
  the board it never had a keyboard-reachable "which one" state: a
  `keyboardFocus: "board" | "grid"` field plus a `gridFocusIndex`, toggled
  with **Tab**, navigated with the same arrow keys (row-major, matching
  `buildItemGrid`'s existing 4-column layout), and rendered as a white
  stroke ring on the focused button (`applyGridFocusRing`, layered on top of
  the existing blue "selected" fill from D-055/D-062 — two independent
  signals, not a repaint of one). Entering build/equip mode defaults focus
  to the grid (nothing to place/equip until an item is picked); leaving
  either mode returns focus to the board. Picking an item via Tab+arrows+
  Enter calls the exact same `selectShopItem`/`selectEquipItem` a mouse
  click on that button would.
- Mouse and keyboard share `cursorPos` (moving the mouse updates it too), so
  switching input methods mid-action never leaves a stale cursor behind.
- `this.input.keyboard.addCapture([...])` stops the browser's own
  scroll/focus-cycling on the newly-bound arrow/space/tab keys while the
  canvas has focus.
- The tutorial overlay (D-064) gained two lines teaching this; because that
  overlay's body text has fixed, non-word-wrapped line breaks, its title and
  "Got it!" button both moved from ±220px to ±300px off-center to keep a
  safe bounding-box margin around the now-longer text — the same
  worst-case-string approach D-046 used, not a guess (no browser here to
  check it directly).
- **Not attempted, and out of scope for this pass:** no changes to
  `MovementSystem`/`PathfindingSystem`/any pure system — this is entirely a
  `BattleScene` presentation-layer feature, per operating instruction #4.
  Scene-level input has never had Vitest coverage (D-002: tests run
  headless, no Phaser); this follows that same precedent — typecheck (157
  tests, unchanged), build, and `npm run dev`'s HTTP 200 all pass, but the
  actual keyboard-only play feel needs Kevin's browser pass, same as every
  other Phase 8 UI addition (KI-031-style, tracked below).

### D-067 — Same-type units may pass through each other, but never share a landing tile
Kevin asked for enemies to be able to move through other enemies' space, and
heroes to move through other heroes' space, while still never stopping on the
same tile as another. This is a DEFAULT tactical-feel change (heroes/enemies
alike no longer form impassable single-file traffic jams), not a reversal of
D-018/D-045's core "no two units ever share a tile" invariant — only which
tiles may be WALKED THROUGH changed, not which tiles may be STOOD ON. Hero vs.
enemy blocking (D-033) is untouched in both directions.

**Heroes (`MovementSystem`):** `MovementQuery` gains a second, independent
predicate, `blocksStopping`, alongside the existing `isOccupied`. `isOccupied`
is unchanged — a hard block nothing may enter or pass (walls, enemies, from a
hero's perspective). `blocksStopping` is new — a tile that may be walked
THROUGH during pathfinding but is excluded from `reachableTiles` and rejected
by `isLegalDestination`/`findPath` as an actual destination. `BattleScene`
splits its old single `isOccupiedByOther` into `isHeroMovementBlocked` (walls +
enemies, hard) and `isHeroStoppingBlocked` (other living heroes, soft), passing
both to every `MovementSystem` call. A party can now file past each other in a
one-tile-wide corridor instead of needing to shuffle out of the way first.

**Enemies (`WaveSystem`):** routing itself (`PathfindingSystem.routeToNearestGoal`,
via `advanceEnemy`'s `isBlocked`) no longer includes `isOccupiedByOtherEnemy` —
only walls/heroes/context still hard-block the ROUTE. What changed is how many
of the route's steps an enemy actually takes this phase: `advanceEnemy` computes
the movement-budget-limited landing tile as before, then backs off ONE STEP AT A
TIME while that landing tile is occupied by another still-there enemy, stopping
at the nearest tile behind it (or holding in place if even the first step is
occupied). An enemy can therefore walk straight past a stopped ally in a lane
rather than detouring around it or queueing behind it the moment it's in the
way — it only holds up if its OWN landing tile, after the back-off, would still
land on someone. Spawn-blocking (`isOccupiedByAnyEnemy`/`pendingRetry`) is
unrelated to movement and is unchanged: a new enemy still cannot spawn on top
of one already standing at the spawn tile.

Covered by new tests: `tests/movement.test.ts` (`blocksStopping` describe
block — reachableTiles/isLegalDestination/findPath all pass through but never
land on a soft-blocked tile, and confirms `isOccupied` still hard-blocks
independently) and `tests/enemyCollision.test.ts` (a deterministic scenario
where a second enemy first backs off short of a stationary ally, then — once
there's room beyond it — walks straight THROUGH the ally's tile to land past
it, with the walked path asserted to include that tile as an intermediate
step). 157 → **162 tests**.

## Spawn-tile access and the loss condition

### D-068 — All heroes defeated is ALSO a loss condition (reverses D-034's LOCKED clause)
Kevin asked directly, in chat: "Game should end when all heroes die." Per
CLAUDE.md, a LOCKED decision (here, D-034's "the loss condition remains
LOCKED to Stronghold Integrity = 0", itself echoing the Source of Truth §9
table's own LOCKED "Loss condition" row) is not to be reversed without
Kevin's explicit approval — this request, stated plainly in his own words,
IS that approval, so this is recorded as a genuine reversal, not a
"refinement" the way D-018/D-045 were touched by D-067.

The loss condition is now: Stronghold Integrity reaches zero, **OR** every
hero is defeated (whichever happens first). Implementation stays inside
`BattleScene.resolvePhase()` — already the single place that decides what
follows the enemy phase (victory / defeat / between-wave / continue) — since
hero death can only ever happen there (an enemy attack during the enemy
phase that just ran). No changes to `WaveSystem`: it has no concept of
heroes' health, and the integrity-based check (`waveSystem.isDefeated()`)
stays exactly as before; the party-wiped check is a second, independent
condition checked right alongside it (`this.livingHeroes().length === 0`),
matching the same pattern the scene already used to compose pure-system
queries into a phase decision (e.g. `isCurrentWaveComplete()`,
`isLastWave()`). A `defeatReason` field records which condition fired so the
end screen can say "your party has fallen" vs. "the stronghold has fallen"
instead of always showing the Integrity-specific message regardless of
cause. No new pure-system code was added (this is entirely a `BattleScene`
decision, like every other phase-transition rule already living there), so
per the established Phase 8 precedent (D-002/D-066) there is no new Vitest
coverage — verified by typecheck and the full existing suite staying green.

### D-069 — The spawn ("In") tile is inaccessible to heroes
Kevin reported a bug: a hero standing on or near the spawn tile caused
enemies to pile up on top of each other, and traced it (correctly) to
enemies' "attack first, move second" priority. Investigation found the
concrete mechanism: nothing previously stopped a hero from standing exactly
ON the spawn tile, so a freshly spawned enemy could land co-located with a
hero standing there and, being immediately in attack range, hold there
indefinitely rather than marching in — visually read as units "stacking" at
the spawn point. (Building on the spawn tile was already rejected —
`BuildSystem.canPlace` has rejected `role === "spawn"` since Phase 5 — so
only the movement side needed a fix.)

Fix: `BattleScene.isHeroMovementBlocked` (the hard-block predicate already
feeding every `MovementSystem` call — see D-067) now also treats any tile
with `map.roleAt(pos) === "spawn"` as blocked, the same tier as a wall or an
enemy. A hero can no longer move onto, or pass through, the spawn tile at
all. This structurally eliminates hero/enemy co-location at the spawn point,
which was the root cause. A hero standing merely NEAR (adjacent to, not on)
the spawn tile is unaffected by this fix and was re-verified NOT to cause
actual tile-sharing between enemies: the existing spawn-retry guard
(`isOccupiedByAnyEnemy`/`pendingRetry`, D-045) already correctly defers a new
enemy's spawn for as long as the tile in front of it is held by an
already-spawned enemy tanking a hero — that case produces a queue/stall at
the choke point (expected tanking behavior), not overlapping tiles. If
Kevin still observes actual tile overlap with a hero merely adjacent (not
on) the spawn tile after this fix, that would point to a different mechanism
this investigation didn't reproduce and is worth a fresh bug report.

No new pure-system code (the fix lives in `BattleScene`, composing the
already-tested `GameMap.roleAt` query); no new Vitest coverage, matching the
same scene-level precedent as D-068 above.

## Phase 11 roadmap — D&D 5.5e character system and content expansion (this chat)

### D-070 — Freeform party builder replaces the fixed 4-hero roster
Kevin's long-term vision ties hero level-ups to real D&D 5.5e class features
(e.g. a Fighter's Extra Attack at 5, a caster's growing spell slots). This
requires deciding whether hero identity stays fixed (today's Ash/Wren/Bram/
Mira, each just reskinned with a class under the hood) or becomes a real
character-creation flow (pick race + class, eventually subclass/background,
per party slot). Asked directly; Kevin chose the freeform builder — the
larger-scope option — over keeping the current fixed roster.

Implications, recorded so future chats don't have to re-derive them:
- The current fixed 4-hero roster (`src/game/data/heroes.ts`) will eventually
  be replaced by a character-creation UI (name, race, class, stat
  allocation), not just re-skinned. Nothing about the existing heroes should
  be deleted or reworked until the Phase 11.1 character foundation
  (ability scores, proficiency, one full class) actually exists to replace
  them with — this decision sets direction, it does not itself change code.
- Balance-testing surface grows substantially: every race x class combo
  (and later, race x class x subclass) is a combination that can be played,
  not just four pre-tuned kits. Expect this to extend, not replace, the
  already-open Phase 7 balance debt (KI-015/KI-022/KI-028).
- The art wishlist (race/class-specific hero artwork) follows directly from
  this: a freeform builder implies potentially dozens of hero-art
  combinations over time, not four. Art is planned as an incremental,
  per-content-drop track (see D-071), not a single late phase, partly
  because of this.
- Party size/composition (choosing how many heroes, and human vs.
  AI-controlled per slot) is now naturally part of the same
  character-creation flow rather than a separate later feature — pulled
  earlier in the D-071 sub-phase order accordingly.

### D-071 — Phase 11 expanded into a ten-part sub-phase roadmap (11.1–11.10)
Kevin's full vision for the remainder of the project (D&D-based leveling,
races/classes/feats/spells/magic items/potions, a bestiary, a map system
overhaul, boss-themed campaigns, a free-play mode, AI-controlled party
members, an in-game rules/spell/feat index, a map builder, and a full visual
overhaul) is far larger than Phase 11's original one-paragraph scope
("potential twenty-wave campaign; final boss; multiple maps; more hero
paths/items/structures; difficulty modes"). Rather than invent new top-level
phase numbers (which would contradict the Source of Truth's Phase 0–12
structure), this was scoped as a sequence of Phase 11 sub-phases, each its
own future development chat (or several), in dependency order:

- **11.1** — Character foundation: six ability scores/modifiers, proficiency
  bonus, a class framework, ONE class fully built level 1–20 (Fighter
  recommended first — Extra Attack needs no spellcasting engine), and a
  first pass at the freeform character-creation UI (D-070).
- **11.2** — Spellcasting engine: spell slots, prepared/known spells, a
  curated SRD-derived spell list, one caster class (Wizard or Cleric).
- **11.3** — Starter class/race/feat roster: enough classes to cover
  melee/ranged/tank/support roles (~4–6), a starter race/species list
  (Human, Elf, Dwarf, Halfling, Half-Elf, Half-Orc), a starter feat list,
  subclass choice at the correct levels.
- **11.4** — Party assembly + AI-controlled heroes: party size selection,
  human-vs-AI mix per slot, a "human picks level-ups, AI plays" mode, and
  difficulty scaling by party size (starting point: scale enemy count and/or
  HP by party size, plus flat-multiplier Easy/Normal/Hard/Nightmare tiers —
  real tuning is deferred to in-browser play, same as every other balance
  number in this project).
- **11.5** — Equipment/magic items/potions expansion, plus an in-game
  Compendium (rules/spell/feat lookup index).
- **11.6** — Enemy/miniboss/boss roster design (the actual creature list,
  designed before the systems that consume it) and the Bestiary
  (unlock-on-encounter/kill progression, mixing useful in-game info with
  flavor/lore text).
- **11.7** — Map system overhaul: terrain types (water/acid/fire/cliffs),
  multiple in/out tiles, shop/treasure tiles, proximity-gated
  building/shopping (replacing today's build-anywhere/shop-anywhere rules),
  per-hero structure carry limits.
- **11.8** — Campaign system: boss-themed campaigns assembled from 11.6's
  roster and 11.7's maps (one boss, one themed enemy lineup, one unique map
  per campaign).
- **11.9** — Free-play mode: configurable wave count/boss/minion
  source/map, difficulty tiers, unlock gating tied to campaign completion.
- **11.10** — Map builder + sharing ("eventually," lowest priority per
  Kevin) — depends on 11.7 and Phase 10's Firebase hosting.

Visual overhaul is deliberately NOT its own numbered sub-phase: Kevin's ask
(hero/enemy/boss art, a better menu, flavorful buttons, spell/action
animations, status indicators, adaptive map art) is treated as two things
instead — (a) an early foundational look-and-feel pass (menu skin, button
styling, an animation framework) so later content doesn't need retrofitting,
and (b) incremental art added per class/race/enemy/boss as each sub-phase
above ships. This mirrors D-065's precedent (an asset PLAN, not a single art
production event) and avoids building unrequested scaffolding (per operating
rule #2/KI-029's precedent) for content that doesn't exist yet.

Licensing note carried from `CONTENT_SOURCES.md`/Source of Truth §3: SRD
5.2.1 mechanical content (class features, races, feats, spells) is usable
under CC BY 4.0 with attribution — logged per item in `CONTENT_SOURCES.md`
as it's added — but names/settings (e.g. "Tiamat," Forgotten Realms
locations) are NOT SRD content and must stay original, per Kevin's own
example caveat in chat.

No code changed by this decision — it is a planning/roadmap entry only. The
first implementation slice (11.1) has not started as of this chat.

## Phase 11.1 — D&D character rules engine, first slice (this chat)

### D-072 — Ability scores, proficiency bonus, and one full class table (Fighter), pure and unwired
Started Phase 11.1 per D-071's roadmap. Rather than Phase 9 (local saves) —
building a save schema around the CURRENT fixed-hero data model right before
D-070's freeform character system replaces it would mean redoing that schema
almost immediately. Phase 11.1 avoids that churn.

Scope, deliberately narrow (mirrors the Phase 0/1 precedent of building
`GridSystem`/`GameMap` pure and tested before any scene used them):
- `src/game/data/abilityScores.ts` — the six SRD ability scores, the
  modifier formula, and the standard array.
- `src/game/data/classes.ts` — a generic `CharacterClassDefinition` shape
  (hit die, saving throw proficiencies, attacks-per-action by level, a
  level-by-level feature table) plus ONE fully-populated class, **Fighter**,
  levels 1–20.
- `src/game/systems/CharacterSystem.ts` — pure derived-stat math:
  proficiency bonus by level, max HP by class/level/CON (using the SRD's
  fixed "average hit die, rounded up" option — no rolling, matching this
  project's existing deterministic-combat philosophy, D-030), attacks-per-
  action lookup, and feature queries (`featuresUpToLevel`,
  `activeFeaturesUpToLevel`).
- `tests/characterSystem.test.ts` — 16 new tests covering all of the above.

**Not done this chat, on purpose:**
- `Hero`, `heroes.ts`, and `BattleScene` are UNTOUCHED. The fixed 4-hero
  roster still drives the live game exactly as before. Nothing calls into
  this new code yet.
- Subclasses, feats, and races are still Phase 11.3 (D-071) — several
  Fighter features (Fighting Style, Second Wind, Action Surge, Martial
  Archetype, Ability Score Improvement, Indomitable) are recorded as DATA
  (name, level, description) but marked `mechanicallyActive: false` because
  the systems they need don't exist yet (an action-economy hook, a rest
  concept, a saving-throw/dice system, subclass content, feats). Only
  Extra Attack is `mechanicallyActive: true` today, since it's just a
  derived number (`attacksPerActionForClassAtLevel`) with nothing else to
  build first.
- No second class/spellcasting engine — that's Phase 11.2.

This is genuinely new SRD-derived content — the first in the project. Logged
in `CONTENT_SOURCES.md` per the existing "Rules for future chats" section
(SRD 5.2.1, CC BY 4.0, attribution required before public release). Feature
DESCRIPTIONS were written in original wording, not copied from the SRD text.

**Why stop here instead of also wiring it in:** replacing the fixed roster
with a real character-creation flow (D-070) is a UI-and-integration change
that touches `BattleScene`, `CombatSystem`'s `Combatant` interface, and the
existing `ProgressionSystem`/equipment/level-up plumbing — a much larger,
riskier change than a set of new, purely-additive, fully-tested files.
Per operating rule #1 (preserve working systems) and #5 (small testable
changes over giant rewrites), that integration is its own future slice, not
bundled into the same sitting as inventing the rules engine's shape.

Verified: `npm run typecheck` pass, `npm test` pass (**178/178**, was 162),
`npm run build` pass (34 modules, unchanged).

## Phase 11.1 — "finish it": the character-creation UI (this chat)

### D-073 — A first-pass character-creation UI, added ALONGSIDE the fixed roster, not replacing it
Kevin asked to "finish 11.1." Per D-071, that meant the character-creation
UI that begins replacing the fixed 4-hero roster. Rather than replace
`MainMenuScene`'s START flow outright, this was added as a genuinely new,
separately-reachable scene:

- **`src/game/data/characterCreation.ts`** — a 12-name original preset pool
  (Kael, Sable, Doran, Lyra, Finn, Rue, Torin, Wynn, Briar, Odessa, Garrick,
  Nessa — deliberately NOT Ash/Wren/Bram/Mira) and the four signature
  abilities a created character can pick (the project's existing Cleave/
  Piercing Shot/Taunting Slam/Frost Bolt — no new abilities invented).
- **`src/game/systems/CharacterBuildSystem.ts`** — pure logic:
  `StandardArrayAllocator` (assign the standard array 15/14/13/12/10/8
  across the six ability scores by "cycling" one ability forward — an
  adjacent swap with whichever ability holds the next slot; always stays a
  valid permutation, so a UI button can never produce an invalid stat
  spread) and `heroDefinitionFromBuild` (the ONE seam between the D&D
  system and the live game: turns a finished build into the existing
  `HeroDefinition` shape). Attack style (melee vs. ranged) is DERIVED from
  the chosen signature ability's range, not a separate control — one fewer
  button, and it mirrors how today's fixed heroes already pair a melee kit
  with a melee basic attack. `hasDuplicateAbilities`/`hasDuplicateNames`
  gate a valid party (every hero distinct, matching today's design).
- **`src/game/scenes/CharacterCreationScene.ts`** — a new Phaser scene: 4
  party slots (D-052's locked party size, unchanged), each with a
  cycle-to-rename button, six clickable ability-score rows, a
  cycle-to-choose signature-ability button, and a live derived-stats
  preview (HP/ATK/Range/Move), computed straight through
  `heroDefinitionFromBuild` so the preview can never drift from what
  actually gets played. Start Battle is disabled with a status message
  while any two heroes share a name or a signature ability; the defaults
  (4 distinct preset names, all 4 abilities represented) are already valid,
  so a player can start immediately without customizing anything.
- **`BattleScene`** gained `init(data?: { heroDefinitions? })`, storing it in
  a new `customHeroDefinitions` field; `buildHeroes()` now reads
  `this.customHeroDefinitions ?? HERO_DEFINITIONS`. This is the ENTIRE
  change to `BattleScene` — when reached the original way (no data passed),
  behavior is byte-for-byte identical to before.
- **`MainMenuScene`** gained a second button, "Create Party (new)", well
  below and clear of the existing START button (bounding-box math, no
  browser available — same discipline as D-046/D-055/D-059). START is
  UNCHANGED: it still goes straight to `BattleScene` with no data, so the
  original fixed 4-hero roster (Ash/Wren/Bram/Mira) still plays exactly as
  before.

**Why additive, not a replacement:** with only ONE class (Fighter) and the
same four abilities that already exist, replacing the fixed roster outright
would have made every created character mechanically closer to a
reskinned Fighter than a genuine improvement in variety — a real regression
until more classes exist (Phase 11.2/11.3). It would also have put Kevin's
still-open browser-verification checklist (KI-036/KI-035/KI-034/KI-031) and
the Phase 7 balance pass (KI-015/KI-022/KI-028) — all written assuming
today's exact roster and stats — at risk of needing to be redone. Keeping
both paths live lets Kevin try the new creator on its own terms without
losing the ability to keep testing everything already in flight. Per
operating rule #1 (preserve working systems): the fixed roster is not being
deprecated by this decision, only supplemented; a future chat should decide
explicitly when (if ever) to retire it, once more classes/races give the
freeform builder real variety to offer.

**Still deferred, unchanged from D-072:** subclasses, feats, races, a
second class, spellcasting, and any level-up mechanism for a class level
(a created character is always level 1; `ProgressionSystem`'s wave-based
Vigor/Might still applies on top, unrelated). `movementTiles` is a flat
default (3) — race-based speed is Phase 11.3. There is no free-text name
entry (a 12-name preset pool instead) — this project has no DOM text-input
precedent yet, and building one wasn't needed to deliver a real, working
first pass.

Verified: `npm run typecheck` pass, `npm test` pass (**190/190**, +12 from
`tests/characterBuildSystem.test.ts` — was 178), `npm run build` pass (40
modules, was 34), `npm run dev` serves HTTP 200. The new scene's on-screen
layout/feel is NOT verified in a browser — see KNOWN_ISSUES for a new entry.

## Phase 11.2 — the spellcasting engine and a second class (this chat)

### D-074 — Wizard added as a second class, with a real (if intentionally small) spellcasting engine
Per D-071's roadmap, 11.2 is "spell slots, prepared/known spells, a curated
SRD-derived spell list, one caster class (Wizard or Cleric)." Chose Wizard
over Cleric — no particular mechanical reason, both were equally in scope;
Wizard's Intelligence-based casting and spellbook/prepared-spells model give
slightly more to build (spellbook growth, INT-based attack math) than
Cleric's "prepare from the full class list" model would have.

- **`src/game/data/spells.ts`** (new) — a curated 5-spell list: two cantrips
  (Fire Bolt, Ray of Frost) and three 1st-level spells (Magic Missile,
  Burning Hands, Mage Armor). Each spell records its SRD spell level (0 =
  cantrip) and school. Cantrips carry an `abilityId` — the seam into a real,
  playable combat entry (see below); leveled spells deliberately do not,
  since this game has no spell-slot resource to spend one from yet (same
  boundary as the Fighter's inert Second Wind/Action Surge, D-072).
- **`src/game/data/abilities.ts`** gained two new entries, `fire-bolt` and
  `ray-of-frost` — ordinary `AbilityDefinition`s in the SAME registry
  `BattleScene` already reads via `hero.abilityId`/`getAbility`. This was the
  key design choice: a Wizard's cantrip needed to be playable WITHOUT
  teaching `BattleScene` a second data source, so a cantrip's actual combat
  numbers live in `abilities.ts` (like every other hero action always has)
  and `spells.ts` is purely the spell-level/school METADATA layer on top,
  referencing it by id. Zero changes to `BattleScene`, `Hero`, or `getAbility`
  were needed as a result.
- **`src/game/data/classes.ts`** gained `WIZARD`: d6 hit die, INT primary
  ability, INT/WIS saving throw proficiencies, a full level 1-20 feature
  table (Spellcasting, Arcane Tradition, Ability Score Improvement, Spell
  Mastery, Signature Spells — SRD names/levels, original descriptions, same
  treatment as the Fighter table), and a new optional `spellcasting` field
  (`SpellcastingProgression`: casting ability, cantrips-known-by-level, and a
  full SRD spell-slots-by-level table through level 20). Only "Spellcasting"
  is `mechanicallyActive: true` — everything else (subclass, ASI, Spell
  Mastery) is inert for the same reasons Fighter's equivalents are.
- **`src/game/systems/SpellcastingSystem.ts`** (new) — pure derived math:
  `isSpellcaster`, `cantripsKnownForClassAtLevel`,
  `spellSlotsForClassAtLevel`, `preparedSpellsKnownForWizardAtLevel`. Mirrors
  `CharacterSystem`'s treatment of the Fighter table; computes what a Wizard
  KNOWS/HAS, does not spend anything in a battle.
- **`src/game/systems/CharacterBuildSystem.ts`**: `heroDefinitionFromBuild`
  now checks `isSpellId(build.abilityId)` — if the chosen signature action is
  a spell, the attack modifier uses the class's spellcasting ability (INT
  for Wizard) instead of the existing melee-STR/ranged-DEX split. A Fighter's
  build path is completely unchanged (its four abilities are never spell
  ids).
- **`src/game/data/characterCreation.ts`** gained `CREATABLE_CLASS_IDS`
  (`["fighter", "wizard"]`) and `signatureActionIdsForClass(classId)` — the
  one place that decides which action list a given class picks from
  (Fighter's four abilities, or Wizard's two mechanically-active cantrips). A
  future third class only needs an entry here.
- **`src/game/scenes/CharacterCreationScene.ts`** — the previously-static
  "Class: Fighter (more soon)" line is now a real cycle button. Changing a
  hero's class resets its signature-action index to 0 (the two classes'
  action lists differ in length/content, so an old index could point past
  the end of a shorter list or land on an unintended entry). Everything else
  (name cycling, ability-score allocation, the live stats preview, party
  validation) works identically for either class since both eventually
  resolve through the same `heroDefinitionFromBuild` seam.

**Why cantrips specifically, and not more of the spell list:** cantrips are
the one SRD spell category that costs no resource to cast (at-will), which
is exactly what this game's move-plus-one-action turn structure already
supports with zero new plumbing. Leveled spells need a slot-spending economy
this game doesn't have (no rests, no per-turn resource tracking beyond move +
action) — building that now would be a much larger, riskier change than this
slice, and per operating rule #5 (small testable changes) it's deferred
rather than bolted on halfway. The 1st-level spells are real data (so
`preparedSpellsKnownForWizardAtLevel` and the spell-slot table mean
something today) but stay unselectable in `CharacterCreationScene` until
that economy exists.

**Why this doesn't touch `BattleScene`:** per the ONE-seam rule stated in
`CharacterBuildSystem`'s module comment (do not add a second, parallel way to
turn a build into a playable hero), a cantrip's combat numbers were added to
the EXISTING `abilities.ts` registry rather than inventing a second lookup
path `BattleScene` would need to know about. `spells.ts` only adds metadata
on top for the spells that need it.

This is new SRD-derived content — logged in `CONTENT_SOURCES.md` per the
existing "Rules for future chats" section (SRD 5.2.1, CC BY 4.0, attribution
required before public release). Spell and feature DESCRIPTIONS are original
wording, not copied SRD text, matching the Fighter table's precedent.

**Still deferred, unchanged from D-071's roadmap:** Cleric (or any further
class), subclasses/feats/races (11.3), an actual spell-slot economy for
leveled spells, concentration, rituals, and any level-up mechanism for a
class level (a created Wizard, like a created Fighter, is always level 1).

Verified: `npm run typecheck` pass, `npm test` pass (**217/217**, +27 from
`tests/spells.test.ts`, `tests/spellcastingSystem.test.ts`,
`tests/characterCreationData.test.ts`, and additions to
`tests/characterSystem.test.ts`/`tests/characterBuildSystem.test.ts` — was
190), `npm run build` pass (41 modules, was 40), `npm run dev` serves HTTP
200. The updated scene's on-screen layout/feel (the new class-cycle button
specifically) is NOT verified in a browser — see KNOWN_ISSUES for a new
entry.

## Phase 11.3 — starter class/race/feat roster (this chat)

### D-075 — Two further classes (Rogue, Cleric), a six-race starter list, and a starter feat list
Per D-071's roadmap, 11.3 is "enough classes to cover melee/ranged/tank/
support roles (~4-6), a starter race/species list (Human, Elf, Dwarf,
Halfling, Half-Elf, Half-Orc), a starter feat list, subclass choice at the
correct levels." Delivered:

- **`src/game/data/races.ts`** (new) — all six SRD starter races. Speed is
  the ONE mechanically active trait: Dwarf and Halfling get the SRD's
  slower 25ft (2 tiles instead of the default 3); everyone else matches the
  default. This is the exact deferred item `CharacterBuildSystem`'s Phase
  11.1 module comment flagged ("`movementTiles` is a flat default —
  race-based speed is Phase 11.3"). Every other named trait (Darkvision, Fey
  Ancestry, Lucky, Relentless Endurance, etc.) is `mechanicallyActive:
  false` — this game has no lighting/vision, charm/fright/poison, skill, or
  dice-reroll systems for them to hook into. Race is NOT required to be
  distinct across a party (unlike name/signature-action) — a full-Human
  party is exactly as valid as a mixed one.
- **`src/game/data/classes.ts`** gained `ROGUE` (d8, DEX primary, DEX/INT
  saves, Sneak Attack as a flat rider via the new `bonusDamageByLevel`
  field) and `CLERIC` (d8, WIS primary, WIS/CHA saves, subclass choice at
  level 1 — earlier than every other class, the SRD's real Divine Domain
  timing). Cleric shares Wizard's exact cantrips-known/spell-slot tables
  (factored out as `FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL`/
  `FULL_CASTER_SPELL_SLOTS_BY_LEVEL` — every SRD full caster uses the same
  numbers, so Wizard was refactored to reuse them too rather than keep two
  copies). `CLASS_DEFINITIONS` is now `[FIGHTER, WIZARD, ROGUE, CLERIC]` —
  four classes covering melee (Fighter), ranged/skirmish (Rogue), ranged
  control (Wizard), and support/caster (Cleric), satisfying D-071's "~4-6"
  floor.
- **`src/game/systems/CharacterSystem.ts`** gained
  `bonusDamageForClassAtLevel` — same sparse "highest key <= level" lookup
  shape as `attacksPerActionForClassAtLevel`, generic (not Rogue-specific
  naming) so a future class's rider damage can reuse it. Sneak Attack's
  SRD "Nd6" was converted to a flat number using the same "average die
  value, rounded up" treatment `fixedHitDieGain` already uses for HP —
  this game's combat stays diceless (D-030).
- **`src/game/data/abilities.ts`** gained `sacred-flame` — the Cleric's one
  mechanically-active cantrip, `ignoreDefense: true` (reflecting the SRD's
  save-not-attack-roll targeting) at lower base damage than Fire Bolt,
  balanced around that lever the same way Cleave/Piercing Shot already are.
  `data/spells.ts` gained the Cleric's curated list on top: Sacred Flame
  (active) and Guidance (inert, no skill system) as cantrips; Cure Wounds,
  Bless, and Shield of Faith as inert 1st-level spells (this game has
  neither a heal effect nor an ally-buff mechanic at all, on top of the
  usual slot-economy boundary every leveled spell here shares).
- **`src/game/data/feats.ts`** (new) — four starter feats (Tough, Alert,
  Lucky, Athlete). Only Tough is mechanically active (+2 HP/level, a real
  computable number); the rest are inert for the same reasons various race
  traits are. **Deliberately NOT wired into `CharacterCreationScene` or any
  level-up flow**: a feat is only ever picked in place of an Ability Score
  Improvement, and every class's ASI feature is itself
  `mechanicallyActive: false` today because it first triggers at level 4+
  — and every created character is always level 1. Building feat-selection
  UI for a choice no character can currently reach would be dead
  scaffolding; this is pure rules-engine content, same "data can precede
  its own UI" precedent as Phase 11.1's first slice (ability
  scores/proficiency bonus/Fighter table shipped fully tested before
  `CharacterCreationScene` existed).
- **`src/game/systems/CharacterBuildSystem.ts`**: `CharacterBuild` gained
  `raceId`; `heroDefinitionFromBuild` now reads `movementTiles` from
  `getRaceDefinition(build.raceId).speedTiles` instead of a flat constant,
  and adds `bonusDamageForClassAtLevel(classDef, build.level)` into
  `attackDamage` (0 for every class except Rogue). Fighter's and Wizard's
  numbers are unaffected — the constant it replaced was always 3, matching
  every non-Dwarf/Halfling race's speed.
- **`src/game/data/characterCreation.ts`**: `CREATABLE_CLASS_IDS` is now
  `["fighter", "wizard", "rogue", "cleric"]`; `signatureActionIdsForClass`
  gained `CLERIC_CANTRIP_IDS` (just Sacred Flame today) and routes Rogue to
  the same four existing abilities Fighter already uses (no new martial
  abilities invented — Sneak Attack's damage is a rider on TOP of whichever
  ability is chosen, not a fifth ability).
- **`src/game/scenes/CharacterCreationScene.ts`** gained a race-cycle button
  (a new row between the existing class button and the ability-score rows).
  Rogue and Cleric needed ZERO scene changes beyond that — both already
  flow through the class-cycle button and `signatureActionIdsForClass` seam
  Phase 11.2 built for Wizard. The panel and every button below it shifted
  down ~40px (bounding-box math, no browser available — same discipline as
  D-046/D-055/D-059/D-074): `GAME_HEIGHT` is 1000, and the lowest button
  (Back to Menu, now at y=700) still leaves 300px of headroom.

**Why Rogue and Cleric specifically (not e.g. Barbarian/Paladin):** Fighter
already covers melee/tank and Wizard already covers ranged/control; Rogue
(ranged/melee skirmisher, a real computable Sneak Attack rider) and Cleric
(the support/caster role, sharing all of Wizard's spellcasting plumbing)
filled the two clearly-missing roles with the least new engine surface —
Cleric in particular reuses the ENTIRE spellcasting engine Phase 11.2 built,
proving that engine was built generically rather than Wizard-specific.

**Why the Cleric reads mechanically like a second blaster:** this game has
no HP-restoring effect or ally-buff mechanic at all (heroes only ever take
damage or deal it), so a "support" caster's actual support tools (Cure
Wounds, Bless, Shield of Faith) have nothing to hook into yet. This is
recorded honestly as data-only rather than faked or skipped — the same
treatment every other not-yet-supported mechanic in this project gets.

This is new SRD-derived content — logged in `CONTENT_SOURCES.md` per the
existing "Rules for future chats" section (SRD 5.2.1, CC BY 4.0,
attribution required before public release). All descriptions and game
numbers (damage, speed-in-tiles, HP bonus) are original, not copied SRD
text, matching every class table's precedent.

**Still deferred, unchanged from D-071's roadmap:** actual subclass content
for any class's subclass choice (Martial Archetype, Arcane Tradition,
Roguish Archetype, Divine Domain — all correctly TIMED per their class
table, per D-071's "subclass choice at the correct levels," but none yet
GRANT anything); feat selection at an actual level-up (blocked on ASI itself
being inert until level 4+); a fifth+ class; a spell-slot economy for
leveled spells; any level-up mechanism for a class level (a created
character of any class/race is always level 1).

Verified: `npm run typecheck` pass, `npm test` pass (**246/246**, +29 from
`tests/races.test.ts`, `tests/feats.test.ts`, and additions to
`tests/characterSystem.test.ts`/`tests/spellcastingSystem.test.ts`/
`tests/characterBuildSystem.test.ts`/`tests/characterCreationData.test.ts`/
`tests/spells.test.ts` — was 217), `npm run build` pass (42 modules, was
41), `npm run dev` serves HTTP 200. Kevin has confirmed the Phase 11.2
class-cycle button works in-browser; this chat's new race-cycle button and
relaid-out panel are NOT yet verified in a browser — see KNOWN_ISSUES for a
new entry.

## Phase 11.3 follow-up — subclass content (this chat)

### D-076 — One real, named subclass per class, all honestly inert
Every class table already recorded WHEN its subclass choice happens
(Fighter: 3, Wizard: 2, Rogue: 3, Cleric: 1 — D-075). Kevin asked to "do
subclasses now" — this chat added WHAT one real, named subclass per class
actually grants, closing that loop:

- **`src/game/data/subclasses.ts`** (new) — `SubclassDefinition` (id, name,
  classId, `features: ClassFeature[]` — reuses the exact same feature shape
  class tables already use, not a parallel type). One subclass per class,
  chosen for thematic fit with what that class already does in this game:
  **Champion** (Fighter — the simplest martial archetype, matching
  Fighter's straightforward melee identity), **School of Evocation**
  (Wizard — matches Fire Bolt/Ray of Frost already being evocation spells),
  **Thief** (Rogue — the simplest roguish archetype; Rogue's one active
  mechanic is already covered by base-class Sneak Attack, so a purely
  flavor subclass is an honest fit), **Life Domain** (Cleric — matches the
  "support/healer" role Cleric was picked for in D-075, even though none of
  its healing-dependent features can do anything yet).
- **`src/game/systems/CharacterSystem.ts`**: `featuresUpToLevel`/
  `featuresAtLevel`/`activeFeaturesUpToLevel` were re-typed from
  `CharacterClassDefinition` to a minimal structural `HasFeatures` (`{
  features: ClassFeature[] }`) so they work identically on a class's
  top-level features OR a subclass's — no duplicate functions needed,
  and every existing call site still compiles unchanged (a
  `CharacterClassDefinition` already satisfies the narrower type).
- **`src/game/data/classes.ts`**: the four subclass-choice feature entries
  (Martial Archetype, Arcane Tradition, Roguish Archetype, Divine Domain)
  now name their modeled subclass instead of just saying "deferred."

**Every one of the twenty new subclass features is `mechanicallyActive:
false`.** This is not an oversight — checked explicitly before writing a
single one:
- No subclass's earliest feature lands before its class's own
  subclass-choice level, and every created character is always level 1
  (unchanged since Phase 11.1) — so literally none of this is reachable by
  ANY currently-playable character, regardless of which subclass they'd
  pick.
- Independent of level, the specific mechanics involved — critical hits,
  saving throws, reactions, bonus actions, healing, skill checks,
  self-damage/backlash — have no system in this game to plug into. Even
  Life Domain's Divine Strike, which is structurally identical to the
  Rogue's ALREADY-active Sneak Attack (both are flat rider damage on a
  class's basic attack, both could reuse `bonusDamageForClassAtLevel`), was
  deliberately left inert: it first triggers at Cleric level 8, unreachable
  by a level-1 character, so wiring it in would have zero observable effect
  and zero test coverage beyond "the number is right" — not worth the
  complexity of teaching `heroDefinitionFromBuild` about a build's
  subclass (a concept it doesn't have yet, since there's only one option
  per class and thus no real "choice" to record).
- Considered and rejected: Wizard's Empowered Evocation (add INT modifier
  to one evocation spell/cantrip's damage per turn, at level 10). Unlike a
  flat per-level rider, this needs the character's ability modifier
  re-applied at cast time — a different shape of math than
  `bonusDamageByLevel` supports, and again unreachable at level 1. Recorded
  as data, correctly inert, not force-fit into the existing rider
  mechanism just because Sneak Attack's shape was convenient.

**Why no `CharacterBuild.subclassId` field yet:** with exactly one subclass
modeled per class, there is no real CHOICE to make yet, and no created
character can reach any subclass's first feature anyway — adding a field
nothing meaningfully varies would be scaffolding without a payoff. A future
slice that gives a class a second subclass ALTERNATIVE is the natural
trigger to add that field and (if any alternative has an active feature
reachable sooner) wire it into `heroDefinitionFromBuild`.

This is new SRD-derived content — logged in `CONTENT_SOURCES.md` per the
existing "Rules for future chats" section (SRD 5.2.1, CC BY 4.0,
attribution required before public release). All feature descriptions are
original wording, not copied SRD text, matching every class table's
precedent.

**Still deferred:** alternative subclasses for any class (only one exists
per class today); wiring the two subclass features that are STRUCTURALLY
ready to be active whenever a level-8+/level-10+ character exists (Divine
Strike, Empowered Evocation); everything else in D-075's "still deferred"
list, unchanged.

Verified: `npm run typecheck` pass, `npm test` pass (**255/255**, +9 from
`tests/subclasses.test.ts` — was 246), `npm run build` pass (42 modules,
unchanged — `subclasses.ts` isn't imported by any scene/system yet, only
tests, so it doesn't add to the bundle, same as `feats.ts`), `npm run dev`
serves HTTP 200. This chat is pure rules-engine data — no scene changes, so
nothing new needs a browser pass.

## Phase 11.4 — Party assembly + AI-controlled heroes (this chat)

### D-077 — Party size selection, per-hero Human/AI control, AI-plays turns, and difficulty scaling
Per D-071's roadmap, 11.4 is "party size selection, human-vs-AI mix per slot,
a 'human picks level-ups, AI plays' mode, and difficulty scaling by party
size." All four landed this chat, additively, on top of `CharacterCreationScene`
(11.1-11.3) — the classic fixed-roster START button is untouched and plays
at party-size-4/Normal exactly as before this phase.

- **Party size stays capped at 4 for now** (selectable 1-4), NOT expanded
  past today's fixed roster size. The test map has exactly four hero-start
  ('H') tiles; a true variable-size map (more tiles, or reflow logic) is
  explicitly D-071's 11.7 (map overhaul), not this slice. Asked Kevin
  directly rather than defaulting either way (same practice as D-070's
  scope fork); he chose staying capped at 4 over expanding the map early.
- **Per-slot Human/AI control** — `CharacterBuild`/`HeroDefinition` gained
  an optional `controlledBy: "human" | "ai"` field (absent = "human", so
  every existing build/definition, including the classic roster, is
  unaffected). `CharacterCreationScene`'s old plain "Hero N" header became a
  clickable toggle in the SAME spot — no layout reshuffle needed.
- **`HeroAISystem`** (new, pure, no Phaser) — an AI-controlled hero's
  automatic turn, DELIBERATELY mirroring `WaveSystem.tickEnemyPhase`'s own
  enemy-phase choice rather than inventing a separate policy: attack a
  target already in range and hold, or (if none) advance toward the nearest
  living enemy as far as this turn's movement budget allows (reusing
  `MovementSystem.reachableTiles`, the same reachability a human's
  move-highlight uses) and attack from the new tile if that closes into
  range. Asked Kevin directly whether this minimal policy or a smarter one
  (target prioritization, retreat-when-low, ability use) was wanted for a
  first pass; he chose the minimal, enemy-AI-mirroring option — smarter
  heuristics are a future slice if wanted, not invented ahead of an ask.
  `BattleScene.runAIHeroTurns()` runs every AI hero's turn automatically at
  the start of each player phase (right after the existing
  `hero.resetForNewTurn()` loop), applying the decision through the SAME
  `tryBasicAttack`/`hero.moveTo` code a human's click already uses — no
  parallel action-resolution path.
- **Difficulty tiers + party-size scaling** (`data/difficulty.ts`, new) —
  Easy/Normal/Hard/Nightmare, each a flat `enemyCountMultiplier`/
  `enemyHpMultiplier` pair (first-pass starting values, e.g. Normal = 1x/1x;
  real tuning deferred to Kevin's in-browser play, same as every other
  balance number in this project — KI-015/KI-022/KI-028). A SECOND
  multiplier, `partySizeScalingFactor` (linear against the roster's
  balanced size of 4 — e.g. a solo hero faces a quarter of a full party's
  opposition), combines multiplicatively with the difficulty tier's own
  multiplier. `WaveSystem` gained two new, OPTIONAL `WaveSystemOptions`
  fields (`enemyCountMultiplier`/`enemyHpMultiplier`, both default 1, so
  every pre-existing WaveSystem test and caller is unaffected) — it scales a
  wave group's spawn count (rounded, minimum 1 so a multiplier never zeroes
  out a group) and each spawned enemy's max HP (via a shallow-cloned
  `EnemyDefinition`, so the shared registry entry is never mutated).
  `CharacterCreationScene` picked difficulty is passed to `BattleScene` via
  `scene.start`'s data; party size is NOT sent separately — `BattleScene`
  derives it from `heroDefinitions.length`, which is always the true count
  and can't drift out of sync with what was actually built.
- **Dimmed, not removed, inactive slots:** picking a smaller party size dims
  the extra hero panel(s) in `CharacterCreationScene` and disables their
  buttons, rather than hiding/destroying them — the panel's build state is
  preserved (so bumping party size back up doesn't lose anything typed in),
  and validation (unique name/ability) only runs over the ACTIVE slots.

Verified: `npm run typecheck` pass, `npm test` pass (**272/272**, +17 —
`tests/difficulty.test.ts` new, `tests/heroAISystem.test.ts` new, plus
additions to `tests/waves.test.ts` and `tests/characterBuildSystem.test.ts`
— was 255), `npm run build` pass (44 modules, up from 42 — the two new pure
systems, `data/difficulty.ts` and `systems/HeroAISystem.ts`), `npm run dev`
serves HTTP 200. `CharacterCreationScene`'s new controls (party size/
difficulty buttons, the Human/AI toggle) and `BattleScene`'s AI-hero turns
are UI/gameplay-feel and are NOT yet confirmed by a human — see
KNOWN_ISSUES KI-040.

**Still deferred, unchanged from D-071's roadmap:** 11.5 (equipment/magic
items/Compendium) through 11.10 (map builder). Within 11.4 itself: any
smarter AI heuristic than the minimal mirror above; true party sizes beyond
4 (11.7's map overhaul); a `subclassId`/per-hero level-up path for
AI-controlled heroes (level-ups still apply per D-056's existing wave-based
cadence, unaffected by who controls a hero).

### D-078 — Classic multi-slot equipment (7 gear slots), potions, and an in-game Compendium
Per D-071's roadmap, 11.5 is "equipment/magic items/potions expansion, plus
an in-game Compendium." Kevin was asked two scope forks directly before
building (same practice as every prior Phase 11 fork):

- **Equipment slots:** offered "stay at one slot, bigger catalogue" vs. "grow
  to two slots (e.g. weapon + accessory)." Kevin asked for something bigger
  than either option — the classic RPG loadout: **Head, Chest, Legs, two
  Rings, Amulet, Footwear, plus two General slots for things like
  potions** (seven gear-slot instances across six slot TYPES, since both
  rings accept the same item type).
- **Potions:** offered as a yes/no add. Kevin confirmed yes.

**Equipment (`data/equipment.ts`, rewritten):** `GearSlotId` (the seven
instances: `head`/`chest`/`legs`/`ring1`/`ring2`/`amulet`/`footwear`) and
`GearSlotType` (the six types a catalogue item targets — `ring` fits either
ring instance). The catalogue grew from 3 items to 12 (two per slot type).
Every item still grants only flat `attackDamage`/`defense` (same as Phase
7's D-057) — no new combat mechanic, since this game still has no dice/crit/
proc system for a "chance to X on hit" magic item to hook into (D-047
addendum); "magic item" here means more items across more slots, not new
engine hooks. Three items (Iron Buckler, Traveler's Cloak, and Whetstone
Blade — renamed Whetstone Band for its new ring slot) carry over from Phase
7 with identical stats/costs, now given a real slot.

**Potions (`data/potions.ts`, new):** two general slots per hero, separate
from the seven gear slots, holding consumable `PotionDefinition`s bought
from the same in-battle shop. A potion is spent as the hero's ACTION — no
new action-economy system needed, it just consumes the existing
move-plus-one-action turn (D-019/D-031). Two effect kinds, both flat and
instant (no duration/expiry tracking): `"heal"` (Healing Draught, +6 HP
capped at max) and `"attackBuff"` (Vigor Tonic, +2 attack for the rest of
the battle — mechanically identical to a level-up Might choice, just
delivered by a consumable). Using a potion always spends the lowest-numbered
loaded general slot; a picker for "which of your two potions" was judged
more UI than the choice is worth.

**`Hero`:** `equippedItemId: string | null` became `equippedItems:
Partial<Record<GearSlotId, string>>` and a new `equippedPotions:
Partial<Record<GeneralSlotId, string>>`. `defense`/`effectiveAttackDamage`
now SUM bonuses across every filled gear slot (was a single lookup). New
`usePotion(slot)`/`hasAnyPotion()`/`firstLoadedPotionSlot()`.

**`BattleScene` Gear UI:** the Gear grid now shops equipment AND potions
from one combined 14-item catalogue (`GEAR_CATALOG_ORDER`), each button
tagged with its slot type. Clicking an item then a hero auto-places it into
the correct slot instance (single-instance slot types go directly; "ring"
items fill the first empty ring, replacing ring1 if both are full; potions
work the same way against the two general slots) — clicking a hero already
carrying that exact item unequips it instead. This was a deliberate
simplification over a two-step "pick a slot, then an item" UI: the
mechanical depth (seven real slots, all summing bonuses) is unchanged, but
the click flow stays the same one used since Phase 7 rather than adding a
new picker mode, which was judged the lower-risk change to make in a
browser-less environment. A new **Potion (P)** button, next to Ability,
drinks a carried potion as the hero's action. `GAME_HEIGHT` raised 1000 ->
1080 (same bounding-box-math precedent as the 900->1000 change) because the
14-item Gear grid is now taller (4 rows) than the 7-item Shop grid (2 rows),
which used to set the Done button's height budget.

**`CompendiumScene` (new, reached from a new MainMenuScene button):**
read-only — renders EXISTING data (classes, subclasses, races, feats,
spells, equipment, potions, status effects) via 8 category tabs; adds or
duplicates no content of its own. Classes alone get a per-class selector
plus simple Prev/Next pagination (Fighter alone has 21 level-1-20 features;
every other category is short enough to render as one flat list on one
screen).

Verified: `npm run typecheck` pass, `npm test` pass (**283/283**, +11 —
`tests/potions.test.ts` new (8), plus additions to `tests/equipment.test.ts`
(3 net new after the single-slot suite was rewritten for multi-slot) — was
272), `npm run build` pass (48 modules, up from 44 — `data/potions.ts` and
`scenes/CompendiumScene.ts`), `npm run dev` serves HTTP 200. The reworked
Gear/Potion UI and the new Compendium screen are UI/gameplay-feel and are
NOT yet confirmed by a human — see KNOWN_ISSUES KI-041.

**Still deferred:** 11.6 (bestiary) through 11.10 (map builder), per D-071.
Within 11.5 itself: a slot-by-slot Gear picker UI (today's auto-placement is
a first pass); a "which potion" chooser when both general slots are loaded
with different potions; any equipment effect beyond flat attack/defense
(elemental damage, on-hit status, movement bonus) — all blocked on either a
dice/proc system (D-047 addendum) or, for movement, a decision to touch
`MovementSystem`'s effective-speed calculation, neither asked for this
chat.

### D-079 — Enemy roster expansion (2 minions, 2 true bosses) plus a localStorage-backed, unlock-on-encounter Bestiary
Per D-071's roadmap, 11.6 is "enemy/miniboss/boss roster design ... and the
Bestiary (unlock-on-encounter/kill progression, mixing useful in-game info
with flavor/lore text)."

**Roster (`data/enemies.ts`):** `EnemyRole` grows from `"minion" | "miniboss"`
to `"minion" | "miniboss" | "boss"` — a new tier explicitly ABOVE miniboss,
reserved for enemies meaningfully tougher than `basalt-colossus` (which stays
`"miniboss"`, unchanged, still the wave-10 finale). Added:
- **Hexer** and **Ravager** (both plain minions, role omitted like the rest
  of the pre-11.6 roster): the Hexer is the roster's first range-3 threat (a
  fragile back-line nuisance); the Ravager is the roster's fastest mover (4
  tiles), a hard-closing melee threat. Both clearly differentiated from the
  existing seven by stat SHAPE, not just bigger numbers.
- **Cinderlord** (fire-themed) and **Tidelord** (water-themed), both `role:
  "boss"` — meaningfully tougher than `basalt-colossus` on every axis (more
  HP, more-or-equal defense, a heavier breach, a bigger purse). Named/themed
  so Phase 11.7's matching fire/water terrain and Phase 11.8's campaigns have
  something to build around. Neither is wired into `data/waves.ts` yet — that
  remains explicitly out of scope for this sub-phase, per D-071's own
  ordering (11.8 is campaigns).
- A new optional `loreText?: string` field on `EnemyDefinition` — one or two
  sentences of original flavour text, required on both new bosses, added as
  a bonus to `basalt-colossus` too. No new combat mechanic anywhere (still
  diceless, D-030): every new enemy is just a bigger or differently-shaped
  stat block, same as every enemy before it.

**Bestiary (`systems/BestiarySystem.ts`, new; `scenes/BestiaryScene.ts`,
new):** a pure, storage-agnostic module tracking per-enemy-id SEEN/KILLED
flags, mirroring `SettingsSystem`'s exact load/save/defensive-parse pattern
(`BESTIARY_STORAGE_KEY`, new in `config.ts`, alongside the existing settings/
tutorial keys). Killed always implies seen. `BattleScene` gained two hook
points, both additive with no gameplay effect: every `report.spawned` enemy
in `runEnemyPhase` marks its definition id SEEN, and `awardKillGold` marks
each removed enemy's definition id KILLED. Both mark-functions return the
SAME object reference when nothing changed, which `BattleScene` uses to skip
redundant localStorage writes rather than saving every tick.

`BestiaryScene` (reached from a new MainMenuScene "Bestiary" button, same
button-building helper/placement discipline as the Compendium button) is
modeled directly on `CompendiumScene`'s visual conventions but is NOT a
read-everything reference screen: an unseen enemy renders as a locked "???"
entry with no name/stats/lore, revealing fully once seen, plus a small
"[Defeated]" tag once killed at least once. Grouped by role (Minions /
Miniboss / Bosses) as section headers in one scrollable text panel — no
per-category tabs, since (unlike the Compendium's eight categories) there is
only one thing to browse here.

Verified: `npm run typecheck` pass, `npm test` pass (**296/296**, +13 —
`tests/bestiary.test.ts` new (11), plus 2 net new in `tests/campaign.test.ts`'s
roster block, which was also fixed: its old "minions = not miniboss" filter
would have silently miscounted the new "boss" role as a minion — was 283),
`npm run build` pass (50 modules, up from 48 — `systems/BestiarySystem.ts`
and `scenes/BestiaryScene.ts`). The new Bestiary screen and menu button are
UI/gameplay-feel and are NOT yet confirmed by a human in a browser.

**Deferred, unchanged from D-071's roadmap:** 11.7 (map terrain, including
the fire/water terrain the two new bosses are themed for) through 11.10 (map
builder). Within 11.6 itself: lore text was only added to the two new bosses
plus `basalt-colossus`, not backfilled across the other seven pre-11.6
enemies — judged a grind not worth the time for this sub-phase, per the
task's own "optional nice-to-have" framing. No bestiary "reward" system
(unlocking items/gold for filling it in) was built — explicitly out of scope.

### D-080 — Two boss-themed campaigns assembled from 11.6's roster and 11.7's maps
Per D-071's roadmap, 11.8 is "boss-themed campaigns: one boss, one themed
enemy lineup, one unique map per campaign." Delivered as a new, additive
`CampaignDefinition` layer sitting entirely alongside — not replacing —
`data/waves.ts`'s existing `WAVES`/`TEST_MAP`, which stay exactly as they
are and continue to serve the classic fixed-roster START path unchanged.

**Data (`data/campaigns.ts`, new):** `CampaignDefinition` (`id`, `name`,
`description`, `mapId`, its own `waves: WaveDefinition[]`, `bossEnemyId`),
`getCampaignDefinition(id)` (throws on an unknown id, matching
`getEnemyDefinition`'s convention), and `getCampaignMap(mapId)` (resolves a
campaign's `mapId` back to the actual `ParsedMap` — the one seam between
"campaign data names a map" and "BattleScene needs the real map object").
Two campaigns, each a deliberately-scoped **6 waves** (not a full 10-wave
design per campaign — that is explicitly out of scope for one sub-phase):
- **Emberford Reach** (`EMBERFORD_MAP`, fire/acid/cliff): grunt →
  grunt+ravager → hexer+runner → warden+brute+ravager → full-muster mix →
  finale escort + **Cinderlord**.
- **Saltmere Shallows** (`SALTMERE_MAP`, water/cliff): runner → runner+ravager
  → hexer+wisp → warden+swarmling → razorwing+ravager+hexer → finale escort
  + **Tidelord**.

Every number is a first-pass, untuned guess, same KI-015 caveat every prior
wave list carries.

**Fix folded in (11.7 follow-up):** `EMBERFORD_MAP`/`SALTMERE_MAP` (built in
11.7 as pure parseable-data showcases, not yet wired anywhere) had ZERO
hero-start (`H`) tiles. Wiring them into a real battle exposed that
`BattleScene.buildHeroes`'s `starts[i] ?? starts[0]` fallback needs at least
one — with none, every hero's start position would be `undefined`. Both maps
gained four `H` tiles on their open top row (plain floor, no interaction
with existing terrain/shop/treasure tiles) so they support the same
up-to-4-party-size range `TEST_MAP` does.

**Wiring:** `BattleScene.init()`'s data param gained an optional
`campaignId?: string`. In `create()`, `campaignId` set resolves
`getCampaignDefinition`/`getCampaignMap` and uses THAT map/wave-list;
omitted (the classic START button, or a campaign-less "Create Party" run)
reproduces `TEST_MAP`/`WAVES` byte-for-byte — the only chokepoint touched.
`CharacterCreationScene` gained a matching optional `campaignId` in its own
`init()`, stored and forwarded unchanged into its existing
`scene.start("BattleScene", {...})` call — the plain "Create Party" button
still leaves it `undefined`. A new `CampaignSelectScene` (modeled on
`BestiaryScene`'s visual conventions) lists both campaigns with a
completed/not-completed tag and hands off to `CharacterCreationScene` with
`{ campaignId }` on selection — the player still builds a party through the
existing flow, no separate hero-picking UI. `MainMenuScene` gained a
"Campaigns" button, same helper/placement discipline as Bestiary before it.

**Persistence (`systems/CampaignProgressSystem.ts`, new;
`CAMPAIGN_PROGRESS_STORAGE_KEY` in `config.ts`):** a pure, storage-agnostic
module tracking per-campaign-id completion, deliberately its OWN system
rather than folded into `BestiarySystem` — same "one system, one job"
convention `SettingsSystem`/`BestiarySystem` already established despite
sharing an identical localStorage mechanism. `BattleScene`'s "victory" phase
hook marks the active `campaignId` (if any) completed, with the same
same-reference no-op-write discipline `markEnemySeen`/`markEnemyKilled` use.
`isCampaignCompleted` is exported as a clean, reusable query — Phase 11.9
(free-play unlock gating, NOT this sub-phase) is expected to read it, but
building that gating is explicitly deferred to 11.9.

Verified: `npm run typecheck` pass, `npm test` pass (**347/347**, +20 —
`tests/campaigns.test.ts` new (10), `tests/campaignProgress.test.ts` new
(8), plus 2 new hero-start assertions added to `tests/newMaps.test.ts` —
was 327), `npm run build` pass (56 modules). No browser available in this
environment — the new `CampaignSelectScene` and "Campaigns" button are
UI/gameplay-feel and are NOT yet confirmed by a human.

**Deferred, unchanged from D-071's roadmap:** 11.9 (free-play mode with
unlock gating that CONSUMES `isCampaignCompleted`) through 11.10 (map
builder). Within 11.8 itself: each campaign stays at 6 waves rather than a
full 10; `CharacterCreationScene`'s "Back to Menu" button still always
returns to `MainMenuScene` rather than back to `CampaignSelectScene` when a
campaign was picked (a small, low-risk UX nit, not fixed this chat).

### D-081 — Map overhaul: terrain types, multiple in/out tiles, shop/treasure tiles, proximity-gated build/shop, per-hero structure carry limits
Per D-071's roadmap, 11.7 is "map system overhaul: terrain types (water/acid/
fire/cliffs), multiple in/out tiles, shop/treasure tiles, proximity-gated
building/shopping (replacing today's build-anywhere/shop-anywhere rules),
per-hero structure carry limits." (Implemented in the same day's session as
11.6/11.8/11.9, but not logged here at the time — recorded now for a
complete decision trail.)

**Terrain (`data/testMap.ts`, `systems/GameMap.ts`, `data/terrain.ts` new):**
`TileType` grows from `"floor" | "blocked"` to add `"cliff"`, `"water"`,
`"fire"`, `"acid"`. Cliff is mechanically identical to `"blocked"` for ground
units and automatically flyable (the existing `ignoreWalls` flying-route
mechanism only checks map bounds, not tile type — zero `PathfindingSystem`
changes needed). Water/fire/acid are all WALKABLE but carry a per-tile
`TerrainEffect`, applied to enemies only (never heroes, mirroring how traps
already only affect enemies): fire applies the existing `"burning"` status,
water applies the existing `"slowed"` status (ground only — flyers pass
over untouched), acid deals flat instant damage (ground only). No new status
effects or weighted/Dijkstra pathfinding were introduced — terrain effects
plug into the SAME trap-callback contract `WaveSystem.tickEnemyPhase`
already exposes (`trapAt`/`trapTargets`/`trapStatusAt`), which
`BattleScene` now composes as "check `BuildSystem`'s placed trap first, fall
back to `GameMap.terrainEffectAt`" — a reuse, not a new mechanism.

**New maps (additive, unwired until 11.8 used them):** `EMBERFORD_MAP`
("Emberford Reach," volcanic — cliff/fire/acid, 2 spawns/2 exits, a shop
tile, a treasure tile) and `SALTMERE_MAP` ("Saltmere Shallows," tidal —
cliff/water, 2 spawns/2 exits, a shop tile, a treasure tile). `TEST_MAP`
itself is completely untouched — no terrain, no shop/treasure tiles, still
the classic path's map.

**Proximity gating (`systems/BuildSystem.ts`):** a structure may only be
placed within `BUILD_RANGE_TILES` (3, Manhattan) of at least one living
hero — replaces "build anywhere." Shopping (the Gear HUD) is only
interactable while a living hero stands on or adjacent to a `"shop"`-role
tile — replaces "shop anywhere," with a deliberate backward-compatible
carve-out: a map with ZERO shop tiles (i.e. `TEST_MAP`, the only map
actually reachable in real battles as of this decision) leaves the Gear HUD
UNGATED, since a literal reading would have permanently locked it on the
one map anyone could actually play — the lock only activates once a map
defines at least one shop tile. Both `canPlace`/`place`'s new
`heroPositions`/`builtBy` parameters are OPTIONAL and unenforced when
omitted, so every pre-existing `BuildSystem` call/test keeps working
unchanged.

**Per-hero structure carry limit:** each hero may have at most
`MAX_STRUCTURES_PER_HERO` (3) structures attributed to them at once,
auto-attributed to whichever living hero is CLOSEST to the placement tile
at the moment of building (no new hero-selection UI — inferred from the
same proximity check building already requires). Freed when the structure
is removed.

**Treasure tiles:** a living hero moving onto a `"treasure"`-role tile
for the first time this battle grants a one-time flat gold bonus via the
existing `EconomySystem.award`, then that tile instance is marked consumed
(per-battle only, not persisted).

Verified: `npm run typecheck` pass, `npm test` pass (**327/327**, +31 —
`tests/terrain.test.ts` (13), `tests/newMaps.test.ts` (10),
`tests/building.test.ts` (+8) — was 296), `npm run build` pass (51
modules). The shop-HUD lock label and treasure gold toast have no automated
test (pure scene glue over already-tested pure pieces) and are, like every
other UI addition this phase, unconfirmed by a human in a browser.

**Deferred, unchanged from D-071's roadmap:** the new maps stayed unwired
to any scene until 11.8 (D-080) used them; heroes remain unaffected by
terrain (enemies only, a deliberate scope boundary, not an oversight); no
weighted-cost pathfinding was introduced.

### D-082 — Free-play mode: configurable wave count/boss/minion source/map, difficulty, unlock gating tied to campaign completion
Per D-071's roadmap, 11.9 (the last of the four sub-phases landed this
session) is "free-play mode: configurable wave count/boss/minion
source/map, difficulty tiers, unlock gating tied to campaign completion."

**Generator (`systems/FreePlayWaveGenerator.ts`, new):** a pure,
DETERMINISTIC `generateFreePlayWaves({ waveCount, minionPool,
bossEnemyId })` — no `Math.random`/`Date.now`, consistent with this
project's diceless-combat philosophy (D-030/D-047 addendum) and needed for
reproducible tests. Non-finale waves round-robin through `minionPool` with
a gently escalating count/reward; the final wave mixes a 2-3 enemy escort
with exactly one `bossEnemyId` entry, mirroring `WAVES`' and the 11.8
campaigns' own finale shape.

**Maps registry (`data/maps.ts`, new):** `MAPS`/`getMapById(id)` covering
`TEST_MAP`/`EMBERFORD_MAP`/`SALTMERE_MAP` — a general-purpose lookup that
11.8's narrower `campaigns.ts`-local `getCampaignMap` couldn't serve (it
never included `TEST_MAP`), kept as a separate, wider registry rather than
widening that narrower helper's job.

**Config screen (`scenes/FreePlayScene.ts`, new, reached via a new
MainMenuScene "Free Play" button):** pickers for map (3 options), boss (3
options), wave count (Short 4 / Medium 7 / Long 10 — preset buttons, no
free-typed number, consistent with this project having no text-input UI
anywhere), minion source (Standard = the original 7 pre-11.6 minions vs.
Expanded = adds Hexer/Ravager), and difficulty (reusing the existing
`DifficultyId` picker pattern). "Start" generates the wave list and hands
off to `CharacterCreationScene` — reusing the existing party-builder flow,
not a new one.

**Unlock gating:** `TEST_MAP`/`basalt-colossus` are always available.
`EMBERFORD_MAP`/`cinderlord` unlock once `CampaignProgressSystem` reports
"Emberford Reach" completed; `SALTMERE_MAP`/`tidelord` unlock once "Saltmere
Shallows" is completed — the standard "beat the story content to unlock
custom/endless play on it" pattern. Locked options render visibly but
disabled, with an unlock hint.

**Wiring:** `BattleScene.init()` gained optional `freePlayMapId`/
`freePlayWaves`, consulted only when `campaignId` is unset (checked
second in the existing chokepoint, after the campaign branch, before the
`TEST_MAP`/`WAVES` fallback) — the classic and campaign paths are
unaffected. A free-play victory does NOT write to `CampaignProgressSystem`
(only a real `campaignId` does) — free-play results are not persisted
anywhere.

Verified: `npm run typecheck` pass, `npm test` pass (**354/354**, +7 —
`tests/freePlayWaveGenerator.test.ts` — was 347), `npm run build` pass (59
modules). `FreePlayScene`'s own UI wiring has no automated test (pure
Phaser glue calling already-tested pure functions) and is unconfirmed by a
human in a browser, same caveat as every other scene this phase.

**Deferred, unchanged from D-071's roadmap:** 11.10 (map builder +
sharing) — explicitly SKIPPED for this session on Kevin's own direction,
since it depends on Phase 10 (Firebase hosting), which hasn't started; a
map builder with nothing to save/share through would be dead scaffolding.
No free-play result persistence (no high-score/history tracking) was
built — not asked for.

**This closes out 11.6-11.9 in one session** (11.6 roster/Bestiary, 11.7
map overhaul, 11.8 campaigns, 11.9 free-play) — Phase 11 now has only
11.10 (blocked on Phase 10) remaining on D-071's roadmap, plus the
still-open browser-verification backlog across every UI addition in the
phase and Phase 7's original balance pass.

### D-083 — Phase 9: local save system (named party-build slots)
Per `SOURCE_OF_TRUTH.md`, Phase 9's goal is "save and resume campaigns
without Firebase" (versioned schema, corrupt/incompatible handling, manual
save/load, safe autosave, optional export/import). D-072 deliberately
deferred this until D-070's freeform character system existed — that's now
done through 11.9, so this session picked it up. Kevin made three scoping
calls directly before implementation started:
1. **Checkpoint granularity: between separate runs only**, not mid-battle
   or mid-wave — confirmed after checking `data/campaigns.ts`: a campaign
   run is one continuous multi-wave `BattleScene` session with no existing
   mid-run checkpoint to hang a save off of, so resuming partway through a
   run was never on the table this pass.
2. **Multiple named save slots**, not a single autosave slot.
3. **Export/import deferred** — pairs better with Phase 10 (Firebase).

**What actually gets saved:** the one thing genuinely rebuilt from scratch
every session today is the PARTY BUILD itself — `CharacterCreationScene`
never remembered a built party across a reload. Campaign completion
(`CampaignProgressSystem`) and the Bestiary (`BestiarySystem`) already
persist (global, unslotted) and stay that way — untouched by this phase.

**New `systems/SaveSystem.ts`:** pure, storage-agnostic, mirrors
`BestiarySystem`/`CampaignProgressSystem`'s exact pattern (a `SaveStorage`
interface matching `localStorage`, JSON load/save, per-slot structural
validation with corrupt slots dropped individually rather than failing the
whole load, no-op-same-reference on an update/delete against an unknown
id). `SaveFile { version, slots }` — a `version` mismatch (missing, wrong,
or a future value) resets to the empty default rather than crashing or
guessing at a migration; real migration logic gets written when a v2 shape
actually ships. `MAX_SAVE_SLOTS = 6` bounds the new list screen, since no
scrolling UI exists anywhere in this project to page through more.

**`CharacterBuildSystem.ts` gained `allocatorFromScores`:** the inverse of
`StandardArrayAllocator.scores()` — reconstructs an allocator from a stored
`AbilityScores` object (sorting abilities by which standard-array slot their
score occupies), falling back to the default order on an invalid/corrupt
permutation. Needed because loading a save has to seed a fresh allocator
from what was saved, which nothing previously did.

**`CharacterCreationScene.ts`:** gained an optional `loadedSlotId`/
`loadedParty` init passthrough (set by the new `LoadGameScene`'s "Load"
button) that seeds every slot from a saved `CharacterBuild[]` instead of
fresh defaults. A new "Save Party" button sits beside Start Battle (mirrors
the party-size/difficulty row's own left/right split one row up); it
creates a new slot or updates the loaded one, auto-naming a new slot
`` `${firstHeroName}'s Party` `` — no free-text input exists anywhere in
this project, so this matches the established "cycle a value, don't type
it" convention rather than introducing the first text field. Start Battle
silently re-saves an already-loaded/saved slot before starting (the "safe
autosave" — it only ever touches a slot the player explicitly
created/loaded, it never creates one on its own).

**New `scenes/LoadGameScene.ts`** (reached via a new top-left MainMenuScene
button, mirroring the existing top-right Settings control rather than
adding a 7th entry to the already-tight vertical button column — see that
scene's own comment for the bounding-box math): card-per-slot layout copied
from `CampaignSelectScene`'s pattern (chosen over `BestiaryScene`/
`CompendiumScene`'s plain-text pattern because each row needs two buttons).
Load hands the slot straight to `CharacterCreationScene`; Delete removes it
immediately — no confirmation dialog exists anywhere in this project today,
so this matches that norm (tracked as a low-priority nit, KI-046, same tier
as KI-033's).

**Explicit scope boundary — a loaded save feeds ONLY the plain
party-builder flow.** It does not plug into `CampaignSelectScene`'s or
`FreePlayScene`'s own routes into `CharacterCreationScene` (those pass
`campaignId`/`freePlayMapId`/`freePlayWaves`, not a saved party) — wiring
"resume this saved party into a specific campaign/free-play run" is a
natural next step, deliberately deferred here to keep this pass bounded.

Verified: `npm run typecheck` pass, `npm test` pass (**368/368**, +14 —
`tests/saveSystem.test.ts` [11] plus 3 new `allocatorFromScores` cases in
`tests/characterBuildSystem.test.ts` — was 354), `npm run build` pass (61
modules, up from 59), `npm run dev` HTTP 200. No browser available here —
the Load Game screen, the Save Party button, and the load-prefill round
trip are all unconfirmed by a human — see KI-046.

### D-084 — Phase 10: Firebase Hosting, Authentication, and Cloud Saves
Per `SOURCE_OF_TRUTH.md`, Phase 10's goal is "deploy the stable game and
optionally sync saves" (hosting, simple sign-in, owner-scoped cloud saves,
Security Rules + tests, local-first fallback, budget safeguards). Kevin
asked to build this right after Phase 9 (D-083) shipped, and answered two
scoping questions directly before any code was written:
1. **Auth: anonymous by default, with an optional Google sign-in upgrade**
   (account linking) rather than either anonymous-only or a mandatory
   real sign-in.
2. **Deploy live this session**, once working — with an explicit
   confirmation before the actual `firebase deploy`, since that's a real,
   visible, publicly-reachable action, different in kind from every prior
   change in this project.

**Real constraint, stated upfront rather than discovered mid-build:** part
of this phase is not code — Kevin has to create the Firebase project and
enable services in the console (no environment access to his Google
account), and `firebase login`'s interactive OAuth flow can't be driven by
this sandboxed, non-interactive shell. See the new `FIREBASE_SETUP.md` for
his exact checklist. Everything else was built to work with ZERO Firebase
project configured — this IS the "local-first fallback" acceptance
criterion, not a separate mode: `firebaseReady` (in the new
`src/game/cloud/firebaseApp.ts`) is false whenever any `VITE_FIREBASE_*`
env var is missing, and every other cloud module/UI element checks it
first and goes inert rather than erroring.

**Scope boundary:** cloud sync covers ONLY `SaveSystem`'s save slots (the
party builds from Phase 9) — `CampaignProgressSystem`/`BestiarySystem`
stay local/global exactly as before, same "keep each phase bounded"
discipline as D-083's own note. Sync is CHECKPOINT-TRIGGERED ONLY (a
save/delete/explicit "Sync with Cloud" click) — no realtime listeners,
nothing on a timer — directly satisfying the spec's "do not send every
move, frame, or hover to Firestore" boundary.

**New top-level `src/game/cloud/` folder** — a deliberate, explicit
exception to the `systems/`+`data/`+`entities/`+`scenes/` split (CLAUDE.md
rule 3/4): this is IO/infrastructure glue to an external service, not a
pure game rule, so it doesn't belong in `systems/` alongside the
unit-tested engines. `systems/SaveSystem.ts` itself is untouched in shape
— the cloud layer wraps it, never replaces it — and gained exactly one new
primitive, `upsertSaveSlot` (insert-or-replace a slot WHOLESALE, preserving
its own `createdAt`/`updatedAt` rather than deriving them from a
caller-supplied timestamp like `createSaveSlot`/`updateSaveSlot` do) —
needed because a slot pulled down from the cloud already has its own
authoritative timestamps.

- **`firebaseApp.ts`** — the one `initializeApp` call; exports
  `firebaseReady` plus `getFirebaseAuth()`/`getFirebaseDb()` (throw if
  called while `!firebaseReady` — every caller checks first).
- **`AuthClient.ts`** — every session auto-signs-in ANONYMOUSLY
  (`initAuth`) so a uid always exists; `signInWithGoogle()` LINKS that
  identity to a real Google account (`linkWithPopup`) so anything already
  saved under the anonymous uid carries forward, falling back to
  `signInWithCredential` on the known `auth/credential-already-in-use`
  case (that Google account already belongs to a different, pre-existing
  Firebase user — sign into THAT one, since it has the real history);
  `signOutAndResetAnonymous()` signs out then immediately re-establishes a
  fresh anonymous session.
- **`CloudSaveSync.ts`** — one Firestore document per save slot at
  `users/{uid}/saves/{slotId}` (mirrors Phase 9's own per-slot CRUD shape,
  not one big array document, so `firestore.rules` can validate/scope
  ownership per-document). `syncNow(uid, localFile)` is the one merge
  entry point: LAST-WRITE-WINS on `updatedAt` per slot id (simplest
  correct policy, consistent with this project's style elsewhere) — pulls
  anything cloud-newer or cloud-only down via `upsertSaveSlot`, pushes
  anything local-newer or local-only up. Deliberately NOT pure/unit-tested
  like `systems/` — real network IO; its correctness is covered by the
  emulator-backed rules tests instead.

**UI wiring:** `MainMenuScene` gained a small Account control (top-left,
under the existing Load Game button) — "Sign in with Google" / "Signed in:
`<name>` (tap to sign out)" — rendered ONLY when `firebaseReady` (nothing
to show otherwise, matching this project's "don't render an
always-disabled control" norm). `LoadGameScene` gained a "Sync with Cloud"
button (enabled only when actually signed in with Google — syncing a
throwaway anonymous uid nobody can ever reach again isn't worth writing to
Firestore for) and mirrors a slot delete to the cloud too, so a
synced-away slot doesn't reappear on the next sync.
`CharacterCreationScene`'s existing `onSaveParty`/autosave-on-Start-Battle
paths now also push the just-saved slot to the cloud (fire-and-forget;
the local save already succeeded regardless — cloud is best-effort on
top).

**Firestore Security Rules (`firestore.rules`, new):** owner-scoped
(`request.auth.uid == uid` on the `users/{uid}/saves/{slotId}` path) plus
shape/size validation as the concrete "budget safeguard" — every
top-level/build-level field set is exact (`hasOnly`, rejecting any
unexpected extra key), string fields capped at 100 chars, `party` capped
at `MAX_PARTY_SIZE` (4), `difficultyId`/`controlledBy` restricted to their
real enum values. Not exhaustive leaf-level type-checking (matches this
project's existing "good enough" defensive style, e.g. `BestiarySystem`'s
own entry validation) — a known, stated limit, not an oversight.

**Rules tests (`firestore-tests/rules.test.ts`, new)** using
`@firebase/rules-unit-testing` against the Firebase Local Emulator —
deliberately OUTSIDE `tests/` (with its own `firestore-tests/vitest.config.ts`
and a separate `npm run test:rules` script) so the main `npm test` run
never needs the emulator. **Written but NOT yet run this session** — the
Firestore emulator requires a JDK 21+, and this machine has Java 8
(`1.8.0_501`) only; installing a new JDK is a real change to Kevin's
system, so it wasn't done without asking (see `FIREBASE_SETUP.md` step 8).

**Hosting (`firebase.json`, `.firebaserc`, new):** `dist/` as the public
root with an SPA rewrite; `.firebaserc`'s project id is a placeholder
(`REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`) until Kevin creates his project.
`vite.config.ts`'s `base: "./"` (D-007) already anticipated this — no
change needed there.

**Bundle size:** adding the Firebase SDK pushed the build from ~1.5 MB to
~2.3 MB. KI-005 explicitly said to revisit code-splitting once the hosting
phase arrived — reconsidered here and deliberately NOT done: every scene
(including `MainMenuScene`, which needs the cloud module immediately) is
eagerly imported in `main.ts` to build Phaser's `scene` array, so
splitting `cloud/` into its own chunk wouldn't change time-to-interactive,
only add async-loading complexity for no real win. `chunkSizeWarningLimit`
raised 2000 -> 2500 accordingly.

**New `FIREBASE_SETUP.md`** — the exact checklist for the parts only Kevin
can do (create the project; enable Anonymous + Google sign-in; create
Firestore; fill in `.env`/`.firebaserc`; run `firebase login` in his own
terminal; optionally install a JDK 21+ for the rules tests) before the
actual `firebase deploy` happens.

Verified: `npm run typecheck` pass, `npm test` pass (**370/370**, +2 —
two new `upsertSaveSlot` cases in `tests/saveSystem.test.ts` — was 368),
`npm run build` pass (81 modules, up from 61) — all confirmed with **no
`.env` present**, proving the local-first fallback actually holds rather
than just being claimed. Rules tests (`npm run test:rules`) written but
blocked on a JDK version this session. The actual deploy, and the whole
sign-in/sync UI feel, are unconfirmed pending Kevin's console setup — see
KI-047.

**Addendum (2026-07-30) — deployed; JDK install declined.** Kevin
completed the full `FIREBASE_SETUP.md` checklist (project
`dice-n-defenses`, Anonymous + Google sign-in, Firestore, `.env`/
`.firebaserc` filled in and verified matching, `firebase login` as
`kevinrbuth@gmail.com`). `npm run build` then
`firebase deploy --only hosting,firestore:rules` both succeeded — **live
at https://dice-n-defenses.web.app**. Firestore was created fresh at
deploy time per the CLI log, worth Kevin double-checking its
region/mode in the console. Offered to install a JDK 21+ via `winget`
for the rules tests; **Kevin declined — his machine's IT policy blocks
installing software without IT involvement.** This is a standing
environment constraint, not a one-off "not yet asked": don't re-offer a
`winget`/system-level install on this machine in future chats unless
Kevin raises it himself. `npm run test:rules` stays unrun; production
`firestore.rules` behavior should be confirmed by manual testing instead.

### D-085 — Phase 11.10: Map Builder + Public Map Sharing (closes out the Phase 11 roadmap)
Per D-071, 11.10 was the last item on the Phase 11 roadmap, deliberately
skipped when 11.6-11.9 shipped because it depends on Phase 10 (Firebase
hosting), which hadn't started. Phase 10 is now deployed (D-084), and
Kevin asked to move ahead with 11.10 rather than wait on the outstanding
in-browser verification items elsewhere. D-071 scoped this sub-phase in
one line only ("map builder + sharing, eventually, lowest priority") with
no further mechanical detail, so two scoping questions were asked and
answered directly before any code was written:
1. **Sharing = cloud upload + browse.** A new, PUBLICLY-readable Firestore
   collection where players can publish a built map and browse/play maps
   other players published — not owner-scoped for reads the way Phase
   10's save slots are (that's the one deliberate departure from the
   existing `users/{uid}/...` cloud pattern).
2. **Full 12-character tile palette from day one** (floor/blocked/cliff/
   water/fire/acid/spawn/exit/hero-start/enemy-start/shop/treasure), not a
   basic subset first.

A plan was written and approved before coding, per the same "external
service + several new files" precedent as D-084.

**Real constraint found during planning, not assumed:** `BattleScene`
renders every map at a FIXED `TILE_SIZE` (64px) inside a fixed 1280x1080
canvas, with a status line/combat log/shop-gear button grid stacked below
the board that doesn't grow or shrink with map size. Working through that
fixed layout's own bounding-box math (belowGridY = 90 + rows*64 + 16; the
button row sits at belowGridY + 60 + 86 + 20; the Done button under the
taller shop/gear grid sits 4*38+6 below THAT, plus its own half-height) —
the same technique this project used for D-046/D-055/the 900->1000->1080
canvas bumps — the bottom edge of that HUD stays on-canvas only up to
**9 rows**, exactly what every existing map (16x9) already uses, with
~39px to spare; 10 rows overflows the canvas outright. Columns are far
less constrained (the grid is centered, everything below it is centered/
right-anchored independent of grid width) and can go up to a full-width
**20**. Final caps, in `systems/MapBuilderSystem.ts`: `MIN_MAP_COLS = 6`,
`MAX_MAP_COLS = 20`, `MIN_MAP_ROWS = 6`, `MAX_MAP_ROWS = 9`.

**No new "draft" type.** `ParsedMap` (already in `data/testMap.ts`) is
used directly for a map mid-edit — there's no structural difference from
a finished map, only a "has this passed validation yet" runtime question.
`data/testMap.ts` gained one new export, `encodeMapRows(map): string[]`,
the exact inverse of the existing `parseMapRows` — this is what turns a
painted map back into the row-string format for Firestore storage, and
its round-trip through `TEST_MAP` is the single most load-bearing test in
`tests/mapBuilder.test.ts`.

**New pure system, `systems/MapBuilderSystem.ts`:** `createBlankDraft`,
`paintTile` (pure; a "marker" selection forces the tile to floor and
clears every OTHER role array at that position; a "terrain" selection
clears all role arrays at that position), and `validateDraft` — collects
EVERY failing reason at once (dimensions, row-width consistency, spawn/
exit counts, 1-4 hero-starts) plus the one genuinely new RULE: every
spawn must have a route to some exit, checked by constructing a real
`GameMap`+`PathfindingSystem` and reusing `PathfindingSystem.hasRoute` —
the exact same call `BuildSystem.routesRemainWith` already makes for wall
placement, not reimplemented.

**New pure system, `systems/MapSharingSystem.ts`:** the transform layer
between a `ParsedMap` and `SharedMapRecord` (the actual Firestore document
shape — `id`/`name`/`authorUid`/`authorDisplayName`/`createdAt`/
`updatedAt`/`cols`/`rows`/`tileRows`). Deliberately stores `tileRows`
(flat row-strings via `encodeMapRows`), NOT `ParsedMap`'s nested
`tiles: TileType[][]` — Firestore security rules have no loop construct,
so validating a 2D array cell-by-cell isn't practical, but a `.size()`
string-length check per row is trivial. `fromSharedMapRecord` routes
through the existing, already-hardened `parseMapRows` — that stays the
real gatekeeper against a malformed character on load, exactly as it
already is for the hardcoded maps. `MAX_PUBLISHED_MAPS_PER_AUTHOR = 5`
(same "no scrolling-list UI exists" reasoning as `MAX_SAVE_SLOTS`) is
enforced CLIENT-SIDE only — no Cloud Function available here, same
honesty this project's rules already model elsewhere.

**New cloud module, `cloud/MapSharingSync.ts`** (beside `CloudSaveSync.ts`,
same deliberate exception to the `systems/` split): `pushMap`/
`deleteMapFromCloud`/`listSharedMaps` (cursor-paginated, newest-first)/
`listMapsByAuthor`. Every function checks `firebaseReady` first and
no-ops/returns empty, identical discipline to `CloudSaveSync.ts` — no
realtime listeners, checkpoint-triggered only (a Publish click, opening
Browse, a "load more" click).

**`firestore.rules` — new `sharedMaps/{mapId}` block:** `allow read: if
true` (public — the one deliberate departure from every other rule in
this file), create/update/delete restricted to the author, and an update
can never change `authorUid` (no ownership-transfer path). Shape
validation (`isValidSharedMap`/`isValidTileRows`) mirrors the existing
`isValidSaveSlot`/`isValidParty` style exactly, including the same known,
stated limit: it validates row COUNT and row LENGTH, not that every
character is one of the 12 legal legend characters (still no
per-character loop) — `parseMapRows` remains the real gatekeeper at load
time. New test cases added to `firestore-tests/rules.test.ts` (public
read by signed-out/other users, author-only write, no ownership
transfer, shape/bounds rejection) — **written but NOT run**, same
standing JDK 21+ constraint as KI-047/this file's own D-084 addendum; do
not re-offer a `winget` install.

**New scenes:** `MapBuilderScene` (paint via a `CompendiumScene`-style
Terrain/Markers palette tab strip, click-to-paint reusing
`GridSystem.worldToTile` exactly like `BattleScene`'s own click handling,
its own dynamically-computed tile size — NOT `BattleScene`'s fixed
`TILE_SIZE` — so authoring never feels constrained by the playable-
dimension cap above; Playtest and Publish both gated on `validateDraft`
passing) and `BrowseSharedMapsScene` (modeled on `FreePlayScene`'s
option-row list and wave-count/minion-source/difficulty pickers,
duplicated rather than shared per this project's existing per-scene-
duplication style, with a fetched/paginated map list in place of
`FreePlayScene`'s fixed `GatedOption[]` — nothing here is lock-gated).
Since this project has NO free-text input anywhere (every "name" field
cycles through a preset pool — see `CharacterCreationScene`'s name
cycler), map naming follows the same convention via a small, original
placeholder `MAP_NAME_POOL`.

**`BattleScene`/`CharacterCreationScene` gained one new passthrough
field, `customMapData?: ParsedMap`** (alongside the existing
`freePlayMapId`/`freePlayWaves`), checked last in `BattleScene.create()`'s
map-resolution chokepoint. This is how a drafted-or-fetched `ParsedMap`
gets played WITHOUT going through the by-id `data/maps.ts` `MAPS`
registry — `getMapById` throws on an unknown id and was never designed to
be mutated at runtime with user content, so bypassing it entirely (rather
than trying to register ephemeral maps into that static module object) is
the cleanest option. Every pre-existing path (classic/campaign/campaign-
less/free-play) is completely unaffected since this field defaults to
unset.

**Main-menu wiring:** "Map Builder" (top-right, `y=82`, ALWAYS
rendered — building/playtesting needs no Firebase at all) and "Browse
Shared Maps" (top-right, `y=132`, rendered only when `firebaseReady` —
nothing to browse otherwise, same precedent as the Account control).
Mirrors the existing left-side Load Game(`y=32`)/Account(`y=82`) pair,
since the vertical button column was already documented as at capacity
(a 7th slot there collides with the bottom instructions text).

Verified: `npm run typecheck`/`npm test` (**385/385**, +15: 12 in
`tests/mapBuilder.test.ts`, 3 in `tests/mapSharing.test.ts`)/`npm run
build` (86 modules, up from 81) all pass — confirmed BOTH with the real
`.env` present and with it temporarily renamed away (proving the
local-first fallback still holds for this new feature too, not just
claimed). `npm run dev` serves HTTP 200. Not yet confirmed by a human in
a browser — see KNOWN_ISSUES **KI-048**.

### D-086 — Phase 13: Full D&D Character-System Depth kicks off; Sub-phase 13.1 (dice core + Armor Class) reverses D-030/D-036

Kevin's actual vision for this project is bigger than the now-complete Phase
11 roadmap (D-070/D-071): real D&D-5e-style character depth — every core
class, a full action economy, real dice, deeper spells, loot, and an enemy
roster spanning minion to boss — with a deliberate map of which parts of a
real character sheet belong in this game and which don't. He was explicit
that this is non-negotiable before he'd consider the game close to finished.
A research pass confirmed `classes.ts`/`subclasses.ts`/`races.ts`/`feats.ts`
already author full SRD-accurate level 1-20 tables for the 4 existing classes
(Fighter, Wizard, Rogue, Cleric), with every not-yet-functional feature
explicitly flagged `mechanicallyActive: false` and commented with the exact
missing system it needs — this phase is "wire up system X against data that
already exists," not "author content from scratch."

Before any code, Kevin made eight scope decisions directly (a full plan was
written and approved — see `PHASE_HANDOFF.md` for this chat's copy):

1. **Real dice come back**: attack rolls vs AC, advantage/disadvantage, and
   crits — an explicit reversal of D-030 ("deterministic combat, no dice")
   and D-036 ("`RandomService` deferred until a real consumer exists" — this
   is that consumer).
2. **A full action economy**: Move + Action + Bonus Action + a Reaction
   usable on the enemy phase. **Not built this chat — that's 13.2.**
3. **AC replaces the flat `defense` stat's role** for hit/miss, not damage
   reduction. Built this chat (see below).
4. **Real per-class leveling replaces the flat wave-based Vigor/Might
   choice**, advancing on the existing wave-clear cadence. **Not built this
   chat — that's 13.3.**
5. **A real rest system**: a difficulty-tuned, per-run pool of Short Rest
   charges (opt-in between waves) and a much smaller pool of Long Rest
   charges (full reset), rather than an unlimited or automatic reset — Kevin
   flagged rest cadence as one of D&D's biggest balance levers and asked for
   real rules, not a preset. **Not built this chat — that's 13.4.**
6. **Individual initiative, framework only**: a real `InitiativeSystem` so
   it exists "if we need it in the future," without rebuilding `TurnSystem`'s
   Player Phase/Enemy Phase structure around it yet. **Not built this chat —
   that's 13.5.**
7. **A real ASI-or-feat choice** at ASI levels (4/8/12/16/19) once real
   leveling exists. **Not built this chat — that's 13.6.**
8. **Sequencing**: prove the systems above against the 4 existing classes
   first (their tables are already fully authored to level 20), THEN add the
   remaining 8 core SRD classes (Barbarian, Bard, Druid, Monk, Paladin,
   Ranger, Sorcerer, Warlock) as content once the systems exist to receive
   them (13.8).

**This chat delivered Sub-phase 13.1 only** (dice core + Armor Class — the
foundation everything else in the arc depends on):

- **New `systems/RandomService.ts`**: a seedable mulberry32 PRNG
  (`RandomService.seeded(seed?)`) plus a deterministic test double
  (`RandomService.fixed(value = 15)`) — every roll returns `value`. 15 was
  chosen because it beats every Armor Class currently in this project's data
  without ever rolling a natural 20 (crit) or natural 1 (fumble), so a test
  that doesn't care about combat randomness can pass `fixed()` and keep
  asserting exact outcomes.
- **`CombatSystem` reworked**: `Combatant.defense?` → `Combatant.armorClass?`
  (absent = 10, unarmored). `AttackProfile` gains a required `attackBonus`
  and an optional `autoHit` (replacing `ignoreDefense`) and `advantage`. A
  new `CombatSystem.rollAttack(targetAC, attackBonus, random, advantage?)`
  resolves a d20 roll: natural 20 always hits and crits (double damage via
  `computeDamage`), natural 1 always misses, otherwise `d20 + attackBonus >=
  targetAC`. `applyAttack`/`attackSingle`/`attackArea` all now take an
  explicit `RandomService` parameter (dependency injection, not a global) —
  no method silently reaches for its own randomness.
- **AC replaces `defense` everywhere it was read.** Conversion formula: an
  enemy's old `defense: N` becomes `armorClass: 10 + N` (baked directly into
  new data values in `enemies.ts` — a real value, not a bonus, so it needed
  the +10 unarmored-baseline shift). Equipment's old `defense: N` bonus
  becomes `armorClass: N` unchanged (it was already an increment, added on
  top of a hero's own base). A hero's own AC is a new `baseArmorClass` field
  on `HeroDefinition` (10 for the fixed roster — no ability scores to derive
  a Dex bonus from; `10 + Dex modifier` for a D&D-built hero, computed in
  `CharacterBuildSystem.heroDefinitionFromBuild`) plus equipped gear's AC
  bonus, summed in `Hero.armorClass`. Every converted number is flagged
  first-pass/untuned, same as every other balance value in this project —
  this is a real, needed re-tuning pass, not a guess Kevin should trust yet.
- **A hero/enemy's to-hit bonus** is a new flat `attackBonus` field
  (`HeroDefinition`/`EnemyDefinition`/`Enemy`/`Hero`) — +4 flat for the fixed
  roster (untuned first-pass), a tier-scaled flat number per enemy (2-6), and
  real SRD math for a D&D-built hero (`proficiencyBonusForLevel(level) +`
  the same ability modifier `attackDamage`'s rider already used).
- **Traps and terrain hazards always auto-hit**, never roll — D-039's "traps
  trigger every time an enemy enters" stays true; a floor hazard doesn't
  roll to notice you. The old per-trap `ignoreDefense` flag (which varied)
  is gone entirely from `structures.ts`/`terrain.ts`; `WaveSystem`/
  `BuildSystem` build every trap/terrain `AttackProfile` with `autoHit: true`
  unconditionally, since "ignores defense" and "always hits" now mean the
  same thing for a trap. The burning status tick (`statusEffects.ts`) is the
  same: `ignoreDefenseOnTick` is gone, always auto-hit.
- **Wren's Piercing Shot and the Cleric's Sacred Flame** (`abilities.ts`)
  keep their "always lands" behavior via the renamed `autoHit` flag — same
  effect as their old `ignoreDefense: true`, just renamed to match what it
  actually means now that "defense" isn't a concept combat has anymore.
- **`BattleScene` gained one `RandomService` instance per battle**
  (`this.random = RandomService.seeded()`), threaded into `WaveSystem`'s
  constructor (a new required `random` option) and every `CombatSystem` call
  site (`attackProfileFor`, basic attacks, ability attacks). Combat log
  messages now distinguish "misses"/"hits"/"critically hits"/"defeats" via a
  new `BattleScene.attackVerb`/`didHit` helper pair, and a missed attack no
  longer flashes the hit effect or applies a status effect (a status
  application was previously gated only on "target still alive," which was
  wrong once a miss became possible — a missed Frost Bolt shouldn't slow its
  target).
- Every affected test file updated for the new signatures; `combat.test.ts`
  rewritten with a new "CombatSystem dice resolution" describe block (hit/
  miss/crit/fumble/autoHit), plus a new `tests/randomService.test.ts`
  (seeded determinism, `fixed()`, advantage/disadvantage). 391 → **398**
  tests (+7). `npm run typecheck`/`test`/`build` all pass (87 modules, up
  from 86); `npm run dev` serves HTTP 200.

**Not done, and why:** 13.2 through 13.11 (action economy, real leveling,
rest system, initiative, ASI/feats, spell depth, the remaining 8 classes,
loot expansion, enemy roster expansion, character-creation overhaul) are
each their own sub-phase, not started. None of this chat's combat-facing
changes (hit/miss/crit feedback, the re-tuned AC numbers) have been seen in
a browser — see `KNOWN_ISSUES.md` KI-049.

### D-087 — Sub-phase 13.2: a first slice of the action economy (bonus action + 4 class-gated features)

Continues the Phase 13 arc (D-086). Before any code, three scoping questions
were asked directly and answered by Kevin:

1. **`Hero`/`HeroDefinition` gain a minimal `classId?: string`** so class-gated
   features (Second Wind/Action Surge/Cunning Action/Uncanny Dodge, all named
   in D-086's roadmap) know which hero qualifies. This is a deliberately
   NARROW, additive exception to the D-086 handoff's caution against adding
   class-identity fields to `Hero` piecemeal outside 13.3 — Kevin approved it
   directly, this session, when asked. It is NOT 13.3's full race/class/level
   identity (no ability scores, no level tracking); `CharacterBuildSystem
   .heroDefinitionFromBuild` sets it from the build's `classId`, the classic
   fixed roster (Ash/Wren/Bram/Mira) leaves it absent, and so do Wizard/Cleric
   builds (neither class has an action-economy feature yet).
2. **Second Wind and Action Surge's "once per rest" SRD cadence has no Rest
   system to key off yet** (that's 13.4, which Kevin wants built as real
   design work, not guessed). Kevin's answer: use whatever's simplest since
   it'll be replaced anyway. Both are capped at **once per BATTLE** instead —
   an honest placeholder, clearly commented at every definition site, to be
   revisited once 13.4 lands.
3. **Uncanny Dodge (a reaction) auto-applies** rather than prompting the
   player — there is no interrupt-window UI in this game (the player only
   acts during the Player Phase), and Kevin confirmed auto-apply is fine
   (reactions are usually a no-brainer "always take it" anyway in real play).

**What was built:**

- **`Hero` gained a bonus-action slot** (`bonusActed`, alongside the existing
  `moved`/`acted`) plus `reactionAvailable` (Uncanny Dodge) and two
  once-per-battle flags (`secondWindUsed`/`actionSurgeUsed`, deliberately NOT
  cleared by `resetForNewTurn` — see point 2 above). New public API:
  `canUseBonusAction`/`canUseSecondWind`/`useSecondWind`,
  `canUseActionSurge`/`useActionSurge`,
  `canUseCunningAction`/`useCunningActionDash`,
  `canUseUncannyDodge`/`useUncannyDodge`.
- **Second Wind (Fighter):** a bonus-action self-heal, flat `+6` HP (untuned
  placeholder, same honesty as every other balance number in this project —
  real per-class leveling in 13.3 should scale this by level instead).
- **Action Surge (Fighter):** un-consumes the turn's action slot (a genuine
  second action), gated on having already acted (using it before acting
  would just waste the once-per-battle charge for nothing — `canAct()` is
  already true then). Does NOT touch the bonus-action slot — a separate
  resource, matching the SRD (Action Surge isn't a bonus action).
- **Cunning Action, Dash only (Rogue):** un-consumes the turn's move slot (a
  genuine second move), spending the bonus action. No once-per-battle limit
  (the SRD's Cunning Action has none either) — gated only on having already
  moved (same "don't offer a wasted click" reasoning as Action Surge) and the
  bonus action being unspent. Disengage/Hide stay `mechanicallyActive: false`
  (no opportunity-attack or stealth system exists to make either meaningful).
- **Uncanny Dodge (Rogue):** halves one hit's damage automatically, the
  instant `WaveSystem.tickEnemyPhase` returns and before any animation/log
  renders — implemented entirely in `BattleScene.applyUncannyDodges`, a
  post-process over the report's `AttackResult` objects that restores the
  halved HP and rewrites `damageDealt`/`healthAfter`/`defeated` in place, so
  the combat log and HP text the player sees already reflect the halved
  number. `CombatSystem`/`WaveSystem` stay entirely unaware this happens —
  same layering as potions/equipment (hero-specific effects live in
  `Hero`/`BattleScene`, not the pure combat/wave engines). Recharges every
  turn (`resetForNewTurn`), no once-per-battle limit, matching the SRD (a
  reaction, not a rest resource).
- **`classes.ts`:** the four features flip from `mechanicallyActive: false`
  to `true`, descriptions rewritten to say so and note the once-per-battle
  placeholder cadence where it applies.
- **New HUD row in `BattleScene`:** a "Bonus Action" button (Second Wind or
  Cunning Action, whichever the selected hero's class grants — a hero is
  single-class today, so at most one ever applies) and an "Action Surge"
  button, both new keybinds (R/F), both gated the same way Ability/Potion
  already are (visible only in the `heroSelected` UI state). Placed in a NEW
  row below Confirm/Cancel/Ability/Potion (not to their right — no horizontal
  room left in the 1280px canvas) — verified by the same bounding-box
  reasoning as D-046/D-055: this row and the shop/equip item grid's own rows
  occupy near-identical y-coordinates, but the two are never visible
  simultaneously (mutually exclusive UI states), the exact same
  space-sharing trick already used for Confirm/Cancel vs. Ability/Potion.
- Tests: 398 → **421** (+23: new `tests/actionEconomy.test.ts` [21, pure
  `Hero`-level unit tests], plus 2 new `characterBuildSystem.test.ts` cases
  for `classId` passthrough). Two existing `characterSystem.test.ts`
  assertions updated to match the new `mechanicallyActive: true` values.
  `npm run typecheck`/`test`/`build` all pass (87 modules, unchanged);
  `npm run dev` serves HTTP 200.

**Not done, and why:** Uncanny Dodge's auto-apply and the new HUD row are
entirely untested by a human in a browser (BattleScene needs Phaser, so it's
outside what a headless test can cover) — see `KNOWN_ISSUES.md` KI-050.
Second Wind's heal amount, and both once-per-battle cadences, are first-pass
placeholders explicitly meant to be revisited once 13.4 (Rest system) exists.
13.3 (real per-class leveling), 13.4 (rest system), 13.5 (saving
throws/skills/initiative), and 13.6-13.11 remain entirely unstarted.

### D-088 — Sub-phase 13.4: Rest system (Short/Long Rest, real per-run charge pools)

Continues the Phase 13 arc. Kevin asked to do 13.4 before 13.3 — his own
judgment call when offered both as reasonable next steps in the 13.2
handoff — specifically to replace D-087's "once per BATTLE" Second Wind/
Action Surge placeholder with the real thing before more content gets built
on top of it.

Before any code, one real design fork was surfaced and answered directly:
this game has no Hit Dice to spend on a Short Rest (the SRD's real
short-rest healing mechanism), so should a Short Rest here heal any HP at
all? Kevin's answer: **yes, flat healing scaled by max HP** (not a truly
flat universal number) — so a tankier hero recovers more in absolute terms,
the same way a bigger Hit Die would in real 5e, and every hero gets
something real out of resting, not just a Fighter's rest-gated resources.

**What was built:**

- **New `systems/RestSystem.ts`**: a per-run pool of Short/Long Rest
  charges (`shortRestsRemaining`/`longRestsRemaining`, `canTakeShortRest`/
  `canTakeLongRest`, `takeShortRest`/`takeLongRest`). Pure bookkeeping only
  — the actual per-hero effects live on `Hero` (new `shortRest`/`longRest`
  methods), the same split of responsibility `ProgressionSystem.applyChoice`
  already uses for level-up choices. A rest with no charge left is a no-op
  (`take*Rest` returns `false`, nothing is mutated).
- **`Hero.shortRest()`**: recharges `secondWindUsed`/`actionSurgeUsed` (the
  once-per-rest gate 13.2 placeholder-capped at once-per-battle) and heals a
  flat 25% of the hero's own `effectiveMaxHealth` (`SHORT_REST_HEAL_FRACTION`,
  rounded, minimum 1) — a deliberate stand-in for spending a Hit Die, per
  Kevin's answer above.
- **`Hero.longRest()`**: the same resource recharge, plus a full heal to
  `effectiveMaxHealth`.
- **`data/difficulty.ts`**: each tier gains `shortRestCharges`/
  `longRestCharges` — first-pass/untuned numbers, same honesty as every
  other balance value in this project, scaling DOWN with difficulty (harder
  = less recovery, the same lever the existing enemy-count/HP multipliers
  already pull): Easy 4/2, Normal 3/1, Hard 2/1, Nightmare 1/0. The classic
  START roster (no difficulty picker) always resolves to `"normal"`
  (`BattleScene`'s existing `difficultyId` default), so it gets Normal's
  budget too — 3 Short Rests, 1 Long Rest, per run.
- **`BattleScene`**: a new opt-in "Rest before the next wave?" overlay,
  chained into `afterWaveCleared` right after any pending level-up choice
  resolves (same "defer the phase transition until the player resolves the
  modal" pattern `showLevelUpChoice` already uses) — up to three buttons
  (Short Rest/Long Rest/Continue), each showing the charges remaining;
  "Continue" is always free and simply saves any remaining charges for
  later. The overlay is SKIPPED entirely (no modal at all) when neither rest
  type has a charge left, and also skipped after the FINAL wave clears
  (nothing to rest "before" — the run is ending). `inputLocked()`,
  `handleEscape()`, and the tutorial-reopen guard all updated so this new
  modal blocks input the same way the level-up overlay already does.
- Tests: 421 → **434** (+13: new `tests/restSystem.test.ts` [10, pure
  `RestSystem`/`Hero.shortRest`/`Hero.longRest` unit tests], plus 3 new
  `tests/difficulty.test.ts` cases for the new charge fields).
  `npm run typecheck`/`test`/`build` all pass (88 modules, up from 87 — the
  new `RestSystem`); `npm run dev` serves HTTP 200.

**Not done, and why:** the between-waves overlay itself (button layout,
whether "Continue" reads clearly, whether the charge counts communicate
scarcity well) is entirely untested by a human in a browser — see
`KNOWN_ISSUES.md` KI-051. The exact charge numbers per difficulty tier and
the 25% heal fraction are first-pass/untuned, same as every other balance
number in this project. 13.3 (real per-class leveling), 13.5 (saving
throws/skills/initiative), and 13.6-13.11 remain entirely unstarted.

### D-089 — Sub-phase 13.3: real per-class leveling replaces the flat Vigor/Might choice (D-086's roadmap item 4), plus real Extra Attack

Continues the Phase 13 arc. With 13.2/13.4's action-economy placeholders now
resolved to their real rest cadence, 13.3 was the next unblocked, load-bearing
piece named in the 13.4 handoff. Before any code, two scoping questions were
asked directly and answered by Kevin:

1. **Scope: does real leveling apply to every hero, or only a D&D-built
   party?** A battle is always either the classic fixed roster (Ash/Wren/
   Bram/Mira — no `classId`, no ability scores) or a fully D&D-built party
   (every hero has `classId` + ability scores) — never mixed. Kevin's
   answer: **real leveling applies ONLY to a classId party**; the classic
   roster keeps today's flat Vigor/Might `ProgressionSystem` choice
   completely unchanged, since it has no class table/ability scores to level
   from in the first place.
2. **Extra Attack (Fighter, `mechanicallyActive: true` in `classes.ts` at
   levels 5/11/20) needs real CombatSystem/BattleScene work to actually fire
   a second attack, not just a recomputed stat.** Kevin's answer: **build it
   for real this chat**, not defer it as a named future gap (unlike ASI,
   which stays deferred to 13.6 — its features are still `mechanicallyActive:
   false` throughout `classes.ts`, untouched this chat).

**What was built:**

- **`CharacterSystem.combatStatsForClassLevel(classId, level, abilityScores,
  abilityId)`** (new): the class-level-dependent combat numbers
  (`maxHealth`, `attackDamage`, `attackBonus`, `attacksPerAction`) a hero
  needs recomputed at ANY level — the exact formula
  `CharacterBuildSystem.heroDefinitionFromBuild` used to compute inline, but
  only ever at level 1 (a build always starts there). Moved to
  `CharacterSystem.ts` (rather than staying in `CharacterBuildSystem.ts`,
  which owns turning a finished build into a `HeroDefinition`) so `Hero` — an
  entity, not a "build a character" system — can reuse the identical math to
  re-level itself later without depending on another system's build-only
  helper. `attackStyleForAbility` moved alongside it for the same reason,
  re-exported from `CharacterBuildSystem` so no existing import breaks.
- **`HeroDefinition`/`Hero` gain `abilityScores?: AbilityScores`**, carried
  straight from a finished `CharacterBuild` (absent for the classic fixed
  roster) — the one new field this needed; `Hero` already had `classId` from
  D-087.
- **`Hero.level`** (starts at 1) and **`Hero.attacksPerAction`** (starts at
  1) are new public getters. **`Hero.levelUpClass()`** is the one method that
  advances a class level: guarded to a no-op for a hero with no
  `classId`/`abilityScores` or already at the SRD level cap (20); otherwise
  it increments `level` and REPLACES `maxHealth`/`attackDamage`/
  `attackBonus`/`attacksPerAction` outright from `combatStatsForClassLevel`
  (never touching `bonusMaxHealth`/`bonusAttackDamage`, which stay reserved
  for potions on such a hero — additive and absolute bonuses coexist
  cleanly). HP gained on level-up is added to CURRENT health immediately (the
  real SRD rule — a level-up isn't a full heal, but the new HP is yours the
  instant you gain it).
- **`ProgressionSystem.acknowledgeLevelUp()`** (new): marks a wave-clear
  threshold granted without applying Vigor/Might — what `BattleScene` calls
  for a classId party instead of `applyChoice`.
- **`BattleScene.afterWaveCleared`** now branches on a new
  `isClassBasedParty()` check (`this.heroes.some((h) => h.classId !==
  undefined)`): a classId party calls a new `applyClassLevelUps()` — every
  LIVING hero calls `levelUpClass()`, each one that actually leveled gets a
  combat-log line ("`<Hero>` reaches level `<N>`!", plus a note when Extra
  Attack is newly gained) — and `acknowledgeLevelUp()`, with **no overlay at
  all**: unlike Vigor/Might, there's no CHOICE to present (ASI stays deferred
  to 13.6), so the old `showLevelUpChoice` modal is simply skipped for this
  case, same "automatic effect, no modal needed" treatment `Hero`'s Uncanny
  Dodge already uses. The classic roster's path (`showLevelUpChoice`/
  `chooseLevelUp`/`ProgressionSystem.applyChoice`) is completely untouched.
  The status-text HUD line now shows "Lv `<N>`" right after a classId hero's
  name (nothing for the classic roster, which has no meaningful class level).
- **Real Extra Attack**: `BattleScene.tryBasicAttack` resolves
  `hero.attacksPerAction` independent `CombatSystem.attackSingle` calls
  against the SAME clicked target (the SRD lets Extra Attack's swings split
  across targets, but this game's single-click targeting UI has no way to
  pick a target per swing), each logged on its own line exactly like a
  single attack always was. If an earlier swing defeats the target, later
  swings simply don't happen (`attackSingle` only targets the living, so it
  returns `null` and the loop stops) — no special-casing needed. Only
  Fighter's `attacksPerActionByLevel` ever rises above 1 (2 at level 5, 3 at
  11, 4 at 20); Wizard/Rogue/Cleric stay at 1 forever, so this never fires
  for them.
- Tests: 434 → **448** (+14: new `tests/classLeveling.test.ts` [8, `Hero
  .levelUpClass`/`ProgressionSystem.acknowledgeLevelUp` unit tests], plus new
  `combatStatsForClassLevel`/`attackStyleForAbility` cases in
  `tests/characterSystem.test.ts` and an `abilityScores`-passthrough case in
  `tests/characterBuildSystem.test.ts`). `npm run typecheck`/`test`/`build`
  all pass (88 modules, unchanged — no new files besides the two moved
  functions' new home); `npm run dev` serves HTTP 200.

**Not done, and why:** none of this chat's changes (the level-up log lines,
the "Lv N" status text, or Extra Attack actually landing two/three/four
hits) have been seen by a human in a browser — see `KNOWN_ISSUES.md` KI-052.
ASI-or-feat choices (13.6) remain entirely deferred — leveling through 13.3
naturally "grants" those feature-table entries, but they stay
`mechanicallyActive: false` and change nothing, exactly as before this
chat. 13.5 (saving throws/skills/initiative) and 13.7-13.11 remain entirely
unstarted.

### D-090 — Sub-phase 13.5: saving throws, a slim skill list, and a framework-only InitiativeSystem

Continues the Phase 13 arc. D-086 item 6 already decided `InitiativeSystem`
should be "framework only... without rebuilding `TurnSystem`'s Player
Phase/Enemy Phase structure" — that part needed no new question. Before any
code, one real design fork remained: should saving throws stay pure
math/data (like initiative — built, tested, nothing calls it), or get one
real gameplay hookup? Kevin's answer: **give saving throws one real
hookup** — convert the Cleric's Sacred Flame cantrip (a genuine 5e save-based
spell: target rolls a DEX save vs. a DC, no attack roll at all) from its
Phase 13.1 `autoHit` stand-in to an actual saving throw.

**What was built:**

- **`CharacterSystem.savingThrowBonus(classDef, level, abilityScores,
  ability)`** (new): the SRD formula — ability modifier, plus proficiency
  bonus only if the class is proficient in that save
  (`classDef.savingThrowProficiencies`, data since Phase 11.1, never
  mechanically read until now).
- **`CharacterSystem.spellSaveDC(classDef, level, abilityScores)`** (new):
  `8 + proficiency bonus + spellcasting ability modifier` — the DC a target
  must meet or beat to resist a caster's save-based effect. Throws for a
  class with no spellcasting (should only ever be called for an actual
  caster).
- **New `systems/SavingThrowSystem.ts`**: mirrors `CombatSystem`'s dice
  shape exactly. `rollSave(bonus, dc, random, advantage?)` — a natural 20
  always succeeds, a natural 1 always fails (SRD 5.2.1's general "d20 Test"
  rule, the same auto-succeed/fail treatment this project's attack rolls
  already use). `applySaveOrDamage(target, damage, dc, savingThrowBonus,
  random, advantage?)` — the save-or-take-damage equivalent of
  `CombatSystem.applyAttack`: full damage on a failed save, none on a
  success, mutating only the target's health.
- **New `systems/InitiativeSystem.ts`**: `rollInitiative(candidates, random)`
  — d20 + a caller-supplied flat bonus per candidate, sorted highest-first
  (ties broken by bonus, then id, for full determinism). Deliberately
  entity-agnostic (takes a plain `{id, bonus}` list, not `Hero`/`Enemy`
  instances) so it adds no new fields to either entity — genuinely framework
  only, exactly as D-086 asked: nothing in `BattleScene` calls this.
- **New `data/skills.ts`**: a SLIM 8-skill list (Athletics, Acrobatics,
  Stealth, Investigation, Perception, Insight, Persuasion, Intimidation) —
  one or two representative skills per ability that has SRD skills at all
  (Constitution genuinely has none). Skill names/ability associations are
  SRD 5.2.1 (CC BY 4.0); descriptions are original wording. A `skillModifier`
  helper reads the governing ability's modifier only — no proficiency
  concept for skills (no skill-picker UI exists, and nothing calls a skill
  check in this game), same framework-only honesty as initiative.
- **`Hero.spellSaveDC`** (new getter): null for a hero with no
  `classId`/`abilityScores` (the classic fixed roster) or whose class has no
  spellcasting; otherwise `CharacterSystem.spellSaveDC` for the hero's
  current class/level/ability scores — recomputes automatically as the hero
  levels via `levelUpClass()`.
- **`EnemyDefinition`/`Enemy` gain a flat `savingThrowBonus`** (mirrors
  `attackBonus`'s existing treatment — one number, since enemies have no
  per-ability scores to derive a specific save from; set equal to each
  enemy's existing `attackBonus`, first-pass/untuned like every other
  balance number here).
- **Sacred Flame converted**: `AbilityDefinition` gains an optional
  `savingThrow?: { ability: AbilityScoreId }` field (mutually exclusive with
  `autoHit`). Sacred Flame's `autoHit: true` is replaced with `savingThrow:
  { ability: "dex" }`; its description updated. `BattleScene.castAbilityOn`
  now branches: a `savingThrow`-tagged ability resolves through a new
  `castSavingThrowAbilityOn` (rolls the target's save against the caster's
  `spellSaveDC`, logs "resists" on a success or "sears"/"defeats" with the
  damage dealt on a failure) instead of `CombatSystem.attackSingle`.
- **New Compendium tab: "Skills"** — read-only reference, same treatment as
  the existing Feats/Races tabs (many of which are already partly/fully
  inert content shown for reference).
- Tests: 448 → **475** (+27: new `tests/savingThrowSystem.test.ts` [8],
  `tests/initiativeSystem.test.ts` [3], `tests/skills.test.ts` [6], plus new
  `savingThrowBonus`/`spellSaveDC` cases in `tests/characterSystem.test.ts`
  and new `Hero.spellSaveDC` cases in `tests/classLeveling.test.ts`).
  `npm run typecheck`/`test`/`build` all pass (90 modules, up from 88 — the
  two new system files); `npm run dev` serves HTTP 200.

**Not done, and why:** none of this chat's changes (Sacred Flame's new save
mechanic, the Skills Compendium tab) have been seen by a human in a browser
— see `KNOWN_ISSUES.md` KI-053. `InitiativeSystem` remains genuinely unused
outside its own tests, exactly as scoped — a future sub-phase that actually
wants per-unit turn order (not currently planned) would be its first real
consumer. Skills have no proficiency concept and no in-game check to spend
one on — still purely reference data. 13.6 (ASI-or-feat), 13.7 (spell
depth), and 13.8-13.11 remain entirely unstarted.

### D-091 — Sub-phase 13.6: a real Ability-Score-Improvement-or-feat choice

Continues the Phase 13 arc — 13.3 (D-089) already gave a D&D-built hero a
real class level to reach an ASI at; this sub-phase wires the choice itself
in, unblocking every "Ability Score Improvement" feature entry across all
four classes (previously `mechanicallyActive: false` everywhere). Two real
design forks were asked directly before writing code:

1. **How should the ASI split its +2?** Kevin chose the **full 5e rule**
   (+2 to one ability, or +1 to two different ones) over a simpler
   "always +2 to one ability" cut.
2. **Feats' `Lucky`/`Alert`/`Athlete` are still inert placeholders.** Lucky's
   stated reason ("this game's combat is diceless") had gone stale since
   13.1 (D-086) brought real d20 dice back — asked directly whether to give
   Lucky a real hookup now or leave all three inert. Kevin chose to **give
   Lucky a real hookup**: a fixed pool of rerolls (Advantage on this hero's
   basic-attack rolls, spent automatically since no interrupt-prompt UI
   exists — the same auto-apply precedent Uncanny Dodge set in 13.2/D-087),
   recharging only on a Long Rest, matching the SRD. Alert and Athlete stay
   inert (no per-unit-initiative or terrain-cost system exists to hook them
   into) — not part of this sub-phase's scope.

**What was built:**

- **`CharacterSystem.asiFeatureGrantedAtLevel(classDef, level)`** (new): true
  if a class table names an "Ability Score Improvement" feature at exactly
  this level. Every class table names the feature identically, including
  the Fighter's two bonus ASIs (levels 6/14, on top of the standard
  4/8/12/16/19 every class shares), so one name check works generically
  instead of hardcoding a level list per class.
- **Every "Ability Score Improvement" feature entry in `data/classes.ts`
  (23 across Fighter/Wizard/Rogue/Cleric) flips to `mechanicallyActive:
  true`**, with Fighter's/Wizard's own level-4 description rewritten to
  describe the real mechanic instead of the old "feats are deferred" note.
- **`Hero.improveAbilityScore(ability, amount)`** (new): raises one ability
  score in place (capped at 20, the SRD's ceiling), recomputing every
  ability-score-derived combat number (`maxHealth`/`attackDamage`/
  `attackBonus`/`attacksPerAction`) via the SAME `combatStatsForClassLevel`
  formula `levelUpClass` already used — both now share a new private
  `applyLeveledStats` helper so the two paths can never drift. HP gained
  from a rising CON modifier is added to current health immediately, same
  convention as a level-up's own HP gain. A no-op for the classic fixed
  roster (no `classId`/`abilityScores`).
- **`Hero.grantFeat(featId)`** (new): records a chosen feat (`Hero.featIds`,
  a no-op if already held — this game's feat list has no "may be taken
  more than once" entry). Tough's HP bonus (`hitPointBonusFromFeat`, already
  data since Phase 11.3) now folds into `effectiveMaxHealth` via a private
  `featHitPointBonus` getter, scaling with the hero's CURRENT class level
  and contributing to `hpGain` on every subsequent level-up exactly like the
  class's own hit-die gain. Lucky grants a `luckyPointsRemaining` pool (data-
  driven via the feat's own new `luckyPoints: 3`, not a hardcoded duplicate).
- **`Hero.canUseLucky()`/`spendLuckyPoint()`/`luckyPointsAvailable`** (new):
  Lucky's reroll pool. `longRest()` recharges it to full for a hero who has
  the feat (a Short Rest does NOT — matches the SRD's real "regain on a Long
  Rest" cadence); a hero without the feat is unaffected either way.
- **`data/feats.ts`**: Lucky flips to `mechanicallyActive: true` with a new
  `luckyPoints?: number` field (3), description rewritten to describe the
  real hookup. Alert/Athlete/their doc comments are otherwise untouched.
- **`BattleScene`**: `applyClassLevelUps` now returns every hero whose NEW
  level grants an ASI (via `asiFeatureGrantedAtLevel`); `afterWaveCleared`
  queues a new per-hero overlay (`showAsiChoiceQueue`/`advanceAsiQueue`) for
  exactly those heroes, before any Rest choice — same "defer the transition
  until resolved" pattern `showLevelUpChoice`/`showRestChoice` already
  established. The overlay itself is a small step machine (path choice ->
  raise-scores-or-feat; raise path -> +2-one-or-+1-two; ability picker,
  reused for both; feat path -> pick from every feat this hero doesn't
  already have), rendered by one shared `renderAsiPrompt` helper that sizes
  its button row to however many choices a given step has (2 for a path/mode
  choice, up to 6 for an ability pick, up to 4 for a feat pick) rather than
  a bespoke layout per step. `tryBasicAttack` spends a Lucky point
  automatically (Advantage on the roll) whenever one is available, logging
  it, before resolving the attack.
- Tests: 475 → **492** (+17: new `asiFeatureGrantedAtLevel` cases in
  `tests/characterSystem.test.ts`; new `Hero.improveAbilityScore`/
  `grantFeat`/Lucky describe blocks in `tests/classLeveling.test.ts`; updated
  the `activeFeaturesUpToLevel`/"marks X as inert" assertions in
  `tests/characterSystem.test.ts` and the Lucky-related assertions in
  `tests/feats.test.ts` that the `mechanicallyActive` flips changed).
  `npm run typecheck`/`test`/`build` all pass (90 modules, unchanged — no
  new files, only edits); `npm run dev` serves HTTP 200.

**Not done, and why:** none of this chat's changes have been seen by a human
in a browser — see `KNOWN_ISSUES.md` KI-054. Alert and Athlete remain inert
(no per-unit-initiative or terrain-cost system to hook them into — not
asked for this sub-phase). Lucky's Advantage hookup applies to a hero's
BASIC ATTACK only, not abilities or saving throws — abilities never roll a
save FOR the caster, and no enemy ability currently targets a hero's saving
throw, so there was no second real consumer to wire it into without
inventing one. 13.7 (spell depth) and 13.8-13.11 remain entirely unstarted.

### D-092 — Sub-phase 13.7: real spell depth — a spellbook, spell slots, ally healing, concentration framework

Kevin rejected the "one fixed signature action" pattern outright when asked
how a caster should access a newly-real leveled spell: "Players on their
turn should be able to choose any of the normal 5.5e actions, which includes
casting any of the spells... Spellcasters should have a spellbook of sorts."
Upcasting (casting a spell at a higher slot for a bigger effect) was named
as a real future goal but explicitly NOT required this chat. Two further
forks were asked directly:

1. **Cleric's leveled spells** all need a brand-new "target an ally"
   mechanic (no potion/ability in this game has ever affected anyone but
   the user or an enemy). Kevin chose to **build it this round** — Cure
   Wounds becomes real, not just Magic Missile (Wizard) — rather than defer
   Cleric to a later sub-phase.
2. **Concentration** has nothing to attach to yet (no spell in this game
   has an ongoing duration effect — Bless/Shield of Faith, the natural
   concentration spells, stay data-only). Kevin chose **framework-only**,
   matching `InitiativeSystem`'s D-090 precedent: built, tested, genuinely
   unconsumed until a future spell needs it.

**What was built:**

- **`AbilityDefinition` gains three fields**: `spellSlotLevel?` (which slot
  level casting this ability consumes — absent for a cantrip/mundane
  ability), `targetsAlly?` (targets a living `Hero`, including the caster,
  instead of an enemy), `healAmount?` (HP restored, for a `targetsAlly`
  healing spell).
- **Two new abilities, the first real leveled spells**: `magic-missile`
  (Wizard, autoHit, damage 8, `spellSlotLevel: 1` — a real reason to spend
  a slot instead of cantrip-spamming Fire Bolt) and `cure-wounds` (Cleric,
  `targetsAlly: true`, `healAmount: 8`, `spellSlotLevel: 1` — this game's
  first ally-targeted effect of any kind). `data/spells.ts` wires both
  spells' `abilityId` (previously absent — "not yet castable, no slot
  economy") and updates their descriptions.
- **`data/characterCreation.ts` gains `knownSpellIdsForClass`**: every
  mechanically-active spell for a class (every cantrip, not just the ONE
  signature action chosen at creation, plus every leveled spell this game
  can cast) — the actual "spellbook" list. The chargen signature-action
  choice itself is UNCHANGED (still drives the hero's baseline attack-style
  stat scaling, per `CharacterBuildSystem`) — this is purely additive for
  what a caster can do IN BATTLE.
- **New `Hero.spellSlotsRemaining: number[]`** (index 0 = 1st-level),
  initialized from `SpellcastingSystem.spellSlotsForClassAtLevel` at
  construction, grown (not reset) on `levelUpClass` via a new private
  `growSpellSlots` (mirrors `applyLeveledStats`'s "delta added" HP
  treatment), and fully restored ONLY by `longRest()` — a Short Rest does
  NOT refill a Wizard/Cleric's slots, the SRD's real cadence (unlike a
  Warlock's). New `Hero.knownSpellAbilityIds()`/`canCastSpell()`/
  `spendSpellSlot()`/`spellSlotsRemainingAt()`.
- **Bug found and fixed while writing this**: `SpellcastingSystem
  .spellSlotsForClassAtLevel` returned a LIVE REFERENCE into the shared,
  module-level `FULL_CASTER_SPELL_SLOTS_BY_LEVEL` table, not a copy. Once
  `Hero` started mutating its "remaining slots" array in place
  (`spendSpellSlot`), every Wizard/Cleric hero ever constructed would have
  silently shared and progressively depleted the SAME underlying array —
  caught immediately by the new test suite (a second hero's slots came back
  already-spent), fixed by returning a fresh array (`[...]`) from that
  function so no caller can alias the shared table again.
- **New `BattleScene` spellbook UI**: two new `Interaction` kinds,
  `"choosingSpell"` (a modal overlay, gated like Build/Gear mode — a board
  click does nothing while it's open, only its own buttons or Esc close it)
  and `"aimingSpell"` (the next click picks a target, ally or enemy
  depending on the spell). A caster's existing "Ability (Q)" button/keybind
  now opens the spellbook instead of casting a fixed ability; a non-caster
  (Fighter/Rogue, or the classic roster) is COMPLETELY UNCHANGED — same
  button, same one-ability flow as always.
  - `renderSpellbookOverlay` lists every known spell the hero can actually
    AFFORD right now (`Hero.canCastSpell` — cantrips always, a leveled
    spell only while a slot remains); an unaffordable leveled spell is
    filtered out entirely rather than shown disabled, matching
    `showRestChoice`'s existing "don't offer a dead-end choice" style.
  - `castAbilityOn`/`castSavingThrowAbilityOn` (the existing enemy-target
    resolvers) gained an explicit `ability` parameter, defaulting to
    `getAbility(hero.abilityId)` — the OLD path (non-caster, or a caster's
    the-only-thing-they-could-ever-cast era) is byte-for-byte unchanged;
    the spellbook path calls the SAME resolvers with the CHOSEN spell, so
    there's one enemy-targeting code path, not two. Both now spend a spell
    slot (`spendSpellSlotIfNeeded`) right before the cast actually lands.
  - **New `castHealSpellOn`**: this game's first ally-targeted resolver
    (no existing code to share, since nothing has ever healed an ally
    before). A new `livingAlliesInRange` helper (self-inclusive, unlike
    `CombatSystem.targetsInRange` which requires a DISTINCT tile) lets Cure
    Wounds target the caster itself, matching the SRD.
  - A rejected target click re-enters whichever aiming mode actually
    triggered it (`returnToAimingMode`, checking `this.ui.kind` rather than
    always assuming the old fixed-ability flow).
- **New `systems/ConcentrationSystem.ts`** (framework-only, per Kevin's
  choice above): `concentrationSaveDC(damageTaken)` (the SRD formula, half
  damage rounded down, minimum 10) and `checkConcentration` (a thin wrapper
  over `SavingThrowSystem.rollSave`). Genuinely uncalled outside its own
  tests — the same treatment `InitiativeSystem` got in 13.5.
- Tests: 492 → **514** (+22: new `tests/concentrationSystem.test.ts` [7],
  `tests/spellSlots.test.ts` [12], plus updated `tests/spells.test.ts`
  cases for the two now-castable leveled spells).

**Not done, and why:** none of this chat's changes have been seen by a
human in a browser — see `KNOWN_ISSUES.md` KI-055. Upcasting (spending a
HIGHER-level slot on a lower-level spell for a bigger effect) is explicitly
future scope per Kevin's own framing, not built this round. The spellbook
overlay is mouse-only — it does NOT hook into the existing Tab/arrow-key
grid-navigation system (D-066) that Build/Gear mode already has, a
deliberate scope cut to keep this sub-phase's surface area contained
(tracked as a known limitation, not silently skipped). Bless/Shield of
Faith/Guidance and the remaining leveled spells stay data-only — no
ally-buff or skill-check mechanic exists to hook them into yet. 13.8-13.11
remain entirely unstarted.

### D-093 — Sub-phase 13.8: the remaining eight core SRD classes, each with a real iconic mechanic

Asked how deep the remaining eight classes (Barbarian, Bard, Druid, Monk,
Paladin, Ranger, Sorcerer, Warlock) should go, Kevin rejected the earlier
"one flashy hook, everything else marked inert" pattern outright: "No, I
hated that when it was implemented. I want it to be much more true to the
real DnD classes." Asked to pin down exactly how far, he chose the more
ambitious of two options: **every class gets its real, defining mechanic
wired in and playable, adding small new supporting concepts on `Hero` where
genuinely needed** (a Rage/Wild Shape damage-resistance duration, a Ki/
Sorcery-Points resource pool, Bardic Inspiration's ally buff, Divine Smite/
Hunter's Mark spending a spell slot on a landed hit) — not just reusing
whatever systems already happened to exist. Two further forks were answered
before any code:

1. **The four new full/half spellcasters** (Bard, Druid, Sorcerer, Warlock)
   get real spellcasting wired in now — a working cantrip and a castable
   1st-level spell each, exactly like Wizard/Cleric got in 13.7 — rather
   than staying data-only until a later pass. Warlock's real Pact Magic
   (fewer slots, always at max level) was explicitly simplified to the SAME
   shared full-caster slot table for consistency; what actually makes it
   feel like a Warlock is its SHORT-rest slot recharge (see below), not the
   slot count/shape.
2. **No new subclasses this round** — 13.8 stayed scoped to the eight base
   classes only, matching the roadmap's own item name. One subclass per
   class (mirroring D-076's four) would have roughly doubled this already
   large batch; a clean, separately-named future item, not a silent gap.

**What was built — one real, playable mechanic per class:**

- **Barbarian — Rage.** A bonus action, gated by a flat per-Long-Rest use
  count (`Hero.rageUsesRemaining`), that halves incoming damage and adds
  flat bonus attack damage for a fixed number of turns
  (`Hero.damageResistanceTurnsRemaining`, ticking down once per
  `resetForNewTurn`). A Short Rest ends an active Rage early but does not
  recharge its uses (only a Long Rest does) — the SRD's real cadence.
- **Druid — Wild Shape** (from level 2). Simplified: a bonus action that
  heals a flat amount and grants the SAME damage-resistance buff as Rage
  (`hasDamageResistance` is a shared, class-agnostic getter a hero is
  single-class so never double-applies), rather than a real creature-stat-
  block transformation (no such system exists).
- **Monk — Martial Arts + Ki/Flurry of Blows.** `CharacterSystem
  .combatStatsForClassLevel` now uses DEX instead of STR for a Monk's melee
  attacks (Martial Arts' real SRD effect). Ki (from level 2,
  `Hero.kiPointsRemaining`) spends on Flurry of Blows — a bonus action that
  un-consumes the action slot exactly like Action Surge's existing trick,
  for another attack. Deliberately folds the SRD's separate free level-1
  unarmed strike, and Stunning Strike, into this one mechanic — documented
  as an explicit simplification, not an oversight. Ki recharges on BOTH a
  Short and a Long Rest (the SRD's real cadence, unlike Rage).
- **Bard — Bardic Inspiration.** A bonus action, gated by a flat per-rest
  use count, that grants a target hero (the nearest OTHER living ally, or
  the Bard itself if alone — auto-targeted, no separate aim step, same
  auto-apply precedent as Uncanny Dodge/Lucky, D-087/D-091) a flat bonus
  applied to its own next attack roll and damage (`Hero.receiveInspiration`/
  `pendingInspirationBonus`/`clearInspiration`, consumed in
  `tryBasicAttack`/`castAbilityOn`). Font of Inspiration (level 5) upgrades
  its recharge from Long-Rest-only to Short-Rest-too — a real, level-gated
  SRD detail, not just flavor text.
- **Paladin — Divine Smite.** A half-caster spell-slot economy (spells
  starting level 2, no cantrips — `HALF_CASTER_SPELL_SLOTS_BY_LEVEL`, a new
  sparse table alongside the existing full-caster one) whose one real
  consequence is Divine Smite: a landed melee hit auto-spends a 1st-level
  slot for bonus radiant damage, whenever one remains (auto-applied, same
  precedent as above — `BattleScene.applyPaladinSmite`, wired ONLY into the
  basic Attack action, since Divine Smite is a melee WEAPON-attack feature
  in the SRD, not a spell/ability effect).
- **Ranger — Hunter's Mark.** The same half-caster slot economy (WIS), whose
  one real consequence is Hunter's Mark: a bonus action, spending a
  1st-level slot, that marks the nearest enemy in reach (auto-targeted, same
  precedent) for bonus damage on every subsequent basic-attack hit against
  it (`Hero.markedEnemyId`, read by `BattleScene.applyHuntersMarkBonus`).
- **Sorcerer — Metamagic: Quickened Spell.** A Sorcery Points pool (Font of
  Magic, from level 2) spent (from level 3) on a bonus action BEFORE
  casting, so the upcoming spell consumes the bonus action instead of the
  main action — freeing the action for a basic attack the same turn. New
  `Hero.markActedForSpellCast()` replaces the three spell-cast resolvers'
  plain `markActed()` calls: it's a safe no-op passthrough for every hero
  who never Quickened, so no class branching was needed at the call sites.
- **Warlock — Pact Magic's real cadence.** `Hero.shortRest()` gained a
  Warlock-only branch that fully restores spell slots — the SRD's genuinely
  distinctive Warlock trait (every other caster class here stays
  Long-Rest-only), doing the real differentiating work that the shared
  full-caster slot table (see fork 1 above) intentionally does not.
- **New `data/abilities.ts`/`data/spells.ts` entries**: `vicious-mockery`
  (Bard cantrip), `healing-word` (Bard 1st-level, this game's second
  ally-targeted heal after Cure Wounds), `produce-flame` (Druid cantrip),
  `eldritch-blast` (Warlock cantrip). Druid's 1st-level spell reuses Cure
  Wounds verbatim (shared with the Cleric, matching the real overlapping SRD
  spell lists); Sorcerer/Warlock's cantrip/1st-level spell reuse Fire
  Bolt/Magic Missile verbatim (Wizard's) — deliberate reuse, not a gap.
- **`data/characterCreation.ts`**: `CREATABLE_CLASS_IDS` grows to all twelve
  classes. Barbarian/Monk/Paladin/Ranger join Fighter/Rogue on the shared
  `SIGNATURE_ABILITY_IDS` list (their own real mechanic lives on the
  bonus-action button, not the Q-button choice); Bard/Druid/Sorcerer/Warlock
  each get their own cantrip-id list, same shape as Wizard/Cleric.
  `knownSpellIdsForClass` gains the four new casters; Paladin/Ranger
  deliberately stay OUT of it (see `BattleScene.isCasterHero` below).
- **`BattleScene.isCasterHero` changed its check**: from "does this class
  have ANY `spellcasting` data" to "is this hero's `knownSpellAbilityIds()`
  non-empty." Needed because Paladin/Ranger now DO have real half-caster
  `spellcasting` data (for Divine Smite/Hunter's Mark's slot economy) but
  must NOT open an empty "Cast a Spell" spellbook menu in place of their
  fixed signature ability — the new check correctly separates "has a slot
  economy" from "has a spellbook."
- Tests: 514 → **544** (+30: new `tests/newCoreClasses.test.ts` covering
  all eight classes' data and mechanics, plus updated
  `tests/characterCreationData.test.ts`/`tests/characterSystem.test.ts`/
  `tests/spells.test.ts` assertions for the expanded class/spell rosters).

**Not done, and why:** no new subclasses (fork 2 above). Reckless Attack,
Unarmored Defense, Stunning Strike, Metamagic's other options, Lay on
Hands, Favored Enemy, and every class's higher-level features stay honestly
`mechanicallyActive: false` in `data/classes.ts`, each with a documented
reason (no advantage/disadvantage system, no armor catalogue, ki already
spent on Flurry this pass, no skill/terrain-tagging system, etc.) — the
SAME "real data, some of it not reachable yet" treatment every existing
class already gets, just with far more of each new class actually reachable
than the old pattern gave Fighter/Wizard/Rogue/Cleric at the time. None of
this chat's changes have been seen by a human in a browser.

### D-094 — Sub-phase 13.9: loot/equipment expansion — a real rarity ladder, attunement, and four on-hit/on-kill procs

13.8's handoff named 13.9 (loot/equipment expansion) as the default next
step, specifically calling out that dice, saving throws, ally-targeting, and
per-class conditional bonuses (all shipped in 13.1-13.8) now make real item
procs possible, and that rarity/attunement were worth reconsidering. Three
scoping questions were asked directly before any code, all answered toward
the more ambitious option:

1. **Rarity:** a real five-tier ladder (`RARITY_ORDER`: common, uncommon,
   rare, veryRare, legendary), scaling bonus size and cost — not a flat,
   unranked catalogue with a few new items bolted on.
2. **Attunement:** a real D&D-style cap of 3 attuned items at once
   (`MAX_ATTUNEMENTS`), gating the strongest items — not "every equipped
   item just works, no attunement concept."
3. **Proc breadth:** build ALL four requested proc kinds this batch, not a
   subset — status-effect procs, saving-throw-resisted procs, ally-targeting
   procs, and per-class conditional procs.

**Rarity (`data/equipment.ts`):** the 12 existing Phase-11.5 items are
retro-tagged `common` (5 single-stat items) or `uncommon` (7 dual-stat or
higher-magnitude items) purely by their existing, UNCHANGED power level —
no numbers moved. Five new items fill rare through legendary, one demonstrating
each proc kind plus a legendary flat-bonus item completing the ladder's top
end: **Ring of Frostbite** (rare, ring), **Amulet of Withering** (rare,
amulet), **Signet of Kinship** (rare, ring), **Greaves of the Berserker**
(veryRare, legs), **Aegis of the First Ward** (legendary, chest, no proc —
just the ladder's biggest flat bonus).

**Attunement:** rather than track a separate "worn but not attuned, so
inert" state, attunement is gated entirely at EQUIP time
(`Hero.wouldExceedAttunementLimit(itemId, slot)` — pure and unit-tested) and
otherwise derived, never stored: `Hero.attunedItemIds` simply reduces over
`equippedItems`, filtering for `requiresAttunement`. A hero can therefore
never end up wearing a dead-weight unattuned item — `armorClass`/
`effectiveAttackDamage` need no attunement check of their own, since
equipping was already refused if it would exceed the cap.
`BattleScene.equipGearOnHero` calls the Hero method and rejects (same
"not enough gold" UX) before any gold changes hands: "`<Hero>` is already
attuned to 3 items — unequip one first." Swapping one attuned item for
another in the SAME slot correctly nets to zero (the freed slot is counted
before the new one is spent), so replacing a ring never itself trips the cap.

**Procs (`EquipmentProc` in `data/equipment.ts`, resolved by
`BattleScene.applyEquipmentProcs`):** mirrors Divine Smite/Hunter's Mark
(D-093)'s exact shape — a thin per-kind resolver against the SAME
`AttackResult` a basic Attack action already produced, using
`SavingThrowSystem`/`Enemy.applyStatus`/`Hero.hasDamageResistance` /
`nearestOtherLivingAlly` (all pre-existing seams, no new engine hooks). Only
wired into the basic Attack action, the SAME scope boundary Divine
Smite/Hunter's Mark already established — not abilities/spells.

- `onHitStatus` — unconditional: a landed hit applies a status effect, no
  save (Ring of Frostbite: Slowed, 2 turns).
- `onHitSaveOrDamage` — the target rolls a saving throw
  (`SavingThrowSystem.rollSave`, reusing 13.5's real DC math) against a flat
  DC; a failed save takes bonus damage folded into the same `AttackResult`
  (Amulet of Withering: DC 13, +3).
- `onKillHealNearestAlly` — fires only when `result.defeated` is true (after
  Divine Smite/Hunter's Mark's own bonus damage has already been folded in,
  so a kill enabled by either of THOSE features still procs this one); heals
  the nearest other living ally, or the wearer itself if alone, same target
  rule as Bardic Inspiration (Signet of Kinship: 4 HP).
- `onHitWhileResistant` — reads `Hero.hasDamageResistance` (D-093's shared
  seam for Rage/Wild Shape), so this is genuinely class-agnostic even though
  only Barbarian/Druid can ever trigger it today (Greaves of the Berserker:
  +3 while raging/shaped).

**`Hero` gains:** `attunedItemIds` (derived getter), `canAttuneToAnother()`,
`wouldExceedAttunementLimit(itemId, slot)`, `equippedProcItems()` (every
equipped item carrying a `proc`, slot order) — all pure and unit-tested, no
Phaser dependency, per CLAUDE.md's systems/entities boundary.

**Gear UI/Compendium:** `gearCatalogButtonLabel` now shows an item's rarity
tag (e.g. "· Rare") whenever it isn't `common`, so a rare-and-up item stands
out in the shop grid before it's even clicked. `CompendiumScene`'s equipment
tab now shows rarity, "requires attunement," and a proc item's full
description (previously only flat-bonus text).

- Tests: 544 → **554** (+10, all in `tests/equipment.test.ts`: rarity/
  attunement data-validity checks, all four proc kinds present, and
  `Hero.attunedItemIds`/`canAttuneToAnother`/`wouldExceedAttunementLimit`/
  `equippedProcItems` behavior). Typecheck/build clean (91 modules,
  unchanged — no new files). `npm run dev` serves HTTP 200.

**Not done, and why:** `BattleScene.applyEquipmentProcs`/
`applyEquipmentProc` themselves have no dedicated unit tests — same
treatment as `applyPaladinSmite`/`applyHuntersMarkBonus` before them (D-093):
scene-level resolution logic in this project isn't unit-tested directly, only
the pure Hero/system seams underneath it are. Procs are NOT wired into
ability/spell casts, only the basic Attack action — a deliberate, documented
scope match to Divine Smite/Hunter's Mark, not an oversight. No item can
carry more than one proc. None of this chat's changes have been seen by a
human in a browser.

### D-095 — Sub-phase 13.10: enemy roster expansion — more enemies at every tier, full role tagging, and this roster's first real special attack

13.9's handoff named 13.10 (enemy roster expansion — "more enemies at every
tier, full role tagging") as the default next step. One scoping question was
asked directly before any code: every enemy built across Phases 3/7/11.6 (12
of them) is a pure stat variant — HP/AC/damage/speed/range, nothing more —
since `EnemyDefinition.abilities` has sat empty since Phase 4. Should at
least one new enemy get a real special-attack mechanic now that dice/saving
throws exist, or should this batch stay flat stat variants like every enemy
so far? **Kevin chose the real mechanic**, with the explicit understanding
that an enemy inflicting a status effect (Slowed/Stunned/Burning) on a HERO
was out of scope — this game's status-effect system only ever targets
enemies today, and building the hero-side half (movement-reduction hook,
stun-prevents-turn logic, a burn tick during the PLAYER phase) would be a
much bigger, separate undertaking. The mechanic that shipped instead: an
enemy attack that forces a SAVING THROW instead of a to-hit roll — reusing
13.5's `SavingThrowSystem`/`CharacterSystem.savingThrowBonus` (the latter
built in 13.5, never actually CALLED until now) rather than inventing
anything new.

**Four new enemies, one per real gap:**
- **Marauder** (minion) — a flat stat variant: a glass-cannon melee threat
  (high damage, ordinary HP/AC), a niche none of the existing nine minions
  filled.
- **Blightcaller** (minion) — this roster's first real special attack. Its
  strike forces the target to roll a saving throw against a flat DC
  (`EnemyDefinition.savingThrowAttackDC`, new field) instead of the usual
  `attackBonus`-vs-AC roll; a high-AC hero gains nothing against it, but a
  hero with a real DEX save (a D&D-built party) can shrug it off outright.
- **Gravemaw** (miniboss) — a second miniboss (there was only ever one,
  basalt-colossus); a flat stat variant scaled slightly past it.
- **Blightmother** (boss) — a third true boss, thematically paired with
  Blightcaller rather than just a bigger stat block: the SAME forced-save
  attack, at a much harder DC and heavier damage.

**Full role tagging:** every pre-13.10 minion (grunt through ravager) gains
an EXPLICIT `role: "minion"` — previously omitted and only implicitly
treated as minion by every reader (`BestiaryScene`'s grouping,
`BattleScene`'s boss presentation); this makes it the recorded fact, not an
inference. Auditing every `role` read surfaced a real, pre-existing gap:
**`BattleScene`'s miniboss visual treatment (bigger token, gold outline, a
persistent name banner — KI-023/D-063) checked ONLY `role === "miniboss"`**,
so Cinderlord/Tidelord (`role: "boss"`, added in 11.6/D-079) had silently
never gotten it — every true boss rendered as an ordinary small token since
the day it was added. Fixed: `BattleScene.isBossRole` now matches both
tiers, and the banner text distinguishes "(Miniboss)" from "(Boss)"
(`bossBannerSuffix`).

**The new mechanic's implementation:**
- `Combatant` (`CombatSystem.ts`) gains an optional `savingThrowBonus?:
  number` — the same "duck-typed shared shape" `armorClass` already uses,
  so `WaveSystem` (entity-agnostic, per its own design) can read a hero's
  save bonus without importing `Hero`.
- `Hero.savingThrowBonus` (new getter): DEX-based (the same ability Sacred
  Flame already targets on an enemy, kept symmetric), real SRD math
  (`CharacterSystem.savingThrowBonus`, ability modifier + proficiency if
  proficient) for a D&D-built hero; a flat default (2) for the classic
  fixed roster, which has no ability scores to derive one from.
- `WaveSystem.resolveSavingThrowAttack` (new private static method):
  reuses `SavingThrowSystem.applySaveOrDamage` for the actual roll/damage/
  mutation, then repackages its result into a normal `AttackResult` with a
  SYNTHESIZED `roll` (`hit` = the save FAILED, never a critical) — every
  existing render path in `BattleScene` (`didHit`/`attackVerb`/the combat
  log) works completely unchanged; no scene code needed to understand
  "this was a save, not a roll." `roll.targetArmorClass` holds the DC here,
  not an Armor Class — never rendered as text, only read by
  `didHit`/`attackVerb`, so the reuse is safe, just documented clearly.
- `tickEnemyPhase` branches on `enemy.def.savingThrowAttackDC` at the one
  spot an enemy resolves its attack — everything else (movement, traps,
  breach, status ticks) is completely untouched.

**Free Play integration:** Marauder/Blightcaller join `EXPANDED_MINIONS`;
Gravemaw/Blightmother join `BOSS_OPTIONS` with `unlockCampaignId: null`
(always available) — deliberately, since neither has a campaign of its own
yet (same staging Cinderlord/Tidelord had before Phase 11.8 built theirs),
and leaving them reachable ONLY via data/Bestiary with no playable path
would be dead scaffolding. This grew `BOSS_OPTIONS` from 3 to 5 entries,
which would have overflowed `FreePlayScene`'s fixed 380px-per-button row
past `GAME_WIDTH` (1280) — `buildOptionRow`'s button width is now COMPUTED
(`Math.min(380, ...)`) instead of a hardcoded constant; the existing 3-item
map row is pixel-identical (`(1180-40)/3` already equals 380 exactly), same
bounding-box-math precedent as D-046/D-055/D-085.

- Tests: 554 → **569** (+15: new `tests/enemyRoster.test.ts` [8] covering
  role-tagging completeness and the new enemies' data; 3 new
  `tests/combat.test.ts` cases exercising `resolveSavingThrowAttack` through
  `WaveSystem.tickEnemyPhase`; 4 new `tests/classLeveling.test.ts` cases for
  `Hero.savingThrowBonus`; 1 existing `tests/campaign.test.ts` assertion
  updated for the new miniboss/boss counts). Typecheck/build clean (91
  modules, unchanged — no new source files besides the one test file, which
  isn't bundled). `npm run dev` serves HTTP 200.

**Not done, and why:** an enemy inflicting a status effect on a HERO (the
symmetric counterpart to a hero's Frost Bolt/Sacred Flame) stays out of
scope — this game's status-effect system is enemy-only; giving it a hero
side is real, separate future work, not folded into this pass. Gravemaw/
Blightmother have no campaign/map of their own — reachable via Free Play
and the Bestiary today, a real campaign is a future item (same shape as
11.6's bosses before 11.8). No new enemy was wired into the classic 10-wave
`WAVES` or the Emberford/Saltmere campaigns' hand-tuned wave lists — those
stay untouched, matching how Cinderlord/Tidelord were staged before 11.8
placed them. `WaveSystem.resolveSavingThrowAttack` has no dedicated unit
test in isolation — it's exercised through `tickEnemyPhase`, same as every
other enemy-attack branch in this file. None of this chat's changes have
been seen by a human in a browser.

### D-096 — Sub-phase 13.11: character-creation flow overhaul — real subclass choice, and a free starting-gear pick

13.10's handoff named 13.11 (character-creation flow overhaul, "closer to
real 5e chargen, reflecting real leveling") as the last Phase 13 sub-phase.
Auditing the existing creation flow surfaced a real, concrete gap before any
scoping question was asked: all four modeled subclasses (Champion/School of
Evocation/Thief/Life Domain, D-076) had never once been chosen by anyone —
every created character was always level 1, and only Cleric's subclass
choice happens at level 1; Fighter/Wizard/Rogue choose theirs at level 2-3,
a point real per-class leveling (D-089) now genuinely reaches but nothing
ever assigned a subclass there. Life Domain's own level-1 feature (Disciple
of Life) was still documented as inert "because this game has no
HP-restoring effect at all" — false since Cure Wounds shipped in 13.7.

Three scoping questions were asked directly before any code, all answered
toward the fuller option:
1. **Subclass scope — creation-time only for Cleric, or a full leveling
   hookup for Fighter/Wizard/Rogue too?** Kevin chose the full hookup: a
   real, queued confirmation overlay (reusing the ASI overlay's exact
   "queue and pop" plumbing) the first time `Hero.levelUpClass()` reaches a
   class's own `subclassChoiceLevel`, alongside auto-assignment at creation
   for a level-1-choice class (Cleric today; Sorcerer/Warlock choose at
   level 1 too but have no modeled subclass yet, so nothing to assign).
2. **Should any subclass feature get a real mechanical hookup, or stay pure
   flavor?** Kevin chose to wire up what's newly possible. Re-auditing every
   feature in `data/subclasses.ts` against everything 13.1-13.10 built
   turned up exactly two real, in-scope hookups — Champion's Improved
   Critical/Superior Critical (crit-range widening, now that `CombatSystem`
   rolls real d20 crits, D-086) and Life Domain's Disciple of Life/Blessed
   Healer (bonus healing, now that Cure Wounds exists, D-092) — plus several
   STALE inert-reasons corrected in place (e.g. Thief's Fast Hands used to
   blame "no bonus action," untrue since 13.2; the real blocker is "no
   object-interaction mechanic"). Everything else stays exactly as inert as
   documented — no new system (AoE-ally-heal targeting, a proc-chance
   mechanic, etc.) was invented to force a feature active.
3. **A starting-equipment pick at creation, or leave gearing up to the
   in-battle Gear shop as before?** Kevin chose to add the pick: one FREE
   common/uncommon item (never the five rare-and-up items from 13.9 — a free
   legendary chest piece at level 1 would be a balance problem, not a
   starting package), granted straight into its matching gear slot before
   the first battle.

**Subclass choice, made real:**
- `CharacterClassDefinition.subclassChoiceLevel` (new, required field on all
  twelve classes) extracts the level each class's own "subclass choice"
  feature already named (Martial Archetype@3, Arcane Tradition@2, Divine
  Domain@1, etc.) into queryable data, instead of leaving it locked inside a
  feature-name string match. Present for all twelve classes — even the eight
  with no MODELED subclass yet — since the LEVEL is real SRD data regardless
  of whether the CONTENT to grant there exists.
- `CharacterSystem.subclassGrantedAtLevel` (new): mirrors
  `asiFeatureGrantedAtLevel`'s own "did we just reach it" shape.
- `CharacterBuildSystem.subclassIdForNewBuild` (new): auto-assigns a
  level-1-choice class's one modeled subclass at creation time (there's no
  later level-up moment to offer it at).
- `HeroDefinition`/`CharacterBuild`/`Hero` all gain `subclassId?: string`
  (`Hero.grantSubclass`/`Hero.subclassId`). `BattleScene.applyClassLevelUps`
  now also collects every hero whose NEW level grants a subclass it doesn't
  already have, and `afterWaveCleared` chains a new
  `showSubclassChoiceQueue` (reusing the ASI overlay's exact `renderAsiPrompt`
  rendering and queue-then-proceed shape) BEFORE the ASI queue — the two
  never collide on the same level for any of the three classes today, but
  the chain handles it correctly either way. With exactly one subclass
  modeled per class, the overlay is a real, visible CONFIRMATION of a
  mandatory choice (matching the SRD: never optional), not a placeholder — a
  future second option for any class would show as a second button here,
  unchanged otherwise.
- `CharacterCreationScene`'s stats-preview block gains a third line: a
  level-1-choice class shows its real, already-assigned subclass name;
  every other class shows the level its own confirmation will appear at in
  battle (or "(not yet built)" for the eight classes with no modeled
  subclass — an honest gap, not a silent implication that a choice exists).

**The two newly-wired subclass features:**
- **Champion's Improved Critical (level 3+, crit on 19-20)/Superior
  Critical (level 15+, crit on 18-20):** `CombatSystem.AttackProfile` gains
  an optional `critThreshold` (default 20), threaded through `rollAttack`/
  `applyAttack`. `Hero.critThreshold` returns 20 for everyone except a
  Champion, 19 below level 15, 18 at or above it. Wired only into
  `BattleScene.attackProfileFor` (a hero's basic Attack action) — not
  ability-based attacks — matching the SRD's own "weapon attack" scope for
  this feature.
- **Life Domain's Disciple of Life (level 1+, +2 HP to Cure Wounds' target)/
  Blessed Healer (level 6+, +2 HP to the CASTER too, when healing someone
  else):** `Hero.discipleOfLifeBonus`/`Hero.blessedHealerBonus`, applied in
  `BattleScene.castHealSpellOn` — the target's heal is boosted first, then
  the caster (if it healed someone other than itself, avoiding a
  double-count against the same cast) regains Blessed Healer's bonus
  separately.

**Free starting-gear pick:** `characterCreation.ts` gains
`STARTING_GEAR_IDS` (`EQUIPMENT_ORDER` filtered to common/uncommon rarity —
exactly the twelve Phase 11.5 items, none of 13.9's five rare-and-up
additions). `HeroDefinition`/`CharacterBuild` gain `startingEquipmentId?:
string`; `Hero`'s constructor places a chosen item straight into its
matching slot instance (a ring item defaults to `ring1`) before any other
setup, no gold spent. `CharacterCreationScene` gains a new "Gear" row per
hero slot, cycling "None" plus the full `STARTING_GEAR_IDS` pool — this
needed a real layout change (the column background grows another 40px
downward, same discipline as D-075's race-row growth; every row below the
slot columns shifts down 50px to clear the new bottom edge, well within
`GAME_HEIGHT`'s 1080px budget).

- Tests: 569 → **596** (+27: `tests/subclasses.test.ts`'s old "everything
  stays inert forever" assertion replaced with real per-feature coverage;
  new cases in `tests/classLeveling.test.ts` for `subclassGrantedAtLevel`/
  `subclassIdForNewBuild`/`Hero.grantSubclass`/`critThreshold`/
  `discipleOfLifeBonus`/`blessedHealerBonus`; new `tests/combat.test.ts`
  cases for `critThreshold` at both the `rollAttack` and `applyAttack`
  layers; new `tests/characterCreationData.test.ts` cases for
  `STARTING_GEAR_IDS`; new `tests/characterBuildSystem.test.ts` cases for
  the two new passthrough fields; new `tests/equipment.test.ts` cases for
  `Hero`'s starting-equipment application). Typecheck/build clean (91
  modules, unchanged). `npm run dev` serves HTTP 200 (checked this chat).

**What this closes out:** with 13.11 shipped, **Phase 13 (Full D&D
Character-System Depth, 13.1 through 13.11) is now COMPLETE.**

**Not done, and why:** no new subclass ALTERNATIVES were added (still one
modeled subclass per class, per D-076's own "first pass" framing) — that's
real future content, not a flow-overhaul concern. The eight classes with no
modeled subclass yet (Barbarian/Bard/Druid/Monk/Paladin/Ranger/Sorcerer/
Warlock) still show "(not yet built)" in the creation screen rather than a
fabricated choice. Life Domain's Channel Divinity: Preserve Life stays
inert — a real rest-gated resource and a real heal effect both exist now,
but this game's healing only ever targets ONE ally at a time, and building
real AoE-ally-heal targeting is a new system, not a wiring job, so it was
named out of scope rather than forced in. Starting gear is a single free
pick, not a full 5e equipment-package system (weapon + armor + pack
choices) — one item was judged "closer to real chargen" without adding a
second new UI concept in the same pass. None of this chat's changes have
been seen by a human in a browser.

### D-097 — Phase 14: a modeled subclass for every remaining class (Barbarian/Bard/Druid/Monk/Paladin/Ranger/Sorcerer/Warlock), plus three more real hookups

Phase 13 (13.1–13.11) is complete, and Kevin is between playtesting sessions
with no time for an in-browser pass right now — he asked for whatever the
next useful step is in the meantime. The 13.11 handoff named three open
candidates (Phase 12 multiplayer, the still-open Phase 7 balance pass, or
new subclass content now that subclass CHOICE itself is real) without
picking one. Multiplayer is a large, unscoped architectural undertaking of
its own, and the Phase 7 balance pass needs Kevin's own in-browser feel —
neither fits "no time to playtest right now." New subclass content does:
it's pure data plus a small, already-built seam (`subclassChoiceLevel`/
`subclassIdForNewBuild`/`showSubclassConfirm`, all explicitly built in 13.11
for exactly this), fully covered by the existing test suite with no browser
required to verify correctness. Chosen without a further round of scoping
questions, since Kevin's own instruction was "do what you can" rather than
a specific ask — same one-real-subclass-per-class shape D-076 already
established, so there was no genuine fork left to ask about.

**One real, named subclass for each of the eight classes with none yet**
(`data/subclasses.ts`), same "honest, first pass" treatment D-076 gave the
original four — accurate SRD names/feature levels, original-wording
descriptions, most features scored honestly inert against everything this
game's systems can and can't do today:
- **Barbarian → Path of the Berserker** (Frenzy/Mindless Rage/Intimidating
  Presence/Retaliation — all inert; no bonus-action-attack-while-raging
  button, no exhaustion/fear/reaction-attack systems).
- **Bard → College of Lore** (Bonus Proficiencies/Cutting Words/Additional
  Magical Secrets/Peerless Skill — all inert; no skill/reaction/ability-
  check systems).
- **Druid → Circle of the Moon** (Combat Wild Shape/Circle Forms/Primal
  Strike/Elemental Wild Shape — all inert; this game's Wild Shape is
  already a bonus action for every Druid with no creature stat blocks to
  unlock further).
- **Monk → Way of the Open Hand** (Open Hand Technique/Wholeness of
  Body/Tranquility/Quivering Palm — all inert; no prone/knockback, no
  generic action-spending self-heal button, no save-or-die mechanic).
- **Paladin → Oath of Devotion** (Sacred Weapon/Turn the Unholy/Aura of
  Devotion/Purity of Spirit/Holy Nimbus — all inert; this game's Paladin has
  no Channel-Divinity-style resource at all, plus no fear/charm/aura
  systems).
- **Ranger → Hunter** (Colossus Slayer real; Defensive Tactics/Multiattack/
  Superior Hunter's Defense inert — no flanking, no all-adjacent-targets
  attack mode, no second reaction-based damage-reduction hook).
- **Sorcerer → Draconic Bloodline** (Draconic Resilience's HP half real;
  its AC half, Elemental Affinity, Dragon Wings, Draconic Presence all
  inert — no per-class unarmored-Dex-AC formula, damage-type resistance,
  player-controlled flight, or fear/charm-aura system).
- **Warlock → The Fiend** (Dark One's Blessing real; Dark One's Own Luck/
  Fiendish Resilience/Hurl Through Hell all inert — no ability-check
  system, no damage-type resistance, no banishment mechanic).

**Three more features clear the same bar Champion/Life Domain did in
D-096 — a genuinely existing number to plug into, not a new system invented
for the occasion:**
- **Draconic Resilience (Draconic Bloodline, level 1):** +1 max HP per
  Sorcerer level. `Hero.draconicResilienceBonus` folds into
  `effectiveMaxHealth` alongside the Tough feat's own bonus — both now
  read through a shared `flatHpBonusesTotal` getter, and `applyLeveledStats`
  (used by both `levelUpClass` and `improveAbilityScore`) diffs THAT total
  before/after instead of just the feat's, so a level-up's HP gain still
  includes this bonus's own growth. The constructor tops up a fresh level-1
  Draconic Bloodline Sorcerer's starting health by the same amount, so it
  begins fully healed rather than one HP short of its own new max.
- **Colossus Slayer (Hunter, level 3):** extra damage on a landed hit
  against the Ranger's OWN Hunter's Mark target — extends
  `BattleScene.applyHuntersMarkBonus` (the existing Hunter's Mark hookup
  from D-093) with `hero.colossusSlayerBonus` (0 for every non-Hunter),
  rather than a parallel mechanism.
- **Dark One's Blessing (The Fiend, level 1):** a flat self-heal whenever
  this Warlock lands a killing blow. New `BattleScene.applyDarkOnesBlessing`,
  called alongside Divine Smite/Hunter's Mark/equipment procs in the same
  per-swing resolution loop — the same shape as an on-kill equipment proc
  (D-094's `onKillHealNearestAlly`), just self-targeting and class-gated
  instead of item-gated.

Every other new feature stays `mechanicallyActive: false` for the same kind
of honest, specific reason every existing inert feature already documents —
nothing invented beyond the three hookups above. `subclassChoiceLevel`
already existed for all twelve classes since D-096 (even the eight with no
content yet), and `subclassIdForNewBuild`/`showSubclassConfirm` already
handled "one subclass, one button" generically — so Sorcerer/Warlock (both
level-1 choices, like Cleric) and Fighter/Wizard/Rogue-style later-choice
classes (Barbarian/Bard/Monk/Paladin/Ranger, all levels 2-3) all picked up
their new subclass with ZERO changes to the choice/confirmation machinery
itself, exactly as D-096's own "Important files" section said a future
class should.

- Tests: 596 → **617** (+21: `tests/subclasses.test.ts` expanded to cover
  all twelve classes' modeled subclasses, their feature-level integrity, and
  which ones are mechanically active; new `tests/classLeveling.test.ts`
  cases for `colossusSlayerBonus`/`darkOnesBlessingHeal`/
  `draconicResilienceBonus` (via `effectiveMaxHealth`, including level-up
  growth and stacking with Tough); one existing `subclassIdForNewBuild` test
  updated since Sorcerer/Warlock now DO auto-assign a subclass at creation).
  Typecheck/build clean (91 modules, unchanged — no new files). `npm run
  dev` serves HTTP 200 (checked this chat). No BattleScene-level test was
  added for Colossus Slayer/Dark One's Blessing, matching the existing
  precedent that Divine Smite/Hunter's Mark's own bonus damage isn't tested
  at that layer either (private, Phaser-scene methods) — only the
  underlying `Hero` getters are.

**Not done, and why:** still exactly one subclass per class (matching
D-076/D-096's own "first pass" framing) — real alternatives are a future
slice, now that all twelve classes have at least one real option. None of
this chat's changes have been seen by a human in a browser (unchanged
standing item, KI-060).

### D-098 — Correction: Druid's Phase 14 subclass was mistakenly Circle of the Moon; replaced with the real SRD subclass, Circle of the Land

Kevin asked for MORE subclass options per class, and specifically asked
whether real D&D subclasses could be used with proper attribution before
resorting to original content. Researching that question directly (not from
memory) — fetching the actual SRD 5.1 and SRD 5.2.1 documents/mirrors,
class page by class page — turned up a genuine mistake in the prior chat's
own D-097 work: Druid's modeled subclass was recorded as **Circle of the
Moon**, but the real SRD-licensed Druid subclass (under EITHER OGL 1.0a or
CC BY 4.0 — confirmed both versions license the identical twelve
subclasses) is **Circle of the Land**. Circle of the Moon is genuine
Player's Handbook content the free SRD has never included, at any point.

**Fix:** `data/subclasses.ts`'s `CIRCLE_OF_THE_MOON` replaced outright with
`CIRCLE_OF_THE_LAND` (real SRD feature names/levels: Bonus Cantrip,
Natural Recovery, Circle Spells, Land's Stride, Nature's Ward, Nature's
Sanctuary). Natural Recovery is mechanically active — a Circle of the Land
Druid's spell slots also refill on a Short Rest, simplified to a full
top-up, the same shape as the Warlock's own Pact Magic Short-Rest cadence
(`Hero.shortRest`'s Warlock branch) — a genuine improvement found while
fixing the bug, not scope creep (the existing system was a one-line reuse
away). Every other Circle of the Land feature stays honestly inert for its
own documented reason. `data/classes.ts`'s Druid Circle description,
`KNOWN_ISSUES.md` KI-060, and `CONTENT_SOURCES.md` all corrected to match.

**Why this happened:** a plausible guess (Circle of the Moon is probably
the single most iconic/popular Druid subclass) substituted for verification
against the actual license-covered text. Lesson applied going forward (and
directly informing D-099 below): verify SRD content against the real
document, don't assume from general D&D knowledge.

**No gameplay regression:** Circle of the Moon had zero real hookups in the
prior chat's own design (checked before removing it) — nothing mechanically
active is lost, and Circle of the Land's Natural Recovery is a net new real
feature. Not yet confirmed by a human in a browser — see KI-061 below.

### D-099 — Phase 14.2: a second, ORIGINAL subclass for every class, plus a real subclass-choice UI (multiple buttons/a creation-time picker)

Kevin asked for more subclass options per class and specifically asked
whether real D&D content could be used with proper attribution — "if there
is a way to use subclasses from the PHB or other source books with
attribution... let's explore that," adding this same policy should hold
for "spells, items, creatures, etc." going forward. Researched directly
(WebSearch/WebFetch against the actual SRD 5.1/5.2.1 documents and mirror
sites, not answered from memory): **both SRD versions license exactly ONE
subclass per class, full stop** — verified class-by-class across all
twelve. The rest of the real D&D subclass roster (Battle Master, Path of
the Totem Warrior, College of Valor, six more Cleric domains, Circle of the
Moon, Way of Shadow, Way of the Four Elements, Oath of Vengeance/Ancients,
Beast Master, Assassin/Arcane Trickster, Wild Magic, the Archfey/Great Old
One, seven more Wizard schools) is genuine Player's Handbook content with
no attribution scheme that makes it free — OGL 1.0a only covers what WotC
put IN the SRD document, not the rest of the PHB. This finding is the
answer for spells/items/creatures too, per Kevin's own framing: whatever
isn't in the SRD text itself isn't available under either license.

Kevin then asked a follow-up worth recording precisely: given original
content is the only path, **how close can original subclasses get to real
ones without legal risk** — can the MECHANICS be similar, just under a new
name? Answer given and acted on: general game-mechanic CONCEPTS (a
defensive rager, a martial bard, a combat-cleric, a wild-magic-flavored
sorcerer, etc.) are not copyrightable — only a specific book's exact
expression (wording, and names WotC actually uses) is. Nothing built here
reuses any real subclass's specific numbers or text regardless — every
description below is independently written, and every name is original —
but the underlying "genre archetype" a subclass leans on (a tankier
barbarian, a stealthier rogue) is exactly the kind of general idea this
project's whole existing content (enemies, equipment, maps) already treats
as fair game. Scope confirmed as "+1 per class" (12 new, one per class) —
Kevin's own recommended default, given every new one needs a genuinely
real mechanical hookup, not just data.

**Twelve new original subclasses** (`data/subclasses.ts`, one per class):
Path of the Ironhide (Barbarian), College of the Blade (Bard), Zeal Domain
(Cleric), Circle of the Ashen Veil (Druid), Battle Tactician (Fighter),
Way of the Iron Body (Monk), Oath of Retribution (Paladin), Beastbond
Warden (Ranger), Shadowblade (Rogue), Wildsurge Origin (Sorcerer),
Starbound Patron (Warlock), Spellblade Tradition (Wizard). Each gets
exactly ONE real, mechanically-active feature (this project's own
demonstrated bar for "does it actually work," not a full SRD-style 4-5
feature table) plus one honestly-inert feature for texture — reusing
EXISTING systems only, nothing new invented to force a feature active:

- **Flat, always-on to-hit bonus** (`Hero.subclassAttackBonus`, applied in
  `BattleScene.attackProfileFor` alongside `critThreshold`): Battle Hymn
  (Bard), Crusader's Wrath (Cleric), Tactician's Precision (Fighter).
- **Flat AC bonus** (`Hero.subclassArmorClassBonus`, folded into
  `armorClass`): Arcane Deflection (Wizard, always on), Ironhide Stance
  (Barbarian, while raging only).
- **Flat max-HP-per-level bonus** (`Hero.subclassHpPerLevelBonus` — the
  SAME getter Draconic Resilience already used, generalized to a THIRD
  qualifying subclass id instead of renamed/duplicated): Iron Skin (Monk),
  Umbral Ward (Warlock).
- **Bigger Divine Smite** (`Hero.subclassSmiteBonus`, read in
  `BattleScene.applyPaladinSmite`): Retributive Smite (Paladin).
- **Self-heal on the Ranger's own Hunter's Mark target**
  (`Hero.beastbondStrikeHeal`, extends `BattleScene.applyHuntersMarkBonus`
  right alongside Hunter's own Colossus Slayer bonus): Bonded Strike
  (Ranger).
- **Bonus damage on this Rogue's first landed hit each battle**
  (`Hero.shadowbladeFirstStrikeBonus`/`consumeShadowbladeFirstStrike`, a new
  one-shot per-battle flag; new `BattleScene.applyShadowbladeFirstStrike`,
  in the same per-swing resolution loop as Divine Smite/Hunter's
  Mark/equipment procs/Dark One's Blessing): First Strike (Rogue).
- **+1 maximum Sorcery Point** (`Hero.subclassSorceryPointBonus`, added
  wherever `sorceryPointsRemaining` is filled — construction and both rest
  methods): Volatile Magic (Sorcerer).
- **Bigger Wild Shape heal** (`Hero.subclassWildShapeHealBonus`, added in
  `useWildShape`): Ember Shape (Druid).

**A real subclass-choice UI, not just data** — the whole point of
"options" is that the player actually picks, so this had to change two
places that previously hardcoded "the only option":
- `BattleScene.showSubclassConfirm` now maps EVERY modeled subclass into
  its own button via the existing `renderAsiPrompt` (already proven with
  up to several buttons for the ASI/feat overlay) — a small, low-risk
  change since the rendering machinery already supported N options, only
  the hardcoded `[0]` needed to go.
- `CharacterBuildSystem.subclassIdForNewBuild` gains a `subclassIndex`
  parameter (default 0, so every existing caller/test keeps prior
  behavior) — a level-1-choice class (Cleric/Sorcerer/Warlock) needs to
  know WHICH of its two options the player picked, not just that it has
  one.
- `CharacterCreationScene` gains a new Subclass row (cycle button, same
  shape as the Gear row) for a level-1-choice class specifically — clicking
  it for any other class (whose choice happens later, in battle) is a
  harmless no-op, matching how every other cycle button in this scene
  already behaves regardless of the other slot state. This needed the
  SAME kind of layout growth D-075/D-096 already established (column grows
  40px, everything below shifts down 40px) — GAME_HEIGHT's 1080px budget
  still has ample room.

- Tests: 617 → **648** (+31: `tests/subclasses.test.ts` re-expanded to all
  24 subclasses across every dimension already covered — registration,
  per-class pairing, feature-level integrity, active-feature lists; new
  `tests/classLeveling.test.ts` cases for every one of the twelve new
  hookups, plus `subclassIdForNewBuild`'s new index parameter). Typecheck/
  build clean (91 modules, unchanged — no new files). `npm run dev` serves
  HTTP 200 (checked this chat).

**Not done, and why:** still exactly two subclasses per class (an SRD one
and an original one) — a third would need EITHER more original design work
(possible, just not this pass's scope) or would run into the same "SRD is
exhausted" wall documented above for any further real-content option.
Every other new-subclass feature (one per subclass) stays honestly inert
for its own documented reason — nothing invented to force a feature active
beyond the twelve hookups named above. None of this chat's changes have
been seen by a human in a browser — see KI-061.

### D-100 — Phase 12 kickoff: a feasibility design doc first, client-authoritative state model chosen

Phase 14 (D-097/098/099)'s handoff left three open candidates for what to
build next: Phase 12 multiplayer, the still-open Phase 7 balance pass, or
further subclass content. Asked directly, Kevin chose to scope Phase 12.
`SOURCE_OF_TRUTH.md`'s own framing of Phase 12 is a FEASIBILITY phase
("determine whether synchronized co-op is worth the complexity"), not a
commitment to ship — so before any code, Kevin was asked (1) whether this
session should produce a design doc or a working prototype, and (2) which
state-authority model to target. He chose **a design doc first** and
**client-authoritative state** (Firestore security rules gate who can
write; no Cloud Functions, no Blaze-plan billing decision needed for this
phase) over server-authoritative (which would need Cloud Functions and a
real billing opt-in).

**Delivered:** `PHASE_12_MULTIPLAYER_FEASIBILITY.md` — a full feasibility
analysis, not code. Key findings:
- Phase 11.4's existing per-hero `controlledBy: "human" | "ai"` field and
  `HeroAISystem` generalize cleanly to a third `"remote"` value — co-op
  ownership is NOT a separate system to invent, it's one more value on
  something that already exists.
- Phase 13.1's real dice (`RandomService`/`CombatSystem.applyAttack`)
  create a genuine new problem for any multi-client sync: two clients
  cannot independently recompute the same roll. Resolution: the acting
  client computes locally (unchanged) and broadcasts the RESULT, not the
  input — every other client renders from the broadcast result and never
  re-rolls. No changes needed to `CombatSystem`/`RandomService` themselves.
- The single biggest unscoped unknown is battle-state serialization
  (a live battle's full Hero/Enemy/structure/economy/map state) — `SaveSystem`
  explicitly does NOT cover this today (D-083's own boundary is
  run-BOUNDARY saves only), so there's no existing shortcut to reuse.
- A suggested four-part sub-phase breakdown (12.1 snapshot, 12.2
  session/lobby, 12.3 turn-lock/result-broadcast, 12.4 reconnect/version
  handling) is offered but NOT started or committed to.

**Not done, and why:** no code, no new Firestore collection, no new
scenes. This is a design/feasibility artifact only, per Kevin's own choice
of deliverable this session. Whether to proceed to 12.1 is his call at a
future session, weighed against the Phase 7 balance pass and further
content work — this doc doesn't decide that for him.

### D-101 — Phase 12.1: `BattleStateSnapshot` — a pure, tested full-battle serialize/restore round trip

Kevin approved proceeding into Phase 12.1, the first sub-phase
`PHASE_12_MULTIPLAYER_FEASIBILITY.md` (D-100) proposed: the battle-state
snapshot the design doc named as the single biggest unscoped unknown in the
whole feasibility analysis, since `SaveSystem` (D-083) deliberately only
ever saves party builds between runs, never LIVE battle state. Built
entirely headless, no browser needed, per the design doc's own scoping of
this sub-phase.

**What this actually required, once started:** every pure system a live
battle depends on (`Hero`, `Enemy`, `WaveSystem`, `BuildSystem`) was written
across ten prior phases with NO thought toward ever being captured and
rebuilt elsewhere — most of their mutable state was private with no getter,
and none of their constructors accepted "resume from here" data. Rather
than bolt a parallel state-tracking mechanism onto `BattleScene`, each
system gained its own additive `toSnapshot()`/restore capability, keeping
serialization logic co-located with the entity/system it describes (the
same "logic lives where the state lives" principle this project already
follows for combat/movement/building rules):
- **`Hero.toSnapshot()`/`static Hero.fromSnapshot()`** (`entities/Hero.ts`):
  a new `HeroSnapshot` interface covering literally every field a Hero
  carries — identity, HP/position/gear, class level, every per-rest
  resource pool (rage/ki/wild shape/bardic inspiration/sorcery points/spell
  slots/lucky points), every per-turn flag, subclass assignment. `fromSnapshot`
  builds a bare Hero via a reconstructed minimal `HeroDefinition` (so
  readonly identity fields still flow through the normal constructor), then
  a new private `restoreMutableState` overwrites every mutable field
  directly — deliberately NOT re-deriving anything the constructor would
  normally compute from `classId`/`startingEquipmentId` (spell slots,
  resource pools, starting gear), since the snapshot already holds their
  exact current values.
- **`Enemy.toSnapshot()`/`static Enemy.fromSnapshot()`** (`entities/Enemy.ts`):
  a new `EnemySnapshot` (instance id, `defId` looked up via
  `getEnemyDefinition` on restore, position, health, breach state, active
  statuses) plus a new `statuses` getter (previously only `hasStatus(id)`
  existed, with no way to enumerate them).
- **`BuildSystem.toSnapshot()`/`.restoreFrom()`** (`systems/BuildSystem.ts`):
  a new `BuildStateSnapshot` (placed structures + the instance-id counter).
  `builtByCounts` (the per-hero structure-limit tracker) is deliberately
  NOT stored separately — `restoreFrom` recomputes it from the restored
  structures' own `builtBy` fields, so there's no second copy that could
  fall out of sync.
- **`WaveSystem.toSnapshot()`/`.restoreFrom()`** (`systems/WaveSystem.ts`):
  a new `WaveStateSnapshot` (integrity, wave index/turn, active enemies via
  `Enemy.toSnapshot()`, the spawn-group tracking `Map`/`Set` converted to
  plain arrays, the enemy-instance counter). Deliberately excludes the map/
  pathfinding/wave-list/difficulty multipliers/`RandomService` — static
  per-battle CONFIG the caller already has, not per-run state; a restore
  call passes these back in via `WaveSystem`'s own constructor.
- **`TurnSystem.fromHistory()`** (`systems/TurnSystem.ts`): no new state
  needed — replays every transition after "preparation" through the
  EXISTING `transitionTo` (so the same legality guard a live game already
  passed through still runs on restore), reusing the `history` getter that
  already existed.
- **New `systems/BattleStateSnapshot.ts`**: the top-level orchestrator —
  `captureBattleState`/`restoreBattleState`, combining all of the above plus
  `EconomySystem.gold` and `RestSystem`'s remaining charge counts (both
  already fully reconstructable from their existing constructors/getters,
  no changes needed to either file).

**A real finding, not just plumbing:** `RandomService`'s own internal PRNG
state is DELIBERATELY excluded from every snapshot here — consistent with
D-100's own §3 finding that a future multiplayer sync should broadcast
combat RESULTS, never have a second party replay the same roll sequence. A
restored battle only needs a WORKING `RandomService` going forward, not a
bit-identical one, so nothing in this module tries to capture or replay a
past dice stream.

**Testing approach:** the core assertion throughout `tests/
battleStateSnapshot.test.ts` is `toSnapshot()` -> `fromSnapshot()` ->
`toSnapshot()` again, asserted equal to the first call — stronger than
checking individual getters by hand, since it proves EVERY field survives
the round trip, not just the ones a test author remembered to assert.
Covers: the classic fixed roster AND a D&D-built hero (class level, ASI,
feat, subclass, Rage) individually; an `Enemy` with active statuses
individually; then a full `captureBattleState`/`restoreBattleState` round
trip restored against BRAND NEW map/pathfinding instances (not the ones the
original battle used), proving the snapshot is genuinely self-contained
data, not quietly reliant on shared object identity with the live battle it
came from.

- Tests: 648 → **653** (+5, all in the new `tests/battleStateSnapshot.test.ts`).
  Typecheck/build clean — 91 modules, UNCHANGED, since `BattleStateSnapshot.ts`
  isn't wired into `BattleScene`/`main.ts` yet (Vite's build graph only
  counts modules actually reachable from the app's entry point; the new
  file is exercised only by its own tests so far, exactly matching this
  sub-phase's own scope — see "Not done" below).
- **Not done, and why:** `BattleScene` does not call any of this yet — 12.1
  was scoped as the pure, headless prerequisite only. No Firestore, no
  session/lobby, no networking of any kind (that's 12.2 onward, per
  `PHASE_12_MULTIPLAYER_FEASIBILITY.md` §11's proposed roadmap). This
  remains fully usable on its own merit independent of whether Phase 12
  continues (e.g. a future mid-battle autosave).

### D-102 — Phase 12.2: cooperative session lobby (create/join by code), and this project's first free-text input

Kevin approved proceeding into 12.2, the design doc's second proposed
sub-phase: a session/lobby, testable with two browser tabs signed in as
different anonymous users, per `PHASE_12_MULTIPLAYER_FEASIBILITY.md` §4/§11.

**A real, novel decision surfaced immediately:** a join code needs typed
text, and this project has NEVER had a free-text input anywhere — every
"name" (hero names, save slots) cycles through a preset list instead.
Rather than assume, Kevin was shown the concrete tradeoff between a custom
keyboard-driven entry widget (matches the game's native look, but no
paste support without hand-building it) and a real HTML `<input>` overlay
(native paste/copy/undo for free, but needs CSS reskinning, careful
positioning against the `Phaser.Scale.FIT`-scaled canvas, and turns on
`dom.createContainer` for the first time). Given codes get shared over
chat/Discord, paste support was judged the dominant real-world usability
factor — Kevin chose the **HTML input overlay**.

**Built:**
- **New `systems/CoopSessionSystem.ts`** (pure, tested): `CoopSessionRecord`/
  `CoopParticipant` (the lobby's plain-data shape — deliberately just the
  lobby: id/protocolVersion/hostUid/participants/timestamps, NO
  battleState/turnQueue/heroOwners yet — those are a future sub-phase's
  job once `BattleScene` is involved), `generateSessionCode` (a 6-character
  code from an alphabet excluding visually confusable characters — 0/O,
  1/I), `createSessionRecord`, `checkJoinSession`/`withParticipantAdded`
  (capped at `MAX_COOP_PARTICIPANTS = 2`, matching the Source of Truth's
  MVP party-size default), `isSessionFull`. Rejoining your OWN session
  (e.g. after a refresh) is explicitly a success outcome
  (`"already-in-session"`), not an error.
- **New `cloud/CoopSessionSync.ts`** (thin Firestore adapter, matching
  `CloudSaveSync.ts`/`MapSharingSync.ts`'s IO-only, not-unit-tested style):
  `createSession` (retries on the rare chance a generated code collides,
  using a transaction so two hosts can't both win the same code),
  `joinSession` (a transaction so two near-simultaneous joins can't both
  land as the session's single remaining seat — the second submitter
  correctly sees `"full"`), `subscribeToSession`, `deleteSession`.
- **New `firestore.rules` block, `coopSessions/{sessionId}`**: readable by
  ANY signed-in user (not participant-scoped — this app never lists/
  browses the collection, so reaching a document at all requires already
  having its code; that's what keeps this invite-only, not a read
  restriction, which would make it impossible for a second player to look
  up a session before joining it). Create is host-only; update is
  APPEND-ONLY (hostUid/protocolVersion immutable, the participant list may
  only grow by exactly one, capped at 2, and the newly appended entry must
  be the caller's own uid); delete is host-only. Matching (unrun, same
  standing JDK 21+ limitation as every prior Firestore rules addition)
  test cases added to `firestore-tests/rules.test.ts`.
- **New `scenes/CoopLobbyScene.ts`**: Create Session (shows the generated
  code + a live, subscribed participant list) or Join Session (the new
  HTML `<input>`, uppercased/alphanumeric-filtered as the player types,
  Enter-to-submit). Reached from a new Firebase-gated "Co-op" button on
  `MainMenuScene` (same gating as "Browse Shared Maps"). Handles every
  `joinSession` outcome with a distinct message (not found / full /
  version mismatch).
- **`main.ts`**: `dom.createContainer: true` added to the Phaser game
  config — the one engine-level change the HTML input needs. Every other
  scene, which never calls `this.add.dom(...)`, is completely unaffected.
- Tests: 653 → **661** (+8, `tests/coopSessionSystem.test.ts`, the pure
  lobby-rules layer only — `CoopSessionSync.ts`/`CoopLobbyScene.ts` are
  real IO/Phaser, following this project's existing precedent of NOT
  unit-testing those two categories directly). Typecheck/build clean — 91
  → **94 modules** (the three new files are now reachable from `main.ts`,
  unlike Phase 12.1's still-unwired `BattleStateSnapshot.ts`). `npm run
  dev` serves HTTP 200 (checked this session).
- **Not done, and why:** no battle integration — a session's participants
  can't yet start or play a battle together; that's a future sub-phase
  once turn ownership and a synced `BattleStateSnapshot` (D-101) are wired
  into `BattleScene`. No manual two-tab verification yet — Kevin hasn't
  had browser time this session; see the new KNOWN_ISSUES entry.

### D-103 — Phase 12.3: turn-lock ownership (`controlledBy: "remote"`), start-battle handoff — result-broadcast/visual sync EXPLICITLY DEFERRED

Kevin said "12.3" directly. Before writing any code, a genuine scope fork
surfaced: the design doc's 12.3 bullet bundles turn-lock ownership AND
result-broadcast (two clients' boards staying in sync as actions happen).
Investigating `BattleScene` showed enemies/structures are created and
destroyed dynamically as waves spawn — there is no existing "redraw
everything from the current model" function to reuse, so a real
result-broadcast sync would mean writing a brand-new visual-reconciliation
system from scratch, in the single riskiest, least-verifiable-without-a-
browser file in the codebase. Shown that concrete tradeoff (full sync now,
bigger and riskier, vs. the ownership/gating half now with sync explicitly
deferred), **Kevin chose the smaller, recommended option**.

**Built:**
- **`HeroControlMode` gains `"remote"`** (`data/heroes.ts`): a human, but
  not THIS client. Flows automatically through `Hero`/`HeroSnapshot`
  (already generic over the type), `SaveSystem.CONTROL_MODES`, and
  `firestore.rules`' `isValidBuild`. Never set by `CharacterCreationScene`'s
  own per-slot toggle (still only cycles human/ai) — only a coop battle
  start assigns it.
- **`CoopSessionSystem.ts` gains `status: "lobby" | "battle"` and
  `heroOwners: Record<heroId, uid>`** on `CoopSessionRecord`, plus
  `startCoopBattle(record, heroIds, startedAt)` (alternates ownership
  host/guest/host/guest... across the classic roster's 4 heroes in slot
  order — a flat, untuned first assignment scheme, same bar as every other
  "first pass" constant in this project, standing in for the design doc's
  own per-hero picker UI, deferred) and `canActOnHero(heroOwners, heroId,
  uid)`.
- **`CoopSessionSync.ts` gains `startBattle(code, heroIds, startedAt)`**:
  reads the record, assigns ownership, writes the result. Host-only in
  practice (enforced by rules, not re-checked client-side) so — unlike
  `createSession`/`joinSession` — it isn't transaction-guarded; there's no
  concurrent-writer race for a single host's own call.
- **`firestore.rules`' `coopSessions` block gains a second `allow update`
  shape**: a one-way `status: "lobby" -> "battle"` flip, host-only,
  requiring a non-empty `heroOwners` map and the participant list
  unchanged — alongside the existing join-shape (now also required to
  leave `status`/`heroOwners` untouched). `isValidCoopSession`'s allowlist
  grows to match. Still no `battleState`/`turnQueue`/`lastActionSeq` —
  there is nothing yet to sync, by this session's own deliberate scope cut.
- **`CoopLobbyScene.ts` gains "Start Battle"** (host-only, visible once the
  session is full): calls `startBattle` against the classic roster's hero
  ids, then navigates itself into `BattleScene` with a `coopSession`
  context. The GUEST's client detects the `status` flip via its existing
  `subscribeToSession` and auto-navigates too, without any action on their
  part.
- **`BattleScene.ts`**: a new optional `coopSession` init field
  (`{ code, localUid, heroOwners, partnerName }`). When present,
  `buildHeroes()` overrides every hero definition's `controlledBy` from
  `heroOwners` before constructing them (`"human"` for the local uid's
  heroes, `"remote"` otherwise — coop v1 always uses the classic roster,
  never a custom party). A new `canLocallyControl(hero)` gates every hero-
  selection entry point (`handleClick`'s tile-click branch, the number-key
  `selectHeroByIndex` hotkey — Enter/Space's keyboard-cursor activation
  routes through the same `handleClick`, so it's covered too); clicking a
  partner's hero shows "Waiting for `<name>`'s turn…" via the existing
  `rejectAt` rejection-flash pattern instead of selecting it.
  `runAIHeroTurns`'s existing `!== "ai"` check already skips a `"remote"`
  hero with no changes needed.
- Tests: 661 → **664** (+3, `tests/coopSessionSystem.test.ts`: hero-
  ownership alternation, `canActOnHero`, and the not-yet-started case).
  Plus new `firestore-tests/rules.test.ts` cases for the start-battle
  branch (unrun — same standing JDK 21+ limitation as every prior rules
  addition). Typecheck/build clean — 94 modules, UNCHANGED (no new files
  this sub-phase, only edits to existing ones). `npm run dev` serves HTTP
  200 (checked this session).
- **Explicitly NOT built, and why:** result-broadcast / live board sync.
  A coop battle can be entered, and each client can only act on the heroes
  it owns — but the two clients' boards do NOT converge as either side
  acts; there is no mechanism yet moving one client's move to the other's
  screen. This is the next sub-phase's job (tentatively "12.3b" — the
  design doc's own 12.4 is reconnect/version-mismatch handling, which
  depends on a working sync existing first). See `PHASE_HANDOFF.md` for
  the concrete shape that follow-up needs (a new visual-reconciliation
  function is the load-bearing piece, per this decision's own investigation
  above). No manual two-tab verification this session either — same
  standing "no browser here" limitation as every networked feature so far.

## Phase 15 — Full SRD spell-list catalogue (this chat)

### D-104 — Add every SRD-licensable spell for the game's eight caster classes, as data only
Kevin asked to "add as many spells as possible from the sources we can use,"
and to be told which ones couldn't be added and why. Before writing any
code, a genuine scope fork was surfaced and Kevin was asked directly: fill
in cantrips only, cantrips through 3rd level, or the COMPLETE SRD spell
list at every level a class can eventually cast — this game's spell-slot
tables (`data/classes.ts`) already run to 9th level for full casters and
5th level for the two half-casters, so "as many as possible" genuinely
meant up to 9th level, not just what a level-1 character can currently
reach. Kevin chose the complete lists.

**What was verified, and how:** per this file's own Phase 14.1/14.2 policy
("verify against the actual document, don't assume from general D&D
knowledge"), the exact name/level/school of every spell on the Bard,
Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, and Wizard SRD class
spell lists was checked against two independent SRD 5.1 mirrors (cross-
checked word-for-word against each other, including the Paladin/Ranger
"no cantrips, tops out at 5th level" half-caster shape), with school
assignment additionally cross-checked against a third-party open-data
spell API. A parallel attempt to verify against SRD 5.2.1 (the 2024
revision) hit a real wall: the official PDF's text is not machine-
extractable in this environment, and the one 5.2.1-labeled mirror found
was mislabeled 5.1 content — so this addition is sourced from **SRD 5.1**
specifically (CC BY 4.0 or OGL 1.0a, either valid per `CONTENT_SOURCES.md`),
not 5.2.1 like the pre-existing 14 spells. This is a deliberate, logged
distinction, not an oversight — a future session wanting 5.2.1-specific
spells (e.g. the reworked 2024 True Strike) would need its own separate
verification pass, since the two versions are confirmed to diverge on at
least that one spell.

**Scope boundary — data only, no new mechanics:** every one of the 304
newly added spells carries a name, level, school, and an ORIGINAL
description — none carry an `abilityId`, and `characterCreation.ts`'s
known-spell-lists are unchanged. This was a deliberate choice, not a
missed opportunity: most of these spells describe effects this game has
no system for (AoE at range beyond adjacency, ally buffs, summons,
illusion/utility/terrain effects, multi-target heals beyond the two
already wired), and inventing eight or nine new mechanics in one pass to
wire them all up would be exactly the kind of unrequested scope growth
`CLAUDE.md`'s operating rules warn against. This matches the EXACT existing
treatment of Bless/Burning Hands/Mage Armor/Guidance/Shield of Faith
(logged since Phase 11.2/11.3, still data-only today). A future session
can pick specific spells to wire up on request, the same way Fire Bolt,
Magic Missile, and Cure Wounds each individually got a real hookup earlier
in the project.

**What could NOT be added, and why:**
- Nothing on the eight classes' own SRD spell lists was excluded — the
  full list for all eight was added.
- Spells outside the core class spell list were NOT pursued: subclass-
  granted "expanded spell list" spells (e.g. a Cleric domain's bonus
  spells, a Warlock patron's expanded list) are additional SRD content
  beyond the base class list and were out of scope for this pass — the
  base class list alone already produced 304 new entries.
- The four non-caster classes (Fighter, Rogue, Barbarian, Monk) have no
  spell list at all in the SRD and were correctly given none.
- SRD 5.2.1-specific verification was not completed (see above) — this
  entire addition is sourced from SRD 5.1 instead, which is an equally
  valid license per this project's own `CONTENT_SOURCES.md` policy, not a
  downgrade, but it is why the new rows cite "SRD 5.1" rather than "SRD
  5.2.1" like the pre-existing 14 spells.

**Implementation:**
- **`src/game/data/spells.ts`** grows from 14 to 318 entries, organized by
  spell level (0-9) with a section comment marking the Phase 15 addition.
  Module comment rewritten to explain the two-SRD-version sourcing split.
- **`src/game/scenes/CompendiumScene.ts`**: the Spells tab gains a
  per-level filter (Cantrip/1st/.../9th, ten buttons) plus Prev/Next
  paging (12 spells/page), mirroring the existing Classes-tab selector-
  plus-pagination pattern — needed because a flat 318-entry list no
  longer fits the screen the way 14 did. `buildPaginationControls`'s
  Prev/Next handlers were generalized (`renderPaginatedDetail`) to dispatch
  to either the Classes or Spells renderer instead of hardcoding
  `renderClassDetail`.
- **`tests/spells.test.ts`**: the two tests that hardcoded the full level-0/
  level-1 id lists were replaced with structural checks (exact total count,
  every entry has a valid level/school/non-empty description, every object
  key matches its own `id`, the level-distribution counts, every pre-Phase-
  15 spell still present, every Phase-15 addition still `abilityId`-free) —
  a 318-entry catalogue is data to validate structurally, not a fixed list
  to hardcode and hand-update every future addition.
- Tests: 664 → **668** (net +4 — six new structural tests replaced two
  hardcoded-list tests). Typecheck and build clean; `npm test` 668/668
  pass.
- **No in-browser verification this session** — the new Compendium
  pagination UI is unconfirmed by a human, same standing limitation as
  every other Compendium change since Phase 11.5.

### D-105 — Phase 15 follow-up: model the four SRD subclasses' real "bonus spell" feature, still data-only
D-104's own "what could NOT be added" list flagged subclass-granted
expanded spell lists (a Cleric domain's bonus spells, etc.) as out of
scope. Kevin asked directly to "tackle the subclass granted spell thing" —
this decision closes that gap.

**What was found:** re-reading `data/subclasses.ts` turned up that this
feature wasn't merely inert for Life Domain, Oath of Devotion, and The
Fiend — it was simply ABSENT from the data table entirely (Circle of the
Land was the one exception, already carrying a generic "Circle Spells"
placeholder feature). This was an omission from Phase 11.3/14/14.1's
original subclass authoring, not a deliberate choice.

**Verification:** per this file's own D-098/D-099 policy, a research agent
verified all four features against SRD 5.1 using 2-3 independent mirrors
per feature (5esrd.com, 5thsrd.org, roll20.net, cross-checked against each
other):
- **Life Domain (Cleric) — Domain Spells**: Bless/Cure Wounds (1st),
  Lesser Restoration/Spiritual Weapon (3rd), Beacon of Hope/Revivify (5th),
  Death Ward/Guardian of Faith (7th), Mass Cure Wounds/Raise Dead (9th).
- **Oath of Devotion (Paladin) — Oath Spells**: Protection from Evil and
  Good/Sanctuary (3rd), Lesser Restoration/Zone of Truth (5th), Beacon of
  Hope/Dispel Magic (9th), Freedom of Movement/Guardian of Faith (13th),
  Commune/Flame Strike (17th). One WebSearch snippet surfaced a wrong
  variant (Shield of Faith/Aid) that wasn't corroborated by any direct
  mirror fetch — caught and discarded, a real example of why this
  project's "verify against the document, don't trust a stray snippet"
  discipline matters.
- **The Fiend (Warlock) — Expanded Spell List**: Burning Hands/Command
  (1st), Blindness-Deafness/Scorching Ray (2nd), Fireball/Stinking Cloud
  (3rd), Fire Shield/Wall of Fire (4th), Flame Strike/Hallow (5th) — keyed
  by SPELL level, not character level (see implementation below for how
  that maps onto this game's shared full-caster slot table).
- **Circle of the Land (Druid) — Circle Spells**: confirmed exactly 7
  terrains (arctic, coast, desert, forest, grassland, mountain, swamp) —
  no Underdark option, which is full-PHB content the SRD never included
  (three SRD-scoped mirrors agreed; a fourth, non-SRD-scoped mirror that
  DID include Underdark also used the non-SRD name "Melf's Acid Arrow"
  instead of the SRD's stripped "Acid Arrow," confirming it wasn't a
  reliable SRD source). Full 4-tier table for all 7 terrains recorded.

**Every spell these four features grant was already in Phase 15's own
318-entry catalogue** (`data/spells.ts`) — this decision needed zero new
spell entries, only new subclass-feature data referencing existing ids.

**Implementation — still entirely data-only, on purpose:**
- **`ClassFeature` (`data/classes.ts`) gains an optional
  `grantedSpellIds?: string[]`** — set only on a feature that grants
  specific bonus spells.
- **Life Domain/Oath of Devotion/The Fiend** each gain 5 new feature
  entries (one per granted tier) carrying `grantedSpellIds`, all
  `mechanicallyActive: false`. Reason: this game's known-spell list is
  fixed per CLASS (`characterCreation.ts`'s `knownSpellIdsForClass`), not
  extended per subclass — wiring these in would mean either inventing a
  per-subclass spell-list override (new scope, not requested) or, worse,
  silently adding spell ids with no `abilityId` to a hero's castable list,
  which would crash `BattleScene`'s spellbook (`canCastSpell` calls
  `getAbility`, which throws on an id with no `AbilityDefinition`). Cure
  Wounds (Life Domain's 1st-tier grant) is the one spell here that DOES
  have a real `abilityId` — but a Cleric already knows it via the base
  class regardless of domain, so even a full wiring job would change
  nothing observable today.
- **The Fiend's tiers use CHARACTER levels 1/3/5/7/9**, not the SRD's own
  spell-level framing, because this game's Warlock deliberately shares the
  full-caster slot table rather than real Pact Magic's shape (an existing,
  documented simplification — Phase 13.8/D-093) — those are the character
  levels where each matching spell-level slot first appears on that shared
  table.
- **Circle of the Land's terrain table is its own exported constant,
  `CIRCLE_OF_THE_LAND_SPELLS`** (not per-feature `grantedSpellIds`),
  because the SRD mechanic itself is two-dimensional (a terrain choice,
  THEN a level) and the choice hasn't been made yet — there is no
  character-creation UI anywhere in this game for picking a Druid's
  terrain. This is a bigger, separately-scoped gap than the other three
  (a new CHOICE to build, not just a wiring job) and stays explicitly
  deferred — the data exists now so a future slice can consume it directly
  without re-researching the table.
- Tests: 668 → **674** (+6, all in `tests/subclasses.test.ts`, 39 → 45):
  every `grantedSpellIds` id resolves via `isSpellId` (catches
  typos), each of the three fixed-list features matches its exact verified
  table, and `CIRCLE_OF_THE_LAND_SPELLS` covers exactly 7 terrains × 4
  tiers × 2 spells, all resolving.
- Typecheck and build clean.

**What's still NOT done, and why:** no new spell became castable (same
boundary as D-104); Circle of the Land's terrain-choice UI (a real new
character-creation decision, not a wiring job) remains a properly-scoped
future slice, not folded into this pass.

### D-106 — Phase 16, "make all spells usable": six new mechanics, ~184 spells wired to a real ability, full per-class known-spell lists
Kevin asked directly to "make all the spells usable in the game." Given the
scale (D-104/D-105 had already flagged AoE-at-range, ally buffs, summons,
terrain-shaping, forced movement, and self-teleport as the reasons most of
the 318-entry catalogue stayed data-only), three scoping questions were
asked before any code:
1. **How far to go on the genuinely exotic spells** (summons, illusions,
   teleport, charm, scrying, terrain-shaping) that don't fit the existing
   single-target/AoE-adjacent/heal/status model at all — reflavor into
   existing mechanics, build real new systems, or leave them deferred.
   Kevin chose **build real new systems**.
2. **Should each class's known-spell list expand to its FULL real SRD list**,
   or stay capped like real 5e's spells-known/prepared rules. Kevin chose
   **full list, all known** — this project already skips real 5e
   prepared-spell bookkeeping (Phase 13.7, D-092), and a fuller spellbook is
   more content, not more rules overhead.
3. **Pacing**, given this would be the largest content batch yet. Kevin
   chose **one big sequenced batch, my judgment** — build the systems first,
   then wire spells level-by-level as a long sequence of small tested
   pieces, matching this project's established precedent for large
   Kevin-approved batches (see the Phase 7 "remaining content" precedent
   this file's operating rules cite).

**New mechanics built (all pure, tested where the logic is Phaser-free;
BattleScene wiring is untestable without a browser, same standing
limitation as every other scene-level feature):**
- **Five new status effects** (`data/statusEffects.ts`): `poisoned`/
  `restrained` reuse `burning`/`stunned`'s exact shape under a second
  flavor name; `blinded` (the afflicted enemy's own attacks roll with
  disadvantage — reuses `RandomService.rollD20With`'s existing
  advantage/disadvantage support, already built for Champion's crit
  thresholds, so `CombatSystem` needed zero changes), `exposed` (lowers the
  enemy's effective Armor Class, folded into `Enemy.armorClass` itself so
  every existing attack path respects it for free), `charmed` (the enemy
  attacks another enemy in range instead of a hero this phase, via a new
  branch in `WaveSystem.tickEnemyPhase` — the stand-in for every SRD
  charm/dominate spell within this game's per-enemy-turn model).
- **A new ally-buff system** (`data/buffEffects.ts`, `Hero.activeBuffs`) —
  the Hero-side counterpart to Enemy's status effects, since NO ally-facing
  lingering-effect mechanism existed before this phase (Rage/Wild Shape's
  resistance timer and Bardic Inspiration were each their own bespoke
  scalar field, not a generic system). Three buffs: `blessed` (+2 attack
  rolls), `warded` (+2 Armor Class), `guided` (+2 saving throws). Folded
  into `Hero.armorClass`/`savingThrowBonus`/a new `effectiveAttackBonus`
  getter (which `BattleScene` now builds every `AttackProfile` from, weapon
  or spell alike, instead of the raw `attackBonus` field); ticks down once
  per hero turn in `resetForNewTurn`. Full `HeroSnapshot` round-trip support
  added (Phase 12.1, D-101's shape).
- **A third `AbilityKind`, `"aoeAtRange"`** — choose any tile within
  `rangeTiles`, hit every enemy within `radiusTiles` of THAT tile. Reuses
  `CombatSystem.attackArea` centered on the chosen tile instead of the
  hero — zero changes needed to `CombatSystem` itself. New `Interaction`
  variant `"aimingTileSpell"` (shared by this, teleport, summon placement,
  and terrain placement, rather than one variant per spell kind).
- **`areaAllies`/`appliesBuff` fields on `AbilityDefinition`** — a
  `targetsAlly` spell with `areaAllies` applies to every living ally at
  once (heal and/or buff), no aiming needed, simplified from "choose up to
  N targets" to "the whole party" since the roster is already small.
- **`forcedMoveTiles`** — a landed hit pushes the enemy target directly
  away from the caster (`BattleScene.pushEnemyAway`, stopping early at the
  first blocked tile) — the stand-in for every SRD forced-movement spell.
- **`teleportSelf`** — the caster jumps to an empty chosen tile within
  range, no move-slot cost — the stand-in for every SRD short-range
  self-teleport spell.
- **A new summon system** (`data/summons.ts`, `entities/Summon.ts`,
  `systems/SummonSystem.ts`) — a temporary ally combatant, modeled after
  `Enemy` (same `Combatant` shape) rather than `Hero` (no move/action
  economy of its own). Three shared archetypes (spectral-blade,
  guardian-spirit, elemental-servant) rather than one bespoke stat block
  per summon-flavored spell — the same "reuse a small shared shape"
  simplification `statusEffects.ts` already makes for dozens of
  debuff-flavored spells. A summon strikes the nearest enemy in reach once
  per hero turn (`SummonSystem.actAndTick`, called at the start of
  `BattleScene.runEnemyPhase` so it defends the party before the enemies
  act), then its duration ticks down; removed on expiry or defeat. **Not
  yet part of `BattleStateSnapshot`** — logged in KNOWN_ISSUES (KI-064),
  same treatment as `RandomService`'s excluded PRNG state.
- **Terrain-shaping via existing `BuildSystem`** — two new spell-only
  structures (`spectral-wall`, `web-patch`, `data/structures.ts`, `cost: 0`,
  absent from `SHOP_ORDER`) placed through the exact same
  `BuildSystem.place`/`canPlace` validation a built wall already gets
  (never sealing off every spawn-to-exit route). `BattleScene` tracks a
  `temporaryStructures` list ticking down to auto-`remove()`.

**~184 of 318 catalogued spells now carry a real `abilityId`** (198 total,
including the 14 pre-existing): every spell whose SRD flavor text maps
onto one of the mechanics above or the pre-existing single/aoeAdjacent/
heal/status model, via a documented archetype rulebook (12 archetypes,
priority-ordered, covering damage/debuff/heal/buff/summon/terrain/
forced-move/teleport in single-target, AoE-adjacent, AoE-at-range, and
area-of-allies shapes) applied level-by-level across the whole catalogue.
**Damage/duration numbers are flat, untuned "first-pass" formulas**
(`damage = 5 + level*3` for a single target, ×0.7 for an AoE hit, matching
the exact "same as every other balance number in this project" precedent
this file has used since Phase 5) — precision wasn't the goal, consistency
was.

**~120 spells stay genuinely data-only, on purpose** — pure information/
social/utility/ritual/exploration/crafting/travel spells with no plausible
application in a tactical-combat-only game (Comprehend Languages, Identify,
Scrying, Water Walk, Tiny Hut, etc.). This is the same honest "inert until
it fits" boundary D-104 itself drew, just redrawn much further out now that
six new mechanics exist to fit spells into.

**Six full-caster classes' known-spell lists expanded from 1-2 curated
entries to their full real SRD 5.1 list, filtered to what's wired**
(`data/characterCreation.ts`): Wizard (7 cantrips/106 leveled), Cleric
(3/56), Bard (2/51), Druid (5/61), Sorcerer (7/83), Warlock (4/37) — the
per-class SRD list membership was researched fresh this session (2-3
independent SRD 5.1 mirrors, cross-checked; one mirror's extra
Xanathar's/Tasha's/2024-PHB content was caught and excluded from Bard's
list, a real example of this file's "verify, don't trust one source"
discipline paying off). **Paladin and Ranger were deliberately NOT
expanded** — their half-caster slots are already spent automatically on
Divine Smite/Hunter's Mark (D-093); adding a spellbook too would double-book
the same slot pool, a bigger, separate decision left for later.

**A real UI problem found and fixed along the way:** `BattleScene`'s
spellbook overlay (built in Phase 13.7, D-092, for a 2-6-spell list) laid
out every castable spell in a single centered row — with a level-1 Wizard
now seeing 20 castable spells (7 cantrips + every 1st-level spell they have
a slot for), that row would have rendered most buttons off-canvas,
un-clickable. Rebuilt as a 4×3 paginated grid with Prev/Next, mirroring
`CompendiumScene`'s existing per-level Spells-tab paging pattern.

**A real Phase 15 gap found, not fixed:** Warlock's Hellish Rebuke is on
the real SRD Warlock list but was never added to `data/spells.ts`'s
318-entry catalogue at all. Adding a new catalogue entry is a Phase-15-
shaped change (D-104's own scope), not a "wire up what's already there"
change, so it's logged (KI-064) rather than silently patched here.

**A real engine gap found, not fixed:** `aoeAtRange` abilities don't
support `savingThrow` — the resolver that casts them always rolls a normal
attack roll (or `autoHit`), never a save. A few spells that would ideally
force "everyone in the blast saves" (Fireball's real SRD mechanic, e.g.)
instead resolve as a per-target attack roll. Logged (KI-064) as a scoped
future improvement to `attackArea`/`SavingThrowSystem`, not attempted here.

- Tests: 691/691 passing (677 before this phase — statusEffects/buffEffects/
  summonSystem gained the bulk of the new coverage; spellSlots.test.ts and
  spells.test.ts had stale Phase 15-era hardcoded assertions updated to
  structural checks that survive the catalogue's new reality without
  hardcoding all 198 wired ids). Typecheck and production build both clean
  (98 modules, up from 94 — `buffEffects.ts`/`summons.ts`/`Summon.ts`/
  `SummonSystem.ts` are the four new files). `npm run dev` serves HTTP 200.
- **Not yet confirmed by a human in a browser** — by far the largest
  single content/systems addition in this project's history, so this
  matters more than usual here. See KNOWN_ISSUES **KI-064** for the full
  verification checklist and every known, deliberate gap (aoeAtRange +
  savingThrow, Hellish Rebuke missing from the catalogue, Paladin/Ranger's
  spellbook, summons outside `BattleStateSnapshot`).

### D-107 — Phase 16 follow-up (same day): fix `aoeAtRange` + `savingThrow`, add the missing Hellish Rebuke
Kevin asked directly to fix both of D-106's own logged gaps. Both are now
resolved:

- **`aoeAtRange` + `savingThrow`**: `BattleScene.castAoeAtRangeSpell` now
  branches on `ability.savingThrow`. When set, every enemy within the
  blast radius rolls independently against the caster's `spellSaveDC`
  (`SavingThrowSystem.applySaveOrDamage`, the exact same call
  `castSavingThrowAbilityOn` already makes for a single target) instead of
  an attack roll; `appliesStatus` only lands on a failed save, matching
  the SRD's real "half damage and no effect on a success" shape. 25 of the
  29 `aoeAtRange` abilities that read as a genuine SRD save spell (Fireball
  DEX, Stinking Cloud CON, Confusion WIS, Calm Emotions CHA, Gust of Wind
  STR, etc. — matched against each spell's real SRD saving-throw ability)
  now carry a `savingThrow` field with the correct ability score.
  Scorching Ray (a real spell ATTACK roll, no save) and three complex/
  multi-effect spells (Earthquake, Reverse Gravity, Storm of Vengeance)
  were deliberately left as attack-roll approximations — a genuine save
  doesn't cleanly cover their SRD text either.
- **A second, related bug found and fixed in the same pass**:
  `forcedMoveTiles` (Thunderwave, Gust of Wind, Reverse Gravity) was never
  actually applied on an `aoeAtRange` ability at all — the push logic only
  ever ran in the single-target resolver. `pushEnemyAway`'s signature
  generalized from `(hero, enemy, tiles)` to `(from: GridPosition, enemy,
  tiles)` so an AoE push can originate from the blast's own tile (not the
  caster) — geometrically the correct origin for a tile-targeted effect,
  and matches every pushed spell's real SRD framing (the blast/gust
  pushes things away from ITSELF, not from wherever the caster happens to
  be standing).
- **A new `tests/abilities.test.ts`** guards against this exact class of
  bug recurring: no ability may combine `autoHit` with `savingThrow`
  (mutually exclusive resolution paths), every `savingThrow.ability` must
  be a real ability score id, and at least one real `aoeAtRange` +
  `savingThrow` combination (Fireball) must exist — so a future edit that
  silently strips `savingThrow`'s effect again would fail loudly.
- **Hellish Rebuke** — the one real SRD 5.1 Warlock spell D-106's own
  research found missing from `data/spells.ts`'s catalogue entirely (a
  Phase 15, D-104, omission). Added as spell #319 (level 1, evocation),
  wired with a real `abilityId` (a normal single-target attack, `damage:
  8`, `rangeTiles: 4`, `spellSlotLevel: 1`) and added to
  `WARLOCK_LEVELED_SPELL_IDS`. **Deliberately simplified**: the SRD casts
  it as a REACTION (triggered by taking damage); this game has no reaction
  economy for a caster to hook a damage-triggered spell into (Uncanny
  Dodge is the one reaction that exists, and it auto-applies with no
  interrupt-prompt UI — the same simplification precedent applied here),
  so it resolves as a normal action-cost attack instead, same tradeoff
  every other "can't fully model the trigger" mechanic in this project has
  made.
- Tests: 691 → **695** (+4, all in the new `tests/abilities.test.ts`;
  `tests/spells.test.ts`'s catalogue-count assertions updated for 319
  spells/199 wired/49 level-1 spells). Typecheck and production build both
  clean (98 modules, unchanged — no new files this time, only edits).
  `npm run dev` serves HTTP 200.
- **Still not yet confirmed by a human in a browser** — this is a fix to
  logic, not a substitute for playing it; see KNOWN_ISSUES **KI-064**
  (updated to mark both gaps resolved, with the still-open items — Paladin/
  Ranger's spellbook, summons outside `BattleStateSnapshot` — unchanged).

### D-108 — Phase 17: real SRD weapons, armor, and weapon mastery
Kevin asked directly to add "tons and tons" of source-accurate weapons and
armor, and to build the real weapon masteries and assign them to the
appropriate weapons. This is the first genuinely new equipment ARCHITECTURE
since Phase 11.5 (D-078) — there was no `"weapon"` gear slot at all before
this; `CharacterBuildSystem`'s own doc comment had flagged "no weapon
catalogue" and "no armor-item catalogue" as known gaps since Phase 13.1.

Two scoping questions were asked before any code, both answered toward the
fuller/more real option:
1. **Weapon Mastery depth**: build a real mechanical hook for every
   mechanically-modelable property, or log them as accurate data only this
   pass? Kevin chose real mechanics for all 7 modelable properties (Cleave,
   Graze, Push, Sap, Slow, Topple, Vex) — comparable in scope to Phase 16's
   six-mechanic batch. Nick (the 8th) stays honestly data-only: its real SRD
   trigger is two-weapon fighting's off-hand extra attack, and this game has
   exactly one `"weapon"` slot, no dual-wielding/off-hand system at all — a
   logged, real gap, not a faked reinterpretation under Nick's name.
2. **Weapon math**: should an equipped weapon REPLACE a hero's base attack
   damage (true to "your weapon determines your damage"), or just add a
   small bonus like every other gear slot? Kevin chose replace.

**Sourcing.** Weapon Mastery is 2024-rules-ONLY — it doesn't exist in the
2014 SRD 5.1 this project's spell catalogue is mostly sourced from. A
dedicated research pass verified the full weapon table (38 core weapons),
armor table (11 armors + Shield), and the 8 mastery properties' exact rules
text and per-weapon assignment against 5+ independent sources (the official
SRD 5.2.1 legal-page text, a full markdown conversion of the SRD, D&D
Beyond's free-rules pages, and two mastery-specific reference pages) —
catching and discarding one source's wrong Shortsword-mastery transcription
and one fabricated 9th "mastery property" name from an AI-generated search
summary. SRD 5.2.1 is confirmed CC-BY-4.0 (this project's combat-math rows —
ability modifiers, proficiency bonus, the d20 attack/save mechanic — were
already sourced from 5.2.1, so this isn't a new license to track).

**What shipped:**
- **36 of the SRD's 38 core weapons** (`data/weapons.ts`) — every Simple and
  Martial, Melee and Ranged weapon EXCEPT the two core firearms (Musket,
  Pistol), deliberately trimmed for fantasy-setting tone (no gunpowder is
  established anywhere else in this game's world) rather than a completeness
  gap. Each carries its real category/kind/damage dice/damage type/
  properties (Ammunition, Finesse, Heavy, Light, Loading, Reach, Thrown,
  Two-Handed, Versatile) and its real assigned mastery property.
- **All 11 SRD armors (3 light/5 medium/4 heavy) + the Shield**
  (`data/armor.ts`) — light adds a hero's full Dex modifier (mechanically
  identical to the pre-existing unarmored-10+Dex formula, so nothing changes
  for a hero who never equips one), medium caps the Dex bonus at +2, heavy
  ignores Dex entirely. Strength requirement/stealth disadvantage are real,
  accurate reference data, not yet mechanically enforced (no Str-gated
  movement penalty or stealth-check system exists to hook into — an honest
  boundary, not an oversight).
- **Two new gear slot TYPES, `"weapon"` and `"shield"`** (`data/equipment.ts`)
  — merged into the SAME `EQUIPMENT_DEFINITIONS`/`EQUIPMENT_ORDER` registry
  every existing Gear-shop/Compendium/attunement/proc code already reads
  generically, so the entire existing UI (shop grid, equip/unequip, the
  Compendium's Equipment tab, character-creation's starting-gear picker)
  worked with ZERO special-casing beyond the type additions themselves.
- **`systems/WeaponSystem.ts`** (new, pure, tested): `averageDiceDamage`
  (reuses `CharacterSystem.fixedHitDieGain`'s exact "round half up per die"
  convention — a longsword's 1d8 becomes a flat 5, not a newly-invented
  rounding rule), `weaponAttackDamage`, `weaponRangeTiles` (melee 1 tile,
  Reach/Thrown 2, Ammunition 3 — the existing 1-vs-3 melee/ranged band,
  Reach/Thrown filling the gap), `weaponAbilityModifier` (Finesse picks the
  better of Str/Dex, else ranged uses Dex and melee uses Str).
- **`Hero.effectiveAttackDamage`/`.attackRangeTiles`** now check the new
  `"weapon"` slot: if filled, the weapon's own damage/range REPLACES the
  hero's base numbers; if empty, a hero plays byte-for-byte as before this
  phase. A `classId` hero's class-specific rider damage (e.g. Sneak Attack)
  is kept in a new separate `classRiderDamage` field
  (`CharacterSystem.LeveledCombatStats.bonusRiderDamage`,
  `HeroDefinition.classRiderDamage`) so it still applies ON TOP of a real
  weapon's damage instead of being silently replaced along with the old
  flat base. A Versatile weapon grips two-handed (bigger die) automatically
  whenever no Shield is equipped.
- **`Hero.armorClass`** branches on the chest slot's `armor` field: real
  armor REPLACES the unarmored-AC formula outright (with the correct Dex
  handling per category); a flavor chest item (Iron Buckler, etc., no
  `armor` field) keeps adding its flat bonus exactly as before. A Shield is
  a separate flat +2 bonus, stacking on top of either.
- **Six real weapon-mastery mechanics**, resolved by a new
  `BattleScene.applyWeaponMastery` (same scope boundary as Divine Smite/
  Hunter's Mark/equipment procs — the basic Attack action only), applied to
  whoever wields the weapon regardless of class (a deliberate simplification
  of the SRD's real "unlocked mastery slots per class" rule):
  - **Push**: reuses the existing `pushEnemyAway` forced-movement helper
    (2 tiles).
  - **Slow**: reuses the EXISTING `"slowed"` status effect.
  - **Sap**: a new `"sapped"` status (`data/statusEffects.ts`), reusing
    "blinded"'s exact `attackRollDisadvantage` shape. `Enemy` gained a
    generic `attacksWithDisadvantage` getter (summed across every active
    status, the same generalization `armorClass` already uses for
    "exposed") so `WaveSystem`'s disadvantage check no longer hardcodes
    "blinded" alone — "sapped" and Topple's "toppled" (below) both plug in
    for free.
  - **Topple**: a real Constitution saving throw
    (`SavingThrowSystem.rollSave`, DC = 8 + the hero's own `attackBonus`,
    matching the SRD formula) — a failed save applies `"toppled"`.
  - **Graze**: on an actual miss, still deals the wielder's ability modifier
    in damage (`Hero.weaponAbilityModifierNow`).
  - **Vex**: grants advantage on the wielder's NEXT attack against the same
    target (`Hero.hasVexAgainst`/`setVex`/`clearVex`) — scoped to exactly
    one attack roll, not an Extra-Attack action's whole flurry.
  - **Cleave**: a second, once-per-turn attack roll (`Hero
    .canUseCleaveMastery`/`consumeCleaveMastery`) against another living
    enemy adjacent to the first target, dealing the weapon's die average
    alone (no ability modifier, matching the SRD).
- **`Hero.wouldConflictWithGrip`**: a real SRD rule — a Two-Handed weapon
  can't be equipped alongside a Shield, and vice versa — gated at equip
  time in `BattleScene.equipGearOnHero`, same "reject before gold changes
  hands" shape as the attunement gate (D-094).
- **The Gear shop grid is now paginated** (`GEAR_GRID_PAGE_SIZE = 16`, a
  4x4 page) — the catalogue nearly quadrupled in size (17 → ~73 items), and
  the old always-all-visible grid (Phase 11.5's original design) would now
  run many rows past the canvas. Reuses the SAME `gridFocusIndex` keyboard/
  mouse selection state already tracked — a page is just `floor(index / 16)`
  — so arrow-key navigation across a page boundary, and opening the grid on
  an already-equipped item, both land on the right page for free, with no
  separate page field to keep in sync. `CompendiumScene`'s Equipment tab
  joins Classes/Spells as a paginated category for the same reason.
- Tests: 695 → **744** (+49: new `tests/weaponSystem.test.ts` [14],
  `tests/weaponsAndArmor.test.ts` [13] catalogue-structure checks, extended
  `tests/equipment.test.ts` [+16] and `tests/statusEffects.test.ts` [+3]
  and `tests/characterBuildSystem.test.ts` [+2]). Typecheck, all tests, and
  the production build all pass (101 modules, up from 98 — `data/weapons.ts`,
  `data/armor.ts`, `systems/WeaponSystem.ts` are the three new files).
  `npm run dev` serves HTTP 200.
- **Not yet confirmed by a human in a browser** — a large content+mechanics
  addition, same standing caveat as every other unplayed phase. See
  KNOWN_ISSUES **KI-065** for the full verification checklist.
- **Known, deliberate boundaries, not bugs**: Nick stays mechanically inert
  (needs dual-wielding); ammunition isn't tracked/consumed as an inventory
  resource; Armor's Strength requirement/stealth disadvantage are data-only;
  mastery isn't gated per-class/per-weapon-slot the way the real SRD rule
  works — it applies to any wielder of that weapon; a Two-Handed weapon's
  reach doesn't get a Reach-property bonus beyond the flat tile bands
  `weaponRangeTiles` already assigns.

### D-109 — Phase 18: every remaining SRD 5.2.1 feat, with real prerequisites enforced — plus a sourcing correction to Phase 11.3

Kevin asked to "add as many feats as we can from the source material (2024
rules) so that leveling up characters can feel more true to real D&D," with
prerequisites enforced. Before writing any code, a verification pass against
the actual SRD 5.2.1 PDF (not memory — the same discipline this file's own
"verify against the actual document" rule already demands) found something
that reshaped the whole task: **the free SRD 5.2.1 Feats chapter contains
only 17 feats total**, not the ~50+ of the full 2024 PHB, and — more
importantly — **3 of the 4 starter feats already shipped in Phase 11.3
(D-075) are PHB-exclusive, not actually in the free document**. Only Alert
was real SRD content; Tough, Lucky, and Athlete had been mistakenly logged
as SRD-sourced.

Kevin was asked directly how to handle both questions, and chose the fuller/
more thorough option each time:
1. **The Tough/Lucky/Athlete sourcing error**: fix the attribution now
   rather than leave the inaccurate claim standing — but keep the mechanics
   exactly as they are (already balanced, tested, shipped). See the
   corrected `CONTENT_SOURCES.md` rows.
2. **Scope given only 17 real SRD feats exist**: build all 13 net-new ones
   (not just the handful with the cleanest existing hooks), including the
   7 Epic Boons even though a dedicated investigation found they're
   practically unreachable in this game's current run lengths (see below).

**The 13 net-new feats** (17 SRD feats, minus Alert already shipped, minus
Ability Score Improvement, already the parallel "raise scores" branch of
this exact same choice):
- **Origin**: Magic Initiate, Savage Attacker, Skilled.
- **General**: Grappler.
- **Fighting Style** (prereq: a class Fighting Style feature — Fighter L1,
  Paladin/Ranger L2): Archery, Defense, Great Weapon Fighting, Two-Weapon
  Fighting.
- **Epic Boon** (prereq: level 19+): Combat Prowess, Dimensional Travel,
  Fate, Irresistible Offense, Spell Recall, the Night Spirit, Truesight.

**A second research pass** verified every one of the 13 feats' exact
name/category/prerequisite/mechanic against the real SRD 5.2.1 PDF, cross-
checked against an independent fan compilation and a full-text search of
the entire 364-page document to rule out any feat existing elsewhere —
same "verify, don't assume" discipline as Phase 14.1/14.2's Circle of the
Moon mistake this file already warns against.

**A third investigation** (this codebase's actual damage model, weapon
data, spellcasting, ability-score cap, max level, status effects) found
several real implementation constraints:
- **Damage is flat, never dice-rolled** (`WeaponSystem.averageDiceDamage`
  collapses dice to a flat average at equip time; `CombatSystem
  .computeDamage` just doubles a flat number on crit) — so Savage
  Attacker's "reroll and keep the better result" and Great Weapon
  Fighting's "reroll 1s and 2s" become flat bonus damage numbers instead,
  the same diceless-conversion treatment Sneak Attack/Colossus Slayer
  already got for their own SRD dice expressions.
- **No dual-wielding/off-hand-attack system exists at all** — the SRD's
  near-identical Nick weapon mastery (Phase 17, D-108) was already left
  honestly inert for exactly this reason. Two-Weapon Fighting gets the
  same treatment rather than a faked reinterpretation.
- **`MAX_ABILITY_SCORE` (20) is a single private constant, one call site**
  (`Hero.improveAbilityScore`) — trivial to parameterize per-feat, so
  Grappler's ability bump stays capped at 20 (the normal SRD ceiling) while
  every Epic Boon's own bump uncaps to 30 (its own real SRD ceiling), via a
  new `FeatDefinition.abilityScoreBoost.hardCap` field.
- **Epic Boons (level 19+) are real content but practically unreachable in
  actual play today**: max class level is 20 in code, but no single run
  gets remotely close to level 19 (10 waves max per run/campaign, a
  level-up every 2 waves → class level 6 ceiling, and nothing persists a
  hero's class level between separate battles). This exactly mirrors an
  already-accepted precedent in this same codebase — Barbarian's level-20
  Primal Champion is real class-feature data, documented as inert/
  unreachable today (`classes.ts`). Epic Boons get the same honest
  treatment: real, correctly-gated content, not silently pretended-
  reachable.
- **Known spells are a pure function of `classId`**, not a mutable per-hero
  list, and non-caster classes (Fighter/Rogue/Barbarian/Monk) have ZERO
  spell-slot infrastructure — Magic Initiate needed new mutable per-hero
  state (`Hero.magicInitiateGrants`/`magicInitiateSpellUsesRemaining`,
  mirroring the shape of existing per-rest resource fields like
  `rageUsesRemaining`) rather than "appending" to the derived known-spell
  list. Its granted leveled spell is castable via a dedicated once-per-
  Long-Rest free-use resource — uniform across caster and non-caster heroes
  alike, simpler than routing through the class-gated `spellSlotsRemaining`
  array.
- **No general feat-prerequisite check existed** — every per-class feature
  gate (`canUseSecondWind`, `canUseRage`, etc.) hand-wrote its own condition
  inline. `Hero.meetsFeatPrerequisites(featId)` is the first one, built
  from a new `FeatPrerequisite` record on `FeatDefinition` (`minLevel`,
  `requiresFightingStyleFeature`, `requiresSpellcastingFeature`,
  `minAbilityScoreAnyOf`). `BattleScene.showFeatChoice` now filters on this
  instead of the old bare "doesn't already have it" check — this directly
  answers Kevin's "make sure prerequisites are enforced" ask.

**What shipped:**
- **13 new `FEATS` entries** (`data/feats.ts`), each with a real SRD
  category/prerequisite/mechanic. Mechanically active: Magic Initiate,
  Savage Attacker, Grappler, Archery, Defense, Great Weapon Fighting, Boon
  of Combat Prowess, Boon of Fate, Boon of Irresistible Offense (partially —
  its damage-resistance-ignoring half is inert, no resistance system
  exists), Boon of Spell Recall. Honestly inert, each with a real logged
  reason: Skilled (no skill-proficiency system), Two-Weapon Fighting (no
  dual-wielding system), Boon of Dimensional Travel/the Night Spirit/
  Truesight (no reposition-after-acting/lighting/invisibility-detection
  system).
- **Grappler's restrain-on-hit** (`BattleScene.applyGrapplerRestrain`) —
  once per hero turn, a landed basic-attack hit rolls a save (mirroring the
  Topple weapon mastery's exact save-then-`applyStatus` shape) and applies
  the EXISTING `"restrained"` status on failure; while restrained, this
  hero's own attacks against the same enemy roll with Advantage.
- **Boon of Combat Prowess's miss-to-hit** — once per hero turn, a missed
  first attack roll converts into a hit (mutating an already-resolved
  `AttackResult`, the same pattern the Graze/Topple masteries already use).
- **Boon of Fate's once-per-rest flat attack bonus**, auto-applied to a
  hero's next basic attack — same "spent on the first roll, no interrupt-
  prompt UI" precedent Lucky/Vex/Bardic Inspiration already established.
- **Boon of Spell Recall's 1d4-vs-slot-level roll** — a new
  `RandomService.rollD4()`, rolled by `BattleScene` (not `Hero` — this
  project's "controlled randomness flows through a service" rule keeps
  dice rolls on the caller side, not inside a pure entity) and only when the
  hero actually holds the boon, so no other spell cast's RNG sequence
  shifts.
- **The ASI-or-feat overlay gained two new follow-up steps**
  (`BattleScene.beginFeatGrant`/`continueFeatGrant`), reusing the EXISTING
  `renderAsiPrompt` helper with zero new overlay component: an ability
  picker for any feat with an `abilityScoreBoost` (Grappler, every Epic
  Boon), and a spell-list picker for Magic Initiate (Cleric/Druid/Wizard,
  excluding lists already taken — it's the one repeatable feat in this
  list).
- Tests: 744 → **778** (+34: new prerequisite/mechanic coverage in
  `tests/classLeveling.test.ts`, expanded `tests/feats.test.ts` with
  per-feat category/prerequisite/mechanicallyActive assertions, matching
  the existing per-feat-named-assertion style). Typecheck, all tests, and
  the production build all pass.
- **Not yet confirmed by a human in a browser** — same standing caveat as
  every other unplayed phase. See **KI-066** in `KNOWN_ISSUES.md`.

### D-110 — Phase 19: real dual-wielding, unlocking Two-Weapon Fighting AND Nick together

Kevin pushed back on Two-Weapon Fighting being left inert, in his own
words: "2 weapon fighting seems like it could be and should be
implemented." Investigating what that actually requires surfaced that its
real SRD prerequisite — a base "attack with a Light melee weapon in each
hand, bonus-action off-hand attack" mechanic — didn't exist at all (this
game had exactly one `"weapon"` gear slot). Kevin was asked directly
whether to also fix Nick (the weapon mastery left inert since Phase 17,
D-108, for the IDENTICAL "no dual-wielding system" reason — its real SRD
trigger is literally this same off-hand attack) while building the
underlying system anyway. Kevin chose yes — same root cause, same session.

**Design chosen**: rather than add a new gear slot type, a Light melee
weapon may now occupy the EXISTING `"shield"` slot as an off-hand weapon —
a Shield and an off-hand weapon are mutually exclusive in the SRD anyway
(both occupy the same hand), so this is a faithful reuse, not a hack.
`BattleScene.targetGearSlot` fills the empty `"weapon"` slot first, then
falls back to `"shield"`, mirroring the exact "first empty slot, else
replace the first" rule ring1/ring2 already established (Phase 11.5,
D-078) — no new slot-targeting UI needed. One new equip-time guard
(`equipGearOnHero`) rejects the one case that fallback can't safely
resolve: trying to equip a second Light weapon while the off-hand already
holds a REAL Shield (rather than silently displacing the main-hand
weapon instead) — same "reject before gold changes hands" shape as the
existing attunement/Two-Handed-grip gates.

**What shipped:**
- **`Hero.offHandWeapon`/`isDualWieldingLightWeapons`** — true only when
  BOTH the main and off-hand weapon are Light AND the main hand's is
  melee (the SRD's real prerequisite for the base two-weapon-fighting
  rule, independent of whether this hero has the Two-Weapon Fighting
  feat).
- **`Hero.canUseOffHandAttack`/`useOffHandAttack`** — once per hero turn,
  after the main Attack action, dual-wielding grants one off-hand attack;
  it costs the bonus action UNLESS either equipped weapon carries Nick, in
  which case it's free (Nick's real SRD effect, now genuinely mechanical).
- **`Hero.offHandAttackDamage`** — the SRD's real rule: an off-hand attack
  skips this hero's ability modifier UNLESS it has the Two-Weapon Fighting
  feat, which adds it back in.
- **`BattleScene.tryOffHandAttack`**, called right after the main-hand
  swing(s) resolve in `tryBasicAttack` — a deliberately simple resolution
  (attack roll + damage only, no weapon-mastery/proc cascade), matching the
  same "keep a bonus/secondary attack simple" precedent the Cleave
  mastery's own second attack already set.
- **Two-Weapon Fighting flipped `mechanicallyActive: true`** (`data/feats.ts`).
- **Nick flipped `mechanicallyActive: true`** (`data/weapons.ts`) — its
  `NICK_INERT_REASON` export removed (no longer applicable); its real
  mechanic (off-hand attack rides the Attack action instead of the bonus
  action) is `Hero`'s own `nickGrantsFreeOffHandAttack`, checked against
  EITHER equipped weapon having this mastery.
- Tests: 778 → **789** (+11 in `tests/classLeveling.test.ts`; one stale
  assertion fixed in `tests/weaponsAndArmor.test.ts` — "all 8 masteries
  active" replacing "Nick is the one exception"). Typecheck, all tests,
  and the production build all pass.
- **Not yet confirmed by a human in a browser** — this closes out the
  Two-Weapon-Fighting/Nick items on **KI-065**'s and **KI-066**'s known-gap
  lists, but the new mechanic itself (equipping a second Light weapon into
  the off-hand, the off-hand attack actually firing in combat, Nick making
  it free) still needs Kevin's own playtest pass.

### D-111 — Phase 20: "tons of different enemies" — six new mechanics, twenty-one new enemies, a new "legendary" role tier

Kevin asked directly for a huge variety of enemies, "almost all" with at
least one thing that feels unique about them, and named several concrete
archetypes himself: siege units that destroy structures, a stealthy
assassin, pure runners, tanks, treasure-laden enemies, a summoner, a
captain/banner-lord that buffs different allies' stats differently, and
enemies with different attack types (ranged/melee/AoE/breath). He also
named a longer-term direction: the party eventually reaching level 20+,
and a possible "keep playing forever" mode needing extreme bosses.

Two scoping questions were asked before any code, both answered toward the
fuller option:
1. **Build every new mechanic as a real system this session**, rather than
   shipping only the cheap stat-variant enemies (tank/runner/treasure/AoE)
   and deferring the genuinely new systems (siege/structure-destruction,
   stealth, aura-buff, mid-battle reinforcements) to a later phase. Kevin
   chose the full build.
2. **Build a couple of extreme "epic" boss stat-blocks sized for a
   level-20+ party this session, but NOT an endless/infinite wave-generator
   mode.** An uncapped "keep playing forever" mode is a `FreePlayWaveGenerator`
   -level feature (an unrelated system, not an enemy), and stays a
   separately-scoped future item. Kevin chose epic bosses now, endless mode
   later.

**Six new mechanics, each reused by at least two roster entries so none of
them is a one-off special case** (all in `EnemyDefinition`/`WaveSystem`
unless noted):
- **Siege (`siegeDamageMultiplier`)** — a siege enemy that finds a
  destructible wall structure within its own attack range attacks THAT
  instead of a hero this phase, at `attackDamage * siegeDamageMultiplier`.
  Required a genuinely new capability structures never had: `StructureDefinition
  .maxHp`/`PlacedStructure.hp` (`data/structures.ts`) and
  `BuildSystem.damageStructure` — set only on the three wall-kind
  structures that make sense to besiege (Barricade 10 HP, Gate 8, Spectral
  Wall 6); traps/platforms stay indestructible (no `maxHp`). `WaveSystem`
  gained two new context callbacks, `wallHpAt`/`damageWall`, paired the
  same way `trapAt`/`trapStatusAt` already are.
- **Stealth (`stealth: true`)** — hidden from ALL hero-initiated targeting
  (`BattleScene.isEnemyTargetable`, applied at every click-to-attack/
  ability-aim/spellbook-aim site and the AI's own candidate list) until its
  first strike, which lands with Advantage (the ambush) and permanently
  reveals it (`Enemy.isRevealed`/`.reveal()`, a new field on `Enemy` and
  `EnemySnapshot`). A still-hidden token renders at low opacity with a "?"
  label and no visible HP (`BattleScene.applyStealthVisual`) — a deliberate
  middle ground between a full normal token (spoils the ambush) and a
  fully invisible one (makes the tile unreadable).
- **Aura buff (`auraBuff`)** — a captain/banner enemy buffs every OTHER
  living enemy within `radiusTiles` (never itself) on `attackBonus`/
  `damageBonus`/`movementBonus`, recomputed fresh every phase by
  `WaveSystem.auraBonusFor` — never a persisted status, so it stops the
  instant the source dies or a target steps out of range. Three separate
  captains (Warcaptain/Battlepriest/Bannerbearer) each buff a DIFFERENT one
  of the three stats, per Kevin's own "different kinds buff different
  stats" ask. Gets a real on-board visual (a translucent ring sized to its
  radius, `BattleScene.enemyAuraRings`) so the effect reads as something
  actually happening rather than a silent stat change.
- **Reinforcements (`callsReinforcements`)** — every `intervalTurns` enemy
  phases, spawns `count` more of another enemy id on a free tile adjacent
  to itself (`WaveSystem.trySpawnReinforcements`, a new per-instance cooldown
  map). Deliberately named/coded completely separately from the pre-existing
  hero-ally `SummonSystem`/`Summon` (Phase 16) — an enemy calling in more
  enemies shares no code with a hero casting an ally; conflating the two
  names would have been confusing forever after. A freshly-arrived
  reinforcement gets its OWN turn later in the same phase it spawns (an
  accepted, documented consequence of appending to the array WaveSystem is
  still iterating, not a bug) — reinforcements feel like they arrive ready
  to fight, matching Cultist Caller/Bone Summoner's flavour.
- **Treasure (`treasureBonusGold`)** — extra gold on top of `rewardGold`
  when the PARTY defeats the enemy (never a breach — breaching enemies
  never reach `RewardSystem.killGold`, which is where the bonus is summed
  in, and it's what a bonus loot ROLL would need too, so equipment-drop
  loot stays out of scope this pass, just gold).
- **AoE/breath (`aoeAttack`)** — hits every hero within `attackRangeTiles`
  at once (`CombatSystem.attackArea`) instead of picking one via
  `chooseTarget`. Combined with `savingThrowAttackDC` (reusing 13.10's
  save-based-attack mechanic), it becomes a save-or-take-damage cone,
  rolled once per hero in range — the "spell"/"breath weapon" flavour
  Kevin asked for, built entirely from two mechanics that already existed
  plus a loop, no third new system needed.
- **Pure runners (`ignoresHeroes: true`)** — never attacks a hero, even one
  standing right next to it; always tries to advance. The only real
  counter is route manipulation (walls/traps), not combat — exactly
  Kevin's own "just try to get to the end as quick as possible" framing.

**Tanks** got no new field at all — Ironhide is a flat, deliberate stat
variant (high HP/AC, ordinary everything else), matching every earlier
"tank" in this roster's history (Brute, Warden, Basalt Colossus) and
Kevin's own framing ("some can be just basic attack type monsters").

**Twenty-one new enemies** (`data/enemies.ts`): sixteen minions (two per
mechanic — Siegebreaker/Battering Brute, Shadowfang/Nightblade, Sprinter/
Bolt Runner, Hoarder/Gilded Carrier, Cultist Caller/Bone Summoner,
Warcaptain/Battlepriest/Bannerbearer, Cave Drake/Frost Warden, plus the
tank Ironhide), one new miniboss (Juggernaut, a tank+siege hybrid), two new
true bosses (Warlord Korrath — a bigger aura; The Devourer — reinforcements
plus a big treasure bonus), and two new **`role: "legendary"`** capstones
sized for a level-20+ party (Ashen Sovereign — breath + aura + siege;
The Hollow Empress — breath+save + reinforcements + the roster's largest
treasure bonus). `EnemyRole` gains `"legendary"`, a tier above `"boss"`;
`BattleScene.isBossRole`/`bossBannerSuffix` and `BestiaryScene`'s role
grouping both updated (the latter was a REAL bug caught while building this:
without its own group, a `"legendary"` enemy would silently vanish from the
Bestiary, matching none of the three existing buckets).

**Free Play integration** (avoiding dead scaffolding): all sixteen new
minions join `EXPANDED_MINIONS`; the new miniboss/boss/legendary tier joins
`BOSS_OPTIONS` (all `unlockCampaignId: null` — none has a campaign of its
own yet, same staging every prior miniboss/boss got before Phase 11.8).
`FreePlayScene.buildOptionRow`'s width-computation (already dynamic since
Phase 13.10, specifically so the row "can't overflow GAME_WIDTH as the
roster grows further") now renders 10 boss buttons instead of 5 — expected
to look cramped and worth a look in the eventual in-browser pass, but not
a correctness bug.

- Tests: 802 → **813** (+11 new `tests/enemyMechanics.test.ts` covering all
  six mechanics behaviourally through `WaveSystem.tickEnemyPhase`, plus new
  roster/data checks in `tests/enemyRoster.test.ts`, a `BuildSystem
  .damageStructure` suite in `tests/building.test.ts`, a `treasureBonusGold`
  case in `tests/rewards.test.ts`, and updated boss/miniboss counts in
  `tests/campaign.test.ts`). Typecheck, all tests, and the production build
  all pass (101 modules, unchanged — no new files). `npm run dev` serves
  HTTP 200.
- **Not yet confirmed by a human in a browser** — see **KI-068**.

### D-112 — Phase 21: a second wave of enemy archetypes — hero-side status effects, 12 more mechanics, 24 new enemies

Immediately after Phase 20 (D-111) shipped, Kevin brainstormed a second wave
of archetypes with the agent in the same session and confirmed a specific
set, plus asked for prep so a NEW chat could go straight into building — that
prep landed in `PHASE_HANDOFF.md`'s "Phase 21 candidate" section. This
session (a fresh chat) read that section and, before writing any code, asked
Kevin the two flagged open questions plus a third framing question, all
answered toward the fuller/faster option:

1. **Build Phase 21 now, rather than pause for the overdue in-browser
   feel/balance pass covering Phase 17-20.** Kevin chose to keep building —
   this is now FIVE consecutive content/mechanics phases shipped without a
   human playtest (KI-065 through KI-068, now joined by KI-069).
2. **The hero-side status-effect system (the batch's shared prerequisite)
   should be a FULL generic system** — any status usable on either side
   (hero or enemy) — rather than narrowly scoped to just what the
   Healer/Debuffer hybrid and Anti-caster need (poison + silence). Kevin
   chose the fuller option, consistent with his established pattern on every
   prior scope fork this project has offered him.
3. **Swarm's real SRD 5.2.1/2024 rules should be verified FIRST**, before any
   other archetype in the batch, per this project's own "verify against the
   actual document, don't assume" policy (the reason that policy exists —
   the Phase 14.1/D-098 mistake — is itself documented in
   `CONTENT_SOURCES.md`). Verified against two independent sources (a search
   snippet quoting the real trait text, and a second site's direct SRD stat-
   block quote) before any other Phase 21 code was written.

**The hero-side status-effect system** (`Hero.activeStatuses`, mirroring
`Enemy.activeStatuses` field-for-field, reusing the EXACT SAME
`StatusEffectId`/`StatusEffectDefinition` shape from `data/statusEffects.ts`
rather than a parallel hero-only one):
- `Hero.applyStatus`/`hasStatus`/`tickStatuses`/`statuses` — identical shape
  to `Enemy`'s own methods. `tickStatuses()` is called from
  `resetForNewTurn()`, the same cadence `tickBuffs()` already used.
- **Every existing `StatusEffectDefinition` field is now ALSO consumed on
  the hero side**, not just newly-added ones: `armorClassDelta` folds into
  `Hero.armorClass` (mirrors `buffTotal`'s existing pattern);
  `movementReduction` folds into a new `Hero.effectiveMovementTiles`,
  read by `movementBudget()`; `attackRollDisadvantage` is exposed via a new
  `Hero.attacksWithDisadvantage` getter, folded into
  `BattleScene.attackProfileFor`; `preventsAction` is exposed via a new
  private `isIncapacitatedByStatus` getter, folded directly into
  `Hero.canMove()`/`canAct()` — the SAME chokepoint the AI turn loop and
  every click-handler guard already gate on, so a stunned/restrained hero is
  blocked everywhere for free, no new call sites needed anywhere in
  `BattleScene`. `damagePerTurn` is exposed via a new
  `Hero.tickStatusDamage()` method, called once per player phase
  (`BattleScene.onPhaseChange`'s `"player"` case) — mirrors `WaveSystem`'s
  burning tick, just with the entity computing the damage and the scene
  logging it. The one exception: `redirectsAttackToAllies` ("charmed") stays
  enemy-only — heroes have no "attack an ally instead" AI concept to
  redirect into.
- **One new status, `"silenced"`** (`preventsCasting: true`) — the Anti-
  caster's Silence/Anti-Magic-Field stand-in. Gates `BattleScene
  .onAbilityButton()` (blocks opening the spellbook/using a class ability;
  does NOT block moving or a basic Attack — a real, narrower gate than
  `preventsAction`).
- **A hero can now die mid-PLAYER-phase for the first time** — a poison tick
  or a Reflector's counter-damage (see below) can defeat the last hero
  outside the enemy phase this project's D-068 party-wipe check was written
  to assume. Both new paths get their own explicit, deferred defeat check
  (`BattleScene`'s `"player"` phase-change case and `afterHeroDamage()`
  respectively) rather than leaving the game in limbo until the next enemy
  phase resolves.
- **A hero's on-token status badge** (`heroStatusBadges`, created alongside
  every hero token) mirrors `enemyStatusBadges`'/`updateStatusBadge`'s exact
  shape, refreshed from `syncHeroTokens()`.

**Twelve more new mechanics** (all in `EnemyDefinition`/`Enemy`/`WaveSystem`/
`BattleScene` unless noted):
- **Berserker (`enrage`)** — a flat attack/damage bonus per `stepPercent`-
  sized band of HP already lost, recomputed fresh each phase
  (`WaveSystem.enrageBonusFor`, the same "live, not stored" shape
  `auraBonusFor` already established for captains).
- **Lifedrinker (`lifedrinkPercent`)** — heals itself for a % of the damage
  it lands on a hero (`WaveSystem.applyOnHitHeroEffects`), capped at its own
  `maxHealth`; a no-op for a Swarm (see below).
- **Splitter/Carrier (`onDeathSpawns`)** — the instant a defeated enemy (ANY
  cause: hero attack, trap, burn/poison tick) is removed, spawns weaker
  copies of another enemy id adjacent to where it died
  (`WaveSystem.resolveDeathTriggers`/`trySpawnAt`) — a genuinely NEW
  call, deliberately separate from `tickEnemyPhase` itself, since a hero's
  own attack (resolved in `BattleScene`, not `WaveSystem`) can trigger a
  death just as easily as an enemy-phase cause. `BattleScene.resolveDeaths`
  is the new single funnel every one of `removeDefeated()`'s 3 call sites
  now goes through, so a death trigger fires no matter which phase or
  source caused the kill. Carrier ("The Husk") reuses the identical field,
  tuned as a piñata (very high HP, minimal attack, spawns MORE copies) —
  Kevin's own recommended reuse rather than a second field.
- **Explosive (`onDeathExplode`)** — the same death-trigger funnel, a flat-
  damage AoE burst (`CombatSystem.attackArea`, `autoHit`) centered on the
  dead enemy's last tile.
- **Shielded (`damageShieldHp`)** — a flat damage-absorbing ward. Required a
  genuinely new `Combatant` capability: an optional
  `absorbDamage?(amount): number` hook, called by `CombatSystem.applyAttack`
  before mutating `health` — generic across Hero AND Enemy, though only
  `Enemy` implements it today. **Aegis Bearer is the Shielded/Reflector
  combo** Kevin asked for ("some shielded enemies could ALSO reflect") —
  one roster entry carrying both fields, not a separate family.
- **Reflector (`reflectsDamagePercent`)** — while the shield still holds
  (`shieldHpRemaining > 0`), reflects a % of a landed melee hit's actual HP
  damage back at the attacking hero (`BattleScene.applyReflectorDamage`, a
  new step in `tryBasicAttack`'s ordered post-hit chain, right after
  `applyWeaponMastery`).
- **Gold Thief (`goldTheftAmount`)** — a landed attack also steals gold.
  `WaveSystem` has no `EconomySystem` access, so this resolves as a
  `BattleScene`-layer post-process over `report.attacks` (a new loop in
  `runEnemyPhase`'s delayed-render block), calling a new
  `EconomySystem.deduct(amount)` — deliberately NOT gated by `canAfford`
  like `spend` (a theft still "lands" even against an empty purse; there's
  simply nothing left to take).
- **Teleporter (`teleportsEveryNTurns`)** — every N phases, jumps straight
  toward the nearest exit via `pathfinding.routeToNearestGoal({ignoreWalls:
  true})`, ignoring the normal movement-tile limit for that one jump
  (`WaveSystem.tryTeleport`), on its own per-instance cooldown map (same
  "not part of `WaveStateSnapshot`" precedent as `reinforcementCooldowns`).
- **Mimic (`mimicDisguise`)** — disguised as scenery/treasure, untargetable
  (`BattleScene.isEnemyTargetable` extended) until a hero moves adjacent to
  it, which reveals it permanently. Reuses `Enemy.isRevealed`/`.reveal()` —
  the SAME boolean primitive `stealth` already uses — but on a DIFFERENT
  trigger (proximity, checked at the top of `tickEnemyPhase`, before
  anything else) and a DIFFERENT render (`BattleScene.applyStealthVisual`
  extended: disguised scenery, not a dim "?" token). Kevin explicitly asked
  to keep the two mechanics conceptually separate despite this one shared
  boolean — the trigger and the visual never get generalized into one path.
- **Healer (`healAura`)** — the `auraBuff` shape (Phase 20), healing instead
  of buffing a stat: heals every OTHER living, wounded enemy within
  `radiusTiles` by a flat amount, resolved ONCE per phase in a dedicated
  pass at the top of `tickEnemyPhase` (before the main per-enemy loop, since
  it mutates OTHER enemies' health rather than just computing a query like
  `auraBonusFor` does). **Plague Warden is the Healer/Debuffer hybrid**
  Kevin asked for ("I think the healer and debuffer could be combined") —
  `healAura` PLUS `inflictsStatusOnHit: poisoned` on one roster entry.
- **Anti-caster (`inflictsStatusOnHit`)** — Kevin's own simplification: no
  suppression system on the enemy side at all, just a landed hit applying
  the new "silenced" status to the hero it hit — the generic mechanism
  every enemy attack can now use (see `Combatant.applyStatus?`, an optional
  method both `Hero.applyStatus` and `Enemy.applyStatus` satisfy
  structurally, called from `WaveSystem.applyOnHitHeroEffects` after a
  landed single-target hit).
- **Multi-Phase Boss (`phaseChange`)** — once an enemy's HP drops to
  `hpPercent` of its BASE `maxHealth`, `overrides` (a curated
  `Partial<Pick<EnemyDefinition, ...>>`, not a full `Partial`) permanently
  replaces `attackDamage`/`attackBonus`/`armorClass`/`movementTiles`/
  `aoeAttack`/`callsReinforcements`/`savingThrowAttackDC` for that INSTANCE
  only. Required the genuinely new architecture piece the Phase 20 handoff
  flagged: a new `Enemy.activeDef` getter merges `def` with a private
  per-instance `phaseOverride` field (never mutating the shared `def`
  object every instance of that enemy TYPE references) — every behavior-
  affecting `Enemy` getter (`armorClass`/`attackBonus`/`attackDamage`/
  `movementTiles`/`attackRangeTiles`) now reads through `activeDef` instead
  of `def` directly, so the override needs ZERO other call-site changes
  anywhere in `WaveSystem`/`BattleScene` beyond the handful of direct
  `enemy.def.X` reads inside `tickEnemyPhase` itself
  (`aoeAttack`/`callsReinforcements`/`savingThrowAttackDC`).
- **Swarm (`swarm`)** — verified against the real SRD 5.2.1/2024 "Swarm"
  trait (two independent sources; see the scope-fork note above). Modeled:
  can occupy another living, non-swarm enemy's tile and vice versa (both
  `isOccupiedByAnyEnemy`/`isOccupiedByOtherEnemy` are now swarm-aware — a
  swarm mover is never blocked by anything, and a swarm occupant never
  blocks anything else); immune to a fixed condition set mapped onto this
  game's real status ids (charmed/restrained/stunned/toppled —
  `Enemy.applyStatus` silently no-ops one of these against a swarm); deals
  half damage once Bloodied (`Enemy.attackDamage`, half HP or fewer). NOT
  modeled: the real bludgeoning/piercing/slashing damage RESISTANCE — this
  game has no damage-type-aware resistance system for any attack to hook
  into (same category of documented gap as Boon of Irresistible Offense's
  own damage-resistance half).

**Twenty-four new enemies** (`data/enemies.ts`): 21 new minions (Frenzied
Cultist/Bloodwisp/Crimson Leech/Living Splinter/Ooze Splitter/Fungal
Splitter/Warded Sentinel/Aegis Bearer/Cinder Wretch/Bomber Beetle/Pilferer/
Coin Wraith/Blink Stalker/Rift Walker/Mimic Chest/Ambush Coffer/Battle Medic/
Plague Warden/Hexbinder/Rat Swarm/Locust Swarm — Living Splinter is the
Splitter/Carrier family's shared, deliberately plain fodder, no mechanic of
its own, same "flat stat variant" exception Ironhide got in Phase 20), 2 new
minibosses (Bloodrage Warlord — a bigger Berserker; The Husk — the
Carrier/Vessel), and 1 new true boss (Sundered King — the Multi-Phase Boss).
All ORIGINAL content, no D&D/SRD-derived names or lore, EXCEPT Swarm's own
verified mechanical rules (see `CONTENT_SOURCES.md`'s new Phase 21 row).
**Free Play integration**: all 21 new minions join `EXPANDED_MINIONS`; the 3
new miniboss/boss entries join `BOSS_OPTIONS` (`unlockCampaignId: null`,
same staging every prior miniboss/boss got before it had a campaign of its
own) — the boss-picker row now renders 13 buttons, up from 10.

- Tests: 813 → **864** (+51: new `tests/enemyMechanicsPhase21.test.ts` [25],
  new `tests/heroStatusEffects.test.ts` [15], a new `EconomySystem.deduct`
  suite in `tests/economy.test.ts` [+4], a new Phase 21 section in
  `tests/enemyRoster.test.ts` [+7], and updated boss/miniboss counts in
  `tests/campaign.test.ts`/`tests/enemyRoster.test.ts`). Typecheck, all
  tests, and the production build all pass (101 modules, unchanged — no new
  source files). `npm run dev` serves HTTP 200.
- **Not yet confirmed by a human in a browser** — see **KI-069**.

### D-113 — Phase 22: magic-item expansion — a real SRD magic-item catalog, a `+1/+2/+3` enchant overlay, a brand-new loot-drop system, and a level-scaled shop

Kevin asked for "a more complete repertoire of items" — potions, `+1/+2/+3`
weapon/armor/shield modifications, "lots of free access magic items" (with a
research pass to check what's actually usable before inventing anything),
and the Cape of Billowing "because I think that would be a fun item that has
its own animation." He also asked for a loot system: enemy drop odds scaled
by tier, an occasional one-tier-up lucky drop, most enemies dropping
nothing, campaign loot curated as part of that campaign's balance, Free Play
staying random, and a shop that also sells magic items gated by average
party level — explicitly inviting suggestions on the loot system's design.
Before any code, three genuine architecture forks were surfaced and all
three were answered toward the more real/complete option:

1. **The `+1/+2/+3` enchant model**: a real modifier OVERLAY on a mundane
   weapon/armor/shield (a `${baseId}+${level}` composite id, synthesized on
   demand) rather than a ~150-entry flat cross-product catalog. Bigger
   one-time architecture cost, but it's what a loot-ROLLING system should
   generate, and any future weapon/armor is enchantable for free.
2. **The Cape of Billowing's flowing-cape visual**: a real, new Phaser
   `Graphics`-based tween/flutter effect (the same category of work as
   Phase 20's aura ring, which also needed no new art assets) rather than
   data-only this pass.
3. **Pacing**: keep building now, same pattern as every prior big batch,
   rather than pause for the increasingly-overdue in-browser feel/balance
   pass covering Phase 17-21 (KI-065 through KI-069, now six phases deep).

**Research, not assumption** (this project's own "verify against the actual
document" policy): a dedicated pass confirmed the real SRD 5.1 magic-item
list (CC BY 4.0/OGL 1.0a) is large — hundreds of named items across
weapons/armor/shields at `+1/+2/+3`, potions, rings, cloaks, boots, bracers,
rods, staffs, and wands. It also confirmed "Cape of Billowing" is NOT SRD
content — the real published item this evokes, "Cloak of Billowing," is
Xanathar's Guide to Everything, not the free document — so it's built as
ORIGINAL content instead, the same correction-precedent treatment
Tough/Lucky/Athlete already got (D-109).

**The enchant overlay (`data/equipment.ts`)**: `EnchantLevel` (1/2/3),
`enchantedItemId`/`parseEnchantedItemId`, and `getEquipmentDefinition`
extended to synthesize a composite item's `EquipmentDefinition` on demand
from its base item — only a `rarity: "common"` weapon, shield, or REAL-armor
chest item is enchantable (matches the real SRD rule: mundane gear made
magical, not an already-magic named item made MORE magical), and a `+N`
item does NOT require attunement (also the real rule). Real armor folds the
bonus straight into its own `baseAC` (zero `Hero.ts` change needed); a
shield's bonus is a bigger flat `armorClass` (already summed generically);
a weapon's bonus needed two small, genuinely new `Hero.ts` getters
(`weaponEnchantBonus`, applied to both `effectiveAttackBonus` AND
`effectiveAttackDamage`) since weapon damage comes from a dice-average
calculation, not a flat field.

**A new gear slot, `"back"`** (cloaks/capes) — the tenth slot instance,
ninth slot type. Existing items (Traveler's Cloak, still in `"legs"`) were
deliberately NOT migrated — no save-compatibility risk, matches "preserve
working systems."

**Five new `EquipmentDefinition` fields**, each reused by 2+ new items so
none is a one-off: `savingThrowBonus` (Ring/Cloak of Protection, Robe of the
Archmagi), `movementBonusTiles` (Boots of Striding and Springing/Speed),
`grantsStatusImmunity` (Ring of Free Action, Periapt of Proof against
Poison — checked once, at the top of `Hero.applyStatus`), `rangedAttackBonus`/
`rangedAttackDamage` (Bracers of Archery, conditional on a ranged weapon
equipped, mirroring the Archery feat's own shape), and `visualEffect`
(currently just `"flowingCape"`, Cape of Billowing).

**`data/magicItems.ts`** (new file, merged into `EQUIPMENT_DEFINITIONS`/
`EQUIPMENT_ORDER` exactly like `weapons.ts`/`armor.ts` already are): 14 real
SRD-sourced free-access magic items (Ring/Cloak of Protection, Bracers of
Defense, Stone of Good Luck, Ring of Resistance, Ring of Free Action,
Periapt of Proof against Poison, Boots of Striding and Springing, Boots of
Speed, Bracers of Archery, Robe of the Archmagi, Flame Tongue, Frost Brand,
Dagger of Venom) plus the original Cape of Billowing — 15 total. Every item
reuses an EXISTING mechanical hook (a flat bonus, one of the four
`EquipmentProc` kinds Phase 13.9/D-094 already built) or one of the five new
fields above — no ability-score-setting items, no charge-based active items
(wands/rods/staffs), no new damage-type/creature-type system. The three
named weapons (Flame Tongue/Frost Brand/Dagger of Venom) reuse an existing
mundane weapon's real `WeaponData` as their base stats, with a `proc`
layered on top — the one shape a flat `+N` enchant can't express.

**`data/potions.ts`**: a new `rarity` field (retro-tagging the original two
`common`, Phase 13.9's own precedent), and eight new SRD-sourced potions
across three new effect kinds — `movementBuff` (Potion of Speed,
`Hero.grantHaste`, permanent for the rest of the battle like `attackBuff`
already is), `resistanceBuff` (Potion of Resistance, `Hero.grantResistance`
— reuses the EXACT `hasDamageResistance` halving Rage/Wild Shape already
grant, a new `permanentDamageResistance` flag that, unlike Rage's own timer,
a rest never clears), and `cureAndHeal` (Restorative Ointment,
`Hero.cureAllStatuses` + a heal). `isRaging`/`canUseRage`/`canUseWildShape`
were deliberately changed to check `damageResistanceTurnsRemaining` directly
instead of the now-broader `hasDamageResistance`, so a Resistance potion can
never falsely block or imply an active Rage.

**`systems/LootSystem.ts`** (new, pure, tested) — the whole loot-drop
design, kept deliberately simple: drop chance by `EnemyRole` (minion 12%,
miniboss 55%, boss 90%, legendary 100%), a base rarity by role (minion→
common, miniboss→uncommon, boss→rare, legendary→veryRare), a flat 12% chance
to bump one tier higher (the "occasional lucky drop from a lesser enemy"
Kevin asked for, capped at legendary), then either a random NAMED catalog
item at that rarity or — for uncommon/rare/veryRare — a coin-flip chance to
instead generate a random enchant-eligible mundane weapon/armor/shield at
the matching enchant level via the overlay above. Two new `RandomService`
methods (`rollPercent`/`rollIndex`) back every roll, `fixed()`-testable like
every existing dice method.

**Campaign-curated vs. Free-Play-random is one parameter, not two code
paths**: `CampaignDefinition` gains an optional `lootPoolIds` (Emberford
Reach and Saltmere Shallows each get a themed subset — fire/aggressive vs.
water/defensive, every potion included since potions aren't thematic);
passed to `rollLootDrop`'s `restrictToIds`, which falls back to the FULL
pool if a restriction would strand a rarity tier with nothing in it. The
classic 10-wave campaign and Free Play both pass nothing — "more or less
random," Kevin's own framing, needs no special-casing.

**Where a drop actually lands**: no inventory/browsing UI exists this pass
(a real, deliberate scope boundary, not an oversight — see KI-070).
`BattleScene.grantLootDrop` auto-equips a drop into the first LIVING hero
with a matching empty slot (skipping a hero for whom it would exceed the
attunement cap or conflict with its current grip, the same gates the shop's
own equip flow already enforces), or auto-sells it for its listed gold cost
if no hero can currently take it.

**The shop's level gate (`systems/ShopSystem.ts`, new, pure, tested)**:
`averagePartyLevel`/`isRarityUnlockedAtLevel` — common/uncommon items stay
visible at every level (zero regression for a fresh level-1 party); rare
needs average level 4+, veryRare 8+, legendary 13+. Applied uniformly to
EVERY rare-and-up item, including Phase 13.9's original five — a real,
intentional behavior change for those (previously always purchasable),
matching Kevin's own general ask rather than special-casing only the new
items. The classic fixed roster (no `classLevel` growth) averages to level
1 forever, so it only ever sees the always-unlocked tier.

**The flowing-cape visual (`BattleScene`)**: this scene's first use of
Phaser's per-frame `update()` lifecycle hook (rather than hooking every
hero-movement call site individually — there are several) redraws a
`Graphics`-based wavy shape trailing each capped hero's CURRENT token
position, animated with a `Math.sin`-based flutter. `ensureHeroCape` creates
or destroys the graphic based on whether a `visualEffect: "flowingCape"`
item is equipped anywhere, called after every equip/unequip and at hero
creation; hero death destroys it.

- Tests: 864 → **900** (+36: new `tests/lootSystem.test.ts` [10], new
  `tests/shopSystem.test.ts` [6], a new Phase 22 section in
  `tests/equipment.test.ts` [+10], a new Phase 22 section in
  `tests/potions.test.ts` [+4], new `rollPercent`/`rollIndex` coverage in
  `tests/randomService.test.ts` [+5], a new `lootPoolIds` check in
  `tests/campaigns.test.ts` [+1], and one existing `tests/equipment.test.ts`
  assertion corrected — see below). Typecheck, all tests, and the production
  build all pass (104 modules, up from 101 — three new files:
  `data/magicItems.ts`, `systems/LootSystem.ts`, `systems/ShopSystem.ts`).
  `npm run dev` serves HTTP 200.
- **A real, pre-existing test invariant corrected, not just extended**:
  Phase 13.9's `equipment.test.ts` asserted "only rare-and-up items require
  attunement" — true of ITS OWN five items by choice, never an SRD rule.
  Several of this phase's real SRD-sourced items (Cloak of Protection,
  Boots of Striding and Springing, etc.) genuinely require attunement at
  `uncommon`, per the actual rules. Corrected to the invariant that DOES
  hold universally: no `common` item ever requires attunement.
- **Not built this pass, and why** — see KI-070 for the full list: any
  "found but not equipped" loot inventory/browsing UI (auto-equip-or-sell
  is the whole mechanism); ability-score-setting magic items (Amulet of
  Health, Gauntlets of Ogre Power, Headband of Intellect, Belt of
  Dwarvenkind/Giant Strength) — this game's derived combat stats bake an
  ability modifier in at several different points, not always read live,
  making a live-override hook a real, separately-sized risk; any
  charge-based active item (wands/rods/staffs) — no "limited uses,
  independent of a class's own resource pools" item mechanic exists yet;
  Cloak of Displacement (would need a new "attacks against the wearer have
  disadvantage" hook); Ioun Stones (several grant a flat max-HP bonus,
  which would violate `Hero.effectiveMaxHealth`'s own documented "equipment
  does not affect max HP" invariant).

## Carried forward from the Source of Truth (not re-decided here)

- **LOCKED:** "Stronghold Integrity" is the shared loss resource; "Breach Damage"
  is what escaping enemies remove from it; "Tile" is the logical distance unit.
- **LOCKED:** Local single-player core loop before any Firebase or multiplayer.
- **OPEN:** Final game title must be original with no D&D branding (working title
  "Fantasy Tower Defense" is temporary).
- **OPEN items resolved:** "Hero collision" — living heroes block enemy routes
  (D-033). "Dice visibility" — deterministic for the MVP/vertical slice (D-030);
  **superseded by D-086 (Phase 13.1)**, which brings real d20 attack rolls
  back into combat at Kevin's explicit request. "Final party size" — four
  heroes for the vertical slice (D-052). "Level cadence" — a DEFAULT of
  every 2 waves (D-056), open to retuning after Kevin's in-browser feel
  pass; as of **D-089 (Phase 13.3)** this same cadence also drives a
  D&D-built party's REAL per-class leveling, not just the classic roster's
  flat Vigor/Might choice.
- Still OPEN: multiclassing (not part of Phase 13's scope). Structure
  destruction is PARTIALLY resolved — see D-111 (Phase 20): a siege enemy
  can now destroy a wall in its own attack range; an ordinary enemy still
  always routes around one, unchanged. Initiative shipped in 13.5 (D-090)
  as a framework-only
  `InitiativeSystem` — built and tested, but not called anywhere in
  `BattleScene` (D-086's own scope for it). A rest system (D-086) shipped in
  13.4 (D-088).
