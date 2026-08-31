# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built and closed
  **D-211** (Character Creation spacing fixes + the hero-name-field
  positioning bug — all confirmed working by Kevin), then built **D-212**
  as a direct follow-up: the 4 hero-name fields are now canvas-native
  instead of real DOM `<input>` elements, at Kevin's own request after he
  noticed a load-time snap even once D-211's fix was working. D-212 is
  **not yet played** — headless-verified only.
- **Date:** August 31, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1643** (unchanged — presentation-only changes throughout, no
  new pure-system logic, no new test file). Typecheck clean, all 1643
  pass, production build succeeds (**152 modules**, unchanged — no new
  file across either D-211 or D-212).

## The two decisions this session, in order

1. **D-211** (fully closed, confirmed): four Character Creation spacing/
   text fixes plus a three-attempt saga to fix the hero-name fields'
   positioning bug. All five items are confirmed working by Kevin on the
   deployed site. See `DECISIONS.md` D-211 for the full story if this
   class of bug (a real DOM element inside a Phaser scene going out of
   sync with the canvas) ever comes up again — it's a genuinely useful
   playbook.
2. **D-212** (just built, not yet played): right after confirming D-211's
   fix worked, Kevin noticed the name fields still visibly snap into place
   for a frame on scene load, and asked a good architectural question —
   why do these need their own separate positioning system at all, when
   nothing else in the game does? Answer: they don't. Rebuilt the 4
   hero-name fields as canvas-native controls (the same `createOrnateButton`
   primitive every other row already uses) instead of real DOM `<input>`
   elements. This eliminates the whole class of bug D-211 spent three
   attempts fixing, at the cost of losing native browser text-editing
   niceties (real OS copy/paste UI, IME composition, mobile virtual
   keyboard) — a trade-off discussed with Kevin before building, given the
   field's short/capped/cosmetic nature.

## What happened this session — D-212 detail

- `SlotWidgets.nameInput`/`.nameInputNode` (a `Phaser.GameObjects.DOMElement`
  + its raw `<input>` node) replaced by `nameHandle: OrnateButtonHandle`.
- New scene state: `focusedNameSlot: number | null`, `nameCaretOn: boolean`
  (blinked by a 500ms repeating `this.time.addEvent`).
- Click → focus (closes any open dropdown, sets `focusedNameSlot`, calls
  `refreshNameLabel`). A scene-wide `keydown` listener (registered in
  `create()`) handles Backspace/printable-character-append (24-char cap,
  same as the old `maxlength`)/Enter+Tab-to-blur while a slot is focused.
  `keydown-ESC` (the existing Back-navigation handler) now checks
  `focusedNameSlot` first and just blurs instead of leaving the whole
  screen. A scene-wide `pointerdown` listener blurs on any click that
  isn't the focused field itself (matched via `obj.parentContainer`,
  since `OrnateButtonHandle` doesn't expose its inner `Graphics` object).
- `refreshNameLabel(slot)` draws the typed name (+ blinking `|` while
  focused) or a "Hero Name" placeholder when empty and unfocused. Called
  from `refreshAll()` for every slot every time (safe — unlike `refreshSlot`,
  which still deliberately skips the name field, `refreshNameLabel` reads
  the LIVE `SlotState.name` rather than a `build` snapshot, so it can never
  fight in-progress typing) and explicitly wherever `SlotState.name`
  changes programmatically (loading a save/character/blueprint).
- D-160's `setNameInputsVisible()` workaround (hiding DOM inputs behind
  every full-screen picker overlay, since they ignored normal depth
  sorting) is deleted entirely — canvas-native fields respect depth
  sorting for free, so an overlay just covers them automatically.
  `renderPlanPrompt` now calls `blurNameField()` instead.
- `setSlotActive`'s old explicit `nameInputNode.disabled = !active` line
  is gone — `nameHandle` is in `interactiveButtons` like every other row
  now, so the shared disable pass already reaches it. A locked companion's
  name is still editable (that was never tied to `identityLocked`) —
  unchanged behavior, reached through the shared path.
- New edge case the old approach never needed: a focused slot that becomes
  inactive (party size shrinks below it) is now explicitly blurred in
  `refreshAll()` (a real DOM `<input>` losing browser focus naturally
  stopped accepting keystrokes; a canvas-native field's "focus" is just
  scene state, so this needed an explicit check).

## Important files

- `src/game/scenes/CharacterCreationScene.ts` — see D-212's own
  "Important files" list in `DECISIONS.md` for the full touch-point list
  (widget fields, `buildSlotUi`, the new focus/blur/label methods, the
  `create()` listener registrations, `keydown-ESC`, `refreshAll`,
  `setSlotActive`, `renderPlanPrompt`, and the deleted
  `setNameInputsVisible`).
- `src/game/scenes/uiTheme.ts` — `fixDomContainerAlignment()`, still used
  by `CoopLobbyScene` (its join-code field stayed a real DOM `<input>`)
  and no longer by `CharacterCreationScene` at all.
