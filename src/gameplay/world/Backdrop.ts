import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../../core/constants';
import { bananaPolygon, fillPts } from '../fx/bananaShape';
import type { ThemePalette } from './themes';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;

interface Layer { sprite: Phaser.GameObjects.TileSprite; fx: number; fy: number; yOffset: number; anchor: 'bottom' | 'top'; }

type Quality = 'high' | 'balanced' | 'low';

/**
 * Sky gradient, sun glow, drifting clouds, far landmarks, mid hills, near vegetation, a hanging canopy and a
 * few ambient motes. Everything is world-space and follows the camera centre every frame, so the render-scale
 * zoom never matters. Layer textures are generated once per theme and cached.
 */
export class Backdrop {
  private sky: Phaser.GameObjects.Image;
  private sun: Phaser.GameObjects.Image;
  private layers: Layer[] = [];
  private haze: Phaser.GameObjects.Rectangle;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private t = 0;

  constructor(scene: Phaser.Scene, palette: ThemePalette, quality: Quality, seed: number, reducedMotion = false) {
    this.sky = scene.add.image(0, 0, Backdrop.skyTexture(scene, palette)).setDepth(DEPTH.skyFar).setDisplaySize(W + 80, H + 80);
    this.sun = scene.add.image(0, 0, 'glow').setDepth(DEPTH.skyFar + 1).setTint(palette.sunColor).setAlpha(palette.sunAlpha).setScale(palette.id === 'sky' ? 5 : 3.6).setBlendMode(Phaser.BlendModes.ADD);
    const rng = new Phaser.Math.RandomDataGenerator([`${palette.id}-${seed}`]);
    const defs = Backdrop.layerDefs(palette, quality);
    for (const d of defs) {
      const key = d.build(scene, palette, rng);
      const sprite = scene.add.tileSprite(0, 0, W + 80, d.height, key).setDepth(d.depth).setOrigin(0.5, d.anchor === 'bottom' ? 1 : 0);
      if (d.alpha !== undefined) sprite.setAlpha(d.alpha);
      this.layers.push({ sprite, fx: d.fx, fy: d.fy, yOffset: d.yOffset, anchor: d.anchor });
    }
    this.haze = scene.add.rectangle(0, 0, W + 80, H + 80, palette.haze, palette.hazeAlpha * (quality === 'low' ? 0.5 : 1)).setDepth(DEPTH.decorBack - 5);
    if (quality !== 'low' && !reducedMotion) {
      this.particles = scene.add.particles(0, 0, palette.id === 'jungle' || palette.id === 'swamp' ? 'leaf' : 'dot', {
        x: { min: -W / 2, max: W / 2 }, y: { min: -H / 2, max: H / 2 },
        lifespan: { min: 5000, max: 9000 }, speedX: { min: -10, max: 16 }, speedY: palette.id === 'jungle' ? { min: 8, max: 22 } : { min: -12, max: 6 },
        scale: { start: palette.id === 'jungle' ? 0.5 : 0.1, end: 0.05 }, frequency: quality === 'high' ? 420 : 900, quantity: 1,
        rotate: { start: 0, end: 260 },
        alpha: { onEmit: () => 0, onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(Math.PI * t) * 0.5 },
        tint: palette.particle, blendMode: palette.id === 'jungle' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD,
      }).setDepth(DEPTH.particles - 1);
    }
  }

  /** Call after the camera has been positioned for this frame. */
  update(cx: number, cy: number, scrollX: number, scrollY: number, dt: number): void {
    this.t += dt;
    this.sky.setPosition(cx, cy);
    this.sun.setPosition(cx + W * 0.28 - scrollX * 0.02, cy - H * 0.3 - scrollY * 0.05);
    this.haze.setPosition(cx, cy);
    for (const l of this.layers) {
      if (l.anchor === 'bottom') l.sprite.setPosition(cx, cy + H / 2 + l.yOffset - scrollY * l.fy * 0.3);
      else l.sprite.setPosition(cx, cy - H / 2 + l.yOffset - scrollY * l.fy * 0.3);
      l.sprite.tilePositionX = scrollX * l.fx + (l.fx < 0.1 ? this.t * 6 : 0);
    }
    if (this.particles) this.particles.setPosition(cx, cy);
  }

  destroy(): void {
    this.sky.destroy(); this.sun.destroy(); this.haze.destroy();
    for (const l of this.layers) l.sprite.destroy();
    this.particles?.destroy();
    this.layers = [];
  }

