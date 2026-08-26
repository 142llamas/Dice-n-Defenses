# Fantasy Tower Defense — Project Source of Truth

Technical Guide and Cross-Chat Development Playbook
**For Kevin and Claude development chats**

| Field | Value |
| --- | --- |
| Version | 0.1 |
| Date | July 21, 2026 |
| Working title | Fantasy Tower Defense Project |
| Primary stack | TypeScript + Phaser + Vite; Firebase later |

> Converted to Markdown from `Tower Defense Project Source of Truth
> Document.docx` on 2026-07-28 so it can be read directly (and `@import`ed
> into `CLAUDE.md`) without the docx→zip→XML extraction workaround. Content
> is unchanged from the original .docx, which remains the file of record if
> the two ever disagree — update both together.

This document is intended to travel with the latest source-code ZIP (or, now,
the persistent repo) from one development chat to the next.

## How to Use This Document

This is the permanent source of truth for the project. Upload it to the
Claude Project knowledge area (or point a new Claude Code chat at it) and
include the latest source files whenever a new chat takes over development.

> **Core handoff rule:** A new chat must be able to continue the project
> without relying on the previous chat's conversation history.

### Status Labels

| Label | Meaning |
| --- | --- |
| LOCKED | Do not change unless Kevin explicitly approves a design change. |
| DEFAULT | Use this approach unless testing reveals a specific reason to change it. |
| OPEN | A design decision is still required. Do not silently invent a permanent answer. |
| DEFERRED | Do not implement during the current milestone. |

### Required Inputs for Every New Development Chat

1. This project source-of-truth document.
2. The latest source-code ZIP or access to the current GitHub repository.
3. The previous phase's `PHASE_HANDOFF.md`.
4. Any screenshots, test notes, or bug reports created after the prior handoff.

### Required Outputs from Every Development Chat

1. Updated source files in a ZIP that excludes generated dependency folders.
2. A concise explanation of what changed.
3. The exact tests and commands that were run.
4. A list of known issues and deferred work.
5. Updated project documentation and a new `PHASE_HANDOFF.md`.

### Document Map

| Section | Purpose |
| --- | --- |
| 1–4 | Project instructions, vision, and content/IP boundaries |
| 5–6 | Beginner explanation of the technology and Kevin's local workflow |
| 7–8 | Architecture and functional layers |
| 9 | Development phases and recommended chat boundaries |
| 10–13 | Rules status, GitHub handoffs, testing, and Firebase |
| 14–16 | Reusable prompts, first-chat recommendation, and official references |

---

## 1. Claude Operating Instructions

1. Inspect the existing project before changing code. Read README.md,
   PROJECT_STATUS.md, DECISIONS.md, KNOWN_ISSUES.md, CHANGELOG.md, and the
   current phase handoff.
2. Preserve working systems. Do not replace the architecture, framework,
   folder structure, or functioning features merely because another approach
   is possible.
3. Work only within the assigned milestone. Do not add attractive but
   unrequested features.
4. Keep rules and content data-driven. Heroes, enemies, waves, items,
   obstacles, and progression values should be defined in data files whenever
   practical rather than scattered through scene code.
5. Keep game logic separate from presentation. UI buttons and Phaser scenes
   may request actions, but the rules engine determines whether those actions
   are legal and what they do.
6. Make small, testable changes. Avoid giant rewrites.
7. Run the project after changes. At minimum, run the production build and
   all available automated tests.
8. Do not claim success when a command failed or when a feature was not
   tested.
9. Update documentation whenever behavior, architecture, commands, or major
   design decisions change.
10. Never include node_modules, build output, Firebase service-account
    credentials, private keys, or secret environment files in the handoff ZIP.
11. Return complete files, not isolated snippets, when Kevin asks for a
    working handoff package.
12. Use TypeScript strictness and clear names. Avoid `any` unless a
    documented technical constraint requires it.

## 2. Project Vision

### 2.1 One-sentence Concept

A turn-based, grid-based fantasy wave-defense tactics game in which a mobile
party of heroes builds fortifications, manipulates enemy routes, fights
invading creatures, earns gold, and develops from level 1 through a final
boss encounter.

