import { describe, expect, it } from 'vitest';
import { SaveManager, type StorageLike } from '../src/core/save/SaveManager';
import { DEFAULT_SETTINGS, defaultSave, isBetterRecord, makeRecord, migrateSave, modeKey, SAVE_KEY, SAVE_VERSION, sanitizeSettings } from '../src/core/save/schema';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

describe('migrateSave', () => {
  it('returns defaults for garbage', () => {
    for (const junk of [null, undefined, 42, 'nope', [], { version: 'x' }]) expect(migrateSave(junk)).toEqual(defaultSave());
  });
  it('fills missing fields and clamps ranges on the current version', () => {
    const out = migrateSave({ version: SAVE_VERSION, settings: { musicVolume: 7, quality: 'ultra', assist: { enabled: 'yes' } }, progress: { completed: { l1: true, l2: 'sure' }, totalDeaths: -3 } });
    expect(out.settings.musicVolume).toBe(1);
    expect(out.settings.quality).toBe('high');
    expect(out.settings.assist.enabled).toBe(false);
    expect(out.progress.completed).toEqual({ l1: true, l2: true });
    expect(out.progress.totalDeaths).toBe(0);
    expect(out.progress.pigUnlocked).toBe(false);
  });
  it('migrates the v0 pre-release shape', () => {
    const out = migrateSave({ completedLevels: ['level1', 'level2', 7], pigUnlocked: true, deaths: 12, seenIntro: true, music: 0.2, sfx: 0.9, muted: true });
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.progress.completed).toEqual({ level1: true, level2: true });
    expect(out.progress.pigUnlocked).toBe(true);
    expect(out.progress.totalDeaths).toBe(12);
    expect(out.progress.firstRunDone).toBe(true);
    expect(out.settings.musicVolume).toBe(0.2);
    expect(out.settings.muted).toBe(true);
  });
  it('drops malformed records and ghosts but keeps valid ones', () => {
    const good = makeRecord(12345, 3, 7);
    const out = migrateSave({ version: 1, records: { l1: { monkey: good, pig: { timeMs: 'fast' } }, l2: 'nope' }, ghosts: { l1: { levelId: 'l1', levelHash: 'h', frames: [1, 2, 3, 4], sampleMs: 50 }, l2: { levelId: 'l2', levelHash: 'h', frames: [1, 2, 3] } } });
    expect(out.records).toEqual({ l1: { monkey: good } });
    expect(Object.keys(out.ghosts)).toEqual(['l1']);
    expect(out.ghosts.l1.character).toBe('monkey');
  });
  it('sanitizeSettings returns defaults for non-objects', () => {
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('records', () => {
  it('prefers faster time then fewer deaths', () => {
    const a = makeRecord(1000, 5, 0), b = makeRecord(900, 9, 0), c = makeRecord(900, 2, 0);
    expect(isBetterRecord(a, undefined)).toBe(true);
    expect(isBetterRecord(b, a)).toBe(true);
    expect(isBetterRecord(c, b)).toBe(true);
    expect(isBetterRecord(b, c)).toBe(false);
  });
  it('keeps assist-mode records separate', () => {
    expect(modeKey('monkey', false)).toBe('monkey');
    expect(modeKey('monkey', true)).toBe('monkey-assist');
  });
});

describe('SaveManager', () => {
  it('round-trips through storage and migrates on read', () => {
    const storage = new MemoryStorage();
    const a = SaveManager.create(storage);
    a.markLevelComplete('level1', 4, 9);
    expect(a.submitRecord('level1', 'monkey', false, makeRecord(5000, 4, 9))).toBe(true);
    expect(a.submitRecord('level1', 'monkey', false, makeRecord(6000, 0, 9))).toBe(false);
    a.flush();
    const b = SaveManager.create(storage);
    expect(b.data.progress.completed).toEqual({ level1: true });
    expect(b.data.progress.totalDeaths).toBe(4);
    expect(b.getRecord('level1', 'monkey', false)?.timeMs).toBe(5000);
    expect(b.persistent).toBe(true);
  });
  it('survives corrupt JSON and missing storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    const a = SaveManager.create(storage);
    expect(a.data).toEqual(defaultSave());
    expect(a.loadWarning).toContain('reset');
    const b = SaveManager.create(null);
    expect(b.persistent).toBe(false);
    b.markLevelComplete('x', 1, 1);
    expect(b.data.progress.completed.x).toBe(true);
  });
  it('resetProgress keeps settings but clears progress, records and ghosts', () => {
    const a = SaveManager.create(new MemoryStorage());
    a.updateSettings({ musicVolume: 0.1 });
    a.markLevelComplete('l1', 1, 1);
    a.setGhost('l1', { levelId: 'l1', levelHash: 'h', character: 'monkey', sampleMs: 50, frames: [], timeMs: 1, gameVersion: 'x' });
    a.resetProgress();
    expect(a.settings.musicVolume).toBe(0.1);
    expect(a.data.progress.completed).toEqual({});
    expect(a.data.ghosts).toEqual({});
  });
  it('invalidates ghosts whose level hash changed', () => {
    const a = SaveManager.create(new MemoryStorage());
    a.setGhost('l1', { levelId: 'l1', levelHash: 'old', character: 'monkey', sampleMs: 50, frames: [], timeMs: 1, gameVersion: 'x' });
    expect(a.getGhost('l1', 'new')).toBeNull();
    expect(a.getGhost('l1', 'old')?.levelHash).toBe('old');
  });
});
