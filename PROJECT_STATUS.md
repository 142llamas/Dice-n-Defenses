# Project Status

## Character Creation spacing fixes + name-field mitigation — DONE this session (D-211)

From a Kevin screenshot of "Build Your Party": three provable spacing/text
fixes, plus one unconfirmed mitigation for the recurring "hero name fields
render out of place" report.

- Fixed a real overlap: the Standard Array/Point Buy pill's top edge sat
  12px inside the Background/Ability-Bonus row above it (D-206 added that
  row without adjusting this pill's position). Moved without needing to
  shift the ability-score rows below it.
- Widened the Background/Ability-Bonus row's gap (6px -> 10px) — it was
  reading as a stray vertical line between the two labels.
- Clarified the "unspent Background ability bonus" validation message to
  name the actual control ("the button next to Background").
- **Root-caused for real**: the hero-name fields' mispositioning is a
  static bug (Kevin confirmed it doesn't drift, ruling out an earlier
  desync guess), traced directly in Phaser's own `ScaleManager.js` source —
  its DOM-container-alignment logic only works when Phaser itself centers
  the canvas, and this project centers via an external CSS flexbox
  instead, so the DOM container never tracked the real canvas position.
  Fixed with a new `fixDomContainerAlignment()` helper (`uiTheme.ts`),
  applied to both `CharacterCreationScene` and `CoopLobbyScene` (this
  project's only two DOM-element scenes). Real mechanism, not a guess —
  still needs Kevin's own look to confirm the pixel-perfect result; see
  `KNOWN_ISSUES.md` KI-161.
- **Second, unrelated bug found and fixed the same session**: the "Team
  Level" bar fully covered the per-column "Save Character/Load Character"
  row beneath it (a proven 30px overlap, broken since D-206) — confirmed
  via a Kevin screenshot of the deployed site. Fixed by shifting the whole
  shared bottom control block down, unevenly, to protect the validation
  text's clearance above the screen's outer frame.

Tests: **1643** (unchanged — presentation-only). Typecheck clean, all 1643
pass, production build succeeds (**152 modules**, unchanged — no new
file). No browser available in this environment.

## BattleScene visual reskin — DONE prior session (D-210)

Phase 5's second and final item ("design-first, larger builds," 2026-08-28
playtest batch) — closes the whole batch. Designed with Kevin over an
interactive HTML mockup ("The Battlefield," an Artifact) before any code,
same practice D-209 just used for The Armory.

- The battle screen's chrome — background, HUD buttons, roster panel,
  action-button row, shop/build catalog grid, combat log — now shares the
  wood/bronze/gilt theme (`uiTheme.ts`, D-123) already used everywhere
  else in the game. A new bold bronze/gilt frame with corner diamonds
  hugs the board's outer edge. The board's own tile colors, hero/enemy
  tokens, and every gameplay highlight are untouched — this is chrome
  only, not a relayout.
- Kevin's round-2 feedback, both shipped: roster HP bars simplified to a
  two-state green-until-critical-then-red (was a three-tier gradient);
  every action-row button (Confirm/Cancel/Ability/Potion, Bonus Action/
  Action Surge/Class Action/Character Sheet, hotkeys) dropped its own flat
  color to match the rest of the chrome, gaining real hover feedback in
  the process.
- The combat log now sits on a real backing panel that grows/shrinks with
  its current line count, and the wave/phase banner sits on a sized-to-fit
  wood-panel chip.

Tests: **1643** (unchanged — presentation-only, no new pure-system logic).
Typecheck clean, all 1643 pass, production build succeeds (**152
modules**, unchanged — no new file). No browser available in this
environment — see `KNOWN_ISSUES.md` KI-160 for the full confirmation
checklist.

## The Armory: gear-purchase UX redesign — DONE prior session (D-209)

Phase 5 ("design-first, larger builds") of the 2026-08-28 playtest batch.
Designed with Kevin over several rounds via an interactive HTML mockup
("The Armory," an Artifact) before any code was written, replacing the old
in-battle Gear grid entirely.

- The old "click an item, then click a hero" flow is gone. The new
  `GearShopScene` (launched the same `scene.launch`/`scene.pause` way as
  `PauseMenuScene`/`CharacterSheetScene`) shows a hero rail with a 12-slot
  paperdoll each (10 gear + 2 potion slots), then a catalog filtered to
  whichever slot is picked.
- "Weapon"/"Shield" now read "Right hand"/"Left hand" in the shop, matching
  a per-hero label set (D-204) that existed already but the old Gear grid
  never actually used.
- Every catalog row has its own Purchase/Compare/Sell button, with a
  ~650ms delayed confirm on anything that spends or sells money (so a
  reflexive double-click can't fire it by accident). Buying into an
  occupied slot auto-sells the occupant as part of the purchase, shown as a
  trade-in tag plus a real net-cost button label.
- New economy rule, confirmed with Kevin: selling (standalone, or as an
  auto-trade-in) pays half of cost, rounded down
  (`EconomySystem.sellValueForCost`) — replaces the old unequip action's
  100%-refund behavior. Every other full-cost refund/award path (structure
  removal, a reward with nowhere to go) is unaffected on purpose.
- New pure module `GearCompareSystem.ts` (`isItemEligibleForSlot`,
  `previewGearSlotChange`, `formatGearDelta`) replaces the old item-first
  `targetGearSlot`/`previewEquipDelta` slot-guessing logic.

Tests: **1643** (+16) — new `sellValueForCost` cases plus a new
`tests/gearCompareSystem.test.ts`. Typecheck clean, all 1643 pass,
production build succeeds (**152 modules**, +2 — `GearCompareSystem.ts`,
`GearShopScene.ts`). No browser available in this environment — see
`KNOWN_ISSUES.md` KI-159 for the full confirmation checklist.

## Co-op economy: separate per-player gold pools — DONE prior session (D-208)

Phase 4 of the 2026-08-28 playtest batch (Phases 1-3/2.5 — D-203 through
D-207 — shipped earlier). Gold was a single flat number for the whole
party; Kevin's explicit choice (`AskUserQuestion`, over a shared-pool/
attribution-only alternative or deferring the phase) was **fully separate
per-player pools** — the real co-op economy.

- `EconomySystem` now holds one-or-more independent gold pools keyed by an
  owner id, instead of one number. Every method takes the pool id it
  applies to; an unrecognized id throws rather than silently misbehaving.
  Solo play and every campaign (campaigns never run inside a coop session)
  always use one pool, `SOLO_ECONOMY_OWNER` — no behavior change there
  beyond the new required argument.
- A coop session gives each participant their own full starting-gold
  balance (not halved) plus only their own heroes' Background bonuses.
  Kills are credited to the acting hero's owner where one exists (the
  common case); trap kills, bundled summon-phase kills, and wave-completion/
  time-bonus gold split evenly since there's no single attributable owner.
  Gear/potion purchases charge the receiving hero's pool; structure
  purchases and shop-affordability previews charge whichever participant is
  acting on that client; a Gold Thief steals from the hero it hits.
- The Gold HUD shows both players' balances in a coop session
  (`Gold: Ng | {partner}: Mg`); solo play is unchanged.

Tests: **1627** (+4) — a new multi-pool describe block in `economy.test.ts`;
every other `EconomySystem`-touching test file updated to the new required-
`ownerId` signature. Typecheck clean, all 1627 pass, production build
succeeds (**150 modules**, unchanged — no new file). No browser available
in this environment, and Phase 12.3's own KI-063 limitation (two coop
clients' boards don't converge as either acts) means a genuine two-human
confirmation isn't possible until that follow-up is built — see
`KNOWN_ISSUES.md` KI-158.

## Phase 3's leftover "off center" HUD fix — DONE prior session (D-207)

Closes the one item D-205 (Phase 3, 2026-08-28 playtest batch) left
unshipped, blocked since then on a screenshot from Kevin — he provided one
this session (Wave 1, nothing logged yet), showing two concrete causes:

- A large dead vertical gap between the roster panel and the action button
  rows below it, from always reserving the combat log's full 5-line-cap
  height (86px) even when the log has nothing in it yet. Now sized to the
  log's actual current content (`BattleScene.actionRowY()`), converging back
  to the same 86px once a battle has a few lines logged — nothing shifts
  once play is underway.
- Fixed left-to-right button offsets sized for an entire row's worth of
  buttons, so a hero showing only one or two of a row's buttons (the common
  case) looked lopsided to the right. Whichever buttons are actually visible
  now center as a group (`BattleScene.centerRow()`/`refreshActionRowLayout()`).

Tests: **1623** (unchanged) — scene-only layout change. Typecheck clean, all
1623 pass, production build succeeds (**150 modules**, unchanged). No
browser available in this environment — see **KI-157**.

## Backgrounds — DONE prior session (D-206)

Phase 2.5 of the same 2026-08-28 playtest batch — see `PHASE_HANDOFF.md` for
the full batch and remaining phases. SRD 5.2.1 moved ability-score bonuses
from Race to Background; this game had none until now.

- **Critical scope correction**: the real SRD 5.2.1 has exactly 4
  backgrounds (Acolyte, Criminal, Sage, Soldier), not the full PHB's ~16 —
  verified directly against `dndbeyond.com`'s own SRD changelog before
  writing any data. Kevin's call once told this: build the 4 real ones,
  then also author original backgrounds — 6 built (Siege Engineer, Ashfall
  Scout, Harborhand, Hedge-Warden, Ledger-Keeper, Ember-Marked), grounded in
  this game's own tower-defense genre and `CAMPAIGN_STORY_DESIGN.md`'s
  "Unremembering" throughline rather than PHB reskins.
- Every background grants 2 skill proficiencies (4 new skills added —
  Religion, Sleight of Hand, Arcana, History), a flavor-only tool
  proficiency, a real ability-score-bonus choice (+2/+1 or +1/+1/+1 among 3
  named abilities — a genuine, non-silent Character Creation choice that
  blocks Start Battle until spent, same D-192 precedent), a single Origin
  Feat (into the existing D-109 feat system), and a starting weapon/gold
  nod.
- Skill proficiency is now background-aware too — a Criminal-background
  hero gets a real Stealth bonus even outside their class's own list.
- New Background + ability-bonus picker buttons in Character Creation; a
  new Compendium "Backgrounds" tab; all 12 companions got a fitting
  background.

Tests: **1623** (+16) — `tests/backgrounds.test.ts` (new),
`applyBackgroundAbilityBonus`/`heroDefinitionFromBuild` wiring, and the
background-aware skill-proficiency overload. Typecheck clean, all 1623
pass, production build succeeds (**150 modules**, +1 for `backgrounds.ts`).
No browser available in this environment — see **KI-156**. See
`PHASE_HANDOFF.md` for next-chat instructions and the rest of the playtest
batch's gameplan.

## Battle interaction upgrades — DONE prior session (D-205)

Phase 3 of the same 2026-08-28 playtest batch (Phase 1 D-203, Phase 2 D-204
shipped earlier) — see `PHASE_HANDOFF.md` for the full batch and remaining
phases. Three of Phase 3's four items; the fourth (Confirm/Cancel/Bonus
Action/character-panel "off center") was fixed in D-207 above, once Kevin
provided a screenshot.

