import Phaser from 'phaser';
import type { DeathCause } from '../../content/script';
import { SIGNS } from '../../content/script';
import { TILE } from '../../core/constants';
import type { LevelData, LevelObjectDef, ParsedLevel } from '../../levels/types';
import { BubbleSpawner } from '../objects/BubbleSpawner';
import { Conveyor } from '../objects/Conveyor';
import { HazardRect } from '../objects/HazardRect';
import { MovingPlatform } from '../objects/MovingPlatform';
import { PigNPC } from '../objects/PigNPC';
import { Gate, Switch } from '../objects/SwitchGate';
import { WindZone } from '../objects/WindZone';
import type { Player } from '../player/Player';
import { BananaMachine } from '../traps/BananaMachine';
import { Coconut } from '../traps/Coconut';
import { CollapsingBridge } from '../traps/CollapsingBridge';
import { CrocPlatform } from '../traps/CrocPlatform';
import { CrumbleCloud } from '../traps/CrumbleCloud';
import { Crusher } from '../traps/Crusher';
import { FleeingBanana } from '../traps/FleeingBanana';
import { SinkingPlatform } from '../traps/SinkingPlatform';
import { placeDecor } from './Decor';
import type { Resettable, SnapshotRegistry } from './SnapshotRegistry';
import type { ThemePalette } from './themes';

/** Everything an object needs from the scene, without reaching into it. */
export interface WorldContext {
  scene: Phaser.Scene;
  palette: ThemePalette;
  level: ParsedLevel;
  data: LevelData;
  player: Player;
  snapshots: SnapshotRegistry;
  rng: Phaser.Math.RandomDataGenerator;
  hazardTimeScale: number;
  reducedMotion: boolean;
  kill(cause: DeathCause): void;
  say(key: string, once: boolean, speaker?: 'pig' | 'caption'): void;
  sfx(name: Parameters<import('../../core/audio/AudioEngine').AudioEngine['play']>[0], intensity?: number, minGapMs?: number): void;
  shake(intensity: number, ms: number): void;
  debris(x: number, y: number, n: number): void;
  sparkle(x: number, y: number, n: number): void;
  setDeathContext(cause: DeathCause, ms: number): void;
  /** Take one banana from the player's count (processing fee). Returns false if they have none. */
  spendBanana(): boolean;
  toast(text: string, ms?: number): void;
  groundBelow(x: number, y: number): number | null;
  onFlagFlee(fleeTo: { x: number; y: number }): void;
  /** The player notices a nearby trap arming (head perks up). */
  playerAlert(x: number): void;
  /** Something heavy landed (falling objects): nearby NPCs flinch. */
  onImpact?(x: number): void;
}

interface BlowSign { gfx: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone; blown: boolean; x: number; y: number; }

/**
 * Builds and owns every data-driven level object, wires their physics against the player and drives their
 * per-frame updates. GameScene stays in charge of the player, checkpoints, bananas, the flag and the UI.
 */
export class LevelWorld {
  platforms: MovingPlatform[] = [];
  sinking: SinkingPlatform[] = [];
  bubbles: BubbleSpawner[] = [];
  crocs: CrocPlatform[] = [];
  conveyors: Conveyor[] = [];
  crushers: Crusher[] = [];
  switches: Switch[] = [];
  gates = new Map<string, Gate>();
  winds: WindZone[] = [];
  crumbles: CrumbleCloud[] = [];
  fallers: Coconut[] = [];
  machines: BananaMachine[] = [];
  hazards: HazardRect[] = [];
  bridges: CollapsingBridge[] = [];
  fleeing: FleeingBanana[] = [];
  pigs: PigNPC[] = [];
  /** Signs placed with an id (so encounters/reactions can find and remove them). */
  signs = new Map<string, { gfx: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; x: number; y: number; key: string }>();
  blowSigns: BlowSign[] = [];
  decor: Phaser.GameObjects.GameObject[] = [];
  zones: Phaser.GameObjects.Zone[] = [];
  private peels = new Map<string, HazardRect>();
  private ctx: WorldContext;
  private pendingSwitchTargets: { sw: Switch; targets: string[] }[] = [];

  constructor(ctx: WorldContext) { this.ctx = ctx; }

