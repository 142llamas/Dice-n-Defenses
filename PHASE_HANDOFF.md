# Phase Handoff

## Version and phase
- **Version:** 0.2.0-dev. Every phase through Phase 25 (D-116) is complete;
  D-117 through D-120 (playtest fixes, campaign scaffolding, dialogue box,
  dialogue skip controls) are complete; D-121 (the basic-attack lunge) is
  complete. **This session ran D-122**: spell-cast and death animations for
  every one of the ~198 castable spells/abilities in the game, via a
  data-driven shape+color library rather than 198 bespoke implementations.
- **Why this ran this session:** immediately after D-121's lunge, Kevin
  asked to build "a whole host of spell casting animations and death
  animations," explicitly wanting every spell to feel unique when cast, no
  two the same. Literally hand-authoring ~198 bespoke animations isn't
  realistic in any session, so three scoping questions were asked and
  answered before any code: (1) mechanism — a shared library of shapes/
  colors with per-ability hashed variation, not bespoke-per-spell (chosen
  over the impractical alternative); (2) pacing — wire ALL ~198 castable
  abilities this session, matching this project's precedent for big content
  passes (chosen over a first-slice-only approach); (3) death animations —
  vary by CAUSE (burn/frost/poison/necrotic/radiant/lightning/physical/
  arcane), not one universal treatment (Kevin's own pick, the one question
  NOT answered toward the simpler default).
