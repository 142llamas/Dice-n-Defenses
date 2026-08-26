# Campaign Story Design — The Unremembering (Design Doc)

**Status: DESIGN ONLY. No code, data, or docs outside this file have been changed. Nothing here is a locked decision (no D-NNN yet) — it's a framework for Kevin to react to, redirect, and approve piece by piece before any of it gets built.**

## 1. The throughline: a theme that was already hiding in the existing lore

Every miniboss/boss/legendary already shipped (`src/game/data/enemies.ts`) shares one pattern in its `loreText`, almost certainly by coincidence rather than design — each of them has **lost its name, memory, or self**, and acts out a distorted echo of the one thing it used to want or fear:

- Basalt Colossus — rubble that "remembered what walking was"
- Gravemaw — bone and iron that "remembers how to want"
- Cinderlord — a smith who "no longer remembers his own name"
- Tidelord — still calls a drowned wreck "its crew"
- The Devourer — "forgotten there was ever a difference between eating and keeping"
- Ashen Sovereign — has "stopped noticing this is a pattern"
- Hollow Empress — "no memory... only the certainty she is still owed one"

That's not a coincidence worth wasting — it's a ready-made antagonist force. The campaign's throughline is **The Unremembering**: a slow-spreading blight on identity itself. It doesn't kill — it erodes a name, a memory, a sense of self, until only a single compulsion is left standing where a person used to be. Every existing boss is a casualty of it at a different stage of the process. This means the "new" story doesn't contradict or replace anything already written — it just names the pattern and puts a clock on it.

**The personal stakes:** the PC is not immune — they're just early. Something about the PC (unspecified for now — a good hook to decide later, possibly tied to which finale they get) means their own name is eroding too, slowly, over the course of the campaign. The world-ending plot and the PC's personal survival are the same clock. This is also why the PC can perceive the pattern at all when nobody else in-world does.

## 2. Structure: 6 regions, each a full 1-20 arc, plus a capstone

Per your call — every region is a complete 1-20 story, not a fragment. Four chapters per region, pacing off tiers that already exist in `enemies.ts`:

| Chapter | Levels | Beat |
|---|---|---|
| 1 | 1-5 | Arrival + first real threat: a **miniboss** |
| 2 | 6-10 | Escalation, region's first **boss** encounter (not yet the finale) |
| 3 | 11-15 | Branch payoff chapter — content here depends on Ch1/Ch2 choices, no automatic new named enemy required |
| 4 | 16-20 | Region finale: the region's **boss**, now at full strength |

`TEST_MAP` stays outside the story — it's the flavorless legacy/tutorial map and should stay Free-Play only, exactly as it is now.

## 3. Region-by-region assignment

Six existing boss-tier enemies, six existing themed maps, matched by what's already true about both (not arbitrary):

| Order | Region (map) | Ch1 miniboss | Ch4 boss | Why it fits |
|---|---|---|---|---|
| 1 | Emberford Reach (volcanic) | Basalt Colossus | **Cinderlord** | Already paired; rockslide colossus as an early volcanic hazard before the smith-thing at the furnace |
| 2 | Shattered Causeway (chasm/pit) | Juggernaut | **The Devourer** | A Juggernaut that "does not go around things" forced onto the one 2-tile bridge is a built-in joke the map's own gimmick sets up; a hoarding, swallowing thing at the far side of a pit-crossing map is the cleanest lore/mechanics match in the whole roster |
| 3 | Cinderfall Rift (volcanic, collapsing bridge) | Gravemaw | **Warlord Korrath** | An old battlefield's remains (Gravemaw) guarding the approach to a warlord who's never had to fight himself — the bridge literally collapsing under his war is a good climax beat |
| 4 | Drowning Vale (tidal marsh) | The Husk | **Blightmother** | The Husk ("was never the thing that was going to hurt you") makes a perfect decoy/red-herring Ch1 — reframe it as something Blightmother's ground already claimed, planted to test intruders before she shows herself |
| 5 | Saltmere Shallows (tidal) | **returning miniboss** (see below) | **Tidelord** | Deliberately has no unique Ch1 miniboss of its own — see §4 |
| 6 | Frostbound Hollow (verticality, split ridge) | Bloodrage Warlord | **Sundered King** | A king defined by waiting, on a map whose entire gimmick is a ridge that literally splits it in two — "Sundered" is already the map's own geometry |
| Capstone | **The Nameless Throne** (new map) | — | **Ashen Sovereign** or **The Hollow Empress** (branch-determined) | See §5 |

