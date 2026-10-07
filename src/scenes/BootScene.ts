import Phaser from 'phaser';

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
    // banana (simple crescent) for pickups
    g.fillStyle(0x2c1a0e, 1); g.fillEllipse(16, 16, 30, 16); g.fillStyle(0xf7c948, 1); g.fillEllipse(16, 16, 26, 12);
    g.fillStyle(0xffe58a, 1); g.fillEllipse(13, 13, 14, 4); g.generateTexture('banana', 32, 32); g.clear();
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
