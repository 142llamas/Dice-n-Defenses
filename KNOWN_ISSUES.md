# Known Issues and Limitations

## Open bugs (confirmed by Kevin, not yet fixed)

None currently — the two bugs Kevin confirmed 2026-08-21 (waypoint pinning,
Main Menu title/corner-control overlap) were fixed by D-149; see KI-101
below for their own re-confirmation checklist. The two bugs Kevin confirmed
2026-08-22 (Main Menu corner controls overlapping the frame border, and
Character Creation's Start/Back buttons rendering off-screen entirely after
"New Game") were fixed by D-159 — a revert of D-157's `Scale.RESIZE`
cutover back to `Scale.FIT`; see KI-109 below for what broke and why.

## Still need Kevin's playtest confirmation

Every item below is **(headless-verified, not yet played)** unless noted
otherwise — typecheck/tests/build all pass, but Kevin hasn't seen it in a
real browser battle yet. Ordered newest first.

### KI-110 — D-158: KI-034's redesign — hero roster strip, decluttered status line, hover tooltips
- The bottom-of-grid area should now show real boxed hero widgets (name/
  level, a colored HP bar with exact numbers, a green border on whichever
  hero is currently selected) instead of one packed line of text. A downed
  hero's box should read "(down)" with no HP bar. The HP bar's color should
  shift green → yellow → red as a hero takes damage.
- Selecting a hero should show its AC/move-readiness/act-readiness/gear
  count on a small line inside ONLY that hero's own box — box height should
  stay constant whether or not it's currently showing that line (no layout
  jump on selection change).
- **Keyboard-only play — re-confirm KI-034's own checklist under this
  rewrite specifically, not just assume it still holds:** arrow-key cursor,
  Enter/Space parity with a mouse click, Tab switching between grid-focus
  and board-cursor-focus in Build/Gear/Test-Mode-debug grids, no page-scroll
  on arrows/space, and a full battle completable with no mouse at all.
- In Build or Gear mode, hovering an item (mouse) OR moving keyboard focus
  onto it should show a tooltip near that item with its name/cost/
  description — try BOTH input methods specifically, since the item
  description used to live in the always-visible hint text and now only
  ever appears in this tooltip.
- Pressing Tab to enter the item grid (not just arrowing within it) should
  immediately preview whatever item is already focused — this used to be a
  gap (fixed as part of this same change, never actually shipped broken,
  but worth confirming it truly shows immediately, not just on the next
  arrow key).
- A rejected click (e.g. walking into an out-of-range tile, trying to build
  without enough gold) should still show its message, in a small line under
  the roster strip — and that message should clear on your next real action
  the same way it always has.
- `Enemies: N` now lives in the top-left HUD area, next to Stronghold
  Integrity/Gold, instead of the old bottom line.
- No overlap anywhere on Frostbound Hollow specifically (9 rows, the
  tallest built-in map, and the recurring HUD-tightness stress case
  throughout this file's own history) — the roster strip changed the pixel
  budget below the grid.
- Known, deliberate tradeoff (not a bug): the old hint's "blue = move · red
  = attack", "Ability (Q) · Potion (P) · Character (C)", "Confirm or Cancel
  the move", and the universal "1-4 select hero / arrows+Enter/Space /
  H / S / L" reminders are all GONE, not shortened — every one of them
  either restates a button label already visible on screen or a board
  highlight already visible the instant a hero is selected. The "How to
  Play" overlay (H, any time) is the intended fallback for a first-timer or
  anyone who forgets, not a live reminder anymore.

### KI-109 — D-157: responsive-canvas roadmap step 3 — the actual `Scale.RESIZE` cutover — REVERTED by D-159, see KI-034-style note below
- **RESOLVED 2026-08-22: reverted, not fixed-in-place.** Kevin's first real
  in-browser pass found this broken in two concrete ways: Main Menu's
  Settings/Sign-in corner controls overlapped the frame border, and
  Character Creation's Start/Back buttons were completely invisible
  (rendered below the visible canvas) after clicking "New Game." Root
  cause: `Scale.RESIZE` removes the automatic shrink-to-fit `Scale.FIT` was
  quietly providing — every scene's D-154/155/156 resize handling only ever
  recentered content HORIZONTALLY; nothing handled a real browser window
  SHORTER than `GAME_HEIGHT` (1080px, common on laptops), so content built
  assuming that much vertical room ended up below the fold with no scroll.
  D-159 reverted `main.ts` back to `Scale.FIT` and removed `BattleScene`'s
  now-pointless scale-mode-swap code. See D-159 in `DECISIONS.md` for the
  full root-cause writeup and what a real fix would need next time
  (vertical reflow, or a larger fixed `Scale.FIT` canvas instead of
  switching modes at all).
- **Confirm the fix**: Main Menu's corner controls should no longer overlap
  the frame border; Character Creation's Start/Back buttons (and everything
  else) should be visible again exactly as before this whole roadmap
  started. Everything else in this checklist below is now MOOT (the
  feature it was testing no longer exists) — kept here only for the
  historical record of what step 3 was attempting.
