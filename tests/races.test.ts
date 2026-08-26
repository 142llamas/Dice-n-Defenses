import { describe, it, expect } from "vitest";
import { RACE_DEFINITIONS, RACE_IDS, getRaceDefinition } from "../src/game/data/races";

/**
 * Phase 11.3's starter race list (DECISIONS D-071/D-075), expanded by D-170
 * (KI-098 item 6) with 5 more real SRD 5.2.1 species, rescaled to real
 * 5ft/tile math by D-172 (KI-098 item 7's map-size follow-up). Speed is
 * the one mechanically active race trait today — see the module comment
 * in `data/races.ts` for why everything else (Darkvision, Lucky, etc.) is
 * inert, for the D-170 sourcing-attribution correction (Half-Elf/Half-Orc
 * are SRD 5.1, not 5.2.1), and for D-172's exact-feet-to-tiles conversion
 * (Goliath's real 35ft finally gets its own tier instead of D-170's
 * flattening).
 */

describe("RACE_DEFINITIONS", () => {
  it("lists the starter six plus D-170's five new SRD 5.2.1 species", () => {
    expect(RACE_IDS.sort()).toEqual(
      ["dwarf", "elf", "half-elf", "half-orc", "halfling", "human", "dragonborn", "gnome", "goliath", "orc", "tiefling"].sort(),
    );
    expect(RACE_DEFINITIONS).toHaveLength(11);
  });

  it("gives Dwarf and Halfling the real 25ft speed (5 tiles), Goliath the real 35ft speed (7 tiles), everyone else the standard 30ft (6 tiles)", () => {
    expect(getRaceDefinition("dwarf").speedTiles).toBe(5);
    expect(getRaceDefinition("halfling").speedTiles).toBe(5);
    expect(getRaceDefinition("goliath").speedTiles).toBe(7);
    for (const id of ["human", "elf", "half-elf", "half-orc", "dragonborn", "gnome", "orc", "tiefling"]) {
      expect(getRaceDefinition(id).speedTiles).toBe(6);
    }
  });

  it("marks every named trait inert — no lighting/charm/poison/dice systems exist yet", () => {
    RACE_DEFINITIONS.forEach((race) => {
      race.traits.forEach((trait) => expect(trait.mechanicallyActive).toBe(false));
    });
  });

  it("throws on an unknown race id", () => {
    expect(() => getRaceDefinition("aasimar")).toThrow();
  });
});
