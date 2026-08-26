# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged. This session built the writing/
  mechanical-weight pass `CAMPAIGN_STORY_DESIGN.md` §9 had flagged as its
  last two open items: real dialogue for all 6 Pool B companions, and real
  mechanical weight for the Finish/Spare and Sorrel Redeemed/Marked branch
  choices. Kevin's own direct ask: "build a first pass at the dialogue and
  branching story lines now." Asked which of §9's two remaining items this
  covered, Kevin picked **both, full scope**.
- **Date:** August 26, 2026 (continuing the same standing-instruction
  session as every previous handoff since it was set).
- Tests: 1466 → **1482**. Typecheck, all 1482 tests, and the production
  build (**142 modules**, +1 for the new `companionDialogue.ts` file) all
  pass. `npm run dev` serves HTTP 200.

## What happened

### D-189 — Companion dialogue writing pass + real mechanical weight for branch choices

Researched before any code was written: 3 parallel Explore agents
(dialogue-box/chapter-intro-outro plumbing; every existing branch-choice
mechanism and its current mechanical weight; the companion/campaign data
model) plus a Plan agent, all cross-checked against the real current code —
every file:line reference in the resulting plan was verified directly
before it was trusted.

**Key discovery**: the presentation layer for both parts of this task
already existed, fully wired, with zero content. `ChapterDefinition.
introText`/`outroText` have been declared since D-177 and were already
read by `BattleScene.showChapterIntroIfAny`/`showChapterOutroIfAny` — but
not a single one of the 24 region chapters (6 regions × 4) had ever set
either field. Companion recruitment (`maybeUnlockHomeRegionCompanion`)
ended in a flat `logCombat` line, no dialogue beat at all. This made the
build almost entirely additive: new data plus a few small, precedented
BattleScene methods, no new rendering systems.

