import type Phaser from 'phaser';
import { APOLOGY_KIT, BONK_CAPTION, MAKAD_LINES, SIGNS } from '../../content/script';
import { TILE } from '../../core/constants';
import type { Banana } from '../objects/Banana';
import type { PigNPC } from '../objects/PigNPC';
import type { EncounterDef } from '../../levels/types';
import { Encounter, type EncounterHost } from './Encounter';
import { drawArc, drawCrate, drawPedestalButton } from './props';

export const cellX = (col: number): number => col * TILE + TILE / 2;
export const cellFootY = (row: number): number => (row + 1) * TILE;

/** Resolve the encounter's pig: an existing level pig by id, or one spawned at the anchor cell. */
export function resolvePig(host: EncounterHost, def: EncounterDef, pose: Parameters<EncounterHost['spawnPig']>[2] = 'idle'): PigNPC {
  const existing = def.pig ? host.world.pigById(def.pig) : undefined;
  return existing ?? host.spawnPig(cellX(def.x), cellFootY(def.y), pose, def.flip ?? false, `${def.id}-pig`);
}

/** Release a locked bonus banana with a small hop from `from` to `to`. */
export function releaseBanana(host: EncounterHost, banana: Banana, from: { x: number; y: number }, to: { x: number; y: number }, onDone?: () => void): void {
  banana.setLocked(false);
  banana.moveTo(to.x, to.y);
  host.sfx('pop', 0.9, 0);
  if (host.reducedMotion) { onDone?.(); return; }
  const prog = { t: 0 };
  host.scene.tweens.add({
    targets: prog, t: 1, duration: 520, ease: 'Linear',
    onUpdate: () => { const t = prog.t; banana.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - 70 * 4 * t * (1 - t)); },
    onComplete: () => { banana.moveTo(to.x, to.y); host.sparkle(to.x, to.y, 8); onDone?.(); },
  });
}

/** First-ever "bonk makes him drop it" caption, shown once per save. */
export function bonkDropCaption(host: EncounterHost): void {
  if (host.hasFlag('bonk-caption-shown')) return;
  host.setFlag('bonk-caption-shown');
  host.caption(BONK_CAPTION, 2000);
}

