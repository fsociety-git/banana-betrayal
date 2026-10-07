import type { LevelData } from './types';
import { level1 } from './level1';
import { testRoom } from './testRoom';

export const LEVELS: Record<string, LevelData> = {
  [level1.id]: level1,
  [testRoom.id]: testRoom,
};

/** Campaign order (the test room is dev-only). */
export const CAMPAIGN: string[] = ['level1'];

export function getLevel(id: string): LevelData {
  const level = LEVELS[id];
  if (!level) throw new Error(`Unknown level '${id}'`);
  return level;
}
