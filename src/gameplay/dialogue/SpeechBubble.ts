import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';

/** Space kept clear at the top of the view for the HUD pills, and at the other edges. */
const EDGE = 12;
const TOP = 54;

/**
 * World-space comic speech bubble with a tail pointing at the speaker. The bubble body is kept inside the camera
 * view (so a speaker running ahead of the camera, or standing at a wall, still reads); the tail slides along the
 * bubble's bottom edge toward the speaker and points sideways when they are off-screen.
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private hideTween: Phaser.Tweens.Tween | null = null;
  private bw = 90;
  private bh = 40;
  private flip = false;
  private tailDx = 0;

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
  say(text: string, x: number, y: number, flip = false, holdMs?: number): number {
    this.hideTween?.stop();
    this.label.setText(text);
    this.bw = Math.max(90, this.label.width + 28); this.bh = this.label.height + 22; this.flip = flip;
    this.label.setPosition(0, -18 - 11);
    this.tailDx = NaN; // force a redraw
    this.place(x, y);
    this.setVisible(true).setAlpha(0).setScale(0.6);
    this.scene.tweens.add({ targets: this, alpha: 1, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    const ms = holdMs ?? Phaser.Math.Clamp(1200 + text.length * 48, 1600, 4200);
    this.hideTween = this.scene.tweens.add({ targets: this, alpha: 0, delay: ms, duration: 220, onComplete: () => this.setVisible(false) });
    return ms;
  }

  follow(x: number, y: number): void { if (this.visible) this.place(x, y); }

  hideNow(): void { this.hideTween?.stop(); this.setVisible(false).setAlpha(0); }

  /** Clamp the bubble body into the camera view and aim the tail at the speaker. */
  private place(x: number, y: number): void {
    const view = this.scene.cameras.main.worldView;
    const w = this.bw, h = this.bh;
    // if the view is narrower than the bubble (not expected at 960 wide), centre it rather than jitter
    const cx = view.width > w + EDGE * 2 ? Phaser.Math.Clamp(x, view.x + EDGE + w / 2, view.right - EDGE - w / 2) : view.centerX;
    const cy = Phaser.Math.Clamp(y, view.y + TOP + h + 18, view.bottom - EDGE);
    this.setPosition(cx, cy);
    // the tail base slides toward the speaker along the bottom edge, never past the rounded corners
    const dx = Phaser.Math.Clamp(x - cx, -w / 2 + 22, w / 2 - 22);
    if (Math.abs(dx - this.tailDx) > 0.5 || Number.isNaN(this.tailDx)) { this.tailDx = dx; this.draw(); }
  }

  private draw(): void {
    const g = this.bg, w = this.bw, h = this.bh, dx = this.tailDx, flip = this.flip;
    g.clear();
    const left = -w / 2, top = -18 - h;
    // when the speaker is beside the bubble rather than below it, lean the tail that way
    const lean = Math.abs(dx) >= w / 2 - 22 ? Math.sign(dx) * 14 : 0;
    g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(left - 3, top - 3, w + 6, h + 6, 16);
    g.fillTriangle(dx + (flip ? 16 : -16), top + h + 2, dx + (flip ? -4 : 4), top + h + 2, dx + lean, 2);
    g.fillStyle(0xfff8e7, 1); g.fillRoundedRect(left, top, w, h, 13);
    g.fillTriangle(dx + (flip ? 12 : -12), top + h - 1, dx + (flip ? -1 : 1), top + h - 1, dx + lean * 0.8, -2);
  }
}
