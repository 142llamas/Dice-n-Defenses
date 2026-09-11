# Kevin's 2026-09-09 Playtest List — Batch Tracker

**Why this file exists**: this 19-item list was split into 8 delivery
batches (A-H) across many sessions. `PHASE_HANDOFF.md` is REWRITTEN FULLY
every session (per `CLAUDE.md`'s own rule) — over ~10 rewrite cycles the
itemized detail got compressed away into vague pointers like "see D-237/
D-238 for what shipped," and the literal original wording of the 19 items
was lost entirely (it only ever lived in prose inside `PHASE_HANDOFF.md`,
never its own file, never committed to git while that version existed).
Kevin flagged that later chats couldn't find/reconstruct batch status
anymore. This file is the fix: a single, durable, live-updated index,
following the exact convention `PARTY_CREATION_OVERHAUL_PLAN.md` and
`CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` already established for other
multi-session arcs.

**Maintenance rule — read this before touching any batch below**: when a
batch (or part of one) ships, update its row in the status table AND its
own section below **in place** — don't just add a note to
`PHASE_HANDOFF.md` and assume it'll carry forward. `PHASE_HANDOFF.md`
should link here (one line) rather than re-summarizing batch contents
itself, exactly like it already does for the other two plan docs. If a
batch ships PARTIALLY (some sub-items done, others not), say so explicitly
— don't mark the whole batch DONE just because a session's own writeup
declared "this closes Batch X." (Batch E and Batch F below are both real
examples of this happening — verify against the actual `DECISIONS.md`
entry, not just its own closing sentence.)

## Status at a glance

| Batch | Items | Status | Shipped in |
|---|---|---|---|
| A | 7, 8, 16 | **DONE** | D-237 / KI-186 |
| B | 2, 4, 9, 10 (root cause), 14, 17 (reorder) | **DONE** | D-238 / KI-187 |
| C | 10 (remainder) | **DONE**; item 11 deliberately still open (see below) | D-239 / KI-188 |
| D | 1, 3, 5 | **DONE** | D-240 (item 1) + D-241 (items 3/5) / KI-189, KI-190 |
| E | 6, 15 | **DONE** — dominance fix + reorder (D-248), then 6b/6c/15 reconciled (D-250) | D-248, D-250 / KI-196, KI-198 |
| F | 17 (drop Save Party), 18 | **DONE** — 17 done via D-249; 18 (real autosave) built for real via D-252 | D-249, D-252 / KI-197, KI-200 |
| G | 19 | **DONE** — item 19a (profiles) deliberately open, see below | D-251 / KI-199 |
| H | 12, 13 | **DONE — closes the ENTIRE 19-item list** | D-253 / KI-201 |

All 8 batches (A-H) are now DONE. Next available at time of writing:
**D-254** / **KI-202** — check `PHASE_HANDOFF.md`'s own header for the
current number before using this.

An unrelated 6-plan campaign-economy redesign (persistent gold, the
between-missions Armory, retiring Gear Points) was scoped and fully shipped
in the middle of this arc (D-242 through D-247, see
`CAMPAIGN_ECONOMY_REDESIGN_PLAN.md`) — it is NOT part of this 19-item list,
just interleaved with it chronologically. Don't confuse its `D-NNN` range
with a batch from this list.

---

## The original 19 items, verbatim

Preserved in full so this never has to be reconstructed from memory again.

1. Once a campaign begins, the main PC's stats, race, class, background (and
   its associated stat boost), subclass (once its chosen), level, and name
   should all be locked.
   a. For now I also think all aspects except gear for companions should be
      locked as well for the entirety of the campaign
2. The gear button on character creation shouldn't show a preview of any of
   the equipped items. There are too many of them and there is no reason one
   would be valued over another so just let it say 'Gear' and leave it at
   that
3. When equipping gear from the character creation screen, I don't see any
   reason why that screen should look different than the screen the player
   sees when managing inventories in the game itself. Make them the same for
   now, but we will need to make decisions on how purchasing/unequipping/
   transferring items works outside of missions. That decision could affect
   what the out of mission inventory screen looks like.
   a. The more I think about it the more I like a 'party inventory'. A place
      where equipment that has been purchased/gifted/started with can be
      placed when its not equipped by a party member. That way unequipping
      an item would just send it to party inventory rather than getting rid
      of it entirely. Items could still be sold from the party inventory.