- ~~Try resizing the actual browser window...~~ N/A — back to `Scale.FIT`,
  resizing the window no longer changes any scene's layout (same as every
  session before this one).
- ~~Start a battle, then resize the browser window mid-battle...~~ N/A —
  `BattleScene` no longer does any runtime scale-mode swapping.
- The `uiTheme.ts`/`tooltip.ts`/`dialogueBox.ts` live-viewport fixes D-157
  also made (reading `scene.scale.width/height` instead of the fixed
  `GAME_WIDTH`/`GAME_HEIGHT` constants) were NOT reverted — harmless
  no-ops under `Scale.FIT`, kept as groundwork for if this is retried.

### KI-108 — D-156: responsive-canvas roadmap step 2 — Map Builder + Character Creation own resize-reactivity
- Both scenes should look and behave IDENTICALLY to before at a normal
  browser window size — still `Scale.FIT`, still a pure regression check,
  not a "does resizing work" check.
- **Map Builder**: build a map from scratch — size cycling, the name field
  (typing/paste/backspace), palette tab switching, and the click-and-drag
  paint tool should all still work exactly as before. Nothing about this
  session's change should be visible.
- **Character Creation**: build a full 4-hero party — all 4 name fields
  (typing/paste/backspace, independently per hero), class/race/gear/subclass
  pickers, ability score controls (both Standard Array and Point Buy),
  Starting Level, the Plan Levels wizard, and the Spells wizard should all
  still work exactly as before. This is the biggest single-scene change of
  the whole roadmap so far — worth a genuinely thorough pass, not just a
  glance.
- Known, deliberate limits (not bugs, see D-156): resizing the browser
  window still doesn't visibly change any scene's layout anywhere in the
  game yet (`Scale.RESIZE` cutover still not done); if a resize happens to
  fire while Character Creation's Plan Levels/Spells wizard overlay is open,
  its full-screen dim backdrop could theoretically show at the wrong size
  until the next click — cannot actually occur under today's `Scale.FIT`,
  since the viewport width never changes regardless of window size.
  **Update (D-157, then reverted by D-159): the `Scale.RESIZE` cutover
  shipped briefly, then got reverted after it broke Main Menu/Character
  Creation in real-browser testing (see KI-109) — back to `Scale.FIT`,
  resizing the window is once again a no-op for every scene's layout,
  matching this note's original text again.**

### KI-107 — D-155: responsive-canvas roadmap step 1 — 5 more scenes converted (Compendium, Character Sheet, Browse Shared Maps, Free Play, Co-op Lobby)
- Every one of these 5 scenes should look and behave IDENTICALLY to before
  at a normal browser window size — this session deliberately stayed on
  `Scale.FIT` (see D-154/D-155), so nothing about appearance should have
  changed. Pure regression check, not a "does resizing work" check (resizing
  the real window still won't visibly do anything yet — that's the
  still-pending `Scale.RESIZE` cutover).
- **Compendium**: browse every tab, including Classes (per-class selector)
  and Spells (per-level selector) with Prev/Next paging — should read and
  page exactly as before. Switch categories/pages, nothing should look
  different.
- **Character Sheet**: select a hero mid-battle, open Character (C) — should
  still pause the battle underneath, open on Stats, and switch cleanly
  between Stats/Spellbook/Hotkeys. Editing a hotkey slot should still work
  identically.
- **Browse Shared Maps** (needs Firebase + at least one published map):
  should load and paginate exactly as before, with no flash of "No maps
  have been published yet" before the real list appears.
- **Free Play**: pick a map/boss/wave-count/minion-source/difficulty and
  Start — should look and behave exactly as before (this scene was never
  restyled with the parchment theme, so it should still look plain, not
  suddenly ornate).
