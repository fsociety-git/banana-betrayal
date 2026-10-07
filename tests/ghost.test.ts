import { describe, expect, it } from 'vitest';
import { levelHash } from '../src/levels/hash';
import { level1 } from '../src/levels/level1';
import { migrateSave } from '../src/core/save/schema';

describe('ghost compatibility', () => {
  it('level hash is stable for identical data and changes when the layout changes', () => {
    const h1 = levelHash(level1);
    expect(levelHash({ ...level1 })).toBe(h1);
    const changed = { ...level1, tiles: [...level1.tiles.slice(0, -1), level1.tiles[level1.tiles.length - 1].replace('#', '.')] };
    expect(levelHash(changed)).not.toBe(h1);
    const movedObject = { ...level1, objects: level1.objects.map((o, i) => (i === 0 ? { ...o, x: o.x + 1 } : o)) };
    expect(levelHash(movedObject)).not.toBe(h1);
  });
  it('rejects ghost recordings whose frame array is not a multiple of four', () => {
    const out = migrateSave({ version: 1, ghosts: { l1: { levelId: 'l1', levelHash: 'h', frames: [1, 2, 3, 4, 5], sampleMs: 50 } } });
    expect(out.ghosts.l1).toBeUndefined();
  });
});