  // ---------- textures ----------

  private static skyTexture(scene: Phaser.Scene, p: ThemePalette): string {
    const key = `sky-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, 64, 256);
    if (!tex) return 'dot';
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, hex(p.skyTop));
    grad.addColorStop(0.55, hex(mix(p.skyTop, p.skyBottom, 0.6)));
    grad.addColorStop(1, hex(p.skyBottom));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 256);
    tex.refresh();
    return key;
  }

  private static layerDefs(p: ThemePalette, quality: Quality): { build: (s: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator) => string; height: number; depth: number; fx: number; fy: number; yOffset: number; anchor: 'bottom' | 'top'; alpha?: number }[] {
    const B = Backdrop;
    const all = [
      { build: B.cloudsTexture, height: 220, depth: DEPTH.parallax - 5, fx: 0.06, fy: 0.05, yOffset: 10, anchor: 'top' as const, alpha: p.id === 'sky' ? 0.9 : 0.75 },
      { build: B.farTexture, height: 440, depth: DEPTH.parallax, fx: 0.14, fy: 0.1, yOffset: 24, anchor: 'bottom' as const },
      { build: B.midTexture, height: 300, depth: DEPTH.parallax + 10, fx: 0.32, fy: 0.25, yOffset: 56, anchor: 'bottom' as const },
      { build: B.nearTexture, height: 280, depth: DEPTH.parallax + 20, fx: 0.58, fy: 0.45, yOffset: 96, anchor: 'bottom' as const },
      { build: B.canopyTexture, height: 150, depth: DEPTH.foreground, fx: 0.78, fy: 0.5, yOffset: -6, anchor: 'top' as const },
    ];
    if (quality === 'low') return [all[1], all[3]];
    if (quality === 'balanced') return [all[0], all[1], all[2], all[3]];
    return all;
  }

  private static profile(x: number, w: number, base: number, a1: number, a2: number, k1: number, k2: number, phase: number): number {
    const t = (x / w) * Math.PI * 2;
    return base + Math.sin(t * k1) * a1 + Math.sin(t * k2 + phase) * a2;
  }

  private static kind(p: ThemePalette): 'hills' | 'swamp' | 'industrial' | 'clouds' | 'gold' {
    return p.id === 'sky' ? 'clouds' : p.id === 'factory' ? 'industrial' : p.id === 'hq' ? 'gold' : p.id === 'swamp' ? 'swamp' : 'hills';
  }

  /** Soft cloud wisps across the top of the sky. */
  private static cloudsTexture(scene: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator): string {
    const key = `bg-clouds-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const w = 1200, h = 220;
    const g = scene.add.graphics();
    const col = p.id === 'hq' ? 0x5a2a3a : p.id === 'factory' ? 0x6b5a5a : p.id === 'swamp' ? 0x3d5a4a : 0xffffff;
    for (let i = 0; i < 6; i++) {
      const cx = (i / 6) * w + rng.between(-40, 40), cy = 40 + rng.between(0, 110), r = rng.between(22, 40);
      for (const off of [0, -w, w]) {
        g.fillStyle(col, 0.55); g.fillEllipse(cx + off, cy + r * 0.3, r * 4.4, r * 1.2);
        g.fillStyle(col, 0.8); g.fillCircle(cx + off - r, cy, r * 0.9); g.fillCircle(cx + off + r * 0.3, cy - r * 0.35, r * 1.15); g.fillCircle(cx + off + r * 1.5, cy + r * 0.1, r * 0.8);
      }
    }
    g.generateTexture(key, w, h); g.destroy();
    return key;
  }

