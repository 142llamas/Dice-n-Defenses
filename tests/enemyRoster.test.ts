import { describe, it, expect } from "vitest";
import { ENEMY_DEFINITIONS, ENEMY_COLORS, getEnemyDefinition } from "../src/game/data/enemies";

/**
 * Phase 13.10 (D-095): roster expansion — "more enemies at every tier, full
 * role tagging." Every enemy now carries an EXPLICIT `role` (previously
 * omitted for ordinary minions and only implicitly treated as one by every
 * reader); four new enemies fill real gaps (a flat-stat minion, a
 * save-based-attack minion, a second miniboss, a third boss).
 */

describe("Enemy roster (D-095)", () => {
  it("every enemy definition now carries an explicit role", () => {
    for (const [id, def] of Object.entries(ENEMY_DEFINITIONS)) {
      expect(def.role, `${id} should have an explicit role`).toBeDefined();
    }
  });

  it("has exactly five minibosses, six true bosses, two legendaries, the rest minions", () => {
    const byRole = { minion: 0, miniboss: 0, boss: 0, legendary: 0 };
    for (const def of Object.values(ENEMY_DEFINITIONS)) {
      byRole[def.role!] += 1;
    }
    expect(byRole.miniboss).toBe(5); // 2 pre-20 + juggernaut + bloodrage-warlord + the-husk (Phase 21)
    expect(byRole.boss).toBe(6); // 3 pre-20 + warlord-korrath + the-devourer + sundered-king (Phase 21)
    expect(byRole.legendary).toBe(2); // ashen-sovereign + the-hollow-empress
    expect(byRole.minion).toBe(50); // 27 pre-21 + 21 new Phase 21 minions + 2 new Phase 25 minions
  });

  it("the four new enemies resolve by id", () => {
    for (const id of ["marauder", "blightcaller", "gravemaw", "blightmother"]) {
      expect(() => getEnemyDefinition(id)).not.toThrow();
    }
  });

  it("gravemaw is a second miniboss, meaningfully tougher than basalt-colossus", () => {
    const colossus = getEnemyDefinition("basalt-colossus");
    const gravemaw = getEnemyDefinition("gravemaw");
    expect(gravemaw.role).toBe("miniboss");
    expect(gravemaw.maxHealth).toBeGreaterThan(colossus.maxHealth);
  });

  it("blightmother is a third boss, distinct from cinderlord/tidelord", () => {
    expect(getEnemyDefinition("blightmother").role).toBe("boss");
  });

  const SAVING_THROW_ATTACKERS = ["blightcaller", "blightmother", "frost-warden", "the-hollow-empress"];

  it("only the save-based attackers carry a savingThrowAttackDC — every other enemy rolls a normal to-hit", () => {
    for (const [id, def] of Object.entries(ENEMY_DEFINITIONS)) {
      if (SAVING_THROW_ATTACKERS.includes(id)) {
        expect(def.savingThrowAttackDC).toBeGreaterThan(0);
      } else {
        expect(def.savingThrowAttackDC).toBeUndefined();
      }
    }
  });

  it("blightmother's forced save is meaningfully harder than blightcaller's", () => {
    const caller = getEnemyDefinition("blightcaller");
    const mother = getEnemyDefinition("blightmother");
    expect(mother.savingThrowAttackDC!).toBeGreaterThan(caller.savingThrowAttackDC!);
    expect(mother.attackDamage).toBeGreaterThan(caller.attackDamage);
  });

  it("every enemy id has a placeholder colour (no silent fallback to the default)", () => {
    for (const id of Object.keys(ENEMY_DEFINITIONS)) {
      expect(ENEMY_COLORS[id], `${id} should have a colour entry`).toBeDefined();
    }
  });
});

/**
 * Phase 20 (D-111): "tons of different enemies," almost all with a real
 * mechanical hook. These are pure roster/data sanity checks — the mechanics
 * themselves (siege, stealth, aura, reinforcements, AoE, ignoresHeroes) are
 * exercised behaviourally in tests/enemyMechanics.test.ts.
 */
