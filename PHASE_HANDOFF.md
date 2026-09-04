# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged.
- **Date:** September 4, 2026.
- **Why this handoff exists**: this session closed the LAST two pieces of
  Kevin's original 10-item playtest list from the 2026-09-03/04 mid-batch
  handoff — item 6 (scrollable lists) and item 7 (weapon proficiency), both
  explicitly requested together ("we need to do items 6 and 7 now"). The
  entire 10-item list is now DONE. See `PROJECT_STATUS.md`'s top section and
  `DECISIONS.md` D-234/D-235 for the full writeups.
- Tests: **1795** (was 1739 at the start of this session — 24 new in
  `tests/scrollListMath.test.ts`, 30 new in `tests/proficiencySystem.test.ts`,
  2 more added to `tests/gearFilterSystem.test.ts`). Typecheck clean, all
  1795 pass, production build succeeds (**162 modules**, up from 158 — 4 new
  files: `ScrollListMath.ts`, `uiScrollList.ts`, `proficiencies.ts`,
  `ProficiencySystem.ts`). `npm run dev` + an HTTP check confirms the server
  boots (twice, once per item).
- Next available: **D-236** / **KI-185**.

## Kevin's original 10-item list — ALL DONE, for reference only

1. ~~Campaign combat trivially easy~~ — DONE, D-229.
2. Gear tab: word labels instead of icons — Kevin's own words: "doesn't
   really matter right now" until art is uploaded. Still explicitly
   deferred, not started, not planned until art exists. The ONE item on
   this list that's still open, by Kevin's own choice.
3. ~~Consolidate Potion 1/Potion 2~~ — DONE, D-231.
4. ~~Same for Rings~~ — DONE, D-231.
5. ~~Same for Right/Left hand, plus an extra layer~~ — DONE, D-231/D-233.
6. ~~Scrollable tables instead of pagination, everywhere except the
   Compendium~~ — DONE this session, D-234.
7. ~~Is there a weapon-proficiency system? If so, auto-filter out items a
   class can't use~~ — DONE this session, D-235.
8. ~~Add missing spellcasting focus items~~ — DONE, D-232.
9. ~~Campaign victory screen was a dead end~~ — DONE, D-230.
10. ~~The recurring "start a 2nd game" freeze bug~~ — fixes shipped D-228,
    still **UNCONFIRMED** without a browser (see "Known issues" below —
    this is the one item on this list with any real doubt left).

## What shipped this session (D-234, D-235)

### D-234 — item 6, scrollable lists (KI-183)

New pure math `src/game/systems/ScrollListMath.ts` (`cumulativeOffsets`,
`contentHeight`, `clampScrollOffset`, `visibleRowRange`,
`scrollOffsetToReveal`, `scrollbarThumbMetrics`/`scrollOffsetForThumbY`) —
works over an array of PER-ROW heights, not one fixed height, so it serves
both the 4 uniform-row consumers and `BestiaryScene`'s genuinely variable-
height wrapped entries with one module. New Phaser glue
`src/game/scenes/uiScrollList.ts` (`renderScrollListRows`,
`renderScrollbarVisual`, `attachWheelScroll`, `createViewportMask`) —
matches the codebase's existing "destroy and redraw everything on refresh"
convention; `attachWheelScroll` is registered exactly ONCE per scene, in
`create()`, confirmed safe against Phaser's own `InputPlugin.shutdown()`
source (`removeAllListeners()` on every scene shutdown) so it never stacks
duplicate handlers across a reused scene instance's restarts.

Applied to all 5 targets: `GearShopScene` catalog, `CharacterCreationScene`
gear picker, `BattleScene`'s spellbook picker AND its in-battle Build/Test-
Mode item grid (the one consumer keeping the old persistent-buttons-with-
visibility-toggle idiom instead of destroy/rebuild — buttons reposition via
`visibleRowRange` instead of toggling by page), and `BestiaryScene` (the one
structural change — one `Text` object per entry instead of a joined page
blob, created up front purely to measure real wrapped height before laying
out scroll offsets). `CompendiumScene` untouched — Kevin's explicit
exception. No Prev/Next buttons or "Page N/M" labels survive anywhere.

### D-235 — item 7, weapon proficiency (KI-184)

