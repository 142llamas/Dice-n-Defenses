# Phase Handoff

## Version and phase

- **Version:** 0.2.0-dev. Every phase through Phase 25 (D-116) is complete;
  D-117 through D-126 (playtest fixes, campaign scaffolding, dialogue box,
  dialogue skip controls, the basic-attack lunge, spell-cast/death
  animations, the Main Menu/Compendium/Bestiary UI theme, an inert-class-
  feature batch, five more deferred slices, and a full UI-layout audit/fix)
  are complete. **This session ran D-127**: four foundational systems
  closing long-documented "no system to hook into yet" gaps, not a content/
  UI phase.
- **Why this ran this session:** Kevin was occupied running his first
  in-browser playtest pass in several sessions (confirming D-126's fixes and
  working through the long KI-065-through-KI-083 backlog) and asked, in the
  meantime, to close the four remaining architectural gaps documented across
  `KNOWN_ISSUES.md`'s KI-069/KI-070/KI-082: Swarm's real SRD damage
  resistance, Rogue's Blindsense/Ranger's Feral Senses, ability-score-setting
  magic items, and charge-based active items. Given the real risk flagged in
  this project's own prior notes (ability scores feed several different
  not-always-live `Hero` fields), this session used `EnterPlanMode`: an
  Explore agent plus direct file reads produced a concrete file-level plan
  before any code was written, sequencing the four systems by increasing
  risk and verifying (`typecheck`/`test`/`build`) after each one individually
  before starting the next.