- **Co-op Lobby** (needs Firebase, two tabs): Create Session in one tab,
  Join by code in the other — the join-code field specifically is worth a
  close look, since it now sits in a new repositioning system rather than
  the destroy-and-recreate one every other scene uses. Typing a code,
  pasting one, and pressing Enter to submit should all still work exactly as
  before.
- Known, deliberate limits (not bugs, see D-154/D-155): resizing the browser
  window still doesn't visibly change any scene's layout anywhere in the
  game yet; `MAX_MAP_COLS`/`MAX_MAP_ROWS` are still unchanged (~20x9) —
  actual "bigger maps in battle" still needs `BattleScene`'s own future
  `TILE_SIZE` conversion, not yet started.
  **Update (D-157, then reverted by D-159): briefly shipped, then reverted
  after real-browser testing broke Main Menu/Character Creation (see
  KI-109) — back to `Scale.FIT`, this note's original text stands again.**

### KI-106 — D-154: responsive-canvas foundation (7 scenes), Map Builder click-and-drag paint tool + real map-name field
- **The 7 converted scenes should look and behave IDENTICALLY to before** at
  a normal browser window size: Pause Menu, Settings, Campaigns, Main Menu,
  Load Game, Test Mode, Bestiary. This session deliberately stayed on
  `Scale.FIT` (see D-154), so nothing about their appearance should have
  changed at all — this is a pure regression check, not a "does resizing
  work" check (resizing the actual window won't do anything different yet;
  that's the still-pending `Scale.RESIZE` cutover).
- Bestiary specifically: switch to a non-Minions tab, page to page 2+, then
  resize the browser window (even though nothing should visually change
  yet) — confirm you're NOT silently bounced back to page 1/Minions.
- Main Menu: the title should still correctly avoid overlapping the
  Settings/Account corner controls (D-149's fix, now computed via
  `computeCornerControlsRegion` instead of a hardcoded box) at the normal
  window size; the Account control should still show "Connecting…" briefly
  before resolving to "Sign in with Google" or "Signed in: {name}", not
  jump straight to "Sign in with Google" as a false default.
- **Map Builder paint tool**: click-and-hold on the board and drag across
  several tiles — every tile the pointer crosses while held down should
  paint with the currently-selected palette item, not just the one under
  the initial click. Releasing the mouse button, then clicking a single
  tile elsewhere, should still work exactly as a single click always did.
  Dragging off the grid area (over the palette/buttons) and back onto the
  grid without releasing should resume painting correctly.
- **Map Builder name field**: should now be a real text box (not a
  click-to-cycle button) — typing should work normally, including
  backspace/select/paste; Publish should refuse with "Give this map a name
  before publishing" if the field is blank; Playtest should NOT be blocked
  by a blank name.
- Known, deliberate limits (not bugs, see D-154): resizing the browser
  window doesn't visibly change any scene's layout yet anywhere in the
  game — the `Scale.RESIZE` cutover that would make that happen is
  intentionally not part of this session. `MAX_MAP_COLS`/`MAX_MAP_ROWS`
  are unchanged (still ~20x9) — "bigger maps" in an actual battle needs
  `BattleScene`'s own future `TILE_SIZE` conversion first.
  **Update (D-157, then reverted by D-159): briefly shipped, then reverted
  after real-browser testing broke Main Menu/Character Creation (see
  KI-109) — back to `Scale.FIT`, this note's original text stands again.**

### KI-105 — D-153: real Settings screen (Game Speed + Master/Music/SFX volume + Mute), no audio content yet
- A new "Settings" button (Main Menu's top-right corner, replacing the old
  inline "Game Speed" cycle button) should open a full `SettingsScene` with
  six rows: Game Speed, Master Volume, Music Volume, SFX Volume, Mute All,
  Back. Each volume row should cycle 0%/25%/50%/75%/100% on click; Mute All
  should toggle On/Off.
- From the Pause Menu (Esc mid-battle), the row that used to say "Game
  Speed: {label}" now says "Settings" and should open the SAME screen as an
  overlay (battle stays paused underneath) — Game Speed changed there should
  take effect live, mid-battle, exactly as it did before (D-130).
