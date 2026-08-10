import { describe, expect, it } from "vitest";
import { canSkipSequence, type DialogueLine } from "../src/game/systems/DialogueSystem";

/**
 * D-120 — "skip the whole talking section" must never be offered when any
 * line in the sequence requires a decision, anywhere in the sequence (not
 * just from the current position onward). `canSkipSequence` is the one
 * pure gating rule in the dialogue box's DialogueSystem, kept Phaser-free
 * (see `scenes/dialogueBox.ts`'s own comment on why) so it stays
 * unit-testable.
 */
describe("canSkipSequence", () => {
  const plain = (text: string): DialogueLine => ({ text });

  it("is true for a sequence with no decision lines", () => {
    expect(canSkipSequence([plain("a"), plain("b"), plain("c")])).toBe(true);
  });

  it("is false when any line requires a decision", () => {
    const lines: DialogueLine[] = [plain("a"), { text: "choose", hasDecision: true }, plain("c")];
    expect(canSkipSequence(lines)).toBe(false);
  });

  it("is false even when the decision line is the very first line", () => {
    const lines: DialogueLine[] = [{ text: "choose", hasDecision: true }, plain("b")];
    expect(canSkipSequence(lines)).toBe(false);
  });

  it("is true for a single-line sequence with no decision", () => {
    expect(canSkipSequence([plain("only line")])).toBe(true);
  });

  it("is false for a single-line sequence that is itself a decision", () => {
    expect(canSkipSequence([{ text: "choose", hasDecision: true }])).toBe(false);
  });
});
