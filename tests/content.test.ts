import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, CAPTIONS, CREDITS, DUKKAR_LINES, MAKAD_LINES, NAMES, SIGNS } from '../src/content/script';
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
        if (o.type === 'dialogue-trigger') expect({ level: level.id, line: o.line, ok: o.line in DUKKAR_LINES }).toEqual({ level: level.id, line: o.line, ok: true });
        if (o.type === 'sign') expect({ level: level.id, sign: o.text, ok: o.text in SIGNS || o.text.length > 12 }).toEqual({ level: level.id, sign: o.text, ok: true });
      }
      if (level.introLine) expect(level.introLine in DUKKAR_LINES).toBe(true);
    }
  });
  it('keeps the humour friendly and the story a cartoon rivalry (public brief)', () => {
    const banned = ['stupid', 'idiot', 'ugly', 'fat ', 'loser', 'girlfriend', 'boyfriend', 'dating', 'anniversary', 'kiss', 'world\'s best', 'her dukkar', 'your dukkar', 'couple', 'romantic', 'photo of', 'real person', 'friend who'];
    const text = [...Object.values(CAPTIONS).flat(), ...Object.values(DUKKAR_LINES).flat(), ...Object.values(MAKAD_LINES), ...Object.values(SIGNS), ...CREDITS.map((c) => c.role + ' ' + c.name), NAMES.subtitle, NAMES.heroCredit, NAMES.rivalCredit].join(' ').toLowerCase();
    for (const word of banned) expect({ word, found: text.includes(word) }).toEqual({ word, found: false });
    expect(NAMES.hero).toBe('Makad');
    expect(NAMES.rival).toBe('Dukkar');
    expect(NAMES.signature).toBe('From Dukkar.');
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
