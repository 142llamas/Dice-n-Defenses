import { describe, expect, it } from "vitest";
import {
  COMPANION_RECRUITMENT_DIALOGUE,
  COMPANION_MIRROR_REACTION_DIALOGUE,
} from "../src/game/data/companionDialogue";
import { POOL_A_COMPANION_IDS, POOL_B_COMPANION_IDS, getCompanionDefinition } from "../src/game/data/companions";
import type { DialogueLine } from "../src/game/systems/DialogueSystem";

/**
 * KI-098 item 13 continuation — the writing pass CAMPAIGN_STORY_DESIGN.md §9
 * flagged as still open. Structural/reference checks only, matching this
 * project's established style for narrative content data (see
 * `sorrelFateSystem.test.ts`/`returningMinibossSystem.test.ts`) — not
 * prose-quality assertions.
 */

function allLines(entry: DialogueLine[] | { ashen: DialogueLine[]; hollow: DialogueLine[] }): DialogueLine[] {
  return Array.isArray(entry) ? entry : [...entry.ashen, ...entry.hollow];
}

describe("COMPANION_RECRUITMENT_DIALOGUE", () => {
  it("has an entry for every Pool B companion, and only Pool B companions", () => {
    for (const id of POOL_B_COMPANION_IDS) {
      expect(COMPANION_RECRUITMENT_DIALOGUE[id], id).toBeDefined();
    }
    for (const id of POOL_A_COMPANION_IDS) {
      expect(COMPANION_RECRUITMENT_DIALOGUE[id], id).toBeUndefined();
    }
  });

  it("every entry is a non-empty line sequence", () => {
    for (const id of POOL_B_COMPANION_IDS) {
      expect(COMPANION_RECRUITMENT_DIALOGUE[id].length).toBeGreaterThan(0);
    }
  });

  it("every line's speakerName, where set, matches the companion's real name", () => {
    for (const id of POOL_B_COMPANION_IDS) {
      const name = getCompanionDefinition(id).name;
      for (const line of COMPANION_RECRUITMENT_DIALOGUE[id]) {
        if (line.speakerName !== undefined) expect(line.speakerName).toBe(name);
      }
    }
  });
});

describe("COMPANION_MIRROR_REACTION_DIALOGUE", () => {
  it("has an entry for every Pool B companion, and only Pool B companions", () => {
    for (const id of POOL_B_COMPANION_IDS) {
      expect(COMPANION_MIRROR_REACTION_DIALOGUE[id], id).toBeDefined();
    }
    for (const id of POOL_A_COMPANION_IDS) {
      expect(COMPANION_MIRROR_REACTION_DIALOGUE[id], id).toBeUndefined();
    }
  });

  it("every entry (and both variant arms, where applicable) is a non-empty line sequence", () => {
    for (const id of POOL_B_COMPANION_IDS) {
      const entry = COMPANION_MIRROR_REACTION_DIALOGUE[id];
      if (Array.isArray(entry)) {
        expect(entry.length).toBeGreaterThan(0);
      } else {
        expect(entry.ashen.length).toBeGreaterThan(0);
        expect(entry.hollow.length).toBeGreaterThan(0);
      }
    }
  });

  it("every line's speakerName, where set, matches the companion's real name", () => {
    for (const id of POOL_B_COMPANION_IDS) {
      const name = getCompanionDefinition(id).name;
      for (const line of allLines(COMPANION_MIRROR_REACTION_DIALOGUE[id])) {
        if (line.speakerName !== undefined) expect(line.speakerName).toBe(name);
      }
    }
  });

  it("exactly fenna-duskwater and isolde-varnhall use the {ashen, hollow} tone-reactive shape", () => {
    const toneReactiveIds = POOL_B_COMPANION_IDS.filter((id) => !Array.isArray(COMPANION_MIRROR_REACTION_DIALOGUE[id]));
    expect(toneReactiveIds.sort()).toEqual(["fenna-duskwater", "isolde-varnhall"]);
  });
});