// ====================================================================== holder: banana in hand, three replies
export class HolderEncounter extends Encounter {
  protected declare pig: PigNPC;
  private banana!: Banana;
  private diagram: Phaser.GameObjects.Graphics | null = null;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }

  build(): void {
    this.pig = resolvePig(this.host, this.def);
    this.pig.holdBanana(true);
    this.banana = this.host.addBanana(this.pig.footX, this.pig.footY - 30, `${this.id}-banana`);
    this.pig.bonkHandler = (fromX) => {
      if (!this.pig.holdingBanana) return false;
      this.pig.recoil(fromX);
      this.host.say(this.pig, 'bonk-dropped', { priority: true });
      this.drop();
      bonkDropCaption(this.host);
      return true;
    };
    this.pig.calloutHandler = () => {
      if (!this.pig.holdingBanana || this.state === 'active') return false;
      this.pig.lookAt(this.host.player.x);
      this.pig.rig.setMood('embarrassed', 1600);
      this.host.say(this.pig, 'callout-return', { priority: true });
      this.after(700, () => this.drop(true));
      return true;
    };
    this.addAction({
      id: `${this.id}-talk`, label: 'Talk', priority: 2,
      available: () => (this.state === 'idle' || this.state === 'anticipation') && this.pig.holdingBanana && this.near(this.pig.footX, 130, this.pig.footY),
      run: () => this.confront(),
    });
  }

  override update(): void {
    if (this.state === 'idle' && this.near(this.pig.footX, 230, this.pig.footY)) {
      this.setState('anticipation');
      this.pig.lookAt(this.host.player.x);
      this.host.say(this.pig, 'bonk-holder', { once: true, priority: true });
    }
  }

  private confront(): void {
    if (this.state !== 'anticipation' && this.state !== 'idle') return;
    this.setState('active');
    this.pig.lookAt(this.host.player.x);
    this.ask(null, [
      { id: 'explain', label: MAKAD_LINES['reply-explain'] },
      { id: 'yourself', label: MAKAD_LINES['reply-yourself'] },
      { id: 'stare', label: MAKAD_LINES['reply-stare'] },
    ], (pick) => {
      if (!pick) { this.setState('anticipation'); return; }
      const dir = this.pig.footX >= this.host.player.x ? 1 : -1;
      if (pick === 'explain') {
        this.host.makad('reply-explain');
        this.after(900, () => {
          this.host.say(this.pig, 'reply-explain-answer', { priority: true });
          this.showDiagram(dir);
          // the banana slips out while he gestures at the diagram
          this.after(1700, () => { this.drop(); this.after(2200, () => this.hideDiagram()); });
        });
      } else if (pick === 'yourself') {
        this.host.makad('reply-yourself');
        this.after(900, () => {
          this.host.say(this.pig, 'reply-yourself-answer', { priority: true });
          this.after(1300, () => {
            this.drop();
            const away = this.pig.footX + dir * 150;
            this.pig.walkTo(away, 230, () => { if (this.state === 'payoff' || this.state === 'complete') this.after(1400, () => this.pig.walkTo(this.pig.footX, 170, () => this.pig.lookAt(this.host.player.x))); });
          });
        });
      } else {
        this.host.makad('reply-stare');
        this.host.player.rig.setMood('neutral');
        this.pig.rig.setMood('alert', 1500);
        this.after(1500, () => {
          this.host.say(this.pig, 'reply-stare-answer', { priority: true });
          this.after(700, () => this.drop(true));
        });
      }
    });
  }

  private drop(slow = false): void {
    if (!this.pig.holdingBanana) return;
    this.pig.holdBanana(false);
    this.setState('payoff');
    const f = this.pig.footX >= this.host.player.x ? -1 : 1; // toward Makad
    const to = { x: this.pig.footX + f * 46, y: this.pig.footY - 26 };
    releaseBanana(this.host, this.banana, { x: this.pig.rig.x + 16 * f, y: this.pig.rig.y - 42 }, to, () => this.setState('complete'));
    if (slow) this.pig.rig.setMood('embarrassed', 1600);
  }

  private showDiagram(dir: number): void {
    this.hideDiagram();
    const g = this.host.scene.add.graphics().setDepth(15 + 3);
    const x = this.pig.footX - dir * 70, y = this.pig.footY - 150;
    g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(x - 52, y - 42, 104, 84, 6);
    g.fillStyle(0xfff8e7, 1); g.fillRoundedRect(x - 48, y - 38, 96, 76, 4);
    g.lineStyle(2, 0x2a1d12, 0.8);
    g.strokeCircle(x - 24, y - 14, 8); g.strokeCircle(x + 22, y + 12, 8); g.lineBetween(x - 16, y - 10, x + 14, y + 8);
    g.lineBetween(x - 40, y + 24, x + 40, y + 24); g.lineBetween(x - 40, y - 26, x - 10, y - 26); g.lineBetween(x + 8, y - 26, x + 40, y - 26);
    g.fillStyle(0xe5484d, 1); g.fillTriangle(x + 30, y - 2, x + 40, y + 6, x + 28, y + 10);
    g.setScale(0.2).setAlpha(0);
    this.diagram = g;
    this.tween({ targets: g, scaleX: 1, scaleY: 1, alpha: 1, duration: this.host.reducedMotion ? 1 : 260, ease: 'Back.easeOut' });
  }
  private hideDiagram(): void { this.diagram?.destroy(); this.diagram = null; }

  protected applyState(state: 'idle' | 'complete'): void {
    this.hideDiagram();
    this.pig.resetToHome();
    if (state === 'idle') { this.pig.holdBanana(true); this.banana.setLocked(true); }
    else { this.pig.holdBanana(false); this.banana.setLocked(false); }
  }
  protected override onDestroy(): void { this.hideDiagram(); }
}