- **Nothing should be audible** — there is still no music or sound-effect
  asset in this project (KI-029). The controls are real (they set Phaser's
  actual sound-manager volume/mute), just with nothing loaded to hear yet.
  Confirm there's no console error clicking through every row anyway.
- Back (button or Esc) from Main Menu's Settings should return to Main Menu;
  from the Pause Menu's Settings overlay it should return to the (still
  paused) Pause Menu, not skip past it to the battle or Main Menu.
- Settings should persist across a page reload (localStorage, same as Game
  Speed already did).

### KI-104 — D-152: real in-battle pause menu (Resume/Save Party/Save & Exit/Load Game/Exit to Main Menu/Controls/Game Speed)
- **Highest priority: does the pause menu actually pause the battle?** Press
  Esc (with no other overlay/forced-choice open) or click the new "Menu
  (Esc)" button (bottom-left corner) — the battle should visibly PAUSE
  underneath (no enemy turn advancing, no timers ticking), same as
  Character Sheet's own D-148 pause mechanism. "Resume Battle" should return
  to the exact same state, including any hotkey/gear/hero-selection state
  from before.
- "Save Party" should save the current party's build (name/race/class/
  ability scores as they were at Character Creation) to a new or existing
  save slot and show a confirmation line — reload from the Main Menu's Load
  Game to confirm it's actually there. Confirm it does NOT restore this
  battle's own wave/gold/gear picked up mid-battle if reloaded (expected —
  see D-152's own writeup for why).
- "Save Party"/"Save & Exit" should read "(unavailable in Co-op)" and be
  disabled/unclickable during a Co-op battle specifically.
- "Save & Exit" should save then land on the Main Menu with no extra
  warning (since it just saved); "Exit to Main Menu" (no save) should show
  a "progress will be lost" confirm/cancel prompt first; "Load Game" should
  show a similar "this exits the current battle" confirm before actually
  navigating to Load Game.
- "Controls" should show the real current keybindings and a Back button
  that returns to the main menu list (not a full close).
- "Game Speed: {label}" should cycle Normal → Fast → Instant → Normal,
  matching the existing "S" hotkey's own behavior exactly (same setting,
  same persistence).
- Esc from the Controls view or from a confirm prompt should back out one
  level (matching the main battle's own Esc-backs-out-one-step convention),
  not fully close the pause menu in one press.
- A fresh (never-loaded) party's first Save Party this session should
  create a new slot; a SECOND Save Party click in the same pause-menu visit
  should update that same slot rather than creating a duplicate.
- Known, deliberate limits (not bugs): no audio settings (no audio system
  exists — KI-029); no graphics/resolution settings beyond Game Speed; Save
  never captures this battle's own wave/gold/structure progress, only the
  party's build; no cloud-sync push from a pause-menu Save (syncs normally
  next time you save from Character Creation or Load Game).

### KI-103 — D-151: Cape of Billowing recolor + Exit Game control
- A hero wearing the Cape of Billowing should show a deep RED flowing cape
  graphic trailing its token, not the same light green as the
  selected-hero highlight ring.
- Main Menu's bottom-left corner should show an "Exit Game" button.
  Clicking it in a normal browser tab is expected to NOT actually close the
  tab (browsers block this) — confirm the button instead relabels itself to
  "You may now close this tab" and becomes disabled, rather than appearing
  to do nothing.

### KI-102 — D-150: Compendium alphabetization + new Buildings/Traps tabs + Bestiary role tabs
- Compendium's Classes/Subclasses/Races/Feats/Skills/Potions/Status Effects
  tabs should each list their entries alphabetically by name now (Classes'
  own per-class selector row too).
- A new "Buildings" tab should list every wall/gate (alphabetical), then
  every platform (alphabetical), including the two spell-only entries
  (Spectral Wall, Web Patch) marked as not shop-buyable.
- A new "Traps" tab should list every ground-targeted trap (alphabetical),
  then every flying-targeted trap (alphabetical).
- Bestiary should now show four role tabs (Minions/Miniboss/Bosses/
  Legendary); switching tabs should reset to page 1 of just that role, and
  a still-undiscovered ("???") enemy should behave identically to before
  within its own tab.
- Nothing about which classes/races/spells/items a hero can actually pick
  or use in Character Creation/battle should have changed — this was a
  read-only reference-screen reorganization only.

