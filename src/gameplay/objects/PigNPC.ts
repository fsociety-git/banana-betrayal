import Phaser from 'phaser';
import { CHARACTERS } from '../../content/characters';
import { SIGNS } from '../../content/script';
import { DEPTH } from '../../core/constants';
import { CharacterRig } from '../player/CharacterRig';
import type { Speaker } from '../dialogue/DialogueManager';
import type { Bonkable, Bounds } from '../interact/Bonk';

export type PigPose = 'idle' | 'shack' | 'glass' | 'umbrella' | 'manager' | 'escalations' | 'stuck' | 'lever';

/**
 * The rival as a stationary NPC. Visual-only (no collision with the player). Poses add small props drawn
 * with Graphics so the same two-layer portrait works everywhere.
 */
export class PigNPC implements Speaker, Bonkable {
  readonly rig: CharacterRig;
  readonly scene: Phaser.Scene;
  private props: Phaser.GameObjects.Graphics | null = null;
  private laughTween: Phaser.Tweens.Tween | null = null;
  /** Home position (feet). Encounters may move him; `setHome` updates where he returns to. */
  footX: number;
  footY: number;
  readonly id: string;
  readonly pose: PigPose;
  private facing: 1 | -1;
  /** Horizontal speed fed to the rig for the run cycle while walking. */
  private vx = 0;
  private moveTween: Phaser.Tweens.Tween | null = null;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private heldBanana: Phaser.GameObjects.Image | null = null;
  private moustacheGfx: Phaser.GameObjects.Graphics | null = null;
  private plantGfx: Phaser.GameObjects.Graphics | null = null;
  private hidden = false;

  constructor(scene: Phaser.Scene, x: number, y: number, pose: PigPose = 'idle', flip = false, id = `pig-${Math.round(x)}`) {
    this.scene = scene;
    this.id = id;
    this.pose = pose;
    this.footX = x; this.footY = y;
    this.facing = flip ? -1 : 1;
    this.rig = new CharacterRig(scene, x, y, CHARACTERS.pig);
    this.rig.setDepth(DEPTH.npc);
    this.rig.shadow.setDepth(DEPTH.npc - 1);
    this.rig.setFacing(this.facing);
    this.addProps(pose);
  }