4. Many of the items just say 'No AC/attack change' until you equip that
   item
5. For rings, there needs to be separate buttons for unequipping from ring 1
   and Ring 2. Right now there is just 1 button and while there is a tooltip
   that says which item will be removed by that button, it still doesn't
   feel great.
   a. Could probably do a similar thing for hands
6. Playing the first mission in Emberford campaign and the starting bonus
   options I got were +15 gold, +25 gold, and Swift Greaves. 2 problems
   here.
   a. First, there should not be any circumstances where a choice is
      'dominated' by another. In this case there is never any reason for
      anyone to ever want to take the +15 gold instead of the +25 gold, that
      would be stupid and therefore it feels like a wasted bonus option spot
   b. Second, when an item is offered as a bonus it should be able to be
      equipped to whichever party member the player wants. Since inventory
      and active party companions are the only things that can be changed
      by the player at this point in the campaign I think it would make the
      most sense to go with the following game-flow.
      i. Pick mission -> pick mission bonus -> pick companions -> pick gear
         -> start mission
   c. Third, make sure the value of the item being gifted is comparable in
      value to the gold being offered. If it is cheaper then the player
      would just always take the gold and purchase that item themselves. If
      it is way more expensive to the point where they could sell it and
      get more gold than is being offered to them then they could use that
      option to get more gold than the gold bonus.
7. In game, building is very unintuitive still. There needs to be a
   highlighted area that tells you where you can build when you're trying
   to place structures
8. There appears to be a bug where if a character is not selected when the
   build menu is opened, it randomly(?) chooses a character to be based on
9. Level selection screen and class selection screen (and perhaps others)
   still use the old UI formatting. Update them and any other screens that
   still use the old stuff
10. There are dozens of places in the game that have overlapping text and
    text that spills off the screen or into other elements of the screen.
    That needs to be fixed, and it seems to be one of the biggest design
    problems we've had in building this game. Is there a way to put in
    safeguards that allow text to wrap and/or change font size based on the
    size of the container it is placed in?
    a. Specifically the worst case of this I've seen is on the
       feat-selection screen. None of the words are legible
11. Text size tends to be on the small side which makes many parts of the
    game harder to read. Think critically through each piece of text in the
    game and decide whether it actually needs to be there/needs to be that
    long or if it would be better if it was a hover-tooltip or something
    else or omitted entirely
12. In the campaign, each area has chapters right now which is fine. I
    would just like it to be so that when an area is selected it opens a
    sub-menu that let's the player select the mission from that area that
    they would like to attempt.
13. For campaign level up, it occurs to me that it would be very clean to
    have a single level up after each chapter. If we had 19 chapters that
    would let the players go from level 1 to 20, and then after completing
    those 19 chapters they would unlock the Nameless Throne part of the
    story.
    a. Currently I think we have 24 chapters spread across 6 areas so if we
       reduce each area to only 3 chapters each (except 1) that would bring
       us to the desired 19. The other option would be to eliminate an area
       entirely (could make it optional bonus content that plays into the
       story but not in an integral necessary way) plus getting rid of 1
       chapter from 1 area. I don't know the structure of the story so I
       don't know which of those options would make the most sense from a
       story-telling perspective.
14. Dialogue boxes need a 'click to continue' tip or something and the
    'skip' button needs to be placed on the bottom of the box. The 'close'
    button should only appear on the last screen of a dialogue box
15. The bonuses for auto-placing barricades or traps are awful
    a. First of all, having the system place them by itself doesn't make
       the player feel good unless the system is always placing them in a
       very beneficial place strategically, which I don't trust the system
       to do at this point
    b. Secondly, those traps and walls tend to be way lower priced than the
       gold bonus options that would be offered so there is no real benefit
       to taking them over the gold option
       i. This could be fixed by offering more than just 1 trap/wall to the
          player
