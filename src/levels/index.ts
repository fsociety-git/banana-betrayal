import type { LevelData } from './types';
import { testRoom } from './testRoom';

export const LEVELS: Record<string, LevelData> = {
  [testRoom.id]: testRoom,
};

/** Campaign order (the test room is dev-only). */
export const CAMPAIGN: string[] = [];

export function getLevel(id: string): LevelData {
  const level = LEVELS[id];
  if (!level) throw new Error(`Unknown level '${id}'`);
  return level;
}
