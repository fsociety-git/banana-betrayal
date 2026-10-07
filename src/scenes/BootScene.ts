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
    this.scene.start('Preload');
  }
}
