# Phase Handoff

## Version and phase
- **Version:** 0.2.0-dev. Phase 11 (11.1-11.10), Phase 13 (13.1-13.11),
  Phase 14 (all three parts), Phase 20 (D-111), and Phase 21 (D-112) are
  complete. Phase 12 (Cooperative Multiplayer Feasibility) still has no live
  board sync. **This session ran Phase 22 (D-113): a magic-item expansion**
  — a real SRD magic-item catalog, a `+1/+2/+3` enchant overlay, a
  brand-new loot-drop system, and a level-scaled shop.
- **Why this ran this session:** Kevin asked directly for "a more complete
  repertoire of items" (potions, `+1/+2/+3` weapon/armor/shield
  modifications, "lots of free access magic items"), explicitly asked for a
  research pass to check what's actually usable before inventing anything,
  asked for the Cape of Billowing by name with its own animation, and
  described a loot system in detail while explicitly inviting design input
  on it (drop odds by enemy tier, an occasional lucky drop, most enemies
  dropping nothing, curated campaign loot vs. random Free Play loot, and a
  shop gated by average party level). Before any code, three genuine
  architecture forks were surfaced and confirmed, all toward the fuller
  option:
  1. **The `+1/+2/+3` enchant model**: a real modifier OVERLAY on a mundane
     weapon/armor/shield (a synthesized `${baseId}+${level}` composite id)
     rather than a ~150-entry flat cross-product catalog.
  2. **The Cape of Billowing's visual**: a real, new Phaser `Graphics`
     tween/flutter effect trailing the wearer's token, rather than
     data-only.
  3. **Pacing**: keep building now — this is now the SIXTH consecutive
     content/mechanics phase (after Phases 17-21) to ship without a human
     playtest, and Kevin chose to proceed anyway, same pattern as every
     prior big batch.