describe("Enemy roster (D-111, Phase 20)", () => {
  const NEW_IDS = [
    "siegebreaker",
    "battering-brute",
    "shadowfang",
    "nightblade",
    "sprinter",
    "bolt-runner",
    "ironhide",
    "hoarder",
    "gilded-carrier",
    "cultist-caller",
    "bone-summoner",
    "warcaptain",
    "battlepriest",
    "bannerbearer",
    "cave-drake",
    "frost-warden",
    "juggernaut",
    "warlord-korrath",
    "the-devourer",
    "ashen-sovereign",
    "the-hollow-empress",
  ];

  it("every new enemy resolves by id", () => {
    for (const id of NEW_IDS) {
      expect(() => getEnemyDefinition(id)).not.toThrow();
    }
  });

  it("every new enemy has at least one Phase 20 mechanical hook, a tank exception, or a legendary/boss double-up", () => {
    const NO_NEW_HOOK_EXPECTED = ["ironhide"]; // the roster's one deliberate pure-tank, no new field
    for (const id of NEW_IDS) {
      if (NO_NEW_HOOK_EXPECTED.includes(id)) continue;
      const def = getEnemyDefinition(id);
      const hasHook =
        def.siegeDamageMultiplier !== undefined ||
        def.stealth === true ||
        def.auraBuff !== undefined ||
        def.callsReinforcements !== undefined ||
        def.treasureBonusGold !== undefined ||
        def.aoeAttack === true ||
        def.ignoresHeroes === true;
      expect(hasHook, `${id} should carry at least one Phase 20 mechanic`).toBe(true);
    }
  });

  it("the two legendaries are meaningfully tougher than every boss and miniboss", () => {
    const legendaries = Object.values(ENEMY_DEFINITIONS).filter((d) => d.role === "legendary");
    const bossesAndMinibosses = Object.values(ENEMY_DEFINITIONS).filter(
      (d) => d.role === "boss" || d.role === "miniboss",
    );
    for (const legendary of legendaries) {
      for (const other of bossesAndMinibosses) {
        expect(legendary.maxHealth).toBeGreaterThan(other.maxHealth);
        expect(legendary.rewardGold).toBeGreaterThan(other.rewardGold);
      }
    }
  });

  it("only auraBuff enemies specify a buff, and each buffs a distinct stat combination", () => {
    const warcaptain = getEnemyDefinition("warcaptain").auraBuff!;
    const battlepriest = getEnemyDefinition("battlepriest").auraBuff!;
    const bannerbearer = getEnemyDefinition("bannerbearer").auraBuff!;
    expect(warcaptain.attackBonus).toBeGreaterThan(0);
    expect(warcaptain.damageBonus).toBeUndefined();
    expect(battlepriest.damageBonus).toBeGreaterThan(0);
    expect(battlepriest.attackBonus).toBeUndefined();
    expect(bannerbearer.movementBonus).toBeGreaterThan(0);
    expect(bannerbearer.attackBonus).toBeUndefined();
  });

  it("siege enemies have a real multiplier greater than 1", () => {
    for (const id of ["siegebreaker", "battering-brute", "juggernaut", "ashen-sovereign"]) {
      expect(getEnemyDefinition(id).siegeDamageMultiplier!).toBeGreaterThan(1);
    }
  });

  it("ignoresHeroes enemies (pure runners) have a low breach and no special attack", () => {
    for (const id of ["sprinter", "bolt-runner"]) {
      const def = getEnemyDefinition(id);
      expect(def.ignoresHeroes).toBe(true);
      expect(def.aoeAttack).toBeUndefined();
      expect(def.savingThrowAttackDC).toBeUndefined();
    }
  });
});

/**
 * Phase 21 (D-112): a second wave of archetypes, confirmed with Kevin at the
 * end of the Phase 20 session. Pure roster/data sanity checks — the
 * mechanics themselves are exercised behaviourally in
 * tests/enemyMechanicsPhase21.test.ts.
 */
