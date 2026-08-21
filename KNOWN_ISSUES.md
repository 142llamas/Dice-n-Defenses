# Known Issues and Limitations

## Open bugs (confirmed by Kevin, not yet fixed)

(none currently)

## Still need Kevin's playtest confirmation

Every item below is **(headless-verified, not yet played)** unless noted
otherwise — typecheck/tests/build all pass, but Kevin hasn't seen it in a
real browser battle yet. Ordered newest first.

### KI-097 — D-146: smart AoE/breath positioning + self-defense (provoked retaliation)
- Smart positioning: get a legendary AoE enemy (Ashen Sovereign, The Hollow
  Empress) in range of 2+ spread-out heroes — confirm it steps to a tile
  that hits both instead of marching straight at the nearest.
- A minion-tier AoE enemy (Cave Drake, Frost Warden) should NOT reposition —
  unchanged from before D-146.
- With only one hero nearby, a qualifying legendary should advance normally,
  no repositioning quirk.
- Self-defense: hit a sieging enemy (Juggernaut, Siegebreaker) or a
  trap-disarming enemy (Saboteur, Warren Stalker) with a hero already in its
  attack range — confirm it fights back for exactly one phase, then resumes
  its priority action.
- Self-defense should NOT fire if the hero who hit it isn't within the
  enemy's own attack range.
- An `ignoresHeroes` pure runner (Sprinter, Bolt Runner) should never
  retaliate no matter how many times it's hit — deliberate exemption, not a
  bug.
- Known limit: self-defense only fires when a hero is already in range at
  the start of the enemy's turn — a reactive interrupt, not a chase.

### KI-096 — D-145: real siege wall-targeting
- A siege enemy (Siegebreaker, Battering Brute) with no wall already in
  reach should walk toward a destructible wall that shortens its route,
  then attack it at normal siege damage once in range.
- With two walls on the board, it should go for the one that actually
  helps, not the irrelevant one.
- A wall far outside its current movement reach shouldn't distract it.
- Known limit: `siegeTargeting: "committed"` exists but isn't assigned to
  any roster enemy yet — every siege enemy currently re-evaluates every
  phase.

### KI-095 — D-144: drag-and-drop hero move
- Plain click-to-move must still work identically for someone who never
  drags.
- Click-and-hold a hero token: it should detach and follow the pointer, the
  move-range highlight stays visible, and a live "N tiles" readout follows
  the cursor.
- Dropping on a reachable tile should move the hero there with a tween (not
  an instant snap).
- Right-click while dragging should pin a waypoint (no native browser
  context menu); a second right-click should add another pin, not replace
  the first.
- Dragging/pinning past the movement budget should show a visible "too
  far" cue and snap back on release without deselecting the hero.
- Picking up and releasing on the hero's own tile (no pins) should be a
  silent no-op.
- Esc during a drag should snap the token back and keep the hero selected.
- Dragging a preview near a stealthed enemy/undisguised Mimic shouldn't
  reveal it — only an actual drop within sense range should.
- Known limits: no fog-of-war was added (reuses existing stealth-reveal
  only); dropping onto an enemy/structure gets the generic rejection, no
  custom wording; no hover-only preview outside an actual drag.

### KI-094 — D-143: enemy-side move-attack-move + Sprint AI
- An enemy that lands a forced-fight attack with movement left over should
  keep walking afterward (hit-and-run) instead of standing still.
- Known limit: `EnemyDefinition.sprints` (double movement on a
  non-fighting phase) has no roster enemy using it yet — no in-game way to
  observe Sprint without a debug override.

### KI-093 — D-141: diagonal movement
- A hero's move-range/path preview should visibly include diagonal tiles;
  an enemy should sometimes cut a corner diagonally toward the exit.
- Confirm nothing renders wrong (a token gliding through a wall corner,
  etc.) — the no-corner-cutting rule should prevent this but is
  headless-verified only.
- (The Manhattan-vs-diagonal range seam this entry used to flag was
  resolved by D-142 — a diagonally-adjacent hero/enemy now correctly
  attacks at range 1. Still worth one specific look: does that case now
  visibly resolve as a basic attack in a real battle?)

### KI-092 — D-139/D-140: Enemy AI/Movement Redesign core (advance-by-default, forced-melee-only-when-boxed-in, per-enemy Aggressiveness)
- Does a boss actually read as "racing the clock" now? Does a low-aggro
  minion routing around a hero read as intended rather than "the enemy is
  ignoring me"?
