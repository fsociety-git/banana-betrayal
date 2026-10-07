import type Phaser from 'phaser';
import type { SfxName } from '../../core/audio/sfx';
import type { ReplyChooser, ReplyOption } from '../../ui/ReplyChooser';
import type { SayOptions } from '../dialogue/DialoguePolicy';
import type { Bonkable } from '../interact/Bonk';
import type { ContextAction, InteractionManager } from '../interact/InteractionManager';
import type { Banana } from '../objects/Banana';
import type { PigNPC, PigPose } from '../objects/PigNPC';
import type { Player } from '../player/Player';
import type { LevelWorld } from '../world/LevelWorld';
import type { Resettable } from '../world/SnapshotRegistry';

/**
 * Every encounter walks the same explicit path:
 *   idle → anticipation (setup is visible, nothing has fired) → active (the gag is running) → payoff → complete.
 * Deaths and checkpoint restores snap back to idle or complete (never mid-gag); see `snapshot()`.
 */
export type EncounterState = 'idle' | 'anticipation' | 'active' | 'payoff' | 'complete';

/** What encounters are allowed to touch. GameScene implements this; nothing else reaches into the scene. */
export interface EncounterHost {
  scene: Phaser.Scene;
  player: Player;
  world: LevelWorld;
  reducedMotion: boolean;
  /** Dukkar speaks (through the shared, rate-limited dialogue manager). */
  say(pig: PigNPC, key: string, opts?: SayOptions): boolean;
  /** Makad's own short line (content key or text). */
  makad(keyOrText: string): void;
  caption(text: string, ms?: number): void;
  sfx(name: SfxName, intensity?: number, minGapMs?: number): void;
  shake(intensity: number, ms: number): void;
  debris(x: number, y: number, n: number): void;
  sparkle(x: number, y: number, n: number): void;
  confetti(x: number, y: number, n?: number): void;
  /** Create a locked bonus banana owned by an encounter (counted in the level total, snapshotted). */
  addBanana(x: number, y: number, id: string): Banana;
  spawnPig(x: number, y: number, pose: PigPose, flip: boolean, id: string): PigNPC;
  /** Unlock once; shows the toast only the first time ever. */
  achievement(id: string): void;
  interactions: InteractionManager;
  bonkables: Bonkable[];
  replies: ReplyChooser;
  setFlag(id: string): void;
  hasFlag(id: string): boolean;
  /** Fires when `banana` is collected (idempotent registration). */
  onBananaCollected(banana: Banana, fn: () => void): void;
}

export interface EncounterSnapshot { state: EncounterState; extra?: Record<string, unknown> }

export abstract class Encounter implements Resettable<EncounterSnapshot> {
  state: EncounterState = 'idle';
  readonly id: string;
  /** The Dukkar this encounter stages (if any); the scene uses it to keep generic reactions out of a running gag. */
  protected pig: PigNPC | null = null;
  involves(pig: PigNPC): boolean { return this.pig === pig; }
  get running(): boolean { return this.state === 'active' || this.state === 'payoff'; }
  protected host: EncounterHost;
  private timers: Phaser.Time.TimerEvent[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  private actionIds: string[] = [];
  /** Session memory (survives deaths, not reloads): the gag has played once, so repeats are shortened. */
  seenOnce = false;
  destroyed = false;

  constructor(host: EncounterHost, id: string) { this.host = host; this.id = id; }

  // ------------------------------------------------------------------ lifecycle hooks
  /** Create props, pigs, bananas. Called once. */
  abstract build(): void;
  /** Per-frame polling (player position checks). */
  update(_dt: number, _now: number): void {}
  /** Put every prop into the given resting state. Only 'idle' and 'complete' are ever restored. */
  protected abstract applyState(state: 'idle' | 'complete'): void;
  onPlayerDied(): void {}
  onPlayerRespawned(): void {}

  // ------------------------------------------------------------------ state
  protected setState(next: EncounterState): void { this.state = next; }

  /** Outcome details that must survive a checkpoint restore (e.g. which way the coconut went). */
  protected extraSnapshot(): Record<string, unknown> { return {}; }
  protected applyExtra(_extra: Record<string, unknown>): void {}

  /** Baselines never capture a gag mid-flight: anything unfinished restores to idle. */
  snapshot(): EncounterSnapshot { return { state: this.state === 'complete' ? 'complete' : 'idle', extra: this.extraSnapshot() }; }
  restore(s: EncounterSnapshot): void {
    this.cancelAll();
    const target = s.state === 'complete' ? 'complete' : 'idle';
    this.state = target;
    if (s.extra) this.applyExtra(s.extra);
    this.applyState(target);
  }
  /** Hard reset (death before any checkpoint): back to the untouched setup. */
  reset(): void { this.restore({ state: 'idle' }); }
  /** After build(): put props in their starting arrangement (encounters that begin complete keep that). */
  applyStateFromManager(): void { this.applyState(this.state === 'complete' ? 'complete' : 'idle'); }

  // ------------------------------------------------------------------ tracked timers / tweens / actions
  protected after(ms: number, fn: () => void): void {
    const t = this.host.scene.time.delayedCall(ms, () => { this.timers = this.timers.filter((x) => x !== t); if (!this.destroyed) fn(); });
    this.timers.push(t);
  }
  protected tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const t = this.host.scene.tweens.add(cfg);
    this.tweens.push(t);
    return t;
  }
  protected cancelAll(): void {
    for (const t of this.timers) t.remove(false);
    this.timers = [];
    for (const t of this.tweens) t.stop();
    this.tweens = [];
  }
  protected addAction(action: ContextAction): void { this.host.interactions.register(action); this.actionIds.push(action.id); }

  /** Horizontal range check against the player's feet position. */
  protected playerBetween(x0: number, x1: number, maxDy = 140, feetY?: number): boolean {
    const p = this.host.player;
    if (!p.alive) return false;
    if (feetY !== undefined && Math.abs(p.feetY - feetY) > maxDy) return false;
    return p.x >= x0 && p.x <= x1;
  }
  protected near(x: number, range: number, feetY?: number): boolean { return this.playerBetween(x - range, x + range, 140, feetY); }

  destroy(): void {
    this.destroyed = true;
    this.cancelAll();
    for (const id of this.actionIds) this.host.interactions.unregister(id);
    this.actionIds = [];
    this.onDestroy();
  }
  protected onDestroy(): void {}

  /** Convenience for the three-reply moments. */
  protected ask(title: string | null, options: ReplyOption[], onPick: (id: string | null) => void): void { this.host.replies.show(title, options, onPick); }
}
