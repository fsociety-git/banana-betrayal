import { describe, expect, it } from 'vitest';
import { PLAYER_TUNING } from '../src/core/constants';
import { FORKLIFT, bounceReturnMs, forkliftBody, forkliftHood } from '../src/gameplay/boss/forkliftGeometry';

const FLOOR = 440;

describe('forklift collision geometry', () => {
  it('the collision box is centred on the chassis whichever way it faces, and sits on the floor', () => {
    for (const x of [6430, 7340, 7530]) {
      const b = forkliftBody(x, FLOOR);
      expect((b.left + b.right) / 2).toBeCloseTo(x);
      expect(b.right - b.left).toBe(FORKLIFT.bodyW);
      expect(b.bottom).toBeLessThanOrEqual(FLOOR);
      expect(b.bottom - b.top).toBe(FORKLIFT.bodyH);
      // the old dynamic body on the flipped container landed 140 px beside and 45 px above the chassis
      expect(Math.abs(b.left - (x - FORKLIFT.bodyW / 2))).toBeLessThan(1);
      expect(b.top).toBeGreaterThan(FLOOR - FORKLIFT.height);
    }
  });

  it('the hood (stomp zone) is entirely above the collision box, so a landed stomp never starts inside it', () => {
    const b = forkliftBody(6430, FLOOR), h = forkliftHood(6430, FLOOR);
    expect(h.bottom).toBeLessThan(b.top);
    expect(h.left).toBeGreaterThanOrEqual(b.left);
    expect(h.right).toBeLessThanOrEqual(b.right);
  });

  it('a stomp from the top of the hood is reachable with a normal jump', () => {
    const h = forkliftHood(6430, FLOOR);
    const apex = (PLAYER_TUNING.jumpVelocity * PLAYER_TUNING.jumpVelocity) / (2 * PLAYER_TUNING.gravity);
    expect(FLOOR - apex).toBeLessThan(h.bottom); // feet can get above the hood's lower edge
  });

  it('the bounce lifts the player clear of the chassis, and the grace outlasts the bounce coming back down', () => {
    const b = forkliftBody(6430, FLOOR), h = forkliftHood(6430, FLOOR);
    // launched from the lowest point of the hood, feet rise well above the chassis…
    const apex = h.bottom - (FORKLIFT.bounceVy * FORKLIFT.bounceVy) / (2 * PLAYER_TUNING.gravity);
    expect(apex).toBeLessThan(b.top - 60);
    // …and come back to chassis height only after a measurable flight that the grace window covers
    const back = bounceReturnMs(h.bottom, b.top);
    expect(back).toBeGreaterThan(500);
    expect(FORKLIFT.stompGraceMs).toBeGreaterThan(back);
  });
});
