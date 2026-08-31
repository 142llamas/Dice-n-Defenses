# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-210**: Phase
  5's second and final item ("design-first, larger builds," 2026-08-28
  playtest batch) — a visual reskin of `BattleScene`'s chrome, extending
  D-123's wood/bronze/gilt fantasy theme (already on Main Menu, Compendium,
  Bestiary, Character Creation) to the actual gameplay screen. **This
  closes the entire 2026-08-28 playtest batch** (Phases 1 through 5, D-203
  through D-210) — there is no pre-set next task on that gameplan.
- **Date:** August 30, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1643** (unchanged from last handoff — presentation-only change,
  no new pure-system logic, no new test file). Typecheck clean, all 1643
  pass, production build succeeds (**152 modules**, unchanged — no new
  file, only edits to `BattleScene.ts` plus one import line in the same
  file; `uiTheme.ts` itself was reused verbatim, not modified).

## Why this task, and how the design was reached

Last session's `PHASE_HANDOFF.md` named Phase 5's remaining item (this
reskin) as the default next task, explicitly flagging it as needing a real
design pass and telling the next session NOT to assume Kevin wanted the
same "mockup Artifact, iterate over several rounds" process The Armory
(D-209) used — to ask first whether a lighter-weight approach would serve
better for a visual-only change.

Asked via `AskUserQuestion` on two axes:
1. **Process** — Kevin picked the full interactive-mockup process anyway
   (same as The Armory), not the lighter "describe + confirm" or "just
   build it" options offered.
2. **Scope** — Kevin picked "chrome + board frame" over "chrome only":
   the reskin should include a real ornate frame around the board itself,
   not just the HUD around it.

Built and published an interactive HTML mockup ("The Battlefield," a
Claude Artifact — not real code) with a live Current/Proposed toggle over
the actual battle-screen layout (top bar, board, roster, action row, shop
grid), reusing the exact hex palette and fonts already in `uiTheme.ts`/
`config.ts`'s `COLORS` so the mockup was a faithful preview, not a new
palette. Two rounds of feedback:

1. **Round 1** (initial mockup): scope questions above, plus two open
   design questions flagged for Kevin — board frame thickness, and
   whether the combat log should get a real backing panel.
2. **Round 2**: Kevin asked for (a) HP bars to simplify to a plain
   green-until-critical-then-red two-state instead of the mockup's
   (inaccurate-to-the-real-code) flat green, which incidentally surfaced
   that the REAL game already had a three-tier green/gold/red gradient —
   simplified to two-tier rather than reproducing three; and (b) action
   buttons to drop their individual green/purple/green-style identity and
   match the rest of the chrome, generalized during implementation to
   every other action-row button (Bonus Action/Action Surge/Class Action/
   Character Sheet/hotkeys), not just the four asked about directly, since
   they're the same category of button and leaving them oddly colorful
   would have undermined the whole point.
3. Kevin then answered "go a little bolder [on the board frame], and yes
   on the [combat log] backing. That will be good enough to start
   building. No need for another mockup" — explicit green light, no third
   mockup round.

The mockup itself was never code — this session's real implementation was
planned fresh by reading `BattleScene.ts`'s actual layout/color code (not
assumed from the mockup) and reusing D-123's existing `uiTheme.ts` helpers
(`drawScreenBackdrop`) plus new, small scene-local additions for the parts
`uiTheme.ts` didn't already cover (the board frame, the two new backing
panels).

## What happened this session (D-210)

All changes are in `src/game/scenes/BattleScene.ts` (search "D-210" for
every touch point) — no new files, `uiTheme.ts` reused verbatim:

- **Backdrop**: `drawScreenBackdrop(this)` (existing D-123 helper) replaces
  the flat `setBackgroundColor("#0e0e14")`.
- **New `drawBoardFrame()`**: a bold double bronze/gilt frame (5px outer,
  2px inner, corner diamonds) around the board's outer edge, drawn once
  from the grid's fixed geometry — sits in the padding outside the tile
  area, never touches a tile/token, no z-order concern with gameplay.
