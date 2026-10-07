import type Phaser from 'phaser';
import type { DeathCause } from '../../content/script';
import { DEPTH } from '../../core/constants';
import type { PigNPC } from '../objects/PigNPC';
import type { Player } from '../player/Player';
import type { SayOptions } from './DialoguePolicy';
import type { DialoguePolicy } from './DialoguePolicy';

export interface TrapWatch { id: string; state: () => string; }
export interface SignRef { gfx: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; x: number; y: number; key: string; }

export interface ReactionHost {
  scene: Phaser.Scene;
  player: Player;
  pigs: PigNPC[];
  policy: DialoguePolicy;
  reducedMotion: boolean;
  say(pig: PigNPC, key: string, opts?: SayOptions): boolean;
  sfx(name: 'whoosh' | 'applause' | 'pop', intensity?: number, minGapMs?: number): void;
  sparkle(x: number, y: number, n: number): void;
  traps: TrapWatch[];
  signs: Map<string, SignRef>;
  hardBanana: { x: number; y: number } | null;
}

const HINT_BY_CAUSE: Partial<Record<DeathCause, string>> = {
  bridge: 'hint-bridge', coconut: 'hint-coconut', crush: 'hint-crusher', croc: 'hint-croc', sinking: 'hint-sinking', cloud: 'hint-cloud', wind: 'hint-wind',
};

/**
 * Event-aware Dukkar. Watches what the player does and picks the one reaction that fits, through the shared
 * dialogue policy (gap, repeat window, airborne suppression, taunt budget). Nothing here ever gates progress.
 *  - waits nearby                → "Planning something, Makad?"
 *  - a trap fires and misses     → "That usually works."
 *  - walks back toward him       → "Makad. Let's discuss this."
 *  - clears a section first try  → the SKILL ISSUE sign gets pulled
 *  - dies nearby                 → he laughs; stops abruptly when Makad respawns
 *  - dies three times in a row   → taunts stop, he points out the trap and says something useful
 *  - reaches a checkpoint nearby → applauds, then remembers whose side he is on
 */
export class ReactionDirector {
  private stillMs = 0;
  private backMs = 0;
  private maxX = -Infinity;
  private sectionDeaths = 0;
  private lastDeath: { cause: DeathCause; x: number } | null = null;
  private trapPrev = new Map<string, string>();
  private trapArmedX = new Map<string, number>();
  private removedSigns = new Set<string>();
  private laugher: PigNPC | null = null;
  private marker: Phaser.GameObjects.Text | null = null;
  private markerTween: Phaser.Tweens.Tween | null = null;

  /** Set by the scene while an encounter is mid-gag: no idle banter on top of it. */
  quiet = false;

  constructor(private host: ReactionHost) {}

  get tauntsAllowed(): boolean { return this.host.policy.tauntBudget > 0; }

  private nearest(x: number, maxDist: number): PigNPC | null {
    let best: PigNPC | null = null, bestD = maxDist;
    for (const pig of this.host.pigs) { if (pig.isHidden) continue; const d = Math.abs(pig.footX - x); if (d < bestD) { bestD = d; best = pig; } }
    return best;
  }

  update(dt: number): void {
    const p = this.host.player;
    if (!p.alive) return;
    const ms = dt * 1000;
    if (this.quiet) { this.stillMs = 0; this.backMs = 0; }
    // waiting nearby
    const idle = p.grounded && Math.abs(p.body.velocity.x) < 8;
    const pig = this.nearest(p.x, 300);
    this.stillMs = idle && pig && !this.quiet ? this.stillMs + ms : 0;
    if (this.stillMs > 3500 && pig) {
      pig.lookAt(p.x);
      // long refractory period once said; if the channel was busy, try again shortly
      this.stillMs = this.host.say(pig, 'react-waiting', { taunt: true }) ? -9000 : 3000;
    }
    // walking back toward him after making progress
    this.maxX = Math.max(this.maxX, p.x);
    const goingBack = p.body.velocity.x < -40 && p.x < this.maxX - 180;
    this.backMs = goingBack && !this.quiet ? this.backMs + ms : 0;
    if (this.backMs > 1200) {
      this.backMs = -6000;
      const back = this.nearest(p.x, 520);
      if (back) { back.lookAt(p.x); this.host.say(back, 'react-return', { once: true, taunt: true }); }
    }
    // traps that fired and missed
    for (const t of this.host.traps) {
      const now = t.state(), prev = this.trapPrev.get(t.id) ?? now;
      if (now !== prev) {
        if (now === 'active' || now === 'warning') this.trapArmedX.set(t.id, p.x);
        if (prev === 'active' && now !== 'active' && now !== 'warning') {
          const armedX = this.trapArmedX.get(t.id);
          if (armedX !== undefined && p.x > armedX + 50) {
            const w = this.nearest(p.x, 600);
            if (w) { w.lookAt(p.x); w.rig.setMood('alert', 900); this.host.say(w, 'react-avoided'); }
          }
        }
        this.trapPrev.set(t.id, now);
      }
    }
  }