### 2.2 Core Design Pillars

- **Heroes matter as much as defenses.** This is not a passive
  tower-placement game. The party moves, attacks, casts abilities, blocks
  threats, and supports structures.
- **Route manipulation is strategic.** Walls, gates, traps, platforms,
  terrain, and positioning change how enemies cross the battlefield.
- **Turns must be readable.** The player should understand where units can
  move, what they can target, and why an action succeeded or failed.
- **Progression should create meaningful choices.** Levels, equipment,
  spells, defenses, and gold purchases should produce different viable
  strategies.
- **The core loop must be fun before the game becomes large.** New classes,
  monsters, maps, and Firebase features do not compensate for a weak
  movement-combat-building loop.

### 2.3 Existing Concept Carried Forward

- Enemies travel from one side of the map to the other.
- Enemies that reach the exit reduce a shared team defense pool.
- The party loses when that shared pool reaches zero.
- The campaign is intended to advance from level 1 toward level 20 and a
  final boss.
- The party begins with gold that can purchase equipment and battlefield
  obstacles.
- Defenses include walls, gates, melee platforms, ranged perches, holes,
  damaging terrain, slowing terrain, and anti-air hazards.
- Combat alternates player and enemy activity, followed by between-wave
  movement, shopping, trading, resting, and leveling.
- Gold rewards increase across the campaign, with a bonus for completing a
  round within a turn limit.

### 2.4 Terminology Decisions

| Status | Term | Decision |
| --- | --- | --- |
| LOCKED | Stronghold Integrity | Replaces Team AC as the shared loss-condition resource. It behaves like base health, not Armor Class. |
| LOCKED | Breach Damage | The amount removed from Stronghold Integrity when an enemy reaches the exit. |
| LOCKED | Tile | The logical map-distance unit. A tile may be described as five feet, but code uses tile distances. |
| DEFAULT | Wave | One enemy assault followed by a between-wave phase. |
| DEFAULT | Campaign level | Hero progression level; it need not remain locked to exactly one level per wave. |
| OPEN | Final title | Use an original name with no D&D branding. |

## 3. Intellectual Property and Content Guardrails

> **Practical guidance, not legal advice.** Use an original setting, art,
> story, and branding. Limit copied or adapted fifth-edition material to
> content actually included in SRD 5.2.1 and follow CC BY 4.0 attribution
> requirements.

### 3.1 Rules for Every Content-Producing Chat

- Do not use "Dungeons & Dragons" or "D&D" in the game title, logo, domain
  name, or store-style branding.
- Do not use official D&D logos, trade dress, book-cover styling, artwork,
  music, screenshots, or UI assets.
- Do not copy text from official books or D&D Beyond unless the same material
  is confirmed in the licensed SRD.
- Do not use Forgotten Realms locations, named characters, deities, stories,
  or other setting material unless separately licensed.
- Do not scrape D&D Beyond to populate the game.
- Do not assume that free or friends-only use authorizes protected content.
- Record the source and license for every external asset.
- Maintain `CONTENT_SOURCES.md` for all SRD-derived and third-party content.
- Add the exact SRD attribution language required by the downloaded SRD
  before public deployment.

### 3.2 Content Status Categories

| Category | Meaning | Treatment |
| --- | --- | --- |
| Original | Created specifically for this project | Preferred for setting, story, art, names, UI, and unique abilities |
| SRD-derived | Confirmed in SRD 5.2.1 under CC BY 4.0 | Log source and include required attribution |
| Third-party licensed | Purchased, commissioned, public-domain, or licensed asset | Preserve license and attribution records |
| Prohibited pending review | Source or license is unclear | Do not add to the project |

## 4. Beginner Technical Guide

### 4.1 What Each Technology Does

