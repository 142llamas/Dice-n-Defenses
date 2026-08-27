import { ABILITY_SCORE_IDS, type AbilityScoreId } from "../data/abilityScores";
import { getClassDefinition } from "../data/classes";
import { subclassesForClass } from "../data/subclasses";
import { getSpell } from "../data/spells";
import { asiFeatureGrantedAtLevel, subclassGrantedAtLevel } from "./CharacterSystem";
import { heroDefinitionFromBuild, type CharacterBuild } from "./CharacterBuildSystem";
import {
  eligibleCantripPool,
  eligibleLeveledSpellPool,
  maxCastableSpellLevel,
  spellSwapStepsForClass,
  type SpellSwapStepKind,
} from "./SpellPreparationSystem";
import {
  Hero,
  MAX_CLASS_LEVEL,
  WARLOCK_MYSTIC_ARCANUM_LEVELS,
  WIZARD_SIGNATURE_SPELLS_LEVEL,
  WIZARD_SPELL_MASTERY_LEVEL,
  type MagicInitiateListId,
} from "../entities/Hero";

/**
 * LevelUpPlanSystem — D-133's Character Creation level-by-level planner.
 * Pure logic only, no Phaser. This is the ONE place a hero's future
 * ASI/subclass/spell-pick choices are resolved, whether that's:
 *
 * - `BattleScene.fastForwardHeroToLevel` (D-129's pre-battle Starting Level
 *   fast-forward),
 * - `BattleScene.applyClassLevelUps`'s "auto" branch (a real in-battle
 *   level-up resolved silently, because this hero's plan `mode` says to and
 *   an explicit plan entry covers it), or
 * - `CharacterCreationScene`'s planner UI itself, which needs to simulate a
 *   hero forward through a partial plan to show real eligible feats/spells
 *   at each future choice point (`simulateHeroForPlanning`).
 *
 * D-16x: a hero with no plan (`plan` undefined, or a level with no entry in
 * it) is left UNRESOLVED — this module never invents a choice on the
 * player's behalf. Every resolver reports whether it actually applied an
 * explicit plan entry; the caller is responsible for surfacing an
 * unresolved level as a real prompt (`BattleScene.applyClassLevelUps`
 * already does this for the live in-battle path via its existing
 * needsAsi/needsSubclass/needsSpellPick queues; the pre-battle fast-forward
 * path collects `fastForwardHero`'s returned unresolved steps and presents
 * them as the very first popups of the battle, before wave 1).
 */

export type AsiPlanChoice =
  | { path: "ability"; abilityMode: "single"; ability: AbilityScoreId }
  | { path: "ability"; abilityMode: "split"; first: AbilityScoreId; second: AbilityScoreId }
  | { path: "feat"; featId: string; chosenAbility?: AbilityScoreId; magicInitiateList?: MagicInitiateListId };

export type SpellPickPlanChoice =
  | { kind: "mastery"; spellId: string }
  | { kind: "signature"; spellIds: [string, string] }
  | { kind: "arcanum"; tier: number; spellId: string };

/**
 * D-199 (Party Creation Overhaul Plan 6.5): a level-up-triggered "replace
 * exactly one" cantrip/prepared-spell swap — the recurring D-136 mechanic,
 * now plannable ahead of time like ASI/subclass/spellPicks. Deliberately
 * only the level-up trigger; the separate Long-Rest full-relist mechanic
 * stays real-time-only, per Kevin's own explicit narrowing of D-136 (see
 * D-199's writeup).
 */
export interface LevelUpSpellSwapChoice {
  kind: SpellSwapStepKind;
  dropId: string;
  learnId: string;
}

export type LevelUpPlanMode = "auto" | "prompt" | "fresh";

export interface LevelUpPlan {
  /**
   * D-199 (Plan 6.4): vestigial once this plan is saved as a library
   * blueprint — applying a blueprint to a hero always overwrites `mode`
   * with that hero's own per-hero cadence control, never reads this back.
   * Still the live, authoritative field for a hero's OWN in-progress
   * `SlotState.levelUpPlan`/`CharacterBuild.levelUpPlan` (unchanged).
   */
  mode: LevelUpPlanMode;
  /** Only meaningful for a class whose `subclassChoiceLevel` is > 1 — a level-1-choice class picks at Character Creation already. */
  subclassId?: string;
  /** Keyed by the level the ASI/feat choice triggers at. */
  asiChoices: Partial<Record<number, AsiPlanChoice>>;
  /** Keyed by the level the spell-mastery-family pick triggers at (not by tier — Warlock's 4 tiers each land at a distinct level). */
  spellPicks: Partial<Record<number, SpellPickPlanChoice>>;
  /** D-199: keyed by the level a level-up-triggered swap opportunity exists — an array since one level can need both a cantrip AND a prepared swap (e.g. Sorcerer). */
  spellSwaps: Partial<Record<number, LevelUpSpellSwapChoice[]>>;
}

