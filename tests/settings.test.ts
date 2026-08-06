import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  durationScaleFor,
  hasSeenTutorial,
  loadSettings,
  markTutorialSeen,
  nextAnimationSpeed,
  saveSettings,
  type SettingsStorage,
} from "../src/game/systems/SettingsSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): SettingsStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("SettingsSystem", () => {
  it("loadSettings returns defaults when nothing is stored", () => {
    expect(loadSettings(fakeStorage(), "k")).toEqual(DEFAULT_SETTINGS);
  });

  it("loadSettings returns defaults on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadSettings(storage, "k")).toEqual(DEFAULT_SETTINGS);
  });

  it("loadSettings falls back to the default animationSpeed on an unknown value", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ animationSpeed: "ludicrous" }));
    expect(loadSettings(storage, "k").animationSpeed).toBe("normal");
  });

  it("saveSettings then loadSettings round-trips", () => {
    const storage = fakeStorage();
    saveSettings(storage, "k", { animationSpeed: "fast" });
    expect(loadSettings(storage, "k")).toEqual({ animationSpeed: "fast" });
  });

  it("nextAnimationSpeed cycles normal -> fast -> instant -> normal", () => {
    expect(nextAnimationSpeed("normal")).toBe("fast");
    expect(nextAnimationSpeed("fast")).toBe("instant");
    expect(nextAnimationSpeed("instant")).toBe("normal");
  });

  it("durationScaleFor: normal is 1x, fast shrinks, instant is 0 (skip the tween)", () => {
    expect(durationScaleFor("normal")).toBe(1);
    expect(durationScaleFor("fast")).toBeLessThan(1);
    expect(durationScaleFor("fast")).toBeGreaterThan(0);
    expect(durationScaleFor("instant")).toBe(0);
  });

  it("tutorial-seen flag starts false and persists once marked", () => {
    const storage = fakeStorage();
    expect(hasSeenTutorial(storage, "t")).toBe(false);
    markTutorialSeen(storage, "t");
    expect(hasSeenTutorial(storage, "t")).toBe(true);
  });
});
