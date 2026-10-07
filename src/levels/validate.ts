import type { LevelData, LevelObjectDef } from './types';
import { TILE_LEGEND } from './types';

export interface ValidationIssue { level: 'error' | 'warning'; message: string; }

/** Pure, side-effect free validation used by unit tests and the dev overlay. */
export function validateLevel(data: LevelData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string) => issues.push({ level: 'error', message });
  const warn = (message: string) => issues.push({ level: 'warning', message });
  const rows = data.tiles.length;
  if (rows === 0) { err('level has no tile rows'); return issues; }
  const cols = data.tiles[0].length;
  if (cols === 0) err('first tile row is empty');
  data.tiles.forEach((row, y) => {
    if (row.length !== cols) err(`row ${y} has length ${row.length}, expected ${cols}`);
    for (const ch of row) if (!(ch in TILE_LEGEND)) err(`row ${y}: unknown tile character '${ch}'`);
  });
  const count = (ch: string) => data.tiles.reduce((n, row) => n + row.split('').filter((c) => c === ch).length, 0);
  const spawns = count('P');
  if (spawns !== 1) err(`expected exactly one spawn 'P', found ${spawns}`);
  const flags = count('F');
  if (!data.boss && flags !== 1) err(`expected exactly one flag 'F' (or boss: true), found ${flags}`);
  if (data.boss && flags > 0) warn('boss level also contains a flag');
  // spawn must stand on something
  for (let y = 0; y < rows; y++) {
    const x = data.tiles[y].indexOf('P');
    if (x >= 0) {
      const below = data.tiles[y + 1]?.[x];
      if (below !== '#' && below !== '=') warn(`spawn at (${x},${y}) has no ground directly below`);
    }
  }
  const ids = new Map<string, number>();
  const bounds = (o: LevelObjectDef) => {
    const w = 'w' in o && typeof o.w === 'number' ? o.w : 1;
    const h = 'h' in o && typeof o.h === 'number' ? o.h : 1;
    if (o.x < 0 || o.y < 0 || o.x + w > cols || o.y + h > rows) err(`${o.type}${'id' in o && o.id ? ' ' + o.id : ''} at (${o.x},${o.y}) is out of bounds`);
  };
  for (const o of data.objects) {
    bounds(o);
    if ('id' in o && o.id) ids.set(o.id, (ids.get(o.id) ?? 0) + 1);
    if (o.type === 'moving-platform' && o.path.length < 1) err(`moving-platform at (${o.x},${o.y}) needs at least one path point`);
    if (o.type === 'moving-platform' && o.speed <= 0) err(`moving-platform at (${o.x},${o.y}) needs speed > 0`);
    if (o.type === 'fleeing-banana' && o.path.length < 1) err(`fleeing-banana ${o.id} needs at least one hop point`);
    if (o.type === 'fleeing-flag' && (o.fleeTo.x < 0 || o.fleeTo.y < 0 || o.fleeTo.x >= cols || o.fleeTo.y >= rows)) err(`fleeing-flag ${o.id} flees out of bounds`);
    if (o.type === 'wind' && o.force === 0) warn(`wind ${o.id ?? ''} has zero force`);
  }
  for (const [id, n] of ids) if (n > 1) err(`duplicate object id '${id}' (${n})`);
  const gateIds = new Set(data.objects.filter((o) => o.type === 'gate').map((o) => (o as { id: string }).id));
  for (const o of data.objects) {
    if (o.type === 'switch') for (const t of o.targets) if (!gateIds.has(t)) err(`switch ${o.id} targets unknown gate '${t}'`);
  }
  if (count('C') === 0) warn('level has no checkpoints');
  return issues;
}

export function assertValid(data: LevelData): void {
  const errors = validateLevel(data).filter((i) => i.level === 'error');
  if (errors.length) throw new Error(`Level '${data.id}' invalid:\n` + errors.map((e) => ' - ' + e.message).join('\n'));
}
