import { LevelBuilder } from './builder';
import type { LevelData } from './types';

// Level 4 — Cloud Storage. 172 columns, 18 rows (taller for climbs). Island surface row 15; falling off = death.
const b = new LevelBuilder(172, 18);
const G = 15;

// --- Section 0: launch island (cols 0-14)
b.ground(0, 14, G);
b.spawn(4, G - 1);
b.bananas(8, G - 1, 3);
// --- Section 1: cloud hopping with a tailwind (cols 15-46)
b.ground(40, 46, G);
b.bananaArc(17, G - 3, 5, 2);
b.bananaArc(29, G - 7, 5, 2);
b.checkpoint(44, G - 1);
// --- Section 2: the climb (cols 47-75) up to the high shelf at row 3
b.ground(47, 56, G);
b.plank(50, G - 2, 3); b.plank(55, G - 4, 3); b.plank(50, G - 6, 3); b.plank(55, G - 8, 3); b.plank(50, G - 10, 3);
b.block(55, G - 12, 21, 1);            // high shelf (row 3)
b.bananas(51, G - 7, 1); b.bananas(56, G - 9, 1); b.bananas(51, G - 11, 1);
b.bananas(60, G - 14, 12);
b.checkpoint(74, G - 13);
// --- Section 3: the doubting cloud drops you onto the mid island, then crumble steps down (cols 76-100)
b.fill(76, 84, G - 6, G - 5, '#');     // floating island at rows 9-10, right under the doubting cloud
b.bananas(78, G - 8, 5);
b.ground(94, 100, G);
b.checkpoint(98, G - 1);
// --- Section 4: wind corridor (cols 101-150)
b.ground(110, 114, G);
b.ground(124, 128, G);
b.ground(138, 142, G);
b.bananaArc(103, G - 3, 6, 2); b.bananaArc(116, G - 3, 7, 2); b.bananaArc(130, G - 3, 7, 2);
b.checkpoint(141, G - 1);
// --- Section 5: last hops to the download island (cols 151-171)
b.ground(158, 171, G);
b.bananaArc(145, G - 3, 5, 2);
b.flag(166, G - 1);
b.bananas(160, G - 2, 3);

