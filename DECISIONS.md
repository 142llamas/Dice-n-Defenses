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

### D-114 — Phase 23: expanded maps and terrains — a "pit" hazard, hero-affecting terrain, mid-battle dynamic terrain, four new maps

Kevin asked for "expanded maps and terrains," explicitly inviting design
judgment ("I haven't had a lot of time to really think about this... use
the principles of good map design and game design"), with one steer:
engaging/dynamic but "easy to learn, hard to master," not overbearing.
Before any code, a research pass mapped the current system (Phase 11.7/
D-071's `TileType` union, the Phase 11.10/D-085 Map Builder, and the two
existing "showcase" maps) and found the real gap: only 3 built-in maps
exist, and Emberford/Saltmere are the SAME 16x9 skeleton with hazard tiles
swapped — almost no actual geometric variety. Terrain has been enemy-only
since D-081 (a deliberate boundary), and the Source of Truth's own §2.3
lists "holes" as a carried-forward vision concept never built. Three
genuine scope forks were surfaced and confirmed, all toward the fuller
option:

1. **Hero-affecting terrain**: extend hazards to heroes too (not just
   enemies), but as a new PER-MAP opt-in flag (`hazardsAffectHeroes`)
   rather than retrofitting the existing enemy-only rule everywhere — so
   Emberford/Saltmere's already-shipped, already-unverified balance doesn't
   silently change; only the four brand-new maps below turn it on.
2. **Terrain depth**: build the long-planned "pit" hazard AND a real
   mid-battle dynamic-terrain system (a rising tide, a collapsing bridge),
   not just more static hazard types.
3. **Map size**: stay within the Map Builder's existing 6-20 col / 6-9 row
   ceiling — a real fixed-canvas/HUD constraint from D-085's own bounding-box
   math, not a guess — so this pass is pure content/systems risk, not also
   a rendering-architecture risk.

**The "pit" tile** (`data/testMap.ts`'s `TileType`, char `@`): mechanically
identical to `cliff` for ordinary movement (ground-impassable, a flying unit
crosses free via `PathfindingSystem`'s existing `ignoreWalls`) — but with
one deliberate exception, its whole reason to exist: a unit forced onto a
pit tile by a push effect (a weapon mastery Push, or a `forcedMoveTiles`
spell — Thunderwave, Gust of Wind, Reverse Gravity) falls in and is
INSTANTLY defeated, resolved through the exact same `resolveDeaths`/
`resolveDeathTriggers` funnel any other kill uses (gold, Splitter/Carrier,
Explosive, etc. all still fire correctly). This turns an existing mechanic
(Push mastery, forced-move spells) into a genuine environmental-kill tool
near a chasm — "easy to learn" (it's just a hole you get shoved into),
"hard to master" (positioning enemies against a pit edge is a real tactic).
`GameMap.isWalkable`/`isPit` are the only query-layer changes; no new
pathfinding concept — `isWalkable`'s existing "unwalkable unless..." shape
already generalizes for free.

**Hero-affecting terrain** (`GameMap.heroTerrainEffectAt`): reads the exact
same `TerrainEffect` an enemy would suffer (`data/terrain.ts`, unchanged),
gated on the new `ParsedMap.hazardsAffectHeroes` flag and applied once per
player phase in `BattleScene.onPhaseChange`'s `"player"` case, same cadence
as the existing Phase 21 hero status-damage tick it sits right next to.
Zero new mechanic — this is entirely a "who gets asked" change, not a "what
happens" change.

**`DynamicTerrainSystem.ts`** (new, pure, tested) — mid-battle terrain
changes, kept fully data-driven and generic (one system serves both a
cyclical tide AND a one-way collapse, rather than two bespoke mechanics):
a `DynamicTerrainEvent` names a wave number (`atWave`, matching the "Wave N
/ M" banner players already read), the tiles it changes, and what they
become; `warningStartWave` computes when a telegraphed warning should first
appear (`warnWavesBefore`, defaulting to 1). `BattleScene.tickDynamicTerrain`
fires due events and logs new warnings once per `betweenWave` transition —
right after the wave number advances, which is also always a moment with
zero enemies on the board (a wave only reaches `betweenWave` once fully
cleared), so a collapsing tile can never strand a live enemy mid-tile.
**A real correctness bug caught before it shipped**: the first draft
reassigned `BattleScene.map` to a brand-new `GameMap` instance when an event
fired — but `WaveSystem`/`PathfindingSystem`/`BuildSystem`/`MovementSystem`
each hold their OWN reference to the original `GameMap`, captured once at
battle start, so only `BattleScene`'s own view would have updated. Fixed
with a new `GameMap.setTiles()` that mutates the SAME instance's tile grid
in place — every system sees the change immediately, since none of them
cache tile data of their own.

**A second, unrelated real gap found and fixed while building this**:
`BattleScene.buildBoard` rendered every tile as either
`COLORS.tileBlocked` or `COLORS.tileFloor` — cliff/water/fire/acid have
been mechanically distinct since Phase 11.7 but were VISUALLY IDENTICAL to
plain floor on the actual battle board the entire time (only the Map
Builder's own editing palette ever colored them). Fixed with a
`BOARD_TERRAIN_COLORS` map covering all 7 tile types plus a small glyph on
pit tiles; each tile's `Rectangle` reference is now kept in a `tileRects`
map so a dynamic terrain event can recolor just the tiles it changes.

**Four new maps** (`data/causewayMap.ts`/`drowningValeMap.ts`/
`cinderfallRiftMap.ts`/`frostboundHollowMap.ts`), each demonstrating a
different map-design principle rather than another reskin of the existing
16x9 skeleton:
- **Shattered Causeway**: a single 2-tile bridge across a chasm is the
  ONLY ground crossing — the pit's showcase (shove an enemy off the
  causeway for an environmental kill).
- **The Drowning Vale**: a wide flood zone that turns from floor to water
  at Wave 3 (telegraphed from Wave 1) and recedes at Wave 6 — the cyclical
  dynamic-terrain showcase; water stays walkable, so the route is never
  actually severed, just slower/riskier.
- **Cinderfall Rift**: three lanes (north/direct/south) joined only at the
  map's east/west ends; the direct middle bridge permanently collapses
  into a pit at Wave 4 (telegraphed from Wave 2) — the one-way
  dynamic-terrain showcase, forcing a real mid-battle reroute onto the
  longer, fire-lined paths. Connectivity verified BOTH before and after the
  collapse in `tests/newMapsPhase23.test.ts`, not just assumed.
- **Frostbound Hollow**: a solid cliff ridge splits the map in two, with
  ground crossings only at the very top/bottom rows — the static
  flying-vs-ground verticality showcase (no new code needed; cliffs already
  cross free for flying units).

All four join `data/maps.ts`'s `MAPS` registry and `FreePlayScene`'s
`MAP_OPTIONS` immediately (`unlockCampaignId: null`, the same staging every
prior boss/enemy got before it had a campaign of its own) — avoiding dead
scaffolding, per this project's standing rule. No campaign of their own
this pass.

- Tests: 900 → **937** (+37: `tests/dynamicTerrainSystem.test.ts` [11, new],
  `tests/newMapsPhase23.test.ts` [16, new], a new Phase 23 section in
  `tests/terrain.test.ts` [+10] covering pit parsing/`isWalkable`/`isPit`/
  `describe`/round-trip, `GameMap.setTiles`, and `heroTerrainEffectAt`'s
  opt-in gating). Typecheck, all tests, and the production build all pass
  (109 modules, up from 104 — five new files: `systems/DynamicTerrainSystem.ts`
  and the four map files). `npm run dev` serves HTTP 200.
- **What's genuinely untested by the automated suite, and why**: the pit's
  actual push-into-death behavior lives in `BattleScene.pushEnemyAway` — a
  scene method, not a pure system, so (like every other weapon-mastery/
  forced-move mechanic in this project) it has no automated coverage and
  needs a human's real swings to confirm. Every PURE piece it depends on
  (`GameMap.isPit`/`isWalkable`, the death-trigger funnel) IS tested. See
  KI-071 for the full in-browser checklist.
- **Not built this pass, and why**: no bigger board (the 9-row/20-col
  ceiling stays, per the confirmed scope fork above); no per-map terrain
  authoring UI for dynamic events (the Map Builder gained the "pit" tile in
  its palette, but `dynamicTerrainEvents` stays built-in-map-only — a
  reasonable, documented boundary, not a gap); no hero-vs-hero or
  enemy-vs-hero push interaction with pits (only the existing hero-cast
  push effects can trigger a fall, since no enemy attack currently pushes a
  hero); Emberford/Saltmere were NOT retrofitted with `hazardsAffectHeroes`
  or the pit tile — their exact original behavior is preserved.

### D-115 — Phase 24: a "sand" build-restricted tile, five new structures/traps (Palisade, Bulwark, Watchtower, Frost Trap, Bear Trap)

Kevin asked directly for a sand tile ("acts like normal terrain except that
it cannot have buildings built on top of it," integrated into existing maps
"as I see fit") plus more buildings and traps generally, explicitly inviting
design judgment ("be creative and continue using good game design theory").
No scope fork needed asking — both asks are additive to an existing, well
understood system (`TileType`/`GameMap`, `StructureDefinition`), so this
session went straight to design-then-build rather than surfacing a
choice first.

**The "sand" tile** (`data/testMap.ts`'s `TileType`, char `D`): mechanically
identical to plain floor for every existing system — walkable, no terrain
effect, routes exactly the same (`GameMap.isWalkable` is unchanged). The one
difference is a NEW, separate query, `GameMap.isBuildable`, which
`BuildSystem.canPlace` now checks in addition to `isWalkable`: true for
every walkable tile except sand. This is deliberately its own method rather
than folded into `isWalkable` — movement/pathfinding must never see a
difference, only building should, and keeping them separate makes that
boundary explicit and independently testable. `data/terrain.ts` gets no new
entry — sand is a build restriction, not a hazard.

**Integration into existing maps**: the three Phase 23 maps that don't yet
have a campaign of their own (Shattered Causeway, Cinderfall Rift, The
Drowning Vale) each gained a small, thematically-placed sand patch — canyon
dunes past Causeway's chasm (denying a wall-plus-fire inescapable kill box
on the far bank), ash drifts at Cinderfall Rift's connector mouths, and
mudflats bordering The Drowning Vale's permanent water fringe. Frostbound
Hollow was deliberately left alone (an icy verticality map has no sand to
plausibly place). Emberford/Saltmere and the classic `TEST_MAP` were NOT
touched, for the same reason Phase 23 didn't retrofit them: preserve
already-shipped, already-unverified balance rather than silently changing
it. Since sand is walkable exactly like floor, none of this could break any
existing connectivity test — verified anyway with new assertions in
`tests/newMapsPhase23.test.ts`.

**Five new structures** (`data/structures.ts`), each reusing an existing
field wherever possible, plus two small, deliberate extensions:
- **Palisade** (wall, cost 3, `maxHp` 4) and **Bulwark** (wall, cost 14,
  `maxHp` 25) bracket Barricade's existing cost/durability on both ends —
  a real low/mid/high durability CHOICE on the wall curve for the first
  time, not just one wall stat block.
- **Watchtower** (platform, cost 11, +1 basic-attack damage) is the first
  platform with an `"any"`-audience bonus — `PlatformAudience` gains
  `"any"` alongside `"melee"`/`"ranged"`, and `BuildSystem.platformBonusFor`
  now matches every hero when a bonus declares it. Fills the gap between
  the two existing specialist platforms with a generalist one.
- **Frost Trap** (trap, cost 9, ground-only) reuses `appliesStatus`
  ("restrained", the same status Web Patch already applies) — a harder
  lockdown than Tangle Root's softer slow, on a buildable trap for the
  first time (previously "restrained" was spell-placed only).
- **Bear Trap** (trap, cost 10, ground-only, 6 damage) introduces the one
  genuinely new field: `singleUse?: boolean`. Every trap before this
  persists and re-triggers indefinitely; Bear Trap is consumed and removed
  the FIRST time it triggers — a real new point on the trap design curve
  (one heavy burst vs. a smaller sustained tick), resolved by
  `BuildSystem.trapIsSingleUseAt` (pure, tested) and actually removed by
  `BattleScene` right after the trigger's flash renders. Known, documented
  edge case: if two different enemies enter the SAME single-use trap tile
  within the identical enemy phase (before `BattleScene` gets a chance to
  remove it), both trigger — `WaveSystem` has no "already fired this phase"
  concept for a trap, and adding one for this one edge case was judged not
  worth the risk to the existing, heavily-tested trap-resolution loop. Rare
  in practice (a placed trap sits on one tile; enemies usually queue through
  a tile one at a time).

**A real pre-existing bug found and fixed while wiring Bear Trap's name into
the combat log**: `BattleScene.showTrapTrigger` had hardcoded the string
"Spike Trap" for EVERY trap trigger since Phase 5 — Sky Snare, Tangle Root,
Web Patch, and even the acid-terrain fallback all logged as "Spike Trap
hits/defeats `<enemy>`" regardless of what actually fired. Adding a
FIFTH trap type made this impossible to ignore. Fixed by resolving each
trigger's real structure (or, for the acid-terrain fallback, its tile type
capitalized) into a name BEFORE the delayed render call — necessary because
a single-use trap's structure may already be gone by the time the callback
runs.

- `SHOP_ORDER` grows from 7 to 12 entries. Checked the shop grid's own
  bounding-box math (`BattleScene`'s `buildItemGrid`/the `cy`/`rows`
  computation near the Done button): the equip/Gear grid has been the
  dominant, page-capped grid (4 rows, `GEAR_GRID_PAGE_SIZE / cols`) since
  Phase 17's weapon/armor expansion, and 12 shop items at 4 columns is only
  3 rows — so this needed NO layout change at all, not even a recheck of
  the Done button's position.
- Tests: 937 → **960** (+23: a new Phase 24 section in `tests/terrain.test.ts`
  covering sand's parsing/`isWalkable`/`isBuildable`/`describe`/round-trip;
  new sections in `tests/building.test.ts` covering sand's build refusal,
  Palisade/Bulwark's durability, Watchtower's `"any"` audience match, Frost
  Trap's restrain, and Bear Trap's `singleUse` flag plus its damage through
  a real `WaveSystem` tick; three new assertions in
  `tests/newMapsPhase23.test.ts` confirming each touched map's sand tiles
  are present, walkable, unbuildable, and don't break connectivity).
  Typecheck, all tests, and the production build all pass (109 modules,
  unchanged — no new source files, only edits). `npm run dev` serves HTTP
  200 (checked this session).
- **What's genuinely untested by the automated suite, and why**: a
  single-use trap's actual removal-after-trigger lives in
  `BattleScene.runEnemyPhase`'s delayed-render closure, a scene method, not
  a pure system — same standing limitation as every other scene-only
  mechanic in this project (the pit's push-kill, D-114). The pure piece it
  depends on (`BuildSystem.trapIsSingleUseAt`) IS tested. A human's real
  swings are needed to confirm the trap actually disappears from the board
  after firing, and that the combat log now names every trap correctly.
- **Not built this pass, and why**: no defensive (Armor-Class-granting)
  platform — considered, but wiring a tile-based AC bonus into
  enemy-attacks-hero resolution would need either a new `Hero` field kept
  in sync by the scene on every hero move, or a new `WaveSystem` context
  callback (the same shape `wallHpAt`/`damageWall` already established) —
  judged disproportionate to add alongside everything else in this batch;
  a clean future addition if wanted. No anti-air trap tier to mirror
  Frost/Bear Trap's ground-side spread (Sky Snare stays the only flyer
  counter) — flagged as a reasonable next step, not attempted here to keep
  this batch's size in line with the rest of the project's "small, testable
  changes" pattern. Emberford/Saltmere/`TEST_MAP` were NOT retrofitted with
  sand, matching Phase 23's own precedent for those three maps.

### D-116 — Phase 25: cheap/expensive structure tiers, an opportunistic wall-bash any melee enemy can now take, and a trap-disarming Saboteur archetype

Kevin asked for three things in one message, explicitly framed as a
follow-up to the Phase 24 discussion about upgrade systems vs. cost tiers
(Kevin picked cost tiers): (1) more cheap/expensive versions of traps and
buildings/walls, (2) a real siege AI — every enemy able to choose to attack
a structure "if it makes sense based on their particular personality" and
"the opportunity (no other option)" and if doing so "would improve the
enemies' odds," and (3) enemies/enemy skills that detect and disarm/destroy
traps. All three are additive to existing, well-understood systems
(`StructureDefinition`, `WaveSystem.tickEnemyPhase`'s existing siege branch,
`EnemyDefinition`'s existing per-mechanic-field pattern), so this session
went straight to design-then-build.

**Ten new structures** (`data/structures.ts`), every one bracketing an
EXISTING item's cost/effect on the cheap or expensive end — no new fields at
all, pure content, the same pattern Palisade/Bulwark already established
for Barricade:
- **Wicket Gate** (cost 4, `maxHp` 5) / **Portcullis** (cost 12, `maxHp`
  16) bracket Gate, giving the gate curve its own low/mid/high tier to
  match the wall curve.
- **Snare Wire** (cost 4, 1 damage, ground) / **Mangler Trap** (cost 13, 5
  damage, ground, persistent) bracket the ground-trap-damage curve below
  Tangle Root/Spike Trap/Frost Trap and above Bear Trap respectively.
  Mangler Trap is deliberately NOT `singleUse` — a smaller sustained hit
  forever is a genuinely different choice from Bear Trap's one-big-hit.
- **Net Snare** (cost 4, 2 damage, flying) / **Storm Lance** (cost 13, 7
  damage, flying) bracket a flying-trap curve that, before this phase, was
  just Sky Snare alone — this also closes KNOWN_ISSUES' long-deferred "no
  anti-air trap tier" item from Phase 24.
- **Sparring Post** (cost 5, +1 melee damage) / **War Dais** (cost 14, +4
  melee damage) bracket Melee Platform.
- **Low Perch** (cost 5, +1 ranged DAMAGE) / **Sky Bastion** (cost 14, +1
  ranged damage AND +1 range) bracket Ranged Perch. Low Perch deliberately
  trades Ranged Perch's range bonus for a smaller damage bonus rather than
  being a strictly weaker copy of it; Sky Bastion is the one structure in
  the roster granting both bonus types on one tile.

`SHOP_ORDER` grows from 12 to 22 entries.

**Shop grid pagination** (`BattleScene.ts`): 22 shop items at 4 columns is 6
rows, which the concrete layout math showed would push the Done button (and
the bottom rows of a large page) past `GAME_HEIGHT` (1080px) — the shop grid
had never needed to paginate before, unlike the Gear/weapon-armor catalogue,
which already solved exactly this problem in Phase 17 (D-108). Rather than
duplicate a second, parallel paging system, the existing one was
GENERALIZED: `GEAR_GRID_PAGE_SIZE` is renamed `ITEM_GRID_PAGE_SIZE` and now
paginates the shop grid too (`showShopUI` gained the same page-slicing
`showEquipUI` already had); the three nav-button fields (`gearPagePrevButton`
etc.) are renamed to `pageNav*` and shared between both grids (never shown
at once); `turnGearPage` is generalized to `turnGridPage`, branching on
`this.ui.kind` via the already-existing `currentGridItems()` helper instead
of hardcoding "equipping." A new `refreshPageNav()` computes nav visibility
purely from `this.ui.kind`, called once after `setInteraction`'s two
(mutually exclusive) `showShopUI`/`showEquipUI` calls — calling it from
inside either method directly would have the second call's `show: false`
branch clobber whichever one just set the nav correctly. Net effect: BOTH
grids are now permanently capped at 4 rows regardless of catalogue size, so
neither the shop nor Gear can ever again grow past the canvas.

**Opportunistic wall bash** (`WaveSystem.tickEnemyPhase`): a NEW branch,
inserted right after the existing hero-attack branch (so a reachable hero
still always wins) and before the "advance" fallback. Any enemy that is NOT
a dedicated siege enemy (`siegeDamageMultiplier`), NOT a pure runner
(`ignoresHeroes` — unchanged, it still never attacks anything), and has
`attackRangeTiles <= 1` (a melee "personality" — a ranged/caster enemy
usually doesn't need a wall gone at all, since its range already reaches
past one) now scans its own attack range for a destructible wall via the
SAME `WaveSystem.findWallInRange` a siege enemy already uses, the moment no
hero is reachable this phase (the "opportunity" — genuinely no other useful
action). It deals its plain `attackDamage` (plus any aura/enrage bonus
already in play) — no siege multiplier, since this is an improvised bash,
not a dedicated demolition attack, and it "improves its odds" the same way
a siege enemy's attack does: clearing a real obstacle instead of standing
around uselessly. `StructureAttackEvent` gains an optional `opportunistic`
flag so `BattleScene.showStructureAttack`'s combat-log line can read
correctly ("Grunt, unable to reach a hero, pounds the Barricade for 2" vs.
the unchanged siege phrasing). Existing siege behavior is completely
unaffected — a siege enemy's own branch runs strictly earlier and always
`continue`s if it finds a wall, so it never falls through to this one.

**Trap disarm — the Saboteur archetype** (`data/enemies.ts`,
`WaveSystem.tickEnemyPhase`, `BuildSystem.disarmTrap`): a new
`EnemyDefinition.trapSense?: { rangeTiles }` field. An enemy carrying it
scans within `rangeTiles` (Manhattan, INCLUDING its own tile — unlike a
siege enemy's wall scan, an enemy standing on an already-placed,
not-yet-triggered trap should still notice it) for a placed trap via a new
`WaveSystem.findTrapInRange` helper, and — checked at the SAME unconditional
priority tier siege already established for walls, so it wins over even a
reachable hero — disarms/destroys it outright instead of attacking or
advancing. A trap has no HP to whittle down (D-039: it always hits, in
full, every time), so `BuildSystem.disarmTrap` is a one-shot removal (wraps
`remove()`), never a partial-damage step like `damageStructure`; it also
never refunds gold, same as `damageStructure`/`remove()` generally — this is
the enemy destroying the player's investment, not the player reclaiming it.
Two new roster entries: **Saboteur** (fast, fragile, `rangeTiles: 1`) and
**Warren Stalker** (tougher, `rangeTiles: 2`, senses a trap one tile further
out). New context fields `trapInstanceAt`/`disarmTrap` on
`EnemyPhaseContext`, paired exactly like `wallHpAt`/`damageWall`; a new
`TrapDisarmEvent`/`EnemyPhaseReport.trapDisarms`; `BattleScene` wires the
context and renders a new `showTrapDisarm` (flash + "X disarms the Y" +
unconditional token removal, since disarming always fully removes a trap).

- Tests: 960 → **983** (+23: `tests/building.test.ts` gained four new
  `describe` blocks covering all ten new structures' cost/`maxHp`/damage/
  `heroBonus` values and the gate curve's route-seal rule; a new
  `tests/enemyMechanicsPhase25.test.ts` behaviourally exercises the
  opportunistic wall bash — including that a ranged enemy, a pure runner,
  and a dedicated siege enemy are all correctly excluded/unaffected — and
  the trap-disarm mechanic, including its priority over a reachable hero and
  each enemy's own `rangeTiles`; `tests/enemyRoster.test.ts` gained a Phase
  25 roster section plus an updated minion-count assertion). Typecheck, all
  tests, and the production build all pass (109 modules, unchanged — no new
  source files besides the one new test file). `npm run dev` serves HTTP
  200 (checked this session).
- **What's genuinely untested by the automated suite, and why**: the shop
  grid's page-nav buttons are Phaser UI, exercised only by the same
  bounding-box arithmetic check every prior grid-layout change in this
  project has relied on (Phaser scenes have no unit tests here) — verified
  by hand this session: at `GAME_HEIGHT` 1080px, `TEST_MAP`'s 9 rows put the
  grid's `cy` around 848px, and with BOTH grids now capped at 4 rows the
  Done button lands at the same Y as before this phase, regardless of how
  large either catalogue grows in the future.
- **Not built this pass, and why**: no additional Watchtower-style `"any"`-
  audience platform tier — Watchtower already fills that generalist niche
  alone, and the ask was specifically for brackets around the two EXISTING
  specialist platforms, not a third audience category. No damage-scaling
  or HP for traps (still indestructible/un-upgradeable beyond the D-115
  "different cost tiers" decision this phase continues) — Kevin explicitly
  chose cost tiers over an upgrade system for this exact reason at the start
  of this session.

### D-117 — Playtest fixes (canvas centering, KI-033), removing the classic fixed roster and flat Vigor/Might choice, and hero-sprite loading plumbing

Kevin played the deployed build for the first time in ten phases and reported
the screen looked off-center and buttons/text overlapped "all over the
place." Investigating found two concrete, fixable root causes rather than a
diffuse layout problem: (1) `index.html`'s `#game-root` is a flex container
that centers its child, AND Phaser's own `scale.autoCenter: CENTER_BOTH` also
centers the canvas via inline margin math that assumes a plain block parent —
stacking both centered the canvas twice; (2) KI-033, already logged: the
"Wave N / M · Phase" banner (centered, variable width) and the Gear button
(right-margin-anchored) are positioned completely independently, so a long
banner string can physically reach into the button's zone. In the same
conversation Kevin asked to remove the original classic fixed 4-hero roster
(Ash/Wren/Bram/Mira) and its flat Vigor/Might level-up choice now that the
D&D-style character-creation/real-class-leveling system has fully superseded
them, and separately asked about a full visual rework including sprites —
scoped down, after discussion, to just the loading/rendering PLUMBING now
(no image-generation tool exists in this environment and no art files exist
yet), with real art explicitly deferred to when Kevin has files to supply.

**Canvas centering** (`src/main.ts`): `scale.autoCenter` changed from
`Phaser.Scale.CENTER_BOTH` to `Phaser.Scale.NO_CENTER` — the CSS flex box in
`index.html` now does 100% of the centering, Phaser's inline-style mechanism
no longer fights it.

**KI-033 fix** (`BattleScene.ts`): rather than guess a padding number (the
prior comment already tried that twice — D-046/D-055/D-059 — and still
collided), `buildHud()` now records the Gear button's real left edge as
`bannerMaxWidth` (twice its distance from center, minus a safety gap), and a
new `fitBannerToWidth()` shrinks the banner's font size — using its ACTUAL
Phaser-measured `.width`, not an estimate — until it fits, resetting to full
size first so a short string (e.g. "Victory") isn't left shrunk from a prior
long one. Correct regardless of font metrics or future label-text changes,
unlike a fixed pixel gap.

**Other HUD rows audited, not changed**: the Confirm/Cancel/Ability/Potion
and Bonus Action/Action Surge rows, and `CharacterCreationScene`'s per-slot
column stacking, were checked by hand against their actual current
coordinates — no other confirmed overlap found in the current code (the
column-stacking pattern is fragile-by-construction — every new row is a
manual `+40`/`+50` bump — but not itself broken today). Not rewritten into a
self-measuring layout system this pass; flagged in KNOWN_ISSUES as worth
revisiting if a future row addition ever collides.

**Classic roster removal**: `HERO_DEFINITIONS`/`HERO_COLORS`/
`getHeroDefinition` deleted from `data/heroes.ts` entirely — every hero is
now built via `CharacterBuildSystem.heroDefinitionFromBuild`, with no
fallback. `MainMenuScene`'s START button (bare `scene.start("BattleScene")`,
no data) is gone; "Create Party" is promoted into its old slot and renamed
"New Game" — the only way into a battle now. `BattleScene.init()`'s
`heroDefinitions` is no longer optional; a missing/empty one throws
immediately with a clear message instead of silently falling back.
`ProgressionSystem` keeps its cadence tracking (`hasPendingLevelUp`/
`acknowledgeLevelUp` — this ALSO drives real per-class leveling, per D-089)
but loses `LEVEL_UP_OPTIONS`/`applyChoice`/the Vigor/Might choice entirely;
`BattleScene.showLevelUpChoice`/`chooseLevelUp` and the now-impossible
`isClassBasedParty()` branch are deleted (every hero always has `classId`
now). `Hero.grantVigor` is deleted too (no caller survived the choice's
removal); `Hero.grantMight` stays — it's also how the Vigor Tonic
attack-buff potion works.

**Co-op's hidden dependency on the classic roster, found and fixed**:
`CoopLobbyScene` had no hero-picker UI and silently relied on
`BattleScene`'s classic-roster FALLBACK for its default party — removing the
fallback would have broken Co-op outright. Fixed with a new
`CharacterBuildSystem.defaultPartyBuilds(size)`: a small, deterministic set
of fresh level-1 D&D builds (Fighter/Wizard/Rogue/Cleric — the first four of
`CREATABLE_CLASS_IDS`, matching the classic roster's old
tank/caster/skirmisher/healer-shaped spread), computed once as
`DEFAULT_COOP_HERO_DEFINITIONS` so `startBattle`'s hero-id list and
`enterBattle`'s `heroDefinitions` always agree on the same ids.

**Test fixtures untangled from the removed roster**: `tests/heroRoster.test.ts`
(existed only to lock the classic roster's shape) deleted outright.
`tests/progression.test.ts` trimmed to cadence-only. Eight other files
(`battleStateSnapshot`, `classLeveling`, `enemyCollision`, `equipment`,
`heroStatusEffects`, `potions`, `spellSlots`, `victory`) used
`getHeroDefinition("hero-ash"/"hero-wren")` purely as generic Hero fixtures —
each now builds its own small inline `HeroDefinition` literal (same numbers
as the old classic entries, where a test asserted an exact value) instead.
`tests/coopSessionSystem.test.ts` needed no change — it exercises
`CoopSessionSystem` with arbitrary id strings, never `data/heroes.ts`.

**Hero-sprite loading plumbing** (no art yet): `HeroDefinition` gains an
optional `assetKey` (set by `heroDefinitionFromBuild` as `hero-${classId}`,
the same "declared, not yet consumed" treatment `EnemyDefinition`/
`StructureDefinition.assetKey` already had — see ASSET_PLAN.md). New
`data/spriteManifest.ts` exports `SPRITE_MANIFEST: Record<string, string>`
(assetKey -> image path), currently EMPTY. `BattleScene.preload()` (this
scene's first) loads whatever it lists — zero entries today, so zero image
requests, zero console noise. A new `createTokenSprite(assetKey, circle,
depth)` checks `this.textures.exists(assetKey)`; if a texture is loaded, it
creates a sprite sized to the circle's diameter and hides the circle (kept
alive, unchanged, as the fallback shape) — always returns `undefined` today.
Wired into hero-token creation only (`buildHeroes`) and the shared
`placeToken`/`Token.sprite` (so a hero's sprite, once one exists, moves and
gets destroyed exactly where its circle already does) — chosen as the single
demonstrated instance of the pattern because hero tokens have no other
per-token visual mutation (no stealth-dimming, aura ring, or boss-size
variant, unlike enemy tokens) to reconcile with a sprite swap. Enemy/
structure tokens already carry a populated, unused `assetKey` and follow the
identical pattern once art actually exists — intentionally NOT done this
pass, since it's unverifiable (no art, no browser) and each has real
per-token mutation logic (stealth dimming, aura rings, boss-size bump) that a
sprite swap needs to reconcile with, worth doing WITH real art in hand
rather than speculatively.

- Tests: 983 → **976** (net -7: `tests/heroRoster.test.ts` deleted [-4],
  `tests/progression.test.ts` trimmed [-1], eight fixture-only files
  unchanged in count). Typecheck, all tests, and the production build all
  pass. `npm run dev` serves HTTP 200 (checked this session).
- **Not built this pass, and why**: enemy/structure token sprite rendering
  (see above — deferred until real art exists, to avoid speculative,
  unverifiable code). No self-measuring/auto-flow HUD layout system (the
  audited rows aren't currently broken; a full rewrite risks introducing new
  bugs with no browser to check them). No UI-chrome/board/item/spell sprite
  rendering — ASSET_PLAN.md ranks those below hero/enemy/structure tokens,
  and none was asked for by name.
- **A real limitation of this environment, stated plainly**: none of this
  session's visual work could be confirmed on-screen — no browser is
  available here. The canvas-centering and KI-033 fixes are both grounded in
  concrete, traceable root causes (not guesses), but still need Kevin's own
  look before being called done.

### D-118 — Campaign engine scaffolding: chapters, world-flags, a companion roster — content-free by design

The session right after D-117 produced `CAMPAIGN_STORY_DESIGN.md` (design
only, no D-NNN of its own — a framework for Kevin to react to, not a locked
decision): a full six-region campaign story ("The Unremembering"), each
region a 4-chapter 1-20 arc, a 6-companion catalogue with recruit/bench/lose
branching, and a world-flag-driven capstone ending. Its own §7 flagged the
engine gap: `CampaignDefinition` is flat (one map/one boss/one wave list),
`CampaignProgressSystem` tracks only a completed/not-completed boolean, and
there is no companion-catalogue, active-roster, or world-flag code anywhere.
Offered a choice between building that content (companion dialogue
first-draft), this engine scaffolding, or the bonus-choice pool numbers,
Kevin chose the engine scaffolding.

Built as pure, storage-agnostic systems only — no Phaser, no scene wiring,
no UI — following the exact precedent D-101 (Phase 12.1's
`BattleStateSnapshot`) set: build the capability headless and fully tested,
defer integration until the content/UI that needs it actually exists. This
also matches the project's own standing guidance to prefer
browser-independent work when there's no playtest time available.

- **`ChapterDefinition` + chapter helpers** (`data/campaigns.ts`):
  `CampaignDefinition` gains an optional `chapters?: ChapterDefinition[]` —
  untouched by both existing campaigns (Emberford Reach, Saltmere Shallows),
  which stay flat with zero behavior change. A `ChapterDefinition` has its
  own `levelRange`/`waves`/optional `bossEnemyId`/`lootPoolIds`/`introText`/
  `outroText`, but deliberately no `mapId` of its own — all four chapters of
  a region share the parent campaign's one map, per
  `CAMPAIGN_STORY_DESIGN.md` §2. Three new functions —
  `isChapteredCampaign`, `totalChapters`, `getChapter` — give every caller
  ONE access pattern regardless of whether a campaign is chaptered:
  `getChapter(def, 0)` on a flat campaign synthesizes a single chapter from
  its existing top-level fields, so no future caller needs an `if
  (isChapteredCampaign(...))` branch just to read chapter 0.
- **Per-chapter completion tracking** (`systems/CampaignProgressSystem.ts`):
  `CampaignProgress` gains `completedChapters: Record<string, number>` (the
  highest 0-based chapter index completed per campaign id, alongside the
  existing whole-campaign `completedIds` boolean — the two are tracked and
  queryable independently). `loadCampaignProgress` treats a missing
  `completedChapters` field as normal, not corrupt — every blob saved before
  this decision lacks it entirely. New `markChapterCompleted` (same
  same-object-reference no-op discipline as `markCampaignCompleted` when a
  chapter is already covered by a later one), `getHighestCompletedChapter`,
  `isChapterCompleted`.
- **`systems/WorldFlagSystem.ts`** (new, pure): a generic per-choice flag
  store (`Record<string, boolean | string | number>`), same
  load/save/storage-shape pattern as `CampaignProgressSystem`. Exists to let
  a later region or the capstone read a choice made in an earlier one — e.g.
  which miniboss was spared, or Sorrel Thane's 3-outcome branch (§4/§6 of
  the design doc) — without yet committing to what any specific flag means;
  no story content writes to it yet.
- **`data/companions.ts`** (new) + **`systems/CompanionRosterSystem.ts`**
  (new, pure): `CompanionDefinition` is a thin wrapper — id, name, a full
  `CharacterBuild` (the same shape a player-built hero uses,
  `heroDefinitionFromBuild`-ready), `startsInParty`, optional
  `homeRegionId` — around the design doc's own framing that "each companion
  is just a named `HeroDefinition` with a preset starting build." `COMPANIONS`
  is an EMPTY array — the six named companions (Hollis Vane, Fenna
  Duskwater, Isolde Varnhall, Tamsin Rourke, Dorian Wick, Sorrel Thane) are a
  separate, not-yet-done writing pass Kevin explicitly did NOT choose this
  session — same "declared, not yet consumed" treatment
  `data/spriteManifest.ts` got in D-117. `CompanionRosterSystem` models
  exactly three states a companion id can be in — **active** (one of the 3
  bench slots, `MAX_ACTIVE_COMPANIONS`, alongside the 1 PC = the existing
  hardcoded `MAX_PARTY_SIZE` of 4), **benched** (recruited, not currently
  active), **lost** (permanently removed, can never be recruited or
  activated again — the mechanism the design doc's Sorrel Thane "Lost"
  outcome needs) — plus load/save persistence, mirroring the other two new
  systems.
- **Two new `config.ts` storage keys**: `WORLD_FLAG_STORAGE_KEY`,
  `COMPANION_ROSTER_STORAGE_KEY` — declared, not yet written by any scene.
- Tests: 976 → **1021** (+45: new `tests/worldFlagSystem.test.ts` [9], new
  `tests/companionRosterSystem.test.ts` [19], new `tests/companions.test.ts`
  [2], a new "Chapters (D-118)" section in `tests/campaigns.test.ts` [+5], a
  new "chapter completion (D-118)" section in `tests/campaignProgress.test.ts`
  [+10]). Typecheck, all 1021 tests, and the production build all pass.
  Module count unchanged at 109 — none of this session's four new/extended
  systems are imported from `main.ts`'s dependency graph yet, exactly as
  intended for engine-only scaffolding. `npm run dev` serves HTTP 200.
- **Not built this pass, and why**: no scene/UI wiring at all (no
  recruitment screen, no chapter-boundary text panel, no bonus-choice-pool
  UI) — none of it has real content to display yet (no companions, no
  authored chapters for any of the six regions, no bonus pools); no
  migration of the two existing flat campaigns into the region structure
  (that's a content-authoring decision for whoever picks up
  `CAMPAIGN_STORY_DESIGN.md`'s region-by-region assignment, not an engine
  concern); no `SaveSystem`/`BattleScene` integration for world-flags or the
  companion roster (both are standalone, storage-keyed systems today,
  exactly like `CampaignProgressSystem` was before `BattleScene` started
  reading/writing it) — wiring either in needs an actual read/write site,
  which doesn't exist without chapter/companion content driving it yet.
- **What this unblocks next**: `CAMPAIGN_STORY_DESIGN.md`'s own "still open"
  list (companion dialogue first-draft, giving branch choices real
  mechanical weight, the bonus-choice pool numbers) can now target real
  types (`ChapterDefinition`, `CompanionDefinition`, `WorldFlagState`)
  instead of a still-hypothetical shape.

### D-119 — A stylized parchment dialogue box for chapter-boundary story text, with an NPC-only portrait slot

Immediately after D-118, Kevin asked for the dialogue-box PRESENTATION
itself: stylized text on a parchment-type background, with a 2D
front-facing sprite of whichever character is speaking — asking "maybe NPC
only?" for the portrait. Two real forks resolved before any code: (1) which
speakers get a portrait — resolved to NPC-only (companions, bosses,
narrator-style text); the player's own PC speaks in plain full-width text
with no portrait, since the player is already looking at their own hero on
the board; (2) since no chapter/story content exists yet to trigger this
naturally, how to make it visible in-browser now — resolved to adding a
small preview/demo entry point rather than shipping it headless-and-unseen.
Kevin explicitly wants this ready to go for when he has portrait images to
upload, mirroring D-117's hero-sprite plumbing's "build the loading
plumbing now, real art later" treatment.

- **`src/game/scenes/dialogueBox.ts`** (new): `DialogueLine` (`speakerName?`,
  `portraitKey?`, `text`) and `DialogueBoxController`/`showDialogue`, a
  reusable renderer any scene can call — a deliberate departure from this
  project's usual "each scene hand-rolls its own small button helper"
  convention, justified because this is substantially more drawing code
  than a button and already has two known callers (the preview tab now, a
  future `BattleScene` chapter-transition hookup later). Follows this
  codebase's existing overlay idiom exactly (a flat `GameObject[]`,
  `asiOverlay`/`spellbookOverlay`'s pattern in `BattleScene.ts`) rather than
  Phaser scene-stacking (confirmed via research: this project never uses
  `scene.launch`, only `scene.start` — one active scene at a time, always).
  A line with `speakerName` set renders a framed portrait + name plate on
  the left (real image once one loads for `portraitKey`, else a drawn
  placeholder silhouette — never a blank gap) and text alongside; a line
  with no `speakerName` (PC/narration) renders full-width text with no
  portrait region at all.
- **The parchment panel is drawn with `Phaser.GameObjects.Graphics`, not an
  image** — a base fill, a few fixed low-alpha "aged" mottling blotches, and
  a double frame border, introducing `fillRoundedRect`/`strokeRoundedRect`
  as new patterns in this codebase (nothing existing used rounded corners).
  Same "real drawing code, no art asset needed" treatment Phase 22's Cape of
  Billowing got — nothing about the panel itself needs an uploaded image to
  look finished.
- **`src/game/data/portraitManifest.ts`** (new): `PORTRAIT_MANIFEST:
  Record<string, string>`, currently EMPTY — same "declared, not yet
  consumed" treatment `data/spriteManifest.ts` got in D-117. Deliberately a
  SEPARATE manifest from `spriteManifest.ts`: that one is small circular
  board tokens; this one is a larger front-facing bust portrait, a
  different image category with no reason to share one lookup table.
- **Five new `config.ts` `COLORS` entries**: `parchmentBase`/
  `parchmentMottle`/`parchmentBorder` for the panel, `portraitPlaceholderBg`/
  `portraitPlaceholderFg` for the silhouette placeholder.
- **A "Dialogue" preview tab in `CompendiumScene`**: not a rules-lookup
  category like the rest of that scene — a "Show Sample Dialogue" button
  that fires three sample lines (one narrator/PC-style, two NPC-style with a
  portrait key that intentionally isn't in the empty manifest, demonstrating
  the placeholder-silhouette fallback and multi-line Continue/Close paging)
  so the styling can be seen and tuned in-browser right now, resolving this
  session's second scope fork. `CompendiumScene` gained its own `preload()`
  (a no-op today, mirroring `BattleScene.preload()`'s loop over
  `SPRITE_MANIFEST`) and an `activeDialogue` field torn down on tab-switch
  and scene SHUTDOWN, matching this scene's existing teardown discipline.
- Tests: unchanged at **1021** — this session is pure Phaser presentation
  code with no new pure logic to test (no chapter/story content reads or
  writes anything here yet). Typecheck and all 1021 tests pass; the
  production build passes at **111 modules** (up from 109 — the two new
  files are now reachable through `CompendiumScene`, correctly reflecting
  that this session, unlike D-118, IS wired into a real scene). `npm run
  dev` serves HTTP 200 (checked this session), and the preview tab was the
  point of this session's whole "make it visible" fork — Kevin can open
  Compendium → Dialogue → Show Sample Dialogue and see the actual result.
- **Not built this pass, and why**: no `BattleScene`/chapter-transition
  wiring — `ChapterDefinition.introText`/`outroText` (D-118) still aren't
  read by anything; there's no real chapter content yet to trigger this
  from. No text-typewriter/animation effect (a static full-text render per
  line, matching this project's general "don't build ahead of what's
  needed" discipline — easy to add later if wanted). No sound. No portrait
  art — that's explicitly Kevin's own follow-up once he has images.

### D-120 — Dialogue skip controls (skip-the-whole-sequence, skip-past-a-line), a future audio/animation interrupt seam

Immediately after D-119, Kevin asked for two related controls on every
dialogue sequence: a way to skip the WHOLE talking section outright when no
player decision is pending, and a way to skip past the CURRENT line so a
fast reader isn't stuck waiting on it. He also flagged that future
voice-over audio would need to be interruptible by both. No choice/decision
system exists yet in the dialogue box (`CAMPAIGN_STORY_DESIGN.md`'s branch
choices are still design text only), so the "no decision pending" gate
needed a minimal, forward-compatible signal to check against rather than a
real choice-rendering system.

- **`DialogueLine.hasDecision?: boolean`** (new field): a GATING FLAG only —
  no choice UI exists to set it from yet, and nothing produces a line with
  it set today. `canSkipSequence(lines)` returns false the instant ANY line
  in the sequence sets it, checked once at construction against the WHOLE
  sequence (not just the remaining lines), since skipping must never let a
  player bypass a choice they haven't reached yet either.
- **A real architecture fix found while building this**: the first draft
  put `DialogueLine`/`canSkipSequence` directly in `scenes/dialogueBox.ts`
  and wrote a unit test importing from it — which failed immediately
  (`ReferenceError: window is not defined`), because that file's top-level
  `import Phaser from "phaser"` executes Phaser's own module-init code,
  which touches `window`, unavailable in this project's Node-based Vitest
  environment. Fixed properly, not worked around: `DialogueLine`/
  `canSkipSequence` moved into a new `systems/DialogueSystem.ts` (pure, no
  Phaser import), per this project's own architecture rule that pure rules
  belong in `systems/`, never `scenes/`. `dialogueBox.ts` now imports from
  it and re-exports both for existing callers.
- **"Skip past the current line" is always available, several ways at
  once**: the existing Continue/Close button, clicking anywhere on the
  parchment panel or the dim scrim behind it (Phaser's default `topOnly`
  input means the higher-depth Continue/Skip buttons still take priority
  over the panel/scrim at the same point), or pressing Space/Enter. All of
  them funnel through the same `advance()` method.
- **"Skip the whole sequence" is a dedicated button**, top-left of the
  panel (the bottom-left corner is the portrait's territory), shown only
  when `canSkipSequence` is true for the sequence. Jumps straight to
  `onComplete()` without rendering any remaining line.
- **`interruptCurrentLinePlayback()`**: a new, deliberately EMPTY private
  method every advance/skip path calls before ending a line's presentation
  early. Nothing plays out over time yet (text renders in full instantly,
  no audio), so it's a no-op today — but it is now the ONE seam a future
  text-reveal animation or voice-over-stop call belongs in, so that future
  work is a one-method change rather than a re-audit of every input path
  (button, click-anywhere, keyboard, skip-all) that can end a line early.
- **`CompendiumScene`'s preview tab gains a second sample button** ("Show
  Sample (with a decision)") specifically to demonstrate the Skip button
  correctly disappearing when `hasDecision` is set on a line — otherwise
  that branch would ship with no way to see it working.
- Tests: 1021 → **1026** (+5, new `tests/dialogueSystem.test.ts`, covering
  `canSkipSequence`'s only real rule: false if a decision line exists
  anywhere in the sequence, true otherwise, including single-line edge
  cases). Typecheck, all 1026 tests, and the production build all pass
  (112 modules, up from 111 — the new `DialogueSystem.ts`). `npm run dev`
  serves HTTP 200.
- **Not built this pass, and why**: no actual per-line text-reveal
  animation or voice-over audio — Kevin flagged these as a LATER addition
  ("we might add voice-over audio later"), not asked for now; this session
  builds the interrupt seam they'll need, not the features themselves. No
  keyboard shortcut for "skip the whole sequence" (button-only, on
  purpose — an accidental keypress skipping an entire story beat is a
  worse failure mode than a slightly less convenient click).

### D-121 — A basic-attack lunge, the first tween-based ATTACK animation

D-120's handoff had answered an open question about how spellcasting/
attack/movement animations would eventually get built (Phaser Tweens
against an existing token or a temporary Graphics shape, the same
technique the Cape of Billowing already uses), but explicitly left it
unbuilt, recommending Kevin pick ONE concrete animation to prototype rather
than a speculative generic "animation system." This session, Kevin asked
to start on "the tween animation things"; offered a choice of which
concrete animation to build first (basic-attack lunge, spell-cast flash,
or a death/defeat animation), he picked the basic-attack lunge.

- **`BattleScene.lungeToward(token, from, to)`** (new, private): nudges a
  token's circle/label/hp-text/sprite a short distance (28% of a tile) from
  its own position toward a target tile and springs back, via one `yoyo`
  tween — a relative displacement (`x: '+=N'`/`y: '+=N'`), not an absolute
  position write, so it works regardless of the token's actual current
  position or in-flight movement tweens. Respects the existing
  `scaledDuration`/reduced-motion setting exactly like every other tween in
  this scene (Instant speed skips the lunge outright; the hit-flash alone
  still reads as feedback).
- **Wired into both existing directions a basic attack already flashes a
  tile for** — `tryBasicAttack` (a hero swinging at an enemy) and
  `showEnemyAttack` (an enemy swinging at a hero) — one call each, right
  where the attacker/target pair is already known. Not wired into Extra
  Attack's second/third swing, the off-hand attack, Cleave's second target,
  or any spell/ability attack this pass — this is deliberately the first
  concrete instance, not a sweep of every attack call site.
- Tests: unchanged at **1026** — pure Phaser presentation code (a tween),
  no new pure logic to test, same standing limitation as `moveEnemyToken`/
  `flashTile`. Typecheck, all 1026 tests, and the production build all pass
  (112 modules, unchanged — no new source files). `npm run dev` serves HTTP
  200.
- **Not built this pass, and why**: no lunge on Extra Attack's extra swings,
  the off-hand attack, Cleave's second target, or any ability/spell attack
  — Kevin picked ONE animation to prototype; generalizing to every attack
  call site is a natural follow-up once this one is confirmed in-browser,
  not before. No spell-cast flash or death/defeat animation — those were
  the other two options offered, not chosen this pass.

### D-122 — Spell-cast and death animations for every castable spell, via a data-driven shape+color library rather than 198 bespoke implementations

Right after D-121's basic-attack lunge, Kevin asked to build "a whole host of spell casting animations and death animations," explicitly wanting every spell to feel unique when cast, no two the same. With ~198 castable spells/abilities, literally hand-authoring 198 bespoke animations isn't realistic in any session — three scoping questions surfaced before any code, all answered toward the data-driven mechanism: (1) a shared library of shapes/colors with per-ability hashed variation, not bespoke-per-spell; (2) wire ALL ~198 castable abilities this session, not a first slice; (3) death animations vary by CAUSE (burn/frost/poison/necrotic/radiant/lightning/physical/arcane), not one universal treatment.

- **`systems/VisualFxSystem.ts`** (new, pure, tested): the whole selection mechanism, no Phaser import.
  - **Shape** is picked STRUCTURALLY from an `AbilityDefinition`'s own real mechanical fields (`teleportSelf`→blink, `summonsId`→conjureCircle, `altersTerrainId`→groundRune, `areaAllies`→radiantPulse, `targetsAlly`→sparkleRise, `forcedMoveTiles`→gustCone, `kind: "aoeAtRange"`→novaBurst, `kind: "aoeAdjacent"`→ringPulse, `savingThrow`→fallingJudgment, `autoHit`→homingOrb, else→bolt) — this is a real fact about the ability, not a guess, checked in that priority order (e.g. Thunderwave's `forcedMoveTiles` wins over its own `aoeAtRange` kind, since the shove read matters more than the blast shape).
  - **Color** comes from a best-effort keyword match against the ability's own name/description text (fire/frost/lightning/poison/necrotic/radiant/psychic/force/shadow/water/earth — 11 tags, checked in a fixed priority order with radiant checked before fire specifically so "Sacred Flame" reads radiant-gold, not fire-orange, despite mentioning "flame"), falling back to the ability's real SRD `school` (evocation/necromancy/etc., resolved via a reverse index built from `data/spells.ts`'s `abilityId` links) when no keyword matches, and finally to a generic arcane purple for a mundane hero ability with neither (Cleave, Piercing Shot). **This keyword match is a cosmetic guess, not verified SRD damage-typing** — this game has no damage-type field on spells anywhere; documented plainly in the module's own comment rather than presented as researched content.
  - **Secondary variation** (particle count 3/5/7, size 0.85-1.25x, rotation direction, duration 0.85-1.15x) comes from a deterministic hash of the ability's own id — NOT `Math.random()`/`RandomService` (this is cosmetic and needs to be exactly reproducible, not a gameplay roll). The combinatorics (11 shapes × ~12 colors × the hash space) comfortably exceed 198 without any two spells being hand-tuned.
  - **`DeathCause`** (8 values: physical/fire/frost/poison/necrotic/radiant/lightning/arcane) reuses the exact same keyword inference, collapsed from the richer color palette down to 8 causes — `Enemy.lastDeathCause?: DeathCause`, a new same-tick-only field (not persisted in `EnemySnapshot` — it has no meaning outside the instant of a kill), is set by whichever cast/status code just dealt the killing blow (`applyHeroResults`'s new optional `deathCause` param covers castAbilityOn/onAbilityButton's Cleave path/both aoeAtRange/aoeAdjacent branches; `castSavingThrowAbilityOn` and `castAoeAtRangeSpell`'s saving-throw branch tag directly; a burning status tick tags "fire"). Left unset (defaulting to "physical") for every ordinary weapon/off-hand/Cleave-second-target/trap/explosion kill — correct behavior, not a gap, since those really are mundane.
- **`BattleScene.playCastVisual(ability, casterPos, focusPos)`** (new): dispatches on the descriptor's shape into one of 11 small Phaser draw methods (bolt, homingOrb, fallingJudgment, novaBurst/ringPulse/radiantPulse/conjureCircle via a shared `spawnRing` helper, gustCone, sparkleRise via `spawnDriftMotes`, groundRune, blink) — all Graphics/Arc/Rectangle shapes animated with Tweens, the same technique Phase 22's Cape of Billowing and D-121's lunge already use, since this environment has no image-generation tool. Wired into all 10 real cast call sites: `castAbilityOn`, `castSavingThrowAbilityOn`, `castHealSpellOn`, `castAreaAllySpell`, `castAoeAtRangeSpell`, `castAoeAdjacentSpell`, `onAbilityButton`'s duplicate Cleave-style immediate-cast path, `castTeleportSelfSpell`, `castSummonSpell`, `castTerrainSpell` — every way this game ever resolves a spell/ability cast. Respects `scaledDuration`/reduced-motion exactly like every other tween in this scene.
- **`BattleScene.playEnemyDeathVisual(enemy)`** (new): replaces the old INSTANT token removal on a real kill (not a breach — an enemy reaching the exit still uses its own unchanged breach flash) with a brief squash-and-fade on the token itself plus a cause-specific flourish (`playDeathFlourish`, dispatching into the same `spawnRing`/`spawnBurstMotes`/`spawnDriftMotes` primitives the casts use — collapse/emberFade/shatter/dissolve/wither/radiantBurst/sparkCrackle/arcaneFade, one shape per `DeathCause`). Miniboss/boss/legendary tiers get a 1.5x bigger, slower version, mirroring the existing boss-token-size precedent. `awardKillGold`'s loop now calls this instead of the raw `destroyEnemyToken`.
- Tests: 1026 → **1036** (+10, new `tests/visualFxSystem.test.ts` — shape selection against real ability fixtures including the Thunderwave/Sacred-Flame priority-order edge cases, determinism, color distinctness, death-cause mapping, and a "never throws for any real ability, every descriptor field stays in range" sweep). Typecheck, all 1036 tests, and the production build all pass (113 modules, up from 112 — the new `VisualFxSystem.ts`). `npm run dev` serves HTTP 200.
- **Not built this pass, and why**: no per-spell hand-authored bespoke animation — the whole point of this session's scoping question was that 198 of those isn't realistic; the data-driven library is the deliverable. No damage-type field added to `AbilityDefinition`/`SpellDefinition` — the keyword inference stays a cosmetic-only guess layered on top of existing name/description text, not a new verified mechanical field (would be a much bigger, separately-scoped content-verification pass). No lunge/cast-visual overlap resolution for Extra Attack's second/third swing or the off-hand attack — those still play only the basic-attack lunge (D-121), unchanged, since they're mundane attacks, not spell casts.

### D-123 — A shared fantasy/parchment UI theme for Main Menu, Compendium, and Bestiary; ornate buttons with real hover/click feedback; a Bestiary pagination gap found and fixed; the reported spellbook/level-up "bugs" investigated, no code defect found

Kevin said the game "is in a bad spot" visually and asked to "spruce it up quite a bit" — specifically the Main Menu (reorganized for a "more professional look," on-brand with the D&D style), the Compendium/Bestiary (same pass), with real hover/click feedback on every button, explicitly inviting as much time/effort as it takes ("I don't really care how long it takes, I just want this to look amazing"). The same message also reported two playtest findings: couldn't find how to access a spellbook to test spell-cast animations, and never saw a level-up choice prompt. Per Kevin's own instruction, this session covered ONLY Main Menu + Compendium + Bestiary — `BattleScene`'s HUD (where the spellbook/level-up prompts actually live) is explicitly carried forward for a later pass, not touched here.

- **`scenes/uiTheme.ts`** (new, Phaser-dependent presentation code, same "shared renderer, not duplicated per scene" precedent as `dialogueBox.ts`):
  - **Two Google Fonts** — Cinzel (display/headline) and EB Garamond (body/button), both SIL Open Font License 1.1 — loaded via a `<link>` in `index.html` (see `CONTENT_SOURCES.md`). Every `fontFamily` string lists a real serif fallback first, so an offline/CDN-unreachable load still renders readable serif text, not a jarring mismatch. `BootScene` now waits (capped at 1.5s) for `document.fonts.ready` before starting `MainMenuScene`, since Phaser doesn't re-layout Text objects rendered against a fallback font once the real one finishes loading later.
  - **`createOrnateButton`**: a carved-wood-and-bronze plaque button (`Graphics`, not a plain `Rectangle`) with idle/hover/pressed/disabled/selected states, corner diamond accents, a hover brighten+lift tween, and a press-down "click" tween — the exact hover/click feedback every existing button in this project lacked (a plain `add.rectangle().setStrokeStyle()` with only a flat `setFillStyle` swap on `pointerover`). Four size variants (primary/secondary/tool/tab) cover everything from the Main Menu's hero button down to Compendium's 10-wide category tab row.
  - **`drawScreenBackdrop`**: a wood/stone gradient + vignette + double gold/bronze frame with corner diamonds, replacing every restyled scene's old flat `setBackgroundColor("#0e0e14")`.
  - **`drawParchmentPanel`**: the same base-fill + aged-mottling + double-border technique `dialogueBox.ts` established for its fixed 900x280 dialogue box, generalized to an arbitrary rectangle for Compendium's detail-text pane and Bestiary's roster pane.
  - **`spawnAmbientMotes`**, **`createSectionLabel`**, **`centeredRowX`** (a shared version of the centering arithmetic `CompendiumScene` had already hand-rolled three times).
  - New `COLORS` entries in `config.ts` (menu background/vignette/wood-panel/bronze/gilt/ink tones) — deliberately separate from the existing battle-board palette (tileFloor, hero, enemy, etc.), which is untouched.
- **`MainMenuScene.ts`** rewritten: the old flat vertical stack of 5 identical buttons plus 6 more scattered across the corners is now grouped by purpose — one hero action ("New Game"), a "Continue Your Journey" row (Load Game/Campaigns/Free Play/Co-op), a "Know Your Foe" row (Compendium/Bestiary), and a visually quieter "Creator Tools" row (Map Builder/Browse Shared Maps) — plus a drawn tower-and-shield crest, drifting ember motes, and a version tag. Every `scene.start` target and keyboard shortcut (Enter/Space → character creation) is unchanged.
- **`CompendiumScene.ts`/`BestiaryScene.ts`** restyled onto the same theme — tabs, sub-selectors, and pagination controls now use `createOrnateButton`; the detail text renders inside a parchment panel in ink-on-parchment color. Zero data/lookup-logic changes; every category, filter, and page computation is byte-for-byte the same as before.
- **A real pre-existing gap found and fixed while restyling Bestiary, not part of the original ask**: the enemy roster grew from a handful of entries at this scene's Phase 11.6 debut to 94 by Phase 25, but this screen never gained pagination — the old flat, unpaginated text block had been silently overflowing well past the bottom of the canvas for many phases (see KI-079). Fixed with the same Prev/Next paging `CompendiumScene` already established, applied to a flattened, role-grouped enemy list.
- **The reported spellbook/level-up issues, investigated (no browser available, so this is a code read, not a repro), found no code defect**:
  - **Spellbook access**: `BattleScene.onAbilityButton` already branches on `isCasterHero(hero)` (any hero with a non-empty `knownSpellAbilityIds()` — Wizard/Cleric/Bard/Druid/Sorcerer/Warlock) into `setInteraction({ kind: "choosingSpell", ... })`, and `showAbilityButtonFor` already labels the button "Cast a Spell (Q)" for exactly those heroes (`showAbilityButtonFor`/`onAbilityButton`, `BattleScene.ts`). The mechanism is real and wired; the likely explanation is that the button is easy to miss in the current HUD's visual noise (the exact kind of problem this session's restyle doesn't yet reach — `BattleScene` is explicitly out of scope this pass) or that Kevin's test party had no caster hero selected. Needs Kevin's own confirmation of which class he built and whether he selected it before pressing Q/looking for the button.
  - **Level-up choices**: `afterWaveCleared`/`applyClassLevelUps`/`showAsiChoiceQueue`/`showSubclassChoiceQueue` (`BattleScene.ts`) are all correctly wired — every hero gains a real class level every `LEVEL_UP_WAVE_INTERVAL` (2) waves cleared, but a CHOICE popup only appears at a level that grants an Ability Score Improvement (level 4 for most classes, i.e. wave 6+) or a subclass pick IN BATTLE (levels 1-3 depending on class — Cleric/Sorcerer/Warlock pick their subclass at character creation instead, so those three classes never show an in-battle subclass popup at all, by design). A short playtest (fewer than 6 waves) or an all-Cleric/Sorcerer/Warlock party would see ordinary level-ups (logged as plain text, "`<Hero>` reaches level N!") but no choice popup — this matches Kevin's report exactly and is the most likely explanation, not a defect. Needs Kevin's own confirmation of how many waves he reached and which classes he used; if he reaches wave 6+ with a non-Cleric/Sorcerer/Warlock party and still sees no ASI popup, that would be a real, reproducible bug worth a dedicated follow-up session with exact repro steps.
- Tests: unchanged at **1036** — pure presentation code (fonts, colors, Graphics drawing, button feedback), no new pure logic to test, same standing limitation as every other Phaser-scene-only visual change in this project. Typecheck, all 1036 tests, and the production build all pass (114 modules, up from 113 — the new `uiTheme.ts`). `npm run dev` serves HTTP 200 (checked this session).
- **Not built this pass, and why**: `BattleScene`'s HUD, `CharacterCreationScene`, and every other scene are UNCHANGED — Kevin's own instruction was to start with Main Menu + Compendium/Bestiary only, with the same branding explicitly planned to carry through the rest of the game later, not this session. No actual code fix for the spellbook/level-up reports, since no code defect was found — see above; a genuine fix needs a genuine repro first.

### D-124 — A batch of stale-blocking-reason class/subclass features wired real, plus two small new systems (a "frightened" status, a generalized reaction slot)

Kevin asked to work on the large "class features still listed as inert" backlog. An audit of every `mechanicallyActive: false` feature in `data/classes.ts`/`data/subclasses.ts` found ~30-40 whose STATED blocking reason ("no saving-throw system," "no rest/resource pool," "no Advantage/Disadvantage," "diceless combat") was now STALE — those systems were built in later phases (D-086, D-088, D-090, D-092) for other features and simply never looped back. Offered Kevin a choice of scope (the stale bucket alone / stale bucket plus 1-2 new small systems / see the full list first); he chose "stale bucket plus 1-2 new small systems." Two new systems were picked for maximum reuse and a real, immediate consumer (explicitly avoiding new scaffolding with nothing to exercise it, per prior feedback): a **"frightened" status effect** (reuses the exact `attackRollDisadvantage` shape "blinded"/"sapped"/"toppled" already established) and a **generalized reaction slot** (Uncanny Dodge's reaction previously only ever reduced the reactor's own damage; this extends the same slot to also drive a counter-attack or a retroactive damage reduction).

**Wired real (stale-bucket, reusing Saving Throws/Advantage-Disadvantage/Rest pools):**
- **Fighter's Indomitable** (levels 9/13/17, 1/2/3 uses): reroll a failed forced saving throw, refilling only on a Long Rest. New `Combatant.rerollFailedSave?(): boolean` (auto-applied, no interrupt-prompt UI — same precedent as Uncanny Dodge/Lucky) and `SavingThrowSystem.applySaveOrDamage`'s new `rerollFailedSave` option: on a failed save, offers the target one reroll; if accepted, the NEW roll replaces the first outright (even if worse), matching the SRD's "you must use the new roll" wording.
- **Barbarian's Danger Sense** (level 2+): Advantage on every forced saving throw. New `Combatant.savingThrowAdvantage?: AdvantageMode`, read by `WaveSystem.resolveSavingThrowAttack`. Every forced save a hero faces today rolls DEX, matching Danger Sense's real scope exactly — no per-ability generalization needed.
- **Rogue's and Monk's Evasion** (level 7 each): a failed forced save now deals HALF damage instead of full (a successful one already took 0, unchanged). New `Combatant.evasionHalvesFailedSave?: boolean` + `SavingThrowSystem.applySaveOrDamage`'s new `halveOnFail` option.
- **Rogue's Elusive** (level 18+): no attack roll against this hero may have Advantage while it isn't incapacitated (an ambush/blinded-attacker Advantage downgrades to Normal; a Disadvantage source is untouched). New `Combatant.deniesAttackerAdvantage?(): boolean`, consumed in `WaveSystem`'s single-target enemy-attack branch only (the AoE branch computes one shared `advantage` for potentially several heroes at once and was left alone — a documented, deliberate scope limit, not a gap).
- **Life Domain's Domain Spells and The Fiend's Expanded Spell List**: new `subclassGrantedSpellIdsUpToLevel` (`data/subclasses.ts`) + `Hero.subclassGrantedSpellAbilityIds`, gated to a class that has a real SPELLBOOK (`knownSpellIdsForClass(...).length > 0` — NOT `classDef.spellcasting`, which Paladin also carries for Divine Smite's slot pool despite having no spellbook at all; an early version of this gate wrongly let Oath of Devotion's spells leak into a Paladin's `knownSpellAbilityIds()`, caught by a failing test before merge). **The Fiend's five tiers are genuinely new** — none of its ten granted spells were already on `WARLOCK_LEVELED_SPELL_IDS`, confirmed by a dedicated test. **Life Domain's five tiers stay inert** despite the mechanism working correctly: every one of its eight nameable spells (bar Revivify/Raise Dead, still no `abilityId` at all — no resurrection mechanic exists) turned out to ALREADY be part of `CLERIC_LEVELED_SPELL_IDS` — Phase 15/16 gave every full caster comprehensive access to its whole SRD list, so a Life Domain Cleric's spellbook is byte-for-byte identical to any other domain's. This was ALSO only caught by a failing test (`... to not include 'bless'`) — the original plan had assumed adding these ids would matter without checking the base list first. Oath of Devotion's Oath Spells stay inert for the original, unrelated, still-true reason (Paladin has no spellbook in this game at all).

**Two new small systems, plus what they unlocked:**
- **"frightened" status** (`data/statusEffects.ts`): identical shape to "blinded"/"sapped"/"toppled" (`attackRollDisadvantage: true`). Flows hero-to-enemy only today — nothing inflicts it on a hero, so Mindless Rage/Countercharm/Aura of Courage/Stillness of Mind (all about RESISTING fear) stay inert for a real, narrower reason than before ("nothing to resist yet," not "no fear status exists") — deliberately not force-activated, since granting immunity to an effect nothing can inflict would be dead scaffolding.
  - **Path of the Berserker's Intimidating Presence** (level 10+): a landed basic-attack hit also frightens the target on a failed save — simplified from the SRD's real stand-alone action to a rider on an already-resolved hit, the same auto-apply precedent Grappler's restrain (D-109) established. `BattleScene.applyIntimidatingPresence`.
- **Generalized reaction slot** (the existing `Hero.reactionAvailable` boolean, previously spent only by Uncanny Dodge's damage-halving):
  - **Path of the Berserker's Retaliation** (level 14+): a hero that takes damage from an ADJACENT attacker immediately strikes back for its own basic-attack damage, spending its reaction — the first reaction in this game to swing back rather than just reduce damage. `BattleScene.applyRetaliations`, called alongside `applyUncannyDodges`/`applyDamageResistanceBuffs`; a Retaliation kill needs no special handling since `removeDefeated()`/`resolveDeaths()` already funnel through every enemy-removal cause generically.
  - **College of Lore's Cutting Words** (level 3+): spends the BARD's own reaction (not the target's) plus a Bardic Inspiration use to weaken a landed blow against any ally by a flat amount (`BARDIC_INSPIRATION_BONUS`) — reimagined from the SRD's real pre-roll modification (this game's attack rolls already happened by the time a reaction fires) into a retroactive reduction, the same shape Uncanny Dodge's own reaction already uses. New `Hero.bardicInspirationUsesAvailable` getter (mirrors `luckyPointsAvailable`) so `BattleScene` can find an eligible Bard without a bonus-action check. `BattleScene.applyCuttingWords`.

**Deliberately deferred, and why** (kept out of scope to preserve quality rather than spreading thin across ~40 items):
- **Wizard's Spell Mastery/Signature Spells, Warlock's Mystic Arcanum**: the spell-slot resource these need now exists, but a real hookup needs a player-chosen spell PICKER (reusing Magic Initiate's list-picker precedent) — new UI work, not just a data/getter change. A future session's job.
- **Cleric's/Paladin's Channel Divinity family (Preserve Life, Sacred Weapon, Turn the Unholy)**: Preserve Life specifically needs a real AoE-ally-heal targeting mode (this game's healing is single-target only) — a new system, not a wiring job. Sacred Weapon/Turn the Unholy are additionally blocked on Paladin never having its own Channel-Divinity-style resource pool.
- **The hero-side stealth mirror** (Rogue's Blindsense, Thief's Supreme Sneak, Ranger's Hide in Plain Sight/Vanish/Feral Senses, Monk's Empty Body): the enemy-side hidden/reveal pattern (`Enemy.isRevealed`, D-111) is a proven template to port, but touches enemy-AI targeting broadly enough to deserve its own scoped session.
- **Barbarian's Reckless Attack**: needs a real per-turn player TOGGLE (Advantage on your own attack in exchange for Advantage to every attack against you until your next turn) — new UI, not a data change.
- **Rogue's Slippery Mind/Monk's Diamond Soul** (extra saving-throw proficiencies beyond DEX): every forced save a hero faces today is DEX-only, so proficiency in another ability score has nothing to spend it on yet — would be dead scaffolding until a non-DEX forced save exists.
- **Skill proficiency + checks** (Rogue's Expertise/Reliable Talent, Bard's Jack of All Trades, College of Lore's Bonus Proficiencies/Peerless Skill, etc.): this game has ZERO skill-challenge moments anywhere on the battlefield — building proficiency tracking with nothing to roll a check against would be exactly the kind of scaffolding-with-nothing-to-look-at prior feedback said to avoid.
- **Damage-type resistance/immunity, fear/charm inflicted ON a hero, initiative actually driving turn order, disease/exhaustion, Wild Shape as a real transformation**, and a long tail of one-off mechanics (reaction-triggered roll-modification beyond Cutting Words, object interaction, terrain-cost exemptions, etc.) — each is a genuinely new subsystem with no existing partial implementation to reuse, not a wiring job.

Tests: **1088**, up from 1039 (49 new — `tests/d124Features.test.ts` (new file, Hero-level pure getters), plus extensions to `tests/combat.test.ts` (WaveSystem-level saving-throw/advantage hookups via `vi.spyOn(random, "rollD20With")`, the same technique `tests/statusEffects.test.ts`'s blinded/sapped/toppled tests already established), `tests/savingThrowSystem.test.ts` (the two new pure options), `tests/statusEffects.test.ts` (frightened bookkeeping), `tests/subclasses.test.ts` (the new helper + every flipped `mechanicallyActive` flag), and `tests/characterSystem.test.ts` (Fighter/Rogue active-feature-list updates). Every BattleScene-only hookup (`applyIntimidatingPresence`/`applyRetaliations`/`applyCuttingWords`) is NOT unit-tested, the same standing Phaser limitation `actionEconomy.test.ts` already documents for Uncanny Dodge's own auto-apply. Typecheck, all 1088 tests, and the production build all pass (114 modules, unchanged — no new source files besides the one new test file).

### D-125 — Five more deferred-from-D-124 slices: Reckless Attack, Preserve Life, skill checks + hero stealth, and a spell-mastery picker UI

Kevin asked two clarifying questions about the spell-known/prepared model (both answered from existing code, no change needed — see this session's chat), then asked to tackle five items straight off D-124's own "deliberately deferred" list: Wizard's Spell Mastery/Signature Spells + Warlock's Mystic Arcanum, Cleric's Channel Divinity: Preserve Life ("the AoE heal"), a hero-side stealth mirror, Barbarian's Reckless Attack, and skill proficiency/checks. Planned via `EnterPlanMode` before writing code (a genuinely large, multi-system batch); the plan's own first draft dropped the spell-mastery-picker slice entirely, caught and added back (as Slice 5) before implementation began. Built as five separately-tested slices, verifying typecheck/tests/build after each.

**Two of D-124's stated blockers turned out to be STALE, the same pattern D-124 itself found for Life Domain** — investigated fresh rather than taken on faith:
- Wizard/Warlock's "the spell-slot economy only goes to 1st-level slots" was simply wrong — `FULL_CASTER_SPELL_SLOTS_BY_LEVEL` already reaches 9th-level slots by character level 20 (`classes.ts`).
- Preserve Life's "this game's healing only ever targets ONE ally" was also wrong — `BattleScene.castAreaAllySpell` (built in Phase 16, D-106) already heals every living ally at once for real `areaAllies` spells; Preserve Life just needed its own Channel-Divinity-style resource instead of a spell slot.

**Slice 1 — Barbarian's Reckless Attack** (level 2+): a free per-turn toggle (no action/bonus-action cost) — `Hero.activateRecklessAttack()`/`recklessAttackAdvantage` grants Advantage on this hero's own attacks (`BattleScene.attackProfileFor`); the same flag doubles as `Combatant.grantsAttackerAdvantage`, a new optional `CombatSystem.Combatant` member consumed in `WaveSystem`'s single-target enemy-attack branch (folded in before the existing D-124 Elusive check, so Elusive can still deny it). Cleared inside `Hero.resetForNewTurn()` alongside the game's other once-per-turn flags — this game's "turn" is one whole player phase, so that's the correct "until the start of your next turn" moment.

**Slice 2 — Cleric's Channel Divinity: Preserve Life** (Life Domain only, level 2+): a new `channelDivinityUsesRemaining` resource (1/2/3 uses at levels 2/6/18, mirroring Indomitable's own by-level lookup shape), recharging on a Short OR Long Rest (the SRD's real cadence). `Hero.usePreserveLife(allies)` heals up to 5 living allies for `9 + classLevel` HP each (`9` matches Cure Wounds' own flat approximation of "2d8" elsewhere in this project), capped so no ally exceeds half its own max HP (the real SRD rule) — pure Hero-level math, no Phaser. Gated to the Life Domain subclass specifically, not every Cleric (Preserve Life is Life Domain's own named Channel Divinity option in the SRD).

**Slice 3 — Skill proficiency + a real Stealth check** (the foundation Slice 4 needed): `data/skills.ts` gained `SKILL_PROFICIENCIES_BY_CLASS` (a representative subset of each class's real SRD skill options, filtered to this file's existing slim 8-skill `SKILL_ORDER`) and `skillCheckModifier` (the exact `CharacterSystem.savingThrowBonus` formula — ability modifier + proficiency bonus if proficient — applied to skills). New `systems/SkillCheckSystem.ts` (pure, mirrors `SavingThrowSystem`'s shape) — deliberately WITHOUT a saving throw's natural-20/1 auto-succeed/fail carve-out, since the SRD doesn't give plain ability checks that rule. Built specifically as Slice 4's real consumer, not bare scaffolding — this was the item D-124 (and Phase 13.5/D-090 before it) explicitly deferred for lack of one.

**Slice 4 — Hero-side stealth**: `Hero.isHidden`/`.hide()`/`.reveal()` mirrors `Enemy.isRevealed` (D-111) inverted. Real consumers: **Monk's Empty Body** (level 18+, spends this hero's WHOLE Ki pool and the action — the SRD's real 4-Ki cost exceeds this game's flat 3-per-rest simplified pool, so "everything you have" stands in for it — hides outright, no check); **Ranger's Vanish** (level 14+, a bonus action attempting a Stealth check) and **Rogue's Cunning Action: Hide** (level 2+, same check, added because Supreme Sneak below needs a REAL Rogue-side hide action to modify, not just Ranger's) both funnel through one shared `BattleScene.attemptHide` roll; **Ranger's Hide in Plain Sight** (level 10+, a flat +10 while stationary) and **Thief's Supreme Sneak** (Advantage while stationary) are auto-applied inside `Hero.stealthCheckModifier`/`.stealthCheckAdvantage`. The DC itself is a flat, documented table by the board's highest-role living enemy (minion 10/miniboss 13/boss 16/legendary 19) — enemies have no ability scores to derive a real passive Perception from, the same "enemies are data" boundary this project draws elsewhere. Consumed by filtering a hidden hero out of `heroTargets` before it reaches `WaveSystem.tickEnemyPhase` (`BattleScene`'s enemy-phase call site) — movement/pathfinding blocking is deliberately untouched, only targeting changes. A hidden hero is revealed the instant it makes a basic attack or casts any spell (8 separate BattleScene cast/attack-resolution call sites, not just one). **Rogue's Blindsense and Ranger's Feral Senses stay inert, with an honest, narrower reason**: those are the OPPOSITE direction (a hero detecting an enemy's hidden state), and `Enemy.isRevealed` is a single global flag per enemy instance, not per-observing-hero — a real, separate modeling change, not a one-line addition.

**Slice 5 — Wizard's Spell Mastery/Signature Spells, Warlock's Mystic Arcanum**: a ONE-TIME pick from a hero's own known-spell list, made the instant the feature is gained — closer in shape to the existing ASI/subclass level-up choice queues than to the spellbook's per-cast picker. New `showSpellPickChoiceQueue` (`BattleScene`) slots into the existing `afterWaveCleared` chain as subclass → ASI → spell-pick → rest, reusing `renderAsiPrompt`'s rendering exactly like the ASI/subclass queues already do. `Hero.chooseSpellMasterySpell`/`chooseSignatureSpells`/`chooseMysticArcanumSpell` record the pick(s); `Hero.canCastSpell`/`spendSpellSlotFor` check for a matching free-cast pick BEFORE falling through to a normal spell slot, the same short-circuit shape `hasMagicInitiateFreeUse` (Phase 18, D-109) already established. Spell Mastery (level 18+, any known spell of level 1-5) is unlimited, forever; Signature Spells (level 20+, exactly two known 3rd-level spells) each cast free once per Short OR Long Rest; Mystic Arcanum (Warlock levels 11/13/15/17 → spell tiers 6/7/8/9) casts free once per Long Rest ONLY — a real, meaningful cadence difference, not an oversight.

**A real interaction caught only by writing tests, not the original plan**: a Warlock's own Pact Magic slots fully refill on a Short Rest (a pre-existing, correct D-093 mechanic) — a naive Mystic Arcanum test that checked `canCastSpell` right after a Short Rest without re-draining real slots would have READ as "Mystic Arcanum wrongly recharged early," when the real slot pool refilling underneath it was masking the (correctly still-spent) Mystic Arcanum flag. Fixed in the test, not the code — flagged here since it's exactly the kind of interaction a future session touching either mechanic should know about.

Tests: **1088 → 1130** (42 new — a new `tests/d125Features.test.ts` (Hero-level pure getters/methods across all five slices), a new `tests/skillCheckSystem.test.ts`, new D-125 blocks in `tests/combat.test.ts` (WaveSystem-level `grantsAttackerAdvantage` Advantage hookup, same `vi.spyOn(random, "rollD20With")` technique D-124 established), and corrected pre-existing assertions in `tests/subclasses.test.ts` (Life Domain's active list, Thief's Supreme Sneak) and `tests/characterSystem.test.ts` (Wizard's active-feature list). Every BattleScene-only hookup (the five new HUD buttons/pickers, the 8 stealth-reveal call sites) is NOT unit-tested, the same standing Phaser limitation D-124 already documents. Typecheck, all 1130 tests, and the production build all pass (115 modules, up from 114 — the new `SkillCheckSystem.ts`).

**Deliberately deferred, and why**: Rogue's Blindsense/Ranger's Feral Senses (see Slice 4's own note above); Rogue's Slippery Mind/Monk's Diamond Soul (every forced save is still DEX-only, so a non-DEX proficiency has nothing to spend it on); skill checks beyond the one real Stealth consumer built here (no other skill-challenge moment exists yet — building more checks with nothing to roll them against would be the same dead-scaffolding D-124 already flagged); enforcing a strict "one bonus action per turn" ACROSS the new class-action button and the existing bonus-action button (Vanish/Cunning-Action-Hide correctly share `bonusActed` with Hunter's Mark/Dash via the same flag, but Reckless Attack/Preserve Life/Empty Body don't consume either slot at all, by design, since none of the three are a bonus action in the SRD).

Content/license note: every feature name/mechanic here (Reckless Attack, Channel Divinity: Preserve Life, Vanish, Hide in Plain Sight, Empty Body, Supreme Sneak, Spell Mastery, Signature Spells, Mystic Arcanum) was already cited SRD content in the existing class/subclass tables from earlier phases — this session only added new mechanism/description prose, no new `CONTENT_SOURCES.md` entry needed.

### D-126 — A full UI-layout audit and fix: clashing/off-canvas boxes in Compendium, Map Builder, Free Play, Browse Shared Maps, and the core Battle HUD

Kevin reported "a lot of problems with clashing text boxes, boxes going over the edge of the screen" while gathering art assets, and asked for a full audit and fix — not a spot-fix of whatever he'd personally noticed. Since `BattleScene`'s own HUD restyle (carried forward since D-123) still hasn't happened and several menu screens' button rows are sized off data tables that have grown phase over phase, this was treated as a real, systemic sweep: a general-purpose agent read every scene file in full and computed bounding-box math (against `GAME_WIDTH`=1280/`GAME_HEIGHT`=1080, and every real map's actual row/column count) for every button row, grid, and text block whose size depends on a data table or dynamic content length, rather than guessing which screens might be affected. Every finding below was independently re-verified against the actual source (not taken on the audit's word) before fixing.

**Deterministic, every-visit bugs (no data dependence beyond an already-shipped roster) — all confirmed by re-deriving the exact arithmetic:**
- **`CompendiumScene`'s category tabs and class selector**: `centeredRowX` (`uiTheme.ts`) computed positions for the REQUESTED item width unconditionally. With `CATEGORIES` grown to 10 (categories added across several phases) and `CLASS_DEFINITIONS` grown to 12, the fixed 138px-per-item math produced a row 1434px/1744px wide on a 1280px canvas — the first and last button of each row rendered more than half off-canvas, on the Compendium's own default tab. Fixed at the shared helper: `centeredRowX` now takes an optional `maxWidth` (default `GAME_WIDTH - 80`) and shrinks item width evenly to fit instead of letting the row grow unbounded; every call site (`CompendiumScene`'s 4, `MainMenuScene`'s 3) now destructures the returned `{ xs, itemWidth }` and sizes its buttons off the (possibly shrunk) `itemWidth`, not the original request.
- **`MapBuilderScene`'s terrain palette** (the Terrain tab, shown by default on open): 8 swatches at a fixed 180px each totaled 1510px — same off-canvas failure, same root cause, hand-rolled rather than routed through `centeredRowX` before this fix. Now imports and uses `centeredRowX` from `uiTheme.ts` instead of its own unbounded math.
- **`FreePlayScene`'s map/boss picker labels**: `buildOptionRow` already shrinks the BUTTON width to fit `MAP_OPTIONS.length`/`BOSS_OPTIONS.length` (7/13, both grown well past the row's original 3-option design), but the LABEL text had no `wordWrap` (only the locked-hint text below it did) and stayed at a fixed 16px — a real map/boss name ("Cinderfall Rift (volcanic, collapsing bridge)", "The Hollow Empress") rendered far wider than its shrunk slot and visibly overlapped neighboring buttons. Fixed by adding `wordWrap` at the slot's own width and a width-scaled font size (16px down to 10px as the row gets more crowded) to the label.

**A real bug in the single most-used screen in the game — the core Battle HUD, verified against real data, not a synthetic worst case:**
- **`statusText`/`combatLogText` in `BattleScene.buildHud`**: `wrapWidth` was `this.map.cols * TILE_SIZE` — the GRID's own pixel width, not the canvas's — despite this exact spot's own prior comment claiming word-wrap already made a collision "impossible regardless of content length" (wrapping bounds line WIDTH, not the fixed 60px HEIGHT it was meant to protect). Computed against the real `refreshStatus` format (a full 4-hero party's status line plus the `heroSelected`/`equipping` hint) on Frostbound Hollow — the narrowest built-in map at 14 columns, which is ALSO the tallest at 9 rows — the status line already reaches ~4-5 wrapped lines in completely ordinary play (a hero simply selected, no item hover needed), bleeding into `combatLogText` directly below it. Fixed at the root: `wrapWidth` is now `GAME_WIDTH - 80`, independent of the grid's width (nothing else shares that row horizontally, so there was never a reason to tie the two together) — this alone drops the same real-data case back under the original 60px budget. `statusBlockHeight` was also bumped 60→78 as extra headroom, re-verified against the item-grid/Done-button bounding-box math in `buildShopHud` to confirm it still clears `GAME_HEIGHT` on Frostbound Hollow's 9 rows (1069px vs. 1080, an 11px margin — tight but real). `combatLogText` additionally gained its OWN `wordWrap` (it had none at all before this fix) — a single long combat-log line could previously render wider than the canvas and clip off both edges.
- **`BrowseSharedMapsScene`'s shared-map list**: rendered one row per FETCHED map, uncapped — `renderMapList` stacked rows at a fixed 44px each starting from `this.maps.length = 0` with no ceiling, so the list ran into the fixed Wave Count/Minion/Difficulty/Start sections below it once more than ~6 maps were loaded (`Load more` fetches 10 at a time, so this is a real, growing failure mode as more maps get published, not a hypothetical one — directly relevant given Kevin is actively building out map-sharing content this cycle). Fixed with a fixed local page size (`mapsPerPage = 5`) and its own Prev/Next pagination (matching the pattern `CompendiumScene`/Gear-and-Shop grids already use elsewhere in this project) — "Next" past the last locally-held page transparently triggers another remote fetch first.

**Investigated and deliberately left alone, with the reasoning recorded rather than silently dropped:**
- `BattleScene.renderAsiPrompt`'s title can overlap its own first button row ONLY once a level-up choice reaches 15+ simultaneous options — reachable only by the Epic Boon feat's ability-picker at character level 19+, which no run in this game currently reaches (10 waves max per run, nothing persists a hero's level between runs — the same standing gap Epic Boons already have per KI-066). Real by the math, not reachable in actual play as the game is scoped today.
- An aura-ring enemy's buff radius and the falling-judgment spell-cast VFX can both theoretically render a few pixels above the canvas top, but only for a spawn/target on row 0-1 — no built-in map places one there, and both are momentary, self-correcting cosmetic effects (a translucent ring, a falling mote), not persistent text/button clashes.
- Status badges on hero/enemy tokens were suspected as a stacking-overflow risk (poisoned+silenced+hidden+… all active at once) but turned out not to be — both hero and enemy status badges render as ONE Text object with every active status code concatenated into a single short string, not separate stacked boxes, so there is no overflow here regardless of how many statuses are simultaneously active.
- `MainMenuScene`'s three `centeredRowX`-based rows, `BestiaryScene`'s pagination (already correctly capped at 10/page against 94 real entries), `CharacterCreationScene`, `CoopLobbyScene`, `CampaignSelectScene`, `LoadGameScene`, and `dialogueBox.ts` were all read and found sound — none hand-rolls a fixed-width-times-dynamic-count row without either a cap or a shrink-to-fit already in place.

No test file changed (every fix here is Phaser-only presentation/layout code, the same standing "scene code isn't unit-tested" boundary every other visual-only fix in this project has — see KI-083 for the full manual-verification checklist). Typecheck, all 1130 tests, and the production build all pass unchanged (115 modules).

### D-127 — Four foundational systems closing long-documented "no system to hook into yet" gaps: nonmagical damage-type resistance, per-observer stealth detection, charge-based items, and ability-score-setting items

While Kevin was occupied with a browser playtest pass (see KI-083/082/etc.), he asked to close the four remaining "we'd need a whole new system for that" gaps documented across KI-069, KI-070, and KI-082 — Swarm's real SRD damage resistance, Rogue's Blindsense/Ranger's Feral Senses, ability-score-setting magic items (Gauntlets of Ogre Power/Headband of Intellect/Amulet of Health), and charge-based active items (wands/staves). Unlike most prior "inert feature" batches (D-124/D-125), these were genuinely missing architecture, not stale wiring — each got its own scoped design pass (see the approved plan) before implementation, sequenced by increasing risk, with `npm run typecheck`/`npm test`/`npm run build` re-run after each of the four before moving to the next.

**1. Nonmagical damage-type resistance** (closes half of KI-069, half of KI-070): research found this was cheaper than the KI text implied — `data/weapons.ts` already has a populated `DamageType` field (`"bludgeoning" | "piercing" | "slashing"`) per weapon, just never consumed for resistance. `CombatSystem.AttackProfile` gained optional `damageType`/`magical` fields; `Combatant` gained optional `damageResistances`; `CombatSystem.applyAttack` halves (rounded down) a landed hit when the target resists the attack's type and it isn't `magical`. `Enemy.damageResistances` reads `EnemyDefinition.damageResistances`, set to `["bludgeoning", "piercing", "slashing"]` on both Swarm enemies (Rat Swarm, Locust Swarm) — the exact real SRD trait. `Hero.attackDamageType` reads the equipped weapon's `damageType` (undefined with none equipped, so resistance never touches an unarmed/flat attack); `Hero.attackIsMagical` is true for an enchanted (+1/+2/+3) weapon or Boon of Irresistible Offense (`Hero.attacksIgnoreResistance`) — finally making that feat's "damage always ignores Resistance" half real, five phases after its crit-bonus half shipped inert-adjacent. Spell attacks never set a `damageType` at all, so spell damage is never resisted — matches the real trait's "nonmagical" scope without needing a damage-type field on all 318 spells (a deliberate, much narrower scope than a full damage-type system). Tests: `tests/combat.test.ts`'s new "CombatSystem damage-type resistance" block (5 cases: halved on match, unhalved when magical, unhalved when untyped, unhalved on non-matching type, unaffected non-resistant target).

**2. Per-observer stealth detection** (closes KI-082's Blindsense/Feral Senses): the existing stealth-enemy mechanic (`Enemy.isRevealed`, D-111) is a single global flag with no notion of "who's asking" — exactly the gap `data/classes.ts` flagged when D-125 built the hero-side mirror. `BattleScene.isEnemyTargetable` gained an optional `observerHero` parameter: the existing global-hidden check still applies to everyone, but a hero with `Hero.hasStealthSense` (Rogue 14+ or Ranger 18+, matching the SRD's real unlock levels already in `data/classes.ts`) within `STEALTH_SENSE_RANGE_TILES` (2, a "close, not board-wide" reading of the SRD's ~10ft — this project defines no feet-per-tile scale to convert precisely) can target that same still-hidden enemy anyway, with no effect on any other hero or the enemy AI's own targeting. All 4 real call sites (the AI candidate-list filter, the ability-aim click, the basic-attack click — reordered to look up the acting hero before the targetability check instead of after — and the spellbook-aim click) now pass the acting hero; the AI site passes its own hero too (more complete than the original plan's scope, since the hero was already in scope there for free). A Mimic's disguise gets no exception — Blindsense/Feral Senses are a stealth-specific sense, not a disguise-piercing one. Both class features flip to `mechanicallyActive: true`. Known, deliberate limit: only click-driven targeting is affected — the ENEMY TOKEN itself still renders as an anonymous "?" to every hero, including the one with stealth sense; a true per-observer visual would need the same enemy to render two different ways depending which hero is currently selected, a materially bigger scene-rendering change not attempted here. Tests: new `tests/d127Features.test.ts` covers `Hero.hasStealthSense`'s level gating (pure); `isEnemyTargetable`'s own logic is `BattleScene`-only and untested here, the same standing "scene code isn't unit-tested" limitation as Uncanny Dodge/Grappler.

**3. Charge-based items** (closes the other half of KI-070): modeled directly on the existing Magic Initiate pattern (a granted spell, castable independent of the hero's own spell slots, with a per-rest use counter) rather than inventing a new shape. `EquipmentDefinition.chargedSpell` (`{ spellId, maxCharges }`) grants a spell to ANY hero while equipped, even a non-caster (`Hero.knownSpellAbilityIds`); `Hero.itemChargesRemaining` (keyed by item id) is spent by `canCastSpell`/`spendSpellSlotFor`'s new `hasItemChargeFreeUse` branch, ahead of a normal spell-slot fallback, and fully refills on a Long Rest only — this project's existing simplified cadence for every other per-rest resource, not the real SRD's partial daily-recharge dice roll. `Hero.onGearChanged()` (a new public method, called at every equip/unequip mutation site in `BattleScene` alongside the existing `ensureHeroCape` side-effect call, plus once at battle start for a hero who started with one as free starting gear) initializes a newly-seen item's charge pool to full; charges persist across unequip/re-equip (real wands don't lose their charge when set down). Three real SRD items ship with the system rather than infrastructure alone: Wand of Magic Missile (7 charges), Wand of Web (6, attunement), Staff of Healing (10, attunement) — the spellbook overlay shows "N/M charges" instead of a spell-slot count for these. Tests: new "Charge-based items" block in `tests/equipment.test.ts` (grant-on-equip, spend-and-exhaust, unequip/re-equip charge persistence, Long Rest refill).

**4. Ability-score-setting items** (the other half of KI-070, and the one genuinely risky piece — flagged as such by this project's own prior scoping note): research found NO single seam reads a hero's ability scores — `maxHealth`/`attackDamage`/`attackBonus` are baked once and only recomputed at three specific call sites (`levelUpClass`/`improveAbilityScore`/`applyFeatAbilityBoost`), `baseArmorClass` was `readonly` and never recomputed at all (a real, separate pre-existing gap this closes as a side effect: a DEX Ability Score Improvement previously never raised AC without real armor equipped), while `spellSaveDC`/`savingThrowBonus` were already fully live. `Hero.effectiveAbilityScore`/`effectiveAbilityScores` (private) return the higher of a hero's raw score and an active `abilityScoreOverrides` entry — the real SRD rule ("sets your score to X; no effect if already X or higher"), NOT layered into the raw `abilityScoreValue()` the ASI-picker UI displays (a deliberate simplification — the picker shows the hero's true underlying score, matching the SRD's own "your score is still what it is" framing). The three existing recompute call sites were deduplicated into one `recomputeCombatStats(flatHpBonusesBefore)` (reusing `applyLeveledStats`'s existing HP-delta math verbatim, not duplicated) that now reads `effectiveAbilityScores()` instead of the raw field, plus a new `recomputeBaseArmorClass()` (`10 + effective DEX mod`, the exact formula `CharacterBuildSystem.heroDefinitionFromBuild` already used once at construction). `dexMod`/`strMod` (used by real-armor AC and real-weapon damage) and `spellSaveDC`/`savingThrowBonus`/`irresistibleOffenseBonusDamage` were all switched from the raw ability score to the effective one, so an override is respected everywhere a combat number is actually derived. `EquipmentDefinition.setsAbilityScore` (`{ ability, value }`) drives it; `Hero.onGearChanged()` (shared with charge items above) rebuilds `abilityScoreOverrides` from scratch on every equip/unequip change by scanning every gear slot — an unequip is handled for free, no incremental add/remove logic needed. Three real SRD items ship: Gauntlets of Ogre Power (STR 19, amulet slot), Headband of Intellect (INT 19, head slot), Amulet of Health (CON 19, amulet slot) — all `uncommon`/`rare`, requiring attunement. Tests: new "Ability-score-setting items" block in `tests/equipment.test.ts` (STR override raises attack damage and reverts exactly on unequip; no effect when the hero's own score is already 19+; CON override raises max HP with the HP delta applied to current health immediately, same as a level-up; INT override raises a caster's spell save DC).

**Deliberately out of scope for all four** (a documented boundary, not a gap to chase): damage-type resistance only ever applies to a real equipped weapon's attack, never a spell (no damage-type field exists on any of the 318 spells, and adding one was a separately-sized project not attempted here); Blindsense/Feral Senses only affect hero-initiated CLICK targeting, not the token's own visual disguise; only 3 charge items and 3 ability-score items ship, not the full real SRD families of either (matching every other "honest first pass" content batch this project has shipped); `abilityScoreValue()` (the ASI-picker's own display) intentionally does NOT reflect an item override.

Verification: `npm run typecheck`, `npm test`, and `npm run build` all pass after each of the four systems individually and again at the end — 1147/1147 tests (up from 1130), 115 modules (unchanged), no regressions. No browser available in this environment — every mechanic here joins the standing "not yet confirmed by Kevin" queue (see KI-084).

### D-128 — Three text-overflow bugs fixed from Kevin's next in-browser playtest report; gear-purchase and AC/damage-visibility findings reported, not yet acted on

Kevin's first real in-browser session against several of D-117-through-D-127's un-confirmed queue produced a fresh playtest report (not yet in `KNOWN_ISSUES.md` when this session started — captured here and in KI-085) mixing new bugs, direct questions, and several large feature requests. Three of the reported bugs were concrete, unambiguous overflow defects fixable without any design decision, so they were fixed immediately rather than held for a scope discussion; two other reports (gear purchase, AC/damage visibility) were investigated but intentionally left unfixed pending Kevin's input (see KI-085), and the large feature-request list was deliberately NOT started this session — it spans several independently large, novel systems (a debug/test mode, freeplay party setup, a level-by-level character-creation planner, a two-tier battle log, spell damage types, a level-up popup, game-speed options), too much to self-scope silently the way a same-shape content batch (D-124/125) could.

**Fixed — three text-overflow bugs:**
1. **`scenes/uiTheme.ts`'s `createOrnateButton`**: D-126's `centeredRowX` shrinks a crowded row's BOX to fit (10 Compendium category tabs, 12 class buttons), but the button's own label text never shrank to match — a normal-length label could still render wider than its own now-narrower box and spill into both neighbors. `createOrnateButton` (and its `setLabel`) now measure the label's real rendered width and shrink its font (floor 9px) until it fits `width - 10`, the same measure-then-shrink approach `BattleScene.fitBannerToWidth` (KI-033) already established, rather than guessing a smaller fixed size that breaks again the next time a category/class list grows.
2. **`scenes/FreePlayScene.ts`'s `buildOptionRow`**: the box height stayed a fixed 56px regardless of how many lines a name actually wrapped to (D-095/D-126's wordWrap fix contains horizontal bleed correctly, but never touched height) — with the boss row now at 13 options (a ~72px-wide, 10px-font tile), a long name could wrap to more lines than a 56px box has room for and spill into the locked-hint line below it. Every option's real wrapped height is now measured before the row is drawn; every button in the row grows to fit the tallest one needed.
3. **`scenes/CharacterCreationScene.ts`'s subclass-picker label**: never had any width-fitting logic at all (D-126 didn't touch this scene). The longer of its two possible messages ("Subclass: chosen in battle at level N (M options)") measured well past its own `COLUMN_WIDTH - 20` (270px) button at the fixed 13px it was built with. New `fitSubclassLabelToWidth` shrinks it the same measure-then-shrink way as fix #1 above (floor 9px).

**Investigated, not fixed — reported to Kevin for input:**
- **"Cannot purchase gear"**: traced the full click path (`handleEquipClick` → `equipGearOnHero`, `BattleScene.ts`) — `EconomySystem`, Phase 22's level-scaled shop gate, and the attunement/two-handed-grip gates all check out fine for a fresh level-1 party. Kevin confirmed he was on the classic `TEST_MAP` (which has zero shop tiles, so the proximity gate auto-passes there) — a SECOND, deeper re-investigation of that exact map found no bug candidate anywhere in the path: gold (`STARTING_GOLD = 20`), the level-1 mundane catalogue (`ShopSystem`'s `>=` threshold check), button wiring, and `Hero.onGearChanged()`'s D-127 additions all check out. High confidence nothing is broken; the likely remaining explanation is either normal turn-phase gating (Gear is disabled outside the player phase) or a discoverability issue (missed the "Gear (G)" button, or didn't click a hero after selecting an item) — still needs a more specific repro from Kevin (see KI-085) before concluding either way.
- **"How can I see AC and damage?"**: confirmed a real, honest gap, not a discoverability problem. `armorClass`/`effectiveAttackBonus`/`effectiveAttackDamage` are all computed live in `Hero.ts` and used internally for combat resolution, but the in-battle status line (`BattleScene.ts`) only ever displays name/level/HP/move-act flags/slot counts — never AC or damage. (Outside battle, `CompendiumScene` shows AC/attack for item DEFINITIONS and `BestiaryScene` shows an enemy's own HP/AC/ATK — neither shows a hero's own live totals anywhere.) Not added this session — the in-battle status line is already at its wrap-width limit per D-126/KI-083, so adding fields there needs the same care as the fixes above, not a quick unplanned append.

Verification: `npm run typecheck`, all 1147 tests, and `npm run build` (115 modules, unchanged) all pass. No new source files; no test file changed (all three fixes are Phaser-only presentation code, the same standing "scene code isn't unit-tested" boundary as every prior visual-only fix). Not yet confirmed by Kevin in a browser — see KI-085.

### D-129 — Free Play/New Game party setup: a settable Starting Level (per hero or as a whole team), defaulting to 1 human + 3 AI-controlled heroes

Of D-128/KI-085's large feature-request list, Kevin picked this as the top priority — directly solving his own stated pain point ("testing nightmares if I always start at level 1"). Research first established that `CharacterCreationScene` already covers most of what Kevin asked for (party size 1-4, per-slot human/AI toggle, custom naming — both "New Game" and Free Play route through this exact same scene, `FreePlayScene.ts:483-488`), so the genuinely new work was narrower than his framing suggested: a starting-level control, and a default-control-mix change.

- **A pre-battle level fast-forward, reusing `Hero.levelUpClass()` rather than reinventing leveling math**: `CharacterBuild.startingLevel`/`HeroDefinition.startingLevel` (both optional, undefined/1 = no change, every existing build/definition unaffected) carry a target level from party setup through to `BattleScene.buildHeroes()`, where a new `fastForwardHeroToLevel(hero, targetLevel)` calls `hero.levelUpClass()` in a loop (capped at `MAX_CLASS_LEVEL`, now exported from `Hero.ts`) right after the hero is constructed, before its first turn. Deliberately does NOT touch `CharacterBuild.level` (which stays 1) — that field seeds `heroDefinitionFromBuild`'s OWN base-stat computation (`combatStatsForClassLevel`), and `Hero`'s constructor treats a `HeroDefinition`'s stats as the level-1 starting point that `levelUpClass()`'s HP-delta math then builds on; setting `build.level` to the target directly would have double-counted the leveled stats instead of computing them once, cleanly.
- **Auto-resolves every level-up CHOICE silently, since no overlay exists at party-setup time**: reuses the exact same choice-detection this project's real in-battle leveling (`BattleScene.applyClassLevelUps`) already uses (`asiFeatureGrantedAtLevel`, `subclassGrantedAtLevel`, `needsSpellMasteryPick`/`needsSignatureSpellsPick`/`needsMysticArcanumPick`), but resolves each with a fixed, sane default instead of showing a picker: an Ability Score Improvement always raises the hero's own current-highest ability score by 2 (never "Take a Feat," which has no context-free default); a subclass choice always takes the class's first modeled option; a spell-mastery/signature-spells/Mystic-Arcanum pick always takes the first eligible spell(s). No combat-log line is written — there's no "reaches level N" story to tell for a hero that simply starts there.
- **Party-setup UI** (`CharacterCreationScene.ts`): a per-slot "Level: N" cycle button (1-20, wrapping, same interaction shape as every other cycle control in this scene) sits below the existing stats preview; a new "Team Level: N (all heroes)" button in the bottom-controls area sets every slot's level at once in a single click — Kevin's own "individually or as a team" framing, not an either/or choice (the team button is a quick group-set; any slot can still be fine-tuned afterward). The per-slot stats preview (HP/ATK) now reflects the chosen Starting Level via `combatStatsForClassLevel` re-run at that level (the same pure function `heroDefinitionFromBuild` itself calls), though it deliberately does NOT include the ASI bonus a real fast-forward applies, since ASI always targets "whichever ability is highest at the time" — something only the actual fast-forward can resolve, not a static preview.
- **Layout**: the per-slot column grew another 40px (height 530→570, center y 370→390, top edge held fixed at y105 — the same "grows downward" discipline as every prior row addition), and every row below the columns (`buildBottomControls` through `buildBackButton`) shifted down a consistent +90px (the new row's own height+gap) to avoid the exact kind of overlap D-128 just fixed elsewhere in this project.
- **Default control mix changed**: a fresh slot now defaults to `controlledBy: "human"` for slot 1 only, `"ai"` for slots 2-4 (previously all four defaulted to `"human"`) — Kevin's explicit request, so a fresh party is playtest-ready without manually toggling three slots first. Loading a saved party (`slotStateFromBuild`) is unaffected — it always uses whatever control mix was actually saved. `CharacterBuildSystem.defaultPartyBuilds` (Co-op's own fallback) was deliberately NOT touched — Co-op always overrides `controlledBy` per hero from its own session ownership map regardless (`BattleScene.buildHeroes`'s `coopSession` branch), so this default would have no effect there anyway.
- Tests: 1147 → **1148** (+1, `tests/characterBuildSystem.test.ts` — `startingLevel` passes through `heroDefinitionFromBuild` unchanged when absent, and correctly when set). `fastForwardHeroToLevel` itself is `BattleScene`-only Phaser code and untested here, the same standing limitation every other in-battle-only mechanic in this project has — everything PURE it reuses (`levelUpClass`, `improveAbilityScore`, `grantSubclass`, the three spell-pick methods) already has its own test coverage from the phases that built them.
- **Deliberately out of scope**: no UI exposes the auto-resolved choices for review/override (e.g. no way to pick WHICH ability an auto-applied ASI raises, or which subclass a fast-forwarded hero gets) — a materially bigger "expose every level's choice at party-setup time" feature, not what was asked for here. No change to Co-op's own default control mix. No feat option in the ASI auto-resolve (always raises an ability score) — a real, permanent simplification for the auto-fast-forward path specifically, not a change to real in-battle leveling.

Verification: `npm run typecheck`, all 1148 tests, and `npm run build` (115 modules, unchanged) all pass. No browser available in this environment — not yet confirmed by Kevin. See KI-085 for the in-browser checklist.

### D-130 — Gear-purchase UX clarified; a level-up popup; live Game Speed control; a two-tier (technical + plain) battle log

Kevin reported that gear purchase, once found, was "very unintuitive," and asked to continue down KI-085's remaining feature list. Rather than build a brand-new purchase-only inventory (which he explicitly declined once told it would need a first-ever stash system), and rather than build the three largest, most architecturally open-ended items blind (a debug/test mode, a level-by-level Character Creation planner, and spell damage types — held back for a design discussion, matching the D-070/D-078/D-113 precedent), this session picked off four smaller, well-scoped items he confirmed wanting done now, plus one bug investigation.

- **Gear-purchase UX (no new stash)**: the Gear grid's flow was always "select an item, click a hero to buy-and-equip it" — a real purchase, just never described as one. `BattleScene.refreshStatus`'s equip-mode hint now explicitly says "buy & equip" for gear and "buy & carry it (use later with P)" for potions, and names the exact gold cost in the sentence; the proximity-gate label changed from "Move a hero to a Shop tile to access Gear" to "...to buy/equip Gear." No inventory/stash was built — Kevin explicitly chose "clarify the existing flow" over a stash when asked.
- **"Tide map" build-restriction report — investigated, no bug found**: traced `GameMap.isWalkable`/`isBuildable`, `BuildSystem.canPlace`, `DynamicTerrainSystem.applyEvent`, and `BattleScene.tickDynamicTerrain`'s tile-recoloring for The Drowning Vale specifically. Every piece re-reads live tile data with no caching; sand's color (`0xc2a878`) is starkly different from floor's (`0x1a1a26`), ruling out a "looks the same" confusion; water tiles are buildable by design (only `sand` is excluded in `isBuildable`). The flood zone sits at cols 6-9, far outside `BUILD_RANGE_TILES` (3) from the hero-start column (0-1) — the most likely explanation is the ordinary proximity gate ("No hero is close enough to build here"), not a tide-specific defect. Needs a specific repro (which exact tile, whether a hero was actually in range) to go further — same "investigated, not diagnosed" outcome the gear-purchase report itself got in D-128.
- **A level-up popup (KI-079's gap)**: a hero whose level-up grants no ASI/subclass/spell-pick choice previously only got a `logCombat` line, no on-screen popup at all. `BattleScene.applyClassLevelUps` now also returns `plainHeroes` (every hero that leveled with no other choice), and `afterWaveCleared` queues a new `showLevelUpAckQueue` — one "`{hero}` reaches level `{N}`!" confirmation with a single Continue button per such hero, shown BEFORE the existing subclass → ASI → spell-pick → rest chain (a hero with a real choice still gets its own overlay, which already names its new level in its title, so it's never shown both). New state mirrors the existing `asiQueue`/`subclassQueue` shape exactly (`levelUpAckQueue`, `choosingLevelUpAck`, both wired into `inputLocked()`/`handleEscape`'s "no Esc shortcut" list). `BattleScene.fastForwardHeroToLevel` (D-129's silent pre-battle fast-forward) is untouched — it doesn't call `applyClassLevelUps`, so a Starting-Level hero still enters battle with no popup spam.
- **Game Speed, live and renamed**: the existing `animationSpeed` setting (Main Menu only, previously labeled "Animation") is now labeled "Game Speed" everywhere (`ANIMATION_SPEED_LABELS` moved from `MainMenuScene` into `SettingsSystem.ts` so both scenes share one copy) and can now be cycled DURING a battle with the "S" key (`BattleScene.cycleGameSpeed`), not just from the Main Menu before one starts — it persists to the same `localStorage` key immediately and logs a confirmation line. Two previously-fixed pacing pauses (`resolvePhase`'s 400ms, `betweenWave`'s 650ms) now also scale via the existing `scaledDuration`/`durationScaleFor` — before this, "Instant" zeroed every tween but these two waits stayed full-length, so the whole turn cadence never actually sped up the way the setting implied. The underlying `AnimationSpeed` type/storage key are unchanged (no migration needed).
- **A two-tier battle log**: Kevin's ask was additive, not a split of existing content — the existing `combatLogText`/`logCombat` (5-line HUD strip) already reads as the "plain-English" tier and is untouched. A new `technicalLog` array + `logTechnical()` capture the raw dice behind every attack/save roll (d20, bonus, target number, advantage mode, hit/crit/fumble/miss) at all 7 places `BattleScene` logs an attack result (enemy attacks, hero basic attacks incl. multi-attack, off-hand attacks, Cleave mastery, retaliation, ability/spell attacks, summon attacks) via one shared `technicalAttackLine` formatter. Viewed in a new, separate "Technical Log" overlay (the "L" key, same dim+panel shape as the existing tutorial overlay) rather than folded into the small always-on log line, per Kevin's explicit "not folded into the existing single combat-log line." `CombatSystem.AttackRoll` gained a new `advantage: AdvantageMode` field (previously discarded after the roll) so the technical line can report it; `WaveSystem`'s synthetic saving-throw roll object sets it from the same `target.savingThrowAdvantage` expression it already had inline.
- **Deliberately out of scope this pass**: no purchase-only stash/inventory (declined). No repro-driven fix for the Tide map report (needs Kevin's specifics first). The technical log covers ATTACK/SAVE rolls only — skill checks (Stealth, etc.) and other d20 moments outside `CombatSystem`/`WaveSystem`'s attack path are not captured. A debug/test mode, the Character Creation level-by-level planner, and spell damage types were NOT started — held for a design discussion with Kevin first, per this project's standing practice for a system this size and this open-ended.

Tests: 1148 → **1149** (+1, `tests/combat.test.ts` — `rollAttack` reports back whichever advantage mode it was actually rolled with). Verification: `npm run typecheck`, all 1149 tests, and `npm run build` (115 modules, unchanged) all pass. No browser available in this environment — none of this session's UI/UX changes have been seen on-screen yet.

### D-131 — A full 5e damage-type mechanical engine: every SRD damage type, real per-spell typing, and a full enemy-roster resistance/vulnerability/immunity pass

Kevin's exact ask, confirmed directly (not self-scoped): "It needs to be both cosmetic AND mechanical... It needs to be the full mechanical engine/rules," plus an explicit confirmation that enemy tagging should be a FULL roster pass, not a curated subset. This closes a gap flagged as deliberately out of scope by D-127 itself (KI-085 lists "damage types on every spell" as "now an explicit ask") and resolves KI-078's long-standing "cast/death color is a cosmetic guess, not verified SRD damage typing" limitation for real.

- **Taxonomy (`data/weapons.ts`)**: `DamageType` widened from the three physical types to the full SRD 13: `acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder`. A new `PHYSICAL_DAMAGE_TYPES: ReadonlySet<DamageType>` (`bludgeoning`/`piercing`/`slashing`) is the one canonical place the resistance-rule split below checks "is this a physical type."
- **The resolution rule (`CombatSystem.applyResistance`, made non-private static)**: rewritten from D-127's original halve-only-if-nonmagical-physical rule to the full real 5e rule. The physical types keep D-127's exact magic-weapon-bypass behavior unchanged (a magic weapon/spell bypasses resistance/immunity to the NONMAGICAL version only). Every elemental type (the other ten) is NEVER affected by `magical` at all — resistance/vulnerability/immunity to those always applies unconditionally, matching real 5e (those types have no "nonmagical" variant to begin with). Vulnerability itself is NEVER bypassed by `magical`, for any type — the SRD's magic-weapon clause only ever talks about resistance/immunity. If a target is BOTH resistant and vulnerable to the same type, they cancel per 5e RAW (full damage, not double-halved). A full regression test confirms the exact pre-D-131 Swarm-vs-physical-weapon behavior is unchanged.
- **Enemy data model (`data/enemies.ts` + `entities/Enemy.ts`)**: two new optional fields alongside the existing `damageResistances`, `damageVulnerabilities?: DamageType[]` and `damageImmunities?: DamageType[]`, mirrored through `Enemy`'s `activeDef`-reading getters exactly the way `damageResistances` already was (so a Multi-Phase Boss's per-instance override plumbing needs no changes). `CombatSystem.Combatant` gained the same two fields.
- **`SavingThrowSystem.applySaveOrDamage`**: previously had NO damage-type hook at all — a save-based spell (Fireball, Sacred Flame, Thunderwave, and every other `savingThrow`-tagged ability, a large fraction of the catalogue) would never have respected resistance/vulnerability/immunity without this fix. Gained two new `options`: `damageType`/`magical`, routing the post-save damage through `CombatSystem.applyResistance` before it comes off `target.health`. Evasion's `halveOnFail` now applies AFTER resistance/vulnerability resolve (independent 5e rules stacking on the same instance of damage).
- **`AbilityDefinition.damageType` (`data/abilities.ts`)**: a new optional field, set ONLY for a real castable spell (an id referenced by some `spells.ts` `abilityId`) whose canonical 5e version deals damage of a specific type — 47 of the ~198 castable spells got one, following the same real-vs-stand-in-damage judgment call spells.ts's own "verify, don't assume" convention (D-098/D-099) demands: a control/debuff/buff/heal/summon/terrain/teleport spell whose nonzero `damage` here is this project's own stand-in for a real spell that deals NO damage at all (`command`, `charm-person`, `sleep`, `bane`, `fear`, `hold-person`, `dominate-beast`, etc. — dozens of these) correctly got NO `damageType`, matching honesty over completeness. A few genuinely mixed-type real spells (Ice Storm: bludgeoning+cold; Flame Strike: fire+radiant; Meteor Swarm: fire+bludgeoning; Storm of Vengeance: thunder/lightning/bludgeoning across rounds) were resolved to a single clean type by judgment, documented inline at each entry. Prismatic Spray (genuinely random-per-ray, no single real type) and Wish (caster picks any type) were left untagged rather than fabricate a fixed type for either.
- **`BattleScene.ts` wiring**: all 4 ability-cast `AttackProfile` literals (both `aoeAdjacent`/`aoeAtRange` attack-roll paths, both the fixed-ability and spellbook-cast call sites) now pass `damageType: ability.damageType, magical: true`; both `SavingThrowSystem.applySaveOrDamage` call sites (single-target and aoeAtRange-with-save) now pass the same two through its new `options`. Every ability/spell cast is unconditionally `magical: true` — this game has no "unenchanted spell" concept, matching real 5e (spell damage is always magical). Hero basic-attack/off-hand-attack profiles are untouched (correctly weapon-derived, unrelated to this feature).
- **`VisualFxSystem.ts` (resolves KI-078)**: `colorForAbility`/`deathCauseForAbility` now read `ability.damageType` as the PRIMARY signal (real SRD data), falling back to the pre-D-131 keyword-guess/school logic only when it's absent (every spell/ability that genuinely has none). `DeathCause` widened from 8 to 12 values, adding `acid`/`thunder`/`psychic`/`force` (reusing existing `DeathShape`s with distinct colors rather than a bigger visual redesign, per scope).
- **Full enemy-roster pass (`data/enemies.ts`)**: 24 of the ~63-entry roster got new resistance/vulnerability/immunity data, keyed off each enemy's own existing name/flavor/loreText (original content, not SRD reprints — a real judgment-call pass, not a template fill). Notable calls: construct/stone/iron/bone-themed enemies (Basalt Colossus, Gravemaw, Ironhide, Juggernaut) got poison + psychic immunity (no organs, no mind); undead-coded enemies (The Hollow Empress, Coin Wraith — "Wraith" is the tell) got the real 5e undead pattern (poison immunity, necrotic resistance, radiant vulnerability); Cinderlord and Ashen Sovereign (fire-named bosses/legendary) got full fire immunity; Tidelord (water-themed) got fire RESISTANCE specifically, deliberately avoiding an unearned cold immunity just because it's water-themed; Ooze Splitter got acid immunity (a real ooze); Rat Swarm/Locust Swarm kept their existing D-127 physical resistance array completely untouched and got poison appended on top (vermin plausibly resist disease). Plenty of plain minions (Grunt, Runner, Marauder, etc.) deliberately got nothing — not every enemy needs a tag.
- **Explicitly out of scope**: no damage-type field on `Hero` — nothing in this game deals typed elemental damage TO a hero (only FROM one, via a hero's own spell), so a hero-side field would be dead scaffolding. The four non-spell Phase-4 abilities (`cleave`/`piercing-shot`/`taunting-slam`/`frost-bolt`) were not touched. No balance retuning — this is a damage-TYPE feature, not a rebalance pass.

Tests: 1149 → **1162** (+13: 7 new `tests/combat.test.ts` cases covering the Swarm regression plus elemental resistance/immunity/vulnerability/cancel-out; 5 new `tests/savingThrowSystem.test.ts` cases covering the same set of rules now also applying to a save-based spell; 1 net from replacing a now-stale `tests/visualFxSystem.test.ts` assertion — magic-missile used to be the example of "no keyword match, falls back to arcane," and now correctly resolves to its real `force` damageType instead). Verification: `npm run typecheck`, all 1162 tests, and `npm run build` (115 modules, unchanged) all pass. No browser available in this environment — the cast-flourish/death-fade color changes and every in-battle damage number have not been seen on-screen; see KI-087.

### D-132 — AC/damage visibility in the battle HUD: selected-hero AC on the status line, plus a hover tooltip (HP/AC and a BG3-style hit%) on any hero or enemy

Kevin flagged the tide-map report as his own mistake (hadn't realized a hero must be within `BUILD_RANGE_TILES` of a tile to build — closes that report for good, matching D-130's own investigation exactly), then asked to pick up the AC/damage-visibility gap KI-085 had confirmed as real (armor class/attack numbers are computed live in `Hero.ts` but never shown anywhere in battle). Offered a placement fork, he picked "selected hero only" for the always-on status line over crowding it for all 4 heroes (the status line is already at the wrap-width ceiling D-126/KI-083 just fixed) plus a hover tooltip on either side. Asked for the tooltip's scope, he expanded it live: AC/HP on hover for ANY hero or enemy, and — while a hero is selected and hovering a valid attack target — the attacker's to-hit odds, and picked the BG3-style single hit-percentage over a raw-numbers breakdown when offered the choice directly.

- **Selected-hero AC (`BattleScene.refreshStatus`)**: the always-on per-hero line (name, level, HP, move/act state, gear count) now also prints `AC {n}` — but ONLY for whichever hero is currently the input focus (`heroSelected`/`confirmingMove`/`aimingAbility`/`choosingSpell`/`aimingSpell`/`aimingTileSpell`, the same condition that already draws the "`<`" marker). The other 3 heroes' lines are byte-for-byte unchanged, so this cannot reopen the wrap-width regression D-126 fixed — the line only ever grows by one hero's worth of text, never four's.
- **`CombatSystem.hitChance(attackBonus, targetArmorClass, advantage?, critThreshold?)`** (new, pure, static): an analytic hit-probability — no `RandomService`, no dice rolled — for the hover tooltip's "N% to hit" line. `rollAttack`'s own rule (a natural 1 always misses; a natural `>= critThreshold` always hits) makes hit/miss monotonic non-decreasing in the raw d20 value, so normal is `(hitting rolls)/20`, advantage is `1 - missChance²` (hits unless BOTH of two independent rolls would miss), and disadvantage is `hitChance²` (BOTH must hit) — the real "best/worst of two independent d20s" math `RandomService.rollD20With` actually performs, not an approximation. Verified against real rolled frequencies with three 20,000-trial Monte Carlo tests (normal/advantage/disadvantage), plus closed-form assertions for the exact-probability and crit-threshold cases.
- **`BattleScene.computeBasicAttackProfile(hero, enemy)`** (new, extracted from `tryBasicAttack`): every advantage/bonus source a basic attack against a SPECIFIC enemy would apply (Lucky, Vex, Grappler's restrained-target advantage, pending Bardic Inspiration, Boon of Fate), computed read-only — the boolean/getter checks themselves have no side effect; only `tryBasicAttack`'s own follow-up calls (`spendLuckyPoint`, `clearVex`, `useBoonOfFate`, `clearInspiration`) actually consume anything, and those are unchanged, still gated on the same flags this helper returns. `tryBasicAttack` itself is now three lines shorter and behaviorally identical (no test needed new/changed coverage for the refactor itself — the existing D-108/D-109/D-093 basic-attack tests already pin this exact behavior).
- **`BattleScene.previewHitChance(hero, enemy)`** (new): calls `computeBasicAttackProfile` for the would-be profile, checks range with the same `CombatSystem.isInRange` the real attack uses, then resolves `CombatSystem.hitChance` instead of rolling — returns `null` for an out-of-range or already-dead enemy, mirroring exactly when `CombatSystem.attackSingle` itself would silently refuse. Because it shares the bonus-computation helper with the real attack, the preview can never drift from what actually happens when the hero swings.
- **A new hover tooltip (`BattleScene.updateUnitTooltip`)**: wired into `updateHoverAt`, the one shared "what's under the cursor" method the mouse (`pointermove`) and the keyboard cursor (arrow keys) both already funnel through — so the tooltip works identically for mouse and keyboard play, no separate wiring needed. Hovering a hero's tile shows `HP {n}/{max} · AC {n}`; hovering an enemy's tile shows the same, plus — only while `ui.kind === "heroSelected"` and `previewHitChance` returns non-null for that pairing — a `{n}% to hit` line. A still-hidden stealth/Mimic enemy (`def.stealth`/`def.mimicDisguise` true, `!isRevealed`) shows NO tooltip at all, the same "nothing to see here" treatment its token/name already get (Phase 20/21) — its real HP/AC would otherwise leak information an unrevealed ambush is supposed to hide.
- **Deliberately out of scope**: no tooltip for structures/traps (not asked for — the ask was specifically hero/enemy). No hit-chance preview during ability/spell aiming (`aimingAbility`/`aimingSpell`/`aimingTileSpell`) — those resolve via a saving throw or a different attack-roll path than `tryBasicAttack`'s bonus stack, and Kevin's ask was scoped to "when you are looking to attack," which in this game's UI only ever means a basic attack (an ability/spell target is chosen by clicking an already-outlined valid target, not by hovering candidates one at a time). A natural follow-up if Kevin wants it, not attempted this pass.

Tests: 1162 → **1168** (+6, new `tests/combat.test.ts` describe block for `CombatSystem.hitChance`: exact-probability, advantage/disadvantage-vs-normal, crit-threshold, and three Monte Carlo checks against real `RandomService` rolls). The tooltip/status-line wiring itself (`BattleScene`-only) has no automated coverage, the same standing Phaser-scene limitation every other in-battle HUD change in this project has — `computeBasicAttackProfile`/`previewHitChance`'s CORRECTNESS is fully covered by testing the pure `CombatSystem.hitChance` function they feed into, plus the pre-existing basic-attack tests that already pin `tryBasicAttack`'s unchanged behavior. Verification: `npm run typecheck`, all 1168 tests, and `npm run build` (115 modules, unchanged) all pass. No browser available in this environment — see KI-088.

### D-133 — The level-by-level Character Creation planner: pre-pick every future ASI/subclass/spell-pick choice, per hero, with Auto/Prompt/Fresh modes

KI-085's largest still-open item, carried since D-128 and explicitly held for a design discussion (same D-070/D-078/D-113 precedent as every system this size). Asked to resolve it, Kevin confirmed three design forks directly: the planner lives as a new step INSIDE Character Creation (not a separate scene); it supports FULL drill-down (a feat's own sub-choice — Magic Initiate's spell list, Grappler/an Epic Boon's ability pick — is itself plannable, not left to auto-resolve); and in "Prompted each level" mode, the in-battle popup pre-fills/highlights the planned choice (still one click to override).

- **The existing choice-point catalog, verified in code before any design** (`BattleScene.fastForwardHeroToLevel`/`applyClassLevelUps`'s existing queues): ASI-vs-feat at every level `CharacterSystem.asiFeatureGrantedAtLevel` flags (data-driven off each class's own table — standard 4/8/12/16/19, Fighter's extra 6/14); subclass, once, at `classDef.subclassChoiceLevel` for any class where that's `> 1` (Cleric/Sorcerer/Warlock choose at level 1 already, via the existing Character Creation subclass-picker row — untouched); Wizard's Spell Mastery (18)/Signature Spells (20) and Warlock's Mystic Arcanum (11/13/15/17, tiers 6/7/8/9), from D-125.
- **`systems/LevelUpPlanSystem.ts`** (new, pure, tested, no Phaser): the ONE place every one of those triggers resolves, whether pre-battle (`fastForwardHero`, replacing D-129's inline defaults — a straight refactor, same behavior) or in a real in-battle level-up. `LevelUpPlan` (`mode: "auto"|"prompt"|"fresh"`, `subclassId?`, `asiChoices`/`spellPicks` keyed by level) stores a hero's blueprint; `resolveAsiForLevel`/`resolveSubclassForClass`/`resolveSpellPickForRequest` apply the plan's choice for a level if present AND still valid (a stale/invalid feat prerequisite falls back safely, never crashes), else fall back to EXACTLY D-129's original defaults (current-highest ability, first subclass, first eligible spell) — a build with no plan is byte-for-byte unaffected. `futureChoiceSteps(classId)` enumerates every future choice point (1-20) data-driven off the class table plus the newly-exported `WIZARD_SPELL_MASTERY_LEVEL`/`WIZARD_SIGNATURE_SPELLS_LEVEL`/`WARLOCK_MYSTIC_ARCANUM_LEVELS` (previously module-private in `Hero.ts`) — no hardcoded level list to keep in sync by hand.
- **`CharacterCreationScene`'s new "Plan Levels" row**: one more 40px row per hero column (background height/every row below it — Team Level, party size/difficulty, Start Battle, Back button — shifted down 40px to match, the same "grows downward" pattern D-096/D-099/D-129 each already used; GAME_HEIGHT 1080 had ~100px of slack, still does). Clicking it opens a full-screen wizard overlay (a scene-local reimplementation of `BattleScene.renderAsiPrompt`'s dim-rect + button-grid shape, since this scene has no mechanism to share a private method from another scene): first a Mode screen (Auto-follow/Prompted/Always fresh/Cancel), then — for Auto/Prompt — one screen per `futureChoiceSteps` entry in order, with a Back/Skip nav pair on every step. A step's real eligible feats/spells are computed by `simulateHeroUpToChoice` (scene-local): a scratch, throwaway `Hero` fast-forwarded to `level - 1` fully resolved against the in-progress draft, then bumped ONE more level by hand (bypassing `fastForwardHero`) so THIS level's own trigger stays unresolved for the UI to inspect — correctly reflects a Magic Initiate pick's effect on later Spell Mastery/Arcanum eligibility, for example. Edits only commit to `slots[slot].levelUpPlan` on a confirmed "Save & Close"; changing a slot's class clears its plan (a different class has an entirely different ladder).
- **`BattleScene` integration**: `heroLevelUpPlans: Map<string, LevelUpPlan>`, built once in `buildHeroes()` from the (additive, optional) `HeroDefinition.levelUpPlan`/`CharacterBuild.levelUpPlan` fields — mirrors `startingLevel`'s existing passthrough exactly. Pre-battle fast-forward always applies a plan silently regardless of `mode` (there's no popup mechanism before the battle starts). For a REAL in-battle level-up, `applyClassLevelUps` now checks each hero's `mode`: `"auto"` resolves every trigger silently, right there, instead of queuing an overlay (never added to `plainHeroes` either — no popup at all, the whole point); `"prompt"`/unset/`"fresh"` queues exactly as it always has. `renderAsiPrompt` gained an optional per-choice `highlighted` flag (a gold outline + a "★ " label prefix, still fully clickable like every other option) — every queue's own render call site (`showAsiPathChoice` through `showSignatureSpellSecondPick`, nine sites total) looks up the hero's plan for the current level and marks the matching option.
- **Deliberately out of scope**: no change to Cleric/Sorcerer/Warlock's existing level-1 subclass-picker row. No retroactive planning for a hero already mid-run — the planner only runs at Character Creation, before level 1. No visual restyle of `CharacterCreationScene` onto the D-123 ornate theme (unrelated to this feature, a separate future task).

Tests: 1168 → **1188** (+20, new `tests/levelUpPlanSystem.test.ts`: default-vs-planned-vs-invalid-plan coverage for each resolve function, `futureChoiceSteps` correctness across a level-1-subclass class/a later-choice class/Wizard/Warlock, and a `simulateHeroForPlanning`/`fastForwardHero` regression guard against D-129's original defaults). Typecheck, all 1188 tests, and the production build (116 modules, up from 115 — the new `LevelUpPlanSystem.ts`) all pass. No browser available in this environment — this is real new Phaser scene UI (a multi-step wizard overlay) with no automated coverage of its own, the same standing limitation every other scene change in this project has; see the new KI for the full in-browser checklist.

### D-134 — Phase 1 of a real SRD 5.2.1 spell-preparation economy: verified prepared/known tables, two reusable swap-cadence mechanisms, `Hero` wired to a bounded prepared/cantrip/spellbook list instead of "knows its whole class list"

Kevin asked directly whether the game modeled 5e's real spells-known/prepared rules — it didn't, an explicit simplification made twice before (D-092: "spellbook = every known spell"; D-106: "full list, all known... a fuller spellbook is more content, not more rules overhead"). Asked to build the real thing, three forks were confirmed before any code: follow **SRD 5.2.1** specifically (matching this project's own class-table sourcing convention, not the classic 2014 known-vs-prepared split); **cantrips get the same treatment too**, not left alone; and Character Creation gets a **real manual pick**, not an auto-filled default. Research (WebFetch/WebSearch against the actual SRD text and cross-validated against multiple independent sources, not memory — this project has been burned before by trusting memory over the source, see D-109) found SRD 5.2.1 eliminated the 2014 known/prepared split entirely: every class "prepares" now, differing only in swap cadence. Given the size (larger than D-133), this session builds **Phase 1 only** — data + the pure system + `Hero` wiring, no UI — and hands off the rest explicitly (see KI-090).

- **The verified rules, cited in full in this session's own research trail (not reproduced here at citation-length — see the two research agents' findings, folded into the code's own comments)**: all 8 classes "prepare"; the real differentiator is a three-tier swap cadence — full relist every Long Rest (Wizard/Cleric/Druid), replace exactly one every Long Rest (Paladin/Ranger), replace exactly one only on level-up (Sorcerer/Bard/Warlock). Prepared-spell count is a flat per-level table now, not `ability mod + level` (the 2014 formula). Cantrip-swap cadence is a SEPARATE per-class setting from the leveled-spell cadence — e.g. a Cleric fully relists its leveled spells every Long Rest but only swaps ONE cantrip on level-up. A Wizard's spellbook is a third, additive layer: an ever-growing, never-shrinking pool (6 spells at level 1, +2 per level) that its Long-Rest full relist prepares FROM, instead of the full class list every other caster draws from directly.
- **Two real, pre-existing 2014-assumption bugs found and fixed in `data/classes.ts` while researching this**: Paladin/Ranger's `"Spellcasting"` feature (and, critically, their underlying `spellSlotsByLevel` table) started at level 2 — SRD 5.2.1 moved this to level 1 (confirmed by three independent sources; `HALF_CASTER_SPELL_SLOTS_BY_LEVEL` now grants a real 1st-level slot at character level 1, not just at level 2). Four of the six cantrip-having classes (Sorcerer/Bard/Druid/Warlock) shared Wizard/Cleric's cantrip-known table (3/4/5) when their own real SRD 5.2.1 tables are DIFFERENT (Sorcerer 4/5/6; Bard/Druid/Warlock 2/3/4) — both fixed, with two pre-existing tests updated to match (`tests/newCoreClasses.test.ts`).
- **`systems/SpellPreparationSystem.ts`** (new, pure, tested, no Phaser): every verified per-class prepared-count table (Wizard's own; one shared by Cleric/Druid/Sorcerer/Bard; one shared half-caster table for Paladin/Ranger; Warlock's own), `canSwapLeveledSpellAt`/`canSwapCantripAt` (the three-tier cadence, queried by trigger), `wizardSpellbookSizeAtLevel`, `eligibleCantripPool`/`eligibleLeveledSpellPool` (wrapping `characterCreation.ts`'s existing per-class arrays, split into two new exports — `cantripIdsForClass`/`leveledSpellIdsForClass` — rather than re-verifying which of the 319 existing spells truly belong to each class's real 5.2.1 list, a separate and much larger research task explicitly out of scope here), `isValidSelection` (for a future picker UI to validate a real pick against), and `defaultFill` (the interim deterministic default — see below). The dead, wrong `SpellcastingSystem.preparedSpellsKnownForWizardAtLevel` (2014's `intMod + level` formula, never actually called anywhere) is removed.
- **`Hero.ts`**: three new fields — `preparedSpellIds`/`knownCantripIds`/`spellbookIds` (private, with public getters, following this file's existing `assignedSubclassId`/`subclassId` pattern) — replace `knownSpellAbilityIds()`'s old "return the whole class list" with "return what's actually prepared/known" (everything else it already unioned — subclass-granted spells, Magic Initiate grants, charged-item spells — is unchanged). `growSpellSelections()` (called at construction and after every `levelUpClass()`) auto-fills any newly-unlocked capacity using `defaultFill` — first not-yet-selected id from the eligible pool, in list order — the same "silent default until a real choice-UI exists" precedent D-129/D-133 already established, so the game stays fully playable with no popup spam while Phase 2/3 are still unbuilt. New mutators `choosePreparedSpells`/`chooseCantrips`/`learnSpellbookSpells` are the seam a future picker UI will call; genuinely uncalled by any scene yet, same "framework, tested, not yet wired" treatment `ConcentrationSystem`/`InitiativeSystem` got. All three fields round-trip through `HeroSnapshot`/`toSnapshot`/`restoreMutableState`.
- **A design simplification found only by actually building this, not anticipated in the plan**: the plan proposed a `needsSpellSwap()`/`needsCantripSwap()`/`needsSpellReprep()` trio mirroring `needsSpellMasteryPick()`'s one-time-gate shape. Building it revealed spell-swapping is fundamentally RECURRING (a real opportunity exists every Long Rest/level-up, forever, not a one-time unlock a boolean can gate) — so those flags were dropped; a future phase's UI will instead just check `canSwapLeveledSpellAt`/`canSwapCantripAt` directly at the moment a real Long Rest/level-up fires, no stored Hero-side flag needed.
- **A happy accident: Phase 4 ("gate the spellbook overlay") turned out to already be done.** `BattleScene.renderSpellbookOverlay` already read `hero.knownSpellAbilityIds()` (line `const castable = hero.knownSpellAbilityIds().filter((id) => hero.canCastSpell(id));`) — since that method's return value changed to the bounded prepared/cantrip list, the in-battle spellbook UI now shows only what's actually prepared/known, with zero `BattleScene` changes needed. `Hero.canCastSpell` itself is unchanged and still purely about slot economy (whether a slot remains), not spell identity — the known/prepared gating lives entirely in what `knownSpellAbilityIds()` returns, which the spellbook overlay was already filtering through.
- **Explicitly NOT built this session (Phase 2/3 — a future session's job, not deferred by oversight)**: a Character Creation UI step for a hero's real starting spell pick (reusing D-133's wizard-overlay pattern); an in-battle "Prepare Spells" screen tied to `showRestChoice`'s existing Long-Rest option, for the two Long-Rest-triggered tiers; a level-up swap step for the level-up-triggered tier, ideally ALSO becoming a new `LevelUpPlanSystem.futureChoiceSteps` kind so D-133's planner covers it too. Until Phase 2/3 land, every caster hero plays with a perfectly legal but entirely auto-picked (not player-chosen) prepared/known list — a real, honest limitation, not hidden from Kevin.
- **Explicitly out of scope, permanently (not phased in later)**: re-verifying which of the 319 existing spells truly belong to each class's real 5.2.1 spell list (the eligible pool stays exactly what `characterCreation.ts` already says); Bard's Magical Secrets (pulling replacement spells from OTHER classes' lists); the Warlock Pact-Magic SLOT-count table's existing D-093 simplification (unrelated — only the PREPARED-count table is new here).

Tests: 1186 → **1221** (+35: new `tests/spellPreparationSystem.test.ts` covering every verified table/cadence/pool/validation function; a new "Hero prepared spells/known cantrips/spellbook" block in `tests/spellSlots.test.ts`; two pre-existing tests in `tests/newCoreClasses.test.ts` updated for the real level-1 Paladin/Ranger slot; two pre-existing tests in `tests/spellSlots.test.ts`/`tests/d124Features.test.ts` updated for the now-bounded `knownSpellAbilityIds()`). Typecheck, all 1221 tests, and the production build (117 modules, up from 116 — the new `SpellPreparationSystem.ts`) all pass. No browser available in this environment — Phase 1 touched no scene file, so nothing here needs a browser pass on its own; see KI-090 for what a FUTURE Phase 2/3 session will need Kevin's own look for.

### D-135 — Phase 2 of D-134's spell-preparation economy: a real Character Creation "Spells" picker, reusing D-133's wizard-overlay machinery, replacing the silent auto-fill with an actual player choice

Kevin asked to continue the spell-selection work D-134 (Phase 1) explicitly deferred. This session builds Phase 2 only — a Character Creation UI step for a hero's *starting* prepared spells/known cantrips/(Wizard) spellbook — Phase 3 (the in-battle "Prepare Spells"/level-up swap UI) stays out of scope, per D-134's own phasing (see KI-090).

- **Reused, not duplicated, D-133's wizard overlay.** `CharacterCreationScene.renderPlanPrompt`/`clearLevelPlanOverlay`/`levelPlanOverlay` were already fully generic (title + a choices array of `{label, desc?, onClick, highlighted?}` buttons, no `LevelUpPlan`-specific typing) — the new spell-picker wizard reuses all three verbatim, with its own parallel `spellPickSlot`/`spellPickDraft`/`spellPickSteps`/`spellPickStepIndex` state (both wizards are never open at once).
- **Toggle-multiple-then-confirm, not click-one-advance.** Every existing wizard screen in this file was "click one option, auto-advance." A spell pick is multi-select up to a cap, so each screen instead renders the eligible pool as toggle buttons (`highlighted` = currently selected, re-rendering the same screen on every click) plus a `Confirm (x/max)` button that only advances at the exact count (no-op otherwise — no new "disabled" visual state needed).
- **`SpellPreparationSystem.spellPickStepsForClass(classId, level)`** (new, pure, tested): which of `"spellbook"`/`"cantrips"`/`"prepared"` screens a class needs, in order — a Wizard's spellbook step comes first since its result is the pool the prepared step draws from. Critically, this checks BOTH a nonzero count AND a non-empty eligible pool before including a step: Paladin/Ranger have a real, nonzero `preparedSpellCountForClassAtLevel` but an EMPTY `eligibleLeveledSpellPool` (their one in-game consequence, Divine Smite/Hunter's Mark, lives outside the normal spell list — a pre-existing D-134 scope boundary), so without the pool check they'd get an unsatisfiable "pick 2 of 0" step. Both classes correctly get zero steps and a disabled "Spells: N/A" row.
- **The picker's choices are filtered to spells the hero can actually cast at Starting Level** (`getSpell(id).level <= maxCastableSpellLevel`, computed from `SpellcastingSystem.spellSlotsForClassAtLevel`) — a Character-Creation-only DISPLAY filter, not a change to the canonical eligible pool (a filtered id is still trivially valid against the full pool `SpellPreparationSystem` already defines). Without it, a level-1 Wizard would see all 107 of its eligible leveled spells in one screen, most of them 10+ levels away from castable — cantrips have no level to filter on, so their pool is always shown whole.
- **Each screen seeds its starting selection from the exact same `defaultFill` math `Hero.growSpellSelections()` already runs**, called directly against the filtered pool (no throwaway `Hero` simulated) — the player opens already looking at a valid, capped selection to freely toggle, not a blank slate.
- **Editing a Wizard's spellbook prunes any now-stranded prepared picks** (`showSpellStepScreen`'s toggle handler, spellbook case only) — since the prepared step's pool for a Wizard IS the spellbook draft, removing a spellbook entry that was already picked as "prepared" would otherwise leave prepared referencing a spell no longer in the book.
- **One new `Hero` mutator, `chooseSpellbook(ids)`** — a wholesale replace, distinct from the existing `learnSpellbookSpells`'s deliberately additive "copy a spell in" semantics. The starting-spellbook pick from Character Creation is a wholesale choice, not an addition on top of the auto-filled default, so the additive mutator alone couldn't express it.
- **`CharacterBuild`/`HeroDefinition` gain three optional fields** — `preparedSpellIds?`/`knownCantripIds?`/`spellbookIds?` — same `?`-means-"unaffected" precedent as `levelUpPlan?`/`startingLevel?`. `BattleScene.buildHeroes` applies them as a wholesale override (via `chooseSpellbook`/`chooseCantrips`/`choosePreparedSpells`) right after a hero's Starting-Level fast-forward finishes, not merged with whatever the auto-fill produced during construction.
- **No forced customization; changing class wipes a stale pick.** Every field defaults to `undefined` at every layer — a party that never opens the picker behaves byte-for-byte like before this session. Changing a slot's class resets `spellPicks` to `{}`, same "wholesale reset on class change" discipline `levelUpPlan` already follows (a different class's spell ids would be nonsensical). Starting Level changes do NOT reset picks — a short manual list is harmless, since `growSpellSelections`'s additive `defaultFill` silently pads any shortfall on the next level-up, exactly like an auto-filled hero today.

Tests: 1221 → **1228** (+7: `spellPickStepsForClass` coverage in `tests/spellPreparationSystem.test.ts`, including the Paladin/Ranger empty-pool case; `chooseSpellbook`'s wholesale-replace behavior in `tests/spellSlots.test.ts`; a `heroDefinitionFromBuild` pass-through round-trip in `tests/characterBuildSystem.test.ts`). Typecheck, all 1228 tests, and the production build (117 modules, unchanged — no new source file this session) all pass. No browser available in this environment — unlike Phase 1, this phase DOES touch real UI/gameplay surfaces (`CharacterCreationScene.ts`, `BattleScene.ts`), so there's genuinely something new to click on; not yet confirmed by Kevin — see KI-090.

### D-136 — Phase 3 of D-134/D-135's spell-preparation economy: an in-battle "Prepare Spells" swap screen at Long Rest and a level-up spell-swap step, closing out the phased plan

Kevin asked to continue the spell-selection work Phase 2 (D-135) explicitly deferred. Phase 3 is the last piece: the two triggers where a real 5e caster changes what's prepared *after* character creation — a Long Rest (Wizard/Cleric/Druid's full relist; Wizard's own cantrip swap) and a level-up (Sorcerer/Bard/Warlock's replace-one prepared spell; every cantrip-having class but Wizard's replace-one cantrip swap). Before this session, a hero's prepared/known list only ever GREW automatically (`Hero.growSpellSelections`) — nothing let the player change it after character creation.

- **`systems/SpellPreparationSystem.ts` gains three new pure functions**, all reusing D-134's existing `canSwapLeveledSpellAt`/`canSwapCantripAt`/`spellEconomyForClass` rather than any new data table: `spellSwapStepsForClass(classId, level, trigger)` — the in-battle analogue of D-135's `spellPickStepsForClass`, but keyed by a LIVE trigger (`"longRest"`/`"levelUp"`) instead of a one-time Character Creation pick, with the same double-check (nonzero count AND a real eligible pool) that correctly zeroes out Paladin/Ranger at either trigger; `preparedSwapIsFullRelist(classId)` — true for Wizard/Cleric/Druid (a toggle-many screen), false for a "replace exactly one" class (a drop-then-learn screen) — cantrips never consult this, since a cantrip swap is always exactly "replace one," matching the real SRD rule (no class ever fully re-relists its cantrips); `maxCastableSpellLevel(classId, level)` — D-135's own Character-Creation-only display filter, promoted here so the in-battle screens can filter against a hero's CURRENT level instead of duplicating the math (`CharacterCreationScene`'s own private copy is untouched — pre-existing, working, out of scope to touch).
- **Verified against the existing `SPELL_ECONOMIES` table**, `spellSwapStepsForClass` produces exactly the matrix its own doc comment describes: Wizard @ `"longRest"` → both cantrips and prepared (full relist of both); Cleric/Druid @ `"longRest"` → prepared only (full relist), @ `"levelUp"` → cantrips only (their prepared cadence is Long-Rest-only); Sorcerer/Bard/Warlock @ `"levelUp"` → both (replace-one); Paladin/Ranger → nothing at either trigger (moot, same empty-eligible-pool reason D-135 already established). 9 new tests in `tests/spellPreparationSystem.test.ts` assert this matrix directly, one case per class/trigger combination.
- **`BattleScene.ts` gains a fifth queue-and-pop overlay, `spellPrepQueue`**, sharing `renderAsiPrompt`/`asiOverlay`/`clearAsiOverlay` — the same generic `{label, desc?, onClick, highlighted?}` choice-button renderer four other queues (ASI, subclass, spell-pick, plain-ack) already reuse, confirmed to never run concurrently with any of them. `showSpellPrepQueue(heroes, trigger, onDone)` pops one hero at a time and, per hero, walks `spellSwapStepsForClass`'s own step list:
  - **The full-relist screen** (`showSpellPrepRelistScreen`, `"prepared"` only, `preparedSwapIsFullRelist` classes) ports D-135's `CharacterCreationScene.showSpellStepScreen` toggle-then-confirm interaction verbatim, but writes straight to the live `Hero` via `choosePreparedSpells`/`chooseCantrips` on every toggle click and re-renders from the hero's own current list — no scene-local draft object needed, since Phase 3 never edits a Wizard's spellbook (the one case Phase 2's draft existed for, to prune stranded prepared picks mid-edit). The screen opens already showing the hero's current, already-valid, already-capped selection — the same "confirm immediately with no edits" no-op path D-135 established, so no separate skip button was needed.
  - **The replace-one flow** (`showSpellPrepDropScreen` → `showSpellPrepLearnScreen`, every cantrip swap plus Paladin/Ranger's moot-in-practice prepared tier) is a new two-screen click-to-advance interaction, structurally modeled on the existing `showSignatureSpellSecondPick`'s two-step pick: screen A lists the hero's currently-known entries plus a "Keep current — no swap" bail-out; screen B lists the eligible pool minus what's already known (filtered to castable level for a leveled spell), and a "◀ Back" undo, since nothing commits until that click.
- **Wired at both triggers**: `chooseRest`'s existing `kind === "long"` branch now computes which living heroes have a `"longRest"` swap opportunity and, if any do, defers `proceed` past `showSpellPrepQueue` — the same "defer the transition until every overlay resolves" shape `afterWaveCleared` already uses everywhere else. `applyClassLevelUps` gains a fourth parallel check next to its existing ASI/subclass/spell-pick ones (`spellSwapStepsForClass(hero.classId, hero.level, "levelUp")`), returned as a new `spellSwapHeroes` array; `afterWaveCleared`'s callback chain gains one more link (spell-pick queue -> level-up spell-swap queue -> rest), inserted exactly where D-125's own spell-pick queue was inserted before it.
- **Deliberately, permanently out of scope: no `LevelUpPlanSystem.futureChoiceSteps` integration for this.** D-134 already worked out, while building Phase 1, that spell-swapping is fundamentally *recurring* (a real opportunity every Long Rest/level-up, for a caster's whole career) rather than a one-time gate like Spell Mastery/Mystic Arcanum — that's exactly why it dropped its own originally-planned `needsSpellSwap()` boolean-flag trio in favor of "just check `canSwapLeveledSpellAt`/`canSwapCantripAt` live at the trigger moment, no stored per-hero flag." A `LevelUpPlan` slot is inherently "one value per level" — pre-planning up to 19 recurring swaps per Sorcerer/Bard/Warlock hero, plus the new `Hero`-side "have I already swapped at this exact trigger" bookkeeping only the planner would need, is a substantially larger undertaking than the in-battle screens themselves. "Auto" mode simply skips this trigger silently (`applyClassLevelUps`'s new check sets `hasChoice = true` but never pushes onto `needsSpellSwap` when `autoMode`) — equivalent to "always keep current," the same safe, inert default an unset choice already gets everywhere else in this feature.
- **Also deliberately out of scope**: no Wizard spellbook growth at Long Rest — only the *prepared* list changes on a full relist, the spellbook itself (the pool it draws from) stays exactly what character creation/level-up growth left it (`Hero.learnSpellbookSpells` stays uncalled, unchanged). No "◀ Back" step-to-step navigation across a hero's whole step ladder, and no explicit top-level Cancel, unlike Character Creation's fuller wizard — this is a low-stakes, recurring, opt-in screen, not a one-time setup step; a toggle regretted can just be toggled back before confirming, and "replace one"'s own "Keep current — no swap"/"◀ Back" already cover "I don't want to change this."

Tests: 1228 → **1241** (+13: 9 for `spellSwapStepsForClass`'s full trigger/class matrix, 2 for `preparedSwapIsFullRelist`, 2 for `maxCastableSpellLevel`, all in `tests/spellPreparationSystem.test.ts`). Typecheck, all 1241 tests, and the production build (117 modules, unchanged — no new source file this session) all pass. No browser available in this environment — this phase touches `BattleScene.ts` directly (real gameplay UI, both a Long-Rest-triggered and a level-up-triggered overlay), so, same as Phase 2, this needs Kevin's own playtest pass before Phase 3 can be called confirmed — see KI-090's rewritten checklist.

### D-137 — A general dual-typed-damage system (`DamageTypeSplit`), applied to Meteor Swarm/Flame Strike/Ice Storm; `EquipmentProc` gains the same optional hook for a future magic item

Kevin asked for a system that can handle an attack/spell dealing TWO real
damage types at once, since D-131's own inline comments already flagged that
this engine was collapsing several genuinely dual-typed SRD spells (Meteor
Swarm, Flame Strike, Ice Storm, Storm of Vengeance) down to one type by
judgment call, and Kevin wants any new dual-typed magic item to have a real
mechanical hook too, not another judgment-call collapse.

- **`DamageTypeSplit` (`data/weapons.ts`)**: `{ type: DamageType; portion: number }` — one component of a split; a spell/item's full split is `ReadonlyArray<DamageTypeSplit>` whose portions sum to 1.
- **`AttackProfile.damageTypes?` (`systems/CombatSystem.ts`)**: when present, takes over from the existing singular `damageType` for resistance purposes. `CombatSystem.applyResistance` divides `rawDamage` into one portion per split (the LAST split absorbs the rounding remainder, so the portions always sum to exactly `rawDamage` regardless of split count/order) and resolves resistance/vulnerability/immunity for each portion independently against its own type via a new private `applyResistanceForType` helper (the exact single-type logic `applyResistance` always ran, now factored out and called once per split) — the real 5e rule that e.g. Meteor Swarm's fire half and bludgeoning half each check the target's resistances separately, then sum. `damageType` (singular) is UNCHANGED in meaning and still the one field `VisualFxSystem` reads for hit-color/death-cause — a dual-typed spell keeps `damageType` set to its "primary"/name-matching type (Meteor Swarm stays visually fire-colored) and additionally sets `damageTypes` to drive the actual math. `SavingThrowSystem.applySaveOrDamage` grew the identical `options.damageTypes` (Meteor Swarm and Flame Strike are both save-based, so this is the path they actually take from `BattleScene`).
- **`AbilityDefinition.damageTypes?` (`data/abilities.ts`)**: the data-layer field a spell sets. Converted the three spells that genuinely deal two types on the SAME hit: `meteor-swarm` (fire+bludgeoning, even 50/50, matching real SRD 20d6/20d6) and `flame-strike` (fire+radiant, even 50/50, matching real SRD 4d6/4d6) both split evenly; `ice-storm` splits unevenly at ~39% bludgeoning / ~61% cold, matching real SRD's actual 2d8 (avg 9) vs. 4d6 (avg 14) ratio — the first spell in this project to model an uneven type split rather than a clean 50/50. **`storm-of-vengeance` was deliberately NOT converted** — its SRD mix is different damage types on DIFFERENT ROUNDS of a multi-round effect (thunder round 1, lightning later rounds), not two types in the same instance of damage, so it doesn't fit this "split one hit" shape; D-131's original single-type judgment call for it stands. All 6 `BattleScene.ts` call sites that build an `AttackProfile`/`applySaveOrDamage` options object from an ability now pass `damageTypes: ability.damageTypes` alongside the existing `damageType: ability.damageType`.
- **`EquipmentProc`'s `onHitSaveOrDamage` variant (`data/equipment.ts`) gains the same optional `damageType?`/`damageTypes?`/`magical?` fields**, for the magic-item side of this ask. Left absent, a proc behaves EXACTLY as before (Flame Tongue/Frost Brand don't set these, so their bonus fire/cold damage still hits `enemy.health` directly, unresisted — a pre-existing gap this decision makes fixable but deliberately does not retrofit onto those two shipped items without a separate balance conversation). `BattleScene.applyEquipmentProc`'s `"onHitSaveOrDamage"` case now routes the bonus damage through `CombatSystem.applyResistance` only when a proc actually sets `damageType`/`damageTypes` — a future item (a "frostfire" weapon, say) can now genuinely deal two resisted/immune-checked types from its proc.

Tests: 1241 → **1248** (+7: 5 new `CombatSystem` dual-type-split cases in `tests/combat.test.ts` covering the even split, the uneven Ice-Storm-ratio split, rounding-remainder correctness across 3 splits, a physical portion's magical-bypass, and `damageTypes` overriding `damageType`; 2 new `SavingThrowSystem` cases mirroring the split and the override in `tests/savingThrowSystem.test.ts`). No new BattleScene-level test was added for the `onHitSaveOrDamage` proc routing — consistent with this project's existing convention that `BattleScene` itself isn't unit-tested (`tests/equipment.test.ts` only checks proc data shape, never proc behavior); the underlying multi-type resistance engine it now calls into is the same `CombatSystem.applyResistance` the tests above already cover directly. Typecheck, all 1248 tests, and the production build all pass. No new source file this session, so module count is unchanged. No browser needed for this decision — it's pure data/systems plus BattleScene call-site plumbing, no new UI.

### D-138 — Test Mode: a dedicated Main Menu entry point + a live in-battle debug toolbar (Skip Wave, No-Fail Stronghold, a live enemy spawner, a live terrain painter, toggle-based status assignment)

KI-085's last remaining large item — every other item on that list (Starting
Level, the level-up planner, damage types, spell-prep economy) had already
shipped. Kevin confirmed he wanted it built now and picked two scope forks
directly: a new dedicated `TestModeScene` entry point (not a toggle bolted
onto Free Play), and a **live in-battle spawner** for enemies/terrain (not
just a pre-battle setup screen) for the "manual placement" capability.

- **Entry point (`scenes/TestModeScene.ts`, new)**: a stripped-down picker —
  map + wave count only, no gating (every map available, always the
  `EXPANDED_MINIONS` pool) — reached from a new "Test Mode" button in Main
  Menu's Creator Tools row. Hands off to `CharacterCreationScene` exactly
  like Free Play does, plus one flag: `testMode: true`, forwarded unchanged
  through to `BattleScene.init`. `CharacterCreationScene` already has
  Starting Level/Team Level (D-129) — that alone satisfies "playable at any
  level," no new code needed there. `MAP_OPTIONS`/`EXPANDED_MINIONS`/
  `GatedOption` were exported from `FreePlayScene.ts` (previously
  module-private) so Test Mode reuses the same map list/roster rather than
  duplicating it.
- **`WaveSystem` gains three new members** (`systems/WaveSystem.ts`):
  `setNoFail(value)` gates `isDefeated()` to always return `false` when set —
  integrity still visibly rises/falls on a breach, only the loss condition
  itself is suppressed, default OFF; `forceEndWave()` clears `active` and
  marks every spawn group fully spawned, so `isCurrentWaveComplete()` reads
  true immediately (Skip Wave's mechanism — no reward gold awarded, a
  bypass, not a real clear); `spawnAt(enemyId, pos)` mirrors the real
  spawn-construction lines in `spawnDueEnemies` exactly (same `Enemy`
  constructor, same `active`/`nextInstance` bookkeeping, base definition, no
  wave HP-scaling) so a debug-spawned enemy is indistinguishable from a real
  one to every other system.
- **`Hero`/`Enemy` gain `removeStatus(id)`**, mirroring the existing
  `applyStatus`/`hasStatus` shape — removes a status early if present, a
  no-op otherwise. Status assignment in the debug UI is **toggle-based**: a
  status chip applies (fixed `DEBUG_STATUS_DURATION_TURNS = 99` — long
  enough to observe, no duration picker needed) if the target lacks it, or
  removes it early if the target already has it.
- **`BattleScene`'s debug toolbar** (`this.testMode`-gated only): a single
  small corner button ("Debug Menu (F9)", bottom-right, anchored to
  `GAME_WIDTH`/`GAME_HEIGHT` so it can never collide with the grid-dependent
  HUD stack below the board) opens a full-screen modal (same dim+panel shape
  as the existing Technical Log overlay) listing Skip Wave, a No-Fail
  Stronghold toggle, and three mode-select buttons. Each mode-select button
  closes the modal and enters a new `Interaction` kind
  (`debugSpawnEnemy`/`debugPaintTerrain`/`debugStatus`), whose own picker
  grid then appears in the EXACT SAME footprint the Shop/Gear grid already
  reserves (built via the existing `buildItemGrid` helper, same
  `ITEM_GRID_PAGE_SIZE` pagination, same keyboard-grid-focus/Tab/arrow-key
  wiring `currentGridItems`/`moveGridFocus`/`refreshPageNav`/`turnGridPage`
  already provide for Build/Gear — extended with new branches, none of the
  existing building/equipping behavior touched). A tile click while a debug
  mode is active spawns the selected enemy there, paints the selected
  terrain there, or toggles the selected status on whatever hero/enemy
  occupies it — exactly mirroring Build mode's own "stay in this mode across
  repeated clicks until Done/Esc" pattern.
- **Terrain painting has NO placement validation** (no occupancy/
  buildability check) — a deliberate debug-tool simplification, tester's
  responsibility. Mutates `GameMap.data.tiles` directly (the same mutable
  array every system already holds a reference to) and repaints the one
  `tileRects` entry, mirroring `tickDynamicTerrain`'s own live single-tile
  repaint exactly. A real, small pre-existing gap fixed as a side effect:
  `buildBoard`'s per-tile pit "✕" glyphs were previously untracked
  (fire-and-forget `Text` objects) — now stored in a new `pitGlyphs` map so
  the debug painter can find and remove one if a tile is repainted away from
  "pit" (dynamic-terrain-driven pit glyphs remain untracked, same as
  before — no real map ever turns a pit back into something else, so this
  gap was never reachable there).
- **Skip Wave awards no reward gold** (a bypass, not a real clear) but
  otherwise runs the exact same post-clear continuation a real wave-clear
  uses (`afterWaveCleared` — any pending level-up/rest overlay, then the
  next wave or Victory), only enabled during the player's own phase.

Tests: 1251 → **1253** (+2: `WaveSystem.setNoFail`/`forceEndWave`/`spawnAt`
in `tests/waves.test.ts`, `Hero`/`Enemy.removeStatus` in
`tests/heroStatusEffects.test.ts`/`tests/statusEffects.test.ts`). No new
test for the `BattleScene` UI wiring itself — consistent with this
project's standing convention that `BattleScene` isn't unit-tested; every
piece of real logic it calls into (`WaveSystem`, `Hero`/`Enemy`) is tested
directly. Typecheck, all 1253 tests, and the production build (118 modules,
up from 117 — the new `TestModeScene.ts`) all pass. Not yet confirmed by
Kevin in a browser — see the new KI entry for the full checklist.

### D-139 — Enemy AI/Movement Redesign §1: decouple "taking damage" from "being stopped" — every enemy always attempts to advance, forced melee only when a hero physically blocks its ONLY route

The Enemy AI/Movement Redesign (a full design session logged in the previous
session's `PHASE_HANDOFF.md`, no code changed then) identified a real tension
between this game's tower-defense identity and its D&D-combat identity: the
old rule — "if a living hero is within reach, strike it and hold" — checked
BEFORE any movement was ever attempted, meaning an enemy attacked any hero
merely in range, whether or not that hero was actually blocking its path.
This meant a boss got drawn into permanent melee the instant it wandered
near any hero, killing the "race the clock, reach the stronghold" tension a
boss is supposed to have, and made a single off-path hero functionally
identical to a real chokepoint.

- **`WaveSystem.tickEnemyPhase`'s core per-enemy loop is restructured**: for
  every enemy that can engage heroes (`canEngageHeroes`, unchanged flag),
  two routes are computed each phase — `routeIgnoringHeroes` (walls only,
  via the existing `context.isWall` hook) and `routeAroundHeroes` (the
  existing hero+wall `context.isBlocked`, exactly what `advanceEnemy`
  already used). If `routeIgnoringHeroes` exists but `routeAroundHeroes`
  does NOT (no detour at all — a hero is the sole way through, a genuine
  dead end), the enemy is forced into melee (`forcedFight = true`) and
  resolves an attack via the SAME AoE/single-target/saving-throw code paths
  as before (unchanged math, only the trigger condition changed). If a
  detour route exists at all, the enemy simply takes it — no fight, no
  matter how close a non-blocking hero stands.
- **The wall-bash "opportunistic" branch (D-116) is now gated on
  `!forcedFight`** instead of the old "`!target`" — same trigger shape
  (a melee enemy with nothing to fight this phase and a destructible wall
  in range bashes it), just keyed to the new forced-fight decision.
- **Every other special-case branch (reinforcements, siege priority,
  trapSense priority, teleport, stunned/charmed/mimic/phase-change checks)
  is UNCHANGED** — all run before this new engagement decision, exactly as
  PHASE_HANDOFF's own "important files" note said they should be left
  alone.
- This is the "single biggest behavioral/philosophical change" from the
  design spec, and per its own build-sequence recommendation, the smallest
  diff to land: a priority reorder reusing `PathfindingSystem`'s existing
  `isBlocked`/`ignoreWalls` hooks rather than replacing them.

**Test fallout (expected and anticipated by the design doc itself):** 28
existing tests across `combat.test.ts`, `enemyCollision.test.ts`,
`enemyMechanics.test.ts`, `enemyMechanicsPhase21.test.ts`,
`enemyMechanicsPhase25.test.ts`, and `statusEffects.test.ts` had incidentally
relied on the OLD "any hero in range attacks" behavior as a convenient way
to trigger an attack for testing an unrelated mechanic (Berserker, Lifedrinker,
AoE, Mimic, Multi-Phase Boss, blinded/sapped/toppled/frightened disadvantage,
Gold Thief, wall-bash preference, saving-throw attacks). Each was updated to
recreate a genuine physical block (`isBlocked` matching the hero's own tile,
in a corridor with no detour) so the underlying mechanic still exercises
correctly under the new trigger condition — none of the underlying math
changed, only how each test provokes the attack. One test
(`enemyCollision.test.ts`'s enemy-vs-enemy passthrough test) used a hero
purely as a "stand still and hold" lure with no real blocking intent; it now
freezes its stationary occupant with a direct `applyStatus("stunned", 99)`
instead, which better isolates it from hero-engagement entirely (its own
stated intent all along).

Tests: 1253 → **1259** (28 existing tests fixed in place, +6 new: the three
scenarios PHASE_HANDOFF's build sequence explicitly named — an unblocked
enemy ignores an adjacent off-path hero, a hero as sole blocker forces melee,
a hero blocking one of two routes causes a reroute — in the new
`tests/enemyEngagementRedesign.test.ts`, alongside D-140's own new tests, see
below). Typecheck, all tests, and the production build (118 modules,
unchanged) pass. Pure `src/game/systems/` work — no browser needed to verify
this decision, per the design doc's own step-1-6 assessment.

### D-140 — Enemy AI/Movement Redesign §2: Aggressiveness (0-100), a per-enemy detour-tolerance stat

Layered directly on top of D-139's route-detection machinery, per the design
spec's own build order.

- **`EnemyDefinition.aggressiveness?: number` (`data/enemies.ts`)**: an
  optional 0-100 override. Left absent (the entire ~63-enemy roster, by
  design — see below) rather than hand-set on every entry.
- **`Enemy.aggressiveness` getter + `defaultAggressiveness()`
  (`entities/Enemy.ts`)**: when `def.aggressiveness` is absent, derives a
  sensible default from tags the roster already carries, rather than a
  value stamped on all ~63 definitions: `enrage`/`lifedrinkPercent`/
  `stealth` (Berserker/Lifedrinker/ambush archetypes — explicitly meant to
  seek a fight) → 85; `ignoresHeroes` (pure runners) → 0;
  `trapSense`/`siegeDamageMultiplier` (Saboteur/siege — objective-focused,
  never fight heroes regardless) → 10; `role: "boss"`/`"legendary"` → 15
  (**bosses default LOW so they race the clock — Kevin confirmed this
  explicitly, a high-aggro boss would undo D-139 entirely**);
  `role: "miniboss"` → 40; every ordinary minion → 55.
- **`WaveSystem.detourTolerance(aggressiveness)`**: the extra route length
  (tiles) an enemy tolerates before it stops bothering to detour — `0` →
  `Infinity` (always detours, however long); `100` → `-1` (never detours,
  not even a 0-tile "extra" — that case is caught by the `extraTiles > 0`
  check first); linear in between, `round((100 - aggressiveness) / 10)`. A
  flat, untuned first-pass formula, same convention as every other balance
  number in this project.
- **When a detour route exists but costs more than `routeIgnoringHeroes`**
  (§1's "nothing in the way" case already handled that when they're equal),
  the tolerance decides: within tolerance → takes the safe detour, same as
  before. Past tolerance → **`WaveSystem.walkAlongRoute`** walks the
  DIRECT route instead (not the safe one), stopping the instant the next
  tile is hard-blocked (a hero) or occupied by another living enemy —
  approaching and stopping adjacent (or at whatever range applies) rather
  than rerouting around the obstacle, then attacks from wherever it ends
  up if a target is now in range.
- **The aggressiveness-100 top end is a genuinely distinct behavior, not
  just the tolerance formula's extreme** (per the spec's own explicit
  note): **`WaveSystem.huntRoute`** — when nothing at all blocks an
  enemy's goal-path (so §1/the tolerance check never fires), an
  aggressiveness-100 enemy still finds the nearest hero within its own
  movement+attack reach and diverts off-path to close in and strike it.
  **No roster enemy currently defaults to exactly 100** — Kevin's spec
  reserves it for a dedicated future "true hunter" archetype, not any
  existing one — so this code path is implemented and tested (via a
  throwaway registry entry in the test, not a real content addition) but
  not yet exercised by any shipped enemy.

Tests: 1259 → **1265** (+6 in `tests/enemyEngagementRedesign.test.ts`: a
low-aggressiveness enemy always paying a long detour, a high-aggressiveness
one forcing the issue instead, the aggressiveness-100 hunt behavior via a
throwaway test-only registry entry, and the `defaultAggressiveness` bucketing
table itself). Typecheck, all 1265 tests, and the production build (118
modules, unchanged — no new source file) pass. Pure systems work, no browser
needed.

**Deferred to a future session** (per PHASE_HANDOFF's own suggested build
sequence, steps 3-7): the movement-budget/diagonal-movement rework (§4/§5),
the matching range/radius rework, siege wall-targeting's real best-wall
selection (§3), smart AoE/breath positioning for high-tier enemies (§3), and
the hero-side split-movement UI (§4's last piece, the only step needing a
browser pass). See the rewritten `PHASE_HANDOFF.md` for the full remaining
spec and build order.

### D-141 — Enemy AI/Movement Redesign §5: diagonal movement, true Euclidean cost, weighted pathfinding (step 3 of the build sequence)

The biggest remaining piece of the redesign — a genuine pathfinding algorithm
swap, per Kevin's own exact cost-model spec (logged in the prior session's
`PHASE_HANDOFF.md`, unchanged going into this session).

- **New shared module `src/game/systems/DiagonalMovement.ts`**: the weighted-
  search core both `MovementSystem` (hero-side) and `PathfindingSystem`
  (enemy-side) now share, rather than duplicating this delicate math twice.
  Exports the cost constants (`TILE_FEET = 5`, `DIAGONAL_COST_FEET = 5*sqrt(2)`),
  `roundToTileUnit` (nearest-5 rounding for budget comparisons only),
  `weightedDistances` (Dijkstra over 8 directions), and `reconstructRoute`.
- **Cost model, exactly Kevin's spec**: a cardinal step costs 5ft, a diagonal
  step costs true Euclidean 5√2 (~7.071ft). Cumulative distance along a route
  is tracked EXACTLY (unrounded) as edges are summed; only a threshold
  comparison against a movement budget rounds to the nearest 5ft. This means
  two diagonal steps in a row cost round(14.142) = 15ft, not 5+5 = 10ft —
  verified directly in the new test file (see below), matching the
  cumulative-rounding warning PHASE_HANDOFF itself flagged as worth
  confirming once built.
- **No corner-cutting**: a diagonal step is illegal if EITHER flanking
  orthogonal tile fails the same combined wall/occupancy `canEnter` check the
  caller already supplies for ordinary entry — cutting through the gap next
  to an impassable tile is not allowed, a unit must go around. (This uses the
  same combined predicate for a dynamically-occupied flank tile as for a
  static wall — the spec's own wording was about walls specifically, but the
  existing architecture doesn't otherwise separate "wall" from "occupied" in
  the predicates callers already pass in, so this generalizes the rule to
  both rather than inventing a new, narrower one.)
- **`MovementSystem`** (hero-side reachable-tiles/path/legality) and
  **`PathfindingSystem`** (enemy-side routing) both now run 8-directional
  weighted search instead of 4-directional BFS. `MovementQuery.budget` keeps
  its existing integer-tile shape (e.g. `Hero.movementBudget()`) — no data
  change to any hero/enemy definition — it's converted to feet internally and
  a tile only counts as reachable once its ROUNDED cumulative distance fits.
  This means **heroes can already move diagonally through the existing
  single-move UI with no BattleScene change at all** — `showRange`/`showPath`
  just draw whatever `reachableTiles`/`findPath` return, and neither assumes
  orthogonal adjacency.
- **`PathfindingSystem.routeToNearestGoal` now returns `RoutedPosition[]`**
  (a `GridPosition` plus a readonly `distanceFeet` — the tile's exact
  cumulative distance from the route's start), not a plain tile array. This
  is what lets `WaveSystem` slice a route to a movement budget correctly once
  steps no longer cost the same amount uniformly. **This extra field must
  never leak into a plain `GridPosition` value** (`enemy.position`, the
  public `EnemyMove.path`/`to` fields) — `WaveSystem.advanceEnemy`/
  `walkAlongRoute`/`tryTeleport` all explicitly rebuild `{x, y}` objects
  before crossing back into that territory, rather than spreading a
  `RoutedPosition` directly (an earlier draft of this change did spread it
  directly and silently corrupted `enemy.position` with a stray
  `distanceFeet` field — caught by the test suite, not by inspection; anyone
  touching this code later should keep that boundary explicit).
- **`WaveSystem`'s route-consumption math updated to match**: `advanceEnemy`,
  `walkAlongRoute`, and `tryTeleport` (the fixed `TELEPORT_JUMP_TILES = 6`
  jump) all now use a new shared `WaveSystem.affordablePrefixLength(route,
  budgetTiles)` — the largest prefix of a distance-annotated route affordable
  within a tile budget — instead of `Math.min(budget, route.length)`/
  `route.slice`. The §2 (D-140) detour-tolerance comparison (`extraTiles`)
  is now a feet-based comparison (`extraFeet`, rounded) instead of a raw
  array-length difference, for the same reason.
- **A genuine, foreseen interim seam, not a bug**: attack-RANGE checks
  (`CombatSystem.range`/`targetsInRange`/`chooseTarget`) still use Manhattan
  distance — unifying that with the new diagonal-aware movement metric is
  explicitly step 4 (§5's own "range/radius rework," not yet built). Until
  then, an enemy whose shortest route to a target ends in a single diagonal
  hop directly onto the target's own (blocked) tile has no intermediate
  waypoint to stop at, so it holds at its start position — which is genuinely
  adjacent by Euclidean distance but reads as 2 tiles away by the
  still-Manhattan attack-range check, so it does not attack that phase. This
  is real, not hypothetical: it broke one existing hunt-behavior test
  (`enemyEngagementRedesign.test.ts`'s aggressiveness-100 case), fixed by
  moving that test's hero to the same row as the hunter instead of a
  diagonal offset (see the test's own comment) rather than papering over the
  interaction — logged as **KI-093** for the next session building step 4.

Tests: 1265 → **1272** (+7, new `tests/diagonalMovement.test.ts`: the
single/double-diagonal-step rounding rule, a diagonal route being genuinely
shorter than an orthogonal one over open ground, monotonically-increasing
cumulative distance, a hero-side reachable-diagonal-tile check, and
no-corner-cutting for both `MovementSystem` and `PathfindingSystem`).
6 pre-existing tests updated in place: three (`pathfinding.test.ts` x3,
`flying.test.ts` x2) switched from `toEqual` to `toMatchObject` since a route
tile now legitimately carries `distanceFeet` alongside `x`/`y`; one
(`enemyEngagementRedesign.test.ts`) repositioned per the KI-093 note above.
Typecheck, all 1272 tests, and the production build (119 modules, up from
118 — the new `DiagonalMovement.ts`) all pass. Pure `src/game/systems/`
work — no browser needed to verify this decision itself, though the
resulting gameplay FEEL (does diagonal movement read as intended, does the
KI-093 seam actually surface in real play) still needs Kevin's own pass —
see KI-093.

**Deferred to a future session** (steps 4-7, unchanged from D-140's own
list except step 3 is now DONE): the range/radius rework to the same
distance metric (step 4 — this specifically closes KI-093), siege
wall-targeting (§3), smart AoE/breath positioning (§3), enemy-side movement-
budget-splitting/Sprint (the rest of §4, "purely an AI change" per the
spec), and the hero-side split-movement UI (§4's last piece, the only step
needing a browser pass). See the rewritten `PHASE_HANDOFF.md`.

### D-142 — Enemy AI/Movement Redesign step 4: range/radius rework to the same diagonal-aware distance metric (closes KI-093)

The natural continuation of D-141: unify attack-range, spell/ability-range,
and aura-radius checks with the same weighted distance model movement
already uses, per Kevin's own explicit call in the original design session
("except the no-corner-cutting rule, which is movement-only").

- **New `GridSystem.diagonalDistance(a, b)`**: the octile-distance shortest
  path between two tiles over open ground, using D-141's own cost constants
  (`TILE_FEET`, `DIAGONAL_COST_FEET`) and its exact rounding rule
  (`roundToTileUnit` on the final cumulative total, never per-step) —
  imported from `DiagonalMovement.ts` rather than duplicating the rounding
  rule a third time, per `PHASE_HANDOFF.md`'s own suggestion. As many
  diagonal steps as possible, then straight cardinal steps for the
  remainder. `GridSystem.manhattanDistance` is UNCHANGED and still exists —
  this is a new sibling, not a replacement, since build-range and
  shop-proximity checks (out of this decision's explicit scope — neither is
  an attack, spell, or aura) still use it.
- **`CombatSystem.range` now calls `diagonalDistance` instead of
  `manhattanDistance`.** Since this is the one choke point `isInRange`/
  `targetsInRange`/`chooseTarget`/`attackArea` all call through, every
  enemy attack, hero basic attack, aura radius (`WaveSystem`'s healer/
  aggro/damage auras), and AoE/breath attack became diagonal-aware in one
  place with no per-caller change needed in `WaveSystem`.
- **`BattleScene`'s 8 direct `GridSystem.manhattanDistance` call sites for
  spell/ability range** (`showTileSpellTargets`, `livingAlliesInRange`,
  heal-spell/AoE-at-range/teleport-self/summon/terrain-spell targeting, and
  Bardic Inspiration's nearest-ally auto-pick) switched to
  `diagonalDistance` too, since none of those route through `CombatSystem`.
  **Deliberately left as plain Manhattan** (out of scope — neither an
  attack, a spell, nor an aura): `BuildSystem`'s `BUILD_RANGE_TILES` check,
  and `BattleScene`'s shop-proximity checks (buy-gear range, nearest-shop
  pick) — changing either risks relitigating D-130's already-confirmed
  "Tide map" build-range behavior for no ask Kevin actually made.
- **A single diagonal step now reads as range 1, exactly as D-141's own
  handoff predicted it would once this landed** — melee "range 1" naturally
  includes diagonal neighbors with no special case, since one diagonal step
  rounds to 5ft same as one cardinal step. Two diagonal steps in a row still
  round to 3 tiles (15ft), not 2 (10ft) — the same compounding-rounding rule
  D-141 gave movement, now shared by range.
- **Closes KI-093**: the `enemyEngagementRedesign.test.ts` workaround
  (repositioning a diagonally-placed hero onto the hunter's own row to dodge
  the old Manhattan-only seam) is removed — a new test puts the hero back
  at a genuine diagonal offset and confirms the enemy holds position (no
  waypoint to move to) but now correctly attacks anyway, closing the exact
  gap KI-093 documented.

Tests: 1272 → **1275** (+3: two new `CombatSystem.range` cases in
`combat.test.ts` covering the diagonal-adjacent and compounding-rounding
behavior, one new hunt-behavior case in `enemyEngagementRedesign.test.ts`
exercising the real diagonal scenario instead of avoiding it). One
pre-existing test updated in place (`combat.test.ts`'s own "Manhattan
distance" range assertion, now testing the diagonal-aware value and
renamed accordingly). Typecheck, all 1275 tests, and the production build
(119 modules, unchanged — no new files this session) all pass. Pure
`src/game/systems/` and `BattleScene` targeting-math work — no browser
needed to verify this decision itself, though whether the resulting
gameplay feel (does a hero/enemy diagonally next to a target now visibly
attack it) reads as intended still needs Kevin's own pass.

**Still deferred** (unchanged from D-141's own remaining list, minus step
4 which is now done): enemy-side movement-budget-splitting/Sprint AI (rest
of §4), siege wall-targeting (§3), smart AoE/breath positioning (§3), and
the hero-side split-movement UI (§4's last piece, the only step needing a
browser pass). See the rewritten `PHASE_HANDOFF.md`.

### D-143 — Enemy AI/Movement Redesign step 5: enemy-side move-attack-move + Sprint AI

The enemy-only half of §4's remaining scope — a pure `WaveSystem` AI change,
no UI. Two pieces:

- **Move-attack-move**: landing a forced-fight attack no longer ends an
  enemy's phase outright. Whatever movement budget the pre-attack walk
  (§2's direct-approach or the aggressiveness-100 hunt route) didn't spend
  is now spent AFTER the attack, continuing toward the exit via the
  ordinary hero-respecting route (no more "forcing" — that was only ever
  to close to striking range). A true dead-end attack (no pre-attack walk
  at all, so the full budget is technically "left over") naturally finds
  no route around the hero it just hit and simply holds, same as before
  this decision; an attack that didn't need its whole budget to close
  distance now keeps going afterward — the actual "hit and run" a
  racing-the-clock boss needs, and can even carry an enemy all the way to
  the exit (and breach) in the same phase it also landed a hit.
  - `WaveSystem.walkAlongRoute` now returns `{ path, usedFeet }` instead of
    a plain tile array — `usedFeet` is the exact pre-attack distance
    spent, needed to compute how much budget remains afterward.
  - `WaveSystem.advanceEnemy` gained an optional `budgetTilesOverride`
    parameter — when given, it replaces `effectiveMovementTiles +
    movementBonus` outright. Used both for the leftover-budget leg
    (override = remaining tiles) and for Sprint (override = double budget).
  - Both attack-success branches (AoE/breath and single-target) no longer
    `continue` immediately — they set a new `attackedThisPhase` flag and
    fall through to a shared tail (trap check, `moves.push`, breach check,
    `tickStatuses`) that now serves every case uniformly.
  - **Found and fixed a real pre-existing reporting gap while restructuring
    this**: because every attack branch used to `continue` before ever
    reaching `moves.push`, an enemy that walked into position and then
    attacked previously produced NO `EnemyMove` event for that walk at
    all, even though `enemy.position` had genuinely changed. `moves.push`
    now runs for an attacking enemy whenever it actually moved (pre-attack
    walk and/or the new post-attack leftover leg) — preserved exactly
    unchanged for the non-attacking ordinary-advance path, which has
    always unconditionally reported a move event (even an empty one, when
    fully blocked/slowed) — a distinction several pre-existing tests
    depend on in both directions, both left intact.
- **Sprint**: `EnemyDefinition.sprints?: boolean` (mirrored as `Enemy
  .sprints`) doubles this phase's movement budget — the real SRD Dash
  trade. Costs nothing extra to enforce structurally: it only ever applies
  in the ordinary-advance branch (`!movementResolved && !attackedThisPhase`),
  which never also attacks, so "consumes the whole action, no attack that
  turn" falls out automatically with no separate guard needed. **Absent on
  every current roster entry** — this is a pure new capability, not a
  rebalance of any existing enemy; assigning it to specific archetypes
  (bosses wanting to visibly race the clock, most obviously) is a
  deliberately separate, not-yet-made content decision — see
  `KNOWN_ISSUES.md`. Same "build the capability, don't touch the roster"
  precedent as D-140's aggressiveness-100 hunter archetype.

Tests: 1275 → **1278** (+3: move-attack-move spending leftover budget,
Sprint doubling budget when not fighting, Sprint never applying on a phase
the enemy attacks). 2 pre-existing tests updated in place
(`enemyEngagementRedesign.test.ts`'s high-aggressiveness-forces-the-issue
case and this session's own earlier KI-093 diagonal test) — both now
correctly expect the enemy to keep moving after its attack lands, since
the scenario they set up happens to leave real leftover budget. Typecheck,
all 1278 tests, and the production build (119 modules, unchanged) all
pass. Pure `src/game/systems/` AI work — no browser needed to verify the
mechanic itself; the resulting gameplay feel (does a "hit and run" boss
read as intended) still needs Kevin's own pass.

**Still deferred** (unchanged from D-142's own remaining list): siege
wall-targeting (§3), smart AoE/breath positioning (§3), and the hero-side
split-movement UI (§4's last piece, the only step needing a browser pass).
See the rewritten `PHASE_HANDOFF.md`.

### D-144 — Drag-and-drop hero move with pinned waypoints

Kevin's own ask, independent of the Enemy AI/Movement Redesign above (same
session, different feature): click-and-hold a hero token to "pick it up,"
live-preview the distance if dropped wherever the pointer currently is,
right-click while still holding left to pin a waypoint (pinning again adds
ANOTHER waypoint in a chain, confirmed — not just one), release to commit.
Vision (the existing stealth-reveal mechanic) must key off the hero's REAL
position only on drop, never the live preview — confirmed there is no
fog-of-war system in this game to build, just make sure the preview never
triggers the existing reveal check. Planned via `EnterPlanMode` (see
`C:\Users\kevinb\.claude\plans\abstract-growing-valley.md` for the full
plan Kevin approved) given the number of real interaction-design forks
(click-vs-drag detection, waypoint chaining, budget-exceeded handling).

- **New `MovementSystem.routeThroughWaypoints(waypoints, query)`**
  (`src/game/systems/MovementSystem.ts`): routes through a sequence of
  waypoints in order (pins, then wherever the pointer is), each leg
  computed the same way `findPath` computes a single destination.
  `blocksStopping` (D-067) only ever applies to the FINAL waypoint — every
  earlier one is a pass-through corner. Each leg is computed against an
  effectively unbounded budget (`UNBOUNDED_BUDGET_TILES`) so the FULL route
  and its real distance are always returned even when over budget —
  `withinBudget: false` is the caller's own signal to render/reject, not a
  silent truncation. Per-leg tile-distance is rounded, then SUMMED across
  legs (the same "round after each leg, then treat the remainder as the
  next leg's budget" convention D-143's `WaveSystem` leftover-movement math
  just established), not one grand-total round. A waypoint identical to the
  current running position is a no-op leg, not an error. Returns `null`
  only when a leg is genuinely unreachable at ANY budget (wall/occupied, or
  a stopping-blocked FINAL waypoint).
  - `findPath` is now a one-line wrapper around a new private
    `findPathWithDistance` (identical behavior, zero risk to its ~10
    existing call sites) — the richer method `routeThroughWaypoints` needs
    to chain a leg's actual distance into the next leg's remaining budget.
- **`BattleScene.ts`** (all new state/methods, nothing existing removed):
  - `dragArmedHeroId`/`heroDrag`/`dragPinMarks` — new scene fields. A
    `pointerdown` on the currently-selected hero's own tile arms a
    potential drag (only when `hero.canMove()`, matching `showRange`/
    `isLegalMove`'s own gate); it only promotes to a real drag once
    `pointermove` actually leaves that tile, so a plain click that never
    moves is completely unaffected — click-to-select/click-to-move
    (`handleClick`/`confirmingMove`/`confirmMove`) are BYTE-FOR-BYTE
    unchanged for a player who doesn't hold-and-drag.
  - `this.input.mouse?.disableContextMenu()` (new, scene-wide, safe — no
    other right-click behavior exists anywhere else in `BattleScene`) plus
    a brand-new `pointerup` listener (none existed before) let a
    right-click-while-dragging call `addDragPin` and a release call
    `resolveDrop`.
  - `updateDragPreview` (new): drives the dragged token to the raw pointer
    position (not tile-snapped — the "picked up" feel), redraws pin
    markers, and reuses `showPath`'s own dot styling for the previewed
    route through `routeThroughWaypoints` (recolored to the existing
    "rejected" tint when over budget/unreachable), plus a live "N tiles"
    (or "— out of range"/"Blocked") readout via the existing hover-tooltip
    object (mutually exclusive with its normal hero/enemy-hover use, since
    that's skipped entirely while dragging).
  - `resolveDrop` (new): a no-pin drop back on the hero's own tile is a
    silent cancel; an unreachable/over-budget drop snaps the token back
    with the same rejection flash `handleClick`'s illegal-move path already
    uses, staying in `heroSelected` (not falling back to `idle` the way a
    stray illegal click does — a deliberate drag-and-release is a stronger
    signal); a real in-budget route commits exactly like `confirmMove`
    (`hero.moveTo`, `checkTreasureAt`, back to `heroSelected`) — `hero
    .moveTo` is called exactly once, only here, never during preview, which
    is also *why* the stealth-reveal "on drop, not on hover" requirement
    needed no code changes anywhere else: reveal checks already only ever
    read real `hero.position`.
  - `cancelDrag` (new): Esc cancels an in-progress drag (checked first in
    `handleEscape`, ahead of every other Esc behavior).
  - `moveHeroToken` (new): tweens a hero's token with the same
    pacing/instant-speed-fallback pattern `moveEnemyToken` already
    established for enemies (enemies have tweened moves; heroes previously
    always snapped instantly via `placeToken`). Used by BOTH the new
    drag-drop AND swapped into `confirmMove` in place of its old instant
    snap — unifying hero-move feel with the enemy-move feel that already
    existed, a deliberate scope choice flagged in the plan rather than a
    silent side effect.

Tests: 1278 → **1286** (+8, all in `tests/movement.test.ts`, covering
`routeThroughWaypoints`: single-waypoint parity with `findPath`, the
sum-per-leg-vs-round-once-at-the-end rounding distinction, over-budget
still returning the full route instead of `null`, a wall/occupied
intermediate waypoint rejecting the whole call, duplicate/self-matching
waypoints collapsing to a no-op leg, `blocksStopping` applying only to the
final waypoint, and no-corner-cutting still holding within a leg).
Typecheck, all 1286 tests, and the production build (119 modules,
unchanged) all pass; `npm run dev` re-checked this session (HTTP 200).
`BattleScene.ts`'s new input/rendering code has no automated test, per this
project's standing limitation for all Phaser-only work — and this feature
is more mouse-interaction-dependent than almost anything built so far, so
Kevin's own in-browser pass matters even more than usual here (see the new
KI-095).

**Deliberately out of scope for v1** (not self-scoped beyond what was
asked): a real fog-of-war/map-visibility system (confirmed not wanted —
the existing stealth-reveal mechanic was the right hook); dropping directly
onto an enemy/structure tile getting its own distinct rejection wording
(falls through to the same generic "Out of range"/blocked handling today);
a live hover-only preview option (mentioned as a "cool bonus," not the
core ask) — reveal still only ever updates on drop.

### D-145 — Enemy AI/Movement Redesign §3, step 6: real siege wall-targeting — evaluate destructible walls and walk toward the one that shortens the route most

Continues the Enemy AI/Movement Redesign (D-139 through D-143) at its own
suggested next step. Before this decision, a siege enemy
(`siegeDamageMultiplier`) only ever noticed a destructible wall that
happened to ALREADY be within its own `attackRangeTiles` — otherwise it
just routed around walls exactly like an ordinary enemy, never actually
walking toward one on purpose. This closes that gap: a siege enemy with no
wall already in reach now evaluates the destructible walls it could
plausibly reach and picks the one whose removal shortens its own route to
the exit the most, then walks toward it instead of falling through to
ordinary hero-engagement/advance.

- **`WaveSystem.bestWallTarget`** (new, private static): among the walls
  `EnemyPhaseContext.allWalls` (new context hook — an ARRAY, unlike
  `wallHpAt`'s single-tile lookup, since comparing several at once is the
  whole point) reports, prefilters to ones within a cheap Manhattan-distance
  bound of the enemy's own current `effectiveMovementTiles + attackRangeTiles`
  ("bounded to the enemy's current movement speed only," per Kevin's own
  spec wording) — not a full weighted route for every wall on the map, just
  ones plausibly worth it this phase — then, for each survivor, compares a
  real weighted route to the nearest exit with that ONE wall's tile made
  passable against the enemy's actual current route (both via the same
  `PathfindingSystem.routeToNearestGoal` every other movement decision in
  this file uses). Whichever survivor shortens the route the most, if any
  do at all, wins; a wall that was never blocking anything relevant loses to
  "no candidate" the same as if it didn't exist.
- **`WaveSystem.tickEnemyPhase`'s existing siege-priority tier** (D-111,
  unchanged for the already-in-range case) now falls through, when no wall
  is already in reach, to routing toward `bestWallTarget`'s pick via
  `pathfinding.routeToNearestGoal({goals: [target.position], ...})` — the
  SAME "goal tile is always enterable, `walkAlongRoute` naturally stops the
  instant the next tile is genuinely blocked" trick `huntRoute` (D-140)
  already established for a top-aggressiveness enemy closing on a hero, just
  aimed at a wall's own tile instead of a hero's. If the walk happens to
  close the whole remaining distance this same phase (common — the reach
  bound is sized to make that the normal case, not the exception), it
  attacks immediately afterward via the same `siegeDamageMultiplier` math
  the already-in-range case uses; either way this reports its own `moves`
  entry (a real, if small, gap the old code never had a reason to fill,
  since it never moved toward a wall before).
- **Two assignable variants, `EnemyDefinition.siegeTargeting?: "committed" |
  "reassessing"`** (`Enemy.siegeTargeting` defaults absent to
  `"reassessing"`, not assigned to any current roster entry — same
  "capability built, content assignment is a separate decision" precedent
  as D-140's Aggressiveness and D-143's Sprint):
  - `"reassessing"` (the default): calls `bestWallTarget` fresh every phase,
    so it can switch targets if the board changes.
  - `"committed"`: remembers which wall it picked
    (`WaveSystem.siegeCommittedWalls`, a per-instance `Map`, deliberately
    NOT part of `WaveStateSnapshot` — same documented imprecision as
    `reinforcementCooldowns`/`teleportCooldowns`) and keeps walking toward
    that SAME wall on every subsequent phase, without ever calling
    `bestWallTarget` again, for as long as it's still standing — even if a
    fresh evaluation would now prefer a different one. Once it's destroyed
    (the stored id no longer resolves against `allWalls()`), it re-picks
    from scratch exactly like a `"reassessing"` enemy would.
- **`BattleScene.ts`**: one new `allWalls` context entry, filtering
  `buildSystem.structures` to wall-kind structures with real (non-`undefined`)
  `hp` — the same "destructible" test `wallHpAt` already uses.
- A small, necessary reorder inside `tickEnemyPhase`'s per-enemy loop: `from`/
  `flying`/`isBlocked` and the `walked`/`forcedFight`/`movementResolved`/
  `attackedThisPhase`/`preAttackFeetUsed` tracking variables are now declared
  right after the charmed-enemy early-out, instead of just before the
  `canEngageHeroes` block — a pure hoist (nothing in between depended on
  anything computed after their old spot), needed so the new siege-targeting
  branch (which runs BEFORE `canEngageHeroes`, at the same unconditional
  priority tier the immediate-wall-in-range case already had) can use
  `isBlocked`/`flying` for its own routing and capture `from` before it does
  any moving of its own.

Tests: 1286 → **1292** (+6, new `tests/enemyEngagementRedesign.test.ts`
blocks: the default-reassessing case walking toward and eventually
destroying a wall that starts outside attack range then resuming ordinary
behavior once it's gone; preferring a wall that genuinely shortens the
route over a decoy that changes nothing; the movement-speed bound correctly
ignoring a wall far outside reach; a `"committed"` enemy re-picking a fresh
target once its original commitment is destroyed rather than getting stuck
on a dead reference; and two small `Enemy.siegeTargeting` default-getter
tests matching the existing `Enemy.aggressiveness` bucketing test's own
style). Typecheck, all 1292 tests, and the production build (119 modules,
unchanged — no new files) all pass. Pure `src/game/systems/`/`BattleScene.ts`
context-wiring work — no browser needed to verify the logic itself, though
the resulting gameplay feel (does a siege enemy now visibly march toward a
wall worth breaking, rather than just bumbling into one by luck) still needs
Kevin's own pass — see the new **KI-096**.

**Deferred, unchanged from D-143's own list**: smart AoE/breath positioning
for high-intelligence/high-tier enemies (§3's other bullet) and the
hero-side split-movement UI (§4's last piece, the only remaining step
needing a browser pass). `siegeTargeting: "committed"` is not assigned to
any roster enemy yet — same as Sprint, a separate, not-yet-made content
decision.

### D-146 — Enemy AI/Movement Redesign §3's AoE half: smart breath-weapon positioning, PLUS a new self-defense mechanic (provoked retaliation)

Closes the last purely-systems piece of the Enemy AI/Movement Redesign
(§3's AoE half — only the hero-side split-movement UI, §4's last bullet,
remains). Kevin also raised a related but separate gap in the same session:
enemies that unconditionally prioritize an objective (a siege enemy bashing
a wall, a Saboteur disarming a trap) would stand there and absorb hits from
an adjacent hero all battle without ever fighting back — "these enemies
don't just stand there and get their head chopped off without even trying
to hit back." Both are built here since they touch the exact same per-enemy
decision tree in `WaveSystem.tickEnemyPhase`.

**Smart AoE/breath positioning:**

- **`WaveSystem.qualifiesForSmartPositioning`** (new, private static): true
  for an `activeDef.aoeAttack` enemy whose `role` is `"boss"` or
  `"legendary"` — reusing `role` as this project's existing tier concept
  (the same distinction `defaultAggressiveness` already keys its own
  boss/legendary bucket off of) rather than inventing an unused
  "intelligence" stat. Reads `activeDef` (not `def`) so a Multi-Phase Boss
  that only GAINS `aoeAttack` via `phaseChange.overrides` (Sundered King)
  correctly qualifies once it actually crosses that threshold, not before.
  Every current minion-tier AoE enemy (Cave Drake, Frost Warden) is
  deliberately excluded, keeping today's simpler "walk toward the exit,
  attack whoever ends up in range" behavior, per Kevin's own spec wording.
- **`PathfindingSystem.reachableTiles`** (new): every tile reachable from a
  start position within a movement budget, each carrying its exact
  cumulative distance — the same `weightedDistances` core every other
  routing decision in this file already shares, just returning the whole
  reachable SET instead of one goal-directed route. Deliberately INCLUDES
  the start tile at distance 0 (unlike `MovementSystem.reachableTiles`,
  which excludes it) — "don't move at all" is a legitimate candidate for a
  positioning decision.
- **`WaveSystem.bestPositioningTile`** (new, private static): among every
  tile `reachableTiles` reports, the one hitting the most heroes within
  `attackRangeTiles` at once — or null if the best any tile can do is 1 or
  fewer (not worth abandoning the ordinary advance/detour/hunt decision for
  a result no better than what it would get anyway). Ties prefer the
  cheapest tile to reach, `enemy.position` itself winning any tie against a
  tile that requires moving at all.
- **Wired into `tickEnemyPhase`** as the FIRST check inside the existing
  `canEngageHeroes` block, ahead of the §1/§2 detour/hunt logic: a
  qualifying enemy that finds a beneficial tile walks there
  (`routeToNearestGoal` + `walkAlongRoute`, the same "goal tile is always
  enterable" trick `bestWallTarget`/`huntRoute` already established) and
  fights from it — even when nothing was otherwise blocking its path, since
  a real breath weapon wasted on a single target when repositioning one
  tile over would catch the whole party is exactly the behavior this fixes.
  A non-qualifying enemy, or a qualifying one with nothing to gain, falls
  straight through to the unchanged §1/§2 logic.

**Self-defense (provoked retaliation) — a new mechanic, not originally part
of the redesign spec, added at Kevin's request this session:**

- **`Enemy.markProvoked()`/`.isProvoked`/`.clearProvoked()`** (new): a
  single per-instance boolean. `markProvoked` is called by
  `BattleScene.showHeroHit` — already the one place every hero-vs-enemy
  landed-hit call site in the scene funnels through for its flash flourish,
  so no other call site needed touching. `isProvoked` is read, and the flag
  unconditionally cleared, the instant `tickEnemyPhase` reaches that enemy's
  own turn — a genuinely TEMPORARY, one-phase aggro spike, never a persisted
  grudge. An enemy that never reaches its own turn that phase at all
  (stunned, charmed, killed by a burn tick first) simply carries the flag
  into its next real turn instead, unaffected.
- **`WaveSystem.tickEnemyPhase`**: computes `hasProvokedTarget` (provoked,
  not `ignoresHeroes`, and a hero is CURRENTLY within `attackRangeTiles`)
  right after the flag is consumed. When true, it forces `forcedFight` and
  is checked BEFORE the siege-wall-priority and `trapSense`-priority
  branches (both gated with an added `&& !hasProvokedTarget`), so a
  provoked siege/Saboteur enemy strikes the hero that hit it instead of its
  usual unconditional objective THIS phase — then reverts to ordinary
  priority the very next phase once the flag is spent. The existing
  `canEngageHeroes` block (detour/hunt/positioning) is now also gated
  `&& !forcedFight` so none of it second-guesses or moves the enemy once
  self-defense has already decided the fight; the attack itself resolves
  through the exact same AoE/single-target/saving-throw code every other
  `forcedFight` case already uses, from the enemy's CURRENT position (no
  movement) — matching Kevin's literal ask ("if they are in range... that
  they do that"), not a chase mechanic.
- **`ignoresHeroes` is the exemption Kevin explicitly asked for** ("some
  uber powerful siege monster that literally doesn't care about the heroes
  at all") — the flag every pure-runner archetype (Sprinter, Bolt Runner)
  already carries, reused as-is rather than adding a new opt-out field.
- Deliberately NOT hooked at the `CombatSystem.applyAttack`/`attackArea`
  level — those functions don't know which SIDE is attacking (they resolve
  enemy-vs-hero and hero-vs-enemy identically), so marking provoked there
  would also fire for a charmed ally's attack or a trap hit. `showHeroHit`
  is the narrower, already-hero-specific funnel.

Tests: 1292 → **1299** (+7, `tests/enemyEngagementRedesign.test.ts`: three
for smart positioning — a legendary repositioning to hit two heroes at once,
a minion-tier AoE enemy keeping the old simple behavior as a stark contrast
(0 attacks vs. 2), and a qualifying enemy with nothing to gain falling
through unchanged — and four for self-defense: a siege enemy retaliating for
exactly one phase then reverting, a provoked enemy with no target in range
doing nothing differently, the `ignoresHeroes` exemption, and a plain
flag-behavior unit test). Typecheck, all 1299 tests, and the production
build (119 modules, unchanged — no new files) all pass. Pure
`src/game/systems/`/`src/game/entities/Enemy.ts` work plus one
`BattleScene.ts` one-line hook — no browser needed to verify the logic
itself, though the resulting gameplay feel (does a sieging enemy visibly
turn and hit back, does a legendary's breath attack visibly reposition)
still needs Kevin's own pass — see the new **KI-097**.

**This closes the Enemy AI/Movement Redesign's last pure-systems piece.**
Only §4's last bullet — the hero-side split-movement UI, which needs a
browser pass by its own nature — remains from the original spec.

### D-147 — Character Creation overhaul, pieces 1-5: choice-picker overlay, real hero naming, Point Buy, class/race previews, subclass-row clarity

Kevin's 2026-08-21 feedback session called Character Creation "garbage" and
asked for it to move much closer to a real character builder (DnDBeyond-
level) — logged in full as KI-098. Given the scope, planned via
`EnterPlanMode` into five independently-testable pieces rather than one
giant change, per this project's standing practice for a system this size
(see D-133/D-135/D-136's precedent). Investigation before planning also
resolved two of Kevin's open questions with NO code change: spell-class
gating was already real (external per-class allow-lists in
`data/characterCreation.ts`, consumed by `SpellPreparationSystem`) —
Kevin's suspicion that all spells were open to all casters was incorrect;
and subclass picking already existed in Character Creation for the three
level-1-choice classes (Cleric/Sorcerer/Warlock).

**Piece 1 — a reusable choice-picker overlay, replacing click-to-cycle for
Class/Race/Gear/Subclass:**

- **`CharacterCreationScene.openChoicePicker`** (new): a thin wrapper around
  the scene's existing `renderPlanPrompt` — the same dim-backdrop/title/
  button-grid primitive the Level Planner (D-133) and Spell Picker (D-135)
  wizards already share via `levelPlanOverlay`/`clearLevelPlanOverlay`.
  Picking an option applies it and closes immediately; Cancel discards the
  click. A full-screen overlay was chosen over any inline-expanding widget
  specifically because this scene's per-hero column already sits close to
  `GAME_HEIGHT`'s headroom (documented fragility, KI-083) — an overlay
  draws on top and can't disturb the column's hardcoded row-by-row layout.
- Class, Race, Gear, and Subclass rows converted to open this picker
  instead of cycling one option at a time. Name (superseded by piece 2),
  ability scores (superseded by piece 3), and Signature Action are
  unchanged in this piece — Signature Action was deliberately left as a
  cycle button (a short, ~4-option list per class, where cycling was never
  the actual complaint).

**Piece 2 — real hero naming:**

- The Name row is now a genuine HTML `<input>` (`this.add.dom(...)
  .createFromHTML(...)`), this project's SECOND use of one — the first was
  `CoopLobbyScene`'s join-code field (KI-062), whose exact technique this
  reuses: `stopPropagation()` on keydown so typing doesn't leak into the
  scene's own hotkeys, and `main.ts`'s pre-existing `dom.createContainer`
  config. The starting value is set as a JS property (`node.value = ...`),
  never baked into the HTML string, so a loaded save's name can't break or
  inject into the markup.
- `SlotState.nameIndex` (an index into `CHARACTER_NAME_POOL`) became
  `SlotState.name: string`; the pool still seeds a fresh slot's default.
  `refreshSlot` no longer writes to the name field at all (writing back
  into a live DOM input the player is actively typing into would fight
  their cursor position) — the input is now the sole source of truth for
  its own value between explicit rebuilds.
- New validation: a blank/whitespace-only name (newly possible now that a
  name is free text) blocks Start Battle, same as a duplicate name already
  did — `refreshAll`'s existing duplicate-name check gained a sibling
  `blankName` check.

**Piece 3 — Point Buy as a second ability-score method:**

- **`PointBuyAllocator`** (new, `CharacterBuildSystem.ts`) implements the
  same `scores(): AbilityScores` contract `StandardArrayAllocator` already
  had — formalized as a new shared `AbilityScoreAllocator` interface both
  now implement. Real SRD 5.2.1 point-buy: a 27-point budget, the exact
  published cost table (8-13 cost 1 point per step, 13→14 and 14→15 cost 2
  each), floor 8/ceiling 15. `increase`/`decrease` silently refuse a move
  that would exceed the budget or leave the valid range — the same
  "can't-produce-an-invalid-state" guarantee `StandardArrayAllocator` gets
  by construction (a permutation), just enforced per-call here instead.
  `pointBuyAllocatorFromScores` mirrors `allocatorFromScores`'s defensive
  reconstruction-from-save pattern.
- **A single PARTY-WIDE toggle** ("Ability Scores: Standard Array / Point
  Buy"), not per-hero — matching real 5e practice, where this is a
  table-wide ruleset choice. Placed side-by-side with the pre-existing Team
  Level control on the same row (`buildPartyWideAbilityControls`, replacing
  the old single-button `buildTeamLevelControl`) rather than adding a new
  row — again to avoid `GAME_HEIGHT`-headroom risk (KI-083). Switching the
  method resets every slot's allocator to a FRESH instance of the newly
  chosen kind; no attempted conversion between the two.
- Each of the six per-hero ability rows now carries BOTH a Standard-Array
  cycle button and a Point-Buy +/- stepper pair, occupying the same row
  position, with only the set matching the current method visible/
  interactive (`refreshAbilityScoreControls`, run after `setSlotActive` so
  it has final say). Point Buy's remaining-points readout rides on the
  first (STR) row's own label — deliberately not a new line/row, for the
  same layout-fragility reason — reusing the existing measure-then-shrink
  font logic (renamed from `fitSubclassLabelToWidth` to the more general
  `fitLabelToColumnWidth`, now serving two different labels) in case the
  longer "Points Left: N/27" text would otherwise overflow the button.
- `CharacterBuild` gained an optional `abilityScoreMethod?: "standardArray"
  | "pointBuy"` field (undefined means "standardArray," identical to every
  pre-D-147 build) so a saved/loaded party reconstructs the right allocator
  kind without guessing from the numbers alone.
- New tests in `tests/characterBuildSystem.test.ts`: the cost table exactly
  (including the two non-1-point steps), refusing past the cap, refusing
  below the floor, refusing an unaffordable increase even under the cap,
  round-tripping via `pointBuyAllocatorFromScores`, and a defensive
  out-of-range clamp.

**Piece 4 — class preview:**

- **`CharacterClassDefinition.previewSummary: string`** (new, required
  field, all 12 classes) — a one-sentence, original (not SRD-copied) "what
  does this class play like" summary grounded in this project's OWN
  modeled mechanics (Rage, Sneak Attack, Divine Smite, Metamagic, etc.),
  not generic flavor text. Surfaced as each option's `desc` in the Piece 1
  Class picker — no new overlay needed, since `renderPlanPrompt` already
  supports a `desc` per choice.

**Piece 5 — race preview (real data only) + subclass-row clarity:**

- Race picker options show `speedTiles` and each trait's `name` as their
  `desc` — deliberately NO invented ability-score bonus. The picker's own
  title states plainly that SRD 5.2.1 (the ruleset this project's spell-
  prep economy, D-134, already committed to) moved ability-score increases
  from Race to Background, so none are missing here — Kevin's request to
  "show what bonuses... they'd get from picking that race" read like a
  2014-edition assumption, and inventing one would have silently reversed
  an existing locked decision (D-134) without Kevin's sign-off.
- **`subclassSummary`** (existing method) reworded for a later-choice
  class: previously said only "chosen in battle at level N (M options)," as
  if creation-time planning weren't possible; now explicitly names "Plan
  Levels" (D-133) as where that pick can already be made ahead of time, and
  shows the planned subclass's name once one is set.

Tests: 1299 → **1308** (+9, all in `tests/characterBuildSystem.test.ts`'s new
`PointBuyAllocator`/`pointBuyAllocatorFromScores` blocks). Typecheck, all
1308 tests, and the production build (119 modules, unchanged — no new
source files, only edits to existing ones) all pass. `npm run dev` serves
HTTP 200. No browser available in this environment — the picker overlays'
actual click-through, the DOM name field's real typing behavior, and Point
Buy's live math all still need Kevin's own pass; see the new **KI-099** for
the full checklist.

**Deliberately not built this pass** (see KI-098 for the complete original
list): "add more races" (unblocked by piece 1's picker, but a content-
writing task, not a UI-mechanism one); move-speed-scales-with-map-size (a
systems/balance topic); the Battle HUD/action-selection redesign,
initiative, XP-split toggle, and overworld campaign (all separately
tracked, Kevin picked Character Creation specifically this session).

### D-148 — Battle HUD / actions / character sheet overhaul: selection-gated panel, a real action registry, level-up deltas, a new Character Sheet scene with hotkeys, generalized tooltips, an equip preview

KI-098's OTHER strong pain point (Kevin's stated #1), picked over D-147's
Character Creation thread's competing priorities this time. Planned via
`EnterPlanMode` into ~9 pieces; Kevin explicitly chose to attempt the whole
sequence in one session rather than splitting it across sessions when asked.

**Piece 1 — selection-gated hero panel:** `refreshStatus()`
(`BattleScene.ts`) now prints only name/level/HP for every hero in the
always-on roster strip; AC (D-132), move/act readiness, and gear count moved
into a `detail` block shown ONLY for the currently selected hero. Kept as a
single `statusText` reformat rather than a second `Text` object, to avoid
touching the fragile `statusBlockHeight`/`cy` layout math the D-126/KI-083
wrap-height fix depends on.

**Piece 2 — `HeroActionRegistry`:** new pure `src/game/systems/
HeroActionRegistry.ts` — `listHeroActions(hero)`/`firstAvailableHeroAction
(hero, kind)` replace `showBonusActionButtonFor`/`showClassActionButtonFor`'s
hand-written 13-feature `if/else` chains with one ordered table, each entry
just wrapping the hero's existing `canUseX()` getter (a pure extraction, no
new rule). `tests/heroActionRegistry.test.ts` (+14) proves every entry's
availability matches its direct `canUseX()` call.

**Piece 8 — level-up popup shows real deltas:** `applyClassLevelUps`
(`BattleScene.ts`) now snapshots `effectiveMaxHealth`/`armorClass`/
`effectiveAttackBonus` before `levelUpClass()`, and a new pure
`levelUpDeltaSummary(before, after, classId, newLevel)`
(`LevelUpPlanSystem.ts`) turns the before/after pair plus any class feature
gained at the new level (`getClassDefinition(...).features`, same field
`CompendiumScene`'s `classFeatureBlocks` reads) into real text — fed into
`showLevelUpAckQueue`'s "Continue" button as its `desc`. Scoped deliberately
to the PLAIN ack popup only (KI-085/D-130's "even when no choice was
required" gap) — the subclass/ASI/spell-pick overlays already state their
own choice being made and were left alone. `tests/levelUpPlanSystem.test.ts`
(+6) covers the pure summary function directly.

**Piece 0 — a real second Phaser scene for the sheet, paused/resumed over
BattleScene:** nothing in this codebase had exercised `scene.launch` +
`scene.pause()`/`scene.resume()` before (the existing `BattleStateSnapshot`,
D-101, was built for a hypothetical multiplayer-sync feature and is never
called from any scene — not a ready-made vehicle for this). Chose this over
an in-BattleScene overlay `Container` specifically so the sheet gets
`uiTheme.ts`'s parchment/Cinzel styling for free and doesn't grow
`BattleScene.ts` (already 8000+ lines) further. De-risked by static
inspection rather than a throwaway spike-then-rebuild: grepped for any raw
`window`/`setInterval`/`setTimeout` listener in `BattleScene.ts` that might
bypass Phaser's scene-pause gating (none exist — every timed/animated thing
runs through `this.time.delayedCall`/`this.tweens.add`, both scene-scoped
and known to pause automatically with the scene), so the real Stats-tab
content (piece 4) was built directly instead of a "hero name + Close button"
throwaway. **This is the one part of this session's work that most needs
Kevin's own in-browser confirmation** — see KI-100 below.

**Piece 3 — the action hotkey bar, new `Hero` state:** `Hero._actionHotkeys`
(`ACTION_HOTKEY_SLOT_COUNT = 6` slots, `string | undefined` each) is a
curated, slot-ordered SUBSET of what a hero could do — distinct from
`knownSpellAbilityIds()`/`HeroActionRegistry` themselves, which answer "what
COULD this hero use." `setActionHotkey(slot, id)` validates against both of
those plus the hero's frozen `abilityId` before accepting, silently
refusing anything else (same convention as `PointBuyAllocator`), and accepts
`null` as well as `undefined` for "clear" — `JSON.stringify` turns an
`undefined` array element into `null`, so a save round-trip genuinely
produces `null`, not `undefined`. Threaded through `CharacterBuild` →
`HeroDefinition` → `Hero` exactly mirroring `preparedSpellIds`' three-hop
chain (D-135); also added to `HeroSnapshot`/`toSnapshot`/
`restoreMutableState` for parity with every other mutable battle field.
Deliberately did NOT add a defensive check to `SaveSystem.isCharacterBuild`
— that function only ever validates REQUIRED fields (checked before adding
anything, to match real convention over the plan's original guess).
`tests/heroActionHotkeys.test.ts` (+9) covers validation and a real save/
load round-trip via the existing fake-`SaveStorage` harness.

**Piece 7 — generalized the tooltip primitive (built ahead of pieces 4-6
since they depend on it):** `unitTooltip`'s floating, canvas-clamped
`Text`-object mechanic (D-132) is now `src/game/scenes/tooltip.ts`'s
`createTooltipController`/`attachHoverTooltip` — one controller (one Text
object) per scene, reusable by any interactive Phaser object, not just grid
tiles. `BattleScene`'s OWN tile-hover tooltip was migrated onto this shared
controller (not left running in parallel) so the generalization is
proven by its first real caller, not just built and left unused.

**Piece 4 — Character Sheet, Stats tab (read-only):** ability scores (with
modifiers), AC/HP/movement/proficiency bonus, class/subclass/level, and a
"available right now" list built from `HeroActionRegistry` plus the caster/
non-caster action check. Opened via a new "Character (C)" button/keybind
next to the selected-hero HUD row (visible only while a hero is selected),
which calls `this.scene.launch("CharacterSheetScene", { hero })` +
`this.scene.pause()` — the LIVE `Hero` instance is passed (Phaser scene data
isn't serialized for an in-process `launch`), so hotkey edits apply
instantly with no sync step on Close/resume.

**Piece 5 — Spellbook tab:** every id in `knownSpellAbilityIds()` (the whole
known list, not filtered to `canCastSpell()` like the in-battle Q menu),
grouped by `AbilityDefinition.spellSlotLevel ?? 0` with a level-selector row
matching `CompendiumScene`'s `SPELL_LEVEL_LABELS` pattern — closing Kevin's
"gross flat list" complaint about `renderSpellbookOverlay`'s permanently-
visible description text; full rules text now shows on hover instead (Piece
7's tooltip).

**Piece 6a — Hotkeys tab (sheet-side editing only):** click a slot to arm
it, then click any currently-available `HeroActionRegistry` action or known
spell to pin it there (`hero.setActionHotkey`); a Clear Slot control when a
slot is armed.

**Piece 6b — NOT built this pass, deliberately deferred:** replacing
`BattleScene`'s four fixed action buttons/keybinds (Q/R/F/T →
`onAbilityButton`/`onBonusActionButton`/`onActionSurgeButton`/
`onClassActionButton`) with a hotkey-row driven by `hero.actionHotkeys()`.
The plan itself flagged this as the epic's largest, riskiest single change
and explicitly allowed splitting it out. Rebuilding BattleScene's core,
heavily-tested action-input model around a brand-new, entirely unverified
hotkey-editing UI — before Kevin has even tried that UI once — would risk
"replacing a working system" (this project's rule 1) for a feature that
might still need shape changes after his first pass. The existing Q/R/F/T
buttons are completely untouched and still work exactly as before; only
`HeroActionRegistry` now backs two of them internally (piece 2).

**Piece 9a — equip hover preview:** hovering a hero token on the board while
an item is selected in equip mode now appends a before/after AC/attack-bonus
line to the existing D-132 hover tooltip (`updateUnitTooltip`), computed via
a throwaway `Hero.fromSnapshot(hero.toSnapshot())` clone so hovering never
touches the live hero, gold, or requires walking `equipGearOnHero`'s full
cost/attunement/grip validation (irrelevant to a pure preview). This
directly answers Kevin's "no before/after stat comparison" complaint without
touching the click-item-then-click-hero-token flow itself.

**Piece 9b — NOT scoped, deliberately deferred:** the actual equip-flow
redesign (likely an Inventory tab inside the new sheet, replacing the
click-item-then-click-board-token gesture). Kevin gave no target UX for this
beyond "confirmed bad" — per this project's "preserve working systems" rule,
guessing at a replacement design wasn't attempted.

Tests: 1308 → **1337** (+29: 14 `heroActionRegistry`, 6 `levelUpPlanSystem`,
9 `heroActionHotkeys`). Typecheck, all 1337 tests, and the production build
(122 modules, +3: `HeroActionRegistry.ts`, `tooltip.ts`,
`CharacterSheetScene.ts`) all pass. `npm run dev` serves HTTP 200. No
browser available in this environment — every piece here is UI/UX by
nature, and piece 0's scene-pause mechanism specifically has never been
exercised anywhere in this codebase before; see the new KI-100 for the full
in-browser checklist, led by that mechanism.

### D-149 — Two confirmed bugs from Kevin's 2026-08-21 playtest: the waypoint-pinning defect (D-144) and the Main Menu title/corner-control overlap

Picked up over KI-098's other still-open threads, per Kevin's own steer that
day: fix the two confirmed bugs before starting a new feature thread.

**Waypoint pinning:** the real defect was in `BattleScene.wireInput`'s global
`pointerup` handler, not in `addDragPin`/`routeThroughWaypoints` (both were
already correct — a pin genuinely gets pushed onto `heroDrag.pins` on every
right-click, and `MovementSystem.routeThroughWaypoints` already loops over
however many waypoints are passed). The `pointerup` handler fired on ANY
button release, including the right button's own release right after
`pointerdown`'s `rightButtonDown()` branch had just pinned a waypoint — so
it immediately called `resolveDrop`, committing the hero to that first pin
and ending the drag before a second right-click could ever add another one.
Fixed by returning early on `pointer.rightButtonReleased()` so only a LEFT-
button release can end/resolve a drag.

This also explains the linked complaint ("the move-range highlight doesn't
update to assume movement from the latest pinned waypoint onward"): once the
drag was ending after the first pin, there was never a second pin for the
highlight to reflect. Fixed independently anyway, since the highlight itself
was ALSO stale even for the single-pin case — `showRange`'s reachable-tile
highlight is drawn once when a hero is selected and was never recomputed
once a drag started pinning waypoints. New `updateDragRangeHighlight()`
(`BattleScene.ts`) reroots the highlight at the latest pin (or the hero's own
tile with zero pins) with whatever movement budget the pinned legs haven't
already spent — computed via the same `routeThroughWaypoints` the drop/
preview logic already uses for consistency — and is called every time
`addDragPin` changes the chain.

**Main Menu overlap:** the title text (`MainMenuScene.buildTitle`) at its
fixed 58px size can render wide enough to reach into the top-right Settings/
Account controls' bounding box (x 980-1240, y 10-110) — the flanking
decorative line either side of the title was hand-positioned at a guessed
±300px half-width that undershoots the font's real rendered width. Rather
than hardcode a smaller guessed size, this measures the title's real
`getBounds()` against that corner region and shrinks the font 2px at a time
(floor 40px) until they stop overlapping — the same "measure, don't guess"
approach `uiTheme.fitLabelToWidth` already uses for button labels, so the
fix holds regardless of exactly how wide Cinzel (or its fallback) actually
renders in a given browser.

Both fixes are headless-verified only (typecheck/1337 tests/build all
pass) — see the new KI-101 for the two specific things to re-check in a real
browser: right-click a hero mid-drag twice and confirm both pins land with
the highlight following each one, and confirm the Main Menu's top-right
corner no longer touches the title at any window size tried.

### D-150 — Compendium/Bestiary organization: alphabetized categories, new Buildings/Traps tabs, Bestiary role tabs

Picked by Kevin over Maps & Map Builder, Progression systems, and small
polish items, from KI-098's remaining threads.

**Alphabetization:** `CLASS_DEFINITIONS` (`data/classes.ts`) and
`SKILL_ORDER` (`data/skills.ts`) were re-sorted alphabetically IN PLACE — an
Explore-agent survey confirmed each array's only order-sensitive consumer
besides this Compendium display is its own file's order-independent
lookup, so reordering the source is safe (and gives Compendium's own
Classes selector row the same alphabetical order as a side effect).
`SUBCLASS_DEFINITIONS`, `RACE_DEFINITIONS`, `FEAT_IDS`, and `POTION_ORDER`
were deliberately left UNTOUCHED at their declared order and instead get a
display-only sorted copy (`[...ARRAY].sort(...)`) inside
`CompendiumScene.ts`'s `flatCategoryText`, because each backs real
order-sensitive behavior elsewhere that alphabetizing would have silently
changed: `CharacterBuildSystem.subclassIdForNewBuild` reads a class's two
subclasses by index (0 = SRD one, 1 = original one) out of
`SUBCLASS_DEFINITIONS`' own declared order; `RACE_IDS[0]` (derived from
`RACE_DEFINITIONS`) is the default new-build race; `FEAT_IDS` and
`POTION_ORDER` drive the ASI/feat-picker overlay and the Shop grid's item
order respectively. Same reasoning kept `STATUS_EFFECT_ORDER` (on-token
badge render order, debug status picker) untouched too. `classFeatureBlocks`
and every class/subclass `features` array stay level-ordered, not
alphabetized — sorting those would scramble a level-1-through-20 table into
nonsense.

**Buildings/Traps Compendium tabs:** `STRUCTURE_DEFINITIONS`
(`data/structures.ts`) had no Compendium category at all before this —
seeing wall/trap/platform detail required opening the Build shop mid-battle.
Split into "Buildings" (kind `wall` + `platform`, since a Gate is still
`kind: "wall"` with `blocksHeroes: false`) and "Traps" (kind `trap`), each
grouped by sub-type (wall vs. platform; ground- vs. flying-targeted trap)
then alphabetized within the group, matching Kevin's "grouped by type, then
alphabetical" phrasing exactly. Both tabs show ALL entries including the two
`cost: 0` spell-conjured structures (Spectral Wall, Web Patch) that never
appear in `SHOP_ORDER` — same "Compendium shows all data, not just what's
purchasable right now" convention every other category already follows —
tagged "spell-conjured, not shop-buyable" instead of a gold cost.

**Bestiary role tabs:** replaced the single flat, role-grouped, continuously
-paginated scroll with real tabs — one button per `GROUPS` entry (Minions/
Miniboss/Bosses/Legendary), mirroring `CompendiumScene.buildTabs`'s exact
pattern (`centeredRowX` + `createOrnateButton`, `variant: "tab"`,
`setSelected` highlighting). `buildRoster` now filters to just the selected
tab's role instead of flattening every group into one list; Prev/Next pages
within that role only, resetting to page 1 on a tab switch. The per-role
heading (previously drawn inline wherever a new group started mid-scroll)
is now a single persistent line at the top of the panel showing the
selected role's name and count.

**Artificer question, resolved (no code change):** confirmed Artificer's
absence from the Compendium is intentional, not an oversight — grep found
zero references anywhere in `src/`. Artificer is sourced from Tasha's
Cauldron of Everything, not core SRD 5.2.1, so this project's SRD-only
content rule (`SOURCE_OF_TRUTH.md` §3) already correctly excludes it.

No rule changes, no new tests (both scenes are presentation-only per this
project's architecture split — `src/game/scenes/` renders and takes input,
it doesn't hold testable rules — and neither had a prior test file).
Typecheck, all 1337 tests, and the production build (122 modules) all pass.

### D-151 — KI-098 small polish items: Cape of Billowing recolor, Exit Game control

Both of KI-098's "Small polish items" — the last quick, low-risk pair left
in that list.

**Cape of Billowing recolor:** the drawn cape graphic
(`BattleScene.updateHeroCapes`) was found to be wrongly reusing
`COLORS.heroActive` (the selected-hero token highlight color, a light
green) — not a deliberate placeholder choice, just the wrong constant. Gave
it its own dedicated color, `COLORS.capeBillowingPlaceholder` (a deep red,
`0xb0202a`, `config.ts`), matching Kevin's literal ask ("recolor red") and
fixing what was actually a stray color reuse rather than an intentional
placeholder.

**Exit Game control:** added to `MainMenuScene`, mirroring the version
tag's corner on the opposite side (bottom-left, well clear of every other
row/control). Real constraint worth recording: a web page cannot force-
close a browser tab it didn't itself open via script — `window.close()`
silently no-ops for a normal tab (this is a deliberate browser security
restriction, not a bug to work around). The button still calls
`window.close()` first (so it DOES work in whichever context actually
permits it — a script-opened window, or a future desktop/PWA wrapper), then
unconditionally swaps its own label to "You may now close this tab" and
disables itself — so clicking it always visibly does something, rather
than silently no-op'ing in the overwhelmingly common browser-tab case.

No rule changes, no new tests (both are presentation-only: a color
constant and a menu button). Typecheck, all 1337 tests, and the production
build (122 modules) all pass.

### D-152 — A real in-battle pause menu (Resume/Save Party/Save & Exit/Load Game/Exit to Main Menu/Controls/Game Speed)

Kevin asked directly for an in-game menu with (at minimum) "Save and Exit"
and "Exit" with an unsaved-progress warning, plus optionally Save, Load,
Audio settings, Controls, and Visual/graphics settings. Planned via
`EnterPlanMode` after a research pass into what's real vs. what would be
dead scaffolding.

**A real pre-existing gap this closes**: `BattleScene.handleEscape`'s final
`else` branch (nothing else going on) used to call
`this.scene.start("MainMenuScene")` **immediately, with zero confirmation or
save** — a silent, unwarned exit that's been there since Esc's very first
context-sensitive handling. The new pause menu is that fallback now.

**Scope decisions, each with a real reason, not a guess:**
- **"Save" does not, and cannot today, resume this exact battle.**
  `SaveSystem`/`SaveSlot` only ever stores a party BUILD (race/class/
  ability scores — the `CharacterBuild[]` shape), never wave/gold/board
  state. `BattleStateSnapshot` (D-101) CAN fully serialize a live battle but
  was built for a hypothetical multiplayer feature and is wired into
  nothing — reusing it here would be a materially bigger feature than "add
  a menu," so it wasn't attempted. "Save Party" is worded honestly as
  saving the party's build for a FUTURE battle, not a checkpoint.
- **Audio settings: not built.** Confirmed via grep that zero audio system
  exists anywhere in `src/` (KI-029 still accurate). Building a settings
  control for a system that doesn't exist is exactly the dead-scaffolding
  pattern Kevin has explicitly corrected before.
- **Visual/graphics settings: reused, not reinvented.** The one real
  setting in the whole game is Game Speed (`SettingsSystem.
  animationSpeed`) — the menu's "Game Speed" button calls `BattleScene.
  cycleGameSpeed()` (changed from `private` to public, and now RETURNS the
  new `AnimationSpeed` instead of `void`) — the exact same logic the
  existing in-battle "S" hotkey already uses, not a second copy of it.
- **Controls: a read-only reference list** of the real current keybindings
  (compiled from an actual grep of every `keydown-` handler in
  `BattleScene.ts`, not guessed) — no rebinding system exists or was added.

**The real gap that had to be closed to make Save/Load possible at all**:
`BattleScene` only ever received `HeroDefinition[]` (the already-expanded
per-hero shape `heroDefinitionFromBuild` produces), never the original
`CharacterBuild[]` — and confirmed via Explore-agent grep, `HeroDefinition`
has NO `raceId` field at all (race is baked into a plain `movementTiles`
number and discarded), so reconstructing a `CharacterBuild` from a live
`Hero`/`HeroDefinition` is genuinely lossy, not just tedious. Fixed at the
source instead: `CharacterCreationScene`'s "Start Battle" handler — the ONE
place in the codebase that still has the real `CharacterBuild[]` in hand —
now forwards `originalParty` (that array) and `loadedSlotId` into
`BattleScene`'s init data alongside the existing `heroDefinitions`.
`CoopLobbyScene`'s own `scene.start("BattleScene", ...)` call is untouched,
so a coop battle simply has no `originalParty` — Save/Save & Exit disable
themselves with an "(unavailable in Co-op)" label rather than guessing at
data that doesn't exist.

**New shared pure function**: `SaveSystem.saveOrUpdatePartySlot(file, input)`
— the exact create-or-update-slot decision `CharacterCreationScene.
onSaveParty` already had inline, extracted so `BattleScene.saveParty()`
(the pause menu's "Save Party"/"Save & Exit" action) can reuse it instead of
duplicating the branching a second time. `onSaveParty` itself was refactored
to call it too — same behavior, now covered by one shared, tested decision.
Takes a caller-supplied `now: number` timestamp rather than calling
`Date.now()` internally, keeping it pure/deterministically testable (4 new
tests in `tests/saveSystem.test.ts`).

**Mechanism**: `PauseMenuScene` (new) reuses D-148's exact
`CharacterSheetScene` precedent — `scene.launch("PauseMenuScene", {
battleScene: this })` + `scene.pause()` to open, `scene.stop()` +
`scene.resume("BattleScene")` to return. A NEW always-visible "Menu (Esc)"
HUD button (bottom-left corner, mirroring Test Mode's own Debug-Menu-button
corner on the opposite side) and `handleEscape`'s fallback both call a
single self-guarding `openPauseMenu()` — it silently no-ops during an
active hero drag, any forced-choice overlay (ASI/subclass/spell-pick/
level-up-ack/rest/spell-prep), or another full-screen overlay (tutorial/
technical log/debug menu/end-of-battle), the same set `handleEscape`'s own
priority chain already protects. Opening the menu deliberately does NOT
disturb build/equip/aiming-mode UI state — it freezes the whole scene, so
whatever was going on resumes exactly as it was.

Tests: 1337 → **1341** (+4, all in `tests/saveSystem.test.ts` for
`saveOrUpdatePartySlot`; `PauseMenuScene` itself has no test file, matching
every other presentation-only scene in this project). Typecheck, all 1341
tests, and the production build (123 modules, +1: `PauseMenuScene.ts`) all
pass. `npm run dev` serves HTTP 200. No browser available in this
environment — see the new KI-104 for the in-browser checklist.

**Explicitly NOT built, and why** (see this decision's own plan for the
full reasoning): a save that resumes the exact battle in progress (would
require wiring `BattleStateSnapshot` into `SaveSystem` — a future item, not
this one); cloud-sync push from the new mid-battle Save (local-only for
this first pass, same "defer secondary integration" precedent D-083's
original scoping already set — the same slot syncs normally next time the
player saves from `CharacterCreationScene`/`LoadGameScene`); a save-slot
rename/naming prompt (matches the existing auto-named convention — no
rename UI exists anywhere in this project today either).

### D-153 — Real Settings screen: Game Speed moved off Main Menu's old corner button, plus real Master/Music/SFX volume and Mute controls (no audio content yet)

Kevin asked directly to "start adding in audio settings stuff even though
there is no music or sound effects yet" — a deliberate reversal of D-060/
D-152's standing "no audio settings — nothing to control" call. Asked to
pin the scope given that history; Kevin chose the real-infrastructure
option over a UI-only stub or a full push including placeholder SFX: a
genuinely-working `AudioManager` + settings UI, silent only because no
audio asset exists, not because the control itself is fake.

**`SettingsSystem.ts` (`systems/`, still Phaser-free)** gains `masterVolume`/
`musicVolume`/`sfxVolume` (0-100, a 5-step 0/25/50/75/100 cycle — the same
"one click cycles" interaction `nextAnimationSpeed` already established;
no slider widget exists anywhere in this project) and a `muted` boolean,
each defaulting to 75/75/75/false. `loadSettings` validates each field
independently and falls back to its own default on a corrupt/out-of-range
stored value, same defensive pattern as `animationSpeed` already had.

**`scenes/AudioManager.ts` (new)** — Phaser-dependent, so it lives in
`scenes/` next to `uiTheme.ts`/`tooltip.ts`, not `systems/`. `applySettings`
sets `scene.sound.mute`/`scene.sound.volume` directly — real, global, and
audible-if-anything-were-loaded the instant they're set, since `scene.sound`
is the SAME shared manager (`game.sound`) from every scene. Music/SFX have
no Phaser bus equivalent, so `AudioManager` tracks every sound IT played via
`playMusic`/`playSfx` and re-applies that sound's own category volume on
every settings change. `playMusic`/`playSfx` are safe no-ops (return `null`)
when the given key isn't a loaded audio asset — which is every key today
(KI-029) — so nothing anywhere needs to guard a call to them.

**`SettingsScene.ts` (new)** — one screen for every setting, replacing
Main Menu's old single "Game Speed" cycle button. Two entry modes reuse
D-148/D-152's already-proven nested-scene mechanism rather than inventing a
third:
- **Standalone** (Main Menu's new "Settings" button): `scene.start`, Game
  Speed read/written straight to `localStorage`, same as the old button did.
- **Overlay** (Pause Menu's row, renamed from "Game Speed: {label}" to
  "Settings"): `scene.launch` + `scene.pause()` — the exact call Pause Menu
  itself already uses over `BattleScene` — with the live `BattleScene`
  instance handed through, so Game Speed still changes LIVE mid-battle
  (D-130) via the same `cycleGameSpeed()` the old inline row called
  directly.

**A real bug this surfaced and fixed**: `BattleScene.cycleGameSpeed()` and
Main Menu's old button both persisted settings as a bare
`{ animationSpeed }` literal — harmless while that was the only field, but
would have silently WIPED the new volume/mute fields on every Game Speed
change once they existed. `cycleGameSpeed()` now spreads the freshly-loaded
settings before overriding just `animationSpeed`; Main Menu's button no
longer touches `animationSpeed` at all (moved onto `SettingsScene`).

Tests: 1341 → **1344** (+3, all in `tests/settings.test.ts`: invalid-volume
fallback, `nextVolume`'s 5-step cycle, `toggleMuted`; the existing round-trip
test grew to cover the full field set instead of adding a separate test).
`AudioManager.ts`/`SettingsScene.ts` have no test file, matching every other
Phaser-dependent presentation module in this project (`uiTheme.ts`,
`PauseMenuScene.ts`, etc.). Typecheck, all 1344 tests, and the production
build (125 modules, +2) all pass. `npm run dev` serves HTTP 200. No browser
available in this environment — see the new **KI-105** for the in-browser
checklist (should be silent, but every row should respond with no console
error).

### D-154 — Responsive-canvas foundation (7 scenes, `Scale.FIT` retained this pass), Map Builder click-and-drag paint tool + real map-name field

Kevin picked KI-098's "Maps & Map Builder" thread this session. Investigating
"larger maps" found every map capped near 20x9 tiles purely because
`BattleScene` draws at a fixed 64px tile size inside a fixed 1280x1080
canvas (`Scale.FIT`, letterboxed to the browser window) — no scrolling or
dynamic scaling exists in battle today. Asked how to solve it, Kevin wanted
more than a third canvas-size bump (this project has done that twice
before, D-055/D-078): a genuinely responsive, full-screen canvas — and,
asked directly, confirmed this should apply to the WHOLE app, every scene,
not just battles.

That is a real, multi-session architecture change: ~12 scene files each do
fixed-pixel absolute layout off `GAME_WIDTH`/`GAME_HEIGHT`, and
`BattleScene.ts` alone is 8049 lines with 88 `GAME_WIDTH`/`GAME_HEIGHT`
references and 68 separate `TILE_SIZE` references spanning sprites, VFX,
tooltips, D-144's drag-and-drop hit-testing, structures, auras, and status
badges. Asked to prioritize given that reality, Kevin chose "foundation +
simple menus first" — prove the pattern safely on low-risk scenes, hold
`BattleScene`'s actual size-payoff conversion for its own dedicated future
session.

**The foundation (`uiTheme.ts`)**: `getViewport(scene)` reads the scene's
own live `scene.scale.width/height` instead of the fixed constants;
`onViewportResize(scene, rebuild)` subscribes `rebuild` to
`Phaser.Scale.Events.RESIZE`, unsubscribing on scene shutdown. Deliberately
NOT cutting over to `Phaser.Scale.RESIZE` this pass: under the current
`Scale.FIT`, `scene.scale.width/height` stays pinned to 1280x1080
regardless of the real window size (only the CSS display size changes), so
routing a scene through this convention today is a zero-behavior-change
refactor — verified by pinning `computeCornerControlsRegion` (see below) to
today's exact numbers. Flipping to `Scale.RESIZE` is the one moment the
real window size starts flowing into scenes, and doing that before most
scenes are converted would leave every UNCONVERTED scene rendering its old
fixed-1280x1080-coordinate content top-left-anchored inside a
now-differently-sized real canvas — a visible regression across most of the
app. That cutover is explicitly held for a later session, once enough/all
scenes are converted.

**Per-scene convention**: a `rebuildLayout()` method destroys-and-recreates
everything the scene draws (reusing the exact same positioning code that
already worked, rather than a second incremental-reposition code path that
could drift from it), called once from `create()` and again on every
`onViewportResize` firing. `MainMenuScene` uses a snapshot-diff variant
(record `this.children.list` before/after building, reparent whatever's new
into a fresh container) rather than hand-editing every one of its ten
`buildX()` methods to explicitly target a container — mechanically simpler,
same effect. One real bug this surfaced and fixed in the SAME pass:
`MainMenuScene.buildAccountControl` called `initAuth(...)` — a real Firebase
subscription — every time it ran, which would have re-subscribed on every
resize; `initAuth` now runs once in `create()`, with `this.authState`/
`this.authResolved` fields feeding a `refreshAccountLabel()` the rebuilt
button reads from instead.

**7 scenes converted** (lowest `GAME_WIDTH`/`GAME_HEIGHT` reference count,
no DOM input, no pagination — the safest scenes to prove the pattern on
before ever touching `BattleScene`/`MapBuilderScene`): `PauseMenuScene`,
`SettingsScene`, `CampaignSelectScene`, `MainMenuScene`, `LoadGameScene`,
`TestModeScene`, `BestiaryScene`. `BestiaryScene` needed one extra bit of
care beyond the mechanical rename: `this.page`/`this.groupIndex` are reset
to 0 only in `create()`, never in `rebuildLayout()`, so a resize doesn't
silently snap the player back to page 1/Minions mid-browse.

**One layout computation extracted to a pure, tested function**, per this
decision's own precedent-setting goal: `MainMenuScene.buildTitle`'s
bounds-measurement loop (D-149's own fix — shrinks the title font until it
clears the Settings/Account corner controls) had its corner-controls
rectangle hardcoded as `new Rectangle(980, 10, 260, 100)`, a magic box tied
to the fixed 1280-wide canvas. `computeCornerControlsRegion(viewportWidth)`
(new, `systems/mainMenuLayout.ts` — deliberately NOT in `scenes/`, since
that whole directory imports Phaser at module scope and this project's test
environment is plain Node with no DOM/canvas, so nothing under `scenes/`
can ever be imported by a Vitest test) replaces it, parameterized by
viewport width; `tests/mainMenuLayout.test.ts` pins it to the exact old
values at 1280 and checks it stays anchored to the right edge at three other
widths. This is the pattern any future scene conversion's non-trivial
layout math should follow.

**Map Builder: real click-and-drag continuous paint tool.** `MapBuilderScene`
previously wired only `pointerdown` — genuinely one tile per click. Now
tracks `isPainting`/`lastPaintedTile`; `pointerdown` paints and arms
painting, `pointermove` paints whatever NEW tile the pointer crosses while
armed (skipping a repaint of the same tile), and a scene-wide `pointerup`
(not just over the grid, since a drag can end after the pointer leaves it)
disarms. No new pure-system function needed — `MapBuilderSystem` has no
undo/history to coordinate with, and this is pure presentation-layer mouse
tracking reusing the existing `paintTile` mutator per tile touched.

**Map Builder: a real map-name field.** Replaced the fixed 8-name
`MAP_NAME_POOL` cycle button with a real DOM `<input>` — this project's
THIRD such field, following the exact pattern `CharacterCreationScene`'s
hero name (D-147) and `CoopLobbyScene`'s join code (D-102) already
established (`this.add.dom(...).createFromHTML(...)`, grab the real
`<input>` via `querySelector`, an `"input"` listener writing into the
draft, a `"keydown"` listener calling `stopPropagation()` so typing never
fires the scene's own hotkeys). New `isValidMapName(name)` in
`MapBuilderSystem.ts` (non-empty after trim, ≤40 chars — independent of the
`<input>`'s own `maxlength` attribute, which a future non-UI caller
wouldn't be bound by) gates Publish specifically, mirroring D-147's
blank-hero-name block on Start Battle — Playtest is unaffected, since a
personal test run has no name-sharing concern. `firestore.rules`' own
`isValidSharedMap` needed no change — only the input MECHANISM changed, not
`SharedMapRecord.name`'s stored shape.

**Deliberately NOT this session** (see `KNOWN_ISSUES.md`'s new entry for
the complete list and reasoning): the `Scale.RESIZE` cutover itself; the
remaining ~5 harder scenes (`CompendiumScene`, `CharacterSheetScene`,
`BrowseSharedMapsScene`, `FreePlayScene`, `CoopLobbyScene` — each has a DOM
input needing in-place repositioning instead of destroy-and-recreate, or
pagination math needing re-deriving per viewport); `CharacterCreationScene`
and `MapBuilderScene`'s OWN resize-reactivity (`MapBuilderScene`'s grid
already dynamically fits `tileSize` to available space, just not on a live
resize event yet); `BattleScene`'s `TILE_SIZE` dynamic-scaling — the actual
"bigger maps in battle" payoff, deliberately held for its own fully
dedicated future session given its size and risk; raising
`MAX_MAP_COLS`/`MAX_MAP_ROWS` (pointless until `BattleScene` can render
past the current ~20x9 ceiling — it would let Kevin draft maps that break
in a real battle).

Tests: 1344 → **1349** (+5: 2 in `tests/mainMenuLayout.test.ts`, 3 in
`tests/mapBuilder.test.ts` for `isValidMapName`). Typecheck, all 1349
tests, and the production build (126 modules, +1: `mainMenuLayout.ts`) all
pass. `npm run dev` serves HTTP 200. No browser available in this
environment — see the new **KI-106** for the complete checklist, especially
the paint-tool's actual drag feel and the 7 converted scenes' at-normal-
window-size appearance, neither of which a resize-behavior test can verify.

### D-155 — Responsive-canvas roadmap step 1: the remaining 5 harder scenes converted (`CompendiumScene`, `CharacterSheetScene`, `BrowseSharedMapsScene`, `FreePlayScene`, `CoopLobbyScene`)

Continuing D-154's roadmap in the exact order its own "Deferred items" list
laid out: item 1, the five scenes flagged as needing more than the
mechanical `rebuildLayout()` treatment. All five now follow the same
`getViewport`/`onViewportResize` convention as the first 7 — this is still a
zero-behavior-change refactor under today's `Scale.FIT` (verified by the
full test/typecheck/build pass below), not a visible change.

**`CompendiumScene`**: the trickiest of the "pagination" scenes — a
per-class selector (Classes), a per-level selector (Spells), and Prev/Next
paging shared by three different categories, all previously centered on the
fixed `PANEL_WIDTH = GAME_WIDTH - PANEL_LEFT * 2` module constant. Converted
to the same `rebuildLayout()` chrome-only pattern `BestiaryScene` established
(destroy/diff/rebuild the title, Back button, tabs, parchment panel, and the
persistent `detailText` object; `this.category`/`classId`/`spellLevel`/`page`
only reset in `create()`, never in `rebuildLayout()`, so a resize can't bounce
the reader back to Classes/page 1). The three sub-selector/pagination
builder methods that run OUTSIDE `rebuildLayout()` (triggered by the reader's
own tab/selector clicks, not a resize) now call `getViewport(this).width`
directly rather than receiving it as a parameter, matching `MainMenuScene`'s
own per-method convention.

**`CharacterSheetScene`**: launched as a real second Phaser scene over a
PAUSED `BattleScene` (`scene.launch`/`scene.pause`, D-148) — a resize firing
while this is on top must rebuild only this scene's own chrome, never touch
the paused battle underneath it. Same `rebuildLayout()` (chrome: backdrop,
hero-name title, Close button, the 3 tabs) plus the existing `renderTab()`/
`clearContent()` machinery (unchanged) for the actual Stats/Spellbook/Hotkeys
content, which already tracked its own objects for destroy-and-rebuild on
every tab switch — extending that same machinery to also fire on a resize
needed no new bookkeeping. Two of its three tab-render methods had a local
variable named `width` shadowing the new viewport width (the Spellbook/
Hotkeys grids' own card width); renamed those to `cardW` to avoid the clash
rather than rename the viewport read.

**`BrowseSharedMapsScene`**: fetches from Firestore (`listSharedMaps`) —
critically, a resize must re-render the already-fetched `this.maps` state
and must NEVER re-hit the network. Split the one-time `loadPage()` fetch
(now called once from `create()`, guarded by `firebaseReady`, same as
`LoadGameScene`/`MainMenuScene`'s "subscribe/fetch once, refresh display on
every rebuild" precedent) from the chrome-building `rebuildLayout()`. A new
`hasLoadedOnce` flag guards `rebuildLayout()`'s own trailing
`renderMapList()` call — without it, the very FIRST `rebuildLayout()` call
(which runs synchronously inside `create()`, before `loadPage()`'s promise
has resolved) would flash a false "No maps have been published yet" message
for one frame before the real list arrives.

**`FreePlayScene`**: never went through D-123's ornate-theme restyle (still
plain rectangle buttons, `CampaignSelectScene`'s original style), so this
was the mechanical `rebuildLayout()` treatment applied fresh rather than
retrofitted onto an already-converted-looking scene — six section-builder
methods (map/boss/wave-count/minion/difficulty/start) now take `width` as an
explicit parameter, matching `LoadGameScene`'s established style for
non-ornate scenes, instead of reading a shared field.

**`CoopLobbyScene`**: the one genuinely different case, called out by name
in D-154's own roadmap note. This scene builds every object exactly ONCE in
`create()` and only ever toggles visibility/text afterward (`choose`/`join`/
`in-session` mode switching) — it never destroys and rebuilds its own
content, unlike every other scene converted so far. Its join-code `<input>`
(this project's first-ever DOM form field, D-102) would drop whatever the
player had already typed and lose keyboard focus if destroyed and recreated
on a resize. Rather than force this scene into the destroy-and-recreate
convention, it gets its own lighter mechanism: a `centeredObjects` list of
`{ obj, dx, y }` entries (every object centered at `viewportWidth / 2 + dx`
at a fixed `y`) populated once at creation time, and a `repositionLayout()`
that calls `.setPosition(cx + dx, y)` on each — moving existing objects
(including the `<input>`) rather than replacing them. This is the pattern
any FUTURE scene with a persistent DOM element or other can't-destroy state
should follow instead of `rebuildLayout()`.

**Deliberately still not this session** (unchanged from D-154's own list,
see `KNOWN_ISSUES.md`): the `Scale.RESIZE` cutover itself; `CharacterCreationScene`
and `MapBuilderScene`'s OWN resize-reactivity; `BattleScene`'s `TILE_SIZE`
dynamic-scaling (the actual "bigger maps in battle" payoff); raising
`MAX_MAP_COLS`/`MAX_MAP_ROWS`.

No new tests — every change here is presentation-layer Phaser scene code
with no new pure-system rule (matching every other scene-conversion pass in
D-154), verified by typecheck + the full existing suite + a production
build + an `npm run dev` HTTP-200 check, same as D-154 itself. Tests remain
at **1349** (unchanged). Typecheck clean, all 1349 tests pass, production
build succeeds (126 modules, unchanged — no new files). `npm run dev` serves
HTTP 200. No browser available in this environment — see the new **KI-107**
for the complete in-browser checklist; every converted scene should look and
behave IDENTICALLY to before at a normal window size (still a pure
regression check, not a "does resizing work" check).

### D-156 — Responsive-canvas roadmap step 2: `MapBuilderScene` and `CharacterCreationScene`'s own resize-reactivity

Continuing D-154/D-155's roadmap: step 2, the two remaining scenes not yet
converted. Both keep persistent DOM `<input>` fields (map name;
`CharacterCreationScene`'s 4 hero-name fields), so neither can use the
destroy-and-recreate `rebuildLayout()` convention most scenes use — same
constraint `CoopLobbyScene` (D-155) established its own reposition-in-place
mechanism for.

**`MapBuilderScene`**: its grid already dynamically fit `tileSize` to
available space (`rebuildGridSystem`, pre-existing), just not on a live
resize event — wiring it in was the "small" piece the roadmap predicted.
The module-level `GRID_AREA_RIGHT` constant (derived from the old static
`GAME_WIDTH` import) is gone, replaced by a `gridAreaRight` computed live
inside `rebuildGridSystem()`. Adopted the same `centeredObjects: { obj, dx,
y }[]` + `repositionLayout()` mechanism `CoopLobbyScene` introduced: every
piece of chrome built once in `create()` (title, description, size/name
controls including the DOM name field, palette tabs, footer) registers its
own `{ obj, dx, y }`; a resize repositions all of them, then re-derives grid
geometry and re-runs `renderPaletteSwatches()`/`renderGrid()` — both were
ALREADY fully destroy-and-recreate on every call (tab switch / any paint),
so re-invoking them against the live viewport width was enough to keep them
correctly sized without new bookkeeping for either.

**`CharacterCreationScene`**: the largest scene in this whole effort by
`GAME_WIDTH`/`GAME_HEIGHT` reference count, as flagged — but investigating
found every single one of those references reduces to the exact same shape,
`viewportWidth / 2 + a fixed constant`. `columnCenterX(width, slot)`
(previously a module-level function reading a `GAME_WIDTH`-derived constant,
now parameterized on live width) makes this explicit: the width-dependent
term is `width / 2`, identical across all 4 hero-column slots, the bottom
controls, Start/Back, and the level-planner/spell-picker wizard overlay
(`renderPlanPrompt`) alike. That let this session skip
`CoopLobbyScene`/`MapBuilderScene`'s per-object `{ obj, dx, y }` registration
almost entirely: a single `repositionLayout()` computes `shift = (newWidth -
viewportWidthAtLastLayout) / 2` and adds it to the live `.x` of literally
every current child in `this.children.list` — correct for every object in
this scene (Rectangle/Text/DOMElement all expose `.x`, and this scene never
uses a Container or Graphics object), including the 4 name `<input>`s, which
keep their typed text and keyboard focus since nothing is destroyed. Far
less code than hand-registering ~150+ individual widgets across 4 slot
columns would have needed.

**Known, accepted limitation**: if the wizard overlay (`renderPlanPrompt`,
shared by the Level Planner/Spell Picker/choice-picker) happens to be open
at the exact moment a resize fires, its full-screen dim backdrop's WIDTH/
HEIGHT (not just position) would need updating too — the generic shift only
moves it, since `renderPlanPrompt` only reads live `getViewport(this)`
sizing when it's freshly (re)drawn. Self-heals the instant the player clicks
any option (which redraws the whole overlay from scratch at the current
size). Not worth a dedicated fix while `Scale.RESIZE` isn't live yet — under
today's `Scale.FIT` this can never actually happen, since the viewport width
never changes regardless of window resizing.

With both scenes done, every scene in the app except `BattleScene` itself
now follows the `getViewport`/`onViewportResize` convention in one of its
two forms (destroy-and-rebuild, or reposition-in-place).

No new tests — presentation-layer Phaser scene code only, no new
pure-system rule (same as every prior pass in this roadmap). Tests remain at
**1349**. Typecheck clean, all 1349 tests pass, production build succeeds
(126 modules, unchanged — no new files). `npm run dev` serves HTTP 200. No
browser available in this environment — see the new **KI-108** for the
in-browser checklist; both scenes should look and behave IDENTICALLY to
before at a normal window size, with the Map Builder's paint tool and both
scenes' DOM `<input>` fields worth a specific close look since they're the
two genuinely new interactions this pass touched.

### D-157 — Responsive-canvas roadmap step 3: the actual `Scale.RESIZE` cutover

The roadmap's own step 3 (`PHASE_HANDOFF.md`): flip `main.ts`'s scale mode
from `Scale.FIT` to `Scale.RESIZE`, the moment the real browser window size
starts mattering anywhere — every non-`BattleScene` scene had already been
converted to build its layout off `getViewport`/`onViewportResize` (D-154/
D-155/D-156), so this was finally unblocked. Kevin picked this over
scoping KI-034 (the bottom status/hint-line redesign, confirmed a fourth
time this session as something he wants changed but hasn't picked yet).

**The cutover itself**: `main.ts`'s `scale.mode` is now `Phaser.Scale.RESIZE`.
`BattleScene` — the one scene with no `getViewport` conversion of its own
yet (88 `GAME_WIDTH`/`GAME_HEIGHT` references, step 4's own dedicated future
scope) — locks the canvas back to the old fixed-resolution `Scale.FIT`
behavior for the duration of a battle: `create()` now sets
`this.scale.scaleMode = Phaser.Scale.FIT`, explicitly calls
`this.scale.displaySize.setAspectMode(Phaser.Scale.FIT)` (Phaser only ever
applies a scale mode's aspect-fit behavior from its own boot-time config
parsing, never on a later manual `scaleMode` reassignment — skipping this
would have made "FIT" silently stretch-fill instead of letterbox-fitting),
then `setGameSize(GAME_WIDTH, GAME_HEIGHT)` to restore the fixed 1280x1080
resolution. Its existing `SHUTDOWN` handler (already there for input-listener
cleanup) now also hands the canvas back to `Scale.RESIZE` the instant a
battle actually ends — every exit path (defeat/victory, Save & Exit, Exit to
Main Menu, Load Game) already calls `this.scene.stop("BattleScene")` before
starting the next scene, so this fires reliably on all of them. Menu scenes
reached while a battle is merely PAUSED underneath (Character Sheet, Pause
Menu, Settings launched from it) share this same locked-FIT canvas rather
than fighting over mode, since `scene.scale` is one Game-wide manager, not
one per scene — they were already using `getViewport` correctly, so nothing
about them changes.

**Bugs this surfaced before they ever shipped** (found by reasoning through
what "the real window size differs from 1280x1080" actually breaks, not by
browser testing — none is available here): several places read the fixed
`GAME_WIDTH`/`GAME_HEIGHT` constants directly instead of a scene's live
viewport, which was invisible dead code under `Scale.FIT` (the two were
always numerically identical) but would have been immediately, visibly wrong
the moment `Scale.RESIZE` made them differ — at ANY normal window size, not
just on a manual resize:
- `uiTheme.ts`'s `drawScreenBackdrop`/`spawnAmbientMotes` (the shared D-123
  parchment-theme backdrop + ember motes used by Main Menu, Compendium,
  Bestiary, Character Sheet, Settings, Pause Menu, and more) drew against a
  fixed 1280x1080 — now reads the scene's live `scale.width`/`scale.height`.
  Every caller already redraws this from scratch inside its own
  resize-triggered `rebuildLayout()`, so this alone was enough to make the
  backdrop actually fill the true live canvas on resize, no caller changes.
- `uiTheme.ts`'s `centeredRowX` has no `scene` parameter, so its `maxWidth`
  default couldn't read a live viewport — every one of its ~11 call sites
  across `BestiaryScene`, `CharacterSheetScene` (×3), `CompendiumScene` (×4),
  `MainMenuScene` (×3), and `MapBuilderScene` relied on that stale default
  instead of passing one explicitly. Each now passes its own
  already-in-scope live width minus the existing 40px-per-side margin.
- `tooltip.ts`'s hover-tooltip X clamp used fixed `GAME_WIDTH` — now clamps
  against the scene's live `scale.width`.
- `dialogueBox.ts`'s full-screen dim scrim (used by `CompendiumScene`'s
  dialogue preview today, and future chapter-transition dialogue) was sized
  to fixed `GAME_WIDTH`/`GAME_HEIGHT` — now reads the scene's live
  `scale.width`/`scale.height` at build time. Known, accepted limitation
  (same shape as `CharacterCreationScene`'s wizard-overlay one below): a
  resize firing while the dialogue is already open won't resize an
  already-drawn scrim, only a fresh open reads the live size — not worth
  fixing, since this box is dismissed/advanced far more often than a browser
  window is resized mid-read.

**Still an accepted, unfixed limitation**: `CharacterCreationScene`'s wizard
overlay (`renderPlanPrompt`, D-156) has the identical dim-backdrop-stale-
until-next-redraw gap. D-156 deferred it with the rationale "not worth a
dedicated fix while `Scale.RESIZE` isn't live yet" — that condition no longer
holds, but the edge case (resizing the browser at the exact moment this
specific overlay is open, mid-Character-Creation) is narrow and self-heals on
the player's next click, so it stays deferred rather than chased down this
session; flagged explicitly here rather than silently left stale.

No new tests — presentation-layer Phaser/scale-manager plumbing only, no new
pure-system rule. Tests remain at **1349**. Typecheck clean, all 1349 tests
pass, production build succeeds (126 modules, unchanged — no new files).
`npm run dev` serves HTTP 200. **This is the first step in the whole
roadmap where a real in-browser pass is not just recommended but load-
bearing**: everything converted so far was correct-by-construction but
never actually exercised under a changing viewport, since `Scale.FIT` never
let the real window size matter. See the new **KI-109** for the full
checklist — Kevin's own confirmation that resizing the browser window now
visibly, correctly re-lays-out every menu screen (and that battles still
look and scale exactly as they did before) is required before step 4
(`BattleScene`'s own `TILE_SIZE` dynamic-scaling) can start.

### D-158 — KI-034: replaced `BattleScene`'s packed status/hint line with a real hero roster strip + contextual buttons/tooltips

Kevin confirmed, across four separate sessions, that every individual
behavior of the bottom status/hint line worked correctly but said he hated
the whole system it was part of and wanted it redesigned — asked directly a
fourth time this session (via `EnterPlanMode`, given the size and delicacy
of the change), he picked the "contextual action bar (icon buttons)"
direction over two other offered mockups.

`refreshStatus()` (`BattleScene.ts`) used to rebuild one packed, word-wrapped
`statusText` on every refresh: every hero's name/level/HP (with AC/move/act/
gear string-appended for whichever hero was selected), the enemy count, and
a giant mode-dependent hint paragraph (different content for 10+ `ui.kind`
values, plus a near-universal trailing tail of keyboard-shortcut reminders).
Investigating turned up that most of that hint text was already redundant
with something else already on screen: the Ability/Potion/Character Sheet/
Confirm/Cancel buttons already carry their own "(Q)"/"(P)"/"(C)"/"(Enter)"/
"(Esc)" labels; blue/red move/attack tile highlighting is already visible
the instant a hero is selected; the banner already shows `PHASE_LABELS`
during the enemy phase (making the hint's own "resolving…" redundant); and
the "How to Play" overlay (`showTutorial()`, reachable any time via H)
already documents Q/P/E/B/G and arrow-key play.

**What changed:**
1. **A real visual hero roster strip** replaces the packed `heroPart`
   string: `MAX_ROSTER_SLOTS` (4) per-hero widgets (box + name/level text +
   a real HP bar — background/foreground `Rectangle`s scaled by
   `health / effectiveMaxHealth`, colored green/yellow/red by threshold,
   with the exact "12/15" numbers overlaid — plus a detail line, reserved
   in EVERY box but populated only for the selected, living hero, so box
   height never jumps on selection change). Built once in `buildHud()`;
   `layoutHeroSlots()` (new) positions exactly `this.heroes.length` of them
   via `centeredRowX` (imported from `uiTheme.ts`, the same helper every
   other variable-count centered row in this codebase already uses) and
   hides the rest — called once, since party size (1-4) never changes
   mid-battle. The selected-hero border reuses `COLORS.heroActive` (the
   existing board-token selection-ring color), not `uiTheme.ts`'s separate
   gold/gilt menu-selection convention, which belongs to the D-123 parchment
   theme `BattleScene` deliberately hasn't adopted. First HP-bar-style
   widget in this codebase — an Explore pass during planning confirmed no
   prior convention existed to match, so this establishes one.
2. **`enemies: N` moved to a new small `enemyCountText`**, top HUD, next to
   Integrity/Gold — updated directly inside `refreshStatus()` (not folded
   into `updateHud()`'s own less-frequent call sites, to guarantee it never
   goes stale between the two methods' different trigger points).
3. **A new small `messageText`** replaces the rest of the old packed line —
   usually empty. Carries only what had no other home: aiming-mode
   instructions (`aimingAbility`/`choosingSpell`/`aimingSpell`/
   `aimingTileSpell` — no Cancel button exists for these, unlike
   `confirmingMove`, which was dropped as redundant with the Confirm/Cancel
   buttons themselves), the `Tab: aim on board` / `Tab: pick item` focus
   indicator (genuinely non-obvious keyboard-mode state, no other display
   surface, and exactly what KI-034's own checklist tests), Test Mode's
   three debug-picker one-liners (lower polish bar, no better home), and
   `rejectAt()`'s transient rejection messages (`Out of range`, `Not enough
   gold for X`, etc. — now written here instead of the old shared field,
   same "persists until the next real refresh" behavior as before).
4. **The building/equipping item-description preview moved to a hover
   tooltip** — `setHoveredItem(id)` now calls the SAME shared
   `this.tooltip` (`TooltipController`, D-132, already used for board-tile/
   hero/enemy hover) instead of triggering a full text rebuild, positioned
   at the hovered item's own button `(x, y)` (found by index into
   `SHOP_ORDER`/`visibleGearCatalog()`, matching `shopButtons`/
   `equipItemButtons` — no signature changes needed to `buildItemGrid` or
   its `onHover` wiring). Critically, `setHoveredItem` is called from BOTH
   mouse `pointerover` AND keyboard grid-focus navigation
   (`moveGridFocus`/`toggleKeyboardFocus`) — preserved exactly, so the
   tooltip stays exactly as keyboard-accessible as the text it replaced.
   Fixed a latent gap while doing this: `toggleKeyboardFocus` (Tab) used to
   set the old `hoveredItemId` field directly rather than calling
   `setHoveredItem`, so tabbing INTO the grid never previewed the
   newly-focused item until the next arrow-key move — now routes through
   `setHoveredItem` like every other hover/focus path, fixing this too.
5. **Removed the now-fully-unused `hoveredItemId` field** — every one of
   its 4 read sites was inside the deleted hint-construction code; its
   remaining writes became pure dead state once `setHoveredItem` started
   resolving tooltip position from its own `id` parameter directly instead
   of a stored field (caught by `tsc`'s unused-property check, not manual
   inspection).
6. **"How to Play"** gained one clause ("or press 1-4") — the only mention
   of that hotkey now that the live hint's universal trailing tail is gone.

**Deliberate, flagged tradeoff**: the `idle`/`heroSelected`/`confirmingMove`
hints (e.g. "blue = move · red = attack · Ability (Q) · Potion (P) ·
Character (C) · Esc to deselect") are gone entirely, not shortened — the
redundancy analysis above showed every piece of them already has a visible
button label or board highlight. This relies on that being self-evident on
a repeat playthrough, with the How to Play overlay (H) as the fallback for
a first-timer. Kevin picked the action-bar direction knowing this was the
"declutter" outcome, not a default assumed on his behalf.

No new tests — presentation-layer Phaser scene code only, `BattleScene.ts`
has zero test coverage by this project's own architecture rule (confirmed
via an Explore pass before starting: no file under `tests/` references
`statusText`/`refreshStatus`/`combatLogText`, or imports `BattleScene`
directly). Tests remain at **1349**. Typecheck clean, all 1349 tests pass,
production build succeeds (126 modules, unchanged — no new files). `npm run
dev` serves HTTP 200. No browser available in this environment — this is a
substantial, delicate rewrite of live battle UI that genuinely needs Kevin's
own in-browser pass; see the new **KI-110** for the full checklist,
including re-confirming KI-034's own existing keyboard-only-play items
still hold (arrow-key cursor, Enter/Space parity, Tab grid/board focus
switching, no page-scroll on arrows/space, a full mouse-free battle) since
this rewrite touches the exact code paths those depend on.

### D-159 — Reverted D-157's `Scale.RESIZE` cutover back to `Scale.FIT` after Kevin's first real in-browser pass found it broken

Kevin's first actual browser test of D-157 found two concrete, confirmed
bugs: Main Menu's Settings/Sign-in corner controls overlapping the frame
border, and Character Creation's Start/Back buttons rendering completely
off-screen (invisible, not just misplaced) after clicking "New Game." His
own diagnosis — "pretty sure that's the new full-screen sizing" — was
correct.

**Root cause**: `Scale.RESIZE` makes the canvas's actual pixel dimensions
track the real browser window exactly, with NO automatic shrink-to-fit.
`Scale.FIT` (the mode this reverts to) was quietly doing something the
whole D-154/155/156 roadmap had assumed away: every scene's
`getViewport`/`onViewportResize`/`repositionLayout`/`rebuildLayout`
conversion only ever handled re-CENTERING content horizontally on a resize
— none of it handled a real window SHORTER than `GAME_HEIGHT` (1080px).
Under `Scale.FIT`, that gap was invisible: the whole fixed 1280x1080 design
simply shrank (via CSS, preserving aspect ratio) to fit inside whatever
window the player had, so nothing was ever actually clipped — a hero could
resize the browser to a tiny window and every button would just get
smaller, never disappear. Under `Scale.RESIZE`, the canvas instead becomes
the real window's actual pixel size, and every scene's absolute-pixel
Y-coordinates (built assuming up to 1080px of vertical room, e.g.
`CharacterCreationScene`'s Start/Back buttons near the bottom of that
range) are unchanged — a browser window shorter than 1080px tall (common;
many laptops' usable viewport height is well under that once browser chrome
is subtracted) puts that content below the visible canvas, with nothing to
scroll it into view. Main Menu's corner-control overlap has the same root
shape from the width side: `computeCornerControlsRegion` (D-149) and this
whole roadmap's centering math were tuned and eyeballed against a
1280-wide canvas; a real window's width/aspect ratio combination the
`FIT`-shrink previously absorbed is now exposed directly.

**What this reverts**: `main.ts`'s `scale.mode` back to `Phaser.Scale.FIT`;
removed `BattleScene`'s now-pointless (and, left in place, actively
harmful) runtime scale-mode swap — its `create()` no longer force-sets
`Scale.FIT`+`setAspectMode`+`setGameSize` (redundant once the game-wide
default is `FIT` again), and its `SHUTDOWN` handler no longer flips the
whole game to `Scale.RESIZE` on battle-exit (which would have re-broken
every menu scene the instant any player finished or left one battle).

**What this does NOT revert**: the D-157 fixes to `uiTheme.ts`'s
`drawScreenBackdrop`/`spawnAmbientMotes`/`centeredRowX`, `tooltip.ts`, and
`dialogueBox.ts` (reading a scene's live `scale.width`/`height` instead of
the fixed `GAME_WIDTH`/`GAME_HEIGHT` constants) — these are strict
correctness improvements that are harmless no-ops under `Scale.FIT` (live
viewport size and the fixed constants are numerically identical again now),
and would still be necessary groundwork if a real responsive-canvas attempt
is made again later.

**What a real fix would need, if this is retried**: a strategy for
VERTICAL space, not just horizontal centering — either (a) every scene
reflows its vertical layout too (not just shifts/rebuilds horizontally), or
(b) the game keeps `Scale.FIT`'s shrink-to-fit behavior but with a LARGER
logical canvas size (raising `GAME_WIDTH`/`GAME_HEIGHT` themselves) rather
than switching scale modes at all — worth raising with Kevin as an explicit
option before attempting this roadmap step a second time, rather than
re-guessing blind again with no browser available here to catch the next
edge case.

## Phase 26 — August 2026 playtest bug batch (this chat)

Kevin's next in-browser playtest pass surfaced 8 items in one message,
several of them recurrences of previously-"fixed" bugs. Investigated with 6
parallel Explore/Plan agents reading the actual current code (not trusting
the docs' own claims) before writing anything. See `PHASE_HANDOFF.md` for
the full session narrative.

### D-160 — Character Creation: hide hero-name DOM inputs behind overlays, move Back button to the standard top-left slot

Two related bugs, both in `CharacterCreationScene.ts`. First: the 4 hero
name fields are real HTML `<input>` DOM elements (Phaser's DOM plugin
layers them above the canvas, outside normal depth sorting), and nothing
hid them while a full-screen picker/wizard overlay (`renderPlanPrompt`) was
open — they stayed visible on top of every Class/Race/Gear/Subclass picker,
matching Kevin's "the names of the 4 heroes appear when picking options...
it does nothing" report exactly. Fixed with a `setNameInputsVisible()`
toggle, called from `renderPlanPrompt` (hide) and `clearLevelPlanOverlay`
(restore).

Second: an audit of all 12 back-navigating scenes found 9 of them agree on
a top-left `(110–120, 40–42)` "Back (Esc)" button built with
`uiTheme.ts`'s `createOrnateButton`. `CharacterCreationScene` was the one
outlier — a hand-rolled rectangle at bottom-center `(width/2, 1040)`
labeled "Back to Menu," sitting right at the packed bottom edge where
Kevin also reported the Start/Save buttons as cut off. Moved to match the
other 9 scenes exactly (position, size, label, `createOrnateButton`),
which both fixes "no way to get back to the main menu" and frees up the
crowded bottom edge. `repositionLayout()`'s blind "shift every child by the
viewport-center delta" convention (D-156) would have mis-shifted this
left-anchored button under a future `Scale.RESIZE` attempt, so its
container is tagged `"back-button-anchor"` and excluded — currently a
no-op under `Scale.FIT` but correct groundwork.

### D-161 — Main Menu: Settings/Exit Game buttons no longer overlap the frame border

Root cause: two independent hardcoded-margin systems were never
reconciled. `uiTheme.ts`'s `drawScreenBackdrop` draws the ornate frame at a
fixed `margin = 18`. Settings sat at `y = 32` (height 44) — top edge `10`,
8px ABOVE the frame's `y = 18` line, a real overlap. Exit Game (D-151) sat
at `height - 40` (height 36) — bottom edge `height - 22`, only 4px clear of
the frame's `height - 18` line, eaten further by the button's own stroke
and hover-lift tween. Moved Settings to `y = 48` and Exit Game to
`height - 56`; shifted Account down to `y = 104` to keep its existing gap
below Settings. `mainMenuLayout.ts`'s `computeCornerControlsRegion` (D-154)
updated to match (`y: 26`, same `height: 100`), and its own pinned-baseline
test updated to the new numbers.

### D-162 — Mitigation for a persistent horizontal-squish bug after exiting a battle; stale `Scale.RESIZE` comments cleaned up

Kevin reported the canvas squishes horizontally after "Exit to Main Menu"
from a battle, and stays squished on every later screen — except DOM
elements (the hero-name `<input>`s), which stay correct. Static reading of
the current tree could NOT confirm a root cause: D-159's `Scale.RESIZE`
revert is code-complete (no leftover scale-mode-swap/`setGameSize`/manual
`canvas.style` code anywhere in `src/`), and `Scale.FIT` scales both axes
uniformly by construction, so it can't itself produce a horizontal-only
squish. The DOM-plugin's transform math reads the same `ScaleManager`
state the canvas should — the "DOM stays correct" clue points at the raw
`<canvas>` element's CSS box desyncing from Phaser's tracked
`ScaleManager` state, not a `ScaleManager` mode/config bug.

Given that, this is a **best-effort mitigation, not a confirmed fix**:
`MainMenuScene.create()` now calls `this.scale.refresh()` on every entry
(cheap, harmless if the state was already correct) to re-sync the two.
Flagged explicitly for Kevin to confirm — if it recurs, the next step is a
live repro (inspect the canvas element's style and
`game.scale.displaySize`/`baseSize` right before/after "Exit to Main
Menu"), not a second blind guess. Also corrected several comments in
`uiTheme.ts`, `dialogueBox.ts`, and `tooltip.ts` that still described
`Scale.RESIZE` as currently live (true only briefly, under D-157, before
D-159's revert) — they now describe the current, reverted state.

### D-163 — Removed every silent "invented" level-up default; Starting Level/Team Level fast-forward now queues real prompts at battle start

Kevin's own words, asked to clarify an ambiguous report: *"I have not yet
created any blue-prints and yet the game offers blue-prints for the
character to follow on level up. I don't want that. I want all
blue-prints to be player-made."* Two places were silently inventing a
choice on the player's behalf: `LevelUpPlanSystem.ts`'s three resolvers
(`resolveAsiForLevel`/`resolveSubclassForClass`/`resolveSpellPickForRequest`)
fell back to a fixed default (raise the hero's current-highest ability;
the class's first modeled subclass; the first eligible spell) for ANY
level with no explicit plan entry — and `fastForwardHero` used those
resolvers unconditionally during Character Creation's Starting Level/Team
Level fast-forward, regardless of the hero's Plan Levels mode (even
"Prompted" or no-plan-at-all heroes got every skipped level silently
defaulted).

**The fix**: the three resolvers now return `boolean` (true = an explicit
plan entry was applied, or nothing needed choosing; false = unresolved, no
mutation) instead of always mutating. `fastForwardHero` returns every
unresolved level as a `LevelUpChoiceStep[]` instead of silently filling
them in. `BattleScene.buildHeroes()` collects whatever the pre-battle
fast-forward couldn't resolve into three new pending-choice fields, and a
new `presentPendingFastForwardChoices()` chains them through the exact
same `showSubclassChoiceQueue`/`showAsiChoiceQueue`/
`showSpellPickChoiceQueue` methods `afterWaveCleared` already uses for a
real in-battle level-up — fired once, right before wave 1. Starting
Level/Team Level still work exactly as a convenient level-skip (no
re-fighting to grind), but every choice along the way is now either
something the player explicitly planned or something they're asked about,
never invented. `applyClassLevelUps`'s "auto" branch got the matching fix:
it only skips the prompt when the resolver actually returned true, so an
"auto" hero with no explicit entry for a level is queued exactly like a
"prompt"/"fresh" hero would be. The ASI prompt chain
(`asiQueue`/`showAsiPathChoice`/`showAsiModeChoice`/`showFeatChoice`/
`beginFeatGrant`/`continueFeatGrant`) now threads an explicit `level`
parameter instead of reading `hero.level` (which is wrong once a choice is
deferred past the hero's current level); spell-pick prompts key off the
class's fixed trigger level (`spellPickTriggerLevel`, now exported) for
the same reason. `tests/levelUpPlanSystem.test.ts` rewritten throughout —
every "with no plan" case now asserts `false`/unresolved with no mutation,
rather than the old fixed-default value.

### D-164 — Replaced every remaining click-to-cycle button with a real list picker

D-147 already replaced Class/Race/Gear/Subclass's old cycle buttons with a
real "open a list, pick one" overlay (`openChoicePicker`), but it stayed
private to `CharacterCreationScene`. An audit found the same disliked
pattern still live in 6 other places: `MapBuilderScene` (map width/height,
Kevin's own named example), `SettingsScene` (Game Speed, Master/Music/SFX
Volume), `CharacterCreationScene` itself (Signature Action, Starting
Level, Party Size, Difficulty, Team Level), `FreePlayScene` and
`BrowseSharedMapsScene` (Difficulty, copy-pasted identically in both).
True binary toggles (Mute On/Off, the Standard Array/Point Buy method
switch) were left alone — a 2-state switch isn't the "cycle through a
list" pattern Kevin flagged.

The underlying renderer (`renderPlanPrompt`'s dim-backdrop/title/
wrapping-button-grid drawing code) was lifted out of `CharacterCreationScene`
into `uiTheme.ts` as `renderChoiceOverlay`/`clearChoiceOverlay` (a
caller-owned `overlay: GameObject[]` array in, mutated in place — no
scene-specific state needed) plus a one-shot `openChoiceList` convenience
wrapper for the common "pick one, close" case. Every listed scene now owns
its own small `choiceOverlay` field and calls into the shared primitive;
`CharacterCreationScene`'s own `openChoicePicker`/`renderPlanPrompt` became
thin wrappers delegating to it (preserving D-160's name-hiding hook).
`BattleScene` gained a new `setAnimationSpeed(speed)` (alongside the
existing `cycleGameSpeed()`, which now just calls it) so
`SettingsScene`'s Game Speed button — reachable as a live overlay from the
Pause Menu mid-battle — can set a specific speed instead of stepping
through the cycle. A new pure `difficultyChoiceDescription` in
`data/difficulty.ts` de-duplicates the Difficulty picker's description
text across its three call sites instead of writing it three times.
`SettingsSystem.ts`'s `nextVolume` (and its dedicated test) were deleted —
no longer called anywhere once the volume buttons stopped cycling.

**Deliberately NOT converted**: `BattleScene`'s mid-battle Game Speed "S"
keyboard hotkey — a single keypress cycling a 3-state setting is a normal
keyboard-shortcut convention, not the mouse-driven "click to cycle through
a list" pattern Kevin's complaint was about; forcing a modal open on every
keypress would be a regression, not a fix.

**Roadmap status**: step 3 (`Scale.RESIZE` cutover) is back to NOT DONE.
Step 4 (`BattleScene`'s `TILE_SIZE` scaling) was already correctly gated on
step 3 shipping and being confirmed — it still is, now doubly so.

No new tests — this is a revert of presentation-layer scene-scaffolding
code with no pure-system rule involved, same as D-157 itself. Tests remain
at **1349**. Typecheck clean, all 1349 tests pass, production build
succeeds (126 modules, unchanged — no new files). `npm run dev` serves HTTP
200. This revert restores the EXACT `Scale.FIT` behavior that was working
correctly across many prior sessions (not a new, equally-unverified fix),
so this should be considered a high-confidence correction — but still worth
Kevin's own quick look to confirm both reported bugs are actually gone.

## Phase 27 — KI-098 backlog (this chat, and however many follow)

Kevin's standing instruction (see `KNOWN_ISSUES.md`'s KI-098): work straight
down its 13-item ordered backlog, session after session, with no playtest
checkpoints in between — he's deferring all in-browser confirmation to one
combined pass once the whole list is done.

### D-165 — Compendium: replaced the permanent description block with paginated hover-tooltip rows (KI-098 item 1)

D-158 generalized every other item preview (Gear/Shop) to the shared
`tooltip.ts` hover controller; `CompendiumScene.ts` was the one screen left
showing every entry's full description permanently on-screen via one big
`detailText` blob per category/page.

**The fix**: a new shared `renderRowList(headerLine, panelWidth, rows)`
renders each category as compact one-line rows (name + minimal identifying
stat — cost, level, slot/rarity, etc.), paginated from the panel's real
available height instead of a per-category "how many fit" constant. A row's
full description now appears via `tooltip.ts`'s `attachHoverTooltip` on
mouse hover, exactly like a Gear/Shop item button. Every itemized category
converted: Classes, Subclasses, Races, Feats, Skills, Spells, Equipment,
Potions, Buildings, Traps, Status Effects. Nested categories (a
subclass's features, a race's traits, a Buildings/Traps sub-group) render
their group label as a non-interactive `isGroupHeader` divider row with no
tooltip, then one hoverable row per feature/trait/item underneath. Classes'
stat line and Spells' count line keep their non-interactive `headerLine`
above the row list; every other category has none (`null`).

The Dialogue tab (`renderDialoguePreviewTab`) was deliberately left
unchanged — it's a demo/preview blurb for `dialogueBox.ts`'s styling, not
itemized reference data, so there's nothing here to hide behind a hover.

Mouse-hover only, no keyboard-focus tooltip variant — unlike Build/Gear's
grids (KI-034), Compendium's row list was never part of the full-keyboard-
play requirement (a read-only reference screen, not something a battle
requires completing), and `tooltip.ts`'s `attachHoverTooltip` only wires
`pointerover`/`pointerout` today regardless.

No new tests — this is a presentation-layer-only change to a read-only
reference scene with no pure-system rule involved (same rationale as
D-164/D-157). Typecheck clean, all 1348 tests pass unchanged (no dedicated
`CompendiumScene` test file exists), production build succeeds (126
modules, unchanged). Needs Kevin's own browser look, per KI-098's standing
instruction, folded into the eventual combined playtest pass rather than
checked separately now.

### D-166 — Wired the Character Sheet's hotkey bar into actual battle input (KI-098 item 2)

D-148 built a real, editable hotkey bar (Character Sheet's Hotkeys tab,
`Hero.actionHotkeys`) but nothing in `BattleScene.ts` ever read it — Q/R/F/T
stayed hard-wired to their fixed handlers, so pinning a spell to a slot did
nothing in battle.

**The fix**: a new 4th HUD button row (below Class Action/Character, same
"add a row, no horizontal room left" precedent as every row above it) shows
up to `ACTION_HOTKEY_SLOT_COUNT` (6) small buttons whenever a hero is
selected — one per FILLED slot (`showHotkeyButtonsFor`), dimmed (not
hidden) when its id isn't currently usable, since a pinned-but-not-castable
spell is a normal, expected state (`Hero.setActionHotkey`'s own doc
comment). Clicking one calls `triggerHotkey(slot)`, which dispatches to the
exact same resolver its un-hotkeyed path already uses — `chooseSpell` for a
known spell/cantrip (the spellbook overlay's own per-button handler),
`onBonusActionButton`/`onClassActionButton` for a `HeroActionRegistry`
entry (kind alone identifies which one fires — a hero has at most one
available action of either kind at once), or `onAbilityButton` for a
non-caster's frozen signature ability. No new interaction/UI state, no
change to Q/R/F/T's own behavior — this only adds a second way to fire
something already reachable through them.

A new shared `hotkeyDisplayLabel(hero, id)` in `HeroActionRegistry.ts`
replaces the near-identical private label logic `CharacterSheetScene.ts`'s
Hotkeys tab already had (registry action → known spell/cantrip → frozen
signature ability, in that priority) — both scenes now call the one
function, so they can't drift apart. `tests/heroActionRegistry.test.ts`
gained 4 new cases covering all three id sources plus the empty-slot case.

Deliberately mouse-only, no new keyboard shortcut: the 6 slots are already
labeled "1:"–"6:" in the Character Sheet, but the number-row keys 1-4 are
already bound to "select hero by party slot" (Phase 8) — reusing them for
hotkeys would silently break that existing, KI-034-confirmed shortcut.
Picking a new, unrelated key for a feature Kevin never specified an exact
binding for felt like inventing a keybinding scheme instead of shipping the
one thing actually asked for (wiring the bar itself); mouse-click is enough
to prove the wiring works, and a keyboard shortcut can be layered on later
without changing anything built here.

Typecheck clean, all 1352 tests pass (1348 + 4 new), production build
succeeds (126 modules, unchanged). No browser available in this
environment — needs Kevin's own look, folded into the eventual KI-098
combined playtest pass per his standing instruction.

### D-167 — Equip-flow UX rethink: the roster strip is now a real click target (KI-098 item 3)

KI-098 item 3 explicitly left the target UX unspecified ("make a reasonable
call... log the design reasoning") — Kevin's original complaint was that
the click-item-then-click-a-hero-token flow itself felt clunky, not any one
specific missing feature.

**The judgment call**: rather than build a brand-new overlay/panel from
scratch, the already-existing hero roster strip (D-158's bottom-of-grid
boxes — name/level/HP, always visible, one per living-or-downed hero) was
purely decorative until now — nothing made it clickable. Wiring it up gives
almost everything a dedicated "equip panel" would, for a fraction of the
surface area: each box is now a real click target
(`onRosterBoxClick`) and hover target (`showRosterHoverTooltip`, the same
HP/AC/equip-delta text `updateUnitTooltip` already shows for a board-token
hover). In equip mode, clicking a box targets that hero directly — the
same equip/unequip resolution `handleEquipClick` already ran
(`resolveEquipOnHero`, pulled out as shared code both entry points call),
just aimed at a big, always-visible, never-obscured-by-terrain-or-other-
units box instead of a small board token. Outside equip mode, clicking a
box is a second way to select a hero (identical gates to the existing
number-key `selectHeroByIndex` shortcut) — free, since the box was already
sitting there.

**Deliberately NOT changed**: the original board-token click flow — it
still works exactly as before, unconditionally; this only adds a second,
easier-to-hit target, so a Kevin who's used to clicking the token loses
nothing. No new UI overlay, no change to the item-selection grid itself,
no change to what gets equipped/unequipped or its gold cost.

Typecheck clean, all 1352 tests pass unchanged (this is a `BattleScene.ts`
input-wiring change, not a pure-system rule — same rationale as D-166 for
no new test file). Production build succeeds (126 modules, unchanged). No
browser available in this environment — needs Kevin's own look, folded
into the eventual KI-098 combined playtest pass.

### D-168 — The Character Sheet can now actually cast spells/use actions from it (KI-098 item 4)

Before this, the Character Sheet's Stats tab ("Available Right Now") and
Spellbook tab (per-spell cards) were read-only — casting/acting always
required closing the sheet and doing it on the battle board yourself.

**The fix**: both are now real click targets. A Spellbook card's click
handler, and each Stats-tab action line's new `addActionRow` click handler,
call `castAbilityAndClose(abilityId)` (or `usePotionAndClose()` for the one
potion line) — which closes the sheet, resumes `BattleScene`, and calls
into it through two new PUBLIC methods:
`castAbilityFromCharacterSheet(heroId, abilityId)` and
`usePotionFromCharacterSheet(heroId)`. Both re-validate `heroId` against
whichever hero is still actually selected (should always be the sheet's
own hero — opening the sheet requires a hero already selected, and pausing/
resuming `BattleScene` never touches `ui.kind`) rather than trusting the
caller blindly. `castAbilityFromCharacterSheet` dispatches through a new
`dispatchAbilityId(hero, abilityId)`, extracted from `triggerHotkey`
(D-166) so casting-from-the-sheet and casting-from-a-hotkey share the
exact same resolution rule (known spell → `chooseSpell`; registry action →
`onBonusActionButton`/`onClassActionButton`; frozen signature ability →
`onAbilityButton`) rather than a second copy that could drift.

A single-target spell/ability lands the player right back on the board
mid-aim (the normal aiming-mode UI takes over from there); an AoE/instant
one just resolves immediately, log line and all — identical to pressing
Q/R/F/T or a hotkey directly. A caster's own spell-cast summary line on the
Stats tab stays plain, non-clickable text (its real spells already have
their own click-to-cast cards one tab over on Spellbook — no reason to
duplicate that entry point).

No new tests — this is a `BattleScene.ts`/`CharacterSheetScene.ts` input-
wiring change (the extracted `dispatchAbilityId` is a straight behavior-
preserving refactor of what `triggerHotkey` already did, not new logic).
Typecheck clean, all 1352 tests pass unchanged, production build succeeds
(126 modules, unchanged). No browser available in this environment — needs
Kevin's own look, folded into the eventual KI-098 combined playtest pass.

### D-169 — Main Menu: added a "Build Party" entry point (KI-098 item 5)

Verified first: "New Game" was the ONLY path into `CharacterCreationScene`,
and `CharacterCreationScene` already fully supports building and saving a
party without ever pressing Start Battle (its own "Save Party" button,
D-133/D-152) — the gap was purely discoverability/framing, not a missing
mechanic. A button named "New Game" doesn't read as "you can just build a
party here and leave," even though that's already fully possible.

**The fix**: added "Build Party" to the "Continue Your Journey" row
(alongside Load Game/Campaigns/Free Play/Co-op) — `centeredRowX` already
shrinks every item to fit a growing row, so this needed no layout rework.
Its click handler is `() => this.scene.start("CharacterCreationScene")` —
IDENTICAL to "New Game"'s own handler, on purpose: the two entry points
lead to the exact same scene with the exact same full capability
(including Start Battle, still available and unrestricted either way).
Deliberately no new flag/mode threaded into `CharacterCreationScene` to
distinguish how it was reached — there's nothing to distinguish; a player
who came in via "Build Party" and changes their mind mid-build should be
able to just start fighting, same as anyone else.

No pure-system rule changed — a `MainMenuScene.ts`-only menu addition.
Typecheck clean, all 1352 tests pass unchanged (`tests/mainMenuLayout.test.ts`
doesn't depend on the Journey row's entry count), production build
succeeds (126 modules, unchanged). No browser available in this
environment — needs Kevin's own look, folded into the eventual KI-098
combined playtest pass.

### D-170 — Five more playable races: Dragonborn, Gnome, Goliath, Orc, Tiefling (KI-098 item 6)

Per this project's own "verify SRD content, don't assume" standing lesson
(this isn't the first sourcing correction — see D-109's Tough/Lucky/Athlete
and 13-feats fixes), a research pass against the real SRD 5.2.1 species
chapter was run before adding anything, rather than trusting `races.ts`'s
own "SRD 5.2.1's starter six" header comment at face value. It found two
real mismatches in the ALREADY-SHIPPED six races:

1. **Half-Elf and Half-Orc are SRD 5.1 (2014) species — SRD 5.2.1 dropped
   both as standalone species entirely** (folded into Human/Custom Lineage,
   with Orc promoted to a full species instead).
2. **SRD 5.2.1 actually gives every species the same 30ft base speed** —
   the 25ft-for-Dwarf/Halfling split is SRD 5.1's rule, not 5.2.1's.

**Kevin's-call-style resolution (mirroring D-109's own precedent)**:
correct the ATTRIBUTION, leave the DATA alone. Half-Elf/Half-Orc stay in
the roster exactly as before (SRD 5.1 content is equally allowed under
this project's own sourcing policy, just mislabeled before this fix); the
25ft/30ft speed split stays exactly as before too — retuning an existing,
already-balanced movement number is a mechanical/balance decision outside
KI-098 item 6's explicit "pure content, no system work" scope, not a
sourcing question, so it's flagged in `races.ts`'s own module comment
rather than silently changed. `CONTENT_SOURCES.md`'s races row was split in
three (the corrected original four, Half-Elf/Half-Orc re-attributed to SRD
5.1, and the new five under SRD 5.2.1) to make this precise.

**The five new races** (Dragonborn, Gnome, Goliath, Orc, Tiefling — SRD
5.2.1's remaining species not already in this roster): real names/speeds/
trait titles verified against the actual SRD 5.2.1 species chapter; trait
DESCRIPTIONS are original wording, not copied SRD text, same treatment
every existing race/class already gets. All traits `mechanicallyActive:
false`, same "inert until a system exists to hook into" precedent as
everything else in this file — no new system work, per the item's own
explicit scope. Goliath's real 35ft speed has no matching "faster than
standard" tile tier in this game, so it's flattened to the standard 3
tiles rather than inventing a new speed constant for one race (documented
inline). `RACE_DEFINITIONS`/`RACE_IDS`/`getRaceDefinition` needed no
changes — both `CompendiumScene`'s Races tab and `CharacterCreationScene`'s
race picker (D-147/D-164's `openChoicePicker`) already render an arbitrary,
growing option list, so the 6→11 growth needed zero UI work either.

`tests/races.test.ts` updated: the roster-count/id-list assertion now
expects all 11; the speed assertion now checks every 30ft race in one
loop; the "throws on unknown id" test swapped its example from "gnome"
(now a real id) to "aasimar" (still unknown). Typecheck clean, all 1352
tests pass, production build succeeds (126 modules, unchanged).

### D-171 — Class-based movement bonus: Monk's Unarmored Movement, Barbarian's Fast Movement (KI-098 item 7)

Verified first: race already affects speed (`getRaceDefinition(...).speedTiles`),
but no CLASS granted a bonus — `Hero.bonusMovementTiles` existed only as an
unused hook, and two classes already had a real, named, `mechanicallyActive:
false` SRD feature sitting right there waiting for it: Monk's Unarmored
Movement (level 2, "+10ft while unarmored") and Barbarian's Fast Movement
(level 5, same shape). Wiring both real needed no new content, only a
Hero-side calculation.

**The fix**: a new `Hero.classMovementBonus()` — `+1` for a Monk at level 2+
or a Barbarian at level 5+, `0` otherwise — folded additively into
`effectiveMovementTiles` alongside the existing race/gear/potion terms.
Deliberately a DERIVED value, not a mutation of `bonusMovementTiles`: that
field is the right shape for a one-shot potion grant applied at a single
point in time, but a level-gated class trait needs to recompute correctly
on every level-up with no separate hook into the level-up path at all — a
derived getter gets this for free, a mutated field would need one more
"don't forget to reapply on level-up" call site to keep in sync. Both
features' `mechanicallyActive` flipped to `true` and their descriptions
updated in `data/classes.ts`; `CONTENT_SOURCES.md` needed no change (no new
SRD content, only wiring already-logged features).

**Deliberately unconditional**, not gated on "while unarmored": this game
has no armor-equipped detection anywhere (both classes' own "Unarmored
Defense" AC feature stays inert for the exact same missing-system reason),
so honoring that qualifier would mean building a new system, not just
flipping a data flag — out of scope for what this item asked for. Same
"drop an SRD qualifier the underlying system can't check yet" simplification
already applied elsewhere in this file (Rage's flat bonus, Sneak Attack's
flat die-to-number conversion).

New `tests/d171Features.test.ts` (6 cases): pre/post the level threshold for
both classes, a non-Monk/non-Barbarian class never getting the bonus even
at a high level, and stacking correctly with a race's own (possibly slower)
speed plus a gear/potion movement bonus. Typecheck clean, 1352 → 1358 tests
(+6), production build succeeds (126 modules, unchanged).

**Update**: Kevin's answer to that question (see D-172) revealed the ask was
really about real-feet movement math, not a map-size-scaling mechanic —
resolved by D-172 below, in the same session.

### D-172 — Real D&D movement-speed rescale: 1 tile = 5ft, exactly (KI-098 item 7's map-size follow-up)

D-171's own deferred question ("move speed should also scale with map
size — ask Kevin, don't guess") got a direct answer: Kevin wants movement
speeds to match real D&D math exactly — 5ft per tile (D&D's real square
size), so a standard human (30ft) moves **6 tiles**, not the abstracted
**3** this game had used since Phase 11.3. He confirmed doing the full
rescale immediately, ahead of items 8/10-13, once the true scope became
clear (see below).

**Why this is bigger than "change one constant"**: the old system used "1
tile ≈ 10ft" loosely — Dwarf/Halfling's 25ft became "2" (a rounded
approximation, not exact 25÷10), and every other movement-tied number in
the game (all 63 enemies' `movementTiles`, gear/potion movement bonuses,
the `slowed` status's reduction, D-171's brand-new Monk/Barbarian class
bonus) was tuned relative to that same abstraction. Rescaling only the
hero/race side while leaving enemies alone would have broken hero-vs-enemy
pacing outright (heroes suddenly covering twice the ground per turn against
unchanged enemy speeds). Full accounting:

| | Old | New | Why |
|---|---|---|---|
| `STANDARD_SPEED_TILES` (`races.ts`) | 3 | **6** | 30ft ÷ 5ft, exact |
| `SLOW_SPEED_TILES` (Dwarf/Halfling) | 2 | **5** | 25ft ÷ 5ft, exact — NOT a blind ×2 of the old rounded "2" |
| `FAST_SPEED_TILES` (Goliath, new) | — (flattened by D-170) | **7** | 35ft ÷ 5ft — D-170 flattened this for lack of a "faster than standard" tier; this rescale finally added one |
| `Hero.classMovementBonus()` (D-171: Monk 2+/Barbarian 5+) | +1 | **+2** | a fixed 10ft bonus; 10ft÷5ft=2 |
| Boots of Striding and Springing | +1 tile | **+2** | 10ft SRD bonus ÷ 5 |
| Boots of Speed / Potion of Speed | +2 tiles | **+4** | 20ft bonus ÷ 5 |
| `slowed` status `movementReduction` | 2 | **4** | 20ft reduction ÷ 5 — still exactly cancels a Grunt's new 4-tile speed (4-4=0) |
| Every enemy's `movementTiles` (63 entries, `enemies.ts`) | 1/2/3/4/5 | **2/4/6/8/10** | uniform ×2 — original (non-SRD) balance values, so doubling preserves every existing relative pacing ratio exactly while matching the new tile-to-feet ratio |
| Bannerbearer's `auraBuff.movementBonus` | 1 | **2** | same ×2 |

**Deliberately NOT touched**: `MELEE_RANGE_TILES`/`RANGED_RANGE_TILES`
(attack range, not movement — 1 tile of melee range is now MORE accurate
to real D&D's 5ft reach than before, a bonus correctness win with zero
code change); `DiagonalMovement.ts`'s `TILE_FEET = 5`/`DIAGONAL_COST_FEET`
(an unrelated internal cardinal:diagonal pathfinding cost ratio that
happens to share the number 5 — touching it would have double-scaled
diagonal movement); map dimensions, `TILE_SIZE`, `GAME_WIDTH`/`GAME_HEIGHT`,
`MAX_MAP_COLS`/`MAX_MAP_ROWS` (all KI-098 item 9's own separate concern —
see below).

**A second, harder problem surfaced while planning "bigger maps" as part of
this same push** (Kevin asked for both together): raising
`MAX_MAP_COLS`/`MAX_MAP_ROWS` was assumed to be a data-cap change with the
only known risk being D-157/D-159's already-reverted `Scale.RESIZE`
cutover (documented fork: (a) reflow every scene's vertical layout, or
(b) raise the global logical `GAME_WIDTH`/`GAME_HEIGHT`). Actually reasoning
through option (b): `GAME_WIDTH`/`GAME_HEIGHT` are ONE global Phaser
game-config value shared by every scene under `Scale.FIT` — raising them
to fit a meaningfully bigger battle map (e.g. ~3072×2100 to comfortably
fit a much larger grid) would uniformly SHRINK the rendered size of every
OTHER screen's fixed-pixel content (Main Menu, Character Creation,
Compendium, Settings, etc.) on a real browser window, since `Scale.FIT`'s
one scale factor is bottlenecked by whichever axis grew the most —
concretely, UI text/buttons would render at roughly HALF today's size on a
typical 1920×1080 window. This is a real, previously-undocumented
regression risk beyond what D-159/KI-098 item 9 recorded, discovered
before any code was written (per that item's own standing instruction to
raise its fork with Kevin before touching anything).

**Resolution**: this session shipped the movement-speed rescale (Phase 1,
above) — fully data-only, zero canvas/rendering risk, and exactly what
Kevin asked for. The actual map-size increase (Phase 2) is deferred,
flagged in `KNOWN_ISSUES.md` item 9 with this new finding and a recommended
different technical direction: a BattleScene-LOCAL solution (dynamic
per-map tile pixel size, mirroring `MapBuilderScene`'s own existing
shrink-to-fit pattern, or a zoomed-out camera scoped to the grid only)
that leaves the global `GAME_WIDTH`/`GAME_HEIGHT` completely untouched, so
no other scene is ever affected. `BattleScene.ts` has `TILE_SIZE` baked
into hundreds of world-object size/position calculations, so this needs
its own dedicated planning pass, not a bundled add-on here.

### D-173 — Hero-side split movement: move, act, then move again (KI-098 item 8)

The last piece of the Enemy AI/Movement Redesign epic (D-139 through D-146
built everything else on the enemy side). `Hero.movementBudget()` was
hardcoded to "full allowance before any move, 0 after" (an explicit "MVP:
one move per turn" comment) — a hero could never move partway, act, then
use the rest of their movement, even though real 5e freely allows
interleaving movement and an action.

**The fix**: replaced the boolean-flag budget with real leftover-tracking.
A new private `Hero.movementTilesUsedThisTurn` (reset in
`resetForNewTurn()`, alongside the existing `moved` flag, which keeps its
original "has moved at all this turn" meaning unchanged — still what
Ranger's Hide in Plain Sight/Thief's Supreme Sneak/Cunning Action's own
gate read). `movementBudget()` now returns
`effectiveMovementTiles - movementTilesUsedThisTurn` (floored at 0, still 0
outright for a dead/incapacitated hero); `canMove()` is now just
`movementBudget() > 0`. `Hero.moveTo(dest, tilesUsed?)` gained an optional
second parameter — the real cost of the move just committed — and adds it
to the used-tiles counter instead of maxing it out. Omitting `tilesUsed`
(every pre-D-173 call site: the AI-controlled-hero move in
`runAIHeroTurn`, and every existing test) still consumes the ENTIRE
remaining budget, exactly matching the old one-move-per-turn behavior with
zero call-site changes required anywhere that doesn't care about split
movement.

**`BattleScene`'s two human-move commit points now pass the real route
cost**: `resolveDrop` (the D-144 drag-and-drop flow) already computes
`route.usedTiles` via `MovementSystem.routeThroughWaypoints` for its
in-budget check — that same number now flows straight into `moveTo`.
`confirmMove` (the original click-to-select-a-tile-then-confirm flow)
didn't have this number on hand, so it now runs the same
`routeThroughWaypoints` call (single-destination, no pins) right before
committing, purely to recover the tile cost.

**No new UI was needed for "move again after acting" itself** — every
action handler already returns to the `heroSelected` interaction state on
completion, and that state already calls `showRange(hero)` (gated on
`hero.canMove()`) and every click-to-move path already gates through
`isLegalMove` (gated on `hero.canMove()`/live `hero.movementBudget()`).
Once `moveTo` stopped zeroing the budget outright, the existing
selection/range-highlight/click-to-move machinery started correctly
reflecting leftover budget with no further changes — this turned out to be
a pure `Hero`-layer fix plus two call-site edits, not a UI feature build.

**Cunning Action Dash (Rogue) got a real math fix as a side effect**:
`useCunningActionDash()` used to reset `moved = false`, silently relying on
the old model's "not moved yet ⇒ full budget" collapse to grant a second
full move. Under the new leftover-tracking model that's expressed as
`movementTilesUsedThisTurn -= effectiveMovementTiles` (allowed to go
negative — `movementBudget()`'s own `Math.max(0, ...)` handles it) — real
SRD Dash math: a Rogue who's only used part of their normal move gets the
full Dash bonus stacked ON TOP of what's left (e.g. speed 6, 2 already
spent, Dash ⇒ 6 - 2 + 6 = 10 remaining), while a Rogue who already spent
their entire move gets exactly one fresh full move back — identical to the
pre-D-173 behavior in that specific case, so nothing regresses for the
common path.

**`HeroSnapshot` gained the new field** (`movementTilesUsedThisTurn`),
round-tripped by `toSnapshot`/`fromSnapshot`/`restoreMutableState` — a
partial move mid-turn survives a Coop live-sync snapshot correctly instead
of silently resetting to "haven't moved" on the other player's client.

New `tests/d173Features.test.ts` (9 cases): a partial move leaving budget
behind, the full move→act→move-again sequence, several small partial moves
in a row, the default (no `tilesUsed`) legacy behavior, `resetForNewTurn`
clearing the counter (not just the flag), a dead hero still reporting zero
budget, a snapshot round trip mid-partial-move, and both Cunning Action
Dash math cases above. Typecheck clean, 1358 → **1367** tests (+9),
production build succeeds (126 modules, unchanged). No browser available
in this environment — see `KNOWN_ISSUES.md`'s new KI-124 for the
in-browser checklist.

### D-174 — Level cadence LOCKED to 1 level per hero per wave; a real overworld/campaign XP track is a separate, future thing (KI-098 items 11/12)

Items 11 ("XP distribution toggle: split evenly vs. majority-to-killing-
blow") and 12 ("default 1-20 campaign pacing, scaled by party size") both
turned out to presuppose a per-hero XP/kill-crediting economy that **does
not exist anywhere in this codebase** — leveling has always been uniform:
every LIVING hero levels up together, automatically, every
`LEVEL_UP_WAVE_INTERVAL` waves cleared (`ProgressionSystem`,
`BattleScene.applyClassLevelUps`), with zero per-hero kill tracking. This
was caught by actually reading the code before building anything, not by
trusting the backlog item's own framing — the same "verify before you
build" lesson D-172's canvas-size finding and this session's own
initiative-item correction (see D-175) both reinforced.

Asked directly, Kevin drew a line this project's docs hadn't drawn before:
**two genuinely separate leveling tracks**, not one XP system with a
distribution toggle:
1. **In-battle track (this decision)**: the real D&D 1-20 class-level
   progression every hero already has. Kevin's call: **every hero levels up
   together, every SINGLE wave** (not per-kill, not split/weighted at all)
   — this directly resolves `SOURCE_OF_TRUTH.md` §9's "Level cadence" item
   (OPEN → a DEFAULT of every-2-waves via D-056 → now LOCKED to every wave).
   Applies uniformly across every mode (Free Play, Campaign, Co-op, Test
   Mode) — it always has, this only changes the numeric interval.
2. **Overworld/campaign track (separate, NOT built here)**: a
   story-progression leveling path, campaign-only (never applies to a
   single Free Play map), that would let a hero unlock special bonuses as
   the campaign's narrative advances. Its exact shape is explicitly
   undesigned yet ("yet to come up with," Kevin's own words) — this folds
   into KI-098 item 13 (the overworld campaign redesign epic, already
   Kevin's own explicit lowest priority, and already noted in this
   project's memory as wanting "dual leveling tracks"). Building this now,
   disconnected from item 13's actual campaign-structure design, would be
   exactly the kind of dead scaffolding this project has already rejected
   more than once (see D-153's audio-settings precedent going the OTHER
   way, and Kevin's own repeated "no dead scaffolding" feedback) — nothing
   would feed it real data until item 13 exists.

**The fix**: `ProgressionSystem.LEVEL_UP_WAVE_INTERVAL` 2 → **1**. That's
the entire code change — `hasPendingLevelUp`'s arithmetic
(`Math.floor(wavesCleared / LEVEL_UP_WAVE_INTERVAL)`) already generalizes
to any interval, and `tests/progression.test.ts` asserts everything
relative to the constant rather than a hardcoded `2`, so both existing
tests pass unchanged against the new value. No XP-split toggle was
built — there is nothing yet for it to control.

Typecheck clean, all existing tests pass unchanged (no new test file — a
single-constant DEFAULT-to-LOCKED change to already-tested arithmetic
needs no new coverage), production build succeeds. Item 12's campaign-
pacing-curve question is deferred into item 13 in full, not answered here.

### D-175 — Per-group initiative for the enemy phase (KI-098 item 10)

Kevin's answer to the granularity question (individual enemies / per-group
/ all-non-boss-together): **per-group**. Before building, the "current
behavior" this question was framed against turned out to be wrong —
`WaveSystem.tickEnemyPhase`'s main loop processes every enemy in `this.
active`, boss included, in one flat spawn-order loop with no turn-order
distinction whatsoever (no existing "boss gets its own turn" special case
to preserve, contrary to how the decision was initially framed to Kevin).
This actually made per-group cleaner to build: no existing behavior to
carve an exception around.

**The design**: "group" = enemy TYPE (`EnemyDefinition.id`) — every Grunt
acts as one group, every Runner another, a Boss (a group of one) its own.
A group's initiative (`InitiativeSystem.rollInitiative`, previously built
"framework only" in Phase 13.5 and never actually consumed by anything
until now) is rolled ONCE, the first time that type appears in a given
WAVE (bonus 0 — enemies have no ability-score-derived initiative modifier
in this data model, unlike a hero) — not re-rolled every phase, so a
group's relative position in the turn order stays fixed for the whole
wave, the same way a real 5e initiative order holds for a whole encounter.
A brand-new type spawning mid-wave (e.g. wave 4's second spawn group
starting turn 3) gets its own fresh roll and slots in wherever that roll
lands, without touching any already-rolled group.

**Implementation**: a new `WaveSystem.applyGroupInitiativeOrder()`, called
once per phase right after `spawnDueEnemies()` (so this phase's own new
spawns get a place in the order too), sorts `this.active` **in place**
(not into a separately materialized array) by each enemy's group roll,
descending, tie-broken by type id for full determinism. Sorting the array
in place, rather than iterating a snapshot copy, was deliberate: the main
loop right after it is a `for...of` over the live `this.active`, and a
same-phase reinforcement/summon (`trySpawnReinforcements` et al.) pushes
directly into that same array mid-loop — `for...of` over a live array
already picks up items appended during iteration, so sorting in place
preserves the existing "a reinforcement can act the very phase it spawns"
behavior exactly, with zero changes to that mechanic. `Array.prototype.
sort` is a guaranteed-stable sort (ES2019+), so members within one group
keep their original relative (spawn) order automatically — no explicit
tie-breaking needed for that part.

**`groupInitiativeRolls` is cleared in `startWave`** (alongside the
already-existing `spawnedCounts`/`pendingRetry`/`reinforcementCooldowns`
resets) so every new wave gets a fresh roll per type — deliberately NOT
added to `WaveStateSnapshot`, the same already-accepted gap
`reinforcementCooldowns` has: a Coop live-resync just re-rolls it, which
can only reshuffle enemy ACT ORDER, never anything that affects fairness
or outcome.

**Verified against `RandomService.fixed()`** (this project's near-
universal test double, which makes every roll return the same value): a
tie always breaks alphabetically by type id — deterministic, if not
particularly meaningful, for the vast majority of existing tests that
don't care about turn order at all. Confirmed the full suite (1367 tests
going in) still passes unchanged with this reordering in place — no test
anywhere asserted on raw multi-type spawn-order that this change would
have disturbed.

New `tests/waveInitiative.test.ts` (3 cases): same-type enemies always
form one contiguous run in the processing order (never interleaved with
another type); a tie under `RandomService.fixed()` breaks alphabetically
by type id; and — using a real seeded `RandomService` plus a parallel,
identically-seeded "predictor" instance that calls `rollD20()` in the same
sequence the implementation does, to derive the expected order without
hardcoding a PRNG's internal output — a group's initiative order holds
across multiple phases in the same wave rather than being redrawn (and
potentially flipped) every tick. Typecheck clean, 1367 → **1370** tests
(+3), production build succeeds (**127 modules, +1** — `InitiativeSystem.
ts` is now a real production dependency for the first time since it was
built "framework only" in Phase 13.5).

This resolves `SOURCE_OF_TRUTH.md` §9's "Initiative" item too ("keep party
phases or later add individual initiative?") — the actual answer, per
Kevin, is a middle ground neither option on that table names: party phases
stay (Player Phase / Enemy Phase blocks are unchanged), but the Enemy
Phase itself now has real per-group turn order instead of none at all.

**Test changes**: `tests/races.test.ts`, `tests/characterBuildSystem.test.ts`,
`tests/d171Features.test.ts`, `tests/potions.test.ts`,
`tests/equipment.test.ts`, `tests/heroStatusEffects.test.ts`,
`tests/statusEffects.test.ts` — direct literal-value updates for the
rescaled numbers. `tests/waves.test.ts`, `tests/building.test.ts`,
`tests/enemyCollision.test.ts`, `tests/combat.test.ts`, `tests/flying.test.ts`,
`tests/enemyMechanics.test.ts`, `tests/enemyMechanicsPhase21.test.ts`,
`tests/phase7Structures.test.ts`, `tests/battleStateSnapshot.test.ts`,
`tests/enemyEngagementRedesign.test.ts` — hand-built lane/maze maps sized
around the OLD (smaller) speeds needed widening so a faster enemy doesn't
breach the exit (or otherwise run off the edge of the test's intended
scenario) before the assertions run; a handful of exact expected positions
were recomputed by hand from the new speeds, including one case
(`enemyEngagementRedesign.test.ts`'s "AoE attacker with nothing to gain")
where a larger movement budget revealed a genuine, pre-existing (not
rescale-caused) pathfinding detour around a blocked hero tile that a
smaller budget had never reached far enough to expose — the test's
expectation was corrected to match that real, already-existing behavior,
not "fixed" by changing the pathfinding itself.

Typecheck clean, all 1358 tests pass (no net count change — every fix was
either a literal-value update or a widened test map, no tests
added/removed), production build succeeds (126 modules, unchanged). No
browser available in this environment — needs Kevin's own look, folded
into the eventual KI-098 combined playtest pass.

### D-176 — Bigger maps: dynamic per-map tile size + raised MAX_MAP_COLS/ROWS (KI-098 item 9, closes the whole KI-098 "build" backlog)

The last actual build item on KI-098 (item 13 is Kevin's own explicit
lowest-priority epic, goes whenever). Flagged repeatedly as the single
riskiest item on the list — D-157/D-159 already cost two real regressions
attempting a `Scale.RESIZE` cutover for an unrelated push, and D-172 found
a third risk in the same territory (raising the global `GAME_WIDTH`/
`GAME_HEIGHT` would uniformly shrink every other screen's UI under
`Scale.FIT`). This session confirmed, via two Explore agents mapping every
`BattleScene.ts` `TILE_SIZE` usage and the `MapBuilderScene` shrink-to-fit
pattern, that neither ruled-out direction is needed: the fix is entirely
`BattleScene`-LOCAL and never touches the global canvas/scale mode.

**Findings that made this safe**: every one of `BattleScene.ts`'s ~68
`TILE_SIZE` usages turned out to be grid/world-space (tile rects, hero/
enemy/summon tokens, highlight/targeting overlays, the whole cast-visual/
death-visual VFX block) — zero are HUD/chrome, since HUD layout was
already decoupled from grid size by an earlier fix (D-158's `wrapWidth`
change). `GridSystem` (`src/game/systems/GridSystem.ts`) already stores its
own per-instance `tileSize`/`cols`/`rows`/`originX`/`originY` —
`BattleScene` just never read `this.grid.tileSize`, using the static
`TILE_SIZE` import everywhere instead. And `MapBuilderScene.
rebuildGridSystem()`/`renderGrid()` already implement the exact needed
pattern (`tileSize = Math.floor(Math.min(64, availableWidth/cols,
availableHeight/rows))`, every render call reading the instance's own
stored values, never a hardcoded 64) with no gaps — a proven, reusable
template.

**The fix**: extracted that shrink-to-fit math into a new pure, unit-
tested `computeFittedTileSize(cols, rows, availableWidth, availableHeight,
maxTileSize)` in `GridSystem.ts` (no Phaser dependency). `BattleScene`'s
grid-construction block now computes `availableWidth = GAME_WIDTH` (nothing
else occupies the grid's horizontal band) and `availableHeight =
GAME_HEIGHT - GRID_TOP_MARGIN - 403` (`403` = the fixed vertical space
every HUD row below the grid needs, independent of tile size: roster/
status block 78 + combat log 86 + gap 20 + gear/shop grid 4*38=152 +
pagination nav row 30 worst-case + gap 6 + Done button half-height 15),
then passes `computeFittedTileSize(this.map.cols, this.map.rows,
availableWidth, availableHeight, TILE_SIZE)` into `GridSystem`'s
constructor instead of the raw `TILE_SIZE` constant. Every one of the ~68
remaining `TILE_SIZE` references in the file was then mechanically
replaced with `this.grid.tileSize` (a careful three-exception bulk
replace: the `config.ts` import itself, the one legitimate `TILE_SIZE`
usage as the `maxTileSize` clamp argument, and a `TILE_SIZE`-referencing
historical comment about pre-D-158 code, all protected before the bulk
replace and restored after). `this.map.cols`/`this.map.rows` usages
(board-iteration loops) were untouched — already correctly data-driven.
`MapBuilderScene`'s own inline copy of the same math was deliberately left
alone (already works, out of scope, zero regression risk to a working
file).

**Verified no regression for existing content**: every shipped map (18x9
down to 14x9) still computes back to `tileSize = 64` under the new formula
(`Math.min(64, ...)` never upscales, and their available room already
exceeds 64px/tile) — explicit test coverage below.

**`MAX_MAP_COLS`/`MAX_MAP_ROWS`** (`src/game/systems/MapBuilderSystem.ts`)
raised from **20/9 to 32/14**, re-derived against the same fixed-HUD
bounding-box math the old caps used, but against a chosen **40px minimum
tile-size floor** (62% of the base 64px — a legibility choice, not a
technical limit; tokens/HP text/VFX all scale off tile size) instead of
the old fixed 64px: available grid height is a fixed 587px (`1080 - 90 -
403`), giving `floor(587/40) = 14` rows; available width is the full
1280px canvas width, giving `floor(1280/40) = 32` cols. **Flagged as a
first-pass balance value, same status as `STARTING_GOLD`** — the
mechanism (dynamic shrink-to-fit) is correct regardless of exactly where
Kevin later wants the floor to land. `MIN_MAP_COLS`/`MIN_MAP_ROWS` (6)
unchanged; `validateDraft()` needed no logic change (already checks
generically against the exported constants); `MapBuilderScene`'s own
Width/Height choice-list pickers needed no code change either (they
already loop `MIN..MAX_MAP_*`).

**`firestore.rules` needed real (not just constant-bump) changes**: rules
have no loop construct, so `isValidTileRows`'s per-row-index bounds check
was hand-unrolled up to `rows[8]` (9 rows) — extended with 5 more explicit
checks through `rows[13]` (14 rows), same shape as the existing ones;
`isValidSharedMap`'s `data.cols <= 20`/`data.rows <= 9` bumped to `<= 32`/
`<= 14` to match. Deploys the same way every other change does, via
Kevin's normal push-to-main → GitHub Actions → Firebase pipeline.

New `tests/gridFitting.test.ts` (7 cases): clamps at `maxTileSize` with
room to spare, never upscales past it, shrinks correctly when width is
the binding dimension, shrinks correctly when height is the binding
dimension, floors fractional results, a regression case asserting every
shipped map's real dimensions still fit at 64px, and a case confirming a
map at the new 32x14 cap shrinks to exactly the 40px floor. Typecheck
clean, 1370 → **1377** tests (+7), production build succeeds (127
modules, unchanged — `computeFittedTileSize` lives inside the existing
`GridSystem.ts` module).

**This closes the entire KI-098 "build" backlog** — only item 13 (the
overworld campaign epic, Kevin's own explicit lowest priority) remains, and
that's a future design conversation, not a quick follow-up. No browser
available in this environment; this is a real rendering change (every
token/VFX size is now computed, not constant) that explicitly needs
Kevin's own look, same as everything else queued for his eventual combined
KI-098 playtest pass — see `KNOWN_ISSUES.md`'s new KI-127.

### D-177 — Item 13 (overworld campaign) begins: companion catalogue expanded to 12, one per playable class

Kevin picked "start item 13" and, given the choice of which slice to build
first (companion roster data, region migration, dialogue writing, or the
bonus-choice pool), chose the companion roster — then, on seeing the design
doc's original six, asked directly why the roster was capped at six when
this game has 12 classes: he wants the campaign to double as a soft tour of
every class over its course, BG3-style, even if the party (1 PC + 3 active,
`MAX_ACTIVE_COMPANIONS`) never needs to hold all 12 at once and a shorter
run might not meet every one of them.

**The scope fork, resolved before writing any data**: keep
`CAMPAIGN_STORY_DESIGN.md` §6's original six ("mirror" companions, each
tied to a region's boss/theme) exactly as designed, and add six MORE — one
for each class the original six didn't cover (Barbarian, Bard, Cleric,
Monk, Rogue, Sorcerer) — as ordinary recruits with a one-line hook apiece,
explicitly NOT carrying the same boss-mirror narrative weight (there are
only six regions/bosses for the original six to pair with; inventing a
seventh-through-twelfth mirror relationship would need new regions that
don't exist). Confirmed with Kevin before writing: approved as drafted,
including letting the new six's names/flavor be invented outright (one-line
hooks only, no deep dialogue writing — that stays a separate, later pass
per §9, same as the original six's still-unwritten arcs).

**Class assignment**: the six existing named companions were fit to a
class matching their already-written personality (no class had been
assigned to any of them before this session) — Hollis Vane → Fighter,
Fenna Duskwater → Druid, Isolde Varnhall → Wizard, Tamsin Rourke →
Paladin, Dorian Wick → Warlock, Sorrel Thane → Ranger. The six new
recruits — Brand Ashcairn (Barbarian), Wren Calloway (Bard), Perrin Holt
(Cleric), Mira Quill (Monk), Cass Ferrow (Rogue), Ellery Vance (Sorcerer)
— cover the remainder, one apiece, so all 12 classes are represented
exactly once across the full 12-companion roster.

**The build**: `data/companions.ts`'s `COMPANIONS` array (D-118's engine
scaffolding, empty until now) is populated with 12 real, valid
`CharacterBuild`s — race, ability-score priority order (`StandardArrayAllocator`
with a per-class-appropriate order, e.g. STR-first for the Barbarian,
INT-first for the Wizard), a flavor-matched signature action/cantrip, and
one starting common/uncommon item apiece (all 12 `STARTING_GEAR_IDS`
entries used exactly once, no repeats). `subclassId` is set only for the
three level-1-choice classes (Cleric/Sorcerer/Warlock, via
`subclassIdForNewBuild` — identical to how `CharacterCreationScene` sets
one for a player-built hero); the other nine classes stay undefined and
get their subclass assigned through the existing in-battle level-up queue
once that companion actually reaches their class's real choice level,
exactly like any player-built hero — no special-cased behavior invented
for companions. `homeRegionId` is set only for the two mirror companions
whose region already has a real `CampaignDefinition` id today (Tamsin →
`"emberford-reach"`, Fenna → `"saltmere-shallows"`) — the other four
mirror companions' regions (Cinderfall Rift, Frostbound Hollow, Shattered
Causeway, The Drowning Vale) are maps only, not yet wrapped in a chaptered
campaign, matching that field's own "undefined until regions have real ids
of their own" contract from D-118.

`CompanionRosterSystem.ts` needed ZERO changes — confirmed before writing
any data that nothing in it hardcodes an assumption about roster size;
recruit/bench/lose logic is already generic over however many companion
ids exist.

`CAMPAIGN_STORY_DESIGN.md` §6/§9 updated to describe the 12-companion
roster and flag the new six as deliberately lighter-weight than the
original six. `CONTENT_SOURCES.md` gained the entry §9 itself had flagged
("shouldn't [get an entry] until it's actually implemented as data... so
it isn't forgotten once building starts") — every companion name/hook/
build choice here is original content, no SRD/D&D-derived lore; the
class/subclass/race MECHANICS these builds reference were already logged
in existing rows.

Tests: 1377 → **1384** (+7, `tests/companions.test.ts` rewritten from its
old "catalogue is empty" assertions to real shape checks — 12 companions,
one per class, unique ids, every build resolves through
`heroDefinitionFromBuild` without throwing, exactly 3 start in the party,
`homeRegionId` only ever names a real campaign id). Typecheck clean, all
1384 tests pass, production build succeeds (**127 modules, unchanged** —
`companions.ts` was already reachable through `CompanionRosterSystem`'s
existing import graph, just empty before). No browser available in this
environment, and none is needed yet — this is pure data with no scene/UI
consumer wired up (same "engine scaffolding first" boundary D-118 itself
drew); nothing here is visually checkable until a future session builds
an actual recruitment screen.

**Deferred, and why**: full dialogue/arc writing for the original six
(§9's own "still open" item, unchanged by this session); the region
migration of the two existing flat campaigns into D-118's chapter
structure; the bonus-choice pool numbers (§8); any `SaveSystem`/
`BattleScene` wiring for the companion roster (still standalone, exactly
as D-118 left it) — none of these were in scope for "build the companion
roster data," and building them speculatively without a consuming UI
would be exactly the kind of dead scaffolding this project avoids.

### D-178 — Removed the "signature action" system entirely; every hero's basic attack now comes from its own class's fixed identity

Kevin's own explicit ask, stated plainly: "I don't want them (or anyone in
the game) to have a signature action. I want all available actions to be
straight from the DnD 5.5e class that they have levels in." Investigated
before writing any code (3 Explore passes + 1 Plan-agent review reading the
real code) rather than assumed — the finding that shaped the whole fix:
removing this was almost entirely SUBTRACTION, not addition. A non-caster's
real weapon Attack (`Hero.tryBasicAttack`) was already fully weapon-driven
(Extra Attack, weapon mastery, Divine Smite, Hunter's Mark, equipment procs)
independent of `abilityId`; every real class bonus/class-action
(`HeroActionRegistry.ts` — Second Wind, Rage, Reckless Attack, Action Surge,
Cunning Action, Flurry of Blows, Wild Shape, Bardic Inspiration, Hunter's
Mark, Preserve Life, Vanish, Empty Body, Quickened Spell) was already
independent too; a caster's full known-spell list (`knownSpellIdsForClass`)
in battle was ALSO already fully independent — the spellbook Q-button never
needed the frozen ability pick either. The ONLY real gap: `CharacterSystem
.combatStatsForClassLevel`/`attackStyleForAbility` used the player's chosen
`abilityId` to seed a hero's PRE-WEAPON baseline (melee/ranged style +
STR/DEX/INT/WIS/CHA scaling for `attackDamage`/`attackRangeTiles`/
`attackBonus`).

**The fix**: a new fixed per-class table on `data/classes.ts` —
`basicAttackStyle: "melee" | "ranged"` (12 entries, one per class, grounded
in real 5e convention: Fighter/Barbarian/Paladin/Rogue/Monk melee, Ranger
and all 6 full casters ranged) — paired with the ALREADY-EXISTING
`primaryAbility` field (previously only used for Compendium flavor text; it
already held exactly the right ability per class — str for Fighter, int for
Wizard, etc. — no new ability-score data needed at all). `combatStatsForClassLevel`
(renamed the style helper `attackStyleForClass`) now reads these two fields
directly, dropping the `abilityId` parameter, the `isSpellId` branch, and
the Monk-only hardcoded DEX-melee exception (now handled generically, since
Monk's own `basicAttackStyle`/`primaryAbility` already say melee/dex).

**Removed entirely**: `CharacterBuild.abilityId`/`HeroDefinition.abilityId`/
`Hero.abilityId` (every field, every read site — constructor, snapshot,
save/load validation, Co-op sync); the "Choose Signature Action" picker in
`CharacterCreationScene` (with the vertical layout below it collapsed
upward, not left as a dead gap); the 4 invented, explicitly-non-SRD
abilities (`cleave`/`piercing-shot`/`taunting-slam`/`frost-bolt`) from
`data/abilities.ts`; `hasDuplicateAbilities` (its whole premise — "did two
heroes pick the same ability" — stops existing); the entire `aimingAbility`
interaction-kind in `BattleScene.ts` (a full member of the `ui.kind`
discriminated union with a footprint well beyond the obvious call sites —
`setInteraction`'s dispatch table, `showAbilityTargets` [now fully dead],
Esc handling, the board-click resolver, `returnToAimingMode`'s re-entry
branch, `refreshStatus`'s roster-highlight/hint-text checks — all removed,
not left unreachable). A non-caster's Q-button now shows nothing at all
(`showAbilityButtonFor` gates on `isCasterHero`); casters' "Cast a Spell
(Q)" path is completely untouched. `firestore.rules`' `isValidBuild` also
needed the same field dropped from its `hasOnly` list, or cloud "Save
Party" pushes would start failing security-rule validation the moment the
field left `CharacterBuild` — caught during planning, not left as a
surprise (not exercised by `npm test`, only the separate emulator-based
`test:rules`, so this would have been easy to miss).

**Known, accepted limitation, not fixed this pass**: `Hero
.effectiveAttackBonus`'s ability-modifier component doesn't re-derive from
an equipped weapon of a different style/ability than the class baseline —
it stays pinned to whatever the baseline table says. This bug already
existed (previously pinned to the player's `abilityId` pick instead); this
change doesn't make it worse, just changes what it's pinned to. See
KI-128.

Tests: ~26 files referenced `abilityId`/the 4 deleted ids — most were
mechanical (a throwaway field dropped from a test-fixture object literal,
handled by a background agent across 18 files with zero logic changes);
`tests/characterSystem.test.ts`/`tests/classLeveling.test.ts`/
`tests/characterBuildSystem.test.ts`/`tests/characterCreationData.test.ts`/
`tests/heroActionRegistry.test.ts`/`tests/heroActionHotkeys.test.ts`/
`tests/newCoreClasses.test.ts`/`tests/visualFxSystem.test.ts` needed real
logic rewrites (new function signature, real substitute spells for the
deleted abilities' test fixtures — e.g. `color-spray`/`magic-missile` for
the aoeAdjacent/autoHit shape checks `cleave`/`piercing-shot` used to
cover). Typecheck clean, all 1376 tests pass (net change from other test
additions/removals this session too — see D-179), production build
succeeds (127 modules, unchanged). No browser available in this
environment — this is a real HUD change (a non-caster's Q-button
disappears entirely) that needs Kevin's own look; see KI-128.

### D-179 — Migrated Emberford Reach + Saltmere Shallows into real 4-chapter regions (KI-098 item 13, campaign structure)

The other half of this session's request: "migrate the campaign stuff" —
turning D-118's `ChapterDefinition` engine scaffolding (built ahead of any
consumer, per that decision's own explicit framing) into the first real,
playable use of it, per `CAMPAIGN_STORY_DESIGN.md` §2's 4-chapter region
shape (Ch1 levels 1-5 ends in a miniboss, Ch2 6-10 a first, lighter
encounter with the region's real boss, Ch3 11-15 a branch-payoff chapter
reusing the established roster at higher counts, Ch4 16-20 the boss at
full strength). Investigated before building (same Explore-then-Plan-agent
method as D-178) — the review found nothing in `BattleScene`/
`CampaignSelectScene` called `getChapter`/`isChapteredCampaign` anywhere;
turning `chapters` on with no scene wiring would have been genuinely dead,
invisible data. Confirmed with Kevin directly (not assumed): chapters ship
as scaffolding-made-real this session, cross-chapter CONTINUITY (gold/gear/
class level carrying over between chapters) is explicitly deferred — every
battle stays fully self-contained exactly as today, matching how D-118
itself shipped ahead of any consumer. Companion dialogue/story writing
stays out of scope too, per Kevin's own explicit instruction — that's a
dedicated future planning-and-writing session.

**Content decisions**: Emberford Reach's Ch1 miniboss is `basalt-colossus`
(confirmed unused in the existing flat wave list — free to introduce).
Ch4 in BOTH regions is an EXACT reuse of the existing flat 6-wave
`EMBERFORD_WAVES`/`SALTMERE_WAVES` (same array reference, same top-level
`waves`/`bossEnemyId` fields per `ChapterDefinition`'s own "describe the
finale" doc contract) — zero regression risk for the one chapter every
pre-existing test already validated. Ch2 in both regions reuses the SAME
boss id (`cinderlord`/`tidelord`) behind a much lighter escort than Ch4's
finale — a real "first encounter" beat without inventing a second boss id
per region (the roster only has one boss per region). Ch3 remixes each
region's own established roster at higher counts, per the design doc's own
"no new enemy required" framing. New wave content uses enemies NOT already
in each region's flat list where possible for chapter variety (`marauder`,
`blightcaller`, `cave-drake`, `frost-warden`), grounded in the same
`turnLimit`/`completionGold`/`timeBonusGold` ramp shape the existing flat
lists and the classic `WAVES` list both use — same KI-015 "first-pass
guess, Kevin's in-browser call" caveat every wave number in this project
carries.

**Saltmere's Ch1** — the design doc's own "returning miniboss" mechanic
(whichever miniboss the player spared in an EARLIER region) depends on
world-flag/companion state from regions that aren't playable content yet
(only 2 of the design's 6 regions exist at all) — not buildable now. Per
the design doc's own documented fallback for exactly this case, added one
new small enemy, **`tide-wretch`** (`data/enemies.ts`, miniboss tier,
deliberately no `loreText`/name-callout — "a wall, not a character," per
the design doc's own words), used as Saltmere's Ch1 miniboss. Original
content, logged in `CONTENT_SOURCES.md`.

**Scene wiring** (the part that makes this real, not just data):
`CampaignSelectScene` now shows each chaptered campaign's next-unplayed
chapter ("Chapter N of 4 · Boss: X · N waves" — the UPCOMING chapter's own
info, not always the region's ultimate finale boss, so starting Chapter 1
doesn't spoil the ending) and resolves/passes that chapter index through
`CharacterCreationScene` (a new relay-only `chapterIndex` field, forwarded
unchanged into `BattleScene`'s own init data — easy hop to miss since it's
not in `BattleScene.ts` itself) into `BattleScene`. `BattleScene`'s
existing campaign chokepoint now resolves `getChapter(campaign,
chapterIndex)` for `waveList`/`lootPoolIds` instead of the top-level
(finale-describing) fields, stored as a new `this.currentChapter`. The
victory hook (`markCampaignCompletedIfAny`) now calls
`CampaignProgressSystem.markChapterCompleted` for a chaptered campaign,
advancing to the next chapter on a future visit, and only calls the
whole-region `markCampaignCompleted` (the "[Completed]" tag) once the
FINAL chapter clears — a flat campaign's single-battle-clears-it-all
behavior is completely unaffected (`isChapteredCampaign` gates the branch).
Chapter `introText`/`outroText` (still unwritten content — no chapter has
either field set this session) render via the already-built `showDialogue`/
`DialogueBoxController` (`scenes/dialogueBox.ts`, D-119) — intro before
even the pre-battle ASI/subclass/spell-pick fast-forward prompts, outro
right before the victory end screen — both real no-ops today via a simple
`if (!introText) { onComplete(); return; }` guard, so this is genuine,
already-wired plumbing waiting for the future writing pass, not unused
code. Flat campaigns and Free Play are completely unaffected by
construction (their synthesized chapter 0 has neither field).

**Known, accepted limitation, not fixed this pass**: the end-screen still
routes to Main Menu even after clearing a mid-region chapter, not back to
Chapter Select — progress is still correctly persisted either way, this is
a UX rough edge, not a data bug. See KI-129.

`tests/campaigns.test.ts`'s "Chapters (D-118)" block's 3 "neither existing
campaign is chaptered" assertions moved onto a synthetic fixture (both real
campaigns are now genuinely chaptered) — the file's other pre-existing
tests needed NO changes, since they only ever read the finale-describing
top-level `waves`/`bossEnemyId` fields, which Ch4 preserves exactly. New
"Chapters (D-177)" describe block added (naming the companion-catalogue
session that originally surfaced this content, kept consistent with that
file's own section naming) validating every chapter's own wave/enemy
content, gold ramp, and boss-only-in-its-own-finale-wave — the pre-existing
tests didn't look at `chapters` at all, so this closes a real coverage
gap. `tests/enemyRoster.test.ts`'s miniboss-count assertion updated
5→6 for the new `tide-wretch`. Tests: net to **1376** (some removed
alongside D-178's own signature-action cleanup, ~10 new chapter-content
assertions added here). Typecheck clean, production build succeeds (127
modules, unchanged). No browser available in this environment — the new
Chapter Select flow and chapter-by-chapter play both need Kevin's own
look; see KI-129.

### D-180 — Migrated the other four regions (Shattered Causeway, Cinderfall Rift, The Drowning Vale, Frostbound Hollow) into real 4-chapter regions (KI-098 item 13, continuing D-179)

Kevin's ask this session: "continue item 13 with building the other 4
regions." D-179 (the immediately preceding session) built the 4-chapter
region shape and wired it end-to-end (`CampaignSelectScene`/
`CharacterCreationScene`/`BattleScene`) for Emberford Reach/Saltmere
Shallows — but those two were already flat `CampaignDefinition`s before
D-179 touched them. The other four regions in
`CAMPAIGN_STORY_DESIGN.md` §3's table (Shattered Causeway, Cinderfall
Rift, The Drowning Vale, Frostbound Hollow) had NO `CampaignDefinition` at
all — their maps (`data/causewayMap.ts` etc., Phase 23/D-114) were
Free-Play-only content, never wrapped in a campaign. This session builds
all four from scratch: a new flat 6-wave `waves`/`bossEnemyId`/
`lootPoolIds` (matching the original Phase 11.8 shape every campaign's
top-level fields still describe) PLUS the same D-118 `chapters` structure
D-179 established, in one pass rather than two.

**No scene-code changes were needed.** `CampaignSelectScene`/
`CharacterCreationScene`/`BattleScene`'s chapter wiring is already fully
generic over `CAMPAIGNS` (confirmed by reading the actual code, not
assumed) — adding four more entries to the `CAMPAIGNS` array is
sufficient for all of it (chapter progress display, chapter-index relay,
wave/loot resolution, chapter-vs-region completion marking) to just work.
This is a pure content/data session.

**Region → boss assignments** (`CAMPAIGN_STORY_DESIGN.md` §3's own table,
all eight enemies already existed in `data/enemies.ts` from Phase 20/21 —
no new enemy needed, unlike D-179's Saltmere `tide-wretch`):
- **Shattered Causeway** (`causewayMap.ts`, chasm/pit bridge): Ch1
  miniboss **Juggernaut**, Ch4/finale boss **The Devourer**.
- **Cinderfall Rift** (`cinderfallRiftMap.ts`, volcanic, collapsing
  bridge): Ch1 miniboss **Gravemaw**, Ch4/finale boss **Warlord Korrath**.
- **The Drowning Vale** (`drowningValeMap.ts`, tidal marsh): Ch1 miniboss
  **The Husk**, Ch4/finale boss **Blightmother**.
- **Frostbound Hollow** (`frostboundHollowMap.ts`, verticality/frozen
  ridge): Ch1 miniboss **Bloodrage Warlord**, Ch4/finale boss **Sundered
  King**.

Same content shape D-179 used throughout: Ch1 (levels 1-5, 4 waves) ends
in the region's miniboss; Ch2 (6-10, 4 waves) is a lighter first encounter
with the SAME boss id Ch4 uses (no second boss per region exists, matching
D-179's own reasoning); Ch3 (11-15, 4 waves) remixes the region's own
established roster at higher counts, no new named enemy; Ch4 (16-20) is an
EXACT reuse of the new flat 6-wave list (same array reference as the
campaign's own top-level `waves`/`bossEnemyId`/`lootPoolIds` fields, zero
regression risk). Each region's flat 6-wave list and 3 new chapter wave
lists draw from the existing enemy roster, themed loosely to the region
(e.g. Drowning Vale leans on `blightcaller`/`fungal-splitter`/
`plague-warden`/`hexbinder`'s poison/blight mechanics; Cinderfall Rift
leans on the `warcaptain`/`bannerbearer`/`battlepriest` aura-captain family
as a smaller-scale preview of Warlord Korrath's own aura). Same
`turnLimit`/`completionGold`/`timeBonusGold` ramp shape every existing
wave list in this project already uses — same KI-015 "first-pass guess,
Kevin's in-browser call" caveat.

**Cinderfall Rift's bridge-collapse and Drowning Vale's tide rise/recede**
(`DynamicTerrainEvent`s keyed to a wave NUMBER on the map itself, shared
across every chapter that uses that map) were left completely unchanged —
in the new 4-wave chapters (Ch1-3) the collapse/flood-rise now lands on
that chapter's own last wave, which reads as a reasonable climax beat but
wasn't specifically tuned for; Ch4 (6 waves) keeps the exact original
pacing.

**Four new curated loot pools** (Phase 22 pattern, one region-flavored
subset apiece, no new equipment/potion added): Causeway leans
mobility/control (`boots-of-striding-and-springing`, `wand-of-web`,
`dagger-of-venom`); Cinderfall Rift leans aggressive/melee
(`greaves-of-the-berserker`, `amulet-of-fury`, `gauntlets-of-ogre-power`);
Drowning Vale leans poison/support (`amulet-of-withering`,
`periapt-of-proof-against-poison`, `staff-of-healing`); Frostbound Hollow
leans frost/ranged (`frost-brand`, `ring-of-frostbite`,
`bracers-of-archery`).

**`FreePlayScene` unlock gating extended**: the 4 maps and their 8
associated bosses (Juggernaut/Warlord Korrath/The Devourer/Gravemaw/
Blightmother/The Husk/Bloodrage Warlord/Sundered King) were always-
unlocked before this session (no campaign existed to gate them on,
explicitly flagged as temporary in that file's own comments) — they now
gate on their own new campaign id, the same treatment Cinderlord/Tidelord
already had. The two still-unassigned legendary capstone threats (Ashen
Sovereign, The Hollow Empress — reserved for the still-unbuilt "Nameless
Throne," `CAMPAIGN_STORY_DESIGN.md` §5) stay always-unlocked.

**`data/companions.ts`'s `homeRegionId` closed out**: D-177 left this field
set only for Tamsin (`emberford-reach`)/Fenna (`saltmere-shallows`), with
an explicit comment that the other four mirror companions' regions
"are maps only today, not yet wrapped in a chaptered `CampaignDefinition`."
Now that they are, set `homeRegionId` for Dorian (`shattered-causeway`),
Hollis (`cinderfall-rift`), Sorrel (`drowning-vale`), Isolde
(`frostbound-hollow`) — purely metadata today (nothing reads the field
yet, confirmed by search), but it closes a documented TODO rather than
leaving it stale.

**Known, deliberate scope, same as D-179**: no cross-chapter continuity;
no chapter intro/outro text (writing pass still deferred); end screen
still routes to Main Menu after a mid-region chapter clear. Saltmere's
Ch1 still uses the `tide-wretch` fallback, unaffected by this session —
the design doc's "returning miniboss" mechanic needs real per-region
spared/destroyed tracking through `WorldFlagSystem` (D-118 scaffolding,
still unconnected to any actual in-battle choice), which is a separate,
larger undertaking this session did not attempt. The capstone ("The
Nameless Throne") still has no map or chapters at all.

`tests/campaigns.test.ts` updated: the two tests that hard-coded "exactly
2 campaigns" (`CAMPAIGNS.length`/a `const [a, b] = CAMPAIGNS` destructure)
generalized to work over any number of campaigns; every other pre-existing
test already iterated `for (const campaign of CAMPAIGNS)` generically and
needed no changes to also cover the four new regions. New assertion added
verifying each new region's Ch1 miniboss/Ch4 boss against
`CAMPAIGN_STORY_DESIGN.md` §3's table. `tests/companions.test.ts`'s
`homeRegionId` assertion extended from 2 to all 6 mirror companions, now
verified against `getCampaignDefinition` instead of a hard-coded id list.
Tests: 1376 → **1377**. Typecheck clean, production build succeeds (127
modules, unchanged — no new scene code, so no new imports beyond the four
map modules `FreePlayScene`/`campaigns.ts` already imported). No browser
available in this environment — see KI-130.

### D-181 — Pre-region bonus-choice pools (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §8)

Kevin's pick off the item-13 remaining-slice list this session (offered
alongside the returning-miniboss mechanic, companion recruitment UI, and
the capstone — he chose this one as the self-contained, no-dependency
slice). Before investigating, spawned 3 parallel Explore agents (hero
equipment/inventory model, structure/trap placement, `BattleScene`'s
pre-battle sequence + the project's RNG) since implementing all four §8
bonus categories (gold/XP/equipment/structure) meant touching mechanisms
this session hadn't read yet — same "investigate before building"
discipline as D-179/D-180.

**Two real design gaps §8 itself left open, resolved this session:**

1. **"XP" has no literal mechanism to grant.** Leveling in this game is a
   fixed per-wave cadence (D-174), not an XP-pool currency — there's
   nothing a flat number can buy into, and a real `Hero.levelUpClass()`
   call would cascade into the same ASI/subclass/spell-pick choice queues
   a genuine level-up triggers, which is a much bigger, riskier retrofit
   for a "bonus card" to trigger mid-setup. Resolved by modeling "XP" as a
   flat permanent max-HP grant instead (`Hero.grantBonusHealth`, using the
   `bonusMaxHealth` field that's existed since Phase 13.6/13.11 with
   nothing granting into it until now) — matches the design doc's own
   framing ("guaranteed, permanent character power; can't be
   misallocated") without needing the level-up system at all.
2. **"Before starting (or replaying) any region" doesn't map cleanly onto
   this engine's chapter model.** A region is 4 independent, fully
   self-contained chapters (D-179's own explicit "no cross-chapter
   continuity" architecture) — there's no existing "have I already chosen
   this region's bonus this playthrough" state to check, and inventing one
   would be new persisted state for a first-pass feature. Resolved by
   showing the bonus choice at the start of EVERY chapter (all 4, every
   time, including a replay) rather than once per region — a deliberate,
   documented deviation from the doc's literal wording that fits the
   existing architecture instead of fighting it.

**Equipment bonus tuning, a related third call:** since the choice can now
surface at ANY chapter (including a level 1-5 Chapter 1), every equipment
option across all 6 regions is capped to common/uncommon, non-attunement
mundane gear (cost 8-16) rather than scaling by region tier — an item
strong enough to feel special at a region's own Chapter 4 (level 16-20)
would trivialize its Chapter 1. Gold/XP amounts DO escalate by region
(CAMPAIGN_STORY_DESIGN.md §3's own numbered region order, 1 Emberford
Reach through 6 Frostbound Hollow), since a flat number scales safely
either way. Every number is a first-pass guess, same KI-015 caveat every
other balance value in this project carries.

**New files**: `src/game/data/regionBonuses.ts` (`RegionBonusOption`,
`REGION_BONUS_POOLS` — 6 options per region: 1 gold, 1 xp, 2 equipment, 2
structure/trap, every pool covering all 4 categories so a random
3-of-6 draw is never accidentally lopsided) and
`src/game/systems/RegionBonusSystem.ts` (`drawRegionBonusChoices` — a
small partial Fisher-Yates shuffle built from `RandomService.rollIndex`,
the same primitive `LootSystem.rollLootDrop` already uses, since
`RandomService` has no ready-made "pick N without replacement").

**`BattleScene` wiring**: a new `showRegionBonusChoiceIfAny` step inserted
between the existing chapter-intro dialogue and the fast-forward ASI/
subclass/spell-pick prompts (`create()`'s pre-battle sequence). Reuses
`renderAsiPrompt`/`asiOverlay` (BattleScene's existing "mandatory modal
choice" renderer, already shared by ASI/subclass/spell-pick/feat prompts)
directly rather than `uiTheme.ts`'s `openChoiceList` — that helper always
appends a Cancel button, wrong for a choice that must resolve before the
battle can continue. New `choosingRegionBonus` flag added to
`inputLocked()`'s gate list, same pattern every other modal already uses.
Applying each category reuses an existing mechanism exactly:
`EconomySystem.award` (gold), the new `Hero.grantBonusHealth` (xp),
`grantLootDrop`'s own equip-into-first-empty-matching-slot-or-sell-for-
gold logic (equipment, mirrored rather than shared since it isn't a
`LootDropResult`), and `BuildSystem.canPlace`/`place` on the first tile
that validates (structure) — no new placement/equip logic invented, only
new callers of what already existed.

**Tests**: `tests/regionBonusSystem.test.ts` (new) — pool-data integrity
(every real campaign has a pool, every option id globally unique, every
pool covers all 4 categories, every referenced equipment/structure id is
real, gold/XP amounts escalate by region) and `drawRegionBonusChoices`
(exact count, no duplicates, respects an explicit count, deterministic
under `RandomService.fixed()`). One new case added to
`tests/equipment.test.ts` for `Hero.grantBonusHealth`. Tests: 1377 →
**1391**. Typecheck clean, production build succeeds (129 modules, +2 for
the two new files). No browser available in this environment — this is a
brand-new player-facing screen shown before every chaptered-campaign
battle, genuinely needs Kevin's own look; see **KI-131**.

### D-182 — Returning-miniboss mechanic: spare-or-destroy choice + Saltmere Ch1 resolution (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §4)

Kevin's pick off the item-13 remaining-slice list this session (offered
alongside companion recruitment UI and the capstone — the third and fourth
options from D-181's own list; he picked this one). Investigated with two
rounds of Explore agents before designing, since implementing §4 meant
touching mechanisms (enemy-defeat handling, world-state persistence,
chapter-load wiring) this session hadn't read yet — same discipline
D-179/180/181 used.

**What §4 asks for**: Saltmere Shallows (region 5) has no unique Chapter-1
miniboss of its own — its Ch1 encounter is whichever of the 5 "home"
minibosses (Basalt Colossus/Emberford, Juggernaut/Causeway, Gravemaw/
Cinderfall, The Husk/Drowning Vale, Bloodrage Warlord/Frostbound) the player
SPARED rather than destroyed, in an earlier region's own Ch1 fight, now
"washed up corrupted/allied with the tide." Falls back to the nameless
`tide-wretch` (already shipped as a placeholder) if nothing was spared.

**Real findings from investigation, not assumed:** no "spare vs. destroy"
mechanic existed anywhere — enemies only ever died via HP→0, with no "how
did this die" field or hook point at all. `WorldFlagSystem.ts` (D-118
scaffolding) already existed, fully built and unit-tested, but wired to
nothing — its own header comment names "which miniboss a player spared" as
its designed purpose, unused until this session. `config.ts`'s
`WORLD_FLAG_STORAGE_KEY` was declared but never read/written by any scene.

**A design-review pass caught two real bugs in the first draft before any
code was written** (via a Plan agent tasked with pressure-testing the
approach, given the feature's genuine complexity):
1. The sparable miniboss is always the FINALE spawn of its chapter — the
   same wave whose clearing triggers the victory check
   (`afterWaveCleared`'s `isLastWave()` → `transitionTo("victory")`, which
   runs synchronously). A modal popped from inside `resolveDeaths()` (the
   death-consequence funnel) would be raced by that transition before a
   player could ever click it. Fixed by having `resolveDeaths()` only STASH
   the pending choice (`pendingSparableKill`), and showing the actual modal
   from `afterWaveCleared()` instead — the one choke point downstream of
   every death-causing call site, checked BEFORE the existing level-up/
   victory logic runs.
2. `ChapterDefinition.waves` for a real chapter is the module-level data
   constant itself (e.g. `SALTMERE_CH1_WAVES`), not a per-battle copy — a
   shallow clone that mutated a nested spawn-group field in place would have
   permanently corrupted that shared constant for the rest of the session.
   Fixed with a narrow "spine" clone (`withReturningMinibossSwap`): only the
   array/objects on the path to the one changed `enemyId` field are copied;
   everything else stays shared by reference, and the whole thing is a
   reference-equality no-op when nothing was spared (the common case).

**Priority order, one tier deliberately deferred:** §4 also wants a
Sorrel-Thane-Lost companion-fate outcome to take this slot ahead of a
spared miniboss. That's NOT built — `CAMPAIGN_STORY_DESIGN.md` §6's
Redeemed/Marked/Lost branch chain has no data model anywhere yet
(`CompanionRosterSystem` is fully unwired scaffolding, `CompanionDefinition`
has no `fate` field, only a flavor `hook` string). That belongs to the
separate "companion recruitment UI" item-13 slice Kevin hasn't picked yet.
Tie-break among multiple spared minibosses (no doc guidance given): earliest
region wins — a documented first-pass call, reasoning that an earlier act
of mercy has had more time to "fester" into something corrupted.

**New files**: `src/game/systems/ReturningMinibossSystem.ts` — pure, no
Phaser dependency (`SPARABLE_MINIBOSS_CHAPTERS`, `sparedFlagId`,
`resolveSaltmereCh1Enemy`, `withReturningMinibossSwap`,
`RETURNING_MINIBOSS_FLAVOR_TEXT` — one flavor line per miniboss, logged the
first time it actually spawns in Saltmere Ch1; reuses each miniboss's
existing enemy id/stat block verbatim rather than inventing 5 new
"corrupted variant" enemies, a documented scope cut).

**`BattleScene` wiring**: world flags loaded once in `create()` alongside
the existing `campaignProgress` load. Chapter-load site gets one new branch
(Saltmere Ch1 only) resolving and swapping in the wave list before
`WaveSystem` is constructed. `resolveDeaths()` gets one cheap id-comparison
line (no change to its existing reward funnel — kill gold/loot/bestiary
credit are identical either way; sparing is a persisted narrative flag, not
a reward penalty). `afterWaveCleared()` shows the "Finish or Spare?" choice
first, reusing `renderAsiPrompt`/`asiOverlay` (the same mandatory-modal
renderer D-181 already reused), before its existing level-up/rest/victory
chain runs. New `choosingSparableKill` flag added to `inputLocked()`.

**Tests**: `tests/returningMinibossSystem.test.ts` (new) — priority/
tie-break order, fallback to `tide-wretch`, flag-key format, and
`withReturningMinibossSwap`'s find-and-replace correctness including an
explicit "never mutates the input" assertion (guarding the exact bug the
design-review pass caught). No scene-level test coverage added for the
`BattleScene` glue — confirmed no scene-level test files exist anywhere in
this project's `tests/`, so this follows existing practice rather than
starting a new one. Tests: 1391 → **1402**. Typecheck clean, production
build succeeds (131 modules, +2 for the new system file). No browser
available in this environment — this is a brand-new mid-battle mechanic
spanning 6 chapters' worth of encounters; genuinely needs Kevin's own
playtest; see **KI-132**.

### D-183 — Companion roster & recruitment UI, Phase 1 (KI-098 item 13, materially extends CAMPAIGN_STORY_DESIGN.md §6)

Kevin picked "companion recruitment UI" off the item-13 remaining-slice
list (D-181/D-182 had both offered it, unpicked until now). Asked how he
envisioned it working, he described a shape genuinely bigger than and
different from what §6's own text specifies — planned via `EnterPlanMode`
(3 Explore passes reading the real existing scaffolding, then a Plan-agent
implementation-plan pass) given the scope, and scoped down to a buildable
first slice via two follow-up `AskUserQuestion` rounds before writing any
code.

**Kevin's real design, materially extending §6**: the 12-companion
catalogue splits into two pools. **Pool B** (the original six §6 "mirror"
companions, one per region) no longer has a fixed starting trio — every one
of them now unlocks onto the bench individually, the first time their own
home region's Chapter 1 is completed. **Pool A** (the six class-coverage
recruits D-177 added, no home region) seeds a brand-new campaign
playthrough with 3 randomly-drawn active members; the other 3 stay locked,
meant to unlock via one unique side-quest mission each — a real new
mission-content type, **not built this session**. Also explicitly out of
scope this session and needing their own future design pass: a forced
"starting mission" gating the other 5 regions until the starting 4-party is
played once, a rule that a companion's own unlock mission must include
them, and Sorrel Thane's Redeemed/Marked/Lost fate arc (Kevin confirmed
directly: roster UI only this session, fate stays deferred).

**What this session actually built**:
- `data/companions.ts`: removed the now-backwards `startsInParty` field
  (it marked the OLD fixed-starting-trio's three members — actively wrong
  under the new pool split, not just unused); added `POOL_A_COMPANION_IDS`/
  `POOL_B_COMPANION_IDS`, derived once from `homeRegionId` presence.
- New `systems/CompanionSeedSystem.ts` (pure, tested): `seedStartingCompanions`
  draws 3 of Pool A via a small partial Fisher-Yates over
  `RandomService.rollIndex` (the same shape `RegionBonusSystem.
  drawRegionBonusChoices` already established), no-opping on any
  already-touched roster so it's safe to call from more than one scene.
- `BattleScene.markCampaignCompletedIfAny()`: new
  `maybeUnlockHomeRegionCompanion`, called only on a genuinely new Chapter-1
  completion (piggybacking on that function's own existing no-op dedupe —
  no new "first time" tracking needed), benches (never force-activates) the
  completed region's Pool B companion via the already-built but previously
  fully unwired `CompanionRosterSystem` (D-118 scaffolding, its first real
  use). Runs synchronously before the victory-transition chain even starts,
  so there's no D-182-style modal race to guard against here.
- New `scenes/CompanionRosterScene.ts`: reached from a new "Companions"
  button on `CampaignSelectScene` (plain `scene.start`/back, not
  `CharacterSheetScene`'s heavier launch-over-a-paused-battle pattern —
  there's no live `Hero` here to reflect back). Shows all 12 by status
  (Active/Benched/Locked, with a Pool B lock showing its home region and a
  Pool A lock showing "???"); clicking an Active card benches it, clicking
  a Benched card opens a picker of who to bench in its place. Every
  mutation saves immediately.
- `CharacterCreationScene.ts`, campaign mode only (Free Play untouched):
  slot 1 stays the player-built hero; slots 2-4 auto-fill from the roster's
  3 active companions via a new per-slot `identityLocked` flag (class/race
  pickers no-op when set; equipment/spells/hotkeys/starting level stay
  fully editable, unchanged from any other slot). Party size locks to 4 in
  campaign mode — with companions filling fixed slots, a smaller campaign
  party has no clean meaning; the party-size picker itself is disabled
  rather than removed.
- Seeding runs from both `CampaignSelectScene.create()` (the earliest real
  "entering Campaign mode" choke point) and `CharacterCreationScene.create()`
  (a defensive duplicate covering Load Game or any other path that skips
  Campaign Select) — both idempotent, so calling from two places is safe.

**Accepted edge case, not fixed**: the Pool B bench-only assumption relies
on active always being full (3) by the time any chapter can complete —
true given seeding always runs before Character Creation's slot-building,
but a hand-edited or corrupted save with `activeIds.length < 3` would let
`recruitCompanion` land the companion directly into an active slot instead
of the bench. Documented, not guarded against.

**Tests**: new `tests/companionSeedSystem.test.ts` (idempotency, always-3,
always-Pool-A). `tests/companions.test.ts`'s old `startsInParty`-length-3
assertion replaced with a pool-size/membership assertion. Tests: 1402 →
**1409**. Typecheck clean, all 1409 tests pass, production build succeeds
(135 modules, +4 for the new system and scene files), `npm run dev` serves
HTTP 200. No browser available in this environment — this is a new screen
plus a real Character Creation flow change, genuinely needs Kevin's own
look; see **KI-133**.

### D-184 — The Proving Ground: a new one-time prologue mission gates the six regions (KI-098 item 13, closes D-183's own deferred "forced starting mission" item)

Kevin picked "the forced starting mission gate" off the item-13 remaining
list next. Asked which region should serve as that gate, he said the
project needs a brand-new mission instead: a single fixed, one-time battle,
unrelated to any of the 6 regions' own themes, that every fresh campaign
save must clear once before Emberford Reach/Saltmere Shallows/Shattered
Causeway/Cinderfall Rift/The Drowning Vale/Frostbound Hollow unlock from
`CampaignSelectScene`. Planned via `EnterPlanMode` (3 parallel Explore
passes — map-authoring patterns, the existing gating/lock precedent in
`FreePlayScene`, and a narrative-precedent check confirming this is
genuinely new scope, not filling an existing `CAMPAIGN_STORY_DESIGN.md`
gap — followed by a Plan-agent pass validating the concrete file-by-file
approach and catching two test-file gaps before any code was written).

**What was built**: a flat (non-chaptered) `CampaignDefinition` — `data/
campaigns.ts`'s new `PROLOGUE_CAMPAIGN_ID` ("prologue") — is exactly as
first-class as Emberford/Saltmere were before D-179 chaptered them, so
`BattleScene`'s existing `markCampaignCompletedIfAny()` marks it completed
on victory with zero new battle-scene code. Its own new small map (`data/
prologueMap.ts`, "The Proving Ground", 12x7, floor/blocked tiles only — no
cliff/water/fire/acid, deliberately theme-neutral, not `TEST_MAP`, which
stays reserved as Free-Play-only per `CAMPAIGN_STORY_DESIGN.md` §2) hosts 3
short low-difficulty waves (`grunt`/`runner`, same tier as every region's
own Chapter-1 Wave-1) finishing on `brute` — an existing minion with no
`loreText` — as a deliberately unglamorous placeholder "boss," so no new
enemy needed authoring or balancing for a screen whose whole point is
minimal footprint.

`CampaignSelectScene.buildCampaignCards` now locks all 6 region cards
(dimmed fill/stroke/alpha, no `pointerdown`, a "Complete The Proving Ground
to unlock" caption in place of the boss/wave line — which has the added
benefit of not spoiling a locked region's boss name) until
`isCampaignCompleted` reports the prologue cleared — the exact same visual
language `FreePlayScene`'s existing "Complete X to unlock" locked options
already established (KI-130), reused rather than reinvented. The prologue
itself renders as the first card, unlocked from a fresh save.
`cardHeight`/`gap` shrank slightly (120/20 → 104/16) so 7 cards fit the
fixed 1080px viewport with real margin instead of the 7th card's bottom
landing on the edge.

**Confirmed safe, no changes needed**: D-181's pre-chapter "Choose a Bonus"
screen (`REGION_BONUS_POOLS[campaignId]`) already no-ops cleanly on a
missing pool at runtime — the prologue has none, on purpose. Free Play's
`MAP_OPTIONS`/`BOSS_OPTIONS` are hardcoded literals, not derived from
`CAMPAIGNS`, so the prologue map/enemy don't leak into Free Play. Companion
seeding (D-183) already runs unconditionally in `CampaignSelectScene
.create()` before any campaign is picked, so the prologue playthrough gets
the same player-hero + 3-random-Pool-A-companion party as any region would.
A pre-existing save with no `"prologue"` key in its `CampaignProgress` blob
reads as not-completed via the existing `?? false` fallback — no migration
needed.

**Tests**: `tests/campaigns.test.ts` — several assertions were genuinely
region-only (exactly 6 waves, genuinely chaptered) and now filter a new
`REGIONS` const rather than looping raw `CAMPAIGNS`; a new "Prologue
(D-184)" describe block covers the prologue's own shape. `tests/
regionBonusSystem.test.ts`'s "every real campaign has its own bonus pool"
loop now explicitly skips the prologue id (the Plan-agent validation pass
caught this gap before it became a real test failure). Tests: 1409 →
**1412**. Typecheck clean, all 1412 tests pass, production build succeeds
(136 modules, +1 for the new map file), `npm run dev` serves HTTP 200. No
browser available in this environment — needs Kevin's own playtest pass;
see **KI-134**.

### D-185 — Sorrel Thane's fate arc: Redeemed / Marked / Lost (KI-098 item 13, closes the gap D-182/D-183 both flagged and deferred)

Kevin's pick off item 13's remaining list: `CAMPAIGN_STORY_DESIGN.md` §6's
Drowning Vale companion branch chain. Planned via `EnterPlanMode` (3
parallel Explore passes — the existing choice-prompt UI, the D-182
returning-miniboss/D-183 recruit-on-Ch1 integration points, and per-chapter
choice tracking/battle-start sequencing) followed by one `AskUserQuestion`
round scoping Redeemed/Marked to flavor-only for this pass before any code
was written.

Research found the codebase already anticipated almost all of this:
`WorldFlagSystem`'s own doc comment names "Sorrel Thane's 3-outcome branch
chain" as the reason its flag values are untyped. `CompanionRosterSystem`
already had a fully-built, tested, unwired `loseCompanion` (permanent
removal to `lostIds`) — exactly the "Lost" mechanism.
`CompanionRosterScene` already rendered a 4th "LOST" status. `Returning
MinibossSystem`'s own header comment named this exact gap and where it
plugs in. Nothing needed inventing from scratch.

**What was built**:
- New `systems/SorrelFateSystem.ts` (pure, tested): a choice ("support" or
  "press") is shown at the start of Drowning Vale Chapters 1-3, recorded as
  one `WorldFlagSystem` flag per chapter. `resolveSorrelFate` reads them
  back via majority vote — more support wins Redeemed, more press costs
  her (Lost), a tie or NO recorded choices at all (e.g. a save that
  cleared Drowning Vale before this shipped) defaults to Marked, a
  deliberate safe default rather than defaulting an old save to the worst
  outcome. Also carries the first-pass choice-prompt text and the 3
  fate-flavor lines — content Kevin should read/adjust, same as any other
  new narrative text this project ships.
- `BattleScene.ts`: new `showSorrelChoiceIfAny` (chained into the existing
  pre-battle prompt sequence, right after the chapter intro and before the
  D-181 region-bonus pick — reuses `renderAsiPrompt` exactly like every
  other choice screen), gated on `campaignId === "drowning-vale" &&
  chapterIndex <= 2`, deliberately NOT on whether Sorrel is currently an
  active party hero (she isn't recruited onto the roster until Chapter 1
  clears via the existing, unchanged D-183 mechanism — gating on party
  membership would let benching her mid-region silently cancel her own
  fate choices). New `resolveSorrelFateIfAny`, called once at Drowning Vale
  Chapter 4's own battle-start (after `buildHud()`, since its flavor line
  needs `combatLogText` to already exist) — no player input, just a
  majority-vote read, a persisted fate flag, and (if Lost) a `loseCompanion`
  call, which is idempotent by design so calling it retroactively needs no
  special-casing.
- `systems/ReturningMinibossSystem.ts`: `resolveSaltmereCh1Enemy` now
  checks `isSorrelLost(worldFlags)` FIRST, before its existing spared-
  miniboss loop — needed no signature change, since fate already lives in
  the same `WorldFlagState` the function already took. A new `corrupted-
  sorrel` enemy (`data/enemies.ts`) stands in for her Lost encounter, stat
  block cloned verbatim from `tide-wretch` (zero new balance work) but
  with a real name and corruption-themed `loreText` — distinct from the
  wall-only tide-wretch fallback specifically because she was a character.
- **Explicitly out of scope this pass, confirmed with Kevin directly**:
  Redeemed/Marked stay flavor-only (a fate flag, a combat-log line, a
  status tag) — no new "persisted companion stat override" system. Lost
  still gets its full real mechanical integration since that's
  structurally required either way.

**Tests**: new `tests/sorrelFateSystem.test.ts` (majority-vote resolution,
the Marked default on no data, flag round-trip, chapter-index bounds).
`tests/returningMinibossSystem.test.ts` extended (Sorrel-Lost outranks a
spared miniboss regardless of region order; falls through normally when
not Lost). `tests/enemyRoster.test.ts`'s hardcoded miniboss count updated
6 → 7 for the new enemy. Tests: 1412 → **1427**. Typecheck clean, all 1427
tests pass, production build succeeds (137 modules, +1 for the new
system), `npm run dev` serves HTTP 200. No browser available in this
environment — needs Kevin's own playtest pass; see **KI-135**.

### D-186 — Pool A companion side-quest missions (KI-098 item 13, closes D-183's own deferred "side-quest missions" item)

Kevin's pick off item 13's remaining list: the 3 locked Pool A companions'
own unlock missions (`CAMPAIGN_STORY_DESIGN.md` §6, D-183's own "not built
this session" deferral). Researched the existing `CampaignDefinition`/
`CampaignSelectScene`/`CompanionRosterScene`/`BattleScene` wiring directly
(the same shape D-184's Proving Ground already established for a fixed,
flat, one-time mission) before writing any code — this turned out to be a
close variant of that exact precedent, not a new content type to invent
from scratch.

**Shape**: one fixed, flat (non-chaptered), 3-wave `CampaignDefinition`
per Pool A companion (Brand Ashcairn, Wren Calloway, Perrin Holt, Mira
Quill, Cass Ferrow, Ellery Vance) — all 6 exist as data regardless of which
3 a given save actually locked (`CompanionSeedSystem` draws 3 of the 6 at
random per fresh playthrough), so any save can hit any subset. Clearing a
mission recruits that companion onto the bench (never force-active, same
`recruitCompanion` reasoning as the Pool B home-region unlock) via a new
`BattleScene.maybeUnlockSideMissionCompanion`, called alongside the
existing `maybeUnlockHomeRegionCompanion` from `markCampaignCompletedIfAny`.

**Kept deliberately small, reusing existing content rather than authoring new**:
- **No new maps.** Each mission reuses one of the six existing region maps
  (loosely flavor-matched to the companion — e.g. Perrin the field medic's
  mission lands in The Drowning Vale, Mira the monk's in Frostbound
  Hollow) — these are personal side content, not a 7th-through-12th region,
  so there's no map identity of their own to build.
- **No new enemies.** Each mission's finale reuses an existing REGULAR-tier
  enemy loosely themed to the companion (Brand/barbarian → `warcaptain`,
  Wren/bard → `gilded-carrier`, Perrin/cleric → `blightcaller`, Mira/monk →
  `frost-warden`, Cass/rogue → `ironhide`, Ellery/sorcerer → `razorwing`) —
  deliberately never a miniboss/boss/legendary, so a side mission's finale
  can never collide with `ReturningMinibossSystem`'s spare-or-destroy
  mechanic. Same "brute stands in, nothing new authored" logic D-184 used
  for the Prologue's own finale.
- **No new array in `CAMPAIGNS`.** A new `SIDE_MISSIONS` array in `data/
  campaigns.ts` holds all 6, kept OUT of `CAMPAIGNS` on purpose —
  `CampaignSelectScene.buildCampaignCards` renders every entry in
  `CAMPAIGNS` as a region card, and these aren't regions. `getCampaignDefinition`
  now checks both arrays, so `BattleScene`/`CharacterCreationScene` need
  zero changes to treat a side mission's `campaignId` like any other flat
  campaign.
- **No new scene.** `CompanionRosterScene`'s existing locked Pool A card
  (previously just a "???" dead end) is now clickable — it launches
  `CharacterCreationScene` with `{ campaignId: companion.sideMissionId }`,
  the exact same handoff `CampaignSelectScene.selectCampaign` already uses,
  so the player builds/brings their current 3 active companions on the
  mission exactly like any other battle. The companion's own name/class
  stay hidden ("???") until the mission is actually won, preserving
  the existing "Pool A lock is a mystery" presentation D-183 established.

**Not gated behind anything** (unlike the Prologue) — every side mission
is reachable from Companion Roster at any point in a playthrough, since
each is a self-contained personal detour, not a story dependency.

**Explicitly out of scope, matching D-183's own original deferral list,
still open**: a rule that a companion's own unlock mission must include
them in the party, and any real dialogue/arc writing beyond the mission's
own name/description (first-pass, same as every other new narrative text
this project ships).

**Tests**: extended `tests/companions.test.ts` (every Pool A companion has
a unique `sideMissionId` resolving to a real campaign; Pool B has none).
New "Side missions" describe block in `tests/campaigns.test.ts` (exactly 6,
disjoint from `CAMPAIGNS`' own ids, flat/3-wave/finale-only-boss shape,
finale enemy is never miniboss/boss/legendary, real map/enemy references,
gold never regresses, original distinct name/description per mission).
Tests: 1427 → **1434**. Typecheck clean, all 1434 tests pass, production
build succeeds (137 modules — no new files, data-only + two scene edits),
`npm run dev` serves HTTP 200. No browser available in this environment —
needs Kevin's own playtest pass; see **KI-136**.

### D-187 — "A companion's own unlock mission must include them" (KI-098 item 13, closes D-183's own last remaining deferred item)

Kevin's pick off item 13's remaining list: the "required party member" rule
D-183 flagged and left undesigned. Asked to clarify the actual mechanic
(the literal reading is a paradox — a Pool B companion can't already be
"in the party" for the very battle that recruits them), Kevin's real ask
turned out to be different from either guess offered: **the companion
being unlocked fights alongside the player IN the unlock mission itself**,
not just afterward — effectively a 3-hero squad for that one battle (PC +
the newcomer + 2 more), not the normal 4. Enforcement: no lock/disable —
a dedicated party-selection screen where the PC's own slot and the new
companion's slot are non-negotiable, and the other two slots are freely
chosen (prefilled with a sensible default) from anyone already recruited.

**What was built**:
- New `systems/UnlockMissionSystem.ts` (pure, tested): `resolveUnlockMission
  Companion(campaignId, chapterIndex, roster)` is the single source of
  truth for "is this battle an unlock mission, and who does it unlock" —
  a Pool A `sideMissionId` match (chapter-index-agnostic, every side
  mission is flat) or a Pool B `homeRegionId` match at chapter index 0
  only, in both cases only while that companion isn't yet recruited or
  lost. `eligibleFlexCompanions`/`defaultFlexPicks` compute the pool (and
  a sensible default pair, preferring the CURRENT active roster in slot
  order) for the two free party slots.
- New `scenes/UnlockMissionPartyScene.ts`: shown instead of jumping
  straight to `CharacterCreationScene` whenever `resolveUnlockMission
  Companion` resolves a target. Shows 4 cards — "Your Hero" (flavor-only,
  still built on the next screen), the locked-in target companion, and two
  swappable slots (click opens the same `openChoiceList` picker
  `CompanionRosterScene` already established) defaulting to the current
  active roster. Confirming hands off to `CharacterCreationScene` with a
  new `requiredCompanionIds` data field.
- `CharacterCreationScene.ts`: new optional `requiredCompanionIds` field —
  when set, fills slots 2-4 from EXACTLY those 3 companion ids (in order)
  instead of the normal "3 active roster" auto-fill, so the not-yet-
  recruited target companion actually appears in the party being built.
  Every other entry path (Free Play, Co-op, a loaded save, a normal
  chapter, Load Game) is completely unaffected — `requiredCompanionIds`
  stays `undefined` for all of them.
- `CampaignSelectScene.selectCampaign`: now resolves the target via
  `resolveUnlockMissionCompanion` before deciding where to route — a
  region's own Chapter 1, before that region's companion is recruited,
  goes to `UnlockMissionPartyScene`; everything else (a later chapter, a
  Chapter 1 replay after recruiting, a permanently-Lost Sorrel Thane) goes
  straight to `CharacterCreationScene` exactly as before.
- `CompanionRosterScene.ts`: a locked Pool A card's click now routes
  through `UnlockMissionPartyScene` instead of straight to Character
  Creation (the scene resolves its own target defensively, so this is
  really just a routing change).
- `BattleScene.ts` needed ZERO changes — the recruit-on-victory hooks
  (`maybeUnlockHomeRegionCompanion`/`maybeUnlockSideMissionCompanion`,
  D-183/D-186) only ever check whether the CAMPAIGN completed, independent
  of how its party was assembled.

**Tests**: new `tests/unlockMissionSystem.test.ts` (resolution for both
pools, chapter-index gating, already-recruited/lost exclusion,
eligible/default flex-pick logic, the empty-roster edge case). Tests:
1434 → **1444**. Typecheck clean, all 1444 tests pass, production build
succeeds (139 modules, +2 for the new system and scene), `npm run dev`
serves HTTP 200. No browser available in this environment — needs Kevin's
own playtest pass; see **KI-137**.

### D-188 — The Nameless Throne: the campaign capstone (KI-098 item 13's last remaining piece, CAMPAIGN_STORY_DESIGN.md §5)

Kevin's own direct ask: "build the capstone now... epic, a true
masterpiece." The one item every prior item-13 handoff (D-182 through
D-187) had flagged as the sole remaining unbuilt piece of the whole
6-region campaign epic. Researched via 3 parallel Explore agents (campaign/
chapter/companion data model; map-authoring + enemy-reskin patterns;
branch-choice/victory-flow mechanics) plus a Plan-agent implementation
pass, all cross-checked against the real current code before any code was
written — the same discipline D-182/D-184 established for a build this
size. Two real scope forks confirmed directly with Kevin before designing
further, both resolved to the lighter-scope option:

- **Ending signal**: reuse the EXISTING Finish-or-Spare miniboss flags (5
  regions) plus Sorrel Thane's resolved fate, rather than writing 18-24 new
  chapter-boundary choice prompts across all 6 regions.
- **Capstone shape**: one climactic finale battle — flat, no `chapters`,
  same shape as the Proving Ground prologue — not a second full 4-chapter
  1-20 arc.

**Design calls locked this session** (not specified by the original design
doc, all documented rather than silently decided): sparing a miniboss and
Sorrel's Redeemed outcome both lean **Ashen Sovereign** ("held onto
compassion/identity"); finishing a miniboss (or letting it breach
unresolved — there's no `finished:<id>` flag anywhere, "finished" is
simply the absence of `spared:<id>`) and Sorrel's Lost outcome both lean
**Hollow Empress** ("traded mercy for expedience"); a genuine tie resolves
to Ashen Sovereign, matching §5's own framing of it as the "true" ending
against Hollow's "earned alternate." The capstone's pre-battle card always
displays "Boss: Ashen Sovereign" regardless of which the player will
actually face — an intentional non-spoiler (matches how Saltmere's card
always says "Boss: Tidelord"), not a bug. No HOMM3 bonus-choice screen for
the capstone this pass — §8 left this explicitly undecided; the existing
`showRegionBonusChoiceIfAny` already no-ops safely for a campaign id with
no curated pool, so this needed zero code to enforce.

**What was built**:
- New `data/namelessThroneMap.ts`: one fixed 17×11 `ParsedMap` — a
  processional hall (an outer gallery strip walled off by a pillar line
  with two crossing-gaps, opening onto a single wide nave carrying the
  real spawn-to-exit lane), 4 hero-starts, a shop, a treasure, and 4
  symmetric hazard tiles baked as `fire` (the Ashen Sovereign baseline).
- New `systems/NamelessThroneSystem.ts` (pure, tested), mirroring
  `ReturningMinibossSystem.ts`'s exact shape: `resolveThroneVariant`
  (tallies the 5 spare-flags + Sorrel's fate per the valence mapping
  above), `withThroneVariant` (swaps the map's 4 hazard tiles to `water`
  for the Hollow branch — same reference for Ashen, since the base map is
  already Ashen-dressed), `withThroneEnemyReskins` (the same "spine clone,
  same reference when unchanged" swap `withReturningMinibossSwap`
  established, generalized from 1 id pair to 4).
- Six new enemy reskins in `data/enemies.ts` — verbatim stat clones (only
  `id`/`name`/`assetKey`/`loreText`/color differ), the same precedent
  `corrupted-sorrel` (from `tide-wretch`) established: Ember Thane/Cinder
  Adept/Ashbound Honor Guard (fire-touched, cloned from Warden/Hexer/
  Gravemaw) for the Ashen garrison; Drowned Thane/Hollow Caller/Drowned
  Honor Captain (drowned/withered, cloned from Warden/Blightcaller/The
  Husk) for the Hollow garrison.
- `data/campaigns.ts`: new flat `CampaignDefinition` (`nameless-throne`),
  6 waves scaled above every region's own Ch4 finale (turnLimit 10→18,
  completionGold 22→95), a curated loot pool combining the fire- and
  frost-themed pools, appended to the END of `CAMPAIGNS` (array order
  drives `CampaignSelectScene`'s card order). New exported
  `REGION_CAMPAIGN_IDS` (the 6 region ids) — single source of truth shared
  by the gating check below and `tests/campaigns.test.ts`'s own filter.
- `systems/CampaignProgressSystem.ts`: new `areCampaignsCompleted(progress,
  campaignIds)` — the first "all of these ids" aggregate helper in the
  codebase (every existing query checked one campaign id at a time).
- `scenes/CampaignSelectScene.ts`: the capstone card stays locked (dimmed,
  "Complete all 6 regions to unlock") until `areCampaignsCompleted` against
  `REGION_CAMPAIGN_IDS` — the exact inverse of The Proving Ground's own
  single-id gate (D-184), reusing its visual pattern.
- `scenes/BattleScene.ts`: the variant resolves once at chapter/map-load
  (same spot the Saltmere swap already runs, stored in a new
  `resolvedThroneVariant` field, same idiom as `saltmereReturningEnemyId`)
  — verified safe: nothing writes `this.worldFlags` during a flat,
  chapter-less capstone battle, so resolving it again at victory time would
  also be safe, storing it once just matches the existing convention. A
  new intro beat (`showNamelessThroneIntroIfAny`, one link in the existing
  `showChapterIntroIfAny` callback chain) shows a variant-flavored line
  before wave 1. A new victory-time epilogue
  (`showNamelessThroneEndingIfAny`, chained between `showChapterOutroIfAny`
  and `showEndScreen`) delivers the branch-determined closing beat: Ending
  A reads `[...companionRoster.activeIds, ...benchedIds]` (excludes
  `lostIds` by construction) via `getCompanionDefinition(id).name` and has
  the PC name every surviving companion out loud, with a graceful fallback
  line if that list is ever empty (not reachable today — no other
  companion-loss mechanic exists besides Sorrel's — but not hardcoded away
  either); Ending B has the PC reach for a name that isn't there.

**Tests**: new `tests/namelessThroneSystem.test.ts` (variant tally/tie-
break coverage including the Sorrel-neutral and all-not-spared cases,
never-mutates-input and same-reference-when-unchanged checks for both swap
functions). `tests/campaigns.test.ts` required a real fix, not just an
addition — it hardcoded `CAMPAIGNS.length === 7` and a region filter that
only excluded the prologue, which would have broken the instant the
capstone was appended; now uses `REGION_CAMPAIGN_IDS`, plus a new capstone-
specific describe block. `tests/campaignProgress.test.ts` gained
`areCampaignsCompleted` coverage. `tests/enemyRoster.test.ts`'s hardcoded
miniboss/minion role counts and its saving-throw-attacker allowlist both
needed updating for the 6 new reskins (2 miniboss, 4 minion; Hollow Caller
carries a save-DC attack same as its Blightcaller donor).
`tests/regionBonusSystem.test.ts`'s "every region has a bonus pool" check
now also excludes the capstone, matching the documented scope cut. Tests:
1444 → **1466**. Typecheck clean, all 1466 tests pass, production build
succeeds (141 modules, +2 for the new map and system files), `npm run dev`
serves HTTP 200. No browser available in this environment — this is a
brand-new endgame screen/battle/branching epilogue that genuinely needs
Kevin's own playtest; see **KI-138**.

### D-189 — Companion dialogue writing pass + real mechanical weight for branch choices (KI-098 item 13's last two open items, CAMPAIGN_STORY_DESIGN.md §9)

Kevin's own direct ask: "build a first pass at the dialogue and branching
story lines now." Asked to scope which of §9's two remaining open items
this covered (full companion dialogue writing vs. giving branch choices
real mechanical weight), Kevin picked **both, full scope** — the same
"pick the bigger option" pattern he's confirmed before. Researched via 3
parallel Explore agents (dialogue-box/chapter-intro-outro plumbing; every
existing branch-choice mechanism and its current mechanical weight; the
companion/campaign data model) plus a Plan agent, all cross-checked
against the real current code before writing anything — every line number
in the plan was verified directly, not trusted from an agent report alone.

**The writing pass** — real first-draft prose (not placeholder text,
per Kevin's own "not a writer, punch-up-able rough material" framing),
reusing infrastructure that already existed end-to-end but had zero
content: `ChapterDefinition.introText`/`outroText` (declared since D-177,
read by `BattleScene.showChapterIntroIfAny`/`showChapterOutroIfAny`, unset
on all 24 chapters until now) and `showDialogue`/`DialogueLine` (D-119).

- All 24 region chapters (6 regions × 4) now have real `introText`/
  `outroText` in `data/campaigns.ts`, reflecting each region's own arc and,
  especially at Ch1 (arrival) and Ch4 (the region's own mirror boss
  climax), that region's own Pool B companion.
- New `data/companionDialogue.ts`: `COMPANION_RECRUITMENT_DIALOGUE` (a real
  arrival beat per Pool B companion, replacing the flat `logCombat` line
  `maybeUnlockHomeRegionCompanion` used to end with) and
  `COMPANION_MIRROR_REACTION_DIALOGUE` (a "homecoming beat" — that
  companion's own personal reaction to their region's Ch4 mirror boss going
  down, CAMPAIGN_STORY_DESIGN.md §9's own explicit phrase). Two entries
  (Fenna Duskwater/Saltmere, Isolde Varnhall/Frostbound) use a
  `{ ashen, hollow }` variant-pair shape instead of one fixed sequence —
  picked at victory time by the new shared mercy-tally helper below, so
  dialogue tone genuinely reacts to the player's accumulated pattern of
  earlier choices, not just a single fixed line.
- `scenes/BattleScene.ts` gained two new chained dialogue methods
  (`showCompanionRecruitmentIfAny`, `showMirrorBossReactionIfAny`), same
  shape as `showNamelessThroneEndingIfAny`, wired into the existing victory
  chain: `showChapterOutroIfAny → showMirrorBossReactionIfAny →
  showCompanionRecruitmentIfAny → showNamelessThroneEndingIfAny →
  showEndScreen`. Both reuse `this.chapterDialogue`, already covered by
  `inputLocked()` — no new gating needed. `maybeUnlockHomeRegionCompanion`
  now also stashes the recruited companion into a new
  `pendingCompanionRecruitment` field for the recruitment beat to consume.

**The mechanical-weight pass** — confirmed by full read of
`SorrelFateSystem.ts`/`ReturningMinibossSystem.ts` that sparing any of the
5 home minibosses granted nothing in the moment (only a later Saltmere
reskin/capstone tally effect), and that Sorrel's Redeemed outcome only
nudged the capstone tally while Marked had ZERO mechanical reads anywhere
(grep-confirmed) — exactly the gap the D-185 addendum already flagged as
open. Deliberately bounded: reuses only proven mechanisms
(`EconomySystem.award`, the equip-or-sell-for-gold flow), and does NOT
touch `LevelUpPlanSystem`/ASI/subclass selection (confirmed to have zero
existing hook points for external state — wiring that in is a materially
bigger, separate, riskier task) or invent new branch-choice chains for the
other 5 companions.

- Sparing any of the 5 home minibosses now grants an immediate
  `SPARE_MERCY_GOLD_REWARD` (20 gold flat, symmetric across all 5 — every
  home Ch1 spans the same 1-5 level band) in `showSparableKillChoice`'s
  `spare` callback, framed as the spared creature "owing" the player.
- Sorrel's Redeemed outcome now grants a real reward
  (`SORREL_REDEEMED_REWARD_EQUIPMENT_ID = "staff-of-healing"`, already in
  `DROWNING_VALE_LOOT_POOL`) via a new shared
  `grantEquipmentOrSellForGold(itemId, sourceLabel)` — `grantRegion
  BonusEquipment` was refactored into a thin wrapper around it rather than
  duplicating the equip-or-sell logic. Marked now grants a real but smaller
  `SORREL_MARKED_GOLD_REWARD` (25 gold — "survived, not unscathed," strictly
  less than Redeemed's item value, strictly more than a Ch1 spare-mercy
  grant since it resolves at Ch4). This closes the D-185 addendum's own
  explicitly-flagged "Redeemed/Marked flavor-only" gap.
- `systems/NamelessThroneSystem.ts`'s existing ashen/hollow tally (used
  only by the capstone until now) was extracted into a new exported, pure
  `computeMercyTally`/`mercyTallyLeansHollow` — a byte-for-byte-behavior-
  preserving refactor (`resolveThroneVariant` now calls the shared helper;
  its tie-break-to-Ashen rule is unchanged) — so the dialogue-tone
  reactivity above reads the SAME signal the capstone does, not a
  duplicated or diverging one.

**Tests**: new `tests/companionDialogue.test.ts` (every Pool B id present
in both dialogue maps and no Pool A id in either, `speakerName` matches
the real companion name, exactly Fenna/Isolde use the tone-reactive
shape). `tests/namelessThroneSystem.test.ts` gained `mercyTallyLeansHollow`
coverage plus a cross-check against `resolveThroneVariant` proving the
extraction didn't change behavior. `tests/returningMinibossSystem.test.ts`/
`tests/sorrelFateSystem.test.ts` gained reward-constant sanity checks
(positive, bounded, Marked strictly less than Redeemed's item value).
`tests/campaigns.test.ts` gained a "every region chapter has real intro/
outroText" assertion. Tests: 1466 → **1482**. Typecheck clean, all 1482
tests pass, production build succeeds (142 modules, +1 for the new
`companionDialogue.ts` file), `npm run dev` serves HTTP 200. No browser
available in this environment — this is brand-new dialogue content and
reward wiring spanning all 6 regions; genuinely needs Kevin's own playtest
pass; see **KI-139**.

This closes **both** of CAMPAIGN_STORY_DESIGN.md §9's remaining "still
open" items — the design doc's own §2-§9 arc is now fully closed, no
open items remain.

### D-190 — Party & Character Creation overhaul: roadmap plan, and "Plan 0"'s bug-fix pass (`PARTY_CREATION_OVERHAUL_PLAN.md`)

Kevin's first real playtest pass of Character Creation and campaign party
creation surfaced a large batch of notes. Asked how to structure the work,
he picked independent mini-plans with bug fixes first. Researched via a
dedicated Explore agent reading the real current code before any plan was
written, plus 3 `AskUserQuestion` rounds resolving genuine scope forks
directly with Kevin (party-inventory semantics — an XCOM2-style stage/
resolve-at-mission-start model; ability-score UX — keep Point Buy's
existing +/- system, give Standard Array a new per-stat dropdown with
swap-on-conflict; blueprint scope — a global library across all saves).

**`PARTY_CREATION_OVERHAUL_PLAN.md`** (new) is the resulting roadmap — 8
independent mini-plans, Kevin's own raw notes preserved verbatim at the
bottom. Two corrections Kevin made once he saw the first draft, folded
into the doc before any further work: the spell-prep economy's per-level
depth (already real, D-134/135/136) belongs inside the level-up blueprint
system (Plan 6) for caster classes, not left as a separate, harder-to-find
in-battle-only flow — **this reverses D-136's own "permanently out of
scope for planner integration" call**, with Kevin's explicit approval
given directly when asked; and the Character Creation visual restyle onto
the D-123 ornate/parchment theme (skipped since D-133 flagged it as "a
separate future task") should NOT be deferred all the way to a future
real-artwork pass, since it's a reusable, already-proven component library
unrelated to actual character art — it's sequenced as its own Plan 8,
positioned right after Plan 0, before Plans 1-3/6 build new UI on top of
the current plain style.

**This session also shipped Plan 0** (the bug-fix pass), the same session
the plan was written, since the fixes were cheap and already scoped in
detail during planning:
- `uiTheme.ts`'s `renderChoiceOverlay` (the shared picker overlay every
  Class/Race/Gear/Subclass button opens) used to size every choice's box
  to a fixed constant height — a long `desc` (e.g. a class's
  `previewSummary`) could wrap to far more lines than that constant
  assumed and run into the next row. It now measures each choice's real
  wrapped height first (via throwaway probe `Text` objects, destroyed
  immediately after) and sizes each ROW to its own tallest item. Desc font
  bumped 10px → 12px for readability at the same time (safe now that row
  height is no longer a fixed constant).
- `CharacterCreationScene.ts`'s Class/Race row labels never got the same
  `fitLabelToColumnWidth` overflow protection the Subclass row already
  had — both now call it. `fitLabelToColumnWidth` itself gained an
  optional `baseFontSizePx` parameter (default 13) so the Race row can
  start from a larger 15px instead of every row being forced to the same
  base size — the Race row's own text was reported too small to read even
  where it wasn't overflowing.
- `subclassSummary()`'s three text variants were shortened (e.g. the full
  `pick via "Plan Levels" below, or in battle at level N (M options)`
  sentence collapses to `Lv N in battle (M opts)`) — long enough, in the
  worst case (a long subclass name plus the "(click to change)" hint), to
  still overrun the row even at `fitLabelToColumnWidth`'s 9px font floor,
  since that helper only shrinks a single line, it doesn't wrap or
  truncate. Shortening was the lower-risk fix versus adding multi-line
  wrapping to a scene with a self-documented "already-tight, hardcoded
  vertical layout" (KI-083).
- Point Buy's "Points Left: N/27" readout no longer rides on the STR row's
  own label text (the exact cause of STR getting pushed off-screen) — it's
  now a dedicated, always-present (blank in Standard Array mode) row above
  the ability-score block. `abilityRowsTop` shifted 270 → 292 to make
  room; every row below it (`gearY`/`subclassY`/`levelY`/`planY`/
  `spellsY`) is already computed relative to `abilityRowsTop`, so all of
  them cascaded automatically — confirmed against `buildBottomControls`'s
  fixed y=810/860 rows that ~105px of vertical slack still remains below
  the lowest per-column row, comfortably clear.
- **Not fixed this session, deliberately**: the reported hero-name-field
  "drift" bug. Static reading found no live position bug (`Scale.FIT`
  makes `repositionLayout()`'s viewport-shift math a no-op today, per
  D-159) but a plausible DATA-reset cause instead (`create()` reseeds
  every slot from `CHARACTER_NAME_POOL` on any navigation path that isn't
  Load Game/a companion prefill) — genuinely different from what Kevin
  described. Needs a fresh repro before a fix is attempted; it's possible
  the overlay-overflow bugs above were themselves what looked like "names
  moving."

Tests: unchanged at **1482** (all UI-layer changes, no new pure-logic
surface — matches this project's standing convention that
`CharacterCreationScene`/`uiTheme.ts` aren't unit-tested). Typecheck
clean, all 1482 tests pass, production build succeeds (142 modules,
unchanged — no new source file), `npm run dev` serves HTTP 200. No browser
available in this environment — every fix here needs Kevin's own look;
see **KI-140**.

### D-191 — Party Creation Overhaul Plan 8: the D-123 ornate/parchment theme applied to Character Creation

Kevin's own steer from the D-190 session: do this right after Plan 0,
before Plans 1-3/6 build brand-new UI (a Standard Array dropdown, a party
inventory panel, a blueprint picker) in the same scene, so that new UI gets
built once, already in the right style. Planned via `EnterPlanMode` (a
full read of the 2134-line scene, `uiTheme.ts`'s exported surface, and the
two real precedent conversions, `CompendiumScene.ts`/`MainMenuScene.ts`,
then a Plan-agent design pass) before any code was written, given the
scene's size and its self-documented "already-tight, hardcoded vertical
layout" (KI-083).

- **Every hand-rolled `add.rectangle()+add.text()` control in
  `CharacterCreationScene.ts` is now a `createOrnateButton`** (Human/AI
  toggle, Class/Race/Gear/Subclass/Starting Level/Plan Levels/Spells
  pickers, both ability-score control sets, Party Size/Difficulty/Ability
  Score Method/Team Level, Start Battle/Save Party) — the flat
  `setBackgroundColor` background is now `drawScreenBackdrop`, and each
  hero column's plain dark rectangle is now `drawParchmentPanel`. The
  title/subtitle match `CompendiumScene`'s own recipe (`FONT_DISPLAY`/
  `FONT_BODY`). Deliberately no `spawnAmbientMotes` — this is a dense,
  click-heavy data-entry screen, the same category `CompendiumScene`
  reasoned motes out of.
- **Zero data/logic changes** — every `onPick`/`onClick` handler body,
  every computed string, every validation check in `refreshAll` is
  unchanged; only how it's drawn and how the refresh functions talk to the
  new widgets changed. `SlotWidgets`' label fields became
  `OrnateButtonHandle`s (`.setLabel()` replaces `.setText()`, and its
  internal auto-shrink — same 9px floor — made 4 of the scene's own
  `fitLabelToColumnWidth` call sites redundant, since deleted); `Standard
  Array`'s cycle-row and Point Buy's value readout can no longer share one
  Text object riding on the same row position now that a button owns its
  label internally, so Point Buy's ability-score value became its own
  small `pointBuyValueLabels` Text (the one remaining
  `fitLabelToColumnWidth` caller, now with a new optional `maxWidthPx`
  parameter sized to its narrower slot between the minus/plus buttons).
  `setSlotActive`/`refreshAbilityScoreControls`'s `Rectangle`-specific
  `.setInteractive()`/`.disableInteractive()` calls became
  `OrnateButtonHandle.setDisabled()`.
- **Start Battle's valid/invalid green/gray fill swap has no direct
  `OrnateButtonHandle` equivalent** (only `setSelected`/`setDisabled`
  exist) — deliberately drives it with `setDisabled` alone, on a
  `variant: "primary"` button, rather than repurposing `setSelected`
  (which means "the currently active choice" everywhere else in this
  codebase) for a new, non-precedented "ready to submit" meaning.
- **Column rows grew taller** to give ornate buttons real border/padding
  room a bare rectangle didn't need: single-row buttons 26→32px, the
  ability-score cycle row 24→28px (row spacing 30→34px), Point Buy's
  minus/plus 26×22→30×28px; every row below the ability-score block
  cascades off those new numbers automatically (`gearY`/`subclassY`/
  `levelY`/`planY`/`spellsY`, same "compute relative to `abilityRowsTop`"
  convention D-190/Plan 0 already established), and the bottom controls/
  Start-Save row shifted down +30px net to match. Flagged honestly: the
  bottom-edge clearance against `drawScreenBackdrop`'s frame is real but
  tight (~19px) — the single number most likely to need a follow-up tweak
  once Kevin can see it — see **KI-141**.
- Explicitly out of scope: `renderChoiceOverlay`/`openChoiceList`/
  `clearChoiceOverlay` in `uiTheme.ts` (shared code, also used by
  not-yet-converted scenes — Map Builder, Settings, Free Play) — only this
  scene's own trigger buttons that open those overlays were converted, not
  the overlays' internal rendering. The Level Planner/Spell Picker wizard
  state machines are untouched.
- Tests: unchanged at **1482** (presentation-only, matches this project's
  standing convention that `scenes/*.ts` aren't unit-tested). Typecheck
  clean, all 1482 tests pass, production build succeeds (142 modules,
  unchanged — no new source file), `npm run dev` serves HTTP 200. No
  browser available in this environment — this is the largest single-scene
  visual reskin in the project so far and genuinely needs Kevin's own
  playtest pass before being called fully done; see **KI-141**.
- **This closes Plan 8** of `PARTY_CREATION_OVERHAUL_PLAN.md` — Plans 1-3/
  6-7 remain, independent of each other except the documented Plan 2/3
  sequencing note.

### D-192 — Party Creation Overhaul Plan 1: ability-score assignment UX (per-value dropdown + per-hero method)

Kevin: "Let's build plan 1 now." Two sub-items, both from his exact steer in
`PARTY_CREATION_OVERHAUL_PLAN.md`: keep Point Buy's +/- system entirely
unchanged; only Standard Array needed a new control, and the Standard-Array-
vs-Point-Buy method choice needed to move from one scene-wide button to a
small per-hero control ("don't need a huge button for it"). Went through
`EnterPlanMode` before any code was written — a background Explore agent
verified the real current code (constructor signatures, all call sites,
existing tests) first, then a Plan agent stress-tested the resulting design
(dropdown depth/placement, DOM-input focus edge case, per-hero pill layout
budget, validity-message precedence) before the plan was finalized.

- **`StandardArrayAllocator` (`CharacterBuildSystem.ts`) rewritten
  internally** — `order: AbilityScoreId[]` (an adjacent-swap permutation)
  became `assignments: Partial<Record<AbilityScoreId, number>>`, with a new
  `assign(ability, value | null)` method: picking a value already held by a
  DIFFERENT ability swaps the two abilities' values (Kevin's exact spec);
  `null` clears an ability to unset ("—"). New `valueFor()`/`isComplete()`
  read the raw state. `cycle()` is deleted. **Constructor signature is
  unchanged** (`order: AbilityScoreId[] = ABILITY_SCORE_IDS`) specifically
  so the 12 `StandardArrayAllocator(...)` call sites in `data/companions.ts`
  and `allocatorFromScores`'s reconstruction logic needed zero edits.
- **New compact anchored dropdown** (`openAbilityDropdown`, scene-local —
  no existing `uiTheme.ts` component fit; `renderChoiceOverlay`/
  `openChoiceList` are both full-screen centered modals). Opens directly
  below the clicked ability row, offering the 6 standard values + "—",
  using `createOrnateButton`'s smallest ("tool") variant and
  `drawParchmentPanel` for backing — both already existed but were unused
  elsewhere. Closes on: a full-canvas click-away catcher (same pattern
  `renderChoiceOverlay`'s own dim rectangle uses), a `focus` listener on
  every hero-name `<input>` (a DOM element sits outside Phaser's own pointer
  pipeline, so the catcher alone can't see a click landing there), and one
  explicit call at the top of `renderPlanPrompt` (makes "both the dropdown
  and the full-screen overlay open at once" impossible by construction).
- **Ability-score method (`abilityScoreMethod`) moved from one scene-wide
  field to `SlotState`, per hero.** The old single party-wide toggle button
  is gone; each hero column now has its own small pill (`abilityMethodHandle`,
  140×20px, "tool" variant) on its own dedicated row between "Points Left"
  and the ability-score block — NOT sharing "Points Left"'s row, since that
  exact "two labels sharing one row push each other off" bug is what Plan
  0.4 already fixed once in this scene. `abilityRowsTop` shifted 292→300 to
  make room, cascading automatically to every row below it (`gearY`/
  `subclassY`/etc.), same mechanism the 270→292 shift used.
  `slotStateFromBuild`/`buildsFromSlots` already round-tripped
  `CharacterBuild.abilityScoreMethod` per-build (it was already a per-build
  field, `CharacterBuildSystem.ts:224`) — only the scene's own rendering/
  gating logic needed to catch up to per-slot.
- **New validity gate**: a Standard Array slot can now sit mid-edit with an
  unset ability — Start Battle/Save Party are blocked until every active
  hero using Standard Array has all six assigned (`isComplete()`), named
  per-hero in the status line (`` `Hero ${n} still has unassigned ability
  scores (Standard Array).` ``), as a third precedence tier below the
  existing blank-name/duplicate-name messages. Point Buy never fails this
  check (floor 8 on every stat, always complete by construction).
- Explicitly out of scope: Point Buy's own controls (Kevin's steer);
  `identityLocked` not yet guarding companion ability-score handlers — a
  known, separate gap already tracked as Plan 3.3.
- Tests: **1485** (+3 — the `StandardArrayAllocator` test suite was
  rewritten against `assign()`'s real swap/unset semantics, not a
  find-replace of the old `cycle()` tests; `allocatorFromScores`'s own
  tests are untouched, confirming the constructor/reconstruction path
  really did stay opaque to the internal rewrite). Typecheck clean, all
  1485 tests pass, production build succeeds (142 modules, unchanged),
  `npm run dev` serves HTTP 200. No browser available in this
  environment — the dropdown's exact on-screen placement, the new pill
  row's spacing, and the "—" label rendering all need Kevin's own
  playtest pass; see **KI-142**.
- **This closes Plan 1** of `PARTY_CREATION_OVERHAUL_PLAN.md`.

### D-193 — Party Creation Overhaul Plan 2 (2.1 + 2.2): real multi-slot starting gear + real per-companion kits

Kevin: "Now do plan 2." Went through `EnterPlanMode` — an Explore agent
first mapped the real current code (`equipment.ts`'s slot types, `Hero`'s
gear/AC math, `CharacterBuild`'s single-item field, `companions.ts`'s
generic pool, `CompanionRosterSystem`'s lack of any equipment field,
`SaveSystem`'s real `localStorage` persistence path), then a Plan agent
swept for every other call site of the old field and stress-tested the
migration design, before the plan was finalized.

**Scope: 2.1 + 2.2 only. 2.3 (party inventory) is explicitly deferred**,
per the plan doc's own sequencing note — it has no meaningful persistence
target until Plan 3.1 (campaign cross-mission persistence, a large,
separate, still-NOT-STARTED item) exists; `CompanionRosterSystem` today
persists only `{activeIds, benchedIds, lostIds}`, nothing per-hero-gear to
plug a shared pool into. Building `PartyInventorySystem` now would be dead
code with no real UI hook — this project's standing "no scaffolding for a
system that doesn't exist yet" rule (see `feedback_no_dead_scaffolding` in
memory). 2.3 is picked up alongside Plan 3.1 in a future session.

- **`CharacterBuild.startingEquipmentId`/`HeroDefinition.startingEquipmentId`
  → `startingGearIds?: Partial<Record<GearSlotId, string>>`.** The old
  single-item field is kept on both interfaces, marked `@deprecated`, purely
  as a read-time fallback for a pre-Plan-2 `SaveSystem` save (`isCharacterBuild`
  doesn't validate the gear field at all, so old JSON passes through
  untouched) — **no `CURRENT_SAVE_VERSION` bump**, since that would wipe
  every existing save (`loadSaveFile`'s blanket version-mismatch check).
  `Hero`'s constructor merges both fields (new-shape first, legacy fallback
  folded in only for a slot `startingGearIds` didn't already claim), then
  loops assigning `equippedItems` — the exact same one-line-per-item logic
  as before, just over up to 3 entries instead of 1. `Hero.armorClass`
  needed **zero changes** — it already generically sums gear bonuses across
  every `GEAR_SLOT_ID`.
**Mid-session scope revision**: 2.1 originally shipped as a 3-slot picker
(Weapon/Armor/a class-appropriate Shield-or-Focus third slot, matching the
plan doc's own minimum-scope wording). Kevin then asked directly — "what
about the difference between helm and body and arms and legs? what about
rings or amulets? what about miscellaneous items that don't fit any of
those?" — and, given the choice, picked **full expansion: every one of the
10 real gear slots (`GEAR_SLOT_IDS`) becomes an independent free pick at
creation**, not just 3. Confirmed there's no genuine "misc" bucket — every
catalogue item already resolves to exactly one of the 9 `GearSlotType`s.
This revised the same still-unplayed 2.1 work in place (amending this
entry, not opening a new `D-NNN`) rather than leaving stale documentation
describing a 3-slot design the code no longer has.

- **`CharacterBuild.startingEquipmentId`/`HeroDefinition.startingEquipmentId`
  → `startingGearIds?: Partial<Record<GearSlotId, string>>`.** The old
  single-item field is kept on both interfaces, marked `@deprecated`, purely
  as a read-time fallback for a pre-Plan-2 `SaveSystem` save (`isCharacterBuild`
  doesn't validate the gear field at all, so old JSON passes through
  untouched) — **no `CURRENT_SAVE_VERSION` bump**, since that would wipe
  every existing save (`loadSaveFile`'s blanket version-mismatch check).
  `Hero`'s constructor merges both fields (new-shape first, legacy fallback
  folded in only for a slot `startingGearIds` didn't already claim), then
  loops assigning `equippedItems` — the exact same one-line-per-item logic
  as before, just over up to 10 entries instead of 1. `Hero.armorClass`
  needed **zero changes** — it already generically sums gear bonuses across
  every `GEAR_SLOT_ID`.
- **No class gating on any slot — including the amulet slot.** 4 new
  common-rarity spellcasting-focus items (`holy-symbol`, `arcane-focus`,
  `druidic-totem`, `component-pouch`, `equipment.ts`) reuse the existing
  `"amulet"` slot (already a generic misc-trinket slot — bracers/wands/
  gauntlets already live there, not just literal amulets) rather than a
  new `GearSlotType` — zero blast radius on `GEAR_SLOT_IDS`/attunement/any
  slot-enumerating UI. With the full 10-slot expansion, the earlier
  per-class "shield vs. focus" bucketing (`thirdGearSlotForClass`) became
  unnecessary and was deleted — every class now sees every slot's full
  pool (any hero CAN pick a shield AND an amulet, or a martial class can
  pick a focus item as their amulet; matches `EquipmentDefinition` having
  no class-restriction field anywhere in this game already). Every slot's
  picker always includes "None" — nothing is force-equipped (Kevin's
  standing "no silent choice defaults" rule). `startingGearIdsForSlotType(slot)`
  replaces the old flat `STARTING_GEAR_IDS`, reusing the pre-existing
  (previously unused) `equipmentForSlotType` helper plus the same
  common/uncommon rarity filter as before; row labels reuse the existing
  `GEAR_SLOT_LABELS` map rather than inventing new title strings.
- **`CharacterCreationScene`'s Gear row is now a real 10-row menu**
  (`openGearPicker`/`openGearItemPicker`, one row per `GEAR_SLOT_IDS`
  entry) built on `renderPlanPrompt` directly, NOT nested `openChoicePicker`
  calls — that wrapper tears down the whole overlay right after any
  option's `onPick()` returns, which would break a picker-inside-a-picker.
  Same multi-step-wizard pattern the Level Planner's own screens already
  use. The Gear button's own column position is unchanged — no `gearY`/
  `subclassY`/panel-height layout surgery needed. `SlotState`'s 3 named
  index fields collapsed to one generic `gearIndices: Partial<Record<GearSlotId,
  number>>` map — cleaner than 10 named fields, and no longer needs a
  class-change reset (no slot depends on class anymore). The Gear button's
  own label collapses to a `"N/10 equipped"` count once more than 3 slots
  are filled — 10 full item names would never fit a hero-column button
  even at the existing auto-shrink floor.
- **12 companions (`data/companions.ts`) got real, authored starting
  kits** — weapon + chest armor + class-appropriate third slot (their
  OTHER 7 slots start empty, same as any player-built hero, fillable
  later via the in-battle Shop), using real `weapons.ts`/`armor.ts` items
  instead of the old generic flavor-item pool. Monk (Mira Quill)
  deliberately gets NO chest armor: `Hero.armorClass` only applies its
  favorable unarmored formula when the chest slot is empty, so equipping
  any chest armor would strictly downgrade a Monk's AC. Barbarian/Rogue/
  Ranger skip the shield third slot (doesn't fit their real playstyle)
  even though the picker allows one.
- Migration is tested at the behaviorally meaningful boundary — a legacy
  `startingEquipmentId`-only build still passes through
  `heroDefinitionFromBuild` and still lands in the right `Hero.equippedItems`
  slot (both already-existing tests kept, relabeled as back-compat
  regression coverage). At the scene-UI layer, the full 10-slot expansion
  actually CLOSED the one documented gap the earlier 3-row design had: a
  legacy ring pick now has a real matching row (Ring 1) to land in, where
  before it had no equivalent among only 3 rows.
- Tests: **1491** (+6 net over the pre-session 1485 — `thirdGearSlotForClass`'s
  now-obsolete tests were removed, `startingGearIdsForSlotType` coverage
  extended to all 9 slot TYPES, and a new "fills all 10 real gear slots at
  once" test added in `equipment.test.ts`). Typecheck clean, all 1491
  tests pass, production build succeeds. No browser available in this
  environment — the new 10-row Gear-picker UI and every in-game AC/attack-
  damage number this change affects need Kevin's own browser pass; see
  **KI-143**.
- **This closes 2.1/2.2 of Plan 2** in `PARTY_CREATION_OVERHAUL_PLAN.md`;
  2.3 stays NOT STARTED, sequenced with Plan 3.1.

### D-194 — Campaign-mode gear economy: fixed difficulty-scaled companion kits + PC point-buy

Kevin, immediately after seeing D-193's all-10-slot free-pick design:
companions in campaign mode shouldn't be freely editable at all — their
kit should be fixed, scaled down on harder difficulty, while always
keeping what makes their class function (a weapon, and a caster's
spellcasting focus/holy symbol/etc.); the PC should still choose, but
through a real economy — proposed a point-buy system himself (items cost
points, difficulty sets the budget). Free Play/manual Create Party is
explicitly untouched — D-193's free-pick-everything stays exactly as
shipped there; this is scoped to campaign mode (`this.campaignId`) only.

Given its own new decision number even though it directly modifies code
from moments earlier in the same session: unlike the 3→10-slot revision
folded into D-193 (a scope-width tweak on the same mechanic), this is a
genuinely new economic system — worth its own entry in this file's
history. Went through `EnterPlanMode` again: two Explore passes (difficulty/
economy scaling conventions; class-implement requirements and the exact
gear-picker code to adapt) followed by a Plan-agent stress-test of the
design before any code was written — caught 2 real issues before
implementation (see below).

- **`DifficultyDefinition` (`data/difficulty.ts`) gains two more flat
  per-tier numbers**, matching the pre-existing `shortRestCharges`/
  `longRestCharges` "hand-picked integer, not a multiplier" convention
  (confirmed: no gold/gear difficulty-scaling precedent existed anywhere
  else in the codebase — `EconomySystem`'s `STARTING_GOLD` is a flat,
  non-scaled constant):
  - `startingGearPoints` — the PC's point-buy budget: **easy 12, normal 9,
    hard 6, nightmare 4**.
  - `companionDiscretionaryGearSlots` — how many of a companion's
    discretionary slots (chest, then shield, in that priority order)
    survive: **easy 2, normal 2, hard 1, nightmare 0**. Normal preserves
    D-193 Plan 2.2's full authored kit unchanged — no regression.
  - Both explicitly flagged first-pass/adjustable, same standing every
    other number on this file already has.
- **Item point cost derives from `rarity`, NOT `EquipmentDefinition.cost`**
  (`startingGearPointCost`, `data/characterCreation.ts`: common=1,
  uncommon=2 — the only values that matter, the starting pool is
  common/uncommon-only). Confirmed `cost` is actively coupled to the
  gold-shop/enchant system (`ENCHANT_COST_BONUS` mutates it at synthesis
  time) — unsafe to double-purpose as a second currency sharing one number
  line with gold prices.
- **Companions: fixed kit, recomputed live from their authored baseline.**
  `companionStartingGearForDifficulty(baselineGearIds, difficultyId)`
  (`data/characterCreation.ts`) always keeps `weapon` and `amulet` (a
  caster's implement — present in the baseline only for a caster
  companion, since D-193 Plan 2.2 only authored one for casters); keeps
  `chest` then `shield` up to `companionDiscretionaryGearSlots` of them.
  Pure, data-in/data-out. `SlotState` gains `baselineGearIds` (D-193 Plan
  2.2's authored "normal" kit, snapshotted via a **defensive spread copy**
  — not a bare reference into `companions.ts`'s shared singleton build,
  per the stress-test's own finding that a later `delete` on it, the same
  pattern `gearIndices` editing already uses, would otherwise corrupt the
  companion definition for every future session). `buildsFromSlots()`
  recomputes an `identityLocked` slot's kit fresh from `baselineGearIds` +
  the CURRENT `this.difficultyId` on every call — a companion's kit
  updates live if Difficulty changes after slots were first seeded, never
  baked in once. The Gear button gets the identical `if (s.identityLocked)
  return;` guard Class/Race already use — a companion's Gear button is
  now a silent no-op, its existing label logic still shows the (now
  difficulty-derived) kit read-only.
- **The PC: point-buy, spent across all 10 slots freely.** `openGearPicker`
  bakes `"Gear Points: spent/budget"` into the picker's own title (a plain
  string — confirmed `renderChoiceOverlay`'s title already wraps/measures
  dynamically, safe at this length, no new UI primitive needed) —
  deliberately called "Gear Points," not "Points," since Point Buy's own
  ability-score system already displays an unrelated "Points Left: X/Y"
  on the same screen (a real naming collision the stress-test flagged).
  `openGearItemPicker` appends each item's cost to its label and OMITS any
  item whose cost would net-overspend the budget (accounting for the
  points swapping OUT this slot's own current pick would free up) — a
  losing swap never appears as an option in the first place. Outside
  campaign mode, both methods are 100% unchanged from D-193 (no cost
  labels, nothing omitted).
- **New Start/Save validity gate, confirmed load-bearing (not
  defensive-only).** The stress-test disproved my own initial assumption
  that a budget-overage state was unreachable: the Difficulty button has
  no gating and can be clicked in any order relative to Gear — raising
  difficulty AFTER spending gear points shrinks the budget without
  touching existing picks, so `remaining` can go negative on the very
  next refresh. `refreshAll` now blocks Start/Save with a named message
  ("Gear Points over budget...") as a 4th precedence tier below blank/
  duplicate name and incomplete Standard Array, checked ONLY against
  slot 0 (the PC) — a companion's own `gearIndices` is reconstructed by
  `slotStateFromBuild` but never actually spent from, so it must never
  factor into this check.
- **Known, pre-existing, NOT a regression this decision introduces:**
  Load Game re-entry never forwards `campaignId` (`LoadGameScene.ts`,
  `SaveSlot` has no such field) — a campaign party saved and reloaded via
  Load Game currently re-enters Character Creation with full free-pick,
  no companion lock, no point-buy. Flagging for Kevin's awareness, not
  fixing here (out of this decision's scope).
- Tests: **1502** (+11 — `startingGearPointCost`/`companionStartingGearForDifficulty`
  coverage in `characterCreationData.test.ts`, including a purity check
  that the baseline map is never mutated; a new describe block in
  `tests/difficulty.test.ts` for the two new fields). Typecheck clean, all
  1502 tests pass, production build succeeds. No browser available in
  this environment — the point-buy UI's actual feel, the companion-lock
  behavior, and whether these first-pass budget numbers feel right in
  play all need Kevin's own playtest pass; see **KI-144**.

### D-195 — Party Creation Overhaul Plan 3: campaign party/character persistence + a new "Reset Campaign Progress" action

Plan 3 — the roadmap's own "biggest structural item": campaigns had no
cross-chapter continuity at all. Closed the ENTIRE plan (3.3, 3.1, 3.2, 3.5,
3.6, 3.7, and — picked up immediately after, same session, Kevin: "Let's
just build it now" — 3.4) in one session, in the doc's own suggested build
order. Went through `EnterPlanMode`: two Explore passes (roster/save
persistence architecture; `CharacterCreationScene`'s `identityLocked`
mechanics and campaign-only UI guards) followed by a Plan-agent design pass
before any code was written for 3.3-3.7/the Reset action; 3.4 (below) was
small enough to design and ship directly afterward, in the same session,
once its own dependency (3.1's persisted builds) already existed.

**A real architecture question surfaced mid-design, resolved with Kevin
directly (twice) via `AskUserQuestion` — the most important thing for a
future session to know before touching this area again:**
`CompanionRosterSystem`/`CampaignProgressSystem`/`WorldFlagSystem` are all
single global localStorage blobs, shared across every one of the 7
`CampaignDefinition` entries (Prologue, 6 regions, capstone). First read as
an isolation bug worth fixing per-`campaignId` — Kevin initially asked for
that (the bigger option, matching his usual "build it right" preference).
Reading `CAMPAIGN_STORY_DESIGN.md` and the actual mechanics then surfaced a
hard conflict: the 7 entries are regions of **one continuous playthrough**,
not independent saves — the capstone gate (D-188's `areCampaignsCompleted`)
reads all 6 regions' progress from one blob; Pool B companions are meant to
carry from the region they're recruited in into every other region
("recruit as you go," `CAMPAIGN_STORY_DESIGN.md` §6); and Sorrel Thane's
fate in Drowning Vale deliberately changes Saltmere's Chapter 1 encounter
(D-185) via a direct cross-region flag read. Per-region key-scoping would
have broken all three. **Resolved (Kevin's final call, informed by this
conflict): keep all three systems exactly as globally-shared as they work
today ("Track A") — the persisted builds below live in that same shared
blob, no new storage key, no migration utility — plus build a real "Reset
Campaign Progress" action so Kevin still gets a genuine clean-slate option
for starting a brand-new playthrough, without breaking the shared
cross-region mechanics.** Anyone re-reading Plan 3's "per-campaign
isolation" language later should NOT reintroduce per-`campaignId` key
scoping — this note is the record of why that was rejected.

- **3.3 — companion ability scores are now actually locked.** The Standard
  Array dropdown handler and both Point Buy stepper handlers
  (`CharacterCreationScene.ts`) were missing the `if (s.identityLocked)
  return;` guard Class/Race/Gear already had — a companion's stats were
  freely editable in campaign mode despite Kevin's explicit rule. Fixed;
  shipped first since 3.2 depends on it (a locked PC must not be able to
  edit ability scores through the same unguarded controls).
- **3.1 — persisted companion/PC builds.** `CompanionRosterState` gains two
  optional fields, `companionBuilds?: Record<string, CharacterBuild>` and
  `pcBuild?: CharacterBuild` (`CompanionRosterSystem.ts`), with new pure
  accessors/mutators (`getCompanionBuild`/`setCompanionBuild`/`getPcBuild`/
  `setPcBuild`) and defensive parsing (a malformed entry is dropped, not
  fatal). **No migration/version bump** — same optional-field convention
  `startingGearIds`/`startingEquipmentId` already established; an old blob
  simply parses with both fields `undefined`, which is exactly the correct
  "nobody has a persisted build yet" state (proven by a dedicated test).
  Also fixed a latent bug found while touching this file: `loseCompanion`
  built its return value as a 3-field object literal instead of `{...state,
  ...}` — harmless before this decision (there was nothing else to lose),
  but would have silently dropped `companionBuilds`/`pcBuild` the moment a
  companion died. **Write path**: `CharacterCreationScene`'s Start Battle
  handler now persists the PC's and every active companion's just-built
  `CharacterBuild` at the click (Kevin's own "resolution at mission start"
  framing from Plan 2.3, not gated on victory). **Read path**: the `create()`
  companion-prefill block now prefers a persisted build over
  `getCompanionDefinition(id).build`'s static catalogue entry when one
  exists. **Must-fix correctness note**: a companion's `baselineGearIds`
  (the input to D-194's difficulty-scaling economy) is now always sourced
  from the STATIC catalogue build, never from a persisted copy — a persisted
  build's `startingGearIds` may itself already be a difficulty-trimmed
  result from a previous visit, and reusing it as the new "baseline" would
  double-apply the trim on every later visit. `CompanionRosterScene` needed
  no changes — confirmed there's genuinely one shared roster across the
  whole playthrough (consistent with Track A), so a per-campaign "view
  roster" entry point would have no consistent meaning to attach.
- **3.2 — PC identity lock, once a persisted build exists.** Reusing
  `identityLocked` unmodified for slot 0 would have also frozen the PC's
  gear onto D-194's fixed companion economy — wrong, since gear/spells/
  level-plan/name must stay editable for a returning PC. `SlotState` gains
  a second field, `gearLocked: boolean`, decoupled from `identityLocked`
  (companion: both true together, unchanged net behavior; returning PC:
  identity locked, gear unlocked; fresh PC/Free Play: both false).
  `slotStateFromBuild` gains two new optional parameters (`gearLocked`,
  defaulting to match `identityLocked` so the existing companion call site
  needed no changes; `catalogueGearIds`, feeding the 3.1 correctness note
  above). The Gear button guard, `baselineGearIds` assignment, and
  `buildsFromSlots`'s gear branch all now check `gearLocked`, not
  `identityLocked`. Also fixed a label bug this change would otherwise have
  introduced: the `" (Companion)"` tag was keyed on `identityLocked` alone,
  which would have mislabeled a locked returning PC — now excludes slot 0
  explicitly.
- **3.4 — post-completion companion stat unlock.** Once `this.campaignId`
  has been fully cleared at least once (`isCampaignCompleted`, D-188's
  existing query — no new tracking needed), a companion's ability-score
  lock lifts; class/race stay fixed to their identity. `SlotState` gains a
  THIRD lock field, `abilityScoreLocked: boolean` — `identityLocked` alone
  could no longer answer "is this slot's ability score editable" once a
  companion could have identity locked but stats unlocked. Equal to
  `identityLocked` for a returning PC (3.4 doesn't touch the PC — Kevin's
  plan text says "companions" specifically) and for a companion whose
  campaign isn't yet completed; false only for a companion once
  `isCampaignCompleted` is true. The Standard Array dropdown and both Point
  Buy stepper handlers (3.3's own guards) now check `abilityScoreLocked`
  instead of `identityLocked`. `slotStateFromBuild` gains a 5th optional
  parameter, defaulting to match `identityLocked` (so the one existing call
  site needed no change). The `" (Companion)"` label tag now reads
  "(Companion — Stats Unlocked)" once earned, rather than leaving the only
  signal to be the ability-score buttons quietly starting to work.
  **Adaptation from the plan doc's literal text, worth flagging**: the plan
  said "on a FRESH playthrough of that same campaign" — under Track A
  (shared state across the whole game, no per-campaign isolation, decided
  earlier in this same decision) there is no separate "fresh playthrough"
  state distinct from "replaying this campaign," so the unlock is keyed
  purely on `isCampaignCompleted(campaignId)` and applies from that point
  forward on every subsequent visit, not gated to some special replay mode.
  Interacts cleanly with "Reset Campaign Progress" (above): a reset also
  clears `completedIds`, so a companion's stat-unlock reverts to locked
  right along with everything else — no special-casing needed, it falls
  out of reusing the same query both features already share.
- **New — "Reset Campaign Progress"** (`CampaignSelectScene.ts`, additive,
  not one of the plan doc's original Plan 3 sub-items — the direct
  corollary of the Track A resolution above). A small button next to the
  existing "Companions" button; two-click confirm (this project has no
  existing modal-confirm pattern — `LoadGameScene`'s Delete is a single
  immediate click, but wiping an entire playthrough is more consequential
  than one save slot) — first click arms it and reverts after 4 seconds if
  unconfirmed, second click within that window wipes `CompanionRosterSystem`
  (covers `companionBuilds`/`pcBuild` too, same blob), `CampaignProgressSystem`,
  and `WorldFlagSystem` (covers Sorrel Thane's fate flag too — `SorrelFateSystem`
  reads/writes through this same storage, no separate key of its own) back
  to their own default-state constants. Explicitly does NOT touch
  `SaveSystem`/`SAVE_STORAGE_KEY` — Free Play saves are unrelated to
  campaign state, same boundary D-194 already established.
- **3.5 — Difficulty picker moves to `CampaignSelectScene`.** New control
  row between the intro text and the campaign card list (card list's own
  `startY` shifted 172→202 to make room), mirroring
  `FreePlayScene.buildDifficultySection`'s exact pattern (local
  `selectedDifficultyId` field, plain button + `openChoiceList`). Both
  `scene.start()` calls in `selectCampaign()`, plus `UnlockMissionPartyScene`'s
  own forwarding `init()`/`scene.start()` calls, now carry `difficultyId`
  through to Character Creation. Character Creation's own Difficulty button
  is now hidden (not just unguarded-but-present) when `campaignId` is set.
- **3.6 — Party Size button now hidden, not just disabled**, in campaign
  mode (was disabled-and-grayed with a "(fixed for campaigns)" label suffix
  — the suffix is gone too, since there's nothing left to read it from).
- **3.7 — "Save New Party"/"Update Saved Party" now hidden** in campaign
  mode (Plan 3.1 makes campaign party state persist automatically, so the
  generic Free-Play-only save-slot flow is redundant there); `onSaveParty()`
  also gained a `campaignId` early-return as defense-in-depth, matching the
  Party Size button's own click-guard-plus-hide pattern.
- Tests: **1511** (+9 — new `CompanionRosterSystem` describe block covering
  `getCompanionBuild`/`setCompanionBuild`/`getPcBuild`/`setPcBuild`
  round-trips, independence between companion/PC builds, defensive-parsing
  of a malformed entry, and the "pre-Plan-3 blob loads both as undefined"
  case that proves no explicit migration was needed; plus a regression test
  for the `loseCompanion` field-drop fix; 3.4 added no new tests of its
  own — scene-level orchestration only, same "no dedicated test" precedent
  the rest of this scene's guard logic already follows). Typecheck clean,
  all 1511 tests pass, production build succeeds (142 modules, unchanged).
  No browser available in this environment — the relocated Difficulty/Reset
  control row's actual layout, the two-click confirm's feel, the full
  chapter-to-chapter persistence flow (edit → Start Battle → revisit →
  confirm PC locked but gear/spells/plan still editable, companions show
  prior edits), and 3.4's stat-unlock (can't be verified without actually
  completing a campaign first) all need Kevin's own playtest pass; see
  **KI-145**.

### D-196 — Party Creation Overhaul Plan 4: hero stat preview shows AC instead of ATK/Range

`CharacterCreationScene.refreshSlot`'s per-hero stats line read
`HP {n}  ATK {n}\nRange {n}  Move {n}`. Both of the removed stats were
already known-dead by the time this shipped: `ATK` was a flat class/
ability-mod number from `combatStatsForClassLevel` that never factored in
an equipped weapon, and `Range` was purely `melee → 1 : ranged → 3` off the
class's fixed `basicAttackStyle`, never the real weapon-aware
`Hero.attackRangeTiles` every other surface in the game actually uses.
Kevin's own framing (2026-08-26 playtest notes): "Attack means nothing now
that we've switched to actual DnD character sheet based stats... AC should
replace those 2 useless stats."

- New line: `HP {n}  AC {n}\nMove {n}` — three real stats, no dead fourth
  column forced to keep the 2x2 shape.
- AC is computed off a real scratch `Hero`, not a new formula —
  `LevelUpPlanSystem.simulateHeroForPlanning(build, slot.levelUpPlan,
  build.startingLevel ?? 1)` (already exported, already used by the
  planner UI's own preview steps) builds a throwaway `Hero` from the
  in-progress `CharacterBuild` draft and fast-forwards it through that
  hero's own level-up plan up to the chosen Starting Level, then
  `Hero.armorClass` is read straight off it. This is the same precedent
  `simulateHeroUpToChoice` already established elsewhere in this file, just
  reused instead of duplicated — the preview genuinely reflects equipped
  gear (once Plan 2's real gear picker feeds it), subclass AC bonuses, and
  ASI-granted feats like the Defense fighting style, not just a level-1
  guess. At Starting Level 1 with a plan whose trigger levels haven't been
  reached yet, this is a no-op fast-forward — behaviorally identical to
  reading `Hero.armorClass` off a level-1 `Hero`.
- Sequenced after Plan 2 per the roadmap's own note (real multi-slot
  starting gear already shipped as D-193/D-194), so this AC number reflects
  actual equipped weapon/armor, not a bare unarmored base.
- No data/system changes — pure UI wiring in `CharacterCreationScene.ts`
  (`refreshSlot`), reusing `simulateHeroForPlanning`
  (`LevelUpPlanSystem.ts`, already exported and already fully tested) and
  the already-tested `Hero.armorClass` getter. No new tests needed; all
  1511 existing tests still pass. Typecheck clean, production build
  succeeds (142 modules, unchanged). No browser available in this
  environment — Kevin's own pass should confirm the stats line reads
  correctly and the AC number matches what the in-battle HUD shows for the
  same hero once built.

### D-197 — Party Creation Overhaul Plan 2.3: an XCOM2-style shared party inventory pool

Kevin: "Let's do 2.3 now." His own spec (2026-08-26 playtest notes):
benched companions' gear should be reachable by the active party — "Unequip
all bench heroes" moves it into a shared pool, any active hero can equip
from it during party setup, and at mission start a claimed item becomes
permanently the claimer's while an unclaimed one silently returns to
whoever it came from. No item is ever lost or duplicated. Deferred since
the plan doc was written, pending Plan 3 (campaign persistence) — now
shipped (D-195) — since a companion's equipped gear needs to actually
persist between missions before "unequip and redistribute it" means
anything.

Went through `EnterPlanMode`: two Explore passes (roster/persistence
architecture and the D-194 fixed-companion-kit system; `CompanionRosterScene`'s
UI and the existing confirm-with-timeout pattern) followed by a Plan-agent
design pass. The Plan agent's own draft had a real correctness gap, caught
during review before any code was written (see "Key correctness fix"
below) — worth recording here since it's the kind of mistake a future
session could reintroduce if this area gets touched again without reading
this writeup first.

**Data model** (`CompanionRosterSystem.ts`): `CompanionRosterState` gains
`partyInventory?: PartyInventoryEntry[]`, each entry
`{ id, itemId, originCompanionId, originSlot }` — a synthetic `id` is
needed because two different companions can hold the same equipment id at
once, and `originSlot` is needed to know which slot to auto-return an item
to. Same optional-field, defensive-parsing, no-migration-needed convention
`companionBuilds`/`pcBuild` already established (D-195) —
`DEFAULT_COMPANION_ROSTER_STATE` needed no change, so "Reset Campaign
Progress" already wipes the pool for free.

**New pure system, `src/game/systems/PartyInventorySystem.ts`**:
- `unequipAllBenchedGear(state, benchedIds, fullKitFor, nextEntryId)` —
  moves every benched companion's currently-equipped kit into the pool.
  Idempotent (skips a (companion, slot) pair already pooled), so repeat
  clicks never duplicate entries.
- `visibleGearForOrigin(companionId, fullKit, partyInventory)` — a
  companion's kit with any slot currently sitting UNCLAIMED in the pool
  stripped out. **Key correctness fix**: this must be applied to EVERY
  gear-locked slot's own gear computation unconditionally, keyed on
  whichever companion currently occupies that slot — not only "while
  they're benched," and not skippable as a supposed no-op for an active
  slot. The real failure case the Plan agent's first draft missed and then
  talked itself out of: companion A is benched, their weapon gets pooled;
  Kevin reactivates A before Start Battle; without this filter, A's own
  slot would still show the weapon as equipped (unaware it left the pool)
  at the exact moment another active hero could independently claim that
  same weapon from the pool — two heroes carrying the identical item into
  battle. Always wrapping a gear-locked slot's base kit in this function
  closes it for free (a companion never pooled has no matching entries, so
  it's a harmless no-op for them).
- `resolvePartyInventory(state)` — the Start Battle commit point: the
  ENTIRE pool resolves here, not just entries touched this session. A
  claimed entry's item is already baked into the claiming hero's own build
  (`CharacterCreationScene`'s own override, below); an unclaimed entry's
  "return to origin" needs no write of its own, since a companion's kit is
  a derived view (`visibleGearForOrigin`) that re-includes a slot the
  instant nothing in the pool still claims it. Either way, the pool empties.
- `dropPoolEntriesForLostCompanion(state, companionId)` — wired into the
  one existing `loseCompanion` call site (`BattleScene.ts`, Sorrel Thane's
  fate arc, D-185): a permanently-lost companion's still-unclaimed pool
  entries are deleted outright rather than orphaned.
- 14 new tests in `tests/partyInventorySystem.test.ts`, 8 more added to
  `tests/companionRosterSystem.test.ts` for the new field's round-trip/
  defensive-parsing/Reset-wipe coverage.

**`CharacterCreationScene.ts`**: `SlotState` gains `poolGearIds?: Partial<Record<GearSlotId, string>>`
(pool entry id per gear slot) — ephemeral scene-local staging exactly like
the existing `gearIndices`, not persisted until Start Battle. The roster
load already happening for companion prefill is hoisted one level (now
runs whenever `campaignId` is set, not only when `!loadedParty`) so
`this.partyInventorySnapshot` is available with no second `localStorage`
read. The Gear button's row is split into two half-width buttons (Gear |
Pool) rather than adding a new row — this scene's layout is
self-documented as fragile (KI-083) and everything below `gearY` cascades
off it unchanged, so inserting a row would mean re-deriving every
constant below it. The new Pool button opens a two-level picker
(`openPoolPicker`/`openPoolItemPicker`) reusing the exact same shape as
`openGearPicker`/`openGearItemPicker`, sourced from the pool instead of
the static catalogue, with a "claimed elsewhere" guard preventing two
hero slots from claiming the same entry. Available to every active slot
including a `gearLocked` companion — that's the entire point — and hidden
entirely outside campaign mode or when the pool is empty. New
`resolveGearIdsForSlot` helper (used by `buildsFromSlots`) applies the
correctness fix above, then layers this session's own pool picks on top
as the final override for every slot. The Start Battle handler calls
`resolvePartyInventory` right after its existing `setPcBuild`/
`setCompanionBuild` persistence loop.

**`CompanionRosterScene.ts`**: a new "Unequip All Benched Heroes" button,
reusing `CampaignSelectScene.onResetButtonClicked`'s exact two-click,
4-second-revert confirm pattern (D-195) — commits and saves immediately on
confirm, unlike the ephemeral per-hero pool picks staged in Character
Creation, since this is a roster-wide action outside any one mission's
setup. A small "Party Inventory: N items" label sits beside it. Uses this
scene's own existing plain `buildButton` (Rectangle+Text), not
`createOrnateButton` — this scene has never adopted the D-123 ornate
theme (D-191/Plan 8 was scoped to `CharacterCreationScene` only), and one
ornate button on an otherwise fully-plain screen would read as a
half-finished migration rather than a deliberate one; extending the theme
here is a separate, explicitly out-of-scope follow-up. `CampaignSelectScene`
now forwards `difficultyId` to `CompanionRosterScene` (mirroring the same
plumbing already forwarded to Character Creation) so unequip-all computes
a companion's ACTUAL currently-equipped kit via
`companionStartingGearForDifficulty` — hardcoding "normal" instead would
have let a Nightmare-difficulty companion's already-trimmed chest/shield
get pooled and handed to someone else, even though that companion never
actually had it equipped this campaign.

**Explicit assumption, cheap to revisit**: drawing a pooled item costs
nothing in the PC's Gear Points budget (D-194) — pooled items are
transfers of already-owned gear, not new purchases.

- Tests: **1533** (+22 — 14 new in `partyInventorySystem.test.ts`, 8 more
  in `companionRosterSystem.test.ts`). Typecheck clean, all 1533 tests
  pass, production build succeeds (143 modules, +1 for the new system
  file). No browser available in this environment — this is a genuinely
  multi-step flow (bench someone, unequip all, reactivate them, draw their
  own item back from the pool, start a battle, confirm an unclaimed
  item's owner has it again next visit) that can't be spot-checked on one
  screen — see **KI-147**.

### D-198 — Party Creation Overhaul Plan 5: AI-hero level-up defaults + Human/AI toggle clarity

Kevin: "Plan 5 next." His own playtest complaint (2026-08-26 notes): "Should
have an option for the AI to pick level-up choices for you (this should be
the default for any characters that are AI controlled). The click-to-toggle
human or AI controlled button is not very clear at first of what it does."

**Confirmed the actual bug first**: `BattleScene.applyClassLevelUps` (the
in-battle level-up path) and `buildHeroes`'s pre-battle Starting-Level
fast-forward path both queue a real choice popup (`needsAsi`/
`needsSubclass`/`needsSpellPick`/`needsSpellSwap`, or the pending-fast-
forward equivalents) purely off `plan?.mode === "auto"` plus whether an
explicit plan entry resolved it — neither path has ever checked
`hero.controlledBy` at all. An AI-controlled hero with no blueprint (which
is every AI hero today, since Plan 6's blueprint library doesn't exist yet)
gets exactly the popup Kevin described, with the AI having no way to answer
it — the human player is forced to make the choice FOR a hero they didn't
ask to manage.

**5.2 — Human/AI toggle redesign, shipped first (small, no dependencies)**:
`CharacterCreationScene.refreshSlot` now calls the existing
`OrnateButtonHandle.setSelected(isAiControlled)` (already built for D-123/
Plan 8's `createOrnateButton`, previously unused on this one button) so the
AI state gets a visually distinct gilt-border/brighter-fill look instead of
a same-as-everything-else plain gray label — reusing an existing component
instead of a new icon/asset (this environment still has no image-generation
tool). Label text is now `Hero N — AI-Controlled` / `Hero N — Human-
Controlled` (dropped the old "(click to toggle)" hint — an ornate tab-
styled button already reads as clickable by its own shape/hover/press
feedback).

**5.1 — AI-controlled heroes never see a level-up popup, full stop.**
Asked Kevin directly on the plan doc's own open fork ("hard rule, or just a
smarter starting default the player can still override") — **hard rule**,
confirmed. `SlotState.levelUpPlan.mode` is now forced to `"auto"` wherever
`controlledBy` becomes/is `"ai"`: a fresh AI-default slot (`create()`), the
Human→AI toggle handler, a loaded build whose `controlledBy` is `"ai"`
(`slotStateFromBuild`, defensive coercion for a save predating this
decision), and the Plan Levels wizard's mode-select screen
(`showPlanModeSelect`) now only offers "Auto-follow a blueprint" (plus
Cancel) for an AI-controlled slot — Prompted/Fresh aren't shown at all,
not shown-then-silently-overridden.

Locking the mode alone isn't sufficient, though: `resolveAsiForLevel`/
`resolveSubclassForClass`/`resolveSpellPickForRequest` (D-16x's own design)
never invent a choice — an "auto" hero with no EXPLICIT plan entry for a
level still comes back unresolved, which is exactly what still fed the
needs-queues regardless of mode. **Real fix**: `BattleScene.
applyClassLevelUps` and `buildHeroes`'s fast-forward loop both now check
`hero.controlledBy === "ai"` directly (not just `plan?.mode`) as a second,
independent backstop — when a choice comes back unresolved AND the hero is
AI-controlled, it's handed to a new fallback resolver instead of ever
reaching a queue. Checking `controlledBy` directly (not only trusting
`plan.mode`) means this can't be bypassed by an older save or a coop
control-mode edge case, even though the UI-layer changes above should
already guarantee `mode` is `"auto"` for every AI hero going forward.

**New fallback resolvers, `LevelUpPlanSystem.ts`** (`autoResolveAsiForLevel`,
`autoResolveSubclassForClass`, `autoResolveSpellPickForRequest`) — a
deliberate, narrow, Kevin-confirmed EXCEPTION to D-16x's "never invent a
choice, all blueprints must be player-made" rule, not a reversal of it.
Asked directly: invent a simple default (this hero's class's primary
ability +2, falling back to its spellcasting ability then any non-maxed
ability if the primary is capped; its first modeled subclass; the first
eligible spell for a mastery/signature/arcanum pick) vs. silently skip and
leave the hero permanently without that ASI/subclass/spell until a real
blueprint exists (Plan 6) — Kevin picked **invent a simple default**, so an
AI companion is never permanently stunted just because nobody built it a
blueprint yet. D-16x's rule stands unchanged for every human/remote-
controlled hero — an unresolved choice for one of those still queues a real
popup exactly as before; this exception is scoped to `controlledBy ===
"ai"` only, both in the UI layer above and in these three functions' own
callers. The level-up-adjacent recurring spell SWAP trigger (D-136, not a
one-time gate) already had a silent-skip "auto" branch — extended the same
`isAiControlled` backstop there for symmetry (an AI hero on a plan that
somehow isn't `"auto"` still skips silently rather than queuing a swap
prompt nobody would answer).

- `src/game/systems/LevelUpPlanSystem.ts`: `autoResolveAsiForLevel`,
  `autoResolveSubclassForClass`, `autoResolveSpellPickForRequest`.
- `src/game/scenes/BattleScene.ts`: `applyClassLevelUps`'s four choice
  blocks and the spell-swap check gain the `isAiControlled` branch;
  `buildHeroes`'s fast-forward loop gains the same branch.
- `src/game/scenes/CharacterCreationScene.ts`: fresh-slot default
  (`levelUpPlan: emptyLevelUpPlan(slot === 0 ? "fresh" : "auto")`), the
  Human/AI toggle handler, `slotStateFromBuild`'s defensive coercion,
  `showPlanModeSelect`'s AI-only branch, `planSkipChoice`'s AI-aware
  description text, and `refreshSlot`'s toggle-button restyle.
- Tests: **1540** (+7, all new in `tests/levelUpPlanSystem.test.ts`
  covering the three fallback resolvers directly, including the
  ability-score-cap fallback chain and a classic-fixed-roster no-op case).
  Typecheck clean, all 1540 pass, production build succeeds (143 modules,
  unchanged — no new files). No browser available in this environment —
  needs Kevin's own playtest pass; see **KI-148**.

### D-199 — Party Creation Overhaul Plan 6: the level-up blueprint library

Kevin: "Plan 6 now." His own ask: save a "Plan Levels" session as a named,
reusable blueprint — usable by any future character of that class, in any
save or campaign, forever — plus his own explicit correction reversing
D-136's "permanently out of scope" call: fold level-up-triggered spell
swaps into blueprint planning too (the separate Long-Rest full-relist
mechanic stays real-time-only, untouched). Went through `EnterPlanMode`:
three Explore passes in parallel (storage/persistence architecture,
the wizard's existing state machine + DOM-input pattern, the spell-swap
mechanics + D-136's actual reasoning) before any code was written.

**Two design questions the plan doc left explicitly open, resolved from
research, not assumed:**

1. **Storage.** Contrary to the plan doc's own uncertainty ("check
   `SaveSystem.ts`'s actual backend before deciding"), Firebase IS live
   for real player data today (`CloudSaveSync.ts` for save slots,
   `MapSharingSync.ts` for public shared maps) — but `CompanionRosterSystem`/
   `CampaignProgressSystem`/`WorldFlagSystem`, the three existing "global
   across every save/campaign" systems, all stay **local-only**, no cloud
   sync file exists for any of them. A blueprint library matches THAT
   precedent, not Saves/Maps — it's a personal preset list, not a publicly
   shareable thing. **Decision: local-only**, `fantasy-td:blueprint-library`
   (`config.ts`), mirroring `CompanionRosterSystem.ts`'s exact
   `{getItem,setItem}`/defensive-parse/`DEFAULT_*_STATE` shape. Cloud sync
   is a cheap, separable follow-up if ever wanted, not scaffolded now.
2. **The Auto/Prompted/Fresh cadence setting.** The plan doc asked for a
   "first design pass" here, not a pre-decided answer. Decoupled entirely
   from "which blueprint": `LevelUpPlan.mode` is now vestigial the moment
   a plan is saved as a library blueprint (applying a blueprint ALWAYS
   overwrites `mode` with the target hero's own current cadence, never
   reads the blueprint's frozen one back) — the authoritative cadence
   moved to a new per-hero `cadenceHandle` pill next to "Plan Levels",
   click-cycling Auto/Prompted/Fresh, locked to Auto (disabled) for an
   AI-controlled hero (same hard rule as D-198). This removed D-133's old
   mode-select screen from the wizard entirely — the wizard now opens
   straight into the new blueprint entry choice below.

**6.1 — Data model/storage**: new `src/game/systems/BlueprintLibrarySystem.ts`
(pure, no Phaser) — `LevelUpBlueprint { id, name, classId, plan: LevelUpPlan }`,
`BlueprintLibraryState { blueprints: LevelUpBlueprint[] }`,
`loadBlueprintLibrary`/`saveBlueprintLibrary` (copy `CompanionRosterSystem`'s
shape exactly), `blueprintsForClass`, `upsertBlueprint` (add-or-overwrite by
id, one op), `deleteBlueprint`. Id generation stays at the call site
(`CharacterCreationScene`), matching `CompanionRosterScene.onUnequipAllClicked`'s
existing `` `blueprint-${Date.now()}-${counter++}` `` idiom.

**6.4 — Cadence decoupled from the wizard**: `CharacterCreationScene`'s old
single "Plan Levels" button split into two half-width buttons — same
technique D-197 used for Gear|Pool (`rowGap`/`halfWidth`, reused verbatim,
not reinvented) — "Plan Levels" (which plan) and the new `cadenceHandle`
pill (how it's applied). `showPlanModeSelect` is gone; `openLevelPlanner`
now opens straight into `showBlueprintEntryChoice` (6.2, below).

**6.2 — Three-way entry screen**: `showBlueprintEntryChoice` — **Create a
New Blueprint** (fresh `emptyLevelUpPlan`, keeps the hero's current
cadence), **Select a Saved Blueprint** (`showBlueprintPicker`, filtered to
this hero's current class via `blueprintsForClass` → `showBlueprintSubmenu`:
**Use As-Is** applies and closes immediately, no wizard steps shown;
**Edit** loads the blueprint into the SAME wizard machinery as "Create
New," pre-seeded; **Delete** is a two-click arm/confirm within the same
overlay screen — re-renders with the button relabeled "Confirm Delete?",
no timer needed since the overlay already re-renders per click), and **No
Blueprint** (today's exact throwaway per-character flow, unchanged —
`planningDraft` stays seeded from the hero's own current plan, preserving
the pre-Plan-6 "reopen and keep editing" behavior). Not in the plan doc's
own 6.1-6.5 list but added as a small, necessary scope addition: **Delete**
— a library nobody can prune becomes clutter, and it was cheap to add
alongside the submenu already being built.

**6.3 — Saving a blueprint**: `showPlanDoneScreen` gains a "Save as
Blueprint" choice (always offered, regardless of entry path, alongside
the unchanged this-hero-only "Save & Close" — keeps "applying without
saving" the default, per the plan's own framing) → `showBlueprintSaveScreen`
(Update the source blueprint in place vs. Save as New, when editing an
existing one) → `showBlueprintNameEntryScreen`, a DOM `<input>` built with
the EXACT same technique `buildSlotUi`'s hero-name field already
establishes (value read as a JS property, `keydown` stops propagation),
cleaned up automatically by `levelPlanOverlay`'s own next-screen
`clearChoiceOverlay` rather than needing separate lifecycle code.

**6.5 — Level-up-triggered spell swaps become plannable**: real scope
reduction found during research — `spellSwapStepsForClass`'s **full-relist**
variant (`preparedSwapIsFullRelist`) is Long-Rest-only by design (D-136);
every level-up-triggered swap is ALWAYS the simpler "replace exactly one"
drop-then-learn flow, so this decision never needed to model full-relist
at all. `LevelUpPlan` gains `spellSwaps: Partial<Record<number,
LevelUpSpellSwapChoice[]>>` (an array per level — one level can need BOTH
a cantrip AND a prepared swap, e.g. Sorcerer); `LevelUpChoiceStepKind`
gains `"spellSwap"`; `futureChoiceSteps` walks levels 2-20 calling
`spellSwapStepsForClass(classId, level, "levelUp")` and pushes a step per
kind found — this can add MANY steps for a caster (a swap opportunity
recurs almost every level), the existing per-step "Skip (decide later)"
choice is the intended escape hatch, same as ASI. New pure resolver
`resolveSpellSwapStepsForLevel(hero, level, plan)`: **all-or-nothing** —
if ANY of a level's needed kinds lacks a valid plan entry (missing, a
stale `dropId` no longer known, or a `learnId` no longer eligible),
NOTHING is applied, avoiding a partially-resolved level leaving a live
popup re-asking for a swap that already happened. Wired into both
`fastForwardHero` (silently applies when planned, no-ops otherwise —
matches the exact pre-D-199 baseline when no plan exists) and
`BattleScene.applyClassLevelUps`'s existing spell-swap check (`autoMode &&
resolveSpellSwapStepsForLevel(...)`, same call shape as the three checks
above it — deliberately did NOT extend this to fire a popup on a partial
"auto"-mode plan, preserving swaps' original "auto always skips silently
unless fully covered" behavior rather than making it behave like ASI's
stricter "auto with no entry still prompts" rule). The live in-battle
drop/learn screens (`showSpellPrepDropScreen`/`showSpellPrepLearnScreen`)
now pre-highlight a planned choice in "Prompted" mode, same `highlighted`
precedent `showAsiPathChoice` already established for ASI/subclass/
spell-pick screens. The Character Creation wizard gets its own
`showPlanSpellSwapStep`/`showPlanSpellSwapLearnStep` mirroring
`BattleScene`'s two-screen shape but writing into
`planningDraft.spellSwaps[level]` via `simulateHeroUpToChoice` for real
eligibility, same precedent every other step already uses.

**Explicit assumption, cheap to revisit**: no browser available in this
environment to verify ANY of this — the largest, most interaction-heavy UI
addition on the whole roadmap (a new 3-way entry screen, a picker/submenu,
a name-entry save screen, a new per-hero pill, a whole new step kind
threaded through the existing wizard). Needs a dedicated browser pass from
Kevin before being called fully done, same caveat D-191/Plan 8 carried for
a similarly large, unverifiable UI change — see **KI-149**.

- Tests: **1561** (+21 — 11 new in `tests/blueprintLibrarySystem.test.ts`,
  10 more added to `tests/levelUpPlanSystem.test.ts` for
  `resolveSpellSwapStepsForLevel`/`futureChoiceSteps`'s new `"spellSwap"`
  steps/`fastForwardHero`'s swap integration). Typecheck clean, all 1561
  pass, production build succeeds (144 modules, +1 for the new system
  file).
- `src/game/systems/BlueprintLibrarySystem.ts` (new) — the whole library.
- `src/game/config.ts` — `BLUEPRINT_LIBRARY_STORAGE_KEY`.
- `src/game/systems/LevelUpPlanSystem.ts` — `LevelUpSpellSwapChoice`,
  `LevelUpPlan.spellSwaps`, `resolveSpellSwapStepsForLevel`,
  `futureChoiceSteps`'s new loop, `fastForwardHero`'s new call.
- `src/game/scenes/BattleScene.ts` — `applyClassLevelUps`'s spell-swap
  check, `showSpellPrepDropScreen`/`showSpellPrepLearnScreen`'s new
  `plannedSpellSwapChoice` pre-highlighting.
- `src/game/scenes/CharacterCreationScene.ts` — the whole blueprint entry/
  picker/submenu/save flow, the split `planHandle`/`cadenceHandle` row,
  `showPlanSpellSwapStep`/`showPlanSpellSwapLearnStep`.
- `tests/blueprintLibrarySystem.test.ts` (new, 11 tests).
- `tests/levelUpPlanSystem.test.ts` — 10 new tests.

- **LOCKED:** "Stronghold Integrity" is the shared loss resource; "Breach Damage"
  is what escaping enemies remove from it; "Tile" is the logical distance unit.
- **LOCKED:** Local single-player core loop before any Firebase or multiplayer.
- **OPEN:** Final game title must be original with no D&D branding (working title
  "Fantasy Tower Defense" is temporary).

### D-200 — Party Creation Overhaul Plan 7: the level-progression reference screen

Kevin: "Plan 7 now." The last remaining item on `PARTY_CREATION_OVERHAUL_
PLAN.md`'s roadmap — a level-by-level reference so a player can see what a
class/subclass gets at every level 1-20: feature names (including ASI
levels), and for casters, spell slots/cantrips known/prepared count. This
closes the entire Party Creation Overhaul epic (Plans 0-8 all DONE now).

Went through `EnterPlanMode`: three Explore agents in parallel first
(`CompendiumScene`'s class/subclass detail rendering, `CharacterSheetScene`'s
tab architecture, and the `SpellcastingSystem`/`SpellPreparationSystem`
per-level tables), then a Plan agent validated the design against the real
code before any implementation — caught two real mistakes in the initial
design: `getSubclassDefinition` throws on an unknown id (and on
`undefined`), so a subclass-less hero must never call it directly; and the
originally-proposed "achieved vs not" text colors (`createOrnateButton`'s
dark-wood-panel button-plaque colors) would be nearly invisible against
`CharacterSheetScene`'s light parchment panel — corrected to the existing
ink color (`#2a1a10`) plus `.setAlpha(0.55)` for not-yet-reached rows, the
same dimming convention `CampaignSelectScene` already uses for locked cards.

**No new game-balance numbers or systems** — this is pure assembly over
already-tested data. New pure function `classProgressionTable(classId,
subclassId?)` in new file `src/game/systems/ClassProgressionSystem.ts`
(distinct from the unrelated pre-existing `ProgressionSystem.ts`, which is
wave-clear level-up cadence) loops levels 1-20 and combines: `classDef.
features`/`subclassDef.features` filtered per level, plus (for casters)
`spellSlotsForClassAtLevel`/`cantripsKnownForClassAtLevel`/
`preparedSpellCountForClassAtLevel`/`wizardSpellbookSizeAtLevel` (wizard
only) from the existing spellcasting/spell-prep systems — no new tables,
no new balance decisions.

**Two surfaces, per the plan doc's own 7.1/7.2 split:**
- **`CompendiumScene.renderClassDetail`** (Main-Menu-reachable, no "my
  hero" context) now renders a real per-level grouped table — an
  `isGroupHeader` "Lv N" row per level (skipped entirely if that level has
  nothing new, to avoid 20 bare headers for a class with sparse features),
  its class features as before, plus one condensed caster-summary row
  (`Slots: 2/0/0 · Cantrips: 3 · Prepared: 4[, Spellbook: 6]`) when
  applicable. Reuses the existing `DetailRow`/`renderRowList` pagination
  engine unchanged — it already handles arbitrary-length row lists.
  `renderSubclassesDetail` stays byte-for-byte unchanged: spell-slot
  progression is a class-level fact, not a per-subclass one, so exploding
  it per-subclass-per-level would be noisy and duplicative for no benefit.
- **`CharacterSheetScene`** (in-battle, always has a live `Hero` with a
  real current level) gets a new fourth tab, "Progression" — one compact
  row per level 1-20 (fits the existing 840px parchment panel with no new
  pagination needed), combining class AND subclass features (a hero
  always has both, unlike Compendium's class-only browse), dimmed via
  `.setAlpha(0.55)` for `level > hero.level`, with a hover tooltip
  (`attachHoverTooltip`, already used elsewhere in this scene) revealing
  the full feature description text. A hero with no `classId` (the old
  "classic" fixed-roster hero) gets an explanatory line instead of a
  table. `addStatLine`'s return type changed from `void` to
  `Phaser.GameObjects.Text` (every existing call site already ignored the
  return value) so the new tab can grab a handle for `.setAlpha`/tooltip
  attachment.

**Explicit assumption, cheap to revisit**: no browser available in this
environment — needs Kevin's own pass for both the rewritten Compendium
class-detail layout and the new Character Sheet tab, same standing
limitation as every other visual change in this project. See **KI-150**.

- Tests: **1570** (+9, new `tests/classProgressionSystem.test.ts`).
  Typecheck clean, all 1570 pass, production build succeeds (145 modules,
  +1 for the new system file).
- `src/game/systems/ClassProgressionSystem.ts` (new) — `classProgressionTable`.
- `src/game/scenes/CompendiumScene.ts` — `renderClassDetail` rewritten,
  new `casterSummaryText`/`trimTrailingZeros` module-level helpers.
- `src/game/scenes/CharacterSheetScene.ts` — `SheetTab`/`TAB_DEFS` gain
  `"progression"`, `renderTab`'s dispatch, new `renderProgressionTab`/
  `progressionRowText`/`progressionRowTooltip`, `addStatLine`'s new
  return type.
- `tests/classProgressionSystem.test.ts` (new, 9 tests).

### D-201 — Load Game now forwards a campaign party's campaignId/chapterIndex

Kevin: "let's fix both here and now," picking a `KNOWN_ISSUES.md` bug over a
fresh feature. Flagged (but explicitly not fixed) in D-195: a campaign
party saved and reloaded via `LoadGameScene` re-entered Character Creation
fully free-pick — no companion lock, no point-buy, wrong party size.
Research found the bug is very much live today, not just a legacy-data
edge case: `CharacterCreationScene`'s own pre-battle "Save Party" IS hidden
in campaign mode (Plan 3.7), but `BattleScene`'s in-battle pause-menu "Save
Party"/"Save & Exit" is NOT — `canSaveParty()` only checks `originalParty
!== undefined`, so pausing mid-campaign-battle and saving is the one live
path that produces a campaign-linked `SaveSlot`.

**Bigger than "forward one field."** `SaveSlot` gained `campaignId?:
string`/`chapterIndex?: number` (optional, defensive-parsed like every
other D-195-era field — no version bump), written by `BattleScene.
saveParty()` and by `CharacterCreationScene`'s own Start-Battle re-save,
and forwarded by `LoadGameScene.loadSlot()`. That alone would only fix
point-buy/party-size/difficulty-visibility (all keyed directly on
`this.campaignId` truthiness). The companion identity/gear lock and Start
Battle's roster write-back needed a second fix: `create()`'s
companion-prefill block (`companionBuildsForSlots`/`this.
companionIdForSlot`) only ever ran `if (!this.loadedParty)` — so even
after forwarding `campaignId`, a reloaded campaign party still couldn't
lock, because the metadata linking "slot N" to "companion X" was never
computed. Fixed by hoisting that metadata computation to run whenever
`this.campaignId` is set, REGARDLESS of `loadedParty` — a loaded save's
own build VALUES still win (`loadedBuild = this.loadedParty?.[slot] ??
companionBuildsForSlots[slot]`, unchanged), only the "which slot is which
companion" bookkeeping now also runs for the reload case.
`identityLocked`'s formula dropped its `!this.loadedParty &&` guard
accordingly (now just `companionBuildsForSlots[slot] !== undefined`,
which stays `false` at every slot for a non-campaign load exactly as
before, since that block only populates outside `if (this.campaignId)`
at all). Confirmed safe: `seedStartingCompanions` is documented idempotent
("no-ops unless the roster is still fully default"), so re-running it on
every campaign visit (loaded or not) is harmless; the newly-reachable
`gearLocked` branch of `resolveGearIdsForSlot` was checked against D-197's
"Key correctness fix" writeup first, per this project's own standing
instruction — it already keys off `this.companionIdForSlot[slotIndex]`,
which this fix now correctly populates for the reload case too.

Tests: **1575** (+5, new `describe` block in `tests/saveSystem.test.ts`
covering `campaignId`/`chapterIndex` on `createSaveSlot`/`updateSaveSlot`/
`saveOrUpdatePartySlot`/round-trip/defensive-parse-rejection).
`CharacterCreationScene`/`LoadGameScene`/`BattleScene` stay untested per
this project's standing convention. Typecheck clean, all 1575 pass,
production build succeeds (145 modules, unchanged — no new source file).
No browser available in this environment — see **KI-151**.

- `src/game/systems/SaveSystem.ts` — `SaveSlot`/`NewSaveSlotInput`/
  `SaveSlotUpdate`/`SavePartyInput` gain `campaignId?`/`chapterIndex?`;
  `isSaveSlot` validates them defensively; `saveOrUpdatePartySlot` passes
  them through on both the create and update path.
- `src/game/scenes/BattleScene.ts` — `saveParty()` now records them.
- `src/game/scenes/CharacterCreationScene.ts` — Start Battle's own
  `updateSaveSlot` call now records them too; the companion-prefill block
  and `identityLocked`'s formula (see above).
- `src/game/scenes/LoadGameScene.ts` — `loadSlot()` forwards them.
- `tests/saveSystem.test.ts` — 5 new tests.

### D-202 — Character Creation now resumes a "plain" draft across Back-and-return

The other `KNOWN_ISSUES.md` bug picked up the same session (Plan 0.6, open
since D-190). No repro was ever obtained from Kevin — the earlier
investigation only established that `create()` unconditionally re-seeds
every slot from `CHARACTER_NAME_POOL` on any navigation path that isn't
Load Game/a campaign-companion prefill, silently discarding a typed name
(or any other in-progress pick) on a Back-to-Main-Menu-then-return round
trip. Asked Kevin directly whether to (a) fix that concrete defect on the
hypothesis it's the real bug, even without a confirmed repro, or (b) hold
off for a repro — **he chose (a).**

This reverses part of D-190's own "Build Party and New Game are
deliberately identical, always fresh" reasoning — flagged explicitly as
that reversal before building, not silently.

**Design, chosen to reuse existing machinery rather than invent a new
snapshot mechanism**: `SlotState.allocator` holds a real class instance
(`StandardArrayAllocator`/`PointBuyAllocator`) with methods, so a naive
deep-clone of `this.slots` would silently lose them. Instead, a new
module-level `lastPlainDraft: CharacterBuild[] | undefined` (module-level,
not a class field, because the scene instance itself is torn down and
rebuilt by `scene.start()`) stores the output of the ALREADY-existing
`buildsFromSlots()` — the exact same serialization `SaveSystem`/the
roster already trust — and `init()` feeds it back in as `this.loadedParty`
on the next "plain" entry (no campaign, no Free Play/custom map — new
`isPlainEntry()` helper), reusing the Load-Game-established `loadedParty`
→ `slotStateFromBuild` reconstruction path verbatim. No new SlotState
snapshot/restore logic needed. Lost on a real page reload (never touches
`localStorage`) — a same-session convenience, not a save.

Captured in `leaveToMainMenu()` (the only existing "leave without
starting a battle" path today), gated on `isPlainEntry()` so a locked
campaign party never leaks into the free-pick draft. Cleared the instant
a plain session's own Start Battle actually fires, so a later Build Party
visit starts fresh instead of resurrecting an already-in-play party — a
campaign/Free-Play/Load-Game battle start leaves any OTHER unrelated
plain draft untouched. "New Game" and "Build Party" still share one
undistinguished entry point (D-190's original call, unchanged) — both
equally resume the same draft.

Tests: unchanged at **1575** (`CharacterCreationScene` isn't unit-tested,
same standing convention as every other change to this file). Typecheck
clean, all 1575 pass, production build succeeds (145 modules, unchanged).
No browser available in this environment, and this fix is explicitly
UNCONFIRMED against Kevin's actual original report — see **KI-152**.

- `src/game/scenes/CharacterCreationScene.ts` — module-level
  `lastPlainDraft`, `isPlainEntry()`, `init()`'s new resume check,
  `leaveToMainMenu()`'s capture, Start Battle's clear.

- **OPEN items resolved:** "Hero collision" — living heroes block enemy routes
  (D-033). "Dice visibility" — deterministic for the MVP/vertical slice (D-030);
  **superseded by D-086 (Phase 13.1)**, which brings real d20 attack rolls
  back into combat at Kevin's explicit request. "Final party size" — four
  heroes for the vertical slice (D-052). "Level cadence" — a DEFAULT of
  every 2 waves (D-056), open to retuning after Kevin's in-browser feel
  pass; as of **D-089 (Phase 13.3)** this same cadence drives a D&D-built
  party's REAL per-class leveling — the classic roster's flat Vigor/Might
  choice this cadence originally drove was removed by **D-117**.
- Still OPEN: multiclassing (not part of Phase 13's scope). Structure
  destruction is PARTIALLY resolved — see D-111 (Phase 20): a siege enemy
  can now destroy a wall in its own attack range; an ordinary enemy still
  always routes around one, unchanged. Initiative shipped in 13.5 (D-090)
  as a framework-only
  `InitiativeSystem` — built and tested, but not called anywhere in
  `BattleScene` (D-086's own scope for it). A rest system (D-086) shipped in
  13.4 (D-088).
