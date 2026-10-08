/** Contact flags Arcade reports after a step. `blocked` comes only from real collisions with static world. */
export interface Blocked { up: boolean; down: boolean; left: boolean; right: boolean; }

/**
 * Squashed between solids: pressed from above while standing on solid ground, pinned from both sides, or carried by
 * a platform ride into a solid ceiling. Overlap zones (triggers, the forklift hood) never count: Arcade raises
 * `touching.*` for those too, which is why touching flags are deliberately not consulted here.
 */
export function isCrushed(blocked: Blocked, riding: boolean): boolean {
  return (blocked.up && blocked.down) || (blocked.left && blocked.right) || (blocked.up && riding);
}
