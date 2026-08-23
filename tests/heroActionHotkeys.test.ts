import { describe, it, expect } from "vitest";
import { Hero, ACTION_HOTKEY_SLOT_COUNT } from "../src/game/entities/Hero";
import { heroDefinitionFromBuild, type CharacterBuild } from "../src/game/systems/CharacterBuildSystem";
import { DEFAULT_SAVE_FILE, createSaveSlot, getSaveSlot, loadSaveFile, saveSaveFile, type SaveStorage } from "../src/game/systems/SaveSystem";

/**
 * D-148: the action hotkey bar — a curated, slot-ordered subset of what a
 * hero could use (`knownSpellAbilityIds`/`HeroActionRegistry`/`abilityId`),
 * distinct from those sources themselves. Covers the mutator's validation
 * (can't pin something the hero can't do) and proves the field survives a
 * save/load round-trip with no `SaveSystem.ts` change, mirroring
 * `preparedSpellIds`' (D-135) existing precedent.
 */

function fakeStorage(): SaveStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

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

function heroFromBuild(overrides: Partial<CharacterBuild> = {}): Hero {
  return new Hero(heroDefinitionFromBuild(build(overrides)), { x: 0, y: 0 });
}

describe("Hero action hotkeys (D-148)", () => {
  it("starts with every slot empty", () => {
    const hero = heroFromBuild();
    expect(hero.actionHotkeys()).toEqual(new Array(ACTION_HOTKEY_SLOT_COUNT).fill(undefined));
  });

  it("accepts the hero's own frozen signature ability", () => {
    const hero = heroFromBuild({ abilityId: "cleave" });
    hero.setActionHotkey(0, "cleave");
    expect(hero.actionHotkeys()[0]).toBe("cleave");
  });

  it("accepts a known spell/cantrip id", () => {
    const hero = heroFromBuild({ classId: "wizard", abilityId: "fire-bolt" });
    const known = hero.knownSpellAbilityIds();
    expect(known.length).toBeGreaterThan(0);
    hero.setActionHotkey(1, known[0]);
    expect(hero.actionHotkeys()[1]).toBe(known[0]);
  });

  it("accepts a currently-available HeroActionRegistry action id", () => {
    const hero = heroFromBuild({ classId: "fighter" }); // fresh Fighter can use Second Wind
    hero.setActionHotkey(2, "secondWind");
    expect(hero.actionHotkeys()[2]).toBe("secondWind");
  });

  it("silently refuses an id this hero has never had access to", () => {
    const hero = heroFromBuild({ classId: "fighter" });
    hero.setActionHotkey(0, "rage"); // a Barbarian-only action
    expect(hero.actionHotkeys()[0]).toBeUndefined();
  });

  it("clears a slot when set to undefined", () => {
    const hero = heroFromBuild({ abilityId: "cleave" });
    hero.setActionHotkey(0, "cleave");
    hero.setActionHotkey(0, undefined);
    expect(hero.actionHotkeys()[0]).toBeUndefined();
  });

  it("ignores an out-of-range slot", () => {
    const hero = heroFromBuild({ abilityId: "cleave" });
    hero.setActionHotkey(-1, "cleave");
    hero.setActionHotkey(ACTION_HOTKEY_SLOT_COUNT, "cleave");
    expect(hero.actionHotkeys().every((id) => id === undefined)).toBe(true);
  });

  it("setActionHotkeys bulk-applies, validating each slot independently", () => {
    const hero = heroFromBuild({ abilityId: "cleave" });
    hero.setActionHotkeys(["cleave", "rage", undefined]);
    expect(hero.actionHotkeys()[0]).toBe("cleave"); // valid
    expect(hero.actionHotkeys()[1]).toBeUndefined(); // refused
    expect(hero.actionHotkeys()[2]).toBeUndefined();
  });

  it("survives a full save/load round-trip with no SaveSystem.ts change", () => {
    const storage = fakeStorage();
    const partyBuild = build({ actionHotkeys: ["cleave", undefined] });
    const fileAfterCreate = createSaveSlot(DEFAULT_SAVE_FILE, {
      id: "slot-1",
      name: "Test Party",
      createdAt: 1,
      party: [partyBuild],
      partySize: 1,
      difficultyId: "normal",
    });
    saveSaveFile(storage, "k", fileAfterCreate);

    const loaded = loadSaveFile(storage, "k");
    const slot = getSaveSlot(loaded, "slot-1");
    // JSON.stringify turns an `undefined` array element into `null` — this
    // is the real shape a loaded save has, not the shape it was written
    // with. `setActionHotkey`/`setActionHotkeys` accept `null` for exactly
    // this reason (see their own comments).
    expect(slot?.party[0].actionHotkeys).toEqual(["cleave", null]);

    // Mirrors `BattleScene.buildHeroes`'s own application of this field —
    // the Hero constructor doesn't read it directly, same treatment
    // `preparedSpellIds` already gets.
    const def = heroDefinitionFromBuild(slot!.party[0]);
    const hero = new Hero(def, { x: 0, y: 0 });
    if (def.actionHotkeys) hero.setActionHotkeys(def.actionHotkeys);
    expect(hero.actionHotkeys()[0]).toBe("cleave");
  });
});
