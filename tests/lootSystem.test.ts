import { describe, it, expect } from "vitest";
import { RandomService } from "../src/game/systems/RandomService";
import { rollLootDrop, isPotionId } from "../src/game/systems/LootSystem";
import { getEquipmentDefinition, parseEnchantedItemId } from "../src/game/data/equipment";
import { getPotionDefinition } from "../src/game/data/potions";

/**
 * Phase 22 (magic-item expansion): LootSystem's pure, seedable drop engine.
 * Kevin's own spec, verified behaviorally: most minions drop nothing, a
 * boss/legendary always drops something, an occasional lucky one-tier-up
 * drop happens, and every dropped id actually resolves to a real potion or
 * equipment item.
 */

describe("LootSystem.rollLootDrop", () => {
  it("a minion usually drops nothing (fixed() above the drop-chance threshold)", () => {
    // fixed(rollPercent) is used for BOTH the drop-chance roll and the
    // tier-up roll — a value >= the minion drop chance (12) fails it outright.
    expect(rollLootDrop("minion", RandomService.fixed(50))).toBeNull();
  });

  it("a boss usually drops something (90% drop chance — a low roll clears the threshold)", () => {
    const result = rollLootDrop("boss", RandomService.fixed(0));
    expect(result).not.toBeNull();
  });

  it("a legendary enemy always drops something", () => {
    const result = rollLootDrop("legendary", RandomService.fixed(99));
    expect(result).not.toBeNull();
  });

  it("an enemy with no role at all is treated as a minion", () => {
    // fixed(50) fails the minion drop-chance check (50 >= 12).
    expect(rollLootDrop(undefined, RandomService.fixed(50))).toBeNull();
  });

  it("a minion CAN drop when the roll lands under its drop chance", () => {
    const result = rollLootDrop("minion", RandomService.fixed(0));
    expect(result).not.toBeNull();
    expect(result?.rarity).toBeDefined();
  });

  it("every dropped itemId resolves to a real potion or equipment definition", () => {
    for (let seed = 0; seed < 200; seed++) {
      const random = RandomService.seeded(seed);
      const result = rollLootDrop("legendary", random); // always drops, exercises the widest pool
      if (!result) continue;
      if (isPotionId(result.itemId)) {
        expect(getPotionDefinition(result.itemId).id).toBe(result.itemId);
      } else {
        expect(getEquipmentDefinition(result.itemId).rarity).toBe(result.rarity);
      }
    }
  });

  it("a rolled enchanted item's level matches its rarity tier (uncommon=+1, rare=+2, veryRare=+3)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = rollLootDrop("boss", RandomService.seeded(seed)); // base rarity "rare"
      if (!result) continue;
      const parsed = parseEnchantedItemId(result.itemId);
      if (!parsed) continue;
      if (result.rarity === "uncommon") expect(parsed.level).toBe(1);
      if (result.rarity === "rare") expect(parsed.level).toBe(2);
      if (result.rarity === "veryRare") expect(parsed.level).toBe(3);
    }
  });

  it("a restricted pool (campaign-curated) only ever names an id from that pool, in the named-item branch", () => {
    // A minion's drop rarity is always "common" or (one tier up) "uncommon" —
    // covering both so the fallback-on-empty-intersection rule never masks
    // a real restriction violation in this test.
    const restricted = ["potion-of-healing", "cape-of-billowing", "potion-of-greater-healing", "cloak-of-protection"];
    for (let seed = 0; seed < 200; seed++) {
      const result = rollLootDrop("minion", RandomService.seeded(seed), restricted);
      if (!result) continue;
      if (parseEnchantedItemId(result.itemId)) continue; // the enchant branch is deliberately NOT restricted
      expect(restricted).toContain(result.itemId);
    }
  });

  it("an empty/irrelevant restriction falls back to the full pool rather than stranding a drop", () => {
    // "not-a-real-item" never matches anything at any rarity — the restricted
    // set is always empty, so namedPoolFor must fall back to the full pool.
    let sawADrop = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = rollLootDrop("legendary", RandomService.seeded(seed), ["not-a-real-item"]);
      if (result) sawADrop = true;
    }
    expect(sawADrop).toBe(true);
  });
});

describe("isPotionId", () => {
  it("distinguishes potions from equipment", () => {
    expect(isPotionId("healing-draught")).toBe(true);
    expect(isPotionId("cape-of-billowing")).toBe(false);
  });
});