export const level4: LevelData = {
  id: 'level4',
  name: 'Cloud Storage',
  subtitle: 'Everyone\'s saved bananas. Zero redundancy.',
  theme: 'sky',
  music: 'sky',
  introLine: 'l4-intro',
  parTimeMs: 220000,
  hardBanana: { x: 71, y: G - 14 },
  tiles: b.build(),
  objects: [
    { type: 'sign', x: 7, y: G - 1, text: 'l4-reassure', blowAway: true, id: 'sign-reassure' },
    { type: 'pig', x: 11, y: G - 1, id: 'pig-umbrella', pose: 'umbrella', flip: true },
    { type: 'encounter', kind: 'callback', x: 11, y: G - 1, id: 'cb1', pig: 'pig-umbrella' },
    { type: 'encounter', kind: 'umbrella', x: 45, y: G - 1, id: 'umb1', flip: true },
    { type: 'dialogue-trigger', x: 5, y: G - 4, w: 6, h: 4, id: 'd-intro', line: 'l4-intro', once: true },
    { type: 'dialogue-trigger', x: 11, y: G - 4, w: 4, h: 4, id: 'd-umbrella', line: 'l4-umbrella', once: true },
    { type: 'sign', x: 13, y: G - 1, text: 'l4-wind' },
    { type: 'wind', x: 15, y: 4, w: 24, h: 11, id: 'wind1', force: 70 },
    { type: 'crumble', x: 16, y: G - 1, w: 2, id: 'cl1' }, { type: 'crumble', x: 20, y: G - 3, w: 2, id: 'cl2' }, { type: 'crumble', x: 24, y: G - 5, w: 2, id: 'cl3' },
    { type: 'crumble', x: 29, y: G - 5, w: 2, id: 'cl4' }, { type: 'crumble', x: 33, y: G - 3, w: 2, id: 'cl5' }, { type: 'crumble', x: 37, y: G - 1, w: 2, id: 'cl6' },
    { type: 'dialogue-trigger', x: 15, y: G - 6, w: 4, h: 6, id: 'd-wind', line: 'l4-wind', once: true },
    { type: 'wind', x: 57, y: 0, w: 19, h: 3, id: 'wind2', force: -110 },
    { type: 'falling-object', x: 62, y: 0, id: 'anvil1', kind: 'anvil', triggerWidth: 3 },
    { type: 'falling-object', x: 69, y: 0, id: 'anvil2', kind: 'anvil', triggerWidth: 3 },
    { type: 'doubting-cloud', x: 78, y: G - 8, w: 3, id: 'doubt1' },
    { type: 'sign', x: 76, y: G - 13, text: 'l4-solid' },
    { type: 'pig', x: 83, y: G - 7, id: 'pig-mid', pose: 'stuck', flip: true },
    { type: 'encounter', kind: 'stuck', x: 83, y: G - 7, id: 'stuck1', pig: 'pig-mid' },
    { type: 'dialogue-trigger', x: 76, y: G - 10, w: 8, h: 4, id: 'd-mid', line: 'l4-umbrella', once: true },
    { type: 'crumble', x: 87, y: G - 4, w: 2, id: 'cl7' },
    { type: 'crumble', x: 91, y: G - 2, w: 2, id: 'cl7b' },
    { type: 'wind', x: 101, y: 5, w: 9, h: 10, id: 'wind3', force: -90 },
    { type: 'crumble', x: 104, y: G - 1, w: 2, id: 'cl8' }, { type: 'crumble', x: 107, y: G - 3, w: 2, id: 'cl9' },
    { type: 'wind', x: 115, y: 5, w: 9, h: 10, id: 'wind4', force: 95 },
    { type: 'crumble', x: 118, y: G - 1, w: 2, id: 'cl10' }, { type: 'crumble', x: 121, y: G - 3, w: 2, id: 'cl11' },
    { type: 'falling-object', x: 112, y: 2, id: 'crate1', kind: 'banana-crate', triggerWidth: 3 },
    { type: 'falling-object', x: 126, y: 2, id: 'crate2', kind: 'banana-crate', triggerWidth: 3 },
    { type: 'wind', x: 129, y: 5, w: 9, h: 10, id: 'wind5', force: -80 },
    { type: 'crumble', x: 131, y: G - 1, w: 2, id: 'cl12' }, { type: 'crumble', x: 134, y: G - 3, w: 2, id: 'cl13' },
    { type: 'moving-platform', x: 144, y: G - 1, w: 2, id: 'mp1', path: [{ x: 0, y: -4 }, { x: 8, y: -4 }, { x: 8, y: 0 }], speed: 120, pauseMs: 300 },
    { type: 'crumble', x: 153, y: G - 3, w: 2, id: 'cl14' }, { type: 'crumble', x: 156, y: G - 1, w: 2, id: 'cl15' },
    { type: 'pig', x: 163, y: G - 1, id: 'pig-end', pose: 'umbrella', flip: true },
    { type: 'encounter', kind: 'holder', x: 163, y: G - 1, id: 'holder4', pig: 'pig-end' },
    { type: 'dialogue-trigger', x: 158, y: G - 4, w: 4, h: 4, id: 'd-end', line: 'l4-end', once: true },
    { type: 'decor', x: 2, y: G - 1, kind: 'cloudpuff' }, { type: 'decor', x: 42, y: G - 1, kind: 'flowers' }, { type: 'decor', x: 96, y: G - 1, kind: 'cloudpuff' },
    { type: 'decor', x: 112, y: G - 1, kind: 'flowers' }, { type: 'decor', x: 160, y: G - 1, kind: 'cloudpuff' }, { type: 'decor', x: 169, y: G - 1, kind: 'flowers' },
  ],
};
