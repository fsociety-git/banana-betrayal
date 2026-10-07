import { LevelBuilder } from './builder';
import type { LevelData } from './types';

// Level 5 — The Oinkcident. 190 columns, 15 rows. Ground surface row 11. Ends in the boss arena.
const b = new LevelBuilder(190, 15);
const G = 11;

b.ground(0, 189, G);
// --- Section 0: lobby (cols 0-20)
b.spawn(4, G - 1);
b.bananas(9, G - 1, 3);
b.block(17, G - 1, 2, 1);
// --- Section 1: everything you learned, briskly (cols 21-70)
b.pit(23, 30, G); b.fill(23, 30, G + 1, G + 3, '#');           // belt bed
b.pit(34, 36, G, '^');
b.block(38, G - 3, 2, 1);
b.pit(41, 48, G); b.fill(41, 48, G + 2, G + 3, '#');           // saw pit
b.block(50, G - 1, 2, 1);
b.pit(53, 56, G);
b.block(58, G - 4, 3, 1); b.block(63, G - 6, 3, 1);
b.bananas(58, G - 6, 3); b.bananas(63, G - 8, 3);
b.checkpoint(70, G - 1);
// --- Section 2: the vault corridor (cols 72-120)
b.pit(75, 84, G); b.fill(75, 84, G + 1, G + 3, '#');
b.pit(88, 90, G, '^');
b.pit(96, 108, G);                                                // bottomless
b.block(99, G - 3, 2, 1); b.block(104, G - 5, 2, 1);
b.pit(112, 114, G, '^');
b.bananaArc(96, G - 3, 12, 3);
b.checkpoint(120, G - 1);
// --- Section 3: locked vault doors (cols 122-155)
b.pit(126, 131, G); b.fill(126, 131, G + 2, G + 3, '#');
b.block(144, G - 3, 2, 1);
b.pit(147, 149, G, '^');
b.checkpoint(155, G - 1);
// --- Section 4: boss arena (cols 160-189), walled
b.fill(159, 159, 0, G - 4, '#');      // arena wall with a doorway at the bottom
b.fill(189, 189, 0, G - 1, '#');
b.fill(160, 188, 0, 0, '#');

export const level5: LevelData = {
  id: 'level5',
  name: 'The Oinkcident',
  subtitle: 'Golden banana headquarters. Do not touch the forklift.',
  theme: 'hq',
  music: 'hq',
  introLine: 'l5-intro',
  parTimeMs: 260000,
  boss: true,
  tiles: b.build(),
  objects: [
    { type: 'sign', x: 8, y: G - 1, text: 'l5-hq' },
    { type: 'pig', x: 14, y: G - 1, id: 'pig-lobby', pose: 'manager', flip: true },
    { type: 'dialogue-trigger', x: 7, y: G - 4, w: 7, h: 4, id: 'd-intro', line: 'l5-intro', once: true },
    { type: 'conveyor', x: 23, y: G, w: 8, id: 'belt1', speed: -140 },
    { type: 'crusher', x: 26, y: G - 4, id: 'cr1', cycleMs: 2800, phase: 0, drop: 3 },
    { type: 'crusher', x: 29, y: G - 4, id: 'cr2', cycleMs: 2800, phase: 1400, drop: 3 },
    { type: 'hazard-rect', x: 41, y: G + 1, w: 8, h: 1, kind: 'saw', id: 'saws1' },
    { type: 'moving-platform', x: 42, y: G - 1, w: 2, id: 'cargo1', path: [{ x: 4, y: 0 }], speed: 140, pauseMs: 200 },
    { type: 'crumble', x: 53, y: G - 2, w: 2, id: 'cl1' },
    { type: 'wind', x: 56, y: 3, w: 12, h: 8, id: 'fan1', force: -70 },
    { type: 'decor', x: 55, y: G - 1, kind: 'gear' },
    { type: 'conveyor', x: 75, y: G, w: 10, id: 'belt2', speed: 170 },
    { type: 'crusher', x: 78, y: G - 4, id: 'cr3', cycleMs: 2400, phase: 0, drop: 3 },
    { type: 'crusher', x: 82, y: G - 4, id: 'cr4', cycleMs: 2400, phase: 1200, drop: 3 },
    { type: 'hazard-rect', x: 92, y: G - 1, w: 2, h: 1, kind: 'electric', id: 'zap1' },
    { type: 'moving-platform', x: 96, y: G - 1, w: 2, id: 'cargo2', path: [{ x: 0, y: -3 }, { x: 3, y: -3 }], speed: 120, pauseMs: 300 },
    { type: 'crumble', x: 108, y: G - 4, w: 2, id: 'cl2' },
    { type: 'switch', x: 124, y: G - 1, id: 'sw1', targets: ['vault1'], once: true },
    { type: 'moving-platform', x: 127, y: G - 1, w: 2, id: 'cargo3', path: [{ x: 3, y: 0 }], speed: 130, pauseMs: 250 },
    { type: 'gate', x: 134, y: G - 4, w: 1, h: 4, id: 'vault1' },
    { type: 'sign', x: 137, y: G - 1, text: 'l5-forklift' },
    { type: 'switch', x: 140, y: G - 1, id: 'sw2', targets: ['vault2', 'vault3'] },
    { type: 'gate', x: 151, y: G - 4, w: 1, h: 4, id: 'vault2' },
    { type: 'gate', x: 153, y: G - 4, w: 1, h: 4, id: 'vault3', open: true },
    { type: 'falling-object', x: 145, y: G - 7, id: 'crate1', kind: 'banana-crate', triggerWidth: 3 },
    { type: 'gate', x: 159, y: G - 3, w: 1, h: 3, id: 'arena-door', open: true },
    { type: 'boss-arena', x: 160, y: 1, w: 29, h: 10, id: 'arena' },
    { type: 'decor', x: 2, y: G - 1, kind: 'goldstack' }, { type: 'decor', x: 19, y: G - 1, kind: 'poster' }, { type: 'decor', x: 72, y: G - 1, kind: 'goldstack' },
    { type: 'decor', x: 118, y: G - 1, kind: 'poster' }, { type: 'decor', x: 157, y: G - 1, kind: 'goldstack' }, { type: 'decor', x: 165, y: G - 1, kind: 'goldstack' }, { type: 'decor', x: 183, y: G - 1, kind: 'poster' },
  ],
};
