import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { devFlags } from '../core/devFlags';
import { fitCamera } from '../core/render/RenderScale';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload(): void {
    fitCamera(this.cameras.main);
    this.cameras.main.setBackgroundColor('#14231a');
    const barW = 320, barH = 18;
    const x = GAME_WIDTH / 2 - barW / 2, y = GAME_HEIGHT / 2;
    const frame = this.add.graphics();
    frame.lineStyle(3, 0xf7c948, 1); frame.strokeRoundedRect(x - 4, y - 4, barW + 8, barH + 8, 9);
    const bar = this.add.graphics();
    const label = this.add.text(GAME_WIDTH / 2, y - 36, 'Peeling…', { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '22px', color: '#fff8e7' }).setOrigin(0.5);
    this.load.on('progress', (v: number) => { bar.clear(); bar.fillStyle(0xf7c948, 1); bar.fillRoundedRect(x, y, Math.max(8, barW * v), barH, 6); });
    this.load.on('complete', () => { label.setText('Ready.'); });
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    this.load.setPath(`${base}assets/characters/`);
    this.load.image('monkey-head', 'monkey-head.png');
    this.load.image('monkey-body', 'monkey-body.png');
    this.load.image('monkey-whole', 'monkey.png');
    this.load.image('pig-head', 'pig-head.png');
    this.load.image('pig-body', 'pig-body.png');
    this.load.image('pig-whole', 'pig.png');
  }

  create(): void {
    this.scene.start('Game', { levelId: devFlags.startLevel ?? 'test', character: devFlags.character ?? 'monkey' });
  }
}
