# Known Issues and Limitations

## Open bugs (confirmed by Kevin, not yet fixed)

None currently — the two bugs Kevin confirmed 2026-08-21 (waypoint pinning,
Main Menu title/corner-control overlap) were fixed by D-149; see KI-101
below for their own re-confirmation checklist. The two bugs Kevin confirmed
2026-08-22 (Main Menu corner controls overlapping the frame border, and
Character Creation's Start/Back buttons rendering off-screen entirely after
"New Game") were fixed by D-159 — a revert of D-157's `Scale.RESIZE`
cutover back to `Scale.FIT`; see KI-109 below for what broke and why. The 8
items Kevin reported 2026-08-24 were investigated and fixed (or, for the
horizontal-squish bug, mitigated on a best-effort basis — see KI-113) by
D-160 through D-164; see those KI entries below for their own
re-confirmation checklists, ordered newest first.

## Still need Kevin's playtest confirmation

Every item below is **(headless-verified, not yet played)** unless noted
otherwise — typecheck/tests/build all pass, but Kevin hasn't seen it in a
real browser battle yet. Ordered newest first.

### KI-139 — D-189: companion dialogue writing pass + real mechanical weight for branch choices (KI-098 item 13's last two open items, CAMPAIGN_STORY_DESIGN.md §9)
- Clear any region's Chapter 1 for the first time — confirm a real
  multi-line dialogue beat (portrait-less, named speaker) plays for that
  region's Pool B companion, replacing the old flat "has joined your
  roster (bench)" combat-log line (that line still appears too — it's the
  roster-state record, unchanged).
- Clear any region's Chapter 4 (the region's own finale boss) — confirm a
  second dialogue beat plays right after that chapter's own closing line,
  that companion's personal reaction to their mirror boss going down. Skip
  this check for Drowning Vale if Sorrel was Lost — her beat is
  deliberately suppressed once she's permanently removed from the roster.
- Specifically for Saltmere Shallows (Fenna) and Frostbound Hollow
  (Isolde) Chapter 4 — confirm the reaction beat's TONE differs between a
  playthrough that mostly Spared minibosses/supported Sorrel (should read
  as the more hopeful "ashen" variant) versus one that mostly Finished
  minibosses/pressed Sorrel (should read as the colder "hollow" variant).
- Finish or Spare a home miniboss (any of the 5) — confirm Spare now shows
  an extra "owes you now — +20g" combat-log line and the gold total
  actually increases, on top of the existing "is spared, and slips away
  wounded" line.
- Clear Drowning Vale Chapter 4 with Sorrel's fate landing Redeemed —
  confirm a "Sorrel's gratitude" combat-log line appears and a hero is
  either equipped with a Staff of Healing or, if no hero has a free matching
  slot, gold increases by its sell value instead. Landing Marked instead —
  confirm a distinct "Sorrel presses something into your hand" line and a
  smaller (+25g) gold increase.
- Known, first-pass content: all 24 chapters' intro/outro text and every
  companion dialogue beat are first-pass writing, explicitly "punch-up-able
  rough material" per Kevin's own framing — flag directly if any of it
  reads wrong, same as every other new-content session in this project.

### KI-138 — D-188: The Nameless Throne, the campaign capstone (KI-098 item 13's last remaining piece, CAMPAIGN_STORY_DESIGN.md §5)
- On a genuinely fresh save (or one that hasn't finished all 6 regions),
  open Campaign Select — confirm "The Nameless Throne" shows as `[Locked]`
  with "Complete all 6 regions to unlock" in place of its boss/wave line,
  the same visual treatment The Proving Ground's own locked cards use.
- Clear all 6 regions (Emberford Reach/Shattered Causeway/Cinderfall Rift/
  The Drowning Vale/Saltmere Shallows/Frostbound Hollow — the whole
  campaign, not just Chapter 1 of each) — confirm the capstone card
  unlocks and becomes clickable.
- On a save where you SPARED most/all of the 5 sparable minibosses (or
  chose "support" for Sorrel across Drowning Vale) — confirm the capstone
  opens with a flavor line about the hall still holding "a shape you
  recognize — ash and ember," the map's 4 hazard tiles show as fire, the
  garrison enemies read as Ember Thane/Cinder Adept/Ashbound Honor Guard,
  and the finale boss is the Ashen Sovereign.
- On a save where you FINISHED most/all of the 5 sparable minibosses (or
  chose "press" for Sorrel) — confirm the capstone opens with a colder
  flavor line, the map's 4 hazard tiles show as water, the garrison enemies
  read as Drowned Thane/Hollow Caller/Drowned Honor Captain, and the finale
  boss is The Hollow Empress.
- Win either variant — confirm a closing dialogue beat plays before the
  "Victory!" screen: the Ashen ending should have the PC name every
  companion still on your roster (active or benched) out loud by name; the
  Hollow ending should have the PC reach for a name and come up empty.
  Test with at least one companion benched (not just active) to confirm
  benched companions are included in the Ashen naming beat.
- Confirm the capstone's pre-battle card on Campaign Select always reads
  "Boss: Ashen Sovereign" even on a save headed for the Hollow Empress —
  this is a known, deliberate non-spoiler (matches how Saltmere's card
  always says "Boss: Tidelord"), not a bug.
- Confirm a miniboss that reached the exit (breached) rather than being
  explicitly Finished or Spared counts the same as "Finished" toward the
  ending lean — a known, deliberate first-pass interpretation (there's no
  separate "breached" flag anywhere), not a bug, but flag directly if it
  reads wrong once you've actually seen it play out.
- Confirm no HOMM3-style "Choose a Bonus" screen appears before the
  capstone battle — deliberately cut this pass (§8 of the design doc left
  this undecided); the battle should start straight into wave 1.
- Known, first-pass content: the map layout, wave composition, all 6 new
  enemy names/lore, and both flavor/epilogue beats are first-pass writing —
  flag directly if any of it reads wrong, same as every other new-content
  session in this project.

### KI-137 — D-187: "a companion's own unlock mission must include them" (KI-098 item 13, closes D-183's own last remaining deferred item)
- Start any Pool A companion's side mission (a locked card in Companions)
  — confirm a new "Prepare the Mission" screen appears BEFORE Character
  Creation, showing 4 cards: "Your Hero," the companion being unlocked
  (locked, green outline), and 2 more slots defaulting to 2 of your
  current active companions.
- Click one of the 2 free slots — confirm a picker opens listing every
  OTHER already-recruited companion (active or benched, not the one
  already in the other free slot, not the locked target), and picking one
  updates that card.
- Confirm you cannot remove or swap out "Your Hero" or the locked target
  companion — only the 2 free cards are clickable.
- Click "Start Mission" — confirm Character Creation opens with slot 1
  free to build as normal, and slots 2-4 showing exactly the 3 companions
  you picked/kept (the target plus your 2 choices), each as a normal
  identity-locked companion slot (equipment/spells/hotkeys/level still
  editable).
- Win that mission — confirm the companion still gets recruited onto the
  bench afterward exactly as before (D-186 behavior, unchanged).
- Now try a Pool B region you haven't started yet (or a fresh save) —
  select it from Campaign Select — confirm the SAME "Prepare the Mission"
  screen appears before Character Creation for that region's Chapter 1
  ONLY, with that region's own companion locked in.
- Clear that region's Chapter 1, then start Chapter 2 (or replay Chapter
  1) — confirm the party-selection screen does NOT appear this time
  (normal Character Creation opens directly), since the companion is
  already recruited.
