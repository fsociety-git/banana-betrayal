import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';

/** Level exit. Waves gently; `runTo(x)` lets the Level 1 joke make it flee once before being cornered. */
export class GoalFlag extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.StaticBody;
  private cloth: Phaser.GameObjects.Graphics;
  private t = 0;
  footX: number;
  footY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.footX = x; this.footY = y;
    const pole = scene.add.graphics();
    pole.fillStyle(0x2c1a0e, 1); pole.fillRoundedRect(-4, -118, 8, 118, 3); pole.fillCircle(0, -120, 7);
    pole.fillStyle(0xf7c948, 1); pole.fillCircle(0, -120, 4);
    pole.fillStyle(0x2c1a0e, 1); pole.fillEllipse(0, 0, 34, 9);
    this.cloth = scene.add.graphics();
    this.add([pole, this.cloth]);
    this.setDepth(DEPTH.objects);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.body.setSize(44, 124).setOffset(-16, -120);
    this.draw(0);
  }

  private draw(wave: number): void {
    const g = this.cloth;
    g.clear();
    const w = 54, h = 40, top = -112;
    g.fillStyle(0x2c1a0e, 1);
    g.beginPath(); g.moveTo(4, top - 3); g.lineTo(w + 4 + wave * 6, top + h / 2 + wave * 3); g.lineTo(4, top + h + 3); g.closePath(); g.fillPath();
    g.fillStyle(0xf7c948, 1);
    g.beginPath(); g.moveTo(4, top); g.lineTo(w + wave * 6, top + h / 2 + wave * 3); g.lineTo(4, top + h); g.closePath(); g.fillPath();
    g.fillStyle(0x2c1a0e, 1); g.fillEllipse(22 + wave * 2, top + h / 2 + wave, 16, 8);
    g.fillStyle(0xffe58a, 1); g.fillEllipse(22 + wave * 2, top + h / 2 + wave - 1, 12, 4);
  }

  tick(dt: number): void {
    this.t += dt;
    this.draw(Math.sin(this.t * 5) * 0.5);
  }

  /** Hop to a new foot position over `ms` milliseconds (the fleeing-flag gag). */
  runTo(x: number, y: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.body.enable = false;
      this.scene.tweens.add({
        targets: this, x, y, duration: ms, ease: 'Quad.easeInOut',
        onUpdate: (tw) => { this.y = Phaser.Math.Linear(this.footY, y, tw.progress) - Math.abs(Math.sin(tw.progress * Math.PI * 4)) * 22; },
        onComplete: () => { this.footX = x; this.footY = y; this.setPosition(x, y); this.body.reset(x, y); this.body.enable = true; resolve(); },
      });
    });
  }
}
