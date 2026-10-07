/** Procedural sound effects. Each recipe builds a tiny node graph with envelopes and random variation. */
export type SfxName =
  | 'jump' | 'land' | 'collect' | 'warning' | 'collapse' | 'impact' | 'death' | 'checkpoint' | 'ui' | 'uiBack'
  | 'bossCharge' | 'bossHit' | 'bossHurt' | 'victory' | 'splash' | 'oink' | 'receipt' | 'whoosh' | 'bubble'
  | 'switch' | 'slam' | 'crumble' | 'sparkle' | 'flagRun' | 'fanfare' | 'pop'
  | 'bonk' | 'squeak' | 'whiff' | 'glove' | 'stamp' | 'boing' | 'clang' | 'applause' | 'boom' | 'callout';

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

function env(ctx: AudioContext, dest: AudioNode, peak: number, attack: number, decay: number, start = ctx.currentTime, sustain = 0): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain > 0 ? sustain : 0.0001), start + attack + decay);
  g.connect(dest);
  return g;
}

function tone(ctx: AudioContext, dest: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, start = ctx.currentTime, attack = 0.005): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, start);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
  const g = env(ctx, dest, peak, attack, Math.max(0.01, dur - attack), start);
  o.connect(g);
  o.start(start);
  o.stop(start + dur + 0.05);
  return o;
}

function noise(ctx: AudioContext, dest: AudioNode, buffer: AudioBuffer, dur: number, peak: number, filterType: BiquadFilterType, f0: number, f1 = f0, q = 1, start = ctx.currentTime, attack = 0.003): void {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.playbackRate.value = rnd(0.9, 1.1);
  const filt = ctx.createBiquadFilter();
  filt.type = filterType; filt.Q.value = q;
  filt.frequency.setValueAtTime(f0, start);
  if (f1 !== f0) filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), start + dur);
  const g = env(ctx, dest, peak, attack, Math.max(0.01, dur - attack), start);
  src.connect(filt); filt.connect(g);
  src.start(start, rnd(0, 1));
  src.stop(start + dur + 0.05);
}

