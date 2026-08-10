# Project Status

## Phase 25 — Cheap/Expensive Structure Tiers, Opportunistic Wall-Bash AI, Trap-Disarming Saboteurs (D-116) — DONE this session

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
