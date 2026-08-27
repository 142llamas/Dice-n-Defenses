# Party & Character Creation Overhaul — Plan

Born from Kevin's first real playtest pass of Character Creation and
campaign party creation (2026-08-26 — see his raw notes preserved at the
bottom of this doc). This doc is the roadmap future sessions work through,
same convention as `KNOWN_ISSUES.md`'s old KI-098 backlog: each mini-plan
below is independent and can be picked up in any order EXCEPT **Plan 0,
which should ship first** (cheap, currently-broken bugs, confirmed with
Kevin directly). When a mini-plan (or a sub-item within one) ships, it gets
its own `D-NNN` in `DECISIONS.md` and its own `KI-NNN` in `KNOWN_ISSUES.md`
tagged `(Party Creation Overhaul, Plan N)`, and this doc's own status line
for that item flips to **DONE**, same as the KI-098 list's own convention.

Researched via a dedicated Explore agent reading the real current code
(`CharacterCreationScene.ts`, `LevelUpPlanSystem.ts`,
`SpellPreparationSystem.ts`, `Hero.ts`, `CompanionRosterSystem.ts`, etc.)
before this plan was written — every file:line citation below was verified
directly, not assumed from memory. Three real scope forks were resolved
with Kevin directly before writing this (party-inventory semantics,
ability-score UX, blueprint scope) — see each relevant plan for his exact
answer.

## Status at a glance

| Plan | Title | Status |
|---|---|---|
| 0 | Bug-fix pass | ALL DONE (D-190, 0.6 by D-202) |
| 1 | Ability-score assignment UX | DONE (D-192) — needs Kevin's browser pass, see KI-142 |
| 2 | Starting equipment + party inventory | ALL DONE (D-193, D-194, D-197) |
| 3 | Campaign party/character persistence | ALL DONE (D-195), including 3.4 |
| 4 | Hero stat display (AC replaces Atk/Range) | DONE (D-196) |
| 5 | AI-hero level-up defaults + Human/AI toggle clarity | DONE (D-198) — needs Kevin's browser pass, see KI-148 |
| 6 | Level-up blueprint library (incl. spell-pick planning) | DONE (D-199) — needs Kevin's browser pass, see KI-149 |
| 7 | Level-progression reference screen | DONE (D-200) — needs Kevin's browser pass, see KI-150 |
| 8 | Apply the D-123 ornate/parchment theme to Character Creation | DONE (D-191) — needs Kevin's browser pass, see KI-141 |

**Recommended sequencing**: Plan 0 → Plan 8 → everything else. Plan 8 is
cheap (reusing an existing, already-proven component library) and should
land BEFORE Plans 1-3/6 build a bunch of new UI (dropdowns, party
inventory panel, blueprint picker) on top of the current plain style —
building new UI once, in the right style, beats building it plain and
restyling it later. See Plan 8 below for why this is different from the
(still genuinely deferred) real-artwork pass.

One item from Kevin's original notes is **not** on this list as a
standalone plan — see Plan 6, which now absorbs it.

---

## Plan 0 — Bug-fix pass (do this first) — ALL DONE (D-190, 0.6 by D-202)

0.1-0.5 shipped the same session this plan was written — see
`DECISIONS.md` D-190 and `KNOWN_ISSUES.md` KI-140 for the confirmation
checklist. 0.6 (hero names) sat open for several sessions needing a
repro that never came; Kevin ultimately asked to fix the one concrete
defect static reading DID find anyway, without a repro — see D-202 and
KI-152 (explicitly flagged there as unconfirmed against his original
report, in case it turns out to be a different bug).

### 0.1 — Class/Race row-label text overflow
`CharacterCreationScene.ts:1388` (Class label) and `:1389` (Race label)
never call `fitLabelToColumnWidth` — unlike the Subclass row (`:1412-1413`),
which already does. Fix: apply the same call to both. Quick, low-risk.

### 0.2 — Subclass "purple box" text still overruns despite existing fix
Subclass's row label already calls `fitLabelToColumnWidth` (font floor 9px,
`:1493-1503`), but Kevin still sees overrun — meaning some subclass names
are too long even at the font floor. Needs a second-line fallback (wrap to
2 lines instead of shrinking indefinitely) or a widened column, not just a
smaller font. Investigate actual subclass name string lengths against
`COLUMN_WIDTH` before picking the fix.

### 0.3 — Class picker overlay: description text overruns its fixed box
`uiTheme.ts:441` hardcodes `height = hasDesc ? 82 : 44` for every row in
`renderChoiceOverlay`, but the wrapped `desc` text (`:471-483`) isn't
height-bounded — a long `previewSummary` (e.g. Fighter's, ~200 chars,
`data/classes.ts:178-179`) wraps to 6-8 lines inside an 82px box and
collides with the next row. Fix: measure the wrapped text's actual line
count/height (Phaser `Text.getBounds()` after `wordWrap`) and size each
row's height/spacing from that, not a constant. This is the SHARED helper
every picker (Class/Race/Gear/Subclass) uses — fixing it here fixes it for
all four surfaces at once, present or future.

