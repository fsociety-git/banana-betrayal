import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../../core/constants';
import type { ThemePalette } from './themes';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;

interface Layer { sprite: Phaser.GameObjects.TileSprite; fx: number; fy: number; yOffset: number; }

/**
 * Sky gradient + seamless parallax layers + haze + ambient particles. Everything is world-space and follows
 * the camera centre every frame (no scrollFactor tricks, so the render-scale zoom never matters).
 * Layer textures are generated once per theme and cached in the texture manager.
 */
export class Backdrop {
  private scene: Phaser.Scene;
  private sky: Phaser.GameObjects.Image;
  private layers: Layer[] = [];
  private haze: Phaser.GameObjects.Rectangle;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private palette: ThemePalette;

  constructor(scene: Phaser.Scene, palette: ThemePalette, quality: 'high' | 'balanced' | 'low', seed: number) {
    this.scene = scene;
    this.palette = palette;
    this.sky = scene.add.image(0, 0, Backdrop.skyTexture(scene, palette)).setDepth(DEPTH.skyFar).setDisplaySize(W + 80, H + 80);
    const rng = new Phaser.Math.RandomDataGenerator([`${palette.id}-${seed}`]);
    const defs = Backdrop.layerDefs(palette, quality);
    for (const d of defs) {
      const key = d.build(scene, palette, rng);
      const sprite = scene.add.tileSprite(0, 0, W + 80, d.height, key).setDepth(d.depth).setOrigin(0.5, 1);
      this.layers.push({ sprite, fx: d.fx, fy: d.fy, yOffset: d.yOffset });
    }
    this.haze = scene.add.rectangle(0, 0, W + 80, H + 80, palette.haze, palette.hazeAlpha * (quality === 'low' ? 0.5 : 1)).setDepth(DEPTH.decorBack - 5);
    if (quality !== 'low') {
      this.particles = scene.add.particles(0, 0, 'dot', {
        x: { min: -W / 2, max: W / 2 }, y: { min: -H / 2, max: H / 2 },
        lifespan: { min: 4000, max: 8000 }, speedX: { min: -12, max: 18 }, speedY: { min: -14, max: 6 },
        scale: { start: 0.12, end: 0.02 }, frequency: quality === 'high' ? 140 : 320, quantity: 1,
        alpha: { onEmit: () => 0, onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(Math.PI * t) * 0.55 },
        tint: palette.particle, blendMode: Phaser.BlendModes.ADD,
      }).setDepth(DEPTH.particles - 1);
    }
  }

  /** Call after the camera has been positioned for this frame. */
  update(cx: number, cy: number, scrollX: number, scrollY: number, dt: number): void {
    this.sky.setPosition(cx, cy);
    this.haze.setPosition(cx, cy);
    for (const l of this.layers) {
      l.sprite.setPosition(cx, cy + H / 2 + l.yOffset - scrollY * l.fy * 0.3);
      l.sprite.tilePositionX = scrollX * l.fx;
    }
    if (this.particles) {
      this.particles.setPosition(cx, cy);
      if (this.palette.id === 'sky') this.particles.setParticleSpeed(18 + Math.sin(this.scene.time.now / 2000) * 10, -8);
    }
    void dt;
  }

  destroy(): void {
    this.sky.destroy();
    this.haze.destroy();
    for (const l of this.layers) l.sprite.destroy();
    this.particles?.destroy();
    this.layers = [];
  }

  // ---------- texture generation ----------

  private static skyTexture(scene: Phaser.Scene, p: ThemePalette): string {
    const key = `sky-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, 64, 256);
    if (!tex) return 'dot';
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, hex(p.skyTop));
    grad.addColorStop(1, hex(p.skyBottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
    tex.refresh();
    return key;
  }

  private static layerDefs(p: ThemePalette, quality: 'high' | 'balanced' | 'low'): { build: (s: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator) => string; height: number; depth: number; fx: number; fy: number; yOffset: number }[] {
    const kind = p.id === 'sky' ? 'clouds' : p.id === 'factory' || p.id === 'hq' ? 'industrial' : 'hills';
    const defs = [
      { build: (s: Phaser.Scene, pp: ThemePalette, r: Phaser.Math.RandomDataGenerator) => Backdrop.farTexture(s, pp, r, kind), height: 340, depth: DEPTH.parallax, fx: 0.12, fy: 0.1, yOffset: 20 },
      { build: (s: Phaser.Scene, pp: ThemePalette, r: Phaser.Math.RandomDataGenerator) => Backdrop.midTexture(s, pp, r, kind), height: 300, depth: DEPTH.parallax + 10, fx: 0.3, fy: 0.25, yOffset: 50 },
      { build: (s: Phaser.Scene, pp: ThemePalette, r: Phaser.Math.RandomDataGenerator) => Backdrop.nearTexture(s, pp, r, kind), height: 260, depth: DEPTH.parallax + 20, fx: 0.55, fy: 0.45, yOffset: 90 },
    ];
    return quality === 'low' ? [defs[0], defs[2]] : defs;
  }

  /** Smooth periodic profile so the texture tiles seamlessly across its width. */
  private static profile(x: number, w: number, base: number, a1: number, a2: number, k1: number, k2: number, phase: number): number {
    const t = (x / w) * Math.PI * 2;
    return base + Math.sin(t * k1) * a1 + Math.sin(t * k2 + phase) * a2;
  }

  private static farTexture(scene: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator, kind: string): string {
    const key = `bg-far-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const w = 960, h = 340;
    const g = scene.add.graphics();
    if (kind === 'clouds') {
      g.fillStyle(p.farHills, 0.9);
      for (let i = 0; i < 7; i++) {
        const cx = (i / 7) * w + rng.between(-30, 30), cy = 120 + rng.between(-40, 60), r = rng.between(40, 70);
        for (const off of [0, -w, w]) { g.fillEllipse(cx + off, cy, r * 2.6, r * 1.1); g.fillCircle(cx + off - r * 0.6, cy - r * 0.35, r * 0.7); g.fillCircle(cx + off + r * 0.4, cy - r * 0.45, r * 0.85); }
      }
    } else if (kind === 'industrial') {
      g.fillStyle(p.farHills, 1);
      let x = 0;
      while (x < w) {
        const bw = rng.between(40, 110), bh = rng.between(90, 230);
        g.fillRect(x, h - 3 - bh, bw, bh);
        if (rng.frac() < 0.5) g.fillRect(x + bw / 2 - 6, h - bh - rng.between(20, 60), 12, 60);
        x += bw + rng.between(4, 20);
      }
    } else {
      g.fillStyle(p.farHills, 1);
      const phase = rng.frac() * 6;
      for (let x = 0; x <= w; x += 4) {
        const y = Backdrop.profile(x, w, 150, 50, 25, 2, 5, phase);
        g.fillRect(x, y, 5, h - 3 - y);
      }
      // soft summits
      for (let i = 0; i < 6; i++) { const cx = (i / 6) * w + 60; const y = Backdrop.profile(cx, w, 150, 50, 25, 2, 5, phase); g.fillCircle(cx, y + 20, 40); }
    }
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }

