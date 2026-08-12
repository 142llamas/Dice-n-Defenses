# Changelog

All notable changes to this project are recorded here.

## [Unreleased] — 0.2.0-dev — A Full UI-Layout Audit and Fix (D-126)

Kevin reported real, current "clashing text boxes" and "boxes going over the
edge of the screen" and asked for a full audit and fix. A general-purpose
agent read every scene file and computed bounding-box math against the real
canvas size and every real map/data-table's actual length; every finding was
independently re-verified before fixing. See **D-126** in `DECISIONS.md` for
the complete method and everything investigated and deliberately left alone.

Fixed:
- **`CompendiumScene`'s category tabs (10) and class selector (12)** rendered
  more than half off-canvas on both edges on the screen's own default tab —
  a deterministic bug on every visit. `uiTheme.ts`'s shared `centeredRowX`
  now takes an optional `maxWidth` (default `GAME_WIDTH - 80`) and shrinks
  item width to fit instead of letting a row grow unbounded past the canvas;
  every call site now uses the returned (possibly shrunk) `itemWidth`.
- **`MapBuilderScene`'s terrain palette (8 swatches)** had the identical
  off-canvas bug on its own default tab — now routed through the same fixed
  `centeredRowX` helper.
- **`FreePlayScene`'s map (7) and boss (13) picker labels** overlapped their
  neighbors — added `wordWrap` and a width-scaled font size to the label
  text (only the locked-hint text below it had wrap before this fix).
- **`BattleScene.buildHud`'s status line/combat log**: `wrapWidth` was tied
  to the grid's own pixel width instead of the canvas's, so a full 4-hero
  party's status line on Frostbound Hollow (the narrowest AND tallest
  built-in map) already wrapped past the reserved height in ordinary play
  (a hero simply selected), bleeding into the combat log below it — despite
  this exact spot's own prior comment claiming word-wrap already made that
  "impossible." `wrapWidth` now tracks the canvas width, decoupled from the
  grid; `statusBlockHeight` bumped 60→78 as extra headroom (re-verified
  against the item-grid/Done-button bounding-box math so nothing now runs
  off the bottom instead); `combatLogText` gained `wordWrap` for the first
  time (previously none at all — a long log line could clip off the canvas
  edges).
- **`BrowseSharedMapsScene`'s shared-map list**: rendered one row per
  fetched map, uncapped, growing into the fixed Wave Count/Minion/
  Difficulty/Start sections below it past ~6 published maps. Now a fixed
  local page size (5 at a time) with its own Prev/Next controls; "Next"
  past the last locally-loaded page fetches another remote page first.

Investigated and deliberately left alone (see D-126 for the reasoning):
`renderAsiPrompt`'s theoretical 15+-choice overlap (unreachable below
character level 19); two momentary cosmetic VFX edge cases off no built-in
map; a suspected status-badge-stacking overflow that turned out not to exist.

## [Unreleased] — 0.2.0-dev — Five More Deferred Slices: Reckless Attack, Preserve Life, Skill Checks + Hero Stealth, Spell-Mastery Picker (D-125)

Kevin asked to tackle five items straight off D-124's own deferred list,
after two spell-model clarifying questions answered from existing code (no
class here models learn→known→prepared as distinct states). See **D-125**
in `DECISIONS.md` for the full method, including a real interaction only
caught by writing tests (a Warlock's own Pact Magic slots refilling on a
Short Rest can mask Mystic Arcanum's separate Long-Rest-only cadence).

Added:
- **Barbarian's Reckless Attack** (level 2+): a real per-turn toggle, no
  action cost — Advantage on this hero's own attacks, Advantage to every
  attack against it until its next turn. New `Combatant.grantsAttackerAdvantage?`.
- **Cleric's Channel Divinity: Preserve Life** (Life Domain, level 2+): a
  real AoE heal, up to 5 living allies at once, capped at half each one's
  own max HP, limited uses recharging on a Short or Long Rest.
- **A real Stealth check** (`systems/SkillCheckSystem.ts`, new) plus real
  per-class skill proficiency (`data/skills.ts`'s new
  `SKILL_PROFICIENCIES_BY_CLASS`/`skillCheckModifier`).
- **Hero-side stealth**: `Hero.isHidden`/`.hide()`/`.reveal()` (mirrors
  `Enemy.isRevealed`). Ranger's Vanish (level 14+) and Rogue's Cunning
  Action: Hide (level 2+) both attempt the Stealth check above; Ranger's
  Hide in Plain Sight (level 10+, a flat +10) and Thief's Supreme Sneak
  (Advantage) auto-apply while stationary; Monk's Empty Body (level 18+)
  hides outright, spending its whole Ki pool and the action, no check.
- **Wizard's Spell Mastery (level 18)/Signature Spells (level 20), Warlock's
  Mystic Arcanum (levels 11/13/15/17)**: a new one-time spell-picker overlay
  (`BattleScene.showSpellPickChoiceQueue`), slotted into the existing
  level-up choice chain (subclass → ASI → spell-pick → rest).

Fixed (found only by writing tests, not by the original plan):
- A Warlock's Pact Magic slots (D-093) fully refill on a Short Rest — a
  Mystic Arcanum test that didn't account for this would have misread that
  refill as Mystic Arcanum itself recharging early. No code defect; the
  test was corrected to isolate the two mechanics.

## [Unreleased] — 0.2.0-dev — A Batch of Inert Class Features Wired Real (D-124)

Kevin asked to work through the "class features still listed as inert"
backlog. An audit found ~30-40 features whose stated blocking reason (no
saving throws, no rest resource pools, no Advantage/Disadvantage, diceless
combat) had gone stale in later phases without looping back. See **D-124**
in `DECISIONS.md` for the full method, including two real correctness catches
made only by writing tests before merging (a Paladin spellbook leak; Life
Domain's Domain Spells turning out to change nothing observable).

Added:
- **Fighter's Indomitable** (levels 9/13/17): reroll a failed forced saving
  throw, once per tier, Long-Rest-only. New `Combatant.rerollFailedSave?()`
  and `SavingThrowSystem.applySaveOrDamage`'s `rerollFailedSave` option.
- **Barbarian's Danger Sense** (level 2+): Advantage on every forced saving
  throw. New `Combatant.savingThrowAdvantage?`.
- **Rogue's and Monk's Evasion** (level 7): a failed forced save now deals
  half damage instead of full. New `Combatant.evasionHalvesFailedSave?` and
  `SavingThrowSystem.applySaveOrDamage`'s `halveOnFail` option.
- **Rogue's Elusive** (level 18+): no enemy attack against this hero may
  roll with Advantage while it isn't incapacitated. New
  `Combatant.deniesAttackerAdvantage?()`.
- **The Fiend's Expanded Spell List** (Warlock): ten spells (Burning Hands
  through Hallow) now actually appear in the spellbook as the Warlock's own
  spell slots reach the matching level. New `subclassGrantedSpellIdsUpToLevel`
  (`data/subclasses.ts`) + `Hero.subclassGrantedSpellAbilityIds`.
- **"frightened" status effect** (`data/statusEffects.ts`, new): reuses
  "blinded"/"sapped"/"toppled"'s exact disadvantage shape.
- **Path of the Berserker's Intimidating Presence** (level 10+): a landed
  basic-attack hit also frightens the target on a failed save.
- **Path of the Berserker's Retaliation** (level 14+): a hero struck by an
  adjacent enemy immediately strikes back, spending its reaction — this
  game's first reaction to swing back rather than just reduce damage.
- **College of Lore's Cutting Words** (level 3+): a Bard spends its own
  reaction plus a Bardic Inspiration use to weaken a landed blow against any
  ally. New `Hero.bardicInspirationUsesAvailable` getter.

Fixed (found only by writing tests, not by the original plan):
- **A real bug**: an early version of the subclass-spell-list gate checked
  `classDef.spellcasting`, which Paladin also carries (for Divine Smite's
  slot pool) despite having no spellbook at all — this let Oath of
  Devotion's Oath Spells leak into a Paladin's known-spell list. Fixed by
  gating on `knownSpellIdsForClass(...).length > 0` instead.
- **A design correction**: Life Domain's Domain Spells were initially marked
  `mechanicallyActive: true`, but every one of its eight nameable spells
  (bar Revivify/Raise Dead) turned out to already be part of the base Cleric
  spell list — the feature is real and wired but produces zero observable
  difference. Reverted to `mechanicallyActive: false` with an honest reason.

Deliberately deferred (see D-124 for the full list and why): Wizard's Spell
Mastery/Signature Spells and Warlock's Mystic Arcanum (need a new spell
picker UI); the Cleric/Paladin Channel Divinity family (Preserve Life needs
a real AoE-ally-heal mode); a hero-side stealth mirror; Barbarian's Reckless
Attack (needs a new toggle UI); skill proficiency + checks (no skill-check
moment exists anywhere in this game to spend it on).

Tests: **1088**, up from 1039 (49 new). Typecheck, all tests, and the
production build all pass (114 modules, unchanged). Every BattleScene-only
hookup (Intimidating Presence/Retaliation/Cutting Words) is not
unit-tested, the same standing Phaser limitation every other in-battle
auto-apply mechanic in this project already has.

## [Unreleased] — 0.2.0-dev — Fantasy/Parchment UI Theme: Main Menu, Compendium, Bestiary (D-123)

Kevin asked to "spruce up" the game's visuals — starting with the Main Menu
and Compendium/Bestiary, a more professional/reorganized Main Menu layout,
real hover/click feedback on every button, and an on-brand fantasy look, the
same branding explicitly planned to carry through the rest of the game
later. See **D-123** in `DECISIONS.md`.

Added:
- **`scenes/uiTheme.ts`** (new, shared): two Google Fonts (Cinzel display,
  EB Garamond body — SIL OFL 1.1), `createOrnateButton` (idle/hover/
  pressed/disabled/selected states, hover-lift and press-squish tweens —
  every button in this project previously had no click feedback at all),
  `drawScreenBackdrop`, `drawParchmentPanel`, `spawnAmbientMotes`,
  `createSectionLabel`, `centeredRowX`. New themed `COLORS` in `config.ts`.
- **`MainMenuScene.ts`** reorganized into named button groups ("Continue
  Your Journey," "Know Your Foe," "Creator Tools") around one hero action
  ("New Game"), plus a drawn tower-and-shield crest and ambient motes.
- **`CompendiumScene.ts`/`BestiaryScene.ts`** restyled onto the same theme —
  zero data/lookup-logic changes.
- **Bestiary pagination** (new): a real pre-existing gap (94 roster entries,
  never paginated) found and fixed with the same Prev/Next mechanism
  `CompendiumScene` already used.
- **`BootScene`** now waits (capped at 1.5s) for the two Google Fonts to
  load before starting `MainMenuScene`.

Tests: unchanged at 1036 — pure presentation code. Typecheck, all tests, and
the production build all pass (114 modules, up from 113). `npm run dev`
serves HTTP 200.

Not built this pass: `BattleScene`'s HUD and every other scene (unchanged,
scoped to this session's three screens only); no code fix for the reported
spellbook/level-up issues, since no code defect was found in either
mechanism (see D-123, KI-079).

## [Unreleased] — 0.2.0-dev — Spell-Cast and Death Animations (D-122)

Kevin asked to build "a whole host" of spell-cast and death animations,
wanting every spell to feel unique when cast, no two the same. With ~198
castable spells, a shared data-driven library replaces the impossible
"198 bespoke animations" reading. See **D-122** in `DECISIONS.md`.

Added:
- **`systems/VisualFxSystem.ts`** (new, pure, tested): picks a cast
  SHAPE structurally from an ability's own mechanical fields
  (teleportSelf/summonsId/altersTerrainId/areaAllies/targetsAlly/
  forcedMoveTiles/kind/savingThrow/autoHit), a COLOR from a best-effort
  name/description keyword guess (fire/frost/lightning/poison/necrotic/
  radiant/psychic/force/shadow/water/earth) falling back to the spell's
  real SRD school, and secondary variation (particle count/size/rotation/
  duration) from a deterministic hash of the ability's own id.
- **11 new cast-flourish draw methods in `BattleScene`** (bolt, homingOrb,
  fallingJudgment, novaBurst, ringPulse, gustCone, sparkleRise,
  radiantPulse, groundRune, conjureCircle, blink), wired into all 10 real
  spell/ability cast call sites in the scene.
- **`Enemy.lastDeathCause?: DeathCause`**: a same-tick rendering hint,
  8 values (physical/fire/frost/poison/necrotic/radiant/lightning/arcane),
  tagged by whichever cast/status code just dealt the killing blow.
- **`BattleScene.playEnemyDeathVisual()`**: replaces the old instant token
  removal on a kill with a squash-and-fade plus a cause-specific flourish
  (collapse/emberFade/shatter/dissolve/wither/radiantBurst/sparkCrackle/
  arcaneFade) — bigger and slower for miniboss/boss/legendary tiers.
  Breach removal (an enemy escaping, not dying) is unchanged.

Tests: 1026 → 1036 (+10, `tests/visualFxSystem.test.ts`). Typecheck, all
tests, and the production build all pass (113 modules, up from 112). `npm
run dev` serves HTTP 200.

Not built this pass: no per-spell hand-authored bespoke animation (the
data-driven library is the deliverable); no new verified damage-type field
on spells (the color guess stays cosmetic-only).

## [Unreleased] — 0.2.0-dev — Basic-Attack Lunge (D-121)

Kevin asked to start building the tween animations D-120's handoff had
discussed but deliberately left unbuilt. Offered a choice of which
concrete animation to prototype first, he picked the basic-attack lunge.
See **D-121** in `DECISIONS.md`.

Added:
- **`BattleScene.lungeToward()`**: the attacker's own token (hero or
  enemy) nudges a short distance toward its target and springs back, via
  one relative `yoyo` tween, layered on top of the existing hit-flash.
  Respects the existing animation-speed/reduced-motion setting.
- Wired into both existing basic-attack directions: `tryBasicAttack` (a
  hero attacking an enemy) and `showEnemyAttack` (an enemy attacking a
  hero).

Not built this pass: no lunge on Extra Attack's extra swings, the off-hand
attack, Cleave's second target, or any spell/ability attack — deliberately
scoped to one concrete instance, not a sweep of every attack call site.

Tests: unchanged at 1026 (pure Phaser presentation code, no new pure logic
to test). Typecheck, all tests, and the production build all pass (112
modules, unchanged). `npm run dev` serves HTTP 200.

## [Unreleased] — 0.2.0-dev — Dialogue Skip Controls (D-120)

Kevin asked for a "skip the whole talking section" control (only when no
decision is pending) and a "skip past the current line" control (for fast
readers), plus a future-audio interrupt seam. See **D-120** in
`DECISIONS.md`.

Added:
- **`DialogueLine.hasDecision?: boolean`** — a forward-compatible gating
  flag (no choice UI exists yet); `canSkipSequence(lines)` is false the
  instant any line in the sequence sets it.
- **Advancing past a line is now available several ways at once**: the
  Continue/Close button, clicking anywhere on the panel/scrim, or
  Space/Enter.
- **A dedicated "Skip ▶▶" button** jumps straight to the end of the whole
  sequence — shown only when no line anywhere in it requires a decision.
- **`interruptCurrentLinePlayback()`**: a no-op today, but the one seam a
  future text-reveal animation or voice-over-audio-stop call will hook
  into — every skip path already funnels through it.
- A second Compendium preview button demonstrating the Skip button
  correctly disappearing on a sequence with a pending decision.

Fixed (architecture): `DialogueLine`/`canSkipSequence` were first written
directly in `scenes/dialogueBox.ts`, which broke unit testing (that file's
top-level Phaser import touches `window`, unavailable in this project's
Node test environment). Moved to a new, Phaser-free
`systems/DialogueSystem.ts`, per this project's own "pure rules live in
systems/" architecture rule.

Tests: 1021 → 1026 (+5, `tests/dialogueSystem.test.ts`). Typecheck, all
tests, and the production build all pass (112 modules, up from 111). `npm
run dev` serves HTTP 200.

## [Unreleased] — 0.2.0-dev — Stylized Parchment Dialogue Box, NPC-Only Portraits (D-119)

