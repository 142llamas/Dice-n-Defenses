import Phaser from "phaser";
import type { Settings } from "../systems/SettingsSystem";

/**
 * AudioManager (D-153) — a thin, Phaser-dependent wrapper around the game's
 * shared sound manager. `scene.sound` is the SAME manager instance
 * (`game.sound`) regardless of which scene reaches it, so master volume and
 * mute are genuinely global the instant they're set — real, working
 * plumbing even though no music or SFX asset exists in this project yet
 * (KI-029/KI-105). Music/SFX are each their own relative volume on top of
 * master; Phaser has no built-in audio-bus concept, so this tracks every
 * sound IT played and re-applies that sound's category volume whenever
 * settings change.
 *
 * `playMusic`/`playSfx` are no-ops (return null) when the given key isn't a
 * loaded audio asset — safe to call from anywhere ahead of any real audio
 * shipping, without a crash or a console error.
 */

export type AudioCategory = "music" | "sfx";

interface TrackedSound {
  sound: Phaser.Sound.BaseSound;
  category: AudioCategory;
}

export class AudioManager {
  private settings: Settings | null = null;
  private tracked: TrackedSound[] = [];

  /** Applies master volume + mute to the shared sound manager, and re-applies every tracked sound's own category volume. Safe to call every time a settings control changes. */
  applySettings(scene: Phaser.Scene, settings: Settings): void {
    this.settings = settings;
    scene.sound.mute = settings.muted;
    scene.sound.volume = settings.masterVolume / 100;
    this.tracked.forEach(({ sound, category }) => this.applyCategoryVolume(sound, category));
  }

  private categoryVolume(category: AudioCategory): number {
    if (!this.settings) return 1;
    return (category === "music" ? this.settings.musicVolume : this.settings.sfxVolume) / 100;
  }

  private applyCategoryVolume(sound: Phaser.Sound.BaseSound, category: AudioCategory): void {
    const withVolume = sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    if (typeof withVolume.setVolume === "function") withVolume.setVolume(this.categoryVolume(category));
  }

  /** Plays a one-shot sound effect by key at the current SFX volume. */
  playSfx(scene: Phaser.Scene, key: string, config?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound | null {
    return this.play(scene, key, "sfx", config);
  }

  /** Plays (looping by default) a music track by key at the current Music volume. */
  playMusic(
    scene: Phaser.Scene,
    key: string,
    config?: Phaser.Types.Sound.SoundConfig,
  ): Phaser.Sound.BaseSound | null {
    return this.play(scene, key, "music", { loop: true, ...config });
  }

  private play(
    scene: Phaser.Scene,
    key: string,
    category: AudioCategory,
    config?: Phaser.Types.Sound.SoundConfig,
  ): Phaser.Sound.BaseSound | null {
    if (!scene.cache.audio.exists(key)) return null;
    const sound = scene.sound.add(key, config);
    this.applyCategoryVolume(sound, category);
    this.tracked.push({ sound, category });
    sound.once(Phaser.Sound.Events.DESTROY, () => {
      this.tracked = this.tracked.filter((t) => t.sound !== sound);
    });
    sound.play();
    return sound;
  }
}

/** One shared instance for the whole game session — matches `game.sound` itself being a single shared manager, not a per-scene one. */
export const audioManager = new AudioManager();
