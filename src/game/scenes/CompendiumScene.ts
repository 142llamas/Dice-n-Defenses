import Phaser from "phaser";
import { CLASS_DEFINITIONS, getClassDefinition, type CharacterClassDefinition } from "../data/classes";
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
 * Most categories are short enough to render as one flat list. Classes are
 * one exception — four 20-level tables run 18-21 features each — so Classes
 * gets a per-class selector plus simple page-through (Prev/Next) rather than
 * risking text running off the bottom of the canvas. Phase 15 (D-104) added
 * Spells as a second exception: the catalogue grew from 14 curated entries
 * to 318 (a full SRD spell-list pass), so Spells now gets an analogous
 * per-level selector (Cantrip/1st/.../9th) plus the same Prev/Next paging.
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

const FEATURES_PER_PAGE = 6;

function classFeatureBlocks(cls: CharacterClassDefinition): string[] {
  return cls.features.map(
    (f) => `Lv${f.level}  ${f.name}${f.mechanicallyActive ? "" : "  [inert]"}\n    ${f.description}`,
  );
}

const SPELLS_PER_PAGE = 12;
const SPELL_LEVEL_LABELS = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

/**
 * Phase 17 (D-108): the real SRD weapon/armor catalogue nearly quadrupled
 * `EQUIPMENT_ORDER`'s size, so Equipment joins Classes/Spells as a paginated
 * category (same Prev/Next mechanism, no separate sub-selector needed — the
 * catalogue reads fine as one long alphabetized-by-slot list, just paged).
 */