export function emptyLevelUpPlan(mode: LevelUpPlanMode = "fresh"): LevelUpPlan {
  return { mode, asiChoices: {}, spellPicks: {}, spellSwaps: {} };
}

/** D-125's pending spell-mastery-family pick shape, mirrored here (not imported from `BattleScene` — a scene file — to keep this module Phaser-free); structurally identical to `BattleScene`'s own `SpellPickRequest`. */
export interface SpellPickTrigger {
  hero: Hero;
  kind: "mastery" | "signature" | "arcanum";
  tier?: number;
}

export function spellPickTriggerLevel(request: SpellPickTrigger): number | undefined {
  if (request.kind === "mastery") return WIZARD_SPELL_MASTERY_LEVEL;
  if (request.kind === "signature") return WIZARD_SIGNATURE_SPELLS_LEVEL;
  if (request.kind === "arcanum" && request.tier !== undefined) return WARLOCK_MYSTIC_ARCANUM_LEVELS[request.tier];
  return undefined;
}

function isAsiChoiceValid(hero: Hero, choice: AsiPlanChoice): boolean {
  if (choice.path === "feat") return hero.meetsFeatPrerequisites(choice.featId);
  return true;
}

function applyAsiChoice(hero: Hero, choice: AsiPlanChoice): void {
  if (choice.path === "ability") {
    if (choice.abilityMode === "single") {
      hero.improveAbilityScore(choice.ability, 2);
    } else {
      hero.improveAbilityScore(choice.first, 1);
      hero.improveAbilityScore(choice.second, 1);
    }
  } else {
    hero.grantFeat(choice.featId, { chosenAbility: choice.chosenAbility, magicInitiateList: choice.magicInitiateList });
  }
}

/** Resolves this hero's ASI-or-feat choice at `level` from an explicit plan entry. Returns true if applied, false (no mutation) if unresolved. */
export function resolveAsiForLevel(hero: Hero, level: number, plan?: LevelUpPlan): boolean {
  const planned = plan?.asiChoices[level];
  if (planned && isAsiChoiceValid(hero, planned)) {
    applyAsiChoice(hero, planned);
    return true;
  }
  return false;
}

/** Resolves this hero's subclass choice from an explicit plan entry. Returns true if applied or if this class has no modeled subclasses to choose (nothing to ask); false (no mutation) if unresolved. */
export function resolveSubclassForClass(hero: Hero, classId: string, plan?: LevelUpPlan): boolean {
  const options = subclassesForClass(classId);
  if (options.length === 0) return true;
  const wanted = plan?.subclassId;
  if (wanted && options.some((o) => o.id === wanted)) {
    hero.grantSubclass(wanted);
    return true;
  }
  return false;
}

/** Resolves one Wizard/Warlock spell-mastery-family pick from an explicit plan entry. Returns true if applied or not yet eligible (nothing to ask yet); false (no mutation) if unresolved. */
export function resolveSpellPickForRequest(hero: Hero, request: SpellPickTrigger, plan?: LevelUpPlan): boolean {
  const triggerLevel = spellPickTriggerLevel(request);
  const planned = triggerLevel !== undefined ? plan?.spellPicks[triggerLevel] : undefined;

  if (request.kind === "mastery") {
    const eligible = hero.eligibleSpellMasterySpells();
    if (eligible.length === 0) return true;
    if (planned?.kind === "mastery" && eligible.includes(planned.spellId)) {
      hero.chooseSpellMasterySpell(planned.spellId);
      return true;
    }
    return false;
  } else if (request.kind === "signature") {
    const eligible = hero.eligibleSignatureSpells();
    if (eligible.length < 2) return true;
    const plannedIds = planned?.kind === "signature" ? planned.spellIds.filter((id) => eligible.includes(id)) : [];
    if (plannedIds.length === 2) {
      hero.chooseSignatureSpells([plannedIds[0], plannedIds[1]]);
      return true;
    }
    return false;
  } else if (request.kind === "arcanum" && request.tier !== undefined) {
    const eligible = hero.eligibleMysticArcanumSpells(request.tier);
    if (eligible.length === 0) return true;
    if (planned?.kind === "arcanum" && planned.tier === request.tier && eligible.includes(planned.spellId)) {
      hero.chooseMysticArcanumSpell(request.tier, planned.spellId);
      return true;
    }
    return false;
  }
  return true;
}

