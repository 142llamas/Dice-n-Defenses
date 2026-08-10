# Known Issues and Limitations

## Open bugs (confirmed by Kevin, not yet fixed)

(none currently — see "Open items to verify" below for work not yet confirmed in a browser.)

## Open items to verify

- **KI-080 — D-123's fantasy/parchment restyle of Main Menu, Compendium, and
  Bestiary is not yet confirmed by Kevin in a browser.** Built and verified
  headless-only (typecheck, all 1036 tests, production build all pass — 114
  modules, up from 113; `npm run dev` serves HTTP 200). This is the FIRST
  visual/branding pass this project has done outside of small per-feature
  presentation work (dialogue box, cast/death flourishes) — the in-browser
  look matters more than usual here since "does it actually look good" isn't
  something typecheck/tests can answer. To check:
  - **The two Google Fonts actually load**: Main Menu's title/buttons should
    render in a carved-serif display font (Cinzel) and body/caption text in
    a manuscript-style serif (EB Garamond), not the plain sans-serif system
    font every screen used before this session. If either looks like a
    generic sans-serif, the CDN link in `index.html` may not be reachable —
    worth a look at the browser's network tab.
  - **Every button's hover and click feedback**: mouse over any button on
    Main Menu/Compendium/Bestiary and confirm it brightens, its border gilds,
    and it lifts very slightly; click one and confirm a quick press-down
    "squish" plays before the action fires. Every button on all three
    screens should behave identically — this was the literal, explicit ask
    ("add behavior for the (stylized) buttons for when they are hovered and
    when they are clicked").
  - **Main Menu's new grouped layout**: "New Game" should read as the single
    most prominent button; "Continue Your Journey" (Load Game/Campaigns/Free
    Play/Co-op), "Know Your Foe" (Compendium/Bestiary), and "Creator Tools"
    (Map Builder/Browse Shared Maps) should each read as a distinct labeled
    group, not one undifferentiated list. Confirm nothing overlaps at the
    canvas's native 1280x1080 and that the drawn tower-and-shield crest below
    the button groups doesn't collide with anything.
  - **Compendium's parchment reading panel**: confirm every one of the 10
    category tabs is readable and clickable at its new smaller ornate-tab
    size, and that long detail text (Classes/Spells/Equipment's paginated
    pages especially) still wraps cleanly inside the parchment panel with no
    text running past its border.
  - **Bestiary's new pagination**: this session added Prev/Next paging to
    Bestiary for the first time (see the note below) — confirm the roster
    now reads as clean pages of ~10 entries with a group heading (Minions/
    Miniboss/Bosses/Legendary) appearing wherever a group starts, rather
    than one giant overflowing block.
  - **Known, deliberate limit, not a bug**: `BattleScene`'s HUD and every
    other scene are UNCHANGED — Kevin's own instruction was to start with
    just these three screens, with the same branding explicitly planned to
    carry through the rest of the game in a later session.

- **KI-079 — Kevin's two playtest reports (no spellbook found to test
  spell-cast animations; no level-up choice ever appeared) were investigated
  in code this session (D-123) — no browser is available here, so this is a
  code read, not a reproduction, and NEITHER is confirmed fixed or confirmed
  as a real bug.** Both mechanisms read as correctly wired in
  `BattleScene.ts`:
  - **Spellbook**: any hero with a non-empty known-spell list (Wizard/
    Cleric/Bard/Druid/Sorcerer/Warlock) shows a "Cast a Spell (Q)" button
    the instant it's selected and can still act (`showAbilityButtonFor`/
    `isCasterHero`), and pressing Q or clicking it opens the spellbook
    (`onAbilityButton`). The likely explanation is a discoverability
    problem (the button is one of several similarly-styled small rectangles
    in the current, still-unrestyled `BattleScene` HUD — exactly the kind of
    visual-clarity problem this session's restyle doesn't reach yet) or that
    the party Kevin tested with had no caster hero selected — NOT a broken
    code path.
  - **Level-up choices**: a hero gains a real class level every 2 waves
    cleared, but a CHOICE popup only appears at a level granting an Ability
    Score Improvement (level 4 for most classes → wave 6+) or an in-battle
    subclass pick (levels 1-3, and NEVER for Cleric/Sorcerer/Warlock, who
    pick their subclass at character creation instead, by design). A
    shorter playtest, or an all-Cleric/Sorcerer/Warlock party, would see
    ordinary level-ups logged as plain text with no popup — this matches
    Kevin's report exactly and is the most likely explanation, not a defect.
  - **What would actually confirm or refute this**: Kevin playing again and
    reporting (a) which class(es) he built, (b) how many waves he reached,
    and (c) whether he selected a caster hero and pressed Q (or clicked the
    purple "Cast a Spell" button) while it could still act. If he clears
    wave 6+ with a non-Cleric/Sorcerer/Warlock party and STILL sees no ASI
    popup, or presses Q on a confirmed caster and nothing opens, that's a
    real, reproducible bug worth its own dedicated session — this entry
    should be updated (or promoted to "Open bugs") with those exact repro
    details rather than re-investigated blind again.

- **KI-078 — D-122's spell-cast and death animations are not yet confirmed
  by Kevin in a browser.** Built and verified headless-only (typecheck, all
  1036 tests, production build all pass — 113 modules, up from 112; `npm
  run dev` serves HTTP 200). To check: play a battle with a caster hero
  (Wizard/Cleric/Druid/Sorcerer/Warlock/Bard) and cast several different
  spells, plus kill a few enemies with different spells and with plain
  attacks/traps.
  - Confirm each spell's cast plays a visible flourish (a traveling bolt, a
    ring pulse, a falling judgment, etc.) roughly matching its real effect
    (an AoE spell should visibly burst at the chosen tile; a heal should
    sparkle over the target; a teleport should fade-and-reappear).
  - Confirm two different spells of the same general TYPE (e.g. two attack-
    roll bolts) still look distinguishable from each other in color/size/
    speed, not identical — this was the actual ask this session.
  - Confirm an enemy killed by fire (Fire Bolt, Burning Hands, a burning
    status tick) fades differently than one killed by a plain weapon
    attack, and differently again from one killed by a cold/poison/
    necrotic/radiant spell.
  - Confirm the "Instant" animation-speed setting skips both the cast
    flourish and the death flourish outright, same as every other tween in
    this scene.
  - **Known, deliberate limit, not a bug**: the cast COLOR is a best-effort
    keyword guess against each spell's name/description text, not a
    verified SRD damage type (this game has no damage-type field on spells
    at all) — a handful of spells may read a shade off from their "real"
    element. See D-122.

- **KI-077 — D-121's basic-attack lunge is not yet confirmed by Kevin in a
  browser.** Built and verified headless-only (typecheck, all 1026 tests,
  production build all pass — 112 modules, unchanged; `npm run dev` serves
  HTTP 200). To check: play a battle and land a hero's basic Attack on an
  enemy, then let an enemy attack a hero back.
  - Confirm the attacker's token visibly nudges toward its target and
    springs back, on top of the existing hit-flash, on both hero→enemy and
    enemy→hero swings.
  - Confirm the lunge respects the Settings animation-speed control —
    "Instant" should skip the lunge outright (same as it already skips
    move/hit-flash tweens), not play it at some minimum speed.
  - Confirm no visual glitch when a hero's status badge, boss banner, or
    aura ring token is present nearby (the lunge only moves the attacking
    token's own circle/label/hp-text/sprite, nothing else, but worth an
    eyes-on check since this is the first tween sharing screen space with
    those).
  - **Known, deliberate scope limit, not a bug**: only wired into the
    single basic Attack action on both sides — Extra Attack's extra swings,
    the off-hand attack, Cleave's second target, and every spell/ability
    attack still show only the existing hit-flash, no lunge. See D-121.

