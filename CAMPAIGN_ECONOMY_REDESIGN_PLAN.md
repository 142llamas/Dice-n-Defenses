# Campaign Economy Redesign — Plan

**STATUS: ALL 6 PLANS SHIPPED (2026-09-10) — D-242, D-244, D-243, D-245,
D-246, D-247.** This document is now historical reference, not an active
backlog — see each plan's own "SHIPPED as D-NNN" note below for what
actually landed (a few details changed from the original scoping during
implementation). Only Kevin's own in-browser playtest of the whole arc
remains open (`KNOWN_ISSUES.md` KI-191 through KI-195).

Born from Kevin's 2026-09-09 follow-up to Batch D's Party Inventory scoping
question: the discovery that "generalize PartyInventorySystem" had no real
discard bug left to fix (see `PHASE_HANDOFF.md`'s Batch D section, and
`DECISIONS.md`/`KNOWN_ISSUES.md` for that day's session) led to a much
bigger idea — **gold that actually persists across the whole campaign,
replacing the campaign PC's point-buy "Gear Points" system, with the
in-battle Armory removed entirely for campaign battles** (gear only handled
between missions; in-battle economy action is build-mode only). Free Play
is explicitly **unaffected** by everything in this document — it keeps its
current per-battle gold, its current in-battle Armory, no changes.

Same convention as `PARTY_CREATION_OVERHAUL_PLAN.md`: each numbered plan
below is a candidate for its own session/`D-NNN`. Unlike that doc, these
plans have real sequencing dependencies (noted per-plan) — this is NOT a
"pick up in any order" backlog. **Researched via two dedicated Explore
agents reading the real current code** (`CharacterCreationScene.ts`,
`GearShopScene.ts`, `GearCompareSystem.ts`, `GearFilterSystem.ts`,
`PartyInventorySystem.ts`, `CompanionRosterSystem.ts`, `EconomySystem.ts`,
`RewardSystem.ts`, `CampaignProgressSystem.ts`, `CampaignLevelSystem.ts`,
`RegionBonusSystem.ts`, `difficulty.ts`, `BattleScene.ts`,
`CampaignSelectScene.ts`) before this plan was written — every file:line
citation below was verified directly, not assumed from memory. Two real
scope forks were resolved with Kevin directly before writing this (gold
vs. Gear Points, in-battle Armory removal) — see the decisions section
below for his exact answers.

**Status: this document is a scoping deliverable only.** Kevin explicitly
chose "pause Batch D, scope the economy redesign instead" — nothing below
has been implemented. The next session should read this doc, confirm the
"Open questions" section with Kevin, then start executing Plan 1.

## Decisions confirmed with Kevin (2026-09-09)

1. **Persistent campaign gold REPLACES Gear Points entirely** (not
   alongside it). The PC's current point-buy budget
   (`DifficultyDefinition.startingGearPoints`, `startingGearPointCost`)
   goes away; a real, earned, spent, carried-across-chapters gold balance
   takes its place.
2. **The in-battle Armory is removed entirely for campaign battles.**
   Campaign battles keep build-mode (structures/traps) as their only
   in-battle economy action. Free Play's in-battle Armory is unchanged.
3. (His original framing, not yet broken into a yes/no, carried into Plan 6
   below): gold needs to be scarce enough per-mission that a player can't
   snowball early levels into an easy final stretch — explicitly flagged
   by Kevin as needing its own tuning pass, "more true to D&D anyway."

## Status at a glance

| Plan | Title | Depends on | Status |
|---|---|---|---|
| 1 | `CampaignGoldSystem` — new persistent currency + difficulty levers | none | **DONE (D-242)** |
| 2 | Wire real gold sources into the persistent pool | Plan 1 | **DONE (D-244)** |
| 3 | Between-missions Armory scene | Plan 1 (done), **Batch D items 3/5** (done, D-241) | **DONE (D-243)** |
| 4 | Remove in-battle Armory for campaign battles | none (can ship independently) | **DONE (D-245)** |
| 5 | Retire Gear Points — PC equips from owned pool, like a companion | Plan 3 | **DONE (D-246)** |
| 6 | Gold-scarcity tuning pass | Plan 1-5 live in a real build | **DONE (D-247)** |

**Plan 1 shipped as D-242** — `CampaignGoldSystem.ts` (persistent gold
state + earn/spend mutators), `DifficultyDefinition.startingCampaignGold`/
`.campaignGoldMultiplier` (defined, not yet read by anything), and the
"Reset Campaign Progress" button now also resets gold to default. See
`DECISIONS.md` D-242 for full detail.

**Plan 3 shipped as D-243** — the new `CampaignArmoryScene.ts`, gated on
`!!getPcBuild(roster)` at every `CharacterCreationScene` hand-off point (so
it never shows before Chapter 1), full rarity for both PC and companions
(a real fix, `pinnedGearIds`, closes the PC's common/uncommon round-trip
gap that a rarer purchase would otherwise silently drop), and a new
`companionPurchasedGear` layer so a companion's Armory purchases/sales
survive a later Character Creation visit. Also adds the pool-entry Sell
action this doc asked for. See `DECISIONS.md` D-243 and `KNOWN_ISSUES.md`
KI-191 (a real playtest checklist — this is genuinely player-visible,
unlike Plan 1) for full detail. Plans 2 and 4 both now have zero remaining
blockers.

**Plan 2 shipped as D-244** — kill/wave gold and region-bonus gold both now
credit `CampaignGoldSystem` at chapter-victory, scaled by
`campaignGoldMultiplier`. Two deliberate departures from this section's
original wording below, both explained in `DECISIONS.md` D-244: (1) a new
GROSS `campaignRewardGoldEarned` counter is used instead of the victory
screen's `goldEarned` (which nets against in-battle spending — reusing it
directly would have punished a player for using the still-live in-battle
Armory); (2) region bonus gold accumulates toward that same counter
(credited only at REAL chapter-victory) rather than crediting
`CampaignGoldSystem` immediately at grant time — the bonus choice
re-offers on every chapter retry, so an immediate credit would let a
lose-and-retry loop farm free permanent gold. See `KNOWN_ISSUES.md` KI-192
for the playtest checklist.

