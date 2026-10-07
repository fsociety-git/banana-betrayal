import Phaser from 'phaser';
import { CHARACTERS } from '../../content/characters';
import { DEPTH } from '../../core/constants';
import { CharacterRig } from '../player/CharacterRig';
import type { Resettable } from '../world/SnapshotRegistry';
import type { Speaker } from '../dialogue/DialogueManager';

export type BossState = 'idle' | 'intro' | 'telegraph' | 'charge' | 'stunned' | 'lob' | 'recover' | 'defeated';

interface Crate {
  go: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number; vx: number; vy: number;
  landed: boolean; age: number;
}

export interface BossEvents {
  phaseChanged: (phase: number) => void;
  hit: (hpLeft: number) => void;
  defeated: () => void;
  telegraph: (kind: 'charge' | 'lob') => void;
  charge: () => void;
  wallHit: () => void;
  crateLand: (x: number, y: number) => void;
}

/**
 * The pig in a comically overbuilt banana forklift. Three phases, every attack telegraphed:
 *  1. revs (exhaust + "!") then charges; jamming the forks into the wall machinery stuns him → stomp his hood.
 *  2. also lobs banana crates that cast landing shadows before they drop.
 *  3. double charges with a shorter wind-up and crates from the ceiling.
 * Deterministic timers, fully resettable (deaths restart the encounter at phase 1).
 */
export class PigBoss implements Resettable<{ reset: true }>, Speaker {
  readonly events = new Phaser.Events.EventEmitter();
  readonly root: Phaser.GameObjects.Container;
  readonly rig: CharacterRig;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly stompZone: Phaser.GameObjects.Zone;
  readonly stompBody: Phaser.Physics.Arcade.StaticBody;
  state: BossState = 'idle';
  hp = 3;
  phase = 1;
  crates: Crate[] = [];
  private scene: Phaser.Scene;
  private arena: { left: number; right: number; floorY: number; top: number };
  private startX: number;
  private facing: 1 | -1 = -1;
  private timer = 0;
  private chargeSpeed = 0;
  private chargesLeft = 0;
  private alert: Phaser.GameObjects.Text;
  private exhaust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private forkGfx: Phaser.GameObjects.Graphics;
  private trophy: Phaser.GameObjects.Image;
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private targetX = 0;
  private invulnUntil = 0;
  private reducedMotion: boolean;
  private tilt = 0;
  readonly width = 150;
  readonly height = 90;

  constructor(scene: Phaser.Scene, arena: { left: number; right: number; floorY: number; top: number }, reducedMotion: boolean) {
    this.scene = scene;
    this.arena = arena;
    this.reducedMotion = reducedMotion;
    this.startX = arena.right - 220;
    this.root = scene.add.container(this.startX, arena.floorY).setDepth(DEPTH.npc);
    this.forkGfx = scene.add.graphics();
    this.root.add(this.forkGfx);
    this.drawForklift();
    this.trophy = scene.add.image(0, 0, 'banana').setScale(1.6).setTint(0xffd84a);
    this.root.add(this.trophy);
    this.rig = new CharacterRig(scene, this.startX, arena.floorY - 44, CHARACTERS.pig);
    this.rig.setDepth(DEPTH.npc + 1);
    this.rig.setScale(0.85);
    this.rig.shadow.setVisible(false);
    this.alert = scene.add.text(this.startX, arena.floorY - 170, '!', { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '42px', color: '#e5484d', fontStyle: 'bold', stroke: '#2c1a0e', strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.npc + 3).setVisible(false);
    // physics: the forklift is an immovable block the player collides with (deadly unless stunned/defeated)
    this.root.setSize(this.width, this.height);
    scene.physics.add.existing(this.root);
    this.body = this.root.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false); this.body.immovable = true; this.body.moves = false; this.body.setFriction(0, 0);
    this.body.setSize(this.width - 20, this.height - 10).setOffset(-(this.width - 20) / 2, -(this.height - 10) - 2);
    // stomp zone: hood of the forklift, only enabled while stunned
    this.stompZone = scene.add.zone(this.startX, arena.floorY - this.height - 30, 110, 40);
    scene.physics.add.existing(this.stompZone, true);
    this.stompBody = this.stompZone.body as Phaser.Physics.Arcade.StaticBody;
    this.stompBody.enable = false;
    if (!reducedMotion) {
      this.exhaust = scene.add.particles(0, 0, 'dot', { lifespan: 600, speedX: { min: 30, max: 90 }, speedY: { min: -60, max: -20 }, scale: { start: 0.6, end: 1.4 }, alpha: { start: 0.5, end: 0 }, tint: 0x555566, frequency: 60, emitting: false }).setDepth(DEPTH.npc - 1);
      this.smoke = scene.add.particles(0, 0, 'dot', { lifespan: 1400, speedY: { min: -70, max: -30 }, speedX: { min: -20, max: 20 }, scale: { start: 0.8, end: 2.2 }, alpha: { start: 0.45, end: 0 }, tint: 0x333340, frequency: 120, emitting: false }).setDepth(DEPTH.npc + 2);
    }
    this.syncPositions();
  }

