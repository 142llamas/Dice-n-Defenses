/**
 * Summon definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 16 (D-106, "make all spells usable"): a small set of summon
 * archetypes so the SRD catalogue's conjuration spells (Find Familiar,
 * Conjure Animals, Spiritual Weapon, Summon greater/lesser demon, etc.) have
 * somewhere real to land, via `SummonSystem`/`entities/Summon.ts`. Every
 * summon-flavored spell routes to ONE of these three archetypes rather than
 * getting its own bespoke stat block — the same "reuse a small shared shape"
 * simplification `data/statusEffects.ts` already makes for dozens of
 * debuff-flavored spells sharing "slowed"/"stunned"/"burning" underneath.
 *
 * All content here is ORIGINAL to this project — names and values are
 * invented, not copied or adapted from any published source. See
 * CONTENT_SOURCES.
 */

export interface SummonDefinition {
  id: string;
  name: string;
  maxHealth: number;
  armorClass: number;
  attackBonus: number;
  attackDamage: number;
  attackRangeTiles: number;
}

export const SUMMONS: Record<string, SummonDefinition> = {
  "spectral-blade": {
    id: "spectral-blade",
    name: "Spectral Blade",
    maxHealth: 8,
    armorClass: 12,
    attackBonus: 4,
    attackDamage: 3,
    attackRangeTiles: 1,
  },
  "guardian-spirit": {
    id: "guardian-spirit",
    name: "Guardian Spirit",
    maxHealth: 20,
    armorClass: 15,
    attackBonus: 3,
    attackDamage: 2,
    attackRangeTiles: 1,
  },
  "elemental-servant": {
    id: "elemental-servant",
    name: "Elemental Servant",
    maxHealth: 12,
    armorClass: 13,
    attackBonus: 5,
    attackDamage: 4,
    attackRangeTiles: 2,
  },
};

/** Look up a summon definition, throwing on an unknown id so typos fail loudly. */
export function getSummonDefinition(id: string): SummonDefinition {
  const def = SUMMONS[id];
  if (!def) throw new Error(`Unknown summon id "${id}".`);
  return def;
}
