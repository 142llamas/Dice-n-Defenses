# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged.
- **Date:** September 8, 2026.
- **Why this handoff exists**: Kevin came back to playtest for the first
  time since the 2026-09-04 (D-234/D-235) session and found the deployed
  link (https://dice-n-defenses.web.app/) loading to a **black screen,
  immediately, every time** — no Main Menu, nothing. This session found and
  fixed the root cause (D-236). See `DECISIONS.md` D-236 and
  `KNOWN_ISSUES.md` KI-185 for the full writeup.
- Tests: **1795**, unchanged (this was a pure bug fix, no new tests needed —
  the bug was a declaration-ordering issue, not a missing behavior).
  Typecheck clean, all 1795 pass, production build succeeds (**162
  modules**, unchanged — one file touched, nothing added/removed).
- Next available: **D-237** / **KI-186**.

## What happened and what shipped (D-236)

Kevin's exact report: "I was going to playtest but the link doesn't work
anymore... I just see a black screen." Asked when it happens (immediately
vs. after some action) and for the DevTools console output — per this
project's own established protocol from KI-177. He supplied:

```
Uncaught ReferenceError: Cannot access 'hD' before initialization
    at Bf (index-CLOZv0RR.js:9714:10984)
    at Array.map (<anonymous>)
    at index-CLOZv0RR.js:9714:10740
```

(plus an unrelated "message channel closed" line from a browser extension —
ignored).

