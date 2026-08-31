# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-211**: four
  Character Creation spacing/text fixes (all **confirmed working** by
  Kevin after deploy), plus a hero-name-field positioning bug that took
  three attempts — the first two confirmed unsuccessful, the third
  (rerun the fix every frame instead of once/on-resize) is believed to
  close it based on a diagnostic screenshot's real numbers, but still
  needs Kevin's own confirmation once deployed. This is a standalone fix
  session, not part of any phased gameplan — the 2026-08-28 playtest batch
  (Phases 1-5, D-203 through D-210) closed three sessions ago with no
  pre-set next task.
- **Date:** August 31, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1643** (unchanged from last handoff — presentation-only change,
  no new pure-system logic, no new test file). Typecheck clean, all 1643
  pass, production build succeeds (**152 modules**, unchanged — no new
  file, only edits to `CharacterCreationScene.ts`, `CoopLobbyScene.ts`, and
  `uiTheme.ts`).

## IMPORTANT — one bug likely closed, needs Kevin's confirmation before touching it further

The hero-name-field positioning bug ("names are way out of place," an old
playtest note never fixed until this session tried) took three attempts:

1. A runtime-desync guess (`this.scale.refresh()` alone) — Kevin corrected
   this directly: the fields don't drift, they start wrong immediately.
2. A source-verified DOM-container-margin fix (`fixDomContainerAlignment()`
   in `uiTheme.ts`) — deployed, Kevin confirmed **no visible effect**.
3. A large, always-current diagnostic panel (added after a first,
   unreadably-tiny version prompted Kevin to try browser-zooming in — which
   itself revealed that canvas content doesn't visibly resize with zoom
   while the DOM name fields DO shift with it) gave real numbers:
   `canvas rect L467 T70 W1200 H1012` vs `domContainer rect L447 T-17
   W1200 H1012` — **same size** (the scale transform was always correct)
   but offset 20px left / 87px up, with a genuinely **nonzero** partial
   correction already applied (`margin 40.16px / 33.89px`). This proved
   attempt #2's correction FORMULA was right all along — it just went
   stale: a one-time call in `create()` plus reapplication on a
   `Phaser.Scale.Events.RESIZE` listener isn't enough to stay synced
   against live browser zoom/resize churn. **Fix**: `fixDomContainerAlignment`
   now reruns every single frame (`update()`, both `CharacterCreationScene`
   and `CoopLobbyScene`) instead of relying on event timing —
   self-healing regardless of what causes the drift.

This SHOULD close the bug — the formula is proven correct against real
measurements, and per-frame reapplication removes the timing gap that was
the actual problem. But **this has not been deployed or checked by Kevin
yet**. Don't assume it's fixed; get his confirmation first (his own zoom
test — zoom the browser in/out and confirm the fields DON'T shift anymore
— is a good way to verify #3's fix specifically, since that's exactly the
symptom that exposed the staleness).

## Why this task, and the false-alarm mid-session

Kevin sent a screenshot of "Build Your Party" flagging three things: the
hero-name fields "still awful"/"out of place," general "poor spacing"
naming the Standard Array row specifically, and confusion about the
"unspent Background ability bonus" message.

A follow-up screenshot mid-session, meant to check fix attempt #1, turned
out to be from the **deployed site** before anything had actually been
pushed — a false alarm about "made it worse" that nonetheless surfaced a
real, separate, pre-existing bug (see below).

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
   control block down, unevenly — the buttons move the full +38px needed,
   the save-status line and validation text below absorb less (+28/+20),
   preserving ~15px of clearance above the screen's outer frame (a
   uniform shift would have left only ~5px — this exact frame-adjacent
   zone broke once before, see KI-141/D-159, so this was checked with
   Kevin before shipping).

**Took three attempts, likely closed now — see the IMPORTANT callout above:**
5. Hero-name-field positioning. `fixDomContainerAlignment` now reruns
   every frame in both DOM-element scenes; a diagnostic panel is still in
   place (tagged "D-211 TEMP DIAGNOSTIC") pending Kevin's confirmation
   before removal.

## Important files

- `src/game/scenes/uiTheme.ts` — `fixDomContainerAlignment()` (formula
  confirmed correct via Kevin's diagnostic numbers; the remaining fix was
  calling it more often, not changing it).
