import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { Resettable } from '../world/SnapshotRegistry';
import { TrapStateMachine, type TrapSnapshot } from './TrapStateMachine';

/**
 * "Decorative" coconut hanging in a palm. When the player walks underneath it wobbles (warning), then drops.
 * Deadly only while falling; it then rests on the ground as debris until a checkpoint restore rehangs it.
 */
export class Coconut implements Resettable<{ trap: TrapSnapshot; landed: boolean }> {
  readonly id: string;
  readonly sprite: Phaser.GameObjects.Container;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly triggerZone: Phaser.GameObjects.Zone;
  readonly machine: TrapStateMachine;
  private scene: Phaser.Scene;
  private homeX: number;
  private homeY: number;
  private landed = false;
  private wobble: Phaser.Tweens.Tween | null = null;
  private alert: Phaser.GameObjects.Text;
  onJoke: (() => void) | null = null;
  onLand: ((x: number, y: number) => void) | null = null;
  onWarn: (() => void) | null = null;

  readonly kind: 'coconut' | 'anvil' | 'crate' | 'banana-crate';
  readonly shadow: Phaser.GameObjects.Ellipse;
  private groundY: number;

  constructor(scene: Phaser.Scene, id: string, tileX: number, tileY: number, triggerWidthTiles: number, groundY: number, kind: 'coconut' | 'anvil' | 'crate' | 'banana-crate' = 'coconut') {
    this.scene = scene;
    this.id = id;
    this.kind = kind;
    this.groundY = groundY;
    this.homeX = tileX * TILE + TILE / 2;
    this.homeY = tileY * TILE + TILE / 2;
    const c = scene.add.container(this.homeX, this.homeY);
    const g = scene.add.graphics();
    if (kind === 'coconut') {
      g.fillStyle(0x2c1a0e, 1); g.fillCircle(0, 0, 17);
      g.fillStyle(0x6b4a2b, 1); g.fillCircle(0, 0, 14);
      g.fillStyle(0x8a6540, 1); g.fillCircle(-4, -4, 6);
      g.fillStyle(0x2c1a0e, 1); g.fillCircle(-4, 3, 2); g.fillCircle(2, 5, 2); g.fillCircle(-1, -3, 2);
    } else if (kind === 'anvil') {
      g.fillStyle(0x1f2026, 1); g.fillRoundedRect(-22, -6, 44, 22, 4); g.fillRect(-10, -16, 20, 12); g.fillRoundedRect(-30, -18, 60, 10, 4);
      g.fillStyle(0x6b6f7a, 1); g.fillRoundedRect(-19, -3, 38, 16, 3); g.fillRoundedRect(-27, -16, 54, 6, 3);
      g.fillStyle(0xffffff, 0.3); g.fillRect(-24, -15, 30, 2);
    } else {
      g.fillStyle(0x2c1a0e, 1); g.fillRect(-20, -20, 40, 40);
      g.fillStyle(kind === 'banana-crate' ? 0xf7c948 : 0xd59a55, 1); g.fillRect(-17, -17, 34, 34);
      g.fillStyle(0x2c1a0e, 0.8); g.fillRect(-17, -2, 34, 3); g.fillRect(-2, -17, 3, 34);
      if (kind === 'banana-crate') { g.fillStyle(0x2c1a0e, 1); g.fillEllipse(0, 0, 18, 8); g.fillStyle(0xffe58a, 1); g.fillEllipse(0, -1, 12, 4); }
    }
    c.add(g).setSize(40, 40).setDepth(DEPTH.objects + 2);
    scene.physics.add.existing(c);
    this.body = c.body as Phaser.Physics.Arcade.Body;
    if (kind === 'coconut') this.body.setCircle(16, -16, -16); else this.body.setSize(40, 36).setOffset(-20, -18);
    // warning shadow on the ground below (grows as the drop approaches)
    this.shadow = scene.add.ellipse(this.homeX, groundY - 3, 10, 5, 0x000000, 0).setDepth(DEPTH.objects + 1);
    this.body.setAllowGravity(false);
    this.body.moves = false;
    this.sprite = c;
    this.alert = scene.add.text(this.homeX, this.homeY - 40, '!', { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '28px', color: '#e5484d', fontStyle: 'bold', stroke: '#2c1a0e', strokeThickness: 5 }).setOrigin(0.5).setDepth(DEPTH.objects + 3).setVisible(false);
    const zoneW = triggerWidthTiles * TILE;
    this.triggerZone = scene.add.zone(this.homeX, (this.homeY + groundY) / 2, zoneW, groundY - this.homeY);
    scene.physics.add.existing(this.triggerZone, true);
    this.machine = new TrapStateMachine({ warningMs: 480, activeMs: Infinity, cooldownMs: 0 }, {
      onWarning: () => this.startWobble(),
      onActivate: () => this.drop(),
    });
  }

