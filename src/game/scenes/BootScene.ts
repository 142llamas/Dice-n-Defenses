import Phaser from "phaser";

/**
 * BootScene runs first. In later phases it will preload real assets (images,
 * audio, fonts). For Phase 0 there are no external assets, so it just hands
 * off to the main menu. Keeping it in place now means future asset loading
 * has an obvious, documented home.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.scene.start("MainMenuScene");
  }
}