// ====================================================================== show me: "It's literally one jump."
export class ShowMeEncounter extends Encounter {
  protected declare pig: PigNPC;
  private arc: Phaser.GameObjects.Graphics | null = null;
  private sign: Phaser.GameObjects.GameObject[] = [];
  private pitX0 = 0; private pitX1 = 0; private landX = 0;
  private demoDone = false;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }

  build(): void {
    const d = this.def.data ?? {};
    this.pitX0 = (d.pitFrom ?? this.def.x + 2) * TILE;
    this.pitX1 = (d.pitTo ?? this.def.x + 4) * TILE + TILE;
    this.landX = cellX(d.landCol ?? (d.pitTo ?? this.def.x + 4) + 2);
    this.pig = resolvePig(this.host, this.def);
    this.addAction({
      id: `${this.id}-showme`, label: MAKAD_LINES.showme, priority: 3,
      available: () => this.state === 'anticipation' && !this.demoDone && this.near(this.pig.footX, 170, this.pig.footY),
      run: () => this.demonstrate(),
    });
  }

  override update(): void {
    const p = this.host.player;
    if (this.state === 'idle' && this.playerBetween(this.pig.footX - 240, this.pig.footX + 50, 120, this.pig.footY)) {
      this.setState('anticipation');
      this.pig.lookAt(p.x);
      this.host.say(this.pig, 'showme-claim', { priority: true });
    }
    // Makad clears it (with or without the demo): the sign pops only if the demo was asked for
    if ((this.state === 'anticipation' || this.state === 'payoff') && p.alive && p.grounded && p.x > this.pitX1 + 16 && Math.abs(p.feetY - this.pig.footY) < 60) {
      if (this.demoDone) this.popSign();
      this.setState('complete');
    }
  }

  private demonstrate(): void {
    if (this.state !== 'anticipation') return;
    this.setState('active');
    this.demoDone = true;
    this.host.makad('showme');
    this.after(700, () => {
      this.host.say(this.pig, 'showme-go', { priority: true });
      this.pig.rig.setMood('smug', 1200);
    });
    this.after(1600, () => {
      this.pig.walkTo(this.pitX0 - 24, 250, () => {
        if (this.state !== 'active') return;
        // a confident, badly aimed hop straight into the pit
        this.pig.jumpTo(this.pitX0 + (this.pitX1 - this.pitX0) * 0.45, this.pig.footY + 10, 540, 70, () => {
          if (this.state !== 'active') return;
          this.host.sfx('whoosh', 0.8, 0);
          this.host.debris(this.pig.rig.x, this.pig.rig.y, 6);
          this.pig.fallAndReappear(240, 650, () => {
            if (this.state !== 'active') return;
            this.pig.lookAt(this.host.player.x);
            this.host.say(this.pig, 'showme-fail', { priority: true });
            this.host.achievement('demonstration');
            this.showArc();
            this.setState('payoff');
          });
        });
      });
    });
  }

  /** The useful part: the arc of a jump that actually works. Lingers, then fades. */
  private showArc(): void {
    this.arc?.destroy();
    this.arc = drawArc(this.host.scene, this.pitX0 - 30, this.pig.footY - 20, this.pitX1 + 40, this.pig.footY - 20, 95);
    this.tween({ targets: this.arc, alpha: 0, delay: 4200, duration: 600, onComplete: () => { this.arc?.destroy(); this.arc = null; } });
  }

  private popSign(): void {
    if (this.sign.length) return;
    this.sign = this.host.world.addSign(this.landX, this.pig.footY, SIGNS.showme);
    this.host.sfx('pop', 1, 0);
    for (const o of this.sign) {
      const t = o as Phaser.GameObjects.Graphics;
      if (!this.host.reducedMotion) { t.setAlpha(0); this.tween({ targets: t, alpha: 1, duration: 200 }); }
    }
    this.after(2600, () => this.clearSign());
  }
  private clearSign(): void { for (const o of this.sign) o.destroy(); this.sign = []; }

  protected applyState(state: 'idle' | 'complete'): void {
    this.pig.resetToHome();
    this.arc?.destroy(); this.arc = null;
    this.clearSign();
    if (state === 'idle') this.demoDone = this.demoDone && this.seenOnce; // a repeat attempt keeps the knowledge, not the gag
  }
  protected override onDestroy(): void { this.arc?.destroy(); this.clearSign(); }
}

