import type { GridPosition } from "../systems/GridSystem";
import type { StatusEffectId } from "./statusEffects";

/**
 * Structure definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 5 introduces the two buildable structures the phase boundary allows:
 * exactly ONE wall and ONE damaging trap ("no large item catalogue or obstacle
 * upgrade tree"). They are defined here as data so later phases can add more
 * structures without touching the BuildSystem rules or the scene.
 *
 * Phase 7 fills in the rest of the phase spec's structure list — "walls, gates,
 * platforms, perches, three traps" — by adding one more structure KIND
 * ("platform") and two new flags on the existing kinds rather than growing the
 * kind enum for every new idea:
 *   - A GATE is just a "wall" definition with `blocksHeroes: false`: it still
 *     blocks enemy routing and still obeys the "never seal the only path" rule
 *     (BuildSystem treats every "wall"-kind structure the same for routing), but
 *     heroes may walk through it. That is the one real difference between a
 *     Barricade and a Gate.
 *   - A melee platform / ranged perch is the new "platform" kind: it blocks
 *     nothing, but grants a small combat bonus to whichever hero is STANDING
 *     on it, filtered to melee or ranged heroes by `heroBonus.appliesTo`.
 *   - The third trap (Tangle Root) reuses the existing "trap" kind and adds
 *     `appliesStatus`, a status effect (data/statusEffects.ts) applied to an
 *     enemy that survives the trap's damage — the "slowing terrain" idea from
 *     the Source of Truth's structure list.
 *
 * All content here is ORIGINAL to this project — names, costs, and values are
 * invented, not copied or adapted from any published source. See CONTENT_SOURCES.
 *
 * Phase 13.1 (D-086): real dice replace deterministic combat, but every trap
 * still ALWAYS hits — D-039's "traps trigger every time an enemy enters"
 * stays true; a floor hazard doesn't roll to see if you noticed it. The old
 * per-trap `ignoreDefense` flag (which varied) is gone: `WaveSystem` builds
 * every trap's `AttackProfile` with `autoHit: true` unconditionally now that
 * "ignores defense" and "always hits" mean the same thing for a trap.
 *
 * Three kinds of structure, distinguished by how units interact with them:
 *   - "wall"     : a hard blocker for ENEMIES. Enemies route AROUND it (never
 *                  through it), and a wall may never be placed if it would seal
 *                  off every route from a spawn to an exit (BuildSystem enforces
 *                  this). Whether it also blocks HEROES is `blocksHeroes`
 *                  (default true — a Barricade; a Gate sets it false).
 *   - "trap"     : a floor hazard. It does NOT block movement; instead, an
 *                  enemy that ENTERS the trap's tile takes `damage` (resolved
 *                  through the deterministic CombatSystem, so trap damage is
 *                  testable) and, if it survives, any `appliesStatus` effect.
 *   - "platform" : blocks nothing. A hero standing on it gets `heroBonus`
 *                  applied to its basic attack (BuildSystem.platformBonusFor).
 *
 * Phase 20 (D-111): walls gain an optional `maxHp` — a SIEGE enemy
 * (`EnemyDefinition.siegeDamageMultiplier`) can now actually destroy a
 * Barricade/Gate/Spectral Wall it finds within its own attack range
 * (`BuildSystem.damageStructure`), rather than every wall being permanent
 * once placed. Traps and platforms stay indestructible (omit `maxHp`) —
 * nothing in this pass gives any enemy a reason to attack one.
 *
 * Phase 24 (D-115): "more buildings and traps" adds five entries, each
 * reusing an existing field rather than growing the shape further, plus two
 * small extensions:
 *   - Two more WALLS at the opposite ends of Barricade's cost/`maxHp` curve
 *     — Palisade (cheap, fragile) and Bulwark (pricier, tough) — turning a
 *     single wall option into a real low/mid/high durability choice.
 *   - A WATCHTOWER platform: `PlatformAudience` gains `"any"`, so a
 *     platform's bonus can apply regardless of melee/ranged, filling the
 *     gap between the two existing specialist platforms with a generalist
 *     one (see `BuildSystem.platformBonusFor`).
 *   - Two more TRAPS — Frost Trap (reuses `appliesStatus`, "restrained") and
 *     Bear Trap, which introduces the one new field below.
 *   - `singleUse` (trap only): true means the trap is spent and removed the
 *     FIRST time it triggers, unlike every trap before it (which persists
 *     indefinitely). A genuine new risk/reward point on the trap curve — one
 *     big hit instead of a smaller sustained one (`BuildSystem
 *     .trapIsSingleUseAt`, consumed by `BattleScene`).
 *
 * Phase 25 (D-116): "cheap and/or expensive versions of different traps and
 * buildings/walls" — ten new entries, EVERY ONE bracketing an existing item's
 * cost/effect on the cheap or expensive end, exactly like Palisade/Bulwark
 * already bracket Barricade. No new fields at all this pass — pure content:
 *   - GATE gains its own low/high bracket: Wicket Gate (cheap, fragile) and
 *     Portcullis (pricier, tough), mirroring the wall curve.
 *   - The GROUND trap curve gains Snare Wire (cheap, weak) below Tangle
 *     Root/Spike Trap/Frost Trap/Bear Trap and Mangler Trap (expensive,
 *     persistent — deliberately NOT `singleUse`, so it is a distinct choice
 *     from Bear Trap's one-big-hit-then-gone niche) above them.
 *   - The FLYING trap curve, previously just Sky Snare alone, gains Net
 *     Snare (cheap) and Storm Lance (expensive) brackets — this also closes
 *     KNOWN_ISSUES' long-deferred "no anti-air trap tier" item.
 *   - Both platform audiences gain a cheap/expensive bracket: Sparring Post/
 *     War Dais (melee, around Melee Platform) and Low Perch/Sky Bastion
 *     (ranged, around Ranged Perch). Low Perch deliberately trades Ranged
 *     Perch's RANGE bonus for a smaller DAMAGE bonus instead of just being a
 *     strictly weaker copy — Sky Bastion (expensive) is the one structure in
 *     the roster that grants both bonus types at once.
 */