  build(objects: LevelObjectDef[]): void {
    for (const o of objects) this.buildOne(o);
    for (const { sw, targets } of this.pendingSwitchTargets) {
      sw.onToggle = (pressed) => {
        this.ctx.sfx('switch', 1, 100);
        for (const id of targets) { const g = this.gates.get(id); if (g) g.setOpen(pressed ? !g.initiallyOpen : g.initiallyOpen); }
      };
    }
  }

  private buildOne(o: LevelObjectDef): void {
    const { scene, palette: p, rng } = this.ctx;
    const px = o.x * TILE, py = o.y * TILE;
    const foot = { x: px + TILE / 2, y: py + TILE };
    const ts = this.ctx.hazardTimeScale;
    switch (o.type) {
      case 'moving-platform': {
        const mp = new MovingPlatform(scene, px + (o.w * TILE) / 2, py + 10, o.w, o.path, o.speed, o.pauseMs ?? 300, p);
        this.platforms.push(mp); this.ctx.snapshots.register(`mp-${o.id ?? `${o.x},${o.y}`}`, mp);
        break;
      }
      case 'sign': {
        if (o.blowAway) this.addBlowSign(foot.x, foot.y, SIGNS[o.text] ?? o.text, o.id ?? `sign-${o.x}-${o.y}`);
        else {
          const parts = this.addSign(foot.x, foot.y, SIGNS[o.text] ?? o.text);
          this.decor.push(...parts);
          if (o.id) this.signs.set(o.id, { gfx: parts[0] as Phaser.GameObjects.Graphics, text: parts[1] as Phaser.GameObjects.Text, x: foot.x, y: foot.y, key: o.text });
        }
        break;
      }
      case 'pig': this.pigs.push(new PigNPC(scene, foot.x, foot.y, o.pose ?? 'idle', o.flip ?? false, o.id)); break;
      case 'encounter': break; // built by EncounterManager (needs the scene-level host)
      case 'dialogue-trigger': {
        const zone = this.zone(px + (o.w * TILE) / 2, py + (o.h * TILE) / 2, o.w * TILE, o.h * TILE);
        scene.physics.add.overlap(this.ctx.player.proxy, zone, () => this.ctx.say(o.line, o.once ?? true, o.speaker ?? 'pig'));
        break;
      }
      case 'fleeing-banana': {
        const fb = new FleeingBanana(scene, o.id, foot.x, py + TILE / 2, o.path);
        fb.onJoke = () => this.ctx.say('l1-banana-flee', true, 'pig');
        fb.onHop = () => this.ctx.sfx('whoosh', 0.8, 200);
        fb.onGiveUp = () => this.ctx.say('l1-banana-gaveup', true, 'pig');
        this.fleeing.push(fb); this.ctx.snapshots.register(`fleeing-${o.id}`, fb);
        break;
      }
      case 'collapsing-bridge': {
        const bridge = new CollapsingBridge(scene, o.id, o.x, o.y, o.w, o.delayMs ?? 350, o.stepMs ?? 230, p);
        bridge.machine.timeScale = ts;
        bridge.onWarn = () => { this.ctx.sfx('warning', 0.7, 300); this.ctx.playerAlert((o.x + o.w / 2) * TILE); };
        bridge.onPlankFall = (x, y) => { this.ctx.sfx('collapse', 0.6, 90); this.ctx.debris(x, y, 4); this.ctx.shake(0.002, 90); };
        this.bridges.push(bridge); this.ctx.snapshots.register(`bridge-${o.id}`, bridge);
        break;
      }
      case 'coconut':
      case 'falling-object': {
        const groundY = this.ctx.groundBelow(foot.x, py + TILE) ?? this.ctx.level.heightPx;
        const kind = o.type === 'coconut' ? 'coconut' : (o.kind ?? 'crate');
        const id = o.id ?? `fall-${o.x}-${o.y}`;
        const f = new Coconut(scene, id, o.x, o.y, o.triggerWidth ?? 3, groundY, kind);
        f.machine.timeScale = ts;
        f.onWarn = () => { this.ctx.sfx('warning', 0.8, 300); this.ctx.playerAlert(foot.x); };
        f.onLand = (x, y) => { this.ctx.sfx(kind === 'anvil' ? 'slam' : 'impact', 0.9, 120); this.ctx.debris(x, y, 8); this.ctx.shake(0.004, 160); this.ctx.onImpact?.(x); if (kind === 'coconut') this.ctx.say('l1-coconut-fell', true, 'pig'); };
        this.fallers.push(f); this.ctx.snapshots.register(`faller-${id}`, f);
        break;
      }
      case 'fleeing-flag': {
        const zone = this.zone(px + (o.w * TILE) / 2, py + (o.h * TILE) / 2, o.w * TILE, o.h * TILE);
        const fleeTo = { x: o.fleeTo.x * TILE + TILE / 2, y: (o.fleeTo.y + 1) * TILE };
        scene.physics.add.overlap(this.ctx.player.proxy, zone, () => this.ctx.onFlagFlee(fleeTo));
        break;
      }
      case 'sinking-platform': {
        const sp = new SinkingPlatform(scene, o.id ?? `sink-${o.x}-${o.y}`, px + (o.w * TILE) / 2, py + 10, o.w, o.sinkDepth ?? 90, o.warnMs ?? 650, p);
        sp.machine.timeScale = ts;
        sp.onWarn = () => { this.ctx.sfx('warning', 0.5, 250); this.ctx.playerAlert(sp.x); };
        sp.onSink = () => this.ctx.sfx('splash', 0.5, 200);
        this.sinking.push(sp); this.ctx.snapshots.register(`sink-${sp.id}`, sp);
        break;
      }
      case 'bubble-spawner': {
        const bs = new BubbleSpawner(scene, o.id ?? `bubbles-${o.x}-${o.y}`, foot.x, py + TILE / 2, o.intervalMs ?? 2600, o.liftHeight ?? 6);
        bs.onPop = (x, y) => { this.ctx.sfx('pop', 0.6, 80); this.ctx.sparkle(x, y, 4); };
        bs.onSpawn = () => this.ctx.sfx('bubble', 0.4, 300);
        this.bubbles.push(bs);
        break;
      }
      case 'croc-platform': {
        const c = new CrocPlatform(scene, o.id ?? `croc-${o.x}-${o.y}`, px + (o.w * TILE) / 2, py + 6, o.w, o.cycleMs ?? 3600, o.openMs ?? 1800, o.phase ?? 0, p);
        c.timeScale = ts;
        c.onWarn = () => this.ctx.sfx('warning', 0.5, 250);
        c.onSnap = () => this.ctx.sfx('slam', 0.5, 200);
        this.crocs.push(c); this.ctx.snapshots.register(`croc-${c.id}`, c);
        break;
      }
      case 'conveyor': this.conveyors.push(new Conveyor(scene, o.id ?? `belt-${o.x}-${o.y}`, px + (o.w * TILE) / 2, py, o.w, o.speed, p)); break;
      case 'crusher': {
        const c = new Crusher(scene, o.id ?? `crusher-${o.x}-${o.y}`, foot.x, py + TILE / 2, o.drop ?? 3, o.cycleMs ?? 3000, o.phase ?? 0, p);
        c.timeScale = ts;
        c.onWarn = () => this.ctx.sfx('warning', 0.45, 200);
        c.onSlam = (x, y) => { this.ctx.sfx('slam', 0.8, 150); this.ctx.debris(x, y, 5); this.ctx.shake(0.003, 120); };
        this.crushers.push(c); this.ctx.snapshots.register(`crusher-${c.id}`, c);
        break;
      }
      case 'switch': {
        const sw = new Switch(scene, o.id, foot.x, foot.y, o.once ?? false, p);
        this.switches.push(sw); this.ctx.snapshots.register(`switch-${o.id}`, sw);
        this.pendingSwitchTargets.push({ sw, targets: o.targets });
        break;
      }
      case 'gate': {
        const g = new Gate(scene, o.id, px, py, o.w, o.h, o.open ?? false, p);
        this.gates.set(o.id, g); this.ctx.snapshots.register(`gate-${o.id}`, g);
        break;
      }
      case 'wind': this.winds.push(new WindZone(scene, o.id ?? `wind-${o.x}-${o.y}`, px, py, o.w * TILE, o.h * TILE, o.force, this.ctx.reducedMotion)); break;
      case 'crumble':
      case 'doubting-cloud': {
        const doubting = o.type === 'doubting-cloud';
        const id = o.id ?? `crumble-${o.x}-${o.y}`;
        const c = new CrumbleCloud(scene, id, px + (o.w * TILE) / 2, py + 10, o.w, doubting ? 1500 : (o.type === 'crumble' ? (o.crumbleMs ?? 450) : 450), doubting ? 2600 : (o.type === 'crumble' ? (o.respawnMs ?? 2200) : 2200), doubting, p);
        c.machine.timeScale = ts;
        c.onWarn = () => { this.ctx.sfx('crumble', 0.35, 250); this.ctx.playerAlert(px); };
        c.onCrumble = (x, y) => { this.ctx.sfx('crumble', 0.8, 100); this.ctx.sparkle(x, y, 10); };
        if (doubting) c.onJoke = () => this.ctx.say('l4-cloud', true, 'pig');
        this.crumbles.push(c); this.ctx.snapshots.register(`crumble-${id}`, c);
        break;
      }
      case 'banana-machine': {
        const m = new BananaMachine(scene, o.id, foot.x, foot.y, p);
        m.onReceipt = () => this.ctx.sfx('receipt', 1, 0);
        m.onUse = () => {
          const paid = this.ctx.spendBanana();
          this.ctx.toast(paid ? 'Processing fee: one banana (−1 🍌)' : 'Processing fee: one banana (you had none — fee waived, Dukkar displeased)', 3200);
          this.ctx.say('l3-machine', true, 'pig');
        };
        m.onDispense = (x, y) => { this.ctx.sfx('pop', 1, 0); this.spawnPeel(o.id, x + 48, y + 44); this.ctx.say('l3-fee', true, 'pig'); };
        this.machines.push(m);
        const self = this;
        const wrapper: Resettable<{ used: boolean }> = {
          snapshot: () => m.snapshot(),
          restore: (s) => { m.restore(s); if (!s.used) self.removePeel(o.id); },
        };
        this.ctx.snapshots.register(`machine-${o.id}`, wrapper);
        break;
      }
      case 'peel': this.addHazard(o.id ?? `peel-${o.x}-${o.y}`, px, py, TILE, TILE, 'peel'); break;
      case 'hazard-rect': this.addHazard(o.id ?? `hz-${o.x}-${o.y}`, px, py, o.w * TILE, o.h * TILE, o.kind ?? 'spikes'); break;
      case 'decor': { const img = placeDecor(scene, o.kind, foot.x, foot.y + 4, p, rng); if (img) this.decor.push(img); break; }
      case 'boss-arena': case 'camera-hint': break; // handled elsewhere
      default: console.warn(`[level ${this.ctx.data.id}] object type '${(o as { type: string }).type}' is not implemented`);
    }
  }