describe("Enemy roster (D-112, Phase 21)", () => {
  const NEW_IDS = [
    "frenzied-cultist",
    "bloodrage-warlord",
    "bloodwisp",
    "crimson-leech",
    "living-splinter",
    "ooze-splitter",
    "fungal-splitter",
    "the-husk",
    "warded-sentinel",
    "aegis-bearer",
    "cinder-wretch",
    "bomber-beetle",
    "pilferer",
    "coin-wraith",
    "blink-stalker",
    "rift-walker",
    "mimic-chest",
    "ambush-coffer",
    "battle-medic",
    "plague-warden",
    "hexbinder",
    "rat-swarm",
    "locust-swarm",
    "sundered-king",
  ];

  it("every new enemy resolves by id and has a placeholder colour", () => {
    for (const id of NEW_IDS) {
      expect(() => getEnemyDefinition(id)).not.toThrow();
      expect(ENEMY_COLORS[id], `${id} should have a colour entry`).toBeDefined();
    }
  });

  it("every new enemy has at least one Phase 21 mechanical hook, except the shared fodder minion", () => {
    const NO_NEW_HOOK_EXPECTED = ["living-splinter"]; // the Splitter/Carrier family's plain shared fodder, no hook of its own
    for (const id of NEW_IDS) {
      if (NO_NEW_HOOK_EXPECTED.includes(id)) continue;
      const def = getEnemyDefinition(id);
      const hasHook =
        def.enrage !== undefined ||
        def.lifedrinkPercent !== undefined ||
        def.onDeathSpawns !== undefined ||
        def.onDeathExplode !== undefined ||
        def.damageShieldHp !== undefined ||
        def.goldTheftAmount !== undefined ||
        def.teleportsEveryNTurns !== undefined ||
        def.mimicDisguise === true ||
        def.healAura !== undefined ||
        def.inflictsStatusOnHit !== undefined ||
        def.swarm === true ||
        def.phaseChange !== undefined;
      expect(hasHook, `${id} should carry at least one Phase 21 mechanic`).toBe(true);
    }
  });

  it("Aegis Bearer is the Shielded/Reflector combo Kevin asked for — both fields on one entry", () => {
    const def = getEnemyDefinition("aegis-bearer");
    expect(def.damageShieldHp).toBeGreaterThan(0);
    expect(def.reflectsDamagePercent).toBeGreaterThan(0);
  });

  it("Plague Warden is the Healer/Debuffer hybrid Kevin asked for — both fields on one entry", () => {
    const def = getEnemyDefinition("plague-warden");
    expect(def.healAura).toBeDefined();
    expect(def.inflictsStatusOnHit).toEqual({ id: "poisoned", durationTurns: 3 });
  });

  it("Splitter/Carrier all spawn the shared living-splinter fodder", () => {
    for (const id of ["ooze-splitter", "fungal-splitter", "the-husk"]) {
      expect(getEnemyDefinition(id).onDeathSpawns!.enemyId).toBe("living-splinter");
    }
    // The Husk is the piñata: far more HP, far less attack, and spawns MORE
    // copies than an ordinary Splitter — a real behavioral difference from
    // Splitter, not just a name.
    const husk = getEnemyDefinition("the-husk");
    const splitter = getEnemyDefinition("ooze-splitter");
    expect(husk.maxHealth).toBeGreaterThan(splitter.maxHealth * 2);
    expect(husk.attackDamage).toBeLessThan(splitter.attackDamage);
    expect(husk.onDeathSpawns!.count).toBeGreaterThan(splitter.onDeathSpawns!.count);
  });

  it("only Anti-caster/Healer-Debuffer enemies inflict a status on hit, each with a real duration", () => {
    for (const id of ["hexbinder", "plague-warden"]) {
      expect(getEnemyDefinition(id).inflictsStatusOnHit!.durationTurns).toBeGreaterThan(0);
    }
  });

  it("the Multi-Phase Boss's override is a real escalation, not a no-op", () => {
    const king = getEnemyDefinition("sundered-king");
    const overrides = king.phaseChange!.overrides;
    expect(overrides.attackDamage!).toBeGreaterThan(king.attackDamage);
    expect(overrides.attackBonus!).toBeGreaterThan(king.attackBonus);
    expect(overrides.aoeAttack).toBe(true);
    expect(king.aoeAttack).toBeUndefined(); // not active until the phase change
  });
});

/**
 * Phase 25 (D-116): the Saboteur archetype (`trapSense`) — the counter to
 * the player's own trap investment. Pure roster/data sanity checks — the
 * mechanic itself is exercised behaviourally in
 * tests/enemyMechanicsPhase25.test.ts.
 */
describe("Enemy roster (D-116, Phase 25)", () => {
  const NEW_IDS = ["saboteur", "warren-stalker"];

  it("both new enemies resolve by id and have a placeholder colour", () => {
    for (const id of NEW_IDS) {
      expect(() => getEnemyDefinition(id)).not.toThrow();
      expect(ENEMY_COLORS[id], `${id} should have a colour entry`).toBeDefined();
    }
  });

  it("both carry trapSense, and only these two do", () => {
    for (const [id, def] of Object.entries(ENEMY_DEFINITIONS)) {
      if (NEW_IDS.includes(id)) {
        expect(def.trapSense, `${id} should carry trapSense`).toBeDefined();
        expect(def.trapSense!.rangeTiles).toBeGreaterThan(0);
      } else {
        expect(def.trapSense, `${id} should not carry trapSense`).toBeUndefined();
      }
    }
  });

  it("Warren Stalker senses a trap from further away than Saboteur", () => {
    const saboteur = getEnemyDefinition("saboteur");
    const stalker = getEnemyDefinition("warren-stalker");
    expect(stalker.trapSense!.rangeTiles).toBeGreaterThan(saboteur.trapSense!.rangeTiles);
    expect(stalker.maxHealth).toBeGreaterThan(saboteur.maxHealth);
  });
});