export type StructureKind = "wall" | "trap" | "platform";

/**
 * Which enemies a trap can affect, by movement type (Phase 7, D-049). A floor
 * hazard like spikes only threatens things on the ground; an anti-air hazard
 * only catches flyers. "any" (the default) hits everything, so existing traps
 * behave unchanged unless a definition opts into a filter.
 */
export type TrapTarget = "ground" | "flying" | "any";

/**
 * Which hero category a platform's bonus applies to. Phase 24 (D-115):
 * `"any"` (the Watchtower) applies regardless of melee/ranged — see
 * `BuildSystem.platformBonusFor`.
 */
export type PlatformAudience = "melee" | "ranged" | "any";

export interface StructureDefinition {
  id: string;
  name: string;
  kind: StructureKind;
  /** Gold cost to build. Refunded in full if the structure is removed. */
  cost: number;
  /** A short player-facing line shown while this item is selected in the shop. */
  description: string;
  /** Trap only: damage dealt to an enemy that enters the tile. */
  damage?: number;
  /**
   * Trap only (D-049): which movement types this trap affects. Omitted = "any".
   * A floor trap should be "ground"; an anti-air hazard should be "flying".
   */
  targets?: TrapTarget;
  /** Trap only (Phase 7): a status effect applied if the enemy survives the hit. */
  appliesStatus?: { statusId: StatusEffectId; durationTurns: number };
  /**
   * Wall only (Phase 7). Default true (a Barricade). A Gate sets this false:
   * it still blocks enemy routing like any wall, but heroes may pass through.
   */
  blocksHeroes?: boolean;
  /** Platform only (Phase 7): the basic-attack bonus for a hero standing here. */
  heroBonus?: {
    appliesTo: PlatformAudience;
    attackDamage?: number;
    attackRangeTiles?: number;
  };
  /** Rendering hint (used later for real art); a colour is used for now. */
  assetKey: string;
  /**
   * Phase 20 (D-111): wall-kind only. When set, a siege enemy can destroy
   * this structure by dealing this much damage to it (`BuildSystem
   * .damageStructure`). Absent (traps, platforms, and any wall that omits
   * it) means indestructible — unchanged from every prior phase.
   */
  maxHp?: number;
  /**
   * Phase 24 (D-115): trap only. True means this trap is consumed and
   * removed the first time it triggers (a Bear Trap) — every trap that
   * omits this (the vast majority) persists and keeps triggering forever,
   * unchanged from every prior phase.
   */
  singleUse?: boolean;
}