### KI-101 — D-149: waypoint-pinning fix + Main Menu title/corner-control overlap fix
- Right-click-and-hold drag a hero, right-click to pin a first waypoint,
  then right-click again elsewhere — a SECOND pin marker should appear (not
  just the first), and the move-range highlight should visibly shrink/
  reroot from that latest pin rather than staying anchored to the hero's
  own tile with full budget.
- A third+ pin should keep chaining the same way; releasing the left button
  should commit a move that actually routes through every pin in order.
- Main Menu: at the game's normal window size, the "Game Speed" and
  Sign-In/Account controls (top-right) should have visible clearance from
  "FANTASY TOWER DEFENSE" with no glyph overlap — worth a glance at a couple
  different window sizes since the fix is a runtime measurement, not a
  fixed pixel tweak.

### KI-100 — D-148: Battle HUD/actions overhaul (selection-gated panel, level-up deltas, Character Sheet scene with Stats/Spellbook/Hotkeys tabs, generalized tooltips, equip preview)
- **Highest priority: does the Character Sheet scene work at all?** Select a
  hero mid-battle, click "Character (C)" (or press C) — the battle should
  visibly PAUSE underneath (no enemy turn advancing, no timers ticking) and
  the sheet should open. Close it (Esc or the Close button) — battle should
  resume exactly where it left off, with any hotkey edits already reflected.
  This exact pause/resume mechanism has never been used anywhere else in
  this codebase before this session — if it misbehaves (input leaking
  through to the board underneath, the battle not actually pausing, stacking
  weirdly with another overlay), that's the one thing in this list most
  worth reporting precisely.
- The always-on hero roster strip (bottom of the battle screen) should now
  show only name/level/HP for an UNSELECTED hero; AC, move/act readiness,
  and gear count should appear only for whichever hero is currently
  selected.
- A level-up popup for a hero with no ASI/subclass/spell choice this level
  ("X reaches level N!") should now also show what changed underneath the
  Continue button — e.g. "+6 max HP, new feature: Action Surge" — instead of
  just the bare level-up line from before.
- Character Sheet Stats tab: ability scores + modifiers, AC/HP/movement/
  proficiency bonus, class/subclass/level, and an "Available Right Now"
  list should all match what the hero can actually do in battle.
- Character Sheet Spellbook tab: a caster's known spells/cantrips should be
  grouped by level with a level-selector row; hovering a spell should show
  its real rules text in a tooltip (not permanently-visible text).
- Character Sheet Hotkeys tab: clicking a slot then clicking an action/spell
  should pin it there; Clear Slot should empty the armed slot; pinned
  entries should persist if you close and reopen the sheet (and, if you
  save/reload the party, across that too).
- Known, deliberate limits (not bugs): the hotkey bar is editable from the
  sheet but NOT yet wired into battle itself — Q/R/F/T and their existing
  buttons are completely unchanged; the equip flow's before/after preview
  (hover a hero while an item is selected in equip mode) only affects the
  hover tooltip, not the equip flow itself, which is untouched.

### KI-099 — D-147: Character Creation overhaul (choice picker, real naming, Point Buy, class/race previews, subclass-row clarity)
- Class, Race, Gear, and Subclass rows should each open a full-screen
  picker listing every option at once (with each option's preview text for
  Class/Race) instead of cycling — picking one should apply it and close
  immediately; Cancel should discard the click and change nothing.
- The Name field should be a real text box: typing should work normally
  (including selection/backspace/paste), Enter/Tab shouldn't do anything
  unexpected, and typing should NOT trigger any of the scene's own
  keyboard shortcuts.
- Clearing a hero's name to blank (or leaving two heroes with the same
  name) should block Start Battle with a clear message; fixing it should
  re-enable Start Battle immediately.
- The "Ability Scores: Standard Array / Point Buy" toggle (next to Team
  Level) should switch every hero's ability-row controls at once — cycle
  buttons for Standard Array, +/- steppers for Point Buy — and reset every
  hero's scores to that method's own default (all 15/14/13/12/10/8 assigned
  vs. all 8s) rather than trying to carry over the old numbers.
- In Point Buy: a "Points Left: N/27" readout should appear on the STR row
  and count down correctly as scores rise (13→14 and 14→15 should each cost
  2 points, not 1); a "+" should refuse to fire once the remaining budget
  can't afford the next step; a "-" should refuse below 8.
- Saving a party under Point Buy, then reloading it, should restore the
  same scores AND correctly show the Point Buy controls (not silently
  revert to Standard Array).
