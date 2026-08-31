# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-211**: four
  Character Creation spacing/text fixes (all **confirmed working** by
  Kevin after deploy), plus a still-unresolved hero-name-field positioning
  bug — two fix attempts both confirmed unsuccessful, and a diagnostic
  panel rebuilt once already (the first version was too small to read) now
  waiting on Kevin's next screenshot. This is a standalone fix session,
  not part of any phased gameplan — the 2026-08-28 playtest batch (Phases
  1-5, D-203 through D-210) closed three sessions ago with no pre-set next
  task.
- **Date:** August 31, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1643** (unchanged from last handoff — presentation-only change,
  no new pure-system logic, no new test file). Typecheck clean, all 1643
  pass, production build succeeds (**152 modules**, unchanged — no new
  file, only edits to `CharacterCreationScene.ts`, `CoopLobbyScene.ts`, and
  `uiTheme.ts`).

## IMPORTANT — one open bug, needs Kevin's next screenshot before anything else

The hero-name-field positioning bug ("names are way out of place," an old
playtest note never fixed until this session tried) is **still broken
after two fix attempts**, both deployed and confirmed unsuccessful by
Kevin:

1. A runtime-desync guess (`this.scale.refresh()` alone) — Kevin corrected
   this directly: the fields don't drift, they start wrong immediately.
2. A source-verified DOM-container-margin fix (`fixDomContainerAlignment()`
   in `uiTheme.ts`, reasoned from reading Phaser's own `ScaleManager.js`) —
   deployed, and Kevin confirmed it had **no visible effect** at all.

A first diagnostic attempt (a tiny 10px on-screen text line) was also
deployed and turned out **unreadable** — but Kevin's attempt to
browser-zoom in to read it surfaced a genuinely useful clue anyway: **the
canvas content doesn't visibly resize with browser zoom at all, but the
hero-name `<input>` fields DO shift with it** (up-left when zooming in,
down-right when zooming out). That means `domContainer`'s real screen
position isn't staying synced to the canvas across a zoom/resize event,
even with `fixDomContainerAlignment` registered to reapply on every
resize.

The diagnostic has been rebuilt — search `CharacterCreationScene.ts` for
`"D-211 TEMP DIAGNOSTIC"` to find it (`domDebugBg`/`domDebugText` fields,
`update()`, `updateDomDebugText()`). It's now a large, always-current,
readable panel (white text on a black backing box, near the top of the
screen, hard to miss) that updates every frame and includes
`window.innerWidth/innerHeight`, `devicePixelRatio`, and
`visualViewport.scale` alongside the canvas/domContainer/first-input
rects — no zooming needed to read it this time. **The next chat's first
move should be getting a fresh screenshot from Kevin (once this session's
work is deployed) with that panel visible**, and diagnosing from those
real numbers instead of theorizing further. Remove the whole diagnostic
(both fields, `update()`, `updateDomDebugText()`) once the real bug is
found and confirmed fixed — none of it is meant to ship.

## Why this task, and the false-alarm mid-session

Kevin sent a screenshot of "Build Your Party" flagging three things: the
hero-name fields "still awful"/"out of place," general "poor spacing"
naming the Standard Array row specifically, and confusion about the
"unspent Background ability bonus" message.

A follow-up screenshot mid-session, meant to check the first name-field
fix attempt, turned out to be from the **deployed site** — none of this
session's work had been committed/pushed yet at that point, so it
couldn't have reflected anything just-built. That screenshot did surface a
real, separate, pre-existing bug though (see below) — genuinely useful
despite the false alarm about "made it worse."

## What happened this session (D-211)

**Confirmed working, after Kevin deployed and checked:**
1. Fixed a real 12px overlap between the Standard Array/Point Buy pill and
   the Background/Ability-Bonus row above it (D-206 added that row without
   adjusting the pill's position) — `abilityMethodHandle`'s `y` (280→300),
   `pointsLeftY` (302→324).
2. Widened `bgRowGap` (6px→10px) — the Background/Ability-Bonus buttons'
   borders were reading as a stray vertical line between the two labels.
3. Clarified the ability-bonus validation message to name the actual
   control: *"Hero N still needs to pick an Ability Bonus (the button next
   to Background)."*
4. Fixed a second, independently-discovered bug: `buildBottomControls`'s
   "Team Level" button (`y=840`) fully covered the per-column "Save
   Character/Load Character" row (`libraryY=832`, bottom edge 848) by a
   proven 30px, broken since D-206. Shifted the whole shared bottom
   control block down, unevenly — the buttons (Team Level/Party Size/
   Difficulty/Start Battle/Save Party) move the full +38px needed, while
   the save-status line and validation text below absorb less (+28/+20),
   preserving ~15px of clearance above the screen's outer frame (this
   exact frame-adjacent zone broke once before — see KI-141/D-159 — so a
   uniform +38px shift, which would have left only ~5px, was avoided;
   asked Kevin directly before shipping the tighter option).