export const STRUCTURE_DEFINITIONS: Record<string, StructureDefinition> = {
  barricade: {
    id: "barricade",
    name: "Barricade",
    kind: "wall",
    // A cheap, reusable blocker: the core route-manipulation tool. It cannot be
    // placed if it would leave a spawn with no path to an exit.
    cost: 5,
    description: "Blocks enemies (and heroes). Cannot seal the only path.",
    assetKey: "structure-barricade",
    maxHp: 10,
  },
  // The GATE (Phase 7): the same routing rule as a Barricade — enemies never
  // pass through it, and it can never seal the only route — but `blocksHeroes:
  // false` lets the party walk through their own gate freely. All ORIGINAL.
  gate: {
    id: "gate",
    name: "Gate",
    kind: "wall",
    cost: 6,
    description: "Blocks enemies only — heroes may walk straight through.",
    blocksHeroes: false,
    assetKey: "structure-gate",
    maxHp: 8,
  },
  "spike-trap": {
    id: "spike-trap",
    name: "Spike Trap",
    kind: "trap",
    // Pricier than a wall: it does not reshape the route, but it punishes every
    // enemy that walks over it. Persistent in the MVP (triggers each time an
    // enemy enters it); a charges/upgrade model is deferred past the boundary.
    cost: 8,
    description: "Damages any ground enemy that steps on it.",
    damage: 3,
    // Spikes sit on the floor: they threaten ground units, not flyers (D-049).
    targets: "ground",
    assetKey: "structure-spike-trap",
  },
  "sky-snare": {
    id: "sky-snare",
    name: "Sky Snare",
    kind: "trap",
    // The counter to flyers (KI-022): a floor-anchored hazard that lashes up at
    // anything crossing OVERHEAD, and does nothing to ground units. Because a
    // flyer can't be re-routed by walls, this is the tool that lets the player
    // punish a flight lane.
    // All ORIGINAL content — name, cost, and values invented for this project.
    cost: 7,
    description: "Damages any flying enemy that crosses it.",
    damage: 4,
    targets: "flying",
    assetKey: "structure-sky-snare",
  },
  // TANGLE ROOT (Phase 7): the third trap — "slowing terrain" from the Source
  // of Truth's structure list. A light hit plus a lingering slow: less burst
  // than a Spike Trap, but it buys the party time to catch up to whatever
  // walked through it. Ground only. All ORIGINAL content.
  "tangle-root": {
    id: "tangle-root",
    name: "Tangle Root",
    kind: "trap",
    cost: 6,
    description: "Lightly hurts and slows a ground enemy that steps on it.",
    damage: 1,
    targets: "ground",
    appliesStatus: { statusId: "slowed", durationTurns: 2 },
    assetKey: "structure-tangle-root",
  },
  // MELEE PLATFORM (Phase 7): a hero with attackRangeTiles 1 (a melee hero)
  // standing on it hits harder. Does not block anything. All ORIGINAL content.
  "melee-platform": {
    id: "melee-platform",
    name: "Melee Platform",
    kind: "platform",
    cost: 9,
    description: "A melee hero standing here deals +2 basic-attack damage.",
    heroBonus: { appliesTo: "melee", attackDamage: 2 },
    assetKey: "structure-melee-platform",
  },
  // RANGED PERCH (Phase 7): a hero with attackRangeTiles > 1 (a ranged hero)
  // standing on it reaches one tile further. Does not block anything.
  "ranged-perch": {
    id: "ranged-perch",
    name: "Ranged Perch",
    kind: "platform",
    cost: 9,
    description: "A ranged hero standing here gets +1 basic-attack range.",
    heroBonus: { appliesTo: "ranged", attackRangeTiles: 1 },
    assetKey: "structure-ranged-perch",
  },
  // Phase 16 (D-106, "make all spells usable"): two structures a SPELL places
  // (never bought from the shop — absent from SHOP_ORDER below, `cost: 0`
  // since `BuildSystem.place` never touches gold anyway), tracked with a
  // duration and auto-removed by `BattleScene.tickTemporaryStructures` — the
  // stand-in for every SRD terrain-shaping spell (Wall of Stone, Web,
  // Spike Growth, etc.).
  "spectral-wall": {
    id: "spectral-wall",
    name: "Spectral Wall",
    kind: "wall",
    cost: 0,
    description: "A conjured barrier. Blocks enemies (and heroes). Cannot seal the only path.",
    assetKey: "structure-spectral-wall",
    maxHp: 6,
  },
  "web-patch": {
    id: "web-patch",
    name: "Web Patch",
    kind: "trap",
    cost: 0,
    description: "Lightly hurts and slows a ground enemy that steps on it.",
    damage: 1,
    targets: "ground",
    appliesStatus: { statusId: "restrained", durationTurns: 2 },
    assetKey: "structure-web-patch",
  },
  // Phase 24 (D-115): PALISADE — the cheap, fragile end of the wall curve.
  // Barricade sits in the middle; Bulwark (below) anchors the tough end.
  // All ORIGINAL content.
  palisade: {
    id: "palisade",
    name: "Palisade",
    kind: "wall",
    cost: 3,
    description: "A quick stake wall — cheap, but knocked down easily.",
    assetKey: "structure-palisade",
    maxHp: 4,
  },
  // BULWARK: the tough, expensive end of the wall curve — a real answer to
  // a Phase 20 siege enemy that a plain Barricade can't stand up to for
  // long. All ORIGINAL content.
  bulwark: {
    id: "bulwark",
    name: "Bulwark",
    kind: "wall",
    cost: 14,
    description: "A fortified wall that shrugs off far more punishment.",
    assetKey: "structure-bulwark",
    maxHp: 25,
  },
  // WATCHTOWER: the first "any" audience platform — a generalist between
  // the two existing specialists (Melee Platform, Ranged Perch). All
  // ORIGINAL content.
  watchtower: {
    id: "watchtower",
    name: "Watchtower",
    kind: "platform",
    cost: 11,
    description: "Any hero standing here — melee or ranged — deals +1 basic-attack damage.",
    heroBonus: { appliesTo: "any", attackDamage: 1 },
    assetKey: "structure-watchtower",
  },
  // FROST TRAP: a buildable ground trap reusing "restrained" (previously
  // only ever spell-placed via Web Patch) — a brief hard lockdown instead of
  // Tangle Root's softer slow. All ORIGINAL content.
  "frost-trap": {
    id: "frost-trap",
    name: "Frost Trap",
    kind: "trap",
    cost: 9,
    description: "Lightly hurts and freezes a ground enemy in place.",
    damage: 1,
    targets: "ground",
    // durationTurns: 2, matching Web Patch's own precedent — a status
    // applied this phase is immediately ticked down once before the report
    // returns (see WaveSystem.tickEnemyPhase), so duration 1 would expire
    // before ever blocking a future turn. 2 is the actual "locks down the
    // enemy's next phase" duration.
    appliesStatus: { statusId: "restrained", durationTurns: 2 },
    assetKey: "structure-frost-trap",
  },
  // BEAR TRAP: the first SINGLE-USE trap — a heavy one-time bite instead of
  // a smaller sustained tick, a genuine new point on the trap curve. All
  // ORIGINAL content.
  "bear-trap": {
    id: "bear-trap",
    name: "Bear Trap",
    kind: "trap",
    cost: 10,
    description: "A vicious trap — a heavy hit, but spent after one bite.",
    damage: 6,
    targets: "ground",
    singleUse: true,
    assetKey: "structure-bear-trap",
  },

  // ----- Phase 25 (D-116): cheap/expensive brackets ---------------------

  // WICKET GATE: the cheap, fragile end of the gate curve — Gate is the
  // middle tier, Portcullis (below) the tough end. All ORIGINAL content.
  "wicket-gate": {
    id: "wicket-gate",
    name: "Wicket Gate",
    kind: "wall",
    cost: 4,
    description: "A flimsy hinged gate. Blocks enemies only — knocked down easily.",
    blocksHeroes: false,
    assetKey: "structure-wicket-gate",
    maxHp: 5,
  },
  // PORTCULLIS: the tough, expensive end of the gate curve.
  portcullis: {
    id: "portcullis",
    name: "Portcullis",
    kind: "wall",
    cost: 12,
    description: "A fortified gate. Blocks enemies only — shrugs off far more punishment.",
    blocksHeroes: false,
    assetKey: "structure-portcullis",
    maxHp: 16,
  },
  // SNARE WIRE: the cheap, weak end of the ground-trap-damage curve, below
  // Tangle Root/Spike Trap/Frost Trap/Bear Trap.
  "snare-wire": {
    id: "snare-wire",
    name: "Snare Wire",
    kind: "trap",
    cost: 4,
    description: "A crude tripwire — lightly damages any ground enemy that steps on it.",
    damage: 1,
    targets: "ground",
    assetKey: "structure-snare-wire",
  },
  // MANGLER TRAP: the expensive, persistent end of the ground-trap-damage
  // curve — deliberately NOT singleUse, a distinct niche from Bear Trap's
  // one-big-hit-then-gone tradeoff (a smaller sustained hit forever vs. one
  // huge hit once).
  "mangler-trap": {
    id: "mangler-trap",
    name: "Mangler Trap",
    kind: "trap",
    cost: 13,
    description: "A brutal, reusable trap that badly wounds any ground enemy that steps on it.",
    damage: 5,
    targets: "ground",
    assetKey: "structure-mangler-trap",
  },
  // NET SNARE: the cheap end of the flying-trap curve — Sky Snare was
  // previously the only anti-air option at all.
  "net-snare": {
    id: "net-snare",
    name: "Net Snare",
    kind: "trap",
    cost: 4,
    description: "A crude tangle of netting — lightly damages any flying enemy that crosses it.",
    damage: 2,
    targets: "flying",
    assetKey: "structure-net-snare",
  },
  // STORM LANCE: the expensive end of the flying-trap curve.
  "storm-lance": {
    id: "storm-lance",
    name: "Storm Lance",
    kind: "trap",
    cost: 13,
    description: "A crackling anti-air ward that badly wounds any flying enemy that crosses it.",
    damage: 7,
    targets: "flying",
    assetKey: "structure-storm-lance",
  },
  // SPARRING POST: the cheap end of the melee-platform curve, below Melee
  // Platform.
  "sparring-post": {
    id: "sparring-post",
    name: "Sparring Post",
    kind: "platform",
    cost: 5,
    description: "A melee hero standing here deals +1 basic-attack damage.",
    heroBonus: { appliesTo: "melee", attackDamage: 1 },
    assetKey: "structure-sparring-post",
  },
  // WAR DAIS: the expensive end of the melee-platform curve.
  "war-dais": {
    id: "war-dais",
    name: "War Dais",
    kind: "platform",
    cost: 14,
    description: "A melee hero standing here deals +4 basic-attack damage.",
    heroBonus: { appliesTo: "melee", attackDamage: 4 },
    assetKey: "structure-war-dais",
  },
  // LOW PERCH: the cheap end of the ranged-platform curve. Deliberately
  // trades Ranged Perch's RANGE bonus for a smaller DAMAGE bonus instead of
  // being a strictly weaker copy of it — a genuinely different choice.
  "low-perch": {
    id: "low-perch",
    name: "Low Perch",
    kind: "platform",
    cost: 5,
    description: "A ranged hero standing here deals +1 basic-attack damage.",
    heroBonus: { appliesTo: "ranged", attackDamage: 1 },
    assetKey: "structure-low-perch",
  },
  // SKY BASTION: the expensive end of the ranged-platform curve — the one
  // structure in the roster that grants both a damage AND a range bonus.
  "sky-bastion": {
    id: "sky-bastion",
    name: "Sky Bastion",
    kind: "platform",
    cost: 14,
    description: "A ranged hero standing here deals +1 basic-attack damage and gets +1 range.",
    heroBonus: { appliesTo: "ranged", attackDamage: 1, attackRangeTiles: 1 },
    assetKey: "structure-sky-bastion",
  },
};

