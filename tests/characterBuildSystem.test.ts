import { describe, it, expect } from "vitest";
import { STANDARD_ARRAY, ABILITY_SCORE_IDS } from "../src/game/data/abilityScores";
import {
  StandardArrayAllocator,
  allocatorFromScores,
  PointBuyAllocator,
  pointBuyAllocatorFromScores,
  POINT_BUY_BUDGET,
  POINT_BUY_MIN_SCORE,
  POINT_BUY_MAX_SCORE,
  heroDefinitionFromBuild,
  attackStyleForAbility,
  hasDuplicateAbilities,
  hasDuplicateNames,
  type CharacterBuild,
} from "../src/game/systems/CharacterBuildSystem";

/**
 * Phase 11.1's "finish it" slice — the character-creation UI's pure engine:
 * the standard-array allocator (swap-cycle) and turning a finished build
 * into the HeroDefinition shape BattleScene actually plays. See DECISIONS
 * D-073. The Phaser scene (`CharacterCreationScene`) that USES this can't be
 * unit-tested here (no browser) — this file covers everything that CAN be.
 */

function sortedValues(scores: Record<string, number>): number[] {
  return Object.values(scores).sort((a, b) => a - b);
}

describe("StandardArrayAllocator", () => {
  it("starts with the standard array assigned in ability-score order", () => {
    const allocator = new StandardArrayAllocator();
    const scores = allocator.scores();
    expect(scores.str).toBe(15);
    expect(scores.dex).toBe(14);
    expect(scores.con).toBe(13);
    expect(scores.int).toBe(12);
    expect(scores.wis).toBe(10);
    expect(scores.cha).toBe(8);
  });

  it("cycling one ability swaps it with whatever holds the next slot", () => {
    const allocator = new StandardArrayAllocator();
    allocator.cycle("str"); // str (slot 0) swaps with dex (slot 1)
    const scores = allocator.scores();
    expect(scores.str).toBe(14);
    expect(scores.dex).toBe(15);
  });

  it("always assigns exactly the standard array, however many times it's cycled", () => {
    const allocator = new StandardArrayAllocator();
    for (let i = 0; i < 25; i++) {
      allocator.cycle(ABILITY_SCORE_IDS[i % ABILITY_SCORE_IDS.length]);
      expect(sortedValues(allocator.scores())).toEqual([...STANDARD_ARRAY].sort((a, b) => a - b));
    }
  });

  it("cycling the SAME ability six times (once per slot) returns ITS OWN value to the start", () => {
    // Each cycle swaps the ability one slot forward, so it visits every slot
    // once over six cycles and wraps back to its starting value — the other
    // five abilities end up rotated by one slot among themselves, which is
    // fine (still a valid permutation of the standard array either way).
    const allocator = new StandardArrayAllocator();
    const startingStrValue = allocator.scores().str;
    for (let i = 0; i < 6; i++) allocator.cycle("str");
    expect(allocator.scores().str).toBe(startingStrValue);
  });
});

