import type { AbilityDefinition } from "../data/abilities";
import type { DamageType } from "../data/weapons";
import { SPELLS, type SpellSchool } from "../data/spells";

/**
 * D-122: pure selection logic for spell-cast and death visuals — no Phaser
 * import, fully unit-testable, per this project's "rules live in systems/"
 * architecture rule. `BattleScene` reads a descriptor from here and does the
 * actual Phaser drawing; this file only decides WHICH shape/color/variation
 * a given ability (or death cause) gets.
 *
 * The core problem this solves: ~198 castable spells/abilities need to each
 * feel visually distinct, but hand-authoring 198 bespoke animations isn't
 * realistic. Instead, every ability is assigned a SHAPE (structurally, from
 * its own real mechanical fields — kind/savingThrow/forcedMoveTiles/etc.,
 * already-verified SRD data) and a COLOR. D-131 gave ~47 real castable
 * spells a verified SRD `damageType` — that field is now the PRIMARY color/
 * death-cause signal (see `colorForAbility`/`deathCauseForAbility` below).
 * For everything without one (buffs/heals/summons/control spells with no
 * real damage type, plus the four original non-spell Phase-4 abilities),
 * the color still falls back to the pre-D-131 method: a best-effort keyword
 * match against the ability's own name/description text, or its real SRD
 * `school` if no keyword matches (see KI-078, now resolved for every spell
 * that has a real `damageType`). A small hash of the ability's own id then
 * picks secondary variation (particle count, size, rotation, duration) so
 * two spells sharing a shape+color family still don't animate identically.
 */

export type ElementTag =
  | "fire"
  | "frost"
  | "lightning"
  | "poison"
  | "necrotic"
  | "radiant"
  | "psychic"
  | "force"
  | "shadow"
  | "water"
  | "earth"
  | "arcane";

const ELEMENT_KEYWORDS: Array<{ tag: ElementTag; words: string[] }> = [
  // Radiant checked first: "sacred"/"holy"/"divine" are unambiguous, and
  // real SRD radiant spells sometimes still say "flame"/"fire" in flavor
  // text (Sacred Flame is radiant damage, not fire) — this order gets that
  // specific, known case right without needing a per-spell exception list.
  { tag: "radiant", words: ["radiant", "holy", "sacred", "divine", "sun", "light", "heal", "cure", "bless", "guardian"] },
  { tag: "fire", words: ["fire", "flame", "burn", "scorch", "ignite", "ember", "inferno", "immolat", "sear"] },
  { tag: "frost", words: ["frost", "ice", "cold", "freeze", "winter", "chill", "snow"] },
  { tag: "lightning", words: ["lightning", "thunder", "shock", "spark", "storm", "electric"] },
  { tag: "poison", words: ["poison", "venom", "acid", "caustic", "toxin", "blight", "plague"] },
  { tag: "necrotic", words: ["necro", "death", "decay", "wither", "grave", "bone", "skull", "undeath", "doom"] },
  { tag: "psychic", words: ["psychic", "mind", "confusion", "fear", "dream", "sleep", "charm", "hypnot"] },
  { tag: "force", words: ["force", "gravity", "telekin", "gust", "wind"] },
  { tag: "shadow", words: ["shadow", "dark", "night", "gloom"] },
  { tag: "water", words: ["water", "wave", "tide", "flood", "rain"] },
  { tag: "earth", words: ["stone", "earth", "rock", "mud", "sand", "boulder"] },
];

/** Best-effort keyword guess at an ability's elemental flavor, for color only — see module comment. */
export function inferElement(text: string): ElementTag | undefined {
  const lower = text.toLowerCase();
  for (const { tag, words } of ELEMENT_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return tag;
  }
  return undefined;
}

const SCHOOL_COLORS: Record<SpellSchool, number> = {
  abjuration: 0x8fb8ff,
  conjuration: 0xa06bff,
  divination: 0xf0e6a0,
  enchantment: 0xff8fd0,
  evocation: 0xff9a4a,
  illusion: 0x6fe0d8,
  necromancy: 0x7a4a8a,
  transmutation: 0x5fd88a,
};