- Free Play, Co-op, a loaded save, and every other entry point — confirm
  all of these are completely unaffected (no new screen, normal party
  building).
- Known, deliberate scope: the 2 free slots default to your current active
  roster, not a true "battle history" — if that ever reads as wrong (e.g.
  it should remember someone you recently benched instead), flag it
  directly.

### KI-136 — D-186: Pool A companion side-quest missions (KI-098 item 13, closes D-183's own deferred "side-quest missions" item)
- Open Campaign Select → Companions on a fresh save — confirm exactly 3
  Pool A cards (Brand Ashcairn/Wren Calloway/Perrin Holt/Mira Quill/Cass
  Ferrow/Ellery Vance) show as Active and the other 3 show as LOCKED with
  name/class hidden ("???"), same as before this session.
- Click one of the locked Pool A cards — confirm its badge reads "LOCKED —
  click for a side quest" (not the plain "LOCKED" a locked Pool B/region-
  mirror card still shows) and clicking it opens Character Creation with
  your current 3 active companions already prefilled, exactly like picking
  a region from Campaign Select.
- Win that mission — confirm a combat-log line announces the companion
  joining the roster (bench), then open Companions and confirm that card
  now shows their real name/class as Benched, no longer "???".
- Confirm the newly-unlocked companion was NOT forced into an active slot
  (the active 3 should be unchanged) — matches the same "never force-
  active" rule the Pool B home-region unlock already uses.
- Try a locked Pool B (region-mirror) card — confirm it's still NOT
  clickable and still shows the plain "Unlocks: <Region> Ch. 1" hint,
  unaffected by this session's changes.
- Confirm each side mission plays as a short (3-wave), low-difficulty
  battle — not meant to scale with how far into the campaign you are; flag
  directly if any of the 6 feels miscalibrated once you've actually played
  a few.
- Known, deliberate scope: no new maps or enemies were authored — each
  mission reuses one of the 6 existing region maps and an existing regular-
  tier enemy as its finale (never a miniboss/boss, so it can't affect the
  returning-miniboss mechanic). The 6 mission names/descriptions are
  first-pass writing — flag directly if any of it reads wrong.
- Known, deliberate scope: nothing gates these missions (unlike The Proving
  Ground) — they're reachable from Companion Roster at any point in a
  playthrough, by design.

### KI-135 — D-185: Sorrel Thane's fate arc — Redeemed / Marked / Lost (KI-098 item 13, closes the gap D-182/D-183 both flagged and deferred)
- Start (or continue) Drowning Vale Chapter 1 — confirm a "Sorrel Thane"
  choice popup appears right after any chapter intro (if written) and
  before the D-181 "Choose a Bonus" screen, with 2 options. Pick either and
  confirm the battle continues normally afterward.
- Play Drowning Vale Chapters 2 and 3 — confirm the SAME choice popup
  appears again each time, with different text per chapter, and that
  picking consistently ONE side (support, or press) across all 3 chapters
  is possible.
- Play Drowning Vale Chapter 4 — confirm a one-time combat-log line appears
  early in the battle announcing Sorrel's fate (no popup, just a log line):
  picking "support" all 3 times should read as a good outcome (Redeemed);
  picking "press" all 3 times should read as a bad one (Lost); a mixed
  record should read as Marked (survived, changed).
- After a Redeemed or Marked Chapter 4 clear, open the Companions screen —
  confirm Sorrel Thane still shows as Active/Benched normally (whichever
  she already was), NOT as Lost.
- After a LOST Chapter 4 clear, open the Companions screen — confirm Sorrel
  Thane now shows as "LOST" (dimmed, name hidden, per the screen's existing
  4th-status rendering) even if she was previously active in your party.
- With Sorrel Lost, start (or replay) Saltmere Shallows Chapter 1 — confirm
  a corrupted encounter named after her (not the plain Tide-Wretch, and not
  a different region's spared miniboss even if one was also spared) spawns
  as the wave-4 finale, with a one-time flavor line in the combat log the
  first time she appears.
- With Sorrel Redeemed or Marked (not Lost), confirm Saltmere Ch1 falls
  back to the NORMAL returning-miniboss rule (a spared miniboss, or the
  plain Tide-Wretch) — completely unaffected by her fate either way.
- Known, deliberate scope, confirmed with Kevin directly: Redeemed and
  Marked are flavor-only this pass — no stat/gear bonus, no visible
  mechanical difference between the two beyond the log line and the (as-
  yet-unsurfaced-elsewhere) fate flag. If either feels like it should carry
  a real mechanical reward/change, that's a future slice, not a bug.
- Known, deliberate scope: the 3 chapter choice prompts, Sorrel's Lost
  flavor lines, and `corrupted-sorrel`'s name/loreText are all first-pass
  writing — flag directly if any of it reads wrong.
- A save that cleared Drowning Vale entirely before this session (no
  recorded choices at all) should land on Marked, not Lost, the first time
  its Chapter 4 is replayed under this new code — confirm this reads as a
  reasonable default, not a bug, if you happen to have such a save.

### KI-134 — D-184: The Proving Ground, a new one-time prologue mission gates the six regions (KI-098 item 13, closes D-183's own deferred "forced starting mission" item)
- From a genuinely fresh save (no prior campaign progress), open Campaign
  Select — confirm "The Proving Ground" is the first card and is the ONLY
  unlocked/clickable one; all 6 regions below it should show `[Locked]` in
  the title, a dimmed card, and "Complete The Proving Ground to unlock" in
  place of their usual boss/wave line.
- Click "The Proving Ground," build a party (should get the usual
  campaign-mode companion prefill), and clear its 3 short waves. Confirm
  the finale wave's `brute` behaves like any ordinary enemy (no special
  boss mechanics expected — it's a placeholder, not a real named threat).
- Return to Campaign Select — confirm all 6 regions are now unlocked
  (full color, clickable, real boss/wave text showing again) and "The
  Proving Ground" itself now shows `[Completed]`.
- Confirm a save that already had region progress from BEFORE this session
  isn't retroactively locked out or asked to replay anything — this only
  matters for a save where `isCampaignCompleted(progress, "prologue")` is
  false, i.e. genuinely fresh saves and any save made before this session
  shipped (if Kevin's own save predates D-184, the very first Campaign
  Select visit after upgrading will show the 6 regions locked until The
  Proving Ground is played once — confirm this is what actually happens
  and that it reads as reasonable, not confusing).
- Confirm Free Play is completely unaffected — no new map, no new boss
  option, no lock of any kind there; the prologue is Campaign-mode-only by
  design.
- Confirm the D-181 "Choose a Bonus" screen does NOT appear when starting
  The Proving Ground (it deliberately has no curated bonus pool) — the
  battle should just start straight into wave 1, same as Free Play or the
  classic flat campaign always did before any region had a bonus pool.
- Known, deliberate scope: "The Proving Ground" name, its `brute` finale
  enemy, and its plain description are all first-pass content choices, not
  deeply considered lore — flag directly if any of it reads wrong and it's
  a one-line change to adjust.

### KI-133 — D-183: companion roster & recruitment UI, Phase 1 (KI-098 item 13, materially extends CAMPAIGN_STORY_DESIGN.md §6)
- Start a genuinely fresh campaign playthrough (a browser/profile with no
  prior companion-roster save) and go to Campaign Select. Confirm 3 of the
  6 class-coverage companions (Brand Ashcairn/Wren Calloway/Perrin Holt/
  Mira Quill/Cass Ferrow/Ellery Vance) are already Active on the new
  "Companions" screen, and the other 3 of that six show as Locked ("???").
  Confirm all 6 region-mirror companions (Hollis/Fenna/Isolde/Tamsin/
  Dorian/Sorrel) show Locked with their own home region named.
- Enter Character Creation for any region campaign. Confirm slots 2-4 are
  pre-filled with the roster's 3 active companions (name/class shown, a
  "(Companion)" tag on the Class row), that clicking Class/Race on those
  slots does nothing, and that equipment/starting level/spells/hotkeys are
  still freely editable on them. Confirm the Party Size control is disabled
  and reads "(fixed for campaigns)".
