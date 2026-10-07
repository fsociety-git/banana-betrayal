import Phaser from 'phaser';
import { TILE } from '../../core/constants';
import type { Point } from '../../levels/types';
import { Banana } from '../objects/Banana';
import type { Resettable } from '../world/SnapshotRegistry';

/**
 * A banana that hops away along a fixed path when approached, then gives up and lets itself be collected.
 * Deterministic: hop targets come from level data. The pig gets one comment on the first hop.
 */
export class FleeingBanana implements Resettable<{ hopIndex: number; collected: boolean; joked: boolean }> {
  readonly banana: Banana;
  readonly id: string;
  /** Kept separately: during scene shutdown Phaser destroys display objects (clearing their .scene) before our cleanup runs. */
  private scene: Phaser.Scene;
  private path: Point[];
  private hopIndex = 0;
  private hopping = false;
  private startX: number;
  private startY: number;
  private joked = false;
  onJoke: (() => void) | null = null;
  onHop: (() => void) | null = null;
  triggerDistance = 92;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, pathTiles: Point[]) {
    this.id = id;
    this.scene = scene;
    this.banana = new Banana(scene, x, y, id);
    this.startX = x; this.startY = y;
    this.path = pathTiles.map((p) => ({ x: p.x * TILE, y: p.y * TILE }));
  }

  /** Call every frame with the player's feet position. Returns true if it hopped. */
  update(timeMs: number, playerX: number, playerY: number): boolean {
    this.banana.tick(timeMs);
    if (this.banana.collected || this.hopping || this.hopIndex >= this.path.length) return false;
    const dx = this.banana.x - playerX, dy = this.banana.y - (playerY - 40);
    if (dx * dx + dy * dy > this.triggerDistance * this.triggerDistance) return false;
    this.hop();
    return true;
  }

  private hop(): void {
    const step = this.path[this.hopIndex++];
    const tx = this.banana.x + step.x, ty = this.banana.y + step.y;
    this.hopping = true;
    this.banana.body.enable = false;
    const scene = this.scene;
    const fromY = this.banana.y;
    scene.tweens.add({
      targets: this.banana, x: tx, duration: 420, ease: 'Quad.easeOut',
      onUpdate: (tw) => { this.banana.y = Phaser.Math.Linear(fromY, ty, tw.progress) - Math.sin(tw.progress * Math.PI) * 60; this.banana.rotation = tw.progress * Math.PI * 2; },
      onComplete: () => {
        this.banana.setPosition(tx, ty).setRotation(0);
        (this.banana as unknown as { baseY: number }).baseY = ty;
        this.banana.body.reset(tx, ty);
        this.banana.body.enable = !this.banana.collected;
        this.hopping = false;
      },
    });
    this.onHop?.();
    if (!this.joked) { this.joked = true; this.onJoke?.(); }
  }

  snapshot(): { hopIndex: number; collected: boolean; joked: boolean } {
    return { hopIndex: this.hopIndex, collected: this.banana.collected, joked: this.joked };
  }

  restore(s: { hopIndex: number; collected: boolean; joked: boolean }): void {
    this.scene.tweens.killTweensOf(this.banana);
    this.hopping = false;
    this.hopIndex = s.hopIndex;
    this.joked = s.joked;
    let x = this.startX, y = this.startY;
    for (let i = 0; i < s.hopIndex; i++) { x += this.path[i].x; y += this.path[i].y; }
    this.banana.setPosition(x, y).setRotation(0);
    (this.banana as unknown as { baseY: number }).baseY = y;
    this.banana.body.reset(x, y);
    this.banana.restore({ collected: s.collected });
  }

  destroy(): void { this.scene.tweens.killTweensOf(this.banana); if (this.banana.scene) this.banana.destroy(); }
}