- **Completed this session (D-127):**
  - **Nonmagical damage-type resistance**: research found this cheaper than
    the KI text implied — `data/weapons.ts` already has a populated
    `DamageType` field per weapon, just never consumed for resistance.
    `CombatSystem.AttackProfile` gained `damageType`/`magical`; `Combatant`
    gained `damageResistances`; a landed hit is halved (rounded down) when
    the target resists the type and the attack isn't `magical`. Rat Swarm/
    Locust Swarm (`data/enemies.ts`) get the real SRD B/P/S resistance;
    `Hero.attackDamageType`/`attackIsMagical` read the equipped weapon and
    an enchant level/Boon of Irresistible Offense respectively. Spell
    attacks never set a `damageType` at all, so they're never resisted —
    matches the SRD's "nonmagical" scope without touching all 318 spells.
  - **Rogue's Blindsense (14+) / Ranger's Feral Senses (18+)**:
    `BattleScene.isEnemyTargetable` gained an optional `observerHero`
    parameter — a hero with `Hero.hasStealthSense` within
    `STEALTH_SENSE_RANGE_TILES` (2) of a still-hidden stealth enemy can
    target it anyway, with zero effect on any other hero or the enemy AI.
    All 4 real call sites updated (one, the basic-attack click, needed its
    hero lookup reordered ahead of the targetability check). Both class
    features flip to `mechanicallyActive: true`. The enemy's own token still
    renders as an anonymous "?" to everyone, including the sensing hero —
    only click-targetability changed, not the visual (a materially bigger
    change not attempted here, recorded as a known limit).
  - **Charge-based items**: modeled directly on the existing Magic Initiate
    pattern (a granted spell + a per-rest use counter) rather than a new
    shape. `EquipmentDefinition.chargedSpell` grants a spell to ANY hero,
    even a non-caster; `Hero.itemChargesRemaining` is spent ahead of a
    normal spell-slot fallback and fully refills on a Long Rest only.
    `Hero.onGearChanged()` (new, called at every equip/unequip site
    alongside the existing `ensureHeroCape` call) initializes a newly-seen
    item's pool; charges persist across unequip/re-equip. Three real items
    ship: Wand of Magic Missile (7 charges), Wand of Web (6, attunement),
    Staff of Healing (10, attunement) — the spellbook overlay shows "N/M
    charges" for these instead of a spell-slot count.
  - **Ability-score-setting items**: the genuinely risky piece — no single
    seam previously read a hero's ability scores (`maxHealth`/`attackDamage`/
    `attackBonus` baked at 3 specific call sites; `baseArmorClass` `readonly`
    and never recomputed at all; `spellSaveDC`/`savingThrowBonus` already
    live). `Hero.effectiveAbilityScore`/`effectiveAbilityScores` (private)
    return the higher of the raw score and an active `abilityScoreOverrides`
    entry (the real SRD "sets to X, no effect if already higher" rule). The
    3 existing recompute call sites were deduplicated into
    `recomputeCombatStats` (reusing `applyLeveledStats`'s HP-delta math
    verbatim), which now reads the effective scores; a new
    `recomputeBaseArmorClass` fixes a related pre-existing gap as a side
    effect (a DEX ASI previously never raised AC without real armor
    equipped — it does now). `dexMod`/`strMod`/`spellSaveDC`/
    `savingThrowBonus`/`irresistibleOffenseBonusDamage` all switched to the
    effective score. `EquipmentDefinition.setsAbilityScore` drives it;
    `Hero.onGearChanged()` (shared with charge items) rebuilds the override
    map from scratch on every gear change. Three real items ship: Gauntlets
    of Ogre Power (STR 19), Headband of Intellect (INT 19), Amulet of Health
    (CON 19) — all uncommon/rare, requiring attunement. The ASI-picker's
    displayed ability score deliberately does NOT reflect an item override
    (shows the hero's true underlying score, matching the SRD's own framing).
  - Tests: **1147/1147** (up from 1130) — new blocks in `tests/combat.test.ts`
    (resistance, 5 cases), a new `tests/d127Features.test.ts` (stealth-sense
    level gating), and two new blocks in `tests/equipment.test.ts` (charge
    items, 4 cases; ability-score items, 4 cases). One pre-existing test
    (`characterSystem.test.ts`'s Rogue active-features enumeration) updated
    to include the newly-active Blindsense entry. Typecheck, all 1147 tests,
    and the production build all pass (115 modules, unchanged).
- **What's NOT done, and why:** `BattleScene`'s full HUD visual RESTYLE
  (carried forward since D-123) still hasn't happened — this session was
  pure systems/data work, no scene-layout code touched at all. The long
  in-browser confirmation backlog (KI-065 through KI-083) is Kevin's own
  in-progress work from this session, separate from D-127 entirely.
- **A real limitation of this environment, stated plainly:** every mechanic
  built this session was verified headless-only (typecheck/tests/build) —
  no browser is available here. See **KI-084** for the exact in-browser
  checklist, including the one genuinely hard-to-reach case (Boon of
  Irresistible Offense needs a level-19+ hero, same standing gap as KI-066).
- **Recommended next step:** whatever Kevin's own playtest pass was already
  working through (KI-065 through KI-083) — this session didn't interrupt
  that, it ran in parallel. Once he has time, KI-084's checklist (above) is
  the fastest way to confirm this session's four systems, roughly in this
  order: equip a Wand of Magic Missile on a non-caster (fastest, most
  visually obvious), then Gauntlets of Ogre Power, then a Swarm enemy fight,
  then Blindsense/Feral Senses (needs a level-14+/18+ hero, the slowest to
  reach).
- **Last complete milestone:** Phase 6 (`v0.1.1`) through Phase 25 (D-116);
  D-117 through D-126; D-127 (this session — four foundational systems, no
  new content/UI phase). Phase 12 still has no live board sync. `BattleScene`'s
  own visual restyle (carried forward from D-123) still has not started.
- **Git branch:** no git in this environment; Kevin manages branching in
  GitHub Desktop. This session's changed files: `src/game/systems/
  CombatSystem.ts`, `src/game/entities/Enemy.ts`, `src/game/entities/
  Hero.ts`, `src/game/data/enemies.ts`, `src/game/data/equipment.ts`,
  `src/game/data/magicItems.ts`, `src/game/data/classes.ts`, `src/game/
  scenes/BattleScene.ts`; new test file `tests/d127Features.test.ts`;
  existing test files `tests/combat.test.ts`, `tests/equipment.test.ts`,
  `tests/characterSystem.test.ts`; docs (`DECISIONS.md`, `PROJECT_STATUS.md`,
  `CHANGELOG.md`, `KNOWN_ISSUES.md`, `CONTENT_SOURCES.md`, this file). No
  git commit/tag made here.
- **Date:** August 14, 2026

## Why this batch was chosen

All four systems were already explicitly documented in `KNOWN_ISSUES.md` as
genuinely missing architecture (not stale wiring like most prior "inert
feature" batches) — Kevin asked to close them directly rather than picking a
new content/mechanics theme, specifically because he had time to playtest
and wanted headless-verifiable engine work to run in parallel with that,
rather than more content needing his own eyes to confirm. `EnterPlanMode`
was used given the real risk flagged in this project's own prior notes
around ability-score-derived stats — a concrete, file-level plan was written
and approved before any code changed.

## What works now

- Everything from every prior phase through D-126, unchanged — this session
  added new optional fields/methods and one small pre-existing-gap fix
  (`baseArmorClass` recompute); it did not remove or restructure any
  existing mechanic. A hero/enemy with none of the new items/features
  equipped or unlocked plays exactly as before this session.
- Damage-type resistance, Blindsense/Feral Senses, charge-based items, and
  ability-score-setting items are all real by the verified logic in D-127 —
  pending Kevin's own in-browser confirmation (KI-084).

## What changed

- **`src/game/systems/CombatSystem.ts`**: `AttackProfile` gained
  `damageType`/`magical`; `Combatant` gained `damageResistances`; a new
  private `applyResistance` halves a landed hit accordingly.
- **`src/game/entities/Enemy.ts`**: new `damageResistances` getter.
- **`src/game/data/enemies.ts`**: `EnemyDefinition` gained
  `damageResistances`; both Swarm enemies now carry the real B/P/S list.
- **`src/game/entities/Hero.ts`**: the biggest file touched — new getters
  (`attackDamageType`, `attackIsMagical`, `attacksIgnoreResistance`,
  `hasStealthSense`, `chargesRemainingFor`, `chargeInfoForSpell`,
  `effectiveAbilityScore`/`effectiveAbilityScores`), a new public
  `onGearChanged()`, new private helpers for charge-item and ability-score-
  override bookkeeping, `baseArmorClass` no longer `readonly`, the 3
  existing ability-score recompute call sites deduplicated into
  `recomputeCombatStats`, and `HeroSnapshot`/`toSnapshot`/
  `restoreMutableState` extended with `itemChargesRemaining`/
  `abilityScoreOverrides`.
- **`src/game/data/equipment.ts`**: `EquipmentDefinition` gained
  `chargedSpell`/`setsAbilityScore`.
- **`src/game/data/magicItems.ts`**: 6 new real SRD items (2 new families).
- **`src/game/data/classes.ts`**: Blindsense/Feral Senses flip to
  `mechanicallyActive: true` with updated descriptions.
- **`src/game/scenes/BattleScene.ts`**: `attackProfileFor` populates
  `damageType`/`magical`; `isEnemyTargetable` gained `observerHero`, all 4
  real call sites updated; `hero.onGearChanged()` called at every equip/
  unequip/loot-drop/battle-start site alongside the existing
  `ensureHeroCape` call; the spellbook overlay shows a charge count when
  relevant.
- **Tests**: `tests/combat.test.ts` (new resistance block), new
  `tests/d127Features.test.ts`, `tests/equipment.test.ts` (two new blocks),
  `tests/characterSystem.test.ts` (one existing assertion updated).
- **Docs**: `DECISIONS.md` (new D-127), `PROJECT_STATUS.md` (new top
  section), `CHANGELOG.md` (new entry), `KNOWN_ISSUES.md` (new KI-084,
  three existing entries struck/resolved), `CONTENT_SOURCES.md` (new SRD
  item log), this file (rewritten). `ASSET_PLAN.md` unchanged — no art
  scope touched this session.

## Important files

- **`DECISIONS.md`'s D-127** — the complete method for all four systems:
  every design choice, every file touched, and the full "deliberately out
  of scope" list for each.
- **`src/game/entities/Hero.ts`'s `recomputeCombatStats`/
  `effectiveAbilityScore`** — the one shared seam every ability-score-
  derived combat number now reads through; any FUTURE ability-score-reading
  code should read through `effectiveAbilityScore`/`effectiveAbilityScores`,
  not `this.abilityScores` directly, or it will silently ignore an equipped
  override.
- **`KNOWN_ISSUES.md`'s KI-084** — the full in-browser verification
  checklist for this session's four systems.

## Commands verified

- `npm run typecheck` — pass (re-run after each of the 4 systems, and again
  at the end).
- `npm test` — pass, **1147/1147** (up from 1130 — 17 new tests across 3
  files, one existing assertion updated for Blindsense's new active state).
- `npm run build` — pass, **115 modules** (unchanged).
- `npm run dev` — not re-checked this session (no `main.ts`/`config.ts`/
  `index.html` file touched; last confirmed serving HTTP 200 in an earlier
  session).

## Manual tests completed

**None** — no browser is available in this environment. Every mechanic this
session was verified by re-deriving the exact logic against real data (shown
in D-127's own writeup) and by new automated tests where the logic is pure
(`CombatSystem`, `Hero`'s ability-score/charge-item math) — the one piece
that ISN'T automatable is `BattleScene.isEnemyTargetable`'s per-observer
branch, the same standing "scene code isn't unit-tested" limitation every
other in-battle auto-apply mechanic in this project has. See **KI-084** for
the exact checklist.

## Known issues

- **KI-084** (new this session) — every D-127 system not yet confirmed by
  Kevin in a browser; full checklist in `KNOWN_ISSUES.md`.
- **KI-069, KI-070, KI-082** — each had one bullet point struck/resolved by
  D-127 (Swarm resistance; ability-score items + charge items; Blindsense/
  Feral Senses respectively) — the REST of each entry's own content/
  mechanics from its original phase is still open, only the specific
  resolved bullet changed.
- **KI-083** — D-126's UI-layout fixes, still open (Kevin's own in-progress
  playtest pass this session was working through this queue).
- **KI-081, KI-080, KI-079** — still open, unchanged.
- **KI-074** through **KI-078** — still not yet confirmed in a browser.
- **KI-065** through **KI-073** — still not yet confirmed in a browser
  (several now well over ten sessions overdue).
- Unchanged: every other issue in `KNOWN_ISSUES.md`.

## Deferred items

- **`BattleScene`'s full HUD visual restyle** (carried forward from D-123) —
  untouched this session (pure systems/data work, no scene-layout code).
- **The full real SRD families** of both ability-score-setting items and
  charge-based wands/rods/staves — only 3 of each shipped, matching every
  other "honest first pass" content batch this project has made.
- **Damage-type resistance extended to spells** — spell attacks never carry
  a `damageType` at all; adding one to all 318 spells was explicitly treated
  as a separately-sized project, not attempted here.
- **A true per-observer VISUAL** for Blindsense/Feral Senses (the enemy
  token itself still reads as an anonymous "?" to every hero) — only
  click-targetability changed.
- Everything already deferred from D-117 through D-126 — untouched this
  session.

## Decisions made

- **D-127** — four foundational systems: nonmagical damage-type resistance
  (Swarm + Boon of Irresistible Offense), per-observer stealth detection
  (Blindsense/Feral Senses), charge-based active items (3 real SRD items),
  and ability-score-setting items (3 real SRD items) — plus a related
  pre-existing gap fixed as a side effect (DEX ASI now recomputes AC). See
  `DECISIONS.md` for the full method.

## Content or license additions

- **6 new real SRD 5.1 magic items** (CC BY 4.0), logged in
  `CONTENT_SOURCES.md`: Wand of Magic Missile, Wand of Web, Staff of
  Healing, Gauntlets of Ogre Power, Headband of Intellect, Amulet of
  Health. No new fonts, art, or audio — these render with the existing
  coloured-shape/name-label equipment presentation.

## Next chat instructions

1. **Ask Kevin how his playtest pass went** — this was his first in-browser
   session in a while, working through the KI-065-through-KI-083 backlog.
   If he found a real bug, that likely deserves its own dedicated session
   before more new systems/content.
2. **If there's time for D-127-specific confirmation**: point him at
   **KI-084**'s checklist — a Wand of Magic Missile on a non-caster and
   Gauntlets of Ogre Power on a below-19-Strength hero are the two fastest,
   most visually obvious confirmations (no level grind needed, unlike
   Blindsense/Feral Senses or Boon of Irresistible Offense).
3. **If Kevin wants to keep building headless-verifiable engine work**
   (the pattern this session and his stated preference established): the
   remaining honest gaps are the full SRD families behind items 3-4 above,
   or Phase 12's still-unbuilt live multiplayer board sync — worth asking
   directly which direction he wants next, rather than assuming.
4. **Any future code touching a hero's ability scores** should read through
   `Hero.effectiveAbilityScore`/`effectiveAbilityScores`, not
   `this.abilityScores` directly — see this file's "Important files" section
   above.

## Suggested git steps (not run here; use GitHub Desktop)

1. This session's diff touches 7 existing source files, 1 new test file, 2
   existing test files, and docs — a coherent single unit (one decision,
   D-127), safe as its own commit.
2. Not deployed anywhere from this session directly — Kevin's existing
   GitHub Actions workflow deploys automatically on push to `main`. Low risk
   to deploy (all 1147 tests pass, build is clean, no existing mechanic's
   behavior changed for a hero/enemy with none of the new items/features
   equipped or unlocked) — but since Kevin is mid-playtest this session,
   consider deploying together with whatever fixes come out of that pass
   rather than as a separate push, his call.

## Handoff package contents

- [x] Source files (see "What changed" above)
- [x] package.json / package-lock.json (unchanged — no new deps)
- [x] README.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new top section)
- [x] DECISIONS.md (updated — new D-127)
- [x] KNOWN_ISSUES.md (updated — new KI-084, three entries struck/resolved)
- [x] CHANGELOG.md (updated — new entry)
- [x] CONTENT_SOURCES.md (updated — 6 new SRD magic items logged)
- [x] ASSET_PLAN.md (unchanged — not touched this session)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PHASE_HANDOFF.md (this file, rewritten)
- [x] Tests (1147, up from 1130 — 3 files touched, 1 new file)
- [x] No node_modules, dist, secrets, or service-account credentials
