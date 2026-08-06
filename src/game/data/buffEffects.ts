/**
 * Buff effect definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 16 (D-106, "make all spells usable"): the ally-side counterpart to
 * `data/statusEffects.ts`. Until now, an enemy could carry a lingering
 * status effect but a Hero could not carry any generic lingering effect at
 * all — every ally-facing mechanic (Rage's damage resistance, Bardic
 * Inspiration) was its own bespoke scalar field on `Hero`. This file adds a
 * small, data-driven set of ally BUFFS so the SRD catalogue's Bless/Shield
 * of Faith/Haste-style spells have somewhere real to land, following the
 * exact same shape `statusEffects.ts` already established: a definition
 * record, an `ActiveBuff{ id, remainingTurns }` instance, apply-refreshes-
 * to-longer, tick-down-and-expire.
 *
 * All content here is ORIGINAL to this project — names and values are
 * invented, not copied or adapted from any published source. See
 * CONTENT_SOURCES.
 */

export type BuffEffectId = "blessed" | "warded" | "guided";

export interface BuffEffectDefinition {
  id: BuffEffectId;
  name: string;
  description: string;
  /** "blessed": added to the hero's attack rolls (weapon and spell alike). */
  attackBonusDelta?: number;
  /** "warded": added to the hero's effective Armor Class. */
  armorClassDelta?: number;
  /** "guided": added to the hero's saving throws. */
  savingThrowBonusDelta?: number;
}

export const BUFF_EFFECTS: Record<BuffEffectId, BuffEffectDefinition> = {
  blessed: {
    id: "blessed",
    name: "Blessed",
    description: "Attack rolls are bolstered while this lingers.",
    attackBonusDelta: 2,
  },
  warded: {
    id: "warded",
    name: "Warded",
    description: "Armor Class is bolstered while this lingers.",
    armorClassDelta: 2,
  },
  guided: {
    id: "guided",
    name: "Guided",
    description: "Saving throws are bolstered while this lingers.",
    savingThrowBonusDelta: 2,
  },
};

/** A single active buff instance on a hero: which one, and how long. */
export interface ActiveBuff {
  id: BuffEffectId;
  remainingTurns: number;
}

/** Look up a buff effect, throwing on an unknown id so typos fail loudly. */
export function getBuffEffectDefinition(id: BuffEffectId): BuffEffectDefinition {
  const def = BUFF_EFFECTS[id];
  if (!def) throw new Error(`Unknown buff effect id "${id}".`);
  return def;
}
