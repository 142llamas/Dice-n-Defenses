import type { GridPosition } from "../systems/GridSystem";
import type { StatusEffectId } from "./statusEffects";
import type { DamageType } from "./weapons";

/**
 * Enemy definitions — data, not code (Source of Truth "data-driven content").
 *
 * The shape matches the EnemyDefinition interface in the Source of Truth. Not
 * every field is used yet: Phase 3 only needs movement and breach behaviour.
 * The combat fields (maxHealth, defense, attackDamage, attackRangeTiles) and
 * the economy field (rewardGold) are present now so Phase 4 (combat) and Phase 5
 * (gold/shop) can use them without changing this data's shape.
 *
 * All content here is ORIGINAL to this project — names, values, and flavour are
 * invented, not copied or adapted from any published source. See CONTENT_SOURCES.
 *
 * Phase 7 (this slice, D-050): the roster grows from three to SEVEN regular
 * enemies plus ONE miniboss, delivering the phase's "six to eight enemies" and
 * "one miniboss" scope purely as data. The four new regulars are deliberately
 * shaped so the two existing heroes' tools each become the answer to something:
 *   - brute      — a slow, high-HP wall of a threat with a big breach; rewards
 *                  focus fire and route manipulation (walls buy time).
 *   - swarmling  — a fast, 2-HP throwaway that arrives in numbers; punished by
 *                  Ash's adjacent Cleave and by traps, not by single-target fire.
 *   - warden     — heavily armoured (high defense) but not especially healthy;
 *                  Wren's armour-piercing shot (ignoreDefense) is the clean tool,
 *                  while Ash chips it slowly. Makes defense meaningful.
 *   - razorwing  — a tougher, faster FLYER than the wisp; still ignores walls,
 *                  so the Sky Snare plus ranged fire is the intended counter.
 * The miniboss (basalt-colossus) is the wave-10 finale: very high HP, armoured,
 * slow, and a heavy breach if it gets through.
 *
 * Phase 11.6 (D-079): roster design for the Bestiary sub-phase. Adds TWO new
 * regular minions (hexer — the roster's first range-3 back-line nuisance;
 * ravager — the roster's fastest mover, a hard-closing melee threat) and TWO
 * new TRUE BOSSES (role: "boss", a tier above miniboss): the fire-themed
 * Cinderlord and the water-themed Tidelord. Both bosses are deliberately
 * bigger stat blocks than basalt-colossus (more HP, more defense, a scarier
 * breach, a bigger purse). Neither boss is wired into a wave yet;
 * `data/waves.ts` is untouched — Phase 11.8 (campaigns) will place them.
 * All names/stats/lore are ORIGINAL, invented for this project (see
 * CONTENT_SOURCES.md).
 *
 * Phase 13.1 (D-086): real dice replace deterministic combat. `defense` is
 * renamed `armorClass`, converted as `10 + the old defense value` (a simple,
 * uniform first-pass migration — every number here is flagged untuned for
 * the new model, same as every other balance value in this project, and
 * needs a real in-browser pass like everything else in KNOWN_ISSUES). Each
 * enemy also gains a flat `attackBonus` (its to-hit bonus against a hero's
 * Armor Class) — a first-pass number scaled loosely to the enemy's tier,
 * since enemies have no ability scores to derive one from.
 *
 * Phase 13.5 (D-090): every enemy also gains a flat `savingThrowBonus` — the
 * bonus it rolls against a save-based effect (e.g. the Cleric's Sacred
 * Flame). Real 5e derives a save from a specific ability score per effect
 * (Sacred Flame targets DEX); an enemy here has no ability scores at all, so
 * this is ONE flat number reused for every save an enemy might ever face,
 * same "flat, untuned, tier-scaled" simplification `attackBonus` already
 * uses — set equal to `attackBonus` for now, first-pass like everything else.
 *
 * Phase 13.10 (D-095): roster expansion — "more enemies at every tier, full
 * role tagging." Every pre-13.10 minion (grunt through ravager) gains an
 * EXPLICIT `role: "minion"` (previously omitted and implicitly treated as
 * minion by every reader — `BestiaryScene`'s grouping, `BattleScene`'s boss
 * presentation — this makes that the recorded fact, not an inference). Four
 * new enemies, one per real gap:
 *   - marauder     — a new minion, a flat stat variant: a glass-cannon
 *                    melee threat (high damage, ordinary HP/AC), a niche
 *                    none of the existing nine minions fill.
 *   - blightcaller — a new minion whose attack forces a saving throw
 *                    instead of a to-hit roll (`savingThrowAttackDC`,
 *                    new field above) — this roster's first real special
 *                    attack, now possible with 13.1's dice and 13.5's
 *                    `SavingThrowSystem`/`CharacterSystem.savingThrowBonus`
 *                    (built in 13.5, never actually called until now).
 *   - gravemaw      — a second MINIBOSS (there was only ever one,
 *                    basalt-colossus), a bone/iron construct guardian, a
 *                    flat stat variant scaled slightly past it.
 *   - blightmother  — a third true BOSS, thematically paired with
 *                    blightcaller (the same forced-save mechanic, at boss
 *                    scale) rather than a bigger stat block only.
 * All ORIGINAL content, no D&D/SRD-derived names or lore (see
 * CONTENT_SOURCES.md).
 *
 * Phase 20 (D-111): "tons of different enemies," almost all with a real,
 * mechanical hook rather than a flavour-only stat variant. Six brand-new
 * mechanics, each reused by at least two roster entries so none of them is a
 * one-off special case:
 *   - `siegeDamageMultiplier` — a siege enemy that finds a destructible wall
 *     within its own attack range attacks THAT instead of a hero this phase
 *     (see `WaveSystem.tickEnemyPhase`/`BuildSystem.damageStructure`).
 *   - `stealth` — hidden from hero targeting until its first strike (an
 *     Advantage-rolled ambush), which permanently reveals it (`Enemy
 *     .isRevealed`/`.reveal()`).
 *   - `auraBuff` — a captain/banner-type enemy buffs OTHER living enemies
 *     within `radiusTiles` (never itself) on `attackBonus`/`damageBonus`/
 *     `movementBonus`, recomputed fresh every phase (no persisted status).
 *   - `callsReinforcements` — periodically spawns more of another enemy id
 *     adjacent to itself, on a cooldown (`WaveSystem`'s own per-instance
 *     timer — deliberately NOT the hero-ally `SummonSystem`/`Summon`, a
 *     completely different Phase-16 system this reuses nothing from, to
 *     avoid conflating "an enemy calls in more enemies" with "a hero casts
 *     an ally").
 *   - `treasureBonusGold` — extra gold on top of `rewardGold` when the
 *     PARTY defeats it (never on a breach — see `RewardSystem.killGold`).
 *   - `aoeAttack` — hits every hero in its attack range at once (a real
 *     breath weapon), either a normal roll-vs-AC (`CombatSystem.attackArea`)
 *     or, combined with `savingThrowAttackDC`, a save-or-take-damage cone
 *     resolved once per hero in range.
 *   - `ignoresHeroes` — a pure runner: never attacks, always tries to
 *     advance, even with a hero standing right next to it. The only real
 *     counter is route manipulation (walls/traps), not combat.
 * A new role tier, `"legendary"` — above `"boss"` — marks the two capstone
 * threats built for a level-20+ party (see `EnemyRole`'s own comment). All
 * ORIGINAL content, no D&D/SRD-derived names or lore (see
 * CONTENT_SOURCES.md).
 *
 * Phase 21 (D-112): a second wave of archetypes, scoped and confirmed by
 * Kevin at the end of the Phase 20 session. Twelve more new mechanics:
 *   - `enrage` — Berserker: flat attack/damage bonus per 25%-HP band this
 *     enemy has lost (an enrage threshold), recomputed fresh each phase.
 *   - `lifedrinkPercent` — Lifedrinker: heals itself for a % of the damage
 *     it lands on a hero (never past its own `maxHealth`; a no-op if it's
 *     also a Swarm — see `Enemy.isSwarm`'s "can't regain HP" note).
 *   - `onDeathSpawns` — Splitter/Carrier: spawns weaker copies of another
 *     enemy id adjacent to itself the instant it's defeated (any cause —
 *     hero attack, trap, burn/poison tick).
 *   - `onDeathExplode` — Explosive: a flat-damage AoE burst centered on
 *     itself the instant it's defeated, hitting every hero in range.
 *   - `damageShieldHp` — Shielded: a flat damage-absorbing ward
 *     (`Combatant.absorbDamage`) that must be broken through before real HP
 *     loss applies.
 *   - `reflectsDamagePercent` — Reflector: while its shield still holds
 *     (`shieldHpRemaining > 0`), reflects a % of a landed melee hit back at
 *     the attacking hero.
 *   - `goldTheftAmount` — Gold Thief: a landed attack also steals gold from
 *     the party's economy (`EconomySystem.deduct`).
 *   - `teleportsEveryNTurns` — Teleporter: every N enemy phases, jumps
 *     straight toward the nearest exit, ignoring walls/blockers/the normal
 *     movement-tile limit for that one jump.
 *   - `mimicDisguise` — Mimic: renders as scenery/treasure and is untargetable
 *     until a hero gets adjacent, which reveals it (reuses `Enemy
 *     .isRevealed`/`.reveal()` — the same boolean primitive `stealth` uses,
 *     but a DIFFERENT trigger — proximity, not a landed first strike — and a
 *     different render, so the two mechanics stay conceptually separate).
 *   - `phaseChange` — Multi-Phase Boss: once this enemy's HP drops to
 *     `hpPercent` or below, its mechanic set permanently changes to
 *     `overrides` (a per-INSTANCE override — `Enemy.activeDef` — never a
 *     mutation of the shared, def-level object every instance of that enemy
 *     type references).
 *   - `swarm` — Swarm: verified against the real SRD 5.2.1/2024 "Swarm"
 *     trait (two independent sources, not assumed from memory — see
 *     DECISIONS D-112). Can occupy another living enemy's tile and vice
 *     versa (`WaveSystem`'s swarm-aware occupancy checks), is immune to a
 *     fixed set of conditions (`Enemy.SWARM_IMMUNE_STATUSES`), and deals
 *     half damage once Bloodied (`Enemy.attackDamage`). NOT modeled: the
 *     real bludgeoning/piercing/slashing damage RESISTANCE — this game has
 *     no damage-type-aware resistance system for any attack to hook into.
 *   - `inflictsStatusOnHit` — Healer/Debuffer hybrid, Anti-caster: a landed
 *     single-target attack also applies a status effect to the hero it hit
 *     (`Combatant.applyStatus`, an optional method both `Hero` and `Enemy`
 *     satisfy) — the mechanism that lets an enemy inflict "poisoned" or the
 *     new "silenced" status on a HERO for the first time (see `Hero`'s own
 *     `activeStatuses`, mirroring `Enemy`'s field-for-field).
 * All ORIGINAL content, no D&D/SRD-derived names or lore, EXCEPT the Swarm
 * archetype's verified real-SRD mechanical rules themselves (see
 * CONTENT_SOURCES.md's new Phase 21 row).
 *
 * Phase 25 (D-116): a Saboteur archetype — the counter to the player's own
 * trap investment. `trapSense` (see its own comment on `EnemyDefinition`)
 * detects a placed trap within reach and disarms/destroys it outright
 * instead of attacking or advancing that phase, at the same unconditional
 * priority tier the existing siege mechanic already established for walls.
 * Two roster entries: Saboteur (a fast, fragile ground scout, short
 * `rangeTiles`) and Warren Stalker (tougher, longer `rangeTiles`, so it can
 * clear a trap from one tile further out). All ORIGINAL content.
 */