- Play any region's Chapter 1 to completion. Confirm that region's own
  mirror companion appears Benched (not Active) on the Companions screen
  afterward, with a combat-log line noting they joined.
- On the Companions screen, click a Benched companion and swap them in for
  an Active one; confirm the swap sticks (persists across a scene revisit)
  and that the next Character Creation visit reflects the new active 3.
- Confirm a plain "Create Party" (no campaign) and Free Play are BOTH
  completely unaffected — full manual party builder, any party size 1-4,
  no companion prefill, no "Companions" button visible outside Campaign
  Select.
- Known, deliberate scope (Kevin's own call, see D-183): the other 3 Pool A
  companions per playthrough, the forced "starting mission," a companion
  being required in their own unlock mission, and Sorrel Thane's fate arc
  are all NOT built this session — future item-13 slices.

### KI-132 — D-182: returning-miniboss spare-or-destroy choice (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §4)
- Play any of the 5 "home" regions' Chapter 1 (Emberford Reach, Shattered
  Causeway, Cinderfall Rift, The Drowning Vale, or Frostbound Hollow) to the
  finale and defeat the named miniboss (Basalt Colossus/Juggernaut/Gravemaw/
  The Husk/Bloodrage Warlord). Confirm a "Finish or Spare?" popup appears
  BEFORE the victory screen, blocks the board, and both buttons actually
  close it and let the battle end normally either way.
- Choose "Spare" on one of those minibosses, then start (or replay) Saltmere
  Shallows Chapter 1. Confirm the SAME miniboss (by name/sprite) appears as
  the wave-4 finale spawn instead of the nameless Tide-Wretch, and that a
  one-time flavor line about it washing ashore appears in the combat log
  when it spawns.
- With nothing spared yet (a fresh save, or every earlier miniboss
  "Finished"), confirm Saltmere Ch1 still spawns the plain Tide-Wretch,
  unchanged from before this session.
- Spare minibosses in more than one region, then play Saltmere Ch1 — confirm
  only ONE returns (the earliest-region one spared), not several.
- Confirm "Finish" doesn't change anything about kill gold/loot/Bestiary
  credit for that enemy — it should behave exactly as defeating any other
  enemy always has.
- Known, deliberate scope: the design doc also wants a Sorrel Thane
  "Lost"-outcome override to take this slot ahead of a spared miniboss —
  NOT built this session (see D-182's own reasoning; that needs the
  not-yet-built companion-fate system, a separate item-13 slice).
- Known, deliberate scope: the returning miniboss is the exact same
  enemy/stat block reappearing, not a new "corrupted variant" — only its
  one-line spawn flavor text is new. If this feels underwhelming compared
  to the design doc's "washed up corrupted" framing, that's worth flagging.

### KI-131 — D-181: pre-region bonus-choice screen (KI-098 item 13, CAMPAIGN_STORY_DESIGN.md §8)
- Start (or replay) ANY chapter of ANY of the 6 real campaigns — right
  after the chapter-intro text (if that chapter has any) and before the
  ASI/subclass/spell-pick fast-forward prompts, a new "Choose a Bonus"
  screen should show exactly 3 cards, randomly drawn from that region's
  own pool. Picking one should apply immediately: Gold shows up in the
  gold HUD right away; the XP option's HP boost should show in every
  living hero's health bar; the Equipment option should show the named
  item already equipped on whichever hero picked it up (check the Gear
  screen); the Structure option should show a real, already-built
  structure/trap on the board before wave 1 starts.
- Confirm there's no way to skip/cancel this screen — it should always
  require picking one of the 3 before the battle can continue (unlike the
  Free Play/classic Create Party flow, which should show nothing at all —
  this screen is real-campaign-only).
- Play the SAME chapter a second time (or a different chapter of the same
  region) and confirm the 3 offered cards can come out differently — it's
  a random draw each time, not a fixed triplet.
- Known, deliberate scope: every "Equipment" option across all 6 regions
  is a modest common/uncommon item on purpose (not scaled by region tier)
  since the screen can appear at a region's own Chapter 1 (level 1-5) —
  confirm this doesn't feel like an anticlimactic reward choice by the
  time you reach that region's Chapter 4 (level 16-20); if it does, the
  fix is a per-chapter-tier equipment pool, not a re-scope of this pass.