/** D-199: this hero's current cantrip/prepared list for a swap kind — mirrors `BattleScene.spellPrepCurrent`. */
function swapCurrentList(hero: Hero, kind: SpellSwapStepKind): readonly string[] {
  return kind === "cantrips" ? hero.knownCantripIds : hero.preparedSpellIds;
}

/** D-199: the pool a swap's replacement can be drawn from — mirrors `BattleScene.spellPrepPool`. */
function swapEligiblePool(hero: Hero, classId: string, level: number, kind: SpellSwapStepKind): string[] {
  if (kind === "cantrips") return eligibleCantripPool(classId);
  const maxLevel = maxCastableSpellLevel(classId, level);
  const pool = classId === "wizard" ? [...hero.spellbookIds] : eligibleLeveledSpellPool(classId);
  return pool.filter((id) => getSpell(id).level <= maxLevel);
}

/**
 * Resolves EVERY level-up-triggered spell-swap step at `level` (cantrip
 * and/or prepared, per `spellSwapStepsForClass`) from explicit plan
 * entries — all or nothing: if any of this level's steps lacks a valid
 * plan entry (missing, a stale `dropId` no longer known, or a `learnId`
 * no longer eligible), NOTHING is applied and this returns `false`,
 * leaving the whole level for the caller to surface as a real prompt
 * instead of silently pre-resolving only part of it (which would leave a
 * live popup re-asking for a swap that already happened). Returns `true`
 * (no mutation) when this level has no swap opportunity at all, or when
 * every step resolved.
 */
export function resolveSpellSwapStepsForLevel(hero: Hero, level: number, plan?: LevelUpPlan): boolean {
  const classId = hero.classId;
  if (!classId) return true;
  const steps = spellSwapStepsForClass(classId, level, "levelUp");
  if (steps.length === 0) return true;

  const planned = plan?.spellSwaps[level] ?? [];
  const resolved: LevelUpSpellSwapChoice[] = [];
  for (const kind of steps) {
    const choice = planned.find((c) => c.kind === kind);
    if (!choice) return false;
    const current = swapCurrentList(hero, kind);
    if (!current.includes(choice.dropId)) return false;
    const eligible = swapEligiblePool(hero, classId, level, kind).filter((id) => !current.includes(id));
    if (!eligible.includes(choice.learnId)) return false;
    resolved.push(choice);
  }
  for (const choice of resolved) {
    const current = swapCurrentList(hero, choice.kind);
    const next = current.filter((id) => id !== choice.dropId).concat(choice.learnId);
    if (choice.kind === "cantrips") hero.chooseCantrips(next);
    else hero.choosePreparedSpells(next);
  }
  return true;
}

/** D-198's ability-score cap, mirrored here (not exported from `Hero.ts`) purely so the fallback below can skip an already-maxed candidate ability. */
const FALLBACK_ABILITY_SCORE_CAP = 20;

/**
 * D-198 (Party Creation Overhaul Plan 5.1): a hard rule enforced regardless
 * of what `plan`/`plan.mode` actually say — an AI-controlled hero has nobody
 * present to answer a level-up prompt, so `BattleScene.applyClassLevelUps`
 * calls these (only for `hero.controlledBy === "ai"`) whenever the explicit-
 * plan resolvers above returned false, instead of ever queuing a popup for
 * a hero nobody will click through. Each picks a simple, always-valid
 * default rather than trying to be clever — this is a safety net for an AI
 * hero with no blueprint (Plan 6) prepared for it yet, not a real AI
 * strategy.
 */
export function autoResolveAsiForLevel(hero: Hero): void {
  if (!hero.classId) return;
  const classDef = getClassDefinition(hero.classId);
  const candidates: AbilityScoreId[] = [
    classDef.primaryAbility,
    ...(classDef.spellcasting ? [classDef.spellcasting.spellcastingAbility] : []),
    ...ABILITY_SCORE_IDS,
  ];
  const ability =
    candidates.find((id) => (hero.abilityScoreValue(id) ?? 0) < FALLBACK_ABILITY_SCORE_CAP) ?? classDef.primaryAbility;
  hero.improveAbilityScore(ability, 2);
}

/** D-198: defaults to this class's first modeled subclass — see `autoResolveAsiForLevel`'s doc comment. */
export function autoResolveSubclassForClass(hero: Hero, classId: string): void {
  const options = subclassesForClass(classId);
  if (options.length > 0) hero.grantSubclass(options[0].id);
}

