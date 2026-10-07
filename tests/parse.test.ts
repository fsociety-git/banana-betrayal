import { describe, expect, it } from 'vitest';
import { mergeCells, parseLevel } from '../src/levels/parse';
import type { LevelData } from '../src/levels/types';

const mk = (tiles: string[], extra: Partial<LevelData> = {}): LevelData => ({
  id: 't', name: 't', subtitle: '', theme: 'test', tiles, objects: [], ...extra,
});

describe('mergeCells', () => {
  it('merges horizontal runs and stacks identical rows into one rectangle', () => {
    const grid = [
      ['solid', 'solid', 'empty'],
      ['solid', 'solid', 'empty'],
      ['empty', 'solid', 'solid'],
    ];
    const rects = mergeCells(grid, (v) => v === 'solid', 10);
    expect(rects).toEqual([
      { x: 0, y: 0, w: 20, h: 20 },
      { x: 10, y: 20, w: 20, h: 10 },
    ]);
  });
  it('returns nothing for an empty grid', () => {
    expect(mergeCells([], () => true)).toEqual([]);
  });
});

describe('parseLevel', () => {
  it('extracts spawn, checkpoints, bananas and flag at the floor of their cells', () => {
    const level = parseLevel(mk(['P.C.B.F', '#######']), 10);
    expect(level.cols).toBe(7);
    expect(level.widthPx).toBe(70);
    expect(level.spawn).toEqual({ x: 5, y: 10 });
    expect(level.checkpoints).toEqual([{ x: 25, y: 10, id: 'cp1', index: 0 }]);
    expect(level.bananas).toEqual([{ x: 45, y: 5 }]);
    expect(level.flag).toEqual({ x: 65, y: 10 });
    expect(level.solids).toEqual([{ x: 0, y: 10, w: 70, h: 10 }]);
  });
  it('separates one-way planks, spikes and water', () => {
    const level = parseLevel(mk(['==^~']), 10);
    expect(level.oneWays).toEqual([{ x: 0, y: 0, w: 20, h: 10 }]);
    expect(level.spikes).toEqual([{ x: 20, y: 0, w: 10, h: 10 }]);
    expect(level.water).toEqual([{ x: 30, y: 0, w: 10, h: 10 }]);
    expect(level.flag).toBeNull();
  });
});
