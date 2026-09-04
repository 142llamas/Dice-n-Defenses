# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev, unchanged.
- **Date:** September 3-4, 2026.
- **Why this handoff is mid-batch, not at a natural stopping point**: Kevin
  gave a fresh 10-item numbered playtest-notes list this session. After
  shipping 4 of the larger items (D-228 through D-231, all verified,
  detailed below), he explicitly asked to hand the REST off to a new chat
  rather than continue in this one — **not** because anything is broken or
  blocked, purely a context-management choice. This file exists to make
  that handoff lossless. Read it fully before touching code.
- Tests: **1721** (was 1711 at the start of this session — 15 new, all in
  the new `tests/gearFilterSystem.test.ts`; `tests/newMapsPhase23.test.ts`
  had existing assertions updated, not added to, for the resized maps).
  Typecheck clean, all 1721 pass, production build succeeds (**158
  modules**, up from 157 — the new `GearFilterSystem.ts`).
- Next available: **D-232** / **KI-181**.

## Kevin's original 10-item list this session (verbatim intent, for reference)

1. Campaign combat trivially easy (one enemy at a time) → more simultaneous
   enemies + bigger maps (his own words: "at least 4 times the area").
2. Gear tab: word labels instead of icons — **his own words: "doesn't
   really matter right now"** until art is uploaded. Explicitly deferred,
   not started, not planned until art exists.
3. Consolidate Potion 1/Potion 2 into one filter; auto-place if either slot
   empty, compare-and-replace if both full.
4. Same for Rings.
5. Same for Right/Left hand, **plus an extra layer**: sub-filters within
   Hands for melee/ranged/spell-focus/shields (melee further broken down by
   weapon type/damage type), a 1H/2H distinguisher, a rarity sub-filter for
   ALL item types, and a magic-item visual indicator + filter.
6. Scrollable tables instead of pagination, everywhere **except the
   Compendium** (his explicit exception).
7. Is there a weapon-proficiency system? If so, auto-filter out items a
   class can't use (e.g. no spellcasting focus offered to a Barbarian).
8. Add missing spellcasting focus items: spellbook, staff, wand, crystal
   ball, holy symbol, etc.
9. Campaign victory screen was a dead end (only "back to Main Menu") — show
   mission stats, then route to mission select. Also reported: loading a
   campaign dropped him back before mission 1.
10. The recurring "start a 2nd game, all buttons stop working" bug —
    officially made part of the plan, reliably reproducible now.

## What shipped this session (D-228 through D-231) — items 1, 9, 10, and the BASE of 3/4/5