- The Class picker's preview text and the Race picker's title/preview text
  should read clearly and not get cut off.
- A later-choice class's Subclass row should say to use "Plan Levels"
  instead of implying the subclass is simply unavailable at creation; once
  planned there, the row should show the planned subclass's name.
- Known limits: the Ability Score Method is party-wide, not per-hero (real
  5e practice); no new races were added this pass (see KI-098); Signature
  Action still cycles rather than using the new picker.

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
  sign-in, and silently re-establish a new anonymous session on sign-out. -confirmed
- Load Game's "Sync with Cloud" button should stay disabled until signed
  in with Google, then pull/merge/push saves.
- Saving/updating/deleting a party while signed in with Google should
  mirror to Firestore (`users/{uid}/saves/`).
- Rules tests are written but still UNRUN — the Firestore emulator needs
  JDK 21+, and Kevin's IT policy blocks installing one on this machine.
  Standing limitation — don't re-offer a `winget` install.

### KI-034 — full keyboard-only play (D-066) — the status/hint line's redesign shipped as D-158
- Arrow keys should move a tile cursor (clamped at map edges); Enter/Space
  should act on whatever it's over, matching a mouse click exactly
  (select, move, attack, ability-target, build/refund, equip). -confirmed
- In Build/Gear mode, arrow keys should default to navigating the item
  grid; Tab should switch between grid-focus and board-cursor-focus. -confirmed
- ~~The status hint line should reflect current focus ("Tab: aim on board"
  / "Tab: pick item" / "arrows+Enter/Space: keyboard play").~~ -confirmed but
  I hate the whole system this is involved in so we need to change it. —
  **Addressed by D-158**: the whole packed status/hint line is gone,
  replaced by a real hero roster strip + a much smaller contextual message
  line + hover tooltips (see the new **KI-110** for its own checklist). The
  `Tab: aim on board` / `Tab: pick item` focus indicator specifically still
  shows (now in the small message line, only while a Build/Gear/debug grid
  is open) since it has no other display surface — worth re-confirming
  under the new implementation, not assuming it still works unchanged.
- Arrow keys/Space should not also scroll the browser page while the
  canvas has focus. -confirmed
- A full battle should be completable start-to-finish with no mouse at
  all. -confirmed (worth a fresh confirmation after D-158's rewrite — see
  KI-110)

### KI-098 — Kevin's 2026-08-21 feedback/wishlist session (large; awaiting prioritization, not yet scoped into any D-NNN)

A single large playtest/wishlist message covering many independent items,
ranging from small fixes to multi-session epics. Logged here in full so
nothing is lost; deliberately NOT self-scoped into work yet — needs Kevin
to pick an order (see `PHASE_HANDOFF.md`). Kevin himself flagged the
overworld campaign redesign as lower priority than "more important critical
gameplay fixes" — grouped last below for that reason.

**Battle HUD / actions / character sheet** (Kevin's stated top pain point —
current bottom-of-screen panel shows too much at all times regardless of
the selected hero; abilities hardcoded pre-character-creation are stale) —
**most of this list was addressed by D-148 (see KI-100 for its own
in-browser checklist)**:
- ~~Redesign the selected-hero panel to meaningfully show stats/movement/
  available actions & bonus actions only for whoever's selected, not a
  fixed always-on block for every hero.~~ DONE (D-148 piece 1).