export type MovementType = "ground" | "flying";

/**
 * Optional gameplay ROLE (Phase 7, D-051; extended Phase 11.6, D-079). Purely
 * a data tag: it lets the campaign and tests distinguish ordinary minions from
 * the tougher set-piece threats without any special engine handling. The
 * scene renders a boss like any other token for now (a distinct boss
 * presentation is future polish); combat, routing, and rewards treat every
 * role as an ordinary — if beefy — enemy. Omitted = an ordinary minion, so
 * every pre-11.6 definition is unchanged. "boss" (new, D-079) is a step up
 * from "miniboss": a true campaign-ending threat, reserved for enemies
 * meaningfully tougher than the existing miniboss (basalt-colossus, which
 * stays "miniboss", unchanged). "legendary" (Phase 20, D-111) is a further
 * step up from "boss": a capstone threat sized for a level-20+ party, built
 * toward a future "keep playing forever" endless mode (not itself built
 * this phase — see KNOWN_ISSUES.md). BattleScene gives it the same
 * big-token/banner visual treatment as "miniboss"/"boss", labelled
 * "(Legendary)".
 */
export type EnemyRole = "minion" | "miniboss" | "boss" | "legendary";

export interface EnemyDefinition {
  id: string;
  name: string;
  /** Combat (Phase 4): total hit points. */
  maxHealth: number;
  /** Combat (Phase 13.1, D-086): Armor Class — a hero's attack roll must meet or beat this to hit. */
  armorClass: number;
  /** Combat (Phase 13.1, D-086): this enemy's to-hit bonus against a hero's Armor Class. */
  attackBonus: number;
  /** Combat (Phase 13.5, D-090): this enemy's flat bonus on any saving throw it's asked to make. */
  savingThrowBonus: number;
  /**
   * Combat (Phase 13.10): when set, this enemy's attack forces the target to
   * roll a saving throw against this flat DC instead of the normal to-hit
   * roll — full `attackDamage` on a failed save, none on a success. Absent
   * (the vast majority of the roster) means a normal `attackBonus`-vs-AC
   * roll, unchanged.
   */
  savingThrowAttackDC?: number;
  /** Movement (Phase 3): tiles this enemy advances each enemy phase. */
  movementTiles: number;
  /** Breach (Phase 3): Stronghold Integrity removed if it reaches the exit. */
  breachDamage: number;
  /** Combat (Phase 4): damage dealt by a basic attack. */
  attackDamage: number;
  /** Combat (Phase 4): attack reach in tiles. */
  attackRangeTiles: number;
  /** "ground" routes around walls; "flying" (Phase 7, D-048) ignores them. */
  movementType: MovementType;
  /** Economy (Phase 5): gold awarded when defeated. */
  rewardGold: number;
  /** Ability ids (Phase 4+); empty for the current roster. */
  abilities: string[];
  /** Rendering hint (used later for real art); a colour is used for now. */
  assetKey: string;
  /** Optional role tag (Phase 7, D-051; extended Phase 11.6, D-079). Omitted = an ordinary minion. */
  role?: EnemyRole;
  /**
   * Optional one-or-two-sentence flavour text (Phase 11.6, D-079), shown by
   * BestiaryScene once the enemy has been SEEN. Original to this project;
   * no D&D/SRD-derived names or setting content. Omitted for most of the
   * pre-11.6 roster — not required, just a nice-to-have.
   */
  loreText?: string;
  /**
   * Phase 20 (D-111), siege: this enemy's `attackDamage` is multiplied by
   * this factor when it strikes a destructible wall structure instead of a
   * hero (see `WaveSystem.tickEnemyPhase`) — absent means it can't damage
   * structures at all, unchanged from every prior enemy.
   */
  siegeDamageMultiplier?: number;
  /**
   * Phase 20 (D-111), stealth: hidden from hero targeting (see
   * `BattleScene.isEnemyTargetable`) until its first strike, which lands
   * with Advantage (the ambush) and permanently reveals it. Absent means
   * always targetable, unchanged from every prior enemy.
   */
  stealth?: boolean;
  /**
   * Phase 20 (D-111), captain/banner: this enemy buffs every OTHER living
   * enemy within `radiusTiles` (Manhattan; never itself) on the listed
   * stat(s), recomputed fresh each enemy phase — not a persisted status, so
   * it stops the instant the source dies or the target steps out of range.
   */
  auraBuff?: {
    radiusTiles: number;
    /** Added to an affected ally's to-hit roll this phase. */
    attackBonus?: number;
    /** Added to an affected ally's attack damage this phase. */
    damageBonus?: number;
    /** Added to an affected ally's movement this phase. */
    movementBonus?: number;
  };
  /**
   * Phase 20 (D-111), reinforcements: every `intervalTurns` enemy phases,
   * this enemy spawns `count` more of `enemyId` on a free tile adjacent to
   * itself. Deliberately separate from the hero-ally `SummonSystem`/`Summon`
   * (Phase 16) — an enemy calling in more enemies shares no code with a
   * hero casting an ally.
   */
  callsReinforcements?: {
    enemyId: string;
    count: number;
    intervalTurns: number;
  };
  /**
   * Phase 20 (D-111), treasure: extra gold on top of `rewardGold` when the
   * PARTY defeats this enemy in combat (never on a breach — see
   * `RewardSystem.killGold`).
   */
  treasureBonusGold?: number;
  /**
   * Phase 20 (D-111), AoE/breath: this enemy's attack hits EVERY hero
   * within `attackRangeTiles` at once instead of picking one via
   * `CombatSystem.chooseTarget` — a normal roll-vs-AC per target
   * (`CombatSystem.attackArea`), or, combined with `savingThrowAttackDC`, a
   * save-or-take-damage cone resolved once per hero in range.
   */
  aoeAttack?: boolean;
  /**
   * Phase 20 (D-111), pure runner: this enemy never attacks a hero, even
   * one standing right next to it — it always tries to advance toward the
   * exit. The only real counter is route manipulation (walls/traps), not
   * combat.
   */
  ignoresHeroes?: boolean;
  /**
   * Phase 21 (D-112), Berserker: a flat bonus added to `attackBonus`/
   * `attackDamage` per `stepPercent`-sized band of HP this enemy has lost,
   * recomputed fresh each phase (see `WaveSystem.enrageBonusFor`) — never a
   * persisted status, so it eases off immediately if the enemy is healed.
   */
  enrage?: {
    stepPercent: number;
    attackBonusPerStep?: number;
    damageBonusPerStep?: number;
  };
  /**
   * Phase 21 (D-112), Lifedrinker: heals itself for this % of the damage it
   * lands on a hero with a basic attack (rounded down, never past its own
   * `maxHealth`). A no-op for a Swarm (`Enemy.isSwarm`) — a swarm can't
   * regain HP, per the real SRD trait.
   */
  lifedrinkPercent?: number;
  /**
   * Phase 21 (D-112), Splitter/Carrier: the instant this enemy is defeated
   * (by any means), spawns `count` weaker copies of `enemyId` on free tiles
   * adjacent to where it died.
   */
  onDeathSpawns?: {
    enemyId: string;
    count: number;
  };
  /**
   * Phase 21 (D-112), Explosive: the instant this enemy is defeated (by any
   * means), a flat-damage AoE burst centered on its last tile hits every
   * hero within `radiusTiles`, no roll (matches a trap's "always hits").
   */
  onDeathExplode?: {
    damage: number;
    radiusTiles: number;
  };
  /**
   * Phase 21 (D-112), Shielded: a flat damage-absorbing ward this enemy
   * starts the battle with (`Combatant.absorbDamage`) — must be broken
   * through before a hit reduces its real HP. Does not regenerate once
   * spent.
   */
  damageShieldHp?: number;
  /**
   * Phase 21 (D-112), Reflector: while this enemy's shield still holds
   * (`Enemy.shieldHpRemaining > 0` — pairs with `damageShieldHp`), reflects
   * this % of a landed melee hit's actual HP damage back at the attacking
   * hero.
   */
  reflectsDamagePercent?: number;
  /**
   * Phase 21 (D-112), Gold Thief: a landed attack against a hero also steals
   * this much gold from the party's economy (`EconomySystem.deduct`),
   * floored at however much the party actually has.
   */
  goldTheftAmount?: number;
  /**
   * Phase 21 (D-112), Teleporter: every `teleportsEveryNTurns` enemy phases,
   * this enemy jumps straight toward the nearest exit — ignoring walls,
   * blockers, and the normal movement-tile limit for that one jump — instead
   * of attacking or advancing normally that phase.
   */
  teleportsEveryNTurns?: number;
  /**
   * Phase 21 (D-112), Mimic: disguised as scenery/treasure and untargetable
   * (see `BattleScene.isEnemyTargetable`) until a hero moves adjacent to it,
   * which reveals it permanently (`Enemy.isRevealed`/`.reveal()` — the same
   * boolean primitive `stealth` uses, but triggered by PROXIMITY, not a
   * landed first strike, and rendered as disguised scenery rather than a dim
   * "?" token — the two mechanics are deliberately kept conceptually
   * separate despite sharing that one boolean).
   */
  mimicDisguise?: boolean;
  /**
   * Phase 21 (D-112), Multi-Phase Boss: once this enemy's HP drops to
   * `hpPercent` (of its BASE `maxHealth`) or below, `overrides` permanently
   * replaces the listed fields for this INSTANCE only (`Enemy.activeDef`) —
   * every other instance of the same enemy TYPE, and the shared `def` object
   * itself, are untouched.
   */
  phaseChange?: {
    hpPercent: number;
    overrides: Partial<
      Pick<EnemyDefinition, "attackDamage" | "attackBonus" | "armorClass" | "movementTiles" | "aoeAttack" | "callsReinforcements" | "savingThrowAttackDC">
    >;
  };
  /**
   * Phase 21 (D-112), Swarm: verified against the real SRD 5.2.1/2024
   * "Swarm" trait. See `Enemy.isSwarm`'s own comment for the full mechanical
   * breakdown; the trait's damage-type resistance is modeled separately, see
   * `damageResistances` below (D-127).
   */
  swarm?: boolean;
  /**
   * D-127: nonmagical damage-type resistance (the real SRD Swarm trait's
   * bludgeoning/piercing/slashing resistance, previously not modeled — see
   * `Enemy.isSwarm`). Halves a landed weapon attack's damage when its
   * `AttackProfile.damageType` is in this list and the attacker isn't
   * wielding an enchanted (+1/+2/+3) weapon or holding Boon of Irresistible
   * Offense (`CombatSystem.applyAttack`, `Hero.attackIsMagical`). Spell
   * damage never sets a `damageType` at all, so it's never resisted here —
   * matching the real trait's "nonmagical" scope without needing a
   * damage-type field on all 318 spells. Absent means no resistance, same as
   * every enemy before this decision.
   */
  damageResistances?: DamageType[];
  /**
   * Phase 21 (D-112), Healer/Debuffer hybrid + Anti-caster: a landed
   * single-target attack against a hero also applies this status effect to
   * it (`Combatant.applyStatus`) — e.g. "poisoned" (a plague-doctor-style
   * healer that also poisons) or the new "silenced" (Anti-caster's Silence/
   * Anti-Magic-Field stand-in). Absent means an attack is pure damage, same
   * as every enemy before this phase.
   */
  inflictsStatusOnHit?: {
    id: StatusEffectId;
    durationTurns: number;
  };
  /**
   * Phase 21 (D-112), Healer: heals every OTHER living, wounded enemy within
   * `radiusTiles` (Manhattan; never itself) by `healAmount` each enemy
   * phase — the `auraBuff` shape (Phase 20), healing instead of buffing a
   * stat. Never heals a Swarm past the "can't regain HP" rule (`Enemy
   * .isSwarm`).
   */
  healAura?: {
    radiusTiles: number;
    healAmount: number;
  };
  /**
   * Phase 25 (D-116), Saboteur: this enemy detects a placed trap within
   * `rangeTiles` (Manhattan) of its own position and, before considering
   * anything else this phase (the same unconditional-priority tier siege's
   * `siegeDamageMultiplier` uses), disarms/destroys ONE such trap instead of
   * attacking a hero or advancing (`WaveSystem.tickEnemyPhase`'s
   * `trapInstanceAt`/`disarmTrap` context, `BuildSystem.disarmTrap`). A trap
   * has no HP to whittle down (D-039: it always hits), so this always
   * removes it outright in a single phase — no partial damage. Absent means
   * this enemy never notices or touches a trap at all, unchanged from every
   * enemy before this phase (it simply walks onto one and eats the hit, like
   * always).
   */
  trapSense?: { rangeTiles: number };
}

