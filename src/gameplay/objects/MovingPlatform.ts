import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { Point } from '../../levels/types';
import type { ThemePalette } from '../world/themes';

/**
 * Platform that follows a closed path of waypoints at constant speed. Moved positionally each frame
 * (body.moves = false) so the carry delta handed to riders is exact and deterministic; Arcade friction is
 * disabled to avoid applying the carry twice.
 */
export class MovingPlatform extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;
  readonly widthPx: number;
  readonly heightPx = 20;
  deltaX = 0;
  deltaY = 0;
  private path: Point[];
  private segment = 0;
  private speed: number;
  private pauseMs: number;
  private waitLeft = 0;
  private startPos: Point;

  constructor(scene: Phaser.Scene, x: number, y: number, widthTiles: number, path: Point[], speed: number, pauseMs: number, palette: ThemePalette) {
    super(scene, x, y);
    this.widthPx = widthTiles * TILE;
    this.speed = speed;
    this.pauseMs = pauseMs;
    this.startPos = { x, y };
    // path points are relative tile offsets from the start position; the platform returns to start at the end.
    this.path = [...path.map((p) => ({ x: x + p.x * TILE, y: y + p.y * TILE })), { x, y }];
    this.add(this.draw(palette));
    this.setSize(this.widthPx, this.heightPx).setDepth(DEPTH.objects);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.body.immovable = true;
    this.body.moves = false;
    this.body.setFriction(0, 0);
    this.body.checkCollision.down = false;
    this.body.checkCollision.left = false;
    this.body.checkCollision.right = false;
  }

  private draw(p: ThemePalette): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    const w = this.widthPx, h = this.heightPx;
    g.fillStyle(p.outline, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.fillStyle(p.plank, 1); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 4);
    g.fillStyle(p.plankDark, 1); g.fillRect(-w / 2 + 3, h / 2 - 7, w - 6, 4);
    g.fillStyle(0xffffff, 0.3); g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 2);
    g.fillStyle(p.outline, 1);
    for (let i = 1; i < w / TILE; i++) g.fillRect(-w / 2 + i * TILE - 1, -h / 2 + 3, 2, h - 6);
    // little rivets
    g.fillCircle(-w / 2 + 8, 0, 2); g.fillCircle(w / 2 - 8, 0, 2);
    return g;
  }

  /** Reset to the start of the path (checkpoint restore). */
  resetToStart(): void {
    this.segment = 0; this.waitLeft = 0; this.deltaX = this.deltaY = 0;
    this.setPosition(this.startPos.x, this.startPos.y);
    this.body.reset(this.startPos.x, this.startPos.y);
  }

  override update(dt: number): void {
    this.deltaX = 0; this.deltaY = 0;
    if (this.waitLeft > 0) { this.waitLeft -= dt * 1000; return; }
    const target = this.path[this.segment];
    const dx = target.x - this.x, dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    let nx: number, ny: number;
    if (dist <= step) {
      nx = target.x; ny = target.y;
      this.segment = (this.segment + 1) % this.path.length;
      this.waitLeft = this.pauseMs;
    } else {
      nx = this.x + (dx / dist) * step; ny = this.y + (dy / dist) * step;
    }
    this.deltaX = nx - this.x; this.deltaY = ny - this.y;
    this.setPosition(nx, ny);
  }
}