16. Tried playing the 2nd Cinderlord chapter but the game bugged out. The
    map loaded but clicking on things does nothing. Hotkeys work but they
    don't pull up the menu, they just blindly allow the player to build.
    a. Get a message saying I need to move a hero to a shop to buy/equip
       gear but there are no shops on the map.
17. In the paused menu the order should be resume battle, controls,
    settings, save game, load game, Exit to main menu. No need for a save
    party button in the campaign menu since that party is automatically
    save (or at least should be) as part of the campaign save
18. Are there auto-save points yet? If not, let's think about when they
    should trigger to auto-save, how many auto-save slots there are (new
    auto-save saves should override the oldest auto-save slot if all slots
    have been used)
    a. Need to ensure the player is warned when the game is saving if it
       takes more than half a second to do so, just to make sure they don't
       exit the game and corrupt that save while the saving is going on
    b. Need to disable all player actions while saving is happening
19. For settings and controls we need default values and a button that
    resets back to default values.
    a. I wouldn't hate having personalized set-ups that could be saved and
       named as well. That way the player could easily swap their control
       or settings setup depending on their circumstances

---

## Batch A — DONE (D-237, KI-186)

Items 7, 8, 16. Build-mode legal-tile highlighting, correct build-hero
attribution, and the Emberford ("Cinderlord") Chapter 2 unplayable bug
(orphaned dialogue overlay eating clicks). Full detail: `DECISIONS.md`
D-237.

## Batch B — DONE (D-238, KI-187)

Items 2, 4, 9, 10 (root cause), 14, 17 (reorder half). `createOrnateButton`
sublabel wordWrap fix (fixes the feat-screen illegibility and much of item
10 project-wide for free), `renderChoiceOverlay` reskinned to the ornate
theme (item 9), gear-compare deltas extended beyond AC/attack (item 4), Gear
button reverted to a plain label (item 2), dialogue click-to-continue hint +
Skip moved to the bottom (item 14; Close-on-last-line confirmed already
correct, no fix needed), pause menu reordered to Resume Battle/Controls/
Settings/Save Party/Save Game/Load Game/Exit (item 17's ORDER only — "Save
Game" confirmed with Kevin live to mean renaming "Save & Exit", not merging
the two save buttons). Full detail: `DECISIONS.md` D-238.

## Batch C — DONE, with item 11 deliberately still open (D-239, KI-188)

Item 10's remainder. Consolidated 4 duplicated shrink-to-fit
implementations into `uiTheme.shrinkFontToFit`, fixed `renderAsiPrompt`'s
fixed-height rows (now dynamically measured), and swept all 66 of
`BattleScene.ts`'s raw `add.text()` calls for genuine unbounded-content
overflow risk (roster hero names, boss name banners, item-grid labels,
co-op partner names, wave-preview text, overlay titles) — fixed the ones
carrying real player-typed/unbounded content, left fixed/bounded content
(HP numbers, status badges, button labels) alone. **Item 11 (is this text
necessary / could it be a tooltip / can it be shorter) was explicitly NOT
touched** — flagged in the original plan as the one genuinely open-ended,
likely-never-"done" item on the whole list. No future session should treat
Batch C as covering item 11; handle it opportunistically whenever a screen
is already being touched for another reason. Full detail: `DECISIONS.md`
D-239.

## Batch D — DONE (D-240 item 1, D-241 items 3/5; KI-189, KI-190)

Item 1 reverses D-213: a campaign PC now locks identity/ability scores
exactly like a companion once a build is persisted (Gear/Spells/Level
Plan/Name stay editable — confirmed intentional, not a gap). Also fixed a
real pre-existing bug surfaced by this work: the Subclass picker had no
`identityLocked` guard at all for ANY locked hero (companion or PC).

Items 3/5: Character Creation's gear picker rebuilt to structurally match
The Armory via a new shared `src/game/scenes/gearPickerView.ts` component
(`GearPickerView` + `GearPickerBackend`/`GearPickerEconomy`) — both
`GearShopScene` and `CharacterCreationScene` now drive the same rendering
layer with different backends (gold vs. Gear Points vs. free). Item 5
(separate Ring 1/Ring 2 — and now Hands — unequip buttons) fell out of this
automatically, since the shared component ports `GearShopScene`'s own
per-occupant-row pairing logic verbatim. Full detail: `DECISIONS.md` D-240,
D-241.

