import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, BESTIARY_STORAGE_KEY } from "../config";
import { ENEMY_DEFINITIONS, type EnemyDefinition, type EnemyRole } from "../data/enemies";
import {
  loadBestiaryProgress,
  isSeen,
  isKilled,
  type BestiaryProgress,
} from "../systems/BestiarySystem";
import { createOrnateButton, drawScreenBackdrop, drawParchmentPanel, FONT_DISPLAY, FONT_BODY, type OrnateButtonHandle } from "./uiTheme";

/**
 * BestiaryScene — Phase 11.6 (D-079): a read-only, unlock-on-encounter enemy
 * log. Modeled directly on `CompendiumScene`'s visual conventions (title,
 * Back button, wrapped detail-text panel) so it reads as part of the same
 * game, not a bolted-on screen. D-123 carries that same restyle forward:
 * the shared fantasy/parchment theme (`uiTheme.ts`), plus a real per-section
 * heading (gold, its own Text object) above each role group's entries on the
 * current page, instead of embedding "— MINIONS —" inline in one plain text
 * block.
 *
 * D-123 also added real pagination here for the first time. The roster grew
 * from a handful of enemies at this scene's Phase 11.6 debut to 94 by Phase
 * 25 — nine content phases each added a roster's worth of new enemies
 * without ever revisiting this screen, so the flat unpaginated text block
 * had been silently overflowing well past the bottom of the canvas for a
 * long time (a real pre-existing gap this restyle pass surfaced, not
 * something the restyle itself introduced) — see KI-079. Fixed with the
 * same Prev/Next paging mechanism `CompendiumScene` already established for
 * its own long categories (Classes/Spells/Equipment), applied to a flat,
 * role-grouped enemy list instead of a per-category one.
 *
 * Unlike the Compendium, this screen does NOT expose all data unconditionally
 * — that is the entire point of a Bestiary. An enemy the player has never
 * met in `BattleScene` (see its `markEnemySeen`/`markEnemyKilled` hooks)
 * renders as a locked "???" entry with no name, stats, or lore. Once seen it
 * reveals fully; once killed at least once it additionally gets a small
 * "[Defeated]" tag. Progress is re-read fresh every time this scene is
 * entered, so a just-finished battle's discoveries show up immediately.
 */

const PANEL_LEFT = 60;
const PANEL_TOP = 150;
const PANEL_WIDTH = GAME_WIDTH - PANEL_LEFT * 2;
const PANEL_HEIGHT = 800;
const TEXT_PAD_X = 42;
const TEXT_PAD_Y = 28;
const ENTRIES_PER_PAGE = 10;

interface RosterEntry {
  def: EnemyDefinition;
  groupLabel: string;
}

const GROUPS: { label: string; match: (role: EnemyRole | undefined) => boolean }[] = [
  { label: "Minions", match: (role) => role === undefined || role === "minion" },
  { label: "Miniboss", match: (role) => role === "miniboss" },
  { label: "Bosses", match: (role) => role === "boss" },
  // Phase 20 (D-111): without its own group, a "legendary" enemy would
  // match none of the above and silently vanish from the Bestiary.
  { label: "Legendary", match: (role) => role === "legendary" },
];

export class BestiaryScene extends Phaser.Scene {
  private sectionObjects: Phaser.GameObjects.Text[] = [];
  private roster: RosterEntry[] = [];
  private progress!: BestiaryProgress;
  private page = 0;
  private pageLabel!: Phaser.GameObjects.Text;
  private prevButton!: OrnateButtonHandle;
  private nextButton!: OrnateButtonHandle;

  constructor() {
    super("BestiaryScene");
  }

