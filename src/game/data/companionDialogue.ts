import type { DialogueLine } from "../systems/DialogueSystem";

/**
 * companionDialogue.ts — KI-098 item 13 continuation: the writing pass
 * `CAMPAIGN_STORY_DESIGN.md` §9 flagged as still open ("full personal arcs
 * and dialogue... still just one-line hooks"). `companions.ts`'s own `hook`
 * field doc comment named this file's exact purpose in advance.
 *
 * Two beats per Pool B companion, both shown via `scenes/dialogueBox.ts`'s
 * `showDialogue`:
 *
 * - `COMPANION_RECRUITMENT_DIALOGUE` — shown once, the moment that
 *   companion's own home region's Chapter 1 clears
 *   (`BattleScene.showCompanionRecruitmentIfAny`, replacing the previously
 *   flat `logCombat` line in `maybeUnlockHomeRegionCompanion`).
 * - `COMPANION_MIRROR_REACTION_DIALOGUE` — shown once at that same
 *   companion's home region's Chapter 4 victory
 *   (`BattleScene.showMirrorBossReactionIfAny`) — their own reaction to
 *   their region's mirror boss (`CAMPAIGN_STORY_DESIGN.md` §3/§6) going
 *   down. Two entries (`fenna-duskwater`, `isolde-varnhall`) use the
 *   `{ ashen, hollow }` variant-pair shape, picked at victory time by
 *   `NamelessThroneSystem.mercyTallyLeansHollow` — the same accumulated
 *   mercy/expedience lean the capstone itself reads, giving dialogue tone
 *   real reactivity to earlier choices rather than a single fixed line.
 *   `sorrel-thane`'s entry only ever fires if she isn't Lost (guarded in
 *   BattleScene) — written to read fine for either Redeemed or Marked
 *   without contradicting `SorrelFateSystem.SORREL_FATE_FLAVOR_TEXT`.
 *
 * First-pass writing — real content, not final copy. Kevin isn't a writer
 * by his own description; treat every line here as punch-up-able rough
 * material. Original content, no D&D/SRD-derived names or lore (see
 * `CONTENT_SOURCES.md`).
 */

export type MirrorReactionDialogue = DialogueLine[] | { ashen: DialogueLine[]; hollow: DialogueLine[] };

export const COMPANION_RECRUITMENT_DIALOGUE: Record<string, DialogueLine[]> = {
  "tamsin-rourke": [
    {
      text: "The smoke over Emberford hasn't cleared, but the fighting has — a stranger steps out from behind an overturned forge, hammer still in hand.",
    },
    {
      speakerName: "Tamsin Rourke",
      text: "You put down what was raiding my forge before I could. I don't like owing debts, so I'm calling this one paid — by staying.",
    },
    {
      speakerName: "Tamsin Rourke",
      text: "I've spent long enough hammering out my own anger alone. Maybe it goes better with company.",
    },
  ],
  "dorian-wick": [
    {
      text: "Past the wreckage at the causeway's far end, a tiefling in a scavenged coat watches the last of the fighting with more curiosity than fear.",
    },
    {
      speakerName: "Dorian Wick",
      text: "The Devourer took my family the way it takes everything — like it can't tell wanting something from just having it. I've spent two years trying to get close enough to end it.",
    },
    {
      speakerName: "Dorian Wick",
      text: "I won't say no to help. Just don't ask me to explain everything I've traded for what I can do. Some of that I'd rather not remember either.",
    },
  ],
  "hollis-vane": [
    {
      text: "Cinderfall's rift road is finally clear. A weathered fighter steps out from cover where he'd clearly been waiting, not fighting.",
    },
    {
      speakerName: "Hollis Vane",
      text: '"Two-Step," they used to call me — always found a reason to let someone else swing first. I left Korrath\'s warband so I\'d stop doing that. Turns out habits don\'t care why you quit.',
    },
    {
      speakerName: "Hollis Vane",
      text: "I'm home, more or less. Figured the least I could do is stop stepping back for once, and actually go with you.",
    },
  ],
  "sorrel-thane": [
    {
      text: "The warden who challenged you at the Vale's threshold lowers her weapon, breathing hard, watching you with an expression that isn't quite relief.",
    },
    {
      speakerName: "Sorrel Thane",
      text: "You made it further into this ground than most patrols do before it starts working on them. Or it hasn't started on you yet. Hard to tell from outside.",
    },
    {
      speakerName: "Sorrel Thane",
      text: "I know this Vale better than anyone left standing. That's not the same as being unaffected by it. Watch me, if you're smart. I might need it.",
    },
  ],
  "fenna-duskwater": [
    {
      text: "Fenna Duskwater stands at the tideline, still talking quietly to the wreck offshore, as if someone might answer.",
    },
    {
      speakerName: "Fenna Duskwater",
      text: "That's the ship that took my crew. Tidelord's crew now, near as anyone can tell. I still say goodnight to them. Force of habit, maybe. Maybe not.",
    },
    {
      speakerName: "Fenna Duskwater",
      text: "I know how that sounds. Come along anyway — I'd rather be useful to the living for a while.",
    },
  ],
  "isolde-varnhall": [
    {
      text: "At the edge of the split ridge, a robed elf watches the last of the fighting without moving to help or flee.",
    },
    {
      speakerName: "Isolde Varnhall",
      text: "I was part of that King's fallen court long enough to know when waiting stops being wise and starts being exactly what he'd want. I'd rather not find out which one I've become.",
    },
    {
      speakerName: "Isolde Varnhall",
      text: "I'll come with you. It's past time I did something besides watch.",
    },
  ],
};

