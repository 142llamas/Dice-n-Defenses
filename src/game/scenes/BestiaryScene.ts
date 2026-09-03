import Phaser from "phaser";
import { BESTIARY_STORAGE_KEY } from "../config";
import { ENEMY_DEFINITIONS, type EnemyDefinition, type EnemyRole } from "../data/enemies";
import {
  loadBestiaryProgress,
  isSeen,
  isKilled,
  type BestiaryProgress,
} from "../systems/BestiarySystem";
import {
  createOrnateButton,
  centeredRowX,
  drawScreenBackdrop,
  drawParchmentPanel,
  getViewport,
  onViewportResize,
  FONT_DISPLAY,
  FONT_BODY,
  type OrnateButtonHandle,
} from "./uiTheme";

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
 *
 * D-150: replaced the single flat, role-grouped, continuously-paginated
 * scroll with real tabs — one per `GROUPS` entry — per Kevin's "tabs by
 * enemy role/type instead of one long scroll" request. Each tab now filters
 * the roster down to just that role before paginating, so Prev/Next only
 * ever pages within the role you're currently looking at; switching roles
 * resets to page 1, same as switching a Compendium category tab already
 * does.
 */

const PANEL_LEFT = 60;
const PANEL_TOP = 168;
const PANEL_HEIGHT = 782;
const TEXT_PAD_X = 42;
const TEXT_PAD_Y = 28;
const ENTRIES_PER_PAGE = 10;

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
  private roster: EnemyDefinition[] = [];
  private progress!: BestiaryProgress;
  private page = 0;
  private groupIndex = 0;
  private tabButtons: OrnateButtonHandle[] = [];
  private pageLabel!: Phaser.GameObjects.Text;
  private prevButton!: OrnateButtonHandle;
  private nextButton!: OrnateButtonHandle;
  private layoutRoot?: Phaser.GameObjects.Container;

  constructor() {
    super("BestiaryScene");
  }

  create(): void {
    this.sectionObjects = [];
    this.page = 0;
    this.groupIndex = 0;
    this.progress = loadBestiaryProgress(window.localStorage, BESTIARY_STORAGE_KEY);
    this.roster = this.buildRoster();

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Bestiary visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds the whole screen against the current viewport,
  // deliberately preserving `this.page`/`this.groupIndex` (only `create()`
  // resets those) so a resize doesn't silently snap back to page 1/Minions.
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    this.tabButtons = [];
    const { width, height } = getViewport(this);
    const panelWidth = width - PANEL_LEFT * 2;

    drawScreenBackdrop(this);

    this.add
      .text(width / 2, 42, "Bestiary", {
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

    // D-217 (item 6): mirrors CompendiumScene's new direct link — "Back"
    // still goes straight to Main Menu (unchanged), this jumps sideways to
    // the other half of the Knowledge Base instead.
    createOrnateButton(this, width - 150, 42, 160, 44, "Compendium", () => this.scene.start("CompendiumScene"), {
      variant: "tool",
      depth: 5,
      tooltip: "Jump directly to the Compendium",
    });

    this.add
      .text(
        width / 2,
        84,
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

    this.buildTabs(width);

    drawParchmentPanel(this, width / 2, PANEL_TOP + PANEL_HEIGHT / 2, panelWidth, PANEL_HEIGHT, 2);
    this.buildPaginationControls(width, height);

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);

    this.renderPage(panelWidth);
  }

  /** D-150: one tab per role group, mirroring `CompendiumScene.buildTabs`'s pattern. */
  private buildTabs(width: number): void {
    const y = 122;
    const w = 150;
    const gap = 8;
    const panelWidth = width - PANEL_LEFT * 2;
    const { xs, itemWidth } = centeredRowX(GROUPS.length, w, gap, width / 2, width - 80);
    GROUPS.forEach((group, i) => {
      const handle = createOrnateButton(
        this,
        xs[i],
        y,
        itemWidth,
        34,
        group.label,
        () => {
          this.groupIndex = i;
          this.page = 0;
          this.refreshTabHighlights();
          this.roster = this.buildRoster();
          this.renderPage(panelWidth);
        },
        { variant: "tab", depth: 5 },
      );
      this.tabButtons.push(handle);
    });
    this.refreshTabHighlights();
  }

  private refreshTabHighlights(): void {
    GROUPS.forEach((_, i) => this.tabButtons[i].setSelected(i === this.groupIndex));
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  private buildPaginationControls(width: number, height: number): void {
    const y = height - 45;
    const panelWidth = width - PANEL_LEFT * 2;
    this.prevButton = createOrnateButton(
      this,
      width / 2 - 110,
      y,
      130,
      36,
      "◀ Prev",
      () => {
        if (this.page > 0) {
          this.page--;
          this.renderPage(panelWidth);
        }
      },
      { variant: "tool", depth: 5 },
    );

    this.pageLabel = this.add
      .text(width / 2, y, "", {
        fontFamily: FONT_BODY,
        fontSize: "15px",
        color: "#c8b888",
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.nextButton = createOrnateButton(
      this,
      width / 2 + 110,
      y,
      130,
      36,
      "Next ▶",
      () => {
        this.page++;
        this.renderPage(panelWidth);
      },
      { variant: "tool", depth: 5 },
    );
  }

  /** D-150: only the CURRENTLY SELECTED tab's role, now that role is chosen by tab rather than shown as one continuous grouped scroll. */
  private buildRoster(): EnemyDefinition[] {
    const group = GROUPS[this.groupIndex];
    return Object.values(ENEMY_DEFINITIONS).filter((d) => group.match(d.role));
  }

  private totalPages(): number {
    return Math.max(1, Math.ceil(this.roster.length / ENTRIES_PER_PAGE));
  }

  private renderPage(panelWidth: number): void {
    for (const obj of this.sectionObjects) obj.destroy();
    this.sectionObjects = [];

    const totalPages = this.totalPages();
    this.page = Math.max(0, Math.min(this.page, totalPages - 1));
    const pageEntries = this.roster.slice(this.page * ENTRIES_PER_PAGE, (this.page + 1) * ENTRIES_PER_PAGE);

    const textLeft = PANEL_LEFT + TEXT_PAD_X;
    const wrapWidth = panelWidth - TEXT_PAD_X * 2;

    const heading = this.add
      .text(textLeft, PANEL_TOP + TEXT_PAD_Y, `${GROUPS[this.groupIndex].label} (${this.roster.length})`, {
        fontFamily: FONT_DISPLAY,
        fontSize: "20px",
        color: "#7a3a20",
        fontStyle: "bold",
      })
      .setDepth(3);
    this.sectionObjects.push(heading);

    const body = this.add
      .text(
        textLeft,
        PANEL_TOP + TEXT_PAD_Y + heading.height + 12,
        pageEntries.map((def) => this.entryText(def, this.progress)).join("\n\n"),
        {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: "#2a1a10",
          lineSpacing: 6,
          wordWrap: { width: wrapWidth },
        },
      )
      .setDepth(3);
    this.sectionObjects.push(body);

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