- Known, deliberate scope: the bonus choice re-offers every chapter (not
  literally once per region, per the design doc's own wording) — see
  D-181's own reasoning for why. If this feels repetitive across a
  region's 4 chapters, that's worth flagging directly.

### KI-130 — D-180: Shattered Causeway/Cinderfall Rift/The Drowning Vale/Frostbound Hollow given real 4-chapter regions (KI-098 item 13, continuing KI-129)
- From `CampaignSelectScene`, all six campaign cards should now show
  "Chapter N of 4 · Boss: X · N waves" — the four new ones (Shattered
  Causeway, Cinderfall Rift, The Drowning Vale, Frostbound Hollow) never
  had a card at all before this pass (their maps were Free-Play-only).
  Pick one, play Chapter 1 through to victory, confirm Chapter 1 ends in
  its own named miniboss fight (Juggernaut / Gravemaw / The Husk /
  Bloodrage Warlord, respectively), then confirm Chapter 2 is a real but
  lighter first encounter with the region's actual finale boss (The
  Devourer / Warlord Korrath / Blightmother / Sundered King).
- In `FreePlayScene`, these four maps and their 8 associated bosses
  (Juggernaut, Warlord Korrath, The Devourer, Gravemaw, Blightmother, The
  Husk, Bloodrage Warlord, Sundered King) were always-unlocked before this
  pass (no campaign existed to gate them on) — they should now show
  "locked" until that region's campaign is completed, same as
  Emberford/Cinderlord and Saltmere/Tidelord already worked.
- Cinderfall Rift's mid-battle bridge collapse and The Drowning Vale's
  tide rise/recede are unchanged map-level `DynamicTerrainEvent`s keyed to
  a wave NUMBER, not a chapter — in the new 4-wave chapters (Ch1-3) this
  means the collapse/flood-rise lands on that chapter's own last wave
  (intentional-feeling, not verified in a real playthrough); Ch4 (6 waves)
  keeps the original pacing exactly.
- Same known, deliberate scope as KI-129: no cross-chapter continuity, no
  intro/outro chapter text yet, end screen still routes to Main Menu after
  a mid-region chapter clear.