- Replace the outdated hardcoded ability list with the hero's REAL spells/
  actions from full character creation — a spellbook with hotlistable
  spells, plus a hotkey bar for actions, both editable from the character
  sheet. **Partially done**: D-148 built the real spellbook display (piece
  5) and a real, editable hotkey bar (piece 3/6a/Character Sheet Hotkeys
  tab) — but the hotkey bar is NOT yet wired into battle itself; Q/R/F/T and
  their existing fixed buttons are unchanged (piece 6b, deliberately
  deferred — see D-148's own writeup for why).
- ~~Add an in-game character sheet: view stats... from it.~~ DONE (D-148
  piece 4, Stats tab) for VIEWING. "Take actions/cast spells/use special
  actions FROM the sheet" is still open — today the sheet is stats/
  spellbook/hotkey viewing-and-editing only; casting/acting still happens
  on the battle board as before.
- ~~Tooltips on items and abilities/spells showing their real rules text
  (spells specifically need level-grouped layout).~~ DONE for spells (D-148
  pieces 5/7: the Spellbook tab's level-grouped grid + a generalized hover-
  tooltip primitive). Item tooltips (Gear/Compendium) are still the old
  always-visible-text treatment, not a hover tooltip — not addressed.
- ~~Level-up screen should show what actually changed (stat/HP/feature
  deltas), even when no choice was required.~~ DONE (D-148 piece 8) for the
  plain "reaches level N!" ack popup specifically — the subclass/ASI/spell-
  pick overlays (which already state their own choice) were left as they
  were, not extended with deltas too.
- **Partially done**: Equipping items UX needs a rethink (current flow is confirmed bad —
  distinct from the D-130 gear-purchase wording fix, which only clarified
  wording, not the underlying flow). D-148 piece 9a added a before/after
  AC/attack-bonus hover preview, directly answering the "no stat
  comparison" complaint — but the click-item-then-click-hero-token flow
  itself, the actual "rethink," is still untouched (piece 9b, deliberately
  not scoped — Kevin gave no target UX for it).

**Character Creation overhaul** (Kevin: "current system is garbage," wants
DnDBeyond.com-level legitimacy) — **most of this list was addressed by
D-147 (piece 1-5 above, see KI-099 for its own in-browser checklist)**:
- ~~Replace click-to-cycle option selection with dropdowns/button
  layouts.~~ DONE (D-147 piece 1) for Class/Race/Gear/Subclass; Signature
  Action still cycles (a short, ~4-option list — never the actual
  complaint) and ability scores now have TWO real methods (see below)
  rather than a picker.
- ~~Let the player actually type a hero's name.~~ DONE (D-147 piece 2).
- Subclass picker in Character/Party Creation (currently level-up only?
  verify) — **turned out to already exist** for the three level-1-choice
  classes (Cleric/Sorcerer/Warlock); D-147 piece 5 reworded the row for
  every other class to point at the existing "Plan Levels" wizard (D-133)
  instead of implying creation-time planning wasn't possible.
- ~~Ability score allotment methods: Standard Array and Point Buy at
  minimum.~~ DONE (D-147 piece 3) — a party-wide toggle; Kevin's further
  "fun" methods beyond these two are still a future ask.
- Race picker should show real bonuses/drawbacks before picking — **D-147
  piece 5 built the preview around what's actually real (speed, flavor
  traits) and deliberately did NOT add an invented ability-score bonus**:
  this project's ruleset (SRD 5.2.1, D-134) moved ability increases from
  Race to Background, so none exist to show. Still open: **add more races**
  beyond the current SRD starter six — piece 1's picker removes the old
  cycle-button real-estate limit, but writing new race data is its own
  content task, not done this pass.
- ~~Class picker should show a rough outline of what each class plays like
  before picking.~~ DONE (D-147 piece 4) — a one-sentence preview per class.
- ~~Verify whether all spells are currently offered to all spellcasting
  classes regardless of real class spell-list gating.~~ VERIFIED, not a
  bug — gating was already real (per-class allow-lists in
  `data/characterCreation.ts`); no code change needed.
- Still open, NOT addressed by D-147: move speed (hero tile-movement
  budget) should scale with map size and with race/class (e.g. Monk). Keep
  the existing "tiles moved" abstraction, but make sure spell/ability RANGE
  uses the identical distance system so
  the two never drift apart.
- No Character Creation entry point on the Main Menu at all — needs adding.

**Compendium / Bestiary organization** — DONE this session (D-150), see KI-102:
- ~~Alphabetize classes, subclasses, races, feats, skills, potions, status
  effects.~~ DONE. Classes/Skills are alphabetized in their own source
  arrays (the only order-sensitive consumer of either was this Compendium
  display); Subclasses/Races/Feats/Potions/Status Effects are alphabetized
  via a display-only sorted copy inside `CompendiumScene.ts`, since their
  real declared order backs other order-sensitive behavior elsewhere
  (default new-build race/subclass selection, picker order, shop order,
  status-badge render order) that must NOT change.
- ~~Add Compendium sections for buildings and traps (grouped by type, then
  alphabetical).~~ DONE — two new tabs reading `STRUCTURE_DEFINITIONS`
  (previously had no Compendium category at all): Buildings (walls+gates,
  then platforms, each alphabetical) and Traps (ground-targeted, then
  flying-targeted, each alphabetical).
