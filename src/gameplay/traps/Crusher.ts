import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { Resettable } from '../world/SnapshotRegistry';
import type { ThemePalette } from '../world/themes';

/**
 * Factory piston on a fixed clock: raised → shudder (warning) → slam (deadly on the way down and at the
 * bottom) → slow rise. Phase offsets stagger a row of them. Deterministic, snapshot-exact.
 */
export class Crusher extends Phaser.GameObjects.Container implements Resettable<{ t: number }> {
  declare body: Phaser.Physics.Arcade.Body;
  readonly id: string;
  private t: number;
  private cycleMs: number;
  private dropPx: number;
  private topY: number;
  private gfx: Phaser.GameObjects.Graphics;
  private piston: Phaser.GameObjects.Graphics;
  private lastPhase = 'raised';
  private palette: ThemePalette;
  timeScale = 1;
  onWarn: (() => void) | null = null;
  onSlam: ((x: number, y: number) => void) | null = null;
  static readonly WARN_MS = 500;
  static readonly SLAM_MS = 130;
  static readonly HOLD_MS = 450;
  static readonly RISE_MS = 900;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, dropTiles: number, cycleMs: number, phaseMs: number, palette: ThemePalette) {
    super(scene, x, y);
    this.id = id; this.topY = y; this.dropPx = dropTiles * TILE; this.t = phaseMs; this.palette = palette;
    this.cycleMs = Math.max(cycleMs, Crusher.WARN_MS + Crusher.SLAM_MS + Crusher.HOLD_MS + Crusher.RISE_MS + 400);
    this.piston = scene.add.graphics().setDepth(DEPTH.objects - 3);
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.drawBlock();
    this.setSize(TILE * 2 - 4, TILE).setDepth(DEPTH.objects + 2);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false); this.body.immovable = true; this.body.moves = false; this.body.setFriction(0, 0);
    this.drawPiston();
  }

  private drawBlock(): void {
    const g = this.gfx, p = this.palette, w = TILE * 2 - 4, h = TILE;
    g.clear();
    g.fillStyle(p.outline, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    g.fillStyle(p.groundLight, 1); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3);
    g.fillStyle(0xf2c94c, 1); for (let i = 0; i < 4; i++) g.fillRect(-w / 2 + 6 + i * 18, h / 2 - 12, 9, 6);
    g.fillStyle(p.outline, 1); for (let i = 0; i < 4; i++) g.fillRect(-w / 2 + 15 + i * 18, h / 2 - 12, 9, 6);
    g.fillStyle(p.outline, 1); g.fillRect(-w / 2 + 3, h / 2 - 6, w - 6, 3);
    g.fillStyle(0xffffff, 0.25); g.fillRect(-w / 2 + 6, -h / 2 + 5, w - 12, 3);
  }

  private drawPiston(): void {
    const g = this.piston, p = this.palette;
    g.clear();
    const len = this.y - this.topY + TILE / 2;
    g.fillStyle(p.outline, 1); g.fillRect(this.x - 9, this.topY - TILE / 2, 18, len);
    g.fillStyle(p.groundDark, 1); g.fillRect(this.x - 6, this.topY - TILE / 2, 12, len);
    g.fillStyle(0xffffff, 0.2); g.fillRect(this.x - 4, this.topY - TILE / 2, 3, len);
  }

  get phase(): 'raised' | 'warning' | 'slam' | 'hold' | 'rise' {
    const m = this.t % this.cycleMs;
    const w = Crusher.WARN_MS, s = w + Crusher.SLAM_MS, h = s + Crusher.HOLD_MS, r = h + Crusher.RISE_MS;
    if (m < w) return 'warning';
    if (m < s) return 'slam';
    if (m < h) return 'hold';
    if (m < r) return 'rise';
    return 'raised';
  }
  /** Deadly while slamming and resting at the bottom. */
  get deadly(): boolean { const ph = this.phase; return ph === 'slam' || ph === 'hold'; }

  override update(dtMs: number): void {
    this.t += dtMs / this.timeScale;
    const m = this.t % this.cycleMs, ph = this.phase;
    const w = Crusher.WARN_MS, s = w + Crusher.SLAM_MS, h = s + Crusher.HOLD_MS;
    let y = this.topY, shake = 0;
    if (ph === 'warning') shake = Math.sin(m / 18) * 2;
    else if (ph === 'slam') y = this.topY + this.dropPx * Phaser.Math.Easing.Quadratic.In((m - w) / Crusher.SLAM_MS);
    else if (ph === 'hold') y = this.topY + this.dropPx;
    else if (ph === 'rise') y = this.topY + this.dropPx * (1 - Phaser.Math.Easing.Sine.InOut((m - h) / Crusher.RISE_MS));
    if (ph !== this.lastPhase) {
      if (ph === 'warning') this.onWarn?.();
      if (ph === 'hold') this.onSlam?.(this.x, this.y + TILE / 2);
      this.lastPhase = ph;
    }
    this.setPosition(this.x + shake - (this.lastShake ?? 0), y);
    this.lastShake = shake;
    this.drawPiston();
  }
  private lastShake: number | undefined;

  snapshot(): { t: number } { return { t: this.t }; }
  restore(s: { t: number }): void { this.t = s.t; this.lastPhase = this.phase; this.update(0); this.body.reset(this.x, this.y); }
  override destroy(fromScene?: boolean): void { this.piston.destroy(); super.destroy(fromScene); }
}