### KI-129 — D-179: Emberford Reach/Saltmere Shallows migrated to real 4-chapter regions (KI-098 item 13)
- From `CampaignSelectScene`, pick either campaign — the card should now
  show "Chapter N of 4 · Boss: X · N waves" (the UPCOMING chapter's own
  info, not always the region's ultimate finale boss). Play Chapter 1
  through to victory, then return to Campaign Select — the same campaign's
  card should now say "Chapter 2 of 4" and starting it again should play
  Chapter 2's own (new) wave list, not Chapter 1's again.
- Clear all 4 chapters of one region in sequence — only after Chapter 4
  clears should the card show "[Completed]"; clearing Chapters 1-3 should
  NOT mark the whole region completed early.
- Confirm Emberford Ch1 ends in a real Basalt Colossus fight and Saltmere
  Ch1 ends in a fight against a new, unnamed enemy ("Tide-Wretch") — this
  is the design doc's own documented placeholder for a "returning
  miniboss" mechanic that isn't buildable yet (see D-179), not a bug.
- Known, deliberate scope, confirmed with Kevin directly before building:
  chapters do NOT carry gold/gear/class level over from one chapter to the
  next — every chapter is still a fresh, self-contained battle (use the
  existing Starting Level control in Character Creation as a manual stand-
  in for "you're further into the region now"). A real cross-chapter
  persistence system is a separate, bigger future undertaking, not
  attempted this pass.
- Known, accepted UX rough edge: the victory end screen still routes to
  Main Menu even after clearing a mid-region chapter, not back to Campaign
  Select — progress is still correctly saved either way, you just have to
  navigate back to Campaigns yourself to see/start the next chapter.
- No chapter has any intro/outro story text yet (that's a separate, later
  writing session per Kevin's own explicit instruction this session) — the
  rendering plumbing for it exists and is wired in, just nothing to show.

### KI-128 — D-178: removed the "signature action" system; every hero's basic attack now comes from its own class
- Build a party of any class mix in Character Creation — there should be
  NO "Choose Signature Action" button/step anywhere in the wizard anymore,
  and no visible gap left where it used to sit (the Gear row should now
  sit directly under the ability-score rows).
- In battle, select a NON-caster hero (Fighter/Rogue/Barbarian/Monk/
  Paladin/Ranger) — there should be no "Ability: X (Q)" button at all.
  Its only offensive action is clicking an enemy (the real weapon Attack);
  its class-specific tricks (Second Wind, Rage, Sneak Attack, Divine
  Smite, Hunter's Mark, etc.) should all still work exactly as before,
  each on its own existing button.
- Select a CASTER hero (Wizard/Cleric/Bard/Druid/Sorcerer/Warlock) — "Cast
  a Spell (Q)" should still open the full spellbook exactly as before;
  this path is completely unchanged.
- Open the Character Sheet for a non-caster — the "Available Right Now"
  section should read "Action: Attack (click an enemy on the board)"
  instead of naming a specific ability.
- Known, accepted limitation, not fixed this pass: if a hero equips a
  weapon whose melee/ranged style or best ability doesn't match their
  class's own fixed baseline (e.g. a STR-melee Fighter equipping a DEX
  finesse weapon), the to-hit bonus's ability-modifier component won't
  re-derive from the new weapon — it stays pinned to the class baseline.
  This bug already existed before this change (previously pinned to
  whatever ability the player had picked instead); this change doesn't
  make it worse, just changes what it's pinned to. A real fix needs
  `Hero.effectiveAttackBonus` to recompute its ability-modifier component
  from the equipped weapon live, same as `effectiveAttackDamage` already
  does — not attempted this pass.

### KI-127 — D-176: dynamic per-map tile size + bigger maps (KI-098 item 9, closes the KI-098 build backlog)
- Play a battle on any EXISTING map (all still 14-18 cols x 8-9 rows) —
  everything should look and feel pixel-identical to before: the grid,
  every hero/enemy token, highlights, and every combat VFX all still render
  at the same 64px tile size as always. This is the main regression risk —
  confirm nothing shifted even slightly on current content.
- In Map Builder, create a new map bigger than the old 20x9 cap (try
  something like 28x12 or the new max 32x14) and Playtest it — the grid
  should shrink to fit smaller tiles (as small as 40px at the new caps)
  rather than running off the canvas, and every token/highlight/VFX should
  scale down proportionally and stay legible/clickable. This is genuinely
  new territory — nothing this size has ever been played before.
- Known, deliberate scope: the 40px minimum-tile-size floor (and the
  resulting 32x14 caps) is a first-pass balance value, not a final one —
  if bigger maps feel too cramped or too sprawling once actually played,
  the floor is the one number to revisit, not the shrink-to-fit mechanism
  itself. Also known: a much bigger map will take an enemy noticeably more
  phases to cross than existing maps do — wave/difficulty pacing has never
  been tuned against a board this size, so a large custom map may feel
  slower or faster-paced than the shipped maps until someone actually plays
  one and adjusts wave composition/spawn timing to match.

### KI-126 — D-175: per-group initiative for the enemy phase (KI-098 item 10)
- With two or more enemy types active on the board at once (e.g. a mixed
  Grunt/Runner wave), each type should visibly act as its own block each
  enemy phase — all the Grunts move/attack, then all the Runners (or vice
  versa), not interleaved one-of-each.
- That same ordering (which type goes first) should stay consistent phase
  after phase within one wave — it shouldn't flip around turn to turn.
- Starting the NEXT wave should be free to pick a different order (a fresh
  roll) — no expectation that wave-to-wave order stays the same.
- A boss/miniboss should act as its own group of one, same as before this
  change from an observed standpoint — this doesn't visibly reorder
  anything relative to a single-enemy-type wave, since a lone type has
  nothing to be reordered against.
- Known, deliberate limit: grouping is by enemy TYPE, not by spawn wave/
  lane — two Grunts spawned from different spawn points still act as ONE
  group together, not two separate ones.

### KI-125 — D-174: level cadence changed to every wave (KI-098 item 11/12)
- Clear a single wave (any mode) — every living hero should reach the next
  class level immediately after that wave's reward, same popup/ASI/
  subclass/spell-pick flow as before, just now firing every wave instead of
  every other wave.
- A multi-wave campaign should now reach late-game class levels roughly
  twice as fast as before this change — worth a glance at whether a full
  campaign now overshoots level 20 well before its last wave (if so, that's
  expected fallout from this change, not a bug — `Hero.levelUpClass()` caps
  at 20 regardless of how many wave-clears fire after that).
- Known, deliberate scope: no new "XP" or "kill credit" UI anywhere — this
  is purely a cadence-constant change to the existing uniform group-level
  system, not a new economy. A separate overworld/campaign-only leveling
  track is a distinct, not-yet-designed thing — see item 13 in this file's
  KI-098 list.

### KI-124 — D-173: hero-side split movement (KI-098 item 8, closes the Enemy AI/Movement Redesign epic)
- Select a hero, move it PART of its movement range (not the full amount),
  attack (or cast/use a bonus action) — after the action resolves, the move
  range highlight should reappear around the hero showing however many
  tiles are actually left, not zero.
- Moving again with that leftover budget, then confirming, should work
  exactly like a normal move — including a SECOND leftover move afterward
  if any budget remains (e.g. a Goliath or a Monk with a big enough total).
- The drag-and-drop move (D-144: click-and-hold, right-click to pin
  waypoints) should behave identically for a partial-budget drag as it
  already does for a full-budget one — dropping short of the full budget
  should leave the remainder spendable the same way a click-confirm move
  does.
- A hero that uses its ENTIRE movement in one move (or one multi-pin drag)
  should show no move range at all afterward — same as before this fix.
- A Rogue's Cunning Action Dash (bonus action) should still grant a full
  extra move — try it BOTH after a hero has used its whole move already
  (should behave exactly as before: one fresh full move) AND after only a
  partial move (should now show noticeably MORE than a single fresh move —
  the leftover plus a full Dash speed stacked on top, real SRD math).
- A hero that's already spent its whole movement budget for the turn should
  still show no move range on any later reselect this same turn (e.g.
  select it, deselect, reselect) — leftover budget only ever ticks down or
  resets on a new turn, never regenerates from reselecting.
- Known, deliberate limit: this only applies to a human-controlled hero's
  own move — an AI-controlled hero (Co-op's partner-controlled heroes) still
  spends its whole movement budget in one shot per turn, unchanged; no UI
  exists for an AI hero to "move again" mid-turn.

### KI-123 — D-172: real D&D movement speed, 1 tile = 5ft (KI-098 item 7's map-size follow-up)
- A standard-speed hero (Human, Elf, Half-Elf, Half-Orc, Dragonborn, Gnome,
  Orc, Tiefling) should now show a move-range highlight 6 tiles across
  (was 3) — noticeably bigger on the board.
- Dwarf/Halfling should show 5 tiles (was 2); Goliath should show 7 tiles
  (was flattened to 3 by D-170) — genuinely faster than every other race
  now, not just "not slow."
- A Monk (level 2+) or Barbarian (level 5+) should show +2 tiles on top of
  their race's own speed (was +1).
- Boots of Striding and Springing should grant +2 tiles (was +1); Boots of
  Speed and Potion of Speed should each grant +4 (was +2).
- The "slowed" status should reduce movement by 4 tiles (was 2) — a Grunt
  hit by it should still visibly hold in place (its own speed also
  doubled to 4, so 4-4=0, same "fully slowed" result as before).
- Every enemy on the board should visibly cover roughly twice as much
  ground per enemy phase as before, across the board (minions, runners,
  bosses) — overall pacing (how many phases a wave takes to cross a given
  map) should feel about the same as before, since map sizes haven't
  changed yet (see KI-098 item 9's own note on what's still pending there).
- Known, deliberate scope: this item is movement-speed numbers ONLY — no
  map size, canvas, or `TILE_SIZE` change is part of this fix; item 9
  above covers that separately, with new risk-analysis findings of its own.

### KI-122 — D-171: class-based movement bonus (KI-098 item 7)
- A Monk should move 1 tile farther than an otherwise-identical hero from
  level 2 on; a Barbarian should do the same from level 5 on.
- A level-1 Monk or a level-1-4 Barbarian should show no bonus yet; every
  other class should never show this bonus at any level.
- The bonus should stack normally with a race's own speed (including a
  slower one, e.g. Dwarf) and with a gear/potion movement bonus (Boots of
  Striding and Springing/Speed, Potion of Speed) — headless-verified via
  `tests/d171Features.test.ts`, worth a quick visual glance in a real
  battle (does the move-range highlight visibly grow by one ring?).

### KI-121 — D-170: five more playable races (KI-098 item 6)
- Character Creation's Race picker should now list 11 options (the
  original 6 plus Dragonborn, Gnome, Goliath, Orc, Tiefling), each with a
  real speed/trait-name preview line, and should still open/scroll/pick
  cleanly at this larger size.
- Compendium's Races tab should list all 11 alphabetically, each with its
  real trait names and (original-wording) descriptions.
- All 5 new races should move at the standard speed (same tiles/turn as
  Human/Elf) — none should feel slower like Dwarf/Halfling.
- Nothing about the original 6 races' stats/behavior should have changed —
  this was purely additive, plus a documentation-only sourcing correction
  (no game data changed) noted in `DECISIONS.md`'s D-170 for anyone
  curious why the module comment reads differently now.

### KI-120 — D-169: Main Menu's "Build Party" entry point (KI-098 item 5)
- Main Menu's "Continue Your Journey" row should now show a 5th (4th
  without Firebase configured) button, "Build Party," alongside Load
  Game/Campaigns/Free Play/Co-op, with no overlap/clipping.
