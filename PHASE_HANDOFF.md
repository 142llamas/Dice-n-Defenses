# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built and **fully
  closed** **D-211**: four Character Creation spacing/text fixes plus a
  long-standing hero-name-field positioning bug ("names are way out of
  place," never fixed by any prior session). Everything is confirmed
  working by Kevin on the deployed site. This was a standalone fix
  session, not part of any phased gameplan — the 2026-08-28 playtest batch
  (Phases 1-5, D-203 through D-210) closed three sessions ago with no
  pre-set next task, and still stands as the next thing to check if Kevin
  wants to keep playtesting.
- **Date:** August 31, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1643** (unchanged from last handoff — presentation-only change,
  no new pure-system logic, no new test file). Typecheck clean, all 1643
  pass, production build succeeds (**152 modules**, unchanged — no new
  file; edits only to `CharacterCreationScene.ts`, `CoopLobbyScene.ts`, and
  `uiTheme.ts`, and the temporary diagnostic code added mid-session was
  fully removed again before the session ended).

## Everything in this session is DONE — no loose thread to pick up on D-211 itself

Unlike most recent handoffs, there's no "needs Kevin's confirmation"
caveat left over from this one. All five items shipped this session are
confirmed working:

1. Standard Array/Point Buy pill no longer overlaps the Background/
   Ability-Bonus row above it.
2. The Background/Ability-Bonus row's gap no longer reads as a stray
   vertical line.
3. The ability-bonus validation message names the actual control to
   click.
4. "Team Level" no longer covers the "Save Character/Load Character" row.
5. The 4 hero-name `<input>` fields render inside their own column,
   confirmed by Kevin including after a zoom test.

See "What happened this session" below for the full story of item 5 in
particular — it took three attempts and is worth reading before touching
`fixDomContainerAlignment`/DOM-element positioning again in this project.

## What happened this session (D-211)

**Confirmed working throughout, no issues:**
1. Fixed a real 12px overlap between the Standard Array/Point Buy pill and
   the Background/Ability-Bonus row above it (D-206 added that row without
   adjusting the pill's position) — `abilityMethodHandle`'s `y` (280→300),
   `pointsLeftY` (302→324).
2. Widened `bgRowGap` (6px→10px).
3. Clarified the ability-bonus validation message to name the actual
   control.
4. Fixed a second, independently-discovered bug: `buildBottomControls`'s
   "Team Level" button (`y=840`) fully covered the per-column "Save
   Character/Load Character" row (`libraryY=832`, bottom edge 848) by a
   proven 30px, broken since D-206 (found while investigating a screenshot
   Kevin sent — from the DEPLOYED site, which turned out not to reflect
   this session's own work yet, a mid-session false alarm about "made it
   worse" that nonetheless surfaced this real, separate bug). Shifted the
   whole shared bottom control block down, unevenly, to preserve ~15px of
   clearance above the screen's outer frame (a uniform shift would have
   left only ~5px — this exact frame-adjacent zone broke once before, see
   KI-141/D-159, so this was checked with Kevin before shipping the
   tighter option).

**Took three attempts, now closed:**
5. Hero-name-field positioning. **Attempt 1** (wrong): assumed a runtime
   desync borrowed from D-162's canvas-squish finding, mitigated with
   `this.scale.refresh()` alone — Kevin corrected this directly: "the name
   plates don't drift, they just start in that position." **Attempt 2**
   (right formula, incomplete application): reading Phaser's own
   `ScaleManager.js` source found the real mechanism — Phaser keeps its
   DOM element container aligned with the canvas by copying the canvas's
   CSS margin onto it, which only works when Phaser itself centers the
   canvas; this project centers via an external CSS flexbox instead, so
   that margin is always empty. Built `fixDomContainerAlignment()`
   (`uiTheme.ts`), applied once at `create()` plus on resize events —
   deployed, Kevin confirmed **no visible effect**. A diagnostic panel
   (rebuilt once after a too-small first version — Kevin's attempt to
   browser-zoom in to read it revealed canvas content doesn't visibly
   resize with zoom while DOM content does, itself a useful clue) then
   supplied real numbers: `canvas rect L467 T70 W1200 H1012` vs
   `domContainer rect L447 T-17 W1200 H1012` — same size (the fix's scale
   math was always right), offset 20px left/87px up, with a genuinely
   nonzero PARTIAL correction already applied. This proved the fix's
   correction FORMULA was correct — it just went stale against live
   browser zoom/resize churn. **Attempt 3** (the fix): `fixDomContainerAlignment`
   now reruns every single frame (`update()`, both `CharacterCreationScene`
   and `CoopLobbyScene`) instead of relying on event timing —
   self-healing regardless of what causes the drift. Deployed, and Kevin
   confirmed the fields are now correctly aligned. The temporary
   diagnostic panel (`domDebugBg`/`domDebugText`/`updateDomDebugText()`)
   was removed once confirmed; `update()`'s `fixDomContainerAlignment`
   call itself stayed as the permanent fix.

Also confirmed, not a bug: the game's apparent on-screen size doesn't
change with browser zoom at all — expected under `Scale.FIT` (the canvas
always resizes to exactly fill the available space regardless of what
triggered the resize, zoom included).

## Important files

- `src/game/scenes/uiTheme.ts` — `fixDomContainerAlignment()` (the
  correction formula, unchanged since attempt 2 — only its call frequency
  needed to change in attempt 3).
- `src/game/scenes/CharacterCreationScene.ts` — `create()`'s
  `scale.refresh()`/`fixDomContainerAlignment()`/`onViewportResize()`
  calls, `abilityMethodHandle`'s `y`, `pointsLeftY`, `bgRowGap`, the
  unspent-background status message, `buildBottomControls`'/
  `buildStartButton`'s Y-coordinate shifts, and `update()` (now permanent —
  calls `fixDomContainerAlignment` every frame; no diagnostic code remains).
- `src/game/scenes/CoopLobbyScene.ts` — the same `create()` calls plus a
  permanent `update()` calling `fixDomContainerAlignment` every frame
  (its join-code field is presumed fixed by the same mechanism — not
  independently confirmed by Kevin, since he was checking Character
  Creation specifically).
- `DECISIONS.md` — D-211 (six same-session amendments — read them in order
  for the full "wrong guess → source-verified-but-incomplete fix →
  diagnostic → real fix" arc if this class of bug ever recurs).
- `KNOWN_ISSUES.md` — KI-161, now marked **RESOLVED, confirmed by Kevin**.
- `CHANGELOG.md` — `[Unreleased]` section for D-211, all items marked
  confirmed.
- `PROJECT_STATUS.md` — top section, all items marked confirmed.
- `PHASE_HANDOFF.md` — this file, fully rewritten.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1643/1643** passing.
- `npm run build` — production build succeeds, **152 modules** (unchanged).

## Manual tests completed

Kevin deployed and checked "Build Your Party" directly (not this
environment's own testing — no browser available here) across multiple
rounds this session, confirming: the Standard Array/Background-gap/
validation-message fixes, the Team-Level overlap fix, and (after three
attempts) the hero-name-field positioning fix, including via his own
zoom-in/zoom-out test. Everything in D-211 is now confirmed.

## Known issues

- **KI-161** (D-211, this session) — **RESOLVED**, all items confirmed by
  Kevin. No further action needed on it.
- **KI-160** (D-210), **KI-159** (D-209), **KI-158** (D-208), **KI-157**
  (D-207), **KI-156** (D-206), **KI-155** (D-205), **KI-154** (D-204),
  **KI-153** (D-203) — the entire 2026-08-28 playtest batch — still need
  confirmation, unchanged since last handoff. This is now the oldest
  unconfirmed batch in the project and a reasonable next playtest target.
- **KI-152**, **KI-151** and every KI-141-through-KI-150 group remain
  unconfirmed from prior sessions, unchanged.
- Every pre-existing "Still need Kevin's playtest confirmation" item
  (KI-090 through KI-140) is unchanged.
- **KI-063** (Phase 12.3): still the standing limitation that two coop
  clients' boards don't converge as either acts — unaffected by this
  session, still open.

## Deferred items

- `CoopLobbyScene`'s join-code field wasn't independently confirmed fixed
  — if Kevin plays a co-op session and the field is still misplaced, that
  would be surprising (identical mechanism, identical fix) and worth a
  fresh look rather than assuming it's the same bug.
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
  session. Kevin's own recent screenshots show no obvious visible seam
  there, so may be a non-issue in practice — worth a glance next time this
  screen comes up, not urgent.
- **If a similar "DOM element positioned wrong" bug ever comes up again**
  (another real HTML `<input>` in a new scene, say), the playbook from
  this session is: don't assume a runtime desync; check whether the
  position is static-wrong-from-frame-one or actually drifts; if static,
  suspect `fixDomContainerAlignment` needs to be wired into that scene's
  own `create()`/`update()` (it's a reusable `uiTheme.ts` helper, not
  scene-specific) rather than re-deriving the fix from scratch.

## Next chat instructions

1. **No pre-set next task remains** — D-211 is fully closed. Ask Kevin
   what's next, or suggest the 2026-08-28 playtest batch (KI-153 through
   KI-160) as the oldest still-unconfirmed work if he has no specific
   request.
2. **Backlog, explicitly deferred by Kevin:** BG3-style roll viewer and
   Bestiary enemy images — both "after artwork is added."
3. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-212**/**KI-162**).
4. **If the coop equip-mode ownership gate is ever built**, the direction
   is already agreed with Kevin — don't re-litigate it (see "Deferred
   items" above).
5. Reminder for the standard workflow: Kevin manages Git via GitHub
   Desktop and deploys via GitHub Actions on push to `main` — a screenshot
   he sends might be from a stale deployed build if recent work hasn't
   been pushed yet (this happened once this session and caused a real,
   if brief, false alarm) — worth confirming which build a screenshot
   reflects before diagnosing from it.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/scenes/CharacterCreationScene.ts`,
`src/game/scenes/CoopLobbyScene.ts`, `src/game/scenes/uiTheme.ts`,
`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`,
this file. No new files. No Firebase-relevant change. Kevin has already
committed/pushed/deployed the working state confirmed above — no
outstanding push needed from this session unless the next chat makes
further changes.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-211 appended, amended six times same
      session, fully resolved)
- [x] KNOWN_ISSUES.md (updated — KI-161 added, now marked RESOLVED)
- [x] CHANGELOG.md (updated — Unreleased section for D-211, all items
      confirmed)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — D-211 section on top, all items
      confirmed)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1643** (unchanged)
- [x] No node_modules, dist, secrets, or service-account credentials
