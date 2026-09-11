# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged.
- **Date:** September 11, 2026.
- **Why this handoff exists**: Kevin asked for a "very thorough" file-by-file,
  line-by-line cleanup pass across the ENTIRE project — every `src/` file,
  every test, every doc — ahead of his next playtest round, not a scoped
  feature ask. Shipped as **D-254** (a real bug the audit found) and **D-255**
  (the cleanup pass itself).
- Tests: **1868** (was 1872 — net -4 from removing dead-code tests, +2 new for
  the D-254 fix; see D-254/D-255 in `DECISIONS.md` for the exact
  reconciliation). Typecheck clean, production build succeeds (**170
  modules**, unchanged — this was a consolidation/deletion pass, no new
  source files).
- Next available: **D-256** / **KI-203**.

## What shipped this session

### Scoping (before any code changed)

Given the scale (149 `src/` files, 113 test files, ~2MB of accumulated
markdown across `DECISIONS.md`/`KNOWN_ISSUES.md`/`CHANGELOG.md`/
`PROJECT_STATUS.md` alone), this started with an `AskUserQuestion` pass to
pin down scope before touching anything:
- **Docs in scope, including pruning** — but any doc-content removal shown
  to Kevin as an explicit proposal before deleting anything, matching
  `CLAUDE.md`'s own "these are permanent records" framing for `DECISIONS.md`/
  `KNOWN_ISSUES.md`/`CHANGELOG.md`.
- **Ambiguous code findings flagged, not deleted** — anything not fully
  confirmed dead/redundant gets reported for Kevin's own call rather than
  removed on a judgment call.

### The audit: 14 parallel agents

8 agents covered all of `src/` (battle-mechanics systems, character/
progression/spell systems, economy/campaign/save systems, wave/companion/misc
systems, 2 data-file halves, 2 scenes halves, entities/cloud/root), 2 covered
all of `tests/`, and 4 covered the docs (`DECISIONS.md`, `KNOWN_ISSUES.md`,
`CHANGELOG.md`+`PROJECT_STATUS.md`, and the smaller tracking docs). Every
agent was instructed to grep-verify a dead-code/duplication claim against the
WHOLE repo (not just its assigned files) before reporting it, and to keep
CONFIRMED findings separate from AMBIGUOUS ones.

### D-254 — a real bug, found during the audit, not just cleanup