- Known limit: no roster enemy currently uses the top-end
  aggressiveness-100 "actively hunts a visible hero" behavior — implemented
  and unit-tested, but nothing shipped exercises it.

### KI-091 — D-138: Test Mode
- Main Menu → Test Mode should open a map/wave-count picker with
  everything unlocked, into normal Character Creation.
- In battle, an F9 "Debug Menu" button (bottom-right) should be visible
  ONLY in Test Mode (absent everywhere else) with Skip Wave / No-Fail
  Stronghold toggle / Spawn Enemy / Paint Terrain / Set Status.
- Skip Wave: clears every enemy instantly, no reward gold, proceeds like a
  real clear.
- No-Fail Stronghold: toggling it ON should prevent Defeat even at 0
  Integrity; OFF should restore normal loss.
- Spawn Enemy: a paginated full-roster grid; picking one and clicking
  tiles should spawn real, fully-functional tokens.
- Paint Terrain: picking a type and painting tiles should change color
  immediately (and the "pit" ✕ glyph should appear/disappear correctly).
- Set Status: applying/clearing a status via two clicks on the same
  chip+target should toggle the on-token badge, including on a
  still-hidden stealth enemy.
- Keyboard: Tab/arrow navigation should work in the debug picker grids the
  same way Build/Gear's grids already do.
- Known limits: terrain painting has no placement validation (deliberate);
  a debug-applied status uses a fixed 99-turn duration; Skip Wave awards no
  reward gold.

### KI-090 — D-134/D-135/D-136: real SRD 5.2.1 spell-preparation economy (all 3 phases)
- Character Creation: every caster column should show a "Spells" row
  ("N/A" for Fighter/Rogue/Barbarian/Monk/Paladin/Ranger; "Auto-fill (click
  to customize)" for the rest).
- The picker wizard: Wizard gets 3 screens (Spellbook → Cantrips →
  Prepared, prepared list drawn only from the chosen spellbook); other
  casters get 2 (Cantrips → Prepared).
- Editing a Wizard's spellbook after picking prepared spells from it
  should silently prune any now-stranded prepared picks.
- Save & Close should persist the exact picks on reopen; Cancel should
  discard edits.
- In battle — Long Rest: eligible casters get a "Prepared Spells" (+
  Cantrips for Wizard) re-pick screen pre-checked with their current
  selection; non-casters/Paladin/Ranger never see it.
- In battle — level-up: Sorcerer/Bard/Warlock get a recurring
  cantrip-swap + prepared-spell-swap opportunity every qualifying
  level-up (not just once); Cleric/Druid get only the cantrip-swap; "Keep
  current" should be a fast no-op.
- A hero on "auto" Plan Levels mode should never see a spell-swap popup at
  either trigger.
- Known limits: Paladin/Ranger get no spell picker anywhere (empty
  eligible pool, by design); a Wizard's spellbook itself never grows at
  Long Rest, only what's prepared from it; no Character Creation "Plan
  Levels" integration for the recurring swap.

### KI-089 — D-133: level-by-level Character Creation planner
- The "Plan Levels: Off" row should appear below Starting Level with no
  overlap on the rows below it.
- Mode-select overlay: Auto-follow / Prompted / Always fresh / Cancel,
  each behaving as named.
- "Prompted" should walk a Fighter through Subclass (lvl 3) then ASI (lvl
  4, both raise-modes + real eligible feats including Fighting Style); a
  feat with a sub-choice (Grappler, Magic Initiate) should prompt a
  follow-up screen; Back/Skip should work as expected.
- A Wizard/Warlock planned out to their late-game picks (Spell
  Mastery/Signature Spells/Mystic Arcanum) should see real eligible
  spells, not an empty list.
- After Save & Close the row should read "Plan Levels: Auto/Prompt";
  reopening should show prior picks still selected.
- Changing a hero's class should reset its plan to "Off".
- In battle — Auto mode: a fast-forwarded high-Starting-Level hero should
  already have its planned pick applied, and a later real level-up for the
  same slot should show NO popup.
- In battle — Prompted mode: the usual popup should appear with a
  gold-outlined "★" default matching the plan, but every other option
  should still be pickable.
- A hero with no plan at all should behave exactly as before D-133.