  private drawForklift(): void {
    const g = this.forkGfx;
    g.clear();
    const w = this.width, h = this.height;
    // wheels
    g.fillStyle(0x1f2026, 1); g.fillCircle(-w / 2 + 28, -14, 22); g.fillCircle(w / 2 - 34, -14, 22);
    g.fillStyle(0x6b6f7a, 1); g.fillCircle(-w / 2 + 28, -14, 11); g.fillCircle(w / 2 - 34, -14, 11);
    // chassis
    g.fillStyle(0x2c1a0e, 1); g.fillRoundedRect(-w / 2 + 4, -h + 4, w - 8, h - 22, 10);
    g.fillStyle(0xf7c948, 1); g.fillRoundedRect(-w / 2 + 8, -h + 8, w - 16, h - 30, 8);
    g.fillStyle(0x2c1a0e, 0.85); g.fillRoundedRect(-w / 2 + 14, -h + 14, 44, 26, 5); // seat back
    // warning stripes
    g.fillStyle(0x2c1a0e, 1); for (let i = 0; i < 5; i++) g.fillRect(-w / 2 + 12 + i * 26, -30, 12, 8);
    // mast + forks (front = facing side), drawn pointing left; container scaleX flips
    g.fillStyle(0x2c1a0e, 1); g.fillRect(-w / 2 - 14, -h - 40, 12, h + 26);
    g.fillStyle(0x6b6f7a, 1); g.fillRect(-w / 2 - 11, -h - 38, 6, h + 22);
    g.fillStyle(0x2c1a0e, 1); g.fillRect(-w / 2 - 70, -h - 6, 60, 8); g.fillRect(-w / 2 - 70, -h + 10, 60, 8);
    g.fillStyle(0x9a9aa6, 1); g.fillRect(-w / 2 - 68, -h - 4, 56, 4); g.fillRect(-w / 2 - 68, -h + 12, 56, 4);
    // exhaust pipe
    g.fillStyle(0x2c1a0e, 1); g.fillRect(w / 2 - 26, -h - 22, 10, 26);
    // headlight
    g.fillStyle(0xfff1a8, 1); g.fillCircle(-w / 2 + 2, -h + 34, 7);
  }

  private syncPositions(): void {
    const x = this.root.x, y = this.root.y;
    this.root.setScale(this.facing === -1 ? 1 : -1, 1);
    this.root.setRotation(this.reducedMotion ? 0 : this.tilt);
    this.rig.setPosition(x + 10 * -this.facing, y - 44);
    this.rig.setFacing(this.facing);
    this.trophy.setPosition(-this.width / 2 - 40, -this.height - 12);
    this.alert.setPosition(x, y - 190);
    this.stompZone.setPosition(x, y - this.height - 30);
    this.stompBody.reset(x, y - this.height - 30);
    this.exhaust?.setPosition(x + (this.width / 2 - 22) * -this.facing, y - this.height - 24);
    this.smoke?.setPosition(x, y - this.height);
  }

  bubbleAnchor(): { x: number; y: number; flip: boolean } { return { x: this.rig.x, y: this.rig.y - 90, flip: this.facing === -1 }; }

  /** Begin the fight (player entered the arena). */
  start(): void {
    if (this.state !== 'idle') return;
    this.state = 'intro';
    this.timer = 1800;
  }

  get deadly(): boolean { return this.state === 'charge' || this.state === 'telegraph' || this.state === 'recover' || this.state === 'lob'; }
  get stunned(): boolean { return this.state === 'stunned'; }
  get defeated(): boolean { return this.state === 'defeated'; }