**Attempted twice, still broken — see the IMPORTANT callout above:**
5. Hero-name-field positioning. A diagnostic panel is now in place at the
   end of `CharacterCreationScene.create()`, rebuilt once already after
   the first version proved unreadable.

## Important files

- `src/game/scenes/uiTheme.ts` — `fixDomContainerAlignment()` (deployed,
  confirmed NOT to have fixed the bug — do not assume it works).
- `src/game/scenes/CharacterCreationScene.ts` — `create()`'s
  `scale.refresh()`/`fixDomContainerAlignment()`/`onViewportResize()`
  calls, `abilityMethodHandle`'s `y`, `pointsLeftY`, `bgRowGap`, the
  unspent-background status message, `buildBottomControls`'/
  `buildStartButton`'s Y-coordinate shifts, and the "D-211 TEMP
  DIAGNOSTIC"-tagged `domDebugBg`/`domDebugText` fields, `update()`, and
  `updateDomDebugText()` (temporary — remove once the name-field bug is
  fixed).
- `src/game/scenes/CoopLobbyScene.ts` — the same `fixDomContainerAlignment`
  calls (untested — its join-code field likely has the same still-open
  bug, unconfirmed either way; no diagnostic panel added there).
- `DECISIONS.md` — D-211 (four same-session amendments, in order: the
  Team-Level discovery, "still broken" update, the zoom-clue update).
