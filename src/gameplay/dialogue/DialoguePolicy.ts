/**
 * Pure scheduling rules for Dukkar's dialogue (unit-tested):
 *  - global minimum gap between lines, - no key repeats within a window, - `once` keys fire a single time,
 *  - non-priority lines wait while a line is still on screen, - non-priority lines are suppressed while the player
 *    is airborne (no text during precision jumps), - taunts stop after repeated failures (taunt budget).
 */
export interface SayOptions { once?: boolean; force?: boolean; priority?: boolean; taunt?: boolean; }

export class DialoguePolicy {
  minGapMs = 1800;
  repeatWindowMs = 15000;
  priorityGuardMs = 400;
  private lastSpokeAt = -Infinity;
  private busyUntil = -Infinity;
  private lastByKey = new Map<string, number>();
  private firedOnce = new Set<string>();
  airborne = false;
  /** Number of taunts still allowed; 0 = Dukkar has gone quiet. */
  tauntBudget = Infinity;

  canSay(key: string, now: number, opts: SayOptions = {}): boolean {
    if (opts.once && this.firedOnce.has(key)) return false;
    if (opts.taunt && this.tauntBudget <= 0) return false;
    if (opts.force) return true;
    const last = this.lastByKey.get(key);
    // priority lines (scripted payoffs, warnings, bonk reactions) interrupt and may repeat, with a short guard
    if (opts.priority) return last === undefined || now - last >= this.priorityGuardMs;
    if (this.airborne) return false;
    if (now < this.busyUntil) return false;
    if (now - this.lastSpokeAt < this.minGapMs) return false;
    if (last !== undefined && now - last < this.repeatWindowMs) return false;
    return true;
  }

  record(key: string, now: number, durationMs: number, opts: SayOptions = {}): void {
    this.lastSpokeAt = now;
    this.busyUntil = now + durationMs;
    this.lastByKey.set(key, now);
    if (opts.once) this.firedOnce.add(key);
    if (opts.taunt && Number.isFinite(this.tauntBudget)) this.tauntBudget--;
  }

  /** A line was cut short (death, scene change): free the channel immediately. */
  cancel(): void { this.busyUntil = -Infinity; }
  hasFired(key: string): boolean { return this.firedOnce.has(key); }
  resetOnce(): void { this.firedOnce.clear(); this.lastByKey.clear(); }
}