| Technology | Plain-English Meaning | Use in This Project |
| --- | --- | --- |
| Browser | Runs the finished web game | Displays Phaser, receives input, and plays audio |
| TypeScript | JavaScript with defined data shapes and error checking | Rules, state, scenes, UI logic, and services |
| Phaser | A 2D browser-game library | Rendering, scenes, input, animation, camera, sound, game loop |
| Vite | Development server and production build tool | Runs locally, reloads edits, bundles deployable files |
| Node.js | Local runtime for development tools | Runs npm, Vite, tests, and build scripts |
| npm | Package manager | Installs Phaser, Vite, Firebase, and testing tools |
| Git | Version-control software | Records snapshots and allows rollback/comparison |
| GitHub | Online home for the Git repository | Stores code, history, issues, releases, and deployments |
| Firebase Hosting | Web hosting | Publishes the production build over HTTPS |
| Cloud Firestore | Document database | Later stores cloud saves, profiles, achievements, leaderboards |
| Firebase Authentication | Account sign-in | Later identifies the owner of cloud data |
| JSON | Simple data-file format | Stores maps, waves, heroes, enemies, and balance values |

### 4.2 How the Pieces Connect

You normally do not manually link Phaser to TypeScript after the project is
created. Phaser is installed as an npm dependency, TypeScript imports it, and
Vite builds the imported code.

```
You or Claude edit TypeScript, JSON, CSS, and assets
  -> Vite runs the local server and builds the project
  -> Phaser runs the game in the browser
  -> npm run build creates the dist folder
  -> Firebase Hosting later publishes dist online
```

### 4.3 Simplified Phaser Entry Example

```ts
import Phaser from "phaser";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  scene: [BootScene, BattleScene],
};

new Phaser.Game(config);
```

> **Kevin does not need to memorize this.** The first setup phase should
> create the working project and explain the small number of commands needed
> to run it.

## 5. Kevin's Local Setup and Daily Workflow

### 5.1 Install Once

1. Install the current Node.js LTS release.
2. Install GitHub Desktop for cloning, committing, branching, pulling, and
   pushing.
3. Install Visual Studio Code for viewing files and using the integrated
   terminal.
4. Create or sign in to GitHub.
5. Create or sign in to Firebase, but do not configure Firebase inside the
   game until its scheduled phase.

### 5.2 Run an Existing Handoff

```
npm install
npm run dev
```

- `npm install` downloads the packages listed in `package.json` into a local
  `node_modules` folder.
- `npm run dev` starts Vite and prints a local browser address.
- Keep the terminal open while testing.
- Press `Ctrl+C` in the terminal to stop the local server.

### 5.3 Verify a Handoff

```
npm run build
npm test
```

If linting and explicit type-check scripts are added later, also run:

```
npm run lint
npm run typecheck
```

### 5.4 Useful File Rules

- Keep `package.json` and `package-lock.json` in every handoff.
- Do not upload `node_modules`; `npm install` recreates it.
- Do not treat `dist` as source code; `npm run build` recreates it.
- Do not edit package versions casually after a phase is working.
- Do not delete configuration files merely because their purpose is
  unfamiliar.

### 5.5 Recommended Initial Scaffold

The first Claude setup chat should use an official minimal Phaser Vite
TypeScript template with no React, Vue, or other UI framework.

```
npm create @phaserjs/game@latest
```

| Selection | Project Instruction |
| --- | --- |
| Language | TypeScript |
| Build tool | Vite |
| Framework | No React, Vue, Svelte, or Angular |
| Package manager | npm with committed package-lock.json |
| Type safety | Strict TypeScript where compatible |

## 6. Architecture Rules

### 6.1 Primary Principles

- **Single authoritative game state:** Rules operate on one structured state
  rather than hidden values spread across UI objects.
- **Rules independent from visuals:** Movement legality, combat, path
  validation, rewards, and turns must be testable without sprites.
- **Scenes coordinate presentation:** Phaser scenes load assets, show the
  board, accept input, and request actions from systems.
- **Data-driven content:** New monsters and waves should normally be data
  entries, not edits to giant conditional blocks.
- **Explicit phase state machine:** The game always knows its current phase.
- **Versioned saves:** Every save carries a schema version.
- **Controlled randomness:** Random rolls flow through a service that tests
  can seed.
- **Core engine independent of Firebase:** The game remains playable locally
  when Firebase is unavailable.

