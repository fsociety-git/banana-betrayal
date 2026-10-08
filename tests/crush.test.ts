import { describe, expect, it } from 'vitest';
import { isCrushed } from '../src/gameplay/player/crush';

const none = { up: false, down: false, left: false, right: false };

describe('crush detection', () => {
  it('needs solid contact on opposite sides', () => {
    expect(isCrushed({ ...none, up: true, down: true }, false)).toBe(true);
    expect(isCrushed({ ...none, left: true, right: true }, false)).toBe(true);
    expect(isCrushed({ ...none, up: true }, false)).toBe(false);
    expect(isCrushed({ ...none, down: true }, false)).toBe(false);
  });
  it('a platform ride pushing into a ceiling counts; riding alone does not', () => {
    expect(isCrushed({ ...none, up: true }, true)).toBe(true);
    expect(isCrushed({ ...none, down: true }, true)).toBe(false);
  });
  it('is unaffected by overlap zones: a rising body beside a stunned forklift reports no blocked flags', () => {
    // the reviewer's frame: touching up+down from the hood zone and the chassis side, but nothing solid above or below
    expect(isCrushed(none, false)).toBe(false);
  });
});