**The writing pass** (real first-draft prose, not placeholder text —
Kevin isn't a writer by his own description, explicitly "punch-up-able
rough material"):
- New `data/companionDialogue.ts`: `COMPANION_RECRUITMENT_DIALOGUE` (an
  arrival beat per Pool B companion, shown via the new
  `showCompanionRecruitmentIfAny`, replacing the old flat combat-log line)
  and `COMPANION_MIRROR_REACTION_DIALOGUE` (a "homecoming beat" — that
  companion's own reaction to their region's Ch4 mirror boss falling,
  shown via the new `showMirrorBossReactionIfAny`). Two entries (Fenna
  Duskwater/Saltmere, Isolde Varnhall/Frostbound) use a `{ ashen, hollow }`
  variant-pair shape instead of one fixed sequence, picked by the player's
  accumulated mercy-vs-expedience pattern.
- All 24 region chapters in `data/campaigns.ts` now have real `introText`/
  `outroText`.
- `BattleScene.ts`'s victory chain is now: `showChapterOutroIfAny →
  showMirrorBossReactionIfAny → showCompanionRecruitmentIfAny →
  showNamelessThroneEndingIfAny → showEndScreen`. Both new methods reuse
  `this.chapterDialogue`, already covered by `inputLocked()`.

**The mechanical-weight pass** (deliberately bounded — reuses only proven
mechanisms, no changes to level-up/ASI/subclass selection, no new
branch-choice chains for the other 5 companions):
- Sparing any of the 5 home minibosses now grants an immediate
  `SPARE_MERCY_GOLD_REWARD` (20 gold flat) in `showSparableKillChoice`'s
  `spare` callback.
- Sorrel's Redeemed outcome grants a real reward
  (`SORREL_REDEEMED_REWARD_EQUIPMENT_ID = "staff-of-healing"`) via a new
  shared `grantEquipmentOrSellForGold(itemId, sourceLabel)` —
  `grantRegionBonusEquipment` was refactored into a thin wrapper around it
  rather than duplicating the equip-or-sell logic. Marked grants a real but
  smaller `SORREL_MARKED_GOLD_REWARD` (25 gold). Closes the D-185
  addendum's own "Redeemed/Marked flavor-only" gap.
- `NamelessThroneSystem`'s existing ashen/hollow tally (previously
  capstone-only) was extracted into a new exported, pure
  `computeMercyTally`/`mercyTallyLeansHollow` — a byte-for-byte-behavior-
  preserving refactor (`resolveThroneVariant`'s own tie-break-to-Ashen rule
  is unchanged) — so the new dialogue-tone reactivity reads the exact same
  signal the capstone ending already does.

**Tests**: new `tests/companionDialogue.test.ts` (structural/reference
checks — every Pool B id present in both dialogue maps, no Pool A id in
either, `speakerName` matches the real companion name, exactly Fenna/
Isolde use the tone-reactive shape). `tests/namelessThroneSystem.test.ts`
gained `mercyTallyLeansHollow` coverage plus a cross-check against
`resolveThroneVariant` proving the extraction didn't change behavior.
`tests/returningMinibossSystem.test.ts`/`tests/sorrelFateSystem.test.ts`
gained reward-constant sanity checks. `tests/campaigns.test.ts` gained a
"every region chapter has real intro/outroText" assertion.

This closes **both** of `CAMPAIGN_STORY_DESIGN.md` §9's remaining "still
open" items — that design doc's entire §2-§9 arc is now fully closed, no
open items remain in it except §8's own already-flagged "exact bonus pool
numeric budgets" (a separate, much smaller balance-tuning item).

## Important files

- `src/game/data/companionDialogue.ts` — new: `COMPANION_RECRUITMENT_
  DIALOGUE`, `COMPANION_MIRROR_REACTION_DIALOGUE`.
- `src/game/data/campaigns.ts` — `introText`/`outroText` filled in on all
  24 region `ChapterDefinition` literals.
- `src/game/systems/NamelessThroneSystem.ts` — new `computeMercyTally`,
  `mercyTallyLeansHollow`; `resolveThroneVariant` now calls the former.
- `src/game/systems/ReturningMinibossSystem.ts` — new
  `SPARE_MERCY_GOLD_REWARD`.
- `src/game/systems/SorrelFateSystem.ts` — new
  `SORREL_REDEEMED_REWARD_EQUIPMENT_ID`, `SORREL_MARKED_GOLD_REWARD`.
- `src/game/scenes/BattleScene.ts` — new `pendingCompanionRecruitment`
  field; new `showCompanionRecruitmentIfAny`, `showMirrorBossReactionIfAny`,
  `grantEquipmentOrSellForGold`, `grantSorrelRedeemedReward` methods;
  `maybeUnlockHomeRegionCompanion`, `resolveSorrelFateIfAny`,
  `showSparableKillChoice`'s `spare` callback, and the victory-phase chain
  all updated.
- `tests/companionDialogue.test.ts` — new.
- `tests/namelessThroneSystem.test.ts`, `tests/returningMinibossSystem.
  test.ts`, `tests/sorrelFateSystem.test.ts`, `tests/campaigns.test.ts` —
  updated.

## Commands verified

- `npm run typecheck` — clean.
- `npm test -- --run` — **1482/1482** passing (1466 at session start).
- `npm run build` — production build succeeds, **142 modules** (141 → 142,
  +1 for the new `companionDialogue.ts` file).
- `npm run dev` — serves HTTP 200.

## Manual tests completed

None — no browser available in this environment. This is brand-new
dialogue content and reward wiring spanning all 6 regions — see **KI-139**
in `KNOWN_ISSUES.md` for the full checklist Kevin should confirm (arrival
beats, Ch4 reaction beats including the ashen/hollow tone split on Fenna/
Isolde, the spare-mercy gold line, Sorrel's Redeemed/Marked rewards).

## Known issues

- **KI-139** (this session) needs Kevin's playtest confirmation.
- **KI-138** (D-188, The Nameless Throne capstone) is still unconfirmed —
  this is now the single biggest unplayed build in the item-13 epic,
  predating this session.
- **KI-136**/**KI-137** (D-186/D-187) and **KI-129** through **KI-135** are
  unchanged and still need their own confirmation too, if that hasn't
  happened yet.
- Every other KI-1xx item from prior sessions is unchanged. **KI-113**
  (D-162's horizontal-squish mitigation) is still explicitly unconfirmed.

## Deferred items

- **`CAMPAIGN_STORY_DESIGN.md`'s design/build arc is now fully closed** —
  every item across §2 through §9 is either built or an explicitly
  documented scope cut. The only thing left in that doc at all is §8's own
  already-flagged "exact bonus-choice pool numeric budgets per region" —
  a balance-tuning pass, not new scope, and not picked up this session.
- All the writing/wiring in this session is genuinely first-pass —
  dialogue tone, chapter narration, and reward amounts are all reasonable
  first guesses, not tuned or playtested. Flag directly if any of it reads
  wrong once actually played, same as every other new-content session.

## Next chat instructions

1. **The item-13 epic (the whole overworld campaign) now has TWO large
   unplayed builds stacked up**: this session's D-189 and the prior
   session's D-188 (the capstone). If Kevin has playtest time, confirming
   these — especially the capstone, since it's the bigger/riskier of the
   two — should come before more new content in this area.
2. **If Kevin wants more work with no playtest time available**: per
   `feedback_pick_browser_independent_work_when_no_playtest_time` in
   memory, prefer headless-verifiable work. `CAMPAIGN_STORY_DESIGN.md`
   itself has nothing meaningfully open left except the §8 numeric-budget
   tuning pass (small). Check `KNOWN_ISSUES.md` for any other open,
   verifiable-without-browser item, or ask Kevin directly what's next —
   the last several sessions have all been item-13 continuations; there
   may be other parts of the game he'd rather return to now that this
   design doc's own arc is closed.
3. Keep verifying claims against the actual current code before building —
   this session's own research caught that the design doc's original
   "starting trio already in the party" framing for Hollis/Fenna/Isolde
   doesn't match the shipped recruitment mechanic (all 6 Pool B companions
   recruit identically, on their own home region's Ch1 clear) — the
   existing `hook` text already accounted for this correctly, but it's
   worth remembering if more companion-facing content gets built later.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched: `src/game/data/companionDialogue.ts` (new),
`src/game/data/campaigns.ts`, `src/game/systems/NamelessThroneSystem.ts`,
`src/game/systems/ReturningMinibossSystem.ts`,
`src/game/systems/SorrelFateSystem.ts`, `src/game/scenes/BattleScene.ts`,
`tests/companionDialogue.test.ts` (new), `tests/namelessThroneSystem.
test.ts`, `tests/returningMinibossSystem.test.ts`, `tests/
sorrelFateSystem.test.ts`, `tests/campaigns.test.ts`, plus doc updates
(`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`,
`CAMPAIGN_STORY_DESIGN.md`, `CONTENT_SOURCES.md`, this file). No
Firebase-relevant change this session.

## Handoff package contents

- [x] Source files: see "Important files" above
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-189 appended)
- [x] KNOWN_ISSUES.md (updated — KI-139 added)
- [x] CHANGELOG.md (updated — new Unreleased section)
- [x] CONTENT_SOURCES.md (updated — new row for the dialogue content)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (updated — §9 addendum, both remaining
      open items resolved)
- [x] PROJECT_STATUS.md (updated — new section added at the top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: 1466 → 1482
- [x] No node_modules, dist, secrets, or service-account credentials
