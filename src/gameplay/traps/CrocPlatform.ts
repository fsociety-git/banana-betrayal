import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { Resettable } from '../world/SnapshotRegistry';
import type { ThemePalette } from '../world/themes';

/**
 * "Log" that is secretly a mechanical crocodile. Cycle is clock-driven and fully readable:
 * open (safe) → eyes blink red (warning) → jaws snap (deadly) → open. Phase offsets let several be chained.
 */
export class CrocPlatform implements Resettable<{ t: number }> {
  readonly id: string;
  readonly hit: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.StaticBody;
  private gfx: Phaser.GameObjects.Graphics;
  private x: number;
  private y: number;
  private w: number;
  private cycleMs: number;
  private openMs: number;
  private warnMs = 600;
  private snapMs = 700;
  private t: number;
  private palette: ThemePalette;
  private lastPhase = 'open';
  timeScale = 1;
  onWarn: (() => void) | null = null;
  onSnap: (() => void) | null = null;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, widthTiles: number, cycleMs: number, openMs: number, phaseMs: number, palette: ThemePalette) {
    this.id = id; this.x = x; this.y = y; this.w = widthTiles * TILE; this.cycleMs = Math.max(cycleMs, openMs + this.warnMs + this.snapMs); this.openMs = openMs; this.t = phaseMs; this.palette = palette;
    this.hit = scene.add.rectangle(x, y + 3, this.w, 16, 0xffffff, 0).setVisible(false);
    scene.physics.add.existing(this.hit, true);
    this.body = this.hit.body as Phaser.Physics.Arcade.StaticBody;
    this.body.checkCollision.down = false; this.body.checkCollision.left = false; this.body.checkCollision.right = false;
    this.gfx = scene.add.graphics().setDepth(DEPTH.objects + 3);
    this.draw('open', 0);
  }

  get phase(): 'open' | 'warning' | 'snap' {
    const m = this.t % this.cycleMs;
    if (m < this.openMs) return 'open';
    if (m < this.openMs + this.warnMs) return 'warning';
    if (m < this.openMs + this.warnMs + this.snapMs) return 'snap';
    return 'open';
  }
  get deadly(): boolean { return this.phase === 'snap'; }

  update(dtMs: number): void {
    this.t += dtMs / this.timeScale;
    const ph = this.phase;
    const m = this.t % this.cycleMs;
    const k = ph === 'warning' ? (m - this.openMs) / this.warnMs : ph === 'snap' ? (m - this.openMs - this.warnMs) / this.snapMs : 0;
    if (ph !== this.lastPhase) {
      if (ph === 'warning') this.onWarn?.();
      if (ph === 'snap') this.onSnap?.();
      this.lastPhase = ph;
    }
    this.draw(ph, k);
  }

  private draw(ph: 'open' | 'warning' | 'snap', k: number): void {
    const g = this.gfx, p = this.palette, x = this.x, y = this.y, w = this.w;
    g.clear();
    const jaw = ph === 'snap' ? Math.sin(k * Math.PI) : 0;
    // body / log
    g.fillStyle(p.outline, 1); g.fillRoundedRect(x - w / 2 - 3, y - 11, w + 6, 26, 10);
    g.fillStyle(0x4f6b2a, 1); g.fillRoundedRect(x - w / 2, y - 8, w, 20, 8);
    g.fillStyle(0x6f8f3a, 1); g.fillRoundedRect(x - w / 2 + 6, y - 6, w - 12, 6, 3);
    // scutes
    g.fillStyle(0x3b5220, 1); for (let i = 0; i < w / 18; i++) g.fillTriangle(x - w / 2 + 10 + i * 18, y - 8, x - w / 2 + 16 + i * 18, y - 14, x - w / 2 + 22 + i * 18, y - 8);
    // eyes at the right end
    const ex = x + w / 2 - 14, ey = y - 12;
    g.fillStyle(p.outline, 1); g.fillCircle(ex, ey, 7); g.fillCircle(ex - 16, ey, 7);
    const eyeCol = ph === 'warning' ? (Math.floor(k * 6) % 2 ? 0xff3b3b : 0xfff8e7) : ph === 'snap' ? 0xff3b3b : 0xfff8e7;
    g.fillStyle(eyeCol, 1); g.fillCircle(ex, ey, 5); g.fillCircle(ex - 16, ey, 5);
    g.fillStyle(p.outline, 1); g.fillCircle(ex + 1, ey, 2); g.fillCircle(ex - 15, ey, 2);
    // jaws: rise out of the log when snapping
    if (jaw > 0.02) {
      const jh = 34 * jaw;
      g.fillStyle(0x4f6b2a, 1); g.fillRoundedRect(x - w / 2, y - 8 - jh, w, jh + 4, 6);
      g.fillStyle(p.outline, 1); g.fillRoundedRect(x - w / 2 - 3, y - 11 - jh, w + 6, 6, 3);
      g.fillStyle(0xffffff, 1); for (let i = 0; i < w / 16; i++) { g.fillTriangle(x - w / 2 + 6 + i * 16, y - 6 - jh + 4, x - w / 2 + 12 + i * 16, y - 6 - jh + 16, x - w / 2 + 18 + i * 16, y - 6 - jh + 4); }
      g.fillStyle(0xe5484d, 0.5); g.fillRect(x - w / 2 + 4, y - 4 - jh / 2, w - 8, 3);
    }
  }

  snapshot(): { t: number } { return { t: this.t }; }
  restore(s: { t: number }): void { this.t = s.t; this.lastPhase = this.phase; this.draw(this.phase, 0); }
  destroy(): void { this.gfx.destroy(); this.hit.destroy(); }
}
