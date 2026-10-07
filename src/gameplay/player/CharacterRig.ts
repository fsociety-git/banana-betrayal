import Phaser from 'phaser';
import type { CharacterDef } from '../../content/characters';
import { DEPTH } from '../../core/constants';

/**
 * Visual-only character: body sprite (origin at the feet) + head sprite (origin at the neck) + contact shadow.
 * Animation is procedural: squash/stretch on the body, bob/tilt on the head, lean on the whole rig.
 * The face is never scaled by more than a few percent.
 */
export class CharacterRig extends Phaser.GameObjects.Container {
  readonly def: CharacterDef;
  readonly bodySprite: Phaser.GameObjects.Image;
  readonly headSprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly baseScale: number;
  private facing: 1 | -1 = 1;
  private squashX = 1;
  private squashY = 1;
  private targetSquashX = 1;
  private targetSquashY = 1;
  private headBob = 0;
  private headTilt = 0;
  private lean = 0;
  private runPhase = 0;
  private impulseTween: Phaser.Tweens.Tween | null = null;
  reducedMotion = false;

  constructor(scene: Phaser.Scene, x: number, y: number, def: CharacterDef) {
    super(scene, x, y);
    this.def = def;
    this.baseScale = def.displayHeight / def.texH;
    const s = this.baseScale;
    this.bodySprite = scene.add.image(0, 0, def.bodyKey).setOrigin(0.5, def.feetFrac).setScale(s);
    const neckPos = this.neckPosition(1, 1);
    this.headSprite = scene.add.image(neckPos.x, neckPos.y, def.headKey).setOrigin(def.neckX, def.neckY).setScale(s);
    this.add([this.bodySprite, this.headSprite]);
    this.shadow = scene.add.ellipse(x, y, def.bodyWidth * 1.6, 12, 0x000000, 0.28).setDepth(DEPTH.playerShadow);
    this.setDepth(DEPTH.player);
    scene.add.existing(this);
  }

  private neckPosition(sx: number, sy: number): { x: number; y: number } {
    const s = this.baseScale;
    return {
      x: (this.def.neckX - 0.5) * this.def.texW * s * sx,
      y: (this.def.neckY - this.def.feetFrac) * this.def.texH * s * sy,
    };
  }

  setFacing(dir: 1 | -1): void {
    if (dir !== this.facing) {
      this.facing = dir;
      if (!this.reducedMotion) this.impulse(0.88, 1.08, 90);
    }
  }
  getFacing(): 1 | -1 { return this.facing; }

  /** Brief squash/stretch impulse that eases back to neutral. */
  impulse(sx: number, sy: number, durationMs = 120): void {
    this.impulseTween?.stop();
    this.squashX = sx; this.squashY = sy;
    this.impulseTween = this.scene.tweens.add({
      targets: this, squashX: 1, squashY: 1, duration: durationMs * 2.2, ease: 'Back.easeOut',
    });
  }

  playJump(): void { if (!this.reducedMotion) this.impulse(0.8, 1.22, 110); }
  playLand(strength = 1): void {
    if (this.reducedMotion) return;
    const k = Phaser.Math.Clamp(strength, 0.3, 1.4);
    this.impulse(1 + 0.22 * k, 1 - 0.2 * k, 120);
  }
  playHurt(): void { if (!this.reducedMotion) this.impulse(1.2, 0.8, 200); }

  /**
   * Drive procedural animation from motion. vx/vy in px/s; `grounded` from the physics body.
   * `heightAboveGround` positions and scales the contact shadow.
   */
  animate(dt: number, vx: number, vy: number, grounded: boolean, groundY: number | null): void {
    const speedFrac = Phaser.Math.Clamp(Math.abs(vx) / 280, 0, 1.3);
    if (grounded && speedFrac > 0.08 && !this.reducedMotion) {
      this.runPhase += dt * (9 + speedFrac * 6);
      const bounce = Math.abs(Math.sin(this.runPhase));
      this.targetSquashY = 1 + bounce * 0.06 * speedFrac;
      this.targetSquashX = 1 - bounce * 0.04 * speedFrac;
      this.headBob = -bounce * 3 * speedFrac;
      this.headTilt = Math.sin(this.runPhase) * 0.05 * speedFrac;
    } else {
      this.runPhase = 0;
      this.targetSquashX = 1; this.targetSquashY = 1;
      // idle breathing
      const t = this.scene.time.now / 1000;
      this.headBob = this.reducedMotion ? 0 : Math.sin(t * 2.2) * 1.2;
      this.headTilt = this.reducedMotion ? 0 : Math.sin(t * 1.3) * 0.02;
      if (!grounded && !this.reducedMotion) {
        // airborne: slight stretch when rising, slight splay when falling
        const f = Phaser.Math.Clamp(vy / 900, -1, 1);
        this.targetSquashY = 1 + (f < 0 ? -f * 0.08 : f * 0.04);
        this.targetSquashX = 1 - (f < 0 ? -f * 0.06 : f * 0.03);
        this.headTilt = -f * 0.08 * this.facing;
      }
    }
    if (!this.impulseTween?.isPlaying()) {
      const k = Math.min(1, dt * 14);
      this.squashX += (this.targetSquashX - this.squashX) * k;
      this.squashY += (this.targetSquashY - this.squashY) * k;
    }
    const leanTarget = this.reducedMotion ? 0 : Phaser.Math.Clamp(vx / 280, -1, 1) * 0.09;
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 10);

    this.bodySprite.setScale(this.baseScale * this.squashX, this.baseScale * this.squashY);
    const neck = this.neckPosition(this.squashX, this.squashY);
    this.headSprite.setPosition(neck.x, neck.y + this.headBob);
    this.headSprite.setRotation(this.headTilt * this.facing);
    this.setRotation(this.lean);
    this.setScale(this.facing, 1);

    // shadow
    if (groundY === null) {
      this.shadow.setVisible(false);
    } else {
      const h = Phaser.Math.Clamp(groundY - this.y, 0, 400);
      const k = 1 - h / 400;
      this.shadow.setVisible(true).setPosition(this.x, groundY - 2)
        .setScale(0.6 + 0.4 * k, 0.6 + 0.4 * k).setAlpha(0.1 + 0.2 * k);
    }
  }

  override destroy(fromScene?: boolean): void {
    this.impulseTween?.stop();
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