**Plan 4 shipped as D-245** — the in-battle Armory ("Gear (G)" button, `G`
key, and all four buy/sell entry points) is now fully gated off for any
campaign battle, exactly as scoped below: purely subtractive, all in
`BattleScene.ts`, no changes to `GearShopScene.ts` itself. See
`DECISIONS.md` D-245 and `KNOWN_ISSUES.md` KI-193 for the playtest
checklist — this is the first session in the arc that genuinely removes
player-visible functionality rather than adding it.

**Plan 5 shipped as D-246 — this closes the ENTIRE gameplay-changing arc.**
Gear Points is fully retired. The one gap this section never addressed — a
brand-new Chapter 1 PC has no Armory to shop at yet, so a free pick had to
come from SOMEWHERE — was confirmed directly with Kevin: a fixed,
non-editable per-class starting kit (`defaultStartingGearForClass`,
reusing that class's own companion's exact kit) replaces the free pick
entirely, rather than keeping a scoped-down version of Gear Points around
just for Chapter 1. See `DECISIONS.md` D-246 and `KNOWN_ISSUES.md` KI-194
for the full design and playtest checklist.

**Plan 6 shipped as D-247 — THIS DOCUMENT IS NOW FULLY DONE, all 6 plans
shipped.** Done WITHOUT a real playtest of Plans 1-5 first (this plan's
own stated dependency) — none of KI-186 through KI-194 were confirmed yet;
Kevin was asked directly and chose a reasoned first-pass tune over
waiting. A real numeric trace (not a guess) found the un-tuned D-242
`campaignGoldMultiplier` defaults likely let a Normal-difficulty player
afford most of the rare/veryRare gear ladder well before the campaign's 24
missions end, since `ShopSystem`'s rarity-unlock levels are all reached by
~chapter 3 of the very first region. Fix: `campaignGoldMultiplier` roughly
halved at every tier (Normal included — D-242's "pin Normal to 1.0" cross-
lever convention was deliberately broken here, confirmed with Kevin).
`startingCampaignGold`/region-bonus gold amounts were left untouched. See
`DECISIONS.md` D-247 and `KNOWN_ISSUES.md` KI-195 for the full analysis
and playtest checklist.

## Why this depends on Batch D (still paused, not abandoned)