  /** Distant layer with a recognisable landmark per theme. Tiles every 1920px. */
  private static farTexture(scene: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator): string {
    const key = `bg-far-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const w = 1920, h = 440;
    const g = scene.add.graphics();
    const kind = Backdrop.kind(p);
    const phase = rng.frac() * 6;
    const base = p.farHills;
    if (kind === 'clouds') {
      // cloud "server racks": stacked rounded shelves with little blinking lights, and a rainbow arc
      for (let i = 0; i < 4; i++) {
        const cx = 240 + i * 480 + rng.between(-40, 40);
        const r = 110 + rng.between(0, 30);
        for (const off of [0, -w, w]) { g.fillStyle(base, 0.95); g.fillEllipse(cx + off, h - 60, r * 3, r); g.fillCircle(cx + off - r * 0.8, h - 60 - r * 0.4, r * 0.8); g.fillCircle(cx + off + r * 0.3, h - 60 - r * 0.6, r); g.fillCircle(cx + off + r * 1.1, h - 60 - r * 0.2, r * 0.7); }
      }
      g.lineStyle(14, 0xffffff, 0.18); g.strokeCircle(w * 0.5, h + 200, 500);
      g.lineStyle(14, 0xffd1dc, 0.14); g.strokeCircle(w * 0.5, h + 200, 520);
      g.lineStyle(14, 0xfff1a8, 0.14); g.strokeCircle(w * 0.5, h + 200, 540);
      // tiny lights on the shelves
      g.fillStyle(0xffffff, 0.8); for (let i = 0; i < 40; i++) g.fillCircle(rng.between(0, w), h - rng.between(40, 160), 2);
    } else if (kind === 'industrial') {
      // skyline of stacks and a giant banana billboard
      g.fillStyle(base, 1);
      let x = 0;
      while (x < w) { const bw = rng.between(50, 130), bh = rng.between(90, 240); g.fillRect(x, h - bh, bw, bh); if (rng.frac() < 0.5) g.fillRect(x + bw / 2 - 7, h - bh - rng.between(30, 80), 14, 80); x += bw + rng.between(4, 24); }
      // billboard
      const bx = 1300, by = h - 330;
      g.fillStyle(base, 1); g.fillRect(bx - 12, by + 120, 24, 220); g.fillRoundedRect(bx - 170, by, 340, 150, 12);
      g.fillStyle(0x3a2308, 1); fillPts(g, bananaPolygon(4.2).map((q) => ({ x: q.x + bx, y: q.y + by + 70 })));
      g.fillStyle(0xf2c94c, 1); fillPts(g, bananaPolygon(3.8).map((q) => ({ x: q.x + bx, y: q.y + by + 70 })));
      // smoke puffs
      g.fillStyle(0xffffff, 0.12); for (let i = 0; i < 12; i++) g.fillCircle(rng.between(0, w), h - rng.between(260, 340), rng.between(14, 36));
    } else if (kind === 'gold') {
      // gold-bar skyline + pig statue on a plinth
      g.fillStyle(base, 1);
      let x = 0;
      while (x < w) { const bw = rng.between(60, 120), bh = rng.between(60, 200); g.fillRoundedRect(x, h - bh, bw, bh, 6); g.fillStyle(0xf7c948, 0.12); g.fillRect(x + 6, h - bh + 6, bw - 12, 4); g.fillStyle(base, 1); x += bw + rng.between(6, 18); }
      const sx = 960, sy = h - 40;
      g.fillStyle(0x2a1430, 1); g.fillRect(sx - 90, sy - 70, 180, 70); g.fillRect(sx - 120, sy - 20, 240, 20);
      g.fillStyle(0x3a1a3a, 1); g.fillEllipse(sx, sy - 170, 150, 110); g.fillCircle(sx, sy - 250, 60); g.fillTriangle(sx - 55, sy - 275, sx - 40, sy - 320, sx - 15, sy - 290); g.fillTriangle(sx + 55, sy - 275, sx + 40, sy - 320, sx + 15, sy - 290);
      g.fillStyle(0xf7c948, 0.6); fillPts(g, bananaPolygon(1.6).map((q) => ({ x: q.x + sx + 70, y: q.y + sy - 200 })));
    } else if (kind === 'swamp') {
      // mist band, dead trees, a stilt shack
      g.fillStyle(base, 1);
      for (let x = 0; x <= w; x += 4) { const y = Backdrop.profile(x, w, 190, 30, 18, 2, 5, phase); g.fillRect(x, y, 5, h - 3 - y); }
      for (let i = 0; i < 10; i++) {
        const tx = (i / 10) * w + rng.between(-40, 40), th = rng.between(120, 220), ty = Backdrop.profile(tx, w, 190, 30, 18, 2, 5, phase);
        g.fillStyle(0x203a30, 1); g.fillRect(tx - 6, ty - th, 12, th + 10);
        for (let b = 0; b < 3; b++) { const by = ty - th + 20 + b * 40, dir = b % 2 ? 1 : -1; g.fillTriangle(tx, by + 12, tx, by, tx + dir * rng.between(30, 60), by - rng.between(10, 30)); }
      }
      const sx = 1500, sy = Backdrop.profile(1500, w, 190, 30, 18, 2, 5, phase);
      g.fillStyle(0x203a30, 1); g.fillRect(sx - 60, sy - 110, 120, 70); g.fillTriangle(sx - 75, sy - 110, sx, sy - 160, sx + 75, sy - 110); g.fillRect(sx - 45, sy - 40, 8, 50); g.fillRect(sx + 37, sy - 40, 8, 50);
      g.fillStyle(0xfff1a8, 0.5); g.fillRect(sx - 14, sy - 92, 28, 24);
      g.fillStyle(0xb9ff6a, 0.08); g.fillRect(0, h - 120, w, 120);
    } else {
      // jungle: rolling hills, a giant kapok tree and a mossy temple
      g.fillStyle(base, 1);
      for (let x = 0; x <= w; x += 4) { const y = Backdrop.profile(x, w, 170, 55, 22, 2, 5, phase); g.fillRect(x, y, 5, h - 3 - y); }
      for (let i = 0; i < 7; i++) { const cx = (i / 7) * w + 90; const y = Backdrop.profile(cx, w, 170, 55, 22, 2, 5, phase); g.fillCircle(cx, y + 24, 46); }
      // temple
      const tx = 1400, ty = h - 30;
      g.fillStyle(mix(base, 0x000000, 0.18), 1);
      for (let s = 0; s < 7; s++) g.fillRect(tx - 230 + s * 30, ty - 24 - s * 22, 460 - s * 60, 24);
      g.fillRect(tx - 20, ty - 206, 40, 30);
      g.fillStyle(mix(base, 0x000000, 0.4), 1); g.fillRect(tx - 18, ty - 22, 36, 22); g.fillRect(tx - 9, ty - 202, 18, 16);
      g.fillStyle(0xfff1a8, 0.35); g.fillRect(tx - 7, ty - 200, 14, 10);
      g.fillStyle(mix(base, 0x000000, 0.3), 1); for (let s = 0; s < 7; s++) g.fillRect(tx - 230 + s * 30, ty - 24 - s * 22, 460 - s * 60, 3);
      // giant kapok tree: slim buttressed trunk, a few thick branches and a dense round canopy
      // anchored near the texture bottom so the canopy always fits inside the layer
      const kx = 520, ky = h - 30;
      const dark = mix(base, 0x000000, 0.22);
      g.fillStyle(dark, 1);
      g.fillTriangle(kx - 34, ky + 10, kx + 34, ky + 10, kx + 10, ky - 120); g.fillTriangle(kx - 34, ky + 10, kx + 34, ky + 10, kx - 10, ky - 120);
      g.fillRect(kx - 11, ky - 150, 22, 40);
      g.lineStyle(12, dark, 1);
      for (const [dx, dy] of [[-90, -210], [80, -220], [-40, -250], [50, -255]] as const) { g.beginPath(); g.moveTo(kx, ky - 140); g.lineTo(kx + dx, ky + dy); g.strokePath(); }
      g.fillStyle(dark, 1);
      for (const [dx, dy, r] of [[-110, -235, 58], [-40, -270, 70], [40, -280, 74], [115, -245, 60], [0, -225, 64], [-70, -300, 44], [70, -310, 46]] as const) g.fillCircle(kx + dx, ky + dy, r);
      g.fillStyle(0xffffff, 0.1); g.fillCircle(kx - 50, ky - 300, 28); g.fillCircle(kx + 40, ky - 318, 22);
      g.fillStyle(dark, 1); for (const vx of [-150, -60, 20, 130]) g.fillRect(kx + vx, ky - 220, 4, 60 + ((vx * 7) % 40 + 40) % 40);
    }
    g.generateTexture(key, w, h); g.destroy();
    return key;
  }

  private static midTexture(scene: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator): string {
    const key = `bg-mid-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const w = 960, h = 300;
    const g = scene.add.graphics();
    const kind = Backdrop.kind(p);
    const phase = rng.frac() * 6;
    if (kind === 'clouds') {
      g.fillStyle(p.midHills, 0.95);
      for (let i = 0; i < 5; i++) { const cx = (i / 5) * w + rng.between(-40, 40), cy = 200 + rng.between(-30, 40), r = rng.between(50, 80); for (const off of [0, -w, w]) { g.fillEllipse(cx + off, cy, r * 3, r * 1.2); g.fillCircle(cx + off - r * 0.7, cy - r * 0.4, r * 0.8); g.fillCircle(cx + off + r * 0.5, cy - r * 0.55, r); } }
    } else if (kind === 'industrial' || kind === 'gold') {
      g.fillStyle(p.midHills, 1);
      let x = 0;
      while (x < w) {
        const bw = rng.between(60, 140), bh = rng.between(60, 170);
        g.fillStyle(p.midHills, 1); g.fillRect(x, h - 3 - bh, bw, bh);
        g.fillStyle(kind === 'gold' ? 0xf7c948 : p.skyBottom, kind === 'gold' ? 0.25 : 0.35);
        for (let wy = h - bh + 12; wy < h - 10; wy += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 18) if (rng.frac() < 0.6) g.fillRect(wx, wy, 8, 10);
        x += bw + rng.between(6, 30);
      }
      if (kind === 'industrial') { g.fillStyle(p.midHills, 1); g.fillRect(0, h - 40, w, 10); for (let x2 = 10; x2 < w; x2 += 120) g.fillRect(x2, h - 120, 14, 90); }
    } else {
      g.fillStyle(p.midHills, 1);
      for (let x = 0; x <= w; x += 4) { const y = Backdrop.profile(x, w, 175, 28, 16, 3, 7, phase); g.fillRect(x, y, 5, h - 3 - y); }
      for (let x = 0; x < w; x += rng.between(24, 38)) { const y = Backdrop.profile(x, w, 175, 28, 16, 3, 7, phase); const r = rng.between(16, 30); for (const off of [0, -w, w]) g.fillCircle(x + off, y - r * 0.4, r); }
      if (kind === 'hills') { g.fillStyle(0xffffff, 0.08); for (let x = 0; x < w; x += 70) { const y = Backdrop.profile(x, w, 175, 28, 16, 3, 7, phase); g.fillCircle(x, y - 6, 10); } }
    }
    g.generateTexture(key, w, h); g.destroy();
    return key;
  }