  private addHazard(id: string, x: number, y: number, w: number, h: number, kind: 'spikes' | 'saw' | 'electric' | 'peel'): HazardRect {
    const hz = new HazardRect(this.ctx.scene, id, x, y, w, h, kind);
    this.hazards.push(hz);
    this.ctx.scene.physics.add.overlap(this.ctx.player.proxy, hz.hit, () => this.ctx.kill(hz.cause));
    return hz;
  }

  private spawnPeel(machineId: string, x: number, footY: number): void {
    this.removePeel(machineId);
    const hz = this.addHazard(`peel-${machineId}`, x - 24, footY - 34, 48, 34, 'peel');
    this.peels.set(machineId, hz);
  }
  private removePeel(machineId: string): void {
    const hz = this.peels.get(machineId);
    if (!hz) return;
    this.hazards = this.hazards.filter((h) => h !== hz);
    hz.destroy();
    this.peels.delete(machineId);
  }

  zone(cx: number, cy: number, w: number, h: number): Phaser.GameObjects.Zone {
    const z = this.ctx.scene.add.zone(cx, cy, w, h);
    this.ctx.scene.physics.add.existing(z, true);
    this.zones.push(z);
    return z;
  }

  pigById(id: string): PigNPC | undefined { return this.pigs.find((p) => p.id === id); }
  snapshotsRegister(id: string, target: Resettable): void { this.ctx.snapshots.register(id, target); }