- **HP bars, two-state**: `refreshStatus()`'s bar color collapsed from a
  three-tier `>0.5 hero / >0.25 gold / else enemy` gradient to a two-tier
  `>0.25 hero / else enemy` — reuses the old red tier's own 0.25 cutoff as
  the critical point (no new balance number invented).
- **Combat log backing panel**: new `combatLogPanel` (`Graphics`) +
  `refreshCombatLogPanel()`, called from `logCombat()` and once at
  creation — sized to the SAME height `actionRowY()` already reserves for
  the log's current line count (10px floor, 86px 5-line cap), so it grows/
  shrinks with the text instead of a fixed max size, which would have
  reintroduced the dead-gap-on-Wave-1 bug KI-155/D-207 already fixed.
- **Wave/phase banner chip**: new `bannerChip` (`Graphics`) +
  `redrawBannerChip()`, called from the existing `fitBannerToWidth()` —
  resizes to the banner text's real measured width every time it changes.
- **Every chrome button recolored** to `COLORS.woodPanel` fill / `bronze`
  border, `woodPanelHover`/`gilt` on hover — End Turn, Build, Gear, the
  bottom-left Menu (Esc) button, the entire action-button stack (Confirm/
  Cancel/Ability/Potion/Bonus Action/Action Surge/Class Action/Character
  Sheet/hotkeys — via a small local `themeButton()` helper inside
  `buildHud()`), and the shared `buildItemGrid()` (used by both the shop
  catalog and, incidentally, Test Mode's debug pickers, since they share
  the method). Several of these buttons had NO hover/press feedback at
  all before this change. Roster boxes, HP bar track, and name text
  recolored to match; roster selection border moved from `heroActive` (a
  board-highlight color, left untouched everywhere it's actually used on
  the board) to `gilt`, since roster selection is chrome. Shop grid's
  keyboard-focus ring recolored from white to `gilt`.
  - Deliberately did NOT add a static hover-fill listener to
    `buildItemGrid`'s buttons the way the static top-bar buttons got one —
    the shop/debug grids already have a dynamic "selected" fill managed
    centrally by `showShopUI`/`showDebugPickerUI` on every refresh; a
    generic pointerout handler resetting to the idle color would have
    clobbered that selected highlight after any mouse hover. Left hover
    feedback on those to the existing `onHover` (item-description) wiring
    only.
- **Fonts**: gold counter, banner (Cinzel), message line (now italic, EB
  Garamond), combat log, roster names, and every button label switched
  from `system-ui`/`monospace` to `uiTheme.ts`'s `FONT_BODY`/
  `FONT_DISPLAY` — both already loaded globally via `index.html`, no new
  font loading needed.
- **Deliberately NOT touched** (outside the agreed mockup scope): the
  "FANTASY TOWER DEFENSE" title text, the Integrity/recent-phases/enemy-
  count/wave-preview HUD text, the Test Mode debug toolbar button
  (intentionally alarming red, a dev tool), and every full-screen modal
  overlay (ASI/subclass/spell-pick prompts, region-bonus choice, victory/
  defeat screens) — none were shown in the approved mockup.

## Important files

