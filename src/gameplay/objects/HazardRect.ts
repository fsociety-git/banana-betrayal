import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import type { DeathCause } from '../../content/script';

/** Static deadly area with an animated look: spinning saw, crackling wire, or a slippery peel. */
export class HazardRect {
  readonly id: string;
  readonly hit: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.StaticBody;
  readonly cause: DeathCause;
  private gfx: Phaser.GameObjects.Graphics;
  private t = 0;
  private rect: { x: number; y: number; w: number; h: number };
  private kind: 'spikes' | 'saw' | 'electric' | 'peel';

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, w: number, h: number, kind: 'spikes' | 'saw' | 'electric' | 'peel') {
    this.id = id; this.kind = kind; this.rect = { x, y, w, h };
    this.cause = kind === 'saw' ? 'saw' : kind === 'electric' ? 'electric' : kind === 'peel' ? 'peel' : 'spikes';
    const inset = kind === 'peel' ? 6 : 8;
    this.hit = scene.add.rectangle(x + w / 2, y + h / 2, Math.max(8, w - inset * 2), Math.max(8, h - inset), 0xffffff, 0).setVisible(false);
    scene.physics.add.existing(this.hit, true);
    this.body = this.hit.body as Phaser.Physics.Arcade.StaticBody;
    this.gfx = scene.add.graphics().setDepth(DEPTH.objects + 3);
    this.draw();
  }

  update(dt: number): void { this.t += dt; if (this.kind !== 'peel') this.draw(); }

  private draw(): void {
    const g = this.gfx, r = this.rect;
    g.clear();
    if (this.kind === 'saw') {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.min(r.w, r.h) / 2;
      g.fillStyle(0x1f2026, 1);
      for (let i = 0; i < 10; i++) { const a = this.t * 9 + (i / 10) * Math.PI * 2; g.fillTriangle(cx + Math.cos(a) * rad * 0.8, cy + Math.sin(a) * rad * 0.8, cx + Math.cos(a + 0.2) * rad, cy + Math.sin(a + 0.2) * rad, cx + Math.cos(a + 0.45) * rad * 0.8, cy + Math.sin(a + 0.45) * rad * 0.8); }
      g.fillCircle(cx, cy, rad * 0.82);
      g.fillStyle(0xd0d4dc, 1); g.fillCircle(cx, cy, rad * 0.72);
      g.fillStyle(0x1f2026, 1); g.fillCircle(cx, cy, rad * 0.18);
      g.lineStyle(3, 0x1f2026, 1); for (let i = 0; i < 4; i++) { const a = this.t * 9 + (i / 4) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * rad * 0.25, cy + Math.sin(a) * rad * 0.25); g.lineTo(cx + Math.cos(a) * rad * 0.6, cy + Math.sin(a) * rad * 0.6); g.strokePath(); }
    } else if (this.kind === 'electric') {
      g.fillStyle(0x1f2026, 1); g.fillRect(r.x, r.y + r.h - 8, r.w, 8); g.fillRect(r.x, r.y, 6, r.h); g.fillRect(r.x + r.w - 6, r.y, 6, r.h);
      g.lineStyle(3, Math.floor(this.t * 20) % 2 ? 0x9fe3ff : 0xffffff, 0.9);
      g.beginPath(); g.moveTo(r.x + 6, r.y + r.h / 2);
      for (let xx = r.x + 6; xx <= r.x + r.w - 6; xx += 14) g.lineTo(xx, r.y + r.h / 2 + (Math.sin(xx * 0.7 + this.t * 40) * r.h) / 3);
      g.strokePath();
      g.fillStyle(0xf2c94c, 1); g.fillTriangle(r.x + r.w / 2 - 6, r.y + r.h - 8, r.x + r.w / 2 + 2, r.y + r.h - 24, r.x + r.w / 2 - 1, r.y + r.h - 8);
    } else if (this.kind === 'peel') {
      const cx = r.x + r.w / 2, by = r.y + r.h;
      g.fillStyle(0x2c1a0e, 1); g.fillEllipse(cx, by - 5, 44, 14);
      g.fillStyle(0xf7c948, 1); g.fillEllipse(cx, by - 6, 38, 10);
      g.fillStyle(0xf7c948, 1); g.fillTriangle(cx - 16, by - 8, cx - 6, by - 30, cx, by - 8); g.fillTriangle(cx + 2, by - 8, cx + 14, by - 28, cx + 18, by - 8);
      g.lineStyle(3, 0x2c1a0e, 1); g.strokeTriangle(cx - 16, by - 8, cx - 6, by - 30, cx, by - 8); g.strokeTriangle(cx + 2, by - 8, cx + 14, by - 28, cx + 18, by - 8);
      g.fillStyle(0x8a5a2b, 1); g.fillCircle(cx - 8, by - 26, 3);
    } else {
      g.fillStyle(0x2c1a0e, 1);
      for (let xx = r.x; xx < r.x + r.w; xx += 20) g.fillTriangle(xx, r.y + r.h, xx + 10, r.y + 6, xx + 20, r.y + r.h);
      g.fillStyle(0xe8e8f0, 1);
      for (let xx = r.x; xx < r.x + r.w; xx += 20) g.fillTriangle(xx + 3, r.y + r.h, xx + 10, r.y + 11, xx + 17, r.y + r.h);
    }
  }
  destroy(): void { this.gfx.destroy(); this.hit.destroy(); }
}