**Note**: item 3a's "party inventory" ask was addressed separately, before
this arc, by the pre-existing Party Creation Overhaul Plan 2.3 (D-197) —
`PartyInventorySystem`/`CompanionRosterState.partyInventory`. That system
still isn't threaded through EVERY unequip action in every screen (only
`CompanionRosterScene`'s "Unequip All Benched Heroes" populates it) — if a
future session wants item 3a fully literal ("every unequip anywhere feeds
the pool"), that generalization is still open. Not currently assigned to
any batch below; flag it if it comes up.

## Batch E — DONE (D-248 + D-250, KI-196 + KI-198)

Items 6, 15. **D-248 shipped first**: the dominance bug (item 6a) — two
gold-tier options could previously land in the same 3-choice draw,
guaranteeing a dead pick; `RegionBonusSystem.drawRegionBonusChoices` now
draws exactly one option per category, making that structurally
impossible. Also moved the "Choose a Bonus" prompt from mid-battle (after
Character Creation/Armory had already run) to a new
`RegionBonusChoiceScene`, inserted right after mission selection and
before Character Creation/the Armory.

**D-248's own "closes Batch E" claim was checked against this tracker and
found wrong** — items 6b, 6c, and all of 15 were still open. **D-250
(same day) closed all three**:
- **Item 6b (choose WHO an equipment bonus equips to)** — `RegionBonusChoiceScene`
  now follows an "equipment" pick with a second "Who receives {item}?"
  screen (named party members, or "First available hero"), threaded through
  as `pendingRegionBonusHeroSlot` (party-slot index) to
  `BattleScene.grantEquipmentOrSellForGold`, which now targets exactly that
  hero (sells for gold instead of redirecting elsewhere if it no longer
  fits by battle-start). Load Game's live in-battle fallback prompt got the
  same follow-up.
- **Item 6c (gifted-item value parity)** — confirmed by direct calculation
  that every common/uncommon non-attunement item in the whole catalog cost
  6-16g against 15-65g region gold tiers, always worse than either tier.
  Asked Kevin how to fix it (raise cost / allow rare+ attunement items /
  lower gold tiers) — **he chose raising cost**. 12 items in
  `data/equipment.ts` repriced to `lowGoldTier + highGoldTier` for their
  region, putting sell value at the exact midpoint. Enforced going forward
  by a new test in `tests/regionBonusSystem.test.ts`.
- **Item 15 (player-placed, 2+ structures)** — `grantRegionBonusStructure`
  now grants 2 free BUILD-MODE placement charges (new `BuildSystem
  .grantFreeCharge`/`consumeFreeCharge`/`wasFreePlaced`) instead of
  auto-placing 1 structure on a system-chosen tile. The player places both
  themselves via the existing Batch A build-mode UI (highlighting,
  `canPlace`/`place`), with no gold cost for either; a free-placed
  structure doesn't refund gold if removed (closes an exploit path).

Batch F's item 18 (real autosave) was explicitly considered for folding
into this same session and confirmed DEFERRED (Kevin's choice via
`AskUserQuestion`) — see Batch F's own section below, unchanged by this.

Full detail: `DECISIONS.md` D-248, D-250.

## Batch F — DONE (D-249 + D-252, KI-197 + KI-200)

Item 17's "drop Save Party in campaign" — **fully done by D-249**. D-249's
own investigation found that a campaign battle's party state is already
durably persisted the instant Start Battle is clicked (via the pre-existing
Party Creation Overhaul Plan 3.1 / D-195, unrelated to this arc) — so the
specific redundancy that made Kevin ask for autosave (a "Save Party" button
that felt like it should be automatic) was already covered, and the fix was
just to hide that now-redundant button rather than build a new save
mechanism. At the time, **none of item 18's literal asks existed** — flagged
as its own dedicated session.

**Item 18 (real autosave) built for real by D-252.** Two scope forks
confirmed with Kevin via `AskUserQuestion` before design: checkpoint
**after each wave clears**, covering **both Campaign and Free Play** (the
harder option — Free Play had zero run-continuity of any kind before this).
New `AutosaveSystem.ts` (a rotating pool of 3 checkpoints, upserted by
per-run id so one long playthrough can't evict its own earlier checkpoints)
built on top of the previously-unused `BattleStateSnapshot.ts` (Phase
12.1/D-101). `BattleScene.create()` gained an additive resume branch — the
fresh-start path is unchanged; a resume restores every live system from the
checkpoint and skips the one-time pre-wave-1 setup. "Warn if saving takes
>0.5s" and "disable actions while saving" are both real, correct plumbing
(an `autosaving` flag in `inputLocked()`, a timed warning via the combat
log) — genuinely present even though today's synchronous `localStorage`
write means the slow-warning branch won't visibly fire until/unless a
slower persistence layer exists later. `ModeEntryScene` gained a "Continue"
button per mode; `LoadGameScene` gained a third autosave list with
Resume/Delete.

Two known, accepted gaps flagged (not fixed, both pre-existing/documented
elsewhere): an active summon won't survive a resume (`SummonSystem`'s own
file already documented this as a `BattleStateSnapshot` gap); an
already-claimed treasure tile could pay out a second time after a resume
(`consumedTreasureTiles` was already documented as "not persisted, reset on
scene create"). Neither is new to this decision. Full detail:
`DECISIONS.md` D-249, D-252.

## Batch G — DONE (D-251, KI-199)

Item 19: Settings/Controls "Reset to Default" button, shipped. New pure
`SettingsSystem.resetSettings`/`KeyBindingSystem.resetKeyBindings` write
`DEFAULT_SETTINGS`/`DEFAULT_KEY_BINDINGS` back to storage and return them
(2 new tests). `SettingsScene` gained a "Reset to Default" button (above
Back), guarded by a `PauseMenuScene`-style confirmation prompt; confirming
re-applies volume/mute live to `AudioManager` and, in the in-battle
pause-menu overlay entry mode, also resets the live `BattleScene`'s own
Game Speed. Full detail: `DECISIONS.md` D-251.

**Item 19a (named/savable setting/control profiles) deliberately NOT
built** — Kevin's own phrasing was the softest hedge on the whole 19-item
list ("I wouldn't hate..."), and no profile concept exists anywhere today
(`this.settings`/`this.keyBindings` are single global objects, not a keyed
collection). Genuinely open if he wants it later — not assigned to any
batch.

## Batch H — DONE (D-253, KI-201) — closes the ENTIRE 19-item list

Items 12, 13. Kevin: "do Batch H now."

**Which region loses its Chapter 3** (the question this section's own prior
revision left open): three parallel Explore passes plus one Plan-agent
validation pass compared Emberford Reach, Saltmere Shallows, and Cinderfall
Rift's Ch3 content directly against live source. All three were mechanically
inert (no `bossEnemyId`, no world-flag hooks, no dialogue branches) — pure
roster-remix waves with connective flavor text only. Cinderfall Rift's Ch3
carries a bridge-collapse escalation motif (Ch1→Ch3→Ch4) that would need a
line folded elsewhere to preserve; Saltmere Shallows is the returning-
miniboss mechanic's own payoff region, the narratively densest of the three.
**Emberford Reach** — pure directional flavor text, no motif to re-thread —
was recommended and confirmed with Kevin via `AskUserQuestion`. Drowning Vale
and Frostbound Hollow's exclusions (from this section's original writeup)
were independently re-verified and held: Drowning Vale's Ch3 is one of three
votes feeding the Sorrel Thane mercy tally; Frostbound's Ch3 sits immediately
before the Isolde-homecoming capstone-foreshadowing beat.

**Item 12 (chapter-select submenu)**: new `src/game/scenes/
ChapterSelectScene.ts`, inserted between a region card click and the
existing `selectCampaign`/`RegionBonusChoiceScene` routing. Lists every
chapter of the chosen region with locked/unlocked/completed status (derived
the same way `CampaignSelectScene.nextChapterIndexFor` already computed "the
next playable chapter" — doesn't change what's reachable, just makes it
visible) and lets a completed chapter be replayed. Since a new scene can't
call another scene's private method, the existing 2-branch routing
(unlock-mission check → `UnlockMissionPartyScene`, else →
`RegionBonusChoiceScene`) was extracted into a new shared `src/game/scenes/
missionRouting.ts` (`startMissionFlow`) — `CampaignSelectScene.selectCampaign`
is now a 1-line delegate to it. `UnlockMissionPartyScene.leave()` (Back/Esc)
now returns to `ChapterSelectScene` instead of skipping past it.

**Item 13 (19-chapter restructure)**: Emberford Reach's old Chapter 3
deleted outright; its old Chapter 4 (the real finale — `EMBERFORD_WAVES`/
`cinderlord`, content untouched) renamed down to Chapter 3. Shattered
Causeway removed from `REGION_CAMPAIGN_IDS` (5 regions remain: Emberford 3 +
Saltmere/Cinderfall Rift/Drowning Vale/Frostbound Hollow at 4 each = **19
required chapters**) but stays a full, playable `CampaignDefinition` in
`CAMPAIGNS` — non-mandatory, not deleted. Dorian Wick (Causeway's own Pool B
recruit) moves to Pool A (`sideMissionId: "side-dorian-wick"`, a new 3-wave
mission reusing `CAUSEWAY_MAP.id`, already proven safe by
`side-wren-calloway`'s identical reuse) — every consumer was already generic
over `sideMissionId`/`homeRegionId` matching, so this needed only a data
change, zero scene/system code. Pool A/B split: 6/6 → 7/5.

**New campaign-only leveling cadence**: `chapterLevelMilestones` gained an
optional `ChapterClearLevelContext` (`{currentLevel, alreadyCompleted}`) —
when supplied for a real chaptered campaign, it grants exactly ONE level
after the chapter's last wave (`Math.min(currentLevel + 1, 20)`),
order-independent since regions already unlock in parallel with no forced
sequence, gated on `alreadyCompleted` so replaying an already-cleared chapter
can't farm free levels. Applies to all 6 chaptered campaigns (5 mandatory +
optional Shattered Causeway), not just the 5 mandatory ones — avoids leaving
Causeway as a leveling dead-zone. Every existing 2-arg call site (all in
tests) is unaffected and keeps the old band-based fallback; Free Play is
completely untouched (it never calls this function).

**Required companion fix**: campaign boss/enemy scaling
(`BattleScene.ts`'s `scalingTargetLevel`) was keyed to each chapter's
*static* `levelRange[1]` band, completely decoupled from the player's actual
level — a mismatch that already existed (regions already unlock in
parallel) but was partly masked by the OLD per-wave ramp toward that same
band. The new cadence removes that masking, so `scalingTargetLevel` for a
campaign now reads `campaignLevelState.campaignLevel` instead. Positive side
effect: every side-mission/Prologue boss was previously always scaled to a
flat level 20 regardless of when attempted — this fix incidentally corrects
that too. `CampaignLevelSystem.highestReachedCampaignLevel`'s legacy-save
backfill formula changed to match (chapters-cleared count instead of
band-maxing), with a clamp defending a stale save whose recorded chapter
index no longer exists after Emberford's Ch3 cut.

**Two real pre-existing bugs found and fixed, neither in the original
scope**: `BattleScene.showMirrorBossReactionIfAny` hardcoded chapter index 3
as every region's finale (would have silently broken Tamsin Rourke's
mirror-boss dialogue for Emberford's new 3-chapter shape) — now derives the
finale index from `totalChapters(campaign) - 1`, matching its own sibling
check. Dorian Wick's two `companionDialogue.ts` entries had to be deleted
(mandatory — existing tests already assert no Pool A companion has either),
so Shattered Causeway's finale loses its "homecoming beat" dialogue
entirely — a deliberate, accepted narrative loss, not an oversight.

Known, accepted, non-blocking risk: a dev save with
`completedChapters["emberford-reach"] === 2` would cosmetically read as
"finale already done" in the chapter-select card after the clamp above —
does not affect the real capstone gate, self-heals on replay, no migration
code written.

Tests: **1872** (1868 + 4 new). Typecheck clean, build succeeds (**170
modules**). Full detail: `DECISIONS.md` D-253, `KNOWN_ISSUES.md` KI-201.
