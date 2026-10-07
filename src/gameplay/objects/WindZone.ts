import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';

/** Area that pushes the player sideways. Streaking particles make the direction unmistakable. */
export class WindZone {
  readonly id: string;
  readonly zone: Phaser.GameObjects.Zone;
  readonly force: number;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null;
  private gusts: Phaser.GameObjects.Graphics;
  private t = 0;
  private rect: { x: number; y: number; w: number; h: number };

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, w: number, h: number, force: number, reducedMotion: boolean) {
    this.id = id; this.force = force; this.rect = { x, y, w, h };
    this.zone = scene.add.zone(x + w / 2, y + h / 2, w, h);
    scene.physics.add.existing(this.zone, true);
    this.gusts = scene.add.graphics().setDepth(DEPTH.decorBack + 1);
    this.emitter = reducedMotion ? null : scene.add.particles(0, 0, 'leaf', {
      x: { min: x, max: x + w }, y: { min: y, max: y + h },
      lifespan: { min: 900, max: 1600 }, speedX: force > 0 ? { min: force * 0.9, max: force * 1.4 } : { min: force * 1.4, max: force * 0.9 }, speedY: { min: -20, max: 20 },
      scale: { start: 0.9, end: 0.4 }, alpha: { start: 0.7, end: 0 }, rotate: { start: 0, end: 180 }, frequency: 90, quantity: 1, tint: [0xffffff, 0xd7e6fb, 0x7ed957],
    }).setDepth(DEPTH.decorBack + 2);
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.gusts, r = this.rect;
    g.clear();
    g.lineStyle(2, 0xffffff, 0.35);
    const dir = Math.sign(this.force);
    for (let i = 0; i < 6; i++) {
      const yy = r.y + ((i + 0.5) / 6) * r.h;
      const phase = ((this.t * 220 * dir + i * 97) % r.w + r.w) % r.w;
      const sx = r.x + phase, len = 60 + (i % 3) * 20;
      g.beginPath(); g.moveTo(sx, yy); g.lineTo(sx + len * dir, yy + Math.sin(this.t * 4 + i) * 4); g.strokePath();
    }
  }
  destroy(): void { this.emitter?.destroy(); this.gusts.destroy(); this.zone.destroy(); }
}