const ELEMENT_COLORS: Record<ElementTag, number> = {
  fire: 0xff5a2a,
  frost: 0x8fd8ff,
  lightning: 0xfff066,
  poison: 0x6fdc4f,
  necrotic: 0x5a2a6e,
  radiant: 0xfff2b0,
  psychic: 0xff7fd8,
  force: 0xd8d8ff,
  shadow: 0x6a4a9e,
  water: 0x4aa8ff,
  earth: 0x9c7b4f,
  arcane: 0x9a6bff,
};

/** Every leveled/cantrip spell's real SRD school, indexed by the ability id it casts through (built once from `SPELLS`). */
const ABILITY_SCHOOL: Partial<Record<string, SpellSchool>> = {};
for (const spell of Object.values(SPELLS)) {
  if (spell.abilityId) ABILITY_SCHOOL[spell.abilityId] = spell.school;
}

/**
 * D-131: a verified `DamageType` -> cast color, for the ~47 real castable
 * spells that now carry one. The three physical types (rare for a spell —
 * only Earthquake/Insect Plague in this catalogue) get an earthy tone since
 * neither the cosmetic `ElementTag` set nor `SCHOOL_COLORS` has a "physical"
 * bucket; every elemental type reuses `ELEMENT_COLORS` where a matching tag
 * already exists, plus three new tones (acid, thunder — psychic/force
 * already existed as `ElementTag`s) for the types that didn't.
 */
const DAMAGE_TYPE_COLORS: Record<DamageType, number> = {
  acid: 0x9fe000,
  bludgeoning: ELEMENT_COLORS.earth,
  cold: ELEMENT_COLORS.frost,
  fire: ELEMENT_COLORS.fire,
  force: ELEMENT_COLORS.force,
  lightning: ELEMENT_COLORS.lightning,
  necrotic: ELEMENT_COLORS.necrotic,
  piercing: ELEMENT_COLORS.earth,
  poison: ELEMENT_COLORS.poison,
  psychic: ELEMENT_COLORS.psychic,
  radiant: ELEMENT_COLORS.radiant,
  slashing: ELEMENT_COLORS.earth,
  thunder: 0xc8c8ff,
};

/**
 * D-131: `ability.damageType` is now the PRIMARY color signal — real,
 * verified SRD data — falling back to the pre-D-131 keyword/school guess
 * only when it's absent (a spell with no real damage type at all: a buff,
 * heal, summon, control spell, or one of the four non-spell Phase-4
 * abilities).
 */
function colorForAbility(ability: AbilityDefinition): number {
  if (ability.damageType) return DAMAGE_TYPE_COLORS[ability.damageType];
  const element = inferElement(ability.name) ?? inferElement(ability.description);
  if (element) return ELEMENT_COLORS[element];
  const school = ABILITY_SCHOOL[ability.id];
  if (school) return SCHOOL_COLORS[school];
  return ELEMENT_COLORS.arcane;
}

export type CastShape =
  | "bolt"
  | "homingOrb"
  | "fallingJudgment"
  | "novaBurst"
  | "ringPulse"
  | "gustCone"
  | "sparkleRise"
  | "radiantPulse"
  | "groundRune"
  | "conjureCircle"
  | "blink";

/** Structural, deterministic shape pick — from the ability's own real mechanical fields, not a guess. */
function shapeForAbility(ability: AbilityDefinition): CastShape {
  if (ability.teleportSelf) return "blink";
  if (ability.summonsId) return "conjureCircle";
  if (ability.altersTerrainId) return "groundRune";
  if (ability.areaAllies) return "radiantPulse";
  if (ability.targetsAlly) return "sparkleRise";
  if (ability.forcedMoveTiles) return "gustCone";
  if (ability.kind === "aoeAtRange") return "novaBurst";
  if (ability.kind === "aoeAdjacent") return "ringPulse";
  if (ability.savingThrow) return "fallingJudgment";
  if (ability.autoHit) return "homingOrb";
  return "bolt";
}

/** Deterministic string hash (NOT randomness) — the same ability id always yields the same variation. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export interface CastVisualDescriptor {
  shape: CastShape;
  color: number;
  /** How many motes/particles a shape's flourish draws — 3, 5, or 7. */
  particleCount: number;
  /** 0.85-1.25x — scales the whole effect's size. */
  sizeScale: number;
  rotationDir: 1 | -1;
  /** 0.85-1.15x — scales the effect's base duration. */
  durationScale: number;
}