### 6.2 Recommended Folder Structure

```
/
README.md
PROJECT_STATUS.md
DECISIONS.md
KNOWN_ISSUES.md
CHANGELOG.md
CONTENT_SOURCES.md
PHASE_HANDOFF.md
package.json
package-lock.json
vite.config.ts
tsconfig.json
/public/assets
/src
  main.ts
  /game
    /scenes
    /systems
    /state
    /entities
    /data
    /ui
    /services
  /firebase
  /tests
```

### 6.3 Example Data Shapes

```ts
export interface GridPosition {
  x: number;
  y: number;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  maxHealth: number;
  defense: number;
  movementTiles: number;
  breachDamage: number;
  attackDamage: number;
  attackRangeTiles: number;
  movementType: "ground" | "flying";
  rewardGold: number;
  abilities: string[];
  assetKey: string;
}
```

## 7. Functional Layers

| Layer | Responsibility | Timing |
| --- | --- | --- |
| Rules engine | Legal actions, turns, combat, damage, resources, rewards, victory/defeat | Build early |
| Grid/pathfinding | Coordinates, movement, routes, range, line of sight, building validation | Build early |
| Entities | Heroes, enemies, obstacles, traps, terrain, items, abilities | Small set early; expand later |
| Wave controller | Spawn schedules, completion, turn limits, rewards, bosses | Five waves early |
| Party/progression | Archetypes, levels, equipment, resources, multiclassing | Simplified early |
| Presentation/UI | Rendering, highlights, menus, tooltips, animation, audio | Functional early; polish later |
| Persistence/online | Local saves, then accounts/cloud saves/leaderboards | Defer Firebase |
| Multiplayer | Lobbies, ownership, sync, reconnects, authoritative state | Separate late project |

## 8. Development Roadmap and Chat Boundaries

> **Recommended cadence.** Each phase can be its own Claude chat. Split a
> phase again whenever code review, testing, or the handoff becomes too
> large. Do not combine phases just to move faster.

### Phase 0 — Project Definition and Technical Scaffold

**Goal:** Create a clean Phaser + TypeScript + Vite repository that Kevin can
run locally.

**In scope:** official minimal scaffold; Git repository and `.gitignore`;
folder structure; placeholder scenes; desktop-first scaling canvas; README
with exact Windows commands; testing framework with one passing test;
documentation files.

**Acceptance criteria:** `npm install` succeeds on a clean copy; `npm run dev`
displays a placeholder Phaser scene; `npm run build` succeeds; tests succeed;
README contains every required step.

**Boundary:** No gameplay, Firebase, accounts, final art, or multiplayer.

### Phase 1 — Grid, Camera, and Input Prototype

**Goal:** Display and interact with a logical battlefield grid.

**In scope:** one test map; tile coordinate conversion; hover/selection
highlight; spawn and exit markers; placeholder tokens; debug overlay.

**Acceptance criteria:** grid clicks map to correct logical tiles at
different browser sizes; invalid tiles cannot be selected.

**Boundary:** No turn system, combat, shop, or Firebase.

### Phase 2 — Turn State Machine and Hero Movement

**Goal:** Establish reliable player phases and legal movement.

**In scope:** preparation/player/enemy/resolution/between-wave/victory/defeat
states; two heroes; movement range and path preview; confirm/cancel; end
turn; movement tests.

**Acceptance criteria:** only legal destinations are accepted; cancel
restores prior state; phase changes occur once and in the correct order.

**Boundary:** MVP uses movement plus one action; bonus actions, reactions,
and readied actions are deferred.

### Phase 3 — Enemy Pathfinding and Wave Movement

**Goal:** Spawn enemies and move them from spawn to exit.

**In scope:** ground pathfinding; one spawn/exit; two enemy definitions; five
wave definitions; enemy phase movement; breach damage; wave completion;
tests.

**Acceptance criteria:** enemies follow valid routes; breach damage occurs
once; wave completion is detected reliably.

**Boundary:** A blocking structure cannot eliminate all valid routes.

### Phase 4 — Combat MVP

**Goal:** Make movement and enemy waves tactically interactive.

