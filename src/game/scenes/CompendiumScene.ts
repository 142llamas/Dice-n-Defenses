import Phaser from "phaser";
import { CLASS_DEFINITIONS, getClassDefinition } from "../data/classes";
import { SUBCLASS_DEFINITIONS } from "../data/subclasses";
import { RACE_DEFINITIONS } from "../data/races";
import { FEATS, FEAT_IDS } from "../data/feats";
import { SPELLS } from "../data/spells";
import { EQUIPMENT_DEFINITIONS, EQUIPMENT_ORDER, GEAR_SLOT_TYPE_LABELS, RARITY_LABELS } from "../data/equipment";
import { WEAPON_MASTERIES, WEAPON_PROPERTY_LABELS } from "../data/weapons";
import { POTION_DEFINITIONS, POTION_ORDER } from "../data/potions";
import { STATUS_EFFECTS, STATUS_EFFECT_ORDER } from "../data/statusEffects";
import { STRUCTURE_DEFINITIONS, type StructureDefinition } from "../data/structures";
import { ABILITY_SCORE_NAMES } from "../data/abilityScores";
import { SKILLS, SKILL_ORDER } from "../data/skills";
import { PORTRAIT_MANIFEST } from "../data/portraitManifest";
import { showDialogue, type DialogueBoxController, type DialogueLine } from "./dialogueBox";
import { createTooltipController, attachHoverTooltip, type TooltipController } from "./tooltip";
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
 * CompendiumScene — Phase 11.5's in-game rules/spell/feat/equipment lookup
 * index (DECISIONS D-071/D-078). Read-only: this scene renders EXISTING data
 * (classes, subclasses, races, feats, skills, spells, equipment, potions,
 * status effects), it does not add or duplicate any content of its own — a
 * future class/spell/item needs no Compendium change, only its own
 * data-file entry.
 *
 * D-123: restyled with the shared fantasy/parchment UI theme (`uiTheme.ts`)
 * — same rules-lookup data and paging logic as before, now presented as a
 * bound tome (a parchment reading panel, ornate tab/selector buttons with
 * real hover/click feedback) instead of a flat dark screen of plain grey
 * rectangles. No category, pagination, or data-lookup behavior changed.
 *
 * Phase 13.5 (D-090) added the Skills tab — reference-only, same as most of
 * Feats/Races/Subclasses already were: nothing in this game calls a skill
 * check yet, so this is purely a rules-lookup convenience, not a sign a
 * skill-check mechanic exists.
 *
 * Reached from a new MainMenuScene button, alongside START and Create Party,
 * so it never interferes with either existing entry point.
 *
 * Classes gets its own per-class selector (four 20-level tables run 18-21
 * features each) and Spells (Phase 15/D-104, 318 entries) gets an analogous
 * per-level selector (Cantrip/1st/.../9th) — both on top of the same
 * Prev/Next paging every other category now shares (D-165).
 *
 * D-119 added a "Dialogue" tab — NOT a rules-lookup category like the rest
 * of this scene, but a preview/demo entry point for the new
 * `scenes/dialogueBox.ts` parchment-panel dialogue renderer, since no real
 * chapter/story content exists yet to trigger it naturally. Lets Kevin see
 * and tune the styling in-browser before any images or story content are
 * ready.
 *
 * D-150 added "Buildings" and "Traps" tabs — `STRUCTURE_DEFINITIONS`
 * (`data/structures.ts`) had never had a Compendium category of its own;
 * a player could only see wall/platform/trap detail by opening the Build
 * shop mid-battle. Split by `StructureDefinition.kind` (walls+platforms are
 * "Buildings", traps get their own tab) since the two play very
 * differently, then grouped by sub-type (wall vs. platform; ground- vs.
 * flying-targeted trap) and alphabetized within each group, per Kevin's
 * "grouped by type, then alphabetical" request. Includes the two
 * spell-conjured, non-shop-buyable entries (Spectral Wall, Web Patch) same
 * as every other category here shows ALL data, not just what happens to be
 * purchasable right now.
 *
 * D-165 (KI-098 item 1): every itemized category (all but the "Dialogue"
 * demo tab) now renders as a paginated list of compact one-line rows via
 * `renderRowList` instead of one giant `detailText` blob with every entry's
 * full description permanently visible — the last screen still doing that
 * after D-158 generalized every other item preview (Gear/Shop) to the
 * shared `tooltip.ts` hover controller. A row's full description now shows
 * on hover, same as a Gear/Shop item button; a nested category (Subclasses'
 * per-feature list, Races' per-trait list, Buildings'/Traps' sub-groups)
 * gets its own non-interactive `isGroupHeader` divider row.
 */

type CategoryId =
  | "classes"
  | "subclasses"
  | "races"
  | "feats"
  | "skills"
  | "spells"
  | "equipment"
  | "potions"
  | "buildings"
  | "traps"
  | "statusEffects"
  | "dialoguePreview";

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "classes", label: "Classes" },
  { id: "subclasses", label: "Subclasses" },
  { id: "races", label: "Races" },
  { id: "feats", label: "Feats" },
  { id: "skills", label: "Skills" },
  { id: "spells", label: "Spells" },
  { id: "equipment", label: "Equipment" },
  { id: "potions", label: "Potions" },
  { id: "buildings", label: "Buildings" },
  { id: "traps", label: "Traps" },
  { id: "statusEffects", label: "Status Effects" },
  { id: "dialoguePreview", label: "Dialogue" },
];

