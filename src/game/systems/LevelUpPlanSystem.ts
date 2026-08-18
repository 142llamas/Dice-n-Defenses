import { ABILITY_SCORE_IDS, type AbilityScoreId } from "../data/abilityScores";
import { getClassDefinition } from "../data/classes";
import { subclassesForClass } from "../data/subclasses";
import { asiFeatureGrantedAtLevel, subclassGrantedAtLevel } from "./CharacterSystem";
import { heroDefinitionFromBuild, type CharacterBuild } from "./CharacterBuildSystem";
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
 *   fast-forward, always silent),
 * - `BattleScene.applyClassLevelUps`'s new "auto" branch (a real in-battle
 *   level-up resolved silently, same as fast-forward, because this hero's
 *   plan `mode` says to), or
 * - `CharacterCreationScene`'s planner UI itself, which needs to simulate a
 *   hero forward through a partial plan to show real eligible feats/spells
 *   at each future choice point (`simulateHeroForPlanning`).
 *
 * A hero with no plan (`plan` undefined, or a level with no entry in it)
 * gets EXACTLY D-129's original fixed defaults — raise the current-highest
 * ability score; the class's first modeled subclass; the first eligible
 * spell(s) — so every existing build/save/test is unaffected.
 */

export type AsiPlanChoice =
  | { path: "ability"; abilityMode: "single"; ability: AbilityScoreId }
  | { path: "ability"; abilityMode: "split"; first: AbilityScoreId; second: AbilityScoreId }
  | { path: "feat"; featId: string; chosenAbility?: AbilityScoreId; magicInitiateList?: MagicInitiateListId };

export type SpellPickPlanChoice =
  | { kind: "mastery"; spellId: string }
  | { kind: "signature"; spellIds: [string, string] }
  | { kind: "arcanum"; tier: number; spellId: string };

export type LevelUpPlanMode = "auto" | "prompt" | "fresh";

export interface LevelUpPlan {
  mode: LevelUpPlanMode;
  /** Only meaningful for a class whose `subclassChoiceLevel` is > 1 — a level-1-choice class picks at Character Creation already. */
  subclassId?: string;
  /** Keyed by the level the ASI/feat choice triggers at. */
  asiChoices: Partial<Record<number, AsiPlanChoice>>;
  /** Keyed by the level the spell-mastery-family pick triggers at (not by tier — Warlock's 4 tiers each land at a distinct level). */
  spellPicks: Partial<Record<number, SpellPickPlanChoice>>;
}

export function emptyLevelUpPlan(mode: LevelUpPlanMode = "fresh"): LevelUpPlan {
  return { mode, asiChoices: {}, spellPicks: {} };
}

/** D-125's pending spell-mastery-family pick shape, mirrored here (not imported from `BattleScene` — a scene file — to keep this module Phaser-free); structurally identical to `BattleScene`'s own `SpellPickRequest`. */
export interface SpellPickTrigger {
  hero: Hero;
  kind: "mastery" | "signature" | "arcanum";
  tier?: number;
}

function spellPickTriggerLevel(request: SpellPickTrigger): number | undefined {
  if (request.kind === "mastery") return WIZARD_SPELL_MASTERY_LEVEL;
  if (request.kind === "signature") return WIZARD_SIGNATURE_SPELLS_LEVEL;
  if (request.kind === "arcanum" && request.tier !== undefined) return WARLOCK_MYSTIC_ARCANUM_LEVELS[request.tier];
  return undefined;
}

