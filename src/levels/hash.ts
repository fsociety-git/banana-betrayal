import type { LevelData } from './types';

/** Stable content hash of a level's layout; ghosts and records store it so stale recordings are discarded. */
export function levelHash(data: LevelData): string {
  const str = JSON.stringify({ t: data.tiles, o: data.objects });
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + '-' + str.length.toString(36);
}
