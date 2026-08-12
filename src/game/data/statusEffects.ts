/**
 * Status effect definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 7 adds status effects as the last piece the roadmap calls out on its own
 * ("Status effects") and as the mechanism that makes a hero ability or a trap
 * "spell-like" rather than a flat hit: an effect lingers for a few enemy phases
 * instead of resolving in one blow. Kept intentionally small — three effects,
 * each a single clear rule — per the "make small, testable changes" instruction.
 *
 * Phase 16 (D-106, "make all spells usable") adds five more effects so the
 * SRD catalogue's debuff/control/divination spells have somewhere real to
 * land, reusing this exact same data-driven shape rather than inventing a
 * parallel system per new spell:
 *   - "poisoned"  : same shape as "burning" (a second damage-over-time flavor).
 *   - "restrained": same shape as "stunned" (a second hold-in-place flavor).
 *   - "blinded"   : the enemy's OWN attacks roll with disadvantage (see
 *                   WaveSystem.tickEnemyPhase) — the mechanical stand-in for
 *                   every SRD blindness/darkness/obscurement spell.
 *   - "exposed"   : lowers the enemy's effective Armor Class against every
 *                   attack while active (see Enemy.armorClass) — the stand-in
 *                   for "expose a weakness" divination/hex-type spells.
 *   - "charmed"   : the enemy attacks another living enemy instead of a hero
 *                   this phase, if one is in range (see WaveSystem
 *                   .tickEnemyPhase) — the stand-in for every SRD charm/
 *                   dominate spell within this game's per-enemy-turn model.
 *
 * Phase 17 (D-108, weapons/armor/weapon mastery) adds two more, both reusing
 * the exact `attackRollDisadvantage` shape "blinded" already established
 * rather than inventing a new flag:
 *   - "sapped"  : the Sap weapon-mastery property's real SRD effect ("that
 *                 creature has Disadvantage on its next attack roll before
 *                 the start of your next turn") — a one-phase disadvantage.
 *   - "toppled" : the mechanical stand-in for the Topple mastery property's
 *                 real SRD effect (a failed CON save applies the Prone
 *                 condition — melee attacks against a Prone creature have
 *                 Advantage, its own attacks have Disadvantage, and ranged
 *                 attacks against it have Disadvantage). This game models
 *                 only the "its own attacks have Disadvantage" half (the
 *                 same simplification "exposed"/"blinded" already made for
 *                 other multi-part SRD conditions), for a longer 2-phase
 *                 duration since Prone is a stronger condition than Sap's.
 *
 * Phase 21 (D-112) adds one more, and — for the first time — makes this
 * entire data shape usable on a HERO too (`Hero.activeStatuses`, mirroring
 * `Enemy.activeStatuses` field-for-field), not just an enemy. This is the
 * "verify against real design tradeoffs, don't assume" moment the Phase 20
 * handoff flagged: Kevin chose the FULL generic system (any status usable on
 * either side) over a narrow poison+silence-only one.
 *   - "silenced": the new `preventsCasting` field — this hero (or, in
 *                 principle, an enemy, though nothing inflicts it on one
 *                 today) can't cast a spell or use its class ability while
 *                 this lingers. The mechanical stand-in for a Silence/
 *                 Anti-Magic-Field effect (the Anti-caster archetype).
 * Every other existing field above (`movementReduction`, `preventsAction`,
 * `damagePerTurn`, `attackRollDisadvantage`, `armorClassDelta`) is ALSO now
 * consumed on the hero side (see `Hero`'s own getters/`canMove`/`canAct`) —
 * the same data automatically means the same thing regardless of which side
 * it lands on. The one exception is `redirectsAttackToAllies` ("charmed"):
 * heroes have no AI "attack an ally instead" concept to redirect into, so it
 * stays enemy-only, unconsumed on a hero (documented, not a bug).
 *
 * D-124 adds one more, reusing the exact `attackRollDisadvantage` shape
 * "blinded"/"sapped"/"toppled" already established rather than inventing a
 * new flag — the mechanical stand-in for the SRD's real "Frightened"
 * condition (whose other half, "can't willingly move closer to the source,"
 * this game has no per-source tracking to model):
 *   - "frightened": the same "its own attacks roll with disadvantage" shape,
 *                   inflicted BY a hero ON an enemy (Barbarian's Path of the
 *                   Berserker: Intimidating Presence, auto-applied on a
 *                   landed basic-attack hit — see `BattleScene
 *                   .applyIntimidatingPresence`, the same "rider on an
 *                   existing landed hit" precedent Grappler's restrain
 *                   (D-109) already established). Nothing in this game
 *                   inflicts it ON a hero yet — a real future companion
 *                   piece once an enemy archetype wants to.
 *
 * All content here is ORIGINAL to this project — names and values are invented,
 * not copied or adapted from any published source. See CONTENT_SOURCES. The
 * WEAPON MASTERY NAMES that apply "sapped"/"toppled" (Sap/Topple) are real SRD
 * 5.2.1 (CC-BY-4.0) terms — see data/weapons.ts.
 *
 * Durations are counted in enemy phases and tick down by one each phase the
 * enemy is still alive and un-breached; reapplying an effect that is already
 * active REFRESHES it to the longer of the two durations rather than stacking.
 */

