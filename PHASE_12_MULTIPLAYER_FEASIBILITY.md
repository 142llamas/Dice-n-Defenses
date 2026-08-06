# Phase 12 — Cooperative Multiplayer Feasibility (Design Doc)

**Status: DESIGN ONLY. No code written for this phase yet.** Per
`SOURCE_OF_TRUTH.md`'s own framing, Phase 12's goal is to "determine
whether synchronized co-op is worth the complexity," not to commit to
shipping it. Kevin asked for this design doc before any implementation,
and named the state-sync model up front: **client-authoritative**,
enforced by Firestore security rules, staying on the free Spark plan (no
Cloud Functions, no billing decision required to prototype this).

This doc is the feasibility analysis. It does not change any shipped
behavior — `PROJECT_STATUS.md`/`CHANGELOG.md` note that this exists, but
nothing here is "DONE" in the sense every other phase entry means.

## 1. What Phase 12 is actually scoped to (from `SOURCE_OF_TRUTH.md` §Phase 12)

- **In scope:** turn-based prototype; lobby; player ownership; turn locks;
  reconnects; version matching; authoritative state; failure recovery.
- **Acceptance criteria:** two clients remain synchronized under tested
  scenarios; reconnect behavior is defined; conflicts fail safely.
- **Boundary:** no real-time simultaneous action, no public matchmaking, no
  competitive mode initially.

That boundary matters a lot: this game is turn-locked already (`TurnSystem`'s
preparation → player → enemy → resolution → betweenWave loop). Co-op doesn't
need a new real-time netcode model — it needs the existing turn loop to have
more than one human able to act inside the *player* phase, with everyone
else's screen staying in sync.

## 2. The central finding: this already has 80% of the ownership model built

Phase 11.4 (D-077) gave every hero slot a `controlledBy: "human" | "ai"`
field (`CharacterBuild`, `HeroDefinition`, `firestore.rules`'
`isValidBuild`), plus a real `HeroAISystem` that plays a non-human hero's
turn automatically. That is already "player ownership" for a single local
player choosing which heroes they personally drive versus which ones the AI
drives.

**Multiplayer co-op is not a separate ownership system — it's a third value
for the same field:** `controlledBy: "human" | "ai" | "remote"`, where
`"remote"` means "a human, but not THIS client — wait for their move to
arrive over Firestore." The existing per-hero toggle, the existing
AI-turn-runner pattern, and the existing `BattleScene` turn loop all
generalize instead of needing new parallel machinery. This is the strongest
argument for "worth prototyping" in this doc — the incremental surface is
smaller than a naive "add multiplayer" estimate would suggest.

## 3. The one real new technical problem: dice

Phase 13.1 (D-086) reversed this game's original deterministic-combat
decision (D-030) — `CombatSystem.applyAttack` now rolls a real d20 through
`RandomService` on every attack. That is fine for a single local client, but
it breaks a naive "every client recomputes the same simulation" sync model:
two clients would need bit-identical seeded RNG streams, calling
`RandomService` in the exact same order, for every action any hero or enemy
ever takes — a single dropped/reordered event desyncs them permanently, and
debugging that class of bug is exactly the "complexity" this phase is
supposed to be sizing up.

**Resolution:** don't sync inputs and recompute — sync *results*. Whichever
client currently owns the acting hero (or, during the enemy phase, a
designated "host" client — see §6) is the only one that ever calls
`RandomService`/`CombatSystem`. It runs the existing pure systems locally
exactly as today, then writes the *outcome* (hit/miss/crit, damage dealt,
new HP, status applied, etc.) to the shared session document. Every other
client — including, conceptually, the acting one, once its write is
confirmed — renders strictly from whatever the Firestore document says
happened, never recomputing the roll. This is the standard "authoritative
result broadcast" pattern for turn-based sync and requires no changes to
`CombatSystem`/`RandomService`/`WaveSystem` themselves — only to what
`BattleScene` does with a result after computing it.

## 4. Session / lobby model

Boundary excludes public matchmaking, so this is invite-only:

