# Phase Handoff

## Version and phase
- **Version:** 0.2.0-dev. Every phase through Phase 25 (D-116) is complete;
  D-117 through D-122 (playtest fixes, campaign scaffolding, dialogue box,
  dialogue skip controls, the basic-attack lunge, spell-cast/death
  animations) are complete. **This session ran D-123**: a shared fantasy/
  parchment UI theme for Main Menu, Compendium, and Bestiary — real ornate
  buttons with hover/click feedback, a reorganized Main Menu layout, two
  Google Fonts, and a Bestiary pagination gap found and fixed along the
  way. Also investigated (not fixed — no code defect found) two playtest
  reports Kevin raised in the same message.
- **Why this ran this session:** Kevin said the game "is in a bad spot"
  visually and asked to "spruce it up quite a bit," explicitly scoping this
  pass to Main Menu + Compendium/Bestiary only, with the same branding
  planned to carry through the rest of the game (including `BattleScene`'s
  HUD) in a later session. He asked for: an on-brand fantasy/D&D look, a
  more professional/reorganized Main Menu, and real stylized hover/click
  button feedback — and said explicitly to take as much time as needed. The
  same message also reported two playtest findings: he couldn't find a
  spellbook to test spell-cast animations, and never saw a level-up choice
  prompt. Both were investigated in code this session (no browser available
  here) — see below.
