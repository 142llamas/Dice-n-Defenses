import { describe, it, expect } from "vitest";
import { Hero } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import { getAbility } from "../src/game/data/abilities";

/**
 * D-125: a second batch of stale-blocking-reason class features wired real
 * (Barbarian's Reckless Attack, Cleric's Channel Divinity: Preserve Life),
 * plus new spell-picker/skill-check/hero-stealth systems. Pure Hero-level
 * tests only — every BattleScene-only hookup (the new HUD button, its
 * combat-log line) needs Phaser and can't be unit-tested here, the same
 * standing limitation D-124's own `d124Features.test.ts` documents. The
 * Reckless Attack WaveSystem-level Advantage hookup IS pure — see the new
 * D-125 block in `tests/combat.test.ts`.
 */

function build(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    id: "build-1",
    name: "Kael",
    raceId: "human",
    classId: "fighter",
    level: 1,
    abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    controlledBy: "human",
    ...overrides,
  };
}

function heroFromBuild(overrides: Partial<CharacterBuild> = {}): Hero {
  return new Hero(heroDefinitionFromBuild(build(overrides)), { x: 0, y: 0 });
}

describe("Barbarian's Reckless Attack (D-125)", () => {
  it("is unavailable below level 2 or for any other class", () => {
    const level1 = heroFromBuild({ classId: "barbarian" });
    expect(level1.canUseRecklessAttack()).toBe(false);
    const fighter = heroFromBuild();
    fighter.levelUpClass();
    expect(fighter.canUseRecklessAttack()).toBe(false);
  });

  it("becomes available at level 2, sets both halves of the trade, and can't be re-activated the same turn", () => {
    const hero = heroFromBuild({ classId: "barbarian" });
    hero.levelUpClass();
    expect(hero.level).toBe(2);
    expect(hero.canUseRecklessAttack()).toBe(true);
    hero.activateRecklessAttack();
    expect(hero.recklessAttackAdvantage).toBe(true);
    expect(hero.grantsAttackerAdvantage).toBe(true);
    expect(hero.canUseRecklessAttack()).toBe(false);
  });

  it("does NOT cost the action or bonus action — only the toggle itself is spent", () => {
    const hero = heroFromBuild({ classId: "barbarian" });
    hero.levelUpClass();
    hero.activateRecklessAttack();
    expect(hero.canAct()).toBe(true);
    expect(hero.canUseBonusAction()).toBe(true);
  });

  it("lasts until the start of the hero's next turn (resetForNewTurn), not just the current attack", () => {
    const hero = heroFromBuild({ classId: "barbarian" });
    hero.levelUpClass();
    hero.activateRecklessAttack();
    expect(hero.grantsAttackerAdvantage).toBe(true);
    hero.resetForNewTurn();
    expect(hero.grantsAttackerAdvantage).toBe(false);
    expect(hero.canUseRecklessAttack()).toBe(true);
  });
});

describe("Cleric's Channel Divinity: Preserve Life (D-125)", () => {
  function lifeCleric(): Hero {
    return heroFromBuild({ classId: "cleric", subclassId: "life-domain" });
  }

  it("grants no uses below level 2, and none at all without the Life Domain subclass", () => {
    const level1 = lifeCleric();
    expect(level1.canUsePreserveLife()).toBe(false);
    const noSubclass = heroFromBuild({ classId: "cleric" });
    noSubclass.levelUpClass();
    expect(noSubclass.canUsePreserveLife()).toBe(false);
  });

  it("grants exactly 1/2/3 uses at levels 2/6/18, refilled on a Short OR Long Rest", () => {
    const hero = lifeCleric();
    for (let i = 1; i < 2; i++) hero.levelUpClass();
    expect(hero.level).toBe(2);
    expect(hero.channelDivinityUsesAvailable).toBe(1);
    for (let i = 2; i < 6; i++) hero.levelUpClass();
    expect(hero.channelDivinityUsesAvailable).toBe(2);
    for (let i = 6; i < 18; i++) hero.levelUpClass();
    expect(hero.channelDivinityUsesAvailable).toBe(3);
    hero.usePreserveLife([hero]);
    expect(hero.channelDivinityUsesAvailable).toBe(2);
    hero.shortRest();
    expect(hero.channelDivinityUsesAvailable).toBe(3);
  });

  it("heals every living ally, capped so none exceeds half its own max HP", () => {
    const hero = lifeCleric();
    for (let i = 1; i < 6; i++) hero.levelUpClass(); // level 6
    const heroHalf = Math.floor(hero.effectiveMaxHealth / 2);
    hero.health = 1; // far below half-max
    const ally = heroFromBuild({ classId: "fighter" });
    const allyHalf = Math.floor(ally.effectiveMaxHealth / 2);
    ally.health = allyHalf - 1; // one point short of the cap
    const healed = hero.usePreserveLife([hero, ally]);
    expect(hero.health).toBeGreaterThan(1);
    expect(hero.health).toBeLessThanOrEqual(heroHalf);
    expect(ally.health).toBe(allyHalf); // only 1 HP of room, so only 1 HP applied
    const allyResult = healed.find((h) => h.hero === ally);
    expect(allyResult?.amount).toBe(1);
  });

  it("skips (and doesn't return an entry for) an ally already at or above half its max HP", () => {
    const hero = lifeCleric();
    hero.levelUpClass();
    const half = Math.floor(hero.effectiveMaxHealth / 2);
    hero.health = half; // already exactly at the cap
    const healed = hero.usePreserveLife([hero]);
    expect(healed).toEqual([]);
    expect(hero.health).toBe(half);
  });

  it("spends the hero's action", () => {
    const hero = lifeCleric();
    hero.levelUpClass();
    hero.usePreserveLife([hero]);
    expect(hero.canAct()).toBe(false);
  });
});