## 4. The returning-miniboss slot (Saltmere) is the mechanical proof of "choices carry across regions"

There are 5 minibosses and 6 regions on purpose. Saltmere's Ch1 isn't a new enemy — it's **whichever miniboss the player spared, rather than destroyed, in an earlier region**, now washed up corrupted/allied with the tide. This can't happen until at least one earlier region is complete, which is why Saltmere is region 5, not region 1 — the sequencing has to respect this dependency.

**Fallback, resolved:** if the player destroyed every earlier miniboss outright, Saltmere's Ch1 is a **nameless tide-wretch** — mechanically a miniboss-tier reskin (same stat/role tier as the named minibosses) but with no `loreText`, no name callout, no story weight. It's explicitly a wall, not a character. This keeps the encounter fair without inventing a seventh named threat that then has nothing to do anywhere else.

**Priority order for this slot, fully resolved:** Sorrel Thane's corrupted-encounter outcome (§6, if Sorrel is Lost in Region 4) takes this slot outright > a spared miniboss from an earlier region > the nameless tide-wretch fallback.

## 5. The finale: one true ending, one earned alternate

Ashen Sovereign and The Hollow Empress are both currently unassigned to any map — reserve both for the capstone rather than spending them on a single region. Which one the PC actually faces is decided by the accumulated world-flags from all six regions, framed around the PC's own arc from §1: broadly, did the PC spend the campaign **fighting to hold onto their name** (→ Ashen Sovereign) or **start letting the forgetting be useful** (→ The Hollow Empress)? Per your call, the *mechanism* behind the PC's own vulnerability to the Unremembering stays ambiguous for now — but the two endings this produces can still be concrete:

**Ending A — Ashen Sovereign (held on).** The Sovereign isn't a monster to put down so much as a mirror of the PC's own worst-case outcome: a ruler who lost every throne it ever built and stopped noticing the pattern. Beating it isn't a kill so much as a **release** — the fight ends with the compulsion breaking, not the body. The actual win condition, narratively: the PC's closing beat is naming their surviving companions, out loud, correctly — proof the Unremembering never actually got them. If companions were lost along the way (permanently benched or worse), this ending is bittersweet in direct proportion to how many are left to name. This is the "you kept who you are" ending, earned by choices that consistently favored holding onto people over expedience.

**Ending B — The Hollow Empress (let it be useful).** Earned by a campaign of choices that treated forgetting as a tool — moving faster by discarding grief, trading memory for power at chapter-boundary moments. The Empress has no court left and no memory of it, only certainty she's still owed one; the PC arrives already resembling her more than they'd like. The fight is winnable, but the closing beat inverts Ending A's: the PC goes to name a companion and **can't** — the name just isn't there anymore. Mechanically the player won; narratively, the Unremembering already finished its work on the protagonist. This is the tragic-but-earned ending, not a punishment for "playing wrong" — it's the honest payoff of a specific, consistent set of choices.

Both endings are reachable through ordinary play with no hidden "good/bad" labeling on individual choices — the split should emerge from a pattern of small decisions across all six regions, not a single last-minute prompt.

### The Nameless Throne (capstone map, new)

One new map, built once. Per your call, the **layout stays identical regardless of branch** — same geometry, same lane structure, same hero-start tiles — but its dressing and its garrison change with which ending it's building toward, decided by the same accumulated flags that pick the boss:

