/**
 * Central configuration constants for the game.
 *
 * Keeping these numbers in one place (rather than scattered through scene code)
 * follows the Source of Truth's "data-driven content" architecture rule.
 *
 * NOTE: grid dimensions (columns/rows) now live with the map data, not here,
 * because the map defines the board. This file keeps the fixed screen size,
 * the tile pixel size, and the colour palette.
 */

// The logical playfield resolution. The canvas scales to the browser window,
// but game math always uses this fixed internal size (desktop-first). Height
// was increased from the original 720 (playtest fix): the area below the grid
// needs room for the status line, the multi-line combat log, AND a row of
// action buttons, and 720 only left ~50px for all three, which is what caused
// text and buttons to overlap. Phaser's Scale.FIT + autoCenter (see main.ts)
// means this is a safe, purely-cosmetic change — the canvas is always scaled
// to fit the browser window regardless of its logical size.
//
// Raised again, 900 -> 1000 (Phase 7): the shop grew from 3 buildables to 7
// (D-05x), so the shop HUD is now a multi-row grid instead of one row, which
// needs more room below the grid than 900 left. Verified by the same
// bounding-box math as the earlier 720->900 change (see buildShopHud).
//
// Raised again, 1000 -> 1080 (Phase 11.5, D-078): the Gear catalogue grew
// from 3 items to 12 equipment + 2 potions (14, four rows at 4/row), taller
// than the 7-item/2-row shop grid that used to set the Done button's height
// budget. `buildShopHud` now sizes the Done button off whichever grid is
// taller; this bump keeps a comfortable margin below it, same bounding-box
// approach as the 900->1000 change.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 1080;

// Pixel size of one square tile. The grid's on-screen position is computed in
// the scene so the loaded map is centred, whatever its dimensions.
export const TILE_SIZE = 64;

// Vertical space reserved above the grid for the title text.
export const GRID_TOP_MARGIN = 90;

// Phase 3: starting Stronghold Integrity (the shared loss resource). The party
// loses when this reaches zero. Kept here as a balance value, not in scene code.
export const STRONGHOLD_START = 20;

// Phase 5: gold the party begins with, before any wave rewards. Enough to buy
// a wall or two, or one trap, up front. First-pass balance value (see
// KNOWN_ISSUES KI-015); tune once the five-wave loop is play-tested.
export const STARTING_GOLD = 20;

// Phase 8: localStorage keys for locally-persisted settings/UI state (kept
// here, not in scene code, for the same reason every other constant is).
export const SETTINGS_STORAGE_KEY = "fantasy-td:settings";
export const TUTORIAL_STORAGE_KEY = "fantasy-td:tutorial-seen";
// Phase 11.6 (D-079): unlock-on-encounter Bestiary progress (per enemy id,
// whether it has been seen/killed at least once) — same local-only storage
// treatment as settings/tutorial above.
export const BESTIARY_STORAGE_KEY = "fantasy-td:bestiary";
// Phase 11.8 (D-071): per-campaign-id completion flags — same local-only
// storage treatment, kept as its own key/system rather than folded into
// BESTIARY_STORAGE_KEY (a campaign completion and an enemy encounter are
// different concerns despite sharing the same persistence mechanism).
export const CAMPAIGN_PROGRESS_STORAGE_KEY = "fantasy-td:campaign-progress";
// Phase 9 (D-083): locally-saved party builds (see systems/SaveSystem.ts) —
// same local-only storage treatment, its own key since a save slot's shape
// (a whole party + party size + difficulty) is unrelated to the other three.
export const SAVE_STORAGE_KEY = "fantasy-td:saves";
// D-118: per-choice campaign-story flags (see systems/WorldFlagSystem.ts) —
// same local-only storage treatment, its own key since a flag's shape
// (an arbitrary boolean/string/number keyed by flag id) is unrelated to the
// above. Not yet written by any scene — see WorldFlagSystem's own comment.
export const WORLD_FLAG_STORAGE_KEY = "fantasy-td:world-flags";
// D-118: the companion active/benched/lost roster (see
// systems/CompanionRosterSystem.ts) — same local-only storage treatment, its
// own key for the same reason. Not yet written by any scene.
export const COMPANION_ROSTER_STORAGE_KEY = "fantasy-td:companion-roster";