- **Completed this session:**
  - **Research before code**: verified the real SRD 5.1 magic-item list is
    large (hundreds of named items across weapons/armor/shields at
    `+1/+2/+3`, potions, rings, cloaks, boots, bracers, rods, staffs,
    wands) via two independent SRD mirror sites, and separately confirmed
    "Cape of Billowing" is NOT SRD content — the real published item this
    evokes ("Cloak of Billowing") is Xanathar's Guide to Everything, not
    the free document. Built as ORIGINAL content instead — the same
    correction-precedent treatment Tough/Lucky/Athlete got after a real
    Phase 11.3 sourcing mistake (D-109).
  - **The `+1/+2/+3` enchant overlay** (`data/equipment.ts`): `EnchantLevel`
    (1/2/3), `enchantedItemId`/`parseEnchantedItemId`, and
    `getEquipmentDefinition` extended to synthesize a composite item's full
    definition on demand from its base item — only a `rarity: "common"`
    weapon, shield, or REAL-armor chest item is enchantable (the real SRD
    rule), and no attunement is required (also the real rule). Real armor
    folds the bonus into its own `baseAC` (zero `Hero.ts` change needed); a
    shield's bonus is a bigger flat `armorClass` (already summed
    generically); a weapon needed two small, genuinely new `Hero.ts`
    getters (`weaponEnchantBonus`, applied to both the attack roll AND the
    damage roll, since weapon damage is a dice-average calculation, not a
    flat field).
  - **A new gear slot, `"back"`** (the tenth slot instance) for
    cloaks/capes. Existing items (Traveler's Cloak, still in `"legs"`) were
    deliberately NOT migrated — no save-compatibility risk.
  - **Five new `EquipmentDefinition` fields**, each reused by 2+ items:
    `savingThrowBonus`, `movementBonusTiles`, `grantsStatusImmunity`
    (checked once, at the top of `Hero.applyStatus`), `rangedAttackBonus`/
    `rangedAttackDamage` (conditional on a ranged weapon equipped, mirroring
    the Archery feat's own shape), and `visualEffect` (currently just
    `"flowingCape"`).
  - **`data/magicItems.ts`** (new file): 14 real SRD-sourced free-access
    magic items (Ring/Cloak of Protection, Bracers of Defense, Stone of
    Good Luck, Ring of Resistance, Ring of Free Action, Periapt of Proof
    against Poison, Boots of Striding and Springing, Boots of Speed,
    Bracers of Archery, Robe of the Archmagi, and three named weapons —
    Flame Tongue, Frost Brand, Dagger of Venom, each reusing an existing
    mundane weapon's real stats with a proc layered on top) plus the
    original **Cape of Billowing** (common, "Back" slot, +1 AC,
    `visualEffect: "flowingCape"`) — 15 total.
  - **`data/potions.ts`**: a new `rarity` field on every potion (retro-
    tagging the original two `common`), and 8 new SRD-sourced potions
    across three new effect kinds — `movementBuff` (Potion of Speed,
    `Hero.grantHaste`, permanent for the rest of the battle), `resistanceBuff`
    (Potion of Resistance, `Hero.grantResistance` — reuses the EXACT
    `hasDamageResistance` halving Rage/Wild Shape already grant, via a new
    `permanentDamageResistance` flag that a rest never clears), and
    `cureAndHeal` (Restorative Ointment, `Hero.cureAllStatuses` + a heal).
    `isRaging`/`canUseRage`/`canUseWildShape` were deliberately changed to
    check the RAW `damageResistanceTurnsRemaining` counter instead of the
    now-broader `hasDamageResistance`, so a Resistance potion can never
    falsely block or imply an active Rage.
  - **`systems/LootSystem.ts`** (new file, pure and tested): drop chance
    and base rarity by `EnemyRole` (minion 12%/common, miniboss
    55%/uncommon, boss 90%/rare, legendary 100%/veryRare), a flat 12%
    chance to bump one tier higher (capped at legendary), then either a
    random NAMED catalog item at that rarity or a coin-flip chance to
    instead generate a random enchant-eligible mundane weapon/armor/shield
    at the matching enchant level. Two new `RandomService` methods
    (`rollPercent`/`rollIndex`) back every roll, `fixed()`-testable like
    every existing dice method.
  - **Campaign-curated vs. Free-Play-random loot, as one parameter, not two
    code paths**: `CampaignDefinition` gains an optional `lootPoolIds`
    (Emberford Reach: fire-themed; Saltmere Shallows: water-themed; every
    potion included in both since potions aren't thematic) passed to
    `rollLootDrop`'s `restrictToIds`, which falls back to the full pool if
    a restriction would strand a rarity tier with nothing in it. The
    classic 10-wave campaign and Free Play both pass nothing.
  - **Where a drop lands**: `BattleScene.grantLootDrop` auto-equips it into
    the first LIVING hero with a matching, attunement-legal, grip-legal
    open slot, or auto-sells it for its listed gold cost if no hero can
    currently take it. No "found but not equipped" inventory/browsing UI
    this pass — a deliberate, documented scope boundary.
  - **A level-scaled shop** (`systems/ShopSystem.ts`, new file, pure and
    tested): `averagePartyLevel`/`isRarityUnlockedAtLevel` — common/
    uncommon items stay visible at every level; rare needs average level
    4+, veryRare 8+, legendary 13+. Applied UNIFORMLY to every rare-and-up
    item, including Phase 13.9's original five (a real, intentional
    behavior change for those — previously always purchasable).
  - **The flowing-cape visual** (`BattleScene`): this scene's first use of
    Phaser's per-frame `update()` lifecycle hook redraws a `Graphics`-based
    wavy shape trailing each capped hero's CURRENT token position, animated
    with a `Math.sin`-based flutter — chosen over hooking every hero-
    movement call site individually (there are several: AI turns, human
    move confirmation) since a per-frame redraw can never miss one.
    `ensureHeroCape` creates/destroys the graphic on every equip/unequip
    and at hero creation; hero death destroys it.
  - **A real, pre-existing test invariant corrected**: Phase 13.9's
    `equipment.test.ts` asserted "only rare-and-up items require
    attunement" — true of its own five items by CHOICE, never an SRD rule.
    Several new real SRD items (Cloak of Protection, etc.) genuinely
    require attunement at `uncommon`. Corrected to the invariant that DOES
    hold universally: no `common` item ever requires attunement.
  - Tests: 864 → **900** (+36: new `tests/lootSystem.test.ts` [10], new
    `tests/shopSystem.test.ts` [6], new Phase 22 sections in
    `tests/equipment.test.ts` [+10] and `tests/potions.test.ts` [+4], new
    `rollPercent`/`rollIndex` coverage in `tests/randomService.test.ts`
    [+5], a new `lootPoolIds` check in `tests/campaigns.test.ts` [+1], and
    the one corrected assertion above). Typecheck, all tests, and the
    production build all pass (104 modules, up from 101 — three new
    files). `npm run dev` serves HTTP 200 (checked this session).
- **What's NOT done, and why:** the in-browser feel/balance pass covering
  Phase 17 through 22 is STILL not done — this is now the SIXTH consecutive
  content/mechanics phase to ship without a human playtest (KI-065 through
  KI-070). No "found but not equipped" loot inventory/browsing UI exists —
  a drop is auto-equipped or auto-sold the instant it happens, a real,
  deliberate scope boundary, not a gap. No ability-score-setting magic item
  (Amulet of Health, Gauntlets of Ogre Power, Headband of Intellect, and
  the rest of that real SRD family) was added — this game's derived combat
  stats bake an ability modifier in at several different points, not
  always read live, making a live-override hook a real, separately-sized
  risk. No charge-based active item (wand/rod/staff) exists — no "limited
  uses independent of a class's own resource pools" item mechanic exists
  yet. Cloak of Displacement and Ioun Stones were deliberately left out
  (see D-113 for exactly why each). Enchanted `+1/+2/+3` gear is loot-only,
  not purchasable in the shop this pass.
- **Recommended next step:** **the in-browser feel/balance pass covering
  Phase 17-22** is the clear, strong recommendation — six consecutive
  content/mechanics phases (KI-065 through KI-070) have now shipped with
  zero human playtesting between them, and this phase in particular adds
  the project's first-ever Phaser `update()` lifecycle usage (the flowing
  cape) and a brand-new loot/reward flow that has never been seen fire in
  a real browser. There is no further "Phase 23 candidate" pre-scoped — if
  Kevin would rather keep building than playtest, the next chat should ask
  him directly what to build next rather than assuming or inventing scope.
- **Last complete milestone:** Phase 6 (`v0.1.1`); Phase 11 (11.1-11.10);
  Phase 13 (13.1-13.11); Phase 14 (all three parts); Phase 15 (D-104/D-105);
  Phase 16 (D-106/D-107); Phase 17 (D-108); Phase 18 (D-109); Phase 19
  (D-110); Phase 20 (D-111); Phase 21 (D-112); Phase 22 (D-113, this
  session). Phase 12 still has no live board sync.
- **Git branch:** no git in this environment; Kevin manages branching in
  GitHub Desktop. This session's changed files:
  `src/game/systems/RandomService.ts`, `src/game/data/equipment.ts`,
  `src/game/data/potions.ts`, `src/game/data/campaigns.ts`,
  `src/game/entities/Hero.ts`, `src/game/scenes/BattleScene.ts`; new files
  `src/game/data/magicItems.ts`, `src/game/systems/LootSystem.ts`,
  `src/game/systems/ShopSystem.ts`; new test files
  `tests/lootSystem.test.ts`, `tests/shopSystem.test.ts`; updated tests:
  `tests/equipment.test.ts`, `tests/potions.test.ts`,
  `tests/randomService.test.ts`, `tests/campaigns.test.ts`; docs
  (`CONTENT_SOURCES.md`, `DECISIONS.md`, `PROJECT_STATUS.md`,
  `CHANGELOG.md`, `KNOWN_ISSUES.md`, this file). No git commit/tag made
  here.
- **Date:** August 5, 2026

## Why this batch was chosen
Kevin described this exact batch himself, in detail, in a single message —
potions, `+1/+2/+3` gear, free-access magic items, the Cape of Billowing by
name, and a loot system he explicitly invited design input on. This
session's real judgment calls were the three scope-fork questions listed
above (all genuine architecture tradeoffs, not busywork), each answered
toward the fuller/more real option — consistent with Kevin's established
pattern on every prior scope fork this project has offered him — plus the
loot system's own concrete design (drop tables, tier-up odds, campaign
curation, the auto-equip-or-sell resolution), which this session had to
invent from scratch since Kevin asked for suggestions rather than
specifying every number.