/** The full per-ability visual pick this ability's cast animation uses — see module comment for the method. */
export function getCastVisual(ability: AbilityDefinition): CastVisualDescriptor {
  const h = hashString(ability.id);
  return {
    shape: shapeForAbility(ability),
    color: colorForAbility(ability),
    particleCount: [3, 5, 7][h % 3],
    sizeScale: 0.85 + ((h >>> 3) % 5) * 0.1,
    rotationDir: (h >>> 6) % 2 === 0 ? 1 : -1,
    durationScale: 0.85 + ((h >>> 9) % 4) * 0.1,
  };
}

export type DeathCause =
  | "physical"
  | "fire"
  | "frost"
  | "acid"
  | "poison"
  | "necrotic"
  | "radiant"
  | "lightning"
  | "thunder"
  | "psychic"
  | "force"
  | "arcane";

export type DeathShape =
  | "collapse"
  | "emberFade"
  | "shatter"
  | "dissolve"
  | "wither"
  | "radiantBurst"
  | "sparkCrackle"
  | "arcaneFade";

const DEATH_VISUALS: Record<DeathCause, { shape: DeathShape; color: number }> = {
  physical: { shape: "collapse", color: 0xb0b0b0 },
  fire: { shape: "emberFade", color: ELEMENT_COLORS.fire },
  frost: { shape: "shatter", color: ELEMENT_COLORS.frost },
  acid: { shape: "dissolve", color: 0x9fe000 },
  poison: { shape: "dissolve", color: ELEMENT_COLORS.poison },
  necrotic: { shape: "wither", color: ELEMENT_COLORS.necrotic },
  radiant: { shape: "radiantBurst", color: ELEMENT_COLORS.radiant },
  lightning: { shape: "sparkCrackle", color: ELEMENT_COLORS.lightning },
  thunder: { shape: "sparkCrackle", color: 0xc8c8ff },
  psychic: { shape: "arcaneFade", color: ELEMENT_COLORS.psychic },
  force: { shape: "shatter", color: ELEMENT_COLORS.force },
  arcane: { shape: "arcaneFade", color: ELEMENT_COLORS.arcane },
};

/** A verified `DamageType` -> `DeathCause`, for D-131's real per-spell damage types. */
const DAMAGE_TYPE_DEATH_CAUSE: Record<DamageType, DeathCause> = {
  acid: "acid",
  bludgeoning: "physical",
  cold: "frost",
  fire: "fire",
  force: "force",
  lightning: "lightning",
  necrotic: "necrotic",
  piercing: "physical",
  poison: "poison",
  psychic: "psychic",
  radiant: "radiant",
  slashing: "physical",
  thunder: "thunder",
};

/**
 * What killed an enemy. D-131: `ability.damageType` is now the PRIMARY
 * signal — real, verified SRD data — falling back to the pre-D-131 keyword
 * guess only when it's absent (a spell with no real damage type at all, or
 * one of the four non-spell Phase-4 abilities), which collapses the richer
 * `ElementTag` set down to fewer death causes (shadow/water/earth all still
 * read as "arcane" for a GUESSED cause — a full per-tag death system there
 * doesn't buy anything a player would actually notice — but every VERIFIED
 * damage type now gets its own distinct cause, including three that the
 * pre-D-131 guess-only set never had: acid, thunder, force).
 */
export function deathCauseForAbility(ability: AbilityDefinition): DeathCause {
  if (ability.damageType) return DAMAGE_TYPE_DEATH_CAUSE[ability.damageType];
  const element = inferElement(ability.name) ?? inferElement(ability.description);
  switch (element) {
    case "fire":
      return "fire";
    case "frost":
      return "frost";
    case "poison":
      return "poison";
    case "necrotic":
      return "necrotic";
    case "radiant":
      return "radiant";
    case "lightning":
      return "lightning";
    default:
      return "arcane";
  }
}

export function getDeathVisual(cause: DeathCause): { shape: DeathShape; color: number } {
  return DEATH_VISUALS[cause];
}