  trigger(): void { if (this.machine.trigger()) { this.onWarn?.(); if (this.machine.deliverJoke()) this.onJoke?.(); } }

  private startWobble(): void {
    this.alert.setVisible(true).setScale(0.5);
    this.scene.tweens.add({ targets: this.alert, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    this.wobble = this.scene.tweens.add({ targets: this.sprite, angle: 14, duration: 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drop(): void {
    this.wobble?.stop(); this.wobble = null;
    this.alert.setVisible(false);
    this.sprite.setAngle(0);
    this.body.moves = true;
    this.body.setAllowGravity(true).setGravityY(1500).setVelocity(0, 60);
    this.body.setMaxVelocityY(1100);
  }

  /** Deadly only while falling. */
  get deadly(): boolean { return this.machine.state === 'active' && !this.landed; }

  /** Called by the collider when the coconut hits something solid. */
  land(): void {
    if (this.landed || this.machine.state !== 'active') return;
    this.landed = true;
    this.body.moves = false;
    this.body.setAllowGravity(false).setVelocity(0, 0);
    this.onLand?.(this.sprite.x, this.sprite.y);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1.25, scaleY: 0.75, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  update(dtMs: number): void {
    this.machine.update(dtMs);
    if (this.machine.state === 'warning') {
      const k = this.machine.progress();
      this.shadow.setAlpha(0.15 + k * 0.35).setSize(16 + k * 36, 6 + k * 10);
    } else if (this.machine.state === 'active' && !this.landed) {
      const k = Phaser.Math.Clamp((this.sprite.y - this.homeY) / Math.max(1, this.groundY - this.homeY), 0, 1);
      this.shadow.setAlpha(0.45).setSize(52 - k * 10, 16 - k * 6);
    } else {
      this.shadow.setAlpha(0);
    }
  }

  snapshot(): { trap: TrapSnapshot; landed: boolean } { return { trap: this.machine.snapshot(), landed: this.landed }; }

  restore(s: { trap: TrapSnapshot; landed: boolean }): void {
    this.wobble?.stop(); this.wobble = null;
    this.scene.tweens.killTweensOf(this.sprite);
    this.alert.setVisible(false);
    // A baseline is either hanging (idle) or already fallen (active+landed); never mid-fall.
    const fallen = s.trap.state === 'active' && s.landed;
    this.landed = fallen;
    this.body.moves = false;
    this.body.setAllowGravity(false).setVelocity(0, 0);
    if (fallen) {
      this.machine.restore({ ...s.trap, state: 'active', timer: Infinity });
    } else {
      this.machine.restore({ ...s.trap, state: 'idle', timer: 0 });
      this.sprite.setPosition(this.homeX, this.homeY).setAngle(0).setScale(1);
      this.body.reset(this.homeX, this.homeY);
    }
  }

  destroy(): void {
    this.wobble?.stop();
    this.scene.tweens.killTweensOf(this.sprite);
    this.alert.destroy();
    this.shadow.destroy();
    this.sprite.destroy();
    this.triggerZone.destroy();
  }
}