- **Ashen Sovereign variant** — floor reads as ash/ember/scorched stone, hazards lean fire (echoing Emberford and Cinderfall Rift), and the enemy composition leans on burnt/ember-touched reskins rather than new roster entries.
- **Hollow Empress variant** — floor reads as frost/decay, a withered court rather than a scorched one, hazards lean cold/water (echoing Frostbound Hollow and Saltmere/Drowning Vale), enemy composition leans drowned/withered reskins.

This isn't just a coat of paint for its own sake — it lines up with the cast: Isolde Varnhall's Frostbound Hollow homecoming (Region 6, right before the capstone) foreshadows the Hollow Empress variant, while the fire-heavy early regions (Emberford, Cinderfall Rift) foreshadow the Ashen Sovereign variant. A player should be able to feel which ending they're headed toward before they arrive, just from the regions they've been favoring.

Mechanically this is one `ParsedMap` with a fixed tile grid, and a terrain/enemy variant selected by the same world-flag state that picks the boss — no second map to build or maintain.

## 6. Companion catalogue: 1 PC + 3 active, roster larger than the party

Party size is already fixed at 4 in code (`MAX_PARTY_SIZE = 4`, `CharacterCreationScene.ts:142`) — 1 PC + 3 companions fits the existing engine exactly, no mechanical change needed there.

**Extended to 12 companions, one per playable class (D-177).** Kevin's own call, after this doc's original six shipped as design text: the roster should double as a soft tour of every class over the course of the campaign, BG3-style, even though the player only ever has 3 active alongside the PC at once. The original six below keep their region-mirror story weight; six more (Brand Ashcairn/Barbarian, Wren Calloway/Bard, Perrin Holt/Cleric, Mira Quill/Monk, Cass Ferrow/Rogue, Ellery Vance/Sorcerer) were added as ordinary recruits with a one-line hook apiece — not boss-mirror companions, since only six regions/bosses exist for the original six to pair with. All 12 are real, playable `CharacterBuild` data as of D-177 (`data/companions.ts`) — dialogue/full arcs for the original six are still the separate writing pass §9 already flagged; the new six were never meant to carry that weight in the first place.

Per your call, the party needs to be full (PC + 3) starting in Region 1, Chapter 1 — so recruitment can't be purely "gated behind reaching your own region," or the first region would play with an empty bench. Split the catalogue into a **starting trio** (already traveling with the PC before the story opens) and a **recruitable trio** (join as their own region is reached). Each of the 6 is still a **mirror of their own region's boss** — the starters just experience their mirror-region as a *homecoming* mid-campaign instead of a recruitment moment, which is a stronger beat anyway (returning to face the thing you left, alongside the person who talked you into leaving):

**Starting trio (in the party from the outset):**
1. **Hollis Vane**, called "Two-Step" by his old company — a deserter from Korrath's warband who's always let others fight for him and has to learn to act on his own. Homecoming: Region 3 (Cinderfall Rift).
2. **Fenna Duskwater** — a sailor who still talks to Tidelord's drowned crew as if the tide never took them; denial as a refusal to let go. Homecoming: Region 5 (Saltmere).
3. **Isolde Varnhall** — exiled nobility from the Sundered King's fallen court, who waits and watches exactly like the King does, and has to learn not to. Homecoming: Region 6 (Frostbound Hollow), right before the capstone.

**Recruitable trio (join as their region is reached):**
4. **Tamsin Rourke** — a smith's apprentice, afraid that her own obsession with craft and vengeance is exactly how Cinderlord started. Joins Region 1 (Emberford).
5. **Dorian Wick** — lost family to The Devourer; grief burning down slow, like a wick, into the same hollow hunger if left unchecked. Joins Region 2 (Causeway).
6. **Sorrel Thane** — a warden who's spent too long on Blightmother's ground and is visibly, slowly losing themselves to it. Joins Region 4 (Drowning Vale). See below — this one has its own branch chain rather than a single risk flag.