### D-228 — item 10, the freeze bug (KI-177)
Audited every `BattleScene` field against `create()`'s big reset block
(comment there literally explains why: Phaser reuses the same scene
instance across every battle). Found two groups never reset:
`movingIntoAttack` (gates `inputLocked()`, stuck `true` forever if a battle
ends/exits mid-move-then-attack-animation, since `Clock.shutdown()` drops a
pending `delayedCall` without running it) and the D-144 drag fields
(`dragArmedHeroId`/`heroDrag`/`dragPinMarks`, a secondary confirmed-but-
self-healing defect in the same family). Both added to the reset block.
**This is the strongest static lead after two full investigation rounds
(this session's + D-213's own prior one), but unconfirmed — no browser
here.** If Kevin still sees it, the very next step is DevTools console
output at the moment it happens (see KI-177's own checklist).

### D-229 — item 1, difficulty + bigger maps (KI-178)
Root cause: `WaveSystem.spawnDueEnemies` only ever spawns ONE enemy per
group per due tick (`count` just spreads spawns over time, not
simultaneity); campaign wave data never used `WaveSpawnGroup.spawnIndex`,
so everything funneled through spawn point 0. Fixed with pure data changes,
no engine change:
- Every campaign chapter's wave list (`data/campaigns.ts`) now spreads
  groups across a map's spawn points via `spawnIndex`, several sharing a
  `startTurn` for real same-turn simultaneity. Covers Emberford/Saltmere/
  Causeway/Cinderfall Rift/Frostbound Hollow/Drowning Vale (all 4 chapters
  + the flat finale-wave-list each) and the Prologue's 3 waves.
- Map size cap raised: `MapBuilderSystem.ts`'s `MAX_MAP_ROWS`/`MAX_MAP_COLS`
  32x14→40x18 (documented 40px "legibility floor" lowered to 32px, same
  formula, re-derived — see that file's own D-228 doc comment for the
  exact math). `firestore.rules` mirrors it.
- All 6 region maps resized to ~4x their original area. Emberford/Saltmere/
  Causeway hand-redesigned (Causeway kept its signature single-bridge-
  chokepoint mechanic, just bigger, with 4 spawn lanes instead of 2).
  Cinderfall Rift/Frostbound Hollow/Drowning Vale — each with a more
  delicate signature mechanic (3-lane bridge collapse / static flying-vs-
  ground ridge / cyclical flood zone) — were instead scaled by an EXACT
  2x-both-dimensions tile-doubling (preserves every wall/lane/
  `DynamicTerrainEvent` coordinate by construction), then had 1-2 extra
  spawn points hand-added.
- `PROLOGUE_MAP` deliberately NOT resized (a one-time level-1 intro
  doesn't need a sprawling first fight) — just gained a 2nd spawn point.
- **`NAMELESS_THRONE_MAP` (the capstone) deliberately NOT touched this
  session** — worth asking Kevin if his difficulty complaint extends there.
- `tests/newMapsPhase23.test.ts` updated (not just relaxed) for the new
  dimensions/spawn-exit counts — its `everySpawnCanReachAnExit`
  connectivity check still genuinely passes on every resized map.

### D-230 — item 9, victory screen + resume bug (KI-179)
Campaign VICTORY (not defeat, not Free Play) now shows a stats readout
(Waves Cleared/Turns Taken/Gold Earned/Heroes Leveled Up) and routes
"Continue"/Esc to `CampaignSelectScene` instead of `MainMenuScene` — new
`endOverlayDestination` field (added to the reset block, applying D-228's
own lesson immediately) keeps the button and Esc handler in agreement.
Separately, confirmed and fixed the actual resume bug: `LoadGameScene.
loadSlot()` was forwarding a save slot's stored `chapterIndex` verbatim
(stale the moment the player progresses further chapters via Campaign
Select's own "Continue" without re-saving that exact slot) — now
recomputes it via a new `resumeChapterIndexFor()`, mirroring
`CampaignSelectScene.nextChapterIndexFor` exactly.

### D-231 — the BASE of items 3/4/5, Potions/Rings/Hands consolidated (KI-180)
New pure, fully-unit-tested module `src/game/systems/GearFilterSystem.ts`:
- `decideSlotPairPlacement(occupantA, occupantB, slotA, slotB)` — generic
  symmetric pair (Potions, Rings): auto-place into whichever is empty,
  else `{kind: "compareAndReplace"}`.
- `decideHandsPlacement(itemId, weaponOccupantId, shieldOccupantId)` — the
  harder ASYMMETRIC case (Weapon/Shield): candidate slot(s) depend on the
  item via the existing `isItemEligibleForSlot` rule (a real shield only
  fits "shield," a non-Light weapon only fits "weapon," a Light melee
  weapon fits either). Does NOT itself enforce the 2H-weapon/shield grip
  conflict — `Hero.wouldConflictWithGrip` (already checked by
  `BattleScene.buyGearForHero`, which REJECTS rather than auto-clears in
  the Armory — confirmed by reading it) stays the single source of truth
  for that; this only decides which slot(s) to attempt.

Wired into **both** `GearShopScene.ts` (The Armory) and
`CharacterCreationScene.ts`'s gear picker (ring consolidation only there —
see "Deliberate scope decisions" below). Both physical paperdoll cells of a
consolidated pair highlight together; a new `targetSlot` field (Armory)
tracks which specific physical slot a pending buy/sell targets.

## Deliberate scope decisions made this session (flag these to Kevin, don't silently assume he agrees)

1. **Item 2 (icons) is untouched** — Kevin's own words say it doesn't
   matter yet. Don't start it without art existing or an explicit ask.
2. **Hands consolidation is Armory-only**, not in `CharacterCreationScene`'s
   gear picker. Reasoning: no purchase economy there to motivate
   consolidating (a click IS the equip action already), and Kevin's own
   "filter chips" phrasing in item 5 reads as Armory-specific. Ring
   consolidation WAS extended there (lower-risk, more directly analogous to
   the Armory's own symmetric-pair case). If Kevin wants Hands consolidated
   there too, it needs the same `decideHandsPlacement`-driven
   pending-pick-resolved-by-paperdoll-click pattern the Ring fix already
   uses in that file (see `pendingRingPick`/`isRingSlot` there for the
   template — Hands would need an equivalent `pendingHandsPick` since it's
   asymmetric).
3. **`NAMELESS_THRONE_MAP` not resized.**
4. **Map legibility floor lowered 40px→32px** to hit true ≥4x area (a real,
   accepted visual tradeoff with no art yet, not a free technical win) —
   flagged in D-229's own writeup, not silently decided.

## What's NOT started — the rest of the Armory batch (items 5's extra layer, 6, 7, 8)

This is genuinely the bulk of remaining scope. Read `DECISIONS.md` D-231
first (the just-shipped consolidation) since everything below builds
directly on its patterns (`SLOT_GROUP`/`isHandsFilter`/`pairSlotsFor`/
`decideHandsPlacement` in `GearShopScene.ts`, and the equivalent
`isRingSlot`/`pendingRingPick` pattern in `CharacterCreationScene.ts`).

### Item 5's extra layer — hand sub-filters, 1H/2H, rarity, magic indicator
Within the Armory's now-consolidated "Hands" tab, add category chips:
Melee/Ranged/Spell Focus/Shields. **Design call already made in the
originally-approved plan for this batch, worth keeping**: use
simple/martial (`WeaponCategory` — already in `data/weapons.ts`) as the
melee sub-breakdown axis rather than damage type, because it's the EXACT
axis item 7 (proficiency) also needs — one filter-chip set serves both
features, don't build two. Add a 1H/2H toggle off the existing
`isTwoHandedWeapon` (`equipment.ts`). Add a rarity filter using the
existing 5-tier `EquipmentRarity` ladder (`common`/`uncommon`/`rare`/
`veryRare`/`legendary`) — this one applies across EVERY slot tab, not just
Hands. Add a "magic only" toggle + a visual border on any non-"common"
catalog row (no "magic" boolean exists in the data today — non-common
rarity IS the signal; a small `isMagicItem(def)` helper is all that's
needed, `GearFilterSystem.ts` is the natural home for it).

Apply new filter state to `GearShopScene.buildCatalog`'s `eligibleIds`
computation (a pure `applyCatalogFilters()` in `GearFilterSystem.ts`,
unit-tested against fixture item lists, is the right shape — keep the UI
wiring in the scene, the filtering logic pure and testable).

### Item 6 — scrollable lists (everywhere except Compendium)
No scrollable-list widget exists anywhere in this codebase today (confirmed
by research this session) — every long list uses Prev/Next pagination.
Needs a new reusable helper:
- `src/game/systems/ScrollListMath.ts` (pure, unit-tested): clamp/scroll-
  into-view math only.
- `src/game/scenes/uiScrollList.ts` (Phaser glue, sits alongside
  `uiTheme.ts`): mouse-wheel scroll (`scene.input.on("wheel", ...)` with a
  manual bounds check — Phaser has no reliable per-object wheel hit-test),
  a clipping mask (`Graphics.createGeometryMask()`), a thin draggable
  scrollbar thumb. Non-virtualized (rebuild every row's objects on
  scroll/refresh, matching this codebase's existing "destroy and redraw
  everything" convention — catalog sizes are only in the tens, no
  performance concern).

Apply ONE consumer per piece (small, testable, in this order — smallest
blast radius first): `GearShopScene` catalog (`CATALOG_PAGE_SIZE`) →
`CharacterCreationScene` gear picker catalog (`pageSize = 6`) →
`BattleScene`'s in-battle shop grid (`ITEM_GRID_PAGE_SIZE`, plus its
keyboard/gamepad `gridFocusIndex` paging — `scrollRowIntoView` should
replace that page-jump math) → `BattleScene`'s spellbook picker
(`spellbookPage`) → `BestiaryScene.ts` (its own separate pagination from
Compendium). **`CompendiumScene.ts` stays paginated, unchanged — Kevin's
explicit exception.** `LoadGameScene`/`CompanionRosterScene` already show
everything with no pagination at all — nothing to do there.

### Item 7 — weapon proficiency (a genuinely new system)
**No proficiency system exists anywhere in this codebase today** (confirmed
by grep this session — only saving-throw proficiencies exist, with several
explicit "Inert — this game has no skill-proficiency system" comments in
`classes.ts`). This needs:
- **Real SRD 5.1 weapon-proficiency-per-class data, sourced during
  implementation — do not guess from memory.** This project has been
  burned before by unverified SRD claims (see the
  `feedback_verify_srd_content_dont_assume` memory — both SRD versions cap
  subclasses/feats differently than commonly assumed; the same discipline
  applies here). Several classes have NAMED weapon exceptions on top of a
  blanket simple/martial flag (e.g. Wizard/Sorcerer aren't "no martial
  weapons" — they get a specific short list: Dagger/Dart/Sling/Quarterstaff/
  Light Crossbow), not just two booleans.
- New `data/proficiencies.ts`: per-class `{simpleWeapons: boolean,
  martialWeapons: boolean, weaponExceptions?: string[], spellFociAllowed?:
  boolean}` (shape only — values need the real sourcing above).
- New pure `systems/ProficiencySystem.ts`: `isProficientWithHandsItem(
  classId, def)`.
- Catalog behavior: **fully hide** non-proficient items from the Hands tab
  (matches this project's OWN existing convention — campaign gear-point
  overspend items "simply don't appear in the list at all, not shown-but-
  disabled," confirmed in `CharacterCreationScene.refreshGearPicker`), with
  a one-line "(N hidden — not proficient)" footer rather than a toggle.
  This also naturally gates item 8's spell-focus items to actual casting
  classes once it exists.

### Item 8 — spellcasting focus items
**4 already exist** — `holy-symbol`, `arcane-focus`, `druidic-totem`,
`component-pouch` (`equipment.ts`, D-193) — Kevin doesn't realize this;
tell him. **They're currently typed `slot: "amulet"`, which is wrong** both
for SRD accuracy (real foci are hand-held) and for his own item-5 framing
(he lists "spell focuses" as a HANDS sub-filter). Retype to `slot:
"shield"` (off-hand) — **verified this session**: `Hero.
effectiveAttackDamage` explicitly EXCLUDES the `"weapon"` slot from its
flat attack-bonus loop (a real weapon replaces damage instead of adding to
it), so retyping to `"weapon"` would silently zero out these foci's
existing `+1 attackDamage`. `"shield"` has no such exclusion and is already
the generic off-hand slot. Add an explicit `itemKind: "focus"` tag (not
inferred) for the new Spell Focus sub-filter from item 5. Add new named
items — spellbook, staff, wand, crystal ball — as NEW catalog entries;
**check for name collisions first**: `magicItems.ts` already has an
UNRELATED "Wand of Magic Missile"/"Staff of Healing" (`chargedSpell`
mechanic, stays put) — use different display names (e.g. "Apprentice's
Wand," "Gnarled Staff," "Wizard's Spellbook," "Scrying Crystal").

## Commands verified

- `npm run typecheck` — clean, after every piece this session.
- `npm test -- --run` — **1721/1721** passing, after every piece.
- `npm run build` — production build succeeds, **158 modules** (up from
  157 — `GearFilterSystem.ts`).
- `npm run dev` was NOT separately re-verified this session (no scene
  structure/boot-path changes) — the last confirmed boot check was in a
  prior session; worth a quick HTTP check if anything about scene startup
  is touched next.

## Manual tests completed

None — no browser available in this environment. Every piece above is
scene-layer UI or gameplay-feel-dependent data, which per this project's
own architecture rule carries no automated coverage for the scene layer
itself. See `KNOWN_ISSUES.md` KI-177 through KI-180 for the full
click-through checklists, newest first.

## Known issues

- **KI-180** through **KI-177** (new this session) — not played yet; see
  checklists above/in `KNOWN_ISSUES.md`.
- **KI-176** through **KI-153** (prior sessions) — still need Kevin's
  confirmation, unchanged, still the oldest unconfirmed batch in the
  project (KI-153 is from the 2026-08-28 playtest batch).
- **KI-063** (Phase 12.3): still the standing limitation that two coop
  clients' boards don't converge as either acts — unaffected by this
  session, still open.

## Deferred items

- Item 2 (gear slot icons) — Kevin's own explicit "doesn't matter yet."
- Item 5's sub-filters/1H-2H/rarity/magic-indicator, item 6 (scrollable
  lists), item 7 (weapon proficiency), item 8 (spellcasting foci) — see the
  full section above. This is the primary remaining scope, not a vague
  backlog item.
- `NAMELESS_THRONE_MAP` resize — not asked for, flagged as a gap.
- Hands consolidation in `CharacterCreationScene` — deliberately skipped,
  see "Deliberate scope decisions" above.

## Next chat instructions

1. **Most likely next step**: continue the Armory batch in the order
   listed above (item 5's sub-filters first — it's the most natural
   continuation of D-231's already-shipped Hands consolidation and unlocks
   item 7's proficiency work sharing the same filter-chip axis). Re-read
   `DECISIONS.md` D-231 and the relevant chunk of `GearShopScene.ts`/
   `GearFilterSystem.ts` before writing any code — don't re-derive the
   `SLOT_GROUP`/`isHandsFilter` pattern from scratch, it's already there.
2. **Alternatively**, if Kevin has new playtest feedback on D-228 through
   D-231 by the time the next chat starts, that takes priority — check
   `KNOWN_ISSUES.md` KI-177 through KI-180 for whether he's annotated them
   with "-Confirmed" or a repro note directly (per this project's own
   convention, he records playtest findings there rather than in chat).
3. **If KI-177 (the freeze bug) recurs**: the next chat's job is narrower
   and more urgent than the Armory batch — get the DevTools console output
   from Kevin at the moment it happens. That's the one piece of
   information this session's static analysis couldn't get.
4. If a new engagement starts, give it its own `D-NNN`/`KI-NNN` (next
   available: **D-232**/**KI-181**).
5. Reminder for the standard workflow: Kevin manages Git via GitHub Desktop
   and deploys via GitHub Actions on push to `main` — none of this
   session's work is committed/deployed/confirmed yet, needs a push before
   Kevin can check any of it, including in a browser.

## Suggested git steps (not run here; use GitHub Desktop)

This session touched:
`src/game/scenes/BattleScene.ts` (D-228 reset-block fixes; D-230
`showEndScreen`/`endOverlayDestination`/`battleStartGold`),
`src/game/scenes/LoadGameScene.ts` (D-230),
`src/game/systems/MapBuilderSystem.ts` (D-229 size caps),
`firestore.rules` (D-229 size caps mirrored),
`src/game/data/emberfordMap.ts`, `saltmereMap.ts`, `causewayMap.ts`,
`cinderfallRiftMap.ts`, `frostboundHollowMap.ts`, `drowningValeMap.ts`,
`prologueMap.ts` (D-229, all resized/re-spawned),
`src/game/data/campaigns.ts` (D-229, every region + Prologue's wave data),
`tests/newMapsPhase23.test.ts` (D-229, assertions updated for new
dimensions), `src/game/scenes/GearShopScene.ts` (D-231),
`src/game/scenes/CharacterCreationScene.ts` (D-231),
`DECISIONS.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`,
this file (all updated).

**New files**: `src/game/systems/GearFilterSystem.ts`,
`tests/gearFilterSystem.test.ts`.

**Firebase-relevant change**: `firestore.rules` was edited (new map-size
bounds) — `.github/workflows/firebase-deploy.yml` already runs `firebase
deploy --only hosting,firestore:rules` on every push to `main`, so a normal
push covers this automatically, no extra manual step needed.

## Handoff package contents

- [x] Source files (see "Important files"/git steps above)
- [x] package.json / package-lock.json (unchanged)
- [x] README.md (unchanged)
- [x] DECISIONS.md (updated — D-228 through D-231 appended)
- [x] KNOWN_ISSUES.md (updated — KI-177 through KI-180 added)
- [x] CHANGELOG.md (updated — 4 new `[Unreleased]` sections, on top)
- [x] CONTENT_SOURCES.md (unchanged — no new named content this session;
      item 8's spellcasting foci, when built, WILL need an entry here)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PARTY_CREATION_OVERHAUL_PLAN.md (unchanged — that roadmap closed
      earlier)
- [x] PROJECT_STATUS.md (updated — one new combined section, on top)
- [x] PHASE_HANDOFF.md (this file, fully rewritten)
- [x] Tests: **1721** (was 1711 at the start of this session)
- [x] No node_modules, dist, secrets, or service-account credentials
