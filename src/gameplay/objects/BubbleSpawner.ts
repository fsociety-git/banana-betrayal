import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { RideSource } from '../player/Player';

class Bubble extends Phaser.GameObjects.Container implements RideSource {
  declare body: Phaser.Physics.Arcade.Body;
  deltaX = 0;
  deltaY = 0;
  alive = true;
  readonly topY: number;
  private wobbleT = Math.random() * 6;
  constructor(scene: Phaser.Scene, x: number, y: number, topY: number) {
    super(scene, x, y);
    this.topY = topY;
    const g = scene.add.graphics();
    g.lineStyle(3, 0x2a4a5a, 0.8); g.strokeCircle(0, 0, 26);
    g.fillStyle(0x9fe3ff, 0.35); g.fillCircle(0, 0, 25);
    g.fillStyle(0xffffff, 0.7); g.fillEllipse(-9, -10, 12, 7);
    this.add(g);
    this.setSize(44, 40).setDepth(DEPTH.objects + 2);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false); this.body.immovable = true; this.body.moves = false; this.body.setFriction(0, 0);
    this.body.setSize(44, 20).setOffset(-22, -22);
    this.body.checkCollision.down = false; this.body.checkCollision.left = false; this.body.checkCollision.right = false;
  }
  rise(dt: number): void {
    this.wobbleT += dt;
    const nx = this.x + Math.sin(this.wobbleT * 3) * 18 * dt;
    const ny = this.y - 85 * dt;
    this.deltaX = nx - this.x; this.deltaY = ny - this.y;
    this.setPosition(nx, ny);
    if (ny <= this.topY) this.alive = false;
  }
}

/** Spawns rising bubbles from swamp water; riders float up with them until they pop. */
export class BubbleSpawner {
  readonly id: string;
  readonly bubbles: Bubble[] = [];
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private topY: number;
  private intervalMs: number;
  private timer: number;
  onPop: ((x: number, y: number) => void) | null = null;
  onSpawn: (() => void) | null = null;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, intervalMs: number, liftTiles: number) {
    this.scene = scene; this.id = id; this.x = x; this.y = y; this.intervalMs = intervalMs; this.topY = y - liftTiles * TILE;
    this.timer = intervalMs * 0.5;
  }

  update(dt: number): void {
    this.timer -= dt * 1000;
    if (this.timer <= 0) {
      this.timer += this.intervalMs;
      this.bubbles.push(new Bubble(this.scene, this.x, this.y, this.topY));
      this.onSpawn?.();
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.rise(dt);
      if (!b.alive) { this.onPop?.(b.x, b.y); b.destroy(); this.bubbles.splice(i, 1); }
    }
  }

  /** Pop every bubble (checkpoint restore) and restart the rhythm. */
  reset(): void { for (const b of this.bubbles) b.destroy(); this.bubbles.length = 0; this.timer = this.intervalMs * 0.5; }
  destroy(): void { this.reset(); }
}
