/**
 * SettingsSystem — local UI-preference persistence (Phase 8: "settings persist
 * locally").
 *
 * Pure and storage-agnostic: it never touches `window.localStorage` directly,
 * so it stays unit-testable with a fake in-memory store, the same "no Phaser
 * dependency" pattern every other system in this folder follows. A scene
 * wires it to the real `localStorage` via the tiny `SettingsStorage` shape.
 *
 * Settings: animation speed (exposed to the player as "Game Speed" —
 * KI-085/D-130 — which also serves as the "reduced motion" control, since
 * "instant" skips animation entirely); master/music/SFX volume and a mute
 * toggle (D-153/KI-105) — real settings applied to Phaser's own sound
 * manager by `scenes/AudioManager.ts` (Phaser-dependent, so it lives outside
 * this folder), even though no music or sound-effect asset exists yet
 * (KI-029) — there's genuinely nothing to hear, but master volume/mute do
 * take live effect on the shared sound manager the instant they're set; a
 * one-time tutorial-seen flag rounds out the file.
 */

export type AnimationSpeed = "normal" | "fast" | "instant";

export interface Settings {
  animationSpeed: AnimationSpeed;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  animationSpeed: "normal",
  masterVolume: 75,
  musicVolume: 75,
  sfxVolume: 75,
  muted: false,
};

/** Volume is a simple 5-step cycle (0/25/50/75/100), the same "one click cycles" interaction as `nextAnimationSpeed` — no slider widget exists anywhere in this project yet. */
export const VOLUME_STEPS: readonly number[] = [0, 25, 50, 75, 100];

export function nextVolume(current: number): number {
  const i = VOLUME_STEPS.indexOf(current);
  return VOLUME_STEPS[i === -1 ? 0 : (i + 1) % VOLUME_STEPS.length];
}

export function toggleMuted(current: boolean): boolean {
  return !current;
}

/** The minimal storage shape SettingsSystem needs — matches window.localStorage. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ["normal", "fast", "instant"];

/** Shared player-facing label per speed step — used by both the Main Menu control and BattleScene's in-battle "S" hotkey. */
export const ANIMATION_SPEED_LABELS: Record<AnimationSpeed, string> = {
  normal: "Normal",
  fast: "Fast",
  instant: "Instant (reduced motion)",
};

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

function isVolumeStep(value: unknown): value is number {
  return typeof value === "number" && (VOLUME_STEPS as readonly number[]).includes(value);
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
      masterVolume: isVolumeStep(parsed.masterVolume) ? parsed.masterVolume : DEFAULT_SETTINGS.masterVolume,
      musicVolume: isVolumeStep(parsed.musicVolume) ? parsed.musicVolume : DEFAULT_SETTINGS.musicVolume,
      sfxVolume: isVolumeStep(parsed.sfxVolume) ? parsed.sfxVolume : DEFAULT_SETTINGS.sfxVolume,
      muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULT_SETTINGS.muted,
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