- **Completed this session:**
  - **`systems/VisualFxSystem.ts`** (new, pure, no Phaser import, fully
    unit-tested): the whole selection mechanism.
    - **Shape** (11 values: bolt, homingOrb, fallingJudgment, novaBurst,
      ringPulse, gustCone, sparkleRise, radiantPulse, groundRune,
      conjureCircle, blink) is picked STRUCTURALLY from an
      `AbilityDefinition`'s own real mechanical fields, in a fixed
      priority order (`teleportSelf` → `summonsId` → `altersTerrainId` →
      `areaAllies` → `targetsAlly` → `forcedMoveTiles` → `kind` →
      `savingThrow` → `autoHit` → default bolt) — a real fact about the
      ability, not a guess. Notably, `forcedMoveTiles` wins over an
      ability's own `aoeAtRange`/`aoeAdjacent` kind, so Thunderwave gets
      the shove/gust-cone read rather than a generic blast.
    - **Color** comes from a best-effort keyword match against the
      ability's own name/description text (11 element tags: fire, frost,
      lightning, poison, necrotic, radiant, psychic, force, shadow, water,
      earth), checked in a fixed priority order — radiant is checked
      BEFORE fire specifically so "Sacred Flame" (real SRD radiant damage)
      reads gold, not orange, despite the word "flame" — falling back to
      the ability's real SRD `school` (via a reverse index built from
      `data/spells.ts`'s `abilityId` links) when no keyword matches, and
      finally to a generic arcane purple for a mundane hero ability with
      neither (Cleave, Piercing Shot). **This is a cosmetic guess, not
      verified SRD damage-typing** — documented plainly in the module's own
      comment; this game has no damage-type field on spells at all.
    - **Secondary variation** (particle count 3/5/7, size 0.85-1.25x,
      rotation direction, duration 0.85-1.15x) comes from a deterministic
      hash of the ability's own id — NOT `Math.random()`/`RandomService`,
      since this needs to be exactly reproducible, not a gameplay roll.
    - **`DeathCause`** (8 values: physical/fire/frost/poison/necrotic/
      radiant/lightning/arcane) reuses the same keyword inference,
      collapsed from the richer color palette. `Enemy.lastDeathCause?:
      DeathCause` (new field, `entities/Enemy.ts`) is a same-tick-only
      rendering hint — never persisted in `EnemySnapshot`, since it has no
      meaning outside the instant of a kill.
  - **Death-cause tagging wired into every real kill source that isn't
    plain physical**: `applyHeroResults` gained an optional `deathCause`
    param (covers `castAbilityOn`, `onAbilityButton`'s Cleave-style
    immediate-cast path, both branches of `castAoeAtRangeSpell`, and
    `castAoeAdjacentSpell`); `castSavingThrowAbilityOn` and
    `castAoeAtRangeSpell`'s saving-throw branch tag directly; a burning
    status tick tags "fire". Left unset (defaulting to "physical") for
    every ordinary weapon/off-hand/Cleave-second-target/trap/explosion
    kill — correct behavior, not a gap, since those really are mundane.
  - **`BattleScene.playCastVisual(ability, casterPos, focusPos)`** (new):
    dispatches on the descriptor's shape into 11 small Phaser draw methods
    (Graphics/Arc/Rectangle + Tweens — the same technique Phase 22's Cape
    of Billowing and D-121's lunge already use, since this environment has
    no image-generation tool), several sharing three primitive helpers
    (`spawnRing`, `spawnBurstMotes`, `spawnDriftMotes`). Wired into **all
    10 real cast call sites** in the scene: `castAbilityOn`,
    `castSavingThrowAbilityOn`, `castHealSpellOn`, `castAreaAllySpell`,
    `castAoeAtRangeSpell`, `castAoeAdjacentSpell`, `onAbilityButton`'s
    duplicate Cleave-style path, `castTeleportSelfSpell`,
    `castSummonSpell`, `castTerrainSpell` — every way this game ever
    resolves a spell/ability cast. Respects `scaledDuration`/reduced-motion
    exactly like every other tween in this scene.
  - **`BattleScene.playEnemyDeathVisual(enemy)`** (new): replaces the old
    INSTANT token removal on a real kill with a brief squash-and-fade on
    the token itself plus a cause-specific flourish (`playDeathFlourish`,
    reusing the same three primitive helpers — collapse/emberFade/shatter/
    dissolve/wither/radiantBurst/sparkCrackle/arcaneFade, one shape per
    `DeathCause`). Miniboss/boss/legendary tiers get a 1.5x bigger, slower
    version, mirroring the existing boss-token-size precedent. An enemy
    reaching the exit (a breach, not a death) is UNCHANGED — still its own
    existing flash/removal, since escaping isn't dying.
  - Tests: 1026 → **1036** (+10, new `tests/visualFxSystem.test.ts` —
    shape selection against real ability fixtures including the
    Thunderwave/Sacred-Flame priority-order edge cases, determinism, color
    distinctness, death-cause mapping, and a "never throws for any real
    ability" sweep). Typecheck, all 1036 tests, and the production build
    all pass. Module count: **113**, up from 112 (the new
    `VisualFxSystem.ts`). `npm run dev` serves HTTP 200 (checked this
    session).
- **What's NOT done, and why:** no per-spell hand-authored bespoke
  animation — the whole point of this session's scoping question was that
  198 of those isn't realistic; the data-driven library IS the
  deliverable. No new verified damage-type field added to
  `AbilityDefinition`/`SpellDefinition` — the keyword inference stays a
  cosmetic-only guess layered on existing name/description text, not a new
  mechanical field (that would be a much bigger, separately-scoped
  content-verification pass). No change to Extra Attack's second/third
  swing or the off-hand attack — those still play only D-121's basic-attack
  lunge, unchanged, since they're mundane attacks, not spell casts.
- **A real limitation of this environment, stated plainly:** this is a
  large batch of new visual motion across ~198 spells, and none of it has
  been seen by Kevin yet — no browser is available here. See **KI-078**.
- **Recommended next step:** Kevin should play a battle with a caster hero,
  cast a variety of spells, and kill a few enemies with different sources
  (a fire spell, a cold spell, a plain weapon attack, a burning tick) —
  KI-078 has the full checklist, but the two things most worth his own eyes
  are (1) whether two same-shape spells actually read as distinguishable in
  motion, not just technically-different-but-visually-identical, and (2)
  whether the color-guessing heuristic embarrasses itself on any spell he
  cares about (the module comment already flags this as a known, disclosed
  limitation, not a verified mechanic). Separately, KI-077 (D-121's lunge),
  KI-076 (D-120's dialogue skip controls), KI-075 (D-119's dialogue box),
  and KI-074 (D-117's playtest fixes, now SIX sessions overdue) all remain
  unconfirmed and worth surfacing directly.
- **Last complete milestone:** Phase 6 (`v0.1.1`) through Phase 25
  (D-116); D-117 through D-120; D-121 (basic-attack lunge); D-122 (this
  session — spell-cast and death animations). Phase 12 still has no live
  board sync.
- **Git branch:** no git in this environment; Kevin manages branching in
  GitHub Desktop. This session's changed files: `src/game/scenes/BattleScene.ts`,
  `src/game/entities/Enemy.ts`; new files `src/game/systems/VisualFxSystem.ts`,
  `tests/visualFxSystem.test.ts`; docs (`DECISIONS.md`, `PROJECT_STATUS.md`,
  `CHANGELOG.md`, `KNOWN_ISSUES.md`, this file). No git commit/tag made
  here.
- **Date:** August 10, 2026

## Why this batch was chosen
Kevin asked directly for this, in the same message that picked up from
D-121's own recommendation to eventually build spell-cast animations. The
scale (~198 castable spells, "no two the same") made a literal per-spell
approach impractical, so the session's real work was designing a
mechanism that achieves genuine variety WITHOUT hand-authoring — a shape
taxonomy driven by each ability's own real mechanical fields, a color
guess driven by its name/description text with a verified-school
fallback, and hashed secondary variation — then wiring that mechanism into
literally every cast call site and every kill path in one pass, matching
this project's own precedent for big content batches (Phase 15/16/20/21).

## What works now
- Everything from every prior phase through D-121, unchanged in behavior.
- **Every spell/ability cast in the game now plays a shape-and-color
  flourish** distinguishing it from other spells, on top of any existing
  hit-flash/log line.
- **Every enemy killed by damage now plays a brief cause-specific death
  flourish** (fire/frost/poison/necrotic/radiant/lightning/physical/
  arcane) instead of vanishing instantly — pending Kevin's own visual
  confirmation (KI-078).

## What changed
- **Two files edited**: `src/game/scenes/BattleScene.ts` (11 new draw
  methods, 3 shared primitives, 2 dispatchers, 10 cast-call-site wire-ups,
  `awardKillGold`'s token-removal call swapped), `src/game/entities/Enemy.ts`
  (new `lastDeathCause?` field).
- **One new source file**: `src/game/systems/VisualFxSystem.ts`.
- **One new test file**: `tests/visualFxSystem.test.ts`.
- **Docs**: `DECISIONS.md` (new D-122), `PROJECT_STATUS.md` (new top
  section), `CHANGELOG.md` (new entry), `KNOWN_ISSUES.md` (new KI-078),
  this file (rewritten).

## Important files
- **`DECISIONS.md`'s D-122** — the full method, including the exact
  shape-priority order and the radiant-before-fire color-priority fix.
- **`src/game/systems/VisualFxSystem.ts`** — read this before adding a
  new spell mechanic field that should affect its cast visual (add to
  `shapeForAbility`'s priority chain) or before touching the element-
  keyword lists (color only, no mechanical effect).
- **`src/game/scenes/BattleScene.ts`'s `playCastVisual`/
  `playEnemyDeathVisual`** (near `lungeToward`) — the single entry point
  each; every new cast call site should route through `playCastVisual`
  rather than drawing something bespoke.
- **`KNOWN_ISSUES.md`'s KI-078** — the full in-browser verification
  checklist for this session.

## Commands verified
- `npm run typecheck` — pass.
- `npm test` — pass, **1036/1036** (+10 from last session).
- `npm run build` — pass, **113 modules** (up from 112).
- `npm run dev` — serves HTTP 200 (checked this session).

## Manual tests completed
**None** — no browser is available in this environment. This session added
a large batch of new visual motion across nearly every spell in the game,
so this matters more than usual — see **KI-078** for the exact checklist.

## Known issues
- **KI-078** (new this session) — spell-cast and death animations not yet
  confirmed by Kevin in a browser; full checklist in `KNOWN_ISSUES.md`.
- **KI-077** — D-121's basic-attack lunge, still open.
- **KI-076** — D-120's dialogue skip controls, still open.
- **KI-075** — D-119's dialogue box/preview tab, still open.
- **KI-074** — D-117's playtest fixes, still open, now SIX sessions
  without Kevin's confirmation.
- **KI-065** through **KI-073** — nine consecutive earlier content/
  mechanics phases, still not yet confirmed in a browser.
- Unchanged: every other issue in `KNOWN_ISSUES.md`.

## Deferred items
- **A verified damage-type field on spells** — the color guess stays
  cosmetic-only, layered on existing text; a real mechanical damage-type
  system would be a separately-scoped, much bigger verification pass.
- **Cast-visual coverage on Extra Attack's extra swings, the off-hand
  attack, or Cleave's second target** — unchanged from D-121's own
  deferral; those remain basic-attack lunges, not spell casts, on purpose.
- Everything already deferred from D-117 through D-121 and earlier
  phases — untouched this session.

## Decisions made
- **D-122** — spell-cast and death animations via a data-driven shape+
  color library. See `DECISIONS.md` for the full method.

## Content or license additions
- **None.** This session added presentation/animation code and one
  cosmetic-only inference layer, not game content. `CONTENT_SOURCES.md`
  unchanged.

## Next chat instructions
1. **Ask Kevin if he's played a battle since this session** (KI-078) —
   confirm spell casts and enemy deaths both animate, and specifically
   whether the variety reads as genuinely distinct rather than
   samey-with-minor-tweaks.
2. **Ask about KI-077, KI-076, KI-075, and KI-074 too** — all still open,
   and KI-074 is now six sessions overdue; worth surfacing directly.
3. **If Kevin wants more animation work**: the natural follow-ups are (a)
   extending cast-visual coverage to Extra Attack/off-hand/Cleave's second
   target, or (b) a verified damage-type field if the color-guessing
   heuristic bothers him on a specific spell — don't build either
   speculatively, ask which (if either) he actually wants.
4. Boundaries unchanged from before this session, plus this session's own:
   no verified damage typing, no cast-visual coverage beyond the 10 real
   cast call sites.

## Suggested git steps (not run here; use GitHub Desktop)
1. This session's diff touches `BattleScene.ts`, `Enemy.ts`, one new
   source file, one new test file, and docs — larger than D-121's diff but
   still a single coherent unit (one new system plus its wiring), safe as
   its own commit.
2. Not deployed anywhere from this session directly — Kevin's existing
   GitHub Actions workflow deploys automatically on push to `main`. This
   change is visible in every ordinary battle with any spellcasting hero,
   so a deploy would surface it immediately.

## Handoff package contents
- [x] Source files (see "What changed" above)
- [x] package.json / package-lock.json (unchanged — no new deps)
- [x] README.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new top section)
- [x] DECISIONS.md (updated — new D-122)
- [x] KNOWN_ISSUES.md (updated — new KI-078)
- [x] CHANGELOG.md (updated — new entry)
- [x] CONTENT_SOURCES.md (unchanged — no new content)
- [x] ASSET_PLAN.md (unchanged — not touched this session)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PHASE_HANDOFF.md (this file, rewritten)
- [x] Tests (1036, +10 this session)
- [x] No node_modules, dist, secrets, or service-account credentials
