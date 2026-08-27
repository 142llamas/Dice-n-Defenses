# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. The Party Creation Overhaul roadmap
  closed last session (D-200). This session picked two items from
  `KNOWN_ISSUES.md` at Kevin's own request ("let's fix both here and
  now"): **D-201** (Load Game doesn't restore a campaign party's
  lock/point-buy/party-size) and **D-202** (Character Creation loses typed
  state on a Back-and-return round trip).
- **Date:** August 27, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: **1575** (+5 from the handoff-before-last's 1570 — new
  `campaignId`/`chapterIndex` coverage in `tests/saveSystem.test.ts` for
  D-201; D-202 touches only the untested `CharacterCreationScene.ts`, so
  it added none). Typecheck clean, all 1575 tests pass, the production
  build (145 modules, unchanged — no new source file this session)
  succeeds.

## What happened

### Picking the next task

With the Party Creation Overhaul roadmap fully closed, Kevin asked what
was left in `KNOWN_ISSUES.md` worth fixing. Two real candidates existed:
Load Game's campaignId gap (D-195's own flagged-but-deferred bug) and the
hero-name-drift bug (Plan 0.6, open since D-190, blocked on a repro that
never came). Recommended the Load Game fix as the one with a genuinely
understood root cause and no repro dependency; flagged the hero-name bug
as blocked pending Kevin's own click-sequence repro. Kevin said "let's fix
both here and now" — proceeded on the Load Game fix directly, and used
`AskUserQuestion` on the hero-name bug specifically because fixing it
without a repro meant reversing a deliberate prior design decision
(D-190's "Build Party and New Game are always fresh"); Kevin chose to fix
the concrete defect anyway rather than wait.

### D-201 — Load Game now forwards a campaign party's campaignId/chapterIndex

Two parallel Explore agents researched the save/load data flow and the
`CharacterCreationScene` companion-lock mechanism before any code was
written. Found the bug is live today, not just a legacy-save edge case:
`CharacterCreationScene`'s own pre-battle "Save Party" IS hidden in
campaign mode (Plan 3.7), but `BattleScene`'s in-battle pause-menu "Save
Party"/"Save & Exit" is NOT (`canSaveParty()` only checks `originalParty
!== undefined`) — so pausing mid-campaign-battle and saving is the one
live path that produces a campaign-linked `SaveSlot`, and Load Game always
dropped that context on reload.

**Bigger than "forward one field."** Forwarding `campaignId` alone would
only fix point-buy/party-size/difficulty-visibility (all keyed directly
off `this.campaignId` truthiness). The companion identity/gear lock and
Start Battle's roster write-back needed a second fix: the metadata linking
"slot N" to "companion X" (`this.companionIdForSlot`) was only ever
computed `if (!this.loadedParty)`, so even with `campaignId` forwarded, a
reloaded campaign party still couldn't lock. Fixed by hoisting that
metadata computation to run whenever `this.campaignId` is set regardless
of `loadedParty` — a loaded save's own build VALUES still win
unconditionally, only the slot↔companion bookkeeping now also runs for the
reload case. Checked D-197's "Key correctness fix" writeup before touching
the newly-reachable `resolveGearIdsForSlot` gear-locked branch, per this
project's own standing instruction — it already keys off
`this.companionIdForSlot[slotIndex]`, which this fix now correctly
populates for the reload case too.

See `DECISIONS.md` D-201 for the complete writeup.

### D-202 — Character Creation now resumes a "plain" draft across Back-and-return

No repro was ever obtained. Fixed the one concrete defect the D-190
investigation actually found: `create()` unconditionally re-seeds every
slot from `CHARACTER_NAME_POOL` on any navigation path that isn't Load
Game/a campaign-companion prefill, silently discarding a typed name (or
any other in-progress pick). This reverses part of D-190's own "Build
Party and New Game are deliberately identical, always fresh" reasoning —
Kevin confirmed that trade explicitly via `AskUserQuestion` before it was
built.

**Design reuses existing machinery rather than inventing a new snapshot
mechanism.** `SlotState.allocator` holds a real class instance
(`StandardArrayAllocator`/`PointBuyAllocator`) with methods, so a naive
deep-clone of `this.slots` would silently lose them. Instead, a new
module-level `lastPlainDraft: CharacterBuild[] | undefined` stores the
output of the already-existing `buildsFromSlots()`, and `init()` feeds it
back in as `this.loadedParty` on the next "plain" entry (no campaign, no
Free Play/custom map), reusing the Load-Game-established `loadedParty` →
`slotStateFromBuild` reconstruction path verbatim — no new SlotState
snapshot/restore logic. Lost on a real page reload (never touches
`localStorage`) — a same-session convenience, not a save. Captured in
`leaveToMainMenu()` (the only existing "leave without starting a battle"
path), gated so a locked campaign party never leaks into the free-pick
draft; cleared the instant a plain session's own Start Battle fires, so a
later Build Party visit starts fresh rather than resurrecting an
already-in-play party.

See `DECISIONS.md` D-202 for the complete writeup — including the
explicit flag that this is unconfirmed against what Kevin actually
originally saw.

## Important files

- `src/game/systems/SaveSystem.ts` — `SaveSlot`/`NewSaveSlotInput`/
  `SaveSlotUpdate`/`SavePartyInput` gain `campaignId?`/`chapterIndex?`;
  `isSaveSlot` validates them defensively; `saveOrUpdatePartySlot` passes
  them through.
- `src/game/scenes/BattleScene.ts` — `saveParty()` now records
  `campaignId`/`chapterIndex`.
- `src/game/scenes/LoadGameScene.ts` — `loadSlot()` forwards them.
- `src/game/scenes/CharacterCreationScene.ts` — D-201: Start Battle's own
  `updateSaveSlot` call records them too; the companion-prefill block
  (`companionBuildsForSlots`/`this.companionIdForSlot`) now runs whenever
  `campaignId` is set, not only `!loadedParty`; `identityLocked`'s formula
  dropped its `!this.loadedParty` guard. D-202: module-level
  `lastPlainDraft`, new `isPlainEntry()`, `init()`'s resume check,
  `leaveToMainMenu()`'s capture, Start Battle's clear.
- `tests/saveSystem.test.ts` — 5 new tests (D-201; a new `describe` block).
- `DECISIONS.md` — D-201, D-202.
- `KNOWN_ISSUES.md` — KI-151, KI-152; the old "Open bugs" hero-name entry
  moved into KI-152 under "Still need Kevin's playtest confirmation."
- `CHANGELOG.md` — one new `[Unreleased]` section.
- `PROJECT_STATUS.md` — new top section.
- `PARTY_CREATION_OVERHAUL_PLAN.md` — Plan 0/0.6 flipped to DONE, closing
  that plan's own last open item (unrelated to the main roadmap, which was
  already fully closed last session).

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1575/1575** passing.
- `npm run build` — production build succeeds, **145 modules**
  (unchanged — no new source file either session).

## Manual tests completed

None — no browser available in this environment. See **KI-151**/**KI-152**
for the full checklists. KI-152 in particular is explicitly unconfirmed
against Kevin's ORIGINAL report — if his next playtest shows this wasn't
the bug he meant, treat the hero-name issue as still open and get a real
repro before touching it again.

## Known issues

- **KI-152** (D-202, this session) — unconfirmed both in-browser AND
  against Kevin's original report. Highest-priority item to re-check.
- **KI-151** (D-201, this session) needs Kevin's playtest confirmation —
  full checklist in `KNOWN_ISSUES.md`.
- **KI-150** (D-200), **KI-149** (D-199), **KI-148** (D-198), **KI-147**
  (D-197), **KI-146** (D-196), **KI-145** (D-195), **KI-144** (D-194),
  **KI-143** (D-193), **KI-142** (D-192), **KI-141** (D-191) all remain
  unconfirmed from prior sessions — three separate screen groups now:
  Character Creation/Companions (KI-141 through KI-149), Compendium/
  Character Sheet (KI-150), and this session's Load Game/Character
  Creation changes (KI-151/KI-152).
- Every pre-existing "Still need Kevin's playtest confirmation" item
  (KI-090 through KI-140) is unchanged.

## Deferred items

- Nothing new deferred this session — both picked bugs were fixed in full
  (not partially scoped down).

## Next chat instructions

1. **Kevin's own browser pass first**, if he's had a chance to play — see
   "Known issues" above for the three unconfirmed groups. KI-152 (the
   hero-name fix) is the most important one to re-check specifically
   against his ORIGINAL complaint, since no repro was ever obtained for it.
2. **If KI-152 turns out to be the wrong fix** (Kevin's actual bug still
   reproduces, or this introduced a new problem): don't just pile on
   another guess. Get the exact click sequence this time, per the
   standing instruction in the old KI-152/Plan 0.6 writeups.
3. With both picked-up bugs fixed and the Party Creation Overhaul roadmap
   already closed, there's no pre-set next task — check with Kevin.
4. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-203**/**KI-153**).
5. **Do not reintroduce per-`campaignId` key-scoping** for
   `CompanionRosterSystem`/`CampaignProgressSystem`/`WorldFlagSystem` (or
   `companionBuilds`/`pcBuild`/`partyInventory`/`BlueprintLibrarySystem`)
   without re-reading D-195's full writeup first — unrelated to D-201's
   `SaveSlot.campaignId`, which is a completely different field on a
   completely different system (SaveSystem vs. the roster).
6. **If touching `CharacterCreationScene`'s companion-prefill block or
   `identityLocked` again**: D-201 hoisted the `companionBuildsForSlots`/
   `companionIdForSlot` computation out of `if (!this.loadedParty)` — this
   was deliberate and needed for a reloaded campaign party to lock
   correctly. Don't re-add that guard without re-reading D-201's writeup.
7. **If touching `PartyInventorySystem.ts` or the gear-locked branch of
   `resolveGearIdsForSlot`**, re-read D-197's "Key correctness fix"
   writeup first (still applies, now reachable from one more entry point
   thanks to D-201).
8. **If touching Character Creation's entry/navigation again**: D-202
   added `lastPlainDraft` (module-level, session-only) and `isPlainEntry()`
   — a "plain" entry (no campaign, no Free Play/custom map) now resumes
   the last draft. Don't assume "Build Party"/"New Game" always start
   from `CHARACTER_NAME_POOL` defaults; check `lastPlainDraft` first if
   debugging an unexpected pre-filled slot.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/systems/SaveSystem.ts`,
`src/game/scenes/BattleScene.ts`, `src/game/scenes/LoadGameScene.ts`,
`src/game/scenes/CharacterCreationScene.ts`, `tests/saveSystem.test.ts`,
`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`,
`PARTY_CREATION_OVERHAUL_PLAN.md`, this file. No Firebase-relevant change.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-201, D-202 appended)
- [x] KNOWN_ISSUES.md (updated — KI-151, KI-152 added; old hero-name
      "Open bugs" entry retired into KI-152)
- [x] CHANGELOG.md (updated — new Unreleased section for D-201/D-202)
- [x] CONTENT_SOURCES.md (unchanged — no new original content this session)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (updated — Plan 0/0.6 flipped to DONE)
- [x] PROJECT_STATUS.md (updated — new D-201/D-202 section on top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1575** (was 1570 last handoff, +5)
- [x] No node_modules, dist, secrets, or service-account credentials
