# Fantasy Tower Defense — Claude Code Instructions

A turn-based, grid-based fantasy wave-defense tactics game. TypeScript +
Phaser 3 + Vite, tested with Vitest. Currently **v0.2.0-dev**, well past the
original Phase 0–12 roadmap (see `SOURCE_OF_TRUTH.md` for that original plan
and `DECISIONS.md`/`PHASE_HANDOFF.md` for what actually shipped since —
a full D&D-depth character system, a 6-region story campaign, a persistent
campaign economy, co-op scaffolding, a map builder, and more). Live and
auto-deployed at https://dice-n-defenses.web.app. Always check
`PHASE_HANDOFF.md` first for the actual current state — this file only
covers the rules that don't change session to session.

## Read these first, every session

Before changing any code, read (in this order):

1. `PHASE_HANDOFF.md` — what the last chat did and what's next.
2. `PROJECT_STATUS.md` — current version/phase and what's implemented.
3. `DECISIONS.md` — permanent decisions (D-NNN; check `PHASE_HANDOFF.md`'s
   "Next available" line for the current highest number rather than trusting
   a number hardcoded here, which will drift). Do not reverse a decision
   marked LOCKED without Kevin's explicit approval.
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
   - A large batch (roughly 5+ items, or anything likely to span more than
     one session) → its own dedicated tracking doc at the repo root (e.g.
     `PARTY_CREATION_OVERHAUL_PLAN.md`, `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md`,
     `PLAYTEST_<date>_BATCHES.md`): a status table plus per-item/per-batch
     detail, updated IN PLACE as work ships. `PHASE_HANDOFF.md`'s own
     "rewrite fully every session" rule (below) is exactly why this matters
     — itemized status left only in that file's prose gets compressed away
     over enough rewrite cycles (this happened for real: a 19-item playtest
     list's original wording was lost this way before
     `PLAYTEST_2026-09-09_BATCHES.md` was created to fix it). `PHASE_HANDOFF.md`
     should link to the tracking doc, not restate its contents.
8. Use strict TypeScript, clear names, and avoid `any` without a documented
   reason.
9. A real `.git` directory with a working remote exists in this environment,
   usable for READ-ONLY inspection (`log`/`show`/`status`/`fetch`/`diff`).
   Kevin manages actual Git operations (commit/push/branch) via GitHub
   Desktop separately, and GitHub Actions auto-deploys on push to `main` —
   never `commit`, `push`, or otherwise write to the repository from here.
10. No secrets, `node_modules`, or `dist` belong in anything you produce.

## Quick reference

```
npm install        # first time / after dependency changes
npm run dev         # local dev server
npm run typecheck   # TypeScript check only
npm test            # Vitest (check PHASE_HANDOFF.md for the current count)
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