- `src/game/scenes/CharacterCreationScene.ts` — `create()`'s
  `scale.refresh()`/`fixDomContainerAlignment()`/`onViewportResize()`
  calls, `abilityMethodHandle`'s `y`, `pointsLeftY`, `bgRowGap`, the
  unspent-background status message, `buildBottomControls`'/
  `buildStartButton`'s Y-coordinate shifts, the `domDebugBg`/
  `domDebugText` fields and `updateDomDebugText()` (tagged "D-211 TEMP
  DIAGNOSTIC" — remove once the name-field bug is confirmed fixed), and
  the new `update()` method (calls `fixDomContainerAlignment` every
  frame — likely permanent, this IS the real fix; only the
  diagnostic-panel half of `update()` is temporary).
- `src/game/scenes/CoopLobbyScene.ts` — the same `create()` calls plus a
  matching `update()` calling `fixDomContainerAlignment` every frame (no
  diagnostic panel there — untested, presumed to share the same fix).
- `DECISIONS.md` — D-211 (five same-session amendments: the Team-Level
  discovery, "still broken" update, the zoom-clue update, the per-frame-fix
  resolution).
- `KNOWN_ISSUES.md` — KI-161 (full confirmation checklist, now including
  "re-check with a zoom test" specifically).
- `CHANGELOG.md` — new `[Unreleased]` section, split into "Fixed,
  confirmed" and the three-attempt name-field story.
- `PROJECT_STATUS.md` — new top section, same honest framing.
- `PHASE_HANDOFF.md` — this file, fully rewritten.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1643/1643** passing.
- `npm run build` — production build succeeds, **152 modules** (unchanged).

## Manual tests completed

Kevin deployed and checked "Build Your Party" directly (not this
environment's own testing — no browser available here). Confirmed: the
Standard Array/Background-gap/validation-message fixes and the Team-Level
overlap fix all work correctly. The hero-name-field fix's THIRD attempt
(per-frame reapplication) has NOT been deployed/checked yet — that's the
next thing to confirm.

## Known issues

- **KI-161** (D-211, this session): the Team-Level/spacing fixes are
  confirmed done; the hero-name-field bug's third fix attempt needs
  deployment and confirmation — try Kevin's own zoom test as the check.
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

- **If the per-frame `fixDomContainerAlignment` call does NOT fully close
  the hero-name-field bug**, the diagnostic panel is still in place — read
  its numbers again rather than guessing a fourth mechanism. Given the
  formula's already proven correct against real measurements, a residual
  problem at this point would most likely be something calling
  `scale.refresh()` or otherwise resetting the container's margin AFTER
  `update()`'s correction runs within the same frame (check render/update
  ordering), or a genuinely different per-element issue
  (`DOMElementCSSRenderer.js`'s own `transform` math for the individual
  `<input>`, not the container) — see the previous handoff's "Deferred
  items" for that angle if it comes to it.
- Once confirmed fixed, remove the diagnostic-only parts: `domDebugBg`/
  `domDebugText` fields, `updateDomDebugText()`, and their creation calls
  in `create()` — but KEEP `update()`'s `fixDomContainerAlignment(this)`
  call itself in both scenes; that's the actual fix, not debug scaffolding.
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

## Next chat instructions

1. **Get Kevin's confirmation on the per-frame name-field fix first** —
   see the IMPORTANT callout at the top of this file. His own zoom
   in/out test is a good specific check (the fields should stay put now).
2. **Remind Kevin to commit + push this session's latest work** via
   GitHub Desktop if he hasn't already, and confirm the GitHub Actions
   deploy finished before trusting any new screenshot.
3. Once confirmed, **remove the diagnostic-only code** (see "Deferred
   items" above for exactly what to keep vs. remove) from
   `CharacterCreationScene.ts`.
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
latest round (the per-frame fix) so Kevin can actually check it.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-211 appended, amended four more times same
      session)
- [x] KNOWN_ISSUES.md (updated — KI-161 added, revised three times)
- [x] CHANGELOG.md (updated — new Unreleased section for D-211, revised
      three times)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — new D-211 section on top, revised
      three times)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1643** (unchanged)
- [x] No node_modules, dist, secrets, or service-account credentials