  /** Player landed on the hood while stunned. */
  stomp(): boolean {
    if (this.state !== 'stunned' || this.scene.time.now < this.invulnUntil) return false;
    this.hp--;
    this.invulnUntil = this.scene.time.now + 600;
    this.rig.playHurt();
    this.stompBody.enable = false;
    this.events.emit('hit', this.hp);
    if (this.hp <= 0) {
      this.state = 'defeated';
      this.timer = 0;
      this.body.enable = false;
      this.smoke?.start();
      this.exhaust?.stop();
      this.scene.tweens.add({ targets: this.trophy, y: this.trophy.y + 90, x: this.trophy.x - 40, angle: 160, duration: 900, ease: 'Bounce.easeOut' });
      this.events.emit('defeated');
      return true;
    }
    this.phase = 4 - this.hp;
    this.events.emit('phaseChanged', this.phase);
    this.state = 'recover';
    this.timer = 1600;
    return true;
  }

  update(dt: number, playerX: number): void {
    const dtMs = dt * 1000;
    for (let i = this.crates.length - 1; i >= 0; i--) if (!this.updateCrate(this.crates[i], dt)) this.crates.splice(i, 1);
    if (this.state === 'idle' || this.state === 'defeated') {
      if (this.state === 'defeated') this.tilt = Phaser.Math.Linear(this.tilt, -0.12 * this.facing, Math.min(1, dt * 3));
      this.rig.animate(dt, 0, 0, true, null);
      this.syncPositions();
      return;
    }
    this.timer -= dtMs;
    switch (this.state) {
      case 'intro':
        this.face(playerX);
        if (this.timer <= 0) this.beginTelegraph(playerX);
        break;
      case 'telegraph': {
        this.face(playerX);
        const k = 1 - Math.max(0, this.timer) / this.telegraphMs();
        this.tilt = Math.sin(k * 40) * 0.03;
        if (this.timer <= 0) {
          this.alert.setVisible(false);
          if (this.pendingLob) { this.lob(playerX); this.pendingLob = false; }
          else { this.state = 'charge'; this.chargeSpeed = 520 + this.phase * 90; this.targetX = this.facing === -1 ? this.arena.left + 30 : this.arena.right - 30; this.exhaust?.start(); this.events.emit('charge'); }
        }
        break;
      }
      case 'charge': {
        this.tilt = -0.06 * this.facing;
        const nx = this.root.x + this.chargeSpeed * dt * this.facing;
        const reached = this.facing === -1 ? nx <= this.targetX : nx >= this.targetX;
        this.root.setX(reached ? this.targetX : nx);
        if (reached) {
          this.exhaust?.stop();
          this.state = 'stunned';
          this.timer = this.phase === 3 ? 2000 : 2800;
          this.stompBody.enable = true;
          this.tilt = 0.1 * this.facing;
          this.alert.setText('✦').setVisible(true);
          this.events.emit('wallHit');
        }
        break;
      }
      case 'stunned':
        this.tilt = Phaser.Math.Linear(this.tilt, 0, Math.min(1, dt * 2));
        if (this.timer <= 0) { this.stompBody.enable = false; this.alert.setVisible(false); this.state = 'recover'; this.timer = 700; this.chargesLeft = this.phase === 3 ? 1 : 0; }
        break;
      case 'lob':
        if (this.timer <= 0) { this.state = 'recover'; this.timer = 600; }
        break;
      case 'recover':
        this.tilt = Phaser.Math.Linear(this.tilt, 0, Math.min(1, dt * 4));
        this.face(playerX);
        if (this.timer <= 0) {
          if (this.chargesLeft > 0) { this.chargesLeft--; this.beginTelegraph(playerX, false, 450); }
          else this.beginTelegraph(playerX, this.phase >= 2 && Math.random() < 0.5);
        }
        break;
    }
    this.rig.animate(dt, this.state === 'charge' ? 200 * this.facing : 0, 0, true, null);
    this.syncPositions();
  }

  private pendingLob = false;
  private telegraphDuration = 900;
  private telegraphMs(): number { return this.telegraphDuration; }

  private face(playerX: number): void { this.facing = playerX < this.root.x ? -1 : 1; }