Because the party is *always* full, every recruitment past the opening trio is inherently a bench decision — there's no such thing as a free slot to fill. Some of these should be **automatic** (the story forces a swap — e.g. a starting companion is unavailable for story reasons right when a new one arrives) and some should be **offered as a real choice** (the game stops and asks who to bench). Mechanically, each companion is just a named `HeroDefinition` with a preset starting build the player can keep customizing after recruitment — this reuses the existing custom-build hero system entirely rather than reintroducing a separate fixed-roster mechanic.

### Drowning Vale's fate: a branch chain, not a single flag

Per your note, this shouldn't be one toggle that either saves or dooms them — it should be a **series of choices across Region 4's four chapters** that converge on one of three outcomes:

- **Redeemed** — if the player consistently chooses to slow down and support them (Ch1-3), they fully recover by Ch4, and come out of the region a stronger ally than they went in (the region's version of a reward for patience over efficiency).
- **Marked, not lost** — a mixed record of choices leaves them alive and still recruitable, but visibly changed (new dialogue/flavor acknowledging it, maybe a mechanical quirk) — survived, not unscathed.
- **Lost** — consistently choosing efficiency/expedience over Sorrel across the chain costs them entirely: permanently removed from the catalogue, not just benched. Confirmed: this outcome **reappears as a corrupted encounter** — specifically, Sorrel takes Saltmere's returning-miniboss slot (§4) outright, overriding the generic spared-miniboss logic. Region 4 resolves before Region 5, so the ordering already supports this: whatever happened to Sorrel in Drowning Vale is what's waiting in the Saltmere shallows. If Sorrel was Redeemed or Marked (survived, in either state), Saltmere's Ch1 falls back to the general rule — whichever miniboss was spared, or the nameless tide-wretch if none were.

## 7. What this needs from the engine (not being built now — flagging the gap)

Current `CampaignDefinition` (`src/game/data/campaigns.ts`) is flat — one map, one boss, one wave list, no chapters, no flags, no companion state. `CampaignProgressSystem` persists only a completed/not-completed boolean per campaign. Turning this design into something playable will eventually need (in some future phase, not now):

- A chapter concept within a campaign (4 per region instead of 1 flat wave list)
- A world-flag store (per-choice booleans/enums, persisted, readable by later regions and the capstone)
- A companion-catalogue + active-roster model (recruit/bench/lose, backed by `HeroDefinition`)
- Some minimal way to deliver chapter-boundary text (even a static text panel, no need for a full dialogue engine yet)

None of this is proposed for immediate implementation — it's here so the next engineering conversation starts from a clear list instead of rediscovering these gaps mid-build.

## 8. Pre-region bonus choice (inspired by Heroes of Might & Magic III campaigns)

Before starting (or replaying) any region, offer a choice of 3 bonuses, HOMM3-style. Also applies to the capstone.

**Categories** (each fills a different kind of advantage on purpose, not just a different amount of the same currency — this is what keeps them from collapsing into "always pick the biggest number"):

- **Gold** — flexible, spend-it-yourself power; the slowest of the four to convert into actual board strength, since you still have to buy something with it.
- **XP** — guaranteed, permanent character power; can't be misallocated, but also can't react to what a specific region throws at you.
- **Equipment** (mundane or magical) — a specific, build-defining item, drawn from the existing equipment/magic-item data. Best when it's flavor-tied to the region (an Emberford offer referencing Cinderlord's forge, say) — a good spot for small worldbuilding payoff, not just a stat block.
- **Free structure or trap** — immediate board-state/tempo advantage, placed at the region's start. Disproportionately strong on hazard-heavy maps (Causeway, Cinderfall Rift) and weak on maps where it doesn't fit the geometry — a reason a pool needs to be curated per region rather than shared globally.