- **Completed this session:**
  - **`src/game/scenes/uiTheme.ts`** (new, shared, Phaser-dependent
    presentation module — same "one renderer, not duplicated per scene"
    precedent `dialogueBox.ts` already established):
    - **Two Google Fonts**: Cinzel (display/headline) and EB Garamond
      (body/button), both SIL Open Font License 1.1, loaded via a `<link>`
      in `index.html` with `preconnect` hints. Every `fontFamily` string
      lists a real serif fallback (Georgia, Times New Roman, serif) first,
      so an offline/CDN-unreachable load still renders readable text.
      `BootScene.create()` now waits for `document.fonts.ready` (capped at
      1.5s so a slow/offline connection can never stall the menu) before
      starting `MainMenuScene`, since Phaser doesn't re-layout Text objects
      that were already rendered against the fallback font.
    - **`createOrnateButton(scene, x, y, w, h, label, onClick, opts)`**: a
      carved-wood-and-bronze plaque button drawn with `Graphics` (rounded
      double border, corner diamond accents), with real idle/hover/
      pressed/disabled/selected states — a hover brighten+lift tween, a
      press-down "squish" tween on click. Every button in this project
      previously used a plain `add.rectangle().setStrokeStyle()` with, at
      most, a flat `setFillStyle` swap on `pointerover` and ZERO click
      feedback — this was the literal, explicit ask. Four size variants
      (`primary`/`secondary`/`tool`/`tab`) cover everything from the Main
      Menu's big "New Game" button down to Compendium's 10-wide category
      tab row.
    - **`drawScreenBackdrop(scene)`**: a wood/stone vertical gradient +
      four-corner vignette + a double gold/bronze frame with corner
      diamonds, replacing every restyled scene's old flat
      `setBackgroundColor("#0e0e14")`.
    - **`drawParchmentPanel(scene, x, y, w, h, depth)`**: the same
      base-fill + low-alpha "aged" mottling + double-border technique
      `dialogueBox.ts` already established for its fixed 900x280 dialogue
      box, generalized here to an arbitrary rectangle (Compendium's detail
      pane, Bestiary's roster pane).
    - **`spawnAmbientMotes`** (drifting ember/dust particles, deterministic
      golden-angle placement, not randomized), **`createSectionLabel`** (a
      small-caps flanked label for grouping buttons), **`centeredRowX`**
      (the centering arithmetic `CompendiumScene` had already hand-rolled
      three times, pulled out to one shared formula).
    - **New `COLORS` entries in `config.ts`** (`menuBgNear/Far`,
      `menuVignette`, `woodPanel*`, `bronze*`, `gilt*`, `menuInk*`) —
      deliberately separate from the existing battle-board palette
      (`tileFloor`, `hero`, `enemy`, etc.), which is completely untouched.
  - **`MainMenuScene.ts`** rewritten: the old flat vertical stack of five
    identical buttons (New Game/Compendium/Bestiary/Campaigns/Free Play)
    plus six more scattered across the four corners (Load Game, Account,
    Settings, Map Builder, Browse Shared Maps, Co-op) is now grouped by
    purpose — one hero action ("New Game," big, gold-accented), a
    "Continue Your Journey" row (Load Game/Campaigns/Free Play, +Co-op if
    Firebase is configured), a "Know Your Foe" row (Compendium/Bestiary),
    and a visually quieter "Creator Tools" row (Map Builder, +Browse Shared
    Maps if Firebase is configured) — plus a drawn tower-and-shield crest
    (pure `Graphics`, no image asset) filling the space below the button
    groups, drifting ember motes for atmosphere, and a small version tag.
    Settings and the optional Account control stay in the top-right corner.
    Every `scene.start` target and the Enter/Space keyboard shortcut are
    byte-for-byte unchanged — this is a presentation-only pass.
  - **`CompendiumScene.ts`/`BestiaryScene.ts`** restyled onto the same
    theme: tabs, sub-selectors (class/spell-level pickers), and pagination
    controls now use `createOrnateButton`; the detail text renders inside a
    `drawParchmentPanel` in ink-on-parchment color with the EB Garamond
    body font. **Zero data or lookup-logic changes** — every category,
    filter, and page computation is identical to before.
  - **A real pre-existing gap found and fixed in `BestiaryScene`, not part
    of the original ask**: the enemy roster grew from a handful of entries
    at this scene's Phase 11.6 debut to 94 by Phase 25, but nobody ever
    added pagination — the old flat, unpaginated text block had been
    silently overflowing well past the bottom of the canvas for many
    phases. Fixed with the same Prev/Next paging `CompendiumScene` already
    established (`ENTRIES_PER_PAGE = 10`), applied to a flattened,
    role-grouped enemy list with a heading rendered wherever a role group
    starts on the current page. See **KI-080** for the in-browser checklist
    and **KI-079** below for why this was found now.
  - **The two playtest reports Kevin raised, investigated in code (no
    browser available, so this is a code read, not a reproduction — see
    KI-079 for the full writeup)**:
    - **Spellbook access**: `BattleScene.onAbilityButton`/
      `showAbilityButtonFor`/`isCasterHero` are all correctly wired — any
      hero with a non-empty known-spell list (Wizard/Cleric/Bard/Druid/
      Sorcerer/Warlock) shows a "Cast a Spell (Q)" button the instant it's
      selected and can still act. No code defect found. Most likely
      explanation: the button is easy to miss among the still-unrestyled
      `BattleScene` HUD's visual noise (exactly the class of problem this
      session's restyle doesn't reach yet — that scene is explicitly next,
      not this session), or the test party had no caster hero selected.
    - **Level-up choices**: `afterWaveCleared`/`applyClassLevelUps`/
      `showAsiChoiceQueue`/`showSubclassChoiceQueue` are all correctly
      wired — a hero levels up every 2 waves cleared, but a CHOICE popup
      only appears at an Ability-Score-Improvement level (4 for most
      classes → wave 6+) or an in-battle subclass-pick level (1-3, and
      NEVER for Cleric/Sorcerer/Warlock, who pick their subclass at
      character creation instead, by design). No code defect found. Most
      likely explanation: a playtest shorter than 6 waves, or an
      all-Cleric/Sorcerer/Warlock party, would see ordinary level-ups
      (logged as plain text) but genuinely no choice popup — this matches
      Kevin's report exactly.
    - **Neither is fixed, because neither was found broken.** Both need
      Kevin's own confirmation (which class(es), how many waves, whether a
      caster was selected when Q was pressed) before any further code
      change — see "Next chat instructions" below.
  - Tests: unchanged at **1036** — pure presentation code (fonts, colors,
    `Graphics` drawing, button tweens), no new pure logic to test, same
    standing limitation as every other Phaser-scene-only visual change in
    this project. Typecheck, all 1036 tests, and the production build all
    pass. Module count: **114**, up from 113 (the new `uiTheme.ts`). `npm
    run dev` serves HTTP 200 (checked this session).
