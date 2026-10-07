import { LevelBuilder } from './builder';
import type { LevelData } from './types';

// Level 1 — Trust Issues. 170 columns, 15 rows (6800 x 600 px). Ground surface is row 11 (y = 440).
const b = new LevelBuilder(170, 15);
const G = 11; // ground surface row

b.ground(0, 169, G);
// --- Section 0: welcome, teach walking and jumping (cols 0-26)
b.spawn(4, G - 1);
b.bananas(10, G - 1, 3);
b.block(18, G - 1, 3, 1);              // one-tile step
b.bananas(18, G - 3, 3);
b.block(24, G - 2, 3, 2);              // two-tile step
b.banana(25, G - 4);
// --- Section 1: first pits and ledges (cols 27-50)
b.pit(31, 32, G);                      // 2-wide pit (safe lesson)
b.bananaArc(30, G - 2, 4, 1);
b.pit(38, 40, G);                      // 3-wide pit
b.block(43, G - 3, 3, 1);              // ledge with fleeing banana
b.plank(48, G - 2, 3);
b.bananaArc(37, G - 2, 5, 2);
b.checkpoint(52, G - 1);
// --- Section 2: the totally safe bridge (cols 55-72)
b.pit(58, 67, G, '~', 2);              // water under the bridge
b.block(70, G - 1, 2, 1);
b.checkpoint(74, G - 1);
// --- Section 3: decorative coconut, planks going up (cols 76-104)
b.block(84, G - 2, 4, 1);
b.plank(90, G - 3, 3);
b.plank(95, G - 4, 3);
b.bananaArc(89, G - 5, 5, 1);
b.block(99, G - 5, 5, 1);
b.bananas(100, G - 7, 3);
b.pit(104, 106, G, '^');               // spikes pit after the high route
b.checkpoint(110, G - 1);
// --- Section 4: moving platform over water, greedy upper route (cols 112-140)
b.pit(115, 123, G, '~', 2);
b.block(126, G - 1, 2, 1);
b.pit(129, 131, G, '^');
b.block(133, G - 3, 2, 1);
b.block(136, G - 5, 3, 1);
b.bananas(136, G - 7, 3);
b.block(141, G - 3, 2, 1);
b.pit(140, 143, G, '~', 2);
b.checkpoint(147, G - 1);
// --- Section 5: finish alcove where the flag can be cornered (cols 148-169)
b.flag(156, G - 1);
b.fill(166, 169, 0, G - 1, '#');       // wall: the flag's dead end
b.bananas(160, G - 2, 3);

export const level1: LevelData = {
  id: 'level1',
  name: 'Trust Issues',
  subtitle: 'A bright jungle with very confident signs.',
  theme: 'jungle',
  music: 'jungle',
  introLine: 'l1-intro',
  parTimeMs: 150000,
  hardBanana: { x: 101, y: G - 7 },
  tiles: b.build(),
  objects: [
    { type: 'sign', x: 7, y: G - 1, text: 'l1-welcome' },
    { type: 'pig', x: 14, y: G - 1, id: 'pig-intro', flip: true },
    { type: 'sign', x: 16, y: G - 1, text: 'l1-mine', id: 'sign-mine' },
    { type: 'encounter', kind: 'holder', x: 14, y: G - 1, id: 'holder1', pig: 'pig-intro' },
    { type: 'encounter', kind: 'showme', x: 35, y: G - 1, id: 'showme1', data: { pitFrom: 38, pitTo: 40, landCol: 42 } },
    { type: 'dialogue-trigger', x: 8, y: G - 4, w: 6, h: 4, id: 'd-intro', line: 'l1-intro', once: true },
    { type: 'fleeing-banana', x: 44, y: G - 4, id: 'flee1', path: [{ x: 3, y: 1 }, { x: 3, y: 1 }] },
    { type: 'dialogue-trigger', x: 40, y: G - 6, w: 6, h: 6, id: 'd-flee', line: 'l1-banana-flee', once: true },
    { type: 'sign', x: 55, y: G - 1, text: 'l1-safe' },
    { type: 'pig', x: 56, y: G - 1, id: 'pig-bridge' },
    { type: 'collapsing-bridge', x: 58, y: G, w: 10, id: 'bridge1', delayMs: 350, stepMs: 230 },
    { type: 'dialogue-trigger', x: 53, y: G - 5, w: 5, h: 5, id: 'd-bridge', line: 'l1-bridge', once: true },
    { type: 'dialogue-trigger', x: 68, y: G - 5, w: 3, h: 5, id: 'd-bridge-survived', line: 'l1-bridge-survived', once: true },
    { type: 'sign', x: 72, y: G - 1, text: 'skill-issue', id: 'skill-1' },
    { type: 'sign', x: 78, y: G - 1, text: 'l1-coconut' },
    { type: 'decor', x: 81, y: G - 1, kind: 'palm' },
    { type: 'coconut', x: 81, y: G - 6, id: 'coco1', triggerWidth: 3 },
    { type: 'dialogue-trigger', x: 74, y: G - 5, w: 5, h: 5, id: 'd-coconut', line: 'l1-coconut', once: true },
    { type: 'encounter', kind: 'button', x: 93, y: G - 1, id: 'button1', flip: true, data: { buttonCol: 91, exitCol: 96 } },
    { type: 'moving-platform', x: 116, y: G - 1, w: 2, id: 'mp1', path: [{ x: 6, y: 0 }], speed: 110, pauseMs: 350 },
    { type: 'sign', x: 150, y: G - 1, text: 'l1-flag' },
    { type: 'fleeing-flag', x: 153, y: G - 5, w: 4, h: 5, id: 'flagflee', fleeTo: { x: 164, y: G - 1 } },
    { type: 'pig', x: 161, y: G - 1, id: 'pig-end', flip: true },
    { type: 'decor', x: 30, y: G - 1, kind: 'bush' }, { type: 'decor', x: 46, y: G - 1, kind: 'flowers' },
    { type: 'decor', x: 68, y: G - 1, kind: 'palm' }, { type: 'decor', x: 93, y: G - 1, kind: 'bush' },
    { type: 'decor', x: 112, y: G - 1, kind: 'palm' }, { type: 'decor', x: 127, y: G - 1, kind: 'flowers' },
    { type: 'decor', x: 145, y: G - 1, kind: 'bush' }, { type: 'decor', x: 158, y: G - 1, kind: 'palm' },
  ],
};