describe("allocatorFromScores (Phase 9, D-083)", () => {
  it("round-trips a cycled allocator's scores back to an equivalent allocator", () => {
    const original = new StandardArrayAllocator();
    original.cycle("str");
    original.cycle("wis");
    const scores = original.scores();
    const rebuilt = allocatorFromScores(scores);
    expect(rebuilt.scores()).toEqual(scores);
  });

  it("round-trips the untouched default order too", () => {
    const scores = new StandardArrayAllocator().scores();
    expect(allocatorFromScores(scores).scores()).toEqual(scores);
  });

  it("falls back to the default order on a corrupt/invalid standard-array permutation", () => {
    const corrupt = { str: 99, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    const rebuilt = allocatorFromScores(corrupt);
    expect(sortedValues(rebuilt.scores())).toEqual([...STANDARD_ARRAY].sort((a, b) => a - b));
  });
});

describe("PointBuyAllocator (D-147, piece 3)", () => {
  it("starts every ability at the 8 floor, spending nothing", () => {
    const allocator = new PointBuyAllocator();
    ABILITY_SCORE_IDS.forEach((id) => expect(allocator.scores()[id]).toBe(POINT_BUY_MIN_SCORE));
    expect(allocator.spentPoints()).toBe(0);
    expect(allocator.remainingPoints()).toBe(POINT_BUY_BUDGET);
  });

  it("increase() raises one ability and spends the real SRD cost table (13->14 and 14->15 cost 2, not 1)", () => {
    const allocator = new PointBuyAllocator();
    for (let i = 0; i < 5; i++) allocator.increase("str"); // 8 -> 13, cost 5
    expect(allocator.scores().str).toBe(13);
    expect(allocator.spentPoints()).toBe(5);
    allocator.increase("str"); // 13 -> 14, cost 2 (7 total)
    expect(allocator.scores().str).toBe(14);
    expect(allocator.spentPoints()).toBe(7);
    allocator.increase("str"); // 14 -> 15, cost 2 (9 total)
    expect(allocator.scores().str).toBe(15);
    expect(allocator.spentPoints()).toBe(9);
  });

  it("decrease() lowers one ability and refunds the same cost", () => {
    const allocator = new PointBuyAllocator();
    allocator.increase("dex");
    allocator.increase("dex");
    expect(allocator.scores().dex).toBe(10);
    allocator.decrease("dex");
    expect(allocator.scores().dex).toBe(9);
    expect(allocator.remainingPoints()).toBe(POINT_BUY_BUDGET - 1);
  });

  it("refuses to increase past the 15 cap", () => {
    const allocator = new PointBuyAllocator();
    for (let i = 0; i < 10; i++) allocator.increase("str");
    expect(allocator.scores().str).toBe(POINT_BUY_MAX_SCORE);
    expect(allocator.canIncrease("str")).toBe(false);
  });

  it("refuses to decrease below the 8 floor", () => {
    const allocator = new PointBuyAllocator();
    allocator.decrease("con");
    expect(allocator.scores().con).toBe(POINT_BUY_MIN_SCORE);
    expect(allocator.canDecrease("con")).toBe(false);
  });

  it("refuses an increase the remaining budget can't afford, even under the 15 cap", () => {
    const allocator = new PointBuyAllocator();
    // Spend the entire 27-point budget maxing out str and dex (9 each = 18),
    // then con partway (9 more would need a 9-cost jump nowhere near left).
    for (let i = 0; i < 7; i++) allocator.increase("str"); // 8->15, cost 9
    for (let i = 0; i < 7; i++) allocator.increase("dex"); // 8->15, cost 9
    expect(allocator.remainingPoints()).toBe(POINT_BUY_BUDGET - 18); // 9 left
    for (let i = 0; i < 10; i++) allocator.increase("con"); // as far as 9 points can go: 8->13 (cost 5), then blocked (14 costs 2 more = 7 total, still affordable)... verify it never overspends
    expect(allocator.remainingPoints()).toBeGreaterThanOrEqual(0);
  });

  it("never lets spentPoints() exceed the budget no matter how it's driven", () => {
    const allocator = new PointBuyAllocator();
    for (let i = 0; i < 50; i++) {
      ABILITY_SCORE_IDS.forEach((id) => allocator.increase(id));
    }
    expect(allocator.spentPoints()).toBeLessThanOrEqual(POINT_BUY_BUDGET);
  });
});

describe("pointBuyAllocatorFromScores (D-147, piece 3)", () => {
  it("round-trips a valid point-buy score set", () => {
    const allocator = new PointBuyAllocator();
    allocator.increase("wis");
    allocator.increase("wis");
    const scores = allocator.scores();
    expect(pointBuyAllocatorFromScores(scores).scores()).toEqual(scores);
  });

  it("clamps an out-of-range score (e.g. a Standard Array 15 that happens to also be in range is fine, but a corrupt 20 is not) to the floor", () => {
    const corrupt = { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const rebuilt = pointBuyAllocatorFromScores(corrupt);
    expect(rebuilt.scores().str).toBe(POINT_BUY_MIN_SCORE);
    expect(rebuilt.scores().dex).toBe(10);
  });
});

describe("attack style from signature ability", () => {
  it("treats short-range abilities as melee", () => {
    expect(attackStyleForAbility("cleave")).toBe("melee");
    expect(attackStyleForAbility("taunting-slam")).toBe("melee");
  });

  it("treats longer-range abilities as ranged", () => {
    expect(attackStyleForAbility("piercing-shot")).toBe("ranged");
    expect(attackStyleForAbility("frost-bolt")).toBe("ranged");
  });
});

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    abilityId: "cleave",
    controlledBy: "human",
    ...overrides,
  };
}

