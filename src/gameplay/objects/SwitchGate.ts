import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { Resettable } from '../world/SnapshotRegistry';
import type { ThemePalette } from '../world/themes';

/** Solid barrier that slides open/closed. */
export class Gate implements Resettable<{ open: boolean }> {
  readonly id: string;
  readonly hit: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.StaticBody;
  readonly initiallyOpen: boolean;
  open: boolean;
  private gfx: Phaser.GameObjects.Graphics;
  private x: number; private y: number; private w: number; private h: number;
  private palette: ThemePalette;
  private tween: Phaser.Tweens.Tween | null = null;
  private slide = 0; // 0 closed, 1 open

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, wTiles: number, hTiles: number, open: boolean, palette: ThemePalette) {
    this.id = id; this.x = x; this.y = y; this.w = wTiles * TILE; this.h = hTiles * TILE; this.palette = palette; this.initiallyOpen = open; this.open = open;
    this.hit = scene.add.rectangle(x + this.w / 2, y + this.h / 2, this.w, this.h, 0xffffff, 0).setVisible(false);
    scene.physics.add.existing(this.hit, true);
    this.body = this.hit.body as Phaser.Physics.Arcade.StaticBody;
    this.gfx = scene.add.graphics().setDepth(DEPTH.objects + 1);
    this.slide = open ? 1 : 0;
    this.body.enable = !open;
    this.draw();
  }

  private draw(): void {
    const g = this.gfx, p = this.palette;
    g.clear();
    const visibleH = this.h * (1 - this.slide * 0.92);
    // frame
    g.fillStyle(p.outline, 1); g.fillRect(this.x - 6, this.y - 8, this.w + 12, 8); g.fillRect(this.x - 6, this.y - 8, 6, this.h + 8); g.fillRect(this.x + this.w, this.y - 8, 6, this.h + 8);
    if (visibleH > 2) {
      g.fillStyle(p.outline, 1); g.fillRect(this.x, this.y, this.w, visibleH);
      g.fillStyle(0xf2c94c, 1); g.fillRect(this.x + 3, this.y + 3, this.w - 6, Math.max(0, visibleH - 6));
      g.fillStyle(p.outline, 1); for (let yy = this.y + 8; yy < this.y + visibleH - 6; yy += 16) for (let xx = this.x + 6; xx < this.x + this.w - 10; xx += 16) g.fillRect(xx, yy, 8, 8);
    }
  }

  setOpen(open: boolean, animate = true): void {
    this.open = open;
    this.body.enable = !open;
    this.tween?.stop();
    if (!animate) { this.slide = open ? 1 : 0; this.draw(); return; }
    this.tween = this.scene().tweens.add({ targets: this, slide: open ? 1 : 0, duration: 350, ease: 'Quad.easeInOut', onUpdate: () => this.draw() });
  }
  private scene(): Phaser.Scene { return this.gfx.scene; }

  snapshot(): { open: boolean } { return { open: this.open }; }
  restore(s: { open: boolean }): void { this.setOpen(s.open, false); }
  destroy(): void { this.tween?.stop(); this.gfx.destroy(); this.hit.destroy(); }
}

/** Floor switch: touch it to toggle its gates. `once` switches stay pressed. */
export class Switch implements Resettable<{ pressed: boolean }> {
  readonly id: string;
  readonly zone: Phaser.GameObjects.Zone;
  pressed = false;
  private gfx: Phaser.GameObjects.Graphics;
  private x: number; private y: number;
  private palette: ThemePalette;
  private once: boolean;
  private cooldown = 0;
  onToggle: ((pressed: boolean) => void) | null = null;

  constructor(scene: Phaser.Scene, id: string, x: number, footY: number, once: boolean, palette: ThemePalette) {
    this.id = id; this.x = x; this.y = footY; this.palette = palette; this.once = once;
    this.zone = scene.add.zone(x, footY - 10, 44, 20);
    scene.physics.add.existing(this.zone, true);
    this.gfx = scene.add.graphics().setDepth(DEPTH.objects);
    this.draw();
  }

  private draw(): void {
    const g = this.gfx, p = this.palette, x = this.x, y = this.y;
    g.clear();
    g.fillStyle(p.outline, 1); g.fillRoundedRect(x - 26, y - 12, 52, 12, 4);
    g.fillStyle(p.groundLight, 1); g.fillRoundedRect(x - 23, y - 10, 46, 8, 3);
    const top = this.pressed ? y - 14 : y - 24;
    g.fillStyle(p.outline, 1); g.fillRoundedRect(x - 16, top - 3, 32, y - 10 - top + 3, 4);
    g.fillStyle(this.pressed ? 0x7ed957 : 0xe5484d, 1); g.fillRoundedRect(x - 13, top, 26, y - 12 - top, 3);
    g.fillStyle(0xffffff, 0.4); g.fillRect(x - 10, top + 2, 20, 2);
  }

  /** Called while the player overlaps; debounced so standing on it does not flicker. */
  touch(): boolean {
    if (this.cooldown > 0) { this.cooldown = 400; return false; }
    if (this.once && this.pressed) return false;
    this.pressed = !this.pressed;
    this.cooldown = 400;
    this.draw();
    this.onToggle?.(this.pressed);
    return true;
  }
  update(dtMs: number): void { if (this.cooldown > 0) this.cooldown -= dtMs; }

  snapshot(): { pressed: boolean } { return { pressed: this.pressed }; }
  restore(s: { pressed: boolean }): void { this.pressed = s.pressed; this.cooldown = 0; this.draw(); }
  destroy(): void { this.gfx.destroy(); this.zone.destroy(); }
}