**In scope:** hero basic attacks; one ability per hero; enemy health/defeat;
range and target preview; hit/damage resolution; combat log; melee/ranged
enemy behavior; tests.

**Acceptance criteria:** valid targets resolve correctly; invalid targets are
rejected clearly; defeat/removal occurs exactly once.

**Boundary:** No full fifth-edition action economy, concentration, large
spell list, reactions, or multiclassing.

### Phase 5 — Building, Traps, Gold, and Shop

**Goal:** Complete the fighting-building-spending loop.

**In scope:** gold; shop; one wall; one damage trap; placement preview; path
validation; purchase/cancel/refund; trap interaction; rewards; tests.

**Acceptance criteria:** purchases update gold once; illegal path blocking is
rejected; traps trigger correctly.

**Boundary:** No large item catalogue or obstacle upgrade tree.

### Phase 6 — Integrated Five-Wave MVP

**Goal:** Produce the first complete playable loop.

**In scope:** start screen; five waves; two heroes; two enemies; wall/trap;
gold/shop; Stronghold Integrity; win/lose; restart; balance pass; regression
checklist.

**Acceptance criteria:** a clean install can play from start to win/lose;
restart does not duplicate state or listeners; build/tests pass.

**Boundary:** Release target: `v0.1.0-mvp`.

### Phase 7 — Vertical Slice Systems

**Goal:** Build a small version representative of the intended final game.

**In scope:** four hero archetypes; six to eight enemies; ground/flying;
walls/gates/platforms/perches/three traps; ten waves/miniboss; status
effects; level choices; limited equipment and spell-like abilities.

**Acceptance criteria:** multiple viable strategies exist; content is
data-driven; core systems remain stable.

**Boundary:** Release target: `v0.2.0-vertical-slice`.

### Phase 8 — UX, Accessibility, and Presentation

**Goal:** Make the vertical slice clear, attractive, and comfortable.

**In scope:** tooltips; keyboard support; color-independent indicators;
volume and speed controls; reduced motion; tutorial prompts; original asset
plan.

**Acceptance criteria:** important actions are understandable without reading
code; settings persist locally; no critical information relies on color
alone.

**Boundary:** Mobile is assessed, not automatically promised.

### Phase 9 — Local Save System

**Goal:** Save and resume campaigns without Firebase.

**In scope:** versioned schema; local storage or IndexedDB; manual save/load;
safe autosave; corrupt/incompatible handling; optional export/import.

**Acceptance criteria:** a save round-trips without state loss; old or
corrupt data fails safely.

**Boundary:** No cloud dependency.

### Phase 10 — Firebase Hosting, Authentication, and Cloud Saves

**Goal:** Deploy the stable game and optionally sync saves.

**In scope:** hosting; simple sign-in; owner-scoped cloud saves; Security
Rules/tests; local-first fallback; budget safeguards.

**Acceptance criteria:** deployed build matches local production build; users
cannot access another user's private saves; offline/signed-out behavior is
documented.

**Boundary:** Do not send every move, frame, or hover to Firestore.

### Phase 11 — Campaign Expansion

**Goal:** Expand only after the vertical slice and persistence are stable.

**In scope:** potential twenty-wave campaign; final boss; multiple maps; more
hero paths/items/structures; difficulty modes; achievements/statistics.

**Acceptance criteria:** expansion does not destabilize core systems; balance
values remain externalized.

> **Repo note (added 2026-07-29):** Kevin significantly elaborated this
> phase's scope in chat — a real D&D 5.5e-based character system (six
> ability scores, classes, subclasses, races/species, feats, spells,
> expanded equipment/magic items/potions), a freeform party builder
> (replacing the fixed 4-hero roster), a bestiary, a map system overhaul
> (terrain types, multiple in/out tiles, shop/treasure tiles, proximity-gated
> building), a boss-themed campaign system, a free-play mode, and
> AI-controlled party members. See **D-070** and **D-071** in `DECISIONS.md`
> for the authoritative record: the freeform-hero-model decision and the
> resulting 11.1–11.10 sub-phase breakdown, respectively. This note
> supersedes the terse "In scope" bullets above as the working plan; the
> bullets are kept as the historical record of the original vision.