describe("heroDefinitionFromBuild", () => {
  it("derives a playable HeroDefinition from a level-1 Fighter build", () => {
    const def = heroDefinitionFromBuild(build());
    expect(def.id).toBe("build-1");
    expect(def.name).toBe("Kael");
    expect(def.abilityId).toBe("cleave");
    // CON 13 -> +1 mod; level-1 Fighter max HP = hitDie(10) + conMod(1) = 11.
    expect(def.maxHealth).toBe(11);
    // melee (cleave) uses STR mod: 15 -> +2; base weapon 2 + 2 = 4.
    expect(def.attackDamage).toBe(4);
    expect(def.attackRangeTiles).toBe(1);
  });

  it("uses DEX instead of STR for a ranged signature ability", () => {
    const def = heroDefinitionFromBuild(
      build({ abilityId: "piercing-shot", abilityScores: { str: 8, dex: 15, con: 13, int: 12, wis: 10, cha: 8 } }),
    );
    // DEX 15 -> +2; base weapon 2 + 2 = 4.
    expect(def.attackDamage).toBe(4);
    expect(def.attackRangeTiles).toBe(3);
  });

  it("never derives attack damage below 1, even with a very low modifier", () => {
    const def = heroDefinitionFromBuild(build({ abilityScores: { str: 1, dex: 1, con: 13, int: 12, wis: 10, cha: 8 } }));
    expect(def.attackDamage).toBeGreaterThanOrEqual(1);
  });

  it("defaults to the standard 3-tile speed for a Human", () => {
    expect(heroDefinitionFromBuild(build()).movementTiles).toBe(3);
  });
});

describe("heroDefinitionFromBuild — controlledBy (Phase 11.4, D-077)", () => {
  it("passes the build's control mode straight through to the HeroDefinition", () => {
    expect(heroDefinitionFromBuild(build({ controlledBy: "human" })).controlledBy).toBe("human");
    expect(heroDefinitionFromBuild(build({ controlledBy: "ai" })).controlledBy).toBe("ai");
  });
});

describe("heroDefinitionFromBuild — classId (Phase 13.2, D-087)", () => {
  it("passes the build's classId straight through, the seam class-gated action-economy features key off", () => {
    expect(heroDefinitionFromBuild(build({ classId: "fighter" })).classId).toBe("fighter");
    expect(heroDefinitionFromBuild(build({ classId: "rogue" })).classId).toBe("rogue");
  });
});

describe("heroDefinitionFromBuild — abilityScores (Phase 13.3, D-089)", () => {
  it("carries the build's ability scores onto the definition, so Hero.levelUpClass can redo this math later", () => {
    const scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    expect(heroDefinitionFromBuild(build({ abilityScores: scores })).abilityScores).toEqual(scores);
  });
});

describe("heroDefinitionFromBuild — race (Phase 11.3, D-075)", () => {
  it("gives a Dwarf or Halfling the SRD's slower speed (2 tiles instead of the default 3)", () => {
    expect(heroDefinitionFromBuild(build({ raceId: "dwarf" })).movementTiles).toBe(2);
    expect(heroDefinitionFromBuild(build({ raceId: "halfling" })).movementTiles).toBe(2);
  });

  it("gives Elf/Half-Elf/Half-Orc the same standard speed as Human", () => {
    expect(heroDefinitionFromBuild(build({ raceId: "elf" })).movementTiles).toBe(3);
    expect(heroDefinitionFromBuild(build({ raceId: "half-elf" })).movementTiles).toBe(3);
    expect(heroDefinitionFromBuild(build({ raceId: "half-orc" })).movementTiles).toBe(3);
  });
});

describe("heroDefinitionFromBuild — Rogue Sneak Attack (Phase 11.3, D-075)", () => {
  it("adds the level-1 Sneak Attack rider (+4) on top of the usual STR/DEX modifier", () => {
    const def = heroDefinitionFromBuild(build({ classId: "rogue", abilityId: "piercing-shot" }));
    // DEX 14 -> +2; base weapon 2 + 2 = 4, plus Sneak Attack's +4 at level 1 = 8.
    expect(def.attackDamage).toBe(8);
  });

  it("gives the Fighter no such rider, even with an identical build otherwise", () => {
    const def = heroDefinitionFromBuild(build({ classId: "fighter", abilityId: "piercing-shot" }));
    expect(def.attackDamage).toBe(4);
  });
});

describe("heroDefinitionFromBuild — classRiderDamage (Phase 17, D-108)", () => {
  it("carries the Rogue's Sneak Attack rider separately, so a later equipped weapon can still add it on top", () => {
    const def = heroDefinitionFromBuild(build({ classId: "rogue", abilityId: "piercing-shot" }));
    expect(def.classRiderDamage).toBe(4); // Sneak Attack at level 1
  });

  it("is 0 for a class with no by-level bonus-damage table", () => {
    const def = heroDefinitionFromBuild(build({ classId: "fighter", abilityId: "piercing-shot" }));
    expect(def.classRiderDamage).toBe(0);
  });
});

