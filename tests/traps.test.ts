import { describe, expect, it } from 'vitest';
import { SnapshotRegistry } from '../src/gameplay/world/SnapshotRegistry';
import { TrapStateMachine } from '../src/gameplay/traps/TrapStateMachine';

describe('TrapStateMachine', () => {
  it('walks idle → warning → active → cooldown → idle on timers', () => {
    const calls: string[] = [];
    const t = new TrapStateMachine({ warningMs: 100, activeMs: 200, cooldownMs: 300 }, {
      onWarning: () => calls.push('warn'), onActivate: () => calls.push('act'), onCooldown: () => calls.push('cool'), onIdle: () => calls.push('idle'),
    });
    expect(t.trigger()).toBe(true);
    expect(t.state).toBe('warning');
    expect(t.trigger()).toBe(false);
    t.update(99); expect(t.state).toBe('warning');
    t.update(1); expect(t.state).toBe('active');
    expect(t.progress()).toBe(0);
    t.update(100); expect(t.progress()).toBeCloseTo(0.5);
    t.update(100); expect(t.state).toBe('cooldown');
    t.update(300); expect(t.state).toBe('idle');
    expect(calls).toEqual(['warn', 'act', 'cool', 'idle']);
    expect(t.triggerCount).toBe(1);
  });
  it('skips warning when warningMs is 0 and stays spent for one-shot traps', () => {
    const t = new TrapStateMachine({ warningMs: 0, activeMs: 50, cooldownMs: 0, oneShot: true });
    t.trigger();
    expect(t.state).toBe('active');
    t.update(50);
    expect(t.state).toBe('spent');
    expect(t.trigger()).toBe(false);
    t.reset();
    expect(t.state).toBe('idle');
    expect(t.trigger()).toBe(true);
  });
  it('holds an infinite active phase until reset', () => {
    const t = new TrapStateMachine({ warningMs: 0, activeMs: Infinity, cooldownMs: 0 });
    t.trigger(); t.update(1e9);
    expect(t.state).toBe('active');
    t.reset(); expect(t.state).toBe('idle');
  });
  it('slows down with timeScale (assist mode) without changing the sequence', () => {
    const t = new TrapStateMachine({ warningMs: 100, activeMs: 100, cooldownMs: 100 });
    t.timeScale = 2;
    t.trigger(); t.update(100); expect(t.state).toBe('warning'); t.update(100); expect(t.state).toBe('active');
  });
  it('delivers the first-time joke once and keeps it across resets, and snapshots exactly', () => {
    const t = new TrapStateMachine({ warningMs: 100, activeMs: 100, cooldownMs: 100 });
    expect(t.deliverJoke()).toBe(true);
    expect(t.deliverJoke()).toBe(false);
    t.trigger(); t.update(30);
    const snap = t.snapshot();
    t.update(500);
    expect(t.state).toBe('idle');
    t.restore(snap);
    expect(t.state).toBe('warning');
    expect(t.timer).toBe(70);
    expect(t.jokeDelivered).toBe(true);
    t.reset();
    expect(t.jokeDelivered).toBe(true);
    t.reset(true);
    expect(t.jokeDelivered).toBe(false);
  });
});

describe('SnapshotRegistry', () => {
  it('captures a baseline and restores every registered object to it', () => {
    const reg = new SnapshotRegistry();
    const a = { v: 1, snapshot() { return { v: this.v }; }, restore(s: { v: number }) { this.v = s.v; } };
    const b = { items: [1, 2], snapshot() { return { items: [...this.items] }; }, restore(s: { items: number[] }) { this.items = [...s.items]; } };
    reg.register('a', a); reg.register('b', b);
    expect(reg.restore()).toBe(false);
    reg.capture();
    a.v = 99; b.items.push(3);
    expect(reg.restore()).toBe(true);
    expect(a.v).toBe(1);
    expect(b.items).toEqual([1, 2]);
  });
  it('clones snapshots so later mutation cannot corrupt the baseline', () => {
    const reg = new SnapshotRegistry();
    const obj = { data: { n: 1 }, snapshot() { return this.data; }, restore(s: { n: number }) { this.data = s; } };
    reg.register('o', obj);
    reg.capture();
    obj.data.n = 5;
    reg.restore();
    expect(obj.data.n).toBe(1);
  });
  it('rejects duplicate ids and ignores unregistered entries on restore', () => {
    const reg = new SnapshotRegistry();
    const o = { snapshot() { return 1; }, restore() { /* noop */ } };
    reg.register('x', o);
    expect(() => reg.register('x', o)).toThrow();
    const snap = reg.capture();
    reg.unregister('x');
    expect(reg.restore(snap)).toBe(true);
  });
});
