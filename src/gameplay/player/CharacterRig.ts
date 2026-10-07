import Phaser from 'phaser';
import type { CharacterDef } from '../../content/characters';
import { DEPTH } from '../../core/constants';

/**
 * Visual-only character: body sprite (origin at the feet) + head sprite (origin at the neck) + contact shadow.
 * Animation is procedural: squash/stretch on the body, bob/tilt on the head, lean on the whole rig.
 * The face is never scaled by more than a few percent.
 */
export type Mood = 'neutral' | 'smug' | 'embarrassed' | 'alert';

export class CharacterRig extends Phaser.GameObjects.Container {
  readonly def: CharacterDef;
  readonly bodySprite: Phaser.GameObjects.Image;
  readonly headSprite: Phaser.GameObjects.Image;
  readonly tailSprite: Phaser.GameObjects.Image | null = null;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly baseScale: number;
  /** Extra uniform scale applied to the whole rig (title screen uses 1.3). */
  baseScaleMultiplier = 1;
  private mood: Mood = 'neutral';
  private moodTimer: Phaser.Time.TimerEvent | null = null;
  private tailAngle = 0;
  private tailKick = 0;
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
    if (def.tailKey && def.tailPivotX !== undefined && def.tailPivotY !== undefined && scene.textures.exists(def.tailKey)) {
      const tp = this.tailPosition(1, 1);
      this.tailSprite = scene.add.image(tp.x, tp.y, def.tailKey).setOrigin(def.tailPivotX, def.tailPivotY).setScale(s);
      this.add(this.tailSprite);
    }
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

  private tailPosition(sx: number, sy: number): { x: number; y: number } {
    const s = this.baseScale;
    return {
      x: ((this.def.tailPivotX ?? 0.5) - 0.5) * this.def.texW * s * sx,
      y: ((this.def.tailPivotY ?? 0.5) - this.def.feetFrac) * this.def.texH * s * sy,
    };
  }

  /** Expressive pose: smug (chin up), embarrassed (head down), alert (perked up). Auto-reverts after `ms`. */
  setMood(mood: Mood, ms?: number): void {
    this.mood = mood;
    this.moodTimer?.remove(false);
    this.moodTimer = null;
    if (ms) this.moodTimer = this.scene.time.delayedCall(ms, () => { if (this.mood === mood) this.mood = 'neutral'; });
  }
  getMood(): Mood { return this.mood; }

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

  playJump(): void {
    if (this.reducedMotion) return;
    // anticipation (crouch) → stretch → settle
    this.impulseTween?.stop();
    this.squashX = 1.12; this.squashY = 0.86;
    this.impulseTween = this.scene.tweens.chain({
      targets: this,
      tweens: [
        { squashX: 0.82, squashY: 1.22, duration: 80, ease: 'Quad.easeOut' },
        { squashX: 1, squashY: 1, duration: 260, ease: 'Back.easeOut' },
      ],
    }) as unknown as Phaser.Tweens.Tween;
    this.tailKick = 1;
  }
  playLand(strength = 1): void {
    if (this.reducedMotion) return;
    const k = Phaser.Math.Clamp(strength, 0.3, 1.4);
    this.impulse(1 + 0.22 * k, 1 - 0.2 * k, 120);
    this.tailKick = -0.8 * k;
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
    // mood: small, readable head offsets that never stretch the face
    let moodTilt = 0, moodY = 0;
    if (this.mood === 'smug') { moodTilt = -0.14; moodY = -3; }
    else if (this.mood === 'embarrassed') { moodTilt = 0.2; moodY = 5; }
    else if (this.mood === 'alert') { moodTilt = -0.06; moodY = -4; }
    // tail: idle sway, run wag, kicks on jump/land
    if (this.tailSprite) {
      const t = this.scene.time.now / 1000;
      const sway = this.reducedMotion ? 0 : Math.sin(t * 2.1) * 0.07;
      const wag = this.reducedMotion ? 0 : Math.sin(this.runPhase * 2) * 0.16 * Math.min(1, speedFrac);
      this.tailKick += (0 - this.tailKick) * Math.min(1, dt * 6);
      this.tailAngle = sway + wag + this.tailKick * 0.35 + (this.mood === 'alert' ? -0.12 : 0) + (this.mood === 'embarrassed' ? 0.25 : 0);
      const tp = this.tailPosition(this.squashX, this.squashY);
      this.tailSprite.setPosition(tp.x, tp.y).setScale(this.baseScale * this.squashX, this.baseScale * this.squashY).setRotation(this.tailAngle);
    }

    this.bodySprite.setScale(this.baseScale * this.squashX, this.baseScale * this.squashY);
    const neck = this.neckPosition(this.squashX, this.squashY);
    this.headSprite.setPosition(neck.x, neck.y + this.headBob + moodY);
    this.headSprite.setRotation((this.headTilt + moodTilt) * this.facing);
    this.setRotation(this.lean);
    this.setScale(this.facing * this.baseScaleMultiplier, this.baseScaleMultiplier);

    // shadow
    if (groundY === null) {
      this.shadow.setVisible(false);
    } else {
      const h = Phaser.Math.Clamp(groundY - this.y, 0, 400);
      const k = 1 - h / 400;
      this.shadow.setVisible(true).setPosition(this.x, groundY - 2)
        .setScale((0.6 + 0.4 * k) * this.baseScaleMultiplier, (0.6 + 0.4 * k) * this.baseScaleMultiplier).setAlpha(0.1 + 0.2 * k);
    }
  }

  override destroy(fromScene?: boolean): void {
    this.impulseTween?.stop();
    this.moodTimer?.remove(false);
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