### KI-088 — D-132: AC/damage visibility
- Selected hero's status-line entry should show `AC {n}` right after HP;
  other heroes unaffected; Esc should remove it.
- Hover tooltip on any hero (mouse or keyboard cursor) should show
  name/HP/AC.
- Hover tooltip on an enemy with no hero selected: HP/AC only, no hit%.
- Hover tooltip on an enemy in range with a hero selected: adds a "{n}% to
  hit" line that responds live to AC/Advantage changes without actually
  consuming anything (Lucky, Vex, Boon of Fate must NOT be spent by
  hovering).
- Hover tooltip on an out-of-range enemy: HP/AC but no hit% line.
- Hovering a still-hidden stealth/Mimic enemy should show no tooltip at
  all.
- Known limits: no hit% preview while aiming an ability/spell
  (basic-attack target only); no tooltip for structures/traps.

### KI-087 — D-131: full damage-type mechanical engine
- Fire resistance should roughly halve damage (Cave Drake, Cinder Wretch,
  Bomber Beetle vs. Fire Bolt/Burning Hands/Fireball).
- Fire immunity (Cinderlord, Ashen Sovereign) should zero out fire damage
  but still log as a landed hit.
- Radiant vulnerability (The Hollow Empress, Coin Wraith) should roughly
  double Sacred Flame/Guiding Bolt damage.
- A saving-throw spell (Fireball) into a resistant target should also show
  halved post-save damage — exercises the SavingThrowSystem hookup.
- Cast-flourish/death-fade colors should reflect the real damage type
  (e.g. Magic Missile reads pale force, not generic purple).
- A poison-immune construct (Basalt Colossus, Gravemaw, Ironhide,
  Juggernaut) should take 0 from Poison Spray.
- Known limits: only 47 of ~198 castable spells carry a real damage type;
  only 24 of ~63 enemies got resistance/vulnerability/immunity data; no
  hero-side damage resistance exists.