/** D-129's original default: this hero's own current-highest ability score. */
export function defaultAsiAbility(hero: Hero): AbilityScoreId {
  return ABILITY_SCORE_IDS.reduce(
    (best, id) => ((hero.abilityScoreValue(id) ?? 0) > (hero.abilityScoreValue(best) ?? 0) ? id : best),
    ABILITY_SCORE_IDS[0],
  );
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

/** Resolves this hero's ASI-or-feat choice at `level` — the plan's choice if present and still valid, else D-129's default. */
export function resolveAsiForLevel(hero: Hero, level: number, plan?: LevelUpPlan): void {
  const planned = plan?.asiChoices[level];
  if (planned && isAsiChoiceValid(hero, planned)) {
    applyAsiChoice(hero, planned);
    return;
  }
  hero.improveAbilityScore(defaultAsiAbility(hero), 2);
}

/** Resolves this hero's subclass choice — the plan's pick if present and a real option for this class, else the class's first modeled subclass (D-129's default). No-op for a class with no modeled subclasses. */
export function resolveSubclassForClass(hero: Hero, classId: string, plan?: LevelUpPlan): void {
  const options = subclassesForClass(classId);
  if (options.length === 0) return;
  const wanted = plan?.subclassId;
  const id = wanted && options.some((o) => o.id === wanted) ? wanted : options[0].id;
  hero.grantSubclass(id);
}

/** Resolves one Wizard/Warlock spell-mastery-family pick — the plan's spell(s) if present and still eligible, else D-129's "first eligible" default. A no-op if nothing is eligible yet (mirrors the existing queue's own skip behavior). */
export function resolveSpellPickForRequest(hero: Hero, request: SpellPickTrigger, plan?: LevelUpPlan): void {
  const triggerLevel = spellPickTriggerLevel(request);
  const planned = triggerLevel !== undefined ? plan?.spellPicks[triggerLevel] : undefined;

  if (request.kind === "mastery") {
    const eligible = hero.eligibleSpellMasterySpells();
    if (eligible.length === 0) return;
    const spellId = planned?.kind === "mastery" && eligible.includes(planned.spellId) ? planned.spellId : eligible[0];
    hero.chooseSpellMasterySpell(spellId);
  } else if (request.kind === "signature") {
    const eligible = hero.eligibleSignatureSpells();
    if (eligible.length < 2) return;
    const plannedIds = planned?.kind === "signature" ? planned.spellIds.filter((id) => eligible.includes(id)) : [];
    const [first, second] = plannedIds.length === 2 ? plannedIds : [eligible[0], eligible[1]];
    hero.chooseSignatureSpells([first, second]);
  } else if (request.kind === "arcanum" && request.tier !== undefined) {
    const eligible = hero.eligibleMysticArcanumSpells(request.tier);
    if (eligible.length === 0) return;
    const spellId =
      planned?.kind === "arcanum" && planned.tier === request.tier && eligible.includes(planned.spellId)
        ? planned.spellId
        : eligible[0];
    hero.chooseMysticArcanumSpell(request.tier, spellId);
  }
}

function resolveSpellPickIfNeeded(hero: Hero, plan?: LevelUpPlan): void {
  if (hero.needsSpellMasteryPick()) {
    resolveSpellPickForRequest(hero, { hero, kind: "mastery" }, plan);
  } else if (hero.needsSignatureSpellsPick()) {
    resolveSpellPickForRequest(hero, { hero, kind: "signature" }, plan);
  } else {
    for (const tier of [6, 7, 8, 9]) {
      if (hero.needsMysticArcanumPick(tier)) {
        resolveSpellPickForRequest(hero, { hero, kind: "arcanum", tier }, plan);
        break;
      }
    }
  }
}

/**
 * Walks `hero` from its current level up to `targetLevel`, resolving every
 * ASI/subclass/spell-pick trigger along the way against `plan` (falling back
 * to D-129's defaults for anything the plan doesn't cover) — always silent,
 * no popup, the same shape D-129's original `fastForwardHeroToLevel` used
 * inline. Shared by `BattleScene`'s real pre-battle fast-forward and this
 * module's own `simulateHeroForPlanning` below, so the two can never drift.
 */
export function fastForwardHero(hero: Hero, targetLevel: number, plan?: LevelUpPlan): void {
  const cap = Math.min(targetLevel, MAX_CLASS_LEVEL);
  while (hero.level < cap) {
    hero.levelUpClass();
    if (!hero.classId) continue;
    const classDef = getClassDefinition(hero.classId);

    if (asiFeatureGrantedAtLevel(classDef, hero.level)) {
      resolveAsiForLevel(hero, hero.level, plan);
    }
    if (!hero.subclassId && subclassGrantedAtLevel(classDef, hero.level) && subclassesForClass(hero.classId).length > 0) {
      resolveSubclassForClass(hero, hero.classId, plan);
    }
    resolveSpellPickIfNeeded(hero, plan);
  }
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

export type LevelUpChoiceStepKind = "subclass" | "asi" | "spellPick";

export interface LevelUpChoiceStep {
  level: number;
  kind: LevelUpChoiceStepKind;
  spellPickKind?: "mastery" | "signature" | "arcanum";
  tier?: number;
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

  return steps.sort((a, b) => a.level - b.level);
}