- A new Firestore collection, `coopSessions/{sessionId}`, `sessionId` a
  short human-shareable code (e.g. 6 alphanumeric characters — same shape
  as the existing `MapSharingSystem`'s public-id pattern, not a raw UUID).
- **Host flow:** a signed-in player (existing `AuthClient` — anonymous or
  Google, unchanged) creates a session from a new "Co-op" main-menu entry,
  which writes a session doc with themselves as the first participant and
  gets a code to share.
- **Join flow:** a second signed-in player enters the code on a new join
  screen; joining adds their `uid` to the session's participant list.
- Party assembly reuses `CharacterCreationScene`'s existing per-hero slot
  UI, extended so each slot can be assigned to a specific participant `uid`
  (not just "human (local)" vs "AI") before the session starts.
- This reuses 100% of the existing auth system (Phase 10) — no new sign-in
  flow, no new identity concept.

## 5. Turn locks

`TurnSystem`'s phase machine is unchanged. Within the existing `player`
phase, add one more piece of shared state: **whose turn it is right now**,
as a queue of hero ids belonging to human-controlled slots (local or
remote), each acted-or-passed before the phase can advance — a direct
generalization of how `BattleScene` already checks "has every human hero
acted?" before allowing End Turn today (it just currently only ever checks
the local player's own heroes).

- Only the client whose `uid` matches the current hero's owning
  participant may submit a move for that hero. Every other client's UI for
  that hero is read-only ("Waiting for `<name>`...") — this is the "turn
  lock" acceptance criterion, and it's enforced in the SAME place ownership
  already is: security rules reject a write from a non-owning `uid` (see
  §7), so this isn't just a client-side UI courtesy.
- The enemy phase and resolution are non-interactive already (no human
  input during them today), so there's no new per-enemy ownership question
  to solve — only one client needs to actually run `WaveSystem`'s enemy-turn
  logic and broadcast the results; a simple rule (lowest-uid-in-session, or
  whoever's client happens to observe the phase transition first with a
  Firestore transaction guarding against a double-run) picks that "host for
  this tick" without a permanent server role.

## 6. Data model (sketch, not final)

A single `coopSessions/{sessionId}` document, matching this project's
existing "one document, not a nested collection" style (`SaveSlot`,
`SharedMapRecord`):

```
{
  id: string,
  protocolVersion: number,       // see §8
  hostUid: string,
  participantUids: string[],     // 2 for this phase's scope (party size 2, per SOURCE_OF_TRUTH's MVP default)
  heroOwners: Record<heroId, string>,  // uid, or "ai"
  phase: GamePhase,              // mirrors TurnSystem.current
  turnQueue: string[],           // remaining hero ids to act this player phase
  battleState: <serialized BattleScene/system snapshot>,
  lastActionSeq: number,         // monotonic counter, see §9
  updatedAt: number,
}
```

`battleState` is the hard part deliberately left unresolved here: today's
battle state lives across several in-memory system instances
(`Hero`/`Enemy` entities, `BuildSystem`, `WaveSystem`, gold, structures,
map). A real prototype needs a serialize/deserialize pass over all of it —
similar in spirit to `SaveSystem`'s existing `CharacterBuild` serialization,
but far larger (it has to cover live HP, positions, statuses, cooldowns,
everything `SaveSystem` deliberately does NOT save today because saves are
run-boundary-only, per D-083). This is the single biggest unknown-sized
piece of work in this whole feasibility estimate.

## 7. Security rules approach (client-authoritative, as decided)

Same shape as the existing `users/{uid}/saves/{slotId}` and
`sharedMaps/{mapId}` rules (`firestore.rules`):

- `allow read`: any `uid` in `participantUids`.
- `allow update`: only if `request.auth.uid` equals the `heroOwners` entry
  for whichever hero the write's `lastActionSeq` claims to be acting for
  (or `hostUid`, for enemy-phase/host-only writes) — mirrors
  `isOwner()`'s existing pattern, extended to a per-turn-owner check
  instead of a whole-document owner.
- Shape/size validation follows `isValidSaveSlot`/`isValidSharedMap`'s
  existing style: explicit key allowlist, size caps, no loop construct (same
  documented limitation those two already have — this is NOT a full
  game-rules validator, just a shape/ownership gate, consistent with the
  "client-authoritative, weaker guarantees" tradeoff Kevin explicitly chose
  over Cloud Functions).

## 8. Version matching

Every past phase of this project has changed game rules (new classes,
subclasses, dice, action economy...). Two clients on different builds
mid-session would silently disagree about what a given action even means —
worse than a desync, since neither client would necessarily error. A new
`COOP_PROTOCOL_VERSION` constant (bumped whenever a change could affect
mid-battle simulation — same discipline `SaveSystem.CURRENT_SAVE_VERSION`
already applies to saved data) gets written into the session doc at
creation; a joining client whose own build has a different version is
refused with an explicit "host is on a different version" message rather
than allowed to join and silently diverge.

## 9. Failure recovery / conflict handling

- **Write races:** the turn-lock rule (§5/§7) means only one client is ever
  authorized to write for the current action, so the common race (two
  players clicking at once) is prevented by rules, not resolved after the
  fact. `lastActionSeq` (a monotonic counter) is the belt-and-suspenders
  check — a client refuses to apply an incoming update whose seq isn't
  exactly `local + 1`, and re-fetches instead of silently skipping, so a
  missed real-time event can't leave a client's view permanently behind.
- **Offline/dropped writes:** mirrors this project's existing "local-first
  fallback" precedent from Phase 10 — an action is applied to the LOCAL
  view optimistically, but is not treated as final/broadcastable until the
  Firestore write actually confirms; a failed write surfaces a "reconnecting
  — your last move may not have reached your partner" banner rather than
  silently proceeding, and retries the write rather than inventing a new
  local state to reconcile against.
- **Reconnect:** since `battleState` lives durably in the session document
  (not just in-memory), a disconnected client rejoining with the same
  `sessionId` does a full read + resubscribe (`onSnapshot`) and rehydrates
  its local scene from that document — no separate "resume" protocol
  needed beyond "read the current doc and render it," which is also exactly
  what a *fresh* participant's client does the first time it opens a
  session it didn't create.

## 10. Cost / quota estimate

Turn-based co-op between two known participants is cheap on Firestore's
free Spark plan: one small document, one write per player action (not per
frame/tick — same "don't sync every move" discipline Phase 10's
`CloudSaveSync` already follows for saves), one realtime listener per
client for the session doc's lifetime. This does not need Cloud Functions
or the Blaze plan, consistent with Kevin's chosen state model — the
tradeoff is weaker protection against a malicious or buggous client (rules
check ownership/shape, not "is this move actually legal under `CombatSystem`'s
rules"), which is an acceptable risk for co-op among people who already
know each other, not a public competitive mode (explicitly out of scope
anyway per the Phase 12 boundary).

## 11. Suggested sub-phase breakdown, IF Kevin greenlights a prototype

Not started, not committed — offered as the same kind of sub-phase roadmap
Phase 11 (D-071) and Phase 13 (D-086) used, since Phase 12 is at least as
large as either of those turned out to be:

- **12.1 — Battle-state serialize/deserialize.** The unglamorous
  prerequisite (§6's hardest unknown): a pure, tested
  `BattleStateSnapshot` covering everything a live battle needs
  (heroes/enemies/structures/gold/map/phase/turn-queue), independent of any
  networking. Verifiable entirely headless, no Firebase needed yet.
- **12.2 — Session/lobby (local-only stub).** `CoopSessionSync.ts` (new
  `src/game/cloud/` file, matching `CloudSaveSync.ts`'s IO-only,
  not-unit-tested style) plus `firestore.rules` additions; a create/join
  UI. Can be tested with two browser tabs signed in as two different
  anonymous users on one machine, no second physical device required.
- **12.3 — Turn-lock + result-broadcast wiring.** The `controlledBy:
  "remote"` extension (§2), the result-broadcast pattern (§3), the
  turn-queue UI ("Waiting for `<name>`..."). This is where
  `BattleScene` actually changes.
  - **Post-implementation split (D-103):** once actually investigated,
    this bundled two differently-sized pieces — ownership/turn-lock
    (small, safe) and result-broadcast (large: `BattleScene` has no
    existing "redraw everything from the current model" function, since
    enemies/structures spawn dynamically as waves progress — building one
    from scratch is real, separately-sized work). Kevin was shown that
    split and chose ownership-only for the session that became "12.3";
    result-broadcast/live board sync is a follow-up (see
    `PHASE_HANDOFF.md`/`KNOWN_ISSUES.md` **KI-063** for the current state).
- **12.4 — Reconnect + version-mismatch handling.** §8/§9's failure paths,
  deliberately last since they're only meaningful once 12.1-12.3 produce a
  session worth reconnecting to.

Each would get its own `D-1xx` decision entry and its own honest "not yet
confirmed by a human" caveat, same as every other phase in this project —
and 12.2 in particular is the first one that would need Kevin to actually
sit at two browser tabs (or two devices) to verify anything, unlike 12.1.

## 12. Recommendation

**Worth prototyping, but it's a real multi-session undertaking, not a
quick add-on** — closer in size to Phase 10 (Firebase) plus Phase 11.4
(AI ownership) combined than to a single sub-phase. The favorable finding
is that the ownership/AI-toggle groundwork already exists and generalizes
cleanly (§2); the unfavorable one is that battle-state serialization (§6,
12.1) is genuinely unscoped work with no existing analog in this codebase —
`SaveSystem` explicitly does NOT serialize live battle state (D-083's own
scope boundary), so there's no shortcut to reuse there. The dice/RNG
problem (§3) has a clean, low-risk resolution (broadcast results, don't
recompute) that requires no changes to the pure systems this project has
carefully kept Phaser-free — that part of the "is it worth the complexity"
question comes back a clear yes.

**Net:** feasible within the free tier and the client-authoritative model
Kevin chose, with the incremental risk concentrated in one place (12.1's
snapshot work) rather than spread across the whole feature — which is a
better risk shape than "everything is equally unknown." Whether it's worth
Kevin's time against the still-open Phase 7 balance pass or further content
work is his call, not something this doc can answer from the code alone.

## 13. Explicit non-goals (per `SOURCE_OF_TRUTH.md`'s own boundary)

- No real-time/simultaneous actions — strictly turn-locked, matching the
  existing single-player turn model.
- No public matchmaking — invite-code sessions only.
- No competitive/PvP mode.
- No server-authoritative validation (Cloud Functions) — an explicit,
  Kevin-chosen tradeoff for this phase, revisitable later if abuse or bugs
  from the weaker model actually show up in practice.
