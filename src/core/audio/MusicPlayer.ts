/** Step-sequenced procedural music. Tracks are data; the scheduler looks ahead and never allocates per frame. */

interface TrackDef {
  bpm: number;
  root: number;
  scale: number[];
  /** Chord degree per bar (index into scale). */
  chords: number[];
  /** 16 steps per bar: '1' root, '5' fifth, '8' octave, '3' third, '.' rest */
  bass: string;
  /** 16 steps: digit = chord tone index (0 root,1 third,2 fifth,3 octave,4 ninth), '.' rest, '-' hold */
  leadA: string;
  leadB: string;
  drums: { kick: string; snare: string; hat: string };
  leadType: OscillatorType;
  leadCutoff: number;
  bassType: OscillatorType;
  pad: boolean;
  swing: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

export const TRACKS: Record<string, TrackDef> = {
  title: {
    bpm: 124, root: 60, scale: MAJOR, chords: [0, 5, 3, 4],
    bass: '1...5...1..1.5..', leadA: '0.2.3.2.1...0.-.', leadB: '3.2.1.0.2.1.4.-.',
    drums: { kick: '1.......1.....1.', snare: '....1.......1...', hat: '..1...1...1...1.' },
    leadType: 'triangle', leadCutoff: 2400, bassType: 'square', pad: true, swing: 0.08,
  },
  jungle: {
    bpm: 130, root: 62, scale: MAJOR, chords: [0, 0, 3, 4, 0, 0, 5, 4],
    bass: '1.1.5.1.1.1.8.5.', leadA: '0.1.2.3.-.2.1.0.', leadB: '2.3.4.3.-.1.2.-.',
    drums: { kick: '1...1...1...1.1.', snare: '....1.......1...', hat: '1.1.1.1.1.1.1.11' },
    leadType: 'square', leadCutoff: 1800, bassType: 'triangle', pad: false, swing: 0.1,
  },
  swamp: {
    bpm: 104, root: 57, scale: DORIAN, chords: [0, 0, 3, 6, 0, 0, 4, 3],
    bass: '1.....1...5...1.', leadA: '0...2.1.3.-.2...', leadB: '4.-.3.2.0...1.-.',
    drums: { kick: '1.......1..1....', snare: '....1.......1..1', hat: '..1...1...1...1.' },
    leadType: 'sine', leadCutoff: 1400, bassType: 'sine', pad: true, swing: 0.16,
  },
  factory: {
    bpm: 134, root: 55, scale: MINOR, chords: [0, 0, 5, 6, 0, 0, 3, 4],
    bass: '1.1.1.1.5.5.1.1.', leadA: '0.0.3.0.2.0.1.0.', leadB: '3.3.4.3.2.-.0.-.',
    drums: { kick: '1...1...1...1...', snare: '....1.......1...', hat: '1.1.1.1.1.1.1.1.' },
    leadType: 'sawtooth', leadCutoff: 1300, bassType: 'square', pad: false, swing: 0,
  },
  sky: {
    bpm: 112, root: 64, scale: LYDIAN, chords: [0, 1, 4, 0, 0, 1, 3, 4],
    bass: '1.......5.......', leadA: '0...1...2...3...', leadB: '4...3.-.2...1.-.',
    drums: { kick: '1.......1.......', snare: '........1.......', hat: '..1...1...1...1.' },
    leadType: 'triangle', leadCutoff: 3000, bassType: 'sine', pad: true, swing: 0.05,
  },
  hq: {
    bpm: 126, root: 52, scale: MINOR, chords: [0, 0, 3, 4, 0, 0, 5, 4],
    bass: '1..1..1.5..5..1.', leadA: '0.-.2.-.1.0.3.-.', leadB: '4.3.2.1.0.-.2.-.',
    drums: { kick: '1..1....1..1....', snare: '....1.......1...', hat: '1.1.1.1.1.1.1.1.' },
    leadType: 'square', leadCutoff: 1600, bassType: 'sawtooth', pad: true, swing: 0.06,
  },
  boss: {
    bpm: 152, root: 50, scale: MINOR, chords: [0, 0, 1, 0, 5, 5, 6, 4],
    bass: '1.1.1.1.1.1.5.5.', leadA: '0.3.0.3.2.0.1.0.', leadB: '4.3.4.3.2.1.0.-.',
    drums: { kick: '1...1...1...1.1.', snare: '....1.......1..1', hat: '1.1.1.1.1.1.1.11' },
    leadType: 'sawtooth', leadCutoff: 2200, bassType: 'square', pad: false, swing: 0,
  },
  ending: {
    bpm: 100, root: 60, scale: MAJOR, chords: [0, 3, 5, 4, 0, 3, 1, 4],
    bass: '1.......5.......', leadA: '0...1...2...3...', leadB: '2...1...0...-...',
    drums: { kick: '1.......1.......', snare: '........1.......', hat: '....1.......1...' },
    leadType: 'triangle', leadCutoff: 2600, bassType: 'sine', pad: true, swing: 0.1,
  },
};

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export class MusicPlayer {
  private ctx: AudioContext;
  private noise: AudioBuffer;
  private trackGain: GainNode;
  private timer: number | null = null;
  private track: TrackDef | null = null;
  private step = 0;
  private bar = 0;
  private nextTime = 0;
  private intensity = 1;
  private leadGain: GainNode;
  private drumGain: GainNode;
  private padGain: GainNode;
  current: string | null = null;

  constructor(ctx: AudioContext, out: GainNode, noise: AudioBuffer) {
    this.ctx = ctx; this.noise = noise;
    this.trackGain = ctx.createGain(); this.trackGain.connect(out);
    this.leadGain = ctx.createGain(); this.leadGain.connect(this.trackGain);
    this.drumGain = ctx.createGain(); this.drumGain.connect(this.trackGain);
    this.padGain = ctx.createGain(); this.padGain.connect(this.trackGain);
  }

  play(name: string): void {
    if (this.current === name && this.timer !== null) return;
    const def = TRACKS[name];
    if (!def) return;
    this.stop(0);
    this.track = def; this.current = name;
    this.step = 0; this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.trackGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.trackGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.trackGain.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 0.6);
    this.setIntensity(this.intensity);
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(fadeMs = 400): void {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    if (this.current) {
      const t = this.ctx.currentTime;
      this.trackGain.gain.cancelScheduledValues(t);
      this.trackGain.gain.setValueAtTime(Math.max(0.0001, this.trackGain.gain.value), t);
      this.trackGain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.01, fadeMs / 1000));
    }
    this.current = null; this.track = null;
  }

  /** 0 = ambient (bass + pad), 0.5 = + lead, 1 = full drums. */
  setIntensity(level: number): void {
    this.intensity = Math.max(0, Math.min(1, level));
    const t = this.ctx.currentTime;
    this.leadGain.gain.setTargetAtTime(this.intensity >= 0.4 ? 1 : 0.15, t, 0.3);
    this.drumGain.gain.setTargetAtTime(this.intensity >= 0.8 ? 1 : this.intensity >= 0.4 ? 0.45 : 0, t, 0.3);
    this.padGain.gain.setTargetAtTime(1, t, 0.3);
  }

  private schedule(): void {
    const def = this.track;
    if (!def) return;
    const stepDur = 60 / def.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.22) {
      const swing = this.step % 2 === 1 ? stepDur * def.swing : 0;
      this.playStep(def, this.step, this.bar, this.nextTime + swing, stepDur);
      this.step++;
      if (this.step >= 16) { this.step = 0; this.bar++; }
      this.nextTime += stepDur;
    }
  }

  private chordTone(def: TrackDef, bar: number, idx: number, octave = 0): number {
    const degree = def.chords[bar % def.chords.length];
    const offsets = [0, 2, 4, 7, 8];
    const d = degree + offsets[idx % offsets.length];
    const oct = Math.floor(d / def.scale.length) + (idx >= 3 ? 0 : 0);
    return def.root + def.scale[((d % def.scale.length) + def.scale.length) % def.scale.length] + 12 * (oct + octave);
  }

  private playStep(def: TrackDef, step: number, bar: number, t: number, stepDur: number): void {
    const degree = def.chords[bar % def.chords.length];
    const rootMidi = def.root + def.scale[degree % def.scale.length] + 12 * Math.floor(degree / def.scale.length);
    // bass
    const b = def.bass[step];
    if (b !== '.' && b !== '-') {
      const semis = b === '5' ? 7 : b === '8' ? 12 : b === '3' ? def.scale[(degree + 2) % def.scale.length] - def.scale[degree % def.scale.length] : 0;
      this.note(def.bassType, midiHz(rootMidi - 12 + semis), t, stepDur * 1.8, 0.22, 600, this.trackGain);
    }
    // lead (alternate pattern every two bars, drop to sparse when intensity is low)
    const pattern = Math.floor(bar / 2) % 2 === 0 ? def.leadA : def.leadB;
    const l = pattern[step];
    if (l !== '.' && l !== '-') {
      let len = stepDur;
      for (let i = step + 1; i < 16 && pattern[i] === '-'; i++) len += stepDur;
      const idx = parseInt(l, 10);
      const octave = (bar % 8 === 7 && step >= 8) ? 1 : 0;
      this.note(def.leadType, midiHz(this.chordTone(def, bar, idx, octave)), t, len * 0.95, 0.12, def.leadCutoff, this.leadGain, true);
    }
    // pad on bar start
    if (def.pad && step === 0) {
      for (const i of [0, 1, 2]) this.note('sawtooth', midiHz(this.chordTone(def, bar, i)), t, stepDur * 16, 0.035, 700, this.padGain, false, 0.4);
    }
    // drums
    if (def.drums.kick[step] === '1') this.kick(t);
    if (def.drums.snare[step] === '1') this.snare(t);
    if (def.drums.hat[step] === '1') this.hat(t, step % 4 === 0 ? 0.08 : 0.05);
  }

  private note(type: OscillatorType, freq: number, t: number, dur: number, vol: number, cutoff: number, dest: AudioNode, vibrato = false, attack = 0.01): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = (Math.random() - 0.5) * 8;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(f); f.connect(g); g.connect(dest);
    if (vibrato) {
      const lfo = this.ctx.createOscillator(); const lg = this.ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = 3;
      lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    o.start(t); o.stop(t + dur + 0.1);
  }

  private kick(t: number): void {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.drumGain); o.start(t); o.stop(t + 0.25);
  }
  private snare(t: number): void {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f); f.connect(g); g.connect(this.drumGain); src.start(t, Math.random()); src.stop(t + 0.16);
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
    const og = this.ctx.createGain(); og.gain.setValueAtTime(0.18, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(og); og.connect(this.drumGain); o.start(t); o.stop(t + 0.1);
  }
  private hat(t: number, vol: number): void {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(f); f.connect(g); g.connect(this.drumGain); src.start(t, Math.random()); src.stop(t + 0.06);
  }
}
