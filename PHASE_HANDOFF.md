# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built **The Nameless
  Throne** — the campaign capstone, `CAMPAIGN_STORY_DESIGN.md` §5's last
  unbuilt piece and the final item on the whole KI-098 item 13 epic. Kevin's
  own direct ask: "build the capstone now... epic, a true masterpiece."
- **Date:** August 26, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: 1444 → **1466**. Typecheck, all 1466 tests, and the production
  build (**141 modules**, +2 for the new map and system files) all pass.
  `npm run dev` serves HTTP 200.

## What happened

### D-188 — The Nameless Throne: the campaign capstone

This is the largest single build of the item-13 epic, so it was researched
before any code was written: 3 parallel Explore agents (campaign/chapter/
companion data model; map-authoring + enemy-reskin patterns; branch-choice/
victory-flow mechanics), then a Plan-agent implementation pass, all
cross-checked against the real current code. Two genuine scope forks were
confirmed directly with Kevin via `AskUserQuestion` before designing
further — both resolved to the lighter-scope option:

- **Ending signal**: reuse the EXISTING Finish-or-Spare miniboss flags (5
  regions) plus Sorrel Thane's resolved fate, instead of writing 18-24 new
  chapter-boundary choice prompts across all 6 regions.
- **Capstone shape**: one climactic finale battle — flat, no `chapters` —
  not a second full 4-chapter 1-20 arc.

**Design calls locked this session** (not specified by the original design
doc; all documented explicitly, not silently decided): sparing a miniboss
and Sorrel's Redeemed outcome both lean **Ashen Sovereign** ("held onto
compassion/identity"); finishing a miniboss (or letting it breach
unresolved — there's no `finished:<id>` flag anywhere) and Sorrel's Lost
outcome both lean **The Hollow Empress** ("traded mercy for expedience"); a
genuine tie resolves to Ashen, matching §5's own "true ending" framing. The
capstone's pre-battle card always shows "Boss: Ashen Sovereign" regardless
of which the player will actually face — an intentional non-spoiler
(mirrors how Saltmere's card always says "Boss: Tidelord"). No HOMM3
bonus-choice screen for the capstone — §8 left this explicitly undecided;
resolved as a scope cut, zero code needed to enforce it.

**What was built**:
- New `data/namelessThroneMap.ts`: one fixed 17×11 `ParsedMap` — a
  processional hall (outer gallery strip walled off by a pillar line with
  two crossing-gaps, opening onto a single wide nave carrying the real
  spawn-to-exit lane), 4 hero-starts, a shop, a treasure, 4 symmetric
  hazard tiles baked as `fire` (the Ashen Sovereign baseline). Hand-authored
  and verified programmatically (row-width + role-position checks) before
  being wired into anything.
- New `systems/NamelessThroneSystem.ts` (pure, tested), mirroring
  `ReturningMinibossSystem.ts`'s exact shape: `resolveThroneVariant` (the
  tally/tie-break above), `withThroneVariant` (swaps the map's 4 hazard
  tiles to `water` for Hollow — same reference for Ashen), `withThrone
  EnemyReskins` (the same "spine clone, same reference when unchanged" swap
  `withReturningMinibossSwap` established, generalized to 4 id pairs).
- Six new enemy reskins in `data/enemies.ts` — verbatim stat clones (only
  `id`/`name`/`assetKey`/`loreText`/color differ), the same
  `corrupted-sorrel`-from-`tide-wretch` precedent: Ember Thane/Cinder
  Adept/Ashbound Honor Guard (fire-touched, from Warden/Hexer/Gravemaw) for
  the Ashen garrison; Drowned Thane/Hollow Caller/Drowned Honor Captain
  (drowned/withered, from Warden/Blightcaller/The Husk) for the Hollow
  garrison.
