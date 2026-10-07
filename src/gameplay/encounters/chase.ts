import { TILE } from '../../core/constants';
import type { EncounterDef } from '../../levels/types';
import type { Banana } from '../objects/Banana';
import type { PigNPC } from '../objects/PigNPC';
import { bonkDropCaption, cellX, releaseBanana, resolvePig } from './basic';
import { Encounter, type EncounterHost } from './Encounter';

/**
 * The stolen banana. Dukkar grabs a marked bonus banana and runs: confident escape, a look back to taunt, a near
 * miss with the door, "Meant to do that.", out of breath. Bonk him to shake it loose. Ignore him long enough and he
 * brings it back himself, slightly hurt that nobody chased him. One banana, one reward, however it ends.
 */
export class ChaseEncounter extends Encounter {
  protected declare pig: PigNPC;
  private banana!: Banana;
  private startX = 0; private tauntX = 0; private endX = 0; private groundY = 0;
  private ignoredMs = 0;
  private frozen = false;
  private dropped = false;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }

  build(): void {
    const d = this.def.data ?? {};
    this.startX = cellX(this.def.x);
    this.groundY = (this.def.y + 1) * TILE;
    this.tauntX = cellX(d.tauntCol ?? this.def.x + 7);
    this.endX = cellX(d.runToCol ?? this.def.x + 14);
    this.pig = resolvePig(this.host, this.def);
    this.pig.holdBanana(true);
    this.banana = this.host.addBanana(this.startX, this.groundY - 30, `${this.id}-banana`);
    this.host.onBananaCollected(this.banana, () => this.host.achievement('recovered'));
    this.pig.bonkHandler = (fromX) => {
      if (!this.pig.holdingBanana || this.state === 'idle') return false;
      this.pig.recoil(fromX);
      this.host.say(this.pig, 'bonk-dropped', { priority: true });
      this.drop(fromX);
      bonkDropCaption(this.host);
      return true;
    };
    // "DUKKAR!" mid-theft: he freezes on the spot and pretends to inspect the banana
    this.pig.calloutHandler = () => {
      if (this.state !== 'active' || this.frozen) return false;
      this.frozen = true;
      this.pig.stopMoving();
      this.pig.rig.setMood('alert', 1400);
      this.pig.lookAt(this.host.player.x);
      this.host.say(this.pig, 'callout-freeze', { priority: true });
      this.after(1500, () => { this.frozen = false; if (this.state === 'active') this.resumeRun(); });
      return true;
    };
  }

  override update(dt: number): void {
    const p = this.host.player;
    if (this.state === 'idle' && this.near(this.startX, 210, this.groundY)) this.steal();
    if (this.state === 'payoff' && !this.dropped) {
      // ignored: far away, or already past him
      const far = Math.abs(p.x - this.pig.rig.x) > 440 || p.x > this.endX + 140;
      this.ignoredMs = far ? this.ignoredMs + dt * 1000 : Math.max(0, this.ignoredMs - dt * 500);
      if (this.ignoredMs > 5000) this.returnIt();
    }
  }

  private steal(): void {
    this.setState('active');
    this.pig.lookAt(this.host.player.x);
    this.pig.rig.setMood('smug', 1500);
    this.host.say(this.pig, 'chase-start', { priority: true });
    this.host.sfx('whoosh', 0.8, 0);
    this.after(600, () => this.resumeRun());
  }

  /** Runs (or continues running) toward the end mark; the taunt happens once when he passes the taunt mark. */
  private taunted = false;
  private resumeRun(): void {
    if (this.state !== 'active' || this.frozen) return;
    const target = !this.taunted && this.pig.rig.x < this.tauntX - 4 ? this.tauntX : this.endX;
    this.pig.walkTo(target, 285, () => {
      if (this.state !== 'active' || this.frozen) return;
      if (target === this.tauntX && !this.taunted) {
        this.taunted = true;
        this.pig.lookAt(this.host.player.x);
        this.host.say(this.pig, 'chase-taunt', { priority: true, taunt: true });
        if (!this.host.reducedMotion) this.pig.rig.impulse(0.9, 1.12, 120);
        this.after(650, () => this.resumeRun());
        return;
      }
      this.nearMiss();
    });
  }

  private nearMiss(): void {
    // skids to a halt a hair before the door, pretends that was the plan, then needs a moment
    this.host.sfx('whoosh', 1, 0);
    if (!this.host.reducedMotion) {
      this.pig.rig.impulse(1.3, 0.8, 140);
      this.tween({ targets: this.pig.rig, angle: 14, duration: 120, yoyo: true });
    }
    this.host.debris(this.pig.rig.x + 20, this.groundY, 5);
    this.after(500, () => { this.pig.lookAt(this.host.player.x); this.host.say(this.pig, 'chase-sign', { priority: true }); this.pig.rig.setMood('smug', 1200); });
    this.after(2100, () => {
      this.host.say(this.pig, 'chase-breath', { priority: true });
      this.pig.rig.setMood('embarrassed', 2400);
      if (!this.host.reducedMotion) this.tween({ targets: this.pig.rig, scaleY: this.pig.rig.scaleY * 0.94, duration: 260, yoyo: true, repeat: 5 });
      this.pig.setHome(this.endX);
      this.setState('payoff');
    });
  }

  private returnIt(): void {
    if (this.dropped) return;
    this.setState('active');
    this.dropped = true; // reserve the banana so a bonk during the walk cannot double-drop
    const p = this.host.player;
    const target = Math.max(this.startX, Math.min(this.endX, p.x + (p.x < this.pig.rig.x ? 70 : -70)));
    this.pig.walkTo(target, 170, () => {
      this.pig.lookAt(p.x);
      this.pig.rig.setMood('embarrassed', 2600);
      this.host.say(this.pig, 'chase-return-1', { priority: true });
      this.after(1700, () => {
        this.host.say(this.pig, 'chase-return-2', { priority: true });
        this.after(500, () => { this.dropped = false; this.drop(p.x); });
      });
    });
  }

  private drop(fromX: number): void {
    if (this.dropped || !this.pig.holdingBanana) return;
    this.dropped = true;
    this.pig.holdBanana(false);
    this.pig.setHome(this.pig.rig.x);
    const f = this.pig.rig.x >= fromX ? -1 : 1;
    releaseBanana(this.host, this.banana, { x: this.pig.rig.x + 16 * f, y: this.pig.rig.y - 42 }, { x: this.pig.rig.x + f * 50, y: this.groundY - 26 }, () => this.setState('complete'));
    this.setState('payoff');
  }

  protected override extraSnapshot(): Record<string, unknown> { return { homeX: this.pig.footX }; }
  protected override applyExtra(extra: Record<string, unknown>): void { if (typeof extra.homeX === 'number') this.pig.setHome(extra.homeX); }

  protected applyState(state: 'idle' | 'complete'): void {
    this.frozen = false; this.ignoredMs = 0; this.taunted = false;
    if (state === 'idle') { this.pig.setHome(this.startX); this.dropped = false; this.pig.resetToHome(); this.pig.holdBanana(true); this.banana.setLocked(true); }
    else { this.dropped = true; this.pig.resetToHome(); this.pig.holdBanana(false); this.banana.setLocked(false); }
  }
}
