import { describe, expect, it } from 'vitest';
import { Encounter, type EncounterHost } from '../src/gameplay/encounters/Encounter';

/** Minimal fake of the scene services an encounter touches. */
function fakeHost(): { host: EncounterHost; timers: { ms: number; fn: () => void; removed: boolean }[]; tweens: { stopped: boolean }[] } {
  const timers: { ms: number; fn: () => void; removed: boolean }[] = [];
  const tweens: { stopped: boolean }[] = [];
  const scene = {
    time: { delayedCall: (ms: number, fn: () => void) => { const t = { ms, fn, removed: false, remove: () => { t.removed = true; } }; timers.push(t); return t; } },
    tweens: { add: () => { const t = { stopped: false, stop: () => { t.stopped = true; } }; tweens.push(t); return t; } },
  };
  const registered = new Map<string, unknown>();
  const host = {
    scene, player: { alive: true, x: 0, feetY: 0 }, reducedMotion: false,
    interactions: { register: (a: { id: string }) => registered.set(a.id, a), unregister: (id: string) => registered.delete(id) },
  } as unknown as EncounterHost;
  return { host, timers, tweens };
}

class Gag extends Encounter {
  applied: string[] = [];
  outcome = 'none';
  build(): void {}
  go(): void { this.setState('active'); this.after(500, () => { this.outcome = 'done'; this.setState('complete'); }); this.tween({}); }
  protected applyState(state: 'idle' | 'complete'): void { this.applied.push(state); }
  protected override extraSnapshot(): Record<string, unknown> { return { outcome: this.outcome }; }
  protected override applyExtra(extra: Record<string, unknown>): void { if (typeof extra.outcome === 'string') this.outcome = extra.outcome; }
}

describe('Encounter state machine', () => {
  it('never snapshots a gag mid-flight: unfinished states restore to idle', () => {
    const { host, timers, tweens } = fakeHost();
    const g = new Gag(host, 'g');
    g.go();
    expect(g.state).toBe('active');
    const snap = g.snapshot();
    expect(snap.state).toBe('idle');
    g.restore(snap);
    expect(g.state).toBe('idle');
    expect(g.applied).toEqual(['idle']);
    // the pending timer and tween were cancelled, so the old payoff can never fire
    expect(timers[0].removed).toBe(true);
    expect(tweens[0].stopped).toBe(true);
  });

  it('keeps a completed outcome across restores', () => {
    const { host, timers } = fakeHost();
    const g = new Gag(host, 'g');
    g.go();
    timers[0].fn(); // the payoff lands
    expect(g.state).toBe('complete');
    const snap = g.snapshot();
    expect(snap).toEqual({ state: 'complete', extra: { outcome: 'done' } });
    const g2 = new Gag(host, 'g');
    g2.restore(snap);
    expect(g2.state).toBe('complete');
    expect(g2.outcome).toBe('done');
    expect(g2.applied).toEqual(['complete']);
  });

  it('reset() returns to the untouched setup and timers do not fire after destroy', () => {
    const { host, timers } = fakeHost();
    const g = new Gag(host, 'g');
    g.go();
    g.reset();
    expect(g.state).toBe('idle');
    g.go();
    g.destroy();
    timers[1].fn(); // late callback after teardown must be ignored
    expect(g.outcome).toBe('none');
  });
});
