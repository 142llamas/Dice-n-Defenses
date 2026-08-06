import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./game/config";
import { BootScene } from "./game/scenes/BootScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { CharacterCreationScene } from "./game/scenes/CharacterCreationScene";
import { CompendiumScene } from "./game/scenes/CompendiumScene";
import { BestiaryScene } from "./game/scenes/BestiaryScene";
import { CampaignSelectScene } from "./game/scenes/CampaignSelectScene";
import { FreePlayScene } from "./game/scenes/FreePlayScene";
import { LoadGameScene } from "./game/scenes/LoadGameScene";
import { MapBuilderScene } from "./game/scenes/MapBuilderScene";
import { BrowseSharedMapsScene } from "./game/scenes/BrowseSharedMapsScene";
import { CoopLobbyScene } from "./game/scenes/CoopLobbyScene";
import { BattleScene } from "./game/scenes/BattleScene";

/**
 * Application entry point.
 *
 * Vite loads this file (referenced from index.html). It builds the Phaser game
 * with a fixed internal resolution that scales to fit the browser window while
 * preserving aspect ratio (desktop-first, per the Source of Truth).
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL if available, else Canvas.
  parent: "game-root", // the <div> in index.html.
  backgroundColor: "#0e0e14",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT, // scale to fit while keeping aspect ratio.
    autoCenter: Phaser.Scale.CENTER_BOTH,
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
    LoadGameScene,
    MapBuilderScene,
    BrowseSharedMapsScene,
    CoopLobbyScene,
    BattleScene,
  ],
};

// Creating the game starts everything. BootScene runs first.
new Phaser.Game(config);