- `KNOWN_ISSUES.md` — KI-161 (full confirmation checklist; the name-field
  bullet explains the zoom clue and asks for the new panel's screenshot).
- `CHANGELOG.md` — new `[Unreleased]` section, split into "Fixed,
  confirmed" and "Still broken" so it's not overstated.
- `PROJECT_STATUS.md` — new top section, same honest split.
- `PHASE_HANDOFF.md` — this file, fully rewritten.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1643/1643** passing.
- `npm run build` — production build succeeds, **152 modules** (unchanged).

## Manual tests completed

Kevin deployed and checked "Build Your Party" directly (not this
environment's own testing — no browser available here). Confirmed: the
Standard Array/Background-gap/validation-message fixes and the Team-Level
overlap fix all work correctly. Confirmed NOT working: the hero-name-field
positioning fix, twice. His own zoom experiment (see IMPORTANT callout)
supplied the most useful data point so far. See the IMPORTANT callout
above for what's needed next.

## Known issues

- **KI-161** (D-211, this session): the Team-Level/spacing fixes are
  confirmed done; the hero-name-field bug is STILL OPEN after two fix
  attempts — needs the new diagnostic panel's screenshot before a third
  attempt.
- **KI-160** (D-210), **KI-159** (D-209), **KI-158** (D-208), **KI-157**
  (D-207), **KI-156** (D-206), **KI-155** (D-205), **KI-154** (D-204),
  **KI-153** (D-203) — the entire 2026-08-28 playtest batch — still need
  confirmation, unchanged since last handoff.
- **KI-152**, **KI-151** and every KI-141-through-KI-150 group remain
  unconfirmed from prior sessions, unchanged.
- Every pre-existing "Still need Kevin's playtest confirmation" item
  (KI-090 through KI-140) is unchanged.
- **KI-063** (Phase 12.3): still the standing limitation that two coop
  clients' boards don't converge as either acts — unaffected by this
  session, still open.

## Deferred items

- **The hero-name-field bug — do not attempt a third blind fix.** Read the
  diagnostic panel's numbers from Kevin's next screenshot first (see
  IMPORTANT callout). Things worth checking once the numbers are in hand:
  - Does `domContainer rect` actually match `canvas rect` (same L/T/W/H)?
    If NOT, `fixDomContainerAlignment`'s own margin math has a bug — work
    it out directly from the dumped numbers rather than re-deriving it
    from Phaser's source again.
  - If `domContainer rect` DOES match `canvas rect` but `nameInput[0] rect`
    is still wrong, the bug is in how Phaser positions the INDIVIDUAL DOM
    element within the (correctly-positioned) container —
    `DOMElementCSSRenderer.js`'s per-element `transform` math, which uses
    `src.x`/`src.y`/`src.width`/`src.height`. Worth checking whether
    `updateSize()` ran (and got a correct answer) before the transform was
    computed for a freshly `createFromHTML`'d element.
  - Kevin's zoom clue (canvas visually static under browser zoom, DOM
    content visibly shifts) suggests whatever's wrong is specifically
    about staying in sync across a `resize`/zoom event, not just the
    initial value — check whether `visualViewport.scale` correlates with
    the size of the domContainer/canvas mismatch across different zoom
    levels in the screenshots, if more than one comes in.
- Re-chasing KI-152's repro — still nothing concrete to investigate.
- The coop equip-mode ownership gate (D-208's flagged gap) — Kevin has
  already given a direction for it (own-characters-only shop/equip/sell,
  view-only on a teammate's), but building the actual gate is still
  untouched; see `project_coop_gear_ownership_design.md` (memory) or
  D-209's own handoff history if resuming this in a future session.
- Extending the wood/bronze/gilt theme to the parts of `BattleScene`
  explicitly left out of D-210's scope (title text, debug/info text,
  full-screen modal overlays) — not requested, no mockup covered them.
- The per-column content (Gear/Pool through Save/Load Character) appears
  to extend roughly 60px past the parchment panel's own drawn background
  (`drawParchmentPanel`, height 680 centered at y=445, bottom edge 785) —
  noticed while investigating the Team-Level overlap but NOT fixed this
  session (out of the scope Kevin actually asked about). Kevin's own
  recent screenshots show no obvious visible seam there, so may be a
  non-issue in practice — worth a glance next time this screen comes up,
  not urgent.

## Next chat instructions

1. **Get the diagnostic panel's screenshot first** — see the IMPORTANT
   callout at the top of this file. Don't propose a third name-field fix
   without the real numbers from it.
2. **Remind Kevin to commit + push this session's latest work** via
   GitHub Desktop if he hasn't already, and confirm the GitHub Actions
   deploy finished before trusting any new screenshot.
3. Once the name-field bug is actually fixed and confirmed, **remove the
   entire "D-211 TEMP DIAGNOSTIC"-tagged code** from
   `CharacterCreationScene.ts` (`domDebugBg`/`domDebugText` fields,
   `update()`, `updateDomDebugText()`, and their creation in `create()`) —
   none of it is meant to ship.
4. **No other pre-set next task remains** beyond the above — this was a
   standalone fix session. Ask Kevin what's next, or check
   `KNOWN_ISSUES.md`/`SOURCE_OF_TRUTH.md` for open items if he has no
   specific request.
5. **Backlog, explicitly deferred by Kevin:** BG3-style roll viewer and
   Bestiary enemy images — both "after artwork is added."
6. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-212**/**KI-162**).
7. **If the coop equip-mode ownership gate is ever built**, the direction
   is already agreed with Kevin — don't re-litigate it (see "Deferred
   items" above).

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/scenes/CharacterCreationScene.ts`,
`src/game/scenes/CoopLobbyScene.ts`, `src/game/scenes/uiTheme.ts`,
`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`,
this file. No new files. No Firebase-relevant change. Commit and push this
latest round (the rebuilt diagnostic panel) so the next screenshot
reflects it.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-211 appended, amended three more times
      same session)
- [x] KNOWN_ISSUES.md (updated — KI-161 added, revised twice)
- [x] CHANGELOG.md (updated — new Unreleased section for D-211, revised
      twice)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — new D-211 section on top, revised
      twice)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1643** (unchanged)
- [x] No node_modules, dist, secrets, or service-account credentials
