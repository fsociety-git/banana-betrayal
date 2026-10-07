import { describe, expect, it } from 'vitest';
import { DialoguePolicy } from '../src/gameplay/dialogue/DialoguePolicy';
import { BonkController, bonkHitBox, overlaps } from '../src/gameplay/interact/Bonk';
import { InteractionManager } from '../src/gameplay/interact/InteractionManager';

describe('BonkController', () => {
  it('fires once, then waits out the cooldown', () => {
    const b = new BonkController(450, 120);
    expect(b.trigger(1000)).toBe(true);
    expect(b.isActive(1050)).toBe(true);
    expect(b.isActive(1200)).toBe(false);
    expect(b.trigger(1300)).toBe(false); // still cooling down
    expect(b.canBonk(1450)).toBe(true);
    expect(b.trigger(1450)).toBe(true);
    b.reset();
    expect(b.canBonk(1451)).toBe(true);
  });

  it('hit box is short, in front of the player, and flips with facing', () => {
    const right = bonkHitBox(100, 400, 1, 82);
    const left = bonkHitBox(100, 400, -1, 82);
    expect(right.left).toBeGreaterThan(100);
    expect(right.right - right.left).toBeLessThanOrEqual(70);
    expect(left.right).toBeLessThan(100);
    expect(overlaps(right, { left: 150, right: 190, top: 320, bottom: 400 })).toBe(true);
    expect(overlaps(left, { left: 150, right: 190, top: 320, bottom: 400 })).toBe(false);
    // something far away or much higher never counts
    expect(overlaps(right, { left: 300, right: 340, top: 320, bottom: 400 })).toBe(false);
    expect(overlaps(right, { left: 150, right: 190, top: 100, bottom: 200 })).toBe(false);
  });
});

describe('DialoguePolicy', () => {
  it('enforces the global gap and the per-line repeat window', () => {
    const p = new DialoguePolicy();
    expect(p.canSay('a', 0)).toBe(true);
    p.record('a', 0, 2000);
    expect(p.canSay('b', 1000)).toBe(false); // still on screen
    expect(p.canSay('b', 2500)).toBe(true);  // gap passed (1800) and channel free
    p.record('b', 2500, 1000);
    expect(p.canSay('a', 5000)).toBe(false); // 'a' repeated within 15s
    expect(p.canSay('a', 15001)).toBe(true);
  });

  it('once lines fire a single time until reset', () => {
    const p = new DialoguePolicy();
    expect(p.canSay('intro', 0, { once: true })).toBe(true);
    p.record('intro', 0, 1000, { once: true });
    expect(p.canSay('intro', 60000, { once: true })).toBe(false);
    p.resetOnce();
    expect(p.canSay('intro', 60000, { once: true })).toBe(true);
  });

  it('suppresses non-priority lines while airborne, but not warnings', () => {
    const p = new DialoguePolicy();
    p.airborne = true;
    expect(p.canSay('tease', 0)).toBe(false);
    expect(p.canSay('warn', 0, { priority: true })).toBe(true);
  });

  it('priority lines interrupt and may repeat after a short guard', () => {
    const p = new DialoguePolicy();
    p.record('x', 0, 4000);
    expect(p.canSay('bonk-react', 100, { priority: true })).toBe(true);
    p.record('bonk-react', 100, 2000);
    expect(p.canSay('bonk-react', 300, { priority: true })).toBe(false); // 400ms guard
    expect(p.canSay('bonk-react', 600, { priority: true })).toBe(true);
  });

  it('stops taunting when the budget is spent, and cancel frees the channel', () => {
    const p = new DialoguePolicy();
    p.tauntBudget = 0;
    expect(p.canSay('tease', 0, { taunt: true })).toBe(false);
    expect(p.canSay('hint', 0)).toBe(true);
    p.record('hint', 0, 5000);
    expect(p.canSay('other', 2000)).toBe(false);
    p.cancel();
    expect(p.canSay('other', 2000)).toBe(true);
  });
});

describe('InteractionManager', () => {
  it('exposes the highest-priority available action and rate-limits runs', () => {
    const m = new InteractionManager();
    const ran: string[] = [];
    let talkAvailable = true;
    m.register({ id: 'callout', label: 'DUKKAR!', priority: 1, available: () => true, run: () => ran.push('callout') });
    m.register({ id: 'talk', label: 'Talk', priority: 2, available: () => talkAvailable, run: () => ran.push('talk') });
    const seen: (string | null)[] = [];
    m.onChange = (a) => seen.push(a ? a.id : null);
    m.update();
    expect(m.current?.id).toBe('talk');
    expect(m.onInteract(1000)).toBe(true);
    expect(m.onInteract(1200)).toBe(false); // cooldown
    talkAvailable = false;
    m.update();
    expect(m.current?.id).toBe('callout');
    expect(m.onInteract(2000)).toBe(true);
    expect(ran).toEqual(['talk', 'callout']);
    m.unregister('callout');
    m.update();
    expect(m.current).toBeNull();
    expect(seen).toEqual(['talk', 'callout', null]);
  });
});
