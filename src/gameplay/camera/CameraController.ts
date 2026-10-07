import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../core/constants';
import { getRenderScale } from '../../core/render/RenderScale';

/**
 * Side-scroller camera: eases toward a point ahead of the player, keeps a vertical dead-band so small hops
 * don't bounce the view, and never leaves the level bounds. Shake respects the settings toggle.
 */
export class CameraController {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private lookX = 0;
  private targetY = 0;
  private boundsW: number;
  private boundsH: number;
  shakeEnabled = true;
  lookAhead = 110;
  verticalBias = -40;

  constructor(scene: Phaser.Scene, levelW: number, levelH: number) {
    this.cam = scene.cameras.main;
    this.boundsW = Math.max(levelW, GAME_WIDTH);
    this.boundsH = Math.max(levelH, GAME_HEIGHT);
    this.cam.setBounds(0, 0, this.boundsW, this.boundsH);
    this.applyZoom();
  }

  applyZoom(): void {
    this.cam.setZoom(getRenderScale());
  }

  snapTo(x: number, y: number, facing: 1 | -1): void {
    this.lookX = facing * this.lookAhead;
    this.targetY = y + this.verticalBias;
    this.cam.centerOn(x + this.lookX, this.targetY);
  }

  update(dt: number, x: number, y: number, facing: 1 | -1, vy: number, grounded: boolean): void {
    const k = Math.min(1, dt * 4.5);
    this.lookX += (facing * this.lookAhead - this.lookX) * k;
    // vertical: follow when grounded or falling fast / far outside the band
    const band = 70;
    const desired = y + this.verticalBias;
    if (grounded || vy > 500 || Math.abs(desired - this.targetY) > band) {
      const kv = Math.min(1, dt * (grounded ? 6 : 3.5));
      this.targetY += (desired - this.targetY) * kv;
    }
    this.cam.centerOn(x + this.lookX, this.targetY);
  }

  shake(intensity = 0.004, durationMs = 180): void {
    if (!this.shakeEnabled) return;
    this.cam.shake(durationMs, intensity);
  }
}
