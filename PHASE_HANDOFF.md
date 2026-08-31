# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session addressed a single piece
  of feedback: Kevin sent two screenshots — the interactive HTML mockup he
  was originally shown for The Armory, and what the shipped game actually
  looks like — and said "you're wrong about the armory... I hate it."
  `GearShopScene.ts` (D-209) was rebuilt to match the mockup's layout as
  **D-216**. Not yet played by Kevin — headless-verified only.
- **Date:** August 31, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1643** (unchanged — this file has no game-rule logic, so no test
  file covers it). Typecheck clean, all 1643 pass, production build
  succeeds (**152 modules**, unchanged — 1 existing file edited, no new
  files).

## D-216 — what happened this session

Comparing the two screenshots against the actual `GearShopScene.ts` code
made the drift concrete: the shipped version put all 4 heroes' full 12-slot
paperdolls in a row across the top of the screen (`buildHeroRail`), then a
*second*, redundant full-width row of 12 slot-filter chips repeating the
same slot labels again (`buildSlotChips`), leaving the catalog squeezed
into a small, paginated 6-item strip at the bottom. The approved mockup
instead used a narrow vertical hero sidebar (compact, color-coded, no item
text per cell) and gave the catalog a whole wide dedicated panel — a much
bigger structural difference than a color or spacing tweak.

Rebuilt to match:
- `buildHeroRail`/`buildSlotChips` → replaced by `buildHeroSidebar`
  (300px-wide vertical hero list, 6x2 paperdoll of colored/bordered cells
  only — gold border = the slot being shopped for, tan = occupied, dark =
  empty; item detail moved to the compare strip instead of being crammed
  into tiny cells), `buildShopHeader` ("Shopping for {hero} — {slot}"), and
  `buildSlotTabs` (ONE shared row of slot tabs, wrapping to 2 rows, not
  duplicated per hero).
- `buildCompareStrip`/`buildCatalog` reparented onto a `(contentX,
  contentWidth)` pair so they only occupy the right-hand shopping panel,
  not the full screen width.
- `CATALOG_PAGE_SIZE` raised from 6 to 9 — the freed-up vertical space
  (heroes no longer eat a full-width row) went straight to the catalog.
- No change to `buildActionButton`, the Purchase/Compare/Sell
  arm-then-confirm mechanic, or any `BattleScene` read/mutation call — this
  was a pure presentation rework of one already-isolated scene.

See `DECISIONS.md` D-216 for the full writeup.

## Important files

- `src/game/scenes/GearShopScene.ts` — the only file touched. Layout rework
  only; every `BattleScene` call site (`shopHeroes`/`shopVisibleItemIds`/
  `goldFor`/`buyGearForHero`/`sellGearFromHero`/`buyPotionForHero`/
  `sellPotionFromHero`) is untouched.
- `DECISIONS.md` — D-216 (new).
- `KNOWN_ISSUES.md` — KI-166 (new, full confirmation checklist).
- `CHANGELOG.md` — one new `[Unreleased]` section, on top.
- `PROJECT_STATUS.md` — one new section, on top.
- `PHASE_HANDOFF.md` — this file, fully rewritten.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1643/1643** passing (unchanged).
- `npm run build` — production build succeeds, **152 modules** (unchanged).

## Manual tests completed

None — no browser available in this environment. This is a layout-only
change to a scene with zero game-rule logic, but the whole point was a
visual/structural fix, so a real look matters more than the usual
"headless-verified" caveat implies. See `KNOWN_ISSUES.md` KI-166 for the
full confirmation checklist.

## Known issues

- **KI-166** (new this session) — not played yet; see checklist above.
- **KI-165** (D-215), **KI-164** (D-214), **KI-163** (D-213) — still need
  Kevin's confirmation, unchanged since last handoff. KI-163's item 14
  (the reported freeze) is still unconfirmed as fixed — still needs a
  DevTools-console repro if it recurs.
- **KI-162** (D-212) — still needs Kevin's confirmation, unchanged.
- **KI-161** (D-211) — **RESOLVED**, confirmed by Kevin.
- **KI-160** (D-210) through **KI-153** (D-203) — the entire 2026-08-28
  playtest batch — still need confirmation, unchanged. Still the oldest
  unconfirmed batch in the project.
- **KI-152** and every KI-090-through-KI-151 group remain unconfirmed from
  prior sessions, unchanged.
- **KI-063** (Phase 12.3): still the standing limitation that two coop
  clients' boards don't converge as either acts — unaffected by this
  session, still open.

## Deferred items

- Extracting a shared paperdoll-cell drawing helper into `uiTheme.ts` —
  `GearShopScene`'s sidebar cells and `CharacterCreationScene`'s own D-214
  paperdoll both hand-roll the same colored-cell-grid pattern now; still not
  worth the risk/effort of a shared abstraction across two independently
  works-fine screens, per the same reasoning D-214 gave for skipping it.
- A hover tooltip on the sidebar's slot cells (since they no longer show
  the occupant's item name) — judged unnecessary since the compare strip
  already shows full detail for whatever slot is active, but worth
  revisiting if Kevin finds the color-only cells unclear in practice.
- The coop equip-mode ownership gate (D-208's flagged gap) — still
  untouched; direction already agreed with Kevin, see
  `project_coop_gear_ownership_design` (memory) or D-209's handoff history.
- `CoopLobbyScene`'s join-code DOM `<input>` positioning (KI-062's own gap)
  — still open, unrelated to this session.
- Re-chasing KI-152's repro and KI-163's item-14 freeze repro — still
  nothing concrete to investigate on either.

## Next chat instructions

1. **Get Kevin's confirmation on D-216 first** — this was his most recent,
   most pointed complaint ("I hate it"), so a real look at the new Armory
   layout against the mockup should come before anything else.
2. After that, the priority order from the prior handoff still holds:
   D-214 (Character Creation's Gear picker) if not yet confirmed, then
   D-213 (especially item 14's freeze — ask for a DevTools-console repro if
   it happens again), then D-215 (the 7-scene reskin).
3. Once D-213 through D-216 are all confirmed, the oldest still-unconfirmed
   work is the 2026-08-28 playtest batch (KI-153 through KI-160) if Kevin
   has no specific new request.
4. **Backlog, explicitly deferred by Kevin:** BG3-style roll viewer and
   Bestiary enemy images — both "after artwork is added."
5. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-217**/**KI-167**).
6. Reminder for the standard workflow: Kevin manages Git via GitHub Desktop
   and deploys via GitHub Actions on push to `main` — a screenshot he sends
   might be from a stale deployed build if recent work hasn't been pushed
   yet. (This session's mockup-vs-shipped complaint was a case in point:
   the shipped code hadn't matched the mockup since it was first built, not
   a case of stale deployment — worth ruling either out early next time a
   "doesn't match what I was shown" report comes in.)

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/scenes/GearShopScene.ts`, `DECISIONS.md`,
`KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`, this file. No new
files. No Firebase-relevant change. None of this session's work is
deployed/confirmed yet — needs a push before Kevin can check it.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-216 appended)
- [x] KNOWN_ISSUES.md (updated — KI-166 added)
- [x] CHANGELOG.md (updated — one new `[Unreleased]` section, on top)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — one new section, on top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1643** (unchanged)
- [x] No node_modules, dist, secrets, or service-account credentials