  private beginTelegraph(playerX: number, lob = false, ms?: number): void {
    this.face(playerX);
    this.pendingLob = lob;
    this.telegraphDuration = ms ?? (this.phase === 3 ? 650 : 900);
    this.timer = this.telegraphDuration;
    this.state = 'telegraph';
    this.alert.setText(lob ? '↑' : '!').setVisible(true).setScale(0.6);
    this.scene.tweens.add({ targets: this.alert, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    if (!lob) this.exhaust?.start();
    this.events.emit('telegraph', lob ? 'lob' : 'charge');
  }

  private lob(playerX: number): void {
    this.state = 'lob';
    this.timer = 900;
    const count = this.phase === 3 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const tx = Phaser.Math.Clamp(playerX + (i - (count - 1) / 2) * 110, this.arena.left + 40, this.arena.right - 40);
      this.spawnCrate(this.root.x, this.root.y - this.height - 20, tx, 1000 + i * 120);
    }
  }

  /** Crate that follows a parabola from (x,y) to land at targetX on the floor after flightMs. */
  private spawnCrate(x: number, y: number, targetX: number, flightMs: number): void {
    const t = flightMs / 1000;
    const g = 1500;
    const vx = (targetX - x) / t;
    const vy = ((this.arena.floorY - y) - 0.5 * g * t * t) / t;
    const go = this.scene.add.container(x, y).setDepth(DEPTH.objects + 3);
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0x2c1a0e, 1); gfx.fillRect(-20, -20, 40, 40);
    gfx.fillStyle(0xf7c948, 1); gfx.fillRect(-17, -17, 34, 34);
    gfx.fillStyle(0x2c1a0e, 0.8); gfx.fillRect(-17, -2, 34, 3); gfx.fillRect(-2, -17, 3, 34);
    gfx.fillStyle(0x2c1a0e, 1); gfx.fillEllipse(0, 0, 18, 8); gfx.fillStyle(0xffe58a, 1); gfx.fillEllipse(0, -1, 12, 4);
    go.add(gfx);
    const shadow = this.scene.add.ellipse(targetX, this.arena.floorY - 3, 46, 14, 0x000000, 0.12).setDepth(DEPTH.objects + 1);
    this.crates.push({ go, shadow, x, y, vx, vy, landed: false, age: 0 });
  }

  private updateCrate(c: Crate, dt: number): boolean {
    c.age += dt;
    if (!c.landed) {
      c.vy += 1500 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.go.setPosition(c.x, c.y).setRotation(c.age * 4);
      const k = Phaser.Math.Clamp(1 - (this.arena.floorY - c.y) / 300, 0.2, 1);
      c.shadow.setAlpha(0.12 + k * 0.4).setScale(0.6 + k * 0.5);
      if (c.y >= this.arena.floorY - 20) {
        c.landed = true; c.age = 0;
        c.go.setPosition(c.x, this.arena.floorY - 20).setRotation(0);
        c.shadow.setAlpha(0.25);
        this.events.emit('crateLand', c.x, this.arena.floorY);
      }
      return true;
    }
    if (c.age > 1.2) { c.go.destroy(); c.shadow.destroy(); return false; }
    c.go.setAlpha(1 - Math.max(0, c.age - 0.6) / 0.6);
    return true;
  }

  /** Crate currently deadly (airborne) overlapping a rect? */
  crateHits(left: number, right: number, top: number, bottom: number): boolean {
    for (const c of this.crates) {
      if (c.landed) continue;
      if (c.x + 18 > left && c.x - 18 < right && c.y + 18 > top && c.y - 18 < bottom) return true;
    }
    return false;
  }

  onSpeak(): void { this.rig.impulse(0.95, 1.08, 100); }

  snapshot(): { reset: true } { return { reset: true }; }
  /** Deaths restart the encounter from scratch. */
  restore(): void {
    for (const c of this.crates) { c.go.destroy(); c.shadow.destroy(); }
    this.crates = [];
    this.state = 'idle'; this.hp = 3; this.phase = 1; this.timer = 0; this.chargesLeft = 0; this.pendingLob = false; this.tilt = 0;
    this.facing = -1;
    this.root.setX(this.startX).setY(this.arena.floorY);
    this.body.enable = true;
    this.stompBody.enable = false;
    this.alert.setVisible(false);
    this.exhaust?.stop(); this.smoke?.stop();
    this.scene.tweens.killTweensOf(this.trophy);
    this.trophy.setPosition(-this.width / 2 - 40, -this.height - 12).setAngle(0);
    this.syncPositions();
  }

  destroy(): void {
    this.events.removeAllListeners();
    for (const c of this.crates) { c.go.destroy(); c.shadow.destroy(); }
    this.exhaust?.destroy(); this.smoke?.destroy();
    this.alert.destroy(); this.stompZone.destroy(); this.rig.destroy(); this.root.destroy();
  }
}