- Clicking it should open the same Character Creation screen "New Game"
  does — build a party, click "Save Party," then Back (top-left) — it
  should save and return to Main Menu with no battle ever starting.
- Changing your mind and clicking "Start Battle" instead, from a party
  built via this entry point, should work exactly as it does from "New
  Game" — nothing is restricted or different between the two entry paths.

### KI-119 — D-168: cast spells/use actions directly from the Character Sheet (KI-098 item 4)
- Open Character (C) for a caster, go to Spellbook, click a known spell's
  card — the sheet should close and the battle should resume with either
  that spell already resolved (an instant AoE) or the board in aiming mode
  for it (everything else), exactly as pressing Q and picking that same
  spell would.
- On the Stats tab, clicking a non-caster's "Action: {name}" line, the
  "drink a carried potion" line, or any listed bonus/class-action line
  should each close the sheet and fire that exact action on the resumed
  battle, with the same log line pressing its own key (Q/R/T/P) would give.
- A caster's Stats-tab "Action: Cast a Spell (see Spellbook tab...)" line
  should stay plain, non-clickable text — its real click-to-cast entry
  point is the Spellbook tab's own cards, not this summary line.
- Clicking any of these when the underlying action genuinely isn't usable
  (out of spell slots, Silenced, already acted, wrong turn somehow) should
  be a silent no-op — no error, no partial action, no console warning.
- Hovering a spell card should still show its full rules text exactly as
  before (D-148) — this only added a click, the existing hover tooltip is
  unchanged.

### KI-118 — D-167: the roster strip is now a real click/hover target (KI-098 item 3)
- In equip mode (G), select an item from the Gear grid, then click a
  living hero's roster box (not their board token) — it should
  equip/unequip exactly as clicking their token would, including the
  proximity-to-Shop-tile gate, gold spend/refund, and the log line.
- Hovering a roster box while an item is selected in equip mode should
  show the same before/after AC/attack preview the board-token hover
  already shows; hovering it any other time should show plain name/HP/AC.
- Clicking a downed hero's roster box in equip mode should do nothing (no
  error, no partial equip) — matches clicking their (absent) board token.
- Outside equip/build mode, clicking any living, locally-controlled hero's
  roster box should select it — a second way in, alongside clicking its
  board token or pressing its 1-4 number key; all three should behave
  identically.
- Clicking a roster box while in Build mode, or while a debug picker grid
  is open (Test Mode), should do nothing — same as the number-key
  shortcut already ignores those modes.
- The original board-token equip/select flow should behave completely
  unchanged in every mode.

### KI-117 — D-166: the hotkey bar now actually fires in battle (KI-098 item 2)
- Open a hero's Character Sheet (C), pin a known spell/cantrip, a bonus/
  class-action registry entry, and (for a non-caster) its signature
  ability to three different hotkey slots, close the sheet, then select
  that hero on the board — up to 6 small buttons should appear in a new
  row below Class Action/Character, one per filled slot, labeled
  "{slot}: {name}" matching the Character Sheet's own labeling exactly.
- Clicking a spell's hotkey button should behave exactly like picking that
  same spell from the Q spellbook overlay (instant AoE resolves
  immediately; anything else enters the same aiming mode) — including
  spending the correct spell slot/charge and consuming the action.
- Clicking a bonus/class-action hotkey button should fire exactly like
  pressing R/T normally would (Second Wind, Rage, Reckless Attack, etc.),
  with the same log line.
- Clicking a non-caster's signature-ability hotkey (Fighter's Cleave, etc.)
  should behave exactly like pressing Q normally would for that hero.
- A hotkey button for something not currently usable (out of spell slots,
  Silenced, already acted) should look visibly dimmed rather than vanish,
  and clicking it should be a silent no-op — no error, no partial action.
- An empty slot should show no button at all — the row should never leave
  a visible gap or an unlabeled button behind.
- Q/R/F/T and their own buttons should behave completely unchanged — this
  only adds a second way to fire something already reachable through them.
- Known, deliberate limit: mouse-click only, no new keyboard shortcut —
  the number-row keys 1-4 already mean "select hero by party slot" (Phase
  8), so reusing 1-6 for hotkeys would have broken that existing shortcut;
  picking an unrelated key felt like inventing a binding Kevin never asked
  for, so this was deliberately left mouse-only for now.

### KI-116 — D-165: Compendium's item descriptions moved to a hover tooltip (KI-098 item 1)
- Every itemized Compendium tab (Classes, Subclasses, Races, Feats, Skills,
  Spells, Equipment, Potions, Buildings, Traps, Status Effects) should now
  show a compact one-line list — name plus a minimal stat (cost/level/
  slot/rarity/etc.) — instead of every entry's full description sitting
  permanently on the page.
- Hovering any item row (mouse only) should pop the shared tooltip with
  that item's full description, matching how a Gear/Shop item already
  works; moving off should hide it.
- Subclasses/Races/Buildings/Traps should each show a bold, non-hoverable
  group-label row (a subclass's name + class, a race's name + speed, "—
  Walls & Gates —"/"— Platforms —", "— Ground —"/"— Flying —") with its
  features/traits/items listed underneath as their own hoverable rows.
- Prev/Next paging should still work on every category, including ones
  that were never paginated before this fix (e.g. Feats, Potions, Status
  Effects) if they now span more than one page.
- The Dialogue tab is unchanged — still its own demo/preview blurb, not
  itemized data, so nothing there should look different.
- Known, deliberate limit: mouse hover only, no keyboard-focus tooltip
  variant — this is a read-only reference screen, not part of KI-034's
  full-keyboard-play requirement.

### KI-115 — D-164: replaced every remaining click-to-cycle button with a real list picker
- Map Builder's Width/Height buttons, Settings' Game Speed/Master/Music/SFX
  Volume buttons, Character Creation's Signature Action/Starting Level/
  Party Size/Difficulty/Team Level buttons, and Free Play's/Browse Shared
  Maps' Difficulty buttons should all now open a full-screen list of every
  option instead of cycling on each click — picking one should apply it and
  close immediately.
- The currently-selected option in each list should show the gold "★ "
  highlight, matching the Class/Race/Gear/Subclass pickers' existing look.
- Character Creation: opening any of these new pickers should still hide
  the 4 hero-name fields underneath (see KI-111) and restore them on close.
- Settings' Game Speed picker reached from the Pause Menu mid-battle
  (`battleScene` overlay mode) should change speed live, exactly as the old
  cycle button did — confirm the label updates immediately after picking.
- Known, deliberate exception: the mid-battle "S" keyboard hotkey still
  cycles Game Speed on each press — a keyboard shortcut, not the
  mouse-driven pattern this fix targeted.
- Mute All and the Standard Array/Point Buy toggle are unchanged (still a
  plain on/off click) — true binary toggles weren't part of this fix.

### KI-114 — D-163: removed every silent "invented" level-up default
- Set a hero's Starting Level (or Team Level) above 1, past a level that
  grants an ASI/subclass/spell-mastery-family pick, with that hero's Plan
  Levels left on "Prompted" or with no plan at all — starting the battle
  should show a real choice popup for each skipped level BEFORE wave 1
  begins, not a silently pre-applied default.
- The same setup with a hero's Plan Levels on "Auto" and an explicit plan
  entry for every skipped level should show NO popup at all (the plan
  resolves silently, as intended) — confirm this still works exactly as
  before.
- An "Auto" hero with a plan that DOESN'T cover every skipped level should
  get prompted only for the uncovered ones, silently resolved for the rest.
- A normal in-battle level-up (not a pre-battle fast-forward) should be
  unaffected — an "Auto" hero with an explicit plan entry for the level
  just reached should still resolve silently; a "Prompted"/no-plan hero
  should still see the usual popup with no surprise defaults pre-applied.
- The Plan Levels wizard's "Auto-follow a blueprint" and "Skip (decide
  later)" option text now describes this — worth a glance to confirm it
  reads correctly.

