import Phaser from 'phaser';
import { drawBanana } from '../gameplay/fx/bananaShape';

/** Generates small procedural textures used everywhere (particles, soft shadow, UI bits) then preloads art. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    const g = this.add.graphics();
    // soft round particle
    g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8); g.generateTexture('dot', 16, 16); g.clear();
    // square chip (debris)
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 10, 10); g.generateTexture('chip', 10, 10); g.clear();
    // leaf
    g.fillStyle(0xffffff, 1); g.fillEllipse(8, 5, 16, 8); g.generateTexture('leaf', 16, 10); g.clear();
    // bananas: pickup + golden trophy (shared silhouette, see fx/bananaShape)
    drawBanana(g, 36, 34, 1, false); g.generateTexture('banana', 72, 68); g.clear();
    drawBanana(g, 36, 34, 1, true); g.generateTexture('banana-gold', 72, 68); g.clear();
    // ring (expanding puff) and spark (4-point star)
    g.lineStyle(4, 0xffffff, 1); g.strokeCircle(16, 16, 12); g.generateTexture('ring', 32, 32); g.clear();
    g.fillStyle(0xffffff, 1); g.fillTriangle(8, 0, 10, 6, 16, 8); g.fillTriangle(16, 8, 10, 10, 8, 16); g.fillTriangle(8, 16, 6, 10, 0, 8); g.fillTriangle(0, 8, 6, 6, 8, 0); g.generateTexture('spark', 16, 16); g.clear();
    g.destroy();
    // soft radial glow (canvas gradient)
    const glow = this.textures.createCanvas('glow', 128, 128);
    if (glow) {
      const ctx = glow.getContext();
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      glow.refresh();
    }
    this.scene.start('Preload');
  }
}