describe("hero-side stealth: isHidden/hide/reveal (D-125)", () => {
  it("starts not hidden, and hide()/reveal() toggle it", () => {
    const hero = heroFromBuild();
    expect(hero.isHidden).toBe(false);
    hero.hide();
    expect(hero.isHidden).toBe(true);
    hero.reveal();
    expect(hero.isHidden).toBe(false);
  });
});

describe("Ranger's Vanish (D-125)", () => {
  it("is unavailable below level 14 or for any other class", () => {
    const ranger = heroFromBuild({ classId: "ranger" });
    for (let i = 1; i < 13; i++) ranger.levelUpClass();
    expect(ranger.canUseVanish()).toBe(false);
    const fighter = heroFromBuild();
    expect(fighter.canUseVanish()).toBe(false);
  });

  it("spends the bonus action at level 14+ regardless of the (caller-rolled) outcome", () => {
    const ranger = heroFromBuild({ classId: "ranger" });
    for (let i = 1; i < 14; i++) ranger.levelUpClass();
    expect(ranger.canUseVanish()).toBe(true);
    ranger.useVanish();
    expect(ranger.canUseBonusAction()).toBe(false);
    expect(ranger.canUseVanish()).toBe(false); // bonus action already spent
  });

  it("shares the bonus-action slot with Hunter's Mark — using one blocks the other", () => {
    const ranger = heroFromBuild({ classId: "ranger" });
    for (let i = 1; i < 14; i++) ranger.levelUpClass();
    expect(ranger.canUseHuntersMark()).toBe(true);
    ranger.useVanish();
    expect(ranger.canUseHuntersMark()).toBe(false);
  });
});

describe("Rogue's Cunning Action: Hide (D-125)", () => {
  it("is unavailable below level 2 or for any other class", () => {
    const level1 = heroFromBuild({ classId: "rogue" });
    expect(level1.canUseCunningActionHide()).toBe(false);
    expect(heroFromBuild().canUseCunningActionHide()).toBe(false); // Fighter
  });

  it("shares the bonus-action slot with Cunning Action's Dash", () => {
    const rogue = heroFromBuild({ classId: "rogue" });
    rogue.levelUpClass();
    expect(rogue.canUseCunningActionHide()).toBe(true);
    rogue.useCunningActionHide();
    expect(rogue.canUseCunningAction()).toBe(false);
  });
});

describe("Monk's Empty Body (D-125)", () => {
  it("is unavailable below level 18, for any other class, or without 4 Ki", () => {
    const monk = heroFromBuild({ classId: "monk" });
    for (let i = 1; i < 17; i++) monk.levelUpClass();
    expect(monk.canUseEmptyBody()).toBe(false);
    expect(heroFromBuild().canUseEmptyBody()).toBe(false); // Fighter
  });

  it("spends this hero's whole Ki pool and the action, and hides outright with no check", () => {
    const monk = heroFromBuild({ classId: "monk" });
    for (let i = 1; i < 18; i++) monk.levelUpClass();
    expect(monk.kiPointsAvailable).toBeGreaterThan(0);
    expect(monk.canUseEmptyBody()).toBe(true);
    monk.useEmptyBody();
    expect(monk.kiPointsAvailable).toBe(0);
    expect(monk.canAct()).toBe(false);
    expect(monk.isHidden).toBe(true);
  });
});