New data `src/game/data/proficiencies.ts` (`WEAPON_PROFICIENCIES`) and new
pure system `src/game/systems/ProficiencySystem.ts`
(`isProficientWithHandsItem`). Real SRD 5.2.1 weapon-proficiency-per-class
data, **verified during implementation directly from a 2024-SRD mirror, not
assumed from memory** — every class gets Simple weapons (universal, not a
variable); full Martial for Barbarian/Fighter/Paladin/Ranger; none for
Bard/Cleric/Druid/Sorcerer/Warlock/Wizard; Monk gets martial weapons with
Light, Rogue gets martial weapons with Finesse OR Light. `spellFociAllowed`
is derived from `getClassDefinition(id).spellcasting !== undefined` rather
than stored, avoiding a second source of truth.

Wired into `GearFilterSystem.ts`'s `CatalogFilters`
(`proficiencyClassId: string | null`, same "off unless it's the Hands tab"
guard the D-233 filters already use) and both `GearShopScene.buildCatalog`
and `CharacterCreationScene.refreshGearPicker` — non-proficient Hands items
fully hide, with a one-line "N hidden — not proficient" footer.

**Found during sourcing, not assumed**: the prior handoff's note to source
"SRD 5.1" for this was a slip — this project's weapon catalogue
(`weapons.ts`) and class features (`classes.ts`) are both already SRD
5.2.1, and proficiency has to match the table it's gating. Also, the
handoff's claim that Wizard/Sorcerer have named weapon exceptions (dagger/
dart/sling/quarterstaff/light crossbow) turned out to be moot either way —
every one of those is already a Simple weapon, so it was always redundant
with blanket simple-weapon proficiency.

## Deliberate scope decisions made this session (flag these to Kevin, don't silently assume he agrees)

1. **Cleric (Divine Order → Protector) and Druid (Primal Order → Warden)
   don't get their real SRD optional level-1 choice to trade Simple-only
   for full Martial proficiency.** `classes.ts` never modeled Divine Order/
   Primal Order at all (only Divine Domain, a different level-1 choice) —
   building that choice mechanic was out of scope for a proficiency FILTER
   pass. Both classes are modeled at their base (Simple-only) line.
2. **`BattleScene`'s in-battle shop grid still sells everything regardless
   of proficiency.** The original ask specifically cited "the Hands tab"
   (Armory) and `CharacterCreationScene`'s existing hide-pattern — the in-
   battle shop wasn't part of that. This is a real, user-visible
   inconsistency (Armory enforces it, in-battle doesn't) worth knowing
   about even though it wasn't asked for.
3. **Item 6's viewport height is now FIXED** (a constant number of visible
   rows/grid-rows, e.g. 9 for the Armory catalog) regardless of how short a
   filtered list is — matches how pagination already behaved for the
   longest lists, but a short list (e.g. a Legendary-tier Bestiary tab) now
   leaves visible empty space below it rather than shrinking the panel to
   fit. A deliberate simplification, not a bug.
4. **Item 2 (icons) still untouched** — still Kevin's own explicit "doesn't
   matter yet," unchanged from every prior handoff.

## What's NOT started

Nothing from Kevin's original list — item 6/7 were the last two pieces.
Item 2 (icons) remains explicitly DEFERRED (not "not started" — Kevin
already said it doesn't matter until art exists).

## Also still open (unchanged from prior handoffs, not part of the numbered list)

- `NAMELESS_THRONE_MAP` (the capstone) was never resized when the other 6
  regions got ~4x bigger (D-229) — not asked for, still just flagged.
- Hands consolidation in `CharacterCreationScene`'s gear picker — this was
  never about proficiency; item 5's Hands CONSOLIDATION (one filter instead
  of separate Weapon/Shield) stays Armory-only, deliberately, unchanged from
  D-231's original call. Item 7's proficiency filtering IS now in both
  places — don't confuse the two.
- The in-battle shop grid's proficiency gap (see "Deliberate scope
  decisions" #2 above) — the next natural follow-up if Kevin wants full
  consistency.

## Commands verified

- `npm run typecheck` — clean, after each of D-234 and D-235's pieces.
- `npm test -- --run` — **1795/1795** passing, after each piece.
- `npm run build` — production build succeeds, **162 modules**.
- `npm run dev` + an HTTP check (`Invoke-WebRequest` → 200) — confirmed
  after both D-234 and D-235.

## Manual tests completed

None — no browser available in this environment. See `KNOWN_ISSUES.md`
KI-183/KI-184 for the full click-through checklists (KI-183's touches 5
different scenes, worth budgeting real time for).