/** D-119: a sample line of each dialogue style (narrator/PC vs. NPC), for the preview tab. */
const DIALOGUE_PREVIEW_LINES: DialogueLine[] = [
  {
    text: "The chapter behind you fades, replaced by warm afternoon light and the smell of woodsmoke.",
  },
  {
    speakerName: "Sample Companion",
    portraitKey: "portrait-preview-demo",
    text: "This is what an NPC line looks like: a framed portrait on the left — a placeholder silhouette until real art is dropped in — their name underneath, and their line here on the parchment.",
  },
  {
    speakerName: "Sample Companion",
    portraitKey: "portrait-preview-demo",
    text: 'Multiple lines page through with the Continue button, or by clicking anywhere on the panel, or pressing Space/Enter. This is line 3 of 3 — notice the "Skip ▶▶" button up top: this whole sequence has no pending decision, so it’s available.',
  },
];

/** D-120: same idea, but the last line requires a decision — demonstrates the Skip button correctly disappearing. */
const DIALOGUE_PREVIEW_LINES_WITH_DECISION: DialogueLine[] = [
  {
    text: "This sequence is otherwise identical, but ends on a line that requires a decision.",
  },
  {
    speakerName: "Sample Companion",
    portraitKey: "portrait-preview-demo",
    text: 'Notice the "Skip ▶▶" button is gone this time — skipping the whole sequence must never let a player miss a choice, even one they haven’t reached yet.',
    hasDecision: true,
  },
];

const SPELL_LEVEL_LABELS = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

/** D-165: one compact, always-visible row; `tooltip` (its full description) shows via the shared hover controller. A row with no `tooltip` is a non-interactive divider (a race/subclass name, a "— Walls & Gates —" group label). */
interface DetailRow {
  text: string;
  tooltip?: string;
  isGroupHeader?: boolean;
}

/** D-165: fixed line height for `renderRowList`'s paginated rows — page size is derived from this against the panel's actual available height, not a per-category constant, since every category now shares the same renderer. */
const ROW_HEIGHT = 24;

/**
 * Detail panel bounds — a bound-tome reading pane every category renders
 * into. Width is D-154 viewport-derived (`getViewport(this).width -
 * PANEL_LEFT * 2`, computed fresh in `rebuildLayout`), not a fixed constant.
 */
const PANEL_LEFT = 60;
const PANEL_TOP = 190;
const PANEL_HEIGHT = 760;
const TEXT_PAD_X = 42;
const TEXT_PAD_Y = 30;

export class CompendiumScene extends Phaser.Scene {
  private category: CategoryId = "classes";
  private classId: string = CLASS_DEFINITIONS[0].id;
  private spellLevel = 0;
  private page = 0;

