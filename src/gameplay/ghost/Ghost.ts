import Phaser from 'phaser';
import type { CharacterDef } from '../../content/characters';
import { CHARACTERS } from '../../content/characters';
import { DEPTH, GAME_VERSION } from '../../core/constants';
import type { GhostRecording } from '../../core/save/schema';
import { CharacterRig } from '../player/CharacterRig';

const STATE_CODES: Record<string, number> = { grounded: 0, rising: 1, falling: 2, hurt: 3, dead: 4, respawning: 5 };

/** Samples the player at a fixed period into a compact flat array: [x, y, facing, state]. */
export class GhostRecorder {
  readonly sampleMs: number;
  private frames: number[] = [];
  private acc = 0;
  constructor(sampleMs = 50) { this.sampleMs = sampleMs; }

  update(dtMs: number, x: number, y: number, facing: 1 | -1, state: string): void {
    this.acc += dtMs;
    while (this.acc >= this.sampleMs) {
      this.acc -= this.sampleMs;
      this.frames.push(Math.round(x), Math.round(y), facing, STATE_CODES[state] ?? 0);
      if (this.frames.length > 4 * 20 * 60 * 20) this.frames.splice(0, 4); // cap at 20 minutes
    }
  }

  reset(): void { this.frames = []; this.acc = 0; }

  toRecording(levelId: string, levelHash: string, character: 'monkey' | 'pig', timeMs: number): GhostRecording {
    return { levelId, levelHash, character, sampleMs: this.sampleMs, frames: [...this.frames], timeMs, gameVersion: GAME_VERSION };
  }
}

/**
 * Plays a recording as a translucent rig. Visual only: no physics body, never affects collisions. Positions are
 * sampled, so this is a smoothed replay of where the best run was — not a deterministic re-simulation.
 */
export class GhostPlayer {
  readonly rig: CharacterRig;
  private rec: GhostRecording;
  private t = 0;
  private def: CharacterDef;

  constructor(scene: Phaser.Scene, rec: GhostRecording) {
    this.rec = rec;
    this.def = CHARACTERS[rec.character];
    this.rig = new CharacterRig(scene, rec.frames[0] ?? 0, rec.frames[1] ?? 0, this.def);
    this.rig.setDepth(DEPTH.player - 1).setAlpha(0.42);
    this.rig.shadow.setVisible(false);
    this.rig.reducedMotion = true;
  }

  update(dtMs: number): void {
    this.t += dtMs;
    const f = this.rec.frames, n = f.length / 4;
    if (n === 0) return;
    const pos = this.t / this.rec.sampleMs;
    const i = Math.min(n - 1, Math.floor(pos));
    const j = Math.min(n - 1, i + 1);
    const k = Phaser.Math.Clamp(pos - i, 0, 1);
    const x = Phaser.Math.Linear(f[i * 4], f[j * 4], k), y = Phaser.Math.Linear(f[i * 4 + 1], f[j * 4 + 1], k);
    const facing = f[i * 4 + 2] as 1 | -1;
    const state = f[i * 4 + 3];
    this.rig.setPosition(x, y);
    this.rig.setFacing(facing === -1 ? -1 : 1);
    this.rig.setVisible(state < 3 || state === 5);
    const vx = (f[j * 4] - f[i * 4]) / (this.rec.sampleMs / 1000);
    this.rig.animate(dtMs / 1000, vx, 0, state === 0, null);
  }

  destroy(): void { this.rig.destroy(); }
}
