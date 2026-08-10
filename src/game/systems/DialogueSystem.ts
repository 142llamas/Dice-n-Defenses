/**
 * DialogueSystem — pure rules for `scenes/dialogueBox.ts`'s parchment
 * dialogue box (D-119/D-120). No Phaser dependency, per this project's
 * architecture rule: rendering-only code lives in `scenes/`, but any rule
 * worth unit-testing lives here instead. `DialogueLine` is the shared data
 * shape both this file and the renderer use; `canSkipSequence` is the one
 * real rule so far.
 */

export interface DialogueLine {
  /** Undefined = the player's own PC, or plain narration — no portrait, no name plate. */
  speakerName?: string;
  /** Portrait asset key (see `data/portraitManifest.ts`). Ignored when `speakerName` is undefined. */
  portraitKey?: string;
  text: string;
  /**
   * D-120: true if reaching this line means the player must make a choice.
   * No choice-rendering UI exists yet (`CAMPAIGN_STORY_DESIGN.md`'s branch
   * choices are still just design text) — this is a forward-compatible
   * GATING FLAG ONLY, consumed solely by `canSkipSequence` below. Nothing
   * produces a line with this set today.
   */
  hasDecision?: boolean;
}

/**
 * True if a "skip the whole sequence" control may be shown for `lines` —
 * false the instant ANY line requires a decision, anywhere in the
 * sequence (not just from the current position onward), since skipping
 * must never let a player bypass a choice they haven't reached yet either.
 */
export function canSkipSequence(lines: readonly DialogueLine[]): boolean {
  return !lines.some((line) => line.hasDecision);
}