/** D-198: defaults to the first eligible spell(s) — see `autoResolveAsiForLevel`'s doc comment. */
export function autoResolveSpellPickForRequest(hero: Hero, request: SpellPickTrigger): void {
  if (request.kind === "mastery") {
    const eligible = hero.eligibleSpellMasterySpells();
    if (eligible.length > 0) hero.chooseSpellMasterySpell(eligible[0]);
  } else if (request.kind === "signature") {
    const eligible = hero.eligibleSignatureSpells();
    if (eligible.length >= 2) hero.chooseSignatureSpells([eligible[0], eligible[1]]);
  } else if (request.kind === "arcanum" && request.tier !== undefined) {
    const eligible = hero.eligibleMysticArcanumSpells(request.tier);
    if (eligible.length > 0) hero.chooseMysticArcanumSpell(request.tier, eligible[0]);
  }
}

/** Returns the unresolved trigger (if any) so the caller can surface it as a real prompt — undefined means either resolved from an explicit plan entry, or nothing needed choosing yet. */
function resolveSpellPickIfNeeded(hero: Hero, plan?: LevelUpPlan): SpellPickTrigger | undefined {
  if (hero.needsSpellMasteryPick()) {
    const request: SpellPickTrigger = { hero, kind: "mastery" };
    return resolveSpellPickForRequest(hero, request, plan) ? undefined : request;
  }
  if (hero.needsSignatureSpellsPick()) {
    const request: SpellPickTrigger = { hero, kind: "signature" };
    return resolveSpellPickForRequest(hero, request, plan) ? undefined : request;
  }
  for (const tier of [6, 7, 8, 9]) {
    if (hero.needsMysticArcanumPick(tier)) {
      const request: SpellPickTrigger = { hero, kind: "arcanum", tier };
      return resolveSpellPickForRequest(hero, request, plan) ? undefined : request;
    }
  }
  return undefined;
}

/**
 * Walks `hero` from its current level up to `targetLevel`, resolving every
 * ASI/subclass/spell-pick trigger along the way against an explicit `plan`
 * entry. Returns every level whose choice had no explicit plan entry — the
 * caller (`BattleScene.buildHeroes`) is responsible for surfacing those as
 * real prompts, since this module never invents a choice on the player's
 * behalf. Shared by `BattleScene`'s real pre-battle fast-forward and this
 * module's own `simulateHeroForPlanning` below, so the two can never drift.
 */
export function fastForwardHero(hero: Hero, targetLevel: number, plan?: LevelUpPlan): LevelUpChoiceStep[] {
  const unresolved: LevelUpChoiceStep[] = [];
  const cap = Math.min(targetLevel, MAX_CLASS_LEVEL);
  while (hero.level < cap) {
    hero.levelUpClass();
    if (!hero.classId) continue;
    const classDef = getClassDefinition(hero.classId);

    if (asiFeatureGrantedAtLevel(classDef, hero.level)) {
      if (!resolveAsiForLevel(hero, hero.level, plan)) unresolved.push({ level: hero.level, kind: "asi" });
    }
    if (!hero.subclassId && subclassGrantedAtLevel(classDef, hero.level) && subclassesForClass(hero.classId).length > 0) {
      if (!resolveSubclassForClass(hero, hero.classId, plan)) unresolved.push({ level: hero.level, kind: "subclass" });
    }
    const spellRequest = resolveSpellPickIfNeeded(hero, plan);
    if (spellRequest) {
      unresolved.push({ level: hero.level, kind: "spellPick", spellPickKind: spellRequest.kind, tier: spellRequest.tier });
    }
    // D-199 (Plan 6.5): silently applies a planned level-up spell swap when
    // the plan covers it, does nothing otherwise — matches today's baseline
    // exactly when no plan exists (fast-forward never surfaced a swap popup
    // before this decision, and still doesn't; only a real in-battle
    // level-up, via `BattleScene.applyClassLevelUps`, ever queues one).
    resolveSpellSwapStepsForLevel(hero, hero.level, plan);
  }
  return unresolved;
}

/**
 * Builds a scratch, throwaway `Hero` (never added to any battle) from
 * `build` and fast-forwards it to `uptoLevel` under `planSoFar` — this is
 * what lets the Character Creation planner UI show REAL eligible feats
 * (prerequisites checked against this hero's actual simulated ability
 * scores/prior feats) and REAL eligible spells (a Magic Initiate pick
 * changes `knownSpellAbilityIds()`, which changes what's eligible for a
 * later Spell Mastery/Signature Spells/Mystic Arcanum pick) at each step,
 * instead of guessing.
 */