- `src/game/scenes/BattleScene.ts` — every change (search "D-210").
- `src/game/scenes/uiTheme.ts` — reused verbatim, unchanged.
- `DECISIONS.md` — D-210.
- `KNOWN_ISSUES.md` — KI-160 (new, full browser-confirmation checklist).
- `CHANGELOG.md` — new `[Unreleased]` section (stacked above D-209's, same
  convention D-209 used above D-208's).
- `PROJECT_STATUS.md` — new top section.
- `PHASE_HANDOFF.md` — this file, fully rewritten.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1643/1643** passing.
- `npm run build` — production build succeeds, **152 modules** (unchanged).
- `npm run dev` + an HTTP check — server boots, responds 200.

## Manual tests completed

None — no browser available in this environment. The design itself went
through two full feedback rounds with Kevin via the mockup Artifact before
any code was written, so the SHAPE of the change isn't really in question,
but the real implementation still needs his own look — see **KI-160** for
the full checklist: backdrop/frame rendering, the banner chip sizing at
both text-length extremes, the combat log panel growing correctly from
Wave 1, the HP bar's green-to-red flip at the 25% threshold, every action
button's new look and hover feedback, and the shop/debug grid's selected/
focus states against the new palette.

## Known issues

- **KI-160** (D-210, this session) needs Kevin's full browser confirmation
  — the checklist above, in `KNOWN_ISSUES.md`.
- **KI-159** (D-209), **KI-158** (D-208), **KI-157** (D-207), **KI-156**
  (D-206), **KI-155** (D-205), **KI-154** (D-204), **KI-153** (D-203)
  still need confirmation too — the whole 2026-08-28 batch is now built,
  none of it played yet.
- **KI-152**, **KI-151** and every KI-141-through-KI-150 group remain
  unconfirmed from prior sessions, unchanged.
- Every pre-existing "Still need Kevin's playtest confirmation" item
  (KI-090 through KI-140) is unchanged.
- **KI-063** (Phase 12.3): still the standing limitation that two coop
  clients' boards don't converge as either side acts — unaffected by this
  session, still open.

## Deferred items

- Re-chasing KI-152's repro — still nothing concrete to investigate.
- The coop equip-mode ownership gate (D-208's flagged gap) — Kevin has
  already given a direction for it (own-characters-only shop/equip/sell,
  view-only on a teammate's), but building the actual gate is still
  untouched; see `project_coop_gear_ownership_design.md` (memory) or
  D-209's own handoff history if resuming this in a future session.
- Extending the wood/bronze/gilt theme to the parts of `BattleScene`
  explicitly left out of this session's scope (title text, debug/info
  text, full-screen modal overlays like ASI/spell-pick prompts and
  victory/defeat screens) — not requested, no mockup covered them.

## Next chat instructions

1. **Kevin's own browser pass first**, if he's had a chance to play — the
   ENTIRE 2026-08-28 playtest batch (Phases 1 through 5, KI-153 through
   KI-160) is now built but none of it has been played. This reskin
   (KI-160) touches the most-used screen in the game, so it's worth
   prioritizing. Also ask whether he has more detail on the intermittent
   start-game bug (still not tracked — his note cut off mid-sentence,
   several sessions ago).
2. **No pre-set next task remains on the 2026-08-28 playtest gameplan** —
   it's fully closed as of this session. Ask Kevin what's next, or check
   `KNOWN_ISSUES.md`/`SOURCE_OF_TRUTH.md` for open items if he has no
   specific request.
3. **Backlog, explicitly deferred by Kevin:** BG3-style roll viewer and
   Bestiary enemy images — both "after artwork is added."
4. If a new engagement starts outside this gameplan, give it its own
   `D-NNN`/`KI-NNN` (next available: **D-211**/**KI-161**).
5. **If the coop equip-mode ownership gate is ever built**, the direction
   is already agreed with Kevin — don't re-litigate it (see "Deferred
   items" above).
6. **If `BattleScene`'s new visuals need iteration** after Kevin's pass,
   the mockup Artifact ("The Battlefield") is still the reference for the
   AGREED scope (chrome + board frame, HP bar two-state, unified action
   buttons) — treat layout/spacing/color tweaks as free to change, but
   confirm with Kevin before extending the theme into anything outside
   that agreed scope (the title text, modal overlays, etc.), since those
   were explicitly left out this session.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/scenes/BattleScene.ts` (large edit — see
"Important files" above for the shape of it), `DECISIONS.md`,
`KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`, this file. No new
files. No Firebase-relevant change (no `firestore.rules` edit, no new
Firestore field) — this is presentation-only work inside `BattleScene`,
unrelated to the coop sync layer.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-210 appended)
- [x] KNOWN_ISSUES.md (updated — KI-160 added)
- [x] CHANGELOG.md (updated — new Unreleased section for D-210)
- [x] CONTENT_SOURCES.md (unchanged — no new SRD-derived content, pure
      presentation work)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged — no Firestore schema change)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier; this is a separate playtest batch)
- [x] PROJECT_STATUS.md (updated — new D-210 section on top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1643** (unchanged)
- [x] No node_modules, dist, secrets, or service-account credentials
