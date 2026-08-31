import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEY_BINDINGS,
  RESERVED_FIXED_KEY_CODES,
  loadKeyBindings,
  saveKeyBindings,
  keyBindingConflict,
  formatKeyCode,
  type KeyBindingStorage,
} from "../src/game/systems/KeyBindingSystem";

/** A minimal in-memory stand-in for window.localStorage, for pure-logic tests. */
function fakeStorage(): KeyBindingStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("KeyBindingSystem", () => {
  it("loadKeyBindings returns defaults when nothing is stored", () => {
    expect(loadKeyBindings(fakeStorage(), "k")).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it("loadKeyBindings returns defaults on corrupt JSON rather than throwing", () => {
    const storage = fakeStorage();
    storage.setItem("k", "{not json");
    expect(loadKeyBindings(storage, "k")).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it("loadKeyBindings falls back per-field on a missing/invalid stored value", () => {
    const storage = fakeStorage();
    storage.setItem("k", JSON.stringify({ confirm: "KeyJ", cancel: 5, bonusAction: "" }));
    const bindings = loadKeyBindings(storage, "k");
    expect(bindings.confirm).toBe("KeyJ"); // valid, kept
    expect(bindings.cancel).toBe(DEFAULT_KEY_BINDINGS.cancel); // not a string, falls back
    expect(bindings.bonusAction).toBe(DEFAULT_KEY_BINDINGS.bonusAction); // empty string, falls back
  });

  it("saveKeyBindings then loadKeyBindings round-trips", () => {
    const storage = fakeStorage();
    const full = { confirm: "NumpadEnter", cancel: "Backspace", bonusAction: "KeyV" };
    saveKeyBindings(storage, "k", full);
    expect(loadKeyBindings(storage, "k")).toEqual(full);
  });

  describe("keyBindingConflict", () => {
    it("allows reassigning an action to the code it already holds", () => {
      expect(keyBindingConflict(DEFAULT_KEY_BINDINGS, "cancel", "Escape")).toBeNull();
    });

    it("returns the other rebindable action already using that code", () => {
      expect(keyBindingConflict(DEFAULT_KEY_BINDINGS, "cancel", "Enter")).toBe("confirm");
    });

    it("returns \"reserved\" for a code a fixed hotkey already uses", () => {
      expect(RESERVED_FIXED_KEY_CODES).toContain("KeyE");
      expect(keyBindingConflict(DEFAULT_KEY_BINDINGS, "confirm", "KeyE")).toBe("reserved");
    });

    it("returns null for a genuinely free code", () => {
      expect(keyBindingConflict(DEFAULT_KEY_BINDINGS, "bonusAction", "KeyV")).toBeNull();
    });
  });

  describe("formatKeyCode", () => {
    it("strips the Key/Digit/Arrow prefixes", () => {
      expect(formatKeyCode("KeyR")).toBe("R");
      expect(formatKeyCode("Digit1")).toBe("1");
      expect(formatKeyCode("ArrowUp")).toBe("Up");
    });

    it("shortens Escape and passes other codes through unchanged", () => {
      expect(formatKeyCode("Escape")).toBe("Esc");
      expect(formatKeyCode("Enter")).toBe("Enter");
      expect(formatKeyCode("F5")).toBe("F5");
    });
  });
});
