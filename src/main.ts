import Phaser from 'phaser';
import './styles/ui.css';
import { GAME_HEIGHT, GAME_WIDTH } from './core/constants';
import { InputManager } from './core/input/InputManager';
import { initRenderScale } from './core/render/RenderScale';
import { devFlags } from './core/devFlags';
import { DevOverlay } from './dev/DevOverlay';
import { installTestHooks } from './dev/TestHooks';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { PreloadScene } from './scenes/PreloadScene';
import { el, UIRoot } from './ui/UIRoot';

function supported(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('2d'));
  } catch { return false; }
}

function showUnsupported(): void {
  const screen = el('div', 'bb-screen');
  const panel = el('div', 'bb-panel');
  panel.append(el('h2', '', 'This browser cannot run Banana Betrayal'), el('p', '', 'It needs a canvas with WebGL or 2D rendering. Try a current version of Chrome, Firefox, Safari or Edge.'));
  screen.append(panel);
  UIRoot.mount(screen);
}

function boot(): void {
  if (!supported()) { showUnsupported(); return; }
  const rs = initRenderScale('high');
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: Math.round(GAME_WIDTH * rs),
    height: Math.round(GAME_HEIGHT * rs),
    backgroundColor: '#14231a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false, fps: 120, fixedStep: true } },
    audio: { noAudio: true },
    disableContextMenu: true,
    scene: [BootScene, PreloadScene, GameScene],
  });
  const input = InputManager.instance;
  input.on('dev', () => DevOverlay.instance.toggle());
  input.on('fullscreen', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  });
  (window as unknown as { __bb: { game: Phaser.Game; input: InputManager } }).__bb = { game, input };
  if (devFlags.enabled) installTestHooks(game);
}

boot();
