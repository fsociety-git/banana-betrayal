import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { Resettable } from '../world/SnapshotRegistry';
import type { ThemePalette } from '../world/themes';
import { TrapStateMachine, type TrapSnapshot } from './TrapStateMachine';

interface Plank { go: Phaser.GameObjects.Container; hit: Phaser.GameObjects.Rectangle; body: Phaser.Physics.Arcade.StaticBody; x: number; y: number; fallen: boolean; }

/**
 * Rope bridge of one-way planks. Stepping on any plank starts the sequence: a short shake (warning), then
 * planks drop one by one from the entry side. Learnable: keep moving and you make it. Fully restored by
 * checkpoint snapshots. Fires `onJoke` once (first warning) so the pig can comment.
 */
export class CollapsingBridge implements Resettable<{ trap: TrapSnapshot; fallen: boolean[] }> {
  readonly id: string;
  readonly planks: Plank[] = [];
  readonly group: Phaser.Physics.Arcade.StaticGroup;
  readonly machine: TrapStateMachine;
  private scene: Phaser.Scene;
  private stepMs: number;
  private elapsedActive = 0;
  private fallenCount = 0;
  private ropes: Phaser.GameObjects.Graphics;
  onJoke: (() => void) | null = null;
  onPlankFall: ((x: number, y: number) => void) | null = null;
  onWarn: (() => void) | null = null;

  constructor(scene: Phaser.Scene, id: string, tileX: number, tileY: number, widthTiles: number, delayMs: number, stepMs: number, palette: ThemePalette) {
    this.scene = scene;
    this.id = id;
    this.stepMs = stepMs;
    this.group = scene.physics.add.staticGroup();
    const y = tileY * TILE + 7; // plank top sits on the ground line of the tile row
    this.ropes = scene.add.graphics().setDepth(DEPTH.objects - 2);
    for (let i = 0; i < widthTiles; i++) {
      const x = (tileX + i) * TILE + TILE / 2;
      const go = scene.add.container(x, y);
      const g = scene.add.graphics();
      g.fillStyle(palette.outline, 1); g.fillRoundedRect(-TILE / 2, -7, TILE, 14, 3);
      g.fillStyle(palette.plank, 1); g.fillRect(-TILE / 2 + 3, -4, TILE - 6, 8);
      g.fillStyle(palette.plankDark, 1); g.fillRect(-TILE / 2 + 3, 2, TILE - 6, 2);
      g.fillStyle(0xffffff, 0.3); g.fillRect(-TILE / 2 + 3, -4, TILE - 6, 2);
      go.add(g).setDepth(DEPTH.objects - 1);
      // Static bodies live on plain rectangles (Containers cannot carry static bodies in Phaser 4).
      const hit = scene.add.rectangle(x, y, TILE, 14, 0xffffff, 0).setVisible(false);
      this.group.add(hit);
      const body = hit.body as Phaser.Physics.Arcade.StaticBody;
      body.updateFromGameObject();
      body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false;
      this.planks.push({ go, hit, body, x, y, fallen: false });
    }
    this.drawRopes(palette);
    this.machine = new TrapStateMachine({ warningMs: delayMs, activeMs: stepMs * widthTiles + 400, cooldownMs: 0, oneShot: true }, {
      onWarning: () => { this.shake(); this.onWarn?.(); if (this.machine.deliverJoke()) this.onJoke?.(); },
      onActivate: () => { this.elapsedActive = 0; this.fallenCount = 0; },
    });
  }

  private drawRopes(p: ThemePalette): void {
    const g = this.ropes;
    g.clear();
    if (!this.planks.length) return;
    const first = this.planks[0], last = this.planks[this.planks.length - 1];
    g.lineStyle(3, p.outline, 1);
    for (const dy of [-26, -16]) {
      g.beginPath();
      g.moveTo(first.x - TILE / 2 - 10, first.y + dy - 20);
      const mid = (first.x + last.x) / 2;
      g.lineTo(mid, first.y + dy + 2);
      g.lineTo(last.x + TILE / 2 + 10, first.y + dy - 20);
      g.strokePath();
    }
    for (const pl of this.planks) { g.fillStyle(p.outline, 1); g.fillRect(pl.x - 1, pl.y - 22, 2, 16); }
  }

  /** Called by the collider when the player stands on a plank. */
  stepOn(): void { this.machine.trigger(); }

  private shake(): void {
    for (const pl of this.planks) {
      if (pl.fallen) continue;
      this.scene.tweens.add({ targets: pl.go, x: pl.x + 3, duration: 45, yoyo: true, repeat: 5, ease: 'Sine.easeInOut', onComplete: () => pl.go.setX(pl.x) });
    }
  }

  private dropPlank(i: number): void {
    const pl = this.planks[i];
    if (!pl || pl.fallen) return;
    pl.fallen = true;
    pl.body.enable = false;
    this.onPlankFall?.(pl.x, pl.y);
    this.scene.tweens.add({ targets: pl.go, y: pl.y + 260, angle: (i % 2 ? -1 : 1) * 70, alpha: 0.2, duration: 650, ease: 'Quad.easeIn' });
  }

  update(dtMs: number): void {
    this.machine.update(dtMs);
    if (this.machine.state === 'active' || this.machine.state === 'spent') {
      this.elapsedActive += dtMs / this.machine.timeScale;
      const shouldHaveFallen = Math.min(this.planks.length, Math.floor(this.elapsedActive / this.stepMs) + 1);
      while (this.fallenCount < shouldHaveFallen) this.dropPlank(this.fallenCount++);
    }
  }

  snapshot(): { trap: TrapSnapshot; fallen: boolean[] } {
    return { trap: this.machine.snapshot(), fallen: this.planks.map((p) => p.fallen) };
  }

  restore(s: { trap: TrapSnapshot; fallen: boolean[] }): void {
    // Any in-progress collapse is abandoned: a checkpoint baseline always has the bridge intact or fully gone.
    this.machine.restore({ ...s.trap, state: s.trap.state === 'spent' ? 'spent' : 'idle', timer: 0 });
    this.elapsedActive = 0; this.fallenCount = 0;
    this.planks.forEach((pl, i) => {
      this.scene.tweens.killTweensOf(pl.go);
      pl.fallen = s.fallen[i] ?? false;
      pl.go.setPosition(pl.x, pl.y).setAngle(0).setAlpha(1).setVisible(!pl.fallen);
      pl.body.enable = !pl.fallen;
      if (pl.fallen) this.fallenCount++;
    });
  }

  destroy(): void {
    for (const pl of this.planks) { this.scene.tweens.killTweensOf(pl.go); pl.go.destroy(); pl.hit.destroy(); }
    this.ropes.destroy();
    this.group.destroy(true);
  }
}
