import { describe, it, expect } from "vitest";
import { FEATS, FEAT_IDS, getFeat, hitPointBonusFromFeat } from "../src/game/data/feats";

/**
 * Phase 11.3's starter feat list (DECISIONS D-071/D-075), now reachable via
 * Phase 13.6's ASI-or-feat choice (D-091). See the module comment in
 * `data/feats.ts`.
 *
 * Phase 18 (D-109) adds every remaining SRD 5.2.1 feat (13 net-new) and
 * corrects Tough/Lucky/Athlete's own attribution (they turned out to be
 * PHB-exclusive, not actually in the free SRD — only Alert was).
 */

describe("FEATS", () => {
  it("registers at least Tough, Alert, Lucky, and Athlete", () => {
    expect(FEAT_IDS).toContain("tough");
    expect(FEAT_IDS).toContain("alert");
    expect(FEAT_IDS).toContain("lucky");
    expect(FEAT_IDS).toContain("athlete");
  });

  it("registers all 13 Phase 18 (D-109) feats", () => {
    expect(FEAT_IDS).toContain("magic-initiate");
    expect(FEAT_IDS).toContain("savage-attacker");
    expect(FEAT_IDS).toContain("skilled");
    expect(FEAT_IDS).toContain("grappler");
    expect(FEAT_IDS).toContain("archery");
    expect(FEAT_IDS).toContain("defense");
    expect(FEAT_IDS).toContain("great-weapon-fighting");
    expect(FEAT_IDS).toContain("two-weapon-fighting");
    expect(FEAT_IDS).toContain("boon-of-combat-prowess");
    expect(FEAT_IDS).toContain("boon-of-dimensional-travel");
    expect(FEAT_IDS).toContain("boon-of-fate");
    expect(FEAT_IDS).toContain("boon-of-irresistible-offense");
    expect(FEAT_IDS).toContain("boon-of-spell-recall");
    expect(FEAT_IDS).toContain("boon-of-the-night-spirit");
    expect(FEAT_IDS).toContain("boon-of-truesight");
  });

  it("throws on an unknown feat id", () => {
    expect(() => getFeat("nonexistent")).toThrow();
  });
});

