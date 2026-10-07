/**
 * Deterministic trap lifecycle shared by every trap type:
 *   idle → (trigger) → warning → active → cooldown → idle (or stays `spent` for one-shot traps)
 * Timers are driven by `update(dt)`; nothing depends on wall-clock time, so checkpoint snapshots are exact.
 * Pure TypeScript — the Phaser-facing trap objects wrap it and react to the `on*` hooks.
 */
export type TrapState = 'idle' | 'warning' | 'active' | 'cooldown' | 'spent';

export interface TrapTiming {
  /** Anticipation time before the consequence (0 = immediate). */
  warningMs: number;
  /** How long the consequence lasts (Infinity = until reset). */
  activeMs: number;
  /** Recovery time before the trap can trigger again. */
  cooldownMs: number;
  /** One-shot traps go to `spent` after the active phase instead of recovering. */
  oneShot?: boolean;
}

export interface TrapHooks {
  onWarning?: () => void;
  onActivate?: () => void;
  onCooldown?: () => void;
  onIdle?: () => void;
  onSpent?: () => void;
}

export interface TrapSnapshot {
  state: TrapState;
  timer: number;
  jokeDelivered: boolean;
  triggerCount: number;
}

export class TrapStateMachine {
  state: TrapState = 'idle';
  /** Milliseconds remaining in the current phase. */
  timer = 0;
  /** Whether the first-time joke (dialogue/caption) has already been shown. Survives deaths by design. */
  jokeDelivered = false;
  triggerCount = 0;
  private timing: TrapTiming;
  private hooks: TrapHooks;
  /** Hazard-speed scaling for assist mode (>1 = slower cycles). Never below 1. */
  timeScale = 1;

  constructor(timing: TrapTiming, hooks: TrapHooks = {}) {
    this.timing = timing;
    this.hooks = hooks;
  }

  /** Attempt to trigger. Returns true if the trap left idle. */
  trigger(): boolean {
    if (this.state !== 'idle') return false;
    this.triggerCount++;
    if (this.timing.warningMs > 0) this.enter('warning', this.timing.warningMs);
    else this.enter('active', this.timing.activeMs);
    return true;
  }

  /** Force the trap back to idle (checkpoint reset). Joke flag is kept unless `forgetJoke`. */
  reset(forgetJoke = false): void {
    this.state = 'idle';
    this.timer = 0;
    if (forgetJoke) this.jokeDelivered = false;
    this.hooks.onIdle?.();
  }

  update(dtMs: number): void {
    if (this.state === 'idle' || this.state === 'spent') return;
    if (!Number.isFinite(this.timer)) return;
    this.timer -= dtMs / this.timeScale;
    // Carry leftover time into the next phase so long frames and big dt steps stay exact.
    let guard = 8;
    while (this.timer <= 0 && !this.isTerminal() && Number.isFinite(this.timer) && guard-- > 0) {
      const carry = -this.timer;
      switch (this.state as TrapState) {
        case 'warning': this.enter('active', this.timing.activeMs); break;
        case 'active':
          if (this.timing.oneShot) this.enter('spent', Infinity);
          else this.enter('cooldown', this.timing.cooldownMs);
          break;
        case 'cooldown': this.enter('idle', 0); break;
      }
      if (this.isTerminal() || !Number.isFinite(this.timer)) break;
      this.timer -= carry;
    }
  }

  private isTerminal(): boolean { return this.state === 'idle' || this.state === 'spent'; }

  /** Fraction (0..1) of the current phase elapsed, for warning/active visuals. */
  progress(): number {
    const total = this.state === 'warning' ? this.timing.warningMs : this.state === 'active' ? this.timing.activeMs : this.state === 'cooldown' ? this.timing.cooldownMs : 0;
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - this.timer / total));
  }

  /** Mark the joke shown; returns true only the first time. */
  deliverJoke(): boolean {
    if (this.jokeDelivered) return false;
    this.jokeDelivered = true;
    return true;
  }

  snapshot(): TrapSnapshot {
    return { state: this.state, timer: this.timer, jokeDelivered: this.jokeDelivered, triggerCount: this.triggerCount };
  }

  restore(s: TrapSnapshot): void {
    this.state = s.state;
    this.timer = s.timer;
    this.jokeDelivered = s.jokeDelivered;
    this.triggerCount = s.triggerCount;
    // re-fire the hook for the restored state so visuals match
    switch (s.state) {
      case 'idle': this.hooks.onIdle?.(); break;
      case 'warning': this.hooks.onWarning?.(); break;
      case 'active': this.hooks.onActivate?.(); break;
      case 'cooldown': this.hooks.onCooldown?.(); break;
      case 'spent': this.hooks.onSpent?.(); break;
    }
  }

  private enter(state: TrapState, ms: number): void {
    this.state = state;
    this.timer = ms;
    switch (state) {
      case 'warning': this.hooks.onWarning?.(); break;
      case 'active': this.hooks.onActivate?.(); break;
      case 'cooldown': this.hooks.onCooldown?.(); break;
      case 'idle': this.hooks.onIdle?.(); break;
      case 'spent': this.hooks.onSpent?.(); break;
    }
  }
}
