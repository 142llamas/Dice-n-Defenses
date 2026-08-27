import { getClassDefinition, type ClassFeature } from "../data/classes";
import { getSubclassDefinition } from "../data/subclasses";
import { spellSlotsForClassAtLevel, cantripsKnownForClassAtLevel } from "./SpellcastingSystem";
import { preparedSpellCountForClassAtLevel, wizardSpellbookSizeAtLevel } from "./SpellPreparationSystem";

/**
 * D-200 (Party Creation Overhaul Plan 7) — a level-by-level (1-20) reference
 * table for a class, optionally combined with one of its subclasses. Not to
 * be confused with `ProgressionSystem.ts` (wave-clear level-up cadence) —
 * this file is pure assembly over already-tested per-level data (class/
 * subclass feature lists, `SpellcastingSystem`/`SpellPreparationSystem`'s
 * spell tables) for `CompendiumScene`/`CharacterSheetScene` to render; it
 * adds no new game-balance numbers of its own.
 */

const MIN_LEVEL = 1;
const MAX_LEVEL = 20;

export interface ProgressionLevelEntry {
  level: number;
  classFeatures: ClassFeature[];
  subclassFeatures: ClassFeature[];
  isCaster: boolean;
  cantripsKnown: number;
  spellSlots: number[];
  preparedCount: number;
  /** Wizard only — meaningless for any other class. */
  spellbookSize?: number;
}

export function classProgressionTable(classId: string, subclassId?: string): ProgressionLevelEntry[] {
  const classDef = getClassDefinition(classId);
  // getSubclassDefinition throws on an unknown id (and on undefined) — only
  // call it when subclassId is actually present, and only trust the result
  // if it really belongs to this class.
  const subclassDef = subclassId ? getSubclassDefinition(subclassId) : undefined;
  const validSubclassDef = subclassDef && subclassDef.classId === classId ? subclassDef : undefined;
  const isCaster = !!classDef.spellcasting;

  const entries: ProgressionLevelEntry[] = [];
  for (let level = MIN_LEVEL; level <= MAX_LEVEL; level++) {
    entries.push({
      level,
      classFeatures: classDef.features.filter((f) => f.level === level),
      subclassFeatures: validSubclassDef ? validSubclassDef.features.filter((f) => f.level === level) : [],
      isCaster,
      cantripsKnown: isCaster ? cantripsKnownForClassAtLevel(classDef, level) : 0,
      spellSlots: isCaster ? spellSlotsForClassAtLevel(classDef, level) : [],
      preparedCount: isCaster ? preparedSpellCountForClassAtLevel(classId, level) : 0,
      spellbookSize: classId === "wizard" ? wizardSpellbookSizeAtLevel(level) : undefined,
    });
  }
  return entries;
}