describe("Phase 18 (D-109) feat categories", () => {
  it("assigns the SRD's real category to every feat", () => {
    expect(FEATS.tough.category).toBe("origin");
    expect(FEATS.alert.category).toBe("origin");
    expect(FEATS.lucky.category).toBe("origin");
    expect(FEATS.athlete.category).toBe("general");
    expect(FEATS["magic-initiate"].category).toBe("origin");
    expect(FEATS["savage-attacker"].category).toBe("origin");
    expect(FEATS.skilled.category).toBe("origin");
    expect(FEATS.grappler.category).toBe("general");
    expect(FEATS.archery.category).toBe("fightingStyle");
    expect(FEATS.defense.category).toBe("fightingStyle");
    expect(FEATS["great-weapon-fighting"].category).toBe("fightingStyle");
    expect(FEATS["two-weapon-fighting"].category).toBe("fightingStyle");
    expect(FEATS["boon-of-combat-prowess"].category).toBe("epicBoon");
    expect(FEATS["boon-of-truesight"].category).toBe("epicBoon");
  });

  it("marks Magic Initiate (and only Magic Initiate) as repeatable", () => {
    expect(FEATS["magic-initiate"].repeatable).toBe(true);
    expect(FEATS.tough.repeatable).toBeUndefined();
    expect(FEATS.grappler.repeatable).toBeUndefined();
    expect(FEATS["boon-of-fate"].repeatable).toBeUndefined();
  });

  it("gives Skilled (and 3 Epic Boons) no mechanical hookup", () => {
    expect(FEATS.skilled.mechanicallyActive).toBe(false);
    expect(FEATS["boon-of-dimensional-travel"].mechanicallyActive).toBe(false);
    expect(FEATS["boon-of-the-night-spirit"].mechanicallyActive).toBe(false);
    expect(FEATS["boon-of-truesight"].mechanicallyActive).toBe(false);
  });

  it("gives every real hookup feat a mechanicallyActive flag", () => {
    expect(FEATS["magic-initiate"].mechanicallyActive).toBe(true);
    expect(FEATS["savage-attacker"].mechanicallyActive).toBe(true);
    expect(FEATS.grappler.mechanicallyActive).toBe(true);
    expect(FEATS.archery.mechanicallyActive).toBe(true);
    expect(FEATS.defense.mechanicallyActive).toBe(true);
    expect(FEATS["great-weapon-fighting"].mechanicallyActive).toBe(true);
    // Phase 19 (D-110): Two-Weapon Fighting flipped active once real
    // dual-wielding existed for it to hook into.
    expect(FEATS["two-weapon-fighting"].mechanicallyActive).toBe(true);
    expect(FEATS["boon-of-combat-prowess"].mechanicallyActive).toBe(true);
    expect(FEATS["boon-of-fate"].mechanicallyActive).toBe(true);
    expect(FEATS["boon-of-irresistible-offense"].mechanicallyActive).toBe(true);
    expect(FEATS["boon-of-spell-recall"].mechanicallyActive).toBe(true);
  });

  it("gates Grappler on level 4+ and Str-or-Dex 13+", () => {
    expect(FEATS.grappler.prerequisite?.minLevel).toBe(4);
    expect(FEATS.grappler.prerequisite?.minAbilityScoreAnyOf).toEqual([
      { ability: "str", score: 13 },
      { ability: "dex", score: 13 },
    ]);
  });

  it("gates every Fighting Style feat on requiresFightingStyleFeature", () => {
    expect(FEATS.archery.prerequisite?.requiresFightingStyleFeature).toBe(true);
    expect(FEATS.defense.prerequisite?.requiresFightingStyleFeature).toBe(true);
    expect(FEATS["great-weapon-fighting"].prerequisite?.requiresFightingStyleFeature).toBe(true);
    expect(FEATS["two-weapon-fighting"].prerequisite?.requiresFightingStyleFeature).toBe(true);
  });

  it("gates every Epic Boon on level 19+, and Boon of Spell Recall additionally on a spellcasting feature", () => {
    expect(FEATS["boon-of-combat-prowess"].prerequisite?.minLevel).toBe(19);
    expect(FEATS["boon-of-truesight"].prerequisite?.minLevel).toBe(19);
    expect(FEATS["boon-of-spell-recall"].prerequisite?.minLevel).toBe(19);
    expect(FEATS["boon-of-spell-recall"].prerequisite?.requiresSpellcastingFeature).toBe(true);
  });

  it("caps every Epic Boon's ability-score boost at 30, and Grappler's at 20", () => {
    expect(FEATS.grappler.abilityScoreBoost?.hardCap).toBe(20);
    expect(FEATS["boon-of-combat-prowess"].abilityScoreBoost?.hardCap).toBe(30);
    expect(FEATS["boon-of-irresistible-offense"].abilityScoreBoost?.allowedAbilities).toEqual(["str", "dex"]);
    expect(FEATS["boon-of-spell-recall"].abilityScoreBoost?.allowedAbilities).toEqual(["int", "wis", "cha"]);
  });
});

describe("hitPointBonusFromFeat", () => {
  it("gives Tough +2 HP per level", () => {
    expect(hitPointBonusFromFeat(getFeat("tough"), 1)).toBe(2);
    expect(hitPointBonusFromFeat(getFeat("tough"), 5)).toBe(10);
  });

  it("gives every other feat no HP bonus", () => {
    expect(hitPointBonusFromFeat(getFeat("alert"), 5)).toBe(0);
    expect(hitPointBonusFromFeat(getFeat("lucky"), 5)).toBe(0);
    expect(hitPointBonusFromFeat(getFeat("athlete"), 5)).toBe(0);
  });

  it("Tough and Lucky are mechanically active; Alert and Athlete stay inert", () => {
    expect(FEATS.tough.mechanicallyActive).toBe(true);
    expect(FEATS.alert.mechanicallyActive).toBe(false);
    expect(FEATS.lucky.mechanicallyActive).toBe(true);
    expect(FEATS.athlete.mechanicallyActive).toBe(false);
  });

  it("gives Lucky a fixed 3-point pool, and no other feat one", () => {
    expect(FEATS.lucky.luckyPoints).toBe(3);
    expect(FEATS.tough.luckyPoints).toBeUndefined();
    expect(FEATS.alert.luckyPoints).toBeUndefined();
    expect(FEATS.athlete.luckyPoints).toBeUndefined();
  });
});