### 0.4 — "Points Left: xx" pushed into the STR row, shoving STR off-screen
`CharacterCreationScene.ts:1400-1403` appends `"   Points Left: N/27"`
directly onto the STR label's own string — a self-documented compromise
(comment `:1396-1399` cites `KI-083`'s "documented fragility" around this
scene's hardcoded vertical layout). Kevin has now confirmed this reads as
broken, not acceptable. Fix: give "Points Left" its own small label
(e.g. directly above the ability-score block, or a compact line to the
side) instead of concatenating onto STR's text. This will need real
layout surgery in a tightly-packed scene — budget real time for it, not a
one-line patch.

### 0.5 — Race picker text too small to read
`CharacterCreationScene.ts:637-639` renders the Race row label at 13px
monospace with no `fitLabelToColumnWidth` protection (same root cause as
0.1, plus a base-size complaint). Fix alongside 0.1: apply
`fitLabelToColumnWidth`, and reconsider the base font size for this row
specifically if it's still small once overflow protection is added.

### 0.6 — Hero names "move" and persist incorrectly across option screens — DONE (D-202)
Static reading found **no live drag/position bug** — under today's
`Scale.FIT` (D-159's revert), `repositionLayout()`'s viewport-shift math is
always a no-op (`uiTheme.ts:372-384`), and typed text is never overwritten
by `refreshSlot` (`:1379-1436`, deliberately, per its own comment). What
static reading DID find: every fresh `create()` call
(`CharacterCreationScene.ts:387-494`) rebuilds `this.slots` from the
`CHARACTER_NAME_POOL` defaults unless the scene was entered via Load
Game/a companion prefill — so a typed name is lost (not "moved") on any
navigation path that re-enters this scene fresh (e.g. Back to Main Menu
then back into Create Party). **This needs a real repro from Kevin** before
a fix is attempted — note the exact click sequence next time it happens
(which picker/button was touched right before the names moved). It's
possible fixing 0.1-0.4's overlay bugs resolves what looked like "names
moving" if it was actually an overlay rendering on top of/shifting the
name inputs. Re-confirm after 0.1-0.4 ship before spending more time here.

---

## Plan 1 — Ability-score assignment UX — DONE (D-192)

Shipped the same session this plan item was picked up. See `DECISIONS.md`
D-192 and `KNOWN_ISSUES.md` KI-142 for the full writeup and Kevin's
confirmation checklist.

Kevin's steer (asked directly): **keep Point Buy's existing +/- system
unchanged** — he likes seeing the point pool shift live per stat. Only
**Standard Array** needs a new control.

### 1.1 — Standard Array becomes a per-stat dropdown with auto-swap
Replace the current click-to-cycle (`CharacterCreationScene.ts:679-693`,
`StandardArrayAllocator.cycle()`, `CharacterBuildSystem.ts:100-106`) with a
dropdown per ability score offering the 6 standard values (15/14/13/12/10/8)
plus "—" (unset). Kevin's exact spec: picking a value already assigned to
a DIFFERENT stat swaps the two stats' values (e.g. array is STR 15/DEX
14/CON 12/WIS 13/INT 8/CHA 10; picking 15 for CON produces STR 12/DEX
14/CON 15/WIS 13/INT 8/CHA 10 — CON and STR swapped). Needs a new
`StandardArrayAllocator` method (e.g. `assign(ability, value)`) implementing
swap-on-conflict instead of the current single-array cycle. `openChoicePicker`
isn't the right widget for a 7-option same-row dropdown — likely a compact
custom dropdown/small popup anchored to the stat row, not a full-screen
picker overlay.

### 1.2 — Per-hero stat-assignment method (Standard Array vs Point Buy)
Currently `abilityScoreMethod` is one scene-wide field
(`CharacterCreationScene.ts:280`) — switching it resets EVERY slot's
allocator (`:1024-1026`). Move it to `SlotState.abilityScoreMethod` (per
hero) and change the toggle button (`buildPartyWideAbilityControls`,
`:1009-1054`) into a small per-hero-column control instead of one
party-wide button — Kevin's own words, "don't need a huge button for it."
A small pill/label near each hero's ability-score block, matching the
scale of the AI/Human toggle redesign in Plan 5, is the right size.

---

## Plan 2 — Starting equipment + party inventory — ALL DONE (D-193, D-194, D-197)

2.1/2.2 shipped the same session this plan item was picked up. See
`DECISIONS.md` D-193 and `KNOWN_ISSUES.md` KI-143 for the full writeup and
Kevin's confirmation checklist. 2.3 (party inventory) was deliberately
deferred at that point, pending Plan 3.1 — it shipped in a later session,
once Plan 3 was done; see D-197/KI-147.

**Follow-up the same session (D-194)**: Kevin flagged that D-193's free-
pick-everything model was wrong for CAMPAIGN mode specifically — a real
campaign companion should never be player-editable (fixed kit, scaled
down on harder difficulty, always keeping weapon + class implement), and
the PC should choose through a real point-buy economy (item costs +
difficulty-scaled budget) rather than picking for free. Free Play/manual
Create Party keeps D-193's original free-pick behavior unchanged. See
`DECISIONS.md` D-194 and `KNOWN_ISSUES.md` KI-144.

### 2.1 — Real multi-slot starting gear picker — DONE (D-193)
Character Creation currently offers exactly ONE gear pick total
(`CharacterCreationScene.ts:757-775`, one id from `STARTING_GEAR_IDS` →
`CharacterBuild.startingEquipmentId` → one slot filled in `Hero`'s
constructor, `Hero.ts:664-672`), even though `Hero` fully supports 10 gear
slots across 9 types (`GEAR_SLOT_IDS`, `data/equipment.ts:98-109`) and
everything downstream (AC, attack damage, attunement) already iterates all
of them. Fix: expand the single Gear row into a real per-slot loadout —
at minimum weapon + armor (chest) + a class-appropriate third slot (a
spellcasting focus for casters, off-hand/shield for martial classes) get
a real starting pick; other slots (rings/head/legs/back/footwear) stay
empty-until-battle-shop, matching Kevin's "very basic to start" framing.
**Before building**: confirm `data/equipment.ts` actually has a real
"spellcasting focus" sub-catalogue at common/uncommon rarity — if not,
that's a small data-content task to do first.

**Shipped scope exceeds this "at minimum" text**: Kevin was asked directly
once the 3-slot version above was built, and chose full expansion — ALL 10
gear slots are independently pickable at creation, not just 3, with no
class gating on any of them. See D-193 for the final design.

### 2.2 — Companion starting gear (campaign mode only) — DONE (D-193)
`data/companions.ts`'s `CharacterBuild` entries currently rely on the same
generic `STARTING_GEAR_IDS` single pick as a player-built hero. Give each
of the 12 companions a real, authored basic starting kit (weapon/armor/
focus matching their class and flavor) instead of the generic pool —
"very basic to start," per Kevin, with better gear coming through region
bonus/loot rewards during the campaign (already-shipped mechanisms, D-181
and the normal loot system).

### 2.3 — Party inventory system (XCOM2-style, Kevin's exact spec) — DONE (D-197)
Shipped the same session this plan item was picked up. See `DECISIONS.md`
D-197 and `KNOWN_ISSUES.md` KI-147 for the full writeup and Kevin's
confirmation checklist.

No shared inventory concept exists anywhere today (confirmed: zero matches
for `PartyInventory`/`InventorySystem`/`sharedInventory` in the codebase;
gear is either equipped directly on one hero or not owned at all). Build:

- **Every hero (active or benched) keeps their own equipped-items set at
  all times**, including while benched — this is already true structurally
  (`Hero.equippedItems` persists on the entity), the new part is that
  benched heroes' gear becomes visible/reachable from a party-wide screen.
- **"Unequip all bench heroes" button**: moves every benched hero's
  currently-equipped items into a shared party-inventory pool. This is a
  STAGING move, not final yet.
- **Any active/rostered hero can equip from the shared pool** during party
  setup for that mission.
- **Resolution at mission start** (the actual commit point, per Kevin's
  spec): any pooled item an active hero equipped becomes permanently that
  hero's item — the original bench hero no longer owns it. Any pooled item
  NOT equipped by anyone gets automatically returned to the bench hero it
  came from. No item is ever silently lost or duplicated.
- New system file (e.g. `PartyInventorySystem.ts`, pure/tested, no Phaser)
  owning this pool-and-resolve logic. Storage: folded into the campaign's
  persisted roster state — see Plan 3, since this only makes sense once
  companion equipment actually persists between missions (today it
  doesn't — see Plan 3.2). **Sequencing note: build Plan 3.2 before or
  alongside this — party inventory has no meaningful persistence target
  without it.**

---

## Plan 3 — Campaign party/character persistence — ALL DONE (D-195)

Shipped the same session this plan item was picked up, in the build order
suggested below — 3.4 was initially deferred (Kevin's own "maybe," lowest
priority) but picked up immediately after, same session, once Kevin said
"let's just build it now." See `DECISIONS.md` D-195 and `KNOWN_ISSUES.md`
KI-145 for the full writeup and Kevin's confirmation checklist — including
the real architecture question that came up mid-design (per-campaign
storage isolation was considered and explicitly REJECTED after it turned
out to conflict with the capstone gate, cross-region companion carry-over,
and Sorrel Thane's cross-region fate flag — see D-195 for why). A new
"Reset Campaign Progress" action (Campaign Select) shipped alongside as the
corollary of that resolution — not one of the sub-items below originally,
but the real clean-slate option Kevin wanted once the isolation approach
was rejected.

The biggest structural item, and the one most tangled with a pre-existing
gap: campaigns currently have **no cross-chapter continuity at all** — every
chapter is a fresh, self-contained battle by design (D-179/D-180, `KI-129`/
`KI-130`), with no gold/gear/level carried forward. Kevin's asks in this
area (locking stats before a campaign starts, and persisting/re-editing
gear+spells+level-plans between missions) both require solving that same
underlying gap: **a real per-campaign-save roster+build persistence layer**.

### 3.1 — Real cross-mission persistence for gear/spells/level-plans — DONE (D-195)
Extend `CompanionRosterSystem`'s existing per-save roster tracking (already
tracks active/benched/lost, D-118/D-183) with a real persisted
`CharacterBuild`-shaped state per roster member — equipment, spell picks,
level-up plan — instead of rebuilding a companion's build fresh from
`data/companions.ts` every session (confirmed: today "campaign party state
... lives in the companion roster ... + per-slot builds rebuilt fresh each
session" — nothing persists a companion's equipped gear/spell picks across
missions right now). The player's own PC needs the same treatment. Between
missions, everything stays editable (gear via Plan 2.3's party inventory,
spells via the existing Spells picker, level plan via Plan Levels/Plan 6's
blueprint system) — only DURING a mission is nothing changeable, matching
Kevin's "no stats/gear should change once the game/campaign starts" framing
extended sensibly to "once THIS MISSION starts."

### 3.2 — PC identity/stats locked after first Chapter-1 start of a campaign — DONE (D-195)
Once this campaign's own roster-persistence exists (3.1), freeze the
player's own ability scores/class/race/race choice the first time any
campaign's Chapter 1 begins — reuse the SAME `identityLocked`-style pattern
already built for companions (`SlotState.identityLocked`,
`CharacterCreationScene.ts:227-228`), just applied to slot 1 (the PC) once
persisted roster state exists for this save. This satisfies Kevin's ask for
an "up-front character creation, before party creation" step without
inventing a whole new scene — Character Creation IS that step, the first
time; subsequent visits for the same campaign save reuse the persisted
build with identity/stats locked.

### 3.3 — Companion ability scores are NOT currently locked — close this gap — DONE (D-195)
Confirmed: `identityLocked` today only guards the Class (`:610`) and Race
(`:644`) button handlers — NOT the ability-score cycle/stepper handlers
(`:688-692`, `:712-716`, `:729-733`). A companion's stats can currently be
freely changed in the party-creation UI, contradicting Kevin's explicit
"should not be able to change stats of companions outside of
campaign-story-specific decisions" rule. Fix: add the same `identityLocked`
guard to the ability-score handlers. Small, should ship early in this plan
regardless of how much of the rest of Plan 3 is tackled.

### 3.4 — Post-campaign-completion stat customization unlock (lower priority) — DONE (D-195)
Kevin's own "maybe" framing — a nice-to-have, not a commitment. Once a
campaign has been fully cleared at least once (an aggregate completion
check similar to `CampaignProgressSystem.areCampaignsCompleted`, D-188),
lift the ability-score lock for companions on a FRESH playthrough of that
same campaign only. Do this last within Plan 3, after 3.1-3.3 are solid —
skip it entirely if it doesn't feel worth the complexity once the rest is
built.

**Shipped adaptation of "FRESH playthrough"**: under Track A (D-195's
resolution — companion roster/progress/world flags stay one shared blob
across the whole game, no per-campaign isolation), there's no separate
"fresh playthrough" state distinct from "replaying this campaign." The
unlock is keyed directly on `isCampaignCompleted(campaignId)` (D-188's
existing per-campaign query, no new tracking needed) and applies from that
point forward on every subsequent visit to that campaign, not gated to a
special replay mode. See D-195's own 3.4 writeup for the full reasoning.

### 3.5 — Move Difficulty to Campaign Select, out of Character Creation — DONE (D-195)
Confirmed: `CampaignSelectScene.ts` has no difficulty control at all today;
`CharacterCreationScene`'s Difficulty button (`:976-995`) is the only place
it's set, for BOTH campaign and Free Play flows, with no `campaignId` guard
anywhere (unlike Party Size, which IS already guarded — see 3.6). Fix:
add a difficulty picker to `CampaignSelectScene` (mirroring
`FreePlayScene.buildDifficultySection`, `:463-492`, which already pre-seeds
Character Creation's own control via a passed `difficultyId` — same
plumbing pattern, reused not invented) and hide/disable Character
Creation's own Difficulty control when `campaignId` is set. Free Play's
existing split (its own picker pre-seeding Character Creation's) is
untouched — this only changes the campaign path.

### 3.6 — Remove Party Size button entirely for campaign mode — DONE (D-195)
Currently disabled-and-grayed with a "(fixed for campaigns)" label
(`:971-974`, `:1322`) rather than hidden. Small polish: hide it outright
when `campaignId` is set, once 3.5 establishes the pattern for
conditionally-shown controls in this row.

### 3.7 — Remove "Save New Party" for campaign mode — DONE (D-195)
Once 3.1 makes campaign party state persist automatically per-save, the
manual `Save New Party`/`Update Saved Party` button (`:1112-1131`, which
today "feeds ONLY this plain party-builder flow" per its own comment,
`:137-149`, and was never wired to campaign parties at all) has nothing
to do in campaign mode — hide it when `campaignId` is set. Free Play/manual
Create Party keeps it exactly as-is.

**Suggested build order within Plan 3**: 3.3 (quick, closes a real rule
violation) → 3.1 (the foundational persistence layer) → 3.2 → 3.5/3.6/3.7
(small UI follow-ups, can ship together) → 3.4 (optional, last).

---

## Plan 4 — Hero stat display: AC replaces Atk/Range — DONE (D-196)

Shipped the same session this plan item was picked up. See `DECISIONS.md`
D-196 and `KNOWN_ISSUES.md` KI-146 for the full writeup and Kevin's
confirmation checklist.

Confirmed: the current `HP {n}  ATK {n}\nRange {n}  Move {n}` summary
(`CharacterCreationScene.ts:1415-1429`) has two real problems Kevin's right
about — `ATK` is a flat class/ability-mod number with no weapon
factored in (`combatStatsForClassLevel`, never touches equipped gear), and
`Range` is purely `melee → 1 : ranged → 3` off the class's fixed
`basicAttackStyle` (`CharacterBuildSystem.ts:65-66`), never the real
weapon-aware `Hero.attackRangeTiles` getter (`Hero.ts:1290-1292`) that
exists and IS used everywhere else in the game.

- Replace ATK/Range with **AC** (`Hero.armorClass`, `Hero.ts:1178-1200` —
  already folds in armor/gear/subclass/feat bonuses correctly).
- To compute it, construct a real scratch `Hero` from the in-progress
  `CharacterBuild` draft — this project already has the exact precedent for
  this (`simulateHeroUpToChoice`, `:1678-1686`, and
  `LevelUpPlanSystem.simulateHeroForPlanning`, `:214-218`, both build a
  throwaway `Hero` purely for preview math). Once Plan 2 lands real
  multi-slot starting gear, this preview becomes genuinely accurate
  (weapon/armor both selected before the number is shown) — sequence Plan
  4 after Plan 2 if possible, though it's not a hard blocker (AC without a
  weapon picked yet is still more honest than the current ATK/Range pair).
- Resulting line: `HP {n}  AC {n}\nMove {n}` — three real stats. Consider a
  4th (e.g. equipped weapon name, or to-hit bonus) once Plan 2 exists, but
  don't force one just to keep 4 columns.

---

## Plan 5 — AI-hero level-up defaults + Human/AI toggle clarity — DONE (D-198)

Shipped the same session this plan item was picked up. See `DECISIONS.md`
D-198 and `KNOWN_ISSUES.md` KI-148 for the full writeup and Kevin's
confirmation checklist. Two open forks from the notes below were resolved
directly with Kevin before building: 5.1 is a hard rule, not just a
smarter default, and an AI hero's unresolved choice invents a simple
default rather than being left permanently unset (a deliberate, narrow,
Kevin-confirmed exception to D-16x's "never invent a choice" rule).

### 5.1 — AI-controlled heroes should default to Auto level-up mode
Kevin's ask: an AI-controlled hero should never sit on an unanswered
level-up prompt. **First task**: locate the actual field/flag that marks a
slot AI-controlled (not confirmed by this plan's research pass — the
AI/Human toggle handler is at `CharacterCreationScene.ts:549-566`, but its
exact field name and how `BattleScene` currently handles an AI hero
reaching an unresolved ASI/subclass/spell-pick prompt need a direct look
before deciding the fix). Once found: when a slot is AI-controlled, default
`LevelUpPlan.mode` to `"auto"` instead of D-133's current default. Decide
whether this should be a hard rule (an AI-controlled hero can never be set
to "prompt," since nobody would answer it) or just a smarter starting
default the player can still override — recommend the hard rule, but
confirm with Kevin once the current AI-hero-prompt behavior is actually
understood (it's possible this is already silently broken today,
independent of this feature, and worth flagging as its own bug if so).

### 5.2 — Redesign the Human/AI toggle's visual treatment
Confirmed: today it's a plain gray label reading `"Hero N · AI/Human
(click to toggle)"` (`:549-566`), same visual style as every other row,
with zero color-coding or iconography — the state and its clickability are
both easy to miss. Redesign as a real two-state pill/button (e.g. distinct
backgrounds or icons for Human vs AI, the active state visually obvious at
a glance without reading hint text).

---

## Plan 6 — Level-up blueprint library — DONE (D-199)

Shipped the same session this plan item was picked up. See `DECISIONS.md`
D-199 and `KNOWN_ISSUES.md` KI-149 for the full writeup and Kevin's
confirmation checklist. Both open forks below (storage backend, cadence
decoupling) were resolved from direct codebase research before building —
local-only storage (matching `CompanionRosterSystem`'s own precedent, not
Firebase), and the cadence setting fully decoupled into its own per-hero
pill, removing D-133's old mode-select screen from the wizard entirely.

Kevin confirmed: **global library, available to any future character of
that class in any save/campaign, forever** — not scoped to one save file.

### 6.1 — New persisted, named blueprint data model — DONE (D-199)
A blueprint is a `LevelUpPlan` (existing shape, `LevelUpPlanSystem.ts:52-60`)
plus a name and `classId`, stored independently of any one `CharacterBuild`
— a genuinely new save-data concept (today, `LevelUpPlan` lives ONLY inline
on one hero's build, reset to empty on class change, never named or
reusable — confirmed no id/name/separate storage exists anywhere).
Since Kevin wants this global across saves, it likely needs its own
browser-storage-level bucket (localStorage/IndexedDB or a Firebase
per-account collection, whichever this project's existing save
infrastructure makes cheaper — check `SaveSystem.ts`'s actual storage
backend before deciding) rather than living inside any one `SaveSlot`.

### 6.2 — "Plan Levels" becomes a 3-way choice, not a straight jump to the wizard — DONE (D-199)
New first screen when Plan Levels is clicked: **(A) Create a new blueprint
from scratch**, **(B) Select a saved blueprint** (then choose Edit-first or
Use-as-is), **(C) No blueprint** (today's throwaway per-character plan,
unchanged). Reuses the existing `renderPlanPrompt`/`renderChoiceOverlay`
button-list pattern already used for the Mode screen (D-133) — this is one
more screen inserted before it, not a rebuild.

### 6.3 — Saving a blueprint — DONE (D-199)
After building/editing a plan, offer "Save this as a reusable blueprint"
with a name-entry field (reuse the DOM `<input>` pattern the hero-name
fields already establish), distinct from just applying the plan to the
current hero (applying without saving stays the default, unnamed
per-character path).

### 6.5 — Fold spell-pick planning into the blueprint for caster classes — DONE (D-199)
**Kevin's explicit correction, reversing D-136's own "permanently out of
scope" call for planner integration** (D-136 dropped this because spell
swaps are recurring, not a one-time gate like ASI/subclass — correct as
far as it went, but Kevin's actual ask was never "make swaps
pre-plannable forever," it's "when I build a blueprint for a caster class,
let me plan its spell picks as part of that blueprint," same as ASI/
subclass already work). Scope this narrowly: `futureChoiceSteps` gains
spell-pick steps (reusing `SpellPreparationSystem.spellPickStepsForClass`/
`spellSwapStepsForClass`, both already exist and are fully tested) for a
caster class, letting a blueprint pre-select prepared spells/cantrips/
spellbook entries at each level a real choice exists, the same way it
already pre-selects ASI/subclass/feat picks. Recurring Long-Rest swaps
(not tied to a level-up) are a separate, genuinely different trigger —
out of scope for THIS blueprint (a blueprint is inherently "what happens
as this character levels," not "what I do every Long Rest") unless Kevin
says otherwise once he sees this built.

### 6.4 — Relocate the "Auto-follow / Prompted / Always fresh" cadence setting — DONE (D-199)
Currently the wizard's own first screen (D-133's Mode screen). Once
blueprints exist, Kevin wants this decoupled from "which blueprint" —
i.e. pick blueprint X, THEN separately choose "apply X silently" vs.
"prompt me each level with X pre-highlighted as the default" (D-133's
existing `highlighted` prompt-prefill behavior, unchanged) vs. "ignore X
and always prompt fresh." Needs a concrete layout decision (likely a
small per-hero control near the Plan Levels row itself, similar in scale
to the Human/AI toggle and Plan 1.2's per-hero stat-method control) — do
this as a first design pass at the start of Plan 6, not pre-decided here.

---

## Plan 7 — Level-progression reference screen — DONE (D-200)

Shipped the same session this plan item was picked up, closing the entire
Party Creation Overhaul roadmap (Plans 0-8 all DONE). See `DECISIONS.md`
D-200 and `KNOWN_ISSUES.md` KI-150 for the full writeup and Kevin's
confirmation checklist. New pure `ClassProgressionSystem.ts` assembles
class/subclass feature lists with the existing spell-slot/cantrip/prepared
tables into a 1-20 table; Compendium's class detail view surfaces it as a
static reference, Character Sheet's new "Progression" tab surfaces it with
achieved-level highlighting for the viewed hero.

### 7.1 — Extend Compendium's class/subclass detail with a real level table — DONE (D-200)
`CompendiumScene.renderClassDetail` (`:577-590`) and `renderSubclassesDetail`
(`:695-709`) already show a flat, level-tagged feature list (including ASI
entries) — a genuine partial version of what Kevin's asking for already
exists, not a blank slate. Missing: spell-slot/prepared/cantrip counts per
level for casters. Good news: `SpellPreparationSystem`'s tables
(`spellSlotsForClassAtLevel`, `preparedSpellCountForClassAtLevel`,
`wizardSpellbookSizeAtLevel`) already exist and are fully tested — this is
pure UI surfacing of existing data, no new system needed. Build a real
level-by-level table (1-20) combining both data sources.

### 7.2 — Highlight already-achieved levels (needs a "current hero" context) — DONE (D-200)
Today's Compendium is a pure static reference with no notion of "my hero is
level 7" — reachable standalone from Main Menu with nothing to highlight
against. Recommend surfacing this new table as a sub-view reachable from
the **in-battle Character Sheet** (where a real `Hero` with a real current
level already exists) rather than retrofitting a "current hero" context
into the standalone Main-Menu Compendium, which stays exactly as it is
today (no highlighting, pure reference).

### 7.3 — Group by source and type — DONE (D-200)
Once 7.1's table exists: separate rows/columns by class-vs-subclass origin
and by type (spells-known/slots, ASI-or-feat, other class features) —
straightforward once the data's assembled, since `level` and
class-vs-subclass origin are already tagged in the source data.

---

## Plan 8 — Apply the D-123 ornate/parchment theme to Character Creation — DONE (D-191)

Shipped the same session this plan item was picked up. Every control in
`CharacterCreationScene.ts` now uses `createOrnateButton`/
`drawScreenBackdrop`/`drawParchmentPanel` — see `DECISIONS.md` D-191 and
`KNOWN_ISSUES.md` KI-141 for the full writeup and Kevin's confirmation
checklist. No data/logic changed; needs Kevin's own browser pass before
being called fully done, especially the bottom-edge spacing flagged in
KI-141.

Confirmed: `CharacterCreationScene` is the one scene that never got D-123's
shared fantasy/parchment restyle (`DECISIONS.md` D-133 explicitly noted
"No visual restyle of `CharacterCreationScene` onto the D-123 ornate theme
... a separate future task" back when the level planner shipped, and
that task has sat unpicked ever since). This is NOT the same ask as "wait
for real character artwork" — it's a base UI-chrome consistency pass using
a component library that already exists and is already used by 8+ other
scenes: `createOrnateButton`, `drawScreenBackdrop`, `spawnAmbientMotes`,
`drawParchmentPanel`, `createSectionLabel` (all in `src/game/scenes/
uiTheme.ts`, the exact helper this scene already imports
`renderChoiceOverlay`/`fitLabelToColumnWidth` from). Real bespoke
character portraits/sprites are a different, genuinely-deferred thing —
this environment has no image-generation tool, so THAT part of "the art
pass" stays out of scope everywhere, not just here.

- Swap every plain-rectangle button/label build helper in this scene for
  `createOrnateButton`/`createSectionLabel`, and wrap the whole scene in
  `drawScreenBackdrop`/`spawnAmbientMotes`, matching exactly what
  `CompendiumScene`/`BestiaryScene` did under D-123 and what `FreePlayScene`
  did later under D-164 (both real precedents for converting an
  unstyled scene without touching its underlying logic).
- **Sequence this right after Plan 0, before Plans 1-3/6** — those plans
  are about to build real new UI (Standard Array's dropdown, the party
  inventory panel, the blueprint picker) in this same scene; building that
  new UI once, already in the ornate style, beats building it plain and
  re-touching it later for style alone.
- Zero data/logic changes expected — same discipline D-123's original
  Compendium/Bestiary conversion followed ("every category, filter, and
  page computation is byte-for-byte the same as before").
- **Real risk, flagged honestly**: this is the largest scene in the
  codebase with a self-documented "already-tight, hardcoded vertical
  layout" (`KI-083`), and there's no way to visually verify a reskin this
  size in this environment. Budget a dedicated session for this alone,
  not a rider on something else, and expect it to need Kevin's own
  browser pass before being called done — same standing limitation as
  every other visual change in this project.

---

## Kevin's original notes (2026-08-26 playtest), preserved verbatim for reference

Class choices – cramped. The text overruns the box and collides with the
class name. Need a better way to assign stats. Currently only has a +/-
set of buttons and a click-to-cycle option. Need to have something easier
to deal with (also need the option to choose between the stat-assignment
options: currently those are standard array and point-buy). Switching to
point-buy is fine, but the "Points Left: xx" text is pushed into the same
row as STR so the stat gets pushed offscreen to the left. Obviously
unacceptable. Should be able to do point-buy for one character and
standard array for another. Make the choice for each character (but only
if we can find a nice simple way to do that. Don't need a huge button for
it). Campaign party creation – Should not be able to change the stats of
the companions outside of campaign-story-specific decisions (Not sure if
we have any of those right now, but just flagging the option as the only
way that should be available by default). Maybe after beating the whole
campaign it could unlock the option to customize companion stats (but
only at the start of the campaign). No stats should be able to be changed
once the game/campaign starts (which is why we need an up-front character
creation section before they start, before even the party creation). I
don't like the current way characters select their gear. Not all the gear
options are created equal, and it doesn't make sense to me that they
would only get 1 gear option. We explicitly built a multi-slot gear
system so the party creation screen having only 1 spot for gear makes no
sense to me. In the campaign, it's fine for the companions to have their
own unique starting gear (very basic to start, they can get more and
better gear as part of the party rewards throughout the campaign). Part
of the starting gear needs to be their basic stuff like spellcasting
focus, armor, and weapons. Maybe we need to build these out specifically
if you can't handle that. Subclass text in the purple box still runs over
the right and left of the box. Names of heroes started OK, but after
messing with the other options in the party creation screen they moved,
and persisted across all option screens. Race selection text is too small
to read. Characters give stats like HP, Atk, Range, and Move. Generally
good, but Attack means nothing now that we've switched to actual DnD
character sheet based stats. Similarly, range is entirely depending on
the weapon/spell being used and is therefore useless as a standalone
stat. AC should replace those 2 useless stats. Should have an option for
the AI to pick level-up choices for you (this should be the default for
any characters that are AI controlled). The click-to-toggle human or AI
controlled button is not very clear at first of what it does. Let's
rethink that. Party creation screen still looks old, not the same as the
new main menu aesthetic. Not a huge deal since we'll be super-overhauling
all the visual aspects of the game when I add the artwork, but it might
be easier for you to do that if all parts of the game have the same
base-type visuals. Character level planning for classes that learn spells
will need to be quite a bit more involved because often they are able to
learn and/or prepare new/different spells each time they level up.
Campaign difficulty should be set when starting the campaign, not in the
party creation panel. Party size is fixed for the campaign (correctly
noted), but that means we don't need the party size button in the party
creation screen. We also don't need the Save new party button since this
party will be unique to this campaign and this campaign only. However,
within the campaign the party and chosen options for each companion and
the main PC should be saved. Talking about gear, spells, and plan levels.
But should still have the option to change them all between missions.
Gear should be shared between party members inbetween mission. There
should be a 'party inventory' that gear can be placed into so that other
heroes can gain access to any equipment not actively in another hero's
inventory. Might as well add a 'add all items to party inventory' button
to quick-unequip a hero's inventory. Also should have a 'unequip bench
hero's inventory' button to temporarily grant access for active party
members to be able to equip items that would otherwise [be locked to a
benched hero]. Need to have a screen the player can open that would show
their level progression. Should show the bonuses rewarded at each
level-up, highlighting the levels that have already been achieved,
perhaps separating those bonuses by whether they came from class or
subclass and their type (spells learned or spellslots gained, feats or
ability score improvements, etc.). While we're at it, might as well add
this on too: When planning levels, there should be an option to save the
current selections for that specific class. If saved, they would choose a
name for that layout and then future character made with that class
would have the option to choose that saved layout (with the option to
edit it. Basically just use it as the default values) or to create their
own layout from scratch. So the flow would be 1. Select Plan Levels
button. 2. Choose between A – Create a blueprint B- Select a blueprint C-
No blueprint. 3A – create a brand new blueprint from scratch. 3B choose a
saved blueprint (then choose if you want to edit it or use it as is). 3C
– nothing. Then we'll need to move the setting for 'Prompt for
re-choosing at each level with the blueprint as the default but options
to do something else or auto-use the blueprint value' somewhere else in
the character/party creation/selection.
