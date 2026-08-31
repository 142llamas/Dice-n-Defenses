# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-211**: three
  small, provable Character Creation spacing/text fixes plus one
  unconfirmed mitigation, from a Kevin screenshot of "Build Your Party."
  This is a standalone fix session, not part of any phased gameplan — the
  2026-08-28 playtest batch (Phases 1-5, D-203 through D-210) closed last
  session with no pre-set next task.
- **Date:** August 31, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1643** (unchanged from last handoff — presentation-only change,
  no new pure-system logic, no new test file). Typecheck clean, all 1643
  pass, production build succeeds (**152 modules**, unchanged — no new
  file, only edits to `CharacterCreationScene.ts`).

## Why this task

Kevin sent a screenshot of the "Build Your Party" screen flagging three
things: the hero-name fields are "still awful"/"out of place" (a repeat of
an old playtest note — see below), general "poor spacing" naming the
Standard Array row specifically, and confusion about the "Hero N still has
an unspent Background ability bonus" message. Earlier in the same
conversation, transcribing an old screenshot of Kevin's original
2026-08-28 playtest notes turned up item 9 verbatim: *"Names of characters
are still way out of place. They are there by default so something is
really wrong with how they render. They also disappeared after a while."*
That note was never part of the D-203–D-210 batch (it wasn't one of the
phases scoped out of it) and has never been addressed by any session —
this is the first session to actually investigate it.

## What happened this session (D-211)

All changes are in `src/game/scenes/CharacterCreationScene.ts`:

1. **Fixed a real, provable overlap.** D-206 (Backgrounds) added the
   Background/Ability-Bonus row at `y=266` (bottom edge 282) but never
   adjusted the Standard Array/Point Buy pill below it (`abilityMethodHandle`,
   still at its pre-D-206 `y=280`, top edge 270) — a 12px overlap, exactly
   matching what Kevin's screenshot showed. Moved the pill to `y=300` and
   `pointsLeftY` (the Point Buy "Points Left" readout) to `324`, both
   computed to fit inside the existing 266-to-344 gap without needing to
   shift `abilityRowsTop` — so nothing below it (gear, subclass, starting
   level, plan levels, spells, the character library row) moved, and the
   column didn't grow past the parchment panel's existing bottom edge.
2. **Widened `bgRowGap`** (the Background/Ability-Bonus half-width split)
   from 6px to 10px — at 6px the two buttons' bronze borders read as a
   stray vertical line between the two labels.
3. **Clarified the ability-bonus validation message** — `"Hero N still has
   an unspent Background ability bonus"` → `"Hero N still needs to pick an
   Ability Bonus (the button next to Background)"`, naming the actual
   control, matching the style of the message one branch above it.
4. **Extended D-162's `scale.refresh()` mitigation to this scene, unconfirmed.**
   The hero-name fields are real DOM `<input>` elements (D-147). D-162
   (a prior session, investigating a reported horizontal canvas squish on
   Main Menu) found that after that bug, "the canvas squishes... except DOM
   elements (the hero-name `<input>`s), which stay correct" — meaning a
   `ScaleManager`/canvas desync leaves DOM elements positioned against the
   REAL scale while everything else renders against a stale one. That's
   exactly what "name fields floating above their column, near the
   subtitle" would look like. D-162 mitigated it with `this.scale.refresh()`
   in `MainMenuScene.create()` only, and Kevin never confirmed whether it
   worked. Added the identical call to `CharacterCreationScene.create()` —
   the scene with the most DOM elements in the project. **This is explicitly
   not a confirmed fix** — static reading can't prove the root cause, and
   no browser is available here to verify it helped.

## Important files

- `src/game/scenes/CharacterCreationScene.ts` — `create()`'s new
  `this.scale.refresh()` call, `abilityMethodHandle`'s `y` (280 → 300),
  `pointsLeftY` (302 → 324), `bgRowGap` (6 → 10), the unspent-background
  status message text.
- `DECISIONS.md` — D-211.
- `KNOWN_ISSUES.md` — KI-161 (new, full confirmation checklist).
- `CHANGELOG.md` — new `[Unreleased]` section (stacked above D-210's).
- `PROJECT_STATUS.md` — new top section (D-210's relabeled "DONE prior
  session").
- `PHASE_HANDOFF.md` — this file, fully rewritten.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1643/1643** passing.
- `npm run build` — production build succeeds, **152 modules** (unchanged).

## Manual tests completed

None — no browser available in this environment. Every change in this
session needs Kevin's own look, especially the `scale.refresh()`
mitigation, which by its own nature can't be verified without seeing
whether the name fields actually land in the right place now — see
**KI-161** for the full checklist.

## Known issues

- **KI-161** (D-211, this session) needs Kevin's confirmation — especially
  whether the name-field mitigation actually helped. If it didn't, the next
  step is a live repro (what does the `<input>`'s actual on-screen position
  look like relative to the canvas right when the bug shows, and does
  anything in particular precede it — e.g. coming from a battle, resizing
  the window, reloading vs. navigating from Main Menu), not a third blind
  guess.
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

- Re-chasing KI-152's repro — still nothing concrete to investigate.
- The coop equip-mode ownership gate (D-208's flagged gap) — Kevin has
  already given a direction for it (own-characters-only shop/equip/sell,
  view-only on a teammate's), but building the actual gate is still
  untouched; see `project_coop_gear_ownership_design.md` (memory) or
  D-209's own handoff history if resuming this in a future session.
- Extending the wood/bronze/gilt theme to the parts of `BattleScene`
  explicitly left out of D-210's scope (title text, debug/info text,
  full-screen modal overlays) — not requested, no mockup covered them.
- If the `scale.refresh()` mitigation in this session does NOT fix the
  hero-name-field positioning, a live repro is the next step (see "Known
  issues" above) — don't attempt a second blind fix in this area.

## Next chat instructions

1. **Kevin's own browser pass first**, if he's had a chance to play —
   specifically confirm whether the name fields now render in the right
   place (KI-161), and whether the rest of the 2026-08-28 playtest batch
   (KI-153 through KI-160) still needs a look.
2. **No pre-set next task remains** — this was a standalone fix session.
   Ask Kevin what's next, or check `KNOWN_ISSUES.md`/`SOURCE_OF_TRUTH.md`
   for open items if he has no specific request.
3. **Backlog, explicitly deferred by Kevin:** BG3-style roll viewer and
   Bestiary enemy images — both "after artwork is added."
4. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-212**/**KI-162**).
5. **If the coop equip-mode ownership gate is ever built**, the direction
   is already agreed with Kevin — don't re-litigate it (see "Deferred
   items" above).

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/scenes/CharacterCreationScene.ts`,
`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`,
this file. No new files. No Firebase-relevant change.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-211 appended)
- [x] KNOWN_ISSUES.md (updated — KI-161 added)
- [x] CHANGELOG.md (updated — new Unreleased section for D-211)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — new D-211 section on top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1643** (unchanged)
- [x] No node_modules, dist, secrets, or service-account credentials
