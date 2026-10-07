import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import type { ThemePalette } from '../world/themes';

/**
 * Checkpoint marker: a banana-topped post with a flag. Inactive = grey, active = gold with a small bounce.
 * Reaching one is a save of position AND world state (see SnapshotRegistry); the post never lies.
 */
export class CheckpointPost extends Phaser.GameObjects.Container {
  /** Trigger area (static body). Containers cannot carry static bodies in Phaser 4. */
  readonly zone: Phaser.GameObjects.Zone;
  readonly id: string;
  readonly index: number;
  readonly footX: number;
  readonly footY: number;
  reached = false;
  private flag: Phaser.GameObjects.Graphics;
  private top: Phaser.GameObjects.Image;
  private palette: ThemePalette;

  constructor(scene: Phaser.Scene, x: number, y: number, id: string, index: number, palette: ThemePalette) {
    super(scene, x, y);
    this.id = id; this.index = index; this.footX = x; this.footY = y; this.palette = palette;
    const post = scene.add.graphics();
    post.fillStyle(palette.outline, 1); post.fillRoundedRect(-5, -92, 10, 92, 3);
    post.fillStyle(palette.plank, 1); post.fillRoundedRect(-3, -90, 6, 88, 2);
    post.fillStyle(palette.outline, 1); post.fillEllipse(0, 0, 30, 8);
    this.flag = scene.add.graphics();
    this.top = scene.add.image(0, -96, 'banana').setScale(0.7).setAlpha(0.5);
    this.add([post, this.flag, this.top]);
    this.drawFlag(false);
    this.setDepth(DEPTH.objects - 1);
    scene.add.existing(this);
    this.zone = scene.add.zone(x, y - 50, 44, 110);
    scene.physics.add.existing(this.zone, true);
  }

  override destroy(fromScene?: boolean): void {
    this.zone.destroy();
    super.destroy(fromScene);
  }

  private drawFlag(active: boolean): void {
    const g = this.flag;
    g.clear();
    g.fillStyle(this.palette.outline, 1);
    g.fillTriangle(5, -88, 5, -58, 44, -73);
    g.fillStyle(active ? 0xf7c948 : 0x9a9a9a, 1);
    g.fillTriangle(5, -85, 5, -61, 38, -73);
  }

  activate(): void {
    if (this.reached) return;
    this.reached = true;
    this.drawFlag(true);
    this.top.setAlpha(1);
    this.scene.tweens.add({ targets: this.top, y: -112, duration: 220, yoyo: true, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this, scaleX: 1.12, scaleY: 0.92, duration: 100, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Level 2 gag: the post prints a tiny receipt for your checkpoint. */
  printReceipt(): void {
    const paper = this.scene.add.graphics().setDepth(DEPTH.objects + 3);
    const lines = ['RECEIPT', 'Checkpoint x1', 'Hope ...... 0.00', 'TOTAL ..... 0.00'];
    const t = this.scene.add.text(0, 0, lines.join('\n'), { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '8px', color: '#2a1d12', lineSpacing: 1 }).setDepth(DEPTH.objects + 4);
    const w = 66, h = 44;
    const c = this.scene.add.container(this.footX + 6, this.footY - 52, [paper, t]).setDepth(DEPTH.objects + 3);
    paper.fillStyle(0x2a1d12, 1); paper.fillRect(-2, -2, w + 4, h + 4); paper.fillStyle(0xfff8e7, 1); paper.fillRect(0, 0, w, h);
    t.setPosition(4, 3);
    c.setScale(1, 0.05);
    this.scene.tweens.add({ targets: c, scaleY: 1, duration: 700, ease: 'Linear', onComplete: () => this.scene.tweens.add({ targets: c, y: c.y + 30, alpha: 0, delay: 1400, duration: 600, onComplete: () => c.destroy() }) });
  }

  /** Visual-only reset (used when restarting the whole level). */
  deactivate(): void {
    this.reached = false;
    this.drawFlag(false);
    this.top.setAlpha(0.5);
  }
}
