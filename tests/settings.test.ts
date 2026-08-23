import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  durationScaleFor,
  hasSeenTutorial,
  loadSettings,
  markTutorialSeen,
  nextAnimationSpeed,
  nextVolume,
  saveSettings,
  toggleMuted,
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

  it("loadSettings falls back to default volumes/mute on an invalid stored value", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ masterVolume: 999, musicVolume: -5, sfxVolume: "loud", muted: "yes" }));
    const settings = loadSettings(storage, "k");
    expect(settings.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume);
    expect(settings.musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
    expect(settings.sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume);
    expect(settings.muted).toBe(DEFAULT_SETTINGS.muted);
  });

  it("saveSettings then loadSettings round-trips", () => {
    const storage = fakeStorage();
    const full = { animationSpeed: "fast" as const, masterVolume: 50, musicVolume: 25, sfxVolume: 100, muted: true };
    saveSettings(storage, "k", full);
    expect(loadSettings(storage, "k")).toEqual(full);
  });

  it("nextAnimationSpeed cycles normal -> fast -> instant -> normal", () => {
    expect(nextAnimationSpeed("normal")).toBe("fast");
    expect(nextAnimationSpeed("fast")).toBe("instant");
    expect(nextAnimationSpeed("instant")).toBe("normal");
  });

  it("nextVolume cycles 0 -> 25 -> 50 -> 75 -> 100 -> 0", () => {
    expect(nextVolume(0)).toBe(25);
    expect(nextVolume(25)).toBe(50);
    expect(nextVolume(50)).toBe(75);
    expect(nextVolume(75)).toBe(100);
    expect(nextVolume(100)).toBe(0);
  });

  it("toggleMuted flips the flag", () => {
    expect(toggleMuted(false)).toBe(true);
    expect(toggleMuted(true)).toBe(false);
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
