import { describe, it, expect } from "vitest";
import { ABILITIES } from "../src/game/data/abilities";

/**
 * Phase 16 follow-up (D-106): structural consistency checks across the
 * whole `ABILITIES` catalogue — guards against exactly the class of bug
 * found and fixed this session (an `aoeAtRange` ability carrying a dead
 * `savingThrow` field the resolver never read, since fixed by adding real
 * saving-throw support to `BattleScene.castAoeAtRangeSpell`).
 */

const VALID_ABILITY_SCORES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

describe("ABILITIES catalogue", () => {
  it("every ability's object key matches its own id field", () => {
    for (const [key, ability] of Object.entries(ABILITIES)) {
      expect(ability.id).toBe(key);
    }
  });

  it("never combines autoHit with savingThrow (mutually exclusive resolution paths)", () => {
    for (const ability of Object.values(ABILITIES)) {
      if (ability.autoHit) expect(ability.savingThrow).toBeUndefined();
      if (ability.savingThrow) expect(ability.autoHit).toBeUndefined();
    }
  });

  it("every savingThrow.ability is a real ability score id", () => {
    for (const ability of Object.values(ABILITIES)) {
      if (ability.savingThrow) expect(VALID_ABILITY_SCORES.has(ability.savingThrow.ability)).toBe(true);
    }
  });

  it("aoeAtRange abilities may carry a real savingThrow — BattleScene.castAoeAtRangeSpell now resolves it per-target", () => {
    const aoeAtRangeWithSave = Object.values(ABILITIES).filter(
      (a) => a.kind === "aoeAtRange" && a.savingThrow !== undefined,
    );
    // Fireball, Lightning Bolt, and friends should be in here now — this
    // isn't a dead field the way it was before this session's fix.
    expect(aoeAtRangeWithSave.length).toBeGreaterThan(0);
    expect(aoeAtRangeWithSave.map((a) => a.id)).toContain("fireball");
  });
});
