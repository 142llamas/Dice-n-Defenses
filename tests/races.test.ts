import { describe, it, expect } from "vitest";
import { RACE_DEFINITIONS, RACE_IDS, getRaceDefinition } from "../src/game/data/races";

/**
 * Phase 11.3's starter race list (DECISIONS D-071/D-075). Speed is the one
 * mechanically active race trait today — see the module comment in
 * `data/races.ts` for why everything else (Darkvision, Lucky, etc.) is
 * inert.
 */

describe("RACE_DEFINITIONS", () => {
  it("lists exactly the SRD starter six", () => {
    expect(RACE_IDS.sort()).toEqual(["dwarf", "elf", "half-elf", "half-orc", "halfling", "human"].sort());
    expect(RACE_DEFINITIONS).toHaveLength(6);
  });

  it("gives Dwarf and Halfling the SRD's slower 25ft speed, everyone else the standard 30ft", () => {
    expect(getRaceDefinition("dwarf").speedTiles).toBe(2);
    expect(getRaceDefinition("halfling").speedTiles).toBe(2);
    expect(getRaceDefinition("human").speedTiles).toBe(3);
    expect(getRaceDefinition("elf").speedTiles).toBe(3);
    expect(getRaceDefinition("half-elf").speedTiles).toBe(3);
    expect(getRaceDefinition("half-orc").speedTiles).toBe(3);
  });

  it("marks every named trait inert — no lighting/charm/poison/dice systems exist yet", () => {
    RACE_DEFINITIONS.forEach((race) => {
      race.traits.forEach((trait) => expect(trait.mechanicallyActive).toBe(false));
    });
  });

  it("throws on an unknown race id", () => {
    expect(() => getRaceDefinition("gnome")).toThrow();
  });
});
