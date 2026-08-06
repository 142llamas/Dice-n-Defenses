# Fantasy Tower Defense

A turn-based, grid-based fantasy wave-defense tactics game (working title).
This repository is at **v0.2.0-dev** — Phase 7 (Vertical Slice), now
content-complete on top of the **v0.1.1** integrated MVP. It is a
**complete, playable loop** grown to a ten-wave campaign with a miniboss,
**four heroes**, seven buildable structures, status effects, level-up choices,
and limited equipment. From the title screen you start a game, move and fight
with your party, **earn and spend gold** in a shop to build walls, gates, traps,
and platforms that **reroute, damage, and empower**, **gear up** each hero with
one item, pick a **level-up bonus** every couple of waves, and defend your
**Stronghold Integrity** across **ten waves** until you **win or lose**, then
**restart**. Phase 7's in-browser balance pass is still outstanding — every
gameplay number here is a first-pass starting point. Phase 8 (UX &
presentation) is now well underway alongside it: a settings control
(animation speed, doubling as reduced motion), hover tooltips, a first-time
how-to-play overlay, clearer status-effect/miniboss visuals, and **full
keyboard-only play** — the whole game is completable with no mouse at all.
Saving and Firebase are still later phases.

Built with **TypeScript + Phaser + Vite**, tested with **Vitest**.

---

## What you should see when it runs

1. A title screen that says **FANTASY TOWER DEFENSE** with a green **START**
   button and, top-right, a **settings button** that cycles the animation
   speed (Normal / Fast / Instant — Instant is reduced motion) and remembers
   your choice next time.
2. On your very first battle, a **How to Play** overlay explaining the
   controls — dismiss it with the button or Esc; press **H** any time to see
   it again.
2. After clicking START, the **battlefield** with:
   - a tile grid where **floor** and **wall** tiles look different,
   - an **IN** (spawn) marker on the left and an **OUT** (exit) marker on the
     right, and four hero tokens (**Ash**, **Wren**, **Bram**, **Mira**) near
     the lane,
   - a top banner like `Wave 1 / 10 · Player Phase`, a "Next: Wave 2 — ..."
     preview line, a `Stronghold Integrity: 20 / 20` readout, and a
     **`Gold: 20g`** counter,
   - a status line under the grid showing each hero (HP, gear, ready/used) and
     how many enemies are on the field, plus **End Turn**, **Gear**, **Build**,
     and **Ability** buttons.

Each hero gets **one move and one action** per turn (in either order). The action
is a basic attack **or** an ability.

### Taking a turn (during the Player Phase)

