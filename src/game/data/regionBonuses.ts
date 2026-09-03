/**
 * Pre-region bonus choices — data, not code (D-181, KI-098 item 13,
 * CAMPAIGN_STORY_DESIGN.md §8).
 *
 * HOMM3-style: before a chaptered campaign's battle begins, the player
 * picks 1 of 3 bonuses, randomly drawn (`RegionBonusSystem
 * .drawRegionBonusChoices`) from that region's own curated pool below.
 * Per §8, every pool covers all THREE categories (D-217 dropped "xp" — see
 * below) so a drawn triplet is never accidentally lopsided toward one kind
 * of advantage:
 *   - **gold** — a flat starting-gold grant (`goldAmount`). Two tiers per
 *     region now (a modest one and a bigger one), filling the slot the
 *     removed "xp" category left rather than shrinking the pool.
 *   - **equipment** — a specific mundane item a hero starts already
 *     equipped with (`equipmentId`), on top of whatever it picked in
 *     Character Creation. Deliberately capped at common/uncommon,
 *     non-attunement mundane gear across every region (not scaled by
 *     region tier) — the bonus screen can appear at ANY of a region's 4
 *     chapters (see D-181's own module note on why "per chapter" was
 *     chosen over a literal "per region" one-time offer), including a
 *     level 1-5 Chapter 1, so an item strong enough to feel special in a
 *     level 16-20 Chapter 4 would trivialize an early one.
 *   - **structure** — a free structure/trap already built on the field
 *     when the battle begins (`structureId`), auto-placed on the first
 *     valid buildable tile found (`BattleScene.grantRegionBonusStructure`).
 *
 * D-217 (item 3c): the "xp" category — "guaranteed, permanent character
 * power" per the original design doc framing, modeled as a flat permanent
 * max-HP grant (`bonusHealth`, `Hero.grantBonusHealth`) because this game
 * had no real XP/level system to hook a level-up into — is REMOVED
 * outright, not replaced with a different permanent stat-bump category.
 * Now that a real, persistent, shared `campaignLevel` exists
 * (`CampaignLevelSystem`) and campaign-hero level is fully derived from
 * mission milestone data rather than player-purchasable, keeping any bonus
 * that still grants a permanent level/stat bump would just be the old
 * workaround wearing a new label — exactly what item 3c's "remove the
 * separate overworld stat-bonus progression" asked to get rid of.
 *
 * Gold amounts DO escalate by region, using CAMPAIGN_STORY_DESIGN.md §3's
 * own numbered region order (1 Emberford Reach ... 6 Frostbound Hollow) as
 * the tier ladder — "region 1's best offer should be modest, region 6's
 * should be substantial" (§8). Every number here is a first-pass guess,
 * same KI-015 caveat every other balance number in this project carries —
 * Kevin's own in-browser call, not tuned yet.
 *
 * All content here is ORIGINAL to this project. Every equipment/structure
 * id referenced was already original content logged in CONTENT_SOURCES.md
 * (Phase 13.9/22 equipment, Phase 5/7/24/25 structures) — this file adds
 * no new item, only a new curated arrangement of existing ones.
 */

export type RegionBonusCategory = "gold" | "equipment" | "structure";

export interface RegionBonusOption {
  id: string;
  category: RegionBonusCategory;
  /** Player-facing card title. */
  name: string;
  /** Player-facing card description — the full mechanical effect, in plain language. */
  description: string;
  /** "gold" only. */
  goldAmount?: number;
  /** "equipment" only — an id from `data/equipment.ts`. */
  equipmentId?: string;
  /** "structure" only — an id from `data/structures.ts`. */
  structureId?: string;
}

