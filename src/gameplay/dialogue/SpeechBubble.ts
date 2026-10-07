import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';

/** World-space comic speech bubble with a tail pointing at the speaker. */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private hideTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', {
      fontFamily: 'Fredoka, Nunito, "Segoe UI", sans-serif', fontSize: '17px', color: '#2a1d12', align: 'center',
      wordWrap: { width: 230 }, lineSpacing: 2,
    }).setOrigin(0.5, 1);
    this.add([this.bg, this.label]);
    this.setDepth(DEPTH.bubbles).setVisible(false).setAlpha(0);
    scene.add.existing(this);
  }

  /** Show `text` with the tail tip at (x, y). Returns the display duration in ms. */
  say(text: string, x: number, y: number, flip = false): number {
    this.hideTween?.stop();
    this.label.setText(text);
    const w = Math.max(90, this.label.width + 28), h = this.label.height + 22;
    this.label.setPosition(0, -18 - 11);
    const g = this.bg;
    g.clear();
    const left = -w / 2, top = -18 - h;
    g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(left - 3, top - 3, w + 6, h + 6, 16);
    g.fillTriangle(flip ? 16 : -16, top + h + 2, flip ? -4 : 4, top + h + 2, 0, 2);
    g.fillStyle(0xfff8e7, 1); g.fillRoundedRect(left, top, w, h, 13);
    g.fillTriangle(flip ? 12 : -12, top + h - 1, flip ? -1 : 1, top + h - 1, 0, -2);
    this.setPosition(x, y).setVisible(true).setAlpha(0).setScale(0.6);
    this.scene.tweens.add({ targets: this, alpha: 1, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    const ms = Phaser.Math.Clamp(1200 + text.length * 48, 1600, 4200);
    this.hideTween = this.scene.tweens.add({ targets: this, alpha: 0, delay: ms, duration: 220, onComplete: () => this.setVisible(false) });
    return ms;
  }

  follow(x: number, y: number): void { if (this.visible) this.setPosition(x, y); }

  hideNow(): void { this.hideTween?.stop(); this.setVisible(false).setAlpha(0); }
}
