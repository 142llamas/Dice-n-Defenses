# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **D-211**: three
  small, provable Character Creation spacing/text fixes, plus a real,
  source-verified fix for a long-standing hero-name-field positioning bug.
  This is a standalone fix session, not part of any phased gameplan — the
  2026-08-28 playtest batch (Phases 1-5, D-203 through D-210) closed last
  session with no pre-set next task.
- **Date:** August 31, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1643** (unchanged from last handoff — presentation-only change,
  no new pure-system logic, no new test file). Typecheck clean, all 1643
  pass, production build succeeds (**152 modules**, unchanged — no new
  file, only edits to `CharacterCreationScene.ts`, `CoopLobbyScene.ts`, and
  `uiTheme.ts`).

## Why this task, and how the fix was actually found

Kevin sent a screenshot of "Build Your Party" flagging three things: the
hero-name fields are "still awful"/"out of place" (a repeat of an old
playtest note, never actually addressed by any prior session), general
"poor spacing" naming the Standard Array row specifically, and confusion
about the "Hero N still has an unspent Background ability bonus" message.

The name-field fix took two passes. The **first pass guessed wrong**: it
borrowed D-162's finding (a related canvas-squish report where DOM
elements stayed correctly positioned while the canvas around them didn't)
and assumed the same runtime desync was at play, mitigating with
`this.scale.refresh()` alone. **Kevin corrected this directly: "The name
plates don't drift, they just start in that position as seen in the
screenshot."** That ruled out any theory involving something changing over
time, and prompted actually reading Phaser's own source
(`node_modules/phaser/src/scale/ScaleManager.js`,
`node_modules/phaser/src/dom/CreateDOMContainer.js`) instead of guessing a
second time.

**The real mechanism**: Phaser keeps its shared DOM Element container
(`game.domContainer`) aligned with the canvas by copying the CANVAS's own
CSS `margin-left`/`margin-top` onto it — this is how Phaser's built-in
`autoCenter` modes (`CENTER_BOTH`, etc.) keep both in sync, since that
centering itself works by setting the canvas's margin. This project
deliberately uses `autoCenter: NO_CENTER` and lets an external CSS
flexbox (`#game-root` in `index.html`) center the canvas instead — a real,
working fix for a real double-centering bug hit before (see `main.ts`'s
own comment). But flexbox centering never touches the canvas's margin at
all, so the value Phaser copies onto `domContainer` is always empty, and
nothing else keeps the container aligned to the canvas's actual
flex-computed position. The result is a CONSTANT, non-drifting offset,
present from the very first frame — exactly what Kevin described.

## What happened this session (D-211)

1. **Fixed a real, provable overlap** — the Standard Array/Point Buy pill
   overlapped the Background/Ability-Bonus row above it by 12px (D-206
   added that row without adjusting the pill's position). Moved the pill
   to `y=300` and `pointsLeftY` to `324`, both fitting inside the existing
   gap without shifting anything else in the column.
2. **Widened `bgRowGap`** (6px → 10px) — the Background/Ability-Bonus
   buttons' borders were reading as a stray vertical line between the two
   labels.
3. **Clarified the ability-bonus validation message** — now names the
   actual control: *"Hero N still needs to pick an Ability Bonus (the
   button next to Background)."*
4. **Root-caused and fixed the hero-name-field positioning bug for real.**
   New `fixDomContainerAlignment(scene)` in `uiTheme.ts` measures both the
   canvas's and `domContainer`'s actual on-screen position via
   `getBoundingClientRect()` and nudges the container's margin by the
   exact delta needed to align their top-left corners.
   `transform-origin: left top` (Phaser's own default) means the
   container's scale transform doesn't move that corner, so a margin
   correction made right after `scene.scale.refresh()` stays correct.
   Applied to **both** DOM-element scenes in the project —
   `CharacterCreationScene` (the 4 hero-name fields) and `CoopLobbyScene`
   (the join-code field, KI-062's own unconfirmed positioning gap) — each
   calling it in `create()` and re-registering it via `onViewportResize`
   (a real window resize re-runs Phaser's own internal `refresh()`, which
   would otherwise undo the correction).

This is a real, source-verified mechanism, not a guess — but the actual
pixel-perfect on-screen result still can't be seen without a browser.

## Important files

- `src/game/scenes/uiTheme.ts` — new `fixDomContainerAlignment()`.
- `src/game/scenes/CharacterCreationScene.ts` — `create()`'s
  `scale.refresh()`/`fixDomContainerAlignment()`/`onViewportResize()`
  calls, `abilityMethodHandle`'s `y` (280 → 300), `pointsLeftY`
  (302 → 324), `bgRowGap` (6 → 10), the unspent-background status message.
- `src/game/scenes/CoopLobbyScene.ts` — the same three `create()` calls.
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
session needs Kevin's own look, especially whether the hero-name fields
(and `CoopLobbyScene`'s join-code field) now actually land inside their
own column — see **KI-161** for the full checklist, including what detail
to note if it's STILL wrong (exactly where it lands relative to the
column would point at what's off in the margin math).

## Known issues

- **KI-161** (D-211, this session) needs Kevin's confirmation — the
  hero-name-field fix is source-verified (a real mechanism found in
  Phaser's own code, not a guess) but still visually unconfirmed.
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
- If `fixDomContainerAlignment` does NOT fully fix the hero-name-field
  positioning, the next step is checking exactly where it lands relative
  to the column (see "Manual tests completed" above) — the mechanism is
  now well understood, so a residual offset likely means a units/timing
  detail in the margin math, not a wrong theory.

## Next chat instructions

1. **Kevin's own browser pass first**, if he's had a chance to play —
   specifically confirm whether the name fields (and the co-op join-code
   field) now render in the right place (KI-161), and whether the rest of
   the 2026-08-28 playtest batch (KI-153 through KI-160) still needs a
   look.
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
`src/game/scenes/CoopLobbyScene.ts`, `src/game/scenes/uiTheme.ts`,
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
