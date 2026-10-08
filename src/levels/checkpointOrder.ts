import type { Point } from './types';

/**
 * Checkpoints are scanned out of the tile grid top-to-bottom, which is not the order a player meets them: an
 * elevated post after a climb would be indexed before a ground post that comes earlier on the route. Every level
 * runs left to right, so progression order is ascending x (lower post first on a tie).
 */
export function orderCheckpoints<T extends Point>(points: T[]): T[] {
  return [...points].sort((a, b) => a.x - b.x || b.y - a.y);
}

export interface CheckpointLike { index: number; reached: boolean; activate(): void; }

/**
 * Activating a post also marks every earlier post as reached, so backtracking can never move the spawn backwards.
 * Returns false when the post was already reached (nothing changes, nothing is redrawn).
 */
export function activateCheckpoint(posts: CheckpointLike[], post: CheckpointLike): boolean {
  if (post.reached) return false;
  for (const other of posts) if (other.index < post.index) other.reached = true;
  post.activate();
  return true;
}