Kevin asked for the dialogue-box presentation itself: text on a stylized
parchment background, plus a 2D front-facing portrait of whichever
character is speaking, resolved to NPC-only (companions/bosses/narration —
the player's own PC has no portrait). See **D-119** in `DECISIONS.md`.

Added:
- **`scenes/dialogueBox.ts`**: a reusable parchment-panel dialogue renderer
  (`DialogueLine`/`showDialogue`). An NPC line gets a framed portrait + name
  plate (real image once loaded, else a drawn placeholder silhouette); a
  PC/narration line (no `speakerName`) renders full-width text with no
  portrait. The panel itself is drawn with Phaser `Graphics` (base fill +
  aged mottling + a frame border) — no image asset needed to look finished.
- **`data/portraitManifest.ts`**: a new, currently-EMPTY `PORTRAIT_MANIFEST`
  — separate from the existing `spriteManifest.ts` (different image
  category/aspect ratio). Drop a real portrait file in later; no rendering
  code needs to change.
- Five new `config.ts` `COLORS` entries for the parchment/placeholder look.
- **A "Dialogue" preview tab in `CompendiumScene`**: a "Show Sample
  Dialogue" button demonstrating both speaker styles in-browser, since no
  real chapter/story content exists yet to trigger this naturally.

Tests: unchanged at 1021 (pure presentation code, no new pure logic).
Typecheck, all tests, and the production build all pass (111 modules, up
from 109 — this session IS wired into a real scene, unlike D-118). `npm run
dev` serves HTTP 200.

## [Unreleased] — 0.2.0-dev — Campaign Engine Scaffolding: Chapters, World-Flags, Companion Roster (D-118)

`CAMPAIGN_STORY_DESIGN.md` (a design-only doc for a six-region campaign
story, "The Unremembering") flagged an engine gap in its own §7: no chapter
concept, no world-flag store, no companion-catalogue/roster model. Offered a
choice between writing that story's companion dialogue, building this engine
scaffolding, or designing its bonus-choice pool numbers, Kevin chose the
engine scaffolding. See **D-118** in `DECISIONS.md` for the full method.

Added:
- **`ChapterDefinition`** (`data/campaigns.ts`): an optional `chapters?`
  field on `CampaignDefinition` for a future 4-chapter "region" campaign,
  plus `isChapteredCampaign`/`totalChapters`/`getChapter` helpers giving one
  consistent access pattern for both flat and chaptered campaigns. Both
  existing campaigns (Emberford Reach, Saltmere Shallows) stay flat, zero
  behavior change.
- **Per-chapter completion tracking** (`systems/CampaignProgressSystem.ts`):
  `CampaignProgress.completedChapters`, `markChapterCompleted`,
  `getHighestCompletedChapter`, `isChapterCompleted` — additive, backward
  compatible with any progress blob saved before this change.
- **`systems/WorldFlagSystem.ts`** (new): a generic, persisted per-choice
  flag store for story branches that need to be read much later (which
  miniboss was spared, a companion's branch outcome, etc.).
- **`data/companions.ts`** + **`systems/CompanionRosterSystem.ts`** (new): a
  `CompanionDefinition` type (a named `CharacterBuild` wrapper) and a pure
  active/benched/lost roster system (`MAX_ACTIVE_COMPANIONS = 3`, matching
  the existing 1-PC + 3-companion party size). `COMPANIONS` itself stays an
  EMPTY registry — the six named companions the design doc describes are a
  separate, not-yet-done writing pass.
- Two new `config.ts` storage keys: `WORLD_FLAG_STORAGE_KEY`,
  `COMPANION_ROSTER_STORAGE_KEY`.

Not built this pass, and why: no scene/UI wiring for any of the above — none
of it has real content (companions, authored regional chapters, bonus
pools) to display yet. Pure, headless, fully tested engine scaffolding only,
matching D-101's (Phase 12.1) precedent of building a capability ahead of
its content/UI integration.

Tests: 976 → 1021 (+45). Typecheck, all tests, and the production build all
pass; module count unchanged at 109 (nothing new is wired into `main.ts`'s
dependency graph yet, as intended). `npm run dev` serves HTTP 200.

## [Unreleased] — 0.2.0-dev — Playtest Fixes, Classic Roster Removal, Hero-Sprite Plumbing (D-117)

Kevin's first in-browser pass of the deployed build reported the canvas
looked off-center and buttons/text overlapped. Also asked to remove the
original classic fixed 4-hero roster and its flat Vigor/Might level-up
choice now that D&D-style character creation/real class leveling has fully
superseded them, and to lay the groundwork (loading/rendering plumbing only
— no art exists yet) for real hero/enemy/structure sprites. See **D-117** in
`DECISIONS.md` for the full method.

Fixed:
- **The canvas was centered twice** (Phaser's `scale.autoCenter` fighting
  `index.html`'s own flex centering) — Phaser's centering is now disabled;
  the CSS handles it alone.
- **KI-033**: the Gear button could overlap the "Wave N / M · Phase" banner
  on a long string. The banner now shrinks its own font, using its real
  measured width, to whatever fits — guaranteed correct regardless of font
  metrics or future label text.

Removed:
- **The classic fixed 4-hero roster** (Ash/Wren/Bram/Mira) and its flat
  Vigor/Might level-up choice. Every hero is now built via the D&D-style
  character-creation flow; `MainMenuScene`'s old START button is gone, and
  "Create Party" (renamed "New Game") is the only way into a battle.

Added:
- **Hero-sprite loading plumbing**: `HeroDefinition.assetKey`, a new (empty)
  `SPRITE_MANIFEST`, `BattleScene.preload()`, and a sprite-or-shape fallback
  for hero tokens — ready for real art to be dropped in later with no
  rendering rewrite, per `ASSET_PLAN.md`.
- **`CharacterBuildSystem.defaultPartyBuilds`**: a small deterministic
  starter party, now Co-op's default (it had silently depended on the
  removed classic roster for this).

Tests: 983 → 976 (a classic-roster-only test file removed, several others'
fixtures untangled from `data/heroes.ts`). Typecheck, all tests, and the
production build all pass. `npm run dev` serves HTTP 200.

## [Unreleased] — 0.2.0-dev — Phase 25: Cheap/Expensive Structure Tiers, Opportunistic Wall-Bash AI, Trap-Disarming Saboteurs (D-116)

Kevin asked for more cheap/expensive structure tiers, a real siege AI where
any enemy can choose to attack a structure based on personality/opportunity,
and enemies/skills that detect and disarm traps. See **D-116** in
`DECISIONS.md` for the full method.

Added:
- **Ten new structures** (`data/structures.ts`), each bracketing an existing
  item's cost/effect: **Wicket Gate**/**Portcullis** (gate curve), **Snare
  Wire**/**Mangler Trap** (ground-trap curve), **Net Snare**/**Storm Lance**
  (the first flying-trap brackets — closes the deferred "no anti-air trap
  tier" item), **Sparring Post**/**War Dais** (melee-platform curve), **Low
  Perch**/**Sky Bastion** (ranged-platform curve — Low Perch trades range
  for damage, Sky Bastion grants both). `SHOP_ORDER` grows from 12 to 22.
- **Opportunistic wall bash**: any ordinary melee enemy now bashes a
  destructible wall in its own attack range (plain `attackDamage`, no siege
  multiplier) when no hero is reachable this phase — a dedicated siege
  enemy's own unconditional priority is unaffected.
- **Trap disarm — Saboteur archetype**: a new `trapSense` field lets an
  enemy detect and disarm/destroy a placed trap outright, at the same
  unconditional priority siege already gives walls. Two new enemies:
  **Saboteur** and **Warren Stalker**.

Changed:
- **Shop grid pagination**: the Gear grid's existing page-nav mechanism
  (Phase 17/D-108) is generalized to also paginate the Shop grid, which
  outgrew a single page this phase — both grids now permanently cap at 4
  rows regardless of catalogue size.

Tests: 960 → 983. Typecheck, all tests, and the production build all pass
(109 modules, unchanged). `npm run dev` serves HTTP 200.

## [Unreleased] — 0.2.0-dev — Phase 24: A "Sand" Build-Restricted Tile, Five New Structures/Traps (D-115)

Kevin asked for a sand tile that behaves like normal terrain except that
nothing can be built on it, integrated into existing maps, plus more
buildings and traps generally — explicit design freedom invited ("be
creative and continue using good game design theory"). See **D-115** in
`DECISIONS.md` for the full method.

Added:
- **A "sand" terrain tile** (`data/testMap.ts`, char `D`): walkable exactly
  like plain floor, no terrain effect — the only difference is a new
  `GameMap.isBuildable` check that `BuildSystem.canPlace` now enforces,
  which sand fails and every other walkable tile passes.
- **Sand integrated into three existing maps**: Shattered Causeway (canyon
  dunes past the chasm), Cinderfall Rift (ash drifts at the connector
  mouths), The Drowning Vale (mudflats bordering the water fringe) — each
  denying a specific wall-cheese spot. Frostbound Hollow, Emberford,
  Saltmere, and the classic Training Yard map were left untouched.
- **Palisade** and **Bulwark**: a cheap/fragile and a pricier/tough wall,
  bracketing Barricade into a real three-point cost/durability curve.
- **Watchtower**: the first platform with an `"any"`-audience bonus (+1
  basic-attack damage regardless of melee/ranged) — `PlatformAudience`
  gains `"any"`.
- **Frost Trap**: a buildable ground trap applying "restrained" (previously
  only ever spell-placed via Web Patch).
- **Bear Trap**: a heavy-damage, ground-only trap that's consumed and
  removed after its first trigger — the first `singleUse` trap, a genuine
  new risk/reward point on the trap curve.

Fixed:
- `BattleScene.showTrapTrigger` had logged every trap trigger as "Spike
  Trap" since Phase 5, regardless of which trap (or terrain hazard)
  actually fired. Now resolves and logs the real name.

Tests: 937 → 960. Typecheck, all tests, and the production build all pass
(109 modules, unchanged). `npm run dev` serves HTTP 200.

## [Unreleased] — 0.2.0-dev — Phase 23: Expanded Maps and Terrains — a Pit Hazard, Hero-Affecting Terrain, Dynamic Terrain, Four New Maps (D-114)

Kevin asked for expanded maps and terrains, explicitly inviting design
judgment ("use the principles of good map design and game design... easy to
learn, hard to master"). A research pass found only 3 built-in maps exist
today, two of which are the same 16x9 skeleton with hazard tiles swapped —
almost no real geometric variety. Three scoping questions answered toward
the fuller option before any code: hero-affecting terrain as a new per-map
opt-in flag (not retrofitting existing maps), a real "pit" hazard plus a
genuine mid-battle dynamic-terrain system (not just more static hazard
types), and staying within the Map Builder's existing 6-20 col / 6-9 row
size ceiling (a real canvas/HUD constraint, not a guess). See **D-114** in
`DECISIONS.md` for the full method.

Added:
- **A "pit" terrain tile** (`data/testMap.ts`, char `@`): impassable for
  ground units like a cliff, but a unit forced onto one by a push effect
  (a weapon-mastery Push, or a `forcedMoveTiles` spell) falls in and is
  instantly defeated — the "holes" hazard the original Source of Truth
  vision named but never built, resolved through the same death-trigger
  funnel any other kill uses.
- **Hero-affecting terrain**: a new `ParsedMap.hazardsAffectHeroes` flag —
  when set, a hero standing on a hazardous tile suffers the exact same
  terrain effect an enemy already does, ticked once per player phase.
  Opt-in per map; Emberford/Saltmere are untouched.
- **`systems/DynamicTerrainSystem.ts`** (new, pure): mid-battle terrain
  changes keyed to a wave number, with a telegraphed warning ahead of time
  — powers a cyclical tide (The Drowning Vale) and a one-way bridge
  collapse (Cinderfall Rift) from the same generic, data-driven mechanism.
- **Four new maps**, each a different map-design idea rather than another
  reskin: **Shattered Causeway** (a single bridge across a chasm — the
  pit's showcase), **The Drowning Vale** (a flood zone that rises at Wave 3
  and recedes at Wave 6), **Cinderfall Rift** (a direct bridge that
  permanently collapses at Wave 4, forcing a reroute), **Frostbound Hollow**
  (a cliff ridge splitting the map, crossable only by flying units or a
  long detour). All four are immediately playable via Free Play.
- **Every terrain tile is now actually visible on the real battle board** —
  a real, pre-existing gap fixed alongside this content: cliff/water/fire/
  acid have been mechanically distinct since Phase 11.7 but silently
  rendered as plain floor in `BattleScene` the entire time.
- The Map Builder's Terrain palette gained the new "Pit" option.

Fixed:
- `BattleScene.buildBoard` now colors every tile by its real `TileType`
  instead of only distinguishing floor vs. blocked.

Tests: 900 → 937. Typecheck, all tests, and the production build all pass
(109 modules, up from 104). `npm run dev` serves HTTP 200. Not yet confirmed
by a human in a browser — the SEVENTH consecutive content/mechanics phase to
ship this way — see **KI-071**.

## [Unreleased] — 0.2.0-dev — Phase 22: Magic-Item Expansion — Real SRD Magic Items, a `+1/+2/+3` Enchant Overlay, a Brand-New Loot System, and a Level-Scaled Shop (D-113)

Kevin asked for "a more complete repertoire of items" — potions, `+1/+2/+3`
weapon/armor/shield modifications, "lots of free access magic items," and
the Cape of Billowing with its own visual flair — plus a loot system he
explicitly invited design input on: enemy drop odds by tier, an occasional
lucky one-tier-up drop, most enemies dropping nothing, curated campaign
loot, random Free Play loot, and a shop that sells magic items gated by
average party level. Three scoping questions answered toward the more
real/complete option before any code: a real `+1/+2/+3` enchant OVERLAY
(not a ~150-entry flat catalog), a real animated cape visual (not
data-only), and keep building now rather than pause for the six-phases-deep
overdue in-browser pass. See **D-113** in `DECISIONS.md` for the full
method, every research finding, and every deliberately-deferred item.

Added:
- **A real SRD 5.1 `+1/+2/+3` enchant system** (`data/equipment.ts`): any
  mundane weapon, shield, or real-armor chest item can be enchanted on
  demand via a `${baseId}+${level}` composite id — no attunement required
  (the real SRD rule), no new catalog entries needed for any weapon/armor
  added in the future.
- **15 new magic items** (`data/magicItems.ts`): 14 real SRD-sourced items
  (Ring/Cloak of Protection, Bracers of Defense, Stone of Good Luck, Ring of
  Resistance, Ring of Free Action, Periapt of Proof against Poison, Boots of
  Striding and Springing, Boots of Speed, Bracers of Archery, Robe of the
  Archmagi, Flame Tongue, Frost Brand, Dagger of Venom) plus the original
  **Cape of Billowing** — NOT SRD content (the real "Cloak of Billowing" is
  from Xanathar's Guide to Everything), so built as an original item with
  its own real, animated flowing-cape visual effect (a new Phaser `Graphics`
  tween/flutter, this scene's first use of the `update()` per-frame
  lifecycle hook).
- **A tenth gear slot, "Back"** — home to every cloak/cape item, including
  the new Cape of Billowing and Cloak of Protection.
- **8 new potions** (`data/potions.ts`): the real SRD "Potion of Healing"
  rarity-tiered potency rule (4 tiers), Potion of Heroism, Potion of Speed
  (a permanent movement bonus), Potion of Resistance (a permanent
  damage-halving grant, reusing Rage/Wild Shape's own mechanism), and
  Restorative Ointment (cures every active status and heals). Every potion
  now carries a `rarity`, the loot system's own tier key.
- **A brand-new loot-drop system** (`systems/LootSystem.ts`, pure and
  tested): drop chance and base rarity scale by enemy role tier (minion
  12%/common, miniboss 55%/uncommon, boss 90%/rare, legendary 100%/veryRare),
  with a flat 12% chance to roll one tier higher — "the occasional lucky
  drop from a lesser enemy" Kevin asked for. A drop either names a real
  potion/magic item at that rarity, or generates a random enchanted mundane
  weapon/armor/shield at the matching level.
- **Campaign-curated vs. Free-Play-random loot**: `CampaignDefinition` gains
  an optional `lootPoolIds` (Emberford Reach: fire-themed; Saltmere
  Shallows: water-themed; both fall back to the full pool if a restriction
  would strand a rarity tier). The classic campaign and Free Play both use
  the full, unrestricted pool.
- **A dropped item auto-equips into the first hero with room, or auto-sells
  for gold** if no hero currently has a matching, attunement-legal, grip-
  legal open slot — no "found but not equipped" inventory UI this pass, a
  documented scope boundary (see KI-070).
- **A level-scaled shop** (`systems/ShopSystem.ts`, pure and tested):
  common/uncommon gear stays visible at every level; rare/veryRare/legendary
  magic items (including Phase 13.9's original five, now gated for the
  first time too) unlock at average party level 4/8/13.

Tests: 864 → **900** (+36). Typecheck, all tests, and the production build
all pass (104 modules, up from 101 — `data/magicItems.ts`,
`systems/LootSystem.ts`, `systems/ShopSystem.ts`). `npm run dev` serves HTTP
200. Not yet confirmed by a human in a browser — see **KI-070**.

## [Unreleased] — 0.2.0-dev — Phase 21: Second Wave of Enemy Archetypes — Hero-Side Status Effects, 12 More Mechanics, 24 New Enemies (D-112)

Immediately after Phase 20 shipped, Kevin scoped a second wave of archetypes
in the same session (recorded in `PHASE_HANDOFF.md` for a fresh chat to pick
up). This session read that prep and confirmed three scoping questions
before any code, all toward the fuller/faster option: keep building rather
than pause for the now-five-phases-overdue in-browser pass; build the
hero-side status-effect system as a FULL generic system (any status usable
on either side), not narrowly scoped to just poison+silence; and verify
Swarm's real SRD rules FIRST, before any other archetype in the batch.

Added:
- **A hero can now carry status effects for the first time** —
  `Hero.activeStatuses`, mirroring `Enemy.activeStatuses` field-for-field
  and reusing the exact same `data/statusEffects.ts` shape. Every existing
  status field is consumed on the hero side too: `armorClassDelta` folds
  into `Hero.armorClass`; `movementReduction` into a new
  `effectiveMovementTiles`; `attackRollDisadvantage` into a new
  `attacksWithDisadvantage` getter (folded into attack rolls);
  `preventsAction` gates `canMove()`/`canAct()` directly (blocks a
  stunned/restrained hero everywhere, no new call sites needed);
  `damagePerTurn` ticks via a new `tickStatusDamage()` method once per
  player phase. A new status, **"silenced"** (`preventsCasting`), blocks
  opening the spellbook/using a class ability without blocking movement or
  a basic Attack. A hero's on-token status badge mirrors the existing enemy
  one. Two new, previously-impossible mid-player-phase death paths (a
  poison tick, a Reflector's counter-damage) each get their own explicit,
  deferred party-wipe check.
- **Twelve more enemy mechanics**: **Berserker** (`enrage` — flat
  attack/damage bonus per HP band already lost), **Lifedrinker**
  (`lifedrinkPercent` — heals itself off a landed hit), **Splitter/Carrier**
  (`onDeathSpawns` — spawns weaker copies on death, from ANY cause, via a
  new `WaveSystem.resolveDeathTriggers`/`BattleScene.resolveDeaths` funnel),
  **Explosive** (`onDeathExplode` — a flat AoE burst on death), **Shielded**
  (`damageShieldHp` — a flat damage-absorbing ward, via a new
  `Combatant.absorbDamage?` hook), **Reflector** (`reflectsDamagePercent` —
  reflects a % of a landed hit back at the attacker while its shield
  holds), **Gold Thief** (`goldTheftAmount` — steals gold on a hit, via a
  new `EconomySystem.deduct`), **Teleporter** (`teleportsEveryNTurns` —
  periodically jumps straight toward the exit), **Mimic** (`mimicDisguise`
  — disguised as scenery/treasure until a hero gets adjacent, a brand-new
  disguise mechanic kept separate from stealth), **Healer** (`healAura` —
  heals nearby wounded allies each phase), **Anti-caster**
  (`inflictsStatusOnHit` — a landed hit applies a status to the hero,
  reused by the Healer/Debuffer hybrid too), and **Multi-Phase Boss**
  (`phaseChange` — permanently changes an enemy's mechanic set at an HP
  threshold, via a new per-INSTANCE `Enemy.activeDef` override that never
  mutates the shared definition).
- **Swarm** (`swarm`), verified against the real SRD 5.2.1/2024 "Swarm"
  trait via two independent sources: can occupy another living enemy's tile
  and vice versa; immune to charmed/restrained/stunned/toppled; deals half
  damage once Bloodied. Real damage-type resistance is NOT modeled (this
  game has no damage-type-aware resistance system).
- **24 new enemies** (`data/enemies.ts`): 21 new minions, 2 new minibosses
  (Bloodrage Warlord, The Husk), 1 new true boss (Sundered King). Aegis
  Bearer combines Shielded+Reflector; Plague Warden combines
  Healer+Anti-caster — both single roster entries, per Kevin's own "these
  could be combined" ask.
- **Free Play integration**: all 21 new minions join `EXPANDED_MINIONS`; the
  3 new miniboss/boss entries join `BOSS_OPTIONS` (boss row now 13 buttons).
- Tests: 813 → **864** (+51). Typecheck, all tests, and the production
  build all pass (101 modules, unchanged). `npm run dev` serves HTTP 200.
  Not yet confirmed by a human in a browser — see **KI-069**.

## [Unreleased] — 0.2.0-dev — Phase 20: "Tons of Different Enemies" — Six New Mechanics, 21 New Enemies (D-111)

Kevin asked for a huge variety of enemies, almost all with a real unique
hook, naming several archetypes himself (siege, assassin, runner, tank,
treasure-laden, summoner, captain/banner-lord, varied attack types) plus a
longer-term direction (level 20+ parties, a possible endless mode). Two
scoping questions both answered toward the fuller option: build every new
mechanic as a real system this session (not just the cheap stat-variant
enemies), and build epic-tier bosses now but leave an actual endless-mode
wave generator for a separate future phase.

Added:
- **Six new enemy mechanics**, each reused by 2+ roster entries: **siege**
  (`siegeDamageMultiplier` — attacks and destroys a destructible wall in
  its own attack range instead of a hero; walls gain a real `maxHp`/
  `BuildSystem.damageStructure`), **stealth** (`stealth` — hidden from all
  hero targeting until its first strike, an Advantage-rolled ambush that
  permanently reveals it), **aura buff** (`auraBuff` — a captain buffs
  every OTHER nearby enemy's to-hit/damage/movement, recomputed live every
  phase, rendered as a real on-board ring), **reinforcements**
  (`callsReinforcements` — periodically spawns more enemies beside itself
  on a cooldown, deliberately separate from the hero-ally `SummonSystem`),
  **treasure** (`treasureBonusGold` — extra gold on a kill, called out in
  the log), and **AoE/breath** (`aoeAttack` — hits every hero in range at
  once, or forces each to save individually when combined with a
  saving-throw DC). **Pure runners** (`ignoresHeroes`) never attack at all.
- **21 new enemies** (`data/enemies.ts`): 16 minions (two per mechanic, plus
  the tank Ironhide), 1 new miniboss (Juggernaut), 2 new true bosses
  (Warlord Korrath, The Devourer), and 2 new **`role: "legendary"`**
  level-20+ capstones (Ashen Sovereign, The Hollow Empress) — a new role
  tier above `"boss"`, with matching `BattleScene`/`BestiaryScene` support
  (the latter fixing a real bug: a legendary enemy would otherwise silently
  vanish from the Bestiary's role grouping).
- **Free Play integration**: all 16 new minions join `EXPANDED_MINIONS`; the
  new miniboss/boss/legendary tier joins `BOSS_OPTIONS`.

Tests: 802 → 813 (+11 new `tests/enemyMechanics.test.ts`, plus new roster/
data checks and updated boss/miniboss counts). Typecheck/build clean (101
modules, unchanged). `npm run dev` serves HTTP 200. See **D-111** in
`DECISIONS.md` for the full method; **KI-068** in `KNOWN_ISSUES.md` for the
in-browser verification checklist.

## [Unreleased] — 0.2.0-dev — Phase 19: Real Dual-Wielding — Two-Weapon Fighting AND Nick (D-110)

Kevin pushed back on Two-Weapon Fighting being left inert. Building its
real prerequisite — a base dual-wielding mechanic (a Light melee weapon in
each hand, bonus-action off-hand attack) — also gave the Nick weapon
mastery (inert since Phase 17 for the identical reason) a real hookup for
free, so both were fixed together.

Added:
- **Real dual-wielding**: a Light melee weapon may now occupy the existing
  `"shield"` gear slot as an off-hand weapon (mutually exclusive with a
  real Shield, matching the SRD) — `BattleScene.targetGearSlot` fills the
  empty `"weapon"` slot first, then falls back to `"shield"`, mirroring the
  existing ring1/ring2 auto-fill rule. Equipping a second Light weapon
  while a real Shield already occupies the off-hand is refused with a clear
  message instead of silently displacing the main-hand weapon.
- **`Hero.canUseOffHandAttack`/`useOffHandAttack`/`offHandAttackDamage`** —
  once per hero turn, dual-wielding grants one off-hand attack after the
  main Attack action; it costs the bonus action unless either weapon
  carries Nick (free instead); its damage skips this hero's ability
  modifier unless it has the Two-Weapon Fighting feat.
- **`BattleScene.tryOffHandAttack`** resolves it right after the main-hand
  swing(s), deliberately simple (attack roll + damage only, no weapon-
  mastery/proc cascade — same precedent Cleave's own second attack set).
- **Two-Weapon Fighting and Nick both flipped `mechanicallyActive: true`.**
  Nick's `NICK_INERT_REASON` export removed (no longer applicable).

Tests: 778 → 789 (+11, plus one stale "Nick is the exception" assertion
fixed in `tests/weaponsAndArmor.test.ts`). Typecheck/build clean. See
**D-110** in `DECISIONS.md` for the full method; **KI-067** in
`KNOWN_ISSUES.md` for the in-browser verification checklist.

## [Unreleased] — 0.2.0-dev — Phase 18: 13 More SRD Feats, Enforced Prerequisites (D-109)

Kevin asked to add as many feats as possible from the 2024 rules, with
prerequisites enforced. A verification pass against the real SRD 5.2.1 PDF
found the free document has only 17 feats total, and that 3 of the 4
starter feats already shipped (Tough, Lucky, Athlete) were mistakenly
attributed to it back in Phase 11.3 — only Alert was real SRD content. Kept
the mechanics, fixed the attribution, and added all 13 net-new SRD-legal
feats.

Added:
- **13 new feats** (`data/feats.ts`): Magic Initiate, Savage Attacker,
  Skilled (Origin); Grappler (General); Archery, Defense, Great Weapon
  Fighting, Two-Weapon Fighting (Fighting Style, prereq: a class Fighting
  Style feature); Boon of Combat Prowess, Boon of Dimensional Travel, Boon
  of Fate, Boon of Irresistible Offense, Boon of Spell Recall, Boon of the
  Night Spirit, Boon of Truesight (Epic Boon, prereq: level 19+).
- **`Hero.meetsFeatPrerequisites`** — this codebase's first general feat-
  prerequisite check (level, ability-score-any-of, Fighting-Style class,
  spellcasting class), replacing the old bare "doesn't already have it"
  filter in `BattleScene.showFeatChoice`.
- **Grappler's restrain-on-hit** (mirrors the Topple weapon mastery's
  save-then-status shape) and Advantage against a restrained target;
  **Boon of Combat Prowess**'s once-per-turn miss-to-hit; **Boon of
  Fate**'s once-per-rest auto-applied attack bonus; **Boon of Spell
  Recall**'s 1d4-vs-slot-level chance to not expend a spell slot (new
  `RandomService.rollD4()`); **Boon of Irresistible Offense**'s natural-20
  bonus damage; **Magic Initiate**'s 2 cantrips + 1 free-castable leveled
  spell from a chosen Cleric/Druid/Wizard list, repeatable across all
  three.
- **Two new ASI-overlay follow-up steps** (ability picker, spell-list
  picker), reusing the existing `renderAsiPrompt` helper with no new
  overlay component.

Fixed:
- **`CONTENT_SOURCES.md`'s attribution for Tough/Lucky/Athlete** — corrected
  from "SRD 5.2.1" to original content, since they're PHB-exclusive and not
  in the free SRD document. Mechanics unchanged.

Tests: 744 → 778 (+34). Typecheck/build clean. See **D-109** in
`DECISIONS.md` for the full method, every scope-fork answer, and the
source-verification method; **KI-066** in `KNOWN_ISSUES.md` for the full
in-browser verification checklist.

## [Unreleased] — 0.2.0-dev — Phase 17: Real Weapons, Armor, and Weapon Mastery (D-108)

Kevin asked to add "tons and tons" of source-accurate weapons/armor and
build real weapon masteries assigned to the appropriate weapons. Two
scoping questions answered toward the fuller/more real option: real
mechanical hooks for all 7 modelable mastery properties (not data-only),
and an equipped weapon REPLACES a hero's base attack damage/range (not a
small bonus on top). The first new equipment architecture since Phase 11.5.

Added:
- **36 of the SRD 5.2.1's 38 core weapons** (`data/weapons.ts`) — every
  Simple/Martial Melee/Ranged weapon except the two core firearms (Musket,
  Pistol, excluded for fantasy-setting tone), each with its real category,
  damage dice/type, properties (Ammunition/Finesse/Heavy/Light/Loading/
  Reach/Thrown/Two-Handed/Versatile), and assigned mastery property.
- **All 11 SRD armors + the Shield** (`data/armor.ts`) — light armor adds a
  hero's full Dex modifier, medium caps it at +2, heavy ignores it
  entirely; Strength requirement/stealth disadvantage recorded as real data
  (not yet mechanically enforced).
- **Two new gear slots, `"weapon"`/`"shield"`** (`data/equipment.ts`),
  merged into the existing equipment registry — the whole Gear shop/
  Compendium/attunement/proc system worked with zero special-casing.
- **`systems/WeaponSystem.ts`** (new, pure, tested) — dice-average damage
  (reusing `CharacterSystem.fixedHitDieGain`'s rounding convention), weapon
  range-in-tiles, and Finesse/ranged/melee ability-modifier selection.
- **Six real weapon-mastery mechanics** (`BattleScene.applyWeaponMastery`):
  Push (forced movement), Sap/Topple (two new status effects, `"sapped"`/
  `"toppled"`, reusing "blinded"'s disadvantage shape), Slow (reuses the
  existing "slowed" status), Graze (chip damage on a miss), Vex (advantage
  on the next attack vs. the same target), Cleave (a second, once-per-turn
  attack against an adjacent enemy). Nick stays honestly data-only — its
  real trigger needs a dual-wielding system this game doesn't have.
- **`Enemy.attacksWithDisadvantage`** — a new generic getter (any active
  status with `attackRollDisadvantage`) replacing `WaveSystem`'s old
  hardcoded "blinded"-only check, so "sapped"/"toppled" (and any future
  status) plug in for free.
- **A real Two-Handed/Shield equip conflict** (`Hero.wouldConflictWithGrip`,
  gated in `BattleScene.equipGearOnHero`) — the SRD's real rule.
- **The Gear shop grid is now paginated** (16 items per page, Prev/Next) —
  the catalogue nearly quadrupled in size; `CompendiumScene`'s Equipment
  tab joins Classes/Spells as a paginated category for the same reason.

Tests: 695 → 744 (+49). Typecheck/build clean (101 modules, up from 98 —
three new files). `npm run dev` serves HTTP 200. See **D-108** in
`DECISIONS.md` for the full method, every scope-fork answer, and the
source-verification method; **KI-065** in `KNOWN_ISSUES.md` for the full
in-browser verification checklist.

## [Unreleased] — 0.2.0-dev — Phase 16 follow-up (same day): fix `aoeAtRange` + saving throws, add Hellish Rebuke (D-107)

Fixed both gaps D-106 itself logged.

Fixed:
- **`aoeAtRange` abilities now support a real saving throw.**
  `BattleScene.castAoeAtRangeSpell` branches on `ability.savingThrow` —
  when set, every enemy in the blast rolls independently against the
  caster's `spellSaveDC` instead of an attack roll. 25 of 29 `aoeAtRange`
  spells (Fireball, Lightning Bolt, Confusion, Stinking Cloud, etc.) now
  carry the correct SRD saving-throw ability.
- **`forcedMoveTiles` now actually applies on an `aoeAtRange` ability**
  (Thunderwave, Gust of Wind, Reverse Gravity) — previously silently
  inert outside the single-target resolver. Pushes originate from the
  blast's own tile, not the caster.
- **Warlock's Hellish Rebuke** added to the spell catalogue (319 spells,
  up from 318) and wired with a real `abilityId` — modeled as a normal
  action-cost attack, not the SRD's reaction (this game has no reaction
  economy for a caster to hook a damage trigger into).

Added:
- **`tests/abilities.test.ts`** — structural consistency checks across the
  whole `ABILITIES` catalogue (no ability combines `autoHit` with
  `savingThrow`; every `savingThrow.ability` is a real ability score id),
  guarding against this exact class of bug recurring.

Tests: 691 → 695 (+4). Typecheck/build clean (98 modules, unchanged).
`npm run dev` serves HTTP 200. See **D-107** in `DECISIONS.md` for full
notes and **KI-064** in `KNOWN_ISSUES.md` (updated — both gaps marked
resolved).

## [Unreleased] — 0.2.0-dev — Phase 16: Make All Spells Usable (D-106)

The largest single content/systems addition in the project's history.
Kevin asked to "make all the spells usable in the game" and chose the
fullest option at every scope fork: build real new mechanics (not
reflavor), expand every full-caster class to its complete known-spell
list, and do it all as one big sequenced batch.

Added:
- **Five new status effects** (`data/statusEffects.ts`): `poisoned`,
  `restrained`, `blinded` (attacker disadvantage), `exposed` (lowers
  target Armor Class), `charmed` (redirects the enemy's attack to another
  enemy — see `WaveSystem.tickEnemyPhase`).
- **A new ally-buff system** (`data/buffEffects.ts`, `Hero.activeBuffs`):
  `blessed`/`warded`/`guided`, folded into `Hero.armorClass`/
  `savingThrowBonus`/a new `effectiveAttackBonus` getter, full
  `HeroSnapshot` round-trip support.
- **A third `AbilityKind`, `"aoeAtRange"`** (choose a tile, hit an area
  around it — reuses `CombatSystem.attackArea`), plus `areaAllies`/
  `appliesBuff`/`forcedMoveTiles`/`teleportSelf`/`summonsId`/
  `altersTerrainId` fields on `AbilityDefinition`.
- **A new summon system** (`data/summons.ts`, `entities/Summon.ts`,
  `systems/SummonSystem.ts`): a temporary ally combatant, three shared
  archetypes, auto-attacks the nearest enemy once per hero turn.
- **Terrain-shaping via `BuildSystem`**: two new spell-only structures
  (`spectral-wall`, `web-patch`), placed/auto-removed by a new
  `BattleScene.temporaryStructures` duration tracker.
- **~184 more spells wired to a real `abilityId`** (198 of 318 total, up
  from 14) via a documented 12-archetype rulebook applied level-by-level
  across the whole catalogue. The remaining ~120 stay genuinely data-only
  (pure information/social/utility/travel spells with no combat use).
- **Six full-caster classes' known-spell lists** (`data/characterCreation.ts`)
  expanded from 1-2 curated entries to their full real SRD 5.1 list,
  filtered to what's wired: Wizard (7 cantrips/106 leveled), Cleric (3/56),
  Bard (2/51), Druid (5/61), Sorcerer (7/83), Warlock (4/37). Paladin/Ranger
  deliberately not expanded (their slots already auto-spend on Divine
  Smite/Hunter's Mark).
- **`BattleScene`'s spellbook overlay rebuilt as a paginated 4×3 grid**
  (was a single centered row, sized for 2-6 spells — would have rendered
  most of a 100+-spell list off-canvas).

Tests: 677 → 691 (+14: new `summonSystem.test.ts` [5], `buffEffects.test.ts`
[7], plus 2 new `statusEffects.test.ts` cases for blinded/exposed/charmed;
`spellSlots.test.ts`/`spells.test.ts` had stale Phase 15-era hardcoded
assertions updated to structural checks). Typecheck/build clean (98
modules, up from 94). `npm run dev` serves HTTP 200. Not yet confirmed by
a human in a browser — see **KI-064** in `KNOWN_ISSUES.md` for the full
checklist and every known, deliberate gap (aoeAtRange + savingThrow,
Hellish Rebuke missing from the catalogue since Phase 15, Paladin/Ranger's
spellbook, summons outside `BattleStateSnapshot`). See **D-106** in
`DECISIONS.md` for the full scope-fork answers and implementation notes.

## [Unreleased] — 0.2.0-dev — Phase 15 follow-up: Subclass-Granted Spell Lists (D-105)

Modeled the real SRD "bonus spell" feature for the four subclasses that
actually have one — a gap D-104 itself had flagged as out of scope.
Verified against SRD 5.1 via 2-3 independent mirrors per feature (catching
and discarding one wrong search-snippet variant for Oath of Devotion along
the way). Every spell needed was already in Phase 15's 318-entry catalogue
— no new spell entries required.

Added:
- **`ClassFeature` gains an optional `grantedSpellIds?: string[]`**
  (`src/game/data/classes.ts`).
- **Life Domain (Cleric)** gains 5 "Domain Spells" feature entries
  (levels 1/3/5/7/9); **Oath of Devotion (Paladin)** gains 5 "Oath Spells"
  entries (levels 3/5/9/13/17); **The Fiend (Warlock)** gains 5 "Expanded
  Spell List" entries (character levels 1/3/5/7/9, mapped from the SRD's
  own 1st-5th spell-level framing via this game's shared full-caster slot
  table). All fifteen are data-only (`mechanicallyActive: false`) — this
  game's known-spell list is fixed per class, not per subclass, and none
  of the granted spells besides Cure Wounds (already known regardless of
  domain) have a real `abilityId` yet.
- **`CIRCLE_OF_THE_LAND_SPELLS`** (`src/game/data/subclasses.ts`): the full
  7-terrain × 4-tier reference table for Circle of the Land's Circle
  Spells, kept separate from the per-feature field since the terrain
  CHOICE itself has no character-creation UI yet — a bigger, still-
  deferred gap than the other three subclasses.

Tests: 668 → 674 (+6, all in `tests/subclasses.test.ts`, 39 → 45).
Typecheck/build clean. Not built: any new mechanic
that makes these spells castable, or a Circle-of-the-Land terrain-choice
UI — see **D-105** in `DECISIONS.md`.

## [Unreleased] — 0.2.0-dev — Phase 15: Full SRD Spell-List Catalogue (D-104)

Added every SRD 5.1-licensable spell for the game's eight caster classes
(Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard), verified
against two independent SRD mirrors rather than assumed. The spell
catalogue grows from 14 curated entries to 318.

Added:
- **`src/game/data/spells.ts`** gains 304 new spell entries (name, level
  0-9, school, and an original description) — every SRD spell on the eight
  classes' base spell lists that wasn't already logged. All data-only: no
  new `abilityId`s, no change to known-spell-lists, no new game mechanics
  (most describe effects — AoE at range, buffs, summons, illusions — this
  game has no system for yet, same treatment already given to Bless/
  Burning Hands/Mage Armor/Guidance/Shield of Faith).
- **`CompendiumScene`'s Spells tab** gains a per-level filter (Cantrip/
  1st/.../9th) plus Prev/Next paging, matching the existing Classes-tab
  pattern — needed once the catalogue outgrew a single flat screen.

Changed:
- `tests/spells.test.ts`'s two hardcoded full-id-list tests replaced with
  structural checks (count, schema validity, level distribution, pre-
  existing spells still present, new spells still data-only).

Tests: 664 → 668. Typecheck/build clean. Not built: any new mechanic to
make the added spells castable — see **D-104** in `DECISIONS.md` for the
full scope boundary and what specifically couldn't be added (SRD 5.2.1-
specific verification, subclass-granted expanded spell lists).

## [Unreleased] — 0.2.0-dev — Phase 12.3: Turn-Lock Ownership (D-103)

`controlledBy: "remote"`, a host-only "Start Battle" handoff, and hero-
selection ownership gating in `BattleScene` — the first sub-phase where
`BattleScene` itself changes. Result-broadcast (live sync of two clients'
boards as actions happen) is explicitly deferred: investigating
`BattleScene` found no existing "redraw from model" function to reuse
(enemies/structures spawn dynamically), making it the single riskiest,
least-verifiable-without-a-browser piece of the whole phase. Shown that
tradeoff, Kevin chose the smaller, ownership-only scope for this session.

Added:
- **`HeroControlMode` gains `"remote"`** (`src/game/data/heroes.ts`) —
  flows through `Hero`, `SaveSystem.CONTROL_MODES`, and `firestore.rules`'
  `isValidBuild` automatically.
- **`CoopSessionSystem.ts`** gains `status`/`heroOwners` on
  `CoopSessionRecord`, `startCoopBattle` (alternates hero ownership across
  the classic roster in slot order), and `canActOnHero`.
- **`CoopSessionSync.ts`** gains `startBattle`.
- **`firestore.rules`**: a new host-only `"lobby" -> "battle"` update shape
  in the `coopSessions` block, plus matching (unrun) test cases.
- **`CoopLobbyScene.ts`** gains a "Start Battle" button (host-only, once
  full); the guest auto-navigates into battle via its existing live
  subscription once `status` flips.
- **`BattleScene.ts`** accepts an optional `coopSession` context: assigns
  `controlledBy` per hero from `heroOwners`, and a new `canLocallyControl`
  gates every hero-selection entry point.

Tests: 661 → 664 (+3, `tests/coopSessionSystem.test.ts`). Typecheck/build
clean, 94 modules (unchanged — no new files). Not built: result-broadcast /
live board sync — see **D-103** in `DECISIONS.md`.

## [Unreleased] — 0.2.0-dev — Phase 12.2: Cooperative Session Lobby (D-102)

A join-by-code lobby for cooperative multiplayer, per the Phase 12 design
doc's second proposed sub-phase. Surfaced this project's first need for a
free-text input (a join code) — Kevin chose a real HTML `<input>` overlay
over a custom keyboard widget, for native paste support.

Added:
- **`src/game/systems/CoopSessionSystem.ts`** (pure, tested) — session-code
  generation, `CoopSessionRecord`/`CoopParticipant`, join-eligibility rules
  (capped at 2 participants).
- **`src/game/cloud/CoopSessionSync.ts`** — `createSession`/`joinSession`/
  `subscribeToSession`/`deleteSession`, transaction-guarded against
  simultaneous-join/code-collision races.
- **`firestore.rules`**: new `coopSessions/{sessionId}` block (host-only
  create, append-only join, host-only delete) plus matching (unrun) test
  cases in `firestore-tests/rules.test.ts`.
- **`src/game/scenes/CoopLobbyScene.ts`**: create-or-join UI, reached from a
  new "Co-op" button on the main menu (Firebase-only).
- **`main.ts`**: `dom.createContainer: true` — enables the new HTML input.

Tests: 653 → 661 (+8, `tests/coopSessionSystem.test.ts`). Typecheck/build
clean, 91 → 94 modules. Not built: any battle integration — see **D-102**
in `DECISIONS.md`.

## [Unreleased] — 0.2.0-dev — Phase 12.1: `BattleStateSnapshot`, a pure serialize/restore round trip (D-101)

Kevin approved proceeding into 12.1, the first sub-phase the Phase 12
design doc (D-100) proposed — a pure, tested full-battle state snapshot,
built entirely headless.

Added:
- **`Hero.toSnapshot()`/`static fromSnapshot()`** (new `HeroSnapshot`,
  `src/game/entities/Hero.ts`) — covers every field a Hero carries: HP,
  position, gear, class level, every per-rest resource pool, every
  per-turn flag, subclass assignment.
- **`Enemy.toSnapshot()`/`static fromSnapshot()`** (new `EnemySnapshot`
  and a new `statuses` getter, `src/game/entities/Enemy.ts`).
- **`BuildSystem.toSnapshot()`/`.restoreFrom()`** and
  **`WaveSystem.toSnapshot()`/`.restoreFrom()`** (new
  `BuildStateSnapshot`/`WaveStateSnapshot`).
- **`TurnSystem.fromHistory()`** — replays the existing `history` getter
  through `transitionTo`, no new state needed.
- **New `src/game/systems/BattleStateSnapshot.ts`**:
  `captureBattleState`/`restoreBattleState`, the top-level orchestrator.
  `RandomService`'s internal PRNG state is deliberately excluded — see
  D-101/D-100 for why.

Tests: 648 → 653 (+5, `tests/battleStateSnapshot.test.ts`). Typecheck/build
clean, 91 modules unchanged (not yet wired into `BattleScene`). Not built:
anything past 12.1 — no networking, no `BattleScene` changes. See **D-101**
in `DECISIONS.md`.

## [Unreleased] — 0.2.0-dev — Phase 12: Cooperative Multiplayer Feasibility Design Doc (D-100)

Asked to pick between three open candidates from the Phase 14 handoff
(multiplayer, the Phase 7 balance pass, or more subclasses), Kevin chose to
scope Phase 12. `SOURCE_OF_TRUTH.md` frames Phase 12 itself as a
feasibility question ("determine whether synchronized co-op is worth the
complexity"), so Kevin was asked what this session should produce before
any code — he chose a design doc first, targeting a client-authoritative
state model (Firestore rules only, no Cloud Functions/Blaze billing).

Added:
- **`PHASE_12_MULTIPLAYER_FEASIBILITY.md`** — full feasibility analysis, no
  code. Key findings: Phase 11.4's `controlledBy: "human" | "ai"` field and
  `HeroAISystem` generalize to a third `"remote"` value for co-op
  ownership; Phase 13.1's real dice rolls mean sync must broadcast combat
  RESULTS rather than have every client recompute them; a live battle's
  full state has no existing serialization to reuse (`SaveSystem` only
  covers run-boundary saves). Proposes a four-part sub-phase roadmap
  (12.1-12.4), not started.

Not built: any multiplayer code, Firestore collection, or scene. See
**D-100** in `DECISIONS.md`.

## [Unreleased] — 0.2.0-dev — Phase 14.2: A Second, Original Subclass for Every Class, Plus a Real Choice UI (D-099, with a D-098 correction)

Kevin asked for more subclass options, and specifically whether real D&D
content could be used with attribution first. Verified directly against
the actual SRD 5.1/5.2.1 documents (not assumed): both license exactly ONE
subclass per class — there's no more free D&D subclass content to add,
under either license. That research also caught a real mistake in the
previous Phase 14 chat: Druid's subclass was recorded as Circle of the
Moon, which was never SRD content — corrected to the real one, Circle of
the Land (D-098). With the SRD confirmed exhausted, every class gets a
second, ORIGINAL subclass instead (D-099) — plus the choice UI needed to
actually pick between two options, not just data.

Fixed:
- **Circle of the Moon → Circle of the Land** (Druid's real SRD subclass).
  Natural Recovery is now mechanically active too (spell slots also refill
  on a Short Rest, the same shape as Warlock's Pact Magic) — a genuine
  improvement found while fixing the bug.

Added:
- **A second, original subclass for all twelve classes**: Path of the
  Ironhide (Barbarian), College of the Blade (Bard), Zeal Domain (Cleric),
  Circle of the Ashen Veil (Druid), Battle Tactician (Fighter), Way of the
  Iron Body (Monk), Oath of Retribution (Paladin), Beastbond Warden
  (Ranger), Shadowblade (Rogue), Wildsurge Origin (Sorcerer), Starbound
  Patron (Warlock), Spellblade Tradition (Wizard) — each with exactly one
  real mechanical hookup (a flat to-hit/AC/HP/smite/heal bonus, or a
  one-shot first-hit bonus), reusing only existing systems.
- **A real subclass-choice UI.** `BattleScene.showSubclassConfirm` now
  shows one button per modeled subclass instead of always picking the
  first. `CharacterCreationScene` gains a new Subclass row (a cycle button,
  like Gear's) so a level-1-choice class (Cleric/Sorcerer/Warlock) lets the
  player pick between its two options at creation.
- `CharacterBuildSystem.subclassIdForNewBuild` gains a `subclassIndex`
  parameter (default 0, unchanged behavior for existing callers).

Changed:
- `Hero.draconicResilienceBonus` generalized to `subclassHpPerLevelBonus`,
  now shared by three subclasses (Draconic Bloodline, Way of the Iron Body,
  Starbound Patron) instead of being Draconic-specific.
- `CharacterCreationScene`'s per-hero column grew another 40px taller for
  the new Subclass row; every control below it shifted down 40px to match.
- Tests: 617 → **648** (+31 across `subclasses`/`classLeveling`).

Not done, and why: still two subclasses per class (a third would need more
original design or hit the same "SRD exhausted" wall); every other new
feature per subclass stays honestly inert, each for its own documented
reason. Not yet confirmed by a human in a browser — see KNOWN_ISSUES
KI-061.

## [Unreleased] — 0.2.0-dev — Phase 14: Subclass Roster Expansion — A Modeled Subclass for Every Class (D-097)

With Phase 13 complete and Kevin between playtesting sessions, this chat
picked up the next candidate the 13.11 handoff named that doesn't need a
browser to verify: a real subclass for each of the eight classes Phase 13.8
added with none (Barbarian, Bard, Druid, Monk, Paladin, Ranger, Sorcerer,
Warlock). Same shape as D-076/D-096's "one real, honestly-scored subclass
per class" — pure data plus the choice/confirmation seams 13.11 already
built for exactly this purpose.

Added:
- **A modeled subclass for all eight remaining classes** (`data/
  subclasses.ts`): Path of the Berserker (Barbarian), College of Lore
  (Bard), Circle of the Moon (Druid), Way of the Open Hand (Monk), Oath of
  Devotion (Paladin), Hunter (Ranger), Draconic Bloodline (Sorcerer), The
  Fiend (Warlock). All twelve classes now have exactly one modeled
  subclass.
- **Three more real mechanical hookups**, same bar as Champion/Life Domain:
  - Draconic Bloodline's **Draconic Resilience** — +1 max HP per Sorcerer
    level (`Hero.draconicResilienceBonus`, folded into `effectiveMaxHealth`
    alongside the Tough feat via a shared `flatHpBonusesTotal`).
  - Hunter's **Colossus Slayer** — bonus damage on a hit against the
    Ranger's own Hunter's Mark target (`Hero.colossusSlayerBonus`, extending
    `BattleScene.applyHuntersMarkBonus`).
  - The Fiend's **Dark One's Blessing** — a flat self-heal on a killing blow
    (`Hero.darkOnesBlessingHeal`, new `BattleScene.applyDarkOnesBlessing`).
- Sorcerer/Warlock (both level-1 subclass choices) now auto-assign their
  subclass at creation, same as Cleric; Barbarian/Bard/Monk/Paladin/Ranger
  get the existing in-battle confirmation overlay; Druid's choice lands at
  level 2. All via the unchanged 13.11 machinery — zero changes to the
  choice/confirmation code itself.

Changed:
- `data/classes.ts`: the eight classes' own subclass-choice feature
  descriptions ("No X is modeled yet...") updated to name their new
  subclass and its honestly-inert reasons.
- Tests: 596 → **617** (+21 across expanded `subclasses.test.ts` and new
  `classLeveling.test.ts` cases for the three new hookups; one existing
  `subclassIdForNewBuild` test updated for Sorcerer/Warlock).

Not done, and why: still one subclass per class (real alternatives are a
future slice); every other new feature across the eight subclasses stays
honestly inert (no push/prone, no reaction-based damage reduction beyond
Uncanny Dodge, no creature-stat-block transformation, no Channel-Divinity
resource for a Paladin, etc.) — see `data/subclasses.ts` for each one's
specific reason. Not yet confirmed by a human in a browser — see
KNOWN_ISSUES KI-060.

## [Unreleased] — 0.2.0-dev — Phase 13.11: Character-Creation Flow Overhaul — Real Subclass Choice, Free Starting Gear (D-096)

Eleventh and FINAL sub-phase of Phase 13 — **Phase 13 (Full D&D
Character-System Depth) is now COMPLETE.** Three scoping questions asked
before any code, all answered toward the fuller option: a full subclass-
choice hookup across creation AND leveling (not just Cleric at creation),
wiring up whatever subclass features became newly possible rather than
leaving all four subclasses permanently inert, and a free starting-gear
pick at creation.

Added:
- **Subclass choice is real for the first time.** `CharacterClassDefinition
  .subclassChoiceLevel` (new field, all twelve classes) and
  `CharacterSystem.subclassGrantedAtLevel` (new) make each class's real
  subclass-choice level queryable. A level-1-choice class (Cleric) auto-
  assigns its one modeled subclass at creation
  (`CharacterBuildSystem.subclassIdForNewBuild`); Fighter/Wizard/Rogue get a
  real, queued confirmation overlay in battle the first time
  `Hero.levelUpClass()` reaches their own level (reusing the ASI overlay's
  rendering/queue plumbing — `BattleScene.showSubclassChoiceQueue`).
  `HeroDefinition`/`CharacterBuild`/`Hero` all gain `subclassId?: string`
  (`Hero.grantSubclass`/`.subclassId`).
- **Two subclass features wired up for real**: Champion's Improved Critical
  (level 3+, crits on a natural 19-20)/Superior Critical (level 15+,
  18-20) — `CombatSystem.AttackProfile.critThreshold`, `Hero.critThreshold`,
  applied to a hero's basic Attack only. Life Domain's Disciple of Life
  (level 1+, +2 HP to a healed ally)/Blessed Healer (level 6+, +2 HP to the
  caster too) — `Hero.discipleOfLifeBonus`/`.blessedHealerBonus`, applied in
  `BattleScene.castHealSpellOn`.
- **A free starting-gear pick at creation**: `characterCreation
  .STARTING_GEAR_IDS` (every common/uncommon catalogue item —
  `HeroDefinition`/`CharacterBuild.startingEquipmentId`), applied straight
  into a hero's matching gear slot by `Hero`'s constructor, no gold spent.
  `CharacterCreationScene` gains a new Gear row per hero slot.
- `CharacterCreationScene`'s stats-preview block gains a third line naming a
  level-1-choice class's real subclass, or the level a later-choice class's
  confirmation will appear at (honestly flagged "(not yet built)" for
  classes with no modeled subclass yet).

Changed:
- `data/subclasses.ts`: several stale inert-reasons corrected (e.g. Thief's
  Fast Hands no longer blames "no bonus action," untrue since Phase 13.2).
- `CharacterCreationScene`'s per-hero column grew 40px taller for the new
  Gear row; every control below the slot columns shifted down 50px to
  match (same bounding-box-driven relayout discipline as D-075).
- Tests: 569 → **596** (+27 across `subclasses`/`classLeveling`/`combat`/
  `characterCreationData`/`characterBuildSystem`/`equipment`).

Not done, and why: no new subclass alternatives (still one per class);
the eight classes with no modeled subclass stay unbuilt; Life Domain's
Channel Divinity: Preserve Life stays inert (needs real AoE-ally-heal
targeting, a new system); starting gear is one free item, not a full
weapon/armor/pack package. Not yet confirmed by a human in a browser — see
KNOWN_ISSUES KI-059.

## [Unreleased] — 0.2.0-dev — Phase 13.10: Enemy Roster Expansion — Every Tier, Full Role Tagging, First Real Enemy Mechanic (D-095)

Tenth sub-phase of Phase 13. One scoping question asked before any code: give
at least one new enemy a real special-attack mechanic (not just bigger
stats), or stay flat stat variants like every enemy so far? Kevin chose the
real mechanic, scoped to a save-forcing attack (reusing 13.5's dice/save
infrastructure) rather than a new hero-status-effect system (which an
enemy inflicting Slowed/Stunned/Burning on a HERO would need — out of
scope this round).

Added:
- **Four new enemies**: Marauder (minion, flat glass-cannon stat variant),
  Blightcaller (minion, this roster's first real special attack — forces a
  saving throw instead of a to-hit roll), Gravemaw (a second miniboss),
  Blightmother (a third true boss, sharing Blightcaller's forced-save
  attack at a harder DC).
- **`EnemyDefinition.savingThrowAttackDC`** (new, optional): when set, an
  enemy's attack forces the target to roll a save against this DC instead
  of the normal to-hit-vs-AC roll.
- **`Combatant.savingThrowBonus`** (new, optional, `CombatSystem.ts`) and
  **`Hero.savingThrowBonus`** (new getter): DEX-based real SRD math for a
  D&D-built hero, a flat default for the classic fixed roster.
- **`WaveSystem.resolveSavingThrowAttack`** (new): resolves a save-based
  enemy attack via `SavingThrowSystem`, repackaged into a normal
  `AttackResult` so every existing `BattleScene` render path works
  unchanged.
- **Full role tagging**: every pre-13.10 minion now carries an explicit
  `role: "minion"` (previously implicit).

Fixed:
- **`BattleScene`'s miniboss visual treatment (bigger token, gold outline,
  name banner) only ever checked `role === "miniboss"`** — Cinderlord/
  Tidelord (`role: "boss"`, added in 11.6) had silently never gotten it.
  Both tiers now qualify; the banner distinguishes "(Miniboss)" from
  "(Boss)".
- `FreePlayScene`'s boss-picker row grew from 3 to 5 options; button width
  is now computed instead of a hardcoded 380px, so it no longer risks
  overflowing the canvas.

Changed:
- `FreePlayScene`'s `EXPANDED_MINIONS` gains Marauder/Blightcaller;
  `BOSS_OPTIONS` gains Gravemaw/Blightmother (both always-unlocked — no
  campaign/map exists for them yet).
- Tests: 554 → **569** (+15: new `tests/enemyRoster.test.ts` [8], 3 new
  `combat.test.ts` cases, 4 new `classLeveling.test.ts` cases, 1
  `campaign.test.ts` assertion updated for the new miniboss/boss counts).

Not done, and why: an enemy inflicting a status effect on a hero stays out
of scope (enemy-only status system today). Gravemaw/Blightmother aren't
wired into any campaign's wave list. Not yet confirmed by a human in a
browser — see KNOWN_ISSUES KI-058.

## [Unreleased] — 0.2.0-dev — Phase 13.9: Loot/Equipment Expansion — Rarity, Attunement, Real Procs (D-094)

Ninth sub-phase of Phase 13. Three scoping questions asked before any code,
all answered toward the more ambitious option: a real five-tier rarity
ladder (not a flat catalogue), a real D&D-style attunement cap of 3 items
(not "everything just works"), and all four requested proc kinds built in
this batch (not a subset).

Added:
- **`data/equipment.ts`**: `EquipmentRarity` (`common`/`uncommon`/`rare`/
  `veryRare`/`legendary`, `RARITY_ORDER`/`RARITY_LABELS`), `requiresAttunement`,
  and `EquipmentProc` (a real on-hit/on-kill magic effect: `onHitStatus`,
  `onHitSaveOrDamage`, `onKillHealNearestAlly`, `onHitWhileResistant`) on
  `EquipmentDefinition`. The 12 existing items are retro-tagged common/
  uncommon by their existing, unchanged power level.
- **Five new items**, one per proc kind plus a legendary flat-bonus item:
  Ring of Frostbite (rare, on-hit Slowed), Amulet of Withering (rare,
  save-or-3-bonus-damage), Signet of Kinship (rare, heals nearest ally on a
  kill), Greaves of the Berserker (very rare, +3 damage while Raging/Wild
  Shaped), Aegis of the First Ward (legendary, +4 AC/+2 attack, no proc).
- **`Hero`**: `attunedItemIds` (derived from `equippedItems`, never stored),
  `canAttuneToAnother()`, `wouldExceedAttunementLimit(itemId, slot)`,
  `equippedProcItems()`. `MAX_ATTUNEMENTS = 3`, exported.
- **`BattleScene`**: `equipGearOnHero` now refuses an equip that would
  exceed the attunement cap, before any gold changes hands. New
  `applyEquipmentProcs`/`applyEquipmentProc`, resolving every equipped
  proc against the same `AttackResult` a basic Attack action already
  produced — same shape and scope boundary as Divine Smite/Hunter's Mark
  (D-093): wired into the basic Attack action only.
- Gear grid button labels show a rarity tag above `common`; `CompendiumScene`'s
  equipment tab shows rarity, "requires attunement," and a proc item's full
  description.
- Tests: 544 → **554** (+10, all in `tests/equipment.test.ts`).

Not done, and why: procs stay basic-Attack-only, matching Divine Smite/
Hunter's Mark's existing scope, not ability/spell casts. No item carries
more than one proc. `applyEquipmentProc*` itself has no dedicated unit test
(same as `applyPaladinSmite`/`applyHuntersMarkBonus` before it) — the pure
Hero/system seams underneath are what's tested. Not yet confirmed by a human
in a browser — see KNOWN_ISSUES KI-057.

## [Unreleased] — 0.2.0-dev — Phase 13.8: The Remaining Eight Core SRD Classes (D-093)

Eighth sub-phase of Phase 13. Kevin rejected the earlier "one flashy hook,
everything else inert" pattern outright ("I hated that when it was
implemented. I want it to be much more true to the real DnD classes") and
chose the more ambitious of two scoping options: every one of the eight
remaining classes gets its real, iconic mechanic wired in and playable,
adding small new supporting concepts on `Hero` where genuinely needed. The
four new spellcasters (Bard, Druid, Sorcerer, Warlock) get real
spellcasting wired in now, like Wizard/Cleric. No new subclasses this round
(scope stayed on the eight base classes).

Added:
- **`data/classes.ts`** gains `BARBARIAN`/`BARD`/`DRUID`/`MONK`/`PALADIN`/
  `RANGER`/`SORCERER`/`WARLOCK` — full, accurate level 1-20 feature tables
  (12 classes total). New `HALF_CASTER_SPELL_SLOTS_BY_LEVEL` table for
  Paladin/Ranger (spells start level 2, no cantrips).
- **One real, playable mechanic per class**: Barbarian's Rage (bonus
  action, halves incoming damage + bonus attack damage for a fixed number
  of turns, limited uses per Long Rest); Druid's Wild Shape (from level 2,
  a bonus-action heal + the same damage-resistance buff as Rage); Monk's
  Martial Arts (melee attacks now scale off DEX, not STR) + Ki/Flurry of
  Blows (from level 2, a bonus action that un-consumes the action slot for
  another attack); Paladin's Divine Smite (auto-spends a 1st-level slot on
  a landed melee hit for bonus damage); Ranger's Hunter's Mark (a bonus
  action marking an enemy for bonus damage on subsequent hits); Bard's
  Bardic Inspiration (a bonus action granting an ally a flat attack/damage
  bonus, auto-targeted); Sorcerer's Metamagic: Quickened Spell (a bonus
  action letting the next spell cast consume the bonus action instead of
  the main action); Warlock's Pact Magic (spell slots restore on a SHORT
  Rest, not just Long — the SRD's real distinctive cadence).
- New `Hero` state/methods: `rageUsesRemaining`/`isRaging`/`canUseRage`/
  `useRage`; `wildShapeUsesRemaining`/`canUseWildShape`/`useWildShape`;
  `hasDamageResistance` (shared getter for Rage/Wild Shape);
  `kiPointsRemaining`/`canUseFlurryOfBlows`/`useFlurryOfBlows`;
  `bardicInspirationUsesRemaining`/`canUseBardicInspiration`/
  `useBardicInspiration`/`receiveInspiration`/`pendingInspirationBonus`/
  `clearInspiration`; `sorceryPointsRemaining`/`canUseQuickenSpell`/
  `useQuickenSpell`/`markActedForSpellCast`; `markedEnemyId`/
  `canUseHuntersMark`/`useHuntersMark`.
- New `data/abilities.ts`/`data/spells.ts` entries: `vicious-mockery` (Bard
  cantrip), `healing-word` (Bard 1st-level, second ally-targeted heal),
  `produce-flame` (Druid cantrip), `eldritch-blast` (Warlock cantrip).
  Druid/Sorcerer/Warlock's other spells reuse Cure Wounds/Fire Bolt/Magic
  Missile verbatim (shared SRD spell lists).
- `data/characterCreation.ts`: `CREATABLE_CLASS_IDS` grows to all twelve
  classes; Barbarian/Monk/Paladin/Ranger share the existing
  `SIGNATURE_ABILITY_IDS` list; Bard/Druid/Sorcerer/Warlock get their own
  cantrip lists and join `knownSpellIdsForClass`.
- `CharacterSystem.combatStatsForClassLevel`: a Monk's melee attacks now use
  Dexterity instead of Strength (Martial Arts).
- `BattleScene.isCasterHero` changed its check from "has `spellcasting`
  data" to "has a non-empty known-spell list" — needed so Paladin/Ranger's
  real half-caster slot economy (powering Divine Smite/Hunter's Mark)
  doesn't open an empty spellbook in place of their fixed ability.
- New `applyDamageResistanceBuffs`/`applyPaladinSmite`/
  `applyHuntersMarkBonus`/`nearestOtherLivingAlly` in `BattleScene`, plus
  extended `showBonusActionButtonFor`/`onBonusActionButton` for all eight
  new class-gated bonus-action mechanics.
- New test file `tests/newCoreClasses.test.ts`; updated
  `tests/characterCreationData.test.ts`/`tests/characterSystem.test.ts`/
  `tests/spells.test.ts` for the expanded class/spell rosters.

Tests: 514 → **544** (+30). Typecheck/build clean (91 modules, unchanged).
`npm run dev` serves HTTP 200. Not yet confirmed by a human in a browser —
see KNOWN_ISSUES **KI-056**.

## [Unreleased] — 0.2.0-dev — Phase 13.7: Real Spell Depth — Spellbook, Spell Slots, Ally Healing (D-092)

Seventh sub-phase of Phase 13. Kevin rejected the "one fixed signature
action" pattern outright: a caster should be able to choose ANY known
spell as their action, via a real spellbook — not just the single ability
picked at character creation. Upcasting was named as a real future goal but
explicitly not required this chat. Two further questions asked directly:
build ally-targeting for Cure Wounds too (not just Magic Missile), and
build Concentration as framework-only (nothing has an ongoing duration
effect to protect yet) — Kevin chose yes to both.

Added:
- `AbilityDefinition` gains `spellSlotLevel?`/`targetsAlly?`/`healAmount?`.
- Two new leveled-spell abilities: `magic-missile` (Wizard, autoHit, costs
  a 1st-level slot) and `cure-wounds` (Cleric, ally-targeted heal, costs a
  1st-level slot) — this game's first ally-targeted effect of any kind.
  `data/spells.ts` wires both spells' `abilityId` (previously data-only).
- `data/characterCreation.ts`'s new `knownSpellIdsForClass` — every
  mechanically-active spell a class knows (every cantrip, not just the
  signature action chosen at creation, plus every castable leveled spell).
- `Hero.spellSlotsRemaining`/`knownSpellAbilityIds()`/`canCastSpell()`/
  `spendSpellSlot()`/`spellSlotsRemainingAt()` — a real spell-slot economy,
  restored ONLY by a Long Rest (a Short Rest doesn't refill it, the SRD's
  real cadence).
- **Bug fixed**: `SpellcastingSystem.spellSlotsForClassAtLevel` returned a
  live reference into the shared class-data table instead of a copy —
  every Wizard/Cleric would have silently shared and depleted the SAME
  slots array. Caught by the new test suite; fixed to return a fresh array.
- New `BattleScene` spellbook UI: two new `Interaction` kinds
  (`choosingSpell`/`aimingSpell`); a caster's "Ability (Q)" button now opens
  a spellbook overlay instead of casting one fixed ability — a non-caster
  is completely unaffected. `castAbilityOn`/`castSavingThrowAbilityOn`
  gained an explicit `ability` parameter so the spellbook reuses the exact
  same enemy-targeting resolvers. New `castHealSpellOn` (this game's first
  ally-targeted resolver) and `livingAlliesInRange` (self-inclusive
  targeting, unlike `CombatSystem.targetsInRange`).
- New `systems/ConcentrationSystem.ts` (framework-only): `concentrationSaveDC`/
  `checkConcentration` — built and tested, genuinely uncalled outside its
  own tests, same treatment as `InitiativeSystem` (D-090).
- New test files: `tests/concentrationSystem.test.ts` (7),
  `tests/spellSlots.test.ts` (12); updated `tests/spells.test.ts` for the
  two now-castable leveled spells.

Tests: 492 → **514** (+22). Typecheck/build clean (91 modules, up from 90 —
the new `ConcentrationSystem.ts`). `npm run dev` serves HTTP 200. Not yet
confirmed by a human in a browser — see KNOWN_ISSUES **KI-055**.

## [Unreleased] — 0.2.0-dev — Phase 13.6: Real Ability-Score-Improvement-or-Feat Choice (D-091)

Sixth sub-phase of Phase 13. 13.3 (D-089) gave a D&D-built hero a real class
level to reach an ASI at; this chat wires the choice itself in. Two
questions asked directly: (1) should the ASI split follow the full 5e rule
(+2 one ability, or +1 two) or a simpler always-+2-one-ability cut — Kevin
chose the full rule; (2) Lucky's "inert, diceless combat" justification had
gone stale since 13.1 added real dice — Kevin chose to give it a real
hookup (Advantage on this hero's basic attacks, a 3-point pool recharging
only on a Long Rest) rather than leave all three non-Tough feats inert.

Added:
- `CharacterSystem.asiFeatureGrantedAtLevel(classDef, level)` — detects an
  ASI-granting level generically across all four class tables (Fighter's
  two bonus ASIs at 6/14 included).
- Every "Ability Score Improvement" feature entry across Fighter/Wizard/
  Rogue/Cleric (23 total) flips from `mechanicallyActive: false` to `true`.
- `Hero.improveAbilityScore(ability, amount)` — raises one ability score in
  place (capped at 20), recomputing derived combat numbers via the same
  formula `levelUpClass` uses (new shared private `applyLeveledStats`).
- `Hero.grantFeat(featId)`/`featIds` — records a chosen feat; Tough's HP
  bonus now folds into `effectiveMaxHealth`, scaling with class level.
- `Hero.canUseLucky()`/`spendLuckyPoint()`/`luckyPointsAvailable` — Lucky's
  reroll pool, recharged by `longRest()` only (not a Short Rest).
- `data/feats.ts`: Lucky flips to `mechanicallyActive: true` with a new
  `luckyPoints: 3` field.
- `BattleScene`: a new per-hero ASI-or-feat overlay (`showAsiChoiceQueue`,
  queued after any wave-clear level-up, before the Rest choice) — path
  choice (raise scores / take a feat), mode choice (+2 one / +1 two), an
  ability-score picker, and a feat picker, all rendered by one shared
  `renderAsiPrompt` helper. `tryBasicAttack` auto-spends a Lucky point
  (Advantage) whenever one is available.
- New test cases: `asiFeatureGrantedAtLevel` (`tests/characterSystem.test.ts`),
  `Hero.improveAbilityScore`/`grantFeat`/Lucky (`tests/classLeveling.test.ts`).

Tests: 475 → **492** (+17). Typecheck/build clean (90 modules, unchanged).
`npm run dev` serves HTTP 200. Not yet confirmed by a human in a browser —
see KNOWN_ISSUES **KI-054**.

## [Unreleased] — 0.2.0-dev — Phase 13.5: Saving Throws, Skills, and a Framework-Only InitiativeSystem (D-090)

Fifth sub-phase of Phase 13. D-086 already decided `InitiativeSystem` should
be framework-only (built, tested, not wired into `TurnSystem`); the one
question this chat asked was whether saving throws should stay pure math too,
or get a real hookup. Kevin chose a real hookup: the Cleric's Sacred Flame
cantrip now rolls an actual saving throw instead of always hitting.

Added:
- `CharacterSystem.savingThrowBonus`/`spellSaveDC` — the SRD saving-throw
  and spell-save-DC formulas.
- `systems/SavingThrowSystem.ts` (new) — `rollSave`/`applySaveOrDamage`,
  mirroring `CombatSystem`'s dice-resolution shape (nat 20 always succeeds,
  nat 1 always fails).
- `systems/InitiativeSystem.ts` (new) — `rollInitiative(candidates, random)`,
  entity-agnostic and genuinely unused outside its own tests, per Kevin's
  explicit "framework only" scope.
- `data/skills.ts` (new) — a slim 8-skill reference list (Athletics,
  Acrobatics, Stealth, Investigation, Perception, Insight, Persuasion,
  Intimidation), plus a `skillModifier` helper (no proficiency concept yet —
  nothing calls a skill check).
- `EnemyDefinition`/`Enemy` gain a flat `savingThrowBonus` (mirrors
  `attackBonus`). `Hero.spellSaveDC` (new getter, null off the classic
  roster or a non-caster class).
- `AbilityDefinition` gains `savingThrow?: { ability }`; Sacred Flame
  converted from `autoHit` to a real DEX saving throw.
- `BattleScene.castAbilityOn` branches to a new `castSavingThrowAbilityOn`
  for a `savingThrow`-tagged ability.
- New Compendium "Skills" tab (reference-only).
- `tests/savingThrowSystem.test.ts` (new, 8), `tests/initiativeSystem.test.ts`
  (new, 3), `tests/skills.test.ts` (new, 6), plus new cases in
  `tests/characterSystem.test.ts` and `tests/classLeveling.test.ts`.

Tests: 448 → **475** (+27). Typecheck/build clean (90 modules, up from 88 —
the two new system files). `npm run dev` serves HTTP 200. Not yet confirmed
by a human in a browser — see KNOWN_ISSUES **KI-053**.

## [Unreleased] — 0.2.0-dev — Phase 13.3: Real Per-Class Leveling + Extra Attack (D-089)

Third sub-phase of Phase 13, built after 13.4 (Kevin's own ordering call —
see the 13.4 handoff). Replaces the flat wave-based Vigor/Might choice with
real D&D leveling, but ONLY for a D&D-built party (`classId` set); the
classic fixed roster keeps Vigor/Might unchanged, since it has no ability
scores/class table to level from — the two never mix in one battle. Kevin
also asked for Fighter's Extra Attack to actually fire this chat, not stay a
named future gap.

Added:
- `CharacterSystem.combatStatsForClassLevel(classId, level, abilityScores,
  abilityId)` (new) — the class-level-dependent combat math
  (`maxHealth`/`attackDamage`/`attackBonus`/`attacksPerAction`), factored out
  of `CharacterBuildSystem.heroDefinitionFromBuild` (which used it for level
  1 only) so `Hero.levelUpClass()` can reuse the identical formula at any
  later level. `attackStyleForAbility` moved here too, for the same reason;
  re-exported from `CharacterBuildSystem` unchanged for existing callers.
- `HeroDefinition`/`Hero` gain `abilityScores?: AbilityScores` — carried from
  a `CharacterBuild` so a level-up can redo the math above. Absent for the
  classic fixed roster.
- `Hero.level` (starts at 1), `Hero.attacksPerAction` (starts at 1), and
  `Hero.levelUpClass()` — advances one class level and replaces
  `maxHealth`/`attackDamage`/`attackBonus`/`attacksPerAction` outright (not
  additive, unlike Vigor/Might's bonus fields); HP gained is added to CURRENT
  health immediately (the SRD rule), not a full heal. A no-op for a hero
  with no `classId`/`abilityScores`, or already at the level cap (20).
- `ProgressionSystem.acknowledgeLevelUp()` — marks a wave-clear threshold
  granted without applying Vigor/Might, for the classId-party branch.
- `BattleScene.afterWaveCleared` branches on `isClassBasedParty()`: a
  classId party auto-levels every living hero (`applyClassLevelUps`, logged,
  no overlay — there's no choice to make, ASI is still 13.6) instead of
  showing the Vigor/Might picker. The status-text HUD line now shows
  "Lv `<N>`" after a classId hero's name.
- `BattleScene.tryBasicAttack` now resolves `hero.attacksPerAction`
  independent attacks against the same clicked target (Fighter's Extra
  Attack, real at levels 5/11/20 — 2/3/4 attacks) — each one logged
  separately; stops early if an earlier swing defeats the target.
- `tests/classLeveling.test.ts` (new, 8 tests), plus new cases in
  `tests/characterSystem.test.ts` (`combatStatsForClassLevel`) and
  `tests/characterBuildSystem.test.ts` (`abilityScores` passthrough).

Tests: 434 → **448** (+14). Typecheck/build clean (88 modules, unchanged).
`npm run dev` serves HTTP 200. Not yet confirmed by a human in a browser —
see KNOWN_ISSUES **KI-052**.

## [Unreleased] — 0.2.0-dev — Phase 13.4: Rest System (D-088)

Fourth sub-phase of Phase 13 (13.3 deliberately deferred — Kevin chose to do
13.4 first, to replace 13.2's "once per battle" placeholder before more gets
built on it). Adds a real per-run Short/Long Rest charge pool.

Added:
- `src/game/systems/RestSystem.ts` (new) — a per-run pool of Short/Long Rest
  charges (`shortRestsRemaining`/`longRestsRemaining`,
  `canTakeShortRest`/`canTakeLongRest`, `takeShortRest`/`takeLongRest`).
- `Hero.shortRest()` — recharges Second Wind/Action Surge and heals a flat
  25% of `effectiveMaxHealth` (a stand-in for spending a Hit Die, which this
  game doesn't track). `Hero.longRest()` — the same recharge, plus a full
  heal.
- `difficulty.ts`: each tier gains `shortRestCharges`/`longRestCharges`
  (Easy 4/2, Normal 3/1, Hard 2/1, Nightmare 1/0 — first-pass/untuned).
- `BattleScene`: a new opt-in "Rest before the next wave?" overlay (Short
  Rest/Long Rest/Continue), chained into `afterWaveCleared` after any
  pending level-up choice. Skipped entirely when no charge remains, and
  after the final wave clears.
- `tests/restSystem.test.ts` (new, 10 tests) and 3 new `difficulty.test.ts`
  cases for the new charge fields.

Changed:
- `classes.ts`: Second Wind/Action Surge descriptions updated — they now
  recharge on a real rest, not a once-per-battle placeholder.
- `Hero`'s `secondWindUsed`/`actionSurgeUsed` are no longer cleared by
  anything except `shortRest`/`longRest`.

Tests: 421 → **434** (+13). Typecheck/build clean (88 modules, up from 87).
`npm run dev` serves HTTP 200. Not yet confirmed by a human in a browser —
see KNOWN_ISSUES **KI-051**.

## [Unreleased] — 0.2.0-dev — Phase 13.2: Action Economy, first slice (D-087)

Second sub-phase of Phase 13. Adds a bonus-action slot to `Hero` and wires
four class-gated features already recorded (inert) in `classes.ts`: Second
Wind + Action Surge (Fighter), Cunning Action's Dash + Uncanny Dodge (Rogue).

Added:
- `HeroDefinition`/`Hero` gain `classId?: string` — a minimal, additive seam
  (not the full race/class/level identity that's 13.3's job) so these
  features know which hero qualifies. Set by
  `CharacterBuildSystem.heroDefinitionFromBuild`; absent for the classic
  fixed roster and for Wizard/Cleric builds.
- `Hero`: a bonus-action slot (`bonusActed`) alongside the existing
  `moved`/`acted`, plus `reactionAvailable` (Uncanny Dodge) and two
  once-per-battle flags (`secondWindUsed`/`actionSurgeUsed` — a placeholder
  cadence, see D-087). New API: `canUseBonusAction`, `canUseSecondWind`/
  `useSecondWind`, `canUseActionSurge`/`useActionSurge`,
  `canUseCunningAction`/`useCunningActionDash`, `canUseUncannyDodge`/
  `useUncannyDodge`.
- `BattleScene`: a new "Bonus Action" button (Second Wind or Cunning
  Action — whichever the selected hero's class grants) and a new "Action
  Surge" button, both new keybinds (R/F), gated the same way Ability/Potion
  already are. `applyUncannyDodges` auto-halves the first hit a Rogue with
  Uncanny Dodge available takes each enemy phase, rewriting the
  `AttackResult` in place before the combat log/HP text render.
- `tests/actionEconomy.test.ts` (new, 21 tests) — pure `Hero`-level coverage
  of all four features plus the bonus-action slot itself. Two new
  `characterBuildSystem.test.ts` cases for `classId` passthrough.

Changed:
- `classes.ts`: Second Wind, Action Surge, Cunning Action, and Uncanny Dodge
  flip from `mechanicallyActive: false` to `true`; descriptions rewritten.
- Two `characterSystem.test.ts` assertions updated to match.

Tests: 398 → **421** (+23). Typecheck/build clean (87 modules, unchanged).
`npm run dev` serves HTTP 200. Not yet confirmed by a human in a browser —
see KNOWN_ISSUES **KI-050**.

## [Unreleased] — 0.2.0-dev — Phase 13.1: Dice Core + Armor Class (D-086)

First sub-phase of Phase 13 (Full D&D Character-System Depth) — the arc that
follows Phase 11's now-complete roadmap. Reverses D-030 (deterministic
combat) and gives D-036's deferred `RandomService` its first real consumer.

Added:
- `src/game/systems/RandomService.ts` (new) — a seedable mulberry32 PRNG
  (`RandomService.seeded(seed?)`) plus `RandomService.fixed(value = 15)`, a
  deterministic test double.
- `CombatSystem`: `Combatant.armorClass?` replaces `defense?`; `AttackProfile`
  gains `attackBonus` (required) and `autoHit`/`advantage` (optional);
  `rollAttack` resolves a d20 roll (crit on natural 20, fumble on natural 1);
  `applyAttack`/`attackSingle`/`attackArea` now take an explicit
  `RandomService`.
- `HeroDefinition`/`EnemyDefinition` gain `attackBonus` and
  `baseArmorClass`/`armorClass`. `Hero.armorClass`/`Enemy.armorClass` replace
  `.defense`. `CharacterBuildSystem.heroDefinitionFromBuild` computes a real
  `attackBonus` (proficiency + ability modifier) and `baseArmorClass`
  (10 + Dex modifier) for a D&D-built hero.
- `tests/randomService.test.ts` (new, 7 tests) and a rewritten
  `tests/combat.test.ts` dice-resolution suite.

Changed:
- Every enemy's `defense` value converted to `armorClass` (`10 + old value`);
  every equipment item's `defense` bonus renamed `armorClass` (value
  unchanged — it was already a bonus, not a base). All first-pass/untuned.
- Traps, terrain hazards, and the burning status tick always `autoHit` now
  (no roll) — D-039's "always triggers" behavior is unchanged; the old
  per-trap `ignoreDefense` variation is gone since it's now moot.
- `abilities.ts`'s Piercing Shot/Sacred Flame: `ignoreDefense` renamed
  `autoHit`, same "always lands" effect as before.
- `BattleScene` combat log now distinguishes miss/hit/critical-hit/defeat;
  a miss no longer flashes the hit effect or applies an ability's status
  effect.

Tests: 391 → **398** (+7). Typecheck/build clean (87 modules, up from 86).
`npm run dev` serves HTTP 200. Not yet confirmed by a human in a browser —
see KNOWN_ISSUES **KI-049**.

## [Unreleased] — 0.2.0-dev — Phase 11.10: Map Builder + Public Map Sharing (D-085)

Closes out the Phase 11 roadmap (D-071: 11.1 through 11.10 all now built).

Added:
- `src/game/systems/MapBuilderSystem.ts` — pure map-authoring rules:
  `createBlankDraft`, `paintTile` (terrain vs. marker painting, mutually
  exclusive per tile), `validateDraft` (dimension bounds, spawn/exit/
  hero-start counts, and a real every-spawn-reaches-an-exit check reusing
  `PathfindingSystem.hasRoute`). Dimension caps (`MIN/MAX_MAP_COLS` 6-20,
  `MIN/MAX_MAP_ROWS` 6-9) are verified against `BattleScene`'s actual
  fixed-`TILE_SIZE`/HUD bounding boxes, not assumed.
- `src/game/data/testMap.ts` — new `encodeMapRows`, the exact inverse of
  the existing `parseMapRows`.
- `src/game/systems/MapSharingSystem.ts` — `SharedMapRecord` (the
  Firestore document shape, storing row-strings via `tileRows` rather
  than a nested tile array) and `toSharedMapRecord`/`fromSharedMapRecord`/
  `hasReachedPublishLimit` (`MAX_PUBLISHED_MAPS_PER_AUTHOR = 5`,
  client-side only).
- `src/game/cloud/MapSharingSync.ts` (new) — `pushMap`/
  `deleteMapFromCloud`/`listSharedMaps` (cursor-paginated)/
  `listMapsByAuthor`, inert with no Firebase project configured, same
  discipline as `CloudSaveSync.ts`.
- `firestore.rules` — new `sharedMaps/{mapId}` block: public read,
  author-only create/update/delete, no ownership-transfer path, shape/
  size validation matching the existing `isValidSaveSlot` style.
- `firestore-tests/rules.test.ts` — new `sharedMaps` test cases (public
  read, author-only write, no ownership transfer, shape/bounds
  rejection) — written but not run this session, same standing JDK 21+
  constraint as Phase 10.
- `src/game/scenes/MapBuilderScene.ts` (new) — paint a map via a
  Terrain/Markers palette tab strip, live validation, Playtest (routes
  through `CharacterCreationScene`'s new `customMapData` field) and
  Publish (hidden without a configured Firebase project).
- `src/game/scenes/BrowseSharedMapsScene.ts` (new) — a fetched, paginated
  list of published maps feeding the same wave-count/minion-source/
  difficulty pickers `FreePlayScene` already has.
- `src/game/scenes/BattleScene.ts`/`CharacterCreationScene.ts` — new
  optional `customMapData?: ParsedMap` passthrough field, checked last in
  `BattleScene`'s map-resolution chokepoint, so a drafted or fetched map
  can be played without going through the by-id `data/maps.ts` registry.
- `src/game/scenes/MainMenuScene.ts` — new "Map Builder" (always shown)
  and "Browse Shared Maps" (Firebase-only) buttons, top-right corner.
- 15 new tests: `tests/mapBuilder.test.ts` (12) + `tests/mapSharing.test.ts`
  (3). **385 tests total** (was 370). Typecheck and build (86 modules)
  clean, verified both with the real `.env` present and with it
  temporarily removed (proves the local-first fallback holds for this
  feature too).

## [Unreleased] — 0.2.0-dev — Phase 10: Firebase Hosting, Auth, Cloud Saves (D-084) — DEPLOYED

Deployed (2026-07-30): Kevin completed the Firebase console setup
(project `dice-n-defenses`, Anonymous + Google sign-in, Firestore),
filled in `.env`/`.firebaserc`, and ran `firebase login`. `npm run build`
+ `firebase deploy --only hosting,firestore:rules` both succeeded — the
game is live at **https://dice-n-defenses.web.app**. The Firestore rules
test suite (`npm run test:rules`) is still unrun — the emulator needs a
JDK 21+, and installing one via `winget` was offered and declined (IT
policy on Kevin's machine) — see KNOWN_ISSUES KI-047.


Added:
- `src/game/cloud/firebaseApp.ts`, `AuthClient.ts`, `CloudSaveSync.ts`
  (new folder) — Firebase init (inert unless every `VITE_FIREBASE_*` env
  var is set), anonymous-by-default auth with an optional Google
  sign-in upgrade (account linking), and a Firestore adapter
  (`users/{uid}/saves/{slotId}`, last-write-wins merge on `updatedAt`).
- `src/game/systems/SaveSystem.ts` — new `upsertSaveSlot` (insert-or-replace
  a slot wholesale, preserving its own timestamps — needed for the cloud
  merge above).
- `src/game/scenes/MainMenuScene.ts` — new Account control (top-left,
  under Load Game): sign in with Google / signed-in status + sign out.
- `src/game/scenes/LoadGameScene.ts` — new "Sync with Cloud" button;
  deleting a slot now also mirrors the delete to the cloud when signed in.
- `src/game/scenes/CharacterCreationScene.ts` — saving/updating a party
  now also pushes the slot to the cloud when signed in with Google.
- `firestore.rules` (new) — owner-scoped save slots with shape/size
  validation (the budget safeguard: exact field sets, string/array size
  caps, enum checks).
- `firestore-tests/rules.test.ts` + its own `vitest.config.ts` (new,
  separate from `tests/`) — emulator-backed rules coverage; run via
  `npm run test:rules` (requires a JDK 21+, not yet run this session —
  this environment only has Java 8).
- `firebase.json`, `.firebaserc`, `.env.example` (new) — Hosting/Firestore
  config and the required client env vars (`.env` itself gitignored).
- `FIREBASE_SETUP.md` (new) — the setup checklist for the parts only Kevin
  can do (create the Firebase project, enable services, log into the CLI)
  before a real deploy can happen.
- `vite.config.ts`/`KNOWN_ISSUES.md` KI-005 — bundle-size warning limit
  raised (2000 -> 2500 kB) after the Firebase SDK's size increase;
  code-splitting reconsidered and deliberately not done (see D-084).
- 2 new `upsertSaveSlot` cases in `tests/saveSystem.test.ts`. **370 tests
  total** (was 368). Typecheck and build (81 modules) clean, verified with
  NO `.env` present (proves the local-first fallback holds).

See **D-084** in `DECISIONS.md` for full reasoning, including the explicit
scope boundary (cloud sync covers only save slots, not Bestiary/Campaign
progress) and what's still blocked on Kevin's own Firebase console setup.
Not yet confirmed by a human, and not yet deployed — see KNOWN_ISSUES
**KI-047**.

## [Unreleased] — 0.2.0-dev — Phase 9: local save system (D-083)

Added:
- `src/game/systems/SaveSystem.ts` (new) — pure, versioned, localStorage-backed
  named party-build slots: `SaveFile { version, slots }`, `createSaveSlot`/
  `updateSaveSlot`/`deleteSaveSlot`/`getSaveSlot`/`loadSaveFile`/`saveSaveFile`.
  Corrupt JSON, a version mismatch, or an individually malformed slot all
  fail safe to an empty default rather than crashing. `MAX_SAVE_SLOTS = 6`.
- `src/game/systems/CharacterBuildSystem.ts` — new `allocatorFromScores`,
  the inverse of `StandardArrayAllocator.scores()`, needed to seed an
  allocator from a saved build.
- `src/game/scenes/LoadGameScene.ts` (new), reached via a new top-left
  MainMenuScene "Load Game" button — lists every save slot as a card
  (name, party summary, size, difficulty) with Load/Delete buttons.
- `src/game/scenes/CharacterCreationScene.ts` — optional `loadedSlotId`/
  `loadedParty` init passthrough pre-fills every slot from a save; a new
  "Save Party" button (beside Start Battle) creates or updates a slot;
  Start Battle silently re-saves an already-loaded/saved slot before
  starting a battle.
- `src/game/config.ts` — new `SAVE_STORAGE_KEY`.
- `tests/saveSystem.test.ts` (new, 11 tests) + 3 new `allocatorFromScores`
  cases in `tests/characterBuildSystem.test.ts`. **368 tests total** (was
  354). Typecheck and build (61 modules) clean.

See **D-083** in `DECISIONS.md` for the full scope reasoning, including the
explicit boundary: a loaded save feeds the plain party-builder flow only,
not yet Campaign/Free-Play's own routes into it (deferred). New UI/
gameplay-feel — not yet confirmed by a human, see KNOWN_ISSUES **KI-046**.

## [Unreleased] — 0.2.0-dev — Phase 11.9: Free Play mode (D-082)

Added, per the Phase 11 roadmap (D-071):
- `src/game/systems/FreePlayWaveGenerator.ts` (new) — pure, deterministic
  `generateFreePlayWaves({ waveCount, minionPool, bossEnemyId })`; no
  `Math.random`/`Date.now`, consistent with this game's diceless combat.
- `src/game/data/maps.ts` (new) — general-purpose `MAPS`/`getMapById(id)`
  registry covering `TEST_MAP`/`EMBERFORD_MAP`/`SALTMERE_MAP`.
- `src/game/scenes/FreePlayScene.ts` (new), reached via a new MainMenuScene
  "Free Play" button — pickers for map (3, gated), boss (3, gated), wave
  count (Short 4 / Medium 7 / Long 10 presets), minion source
  (Standard/Expanded), and difficulty; "Start" generates waves and hands
  off to `CharacterCreationScene`.
- `src/game/scenes/BattleScene.ts` — `init()` gained optional
  `freePlayMapId`/`freePlayWaves`, resolved only when `campaignId` is
  unset; falls back to `TEST_MAP`/`WAVES` when neither is set. Free-play
  victories are never persisted to `CampaignProgressSystem`.
- Unlock gating: `TEST_MAP`/`basalt-colossus` always available;
  `EMBERFORD_MAP`/`cinderlord` and `SALTMERE_MAP`/`tidelord` unlock once
  their respective campaign (11.8) has been completed once.
- `tests/freePlayWaveGenerator.test.ts` (new, 7 tests). **354 tests total**
  (was 347). Typecheck and build (59 modules) clean.

See **D-082** in `DECISIONS.md`. This closes out the 11.6-11.9 batch done
this session; only 11.10 (map builder, blocked on Phase 10/Firebase) is
left on D-071's roadmap. New UI/gameplay-feel — not yet confirmed by a
human, see KNOWN_ISSUES **KI-045**.

## [Unreleased] — 0.2.0-dev — Phase 11.8: boss-themed campaigns (D-080)

Added, per the Phase 11 roadmap (D-071):
- `src/game/data/campaigns.ts` (new) — `CampaignDefinition`/`CAMPAIGNS`/
  `getCampaignDefinition`/`getCampaignMap`. Two campaigns, each a scoped
  6 waves: **Emberford Reach** (fire/acid/cliff, finale boss Cinderlord)
  and **Saltmere Shallows** (water/cliff, finale boss Tidelord).
- `src/game/systems/CampaignProgressSystem.ts` (new) — localStorage-backed
  per-campaign completion tracking, mirroring `BestiarySystem`'s pattern;
  `CAMPAIGN_PROGRESS_STORAGE_KEY` added to `config.ts`.
- `src/game/scenes/CampaignSelectScene.ts` (new), reached via a new
  MainMenuScene "Campaigns" button — lists both campaigns with a
  completed/not-completed tag, hands off to `CharacterCreationScene` with
  a chosen `campaignId`.
- `src/game/scenes/BattleScene.ts` — `init()` gained optional
  `campaignId?: string`; when set, `create()` resolves that campaign's own
  map/wave-list instead of `TEST_MAP`/`WAVES`; the victory hook marks that
  campaign completed. Omitted (classic START, plain Create Party)
  reproduces prior behavior byte-for-byte.
- `src/game/data/emberfordMap.ts`/`saltmereMap.ts` (11.7) each gained four
  `H` hero-start tiles — missing until this chat exposed the gap by
  actually wiring both maps into a playable battle.
- `tests/campaigns.test.ts` (new, 10 tests), `tests/campaignProgress.test.ts`
  (new, 8 tests), `tests/newMaps.test.ts` (+2). **347 tests total** (was
  327). Typecheck and build (56 modules) clean.

See **D-080** in `DECISIONS.md`. New UI/gameplay-feel — not yet confirmed
by a human, see KNOWN_ISSUES **KI-044**.

## [Unreleased] — 0.2.0-dev — Phase 11.7: map overhaul — terrain, shop/treasure tiles, proximity gating (D-081)

Added, per the Phase 11 roadmap (D-071):
- `src/game/data/testMap.ts`/`systems/GameMap.ts` — `TileType` gained
  `"cliff"`/`"water"`/`"fire"`/`"acid"`; `ParsedMap` gained `shops`/
  `treasures` role arrays; new `GameMap.terrainEffectAt(pos)`. Cliff is
  ground-impassable/flyable with zero pathfinding changes; water/fire/acid
  are walkable but apply the existing "slowed"/"burning" statuses (or flat
  acid damage) to enemies only, via the same trap-callback contract
  `WaveSystem` already exposed.
- `src/game/data/emberfordMap.ts`/`saltmereMap.ts` (new) — two maps
  showcasing the new terrain plus a shop tile and a treasure tile each; not
  wired into any scene yet (11.8's job). `TEST_MAP` itself is untouched.
- `src/game/systems/BuildSystem.ts` — new `BUILD_RANGE_TILES` (3) proximity
  gate on `canPlace`/`place` (a structure needs a living hero within 3
  tiles — omitted parameter keeps the old "build anywhere" behavior for
  backward compatibility) and `MAX_STRUCTURES_PER_HERO` (3) carry limit,
  auto-attributed to the nearest hero at placement time.
- `src/game/scenes/BattleScene.ts` — the Gear/shop HUD is now locked unless
  a hero stands on/next to a `"shop"`-role tile (maps with no shop tile,
  i.e. `TEST_MAP`, stay ungated); walking onto a `"treasure"`-role tile
  grants a one-time gold bonus.
- `tests/terrain.test.ts` (new, 13), `tests/newMaps.test.ts` (new, 10),
  `tests/building.test.ts` (+8). **327 tests total** (was 296). Typecheck
  and build (51 modules) clean.

See **D-081** in `DECISIONS.md`. New UI/gameplay-feel — not yet confirmed
by a human, see KNOWN_ISSUES **KI-043**.

## [Unreleased] — 0.2.0-dev — Phase 11.6: enemy roster expansion + Bestiary (D-079)

Added, per the Phase 11 roadmap (D-071):
- `src/game/data/enemies.ts` — `EnemyRole` gained a `"boss"` tier above
  `"miniboss"`. Two new minions, **Hexer** (range-3) and **Ravager**
  (fastest mover), and two new true bosses, **Cinderlord** (fire-themed)
  and **Tidelord** (water-themed) — neither wired into any wave yet. New
  optional `loreText?` field, added to both new bosses plus (as a bonus)
  the existing miniboss Basalt Colossus.
- `src/game/systems/BestiarySystem.ts` (new) — localStorage-backed
  per-enemy SEEN/KILLED tracking, mirroring `SettingsSystem`'s pattern;
  `BESTIARY_STORAGE_KEY` added to `config.ts`.
- `src/game/scenes/BestiaryScene.ts` (new), reached via a new
  MainMenuScene "Bestiary" button — unseen enemies render as locked "???"
  entries; seen ones show full stats/lore, with a "[Defeated]" tag once
  killed. Grouped by role.
- `src/game/scenes/BattleScene.ts` — enemy spawn marks SEEN, enemy defeat
  marks KILLED; both write to localStorage only on actual change.
- `tests/bestiary.test.ts` (new, 11 tests); `tests/campaign.test.ts` fixed
  a latent roster-counting bug (`role !== "miniboss"` would have
  miscounted the new `"boss"` role as a minion). **296 tests total** (was
  283). Typecheck and build (50 modules) clean.

See **D-079** in `DECISIONS.md`. New UI/gameplay-feel — not yet confirmed
by a human, see KNOWN_ISSUES **KI-042**.

## [Unreleased] — 0.2.0-dev — Phase 11.5: multi-slot equipment, potions, and a Compendium (D-078)

Added, per the Phase 11 roadmap (D-071):
- `src/game/data/equipment.ts` (rewritten) — seven gear-slot instances
  (`head`/`chest`/`legs`/`ring1`/`ring2`/`amulet`/`footwear`) across six slot
  types (`ring` fits either ring instance). Catalogue grew from 3 items to
  12 (two per slot type); every item still grants only flat
  `attackDamage`/`defense`. Three Phase 7 items carry over with identical
  stats/costs, reslotted (Whetstone Blade renamed Whetstone Band).
- `src/game/data/potions.ts` (new) — two consumable "general" slots per
  hero, separate from gear. `PotionDefinition`s with a `"heal"` or
  `"attackBuff"` effect, both flat and instant. Healing Draught (+6 HP,
  capped at max) and Vigor Tonic (+2 attack for the rest of the battle).
- `src/game/entities/Hero.ts` — `equippedItemId` became `equippedItems:
  Partial<Record<GearSlotId, string>>`; new `equippedPotions:
  Partial<Record<GeneralSlotId, string>>`. `defense`/`effectiveAttackDamage`
  now sum bonuses across every filled gear slot. New
  `usePotion()`/`hasAnyPotion()`/`firstLoadedPotionSlot()`.
- `src/game/scenes/BattleScene.ts` — the Gear grid now shops equipment AND
  potions from one combined 14-item catalogue; equipping auto-places into
  the correct slot (rings/potions fill the first empty matching slot, or
  replace the first one if both are full). A new **Potion (P)** button
  spends a carried potion as the hero's action. `GAME_HEIGHT` raised 1000
  -> 1080 (the Gear grid is now taller than the Shop grid).
- `src/game/scenes/CompendiumScene.ts` (new) — a read-only rules/spell/
  feat/equipment lookup index, 8 category tabs, reached from a new
  MainMenuScene button. Renders existing data only; Classes gets a
  per-class selector plus Prev/Next pagination (Fighter alone has 21
  features), every other category renders as one flat list.
- `tests/potions.test.ts` (new, 8 tests), `tests/equipment.test.ts`
  (rewritten for multi-slot, 7 tests). **283 tests total** (was 272).
  Typecheck, build (48 modules, up from 44), and `npm run dev` (HTTP 200)
  all clean.

See **D-078** in `DECISIONS.md` for the full rationale, including the two
scope forks Kevin was asked directly (the classic 7-slot loadout over a
smaller option, and confirming potions). New UI/gameplay-feel — not yet
confirmed by a human, see KNOWN_ISSUES **KI-041**.

## [Unreleased] — 0.2.0-dev — Phase 11.4: party assembly + AI-controlled heroes (D-077)

Added, per the Phase 11 roadmap (D-071):
- `src/game/data/difficulty.ts` (new) — Easy/Normal/Hard/Nightmare tiers,
  each a flat `enemyCountMultiplier`/`enemyHpMultiplier` pair (first-pass
  values, real tuning deferred to Kevin's in-browser play), plus
  `partySizeScalingFactor` (linear against the roster's balanced size of 4).
- `src/game/systems/WaveSystem.ts` — two new optional `WaveSystemOptions`
  fields, `enemyCountMultiplier`/`enemyHpMultiplier` (default 1, so every
  existing caller/test is unaffected). Scales a wave group's spawn count
  (rounded, min 1) and each spawned enemy's max HP (via a cloned
  `EnemyDefinition` — the shared registry entry is never mutated).
- `src/game/systems/HeroAISystem.ts` (new) — pure decision logic for an
  AI-controlled hero's turn: attack a target already in range and hold, or
  advance toward the nearest living enemy and attack if that closes into
  range. Deliberately mirrors `WaveSystem.tickEnemyPhase`'s own
  attack-or-advance choice rather than a new policy.
- `src/game/data/heroes.ts` / `src/game/systems/CharacterBuildSystem.ts` —
  `HeroDefinition`/`CharacterBuild` gained an optional
  `controlledBy: "human" | "ai"` field (absent = "human"; the classic
  roster and every prior build are unaffected). `src/game/entities/Hero.ts`
  reads it into a new `controlledBy` property.
- `src/game/scenes/BattleScene.ts` — `runAIHeroTurns()` runs every
  AI-controlled hero's turn automatically at the start of each player
  phase, through the same `tryBasicAttack`/`hero.moveTo` code a human's
  click already uses. Combines the picked difficulty tier and the actual
  roster size (`heroDefinitions.length`) into the `WaveSystem` multipliers
  above.
- `src/game/scenes/CharacterCreationScene.ts` — a per-hero Human/AI toggle
  (folded into the existing "Hero N" header, no layout reshuffle), plus a
  Party Size (1-4, capped at today's four hero-start tiles) and Difficulty
  selector between the hero panels and Start Battle. A smaller party size
  dims and excludes the extra panel(s) from validation and the roster sent
  to `BattleScene`.
- `tests/difficulty.test.ts` (new, 4 tests), `tests/heroAISystem.test.ts`
  (new, 8 tests), plus additions to `tests/waves.test.ts` (4) and
  `tests/characterBuildSystem.test.ts` (1). **272 tests total** (was 255).
  Typecheck, build (44 modules, up from 42), and `npm run dev` (HTTP 200)
  all clean.

See **D-077** in `DECISIONS.md` for the full rationale, including why party
size stays capped at 4 for now and why the AI policy is deliberately
minimal. New UI/gameplay-feel — not yet confirmed by a human, see
KNOWN_ISSUES **KI-040**.

## [Unreleased] — 0.2.0-dev — Phase 11.3 follow-up: subclass content (D-076)

Added one real, named subclass per class:
- `src/game/data/subclasses.ts` (new) — `SubclassDefinition` (reuses
  `ClassFeature`'s exact shape, no parallel type). **Champion** (Fighter),
  **School of Evocation** (Wizard), **Thief** (Rogue), **Life Domain**
  (Cleric) — twenty feature entries total, all `mechanicallyActive: false`
  (none reachable by a level-1 character; the underlying mechanics — crits,
  saves, reactions, healing, etc. — have no system to plug into anyway).
- `src/game/systems/CharacterSystem.ts` — `featuresUpToLevel`/
  `featuresAtLevel`/`activeFeaturesUpToLevel` re-typed to a minimal
  `HasFeatures` shape so they work on class OR subclass feature lists with
  no duplicate functions.
- `src/game/data/classes.ts` — the four subclass-choice feature entries now
  name their modeled subclass instead of just saying "deferred."
- `tests/subclasses.test.ts` — 9 new tests (data integrity: right class,
  right level, fully inert). **255 tests total** (was 246). Typecheck,
  build (42 modules, unchanged), and `npm run dev` (HTTP 200) all clean.

See **D-076** in `DECISIONS.md` for the full rationale, including why
Divine Strike and Empowered Evocation were deliberately left unwired even
though one is structurally similar to the Rogue's already-active Sneak
Attack. Pure rules-engine data — no scene/UI changes, so no new
KNOWN_ISSUES browser-pass item.

## [Unreleased] — 0.2.0-dev — Phase 11.3: starter class/race/feat roster (D-075)

Added, per the Phase 11 roadmap (D-071):
- `src/game/data/classes.ts` — `ROGUE` (d8, DEX, DEX/INT saves, Sneak Attack
  as a flat rider via the new generic `bonusDamageByLevel` field) and
  `CLERIC` (d8, WIS, WIS/CHA saves, subclass choice at level 1 — earlier
  than every other class). Cleric reuses Wizard's cantrips-known/spell-slot
  tables verbatim (now factored out as `FULL_CASTER_CANTRIPS_KNOWN_BY_LEVEL`/
  `FULL_CASTER_SPELL_SLOTS_BY_LEVEL`). `CLASS_DEFINITIONS` is now
  `[FIGHTER, WIZARD, ROGUE, CLERIC]`.
- `src/game/systems/CharacterSystem.ts` — `bonusDamageForClassAtLevel`, a
  generic sparse lookup (same shape as `attacksPerActionForClassAtLevel`).
- `src/game/data/abilities.ts` — one new entry, `sacred-flame`, the
  Cleric's mechanically-active cantrip. `src/game/data/spells.ts` gained
  the Cleric's curated list (Sacred Flame, Guidance, Cure Wounds, Bless,
  Shield of Faith).
- `src/game/data/races.ts` (new) — all six SRD starter races. Speed is the
  one mechanically active trait (Dwarf/Halfling move one tile slower).
- `src/game/data/feats.ts` (new) — Tough, Alert, Lucky, Athlete. Only
  Tough (+2 HP/level) is mechanically active; not wired into any UI (no
  character can reach a feat choice yet).
- `src/game/systems/CharacterBuildSystem.ts` — `CharacterBuild` gained
  `raceId`; `heroDefinitionFromBuild` now derives `movementTiles` from race
  and adds a class's `bonusDamageForClassAtLevel` into `attackDamage`.
- `src/game/data/characterCreation.ts` — `CREATABLE_CLASS_IDS` is now
  `["fighter", "wizard", "rogue", "cleric"]`; new `CLERIC_CANTRIP_IDS`.
- `src/game/scenes/CharacterCreationScene.ts` — a new race-cycle button;
  the panel and every button below it shifted down ~40px to fit it.
- `tests/races.test.ts`, `tests/feats.test.ts`, plus additions to
  `tests/characterSystem.test.ts`, `tests/spellcastingSystem.test.ts`,
  `tests/characterBuildSystem.test.ts`, `tests/characterCreationData.test.ts`,
  and `tests/spells.test.ts` — 29 new tests. **246 tests total** (was 217).
  Typecheck, build (42 modules), and `npm run dev` (HTTP 200) all clean.

See **D-075** in `DECISIONS.md` for the full rationale, including why Rogue
and Cleric specifically, and why feats stay unwired. New KNOWN_ISSUES item:
**KI-039** (the race-cycle button and the two new classes need a human's
browser pass). Also resolved: **KI-038** — Kevin confirmed the Phase 11.2
class-cycle button works in-browser.

## [Unreleased] — 0.2.0-dev — Phase 11.2: spellcasting engine + Wizard (D-074)

Added, per the Phase 11 roadmap (D-071):
- `src/game/data/spells.ts` — a curated 5-spell list: two cantrips (Fire
  Bolt, Ray of Frost, mechanically playable today) and three 1st-level
  spells (Magic Missile, Burning Hands, Mage Armor, data-only until a
  spell-slot economy exists).
- `src/game/data/abilities.ts` — two new entries, `fire-bolt` and
  `ray-of-frost`, the real combat numbers behind the two cantrips, in the
  SAME registry `BattleScene` already reads.
- `src/game/data/classes.ts` — `WIZARD`: d6 hit die, INT casting, a full
  level 1–20 feature table, and a new `spellcasting` field (cantrips-known
  and spell-slots-by-level tables through level 20).
- `src/game/systems/SpellcastingSystem.ts` — pure derived math:
  `isSpellcaster`, `cantripsKnownForClassAtLevel`,
  `spellSlotsForClassAtLevel`, `preparedSpellsKnownForWizardAtLevel`.
- `src/game/systems/CharacterBuildSystem.ts` — a cast spell's attack modifier
  now uses the caster's spellcasting ability (INT for Wizard) instead of the
  melee-STR/ranged-DEX split; Fighter's build path is unchanged.
- `src/game/data/characterCreation.ts` — `CREATABLE_CLASS_IDS` and
  `signatureActionIdsForClass`, the one place deciding which action list a
  class picks from.
- `src/game/scenes/CharacterCreationScene.ts` — the static "Class: Fighter"
  line is now a real cycle button (Fighter/Wizard).
- `tests/spells.test.ts`, `tests/spellcastingSystem.test.ts`,
  `tests/characterCreationData.test.ts`, plus additions to
  `tests/characterSystem.test.ts` and `tests/characterBuildSystem.test.ts` —
  27 new tests. **217 tests total** (was 190). Typecheck, build (41 modules),
  and `npm run dev` (HTTP 200) all clean.

See **D-074** in `DECISIONS.md` for the full rationale, including why
cantrips specifically are the only spells playable today and why this
needed zero changes to `BattleScene`. New KNOWN_ISSUES item: **KI-038** (the
new class-cycle button needs a human's browser pass).

## [Unreleased] — 0.2.0-dev — Phase 11.1 finished: character-creation UI (D-073)

Second and final slice of Phase 11.1. Added:
- `src/game/data/characterCreation.ts` — a 12-name original preset pool and
  the four signature abilities a created character can pick.
- `src/game/systems/CharacterBuildSystem.ts` — `StandardArrayAllocator` (a
  pure swap-cycle allocator for the standard array) and
  `heroDefinitionFromBuild` (turns a finished build into the `HeroDefinition`
  shape `BattleScene` plays).
- `src/game/scenes/CharacterCreationScene.ts` — a new scene: build a 4-hero
  party (name, ability scores, signature ability), with a live derived-stats
  preview, then start a battle with that custom roster.
- `MainMenuScene` gained a second button, **"Create Party (new)"** — the
  original START button is UNCHANGED, still using the classic Ash/Wren/Bram/
  Mira roster. `BattleScene` gained `init(data?)` reading an optional custom
  roster; falls back to the classic roster when none is passed (byte-for-byte
  same behavior as before on that path).
- `tests/characterBuildSystem.test.ts` — 12 new tests. **190 tests total**
  (was 178). Typecheck, build, and `npm run dev` (HTTP 200) all clean.

Deliberately ADDITIVE, not a roster replacement — see **D-073** in
`DECISIONS.md` for the full rationale (variety regression risk with only one
class; protecting Kevin's still-open browser-verification checklist). New
KNOWN_ISSUES item: **KI-037** (this screen needs a human's browser pass).

## [Unreleased] — 0.2.0-dev — Phase 11.1 begins: D&D character rules engine (ability scores, proficiency bonus, Fighter class table)

First implementation slice of the Phase 11 roadmap (D-071). Added, all pure
and unit-tested, **not wired into the live game yet**:
- `src/game/data/abilityScores.ts` — the six SRD ability scores, the
  `floor((score-10)/2)` modifier formula, and the standard array.
- `src/game/data/classes.ts` — a generic class-definition shape plus ONE
  fully-built class, **Fighter** (d10 hit die, STR/CON saves, Extra Attack
  at 5/11/20, a full level 1–20 feature table).
- `src/game/systems/CharacterSystem.ts` — proficiency bonus by level, max HP
  by class/level/CON (fixed average hit die, no rolling — matches existing
  deterministic combat, D-030), attacks-per-action lookup, feature queries.
- `tests/characterSystem.test.ts` — 16 new tests. **178 tests total** (was
  162). Typecheck and build clean.

This is the project's first SRD-derived content (logged in
`CONTENT_SOURCES.md`: SRD 5.2.1, CC BY 4.0, attribution required before
public release). Several Fighter features are recorded as data but inert
today (`mechanicallyActive: false`) — they depend on systems this game
doesn't have yet (an action economy beyond move+one-action, a rest concept,
saving throws/dice, subclasses, feats), all deliberately deferred per
D-071's sub-phase order, not oversights. The fixed 4-hero roster
(`heroes.ts`/`Hero`/`BattleScene`) is completely unchanged this chat — see
**D-072** in `DECISIONS.md` for the full rationale and scope boundary.

## [Unreleased] — 0.2.0-dev — Phase 11 roadmap: D&D 5.5e character system and content expansion (planning only, no code changed)

Kevin outlined a large long-term vision for the rest of the project: a real
D&D 5.5e-based character system (ability scores, classes/subclasses, races,
feats, spells, expanded equipment/magic items/potions) with individual
hero level-ups tied to actual class features; a freeform party builder
(race + class per slot, replacing the fixed 4-hero roster); a bestiary; a
map system overhaul (terrain types, multiple in/out tiles, shop/treasure
tiles, proximity-gated building); boss-themed campaigns; a free-play mode;
AI-controlled party members; an in-game rules/spell/feat index; a map
builder; and a full visual overhaul. This was scoped into the existing
Phase 11 ("Campaign Expansion") as a ten-part sub-phase roadmap
(11.1–11.10) rather than new phase numbers — see **D-070** (freeform hero
model) and **D-071** (the full sub-phase breakdown) in `DECISIONS.md`.

**No source code changed this chat** — docs only (`SOURCE_OF_TRUTH.md`,
`DECISIONS.md`, `PROJECT_STATUS.md`, `PHASE_HANDOFF.md`, this entry).
Typecheck/tests/build not re-run (nothing to verify). The first
implementation slice (11.1 — ability scores, proficiency, one full class,
first-pass character creation UI) has not started.

## [Unreleased] — 0.2.0-dev — Party-wipe defeat, and spawn tile now off-limits to heroes (D-068, D-069)

Kevin reported a playtest bug (a hero standing on/near the spawn tile caused
enemies to visually "stack") and requested a rule change (the game should
end if the whole party dies). Both fixed as `BattleScene`-only changes; no
pure-system code touched. Typecheck + build clean; test count unchanged at
**162** (presentation-layer decisions, matching the D-066 no-new-Vitest
precedent).

### Changed — party wipe is now also a loss condition (D-068)
- **This reverses a LOCKED decision** (D-034 / the Source of Truth §9
  table's "Loss condition" row), done on Kevin's explicit request in chat —
  see the repo-note in `SOURCE_OF_TRUTH.md` and the amendment under D-034 in
  `DECISIONS.md`.
- `BattleScene.resolvePhase()` now also transitions to `defeat` when
  `livingHeroes().length === 0`, alongside the existing Integrity check.
- A new `defeatReason` field distinguishes the end-screen message: "Defeat
  — your party has fallen" vs. the existing "Defeat — the stronghold has
  fallen".

### Fixed — the spawn ("In") tile is now inaccessible to heroes (D-069)
- Root cause of the reported "stacking": nothing previously stopped a hero
  from standing exactly on the spawn tile, so a freshly-spawned enemy could
  land co-located with it and hold there indefinitely (immediately in
  attack range) instead of marching in.
- `BattleScene.isHeroMovementBlocked` now also treats the spawn tile as a
  hard block, the same tier as a wall or an enemy — heroes can no longer
  move onto or through it. Building on the spawn tile was already rejected
  (`BuildSystem.canPlace`, since Phase 5) — no change needed there.

### Docs
- DECISIONS: D-068, D-069; D-034 amended (reversed, not refined).
- SOURCE_OF_TRUTH: a new repo-note on the §9 "Loss condition" row.
- KNOWN_ISSUES: KI-036 added as this slice's in-browser confirmation
  checklist.

## [Unreleased] — 0.2.0-dev — Movement rule change: same-type units may pass through each other (D-067)

Kevin asked for enemies to be able to move through other enemies' space, and
heroes to move through other heroes' space, while still never stopping in
the same space as another. A cross-cutting engine change (`MovementSystem`,
`WaveSystem`), not tied to a specific phase. Typecheck + build clean; the
suite grew **157 → 162 tests**.

### Changed — pass-through movement (D-067)
- **Heroes:** `MovementSystem.MovementQuery` gains a `blocksStopping`
  predicate, independent of the existing `isOccupied` hard block. A tile
  flagged `blocksStopping` (another living hero, from `BattleScene`) can be
  walked THROUGH by `reachableTiles`/`findPath`'s pathing, but is excluded
  as an actual destination by `reachableTiles`, `isLegalDestination`, and
  `findPath`. Walls and enemies remain a hard block for heroes, unchanged.
- **Enemies:** `WaveSystem`'s enemy routing (`advanceEnemy`) no longer
  treats another living enemy's tile as blocking the ROUTE itself — only
  walls/heroes/context still do. Instead, the movement-budget-limited
  landing tile backs off one step at a time while it's occupied by another
  still-there enemy, so an enemy can walk straight past a stopped ally
  instead of detouring around or queueing behind it, while two enemies
  still never end a phase on the same tile. Spawn-blocking is unaffected.
- New tests: `tests/movement.test.ts` (`blocksStopping` describe block) and
  `tests/enemyCollision.test.ts` (a deterministic back-off-then-pass-through
  scenario, asserting the walked path includes the passed-through tile).
- **Not included:** no change to hero-vs-enemy blocking in either direction
  (D-033 unaffected).

### Docs
- DECISIONS: D-067; amendment notes added under D-018 and D-045 (refined,
  not reversed).
- KNOWN_ISSUES: KI-035 added as this slice's in-browser confirmation
  checklist; KI-018's resolved note updated to mention the refinement.

## [Unreleased] — 0.2.0-dev — Phase 8, continued — full keyboard-only play (KI-030 resolved)

Kevin asked to close the remaining Phase 8 accessibility gap: tile
movement/targeting and shop/gear item picking were still pointer-only
(KI-030), left honestly unattempted by the prior Phase 8 chat as a
substantially larger feature. Delivered this chat as a `BattleScene`-only
addition (no pure-system changes) — typecheck and the full 157-test suite
stay green (this is presentation-layer input, which has never had Vitest
coverage — see D-002/D-066), build clean, `npm run dev` serves HTTP 200.

### Added — full keyboard-only play (D-066)
- **Arrow keys** move a highlighted tile cursor around the board (clamped
  to the map edge); **Enter or Space** act on whatever the cursor is over —
  select a hero, pick/confirm a move destination, basic-attack or
  ability-target an enemy, place/refund a structure, or equip/unequip a
  hero — via the same `handleClick`/`updateHoverAt` dispatch a mouse click
  already used. No combat/build/equip rule was duplicated.
- **In Build (B) / Gear (G) mode**, arrow keys default to navigating the
  shop/Gear item grid (a new white focus ring on the highlighted button,
  layered over the existing blue "selected" fill); **Tab** switches arrow
  keys between the grid and the board cursor. Enter/Space while the grid
  has focus picks the highlighted item, same as clicking it.
- The persistent status hint now shows "Tab: aim on board" / "Tab: pick
  item" while in Build/Gear mode, and "arrows+Enter/Space: keyboard play"
  otherwise; the How to Play overlay (H) now teaches the new controls (its
  title/button moved further from center to keep clear of the longer text).
- A full battle should now be completable with no mouse at all.
- **Not included:** no changes to any pure system — this is entirely
  `BattleScene` presentation-layer wiring.

### Docs
- KNOWN_ISSUES: KI-030 resolved; KI-034 added as this slice's in-browser
  confirmation checklist (same pattern as KI-001/KI-024/KI-031).
- DECISIONS: D-066.

## [Unreleased] — 0.2.0-dev — Phase 8 (UX, Accessibility, and Presentation) — begun

Kevin started Phase 8 and asked for the Gear/Build button overlap to be fixed
along the way. This slice delivers the Source of Truth's Phase 8 list except
volume controls (no audio system exists yet — KI-029) and actual art
production (a planning document only). Typecheck + build clean throughout;
the suite grew **150 → 157 tests**.

### Fixed
- **Gear button overlapped Build button (D-059).** A one-line x-position math
  bug in `BattleScene.buildShopHud()` — Gear's position re-subtracted Build's
  half-width against Build's center instead of its left edge.

### Added — settings: animation speed (speed control + reduced motion), local persistence (D-060)
- New `src/game/systems/SettingsSystem.ts`: pure, storage-agnostic
  (`SettingsStorage` interface), one setting (`animationSpeed:
  "normal"|"fast"|"instant"`) plus a tutorial-seen flag. `"instant"` skips
  tweening entirely — the reduced-motion case.
- `MainMenuScene` gets a settings button (top-right) that cycles the value
  and saves it; `BattleScene` reads it on `create()` and scales every tween
  duration (enemy movement, hit/breach/trap/burn flashes) and the
  enemy-phase's post-move delay accordingly.
- **No volume control was added** — there is no audio system anywhere in the
  codebase yet (KI-029).
- New: `tests/settings.test.ts` (7 tests).

### Added — keyboard support (D-061)
- Number keys **1-4** select a hero by fixed roster position (Ash/Wren/
  Bram/Mira), skipping a fallen hero's slot silently.
- **H** opens a new how-to-play overlay (see below) on demand.
- The ability button now labels itself "(Q)"; the status hint line now ends
  with "1-4: select hero" / "H: help".
- Full keyboard-only play (tile navigation, shop-item picking) is NOT
  included — tracked honestly as KI-030.

### Added — tooltips (D-062)
- Hovering (not clicking) a Build or Gear grid button now previews its
  name/cost/description in the status hint, via a new `onHover` callback on
  the shared `buildItemGrid` helper.

### Added — color-independent indicators (D-063), resolving KI-023 and KI-027
- **Miniboss:** a larger token, a gold outline, and a persistent "Basalt
  Colossus (Boss)" name banner.
- **Status effects:** a persistent lettered badge above an enemy's token
  (e.g. "SB" for slowed+burning) for as long as the effect lasts, not just a
  one-off flash. New data export `STATUS_EFFECT_ORDER` in
  `data/statusEffects.ts`.
- **Build ghost:** a ✓/✗ glyph alongside its green/red tint.
- **Ability targets:** a small ◆ corner marker distinguishing them from
  basic-attack targets (both use similar warm outline colours).
- **Stronghold Integrity:** "⚠ LOW" text at ≤5, not just a colour swap.

### Added — tutorial prompt (D-064)
- A dismissible "How to Play" overlay shown once automatically before the
  first player phase (persisted locally so it won't reappear on its own),
  reopenable any time via **H**. Reuses the level-up choice's
  defer-the-phase-transition pattern; Esc dismisses it (it's informational,
  not a forced choice, unlike a level-up pick).

### Added — original asset plan (D-065)
- `ASSET_PLAN.md` (new): inventories the current placeholder approach,
  priority-orders what real art would eventually replace, restates the
  originality constraints, and notes the technical shape for a future
  implementation. Schedules no production — that's Kevin's future call.

### Docs
- KNOWN_ISSUES: KI-023 and KI-027 resolved; the Gear/Build overlap resolved
  as KI-032; KI-029 (no volume control yet) and KI-030 (keyboard support is
  partial) added; KI-031 added as this slice's in-browser confirmation
  checklist (same pattern as KI-001/KI-024).
- DECISIONS: D-059 through D-065.

## [Unreleased] — 0.2.0-dev — Phase 7 (Vertical Slice) — remaining content

This slice clears the rest of Phase 7's checklist in one sitting: heroes 2→4,
the rest of the structure list (gates/platforms/perches + a third trap), status
effects, level-up choices, limited equipment, spell-like abilities, and an
improved wave preview/shop. Typecheck + build clean throughout; the suite grew
from **120 → 150 tests**. Balance/feel remains Kevin's in-browser call
(KI-015) — every new number here is a first-pass starting point, same as the
existing roster/campaign numbers.

### Added — heroes 2→4 (D-052)
- **Bram** (guardian, melee) and **Mira** (frostcaller, ranged) in
  `data/heroes.ts`, each with one new spell-like ability:
  **Taunting Slam** (AoE + stun) and **Frost Bolt** (single-target + slow).
- `data/testMap.ts` gained two more `H` tiles (Ash/Wren's original tiles are
  unchanged); `README.md` updated ("first two H tiles" → "first four").
- No scene changes needed — hero rendering/selection/status already looped
  over `HERO_DEFINITIONS`/`this.heroes` generically.
- New: `tests/heroRoster.test.ts` (4 tests).

### Added — status effects (D-053)
- `data/statusEffects.ts`: **Slowed**, **Stunned**, **Burning** — reduce
  movement, skip a turn, or damage-over-time (before the enemy's own turn).
  Reapplying refreshes to the longer duration instead of stacking.
- `Enemy` gained active-status bookkeeping (`applyStatus`/`hasStatus`/
  `tickStatuses`/`effectiveMovementTiles`); `WaveSystem.tickEnemyPhase` applies
  the rules and reports them via a new `statusEvents` field.
- **Bug fix:** `WaveSystem.advanceEnemy` silently corrupted a fully-slowed
  enemy's position (0 effective movement was previously unreachable). Fixed
  with an early return on zero steps.
- New: `tests/statusEffects.test.ts` (7 tests).

### Added — more buildable structures (D-054) + shop relayout (D-055)
- `data/structures.ts`: **Gate** (blocks enemies, not heroes), **Melee
  Platform** / **Ranged Perch** (a standing-hero attack bonus, the new
  `"platform"` structure kind), **Tangle Root** (the third trap: damage +
  slow). `BuildSystem` gained `blocksHeroAt`, `platformBonusFor`, and
  `trapStatusAt`.
- The shop UI's fixed 3-slot row is replaced with a generic, reusable
  `buildItemGrid` (row-major, 4 columns) now holding all 7 buildables; the
  same helper is reused for the new equipment grid (below). `GAME_HEIGHT`
  raised 900 → 1000 for the extra row (see D-055/config.ts).
- New: `tests/phase7Structures.test.ts` (10 tests).

### Added — level-up choices (D-056)
- `systems/ProgressionSystem.ts`: every 2 waves cleared, the player picks
  **Vigor** (+3 max HP to every living hero, healing them) or **Might** (+1
  basic-attack damage to every living hero). `BattleScene` shows a modal
  choice and defers the Victory/Between-Waves transition until it's picked.
- New: `tests/progression.test.ts` (5 tests).

### Added — limited equipment (D-057)
- `data/equipment.ts`: **Iron Buckler** (+2 defense), **Whetstone Blade** (+2
  attack damage), **Traveler's Cloak** (+1/+1) — one slot per hero, bought
  from a new "Gear (G)" panel, swappable with a full refund of the old item.
- `Hero` gained `equippedItemId`, `defense` (now a live equipment lookup —
  KI-013's first real source of hero defense), `effectiveAttackDamage`,
  `effectiveMaxHealth`, and level-up grant methods (`grantVigor`/`grantMight`).
- New: `tests/equipment.test.ts` (4 tests).

### Added — improved wave preview & shop polish (D-058)
- The HUD now shows "Next: Wave N — Enemy x count, ..." during play, read
  straight from `data/waves.ts` (no new system needed).
- Every structure and equipment item gained a `description` field, shown in
  the build/equip status hint instead of just a name and cost.

### Also
- `DECISIONS.md`: D-052 through D-058, plus an addendum on D-047's "dice
  visibility" clarification — Kevin has now confirmed combat stays
  deterministic for this phase and a hit-chance system is an explicit FUTURE
  item, not invented here.
- `KNOWN_ISSUES.md`: KI-001's manual regression checklist confirmed in-browser
  by Kevin (moved to Resolved); KI-013 updated (defense is now reachable via
  equipment); new deferred/known items for this slice's scope cuts.

## [Unreleased] — 0.2.0-dev — Phase 7 (Vertical Slice)

Phase 7 progress, delivered in slices. The flying + anti-air slice (a genuine
engine change) came first; this latest slice is pure additive content the engine
already supports — the expanded enemy roster and the full ten-wave campaign with
a miniboss finale. Typecheck + build clean throughout; the suite has grown from
101 → 111 → **120 tests**. Balance/feel across the new content remains Kevin's
in-browser tuning call (KI-015): under the headless upper-bound simulation the
campaign clears with full integrity and ends gold-rich, exactly the "errs easy /
gold-rich" finding the v0.1.1 MVP had, so these numbers are a starting point, not
a verdict.

### Added (roster + ten-wave campaign — D-050 / D-051)
- **Four new regular enemies**, each shaped as an answer to one of the two
  heroes' tools (`src/game/data/enemies.ts`, all original, no IP):
  - **Brute** — slow, high-HP, big breach; rewards focus fire / walls.
  - **Swarmling** — 2-HP throwaway in packs; rewards area damage and trapped
    lanes over single-target fire.
  - **Warden** — heavily armoured (high defense); rewards Wren's armour-piercing
    shot, resists Ash's basic strike.
  - **Razorwing** — a tougher, faster flyer than the Wisp; rewards the Sky Snare
    plus ranged fire.
- **First miniboss, `basalt-colossus`** — the wave-10 finale: very high HP,
  armoured, slow, heavy breach. Beatable by the two-hero party once its escort
  is cleared. Original content.
- **Optional `role?: "minion" | "miniboss"` field** on `EnemyDefinition` — a
  pure data tag (no engine handling) so the campaign and tests can identify the
  boss. Omitted on every existing enemy, so nothing else changes.
- **Ten-wave campaign** (`src/game/data/waves.ts`): waves 6–10 are new and
  introduce the roster progressively (Brute → swarm → air pressure → armour →
  miniboss finale). Waves 1–5 are byte-for-byte the v0.1.1 loop. Placeholder
  colours added for every new enemy.
- **`tests/campaign.test.ts`** (9 tests): roster structure (6–8 minions + exactly
  one miniboss; boss out-scales minions; every enemy has a colour and consistent
  id; sane numeric fields); campaign structure (exactly ten waves; every spawn
  references a real, renderable enemy with a valid schedule; the miniboss appears
  only in the final wave, exactly once; completion gold never decreases and peaks
  at the finale); and a full ten-wave **winnability** run through the real
  fighting-building-spending loop (heroes focus-fire, gold buys a Sky Snare and
  a trapped lane), proving victory with integrity intact and the economy flowing.
- `tests/mvp-integration.test.ts` now transparently drives the **full ten-wave**
  campaign (it loops `WAVES.length`); wording updated to match. Still proves the
  loop is winnable and (do-nothing) losable.

## [0.2.0-dev earlier] — Phase 7: flying + anti-air

First Phase 7 increments. Scoped deliberately to the one area that is a real
engine change rather than "more data": how movement type affects routing and
defenses. Part 1 added flying movement; part 2 added its counter (an anti-air
trap) and wired one flyer into the campaign so it is visible in play. All 101
prior tests still pass; 10 new ones added (**111 total**). Typecheck + build
clean. Note: exact flyer counts / difficulty remain Kevin's in-browser tuning
call (KI-015) — the campaign change here is minimal and provisional.

### Added
- **Flying enemies (`movementType: "flying"`).** A flyer routes over walls —
  both static map walls and placed barricades — straight toward the exit. It is
  still confined to the map and still stopped by units (heroes, other enemies).
  See DECISIONS D-048.
- **First flying enemy, `wisp`** (`src/game/data/enemies.ts`): fragile, low
  gold, ignores walls. Original content, no IP. Defined but **not yet used in a
  campaign wave** (see KNOWN_ISSUES KI-022).
- **`tests/flying.test.ts`** (6 tests): flyer crosses a static wall a ground
  unit can't; flyer passes a placed barricade a ground unit can't; flyer stays
  on the map; flyer still stopped by a hero; two flyers never stack; ground
  routing regression guard.

### Added (part 2 — flying's counter, D-049)
- **Movement-type-aware traps.** A trap may declare `targets: "ground" |
  "flying" | "any"` (default "any"). A trap only bites the types it targets.
- **Sky Snare** (`sky-snare`), the **anti-air** structure (KI-022's counter):
  a buyable trap that catches flyers only and ignores ground units (7g, 4 dmg,
  ignores defense). Original content. Added to the shop (now three structures).
- The **Spike Trap** is now `"ground"`-only — it no longer (incorrectly) hits
  flyers crossing overhead.
- **Wave 5 now spawns one `wisp`** so flying appears in real play. Provisional
  placement; final flyer counts are Kevin's in-browser tuning call (KI-015).
- Four new tests in `tests/flying.test.ts` for trap targeting.

### Changed
- `PathfindingSystem.RouteQuery` gained an optional `ignoreWalls` (default
  false — ground routing and every existing caller/test are unchanged).
- `WaveSystem` now routes each enemy according to its `movementType` and accepts
  optional `EnemyPhaseContext.isWall` (flyer passes a barricade but not a hero)
  and `EnemyPhaseContext.trapTargets` (trap targeting). Both are opt-in and
  default to prior behaviour.
- `BattleScene` passes `isWall` and `trapTargets` to the enemy phase and draws
  flying enemies with a pale ring (cosmetic) so the player can see why
  barricades don't re-route them.
- `mvp-integration.test.ts` now honours trap targeting like the real scene, and
  still shows the five-wave loop is winnable (with the flyer) and losable.

## [0.1.1] — 2026-07-23 — Playtest fixes on the v0.1.0 MVP

Kevin played the `v0.1.0` MVP and reported six observations. Two were working as
designed (not changed — see "Clarifications" below); four were real bugs, fixed
here.

### Fixed
- **Enemies could stand on the same tile.** `WaveSystem` now treats every other
  living enemy's current tile as blocked when routing (a boxed-in enemy holds
  its tile instead of overlapping), and a spawn onto an occupied spawn tile
  retries the next phase instead of stacking or being dropped. See DECISIONS
  D-045. Tests: `tests/enemyCollision.test.ts` (3).
- **An extra, empty turn was needed after the last enemy died on the player's
  own turn.** A hero kill that clears an already-fully-spawned wave now resolves
  immediately (Victory/Between Waves) instead of waiting for a pointless Enemy
  Phase. Required extending `TurnSystem.ALLOWED` with `player -> betweenWave`
  and `player -> victory`. See DECISIONS D-044.
- **No way to leave the victory/defeat screen except an undiscoverable Esc
  shortcut.** The end screen now has a real, clickable **Return to Menu**
  button; Esc still also works. See DECISIONS D-047.
- **HUD text and buttons could overlap.** Root causes: the area below the grid
  had too little vertical room for the status line + a 5-line combat log + a
  button row; status text and the combat log sat side-by-side (so a long hint
  could run into the log); and the centered title/banner could reach the
  Build/End Turn buttons, which were positioned relative to the grid's
  (narrower) width. Fixed by raising `GAME_HEIGHT` (720 → 900; safe, since
  `Scale.FIT` rescales the canvas regardless of its logical size), stacking
  status/log vertically with word-wrap instead of side-by-side, shortening the
  phase-order debug log, and anchoring Build/End Turn to a fixed canvas-edge
  margin instead of the grid's width. Verified with an explicit bounding-box
  check against worst-case (longest) on-screen strings. See DECISIONS D-046.

### Clarified (raised in playtesting, not changed — working as designed)
- Enemies don't avoid traps: intentional (D-039) — traps only work if enemies
  can't see them coming.
- Combat is fully deterministic ("everything is an automatic hit"): intentional
  (D-030). Flagged rather than silently accepted: the Source of Truth's own
  rules table (§9) still lists "Dice visibility" as OPEN, so this needs Kevin's
  explicit sign-off one way or the other, not another chat's assumption.

### Changed
- `package.json` version bumped to 0.1.1.
- `src/game/config.ts`: `GAME_HEIGHT` 720 → 900.
- Tests: 98 → 101 (added `tests/enemyCollision.test.ts`, 3 tests).

## [0.1.0] — 2026-07-23 — Phase 6: Integrated Five-Wave MVP (`v0.1.0-mvp`)

The first complete, playable game loop: start → build/fight across five waves →
win or lose → restart. This phase is integration, verification, and polish —
**no new mechanics** were added; the Phase 0–5 systems are wired into a whole.

### Added
- `tests/mvp-integration.test.ts` (2): a headless full-loop simulation that drives
  all five real waves through every system at once (WaveSystem spawning/routing,
  CombatSystem, BuildSystem + trap interaction, EconomySystem, RewardSystem). One
  test plays a sensible strategy to **victory** with integrity intact; the other
  does nothing and reaches **defeat**. Total tests now 98.

### Changed
- `src/game/scenes/MainMenuScene.ts`: title-screen copy updated for the MVP (it
  no longer says "battlefield test screen") with a short how-to-play line.
- `src/game/scenes/BattleScene.ts`: added an explicit input-listener cleanup on
  scene `shutdown` (removes our pointer/keyboard handlers) so returning to the
  menu and starting a new battle can never accumulate duplicate listeners. This
  is belt-and-suspenders on top of Phaser's own per-scene teardown; all state is
  already reset in `create()`.
- Version bumped to **0.1.0** (`package.json`).

### Balance
- Gameplay/wave numbers are **unchanged** for v0.1.0 (see DECISIONS D-042). The
  balancing pass took the form of the new simulation, which shows the loop is
  winnable and losable and that current tuning errs **easy / gold-rich** under
  perfect play (0 leaks, ~191 surplus gold). Concrete in-browser tuning is the
  first Phase 7 task (KNOWN_ISSUES KI-015).

## [0.0.6] — 2026-07-23 — Phase 5: Building, Traps, Gold, and Shop

### Added
- `src/game/systems/EconomySystem.ts`: pure gold balance. `spend` deducts only
  when affordable (never below zero) and reports the before/after; `award` and
  `refund` add gold. Single authority for the party's gold.
- `src/game/systems/BuildSystem.ts`: pure structure placement. Validates a build
  (empty floor, not a spawn/exit, not unit-occupied, not already built on) and
  rejects any wall that would remove every spawn→exit route (checked with
  `PathfindingSystem`). Exposes `isWallAt` (routing/movement) and `trapProfileAt`
  (trap damage), plus `remove`/`removeAt` for refunds.
- `src/game/systems/RewardSystem.ts`: pure reward arithmetic — kill-gold sum and
  wave reward (completion gold + optional turn-limit time bonus).
- `src/game/data/structures.ts`: two original buildable structures — a
  **Barricade** (wall, 5g) and a **Spike Trap** (trap, 8g, 3 damage).
- `src/game/config.ts`: `STARTING_GOLD` (20) and Phase 5 colours (gold, wall,
  trap, valid/invalid build ghost, trap flash).
- `BattleScene`: gold HUD; a **Build** toggle (key `B`); shop buttons with
  affordability shading; a green/red ghost placement preview; buy/refund/Done;
  structure tokens; wall-aware enemy routing and hero movement; trap flashes and
  combat-log lines; and gold awards for kills, wave completion, and time bonus.
- Tests: `tests/economy.test.ts` (8), `tests/rewards.test.ts` (5), and
  `tests/building.test.ts` (13 — placement rules, path-block rejection, trap
  triggering through the enemy phase, refunds, and wall rerouting). Total now 96.

### Changed
- `src/game/systems/WaveSystem.ts` (additive, backward compatible): the
  `EnemyPhaseContext` gained an optional `trapAt` callback and the
  `EnemyPhaseReport` gained `trapTriggers`. An enemy that steps onto a trap tile
  takes deterministic `CombatSystem` damage and, if defeated, stops without
  breaching. A dead enemy is skipped in the enemy loop. **With no context the
  Phase 3/4 behaviour is unchanged**, so all prior tests still pass.
- `src/game/data/waves.ts`: added provisional `turnLimit` values to each wave so
  the time-bonus mechanism is reachable (flagged for balance testing — KI-015).

## [0.0.5] — 2026-07-22 — Phase 4: Combat MVP

### Added
- `src/game/systems/CombatSystem.ts`: pure, entity-agnostic combat rules —
  Manhattan range checks, deterministic damage (`max(1, damage − defense)`, or
  full damage when `ignoreDefense`), deterministic target selection, and
  single-target / area attack resolution. Reports a defeat only on the strike
  that reaches 0 HP, so removal happens exactly once.
- `src/game/data/heroes.ts`: hero definitions promoted from inline scene code to
  data, now carrying combat identity (health, basic attack, one ability each).
- `src/game/data/abilities.ts`: one distinct ability per hero — Ash's **Cleave**
  (hits every adjacent enemy) and Wren's **Piercing Shot** (long-range, ignores
  defense). All original content.
- `src/game/entities/Hero.ts`: hit points, a basic attack, an ability id, and
  `isAlive()`; the action slot is now consumed by attacking or using an ability.
- `src/game/entities/Enemy.ts`: implements the `Combatant` shape (`id`,
  `defense`, attack accessors) and `isAlive()` so heroes can target it.
- `WaveSystem`: enemies now ATTACK in-range heroes (melee Grunt / ranged Runner)
  and hold position, or otherwise advance around blockers; `removeDefeated()`
  clears enemies the heroes have slain; the enemy phase report gained `attacks`.
- Tests: `tests/combat.test.ts` (14 — CombatSystem + enemy melee/ranged
  behaviour + removal) and `tests/victory.test.ts` (1 — a full run that reaches
  **victory** with integrity intact). Total now 70.

### Changed
- `src/game/data/enemies.ts`: the Runner is now the RANGED behaviour
  (`attackRangeTiles: 2`); the Grunt remains melee (range 1).
- `src/game/systems/WaveSystem.ts`: `tickEnemyPhase(context?)` takes optional
  hero targets and a blocked-tile predicate. With no argument it behaves exactly
  as in Phase 3 (march + breach), so every earlier test is unchanged.
- `src/game/scenes/BattleScene.ts`: combat UI — click an outlined enemy to
  basic-attack, an Ability button (key `Q`) for each hero's ability (aim
  single-target abilities with a follow-up click), hero/enemy HP labels, a
  combat log, enemy-attack and hit flashes, hero-defeat removal, and clear
  rejection of out-of-range/already-acted actions.
- `MainMenuScene`: subtitle now reads "Phase 4: combat MVP".

### Notes
- Victory is now reachable (see DECISIONS D-030–D-036). Hero defeat removes the
  hero but is **not** a loss — the only loss condition remains Stronghold
  Integrity = 0 (LOCKED). Combat is deterministic (no dice), which resolves the
  OPEN "dice visibility" item for the MVP; a seedable RandomService is
  deliberately deferred until a genuine random roll exists (no dead code).

## [0.0.4] — 2026-07-21 — Phase 3: Enemy Pathfinding and Wave Movement

### Added
- `src/game/systems/PathfindingSystem.ts`: pure BFS enemy routing to the nearest
  exit over walkable tiles (routes around walls; reports unreachable exits).
- `src/game/systems/WaveSystem.ts`: pure wave orchestrator — scheduled spawns
  from the map spawn point, per-phase enemy advance toward the exit, Breach Damage
  applied to Stronghold Integrity exactly once per enemy, wave-completion and
  defeat detection.
- `src/game/entities/Enemy.ts`: pure per-instance enemy model (position, health).
- `src/game/data/enemies.ts`: two ground enemy definitions (Grunt, Runner),
  matching the Source of Truth `EnemyDefinition` shape.
- `src/game/data/waves.ts`: five wave definitions, matching the Source of Truth
  `WaveDefinition` shape (completion/time-bonus gold carried for Phase 5).
- `config.ts`: `STRONGHOLD_START` (starting Stronghold Integrity = 20) and a
  breach-flash colour.
- Tests: `tests/pathfinding.test.ts` (6), `tests/waves.test.ts` (6), and
  `tests/integration.test.ts` (1 full-loop test on the shipped data). One turn
  test added for the new `resolution -> player` transition. Total now 55.

### Changed
- `src/game/systems/TurnSystem.ts`: `resolution` may now transition to `player`
  (a wave spans several turns), in addition to between-wave / victory / defeat.
- `src/game/scenes/BattleScene.ts` extended for Phase 3: enemies spawn from IN and
  march to OUT during the enemy phase (animated); breaches flash and lower
  Stronghold Integrity; the player→enemy→resolution loop continues a wave, moves
  to the next wave, or ends in victory/defeat; Integrity and wave number are shown
  and an end-screen overlay appears. All mutable scene fields reset in `create()`
  for clean restarts.
- `src/game/data/testMap.ts`: retired the placeholder `E` enemy-start markers;
  enemies now spawn from the `S` spawn point. Heroes flank an open lane.

### Notes
- With no combat yet (Phase 4), enemies cannot be stopped, so the shipped balance
  intentionally ends in **defeat**. Victory is wired but not reachable until
  combat lets the party defeat enemies before they breach. See DECISIONS D-027.

### Verified
- `npm install` (0 vulnerabilities), `npm run typecheck`, `npm test` (55/55),
  `npm run build` (no warning), and `npm run dev` all pass.

## [0.0.3] — 2026-07-21 — Phase 2: Turn State Machine and Hero Movement

### Added
- `src/game/systems/TurnSystem.ts`: pure phase state machine (preparation,
  player, enemy, resolution, between-wave, victory, defeat) with legal-only
  transitions, once-per-change `onChange`, ordered `history`, terminal detection,
  and `reset()`.
- `src/game/systems/MovementSystem.ts`: pure movement logic — reachable-tile
  range (BFS within a budget), shortest-path finding, and legality checks, all
  querying `GameMap.isWalkable` and respecting caller-supplied occupancy.
- `src/game/entities/Hero.ts`: pure hero model with position and the MVP
  "movement + one action" per-turn economy (`moveTo`, `resetForNewTurn`, budget).
- `tests/movement.test.ts` (11 tests) and `tests/turns.test.ts` (10 tests):
  movement range/path/legality/purity and turn ordering/hero economy.
- Config colours for movement range, path preview, active hero, and pending move.

### Changed
- `src/game/scenes/BattleScene.ts` rebuilt for Phase 2: runs the `TurnSystem`
  with an on-screen banner and phase-order log; places two heroes from map data;
  during the player phase supports hero selection, movement-range display, path
  preview, confirm/cancel movement, and an End Turn control (button or `E`) that
  cycles the phases and resets heroes. Enemy tokens now block hero movement.
- `src/game/config.ts`: added the Phase 2 colour entries.
- `vite.config.ts`: chunk-size warning limit raised 1500 → 2000 kB (Phaser
  bundle; cosmetic, see DECISIONS D-022).
- `index.html`: browser tab title made version-neutral ("Fantasy Tower Defense").
- `src/game/scenes/MainMenuScene.ts`: subtitle updated to Phase 2.

### Verified
- `npm install` (0 vulnerabilities), `npm run typecheck`, `npm test` (41/41),
  `npm run build` (no warning), and `npm run dev` all pass.

## [0.0.2] — 2026-07-21 — Phase 1: Grid, Camera, and Input Prototype

### Added
- `src/game/data/testMap.ts`: a data-driven test map authored as editable
  "string art", plus a `parseMapRows` parser (validates row width and characters).
- `src/game/systems/GameMap.ts`: pure map logic — tile-type queries,
  walkable/blocked checks, tile roles, `describe()`, and `isSelectable()`.
- `tests/gameMap.test.ts`: 11 tests for map parsing and selection rules.
- Distinct rendering of floor vs. wall tiles, and a multi-line debug overlay
  showing hovered/selected coordinates, tile description, and occupant.
- Click-to-select for valid floor tiles; rejection flash for walls/off-map clicks.

### Changed
- `src/game/scenes/BattleScene.ts` rebuilt as the Phase 1 grid/input prototype;
  loads the test map, centres the grid, and enforces selection rules.
- `src/game/config.ts`: grid dimensions removed (the map now defines them); added
  floor/blocked/rejected tile colours and a top-margin constant.
- `src/game/scenes/MainMenuScene.ts`: subtitle updated to Phase 1.

### Removed
- `src/game/data/placeholderMap.ts` (superseded by `testMap.ts`).
- Phase 0's temporary "click hero then move anywhere" interaction (replaced by
  proper tile selection; real movement is Phase 2).

### Verified
- `npm install` (0 vulnerabilities), `npm run typecheck`, `npm test` (20/20),
  `npm run build`, and `npm run dev` all pass.

## [0.0.1] — 2026-07-21 — Phase 0: Project Definition and Technical Scaffold

### Added
- Initial Phaser 3 + TypeScript + Vite project scaffold.
- Strict `tsconfig.json` and `vite.config.ts` (with Vitest test config).
- `.gitignore` excluding `node_modules`, `dist`, secrets, and OS/editor files.
- `index.html` entry page and `src/main.ts` game bootstrap with responsive scaling.
- Scenes: `BootScene`, `MainMenuScene`, `BattleScene`.
- `MainMenuScene`: title screen with clickable/keyboard START.
- `BattleScene`: interactive test screen with tile grid, spawn/exit markers,
  placeholder hero and enemy markers, hover highlighting, debug readout, and
  select-then-move interaction for the hero.
- `GridSystem`: pure (Phaser-free) coordinate conversion and bounds logic.
- Placeholder map data in `src/game/data/placeholderMap.ts`.
- Vitest suite: 9 tests covering grid coordinate conversion, bounds, and helpers.
- npm scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`.
- Documentation: `README.md`, `PROJECT_STATUS.md`, `DECISIONS.md`,
  `KNOWN_ISSUES.md`, `CONTENT_SOURCES.md`, `PHASE_HANDOFF.md`.

### Verified
- `npm install` (0 vulnerabilities), `npm run typecheck`, `npm test` (9/9),
  `npm run build`, and `npm run dev` all pass.

### Not included (deferred to later phases)
- Combat, pathfinding, turn engine, shop/gold, progression, saving, Firebase,
  multiplayer, final art/audio.
