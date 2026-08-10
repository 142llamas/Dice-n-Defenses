# Phase Handoff

## Version and phase
- **Version:** 0.2.0-dev. Phase 11 (11.1-11.10), Phase 13 (13.1-13.11),
  Phase 14 (all three parts), Phase 20 (D-111), Phase 21 (D-112), Phase 22
  (D-113), Phase 23 (D-114), and Phase 24 (D-115) are complete. Phase 12
  (Cooperative Multiplayer Feasibility) still has no live board sync. **This
  session ran Phase 25 (D-116): ten new cheap/expensive structure tiers, an
  opportunistic wall-bash any melee enemy can now take, and a trap-disarming
  Saboteur archetype (two new enemies).**
- **Why this ran this session:** Kevin asked, in one message, for three
  things: (1) more cheap/expensive versions of traps and buildings/walls —
  an explicit follow-up to a design discussion earlier this session where he
  chose cost tiers over building an upgrade system; (2) a real siege AI where
  ANY enemy can choose to attack a structure "if it makes sense based on
  their particular personality" and "the opportunity (no other option)," in
  a way that "would improve the enemies' odds"; (3) enemies/enemy skills
  that detect and disarm/destroy traps. All three are additive to existing,
  well-understood systems, so this session went straight to design-then-
  build.
- **Completed this session:**
  - **Ten new structures** (`data/structures.ts`), every one bracketing an
    EXISTING item's cost/effect on the cheap or expensive end — no new
    fields at all, pure content, exactly the pattern Palisade/Bulwark
    already established for Barricade in Phase 24:
    - **Wicket Gate** (cost 4, `maxHp` 5) / **Portcullis** (cost 12,
      `maxHp` 16) bracket Gate, giving it its own low/mid/high tier to
      match the wall curve.
    - **Snare Wire** (cost 4, 1 dmg, ground) / **Mangler Trap** (cost 13, 5
      dmg, ground, persistent — deliberately NOT `singleUse`, a distinct
      choice from Bear Trap) bracket the ground-trap-damage curve.
    - **Net Snare** (cost 4, 2 dmg, flying) / **Storm Lance** (cost 13, 7
      dmg, flying) give the flying-trap curve its first brackets — Sky
      Snare was previously the only anti-air option at all, closing a
      Phase 24 KNOWN_ISSUES deferred item.
    - **Sparring Post** (cost 5, +1 melee dmg) / **War Dais** (cost 14, +4
      melee dmg) bracket Melee Platform.
    - **Low Perch** (cost 5, +1 ranged DAMAGE) / **Sky Bastion** (cost 14,
      +1 ranged damage AND +1 range) bracket Ranged Perch. Low Perch trades
      the range bonus for a smaller damage bonus rather than being a
      strictly weaker copy; Sky Bastion is the one structure in the roster
      granting both bonus types at once.
    - `SHOP_ORDER` grows from 12 to 22 entries.
  - **Shop grid pagination** (`BattleScene.ts`): 22 shop items at 4 columns
    is 6 rows — concrete layout math (`GAME_HEIGHT` 1080px, `cy` ≈848px on
    `TEST_MAP`) showed this would push the Done button, and part of a large
    page, past the canvas. Rather than build a second, duplicate paging
    system, the EXISTING Gear-grid pagination (Phase 17, D-108) was
    generalized to cover both: `GEAR_GRID_PAGE_SIZE` renamed
    `ITEM_GRID_PAGE_SIZE`; `showShopUI` gained the same page-slicing
    `showEquipUI` already had; the three nav-button fields renamed
    `pageNav*` and shared between both grids (never shown at once, since
    build/equip modes are mutually exclusive); `turnGearPage` generalized to
    `turnGridPage` via the pre-existing `currentGridItems()` helper; a new
    `refreshPageNav()` computes nav visibility purely from `this.ui.kind`,
    called once after `setInteraction`'s two show-calls (calling it from
    inside either show method directly would let the second call's
    `show: false` branch clobber the first one's correct nav state). BOTH
    grids are now permanently capped at 4 rows regardless of future
    catalogue growth.
  - **Opportunistic wall bash** (`WaveSystem.tickEnemyPhase`): a new branch,
    inserted right after the existing hero-attack branch (a reachable hero
    always still wins) and before the "advance" fallback. Any enemy that is
    NOT a dedicated siege enemy (`siegeDamageMultiplier` — unchanged, still
    its own unconditional priority tier above this one), NOT a pure runner
    (`ignoresHeroes` — unchanged, never attacks anything), and has
    `attackRangeTiles <= 1` (the melee "personality" — a ranged/caster enemy
    usually already reaches past a wall with its own range) now scans its
    own attack range for a destructible wall via the SAME
    `WaveSystem.findWallInRange` a siege enemy uses, the moment no hero is
    reachable ("the opportunity"). Deals plain `attackDamage` (plus any
    aura/enrage bonus already in play) — no siege multiplier, an improvised
    bash rather than a dedicated demolition attack. `StructureAttackEvent`
    gained an optional `opportunistic` flag so `BattleScene
    .showStructureAttack`'s combat-log line reads correctly either way.
  - **Trap disarm — the Saboteur archetype** (`data/enemies.ts`,
    `WaveSystem`, `BuildSystem.disarmTrap`): a new
    `EnemyDefinition.trapSense?: { rangeTiles }` field. A `trapSense` enemy
    scans within `rangeTiles` (Manhattan, INCLUDING its own tile) for a
    placed trap via a new `WaveSystem.findTrapInRange` helper, and — at the
    SAME unconditional priority tier siege already uses for walls, so it
    wins even over a reachable hero — disarms/destroys it outright instead
    of attacking or advancing. A trap has no HP (D-039: it always hits, in
    full, every time), so `BuildSystem.disarmTrap` is a one-shot removal
    (wraps `remove()`), never a partial-damage step; it never refunds gold,
    same as `damageStructure`/`remove()` generally. Two new roster entries:
    **Saboteur** (fast, fragile, senses 1 tile) and **Warren Stalker**
    (tougher, senses 2 tiles) — reachable via Free Play/Bestiary only, not
    yet wired into any campaign wave (same precedent several Phase 20/21
    enemies set).
  - Tests: 960 → **983** (+23: `tests/building.test.ts` gained four new
    `describe` blocks for all ten new structures; a new
    `tests/enemyMechanicsPhase25.test.ts` behaviourally exercises both new
    AI mechanics, including that a ranged enemy/pure runner/dedicated siege
    enemy are each correctly excluded or unaffected, and that trap-disarm
    beats a reachable hero and respects each enemy's own `rangeTiles`;
    `tests/enemyRoster.test.ts` gained a Phase 25 section plus an updated
    minion-count assertion). Typecheck, all tests, and the production build
    all pass (109 modules, unchanged — no new source files besides the one
    new test file). `npm run dev` serves HTTP 200 (checked this session).
  - **A real pre-existing doc bug found and fixed**: `KNOWN_ISSUES.md`'s
    KI-017 still read "Enemies never attack walls... unimplemented by
    design" — stale since Phase 20 (D-111) shipped the siege mechanic and
    never updated it. Moved to the Resolved section, crediting both Phase
    20's original siege AI and this phase's generalization.