`NamelessThroneSystem.computeMercyTally` reads the "spared" flag for all 5
"home" minibosses, including Shattered Causeway's Juggernaut — but D-253 made
Causeway optional, so a player who skips it (the region's own intended path
now) never sets that flag, which was silently counted the same as "finished
it, showed no mercy." Presented Kevin 3 fix options directly (exclude
entirely / default to spared / leave as-is); he picked **exclude**.
`computeMercyTally`/`resolveThroneVariant`/`mercyTallyLeansHollow` gained an
optional `causewayPlayed = true` parameter (default keeps every existing call
site's behavior); `BattleScene.ts` computes the real value via a new
`causewayPlayed()` helper (`isChapterCompleted` against a new
`SHATTERED_CAUSEWAY_CAMPAIGN_ID` constant) at its 3 real call sites. 2 new
tests cover the actual fix.

### D-255 — the cleanup pass itself

**Removed (confirmed dead — zero production callers anywhere in the repo)**:
`GameMap.describe()`, `SpellPreparationSystem.isValidSelection()`,
`ProgressionSystem.levelsSoFar`, `BuildSystem.removeAt()`, two dead
`export type { GridPosition }` re-exports (`data/structures.ts`,
`data/enemies.ts`). 8 tests removed alongside (2 for `describe()`, 4 for
`isValidSelection`, and `levelsSoFar`'s 2 reads rewritten rather than deleted
outright — they now observe `acknowledgeLevelUp`'s effect via
`hasPendingLevelUp`, the same idiom a sibling test already used).

**Duplicated logic consolidated onto one shared implementation each**:
`MapBuilderScene`'s tile-size formula now calls `GridSystem.
computeFittedTileSize`; `CombatSystem.chooseTarget`/`attackArea` share a new
`compareTargetPriority` comparator; `SpellcastingSystem`'s sparse-lookup
helper moved to `CharacterSystem.ts` (exported, now shared by both files'
own per-level lookups); `ClassProgressionSystem`/`ProficiencySystem` now call
`SpellcastingSystem.isSpellcaster`; `ClassProgressionSystem`/
`LevelUpPlanSystem` now call `CharacterSystem.featuresAtLevel`;
`gearPickerView.ts`/`BattleScene.ts` now call `LootSystem.isPotionId`;
`BattleScene.ts` now calls the existing `BuildSystem.trapIsSingleUseAt`
instead of computing it independently; `CharacterCreationScene`'s
exact-duplicate private `maxCastableSpellLevel` was deleted in favor of the
already-exported `SpellPreparationSystem` version. 2 exact-duplicate test
assertions removed from `campaign.test.ts` (already covered, more precisely,
by `enemyRoster.test.ts`).

**Stale comments/doc-comments fixed** (all factually wrong references to
removed/superseded systems): `InitiativeSystem.ts`/`WorldFlagSystem.ts`
header comments claiming "nothing consumes this yet" (both are real
dependencies now); `ProgressionSystem.ts` naming a nonexistent
`Hero.grantVigor`; `RestSystem.ts`/`BattleScene.ts`/`Hero.ts`'s shared
reference to a nonexistent `ProgressionSystem.applyChoice`; `data/
campaigns.ts` (×2)/`data/difficulty.ts` describing the pre-D-253 24-mission/
4-chapters-per-region shape; `data/campaigns.ts`'s `introText`/`outroText`
comment claiming no rendering exists (D-177 built it); `UnlockMissionSystem.ts`
saying "Chapters 2-4" (Emberford is 3 now); `CharacterCreationScene.ts`
naming a nonexistent `openGearItemPicker`.

**Documentation — fixed directly** (accuracy corrections, not history
pruning): `CLAUDE.md` (intro/D-NNN reference/git rule were all Phase 7/
D-058-era) and `README.md` (a full rewrite — it still described the classic
4-hero/10-wave MVP with 157 tests and an empty `src/firebase/` placeholder)
were both badly stale. Also fixed: `package.json`'s description,
`PHASE_12_MULTIPLAYER_FEASIBILITY.md`/`CAMPAIGN_STORY_DESIGN.md`'s
"DESIGN ONLY" banners (both contradicted by their own later content),
`SOURCE_OF_TRUTH.md`'s repo-note (wrongly claimed 2 already-resolved items
were still open), `FIREBASE_SETUP.md` (framed as not-yet-done; it's been
live since Phase 10), `ASSET_PLAN.md` (missing the D-119 portrait-manifest
system), `PARTY_CREATION_OVERHAUL_PLAN.md` (missing its "all done" banner).

**Documentation — held for Kevin's sign-off, then approved and applied**:
`DECISIONS.md` (removed one duplicated paragraph inside D-193; added
"superseded, see D-XXX" cross-reference notes to D-097/D-136/D-213 — no
decision's substance changed); `KNOWN_ISSUES.md` (amended KI-190's Gear-
Points bullet, rewrote KI-098's stale item-13 status paragraph, struck
"Signature Action" from KI-111/KI-115); `PROJECT_STATUS.md` (fixed a false
"closes the list" header claim, collapsed a fossilized ~467-line MVP-era
snapshot to a pointer into `CHANGELOG.md`).

**Deliberately NOT done, flagged instead**: a UI-consistency gap —
`BrowseSharedMapsScene.ts`, `TestModeScene.ts`, and `MapBuilderScene.ts`
still hand-roll flat, no-hover-feedback buttons (and, for
`BrowseSharedMapsScene`, pre-D-234 Prev/Next pagination) instead of the
shared `uiTheme.ts`/`uiScrollList.ts` components every sibling scene has
since been migrated to. This is a real, visible UI change across 3 scenes
that can't be verified without a browser — recommended for a future
session, not attempted blind here.

## Deliberate scope decisions made this session

- Used 14 parallel `general-purpose` audit agents (report-only, no edits) to
  cover the entire codebase without blowing the main session's context —
  each grep-verified its own findings against the whole repo before
  reporting, and separated CONFIRMED from AMBIGUOUS.
- The D-254 bug's fix approach (exclude/default-spared/leave-as-is) was
  surfaced to Kevin via `AskUserQuestion` rather than decided unilaterally —
  it's a design choice about an unplayed choice's meaning, not a mechanical
  fix.
- Every AMBIGUOUS finding across all 14 audits (things that looked possibly
  dead/redundant but weren't confirmed with certainty) was left untouched in
  code and is preserved in this conversation's own transcript rather than
  copied into a tracking doc — see "Ambiguous findings, not acted on" below
  for the short version of what's still worth a look.
- Treated `CLAUDE.md`/`README.md`/`package.json`/the smaller tracking docs
  as ordinary accuracy corrections (fixed directly, no sign-off needed) but
  treated `DECISIONS.md`/`KNOWN_ISSUES.md`/`PROJECT_STATUS.md` as permanent
  records needing Kevin's explicit go-ahead first, per his own scoping
  answer and this project's established convention for those 3 files
  specifically.
- Did NOT attempt the `BrowseSharedMapsScene`/`TestModeScene`/
  `MapBuilderScene` reskin — real UI work needing browser verification,
  outside a "cleanup" pass's safe blast radius without that verification.

## Ambiguous findings, not acted on (worth a look, not urgent)

None of these are bugs — just things the audit couldn't fully confirm one
way or the other. Ordered by area, not priority:

- `WorldFlagSystem.clearWorldFlag` and the whole `ConcentrationSystem.ts`
  file have zero callers today — both may be deliberate forward-built
  scaffolding (matching this project's own pattern of building a system
  ahead of its consumer), not dead code. Worth confirming with Kevin before
  ever removing either.
- `CharacterSystem.featuresUpToLevel`/`activeFeaturesUpToLevel` have no
  scene/system caller (`CompendiumScene` reads `mechanicallyActive` directly
  instead) — possibly built ahead of an unshipped UI consumer.
- `AudioManager.playSfx`/`playMusic` have zero call sites — very likely
  deliberate pre-audio-content plumbing (matches Kevin's own D-153 request
  to build Settings before real audio exists), not orphaned.
- `TestModeScene.ts`/`BrowseSharedMapsScene.ts` both still carry the old
  Short/Medium/Long-only `WAVE_COUNT_PRESETS` shape that `FreePlayScene.ts`
  itself moved past (D-217's `RUN_LENGTH_DEFINITIONS`, wave count + level
  cap together) — may be an intentional scope difference (these two contexts
  may not need level-cap ramping) or a missed migration.
- `tests/integration.test.ts`, `tests/mvp-integration.test.ts`, and
  `tests/victory.test.ts` all independently re-prove similar acceptance
  criteria (a no-defense-loses / real-combat-wins loop) at increasing
  fidelity — not literal duplicates, but worth asking whether all 3 tiers
  are still wanted now that the most detailed one exists.
- A handful of small "used, but only internally" over-exports
  (`GearCompareSystem.isOffHandEligibleWeapon`, `SaveSystem.createSaveSlot`,
  `CharacterBuildSystem`'s `POINT_BUY_MIN_SCORE`/`MAX_SCORE`,
  `uiScrollList.ts`'s `scrollableRowAreaWidth`, `spells.ts`'s
  `isSpellId`/`spellsAtLevel`/`mechanicallyActiveCantrips`/`abilityForSpell`)
  — none are functionally dead, just broader public surface than their
  current usage needs. Low priority.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1868/1868** passing.
- `npm run build` — production build succeeds, **170 modules**.

## Manual tests completed

None — no browser available in this environment. This session's one real
behavior change (D-254's mercy-tally fix) and the flagged UI-consistency gap
both genuinely need a browser; everything else is either behavior-preserving
code cleanup (verified by the unchanged, still-fully-passing test suite) or
documentation-only.

## Known issues

- **KI-202** (new this session) — D-254's mercy-tally fix: reaching The
  Nameless Throne capstone after skipping Shattered Causeway entirely,
  confirming the ending and companion dialogue tone land correctly. See
  `KNOWN_ISSUES.md` for the full checklist.
- **KI-201** through **KI-186** — unchanged, still need confirmation (the
  entire 2026-09-09 19-item playtest list's own checklists); see
  `KNOWN_ISSUES.md`.
- **KI-182** through **KI-184**, **KI-177**, **KI-063** — unchanged, still
  open, unaffected by this session.

## Deferred items

- The `BrowseSharedMapsScene`/`TestModeScene`/`MapBuilderScene` ornate-UI/
  scroll-list reskin gap (see above) — a real follow-up candidate, not
  assigned to any tracked item yet.
- Every item in "Ambiguous findings, not acted on" above — none urgent, all
  worth a look eventually.
- Everything previously deferred (gear-slot icons pending real art,
  `NAMELESS_THRONE_MAP` resize, in-battle shop grid's proficiency gap,
  Free-Play-only now, item 3a's "every unequip anywhere feeds the party
  inventory pool" generalization, item 19a's named/savable setting profiles,
  an active summon/already-claimed treasure tile not surviving an autosave
  resume, and the orphaned 3-bullet glossary fragment found floating between
  D-199 and D-200 in `DECISIONS.md` with no owning heading or clear correct
  home) is unchanged.

## Next chat instructions

1. **KI-202 is the priority playtest** — it needs an actual capstone
   playthrough (skip Causeway, reach The Nameless Throne) to confirm, which
   is a longer-horizon check than most items in this file.
2. **The 2026-09-09 19-item playtest list's own checklists (KI-186 through
   KI-201) are still the main outstanding playtest backlog** — this
   session didn't touch any of that content, just cleaned up the code
   around it. `PLAYTEST_2026-09-09_BATCHES.md` remains the authoritative
   tracker; all 8 batches are DONE per that doc, just not yet Kevin-played.
3. **If Kevin wants the flagged UI-consistency reskin** (3 scenes never
   migrated to the shared ornate-UI/scroll-list components), that's a
   real, self-contained follow-up — see "Deliberately NOT done" above.
4. **If nothing new from Kevin and no playtest yet**: there's no other
   pre-set next task. `PARTY_CREATION_OVERHAUL_PLAN.md` and
   `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` are both fully closed per their own
   status banners.
5. Next available: **D-256** / **KI-203**.
6. Standard reminders, unchanged from every prior handoff: Kevin manages Git
   via GitHub Desktop and deploys via GitHub Actions on push to `main` —
   this session's changes are NOT committed/deployed yet. A real `.git`
   directory with a working remote exists in this environment for
   READ-ONLY inspection (`log`/`show`/`status`/`fetch`/`diff`) — still
   don't commit/push from here (see `CLAUDE.md` rule 9, also corrected this
   session to describe this accurately).

## Suggested git steps (not run here; use GitHub Desktop)

This session touched (grouped, not exhaustive — see `DECISIONS.md` D-254/
D-255 for full detail):

**Code (D-254, bug fix)**: `src/game/systems/NamelessThroneSystem.ts`,
`src/game/scenes/BattleScene.ts`, `src/game/data/campaigns.ts`,
`tests/namelessThroneSystem.test.ts`.

**Code (D-255, cleanup)**: `src/game/systems/GameMap.ts`,
`InitiativeSystem.ts`, `WorldFlagSystem.ts`, `CombatSystem.ts`,
`ProgressionSystem.ts`, `RestSystem.ts`, `CharacterSystem.ts`,
`SpellcastingSystem.ts`, `ClassProgressionSystem.ts`, `ProficiencySystem.ts`,
`LevelUpPlanSystem.ts`, `SpellPreparationSystem.ts`, `BuildSystem.ts`;
`src/game/data/structures.ts`, `enemies.ts`, `difficulty.ts`; `src/game/
scenes/MapBuilderScene.ts`, `gearPickerView.ts`, `CharacterCreationScene.ts`;
`src/game/entities/Hero.ts`; `tests/terrain.test.ts`,
`spellPreparationSystem.test.ts`, `classLeveling.test.ts`, `progression.test.ts`,
`building.test.ts`, `campaign.test.ts`, `initiativeSystem.test.ts`.

**Docs**: `CLAUDE.md`, `README.md`, `package.json`,
`PHASE_12_MULTIPLAYER_FEASIBILITY.md`, `CAMPAIGN_STORY_DESIGN.md`,
`SOURCE_OF_TRUTH.md`, `FIREBASE_SETUP.md`, `ASSET_PLAN.md`,
`PARTY_CREATION_OVERHAUL_PLAN.md`, `DECISIONS.md` (D-254/D-255 appended,
plus the approved cross-reference/duplicate-removal edits), `KNOWN_ISSUES.md`
(KI-202 added, plus the approved corrections), `CHANGELOG.md` (new
`[Unreleased]` section, on top), `PROJECT_STATUS.md` (new section added on
top, plus the approved fixes), this file (fully rewritten).

## Handoff package contents

- [x] Source files (see git steps above)
- [x] package.json / package-lock.json (package.json's `description` field
      updated; no dependency changes)
- [x] README.md (substantially rewritten — was badly stale)
- [x] DECISIONS.md (updated — D-254/D-255 appended, plus approved edits to
      D-097/D-136/D-193/D-213)
- [x] KNOWN_ISSUES.md (updated — KI-202 added, plus approved corrections to
      KI-098/KI-111/KI-115/KI-190)
- [x] CHANGELOG.md (updated — new `[Unreleased]` section, on top)
- [x] CONTENT_SOURCES.md (unchanged — no new content this session)
- [x] ASSET_PLAN.md (updated — added the missing portrait-manifest system)
- [x] SOURCE_OF_TRUTH.md (updated — corrected a stale repo-note)
- [x] FIREBASE_SETUP.md (updated — corrected stale "not yet done" framing)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (updated — corrected stale banner)
- [x] CAMPAIGN_STORY_DESIGN.md (updated — corrected stale banner + a stale
      line citation)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (updated — added status banner)
- [x] CAMPAIGN_ECONOMY_REDESIGN_PLAN.md (unchanged)
- [x] PLAYTEST_2026-09-09_BATCHES.md (unchanged — already accurate)
- [x] PROJECT_STATUS.md (updated — new section added on top, plus approved
      fixes to older sections)
- [x] CLAUDE.md (updated — corrected stale phase/version/git-repo framing)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1868** (-4 net from D-255's removals, +2 from D-254 — see
      DECISIONS.md for the exact count)
- [x] No node_modules, dist, secrets, or service-account credentials
