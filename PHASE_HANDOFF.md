# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. Kevin's ask this session: let a Map
  Builder author design their own enemy waves — pick the enemies, the
  wave/turn timing, and the spawn point each spawn group uses — instead of
  every map (Playtest and browsed/published maps alike) always getting the
  same generated minion-pool-plus-fixed-boss wave list. Done (D-227). Not
  yet played by Kevin.
- Also answered a factual question at the start of the session: there is
  NO per-enemy "cost"/point-budget in the difficulty system (Kevin
  half-remembered one) — the actual system (`ThreatBudgetSystem`/
  `data/difficulty.ts`, D-217 era) is flat tier multipliers applied to a
  whole wave, not a per-enemy point cost. No code change from that — just a
  clarification before the real ask (waves) came in.
- **Date:** September 2, 2026.
- Tests: **1711** (was 1699 before this session — 12 new
  `tests/mapBuilder.test.ts` cases, 2 new `tests/mapSharing.test.ts` cases,
  1 existing `mapSharing.test.ts` assertion updated for the new
  always-present `customWaves` field). Typecheck clean, all 1711 pass,
  production build succeeds (**157 modules**, unchanged — no new files).

## D-227 — Map Builder: author-designed enemy waves

See `DECISIONS.md` D-227 for the full writeup. Summary:

- **Data model**: `ParsedMap` gained `customWaves?: WaveDefinition[]` — the
  exact same shape every hand-authored wave list (`data/waves.ts`, campaign
  chapters) already uses. Absent/empty means unchanged prior behavior; once
  the author adds ≥1 wave with ≥1 spawn group, it REPLACES the generated
  wave list entirely for that map, both Playtest and Browse-and-play.
- **Scope, deliberately matching exactly what was asked**: enemies + wave/
  turn timing + spawn point. Turn limit and completion/time-bonus gold stay
  auto-computed per new wave (same curve `FreePlayWaveGenerator` already
  uses), not author-editable this pass. The enemy picker offers the FULL
  71-enemy roster, no restriction (including miniboss/boss/legendary-role
  enemies).
- **Pure logic** (`MapBuilderSystem.ts`): `addWave`/`removeWave`/
  `addSpawnGroup`/`removeSpawnGroup`/`updateSpawnGroup`, capped at 8 waves /
  4 spawn groups per wave (mirrored exactly in `firestore.rules`).
  `validateDraft` gained 3 new reasons (only checked when `customWaves` is
  non-empty): a wave with no spawn groups, an unknown `enemyId`, or a
  `spawnIndex` pointing at a spawn tile that doesn't exist.
- **UI** (`MapBuilderScene.ts`): a new "Waves" button (a launcher, not a
  third `PaletteTab` state) opens a full-screen overlay flow — Waves list →
  Wave detail → Group edit — built with this scene's own existing
  plain-rectangle button style (unreskinned). The enemy picker is
  deliberately two-step (role category, then a specific enemy) because
  `renderChoiceOverlay` lays choices out in an unbounded, non-scrolling
  grid — a flat 71-item list risks running off the bottom of the canvas.
  Built with `renderChoiceOverlay`/`clearChoiceOverlay` directly rather than
  `openChoiceList` for that reason (see D-227's own doc comment on
  `openEnemyCategoryPicker` for why `openChoiceList` would break here).
- **Sharing**: `SharedMapRecord` gained `customWaves` (always `[]` when
  none authored). `fromSharedMapRecord` defensively drops any spawn group
  with an unknown `enemyId` or out-of-range `spawnIndex` on load (rules
  check shape/size only, same stance `isValidTileRows` already takes toward
  tile data). `firestore.rules`' `isValidSharedMap` validates the new field
  with 4 new helper functions, same explicit per-index style already used
  elsewhere in that file (no loop construct in rules).
  `BrowseSharedMapsScene.startWithSelectedMap` uses a map's `customWaves`
  when present, hiding Wave Count/Minion Source behind a note (Difficulty
  still applies normally).

## Important files

- `src/game/data/testMap.ts` — `ParsedMap.customWaves`, `parseMapRows`'s new
  `options.customWaves`.
- `src/game/systems/MapBuilderSystem.ts` — `MAX_CUSTOM_WAVES`/
  `MAX_SPAWN_GROUPS_PER_WAVE`, the 5 new wave/group editing functions, 3 new
  `validateDraft` reasons.
- `src/game/scenes/MapBuilderScene.ts` — the "Waves" launcher button, the
  full-screen wave-editor overlay flow (`waveEditorOverlay`,
  `renderWavesListScreen`/`openWaveDetailScreen`/`openGroupEditScreen`), the
  two-step enemy picker (`openEnemyCategoryPicker`/`openEnemyPickerForRole`),
  `onPlaytest`'s customWaves branch.
- `src/game/systems/MapSharingSystem.ts` — `SharedMapRecord.customWaves`,
  `toSharedMapRecord`/`fromSharedMapRecord`, new `sanitizeCustomWaves`.
- `src/game/scenes/BrowseSharedMapsScene.ts` — `selectedMapHasCustomWaves`,
  `startWithSelectedMap`'s customWaves branch, the hidden-sections/note UI.
