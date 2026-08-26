import type { WorldFlagState } from "./WorldFlagSystem";
import { getWorldFlag, setWorldFlag } from "./WorldFlagSystem";

/**
 * SorrelFateSystem — CAMPAIGN_STORY_DESIGN.md §6's Drowning Vale companion
 * branch chain (D-185, KI-098 item 13, closes the gap D-182/D-183 both
 * flagged and deferred).
 *
 * Sorrel Thane's own choice appears at the start of Drowning Vale Chapters
 * 1-3 (see `BattleScene.showSorrelChoiceIfAny`) — a "support" or "press"
 * pick each time, recorded here as one `WorldFlagSystem` flag per chapter
 * (exactly the shape that system's own doc comment already anticipated).
 * By Chapter 4, `resolveSorrelFate` reads whatever was recorded and
 * converges it to one of three outcomes: consistently choosing to support
 * her wins Redeemed, consistently pressing forward costs her (Lost), and
 * anything mixed — or no recorded choices at all, e.g. a save that cleared
 * Drowning Vale before this feature shipped — lands on Marked, a
 * deliberately safe default rather than defaulting an old save to the
 * worst outcome.
 */

export type SorrelChoice = "support" | "press";
export type SorrelFate = "redeemed" | "marked" | "lost";

/** One flag per Drowning Vale chapter 0-2 (Chapter 4, index 3, never records a choice — it's the resolution chapter). */
export const SORREL_CHOICE_FLAG_IDS: readonly string[] = [
  "drowning-vale-sorrel-ch1",
  "drowning-vale-sorrel-ch2",
  "drowning-vale-sorrel-ch3",
];

export const SORREL_FATE_FLAG_ID = "drowning-vale-sorrel-fate";

/**
 * KI-098 item 13 continuation (mechanical-weight pass, closes the D-185
 * addendum's own "Redeemed/Marked flavor-only" gap): Redeemed reuses
 * BattleScene's equip-or-sell-for-gold flow with this item — already in
 * `DROWNING_VALE_LOOT_POOL`, uncommon, attunement-gated, thematically
 * "held onto compassion," sized for a Chapter 4 (levels 16-20) reward.
 */
export const SORREL_REDEEMED_REWARD_EQUIPMENT_ID = "staff-of-healing";

/**
 * Marked: real but deliberately smaller/different than Redeemed — a flat
 * gold grant well under the Redeemed item's value ("survived, not
 * unscathed"), still meaningfully more than a Ch1 spare-mercy reward
 * (`SPARE_MERCY_GOLD_REWARD`) since this resolves at Chapter 4, not Chapter 1.
 */
export const SORREL_MARKED_GOLD_REWARD = 25;

/**
 * The 2-option choice shown at the start of each of Drowning Vale's
 * Chapters 1-3 (`BattleScene.showSorrelChoiceIfAny`). First-pass writing —
 * short, serviceable option text tied to each chapter's own beat, not a
 * deep dialogue pass; worth Kevin's own read/adjust, same as any other new
 * narrative content this project ships.
 */
export const SORREL_CHOICE_PROMPTS: readonly {
  title: string;
  support: { label: string; desc: string };
  press: { label: string; desc: string };
}[] = [
  {
    title: "Sorrel Thane",
    support: {
      label: "Slow down for her",
      desc: "The warden at the Vale's edge is barely holding her ground against something in the mud. Break formation to cover her.",
    },
    press: {
      label: "Press on without her",
      desc: "The warden at the Vale's edge isn't your problem yet. Keep the party moving toward the real objective.",
    },
  },
  {
    title: "Sorrel Thane",
    support: {
      label: "Give her room to steady",
      desc: "She's with you now, but the ground here is already getting to her again. Slow the pace and let her find her footing.",
    },
    press: {
      label: "Keep the pace up",
      desc: "She's with you now, but there's no time to babysit — the Vale won't wait, and neither should the party.",
    },
  },
  {
    title: "Sorrel Thane",
    support: {
      label: "Trust her read of the ground",
      desc: "She's certain the Vale is worse than it looks up ahead, and wants the party to listen to her, not just use her.",
    },
    press: {
      label: "Trust the map, not her nerves",
      desc: "She's certain the Vale is worse than it looks up ahead. It's slowing everyone down for a feeling.",
    },
  },
];

/** Flavor line logged once, in Drowning Vale, when Chapter 4 resolves Sorrel's fate — first-pass writing, same spirit as `SORREL_CHOICE_PROMPTS`. */
export const SORREL_FATE_FLAVOR_TEXT: Record<SorrelFate, string> = {
  redeemed: "Sorrel Thane stands steadier than she has all region — whatever the Vale wanted from her, it didn't get it.",
  marked: "Sorrel Thane is still standing, still herself — mostly. Something about the Vale never quite let go of her.",
  lost: "Sorrel Thane doesn't answer when you call her name. Whatever's left of her isn't listening anymore.",
};

/** Records chapter `chapterIndex`'s choice (0, 1, or 2). Throws on any other index — there's no choice slot for it. */
export function recordSorrelChoice(
  worldFlags: WorldFlagState,
  chapterIndex: number,
  choice: SorrelChoice,
): WorldFlagState {
  const flagId = SORREL_CHOICE_FLAG_IDS[chapterIndex];
  if (!flagId) {
    throw new Error(`SorrelFateSystem: no choice flag for chapter index ${chapterIndex}.`);
  }
  return setWorldFlag(worldFlags, flagId, choice);
}

/**
 * Pure majority-vote read — does NOT persist the fate flag itself; the
 * caller (`BattleScene.resolveSorrelFateIfAny`) decides when to write
 * `SORREL_FATE_FLAG_ID`, once, at Chapter 4 start.
 */
export function resolveSorrelFate(worldFlags: WorldFlagState): SorrelFate {
  let support = 0;
  let press = 0;
  for (const flagId of SORREL_CHOICE_FLAG_IDS) {
    const value = getWorldFlag(worldFlags, flagId);
    if (value === "support") support++;
    else if (value === "press") press++;
  }
  if (support > press) return "redeemed";
  if (press > support) return "lost";
  return "marked";
}

export function isSorrelLost(worldFlags: WorldFlagState): boolean {
  return getWorldFlag(worldFlags, SORREL_FATE_FLAG_ID) === "lost";
}