export function synthesize(name: SfxName, ctx: AudioContext, out: AudioNode, noiseBuf: AudioBuffer, k: number): void {
  const t = ctx.currentTime;
  const v = (x: number) => x * k;
  switch (name) {
    case 'jump': {
      const f = rnd(300, 340);
      tone(ctx, out, 'square', f, f * 2.1, 0.16, v(0.12));
      tone(ctx, out, 'sine', f * 0.5, f * 1.5, 0.12, v(0.1));
      break;
    }
    case 'land':
      noise(ctx, out, noiseBuf, 0.09, v(0.25), 'lowpass', 900, 200);
      tone(ctx, out, 'sine', 140, 60, 0.12, v(0.25));
      break;
    case 'collect': {
      const base = rnd(880, 940);
      tone(ctx, out, 'triangle', base, base, 0.08, v(0.18));
      tone(ctx, out, 'triangle', base * 1.5, base * 1.5, 0.12, v(0.16), t + 0.07);
      tone(ctx, out, 'sine', base * 2, base * 2.02, 0.2, v(0.08), t + 0.12);
      break;
    }
    case 'sparkle':
      for (let i = 0; i < 4; i++) tone(ctx, out, 'sine', rnd(1500, 2600), rnd(2000, 3200), 0.08, v(0.05), t + i * 0.045);
      break;
    case 'warning':
      tone(ctx, out, 'square', 620, 620, 0.07, v(0.09));
      tone(ctx, out, 'square', 620, 620, 0.07, v(0.09), t + 0.11);
      break;
    case 'collapse':
      noise(ctx, out, noiseBuf, 0.35, v(0.3), 'bandpass', 500, 120, 0.8);
      for (let i = 0; i < 4; i++) tone(ctx, out, 'square', rnd(200, 320), rnd(80, 140), 0.08, v(0.08), t + i * 0.05);
      break;
    case 'crumble':
      noise(ctx, out, noiseBuf, 0.25, v(0.18), 'highpass', 1800, 600);
      noise(ctx, out, noiseBuf, 0.2, v(0.15), 'lowpass', 500, 200, 1, t + 0.05);
      break;
    case 'impact':
      noise(ctx, out, noiseBuf, 0.12, v(0.3), 'lowpass', 700, 150);
      tone(ctx, out, 'sine', 110, 45, 0.18, v(0.35));
      break;
    case 'slam':
      noise(ctx, out, noiseBuf, 0.2, v(0.4), 'lowpass', 400, 80);
      tone(ctx, out, 'sine', 90, 35, 0.25, v(0.45));
      tone(ctx, out, 'square', 220, 110, 0.08, v(0.08));
      break;
    case 'death': {
      const f = rnd(420, 470);
      tone(ctx, out, 'sawtooth', f, f * 0.25, 0.5, v(0.14));
      tone(ctx, out, 'square', f * 1.5, f * 0.3, 0.42, v(0.07), t + 0.04);
      noise(ctx, out, noiseBuf, 0.25, v(0.1), 'lowpass', 1200, 200, 1, t + 0.05);
      break;
    }
    case 'splash':
      noise(ctx, out, noiseBuf, 0.4, v(0.3), 'bandpass', 900, 350, 0.6);
      tone(ctx, out, 'sine', 300, 120, 0.25, v(0.12));
      for (let i = 0; i < 5; i++) tone(ctx, out, 'sine', rnd(900, 1800), rnd(1200, 2400), 0.06, v(0.04), t + 0.08 + i * 0.05);
      break;
    case 'checkpoint':
      [523, 659, 784, 1047].forEach((f, i) => tone(ctx, out, 'triangle', f, f, 0.18, v(0.14), t + i * 0.07));
      break;
    case 'ui':
      tone(ctx, out, 'triangle', 700, 900, 0.06, v(0.1));
      break;
    case 'uiBack':
      tone(ctx, out, 'triangle', 600, 420, 0.08, v(0.1));
      break;
    case 'pop':
      tone(ctx, out, 'sine', rnd(500, 700), 200, 0.07, v(0.18));
      break;
    case 'bubble':
      tone(ctx, out, 'sine', rnd(350, 450), rnd(900, 1300), 0.12, v(0.12));
      break;
    case 'switch':
      tone(ctx, out, 'square', 300, 300, 0.05, v(0.12));
      tone(ctx, out, 'square', 450, 450, 0.08, v(0.12), t + 0.06);
      noise(ctx, out, noiseBuf, 0.05, v(0.12), 'highpass', 2000);
      break;
    case 'whoosh':
      noise(ctx, out, noiseBuf, 0.3, v(0.2), 'bandpass', 400, 2500, 1.2, t, 0.08);
      break;
    case 'flagRun':
      for (let i = 0; i < 6; i++) tone(ctx, out, 'square', rnd(500, 560) + i * 60, 400, 0.05, v(0.07), t + i * 0.06);
      break;
    case 'receipt':
      for (let i = 0; i < 10; i++) noise(ctx, out, noiseBuf, 0.03, v(0.12), 'bandpass', rnd(2500, 4000), undefined, 3, t + i * 0.045);
      tone(ctx, out, 'square', 1200, 1200, 0.05, v(0.06), t + 0.5);
      break;
    case 'oink': {
      const f = rnd(230, 290);
      tone(ctx, out, 'sawtooth', f * 0.8, f * 1.6, 0.12, v(0.14), t, 0.02);
      tone(ctx, out, 'sawtooth', f * 1.7, f * 0.9, 0.14, v(0.1), t + 0.1, 0.02);
      noise(ctx, out, noiseBuf, 0.18, v(0.08), 'bandpass', 1200, 800, 2);
      break;
    }
    case 'bossCharge':
      tone(ctx, out, 'sawtooth', 80, 260, 0.6, v(0.16), t, 0.1);
      noise(ctx, out, noiseBuf, 0.6, v(0.12), 'lowpass', 300, 1200, 1, t, 0.1);
      break;
    case 'bossHit':
      noise(ctx, out, noiseBuf, 0.25, v(0.35), 'lowpass', 1500, 200);
      tone(ctx, out, 'square', 200, 60, 0.3, v(0.2));
      for (let i = 0; i < 6; i++) tone(ctx, out, 'square', rnd(600, 1400), rnd(300, 600), 0.05, v(0.06), t + 0.05 + i * 0.04);
      break;
    case 'bossHurt':
      tone(ctx, out, 'sawtooth', 320, 180, 0.3, v(0.14));
      tone(ctx, out, 'sawtooth', 500, 240, 0.35, v(0.1), t + 0.08);
      break;
    case 'victory':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(ctx, out, 'triangle', f, f, 0.22, v(0.16), t + i * 0.11));
      break;
    case 'bonk':
      noise(ctx, out, noiseBuf, 0.07, v(0.35), 'lowpass', 1800, 300);
      tone(ctx, out, 'square', 330, 90, 0.09, v(0.2));
      tone(ctx, out, 'sine', 180, 60, 0.12, v(0.25));
      break;
    case 'squeak': {
      const f = rnd(900, 1200);
      tone(ctx, out, 'sawtooth', f, f * 1.8, 0.09, v(0.09), t, 0.01);
      tone(ctx, out, 'sawtooth', f * 1.8, f * 0.9, 0.12, v(0.08), t + 0.09, 0.01);
      break;
    }
    case 'whiff':
      noise(ctx, out, noiseBuf, 0.12, v(0.12), 'bandpass', 600, 1800, 1.2, t, 0.03);
      break;
    case 'glove':
      tone(ctx, out, 'sine', 90, 160, 0.14, v(0.3));
      noise(ctx, out, noiseBuf, 0.1, v(0.25), 'lowpass', 1200, 300);
      tone(ctx, out, 'square', 440, 220, 0.14, v(0.1), t + 0.06);
      break;
    case 'stamp':
      noise(ctx, out, noiseBuf, 0.05, v(0.3), 'lowpass', 2400, 400);
      tone(ctx, out, 'sine', 160, 70, 0.1, v(0.3));
      break;
    case 'boing':
      tone(ctx, out, 'sine', 180, 520, 0.22, v(0.18), t, 0.01);
      tone(ctx, out, 'triangle', 360, 900, 0.2, v(0.1), t + 0.03, 0.01);
      break;
    case 'clang':
      tone(ctx, out, 'square', 820, 780, 0.25, v(0.12));
      tone(ctx, out, 'sine', 1240, 1180, 0.3, v(0.08));
      noise(ctx, out, noiseBuf, 0.06, v(0.2), 'highpass', 3000);
      break;
    case 'applause':
      for (let i = 0; i < 14; i++) noise(ctx, out, noiseBuf, 0.04, v(0.12), 'bandpass', rnd(1500, 3500), undefined, 2, t + i * 0.06 + rnd(0, 0.02));
      break;
    case 'boom':
      noise(ctx, out, noiseBuf, 0.7, v(0.25), 'lowpass', 500, 60, 1, t, 0.02);
      tone(ctx, out, 'sine', 70, 30, 0.6, v(0.3));
      break;
    case 'callout':
      tone(ctx, out, 'square', 520, 660, 0.12, v(0.12));
      tone(ctx, out, 'square', 660, 520, 0.14, v(0.1), t + 0.12);
      break;
    case 'fanfare':
      [392, 523, 659, 784].forEach((f, i) => { tone(ctx, out, 'square', f, f, 0.18, v(0.09), t + i * 0.13); tone(ctx, out, 'triangle', f * 2, f * 2, 0.18, v(0.07), t + i * 0.13); });
      tone(ctx, out, 'triangle', 1047, 1047, 0.6, v(0.14), t + 0.55);
      break;
  }
}