// ====================================================================== the red button
export class ButtonEncounter extends Encounter {
  protected declare pig: PigNPC;
  private buttonX = 0; private exitX = 0; private groundY = 0;
  private parts!: ReturnType<typeof drawPedestalButton>;
  private sign: Phaser.GameObjects.GameObject[] = [];
  private gotcha: Phaser.GameObjects.GameObject[] = [];
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }

  build(): void {
    const d = this.def.data ?? {};
    this.buttonX = cellX(d.buttonCol ?? this.def.x - 4);
    this.exitX = cellX(d.exitCol ?? this.def.x + 3);
    this.groundY = cellFootY(this.def.y);
    this.pig = resolvePig(this.host, this.def);
    this.parts = drawPedestalButton(this.host.scene, this.buttonX, this.groundY);
    this.sign = this.host.world.addSign(this.buttonX - 66, this.groundY, SIGNS['red-button']);
    this.addAction({
      id: `${this.id}-press`, label: 'Press', priority: 3,
      available: () => (this.state === 'anticipation' || this.state === 'idle') && this.near(this.buttonX, 64, this.groundY),
      run: () => this.makadPresses(),
    });
  }

  override update(): void {
    const p = this.host.player;
    if (this.state === 'idle' && this.playerBetween(this.buttonX - 260, this.exitX, 120, this.groundY)) {
      this.setState('anticipation');
      this.pig.lookAt(p.x);
      this.host.say(this.pig, 'button-dont', { priority: true });
    }
    if (this.state === 'anticipation' && p.alive && p.grounded && p.x > this.exitX && Math.abs(p.feetY - this.groundY) < 200) this.dukkarPresses();
  }

  private pressVisual(): void {
    this.host.sfx('switch', 1, 0);
    if (this.host.reducedMotion) return;
    this.tween({ targets: this.parts.dome, y: this.groundY - 34, duration: 80, yoyo: true, hold: 220 });
  }

  private makadPresses(): void {
    if (this.state !== 'anticipation' && this.state !== 'idle') return;
    this.setState('active');
    this.pressVisual();
    this.after(260, () => {
      this.host.sfx('boing', 1, 0);
      this.host.confetti(this.buttonX, this.groundY - 60, 24);
      this.host.sparkle(this.buttonX, this.groundY - 50, 14);
      this.gotcha = this.host.world.addSign(this.buttonX + 70, this.groundY, SIGNS.gotcha);
      if (!this.host.reducedMotion) for (const o of this.gotcha) { const g = o as Phaser.GameObjects.Graphics; const y = g.y; g.setY(y + 60); this.tween({ targets: g, y, duration: 320, ease: 'Back.easeOut' }); }
      this.pig.lookAt(this.host.player.x);
      this.pig.rig.setMood('smug', 1800);
      this.host.say(this.pig, 'button-pressed', { priority: true });
      this.setState('payoff');
      this.after(1200, () => this.setState('complete'));
    });
  }

  private dukkarPresses(): void {
    this.setState('active');
    this.pig.lookAt(this.host.player.x);
    this.host.say(this.pig, 'button-saw', { priority: true });
    this.after(1700, () => this.host.say(this.pig, 'button-ages', { priority: true }));
    this.after(3400, () => {
      this.host.say(this.pig, 'button-self', { priority: true });
      const side = this.pig.footX > this.buttonX ? 1 : -1;
      this.after(900, () => {
        this.pig.walkTo(this.buttonX + side * 42, 200, () => {
          if (this.state !== 'active') return;
          this.pig.lookAt(this.buttonX);
          this.pressVisual();
          this.after(220, () => this.glove(side));
        });
      });
    });
  }

  private glove(side: number): void {
    const g = this.parts.glove;
    g.setVisible(true).setScale(1, 0.1).setAngle(side * 70);
    this.host.sfx('glove', 1, 0);
    this.host.shake(0.004, 160);
    this.pig.rig.setMood('alert', 400);
    const hit = (): void => {
      this.pig.rig.setMood('embarrassed', 2400);
      this.host.debris(this.pig.rig.x, this.pig.rig.y - 60, 8);
      this.host.sfx('bonk', 1, 0); this.host.sfx('squeak', 1, 0);
      const landX = this.pig.footX;
      if (this.host.reducedMotion) { this.pig.rig.setPosition(landX, this.pig.footY); }
      else {
        const prog = { t: 0 }, sx = this.pig.rig.x, sy = this.pig.rig.y;
        this.tween({ targets: prog, t: 1, duration: 520, ease: 'Linear', onUpdate: () => { const t = prog.t; this.pig.rig.setPosition(sx + (landX - sx) * t, sy - 110 * 4 * t * (1 - t)); this.pig.rig.setAngle(side * 360 * t); }, onComplete: () => { this.pig.rig.setAngle(0).setPosition(landX, this.pig.footY); this.pig.rig.impulse(1.25, 0.75, 160); } });
      }
      this.after(700, () => { this.pig.lookAt(this.buttonX); this.host.say(this.pig, 'button-glove', { priority: true }); });
      this.after(900, () => { this.host.achievement('unbothered'); this.setState('payoff'); });
      this.after(2600, () => { this.setState('complete'); if (!this.host.reducedMotion) this.tween({ targets: g, scaleY: 0.1, duration: 300, onComplete: () => g.setVisible(false) }); else g.setVisible(false); });
    };
    if (this.host.reducedMotion) { g.setScale(1, 1); hit(); return; }
    this.tween({ targets: g, scaleY: 1, duration: 110, ease: 'Back.easeOut', onComplete: hit });
  }

  protected applyState(state: 'idle' | 'complete'): void {
    this.pig.resetToHome();
    this.parts.glove.setVisible(false);
    this.parts.dome.setY(this.groundY - 42);
    for (const o of this.gotcha) o.destroy(); this.gotcha = [];
    if (state === 'complete') this.parts.glove.setVisible(false);
  }
  protected override onDestroy(): void {
    this.parts.base.destroy(); this.parts.dome.destroy(); this.parts.glove.destroy();
    for (const o of this.sign) o.destroy(); for (const o of this.gotcha) o.destroy();
  }
}