const EQUIPMENT_PER_PAGE = 10;

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

    this.rebuildLayout();

    this.input.keyboard?.on("keydown-ESC", () => this.leave());

    // Same explicit teardown discipline as every other scene (D-043): avoid
    // accumulating listeners across repeated menu <-> Compendium visits.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.removeAllListeners();
      this.input.keyboard?.removeAllListeners();
      this.activeDialogue?.destroy();
      this.activeDialogue = undefined;
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

  private refreshTabHighlights(): void {
    CATEGORIES.forEach((cat, i) => {
      this.tabButtons[i].setSelected(cat.id === this.category);
    });
  }

  private renderCategory(): void {
    this.refreshTabHighlights();
    this.clearSubButtons();
    // Switching tabs while a preview dialogue is open shouldn't leave it
    // dangling behind the newly-rendered category.
    this.activeDialogue?.destroy();
    this.activeDialogue = undefined;

    if (this.category === "classes") {
      this.buildClassSelector();
      this.renderClassDetail();
    } else if (this.category === "spells") {
      this.buildSpellLevelSelector();
      this.renderSpellsDetail();
    } else if (this.category === "equipment") {
      this.renderEquipmentDetail();
    } else if (this.category === "dialoguePreview") {
      this.hidePagination();
      this.renderDialoguePreviewTab();
    } else {
      this.hidePagination();
      this.detailText.setText(this.flatCategoryText());
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

  /** Dispatches Prev/Next to whichever category is currently paginated. */
  private renderPaginatedDetail(): void {
    if (this.category === "spells") {
      this.renderSpellsDetail();
    } else if (this.category === "equipment") {
      this.renderEquipmentDetail();
    } else {
      this.renderClassDetail();
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

    const blocks = classFeatureBlocks(cls);
    const totalPages = Math.max(1, Math.ceil(blocks.length / FEATURES_PER_PAGE));
    this.page = Math.max(0, Math.min(this.page, totalPages - 1));
    const pageBlocks = blocks.slice(this.page * FEATURES_PER_PAGE, (this.page + 1) * FEATURES_PER_PAGE);

    this.detailText.setText(`${header}\n\n${pageBlocks.join("\n\n")}`);
    this.showPagination(totalPages);
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

    const totalPages = Math.max(1, Math.ceil(spells.length / SPELLS_PER_PAGE));
    this.page = Math.max(0, Math.min(this.page, totalPages - 1));
    const pageSpells = spells.slice(this.page * SPELLS_PER_PAGE, (this.page + 1) * SPELLS_PER_PAGE);

    const lines = pageSpells.map((s) => {
      const playable = s.abilityId ? " — playable today" : "";
      return `${s.name} (${s.school})${playable}: ${s.description}`;
    });

    this.detailText.setText(`${header}\n\n${lines.join("\n\n")}`);
    this.showPagination(totalPages);
  }

  /**
   * Phase 17 (D-108): one catalogue line, with real weapon (dice/damage
   * type/properties/mastery) or armor (AC formula/Str/stealth) detail when
   * present — a flavor item with neither field keeps the plain
   * bonus/attunement/proc summary every equipment line already had.
   */
  private equipmentLine(id: string): string {
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
    return `${GEAR_SLOT_TYPE_LABELS[e.slot]} [${RARITY_LABELS[e.rarity]}] — ${e.name} (${e.cost}g): ${parts.join(", ")}${proc}`;
  }

  /**
   * Phase 17 (D-108): Equipment joins Classes/Spells as a paginated category
   * — the real weapon/armor catalogue nearly quadrupled `EQUIPMENT_ORDER`'s
   * size, too many lines for one flat unpaginated block.
   */
  private renderEquipmentDetail(): void {
    const totalPages = Math.max(1, Math.ceil(EQUIPMENT_ORDER.length / EQUIPMENT_PER_PAGE));
    this.page = Math.max(0, Math.min(this.page, totalPages - 1));
    const pageIds = EQUIPMENT_ORDER.slice(this.page * EQUIPMENT_PER_PAGE, (this.page + 1) * EQUIPMENT_PER_PAGE);
    this.detailText.setText(pageIds.map((id) => this.equipmentLine(id)).join("\n\n"));
    this.showPagination(totalPages);
  }

  /** Every other category is short enough to render as one flat, unpaginated list. */
  private flatCategoryText(): string {
    switch (this.category) {
      case "subclasses":
        // D-150: alphabetized for DISPLAY ONLY via a local sorted copy —
        // `SUBCLASS_DEFINITIONS`'s own declared order must stay untouched,
        // since `CharacterBuildSystem.subclassIdForNewBuild` relies on each
        // class's two subclasses staying in "SRD one first, original one
        // second" registration order within that array.
        return [...SUBCLASS_DEFINITIONS]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => {
            const header = `${s.name} (${getClassDefinition(s.classId).name})`;
            const features = s.features
              .map((f) => `  Lv${f.level} ${f.name}${f.mechanicallyActive ? "" : " [inert]"}: ${f.description}`)
              .join("\n");
            return `${header}\n${features}`;
          })
          .join("\n\n");

      case "races":
        // D-150: local sorted copy — `RACE_DEFINITIONS`' own order backs
        // `RACE_IDS[0]`'s default new-build race (Human) and the Character
        // Creation race picker's order; only this Compendium display sorts.
        return [...RACE_DEFINITIONS]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => {
            const header = `${r.name} — speed ${r.speedTiles} tiles`;
            const traits = r.traits
              .map((t) => `  ${t.name}${t.mechanicallyActive ? "" : " [flavor]"}: ${t.description}`)
              .join("\n");
            return `${header}\n${traits}`;
          })
          .join("\n\n");

      case "feats":
        // D-150: local sorted copy — `FEAT_IDS`' own order backs the ASI/
        // feat-picker overlay's display order elsewhere; only this
        // Compendium display sorts.
        return [...FEAT_IDS]
          .sort((a, b) => FEATS[a].name.localeCompare(FEATS[b].name))
          .map((id) => {
            const f = FEATS[id];
            return `${f.name}${f.mechanicallyActive ? "" : " [inert]"}: ${f.description}`;
          })
          .join("\n\n");

      case "skills":
        // Phase 13.5 (D-090): reference-only, like every inert category above —
        // nothing in this game calls a skill check yet. D-150: `SKILL_ORDER`
        // itself is now alphabetical (its only consumer is this tab).
        return SKILL_ORDER.map((id) => {
          const s = SKILLS[id];
          return `${s.name} (${ABILITY_SCORE_NAMES[s.ability]}): ${s.description}`;
        }).join("\n\n");

      case "potions":
        // D-150: local sorted copy — `POTION_ORDER`'s own order backs the
        // Shop grid's item order; only this Compendium display sorts.
        return [...POTION_ORDER]
          .sort((a, b) => POTION_DEFINITIONS[a].name.localeCompare(POTION_DEFINITIONS[b].name))
          .map((id) => {
            const p = POTION_DEFINITIONS[id];
            return `${p.name} (${p.cost}g): ${p.description}`;
          })
          .join("\n\n");

      case "buildings":
        return this.buildingsText();

      case "traps":
        return this.trapsText();

      case "statusEffects":
        // D-150: local sorted copy — `STATUS_EFFECT_ORDER`'s own order backs
        // on-token status-badge render order and the debug status picker;
        // only this Compendium display sorts.
        return [...STATUS_EFFECT_ORDER]
          .sort((a, b) => STATUS_EFFECTS[a].name.localeCompare(STATUS_EFFECTS[b].name))
          .map((id) => {
            const s = STATUS_EFFECTS[id];
            return `${s.name}: ${s.description}`;
          })
          .join("\n\n");

      default:
        return "";
    }
  }

  /** Shared by `buildingsText`/`trapsText`: gold cost, or a note for the two spell-conjured structures that aren't shop-buyable (`cost: 0`, never listed in `SHOP_ORDER`). */
  private structureCostLabel(s: StructureDefinition): string {
    return s.cost === 0 ? "spell-conjured, not shop-buyable" : `${s.cost}g`;
  }

  /**
   * D-150: walls + gates + platforms, grouped by `kind` (a Gate/Wicket
   * Gate/Portcullis is still `kind: "wall"` with `blocksHeroes: false`, so
   * it lands in the same group as every other wall) then alphabetized by
   * name within each group.
   */
  private buildingsText(): string {
    const all = Object.values(STRUCTURE_DEFINITIONS).filter((s) => s.kind !== "trap");
    const byName = (a: StructureDefinition, b: StructureDefinition) => a.name.localeCompare(b.name);
    const walls = all.filter((s) => s.kind === "wall").sort(byName);
    const platforms = all.filter((s) => s.kind === "platform").sort(byName);

    const wallLine = (s: StructureDefinition): string => {
      const hp = s.maxHp !== undefined ? ` · ${s.maxHp} HP` : "";
      const passable = s.blocksHeroes === false ? " · heroes pass through" : "";
      return `${s.name} (${this.structureCostLabel(s)})${hp}${passable}: ${s.description}`;
    };
    const platformLine = (s: StructureDefinition): string => {
      const bonus = s.heroBonus
        ? [
            s.heroBonus.attackDamage ? `+${s.heroBonus.attackDamage} basic-attack damage` : null,
            s.heroBonus.attackRangeTiles ? `+${s.heroBonus.attackRangeTiles} basic-attack range` : null,
          ]
            .filter((p): p is string => p !== null)
            .join(", ")
        : "none";
      const audience = s.heroBonus?.appliesTo === "any" ? "any hero" : `${s.heroBonus?.appliesTo ?? "any"} heroes only`;
      return `${s.name} (${this.structureCostLabel(s)}) — ${audience}, ${bonus}: ${s.description}`;
    };

    const section = (label: string, defs: StructureDefinition[], line: (s: StructureDefinition) => string): string =>
      defs.length === 0 ? "" : `— ${label} —\n${defs.map(line).join("\n\n")}`;

    return [section("Walls & Gates", walls, wallLine), section("Platforms", platforms, platformLine)]
      .filter((s) => s.length > 0)
      .join("\n\n\n");
  }

  /**
   * D-150: traps grouped by `targets` (ground vs. flying — no roster entry
   * currently targets "any") then alphabetized by name within each group.
   */
  private trapsText(): string {
    const all = Object.values(STRUCTURE_DEFINITIONS).filter((s) => s.kind === "trap");
    const byName = (a: StructureDefinition, b: StructureDefinition) => a.name.localeCompare(b.name);
    const ground = all.filter((s) => (s.targets ?? "any") === "ground").sort(byName);
    const flying = all.filter((s) => s.targets === "flying").sort(byName);
    const other = all.filter((s) => (s.targets ?? "any") === "any").sort(byName);

    const trapLine = (s: StructureDefinition): string => {
      const dmg = s.damage !== undefined ? ` · ${s.damage} damage` : "";
      const status = s.appliesStatus
        ? ` · applies ${STATUS_EFFECTS[s.appliesStatus.statusId].name} (${s.appliesStatus.durationTurns} turns)`
        : "";
      const singleUse = s.singleUse ? " · single-use, then removed" : "";
      return `${s.name} (${this.structureCostLabel(s)})${dmg}${status}${singleUse}: ${s.description}`;
    };

    const section = (label: string, defs: StructureDefinition[]): string =>
      defs.length === 0 ? "" : `— ${label} —\n${defs.map(trapLine).join("\n\n")}`;

    return [section("Ground", ground), section("Flying", flying), section("Any", other)]
      .filter((s) => s.length > 0)
      .join("\n\n\n");
  }
}