  /** Public sign builder for encounters (returns [graphics, text]). */
  addSign(x: number, y: number, text: string): Phaser.GameObjects.GameObject[] {
    const { scene, palette: p } = this.ctx;
    const t = scene.add.text(0, 0, text, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '13px', color: '#2c1a0e', align: 'center', wordWrap: { width: 132 }, fontStyle: 'bold' }).setOrigin(0.5).setDepth(6);
    const bw = Math.max(110, t.width + 26), bh = t.height + 22;
    const boardBottom = y - 46, boardTop = boardBottom - bh;
    const tilt = ((x * 7919) % 5 - 2) * 0.012; // deterministic slight lean per sign
    t.setPosition(x, boardTop + bh / 2).setRotation(tilt);
    const g = scene.add.graphics().setDepth(5);
    // two posts with a cross brace
    g.fillStyle(p.outline, 1); g.fillRoundedRect(x - bw / 2 + 10, y - 46, 9, 46, 3); g.fillRoundedRect(x + bw / 2 - 19, y - 46, 9, 46, 3);
    g.fillStyle(p.plankDark, 1); g.fillRect(x - bw / 2 + 12, y - 44, 5, 42); g.fillRect(x + bw / 2 - 17, y - 44, 5, 42);
    g.fillStyle(p.outline, 1); g.fillRect(x - bw / 2 + 14, y - 22, bw - 28, 4);
    // board: outline, wood, grain, highlight, nails
    g.save(); g.translateCanvas(x, boardTop + bh / 2); g.rotateCanvas(tilt);
    g.fillStyle(p.outline, 1); g.fillRoundedRect(-bw / 2 - 4, -bh / 2 - 4, bw + 8, bh + 8, 9);
    g.fillStyle(p.plank, 1); g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
    g.fillStyle(p.plankDark, 0.35); for (let gy = -bh / 2 + 10; gy < bh / 2 - 6; gy += 9) g.fillRect(-bw / 2 + 8, gy, bw - 16, 1);
    g.fillStyle(p.plankDark, 0.8); g.fillRect(-bw / 2, bh / 2 - 5, bw, 5);
    g.fillStyle(0xffffff, 0.28); g.fillRect(-bw / 2 + 4, -bh / 2 + 3, bw - 8, 3);
    g.fillStyle(p.outline, 1); g.fillCircle(-bw / 2 + 8, -bh / 2 + 8, 2.2); g.fillCircle(bw / 2 - 8, -bh / 2 + 8, 2.2); g.fillCircle(-bw / 2 + 8, bh / 2 - 8, 2.2); g.fillCircle(bw / 2 - 8, bh / 2 - 8, 2.2);
    g.restore();
    // a tuft of grass at the base
    if (p.style === 'organic') { g.fillStyle(p.grassDark, 1); g.fillEllipse(x - bw / 2 + 12, y - 4, 16, 10); g.fillStyle(p.grass, 1); g.fillEllipse(x - bw / 2 + 16, y - 6, 10, 8); g.fillEllipse(x + bw / 2 - 12, y - 4, 14, 9); }
    return [g, t];
  }

  private addBlowSign(x: number, y: number, text: string, id: string): void {
    const [g, t] = this.addSign(x, y, text) as [Phaser.GameObjects.Graphics, Phaser.GameObjects.Text];
    const zone = this.zone(x, y - 60, 220, 120);
    const sign: BlowSign = { gfx: g, text: t, zone, blown: false, x, y };
    this.blowSigns.push(sign);
    const { scene } = this.ctx;
    scene.physics.add.overlap(this.ctx.player.proxy, zone, () => {
      if (sign.blown) return;
      sign.blown = true;
      this.ctx.sfx('whoosh', 1, 0);
      this.ctx.say('l4-sign', true, 'pig');
      scene.tweens.add({ targets: [g, t], x: '+=700', y: '-=260', angle: 540, alpha: 0.2, duration: 1600, ease: 'Quad.easeOut' });
    });
    this.ctx.snapshots.register(`blowsign-${id}`, {
      snapshot: () => ({ blown: sign.blown }),
      restore: (s: { blown: boolean }) => {
        sign.blown = s.blown;
        scene.tweens.killTweensOf([g, t]);
        if (!s.blown) { g.setPosition(0, 0).setAngle(0).setAlpha(1); t.setPosition(x, t.y).setAngle(0).setAlpha(1); }
      },
    } as Resettable);
  }

  /** Physics wiring against the player (call once after build). */
  wire(): void {
    const { scene, player } = this.ctx;
    const p = player.proxy;
    const fromAbove = (top: number, slack: number): boolean => player.body.velocity.y >= 0 && player.body.bottom - player.body.deltaY() <= top + slack;
    const rideables = [...this.platforms, ...this.sinking];
    scene.physics.add.collider(p, rideables, (_a, b) => {
      const r = b as MovingPlatform | SinkingPlatform;
      if (player.body.touching.down && r.body.touching.up) { player.ride = r; if (r instanceof SinkingPlatform) { r.stepOn(); this.ctx.setDeathContext('sinking', 1500); } }
    }, (_a, b) => fromAbove((b as MovingPlatform).body.top, 6));
    for (const bs of this.bubbles) {
      // bubbles are created over time; collide against the spawner's live array
      scene.physics.add.collider(p, bs.bubbles, (_a, b) => { const bub = b as unknown as MovingPlatform; if (player.body.touching.down) player.ride = bub; }, (_a, b) => fromAbove((b as unknown as MovingPlatform).body.top, 10));
    }
    for (const bridge of this.bridges) {
      scene.physics.add.collider(p, bridge.group, () => { if (player.body.touching.down) { bridge.stepOn(); this.ctx.setDeathContext('bridge', 1600); } }, (_a, b) => fromAbove(((b as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody).top, 4));
    }
    for (const f of this.fallers) {
      scene.physics.add.overlap(p, f.triggerZone, () => f.trigger());
      scene.physics.add.collider(f.sprite, this.ctxSolids(), () => f.land());
      scene.physics.add.overlap(p, f.sprite, () => { if (f.deadly) this.ctx.kill(f.kind === 'coconut' ? 'coconut' : 'falling-object'); });
    }
    for (const c of this.crocs) {
      scene.physics.add.collider(p, c.hit, () => { if (c.deadly) this.ctx.kill('croc'); }, () => !c.deadly && fromAbove(c.body.top, 4));
      scene.physics.add.overlap(p, c.hit, () => { if (c.deadly) this.ctx.kill('croc'); });
    }
    for (const belt of this.conveyors) {
      scene.physics.add.collider(p, belt.hit, () => { if (player.body.touching.down) player.externalVx = belt.speed; }, () => fromAbove(belt.body.top, 4));
    }
    for (const c of this.crushers) scene.physics.add.collider(p, c);
    for (const sw of this.switches) scene.physics.add.overlap(p, sw.zone, () => sw.touch());
    for (const g of this.gates.values()) scene.physics.add.collider(p, g.hit);
    for (const w of this.winds) scene.physics.add.overlap(p, w.zone, () => { player.externalVx = w.force; this.ctx.setDeathContext('wind', 900); });
    for (const c of this.crumbles) {
      scene.physics.add.collider(p, c.hit, () => { if (player.body.touching.down) { c.stepOn(); this.ctx.setDeathContext('cloud', 1600); } }, () => fromAbove(c.body.top, 4));
    }
    for (const m of this.machines) scene.physics.add.overlap(p, m.zone, () => m.use());
  }

  private ctxSolids(): Phaser.Physics.Arcade.StaticGroup { return (this.ctx as unknown as { solids: Phaser.Physics.Arcade.StaticGroup }).solids; }

  update(dt: number, timeMs: number): void {
    const dtMs = dt * 1000;
    for (const mp of this.platforms) mp.update(dt);
    for (const sp of this.sinking) sp.update(dtMs);
    for (const bs of this.bubbles) bs.update(dt);
    for (const c of this.crocs) c.update(dtMs);
    for (const belt of this.conveyors) belt.update(dt);
    for (const c of this.crushers) c.update(dtMs);
    for (const sw of this.switches) sw.update(dtMs);
    for (const w of this.winds) w.update(dt);
    for (const c of this.crumbles) c.update(dtMs);
    for (const f of this.fallers) f.update(dtMs);
    for (const h of this.hazards) h.update(dt);
    // Crushers move too fast per step for Arcade's overlap bias to resolve, so squash is detected directly:
    // deadly while slamming/holding whenever the block's underside cuts through the player's body.
    const pb = this.ctx.player.body;
    for (const c of this.crushers) {
      if (!c.deadly || !this.ctx.player.alive) continue;
      const b = c.body;
      const horizontal = pb.right > b.left + 4 && pb.left < b.right - 4;
      if (horizontal && pb.top < b.bottom - 10 && pb.bottom >= b.bottom - 2) this.ctx.kill('crush');
    }
    for (const b of this.bridges) b.update(dtMs);
    for (const f of this.fleeing) f.update(timeMs, this.ctx.player.x, this.ctx.player.feetY);
    for (const pig of this.pigs) pig.update(dt);
    if (this.ctx.player.crushed && this.ctx.player.alive) this.ctx.kill('crush');
  }

  /** Reset used when dying before any checkpoint baseline exists. */
  resetAll(): void {
    for (const mp of this.platforms) mp.resetToStart();
    for (const sp of this.sinking) sp.restore({ trap: { ...sp.machine.snapshot(), state: 'idle', timer: 0 }, y: 0 });
    for (const bs of this.bubbles) bs.reset();
    for (const c of this.crocs) c.restore({ t: 0 });
    for (const c of this.crushers) c.restore({ t: 0 });
    for (const sw of this.switches) sw.restore({ pressed: false });
    for (const g of this.gates.values()) g.restore({ open: g.initiallyOpen });
    for (const c of this.crumbles) c.restore({ trap: { ...c.machine.snapshot(), state: 'idle', timer: 0 } });
    for (const f of this.fallers) f.restore({ trap: { ...f.machine.snapshot(), state: 'idle', timer: 0 }, landed: false });
    for (const m of this.machines) { m.restore({ used: false }); this.removePeel(m.id); }
    for (const br of this.bridges) br.restore({ trap: { ...br.machine.snapshot(), state: 'idle', timer: 0 }, fallen: br.planks.map(() => false) });
    for (const f of this.fleeing) f.restore({ hopIndex: 0, collected: false, joked: f.snapshot().joked });
  }

  /** Bubbles are not snapshotted (they are transient); pop them on any respawn. */
  afterRestore(): void { for (const bs of this.bubbles) bs.reset(); }

  /** Trap state machines the reaction director watches ("That usually works."). */
  trapWatchers(): { id: string; state: () => string }[] {
    const out: { id: string; state: () => string }[] = [];
    for (const b of this.bridges) out.push({ id: b.id, state: () => b.machine.state });
    for (const f of this.fallers) out.push({ id: f.id, state: () => f.machine.state });
    for (const c of this.crumbles) out.push({ id: c.id, state: () => c.machine.state });
    for (const s of this.sinking) out.push({ id: s.id, state: () => s.machine.state });
    return out;
  }

  devStates(): string {
    const parts: string[] = [];
    for (const b of this.bridges) parts.push(`${b.id}:${b.machine.state}`);
    for (const f of this.fallers) parts.push(`${f.id}:${f.machine.state}`);
    for (const s of this.sinking) parts.push(`${s.id}:${s.machine.state}`);
    for (const c of this.crocs) parts.push(`${c.id}:${c.phase}`);
    for (const c of this.crushers) parts.push(`${c.id}:${c.phase}`);
    for (const c of this.crumbles) parts.push(`${c.id}:${c.machine.state}`);
    for (const s of this.switches) parts.push(`${s.id}:${s.pressed ? 'on' : 'off'}`);
    for (const m of this.machines) parts.push(`${m.id}:${m.used ? 'used' : 'ready'}`);
    return parts.join(' ') || '-';
  }

  destroy(): void {
    for (const pig of this.pigs) pig.destroy();
    for (const b of this.bridges) b.destroy();
    for (const f of this.fallers) f.destroy();
    for (const f of this.fleeing) f.destroy();
    for (const sp of this.sinking) sp.destroy();
    for (const bs of this.bubbles) bs.destroy();
    for (const c of this.crocs) c.destroy();
    for (const belt of this.conveyors) belt.destroy();
    for (const c of this.crushers) c.destroy();
    for (const sw of this.switches) sw.destroy();
    for (const g of this.gates.values()) g.destroy();
    for (const w of this.winds) w.destroy();
    for (const c of this.crumbles) c.destroy();
    for (const m of this.machines) m.destroy();
    for (const h of this.hazards) h.destroy();
    for (const s of this.blowSigns) { this.ctx.scene.tweens.killTweensOf([s.gfx, s.text]); s.gfx.destroy(); s.text.destroy(); }
    for (const mp of this.platforms) mp.destroy();
    for (const z of this.zones) z.destroy();
    for (const d of this.decor) d.destroy();
    this.peels.clear();
  }
}
