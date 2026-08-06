import { describe, it, expect } from "vitest";
import { concentrationSaveDC, checkConcentration } from "../src/game/systems/ConcentrationSystem";
import { RandomService } from "../src/game/systems/RandomService";

/**
 * Phase 13.7 (DECISIONS D-092): ConcentrationSystem is framework-only — no
 * spell in this game has an ongoing duration effect to protect yet, so
 * nothing calls this outside its own tests. Same "framework only, no caller
 * yet" treatment InitiativeSystem got in Phase 13.5 (D-090).
 */

describe("concentrationSaveDC", () => {
  it("is half the damage taken, rounded down, once that exceeds the minimum", () => {
    expect(concentrationSaveDC(24)).toBe(12);
    expect(concentrationSaveDC(25)).toBe(12); // floor(25/2) = 12
  });

  it("never falls below the SRD's minimum DC of 10", () => {
    expect(concentrationSaveDC(0)).toBe(10);
    expect(concentrationSaveDC(6)).toBe(10); // floor(6/2)=3, floored up to 10
    expect(concentrationSaveDC(19)).toBe(10); // floor(19/2)=9, floored up to 10
  });

  it("rises past the minimum once damage is high enough", () => {
    expect(concentrationSaveDC(20)).toBe(10); // floor(20/2)=10, exactly the minimum
    expect(concentrationSaveDC(22)).toBe(11);
  });
});

describe("checkConcentration", () => {
  it("succeeds when the CON save meets or beats the damage-derived DC", () => {
    const result = checkConcentration(10, 5, RandomService.fixed(10)); // DC 10; 10+5=15
    expect(result.success).toBe(true);
    expect(result.dc).toBe(10);
  });

  it("fails when the CON save falls short of the damage-derived DC", () => {
    const result = checkConcentration(30, 0, RandomService.fixed(10)); // DC 15; 10+0=10
    expect(result.success).toBe(false);
    expect(result.dc).toBe(15);
  });

  it("a natural 20 always succeeds, even against a DC the bonus alone couldn't beat", () => {
    const result = checkConcentration(100, -5, RandomService.fixed(20)); // DC 50
    expect(result.d20).toBe(20);
    expect(result.success).toBe(true);
  });

  it("a natural 1 always fails, even with a bonus that would otherwise clear the DC", () => {
    const result = checkConcentration(0, 20, RandomService.fixed(1)); // DC 10; 1+20=21 would otherwise succeed
    expect(result.d20).toBe(1);
    expect(result.success).toBe(false);
  });
});