- `firestore.rules` — `isValidSharedMap`'s new `customWaves` field, plus
  `isValidCustomWaves`/`isValidWaveDef`/`isValidSpawnGroups`/
  `isValidSpawnGroup`.
- `tests/mapBuilder.test.ts` — new `describe` blocks for the wave/group
  editing functions and the 3 new `validateDraft` reasons.
- `tests/mapSharing.test.ts` — new `customWaves` round-trip and
  load-time-sanitization cases; one existing assertion updated.
- `DECISIONS.md` — D-227 (new).
- `KNOWN_ISSUES.md` — KI-176 (new).
- `CHANGELOG.md`, `PROJECT_STATUS.md` — one new `[Unreleased]`/status
  section each, on top.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1711/1711** passing.
- `npm run build` — production build succeeds, **157 modules** (unchanged —
  no new files this session, only existing ones edited).
- `npm run dev` + an HTTP check — server boots (HTTP 200).

## Manual tests completed

None — no browser available in this environment. This session is almost
entirely scene-layer UI (`MapBuilderScene`/`BrowseSharedMapsScene`), which
per this project's own architecture rule carries no automated coverage for
the scene layer itself — a real look matters more than usual here. See
`KNOWN_ISSUES.md` KI-176 for the full click-through checklist: opening the
Waves editor, adding/editing/removing a wave and a spawn group, the
two-step enemy picker, Playtesting a custom-wave map, and
Publishing/Browsing one.

## Known issues

- **KI-176** (new this session) — not played yet; see checklist above.
- **KI-175** through **KI-169** (D-217 through D-226, prior sessions) —
  still need Kevin's confirmation, unchanged.
- **KI-166** (D-216), **KI-165** (D-215), **KI-164** (D-213), **KI-163**
  (D-213), **KI-162** (D-212) — still need Kevin's confirmation, unchanged.
- **KI-161** (D-211) — **RESOLVED**, confirmed by Kevin.
- **KI-160** (D-210) through **KI-153** (D-203) — the entire 2026-08-28
  playtest batch — still need confirmation, unchanged. Still the oldest
  unconfirmed batch in the project.
- **KI-152** and every KI-090-through-KI-151 group remain unconfirmed from
  prior sessions, unchanged.
- **KI-063** (Phase 12.3): still the standing limitation that two coop
  clients' boards don't converge as either acts — unaffected by this
  session, still open.

## Deferred items

- Nothing new deferred this session — the ask (author-designed waves) is
  fully closed for the scope Kevin described (enemies + timing + spawn
  point). Turn limit/gold stay auto-computed by explicit design choice, not
  an oversight — worth asking Kevin whether he wants those author-editable
  too in a future session, if he asks for more control there.
- Everything previously deferred (paperdoll-cell drawing helper, sidebar
  slot-cell hover tooltip, coop equip-mode ownership gate, `CoopLobbyScene`
  join-code DOM positioning, KI-152/KI-163 item-14 repro-chasing,
  Free Play/threat-budget numbers still first-pass/untuned) — unchanged,
  still open, untouched this session.

## Next chat instructions

1. **Most likely next step**: get Kevin's confirmation on this session's
   work (KI-176) — build a custom wave, Playtest it, and Publish/Browse it.
   This is a genuinely new UI (4 screens deep: Waves list, Wave detail,
   Group edit, the two-step enemy picker), so expect UI-polish feedback on
   the first real look, not just a pass/fail.
2. **Otherwise**: the oldest still-unconfirmed work is the 2026-08-28
   playtest batch (KI-153 through KI-160), or the still-unconfirmed
   D-217-through-D-226 batch, if Kevin has no specific new request.
3. **Backlog, explicitly deferred by Kevin:** BG3-style roll viewer and
   Bestiary enemy images — both "after artwork is added."
4. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-228**/**KI-177**).
5. Reminder for the standard workflow: Kevin manages Git via GitHub Desktop
   and deploys via GitHub Actions on push to `main` — none of this session's
   work is deployed/confirmed yet, needs a push before Kevin can check it.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/data/testMap.ts`,
`src/game/systems/MapBuilderSystem.ts`, `src/game/scenes/MapBuilderScene.ts`,
`src/game/systems/MapSharingSystem.ts`,
`src/game/scenes/BrowseSharedMapsScene.ts`, `firestore.rules`,
`tests/mapBuilder.test.ts`, `tests/mapSharing.test.ts`, `DECISIONS.md`,
`KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`, this file. No new
files this session. **Firebase-relevant change**: `firestore.rules` was
edited (new `customWaves` validation) — `.github/workflows/firebase-deploy.yml`
already runs `firebase deploy --only hosting,firestore:rules` on every push
to `main`, so a normal push covers this automatically, no extra manual step
needed. None of this session's work is deployed/confirmed yet.

## Handoff package contents

- [x] Source files (see "Important files" above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-227 appended)
- [x] KNOWN_ISSUES.md (updated — KI-176 added)
- [x] CHANGELOG.md (updated — one new `[Unreleased]` section, on top)
- [x] CONTENT_SOURCES.md (unchanged — no new content this session)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — one new section, on top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1711** (was 1699 at the start of this session)
- [x] No node_modules, dist, secrets, or service-account credentials