export function simulateHeroForPlanning(build: CharacterBuild, planSoFar: LevelUpPlan, uptoLevel: number): Hero {
  const hero = new Hero(heroDefinitionFromBuild(build), { x: 0, y: 0 });
  fastForwardHero(hero, uptoLevel, planSoFar);
  return hero;
}

/** A hero's stat snapshot immediately before/after one `levelUpClass()` call — see `levelUpDeltaSummary`. */
export interface LevelUpStatSnapshot {
  maxHealth: number;
  armorClass: number;
  attackBonus: number;
}

/**
 * D-148: real, human-readable text for what a level-up actually changed —
 * KI-085/D-130's plain "reaches level N!" ack popup previously said nothing
 * else, even though every value here was already computable. Feature text
 * comes straight from `CharacterClassDefinition.features` (the same field
 * `CompendiumScene`'s `classFeatureBlocks` reads), filtered to `newLevel` so
 * only what THIS level-up granted is listed. Returns a fallback string
 * rather than an empty one so the popup is never blank for a level with no
 * stat movement (e.g. a level that grants only a spell slot).
 */
export function levelUpDeltaSummary(
  before: LevelUpStatSnapshot,
  after: LevelUpStatSnapshot,
  classId: string | undefined,
  newLevel: number,
): string {
  const parts: string[] = [];
  if (after.maxHealth !== before.maxHealth) {
    const delta = after.maxHealth - before.maxHealth;
    parts.push(`${delta > 0 ? "+" : ""}${delta} max HP`);
  }
  if (after.armorClass !== before.armorClass) parts.push(`AC ${before.armorClass}→${after.armorClass}`);
  if (after.attackBonus !== before.attackBonus) {
    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    parts.push(`attack ${fmt(before.attackBonus)}→${fmt(after.attackBonus)}`);
  }
  if (classId) {
    for (const feature of getClassDefinition(classId).features.filter((f) => f.level === newLevel)) {
      parts.push(`new feature: ${feature.name}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "No stat changes this level.";
}

export type LevelUpChoiceStepKind = "subclass" | "asi" | "spellPick" | "spellSwap";

export interface LevelUpChoiceStep {
  level: number;
  kind: LevelUpChoiceStepKind;
  spellPickKind?: "mastery" | "signature" | "arcanum";
  tier?: number;
  /** Only set for a `"spellSwap"` step — see `LevelUpSpellSwapChoice`. */
  spellSwapKind?: SpellSwapStepKind;
}

/**
 * Enumerates every future level-up choice point (1-20) for a class,
 * data-driven off the class table itself (`asiFeatureGrantedAtLevel`) plus
 * the exported Wizard/Warlock trigger-level constants — no hardcoded level
 * list to keep in sync by hand. Omits the subclass step entirely for a
 * level-1-choice class (Cleric/Sorcerer/Warlock already pick it at Character
 * Creation via the existing subclass-picker row).
 */
export function futureChoiceSteps(classId: string): LevelUpChoiceStep[] {
  const classDef = getClassDefinition(classId);
  const steps: LevelUpChoiceStep[] = [];

  if (classDef.subclassChoiceLevel > 1) {
    steps.push({ level: classDef.subclassChoiceLevel, kind: "subclass" });
  }
  for (let level = 2; level <= MAX_CLASS_LEVEL; level++) {
    if (asiFeatureGrantedAtLevel(classDef, level)) steps.push({ level, kind: "asi" });
  }
  if (classId === "wizard") {
    steps.push({ level: WIZARD_SPELL_MASTERY_LEVEL, kind: "spellPick", spellPickKind: "mastery" });
    steps.push({ level: WIZARD_SIGNATURE_SPELLS_LEVEL, kind: "spellPick", spellPickKind: "signature" });
  } else if (classId === "warlock") {
    for (const tier of [6, 7, 8, 9]) {
      steps.push({ level: WARLOCK_MYSTIC_ARCANUM_LEVELS[tier], kind: "spellPick", spellPickKind: "arcanum", tier });
    }
  }
  // D-199 (Plan 6.5): a level-up-triggered spell-swap opportunity recurs at
  // almost every level for a caster (not a one-time gate like the steps
  // above) — this can add many steps for e.g. a Sorcerer (cantrip AND
  // prepared swaps, most levels 2-20). The wizard's existing per-step
  // "Skip (decide later)" choice is the intended escape hatch, same as it
  // already is for ASI.
  for (let level = 2; level <= MAX_CLASS_LEVEL; level++) {
    for (const spellSwapKind of spellSwapStepsForClass(classId, level, "levelUp")) {
      steps.push({ level, kind: "spellSwap", spellSwapKind });
    }
  }

  return steps.sort((a, b) => a.level - b.level);
}