// ====================================================================== supplies crate / apology kit
export class CrateEncounter extends Encounter {
  private x = 0; private y = 0;
  private banana!: Banana;
  private parts!: ReturnType<typeof drawCrate>;
  protected declare pig: PigNPC | null;
  private readonly apology: boolean;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); this.apology = def.kind === 'apology'; }

  build(): void {
    this.x = cellX(this.def.x); this.y = cellFootY(this.def.y);
    this.parts = drawCrate(this.host.scene, this.x, this.y, this.apology ? 'APOLOGY KIT' : 'SUPPLIES', this.apology ? 0xe5484d : 0x9c7a4a);
    this.banana = this.host.addBanana(this.x, this.y - 40, `${this.id}-banana`);
    if (this.def.pig) this.pig = this.host.world.pigById(this.def.pig) ?? null;
    this.addAction({ id: `${this.id}-open`, label: 'Open', priority: 2, available: () => this.state === 'idle' && this.near(this.x, 80, this.y), run: () => this.open() });
  }

  private open(): void {
    if (this.state !== 'idle') return;
    this.setState('active');
    this.host.sfx('pop', 1, 0);
    if (!this.host.reducedMotion) this.tween({ targets: this.parts.lid, y: this.y - 86, angle: -34, x: this.x - 30, duration: 320, ease: 'Back.easeOut' });
    else this.parts.lid.setPosition(this.x - 30, this.y - 86).setAngle(-34);
    if (!this.apology) {
      this.host.caption(SIGNS.supplies, 2000);
      releaseBanana(this.host, this.banana, { x: this.x, y: this.y - 40 }, { x: this.x + 54, y: this.y - 26 }, () => this.setState('complete'));
      return;
    }
    this.host.caption(SIGNS.apology, 1000);
    // the kit: itemised captions, Dukkar reads the form, something distant and unrelated explodes
    const lines = APOLOGY_KIT.slice(1);
    lines.forEach((line, i) => this.after(1100 + i * 1100, () => this.host.caption(line, 1050)));
    const pig = this.pig;
    this.after(1100 + lines.length * 1100, () => {
      if (pig) { pig.lookAt(this.x); this.host.say(pig, 'apology-read', { priority: true }); }
      this.after(1900, () => {
        const bx = this.x + 620, by = this.y - 160;
        this.host.sfx('boom', 1, 0);
        this.host.shake(0.005, 320);
        this.host.debris(bx, by, 14);
        this.host.sparkle(bx, by, 10);
        this.host.player.rig.setMood('alert', 1200);
        if (pig) { pig.rig.setMood('alert', 1200); if (!this.host.reducedMotion) pig.rig.impulse(1.1, 0.9, 120); }
        this.after(1100, () => {
          if (pig) this.host.say(pig, 'apology-boom', { priority: true });
          releaseBanana(this.host, this.banana, { x: this.x, y: this.y - 40 }, { x: this.x + 54, y: this.y - 26 }, () => this.setState('complete'));
        });
      });
    });
  }

  protected applyState(state: 'idle' | 'complete'): void {
    const lid = this.parts.lid;
    this.host.scene.tweens.killTweensOf(lid);
    if (state === 'idle') { lid.setPosition(this.x, this.y - 50).setAngle(0); this.banana.setLocked(true); }
    else { lid.setPosition(this.x - 30, this.y - 86).setAngle(-34); this.banana.setLocked(false); }
  }
  protected override onDestroy(): void { this.parts.box.destroy(); this.parts.lid.destroy(); this.parts.text.destroy(); }
}