- `DECISIONS.md` — D-211 (six same-session amendments, fully resolved),
  D-212 (new).
- `KNOWN_ISSUES.md` — KI-161 (D-211, RESOLVED), KI-162 (D-212, new — full
  confirmation checklist for the canvas-native name field).
- `CHANGELOG.md` — two `[Unreleased]` sections, D-212 stacked above D-211.
- `PROJECT_STATUS.md` — two sections, D-212 on top (not yet played),
  D-211 below it (confirmed).
- `PHASE_HANDOFF.md` — this file, fully rewritten.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1643/1643** passing.
- `npm run build` — production build succeeds, **152 modules** (unchanged).

## Manual tests completed

D-211 is fully confirmed by Kevin on the deployed site (see `KNOWN_ISSUES.md`
KI-161, RESOLVED). D-212 has NOT been played yet — see KI-162's full
checklist: does the field visually match the rest of the column, does
click/type/blur/caret all feel right, does a locked companion's name stay
editable, does Escape stop editing without navigating away, etc.

## Known issues

- **KI-162** (D-212, this session) needs Kevin's playtest confirmation —
  the canvas-native name field is a real behavior change (not just a bug
  fix), so this deserves an actual look before considering it done.
- **KI-161** (D-211) — **RESOLVED**, confirmed by Kevin.
- **KI-160** (D-210), **KI-159** (D-209), **KI-158** (D-208), **KI-157**
  (D-207), **KI-156** (D-206), **KI-155** (D-205), **KI-154** (D-204),
  **KI-153** (D-203) — the entire 2026-08-28 playtest batch — still need
  confirmation, unchanged since last handoff. Still the oldest unconfirmed
  batch in the project.
- **KI-152**, **KI-151** and every KI-141-through-KI-150 group remain
  unconfirmed from prior sessions, unchanged.
- Every pre-existing "Still need Kevin's playtest confirmation" item
  (KI-090 through KI-140) is unchanged.
- **KI-063** (Phase 12.3): still the standing limitation that two coop
  clients' boards don't converge as either acts — unaffected by this
  session, still open.

## Deferred items

- `CoopLobbyScene`'s join-code field is untouched (deliberately kept as a
  real DOM `<input>`) — still carries KI-062's own never-independently-
  confirmed "should position correctly" gap, now via `fixDomContainerAlignment`
  alone (no canvas-native alternative built for it, nor requested).
- The other two DOM `<input>` uses in `CharacterCreationScene.ts` (the
  Save-Blueprint-name and Save-Character-name overlay text fields) are
  untouched — out of scope for D-212 (Kevin's complaint was specifically
  about the "nameplates," not these transient modal fields). If Kevin
  ever raises a similar complaint about THOSE, the same canvas-native
  approach applies directly — no new design needed, just the same pattern.
- If KI-162's playtest turns up something wrong with the canvas-native
  field (typing feels off, focus/blur has an edge case, visual mismatch),
  the whole mechanism is self-contained in `CharacterCreationScene.ts` —
  no `uiTheme.ts`/Phaser-internals digging needed this time, unlike D-211.
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
  — noticed while investigating D-211's Team-Level overlap but NOT fixed.
  Kevin's own recent screenshots show no obvious visible seam there, so
  may be a non-issue in practice — worth a glance next time this screen
  comes up, not urgent.

## Next chat instructions

1. **Get Kevin's confirmation on D-212** (the canvas-native name field) —
   see KI-162's checklist. This is a real behavior/UX change, not just a
   positioning fix, so it's worth an actual look before moving on.
2. Once confirmed, no other pre-set task remains — ask Kevin what's next,
   or suggest the 2026-08-28 playtest batch (KI-153 through KI-160) as the
   oldest still-unconfirmed work if he has no specific request.
3. **Backlog, explicitly deferred by Kevin:** BG3-style roll viewer and
   Bestiary enemy images — both "after artwork is added."
4. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-213**/**KI-163**).
5. **If the coop equip-mode ownership gate is ever built**, the direction
   is already agreed with Kevin — don't re-litigate it (see "Deferred
   items" above).
6. Reminder for the standard workflow: Kevin manages Git via GitHub
   Desktop and deploys via GitHub Actions on push to `main` — a screenshot
   he sends might be from a stale deployed build if recent work hasn't
   been pushed yet (this happened once already this session).

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/scenes/CharacterCreationScene.ts`,
`src/game/scenes/CoopLobbyScene.ts`, `src/game/scenes/uiTheme.ts`,
`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`,
this file. No new files. No Firebase-relevant change. D-211's work is
already deployed and confirmed; D-212 (this turn's canvas-native name
field) still needs to be pushed before Kevin can check it.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-211 fully resolved, D-212 appended)
- [x] KNOWN_ISSUES.md (updated — KI-161 RESOLVED, KI-162 added)
- [x] CHANGELOG.md (updated — two Unreleased sections, D-212 on top)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — D-212 section on top, D-211 below it)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1643** (unchanged)
- [x] No node_modules, dist, secrets, or service-account credentials
