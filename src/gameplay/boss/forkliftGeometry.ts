import { PLAYER_TUNING } from '../../core/constants';

/** The forklift's drawn size, its collision box and the hood (stomp) zone, all relative to the chassis centre x and floor y. */
export const FORKLIFT = {
  width: 150, height: 90,
  bodyW: 130, bodyH: 80, bodyLift: 2,
  hoodW: 110, hoodH: 40, hoodRaise: 30,
  /** Upward velocity given to the player after a successful stomp. */
  bounceVy: -560,
  /** After a stomp the chassis cannot hurt the player for this long: it covers the bounce landing on a recovering forklift. */
  stompGraceMs: 900,
} as const;

export interface Rect { left: number; right: number; top: number; bottom: number; }

/** Collision box: centred on x whichever way the forklift faces; never derived from the flipped container. */
export function forkliftBody(x: number, floorY: number): Rect {
  const bottom = floorY - FORKLIFT.bodyLift;
  return { left: x - FORKLIFT.bodyW / 2, right: x + FORKLIFT.bodyW / 2, top: bottom - FORKLIFT.bodyH, bottom };
}

/** Hood zone the player must fall into to land a stomp; sits entirely above the collision box. */
export function forkliftHood(x: number, floorY: number): Rect {
  const cy = floorY - FORKLIFT.height - FORKLIFT.hoodRaise;
  return { left: x - FORKLIFT.hoodW / 2, right: x + FORKLIFT.hoodW / 2, top: cy - FORKLIFT.hoodH / 2, bottom: cy + FORKLIFT.hoodH / 2 };
}

/** Time in ms before feet launched from `feetY` with the stomp bounce come back down to `y` (Infinity if never). */
export function bounceReturnMs(feetY: number, y: number): number {
  const g = PLAYER_TUNING.gravity, v = FORKLIFT.bounceVy;
  // y(t) = feetY + v t + g t² / 2  →  solve y(t) = y for the later root
  const a = g / 2, b = v, c = feetY - y;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  return t * 1000;
}
