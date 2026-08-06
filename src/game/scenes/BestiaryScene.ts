import Phaser from "phaser";
import { GAME_WIDTH, BESTIARY_STORAGE_KEY } from "../config";
import { ENEMY_DEFINITIONS, type EnemyDefinition, type EnemyRole } from "../data/enemies";
import {
  loadBestiaryProgress,
  isSeen,
  isKilled,
  type BestiaryProgress,
} from "../systems/BestiarySystem";

/**
 * BestiaryScene — Phase 11.6 (D-079): a read-only, unlock-on-encounter enemy
 * log. Modeled directly on `CompendiumScene`'s visual conventions (title,
 * Back button, wrapped detail-text panel, the same `buildButton` helper
 * style) so it reads as part of the same game, not a bolted-on screen.
 *
 * Unlike the Compendium, this screen does NOT expose all data unconditionally
 * — that is the entire point of a Bestiary. An enemy the player has never
 * met in `BattleScene` (see its `markEnemySeen`/`markEnemyKilled` hooks)
 * renders as a locked "???" entry with no name, stats, or lore. Once seen it
 * reveals fully; once killed at least once it additionally gets a small
 * "[Defeated]" tag. Progress is re-read fresh every time this scene is
 * entered, so a just-finished battle's discoveries show up immediately.
 */
export class BestiaryScene extends Phaser.Scene {
  private detailText!: Phaser.GameObjects.Text;

  constructor() {
    super("BestiaryScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0e0e14");

    this.add
      .text(GAME_WIDTH / 2, 40, "Bestiary", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.buildButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());

    this.add
      .text(
        GAME_WIDTH / 2,
        90,
        "Enemies you have encountered in battle are recorded here. Undiscovered creatures show as “???”.",
        {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "14px",
          color: "#8a8aa0",
        },
      )
      .setOrigin(0.5);

    this.detailText = this.add.text(80, 130, "", {
      fontFamily: "system-ui, Arial, sans-serif",
      fontSize: "14px",
      color: "#c8c8d8",
      lineSpacing: 6,
      wordWrap: { width: GAME_WIDTH - 160 },
    });

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Bestiary visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });

    this.renderRoster();
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  /** Small button+label pair, matching CompendiumScene's simple rectangle-button style. */
  private buildButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    color: number,
    onClick: () => void,
  ): { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const rect = this.add
      .rectangle(x, y, w, h, color)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, text, {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "14px",
        color: "#e8e8f0",
      })
      .setOrigin(0.5);
    rect.on("pointerdown", onClick);
    return { rect, label };
  }

  /** Groups the roster by role, in a fixed display order, skipping empty groups. */
  private renderRoster(): void {
    const progress = loadBestiaryProgress(window.localStorage, BESTIARY_STORAGE_KEY);
    const all = Object.values(ENEMY_DEFINITIONS);

    const groups: { label: string; match: (role: EnemyRole | undefined) => boolean }[] = [
      { label: "MINIONS", match: (role) => role === undefined || role === "minion" },
      { label: "MINIBOSS", match: (role) => role === "miniboss" },
      { label: "BOSSES", match: (role) => role === "boss" },
      // Phase 20 (D-111): without its own group, a "legendary" enemy would
      // match none of the above and silently vanish from the Bestiary.
      { label: "LEGENDARY", match: (role) => role === "legendary" },
    ];

    const sections = groups
      .map((group) => {
        const defs = all.filter((d) => group.match(d.role));
        if (defs.length === 0) return null;
        const lines = defs.map((d) => this.entryText(d, progress));
        return `— ${group.label} —\n\n${lines.join("\n\n")}`;
      })
      .filter((s): s is string => s !== null);

    this.detailText.setText(sections.join("\n\n\n"));
  }

  /** Renders one enemy's entry: a locked "???" line if unseen, full detail otherwise. */
  private entryText(def: EnemyDefinition, progress: BestiaryProgress): string {
    if (!isSeen(progress, def.id)) {
      return "???  (not yet encountered)";
    }
    const defeatedTag = isKilled(progress, def.id) ? "  [Defeated]" : "";
    const stats =
      `HP ${def.maxHealth} · AC ${def.armorClass} · ATK ${def.attackDamage}` +
      ` (range ${def.attackRangeTiles}) · MOVE ${def.movementTiles} tiles (${def.movementType})` +
      ` · reward ${def.rewardGold}g`;
    const lore = def.loreText ? `\n    ${def.loreText}` : "";
    return `${def.name}${defeatedTag}\n    ${stats}${lore}`;
  }
}