- **What's NOT done, and why:** `BattleScene`'s HUD, `CharacterCreationScene`,
  and every other scene are completely UNCHANGED — Kevin's own instruction
  was to start with just Main Menu + Compendium/Bestiary, with the same
  branding explicitly planned to carry through the rest of the game later,
  not this session. No actual code fix for the spellbook/level-up reports,
  since no code defect was found in either mechanism this session — see
  above and KI-079.
- **A real limitation of this environment, stated plainly:** this is a
  large visual/branding change and none of it has been seen by Kevin yet —
  no browser is available here. See **KI-080**. Separately, the spellbook/
  level-up investigation above is a code read, not a reproduction — it
  could be wrong; treat it as a hypothesis pending Kevin's own confirmation,
  not a closed case.
- **Recommended next step:** Kevin should open the Main Menu, Compendium,
  and Bestiary in a browser and confirm the fonts load, every button's
  hover/click feedback works, the new grouped Main Menu layout doesn't
  overlap anything, and Bestiary's new pagination reads as clean pages
  rather than one overflowing block (KI-080 has the full checklist).
  Separately, he should report back on the spellbook/level-up questions
  above (KI-079) — which class(es) he built, how many waves he reached, and
  whether he selected a caster hero before pressing Q — so either can be
  confirmed working-as-designed or turned into a real, reproducible bug
  report. KI-078 (D-122's spell-cast/death animations), KI-077 (D-121's
  lunge), KI-076/075 (dialogue skip controls/box), and KI-074 (D-117's
  playtest fixes, now SEVEN sessions overdue) all remain unconfirmed too and
  are worth surfacing directly.
- **Last complete milestone:** Phase 6 (`v0.1.1`) through Phase 25 (D-116);
  D-117 through D-122; D-123 (this session — the Main
  Menu/Compendium/Bestiary UI theme). Phase 12 still has no live board sync.
  `BattleScene`'s own visual restyle has not started yet.
- **Git branch:** no git in this environment; Kevin manages branching in
  GitHub Desktop. This session's changed files: `index.html`,
  `src/game/config.ts`, `src/game/scenes/BootScene.ts`,
  `src/game/scenes/MainMenuScene.ts`, `src/game/scenes/CompendiumScene.ts`,
  `src/game/scenes/BestiaryScene.ts`; new file
  `src/game/scenes/uiTheme.ts`; docs (`DECISIONS.md`, `PROJECT_STATUS.md`,
  `CHANGELOG.md`, `KNOWN_ISSUES.md`, `CONTENT_SOURCES.md`, this file). No
  git commit/tag made here.
- **Date:** August 10, 2026

