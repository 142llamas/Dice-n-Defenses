import { describe, expect, it } from "vitest";
import { COMPANIONS, getCompanionDefinition, POOL_A_COMPANION_IDS, POOL_B_COMPANION_IDS } from "../src/game/data/companions";
import { CREATABLE_CLASS_IDS } from "../src/game/data/characterCreation";
import { heroDefinitionFromBuild } from "../src/game/systems/CharacterBuildSystem";
import { getRaceDefinition } from "../src/game/data/races";
import { getClassDefinition } from "../src/game/data/classes";
import { getCampaignDefinition } from "../src/game/data/campaigns";

/**
 * D-118 built the engine scaffolding (empty catalogue); D-177 authors the
 * actual content — 12 companions, one per playable class (Kevin's own
 * extension of CAMPAIGN_STORY_DESIGN.md §6's original six, for BG3-style
 * class-coverage across the campaign). These tests lock the catalogue's
 * shape, not any specific narrative content.
 */
describe("COMPANIONS", () => {
  it("has exactly one companion per creatable class", () => {
    const classIds = COMPANIONS.map((c) => c.build.classId).sort();
    expect(classIds).toEqual([...CREATABLE_CLASS_IDS].sort());
  });

  it("has 12 companions with unique ids", () => {
    expect(COMPANIONS).toHaveLength(12);
    expect(new Set(COMPANIONS.map((c) => c.id)).size).toBe(12);
  });

  it("every build's id matches its companion's id", () => {
    COMPANIONS.forEach((c) => expect(c.build.id).toBe(c.id));
  });

  it("every build references a real race and class", () => {
    COMPANIONS.forEach((c) => {
      expect(() => getRaceDefinition(c.build.raceId)).not.toThrow();
      expect(() => getClassDefinition(c.build.classId)).not.toThrow();
    });
  });

  it("every build starts at level 1", () => {
    COMPANIONS.forEach((c) => expect(c.build.level).toBe(1));
  });

  it("every build converts to a playable HeroDefinition without throwing", () => {
    COMPANIONS.forEach((c) => expect(() => heroDefinitionFromBuild(c.build)).not.toThrow());
  });

  it("splits into two 6-companion pools by homeRegionId presence (KI-098 item 13 Phase 1)", () => {
    expect(POOL_A_COMPANION_IDS).toHaveLength(6);
    expect(POOL_B_COMPANION_IDS).toHaveLength(6);
    expect(new Set([...POOL_A_COMPANION_IDS, ...POOL_B_COMPANION_IDS]).size).toBe(12);
    POOL_A_COMPANION_IDS.forEach((id) => expect(getCompanionDefinition(id).homeRegionId).toBeUndefined());
    POOL_B_COMPANION_IDS.forEach((id) => expect(getCompanionDefinition(id).homeRegionId).toBeDefined());
  });

  it("all 6 mirror companions now have a homeRegionId, and each resolves to a real campaign (D-180)", () => {
    const withRegion = COMPANIONS.filter((c) => c.homeRegionId);
    expect(withRegion.map((c) => c.homeRegionId).sort()).toEqual([
      "cinderfall-rift",
      "drowning-vale",
      "emberford-reach",
      "frostbound-hollow",
      "saltmere-shallows",
      "shattered-causeway",
    ]);
    withRegion.forEach((c) => expect(() => getCampaignDefinition(c.homeRegionId!)).not.toThrow());
  });

  it("getCompanionDefinition resolves a known id and throws on an unknown one", () => {
    expect(getCompanionDefinition("hollis-vane").name).toBe("Hollis Vane");
    expect(() => getCompanionDefinition("nobody")).toThrow();
  });

  it("every Pool A companion has a unique sideMissionId that resolves to a real campaign; Pool B has none (KI-098 item 13 side missions)", () => {
    POOL_A_COMPANION_IDS.forEach((id) => {
      const sideMissionId = getCompanionDefinition(id).sideMissionId;
      expect(sideMissionId).toBeDefined();
      expect(() => getCampaignDefinition(sideMissionId!)).not.toThrow();
    });
    const sideMissionIds = POOL_A_COMPANION_IDS.map((id) => getCompanionDefinition(id).sideMissionId);
    expect(new Set(sideMissionIds).size).toBe(6);
    POOL_B_COMPANION_IDS.forEach((id) => expect(getCompanionDefinition(id).sideMissionId).toBeUndefined());
  });
});
