import Phaser from 'phaser';
import { CHARACTERS } from '../../content/characters';
import { DEPTH } from '../../core/constants';
import { CharacterRig } from '../player/CharacterRig';
import type { Speaker } from '../dialogue/DialogueManager';

export type PigPose = 'idle' | 'shack' | 'glass' | 'umbrella' | 'manager';

/**
 * The rival as a stationary NPC. Visual-only (no collision with the player). Poses add small props drawn
 * with Graphics so the same two-layer portrait works everywhere.
 */
export class PigNPC implements Speaker {
  readonly rig: CharacterRig;
  readonly scene: Phaser.Scene;
  private props: Phaser.GameObjects.Graphics | null = null;
  private laughTween: Phaser.Tweens.Tween | null = null;
  readonly footX: number;
  readonly footY: number;
  private facing: 1 | -1;

  constructor(scene: Phaser.Scene, x: number, y: number, pose: PigPose = 'idle', flip = false) {
    this.scene = scene;
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
    } else if (pose === 'shack') {
      g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(x - 78, y - 160, 156, 168, 10);
      g.fillStyle(0x9c7a4a, 1); g.fillRoundedRect(x - 74, y - 156, 148, 160, 8);
      g.fillStyle(0x624a28, 1); for (let i = 0; i < 6; i++) g.fillRect(x - 74, y - 150 + i * 26, 148, 3);
      g.fillStyle(0x2a1d12, 1); g.fillRect(x - 40, y - 120, 80, 100);
      g.fillStyle(0x1b2a1f, 1); g.fillRect(x - 36, y - 116, 72, 92);
      g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(x - 60, y - 196, 120, 40, 6);
      g.fillStyle(0xf7c948, 1); g.fillRoundedRect(x - 56, y - 192, 112, 32, 5);
      const t = this.scene.add.text(x, y - 176, 'HELP DESK', { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '16px', color: '#2a1d12', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.npc + 2);
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

  /** Short physical reaction: a chuckle hop, a smug chin-lift, or a shrug. */
  react(kind: 'laugh' | 'smug' | 'shrug'): void {
    this.laughTween?.stop();
    if (kind === 'laugh') {
      this.rig.setMood('smug', 1400);
      this.laughTween = this.scene.tweens.add({ targets: this.rig, y: this.rig.y - 10, duration: 80, yoyo: true, repeat: 4, ease: 'Quad.easeOut', onComplete: () => this.rig.setY(this.footY) });
    } else if (kind === 'smug') {
      this.rig.setMood('smug', 1800);
      this.rig.impulse(0.94, 1.08, 120);
    } else {
      this.rig.setMood('alert', 900);
      this.rig.impulse(1.08, 0.94, 120);
    }
  }

  /** Face toward a world x position. */
  lookAt(x: number): void {
    const dir: 1 | -1 = x < this.rig.x ? -1 : 1;
    if (dir !== this.facing) { this.facing = dir; this.rig.setFacing(dir); }
  }

  update(dt: number): void {
    this.rig.animate(dt, 0, 0, true, this.footY);
  }

  destroy(): void {
    this.laughTween?.stop();
    const extra = (this.props as unknown as { extraText?: Phaser.GameObjects.Text } | null)?.extraText;
    extra?.destroy();
    this.props?.destroy();
    this.rig.destroy();
  }
}
