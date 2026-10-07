import type { LevelData } from './types';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { level4 } from './level4';
import { level5 } from './level5';
import { testRoom } from './testRoom';

export const LEVELS: Record<string, LevelData> = {
  [level1.id]: level1,
  [level2.id]: level2,
  [level3.id]: level3,
  [level4.id]: level4,
  [level5.id]: level5,
  [testRoom.id]: testRoom,
};

/** Campaign order (the test room is dev-only). */
export const CAMPAIGN: string[] = ['level1', 'level2', 'level3', 'level4', 'level5'];

export function getLevel(id: string): LevelData {
  const level = LEVELS[id];
  if (!level) throw new Error(`Unknown level '${id}'`);
  return level;
}
