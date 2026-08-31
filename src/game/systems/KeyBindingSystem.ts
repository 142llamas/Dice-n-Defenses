/**
 * KeyBindingSystem — local persistence for the three rebindable in-battle
 * keys (Phase 3, D-205: "Confirm/Cancel/Bonus Action keyboard-bindable,
 * XCOM2-style").
 *
 * Pure and storage-agnostic, mirroring `SettingsSystem.ts`'s own
 * `loadSettings`/`saveSettings` shape exactly — no Phaser dependency, unit-
 * testable with a fake in-memory store.
 *
 * A binding's value is a native `KeyboardEvent.code` (e.g. `"Enter"`,
 * `"Escape"`, `"KeyR"`, `"F5"`) rather than one of Phaser's own named
 * `keydown-KEYNAME` sugar events — `.code` is layout-independent and is what
 * a generic "press any key to rebind" capture in `SettingsScene` reads
 * directly off the raw browser event, with no per-key translation table.
 *
 * This is a FULL replace, not an additive second key (Kevin's explicit
 * choice): rebinding "cancel" away from its default `"Escape"` means the
 * physical Escape key stops cancelling an in-battle pending move/menu —
 * every OTHER scene (Main Menu, Settings, Pause Menu, etc.) has its own
 * independent Esc handler and is unaffected. `SPACE` remains a separate,
 * permanent, non-rebindable Confirm alias in `BattleScene` regardless of
 * where "confirm" is rebound to (see its own keydown listener there).
 */

export type RebindableAction = "confirm" | "cancel" | "bonusAction";

/** Shared player-facing label per rebindable action — used by SettingsScene's own rows and its conflict-rejection message. */
export const REBINDABLE_ACTION_LABELS: Record<RebindableAction, string> = {
  confirm: "Confirm",
  cancel: "Cancel",
  bonusAction: "Bonus Action",
};

export interface KeyBindings {
  confirm: string;
  cancel: string;
  bonusAction: string;
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  confirm: "Enter",
  cancel: "Escape",
  bonusAction: "KeyR",
};

/**
 * Every OTHER fixed (non-rebindable) `BattleScene` keydown binding, as native
 * `KeyboardEvent.code` values — a rebind may not steal one of these. Kept as
 * a plain list rather than deriving it from `BattleScene` itself, since that
 * scene is Phaser-dependent and this file must stay Phaser-free; if a new
 * fixed hotkey is ever added there, add its code here too.
 */
export const RESERVED_FIXED_KEY_CODES: readonly string[] = [
  "KeyE", // end turn
  "KeyB", // build mode
  "KeyG", // equip mode
  "KeyQ", // ability
  "KeyP", // potion
  "KeyF", // action surge
  "KeyT", // class action
  "KeyC", // character sheet
  "KeyH", // tutorial
  "KeyS", // cycle game speed
  "KeyL", // technical log
  "Space", // permanent Confirm alias
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  // Shift+1..6 (ability hotkey bar) share these same base codes with
  // hero-select; a plain (non-Shift) rebind to one of these is already
  // blocked above, and the rebind capture never distinguishes modifier keys,
  // so Digit5/Digit6 don't additionally need listing — Shift+5/6 have no
  // unmodified meaning of their own to protect.
];

/** The minimal storage shape this system needs — matches window.localStorage. */
export interface KeyBindingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Read key bindings from storage, falling back to defaults on missing/corrupt data (per field). */
export function loadKeyBindings(storage: KeyBindingStorage, key: string): KeyBindings {
  const raw = storage.getItem(key);
  if (!raw) return { ...DEFAULT_KEY_BINDINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<KeyBindings>;
    return {
      confirm: isNonEmptyString(parsed.confirm) ? parsed.confirm : DEFAULT_KEY_BINDINGS.confirm,
      cancel: isNonEmptyString(parsed.cancel) ? parsed.cancel : DEFAULT_KEY_BINDINGS.cancel,
      bonusAction: isNonEmptyString(parsed.bonusAction) ? parsed.bonusAction : DEFAULT_KEY_BINDINGS.bonusAction,
    };
  } catch {
    return { ...DEFAULT_KEY_BINDINGS };
  }
}

export function saveKeyBindings(storage: KeyBindingStorage, key: string, bindings: KeyBindings): void {
  storage.setItem(key, JSON.stringify(bindings));
}

/**
 * Whether assigning `code` to `action` would conflict with something already
 * using it — the OTHER two rebindable actions, or the fixed reserved list.
 * Reassigning an action to the code IT ALREADY HOLDS is never a conflict
 * (re-picking the same key). Returns the specific conflicting action, the
 * literal `"reserved"` tag, or `null` (no conflict — safe to bind).
 */
export function keyBindingConflict(
  bindings: KeyBindings,
  action: RebindableAction,
  code: string,
): RebindableAction | "reserved" | null {
  const others = (Object.keys(bindings) as RebindableAction[]).filter((a) => a !== action);
  const clashing = others.find((a) => bindings[a] === code);
  if (clashing) return clashing;
  if (RESERVED_FIXED_KEY_CODES.includes(code)) return "reserved";
  return null;
}

/**
 * A short, human-readable form of a native `KeyboardEvent.code` for
 * `SettingsScene`'s rebind rows — strips the `Key`/`Digit`/`Arrow` prefixes
 * (`"KeyR"` -> `"R"`, `"Digit1"` -> `"1"`, `"ArrowUp"` -> `"Up"`), shortens
 * `"Escape"` to `"Esc"`, and passes anything else (`"Enter"`, `"Space"`,
 * `"F5"`, `"Backspace"`, ...) through unchanged.
 */
export function formatKeyCode(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code === "Escape") return "Esc";
  return code;
}