describe("Ranger's Hide in Plain Sight + Thief's Supreme Sneak — stealthCheckModifier/stealthCheckAdvantage (D-125)", () => {
  it("adds a flat +10 for a level-10+ Ranger that hasn't moved this turn, and nothing once it has moved", () => {
    const ranger = heroFromBuild({ classId: "ranger" });
    for (let i = 1; i < 10; i++) ranger.levelUpClass();
    const stillModifier = ranger.stealthCheckModifier();
    ranger.moveTo({ x: 1, y: 0 });
    const movedModifier = ranger.stealthCheckModifier();
    expect(stillModifier - movedModifier).toBe(10);
  });

  it("grants no Hide in Plain Sight bonus below level 10 (moving or not changes nothing)", () => {
    const lowRanger = heroFromBuild({ classId: "ranger" });
    const stillModifier = lowRanger.stealthCheckModifier();
    lowRanger.moveTo({ x: 1, y: 0 });
    expect(lowRanger.stealthCheckModifier()).toBe(stillModifier);
  });

  it("Supreme Sneak grants Advantage for a Thief that hasn't moved; Advantage disappears once it moves", () => {
    const thief = heroFromBuild({ classId: "rogue", subclassId: "thief" });
    for (let i = 1; i < 9; i++) thief.levelUpClass();
    expect(thief.stealthCheckAdvantage).toBe("advantage");
    thief.moveTo({ x: 1, y: 0 });
    expect(thief.stealthCheckAdvantage).toBe("normal");
  });

  it("is 'normal' for the SRD Rogue sibling subclass (Shadowblade, not Thief)", () => {
    const shadowblade = heroFromBuild({ classId: "rogue", subclassId: "shadowblade" });
    for (let i = 1; i < 9; i++) shadowblade.levelUpClass();
    expect(shadowblade.stealthCheckAdvantage).toBe("normal");
  });
});

describe("Wizard's Spell Mastery (D-125)", () => {
  function wizard(): Hero {
    return heroFromBuild({ classId: "wizard" });
  }

  it("is not needed below level 18", () => {
    const hero = wizard();
    for (let i = 1; i < 17; i++) hero.levelUpClass();
    expect(hero.needsSpellMasteryPick()).toBe(false);
  });

  it("is needed at level 18, offers only known spells of level 1-5, and stays needed until chosen", () => {
    const hero = wizard();
    for (let i = 1; i < 18; i++) hero.levelUpClass();
    expect(hero.needsSpellMasteryPick()).toBe(true);
    const eligible = hero.eligibleSpellMasterySpells();
    expect(eligible.length).toBeGreaterThan(0);
    for (const id of eligible) {
      const lvl = getAbility(id).spellSlotLevel;
      expect(lvl).toBeDefined();
      expect(lvl!).toBeLessThanOrEqual(5);
    }
    hero.chooseSpellMasterySpell(eligible[0]);
    expect(hero.needsSpellMasteryPick()).toBe(false);
  });

  it("makes the chosen spell castable and free forever, even with 0 slots of its level and after a Long Rest", () => {
    const hero = wizard();
    for (let i = 1; i < 18; i++) hero.levelUpClass();
    const spellId = hero.eligibleSpellMasterySpells()[0];
    const level = getAbility(spellId).spellSlotLevel!;
    // Drain real slots via the raw method (bypassing any free-use check) BEFORE choosing, so the
    // assertions below are unambiguously about the free grant, not leftover real slots.
    while (hero.spellSlotsRemainingAt(level) > 0) hero.spendSpellSlot(level);
    expect(hero.canCastSpell(spellId)).toBe(false); // not chosen yet, and no real slots left
    hero.chooseSpellMasterySpell(spellId);
    expect(hero.canCastSpell(spellId)).toBe(true);
    hero.spendSpellSlotFor(spellId, level, 0); // a free cast — should not touch the (already-0) slot pool
    expect(hero.spellSlotsRemainingAt(level)).toBe(0);
    hero.longRest();
    expect(hero.canCastSpell(spellId)).toBe(true); // still free after a rest, unlimited
  });
});