  private static midTexture(scene: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator, kind: string): string {
    const key = `bg-mid-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const w = 960, h = 300;
    const g = scene.add.graphics();
    if (kind === 'clouds') {
      g.fillStyle(p.midHills, 0.95);
      for (let i = 0; i < 5; i++) {
        const cx = (i / 5) * w + rng.between(-40, 40), cy = 200 + rng.between(-30, 40), r = rng.between(50, 80);
        for (const off of [0, -w, w]) { g.fillEllipse(cx + off, cy, r * 3, r * 1.2); g.fillCircle(cx + off - r * 0.7, cy - r * 0.4, r * 0.8); g.fillCircle(cx + off + r * 0.5, cy - r * 0.55, r); }
      }
    } else if (kind === 'industrial') {
      g.fillStyle(p.midHills, 1);
      let x = 0;
      while (x < w) {
        const bw = rng.between(60, 140), bh = rng.between(60, 170);
        g.fillRect(x, h - 3 - bh, bw, bh);
        g.fillStyle(p.skyBottom, 0.35);
        for (let wy = h - bh + 12; wy < h - 10; wy += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 18) if (rng.frac() < 0.6) g.fillRect(wx, wy, 8, 10);
        g.fillStyle(p.midHills, 1);
        x += bw + rng.between(6, 30);
      }
    } else {
      g.fillStyle(p.midHills, 1);
      const phase = rng.frac() * 6;
      for (let x = 0; x <= w; x += 4) {
        const y = Backdrop.profile(x, w, 170, 30, 18, 3, 7, phase);
        g.fillRect(x, y, 5, h - 3 - y);
      }
      // bushy tree line
      for (let x = 0; x < w; x += rng.between(26, 40)) {
        const y = Backdrop.profile(x, w, 170, 30, 18, 3, 7, phase);
        const r = rng.between(16, 30);
        for (const off of [0, -w, w]) g.fillCircle(x + off, y - r * 0.4, r);
      }
    }
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }

  private static nearTexture(scene: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator, kind: string): string {
    const key = `bg-near-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const w = 960, h = 260;
    const g = scene.add.graphics();
    if (kind === 'clouds') {
      g.fillStyle(p.nearTrees, 0.9);
      for (let i = 0; i < 4; i++) {
        const cx = (i / 4) * w + rng.between(-40, 40), cy = 215 + rng.between(-15, 25), r = rng.between(50, 70);
        for (const off of [0, -w, w]) { g.fillEllipse(cx + off, cy, r * 3.2, r * 1.1); g.fillCircle(cx + off - r * 0.8, cy - r * 0.3, r * 0.75); g.fillCircle(cx + off + r * 0.4, cy - r * 0.5, r * 0.95); }
      }
    } else if (kind === 'industrial') {
      g.fillStyle(p.nearTrees, 1);
      // pipes and tanks
      for (let x = 0; x < w; x += rng.between(120, 200)) {
        const tw = rng.between(50, 90), th = rng.between(80, 150);
        for (const off of [0, -w, w]) { g.fillRoundedRect(x + off, h - 3 - th, tw, th, 10); g.fillRect(x + off + tw / 2 - 5, h - th - 33, 10, 30); }
      }
      g.fillRect(0, h - 36, w, 12);
      for (let x = 0; x < w; x += 70) g.fillRect(x, h - 36, 10, 33);
    } else {
      // trees with trunks and layered canopies, repeated across the seam
      for (let x = 20; x < w; x += rng.between(70, 120)) {
        const trunkH = rng.between(90, 160), r = rng.between(34, 54);
        for (const off of [0, -w, w]) {
          g.fillStyle(p.nearTrees, 1);
          g.fillRect(x + off - 7, h - 3 - trunkH, 14, trunkH);
          g.fillCircle(x + off, h - trunkH - r * 0.2, r);
          g.fillCircle(x + off - r * 0.7, h - trunkH + r * 0.3, r * 0.8);
          g.fillCircle(x + off + r * 0.7, h - trunkH + r * 0.25, r * 0.85);
        }
      }
      // undergrowth strip
      g.fillStyle(p.nearTrees, 1);
      for (let x = 0; x < w + 40; x += 24) g.fillCircle(x, h - 24, rng.between(12, 20));
    }
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }
}

function hex(c: number): string { return '#' + c.toString(16).padStart(6, '0'); }
