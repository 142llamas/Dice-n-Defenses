import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./game/config";
import { BootScene } from "./game/scenes/BootScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { CharacterCreationScene } from "./game/scenes/CharacterCreationScene";
import { CompendiumScene } from "./game/scenes/CompendiumScene";
import { BestiaryScene } from "./game/scenes/BestiaryScene";
import { CampaignSelectScene } from "./game/scenes/CampaignSelectScene";
import { ModeEntryScene } from "./game/scenes/ModeEntryScene";
import { KnowledgeBaseScene } from "./game/scenes/KnowledgeBaseScene";
import { CompanionRosterScene } from "./game/scenes/CompanionRosterScene";
import { UnlockMissionPartyScene } from "./game/scenes/UnlockMissionPartyScene";
import { FreePlayScene } from "./game/scenes/FreePlayScene";
import { TestModeScene } from "./game/scenes/TestModeScene";
import { LoadGameScene } from "./game/scenes/LoadGameScene";
import { MapBuilderScene } from "./game/scenes/MapBuilderScene";
import { BrowseSharedMapsScene } from "./game/scenes/BrowseSharedMapsScene";
import { CoopLobbyScene } from "./game/scenes/CoopLobbyScene";
import { BattleScene } from "./game/scenes/BattleScene";
import { CharacterSheetScene } from "./game/scenes/CharacterSheetScene";
import { PauseMenuScene } from "./game/scenes/PauseMenuScene";
import { SettingsScene } from "./game/scenes/SettingsScene";
import { GearShopScene } from "./game/scenes/GearShopScene";

/**
 * Application entry point.
 *
 * Vite loads this file (referenced from index.html). It builds the Phaser
 * game with a fixed internal resolution that scales to fit the browser window while
 * preserving aspect ratio (desktop-first, per the Source of Truth).
 *
 * D-159: D-157 (responsive-canvas roadmap step 3) briefly switched this to
 * `Scale.RESIZE` — REVERTED here after Kevin's first real in-browser pass
 * found it broken: Main Menu's corner controls (Settings/Sign-in) overlapping
 * the frame border, and Character Creation's Start/Back buttons rendering
 * completely off-screen. Root cause: `Scale.RESIZE` makes the canvas's actual
 * pixel size track the real window exactly, with NO automatic shrink-to-fit —
 * `Scale.FIT` (restored here) was doing double duty this whole roadmap
 * assumed away: every D-154/155/156 `getViewport`/`repositionLayout` pass
 * only ever handled re-CENTERING content horizontally on a resize, never
 * handled a real window shorter than `GAME_HEIGHT` (1080) — under FIT that
 * was masked because the whole 1280x1080 design just visually shrank to fit,
 * so content built for a 1080px-tall canvas was never actually clipped. Under
 * RESIZE, a browser window shorter than 1080px (common — a laptop's usable
 * viewport height is often well under that) puts anything positioned near
 * the bottom of the old fixed design below the visible canvas, with nothing
 * to scroll it into view. See D-159 in `DECISIONS.md` for the full writeup
 * and what a real fix would need (vertical reflow or content scaling, not
 * just horizontal recentering) before this is attempted again.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL if available, else Canvas.
  parent: "game-root", // the <div> in index.html.
  backgroundColor: "#0e0e14",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT, // scale to fit while keeping aspect ratio. D-159: back from a reverted Scale.RESIZE attempt (D-157) — see this file's own top comment.
    // `#game-root` (index.html) is a flex container that already centers its
    // child. Phaser's own CENTER_BOTH also centers the canvas via inline
    // margin styles, assuming a plain block parent — stacking both centered
    // the canvas twice, pushing it visibly off-center. The CSS flex box
    // handles it alone now.
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  // Phase 12.2 (D-102): this project's FIRST-EVER free-text input (a coop
  // session join code) needs a real HTML <input> overlay — Phaser's DOM
  // Element game objects require this container to be enabled. Every scene
  // that doesn't use `this.add.dom(...)` is completely unaffected.
  dom: {
    createContainer: true,
  },
  scene: [
    BootScene,
    MainMenuScene,
    CharacterCreationScene,
    CompendiumScene,
    BestiaryScene,
    KnowledgeBaseScene,
    CampaignSelectScene,
    ModeEntryScene,
    CompanionRosterScene,
    UnlockMissionPartyScene,
    FreePlayScene,
    TestModeScene,
    LoadGameScene,
    MapBuilderScene,
    BrowseSharedMapsScene,
    CoopLobbyScene,
    BattleScene,
    CharacterSheetScene,
    PauseMenuScene,
    SettingsScene,
    GearShopScene,
  ],
};

// Creating the game starts everything. BootScene runs first.
new Phaser.Game(config);