Batch D's original ask (items 3/5: rebuild `CharacterCreationScene`'s gear
picker into a shared component structurally matching `GearShopScene` — see
`PHASE_HANDOFF.md`) turns out to be a **prerequisite** for Plan 3, not just
a cosmetic parity nice-to-have. Right now `GearShopScene.ts`'s sidebar +
catalog + compare-strip rendering (`buildHeroSidebar`, `buildSlotTabs`,
`buildCompareStrip`/its 3 variants, `buildCatalog`, `buildActionButton` —
1136 lines total) has **zero abstraction boundary** between "how to render
a gear shop" and "how `BattleScene`'s live, per-battle `EconomySystem`
backs it." Building Plan 3's between-missions Armory as a **second
copy-pasted scene** would duplicate that whole rendering layer a second
time, then need every future gear-UI fix applied twice forever — exactly
the kind of duplication Batch D was already trying to eliminate. Doing
Batch D first (extracting the shared rendering component, parameterized
over a "backend": Armory = live `BattleScene` + gold; Character Creation =
free/no-economy) means Plan 3 becomes "write one more backend" instead of
"build a whole scene from scratch." **Recommended sequencing: Batch D →
Plan 1 → Plan 3 → Plan 4 → Plan 5 → Plan 2 can slot in any time after Plan
1 → Plan 6 last, once there's a real build to playtest.**

---

## Plan 1 — `CampaignGoldSystem`: new persistent currency + difficulty levers

**SHIPPED as D-242 — see `DECISIONS.md` for the full writeup.** Left below
as reference for what was actually built.

**No dependency — can start immediately, including before Batch D.**

Confirmed via code investigation: **zero partial/hidden persistent-gold
mechanism exists anywhere today.** `EconomySystem` is constructed fresh
every `BattleScene.create()` (`BattleScene.ts:1345`,
`this.economy = new EconomySystem(startingGoldByOwner)`) from
`STARTING_GOLD = 20` (`config.ts:49`) + a per-background bonus
(`BackgroundDefinition.startingGold`, `data/backgrounds.ts:49`), and is
simply discarded when the scene tears down — nothing reads a prior
battle's ending balance. `CampaignProgressSystem.ts`'s persisted
`CampaignProgress` (`completedIds`, `completedChapters`) and
`CompanionRosterSystem.ts`'s persisted `CompanionRosterState` both have no
currency field either.

**The exact precedent to replicate**: `CampaignLevelSystem.ts` — "one
persistent number read back into every battle across the whole campaign."
Its shape:
```ts
export interface CampaignLevelState { campaignLevel: number; }
export const DEFAULT_CAMPAIGN_LEVEL_STATE: CampaignLevelState = { campaignLevel: 1 };
```
own `localStorage` key (`config.ts:68`), own `loadCampaignLevel`/
`saveCampaignLevel` pair, a monotonic `raiseCampaignLevel` mutator (never
lowers), and — critically — a **migration/backfill function**
(`highestReachedCampaignLevel`) for saves made before the field existed,
deriving a sane value from already-completed chapters instead of
regressing a mid-campaign player back to the default. Build
`CampaignGoldSystem.ts` as its own small file (matching the project's
"one system, one job" convention both `CampaignLevelSystem.ts:9-15` and
`CampaignProgressSystem.ts:13-18` state explicitly), own storage key, own
load/save, `earnCampaignGold`/`spendCampaignGold` mutators.

**Old-save gold backfill — confirmed with Kevin: flat default (option A).**
Unlike campaign level (cleanly inferable from completed chapters, since
leveling is deterministic per chapter), there is no clean way to
reconstruct a plausible gold balance for an EXISTING mid-campaign save
that predates this system — the player's actual gold-earning history isn't
recorded anywhere. An old save just starts at the same flat default a
fresh campaign would (no attempt to estimate from `completedChapters`/
`campaignLevel`) — simplest option, confirmed acceptable.