## What works now
- Everything from every prior phase, unchanged in behavior for any hero/
  enemy/campaign that doesn't touch one of this session's new fields —
  every change this phase is purely ADDITIVE/opt-in, same as every prior
  content phase. In particular: every existing weapon/armor/shield/potion/
  magic item still behaves exactly as before; the classic fixed roster and
  every existing campaign/Free-Play flow are unaffected except for two
  INTENTIONAL, documented changes — the shop's new level gate (Phase 13.9's
  five rare-and-up items are no longer always purchasable) and enemies now
  sometimes dropping a real item on death (previously gold-only).
- **New: a real `+1/+2/+3` enchant overlay** for any mundane weapon,
  shield, or real-armor chest item.
- **New: 15 magic items**, reachable via loot drops, plus (for
  common/uncommon ones) the Gear shop and free starting-gear pool.
- **New: 8 potions**, reachable via loot drops and the Gear shop.
- **New: a loot-drop system** — most enemy kills do nothing extra, but a
  miniboss/boss/legendary kill (and, rarely, a lucky minion kill) drops a
  real item, auto-resolved onto the party.
- **New: a level-scaled shop** — the magic-item selection in the Gear grid
  grows as the party's average class level rises.
- **New: a flowing-cape visual** on any hero wearing the Cape of Billowing.