**Boundary:** Exact content count remains design-driven.

### Phase 12 — Cooperative Multiplayer Feasibility

**Goal:** Determine whether synchronized co-op is worth the complexity.

**In scope:** turn-based prototype; lobby; player ownership; turn locks;
reconnects; version matching; authoritative state; failure recovery.

**Acceptance criteria:** two clients remain synchronized under tested
scenarios; reconnect behavior is defined; conflicts fail safely.

**Boundary:** No real-time simultaneous action, public matchmaking, or
competitive mode initially.

## 9. MVP Rules Status

| Status | Rule Area | Current Instruction |
| --- | --- | --- |
| LOCKED | Genre | Turn-based grid tactics plus tower-defense route manipulation |
| LOCKED | Loss condition | Stronghold Integrity reaches zero |
| LOCKED | Breach | Escaping enemies deal their Breach Damage |
| LOCKED | Core resources | Heroes, Stronghold Integrity, gold, movement, actions |
| LOCKED | Priority | Local single-player core loop before Firebase or multiplayer |
| DEFAULT | Player turn | Move and take one action, in an explicitly defined order |
| DEFAULT | Phases | Preparation -> Player -> Enemy -> Resolution -> Between-wave |
| DEFAULT | Blocked route | Reject construction if no valid path remains |
| DEFAULT | Content | Prebuilt heroes before full character creation |
| DEFAULT | UI target | Desktop browser and mouse first |
| OPEN | Hero collision | Do heroes block, engage, or allow passage? |
| OPEN | Initiative | Keep party phases or later add individual initiative? |
| OPEN | Dice visibility | How much rolling is shown? |
| OPEN | Level cadence | Every wave or slower after balance testing? |
| OPEN | Rest system | Translate rests to defense format |
| OPEN | Multiclassing | Defer until progression works |
| OPEN | Structure destruction | When may enemies attack walls? |
| OPEN | Final party size | Two in MVP, four in vertical slice |

> **Repo note (added 2026-07-28, not part of the original .docx):** several of
> these have since been answered in practice — see `DECISIONS.md` for the
> authoritative record. "Hero collision" → heroes block (D-033). "Dice
> visibility" → deterministic for now, a hit-chance system is an explicit
> future item (D-047 addendum). "Final party size" → four for the vertical
> slice (D-052). "Level cadence" → a DEFAULT of every 2 waves (D-056), open to
> retuning. Still genuinely OPEN: initiative, rest system, multiclassing,
> structure destruction. This table itself has NOT been edited to match —
> Kevin should decide whether to update the original .docx (and this
> Markdown copy) to LOCKED/DEFAULT, or leave the table as the historical
> record and treat DECISIONS.md as authoritative going forward.
>
> **Repo note (added 2026-07-29):** the "Loss condition" row above was
> **LOCKED** to Stronghold Integrity alone (also restated in D-034). Kevin
> explicitly asked, in chat, for a wiped party to ALSO end the run — see
> D-068. This is a genuine reversal of a LOCKED item, done on Kevin's direct,
> explicit request (the bar CLAUDE.md sets for touching a LOCKED decision),
> not an agent judgment call. The loss condition is now: Stronghold Integrity
> reaches zero, OR every hero is defeated.
>
> **Repo note (added 2026-08-24):** two more of this table's still-OPEN rows
> have since been answered. "Initiative" → **per-group** (D-175): party
> phases (Player/Enemy blocks) stay exactly as they are, but the Enemy
> Phase itself now orders enemies by TYPE-group initiative instead of raw
> spawn order — a real middle ground the table's own two-option framing
> ("keep party phases or later add individual initiative?") didn't name.
> "Level cadence" → **LOCKED to every wave** (D-174; supersedes the D-056
> DEFAULT of every 2 waves noted above) — every living hero levels up
> together every single wave, for the in-battle 1-20 class-level track
> specifically. A SEPARATE overworld/campaign-only leveling track (special
> bonuses unlocked by story progress) is a distinct, deliberately
> not-yet-designed thing that isn't part of this table's "Level cadence"
> item at all — see `KNOWN_ISSUES.md` KI-098 item 13. Per the first
> repo-note above, still genuinely OPEN: rest system, multiclassing,
> structure destruction.

