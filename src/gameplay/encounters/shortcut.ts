import type Phaser from 'phaser';
import { SIGNS } from '../../content/script';
import { TILE } from '../../core/constants';
import type { EncounterDef } from '../../levels/types';
import type { PigNPC } from '../objects/PigNPC';
import { cellX } from './basic';
import { Encounter, type EncounterHost } from './Encounter';
import { drawLadder, drawPuddle } from './props';

/**
 * "Trust me. I know a shortcut." The low route through the crocodiles is dressed as a bureaucratic detour: a tiny
 * puddle, a queue sign with no queue, ladders that go nowhere and an exit sign that is honest about the time saved.
 * Taking it earns the exit exchange and a flag that a later level calls back to.
 */
export class ShortcutEncounter extends Encounter {
  protected declare pig: PigNPC | null;
  private props: Phaser.GameObjects.GameObject[] = [];
  private entryX0 = 0; private entryX1 = 0; private exitX0 = 0; private exitX1 = 0; private groundY = 0;
  private tookLowRoute = false;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }

  build(): void {
    const d = this.def.data ?? {};
    this.groundY = (this.def.y + 1) * TILE;
    this.entryX0 = (d.entryFrom ?? this.def.x) * TILE; this.entryX1 = (d.entryTo ?? this.def.x + 14) * TILE;
    this.exitX0 = (d.exitFrom ?? this.def.x + 30) * TILE; this.exitX1 = (d.exitTo ?? this.def.x + 33) * TILE;
    if (this.def.pig) this.pig = this.host.world.pigById(this.def.pig) ?? null;
    const w = this.host.world, s = this.host.scene;
    this.props.push(drawPuddle(s, cellX(d.puddleCol ?? this.def.x - 3), this.groundY));
    this.props.push(...w.addSign(cellX(d.queueCol ?? this.def.x - 1), this.groundY, SIGNS.queue));
    this.props.push(drawLadder(s, cellX(d.exitFrom ?? this.def.x + 30) - 30, this.groundY, 54), drawLadder(s, cellX((d.exitFrom ?? this.def.x + 30) + 1) + 10, this.groundY, 38));
    this.props.push(...w.addSign(cellX(d.signCol ?? this.def.x + 32), this.groundY, SIGNS['time-saved']));
  }

  override update(): void {
    const p = this.host.player;
    if (!p.alive) return;
    // riding the crocs = at (roughly) ground level inside the detour
    if (this.state === 'idle' && p.x > this.entryX0 && p.x < this.entryX1 && Math.abs(p.feetY - this.groundY) < 70) { this.tookLowRoute = true; this.setState('anticipation'); }
    if ((this.state === 'idle' || this.state === 'anticipation') && p.grounded && p.x >= this.exitX0 && p.x <= this.exitX1 && Math.abs(p.feetY - this.groundY) < 60) {
      if (!this.tookLowRoute) { this.setState('complete'); return; }
      this.setState('payoff');
      this.host.makad('shortcut-exit');
      this.host.setFlag('l2-shortcut-taken');
      this.after(1400, () => { if (this.pig) { this.pig.lookAt(p.x); this.host.say(this.pig, 'shortcut-exit', { priority: true }); } });
      this.after(1800, () => this.setState('complete'));
    }
  }

  protected applyState(state: 'idle' | 'complete'): void { if (state === 'idle') this.tookLowRoute = false; }
  protected override onDestroy(): void { for (const o of this.props) o.destroy(); }
}
