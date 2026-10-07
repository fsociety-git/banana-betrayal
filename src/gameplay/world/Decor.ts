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
      const w = 240, h = 320, bx = 100;
      // curved trunk made of stacked segments
      for (let i = 0; i < 11; i++) {
        const t = i / 10, sx = bx + Math.sin(t * 1.4) * 22, sy = 300 - i * 22;
        g.fillStyle(p.outline, 1); g.fillRoundedRect(sx - 13, sy - 12, 26, 26, 6);
        g.fillStyle(i % 2 ? p.plank : p.plankDark, 1); g.fillRoundedRect(sx - 10, sy - 9, 20, 20, 5);
        g.fillStyle(0xffffff, 0.18); g.fillRect(sx - 7, sy - 7, 4, 16);
      }
      const tx = bx + Math.sin(1.4) * 22, ty = 80;
      // fronds: layered, with a darker underside
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + variant * 0.4;
        const len = 100 + (i % 2) * 18;
        const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.45 - 10;
        const mx = tx + Math.cos(a) * len * 0.5, my = ty + Math.sin(a) * len * 0.5 * 0.45 - 28;
        g.fillStyle(p.outline, 1); g.fillTriangle(tx, ty, mx - 14, my - 14, ex, ey); g.fillTriangle(tx, ty, mx + 14, my + 14, ex, ey);
        g.fillStyle(i % 2 ? p.grassDark : p.grass, 1); g.fillTriangle(tx, ty, mx - 9, my - 9, ex - 4, ey - 2); g.fillTriangle(tx, ty, mx + 9, my + 9, ex - 4, ey - 2);
        g.fillStyle(0xffffff, 0.14); g.fillTriangle(tx, ty, mx - 4, my - 4, ex - 10, ey - 6);
      }
      // coconut cluster
      g.fillStyle(p.outline, 1); g.fillCircle(tx - 12, ty + 16, 13); g.fillCircle(tx + 10, ty + 18, 13); g.fillCircle(tx - 1, ty + 4, 13);
      g.fillStyle(0x6b4a2b, 1); g.fillCircle(tx - 12, ty + 16, 10); g.fillCircle(tx + 10, ty + 18, 10); g.fillCircle(tx - 1, ty + 4, 10);
      g.fillStyle(0x8a6540, 1); g.fillCircle(tx - 15, ty + 12, 4); g.fillCircle(tx + 7, ty + 14, 4); g.fillCircle(tx - 4, ty, 4);
      return { w, h };
    }
    case 'bush': {
      const w = 130, h = 80;
      const blobs = [[32, 54, 28], [66, 44, 34], [100, 56, 26], [50, 30, 20], [84, 32, 18]] as const;
      g.fillStyle(p.outline, 1); for (const [cx, cy, r] of blobs) g.fillCircle(cx, cy, r + 3);
      for (const [cx, cy, r] of blobs) { g.fillStyle(cy > 40 ? p.grassDark : p.grass, 1); g.fillCircle(cx, cy, r); }
      g.fillStyle(p.grass, 1); for (const [cx, cy, r] of blobs) g.fillCircle(cx - r * 0.25, cy - r * 0.3, r * 0.55);
      g.fillStyle(0xffffff, 0.28); g.fillCircle(58, 24, 8); g.fillCircle(86, 28, 5);
      if (variant === 1) { g.fillStyle(p.outline, 1); for (const [bx, by] of [[44, 48], [72, 40], [60, 58], [94, 50]] as const) g.fillCircle(bx, by, 5); g.fillStyle(0xe5484d, 1); for (const [bx, by] of [[44, 48], [72, 40], [60, 58], [94, 50]] as const) g.fillCircle(bx, by, 3.5); g.fillStyle(0xffffff, 0.7); for (const [bx, by] of [[44, 48], [72, 40], [60, 58], [94, 50]] as const) g.fillCircle(bx - 1, by - 1, 1.2); }
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
      const w = 84, h = 50;
      g.fillStyle(p.outline, 1); g.fillEllipse(42, 34, 80, 32); g.fillCircle(30, 22, 18); g.fillCircle(56, 26, 14);
      g.fillStyle(p.stone, 1); g.fillEllipse(42, 34, 72, 24); g.fillCircle(30, 22, 15); g.fillCircle(56, 26, 11);
      g.fillStyle(0x000000, 0.14); g.fillEllipse(48, 40, 56, 10);
      g.fillStyle(0xffffff, 0.35); g.fillEllipse(26, 18, 14, 6);
      g.fillStyle(p.grassDark, 1); g.fillTriangle(8, 48, 14, 36, 20, 48); g.fillTriangle(66, 48, 72, 38, 78, 48);
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
