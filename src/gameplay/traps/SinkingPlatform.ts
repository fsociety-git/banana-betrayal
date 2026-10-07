import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { RideSource } from '../player/Player';
import type { Resettable } from '../world/SnapshotRegistry';
import type { ThemePalette } from '../world/themes';
import { TrapStateMachine, type TrapSnapshot } from './TrapStateMachine';

/**
 * Swamp platform that sinks when stood on. Three readable stages: stable → wobble (tilts, darkens) →
 * sinks under the water, then bobs back up after a cooldown. Carries its rider down with it.
 */
export class SinkingPlatform extends Phaser.GameObjects.Container implements RideSource, Resettable<{ trap: TrapSnapshot; y: number }> {
  declare body: Phaser.Physics.Arcade.Body;
  readonly id: string;
  readonly machine: TrapStateMachine;
  deltaX = 0;
  deltaY = 0;
  private restY: number;
  private sinkDepth: number;
  private gfx: Phaser.GameObjects.Graphics;
  private palette: ThemePalette;
  private widthPx: number;
  private wobble: Phaser.Tweens.Tween | null = null;
  onWarn: (() => void) | null = null;
  onSink: (() => void) | null = null;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, widthTiles: number, sinkDepth: number, warnMs: number, palette: ThemePalette) {
    super(scene, x, y);
    this.id = id; this.restY = y; this.sinkDepth = sinkDepth; this.palette = palette;
    this.widthPx = widthTiles * TILE;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.draw(0);
    this.setSize(this.widthPx, 20).setDepth(DEPTH.objects);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false); this.body.immovable = true; this.body.moves = false; this.body.setFriction(0, 0);
    this.body.checkCollision.down = false; this.body.checkCollision.left = false; this.body.checkCollision.right = false;
    this.machine = new TrapStateMachine({ warningMs: warnMs, activeMs: 1100, cooldownMs: 1800 }, {
      onWarning: () => { this.startWobble(); this.onWarn?.(); },
      onActivate: () => { this.stopWobble(); this.onSink?.(); },
      onIdle: () => { this.stopWobble(); this.draw(0); },
    });
  }

  private draw(stage: number): void {
    const g = this.gfx, p = this.palette, w = this.widthPx, h = 20;
    g.clear();
    const dark = stage >= 1;
    g.fillStyle(p.outline, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.fillStyle(dark ? p.plankDark : p.plank, 1); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 6);
    g.fillStyle(p.grassDark, 1); for (let i = 0; i < w / 14; i++) g.fillCircle(-w / 2 + 10 + i * 14, -h / 2 + 4, 4);
    g.fillStyle(0xffffff, 0.2); g.fillRect(-w / 2 + 6, -h / 2 + 5, w - 12, 2);
    // "temporary" stamp
    g.fillStyle(p.outline, 0.6); g.fillRect(-14, -1, 28, 3); g.fillRect(-10, 3, 20, 2);
  }

  private startWobble(): void {
    this.draw(1);
    this.wobble = this.scene.tweens.add({ targets: this, angle: 3, duration: 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  private stopWobble(): void { this.wobble?.stop(); this.wobble = null; this.setAngle(0); }

  stepOn(): void { this.machine.trigger(); }

  override update(dtMs: number): void {
    this.machine.update(dtMs);
    const s = this.machine.state;
    let targetY = this.restY;
    if (s === 'warning') targetY = this.restY + 6 * this.machine.progress();
    else if (s === 'active') targetY = this.restY + this.sinkDepth * Phaser.Math.Easing.Quadratic.In(this.machine.progress());
    else if (s === 'cooldown') targetY = this.restY + this.sinkDepth * (1 - Phaser.Math.Easing.Quadratic.Out(this.machine.progress()));
    if (s === 'warning' && this.machine.progress() > 0.5) this.draw(2);
    const ny = targetY;
    this.deltaX = 0; this.deltaY = ny - this.y;
    this.setY(ny);
    this.body.enable = !(s === 'active' && this.machine.progress() > 0.55) && !(s === 'cooldown' && this.machine.progress() < 0.45);
    this.setAlpha(this.body.enable ? 1 : 0.45);
  }

  snapshot(): { trap: TrapSnapshot; y: number } { return { trap: this.machine.snapshot(), y: this.y }; }
  restore(s: { trap: TrapSnapshot; y: number }): void {
    this.stopWobble();
    // baselines are taken while the player stands elsewhere; snap to the rest state unless fully sunk
    this.machine.restore({ ...s.trap, state: 'idle', timer: 0 });
    this.setY(this.restY); this.deltaX = this.deltaY = 0; this.body.enable = true; this.setAlpha(1); this.draw(0);
    this.body.reset(this.x, this.restY);
  }

  override destroy(fromScene?: boolean): void { this.stopWobble(); super.destroy(fromScene); }
}