Keyboard shortcuts: **1-4** select Ash/Wren/Bram/Mira directly, **Q** uses the
selected hero's ability, **E** ends the turn, **B**/**G** open Build/Gear,
**Enter**/**Esc** confirm/cancel, and **H** reopens the how-to-play overlay.
The status line at the bottom always lists the ones relevant right now.

**Playing with no mouse:** the **arrow keys** move a highlighted tile cursor
around the board; **Enter or Space** act on whatever it's over — select a
hero, pick/confirm a move, attack or aim an ability at an outlined enemy,
build/refund a structure, or equip/unequip a hero — exactly like clicking
that tile. In Build/Gear mode, arrow keys navigate the item grid by default
(a white ring marks the highlighted button); **Tab** switches them to move
the board cursor instead, so you can pick an item and then aim it with no
click at all.

1. **Click a hero** (or press its number). A bright ring appears, the tiles it can reach light up
   **blue**, and any enemy it can attack is outlined in **red**. Ash and Bram
   are melee (range 1); Wren and Mira are ranged (range 3).
2. **Move:** hover a blue tile to preview the path, click it, then **Confirm**
   (Enter) or **Cancel** (Esc). A moved hero shows `move:used`. Heroes can
   walk past each other in a narrow lane — you just can't end your move
   standing on a teammate's tile (the same rule applies to enemies). The
   **IN** (spawn) tile itself is off-limits to heroes entirely — it never
   lights up as a reachable tile.
3. **Basic attack:** click a **red-outlined** enemy. It flashes, its HP label
   drops, and the combat log records the hit. Clicking an enemy out of range
   flashes red and says why. Standing on a **Melee Platform** or **Ranged
   Perch** (see Building, below) boosts this attack.
4. **Ability** (the purple **Ability** button, or press **Q**): Ash's **Cleave**
   strikes every adjacent enemy; Wren's **Piercing Shot** enters aim mode
   (enemies in range outline **orange**, click one to fire — it ignores
   defense); Bram's **Taunting Slam** strikes every adjacent enemy AND stuns
   them for a turn; Mira's **Frost Bolt** enters aim mode and slows its target
   for two turns. Attacking or using an ability spends the hero's action
   (`act:used`).

### Sending the enemies (End Turn)

5. **End Turn** (button or **E**) runs the **Enemy Phase**. Each enemy either:
   - **attacks a hero** it can reach — the hero flashes and its HP drops, or
   - **advances toward OUT**, routing **around your heroes and walls** (a
     stunned enemy holds in place; a slowed one covers less ground; a burning
     one takes damage before it does anything else), by its speed.
   An enemy that reaches OUT flashes red, disappears, and lowers Stronghold
   Integrity by its Breach Damage (exactly once per enemy).
6. **Removal:** an enemy at 0 HP vanishes; a hero at 0 HP is removed and shows
   **(down)**. When a wave's enemies are gone the wave number rises (`Wave 2 / 10`).
7. **Level-up choice:** every 2 waves cleared, a **Level Up!** prompt pauses the
   game — pick **Vigor** (+3 max HP to every living hero, healing them) or
   **Might** (+1 basic-attack damage to every living hero).
8. **Winning and losing:** clear all ten waves with Integrity above 0 for a
   **Victory** overlay. **Defeat** happens either way: if Stronghold Integrity
   reaches zero, or if every hero falls, whichever happens first — the end
   screen says which one ("the stronghold has fallen" vs. "your party has
   fallen"). Press **Esc** for the menu, then START to play again.

### Building and spending gold (the Build button, or press B)

During your Player Phase, click **Build** (or press **B**) to open the shop: a
grid of buttons, one per structure — **Barricade**, **Gate**, **Spike Trap**,
**Sky Snare**, **Tangle Root**, **Melee Platform**, **Ranged Perch** — each
labelled with its cost. Click one to select it (affordable items are bright,
unaffordable ones dimmed); the status line under the grid names the selected
item's effect.

- **Preview:** the tile under your cursor shows a **green** ghost when the build
  is legal and affordable, or a **red** ghost when it isn't.
- **Buy & place:** click a legal floor tile. Your gold drops by the cost (once),
  and the structure appears with its own glyph. You stay in build mode to place
  several.
- **Walls (Barricade, Gate):** enemies always route around them; a wall that
  would block the enemies' *only* path is **rejected** (red ghost, with a
  message). A **Gate** blocks enemies the same way but heroes can walk straight
  through it — a Barricade blocks heroes too.
- **Traps (Spike Trap, Sky Snare, Tangle Root):** on the Enemy Phase, any
  enemy that steps onto one takes damage (the tile flashes and the combat log
  notes it) — Spike Trap and Tangle Root hit ground units only, Sky Snare hits
  flyers only, and Tangle Root also **slows** whatever it hits.
- **Platforms (Melee Platform, Ranged Perch):** don't block anything; a hero
  standing on a Melee Platform hits harder, and one standing on a Ranged Perch
  reaches one tile further, on their basic attack.
- **Refund:** click one of your own structures to remove it and get its full cost
  back. Press **Esc** or click **Done** to leave build mode.
- **Earning gold:** defeating an enemy grants its reward gold; clearing a wave
  grants completion gold, plus a **time bonus** if you clear it within the wave's
  turn limit.

### Gearing up (the Gear button, or press G)

Click **Gear** (or press **G**) to open the equipment panel: three items —
**Iron Buckler** (+2 defense), **Whetstone Blade** (+2 attack damage),
**Traveler's Cloak** (+1/+1). Click an item, then click a hero to equip it
(gold spent once); the hero's name in the status line shows `[ItemName]`.
Clicking the same item on that hero again — or a different item, then a
geared hero — unequips or swaps it, refunding the old item's full cost. Each
hero holds exactly one item at a time. Press **Esc** or click **Done** to leave.

That is the fighting-building-gearing-spending loop where purchases update
gold exactly once, illegal path-blocking builds are rejected, and traps
trigger correctly. Saving comes in a later phase.

### Editing the map

The battlefield is data. Open `src/game/data/testMap.ts` and edit the picture made
of characters: `.` = floor, `#` = wall, `S` = spawn, `X` = exit, `H` = hero start,
`E` = enemy start. Keep every row the same length. Save and the dev server reloads.
The first four `H` tiles become Ash, Wren, Bram, and Mira, in that order; extra
`H` tiles are ignored for now.

---

## One-time setup (Windows)

You only do this list once per computer.

1. **Install Node.js (LTS version).**
   Download from <https://nodejs.org/en/download>. Node is the tool that runs the
   development commands below. Players of the finished game will not need it.
2. **Install Visual Studio Code.**
   Download from <https://code.visualstudio.com/>. This is the editor you'll open
   the project folder in. It has a built-in terminal you'll type commands into.
3. **Install GitHub Desktop** (recommended for beginners).
   Download from <https://desktop.github.com/>. This lets you save and share the
   project on GitHub without memorizing Git commands.

To check Node installed correctly, open **VS Code**, then open its terminal
(menu: **Terminal → New Terminal**) and type:

```bash
node --version
npm --version
```

You should see version numbers (for example `v22.x.x` and `10.x.x`). If you instead
see an error like "command not found", Node did not install correctly — reinstall it
and restart VS Code.

---

## Running the project

Open the project folder in VS Code (**File → Open Folder**, then choose this folder).
Open the terminal (**Terminal → New Terminal**). Then:

### 1. Install the project's packages (do this first, and any time packages change)

```bash
npm install
```

**What it does:** downloads the libraries listed in `package.json` (Phaser, Vite, etc.)
into a local `node_modules` folder.
**What success looks like:** a message like `added N packages` and `found 0 vulnerabilities`.
**If it fails:** copy the full red error text — that's what to report.

### 2. Start the game locally (for development)

```bash
npm run dev
```

**What it does:** starts Vite's local server and prints a web address.
**What success looks like:** a line like `Local: http://localhost:5173/`.
Open that address in your web browser to play.
**To stop it:** click the terminal and press `Ctrl + C`.

### 3. Build the production version

```bash
npm run build
```

**What it does:** type-checks the code, then bundles everything into a `dist` folder
that could later be uploaded to a web host.
**What success looks like:** ends with `✓ built in ...` and creates a `dist` folder,
with no red errors. (A one-line note about bundle size is normal and expected.)

### 4. Preview the production build

```bash
npm run preview
```

**What it does:** serves the already-built `dist` folder so you can confirm the
production version works, then prints a local address to open.

### 5. Run the automated tests

```bash
npm test
```

**What it does:** runs the logic tests (grid math, map/selection, movement, the
turn state machine, combat, economy, building/traps, status effects, the hero
roster, level-up progression, equipment, rewards, locally-persisted settings,
and a full ten-wave integrated run to both victory and defeat).
**What success looks like:** `Tests  157 passed (157)`.

### Optional: type-check only

```bash
npm run typecheck
```

Checks the TypeScript types without building. Useful to catch mistakes quickly.

---

## Available npm scripts

| Command             | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the local development server                   |
| `npm run build`     | Type-check and build the production `dist` folder    |
| `npm run preview`   | Serve and preview the production build               |
| `npm test`          | Run the automated tests once                         |
| `npm run test:watch`| Re-run tests automatically as files change           |
| `npm run typecheck` | Check TypeScript types without building              |

---

## Project structure (short version)

```text
index.html              The single web page that loads the game
src/main.ts             Entry point: creates the Phaser game
src/game/config.ts      Shared numbers (tile size, colours, resolution)
src/game/scenes/        Screens: Boot, Main Menu, Battle
src/game/systems/        Pure game logic — no visuals, fully testable:
                          GridSystem         coordinate/bounds math
                          GameMap            tile types, walkable, roles
                          MovementSystem     hero range, pathfinding, legality
                          TurnSystem         the phase state machine
                          PathfindingSystem  enemy routing to the nearest exit
                          WaveSystem         spawns, enemy advance/attacks, traps,
                                             status effects, breaches
                          CombatSystem       range, damage, targeting (deterministic)
                          BuildSystem        wall/trap/platform placement + path-block rule
                          EconomySystem      the gold balance (spend/award/refund)
                          RewardSystem       kill gold + wave/time-bonus rewards
                          ProgressionSystem  level-up cadence + choices
                          SettingsSystem     locally-persisted settings (animation
                                             speed/reduced motion, tutorial-seen)
src/game/entities/      Pure unit models — Hero and Enemy (position, HP, combat,
                          equipment/level-ups, status effects)
src/game/data/          Data files: test map, enemies.ts, waves.ts,
                          heroes.ts (hero stats), abilities.ts (hero abilities),
                          structures.ts (walls/gates/traps/platforms),
                          statusEffects.ts (slow/stun/burn), equipment.ts
src/firebase/           Empty for now; Firebase is a much later phase
tests/                  Automated tests (grid, map, movement, turns, pathfinding,
                          waves, combat, economy, building/traps, status effects,
                          hero roster, progression, equipment, rewards,
                          and full-loop defeat + victory runs)
```

The pattern throughout: **rules live in `systems/` and `entities/` (no Phaser,
fully testable); scenes only draw and take input.** See `DECISIONS.md` for why,
and the Project Source of Truth document for the full architecture and roadmap.

---

## Important notes

- **Do not commit `node_modules` or `dist`.** They are regenerated by the commands
  above and are already excluded by `.gitignore`.
- **Never commit secrets** (Firebase service-account files, private keys). `.gitignore`
  already blocks the common filenames, but stay careful.
- Firebase, accounts, and cloud saving are **not** part of this phase. The `src/firebase/`
  folder is a placeholder for a much later phase.
