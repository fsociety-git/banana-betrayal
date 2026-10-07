import { GAME_VERSION, LEVEL_FORMAT_VERSION } from '../constants';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'banana-betrayal.save';

export type ReducedMotionSetting = 'system' | 'on' | 'off';
export type QualitySetting = 'high' | 'balanced' | 'low';
export type TouchSetting = 'auto' | 'on' | 'off';

export interface AssistSettings {
  enabled: boolean;
  slowHazards: boolean;
  extraCheckpoints: boolean;
}

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: QualitySetting;
  reducedMotion: ReducedMotionSetting;
  screenShake: boolean;
  touchControls: TouchSetting;
  showTimer: boolean;
  largeText: boolean;
  assist: AssistSettings;
}

export interface LevelRecord {
  timeMs: number;
  deaths: number;
  bananas: number;
  gameVersion: string;
  levelFormat: number;
  at: string;
}

export interface GhostRecording {
  levelId: string;
  levelHash: string;
  character: 'monkey' | 'pig';
  /** Sampling period in ms. */
  sampleMs: number;
  /** Flattened frames: [x, y, facing, stateCode, ...]. */
  frames: number[];
  timeMs: number;
  gameVersion: string;
}

export interface Progress {
  completed: Record<string, true>;
  pigUnlocked: boolean;
  campaignComplete: boolean;
  totalDeaths: number;
  totalBananas: number;
  lastLevel: string | null;
  firstRunDone: boolean;
  /** The new-game introduction has been shown (never repeats on restarts). */
  introSeen: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
  progress: Progress;
  /** records[levelId][modeKey] */
  records: Record<string, Record<string, LevelRecord>>;
  ghosts: Record<string, GhostRecording>;
  /** achievementId → ISO time unlocked. Persistent; never reset by checkpoints or deaths. */
  achievements: Record<string, string>;
  /** Story flags for cross-level callbacks (e.g. took the swamp shortcut). */
  flags: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  quality: 'high',
  reducedMotion: 'system',
  screenShake: true,
  touchControls: 'auto',
  showTimer: false,
  largeText: false,
  assist: { enabled: false, slowHazards: true, extraCheckpoints: true },
};

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    progress: { completed: {}, pigUnlocked: false, campaignComplete: false, totalDeaths: 0, totalBananas: 0, lastLevel: null, firstRunDone: false, introSeen: false },
    records: {},
    ghosts: {},
    achievements: {},
    flags: {},
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, options: readonly T[], d: T): T => (typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : d);

/** Coerce anything into a valid Settings object, filling gaps with defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  const assist = isObj(r.assist) ? r.assist : {};
  return {
    musicVolume: num(r.musicVolume, DEFAULT_SETTINGS.musicVolume, 0, 1),
    sfxVolume: num(r.sfxVolume, DEFAULT_SETTINGS.sfxVolume, 0, 1),
    muted: bool(r.muted, false),
    quality: oneOf(r.quality, ['high', 'balanced', 'low'] as const, 'high'),
    reducedMotion: oneOf(r.reducedMotion, ['system', 'on', 'off'] as const, 'system'),
    screenShake: bool(r.screenShake, true),
    touchControls: oneOf(r.touchControls, ['auto', 'on', 'off'] as const, 'auto'),
    showTimer: bool(r.showTimer, false),
    largeText: bool(r.largeText, false),
    assist: {
      enabled: bool(assist.enabled, false),
      slowHazards: bool(assist.slowHazards, true),
      extraCheckpoints: bool(assist.extraCheckpoints, true),
    },
  };
}

function sanitizeRecord(raw: unknown): LevelRecord | null {
  if (!isObj(raw)) return null;
  const timeMs = num(raw.timeMs, NaN, 0);
  if (!Number.isFinite(timeMs)) return null;
  return {
    timeMs,
    deaths: num(raw.deaths, 0, 0),
    bananas: num(raw.bananas, 0, 0),
    gameVersion: typeof raw.gameVersion === 'string' ? raw.gameVersion : 'unknown',
    levelFormat: num(raw.levelFormat, 0, 0),
    at: typeof raw.at === 'string' ? raw.at : new Date(0).toISOString(),
  };
}

function sanitizeGhost(raw: unknown): GhostRecording | null {
  if (!isObj(raw)) return null;
  if (typeof raw.levelId !== 'string' || typeof raw.levelHash !== 'string' || !Array.isArray(raw.frames)) return null;
  if (raw.frames.length % 4 !== 0 || !raw.frames.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return {
    levelId: raw.levelId,
    levelHash: raw.levelHash,
    character: raw.character === 'pig' ? 'pig' : 'monkey',
    sampleMs: num(raw.sampleMs, 50, 10, 1000),
    frames: raw.frames as number[],
    timeMs: num(raw.timeMs, 0, 0),
    gameVersion: typeof raw.gameVersion === 'string' ? raw.gameVersion : 'unknown',
  };
}

/**
 * Turn whatever was in storage into a valid SaveData. Unknown versions, malformed JSON shapes and partial
 * objects all degrade to defaults field by field; nothing throws.
 */