- `data/campaigns.ts`: new flat `CampaignDefinition` (`nameless-throne`), 6
  waves scaled above every region's own Ch4 finale (turnLimit 10→18,
  completionGold 22→95, finale spawns `ashen-sovereign`), a curated loot
  pool combining the fire- and frost-themed pools, appended to the END of
  `CAMPAIGNS`. New exported `REGION_CAMPAIGN_IDS` — single source of truth
  for the gating check and the test suite's own region filter.
- `systems/CampaignProgressSystem.ts`: new `areCampaignsCompleted(progress,
  campaignIds)` — the first "all of these ids" aggregate helper in the
  codebase.
- `scenes/CampaignSelectScene.ts`: the capstone card stays locked ("Complete
  all 6 regions to unlock") until `areCampaignsCompleted` against
  `REGION_CAMPAIGN_IDS` — the inverse of The Proving Ground's own single-id
  gate (D-184), reusing its visual pattern.
- `scenes/BattleScene.ts`: the variant resolves once at chapter/map-load
  (same spot the Saltmere swap runs, stored in a new `resolvedThroneVariant`
  field, same idiom as `saltmereReturningEnemyId`). A new intro beat
  (`showNamelessThroneIntroIfAny`, one link in the existing
  `showChapterIntroIfAny` chain) shows a variant-flavored line before wave
  1. A new victory-time epilogue (`showNamelessThroneEndingIfAny`, chained
  between `showChapterOutroIfAny` and `showEndScreen`): Ending A has the PC
  name every companion still on the roster (active or benched) out loud by
  reading `getCompanionDefinition(id).name`; Ending B has the PC reach for
  a name that isn't there.

**Tests**: new `tests/namelessThroneSystem.test.ts` (16 tests — tally/
tie-break coverage including the Sorrel-neutral and all-not-spared cases,
never-mutates-input and same-reference-when-unchanged checks for both swap
functions). `tests/campaigns.test.ts` needed a real fix, not just an
addition — it hardcoded `CAMPAIGNS.length === 7` and a region filter that
only excluded the prologue, which would have broken the moment the capstone
was appended; now built on the new `REGION_CAMPAIGN_IDS`, plus a new
capstone-specific describe block. `tests/campaignProgress.test.ts` gained
`areCampaignsCompleted` coverage. `tests/enemyRoster.test.ts`'s hardcoded
miniboss/minion role counts and its saving-throw-attacker allowlist both
needed updating for the 6 new reskins. `tests/regionBonusSystem.test.ts`'s
"every region has a bonus pool" check now also excludes the capstone,
matching the documented scope cut.

## Important files

- `src/game/data/namelessThroneMap.ts` — new: the capstone's fixed map.
- `src/game/systems/NamelessThroneSystem.ts` — new: `resolveThroneVariant`,
  `withThroneVariant`, `withThroneEnemyReskins`.
- `src/game/data/enemies.ts` — 6 new reskin entries + `ENEMY_COLORS`.
- `src/game/data/campaigns.ts` — new capstone `CampaignDefinition`,
  `NAMELESS_THRONE_WAVES`/`NAMELESS_THRONE_LOOT_POOL`, `REGION_CAMPAIGN_IDS`,
  `NAMELESS_THRONE_CAMPAIGN_ID`, `CAMPAIGN_MAPS` entry.
- `src/game/systems/CampaignProgressSystem.ts` — new `areCampaignsCompleted`.
- `src/game/scenes/CampaignSelectScene.ts` — capstone gating + locked hint.
- `src/game/scenes/BattleScene.ts` — variant resolution, intro beat,
  victory epilogue, new `resolvedThroneVariant` field.
- `tests/namelessThroneSystem.test.ts` — new.
- `tests/campaigns.test.ts`, `tests/campaignProgress.test.ts`,
  `tests/enemyRoster.test.ts`, `tests/regionBonusSystem.test.ts` — updated.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1466/1466** passing (1444 at session start).
- `npm run build` — production build succeeds, **141 modules** (139 → 141,
  +2 for the new map and system files).
- `npm run dev` — serves HTTP 200.

## Manual tests completed

None — no browser available in this environment. This is a brand-new
endgame screen, battle, and branching epilogue — see **KI-138**'s own
checklist in `KNOWN_ISSUES.md` for what Kevin should confirm (capstone
gating on a fresh 6-region-complete save, both ending variants' map
dressing/garrison/boss, both epilogue beats including a benched-companion
case, the non-spoiler card text, the breach-reads-as-Finished edge case, no
bonus-choice screen).

## Known issues

- **KI-138** (this session) needs Kevin's playtest confirmation.
- **KI-136**/**KI-137** (D-186/D-187) and **KI-129** through **KI-135** are
  unchanged and still need their own confirmation too, if that hasn't
  happened yet.
- Every other KI-1xx item from prior sessions is unchanged. **KI-113**
  (D-162's horizontal-squish mitigation) is still explicitly unconfirmed.

## Deferred items

- **CAMPAIGN_STORY_DESIGN.md's own design/build arc is now CLOSED** — every
  section (§2 through §8) is either built or an explicitly documented
  scope cut. Only two items remain, both already carried across many prior
  handoffs, neither picked up this session:
  - Full dialogue/arc writing for the original six Pool B companions
    (Ch1-3 beats, chapter-boundary reactions, homecoming beats) — still
    just one-line hooks.
  - Giving branch choices (Sorrel's Redeemed/Marked, the Finish/Spare
    choice, region-bonus picks) real mechanical weight beyond flavor text.
- The capstone's map layout, wave composition, enemy names/lore, and both
  flavor/epilogue beats are all first-pass writing/design — flag directly
  if any of it reads wrong once actually played.

## Next chat instructions

1. **Confirm D-188 with Kevin in a real playtest** before building more —
   see KI-138's checklist. This is the single biggest unplayed build in the
   whole item-13 epic; earlier KI items (KI-129 through KI-137) are also
   still worth confirming if that hasn't happened.
2. **If Kevin wants more item-13 work**: the only two things left are the
   two "still open" items above (companion dialogue writing, and giving
   branch choices real mechanical weight) — both are genuinely different in
   kind from everything built so far (writing/narrative-design work, not
   systems work), so confirm which one (if either) Kevin actually wants
   rather than assuming.
3. Keep verifying claims against the actual current code before building —
   this session's own research caught that `tests/campaigns.test.ts` would
   have broken immediately on appending the capstone (a hardcoded
   `CAMPAIGNS.length` and a prologue-only region filter), and that a
   miniboss "breaching" rather than being explicitly Finished/Spared has no
   dedicated flag anywhere — both handled as documented first-pass calls,
   not silent gaps.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/data/namelessThroneMap.ts` (new),
`src/game/systems/NamelessThroneSystem.ts` (new),
`src/game/data/enemies.ts`, `src/game/data/campaigns.ts`,
`src/game/systems/CampaignProgressSystem.ts`,
`src/game/scenes/CampaignSelectScene.ts`, `src/game/scenes/BattleScene.ts`,
`tests/namelessThroneSystem.test.ts` (new), `tests/campaigns.test.ts`,
`tests/campaignProgress.test.ts`, `tests/enemyRoster.test.ts`,
`tests/regionBonusSystem.test.ts`, plus doc updates (`DECISIONS.md`,
`KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`,
`CAMPAIGN_STORY_DESIGN.md`, `CONTENT_SOURCES.md`, this file). No
Firebase-relevant change this session.

## Handoff package contents

- [x] Source files: see "Important files" above
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-188 appended)
- [x] KNOWN_ISSUES.md (updated — KI-138 added)
- [x] CHANGELOG.md (updated — new Unreleased section)
- [x] CONTENT_SOURCES.md (updated — new row for the map/waves/6 reskins)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (updated — §9 addendum, §8's "not decided
      yet" question resolved)
- [x] PROJECT_STATUS.md (updated — new section added at the top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: 1444 → 1466
- [x] No node_modules, dist, secrets, or service-account credentials