  create(): void {
    this.sectionObjects = [];
    this.page = 0;
    drawScreenBackdrop(this);

    this.add
      .text(GAME_WIDTH / 2, 42, "Bestiary", {
        fontFamily: FONT_DISPLAY,
        fontSize: "34px",
        color: "#f0dfa8",
        fontStyle: "bold",
        letterSpacing: 2 as unknown as number,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 6, true, true)
      .setDepth(1);

    createOrnateButton(this, 120, 42, 160, 44, "Back (Esc)", () => this.leave(), { variant: "tool", depth: 5 });

    this.add
      .text(
        GAME_WIDTH / 2,
        90,
        "Enemies you have encountered in battle are recorded here. Undiscovered creatures show as “???”.",
        {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: "#a89058",
          fontStyle: "italic",
        },
      )
      .setOrigin(0.5)
      .setDepth(1);

    drawParchmentPanel(this, GAME_WIDTH / 2, PANEL_TOP + PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 2);
    this.buildPaginationControls();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Bestiary visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });

    this.progress = loadBestiaryProgress(window.localStorage, BESTIARY_STORAGE_KEY);
    this.roster = this.buildRoster();
    this.renderPage();
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  private buildPaginationControls(): void {
    const y = GAME_HEIGHT - 45;
    this.prevButton = createOrnateButton(
      this,
      GAME_WIDTH / 2 - 110,
      y,
      130,
      36,
      "◀ Prev",
      () => {
        if (this.page > 0) {
          this.page--;
          this.renderPage();
        }
      },
      { variant: "tool", depth: 5 },
    );

    this.pageLabel = this.add
      .text(GAME_WIDTH / 2, y, "", {
        fontFamily: FONT_BODY,
        fontSize: "15px",
        color: "#c8b888",
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.nextButton = createOrnateButton(
      this,
      GAME_WIDTH / 2 + 110,
      y,
      130,
      36,
      "Next ▶",
      () => {
        this.page++;
        this.renderPage();
      },
      { variant: "tool", depth: 5 },
    );
  }

  /** Flattens every role group (in fixed display order) into one list, tagging each entry with its group label and whether it's the first entry of that group — so a page can show a heading only where a group actually starts. */
  private buildRoster(): RosterEntry[] {
    const all = Object.values(ENEMY_DEFINITIONS);
    const entries: RosterEntry[] = [];
    for (const group of GROUPS) {
      const defs = all.filter((d) => group.match(d.role));
      defs.forEach((def) => entries.push({ def, groupLabel: group.label }));
    }
    return entries;
  }

  private totalPages(): number {
    return Math.max(1, Math.ceil(this.roster.length / ENTRIES_PER_PAGE));
  }

  private renderPage(): void {
    for (const obj of this.sectionObjects) obj.destroy();
    this.sectionObjects = [];

    const totalPages = this.totalPages();
    this.page = Math.max(0, Math.min(this.page, totalPages - 1));
    const pageEntries = this.roster.slice(this.page * ENTRIES_PER_PAGE, (this.page + 1) * ENTRIES_PER_PAGE);

    const textLeft = PANEL_LEFT + TEXT_PAD_X;
    const wrapWidth = PANEL_WIDTH - TEXT_PAD_X * 2;
    let y = PANEL_TOP + TEXT_PAD_Y;

    let currentGroup: string | null = null;
    const flushRun = (runEntries: RosterEntry[]) => {
      if (runEntries.length === 0) return;
      const body = this.add
        .text(textLeft, y, runEntries.map((e) => this.entryText(e.def, this.progress)).join("\n\n"), {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: "#2a1a10",
          lineSpacing: 6,
          wordWrap: { width: wrapWidth },
        })
        .setDepth(3);
      this.sectionObjects.push(body);
      y += body.height + 22;
    };

    let run: RosterEntry[] = [];
    pageEntries.forEach((entry) => {
      const startsNewGroup = entry.groupLabel !== currentGroup;
      if (startsNewGroup) {
        flushRun(run);
        run = [];
        currentGroup = entry.groupLabel;
        const heading = this.add
          .text(textLeft, y, entry.groupLabel, {
            fontFamily: FONT_DISPLAY,
            fontSize: "20px",
            color: "#7a3a20",
            fontStyle: "bold",
          })
          .setDepth(3);
        this.sectionObjects.push(heading);
        y += heading.height + 8;
      }
      run.push(entry);
    });
    flushRun(run);

    this.pageLabel.setText(`Page ${this.page + 1}/${totalPages}`);
    this.prevButton.setDisabled(this.page === 0);
    this.nextButton.setDisabled(this.page >= totalPages - 1);
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