## 10. GitHub and Cross-Chat Handoff Workflow

### 10.1 Repository Strategy

- Keep `main` as the most recent tested, playable version.
- Create a branch named `phase/NN-short-description` for each phase.
- Commit before a new phase starts and at meaningful checkpoints.
- Merge to `main` only after acceptance criteria pass.
- Create tags or releases for major handoffs, such as `v0.1.0-mvp`.
- Use GitHub Desktop rather than memorizing Git commands.

### 10.2 New Chat Intake Checklist

1. Inspect the current project and documentation.
2. Confirm version and phase from `PROJECT_STATUS.md` and `PHASE_HANDOFF.md`.
3. Run `npm install` if dependencies are absent.
4. Run the existing build and tests before editing.
5. Report pre-existing failures separately.
6. Restate the assigned phase boundary.
7. Identify likely changed files and systems.
8. Preserve out-of-scope systems.

### 10.3 Required Handoff Files

| File | Purpose |
| --- | --- |
| README.md | Current setup, run, build, and test instructions |
| PROJECT_STATUS.md | Implemented features and current version |
| DECISIONS.md | Permanent design and architecture decisions |
| KNOWN_ISSUES.md | Reproducible problems and limitations |
| CHANGELOG.md | Changes made in the phase |
| CONTENT_SOURCES.md | External/SRD content and licenses |
| PHASE_HANDOFF.md | Concise next-chat briefing |
| Tests | Automated coverage for changed rules |

### 10.4 Exclude from the Handoff ZIP

```
node_modules/
dist/
coverage/
.env
.env.*
*.log
Firebase service-account JSON files
operating-system temporary files
```

### 10.5 Handoff Report Template

```
# Phase Handoff
## Version and phase
- Version:
- Completed phase:
- Recommended next phase:
- Git commit or release:
## What works now
- ...
## What changed
- ...
## Commands verified
- npm install - pass/fail
- npm run build - pass/fail
- npm test - pass/fail
## Manual tests completed
- ...
## Known issues / deferred items / decisions
- ...
## Next chat instructions
- ...
```

## 11. Testing and Quality Gates

### 11.1 Minimum Automated Test Targets

- Coordinate conversion
- Movement range and legal paths
- Enemy shortest-path calculation
- Rejection of path-blocking construction
- Attack range and valid targets
- Damage and defeat resolution
- Stronghold breach damage
- Wave spawn schedule and completion
- Gold purchases and insufficient funds
- Save serialization/migration when saves are added
- Firestore ownership rules when cloud saves are added

### 11.2 Manual Regression Checklist

1. Fresh installation succeeds.
2. Main menu loads without console errors.
3. A new game starts.
4. The map fits standard desktop browser sizes.
5. Tiles highlight correctly.
6. Heroes move only to legal spaces.
7. Cancel restores the prior valid state.
8. Enemies spawn and follow valid routes.
9. Attacks accept only valid targets.
10. Defeated enemies are removed once.
11. Escaping enemies damage Stronghold Integrity once.
12. Construction previews cost and legality.
13. Illegal route blocking is rejected with an explanation.
14. Gold changes correctly.
15. Waves end correctly.
16. Victory and defeat trigger correctly.
17. Restart does not duplicate listeners or units.
18. Refresh behavior is documented.
19. The browser console has no unexpected errors.
20. The production build succeeds from a clean source copy.

### 11.3 Definition of Done

- All acceptance criteria are demonstrably met.
- Build and tests pass.
- Manual testing is documented.
- New behavior is documented.
- Known limitations are stated honestly.
- The next chat can run the project from the delivered files.

## 12. Firebase Plan

> **Firebase comes later.** The game should first run, build, and save
> locally. Firebase is a service layer, not the foundation of the rules
> engine.

### 12.1 First Firebase Responsibilities

- Host the Vite production build.
- Sign players in.
- Store cloud save snapshots.
- Store profile/settings data.
- Store achievements and leaderboards when those systems exist.