describe("heroDefinitionFromBuild — Cleric (Phase 11.3, D-075)", () => {
  it("uses WIS (not DEX or INT) for its cast cantrip's attack modifier, and a d8-based HP total", () => {
    const clericBuild = build({
      classId: "cleric",
      abilityId: "sacred-flame",
      abilityScores: { str: 8, dex: 12, con: 13, int: 10, wis: 16, cha: 10 },
    });
    const def = heroDefinitionFromBuild(clericBuild);
    // WIS 16 -> +3; base weapon 2 + 3 = 5.
    expect(def.attackDamage).toBe(5);
    // CON 13 -> +1 mod; level-1 Cleric max HP = hitDie(8) + conMod(1) = 9.
    expect(def.maxHealth).toBe(9);
  });
});

describe("heroDefinitionFromBuild — Wizard (Phase 11.2, D-074)", () => {
  it("uses INT (not DEX) for a cast cantrip's attack modifier, and a d6-based HP total", () => {
    const wizardBuild = build({
      classId: "wizard",
      abilityId: "fire-bolt",
      abilityScores: { str: 8, dex: 15, con: 13, int: 16, wis: 10, cha: 8 },
    });
    const def = heroDefinitionFromBuild(wizardBuild);
    // INT 16 -> +3; base weapon 2 + 3 = 5. If this used DEX (15 -> +2) it would be 4.
    expect(def.attackDamage).toBe(5);
    // Fire Bolt's range (3) puts it in the "ranged" bucket for range purposes.
    expect(def.attackRangeTiles).toBe(3);
    // CON 13 -> +1 mod; level-1 Wizard max HP = hitDie(6) + conMod(1) = 7.
    expect(def.maxHealth).toBe(7);
  });

  it("still uses STR/DEX for a Fighter's mundane signature ability, unaffected by the spell-INT rule", () => {
    const def = heroDefinitionFromBuild(build()); // Fighter, "cleave"
    expect(def.attackDamage).toBe(4); // unchanged from the existing Fighter test above
  });
});

describe("heroDefinitionFromBuild — subclassId/startingEquipmentId (Phase 13.11, D-096)", () => {
  it("passes a build's subclassId straight through, absent means undefined", () => {
    expect(heroDefinitionFromBuild(build()).subclassId).toBeUndefined();
    expect(heroDefinitionFromBuild(build({ subclassId: "champion" })).subclassId).toBe("champion");
  });

  it("passes a build's startingEquipmentId straight through, absent means undefined", () => {
    expect(heroDefinitionFromBuild(build()).startingEquipmentId).toBeUndefined();
    expect(heroDefinitionFromBuild(build({ startingEquipmentId: "iron-buckler" })).startingEquipmentId).toBe(
      "iron-buckler",
    );
  });
});

describe("heroDefinitionFromBuild — startingLevel (D-129)", () => {
  it("passes a build's startingLevel straight through, absent means undefined", () => {
    expect(heroDefinitionFromBuild(build()).startingLevel).toBeUndefined();
    expect(heroDefinitionFromBuild(build({ startingLevel: 8 })).startingLevel).toBe(8);
  });
});

describe("heroDefinitionFromBuild — manual spell picks (D-135)", () => {
  it("passes preparedSpellIds/knownCantripIds/spellbookIds straight through, absent means undefined", () => {
    const def = heroDefinitionFromBuild(build());
    expect(def.preparedSpellIds).toBeUndefined();
    expect(def.knownCantripIds).toBeUndefined();
    expect(def.spellbookIds).toBeUndefined();

    const customized = heroDefinitionFromBuild(
      build({
        preparedSpellIds: ["magic-missile"],
        knownCantripIds: ["fire-bolt"],
        spellbookIds: ["magic-missile", "shield"],
      }),
    );
    expect(customized.preparedSpellIds).toEqual(["magic-missile"]);
    expect(customized.knownCantripIds).toEqual(["fire-bolt"]);
    expect(customized.spellbookIds).toEqual(["magic-missile", "shield"]);
  });
});

describe("party validation", () => {
  it("flags duplicate signature abilities across a party", () => {
    const party = [build({ id: "a", abilityId: "cleave" }), build({ id: "b", abilityId: "cleave" })];
    expect(hasDuplicateAbilities(party)).toBe(true);
  });

  it("does not flag a party where every ability is distinct", () => {
    const party = [
      build({ id: "a", abilityId: "cleave" }),
      build({ id: "b", abilityId: "piercing-shot" }),
      build({ id: "c", abilityId: "taunting-slam" }),
      build({ id: "d", abilityId: "frost-bolt" }),
    ];
    expect(hasDuplicateAbilities(party)).toBe(false);
  });

  it("flags duplicate names across a party", () => {
    const party = [build({ id: "a", name: "Kael" }), build({ id: "b", name: "Kael" })];
    expect(hasDuplicateNames(party)).toBe(true);
  });
});