// ====================================================================== tiny umbrella over the checkpoint
export class UmbrellaEncounter extends Encounter {
  protected declare pig: PigNPC;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }
  build(): void { this.pig = resolvePig(this.host, this.def, 'umbrella'); }
  override update(): void {
    if (this.state === 'idle' && this.near(this.pig.footX, 120, this.pig.footY)) {
      this.pig.lookAt(this.host.player.x);
      // keep trying while Makad is near; the line waits its turn behind whatever is on screen
      if (this.host.say(this.pig, 'coop-umbrella', { once: true })) { this.setState('payoff'); this.after(200, () => this.setState('complete')); }
    }
  }
  protected applyState(): void { this.pig.resetToHome(); }
}

// ====================================================================== "I know a—" callback
export class CallbackEncounter extends Encounter {
  protected declare pig: PigNPC;
  private miniSign: Phaser.GameObjects.Graphics | null = null;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }
  build(): void {
    this.pig = resolvePig(this.host, this.def);
    if (!this.host.hasFlag('l2-shortcut-taken')) { this.state = 'complete'; return; }
    // a small "SHORTCUT →" board he is already holding
    const g = this.host.scene.add.graphics();
    g.fillStyle(0x2a1d12, 1); g.fillRect(-2, -70, 4, 44); g.fillRoundedRect(-30, -92, 60, 26, 4);
    g.fillStyle(0xf7c948, 1); g.fillRoundedRect(-27, -89, 54, 20, 3);
    g.fillStyle(0x2a1d12, 1); g.fillRect(-20, -83, 30, 3); g.fillRect(-20, -77, 22, 3); g.fillTriangle(16, -84, 24, -79, 16, -74);
    g.setPosition(26, 0);
    this.pig.rig.add(g);
    this.miniSign = g;
  }
  override update(): void {
    if (this.state === 'idle' && this.near(this.pig.footX, 200, this.pig.footY)) {
      this.setState('active');
      this.pig.lookAt(this.host.player.x);
      this.host.say(this.pig, 'shortcut-callback-start', { priority: true });
      this.after(900, () => {
        this.host.player.rig.setMood('alert', 1100); // Makad looks
        this.after(700, () => {
          this.host.say(this.pig, 'shortcut-callback-end', { priority: true });
          this.pig.rig.setMood('embarrassed', 1600);
          if (this.miniSign) { if (this.host.reducedMotion) this.miniSign.setVisible(false); else this.tween({ targets: this.miniSign, y: 60, alpha: 0, duration: 400, ease: 'Quad.easeIn', onComplete: () => this.miniSign?.setVisible(false) }); }
          this.after(500, () => this.setState('complete'));
        });
      });
    }
  }
  protected applyState(state: 'idle' | 'complete'): void {
    this.pig.resetToHome();
    if (this.miniSign) { this.miniSign.setVisible(state === 'idle').setPosition(26, 0).setAlpha(1); }
  }
}