## Known issues

- **KI-183**, **KI-184** (new this session) — not played yet.
- **KI-182** through **KI-153** (prior sessions) — still need Kevin's
  confirmation, unchanged; KI-153 (2026-08-28 playtest batch) is still the
  oldest unconfirmed item in the project.
- **KI-177** (the recurring freeze bug) — two real fixes shipped (D-228,
  2026-09-03/04 session), root cause still genuinely unconfirmed. **If
  Kevin reports it's still happening, get the DevTools console output at
  the moment it occurs before doing anything else** — that's the one piece
  of information static analysis in this environment can't get. This still
  takes priority over anything else if it recurs.
- **KI-063** (Phase 12.3): coop boards still don't converge as either acts
  — unaffected by this session, still open.

## Deferred items

- Item 2 (gear slot icons) — Kevin's own explicit "doesn't matter yet." The
  only item left on the original 10-item list not fully closed.
- `NAMELESS_THRONE_MAP` resize — not asked for, flagged as a gap.
- Hands consolidation in `CharacterCreationScene` — deliberately Armory-
  only (a UI-consolidation decision, distinct from item 7's proficiency
  filtering, which IS in both places).
- In-battle shop grid proficiency gating — not asked for this pass, flagged
  as a real inconsistency.

## Next chat instructions

1. **Check `KNOWN_ISSUES.md` KI-153 through KI-184 first** for any
   "-Confirmed" annotation or repro note Kevin added directly (per this
   project's own convention — he records playtest findings there, not in
   chat). New playtest feedback takes priority over anything below.
2. **If KI-177 (the freeze bug) recurs**: get the DevTools console output
   from Kevin at the moment it happens before doing anything else.
3. **There is no pre-set next task.** Kevin's original 10-item list is
   fully closed (item 2 aside, by his own choice). The natural candidates
   if he wants more work without a new ask: (a) the in-battle shop grid's
   proficiency gap flagged above, (b) a real browser playtest pass across
   the large backlog of headless-verified-only items (KI-153 through
   KI-184 is a LOT of unconfirmed work stacked up at this point — worth
   raising directly with Kevin that a playtest pass may be overdue), or
   (c) whatever Kevin brings next. Ask rather than guess.
4. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-236**/**KI-185**).
5. Reminder for the standard workflow: Kevin manages Git via GitHub Desktop
   and deploys via GitHub Actions on push to `main` — none of this
   session's work is committed/deployed/confirmed yet, needs a push before
   Kevin can check any of it, including in a browser.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched:
`src/game/systems/ScrollListMath.ts` (new), `tests/scrollListMath.test.ts`
(new), `src/game/scenes/uiScrollList.ts` (new), `src/game/scenes/
GearShopScene.ts` (D-234 scroll conversion + D-235 proficiency wiring),
`src/game/scenes/CharacterCreationScene.ts` (same, both D-234 and D-235),
`src/game/scenes/BattleScene.ts` (D-234: spellbook + item grid scroll
conversion), `src/game/scenes/BestiaryScene.ts` (D-234: structural rewrite
to per-entry Text + scroll), `src/game/data/proficiencies.ts` (new),
`src/game/systems/ProficiencySystem.ts` (new),
`tests/proficiencySystem.test.ts` (new), `src/game/systems/
GearFilterSystem.ts` (D-235: `proficiencyClassId` field),
`tests/gearFilterSystem.test.ts` (D-235: 2 new tests), `DECISIONS.md`,
`KNOWN_ISSUES.md`, `CHANGELOG.md`, `CONTENT_SOURCES.md`,
`PROJECT_STATUS.md`, this file (all updated).

**4 new files this session**: `ScrollListMath.ts`, `uiScrollList.ts`,
`proficiencies.ts`, `ProficiencySystem.ts` (plus their 2 new test files).

## Handoff package contents

- [x] Source files (see "Important files"/git steps above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-234/D-235 appended)
- [x] KNOWN_ISSUES.md (updated — KI-183/KI-184 added)
- [x] CHANGELOG.md (updated — 2 new `[Unreleased]` sections, on top)
- [x] CONTENT_SOURCES.md (updated — 1 new row, the weapon-proficiency table)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — one new combined section, on top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1795** (was 1739 at the start of this session)
- [x] No node_modules, dist, secrets, or service-account credentials
