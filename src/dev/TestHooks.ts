import type Phaser from 'phaser';
import { InputManager } from '../core/input/InputManager';

/**
 * Browser-automation hooks (only when dev flags are on). Lets a test script drive the player with synthetic
 * key events and read physics state. Survives HMR reloads because it is installed from main.ts.
 */
export function installTestHooks(game: Phaser.Game): void {
  const hooks = {
    down(code: string): void { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); },
    up(code: string): void { window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); },
    wait(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); },
    scene(key = 'Game'): Phaser.Scene { return game.scene.getScene(key); },
    /** Player snapshot (feet position, velocity, state). */
    pos(): Record<string, unknown> {
      const s = this.scene() as unknown as { player?: { body: Phaser.Physics.Arcade.Body; state: string; grounded: boolean } };
      if (!s.player) return { missing: true };
      const b = s.player.body;
      return { x: +b.center.x.toFixed(1), y: +b.bottom.toFixed(1), vx: Math.round(b.velocity.x), vy: Math.round(b.velocity.y), st: s.player.state, g: s.player.grounded };
    },
    place(x: number, y: number): void {
      const s = this.scene() as unknown as { player?: { placeAt(x: number, y: number): void } };
      s.player?.placeAt(x, y);
    },
    async trackApex(ms: number): Promise<number> {
      let apex = Infinity;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) { await this.wait(8); apex = Math.min(apex, Number(this.pos().y)); }
      return apex;
    },
    input: InputManager.instance,
    game,
  };
  (window as unknown as { __bbTest: typeof hooks }).__bbTest = hooks;
}
