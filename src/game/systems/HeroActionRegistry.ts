import type { Hero } from "../entities/Hero";
import { getAbility } from "../data/abilities";

export type HeroActionKind = "bonusAction" | "classAction";

export interface HeroActionRegistryEntry {
  id: string;
  kind: HeroActionKind;
  label: string;
  available: boolean;
}

interface HeroActionDefinition {
  id: string;
  kind: HeroActionKind;
  label: string;
  canUse: (hero: Hero) => boolean;
}

/**
 * D-148: single source of truth for "which class feature can this hero use
 * right now," extracted from BattleScene's hand-written if/else chains
 * (`showBonusActionButtonFor`/`showClassActionButtonFor`) so a future class
 * feature only needs to be added in one place. Order matches those chains'
 * original precedence. A hero is single-class, so at most one `bonusAction`
 * entry and at most one `classAction` entry is ever available at once,
 * except Reckless Attack/Preserve Life, which can coexist with Rage since
 * they don't share its bonus-action slot (see D-125).
 */
const HERO_ACTION_DEFINITIONS: HeroActionDefinition[] = [
  { id: "secondWind", kind: "bonusAction", label: "Bonus: Second Wind (R)", canUse: (h) => h.canUseSecondWind() },
  { id: "cunningActionDash", kind: "bonusAction", label: "Bonus: Cunning Action, Dash (R)", canUse: (h) => h.canUseCunningAction() },
  { id: "rage", kind: "bonusAction", label: "Bonus: Rage (R)", canUse: (h) => h.canUseRage() },
  { id: "wildShape", kind: "bonusAction", label: "Bonus: Wild Shape (R)", canUse: (h) => h.canUseWildShape() },
  { id: "flurryOfBlows", kind: "bonusAction", label: "Bonus: Flurry of Blows (R)", canUse: (h) => h.canUseFlurryOfBlows() },
  { id: "bardicInspiration", kind: "bonusAction", label: "Bonus: Bardic Inspiration (R)", canUse: (h) => h.canUseBardicInspiration() },
  { id: "huntersMark", kind: "bonusAction", label: "Bonus: Hunter's Mark (R)", canUse: (h) => h.canUseHuntersMark() },
  { id: "quickenSpell", kind: "bonusAction", label: "Bonus: Quickened Spell (R)", canUse: (h) => h.canUseQuickenSpell() },
  { id: "recklessAttack", kind: "classAction", label: "Reckless Attack (T)", canUse: (h) => h.canUseRecklessAttack() },
  { id: "preserveLife", kind: "classAction", label: "Channel Divinity: Preserve Life (T)", canUse: (h) => h.canUsePreserveLife() },
  { id: "vanish", kind: "classAction", label: "Vanish (T)", canUse: (h) => h.canUseVanish() },
  { id: "cunningActionHide", kind: "classAction", label: "Cunning Action: Hide (T)", canUse: (h) => h.canUseCunningActionHide() },
  { id: "emptyBody", kind: "classAction", label: "Empty Body (T)", canUse: (h) => h.canUseEmptyBody() },
];

/** Every registered action for `hero`, in precedence order, with its current availability. */
export function listHeroActions(hero: Hero): HeroActionRegistryEntry[] {
  return HERO_ACTION_DEFINITIONS.map((def) => ({
    id: def.id,
    kind: def.kind,
    label: def.label,
    available: def.canUse(hero),
  }));
}

/** The first currently-available action of `kind` for `hero`, or undefined if none applies. */
export function firstAvailableHeroAction(hero: Hero, kind: HeroActionKind): HeroActionRegistryEntry | undefined {
  return listHeroActions(hero).find((entry) => entry.kind === kind && entry.available);
}

/**
 * D-165 (KI-098 item 2): the shared display label for one of
 * `Hero.actionHotkeys()`'s slots — a registry action's own label (its
 * keyboard-shortcut suffix stripped, since a pinned hotkey slot has no such
 * shortcut of its own), or a known spell/cantrip's name. Shared by
 * `CharacterSheetScene`'s hotkey editor and `BattleScene`'s in-battle
 * hotkey bar so the two can never drift apart.
 */
export function hotkeyDisplayLabel(hero: Hero, id: string | undefined): string {
  if (!id) return "(empty)";
  const registryMatch = listHeroActions(hero).find((a) => a.id === id);
  if (registryMatch) return registryMatch.label.replace(" (R)", "").replace(" (T)", "");
  if (hero.knownSpellAbilityIds().includes(id)) return getAbility(id).name;
  return id;
}
