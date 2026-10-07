import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { Resettable } from '../world/SnapshotRegistry';
import type { ThemePalette } from '../world/themes';

/**
 * "FREE BANANA" vending machine. Approach it and it prints a long receipt, charges a processing fee of one
 * banana (taken honestly from your count — the HUD shows exactly what happened) and dispenses… a peel.
 */
export class BananaMachine implements Resettable<{ used: boolean }> {
  readonly id: string;
  readonly zone: Phaser.GameObjects.Zone;
  used = false;
  private gfx: Phaser.GameObjects.Graphics;
  private screen: Phaser.GameObjects.Text;
  private receipt: Phaser.GameObjects.Container | null = null;
  private scene: Phaser.Scene;
  private x: number;
  private footY: number;
  private palette: ThemePalette;
  onUse: (() => void) | null = null;
  onReceipt: (() => void) | null = null;
  onDispense: ((x: number, y: number) => void) | null = null;

  constructor(scene: Phaser.Scene, id: string, x: number, footY: number, palette: ThemePalette) {
    this.scene = scene; this.id = id; this.x = x; this.footY = footY; this.palette = palette;
    this.gfx = scene.add.graphics().setDepth(DEPTH.objects - 1);
    this.draw();
    this.screen = scene.add.text(x, footY - 118, 'FREE\nBANANA', { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '15px', color: '#7ed957', align: 'center', fontStyle: 'bold', lineSpacing: -2 }).setOrigin(0.5).setDepth(DEPTH.objects);
    this.zone = scene.add.zone(x, footY - 40, TILE * 3, 80);
    scene.physics.add.existing(this.zone, true);
  }

  private draw(): void {
    const g = this.gfx, p = this.palette, x = this.x, y = this.footY;
    g.clear();
    g.fillStyle(p.outline, 1); g.fillRoundedRect(x - 44, y - 150, 88, 150, 8);
    g.fillStyle(0xe5484d, 1); g.fillRoundedRect(x - 40, y - 146, 80, 142, 6);
    g.fillStyle(0x1b1b22, 1); g.fillRoundedRect(x - 32, y - 136, 64, 40, 4);
    g.fillStyle(0xf7c948, 1); g.fillRoundedRect(x - 30, y - 86, 60, 10, 3);
    g.fillStyle(p.outline, 1); g.fillRoundedRect(x - 28, y - 60, 56, 30, 4); // dispenser slot
    g.fillStyle(0x3a3a44, 1); g.fillRoundedRect(x - 25, y - 57, 50, 24, 3);
    g.fillStyle(p.outline, 1); g.fillRect(x - 36, y - 74, 24, 4); // receipt slot
    g.fillStyle(0xffffff, 0.25); g.fillRect(x - 36, y - 142, 6, 120);
    g.fillStyle(0x2a2a30, 1); g.fillCircle(x + 26, y - 72, 5); g.fillStyle(0x7ed957, 1); g.fillCircle(x + 26, y - 72, 3);
  }

  /** Returns true if this activation did something (first use only). */
  use(): boolean {
    if (this.used) return false;
    this.used = true;
    this.onUse?.();
    this.screen.setText('PRINTING\nRECEIPT…').setColor('#f7c948');
    this.printReceipt();
    return true;
  }

  private printReceipt(): void {
    const c = this.scene.add.container(this.x - 40, this.footY - 72).setDepth(DEPTH.objects + 4);
    const paper = this.scene.add.graphics();
    const lines = ['RECEIPT', '------------', 'Banana (free) .... 0', 'Processing fee ... 1 banana', 'Handling .......... 0', 'Convenience ....... 0', 'Trust ....... priceless', '------------', 'TOTAL ...... 1 banana', 'Thank you!', 'No refunds.'];
    const h = 14 + lines.length * 13;
    paper.fillStyle(0x2c1a0e, 1); paper.fillRect(-2, -2, 134, h + 4);
    paper.fillStyle(0xfff8e7, 1); paper.fillRect(0, 0, 130, h);
    paper.fillStyle(0x2c1a0e, 1); for (let i = 0; i < 11; i++) paper.fillTriangle(i * 12, h, i * 12 + 6, h - 6, i * 12 + 12, h);
    const text = this.scene.add.text(8, 6, lines.join('\n'), { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '9px', color: '#2c1a0e', lineSpacing: 2 });
    c.add([paper, text]);
    const mask = this.scene.add.graphics().setVisible(false);
    c.setScale(1, 0.02);
    this.receipt = c;
    this.onReceipt?.();
    this.scene.tweens.add({
      targets: c, scaleY: 1, duration: 1400, ease: 'Linear',
      onComplete: () => {
        this.screen.setText('ENJOY\nYOUR PEEL').setColor('#e5484d');
        this.onDispense?.(this.x, this.footY - 44);
        this.scene.tweens.add({ targets: c, angle: 8, y: c.y + 40, alpha: 0, delay: 1200, duration: 800, ease: 'Quad.easeIn', onComplete: () => { c.destroy(); if (this.receipt === c) this.receipt = null; } });
      },
    });
    mask.destroy();
  }

  snapshot(): { used: boolean } { return { used: this.used }; }
  restore(s: { used: boolean }): void {
    this.used = s.used;
    if (this.receipt) { this.scene.tweens.killTweensOf(this.receipt); this.receipt.destroy(); this.receipt = null; }
    this.screen.setText(s.used ? 'OUT OF\nBANANAS' : 'FREE\nBANANA').setColor(s.used ? '#e5484d' : '#7ed957');
  }
  destroy(): void { if (this.receipt) { this.scene.tweens.killTweensOf(this.receipt); this.receipt.destroy(); } this.gfx.destroy(); this.screen.destroy(); this.zone.destroy(); }
}