**Difficulty levers (new fields on `DifficultyDefinition`,
`data/difficulty.ts`)**: confirmed today's difficulty tiers have **no gold
multiplier of any kind** — `enemyCountMultiplier`/`enemyHpMultiplier`/
`startingGearPoints`/`companionDiscretionaryGearSlots`/the D-217
threat-budget fields exist, but every gold number in the game
(`STARTING_GOLD`, every `rewardGold`/`completionGold`/`timeBonusGold` in
`enemies.ts`/`waves.ts`, every region-bonus gold amount) is flat and
un-multiplied — this is confirmed on the record already (`DECISIONS.md`
D-194: *"no gold/gear difficulty-scaling precedent existed anywhere else in
the codebase"*). Also note the existing asymmetry this creates today: a
harder difficulty already spawns MORE enemies (`enemyCountMultiplier`) who
each still drop their full flat `rewardGold` — so raw kill-gold currently
goes UP with difficulty even as `startingGearPoints` goes down. A
scarcity-tuned campaign economy needs new field(s) — e.g.
`campaignGoldMultiplier` applied to whatever Plan 2 credits to the
persistent pool — added fresh, not a rewire of an existing lever. Actual
numbers are Plan 6's job (needs a real playtest), but the FIELD should
exist from Plan 1 so Plan 2 has somewhere to read a multiplier from.

**A PC needs a starting kit before Chapter 1 exists.** Recommend: replace
`startingGearPoints`'s structural role with a flat
`startingCampaignGold`-per-difficulty value (same per-tier shape as
`startingGearPoints`'s 12/9/6/4), granted once at campaign start, spent in
a pre-Chapter-1 visit to Plan 3's between-missions Armory — this is
genuinely "more true to D&D" (starting gold to buy your kit) while
reusing real currency instead of an abstract point-buy tied to one screen.

---

## Plan 2 — Wire real gold sources into the persistent pool

**SHIPPED as D-244 — see `DECISIONS.md` for the full writeup.** Left below
as reference; the actual implementation departs from this section's
literal wording in two places (a gross-earned counter instead of reusing
`goldEarned`; region bonus gold accumulates rather than crediting
immediately) — both explained in D-244.

**Depends on Plan 1** (needs `CampaignGoldSystem` to exist).

Two existing gold sources currently just inflate the doomed-to-be-discarded
per-battle `EconomySystem` and need to instead (or additionally) credit
`CampaignGoldSystem` at chapter-victory:

- **Mission kill/wave gold**: `RewardSystem.ts`'s `killGold()`/
  `waveReward()` (flat per-enemy/per-wave amounts, `enemies.ts`/`waves.ts`)
  already feed `this.economy` during a campaign battle even with the
  in-battle Armory gone (Plan 4) — there's no reason to stop tracking it,
  it just needs a new destination. `BattleScene.ts:10553` already computes
  `goldEarned` (this battle's net gain) purely for the victory-screen
  display — that computation is *reusable* as the exact amount to credit
  into `CampaignGoldSystem` at the same chapter-victory point
  `campaignLevel` is already written back (`markCampaignCompletedIfAny`,
  `BattleScene.ts:7429-7435`).
- **Region bonus gold**: `RegionBonusSystem`'s "gold" bonus option
  (`grantRegionBonusGold`, `BattleScene.ts:1592-1596`) currently does
  `this.economy.award(...)` — retarget this one call to
  `CampaignGoldSystem` instead. Region gold amounts already exist and
  escalate sensibly by region (`data/regionBonuses.ts`: Emberford
  15g/25g → Frostbound 45g/65g) — a reasonable existing scarcity curve to
  build on rather than invent from scratch.

**Explicitly NOT in this plan's scope** (belongs to the already-planned,
still-unstarted **Batch E**, `PHASE_HANDOFF.md`): `RegionBonusSystem`'s
missing dominance check (two gold tiers can appear in the same 3-option
draw) and moving the bonus-choice step to before Character Creation. Batch
E and this plan touch the exact same code (`grantRegionBonusGold`,
`showRegionBonusChoiceIfAny`) — **sequence Batch E's reorder/dominance fix
together with (or immediately after) this plan**, not independently, to
avoid two sessions both rewriting the same function back-to-back.

---

## Plan 3 — Between-missions Armory scene

**SHIPPED as D-243 — see `DECISIONS.md` for the full writeup.** Left below
as reference for what was originally scoped; a few details changed during
implementation (full rarity instead of a common/uncommon cap, and the
scene skips entirely before Chapter 1 rather than showing a companions-only
view) — both confirmed with Kevin before building, see D-243.

**Depends on Plan 1 and, ideally, Batch D** (see "Why this depends on
Batch D" above — buildable without it, but duplicates rendering code that
would then need to converge later).

**No existing seam in the scene flow today** — confirmed by tracing the
whole campaign loop: victory goes straight `BattleScene →
CampaignSelectScene` (`endOverlayDestination`, `BattleScene.ts:10531-10533,
10588`, no intermediate scene), and mission setup goes straight
`CampaignSelectScene → (UnlockMissionPartyScene, if recruiting →)
CharacterCreationScene` (`CampaignSelectScene.ts:382-397`). A new scene is
required — **confirmed with Kevin: the
`CampaignSelectScene → CharacterCreationScene` seam** (same hand-off
pattern `UnlockMissionPartyScene` already uses: pass `{ campaignId,
chapterIndex, difficultyId }` forward), shopping before the next fight,
NOT the post-victory seam.

**Scope**:
- New scene (e.g. `CampaignArmoryScene.ts`), built on whatever shared
  rendering component Batch D produces — same sidebar (all 4 party
  members, not just the PC — companions should be gear-upgradeable here
  too, matching what the in-battle Armory already allows today for any
  hero, not just the PC) + catalog + compare-strip shape as the in-battle
  Armory, backed by `CampaignGoldSystem` instead of a live `BattleScene`'s
  `EconomySystem`.
- **Closes out Batch D's original "sellable Party Inventory view" ask** as
  a side effect, not a separate screen: the catalog should also surface
  currently-unclaimed `PartyInventorySystem` pool entries (today only
  reachable via `CharacterCreationScene.openPoolPicker`'s claim-only flow,
  `CharacterCreationScene.ts:3122-3185`) with a real Sell action crediting
  `CampaignGoldSystem` — this is genuinely new work (today's pool-claim UI
  has no sell action at all, by design, since Character Creation has no
  economy), not something that falls out for free.
- Companions' existing fixed/authored kit + discretionary difficulty-trim
  (`companionStartingGearForDifficulty`, `data/characterCreation.ts:134-156`)
  is UNCHANGED by this plan — that stays each companion's floor/baseline.
  What's new is the ability to spend campaign gold on top of that floor,
  same as the in-battle Armory already lets you do for a companion today.

---

## Plan 4 — Remove the in-battle Armory for campaign battles

**SHIPPED as D-245 — see `DECISIONS.md` for the full writeup.** Left below
as reference for what was originally scoped; the implementation matched
this section almost exactly, with one addition not called out below: the
banner-width safety math (`bannerMaxWidth`) also had to branch, reclaiming
the Gear button's now-unused horizontal space rather than leaving the
banner needlessly more cramped than it has to be.

**No dependency — can ship independently of every other plan here**,
including before Plan 1, since it's purely subtractive/gating and doesn't
need anywhere else for that gold to go yet (though shipping it before Plan
3 exists would leave campaign players with literally no way to buy gear at
all — sequence the actual PUBLIC rollout after Plan 3, even if the code
change itself could land earlier).

Confirmed: `GearShopScene.ts` itself has **zero** `campaignId` references
(it holds no game-rule logic, per its own header comment,
`GearShopScene.ts:65-70` — everything routes through `BattleScene`). All
gating must happen in `BattleScene.ts`, at five points, **none of which
have any existing `campaignId` scaffolding to build on**:
1. `openGearShop()` (`BattleScene.ts:8077-8100`) — add a `campaignId` early
   return (with an explanatory combat-log message, same convention as the
   existing "Move a hero to a Shop tile" message,
   `BattleScene.ts:8094-8097`).
2. The unconditional `G` keydown binding (`BattleScene.ts:5118`).
3. The HUD "Gear (G)" button, built unconditionally
   (`BattleScene.ts:2612-2628`) — its horizontal position (`gbx`) feeds
   `bannerMaxWidth`/`gearLeftEdge` layout math shared with other always-present
   HUD elements, so hiding it for campaign mode needs that layout math to
   branch too, not just toggle visibility.
4-7. `buyGearForHero`/`sellGearFromHero`/`buyPotionForHero`/
   `sellPotionFromHero` (`BattleScene.ts:7987, 8021, 8035, 8060`) — belt-
   and-suspenders `campaignId` guards even though (1)-(3) should make these
   unreachable in practice.

Free Play is entirely unaffected — none of `isAnyHeroNearShop()`'s
Shop-tile logic, `shopGateReason`, or any other existing gate changes for
it.

---

## Plan 5 — Retire Gear Points; PC equips from the owned pool like a companion

**SHIPPED as D-246 — see `DECISIONS.md` for the full writeup.** Left below
as reference; one real gap in this section's own scoping was found and
resolved before writing any code — it never addressed where a BRAND-NEW
Chapter 1 PC (no Armory to shop at yet) gets their first kit from once
Gear Points is gone. Confirmed with Kevin (three options offered): a fixed,
non-editable per-class starting kit, reusing that class's own companion's
exact kit — not the free-pick catalog kept alive just for Chapter 1, and
not an empty/naked starting hero either.

**Depends on Plan 3** (needs somewhere to have actually bought gear
first).

Confirmed: Gear Points affects **only the PC (slot 0)** —
`gearPointsOverBudget`/`gearPointsSpent` are checked exclusively for slot 0
(`CharacterCreationScene.ts:2363-2366, 2703-2710`), and every companion
already uses the wholly separate `companionStartingGearForDifficulty`
mechanism untouched by this plan. Once Plan 3 exists, the PC's
`openGearPicker` (currently a free pick from a fixed common/uncommon
catalog, `startingGearIdsForSlotType`, budget-gated by
`startingGearPointCost`) becomes unnecessary in its current form — replace
it with the same "equip from what's actually owned" flow a
`gearLocked` companion effectively has today, sourced from whatever the PC
purchased in Plan 3's Armory (their own owned-item set, or claimed via the
existing shared pool-claim mechanic, `openPoolPicker`,
`CharacterCreationScene.ts:3122-3185`, already built and already available
to every slot regardless of `gearLocked`). This is a genuine
**simplification** — `openGearPicker`'s ~2400-3100-line catalog/budget
logic (`CharacterCreationScene.ts`) can shrink once "free pick within a
point budget" is no longer a concept, not grow.

Delete at this point (not before — keep them until this plan actually
ships, so nothing breaks mid-transition): `DifficultyDefinition
.startingGearPoints`, `startingGearPointCost`
(`data/characterCreation.ts:104-117`), and `gearPointsSpent`/
`gearPointsOverBudget` (`CharacterCreationScene.ts:2363-2366, 2703-2710`).

---

## Plan 6 — Gold-scarcity tuning pass

**SHIPPED as D-247 — see `DECISIONS.md` for the full writeup.** Left below
as reference. Kevin explicitly chose to have this done WITHOUT waiting for
the real playtest this section calls for below — asked directly, he
preferred a reasoned first-pass tune now over waiting.

**Depends on Plans 1-5 existing in a real, playable build.**

Kevin's own stated concern: a player shouldn't be able to snowball early
missions into an easy final stretch. This is explicitly a numbers-tuning
problem, not a systems problem — every other balance pass in this
project's history (D-173, D-224, D-229, etc.) has shipped "first-pass/
untuned" and waited for Kevin's own playtest gut-check rather than
guessing at final numbers up front. Candidates to tune once the above
exists: `campaignGoldMultiplier` (Plan 1's new difficulty field),
`startingCampaignGold` per tier, region-bonus gold amounts
(`data/regionBonuses.ts`), and whether kill-gold vs. wave-completion-gold
vs. region-bonus-gold should carry different weights toward the
scarcity goal (e.g. reward clearing efficiently over grinding kills, or
vice versa). Do not attempt to pre-guess these numbers as part of Plans
1-5 beyond a reasonable, clearly-flagged-as-placeholder first pass.

---

## Open questions — RESOLVED (confirmed with Kevin, 2026-09-09)

1. **Old-save gold backfill** (Plan 1): **Option A — flat default.** An
   existing mid-campaign save with no persisted gold record starts at the
   same flat baseline a fresh campaign would, no attempt to estimate a
   "should-have-earned" amount from progress.
2. **Companion gear scope** (Plan 3): **the PC manages the whole party's
   gear.** Confirmed as "the whole party's," not "PC-only" — the
   between-missions Armory covers all 4 party members, matching what
   today's in-battle Armory already allows for any hero.
3. **Seam placement** (Plan 3): **the
   `CampaignSelectScene → CharacterCreationScene` seam, shop before the
   next fight** — not the post-victory seam. Confirmed as originally
   recommended.

All three plans above are updated to state these as confirmed decisions,
not open questions — nothing below this line is still waiting on Kevin.
