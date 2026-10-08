import { describe, expect, it } from 'vitest';
import { TILE } from '../src/core/constants';
import { CAMPAIGN, getLevel } from '../src/levels';
import { activateCheckpoint, orderCheckpoints } from '../src/levels/checkpointOrder';
import { parseLevel } from '../src/levels/parse';

/** A stand-in for CheckpointPost: activate() flips `reached` the way the real post does. */
function posts(level: ReturnType<typeof parseLevel>): { id: string; index: number; x: number; y: number; reached: boolean; activate(): void }[] {
  return level.checkpoints.map((c) => ({ id: c.id, index: c.index, x: c.x, y: c.y, reached: false as boolean, activate() { this.reached = true; } }));
}

describe('checkpoint progression', () => {
  it('orders posts by route position, lower post first on a tie, regardless of scan order', () => {
    const pts = [{ x: 300, y: 100 }, { x: 100, y: 500 }, { x: 300, y: 500 }, { x: 200, y: 500 }];
    expect(orderCheckpoints(pts).map((p) => `${p.x},${p.y}`)).toEqual(['100,500', '200,500', '300,500', '300,100']);
  });

  it('level 4: the elevated post after the climb comes AFTER the first ground post', () => {
    const level = parseLevel(getLevel('level4'));
    const G = level.spawn.y / TILE; // the spawn stands on the ground surface row
    const cells = level.checkpoints.map((c) => ({ col: Math.round((c.x - TILE / 2) / TILE), row: c.y / TILE - 1 }));
    expect(cells).toEqual([{ col: 44, row: G - 1 }, { col: 74, row: G - 13 }, { col: 98, row: G - 1 }, { col: 141, row: G - 1 }]);
    expect(level.checkpoints.map((c) => c.id)).toEqual(['cp1', 'cp2', 'cp3', 'cp4']);
    expect(level.checkpoints.map((c) => c.index)).toEqual([0, 1, 2, 3]);
  });

  it('every campaign level lists its checkpoints in ascending route order', () => {
    for (const id of CAMPAIGN) {
      const level = parseLevel(getLevel(id));
      for (let i = 1; i < level.checkpoints.length; i++) expect(level.checkpoints[i].x).toBeGreaterThan(level.checkpoints[i - 1].x);
    }
  });

  it('visiting level 4 posts in gameplay order activates each one in turn and never moves the spawn backwards', () => {
    const level = parseLevel(getLevel('level4'));
    const list = posts(level);
    const byX = (x: number): (typeof list)[number] => list.find((p) => Math.abs(p.x - x) < 1)!;
    const ground = byX(1780), elevated = byX(2980), third = byX(3940), last = byX(5660);
    let spawn = ground;
    const visit = (p: (typeof list)[number]): void => { if (activateCheckpoint(list, p)) spawn = p; };
    visit(ground);
    expect(ground.reached).toBe(true);
    expect(elevated.reached).toBe(false); // the bug: it used to be marked reached here and could never activate
    visit(elevated);
    expect(elevated.reached).toBe(true);
    expect(spawn).toBe(elevated);
    // backtracking to the ground post changes nothing
    visit(ground);
    expect(spawn).toBe(elevated);
    visit(third); visit(last);
    expect(spawn).toBe(last);
    expect(list.every((p) => p.reached)).toBe(true);
    // jumping straight to a later post marks the skipped ones as reached too (no stale earlier spawn)
    const fresh = posts(level);
    expect(activateCheckpoint(fresh, fresh[2])).toBe(true);
    expect(fresh.map((p) => p.reached)).toEqual([true, true, true, false]);
    expect(activateCheckpoint(fresh, fresh[0])).toBe(false);
  });
});