### 12.2 Suggested Data Layout

```
/users/{uid}
  displayName
  createdAt
  settings
/users/{uid}/saves/{saveId}
  schemaVersion
  updatedAt
  campaignName
  gameState
/leaderboards/{boardId}/entries/{uid}
  score
  completedAt
  version
```

### 12.3 Hosting Workflow

```
npm install firebase
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy --only hosting
```

For a standard Vite static build, the Firebase public directory should be
`dist`. Exact prompt answers must be documented during the Firebase phase
because interfaces can change.

### 12.4 Security Requirements

- Never commit service-account credentials.
- Do not leave Firestore in open test mode.
- Test that one user cannot read or change another user's private saves.
- Keep the game local-first and usable when signed out or temporarily
  offline.
- Use usage alerts and monitor costs before inviting a wider audience.

## 13. Claude Phase Kickoff Prompt

Copy this into a new Claude development chat and replace the bracketed
fields.

```
You are taking over development of my Fantasy Tower Defense Project.
Attached are:
1. The current source-code ZIP.
2. The Project Source of Truth.
3. The previous PHASE_HANDOFF.md.
4. [Any screenshots or bug notes].

Your assigned milestone is: [PHASE NAME AND NUMBER].

First, inspect the existing files and documentation. Run the existing build
and tests before changing anything. Clearly distinguish any pre-existing
failure from a failure caused by your work. Follow the Project Source of
Truth. Do not replace working architecture, change the technology stack, or
implement deferred features. Work only within this milestone and preserve
existing behavior unless the milestone explicitly changes it.

Required outputs:
- Complete updated source files in a clean ZIP.
- Updated README.md, PROJECT_STATUS.md, DECISIONS.md, KNOWN_ISSUES.md,
  CHANGELOG.md, CONTENT_SOURCES.md, and PHASE_HANDOFF.md as applicable.
- A summary of changed files.
- Exact commands and tests run, with pass/fail status.
- Honest known issues and deferred items.

Milestone-specific requirements:
[PASTE THE PHASE'S IN-SCOPE ITEMS AND ACCEPTANCE CRITERIA HERE]
```

> **Repo note:** in Claude Code, the source is already a persistent local
> folder rather than a ZIP to re-attach — see `PHASE_HANDOFF.md`'s own "Next
> chat instructions" section for the current, project-specific version of
> this kickoff.

## 14. First Chat Recommendation

> **Start with Phase 0 only.** The first development chat should create a
> reliable scaffold, not the complete game.

The first successful handoff should allow Kevin to:

1. Download or clone the project.
2. Open the folder in Visual Studio Code.
3. Run `npm install`.
4. Run `npm run dev`.
5. See a Phaser canvas and placeholder screen.
6. Run the production build and test command successfully.
7. Commit and push with GitHub Desktop.

After those steps work, a separate chat should begin Phase 1.

## 15. Official References

- [D&D Beyond - System Reference Document v5.2.1](https://www.dndbeyond.com/srd)
- [Creative Commons - Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- [Wizards of the Coast - Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy)
- [U.S. Copyright Office - What Does Copyright Protect?](https://copyright.gov/help/faq/faq-protect.html)
- [Phaser - Installing and create-phaser-game](https://docs.phaser.io/phaser/getting-started/installation)
- [Phaser - Official project templates](https://docs.phaser.io/phaser/getting-started/project-templates)
- [Vite - Getting Started](https://vite.dev/guide/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro)
- [Node.js downloads](https://nodejs.org/en/download)
- [GitHub - Repositories documentation](https://docs.github.com/en/repositories)
- [GitHub - Cloning a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
- [Firebase Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart)
- [Firebase Authentication for web](https://firebase.google.com/docs/auth/web/start)
- [Firestore Security Rules guidance](https://firebase.google.com/docs/firestore/security/insecure-rules)

Technical prompts and product interfaces may change. Future implementation
chats should verify current official instructions rather than relying on
screenshots or unofficial tutorials.

---

*Fantasy Tower Defense Project Source of Truth*