  /** Vegetation / props right behind the terrain. */
  private static nearTexture(scene: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator): string {
    const key = `bg-near-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const w = 1200, h = 280;
    const g = scene.add.graphics();
    const kind = Backdrop.kind(p);
    const col = p.nearTrees;
    if (kind === 'clouds') {
      g.fillStyle(col, 0.9);
      for (let i = 0; i < 5; i++) { const cx = (i / 5) * w + rng.between(-40, 40), cy = 230 + rng.between(-15, 25), r = rng.between(50, 70); for (const off of [0, -w, w]) { g.fillEllipse(cx + off, cy, r * 3.2, r * 1.1); g.fillCircle(cx + off - r * 0.8, cy - r * 0.3, r * 0.75); g.fillCircle(cx + off + r * 0.4, cy - r * 0.5, r * 0.95); } }
    } else if (kind === 'industrial' || kind === 'gold') {
      for (let x = 0; x < w; x += rng.between(140, 220)) {
        const tw = rng.between(50, 90), th = rng.between(80, 150);
        for (const off of [0, -w, w]) { g.fillStyle(col, 1); g.fillRoundedRect(x + off, h - 3 - th, tw, th, 10); g.fillRect(x + off + tw / 2 - 5, h - th - 33, 10, 30); g.fillStyle(0xffffff, 0.08); g.fillRect(x + off + 8, h - th + 6, 6, th - 20); }
      }
      g.fillStyle(col, 1); g.fillRect(0, h - 36, w, 12); for (let x = 0; x < w; x += 70) g.fillRect(x, h - 36, 10, 33);
      if (kind === 'gold') { g.fillStyle(0xf7c948, 0.35); for (let x = 20; x < w; x += 140) g.fillRect(x, h - 30, 40, 4); }
    } else if (kind === 'swamp') {
      // reeds, cattails, hanging moss
      for (let x = 0; x < w; x += rng.between(14, 26)) {
        const rh = rng.between(60, 150);
        for (const off of [0, -w, w]) { g.fillStyle(col, 1); g.fillRect(x + off - 2, h - 3 - rh, 4, rh); if (rng.frac() < 0.3) g.fillRoundedRect(x + off - 5, h - 3 - rh - 6, 10, 22, 5); }
      }
      for (let x = 0; x < w; x += rng.between(90, 160)) { const th = rng.between(160, 250); for (const off of [0, -w, w]) { g.fillStyle(col, 1); g.fillRect(x + off - 8, h - 3 - th, 16, th); for (let b = 0; b < 3; b++) { const by = h - th + 10 + b * 50; g.fillRect(x + off + (b % 2 ? 8 : -60), by, 60, 6); } } }
    } else {
      // jungle trees: trunks, layered canopies, big leaves and ferns at the base
      for (let x = 30; x < w; x += rng.between(110, 170)) {
        const trunkH = rng.between(110, 190), r = rng.between(40, 60);
        for (const off of [0, -w, w]) {
          g.fillStyle(col, 1); g.fillRect(x + off - 9, h - 3 - trunkH, 18, trunkH);
          g.fillCircle(x + off, h - trunkH - r * 0.2, r); g.fillCircle(x + off - r * 0.75, h - trunkH + r * 0.3, r * 0.8); g.fillCircle(x + off + r * 0.75, h - trunkH + r * 0.25, r * 0.85);
          g.fillStyle(0xffffff, 0.08); g.fillCircle(x + off - r * 0.3, h - trunkH - r * 0.45, r * 0.5);
        }
      }
      // ferns and big leaves along the base
      for (let x = 0; x < w; x += rng.between(50, 90)) {
        for (const off of [0, -w, w]) {
          const base = h - 3;
          for (let k = -2; k <= 2; k++) { const len = rng.between(40, 80), ang = -Math.PI / 2 + k * 0.42; g.fillStyle(col, 1); g.fillTriangle(x + off, base, x + off + Math.cos(ang - 0.15) * len, base + Math.sin(ang - 0.15) * len, x + off + Math.cos(ang + 0.15) * len, base + Math.sin(ang + 0.15) * len); }
        }
      }
      g.fillStyle(col, 1); for (let x = 0; x < w + 40; x += 22) g.fillCircle(x, h - 22, rng.between(12, 20));
    }
    g.generateTexture(key, w, h); g.destroy();
    return key;
  }

  /** Foreground framing hanging from the top edge: canopy leaves and vines, ducts, bunting. */
  private static canopyTexture(scene: Phaser.Scene, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator): string {
    const key = `bg-canopy-${p.id}`;
    if (scene.textures.exists(key)) return key;
    const w = 1200, h = 150;
    const g = scene.add.graphics();
    const kind = Backdrop.kind(p);
    if (kind === 'hills' || kind === 'swamp') {
      const dark = mix(p.nearTrees, 0x000000, 0.35);
      for (let x = 0; x < w; x += rng.between(60, 110)) {
        for (const off of [0, -w, w]) {
          const r = rng.between(34, 60);
          g.fillStyle(dark, 1); g.fillCircle(x + off, 10, r); g.fillCircle(x + off + r * 0.8, -4, r * 0.8);
          // hanging leaves / vine
          if (rng.frac() < 0.6) { const vl = rng.between(30, 90); g.fillRect(x + off - 2, r - 6, 4, vl); g.fillEllipse(x + off, r + vl, 14, 22); }
        }
      }
      if (kind === 'swamp') { g.fillStyle(dark, 0.9); for (let x = 20; x < w; x += rng.between(40, 90)) { const ml = rng.between(40, 120); g.fillRect(x - 1, 0, 2, ml); g.fillRect(x + 4, 0, 1, ml * 0.7); } }
    } else if (kind === 'industrial') {
      g.fillStyle(0x1f2026, 1); g.fillRect(0, 0, w, 26); g.fillRect(0, 26, w, 6);
      for (let x = 0; x < w; x += 90) { g.fillStyle(0x3a3d47, 1); g.fillRoundedRect(x + 10, 20, 60, 24, 6); g.fillStyle(0x1f2026, 1); g.fillRect(x + 36, 44, 8, 30); }
      g.fillStyle(0xffd27a, 0.35); for (let x = 45; x < w; x += 180) g.fillCircle(x, 80, 9);
    } else if (kind === 'gold') {
      // bunting with golden flags
      g.lineStyle(3, 0x1a1008, 1);
      for (let x = 0; x < w; x += 200) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 100, 50); g.lineTo(x + 200, 10); g.strokePath(); for (let k = 0; k < 5; k++) { const fx = x + 20 + k * 40, fy = 14 + Math.sin((k / 4) * Math.PI) * 36; g.fillStyle(k % 2 ? 0xf7c948 : 0xf4a7b4, 1); g.fillTriangle(fx - 10, fy, fx + 10, fy, fx, fy + 24); } }
    } else {
      g.fillStyle(0xffffff, 0.5); for (let x = 0; x < w; x += rng.between(160, 260)) g.fillEllipse(x, 10, rng.between(120, 220), 30);
    }
    g.generateTexture(key, w, h); g.destroy();
    return key;
  }
}

function hex(c: number): string { return '#' + c.toString(16).padStart(6, '0'); }
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
