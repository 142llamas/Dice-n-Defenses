/**
 * SettingsSystem — local UI-preference persistence (Phase 8: "settings persist
 * locally").
 *
 * Pure and storage-agnostic: it never touches `window.localStorage` directly,
 * so it stays unit-testable with a fake in-memory store, the same "no Phaser
 * dependency" pattern every other system in this folder follows. A scene
 * wires it to the real `localStorage` via the tiny `SettingsStorage` shape.
 *
 * Deliberately small: one setting (animation speed, which also serves as the
 * "reduced motion" control — "instant" skips animation entirely) plus a
 * one-time tutorial-seen flag. No volume/audio setting exists because there
 * is no audio system yet (see KNOWN_ISSUES) — adding a control for a system
 * that doesn't exist would be unused scaffolding.
 */

export type AnimationSpeed = "normal" | "fast" | "instant";

export interface Settings {
  animationSpeed: AnimationSpeed;
}

export const DEFAULT_SETTINGS: Settings = {
  animationSpeed: "normal",
};

/** The minimal storage shape SettingsSystem needs — matches window.localStorage. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ["normal", "fast", "instant"];

/** Cycle to the next animation speed option, wrapping around. */
export function nextAnimationSpeed(current: AnimationSpeed): AnimationSpeed {
  const i = ANIMATION_SPEEDS.indexOf(current);
  return ANIMATION_SPEEDS[(i + 1) % ANIMATION_SPEEDS.length];
}

/**
 * Multiplier applied to a base animation duration in milliseconds. "instant"
 * returns 0 so a caller can skip tweening entirely (the "reduced motion" case)
 * rather than running a zero-length tween.
 */
export function durationScaleFor(speed: AnimationSpeed): number {
  switch (speed) {
    case "fast":
      return 0.4;
    case "instant":
      return 0;
    default:
      return 1;
  }
}

function isAnimationSpeed(value: unknown): value is AnimationSpeed {
  return typeof value === "string" && (ANIMATION_SPEEDS as readonly string[]).includes(value);
}

/** Read settings from storage, falling back to defaults on missing/corrupt data. */
export function loadSettings(storage: SettingsStorage, key: string): Settings {
  const raw = storage.getItem(key);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      animationSpeed: isAnimationSpeed(parsed.animationSpeed)
        ? parsed.animationSpeed
        : DEFAULT_SETTINGS.animationSpeed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: SettingsStorage, key: string, settings: Settings): void {
  storage.setItem(key, JSON.stringify(settings));
}

/** True once the player has dismissed the one-time tutorial prompt before. */
export function hasSeenTutorial(storage: SettingsStorage, key: string): boolean {
  return storage.getItem(key) === "1";
}

export function markTutorialSeen(storage: SettingsStorage, key: string): void {
  storage.setItem(key, "1");
}