- **KI-076 — D-120's dialogue skip controls are not yet confirmed by Kevin
  in a browser.** Built and verified headless-only (typecheck, all 1026
  tests, production build all pass — 112 modules, up from 111; `npm run
  dev` serves HTTP 200). To check: Compendium → Dialogue tab → both sample
  buttons.
  - **"Show Sample (skippable)"**: confirm the "Skip ▶▶" button (top-left)
    is visible and jumps straight to closing the box from any line;
    confirm clicking anywhere on the parchment panel, and pressing
    Space/Enter, both advance to the next line exactly like the Continue
    button does.
  - **"Show Sample (with a decision)"**: confirm the "Skip ▶▶" button is
    ABSENT for this entire sequence (including on its first line, before
    the decision line is even reached) — this is the one behavior this
    session most needs eyes on, since it's a real gating rule, not just
    styling.
  - **Click-target overlap**: confirm clicking the Continue or Skip button
    only ever triggers that button (not a double-advance from the
    panel/scrim's own click-to-advance handler underneath it).
  - **Known, deliberate limit, not a bug**: nothing actually plays out
    over time yet (no text-reveal animation, no audio), so every skip
    control's practical effect today is identical to normal advancing —
    the visible difference (jumping straight to the end vs. one line at a
    time) is the only thing to confirm; the interrupt seam itself has
    nothing to visibly interrupt yet.

- **KI-075 — The new stylized parchment dialogue box (D-119) is not yet
  confirmed by Kevin in a browser.** Built and verified headless-only
  (typecheck, all 1021 tests, production build all pass — 111 modules, up
  from 109; `npm run dev` serves HTTP 200) — same standing "no browser in
  this environment" limitation as every other visual change. To check:
  open Compendium → the new "Dialogue" tab → "Show Sample Dialogue".
  - **The parchment panel itself**: does the drawn (not image-based) base
    fill + mottling + double border actually read as "parchment," or does
    it need a real texture/more contrast? This is the one part of this
    session Kevin can fully judge without supplying anything himself.
  - **The NPC portrait placeholder silhouette**: is the fallback shape (a
    plain gray bust icon) an acceptable "nothing to see yet" stand-in, or
    too crude even as a placeholder?
  - **Layout**: portrait/name-plate/text/Continue-button positioning at the
    actual rendered sizes, and that the panel doesn't collide with
    Compendium's own tab row or detail-text area above/behind it.
  - **The narrator/PC line (no portrait) vs. NPC line (portrait) visual
    difference** reads clearly as two different speaker styles.
  - **Known, deliberate, unverifiable-without-art limit, not a bug**: the
    portrait shows only the placeholder silhouette today — `PORTRAIT_MANIFEST`
    is empty, so there is nothing else to look at until Kevin supplies a
    real image.

- **KI-074 — This session's playtest-driven fixes (D-117) are not yet
  confirmed by Kevin in a browser** — the exact thing they were meant to
  fix. Built and verified headless-only (typecheck, 976 tests, production
  build all pass; `npm run dev` serves HTTP 200) — this environment has no
  browser, so none of the following has actually been SEEN:
  - **The canvas is no longer visibly off-center** (`main.ts`'s
    `scale.autoCenter` changed from `CENTER_BOTH` to `NO_CENTER`, letting
    `index.html`'s flex centering do it alone).
  - **The Gear button no longer overlaps the "Wave N / M · Phase" banner**
    at any wave count/phase combination — confirm especially the widest
    real string, "Wave 10 / 10  ·  Between Waves," and that the banner's
    font doesn't shrink so far it becomes hard to read.
  - **The Main Menu**: "New Game" (was "Create Party (new)") now sits in the
    old START button's slot; Enter/Space go straight to character creation;
    every button below it shifted up 90px — confirm nothing overlaps and the
    bottom instructions text still reads correctly.
  - **A battle is only reachable via "New Game" now** — confirm there is no
    way left to reach a battle with the old classic roster (Ash/Wren/Bram/
    Mira are gone from the game entirely) and that Co-op's "Start Battle"
    still works, now defaulting both players into a small Fighter/Wizard/
    Rogue/Cleric party instead.
  - **Known, deliberate, unverifiable-without-art limits, not bugs**: the
    hero-sprite loading plumbing added this session (`SPRITE_MANIFEST`,
    `createTokenSprite`) has an empty manifest, so it can never visibly do
    anything until a real image file is added — there is nothing to look at
    yet, by design.

- **KI-073 — Phase 25's ten new structure tiers, the opportunistic wall-bash
  AI, and the trap-disarming Saboteur/Warren Stalker (D-116) are not yet
  confirmed by a human in a browser.** Built and verified headless-only
  (typecheck, all 983 tests, production build all pass — 109 modules,
  unchanged; `npm run dev` serves HTTP 200). This is now the NINTH
  consecutive content/mechanics phase to ship without a human playtest
  (joining KI-065 through KI-072). Not yet verified:
  - **All ten new shop items build correctly**: Wicket Gate/Portcullis let
    heroes walk through like Gate does; Snare Wire/Mangler Trap/Net
    Snare/Storm Lance damage the right movement type; Sparring Post/War
    Dais/Low Perch/Sky Bastion grant the right bonus to the right hero type
    standing on them (Low Perch and Sky Bastion especially — confirm Low
    Perch does NOT grant range, only Sky Bastion grants both).
  - **The Shop grid's new pagination**: with 22 items now spanning 2 pages,
    confirm Prev/Next (and Tab/arrow-key paging) work the same way they
    already do in the Gear grid, and that Build mode's Done button still
    lands in the same place it always has.
  - **A normal (non-siege) melee enemy bashing a wall**: block a lane with
    a cheap wall, keep every hero out of that enemy's reach, and confirm the
    combat log reads "`<enemy>`, unable to reach a hero, pounds/smashes the
    `<wall>`" rather than the enemy just standing there or detouring around
    when there's truly no other route.
  - **Saboteur/Warren Stalker disarming a trap**: place a trap in a lane
    these spawn in (Free Play/Bestiary — neither is wired into a campaign
    wave yet) and confirm the trap's token vanishes with a "disarms the
    `<trap>`" log line instead of ever triggering on that enemy.
  - **Known, deliberate limits, not bugs**: Saboteur/Warren Stalker are not
    placed in any existing campaign wave yet (same "reachable via Free
    Play/Bestiary only" precedent Phase 20/21 set for several of their own
    new enemies) — a future phase's job if Kevin wants them in a specific
    wave.

- **KI-072 — Phase 24's sand tile and five new structures/traps (D-115) is
  not yet confirmed by a human in a browser.** Built and verified
  headless-only (typecheck, all 960 tests, production build all pass — 109
  modules, unchanged; `npm run dev` serves HTTP 200). This is now the
  EIGHTH consecutive content/mechanics phase to ship without a human
  playtest (joining KI-065 through KI-071). Not yet verified:
  - **Sand actually refuses a build in the Build UI**: hover the ghost
    preview over a sand tile on Shattered Causeway/Cinderfall Rift/The
    Drowning Vale and confirm it shows the red "✗" invalid-placement cue
    with a "too loose to build on" message, while a hero can still walk
    across the same tile completely normally.
  - **Sand's new board color**: confirm it reads as visually distinct (a
    tan/sand color) from plain floor on the real battle board, and from the
    Map Builder's own Terrain palette (new "Sand" button).
  - **Palisade/Bulwark's actual durability difference**: place each next to
    a siege enemy (Phase 20) and confirm Palisade breaks in only 1-2 hits
    while Bulwark takes noticeably longer than even a plain Barricade.
  - **Watchtower's bonus applying to BOTH hero types**: stand a melee hero
    on it, confirm +1 damage; swap in a ranged hero, confirm the SAME +1
    damage (not the Ranged Perch's range bonus) — this is the first
    platform where that matters.
  - **Frost Trap's restrain**: confirm an enemy that survives the hit
    can't act or move on its very next phase, with a combat-log line
    naming "Frost Trap" specifically (not "Spike Trap" — see the fix
    below).
  - **Bear Trap's single-use consumption**: confirm the trap deals its full
    6 damage once, then its token actually disappears from the board and a
    second enemy can walk straight over that tile untouched.
  - **Every trap now logs its REAL name**: place a Sky Snare, Tangle Root,
    Web Patch (via a terrain-shaping spell), and step something onto an
    acid tile — confirm each produces its own distinct combat-log line
    ("Sky Snare hits...", "Acid hits...", etc.) instead of every one of
    them previously always reading "Spike Trap" regardless of source — a
    real pre-existing bug from Phase 5, only just fixed.
  - **The now-12-button Build shop grid**: confirm all twelve buttons
    render cleanly with no overlap or clipping — checked the bounding-box
    math headlessly (the equip grid has been the taller, dominant one since
    Phase 17), but this is still the most shop buttons ever shown at once.
  - **Known, deliberate limits, not bugs**: a single-use trap has no
    automated coverage for its actual on-board removal (a scene-only
    mechanic, like the pit's push-kill) — the pure `BuildSystem
    .trapIsSingleUseAt` lookup it depends on IS tested. If two different
    enemies enter the same single-use trap tile within the exact same enemy
    phase, both trigger before it's removed — a rare, documented edge case,
    not a bug to chase. No anti-air trap tier was added to mirror
    Frost/Bear Trap (Sky Snare remains the only flyer counter). No
    defensive (AC-granting) platform was built this pass.

- **KI-071 — Phase 23's expanded maps and terrains (a "pit" hazard, hero-
  affecting terrain, mid-battle dynamic terrain, four new maps, D-114) is
  not yet confirmed by a human in a browser.** Built and verified
  headless-only (typecheck, all 937 tests, production build all pass — 109
  modules, up from 104; `npm run dev` serves HTTP 200). This is now the
  SEVENTH consecutive content/mechanics phase to ship without a human
  playtest (joining KI-065 through KI-070) — worth prioritizing an
  in-browser pass soon. Not yet verified:
  - **The pit's push-kill**: on Shattered Causeway (Free Play), land a Push
    weapon-mastery hit or a forced-move spell (Thunderwave, Gust of Wind,
    Reverse Gravity) on an enemy standing near the chasm edge and confirm
    the combat log reads "`<Enemy>` is shoved into a pit and falls to its
    doom!", the enemy is actually removed from the board, and its gold/
    death-trigger effects (if any) still fire normally — this exercises a
    brand-new branch inside `BattleScene.pushEnemyAway` that has never been
    seen run.
  - **Terrain is now actually VISIBLE on the real battle board for the
    first time** — a real, pre-existing gap this phase fixed (previously
    cliff/water/fire/acid all silently rendered as plain floor in
    `BattleScene`, only the Map Builder's own palette ever colored them).
    Confirm every tile type reads as visually distinct in an actual battle,
    not just in the Map Builder — cliff (dark slate), water (blue), fire
    (red), acid (green), pit (near-black with a small ✕ glyph).
  - **Hero-affecting terrain** (Shattered Causeway/The Drowning Vale/
    Cinderfall Rift/Frostbound Hollow, all opted in): confirm a HERO
    standing on fire/water/acid now takes the same damage/status an enemy
    would (burning/slowed/a flat acid hit), logged clearly, while
    Emberford/Saltmere continue to leave heroes completely unaffected
    exactly as before this phase.
  - **The Drowning Vale's cyclical tide**: play a long-enough Free Play run
    and confirm a warning appears at Wave 1 ("The tide rises..." — coming
    at Wave 3"), the flood zone visibly turns to water at Wave 3 with its
    own combat-log line, a similar warning appears before Wave 6, and the
    zone visibly recedes back to floor at Wave 6 — confirm the crossing
    stays usable throughout (slower/riskier, never impassable).
  - **Cinderfall Rift's one-way bridge collapse**: confirm a warning
    appears at Wave 2, the middle bridge span visibly turns to pit (with
    the ✕ glyph) at Wave 4 with its own combat-log line, and that enemies
    (and any hero still trying to use that lane) genuinely reroute onto the
    longer north/south paths afterward, rather than getting stuck.
  - **Frostbound Hollow's verticality**: confirm a flying enemy crosses the
    central cliff ridge directly while a ground enemy is forced to detour
    via the top or bottom row — this exercises PathfindingSystem's existing
    `ignoreWalls` mechanism on a map actually designed to make the
    difference visible, rather than incidental.
  - **The Map Builder's new "Pit" palette option**: confirm it appears in
    the Terrain tab, paints correctly, and that `validateDraft`'s existing
    spawn-can-reach-exit check correctly flags a draft where every route is
    sealed off by pit tiles, the same way it already does for `blocked`/
    `cliff`.
  - **The Free Play map row**: now 7 buttons, up from 3 — confirm all seven
    render without visual overflow/clipping (the row's width is already
    computed, not hardcoded, but this is the narrowest per-button width the
    row has ever been asked to render, and several new map names are long).
  - **Known, deliberate limits, not bugs**: the pit's push-kill mechanic
    itself has NO automated test coverage (it lives in a Phaser scene
    method, not a pure system, like every other weapon-mastery/forced-move
    mechanic in this project) — everything pure it depends on IS tested
    (see `tests/terrain.test.ts`, `tests/dynamicTerrainSystem.test.ts`,
    `tests/newMapsPhase23.test.ts`). No enemy attack currently pushes a
    hero, so a hero cannot yet be shoved into a pit by an enemy — only the
    hero's OWN push effects against enemies can trigger a fall. Dynamic
    terrain events are built-in-map-only; the Map Builder cannot author one
    yet (a documented boundary, not a gap). The map size ceiling (6-20
    cols/6-9 rows) was deliberately NOT raised this pass — see D-114.

- **KI-070 — Phase 22's magic-item expansion (a real SRD magic-item
  catalog, a `+1/+2/+3` enchant overlay, a brand-new loot-drop system, and a
  level-scaled shop, D-113) is not yet confirmed by a human in a browser.**
  Built and verified headless-only (typecheck, all 900 tests, production
  build all pass — 104 modules, up from 101; `npm run dev` serves HTTP 200).
  This is now the SIXTH consecutive content/mechanics phase to ship without
  a human playtest (joining KI-065 through KI-069). Not yet verified:
  - **The Cape of Billowing's flowing-cape visual**: equip it into the new
    "Back" slot (Gear grid, common rarity) and confirm an animated,
    flowing/fluttering shape trails behind that hero's token, following it
    as it moves — this project's first use of Phaser's `update()` per-frame
    lifecycle hook, genuinely unverified in a real browser.
  - **A `+1/+2/+3` enchanted item actually appearing**: since these are
    loot-only this pass (not purchasable in the shop), the fastest way to
    see one is a Free Play run with a high enough enemy-role mix — confirm
    a combat-log line like "`<Enemy>` drops Longsword +2 (Rare) —
    `<Hero>` equips it!" and that the hero's attack numbers visibly change
    afterward.
  - **Most enemies dropping nothing**: confirm a normal minion-heavy wave
    mostly produces NO drop lines at all (12% chance per minion kill) —
    this should feel like the common case, not something firing constantly.
  - **A miniboss/boss/legendary kill's drop feeling meaningfully better**:
    confirm a miniboss (55% chance, uncommon base) and a boss (90% chance,
    rare base) visibly drop more often and at a visibly better tier than an
    ordinary minion over the course of several kills.
  - **The occasional "lucky" one-tier-up drop**: over enough kills, confirm
    an ordinary minion occasionally drops something tagged one rarity tier
    above its normal floor (e.g. an uncommon item from a minion, rather than
    only ever common) — a real but infrequent (12% of drops) event, so this
    may take a while to actually see fire.
  - **A dropped item with nowhere to go auto-sells for gold instead**: fill
    every hero's matching slot for an item type, then get a kill that would
    drop that type — confirm the combat log reads "...but no hero can equip
    it right now — sold for `<n>`g" and the gold HUD reflects it, rather
    than silently discarding the drop or crashing.
  - **Campaign-curated loot feeling thematically different from Free Play**:
    play Emberford Reach (fire-themed pool: Flame Tongue, Amulet of
    Withering, etc.) and Saltmere Shallows (water-themed: Frost Brand,
    Signet of Kinship, etc.) for a while and confirm named-item drops (not
    enchanted mundane gear, which is deliberately NOT restricted) lean
    toward each campaign's own themed subset rather than reading fully
    random like Free Play does.
  - **The shop's level gate**: with a fresh level-1 party, confirm the Gear
    grid shows every mundane weapon/armor plus the original common/uncommon
    flavor items (unchanged from before this phase) but NONE of the
    rare-and-up magic items (including Phase 13.9's original five, now also
    gated for the first time) — then level a D&D-built party up past 4, 8,
    and 13 and confirm rare, then veryRare, then legendary items
    progressively appear in the SAME grid, with no purchase-flow change
    otherwise.
  - **The new "Back" slot's Gear-grid row/label**: confirm it renders
    cleanly alongside the existing nine rows with no overlap, and that
    Cloak of Protection/Cape of Billowing both correctly target it (not
    "Legs," where the older Traveler's Cloak still deliberately lives —
    that item was NOT migrated, by design, to avoid any save-compatibility
    risk).
  - **New magic items' actual procs/conditional bonuses**: Flame Tongue/
    Frost Brand/Dagger of Venom's on-hit effects (a save-or-extra-damage
    roll, or an unconditional Poisoned application); Bracers of Archery's
    bonus applying ONLY while a ranged weapon is equipped, vanishing the
    instant it's swapped for a melee one; Ring of Free Action/Periapt of
    Proof against Poison silently no-oping an application of Restrained/
    Stunned/Poisoned (no log line for the block itself — a real, deliberate
    "nothing visibly happens" outcome, not a bug to chase).
  - **Potion of Speed/Resistance/Restorative Ointment**: a permanent
    movement-tile bump and permanent damage-halving that persist through a
    Short/Long Rest (unlike Rage/Wild Shape's own timer); Restorative
    Ointment clearing an active Poisoned/Slowed/etc. badge from a hero's
    token immediately on use.
  - **Known, deliberate limits, not bugs**: there is no "found but not
    equipped" loot inventory/browsing UI — a drop is auto-equipped or
    auto-sold the instant it happens, with no player choice in the moment
    (a real, documented scope boundary, not a gap to chase). No
    ability-score-setting magic item (Amulet of Health, Gauntlets of Ogre
    Power, Headband of Intellect, and the rest of that real SRD family) was
    added — this game's derived combat stats bake an ability modifier in at
    several different points, not always read live, making a live-override
    hook a real, separately-sized risk. No charge-based active item
    (wand/rod/staff) exists — no "limited uses independent of a class's own
    resource pools" item mechanic exists yet. Enchanted `+1/+2/+3` gear is
    loot-only, not purchasable in the shop this pass.

- **KI-069 — Phase 21's second wave of enemy archetypes (hero-side status
  effects, 12 more mechanics, 24 new enemies, D-112) is not yet confirmed by
  a human in a browser.** Built and verified headless-only (typecheck, all
  864 tests, production build all pass — 101 modules, unchanged; `npm run
  dev` serves HTTP 200). This is the FIFTH consecutive content/mechanics
  phase to ship without a human playtest (joining KI-065 through KI-068) —
  worth prioritizing an in-browser pass soon regardless of which of these
  gets checked first. Not yet verified:
  - **A hero's on-token status badge** (new this phase): apply "poisoned" or
    "silenced" to a hero (e.g. via a Healer/Debuffer hybrid or Anti-caster
    enemy) and confirm a badge appears above the hero's token, matching the
    letter-code style enemies already get, clearing once the status expires.
  - **Silenced blocking casting only**: a silenced hero should show a log
    line and refuse to open its spellbook/use its class ability (Q), but
    should still be able to move and make a basic Attack.
  - **A poisoned hero visibly losing HP** at the start of each player phase,
    with a log line, and (the one genuinely new risk this phase introduces)
    confirm the game correctly shows a Defeat screen if that tick or a
    Reflector's counter-damage happens to kill the party's last hero —
    neither of those death paths existed before this phase, both got their
    own new defensive check, and neither has been seen fire in practice.
  - **Berserker** (Frenzied Cultist, Bloodrage Warlord): confirm its attacks
    visibly hit harder the more damage it's already taken, without any
    change until it crosses a real HP band.
  - **Lifedrinker** (Bloodwisp, Crimson Leech): confirm a log line shows it
    healing off a landed hit, and its HP bar visibly rising.
  - **Splitter/Carrier** (Ooze Splitter, Fungal Splitter, The Husk): confirm
    defeating one spawns Living Splinters adjacent to where it died, with a
    log line — try killing one via a trap or a burn/poison tick too, not
    just a basic Attack, since the death-trigger funnel is meant to fire
    from any of those.
  - **Shielded/Reflector** (Warded Sentinel, Aegis Bearer): confirm repeated
    hits show 0 damage while the ward holds (a log/visual cue would help
    here — currently there's no on-token shield-remaining indicator, a
    known gap, see below), then real damage once it's broken; confirm Aegis
    Bearer also reflects some damage back at the attacker while its shield
    still holds.
  - **Explosive** (Cinder Wretch, Bomber Beetle): confirm defeating one
    detonates an AoE burst hitting nearby heroes, with a log line.
  - **Gold Thief** (Pilferer, Coin Wraith): confirm a landed hit also steals
    visible gold from the HUD, with a log line.
  - **Teleporter** (Blink Stalker, Rift Walker): confirm it periodically
    jumps a real, visible distance toward the stronghold rather than walking
    there normally.
  - **Mimic** (Mimic Chest, Ambush Coffer): confirm it renders as ordinary
    scenery/treasure (not a hostile token) and can't be clicked/targeted
    until a hero moves adjacent, at which point it should visibly transform
    into a normal hostile token and immediately attack.
  - **Healer/Healer-Debuffer hybrid** (Battle Medic, Plague Warden): confirm
    a log line shows healing a nearby wounded ally each phase; confirm
    Plague Warden's hits ALSO poison a hero (both effects from one enemy).
  - **Anti-caster** (Hexbinder): confirm a landed hit silences a hero (see
    the Silenced check above).
  - **Multi-Phase Boss** (Sundered King): confirm its attacks/behavior
    visibly change once it crosses 50% HP (harder-hitting, gains a breath
    attack) — there is no visual/token cue for the phase change beyond a log
    line, a known gap, see below.
  - **Swarm** (Rat Swarm, Locust Swarm): confirm it can visibly stand on the
    same tile as another enemy; confirm its damage drops once Bloodied.
  - **The Free Play boss-picker row**: now 13 buttons, up from 10 — confirm
    all render without visual overflow (flagged as a candidate to look
    cramped in KI-068 already, now more so).
  - **Known, deliberate limits, not bugs**: there is no on-token visual for
    a Shielded enemy's remaining ward amount, or for a Multi-Phase Boss
    having crossed its threshold — both are log-line-only this pass, a
    real UI gap worth a look but not a correctness bug. Swarm's real SRD
    bludgeoning/piercing/slashing damage RESISTANCE is NOT modeled (this
    game has no damage-type-aware resistance system for any attack to hook
    into) — only the occupy-space/condition-immunity/Bloodied-half-damage
    thirds of the real trait are real. A hero's `preventsAction`/
    `movementReduction` consumption (stunned/restrained fully locking a
    turn, slowed reducing move range) is real and wired, but nothing in
    this batch's roster actually inflicts either on a hero — only
    `damagePerTurn` (poisoned) and `preventsCasting` (silenced) are ever
    applied by an enemy today; the rest of the generic system is plumbed
    and tested but dormant until a future archetype uses it.

- **KI-066 — Phase 18's 13 new feats + enforced prerequisites (D-109) are not
  yet confirmed by a human in a browser.** Built and verified headless-only
  (typecheck, all 778 tests, production build all pass). Not yet verified:
  - **Prerequisite filtering in the Take-a-Feat picker**: a level-1-to-3
    D&D-built hero reaching its first ASI (level 4) should see Grappler
    ONLY if Str or Dex is 13+; a Fighter/Paladin/Ranger should see all 4
    Fighting Style feats, a Wizard/Cleric/Sorcerer/Warlock should see NONE
    of them; no hero below level 19 should ever see an Epic Boon.
  - **The ability-picker follow-up**: picking Grappler or any Epic Boon
    should show a SECOND screen listing only the feat's allowed abilities
    (Grappler: Str/Dex only; Irresistible Offense: Str/Dex only; Spell
    Recall: Int/Wis/Cha only; the other 5 boons: all six) — picking one
    should raise that score by 1 (by 30 for a boon, confirm it can exceed
    the usual 20 cap) and visibly update derived stats.
  - **Magic Initiate's list picker**: picking it should show a THIRD screen
    (Cleric/Druid/Wizard); the granted 2 cantrips + 1 leveled spell should
    appear in that hero's spellbook overlay and be castable even for a
    Fighter/Rogue/Barbarian/Monk with zero normal spell slots (once, until
    a Long Rest); picking Magic Initiate again at a later ASI level should
    only offer the 2 remaining, not-yet-taken lists.
  - **Grappler in combat**: a landed basic-attack hit should sometimes log
    a save roll and "restrains" message; while an enemy is restrained, that
    hero's own attacks against it should visibly roll with Advantage.
  - **Boon of Combat Prowess/Boon of Fate** (level 19+ only, so may need a
    very long test run or a save-file trick to reach): a missed attack
    should sometimes convert into a hit with a log line; Boon of Fate
    should auto-boost one attack per rest with a log line.
  - **Known, deliberate boundaries, not bugs**: Skilled and 3 Epic Boons
    (Dimensional Travel/the Night Spirit/Truesight) should visibly do
    nothing beyond being recorded (no crash, no numeric change) — same
    treatment as Alert/Athlete already get. (Two-Weapon Fighting was in
    this list too, but is now mechanically active — see **KI-067**.)
    Boon of Irresistible Offense's damage-resistance-ignoring half never
    shows any effect (this game has no damage-resistance system) — only
    its natural-20 bonus-damage half is real. Epic Boons in general are
    correctly gated at level 19+ but no single run currently reaches that
    level (10 waves max, nothing persists a hero's level between runs) —
    this is the same honest gap Barbarian's level-20 Primal Champion
    already has, not a new bug.

- **KI-067 — Phase 19's real dual-wielding, unlocking Two-Weapon Fighting
  AND Nick (D-110), is not yet confirmed by a human in a browser.** Built
  and verified headless-only (typecheck, all 789 tests, production build
  all pass). Kevin asked directly for Two-Weapon Fighting to be built
  rather than left inert; building its real prerequisite (dual-wielding)
  also gave Nick — inert since Phase 17 for the identical reason — a real
  hookup for free. Not yet verified:
  - **Equipping a second Light weapon (Dagger, Handaxe, Light Hammer,
    Sickle, Scimitar, Shortsword) into the off-hand**: with an empty
    `"weapon"` slot, it should go there first; with `"weapon"` already
    filled, it should land in `"shield"` instead (the Gear log line should
    say "into Shield" even though it's actually the off-hand). Trying to
    equip one while a real Shield already occupies that slot should be
    REFUSED with a message asking to unequip the Shield first, not
    silently replace the main-hand weapon.
  - **The off-hand attack firing in combat**: with a Light melee weapon in
    both hands, a basic attack should be immediately followed by a second
    "off-hand" attack log line against the same enemy, consuming the
    bonus action (confirm Second Wind/Cunning Action/etc. become
    unavailable afterward for a hero that has one of those).
  - **Nick making it free**: if either equipped Light weapon has the Nick
    mastery (Dagger, Light Hammer, Sickle, Scimitar), the off-hand attack
    should still fire but the bonus action should remain available
    afterward.
  - **Two-Weapon Fighting's damage bump**: without the feat, the off-hand
    attack's damage should be the weapon's flat number alone (no ability
    modifier); with the feat, it should visibly include the modifier.
  - **The Two-Handed/Shield conflict gate still holds**: equipping a
    Two-Handed weapon should still refuse if an off-hand weapon (not just
    a Shield) already occupies that slot, and vice versa.

- **KI-068 — Phase 20's "tons of different enemies" pass (D-111) is not yet
  confirmed by a human in a browser.** Built and verified headless-only
  (typecheck, all 813 tests, production build all pass — 101 modules,
  unchanged; `npm run dev` serves HTTP 200). Six brand-new mechanics across
  twenty-one new enemies, the single biggest enemy-roster change since
  Phase 13.10 — nothing about how these actually feel/read on the board has
  been seen. Not yet verified:
  - **Siege enemies destroying a wall** (Siegebreaker, Battering Brute,
    Juggernaut, Ashen Sovereign): place a Barricade/Gate next to one and
    confirm it attacks the STRUCTURE instead of a nearby hero, the log
    shows damage against it, and it visibly breaks apart (token removed,
    tile buildable again) after enough hits — then confirm the siege enemy
    goes back to attacking heroes/advancing normally once the wall is gone.
  - **Stealth enemies** (Shadowfang, Nightblade): confirm one is NOT
    clickable at all (shows as a low-opacity "?" token) until it strikes —
    at which point it should become a normal, fully-visible, clickable
    token permanently. Confirm an AI-controlled hero also can't target it
    while hidden.
  - **Aura/captain enemies** (Warcaptain/Battlepriest/Bannerbearer,
    Warlord Korrath): confirm a translucent ring renders under the
    captain's token, and that a DIFFERENT nearby enemy's attack numbers
    (to-hit, damage, or movement, depending which captain) visibly change
    while it's alive and nearby, reverting once it dies or the ally
    wanders off.
  - **Reinforcement callers** (Cultist Caller, Bone Summoner, The Devourer,
    The Hollow Empress): confirm new enemies actually appear on the board
    next to the caller on the expected cadence, with a combat-log line
    ("X calls reinforcements — ...").
  - **Treasure-laden enemies** (Hoarder, Gilded Carrier, The Devourer, The
    Hollow Empress): confirm the combat log shows the bonus gold separately
    ("... (+Ng treasure!)") and the gold HUD reflects the full total.
  - **AoE/breath enemies** (Cave Drake, Frost Warden, Ashen Sovereign, The
    Hollow Empress): confirm a party standing together all take damage (or
    all roll a save) from ONE enemy attack in the same phase, not just the
    nearest hero.
  - **Pure runners** (Sprinter, Bolt Runner): confirm one walks straight
    past/through a hero without ever attacking, and can only really be
    stopped by a wall or trap in its path.
  - **The new Bestiary "LEGENDARY" section and Free Play's now-10-button
    boss row**: confirm both render without visual overflow — the boss row
    in particular was flagged as a candidate to look cramped (10 buttons
    where there used to be 5), a real open question, not a known bug.

- **KI-065 — Phase 17's real weapons/armor/weapon-mastery pass (D-108) is not
  yet confirmed by a human in a browser.** Built and verified headless-only
  (typecheck, all 744 tests, production build all pass — 101 modules, up
  from 98; `npm run dev` serves HTTP 200). This is the first genuinely new
  equipment ARCHITECTURE since Phase 11.5 (a new `"weapon"`/`"shield"` slot
  type, real armor replacing the AC formula instead of adding a flat bonus),
  so the in-browser pass matters more than usual. Not yet verified:
  - **The Gear shop grid's new pagination**: open Gear near a shop tile and
    confirm the grid shows 16 items (4x4) at a time with "◀ Prev"/"Next ▶"
    buttons and a "Page N/M" label below the grid; clicking Next/Prev should
    move to the next/previous page; arrow-key navigation (Tab into "grid"
    focus, then arrow keys) should cross a page boundary seamlessly when
    moving past the last row of a page.
  - **Equipping a weapon changes a hero's actual combat numbers**: equip a
    Dagger (1d4, melee) on a hero, note its Attack profile, then swap to a
    Greatsword (2d6, Heavy/Two-Handed) — the hero's basic-attack damage
    should visibly jump; equip a Longbow (Ammunition) and confirm the hero
    can now attack from 3 tiles away instead of 1. Unequipping the weapon
    entirely should return the hero to its exact original numbers.
  - **A Versatile weapon's grip**: equip a Longsword (1d8/1d10 versatile)
    with no Shield — damage should reflect the bigger 1d10 die; then equip a
    Shield too — damage should drop to reflect the smaller 1d8 die, and AC
    should rise by 2.
  - **Two-Handed + Shield conflict**: try to equip a Shield while a
    Two-Handed weapon (Greatsword, Greataxe, etc.) is equipped, and vice
    versa — both directions should be REFUSED with a message, no gold spent.
  - **Real armor replacing the AC formula**: equip Leather Armor (light) and
    confirm AC matches the old unarmored-plus-Dex shape; equip Plate Armor
    (heavy) on a high-Dex D&D-built hero and confirm the Dex bonus is
    COMPLETELY ignored (AC should read exactly 18, not 18+Dex); equip a
    Shield on top of either and confirm it still adds +2.
  - **Every weapon mastery's actual battle feel** (each needs a few real
    swings to see): a Push weapon (Greatclub, Pike, Warhammer, Heavy
    Crossbow) shoving a hit enemy back 2 tiles; a Sap weapon (Mace, Spear,
    Flail, Longsword, Morningstar, War Pick) making the target's next attack
    roll with disadvantage; a Slow weapon reducing the target's move range
    next enemy phase; a Topple weapon (Quarterstaff, Battleaxe, Lance, Maul,
    Trident) sometimes knocking the target down (a CON save, so it won't
    happen every hit) — confirm the combat log reads a save total vs. DC; a
    Graze weapon (Glaive, Greatsword) still chipping damage in on a MISS; a
    Vex weapon (Handaxe, Dart, Shortbow, Rapier, Shortsword, Blowgun, Hand
    Crossbow) granting a visibly better next attack roll against the SAME
    target only; a Cleave weapon (Greataxe, Halberd) hitting a SECOND
    adjacent enemy once per turn, logged on its own line.
  - ~~Nick (Dagger/Light Hammer/Sickle/Scimitar's mastery) does nothing —
    needs a dual-wielding system this game doesn't have~~ — **RESOLVED by
    D-110** (Phase 19): that system now exists — see **KI-067**.
  - **Known, deliberate limits, not bugs**: Two firearms (Musket, Pistol)
    are deliberately excluded for fantasy-setting tone. Ammunition isn't
    tracked as a consumable resource. A heavy armor's Strength requirement
    and any armor's stealth disadvantage show up as real data (Compendium/
    tooltip) but don't affect movement or stealth checks — no such systems
    exist yet. Weapon mastery applies to whoever wields the weapon
    regardless of class, not gated by the SRD's real per-class "unlocked
    mastery slots" rule.
  - **A real side effect worth knowing about, not a bug**: every weapon and
    armor item is `rarity: "common"` (they're mundane, not magic), so all
    48 of them automatically joined `STARTING_GEAR_IDS`
    (`data/characterCreation.ts`, Phase 13.11's "every common/uncommon item
    is a free starting-gear option" rule) — the free-starting-gear pool at
    character creation grew from 12 to roughly 60 items. This is arguably
    an improvement (a starting weapon/armor is thematically a BETTER fit
    for "starting gear" than a random magic trinket) but the picker itself
    is still a simple one-at-a-time cycle button with no search/filter —
    confirm it doesn't feel tedious to click through in practice.

- **KI-064 — Phase 16's "make all spells usable" pass (D-106, plus a same-day
  D-107 follow-up fix) is not yet confirmed by a human in a browser.** Built
  and verified headless-only (typecheck, all 695 tests, production build all
  pass; `npm run dev` serves HTTP 200). This is by far the largest single
  content/systems addition in the project's history (~184 spells wired to a real
  `AbilityDefinition`, six new mechanics, six classes' known-spell lists
  expanded from 1-2 entries to their full real list), so the in-browser
  pass matters more than usual here. Not yet verified:
  - **The new spellbook grid/paging UI** (`BattleScene.renderSpellbookOverlay`)
    — a Wizard now has 7 cantrips + up to 106 leveled spells, filtered at
    any moment by which slots remain. Confirm the 4×3 grid lays out
    cleanly, Prev/Next paging works, and the page resets to 0 each time the
    spellbook (re)opens.
  - **Every new ability kind's actual battle feel**: `aoeAtRange` tile-aiming
    (Fireball etc.), `teleportSelf` (Misty Step etc.), `summonsId` placement
    and the summoned token's auto-attack each turn, `altersTerrainId`
    placement and its auto-expiry, `forcedMoveTiles` push resolution,
    `areaAllies` heal/buff, and the five new status effects
    (poisoned/restrained/blinded/exposed/charmed) and three new ally buffs
    (blessed/warded/guided) showing up correctly in the combat log and on
    tokens.
  - **Summon and spell-placed-structure tokens** are minimal placeholder art
    (a plain colored circle/rectangle, no bespoke sprite) — same "coloured
    shapes, no final art" state as the rest of the project (KI-004), not a
    regression specific to this phase.
  - **Balance is a first-pass, untuned formulaic scaling** (damage/duration
    scale linearly with spell level per a flat, documented formula) — same
    "untuned first pass" status as every other balance number in this
    project (KI-015/KI-028), now applied to ~184 more numbers at once. A
    real feel/balance pass across this many new spells will take a while.
  - **Both fixed in a same-day follow-up (D-107) — no longer open:**
    - ~~`aoeAtRange` abilities do not support `savingThrow`~~ — **RESOLVED.**
      `BattleScene.castAoeAtRangeSpell` now branches on `ability.savingThrow`:
      when present, every enemy in the blast rolls independently against the
      caster's `spellSaveDC` (mirroring `castSavingThrowAbilityOn`'s
      single-target rule) instead of an attack roll. 25 of the 29
      `aoeAtRange` spells that read as a real SRD save spell (Fireball,
      Lightning Bolt, Confusion, Stinking Cloud, etc.) now carry a
      `savingThrow` field with the correct ability score. A related bug
      found in the same fix: `forcedMoveTiles` (Thunderwave, Gust of Wind,
      Reverse Gravity) was never actually applied on an `aoeAtRange`
      ability at all — also fixed, pushing every surviving hit target away
      from the blast's own tile. New `tests/abilities.test.ts` guards
      against this class of bug recurring (no ability may combine `autoHit`
      with `savingThrow`; every `savingThrow.ability` is a real ability
      score id).
    - ~~Warlock's Hellish Rebuke missing from the catalogue~~ — **RESOLVED.**
      Added to `data/spells.ts` (319 spells now, up from 318) and wired
      with a real `abilityId`, modeled as a normal action-cost attack
      rather than the SRD's reaction (this game has no reaction economy
      for a caster to hook a damage-triggered spell into — same
      simplification precedent as Uncanny Dodge's auto-apply). Added to
      `WARLOCK_LEVELED_SPELL_IDS`.
  - **Still open, not attempted in the D-107 follow-up**:
    - **Paladin and Ranger were NOT given a spellbook.** Their half-caster
      spell slots stay dedicated to auto-consuming Divine Smite/Hunter's
      Mark (Phase 13.8, D-093) — adding a spellbook on top would double-book
      the same slot pool. A real future decision (build a spellbook AND
      teach it to share slots with those two auto-effects, or replace the
      auto-effects with spellbook casts), not attempted this pass.
    - **`SummonSystem`'s active summons are not part of `BattleStateSnapshot`**
      (Phase 12.1, D-101) — a coop battle or a future mid-battle autosave
      would not preserve a summoned ally across the round trip. Logged the
      same way `RandomService`'s PRNG state was deliberately excluded from
      that same snapshot.

- **KI-062 — Phase 12.2's cooperative session lobby (D-102) is not yet
  confirmed by a human in a browser.** Built and verified headless-only
  (typecheck, all 661 tests including the new
  `tests/coopSessionSystem.test.ts`, and the production build all pass;
  `npm run dev` serves HTTP 200). Not yet verified:
  - **The full two-tab flow**: open two browser tabs (or two profiles) to
    the deployed game, click "Co-op" in each, Create a session in one tab
    and Join it with the code in the other — both tabs' participant lists
    should update live (via Firestore's realtime listener) without a
    manual refresh.
  - **The join-code `<input>` itself** — this project's FIRST free-text
    field. Confirm it's positioned correctly at different window
    sizes/aspect ratios (this canvas scales via `Phaser.Scale.FIT`, and
    Phaser DOM Elements are a known fiddly interaction with that scaling
    mode), that paste (Ctrl+V) actually works, and that typing
    auto-uppercases/strips non-alphanumeric characters as intended.
  - **Every join-failure message**: a wrong/nonexistent code ("No session
    found"), joining a session that already has two players ("already has
    two players"), and rejoining your own session after a refresh (should
    silently land you back in the lobby, not show an error).
  - **The rules deploy itself**: `firestore.rules`' new `coopSessions`
    block hasn't been deployed to the live project yet, and its test
    coverage in `firestore-tests/rules.test.ts` is written but still
    UNRUN — same standing JDK 21+ emulator limitation as every Firestore
    rules addition since Phase 10 (KI-047).
  - **Partially addressed by Phase 12.3 (D-103)**: the lobby can now start
    a battle (host-only "Start Battle", once full), and both clients land
    in `BattleScene` with correct per-hero ownership gating. Still true
    that the two clients' boards don't stay in sync with each other's
    actions once in battle — see **KI-063**.

- **KI-063 — Phase 12.3's turn-lock ownership (D-103) is not yet confirmed
  by a human in a browser, AND result-broadcast (live two-client board
  sync) is explicitly not built yet, not an oversight.** Built and
  verified headless-only (typecheck, all 664 tests, production build all
  pass; `npm run dev` serves HTTP 200). Not yet verified:
  - **The full two-tab coop-battle flow**: create/join a session in two
    tabs, host clicks "Start Battle" once full, both tabs should land in
    `BattleScene` with the right heroes shown as yours vs. your partner's.
  - **The ownership gate itself**: clicking a partner's hero (by mouse tile
    click, the number-key hotkeys, or the keyboard cursor's Enter/Space
    activation) should show "Waiting for `<name>`'s turn…" and not select
    it; clicking your OWN heroes should work exactly like solo play.
  - **The `firestore.rules` deploy**: the `coopSessions` block's new
    "start battle" update shape hasn't been deployed to the live project
    yet, and its test coverage in `firestore-tests/rules.test.ts` is
    written but still UNRUN — same standing JDK 21+ emulator limitation as
    every Firestore rules addition since Phase 10 (KI-047).
  - **Known, deliberate limit, not a bug**: once in a coop battle, the two
    clients' boards do NOT converge as either side acts — there is no
    result-broadcast/visual-reconciliation system yet (see D-103's own
    investigation: `BattleScene` spawns enemies/structures dynamically with
    no existing "redraw everything from the current model" function to
    reuse, making this a real, separately-sized piece of work, not
    something safe to bolt on quickly). Playing a coop battle right now
    will visibly desync the instant either player acts — this is expected
    until the next sub-phase, not a bug to chase.

- **KI-061 — Phase 14.1's Circle of the Land correction (D-098) and Phase
  14.2's twelve original subclasses plus real subclass-choice UI (D-099) are
  not yet confirmed by a human in a browser.** Built and verified
  headless-only (typecheck, all 648 tests including a further-expanded
  `subclasses.test.ts` and more `classLeveling.test.ts` cases, and the
  production build all pass). Every class now has TWO modeled subclasses —
  reachable via the "Create Party" flow (a new Subclass row lets a
  Cleric/Sorcerer/Warlock build pick between them at creation) and via
  `BattleScene`'s subclass-choice overlay (now two buttons instead of one)
  for every other class. Not yet verified:
  - **The new Subclass row** (Cleric/Sorcerer/Warlock only): should show the
    currently-picked subclass's name with "(click to change)", and clicking
    it should cycle between the SRD option and the original one. Every
    other class's row should be unclickable, showing "Subclass: chosen in
    battle at level N (2 options)".
  - **A real TWO-BUTTON choice in battle**: build a Fighter (or any
    later-choice class) party and play until it reaches its subclass-choice
    level — the overlay should now show two buttons ("Choose: Champion" and
    "Choose: Battle Tactician" for Fighter, etc.), not one.
  - **Layout**: the Subclass row's addition grew the creation-screen column
    another 40px, shifting every control below it (party size/difficulty,
    Start Battle/Save Party, status text, Back) down another 40px — confirm
    nothing overlaps or runs past `GAME_HEIGHT`'s 1080px budget.
  - **The twelve new original subclasses' real hookups**, one per class:
    Ironhide Stance (+2 AC while raging, Barbarian), Battle Hymn/Crusader's
    Wrath/Tactician's Precision (+1 to-hit, Bard/Cleric/Fighter), Ember
    Shape (bigger Wild Shape heal, Druid), Iron Skin/Umbral Ward (+1 max
    HP/level, Monk/Warlock), Retributive Smite (bigger Divine Smite,
    Paladin), Bonded Strike (self-heal on the Ranger's own Hunter's Mark
    target, alongside Colossus Slayer if both are present on different
    heroes), First Strike (bonus damage on a Rogue's first hit each battle),
    Volatile Magic (+1 max Sorcery Point), Arcane Deflection (+1 AC,
    Wizard).
  - **Draconic Resilience/Way of the Iron Body/Starbound Patron all now
    share one HP-per-level mechanism** (`Hero.subclassHpPerLevelBonus`,
    renamed from the old Draconic-specific getter) — confirm a Draconic
    Bloodline Sorcerer's own HP bonus still works exactly as before (KI-060
    already covers this in detail).
  - **Known, deliberate limits, not bugs:** the twelve original subclasses'
    OTHER feature (one apiece) stays intentionally inert — see each one's
    description in `data/subclasses.ts`. These are original names/flavor,
    NOT real D&D content — the SRD only ever licenses one subclass per
    class (verified directly against both SRD 5.1 and 5.2.1 this chat, not
    assumed); seeing an unfamiliar subclass name in the game is expected,
    not a bug.

- **KI-060 — Phase 14's eight new subclasses (Path of the Berserker, College
  of Lore, Circle of the Land, Way of the Open Hand, Oath of Devotion,
  Hunter, Draconic Bloodline, The Fiend — D-097) are not yet confirmed by a
  human in a browser.** (Corrected post-hoc: this originally said "Circle of
  the Moon" — a real mistake fixed by D-098, see KI-061 below. Druid's real
  SRD subclass has always been Circle of the Land.) Built and verified headless-only (typecheck, all
  617 tests including expanded `subclasses.test.ts` and new
  `classLeveling.test.ts` cases, and the production build all pass).
  Reachable via the "Create Party" flow, building a Barbarian/Bard/Druid/
  Monk/Paladin/Ranger/Sorcerer/Warlock hero (Sorcerer/Warlock get their
  subclass at creation like Cleric; the other five via the existing
  in-battle confirmation overlay at their class's own subclass-choice
  level). Not yet verified:
  - **The creation-screen stats preview**: a Sorcerer/Warlock build should
    now show "Subclass: Draconic Bloodline"/"Subclass: The Fiend"
    immediately, matching Cleric's own treatment; a Barbarian/Bard/Druid/
    Monk/Paladin/Ranger build should show "Subclass: at level N" (no longer
    "(not yet built)").
  - **The in-battle subclass-choice overlay**: build a Barbarian/Bard/Monk/
    Paladin/Ranger party (subclass choice at level 3 for all five) or a
    Druid party (level 2) and play until that hero reaches it — a single
    "Choose: `<Name>`" confirmation button should appear, same shape as
    Champion/Thief's existing overlay.
  - **Draconic Resilience's HP bonus**: a level-1 Draconic Bloodline
    Sorcerer should start at full health with 1 more max HP than an
    otherwise-identical Sorcerer build with no subclass; the gap should grow
    by 1 more each level-up.
  - **Colossus Slayer**: a Hunter Ranger's hit against its OWN Hunter's Mark
    target should read a combat-log line ending "(Colossus Slayer)" and deal
    4 more damage than Hunter's Mark alone.
  - **Dark One's Blessing**: a Fiend Warlock's killing blow should heal it 5
    HP (capped at max) and log "Dark One's Blessing restores `<n>` HP".
  - **Known, deliberate limits, not bugs:** every other new feature across
    all eight subclasses stays intentionally inert — see each feature's own
    description in `data/subclasses.ts` for why (no push/prone, no
    reaction-based damage reduction beyond Uncanny Dodge's own Rogue gate,
    no creature-stat-block transformation, no Channel-Divinity-style
    resource for a Paladin, etc.). This is not a partial implementation to
    keep working on — it's the same "one real subclass, honestly scored"
    treatment D-076/D-096 already gave the original four classes.

- **KI-049 — Phase 13.1's real dice/Armor Class combat (D-086) is not yet
  confirmed by a human in a browser.** Built and verified headless-only
  (typecheck, all 398 tests including new `randomService.test.ts` and the
  rewritten `combat.test.ts` dice-resolution suite, and the production
  build all pass). Not yet verified:
  - Attacks can now actually MISS — confirm the combat log reads "misses"
    (not "hits ... for 0") and that a miss doesn't flash the hit effect or
    (for an ability like Frost Bolt) apply its status effect.
  - A natural-20 crit should read "critically hits" and visibly deal double
    damage; this should happen roughly 5% of the time per attack — worth a
    few dozen attacks in a real session to actually see one.
  - **Every enemy and piece of equipment's old `defense` number was
    converted to Armor Class by formula** (enemy: `10 + old value`;
    equipment: unchanged, now an AC bonus) — first-pass and UNTUNED. This is
    exactly the kind of thing that can feel very different in practice
    (e.g. a warden's AC 13 might miss far more often than its old "reduces
    damage by 3" ever did) — Kevin's in-browser feel pass should specifically
    flag any enemy that feels like it dodges too much or too little.
  - Traps/terrain hazards and the burning status tick should still always
    hit, every time, exactly as before this chat (D-039) — confirm nothing
    about them changed in feel.
  - The classic START roster (Ash/Wren/Bram/Mira) and the D&D character-
    build path should both still play, just with real hit/miss now instead
    of always-hit — confirm neither path crashes or behaves unexpectedly
    (e.g. a built hero's Armor Class reflecting their Dex score).
  - **Known, deliberate limits, not bugs:** damage itself is still a flat
    number (not a dice expression like "1d8+3") — only hit/miss/crit
    determination is randomized this pass. No advantage/disadvantage source
    exists yet in actual play (the mechanism exists in `CombatSystem` but
    nothing grants it yet — that's later Phase 13 content). No saving
    throws, skills, or rest system yet — those are 13.4+. A first slice of
    the action economy (bonus action + 4 class-gated features) shipped in
    13.2 — see KI-050.

- **KI-050 — Phase 13.2's action-economy slice (D-087) is not yet confirmed
  by a human in a browser.** Built and verified headless-only (typecheck,
  all 421 tests including the new `tests/actionEconomy.test.ts`, and the
  production build all pass). Only reachable via a D&D-built Fighter or
  Rogue (`CharacterCreationScene`'s "Create Party (new)" path) — the classic
  START roster and Wizard/Cleric builds have no `classId` match, so they
  should show none of this and play exactly as before. Not yet verified:
  - Selecting a Fighter hero should show a "Bonus: Second Wind (R)" button;
    clicking it (or pressing R) should heal a small flat amount, log the
    actual HP healed, and disable itself until a Short/Long Rest recharges
    it (Phase 13.4, D-088 — see KI-051) or the battle ends.
  - Selecting a Fighter who has already acted this turn should show an
    "Action Surge (F)" button; clicking it (or pressing F) should let that
    hero act again (attack or ability), then disable itself the same way
    (until a rest, per KI-051). Should NOT appear before the hero has acted.
  - Selecting a Rogue who has already moved this turn should show a
    "Bonus: Cunning Action, Dash (R)" button; clicking it (or pressing R)
    should let that hero move again this turn, and should be available
    again next turn (no once-per-battle limit, unlike the two above).
  - **Uncanny Dodge (Rogue) is the one auto-applied, no-button feature** —
    the first time an enemy hits a Rogue hero during an enemy phase, the
    combat log line should read "... (halved by Uncanny Dodge)" and the
    actual damage taken should visibly be about half; it should NOT fire
    again until that Rogue's next turn.
  - **New HUD row placement**: the Bonus Action/Action Surge buttons sit in
    a new row below Ability/Potion — confirm they don't visually collide
    with anything, especially at the bottom of a 9-row map (the tightest
    vertical fit — see D-087's bounding-box note).
  - Confirm the classic START roster and a Wizard/Cleric-only party show
    NEITHER new button at any point, and that R/F do nothing when pressed
    with such a hero selected.

- **KI-051 — Phase 13.4's Rest system (D-088) is not yet confirmed by a
  human in a browser.** Built and verified headless-only (typecheck, all
  434 tests including the new `tests/restSystem.test.ts`, and the
  production build all pass). Not yet verified:
  - Clearing a non-final wave (with no pending level-up, or after resolving
    one) should show a "Rest before the next wave?" overlay with a Short
    Rest button, a Long Rest button (if the current difficulty tier still
    has a charge of either), and always a "Continue" button.
  - Clicking Short Rest should visibly heal every living hero by a partial
    amount (about a quarter of their max HP), recharge any Fighter's Second
    Wind/Action Surge, and decrement the Short Rest count shown on the
    button the NEXT time the overlay appears. Clicking Long Rest should
    fully heal the party instead, and recharge the same resources.
  - Clicking Continue should do nothing except close the overlay — no
    charge spent, resources unchanged.
  - Once the difficulty tier's charges of ONE type are exhausted, that
    button should stop appearing (only the other type, and/or Continue).
    Once BOTH are exhausted, the overlay should stop appearing at all —
    wave-clears should proceed straight through to the next wave, exactly
    as they did before this chat.
  - The overlay should NOT appear after the FINAL wave of a run clears
    (nothing to rest "before" — the run is ending) — confirm Victory still
    triggers normally right after any pending level-up choice.
  - **Difficulty affects the starting charge pool** — Easy should start
    with more Short/Long Rest charges than Nightmare (see D-088 for the
    exact first-pass numbers); the classic START roster should get Normal's
    budget (3 Short / 1 Long per run) with no difficulty picker shown.
  - Confirm Esc, the tutorial-reopen key (H), and normal board input all
    stay blocked while this overlay is up, the same way the level-up choice
    overlay already blocks them.

- **KI-052 — Phase 13.3's real per-class leveling and Extra Attack (D-089)
  are not yet confirmed by a human in a browser.** Built and verified
  headless-only (typecheck, all 448 tests including the new
  `tests/classLeveling.test.ts` and new `CharacterSystem`/
  `CharacterBuildSystem` cases, and the production build all pass). Only
  reachable via a D&D-built party (`CharacterCreationScene`'s "Create Party
  (new)" path) — the classic START roster still uses the old flat Vigor/Might
  choice and should play byte-for-byte as before. Not yet verified:
  - Clearing a wave-clear threshold with a D&D-built party should NOT show
    the old "Level Up! Vigor/Might" overlay at all — instead the combat log
    should read "`<Hero>` reaches level `<N>`!" for each living hero, with no
    modal to click through, then proceed straight into any Rest-choice
    overlay/next wave exactly as before.
  - Each hero's status line (bottom HUD text) should now show "Lv `<N>`"
    right after its name, for a D&D-built hero only — the classic roster's
    status line should be unchanged (no "Lv" shown).
  - **A leveled-up hero's stats should visibly change**: max HP should rise
    (and current HP should rise by the SAME amount, not fully heal — a hero
    who took damage before leveling should still show as hurt afterward,
    just less hurt), and a melee/ranged basic attack's damage number in the
    combat log should shift for classes with a scaling rider (a Rogue's
    Sneak Attack) or a scaling ability modifier isn't expected to itself
    change, but attack rolls should hit more reliably as proficiency rises.
  - **Extra Attack (Fighter only, from level 5): clicking one enemy with the
    Attack action should now log TWO (or three, at level 11; four, at level
    20) separate hit/miss lines against that same target**, and the combat
    log should ALSO note "(now attacks Nx per turn)" the moment the hero
    first reaches the level that grants it. If the first swing defeats the
    target, later swings this action should simply not happen (no error, no
    extra log lines) — confirm nothing crashes when Extra Attack finishes off
    an enemy on its first hit.
  - Confirm a Wizard/Cleric/Rogue-built party still shows the level text and
    levels up on cadence, but NEVER gains extra attacks (their
    `attacksPerActionByLevel` never rises above 1) — only a Fighter should.
  - Confirm the classic fixed roster (Ash/Wren/Bram/Mira) is entirely
    unaffected: still the old Vigor/Might overlay, no "Lv" text, never more
    than one attack per Attack action.

- **KI-053 — Phase 13.5's Sacred Flame saving throw and the new Skills
  Compendium tab (D-090) are not yet confirmed by a human in a browser.**
  Built and verified headless-only (typecheck, all 475 tests including the
  new `savingThrowSystem`/`initiativeSystem`/`skills` suites, and the
  production build all pass). Only reachable via a Cleric-built hero
  (`CharacterCreationScene`'s "Create Party (new)" path, Cleric class, Sacred
  Flame chosen as the signature ability) — every other hero/ability is
  unaffected. Not yet verified:
  - Casting Sacred Flame on an enemy should now sometimes do NOTHING —
    confirm the combat log reads "`<Enemy>` resists `<Hero>`'s Sacred Flame
    (save `<total>` vs DC `<n>`)" on a save, and "`<Hero>`'s Sacred Flame
    sears `<Enemy>` for `<n>`" (or "defeats" if it's the killing blow) on a
    failed save — roughly half the time or so, not "always hits" like
    before this chat.
  - Confirm every OTHER hero ability (Cleave, Piercing Shot, Taunting Slam,
    Frost Bolt, Fire Bolt, Ray of Frost) still always hits exactly as
    before — only Sacred Flame changed.
  - The Compendium's new "Skills" tab (main menu → Compendium) should list
    eight skills, each with its governing ability score — confirm it
    doesn't visually overflow and reads cleanly like the existing Feats tab.
  - **Known, deliberate limits, not bugs:** `InitiativeSystem` is
    intentionally NOT surfaced anywhere in the UI — it exists purely as a
    tested, callable system for a future need, per Kevin's explicit
    "framework only" ask (D-086). Skills have no proficiency concept and no
    in-game skill check anywhere — the Compendium entry is reference-only,
    not a sign of a new mechanic.

- **KI-059 — Phase 13.11's character-creation flow overhaul (real subclass
  choice, free starting gear, D-096) is not yet confirmed by a human in a
  browser.** Built and verified headless-only (typecheck, all 596 tests
  including new/updated `subclasses`/`classLeveling`/`combat`/
  `characterCreationData`/`characterBuildSystem`/`equipment` cases, and the
  production build all pass). Reachable via the "Create Party" flow
  (`CharacterCreationScene`) and any resulting battle. Not yet verified:
  - **The new Gear row**: cycling it on any hero slot should show "Gear:
    None" then each common/uncommon item by name in turn; the stats-preview
    block below it should NOT visually overlap the Gear row or run past the
    column's card border (a real layout change this chat — the column grew
    40px taller and every row below it shifted down 50px).
  - **Starting item shows up equipped**: pick a non-"None" Gear item, Start
    Battle, and open that hero's Gear panel mid-battle — the picked item
    should already be equipped in its correct slot (a ring in Ring 1),
    contributing its AC/attack-damage bonus, with no gold spent on it.
  - **The new subclass line**: a Cleric build should show "Subclass: Life
    Domain" immediately (no overlay, no delay); a Fighter/Wizard/Rogue build
    should show "Subclass: at level 3" (or 2 for Wizard); any other class
    should show "Subclass: at level N (not yet built)".
  - **The subclass-choice overlay in battle**: build a Fighter (or Wizard/
    Rogue) party and play until that hero reaches level 3 (Wizard: 2) — a
    "`<Hero>` reaches level `<N>`!" overlay should appear with a single
    "Choose: Champion" (or the matching subclass name) button, blocking
    board input/Esc/H until clicked; the combat log should then read
    "`<Hero>` becomes a Champion!". If the SAME level-up also grants an
    Ability Score Improvement (it never does for these three classes at
    these specific levels today, but confirm regardless), the subclass
    overlay should resolve FIRST, then the ASI overlay.
  - **Champion's Improved Critical**: once a Fighter with Champion reaches
    level 3, its basic Attack should start critting (double damage) on a
    natural 19 as well as a 20 — noticeably more often than before; at level
    15 (Superior Critical), also on a natural 18. Verify only the basic
    Attack action gets this — an ability (Cleave, etc.) should still only
    crit on a natural 20.
  - **Life Domain's Disciple of Life/Blessed Healer**: a Life Domain Cleric
    casting Cure Wounds on an ally should heal for 2 more than the base
    amount, with "(Disciple of Life)" appended to the combat log line; once
    that Cleric reaches level 6, casting it on someone ELSE should ALSO log
    a separate "`<Hero>` also regains 2 HP (Blessed Healer)" line — casting
    it on itself should NOT trigger Blessed Healer (no double-count).
  - **Known, deliberate limits, not bugs:** with exactly one subclass
    modeled per class, the confirmation overlay has only one button — not a
    real choice between options yet (a future second subclass would add a
    second button here, unchanged otherwise). The eight classes with no
    modeled subclass yet show "(not yet built)" rather than a choice. Life
    Domain's Channel Divinity: Preserve Life stays inert (no AoE-ally-heal
    targeting exists). Starting gear is one free item, not a full
    weapon/armor/pack equipment package.

- **KI-058 — Phase 13.10's enemy roster expansion (Marauder, Blightcaller,
  Gravemaw, Blightmother, D-095) is not yet confirmed by a human in a
  browser.** Built and verified headless-only (typecheck, all 569 tests
  including new `tests/enemyRoster.test.ts`, and the production build all
  pass). Reachable via Free Play mode ("Expanded" minion source for
  Marauder/Blightcaller; either boss picker slot for Gravemaw/Blightmother)
  or once they turn up in any battle at all (Bestiary "seen" tracking). Not
  yet verified:
  - **Blightcaller** (and Blightmother): its attack should log a normal
    "hits"/"misses"/"defeats" line like any other enemy — confirm nothing
    reads oddly even though it's actually resolving a saving throw under
    the hood, not a to-hit roll. Against the classic fixed roster (no
    ability scores), it should land noticeably more often than against a
    D&D-built hero with a real DEX save.
  - **Gravemaw/Blightmother's boss presentation**: selecting Free Play and
    picking either as the finale boss should show the SAME bigger-token/
    gold-outline/name-banner treatment Cinderlord/Tidelord/basalt-colossus
    already get — confirm the banner reads "(Miniboss)" for Gravemaw and
    "(Boss)" for Blightmother, not both saying "(Boss)".
  - **The Free Play boss-picker row**: now 5 buttons instead of 3 — confirm
    all five render fully on-screen with no overlap/clipping at the
    computed narrower width, and every name (including "Basalt Colossus,"
    the longest) still reads cleanly.
  - **Cinderlord/Tidelord's boss presentation** (a pre-existing gap this
    chat fixed, not new content): confirm THEY now also show the bigger-
    token/banner treatment in any battle where one appears — before this
    chat they silently rendered as ordinary small tokens.
  - **Known, deliberate limits, not bugs:** no enemy inflicts a status
    effect (Slowed/Stunned/Burning) on a hero — this game's status-effect
    system is enemy-only; that's real, separate future scope, not shipped
    this pass. Gravemaw/Blightmother have no campaign/map of their own yet
    (reachable via Free Play/Bestiary only). Neither new enemy was added to
    the classic 10-wave campaign or the Emberford/Saltmere campaigns'
    hand-tuned wave lists.

- **KI-057 — Phase 13.9's loot/equipment expansion (rarity, attunement, and
  four on-hit/on-kill procs, D-094) is not yet confirmed by a human in a
  browser.** Built and verified headless-only (typecheck, all 554 tests
  including the expanded `tests/equipment.test.ts`, and the production build
  all pass). Reachable from ANY party (classic roster or a D&D-built one) via
  the Gear grid — five new items (`Ring of Frostbite`, `Amulet of Withering`,
  `Signet of Kinship`, `Greaves of the Berserker`, `Aegis of the First Ward`)
  now sit alongside the original 12. Not yet verified:
  - The Gear grid should show a "· Rare"/"· Very Rare"/"· Legendary" tag on
    the five new items (and no tag change on the original 12, now retro-
    tagged common/uncommon internally but NOT shown unless above common).
  - Equipping any of the five new items onto a hero already wearing 3
    attunement items elsewhere should be REFUSED with "`<Hero>` is already
    attuned to 3 items — unequip one first" — no gold should be spent.
  - **Ring of Frostbite** (ring): a landed basic-attack hit should apply
    Slowed to the target unconditionally (no save) — confirm the on-token
    status badge appears and the enemy's movement is visibly reduced next
    enemy phase.
  - **Amulet of Withering** (amulet): a landed basic-attack hit should log
    either "resists ... (save N vs DC 13)" or "sears ... for 3 more damage" —
    confirm both outcomes are reachable over several attacks (not always one
    or the other).
  - **Signet of Kinship** (ring): defeating an enemy with a basic attack
    while wearing this should heal the nearest OTHER living ally (or the
    wearer itself if it's the only hero left) for 4 HP, logged and reflected
    in that hero's HP text immediately.
  - **Greaves of the Berserker** (legs): only while the wearer has an active
    Rage/Wild Shape (Barbarian/Druid) should a landed basic-attack hit log
    "flares with ... fury for 3 more damage" — confirm it does NOT trigger
    on any other class, or outside an active buff.
  - **Aegis of the First Ward** (chest, legendary): no proc — just confirm
    its flat +4 AC/+2 attack bonus applies immediately like any other item.
  - Confirm a hero wearing multiple proc items at once (e.g. Ring of
    Frostbite + Amulet of Withering) sees BOTH procs resolve on the same
    landed hit, each on its own combat-log line.
  - **Known, deliberate limits, not bugs:** procs are wired into the basic
    Attack action ONLY, not abilities/spells — same scope boundary as Divine
    Smite/Hunter's Mark (D-093). No item carries more than one proc.
    Attunement is gated entirely at equip time; there is no "worn but not
    attuned" state to see in the UI.

- **KI-056 — Phase 13.8's eight new core classes (D-093) are not yet
  confirmed by a human in a browser.** Built and verified headless-only
  (typecheck, all 544 tests including new `tests/newCoreClasses.test.ts`,
  and the production build all pass). Only reachable via a D&D-built party
  (`CharacterCreationScene`'s "Create Party (new)" path) picking one of the
  eight new classes — the classic START roster and existing four classes
  (Fighter/Wizard/Rogue/Cleric) show none of this and play exactly as
  before. Not yet verified, one item per class:
  - **Barbarian**: selecting one should show "Bonus: Rage (R)"; using it
    should visibly boost the combat log's damage numbers on that hero's
    next attacks and make incoming hits read "(halved by Rage/Wild Shape)"
    for a few turns, then the button should disappear until it runs out —
    confirm a Short Rest ends an active Rage early WITHOUT restoring uses,
    and only a Long Rest restores uses.
  - **Druid**: at level 1 the Q button should NOT show "Bonus: Wild Shape"
    (locked out until level 2); after leveling, using it should heal the
    hero and apply the same "(halved by Rage/Wild Shape)" resistance.
  - **Monk**: melee basic-attack numbers should track Dexterity, not
    Strength (build one with high DEX/low STR and confirm the damage/hit
    rate feels DEX-driven). From level 2, attacking then pressing the bonus
    button ("Bonus: Flurry of Blows") should grant a genuine second attack
    this turn, consuming a Ki point; Ki should refill after EITHER a Short
    or Long Rest.
  - **Paladin**: at level 2+ (once a 1st-level slot exists), a landed basic
    melee attack should sometimes log "empowers the strike with Divine
    Smite for N more damage" automatically, with no prompt — confirm it
    stops once slots run out.
  - **Ranger**: at level 2+, pressing the bonus button ("Bonus: Hunter's
    Mark") should auto-mark the nearest enemy (logged), and that hero's
    subsequent basic-attack hits against the SAME enemy should log an extra
    "Hunter's Mark sears... for N more damage" line.
  - **Bard**: pressing the bonus button ("Bonus: Bardic Inspiration") should
    log inspiring the nearest OTHER living ally (or itself if alone); that
    hero's next attack should log "channels Bardic Inspiration into the
    attack" with a visibly bigger hit. At level 5+, confirm a Short Rest now
    also refills Bardic Inspiration uses (it shouldn't below level 5).
  - **Sorcerer**: at level 3+, pressing the bonus button ("Bonus: Quickened
    Spell") before casting a spell should let that same hero ALSO make a
    basic attack the same turn (the action should stay available after the
    spell resolves) — confirm the spell still costs its normal slot.
  - **Warlock**: spend all spell slots, then take a SHORT Rest (not Long) —
    confirm the spellbook shows slots fully restored (unlike a Wizard/
    Cleric/Bard/Druid/Sorcerer, who should NOT refill on a Short Rest).
  - Confirm the classic START roster and any Fighter/Wizard/Rogue/Cleric
    build still play exactly as before — no new buttons, no behavior change.
  - **Known, deliberate limits, not bugs:** no new subclasses this pass
    (D-093 fork 2). Bardic Inspiration/Hunter's Mark auto-target rather than
    offering a manual aim step (same auto-apply precedent as Uncanny
    Dodge/Lucky). Reckless Attack, Unarmored Defense, Stunning Strike, Lay
    on Hands, and most classes' higher-level features remain data-only,
    same treatment as every existing class's inert entries.

- **KI-055 — Phase 13.7's spellbook, spell slots, and Cure Wounds ally
  healing (D-092) are not yet confirmed by a human in a browser.** Built
  and verified headless-only (typecheck, all 514 tests including new
  `concentrationSystem`/`spellSlots` suites, and the production build all
  pass). Only reachable via a D&D-built Wizard or Cleric
  (`CharacterCreationScene`'s "Create Party (new)" path) — the classic
  START roster and a Fighter/Rogue-built party show none of this and play
  exactly as before. Not yet verified:
  - Selecting a Wizard or Cleric hero should show a "Cast a Spell (Q)"
    button instead of the old "Ability: `<name>` (Q)" — clicking it (or
    pressing Q) should open a modal spellbook overlay listing every spell
    that class knows (a Wizard: Fire Bolt, Ray of Frost, Magic Missile; a
    Cleric: Sacred Flame, Cure Wounds) — NOT just whichever one was picked
    as their "signature ability" at character creation.
  - A leveled spell's button should read "1st-level (N left)"; clicking a
    spell should enter an aiming mode (an outlined valid target appears on
    the board) — an enemy for Magic Missile/Fire Bolt/etc., a living ALLY
    (including the caster's own tile) for Cure Wounds.
  - Casting Magic Missile should always hit for real damage and consume one
    1st-level slot (confirm the spellbook's "N left" count drops next time
    it's opened); once both slots are spent, Magic Missile should no longer
    appear in the list at all (cantrips should still appear, always).
  - Casting Cure Wounds on a damaged ally (or the caster) should visibly
    raise that hero's HP (capped at max) and log "channels Cure Wounds,
    healing `<name>` for `<n>`"; it should also consume a 1st-level slot.
  - Clicking "Short Rest" between waves should NOT restore spent spell
    slots; "Long Rest" SHOULD fully restore them (confirm by checking the
    spellbook's slot count before/after each).
  - Esc should close the spellbook overlay (or cancel an in-progress aim)
    back to the hero being simply selected, same as the existing Ability
    flow; a board click while the spellbook overlay is open should do
    nothing except (per the overlay's dimmed backdrop) close it.
  - Confirm a Fighter/Rogue-built hero, and the classic START roster, still
    show the OLD "Ability: `<name>` (Q)" button and single-ability flow —
    completely unaffected by this chat.
  - **Known, deliberate limits, not bugs:** the spellbook overlay is
    mouse-only — it does not hook into the existing Tab/arrow-key grid
    keyboard-navigation system (D-066) that Build/Gear mode has. Upcasting
    (spending a higher-level slot on a lower-level spell) doesn't exist yet
    — explicitly future scope per Kevin. `ConcentrationSystem` is
    intentionally NOT surfaced anywhere in the UI — framework-only, same
    treatment as `InitiativeSystem` (D-090). Bless, Shield of Faith,
    Guidance, Burning Hands, and Mage Armor remain data-only, uncastable —
    no ally-buff or skill-check mechanic exists to hook them into.

- **KI-054 — Phase 13.6's real ASI-or-feat choice (D-091) is not yet
  confirmed by a human in a browser.** Built and verified headless-only
  (typecheck, all 492 tests including new `asiFeatureGrantedAtLevel`/
  `improveAbilityScore`/`grantFeat`/Lucky cases, and the production build
  all pass). Only reachable via a D&D-built party
  (`CharacterCreationScene`'s "Create Party (new)" path) that reaches level
  4+ — the classic START roster is entirely unaffected (still the flat
  Vigor/Might choice, no ASI overlay ever appears for it). Not yet verified:
  - Clearing a wave-clear threshold that brings a D&D-built hero to level 4
    (or 6/8/12/14/16/19 for a Fighter; 4/8/10/12/16/19 for a Rogue;
    4/8/12/16/19 for a Wizard/Cleric) should now show an "`<Hero>` — Ability
    Score Improvement" overlay with two choices: "Raise Ability Scores" and
    "Take a Feat" — confirm it appears ONLY for a hero whose new level
    actually grants one (not every level-up).
  - **Raise Ability Scores path:** picking it should offer "+2 to one
    ability" and "+1 to two abilities"; either should lead to an
    ability-score grid (six buttons, each showing the score's current
    value) — picking one (for +2) or two in sequence (for +1/+1, the second
    screen should show only the five NOT already picked) should close the
    overlay, log a line naming the raised score(s) and new value(s), and
    visibly change that hero's derived numbers where relevant (e.g. a
    raised STR/DEX should raise `attackBonus` and/or `effectiveAttackDamage`
    next attack; a raised CON should raise max HP and heal the hero for the
    gain, same as a level-up's own HP gain).
  - **Take a Feat path:** should list Tough/Alert/Lucky/Athlete (fewer if
    this hero already holds one — each is a one-time pick); picking Tough
    should immediately raise max HP by 2× the hero's level and heal for the
    same amount; picking Lucky should make that hero's NEXT basic attack
    auto-spend a Lucky point (log line: "spends a Lucky point (Advantage) —
    N left") for its next 3 basic attacks, recharging only after a Long
    Rest (confirm a Short Rest does NOT refill it); Alert/Athlete should
    visibly do nothing beyond being recorded (no crash, no numeric change).
  - **Multiple heroes reaching an ASI on the same wave-clear** should show
    the overlay once per hero in sequence (not all at once, not skipping
    any) before any Rest-choice overlay or the next wave begins.
  - Confirm Esc and the tutorial-reopen key (H) both stay blocked while this
    overlay is up, the same way the level-up/rest overlays already block
    them.
  - **Known, deliberate limits, not bugs:** Lucky's Advantage only ever
    applies to this hero's own basic-attack roll — not to abilities, and not
    to saving throws (no enemy ability currently targets a hero's save, so
    there's nothing to hook there yet). Alert and Athlete remain
    permanently inert (no per-unit-initiative or terrain-cost system exists
    to hook either into) — picking one is a legitimate, if currently
    numberless, choice.

- **KI-048 — Phase 11.10's Map Builder + public map sharing (D-085) are
  not yet confirmed by a human in a browser.** Built and verified
  headless-only (typecheck, all 385 tests including the new
  `mapBuilder`/`mapSharing` suites, and the production build all pass —
  confirmed both with the real `.env` present and with it temporarily
  removed, proving the local-first fallback holds for this feature too).
  Not yet verified:
  - Painting terrain/marker tiles on the Map Builder grid, cycling map
    name/width/height, and that the validation checklist (spawn/exit/
    hero-start counts, route-to-exit) actually reflects what's painted.
  - The Playtest button actually starting a real battle on the drafted
    map via `CharacterCreationScene`'s new `customMapData` field.
  - The Publish button (only visible with Firebase configured): publishing
    a map, seeing it appear in the Firestore console under `sharedMaps/`,
    and the "max 5 published maps" gate actually blocking a 6th new map
    while still allowing updates to an already-published one.
  - `BrowseSharedMapsScene`: the fetched map list rendering correctly,
    "Load more" pagination, and Start actually launching a battle on a
    fetched map via `fromSharedMapRecord`.
  - The new "Map Builder" (always shown) and "Browse Shared Maps"
    (Firebase-only) buttons on the main menu, and that they don't visually
    collide with the existing Settings/Load Game/Account controls in the
    same corner.
  - **Rules tests are written** (new `describe("firestore.rules —
    sharedMaps/{mapId}")` block in `firestore-tests/rules.test.ts`) **but
    NOT yet run** — same standing JDK 21+ constraint as KI-047 (Kevin's IT
    policy blocks a `winget` install on this machine). Don't re-offer that
    install; this is a repeat of an already-declined ask, not a new one.
  - **Known, stated limits, not bugs:** `firestore.rules`' `sharedMaps`
    validation checks row COUNT and row LENGTH but not that every
    character in a row is one of the 12 legal legend characters (no
    per-character loop construct in rules) — `parseMapRows` is the real
    gatekeeper against a malformed character at load time, same "good
    enough" defensive style as `isValidSaveSlot`. The 5-map-per-author
    publish cap is enforced CLIENT-SIDE only, not a security guarantee —
    no Cloud Function is available in this environment. Publishable map
    dimensions are capped at 6-20 columns and 6-9 rows — a real,
    bounding-box-verified limit from `BattleScene`'s fixed `TILE_SIZE`/HUD
    layout (see D-085), not an arbitrary round number.

- **KI-047 — Phase 10's Firebase Hosting/Auth/Cloud Saves (D-084) are
  DEPLOYED (live at https://dice-n-defenses.web.app) but the sign-in/sync
  UI flow is still not yet confirmed by a human in a browser.** Kevin
  completed his Firebase console setup (project `dice-n-defenses`,
  Anonymous + Google sign-in, Firestore), filled in `.env`/`.firebaserc`
  (verified matching), ran `firebase login`, and the deploy
  (`firebase deploy --only hosting,firestore:rules`) succeeded. Not yet
  verified:
  - The main menu's new Account control should show "Sign in with Google"
    for a fresh anonymous session, and switch to `Signed in: <name> (tap
    to sign out)` after a successful popup sign-in; tapping it again
    should sign out and silently re-establish a new anonymous session.
  - The Load Game screen's new "Sync with Cloud" button should stay
    disabled with a hint until signed in with Google; once signed in, it
    should pull/merge/push saves and refresh the card list.
  - Saving or updating a party in Create Party, or deleting a slot in Load
    Game, should mirror to Firestore when signed in with Google (check the
    Firestore console's data tab under `users/{uid}/saves/`).
  - **Rules tests are written (`firestore-tests/rules.test.ts`) but STILL
    NOT run** — the Firestore emulator needs a JDK 21+, and this
    environment only has Java 8. A `winget` install of a JDK 21 was
    offered and attempted; Kevin declined/cancelled it because his IT
    policy blocks installing software on this machine without IT
    involvement. This is now a standing environment limitation (not just
    an unasked question) — don't re-offer a `winget` JDK install in future
    chats without Kevin raising it himself. `npm run test:rules` remains
    runnable if a JDK 21+ becomes available some other way (e.g. IT
    installs one, or a portable/no-admin JDK). Until then, rely on manual
    testing of `firestore.rules` in production instead.
  - The deploy log showed Firestore being created fresh at deploy time
    ("Creating the new Firestore database (default)") rather than reusing
    an existing one — worth Kevin confirming the database's region and
    mode in the console match what he intended from `FIREBASE_SETUP.md`
    Step 4.
  - **Known, stated limits, not bugs:** Firestore rules validate shape/size
    but not exhaustive leaf-level types (e.g. `abilityScores`' individual
    values aren't range-checked) — matches this project's existing
    "good enough" defensive style elsewhere. Cloud sync covers only
    `SaveSystem`'s save slots, not Bestiary/Campaign progress (deliberately
    out of scope, see D-084).

- **KI-046 — Phase 9's local save system (D-083) is not yet confirmed by a
  human.** Built and tested with no browser available here (typecheck, all
  368 tests, and the production build pass; `npm run dev` serves HTTP 200).
  Worth a specific look:
  - From "Create Party," build a valid party and click "Save New Party" —
    the button should relabel to "Update Saved Party" and the status line
    below it should read `Saved as "<name>'s Party"`.
  - From the main menu's new top-left "Load Game" button: the saved party
    should appear as a card with every hero's name/class, party size, and
    difficulty; clicking "Load" should return to Create Party with every
    slot pre-filled EXACTLY as saved (name/class/race/ability
    scores/signature ability/human-or-AI); clicking "Delete" should remove
    the card immediately (no confirmation prompt).
  - After loading a save, editing a hero and clicking "Start Battle" should
    silently update that same save (not create a duplicate) — reload the
    Load Game screen afterward and confirm there's still only one card for
    it, with the edited details.
  - Save 6 parties and confirm a 7th "Save New Party" is disabled with a
    "Save slots full" message, while "Update Saved Party" on an
    already-loaded one still works.
  - Reload the page and confirm saves persisted (localStorage).
  - **Known scope gap, not a bug:** a loaded save only feeds the plain
    Create Party flow — picking a Campaign or Free Play afterward starts a
    FRESH party, it does not carry the loaded save's build along. Wiring
    that up is a deliberately deferred follow-up (see D-083).
  - **Known low-priority nit, same tier as KI-033:** Delete has no
    confirmation dialog — an accidental click permanently removes a save.

- **KI-045 — Phase 11.9's Free Play mode (D-082) is not yet confirmed by a
  human.** Built and tested with no browser available here (typecheck, all
  354 tests, and the production build pass). Worth a specific look, from a
  new "Free Play" button on the main menu:
  - The map/boss pickers should show `EMBERFORD_MAP`/`cinderlord` and
    `SALTMERE_MAP`/`tidelord` as visibly disabled with an unlock hint until
    their respective campaign (KI-044 below) has actually been completed
    once; `TEST_MAP`/`basalt-colossus` should always be selectable.
  - The wave-count buttons (Short/Medium/Long) and the Standard/Expanded
    minion-source toggle should visibly reflect the current selection.
  - Starting a run should hand off to Character Creation, then into a real
    battle on the chosen map with a generated wave list ending in the
    chosen boss; winning should show the normal Victory screen but should
    NOT mark any campaign as completed (free-play results are never
    persisted).
  - The classic START button and both existing campaigns should still play
    exactly as before — confirm Free Play didn't disturb either.

- **KI-044 — Phase 11.8's two boss-themed campaigns (D-080) are not yet
  confirmed by a human.** Built and tested with no browser available here
  (typecheck, all 347 tests at the time, and the production build pass).
  Worth a specific look, from a new "Campaigns" button on the main menu:
  - Should list "Emberford Reach" and "Saltmere Shallows" with a
    description and their finale boss's name; neither should show
    "[Completed]" the first time.
  - Picking one should route into Character Creation, then a real 6-wave
    battle on that campaign's own map (`EMBERFORD_MAP`/`SALTMERE_MAP` —
    both terrain-heavy per KI-043 below), ending in that campaign's boss
    (Cinderlord or Tidelord) alongside an escort.
  - Beating the finale should show Victory and mark that campaign
    "[Completed]" back on the Campaign Select screen from then on
    (persists across a page reload via localStorage).
  - The classic START button and the plain "Create Party" flow (no
    campaign chosen) should be completely unaffected — confirm both still
    play on `TEST_MAP` with the original 10-wave `WAVES` list.

- **KI-043 — Phase 11.7's terrain/proximity-gating/carry-limit overhaul
  (D-081) is not yet confirmed by a human.** Built and tested with no
  browser available here (typecheck, all 327 tests at the time, and the
  production build pass). `TEST_MAP` itself carries none of this new
  terrain, so most of this can only really be exercised once KI-044's
  campaigns are reachable — but the proximity-gating/carry-limit rules DO
  apply to `TEST_MAP` too and are worth checking directly:
  - Try to build a structure far from every hero — it should be rejected
    with a "No hero is close enough to build here" (or similar) message;
    move a hero closer and retry.
  - Build 3 structures near the same hero, then try a 4th near that same
    hero — the 4th should be rejected once that hero's carry limit (3) is
    reached; removing one should free a slot back up.
  - On `EMBERFORD_MAP`/`SALTMERE_MAP` (only reachable via KI-044's
    campaigns right now): confirm cliffs block ground units but flyers
    cross them freely; confirm fire/acid/water visibly apply their status
    (burning/slow) or damage to enemies that enter those tiles; confirm
    the Gear/shop HUD is locked with a hint message until a hero stands on
    or next to that map's shop tile, and unlocks once one does; confirm
    walking a hero onto the treasure tile grants a one-time gold bonus and
    doesn't re-trigger on a second visit.

- **KI-042 — Phase 11.6's roster expansion and the new Bestiary (D-079) are
  not yet confirmed by a human.** Built and tested with no browser
  available here (typecheck, all 296 tests at the time, and the
  production build pass). Worth a specific look, from a new "Bestiary"
  button on the main menu:
  - Every enemy not yet encountered in a battle should show as a locked
    "???" entry with no name/stats/lore visible.
  - Playing any battle (classic START is enough) should reveal the enemies
    actually spawned that battle; killing one should add a "[Defeated]"
    tag to its now-revealed entry.
  - Entries should be grouped into Minions / Miniboss / Bosses sections;
    confirm Cinderlord and Tidelord (the two new true bosses) show up
    under Bosses once encountered — note neither is reachable from the
    classic START path or plain Create Party; they only appear via
    KI-044's campaigns.
  - Progress should persist across a page reload (localStorage) — confirm
    a previously-revealed enemy doesn't re-lock after refreshing.

- **KI-041 — Phase 11.5's multi-slot equipment, potions, and the new
  Compendium screen (D-078) are not yet confirmed by a human.** Built and
  tested with no browser available here (typecheck, all 283 tests, and the
  production build pass; `npm run dev` serves HTTP 200). Worth a specific
  look, in-battle:
  - Pressing G (or clicking Gear) should show a 14-button grid: 12
    equipment items (each labeled with its slot, e.g. "Leather Cap · Head
    (8g)") followed by 2 potions (each labeled "· Potion"). This grid is
    taller (4 rows) than before — confirm it doesn't visually overlap the
    Done button or run off the bottom of the canvas.
  - Clicking an item, then a hero, should equip it into the matching slot —
    try a ring item twice on the same hero (first click should fill Ring 1,
    second should fill Ring 2, a third should replace Ring 1) — and clicking
    a hero already carrying that exact item should unequip it (gold
    refunded). The status line's per-hero summary should read something like
    "[gear 2/7 pot 1/2]" and change as slots fill/empty.
  - Buying a potion and clicking a hero should stock it in a general slot;
    selecting that hero should show a new "Potion: <name> (P)" button
    alongside Ability. Pressing P (or clicking it) should consume the
    potion as that hero's action — a Healing Draught should visibly restore
    HP (capped at max), a Vigor Tonic should raise the hero's attack for the
    rest of the battle — and the button should disappear once the potion is
    spent.
  - From the main menu, a new "Compendium" button (below Create Party)
    should open a read-only screen with 8 category tabs (Classes,
    Subclasses, Races, Feats, Spells, Equipment, Potions, Status Effects).
    The Classes tab specifically should show a 4-button class selector plus
    Prev/Next page controls — confirm each class's full feature list is
    reachable by paging through and that Prev/Next disable/hide correctly
    at the first/last page. Every other tab should show its full list on
    one screen with no paging controls visible.
  - The classic START button's fixed roster (Ash/Wren/Bram/Mira) should
    play exactly as before — same gear/potion mechanics now apply to it too
    (this phase touched `Hero`/`BattleScene`, not the roster itself), so
    confirm equipping/using items on these heroes works the same way.
  Report anything wrong the same way as KI-001 below.

- **KI-040 — Phase 11.4's party size, Human/AI toggle, difficulty selector,
  and AI-controlled hero turns (D-077) are not yet confirmed by a human.**
  Built and tested with no browser available here (typecheck, all 272 tests,
  and the production build pass; `npm run dev` serves HTTP 200). Worth a
  specific look, from `CharacterCreationScene`:
  - Each hero panel's old plain "Hero N" header is now a clickable button
    reading "Hero N · Human (click to toggle)" — clicking it should flip to
    "· AI" and back, with no other row on the panel moving.
  - A new "Party Size: 4" button and a "Difficulty: Normal" button sit
    between the hero panels and Start Battle. Party Size should cycle 4 →
    1 → 2 → 3 → 4; Difficulty should cycle Normal → Hard → Nightmare → Easy
    → Normal.
  - Reducing Party Size below 4 should visibly DIM the extra hero panel(s)
    on the right (and their buttons should stop responding to clicks) —
    only the remaining active panels should count toward the "every hero
    needs a unique name/ability" validation (e.g. a name clash in a dimmed
    panel should no longer block Start Battle).
  - Starting a battle with at least one hero set to "AI" should show that
    hero acting on its own at the start of each player phase — attacking an
    enemy already in range, or otherwise walking toward the nearest enemy —
    with no click needed. A human-controlled hero in the same party should
    still wait for clicks as always.
  - Starting a battle with Party Size < 4 (any difficulty) should feel
    noticeably easier (fewer/weaker enemies); Hard/Nightmare at a full party
    should feel noticeably harder. Exact numbers are a first-pass starting
    point, not tuned — real balance is still Kevin's in-browser call
    (KI-015/KI-022/KI-028), same as everywhere else in this project.
  - The classic START button (still the fixed Ash/Wren/Bram/Mira roster)
    should play EXACTLY as before this phase — always party-size-4, Normal
    difficulty, all-human, no AI hero ever acting on its own.
  Report anything wrong the same way as KI-001 below.

- **KI-039 — The Character Creation screen's new race-cycle button and the
  two further classes it can now build, Rogue and Cleric (D-075, Phase
  11.3), are not yet confirmed by a human.** Built and tested with no
  browser available here (typecheck, all 246 tests, and the production
  build pass; `npm run dev` serves HTTP 200). Worth a specific look, on top
  of KI-037's still-open checklist below:
  - Each hero panel now has a clickable "Race: Human" line between the new
    "Class:" line and the ability-score rows. Clicking it should cycle
    through all six races (Human, Elf, Dwarf, Halfling, Half-Elf, Half-Orc)
    and back to Human.
  - Switching a hero's race to Dwarf or Halfling should drop the stats
    preview's "Move" number from 3 to 2; every other race should leave it
    at 3.
  - Cycling class should now also reach "Class: Rogue" and "Class: Cleric".
    Rogue should offer the same four signature-ability choices as Fighter
    (Cleave/Piercing Shot/Taunting Slam/Frost Bolt), but its attack-damage
    preview should read noticeably higher than an identical Fighter build
    (Sneak Attack's rider). Cleric should offer only "Sacred Flame" as its
    signature action (cycling it should do nothing visible, since it's the
    only option), and its stats preview should show a d8-based HP total and
    a WIS-based attack modifier.
  - The whole panel and every button below it (Start Battle, the status
    message, Back to Menu) moved down ~40px to fit the new race row —
    confirm nothing looks cramped or clipped, and that Back to Menu /
    Start Battle are still comfortably on-screen.
  - Starting a battle with any mix of the four classes and six races should
    play exactly like the classic roster mechanically — same
    move/attack/one-signature-ability turn — just with each hero's own
    derived numbers.

- **KI-037 — The new Character Creation screen (D-073, Phase 11.1) is not
  yet confirmed by a human.** Built and tested with no browser available
  here (typecheck, all 190 tests, and the production build pass; `npm run
  dev` serves HTTP 200). Worth a specific look:
  - From the main menu, click **"Create Party (new)"** (below the original
    START button, which is unchanged and still uses the classic Ash/Wren/
    Bram/Mira roster).
  - Four hero panels should each show a name, "Class: Fighter", six
    clickable ability-score rows, a signature-ability button, and a live
    HP/ATK/Range/Move preview.
  - Clicking a name or the signature-ability button should cycle it;
    clicking an ability-score row should swap its value with the next one
    (repeated clicks on different rows should let you reach any
    arrangement); the stat preview below should update immediately.
  - **Start Battle** should be enabled (green) by default (all four presets
    are already distinct) and should grey out with a status message if you
    force two heroes to share a name or a signature ability.
  - Clicking Start Battle should load `BattleScene` with your four created
    heroes at the normal hero-start tiles, playable exactly like the
    classic roster (move, basic attack, one signature ability, HUD, etc.).
  - **Back to Menu** should return cleanly, and doing this (or starting a
    battle) more than once should never duplicate buttons/text (this scene
    is new, so it hasn't had the same restart-safety audit `BattleScene` has
    — worth specifically checking for doubled-up UI after a few round
    trips).
  - Confirm no text/button overlap anywhere on this screen (verified by
    bounding-box math here, not by eye — see D-073).
  Report anything wrong the same way as KI-001 below.

- **KI-036 — Spawn-tile access blocking (D-069) and the party-wipe loss
  condition (D-068) are not yet confirmed by a human.** Built and tested
  with no browser available here (typecheck, all 162 tests, and the
  production build pass). Worth a specific look:
  - **Spawn tile:** try to move a hero onto the "In" tile — it should be
    rejected the same way a wall is (no blue reachable-tile highlight over
    it, no path preview through it, clicking/keyboard-activating it should
    not select it as a destination). Confirm building on it was already
    rejected before this chat too (should say "You cannot build on a spawn
    or exit tile").
  - **The original stacking symptom:** station a hero adjacent to the spawn
    tile (the old trigger) across several waves and confirm enemies no
    longer visually overlap at the spawn point.
  - **Party wipe:** let every hero fall (e.g. don't intervene during an enemy
    phase with several attackers) while Stronghold Integrity is still above
    0. The game should immediately go to a defeat screen reading "Defeat —
    your party has fallen" — distinct from the existing "Defeat — the
    stronghold has fallen" wording shown when Integrity reaches 0 instead.
  Report anything wrong the same way as KI-001 below.

- **KI-035 — Same-type unit pass-through (D-067) is not yet confirmed by a
  human.** Built and tested with no browser available here (typecheck, all
  162 tests, and the production build pass). Worth a specific look:
  - **Heroes:** with two heroes in a one-tile-wide corridor, move one so its
    path requires stepping through the tile the OTHER hero currently
    occupies, to a destination beyond it. The move preview (path dots)
    should show it walking straight through; the move should succeed;
    neither hero should ever end up sharing a tile with the other (clicking
    directly on another hero's tile as a destination should still be
    rejected, same as always — you can pass it, not land on it).
  - **Enemies:** in a lane with two enemies where the lead one is stopped
    (e.g. attacking a hero, or wall-blocked) and a trailing one has enough
    movement to reach a tile beyond the leader, the trailing enemy should
    visibly walk PAST the stopped one in one enemy-phase tick rather than
    queueing up behind it. Two enemies should still never visibly overlap.
  - General feel check: does allowing pass-through change how body-blocking
    a lane with heroes feels, now that enemies can't be delayed by other
    enemies queuing behind a blocker the way they used to? (This is a
    tactical-feel question for Kevin's judgment, not a correctness bug.)
  Report anything wrong the same way as KI-001 below.

- **KI-034 — Full keyboard-only play (KI-030's fix) is not yet confirmed by a
  human.** Built and tested with no browser available here (typecheck, all
  157 tests, and the production build pass; `npm run dev` serves the page,
  HTTP 200) — same situation as every other Phase 8 UI addition. Worth a
  specific look, ideally with the mouse untouched the whole time:
  - **Arrow keys** should move a highlighted tile cursor around the board
    (clamped at the map edge); **Enter or Space** should act on whatever
    tile it's over — select a hero, pick a move destination (then Enter/
    Space again, or the Confirm button's Enter shortcut, to commit),
    basic-attack or ability-target an enemy, place/refund a structure, or
    equip/unequip a hero, matching exactly what clicking that tile does.
  - **In Build (B) or Gear (G) mode**, arrow keys should default to
    navigating the item grid (a white ring on the highlighted button,
    layered on the existing blue "selected" fill); **Tab** should switch
    arrow keys to move the board cursor instead (and back); Enter/Space
    while the grid has focus should pick the highlighted item, same as
    clicking it.
  - **The status hint line** should show "Tab: aim on board" or "Tab: pick
    item" depending on current focus while in Build/Gear mode, and
    "arrows+Enter/Space: keyboard play" otherwise.
  - **The How to Play overlay (H)** should mention the arrow/Enter/Space/Tab
    controls, and its longer text should NOT visually overlap its own title
    or "Got it!" button (moved further apart to make room — verified by the
    same bounding-box math as D-046, not by eye).
  - **Arrow keys and Space should not also scroll the browser page** while
    the game canvas has focus (a `addCapture` call is meant to prevent
    this, but that's a real-browser behavior no headless check can confirm).
  - A full battle should be completable using ONLY the keyboard, no mouse
    clicks at all.
  Report anything wrong the same way as KI-001 below.

- **KI-031 — Phase 8's UX/presentation content is not yet confirmed by a
  human either.** Same situation as KI-001/KI-024 before it: built and tested
  with no browser available here (typecheck, all 157 tests, and the
  production build pass; the dev server serves the page, HTTP 200). Worth a
  specific look in `npm run dev`:
  - **The Gear/Build button overlap is fixed** (D-059) — confirm the two
    buttons no longer visually overlap at the top of the screen.
  - **Settings control (main menu, top-right).** Clicking it should cycle
    Normal → Fast → Instant and persist across a page reload; starting a
    battle at "Instant" should show hero/enemy movement snapping instantly
    with no tween, and hit/breach/trap flashes appearing briefly without a
    fade.
  - **Keyboard hotkeys.** 1-4 should select Ash/Wren/Bram/Mira (skipping a
    fallen hero's slot silently); Q now shows "(Q)" on the ability button
    itself; H should open the how-to-play overlay at any time during the
    player phase.
  - **Hover tooltips.** Hovering (not clicking) a Build or Gear grid button
    should preview its name/cost/description in the status line; moving the
    mouse away should revert to whatever was actually selected.
  - **Miniboss visual (KI-023) and status badges (KI-027).** The wave-10
    Basalt Colossus should render noticeably larger with a gold outline and
    a "Basalt Colossus (Boss)" banner above it; a slowed/stunned/burning
    enemy should show a small lettered badge (e.g. "S", "Z", "B") above its
    token for as long as the effect lasts, not just a one-off flash.
  - **Color-independent glyphs.** The build-mode ghost tile should show a
    ✓ or ✗ glyph in addition to its green/red tint; an ability's target
    outline should show a small ◆ marker the basic-attack outline doesn't;
    Stronghold Integrity should show "⚠ LOW" text (not just red colour) at
    5 or below.
  - **Tutorial overlay.** A first-ever battle should open a "How to Play"
    overlay before the player phase begins; dismissing it (button or Esc)
    should never reappear on its own again (persisted via localStorage), but
    pressing H should always reopen it on demand.
  Report anything wrong the same way as KI-001 below.

- **KI-024 — Phase 7's new content (heroes 2→4, structures, status effects,
  level-ups, equipment, wave preview) is not yet confirmed by a human either.**
  Same situation as KI-001 before it: built and tested with no browser
  available here (typecheck, all 150 tests, and the production build pass; the
  dev server serves the page, HTTP 200). New things worth a specific look in
  `npm run dev`:
  - **Four heroes.** Ash, Wren, Bram, and Mira should all appear and be
    individually selectable/movable/actable; Bram's **Taunting Slam** should
    stun everything adjacent (their next enemy-phase turn does nothing); Mira's
    **Frost Bolt** should visibly slow its target (fewer tiles walked next
    enemy phase).
  - **New structures in the Build (B) shop grid** — now 7 items across 2 rows:
    Barricade, **Gate**, Spike Trap, Sky Snare, **Tangle Root**, **Melee
    Platform**, **Ranged Perch**. A Gate should block enemies but let heroes
    walk through it; a hero standing on a Melee Platform/Ranged Perch should
    show a boosted attack (more damage or +1 reach); Tangle Root should damage
    AND visibly slow a ground enemy, and do nothing to a flyer.
  - **Gear (G) panel.** Should show 3 equipment buttons; clicking one then a
    hero should equip it (gold spent once); the status line should show
    `[ItemName]` next to that hero; clicking again (or a different item then
    the same hero) should swap/refund correctly.
  - **Level-up prompt.** After clearing wave 2 (and every 2 waves after), a
    "Level Up!" overlay should appear with Vigor/Might choices, pause the game
    until clicked, then continue to Between Waves/Victory.
  - **Wave preview line.** Should show "Next: Wave N — ..." under the banner
    during play, and go blank on the final wave.
  - **Layout.** With the shop grid now 2 rows plus a Done button below it,
    confirm nothing overlaps or runs off the bottom of the (now taller, 1000px)
    canvas, in both Build mode and Gear mode.
  Report anything wrong the same way as KI-001 below.

## Raised in playtesting, but working as designed (not bugs)

- **Enemies don't avoid traps.** Intentional — see DECISIONS D-039 and the
  clarification note below it. Pathfinding has no knowledge of traps, only
  walls/heroes, precisely so a trap can actually hit a passing enemy; enemies
  dodging traps would make spending gold on them pointless.-Confirmed
- **Combat is fully deterministic ("everything is an automatic hit").**
  Intentional per D-030 — no misses, no dice. This surfaced a real
  documentation inconsistency (the Source of Truth's own MVP Rules Status
  table, §9, still lists "Dice visibility" as OPEN even though a past chat
  effectively settled it by implementation). Kevin's answer, recorded here and
  in the D-047 clarification note in DECISIONS.md: **deterministic combat
  stays for now; a dice-based hit-chance system will be implemented later** —
  an explicit FUTURE item, not something this or any current phase should
  invent unprompted.

## Expected limitations (by design, not bugs)

- **KI-004 — Placeholder art only.** Coloured shapes and text; no final art or
  audio. Original placeholders only; no third-party IP.
- **KI-005 — Large JS bundle.** ~1.5 MB (~350 KB gzipped) because Phaser is
  large; grew to ~2.3 MB (~550 KB gzipped) in Phase 10 (D-084) after adding
  the Firebase SDK (auth + firestore + app). Reconsidered code-splitting
  during the hosting phase as this note originally said to, and
  deliberately decided AGAINST it: every scene, including `MainMenuScene`
  (which needs the cloud module immediately for its Account control), is
  eagerly imported in `main.ts` to build Phaser's `scene` array, so
  splitting `cloud/` into its own chunk would still load before `BootScene`
  ever renders — no real time-to-interactive win for the added
  async-loading complexity it would cost. Build warning limit raised
  2000 kB -> 2500 kB accordingly (see `vite.config.ts`). Worth revisiting
  for real if this project ever moves to lazy-registering scenes rather
  than listing them all upfront.
- **KI-010 — A full wave takes several End Turn clicks.** Enemies march a few
  tiles per phase down a long lane, so clearing a wave is many turns. Combat now
  makes those turns meaningful (attack, reposition, block) rather than just
  "click End Turn".
- **KI-011 — Attacks and abilities ignore line of sight.** Range is pure
  Manhattan distance; walls do not block a shot. Line of sight is a later
  grid-layer concern in the Source of Truth, not part of the Phase 4 boundary.
- **KI-012 — Heroes cannot block the exit tile itself.** Exit tiles are always
  enterable by enemy routing, so a hero standing on OUT does not seal it (an
  enemy can still step onto OUT and breach). Body-blocking works everywhere else.
- **KI-013 — Heroes have no BASE defense stat.** Still true — every hero's own
  `defense` starts at 0, so an unequipped hero takes full enemy damage. Phase 7
  gives a way to gain some anyway: the **Iron Buckler** and **Traveler's
  Cloak** equipment items grant +2/+1 defense while equipped (D-057). A base
  per-hero defense value (independent of gear) remains a possible later
  balance/progression addition.
- **KI-014 — An enemy that attacks does not also move this phase.** A ranged
  Runner in reach holds and shoots instead of advancing while shooting. This is a
  deliberate readability choice for the MVP (attack OR move), not a bug.
- **KI-015 — Balance is untuned and currently errs easy / gold-rich.** This
  now covers the **full ten-wave campaign** (Phase 7, D-051), not just the MVP.
  Under *perfect* focus-fire play (the headless upper-bound model in
  `tests/mvp-integration.test.ts` and `tests/campaign.test.ts`) the 2-hero party
  clears **all ten waves with 0 breaches, full integrity (20), and ends with
  ~500 gold** — the same "errs easy / gold-rich" shape the five-wave MVP had.
  The simulation proves the campaign is *winnable and losable*; it cannot set the
  true difficulty, because its heroes never miss and always reach the frontmost
  enemy. Real tuning by an imperfect player in a browser is still needed:
  `STARTING_GOLD`, structure costs/damage (`structures.ts`), enemy stats
  including the new roster and the miniboss (`enemies.ts`), and each wave's
  counts / `turnLimit` / `completionGold` / `timeBonusGold` (`waves.ts` — every
  such value carries a "first-pass, tune in browser" note). Likely direction:
  reduce completion gold, tighten turn limits, and/or thicken the later waves so
  spending and positioning become real choices. Numbers were deliberately left
  as a starting point (see DECISIONS D-042, D-051). This remains the headline
  Phase 7 task and is genuinely blocked on a browser.
- **KI-016 — Building is done during the Player Phase, not a separate shop
  phase.** The current `TurnSystem` passes through preparation/between-wave
  instantly, so the shop/build lives in the Player Phase (DECISIONS D-040). This
  also means walls can be placed mid-wave. The path-block rule only guarantees
  walls alone never seal a route; a hero body-blocking *plus* walls can still
  temporarily leave an enemy with no route (it simply holds that phase, as in
  Phase 4), which resolves when the hero moves. A dedicated shop phase can be
  added later.
- **KI-022 — Flying and its counter now exist; balance and terrain are still
  open.** Phase 7 added the flying *capability* (D-048), an anti-air counter
  (the **Sky Snare**, D-049), and one `wisp` in wave 5 so flying shows up in
  play. Remaining, deliberately deferred:
  (a) **Balance is unverified.** Flyers now appear across several waves (wave 5's
  wisp plus razorwings/wisps in waves 8–10, D-051), but how many belong where and
  whether the Sky Snare's cost/damage feel right is still Kevin's in-browser
  tuning call (KI-015). The loop is proven winnable/losable, not proven *fun*.
  (b) **No flying-vs-terrain interaction.** "Hole" / damaging / slowing terrain
  from the vision doesn't exist yet, so questions like "does a flyer ignore a
  hole?" are unaddressed (no such terrain to interact with).
  (c) The Sky Snare, like every trap, currently triggers **every** time a flyer
  crosses it (no charges/cooldown) — same persistent model as the Spike Trap
  (an upgrade/charges model is still deferred past the MVP boundary).

- **KI-025 — Platform bonuses apply to the basic attack only, not abilities.**
  A hero standing on a Melee Platform or Ranged Perch gets the boost when
  basic-attacking, but Cleave/Piercing Shot/Taunting Slam/Frost Bolt use their
  own fixed range and damage regardless of the tile the hero stands on. A
  deliberate scope cut (D-054) to keep the surface area small; extending
  platform bonuses to abilities is a natural follow-up if it feels wrong.
- **KI-026 — A level-up choice only benefits heroes alive at that moment.** A
  fallen hero gets no retroactive Vigor/Might if they're not on the field when
  the choice is applied (D-056); there's no revival mechanic, so this can't
  currently be tested any other way, but it's worth stating explicitly.
- **KI-028 — Equipment and structure balance for this slice is untuned.** Same
  situation as KI-015: equipment costs (10/10/14g), platform bonuses (+2 dmg /
  +1 range), Gate/Tangle Root costs (6g each), and the level-up cadence (every
  2 waves) are first-pass numbers proven only to be *coherent* (typecheck,
  150 tests, build), not balanced. Kevin's in-browser feel pass should cover
  these alongside the existing KI-015/KI-022 items.
- **KI-029 — No volume control (or audio system) exists.** Phase 8's scope
  list names "volume and speed controls," but there is no audio anywhere in
  the codebase (`this.sound.*` is unused) — a volume slider would have
  nothing to control. Rather than build a settings toggle for a system that
  doesn't exist (operating instruction #3: no unrequested scaffolding), this
  is deliberately skipped; a volume control belongs with whatever future
  chat adds actual sound effects/music, not before. "Speed controls" was
  delivered as the animation-speed setting instead (D-060), which has a real
  effect today.

## Resolved since Phase 3

- **KI-033 (the Gear button overlapped the "Wave N / M · Phase" banner) —
  RESOLVED by D-117.** Fixed with a measured-width approach instead of
  another guessed padding number: `buildHud()` records the Gear button's
  real left edge, and a new `fitBannerToWidth()` shrinks the banner's font
  using its actual Phaser-measured width until it's guaranteed clear,
  resetting to full size first so a short label isn't left shrunk. Needs
  Kevin's in-browser confirmation (KI-074).
- **KI-017 (structure destruction was "unimplemented by design" — enemies
  never attacked walls, only routed around them) — RESOLVED, in two steps.**
  This entry was never updated when it actually became false: Phase 20
  (D-111) gave dedicated SIEGE enemies (Siegebreaker, Battering Brute,
  Juggernaut, Ashen Sovereign) an unconditional priority attack against a
  destructible wall in their own range. Phase 25 (D-116) generalized this
  further — any ordinary melee enemy (not siege, not a pure runner) now
  opportunistically bashes a wall in range with its own plain attack damage
  when no hero is reachable that phase. Enemies still route around a wall
  whenever that's the more useful option; only these specific cases attack
  one instead.
- **KI-038 (the Character Creation screen's class-cycle button, D-074/Phase
  11.2, needed a human's browser pass) — CONFIRMED.** Kevin confirmed the
  class-cycle button works in-browser. The rest of KI-037's original
  checklist (name/ability-score cycling, party validation, Back to Menu)
  remains open/unconfirmed in detail, and the class-cycle button's full
  effect (Wizard's INT-based stats, playing a battle with a Wizard in the
  party) wasn't separately itemized as tested — worth a mention if Kevin
  wants to flag anything more specific.

- **KI-030 (keyboard support was partial, not full keyboard-only play) —
  RESOLVED.** D-061 (earlier in Phase 8) added hotkeys for mode toggles,
  ability, confirm/cancel, hero selection, and help, but left per-tile
  movement/targeting and shop/gear item picking pointer-only. D-066 (this
  chat) closes the gap: arrow keys move a tile cursor (or, with Tab, the
  shop/Gear item grid), and Enter/Space act on whatever has focus via the
  same dispatch a mouse click already used — a full battle should now be
  completable with no mouse at all. Needs Kevin's in-browser confirmation
  (KI-034).

- **KI-032 (the Gear button visually overlapped the Build button) — RESOLVED.**
  Found by Kevin in playtesting; fixed by D-059: the Gear button's x-position
  math re-subtracted Build's own half-width against Build's CENTER instead of
  its left edge, landing Gear 55px too far right. One-line fix; needs Kevin's
  in-browser confirmation (KI-031).
- **KI-023 (the miniboss had no distinct presentation) — RESOLVED.** Fixed by
  D-063 (Phase 8): the miniboss token is now larger, has a thicker gold
  outline, and carries a persistent "Basalt Colossus (Boss)" name banner —
  size and text, not colour, are what signal "this is the boss." Needs
  Kevin's in-browser confirmation (KI-031).
- **KI-027 (status effects had no on-token visual marker) — RESOLVED.** Fixed
  by D-063 (Phase 8): an active slowed/stunned/burning effect now shows a
  small persistent lettered badge above the enemy's token (e.g. "SB" for
  slowed+burning), refreshed every time status effects are (re)computed, not
  just a one-off flash. Needs Kevin's in-browser confirmation (KI-031).
- **KI-001 (the v0.1.1 manual regression checklist) — RESOLVED.** Kevin ran
  the full checklist in-browser and confirmed every item still works:
  - Select & move; basic attack; ability (Cleave AoE, Piercing Shot aim mode);
    enemy phase attack-or-advance and hero body-blocking; removal/defeat once;
    victory/defeat; the Phase 5 gold/shop loop (buy, ghost preview,
    build/refund, route-block rejection, traps); early wave finish on a
    hero-kill clear; no enemy stacking; the end-screen Return to Menu button;
    and no HUD/button overlap, including in build mode with a full combat log.
  Kept as a permanent record of what a full regression pass covers; KI-024
  above is the equivalent checklist for this chat's new content.
- **KI-002 (no combat) — RESOLVED.** Heroes now have a basic attack and one
  ability each; the action slot is consumed. See Phase 4.
- **KI-008 (victory unreachable) — RESOLVED.** With enemies now stoppable,
  clearing all waves with Integrity > 0 wins. Covered by `tests/victory.test.ts`.
- **KI-009 (enemies ignore occupancy) — RESOLVED.** Living heroes now block enemy
  routes and enemies attack blockers (DECISIONS D-033). *Update:* enemies now
  also block EACH OTHER (no two ever share a tile) — see D-045; this replaces an
  earlier note here that said the opposite.
- **KI-018 (enemies could stack on the same tile) — RESOLVED.** Found in
  playtesting. Fixed by D-045: routing treats other living enemies' current
  tiles as blocked, and a spawn onto an occupied tile retries next phase instead
  of stacking. Covered by `tests/enemyCollision.test.ts`. **Update (D-067):**
  the "never share a tile" guarantee still holds, but enemies (and, separately,
  heroes) may now walk THROUGH each other's tile — only landing on one is
  still forbidden.
- **KI-019 (an extra, empty turn was needed after the last enemy died on the
  player's turn) — RESOLVED.** Found in playtesting. Fixed by D-044: a hero kill
  that clears the wave now resolves immediately instead of waiting for an empty
  Enemy Phase.
- **KI-020 (no way to leave the victory/defeat screen except an undiscoverable
  Esc shortcut) — RESOLVED.** Found in playtesting. Fixed by D-047: the end
  screen now has a real "Return to Menu" button.
- **KI-021 (HUD text and buttons could overlap) — RESOLVED.** Found in
  playtesting. Fixed by D-046: taller canvas, status/log stacked instead of
  side-by-side, and edge-anchored buttons. Verified by bounding-box math on
  worst-case content (no browser available here) — Kevin's browser pass should
  still confirm the actual on-screen result.

## Environment notes

- **KI-006 — Node version.** Developed and verified on Node v22 (LTS). Use a
  current Node LTS release.
