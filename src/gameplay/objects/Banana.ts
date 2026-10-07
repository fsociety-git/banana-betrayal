import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import type { Resettable } from '../world/SnapshotRegistry';

/** A collectible banana: bobs, sparkles when taken, comes back on checkpoint restore if taken after the baseline. */
export class Banana extends Phaser.GameObjects.Image implements Resettable<{ collected: boolean }> {
  declare body: Phaser.Physics.Arcade.StaticBody;
  readonly id: string;
  collected = false;
  private baseY: number;
  private phase: number;

  constructor(scene: Phaser.Scene, x: number, y: number, id: string) {
    super(scene, x, y, 'banana');
    this.id = id;
    this.baseY = y;
    this.phase = (x * 0.37 + y * 0.11) % (Math.PI * 2);
    this.setDepth(DEPTH.objects).setScale(0.62);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.body.setSize(44, 36).setOffset(14, 16);
  }

  tick(timeMs: number): void {
    if (this.collected) return;
    this.y = this.baseY + Math.sin(timeMs / 420 + this.phase) * 4;
    this.rotation = Math.sin(timeMs / 600 + this.phase) * 0.1;
  }

  collect(): boolean {
    if (this.collected) return false;
    this.collected = true;
    this.body.enable = false;
    this.setVisible(false);
    return true;
  }

  snapshot(): { collected: boolean } { return { collected: this.collected }; }
  restore(s: { collected: boolean }): void {
    this.collected = s.collected;
    this.body.enable = !s.collected;
    this.setVisible(!s.collected);
    this.y = this.baseY;
  }
}