  private tabButtons: OrnateButtonHandle[] = [];
  private subButtons: OrnateButtonHandle[] = [];
  private detailText!: Phaser.GameObjects.Text;
  private detailRows: Phaser.GameObjects.Text[] = [];
  private tooltip!: TooltipController;
  private pageLabel!: Phaser.GameObjects.Text;
  private prevButton!: OrnateButtonHandle;
  private nextButton!: OrnateButtonHandle;
  private activeDialogue: DialogueBoxController | undefined;
  private layoutRoot?: Phaser.GameObjects.Container;

  constructor() {
    super("CompendiumScene");
  }

  /** D-119: loads any real dialogue portraits once they exist — a no-op today, PORTRAIT_MANIFEST is empty. */
  preload(): void {
    for (const [key, path] of Object.entries(PORTRAIT_MANIFEST)) {
      this.load.image(key, path);
    }
  }

  create(): void {
    // Reset every time (KI-030's "restart never accumulates state" rule
    // applies here too: repeated menu <-> Compendium visits should behave
    // identically, not drift with leftover selection).
    this.category = "classes";
    this.classId = CLASS_DEFINITIONS[0].id;
    this.spellLevel = 0;
    this.page = 0;
    this.activeDialogue = undefined;
    this.detailRows = [];
    this.tooltip = createTooltipController(this);

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Compendium visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
      this.activeDialogue?.destroy();
      this.activeDialogue = undefined;
      this.tooltip.destroy();
    });
    onViewportResize(this, () => this.rebuildLayout());
  }

  // D-154: rebuilds the whole screen against the current viewport, then
  // re-renders whatever category/sub-selection is already active — mirrors
  // `BestiaryScene.rebuildLayout`'s "preserve state, only `create()` resets
  // it" convention, since a resize shouldn't bounce the player back to
  // Classes/page 1.
  private rebuildLayout(): void {
    this.layoutRoot?.destroy();
    const before = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    this.tabButtons = [];
    this.subButtons = [];
    const { width, height } = getViewport(this);
    const panelWidth = width - PANEL_LEFT * 2;

    drawScreenBackdrop(this);

    this.add
      .text(width / 2, 42, "Compendium", {
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

    this.buildTabs(width);

    drawParchmentPanel(this, width / 2, PANEL_TOP + PANEL_HEIGHT / 2, panelWidth, PANEL_HEIGHT, 2);

    this.detailText = this.add.text(PANEL_LEFT + TEXT_PAD_X, PANEL_TOP + TEXT_PAD_Y, "", {
      fontFamily: FONT_BODY,
      fontSize: "15px",
      color: "#2a1a10",
      lineSpacing: 7,
      wordWrap: { width: panelWidth - TEXT_PAD_X * 2 },
    }).setDepth(3);

    this.buildPaginationControls(width, height);

    const created = this.children.list.filter((c) => !before.has(c));
    this.layoutRoot = this.add.container(0, 0);
    this.layoutRoot.add(created);

    this.renderCategory();
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  private buildTabs(width: number): void {
    const y = 108;
    const w = 138;
    const gap = 6;
    const { xs, itemWidth } = centeredRowX(CATEGORIES.length, w, gap, width / 2, width - 80);
    CATEGORIES.forEach((cat, i) => {
      const handle = createOrnateButton(
        this,
        xs[i],
        y,
        itemWidth,
        34,
        cat.label,
        () => {
          this.category = cat.id;
          this.page = 0;
          this.renderCategory();
        },
        { variant: "tab", depth: 5 },
      );
      this.tabButtons.push(handle);
    });
  }

  private buildPaginationControls(width: number, height: number): void {
    const y = height - 55;
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
          this.renderPaginatedDetail();
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
        this.renderPaginatedDetail();
      },
      { variant: "tool", depth: 5 },
    );
  }

  private hidePagination(): void {
    this.prevButton.container.setVisible(false);
    this.nextButton.container.setVisible(false);
    this.pageLabel.setVisible(false);
  }

  private showPagination(totalPages: number): void {
    const show = totalPages > 1;
    this.prevButton.container.setVisible(show);
    this.nextButton.container.setVisible(show);
    this.pageLabel.setVisible(show);
    if (show) this.pageLabel.setText(`Page ${this.page + 1}/${totalPages}`);
  }

  private clearSubButtons(): void {
    this.subButtons.forEach((b) => b.destroy());
    this.subButtons = [];
  }

  private clearDetailRows(): void {
    this.detailRows.forEach((r) => r.destroy());
    this.detailRows = [];
  }

  /**
   * D-165: the shared paginated hover-tooltip row renderer every itemized
   * category now goes through. `headerLine` is an optional plain summary
   * shown above the list (Classes' stat line, Spells' count line) — pass
   * `null` for categories that never had one. Page size is derived from the
   * panel's real remaining height so every category shares one mechanism
   * without a per-category "how many fit" constant.
   */
  private renderRowList(headerLine: string | null, panelWidth: number, rows: DetailRow[]): void {
    this.clearDetailRows();
    this.detailText.setText(headerLine ?? "");

    const startX = PANEL_LEFT + TEXT_PAD_X;
    const startY = PANEL_TOP + TEXT_PAD_Y + (headerLine ? 34 : 0);
    const available = PANEL_TOP + PANEL_HEIGHT - 50 - startY;
    const rowsPerPage = Math.max(1, Math.floor(available / ROW_HEIGHT));
    const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
    this.page = Math.max(0, Math.min(this.page, totalPages - 1));
    const pageRows = rows.slice(this.page * rowsPerPage, (this.page + 1) * rowsPerPage);

    pageRows.forEach((row, i) => {
      const y = startY + i * ROW_HEIGHT;
      const t = this.add
        .text(startX, y, row.text, {
          fontFamily: FONT_BODY,
          fontSize: "15px",
          color: row.isGroupHeader ? "#7a3a10" : "#2a1a10",
          fontStyle: row.isGroupHeader ? "bold" : "normal",
          wordWrap: { width: panelWidth - TEXT_PAD_X * 2 },
        })
        .setDepth(3);
      if (row.tooltip) {
        const tooltipText = row.tooltip;
        t.setInteractive({ useHandCursor: true });
        t.on("pointerover", () => t.setColor("#5a2a08"));
        t.on("pointerout", () => t.setColor("#2a1a10"));
        attachHoverTooltip(this.tooltip, t, startX + t.width / 2, y, () => tooltipText);
      }
      this.detailRows.push(t);
    });

    this.showPagination(totalPages);
  }

  private refreshTabHighlights(): void {
    CATEGORIES.forEach((cat, i) => {
      this.tabButtons[i].setSelected(cat.id === this.category);
    });
  }

  private renderCategory(): void {
    this.refreshTabHighlights();
    this.clearSubButtons();
    this.clearDetailRows();
    // Switching tabs while a preview dialogue is open shouldn't leave it
    // dangling behind the newly-rendered category.
    this.activeDialogue?.destroy();
    this.activeDialogue = undefined;

    switch (this.category) {
      case "classes":
        this.buildClassSelector();
        this.renderClassDetail();
        break;
      case "spells":
        this.buildSpellLevelSelector();
        this.renderSpellsDetail();
        break;
      case "equipment":
        this.renderEquipmentDetail();
        break;
      case "subclasses":
        this.renderSubclassesDetail();
        break;
      case "races":
        this.renderRacesDetail();
        break;
      case "feats":
        this.renderFeatsDetail();
        break;
      case "skills":
        this.renderSkillsDetail();
        break;
      case "potions":
        this.renderPotionsDetail();
        break;
      case "buildings":
        this.renderBuildingsDetail();
        break;
      case "traps":
        this.renderTrapsDetail();
        break;
      case "statusEffects":
        this.renderStatusEffectsDetail();
        break;
      case "dialoguePreview":
        this.hidePagination();
        this.renderDialoguePreviewTab();
        break;
    }
  }

  /**
   * D-119/D-120: not a rules lookup — a preview/demo entry point for
   * `scenes/dialogueBox.ts`'s parchment-panel renderer, so the styling and
   * the skip controls can be seen and tuned in-browser before any real
   * chapter/story content or portrait art exists.
   */
  private renderDialoguePreviewTab(): void {
    this.detailText.setText(
      "Preview of the stylized dialogue box built for chapter-boundary story text " +
        "(CAMPAIGN_STORY_DESIGN.md). Both samples show both speaker styles: a " +
        "narrator/PC line (full-width text, no portrait) and an NPC line (framed " +
        "portrait + name plate — a placeholder silhouette until real art exists for " +
        'the "portrait-preview-demo" key). Advance with Continue, a click anywhere ' +
        "on the panel, or Space/Enter. The first sample has no pending decision, so " +
        'a "Skip ▶▶" button is offered; the second ends on a line that requires a ' +
        "decision, so that button is correctly withheld.",
    );
    const showSample = (lines: DialogueLine[]) => {
      this.activeDialogue?.destroy();
      this.activeDialogue = showDialogue(this, lines, () => {
        this.activeDialogue = undefined;
      });
    };
    const { xs } = centeredRowX(2, 280, 20, getViewport(this).width / 2, getViewport(this).width - 80);
    this.subButtons.push(
      createOrnateButton(this, xs[0], 480, 280, 46, "Show Sample (skippable)", () => showSample(DIALOGUE_PREVIEW_LINES), {
        variant: "secondary",
        depth: 5,
      }),
      createOrnateButton(
        this,
        xs[1],
        480,
        280,
        46,
        "Show Sample (with a decision)",
        () => showSample(DIALOGUE_PREVIEW_LINES_WITH_DECISION),
        { variant: "secondary", depth: 5 },
      ),
    );
  }

  /** Dispatches Prev/Next to whichever category is currently paginated — every itemized category now is (D-165). */
  private renderPaginatedDetail(): void {
    switch (this.category) {
      case "spells":
        this.renderSpellsDetail();
        break;
      case "equipment":
        this.renderEquipmentDetail();
        break;
      case "subclasses":
        this.renderSubclassesDetail();
        break;
      case "races":
        this.renderRacesDetail();
        break;
      case "feats":
        this.renderFeatsDetail();
        break;
      case "skills":
        this.renderSkillsDetail();
        break;
      case "potions":
        this.renderPotionsDetail();
        break;
      case "buildings":
        this.renderBuildingsDetail();
        break;
      case "traps":
        this.renderTrapsDetail();
        break;
      case "statusEffects":
        this.renderStatusEffectsDetail();
        break;
      case "classes":
      default:
        this.renderClassDetail();
        break;
    }
  }

  private buildClassSelector(): void {
    const y = 150;
    const w = 138;
    const gap = 8;
    const { xs, itemWidth } = centeredRowX(CLASS_DEFINITIONS.length, w, gap, getViewport(this).width / 2, getViewport(this).width - 80);
    CLASS_DEFINITIONS.forEach((cls, i) => {
      const handle = createOrnateButton(
        this,
        xs[i],
        y,
        itemWidth,
        32,
        cls.name,
        () => {
          this.classId = cls.id;
          this.page = 0;
          this.renderCategory();
        },
        { variant: "tab", depth: 5 },
      );
      handle.setSelected(cls.id === this.classId);
      this.subButtons.push(handle);
    });
  }

  private renderClassDetail(): void {
    const cls = getClassDefinition(this.classId);
    const saves = cls.savingThrowProficiencies.map((a) => ABILITY_SCORE_NAMES[a]).join("/");
    const castLine = cls.spellcasting
      ? ` · casts with ${ABILITY_SCORE_NAMES[cls.spellcasting.spellcastingAbility]}`
      : "";
    const header = `${cls.name} — d${cls.hitDie} hit die · ${ABILITY_SCORE_NAMES[cls.primaryAbility]} primary · saves: ${saves}${castLine}`;

    const rows: DetailRow[] = cls.features.map((f) => ({
      text: `Lv${f.level}  ${f.name}${f.mechanicallyActive ? "" : "  [inert]"}`,
      tooltip: f.description,
    }));
    this.renderRowList(header, getViewport(this).width - PANEL_LEFT * 2, rows);
  }

  /**
   * Phase 15 (D-104): a level filter for the Spells tab, same button-row
   * pattern as `buildClassSelector` — needed once the catalogue grew from
   * 14 curated spells to 318 (see `data/spells.ts`), too many to read as
   * one flat unpaginated list the way every other Compendium category still
   * can.
   */
  private buildSpellLevelSelector(): void {
    const y = 150;
    const w = 70;
    const gap = 6;
    const { xs, itemWidth } = centeredRowX(SPELL_LEVEL_LABELS.length, w, gap, getViewport(this).width / 2, getViewport(this).width - 80);
    SPELL_LEVEL_LABELS.forEach((label, level) => {
      const handle = createOrnateButton(
        this,
        xs[level],
        y,
        itemWidth,
        32,
        label,
        () => {
          this.spellLevel = level;
          this.page = 0;
          this.renderCategory();
        },
        { variant: "tab", depth: 5 },
      );
      handle.setSelected(level === this.spellLevel);
      this.subButtons.push(handle);
    });
  }

  private renderSpellsDetail(): void {
    const spells = Object.values(SPELLS)
      .filter((s) => s.level === this.spellLevel)
      .sort((a, b) => a.name.localeCompare(b.name));
    const header = `${SPELL_LEVEL_LABELS[this.spellLevel]}${this.spellLevel === 0 ? "s" : "-level"} — ${spells.length} spell${spells.length === 1 ? "" : "s"}`;

    const rows: DetailRow[] = spells.map((s) => ({
      text: `${s.name} (${s.school})${s.abilityId ? " — playable today" : ""}`,
      tooltip: s.description,
    }));
    this.renderRowList(header, getViewport(this).width - PANEL_LEFT * 2, rows);
  }

  /**
   * Phase 17 (D-108), D-165: the row's hover tooltip — real weapon
   * (dice/damage type/properties/mastery) or armor (AC formula/Str/stealth)
   * detail when present, else the plain bonus/attunement/proc summary every
   * equipment item already had. The row's always-visible `text` (see
   * `equipmentRow`) carries only slot/rarity/name/cost now.
   */
  private equipmentTooltip(id: string): string {
    const e = EQUIPMENT_DEFINITIONS[id];
    const parts: string[] = [];
    if (e.attackDamage) parts.push(`+${e.attackDamage} attack`);
    if (e.armorClass) parts.push(`+${e.armorClass} AC`);
    if (e.requiresAttunement) parts.push("requires attunement");
    if (e.weapon) {
      const dice = e.weapon.versatileDamageDice
        ? `${e.weapon.damageDice}/${e.weapon.versatileDamageDice} versatile`
        : e.weapon.damageDice;
      const props = e.weapon.properties.map((p) => WEAPON_PROPERTY_LABELS[p]).join(", ") || "no properties";
      parts.push(`${dice} ${e.weapon.damageType}`, props, `mastery: ${WEAPON_MASTERIES[e.weapon.mastery].name}`);
    } else if (e.armor) {
      const dexText =
        e.armor.dexMode === "full" ? "full Dex" : e.armor.dexMode === "capped" ? `Dex capped at +${e.armor.dexCap ?? 2}` : "no Dex";
      parts.push(`AC ${e.armor.baseAC} (${dexText})`);
      if (e.armor.strengthRequirement) parts.push(`Str ${e.armor.strengthRequirement}`);
      if (e.armor.stealthDisadvantage) parts.push("stealth disadvantage");
    }
    const proc = e.proc ? ` — ${e.description}` : "";
    return `${parts.join(", ")}${proc}`;
  }

  private equipmentRow(id: string): DetailRow {
    const e = EQUIPMENT_DEFINITIONS[id];
    return {
      text: `${GEAR_SLOT_TYPE_LABELS[e.slot]} [${RARITY_LABELS[e.rarity]}] — ${e.name} (${e.cost}g)`,
      tooltip: this.equipmentTooltip(id),
    };
  }

  /**
   * Phase 17 (D-108): Equipment joins Classes/Spells as a paginated category
   * — the real weapon/armor catalogue nearly quadrupled `EQUIPMENT_ORDER`'s
   * size, too many lines for one flat unpaginated block.
   */
  private renderEquipmentDetail(): void {
    const rows = EQUIPMENT_ORDER.map((id) => this.equipmentRow(id));
    this.renderRowList(null, getViewport(this).width - PANEL_LEFT * 2, rows);
  }

  private panelWidth(): number {
    return getViewport(this).width - PANEL_LEFT * 2;
  }

  // D-150: alphabetized for DISPLAY ONLY via a local sorted copy —
  // `SUBCLASS_DEFINITIONS`'s own declared order must stay untouched, since
  // `CharacterBuildSystem.subclassIdForNewBuild` relies on each class's two
  // subclasses staying in "SRD one first, original one second" registration
  // order within that array. D-165: each subclass name is a non-interactive
  // `isGroupHeader` divider; each of its features is its own hoverable row.
  private renderSubclassesDetail(): void {
    const rows: DetailRow[] = [];
    [...SUBCLASS_DEFINITIONS]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((s) => {
        rows.push({ text: `${s.name} (${getClassDefinition(s.classId).name})`, isGroupHeader: true });
        s.features.forEach((f) =>
          rows.push({
            text: `  Lv${f.level} ${f.name}${f.mechanicallyActive ? "" : " [inert]"}`,
            tooltip: f.description,
          }),
        );
      });
    this.renderRowList(null, this.panelWidth(), rows);
  }

  // D-150: local sorted copy — `RACE_DEFINITIONS`' own order backs
  // `RACE_IDS[0]`'s default new-build race (Human) and the Character
  // Creation race picker's order; only this Compendium display sorts.
  private renderRacesDetail(): void {
    const rows: DetailRow[] = [];
    [...RACE_DEFINITIONS]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((r) => {
        rows.push({ text: `${r.name} — speed ${r.speedTiles} tiles`, isGroupHeader: true });
        r.traits.forEach((t) =>
          rows.push({
            text: `  ${t.name}${t.mechanicallyActive ? "" : " [flavor]"}`,
            tooltip: t.description,
          }),
        );
      });
    this.renderRowList(null, this.panelWidth(), rows);
  }

  // D-150: local sorted copy — `FEAT_IDS`' own order backs the ASI/feat-
  // picker overlay's display order elsewhere; only this Compendium display
  // sorts.
  private renderFeatsDetail(): void {
    const rows: DetailRow[] = [...FEAT_IDS]
      .sort((a, b) => FEATS[a].name.localeCompare(FEATS[b].name))
      .map((id) => {
        const f = FEATS[id];
        return { text: `${f.name}${f.mechanicallyActive ? "" : " [inert]"}`, tooltip: f.description };
      });
    this.renderRowList(null, this.panelWidth(), rows);
  }

  // Phase 13.5 (D-090): reference-only — nothing in this game calls a skill
  // check yet. D-150: `SKILL_ORDER` itself is now alphabetical (its only
  // consumer is this tab).
  private renderSkillsDetail(): void {
    const rows: DetailRow[] = SKILL_ORDER.map((id) => {
      const s = SKILLS[id];
      return { text: `${s.name} (${ABILITY_SCORE_NAMES[s.ability]})`, tooltip: s.description };
    });
    this.renderRowList(null, this.panelWidth(), rows);
  }

  // D-150: local sorted copy — `POTION_ORDER`'s own order backs the Shop
  // grid's item order; only this Compendium display sorts.
  private renderPotionsDetail(): void {
    const rows: DetailRow[] = [...POTION_ORDER]
      .sort((a, b) => POTION_DEFINITIONS[a].name.localeCompare(POTION_DEFINITIONS[b].name))
      .map((id) => {
        const p = POTION_DEFINITIONS[id];
        return { text: `${p.name} (${p.cost}g)`, tooltip: p.description };
      });
    this.renderRowList(null, this.panelWidth(), rows);
  }

  // D-150: local sorted copy — `STATUS_EFFECT_ORDER`'s own order backs
  // on-token status-badge render order and the debug status picker; only
  // this Compendium display sorts.
  private renderStatusEffectsDetail(): void {
    const rows: DetailRow[] = [...STATUS_EFFECT_ORDER]
      .sort((a, b) => STATUS_EFFECTS[a].name.localeCompare(STATUS_EFFECTS[b].name))
      .map((id) => ({ text: STATUS_EFFECTS[id].name, tooltip: STATUS_EFFECTS[id].description }));
    this.renderRowList(null, this.panelWidth(), rows);
  }

  /** Shared by `renderBuildingsDetail`/`renderTrapsDetail`: gold cost, or a note for the two spell-conjured structures that aren't shop-buyable (`cost: 0`, never listed in `SHOP_ORDER`). */
  private structureCostLabel(s: StructureDefinition): string {
    return s.cost === 0 ? "spell-conjured, not shop-buyable" : `${s.cost}g`;
  }

  /**
   * D-150: walls + gates + platforms, grouped by `kind` (a Gate/Wicket
   * Gate/Portcullis is still `kind: "wall"` with `blocksHeroes: false`, so
   * it lands in the same group as every other wall) then alphabetized by
   * name within each group. D-165: each group label is a non-interactive
   * `isGroupHeader` divider row; the wall/HP/passability or platform-bonus
   * detail that used to sit inline now lives in the row's hover tooltip.
   */
  private renderBuildingsDetail(): void {
    const all = Object.values(STRUCTURE_DEFINITIONS).filter((s) => s.kind !== "trap");
    const byName = (a: StructureDefinition, b: StructureDefinition) => a.name.localeCompare(b.name);
    const walls = all.filter((s) => s.kind === "wall").sort(byName);
    const platforms = all.filter((s) => s.kind === "platform").sort(byName);

    const wallRow = (s: StructureDefinition): DetailRow => {
      const hp = s.maxHp !== undefined ? ` · ${s.maxHp} HP` : "";
      const passable = s.blocksHeroes === false ? " · heroes pass through" : "";
      return { text: `${s.name} (${this.structureCostLabel(s)})${hp}${passable}`, tooltip: s.description };
    };
    const platformRow = (s: StructureDefinition): DetailRow => {
      const bonus = s.heroBonus
        ? [
            s.heroBonus.attackDamage ? `+${s.heroBonus.attackDamage} basic-attack damage` : null,
            s.heroBonus.attackRangeTiles ? `+${s.heroBonus.attackRangeTiles} basic-attack range` : null,
          ]
            .filter((p): p is string => p !== null)
            .join(", ")
        : "none";
      const audience = s.heroBonus?.appliesTo === "any" ? "any hero" : `${s.heroBonus?.appliesTo ?? "any"} heroes only`;
      return {
        text: `${s.name} (${this.structureCostLabel(s)}) — ${audience}`,
        tooltip: `${bonus}: ${s.description}`,
      };
    };

    const rows: DetailRow[] = [];
    if (walls.length > 0) {
      rows.push({ text: "— Walls & Gates —", isGroupHeader: true });
      walls.forEach((s) => rows.push(wallRow(s)));
    }
    if (platforms.length > 0) {
      rows.push({ text: "— Platforms —", isGroupHeader: true });
      platforms.forEach((s) => rows.push(platformRow(s)));
    }
    this.renderRowList(null, this.panelWidth(), rows);
  }

  /**
   * D-150: traps grouped by `targets` (ground vs. flying — no roster entry
   * currently targets "any") then alphabetized by name within each group.
   * D-165: same group-header + hover-tooltip treatment as `renderBuildingsDetail`.
   */
  private renderTrapsDetail(): void {
    const all = Object.values(STRUCTURE_DEFINITIONS).filter((s) => s.kind === "trap");
    const byName = (a: StructureDefinition, b: StructureDefinition) => a.name.localeCompare(b.name);
    const ground = all.filter((s) => (s.targets ?? "any") === "ground").sort(byName);
    const flying = all.filter((s) => s.targets === "flying").sort(byName);
    const other = all.filter((s) => (s.targets ?? "any") === "any").sort(byName);

    const trapRow = (s: StructureDefinition): DetailRow => {
      const dmg = s.damage !== undefined ? ` · ${s.damage} damage` : "";
      const status = s.appliesStatus
        ? ` · applies ${STATUS_EFFECTS[s.appliesStatus.statusId].name} (${s.appliesStatus.durationTurns} turns)`
        : "";
      const singleUse = s.singleUse ? " · single-use, then removed" : "";
      return { text: `${s.name} (${this.structureCostLabel(s)})${dmg}${singleUse}`, tooltip: `${s.description}${status}` };
    };

    const rows: DetailRow[] = [];
    const section = (label: string, defs: StructureDefinition[]): void => {
      if (defs.length === 0) return;
      rows.push({ text: `— ${label} —`, isGroupHeader: true });
      defs.forEach((s) => rows.push(trapRow(s)));
    };
    section("Ground", ground);
    section("Flying", flying);
    section("Any", other);
    this.renderRowList(null, this.panelWidth(), rows);
  }
}
