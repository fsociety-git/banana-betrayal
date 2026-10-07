import { LevelBuilder } from './builder';
import type { LevelData } from './types';

// Level 2 — Customer Support Swamp. 165 columns, 15 rows. Ground surface row 11.
const b = new LevelBuilder(165, 15);
const G = 11;

b.ground(0, 164, G);
// --- Section 0: the help desk (cols 0-22)
b.spawn(4, G - 1);
b.bananas(9, G - 1, 3);
b.block(19, G - 1, 2, 1);
// --- Section 1: sinking stepping stones (cols 23-46)
b.pit(24, 44, G, '~', 2);
b.bananaArc(27, G - 3, 4, 1);
b.bananaArc(37, G - 3, 4, 1);
b.checkpoint(47, G - 1);
// --- Section 2: bubbles up to the ledges (cols 49-77)
b.pit(52, 73, G, '~', 2);
b.block(58, G - 4, 2, 1);
b.block(65, G - 6, 2, 1);
b.block(71, G - 4, 2, 1);
b.bananas(58, G - 6, 2); b.bananas(65, G - 8, 2); b.bananas(71, G - 6, 2);
b.checkpoint(77, G - 1);
// --- Section 3: shortcut (crocs, low) vs. the long way (planks, high) (cols 79-114)
b.pit(82, 111, G, '~', 2);
b.block(79, G - 3, 2, 1);
b.block(86, G - 4, 2, 1);
b.block(91, G - 6, 2, 1);
b.plank(96, G - 6, 3);
b.block(101, G - 5, 2, 1);
b.block(106, G - 4, 2, 1);
b.bananas(86, G - 6, 2); b.bananas(91, G - 8, 2); b.bananas(96, G - 8, 3); b.bananas(101, G - 7, 2); b.bananas(106, G - 6, 2);
b.bananas(88, G - 1, 1); b.bananas(98, G - 1, 1); b.bananas(108, G - 1, 1); // bait on the croc route
b.checkpoint(115, G - 1);
// --- Section 4: everything at once (cols 118-150)
b.pit(122, 131, G, '~', 2);
b.pit(134, 143, G, '~', 2);
b.block(146, G - 2, 2, 2);
b.pit(149, 150, G, '^');
b.bananaArc(123, G - 3, 8, 2);
b.checkpoint(153, G - 1);
// --- Section 5: ticket closed (cols 154-164)
b.flag(160, G - 1);
b.bananas(156, G - 2, 3);

export const level2: LevelData = {
  id: 'level2',
  name: 'Customer Support Swamp',
  subtitle: 'Your jump is very important to us.',
  theme: 'swamp',
  music: 'swamp',
  introLine: 'l2-intro',
  parTimeMs: 200000,
  tiles: b.build(),
  objects: [
    { type: 'sign', x: 8, y: G - 1, text: 'l2-important' },
    { type: 'pig', x: 14, y: G - 1, id: 'pig-desk', pose: 'shack' },
    { type: 'dialogue-trigger', x: 9, y: G - 4, w: 7, h: 4, id: 'd-intro', line: 'l2-intro', once: true },
    { type: 'sign', x: 22, y: G - 1, text: 'l2-hold' },
    { type: 'dialogue-trigger', x: 21, y: G - 4, w: 4, h: 4, id: 'd-sink', line: 'l2-sink', once: true },
    { type: 'sinking-platform', x: 26, y: G, w: 2, id: 's1', sinkDepth: 90, warnMs: 650 },
    { type: 'sinking-platform', x: 31, y: G, w: 2, id: 's2', sinkDepth: 90, warnMs: 600 },
    { type: 'sinking-platform', x: 36, y: G, w: 2, id: 's3', sinkDepth: 90, warnMs: 550 },
    { type: 'sinking-platform', x: 41, y: G, w: 2, id: 's4', sinkDepth: 90, warnMs: 500 },
    { type: 'bubble-spawner', x: 54, y: G + 1, id: 'bub1', intervalMs: 2400, liftHeight: 6 },
    { type: 'bubble-spawner', x: 62, y: G + 1, id: 'bub2', intervalMs: 2600, liftHeight: 8 },
    { type: 'bubble-spawner', x: 68, y: G + 1, id: 'bub3', intervalMs: 2400, liftHeight: 7 },
    { type: 'sign', x: 80, y: G - 4, text: 'l2-shortcut' },
    { type: 'sign', x: 84, y: G - 1, text: 'l2-logs' },
    { type: 'pig', x: 81, y: G - 4, id: 'pig-shortcut', flip: true },
    { type: 'dialogue-trigger', x: 78, y: G - 7, w: 4, h: 4, id: 'd-shortcut', line: 'l2-shortcut', once: true },
    { type: 'croc-platform', x: 83, y: G, w: 3, id: 'c1', cycleMs: 4200, openMs: 2400, phase: 0 },
    { type: 'croc-platform', x: 88, y: G, w: 3, id: 'c2', cycleMs: 4200, openMs: 2400, phase: 1400 },
    { type: 'croc-platform', x: 93, y: G, w: 3, id: 'c3', cycleMs: 4200, openMs: 2400, phase: 2800 },
    { type: 'croc-platform', x: 98, y: G, w: 3, id: 'c4', cycleMs: 4200, openMs: 2400, phase: 700 },
    { type: 'croc-platform', x: 103, y: G, w: 3, id: 'c5', cycleMs: 4200, openMs: 2400, phase: 2100 },
    { type: 'croc-platform', x: 108, y: G, w: 3, id: 'c6', cycleMs: 4200, openMs: 2400, phase: 3500 },
    { type: 'dialogue-trigger', x: 86, y: G - 2, w: 6, h: 2, id: 'd-croc', line: 'l2-croc', once: true },
    { type: 'pig', x: 118, y: G - 1, id: 'pig-rescue' },
    { type: 'dialogue-trigger', x: 116, y: G - 4, w: 5, h: 4, id: 'd-rescue', line: 'l2-rescue', once: true },
    { type: 'moving-platform', x: 123, y: G - 1, w: 2, id: 'mp1', path: [{ x: 6, y: 0 }], speed: 120, pauseMs: 300 },
    { type: 'sinking-platform', x: 135, y: G, w: 2, id: 's5', sinkDepth: 90, warnMs: 500 },
    { type: 'croc-platform', x: 139, y: G, w: 3, id: 'c7', cycleMs: 4000, openMs: 2200, phase: 0 },
    { type: 'pig', x: 157, y: G - 1, id: 'pig-end', flip: true },
    { type: 'decor', x: 2, y: G - 1, kind: 'reeds' }, { type: 'decor', x: 23, y: G - 1, kind: 'reeds' }, { type: 'decor', x: 50, y: G - 1, kind: 'mushroom' },
    { type: 'decor', x: 75, y: G - 1, kind: 'reeds' }, { type: 'decor', x: 113, y: G - 1, kind: 'reeds' }, { type: 'decor', x: 145, y: G - 1, kind: 'mushroom' }, { type: 'decor', x: 162, y: G - 1, kind: 'reeds' },
  ],
};
