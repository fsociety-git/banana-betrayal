import { AudioEngine } from '../audio/AudioEngine';
import { Events, bus } from '../events';
import { SaveManager } from '../save/SaveManager';
import type { Settings } from '../save/schema';
import { TouchControls } from '../../ui/TouchControls';

/**
 * Applies persisted settings to the live systems (audio buses, DOM data attributes, touch controls).
 * Render-scale/quality changes are applied by main.ts because they need the Game instance.
 */
export class SettingsService {
  private static _instance: SettingsService | null = null;
  static get instance(): SettingsService { return (this._instance ??= new SettingsService()); }

  private systemReduced: MediaQueryList | null = null;

  private constructor() {
    this.systemReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    this.systemReduced?.addEventListener?.('change', () => this.apply());
    bus.on(Events.SettingsChanged, () => this.apply());
  }

  get settings(): Settings { return SaveManager.instance.settings; }

  /** Effective reduced-motion flag (system preference unless overridden). */
  get reducedMotion(): boolean {
    const s = this.settings.reducedMotion;
    if (s === 'on') return true;
    if (s === 'off') return false;
    return this.systemReduced?.matches ?? false;
  }

  get screenShake(): boolean { return this.settings.screenShake && !this.reducedMotion; }
  get assist(): boolean { return this.settings.assist.enabled; }
  /** >1 slows trap cycles in assist mode. */
  get hazardTimeScale(): number { return this.settings.assist.enabled && this.settings.assist.slowHazards ? 1.6 : 1; }

  update(patch: Partial<Settings>): void { SaveManager.instance.updateSettings(patch); }

  toggleMute(): boolean {
    const muted = !this.settings.muted;
    this.update({ muted });
    bus.emit(Events.MuteToggled, muted);
    return muted;
  }

  apply(): void {
    const s = this.settings;
    AudioEngine.instance.setVolumes(s.musicVolume, s.sfxVolume, s.muted);
    document.documentElement.dataset.reducedMotion = this.reducedMotion ? '1' : '0';
    document.documentElement.style.setProperty('--bb-ui-scale', s.largeText ? '1.2' : '1');
    TouchControls.instance.setMode(s.touchControls);
  }
}
