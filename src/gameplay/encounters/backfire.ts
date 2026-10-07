import type Phaser from 'phaser';
import { SIGNS } from '../../content/script';
import { TILE } from '../../core/constants';
import type { EncounterDef } from '../../levels/types';
import type { Banana } from '../objects/Banana';
import type { PigNPC } from '../objects/PigNPC';
import { cellX, releaseBanana, resolvePig } from './basic';
import { Encounter, type EncounterHost } from './Encounter';
import { drawCoconut, drawRail } from './props';

/**
 * The major backfire. An overhead rail, hanging cables, warning lights, a lever and one giant coconut. A signpost
 * announces which way the coconut rolls; Makad can flip it. When Makad walks under the rail Dukkar pulls the lever
 * and celebrates. Default: the coconut rolls at Makad (telegraphed, slow, jumpable, a shove at worst) and cracks
 * against the wall. Flipped: it rolls at Dukkar, there is a pause, an administrative error is announced, and he flees
 * into the machinery, leaving two bananas in the wreckage.
 */
export class BackfireEncounter extends Encounter {
  protected declare pig: PigNPC;
  private rail!: ReturnType<typeof drawRail>;
  private coconut!: Phaser.GameObjects.Graphics;
  private sign: Phaser.GameObjects.GameObject[] = [];
  private signText!: Phaser.GameObjects.Text;
  private bananas: Banana[] = [];
  private signX = 0; private triggerX = 0; private dropX = 0; private railX0 = 0; private railX1 = 0; private groundY = 0; private railY = 0;
  private flipped = false;
  private rolling: { dir: 1 | -1; hitPlayer: boolean } | null = null;
  private outcome: 'none' | 'miss' | 'reverse' = 'none';
  private blink: Phaser.Time.TimerEvent | null = null;
  private shoveUntil = -Infinity;
  private shoveDir: 1 | -1 = -1;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }

  build(): void {
    const d = this.def.data ?? {};
    this.groundY = (this.def.y + 1) * TILE;
    this.signX = cellX(d.signCol ?? this.def.x - 9);
    this.triggerX = cellX(d.triggerCol ?? this.def.x - 6);
    this.dropX = cellX(d.dropCol ?? this.def.x - 3);
    this.railX0 = (d.railFrom ?? this.def.x - 10) * TILE; this.railX1 = (d.railTo ?? this.def.x + 1) * TILE + TILE;
    this.railY = this.groundY - 230;
    this.pig = resolvePig(this.host, this.def, 'lever');
    this.pig.calloutHandler = () => {
      if (this.state !== 'anticipation') return false;
      this.pig.rig.setMood('alert', 1500);
      this.host.say(this.pig, 'callout-lever', { priority: true });
      return true;
    };
    this.rail = drawRail(this.host.scene, this.railX0, this.railX1, this.railY, this.dropX);
    this.coconut = drawCoconut(this.host.scene, this.dropX, this.railY + 30);
    this.sign = this.host.world.addSign(this.signX, this.groundY, SIGNS.direction);
    this.signText = this.sign[1] as Phaser.GameObjects.Text;
    for (let i = 0; i < 2; i++) this.bananas.push(this.host.addBanana(this.pig.footX, this.groundY - 30, `${this.id}-banana-${i}`));
    this.addAction({ id: `${this.id}-flip`, label: 'Flip sign', priority: 3, available: () => this.state === 'anticipation' && this.near(this.signX, 70, this.groundY), run: () => this.flip() });
  }

  private flip(): void {
    this.flipped = !this.flipped;
    this.signText.setText(this.flipped ? SIGNS['direction-flipped'] : SIGNS.direction);
    this.host.sfx('switch', 1, 0);
    if (!this.host.reducedMotion) this.tween({ targets: this.sign, angle: this.flipped ? 6 : -6, duration: 120, yoyo: true });
    this.pig.rig.setMood('alert', 900);
  }

  override update(dt: number): void {
    const p = this.host.player;
    if (this.state === 'idle' && this.playerBetween(this.signX - 140, this.triggerX - 10, 140, this.groundY)) {
      this.setState('anticipation');
      this.pig.lookAt(p.x);
      this.host.say(this.pig, 'backfire-intro', { priority: true });
    }
    if (this.state === 'anticipation' && p.alive && p.x > this.triggerX && Math.abs(p.feetY - this.groundY) < 100) this.pull();
    if (this.rolling) this.roll(dt);
    else if (this.host.scene.time.now < this.shoveUntil && p.alive) p.externalVx = this.shoveDir * 300;
  }

  private pull(): void {
    this.setState('active');
    this.pig.rig.setMood('smug', 2000);
    this.host.say(this.pig, 'backfire-pull', { priority: true });
    if (!this.host.reducedMotion) this.pig.rig.impulse(0.9, 1.15, 160);
    this.host.sfx('switch', 1, 0);
    // warning lights + sound for a clear second before anything moves
    this.host.sfx('warning', 1, 0);
    let on = false;
    this.blink?.remove(false);
    this.blink = this.host.scene.time.addEvent({ delay: 150, repeat: 7, callback: () => { on = !on; for (const l of this.rail.lights) l.setAlpha(on ? 1 : 0.35); } });
    this.after(1000, () => {
      // the coconut drops onto the ground
      const fall = (): void => {
        this.host.sfx('impact', 1, 0); this.host.shake(0.006, 200); this.host.debris(this.dropX, this.groundY, 10);
        this.rolling = { dir: this.flipped ? 1 : -1, hitPlayer: false };
        this.pig.rig.setMood('smug', 1200);
        if (!this.host.reducedMotion) { this.tween({ targets: this.pig.rig, y: this.pig.footY - 14, duration: 120, yoyo: true, repeat: 2 }); } // celebrates
      };
      if (this.host.reducedMotion) { this.coconut.setPosition(this.dropX, this.groundY - 29); fall(); }
      else this.tween({ targets: this.coconut, y: this.groundY - 29, duration: 420, ease: 'Bounce.easeOut', onComplete: fall });
    });
  }

  private roll(dt: number): void {
    const r = this.rolling!;
    const speed = 185;
    this.coconut.x += r.dir * speed * dt;
    this.coconut.angle += r.dir * speed * dt * 2.2;
    const p = this.host.player;
    const cx = this.coconut.x, cy = this.coconut.y;
    // a shove, not a death: a short horizontal push through the same channel the wind uses (controls stay live)
    if (!r.hitPlayer && p.alive && Math.abs(p.x - cx) < 40 && p.feetY > cy - 30 && p.feetY - p.def.bodyHeight < cy + 26) {
      r.hitPlayer = true;
      this.shoveUntil = this.host.scene.time.now + 320;
      this.shoveDir = r.dir;
      p.rig.setMood('embarrassed', 1400);
      if (!this.host.reducedMotion) p.rig.impulse(1.2, 0.8, 160);
      this.host.sfx('bonk', 1, 0);
    }
    if (this.host.scene.time.now < this.shoveUntil && p.alive) p.externalVx = this.shoveDir * 300;
    if (r.dir === 1 && cx >= this.pig.rig.x - 30 && !this.pig.isHidden) { this.rolling = null; this.hitDukkar(); return; }
    if (r.dir === -1 && cx <= this.signX - 70) { this.rolling = null; this.miss(); }
  }

  private crack(x: number): void {
    this.host.sfx('crumble', 1, 0); this.host.debris(x, this.groundY - 20, 16); this.host.shake(0.004, 160);
    this.coconut.setVisible(false);
  }

  private miss(): void {
    this.crack(this.coconut.x);
    this.outcome = 'miss';
    this.setState('payoff');
    this.after(600, () => { this.pig.lookAt(this.host.player.x); this.pig.rig.setMood('embarrassed', 1800); this.host.say(this.pig, 'backfire-miss', { priority: true }); });
    this.after(1200, () => this.setState('complete'));
  }

  private hitDukkar(): void {
    this.outcome = 'reverse';
    this.setState('payoff');
    this.host.sfx('bonk', 1, 0); this.host.sfx('squeak', 1, 0); this.host.shake(0.005, 200);
    this.crack(this.coconut.x);
    this.host.debris(this.pig.rig.x, this.pig.rig.y - 50, 12);
    this.pig.stopMoving();
    this.pig.rig.setMood('alert', 2600);
    if (!this.host.reducedMotion) { this.pig.rig.setAngle(0); this.tween({ targets: this.pig.rig, x: this.pig.rig.x + 46, y: this.pig.footY - 40, angle: 40, duration: 220, ease: 'Quad.easeOut', yoyo: true, hold: 60 }); }
    // the pause
    this.after(1100, () => { this.pig.lookAt(this.host.player.x); this.host.say(this.pig, 'backfire-error', { priority: true }); });
    this.after(3000, () => {
      this.host.say(this.pig, 'backfire-flee', { priority: true });
      this.pig.rig.setMood('embarrassed', 2000);
      this.pig.walkTo(this.pig.footX + 150, 330, () => {
        if (this.state !== 'payoff' && this.state !== 'complete') return;
        this.host.sfx('clang', 1, 0); this.host.debris(this.pig.rig.x, this.pig.rig.y - 60, 10);
        this.pig.vanish();
      });
    });
    this.after(2000, () => {
      this.bananas.forEach((b, i) => releaseBanana(this.host, b, { x: this.pig.footX, y: this.groundY - 40 }, { x: this.pig.footX - 60 - i * 54, y: this.groundY - 26 }));
      this.host.achievement('reverse');
    });
    this.after(4600, () => this.setState('complete'));
  }

  protected override extraSnapshot(): Record<string, unknown> { return { outcome: this.outcome }; }
  protected override applyExtra(extra: Record<string, unknown>): void { if (extra.outcome === 'miss' || extra.outcome === 'reverse' || extra.outcome === 'none') this.outcome = extra.outcome; }

  protected applyState(state: 'idle' | 'complete'): void {
    this.blink?.remove(false); this.blink = null;
    this.rolling = null; this.shoveUntil = -Infinity;
    for (const l of this.rail.lights) l.setAlpha(0.45);
    this.host.scene.tweens.killTweensOf(this.coconut);
    this.pig.resetToHome();
    if (state === 'idle') {
      this.outcome = 'none'; this.flipped = false;
      this.signText.setText(SIGNS.direction);
      this.coconut.setVisible(true).setPosition(this.dropX, this.railY + 30).setAngle(0);
      for (const b of this.bananas) b.setLocked(true);
    } else {
      this.coconut.setVisible(false);
      if (this.outcome === 'reverse') { this.pig.vanish(); for (const b of this.bananas) b.setLocked(false); }
      else for (const b of this.bananas) b.setLocked(true);
    }
  }
  protected override onDestroy(): void {
    this.blink?.remove(false);
    this.rail.gfx.destroy(); for (const l of this.rail.lights) l.destroy();
    this.coconut.destroy(); for (const o of this.sign) o.destroy();
  }
}