### KI-086 — D-130: gear-purchase wording, level-up popup, live Game Speed, two-tier battle log
- Gear (G) hint text should read as a purchase flow ("...click a hero to
  BUY it...") both before and after picking an item; the proximity-lock
  message should mention moving to a Shop tile.
- A level-up with no ASI/subclass/spell pick should now show a "{hero}
  reaches level {N}!" popup (was log-line-only before); a level-up WITH a
  real choice should show only its own overlay, not both; a Starting-Level
  hero entering already-leveled should get no popup flood.
- Main Menu control should read "Game Speed: Normal/Fast/Instant";
  pressing S in battle should change it live and log the change; the
  setting should persist back to the Main Menu control.
- Pressing L should open a "Technical Log" overlay with full dice-roll
  detail for every attack/save type (hero, enemy, retaliation,
  ability/spell, summon); the existing short plain-English combat log
  should stay unchanged underneath it.
- Known limits: the technical log covers attack/save rolls only, not
  skill checks; no purchase-only stash/inventory exists (single
  click-item-then-click-hero flow is deliberate).

### KI-085 — Kevin's D-128/D-129/D-130 playtest report follow-ups
- Compendium tab/class-button labels, Free Play's Map/Finale Boss button
  labels, and Character Creation's subclass-picker message should all now
  stay fully inside their own buttons (D-128 text-overflow fixes) — worth
  a quick re-look since none of these three has been individually
  re-confirmed since the fix.
- Starting Level control (D-129): each hero column's "Level: N" cycles
  1-20 with the stats preview updating; "Team Level: N (all heroes)"
  should set every slot at once; starting a battle at level 8+ should
  enter combat already at that level (HP/attack/spell slots/any
  auto-picked subclass or ASI); a fresh party should default to Hero 1 =
  Human, Heroes 2-4 = AI.

### KI-084 — D-127: nonmagical damage-type resistance, Blindsense/Feral Senses, charge-based items, ability-score-setting items
- A Swarm enemy (Rat Swarm, Locust Swarm) should take roughly half damage
  from a mundane weapon, full damage from an enchanted `+1/+2/+3` one.
- A crit against a Swarm with the Boon of Irresistible Offense (level 19+)
  should NOT be halved.
- A level-14+ Rogue/level-18+ Ranger should be able to target a
  still-hidden stealth enemy (still shown as "?") while other heroes
  cannot.
- A Wand of Magic Missile equipped on a non-caster should show a "7/7
  charges" spell entry, tick down, refuse an 8th cast, and refill on Long
  Rest.
- Gauntlets of Ogre Power / Amulet of Health / Headband of Intellect
  should visibly change attack damage / max HP (adding to current HP, not
  a full heal) / spell save DC respectively, with no effect on an
  already-higher score.

### KI-083 — D-126: UI-layout audit-and-fix
- Compendium's 12 class buttons and 10 category tabs should render fully
  on-canvas.
- Map Builder's 8 terrain swatches should render fully on-canvas.
- Free Play's longest map/boss names should wrap cleanly inside their own
  buttons with no overlap.
- Browse Shared Maps (needs Firebase + 6+ published maps) should
  paginate 5 at a time with working Prev/Next and a "Page N/M" label.
- The core Battle HUD, especially on Frostbound Hollow (narrowest/tallest
  map), should never let the status line collide with the combat log.
- Known, unfixed edge case: `renderAsiPrompt`'s title can mathematically
  overlap its own button row at 15+ simultaneous choices (Epic Boon
  ability-picker, level 19+) — no run currently reaches that level.

### KI-082 — D-125: Reckless Attack, Preserve Life, skill checks/hero stealth, Spell Mastery/Signature Spells, Mystic Arcanum
- Barbarian's Reckless Attack (T) should grant Advantage to both the
  Barbarian's next attack AND enemy attacks against it until its next
  turn (visible "Reckless" badge).
- Life Domain Cleric's Channel Divinity: Preserve Life (T) should restore
  HP across up to 5 allies (each capped at half their max), recharging on
  either rest type.
- Ranger's Vanish / Rogue's Hide should roll Stealth vs. a DC and, on
  success, make that hero untargetable by enemies until it next acts.
- Monk's Empty Body (level 18+) should hide the hero with no roll,
  spending the whole Ki pool + action.
- Wizard's Spell Mastery (18)/Signature Spells (20) and Warlock's Mystic
  Arcanum (11/13/15/17) should auto-open a picker at the right level
  showing real eligible spells, then make the chosen spell castable at 0
  slots (recharging on Short Rest for Signature Spells, Long Rest only
  for Mystic Arcanum).

### KI-081 — D-124: Indomitable, Danger Sense, Evasion, Elusive, The Fiend's Expanded Spell List, Intimidating Presence, Retaliation, Cutting Words
- Fighter's Indomitable (9+) should reroll a failed save once per battle
  (no dedicated log line yet — worth flagging as a minor UI gap, not a
  logic bug).
- Barbarian's Danger Sense (2+) should resist forced saves noticeably more
  often over several hits.
- Rogue/Monk's Evasion (7+) should roughly halve a FAILED forced save's
  damage (no distinguishing log suffix yet).
- Rogue's Elusive (18+) should make a stealth enemy's ambush hit land
  noticeably less reliably.
- The Fiend Warlock should gain Burning Hands/Command/etc. in its
  spellbook at the right levels; Starbound Patron should not.
- Path of the Berserker's Intimidating Presence (10+) and Retaliation
  (14+), and College of Lore's Cutting Words (3+), should each show their
  effect in the combat log at the expected trigger, and should NOT trigger
  for the other subclass in the same class.

### KI-078 — D-122: spell-cast and death animations
- Two different spells of the same general type (e.g. two attack-roll
  bolts) should still look visually distinguishable from each other, not
  identical.
- An enemy killed by fire should fade differently than one killed by a
  plain attack, and differently again from cold/poison/necrotic/radiant.
- "Instant" animation speed should skip both the cast and death flourish
  outright.

### KI-077 — D-121: basic-attack lunge
- The lunge should respect the animation-speed setting — "Instant" should
  skip it outright, not play at a minimum speed.
- No visual glitch expected when a status badge/boss banner/aura ring is
  present nearby during the lunge.
- Known limit: only the single basic Attack action gets the lunge — Extra
  Attack's extra swings, off-hand attacks, Cleave's second target, and
  every spell/ability attack still show only the existing hit-flash.

### KI-075 — the stylized parchment dialogue box (D-119)
- Does the drawn parchment panel (fill + mottling + double border)
  actually read as parchment, or does it need more texture/contrast?
- Is the placeholder NPC-portrait silhouette an acceptable stand-in?
- Layout: portrait/name-plate/text/Continue button positioning, and no
  collision with Compendium's own tab row.
- The narrator/PC line (no portrait) should read as visually distinct
  from an NPC line (portrait).
- Known limit: `PORTRAIT_MANIFEST` is empty — nothing to look at beyond
  the placeholder until real art is supplied.

### KI-073 — Phase 25: ten structure tiers, opportunistic wall-bash AI, trap-disarming Saboteur/Warren Stalker (D-116)
- All ten new shop items should build and function correctly (Wicket
  Gate/Portcullis let heroes through; Snare Wire/Mangler Trap/Net
  Snare/Storm Lance should damage the right movement type; Low Perch
  should NOT grant range — only Sky Bastion grants both).
- The Shop grid's new 2-page pagination should work like Gear's already
  does.
- A normal (non-siege) melee enemy with no hero reachable should visibly
  bash a blocking wall instead of standing idle.
- Saboteur/Warren Stalker (Free Play/Bestiary only, not in any campaign
  wave yet) should disarm a trap instead of triggering it.

### KI-072 — Phase 24: sand tile + five new structures/traps (D-115)
- Sand should refuse a Build-mode placement (red ✗, "too loose to build
  on") while still being freely walkable, and should render as visually
  distinct sand on both the real board and the Map Builder palette.
- Palisade should break in 1-2 hits vs. a siege enemy; Bulwark should
  take noticeably longer than a plain Barricade.
- Watchtower's bonus should apply equally to a melee AND a ranged hero
  standing on it (not the Ranged Perch's range-only bonus).
- Frost Trap should restrain (log names "Frost Trap," not "Spike Trap");
  Bear Trap should hit once then vanish from the board.
- Every trap type should log its own real name (Sky Snare, Tangle Root,
  Web Patch, Acid) instead of all reading "Spike Trap."
- The now-12-button Build shop grid should render with no overlap/clipping.

### KI-071 — Phase 23: pit hazard, hero-affecting terrain, dynamic terrain, four new maps (D-114)
- A push effect (weapon mastery or forced-move spell) shoving an enemy
  into a pit edge on Shattered Causeway should remove it from the board
  with a "falls to its doom" log line.
- Terrain should now render as visually distinct on the real battle board
  (cliff/water/fire/acid/pit), not just in the Map Builder.
- On the four opted-in maps, a HERO standing on fire/water/acid should
  take the same damage/status an enemy would; Emberford/Saltmere should
  remain unaffected.
- The Drowning Vale's tide (warning → floods at wave 3 → recedes at wave
  6) and Cinderfall Rift's bridge collapse (warning → collapses at wave 4)
  should both play out with their own log lines and stay usable/
  reroutable, never impassable/stuck.
- Frostbound Hollow: a flyer should cross the central ridge directly
  while a ground enemy detours around it.
- The Map Builder's new "Pit" palette option should paint correctly and
  be caught by the spawn-can-reach-exit validator.
- The Free Play map row (now 7 buttons) should render without overflow.

### KI-070 — Phase 22: magic-item catalog, `+1/+2/+3` enchant overlay, loot-drop system, level-scaled shop (D-113)
- Cape of Billowing (Back slot) should show an animated flowing-cape
  visual trailing the hero's token as it moves.
- A `+N` enchanted item should show up via a loot drop with a log line
  and a visible attack-number change.
- Most minion kills should produce NO drop (12% chance); miniboss/boss/
  legendary kills should drop more often and at better tiers.
- An item with nowhere to equip should auto-sell for gold with its own
  log line instead of vanishing silently.
- Emberford Reach vs. Saltmere Shallows loot pools should feel
  thematically distinct.
- The shop should gate rare-and-up items behind hero level (4/8/13) on
  the same grid.
- The new "Back" gear-slot row should render cleanly; new procs (Flame
  Tongue, Frost Brand, Dagger of Venom, Bracers of Archery, Ring of Free
  Action, etc.) and the two new persistent potions (Speed, Resistance)
  should behave as documented.

### KI-069 — Phase 21: hero-side status effects + 12 more enemy mechanics, 24 new enemies (D-112)
- A hero afflicted with poisoned/silenced should show an on-token badge
  matching the enemy style; silenced should block casting/ability use
  only (movement and basic attack still work); poisoned should tick HP
  loss each player phase and correctly trigger Defeat if it's the killing
  blow.
- Spot-check each new archetype's signature behavior: Berserker (hits
  harder as it's hurt), Lifedrinker (heals off hits), Splitter/Carrier
  (spawns splinters on death from ANY death source, not just basic
  attack), Shielded/Reflector (no-sells hits until broken, Aegis Bearer
  reflects), Explosive (AoE burst on death), Gold Thief (steals gold),
  Teleporter (jumps distance), Mimic (disguised until a hero moves
  adjacent), Healer/Healer-Debuffer (heals + poisons), Anti-caster
  (silences), Multi-Phase Boss (Sundered King changes behavior at 50%
  HP), Swarm (stacks tiles, damage drops when Bloodied).
- The now-13-button Free Play boss row should render without overflow.
- Known limit: no on-token indicator for a Shielded enemy's remaining
  ward or a Multi-Phase Boss's threshold crossing (log-line only).

### KI-068 — Phase 20: siege/stealth/aura/reinforcement/treasure/AoE/runner enemy mechanics, 21 new enemies (D-111)
- Siege enemies (Siegebreaker, Battering Brute, Juggernaut, Ashen
  Sovereign) should attack an adjacent structure instead of a hero,
  visibly break it, then resume normal behavior.
- Stealth enemies (Shadowfang, Nightblade) should be unclickable (dim "?"
  token) until they strike, then become permanently visible/targetable.
- Aura/captain enemies should render a ring and visibly buff/debuff a
  nearby ally until the captain dies or leaves.
- Reinforcement callers should actually spawn new enemies on cadence with
  a log line.
- Treasure-laden enemies should log bonus gold separately and add it to
  the HUD total.
- AoE/breath enemies should hit/save an entire clustered party at once,
  not just the nearest hero.
- Pure runners (Sprinter, Bolt Runner) should walk past heroes without
  ever attacking.
- The Bestiary's new LEGENDARY section and the now-10-button Free Play
  boss row should render without overflow.

### KI-067 — Phase 19: real dual-wielding + Two-Weapon Fighting/Nick (D-110)
- Equipping a second Light weapon should land in the off-hand (shield
  slot) automatically, and be refused outright if a real Shield already
  occupies it.
- A basic attack with two Light weapons equipped should auto-fire a
  second "off-hand" attack, consuming the bonus action (blocking Second
  Wind/Cunning Action etc. that turn).
- Nick-mastery off-hand weapons (Dagger, Light Hammer, Sickle, Scimitar)
  should fire the off-hand attack WITHOUT consuming the bonus action.
- Two-Weapon Fighting should add the ability modifier to off-hand damage;
  without the feat, off-hand damage should be the flat weapon number only.
- The Two-Handed/Shield conflict gate should still block correctly in
  both directions.

### KI-066 — Phase 18: 13 new feats + enforced prerequisites (D-109)
- The ASI/feat picker should correctly filter by prerequisite (Grappler
  needs Str/Dex 13+; Fighting Style feats only for Fighter/Paladin/
  Ranger; casters never see Fighting Style; Epic Boons only at level 19+).
- Picking Grappler or an Epic Boon should open a follow-up ability-picker
  limited to that feat's allowed scores, and should be able to exceed the
  usual 20 cap for a boon.
- Magic Initiate should show a class-list picker, grant 2 cantrips + 1
  leveled spell castable even on a non-caster (once per Long Rest), and
  not re-offer an already-taken list.
- Grappler in combat should sometimes restrain on a landed hit and grant
  Advantage against a restrained target.
- Boon of Combat Prowess/Boon of Fate (level 19+, hard to reach in a
  10-wave run) should convert a miss to a hit / auto-boost an attack per
  rest.

### KI-065 — Phase 17: real weapons/armor/weapon-mastery pass (D-108)
- Equipping a heavier weapon (Dagger → Greatsword) should visibly raise
  basic-attack damage; a Longbow should extend range to 3 tiles;
  unequipping should restore exact original numbers.
- A Versatile weapon (Longsword) should use the bigger die with no
  Shield, the smaller die + AC bonus with one.
- Two-Handed + Shield should refuse in both directions.
- Real armor should replace the old AC formula (light keeps Dex bonus,
  heavy caps it out completely at its flat value); a Shield should still
  add +2 on top of either.
- Each weapon mastery should show its real effect over a few swings: Push
  (knockback 2 tiles), Sap (disadvantage on target's next attack), Slow
  (reduced move range), Topple (CON save to knock down), Graze (chip
  damage on a miss), Vex (better next roll vs. same target), Cleave (hits
  a second adjacent enemy once per turn).
- Known side effect, not a bug: all 48 mundane weapon/armor items joined
  the free starting-gear pool, growing it from ~12 to ~60 — worth
  checking the one-at-a-time cycle picker doesn't feel tedious.

### KI-063 — Phase 12.3: turn-lock ownership (D-103)
- Two-tab coop flow: host clicks Start Battle once full, both tabs land
  in `BattleScene` with correct per-hero ownership.
- Clicking a partner's hero should show "Waiting for {name}'s turn…" and
  refuse selection; your own heroes should behave like solo play.
- `firestore.rules`' coopSessions "start battle" shape is still UNRUN in
  the test suite (standing JDK 21+ limitation — don't re-offer a `winget`
  install).
- Known, deliberate limit: the two clients' boards do NOT converge as
  either side acts yet — no result-broadcast/reconciliation system
  exists. A coop battle will visibly desync the instant either player
  acts; this is expected until a future sub-phase.

### KI-062 — Phase 12.2: cooperative session lobby (D-102)
- Two-tab flow: Create in one tab, Join with the code in the other — both
  participant lists should update live with no manual refresh.
- The join-code text field (this project's first free-text input) should
  position correctly at different window sizes, accept paste, and
  auto-uppercase/strip invalid characters.
- Join failures should show the right message (bad code, session already
  full, silently rejoining your own session after a refresh).
- `firestore.rules`' coopSessions block is still UNRUN in the test suite
  (same standing JDK 21+ limitation as KI-063).

### KI-048 — Phase 11.10: Map Builder + public map sharing (D-085)
- Painting terrain/marker tiles, cycling map name/size, and the
  validation checklist (spawn/exit/hero-start counts, route-to-exit)
  should all reflect what's actually drafted.
- Playtest button should launch a real battle on the drafted map.
- Publish (Firebase-only) should push to Firestore's `sharedMaps/` and
  enforce the 5-published-maps-per-author cap (updates to an
  already-published map should still go through).
- Browse Shared Maps should list/paginate ("Load more") and Start should
  launch a battle on a fetched map.
- Rules tests are written but still UNRUN — same standing JDK 21+
  limitation as KI-047 (don't re-offer a `winget` install).

### KI-047 — Phase 10: Firebase sign-in/cloud-save sync UI (D-084)
- Hosting/deploy itself is proven (live and repeatedly redeployed at
  dice-n-defenses.web.app) — what's NOT confirmed is the sign-in/sync UI
  specifically:
- Main Menu's Account control should show "Sign in with Google" when
  anonymous, switch to "Signed in: {name}" after a successful popup
  sign-in, and silently re-establish a new anonymous session on sign-out.
- Load Game's "Sync with Cloud" button should stay disabled until signed
  in with Google, then pull/merge/push saves.
- Saving/updating/deleting a party while signed in with Google should
  mirror to Firestore (`users/{uid}/saves/`).
- Rules tests are written but still UNRUN — the Firestore emulator needs
  JDK 21+, and Kevin's IT policy blocks installing one on this machine.
  Standing limitation — don't re-offer a `winget` install.

### KI-034 — full keyboard-only play (D-066)
- Arrow keys should move a tile cursor (clamped at map edges); Enter/Space
  should act on whatever it's over, matching a mouse click exactly
  (select, move, attack, ability-target, build/refund, equip).
- In Build/Gear mode, arrow keys should default to navigating the item
  grid; Tab should switch between grid-focus and board-cursor-focus.
- The status hint line should reflect current focus ("Tab: aim on board"
  / "Tab: pick item" / "arrows+Enter/Space: keyboard play").
- Arrow keys/Space should not also scroll the browser page while the
  canvas has focus.
- A full battle should be completable start-to-finish with no mouse at
  all.

## Known, deliberate design limits (not bugs)

- **KI-004 — Placeholder art only.** Coloured shapes and text; no final
  art or audio.
- **Enemies don't avoid traps**, by design (D-039) — pathfinding has no
  trap awareness, so a trap can actually land a hit on a passing enemy.
- **KI-011 — Attacks/abilities ignore line of sight.** Range is pure
  distance; walls never block a shot.
- **KI-029 — No volume control (or audio system) exists.** Nothing to
  control yet — a volume slider will come with real sound effects/music,
  not before.