**Fixed-per-region vs. random-per-region — resolved as a hybrid:** curate a pool of ~5-6 options per region (not just 3), sized to the region's level band, and **randomly draw 3 from that pool** each time the region is started or replayed. This is what actually solves the balance worry you raised — rather than hand-checking that one specific triplet is fair, every option in a region's pool is built to be a peer in value *and* usefulness at that tier, so **any** 3-subset drawn from it is automatically balanced. It also keeps the thematic specificity fixed triplets would give (region-flavored options) while adding real replay variance, and it's far less content to author than a fully bespoke triplet per region.

**Escalation:** each region's pool is sized to its region's overall level band, not a flat amount — region 1's best gold offer should be modest, region 6's should be substantial, matching the existing per-region wave/reward scaling already implied by `lootPoolIds`. The capstone's own bonus choice (if it has one) should be the strongest tier of all, and could itself be flavored by which ending variant is currently favored (see §5's Nameless Throne dressing) rather than being a third, separate thing to design.

**Not decided yet:** exact numeric budgets per region. **Resolved (D-188):** the capstone does NOT get a bonus-choice screen — a documented scope cut, since there's no region after it to carry a bonus into.

## 9. Resolved this pass / still open

**Resolved:**
- PC's "why am I not immune" hook stays intentionally ambiguous — both endings (§5) work without ever answering it directly.
- Saltmere's Ch1 fallback: a nameless, loreless miniboss-tier reskin (§4), with a full priority order now defined.
- Party is full (PC + 3) from Region 1 Ch1 onward — starting trio vs. recruitable trio (§6).
- Drowning Vale's companion fate is a 3-outcome branch chain across Region 4, not a single flag (§6).
- Companions are named: Hollis Vane, Fenna Duskwater, and Isolde Varnhall (starting trio); Tamsin Rourke, Dorian Wick, and Sorrel Thane (recruitable trio) (§6).
- The roster is 12, not 6 — one companion per playable class, real `CharacterBuild` data as of D-177 (§6). The six new class-coverage recruits (Barbarian/Bard/Cleric/Monk/Rogue/Sorcerer) are ordinary recruits, not boss-mirrors.
- A "Lost" Sorrel Thane outcome is confirmed to reappear as Saltmere's corrupted encounter, taking priority over the generic spared-miniboss rule (§4, §6).
- The capstone is a new, dedicated map — **The Nameless Throne** — with a fixed layout and two terrain/enemy dressings keyed to the ending (§5).
- The PC is player-named through the existing character-creation flow — no canon name.
- Pre-region bonus choices exist, HOMM3-style, resolved as a per-region curated pool with random draw-of-3 (§8).
- **Addendum (D-184, outside this doc's original 6-region scope):** the "forced starting mission" gate this doc never specified is now a 7th, standalone piece of content — "The Proving Ground," a fixed one-time prologue mission, deliberately NOT one of the 6 regions and NOT `TEST_MAP` (which stays reserved as Free-Play-only per §2). Every fresh campaign save must clear it once before any of the 6 regions unlock. See D-184 in `DECISIONS.md` for the full build.
- **Addendum (D-185):** Sorrel Thane's 3-outcome branch chain (line 139/142 above) is now actually BUILT, not just designed — a choice each of Drowning Vale's Chapters 1-3, resolved by Chapter 4. Redeemed and Marked are deliberately flavor-only this pass (Kevin's own scoping call — no stat/gear bonus yet); Lost is fully real (permanent roster removal, a new corrupted encounter taking Saltmere's returning-miniboss slot). Giving Redeemed/Marked real mechanical weight remains open — see the "still open" branch-choice-weight item below, which now applies to Sorrel's own two milder outcomes too, not just the other five companions. See D-185 in `DECISIONS.md`.
- **Addendum (D-186):** the six Pool A class-coverage recruits' own "side-quest missions" (§6, D-183's own "not built this session" deferral) are now actually BUILT — a fixed, flat, 3-wave mission per companion, reachable any time from Companion Roster, recruiting them onto the bench on victory. Deliberately reuses existing region maps and existing regular-tier enemies rather than authoring new ones, matching D-184's own Proving Ground precedent for a small, self-contained mission. This closes D-183's last remaining deferred item for Pool A. See D-186 in `DECISIONS.md`.
- **Addendum (D-187):** D-183's other deferred item, "a rule that a companion's own unlock mission must include them," is now actually BUILT — clarified with Kevin first (the literal reading is a paradox, since the companion can't already be "in the party" before their own recruiting battle). The real rule: the companion being unlocked fights alongside the player IN the mission that recruits them — a 3-hero squad (PC + the newcomer + 2 freely-chosen already-recruited companions) for that one battle, picked on a new "Prepare the Mission" screen rather than gated/locked. Applies uniformly to both pools: a Pool A side mission (D-186), or a Pool B region's own Chapter 1 (§6) before that region's companion is recruited. This closes D-183's own deferred-item list entirely. See D-187 in `DECISIONS.md`.
- **Addendum (D-188):** §5's capstone, **The Nameless Throne**, is now actually BUILT — the last unbuilt piece of this whole doc. Kevin's own direct ask: "build the capstone now... epic, a true masterpiece." Two scope forks confirmed with Kevin before building: the ending signal reuses the EXISTING Finish-or-Spare miniboss flags and Sorrel Thane's fate arc (no new chapter-boundary prompts across all 6 regions, contrary to a literal reading of "a series of choices" as needing brand-new content), and the capstone is one flat finale battle, not a second 4-chapter region. Valence mapping (a first-pass reading, not specified by this doc's own text): sparing/mercy leans Ashen Sovereign ("held on"), finishing/expedience leans The Hollow Empress ("let it be useful"), a genuine tie resolves to Ashen per this section's own "true ending" framing. §8's own "not decided yet" question is now resolved: the capstone does NOT get a bonus-choice screen this pass — a documented scope cut, not an oversight. See D-188 in `DECISIONS.md`. This closes this doc's entire §2-§8 design/build arc — only the two "still open" items directly below remain.