  onPlayerDied(cause: DeathCause, x: number): void {
    this.sectionDeaths++;
    this.lastDeath = { cause, x };
    this.stillMs = 0; this.backMs = 0;
    const pig = this.nearest(x, 720);
    this.laugher = null;
    if (pig && this.tauntsAllowed) {
      pig.lookAt(x);
      pig.react('laugh');
      this.laugher = pig;
      if (Math.random() < 0.35) this.host.scene.time.delayedCall(500, () => { if (pig.laughing) this.host.say(pig, 'death-tease', { taunt: true }); });
    }
    if (this.sectionDeaths >= 3) this.host.policy.tauntBudget = 0;
  }

  onPlayerRespawned(): void {
    const p = this.host.player;
    this.maxX = p.x;
    // caught laughing
    const l = this.laugher;
    if (l && l.laughing) {
      l.stopLaughing();
      this.host.scene.time.delayedCall(350, () => { l.lookAt(p.x); this.host.say(l, 'react-caught-laughing', { once: true, priority: true }); });
    }
    this.laugher = null;
    // after three failures in one section: a hint, and a finger pointed at the trap
    if (this.sectionDeaths >= 3 && this.lastDeath) {
      const key = HINT_BY_CAUSE[this.lastDeath.cause] ?? 'hint-generic';
      const pig = this.nearest(this.lastDeath.x, 900);
      const deathX = this.lastDeath.x;
      this.host.scene.time.delayedCall(900, () => {
        if (pig) { pig.lookAt(deathX); pig.rig.setMood('neutral'); this.host.say(pig, key, { once: true, priority: true }); }
        this.showMarker(deathX, p.feetY - 150);
      });
    }
  }

  onCheckpoint(x: number): void {
    const firstTry = this.sectionDeaths === 0;
    this.sectionDeaths = 0;
    this.host.policy.tauntBudget = Infinity;
    const p = this.host.player;
    if (firstTry) {
      for (const [id, s] of this.host.signs) {
        if (s.key !== 'skill-issue' || this.removedSigns.has(id) || Math.abs(s.x - x) > 700) continue;
        this.removedSigns.add(id);
        this.host.sfx('whoosh', 1, 0);
        this.host.sparkle(s.x, s.y - 60, 10);
        const targets = [s.gfx, s.text];
        if (this.host.reducedMotion) { for (const t of targets) t.setVisible(false); }
        else this.host.scene.tweens.add({ targets, y: '-=320', angle: -200, alpha: 0, duration: 900, ease: 'Quad.easeIn' });
      }
    }
    const pig = this.nearest(x, 440);
    if (pig) {
      pig.lookAt(p.x);
      pig.applaud();
      this.host.sfx('applause', 0.8, 0);
      this.host.scene.time.delayedCall(1100, () => this.host.say(pig, 'react-applaud-stop', { once: true }));
    }
  }

  onBananaCollected(x: number, y: number): void {
    const hb = this.host.hardBanana;
    if (!hb || Math.abs(hb.x - x) > 24 || Math.abs(hb.y - y) > 24) return;
    const pig = this.nearest(x, 900);
    if (pig) this.host.scene.time.delayedCall(600, () => { pig.lookAt(x); this.host.say(pig, 'react-bonus', { once: true, priority: true }); });
  }

  /** Something heavy landed near a pig: he flinches. */
  onImpactNear(x: number): void {
    const pig = this.nearest(x, 200);
    if (!pig) return;
    pig.rig.setMood('alert', 900);
    if (!this.host.reducedMotion) pig.rig.impulse(0.9, 1.12, 120);
  }

  private showMarker(x: number, y: number): void {
    this.hideMarker();
    const m = this.host.scene.add.text(x, y, '▼', { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '28px', color: '#fff1a8', stroke: '#2a1d12', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.particles);
    this.marker = m;
    if (!this.host.reducedMotion) this.markerTween = this.host.scene.tweens.add({ targets: m, y: y + 12, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.host.scene.time.delayedCall(3400, () => this.hideMarker());
  }
  private hideMarker(): void { this.markerTween?.stop(); this.markerTween = null; this.marker?.destroy(); this.marker = null; }

  destroy(): void { this.hideMarker(); }
}
