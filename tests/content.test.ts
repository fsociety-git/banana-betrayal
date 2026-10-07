import { describe, expect, it } from 'vitest';
import { CAPTIONS, PIG_LINES, SIGNS } from '../src/content/script';
import { LEVELS } from '../src/levels';

describe('content', () => {
  it('ships at least 30 original death captions, each tied to a cause', () => {
    const all = Object.values(CAPTIONS).flat();
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(new Set(all).size).toBe(all.length);
    for (const list of Object.values(CAPTIONS)) expect(list.length).toBeGreaterThanOrEqual(3);
  });
  it('every dialogue line and sign key referenced by a level exists', () => {
    for (const level of Object.values(LEVELS)) {
      for (const o of level.objects) {
        if (o.type === 'dialogue-trigger') expect({ level: level.id, line: o.line, ok: o.line in PIG_LINES }).toEqual({ level: level.id, line: o.line, ok: true });
        if (o.type === 'sign') expect({ level: level.id, sign: o.text, ok: o.text in SIGNS || o.text.length > 12 }).toEqual({ level: level.id, sign: o.text, ok: true });
      }
      if (level.introLine) expect(level.introLine in PIG_LINES).toBe(true);
    }
  });
  it('keeps the humour friendly (no slurs or personal allegations list)', () => {
    const banned = ['stupid', 'idiot', 'ugly', 'fat ', 'loser'];
    const text = [...Object.values(CAPTIONS).flat(), ...Object.values(PIG_LINES).flat(), ...Object.values(SIGNS)].join(' ').toLowerCase();
    for (const word of banned) expect(text.includes(word)).toBe(false);
  });
});
