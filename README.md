# Fantasy Tower Defense

A turn-based, grid-based fantasy wave-defense tactics game (working title).
This repository is at **v0.2.0-dev** — well past its original Phase 0–12 MVP
roadmap (see `SOURCE_OF_TRUTH.md` for that original plan) and now a full
D&D-5e-depth tactics game built entirely on original, non-D&D-branded content
(see `CONTENT_SOURCES.md`). Live and auto-deployed at
**<https://dice-n-defenses.web.app>**; read `PHASE_HANDOFF.md` and
`DECISIONS.md` for exactly what's shipped and what's next — this file only
covers what's stable enough to describe without going stale every session.

Built with **TypeScript + Phaser + Vite**, tested with **Vitest**, deployed to
**Firebase Hosting** via GitHub Actions on every push to `main`.

---

## What the game is today

From the Main Menu you can:

- **Character Library / Create Party** — build a party by hand: 12 classes
  (each with 2 modeled subclasses), ability scores (Standard Array or Point
  Buy), race, background, feats, starting gear, and — for a caster — a real
  SRD spell-preparation economy (known/prepared spells, swap cadence, spell
  slots). A level-by-level progression planner lets you pre-plan every future
  choice (Auto/Prompt/Fresh modes) or make each one live as you level up.
- **Campaign** — a 6-region story campaign (5 mandatory regions plus one
  optional side region), each a multi-chapter arc with its own bosses,
  dialogue, a returning-miniboss mechanic tied to mercy-or-expedience choices
  you make along the way, companion recruitment, and a capstone finale whose
  ending reflects the pattern of those choices. A persistent per-campaign
  economy (gold, gear, party progress) carries across missions via a
  between-missions Armory.
- **Free Play** — a standalone run at a chosen Run Length (Quick/Short/
  Medium/Long, each with its own level cap) and difficulty, with a full
  in-battle Armory and no campaign persistence — pick up and play.
- **Co-op** — a shared-session lobby for playing a battle with another player.
- **Map Builder** — design and playtest your own battle map (terrain, spawn
  points, hand-authored enemy waves), then publish it for others to find and
  play under **Browse Shared Maps**.
- **Compendium / Bestiary** — browse every class, race, background, feat,
  spell, piece of equipment, and enemy in the game.
- **Settings** — volume controls (ahead of real audio content), game speed,
  and rebindable controls.

A battle itself is the core loop this project started with: move and act
with your party each turn (D&D-style actions — attack, cast a spell, use a
class feature, and more, not just one fixed ability), spend gold in an
in-battle Armory or Build menu, defend your Stronghold Integrity against
waves of enemies, and win or lose. The whole game is playable keyboard-only
(arrow-key tile cursor, Enter/Esc to confirm/cancel) as well as with a mouse.

For a genuine step-by-step interface walkthrough (which buttons do what),
play it — the game explains itself via tooltips and its own How to Play
overlay (press **H** in battle) far more reliably than a README can keep up
with a project shipping new content this often. `SOURCE_OF_TRUTH.md` and
`CAMPAIGN_STORY_DESIGN.md` cover the design intent in depth if you want the
full rules reference.

### Editing or authoring a map

Most map authoring now happens in-game via **Map Builder** (terrain palette,
spawn/marker placement, a wave editor) rather than hand-editing data files.
For a hand-authored fixed map, the format in `src/game/data/testMap.ts` and
its siblings (`src/game/data/*Map.ts`) is still how they're expressed: a grid
of characters (`.` = floor, `#` = wall, `S` = spawn, `X` = exit, and several
more for hazard/build-restricted terrain — see `src/game/data/terrain.ts`),
parsed at load time. Keep every row the same length.

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

**What it does:** runs the full logic test suite — one file per system/feature
area in `tests/` (nearly 2,000 tests as of this writing; see `PHASE_HANDOFF.md`
for the exact current count), covering everything from grid math up through
character creation, spellcasting, the campaign systems, and full-loop
integration runs.
**What success looks like:** `Test Files  N passed (N)` / `Tests  N passed (N)`
with no failures.

### Optional: type-check only

```bash
npm run typecheck
```

Checks the TypeScript types without building. Useful to catch mistakes quickly.

---

## Available npm scripts

| Command              | Purpose                                                          |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`        | Start the local development server                              |
| `npm run build`      | Type-check and build the production `dist` folder               |
| `npm run preview`    | Serve and preview the production build                          |
| `npm test`           | Run the automated tests once                                     |
| `npm run test:watch` | Re-run tests automatically as files change                      |
| `npm run test:rules` | Run the Firestore security-rules tests (needs the Firebase emulator/JDK) |
| `npm run typecheck`  | Check TypeScript types without building                          |
| `npm run deploy`     | Build and deploy hosting + Firestore rules to Firebase (normally handled by the GitHub Actions pipeline instead — see `FIREBASE_SETUP.md`) |

---

## Project structure (short version)

```text
index.html              The single web page that loads the game
src/main.ts             Entry point: creates the Phaser game, registers every scene
src/game/config.ts      Shared numbers (tile size, colours, resolution)
src/game/scenes/        Phaser screens — rendering and input only, no game rules.
                          BattleScene is the big one (the core turn loop); the rest
                          are menus/pickers (Main Menu, Character Creation, Campaign
                          Select, the Armory, Map Builder, Compendium/Bestiary,
                          Settings, Co-op Lobby, and more).
src/game/systems/       Pure game-rule engines — NO Phaser dependency, fully unit-
                          testable. Grid/movement/pathfinding/combat/turns, the
                          character/class/spellcasting math, the campaign/economy/
                          save systems, map building/sharing, and more — one file
                          per concern (see the folder itself; it's the actual source
                          of truth for what exists).
src/game/entities/      Pure unit models — Hero, Enemy, Summon.
src/game/data/          All data-driven content: classes/subclasses/races/
                          backgrounds/feats/spells/equipment/enemies/waves/maps/
                          the campaign's regions and chapters, and more. Kept out
                          of scenes/systems on purpose (Operating rule 3 in
                          CLAUDE.md) so content changes don't require code changes.
src/game/cloud/         Firebase-backed sync: auth, cloud save, map sharing,
                          co-op sessions.
tests/                  One test file per system/feature area, mirroring src/'s
                          own organization.
```

The pattern throughout: **rules live in `systems/` and `entities/` (no Phaser,
fully testable); scenes only draw and take input.** See `DECISIONS.md` for why,
and `SOURCE_OF_TRUTH.md` for the full architecture and original roadmap.

---

## Important notes

- **Do not commit `node_modules` or `dist`.** They are regenerated by the commands
  above and are already excluded by `.gitignore`.
- **Never commit secrets** (Firebase service-account files, private keys). `.gitignore`
  already blocks the common filenames, but stay careful.
- Firebase (auth, cloud save, map sharing, co-op) is live and already deployed —
  see `src/game/cloud/` and `FIREBASE_SETUP.md`. Deploys are automatic via
  GitHub Actions on every push to `main`.