describe("Wizard's Signature Spells (D-125)", () => {
  function wizard(): Hero {
    return heroFromBuild({ classId: "wizard" });
  }

  it("is not needed below level 20", () => {
    const hero = wizard();
    for (let i = 1; i < 19; i++) hero.levelUpClass();
    expect(hero.needsSignatureSpellsPick()).toBe(false);
  });

  it("is needed at level 20, offers only known 3rd-level spells, and grants each hero its own choice", () => {
    const hero = wizard();
    for (let i = 1; i < 20; i++) hero.levelUpClass();
    expect(hero.needsSignatureSpellsPick()).toBe(true);
    const eligible = hero.eligibleSignatureSpells();
    expect(eligible.length).toBeGreaterThanOrEqual(2);
    for (const id of eligible) expect(getAbility(id).spellSlotLevel).toBe(3);
    hero.chooseSignatureSpells([eligible[0], eligible[1]]);
    expect(hero.needsSignatureSpellsPick()).toBe(false);
  });

  it("each pick casts free once per rest, even at 0 real slots, independent of the other pick", () => {
    const hero = wizard();
    for (let i = 1; i < 20; i++) hero.levelUpClass();
    const [first, second] = hero.eligibleSignatureSpells();
    hero.chooseSignatureSpells([first, second]);
    // Drain real slots directly, bypassing the free-use check, so the free
    // grant's own behavior is what's actually under test below.
    while (hero.spellSlotsRemainingAt(3) > 0) hero.spendSpellSlot(3);
    expect(hero.canCastSpell(first)).toBe(true); // free use still available at 0 real slots
    hero.spendSpellSlotFor(first, 3, 0); // spends the free use
    expect(hero.canCastSpell(first)).toBe(false); // no free use left, no real slots either
    expect(hero.canCastSpell(second)).toBe(true); // the OTHER Signature Spell is untouched
  });

  it("recharges on a Short Rest, unlike Mystic Arcanum", () => {
    const hero = wizard();
    for (let i = 1; i < 20; i++) hero.levelUpClass();
    const [first, second] = hero.eligibleSignatureSpells();
    hero.chooseSignatureSpells([first, second]);
    while (hero.spellSlotsRemainingAt(3) > 0) hero.spendSpellSlot(3);
    hero.spendSpellSlotFor(first, 3, 0);
    expect(hero.canCastSpell(first)).toBe(false);
    hero.shortRest();
    expect(hero.canCastSpell(first)).toBe(true);
  });
});

describe("Warlock's Mystic Arcanum (D-125)", () => {
  function warlock(): Hero {
    return heroFromBuild({ classId: "warlock" });
  }

  it("is not needed below its unlock level (6th tier needs level 11)", () => {
    const hero = warlock();
    for (let i = 1; i < 10; i++) hero.levelUpClass();
    expect(hero.needsMysticArcanumPick(6)).toBe(false);
  });

  it("unlocks each tier at its own level (11/13/15/17) and offers only known spells of that exact level", () => {
    const hero = warlock();
    for (let i = 1; i < 11; i++) hero.levelUpClass();
    expect(hero.needsMysticArcanumPick(6)).toBe(true);
    expect(hero.needsMysticArcanumPick(7)).toBe(false); // level 13 not reached yet
    const eligible6 = hero.eligibleMysticArcanumSpells(6);
    expect(eligible6.length).toBeGreaterThan(0);
    for (const id of eligible6) expect(getAbility(id).spellSlotLevel).toBe(6);
    hero.chooseMysticArcanumSpell(6, eligible6[0]);
    expect(hero.needsMysticArcanumPick(6)).toBe(false);
  });

  it("grants one free cast per Long Rest only — a Short Rest does NOT refill it", () => {
    const hero = warlock();
    for (let i = 1; i < 11; i++) hero.levelUpClass();
    const spellId = hero.eligibleMysticArcanumSpells(6)[0];
    hero.chooseMysticArcanumSpell(6, spellId);
    // Drain real slots directly, bypassing the free-use check, so the free
    // grant's own once-per-Long-Rest cadence is what's actually under test.
    while (hero.spellSlotsRemainingAt(6) > 0) hero.spendSpellSlot(6);
    expect(hero.canCastSpell(spellId)).toBe(true); // free use still available at 0 real slots
    hero.spendSpellSlotFor(spellId, 6, 0);
    expect(hero.canCastSpell(spellId)).toBe(false);
    // A Warlock's OWN Pact Magic slots fully refill on a Short Rest — a
    // real, pre-existing, unrelated mechanic (Hero.shortRest) — so drain
    // them again to isolate Mystic Arcanum's own cadence from that.
    hero.shortRest();
    while (hero.spellSlotsRemainingAt(6) > 0) hero.spendSpellSlot(6);
    expect(hero.canCastSpell(spellId)).toBe(false); // Mystic Arcanum itself stays spent
    hero.longRest();
    expect(hero.canCastSpell(spellId)).toBe(true); // refilled
  });
});