export const ENEMY_DEFINITIONS: Record<string, EnemyDefinition> = {
  grunt: {
    id: "grunt",
    name: "Grunt",
    maxHealth: 6,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 3,
    abilities: [],
    assetKey: "enemy-grunt",
    role: "minion",
  },
  runner: {
    id: "runner",
    name: "Runner",
    maxHealth: 3,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 3,
    breachDamage: 1,
    attackDamage: 1,
    // Phase 4: the Runner is the RANGED enemy behaviour — a fast, fragile
    // skirmisher that pokes heroes from two tiles away (Manhattan). The Grunt
    // remains the MELEE behaviour (range 1). See DECISIONS D-032.
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 2,
    abilities: [],
    assetKey: "enemy-runner",
    role: "minion",
  },
  // Phase 7 (D-048): the first FLYING enemy. A flyer routes straight over walls
  // and barricades toward the exit, so it can't be re-routed by construction the
  // way ground enemies can — it must be intercepted and killed. It is fragile
  // and low-value to keep that shortcut fair; the intended counter is heroes /
  // ranged fire and the Sky Snare anti-air hazard. All ORIGINAL.
  wisp: {
    id: "wisp",
    name: "Wisp",
    maxHealth: 4,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 3,
    breachDamage: 2,
    attackDamage: 1,
    attackRangeTiles: 1,
    movementType: "flying",
    rewardGold: 3,
    abilities: [],
    assetKey: "enemy-wisp",
    role: "minion",
  },

  // ----- Phase 7 roster expansion (D-050) -------------------------------

  // The BRUTE: a slow, heavily-built ground threat with a large breach. Left
  // alone it deletes a big slice of Stronghold Integrity, so it demands either
  // focus fire or a wall that lengthens its route enough for the party to catch
  // it. Rewards well to justify the effort.
  brute: {
    id: "brute",
    name: "Brute",
    maxHealth: 16,
    armorClass: 12,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 4,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    abilities: [],
    assetKey: "enemy-brute",
    role: "minion",
  },

  // The SWARMLING: a 2-HP throwaway that arrives in packs. Single-target fire
  // can only delete one per turn, so a swarm leaks unless the player answers it
  // with area damage (Ash's Cleave) or a lane lined with traps. Low value each.
  swarmling: {
    id: "swarmling",
    name: "Swarmling",
    maxHealth: 2,
    armorClass: 10,
    attackBonus: 2,
    savingThrowBonus: 2,
    movementTiles: 3,
    breachDamage: 1,
    attackDamage: 1,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 1,
    abilities: [],
    assetKey: "enemy-swarmling",
    role: "minion",
  },

  // The WARDEN: an armoured ground enemy. Its high defense blunts ordinary
  // strikes (Ash is reduced to a chip), but it isn't especially healthy — so
  // Wren's armour-piercing shot is the clean answer. Makes the defense stat,
  // and the ignoreDefense tool, matter tactically.
  warden: {
    id: "warden",
    name: "Warden",
    maxHealth: 10,
    armorClass: 13,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    abilities: [],
    assetKey: "enemy-warden",
    role: "minion",
  },

  // The RAZORWING: a tougher, faster FLYER than the wisp. It still ignores
  // walls, so barricades do nothing to it — the counter is the Sky Snare in its
  // lane plus ranged fire. A real reason to invest in anti-air.
  razorwing: {
    id: "razorwing",
    name: "Razorwing",
    maxHealth: 7,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 3,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "flying",
    rewardGold: 4,
    abilities: [],
    assetKey: "enemy-razorwing",
    role: "minion",
  },

  // The BASALT COLOSSUS: the campaign's first MINIBOSS (wave 10 finale). Very
  // high HP, armoured, slow, and a heavy breach if it reaches the exit. It is
  // beatable by the two-hero party if the player has built up a trapped lane and
  // focuses it down once its escort is cleared — that is the intended climax.
  // Rewards a large purse. All ORIGINAL content.
  "basalt-colossus": {
    id: "basalt-colossus",
    name: "Basalt Colossus",
    maxHealth: 30,
    armorClass: 13,
    attackBonus: 5,
    savingThrowBonus: 5,
    movementTiles: 2,
    breachDamage: 6,
    attackDamage: 4,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 20,
    abilities: [],
    assetKey: "enemy-basalt-colossus",
    role: "miniboss",
    loreText:
      "No mason shaped the Basalt Colossus — it woke on its own, deep under the old quarry, when enough rubble had piled onto enough rubble to remember what walking was.",
  },

  // ----- Phase 11.6 roster expansion (D-079) ----------------------------

  // The HEXER: the roster's first range-3 threat. Fragile and slow, it never
  // wants to close distance — it settles at the back of a pack and pokes from
  // farther away than any hero can ordinarily out-range on approach, so it
  // rewards intercepting it early rather than letting it set up.
  hexer: {
    id: "hexer",
    name: "Hexer",
    maxHealth: 5,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 3,
    movementType: "ground",
    rewardGold: 4,
    abilities: [],
    assetKey: "enemy-hexer",
    role: "minion",
    loreText:
      "The Hexer never raises its voice above a mutter, but the muttering keeps pace with your heartbeat from three tiles off, which is somehow worse.",
  },

  // The RAVAGER: the roster's fastest mover (4 tiles), a hard-closing melee
  // threat that punishes a slow response — by the time it is spotted it may
  // already be in range. Solid HP and damage back up the speed.
  ravager: {
    id: "ravager",
    name: "Ravager",
    maxHealth: 9,
    armorClass: 11,
    attackBonus: 4,
    savingThrowBonus: 4,
    movementTiles: 4,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    abilities: [],
    assetKey: "enemy-ravager",
    role: "minion",
    loreText:
      "The Ravager doesn't walk a lane so much as fall down it, all elbows and momentum, and it is already swinging before it fully arrives.",
  },

  // The CINDERLORD: a true BOSS (D-079), fire-themed for the future campaign
  // Phase 11.7's matching fire terrain will serve. Meaningfully tougher than
  // basalt-colossus across the board — more HP, more defense, a heavier
  // breach, and a bigger purse — but mechanically it is still just a bigger
  // stat block: no elemental damage type, no proc, same diceless combat
  // (D-030). Not yet placed in any wave; that is Phase 11.8's job.
  cinderlord: {
    id: "cinderlord",
    name: "Cinderlord",
    maxHealth: 45,
    armorClass: 14,
    attackBonus: 6,
    savingThrowBonus: 6,
    movementTiles: 2,
    breachDamage: 8,
    attackDamage: 6,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 30,
    abilities: [],
    assetKey: "enemy-cinderlord",
    role: "boss",
    loreText:
      "Once a smith who begged the deep fire for strength, the Cinderlord no longer remembers his own name — only the furnace-song that answers whenever he opens his mouth to speak.",
  },

  // The TIDELORD: the second true BOSS (D-079), water-themed to pair with the
  // Cinderlord for Phase 11.7's terrain and Phase 11.8's campaigns. Trades a
  // little of the Cinderlord's raw HP for a longer reach (2 tiles) and one
  // extra tile of movement — a surging, harder-to-outrun threat rather than a
  // pure wall. Still meaningfully tougher than basalt-colossus on every axis.
  tidelord: {
    id: "tidelord",
    name: "Tidelord",
    maxHealth: 40,
    armorClass: 13,
    attackBonus: 6,
    savingThrowBonus: 6,
    movementTiles: 3,
    breachDamage: 7,
    attackDamage: 5,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 32,
    abilities: [],
    assetKey: "enemy-tidelord",
    role: "boss",
    loreText:
      "The Tidelord rose the night the old sea wall finally gave out, and it has dragged the drowned village behind it in its wake ever since — it still calls the wreckage its crew.",
  },

  // ----- Phase 13.10 roster expansion (D-095) ---------------------------

  // The MARAUDER: a new minion, a flat stat variant — a glass-cannon melee
  // threat. Ordinary HP and AC, but its attack damage outpaces every other
  // minion at its tier, rewarding a player who focuses it down fast over
  // one who lets it keep swinging.
  marauder: {
    id: "marauder",
    name: "Marauder",
    maxHealth: 8,
    armorClass: 11,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 4,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 4,
    abilities: [],
    assetKey: "enemy-marauder",
    role: "minion",
    loreText:
      "The Marauder doesn't bother blocking — every hit it takes is a hit it plans to return twice over before it goes down.",
  },

  // The BLIGHTCALLER: this roster's first real special attack. Its strike
  // forces the target hero to roll a saving throw (`savingThrowAttackDC`)
  // instead of the normal to-hit-vs-AC roll — a high-AC hero gains nothing
  // against it, but a hero with a real DEX save (a D&D-built party) can
  // shrug it off outright. Fragile and mid-range, rewarding the player who
  // intercepts it before it settles in.
  blightcaller: {
    id: "blightcaller",
    name: "Blightcaller",
    maxHealth: 5,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 3,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 5,
    savingThrowAttackDC: 12,
    abilities: [],
    assetKey: "enemy-blightcaller",
    role: "minion",
    loreText:
      "The Blightcaller doesn't aim so much as exhale, and the air it exhales into keeps right on rotting after it's gone quiet.",
  },

  // The GRAVEMAW: a second MINIBOSS (there was only ever one, basalt-
  // colossus). A bone-and-iron construct guardian, a flat stat variant
  // scaled slightly past the colossus across the board — a second
  // milestone target for a party that's outgrown the original.
  gravemaw: {
    id: "gravemaw",
    name: "Gravemaw",
    maxHealth: 34,
    armorClass: 14,
    attackBonus: 5,
    savingThrowBonus: 5,
    movementTiles: 2,
    breachDamage: 6,
    attackDamage: 5,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 22,
    abilities: [],
    assetKey: "enemy-gravemaw",
    role: "miniboss",
    loreText:
      "Old battlefields don't stay empty forever. Enough bone, enough rusted iron, enough time — and something eventually remembers how to want.",
  },

  // The BLIGHTMOTHER: a third true BOSS, thematically paired with the
  // Blightcaller rather than just a bigger stat block — the SAME forced-
  // save attack, at a much harder DC and heavier damage. Not yet tied to
  // any campaign/map (a future item, same staging Cinderlord/Tidelord had
  // before Phase 11.8 built theirs); reachable today via Free Play and the
  // Bestiary.
  blightmother: {
    id: "blightmother",
    name: "Blightmother",
    maxHealth: 42,
    armorClass: 14,
    attackBonus: 7,
    savingThrowBonus: 7,
    movementTiles: 2,
    breachDamage: 8,
    attackDamage: 7,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 34,
    savingThrowAttackDC: 15,
    abilities: [],
    assetKey: "enemy-blightmother",
    role: "boss",
    loreText:
      "Nothing that walks near the Blightmother's ground stays green for long — she doesn't kill her garden so much as convince it to become her instead.",
  },

  // ----- Phase 20 roster expansion (D-111) ------------------------------
  // "Tons of different enemies," almost all with a real mechanical hook —
  // see this file's own top-of-file comment for the six new mechanics these
  // sixteen minions, one miniboss, two bosses, and two legendaries reuse.

  // SIEGEBREAKER: the roster's first SIEGE enemy. An ordinary melee threat
  // to a hero, but a wall standing in its own attack range gets attacked
  // FIRST, at triple damage — it exists to open holes in the player's
  // defenses for everything spawning behind it.
  siegebreaker: {
    id: "siegebreaker",
    name: "Siegebreaker",
    maxHealth: 14,
    armorClass: 12,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    siegeDamageMultiplier: 3,
    abilities: [],
    assetKey: "enemy-siegebreaker",
    role: "minion",
    loreText:
      "The Siegebreaker doesn't care who's standing behind the barricade — it only ever sees the barricade.",
  },

  // BATTERING BRUTE: a second, slower/tougher SIEGE minion — a much bigger
  // hit against a wall, at the cost of being the slowest minion in the
  // roster. Rewards a player who can't afford to just let it keep swinging.
  "battering-brute": {
    id: "battering-brute",
    name: "Battering Brute",
    maxHealth: 20,
    armorClass: 13,
    attackBonus: 4,
    savingThrowBonus: 4,
    movementTiles: 1,
    breachDamage: 4,
    attackDamage: 4,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    siegeDamageMultiplier: 5,
    abilities: [],
    assetKey: "enemy-battering-brute",
    role: "minion",
    loreText:
      "Every barricade the Battering Brute has ever met has eventually agreed to become a doorway.",
  },

  // SHADOWFANG: the roster's first STEALTH enemy — invisible to hero
  // targeting until it strikes, at which point its ambush lands with
  // Advantage and it is revealed for the rest of the battle. Fragile once
  // spotted; the danger is entirely in not seeing it coming.
  shadowfang: {
    id: "shadowfang",
    name: "Shadowfang",
    maxHealth: 6,
    armorClass: 12,
    attackBonus: 5,
    savingThrowBonus: 3,
    movementTiles: 3,
    breachDamage: 2,
    attackDamage: 5,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    stealth: true,
    abilities: [],
    assetKey: "enemy-shadowfang",
    role: "minion",
    loreText:
      "You never see a Shadowfang coming. You only ever notice, a heartbeat too late, that you stopped seeing everything else around it too.",
  },

  // NIGHTBLADE: a second, tougher STEALTH minion — a harder-hitting ambush,
  // still fragile once revealed.
  nightblade: {
    id: "nightblade",
    name: "Nightblade",
    maxHealth: 8,
    armorClass: 13,
    attackBonus: 6,
    savingThrowBonus: 4,
    movementTiles: 3,
    breachDamage: 2,
    attackDamage: 7,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    stealth: true,
    abilities: [],
    assetKey: "enemy-nightblade",
    role: "minion",
    loreText:
      "The Nightblade only ever introduces itself once, and it is not really an introduction.",
  },

  // SPRINTER: the roster's first PURE RUNNER — it never attacks a hero, not
  // even one standing right next to it, and always tries to advance. Very
  // low HP and breach damage on purpose: the threat is entirely about route
  // control (walls, traps), never about combat.
  sprinter: {
    id: "sprinter",
    name: "Sprinter",
    maxHealth: 4,
    armorClass: 10,
    attackBonus: 2,
    savingThrowBonus: 2,
    movementTiles: 5,
    breachDamage: 1,
    attackDamage: 1,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 2,
    ignoresHeroes: true,
    abilities: [],
    assetKey: "enemy-sprinter",
    role: "minion",
    loreText:
      "The Sprinter has never once thrown a punch. It has also never once been late.",
  },

  // BOLT RUNNER: a second, tougher PURE RUNNER — more HP and a heavier
  // breach if it isn't stopped by a wall or a trap in time.
  "bolt-runner": {
    id: "bolt-runner",
    name: "Bolt Runner",
    maxHealth: 7,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 4,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 3,
    ignoresHeroes: true,
    abilities: [],
    assetKey: "enemy-bolt-runner",
    role: "minion",
    loreText:
      "A Bolt Runner has one job, and swinging at whoever's in its way was never part of it.",
  },

  // IRONHIDE: the roster's first pure TANK minion — no special mechanic,
  // just a wall of HP and Armor Class with an ordinary hit of its own.
  // Rewards focus fire or armour-piercing tools over a slow chip.
  ironhide: {
    id: "ironhide",
    name: "Ironhide",
    maxHealth: 22,
    armorClass: 15,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 1,
    breachDamage: 3,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    abilities: [],
    assetKey: "enemy-ironhide",
    role: "minion",
    loreText:
      "Nobody has ever seen what's actually under an Ironhide's plating, mostly because nothing has ever hit hard enough to find out.",
  },

  // HOARDER: the roster's first TREASURE-LADEN minion — ordinary stats, but
  // a real bonus payout on top of its normal reward gold when the party
  // finishes it off.
  hoarder: {
    id: "hoarder",
    name: "Hoarder",
    maxHealth: 9,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 4,
    treasureBonusGold: 10,
    abilities: [],
    assetKey: "enemy-hoarder",
    role: "minion",
    loreText:
      "A Hoarder never drops what it's carrying voluntarily. Killing it is, functionally, the only known withdrawal method.",
  },

  // GILDED CARRIER: a second TREASURE-LADEN minion, this one FLYING — it
  // ignores walls on its way to the exit, so the reward for catching it
  // before it escapes is a real one.
  "gilded-carrier": {
    id: "gilded-carrier",
    name: "Gilded Carrier",
    maxHealth: 6,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 3,
    breachDamage: 2,
    attackDamage: 1,
    attackRangeTiles: 1,
    movementType: "flying",
    rewardGold: 3,
    treasureBonusGold: 14,
    abilities: [],
    assetKey: "enemy-gilded-carrier",
    role: "minion",
    loreText:
      "The Gilded Carrier flies exactly the way you'd expect something that heavy with someone else's gold to fly: badly, but just barely fast enough.",
  },

  // CULTIST CALLER: the roster's first REINFORCEMENTS minion — every few
  // enemy phases it calls in more Swarmlings on an open tile beside itself,
  // rewarding a player who kills the caller fast over one who lets the
  // pack grow.
  "cultist-caller": {
    id: "cultist-caller",
    name: "Cultist Caller",
    maxHealth: 7,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 5,
    callsReinforcements: { enemyId: "swarmling", count: 2, intervalTurns: 3 },
    abilities: [],
    assetKey: "enemy-cultist-caller",
    role: "minion",
    loreText:
      "The Cultist Caller's chant has no real words in it. It doesn't need any — the swarm answers the tone, not the meaning.",
  },

  // BONE SUMMONER: a second, tougher REINFORCEMENTS minion — calls in a
  // fresh Grunt more often than the Cultist Caller calls Swarmlings.
  "bone-summoner": {
    id: "bone-summoner",
    name: "Bone Summoner",
    maxHealth: 12,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 4,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 2,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 7,
    callsReinforcements: { enemyId: "grunt", count: 1, intervalTurns: 2 },
    abilities: [],
    assetKey: "enemy-bone-summoner",
    role: "minion",
    loreText:
      "The Bone Summoner doesn't raise the dead so much as remind them they were never asked if they wanted to stay down.",
  },

  // WARCAPTAIN: the roster's first AURA/CAPTAIN minion — buffs every OTHER
  // living enemy within 2 tiles on their TO-HIT roll. Killing it fast is
  // worth more than its own modest stat block suggests.
  warcaptain: {
    id: "warcaptain",
    name: "Warcaptain",
    maxHealth: 13,
    armorClass: 12,
    attackBonus: 4,
    savingThrowBonus: 4,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 7,
    auraBuff: { radiusTiles: 2, attackBonus: 2 },
    abilities: [],
    assetKey: "enemy-warcaptain",
    role: "minion",
    loreText:
      "The Warcaptain has never landed the killing blow on anything in its whole career, and has never once cared.",
  },

  // BATTLEPRIEST: a second AURA/CAPTAIN minion — buffs nearby allies'
  // DAMAGE instead of their to-hit roll, a different stat from the
  // Warcaptain's buff on purpose.
  battlepriest: {
    id: "battlepriest",
    name: "Battlepriest",
    maxHealth: 12,
    armorClass: 12,
    attackBonus: 3,
    savingThrowBonus: 4,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 7,
    auraBuff: { radiusTiles: 2, damageBonus: 2 },
    abilities: [],
    assetKey: "enemy-battlepriest",
    role: "minion",
    loreText:
      "The Battlepriest's blessing has nothing kind in it, but it is, in a narrow technical sense, still a blessing.",
  },

  // BANNERBEARER: a third AURA/CAPTAIN minion — buffs nearby allies'
  // MOVEMENT, a third distinct stat from Warcaptain's/Battlepriest's.
  bannerbearer: {
    id: "bannerbearer",
    name: "Bannerbearer",
    maxHealth: 11,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    auraBuff: { radiusTiles: 2, movementBonus: 1 },
    abilities: [],
    assetKey: "enemy-bannerbearer",
    role: "minion",
    loreText:
      "Nobody remembers the Bannerbearer's name. Everyone remembers how much faster the charge felt once the banner went up.",
  },

  // CAVE DRAKE: the roster's first AOE/BREATH minion — a real breath
  // weapon that hits EVERY hero within 2 tiles at once, a normal roll vs.
  // Armor Class per target.
  "cave-drake": {
    id: "cave-drake",
    name: "Cave Drake",
    maxHealth: 16,
    armorClass: 12,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 7,
    aoeAttack: true,
    abilities: [],
    assetKey: "enemy-cave-drake",
    role: "minion",
    loreText:
      "A Cave Drake's fire doesn't pick favourites. That is, in practice, the whole problem.",
  },

  // FROST WARDEN: a second AOE/BREATH minion, this one a save-or-take-
  // damage cone (combines aoeAttack with a forced saving throw) — every
  // hero within 2 tiles rolls its own save instead of the Warden rolling
  // to hit.
  "frost-warden": {
    id: "frost-warden",
    name: "Frost Warden",
    maxHealth: 14,
    armorClass: 12,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 7,
    aoeAttack: true,
    savingThrowAttackDC: 12,
    abilities: [],
    assetKey: "enemy-frost-warden",
    role: "minion",
    loreText:
      "The Frost Warden never raises its voice, either. The cold does the talking, and everyone standing nearby understands it perfectly.",
  },

  // JUGGERNAUT: a new MINIBOSS — a tank-and-siege hybrid, on purpose: it
  // bulldozes through heroes AND walls alike, the slowest, toughest thing
  // in the roster below true boss scale.
  juggernaut: {
    id: "juggernaut",
    name: "Juggernaut",
    maxHealth: 38,
    armorClass: 15,
    attackBonus: 5,
    savingThrowBonus: 5,
    movementTiles: 1,
    breachDamage: 7,
    attackDamage: 5,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 24,
    siegeDamageMultiplier: 4,
    abilities: [],
    assetKey: "enemy-juggernaut",
    role: "miniboss",
    loreText:
      "A Juggernaut does not go around things. This has never once occurred to it as an option worth considering.",
  },

  // WARLORD KORRATH: a new true BOSS — a much bigger AURA/CAPTAIN, buffing
  // every ally within 3 tiles on BOTH to-hit and damage, backed by a solid
  // combat stat block of its own.
  "warlord-korrath": {
    id: "warlord-korrath",
    name: "Warlord Korrath",
    maxHealth: 46,
    armorClass: 14,
    attackBonus: 6,
    savingThrowBonus: 6,
    movementTiles: 2,
    breachDamage: 8,
    attackDamage: 5,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 32,
    auraBuff: { radiusTiles: 3, attackBonus: 2, damageBonus: 2 },
    abilities: [],
    assetKey: "enemy-warlord-korrath",
    role: "boss",
    loreText:
      "Korrath has not swung a blade in anger in years. He has never needed to — everyone standing near him swings twice as hard, and he watches.",
  },

  // THE DEVOURER: a second new true BOSS — calls in a fresh Marauder every
  // couple of phases AND carries a very large treasure bonus, rewarding a
  // player who ends the fight fast on both counts.
  "the-devourer": {
    id: "the-devourer",
    name: "The Devourer",
    maxHealth: 44,
    armorClass: 13,
    attackBonus: 6,
    savingThrowBonus: 5,
    movementTiles: 2,
    breachDamage: 7,
    attackDamage: 5,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 36,
    callsReinforcements: { enemyId: "marauder", count: 1, intervalTurns: 2 },
    treasureBonusGold: 20,
    abilities: [],
    assetKey: "enemy-the-devourer",
    role: "boss",
    loreText:
      "The Devourer doesn't hoard out of greed. It hoards because it has genuinely forgotten there was ever a difference between eating and keeping.",
  },

  // ASHEN SOVEREIGN: the roster's first LEGENDARY threat — a level-20+
  // capstone that combines a real breath weapon, a captain's aura for
  // anything else on the field, AND enough raw siege power to shrug through
  // a barricade on its way to a hero.
  "ashen-sovereign": {
    id: "ashen-sovereign",
    name: "Ashen Sovereign",
    maxHealth: 110,
    armorClass: 17,
    attackBonus: 9,
    savingThrowBonus: 8,
    movementTiles: 2,
    breachDamage: 14,
    attackDamage: 8,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 70,
    aoeAttack: true,
    auraBuff: { radiusTiles: 3, attackBonus: 2 },
    siegeDamageMultiplier: 3,
    abilities: [],
    assetKey: "enemy-ashen-sovereign",
    role: "legendary",
    loreText:
      "There is no throne left standing anywhere the Ashen Sovereign has ever chosen to rule. It has stopped noticing this is a pattern.",
  },

  // THE HOLLOW EMPRESS: a second LEGENDARY capstone — a mass dread aura
  // that forces every hero nearby to save at once, reinforcements on a
  // cooldown, AND the single largest treasure bonus in the roster.
  "the-hollow-empress": {
    id: "the-hollow-empress",
    name: "The Hollow Empress",
    maxHealth: 120,
    armorClass: 16,
    attackBonus: 8,
    savingThrowBonus: 9,
    movementTiles: 2,
    breachDamage: 15,
    attackDamage: 7,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 80,
    aoeAttack: true,
    savingThrowAttackDC: 16,
    callsReinforcements: { enemyId: "blightcaller", count: 1, intervalTurns: 3 },
    treasureBonusGold: 40,
    abilities: [],
    assetKey: "enemy-the-hollow-empress",
    role: "legendary",
    loreText:
      "The Hollow Empress has no court left, no kingdom left, and no memory of either — only the certainty that she is still owed one.",
  },

  // ===== Phase 21 (D-112): second wave of archetypes =====

  // Berserker family (enrage): flat attack/damage bonus per HP band lost.
  "frenzied-cultist": {
    id: "frenzied-cultist",
    name: "Frenzied Cultist",
    maxHealth: 10,
    armorClass: 11,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    enrage: { stepPercent: 25, attackBonusPerStep: 1, damageBonusPerStep: 1 },
    abilities: [],
    assetKey: "enemy-frenzied-cultist",
    role: "minion",
    loreText: "The Frenzied Cultist fights worse the healthier it is — every wound only convinces it further.",
  },
  "bloodrage-warlord": {
    id: "bloodrage-warlord",
    name: "Bloodrage Warlord",
    maxHealth: 42,
    armorClass: 13,
    attackBonus: 6,
    savingThrowBonus: 5,
    movementTiles: 2,
    breachDamage: 6,
    attackDamage: 6,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 20,
    enrage: { stepPercent: 20, attackBonusPerStep: 1, damageBonusPerStep: 2 },
    abilities: [],
    assetKey: "enemy-bloodrage-warlord",
    role: "miniboss",
    loreText: "Bleed the Bloodrage Warlord and it only swings harder — there is no version of this fight that gets easier by waiting.",
  },

  // Lifedrinker family: heals itself off the damage it lands.
  bloodwisp: {
    id: "bloodwisp",
    name: "Bloodwisp",
    maxHealth: 8,
    armorClass: 11,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    lifedrinkPercent: 50,
    abilities: [],
    assetKey: "enemy-bloodwisp",
    role: "minion",
    loreText: "A Bloodwisp is barely there until it draws blood — then, for a moment, it's a great deal more there.",
  },
  "crimson-leech": {
    id: "crimson-leech",
    name: "Crimson Leech",
    maxHealth: 12,
    armorClass: 12,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 4,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    lifedrinkPercent: 75,
    abilities: [],
    assetKey: "enemy-crimson-leech",
    role: "minion",
    loreText: "The Crimson Leech doesn't fear a long fight. A long fight is exactly what it's hoping for.",
  },

  // Splitter family: breaks into weaker copies of Living Splinter on death.
  // Living Splinter itself is the shared fodder both splitters spawn — a
  // plain, ordinary stat variant with no mechanic of its own.
  "living-splinter": {
    id: "living-splinter",
    name: "Living Splinter",
    maxHealth: 3,
    armorClass: 10,
    attackBonus: 2,
    savingThrowBonus: 2,
    movementTiles: 2,
    breachDamage: 1,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 1,
    abilities: [],
    assetKey: "enemy-living-splinter",
    role: "minion",
    loreText: "A Living Splinter was never the whole threat — only ever a piece of one.",
  },
  "ooze-splitter": {
    id: "ooze-splitter",
    name: "Ooze Splitter",
    maxHealth: 14,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 1,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    onDeathSpawns: { enemyId: "living-splinter", count: 2 },
    abilities: [],
    assetKey: "enemy-ooze-splitter",
    role: "minion",
    loreText: "Killing an Ooze Splitter doesn't end it. It just gives it two problems to be instead of one.",
  },
  "fungal-splitter": {
    id: "fungal-splitter",
    name: "Fungal Splitter",
    maxHealth: 16,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 1,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    onDeathSpawns: { enemyId: "living-splinter", count: 2 },
    abilities: [],
    assetKey: "enemy-fungal-splitter",
    role: "minion",
    loreText: "The Fungal Splitter treats every killing blow it receives as a planting.",
  },

  // Carrier/Vessel: a high-HP, low-attack piñata that bursts into several
  // Living Splinters once broken — reuses `onDeathSpawns`, tuned as a
  // damage sponge rather than a fighter.
  "the-husk": {
    id: "the-husk",
    name: "The Husk",
    maxHealth: 50,
    armorClass: 10,
    attackBonus: 1,
    savingThrowBonus: 2,
    movementTiles: 1,
    breachDamage: 2,
    attackDamage: 1,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 15,
    onDeathSpawns: { enemyId: "living-splinter", count: 4 },
    abilities: [],
    assetKey: "enemy-the-husk",
    role: "miniboss",
    loreText: "The Husk barely fights back. It doesn't need to — it was never the thing that was going to hurt you.",
  },

  // Shielded family: a flat damage-absorbing ward that must be broken
  // through first. Aegis Bearer is the Shielded/Reflector combo Kevin asked
  // for ("some shielded enemies could ALSO reflect") — one roster entry,
  // not a separate family.
  "warded-sentinel": {
    id: "warded-sentinel",
    name: "Warded Sentinel",
    maxHealth: 10,
    armorClass: 12,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    damageShieldHp: 8,
    abilities: [],
    assetKey: "enemy-warded-sentinel",
    role: "minion",
    loreText: "Every blow that lands on a Warded Sentinel's ward first, and its hide second, in that order, without exception.",
  },
  "aegis-bearer": {
    id: "aegis-bearer",
    name: "Aegis Bearer",
    maxHealth: 12,
    armorClass: 13,
    attackBonus: 4,
    savingThrowBonus: 4,
    movementTiles: 1,
    breachDamage: 3,
    attackDamage: 4,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 7,
    damageShieldHp: 10,
    reflectsDamagePercent: 25,
    abilities: [],
    assetKey: "enemy-aegis-bearer",
    role: "minion",
    loreText: "The Aegis Bearer's shield doesn't just stop a blow. It sends a share of it right back where it came from.",
  },

  // Explosive family: detonates in an AoE burst on death.
  "cinder-wretch": {
    id: "cinder-wretch",
    name: "Cinder Wretch",
    maxHealth: 8,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    onDeathExplode: { damage: 5, radiusTiles: 1 },
    abilities: [],
    assetKey: "enemy-cinder-wretch",
    role: "minion",
    loreText: "Killing a Cinder Wretch is the easy part. Being anywhere near it when it happens is the actual problem.",
  },
  "bomber-beetle": {
    id: "bomber-beetle",
    name: "Bomber Beetle",
    maxHealth: 10,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    onDeathExplode: { damage: 8, radiusTiles: 2 },
    abilities: [],
    assetKey: "enemy-bomber-beetle",
    role: "minion",
    loreText: "A Bomber Beetle's last act is always its loudest.",
  },

  // Gold Thief family: a landed hit also steals gold from the party.
  pilferer: {
    id: "pilferer",
    name: "Pilferer",
    maxHealth: 8,
    armorClass: 12,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 3,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    goldTheftAmount: 8,
    abilities: [],
    assetKey: "enemy-pilferer",
    role: "minion",
    loreText: "A Pilferer's hit barely hurts. Its exit strategy is the actual attack.",
  },
  "coin-wraith": {
    id: "coin-wraith",
    name: "Coin Wraith",
    maxHealth: 9,
    armorClass: 13,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    goldTheftAmount: 14,
    abilities: [],
    assetKey: "enemy-coin-wraith",
    role: "minion",
    loreText: "The Coin Wraith was drawn to the stronghold's vault long before it was ever drawn to its heroes.",
  },

  // Teleporter family: periodically jumps straight toward the exit.
  "blink-stalker": {
    id: "blink-stalker",
    name: "Blink Stalker",
    maxHealth: 9,
    armorClass: 12,
    attackBonus: 4,
    savingThrowBonus: 4,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 4,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    teleportsEveryNTurns: 3,
    abilities: [],
    assetKey: "enemy-blink-stalker",
    role: "minion",
    loreText: "A Blink Stalker treats the distance between it and the stronghold as more of a suggestion than a rule.",
  },
  "rift-walker": {
    id: "rift-walker",
    name: "Rift Walker",
    maxHealth: 11,
    armorClass: 13,
    attackBonus: 5,
    savingThrowBonus: 4,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 4,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 7,
    teleportsEveryNTurns: 2,
    abilities: [],
    assetKey: "enemy-rift-walker",
    role: "minion",
    loreText: "The Rift Walker doesn't walk so much as it periodically reconsiders where it's standing.",
  },

  // Mimic family: disguised as scenery/treasure until a hero gets adjacent —
  // a brand-new "disguise" mechanic, deliberately separate from stealth.
  "mimic-chest": {
    id: "mimic-chest",
    name: "Mimic Chest",
    maxHealth: 14,
    armorClass: 13,
    attackBonus: 5,
    savingThrowBonus: 3,
    movementTiles: 1,
    breachDamage: 3,
    attackDamage: 5,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 8,
    mimicDisguise: true,
    abilities: [],
    assetKey: "enemy-mimic-chest",
    role: "minion",
    loreText: "It looked exactly like every other chest in the room. That was rather the point.",
  },
  "ambush-coffer": {
    id: "ambush-coffer",
    name: "Ambush Coffer",
    maxHealth: 16,
    armorClass: 14,
    attackBonus: 5,
    savingThrowBonus: 4,
    movementTiles: 1,
    breachDamage: 3,
    attackDamage: 6,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 9,
    mimicDisguise: true,
    abilities: [],
    assetKey: "enemy-ambush-coffer",
    role: "minion",
    loreText: "An Ambush Coffer only ever has one thing inside it, and it is not treasure.",
  },

  // Healer family: heals nearby wounded allies each phase. Plague Warden is
  // the Healer/Debuffer hybrid Kevin asked for ("the healer and debuffer
  // could be combined") — one roster entry, not a separate family.
  "battle-medic": {
    id: "battle-medic",
    name: "Battle Medic",
    maxHealth: 10,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    healAura: { radiusTiles: 2, healAmount: 3 },
    abilities: [],
    assetKey: "enemy-battle-medic",
    role: "minion",
    loreText: "A Battle Medic never throws the hardest punch on the field. It just makes sure every other punch keeps coming.",
  },
  "plague-warden": {
    id: "plague-warden",
    name: "Plague Warden",
    maxHealth: 12,
    armorClass: 11,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 7,
    healAura: { radiusTiles: 2, healAmount: 2 },
    inflictsStatusOnHit: { id: "poisoned", durationTurns: 3 },
    abilities: [],
    assetKey: "enemy-plague-warden",
    role: "minion",
    loreText: "The Plague Warden mends its allies with the same touch it uses to poison you — it draws no distinction between the two.",
  },

  // Anti-caster: no suppression system of its own — just a Silence-style
  // debuff on a landed hit, reusing the new hero-status system directly.
  hexbinder: {
    id: "hexbinder",
    name: "Hexbinder",
    maxHealth: 9,
    armorClass: 12,
    attackBonus: 4,
    savingThrowBonus: 4,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 3,
    attackRangeTiles: 2,
    movementType: "ground",
    rewardGold: 7,
    inflictsStatusOnHit: { id: "silenced", durationTurns: 2 },
    abilities: [],
    assetKey: "enemy-hexbinder",
    role: "minion",
    loreText: "A Hexbinder's hex isn't the wound. It's the silence that follows, right when you needed to shout something back.",
  },

  // Swarm family: verified against the real SRD 5.2.1/2024 "Swarm" trait
  // (see Enemy.isSwarm's own comment and DECISIONS D-112) rather than
  // invented loosely, per Kevin's own explicit ask for this one archetype.
  "rat-swarm": {
    id: "rat-swarm",
    name: "Rat Swarm",
    maxHealth: 12,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 2,
    movementTiles: 2,
    breachDamage: 2,
    attackDamage: 4,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    swarm: true,
    damageResistances: ["bludgeoning", "piercing", "slashing"],
    abilities: [],
    assetKey: "enemy-rat-swarm",
    role: "minion",
    loreText: "You cannot fight the Rat Swarm the way you'd fight one rat. There is no single throat to go for.",
  },
  "locust-swarm": {
    id: "locust-swarm",
    name: "Locust Swarm",
    maxHealth: 16,
    armorClass: 10,
    attackBonus: 3,
    savingThrowBonus: 2,
    movementTiles: 3,
    breachDamage: 3,
    attackDamage: 5,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    swarm: true,
    damageResistances: ["bludgeoning", "piercing", "slashing"],
    abilities: [],
    assetKey: "enemy-locust-swarm",
    role: "minion",
    loreText: "A Locust Swarm doesn't occupy a tile so much as it occupies the same tile as whatever else is unlucky enough to be standing there.",
  },

  // Multi-Phase Boss: changes its active mechanic set once bloodied — a
  // per-INSTANCE override (Enemy.activeDef), never a mutation of the shared
  // definition every Sundered King instance references.
  "sundered-king": {
    id: "sundered-king",
    name: "Sundered King",
    maxHealth: 60,
    armorClass: 14,
    attackBonus: 6,
    savingThrowBonus: 5,
    movementTiles: 2,
    breachDamage: 8,
    attackDamage: 5,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 35,
    phaseChange: { hpPercent: 50, overrides: { attackDamage: 9, attackBonus: 8, aoeAttack: true } },
    abilities: [],
    assetKey: "enemy-sundered-king",
    role: "boss",
    loreText: "The Sundered King doesn't fight harder when he's winning. He waits until he's losing, and THEN he stops holding back.",
  },

  // ===== Phase 25 (D-116): Saboteur archetype (trapSense) =====
  // A fast, fragile scout that clears a trap in its path instead of ever
  // fighting or advancing through it — the counter to the player's own trap
  // investment, the same way a siege enemy counters walls.
  saboteur: {
    id: "saboteur",
    name: "Saboteur",
    maxHealth: 7,
    armorClass: 11,
    attackBonus: 3,
    savingThrowBonus: 3,
    movementTiles: 3,
    breachDamage: 2,
    attackDamage: 2,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 5,
    trapSense: { rangeTiles: 1 },
    abilities: [],
    assetKey: "enemy-saboteur",
    role: "minion",
    loreText: "A Saboteur has never once stepped on a trap it didn't mean to. It has stepped on plenty it meant to disarm first.",
  },
  // WARREN STALKER: a tougher trapSense minion with a longer sense range —
  // it clears a trap from one tile further out than a Saboteur can.
  "warren-stalker": {
    id: "warren-stalker",
    name: "Warren Stalker",
    maxHealth: 11,
    armorClass: 12,
    attackBonus: 4,
    savingThrowBonus: 3,
    movementTiles: 2,
    breachDamage: 3,
    attackDamage: 3,
    attackRangeTiles: 1,
    movementType: "ground",
    rewardGold: 6,
    trapSense: { rangeTiles: 2 },
    abilities: [],
    assetKey: "enemy-warren-stalker",
    role: "minion",
    loreText: "The Warren Stalker smells a snare before it ever sees one, and it has never once been in a hurry to find out the hard way.",
  },
};