- **Addendum (D-189):** both of the two items directly below are now
  actually BUILT, closing this doc's entire remaining scope. Kevin's own
  direct ask, scoped to "both, full scope" when asked which of the two he
  meant: (1) a real first-draft dialogue pass for all 6 original
  companions — an arrival beat (`data/companionDialogue.ts`'s
  `COMPANION_RECRUITMENT_DIALOGUE`) when their own home region's Chapter 1
  clears, real `introText`/`outroText` on all 24 region chapters, and a
  "homecoming beat" (`COMPANION_MIRROR_REACTION_DIALOGUE`) when their
  region's own Ch4 mirror boss falls — two of which (Fenna/Saltmere,
  Isolde/Frostbound) react with genuinely different TONE depending on the
  player's accumulated mercy-vs-expedience pattern across the campaign so
  far, via a new shared `NamelessThroneSystem.mercyTallyLeansHollow`
  helper; and (2) real mechanical weight for the Finish/Spare and Sorrel
  Redeemed/Marked branch choices — an immediate gold reward for sparing
  any home miniboss, and real (not flavor-only) rewards for Sorrel's
  Redeemed (a healing staff) and Marked (a smaller gold grant) outcomes,
  closing the D-185 addendum's own explicitly-flagged gap. Deliberately
  bounded, per Kevin's own approved scope: no changes to level-up/ASI/
  subclass selection, and no new branch-choice chains invented for the
  other 5 companions — only Sorrel has one, per this doc's own §6. See
  D-189 in `DECISIONS.md` for the full build.

**Still open, carried into the next session:**
- Exact bonus-choice pool contents and numeric budgets per region (§8).
- All of §9's original two "still open" writing/mechanical-weight items
  above are now resolved (D-189) — this doc's entire §2-§9 arc is closed.
  A `CONTENT_SOURCES.md` entry for the new dialogue content was added at
  build time (D-189), matching how every other original-content session in
  this project has handled it.