// ====================================================================== stuck in his own trap
export class StuckEncounter extends Encounter {
  protected declare pig: PigNPC;
  private banana!: Banana;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }
  build(): void {
    this.pig = resolvePig(this.host, this.def, 'stuck');
    this.banana = this.host.addBanana(this.pig.footX, this.pig.footY - 30, `${this.id}-banana`);
    this.addAction({ id: `${this.id}-pull`, label: 'Pull', priority: 3, available: () => this.state === 'idle' && this.near(this.pig.footX, 110, this.pig.footY), run: () => this.pull() });
  }
  private pull(): void {
    if (this.state !== 'idle') return;
    this.setState('active');
    const p = this.host.player;
    const dir = p.x < this.pig.footX ? -1 : 1;
    this.host.sfx('whoosh', 0.9, 0);
    if (!this.host.reducedMotion) { p.rig.impulse(0.82, 1.18, 140); this.pig.rig.impulse(1.2, 0.86, 140); }
    this.after(500, () => { this.host.sfx('whoosh', 0.9, 0); if (!this.host.reducedMotion) { p.rig.impulse(0.82, 1.18, 140); this.pig.rig.impulse(1.2, 0.86, 140); } });
    this.after(1000, () => {
      this.host.sfx('pop', 1, 0);
      this.pig.setPoseVisible(false);
      this.host.debris(this.pig.rig.x, this.pig.rig.y - 40, 10);
      const landX = this.pig.footX + dir * 70;
      this.pig.jumpTo(landX, this.pig.footY, 420, 70, () => {
        if (this.state !== 'active') return;
        this.pig.lookAt(p.x);
        this.pig.rig.setMood('embarrassed', 2000);
        this.host.say(this.pig, 'coop-pulled', { priority: true });
        this.setState('payoff');
        this.after(900, () => releaseBanana(this.host, this.banana, { x: this.pig.rig.x, y: this.pig.rig.y - 40 }, { x: this.pig.rig.x - dir * 50, y: this.pig.footY - 26 }, () => { this.pig.setHome(landX); this.setState('complete'); }));
      });
    });
  }
  protected applyState(state: 'idle' | 'complete'): void {
    if (state === 'idle') { this.pig.setPoseVisible(true); this.banana.setLocked(true); }
    else { this.pig.setPoseVisible(false); this.banana.setLocked(false); }
    this.pig.resetToHome();
  }
}

// ====================================================================== escalations desk
export class EscalationsEncounter extends Encounter {
  protected declare pig: PigNPC;
  private sign: Phaser.GameObjects.GameObject[] = [];
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }
  build(): void {
    this.pig = resolvePig(this.host, this.def, 'escalations');
    this.pig.setMoustache(true);
    this.sign = this.host.world.addSign(this.pig.footX + 80, cellFootY(this.def.y), SIGNS.escalations);
    installMoustacheBonk(this.host, this.pig);
    this.addAction({ id: `${this.id}-escalate`, label: 'Escalate', priority: 2, available: () => this.state === 'idle' && this.near(this.pig.footX, 130, cellFootY(this.def.y)), run: () => {
      this.setState('payoff');
      this.pig.lookAt(this.host.player.x);
      this.host.say(this.pig, 'desk-escalations', { priority: true });
      this.after(300, () => this.setState('complete'));
    } });
  }
  protected applyState(): void { this.pig.resetToHome(); }
  protected override onDestroy(): void { for (const o of this.sign) o.destroy(); }
}

/** Bonking a desk pig knocks the fake moustache off first; after that he reacts like anyone else. */
export function installMoustacheBonk(host: EncounterHost, pig: PigNPC): void {
  const prev = pig.bonkHandler;
  pig.bonkHandler = (fromX) => {
    if (pig.hasMoustache) {
      pig.dropMoustache();
      pig.recoil(fromX);
      host.say(pig, 'bonk-moustache', { priority: true });
      return true;
    }
    return prev ? prev(fromX) : false;
  };
}
