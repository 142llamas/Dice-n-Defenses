import Phaser from "phaser";

/**
 * BootScene runs first. In later phases it will preload real assets (images,
 * audio, fonts). For Phase 0 there are no external assets, so it just hands
 * off to the main menu. Keeping it in place now means future asset loading
 * has an obvious, documented home.
 *
 * D-123: now waits (briefly, capped) for the two Google Fonts declared in
 * `index.html` to finish loading before starting `MainMenuScene`. Without
 * this, Phaser can render/measure its first Text objects against the
 * fallback serif BEFORE the real webfont swaps in — and Phaser doesn't
 * re-layout existing Text objects when a font finishes loading later, so
 * that first-frame mismatch would otherwise stick. Capped at 1.5s so a
 * slow/offline connection can never stall the menu — every font-family
 * string already lists a real serif fallback, so proceeding without the
 * webfont is a safe, readable degrade, not a broken one.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    const start = () => this.scene.start("MainMenuScene");
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts;
    if (!fonts?.ready) {
      start();
      return;
    }
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      start();
    };
    fonts.ready.then(go).catch(go);
    this.time.delayedCall(1500, go);
  }
}
