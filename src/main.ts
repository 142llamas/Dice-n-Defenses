import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./game/config";
import { BootScene } from "./game/scenes/BootScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { CharacterCreationScene } from "./game/scenes/CharacterCreationScene";
import { CompendiumScene } from "./game/scenes/CompendiumScene";
import { BestiaryScene } from "./game/scenes/BestiaryScene";
import { CampaignSelectScene } from "./game/scenes/CampaignSelectScene";
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

/**
 * Application entry point.
 *
 * Vite loads this file (referenced from index.html). It builds the Phaser
 * game.
 *
 * D-157 (responsive-canvas roadmap, step 3): the game now runs in
 * `Scale.RESIZE` by default — the canvas's internal resolution now matches
 * the real browser window size (via `#game-root`'s 100vw/100vh in
 * index.html), which is what finally makes every scene's D-154/D-155/D-156
 * `getViewport`/`onViewportResize` conversion work for real instead of
 * always reading a fixed 1280x1080. `BattleScene` — the one scene NOT yet
 * converted to build its layout off a live viewport — locks the game back
 * to the old fixed-resolution `Scale.FIT` behavior for the duration of a
 * battle (see its own `create()`/shutdown handling), so battles still look
 * and scale exactly as they did before this cutover. `GAME_WIDTH`/
 * `GAME_HEIGHT` remain the config's initial/fallback size and BattleScene's
 * own fixed resolution.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL if available, else Canvas.
  parent: "game-root", // the <div> in index.html.
  backgroundColor: "#0e0e14",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.RESIZE, // D-157: real window size, except inside BattleScene (locked to FIT there).
    // `#game-root` (index.html) is a flex container that already centers its
    // child. Phaser's own CENTER_BOTH also centers the canvas via inline
    // margin styles, assuming a plain block parent — stacking both centered
    // the canvas twice, pushing it visibly off-center. The CSS flex box
    // handles it alone now. Under RESIZE the canvas fills `#game-root`
    // exactly (no letterboxing), so centering is moot there; under
    // BattleScene's locked-back FIT mode this is the same NO_CENTER
    // behavior every scene already relied on before this cutover.
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
    CampaignSelectScene,
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
  ],
};

// Creating the game starts everything. BootScene runs first.
new Phaser.Game(config);
