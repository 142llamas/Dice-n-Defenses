import { describe, it, expect } from "vitest";
import { getAbility } from "../src/game/data/abilities";
import {
  getCastVisual,
  deathCauseForAbility,
  getDeathVisual,
  inferElement,
} from "../src/game/systems/VisualFxSystem";

/**
 * D-122: pure selection logic backing every spell-cast/death-visual
 * flourish. The goal isn't that any two SPECIFIC spells differ (with ~198
 * castable abilities that's a combinatorics argument, not a per-pair one)
 * — it's that the shape/color/variation pick is deterministic, matches
 * each ability's own real mechanical fields, and never throws for any real
 * ability in the roster.
 */

describe("inferElement", () => {
  it("matches an unambiguous elemental keyword", () => {
    expect(inferElement("A mote of fire hurled at one enemy")).toBe("fire");
    expect(inferElement("A freezing ray that chills one enemy")).toBe("frost");
    expect(inferElement("Poison drips from its fangs")).toBe("poison");
  });

  it("prefers radiant over fire for a spell that reads as holy despite mentioning flame", () => {
    // Sacred Flame is real SRD radiant damage, not fire — a known case this
    // keyword-priority order needs to get right, not just "some order or other."
    expect(inferElement("Radiant fire falls on one enemy, sacred flame")).toBe("radiant");
  });

  it("returns undefined when nothing matches", () => {
    expect(inferElement("A perfectly mundane strike")).toBeUndefined();
  });
});

describe("getCastVisual", () => {
  it("picks a structural shape from the ability's own mechanical fields, not a guess", () => {
    expect(getCastVisual(getAbility("cleave")).shape).toBe("ringPulse"); // aoeAdjacent
    expect(getCastVisual(getAbility("piercing-shot")).shape).toBe("homingOrb"); // autoHit
    expect(getCastVisual(getAbility("sacred-flame")).shape).toBe("fallingJudgment"); // savingThrow
    expect(getCastVisual(getAbility("frost-bolt")).shape).toBe("bolt"); // plain attack-roll single
    expect(getCastVisual(getAbility("thunderwave")).shape).toBe("gustCone"); // forcedMoveTiles wins over its own aoeAtRange kind
    expect(getCastVisual(getAbility("moonbeam")).shape).toBe("novaBurst"); // aoeAtRange, no forcedMoveTiles
    expect(getCastVisual(getAbility("misty-step")).shape).toBe("blink"); // teleportSelf
    expect(getCastVisual(getAbility("find-steed")).shape).toBe("conjureCircle"); // summonsId
    expect(getCastVisual(getAbility("entangle")).shape).toBe("groundRune"); // altersTerrainId
    expect(getCastVisual(getAbility("bless")).shape).toBe("radiantPulse"); // areaAllies
  });

  it("is deterministic — the same ability id always yields the same descriptor", () => {
    const a = getCastVisual(getAbility("fire-bolt"));
    const b = getCastVisual(getAbility("fire-bolt"));
    expect(a).toEqual(b);
  });

  it("gives visibly different colors to differently-flavored abilities", () => {
    const fire = getCastVisual(getAbility("fire-bolt"));
    const frost = getCastVisual(getAbility("ray-of-frost"));
    const arcane = getCastVisual(getAbility("cleave")); // no school, no keyword match — arcane default
    expect(fire.color).not.toBe(frost.color);
    expect(fire.color).not.toBe(arcane.color);
  });

  it("never throws for any ability in the full roster, and always returns an in-range variation", () => {
    const ids = ["cleave", "piercing-shot", "taunting-slam", "frost-bolt", "fire-bolt", "ray-of-frost", "sacred-flame", "thunderwave", "misty-step", "find-steed", "entangle", "bless"];
    for (const id of ids) {
      const visual = getCastVisual(getAbility(id));
      expect([3, 5, 7]).toContain(visual.particleCount);
      expect(visual.sizeScale).toBeGreaterThanOrEqual(0.85);
      expect(visual.sizeScale).toBeLessThanOrEqual(1.25);
      expect(visual.durationScale).toBeGreaterThanOrEqual(0.85);
      expect(visual.durationScale).toBeLessThanOrEqual(1.15);
      expect([1, -1]).toContain(visual.rotationDir);
    }
  });
});

describe("deathCauseForAbility / getDeathVisual", () => {
  it("maps an ability's inferred element onto a death cause with a matching flourish", () => {
    expect(deathCauseForAbility(getAbility("fire-bolt"))).toBe("fire");
    expect(deathCauseForAbility(getAbility("ray-of-frost"))).toBe("frost");
    expect(deathCauseForAbility(getAbility("sacred-flame"))).toBe("radiant");
  });

  it("falls back to arcane for an ability with no keyword match, or one outside the 6 explicit causes", () => {
    expect(deathCauseForAbility(getAbility("cleave"))).toBe("arcane"); // no keyword match at all
    expect(deathCauseForAbility(getAbility("magic-missile"))).toBe("arcane"); // matches "force", not one of the 6 causes
  });

  it("every death cause resolves to a real, distinct shape+color", () => {
    const causes = ["physical", "fire", "frost", "poison", "necrotic", "radiant", "lightning", "arcane"] as const;
    const seen = new Set<string>();
    for (const cause of causes) {
      const visual = getDeathVisual(cause);
      const key = `${visual.shape}:${visual.color}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
