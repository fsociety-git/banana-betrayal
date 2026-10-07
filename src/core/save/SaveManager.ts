import { Events, bus } from '../events';
import { defaultSave, isBetterRecord, migrateSave, modeKey, SAVE_KEY, type GhostRecording, type LevelRecord, type SaveData, type Settings } from './schema';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function detectStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__bb_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/**
 * Owns the single SaveData object. Reads once, writes on every change (debounced to the next tick).
 * If storage is unavailable the game keeps running from memory and `persistent` is false.
 */
export class SaveManager {
  private static _instance: SaveManager | null = null;
  static get instance(): SaveManager { return (this._instance ??= new SaveManager(detectStorage())); }
  /** For tests. */
  static create(storage: StorageLike | null): SaveManager { return new SaveManager(storage); }

  readonly persistent: boolean;
  private storage: StorageLike | null;
  private _data: SaveData;
  private writeScheduled = false;
  loadWarning: string | null = null;

  private constructor(storage: StorageLike | null) {
    this.storage = storage;
    this.persistent = storage !== null;
    this._data = this.read();
  }

  get data(): SaveData { return this._data; }
  get settings(): Settings { return this._data.settings; }

  private read(): SaveData {
    if (!this.storage) return defaultSave();
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (raw === null) return defaultSave();
      const parsed: unknown = JSON.parse(raw);
      return migrateSave(parsed);
    } catch (err) {
      this.loadWarning = 'Saved data could not be read and was reset.';
      console.warn('[save] unreadable save, using defaults', err);
      return defaultSave();
    }
  }

  /** Persist soon (coalesces bursts of changes). */
  commit(): void {
    if (this.writeScheduled) return;
    this.writeScheduled = true;
    const flush = (): void => { this.writeScheduled = false; this.flush(); };
    if (typeof queueMicrotask === 'function') queueMicrotask(flush); else flush();
  }

  flush(): void {
    if (!this.storage) return;
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this._data)); } catch (err) { console.warn('[save] write failed', err); }
  }

  updateSettings(patch: Partial<Settings>): void {
    Object.assign(this._data.settings, patch);
    this.commit();
    bus.emit(Events.SettingsChanged, this._data.settings);
  }

  markLevelComplete(levelId: string, deaths: number, bananas: number): void {
    const p = this._data.progress;
    p.completed[levelId] = true;
    p.totalDeaths += deaths;
    p.totalBananas += bananas;
    p.lastLevel = levelId;
    this.commit();
  }

  setCampaignComplete(): void {
    this._data.progress.campaignComplete = true;
    this._data.progress.pigUnlocked = true;
    this.commit();
  }

  markFirstRunDone(): void { this._data.progress.firstRunDone = true; this.commit(); }

  /** Store a record if it beats the current one; returns true when it did. */
  submitRecord(levelId: string, character: 'monkey' | 'pig', assist: boolean, record: LevelRecord): boolean {
    const key = modeKey(character, assist);
    const modes = (this._data.records[levelId] ??= {});
    if (!isBetterRecord(record, modes[key])) return false;
    modes[key] = record;
    this.commit();
    return true;
  }

  getRecord(levelId: string, character: 'monkey' | 'pig', assist: boolean): LevelRecord | undefined {
    return this._data.records[levelId]?.[modeKey(character, assist)];
  }

  setGhost(levelId: string, ghost: GhostRecording): void { this._data.ghosts[levelId] = ghost; this.commit(); }
  getGhost(levelId: string, levelHash: string): GhostRecording | null {
    const g = this._data.ghosts[levelId];
    if (!g || g.levelHash !== levelHash) return null;
    return g;
  }
  clearGhost(levelId: string): void { delete this._data.ghosts[levelId]; this.commit(); }

  /** Wipe progress and records but keep settings. */
  resetProgress(): void {
    const fresh = defaultSave();
    fresh.settings = this._data.settings;
    fresh.progress.firstRunDone = this._data.progress.firstRunDone;
    this._data = fresh;
    this.flush();
  }
}