export const COMPANION_MIRROR_REACTION_DIALOGUE: Record<string, MirrorReactionDialogue> = {
  "tamsin-rourke": [
    {
      text: "Cinderlord's forge finally goes quiet. Tamsin doesn't move for a long moment, staring at the ruin of it.",
    },
    {
      speakerName: "Tamsin Rourke",
      text: "He used to be somebody, before all this. I used to be scared I'd end up exactly like him — good at making things, better at ruining them.",
    },
    {
      speakerName: "Tamsin Rourke",
      text: "I'm not him. I got to find that out the hard way, with people who'd have stopped me if I'd ever started down that road. Thank you for that, whether you meant it or not.",
    },
  ],
  "dorian-wick": [
    {
      text: "The Devourer stops moving. Dorian stands over the wreck of it a long while before he finally lowers his hand.",
    },
    {
      speakerName: "Dorian Wick",
      text: "I used to think if I hated it hard enough, long enough, that would be the same as still loving what it took from me. It isn't. I think I forgot that, for a while.",
    },
    {
      speakerName: "Dorian Wick",
      text: "Grief's supposed to burn down to something. I was afraid it'd be hunger, same as it was for that thing. Turns out it's just quiet, actually. I can live with quiet.",
    },
  ],
  "hollis-vane": [
    {
      text: "Korrath falls, and for once Hollis is the one standing closest when it happens.",
    },
    {
      speakerName: "Hollis Vane",
      text: "Never had to fight himself, that one. Just pointed, and other people bled. I spent years being the person who let that happen instead of stopping it.",
    },
    {
      speakerName: "Hollis Vane",
      text: "Not this time, though. Feels strange, being the one who didn't step back. I could get used to strange like that.",
    },
  ],
  "sorrel-thane": [
    {
      text: "Blightmother's hold over the Vale finally breaks. Sorrel stands over the ground that almost had her, still breathing, still here.",
    },
    {
      speakerName: "Sorrel Thane",
      text: "It had years on you to work with, out here. I wasn't sure that fight would end with me on this side of it.",
    },
    {
      speakerName: "Sorrel Thane",
      text: "Whatever this ground took out of me, it didn't get all of it. I mean to keep it that way from here.",
    },
  ],
  "fenna-duskwater": {
    ashen: [
      {
        text: "Tidelord goes still in the shallows. Fenna wades out to where the old wreck lies half-sunk, and for the first time, doesn't say anything to it at all.",
      },
      {
        speakerName: "Fenna Duskwater",
        text: "I kept waiting for them to still be in there somewhere. They weren't. Haven't been for a long time.",
      },
      {
        speakerName: "Fenna Duskwater",
        text: "You've spent this whole road giving people the chance to still be someone, even when it would've been easier not to. I noticed. It's why I finally believed I could let go and still remember them right.",
      },
    ],
    hollow: [
      {
        text: "Tidelord goes still in the shallows. Fenna wades out to where the old wreck lies half-sunk and stares at it like she's trying to remember why she used to talk to it.",
      },
      {
        speakerName: "Fenna Duskwater",
        text: "Strange — I can't quite recall what I used to say to them. Just that I used to.",
      },
      {
        speakerName: "Fenna Duskwater",
        text: "Maybe that's for the best. Maybe I've just been at sea with the rest of you too long to keep dragging a wreck along behind me. Either way. It's done now.",
      },
    ],
  },
  "isolde-varnhall": {
    ashen: [
      {
        text: "The Sundered King finally falls, decades of waiting ending in one motion. Isolde doesn't look away from the wreckage of his throne.",
      },
      {
        speakerName: "Isolde Varnhall",
        text: "He waited so long to act that waiting became the only thing left of him. I used to think I understood that. I'm glad I never quite learned to.",
      },
      {
        speakerName: "Isolde Varnhall",
        text: "You never let anyone in this party just wait it out, not even me. Whatever's ahead now, I mean to meet it the same way — moving, not watching.",
      },
    ],
    hollow: [
      {
        text: "The Sundered King finally falls, decades of waiting ending in one motion. Isolde watches, and something in her expression doesn't look like relief.",
      },
      {
        speakerName: "Isolde Varnhall",
        text: "He waited so long to act that waiting became the only thing left of him. I understand that better than I'd like to admit, after everything this road has cost.",
      },
      {
        speakerName: "Isolde Varnhall",
        text: "Whatever's still ahead, I don't know that I trust myself to meet it moving instead of watching. But I'll try. That's still something.",
      },
    ],
  },
};