**Investigation path** (all in this session, no browser available):
1. Confirmed the deploy pipeline itself was healthy — `.github/workflows/
   firebase-deploy.yml` runs on every push to `main`, all recent GitHub
   Actions runs showed Success. Confirmed local `git log` (via GitHub
   Desktop's bundled `git.exe`, found on disk — the interactive shell's own
   `git` isn't on `PATH` here) matched `origin/main` exactly, so the local
   working tree IS what's actually deployed. Also confirmed the recent
   commit history (terse messages like "test"/"testing") was legitimate
   prior work, not something rogue — just Kevin's own commit-message habit.
2. Rebuilt production (`npx vite build --sourcemap`) and used the
   `source-map` package (already present transitively in `node_modules`) to
   translate the reported minified location back to real source — it
   pointed at `src/game/scenes/GearShopScene.ts` lines 93 and 119.
3. Read those lines: `ALL_ARMORY_FILTERS` (line 93, module scope) computed
   via `PAPERDOLL_ROWS.flat().map(normalizeFilterSlot)` — `.map()` calls its
   callback immediately. `normalizeFilterSlot`'s body reads `SLOT_GROUP`, a
   `const` declared at line 119 — **after** line 93 runs. `normalizeFilterSlot`
   itself is a hoisted function declaration (legal to reference early), but
   actually *calling* it hit `SLOT_GROUP`'s temporal dead zone. Since
   `main.ts` eagerly imports every scene (existing, documented rationale in
   `vite.config.ts`), this module's top-level code runs during the app's
   very first tick — hence a black screen before `BootScene` ever starts.
4. This ordering was disturbed by D-234's scroll-list rework of this exact
   file (381 lines changed) — `ALL_ARMORY_FILTERS`/`SLOT_GROUP`/
   `normalizeFilterSlot` themselves date to D-228 and evidently weren't
   adjacent before that edit.
5. **Fix**: moved `SLOT_GROUP` and `normalizeFilterSlot` above
   `ALL_ARMORY_FILTERS` in the same file. No logic changed — pure
   reordering. Only file touched: `src/game/scenes/GearShopScene.ts`.
6. **Verification beyond the normal checks**, since this bug class is
   invisible to `tsc`/`npm test`/dev-server-HTTP-check (none of them execute
   the production bundle's real module-init order): rebuilt with sourcemaps
   again, confirmed the new build's location no longer exhibits the ordering
   issue, then actually *executed* the rebuilt bundle in a Node `vm` context
   with minimal `window`/`document`/`localStorage` stubs (no `jsdom`
   dependency added — hand-rolled stubs in a scratchpad script, not
   committed anywhere). The fixed bundle ran cleanly through all 162 of the
   app's own modules and only stopped deep inside **Phaser's own internal
   canvas-capability-detection code** (`CanvasPool`/`checkInverseAlpha`),
   which needs a real 2D canvas context no stub can provide — an expected,
   unrelated environment limitation, not an app bug. That's the strongest
   confirmation available without a real browser: every module this project
   owns now evaluates without error.

**Not yet confirmed**: Kevin reloading the actual live link in his own
browser after this fix is pushed and deployed. That's the one thing the
above verification can't reach — see `KNOWN_ISSUES.md` KI-185 for the exact
checklist (hard refresh, check DevTools console is clean).

## Deliberate scope decisions made this session

None — this was a narrowly-scoped bug fix, not a feature session. No new
scope was added or deferred.

## What's NOT started

Nothing changed here from the prior handoff. Kevin's original 10-item
playtest list (2026-09-03/04) remains fully closed except item 2 (gear-slot
icons), which stays deferred by Kevin's own explicit choice until art
exists. See "Carried over from the prior handoff" below.

## Commands verified

- `npm run typecheck` — clean, after the fix.
- `npm test -- --run` — **1795/1795** passing, unchanged.
- `npm run build` — production build succeeds, **162 modules**, unchanged.
- `npx vite build --sourcemap` (twice — before and after the fix) — used to
  translate the reported crash location back to source, and to confirm the
  fix.
- A Node `vm`-sandboxed execution of the actual production bundle (not a
  normal project command — an ad hoc verification script in the session's
  scratchpad, not part of the repo) — confirmed the fix resolves the crash.
  This technique is worth remembering for any future "browser only" bug
  report: it can't replace a real browser (no real canvas/WebGL), but it
  CAN catch module-load-order crashes like this one without needing Kevin's
  time, by stubbing just enough `window`/`document` to get through the
  app's own module graph before Phaser's real rendering needs kick in.

## Manual tests completed

None — no browser available in this environment. Kevin's own hard-refresh
of the live link, post-deploy, is the real test (see KI-185).

## Known issues

- **KI-185** (new this session) — the black-screen crash; fix shipped,
  needs Kevin's post-deploy confirmation.
- **KI-182** through **KI-184** (2026-09-02/04 sessions) — still need
  Kevin's playtest confirmation, unaffected by this session's fix.
- **KI-177** (the recurring "2nd game freezes" bug) — still open, still
  genuinely unconfirmed, unaffected by this session. If it recurs, same
  protocol: get the DevTools console output first.
- **KI-063** (Phase 12.3): coop boards still don't converge — unaffected,
  still open.

## Deferred items

Unchanged from the prior handoff — nothing new deferred this session:
- Item 2 (gear-slot icons) — Kevin's own explicit "doesn't matter yet."
- `NAMELESS_THRONE_MAP` resize — not asked for, flagged as a gap.
- Hands consolidation in `CharacterCreationScene`'s gear picker — Armory-
  only by deliberate D-231 design, distinct from item 7's proficiency
  filtering (which IS in both places).
- In-battle shop grid's proficiency gating gap (flagged in D-235).

## Next chat instructions

1. **Confirm KI-185 first** — has Kevin reloaded the live link since this
   fix deployed? If he reports it's STILL a black screen, get a fresh
   DevTools console screenshot immediately (don't assume it's the same bug
   recurring — get the new error text first, per this project's own
   protocol).
2. **Check `KNOWN_ISSUES.md` for any other "-Confirmed" annotation** Kevin
   may have added directly while he was finally able to get back into the
   game — he records playtest findings there himself, not always in chat.
3. **If KI-177 (the freeze bug) recurs**: get the DevTools console output
   from Kevin at the moment it happens before doing anything else.
4. **There is no other pre-set next task.** Once KI-185 is confirmed, the
   natural candidates are the same as before this interruption: (a) the
   in-battle shop grid's proficiency gap, (b) a real playtest pass across
   the large backlog of headless-verified-only items (KI-153 through KI-184
   is a lot of stacked unconfirmed work), or (c) whatever Kevin brings next.
5. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-237**/**KI-186**).
6. Reminder for the standard workflow: Kevin manages Git via GitHub Desktop
   and deploys via GitHub Actions on push to `main` — this session's one-
   file fix is NOT committed/deployed/confirmed yet, needs a push before
   Kevin's link will actually work again.
7. **A `.git` directory with a real remote (`github.com/142llamas/
   Dice-n-Defenses`) IS present in this environment**, even though this
   project's own operating rules say "there is no git repository in this
   environment." The interactive shell's own `git` isn't on `PATH`, but
   GitHub Desktop's bundled copy is, at (version number may drift)
   `%LOCALAPPDATA%\GitHubDesktop\app-<version>\resources\app\git\cmd\
   git.exe` — useful for READ-ONLY inspection (`log`, `show`, `status`,
   `fetch`) when diagnosing exactly this kind of "what's actually deployed"
   question. Still don't commit/push from here — that stays Kevin's own
   GitHub Desktop workflow, per the project's operating rules.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched exactly one source file:
`src/game/scenes/GearShopScene.ts` (D-236 fix — reordered two declarations).

Docs updated: `DECISIONS.md` (D-236 appended), `KNOWN_ISSUES.md` (KI-185
added), `CHANGELOG.md` (new `[Unreleased]` section, on top), `PROJECT_STATUS.md`
(urgent section added on top), this file (fully rewritten).

**0 new files this session** — smallest change of any recent session, by
design: this was a targeted crash fix, not new content.

## Handoff package contents

- [x] Source files (`GearShopScene.ts` — see git steps above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-236 appended)
- [x] KNOWN_ISSUES.md (updated — KI-185 added)
- [x] CHANGELOG.md (updated — 1 new `[Unreleased]` section, on top)
- [x] CONTENT_SOURCES.md (unchanged — no new original content this session)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged)
- [x] PROJECT_STATUS.md (updated — urgent section added on top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1795**, unchanged
- [x] No node_modules, dist, secrets, or service-account credentials