  private addProps(pose: PigPose): void {
    if (pose === 'idle') return;
    const g = this.scene.add.graphics().setDepth(DEPTH.npc + 1);
    const x = this.footX, y = this.footY, f = this.facing;
    if (pose === 'umbrella') {
      g.fillStyle(0x2a1d12, 1); g.fillRect(x + 26 * f - 2, y - 150, 4, 100);
      g.fillStyle(0xe5484d, 1); g.slice(x + 26 * f, y - 148, 46, Math.PI, Math.PI * 2, false); g.fillPath();
      g.fillStyle(0xfff8e7, 1); g.slice(x + 26 * f, y - 148, 46, Math.PI * 1.25, Math.PI * 1.5, false); g.fillPath();
      g.lineStyle(3, 0x2a1d12, 1); g.strokeCircle(x + 26 * f, y - 148, 46);
      g.fillStyle(0x2a1d12, 1); g.fillRect(x + 26 * f - 48, y - 150, 96, 4);
    } else if (pose === 'manager') {
      // behind glass, wearing an unnecessary badge
      g.fillStyle(0x9fe3ff, 0.22); g.fillRoundedRect(x - 60, y - 130, 120, 134, 8);
      g.lineStyle(5, 0x2a1d12, 1); g.strokeRoundedRect(x - 60, y - 130, 120, 134, 8);
      g.fillStyle(0xffffff, 0.3); g.fillRect(x - 50, y - 120, 10, 100);
      g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(x - 40, y - 150, 80, 22, 4); g.fillStyle(0xf7c948, 1); g.fillRoundedRect(x - 37, y - 147, 74, 16, 3);
      g.fillStyle(0x2a1d12, 1); g.fillRect(x - 28, y - 142, 56, 3); g.fillRect(x - 20, y - 137, 40, 2);
      this.rig.setDepth(DEPTH.npc + 1);
      g.setDepth(DEPTH.npc + 2);
      g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(x + 10 * f - 14, y - 62, 28, 18, 3);
      g.fillStyle(0xf7c948, 1); g.fillRoundedRect(x + 10 * f - 12, y - 60, 24, 14, 2);
      g.fillStyle(0x2a1d12, 1); g.fillRect(x + 10 * f - 8, y - 56, 16, 2); g.fillRect(x + 10 * f - 8, y - 51, 10, 2);
    } else if (pose === 'glass') {
      g.fillStyle(0x9fe3ff, 0.28); g.fillRoundedRect(x - 60, y - 130, 120, 134, 8);
      g.lineStyle(5, 0x2a1d12, 1); g.strokeRoundedRect(x - 60, y - 130, 120, 134, 8);
      g.fillStyle(0xffffff, 0.35); g.fillRect(x - 50, y - 120, 10, 100);
    } else if (pose === 'escalations') {
      // the same pig, on a taller box, under a smaller sign
      g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(x - 40, y - 4, 80, 8, 3);
      g.fillStyle(0x9c7a4a, 1); g.fillRoundedRect(x - 36, y - 46, 72, 46, 5); g.fillStyle(0x2a1d12, 1); g.strokeRoundedRect(x - 36, y - 46, 72, 46, 5);
      g.lineStyle(3, 0x2a1d12, 1); g.strokeRoundedRect(x - 36, y - 46, 72, 46, 5);
      g.fillStyle(0x624a28, 1); g.fillRect(x - 36, y - 24, 72, 3); g.fillRect(x - 2, y - 46, 3, 46);
      this.rig.setY(y - 46); this.footY = y - 46;
    } else if (pose === 'stuck') {
      // tangled in his own net trap, a bucket on one foot
      g.lineStyle(3, 0x4a3b2a, 1);
      for (let i = -3; i <= 3; i++) { g.lineBetween(x + i * 14, y - 96, x + i * 14 + 8, y - 6); g.lineBetween(x - 46, y - 24 - i * 12, x + 46, y - 30 - i * 12); }
      g.fillStyle(0x6b6f7a, 1); g.fillRoundedRect(x + 8 * f - 14, y - 22, 28, 22, 4); g.fillStyle(0x2a1d12, 1); g.fillRect(x + 8 * f - 14, y - 22, 28, 4);
      g.fillStyle(0x2a1d12, 1); g.fillRect(x - 54, y - 112, 6, 112); g.fillStyle(0xf7c948, 1); g.fillRoundedRect(x - 70, y - 134, 60, 24, 4); g.fillStyle(0x2a1d12, 1); g.fillRect(x - 64, y - 128, 48, 3); g.fillRect(x - 64, y - 122, 30, 3);
    } else if (pose === 'lever') {
      const lx = x - 44 * f; // behind him, away from the player
      g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(lx - 10, y - 14, 20, 14, 3);
      g.lineStyle(6, 0x2a1d12, 1); g.lineBetween(lx, y - 12, lx - 18 * f, y - 72);
      g.fillStyle(0xe5484d, 1); g.fillCircle(lx - 18 * f, y - 74, 9); g.lineStyle(3, 0x2a1d12, 1); g.strokeCircle(lx - 18 * f, y - 74, 9);
    } else if (pose === 'shack') {
      g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(x - 78, y - 160, 156, 168, 10);
      g.fillStyle(0x9c7a4a, 1); g.fillRoundedRect(x - 74, y - 156, 148, 160, 8);
      g.fillStyle(0x624a28, 1); for (let i = 0; i < 6; i++) g.fillRect(x - 74, y - 150 + i * 26, 148, 3);
      g.fillStyle(0x2a1d12, 1); g.fillRect(x - 40, y - 120, 80, 100);
      g.fillStyle(0x1b2a1f, 1); g.fillRect(x - 36, y - 116, 72, 92);
      g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(x - 60, y - 196, 120, 40, 6);
      g.fillStyle(0xf7c948, 1); g.fillRoundedRect(x - 56, y - 192, 112, 32, 5);
      const t = this.scene.add.text(x, y - 176, SIGNS['complaint-dept'] ?? 'HELP DESK', { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '13px', color: '#2a1d12', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.npc + 2);
      // the shack sits behind the pig so he is visible in the doorway
      g.setDepth(DEPTH.npc - 1);
      this.rig.setDepth(DEPTH.npc + 1);
      this.rig.shadow.setDepth(DEPTH.npc);
      this.props = g;
      (this.props as unknown as { extraText: Phaser.GameObjects.Text }).extraText = t;
      return;
    }
    this.props = g;
  }

  bubbleAnchor(): { x: number; y: number; flip: boolean } {
    return { x: this.rig.x, y: this.rig.y - this.rig.def.displayHeight - 6, flip: this.facing === -1 };
  }

  onSpeak(): void {
    this.laughTween?.stop();
    this.rig.setMood('smug', 1600);
    this.laughTween = this.scene.tweens.add({ targets: this.rig, y: this.rig.y - 8, duration: 90, yoyo: true, repeat: 2, ease: 'Quad.easeOut', onComplete: () => this.rig.setY(this.footY) });
  }

  /** Encounters can take over what a bonk does (drop a banana, lose a moustache…). Return true if handled. */
  bonkHandler: ((fromX: number) => boolean) | null = null;
  /** Set while a reaction is playing so repeated bonks never stack tweens. */
  private recoiling = false;
  /** Set false for NPCs that should not react (e.g. behind glass). */
  bonkable = true;
  laughing = false;

  bonkBounds(): Bounds | null {
    if (!this.bonkable || this.hidden) return null;
    const h = this.rig.def.displayHeight * this.rig.baseScaleMultiplier;
    return { left: this.rig.x - 30, right: this.rig.x + 30, top: this.rig.y - h, bottom: this.rig.y };
  }

  onBonk(fromX: number): boolean {
    if (!this.bonkable) return false;
    if (this.bonkHandler && this.bonkHandler(fromX)) return true;
    this.recoil(fromX);
    return true;
  }

  /** Comic recoil: shoved away from the hit, head wobble, embarrassed. Never stacks. */
  recoil(fromX: number): void {
    this.lookAt(fromX);
    this.rig.setMood('embarrassed', 1400);
    if (this.recoiling || this.rig.reducedMotion) { this.rig.impulse(1.2, 0.84, 90); return; }
    this.recoiling = true;
    this.laughTween?.stop();
    const dir = this.rig.x >= fromX ? 1 : -1;
    this.rig.impulse(1.25, 0.8, 110);
    this.laughTween = this.scene.tweens.add({
      targets: this.rig, x: this.footX + dir * 22, duration: 110, ease: 'Quad.easeOut', yoyo: true, hold: 160,
      onComplete: () => { this.rig.setX(this.footX); this.recoiling = false; },
    });
  }

  /** Short physical reaction: a chuckle hop, a smug chin-lift, or a shrug. */
  react(kind: 'laugh' | 'smug' | 'shrug'): void {
    this.laughTween?.stop();
    if (kind === 'laugh') {
      this.rig.setMood('smug', 1400);
      this.laughing = true;
      this.laughTween = this.scene.tweens.add({ targets: this.rig, y: this.rig.y - 10, duration: 80, yoyo: true, repeat: 4, ease: 'Quad.easeOut', onComplete: () => { this.rig.setY(this.footY); this.laughing = false; } });
    } else if (kind === 'smug') {
      this.rig.setMood('smug', 1800);
      this.rig.impulse(0.94, 1.08, 120);
    } else {
      this.rig.setMood('alert', 900);
      this.rig.impulse(1.08, 0.94, 120);
    }
  }

  /** Caught mid-laugh: freeze, straighten up, look innocent. */
  stopLaughing(): void {
    if (!this.laughing) return;
    this.laughTween?.stop();
    this.laughing = false;
    this.rig.setY(this.footY);
    this.rig.setMood('alert', 900);
    this.rig.impulse(0.92, 1.1, 90);
  }

  /** Applause that stops abruptly when he remembers whose side he is on. */
  applaud(): void {
    this.laughTween?.stop();
    this.rig.setMood('smug', 1200);
    this.laughTween = this.scene.tweens.add({ targets: this.rig, scaleX: this.rig.getFacing() * 1.06, duration: 110, yoyo: true, repeat: 3, onComplete: () => { this.rig.setMood('alert', 700); this.rig.impulse(0.94, 1.06, 90); } });
  }

  // ------------------------------------------------------------------ movement (encounters)
  /** Walk to a foot x at `speed` px/s; `onDone` fires on arrival (never when interrupted by stopMoving). */
  walkTo(x: number, speed = 190, onDone?: () => void): void {
    this.stopMoving();
    const dist = Math.abs(x - this.rig.x);
    if (dist < 1) { onDone?.(); return; }
    this.lookAt(x);
    this.vx = Math.sign(x - this.rig.x) * speed;
    this.moveTween = this.scene.tweens.add({
      targets: this.rig, x, duration: (dist / speed) * 1000, ease: 'Linear',
      onComplete: () => { this.vx = 0; this.moveTween = null; onDone?.(); },
      onStop: () => { this.vx = 0; this.moveTween = null; },
    });
  }

  /** A cartoon hop along a parabola to (x, y). */
  jumpTo(x: number, y: number, ms = 520, apex = 90, onDone?: () => void): void {
    this.stopMoving();
    this.lookAt(x);
    const sx = this.rig.x, sy = this.rig.y;
    if (!this.rig.reducedMotion) this.rig.impulse(0.9, 1.14, 120);
    const prog = { t: 0 };
    this.moveTween = this.scene.tweens.add({
      targets: prog, t: 1, duration: ms, ease: 'Linear',
      onUpdate: () => { const t = prog.t; this.rig.setPosition(sx + (x - sx) * t, sy + (y - sy) * t - apex * 4 * t * (1 - t)); },
      onComplete: () => { this.moveTween = null; this.rig.setPosition(x, y); if (!this.rig.reducedMotion) this.rig.impulse(1.12, 0.88, 110); onDone?.(); },
      onStop: () => { this.moveTween = null; },
    });
  }

  /** Drop out of sight (into a pit), then reappear at home with a pop. */
  fallAndReappear(depth = 220, holdMs = 700, onDone?: () => void): void {
    this.stopMoving();
    this.rig.setMood('alert', 2000);
    const reappear = (): void => {
      this.rig.setPosition(this.footX, this.footY).setAlpha(1).setVisible(true); this.rig.shadow.setVisible(true);
      if (!this.rig.reducedMotion) this.rig.impulse(1.2, 0.8, 160);
      this.rig.setMood('embarrassed', 1600);
      onDone?.();
    };
    const gone = (): void => {
      this.moveTween = null;
      this.rig.setVisible(false); this.rig.shadow.setVisible(false);
      this.holdTimer = this.scene.time.delayedCall(holdMs, () => { this.holdTimer = null; reappear(); });
    };
    if (this.rig.reducedMotion) { gone(); return; }
    this.moveTween = this.scene.tweens.add({ targets: this.rig, y: this.rig.y + depth, alpha: 0.2, duration: 420, ease: 'Quad.easeIn', onComplete: gone, onStop: () => { this.moveTween = null; } });
  }

  /** Vanish on the spot (fled into machinery). */
  vanish(): void { this.stopMoving(); this.hidden = true; this.rig.setVisible(false); this.rig.shadow.setVisible(false); if (this.heldBanana) this.heldBanana.setVisible(false); }
  appear(): void { this.hidden = false; this.rig.setVisible(true); this.rig.shadow.setVisible(true); if (this.heldBanana) this.heldBanana.setVisible(true); }
  get isHidden(): boolean { return this.hidden; }

  /** Interrupt any walk/jump; the rig stays where it is. */
  stopMoving(): void { if (this.moveTween) { const t = this.moveTween; this.moveTween = null; t.stop(); } if (this.holdTimer) { this.holdTimer.remove(false); this.holdTimer = null; } this.vx = 0; }

  /** Snap home, cancel everything in flight, clear temporary props. Used by encounter resets. */
  resetToHome(): void {
    this.stopMoving();
    this.laughTween?.stop(); this.laughTween = null;
    this.recoiling = false; this.laughing = false;
    this.scene.tweens.killTweensOf(this.rig);
    this.rig.setPosition(this.footX, this.footY).setAlpha(1).setAngle(0);
    this.rig.setScale(this.facing * this.rig.baseScaleMultiplier, this.rig.baseScaleMultiplier);
    this.appear();
    this.showPlant(false);
    this.rig.setMood('neutral');
  }

  setHome(x: number, y = this.footY): void { this.footX = x; this.footY = y; }

  /** Show/hide the pose props (e.g. the net he was stuck in). */
  setPoseVisible(on: boolean): void {
    this.props?.setVisible(on);
    (this.props as unknown as { extraText?: Phaser.GameObjects.Text } | null)?.extraText?.setVisible(on);
  }

  /** Encounters can take over what "DUKKAR!" does. Return true if handled. */
  calloutHandler: (() => boolean) | null = null;

  // ------------------------------------------------------------------ props
  /** Show/hide a banana in his hand (flips with the rig). */
  holdBanana(on: boolean): void {
    if (on && !this.heldBanana) {
      this.heldBanana = this.scene.add.image(16, -40, 'banana').setScale(0.42).setAngle(-30);
      this.rig.add(this.heldBanana);
    }
    this.heldBanana?.setVisible(on && !this.hidden);
  }
  get holdingBanana(): boolean { return !!this.heldBanana?.visible; }

  /** A fake moustache: official-looking, falls off when bonked. */
  setMoustache(on: boolean): void {
    if (on && !this.moustacheGfx) {
      const g = this.scene.add.graphics();
      g.fillStyle(0x2a1d12, 1); g.fillEllipse(-8, -56, 16, 6); g.fillEllipse(8, -56, 16, 6); g.fillCircle(0, -56, 3.5);
      this.rig.add(g);
      this.moustacheGfx = g;
    }
    this.moustacheGfx?.setVisible(on);
  }
  get hasMoustache(): boolean { return !!this.moustacheGfx?.visible; }

  /** Knock the moustache off: it flutters to the ground. */
  dropMoustache(): void {
    if (!this.moustacheGfx?.visible) return;
    this.moustacheGfx.setVisible(false);
    const g = this.scene.add.graphics().setDepth(DEPTH.npc + 2);
    g.fillStyle(0x2a1d12, 1); g.fillEllipse(-8, 0, 16, 6); g.fillEllipse(8, 0, 16, 6); g.fillCircle(0, 0, 3.5);
    g.setPosition(this.rig.x + 6 * this.facing, this.rig.y - 56);
    if (this.rig.reducedMotion) { g.setPosition(this.rig.x + 30 * this.facing, this.rig.y - 3); return; }
    this.scene.tweens.add({ targets: g, x: this.rig.x + 34 * this.facing, y: this.rig.y - 3, angle: 160, duration: 520, ease: 'Quad.easeIn' });
  }

  /** A tiny plant he hides behind. Visibly too small. */
  showPlant(on: boolean): void {
    if (on && !this.plantGfx) {
      const g = this.scene.add.graphics().setDepth(DEPTH.npc + 3);
      g.fillStyle(0xc96b3a, 1); g.fillRoundedRect(-12, -16, 24, 16, 3); g.fillStyle(0x2a1d12, 1); g.fillRect(-13, -18, 26, 4);
      g.fillStyle(0x3f9b4a, 1); g.fillEllipse(0, -30, 26, 24); g.fillEllipse(-10, -24, 16, 14); g.fillEllipse(10, -24, 16, 14);
      g.lineStyle(3, 0x2a1d12, 1); g.strokeEllipse(0, -30, 26, 24);
      this.plantGfx = g;
    }
    if (this.plantGfx) { this.plantGfx.setPosition(this.rig.x + 18 * this.facing, this.rig.y); this.plantGfx.setVisible(on); }
  }

  /** Face toward a world x position. */
  lookAt(x: number): void {
    const dir: 1 | -1 = x < this.rig.x ? -1 : 1;
    if (dir !== this.facing) { this.facing = dir; this.rig.setFacing(dir); }
  }

  update(dt: number): void {
    this.rig.animate(dt, this.vx, 0, true, this.rig.y);
  }

  destroy(): void {
    this.stopMoving();
    this.plantGfx?.destroy();
    this.laughTween?.stop();
    const extra = (this.props as unknown as { extraText?: Phaser.GameObjects.Text } | null)?.extraText;
    extra?.destroy();
    this.props?.destroy();
    this.rig.destroy();
  }
}