export const REGION_BONUS_POOLS: Record<string, RegionBonusOption[]> = {
  "emberford-reach": [
    { id: "emberford-bonus-gold", category: "gold", name: "Forge-Master's Purse", description: "+15 starting gold.", goldAmount: 15 },
    { id: "emberford-bonus-gold-2", category: "gold", name: "Cinderworks Bonus", description: "+25 starting gold.", goldAmount: 25 },
    { id: "emberford-bonus-equipment-1", category: "equipment", name: "Iron Buckler", description: "A hero with a free chest slot starts equipped with an Iron Buckler (+2 AC).", equipmentId: "iron-buckler" },
    { id: "emberford-bonus-equipment-2", category: "equipment", name: "Swift Greaves", description: "A hero with a free legs slot starts equipped with Swift Greaves (+1 AC).", equipmentId: "swift-greaves" },
    { id: "emberford-bonus-structure-1", category: "structure", name: "Ready Barricade", description: "A Barricade is already standing on the field when the battle begins.", structureId: "barricade" },
    { id: "emberford-bonus-structure-2", category: "structure", name: "Ready Spike Trap", description: "A Spike Trap is already set on the field when the battle begins.", structureId: "spike-trap" },
  ],
  "shattered-causeway": [
    { id: "causeway-bonus-gold", category: "gold", name: "Canyon Toll", description: "+20 starting gold.", goldAmount: 20 },
    { id: "causeway-bonus-gold-2", category: "gold", name: "Toll Collector's Cut", description: "+30 starting gold.", goldAmount: 30 },
    { id: "causeway-bonus-equipment-1", category: "equipment", name: "Leather Cap", description: "A hero with a free head slot starts equipped with a Leather Cap (+1 AC).", equipmentId: "leather-cap" },
    { id: "causeway-bonus-equipment-2", category: "equipment", name: "Boots of Striding", description: "A hero with a free footwear slot starts equipped with Boots of Striding (+1 AC).", equipmentId: "boots-of-striding" },
    { id: "causeway-bonus-structure-1", category: "structure", name: "Bridgehead Bulwark", description: "A Bulwark (a tough wall) is already standing on the field when the battle begins.", structureId: "bulwark" },
    { id: "causeway-bonus-structure-2", category: "structure", name: "Ready Mangler Trap", description: "A Mangler Trap is already set on the field when the battle begins.", structureId: "mangler-trap" },
  ],
  "cinderfall-rift": [
    { id: "cinderfall-bonus-gold", category: "gold", name: "Warband's Cache", description: "+25 starting gold.", goldAmount: 25 },
    { id: "cinderfall-bonus-gold-2", category: "gold", name: "Warlord's Bounty", description: "+40 starting gold.", goldAmount: 40 },
    { id: "cinderfall-bonus-equipment-1", category: "equipment", name: "Circlet of Focus", description: "A hero with a free head slot starts equipped with a Circlet of Focus (+1 AC, +1 basic-attack damage).", equipmentId: "circlet-of-focus" },
    { id: "cinderfall-bonus-equipment-2", category: "equipment", name: "Traveler's Cloak", description: "A hero with a free legs slot starts equipped with a Traveler's Cloak (+1 AC, +1 basic-attack damage).", equipmentId: "travelers-cloak" },
    { id: "cinderfall-bonus-structure-1", category: "structure", name: "Ready Portcullis", description: "A Portcullis (a tough gate) is already standing on the field when the battle begins.", structureId: "portcullis" },
    { id: "cinderfall-bonus-structure-2", category: "structure", name: "Set Bear Trap", description: "A Bear Trap is already set on the field when the battle begins.", structureId: "bear-trap" },
  ],
  "drowning-vale": [
    { id: "drowning-vale-bonus-gold", category: "gold", name: "Sunken Hoard", description: "+30 starting gold.", goldAmount: 30 },
    { id: "drowning-vale-bonus-gold-2", category: "gold", name: "Silt-Buried Reliquary", description: "+45 starting gold.", goldAmount: 45 },
    { id: "drowning-vale-bonus-equipment-1", category: "equipment", name: "Amulet of Fury", description: "A hero with a free amulet slot starts equipped with an Amulet of Fury (+2 basic-attack damage).", equipmentId: "amulet-of-fury" },
    { id: "drowning-vale-bonus-equipment-2", category: "equipment", name: "Boots of the Brawler", description: "A hero with a free footwear slot starts equipped with Boots of the Brawler (+1 AC, +1 basic-attack damage).", equipmentId: "boots-of-the-brawler" },
    { id: "drowning-vale-bonus-structure-1", category: "structure", name: "Ready Watchtower", description: "A Watchtower is already standing on the field when the battle begins — any hero on it deals +1 basic-attack damage.", structureId: "watchtower" },
    { id: "drowning-vale-bonus-structure-2", category: "structure", name: "Set Frost Trap", description: "A Frost Trap is already set on the field when the battle begins.", structureId: "frost-trap" },
  ],
  "saltmere-shallows": [
    { id: "saltmere-bonus-gold", category: "gold", name: "Tideflat Salvage", description: "+35 starting gold.", goldAmount: 35 },
    { id: "saltmere-bonus-gold-2", category: "gold", name: "Wreck Diver's Share", description: "+50 starting gold.", goldAmount: 50 },
    { id: "saltmere-bonus-equipment-1", category: "equipment", name: "Whetstone Band", description: "A hero with a free ring slot starts equipped with a Whetstone Band (+2 basic-attack damage).", equipmentId: "whetstone-band" },
    { id: "saltmere-bonus-equipment-2", category: "equipment", name: "Chainmail Vest", description: "A hero with a free chest slot starts equipped with a Chainmail Vest (+3 AC).", equipmentId: "chainmail-vest" },
    { id: "saltmere-bonus-structure-1", category: "structure", name: "Ready Sky Snare", description: "A Sky Snare is already set on the field when the battle begins.", structureId: "sky-snare" },
    { id: "saltmere-bonus-structure-2", category: "structure", name: "Ready War Dais", description: "A War Dais is already standing on the field when the battle begins — a melee hero on it deals +4 basic-attack damage.", structureId: "war-dais" },
  ],
  "frostbound-hollow": [
    { id: "frostbound-bonus-gold", category: "gold", name: "Hollow King's Toll", description: "+45 starting gold.", goldAmount: 45 },
    { id: "frostbound-bonus-gold-2", category: "gold", name: "King's Ransom", description: "+65 starting gold.", goldAmount: 65 },
    { id: "frostbound-bonus-equipment-1", category: "equipment", name: "Band of Vigor", description: "A hero with a free ring slot starts equipped with a Band of Vigor (+1 AC, +1 basic-attack damage).", equipmentId: "band-of-vigor" },
    { id: "frostbound-bonus-equipment-2", category: "equipment", name: "Amulet of Warding", description: "A hero with a free amulet slot starts equipped with an Amulet of Warding (+2 AC).", equipmentId: "amulet-of-warding" },
    { id: "frostbound-bonus-structure-1", category: "structure", name: "Ready Storm Lance", description: "A Storm Lance is already set on the field when the battle begins — a strong anti-air trap.", structureId: "storm-lance" },
    { id: "frostbound-bonus-structure-2", category: "structure", name: "Ready Sky Bastion", description: "A Sky Bastion is already standing on the field when the battle begins — a ranged hero on it deals +1 basic-attack damage and gets +1 range.", structureId: "sky-bastion" },
  ],
};

/** Look up a region's bonus pool, throwing on an unknown id — matches `getCampaignDefinition`'s convention. */
export function getRegionBonusPool(campaignId: string): RegionBonusOption[] {
  const pool = REGION_BONUS_POOLS[campaignId];
  if (!pool) throw new Error(`No region bonus pool for campaign "${campaignId}".`);
  return pool;
}