### KI-113 — D-162: horizontal-squish mitigation (unconfirmed) + stale comment cleanup
- **This is the one item in this batch NOT confirmed fixed** — start a
  battle, then exit back to Main Menu, and check whether the canvas still
  squishes horizontally, and whether that squish still persists across
  every later screen. If it's gone, great; if it recurs, this needs a live
  repro next (inspect the canvas element's style and
  `game.scale.displaySize`/`baseSize` right before/after the exit), not
  another blind guess.
- No behavior change expected anywhere else — `MainMenuScene.create()`
  calling `this.scale.refresh()` should be invisible if the ScaleManager
  state was already correct.

### KI-112 — D-161: Main Menu Settings/Exit Game no longer overlap the frame border
- At the game's normal window size, the Settings button (top-right) should
  sit clearly inside the ornate frame border, not overlapping/touching it.
- The Exit Game button (bottom-left) should have real, visible clearance
  from the bottom frame border, including while hovered (the hover-lift
  tween used to eat what little clearance it had).
- The Account "Sign in with Google"/"Signed in: {name}" control (moved down
  to make room for Settings) should still sit clearly below Settings with
  no overlap between the two.

### KI-111 — D-160: Character Creation stray hero names + Back button relocation
- Opening any full-screen picker (Class/Race/Gear/Subclass/Signature
  Action/Starting Level/Party Size/Difficulty/Team Level) or the Plan
  Levels/Spells wizards should hide all 4 hero-name fields underneath —
  they should reappear the instant the picker/wizard closes, with their
  typed text and focus state intact.
- A "Back (Esc)" button should now appear top-left, matching every other
  screen's Back button exactly (position, size, wording) — clicking it (or
  pressing Esc) should return to Main Menu. Esc should do nothing while a
  picker/wizard is open (use its own Cancel/Back instead), not abandon the
  screen mid-edit.

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

### KI-098 — Kevin's 2026-08-21 feedback/wishlist session — PRIORITIZED 2026-08-24 into an explicit order, see below

A single large playtest/wishlist message covering many independent items,
ranging from small fixes to multi-session epics. Most of it was worked
through phase-by-phase over several sessions (D-147 through D-153, D-150,
D-151); what's left is now ordered below.

**Standing instruction from Kevin (2026-08-24): keep working straight down
this list, session after session, without stopping for his playtest —
he's deferring ALL in-browser confirmation (this list AND every other
still-open KI-1xx checklist above) to one combined pass once the whole
list below is done.** Whichever chat picks this up next should start at
the first unchecked item and keep going — do not wait for a go-ahead, and
do not re-litigate the order without a reason. Log a new D-NNN (next number
is in `PHASE_HANDOFF.md`) as each item ships, same as every other session.
A few items are explicitly flagged below as needing a quick decision from
Kevin before starting — ask then, not before, and not as a reason to skip
ahead in the order.

**The ordered backlog** (verified against the real current code on
2026-08-24 before this ordering was written — a few items the original
2026-08-21 wishlist text called "still open" turned out to already be
done; corrected in place below rather than left stale):

1. ~~**Compendium item tooltips → hover tooltip.**~~ DONE (D-165, see
   KI-116) — every itemized category now renders as compact, paginated rows
   with the full description shown via the shared `tooltip.ts` hover
   controller, matching Gear/Shop. The Dialogue demo tab is unchanged (not
   itemized reference data).
2. ~~**Wire the Character Sheet's hotkey bar into actual battle input.**~~
   DONE (D-166, see KI-117) — a new 4th HUD row shows each filled hotkey
   slot as its own clickable button while a hero is selected, firing the
   exact same resolver Q/R/F/T's own paths already use. Q/R/F/T themselves
   are unchanged.
3. ~~**Equip-flow UX rethink.**~~ DONE (D-167, see KI-118) — the always-
   visible hero roster strip is now a real click/hover target: in equip
   mode it targets that hero directly (equip/unequip + hover preview),
   outside equip mode it's a second way to select a hero. The original
   board-token click flow is unchanged.
4. ~~**Let the Character Sheet actually cast spells/use actions from
   it**~~ DONE (D-168, see KI-119) — the Spellbook tab's spell cards and
   the Stats tab's "Available Right Now" action lines are now real click
   targets: clicking one closes the sheet and fires it on the resumed
   battle.
5. ~~**Add a non-battle Character Creation entry point to the Main
   Menu.**~~ DONE (D-169, see KI-120) — a new "Build Party" button in the
   "Continue Your Journey" row opens the same scene "New Game" does, which
   already supports Save Party + Back without ever starting a battle.
6. ~~**Add more playable races** beyond the current SRD starter six~~ DONE
   (D-170, see KI-121) — Dragonborn, Gnome, Goliath, Orc, and Tiefling
   added (11 total), all real SRD 5.2.1 species; also caught and corrected
   a sourcing-attribution error in the original six (see D-170's own
   writeup) with no game-data change.