- Move-then-attack: clicking an out-of-range enemy now paths the hero toward
  it (as far as this turn's movement allows) and attacks in the same click,
  instead of just rejecting the order. A ranged hero stops as soon as it's in
  range, not necessarily adjacent (`HeroAISystem.planApproachForAttack`).
- Double-click-to-confirm: a real double-click on a legal move tile commits
  immediately, skipping the separate Confirm-button/Enter step
  (`BattleScene.isDoubleClickOn`, generalized for future reuse).
- Real keyboard hotkey layer: the 6-slot ability hotkey bar now fires on
  Shift+1..Shift+6 (plain digits stay hero-select); Confirm/Cancel/Bonus
  Action are now rebindable (full replace, XCOM2-style, Kevin's explicit
  choice) via a new "Controls" section in Settings, backed by
  `KeyBindingSystem` with a basic conflict guard.

Tests: **1607** (+14) — `HeroAISystem.planApproachForAttack` cases and a new
`keyBindings.test.ts`. Typecheck clean, all 1607 pass, production build
succeeds (**149 modules**, +1 for `KeyBindingSystem.ts`). No browser
available in this environment — see **KI-155**. See `PHASE_HANDOFF.md` for
next-chat instructions and the rest of the playtest batch's gameplan.

## Character Creation depth — DONE prior session (D-204)

Phase 2 of the same 2026-08-28 playtest batch (Phase 1, D-203, shipped last
session) — see `PHASE_HANDOFF.md` for the full batch and remaining phases.

- Standard Array now defaults to a per-class ability order
  (`defaultAbilityOrderForClass`, derived from each class's own
  `primaryAbility`/`spellcasting`/`savingThrowProficiencies`) instead of the
  flat STR/DEX/CON/INT/WIS/CHA order — applies to a fresh slot and to
  switching back into Standard Array from Point Buy; never re-applied on a
  later class change (would silently reorder a player's own picks).
- Gear slot rename: "Weapon"/"Shield" → "Right hand"/"Left hand" (per-hero
  labels only, `GEAR_SLOT_LABELS`; the catalogue's item-type labels are
  unchanged). Picking a Two-Handed weapon in Character Creation now
  force-clears the other hand slot, and vice versa (`isTwoHandedWeapon`).
- New per-character library (`CharacterLibrarySystem`, capped at 12
  entries, local-only/global): every hero slot has "Save Character"/"Load
  Character" — Save names and snapshots that slot's current build; Load
  overwrites the slot from a saved one via the existing `slotStateFromBuild`
  reconstruction, gated by the same `identityLocked` guard Class/Race use.

Tests: **1593** (+18) — `defaultAbilityOrderForClass`, `isTwoHandedWeapon`,
and a new `characterLibrarySystem.test.ts` mirroring
`blueprintLibrarySystem.test.ts`. Typecheck clean, all 1593 pass, production
build succeeds (**148 modules**, +1 for `CharacterLibrarySystem.ts`). No
browser available in this environment — see **KI-154**. See
`PHASE_HANDOFF.md` for next-chat instructions and the rest of the playtest
batch's gameplan.

## Main Menu reorg + Campaign/Free Play New-or-Load forks — DONE prior session (D-203)

Phase 1 of a large playtest batch Kevin handed over as a summary + phased
gameplan (see `PHASE_HANDOFF.md` for the full batch and remaining phases).

- Main Menu reorganized to Kevin's own proposed grouping: Campaign is now
  the primary "hero" button; Free Play/Co-op/Party Creation form the
  secondary row (Party Creation consolidates the old duplicate "New Game"/
  "Build Party" buttons — both started the exact same screen);
  Compendium/Bestiary merge into a new "Knowledge Base" button; the
  standalone "Load Game" button is retired (covered by the new forks
  below). Settings/Sign-in were already present — confirmed, unchanged.
- New `ModeEntryScene` gives Campaign and Free Play each a "New X"/"Load X"
  fork ahead of their existing screens.
- `LoadGameScene` gained an optional `filterMode` (campaign-linked vs. not)
  — the in-battle pause menu's own unfiltered "Load Game" is unaffected.
- New `KnowledgeBaseScene` (ornate-styled, matching Main Menu/Compendium/
  Bestiary) holds the merged Compendium/Bestiary buttons.

Tests: unchanged at **1575** (pure scene/presentation wiring, not
unit-tested). Typecheck clean, all 1575 pass, production build succeeds
(**147 modules**, +2). No browser available in this environment — see
**KI-153**. See `PHASE_HANDOFF.md` for next-chat instructions and the rest
of the playtest batch's gameplan.

## Two Known Issues bug fixes — DONE prior session (D-201, D-202)

Kevin: "let's fix both here and now," picking from `KNOWN_ISSUES.md`
after the Party Creation Overhaul roadmap closed.

- **D-201**: Load Game now forwards a campaign party's `campaignId`/
  `chapterIndex` (new optional `SaveSlot` fields), restoring companion
  identity/gear lock, point-buy, forced party size, and hidden difficulty
  picker for a party saved mid-campaign-battle via the pause menu.
  Previously live-reachable, not just a legacy-data edge case (the
  pre-battle "Save Party" is hidden in campaign mode, but the in-battle
  pause menu's is not). Also fixed the companion-identity metadata
  (`companionIdForSlot`) that lock/gear-pool/roster-write-back all depend
  on, which stayed empty for a reloaded party even after forwarding the id.
- **D-202**: Character Creation now resumes a "plain" draft across a
  Back-to-Main-Menu-then-return round trip, reusing the exact `loadedParty`
  → `slotStateFromBuild` path Load Game already established (sourced from
  `buildsFromSlots()` instead of a real save). No repro was ever obtained
  for the original hero-name report — fixed anyway at Kevin's explicit
  request, flagged as unconfirmed against what he actually saw.

Tests: **1575** (+5 for D-201; D-202 touches only the untested
`CharacterCreationScene`). Typecheck clean, all 1575 pass, production
build succeeds (145 modules, unchanged). No browser available in this
environment — see **KI-151**/**KI-152**. See `PHASE_HANDOFF.md` for
next-chat instructions.

## Party Creation Overhaul Plan 7: the level-progression reference screen — DONE prior session (D-200)

Kevin: "Plan 7 now." The last remaining item on the whole Party Creation
Overhaul roadmap — this closes it. Went through `EnterPlanMode`: three
Explore agents in parallel (Compendium's class/subclass rendering,
Character Sheet's tab architecture, the spellcasting/spell-prep per-level
tables), then a Plan agent validated the design against the real code
before building — caught that `getSubclassDefinition` throws on
`undefined` (guarded) and that the originally-proposed text colors would
be invisible against the Character Sheet's parchment panel (corrected to
ink color + `.setAlpha(0.55)` dimming, matching `CampaignSelectScene`'s
locked-card precedent).

- New pure `ClassProgressionSystem.ts` — `classProgressionTable(classId,
  subclassId?)` assembles class/subclass feature lists (already
  level-tagged) with the existing `SpellcastingSystem`/
  `SpellPreparationSystem` tables into a 1-20 table. No new balance numbers.
- Compendium's Classes detail view: a real per-level grouped table (level
  header, feature rows, one condensed caster-summary row) replacing the
  old flat feature list, reusing the existing paginated row-list engine
  unchanged. Subclasses tab untouched — spell progression is a class-level
  fact, not a per-subclass one.
- Character Sheet gains a fourth tab, "Progression" — one compact row per
  level for the viewed hero's actual class+subclass, dimmed for levels not
  yet reached, hover tooltip for full feature text. A classic (no-class)
  hero gets an explanatory message instead.

Tests: **1570** (+9, new `classProgressionSystem.test.ts`). Typecheck
clean, all 1570 tests pass, production build succeeds (145 modules, +1).
No browser available in this environment — see **KI-150** for the full
checklist. See `PHASE_HANDOFF.md` for next-chat instructions.

## Party Creation Overhaul Plan 6: the level-up blueprint library — DONE prior session (D-199)

Kevin's own ask: save a "Plan Levels" session as a named, reusable
blueprint, global to any future character of that class in any save or
campaign — plus his own explicit correction reversing D-136: fold
level-up-triggered spell swaps into blueprint planning too (Long-Rest
swaps stay untouched). Went through `EnterPlanMode`: three Explore passes
in parallel, resolving two design questions the plan doc left open
(local-only storage, matching `CompanionRosterSystem`'s precedent rather
than Firebase; decoupling the Auto/Prompted/Fresh cadence into its own
per-hero pill, out of the wizard entirely).

- New `BlueprintLibrarySystem.ts` (pure, local-only storage) — create,
  edit, use as-is, and delete named blueprints per class.
- "Plan Levels" opens a 3-way entry screen (Create New / Select Saved /
  No Blueprint); the Done screen gains "Save as Blueprint"; a new
  `cadenceHandle` pill (Auto/Prompt/Fresh) sits beside "Plan Levels",
  locked to Auto for an AI-controlled hero.
- A caster's level-up-triggered spell swaps are now plannable —
  `LevelUpPlan.spellSwaps`, a new `resolveSpellSwapStepsForLevel`
  (all-or-nothing per level), wired into both `fastForwardHero` and
  `BattleScene.applyClassLevelUps`, plus live-popup pre-highlighting.

Tests: **1561** (+21). Typecheck clean, all 1561 tests pass, production
build succeeds (144 modules, +1). No browser available in this
environment — the largest UI addition on the whole roadmap; see **KI-149**
for the full checklist. See `PHASE_HANDOFF.md` for next-chat instructions.

## Party Creation Overhaul Plan 5: AI-hero level-up defaults + Human/AI toggle clarity — DONE prior session (D-198)

Kevin's own playtest complaint: an AI-controlled hero could still get stuck
with a real level-up choice popup (ASI/subclass/spell pick) nobody was
there to answer, and the Human/AI toggle's plain gray label made its state
easy to miss. Two open forks from the plan doc were resolved directly with
Kevin before building: lock AI heroes to "Auto" mode as a hard rule (not
just a smarter default), and have an unresolved choice invent a simple
default rather than leave the hero permanently without one — a deliberate,
narrow exception to D-16x's "never invent a choice, blueprints must be
player-made" rule, confirmed explicitly, not a reversal of it.

- An AI-controlled hero's level-up mode is now locked to "Auto" at every
  entry point (fresh slot default, the Human/AI toggle, a loaded save,
  Plan Levels' mode-select screen).
- `BattleScene.applyClassLevelUps` and the pre-battle Starting-Level
  fast-forward both check `hero.controlledBy === "ai"` directly (not just
  the stored plan mode) as a defense-in-depth backstop — an unresolved
  choice for an AI hero now applies a new fallback default
  (`autoResolveAsiForLevel`/`autoResolveSubclassForClass`/
  `autoResolveSpellPickForRequest`, `LevelUpPlanSystem.ts`) instead of ever
  reaching a popup queue. Human/remote-controlled heroes are unaffected.
- The Human/AI toggle button now has a genuinely distinct visual state per
  mode (reusing `createOrnateButton`'s existing `setSelected`) and clearer
  label text.

Tests: **1540** (+7, all new). Typecheck clean, all 1540 tests pass,
production build succeeds (143 modules, unchanged — no new files). No
browser available in this environment — needs Kevin's own playtest pass;
see **KI-148** for the full checklist. See `PHASE_HANDOFF.md` for next-chat
instructions.

## Party Creation Overhaul Plan 2.3: shared party inventory pool — DONE prior session (D-197)

Kevin: "Let's do 2.3 now." An XCOM2-style shared gear pool between a
campaign's active and benched companions, per his own spec — "Unequip All
Benched Heroes" moves a benched companion's kit into a shared pool, any
active hero can draw from it during party setup, and Start Battle
resolves it (claimed items permanently become the claimer's, unclaimed
items silently return to their original owner). Went through
`EnterPlanMode`: two Explore passes plus a Plan-agent design pass, which
caught and fixed a real correctness gap before any code was written — see
D-197 for the full writeup.

- New pure system `PartyInventorySystem.ts` owns the pool logic
  (`unequipAllBenchedGear`/`visibleGearForOrigin`/`resolvePartyInventory`/
  `dropPoolEntriesForLostCompanion`), fully tested.
- `CompanionRosterState` gains a `partyInventory` field, same optional-
  field/defensive-parsing convention as D-195's `companionBuilds`/
  `pcBuild` — no migration needed, Reset Campaign Progress wipes it for
  free.
- Companions screen: new "Unequip All Benched Heroes" (two-click confirm)
  + a live pool-count label.
- Character Creation (campaign mode): every active hero's row gets a new
  "Pool" button beside Gear, opening the same two-level picker shape as
  the existing Gear picker, sourced from the pool instead of the static
  catalogue.
- **Correctness fix baked in**: a gear-locked companion's own kit
  computation now always filters out anything currently sitting claimable
  in the pool — closes a real duplication risk (a reactivated companion
  showing an item simultaneously claimable by someone else).

Tests: **1533** (+22). Typecheck clean, all 1533 tests pass, production
build succeeds (143 modules, +1). No browser available in this
environment — this is a genuinely multi-step flow (bench, unequip,
reactivate, draw, start battle, confirm auto-return) that needs Kevin's
own playtest pass; see **KI-147** for the full checklist. See
`PHASE_HANDOFF.md` for next-chat instructions.

## Party Creation Overhaul Plan 4: hero stat preview shows AC instead of ATK/Range — DONE prior session (D-196)

The roadmap's easiest standalone remaining pick. Character Creation's
per-hero stats line showed `HP/ATK/Range/Move` — Kevin flagged ATK and
Range as "useless" once the game switched to real D&D character-sheet
stats (ATK never factored in an equipped weapon; Range was a fixed
melee/ranged constant off the class, never the real weapon-aware range
used everywhere else). Replaced both with AC.

- The stats line now reads `HP {n}  AC {n}\nMove {n}`.
- AC is computed off a real scratch `Hero`
  (`LevelUpPlanSystem.simulateHeroForPlanning`, already exported/tested,
  same precedent the planner UI's own preview steps already use) fast-
  forwarded to the hero's chosen Starting Level under its own level-up
  plan, then reading `Hero.armorClass` — genuinely reflects equipped gear,
  subclass AC bonuses, and ASI-granted feats (e.g. Defense fighting
  style), not a level-1 guess.
- Pure UI wiring — no data/system changes, no new tests needed.

Tests: **1511** (unchanged). Typecheck clean, all 1511 tests pass,
production build succeeds (142 modules, unchanged). No browser available
in this environment — Kevin's own pass should confirm the stats line
layout and that the AC number matches the in-battle HUD for the same
hero; see **KI-146**. See `PHASE_HANDOFF.md` for next-chat instructions.

## Party Creation Overhaul Plan 3: campaign party/character persistence + Reset Campaign Progress — DONE prior session (D-195)

The overhaul roadmap's own "biggest structural item": campaigns previously
rebuilt the PC and companions fresh every chapter, with nothing carrying
forward. Closed the ENTIRE plan in one session, in its own suggested build
order: 3.3 (companion ability scores actually locked) → 3.1 (real persisted
builds) → 3.2 (PC identity lock) → 3.5/3.6/3.7 (Difficulty relocated to
Campaign Select, Party Size/Save New Party hidden in campaign mode) → 3.4
(post-completion companion-stat unlock, picked up immediately after on
Kevin's own "let's just build it now").

A real architecture question came up mid-design and was resolved with
Kevin directly, twice, via `AskUserQuestion`: `CompanionRosterSystem`/
`CampaignProgressSystem`/`WorldFlagSystem` all share one global blob across
every campaign entry. This first looked like a bug worth fixing per-
campaign — but reading `CAMPAIGN_STORY_DESIGN.md` showed the 7 campaign
entries are regions of ONE continuous playthrough by design (the capstone
gate, companion carry-over between regions, and Sorrel Thane's cross-region
fate flag all depend on the shared blob). **Resolved: keep it shared
("Track A"), persist builds into that same blob, and add a real "Reset
Campaign Progress" action instead** so Kevin still gets a genuine
clean-slate option. See D-195 for the full writeup — this is the load-
bearing decision a future session must not accidentally reverse.

- A companion's or the PC's gear/spells/level-plan/name now genuinely
  persists between missions, committed at Start Battle.
- Once committed, a PC's Class/Race/ability-scores lock for that
  playthrough — gear/spells/level-plan/name stay editable, unlike a
  companion (whose gear stays fixed to D-194's economy).
- Companion ability scores are now actually locked (previously only
  Class/Race/Gear were — a real gap).
- Difficulty is now chosen on Campaign Select; Character Creation's own
  Difficulty/Party Size/Save-New-Party controls are hidden in campaign mode.
- New: "Reset Campaign Progress" (Campaign Select) — two-click-confirm,
  wipes the shared roster/progress/flags back to defaults for a genuine
  fresh playthrough; Free Play saves are untouched.
- Once a campaign is fully cleared at least once, its companions' ability
  scores unlock (class/race stay fixed) — a real reward for finishing it.

Tests: **1511** (+9). Typecheck clean, all 1511 tests pass, production
build succeeds (142 modules, unchanged). No browser available in this
environment — the relocated controls, the two-click confirm, and the full
chapter-to-chapter persistence flow all need Kevin's own playtest pass; see
**KI-145** for the full confirmation checklist. See `PHASE_HANDOFF.md` for
next-chat instructions.

## Campaign-mode gear economy: fixed difficulty-scaled companion kits + PC point-buy — DONE prior session (D-194)

Kevin, right after seeing D-193's free-pick-everything design (below):
companions in campaign mode shouldn't be player-editable at all — fixed
kit, scaled down on harder difficulty, always keeping weapon + class
implement (spellcasting focus/holy symbol/etc.); the PC should still
choose, but through a real point-buy economy (items cost points,
difficulty sets the budget). Free Play/manual Create Party keeps D-193's
free-pick-everything unchanged — scoped to campaign mode only. Went
through `EnterPlanMode` again: two Explore passes (difficulty/economy
scaling conventions; class-implement requirements) plus a Plan-agent
stress-test caught 2 real issues before implementation — a budget-overage
state IS reachable (raising Difficulty after spending gear points), and a
companion's baseline kit needed a defensive copy, not a shared reference.

- **`DifficultyDefinition` gains `startingGearPoints`** (the PC's budget:
  Easy 12/Normal 9/Hard 6/Nightmare 4) **and `companionDiscretionaryGearSlots`**
  (how many of chest/shield survive: Easy 2/Normal 2/Hard 1/Nightmare 0) —
  both flat per-tier numbers matching the existing Rest-charge convention,
  explicitly first-pass/adjustable.
- **Item point cost derives from rarity** (common=1, uncommon=2), NOT the
  existing gold `cost` field — that's actively coupled to the gold-shop/
  enchant system, unsafe to double-purpose as a second currency.
- **Companions**: Gear button now locked (same guard Class/Race already
  use); kit is recomputed live from their D-193-authored baseline +
  current difficulty on every refresh, so a Difficulty change updates it
  immediately. Weapon and a caster's implement always survive; chest then
  shield are the discretionary slots that get trimmed.
- **PC**: the Gear picker now shows a "Gear Points: spent/budget" title
  (deliberately different copy from Point Buy's own "Points Left," to
  avoid the two systems reading as the same counter) and simply omits any
  item that would overspend — a losing swap never appears as an option.
  Start/Save block with a named message if a later Difficulty change
  pushes the PC over budget (confirmed reachable, not defensive-only).

Tests: **1502** (+11 — point-cost and companion-kit-trimming coverage in
`characterCreationData.test.ts`, a new describe block in
`tests/difficulty.test.ts`). Typecheck clean, all 1502 tests pass,
production build succeeds. No browser available in this environment — the
point-buy UI's feel, the companion-lock behavior, and whether these
first-pass budget numbers feel right in play all need Kevin's own
playtest pass; see **KI-144** for the full confirmation checklist. See
`PHASE_HANDOFF.md` for next-chat instructions.

## Party Creation Overhaul Plan 2 (2.1 + 2.2): real multi-slot (all 10) starting gear + real per-companion kits — DONE prior session (D-193)

Kevin: "Now do plan 2." Went through `EnterPlanMode` — an Explore agent
mapped the real current code (slot types, `Hero`'s gear/AC math, the
single-item `CharacterBuild` field, `companions.ts`'s generic pool,
`SaveSystem`'s real persistence path), then a Plan agent swept for every
other call site and stress-tested the save-migration design, before any
code was written. 2.1 first shipped as a 3-slot picker (Weapon/Armor/a
class-appropriate Shield-or-Focus third slot); Kevin then asked directly
about the other 7 slots ("what about helm/legs/rings/amulets/misc
items?") and picked full expansion in the same session.

- **Character Creation's Gear row is now a real 10-slot picker** — every
  one of the 10 real gear slots (Weapon, Shield, Head, Chest, Legs, Back,
  Ring 1, Ring 2, Amulet, Footwear), each independently pickable (or
  "None"), built as a nested `renderPlanPrompt` wizard (not nested
  `openChoicePicker`, which tears its overlay down after every pick). No
  slot is class-gated — every class sees every slot's full pool (a Fighter
  CAN pick a spellcasting-focus amulet, a Wizard CAN pick a shield).
- **All 12 campaign companions got real, authored starting kits** — real
  `weapons.ts`/`armor.ts` items matching their class for weapon/chest/a
  third slot, replacing the old generic single-item flavor pool; their
  other 7 slots start empty, same as any player-built hero, fillable later
  via the in-battle Shop. Mira Quill (Monk) deliberately has no chest
  armor, preserving her unarmored-defense AC formula.
- **Data model**: `CharacterBuild`/`HeroDefinition.startingEquipmentId`
  (single item) is now legacy-only — kept as a read-time fallback for a
  pre-Plan-2 save, never written by a new build — replaced by
  `startingGearIds` (a per-slot map). No `CURRENT_SAVE_VERSION` bump (would
  wipe every existing save); `Hero.armorClass` needed zero changes, since
  it already generically sums bonuses across every gear slot. The full
  10-slot expansion also closed the one documented gap the interim 3-row
  design had: a legacy save's ring pick now has a real matching row to
  land in.
- **2.3 (party inventory) is explicitly deferred** — no meaningful
  persistence target exists for it until Plan 3.1 (campaign cross-mission
  persistence) is built; building it now would be dead code with no real
  UI hook, per this project's standing "no scaffolding for a system that
  doesn't exist yet" rule.

Tests: **1491** (+6 net over the pre-session 1485). Typecheck clean, all
1491 tests pass, production build succeeds. No browser available in this
environment — the new 10-row Gear-picker UI and every in-game AC/attack-
damage number this change affects need Kevin's own playtest pass; see
**KI-143** for the full confirmation checklist. See `PHASE_HANDOFF.md` for
next-chat instructions (the rest of `PARTY_CREATION_OVERHAUL_PLAN.md`'s
roadmap: 2.3, Plans 3/4/5/6/7).

## Party Creation Overhaul Plan 1: ability-score assignment UX — DONE prior session (D-192)

Kevin: "Let's build plan 1 now." Two sub-items, both matching Kevin's exact
steer already recorded in `PARTY_CREATION_OVERHAUL_PLAN.md`: keep Point
Buy's +/- system entirely unchanged; give Standard Array a per-value
dropdown with auto-swap; move the ability-score method choice from one
scene-wide button to a small per-hero control. Went through `EnterPlanMode`
(a background Explore agent verified the real current code first, then a
Plan agent stress-tested dropdown depth/placement, a DOM-input focus edge
case, per-hero pill layout budget, and validity-message precedence) before
any code was written.

- **`StandardArrayAllocator` rewritten internally** — swap-on-adjacent-cycle
  became a direct `assign(ability, value | null)`: picking a value already
  held by a different ability swaps the two abilities' values; `null`
  clears an ability to unset ("—"). Constructor signature unchanged, so the
  12 `data/companions.ts` call sites and `allocatorFromScores` needed zero
  edits.
- **New compact anchored dropdown**, scene-local (no existing `uiTheme.ts`
  component fit) — opens below the clicked ability row, closes on
  click-away, on a hero-name field gaining focus, or automatically whenever
  the scene's own full-screen picker overlay opens.
- **Ability-score method moved to per-hero** (`SlotState.abilityScoreMethod`)
  — each hero column now has its own small pill instead of one shared
  party-wide button; one hero can use Point Buy while another uses Standard
  Array.
- **New validity gate**: Start Battle/Save Party are blocked if any active
  Standard Array hero has an unassigned ability, naming the hero in the
  status line. Point Buy is unaffected (always complete by construction).

Tests: **1485** (+3 — `StandardArrayAllocator`'s suite rewritten against
`assign()`'s real semantics). Typecheck clean, all 1485 tests pass,
production build succeeds (142 modules, unchanged), `npm run dev` serves
HTTP 200. No browser available in this environment — needs Kevin's own
playtest pass; see **KI-142** for the full confirmation checklist. See
`PHASE_HANDOFF.md` for next-chat instructions (the rest of
`PARTY_CREATION_OVERHAUL_PLAN.md`'s roadmap: Plans 2-3/6-7).

## Party Creation Overhaul Plan 8: ornate/parchment theme for Character Creation — DONE prior session (D-191)

Kevin's own steer from the D-190 session that wrote `PARTY_CREATION_OVERHAUL_PLAN.md`: do Plan 8 right after Plan 0, before Plans 1-3/6 build brand-new UI (a Standard Array dropdown, a party inventory panel, a blueprint picker) in the same scene — so that new UI gets built once, already in the right style. Planned via `EnterPlanMode` (a full read of the 2134-line scene, `uiTheme.ts`'s exported surface, and the two real precedent conversions `CompendiumScene.ts`/`MainMenuScene.ts`, then a Plan-agent design pass) before any code was written, given the scene's size and its self-documented "already-tight, hardcoded vertical layout" (KI-083).

- **Every hand-rolled `add.rectangle()+add.text()` control in `CharacterCreationScene.ts` is now `createOrnateButton`** — the Human/AI toggle, Class/Race/Gear/Subclass/Starting Level/Plan Levels/Spells pickers, both ability-score control sets, Party Size/Difficulty/Ability Score Method/Team Level, and Start Battle/Save Party. The flat background is now `drawScreenBackdrop`; each hero column's plain dark panel is now `drawParchmentPanel`. Title/subtitle match `CompendiumScene`'s own recipe. Deliberately no `spawnAmbientMotes` — a dense, click-heavy data-entry screen, the same call `CompendiumScene` made.
- **Zero data/logic changes** — every choice, validation rule, and computed string is unchanged; only how it's drawn and how the refresh functions talk to the new widgets changed. `SlotWidgets`' label fields became `OrnateButtonHandle`s, which made 4 of the scene's own overflow-protection call sites redundant (the button's own internal auto-shrink already does that job) — deleted rather than left as dead code. Standard Array and Point Buy's ability-score value text could no longer share one object once a button owns its label internally, so Point Buy got its own small value-readout Text.
- Start Battle's old green/gray valid/invalid fill swap has no direct equivalent on the shared button component (only `setSelected`/`setDisabled` exist) — driven by `setDisabled` alone on a `variant: "primary"` button instead.
- Column rows grew taller throughout to give the bordered ornate buttons real room a bare rectangle didn't need; every row below the ability-score block cascades off the new numbers automatically, same convention D-190/Plan 0 already established. The bottom-edge clearance is real but tight (~19px against the screen's frame) — flagged as the single number most likely to need a follow-up tweak.
- Explicitly out of scope: the shared choice-picker overlay (`uiTheme.ts`'s `renderChoiceOverlay`/`openChoiceList`) — used by other not-yet-converted scenes too (Map Builder, Settings, Free Play) — only this scene's own trigger buttons were converted, not the overlays themselves.

Tests: unchanged at **1482** (presentation-only, matches this project's standing convention that `scenes/*.ts` aren't unit-tested). Typecheck clean, all 1482 tests pass, production build succeeds (142 modules, unchanged), `npm run dev` serves HTTP 200. No browser available in this environment — this is the largest single-scene visual reskin in the project so far and genuinely needs Kevin's own playtest pass; see **KI-141** for the full confirmation checklist. See `PHASE_HANDOFF.md` for next-chat instructions (the rest of `PARTY_CREATION_OVERHAUL_PLAN.md`'s roadmap: Plans 1-3/6-7).

## Party & Character Creation overhaul: roadmap + Plan 0 bug fixes — DONE prior session (D-190)

Kevin's first real playtest pass of Character Creation and campaign party
creation surfaced a large batch of notes: cramped/overrunning text (Class/
Race/Subclass rows, the Class picker overlay), a broken "Points Left"
readout, a confusing stat-assignment UX, hero names apparently drifting,
the single-gear-slot limitation despite the game's real 10-slot equipment
system, gaps in companion stat-locking, useless Atk/Range stats that
should be AC, an unclear AI/Human toggle, and three genuinely new systems:
a shared "party inventory," real cross-mission persistence for campaign
gear/spells/level-plans, and a reusable "blueprint" library for level-up
plans.

Researched via a dedicated Explore agent reading the real current code
before anything was written, plus 3 `AskUserQuestion` rounds resolving
real scope forks with Kevin directly (party-inventory semantics — an
XCOM2-style stage-and-resolve-at-mission-start model; ability-score UX —
keep Point Buy's existing +/- system, replace Standard Array's click-cycle
with a per-stat dropdown with auto-swap; blueprint scope — a global
library across all saves). Once drafted, Kevin corrected two scoping calls
directly: spell-pick planning belongs inside the level-up blueprint system
(Plan 6) for caster classes, not left as a separate in-battle-only flow —
reversing D-136's own "permanently out of scope for planner integration"
call; and the Character Creation visual restyle onto the existing D-123
ornate/parchment theme shouldn't be deferred all the way to a future
real-artwork pass, since it's a reusable component library unrelated to
actual character art — sequenced as its own Plan 8, right after Plan 0.

**Result**: new `PARTY_CREATION_OVERHAUL_PLAN.md`, 8 independent
mini-plans. **Plan 0 (the bug-fix pass) shipped the same session**:
- The shared choice-picker overlay (`uiTheme.ts`) now sizes each row to
  its real wrapped-text height instead of a fixed constant, fixing the
  Class picker's description-overrun bug.
- Class/Race row labels gained the same overflow protection the Subclass
  row already had; Race starts at a larger, more readable font.
- Subclass row wording shortened across all three variants — long enough
  before to still overrun even at the smallest allowed font size.
- Point Buy's "Points Left" readout is now its own dedicated row instead
  of being appended onto (and pushing off-screen) the STR row.
- **Not fixed**: the reported hero-name-drift bug — static reading found a
  plausible data-reset cause, not a live position bug, and needs a fresh
  repro from Kevin before a real fix is attempted.

Tests: unchanged at **1482** (UI-layer-only changes, matching this
project's standing convention that scene files aren't unit-tested).
Typecheck clean, all 1482 tests pass, production build succeeds (142
modules, unchanged), `npm run dev` serves HTTP 200. No browser available
in this environment — every fix here needs Kevin's own look; see
**KI-140**. See `PHASE_HANDOFF.md` for the full writeup and next-chat
instructions (Plan 8, then the rest of the roadmap).

## Companion dialogue writing pass + real mechanical weight for branch choices — DONE prior session (D-189)

Kevin's own direct ask: build a first pass at "the dialogue and branching
story lines." Asked to scope which of `CAMPAIGN_STORY_DESIGN.md` §9's two
remaining open items this covered, Kevin picked **both, full scope**.
Researched via 3 parallel Explore agents plus a Plan agent, all
cross-checked against the real current code before writing anything.

- **All 6 Pool B companions now have real dialogue** — an arrival beat the
  moment their own home region's Chapter 1 clears, and a personal
  "homecoming" reaction when their region's own Chapter 4 mirror boss
  falls. Both reuse the existing `showDialogue`/`DialogueLine` (D-119)
  pipeline. Two entries (Fenna Duskwater/Saltmere, Isolde Varnhall/
  Frostbound) pick between two written variants based on the player's
  accumulated mercy-vs-expedience pattern across the whole campaign —
  real dialogue-tone reactivity, not a single fixed line.
- **All 24 region chapters now have real `introText`/`outroText`** — these
  fields have existed since D-177 with zero authored content until now.
- **Branch choices gained real mechanical weight, not just flavor text**:
  sparing any of the 5 home minibosses now grants an immediate modest
  gold reward; Sorrel Thane's Redeemed outcome (previously flavor-only)
  now grants a real healing-staff reward, and Marked now grants a smaller
  gold reward — closing the exact gap the D-185 addendum flagged as open.
  Deliberately bounded: reuses only proven mechanisms
  (`EconomySystem.award`, the existing equip-or-sell-for-gold flow), no
  changes to level-up/ASI/subclass selection and no new branch-choice
  chains for the other 5 companions.
- New `data/companionDialogue.ts`. `NamelessThroneSystem`'s existing
  ashen/hollow mercy tally (previously capstone-only) was extracted into a
  shared, reusable `computeMercyTally`/`mercyTallyLeansHollow` — a
  behavior-preserving refactor, so the new dialogue-tone reactivity reads
  the exact same signal the capstone ending already does.
- Tests: 1466 → **1482**. Typecheck, all 1482 tests, and the production
  build (142 modules, +1) all pass. `npm run dev` serves HTTP 200. No
  browser available in this environment — this is brand-new dialogue
  content and reward wiring spanning all 6 regions, genuinely needs
  Kevin's own playtest pass; see **KI-139**.
- **This closes `CAMPAIGN_STORY_DESIGN.md`'s entire remaining scope** —
  every item in §2 through §9 is now either built or an explicitly
  documented, deliberate scope cut. No open items remain in that doc.

## The Nameless Throne: the campaign capstone — DONE prior session (D-188)

Kevin's own direct ask: build the capstone now, "epic, a true masterpiece"
to close out the 6-region campaign epic. The last remaining piece of
`CAMPAIGN_STORY_DESIGN.md` §5, flagged by every prior item-13 handoff since
D-182. Researched via 3 parallel Explore agents plus a Plan-agent
implementation pass before any code was written; two scope forks (how the
ending is decided, whether the capstone is a full 4-chapter arc or one
finale battle) confirmed directly with Kevin, both resolved to the
lighter-scope option.

- **A new finale campaign, "The Nameless Throne"**, unlocks on Campaign
  Select once all 6 story regions are completed. Reuses the EXISTING
  Finish-or-Spare miniboss choices and Sorrel Thane's fate arc as the
  ending signal (no new chapter-boundary prompts) to decide between two
  legendary bosses already statted since D-131 and unused until now:
  Ashen Sovereign ("held on") or The Hollow Empress ("let it be useful").
- **One new hand-authored map** with a fixed layout shared by both
  endings — only 4 hazard tiles differ (fire vs. water), swapped at
  battle-load time, "no second map to build or maintain" per the design
  doc's own framing. Six new enemy reskins (verbatim stat clones, same
  `corrupted-sorrel`/`tide-wretch` precedent) garrison the two variants.
- **A real closing story beat** before Victory: the Ashen ending has the
  PC name every companion still on the roster out loud; the Hollow ending
  has the PC reach for a name that isn't there.
- New `systems/NamelessThroneSystem.ts` (pure, tested, mirrors
  `ReturningMinibossSystem.ts`'s shape) and `data/namelessThroneMap.ts`.
  New `CampaignProgressSystem.areCampaignsCompleted` — the first "all of
  these ids" aggregate completion check in the codebase.
- Deliberate scope cuts, both documented rather than silently dropped: no
  HOMM3-style bonus-choice screen for the capstone this pass; a miniboss
  that breaches unresolved reads the same as "Finished" for the ending
  tally (no separate "breached" flag exists anywhere).
- Tests: 1444 → **1466**. Typecheck, all 1466 tests, and the production
  build (141 modules, +2) all pass. `npm run dev` serves HTTP 200. No
  browser available in this environment — this is a brand-new endgame
  screen/battle/branching epilogue that genuinely needs Kevin's own
  playtest; see **KI-138**.
- **This closes CAMPAIGN_STORY_DESIGN.md's own design/build arc** — every
  section of the doc (§2 through §8) is now either built or an explicitly
  documented, deliberate scope cut. Two items remain genuinely open (see
  the doc's own §9): full dialogue/arc writing for the original six Pool B
  companions, and giving branch choices real mechanical weight beyond
  flavor text — both separate, already-repeatedly-deferred future work,
  not part of this session.

## "A companion's own unlock mission must include them" — DONE prior session (D-187)

Kevin's pick off item 13's remaining list: D-183's own last remaining
deferred item. Asked to clarify the actual mechanic before building (the
literal reading is a paradox), Kevin's real ask: the companion being
unlocked fights alongside the player IN the mission that recruits them —
a 3-hero squad (PC + newcomer + 2 more) for that one battle, chosen on a
new dedicated screen rather than gated/locked out.

- **New "Prepare the Mission" screen** before Character Creation, whenever
  starting a battle that would recruit a companion (a Pool A side mission,
  or a Pool B region's own Chapter 1 before that companion's recruited).
  PC and the target companion are locked in; the other 2 slots are freely
  chosen from anyone already recruited, defaulting to the current active
  roster.
- New `systems/UnlockMissionSystem.ts` (pure, tested) is the single source
  of truth for "is this an unlock mission, who does it unlock" — used by
  `CampaignSelectScene`, `CompanionRosterScene`, and the new
  `UnlockMissionPartyScene` alike.
- `CharacterCreationScene` gained a `requiredCompanionIds` field; every
  non-unlock-mission entry path is completely unaffected.
- `BattleScene`'s existing recruit-on-victory hooks needed zero changes.
- Tests: 1434 → **1444**. Typecheck, all 1444 tests, and the production
  build (139 modules, +2) all pass. `npm run dev` serves HTTP 200. No
  browser available in this environment; see **KI-137**.

## Pool A companion side-quest missions — DONE prior session (D-186)

Kevin's pick off item 13's remaining slice list: D-183's own deferred
"side-quest missions" for the 3 locked Pool A companions on any given
save. Researched the existing flat-`CampaignDefinition`/Companion-Roster
wiring directly before writing code — a close variant of D-184's Proving
Ground precedent, not a new content type.

- **All 6 Pool A companions now have a real unlock mission** — a fixed,
  flat, 3-wave battle, reachable any time from Companion Roster's own
  locked card (previously a dead-end "???"). Winning one recruits that
  companion onto the bench (never force-active).
- **No new maps or enemies** — each mission reuses one of the 6 existing
  region maps and an existing regular-tier enemy (never a miniboss/boss,
  so it can't collide with the returning-miniboss mechanic) as its finale.
- **No new array in `CAMPAIGNS`, no new scene** — a separate `SIDE_MISSIONS`
  array keeps these off `CampaignSelectScene`'s region-card list;
  `getCampaignDefinition` checks both arrays so `BattleScene`/
  `CharacterCreationScene` needed zero changes. `CompanionRosterScene`'s
  existing locked-card rendering just became clickable for Pool A.
- Tests: 1427 → **1434**. Typecheck, all 1434 tests, and the production
  build (137 modules, unchanged — no new files) all pass. `npm run dev`
  serves HTTP 200. No browser available in this environment; see
  **KI-136**.

## Sorrel Thane's fate arc: Redeemed / Marked / Lost — DONE prior session (D-185)

Kevin's pick off item 13's remaining slice list: `CAMPAIGN_STORY_DESIGN.md`
§6's Drowning Vale companion branch chain, a gap D-182 and D-183 both
flagged and deferred. Planned via `EnterPlanMode` (3 parallel Explore
passes) plus one `AskUserQuestion` round scoping Redeemed/Marked to
flavor-only before any code was written.

- **A choice at the start of Drowning Vale Chapters 1-3** converges by
  Chapter 4 on one of three outcomes: Redeemed, Marked (both flavor-only
  this pass), or Lost (real mechanical integration — permanent roster
  removal + a new corrupted encounter, "Sorrel Thane, Lost," taking
  Saltmere Chapter 1's returning-miniboss slot outright).
- New `systems/SorrelFateSystem.ts` (pure, tested) and a new
  `corrupted-sorrel` enemy, stat block cloned from `tide-wretch`.
- Completed scaffolding built specifically for this feature and left
  unwired since D-118/D-182/D-183: `WorldFlagSystem`'s own doc comment
  named this exact use case, `CompanionRosterSystem.loseCompanion` and
  `CompanionRosterScene`'s "LOST" status were both already built and
  tested but connected to nothing until now.
- Tests: 1412 → **1427** (new `tests/sorrelFateSystem.test.ts`, extended
  `tests/returningMinibossSystem.test.ts`, updated `tests/
  enemyRoster.test.ts` miniboss count). Typecheck, all 1427 tests, and the
  production build (137 modules, +1) all pass. `npm run dev` serves HTTP
  200. No browser available in this environment; see **KI-135**.

## The Proving Ground: prologue mission gates the six regions — DONE prior session (D-184)

Kevin's pick off item 13's remaining slice list: the "forced starting
mission" gate D-183's own handoff deferred. Rather than picking one of the
6 existing regions to serve as the gate, Kevin asked for a brand-new
one-time mission instead. Planned via `EnterPlanMode` (3 parallel Explore
passes plus a Plan-agent validation pass) before any code was written.

- **New "The Proving Ground" prologue mission** — a small, theme-neutral
  map and 3 short low-difficulty waves, added as a flat (non-chaptered)
  `CampaignDefinition` (`PROLOGUE_CAMPAIGN_ID`). Finale enemy reuses the
  existing `brute` minion rather than a newly-authored one.
- **All 6 story regions now stay locked** on Campaign Select until the
  prologue is cleared once — the first ordering/gating concept Campaign
  mode has ever had. Reuses `FreePlayScene`'s existing locked-option visual
  pattern (KI-130) rather than a new one.
- No changes needed anywhere else — `BattleScene`, `CharacterCreationScene`,
  and Free Play already treat a flat `campaignId` generically; D-181's
  bonus-choice screen and D-183's companion seeding both already handle a
  campaign with no curated pool/home region cleanly.
- Tests: 1409 → **1412** (`tests/campaigns.test.ts`'s region-only
  assertions now filter a new `REGIONS` const, plus a new "Prologue
  (D-184)" describe block; `tests/regionBonusSystem.test.ts` skips the
  prologue in its "every campaign has a bonus pool" check). Typecheck, all
  1412 tests, and the production build (136 modules, +1) all pass. `npm
  run dev` serves HTTP 200. No browser available in this environment; see
  **KI-134**.

## Companion roster & recruitment UI, Phase 1 — DONE prior session (D-183)

Kevin's pick off item 13's remaining slice list: companion recruitment UI
(offered and unpicked in D-181/D-182). Asked how he envisioned it, his
answer materially extends `CAMPAIGN_STORY_DESIGN.md` §6 beyond what that
doc's own text specifies. Planned via `EnterPlanMode` (3 Explore passes
plus a Plan-agent implementation-plan pass) and scoped down to a buildable
first slice via two `AskUserQuestion` rounds before any code was written.

- **The 12-companion catalogue now splits into two pools.** Pool B (the
  original six §6 "mirror" companions) no longer has a fixed starting
  trio — every one of them unlocks onto the bench individually, the first
  time their own home region's Chapter 1 is completed. Pool A (the six
  class-coverage recruits D-177 added) seeds a brand-new campaign's
  starting party with 3 randomly-drawn active members; the other 3 stay
  locked, meant for future side-quest content (not built this session).
- **New "Companions" screen**, reachable from Campaign Select — all 12 by
  status (Active/Benched/Locked, with a home-region hint or "???"),
  freely swappable at any time outside battle.
- **Campaign-mode Character Creation auto-fills slots 2-4** from the
  roster's 3 active companions (identity locked, everything else stays
  editable) and locks party size to 4; Free Play is completely unaffected.
- Reuses `CompanionRosterSystem` (D-118 scaffolding) for the first time —
  it existed fully built and tested but connected to nothing until now.
  New `systems/CompanionSeedSystem.ts` (pure random-draw-3 rule, same
  partial-Fisher-Yates shape `RegionBonusSystem` already established) and
  `scenes/CompanionRosterScene.ts`.
- **Explicitly out of scope this session, all confirmed with Kevin
  directly**: the other 3 Pool A companions' side-quest missions (a real
  new mission-content type), a forced "starting mission" gating the other
  5 regions, a rule that a companion's own unlock mission must include
  them, and Sorrel Thane's Redeemed/Marked/Lost fate arc.
- Tests: 1402 → **1409** (new `tests/companionSeedSystem.test.ts`, plus a
  rewritten pool-membership assertion in `tests/companions.test.ts`).
  Typecheck, all 1409 tests, and the production build (135 modules, +4)
  all pass. `npm run dev` serves HTTP 200. No browser available in this
  environment — this is a new screen plus a real Character Creation flow
  change, genuinely needs Kevin's own look; see **KI-133**.

## Returning-miniboss mechanic — DONE prior session (D-182)

Kevin's pick off item 13's remaining slice list (offered alongside
companion recruitment UI and the capstone): build
`CAMPAIGN_STORY_DESIGN.md` §4's returning-miniboss mechanic. Investigated
first via two rounds of Explore agents plus a Plan-agent design-review pass
before writing any code, since the feature touches enemy-defeat handling,
persisted world state, and chapter-load wiring this session hadn't read
yet.

- **Defeating one of the 5 "home" minibosses in its own Chapter 1 finale**
  now shows a mandatory "Finish or Spare?" choice before the battle can
  end. Kill gold/loot/Bestiary credit are identical either way — sparing is
  a persisted narrative flag, not a reward penalty.
- **Saltmere Shallows Chapter 1** reads that flag back: it spawns whichever
  earlier-region miniboss was spared (earliest region wins on a tie) with a
  one-time "washed ashore" combat-log flavor line, or falls back to the
  nameless Tide-Wretch, unchanged, if nothing was spared.
- Two real implementation bugs caught by a Plan-agent design-review before
  any code was written: (1) the miniboss is always its chapter's finale
  spawn, so a modal shown from the death-consequence funnel would be raced
  by the victory-transition check — fixed by stashing the pending choice in
  `resolveDeaths()` and showing it from `afterWaveCleared()` instead, before
  that function's existing level-up/victory logic runs; (2) a shallow clone
  of a chapter's wave list would have permanently mutated a shared
  module-level data constant — fixed with a narrow "spine" clone
  (`withReturningMinibossSwap`) that only copies the objects on the path to
  the one changed field.
- Wires up `WorldFlagSystem` (D-118 scaffolding) for the first time — it
  existed fully built and unit-tested but connected to nothing until now.
- Known, deliberate scope cut: the design doc's Sorrel-Thane-Lost priority
  tier (should take this slot ahead of a spared miniboss) is NOT built —
  needs a companion-fate data model that doesn't exist anywhere yet (a
  separate item-13 slice, companion recruitment UI). Documented in D-182.
- New `systems/ReturningMinibossSystem.ts` (pure priority/fallback logic,
  the wave-list swap, and 5 one-line "washed ashore" flavor strings — no
  new "corrupted variant" enemy content, each miniboss reuses its existing
  id/stat block verbatim on return).
- Tests: 1391 → **1402** (new `tests/returningMinibossSystem.test.ts`).
  Typecheck, all 1402 tests, and the production build (131 modules, +2)
  all pass. No browser available in this environment — this is a brand-new
  mid-battle mechanic spanning 6 chapters' worth of encounters, needs
  Kevin's own playtest; see **KI-132**.

## Pre-region bonus-choice screen — DONE prior session (D-181)

Kevin's pick off item 13's remaining slice list (offered alongside the
returning-miniboss mechanic, companion recruitment UI, and the capstone):
build `CAMPAIGN_STORY_DESIGN.md` §8's HOMM3-style "pick 1 of 3 bonuses"
screen. Investigated first via 3 parallel Explore agents (hero equipment/
inventory model, structure placement, `BattleScene`'s pre-battle sequence
+ RNG) since all four bonus categories touch mechanisms untouched until
now.

- **Every real campaign now shows a "Choose a Bonus" screen** at the start
  of each chapter's battle (after the chapter intro, before the ASI/
  subclass/spell-pick fast-forward prompts): 3 randomly-drawn options from
  a 6-option per-region pool, covering gold, XP, equipment, and a free
  structure/trap every time.
- Two real gaps in §8's own design, resolved this session: this game's
  leveling is a fixed per-wave cadence with no XP-pool currency to grant,
  so "XP" is modeled as a flat permanent max-HP bonus instead (new
  `Hero.grantBonusHealth`, into the `bonusMaxHealth` slot that's existed
  since Phase 13.6/13.11 with nothing granting into it until now); and
  "once per region" doesn't map onto this engine's fully self-contained,
  no-cross-chapter-continuity chapters, so the choice re-offers every
  chapter instead of literally once — both documented, deliberate
  first-pass calls, not oversights.
- Applying each category reuses an existing mechanism exactly rather than
  inventing new ones: `EconomySystem.award` (gold), the new
  `grantBonusHealth` (XP), `grantLootDrop`'s own equip-or-sell-for-gold
  logic (equipment), `BuildSystem.canPlace`/`place` (structure).
- New `data/regionBonuses.ts` (6 curated pools, one per region) and
  `systems/RegionBonusSystem.ts` (the random-draw-3 rule, built on
  `RandomService.rollIndex` since no ready-made "pick N" primitive
  existed). No new equipment/structure content — every id referenced
  already existed.
- Tests: 1377 → **1391** (new `tests/regionBonusSystem.test.ts` plus one
  case in `tests/equipment.test.ts`). Typecheck, all 1391 tests, and the
  production build (129 modules, +2) all pass. No browser available in
  this environment — this is a brand-new player-facing screen shown
  before every chaptered-campaign battle, needs Kevin's own look; see
  **KI-131**.

## Migrated the other 4 regions to real 4-chapter campaigns — DONE prior session (D-180)

Kevin's own direct ask: "continue item 13 with building the other 4
regions" — completing what D-179 (the prior session) started. D-179
migrated the two regions that already had a flat `CampaignDefinition`
(Emberford Reach, Saltmere Shallows); this session builds the other four
`CAMPAIGN_STORY_DESIGN.md` §3 regions from scratch, since they never had a
campaign at all (their maps, Phase 23/D-114, were Free-Play-only).

- **Shattered Causeway, Cinderfall Rift, The Drowning Vale, and
  Frostbound Hollow are now real, chaptered campaigns** (D-180), same
  4-chapter shape D-179 established: Ch1 (1-5) ends in the region's own
  miniboss (Juggernaut / Gravemaw / The Husk / Bloodrage Warlord), Ch2
  (6-10) a lighter first encounter with the region's real finale boss
  (The Devourer / Warlord Korrath / Blightmother / Sundered King), Ch3
  (11-15) remixes the established roster at higher counts, Ch4 (16-20)
  exactly reuses a new flat 6-wave finale (zero regression risk, same
  array reference). All eight enemies (`CAMPAIGN_STORY_DESIGN.md` §3's own
  table) already existed in `data/enemies.ts` from Phase 20/21 — unlike
  D-179's Saltmere fallback, no new enemy was needed. Four new
  region-flavored curated loot pools added (Phase 22 pattern).
- **No scene code changed at all.** `CampaignSelectScene`/
  `CharacterCreationScene`/`BattleScene`'s D-179 chapter wiring is already
  fully generic over the `CAMPAIGNS` array — confirmed by reading the real
  code before building, not assumed. This was a pure content/data
  session.
- `FreePlayScene`'s unlock gating for these 4 maps and their 8 associated
  bosses — previously always-unlocked, with no campaign to gate on — now
  gates on completing that region's campaign, the same treatment
  Cinderlord/Tidelord already had.
- `data/companions.ts`'s `homeRegionId` set for the remaining four mirror
  companions (Dorian → Shattered Causeway, Hollis → Cinderfall Rift,
  Sorrel → The Drowning Vale, Isolde → Frostbound Hollow), closing a D-177
  TODO now that every region has a real campaign id.
- Known, deliberate scope, same as D-179: no cross-chapter continuity, no
  chapter intro/outro text yet, end screen still routes to Main Menu after
  a mid-region chapter clear. The "returning miniboss" mechanic and the
  capstone ("The Nameless Throne") remain unbuilt — see **KI-130**.
- Tests: 1376 → **1377**. Typecheck, all 1377 tests, and the production
  build (127 modules, unchanged) all pass. No browser available in this
  environment — see **D-180** in `DECISIONS.md` and **KI-130** in
  `KNOWN_ISSUES.md`.

## Removed "signature action" system + migrated 2 campaigns to real 4-chapter regions — DONE prior session (D-178, D-179)

Kevin's own direct ask: "I don't want them (or anyone in the game) to have
a signature action. I want all available actions to be straight from the
DnD 5.5e class that they have levels in. Fix that and migrate the campaign
stuff." Two independent changes, both planned via `EnterPlanMode` (3
Explore passes + 1 Plan-agent review reading the real code before writing
anything) given the scope. Companion dialogue/story writing stays
explicitly deferred per Kevin's own words — a dedicated future session.

- **D-178 — no more "signature action."** Every hero's basic-attack
  baseline (melee/ranged style + STR/DEX/INT/WIS/CHA scaling) now comes
  from a fixed per-class table (`data/classes.ts`'s new
  `basicAttackStyle`, paired with the already-existing `primaryAbility`
  field) instead of a player-chosen ability. This was almost entirely
  SUBTRACTION: a non-caster's real weapon Attack, every real class bonus/
  class-action, and a caster's full spellbook were ALL already independent
  of the old `abilityId` field — only the pre-weapon baseline actually
  needed it. Removed entirely: `CharacterBuild`/`HeroDefinition`/
  `Hero.abilityId`, the "Choose Signature Action" Character Creation step
  (with the layout below it collapsed, not left as a gap), the 4 invented
  non-SRD abilities (Cleave/Piercing Shot/Taunting Slam/Frost Bolt), and
  `BattleScene`'s entire `aimingAbility` interaction path (a non-caster's Q
  button now shows nothing — its real actions are click-to-attack plus its
  existing class-feature buttons). Casters' spellbook is completely
  unaffected. `firestore.rules` updated too, or cloud saves would fail
  validation. Known, accepted limitation (pre-existing, not worsened):
  to-hit doesn't re-derive its ability modifier from a later-equipped
  weapon of a different style — see **KI-128**.
- **D-179 — Emberford Reach/Saltmere Shallows are now real 4-chapter
  regions**, the first live use of D-118's `chapters` scaffolding. Ch1
  (levels 1-5) ends in a miniboss, Ch2 (6-10) a lighter first encounter
  with the region's real boss, Ch3 (11-15) remixes the established roster
  at higher counts, Ch4 (16-20) is an EXACT reuse of the existing flat
  6-wave finale (zero regression risk). Saltmere's Ch1 uses a new enemy,
  **Tide-Wretch** (miniboss tier, no lore, per the design doc's own
  documented fallback for its not-yet-buildable "returning miniboss"
  mechanic). Real scene wiring, not just data: `CampaignSelectScene` shows
  "Chapter N of 4" and the UPCOMING chapter's own boss (not a finale
  spoiler), `CharacterCreationScene` relays the chosen chapter index,
  `BattleScene` resolves that chapter's own waves/loot and marks chapter
  vs. whole-campaign completion correctly, and chapter intro/outro text
  (unwritten so far) already renders via the existing D-119 dialogue box
  the moment it's added. Known, accepted limitations, confirmed with Kevin
  directly rather than assumed: no cross-chapter continuity (every chapter
  is still a fresh, self-contained battle) and the end screen doesn't yet
  route back to Chapter Select — see **KI-129**.
- Tests: 1370 → **1376** (net; D-178's own test cleanup — ~26 files
  touched, most mechanical, `characterSystem`/`classLeveling`/
  `characterBuildSystem`/`characterCreationData`/`heroActionRegistry`/
  `heroActionHotkeys`/`newCoreClasses`/`visualFxSystem` needed real logic
  rewrites — nets against D-179's new `tests/campaigns.test.ts` chapter-
  content coverage and `tests/enemyRoster.test.ts`'s miniboss-count bump).
  Typecheck, all 1376 tests, and the production build (127 modules,
  unchanged) all pass. No browser available in this environment — both
  changes need Kevin's own look (does the HUD feel right without a
  signature-ability button; does the new Chapter Select flow make sense);
  see KI-128/KI-129.

## KI-098 item 13 begins: 12-companion catalogue, one per class — DONE prior session (D-177)

Kevin picked "start item 13" (the overworld campaign epic — the last
untouched item on the whole KI-098 list) and chose the companion-roster
slice first. On seeing `CAMPAIGN_STORY_DESIGN.md` §6's original six
companions, he asked directly why the roster was capped at six when this
game has 12 classes — he wants the campaign to double as a soft tour of
every class over its course, BG3-style.

- **`data/companions.ts`'s `COMPANIONS` array is now 12 real, playable
  `CharacterBuild`s**, up from D-118's empty scaffolding. The original six
  named companions (Hollis Vane, Fenna Duskwater, Isolde Varnhall, Tamsin
  Rourke, Dorian Wick, Sorrel Thane) each got a class fit to their
  already-written personality (Fighter/Druid/Wizard/Paladin/Warlock/
  Ranger). Six new companions (Brand Ashcairn, Wren Calloway, Perrin Holt,
  Mira Quill, Cass Ferrow, Ellery Vance) cover the remaining classes
  (Barbarian/Bard/Cleric/Monk/Rogue/Sorcerer) as ordinary recruits with a
  one-line hook apiece — deliberately lighter-weight than the original
  six's region-boss "mirror" relationships, since only six regions/bosses
  exist for those six to pair with.
- Every build is genuinely valid (real race/class pairing, class-fit
  ability-score order, a flavor-matched signature action/cantrip, one
  starting item each). Subclass is set only for the three level-1-choice
  classes (Cleric/Sorcerer/Warlock) — every other class resolves its
  subclass through the normal in-battle level-up queue, same as a
  player-built hero. `CompanionRosterSystem.ts` needed zero changes —
  confirmed generic over roster size before writing any data.
- Tests: 1377 → **1384** (+7, `tests/companions.test.ts` rewritten from
  "catalogue is empty" to real shape checks). Typecheck, all 1384 tests,
  and the production build (127 modules, unchanged) all pass. No browser
  needed or possible yet — pure data, no scene/UI consumer exists yet to
  check on-screen. See **D-177** in `DECISIONS.md`.
- **Still open on item 13**: full dialogue/arc writing for the original
  six, migrating the two existing flat campaigns into D-118's chapter
  structure, the bonus-choice pool numbers (§8), and any scene/UI to
  actually recruit a companion in battle.

## KI-098 item 9: bigger maps — DONE prior session (D-176), closes the KI-098 build backlog

The riskiest item on the whole KI-098 list, flagged that way since two
prior sessions (D-157/D-159) broke Main Menu/Character Creation on a
`Scale.RESIZE` cutover attempt, and D-172 found a third risk in raising
the global canvas size. Neither ruled-out direction was needed — the fix
is entirely `BattleScene`-LOCAL.

- **Dynamic per-map tile size**: every one of `BattleScene.ts`'s ~68
  `TILE_SIZE` usages is grid/world-space (tokens, highlights, VFX), zero
  HUD/chrome — so making tile size dynamic never touches HUD code. A new
  pure, unit-tested `computeFittedTileSize()` (`GridSystem.ts`) extracts
  the same shrink-to-fit math `MapBuilderScene` already used inline;
  `BattleScene` now computes its own available grid area and constructs
  `GridSystem` with that computed size instead of the fixed `TILE_SIZE`
  constant, with all ~68 remaining usages swapped to `this.grid.tileSize`.
  Every existing shipped map still renders at exactly 64px/tile — no
  regression for current content (explicit test coverage).
- **`MAX_MAP_COLS`/`MAX_MAP_ROWS` raised 20/9 → 32/14** against a 40px
  minimum-tile-size floor (first-pass balance value, same status as
  `STARTING_GOLD`); `firestore.rules`' hand-unrolled row-index checks
  extended to match (rules have no loop construct, so this needed real
  changes, not just a constant bump).
- Tests: 1370 → **1377** (+7, `tests/gridFitting.test.ts`). Typecheck, all
  1377 tests, and the production build (**127 modules, unchanged**) all
  pass. No browser available in this environment — this is a real
  rendering change (every token/VFX size now computed) that needs Kevin's
  own look, folded into his eventual combined KI-098 playtest pass. See
  **D-176** in `DECISIONS.md` and **KI-127** in `KNOWN_ISSUES.md`.
- **This closes the entire KI-098 "build" backlog.** Only item 13
  (overworld campaign, Kevin's own explicit lowest priority, now also
  carrying item 12's former overworld-XP scope) remains — a future design
  conversation, not a quick follow-up.

## KI-098 items 10-11/12: per-group initiative + level cadence — DONE prior session (D-174, D-175)

Continuing straight down the KI-098 backlog. Before building items 10-12,
checked the actual code behind each one first — a good thing, since two of
the three turned out to rest on assumptions that didn't match reality.

- **Level cadence (D-174, items 11/12)**: items 11 ("XP distribution
  toggle") and 12 ("campaign pacing curve") both assumed a per-hero
  XP/kill-crediting economy that doesn't exist anywhere in this codebase —
  leveling has always been uniform (every living hero levels up together,
  automatically, every N waves cleared). Asked directly, Kevin drew a real
  distinction this project hadn't drawn before: the in-battle 1-20
  class-level track (this fix) should advance every SINGLE wave, no
  per-kill split needed at all; a separate overworld/campaign-only XP
  track (unlocking story-progress bonuses) is real but genuinely
  undesigned yet and belongs to item 13's epic instead of being built now
  as disconnected scaffolding. The fix: `ProgressionSystem.
  LEVEL_UP_WAVE_INTERVAL` 2 → 1. Resolves `SOURCE_OF_TRUTH.md` §9's
  long-OPEN "Level cadence" item.
- **Per-group initiative (D-175, item 10)**: Kevin's granularity answer was
  per-group. The "boss already gets its own turn" framing this question
  was originally asked against turned out to be inaccurate — verified
  before building, not after. `WaveSystem.tickEnemyPhase` now groups
  enemies by TYPE (`EnemyDefinition.id`), rolls each group's initiative
  once per wave via the previously-unused `InitiativeSystem` (built
  "framework only" back in Phase 13.5), and processes groups in that order
  every phase — sorting `this.active` IN PLACE so a same-phase
  reinforcement/summon still gets to act immediately, unchanged from
  before. Resolves `SOURCE_OF_TRUTH.md` §9's "Initiative" item too.
- Tests: 1367 → **1370** (+3, `tests/waveInitiative.test.ts`; D-174 needed
  no new tests — a single-constant change to already-tested arithmetic).
  Typecheck, all 1370 tests, and the production build (**127 modules, +1**
  — `InitiativeSystem.ts` finally has a real consumer) all pass. No
  browser available in this environment — every item here needs Kevin's
  own pass, folded into his eventual combined KI-098 playtest pass once
  the whole backlog is clear. See **D-174**/**D-175** in `DECISIONS.md` and
  **KI-125**/**KI-126** in `KNOWN_ISSUES.md`.
- Only items 9 (bigger maps, needs its own design pass) and 13 (overworld
  campaign, Kevin's own explicit lowest priority — now also carrying item
  12's former overworld-XP scope) remain on the whole KI-098 list.

## KI-098 item 8: hero-side split movement — DONE prior session (D-173)

Continuing straight down `KNOWN_ISSUES.md`'s KI-098 backlog per Kevin's
standing instruction (no playtest checkpoints in between). This session
cleared item 8, the last piece of the Enemy AI/Movement Redesign epic
(D-139 through D-146 built everything else).

- **The fix**: `Hero.movementBudget()` used to be all-or-nothing — the
  first move of a turn zeroed it out completely (an explicit "MVP: one
  move per turn" rule). A new private `Hero.movementTilesUsedThisTurn`
  (reset each turn alongside the pre-existing `moved` flag, which keeps
  its original "moved at all this turn" meaning) now tracks real leftover
  budget; `movementBudget()` returns `effectiveMovementTiles -
  movementTilesUsedThisTurn` (floored at 0). `Hero.moveTo(dest, tilesUsed?)`
  gained an optional second parameter for the move's real tile cost —
  omitting it (every pre-existing call site, including AI-controlled
  heroes and every existing test) still consumes the whole remaining
  budget, so nothing that doesn't care about split movement had to change.
- **No new UI was needed.** `BattleScene`'s existing "reselect a hero"
  flow already calls `showRange()` (gated on `hero.canMove()`), and its
  click-to-move/drag-to-move flows already gate through
  `hero.canMove()`/live `hero.movementBudget()`. The two human move-commit
  points (`confirmMove`, and the D-144 drag-and-drop `resolveDrop`) now
  pass the route's real tile cost into `moveTo` instead of letting it
  consume everything — that's the entire scene-side change.
- **Cunning Action Dash (Rogue) got a real math fix as a side effect**:
  it used to reset the old boolean flag, only ever correct when the whole
  move had already been spent. It's now `movementTilesUsedThisTurn -=
  effectiveMovementTiles` (allowed to go negative), which correctly stacks
  a full extra speed on top of any unused leftover — real SRD Dash math —
  while still matching the exact old behavior (one fresh full move) in the
  already-fully-moved case.
- `HeroSnapshot` (Coop live-sync) round-trips the new field, so a partial
  move mid-turn survives correctly instead of resetting on the other
  player's client.
- Tests: 1358 → **1367** (+9, `tests/d173Features.test.ts`). Typecheck, all
  1367 tests, and the production build (126 modules, unchanged) all pass.
  No browser available in this environment — every item here needs Kevin's
  own pass, folded into his eventual combined KI-098 playtest pass once the
  whole backlog is clear. See **D-173** in `DECISIONS.md` and **KI-124** in
  `KNOWN_ISSUES.md`.
- **This closes the entire Enemy AI/Movement Redesign epic** (D-139 through
  D-146, plus this) — every piece of that design session's spec is now
  built.

## KI-098 backlog, items 1-7 + real movement math — DONE prior session (D-165 through D-172)

Kevin's standing instruction: work straight down `KNOWN_ISSUES.md`'s KI-098
backlog, session after session, with no playtest checkpoints in between,
until the whole 13-item list is clear. This session cleared items 1-7.

1. **Compendium hover tooltips** (D-165): every itemized tab now shows
   compact, paginated rows instead of every entry's description sitting
   permanently on the page — hover shows the full text, matching Gear/Shop.
2. **Hotkey bar wired into battle** (D-166): the Character Sheet's
   editable hotkey bar (D-148) now actually fires in battle — a new 4th
   HUD row, one clickable button per filled slot.
3. **Equip-flow UX rethink** (D-167): the hero roster strip is now a real
   click/hover target — in equip mode it targets that hero directly, same
   equip/unequip logic as the board-token flow (unchanged, still works).
4. **Cast from the Character Sheet** (D-168): the Spellbook tab's cards
   and the Stats tab's action lines are real click targets now — clicking
   one closes the sheet and fires it on the resumed battle.
5. **Main Menu "Build Party" entry** (D-169): a discoverable path into
   Character Creation that doesn't imply committing to a battle.
6. **Five more playable races** (D-170): Dragonborn, Gnome, Goliath, Orc,
   Tiefling — all real SRD 5.2.1 species (11 total); also caught and
   corrected a sourcing-attribution error in the original six (data
   unchanged).
7. **Class-based movement bonus + real D&D movement math** (D-171/D-172):
   Monk's Unarmored Movement/Barbarian's Fast Movement wired real, then —
   following Kevin's own clarification on the item's deferred "map size"
   question — every movement-tile number in the game (races, class bonus,
   gear/potion bonuses, the `slowed` status, all 63 enemies) rescaled from
   an abstracted "1 tile ≈ 10ft" to real D&D math (1 tile = 5ft exactly).
   Also surfaced a new, previously-undocumented regression risk in item
   9's ("bigger maps") own canvas-size option — see that item in
   `KNOWN_ISSUES.md` for the recommended different approach.

Tests: 1348 → 1358 (net +10: +4 `hotkeyDisplayLabel`, +6
`d171Features.test.ts`; 11 other test files' hand-built maps/expected
positions updated in place with no net count change). Typecheck, all 1358
tests, and the production build (126 modules, unchanged) all pass. No
browser available in this environment — every item here needs Kevin's own
pass, folded into his eventual combined KI-098 playtest pass once the
whole backlog is clear. See D-165 through D-172 in `DECISIONS.md` and
KI-116 through KI-123 in `KNOWN_ISSUES.md`.

## August 2026 playtest bug batch — DONE prior session (D-160 through D-164)

Kevin's next in-browser playtest pass reported 8 items in one message.
Investigated with 6 parallel Explore/Plan agents reading the actual
current code (not the docs' own claims) before writing anything. See
**D-160** through **D-164** in `DECISIONS.md` and **KI-111** through
**KI-115** in `KNOWN_ISSUES.md`.

- **Character Creation** (D-160): the 4 hero-name DOM `<input>`s no longer
  stay visible on top of every picker/wizard overlay (they're real HTML
  elements Phaser's DOM plugin layers above the canvas, outside normal
  depth sorting — nothing hid them before). The scene's Back button moved
  from a hand-rolled bottom-center control to the standard top-left slot 9
  of the game's other 12 back-navigating scenes already use, fixing both
  "no way back to the main menu" and the crowded bottom edge.
- **Main Menu border overlap** (D-161): Settings and Exit Game no longer
  overlap `drawScreenBackdrop`'s ornate frame (two independent hardcoded
  margins had never been reconciled — Settings was overlapping the frame
  by 8px, Exit Game had only 4px of clearance).
- **Horizontal-squish mitigation** (D-162) — **explicitly unconfirmed**:
  Kevin reported the canvas squishes horizontally after exiting a battle
  and stays that way on every later screen, except DOM elements. Static
  reading couldn't pin down a mechanism (D-159's revert is code-complete;
  `Scale.FIT` can't itself produce a non-uniform squish) — shipped
  `MainMenuScene.create()` calling `this.scale.refresh()` as a targeted,
  low-risk best guess, flagged for Kevin's own re-check rather than
  claimed fixed.
- **No more silently-invented level-up defaults** (D-163): Kevin's own
  words — "I want all blue-prints to be player-made." Character
  Creation's Starting Level/Team Level fast-forward, and an "Auto" Plan
  Levels mode with an incomplete plan, both used to silently apply a fixed
  ASI/subclass/spell-pick default with zero prompt. `LevelUpPlanSystem`'s
  three resolvers now report unresolved instead of mutating, and
  `BattleScene` queues anything unresolved from the pre-battle fast-forward
  as real prompts shown right before wave 1 — reusing the exact same
  queue mechanism a normal in-battle level-up already uses.
- **Every remaining click-to-cycle button replaced with a real list
  picker** (D-164): D-147's picker primitive (`renderPlanPrompt`) was
  lifted out of `CharacterCreationScene` into a shared, scene-agnostic
  `uiTheme.ts` helper (`renderChoiceOverlay`/`clearChoiceOverlay`/
  `openChoiceList`), then used to convert Map Builder's Width/Height
  (Kevin's own named example), Settings' Game Speed/Master/Music/SFX
  Volume, Character Creation's Signature Action/Starting Level/Party
  Size/Difficulty/Team Level, and Free Play's/Browse Shared Maps'
  Difficulty. True binary toggles and the mid-battle Game Speed keyboard
  hotkey were deliberately left as cycling — not the pattern Kevin
  flagged.
- **Also resolved with no code change**: the level-by-level Character
  Creation planner Kevin wasn't sure had been built — it has (D-133's
  "Plan Levels" wizard) — just needs his own browser confirmation now that
  the bugs that may have been hiding it (stray names, missing Back
  button) are fixed.
- Tests: 1349 → **1348** (net -1: +26 rewritten in
  `levelUpPlanSystem.test.ts` to assert unresolved-not-defaulted, -1 for
  the now-dead `nextVolume` removed alongside its test,
  `mainMenuLayout.test.ts`'s pinned-baseline updated to the new
  corner-control region). Typecheck, all 1348 tests, and the production
  build (126 modules, unchanged) all pass. No browser available in this
  environment — every visual/layout fix here needs Kevin's own pass,
  especially D-162 (see KI-113), which is a best-effort mitigation, not a
  confirmed fix.

## Reverted the `Scale.RESIZE` cutover — DONE prior session (D-159)

Kevin's first real in-browser pass caught two confirmed bugs from D-157:
Main Menu's corner controls overlapping the frame border, and Character
Creation's Start/Back buttons rendering completely off-screen. See **D-159**
in `DECISIONS.md` and **KI-109** in `KNOWN_ISSUES.md` (updated in place).

- Root cause: `Scale.RESIZE` has no automatic shrink-to-fit — the whole
  D-154/155/156 roadmap only ever handled horizontal recentering on
  resize, never vertical space, and `Scale.FIT`'s shrink was quietly
  masking that gap the entire time.
- `main.ts` is back to `Scale.FIT`; `BattleScene`'s runtime scale-mode-swap
  code (added to lock battles to `FIT` under the old `RESIZE` default) is
  removed as pointless now.
- The D-157 fixes to shared UI helpers reading live viewport size instead
  of fixed constants were NOT reverted — harmless under `FIT`, useful
  groundwork if this is attempted again with a design that handles
  vertical space too.
- Responsive-canvas roadmap status: step 3 is back to NOT DONE. Step 4
  (`BattleScene`'s `TILE_SIZE` scaling) remains gated on step 3 — now with
  an explicit note that a retry needs a real plan for vertical space, not
  just a mode switch.
- Typecheck, all 1349 tests, and the production build (126 modules,
  unchanged) all pass. This restores previously-working behavior rather
  than introducing a new unverified fix.

## KI-034 redesign: hero roster strip + decluttered status line — DONE prior session (D-158)

Kevin picked this over continuing the responsive-canvas roadmap, after
confirming for a fourth session that he hated the packed bottom status/hint
line even though every individual behavior in it worked. See **D-158** in
`DECISIONS.md` and **KI-110** in `KNOWN_ISSUES.md`.

- `BattleScene`'s bottom HUD now shows a real per-hero roster strip (boxed
  widgets with name/level, a color-coded HP bar with exact numbers, a green
  selection border, and a reserved AC/move/act/gear detail line for
  whichever hero is selected) instead of one packed, mode-dependent text
  block.
- Most of the old hint text turned out to be redundant with an
  already-visible button label (Ability/Potion/Character Sheet/Confirm/
  Cancel all already say their own hotkey) or board highlight (blue/red
  move/attack tiles) — removed rather than shortened. What remained
  (aiming-mode instructions, the keyboard `Tab:` focus indicator, Test
  Mode's debug hints, and rejection messages) moved into a new, much
  smaller message line; `Enemies: N` moved to the top HUD; item
  descriptions in Build/Gear mode moved to a hover tooltip reusing the
  existing D-132 tooltip controller — still triggered by both mouse hover
  and keyboard grid-focus, preserving full keyboard-only play.
- Found and fixed one related gap while rewiring this: tabbing into the
  item grid now previews the focused item's tooltip immediately, rather
  than only after the next arrow-key move.
- No new tests (presentation-only, `BattleScene.ts` has zero test coverage
  by this project's architecture rule). Tests remain at **1349**.
  Typecheck, all 1349 tests, and the production build (126 modules,
  unchanged) all pass. `npm run dev` serves HTTP 200. No browser available
  in this environment — this is a substantial rewrite of live battle UI
  that genuinely needs Kevin's own pass; see KI-110, including
  re-confirming KI-034's own keyboard-only-play checklist under the
  rewrite.

## Responsive-canvas roadmap step 3: the actual `Scale.RESIZE` cutover — DONE prior session (D-157)

The roadmap's step 3. See **D-157** in `DECISIONS.md` and **KI-109** in
`KNOWN_ISSUES.md`.

- `main.ts` now runs `Scale.RESIZE` by default — the real browser window
  size finally matters, and every non-`BattleScene` scene's D-154/155/156
  conversion now reads a genuinely live viewport instead of a fixed
  1280x1080 that happened to equal `GAME_WIDTH`/`GAME_HEIGHT`.
- `BattleScene` locks the canvas back to the old fixed-resolution
  `Scale.FIT` for the duration of a battle (`create()`), reverting to
  `Scale.RESIZE` the instant a battle ends (its existing `SHUTDOWN`
  handler) — battles, and every overlay reachable while one is merely
  paused underneath (Character Sheet, Pause Menu, Settings), look and scale
  exactly as before this cutover.
- Found and fixed several latent bugs the cutover would otherwise have
  surfaced immediately: shared UI helpers (`uiTheme.ts`'s parchment
  backdrop/motes/`centeredRowX`, `tooltip.ts`, `dialogueBox.ts`) that read
  the fixed `GAME_WIDTH`/`GAME_HEIGHT` constants instead of a scene's live
  viewport — harmless dead code under `Scale.FIT` (always numerically
  identical), but would have broken every parchment-themed menu screen at
  any non-1280x1080 window size. All now read the live canvas.
- Known, accepted limitation: `CharacterCreationScene`'s wizard overlay and
  Compendium's sample-dialogue box don't resize their dim backdrop if a
  browser resize fires while either is already open — self-heals on next
  redraw.
- **Roadmap status**: remaining steps are `BattleScene`'s own `TILE_SIZE`
  dynamic-scaling (the actual "bigger maps in battle" payoff, step 4 —
  explicitly gated on Kevin's own in-browser confirmation of this step
  first) and raising `MAX_MAP_COLS`/`MAX_MAP_ROWS` (step 5).
- No new tests (presentation/scale-manager plumbing only). Tests remain at
  **1349**. Typecheck, all 1349 tests, and the production build (126
  modules, unchanged) all pass. `npm run dev` serves HTTP 200. No browser
  available in this environment — see KI-109. **This is the first step in
  the roadmap where a real in-browser resize test is load-bearing, not just
  recommended** — everything before this was correct-by-construction but
  never actually exercised.

## Responsive-canvas roadmap step 2: Map Builder + Character Creation own resize-reactivity — DONE prior session (D-156)

Continuing D-154/D-155's roadmap: step 2, the last two scenes. See **D-156**
in `DECISIONS.md` and **KI-108** in `KNOWN_ISSUES.md`.

- **Map Builder**: its grid already dynamically fit tile size to available
  space, just not on a live resize — now wired via the same
  `centeredObjects`/`repositionLayout()` mechanism D-155's `CoopLobbyScene`
  introduced (needed since its map-name field is a persistent DOM `<input>`).
  The old `GRID_AREA_RIGHT` constant is now computed live from the viewport.
- **Character Creation**: the largest scene in the whole effort by
  `GAME_WIDTH`/`GAME_HEIGHT` reference count, but every reference turned out
  to reduce to the same `viewportWidth / 2 + constant` shape — so instead of
  registering ~150+ individual widgets, a single `repositionLayout()` shifts
  every current child object's `.x` by the same constant amount whenever the
  viewport center moves. Its 4 hero-name `<input>` fields keep their typed
  text and focus since nothing is destroyed.
- **Known, accepted limitation**: the level-planner/spell-picker wizard
  overlay's full-screen dim backdrop only re-syncs its own WIDTH/HEIGHT when
  freshly redrawn (e.g. any click) — a resize firing while it's static would
  leave it briefly at the old size. Can't actually happen under today's
  `Scale.FIT`.
- **Roadmap status**: every scene in the app except `BattleScene` itself now
  follows the responsive-layout convention. Remaining: the `Scale.RESIZE`
  cutover itself, then `BattleScene`'s own `TILE_SIZE` dynamic-scaling (the
  actual "bigger maps in battle" payoff), then raising
  `MAX_MAP_COLS`/`MAX_MAP_ROWS`.
- No new tests (presentation-only). Tests remain at **1349**. Typecheck, all
  1349 tests, and the production build (126 modules, unchanged) all pass.
  `npm run dev` serves HTTP 200. No browser available in this environment —
  see KI-108.

## Responsive-canvas roadmap step 1: 5 more scenes converted — DONE prior session (D-155)

Continuing D-154's own roadmap in its stated order: item 1, the 5 scenes
flagged as needing more than the mechanical treatment. See **D-155** in
`DECISIONS.md` and **KI-107** in `KNOWN_ISSUES.md`.

- **Compendium**: chrome (title/Back/tabs/parchment panel/`detailText`) now
  rebuilds via the same `rebuildLayout()` convention as Bestiary; the
  per-class/per-level sub-selectors (triggered by clicks, not resizes) read
  the viewport directly instead of taking it as a parameter.
- **Character Sheet**: converted while correctly leaving the paused
  `BattleScene` underneath it untouched (it's launched as a real second
  scene via `scene.launch`/`scene.pause`, D-148) — only its own chrome and
  tab content rebuild on resize.
- **Browse Shared Maps**: the Firestore fetch (`listSharedMaps`) now runs
  exactly once per scene visit, never on a resize — a resize just re-renders
  the already-fetched list. A new `hasLoadedOnce` guard stops the very first
  render from flashing a false "no maps published" message before the fetch
  resolves.
- **Free Play**: converted from its original (never D-123-restyled) plain
  button style — six section-builder methods now take `width` as a
  parameter, matching `LoadGameScene`'s established convention.
- **Co-op Lobby**: the one real exception. Its join-code `<input>` (this
  project's first DOM form field) would lose typed text and focus if
  destroyed and rebuilt, so this scene gets a lighter `repositionLayout()`
  mechanism instead — every object registers a `{ obj, dx, y }` entry once
  at creation, and a resize just calls `.setPosition()` on each rather than
  replacing anything. Establishes the pattern any future scene with
  persistent DOM/can't-destroy state should follow.
- **Still deliberately not done** (unchanged from D-154): the `Scale.RESIZE`
  cutover itself; Character Creation and Map Builder's own resize-reactivity;
  `BattleScene`'s `TILE_SIZE` dynamic-scaling (the actual "bigger maps in
  battle" payoff); raising `MAX_MAP_COLS`/`MAX_MAP_ROWS`.
- No new tests (presentation-only, no new pure-system rule — matches every
  other scene-conversion pass). Tests remain at **1349**. Typecheck, all
  1349 tests, and the production build (126 modules, unchanged — no new
  files) all pass. `npm run dev` serves HTTP 200. No browser available in
  this environment — see KI-107.

## Responsive-canvas foundation (7 scenes) + Map Builder click-and-drag paint tool + real map-name field — DONE prior session (D-154)

Kevin picked KI-098's "Maps & Map Builder" thread. See **D-154** in
`DECISIONS.md` and **KI-106** in `KNOWN_ISSUES.md`.

- **The real goal — "larger maps" — needs a responsive, full-screen canvas.**
  Every map is capped near 20x9 tiles today purely because `BattleScene`
  draws at a fixed 64px tile size inside a fixed 1280x1080 canvas
  (`Scale.FIT`, letterboxed). Asked how to solve it, Kevin wanted more than
  a third canvas-size bump (done twice before) — a genuinely responsive
  canvas, confirmed to apply to the WHOLE app, not just battles. That's a
  real multi-session architecture change (~12 scene files plus
  `BattleScene.ts` itself: 8049 lines, 88 `GAME_WIDTH`/`GAME_HEIGHT` refs,
  68 `TILE_SIZE` refs). Kevin chose "foundation + simple menus first."
- **The foundation** (`uiTheme.ts`'s new `getViewport`/`onViewportResize`):
  deliberately stays on `Scale.FIT` this pass — a zero-behavior-change
  refactor today, since `scene.scale.width/height` is still pinned to
  1280x1080 under FIT regardless of the real window. The `Scale.RESIZE`
  cutover (the moment real window size starts mattering) is held for a
  later session, once more scenes are converted — flipping it early would
  visibly break every unconverted scene.
- **7 scenes converted**, lowest-risk first: Pause Menu, Settings,
  Campaigns, Main Menu, Load Game, Test Mode, Bestiary. Bestiary needed
  care to NOT reset its current page/tab on a rebuild (only `create()`
  resets those). A real latent bug found and fixed along the way: Main
  Menu's Account control used to re-subscribe a live Firebase listener
  every time it ran — harmless until made resize-reactive, now subscribes
  once.
- **One layout computation extracted to a pure, tested function**
  (`computeCornerControlsRegion`, new `systems/mainMenuLayout.ts`) —
  establishes the pattern future scene conversions' non-trivial layout math
  should follow, since `scenes/` imports Phaser and can't be unit-tested in
  this project's plain-Node Vitest environment.
- **Map Builder: a real click-and-drag continuous paint tool** — was
  genuinely one tile per click before; click-and-hold now paints every tile
  crossed while held.
- **Map Builder: a real map-name text field** — replaces the fixed 8-name
  cycle pool with a genuine typed `<input>` (this project's third, after
  Character Creation's hero name and Co-op's join code). Publish now
  requires a non-blank name (`isValidMapName`); Playtest is unaffected.
- **Deliberately NOT this session**: the `Scale.RESIZE` cutover itself; the
  remaining ~5 harder scenes (Compendium, Character Sheet, Browse Shared
  Maps, Free Play, Co-op Lobby — each needs extra DOM-input/pagination
  care); Character Creation and Map Builder's OWN resize-reactivity;
  `BattleScene`'s `TILE_SIZE` dynamic-scaling (the actual "bigger maps in
  battle" payoff — its own dedicated future session); raising
  `MAX_MAP_COLS`/`MAX_MAP_ROWS` (pointless until `BattleScene` can render
  past the current ceiling).
- Tests: 1344 → **1349** (+5). Typecheck, all 1349 tests, and the
  production build (126 modules, +1) all pass. `npm run dev` serves HTTP
  200. No browser available in this environment — see KI-106.

## Real Settings screen: Master/Music/SFX volume + Mute, no audio content yet — DONE prior session (D-153)

Kevin asked directly to start building audio settings even though no music
or sound effects exist yet, a deliberate reversal of the earlier "no audio
system exists" call. See **D-153** in `DECISIONS.md` and **KI-105** in
`KNOWN_ISSUES.md`.

- **New `SettingsScene`**: Game Speed (moved off Main Menu's old single
  corner button), Master/Music/SFX Volume (each a 0/25/50/75/100% cycle),
  and Mute All. Reachable from a new Main Menu "Settings" button, and as a
  live overlay from the Pause Menu (its old "Game Speed" row is now
  "Settings") — Game Speed still changes live mid-battle from there (D-130).
- **New `AudioManager`** (`scenes/`, Phaser-dependent): applies master
  volume/mute directly to Phaser's real shared sound manager, and tracks
  music/SFX category volume for anything it plays via new `playMusic`/
  `playSfx` helpers. Both are safe no-ops today (no audio asset is loaded
  anywhere — KI-029) but genuinely functional infrastructure, not dead
  scaffolding, the moment one ships.
- `SettingsSystem` (`systems/`, still Phaser-free) gains `masterVolume`/
  `musicVolume`/`sfxVolume`/`muted`, persisted alongside Game Speed.
- **Fixed a real latent bug this surfaced**: `BattleScene.cycleGameSpeed()`
  and Main Menu's old settings button both persisted a bare
  `{ animationSpeed }` object — harmless with one field, but would have
  silently wiped the new volume/mute fields on every Game Speed change.
- Tests: 1341 → **1344** (+3). Typecheck, all 1344 tests, and the production
  build (125 modules, +2) all pass. `npm run dev` serves HTTP 200. No
  browser available in this environment — see KI-105.

## Real in-battle pause menu — DONE prior session (D-152)

Kevin asked directly for an in-game menu reachable mid-battle. See **D-152**
in `DECISIONS.md` and **KI-104** in `KNOWN_ISSUES.md`.

- **New `PauseMenuScene`**, opened via Esc (previously a silent, unwarned
  `scene.start("MainMenuScene")` — a real pre-existing gap this closes) or a
  new always-visible "Menu (Esc)" HUD button, using the exact paused-second-
  scene mechanism D-148's Character Sheet already established.
- **Resume Battle / Save Party / Save & Exit / Load Game / Exit to Main
  Menu / Controls / Game Speed** — Load and Exit both confirm first
  ("progress will be lost"); Save Party/Save & Exit disable themselves
  with "(unavailable in Co-op)" for a coop battle (no `CharacterBuild[]`
  exists there to save); Controls is a real keybinding reference; Game
  Speed reuses the existing setting/hotkey exactly, no new one invented.
- **`CharacterCreationScene` now forwards the party's real
  `CharacterBuild[]`** into `BattleScene`'s init data — previously
  discarded once `HeroDefinition[]` was built, and NOT reconstructable
  from that shape afterward (race id is gone by then).
- **New shared pure function** `SaveSystem.saveOrUpdatePartySlot` — the
  create-or-update-slot decision `CharacterCreationScene.onSaveParty` had
  inline, now shared with the pause menu's Save action and covered by 4
  new tests.
- **Deliberately NOT built**: Audio settings (no audio system exists
  anywhere — KI-029) and any graphics/resolution setting beyond Game Speed.
  Save captures the party's BUILD only, not this battle's own wave/gold/
  structure progress — no mechanism for that exists in this project yet.
- Tests: 1337 → **1341** (+4). Typecheck, all 1341 tests, and the
  production build (123 modules, +1 new file) all pass. `npm run dev`
  serves HTTP 200. No browser available in this environment.

## Small polish items — DONE prior session (D-151)

The last two "Small polish items" from KI-098. See **D-151** in
`DECISIONS.md` and **KI-103** in `KNOWN_ISSUES.md`.

- **Cape of Billowing recolor**: turned out to be a real bug, not a pending
  placeholder choice — the cape graphic was reusing `COLORS.heroActive`
  (the selected-hero highlight color). Now has its own dedicated deep-red
  `capeBillowingPlaceholder` color.
- **Exit Game control**: added to the Main Menu's bottom-left corner.
  Attempts `window.close()` (works only in a script-opened window or a
  future desktop/PWA wrapper), then always falls back to relabeling itself
  "You may now close this tab" and disabling — a normal browser tab can't
  be force-closed by the page itself, so this keeps the click from reading
  as broken.
- Tests: 1337 → 1337 (no new tests). Typecheck, all 1337 tests, and the
  production build (122 modules) all pass. No browser available in this
  environment.

## Compendium/Bestiary organization — DONE prior session (D-150)

Kevin's pick from KI-098's remaining threads (over Maps & Map Builder,
Progression systems, small polish items). See **D-150** in `DECISIONS.md`
and **KI-102** in `KNOWN_ISSUES.md` for the in-browser re-confirmation
checklist.

- **Alphabetization**: Classes/Subclasses/Races/Feats/Skills/Potions/Status
  Effects each display alphabetically now. Classes and Skills were sorted
  in their own source arrays (safe — no other order-sensitive consumer);
  the other five keep their real declared order (default new-build race/
  subclass, picker order, shop order, status-badge render order all depend
  on it) and get a display-only sorted copy inside `CompendiumScene.ts`
  instead.
- **Two new Compendium tabs**: "Buildings" and "Traps", reading
  `STRUCTURE_DEFINITIONS` for the first time — grouped by sub-type (wall
  vs. platform; ground- vs. flying-targeted trap), alphabetical within each
  group.
- **Bestiary role tabs**: Minions/Miniboss/Bosses/Legendary are now real
  tabs (mirroring `CompendiumScene`'s own tab pattern) instead of one
  continuously-paginated flat scroll.
- **Artificer question resolved**: confirmed intentional, not an oversight
  — Tasha's-sourced, not core SRD 5.2.1, correctly excluded by this
  project's SRD-only content rule. No code change.
- Tests: 1337 → 1337 (no new tests — both scenes are presentation-only).
  Typecheck, all 1337 tests, and the production build (122 modules) all
  pass. No browser available in this environment.

## Two confirmed bug fixes — DONE prior session (D-149)

Kevin's two confirmed 2026-08-21 playtest bugs, fixed ahead of starting a
new KI-098 feature thread (Kevin's own pick, over Compendium/Bestiary,
Maps, and Progression). See **D-149** in `DECISIONS.md` and **KI-101** in
`KNOWN_ISSUES.md` for the in-browser re-confirmation checklist.

- **Waypoint pinning (D-144) now accepts multiple pins.** Root cause:
  `BattleScene`'s global `pointerup` handler resolved/ended the drag on ANY
  button release, including the right button's own release right after it
  had just pinned a waypoint — so the drag ended (committing to that first
  pin) before a second right-click could ever add another. Fixed by
  ignoring `pointer.rightButtonReleased()` in that handler.
- **The move-range highlight during a drag now follows the latest pin.**
  New `updateDragRangeHighlight()` re-roots the reachable-tile highlight at
  the last pinned waypoint (or the hero's own tile with none) using
  whatever movement budget the pinned legs haven't already spent, instead
  of leaving the original hero-tile highlight sitting there stale for the
  whole drag.
- **Main Menu title/corner-control overlap fixed.** The title's flanking
  decorative line was positioned at a guessed half-width that undershot the
  font's real rendered width. `buildTitle` now measures the title's actual
  `getBounds()` against the Settings/Account controls' region and shrinks
  the font until they clear, rather than a fixed guessed size.
- Tests: 1337 → 1337 (no new tests — both are behavioral fixes to existing,
  already-tested code paths). Typecheck, all 1337 tests, and the production
  build (122 modules) all pass. No browser available in this environment.

## Battle HUD / actions / character sheet overhaul — DONE prior session (D-148)

Kevin's stated #1 pain point from his 2026-08-21 feedback session (KI-098),
picked over that session's other threads (D-147's Character Creation
overhaul was picked first, the prior session). Planned via `EnterPlanMode`
into ~9 pieces; Kevin explicitly chose to attempt the whole sequence in one
session. See **D-148** in `DECISIONS.md` for the complete method and
**KI-100** in `KNOWN_ISSUES.md` for the full in-browser checklist —
**led by the new scene-pause mechanism**, which nothing in this codebase had
exercised before this session.

- **Piece 1**: the always-on hero roster strip now shows only name/level/HP
  for an unselected hero; AC (D-132)/move-ready/act-ready/gear-count moved
  into a detail block shown only for the selected hero.
- **Piece 2**: `HeroActionRegistry` (new, `systems/`) replaces two
  hand-written 13-feature `if/else` chains in `BattleScene` with one
  ordered table — a pure extraction, no rule change.
- **Piece 8**: a level-up popup with no ASI/subclass/spell choice now shows
  real stat/feature deltas ("+6 max HP, new feature: Action Surge") via a
  new pure `levelUpDeltaSummary` in `LevelUpPlanSystem.ts`, instead of a
  bare "reaches level N!" line.
- **Piece 0**: a new `CharacterSheetScene`, opened as a real second Phaser
  scene (`scene.launch` + `scene.pause`/`scene.resume`) over a paused
  battle — chosen over an in-battle overlay so the sheet gets `uiTheme.ts`'s
  styling for free and doesn't grow the already-8000+-line `BattleScene.ts`
  further.
- **Piece 3**: a new, validated `Hero` hotkey bar (`ACTION_HOTKEY_SLOT_COUNT
  = 6` slots) — a curated subset of what a hero could do, threaded through
  `CharacterBuild`/`HeroDefinition`/`HeroSnapshot` exactly like
  `preparedSpellIds` (D-135), including a real save/load round-trip.
- **Piece 7**: the D-132 tile-hover tooltip is now a shared, reusable
  primitive (`scenes/tooltip.ts`) — `BattleScene`'s own tile tooltip
  migrated onto it, not left running in parallel.
- **Pieces 4/5/6a**: the Character Sheet's three tabs — Stats (read-only),
  Spellbook (level-grouped, hover for full rules text, closing the "gross
  flat list" complaint), and Hotkeys (click a slot, click an action/spell to
  pin it).
- **Piece 9a**: hovering a hero in equip mode with an item selected now
  shows a before/after AC/attack-bonus preview.
- **Deliberately deferred, not built this pass**: piece 6b (wiring the new
  hotkey bar into `BattleScene`'s actual Q/R/F/T buttons — flagged by the
  plan itself as the epic's riskiest single change, held back until Kevin's
  confirmed the hotkey-editing UI feels right) and piece 9b (the equip
  flow's actual click-through redesign — Kevin gave no target UX for it
  yet).
- Tests: 1308 → **1337** (+29). Typecheck, all 1337 tests, and the
  production build (122 modules, +3 new files) all pass. `npm run dev`
  serves HTTP 200. No browser available in this environment.

## Character Creation Overhaul, pieces 1-5 — DONE prior session (D-147)

Kevin's 2026-08-21 feedback session called Character Creation "garbage" and
asked for it to move much closer to a real character builder. Planned via
`EnterPlanMode` into five pieces, all shipped this session — see **D-147**
in `DECISIONS.md` for the complete method and **KI-099** in
`KNOWN_ISSUES.md` for the full in-browser checklist still outstanding.
**KI-098** holds the rest of that same feedback session's larger wishlist
(Battle HUD redesign, overworld campaign, initiative, etc.) — Kevin picked
Character Creation specifically this session; the rest is untouched.

- **Piece 1**: a new `openChoicePicker` overlay (built on the existing
  `renderPlanPrompt` primitive already shared by the Level Planner/Spell
  Picker wizards) replaces click-to-cycle for Class/Race/Gear/Subclass —
  each opens a full-screen list of every option at once. Name/ability
  scores/Signature Action are handled separately (pieces 2/3) or
  deliberately left as a cycle button (Signature Action).
- **Piece 2**: hero names are now a real, editable HTML `<input>` — this
  project's second DOM text field (after `CoopLobbyScene`'s join code,
  KI-062) — replacing the old fixed-12-name cycle pool. A blank/duplicate
  name both now block Start Battle.
- **Piece 3**: a second ability-score method, SRD 5.2.1 Point Buy (27-point
  budget, real cost table), alongside the existing Standard Array — a
  party-wide toggle (not per-hero, matching real 5e practice), sharing a
  row with the existing Team Level control rather than adding a new one.
  New `PointBuyAllocator`/`AbilityScoreAllocator` interface in
  `CharacterBuildSystem.ts`.
- **Piece 4**: every class gained a one-sentence `previewSummary` (original
  wording, grounded in this project's own modeled mechanics), shown on the
  Class picker.
- **Piece 5**: the Race picker shows real data only (speed, traits) — no
  invented ability bonus, since SRD 5.2.1 (D-134) ties ability increases to
  Background, not Race. The Subclass row's summary text for a later-choice
  class now points at the existing "Plan Levels" wizard instead of implying
  creation-time planning wasn't possible.
- Investigation also resolved two of Kevin's open questions with NO code
  change needed: spell-class gating was already real (not a bug), and
  subclass picking already existed in Character Creation for Cleric/
  Sorcerer/Warlock.
- Tests: 1299 → **1308** (+9, all in `tests/characterBuildSystem.test.ts`).
  Typecheck, all 1308 tests, and the production build (119 modules,
  unchanged) all pass. `npm run dev` serves HTTP 200. No browser available
  in this environment — the picker overlays, the DOM name field, and Point
  Buy's live math all still need Kevin's own pass (KI-099).

## Enemy AI / Movement Redesign — the ENTIRE epic is now DONE (D-139 through D-146, plus D-173)

A full design session with Kevin resolved a long-standing tension between
this game's tower-defense identity and its D&D-combat identity. Seven
pieces of the redesign are now built: enemies decouple "taking damage" from
"being stopped" (§1: always advance unless truly blocked with no detour —
built as **D-139**), carry a per-enemy Aggressiveness stat governing how
much extra route length they'll tolerate before forcing a fight instead of
detouring (§2 — built as **D-140**), both heroes and enemies can move
diagonally with true Euclidean cost, rounded to the nearest 5ft only for
budget comparisons (§5 — build sequence step 3, built as **D-141**), attack
range/spell-ability range/aura radius all use that same diagonal-aware
distance metric (step 4, built as **D-142** — closes **KI-093**), an enemy
that lands an attack now spends any leftover movement budget continuing
toward the exit instead of stopping outright, plus an opt-in Sprint
capability that doubles movement on a non-fighting phase (step 5,
enemy-only half of §4, built as **D-143**), a siege enemy with no
destructible wall already in its own attack range evaluates the walls it
could plausibly reach and walks toward whichever one would shorten its
route to the exit the most (§3's siege half, step 6, built as **D-145**),
and — the most recent piece — a high-tier AoE/breath attacker (boss/
legendary `aoeAttack`, e.g. Ashen Sovereign, The Hollow Empress) evaluates
every tile it could stop on and repositions to line up 2+ heroes at once
instead of just marching toward the exit and hitting whoever ends up in
range (§3's AoE half, step 7, built as **D-146**). All seven are pure
systems/AI/targeting-math work, mechanically verified headless (typecheck,
1253 → 1299 tests, production build all pass) — see
**KI-092**/**KI-093**/**KI-094**/**KI-096**/**KI-097** for the
gameplay-feel playtest still outstanding.

**Also built alongside D-146, at Kevin's request — a related but separate
gap, not originally part of the redesign spec**: self-defense (provoked
retaliation). An enemy a hero just landed a hit on now strikes back on its
own next turn if that hero is still in its attack range, instead of
obliviously continuing an unconditional priority action (a siege enemy
bashing a wall, a Saboteur disarming a trap) while getting cut down.
`ignoresHeroes` pure runners (Sprinter, Bolt Runner) are exempt — the
"doesn't care about heroes at all" archetype Kevin explicitly asked to
preserve. See **D-146**/**KI-097**.

**§4's last remaining piece — hero-side split-movement (move → act → move
again) — shipped as D-173** (KI-098 item 8, a later session): real
leftover-budget tracking on `Hero` (`movementTilesUsedThisTurn`), with the
existing selection/range-highlight/click-to-move and D-144 drag-move UI
requiring no logic changes of their own, since they already re-derive
everything from `hero.canMove()`/`hero.movementBudget()` live. See
**D-173** in `DECISIONS.md` and **KI-124** in `KNOWN_ISSUES.md` for the
in-browser checklist. Every piece of this design session's original spec
is now built.

## Drag-and-drop hero move with pinned waypoints — DONE (D-144)

Kevin's own ask, planned via `EnterPlanMode` given the real interaction-
design forks involved (see `C:\Users\kevinb\.claude\plans\abstract-growing-valley.md`
for the approved plan): click-and-hold a selected hero's own token to pick
it up, live-preview the move distance as the pointer moves, right-click to
pin a chain of waypoints around corners, release to drop. Coexists with —
does not replace — the existing click-to-select/click-to-confirm move flow,
which is unchanged for a player who never holds and drags. New
`MovementSystem.routeThroughWaypoints` (pure, unit-tested) computes the
multi-leg route/distance; `BattleScene.ts` gained the drag input handling,
live preview rendering, and drop resolution, plus hero moves now tween
(previously an instant snap) both here and in the existing Confirm-button
flow. Vision (the existing stealth-reveal mechanic) correctly stays keyed
to the hero's real position on drop only, by construction. Typecheck, 1278
→ 1286 tests, production build, and `npm run dev` (HTTP 200) all pass — see
**KI-095** for the (unusually large, given how mouse-dependent this is)
in-browser checklist still outstanding.

## Test Mode (D-138) — DONE previous session

KI-085's last remaining large item — every other item on that list (Starting
Level, the level-up planner, damage types, spell-prep economy) had already
shipped. Kevin confirmed he wanted it built now and picked two scope forks: a
dedicated Main Menu entry point (not a Free Play toggle), and a live
in-battle spawner (not just a pre-battle setup screen).

- **`TestModeScene` (new)**: a stripped-down map/wave-count picker, no
  gating, reached from a new "Test Mode" button in Main Menu's Creator Tools
  row. Hands off to `CharacterCreationScene` with `testMode: true`, forwarded
  unchanged to `BattleScene` — Starting Level/Team Level (D-129) already
  covers "playable at any level."
- **`WaveSystem.setNoFail`/`forceEndWave`/`spawnAt`**: a stronghold-cannot-
  fall toggle, a force-clear-current-wave hook (no reward gold), and an
  on-demand single-enemy spawn — all reusing the real underlying mechanics.
- **`Hero`/`Enemy.removeStatus(id)`**: removes a status early; paired with
  the existing `applyStatus` for toggle-based debug status assignment.
- **A live in-battle Debug Menu (F9)**, visible only in Test Mode: Skip Wave,
  a No-Fail Stronghold toggle, and three tools — Spawn Enemy (full roster,
  any tile), Paint Terrain (any type, no placement validation), Set Status
  (toggle any status on any hero/enemy) — each with its own picker grid
  sharing the Shop/Gear grid's existing footprint/pagination/keyboard nav.
- Tests: 1251 → **1253** (+2), typecheck and the production build (118
  modules, up from 117 — the new `TestModeScene.ts`) both clean. Not yet
  confirmed by Kevin in a browser — see KI-091.

## Dual-Typed Damage System (D-137) — DONE previous session

Kevin asked for a system that can handle an attack/spell/item dealing TWO
real damage types in the same hit — D-131 had already flagged inline that
this engine was collapsing several genuinely dual-typed SRD spells (Meteor
Swarm, Flame Strike, Ice Storm) to one type by judgment call, and future
magic items would need the same hook.

- **`DamageTypeSplit` (`data/weapons.ts`)**: `{ type, portion }`, a
  component of a dual/multi-typed split whose portions sum to 1.
- **`AttackProfile.damageTypes?`/`AbilityDefinition.damageTypes?`/
  `SavingThrowSystem.applySaveOrDamage`'s `options.damageTypes?`**: when
  present, splits raw damage per portion and resolves resistance/
  vulnerability/immunity independently per type before summing — real 5e
  RAW for a spell that deals more than one type at once. The existing
  singular `damageType` is unchanged (still what `VisualFxSystem` reads for
  hit color/death cause); a dual-typed spell sets both.
- **Converted the three spells that genuinely deal two types on the SAME
  hit**: `meteor-swarm` (fire+bludgeoning, even 50/50) and `flame-strike`
  (fire+radiant, even 50/50) match real SRD's own even dice split;
  `ice-storm` splits bludgeoning/cold at ~39%/61%, matching its real,
  UNEVEN 2d8-vs-4d6 SRD ratio — the first uneven split modeled here.
  `storm-of-vengeance` was deliberately NOT converted (its SRD mix is
  different types on different ROUNDS, not one hit — doesn't fit this
  system's shape).
- **`EquipmentProc`'s `onHitSaveOrDamage` variant gains the same optional
  `damageType?`/`damageTypes?`/`magical?` fields**, wired in
  `BattleScene.applyEquipmentProc` — opt-in, so Flame Tongue/Frost Brand's
  existing bonus damage is unchanged (still bypasses resistance), but a
  future dual-typed magic item now has a real mechanical hook.
- Tests: 1241 → **1248** (+7), typecheck and the production build both
  clean. Pure data/systems plus call-site plumbing — no new UI, nothing
  needing a browser pass.

## Real SRD 5.2.1 Spell-Preparation Economy, Phase 3 (D-136) — DONE previous session

Phase 1 (D-134) built the data/pure-system/`Hero` layer; Phase 2 (D-135)
built the Character Creation starting pick. This session builds Phase 3,
the last piece: an in-battle "Prepare Spells" swap screen offered on a Long
Rest (Wizard/Cleric/Druid's full relist; Wizard's own cantrip swap), and a
level-up spell-swap step (Sorcerer/Bard/Warlock's replace-one prepared
spell; every cantrip-having class but Wizard's replace-one cantrip swap).
Before this, a hero's prepared/known list only ever GREW automatically
after character creation. None of the three phases is yet confirmed by
Kevin in a browser — see KI-090.

- **`SpellPreparationSystem` gains three new pure functions**:
  `spellSwapStepsForClass(classId, level, trigger)` — the in-battle
  analogue of Phase 2's `spellPickStepsForClass`, keyed by a live
  `"longRest"`/`"levelUp"` trigger; `preparedSwapIsFullRelist(classId)` —
  true for Wizard/Cleric/Druid (a toggle-many screen), false for a
  "replace exactly one" class (a drop-then-learn screen — cantrips always
  use this path, matching the real SRD rule that cantrips never fully
  relist); `maxCastableSpellLevel(classId, level)` — Phase 2's display
  filter, promoted so the in-battle screens can filter against a hero's
  CURRENT level.
- **`BattleScene` gains a fifth queue-and-pop overlay** (`spellPrepQueue`),
  reusing the same `renderAsiPrompt`/`asiOverlay` rendering four other
  queues already share. Wired at both triggers: `chooseRest`'s Long-Rest
  branch defers `proceed` past it for any eligible living hero;
  `applyClassLevelUps`/`afterWaveCleared` gain a fourth parallel check and
  one more link in the level-up overlay chain.
- **Deliberately, permanently out of scope** (see D-136's own reasoning):
  no `LevelUpPlanSystem.futureChoiceSteps` integration — a recurring
  every-level/every-rest opportunity has no plannable slot the way a
  one-time ASI/subclass/spell-mastery pick does; no Wizard spellbook
  growth at Long Rest (only what's prepared FROM it changes).
- Tests: 1228 → **1241** (+13), typecheck and the production build (117
  modules, unchanged) both clean.

## Real SRD 5.2.1 Spell-Preparation Economy, Phase 2 (D-135) — DONE previous session

Phase 1 (D-134) built the data/pure-system/`Hero` layer but left every
caster's starting spell selection auto-picked. That session built Phase 2:
a real Character Creation "Spells" picker, reusing D-133's wizard-overlay
machinery.

- **A new "Spells" row** in Character Creation, per caster hero: opens a
  full-screen toggle-multiple-then-confirm wizard — a Wizard sees Spellbook
  → Known Cantrips → Prepared Spells (drawn from its own just-picked
  spellbook); every other real caster sees Cantrips → Prepared Spells.
  Fighter/Rogue/Barbarian/Monk and Paladin/Ranger (the latter despite a real
  spell-slot economy — see below) show a disabled "Spells: N/A."
- **Filtered to what's actually castable at Starting Level** — a level-1
  Wizard sees only its ~20 first-level-or-lower spells, not all 107 eligible
  leveled spells across all 9 spell levels; each screen starts pre-checked
  with a valid default (the same math `Hero.growSpellSelections()` uses),
  freely toggleable before confirming.
- **`SpellPreparationSystem.spellPickStepsForClass`** (new, pure, tested):
  the step sequence per class — correctly gives Paladin/Ranger ZERO steps
  despite a nonzero prepared-count table, since their eligible spell pool is
  empty (Divine Smite/Hunter's Mark live outside the spell list).
  **`Hero.chooseSpellbook`** (new): a wholesale-replace mutator for the
  starting spellbook pick, distinct from the existing additive
  `learnSpellbookSpells`.
  **`CharacterBuild`/`HeroDefinition`** gain three optional fields
  (`preparedSpellIds?`/`knownCantripIds?`/`spellbookIds?`), applied by
  `BattleScene.buildHeroes` as a wholesale override once a hero's Starting-
  Level fast-forward finishes.
- Tests: 1221 → **1228** (+7), typecheck and the production build (117
  modules, unchanged) both clean. Not yet confirmed by Kevin in a browser —
  unlike Phase 1, this phase touches real UI/gameplay surfaces, so there's
  genuinely something new to click on. See KI-090.

## Real SRD 5.2.1 Spell-Preparation Economy, Phase 1 (D-134) — DONE previous session

Kevin asked whether the game modeled 5e's real spells-known/prepared
rules — it didn't, an explicit prior simplification (D-092/D-106). Verified
against the real SRD 5.2.1 text (not memory, per this project's D-109
lesson): every class "prepares" now, differing only in swap cadence — a
three-tier model (full relist every Long Rest / replace-one every Long
Rest / replace-one on level-up), not the classic 2014 known-vs-prepared
split. **This is Phase 1 only** — data + the pure system + `Hero` wiring,
no Character Creation/in-battle UI yet (see KI-090). See **D-134** in
`DECISIONS.md` for the complete method.

- **Two real, pre-existing 2014-assumption bugs found and fixed**:
  Paladin/Ranger's spellcasting (and spell slots) now correctly start at
  level 1, not 2; Sorcerer/Bard/Druid/Warlock get their own real SRD 5.2.1
  cantrips-known tables instead of wrongly sharing Wizard/Cleric's.
- **`systems/SpellPreparationSystem.ts`** (new, pure): every verified
  per-class prepared-spell-count table, the three-tier swap-cadence model,
  a Wizard's spellbook growth (6 spells at level 1, +2 per level), and
  validation/default-fill helpers for a future picker UI.
- **`Hero`'s casting model changed**: `knownSpellAbilityIds()` (what the
  in-battle spellbook overlay offers) now returns a bounded, auto-populated
  prepared-spell/known-cantrip list instead of the hero's ENTIRE class
  spell list — the spellbook overlay itself needed no changes, since it
  already read this method.
- Tests: 1186 → **1221** (+35), typecheck and the production build (117
  modules, up from 116) both clean.
- **Not yet built (Phase 2/3)**: a Character Creation UI for a hero's real
  starting spell pick; an in-battle "Prepare Spells"/spell-swap UI — until
  these land, every caster's selection is auto-picked, not player-chosen.
  See KI-090.

## Level-by-Level Character Creation Planner (D-133) — DONE previous session

KI-085's largest remaining item, held since D-128 for a design discussion —
this session ran that discussion, then built it. See **D-133** in
`DECISIONS.md` for the complete method.

- **`systems/LevelUpPlanSystem.ts`** (new, pure): the one place a hero's
  future ASI-vs-feat, subclass, and Wizard/Warlock spell-mastery-family
  choices resolve, whether pre-battle (fast-forward) or in a real in-battle
  level-up. A plan's choice applies if present and still valid; anything
  unplanned falls back to exactly D-129's original defaults — a hero with
  no plan is completely unaffected.
- **A new "Plan Levels" row in Character Creation**, per hero: opens a
  full-screen wizard — pick a mode (Auto-follow a blueprint / Prompted each
  level / Always choose fresh), then walk every future choice point for
  that class in order, including full drill-down into a feat's own
  sub-choice (Magic Initiate's spell list, Grappler/an Epic Boon's ability
  pick). Real eligible feats/spells at each step come from a scratch
  simulated hero, not a guess.
- **In battle**: an "Auto" hero's real level-up choices resolve silently,
  with no popup at all. A "Prompted" hero still gets the usual popup, now
  with a gold-outlined, "★ "-prefixed option showing the planned choice —
  still one click to pick something else instead.
- Tests: 1168 → **1188** (+20), typecheck and the production build (116
  modules, up from 115) both clean. Not yet confirmed by Kevin in a
  browser — see KI-089.

## AC/Damage Visibility in the Battle HUD (D-132) — DONE previous session

Kevin confirmed the "Tide map" build report was his own mistake (didn't
realize a hero must be within build range of a tile) — closed, no code
change. Then picked up KI-085's confirmed AC/damage-visibility gap. See
**D-132** in `DECISIONS.md` for the complete method.

- **Selected-hero AC** on the always-on status line — only for whichever
  hero is currently the input focus, so the other heroes' lines (and the
  line's overall length) are unaffected, avoiding the wrap-width regression
  D-126/KI-083 already fixed once.
- **`CombatSystem.hitChance`** (new, pure): an analytic hit-probability, no
  dice rolled — verified against real `RandomService` rolls with three
  20,000-trial Monte Carlo tests.
- **A hover tooltip** (mouse AND keyboard cursor, sharing the same
  `updateHoverAt` hook): any hero or enemy tile shows `HP {n}/{max} · AC
  {n}`; while a hero is selected, hovering a valid attack target also shows
  a BG3-style `{n}% to hit`. A still-hidden stealth/Mimic enemy shows no
  tooltip at all, matching its already-hidden token/name.
- Tests: 1162 → **1168** (+6), typecheck and production build (115 modules,
  unchanged) both clean. Not yet confirmed by Kevin in a browser — see
  KI-088.

## Full Damage-Type Mechanical Engine (D-131) — DONE this session

Kevin's explicit ask, confirmed directly: damage types needed to be "both
cosmetic AND mechanical... the full mechanical engine/rules," with a full
enemy-roster pass (not a curated subset). See **D-131** in `DECISIONS.md`
for the complete method.

- **Full SRD damage-type taxonomy**: `DamageType` widened from 3 physical
  types to all 13 (acid, bludgeoning, cold, fire, force, lightning,
  necrotic, piercing, poison, psychic, radiant, slashing, thunder).
- **47 of ~198 castable spells tagged with a real SRD damage type**
  (`AbilityDefinition.damageType`) — every genuine damage-dealing spell got
  one; every control/debuff/buff/heal/summon/terrain/teleport spell whose
  `damage` is this project's own stand-in for a real spell with no damage
  at all correctly got none.
- **`damageVulnerabilities`/`damageImmunities` added to `EnemyDefinition`**
  alongside the existing `damageResistances` — 24 of the roster's ~63
  enemies tagged based on their own name/lore (fire-immune bosses,
  poison-and-psychic-immune constructs, undead-patterned radiant
  vulnerability, acid-immune oozes, and more).
- **`CombatSystem.applyResistance` rewritten** for the full real 5e rule:
  elemental types are never affected by "magical" (only the three physical
  types are, D-127's original rule, unchanged); vulnerability is never
  bypassed by "magical," for any type; a resistance+vulnerability match on
  the same type cancels out to full damage per 5e RAW.
- **`SavingThrowSystem.applySaveOrDamage` now also respects all of this** —
  previously had no damage-type hook at all, so a save-based spell
  (Fireball, Sacred Flame, Thunderwave, etc.) never checked resistance.
- **`VisualFxSystem`'s cast-flourish/death-fade colors now use real data
  first**, falling back to the old keyword guess only when a spell has no
  real damage type — resolves KI-078.
- Tests: 1149 → **1162** (+13), typecheck and production build (115
  modules, unchanged) both clean. Not yet confirmed by Kevin in a browser —
  see KI-087.

## Gear-Purchase UX Clarity, Level-Up Popup, Live Game Speed, Two-Tier Battle Log (D-130) — DONE this session

Kevin reported gear purchase, once found, was "very unintuitive," and asked
to keep working down KI-085's list. See **D-130** in `DECISIONS.md` for the
complete method.

- **Gear-purchase UX clarified, no bug found**: the buy flow was always
  click-item-then-click-hero — never described as a purchase anywhere on
  screen. The equip-mode status hint and proximity-lock message now say so
  explicitly, naming the exact gold cost. Kevin declined building a new
  purchase-only stash when offered the choice.
- **"Tide map" build-restriction report investigated, no bug found**: traced
  every layer of The Drowning Vale's tile-buildability logic — all correct.
  Most likely explanation is the ordinary build-proximity gate, not a
  tide-specific defect; needs a specific repro to go further.
- **A level-up popup**: a hero whose level-up grants no other choice now gets
  a "reaches level N!" confirmation with a Continue button, closing KI-079's
  reported gap.
- **Game Speed, renamed and made live**: the existing animation-speed
  setting is now labeled "Game Speed" and can be cycled mid-battle ("S" key),
  not just from the Main Menu before a battle starts; two previously-fixed
  pacing pauses between phases now scale with it too.
- **A two-tier battle log**: a new "Technical Log" overlay ("L" key) shows
  the raw dice (d20, bonus, AC, advantage, outcome) behind every attack/save
  roll, kept separate from the existing short plain-English combat log.
- **Deliberately not started**: a debug/test mode, a level-by-level Character
  Creation planner, and spell damage types — held for a design discussion
  with Kevin, per this project's standing practice for a system that size.
- Tests: 1148 → **1149** (+1), typecheck and production build (115 modules,
  unchanged) both clean. Not yet confirmed by Kevin in a browser.

## Free Play/New Game Starting Level, Default 1-Human-3-AI Party (D-129) — DONE this session

Of the large feature-request list from Kevin's playtest report (KI-085), he
picked this as top priority. See **D-129** in `DECISIONS.md` for the
complete method.

- **A settable Starting Level** (1-20), individually per hero or all at once
  via a "Team Level" button, in the SAME `CharacterCreationScene` both "New
  Game" and Free Play already share. A hero built above level 1 now really
  enters battle at that level (HP/attack/spell-slots/subclass), by
  fast-forwarding through `Hero.levelUpClass()`'s real leveling math and
  auto-resolving any triggered choice with a fixed, sane default (ASI always
  raises the current-highest ability score; subclass/spell picks always
  take the first option) — no popup, since there's no overlay machinery at
  party-setup time.
- **A fresh party now defaults to Hero 1 = Human, Heroes 2-4 = AI**
  (previously all four defaulted to Human) — Kevin's explicit request.
- Gear-purchase investigation continued: Kevin confirmed he was on the
  classic map (no shop tile, ruling out D-071's proximity gate); a deeper
  second investigation still found no bug candidate anywhere in the path.
  High confidence nothing is broken in code — needs a more specific repro
  from Kevin before this can move further (see KI-085).
- Tests: 1147 → **1148**, typecheck and production build (115 modules,
  unchanged) both clean.

## Three Playtest Text-Overflow Fixes; Gear-Purchase and AC/Damage-Visibility Findings Reported (D-128) — DONE this session

Kevin's next in-browser playtest pass produced a fresh report mixing new
bugs, direct questions, and several large feature requests. See **D-128** in
`DECISIONS.md` and **KI-085** in `KNOWN_ISSUES.md` for the complete
breakdown.

- **Fixed**: Compendium/Bestiary/Main Menu button labels overflowing a
  crowded row (`uiTheme.ts`'s `createOrnateButton`); Free Play's Map/Finale
  Boss tile labels overflowing tile height on a long-wrapped name
  (`FreePlayScene.ts`'s `buildOptionRow`); Character Creation's
  subclass-picker label running over its own button (`CharacterCreationScene.ts`).
  All three use the same measure-then-shrink-font approach `BattleScene
  .fitBannerToWidth` (KI-033) already established.
- **Investigated, not fixed**: "cannot purchase gear" traces to a likely
  intentional proximity gate (D-071), not a defect — needs Kevin to confirm
  which map/mode; "how do I see AC/damage" confirmed as a real, honest
  display gap (the numbers are computed live, just never rendered anywhere
  in battle) — not added yet, pending a decision on where it fits in the
  already-crowded status line.
- **Not started**: a large list of new feature requests (debug/test mode,
  Free Play party setup with per-hero starting level, a level-by-level
  Character Creation planner, a two-tier battle log, spell damage types, a
  level-up popup, game-speed options) — each independently large, several
  needing their own scope-fork discussion before building, per this
  project's established practice for big new systems.
- Tests: 1147/1147 unchanged, typecheck and production build (115 modules)
  both clean. No new source/test files — all three fixes are Phaser-only
  presentation code.

## Four Foundational Systems: Damage Resistance, Stealth Sense, Charge Items, Ability-Score Items (D-127) — DONE this session

While Kevin ran his first in-browser playtest pass in several sessions, this
session closed four gaps `KNOWN_ISSUES.md` had documented as genuinely
missing architecture (not stale wiring): damage-type resistance, per-observer
stealth detection, charge-based active items, and ability-score-setting
items. Built in order of increasing risk, each verified independently
(`npm run typecheck`/`npm test`/`npm run build`) before moving to the next.
See **D-127** in `DECISIONS.md` for the complete method and every deliberate
scope boundary.

- **Nonmagical damage-type resistance**: `data/weapons.ts` already carried a
  per-weapon damage type, just unused for resistance — now consumed by
  `CombatSystem.applyAttack` to halve a nonmagical hit against a resistant
  target. Rat Swarm/Locust Swarm gain the real SRD Swarm resistance; Boon of
  Irresistible Offense's "ignores Resistance" half is finally real.
- **Rogue's Blindsense (14+) / Ranger's Feral Senses (18+)**: real for the
  first time — a per-observer targeting exception lets that hero
  specifically target a still-hidden stealth enemy within 2 tiles, without
  revealing it to anyone else.
- **Charge-based items**: Wand of Magic Missile, Wand of Web, Staff of
  Healing — grant their spell to any hero (even a non-caster), spent as item
  charges instead of a spell slot, fully recharging on a Long Rest.
- **Ability-score-setting items**: Gauntlets of Ogre Power, Headband of
  Intellect, Amulet of Health — set an ability score to 19 while equipped,
  live-recomputing every derived combat number (attack, HP, AC, spell save
  DC, saves). Also fixed a related pre-existing gap: a DEX Ability Score
  Improvement previously never raised AC without real armor equipped.
- Tests: 1147/1147 passing (up from 1130), typecheck and production build
  (115 modules) both clean. No browser available in this environment — see
  **KI-084** for the full in-browser verification checklist.

## A Full UI-Layout Audit and Fix: Clashing/Off-Canvas Boxes Across the Game (D-126) — DONE previous session

Kevin reported real, current "clashing text boxes" and "boxes going over the
edge of the screen" while gathering art assets, and asked for a full audit
and fix, not a spot-fix. A general-purpose agent read every scene file in
full and computed bounding-box math against the 1280x1080 canvas and every
real map/data-table's actual size; every finding was independently
re-verified against the source before fixing. See **D-126** in
`DECISIONS.md` for the complete method and everything investigated and
deliberately left alone.

- **`CompendiumScene`'s category tabs (10) and class selector (12)** rendered
  more than half off-canvas on both edges, on the screen's own default tab —
  a deterministic bug present on every single visit. Fixed at the shared
  `centeredRowX` helper (`uiTheme.ts`): it now shrinks item width to fit a
  `maxWidth` instead of letting a row grow past the canvas unbounded.
- **`MapBuilderScene`'s terrain palette (8 swatches)** had the identical
  off-canvas bug on its own default tab — now routed through the same fixed
  `centeredRowX` helper instead of its own unbounded math.
- **`FreePlayScene`'s map (7) and boss (13) picker labels** overlapped their
  neighbors — the button width already shrank to fit the option count, but
  the label text had no word-wrap and stayed at a fixed font size. Fixed
  with wrap + a width-scaled font size.
- **The core Battle HUD's status line/combat log** — the single most-used
  screen in the game — could genuinely collide in ordinary play: the status
  line's word-wrap width was tied to the GRID's pixel width rather than the
  canvas's, so a full 4-hero party's status on Frostbound Hollow (the
  narrowest AND tallest built-in map) already wrapped past the reserved
  space with nothing more unusual than a hero simply selected. Fixed at the
  root (wrap width now tracks the canvas, not the grid) plus a small
  headroom bump, re-verified against the item-grid/Done-button math below it
  so nothing now runs off the BOTTOM instead. The combat log also gained
  word-wrap for the first time — it previously had none at all.
- **`BrowseSharedMapsScene`'s shared-map list** rendered one row per fetched
  map with no ceiling, growing into the fixed sections below it past ~6
  published maps — a real, growing failure mode given Kevin is actively
  building out map-sharing content. Fixed with a proper fixed-size local
  page (5 at a time) and its own Prev/Next controls.
- **Investigated and left alone, on purpose**: one theoretical
  `renderAsiPrompt` overlap unreachable below character level 19 (no run
  currently gets there); two momentary cosmetic VFX edge cases affecting no
  built-in map; a suspected status-badge-stacking overflow that turned out
  not to exist (one Text object per token, not stacked boxes); every other
  scene read and confirmed already sound.
- No test file changed — every fix is Phaser-only presentation code, the
  same standing "scene code isn't unit-tested" boundary as every other
  visual-only fix in this project. Typecheck, all 1130 tests, and the
  production build all pass unchanged (115 modules).
- **Not fixed this pass, and why**: `BattleScene`'s full HUD visual RESTYLE
  (carried forward from D-123) still hasn't happened — this session fixed
  concrete overlap/overflow bugs in the EXISTING layout, not a redesign of
  it. See KI-083 for the full in-browser verification checklist.

## Five More D-124-Deferred Slices: Reckless Attack, Preserve Life, Skill Checks + Hero Stealth, Spell-Mastery Picker (D-125) — DONE previous session

Kevin asked two spell-model clarifying questions (both answered from
existing code — no class in this game models learn→known→prepared as
distinct states; every full caster simply knows its whole class spell list,
gated only by slots), then asked to tackle five items straight off D-124's
own deferred list. See **D-125** in `DECISIONS.md` for the full method.

- **Barbarian's Reckless Attack** (level 2+): a real per-turn toggle, no
  action cost — Advantage on this hero's own attacks in exchange for
  Advantage to every attack against it until its next turn.
- **Cleric's Channel Divinity: Preserve Life** (Life Domain, level 2+): a
  real AoE heal — up to 5 living allies healed at once, capped at half each
  one's own max HP, a limited number of uses recharging on a Short or Long
  Rest. D-124's own stated blocker ("healing only ever targets one ally")
  was stale — Phase 16's `areaAllies` mechanism already existed.
- **Skill proficiency + a real Stealth check**: built specifically as the
  consumer hero-side stealth needed (D-124 deferred skill checks for lack
  of exactly this).
- **Hero-side stealth**: Ranger's Vanish/Hide in Plain Sight, Rogue's
  Cunning Action: Hide/Thief's Supreme Sneak, Monk's Empty Body — a hidden
  hero can't be targeted by enemies until it attacks or casts. Rogue's
  Blindsense/Ranger's Feral Senses stay inert (the opposite direction —
  detecting an enemy's own hidden state — needs a separate model).
- **Wizard's Spell Mastery/Signature Spells, Warlock's Mystic Arcanum**: a
  new one-time spell-picker overlay slotted into the existing level-up
  choice queue (subclass → ASI → spell-pick → rest), picking from a hero's
  own known spells at the right spell level.
- **A real interaction only tests caught**: a Warlock's own Pact Magic
  slots fully refill on a Short Rest, which can mask Mystic Arcanum's own
  Long-Rest-only cadence if you check `canCastSpell` without accounting for
  it — a real, documented gotcha for the next session touching either.
- Tests: **1088 → 1130** (42 new, spanning a new `d125Features.test.ts`,
  a new `skillCheckSystem.test.ts`, a new D-125 block in `combat.test.ts`,
  and corrected pre-existing assertions in `subclasses.test.ts`/
  `characterSystem.test.ts`). Typecheck, all 1130 tests, and the production
  build all pass (115 modules, up from 114 — the new `SkillCheckSystem.ts`).
- **Not built this pass, and why**: no scene/UI file's LAYOUT was
  restyled — five new small HUD elements (buttons, badges, an overlay) were
  added following existing patterns exactly, so nothing here needs a "does
  it look right" pass, only a "does it fire correctly" one — see KI-082.

## A Batch of Inert Class Features Wired Real (D-124) — DONE previous session

Kevin asked to work through the "class features still listed as inert"
backlog. An audit of every `mechanicallyActive: false` feature found ~30-40
whose stated blocking reason had gone STALE in a later phase without looping
back — the saving-throw/Advantage-Disadvantage/rest-pool systems they were
waiting for already existed. Given a scope choice, Kevin picked "the stale
bucket plus 1-2 new small systems." See **D-124** in `DECISIONS.md` for the
full method and everything deliberately deferred.

- **Wired real, reusing existing systems**: Fighter's Indomitable (reroll a
  failed forced save, levels 9/13/17), Barbarian's Danger Sense (Advantage on
  forced saves, level 2+), Rogue's/Monk's Evasion (half damage on a failed
  forced save, level 7), Rogue's Elusive (denies enemy Advantage, level 18+),
  and The Fiend's Expanded Spell List (10 new castable Warlock spells).
- **Two new small systems**: a "frightened" status effect (reuses "blinded"'s
  exact shape) unlocking Path of the Berserker's Intimidating Presence, and a
  generalized reaction slot (previously only Uncanny Dodge's damage-halving)
  unlocking Path of the Berserker's Retaliation (a real counter-attack) and
  College of Lore's Cutting Words (weakens a landed blow against any ally).
- **Two real issues found only by writing tests before merging, not by the
  original plan**: a gating bug that would have leaked Oath of Devotion's
  spells into a Paladin's spellbook (Paladin has none), and a design
  correction — Life Domain's Domain Spells turned out to change nothing
  observable (every named spell was already in the base Cleric list), so it
  stayed `mechanicallyActive: false` with an honest, narrower reason.
- **Deliberately deferred**: Wizard's Spell Mastery/Signature Spells and
  Warlock's Mystic Arcanum (need a new spell-picker UI); the Cleric/Paladin
  Channel Divinity family (Preserve Life needs a real AoE-ally-heal mode); a
  hero-side stealth mirror of the enemy-side hidden/reveal pattern;
  Barbarian's Reckless Attack (needs a new per-turn toggle); skill
  proficiency + checks (this game has no skill-check moment anywhere for one
  to matter — building it now would be scaffolding with nothing to consume
  it).
- Tests: **1088**, up from 1039 (49 new, spanning a new `d124Features.test.ts`
  plus extensions to `combat.test.ts`/`savingThrowSystem.test.ts`/
  `statusEffects.test.ts`/`subclasses.test.ts`/`characterSystem.test.ts`).
  Typecheck, all 1088 tests, and the production build all pass (114 modules,
  unchanged). The three BattleScene-only hookups (Intimidating Presence/
  Retaliation/Cutting Words) are not unit-tested — the same standing Phaser
  limitation every other in-battle auto-apply mechanic already has.
- **Not built this pass, and why**: no scene/UI file was touched, so nothing
  new here needs a browser pass beyond seeing the new mechanics fire in a
  real battle — see KI-081 for the full checklist.

## A Fantasy/Parchment UI Theme for Main Menu, Compendium, Bestiary (D-123) — DONE previous session

Kevin said the game "is in a bad spot" visually and asked to "spruce it up
quite a bit," starting with the Main Menu and Compendium/Bestiary (the same
branding is explicitly planned to carry through the rest of the game in a
later session): a real fantasy/D&D-on-brand look, a reorganized, more
professional Main Menu layout, and real hover/click feedback on every
button. The same message reported two playtest findings (no spellbook found,
no level-up choice seen) — investigated in code this session; see D-123 in
`DECISIONS.md` and KI-079 in `KNOWN_ISSUES.md` for the full findings (no code
defect found; most likely explanations documented, Kevin's confirmation
needed either way).

- **`scenes/uiTheme.ts`** (new, shared, Phaser-dependent presentation
  module): two Google Fonts (Cinzel display, EB Garamond body — SIL OFL 1.1,
  see `CONTENT_SOURCES.md`), `createOrnateButton` (a carved-wood-and-bronze
  plaque button with real idle/hover/pressed/disabled/selected states and
  hover-lift/press-squish tweens — every button in this project previously
  had, at most, a flat fill-color swap on hover and NO click feedback at
  all), `drawScreenBackdrop` (a gradient/vignette/framed backdrop replacing
  every restyled scene's flat dark background), `drawParchmentPanel` (the
  same aged-parchment technique `dialogueBox.ts` already established,
  generalized to any rectangle), `spawnAmbientMotes`, `createSectionLabel`,
  `centeredRowX`. New themed `COLORS` entries in `config.ts`, kept separate
  from the existing battle-board palette.
- **`MainMenuScene.ts`** reorganized: one hero action ("New Game"), then
  three named button groups by purpose ("Continue Your Journey," "Know Your
  Foe," "Creator Tools") instead of one flat stack of ten identical-looking
  buttons plus six more scattered across the corners — plus a drawn
  tower-and-shield crest and drifting ember motes for atmosphere. Every
  `scene.start` target and keyboard shortcut is unchanged.
- **`CompendiumScene.ts`/`BestiaryScene.ts`** restyled onto the same theme —
  zero data/lookup-logic changes, every category/filter/page computation is
  identical to before.
- **A real pre-existing gap found and fixed in Bestiary**: the enemy roster
  grew to 94 entries over nine content phases with no pagination ever added
  — the old flat text block had been silently overflowing past the bottom
  of the canvas. Fixed with the same Prev/Next paging `CompendiumScene`
  already had, applied to a flattened, role-grouped list.
- Tests: unchanged at **1036** — pure presentation code, no new pure logic.
  Typecheck, all 1036 tests, and the production build all pass (114 modules,
  up from 113 — the new `uiTheme.ts`). `npm run dev` serves HTTP 200.
- **Not built this pass, and why**: `BattleScene`'s HUD and every other
  scene are unchanged — Kevin's own instruction scoped this session to Main
  Menu + Compendium/Bestiary only. No code fix for the spellbook/level-up
  reports, since no code defect was found in either mechanism — see D-123.

## Spell-Cast and Death Animations (D-122) — DONE previous session

Right after D-121's lunge, Kevin asked to build "a whole host of spell
casting animations and death animations," wanting every spell to feel
unique when cast, no two the same. With ~198 castable spells, three
scoping questions were answered toward the data-driven mechanism: a
shared shape+color library with per-ability hashed variation (not 198
bespoke implementations), wire ALL castable abilities this session (not a
first slice), and vary death animations by CAUSE. See **D-122** in
`DECISIONS.md` for the full method.

- **`systems/VisualFxSystem.ts`** (new, pure, tested, no Phaser import):
  the whole selection mechanism. Cast SHAPE is picked structurally from an
  ability's own real mechanical fields (11 shapes: bolt, homingOrb,
  fallingJudgment, novaBurst, ringPulse, gustCone, sparkleRise,
  radiantPulse, groundRune, conjureCircle, blink). Cast/death COLOR comes
  from a best-effort keyword match against the ability's name/description
  text, falling back to its real SRD `school`, then to a generic arcane
  default — a cosmetic guess, explicitly NOT verified SRD damage-typing
  (this game has no damage-type field on spells at all). Secondary
  variation (particle count/size/rotation/duration) comes from a
  deterministic hash of the ability's own id, not randomness — the same
  spell always looks the same way twice.
- **`Enemy.lastDeathCause?: DeathCause`** (8 values): a same-tick
  rendering hint tagged by whichever cast/status code dealt the killing
  blow, defaulting to "physical" for every ordinary weapon/trap/explosion
  kill that never sets it. Not persisted in save snapshots — meaningless
  outside the instant of a kill.
- **`BattleScene.playCastVisual()`**: 11 new small Phaser draw methods
  (Graphics/Arc/Rectangle + Tweens, the same technique the Cape of
  Billowing and D-121's lunge already use), wired into all 10 real spell/
  ability cast call sites in the scene — every way this game resolves a
  cast.
- **`BattleScene.playEnemyDeathVisual()`**: replaces the old instant token
  removal on a real kill with a squash-and-fade plus a cause-specific
  flourish, bigger/slower for miniboss/boss/legendary. An enemy reaching
  the exit (a breach, not a death) is unchanged.
- Tests: 1026 → **1036** (+10, new `tests/visualFxSystem.test.ts`).
  Typecheck, all 1036 tests, and the production build all pass (113
  modules, up from 112 — the new `VisualFxSystem.ts`). `npm run dev`
  serves HTTP 200.
- **Not built this pass, and why**: no per-spell hand-authored bespoke
  animation — the whole point of this session's scoping question was that
  198 of those isn't realistic; the data-driven library is the
  deliverable. No new verified damage-type field on spells — the keyword
  guess stays cosmetic-only, layered on existing text, not a new
  mechanical field. See **KI-078** for the full in-browser checklist.

## Basic-Attack Lunge (D-121) — DONE previous session

Kevin asked to start on "the tween animation things" D-120's handoff had
discussed (spellcasting/attack/movement animations via Phaser Tweens) but
deliberately left unbuilt, recommending picking ONE concrete animation to
prototype first rather than a speculative generic system. Offered a
choice — basic-attack lunge, spell-cast flash, or a death/defeat animation
— Kevin picked the basic-attack lunge. See **D-121** in `DECISIONS.md`.

- **`BattleScene.lungeToward(token, from, to)`** (new, private): a short
  relative-displacement `yoyo` tween — the attacker's token nudges 28% of
  a tile toward its target and springs back — layered on top of the
  existing hit-flash on the target tile. Uses `x: '+=N'`/`y: '+=N'`
  (relative, not absolute) so it works regardless of the token's current
  position. Respects the existing `scaledDuration`/reduced-motion setting
  exactly like every other tween in this scene.
- **Wired into both directions a basic attack already had a hit-flash
  for**: `tryBasicAttack` (hero → enemy) and `showEnemyAttack` (enemy →
  hero) — one call each, at the point where the attacker/target pair is
  already known.
- Tests: unchanged at **1026** — pure Phaser presentation code (a tween),
  no new pure logic to test, same standing limitation as `moveEnemyToken`/
  `flashTile`. Typecheck, all 1026 tests, and the production build all
  pass (112 modules, unchanged — no new source files). `npm run dev`
  serves HTTP 200.
- **Not built this pass, and why**: no lunge on Extra Attack's extra
  swings, the off-hand attack, Cleave's second target, or any spell/
  ability attack — Kevin picked ONE animation to prototype; generalizing
  to every attack call site is a natural follow-up once this one is
  confirmed in-browser (see **KI-077**), not before. No spell-cast flash
  or death/defeat animation — the other two options offered, not chosen
  this pass.

## Dialogue Skip Controls (D-120) — DONE previous session

Right after D-119, Kevin asked for a "skip the whole talking section"
control (only when no player decision is pending) and a "skip past the
current line" control (for fast readers), plus flagged that future
voice-over audio would need to be interruptible by both. See **D-120** in
`DECISIONS.md` for the full method.

- **`DialogueLine.hasDecision?: boolean`**: a forward-compatible gating
  flag — no choice-rendering UI exists yet, nothing sets this today.
  `canSkipSequence(lines)` is false the instant any line anywhere in the
  sequence sets it (checked once, against the whole sequence, not just
  remaining lines).
- **Advancing past a line now works several ways at once**: the existing
  Continue/Close button, clicking anywhere on the panel/scrim, or pressing
  Space/Enter — all funneling through the same `advance()` method.
- **A dedicated "Skip ▶▶" button** (top-left of the panel) jumps straight
  to the end of the whole sequence — shown only when `canSkipSequence` is
  true.
- **`interruptCurrentLinePlayback()`**: a deliberately empty method every
  advance/skip path calls first. No-op today (nothing plays out over time
  yet); this is the one seam a future text-reveal animation or
  voice-over-stop call will hook into.
- **A real architecture fix found while building this**: `DialogueLine`/
  `canSkipSequence` were first written inside `scenes/dialogueBox.ts`,
  which broke unit testing outright (`ReferenceError: window is not
  defined` — that file's top-level Phaser import runs Phaser's own
  module-init code). Moved to a new, Phaser-free `systems/DialogueSystem.ts`,
  correctly following this project's "pure rules live in `systems/`, no
  Phaser dependency" architecture rule; `dialogueBox.ts` now imports from
  it and re-exports both for existing callers.
- **A second Compendium preview button** ("Show Sample (with a decision)")
  demonstrates the Skip button correctly disappearing when a line requires
  a decision.
- Tests: 1021 → **1026** (+5, new `tests/dialogueSystem.test.ts`).
  Typecheck, all 1026 tests, and the production build all pass at **112
  modules** (up from 111). `npm run dev` serves HTTP 200.
- **Not built this pass, and why**: no actual text-reveal animation or
  voice-over audio — Kevin flagged these as a later addition, not asked
  for now; this session builds the interrupt seam they'll need, not the
  features themselves. No keyboard shortcut for "skip the whole
  sequence" — button-only, on purpose (an accidental keypress skipping an
  entire story beat is worse than a slightly less convenient click).

## Stylized Parchment Dialogue Box, NPC-Only Portraits (D-119) — DONE previous session

Right after D-118, Kevin asked for the dialogue-box presentation itself:
stylized text on a parchment background, plus a 2D front-facing portrait of
whichever character is speaking — resolved to NPC-only (the player's own PC
gets no portrait). See **D-119** in `DECISIONS.md` for the full method.

- **`scenes/dialogueBox.ts`** (new): a reusable `DialogueBoxController`/
  `showDialogue` renderer any scene can call. An NPC line (`speakerName`
  set) shows a framed portrait + name plate — a real image once one loads
  for `portraitKey`, else a drawn placeholder silhouette; a PC/narration
  line (no `speakerName`) is full-width text with no portrait at all. The
  parchment panel is drawn with Phaser `Graphics` (base fill + aged
  mottling + a frame border) — no art asset needed for the panel itself to
  look finished, same treatment Phase 22's Cape of Billowing got.
- **`data/portraitManifest.ts`** (new): a currently-EMPTY
  `PORTRAIT_MANIFEST`, separate from the existing token-sprite
  `spriteManifest.ts` (different image category/aspect ratio). Same
  "declared, not yet consumed" treatment as D-117's `assetKey`/
  `SPRITE_MANIFEST` — drop a real portrait file in later, no rendering code
  changes.
- **Five new `config.ts` `COLORS` entries** for the parchment/placeholder
  look.
- **A "Dialogue" preview tab in `CompendiumScene`**: a "Show Sample
  Dialogue" button demonstrating both speaker styles (narrator/PC vs. NPC
  with a placeholder-silhouette fallback) in-browser, since no real
  chapter/story content exists yet to trigger this naturally — resolves
  this session's own "how do I see this before I have images" fork.
- Tests: unchanged at **1021** — pure Phaser presentation code, no new pure
  logic to test. Typecheck, all 1021 tests, and the production build all
  pass at **111 modules** (up from 109 — this session IS wired into a real
  scene, `CompendiumScene`, unlike D-118's still-unwired scaffolding). `npm
  run dev` serves HTTP 200.
- **Not built this pass, and why**: no `BattleScene`/chapter-transition
  wiring (`ChapterDefinition.introText`/`outroText` from D-118 still aren't
  read by anything — no real chapter content exists yet to trigger this
  from); no text-typewriter animation or sound; no portrait art itself —
  that's Kevin's own follow-up once he has images to supply.

## Campaign Engine Scaffolding: Chapters, World-Flags, Companion Roster (D-118) — DONE previous session

The session after D-117 produced `CAMPAIGN_STORY_DESIGN.md` — a design-only
doc (no D-NNN of its own) for a six-region campaign story ("The
Unremembering"), each region a 4-chapter 1-20 arc, a 6-companion catalogue
with recruit/bench/lose branching, and a world-flag-driven capstone ending.
Its own §7 flagged the real engine gap: `CampaignDefinition` is flat,
`CampaignProgressSystem` tracks only a completed/not-completed boolean, and
no companion-catalogue/world-flag code exists anywhere. Offered a choice
between writing that story's companion dialogue, building this engine
scaffolding, or designing its bonus-choice pool numbers, Kevin chose the
engine scaffolding. See **D-118** in `DECISIONS.md` for the full method.

- **`ChapterDefinition` + chapter helpers** (`data/campaigns.ts`):
  `CampaignDefinition` gains an optional `chapters?: ChapterDefinition[]` —
  untouched by both existing campaigns, which stay flat with zero behavior
  change. `isChapteredCampaign`/`totalChapters`/`getChapter` give every
  caller ONE access pattern regardless of whether a campaign is chaptered —
  `getChapter(def, 0)` on a flat campaign synthesizes a single chapter from
  its existing top-level fields.
- **Per-chapter completion tracking** (`systems/CampaignProgressSystem.ts`):
  a new `completedChapters` map (highest chapter index completed per
  campaign id), tracked independently from the existing whole-campaign
  `completedIds` boolean. Backward compatible — a progress blob saved before
  this session loads cleanly with no chapter progress recorded.
- **`systems/WorldFlagSystem.ts`** (new, pure): a generic, persisted
  per-choice flag store (`boolean | string | number`, by flag id) for story
  branches a later region or the capstone needs to read — e.g. which
  miniboss was spared, or a companion's branch outcome. No story content
  writes to it yet.
- **`data/companions.ts`** (new) + **`systems/CompanionRosterSystem.ts`**
  (new, pure): `CompanionDefinition` wraps a full `CharacterBuild` (the same
  shape a player-built hero uses) with story metadata; `COMPANIONS` is a
  deliberately EMPTY registry — the six named companions
  `CAMPAIGN_STORY_DESIGN.md` describes are a separate, not-yet-done writing
  pass, same "declared, not yet consumed" treatment `data/spriteManifest.ts`
  got in D-117. `CompanionRosterSystem` models active (one of 3 bench
  slots)/benched/lost roster states with recruit/bench/activate/lose
  mutators, plus its own load/save persistence.
- **Two new `config.ts` storage keys**: `WORLD_FLAG_STORAGE_KEY`,
  `COMPANION_ROSTER_STORAGE_KEY` — declared, not yet written by any scene.
- Tests: 976 → **1021** (+45). Typecheck, all 1021 tests, and the production
  build all pass. Module count unchanged at 109 — none of this session's
  new/extended systems are wired into `main.ts`'s dependency graph yet,
  exactly as intended for engine-only scaffolding. `npm run dev` serves HTTP
  200.
- **Not built this pass, and why**: no scene/UI wiring at all (no
  recruitment screen, no chapter-boundary text panel, no bonus-choice-pool
  UI, no `SaveSystem`/`BattleScene` integration for either new system) —
  none of it has real content to display or a read/write site to wire into
  yet (no companions, no authored chapters for any region, no bonus pools).
  No migration of the two existing flat campaigns into the region structure
  — that's a future content-authoring decision, not an engine concern.
  Mirrors D-101 (Phase 12.1)'s precedent exactly: build the capability
  headless and fully tested, defer integration until real content/UI needs
  it.

## Playtest Fixes, Classic Roster Removal, Hero-Sprite Plumbing (D-117) — DONE previous session

Kevin's first in-browser pass of the deployed build (nine unplayed content
phases deep) found the canvas looked off-center and buttons/text overlapped
"all over the place." Also asked to remove the original classic fixed
4-hero roster (Ash/Wren/Bram/Mira) and its flat Vigor/Might level-up choice
now that D&D-style character creation/real class leveling has fully
superseded them, and asked about a full visual rework — scoped down, since
this environment has no image-generation tool and no art exists yet, to
just the loading/rendering PLUMBING, with real art explicitly deferred. See
**D-117** in `DECISIONS.md` for the full method.

- **Two concrete, traceable layout bugs found and fixed, not a diffuse
  rewrite**: the canvas was being centered TWICE (Phaser's own
  `scale.autoCenter` fighting `index.html`'s flex centering — `main.ts` now
  disables Phaser's, letting the CSS do it alone), and **KI-033** (the Gear
  button could overlap the "Wave N / M · Phase" banner) is fixed with a
  measured-width approach — the banner shrinks its own font, using its real
  Phaser-measured width, to whatever provably fits, rather than another
  guessed padding number. Other HUD rows and `CharacterCreationScene`'s
  column stacking were audited by hand against their real current
  coordinates; no other confirmed overlap found.
- **The classic fixed 4-hero roster and its Vigor/Might choice are gone.**
  Every hero is now built via `CharacterBuildSystem.heroDefinitionFromBuild`
  — `data/heroes.ts` no longer exports `HERO_DEFINITIONS`/`HERO_COLORS`/
  `getHeroDefinition`. `MainMenuScene`'s old bare-`scene.start("BattleScene")`
  START button is gone; "Create Party" is promoted into its old slot and
  renamed "New Game," the only way into a battle now.
  `BattleScene.init()`'s `heroDefinitions` is required, not optional, and
  throws immediately if missing rather than silently falling back.
  `ProgressionSystem` keeps its wave-clear CADENCE tracking (still drives
  real per-class leveling) but loses the Vigor/Might CHOICE entirely.
- **Co-op's hidden dependency on the classic roster, found while removing
  it**: `CoopLobbyScene` had no hero-picker UI and silently relied on
  `BattleScene`'s classic-roster fallback for its default party. Fixed with
  a new `CharacterBuildSystem.defaultPartyBuilds(size)` — a small
  deterministic starter party (Fighter/Wizard/Rogue/Cleric) Co-op now uses
  explicitly.
- **Hero-sprite loading plumbing, no art yet**: `HeroDefinition` gains an
  `assetKey` (set by `heroDefinitionFromBuild` from the hero's class); a new,
  currently-EMPTY `data/spriteManifest.ts` (`SPRITE_MANIFEST`);
  `BattleScene.preload()` (this scene's first); and `createTokenSprite`,
  which swaps a hero token's circle for a real sprite once one is loaded for
  its `assetKey` — wired into hero tokens only, as the single demonstrated
  instance of a pattern enemy/structure tokens (which already carry an
  unused `assetKey`) can follow once real art actually exists. Nothing
  visibly changes today — the manifest is empty, so every fallback branch is
  the only one ever taken.
- Tests: 983 → **976** (a classic-roster-only test file deleted, several
  others' fixtures untangled from `data/heroes.ts`). Typecheck, all tests,
  and the production build all pass. `npm run dev` serves HTTP 200.
- **What's genuinely unverifiable this pass, and why**: none of this
  session's visual work could be confirmed on-screen — no browser is
  available in this environment. Both layout fixes are grounded in traceable
  root causes, not guesses, but still need Kevin's own look.
- **Not built this pass, and why**: enemy/structure token sprite rendering
  (has real per-token mutation logic — stealth dimming, aura rings, boss-size
  bump — worth reconciling with a sprite swap once real art exists to test
  against, not speculatively); any UI-chrome/board/item/spell sprite
  rendering (lower-priority per `ASSET_PLAN.md`, not asked for by name); any
  rewrite of `CharacterCreationScene`'s fragile-but-not-currently-broken
  manual row-stacking.

## Phase 25 — Cheap/Expensive Structure Tiers, Opportunistic Wall-Bash AI, Trap-Disarming Saboteurs (D-116) — DONE previous session

Kevin asked for three things in one message: more cheap/expensive versions
of traps and buildings/walls; a real siege AI where any enemy can choose to
attack a structure based on "personality" and "opportunity (no other
option)," when doing so would improve its odds; and enemies/skills that
detect and disarm/destroy traps. See **D-116** in `DECISIONS.md` for the
full method.

- **Ten new structures** (`data/structures.ts`), every one bracketing an
  existing item's cost/effect: **Wicket Gate**/**Portcullis** give the gate
  curve its own cheap/expensive tier (mirroring Palisade/Bulwark on walls);
  **Snare Wire**/**Mangler Trap** bracket the ground-trap-damage curve;
  **Net Snare**/**Storm Lance** give the flying-trap curve its first
  brackets (previously just Sky Snare alone — also closes the long-deferred
  "no anti-air trap tier" item); **Sparring Post**/**War Dais** bracket
  Melee Platform; **Low Perch**/**Sky Bastion** bracket Ranged Perch (Low
  Perch trades the range bonus for a smaller damage bonus instead of being a
  strictly weaker copy; Sky Bastion grants both bonus types at once).
  `SHOP_ORDER` grows from 12 to 22.
- **Shop grid pagination** (`BattleScene.ts`): the shop catalogue outgrew a
  single unpaged page (22 items at 4 columns = 6 rows, which the layout math
  showed would overflow the canvas). Generalized the EXISTING Gear-grid
  pagination (Phase 17/D-108) to cover both grids — renamed
  `GEAR_GRID_PAGE_SIZE`→`ITEM_GRID_PAGE_SIZE`, shared one nav control
  between Shop/Gear (never shown at once) — rather than building a second,
  duplicate paging system. Both grids are now permanently capped at 4 rows
  regardless of catalogue size.
- **Opportunistic wall bash** (`WaveSystem.tickEnemyPhase`): any ordinary
  melee enemy (`attackRangeTiles <= 1`, not a dedicated siege enemy, not a
  pure runner) now bashes a destructible wall within its own attack range —
  at its own plain `attackDamage`, no siege multiplier — the moment no hero
  is reachable this phase. A dedicated siege enemy's existing unconditional
  priority over a wall is completely unchanged. `StructureAttackEvent` gains
  an `opportunistic` flag for a distinct combat-log line.
- **Trap disarm — the Saboteur archetype** (`data/enemies.ts`,
  `WaveSystem`, `BuildSystem.disarmTrap`): a new `trapSense?: { rangeTiles }`
  field. An enemy carrying it detects a placed trap within reach and
  disarms/destroys it outright — at the SAME unconditional priority tier
  siege already uses for walls, so it wins even over a reachable hero — since
  a trap has no HP to whittle down (D-039: it always hits, in full, every
  time). Two new roster entries: **Saboteur** (fast, fragile, senses 1 tile)
  and **Warren Stalker** (tougher, senses 2 tiles).
- Tests: 960 → **983** (+23). Typecheck, all tests, and the production
  build all pass (109 modules, unchanged — no new source files besides one
  new test file). `npm run dev` serves HTTP 200.
- **What's genuinely untested by the automated suite, and why**: the shop
  grid's page-nav buttons are Phaser UI, verified only by hand-checked
  bounding-box arithmetic (Phaser scenes have no unit tests here) — same
  standing limitation as every other UI-layout change in this project.
- **Not built this pass, and why**: no additional Watchtower-style
  `"any"`-audience platform tier (Watchtower already fills that niche
  alone; the ask was specifically for brackets around the two EXISTING
  specialist platforms). No trap HP/damage-scaling (traps stay
  indestructible/un-upgradeable — Kevin explicitly chose cost tiers over an
  upgrade system for this reason at the start of this session).

## Phase 24 — A "Sand" Build-Restricted Tile, Five New Structures/Traps (D-115) — DONE previous session

Kevin asked directly for a sand tile ("acts like normal terrain except that
it cannot have buildings built on top of it," integrated into existing maps
"as I see fit") plus more buildings and traps generally, inviting design
judgment ("be creative and continue using good game design theory"). See
**D-115** in `DECISIONS.md` for the full method.

- **A "sand" terrain tile** (`data/testMap.ts`'s `TileType`, char `D`):
  mechanically identical to plain floor for movement/pathfinding (walkable,
  no terrain effect) — the one difference is a new `GameMap.isBuildable`
  query, which `BuildSystem.canPlace` now checks: every walkable tile except
  sand may be built on. Kept as a separate query from `isWalkable` on
  purpose, so movement never sees a difference, only building does.
- **Integrated into three existing maps** (the Phase 23 maps without a
  campaign of their own yet): canyon dunes past Shattered Causeway's chasm,
  ash drifts at Cinderfall Rift's connector mouths, and mudflats bordering
  The Drowning Vale's water fringe — each denying a specific wall-cheese
  spot rather than scattered randomly. Frostbound Hollow, Emberford,
  Saltmere, and the classic `TEST_MAP` were deliberately left untouched
  (the last three per Phase 23's own established precedent of not
  retrofitting already-shipped, already-unverified balance).
- **Five new structures** (`data/structures.ts`): **Palisade** (cheap,
  fragile wall) and **Bulwark** (pricier, tough wall) bracket Barricade's
  cost/durability into a real three-point curve; **Watchtower** is the
  first `"any"`-audience platform (`PlatformAudience` gains `"any"`,
  `BuildSystem.platformBonusFor` updated to match), granting its bonus
  regardless of melee/ranged; **Frost Trap** reuses the existing
  "restrained" status (previously spell-only via Web Patch) on a buildable
  trap for the first time; **Bear Trap** introduces this pass's one new
  field, `singleUse?: boolean` — consumed and removed after its first
  trigger, a genuine new risk/reward point (`BuildSystem.trapIsSingleUseAt`,
  consumed by `BattleScene`). `SHOP_ORDER` grows from 7 to 12 — checked the
  shop grid's own bounding-box math and confirmed it needs no layout change
  (the equip/Gear grid has been the taller, dominant one since Phase 17).
- **A real pre-existing bug found and fixed**: `BattleScene.showTrapTrigger`
  had logged EVERY trap trigger as "Spike Trap" since Phase 5, regardless of
  which trap (or terrain hazard) actually fired. Fixed by resolving each
  trigger's real name before the delayed render call.
- Tests: 937 → **960** (+23: a new Phase 24 section in `tests/terrain.test.ts`
  for sand; new sections in `tests/building.test.ts` for sand's build
  refusal and all five new structures; three new connectivity/build
  assertions in `tests/newMapsPhase23.test.ts` for the three touched maps).
  Typecheck, all tests, and the production build all pass (109 modules,
  unchanged — no new source files). `npm run dev` serves HTTP 200.
- **What's genuinely untested by the automated suite, and why**: Bear
  Trap's actual removal-after-trigger lives in `BattleScene`'s enemy-phase
  render closure, a scene method, not a pure system — same standing
  limitation as the pit's push-kill (D-114). The pure piece it depends on
  (`BuildSystem.trapIsSingleUseAt`) IS tested.
- **Not built this pass, and why**: no defensive (AC-granting) platform —
  would need either a new `Hero` field kept in sync on every move or a new
  `WaveSystem` context callback, judged disproportionate to add alongside
  this batch; no anti-air trap tier to mirror Frost/Bear Trap (Sky Snare
  stays the only flyer counter) — a reasonable future addition, not
  attempted here to keep this batch's size consistent with the project's
  "small, testable changes" pattern.

## Phase 23 — Expanded Maps and Terrains: a Pit Hazard, Hero-Affecting Terrain, Dynamic Terrain, Four New Maps (D-114) — DONE previous session

Kevin asked for expanded maps and terrains, explicitly inviting design
judgment rather than specifying content himself ("I haven't had a lot of
time to really think about this... use the principles of good map design
and game design," with one steer: "easy to learn, hard to master," dynamic
but not overbearing). A research pass first mapped the current system
(Phase 11.7/D-071's `TileType` union, the Phase 11.10/D-085 Map Builder) and
found the real gap: only 3 built-in maps exist, and two of them (Emberford,
Saltmere) are the SAME 16x9 skeleton with hazard tiles swapped — almost no
actual geometric variety. Three scoping questions surfaced before any code,
all answered toward the fuller option. See **D-114** in `DECISIONS.md` for
the full method.

- **A "pit" terrain tile** (`data/testMap.ts`'s `TileType`, char `@`): the
  "holes" hazard the original Source of Truth vision named (§2.3) but never
  built. Impassable for ground units exactly like a cliff (a flying unit
  still crosses free) — but a unit forced onto one by a push effect (a
  weapon-mastery Push, or a `forcedMoveTiles` spell: Thunderwave, Gust of
  Wind, Reverse Gravity) falls in and is INSTANTLY defeated, resolved
  through the same `resolveDeaths`/`resolveDeathTriggers` funnel any other
  kill uses (gold, Splitter/Carrier, Explosive, etc. all still fire
  correctly). Turns an existing mechanic into a genuine environmental-kill
  tool.
- **Hero-affecting terrain** (`GameMap.heroTerrainEffectAt`, new
  `ParsedMap.hazardsAffectHeroes` flag): a hero standing on a hazardous
  tile now suffers the exact same terrain effect an enemy already does,
  ticked once per player phase (same cadence as the existing Phase 21
  hero status-damage tick). Opt-in PER MAP — Emberford/Saltmere are
  untouched, preserving their already-shipped, already-unverified balance;
  only the four new maps below turn it on.
- **`systems/DynamicTerrainSystem.ts`** (new, pure, tested): mid-battle
  terrain changes keyed to a wave number (matching the "Wave N / M" banner
  players already read), with a telegraphed warning `warnWavesBefore`
  waves ahead of time. Fully generic and data-driven — one system powers
  both a CYCLICAL change (The Drowning Vale's tide: floor→water at Wave 3,
  water→floor at Wave 6) and a ONE-WAY change (Cinderfall Rift's bridge:
  floor→pit at Wave 4, permanent) from the same mechanism, no new code per
  map. Fires at `BattleScene`'s `betweenWave` transition — always a moment
  with zero enemies on the board, so a collapsing tile can never strand a
  live enemy mid-tile.
- **A real correctness bug caught before shipping**: the first draft
  swapped `BattleScene.map` for a brand-new `GameMap` instance when an
  event fired, but `WaveSystem`/`PathfindingSystem`/`BuildSystem`/
  `MovementSystem` each hold their OWN reference to the original instance
  — fixed with a new `GameMap.setTiles()` that mutates the SAME instance's
  tile grid in place, so every system sees the change immediately.
- **A second, unrelated real gap found and fixed while building this**:
  `BattleScene.buildBoard` rendered every tile as either blocked or floor —
  cliff/water/fire/acid have been mechanically distinct since Phase 11.7
  but were VISUALLY IDENTICAL to plain floor on the actual battle board the
  entire time (only the Map Builder's own editing palette ever colored
  them). Fixed with a `BOARD_TERRAIN_COLORS` map covering all 7 tile types
  plus a glyph on pit tiles.
- **Four new maps**, each demonstrating a different map-design principle
  rather than another reskin of the existing 16x9 skeleton: **Shattered
  Causeway** (a single 2-tile bridge across a chasm — the pit's showcase),
  **The Drowning Vale** (a cyclical flood zone — the tide showcase),
  **Cinderfall Rift** (three lanes, a direct bridge that permanently
  collapses at Wave 4 — the one-way dynamic-terrain showcase, verified
  connected both before and after the collapse), **Frostbound Hollow** (a
  cliff ridge splitting the map, crossable only by flying units or a long
  top/bottom detour — the static flying-vs-ground verticality showcase).
  All four join `data/maps.ts` and `FreePlayScene`'s `MAP_OPTIONS`
  immediately (`unlockCampaignId: null`), no campaign of their own yet.
- The Map Builder's Terrain palette gained the new "Pit" option;
  `encodeMapRows`/`parseMapRows` round-trip it like every other tile type.
- Tests: 900 → **937** (+37: new `tests/dynamicTerrainSystem.test.ts` [11],
  new `tests/newMapsPhase23.test.ts` [16], a new Phase 23 section in
  `tests/terrain.test.ts` [+10]). Typecheck, all tests, and the production
  build all pass (109 modules, up from 104 — five new files). `npm run dev`
  serves HTTP 200. **Not yet confirmed by a human in a browser** — the
  SEVENTH consecutive content/mechanics phase to ship this way — see
  **KI-071** for the full checklist.
- **Not built this pass, and why**: no bigger board (the 9-row/20-col
  ceiling stays — a real fixed-canvas/HUD constraint, a separate,
  bigger-scoped project if ever tackled); no per-map terrain authoring UI
  for dynamic events (built-in-map-only this pass); no enemy-pushes-hero
  interaction with pits (no enemy attack currently pushes a hero at all);
  Emberford/Saltmere were NOT retrofitted with hero-affecting terrain or
  the pit tile.

## Phase 22 — Magic-Item Expansion: Real SRD Magic Items, a `+1/+2/+3` Enchant Overlay, a Brand-New Loot System, a Level-Scaled Shop (D-113) — DONE this session

Kevin asked for "a more complete repertoire of items" — potions, `+1/+2/+3`
weapon/armor/shield modifications (verified against a real SRD research
pass before inventing anything), lots of free-access magic items, and the
Cape of Billowing "because I think that would be a fun item that has its
own animation." He also asked for — and explicitly invited design input
on — a loot system: enemy drop odds by tier, an occasional lucky one-tier-up
drop, most enemies dropping nothing, curated campaign loot vs. random Free
Play loot, and a shop that sells magic items gated by average party level.
Three scoping questions surfaced before any code, all answered toward the
more real/complete option: a real `+1/+2/+3` enchant OVERLAY (not a
~150-entry flat catalog), a real animated cape visual (new Phaser drawing
code, not data-only), and keep building now rather than pause for the
six-phases-deep overdue in-browser pass. See **D-113** in `DECISIONS.md`
for the full method.

- **A real SRD 5.1 `+1/+2/+3` enchant overlay** (`data/equipment.ts`): any
  mundane weapon, shield, or real-armor chest item can be enchanted on
  demand via a `${baseId}+${level}` composite id (`enchantedItemId`/
  `parseEnchantedItemId`, `getEquipmentDefinition` synthesizes the
  definition), rather than a hand-authored catalog entry per weapon per
  tier. No attunement required (the real SRD rule for basic `+N` gear).
- **15 new magic items** (`data/magicItems.ts`, new file): 14 real
  SRD-sourced items reusing existing mechanical hooks (flat AC/attack-
  damage/saving-throw/movement bonuses, or one of the four existing
  `EquipmentProc` kinds) — Ring/Cloak of Protection, Bracers of Defense,
  Stone of Good Luck, Ring of Resistance, Ring of Free Action, Periapt of
  Proof against Poison, Boots of Striding and Springing, Boots of Speed,
  Bracers of Archery, Robe of the Archmagi, and three named weapons (Flame
  Tongue, Frost Brand, Dagger of Venom) — plus the original **Cape of
  Billowing**. Verified the real published "Cloak of Billowing" is
  Xanathar's Guide content, NOT SRD, so the Cape is built as original
  content instead — the same correction-precedent treatment Tough/Lucky/
  Athlete already got.
- **A new "Back" gear slot** (the tenth slot instance) for cloaks/capes,
  including a real, NEW visual: the Cape of Billowing trails an animated,
  fluttering `Graphics` shape behind its wearer's token, redrawn every
  frame via `BattleScene`'s first use of Phaser's `update()` lifecycle hook
  (the same "new drawing code, no new art" treatment Phase 20's aura ring
  already established).
- **Five new `EquipmentDefinition` fields**, each reused by 2+ items:
  `savingThrowBonus`, `movementBonusTiles`, `grantsStatusImmunity` (checked
  once in `Hero.applyStatus`), `rangedAttackBonus`/`rangedAttackDamage`
  (conditional on a ranged weapon equipped), and `visualEffect`.
- **8 new potions** (`data/potions.ts`): the real SRD "Potion of Healing"
  rarity-tiered potency rule across 4 tiers, Potion of Heroism, Potion of
  Speed (`Hero.grantHaste` — a permanent movement bonus), Potion of
  Resistance (`Hero.grantResistance` — a permanent damage-halving grant
  that reuses Rage/Wild Shape's own `hasDamageResistance`, but never
  expires or is cleared by a rest), and Restorative Ointment
  (`Hero.cureAllStatuses` + a heal). Every potion now carries a `rarity`.
- **A brand-new loot-drop system** (`systems/LootSystem.ts`, new file, pure
  and tested): drop chance and base rarity scale by `EnemyRole` (minion
  12%/common, miniboss 55%/uncommon, boss 90%/rare, legendary 100%/
  veryRare), with a flat 12% chance to bump one rarity tier higher — the
  "occasional lucky drop from a lesser enemy" Kevin asked for. A drop
  either names a real potion/magic item at that rarity, or generates a
  random enchanted mundane weapon/armor/shield at the matching level. Two
  new `RandomService` methods (`rollPercent`/`rollIndex`) back every roll.
- **Campaign-curated vs. Free-Play-random is one parameter, not two code
  paths**: `CampaignDefinition` gains an optional `lootPoolIds` (Emberford
  Reach: fire-themed; Saltmere Shallows: water-themed — both fall back to
  the full pool if a restriction would strand a rarity tier). The classic
  10-wave campaign and Free Play both use the full, unrestricted pool.
- **Where a drop actually lands**: `BattleScene.grantLootDrop` auto-equips
  it into the first living hero with a matching, attunement-legal,
  grip-legal open slot, or auto-sells it for its listed gold cost if no
  hero can currently take it — no "found but not equipped" inventory/
  browsing UI exists this pass, a documented scope boundary.
- **A level-scaled shop** (`systems/ShopSystem.ts`, new file, pure and
  tested): common/uncommon gear stays visible at every level (zero
  regression for a fresh level-1 party); rare/veryRare/legendary magic
  items — including Phase 13.9's original five, now gated for the FIRST
  time too — unlock at average party level 4/8/13 respectively. The
  classic fixed roster (no `classLevel` growth) only ever sees the
  always-unlocked tier.
- A real, pre-existing test invariant CORRECTED, not just extended:
  Phase 13.9's "only rare-and-up items require attunement" was true of its
  own five items by choice, never an SRD rule — several new real SRD items
  (Cloak of Protection, etc.) genuinely require attunement at `uncommon`.
  Corrected to the invariant that holds universally: no `common` item ever
  requires attunement.
- Tests: 864 → **900** (+36: new `tests/lootSystem.test.ts` [10], new
  `tests/shopSystem.test.ts` [6], new Phase 22 sections in
  `tests/equipment.test.ts` [+10] and `tests/potions.test.ts` [+4], new
  `rollPercent`/`rollIndex` coverage in `tests/randomService.test.ts` [+5],
  a new `lootPoolIds` check in `tests/campaigns.test.ts` [+1], and one
  corrected pre-existing assertion). Typecheck/build clean (104 modules, up
  from 101 — three new files). `npm run dev` serves HTTP 200. Not yet
  confirmed by a human in a browser — the SIXTH consecutive content/
  mechanics phase to ship this way — see **KI-070**.
- **Not built this pass, and why**: any "found but not equipped" loot
  inventory/browsing UI; ability-score-setting magic items (Amulet of
  Health, Gauntlets of Ogre Power, Headband of Intellect, and the rest of
  that real SRD family) — this game's derived combat stats bake an ability
  modifier in at several points, not always read live; any charge-based
  active item (wand/rod/staff) — no "limited uses" item mechanic exists
  yet; Cloak of Displacement (needs a new "attacks against the wearer have
  disadvantage" hook); Ioun Stones (would violate `effectiveMaxHealth`'s
  own "equipment does not affect max HP" invariant); enchanted `+1/+2/+3`
  gear is loot-only, not purchasable in the shop this pass.

## Phase 21 — Second Wave of Enemy Archetypes: Hero-Side Status Effects, 12 More Mechanics, 24 New Enemies (D-112) — DONE previous session

Immediately after Phase 20 shipped, Kevin scoped a second wave of archetypes
in that same session and asked for prep so a fresh chat could go straight
into building (recorded in `PHASE_HANDOFF.md`'s "Phase 21 candidate"
section). This session read that section and confirmed three scoping
questions before any code, all toward the fuller/faster option: keep
building rather than pause for the now-FIVE-phases-overdue in-browser
feel/balance pass; build the hero-side status-effect system as a FULL
generic system (any status usable on either side), not narrowly scoped to
just poison+silence; and verify Swarm's real SRD rules FIRST, per this
project's own "verify against the actual document" policy. See **D-112** in
`DECISIONS.md` for the full method.

- **A hero can carry status effects for the first time** —
  `Hero.activeStatuses` mirrors `Enemy.activeStatuses` field-for-field,
  reusing `data/statusEffects.ts`'s exact shape. Every existing status field
  is now consumed on the hero side too (`armorClassDelta` into
  `armorClass`, `movementReduction` into a new `effectiveMovementTiles`,
  `attackRollDisadvantage` into a new `attacksWithDisadvantage`,
  `preventsAction` gating `canMove()`/`canAct()` directly, `damagePerTurn`
  via a new `tickStatusDamage()` ticked once per player phase). A new
  status, **"silenced"** (`preventsCasting`), blocks casting only, not
  movement or a basic Attack. A hero's on-token status badge mirrors the
  existing enemy one. Two new mid-player-phase death paths (a poison tick,
  a Reflector's counter-damage) each get an explicit, deferred party-wipe
  check — the first time a hero's own turn (not an enemy's) could end the
  game.
- **Twelve more enemy mechanics, each with a real roster hookup**:
  **Berserker** (`enrage`), **Lifedrinker** (`lifedrinkPercent`),
  **Splitter/Carrier** (`onDeathSpawns`, resolved through a new
  `WaveSystem.resolveDeathTriggers`/`BattleScene.resolveDeaths` funnel that
  fires from ANY death cause — hero attack, trap, burn/poison tick),
  **Explosive** (`onDeathExplode`), **Shielded** (`damageShieldHp`, via a
  new `Combatant.absorbDamage?` hook), **Reflector**
  (`reflectsDamagePercent`), **Gold Thief** (`goldTheftAmount`, via a new
  `EconomySystem.deduct`), **Teleporter** (`teleportsEveryNTurns`),
  **Mimic** (`mimicDisguise` — a brand-new disguise-until-approached
  mechanic, kept conceptually separate from stealth despite reusing its
  `Enemy.isRevealed` boolean), **Healer** (`healAura`), **Anti-caster**
  (`inflictsStatusOnHit` — Kevin's own simplification: no suppression
  system, just a Silence-style status on a landed hit), and **Multi-Phase
  Boss** (`phaseChange` — a new per-INSTANCE `Enemy.activeDef` override,
  never mutating the shared definition every instance of that enemy TYPE
  references).
- **Swarm** (`swarm`), verified against the real SRD 5.2.1/2024 "Swarm"
  trait via two independent sources before any other Phase 21 code was
  written: can occupy another living enemy's tile and vice versa (both
  `isOccupiedByAnyEnemy`/`isOccupiedByOtherEnemy` are swarm-aware), immune
  to charmed/restrained/stunned/toppled, deals half damage once Bloodied.
  The real bludgeoning/piercing/slashing damage resistance is honestly NOT
  modeled — this game has no damage-type-aware resistance system.
- **24 new enemies** (`data/enemies.ts`): 21 new minions (Living Splinter is
  the Splitter/Carrier family's shared, deliberately plain fodder — no
  mechanic of its own, same exception Ironhide got in Phase 20), 2 new
  minibosses (Bloodrage Warlord, The Husk), 1 new true boss (Sundered
  King). **Aegis Bearer combines Shielded+Reflector** and **Plague Warden
  combines Healer+Anti-caster**, one roster entry each — Kevin's own "these
  could be combined" ask, not a separate family per combo.
- **Free Play integration**: all 21 new minions join `EXPANDED_MINIONS`; the
  3 new miniboss/boss entries join `BOSS_OPTIONS` (`unlockCampaignId:
  null`) — the boss-picker row now renders 13 buttons, up from 10.
- Tests: 813 → **864** (+51: new `tests/enemyMechanicsPhase21.test.ts` [25],
  new `tests/heroStatusEffects.test.ts` [15], a new `EconomySystem.deduct`
  suite in `tests/economy.test.ts` [+4], a new Phase 21 section in
  `tests/enemyRoster.test.ts` [+7], and updated boss/miniboss counts in
  `tests/campaign.test.ts`/`tests/enemyRoster.test.ts`). Typecheck/build
  clean (101 modules, unchanged — no new source files). `npm run dev`
  serves HTTP 200. Not yet confirmed by a human in a browser — by now the
  FIFTH consecutive content/mechanics phase shipped this way — see
  **KI-069**.

## Phase 20 — "Tons of Different Enemies": Six New Mechanics, 21 New Enemies (D-111) — DONE previous session

Kevin asked directly for a huge variety of enemies, almost all with a real
unique hook — naming siege, assassin, runner, tank, treasure-laden,
summoner, and captain/banner-lord archetypes himself, plus varied attack
types (ranged/melee/AoE/breath) and a longer-term direction (level 20+
parties, a possible endless "keep playing forever" mode). Two scoping
questions asked before any code, both answered toward the fuller option:
build every new mechanic as a real system this session, and build a couple
of extreme epic-tier bosses now while leaving an actual endless-mode wave
generator as a separately-scoped future item. See **D-111** in
`DECISIONS.md` for the full method.

- **Six new mechanics, each reused by 2+ roster entries** so none is a
  one-off: **siege** (a siege enemy attacks and destroys a destructible
  wall — new `StructureDefinition.maxHp`/`BuildSystem.damageStructure` —
  within its own attack range instead of a hero); **stealth** (hidden from
  ALL hero-initiated targeting until its first strike, an Advantage-rolled
  ambush that permanently reveals it — new `Enemy.isRevealed`/`.reveal()`);
  **aura buff** (a captain buffs every OTHER nearby enemy's to-hit/damage/
  movement, recomputed fresh every phase, rendered as a real translucent
  ring on the board); **reinforcements** (periodically spawns more enemies
  beside itself on a cooldown — deliberately separate code from the
  hero-ally `SummonSystem`); **treasure** (extra gold on a kill, on top of
  the ordinary reward, called out in the combat log); **AoE/breath** (hits
  every hero in range at once, or forces each to roll its own save when
  combined with a saving-throw DC). **Pure runners** never attack at all,
  always advancing — the only counter is route manipulation.
- **21 new enemies** (`data/enemies.ts`): 16 new minions (two per mechanic,
  plus the pure-tank Ironhide), 1 new miniboss (Juggernaut, a tank+siege
  hybrid), 2 new true bosses (Warlord Korrath — a bigger aura; The
  Devourer — reinforcements + a big treasure bonus), and 2 new
  **`role: "legendary"`** capstones sized for a level-20+ party (Ashen
  Sovereign, The Hollow Empress) — a brand-new role tier above `"boss"`.
- **A real bug caught and fixed while building this**: `BestiaryScene`'s
  role-grouping had exactly three buckets (minion/miniboss/boss); a
  `"legendary"` enemy would have silently matched none of them and vanished
  from the Bestiary entirely. Fixed with a fourth group.
- **Free Play integration**: all 16 new minions join `EXPANDED_MINIONS`;
  the new miniboss/boss/legendary tier joins `BOSS_OPTIONS` (all
  `unlockCampaignId: null`, same staging every prior boss got before it had
  a campaign of its own). The boss-picker row now renders 10 buttons
  (up from 5) — the row's width computation is already dynamic so it can't
  overflow, but it's flagged as worth a look in the in-browser pass.
- Tests: 802 → **813** (+11 new `tests/enemyMechanics.test.ts` exercising
  all six mechanics behaviourally through `WaveSystem`, plus new roster/
  data checks, a `BuildSystem.damageStructure` suite, a `treasureBonusGold`
  case, and updated boss/miniboss counts in existing files). Typecheck/
  build clean (101 modules, unchanged — no new files). `npm run dev` serves
  HTTP 200. Not yet confirmed by a human in a browser — see **KI-068**.

## Phase 19 — Real Dual-Wielding: Two-Weapon Fighting AND Nick (D-110) — DONE this session

Kevin pushed back on Two-Weapon Fighting being left inert ("2 weapon
fighting seems like it could be and should be implemented"). Building its
real prerequisite — a base dual-wielding mechanic — also gave the Nick
weapon mastery (inert since Phase 17 for the identical reason) a real
hookup for free; Kevin confirmed fixing both together. See **D-110** in
`DECISIONS.md`.

- **A Light melee weapon may now occupy the `"shield"` gear slot as an
  off-hand weapon** (mutually exclusive with a real Shield) — fills the
  empty `"weapon"` slot first, then falls back to `"shield"`, mirroring
  the existing ring1/ring2 auto-fill rule; equipping one while a real
  Shield already occupies the off-hand is refused with a clear message.
- **A real off-hand attack**: once per hero turn, dual-wielding grants one
  extra attack after the main Attack action, costing the bonus action
  unless either weapon carries Nick (free instead); its damage skips this
  hero's ability modifier unless it has the Two-Weapon Fighting feat.
- **Two-Weapon Fighting and Nick both flipped `mechanicallyActive: true`.**
- Tests: 778 → **789** (+11). Typecheck/build clean. Not yet confirmed by
  a human in a browser — see **KI-067** (`KNOWN_ISSUES.md`).

## Phase 18 — 13 More SRD Feats, Enforced Prerequisites (D-109) — DONE

Kevin asked to add as many feats as possible from the 2024 rules, with
prerequisites enforced. A verification pass against the real SRD 5.2.1 PDF
found the free document has only 17 feats total (not the ~50+ of the full
PHB), and that 3 of the 4 starter feats already shipped (Tough, Lucky,
Athlete) were mistakenly attributed to it back in Phase 11.3 — only Alert
was real SRD content. See **D-109** in `DECISIONS.md` for the full method.

- **Fixed the Tough/Lucky/Athlete sourcing attribution** in
  `CONTENT_SOURCES.md` (mechanics unchanged — already balanced and shipped).
- **13 net-new SRD-legal feats** (`data/feats.ts`): Magic Initiate, Savage
  Attacker, Skilled (Origin); Grappler (General); Archery, Defense, Great
  Weapon Fighting, Two-Weapon Fighting (Fighting Style); 7 Epic Boons
  (level 19+, real but practically unreachable in this game's current run
  lengths — same honest treatment as Barbarian's level-20 Primal Champion).
- **`Hero.meetsFeatPrerequisites`** — this codebase's first general feat-
  prerequisite check (level, ability-score-any-of, Fighting-Style class,
  spellcasting class), replacing the feat picker's old bare "doesn't
  already have it" filter.
- **Real mechanics for most of the new feats**: Grappler's restrain-on-hit
  (mirrors the Topple weapon mastery), Boon of Combat Prowess's miss-to-hit,
  Boon of Fate's auto-applied attack bonus, Boon of Spell Recall's
  1d4-vs-slot-level chance to save a spell slot (new
  `RandomService.rollD4()`), Boon of Irresistible Offense's natural-20
  bonus damage, and Magic Initiate's 2 cantrips + 1 free-castable leveled
  spell (repeatable across Cleric/Druid/Wizard). Skilled, Two-Weapon
  Fighting, and 3 Epic Boons stay honestly inert (no skill-proficiency,
  dual-wielding, reposition-after-acting, or lighting/invisibility-
  detection system exists).
- **Two new ASI-overlay follow-up steps** (an ability picker, a Magic
  Initiate spell-list picker), reusing the existing `renderAsiPrompt`
  helper — no new overlay component.
- Tests: 744 → **778** (+34). Typecheck/build clean. Not yet confirmed by
  a human in a browser — see **KI-066** (`KNOWN_ISSUES.md`) for the full
  checklist.

## Phase 17 — Real Weapons, Armor, and Weapon Mastery (D-108) — DONE

Kevin asked to add "tons and tons" of source-accurate weapons/armor and
build real weapon masteries. Two scoping questions answered toward the
fuller/more real option: real mechanical hooks for all 7 modelable mastery
properties, and an equipped weapon REPLACES a hero's base attack damage/
range rather than adding a small bonus. See **D-108** in `DECISIONS.md` for
the full method and source-verification notes.

- **36 of the SRD 5.2.1's 38 core weapons** (`data/weapons.ts`, real
  damage dice/type/properties/mastery) and **all 11 SRD armors + the
  Shield** (`data/armor.ts`, real AC/Dex-mode formulas) — two firearms
  (Musket, Pistol) deliberately excluded for fantasy-setting tone.
- **Two new gear slots, `"weapon"`/`"shield"`**, merged into the existing
  equipment registry — the whole Gear shop/Compendium/attunement/proc
  system needed zero special-casing beyond the type additions.
- **A real weapon REPLACES a hero's base attack damage and range**
  (`systems/WeaponSystem.ts`, new pure/tested dice-average and ability-
  modifier math); a class's own rider damage (e.g. Sneak Attack) is kept
  separate (`Hero.classRiderDamage`) so it still stacks on top. Real armor
  REPLACES the unarmored-AC formula (light: full Dex, medium: capped at
  +2, heavy: none) instead of adding a flat bonus.
- **Six real weapon-mastery mechanics** (`BattleScene.applyWeaponMastery`):
  Push, Sap, Slow, Topple, Graze, Vex, Cleave — two new status effects
  (`"sapped"`/`"toppled"`) plus a new generic `Enemy.attacksWithDisadvantage`
  getter. Nick stays honestly data-only (needs a dual-wielding system this
  game doesn't have). A real Two-Handed/Shield equip conflict is enforced.
- **The Gear shop grid is now paginated** (16 items/page) — the catalogue
  nearly quadrupled in size; `CompendiumScene`'s Equipment tab joins
  Classes/Spells as a paginated category for the same reason.
- Tests: 695 → **744** (+49). Typecheck/build clean (101 modules, up from
  98 — three new files). `npm run dev` serves HTTP 200. Not yet confirmed
  by a human in a browser — see **KI-065** (`KNOWN_ISSUES.md`) for the full
  checklist.

## Phase 16 follow-up (same day) — Fix `aoeAtRange` saving throws + add Hellish Rebuke (D-107) — DONE

Kevin asked to fix both gaps Phase 16 (D-106) itself had logged.

- **`aoeAtRange` abilities now support a real saving throw** —
  `BattleScene.castAoeAtRangeSpell` rolls a save per enemy in the blast
  when `ability.savingThrow` is set, instead of always an attack roll. 25
  of 29 `aoeAtRange` spells now carry the correct SRD saving-throw ability
  (Fireball/DEX, Stinking Cloud/CON, Confusion/WIS, etc.).
- **A related bug fixed in the same pass**: `forcedMoveTiles` (Thunderwave,
  Gust of Wind, Reverse Gravity) never actually pushed anyone on an
  `aoeAtRange` ability — fixed, pushing from the blast's own tile.
- **Warlock's Hellish Rebuke** added to the catalogue (319 spells, up from
  318), wired with a real `abilityId` (a normal attack, since this game
  has no reaction economy to model the SRD's trigger).
- **New `tests/abilities.test.ts`** guards against this class of bug
  (dead/contradictory fields) recurring.
- Tests: 691 → **695** (+4). Typecheck/build clean. `npm run dev` serves
  HTTP 200. See **D-107** in `DECISIONS.md`; **KI-064** in
  `KNOWN_ISSUES.md` updated — both gaps marked resolved.

## Phase 16 — Make All Spells Usable (D-106) — DONE this session

Kevin asked to "make all the spells usable in the game." Three scoping
questions were answered toward the fullest option each time: build real
new systems (not reflavor existing mechanics) for the genuinely exotic
spell types, expand every full-caster class to its complete known SRD
spell list, and do the whole thing as one big sequenced batch. See
**D-106** in `DECISIONS.md` for the full method and every scope-fork
answer.

- **Six new mechanics**: five new status effects (`poisoned`, `restrained`,
  `blinded`, `exposed`, `charmed` — `data/statusEffects.ts`), a new
  ally-buff system (`blessed`/`warded`/`guided` — `data/buffEffects.ts`,
  `Hero.activeBuffs`), a third `AbilityKind` (`"aoeAtRange"` — pick a tile,
  hit an area around it), `areaAllies`/`appliesBuff` (multi-target ally
  heal/buff), `forcedMoveTiles` (push an enemy back), `teleportSelf` (the
  caster blinks to a chosen tile), a new summon system (`data/summons.ts`,
  `entities/Summon.ts`, `systems/SummonSystem.ts` — a temporary ally that
  auto-attacks each turn), and terrain-shaping via `BuildSystem` (two new
  spell-only structures, auto-removed on a duration timer).
- **~184 more of the 318-entry spell catalogue now carry a real
  `abilityId`** (198 total, up from 14), via a documented 12-archetype
  rulebook applied level-by-level. ~120 spells stay genuinely data-only —
  pure information/social/utility/travel spells with no plausible combat
  use even loosely (Comprehend Languages, Identify, Scrying, etc.).
- **Six full-caster classes' known-spell lists** (`data/characterCreation.ts`)
  grew from 1-2 curated entries to their full real SRD 5.1 list, filtered
  to what's wired: Wizard (7 cantrips/106 leveled), Cleric (3/56), Bard
  (2/51), Druid (5/61), Sorcerer (7/83), Warlock (4/37). Paladin/Ranger
  deliberately excluded — their half-caster slots already auto-spend on
  Divine Smite/Hunter's Mark (D-093); adding a spellbook too would
  double-book the same pool.
- **`BattleScene`'s spellbook overlay rebuilt as a paginated 4×3 grid**
  (Prev/Next) after discovering the original single-row layout (sized for
  2-6 spells) would have rendered most of a 100+-spell list off-canvas.
- **Two real gaps found, logged, not fixed this pass**: `aoeAtRange`
  abilities don't support a saving throw (always an attack roll); Warlock's
  Hellish Rebuke was never added to the spell catalogue at all back in
  Phase 15 (D-104) — both in **KI-064**.
- Tests: 677 → **691** (+14). Typecheck/build clean (98 modules, up from
  94 — four new files). `npm run dev` serves HTTP 200. **Not yet confirmed
  by a human in a browser** — by far the biggest single content addition
  yet, so this matters more than usual here. Full checklist in
  **KI-064** (`KNOWN_ISSUES.md`).

## Phase 15 follow-up — Subclass-granted spell lists (D-105) — DONE this session

Kevin asked to "tackle the subclass granted spell thing" — D-104's own
"couldn't be added" list had flagged this as out of scope. See **D-105**
in `DECISIONS.md` for the full verification method.

- **Life Domain (Cleric), Oath of Devotion (Paladin), and The Fiend
  (Warlock) each gain their real SRD "bonus spell" feature** — Domain
  Spells, Oath Spells, and Expanded Spell List respectively — which turned
  out to be simply MISSING from `data/subclasses.ts` before now, not
  merely inert. Verified against SRD 5.1 (2-3 independent mirrors per
  feature); one wrong Oath of Devotion variant from a search snippet was
  caught and discarded. Every spell needed was already in Phase 15's
  318-entry catalogue.
- **`ClassFeature` gains an optional `grantedSpellIds?: string[]`.** All
  fifteen new feature entries stay `mechanicallyActive: false` — this
  game's known-spell list is fixed per class, not per subclass, and none
  of the granted spells besides Cure Wounds (already known regardless of
  domain) have a real `abilityId` to cast with yet.
- **Circle of the Land (Druid) gains a full reference table,
  `CIRCLE_OF_THE_LAND_SPELLS`** — all 7 SRD terrains × 4 leveled tiers ×
  2 spells — kept separate from the other three because the terrain
  CHOICE itself has no character-creation UI to make yet, a bigger,
  still-deferred gap than "just wire up the spell ids."
- Tests: 668 → **674** (+6, `tests/subclasses.test.ts` 39 → 45).
  Typecheck/build clean.
- **Still NOT done, on purpose:** no new spell is castable (same boundary
  as Phase 15 itself); Circle of the Land's terrain-choice UI remains a
  properly-scoped future slice.

## Phase 15 — Full SRD spell-list catalogue (D-104) — DONE this session

Kevin asked to "add as many spells as possible from the sources we can
use," and to be told which couldn't be added and why. Offered a scope fork
(cantrips only / through 3rd level / the complete SRD lists up to 9th
level, since this game's spell-slot tables already go that high), Kevin
chose the complete lists. See **D-104** in `DECISIONS.md` for the full
verification method and scope boundary.

- **`src/game/data/spells.ts` grows from 14 to 318 spells.** Every SRD
  spell on the Bard/Cleric/Druid/Paladin/Ranger/Sorcerer/Warlock/Wizard
  base class spell lists (levels 0-9) is now logged: name, level, school,
  and an original description. Verified against two independent SRD 5.1
  mirrors (cross-checked against each other and a third-party spell API)
  — sourced from SRD 5.1, not 5.2.1 like the pre-existing 14, because the
  official 5.2.1 PDF's text isn't machine-extractable in this environment
  and no reliable 5.2.1 mirror was found (a real, logged limitation, not
  an oversight).
- **All 304 new spells are DATA-ONLY** — no `abilityId`, no change to
  `characterCreation.ts`'s known-spell-lists. Most describe effects (AoE
  at range, ally buffs, summons, illusions, terrain effects) this game has
  no system for yet, same "inert until a system exists" treatment already
  given to Bless/Burning Hands/Mage Armor/Guidance/Shield of Faith.
- **`CompendiumScene`'s Spells tab gains a per-level filter** (Cantrip/
  1st/.../9th, ten buttons) plus Prev/Next paging, mirroring the existing
  Classes-tab selector pattern — a flat 318-entry list no longer fits one
  screen the way 14 did.
- **What could NOT be added, and why:** subclass-granted "expanded spell
  list" spells (e.g. a Cleric domain's bonus spells) are additional SRD
  content beyond the base class list and were out of scope this pass; the
  four non-caster classes (Fighter, Rogue, Barbarian, Monk) correctly have
  no spell list at all; SRD 5.2.1-specific spells (e.g. the reworked 2024
  True Strike) weren't independently verified and aren't claimed here.
- Tests: 664 → **668** (net +4 — `tests/spells.test.ts`'s two hardcoded
  full-id-list tests replaced with six structural checks). Typecheck/build
  clean. **Not confirmed in a browser** — the new Compendium pagination UI
  is unconfirmed by a human, same standing limitation as every other
  Compendium change since Phase 11.5.

## Phase 12.3 — Turn-lock ownership (`controlledBy: "remote"`), start-battle handoff (D-103) — DONE this session

Kevin said "12.3" directly. A genuine scope fork surfaced before any code:
the design doc's 12.3 bundles turn-lock ownership AND result-broadcast
(live sync of two clients' boards). Shown the concrete tradeoff — full sync
now (bigger, and the riskiest/least-verifiable-without-a-browser part of
the whole phase, since enemies/structures are spawned dynamically with no
existing "redraw from model" function to reuse) vs. ownership/gating now
with sync explicitly deferred — Kevin chose the smaller, recommended scope.
See **D-103** in `DECISIONS.md` for full notes.

- **`HeroControlMode` gains `"remote"`**, flowing through `Hero`,
  `SaveSystem`, and `firestore.rules`' `isValidBuild` automatically.
- **`CoopSessionSystem.ts` gains `status`/`heroOwners`**, `startCoopBattle`
  (alternates ownership across the classic roster's 4 heroes in slot order
  — a flat first-pass scheme, no per-hero picker UI yet) and
  `canActOnHero`.
- **`CoopSessionSync.ts` gains `startBattle`**; **`firestore.rules`** gains
  a host-only `"lobby" -> "battle"` update shape.
- **`CoopLobbyScene.ts` gains "Start Battle"** (host-only, once full); the
  guest auto-navigates into battle via its existing live subscription.
- **`BattleScene.ts`** accepts an optional `coopSession` context: assigns
  `controlledBy` per hero from `heroOwners`, and gates every hero-selection
  entry point (`canLocallyControl`) so a client can only act on heroes it
  owns — clicking a partner's hero shows "Waiting for `<name>`'s turn…"
  instead of selecting it.
- Tests: 661 → **664** (+3). Typecheck/build clean — 94 modules, UNCHANGED
  (no new files, only edits). `npm run dev` serves HTTP 200.
- **Explicitly NOT built:** result-broadcast / live board sync. A coop
  battle is enterable and ownership-gated, but the two clients' boards do
  NOT converge as either side acts — no mechanism yet moves one client's
  move to the other's screen. That's the next sub-phase's job. No manual
  two-tab verification this session — see KNOWN_ISSUES **KI-063**.

## Phase 12.2 — Cooperative Session Lobby: create/join by code (D-102) — DONE previous session

Kevin approved proceeding into 12.2 right after 12.1. This sub-phase
surfaced a genuinely new decision: a join code needs typed text, and this
project has never had a free-text input anywhere. Shown the concrete
tradeoff (a custom keyboard widget vs. a real HTML `<input>` overlay, see
`DECISIONS.md` D-102), Kevin chose the HTML input for its native paste
support — codes get shared over chat, and re-typing one by eye is far more
error-prone than pasting it.

- **New `systems/CoopSessionSystem.ts`** (pure, tested): the lobby's
  plain-data shape (`CoopSessionRecord`/`CoopParticipant` — deliberately
  just the lobby, no battle state yet), a 6-character session-code
  generator (excludes visually confusable characters), and join-eligibility
  rules capped at `MAX_COOP_PARTICIPANTS = 2`.
- **New `cloud/CoopSessionSync.ts`**: `createSession`/`joinSession`/
  `subscribeToSession`/`deleteSession`, using Firestore transactions so two
  near-simultaneous joins (or two hosts generating the same code) can't
  race each other.
- **New `firestore.rules` block, `coopSessions/{sessionId}`**: readable by
  any signed-in user (invite-only via the code itself, not a read
  restriction — this app never browses the collection); create is
  host-only; update is append-only (join); delete is host-only. Matching
  test cases added to `firestore-tests/rules.test.ts` (unrun — same
  standing JDK 21+ limitation as every prior rules addition).
- **New `scenes/CoopLobbyScene.ts`**: Create Session (shows the code + a
  live participant list) or Join Session (this project's first HTML
  `<input>`, auto-uppercased/filtered, Enter-to-submit). Reached from a new
  Firebase-gated "Co-op" button on the main menu.
- **`main.ts`** gained `dom.createContainer: true` — the one engine change
  the new input needs; every other scene is unaffected.
- Tests: 653 → **661** (+8, `tests/coopSessionSystem.test.ts`). Typecheck/
  build clean — 91 → **94 modules** (these three new files ARE reachable
  from `main.ts`, unlike Phase 12.1's still-unwired `BattleStateSnapshot.ts`).
  `npm run dev` serves HTTP 200 (checked this session).
- **Not built:** any battle integration — a session's participants can't
  start or play a battle together yet; that needs turn ownership and
  `BattleStateSnapshot` (D-101) wired into `BattleScene`, a future
  sub-phase. Not yet verified by a human in a browser — see KNOWN_ISSUES
  **KI-062**.

## Phase 12.1 — `BattleStateSnapshot`: a pure, tested full-battle serialize/restore round trip (D-101) — DONE previous session

Kevin approved proceeding into 12.1, the first sub-phase
`PHASE_12_MULTIPLAYER_FEASIBILITY.md` (D-100) proposed — the design doc's
own biggest unscoped unknown, since `SaveSystem` (D-083) never serializes
LIVE battle state, only party builds between runs. Built entirely headless.
See **D-101** in `DECISIONS.md` for full notes.

- **Every pure system a live battle needs now supports a full state
  round trip**: `Hero.toSnapshot()`/`static fromSnapshot()` (a new
  `HeroSnapshot` covering literally every field — HP, position, gear, class
  level, every per-rest resource pool, every per-turn flag, subclass);
  `Enemy.toSnapshot()`/`static fromSnapshot()` (plus a new `statuses`
  getter); `BuildSystem.toSnapshot()`/`.restoreFrom()`;
  `WaveSystem.toSnapshot()`/`.restoreFrom()`; `TurnSystem.fromHistory()`
  (reuses the existing `history` getter + `transitionTo`, no new state).
- **New `systems/BattleStateSnapshot.ts`**: `captureBattleState`/
  `restoreBattleState`, the top-level orchestrator combining all of the
  above plus `EconomySystem`/`RestSystem` (both already fully
  reconstructable from their existing APIs, no changes needed).
- **A real finding:** `RandomService`'s own internal PRNG state is
  deliberately excluded from every snapshot — consistent with D-100's own
  finding that a future sync should broadcast combat RESULTS, never replay
  a dice stream. A restored battle needs a working `RandomService`, not a
  bit-identical one.
- Tests: 648 → **653** (+5, `tests/battleStateSnapshot.test.ts`). The core
  assertion is `toSnapshot() -> fromSnapshot() -> toSnapshot()` again,
  equal to the first call — proves every field survives, not just the ones
  a test remembered to check by hand. Typecheck/build clean — 91 modules,
  UNCHANGED (this file isn't wired into `BattleScene`/`main.ts` yet — by
  design, since 12.1 was scoped as the pure headless prerequisite only).
- **Not built:** anything past 12.1 — no Firestore, no session/lobby, no
  `BattleScene` wiring. That's 12.2 onward, per the design doc's own
  proposed roadmap. This module is independently useful even if Phase 12
  doesn't continue (e.g. a future mid-battle autosave).

## Phase 12 — Cooperative Multiplayer Feasibility (D-100) — DESIGN DOC ONLY, previous session

Phase 14's handoff left three open candidates for what's next; asked
directly, Kevin chose to scope Phase 12 (multiplayer), which
`SOURCE_OF_TRUTH.md` itself frames as a feasibility question, not a
commitment to ship. Asked what this session should produce, Kevin chose a
design doc first (not a prototype) and a client-authoritative state model
(Firestore rules, no Cloud Functions/Blaze plan). See **D-100** in
`DECISIONS.md` and the new **`PHASE_12_MULTIPLAYER_FEASIBILITY.md`** for
the full analysis.

- **No code shipped this section** — this is a design/feasibility
  artifact. Tests remain **648/648**, 91 modules, unchanged.
- **Key finding:** Phase 11.4's per-hero `controlledBy: "human" | "ai"`
  field and `HeroAISystem` generalize to a third `"remote"` value —
  co-op ownership isn't a new system, it's one more value on an existing
  one.
- **Key risk found:** Phase 13.1's real dice rolls mean two clients can't
  independently recompute the same combat outcome. Resolution: broadcast
  the RESULT of an acting client's roll, never recompute it elsewhere — no
  changes needed to `CombatSystem`/`RandomService`.
- **Biggest unscoped unknown:** serializing a full LIVE battle state
  (`SaveSystem` only ever covers run-boundary saves, not this).
- A four-part sub-phase roadmap (12.1 snapshot, 12.2 session/lobby, 12.3
  turn-lock/result-broadcast, 12.4 reconnect/version handling) is proposed
  but **not started**.
- **Not built:** any of it. Whether to proceed is Kevin's call at a future
  session.

## Phase 14.2 — A Second, Original Subclass for Every Class, Plus a Real Choice UI (D-099, with a D-098 correction) — DONE this session

Kevin asked for more subclass options and specifically whether real D&D
content could be used with attribution — researched directly against the
actual SRD 5.1/5.2.1 documents rather than assumed. Confirmed: both license
exactly ONE subclass per class; there is no more free content to add. That
research also caught a real mistake from the prior Phase 14 chat — Druid's
subclass was recorded as Circle of the Moon, never actually SRD content —
corrected to the real one, Circle of the Land (D-098). With the SRD
confirmed exhausted, every class gets a second, ORIGINAL subclass instead,
plus the real choice UI needed to pick between two options (D-099). See
**D-098**/**D-099** in `DECISIONS.md` for full notes.

- **Fixed: Circle of the Moon → Circle of the Land.** Natural Recovery is
  now mechanically active too (Short-Rest spell-slot refill, same shape as
  Warlock's Pact Magic) — found while fixing the bug, not scope creep.
- **A second, original subclass for all twelve classes**: Path of the
  Ironhide (Barbarian), College of the Blade (Bard), Zeal Domain (Cleric),
  Circle of the Ashen Veil (Druid), Battle Tactician (Fighter), Way of the
  Iron Body (Monk), Oath of Retribution (Paladin), Beastbond Warden
  (Ranger), Shadowblade (Rogue), Wildsurge Origin (Sorcerer), Starbound
  Patron (Warlock), Spellblade Tradition (Wizard) — each with exactly one
  real hookup (flat to-hit/AC/HP/smite/heal bonus, or a one-shot
  first-hit bonus), reusing only existing systems; one honestly-inert
  feature apiece for texture.
- **A real subclass-choice UI, not just data.** `BattleScene`'s in-battle
  overlay now shows one button per modeled subclass (was hardcoded to the
  first); `CharacterCreationScene` gains a new Subclass row (a cycle
  button) so Cleric/Sorcerer/Warlock builds pick between their two options
  at creation — the whole point of "options" being a real player choice.
- `Hero.draconicResilienceBonus` generalized to `subclassHpPerLevelBonus`,
  now shared by three subclasses instead of being Draconic-specific.
- Tests: 617 → **648** (+31: `tests/subclasses.test.ts` re-expanded to all
  24 subclasses; new `tests/classLeveling.test.ts` cases for all twelve new
  hookups). Typecheck/build clean (91 modules, unchanged — no new files).
  `npm run dev` serves HTTP 200 (checked this session). Not yet confirmed
  by a human in a browser — see KNOWN_ISSUES **KI-061**.
- **Not built:** a third subclass per class (a future slice); every other
  new feature stays exactly as inert as `data/subclasses.ts` documents.

## Phase 14 — Subclass Roster Expansion: A Modeled Subclass for Every Class (D-097) — DONE this session

Phase 13 (13.1–13.11) is complete, and Kevin is between playtesting
sessions with no time for an in-browser pass right now — he asked for
whatever the next useful step is in the meantime. Of the three candidates
13.11's handoff named (Phase 12 multiplayer, the still-open Phase 7 balance
pass, or new subclass content), this one is the only one that doesn't need
a browser or a new round of scoping questions to make real progress: pure
data plus the choice/confirmation seams 13.11 already built for exactly
this. See **D-097** in `DECISIONS.md` for full notes.

- **A modeled subclass for all eight classes that had none** (`data/
  subclasses.ts`): Path of the Berserker (Barbarian), College of Lore
  (Bard), Circle of the Moon (Druid), Way of the Open Hand (Monk), Oath of
  Devotion (Paladin), Hunter (Ranger), Draconic Bloodline (Sorcerer), The
  Fiend (Warlock) — all twelve classes now have exactly one modeled
  subclass, same "honest, first pass" treatment D-076/D-096 gave the
  original four.
- **Three more real mechanical hookups**, same bar as Champion/Life Domain:
  Draconic Resilience (+1 max HP/Sorcerer level — `Hero
  .draconicResilienceBonus`, folded into `effectiveMaxHealth`), Colossus
  Slayer (bonus damage on the Hunter's own Hunter's Mark target — `Hero
  .colossusSlayerBonus`, extends `BattleScene.applyHuntersMarkBonus`), and
  Dark One's Blessing (a flat self-heal on a killing blow — `Hero
  .darkOnesBlessingHeal`, new `BattleScene.applyDarkOnesBlessing`). Every
  other new feature across all eight subclasses stays honestly inert, each
  with its own specific documented reason.
- Sorcerer/Warlock (level-1 subclass choices) now auto-assign at creation
  like Cleric; Barbarian/Bard/Monk/Paladin/Ranger (level 3) and Druid
  (level 2) use the existing in-battle confirmation overlay — zero changes
  to 13.11's own choice/confirmation machinery.
- Tests: 596 → **617** (+21: `tests/subclasses.test.ts` expanded to all
  twelve classes; new `tests/classLeveling.test.ts` cases for the three new
  hookups). Typecheck/build clean (91 modules, unchanged — no new files).
  `npm run dev` serves HTTP 200 (checked this session). Not yet confirmed by
  a human in a browser — see KNOWN_ISSUES **KI-060**.
- **Not built:** subclass alternatives (still one per class); every other
  new feature stays exactly as inert as `data/subclasses.ts` documents.

## Phase 13.11 — Character-Creation Flow Overhaul: Real Subclass Choice, Free Starting Gear (D-096) — eleventh and FINAL sub-phase of Phase 13, DONE this session

**Phase 13 (Full D&D Character-System Depth) is now COMPLETE — all eleven
sub-phases (13.1 through 13.11) shipped.**

Three scoping questions asked before any code, all answered toward the
fuller option. See **D-096** in `DECISIONS.md` for full notes.

- **Subclass choice is real for the first time.** All four modeled
  subclasses (Champion/School of Evocation/Thief/Life Domain, D-076) had
  never once been assigned to anyone since Phase 11.3 — every character
  stayed level 1, and only Cleric's choice lands at level 1. Now: a
  level-1-choice class (Cleric) auto-assigns its subclass at creation
  (`CharacterBuildSystem.subclassIdForNewBuild`); a later-choice class
  (Fighter@3/Wizard@2/Rogue@3) gets a real, queued confirmation overlay in
  battle the first time `Hero.levelUpClass()` reaches it (reusing the ASI
  overlay's own rendering/queue plumbing). `CharacterClassDefinition
  .subclassChoiceLevel` (new field, all twelve classes) is the one place
  this level now lives, queryable instead of matched off a feature name.
- **Two subclass features actually wired up**, found by re-auditing every
  inert reason in `data/subclasses.ts` against everything 13.1-13.10 built:
  **Champion's Improved/Superior Critical** (crit range widens to 19-20,
  then 18-20 — `CombatSystem.AttackProfile.critThreshold`, `Hero
  .critThreshold`, wired only into a hero's basic Attack, matching the
  SRD's own "weapon attack" scope) and **Life Domain's Disciple of
  Life/Blessed Healer** (bonus healing on Cure Wounds — `Hero
  .discipleOfLifeBonus`/`.blessedHealerBonus`, applied in `BattleScene
  .castHealSpellOn`). Several other features had their STALE inert-reasons
  corrected in place (e.g. Thief's Fast Hands no longer blames "no bonus
  action," which has been untrue since 13.2) without becoming active.
- **A free starting-gear pick at creation**: one common/uncommon item
  (never 13.9's five rare-and-up additions), granted straight into its
  matching gear slot before the first battle, no gold spent
  (`STARTING_GEAR_IDS`, `HeroDefinition/CharacterBuild.startingEquipmentId`,
  applied in `Hero`'s constructor). `CharacterCreationScene` gains a new
  Gear row per hero slot; the stats-preview block gains a third line naming
  a level-1-choice class's real subclass, or the level a later-choice
  class's confirmation will appear at (honestly flagged "(not yet built)"
  for the eight classes with no modeled subclass yet).
- Tests: 569 → **596** (+27: subclass/crit/heal-bonus coverage across
  `classLeveling`/`combat`/`subclasses` test files, plus new
  `characterCreationData`/`characterBuildSystem`/`equipment` cases).
  Typecheck/build clean (91 modules, unchanged). `npm run dev` serves HTTP
  200 (checked this chat). Not yet confirmed by a human in a browser — see
  KNOWN_ISSUES **KI-059**.
- **Not built:** new subclass alternatives (still one per class, per
  D-076's "first pass" framing); the eight classes with no modeled subclass
  yet stay unbuilt; Life Domain's Channel Divinity: Preserve Life stays
  inert (would need real AoE-ally-heal targeting, a new system, not a
  wiring job); a full 5e starting-equipment PACKAGE (weapon+armor+pack
  choices) beyond one free item.

## Phase 13.10 — Enemy Roster Expansion: Every Tier, Full Role Tagging, First Real Enemy Mechanic (D-095) — tenth sub-phase of Phase 13, DONE previous session

One scoping question asked before any code: give at least one new enemy a
real special-attack mechanic, or stay flat stat variants like every enemy
built so far (12 of them, across Phases 3/7/11.6, none using
`EnemyDefinition.abilities`)? Kevin chose the real mechanic — scoped to a
save-forcing attack (reusing 13.5's dice/saving-throw infrastructure), NOT
a new hero-status-effect system (an enemy inflicting Slowed/Stunned/Burning
on a hero would need much bigger new plumbing this game doesn't have yet).
See **D-095** in `DECISIONS.md` for full notes.

- **Four new enemies, one per real gap**: Marauder (minion, a flat
  glass-cannon stat variant), Blightcaller (minion — this roster's FIRST
  real special attack: forces a saving throw instead of a to-hit roll),
  Gravemaw (a second miniboss — there was only ever one, basalt-colossus),
  Blightmother (a third true boss, sharing Blightcaller's forced-save
  attack at a harder DC and heavier damage).
- **New mechanic, minimal new surface**: `EnemyDefinition
  .savingThrowAttackDC` (optional — absent means a normal to-hit roll,
  unchanged); `Combatant.savingThrowBonus` (optional, `CombatSystem.ts`)
  and `Hero.savingThrowBonus` (new getter — real SRD DEX-save math for a
  D&D-built hero, a flat default for the classic roster);
  `WaveSystem.resolveSavingThrowAttack` (reuses `SavingThrowSystem`,
  repackaged into a normal `AttackResult` so `BattleScene`'s render path
  needs zero changes).
- **Full role tagging**: every pre-13.10 minion now carries an explicit
  `role: "minion"` (previously implicit/omitted).
- **A real, pre-existing gap fixed along the way**: `BattleScene`'s
  miniboss visual treatment (bigger token, gold outline, name banner)
  checked ONLY `role === "miniboss"` — Cinderlord/Tidelord (`role:
  "boss"`, added in 11.6) had silently never gotten it since the day they
  were added. Both tiers now qualify; the banner text distinguishes
  "(Miniboss)" from "(Boss)".
- **Free Play integration** (avoiding dead scaffolding): Marauder/
  Blightcaller join `EXPANDED_MINIONS`; Gravemaw/Blightmother join
  `BOSS_OPTIONS` with `unlockCampaignId: null` (always available, since
  neither has a campaign of its own yet). This grew the boss-picker row
  from 3 to 5 buttons — `FreePlayScene.buildOptionRow`'s button width is
  now COMPUTED instead of a hardcoded 380px, so it can't overflow
  `GAME_WIDTH` as the roster grows further.
- Tests: 554 → **569** (+15: new `tests/enemyRoster.test.ts` [8], 3 new
  `combat.test.ts` cases exercising the save-based attack through
  `WaveSystem`, 4 new `classLeveling.test.ts` cases for
  `Hero.savingThrowBonus`, 1 `campaign.test.ts` assertion updated for the
  new miniboss/boss counts). Typecheck/build clean (91 modules,
  unchanged). `npm run dev` serves HTTP 200. Not yet confirmed by a human
  in a browser — see KNOWN_ISSUES **KI-058**.
- **13.11 (character-creation flow overhaul) shipped in a later session —
  see its section above.** Phase 13 as a whole is now COMPLETE.

## Phase 13.9 — Loot/Equipment Expansion: Rarity, Attunement, Real Procs (D-094) — ninth sub-phase of Phase 13, DONE previous session

Three scoping questions asked before any code, all answered toward the more
ambitious option: a real five-tier rarity ladder, a real D&D-style
attunement cap (3 items), and all four requested proc kinds built this
batch (status-effect, saving-throw-resisted, ally-targeting, per-class
conditional). See **D-094** in `DECISIONS.md` for full notes.

- **Rarity (`data/equipment.ts`)**: `EquipmentRarity` (common/uncommon/rare/
  veryRare/legendary). The 12 Phase-11.5 items are retro-tagged common/
  uncommon by their existing, UNCHANGED power level. Five new items fill
  rare through legendary, one demonstrating each proc kind plus a legendary
  flat-bonus item: Ring of Frostbite, Amulet of Withering, Signet of
  Kinship, Greaves of the Berserker, Aegis of the First Ward.
- **Attunement**: a real cap of 3 attuned items at once, gated entirely at
  EQUIP time (`Hero.wouldExceedAttunementLimit`) rather than tracked as a
  separate "worn but inert" state — `Hero.attunedItemIds` is a derived
  getter, never stored, so it can never fall out of sync with
  `equippedItems`. `BattleScene.equipGearOnHero` refuses an over-cap equip
  before any gold changes hands.
- **Real on-hit/on-kill procs (`EquipmentProc`)**, resolved by
  `BattleScene.applyEquipmentProcs` against the same `AttackResult` a basic
  Attack action already produces — mirrors Divine Smite/Hunter's Mark
  (D-093)'s exact shape and scope (basic Attack only): `onHitStatus`
  (unconditional status application), `onHitSaveOrDamage` (a real saving
  throw via `SavingThrowSystem`), `onKillHealNearestAlly` (heals the
  nearest other living ally on a kill), `onHitWhileResistant` (bonus
  damage while `Hero.hasDamageResistance` — Rage/Wild Shape).
- Gear grid labels now show a rarity tag above "common"; `CompendiumScene`'s
  equipment tab shows rarity, attunement, and proc descriptions.
- Tests: 544 → **554** (+10, all in `tests/equipment.test.ts`). Typecheck/
  build clean (91 modules, unchanged). `npm run dev` serves HTTP 200. Not
  yet confirmed by a human in a browser — see KNOWN_ISSUES **KI-057**.
- **Not built yet at the time:** 13.10-13.11. 13.10 (enemy roster expansion)
  shipped in a later session — see its section above.

## Phase 13.8 — The Remaining Eight Core SRD Classes (D-093) — eighth sub-phase of Phase 13, DONE previous session

Kevin rejected the earlier "one flashy hook, everything else inert" pattern
outright: "I hated that when it was implemented. I want it to be much more
true to the real DnD classes." Given a choice between reusing only
already-built systems versus building each class's real iconic mechanic
even where that needs something new, he chose the latter. The four new
spellcasters (Bard, Druid, Sorcerer, Warlock) got real spellcasting wired
in immediately, like Wizard/Cleric. No new subclasses this round. See
**D-093** in `DECISIONS.md` for full notes.

- **All twelve core classes now exist**: `data/classes.ts` gains Barbarian,
  Bard, Druid, Monk, Paladin, Ranger, Sorcerer, and Warlock, each a full,
  accurate level 1-20 feature table (Paladin/Ranger are real half-casters —
  spells from level 2, no cantrips, via a new `HALF_CASTER_SPELL_SLOTS_BY_LEVEL`).
- **Every class got its real, playable signature mechanic** — not just one
  showcase feature with the rest waved off as "no system exists":
  Barbarian's Rage (bonus-action damage resistance + bonus damage, timed,
  limited uses per Long Rest); Druid's Wild Shape (level 2+, the same
  resistance buff plus a heal); Monk's Martial Arts (DEX-based melee) and
  Ki/Flurry of Blows (level 2+, a bonus action for another attack); Bard's
  Bardic Inspiration (an auto-targeted ally attack/damage buff, upgrading
  to Short-Rest recharge at level 5 via Font of Inspiration); Paladin's
  Divine Smite (auto-spends a spell slot on a landed melee hit); Ranger's
  Hunter's Mark (auto-marks an enemy for bonus damage on hit); Sorcerer's
  Metamagic: Quickened Spell (casts using the bonus action instead of the
  main action, freeing the action for a basic attack); Warlock's Pact
  Magic (spell slots restore on a Short Rest, the SRD's real distinctive
  cadence — simplified to share the full-caster slot table otherwise, per
  Kevin's own scoping call).
- `CharacterSystem.combatStatsForClassLevel`'s Monk branch: melee attacks
  now scale off Dexterity instead of Strength.
- `BattleScene.isCasterHero` now checks "has a non-empty known-spell list"
  rather than "has ANY spellcasting data" — Paladin/Ranger have a real
  half-caster slot economy (for Divine Smite/Hunter's Mark) but must NOT
  show an empty spellbook menu in place of their fixed signature ability.
- Tests: 514 → **544** (+30: new `tests/newCoreClasses.test.ts`, plus
  updated `characterCreationData`/`characterSystem`/`spells` cases).
  Typecheck/build clean (91 modules, unchanged). `npm run dev` serves HTTP
  200. Not yet confirmed by a human in a browser — see KNOWN_ISSUES
  **KI-056**.
- **Not built yet at the time:** 13.9-13.11. 13.9 (loot expansion) shipped in
  a later session — see its section above. No new subclasses for these eight
  classes (a deliberate, separately-named future item, not a gap).

## Phase 13.7 — Real Spell Depth: Spellbook, Spell Slots, Ally Healing (D-092) — seventh sub-phase of Phase 13, DONE previous session

Kevin rejected the "one fixed signature action" pattern outright: a caster
should choose ANY known spell as their action via a real spellbook, not
just the one ability picked at character creation. Upcasting was named as a
real future goal but not required this chat. Two further questions asked
directly: build ally-targeting for Cure Wounds too (Kevin: yes), and build
Concentration as framework-only since nothing needs it yet (Kevin: yes).
See **D-092** in `DECISIONS.md` for full notes.

- **Two new leveled-spell abilities**: `magic-missile` (Wizard) and
  `cure-wounds` (Cleric, this game's first ally-targeted effect) — both now
  carry a real `abilityId` and cost a 1st-level spell slot.
- **`Hero` gains a real spell-slot economy**: `spellSlotsRemaining`,
  restored only by a Long Rest (a Short Rest does not refill it), plus
  `knownSpellAbilityIds()` — every cantrip a class knows PLUS its castable
  leveled spells, not just the one signature action chosen at creation.
- **Bug found and fixed**: `SpellcastingSystem.spellSlotsForClassAtLevel`
  returned a live reference into shared class data instead of a copy —
  every Wizard/Cleric would have silently shared and depleted the SAME
  slots array. Caught by the new tests, fixed to return a fresh array.
- **New `BattleScene` spellbook overlay**: a caster's "Ability (Q)" button
  now opens a spell-picker instead of casting one fixed ability; a
  non-caster (Fighter/Rogue, classic roster) is completely unaffected.
- **New `ConcentrationSystem.ts`** (framework-only, per Kevin's choice):
  built and tested, genuinely uncalled outside its own tests — same
  treatment as `InitiativeSystem` (D-090).
- Tests: 492 → **514** (+22). Typecheck/build clean (91 modules, up from
  90). `npm run dev` serves HTTP 200. Not yet confirmed by a human in a
  browser — see KNOWN_ISSUES **KI-055**.
- **Not built yet:** 13.8-13.11. See `PHASE_HANDOFF.md`.

## Phase 13.6 — Real Ability-Score-Improvement-or-Feat Choice (D-091) — sixth sub-phase of Phase 13, DONE previous session

13.3 (D-089) already gave a D&D-built hero a real class level to reach an
ASI at; this chat wires the choice itself in. Two scoping questions asked
directly: how the ASI should split its +2 (Kevin chose the full 5e rule —
+2 one ability, or +1 two), and whether Lucky (stale-inert since its
"diceless combat" justification no longer holds after 13.1) should get a
real hookup now (Kevin chose yes). See **D-091** in `DECISIONS.md` for full
notes.

- **`CharacterSystem.asiFeatureGrantedAtLevel`** (new): detects an
  ASI-granting level generically across all four class tables (handles the
  Fighter's two bonus ASIs at 6/14 with no per-class hardcoding).
- **Every "Ability Score Improvement" feature (23 entries across all four
  classes) flips to `mechanicallyActive: true`**.
- **`Hero.improveAbilityScore`** (new): raises one ability score in place
  (capped at 20), recomputing derived combat numbers via the same formula
  `levelUpClass` uses.
- **`Hero.grantFeat`/`featIds`** (new): Tough's HP bonus now folds into
  `effectiveMaxHealth`, scaling with class level.
- **Lucky is now mechanically active**: a 3-point reroll pool
  (`canUseLucky`/`spendLuckyPoint`/`luckyPointsAvailable`), auto-spent as
  Advantage on a hero's basic attack (no interrupt-prompt UI exists, same
  precedent as Uncanny Dodge), recharging only on a Long Rest.
- **New `BattleScene` overlay**: a per-hero ASI-or-feat choice, queued after
  any wave-clear level-up that grants one, before the Rest choice — path
  choice, mode choice, an ability picker, and a feat picker, all rendered by
  one shared step-agnostic helper.
- Tests: 475 → **492** (+17). Typecheck/build clean (90 modules, unchanged).
  `npm run dev` serves HTTP 200. Not yet confirmed by a human in a browser —
  see KNOWN_ISSUES **KI-054**.
- **Not built yet:** 13.7 spell depth, 13.8-13.11. See `PHASE_HANDOFF.md`.

## Phase 13.5 — Saving Throws, Skills, Framework-Only InitiativeSystem (D-090) — fifth sub-phase of Phase 13, DONE previous session

D-086 already scoped `InitiativeSystem` as framework-only (built, tested,
never called by `TurnSystem`/`BattleScene`). This chat's one real scoping
question was whether saving throws should get the same purely-computable
treatment, or one real gameplay hookup — Kevin chose a real hookup. See
**D-090** in `DECISIONS.md` for full notes.

- **`CharacterSystem.savingThrowBonus`/`spellSaveDC`** (new): the SRD
  saving-throw and spell-save-DC formulas, built on the existing
  `savingThrowProficiencies` class data (authored since Phase 11.1, never
  mechanically read until now).
- **New `systems/SavingThrowSystem.ts`**: `rollSave`/`applySaveOrDamage`,
  mirroring `CombatSystem`'s dice shape (nat 20 auto-succeeds, nat 1
  auto-fails, per SRD 5.2.1's general d20-test rule).
- **New `systems/InitiativeSystem.ts`**: `rollInitiative` — entity-agnostic,
  genuinely unused outside its own tests (D-086's explicit "framework only"
  ask; nothing in `BattleScene` calls it).
- **New `data/skills.ts`**: a slim 8-skill reference list, one helper
  (`skillModifier`), no proficiency concept — nothing in this game calls a
  skill check.
- **Real hookup: Sacred Flame** (Cleric cantrip) converted from `autoHit`
  (always hits) to a real DEX saving throw against the caster's
  `Hero.spellSaveDC` — a miss is now possible, resolved through a new
  `BattleScene.castSavingThrowAbilityOn`. `EnemyDefinition`/`Enemy` gain a
  flat `savingThrowBonus` (mirrors `attackBonus`) so an enemy has something
  to roll against.
- New Compendium "Skills" tab (reference-only, same treatment as Feats).
- Tests: 448 → **475** (+27: new `savingThrowSystem`/`initiativeSystem`/
  `skills` suites plus new `characterSystem`/`classLeveling` cases).
  Typecheck/build clean (90 modules, up from 88). `npm run dev` serves HTTP
  200. Not yet confirmed by a human in a browser — see KNOWN_ISSUES
  **KI-053**.
- **13.6 (real ASI-or-feat choice) and 13.7 (real spell depth) shipped in
  later sessions — see their sections above.** Not built yet: 13.8-13.11.
  See `PHASE_HANDOFF.md`.

## Phase 13.3 — Real Per-Class Leveling + Extra Attack (D-089) — third sub-phase of Phase 13, DONE previous session

Built after 13.4 (Kevin's own ordering — see the 13.4 handoff). Replaces the
flat wave-based Vigor/Might choice with real D&D leveling, but ONLY for a
D&D-built party (`classId` set); the classic fixed roster keeps Vigor/Might
unchanged (it has no ability scores/class table to level from). A battle is
always either the classic roster or a classId party, never mixed. See
**D-089** in `DECISIONS.md` for the two scoping questions asked (leveling
scope, and whether to build real Extra Attack now) and full implementation
notes.

- **`CharacterSystem.combatStatsForClassLevel`** (new): the class-level-
  dependent combat math (`maxHealth`/`attackDamage`/`attackBonus`/
  `attacksPerAction`), factored out of `CharacterBuildSystem
  .heroDefinitionFromBuild` (which only ever used it for level 1) so
  `Hero.levelUpClass()` can reuse the identical formula at any later level.
- **`Hero.level`/`Hero.attacksPerAction`/`Hero.levelUpClass()`** (new): a
  classId hero advances one class level per call, REPLACING (not adding to)
  `maxHealth`/`attackDamage`/`attackBonus`/`attacksPerAction`; HP gained is
  added to current health immediately (SRD rule, not a full heal). No-op
  without `classId`/`abilityScores`, or past the level 20 cap.
- **`BattleScene.afterWaveCleared`** branches on whether the party is
  classId-based: such a party auto-levels every living hero with no overlay
  (there's no choice — ASI stays deferred to 13.6), logging
  "`<Hero>` reaches level `<N>`!" per hero; the classic roster's Vigor/Might
  overlay is completely untouched. The HUD status line now shows "Lv `<N>`"
  after a classId hero's name.
- **Real Extra Attack:** a Fighter with `attacksPerAction` > 1 (from level
  5: 2 attacks; level 11: 3; level 20: 4) now actually resolves that many
  independent attacks against the same clicked target when using the Attack
  action, each logged on its own line. Wizard/Rogue/Cleric never rise above
  1 attack.
- Tests: 434 → **448** (+14: new `tests/classLeveling.test.ts` [8] plus new
  `combatStatsForClassLevel`/`abilityScores`-passthrough cases). Typecheck/
  build clean (88 modules, unchanged). `npm run dev` serves HTTP 200. Not
  yet confirmed by a human in a browser — see KNOWN_ISSUES **KI-052**.
- **13.5 (saving throws/skills/initiative), 13.6 (real ASI-or-feat choice),
  and 13.7 (real spell depth) shipped in later sessions — see their
  sections above.** Not built yet: 13.8-13.11. See `PHASE_HANDOFF.md`.

## Phase 13.4 — Rest System (D-088) — fourth sub-phase of Phase 13, DONE previous session

Kevin chose to do 13.4 before 13.3, specifically to replace 13.2's "once per
BATTLE" Second Wind/Action Surge placeholder with the real thing before more
gets built on top of it. See **D-088** in `DECISIONS.md` for the one
scoping question asked (whether a Short Rest should heal any HP, given this
game has no Hit Dice) and full implementation notes.

- **New `systems/RestSystem.ts`**: a per-run pool of Short/Long Rest charges.
  Pure bookkeeping (`canTakeShortRest`/`canTakeLongRest`,
  `takeShortRest`/`takeLongRest`) — the actual per-hero effects live on
  `Hero` (new `shortRest`/`longRest` methods), same split as
  `ProgressionSystem.applyChoice`.
- **Short Rest:** recharges Second Wind/Action Surge (Fighter) and heals a
  flat 25% of the hero's own max HP (Kevin's call — a stand-in for
  spending a Hit Die, so every hero gets something real from resting, not
  just a Fighter's rest-gated resources). **Long Rest:** the same recharge
  plus a full heal.
- **`difficulty.ts`** gains `shortRestCharges`/`longRestCharges` per tier
  (Easy 4/2, Normal 3/1, Hard 2/1, Nightmare 1/0 — untuned first pass,
  scaling down with difficulty like the existing enemy multipliers). The
  classic START roster resolves to Normal's budget (3 Short/1 Long).
- **New opt-in "Rest before the next wave?" overlay** in `BattleScene`,
  chained in right after any pending level-up choice resolves. Skipped
  entirely when no charge remains, and after the FINAL wave clears
  (nothing to rest "before").
- Tests: 421 → **434** (+13: new `tests/restSystem.test.ts` [10] plus 3
  `difficulty.test.ts` cases). Typecheck/build clean (88 modules, up from
  87). `npm run dev` serves HTTP 200. Not yet confirmed by a human in a
  browser — see KNOWN_ISSUES **KI-051**.
- **13.3 (real per-class leveling), 13.5 (saving throws/skills/initiative),
  13.6 (real ASI-or-feat choice), and 13.7 (real spell depth) shipped in
  later sessions — see their sections above.** Not built yet: 13.8-13.11.
  See `PHASE_HANDOFF.md`.

## Phase 13.2 — Action Economy, first slice (D-087) — second sub-phase of Phase 13, DONE previous session

Continues the Phase 13 arc kicked off by 13.1 (dice/AC). Adds a bonus-action
slot to `Hero` and wires the four class-gated features `classes.ts` already
recorded, inert, since Phase 11.1-11.3: **Second Wind + Action Surge**
(Fighter) and **Cunning Action's Dash + Uncanny Dodge** (Rogue). See
**D-087** in `DECISIONS.md` for the three scoping decisions Kevin made
before any code and the full implementation notes.

- **`HeroDefinition`/`Hero` gain a minimal `classId?: string`** — NOT the
  full race/class/level identity that's 13.3's job, just enough for these
  four features to know which hero qualifies. Set by
  `CharacterBuildSystem.heroDefinitionFromBuild`; absent for the classic
  fixed roster (Ash/Wren/Bram/Mira) and for Wizard/Cleric builds (neither
  class has an action-economy feature yet), so only a D&D-built Fighter or
  Rogue can ever use any of this.
- **Second Wind (Fighter):** bonus-action self-heal, flat `+6` HP
  (untuned placeholder). **Action Surge (Fighter):** un-consumes the action
  slot for a genuine second action. Both capped at **once per BATTLE**
  (not the SRD's "once per rest") since there's no Rest system yet (that's
  13.4) — an explicit, commented placeholder Kevin approved rather than
  guessing a rest cadence himself before 13.4's real design pass.
- **Cunning Action, Dash only (Rogue):** un-consumes the move slot for a
  genuine second move, spending the bonus action — no once-per-battle limit
  (matches the SRD). **Uncanny Dodge (Rogue):** halves one hit's damage,
  auto-applied (no interrupt-prompt UI exists — Kevin's call) the instant
  the enemy phase resolves, before the combat log/HP text render.
- New HUD row in `BattleScene`: "Bonus Action" (Second Wind or Cunning
  Action, whichever the selected hero's class grants) and "Action Surge"
  buttons, new keybinds R/F, gated the same way Ability/Potion already are.
- Tests: 398 → **421** (+23: new `tests/actionEconomy.test.ts` [21] plus 2
  `characterBuildSystem.test.ts` cases). Typecheck/build clean (87 modules,
  unchanged). `npm run dev` serves HTTP 200. Not yet confirmed by a human in
  a browser — see KNOWN_ISSUES **KI-050**.
- **Not built yet:** 13.3 real per-class leveling, 13.4 rest system (which
  should replace both once-per-battle placeholders above), 13.5 saving
  throws/skills/initiative, 13.6-13.11. See `PHASE_HANDOFF.md`.

## Phase 13.1 — Dice Core + Armor Class (D-086) — first sub-phase of Phase 13, DONE previous session

Phase 11's roadmap (11.1-11.10) is complete, but Kevin's actual vision is
bigger: real D&D-5e character depth — every core class, a full action
economy, real dice, deeper spells/loot, and a fuller enemy roster — scoped
as a new ten-part **Phase 13** roadmap (13.1-13.11), analogous to how D-071
broke down Phase 11. See **D-086** in `DECISIONS.md` for the full scope
decisions and this sub-phase's implementation notes.

- **Reverses two prior decisions, at Kevin's explicit request**: D-030
  (deterministic, diceless combat) and D-036 (RandomService deliberately
  deferred until a real consumer exists — this is that consumer).
- New `systems/RandomService.ts` (seedable mulberry32 PRNG, plus
  `RandomService.fixed()` as a deterministic test double).
- `CombatSystem` now rolls a d20 + `attackBonus` against a target's Armor
  Class (`Combatant.armorClass`, replacing `defense`) — natural 20 always
  hits and crits (double damage), natural 1 always misses. `autoHit`
  (renamed from `ignoreDefense`) skips the roll entirely for traps, terrain
  hazards, the burning tick, and two abilities (Piercing Shot, Sacred
  Flame) that already "always landed."
- Every enemy/equipment `defense` value converted to `armorClass`
  (enemies: `10 + old value`; equipment: unchanged, already a bonus) —
  first-pass and untuned, same as every other balance number in this
  project. Heroes/enemies gained a flat `attackBonus`; a D&D-built hero's
  is real SRD math (proficiency bonus + ability modifier).
- `BattleScene`'s combat log now distinguishes miss/hit/critical-hit/
  defeat; a miss no longer flashes the hit effect or applies a status.
- Tests: 391 → **398** (+7: new `randomService.test.ts`, plus a rewritten
  `combat.test.ts` dice-resolution suite). Typecheck/build clean (87
  modules, up from 86). `npm run dev` serves HTTP 200. Not yet confirmed
  by a human in a browser — see KNOWN_ISSUES **KI-049**.
- **Not built yet** (the rest of the Phase 13 roadmap, each its own
  sub-phase): 13.2 action economy, 13.3 real per-class leveling, 13.4 rest
  system, 13.5 saving throws/skills/initiative framework, 13.6 ASI-or-feat
  choice, 13.7 spell depth, 13.8 the remaining 8 core classes, 13.9 loot
  expansion, 13.10 enemy roster expansion, 13.11 character-creation
  overhaul. See `PHASE_HANDOFF.md` for the full roadmap and next steps.

## Phase 11.10 — Map Builder + Public Map Sharing (D-085) — first pass DONE this session

Closes out the Phase 11 roadmap (D-071): 11.1 through 11.10 are now all
built. Kevin asked to move ahead with 11.10 right after Phase 10's deploy
completed, rather than wait on the still-open in-browser verification
items elsewhere. Two scoping questions were answered before any code:
**sharing = cloud upload + browse** (a new PUBLIC Firestore collection,
not owner-scoped for reads like Phase 10's saves) and **the full
12-character tile palette from day one** (not a basic subset first).

- New pure systems: `MapBuilderSystem.ts` (paint/validate a draft map —
  dimensions, spawn/exit/hero-start counts, and a real route-to-exit check
  reusing `PathfindingSystem.hasRoute`, the same call `BuildSystem`
  already makes for wall placement) and `MapSharingSystem.ts` (the
  transform layer to/from `SharedMapRecord`, the Firestore document
  shape). `data/testMap.ts` gained `encodeMapRows` — the exact inverse of
  the existing `parseMapRows`.
- **A real, verified constraint, not an assumed one:** `BattleScene`
  renders every map at a FIXED `TILE_SIZE` inside a fixed-size canvas with
  a HUD stack below the board that doesn't scale with map size. Working
  through that layout's own bounding-box math (same technique as
  D-046/D-055) caps publishable maps at **6-20 columns, 6-9 rows** — 9
  rows is exactly what every existing map already uses; 10 would overflow
  the canvas outright.
- New `cloud/MapSharingSync.ts` (publish/browse/list-by-author, cursor-
  paginated) and a new `firestore.rules` `sharedMaps/{mapId}` block —
  public read, author-only write, an update can never change ownership.
  New rules-test cases written but still unrun (same standing JDK 21+
  constraint as Phase 10 — Kevin's IT policy blocks the install; not
  re-offered).
- New scenes `MapBuilderScene` (paint via a palette tab strip; Playtest
  and Publish both gated on the map actually validating) and
  `BrowseSharedMapsScene` (a fetched, paginated map list feeding the same
  wave-count/minion-source/difficulty pickers `FreePlayScene` already
  has). `BattleScene`/`CharacterCreationScene` gained one new passthrough
  field, `customMapData`, so a drafted or fetched map can be played
  WITHOUT going through the by-id `MAPS` registry.
- Main menu gained "Map Builder" (always shown — building/playtesting
  needs no Firebase) and "Browse Shared Maps" (Firebase-only), top-right
  corner, mirroring the existing Load Game/Account pair on the left.
- Tests: 370 → **385** (+15: `mapBuilder.test.ts` [12] + `mapSharing.test.ts`
  [3]). Typecheck/build clean (86 modules, up from 81). Verified BOTH with
  the real `.env` present and with it temporarily removed (the
  local-first fallback holds for this feature too). `npm run dev` serves
  HTTP 200. Not yet confirmed by a human in a browser — see
  KNOWN_ISSUES **KI-048**. See **D-085** in `DECISIONS.md` for full details.

## Phase 10 — Firebase Hosting, Authentication, and Cloud Saves (D-084) — DEPLOYED, live at https://dice-n-defenses.web.app

Built immediately after Phase 9 (D-083). Kevin answered two scoping
questions before any code: **anonymous auth by default with an optional
Google sign-in upgrade** (not anonymous-only, not a mandatory real
sign-in), and **deploy live this session** once working (with an explicit
go-ahead required right before the actual `firebase deploy`).

- New `src/game/cloud/` folder (`firebaseApp.ts`/`AuthClient.ts`/
  `CloudSaveSync.ts`) — a deliberate exception to the `systems/` split,
  since this is IO to an external service, not a game rule. Inert with no
  Firebase project configured (`firebaseReady` false) — verified with
  typecheck/tests/build all green and **no `.env` present**, proving the
  "local-first fallback" acceptance criterion actually holds.
- Cloud saves cover ONLY `SaveSystem`'s party-build slots (Phase 9) —
  Bestiary/Campaign progress stay local/global, unchanged, deliberately
  out of scope.
- Sync is checkpoint-triggered only (save/delete/an explicit "Sync with
  Cloud" click) — never continuous, directly satisfying the spec's "don't
  send every move/frame to Firestore" boundary.
- `firestore.rules` (owner-scoped + shape/size validation) and its
  emulator-backed test suite (`firestore-tests/rules.test.ts`,
  `npm run test:rules`) are written but **still not run** — the emulator
  needs a JDK 21+; a `winget` install was attempted and Kevin declined it
  (his IT policy blocks installing software on this machine without IT
  involvement), so this is a standing environment limitation, not just an
  unasked question. Rely on manual testing after deploy instead.
- **Kevin completed his Firebase console setup and the deploy has
  happened this session:** project `dice-n-defenses` created, Anonymous +
  Google sign-in enabled, Firestore created, `.env`/`.firebaserc` filled
  in correctly (verified matching), `firebase login` done
  (`kevinrbuth@gmail.com`). `npm run build` + `firebase deploy --only
  hosting,firestore:rules` both succeeded — **live at
  https://dice-n-defenses.web.app**. Note: the deploy log showed Firestore
  being created fresh at deploy time ("Creating the new Firestore database
  (default)") — worth Kevin double-checking the database's region/settings
  in the console match what he expected from Step 4.
- Tests: 368 → **370** (+2, `upsertSaveSlot`). Typecheck/build clean (81
  modules, up from 61). Bundle grew to ~2.3 MB after the Firebase SDK;
  `chunkSizeWarningLimit` raised accordingly (KI-005 updated) rather than
  code-split, since every scene is eagerly registered in `main.ts` anyway.
  Deployed, but the actual sign-in/sync UI flow is still not yet confirmed
  by a human in a browser — see KNOWN_ISSUES **KI-047**.

## Phase 9 — Local Save System (D-083) — first pass DONE this session

Per `SOURCE_OF_TRUTH.md`, unblocked now that D-070's freeform character
system (Phase 11.1-11.9) exists — D-072 had deliberately deferred Phase 9
until then. Kevin made three scoping calls before implementation: save
granularity is **between separate runs only** (not mid-battle/mid-wave — a
campaign run is one continuous multi-wave battle with no existing mid-run
checkpoint), **multiple named slots** (not one autosave slot), and
**export/import deferred** to pair better with Phase 10.

- New `SaveSystem.ts`: versioned (`version`/`CURRENT_SAVE_VERSION`),
  corrupt/incompatible-safe (bad JSON, a version mismatch, or an
  individually malformed slot all fail safe to empty rather than
  crashing), capped at `MAX_SAVE_SLOTS = 6` (no scrolling list UI exists
  anywhere in this project to page through more).
- What's actually saved: a **party build** (name/race/class/ability
  scores/signature ability/control-mode per hero, plus party size and
  difficulty) — the one thing `CharacterCreationScene` previously made the
  player redo from scratch every session. Campaign completion
  (`CampaignProgressSystem`) and the Bestiary (`BestiarySystem`) stay
  global/unslotted, untouched by this phase.
- New `LoadGameScene` (top-left "Load Game" button on the main menu) lists
  saves as cards with Load/Delete. `CharacterCreationScene` gained a "Save
  Party" button (new-or-update a slot) and silently re-saves an
  already-loaded/saved slot when Start Battle is pressed (the "safe
  autosave").
- **Explicit scope boundary:** a loaded save feeds the plain party-builder
  flow only — it does not yet plug into Campaign Select's or Free Play's
  own routes into Character Creation. Deferred, not an oversight.
- Tests: 354 → **368** (+14: `saveSystem.test.ts` [11] + 3
  `allocatorFromScores` cases). Typecheck/build clean (61 modules, up from
  59). `npm run dev` HTTP 200. Not yet confirmed by a human — see
  KNOWN_ISSUES **KI-046**.

## Phase 11 roadmap — COMPLETE (11.1 through 11.10 all built — see Phase 11.10 section above for the last one)

Kevin outlined a large long-term vision for the rest of the project — a
real D&D 5.5e character system (classes/subclasses, races, feats, spells,
magic items/potions) driving individual hero level-ups, a freeform party
builder, a bestiary, a map system overhaul, boss-themed campaigns, a
free-play mode, AI-controlled party members, an in-game rules index, a map
builder, and a full visual overhaul. This has been scoped as ten Phase 11
sub-phases (11.1–11.10) — see **D-070**/**D-071** in `DECISIONS.md` and the
repo-note under Phase 11 in `SOURCE_OF_TRUTH.md` for the full breakdown and
sequencing.

**Sub-phase 11.1 (D&D character rules engine + character-creation UI) —
DONE.** First slice: ability scores + modifiers, proficiency bonus by
level, and one fully-built class table (Fighter, levels 1–20), pure and
tested (`src/game/data/abilityScores.ts`, `src/game/data/classes.ts`,
`src/game/systems/CharacterSystem.ts` — see **D-072**). Second slice, this
chat: a working character-creation UI — a new `CharacterCreationScene`
reachable from the main menu's **"Create Party (new)"** button, where the
player builds a full 4-hero party (name, ability-score allocation via a
swap-cycle allocator, and a signature ability), with a live derived-stats
preview, before starting a battle with that custom roster — see **D-073**.
**Deliberately additive, not a replacement:** the original START button
still goes straight to `BattleScene` with the unchanged fixed 4-hero roster
(Ash/Wren/Bram/Mira) — with only one class and no new abilities yet, fully
replacing the roster now would be a real variety regression, and would put
Kevin's still-open browser-verification items at risk of needing rework.
Several Fighter features remain data-only/inert (`mechanicallyActive:
false`) until systems they depend on (action economy, saving throws,
subclasses, feats) exist.

**Sub-phase 11.2 (spellcasting engine + a second class) — DONE, this chat.**
Added **Wizard**: d6 hit die, INT casting, a full level 1-20 feature table,
and a real spell-slot/cantrips-known progression table
(`data/classes.ts`'s new `spellcasting` field). New pure engine,
`systems/SpellcastingSystem.ts` (known cantrips, spell slots by level,
prepared-spell count — see **D-074**). A curated 5-spell list lives in the
new `data/spells.ts`: two cantrips (Fire Bolt, Ray of Frost) are
mechanically playable today — cast at-will, no slot cost, so they need no
new resource system — via two new entries in `data/abilities.ts` that
`BattleScene` already knows how to read; three 1st-level spells (Magic
Missile, Burning Hands, Mage Armor) exist as real data but stay uncastable
until this game has a spell-slot economy. `CharacterCreationScene` gained a
class-cycle button so a hero can be built as either class; a Wizard's
cantrip attack now correctly scales off INT instead of STR/DEX. Kevin
confirmed the class-cycle button works in-browser (KI-038).

**Sub-phase 11.3 (starter class/race/feat roster) — DONE, this chat.** Two
further classes, **Rogue** (d8, DEX, Sneak Attack as a flat rider damage via
a new generic `bonusDamageByLevel` field) and **Cleric** (d8, WIS, subclass
choice at level 1 — earlier than every other class — reusing Wizard's entire
spellcasting engine and cantrips-known/spell-slot tables verbatim).
`CLASS_DEFINITIONS` is now four classes covering melee (Fighter),
ranged/skirmish (Rogue), ranged control (Wizard), and support (Cleric). All
six SRD starter races (`data/races.ts`): speed is the one mechanically
active trait — Dwarf/Halfling move one tile slower — resolving the exact
"race-based speed is Phase 11.3" TODO the code had flagged since 11.1. A
starter feat list (`data/feats.ts`: Tough, Alert, Lucky, Athlete) exists as
real, tested data but is deliberately NOT wired into any UI — no created
character can reach level 4 (where a feat would first be choosable) yet, so
a feat-picker would be dead scaffolding. See **D-075**.

**Subclass content — DONE (D-076).** One real, named subclass per class:
**Champion** (Fighter), **School of Evocation** (Wizard), **Thief** (Rogue),
**Life Domain** (Cleric) — see `data/subclasses.ts`. Every subclass feature
is honestly `mechanicallyActive: false`: none lands before its class's
subclass-choice level, and every created character is always level 1, so
nothing here is reachable yet regardless. Pure rules-engine data, no
scene/UI changes.

**Sub-phase 11.4 (party assembly + AI-controlled heroes) — DONE, this
chat.** Per D-071's roadmap: party size selection, human-vs-AI mix per
slot, a "human picks level-ups, AI plays" mode, and difficulty scaling by
party size — see **D-077**.
- `CharacterCreationScene` gained a per-hero Human/AI toggle (folded into
  the existing "Hero N" header), a Party Size selector (1-4, capped at
  today's four hero-start tiles — a true variable-size map is 11.7), and a
  Difficulty selector (Easy/Normal/Hard/Nightmare).
- New pure `HeroAISystem`: an AI-controlled hero's turn deliberately mirrors
  `WaveSystem`'s own enemy-phase choice (attack if something's in range,
  else advance toward the nearest enemy). `BattleScene.runAIHeroTurns()`
  runs it automatically at the start of each player phase, through the same
  action-resolution code a human's click already uses.
- New `data/difficulty.ts`: flat per-tier multipliers plus a party-size
  scaling factor (linear against the roster's balanced size of 4), combined
  in `WaveSystem`'s two new (optional, default-1) `enemyCountMultiplier`/
  `enemyHpMultiplier` options.
- The classic fixed-roster START button is untouched — it never reaches
  `CharacterCreationScene`, so it always plays at party-size-4/Normal
  exactly as before this phase. Not yet verified by a human — see
  KNOWN_ISSUES KI-040.

**Sub-phase 11.5 (multi-slot equipment, potions, and a Compendium) — DONE,
this chat.** Per D-071's roadmap: "equipment/magic items/potions expansion,
plus an in-game Compendium." Kevin was asked directly whether equipment
should stay one slot or grow to two — he asked for something bigger than
either: the classic RPG loadout (Head/Chest/Legs/2 Rings/Amulet/Footwear,
plus 2 General slots for potions), and confirmed adding potions. See
**D-078**.
- `data/equipment.ts` grew from a 3-item, 1-slot catalogue to 12 items
  across seven gear-slot instances (six slot types — both rings share
  `"ring"`); `Hero.equippedItems` sums bonuses across every filled slot.
  Still flat `attackDamage`/`defense` only — no dice/proc system exists yet
  for a "chance to X" magic item to hook into (D-047 addendum).
- `data/potions.ts` (new): two consumable general slots per hero. A potion
  spends the hero's ACTION — Healing Draught heals, Vigor Tonic gives a
  permanent-for-the-battle attack buff (reusing the same mechanism as a
  level-up Might choice).
- `BattleScene`'s Gear grid now shops equipment AND potions together (14
  items); equipping auto-places into the right slot instance. A new Potion
  (P) button drinks a carried potion. `GAME_HEIGHT` raised 1000 → 1080 (the
  Gear grid is now taller than the Shop grid).
- A new `CompendiumScene` (read-only, reached from a new MainMenuScene
  button) renders every existing Phase 11 data file — classes, subclasses,
  races, feats, spells, equipment, potions, status effects — across 8
  category tabs. Not yet verified by a human — see KNOWN_ISSUES KI-041.
  Next: any of 11.6–11.10, or returning to character-system depth.

**Sub-phases 11.6 through 11.9 — DONE, one long same-day session.** Kevin
asked to handle 11.6-11.9 as one batch; per D-071's own ordering these four
build on each other (roster before terrain, terrain before campaigns,
campaigns before free-play's unlock gating), so they were built and
verified sequentially rather than in parallel. **11.10 (map builder +
sharing) was deliberately SKIPPED this session** — Kevin confirmed when
asked directly — since D-071 says it depends on Phase 10 (Firebase
hosting), which hasn't started; a map builder with nothing to save/share
through would be dead scaffolding. See **D-081/D-082** for 11.7/11.9 (D-079/
D-080 for 11.6/11.8 were already logged the same session).

- **11.6 (roster + Bestiary, D-079):** two new minions (Hexer, Ravager) and
  a new `"boss"` role tier above miniboss, with two true bosses —
  **Cinderlord** (fire) and **Tidelord** (water), themed for 11.7/11.8.
  New `BestiarySystem` (localStorage SEEN/KILLED tracking) and a
  `BestiaryScene` (unseen enemies show as locked "???"). Not yet confirmed
  by a human — KI-042.
- **11.7 (map overhaul, D-081):** four new terrain types (`cliff`/`water`/
  `fire`/`acid` — cliff blocks ground/lets flyers cross for free; water/
  fire/acid reuse the existing "slowed"/"burning" statuses on enemies
  only, via the same trap-callback contract traps already used). Two new
  maps (Emberford Reach, Saltmere Shallows) with shop/treasure tiles.
  `BuildSystem` gained proximity-gated building (a hero must be within 3
  tiles) and a 3-structures-per-hero carry limit; the Gear/shop HUD is now
  locked unless a hero is near a shop tile (maps with none, i.e. `TEST_MAP`,
  stay ungated). Not yet confirmed by a human — KI-043.
- **11.8 (campaigns, D-080):** two boss-themed campaigns, **Emberford
  Reach** (6 waves, Cinderlord finale) and **Saltmere Shallows** (6 waves,
  Tidelord finale), assembled from 11.6's roster and 11.7's maps. New
  `CampaignProgressSystem` (completion persistence) and a
  `CampaignSelectScene`. The classic START path and `TEST_MAP`/`WAVES`
  stay completely untouched. Not yet confirmed by a human — KI-044.
- **11.9 (free-play, D-082):** a `FreePlayScene` config screen (map/boss/
  wave-count/minion-source/difficulty pickers) driving a new pure,
  deterministic `FreePlayWaveGenerator`. Unlock gating ties Emberford/
  Saltmere's map+boss options to having completed that campaign at least
  once; `TEST_MAP`/basalt-colossus are always available. Not yet confirmed
  by a human — KI-045.
- **Tests grew from 283 to 354** across the four sub-phases (11.6 +13,
  11.7 +31, 11.8 +20, 11.9 +7). Typecheck and build stayed clean after
  every sub-phase; `npm run dev` was not re-verified this session beyond
  the earlier phases' checks (no reason to expect it to have changed).

- **Current version:** 0.2.0-dev (Phase 7 content-complete; Phase 8 now
  underway — see below. Phase 7's balance/feel pass is still the one
  outstanding item from that phase and Phase 8's UX work doesn't depend on
  it, so Kevin chose to start Phase 8 in parallel rather than wait.)
- **Current phase:** Phase 11 (sub-phases 11.1 through 11.10, ALL DONE) is
  complete. **Phase 13 (Full D&D Character-System Depth) is COMPLETE —
  all eleven sub-phases shipped:** 13.1 (dice core + Armor Class, D-086),
  13.2 (action economy first slice, D-087), 13.4 (Rest system, D-088), 13.3
  (real per-class leveling + Extra Attack, D-089), 13.5 (saving throws/
  skills/framework-only initiative, D-090), 13.6 (real ASI-or-feat choice,
  D-091), 13.7 (real spell depth — spellbook/spell slots/ally healing,
  D-092), 13.8 (the remaining eight core SRD classes, each with a real
  iconic mechanic, D-093), 13.9 (loot/equipment expansion — rarity,
  attunement, real on-hit/on-kill procs, D-094), 13.10 (enemy roster
  expansion — every tier, full role tagging, first real enemy mechanic,
  D-095), and 13.11 (character-creation flow overhaul — real subclass
  choice, free starting gear, D-096). **Phase 14 (Subclass Roster
  Expansion) is now also DONE this session, in two parts:** 14 (D-097) gave
  every remaining class a modeled subclass plus three real hookups
  (Draconic Resilience, Colossus Slayer, Dark One's Blessing); 14.1 (D-098)
  corrected Druid's subclass to the real SRD one (Circle of the Land, not
  Circle of the Moon); 14.2 (D-099) gave every class a SECOND, original
  subclass plus a real multi-option choice UI. **Phase 12 (Cooperative
  Multiplayer Feasibility) kicked off as a DESIGN DOC ONLY (D-100)**, then
  **Phase 12.1 (`BattleStateSnapshot`, D-101)** shipped a pure, tested
  full-battle serialize/restore round trip, **Phase 12.2 (cooperative
  session lobby, D-102)** shipped create/join-by-code UI (this project's
  first free-text input), and **Phase 12.3 (turn-lock ownership, D-103)
  shipped this session** — `controlledBy: "remote"`, a host-only
  "Start Battle" handoff, and hero-selection ownership gating in
  `BattleScene`, with result-broadcast (live two-client board sync)
  explicitly deferred to a follow-up sub-phase. See this file's Phase
  12.3/12.2/12.1/Phase 12 sections above, `PHASE_12_MULTIPLAYER_FEASIBILITY.md`,
  and `PHASE_HANDOFF.md` for what's next.
  Phase 8 — UX, Accessibility, and Presentation — remains complete pending
  Kevin's browser pass. Delivered across two chats: settings (animation
  speed/reduced motion), partial keyboard hotkeys, tooltips,
  color-independent indicators, a tutorial overlay, an asset plan doc, and
  full keyboard-only play (D-066, resolves KI-030). Not yet done: volume
  controls are blocked on there being no audio system — KI-029 — and actual
  art production is a future call per `ASSET_PLAN.md`. Phase 7's in-browser
  balance pass (KI-015/KI-022/KI-028) remains open and unrelated to this
  work.
- **Last complete milestone:** Phase 6 — Integrated Five-Wave MVP (`v0.1.1`)
- **Stack:** TypeScript + Phaser 3 + Vite, tested with Vitest
- **Tests:** 648 passing (+31 this session for Phase 14.2's second original
  subclass per class and real choice UI — re-expanded `subclasses.test.ts`
  to all 24 subclasses plus new `classLeveling.test.ts` cases for all
  twelve new hookups; was 617 at the end of Phase 14, +21 for its subclass
  roster expansion — expanded `subclasses.test.ts` plus new
  `classLeveling.test.ts` cases for Draconic Resilience/Colossus
  Slayer/Dark One's Blessing; 596 at the end of Phase 13.11, +27 for its
  character-creation flow
  overhaul; 569 at the end of Phase 13.10, +15 for its enemy roster
  expansion; 554 at the end of Phase 13.9, +10 for its loot/equipment
  expansion; 544 at the end of Phase 13.8, +30 for its eight new classes;
  514 at the end of Phase 13.7, +22 for its real spell depth; 492 at the
  end of Phase 13.6, +17 for its real ASI-or-feat choice; 475 at the end of
  Phase 13.5, +27 for its saving throws/skills/initiative; 448 at the end
  of Phase 13.3, +14 for its real per-class leveling; 434 at the end of
  Phase 13.4, +13 for its Rest system; 421 at the end of Phase 13.2, +23
  for its action-economy slice; 398 at the end of Phase 13.1, +7 for its
  dice/AC systems; 385 at the end of Phase 11.10, +15 for that phase's map
  builder/sharing systems; 370 at the end of Phase 10, +2 for that phase's
  cloud save merge primitive; 368 at the end of Phase 9, +14 for that
  phase's local save system; 354 at the end of the 11.6-11.9 batch).
  Typecheck + build clean (91 modules, unchanged this session).
- **Last updated:** August 2, 2026 (Phase 14.2 / D-099)

## Loss condition and spawn-tile access updated (D-068, D-069)

Kevin reported a real playtest bug and requested a rule change, both fixed
this chat:
- **D-068 — the game now also ends in defeat if every hero falls**, even
  with Stronghold Integrity above 0 (previously the ONLY loss condition,
  D-034 — this is an explicit, Kevin-approved reversal of that LOCKED rule).
  The end screen distinguishes the two causes ("your party has fallen" vs.
  "the stronghold has fallen").
- **D-069 — the spawn ("In") tile is now fully inaccessible to heroes**
  (movement — building on it was already rejected). This was the root cause
  of a reported bug: a hero standing exactly on the spawn tile let a freshly
  spawned enemy land co-located with it and hold there indefinitely (it's
  immediately in attack range), which read as enemies "stacking" at the
  spawn point.

Not yet seen in a browser — see `KNOWN_ISSUES.md` KI-036.

## Movement rules updated (D-067): same-type units may pass through each other

Cross-cutting engine change, not tied to a specific phase: heroes may now walk
THROUGH a tile another living hero occupies, and enemies may now walk THROUGH
a tile another living enemy occupies — but in both cases, a unit may still
never END its move on a tile another unit of the same type already stands on.
Hero-vs-enemy blocking is unchanged (heroes still fully block enemy routing,
D-033; enemies still fully block hero movement). This replaces the
single-file "traffic jam" feel from D-018 (heroes) and D-045 (enemies) with a
"pass but don't stack" rule — a party can file past each other in a
one-tile-wide corridor, and a lane of enemies queued behind a stopped one can
now walk around/past it rather than backing up indefinitely. See D-067 in
`DECISIONS.md` for the full implementation notes and `tests/movement.test.ts`
/ `tests/enemyCollision.test.ts` for the new coverage. Not yet seen in a
browser — see `KNOWN_ISSUES.md` KI-035.

## Phase 7 progress

- **Done: flying enemies + their counter.** The engine now supports
  `movementType: "flying"` — a flyer routes over walls and barricades toward the
  exit, still confined to the map and still stopped by units (D-048). Traps are
  now movement-type aware (D-049): the **Spike Trap** hits ground only, and a
  new buyable **Sky Snare** catches flyers only — the anti-air answer a
  wall-proof enemy needs. See `tests/flying.test.ts`.
- **Done: expanded enemy roster (D-050).** Four new regular enemies, each built
  as the answer to one of the two heroes' tools — **Brute** (tanky, focus-fire),
  **Swarmling** (fragile pack, area damage / traps), **Warden** (armoured,
  Wren's pierce), **Razorwing** (tougher flyer, Sky Snare). Seven regular
  enemies now, all data-driven; no engine/scene changes.
- **Done: ten-wave campaign with a miniboss finale (D-051).** Waves 1–5 are the
  frozen v0.1.1 loop; waves 6–10 are new and layer the roster in one idea at a
  time, ending on the **Basalt Colossus** miniboss (a `role`-tagged data
  enemy). Proven coherent, winnable through the real build/spend loop, and
  losable-if-idle by `tests/campaign.test.ts` (+ the now-ten-wave
  `mvp-integration.test.ts`).
- **Resolved by Kevin (browser):** the KI-001 checklist — confirmed working;
  and the "Dice visibility" §9 decision — deterministic combat stays for now, a
  dice-based hit-chance system is later (D-047's clarification note).
- **Done (this chat): the rest of Phase 7's content list.**
  - **Heroes 2→4 (D-052):** Bram (guardian) and Mira (frostcaller), each with
    one spell-like, status-applying ability.
  - **More structures (D-054) + shop relayout (D-055):** Gate, Melee Platform,
    Ranged Perch, and the third trap (Tangle Root); the shop/Gear UI is now a
    generic, reusable item grid instead of 3 fixed slots.
  - **Status effects (D-053):** Slowed, Stunned, Burning — applied by two new
    hero abilities, one trap, and interpreted by `WaveSystem`.
  - **Level-up choices (D-056):** Vigor vs Might, every 2 waves cleared.
  - **Limited equipment (D-057):** one slot per hero, a 3-item catalogue.
  - **Spell-like abilities:** delivered via the status-applying abilities
    above (Taunting Slam, Frost Bolt) rather than a separate spell system.
  - **Improved wave preview & shop (D-058):** a "Next: Wave N — ..." line, and
    a `description` field on every structure/equipment item.
- **Still blocked on Kevin (browser):** real balance/feel tuning across ALL of
  the above — under the headless upper-bound sim the ten-wave campaign still
  clears with full integrity and ends gold-rich (same shape as the MVP), and
  the new content's numbers are first-pass, unverified by play
  (KI-015/KI-022/KI-028). This is genuinely blocked on a browser and is now the
  ONLY thing left in Phase 7. The miniboss also has **no distinct visual yet**
  (KI-023), and status effects have no on-token visual marker yet (KI-027) —
  both Phase 8 UX.

## Phase 8 progress

Kevin started Phase 8 mid-Phase-7-balance-pass, specifically asking for the
Gear/Build button overlap to be fixed along the way. Delivered this chat, all
in-scope except volume controls and actual art production:

- **Fixed: Gear button overlapped Build button (D-059).** A one-line
  x-position math bug; see KNOWN_ISSUES KI-032.
- **Done: settings — animation speed doubles as reduced motion (D-060).** One
  local setting (`SettingsSystem`, `tests/settings.test.ts`), cycled from a
  new main-menu button: Normal / Fast / Instant (Instant skips animation
  entirely). No volume control — there is no audio system to control yet
  (KI-029).
- **Done: keyboard support (D-061).** Number keys 1-4 select a hero by fixed
  roster position; H opens the new tutorial overlay; the ability button now
  labels its hotkey. Still pointer-only for tile movement/targeting and shop
  item selection (KI-030, stated honestly rather than implied complete).
- **Done: tooltips (D-062).** Hovering a Build/Gear item previews its
  description without needing to select it first.
- **Done: color-independent indicators (D-063) — resolves KI-023 and
  KI-027.** The miniboss is now larger with a name banner; active status
  effects show a persistent on-token badge; the build ghost and ability
  targets get glyphs, not just colour; low Integrity gets warning text.
- **Done: tutorial prompt (D-064).** A dismissible how-to-play overlay,
  shown once automatically and reopenable via H.
- **Done: original asset plan (D-065).** `ASSET_PLAN.md` — a plan, not
  production; art direction is still Kevin's call.
- **Not yet verified by a human:** none of the first Phase 8 chat's work has
  been seen in a browser (see KNOWN_ISSUES KI-031 for the specific
  checklist).
- **Done (this chat): full keyboard-only play (D-066) — resolves KI-030.**
  Arrow keys move a tile cursor across the board; Enter/Space act on
  whatever's focused (select/move/attack/aim/build/equip) via the same
  dispatch a mouse click already used. In Build/Gear mode, Tab switches
  arrow keys between navigating the item grid (a new focus ring) and the
  board cursor. A full battle should now be completable with no mouse.
  **Not yet verified by a human** — see KNOWN_ISSUES KI-034.
- **Still open, not part of this chat:** Phase 7's balance/feel pass
  (KI-015/KI-022/KI-028) is unrelated and still outstanding.

## What this is now

The first **complete, playable game loop**. From the title screen you start a
game, move and fight with two heroes, earn and spend gold to build a wall and a
trap that reroute and damage enemies, defend Stronghold Integrity across five
waves, reach a **win or lose** screen, and **restart**. Phase 6 added **no new
mechanics** — it integrated the Phase 0–5 systems into a whole and verified the
loop end to end.

## Implemented so far

- **Phase 0** — runnable Phaser+TS+Vite scaffold, strict TS, folder structure,
  scenes, `GridSystem`, npm scripts, docs.
- **Phase 1** — data-driven map, pure `GameMap`, grid prototype with hover /
  click-to-select / invalid-tile rejection.
- **Phase 2** — pure `TurnSystem` (phase state machine), pure `MovementSystem`,
  pure `Hero` (one move + one action); selection, range, path preview,
  confirm/cancel, End Turn.
- **Phase 3** — pure `PathfindingSystem` (route around walls), pure `WaveSystem`
  (scheduled spawns, advance, breach-once, completion/defeat), pure `Enemy`.
- **Phase 4** — pure `CombatSystem` (deterministic range/damage/targeting);
  hero attacks + one ability each; enemies fight back; victory reachable.
- **Phase 5** — pure `EconomySystem`, `BuildSystem` (placement + path-block
  rule), `RewardSystem`; a Barricade (wall) and Spike Trap; wall-aware routing;
  trap damage on the enemy phase; gold HUD, shop, ghost preview, refund.
- **Phase 6 (this phase)** — integration, verification, and polish:
  - Title-screen copy refreshed for the MVP (no longer a "test screen") with a
    short how-to-play line.
  - Explicit input-listener teardown on scene `shutdown`, so the
    menu→battle→menu→battle cycle can never accumulate duplicate listeners
    (belt-and-suspenders on top of Phaser's per-scene teardown and the full
    field reset already done in `create()`).
  - A headless **full-loop simulation** (`tests/mvp-integration.test.ts`) that
    drives all five real waves through every system: one run reaches **victory**
    with integrity intact, one does nothing and reaches **defeat**.
  - Version bumped to 0.1.0, then **0.1.1** after the playtest-fix round below.
    Tests now **101**.

## Playtest fixes (v0.1.1)

Kevin played the `v0.1.0` MVP and reported six observations. Two were confirmed
working as designed and left unchanged (see below); four were real bugs, now
fixed:

- **Enemies could stack on the same tile** (mid-lane and at the spawn point).
  Fixed: enemies now block each other when routing; a boxed-in enemy holds
  rather than overlaps; a blocked spawn retries next phase. (D-045)
- **An extra, empty turn was needed** when a hero's own attack/ability killed
  the last enemy of an already-fully-spawned wave. Fixed: the game now resolves
  to Victory/Between Waves immediately instead of waiting for a pointless Enemy
  Phase. (D-044)
- **No way to leave the victory/defeat screen** except an undiscoverable Esc
  shortcut. Fixed: added a real, clickable "Return to Menu" button. (D-047)
- **HUD text and buttons could overlap.** Fixed: taller canvas, status text and
  the combat log stacked vertically with word-wrap instead of side-by-side, and
  the Build/End Turn buttons anchored to the canvas edge instead of the grid's
  width. Verified with a bounding-box check against worst-case content strings
  (no browser available here). (D-046)

Left unchanged, by design, not bugs:
- **Enemies don't avoid traps** — intentional (D-039); that's the whole point
  of a trap.
- **Combat has no misses ("automatic hit")** — intentional (D-030), though this
  surfaced a real documentation inconsistency worth Kevin's attention: the
  Source of Truth's own rules table still lists "Dice visibility" as OPEN. See
  the clarification note under D-047 in `DECISIONS.md`.

## Acceptance criteria for Phase 6 — met

- **A clean install can play from start to win/lose.** The build/tests pass from
  a clean source copy, the dev server serves the game, and the integrated
  simulation demonstrates both a winning run (all ten waves cleared, integrity
  intact) and a losing run (integrity reaches 0). The one thing a machine can't
  do — confirm the on-screen feel — is left for Kevin's browser pass (KI-001).
- **Restart does not duplicate state or listeners.** `create()` resets every
  mutable field; all display/button listeners live on recreated Game Objects;
  pointer/keyboard listeners are removed on `shutdown` and there are no global
  listeners anywhere (audited — no `this.scale.on`/`window` handlers). See
  DECISIONS D-043.
- **Build and tests pass.** See Verified below.

## Basic balancing pass — done (finding: errs easy / gold-rich)

The balancing pass took the form of the simulation. Under *perfect* focus-fire
play the current numbers yield **0 breaches and ~191 surplus gold**, with every
wave earning the time bonus — the loop is winnable and losable, but tuning
currently leans easy and gold-rich. The gameplay numbers were deliberately left
**unchanged** for v0.1.0 (the simulation is an upper bound and can't set the
correct difficulty; only in-browser play can). In-browser tuning is the first
Phase 7 task — see KNOWN_ISSUES KI-015 and DECISIONS D-042.

## Verified

- `npm install` — pass (0 vulnerabilities)
- `npm run typecheck` — pass
- `npm test` — pass (101/101)
- `npm run build` — pass (creates `dist/`; 30 modules)
- `npm run dev` — pass (serves the page; HTTP 200)

## Not yet verified (needs a human in a browser)

On-screen rendering and *feel* of the whole loop, and the balance under real
(imperfect) play. Run `npm run dev`, click START, and walk the manual regression
checklist in `KNOWN_ISSUES.md` (KI-001) — especially: restart several times from
the win/lose screen using the new **Return to Menu** button and confirm nothing
doubles up (units, gold, listeners); confirm no HUD text/buttons visually
overlap (verified by bounding-box math here, not by eye); confirm enemies never
visibly stack; confirm a wave-clearing kill ends the wave immediately without an
extra End Turn click; and judge whether the difficulty/economy feel right
(KI-015).

## Explicitly NOT implemented yet (by design)

More heroes/enemies, flying, gates/platforms/perches and more traps, status
effects, level-ups, equipment (Phase 7); UX & accessibility (Phase 8); saving
(Phase 9); Firebase (Phase 10); campaign expansion (Phase 11); multiplayer
(Phase 12). Structure destruction (enemies attacking walls) remains OPEN —
enemies route around walls instead.