// A small, readable colour palette for placeholder art (all original, no IP).
export const COLORS = {
  background: 0x0e0e14,
  gridLine: 0x2a2a3a,
  tileFloor: 0x1a1a26,
  tileBlocked: 0x33202a, // walls
  tileHover: 0x3a3a5a,
  tileSelected: 0x4a6a4a,
  tileRejected: 0x7a3a3a, // brief flash when an invalid tile is clicked
  spawn: 0x8a3a3a,
  exit: 0x3a5a8a,
  hero: 0x4caf72,
  enemy: 0xd05a5a,
  // Phase 2 additions:
  heroActive: 0x9be0b4, // the currently selected hero's brighter token
  moveRange: 0x2f5a7a, // tiles the selected hero can reach (movement range)
  pathStep: 0x7ac6ff, // dots marking the previewed path to the hovered tile
  moveConfirm: 0xffe08a, // the pending destination awaiting confirm/cancel
  breachFlash: 0xff5a5a, // flash when an enemy reaches the exit (a breach)
  // Phase 4 (combat) additions:
  attackTarget: 0xff8a8a, // outline on enemies a selected hero can basic-attack
  abilityTarget: 0xffc07a, // outline on enemies a hero's aimed ability can hit
  hitFlash: 0xffd0d0, // brief flash on an enemy struck by a hero
  heroHurtFlash: 0xff6a6a, // brief flash on a hero struck by an enemy
  // Phase 5 (building/traps/gold) additions:
  gold: 0xf0c850, // the gold counter text
  wall: 0x8a7a5a, // a placed barricade (wall) tile
  wallEdge: 0xb8a678, // a placed barricade's outline
  trap: 0xc25a7a, // a placed spike trap tile
  trapEdge: 0xe58aa8, // a placed spike trap's outline
  buildValid: 0x6ad08a, // ghost preview on a legal build tile
  buildInvalid: 0xd06a6a, // ghost preview on an illegal build tile
  trapFlash: 0xffb0c8, // brief flash when a trap hurts an enemy
  // Phase 22 (magic-item expansion), D-151: the Cape of Billowing's drawn
  // cape graphic (`BattleScene.updateHeroCapes`) was wrongly reusing
  // `heroActive` (the selection-highlight color) — its own dedicated color,
  // a deep placeholder red, until real art exists.
  capeBillowingPlaceholder: 0xb0202a,
  // D-119 (dialogue box): a stylized parchment-look panel for chapter-
  // boundary story text, drawn with Graphics rather than an image asset
  // (matches Phase 22's Cape of Billowing precedent — real drawing code
  // when no art tool/asset exists).
  parchmentBase: 0xe8d8ae, // the paper's base fill
  parchmentMottle: 0xc8ab7a, // low-alpha "aged" blotches over the base
  parchmentBorder: 0x5a3a20, // the frame border and inner rule line
  // An NPC speaker's portrait slot, before real art exists for it.
  portraitPlaceholderBg: 0x3a3628,
  portraitPlaceholderFg: 0x8a8270,

  // D-123: a shared fantasy/parchment UI theme for menu-and-reference
  // screens (Main Menu, Compendium, Bestiary), rolled out ahead of the rest
  // of the game per Kevin's own request. Deliberately separate from the
  // battle-board palette above (tileFloor, hero, enemy, etc.) — those are
  // gameplay-legibility colors and stay untouched; these are chrome/menu
  // colors for screens with no board to read.
  menuBgNear: 0x1c140c, // backdrop gradient, near edge (top)
  menuBgFar: 0x0a0704, // backdrop gradient, far edge (bottom) — near-black
  menuVignette: 0x000000, // corner-darkening overlay, low alpha
  woodPanel: 0x2a1d12, // an ornate button/panel's idle fill (dark leather/wood)
  woodPanelHover: 0x3d2a18, // ...on hover
  woodPanelPressed: 0x1a1108, // ...while pressed
  woodPanelDisabled: 0x22201c, // ...disabled, desaturated
  bronze: 0x9a7a3e, // idle border / muted accent
  bronzeDark: 0x5a4222, // inner rule line
  gilt: 0xe8c25a, // hover/selected border, and headline text — brighter than `gold`
  giltDim: 0x8a7038, // disabled text
  menuInk: 0x2a1a10, // body text ON a parchment panel (matches dialogue box)
  menuInkMuted: 0x6a4a2a, // secondary/caption text on parchment
  menuParchmentShadow: 0x000000, // soft drop shadow under a raised panel
} as const;