export type StatusEffectId =
  | "slowed"
  | "stunned"
  | "burning"
  | "poisoned"
  | "restrained"
  | "blinded"
  | "exposed"
  | "charmed"
  | "sapped"
  | "toppled"
  | "silenced"
  | "frightened";

export interface StatusEffectDefinition {
  id: StatusEffectId;
  name: string;
  description: string;
  /** "slowed": movement tiles removed this phase (never below 0). Consumed by both `Enemy` and `Hero`. */
  movementReduction?: number;
  /** "stunned"/"restrained": true means the holder can't act or move. Consumed by both `Enemy` and `Hero`. */
  preventsAction?: boolean;
  /** "burning"/"poisoned": damage dealt at the start of the holder's phase (always hits — see WaveSystem/Hero.tickStatusDamage). */
  damagePerTurn?: number;
  /** "blinded"/"sapped"/"toppled": this combatant's own attack rolls suffer disadvantage. Consumed by both `Enemy` and `Hero`. */
  attackRollDisadvantage?: boolean;
  /** "exposed": added to (i.e. lowers, when negative) this combatant's effective Armor Class. Consumed by both `Enemy` and `Hero`. */
  armorClassDelta?: number;
  /** "charmed": redirect this enemy's attack to another enemy in range instead of a hero. Enemy-only — heroes have no ally-redirect concept. */
  redirectsAttackToAllies?: boolean;
  /** "silenced" (Phase 21, D-112): can't cast a spell or use its class ability while this lingers. Hero-only today (nothing inflicts it on an enemy). */
  preventsCasting?: boolean;
}

export const STATUS_EFFECTS: Record<StatusEffectId, StatusEffectDefinition> = {
  slowed: {
    id: "slowed",
    name: "Slowed",
    description: "Movement is reduced while this lingers.",
    movementReduction: 2,
  },
  stunned: {
    id: "stunned",
    name: "Stunned",
    description: "No action and no movement this phase.",
    preventsAction: true,
  },
  burning: {
    id: "burning",
    name: "Burning",
    description: "Takes damage at the start of its phase; always hits.",
    damagePerTurn: 2,
  },
  poisoned: {
    id: "poisoned",
    name: "Poisoned",
    description: "Takes damage at the start of its phase; always hits.",
    damagePerTurn: 2,
  },
  restrained: {
    id: "restrained",
    name: "Restrained",
    description: "No action and no movement this phase.",
    preventsAction: true,
  },
  blinded: {
    id: "blinded",
    name: "Blinded",
    description: "Its own attacks this phase roll with disadvantage.",
    attackRollDisadvantage: true,
  },
  exposed: {
    id: "exposed",
    name: "Exposed",
    description: "Its Armor Class is lowered while this lingers.",
    armorClassDelta: -2,
  },
  charmed: {
    id: "charmed",
    name: "Charmed",
    description: "Attacks another enemy in range instead of a hero, if one is in reach.",
    redirectsAttackToAllies: true,
  },
  sapped: {
    id: "sapped",
    name: "Sapped",
    description: "Its next attack roll this phase has disadvantage (the Sap weapon mastery).",
    attackRollDisadvantage: true,
  },
  toppled: {
    id: "toppled",
    name: "Toppled",
    description: "Knocked down — its own attacks roll with disadvantage (the Topple weapon mastery).",
    attackRollDisadvantage: true,
  },
  silenced: {
    id: "silenced",
    name: "Silenced",
    description: "Can't cast a spell or use its class ability while this lingers.",
    preventsCasting: true,
  },
  frightened: {
    id: "frightened",
    name: "Frightened",
    description: "Its own attacks this phase roll with disadvantage (the Barbarian's Intimidating Presence).",
    attackRollDisadvantage: true,
  },
};

/** A single active effect instance on an enemy: which one, and how long. */
export interface ActiveStatus {
  id: StatusEffectId;
  remainingTurns: number;
}

/** Look up a status effect, throwing on an unknown id so typos fail loudly. */
export function getStatusEffectDefinition(id: StatusEffectId): StatusEffectDefinition {
  const def = STATUS_EFFECTS[id];
  if (!def) throw new Error(`Unknown status effect id "${id}".`);
  return def;
}

/**
 * Display order for on-token status badges (Phase 8, KI-027). Kept here as
 * data rather than hardcoded in the scene, so a future new effect needs no
 * scene changes — just an entry in this list.
 */
export const STATUS_EFFECT_ORDER: readonly StatusEffectId[] = [
  "stunned",
  "restrained",
  "charmed",
  "burning",
  "poisoned",
  "blinded",
  "exposed",
  "slowed",
  "sapped",
  "toppled",
  "silenced",
  "frightened",
];