/** Look up a definition, throwing on an unknown id so typos fail loudly. */
export function getStructureDefinition(id: string): StructureDefinition {
  const def = STRUCTURE_DEFINITIONS[id];
  if (!def) throw new Error(`Unknown structure id "${id}".`);
  return def;
}

/** The buildable structures in shop order (for the shop UI). */
export const SHOP_ORDER: string[] = [
  "barricade",
  "gate",
  "palisade",
  "bulwark",
  "wicket-gate",
  "portcullis",
  "spike-trap",
  "sky-snare",
  "tangle-root",
  "frost-trap",
  "bear-trap",
  "snare-wire",
  "mangler-trap",
  "net-snare",
  "storm-lance",
  "melee-platform",
  "ranged-perch",
  "watchtower",
  "sparring-post",
  "war-dais",
  "low-perch",
  "sky-bastion",
];

/** A short display colour per structure id (placeholder art; original, no IP). */
export const STRUCTURE_COLORS: Record<string, number> = {
  barricade: 0x8a7a5a,
  gate: 0xa08a6a,
  palisade: 0x9a8a6a,
  bulwark: 0x6a5a3a,
  "spike-trap": 0xc25a7a,
  "sky-snare": 0x5ab0a0,
  "tangle-root": 0x6a9a5a,
  "frost-trap": 0x5a90c2,
  "bear-trap": 0x8a2a2a,
  "melee-platform": 0x9a7a4a,
  "ranged-perch": 0x4a7a9a,
  watchtower: 0x7a6a9a,
  // Phase 25 (D-116): original placeholder colours, each a lighter (cheap)
  // or deeper (expensive) shade of its bracketed structure's own colour.
  "wicket-gate": 0xb8a488,
  portcullis: 0x7a6a4a,
  "snare-wire": 0xd08aa0,
  "mangler-trap": 0x8a1a3a,
  "net-snare": 0x8ad0c0,
  "storm-lance": 0x2a7a90,
  "sparring-post": 0xc0a070,
  "war-dais": 0x7a5a2a,
  "low-perch": 0x7aa0c0,
  "sky-bastion": 0x2a5a7a,
};

/** Re-export so callers can type positions without reaching into GridSystem. */
export type { GridPosition };