- **What's NOT done, and why:** the in-browser feel/balance pass covering
  Phase 17 through 25 is STILL not done — this is now the NINTH consecutive
  content/mechanics phase to ship without a human playtest (KI-065 through
  KI-073). No additional Watchtower-style `"any"`-audience platform tier —
  Watchtower already fills that generalist niche alone; the ask was
  specifically for brackets around the two EXISTING specialist platforms,
  not a third audience category. No trap HP/damage-scaling — traps stay
  indestructible/un-upgradeable, since Kevin explicitly chose cost tiers
  over an upgrade system for this exact reason at the very start of this
  session (see D-116's opening paragraph). Saboteur/Warren Stalker are not
  placed in any existing campaign wave.
- **Recommended next step:** **the in-browser feel/balance pass covering
  Phase 17-25** remains the clear, strong recommendation — nine consecutive
  content/mechanics phases (KI-065 through KI-073) have now shipped with
  zero human playtesting between them. If Kevin would rather keep building
  instead, there is no pre-scoped "Phase 26 candidate" — the next chat
  should ask him directly what to build next.
- **Last complete milestone:** Phase 6 (`v0.1.1`); Phase 11 (11.1-11.10);
  Phase 13 (13.1-13.11); Phase 14 (all three parts); Phase 15 (D-104/D-105);
  Phase 16 (D-106/D-107); Phase 17 (D-108); Phase 18 (D-109); Phase 19
  (D-110); Phase 20 (D-111); Phase 21 (D-112); Phase 22 (D-113); Phase 23
  (D-114); Phase 24 (D-115); Phase 25 (D-116, this session). Phase 12 still
  has no live board sync.
- **Git branch:** no git in this environment; Kevin manages branching in
  GitHub Desktop. This session's changed files:
  `src/game/data/structures.ts`, `src/game/data/enemies.ts`,
  `src/game/systems/WaveSystem.ts`, `src/game/systems/BuildSystem.ts`,
  `src/game/scenes/BattleScene.ts`; updated test files
  `tests/building.test.ts`, `tests/enemyRoster.test.ts`; new test file
  `tests/enemyMechanicsPhase25.test.ts`; docs (`DECISIONS.md`,
  `PROJECT_STATUS.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`,
  `CONTENT_SOURCES.md`, this file). No git commit/tag made here.
- **Date:** August 6, 2026

## Why this batch was chosen
Kevin asked directly for all three pieces of this batch in one message,
explicitly picking cost tiers over an upgrade system first (resolving the
one real design fork up front), then describing the siege-AI and trap-
disarm mechanics in enough behavioral detail ("personality," "opportunity,"
"improve the enemies' odds") that this session could design the concrete
rules itself rather than needing to ask more scoping questions — all three
asks are additive to existing, well-understood systems.

## What works now
- Everything from every prior phase, unchanged in behavior for any
  hero/enemy/map/campaign/structure that doesn't touch one of this
  session's new fields.
- **New: ten structures** — Wicket Gate, Portcullis, Snare Wire, Mangler
  Trap, Net Snare, Storm Lance, Sparring Post, War Dais, Low Perch, Sky
  Bastion — all immediately buildable via the Build shop (now paginated).
- **New: any ordinary melee enemy** bashes a destructible wall in its own
  attack range with its own attack damage when no hero is reachable that
  phase.
- **New: Saboteur/Warren Stalker** detect and disarm/destroy a placed trap
  within their sense range, at the same unconditional priority siege gives
  walls.
- **New: the Shop and Gear grids both paginate through one shared nav
  control**, permanently capped at 4 rows each regardless of catalogue size.

## What changed
- **One new source file this session**: `tests/enemyMechanicsPhase25.test.ts`.
- Every other change is an edit to an existing file (see "Git branch" above
  for the full list).
- **Docs**: `DECISIONS.md` (new D-116), `PROJECT_STATUS.md` (new Phase 25
  section), `CHANGELOG.md` (new entry), `KNOWN_ISSUES.md` (new KI-073;
  KI-017 moved to Resolved), `CONTENT_SOURCES.md` (new Phase 25 row), this
  file (rewritten).

## Important files
- **`DECISIONS.md`'s D-116** — the full method: every new structure's
  bracketing rationale, the shop-pagination generalization, the
  opportunistic wall-bash's exact gating conditions, and the trap-disarm
  mechanic's priority tier and one-shot-removal semantics.
- **`src/game/data/structures.ts`** — the ten new structure definitions and
  the updated `SHOP_ORDER`. **`src/game/data/enemies.ts`** — the
  `trapSense` field and the Saboteur/Warren Stalker entries.
  **`src/game/systems/WaveSystem.ts`'s `tickEnemyPhase`** — both new AI
  branches, plus the new `findTrapInRange` helper and `TrapDisarmEvent`.
  **`src/game/systems/BuildSystem.ts`'s `disarmTrap`** — the one-shot trap
  removal. **`src/game/scenes/BattleScene.ts`** — `ITEM_GRID_PAGE_SIZE`/
  `refreshPageNav`/`turnGridPage` (the generalized pagination), the new
  `trapInstanceAt`/`disarmTrap` context wiring, and `showTrapDisarm`.
- **`KNOWN_ISSUES.md`'s KI-073** — the full in-browser verification
  checklist for this phase's ten structures, the wall-bash AI, the
  trap-disarm AI, and the new pagination.

## Commands verified
- `npm run typecheck` — pass.
- `npm test` — pass, **983/983**.
- `npm run build` — pass, 109 modules (unchanged — one new test file only,
  no new src files).
- `npm run dev` — serves HTTP 200 (checked this session).

## Manual tests completed
**None** — same standing limitation as every content/mechanics phase, now
the NINTH in a row (KI-065 through KI-073). See KNOWN_ISSUES **KI-073** for
the full checklist.

## Known issues
- **KI-073** — this entire phase not yet confirmed by a human in a browser;
  full checklist listed there.
- **KI-072**/**KI-071**/**KI-070**/**KI-069**/**KI-068**/**KI-067**/
  **KI-066**/**KI-065** — Phases 24/23/22/21/20/19/18/17, also still not yet
  confirmed in a browser (unrelated to this session specifically, but still
  open — NINE stacked, unplayed content/mechanics phases now).
- **KI-017 resolved** this session (see DECISIONS D-116 / KNOWN_ISSUES'
  Resolved section) — it had gone stale since Phase 20 actually shipped the
  siege mechanic it described as "unimplemented."
- Unchanged: every other issue in `KNOWN_ISSUES.md` — none of those systems
  were touched this session.

## Deferred items
- **An in-browser feel/balance pass** covering Phase 17-25 together — by a
  very wide margin the highest-value next step at this point; see
  "Recommended next step" above.
- **A third Watchtower-style `"any"`-audience platform tier** — not asked
  for this session (the ask was specifically brackets around the two
  EXISTING specialist platforms).
- **Trap HP/upgrade system** — Kevin explicitly chose cost tiers over this
  at the start of the session; a clean future reversal if he changes his
  mind, but not LOCKED.
- **Wiring Saboteur/Warren Stalker into a specific campaign wave** —
  reachable via Free Play/Bestiary only for now, same precedent several
  Phase 20/21 enemies set.
- Everything already deferred from earlier phases (Phase 12's
  result-broadcast/live sync, rules-test verification blocked on JDK 21+, a
  third subclass per class, map-draft resizing while preserving paint,
  platform bonuses on abilities, multiclassing, upcasting, ammunition
  tracking, per-class weapon-mastery gating, Strength-gated movement
  penalty for heavy armor, cross-run level persistence for Epic Boons,
  Skilled's skill-proficiency system, a player-facing Magic Initiate spell
  picker, a visual indicator for a Shielded enemy's remaining ward or a
  Multi-Phase Boss's phase change, an endless/infinite wave-generator mode,
  a "found but not equipped" loot inventory/browsing UI, ability-score-
  setting magic items, any charge-based active item, a bigger board, a
  dynamic-terrain authoring UI in the Map Builder, enemy-pushes-hero
  interaction with pits, a defensive/AC-granting platform) — untouched this
  session.

## Decisions made
- **D-116** — Phase 25, ten new structure tiers, an opportunistic wall-bash
  AI, and a trap-disarming Saboteur archetype. See `DECISIONS.md` for the
  full method.

## Content or license additions
- **This phase's content is entirely ORIGINAL, not SRD-derived** — all ten
  structures, the two new enemies, and the `opportunistic`/`trapSense`
  mechanics are invented for this project. See `CONTENT_SOURCES.md`'s new
  Phase 25 row.

## Next chat instructions
1. **Strongly consider recommending the in-browser feel/balance pass**
   covering Phase 17-25 (KI-065 through KI-073, all still open) before
   building anything further — nine consecutive content/mechanics phases
   have now shipped with zero human playtesting.
2. **If Kevin wants to keep building instead**, there is NO pre-scoped
   "Phase 26 candidate" this time — ask him directly what's next rather
   than assuming or inventing new scope.
3. Boundaries unchanged from before this session, plus this session's own:
   no third "any"-audience platform, no trap upgrade/HP system, Saboteur/
   Warren Stalker not yet wave-assigned.

## Suggested git steps (not run here; use GitHub Desktop)
1. This session's diff touches structures.ts/enemies.ts/WaveSystem.ts/
   BuildSystem.ts/BattleScene.ts, plus two updated test files, one new test
   file, and docs — a small-to-medium, mechanically coherent diff, safe as
   its own commit, same as every prior phase.
2. Not deployed anywhere — this is all local/headless work, same as every
   prior data/content phase.

## Handoff package contents
- [x] Source files (see "What changed" above)
- [x] package.json / package-lock.json (unchanged — no new deps)
- [x] README.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new Phase 25 section)
- [x] DECISIONS.md (updated — new D-116)
- [x] KNOWN_ISSUES.md (updated — new KI-073, KI-017 resolved)
- [x] CHANGELOG.md (updated — new entry)
- [x] CONTENT_SOURCES.md (updated — new Phase 25 row)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged — this session didn't
      touch Phase 12)
- [x] PHASE_HANDOFF.md (this file, rewritten)
- [x] Tests (983, +23 this session)
- [x] No node_modules, dist, secrets, or service-account credentials
