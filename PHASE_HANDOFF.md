# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-211**: four
  Character Creation spacing/text fixes (all **confirmed working** by
  Kevin after deploy), plus two failed attempts at a long-standing
  hero-name-field positioning bug and a temporary on-screen diagnostic now
  waiting on real numbers from Kevin's browser. This is a standalone fix
  session, not part of any phased gameplan — the 2026-08-28 playtest batch
  (Phases 1-5, D-203 through D-210) closed two sessions ago with no
  pre-set next task.
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
after two attempts**, both deployed and confirmed unsuccessful by Kevin:

1. A runtime-desync guess (`this.scale.refresh()` alone) — Kevin corrected
   this directly: the fields don't drift, they start wrong immediately.
2. A source-verified DOM-container-margin fix (`fixDomContainerAlignment()`
   in `uiTheme.ts`, reasoned from reading Phaser's own `ScaleManager.js`) —
   deployed, and Kevin confirmed it had **no visible effect** at all.

Rather than guess a third mechanism blind, this session added a
**temporary on-screen diagnostic** — search `CharacterCreationScene.ts`
for `"D-211 TEMP DIAGNOSTIC"` to find it. It's a small magenta text line
at the very bottom of the "Build Your Party" screen that dumps the real,
measured `getBoundingClientRect()` position of the canvas, the DOM
container, and the first hero-name `<input>`, plus the DOM container's
actual `margin`/`transform` CSS values. **The next chat's first move
should be getting a fresh screenshot from Kevin (once this session's work
is deployed) that includes that bottom line of text**, and diagnosing from
those real numbers instead of theorizing further. Remove the diagnostic
text once the real bug is found and fixed — it's not meant to ship.

## Why this task, and the false-alarm mid-session

Kevin sent a screenshot of "Build Your Party" flagging three things: the
hero-name fields "still awful"/"out of place," general "poor spacing"
naming the Standard Array row specifically, and confusion about the
"unspent Background ability bonus" message.

A follow-up screenshot mid-session, meant to check the first name-field
fix attempt, turned out to be from the **deployed site** — none of this
session's work had been committed/pushed yet at that point, so it couldn't
have reflected anything just-built. That screenshot did surface a real,
separate, pre-existing bug though (see below) — genuinely useful despite
the false alarm about "made it worse."

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

**Attempted twice, still broken:**
5. Hero-name-field positioning — see the IMPORTANT callout above for the
   full story. A temporary diagnostic is now in place at the end of
   `CharacterCreationScene.create()`.

## Important files

- `src/game/scenes/uiTheme.ts` — `fixDomContainerAlignment()` (deployed,
  confirmed NOT to have fixed the bug — do not assume it works).
- `src/game/scenes/CharacterCreationScene.ts` — `create()`'s
  `scale.refresh()`/`fixDomContainerAlignment()`/`onViewportResize()`
  calls, `abilityMethodHandle`'s `y`, `pointsLeftY`, `bgRowGap`, the
  unspent-background status message, `buildBottomControls`'/
  `buildStartButton`'s Y-coordinate shifts, and the "D-211 TEMP
  DIAGNOSTIC" debug text at the end of `create()` (temporary — remove once
  the name-field bug is fixed).
- `src/game/scenes/CoopLobbyScene.ts` — the same `fixDomContainerAlignment`
  calls (untested — its join-code field likely has the same still-open
  bug, unconfirmed either way).
- `DECISIONS.md` — D-211 (three same-session amendments, in order: the
  Team-Level discovery, the "still broken, added diagnostic" update).
- `KNOWN_ISSUES.md` — KI-161 (full confirmation checklist; the name-field
  bullet now asks for the diagnostic screenshot specifically).
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
positioning fix. See the IMPORTANT callout above for what's needed next.

## Known issues

- **KI-161** (D-211, this session): the Team-Level/spacing fixes are
  confirmed done; the hero-name-field bug is STILL OPEN after two attempts
  — needs the diagnostic screenshot described above before a third attempt.
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
  diagnostic numbers from Kevin's next screenshot first (see IMPORTANT
  callout). If the numbers show `domContainer`'s rect now correctly
  matches the canvas's rect (i.e. `fixDomContainerAlignment` DID work at
  the container level) but the individual `input0` rect is still wrong,
  the bug is in how Phaser positions the INDIVIDUAL DOM element within the
  container (`DOMElementCSSRenderer.js`'s per-element `transform` math,
  using `src.x`/`src.y`/`src.width`/`src.height` — worth checking whether
  `updateSize()` ran before the transform was computed, or whether
  `src.width`/`src.height` are ever wrong for a freshly `createFromHTML`'d
  element). If domContainer's rect is STILL wrong despite the fix, the fix
  itself has a bug — re-derive the margin math from the dumped numbers
  directly rather than re-deriving it from Phaser's source again.
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
  session (out of the scope Kevin actually asked about, and unclear
  without a browser whether it's visually noticeable). Worth a look next
  time this screen comes up, though Kevin's own recent screenshots show no
  obvious visible seam there, so may be a non-issue in practice.

## Next chat instructions

1. **Get the diagnostic screenshot first** — see the IMPORTANT callout at
   the top of this file. Don't propose a third name-field fix without the
   real numbers.
2. **Remind Kevin to commit + push this session's work** via GitHub
   Desktop if he hasn't already, and confirm the GitHub Actions deploy
   finished before trusting any new screenshot.
3. Once the name-field bug is actually fixed and confirmed, **remove the
   "D-211 TEMP DIAGNOSTIC" text block** from `CharacterCreationScene.ts` —
   it's debug-only, not meant to ship.
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
latest round (the diagnostic text) so the next screenshot reflects it.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-211 appended, amended twice more same
      session)
- [x] KNOWN_ISSUES.md (updated — KI-161 added, revised)
- [x] CHANGELOG.md (updated — new Unreleased section for D-211, revised)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — new D-211 section on top, revised)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1643** (unchanged)
- [x] No node_modules, dist, secrets, or service-account credentials
