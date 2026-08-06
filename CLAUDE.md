# Fantasy Tower Defense — Claude Code Instructions

A turn-based, grid-based fantasy wave-defense tactics game. TypeScript +
Phaser 3 + Vite, tested with Vitest. Currently **v0.2.0-dev**, Phase 7
(Vertical Slice) content-complete; the in-browser balance pass is what's left.

## Read these first, every session

Before changing any code, read (in this order):

1. `PHASE_HANDOFF.md` — what the last chat did and what's next.
2. `PROJECT_STATUS.md` — current version/phase and what's implemented.
3. `DECISIONS.md` — permanent decisions (D-NNN, highest number so far: D-058).
   Do not reverse a decision marked LOCKED without Kevin's explicit approval.
4. `KNOWN_ISSUES.md` — known bugs, deferred items, and things confirmed
   "working as designed." Kevin records his own playtest findings here
   directly (e.g. "-Confirmed" annotations) rather than in chat — check it for
   his latest input before assuming something is still open.
5. `CHANGELOG.md` — what actually shipped, phase by phase.

For the full project vision, architecture rules, phase roadmap (Phase
0–12), and the MVP Rules Status table, read **`SOURCE_OF_TRUTH.md`** — the
canonical spec, converted from the original `.docx` (still in the repo root
as the file of record if they ever disagree). Its own §9 table lists some
items as OPEN that have since been answered in practice; `DECISIONS.md` is
the current authority when the two disagree (see the repo-note inside
`SOURCE_OF_TRUTH.md`).

## Operating rules

1. Preserve working systems. Don't replace architecture, structure, or
   working features just because another approach is possible.
2. Work only within the assigned/requested scope. Don't add unrequested
   features — but if the user explicitly asks for a large batch of items and
   says to use your judgment on pacing, you may do the whole batch in one
   session as a sequence of small, individually-tested pieces (see
   `DECISIONS.md`'s Phase 7 "remaining content" section for the precedent).
3. Keep content data-driven: heroes/enemies/waves/structures/status
   effects/equipment live in `src/game/data/`, not hardcoded in scenes.
4. Keep game logic separate from presentation: **rules live in
   `src/game/systems/` and `src/game/entities/` — no Phaser dependency, fully
   unit-testable.** `src/game/scenes/` only renders and takes input.
5. Make small, testable changes over giant rewrites. Add a test alongside
   any new pure-system rule (see the `tests/` folder for the established
   per-system style).
6. Run `npm run typecheck`, `npm test`, and `npm run build` after changes.
   Never claim something works without having run it. Report exact pass/fail.
7. Update docs when behavior, architecture, or decisions change:
   - New permanent decision → append to `DECISIONS.md` (check the highest
     existing `D-NNN` first).
   - New bug/limitation/deferred item → `KNOWN_ISSUES.md` (check the highest
     `KI-NNN`).
   - What shipped → `CHANGELOG.md`.
   - Current state → `PROJECT_STATUS.md`.
   - Briefing for the next chat → rewrite `PHASE_HANDOFF.md` fully, don't just
     append to it.
   - New original content (heroes/enemies/items/etc., or anything
     SRD-derived) → `CONTENT_SOURCES.md`. No D&D branding/logos/setting
     material anywhere — see `SOURCE_OF_TRUTH.md` §3.
8. Use strict TypeScript, clear names, and avoid `any` without a documented
   reason.
9. There is no git repository in this environment — Kevin manages Git via
   GitHub Desktop separately. Don't expect or run `git` commands here.
10. No secrets, `node_modules`, or `dist` belong in anything you produce.

## Quick reference

```
npm install        # first time / after dependency changes
npm run dev         # local dev server
npm run typecheck   # TypeScript check only
npm test            # Vitest (150+ tests as of Phase 7 content-complete)
npm run build       # typecheck + production build
```

Key folders:
- `src/game/systems/` — pure rules engines (movement, combat, waves,
  building, economy, rewards, progression, pathfinding, turns).
- `src/game/entities/` — pure unit models (`Hero`, `Enemy`).
- `src/game/data/` — all data-driven content.
- `src/game/scenes/` — Phaser scenes (`BattleScene` is the big one).
- `tests/` — one file per system/feature area.

No browser is available in this environment. `npm run dev` + an HTTP check
confirms the server boots, but on-screen feel/balance always needs Kevin's
own pass — say so explicitly rather than claiming visual/gameplay-feel
verification you couldn't actually do.
