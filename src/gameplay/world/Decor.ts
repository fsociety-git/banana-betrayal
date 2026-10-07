import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { ThemePalette } from './themes';

/**
 * Non-interactive set dressing drawn with Graphics (baked to textures per kind+theme). Clearly softer and
 * behind gameplay so it never reads as a platform or a hazard.
 */
export function placeDecor(scene: Phaser.Scene, kind: string, footX: number, footY: number, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator): Phaser.GameObjects.Image | null {
  const variant = rng.between(0, 2);
  const key = `decor-${p.id}-${kind}-${variant}`;
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics();
    const size = drawDecor(g, kind, p, variant, rng);
    if (!size) { g.destroy(); return null; }
    g.generateTexture(key, size.w, size.h);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  const img = scene.add.image(footX, footY, key).setOrigin(0.5, 1).setDepth(kind === 'vines' ? DEPTH.foreground : DEPTH.decorBack);
  if (rng.frac() < 0.5) img.setFlipX(true);
  return img;
}

function drawDecor(g: Phaser.GameObjects.Graphics, kind: string, p: ThemePalette, variant: number, rng: Phaser.Math.RandomDataGenerator): { w: number; h: number } | null {
  switch (kind) {
    case 'palm': {
      const w = 220, h = 300, bx = 90;
      g.fillStyle(p.outline, 1); g.fillRoundedRect(bx - 11, 70, 22, 230, 8);
      g.fillStyle(p.plank, 1); g.fillRoundedRect(bx - 8, 73, 16, 227, 6);
      g.fillStyle(p.plankDark, 0.8); for (let y = 90; y < 290; y += 22) g.fillRect(bx - 8, y, 16, 4);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + variant * 0.4;
        const lx = bx + Math.cos(a) * 62, ly = 68 + Math.sin(a) * 26 - 18;
        g.fillStyle(p.outline, 1); g.fillEllipse(lx, ly, 96, 30);
        g.fillStyle(i % 2 ? p.grassDark : p.grass, 1); g.fillEllipse(lx, ly, 86, 22);
      }
      g.fillStyle(p.outline, 1); g.fillCircle(bx, 62, 16); g.fillStyle(0x6b4a2b, 1); g.fillCircle(bx - 10, 64, 8); g.fillCircle(bx + 8, 68, 8); g.fillCircle(bx, 56, 8);
      return { w, h };
    }
    case 'bush': {
      const w = 120, h = 70;
      g.fillStyle(p.outline, 1);
      for (const [cx, cy, r] of [[30, 48, 26], [62, 40, 32], [94, 50, 24]] as const) g.fillCircle(cx, cy, r + 3);
      for (const [cx, cy, r, c] of [[30, 48, 26, p.grassDark], [94, 50, 24, p.grassDark], [62, 40, 32, p.grass]] as const) { g.fillStyle(c, 1); g.fillCircle(cx, cy, r); }
      g.fillStyle(0xffffff, 0.25); g.fillCircle(54, 30, 10);
      if (variant === 1) { g.fillStyle(0xe5484d, 1); g.fillCircle(44, 44, 4); g.fillCircle(72, 36, 4); g.fillCircle(60, 52, 4); }
      return { w, h };
    }
    case 'flowers': {
      const w = 90, h = 40;
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * 22, hh = rng.between(16, 30);
        g.fillStyle(p.grassDark, 1); g.fillRect(x - 2, 40 - hh, 4, hh);
        const col = [0xe5484d, 0xf7c948, 0xf4a7b4, 0x9fe3ff][(i + variant) % 4];
        g.fillStyle(p.outline, 1); g.fillCircle(x, 40 - hh, 8);
        g.fillStyle(col, 1); g.fillCircle(x, 40 - hh, 6);
        g.fillStyle(0xffffff, 0.8); g.fillCircle(x, 40 - hh, 2.5);
      }
      return { w, h };
    }
    case 'rock': {
      const w = 80, h = 44;
      g.fillStyle(p.outline, 1); g.fillEllipse(40, 30, 76, 32);
      g.fillStyle(p.groundLight, 1); g.fillEllipse(40, 30, 68, 24);
      g.fillStyle(0xffffff, 0.3); g.fillEllipse(30, 24, 20, 8);
      return { w, h };
    }
    case 'reeds': {
      const w = 70, h = 90;
      for (let i = 0; i < 5; i++) { const x = 8 + i * 13; g.fillStyle(p.grassDark, 1); g.fillRect(x - 2, 90 - rng.between(50, 86), 4, 90); g.fillStyle(0x6b4a2b, 1); g.fillRoundedRect(x - 4, 90 - rng.between(55, 80), 8, 18, 4); }
      return { w, h };
    }
    case 'mushroom': {
      const w = 50, h = 48;
      g.fillStyle(p.outline, 1); g.fillRoundedRect(19, 22, 12, 26, 4); g.fillEllipse(25, 20, 48, 26);
      g.fillStyle(0xfff8e7, 1); g.fillRoundedRect(21, 24, 8, 22, 3);
      g.fillStyle(variant === 2 ? 0xf7c948 : 0xe5484d, 1); g.fillEllipse(25, 20, 42, 20);
      g.fillStyle(0xfff8e7, 1); g.fillCircle(15, 18, 4); g.fillCircle(30, 14, 3); g.fillCircle(34, 22, 3);
      return { w, h };
    }
    case 'crate': {
      const w = 60, h = 60;
      g.fillStyle(p.outline, 1); g.fillRect(0, 0, 60, 60);
      g.fillStyle(p.plank, 1); g.fillRect(4, 4, 52, 52);
      g.fillStyle(p.plankDark, 1); g.fillRect(4, 28, 52, 4); g.fillRect(28, 4, 4, 52);
      return { w, h };
    }
    case 'pipe': {
      const w = 48, h = 160;
      g.fillStyle(p.outline, 1); g.fillRect(14, 0, 20, 160);
      g.fillStyle(p.groundLight, 1); g.fillRect(17, 0, 14, 160);
      g.fillStyle(p.outline, 1); g.fillRect(8, 20, 32, 10); g.fillRect(8, 110, 32, 10);
      g.fillStyle(p.grass, 1); g.fillRect(10, 22, 28, 6); g.fillRect(10, 112, 28, 6);
      return { w, h };
    }
    case 'gear': {
      const w = 90, h = 90, cx = 45, cy = 45;
      g.fillStyle(p.outline, 1);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.fillRect(cx + Math.cos(a) * 34 - 8, cy + Math.sin(a) * 34 - 8, 16, 16); }
      g.fillCircle(cx, cy, 36);
      g.fillStyle(p.groundLight, 1); g.fillCircle(cx, cy, 30);
      g.fillStyle(p.outline, 1); g.fillCircle(cx, cy, 10);
      return { w, h };
    }
    case 'cloudpuff': {
      const w = 140, h = 70;
      g.fillStyle(0xffffff, 0.9); g.fillEllipse(70, 50, 130, 36); g.fillCircle(45, 36, 26); g.fillCircle(80, 30, 32); g.fillCircle(110, 42, 22);
      return { w, h };
    }
    case 'goldstack': {
      const w = 90, h = 70;
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) {
        const x = 8 + i * 20 + r * 10, y = 70 - (r + 1) * 20;
        g.fillStyle(p.outline, 1); g.fillRoundedRect(x, y, 22, 20, 4);
        g.fillStyle(0xf7c948, 1); g.fillRoundedRect(x + 2, y + 2, 18, 16, 3);
        g.fillStyle(0xffe58a, 1); g.fillRect(x + 4, y + 4, 14, 4);
      }
      return { w, h };
    }
    case 'poster': {
      const w = 90, h = 110;
      g.fillStyle(p.outline, 1); g.fillRect(0, 0, 90, 110);
      g.fillStyle(0xfff8e7, 1); g.fillRect(4, 4, 82, 102);
      g.fillStyle(0xf4a7b4, 1); g.fillCircle(45, 40, 24);
      g.fillStyle(p.outline, 1); g.fillRect(14, 74, 62, 6); g.fillRect(20, 86, 50, 6);
      return { w, h };
    }
    default:
      return null;
  }
}

/** Seeded decoration pass: grass tufts, flowers and small props along exposed ground tops. */
export function autoDecorate(scene: Phaser.Scene, grid: string[][], cols: number, rows: number, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator, kinds: string[]): Phaser.GameObjects.Image[] {
  const out: Phaser.GameObjects.Image[] = [];
  for (let y = 1; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== 'solid' || grid[y - 1][x] !== 'empty') continue;
      if (rng.frac() > 0.16) continue;
      const kind = kinds[rng.between(0, kinds.length - 1)];
      const img = placeDecor(scene, kind, x * TILE + TILE / 2 + rng.between(-8, 8), y * TILE + 4, p, rng);
      if (img) { img.setScale(rng.realInRange(0.55, 0.9)).setAlpha(0.95); out.push(img); }
    }
  }
  return out;
}
