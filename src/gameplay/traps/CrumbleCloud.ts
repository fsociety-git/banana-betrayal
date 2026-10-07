import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { Resettable } from '../world/SnapshotRegistry';
import type { ThemePalette } from '../world/themes';
import { TrapStateMachine, type TrapSnapshot } from './TrapStateMachine';

/**
 * Cloud platform that crumbles shortly after being stood on and re-forms later. With `doubting` it carries a
 * sign whose text loses confidence stage by stage before the cloud gives way — the Level 4 gag.
 */
export class CrumbleCloud implements Resettable<{ trap: TrapSnapshot }> {
  readonly id: string;
  readonly hit: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.StaticBody;
  readonly machine: TrapStateMachine;
  private gfx: Phaser.GameObjects.Graphics;
  private sign: Phaser.GameObjects.Text | null = null;
  private signBoard: Phaser.GameObjects.Graphics | null = null;
  private x: number;
  private y: number;
  private w: number;
  private scene: Phaser.Scene;
  private shakeTween: Phaser.Tweens.Tween | null = null;
  private lastStage = -1;
  onCrumble: ((x: number, y: number) => void) | null = null;
  onWarn: (() => void) | null = null;
  onJoke: (() => void) | null = null;
  static readonly SIGN_STAGES = ['Definitely Solid', 'Probably Solid', 'Solid-ish', 'Hmm.'];

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, widthTiles: number, crumbleMs: number, respawnMs: number, doubting: boolean, palette: ThemePalette) {
    this.scene = scene; this.id = id; this.x = x; this.y = y; this.w = widthTiles * TILE;
    this.hit = scene.add.rectangle(x, y + 6, this.w, 14, 0xffffff, 0).setVisible(false);
    scene.physics.add.existing(this.hit, true);
    this.body = this.hit.body as Phaser.Physics.Arcade.StaticBody;
    this.body.checkCollision.down = false; this.body.checkCollision.left = false; this.body.checkCollision.right = false;
    this.gfx = scene.add.graphics().setDepth(DEPTH.objects);
    this.draw(1);
    if (doubting) {
      this.signBoard = scene.add.graphics().setDepth(DEPTH.objects + 1);
      this.sign = scene.add.text(x, y - 46, CrumbleCloud.SIGN_STAGES[0], { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '14px', color: '#2c1a0e', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(DEPTH.objects + 2);
      this.drawSign(palette);
    }
    void palette;
    this.machine = new TrapStateMachine({ warningMs: crumbleMs, activeMs: respawnMs, cooldownMs: 400 }, {
      onWarning: () => { this.startShake(); this.onWarn?.(); if (doubting && this.machine.deliverJoke()) this.onJoke?.(); },
      onActivate: () => this.crumble(),
      onCooldown: () => this.reform(),
      onIdle: () => { this.draw(1); this.setSignStage(0); },
    });
  }

  private drawSign(p: ThemePalette): void {
    const g = this.signBoard; if (!g || !this.sign) return;
    g.clear();
    const bw = Math.max(90, this.sign.width + 20), bh = 28;
    g.fillStyle(p.outline, 1); g.fillRect(this.x - 3, this.y - 32, 6, 32); g.fillRoundedRect(this.x - bw / 2 - 3, this.y - 46 - bh / 2 - 3, bw + 6, bh + 6, 6);
    g.fillStyle(0xfff8e7, 1); g.fillRoundedRect(this.x - bw / 2, this.y - 46 - bh / 2, bw, bh, 5);
  }

  private draw(alpha: number): void {
    const g = this.gfx, w = this.w, x = this.x, y = this.y;
    g.clear();
    g.fillStyle(0x4a5a7a, alpha); g.fillRoundedRect(x - w / 2 - 2, y - 8, w + 4, 30, 14);
    g.fillStyle(0xffffff, alpha); g.fillRoundedRect(x - w / 2, y - 6, w, 26, 12);
    for (let i = 0; i < w / 30; i++) { g.fillStyle(0x4a5a7a, alpha); g.fillCircle(x - w / 2 + 16 + i * 30, y - 4, 16); g.fillStyle(0xffffff, alpha); g.fillCircle(x - w / 2 + 16 + i * 30, y - 4, 13); }
    g.fillStyle(0xd7e6fb, alpha); g.fillRoundedRect(x - w / 2 + 6, y + 8, w - 12, 8, 4);
  }

  private setSignStage(stage: number): void {
    if (!this.sign || stage === this.lastStage) return;
    this.lastStage = stage;
    this.sign.setText(CrumbleCloud.SIGN_STAGES[Math.min(stage, CrumbleCloud.SIGN_STAGES.length - 1)]);
  }

  private startShake(): void {
    this.shakeTween = this.scene.tweens.add({ targets: [this.gfx, this.sign, this.signBoard].filter(Boolean), x: 2, duration: 50, yoyo: true, repeat: -1 });
  }
  private stopShake(): void { this.shakeTween?.stop(); this.shakeTween = null; this.gfx.setX(0); this.sign?.setX(this.x); this.signBoard?.setX(0); }

  private crumble(): void {
    this.stopShake();
    this.body.enable = false;
    this.draw(0.12);
    this.sign?.setVisible(false); this.signBoard?.setVisible(false);
    this.onCrumble?.(this.x, this.y);
  }
  private reform(): void {
    this.body.enable = true;
    this.draw(1);
    this.sign?.setVisible(true); this.signBoard?.setVisible(true);
    this.setSignStage(0);
  }

  stepOn(): void { this.machine.trigger(); }

  update(dtMs: number): void {
    this.machine.update(dtMs);
    if (this.machine.state === 'warning' && this.sign) this.setSignStage(1 + Math.floor(this.machine.progress() * 3));
    if (this.machine.state === 'warning') this.draw(1 - this.machine.progress() * 0.3);
  }

  snapshot(): { trap: TrapSnapshot } { return { trap: this.machine.snapshot() }; }
  restore(s: { trap: TrapSnapshot }): void {
    this.stopShake();
    this.machine.restore({ ...s.trap, state: 'idle', timer: 0 });
    this.reform();
  }
  destroy(): void { this.stopShake(); this.gfx.destroy(); this.hit.destroy(); this.sign?.destroy(); this.signBoard?.destroy(); }
}
