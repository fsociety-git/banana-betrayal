import Phaser from 'phaser';
import { MAKAD_LINES } from '../../content/script';
import { DEPTH } from '../../core/constants';
import type { Player } from '../player/Player';
import { SpeechBubble } from './SpeechBubble';

/** Makad's own bubble (short lines) plus the prompt chip that shows when a contextual action is available. */
export class MakadVoice {
  private bubble: SpeechBubble;
  private chip: Phaser.GameObjects.Container;
  private chipText: Phaser.GameObjects.Text;
  private chipBg: Phaser.GameObjects.Graphics;
  private player: Player;
  private t = 0;

  constructor(scene: Phaser.Scene, player: Player) {
    this.player = player;
    this.bubble = new SpeechBubble(scene);
    this.chipBg = scene.add.graphics();
    this.chipText = scene.add.text(0, 0, '', { fontFamily: 'Fredoka, Nunito, "Segoe UI", sans-serif', fontSize: '13px', color: '#14231a', fontStyle: 'bold' }).setOrigin(0.5);
    this.chip = scene.add.container(0, 0, [this.chipBg, this.chipText]).setDepth(DEPTH.bubbles + 1).setVisible(false);
  }

  /** Say one of Makad's lines by key (or raw text). */
  say(keyOrText: string): number {
    const text = MAKAD_LINES[keyOrText] ?? keyOrText;
    return this.bubble.say(text, this.player.x, this.player.feetY - this.player.def.displayHeight - 4, this.player.facing === -1);
  }

  /** Show/hide the "E · label" prompt above Makad. */
  setPrompt(label: string | null, keyHint = 'E'): void {
    if (!label) { this.chip.setVisible(false); return; }
    this.chipText.setText(keyHint ? `${keyHint} · ${label}` : label);
    const w = this.chipText.width + 18, h = 22;
    this.chipBg.clear();
    this.chipBg.fillStyle(0x14231a, 1); this.chipBg.fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 8);
    this.chipBg.fillStyle(0x9fe3ff, 1); this.chipBg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    this.chip.setVisible(true);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.bubble.visible) this.bubble.follow(this.player.x, this.player.feetY - this.player.def.displayHeight - 4);
    if (this.chip.visible) this.chip.setPosition(this.player.x, this.player.feetY - this.player.def.displayHeight - 26 + Math.sin(this.t * 4) * 2);
  }

  hide(): void { this.bubble.hideNow(); }
  destroy(): void { this.bubble.destroy(); this.chip.destroy(); }
}
