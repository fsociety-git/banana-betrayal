import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { ThemePalette } from '../world/themes';

/** Factory belt: a solid-top platform that pushes whatever stands on it sideways. Stripes scroll to show direction. */
export class Conveyor {
  readonly id: string;
  readonly hit: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.StaticBody;
  readonly speed: number;
  private belt: Phaser.GameObjects.TileSprite;
  private frame: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, widthTiles: number, speed: number, palette: ThemePalette) {
    this.id = id; this.speed = speed;
    const w = widthTiles * TILE;
    this.hit = scene.add.rectangle(x, y + 10, w, 20, 0xffffff, 0).setVisible(false);
    scene.physics.add.existing(this.hit, true);
    this.body = this.hit.body as Phaser.Physics.Arcade.StaticBody;
    this.body.checkCollision.down = false;
    const key = 'belt-stripes';
    if (!scene.textures.exists(key)) {
      const g = scene.add.graphics();
      g.fillStyle(0x2a2a30, 1); g.fillRect(0, 0, 40, 16);
      g.fillStyle(0xf2c94c, 1); g.fillTriangle(4, 2, 16, 8, 4, 14); g.fillTriangle(22, 2, 34, 8, 22, 14);
      g.generateTexture(key, 40, 16); g.destroy();
    }
    this.frame = scene.add.graphics().setDepth(DEPTH.objects);
    this.frame.fillStyle(palette.outline, 1); this.frame.fillRoundedRect(x - w / 2 - 4, y - 2, w + 8, 26, 8);
    this.frame.fillStyle(palette.groundDark, 1); this.frame.fillRoundedRect(x - w / 2 - 1, y + 1, w + 2, 20, 6);
    this.frame.fillStyle(palette.outline, 1); this.frame.fillCircle(x - w / 2 + 6, y + 11, 7); this.frame.fillCircle(x + w / 2 - 6, y + 11, 7);
    this.belt = scene.add.tileSprite(x, y + 11, w - 20, 16, key).setDepth(DEPTH.objects + 1);
    if (speed < 0) this.belt.setFlipX(true);
  }

  update(dt: number): void { this.belt.tilePositionX += this.speed * dt * 0.9; }
  destroy(): void { this.belt.destroy(); this.frame.destroy(); this.hit.destroy(); }
}