/** Look up a definition, throwing on an unknown id so typos fail loudly. */
export function getEnemyDefinition(id: string): EnemyDefinition {
  const def = ENEMY_DEFINITIONS[id];
  if (!def) throw new Error(`Unknown enemy id "${id}".`);
  return def;
}

/** A short display colour per enemy id (placeholder art). */
export const ENEMY_COLORS: Record<string, number> = {
  grunt: 0xd05a5a,
  runner: 0xe0a24c,
  wisp: 0x9a7ad0,
  // Phase 7 roster (D-050): original placeholder colours, chosen to read
  // distinctly from each other and from the heroes.
  brute: 0x8a4a4a,
  swarmling: 0xd0a0c0,
  warden: 0x7a8a9a,
  razorwing: 0xb060c0,
  "basalt-colossus": 0x5a4a6a,
  // Phase 11.6 roster (D-079): original placeholder colours. The two bosses
  // are deliberately warm/cool-coded to their element (fire/water), since
  // Phase 11.7's matching terrain types will use the same theming.
  hexer: 0x6a4ad0,
  ravager: 0xa03a3a,
  cinderlord: 0xff6a2a,
  tidelord: 0x2a8ab0,
  // Phase 13.10 roster (D-095): original placeholder colours. Marauder/
  // Blightcaller/Blightmother lean toward a sickly green-yellow ("blight")
  // family, distinct from every earlier enemy's palette; Gravemaw stays in
  // the same bone/stone family as basalt-colossus (its miniboss sibling).
  marauder: 0xc07030,
  blightcaller: 0x8a9a3a,
  gravemaw: 0x6a6258,
  blightmother: 0x5a7a2a,
  // Phase 20 roster (D-111): original placeholder colours, grouped by
  // mechanic family so the board reads consistently even before a player
  // learns each individual name — siege (dull iron/rust), stealth (near-
  // black violet), runners (bright yellow-green), tank (steel blue-grey),
  // treasure (gold/amber), reinforcements (bone/purple), captains (deep
  // banner red), breath (fire orange / ice blue), legendaries (saturated,
  // more intense versions of their nearest boss-tier cousin).
  siegebreaker: 0x8a7a5a,
  "battering-brute": 0x6a5a3a,
  shadowfang: 0x2a1a3a,
  nightblade: 0x1a0e2a,
  sprinter: 0xc0e070,
  "bolt-runner": 0x9ad04a,
  ironhide: 0x6a7a8a,
  hoarder: 0xd0a030,
  "gilded-carrier": 0xe0c050,
  "cultist-caller": 0x7a4a8a,
  "bone-summoner": 0x8a6a9a,
  warcaptain: 0x9a2a3a,
  battlepriest: 0xb03a4a,
  bannerbearer: 0xc04a5a,
  "cave-drake": 0xe07a2a,
  "frost-warden": 0x4ab0d0,
  juggernaut: 0x4a4a5a,
  "warlord-korrath": 0x8a1a2a,
  "the-devourer": 0x5a2a6a,
  "ashen-sovereign": 0xff5a10,
  "the-hollow-empress": 0x3a1a5a,
  // Phase 21 roster (D-112): original placeholder colours, grouped by
  // mechanic family — enrage (angry red), lifedrink (deep crimson), splitter
  // family (sickly slime green), shielded (steel/bright teal for the
  // reflect combo), explosive (hot orange-red), gold thief (coin gold/
  // spectral purple), teleporter (violet), mimic (wood-brown treasure
  // colours), healer family (soft green/sickly olive for the hybrid),
  // anti-caster (deep indigo), swarm (dull brown/dull green), the
  // Multi-Phase Boss (regal purple-red).
  "frenzied-cultist": 0xc03a2a,
  "bloodrage-warlord": 0x8a1a1a,
  bloodwisp: 0x8a1a3a,
  "crimson-leech": 0x6a0a2a,
  "living-splinter": 0x5a8a4a,
  "ooze-splitter": 0x4a9a3a,
  "fungal-splitter": 0x3a7a2a,
  "the-husk": 0x6a6a5a,
  "warded-sentinel": 0x4a8a9a,
  "aegis-bearer": 0x2ab0c0,
  "cinder-wretch": 0xd0502a,
  "bomber-beetle": 0xe06a2a,
  pilferer: 0xd0b040,
  "coin-wraith": 0x8a6ab0,
  "blink-stalker": 0x8a3ad0,
  "rift-walker": 0xa04ae0,
  "mimic-chest": 0x9a7a3a,
  "ambush-coffer": 0xb08a4a,
  "battle-medic": 0x5ab070,
  "plague-warden": 0x7a8a3a,
  hexbinder: 0x3a2a6a,
  "rat-swarm": 0x7a6a4a,
  "locust-swarm": 0x6a7a3a,
  "sundered-king": 0x7a1a4a,
  // Phase 25 roster (D-116): the Saboteur archetype — a muted, sneaky
  // brown-green pair, distinct from every existing family.
  saboteur: 0x6a7a4a,
  "warren-stalker": 0x4a5a3a,
};

/** Re-export so callers can type positions without reaching into GridSystem. */
export type { GridPosition };
