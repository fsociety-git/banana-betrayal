import { Events, bus } from '../events';
import { MusicPlayer } from './MusicPlayer';
import { type SfxName, synthesize } from './sfx';

/**
 * Procedural WebAudio engine. Nothing plays until the browser has seen a user gesture; after that the context
 * is created and resumed. Separate music/SFX buses, a mute switch, per-sound rate limiting and random
 * variation so repeated effects do not grate.
 */
export class AudioEngine {
  private static _instance: AudioEngine | null = null;
  static get instance(): AudioEngine { return (this._instance ??= new AudioEngine()); }

  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private music: MusicPlayer | null = null;
  private volumes = { music: 0.6, sfx: 0.8, muted: false };
  private lastPlayed = new Map<string, number>();
  private pendingTrack: string | null = null;
  unlocked = false;

  private constructor() {
    const unlock = (): void => { void this.unlock(); };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend(); else if (this.unlocked) void this.ctx.resume();
    });
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      this.musicBus.connect(this.master); this.sfxBus.connect(this.master);
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(this.ctx);
      this.music = new MusicPlayer(this.ctx, this.musicBus, this.noiseBuffer);
      this.applyVolumes();
    }
    if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch { /* still locked */ } }
    if (this.ctx.state === 'running' && !this.unlocked) {
      this.unlocked = true;
      bus.emit(Events.AudioUnlocked);
      if (this.pendingTrack) { this.music?.play(this.pendingTrack); this.pendingTrack = null; }
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setVolumes(music: number, sfx: number, muted: boolean): void {
    this.volumes = { music, sfx, muted };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : 0.9, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.02);
  }

  get muted(): boolean { return this.volumes.muted; }

  /** Fire a one-shot effect. `intensity` scales volume (0..1.5). Rate limited per sound name. */
  play(name: SfxName, intensity = 1, minGapMs = 40): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer || !this.unlocked || this.volumes.muted) return;
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? -Infinity;
    if (now - last < minGapMs) return;
    this.lastPlayed.set(name, now);
    synthesize(name, this.ctx, this.sfxBus, this.noiseBuffer, Math.min(1.5, Math.max(0, intensity)));
  }

  playMusic(track: string): void {
    if (!this.music || !this.unlocked) { this.pendingTrack = track; return; }
    this.music.play(track);
  }
  stopMusic(fadeMs = 400): void { this.pendingTrack = null; this.music?.stop(fadeMs); }
  setMusicIntensity(level: number): void { this.music?.setIntensity(level); }
  get currentTrack(): string | null { return this.music?.current ?? this.pendingTrack; }
}
