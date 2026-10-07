import { LevelBuilder } from './builder';
import type { LevelData } from './types';

// Level 3 — The Banana Economy. 172 columns, 15 rows. Ground surface row 11.
const b = new LevelBuilder(172, 15);
const G = 11;

b.ground(0, 171, G);
// --- Section 0: reception (cols 0-20)
b.spawn(4, G - 1);
b.bananas(9, G - 1, 3);
// --- Section 1: belts and crushers (cols 21-44)
b.block(21, G - 1, 1, 1);
b.pit(22, 30, G); b.fill(22, 30, G + 1, G + 3, '#'); // recessed belt bed
b.pit(33, 41, G); b.fill(33, 41, G + 1, G + 3, '#');
b.bananas(24, G - 2, 6);
b.bananas(34, G - 2, 7);
b.checkpoint(44, G - 1);
// --- Section 2: cargo over the saw pit, lift to the upper floor (cols 46-82)
b.pit(48, 62, G, undefined, 0); b.fill(48, 62, G + 2, G + 3, '#');
b.block(63, G - 1, 2, 1);
b.pit(66, 67, G);
b.block(68, G - 6, 13, 1);            // upper floor
b.bananas(69, G - 8, 11);
b.plank(76, G - 3, 3);
b.bananaArc(64, G - 3, 3, 1);
b.checkpoint(82, G - 1);
// --- Section 3: switches, gates, and the FREE BANANA machine (cols 84-118)
b.block(95, G - 4, 6, 1);             // machine ledge (greedy detour)
b.plank(92, G - 2, 2);
b.pit(104, 105, G, '^');
b.bananas(96, G - 6, 4);
b.checkpoint(118, G - 1);
// --- Section 4: the gauntlet (cols 120-158)
b.pit(122, 131, G); b.fill(122, 131, G + 1, G + 3, '#');
b.pit(136, 139, G, '^');
b.block(141, G - 2, 2, 2);
b.pit(145, 150, G); b.fill(145, 150, G + 2, G + 3, '#');
b.bananaArc(123, G - 3, 8, 2);
b.bananas(152, G - 2, 3);
b.checkpoint(158, G - 1);
// --- Section 5: management (cols 159-171)
b.flag(166, G - 1);

export const level3: LevelData = {
  id: 'level3',
  name: 'The Banana Economy',
  subtitle: 'Bananas in. Smaller bananas out.',
  theme: 'factory',
  music: 'factory',
  introLine: 'l3-intro',
  parTimeMs: 220000,
  hardBanana: { x: 79, y: G - 8 },
  tiles: b.build(),
  objects: [
    { type: 'pig', x: 12, y: G - 1, id: 'pig-manager', pose: 'manager', flip: true },
    { type: 'dialogue-trigger', x: 6, y: G - 4, w: 8, h: 4, id: 'd-intro', line: 'l3-intro', once: true },
    { type: 'dialogue-trigger', x: 14, y: G - 4, w: 5, h: 4, id: 'd-manager', line: 'l3-manager', once: true },
    { type: 'sign', x: 18, y: G - 1, text: 'l3-crusher' },
    { type: 'conveyor', x: 22, y: G, w: 9, id: 'belt1', speed: -130 },
    { type: 'conveyor', x: 33, y: G, w: 9, id: 'belt2', speed: 150 },
    { type: 'crusher', x: 25, y: G - 4, id: 'cr1', cycleMs: 3000, phase: 0, drop: 3 },
    { type: 'crusher', x: 29, y: G - 4, id: 'cr2', cycleMs: 3000, phase: 1500, drop: 3 },
    { type: 'crusher', x: 36, y: G - 4, id: 'cr3', cycleMs: 2800, phase: 800, drop: 3 },
    { type: 'crusher', x: 40, y: G - 4, id: 'cr4', cycleMs: 2800, phase: 2000, drop: 3 },
    { type: 'dialogue-trigger', x: 20, y: G - 4, w: 3, h: 4, id: 'd-crusher', line: 'l3-crusher', once: true },
    { type: 'hazard-rect', x: 48, y: G + 1, w: 15, h: 1, kind: 'saw', id: 'saws1' },
    { type: 'moving-platform', x: 49, y: G - 1, w: 2, id: 'cargo1', path: [{ x: 5, y: 0 }], speed: 130, pauseMs: 250 },
    { type: 'moving-platform', x: 57, y: G - 2, w: 2, id: 'cargo2', path: [{ x: 4, y: 0 }], speed: 110, pauseMs: 250 },
    { type: 'moving-platform', x: 66, y: G - 1, w: 2, id: 'lift1', path: [{ x: 0, y: -5 }], speed: 120, pauseMs: 600 },
    { type: 'sign', x: 42, y: G - 1, text: 'skill-issue', id: 'skill-3' },
    { type: 'encounter', kind: 'crate', x: 46, y: G - 1, id: 'crate1' },
    { type: 'sign', x: 70, y: G - 7, text: 'l3-greed' },
    { type: 'decor', x: 74, y: G - 7, kind: 'crate' }, { type: 'decor', x: 79, y: G - 7, kind: 'gear' },
    { type: 'encounter', kind: 'chase', x: 85, y: G - 1, id: 'chase1', data: { tauntCol: 90, runToCol: 100 } },
    { type: 'switch', x: 88, y: G - 1, id: 'sw1', targets: ['gate1'], once: true },
    { type: 'gate', x: 102, y: G - 4, w: 1, h: 4, id: 'gate1' },
    { type: 'sign', x: 94, y: G - 5, text: 'l3-free' },
    { type: 'banana-machine', x: 98, y: G - 5, id: 'machine1' },
    { type: 'sign', x: 100, y: G - 5, text: 'l3-fee' },
    { type: 'switch', x: 109, y: G - 1, id: 'sw2', targets: ['gate2', 'gate3'] },
    { type: 'gate', x: 113, y: G - 4, w: 1, h: 4, id: 'gate2' },
    { type: 'gate', x: 116, y: G - 4, w: 1, h: 4, id: 'gate3', open: true },
    { type: 'conveyor', x: 122, y: G, w: 10, id: 'belt3', speed: -160 },
    { type: 'crusher', x: 125, y: G - 4, id: 'cr5', cycleMs: 2600, phase: 0, drop: 3 },
    { type: 'crusher', x: 129, y: G - 4, id: 'cr6', cycleMs: 2600, phase: 1300, drop: 3 },
    { type: 'hazard-rect', x: 145, y: G + 1, w: 6, h: 1, kind: 'electric', id: 'zap1' },
    { type: 'moving-platform', x: 146, y: G - 1, w: 2, id: 'cargo3', path: [{ x: 3, y: 0 }], speed: 140, pauseMs: 200 },
    { type: 'pig', x: 163, y: G - 1, id: 'pig-end', pose: 'manager', flip: true },
    { type: 'dialogue-trigger', x: 159, y: G - 4, w: 4, h: 4, id: 'd-end', line: 'l3-end', once: true },
    { type: 'decor', x: 2, y: G - 1, kind: 'crate' }, { type: 'decor', x: 16, y: G - 1, kind: 'pipe' }, { type: 'decor', x: 46, y: G - 1, kind: 'gear' },
    { type: 'decor', x: 85, y: G - 1, kind: 'pipe' }, { type: 'decor', x: 120, y: G - 1, kind: 'crate' }, { type: 'decor', x: 155, y: G - 1, kind: 'gear' }, { type: 'decor', x: 169, y: G - 1, kind: 'pipe' },
  ],
};