## What changed
- **Three new source files**: `data/magicItems.ts`, `systems/LootSystem.ts`,
  `systems/ShopSystem.ts`.
- **Edits**: see "Git branch" above for the full file list.
- **Docs**: `CONTENT_SOURCES.md` (four new rows plus a new narrative
  paragraph — the enchant concept, the 14 real SRD magic items, the potion
  rarity-tier rule, and the Cape of Billowing's NON-sourcing), `DECISIONS.md`
  (new D-113), `PROJECT_STATUS.md` (new Phase 22 section), `CHANGELOG.md`
  (new entry), `KNOWN_ISSUES.md` (new **KI-070**), this file (rewritten).

## Important files
- **`DECISIONS.md`'s D-113** — the full method: every scope-fork answer,
  the research findings (what's real SRD content, what isn't), the exact
  loot-drop design (odds, tier-up, campaign curation, resolution), and the
  full list of real SRD magic items deliberately NOT added and why.
- **`KNOWN_ISSUES.md`'s KI-070** — the full in-browser verification
  checklist (the flowing-cape visual, a `+N` item actually dropping, most
  enemies dropping nothing, the lucky tier-up drop, an item auto-selling
  when there's no room, campaign-vs-Free-Play loot feeling different, the
  shop's level gate, the new "Back" slot, and every new item's actual
  mechanic).
- **`src/game/data/equipment.ts`'s `enchantedItemId`/`parseEnchantedItemId`/
  `getEquipmentDefinition`** — the enchant overlay's whole mechanism.
  **`src/game/systems/LootSystem.ts`'s `rollLootDrop`** — the entire loot
  design in one function. **`src/game/scenes/BattleScene.ts`'s
  `grantLootDrop`/`ensureHeroCape`/`updateHeroCapes`/`visibleGearCatalog`**
  — where a drop lands, the cape visual, and the shop's level gate.

## Commands verified
- `npm run typecheck` — pass.
- `npm test` — pass, **900/900**.
- `npm run build` — pass, 104 modules (up from 101 — three new files).
- `npm run dev` — serves HTTP 200 (checked this session).

## Manual tests completed
**None** — same standing limitation as every content/mechanics phase, now
the SIXTH in a row (KI-065 through KI-070). This phase specifically
introduces the project's first-ever Phaser `update()` per-frame lifecycle
usage (the flowing cape) and an entirely new loot/reward flow, neither of
which has been seen run in a real browser. See KNOWN_ISSUES **KI-070** for
the full checklist.

## Known issues
- **KI-070** — this entire phase not yet confirmed by a human in a
  browser; full checklist listed there.
- **KI-069**/**KI-068**/**KI-067**/**KI-066**/**KI-065** — Phases 21/20/19/
  18/17, also still not yet confirmed in a browser (unrelated to this
  session specifically, but still open — SIX stacked, unplayed content/
  mechanics phases now).
- Unchanged: every other issue in `KNOWN_ISSUES.md` — none of those
  systems were touched this session.

## Deferred items
- **An in-browser feel/balance pass** covering Phase 17-22 together — by a
  very wide margin the highest-value next step at this point; see
  "Recommended next step" above.
- **A "found but not equipped" loot inventory/browsing UI** — this pass's
  auto-equip-or-sell resolution is a deliberate, documented simplification,
  not a stopgap; a future pass could add real player choice over where a
  drop goes.
- **Ability-score-setting magic items** (Amulet of Health, Gauntlets of
  Ogre Power, Headband of Intellect, Belt of Dwarvenkind/Giant Strength) —
  this game's derived combat stats bake an ability modifier in at several
  different points, not always read live; a live-override hook is a real,
  separately-sized piece of work, not a quick follow-up.
- **Any charge-based active item** (wand/rod/staff) — no "limited uses,
  independent of a class's own resource pools" item mechanic exists yet.
- **Cloak of Displacement** (needs a new "attacks against the wearer have
  disadvantage" hook) and **Ioun Stones** (would violate
  `effectiveMaxHealth`'s own "equipment does not affect max HP" invariant).
- **Enchanted `+1/+2/+3` gear is loot-only** — not purchasable in the shop
  this pass; a future pass could add a small, level-scaled rotating
  selection.
- Everything already deferred from earlier phases (Phase 12's
  result-broadcast/live sync, rules-test verification blocked on JDK 21+, a
  third subclass per class, map-draft resizing, platform bonuses on
  abilities, multiclassing, upcasting, ammunition tracking, per-class
  weapon-mastery gating, Strength-gated movement penalty for heavy armor,
  cross-run level persistence for Epic Boons, Skilled's skill-proficiency
  system, a player-facing Magic Initiate spell picker, a visual indicator
  for a Shielded enemy's remaining ward or a Multi-Phase Boss's phase
  change, an endless/infinite wave-generator mode) — untouched this
  session.

## Decisions made
- **D-113** — Phase 22, magic-item expansion: a real SRD magic-item
  catalog, a `+1/+2/+3` enchant overlay, a brand-new loot-drop system, and
  a level-scaled shop. See `DECISIONS.md` for the full method.

## Content or license additions
- **14 real SRD magic items and 4 rarity-tiered "Potion of Healing" entries
  plus 4 more named potions** (SRD 5.1, CC BY 4.0/OGL 1.0a) — see
  `CONTENT_SOURCES.md`'s new rows. The `+1/+2/+3` enchant CONCEPT is also
  real SRD content; the synthesis mechanism itself is original engineering.
- **The Cape of Billowing is explicitly NOT SRD content** — verified the
  real published item this evokes is Xanathar's Guide to Everything, not
  the free document, so it's logged as ORIGINAL, same as every other
  invented item this project has ever added.
- **The loot-drop system and the shop's level-gating rule are both entirely
  ORIGINAL engineering** — no SRD loot-table or shop-restocking rule is
  claimed; only the rarity tier NAMES they key off of are the already-
  logged Phase 13.9 SRD concept.

## Next chat instructions
1. **Strongly consider recommending the in-browser feel/balance pass**
   covering Phase 17-22 (KI-065 through KI-070, all still open) before
   building anything further — six consecutive content/mechanics phases
   have now shipped with zero human playtesting, and this phase in
   particular added the project's first Phaser `update()`-lifecycle visual
   and an entirely new loot/reward flow that has never been seen run.
2. **If Kevin wants to keep building instead**, there is NO pre-scoped
   "Phase 23 candidate" this time — ask him directly what's next rather
   than assuming or inventing new scope.
3. Boundaries unchanged from before this session, plus this session's own:
   no loot inventory/browsing UI (auto-equip-or-sell only), no ability-
   score-setting magic items, no charge-based wand/rod/staff item, no
   Cloak of Displacement or Ioun Stones, enchanted `+1/+2/+3` gear stays
   loot-only (not shop-purchasable).

## Suggested git steps (not run here; use GitHub Desktop)
1. This session's diff touches RandomService.ts/equipment.ts/potions.ts/
   campaigns.ts/Hero.ts/BattleScene.ts plus three new source files, two new
   test files, four updated test files, and docs — a large but mechanically
   coherent diff (one content/systems phase) — safe as its own commit, same
   as every prior phase.
2. Not deployed anywhere — this is all local/headless work, same as every
   prior data/content phase.

## Handoff package contents
- [x] Source files (see "What changed" above)
- [x] package.json / package-lock.json (unchanged — no new deps)
- [x] README.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new Phase 22 section)
- [x] DECISIONS.md (updated — new D-113)
- [x] KNOWN_ISSUES.md (updated — new KI-070)
- [x] CHANGELOG.md (updated — new entry)
- [x] CONTENT_SOURCES.md (updated — new Phase 22 rows/paragraph)
- [x] ASSET_PLAN.md (unchanged)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged — this session didn't
      touch Phase 12)
- [x] PHASE_HANDOFF.md (this file, rewritten)
- [x] Tests (900, +36 this session)
- [x] No node_modules, dist, secrets, or service-account credentials
