import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import type { Rect } from '../../levels/types';
import type { ThemePalette } from './themes';

/** Animated water: translucent body + scrolling wave surface + drifting highlights. */
export class Water {
  private surfaces: Phaser.GameObjects.TileSprite[] = [];
  private bodies: Phaser.GameObjects.Rectangle[] = [];
  private t = 0;

  constructor(scene: Phaser.Scene, rects: Rect[], p: ThemePalette) {
    const key = `water-surface-${p.id}`;
    if (!scene.textures.exists(key)) {
      const g = scene.add.graphics();
      const w = 120, h = 24;
      g.fillStyle(p.water, 1);
      for (let x = 0; x <= w; x += 2) { const y = 8 + Math.sin((x / w) * Math.PI * 4) * 4; g.fillRect(x, y, 3, h - y); }
      g.fillStyle(p.waterLight, 0.9);
      for (let x = 0; x <= w; x += 2) { const y = 8 + Math.sin((x / w) * Math.PI * 4) * 4; g.fillRect(x, y, 3, 3); }
      g.fillStyle(0xffffff, 0.5); g.fillRect(10, 16, 22, 2); g.fillRect(70, 18, 16, 2);
      g.generateTexture(key, w, h);
      g.destroy();
    }
    for (const r of rects) {
      const body = scene.add.rectangle(r.x + r.w / 2, r.y + 12 + (r.h - 12) / 2, r.w, r.h - 12, p.water, 0.88).setDepth(DEPTH.objects + 4);
      const surf = scene.add.tileSprite(r.x + r.w / 2, r.y + 12, r.w, 24, key).setDepth(DEPTH.objects + 5).setAlpha(0.95);
      this.bodies.push(body);
      this.surfaces.push(surf);
    }
  }

  update(dt: number): void {
    this.t += dt;
    for (let i = 0; i < this.surfaces.length; i++) {
      const s = this.surfaces[i];
      s.tilePositionX += dt * 26 * (i % 2 ? -1 : 1);
      s.y = (this.bodies[i].y - this.bodies[i].height / 2) + Math.sin(this.t * 2 + i) * 1.5;
    }
  }

  destroy(): void {
    for (const s of this.surfaces) s.destroy();
    for (const b of this.bodies) b.destroy();
  }
}
