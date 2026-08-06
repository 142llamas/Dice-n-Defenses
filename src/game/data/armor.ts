import type { EquipmentDefinition } from "./equipment";

/**
 * Armor definitions — data, not code (Source of Truth "data-driven content").
 *
 * Phase 17 (D-108): the real SRD 5.2.1 (2024 rules, CC-BY-4.0) armor table —
 * see `data/weapons.ts`'s module comment for the same licensing/attribution
 * note, and CONTENT_SOURCES.md for the exact notice. All eleven light/
 * medium/heavy armors plus the Shield are here — the SRD's complete list,
 * nothing trimmed.
 *
 * Real armor goes into the EXISTING `"chest"` gear slot, alongside Phase
 * 11.5/13.9's flavor magic items (Iron Buckler, Chainmail Vest, Aegis of the
 * First Ward, etc.) — a hero picks ONE, matching the real rule that you wear
 * one suit of armor at a time. Unlike a flavor item's flat `armorClass`
 * bonus, real armor SETS the Armor Class formula outright via the new
 * `armor` field: light armor adds a hero's full Dex modifier (mechanically
 * identical to the existing "flat bonus over 10+Dex" model, so no Hero
 * change was needed there), medium armor caps the Dex bonus at +2, and heavy
 * armor ignores Dex entirely — see `Hero.armorClass` for where this branches.
 *
 * The Shield is NOT a base-AC item — it's a flat +2 bonus in its own new
 * `"shield"` slot, on top of whatever armor (or lack of it) a hero is
 * wearing, exactly like every other flat-bonus gear item already works.
 *
 * `strengthRequirement`/`stealthDisadvantage` are real, accurate SRD data
 * (shown in the Compendium and item tooltips) but NOT mechanically enforced
 * this pass — this game has no stealth-check mechanic to disadvantage, and
 * enforcing a Strength-gated movement penalty would mean converting
 * `Hero.movementTiles` from a plain field to a live getter, a bigger change
 * than this pass's scope. An honest, documented boundary, same treatment as
 * `WeaponProperty.ammunition` not tracking real ammo consumption.
 */

export type ArmorCategory = "light" | "medium" | "heavy";

/**
 * How this armor's Dex modifier applies to the wearer's Armor Class:
 * "full" (light armor — every point of Dex counts, matching the classic
 * unarmored 10+Dex formula this game already used), "capped" (medium armor —
 * at most `dexCap` points of Dex count), or "none" (heavy armor — Dex is
 * ignored outright, AC is a flat number).
 */
export type ArmorDexMode = "full" | "capped" | "none";

export interface ArmorData {
  category: ArmorCategory;
  /** This armor's own listed AC (e.g. 11 for Leather, 18 for Plate) — NOT a bonus, a base value that REPLACES the hero's unarmored 10+Dex baseline. */
  baseAC: number;
  dexMode: ArmorDexMode;
  /** Only present when `dexMode === "capped"` (always 2 in the SRD). */
  dexCap?: number;
  /** Real SRD data, reference-only this pass — see module comment. */
  strengthRequirement?: number;
  /** Real SRD data, reference-only this pass — see module comment. */
  stealthDisadvantage?: boolean;
}

const a = (
  id: string,
  name: string,
  cost: number,
  category: ArmorCategory,
  baseAC: number,
  dexMode: ArmorDexMode,
  opts: { dexCap?: number; strengthRequirement?: number; stealthDisadvantage?: boolean } = {},
): [string, EquipmentDefinition] => {
  const dexText =
    dexMode === "full" ? "adds your full Dex modifier" : dexMode === "capped" ? `adds Dex (max +${opts.dexCap ?? 2})` : "no Dex modifier";
  const strText = opts.strengthRequirement ? `, requires Str ${opts.strengthRequirement}` : "";
  const stealthText = opts.stealthDisadvantage ? ", stealth disadvantage" : "";
  return [
    id,
    {
      id,
      name,
      description: `${category[0].toUpperCase()}${category.slice(1)} armor — AC ${baseAC} (${dexText})${strText}${stealthText}.`,
      cost,
      slot: "chest",
      rarity: "common",
      assetKey: `armor-${id}`,
      armor: { category, baseAC, dexMode, dexCap: opts.dexCap, strengthRequirement: opts.strengthRequirement, stealthDisadvantage: opts.stealthDisadvantage },
    },
  ];
};

export const ARMOR_DEFINITIONS: Record<string, EquipmentDefinition> = Object.fromEntries([
  // ----- Light armor (full Dex) -----
  a("padded-armor", "Padded Armor", 6, "light", 11, "full", { stealthDisadvantage: true }),
  a("leather-armor", "Leather Armor", 10, "light", 11, "full"),
  a("studded-leather-armor", "Studded Leather Armor", 18, "light", 12, "full"),

  // ----- Medium armor (Dex capped at +2) -----
  a("hide-armor", "Hide Armor", 10, "medium", 12, "capped", { dexCap: 2 }),
  a("chain-shirt", "Chain Shirt", 20, "medium", 13, "capped", { dexCap: 2 }),
  a("scale-mail", "Scale Mail", 20, "medium", 14, "capped", { dexCap: 2, stealthDisadvantage: true }),
  a("breastplate", "Breastplate", 40, "medium", 14, "capped", { dexCap: 2 }),
  a("half-plate-armor", "Half Plate Armor", 50, "medium", 15, "capped", { dexCap: 2, stealthDisadvantage: true }),

  // ----- Heavy armor (no Dex) -----
  a("ring-mail", "Ring Mail", 14, "heavy", 14, "none", { stealthDisadvantage: true }),
  a("chain-mail", "Chain Mail", 30, "heavy", 16, "none", { strengthRequirement: 13, stealthDisadvantage: true }),
  a("splint-armor", "Splint Armor", 46, "heavy", 17, "none", { strengthRequirement: 15, stealthDisadvantage: true }),
  a("plate-armor", "Plate Armor", 70, "heavy", 18, "none", { strengthRequirement: 15, stealthDisadvantage: true }),
]);

export const ARMOR_ORDER: string[] = Object.keys(ARMOR_DEFINITIONS);

/** The Shield: a flat +2 AC bonus in its own slot, stacking on top of any armor (or none). */
export const SHIELD_DEFINITIONS: Record<string, EquipmentDefinition> = {
  shield: {
    id: "shield",
    name: "Shield",
    description: "+2 AC. Occupies a hand — cannot be worn with a Two-Handed weapon equipped.",
    cost: 10,
    slot: "shield",
    rarity: "common",
    armorClass: 2,
    assetKey: "armor-shield",
  },
};

export const SHIELD_ORDER: string[] = Object.keys(SHIELD_DEFINITIONS);