7. ~~**Class-based movement bonus (e.g. Monk).**~~ DONE (D-171, see
   KI-122) — Monk's Unarmored Movement (level 2+) and Barbarian's Fast
   Movement (level 5+), both already-named inert SRD features, now grant a
   real +1 tile. (Attack/spell range already uses the identical
   diagonal-aware distance metric movement does, D-141/D-142 — that part
   of the original ask was already satisfied, no work needed.)
   ~~"Move speed should also scale with map size" is a separate, genuinely
   ambiguous ask~~ RESOLVED (D-172, see KI-123) — Kevin's real ask was
   exact D&D movement math (1 tile = 5ft), not a map-size-scaling
   mechanic; the whole game's movement-tile numbers were rescaled
   accordingly (races/classes/gear/potions/status/all 63 enemies).
8. ~~**Hero-side split-movement (move → act → move again, same turn).**~~
   DONE (D-173, see KI-124) — `Hero.movementBudget()` now tracks real
   leftover tiles (`movementTilesUsedThisTurn`) instead of a boolean "moved
   at all" flag; `moveTo(dest, tilesUsed?)` deducts only what a move
   actually cost. The existing selection/range-highlight/click-to-move and
   D-144 drag-move UI needed no changes at all — they already re-derive
   everything from `hero.canMove()`/`hero.movementBudget()` live, so they
   picked this up for free the moment the budget stopped zeroing out
   unconditionally. Closes out the whole Enemy AI/Movement Redesign epic.
9. ~~**Bigger maps** (`BattleScene`'s `TILE_SIZE` dynamic scaling + raising
   `MAX_MAP_COLS`/`MAX_MAP_ROWS`).~~ DONE (D-176, see KI-127) — went with
   the recommended BattleScene-LOCAL dynamic per-map tile size (mirroring
   `MapBuilderScene.rebuildGridSystem`'s own shrink-to-fit pattern,
   extracted into a shared, unit-tested `computeFittedTileSize` helper),
   never touching `GAME_WIDTH`/`GAME_HEIGHT`/`Scale.RESIZE` — neither of
   D-157/D-159/D-172's ruled-out directions was needed. `MAX_MAP_COLS`/
   `MAX_MAP_ROWS` raised from 20/9 to **32/14** (a 40px minimum-tile-size
   floor, flagged as a first-pass balance value); `firestore.rules`'
   hand-unrolled `isValidTileRows` extended to match. This closes the
   entire KI-098 "build" backlog — only item 13 below remains.
10. ~~**Initiative system.**~~ DONE (D-175, see KI-126) — Kevin's answer
    was per-group. Enemies are grouped by TYPE (`EnemyDefinition.id`), each
    group's initiative rolled once per wave via the previously-unused
    `InitiativeSystem`, and `WaveSystem.tickEnemyPhase` now processes
    groups in that order every phase instead of raw spawn order. Also
    resolves `SOURCE_OF_TRUTH.md` §9's "Initiative" item.
11. ~~**XP distribution toggle** (split evenly vs. majority-to-killing-
    blow).~~ RESOLVED — no toggle needed (D-174, see KI-125): this
    presupposed a per-hero XP/kill-crediting economy that doesn't exist —
    leveling has always been uniform (every living hero levels together).
    Kevin's real ask, once asked directly, was a cadence change: every
    hero levels up together every SINGLE wave now (was every 2), which
    also resolves `SOURCE_OF_TRUTH.md` §9's "Level cadence" item.
12. ~~**Default 1-20 campaign pacing**, scaled by party size.~~ FOLDED INTO
    item 13 (see D-174) — Kevin drew a line this project hadn't drawn
    before: the in-battle level track (item 11, above) is DIFFERENT from a
    separate overworld/campaign-only XP track (special bonuses unlocked by
    story progress) that doesn't exist yet and whose exact shape is
    genuinely undesigned ("yet to come up with"). That belongs to item 13's
    epic, not a standalone pacing-curve tweak — see item 13 below.
13. **Overworld campaign redesign** — Kevin's own explicit lower
    priority, and the single biggest epic here (full narrative overworld
    map, starting 2-hero party growing to 4, dual leveling tracks). Goes
    last, exactly as he already directed once before. **In progress**:
    D-177 built the 12-companion catalogue (`data/companions.ts`), one per
    class, Kevin's own BG3-style extension of the design doc's original
    six. D-179 migrated Emberford Reach/Saltmere Shallows into real,
    PLAYABLE 4-chapter regions (`CampaignSelectScene`/`CharacterCreationScene`/
    `BattleScene` all wired — see KI-129), and D-180 did the same for the
    other four (Shattered Causeway/Cinderfall Rift/The Drowning Vale/
    Frostbound Hollow — see KI-130) — the design doc's chapter structure is
    no longer just engine scaffolding, it's live content for **all six**
    regions that exist. All six mirror companions' `homeRegionId` now
    resolves to a real campaign (D-180). D-181 built §8's pre-region
    bonus-choice screen (see KI-131) — every real campaign now offers a
    random pick-1-of-3 bonus (gold/XP/equipment/structure) before each
    chapter's battle. D-182 built §4's returning-miniboss mechanic (see
    KI-132) — `WorldFlagSystem` (D-118 scaffolding) is now actually wired
    up: sparing one of the 5 home minibosses in its own Ch1 fight persists a
    flag that Saltmere Ch1 reads back to spawn that same miniboss instead of
    the nameless `tide-wretch` fallback. Still fully open: full dialogue/arc writing for the
    six mirror companions (explicitly deferred by Kevin's own instruction —
    a dedicated future planning-and-writing session, not a quick
    follow-up), the capstone (The Nameless Throne) has no map or chapters
    yet, any scene/UI to actually recruit a companion in battle, the
    Sorrel-Thane-Lost priority tier §4 also wants ahead of a spared
    miniboss (needs the not-yet-built companion-fate data model — see
    D-182's own deferred-scope note),
    and cross-chapter continuity (gold/gear/level carrying over between
    chapters — see KI-129/KI-130's own deferred-scope notes). See
    D-177/D-179/D-180/D-181/D-182 in `DECISIONS.md` for the full accounting.
    `CAMPAIGN_STORY_DESIGN.md` and D-118's world-flag/companion-roster
    scaffolding remain the foundation for what's left. Now ALSO carries
    item 12's former scope (D-174): the overworld/campaign-only XP track
    that unlocks special bonuses as the story progresses — genuinely
    undesigned yet, needs its own real design pass as part of this epic,
    not before it.

Also still open, low priority, not yet slotted into the numbered order
above (pull forward if a future session has spare capacity and nothing
above is ready to start): Map Builder's fixed size RANGE (6-32 cols/6-14
rows as of D-176, via D-164's picker) isn't literally "arbitrary" custom
dimensions; and triggered map actions keyed to wave count/hero position/
stronghold HP (Kevin's own words: "way down the road, explicitly not
urgent").

Two 2026-08-21 items already fully done by the time of this ordering pass,
kept here only for the historical record: the Map Builder paint tool and
map-name field (D-154), and the Compendium/Bestiary alphabetization work
below.

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
