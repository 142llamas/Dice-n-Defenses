import type { AbilityDefinition } from "../data/abilities";
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
 * already-verified SRD data) and a COLOR (from its real SRD `school` where
 * one exists, refined by a best-effort keyword match against the ability's
 * own name/description text for a more specific elemental flavor — e.g.
 * "Fire Bolt" reads orange, not generic evocation-orange, though a handful
 * of spells will still get their school's fallback color if no keyword
 * matches). The keyword match is a COSMETIC guess, not verified SRD damage
 * typing — this game has no damage-type field on spells at all, and getting
 * the *feel* right for hundreds of spells matters more here than exhaustive
 * per-spell verification would for a mechanical rule. A small hash of the
 * ability's own id then picks secondary variation (particle count, size,
 * rotation, duration) so two spells sharing a shape+color family still don't
 * animate identically.
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

function colorForAbility(ability: AbilityDefinition): number {
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

export type DeathCause = "physical" | "fire" | "frost" | "poison" | "necrotic" | "radiant" | "lightning" | "arcane";

export type DeathShape = "collapse" | "emberFade" | "shatter" | "dissolve" | "wither" | "radiantBurst" | "sparkCrackle" | "arcaneFade";

const DEATH_VISUALS: Record<DeathCause, { shape: DeathShape; color: number }> = {
  physical: { shape: "collapse", color: 0xb0b0b0 },
  fire: { shape: "emberFade", color: ELEMENT_COLORS.fire },
  frost: { shape: "shatter", color: ELEMENT_COLORS.frost },
  poison: { shape: "dissolve", color: ELEMENT_COLORS.poison },
  necrotic: { shape: "wither", color: ELEMENT_COLORS.necrotic },
  radiant: { shape: "radiantBurst", color: ELEMENT_COLORS.radiant },
  lightning: { shape: "sparkCrackle", color: ELEMENT_COLORS.lightning },
  arcane: { shape: "arcaneFade", color: ELEMENT_COLORS.arcane },
};

/**
 * What killed an enemy, collapsed from the richer 12-tag `ElementTag` set
 * down to 8 death causes — psychic/force/shadow/water/earth all read as
 * "arcane" here, since a full 12-shape death system doesn't buy anything a
 * player would actually notice over the 8 that do (burn/frost/poison/
 * necrotic/radiant/lightning are the ones a spell's flavor text usually
 * telegraphs; everything else is "died to magic").
 */
export function deathCauseForAbility(ability: AbilityDefinition): DeathCause {
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
