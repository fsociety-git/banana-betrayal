import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels';
import type { LevelData } from '../src/levels/types';
import { validateLevel } from '../src/levels/validate';

const base = (over: Partial<LevelData> = {}): LevelData => ({
  id: 'v', name: 'v', subtitle: '', theme: 'test',
  tiles: ['P..C..F', '#######'], objects: [], ...over,
});
const errors = (d: LevelData) => validateLevel(d).filter((i) => i.level === 'error').map((i) => i.message);

describe('validateLevel', () => {
  it('accepts a minimal valid level', () => {
    expect(errors(base())).toEqual([]);
  });
  it('rejects ragged rows and unknown characters', () => {
    const e = errors(base({ tiles: ['P..C..F', '####', '#######?'] }));
    expect(e.some((m) => m.includes('length'))).toBe(true);
    expect(e.some((m) => m.includes("unknown tile character '?'"))).toBe(true);
  });
  it('requires exactly one spawn and one flag unless it is a boss level', () => {
    expect(errors(base({ tiles: ['...C..F', '#######'] }))).toContainEqual(expect.stringContaining('spawn'));
    expect(errors(base({ tiles: ['P..C...', '#######'] }))).toContainEqual(expect.stringContaining('flag'));
    expect(errors(base({ tiles: ['P..C...', '#######'], boss: true }))).toEqual([]);
  });
  it('flags out-of-bounds objects, duplicate ids and dangling switch targets', () => {
    const e = errors(base({ objects: [
      { type: 'sign', x: 40, y: 0, text: 'far' },
      { type: 'coconut', x: 1, y: 0, id: 'dup' },
      { type: 'coconut', x: 2, y: 0, id: 'dup' },
      { type: 'switch', x: 3, y: 0, id: 'sw', targets: ['nope'] },
    ] }));
    expect(e).toContainEqual(expect.stringContaining('out of bounds'));
    expect(e).toContainEqual(expect.stringContaining("duplicate object id 'dup'"));
    expect(e).toContainEqual(expect.stringContaining("unknown gate 'nope'"));
  });
  it('warns when the spawn floats', () => {
    const w = validateLevel(base({ tiles: ['P..C..F', '.######'] })).filter((i) => i.level === 'warning');
    expect(w.some((i) => i.message.includes('no ground'))).toBe(true);
  });
  it('every shipped level validates without errors', () => {
    for (const level of Object.values(LEVELS)) expect({ id: level.id, errors: errors(level) }).toEqual({ id: level.id, errors: [] });
  });
});
