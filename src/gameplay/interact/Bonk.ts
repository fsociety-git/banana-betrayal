/** Pure timing for the bonk: short active window, brief cooldown, no stacking. */
export class BonkController {
  cooldownMs: number;
  activeMs: number;
  private lastAt = -Infinity;
  constructor(cooldownMs = 450, activeMs = 120) { this.cooldownMs = cooldownMs; this.activeMs = activeMs; }
  canBonk(now: number): boolean { return now - this.lastAt >= this.cooldownMs; }
  /** Returns true if a new bonk started. */
  trigger(now: number): boolean {
    if (!this.canBonk(now)) return false;
    this.lastAt = now;
    return true;
  }
  isActive(now: number): boolean { return now - this.lastAt < this.activeMs; }
  /** 0..1 progress of the active swing (for visuals). */
  progress(now: number): number { return Math.min(1, Math.max(0, (now - this.lastAt) / this.activeMs)); }
  reset(): void { this.lastAt = -Infinity; }
}

export interface Bounds { left: number; right: number; top: number; bottom: number; }

/** Something Makad can bonk. Gameplay collision uses these bounds, never the exaggerated visuals. */
export interface Bonkable {
  bonkBounds(): Bounds | null;
  /** Return true if the bonk did something (plays the hit burst). */
  onBonk(fromX: number): boolean;
}

/** Hit box in front of the player: short, clear range in the facing direction. */
export function bonkHitBox(x: number, feetY: number, facing: 1 | -1, bodyHeight: number): Bounds {
  const near = x + facing * 14, far = x + facing * 74;
  return { left: Math.min(near, far), right: Math.max(near, far), top: feetY - bodyHeight - 6, bottom: feetY + 4 };
}

export function overlaps(a: Bounds, b: Bounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