export function migrateSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isObj(raw)) return base;
  const version = num(raw.version, 0, 0);
  let data: Record<string, unknown> = raw;
  // v0: pre-release shape stored settings at the top level and progress as a list of completed ids.
  if (version < 1) data = migrateV0ToV1(data);
  const progress = isObj(data.progress) ? data.progress : {};
  const completed: Record<string, true> = {};
  if (isObj(progress.completed)) for (const k of Object.keys(progress.completed)) completed[k] = true;
  const records: SaveData['records'] = {};
  if (isObj(data.records)) {
    for (const [levelId, modes] of Object.entries(data.records)) {
      if (!isObj(modes)) continue;
      for (const [mode, rec] of Object.entries(modes)) {
        const clean = sanitizeRecord(rec);
        if (clean) (records[levelId] ??= {})[mode] = clean;
      }
    }
  }
  const ghosts: SaveData['ghosts'] = {};
  if (isObj(data.ghosts)) for (const [levelId, g] of Object.entries(data.ghosts)) { const clean = sanitizeGhost(g); if (clean) ghosts[levelId] = clean; }
  // v1 → v2: achievements map and introSeen flag (absent in v1 saves)
  const achievements: Record<string, string> = {};
  if (isObj(data.achievements)) for (const [id, at] of Object.entries(data.achievements)) if (typeof at === 'string' && /^[a-z-]+$/.test(id)) achievements[id] = at;
  const flags: Record<string, boolean> = {};
  if (isObj(data.flags)) for (const [id, v] of Object.entries(data.flags)) if (v === true && /^[a-z0-9-]+$/.test(id)) flags[id] = true;
  return {
    version: SAVE_VERSION,
    settings: sanitizeSettings(data.settings),
    progress: {
      completed,
      pigUnlocked: bool(progress.pigUnlocked, false),
      campaignComplete: bool(progress.campaignComplete, false),
      totalDeaths: num(progress.totalDeaths, 0, 0),
      totalBananas: num(progress.totalBananas, 0, 0),
      lastLevel: typeof progress.lastLevel === 'string' ? progress.lastLevel : null,
      firstRunDone: bool(progress.firstRunDone, false),
      introSeen: bool(progress.introSeen, false),
    },
    records,
    ghosts,
    achievements,
    flags,
  };
}

function migrateV0ToV1(raw: Record<string, unknown>): Record<string, unknown> {
  const completedList = Array.isArray(raw.completedLevels) ? raw.completedLevels.filter((v): v is string => typeof v === 'string') : [];
  const completed: Record<string, true> = {};
  for (const id of completedList) completed[id] = true;
  return {
    version: 1,
    settings: raw.settings ?? { musicVolume: raw.music, sfxVolume: raw.sfx, muted: raw.muted },
    progress: { completed, pigUnlocked: raw.pigUnlocked, totalDeaths: raw.deaths, firstRunDone: raw.seenIntro },
    records: raw.records,
    ghosts: raw.ghosts,
  };
}

/** Mode key for records: character + assist flag. Assist records never overwrite normal ones. */
export function modeKey(character: 'monkey' | 'pig', assist: boolean): string {
  return assist ? `${character}-assist` : character;
}

/** Returns true when `candidate` should replace `current` (faster time wins; fewer deaths breaks ties). */
export function isBetterRecord(candidate: LevelRecord, current: LevelRecord | undefined): boolean {
  if (!current) return true;
  if (candidate.timeMs !== current.timeMs) return candidate.timeMs < current.timeMs;
  return candidate.deaths < current.deaths;
}

export function makeRecord(timeMs: number, deaths: number, bananas: number): LevelRecord {
  return { timeMs, deaths, bananas, gameVersion: GAME_VERSION, levelFormat: LEVEL_FORMAT_VERSION, at: new Date().toISOString() };
}