## Why this batch was chosen
Kevin asked directly for this, unprompted, as a fresh top-level request
("Visually I think the game is in a bad spot right now. Let's spruce it up
quite a bit"), separate from any prior phase's own recommended next step.
He explicitly scoped it to Main Menu + Compendium/Bestiary for now, with
the same branding planned for the rest of the game later — so this session
built a REUSABLE shared theme module (`uiTheme.ts`) rather than three
one-off restyles, specifically so the next visual pass (`BattleScene` and
beyond) can reuse the same fonts/colors/button component instead of
re-inventing them a fourth time.

## What works now
- Everything from every prior phase through D-122, unchanged in behavior —
  this session touched presentation only, no game rule changed.
- **Main Menu, Compendium, and Bestiary now share one fantasy/parchment
  visual theme**: real fonts (Cinzel/EB Garamond), a textured backdrop, and
  ornate buttons with genuine hover/click feedback, in place of the flat
  dark-gray-rectangle look every screen had before.
- **Main Menu is reorganized into named, purpose-grouped button clusters**
  instead of one long undifferentiated list.
- **Bestiary now paginates its 94-entry roster** instead of silently
  overflowing past the bottom of the canvas.
- Pending Kevin's own visual confirmation (KI-080).

## What changed
- **Six files edited**: `index.html` (Google Fonts `<link>`), `src/game/
  config.ts` (new themed `COLORS`), `src/game/scenes/BootScene.ts` (waits
  for fonts before starting the menu), `src/game/scenes/MainMenuScene.ts`
  (full rewrite), `src/game/scenes/CompendiumScene.ts` (restyle, same
  logic), `src/game/scenes/BestiaryScene.ts` (restyle + new pagination).
- **One new source file**: `src/game/scenes/uiTheme.ts`.
- **No new test files** — presentation-only, nothing new to unit-test.
- **Docs**: `DECISIONS.md` (new D-123), `PROJECT_STATUS.md` (new top
  section), `CHANGELOG.md` (new entry), `KNOWN_ISSUES.md` (new KI-079,
  KI-080), `CONTENT_SOURCES.md` (new Google Fonts row), this file
  (rewritten).

## Important files
- **`DECISIONS.md`'s D-123** — the full method, including exactly what was
  investigated (and NOT fixed) for the spellbook/level-up reports.
- **`src/game/scenes/uiTheme.ts`** — read this before restyling any other
  scene (`BattleScene` is the obvious next target); every helper here is
  meant to be reused, not re-implemented.
- **`KNOWN_ISSUES.md`'s KI-080** — the full in-browser verification
  checklist for this session's visual work.
- **`KNOWN_ISSUES.md`'s KI-079** — the full spellbook/level-up
  investigation writeup and exactly what repro details would turn either
  into a real, actionable bug report.

## Commands verified
- `npm run typecheck` — pass.
- `npm test` — pass, **1036/1036** (unchanged from last session).
- `npm run build` — pass, **114 modules** (up from 113).
- `npm run dev` — serves HTTP 200 (checked this session).

## Manual tests completed
**None** — no browser is available in this environment. This session is a
significant visual/branding change to three screens Kevin will see
immediately on next launch, so his own look matters more than usual — see
**KI-080** for the exact checklist, and **KI-079** for the two playtest
questions still needing his answer.

## Known issues
- **KI-080** (new this session) — the Main Menu/Compendium/Bestiary
  fantasy-theme restyle not yet confirmed by Kevin in a browser; full
  checklist in `KNOWN_ISSUES.md`.
- **KI-079** (new this session) — Kevin's spellbook-access and level-up-
  choice playtest reports, investigated in code, no defect found; needs his
  own confirmation/repro details either way.
- **KI-078** — D-122's spell-cast/death animations, still open.
- **KI-077** — D-121's basic-attack lunge, still open.
- **KI-076** — D-120's dialogue skip controls, still open.
- **KI-075** — D-119's dialogue box/preview tab, still open.
- **KI-074** — D-117's playtest fixes, still open, now SEVEN sessions
  without Kevin's confirmation.
- **KI-065** through **KI-073** — nine consecutive earlier content/
  mechanics phases, still not yet confirmed in a browser.
- Unchanged: every other issue in `KNOWN_ISSUES.md`.

## Deferred items
- **`BattleScene`'s HUD restyle** — the same fantasy theme, deliberately
  NOT built this session per Kevin's own scoping ("just start with the main
  menu and compendium/bestiary for now"). This is the natural next step
  once Kevin confirms this session's three screens look right, and would
  also be the moment to directly address the spellbook button's
  discoverability (KI-079's likely explanation).
- **`CharacterCreationScene`, `FreePlayScene`, `CampaignSelectScene`,
  `CoopLobbyScene`, `MapBuilderScene`, `LoadGameScene`,
  `BrowseSharedMapsScene`** — every other scene, all still on the old flat
  dark/plain-rectangle look. Not restyled this session, same reasoning.
- Everything already deferred from D-117 through D-122 and earlier
  phases — untouched this session.

## Decisions made
- **D-123** — a shared fantasy/parchment UI theme for Main Menu, Compendium,
  and Bestiary. See `DECISIONS.md` for the full method.

## Content or license additions
- **Two Google Fonts** (Cinzel, EB Garamond — SIL Open Font License 1.1),
  logged in `CONTENT_SOURCES.md`. This is the first font this project has
  ever added — every prior phase's own `CONTENT_SOURCES.md` entries note
  "no new art, audio, or fonts."

## Next chat instructions
1. **Ask Kevin whether he's looked at the new Main Menu/Compendium/Bestiary
   in a browser yet** (KI-080) — confirm the fonts loaded, every button's
   hover/click feedback works, the new grouped layout reads well, and
   Bestiary's new pagination works.
2. **Ask Kevin the three specific follow-up questions KI-079 needs**: which
   class(es) did he build, how many waves did he reach, and did he select a
   caster hero before pressing Q/looking for the spellbook button? His
   answers will show whether the spellbook/level-up "bugs" are actually
   working-as-designed (the likely case) or genuinely broken (in which case
   this becomes a real bug-fix session with an exact repro, not more code
   archaeology).
3. **If Kevin confirms this session's three screens look good**: the
   natural next step is extending the SAME `uiTheme.ts` module to
   `BattleScene`'s HUD — Kevin's own stated plan ("the same branding will
   need to be carried through the whole game"). That's a bigger, riskier
   pass than this one (a live battle board has far more interactive state
   than a static menu), so scope it as its own session rather than folding
   it into a quick follow-up.
4. Also ask about KI-078, KI-077, KI-076, KI-075, and KI-074 — all still
   open, and KI-074 is now seven sessions overdue.
5. Boundaries unchanged from before this session, plus this session's own:
   `BattleScene` and every other scene are still unrestyled; no code fix
   was made for the spellbook/level-up reports, since none was confirmed
   necessary.

## Suggested git steps (not run here; use GitHub Desktop)
1. This session's diff touches six existing files plus one new source file
   and docs — a coherent single unit (one new shared module plus its
   application to three scenes), safe as its own commit.
2. Not deployed anywhere from this session directly — Kevin's existing
   GitHub Actions workflow deploys automatically on push to `main`. This
   change is visible the instant the game loads (the Main Menu is the very
   first screen), so a deploy would surface it immediately — likely worth
   doing before the next session so Kevin can react to it in the live
   build, same as he does for every other visual change.

## Handoff package contents
- [x] Source files (see "What changed" above)
- [x] package.json / package-lock.json (unchanged — no new deps)
- [x] README.md (unchanged)
- [x] PROJECT_STATUS.md (updated — new top section)
- [x] DECISIONS.md (updated — new D-123)
- [x] KNOWN_ISSUES.md (updated — new KI-079, KI-080)
- [x] CHANGELOG.md (updated — new entry)
- [x] CONTENT_SOURCES.md (updated — new Google Fonts row, the project's
  first font addition)
- [x] ASSET_PLAN.md (unchanged — not touched this session)
- [x] SOURCE_OF_TRUTH.md (unchanged)
- [x] FIREBASE_SETUP.md (unchanged)
- [x] PHASE_12_MULTIPLAYER_FEASIBILITY.md (unchanged)
- [x] CAMPAIGN_STORY_DESIGN.md (unchanged)
- [x] PHASE_HANDOFF.md (this file, rewritten)
- [x] Tests (1036, unchanged from last session — presentation-only pass)
- [x] No node_modules, dist, secrets, or service-account credentials