- ~~Bestiary should use tabs by enemy role/type (minion, boss, etc.) instead
  of one long scroll.~~ DONE — real role tabs (Minions/Miniboss/Bosses/
  Legendary) replace the old single continuously-paginated scroll; Prev/
  Next now pages within whichever role tab is selected.
- Artificer absence — CONFIRMED working as intended, not a gap: Artificer
  is sourced from Tasha's Cauldron of Everything, not core SRD 5.2.1, so
  this project's SRD-only content rule (`SOURCE_OF_TRUTH.md` §3) correctly
  excludes it. No code change; stating this explicitly per Kevin's own ask
  rather than leaving it unconfirmed.

**Maps & Map Builder**:
- Maps need to be larger overall.
- Map Builder needs a real paint tool: pick a tile type, click-and-drag to
  fill continuously (today's tool is click-one-tile-at-a-time, if that).
- Map Builder should support arbitrary/custom map dimensions, not fixed
  sizes.
- Custom maps need an actual player-settable name field.
- (Way down the road, explicitly not urgent) triggered map actions keyed to
  wave count / hero position / stronghold HP, etc.

**Movement**:
- Heroes cannot currently move, act, then move again in the same turn —
  this is exactly the still-open "hero-side split-movement UI" piece
  (§4's last piece) already tracked at the top of `PHASE_HANDOFF.md`'s
  queue; no new tracking needed, just confirms it's still wanted.
- The waypoint bug is logged above in Open Bugs, not here.

**Progression / turn order / rewards** (each is its own design decision):
- Initiative system: roll once before each wave, per hero AND per
  enemy/enemy-group (needs a decision on granularity — individual enemies,
  per-group, or all-non-boss-enemies-together), then cycle that order until
  the wave ends; reroll each wave.
- XP distribution toggle: split evenly across the party, OR give the
  majority to whichever hero landed the killing blow (environmental kills
  with no hero involvement split evenly regardless).
- Kevin wants the DEFAULT campaign to span level 1-20, with each wave
  awarding enough XP to hit that pace, scaled by party size.

**Small polish items** — DONE this session (D-151), see KI-103:
- ~~Cape of Billowing: recolor red as a placeholder until real art
  exists.~~ DONE — turned out to be an actual bug, not a pending
  placeholder choice: the cape graphic was wrongly reusing the
  selected-hero highlight color; it now has its own dedicated deep-red
  `capeBillowingPlaceholder` color.
- ~~Add an "Exit Game" control somewhere in the app (still missing).~~
  DONE — added to the Main Menu's bottom-left corner. Note: a browser page
  cannot force-close a tab it didn't script-open (`window.close()`
  silently no-ops in that case, a deliberate browser restriction) — the
  button attempts it anyway, then always falls back to an honest "you may
  now close this tab" message so it never reads as broken.

**Overworld campaign redesign (Kevin's own explicit lower priority — do
NOT self-scope into work ahead of the critical-gameplay-fix items above)**:
- Replace the current campaign flow with an overworld map that unlocks
  missions as the story progresses, with an overarching narrative.
- Start the player at a 2-hero party (a locked Fighter PC + one early-
  strong NPC like a Ranger), unlocking more recruitable NPCs and growing
  max party size to 3 then 4 as the story advances.
- Two separate leveling tracks: an in-mission level (can run 1-10 within a
  single mission) versus the persistent "actual" overworld level/items,
  which advance separately once a mission ends.
- Not every mission needs to be a boss fight, but each should serve the
  story.
- Note: `CAMPAIGN_STORY_DESIGN.md` and D-118's engine scaffolding
  (chapters, world-flags, companion roster) already exist as a foundation —
  worth reviewing before designing this from scratch.

## Known, deliberate design limits (not bugs)

- **KI-004 — Placeholder art only.** Coloured shapes and text; no final
  art or audio.
- **Enemies don't avoid traps**, by design (D-039) — pathfinding has no
  trap awareness, so a trap can actually land a hit on a passing enemy.
- **KI-011 — Attacks/abilities ignore line of sight.** Range is pure
  distance; walls never block a shot.
- **KI-029 — No audio ASSETS exist.** D-153 built the real volume/mute
  controls and the `AudioManager` plumbing that applies them (see KI-105) —
  it's genuinely working, just silent, since no music or sound-effect file
  has shipped yet. That content gap is the only thing this item still
  tracks.
