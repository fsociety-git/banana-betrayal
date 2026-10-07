/** Level data format. Terrain is an ASCII grid (TILE px per cell); everything else is an object list. */

export type ThemeId = 'jungle' | 'swamp' | 'factory' | 'sky' | 'hq' | 'test';

export const TILE_LEGEND = {
  '.': 'empty',
  ' ': 'empty',
  '#': 'solid',
  '=': 'oneway',
  '^': 'spikes',
  '~': 'water',
  'P': 'spawn',
  'C': 'checkpoint',
  'B': 'banana',
  'F': 'flag',
} as const;
export type TileChar = keyof typeof TILE_LEGEND;

export interface Rect { x: number; y: number; w: number; h: number; }
export interface Point { x: number; y: number; }

/** Object definitions are positioned in TILE units (x,y = top-left cell) unless noted. */
export type LevelObjectDef =
  | { type: 'sign'; x: number; y: number; text: string; id?: string; blowAway?: boolean }
  | { type: 'pig'; x: number; y: number; id: string; pose?: 'idle' | 'shack' | 'glass' | 'umbrella' | 'manager'; flip?: boolean }
  | { type: 'moving-platform'; x: number; y: number; w: number; id?: string; path: Point[]; speed: number; pauseMs?: number; carries?: boolean }
  | { type: 'collapsing-bridge'; x: number; y: number; w: number; id: string; delayMs?: number; stepMs?: number }
  | { type: 'fleeing-banana'; x: number; y: number; id: string; path: Point[] }
  | { type: 'coconut'; x: number; y: number; id: string; triggerWidth?: number }
  | { type: 'fleeing-flag'; x: number; y: number; w: number; h: number; id: string; fleeTo: Point }
  | { type: 'sinking-platform'; x: number; y: number; w: number; id?: string; sinkDepth?: number; warnMs?: number }
  | { type: 'bubble-spawner'; x: number; y: number; id?: string; intervalMs?: number; liftHeight?: number }
  | { type: 'croc-platform'; x: number; y: number; w: number; id?: string; cycleMs?: number; openMs?: number; phase?: number }
  | { type: 'conveyor'; x: number; y: number; w: number; id?: string; speed: number }
  | { type: 'crusher'; x: number; y: number; id?: string; cycleMs?: number; phase?: number; drop?: number }
  | { type: 'switch'; x: number; y: number; id: string; targets: string[]; once?: boolean }
  | { type: 'gate'; x: number; y: number; w: number; h: number; id: string; open?: boolean }
  | { type: 'wind'; x: number; y: number; w: number; h: number; id?: string; force: number }
  | { type: 'crumble'; x: number; y: number; w: number; id?: string; crumbleMs?: number; respawnMs?: number }
  | { type: 'falling-object'; x: number; y: number; id?: string; triggerWidth?: number; kind?: 'anvil' | 'crate' | 'banana-crate' }
  | { type: 'doubting-cloud'; x: number; y: number; w: number; id: string }
  | { type: 'banana-machine'; x: number; y: number; id: string }
  | { type: 'peel'; x: number; y: number; id?: string }
  | { type: 'hazard-rect'; x: number; y: number; w: number; h: number; kind?: 'spikes' | 'saw' | 'electric'; id?: string }
  | { type: 'dialogue-trigger'; x: number; y: number; w: number; h: number; id: string; line: string; once?: boolean; speaker?: 'pig' | 'caption' }
  | { type: 'boss-arena'; x: number; y: number; w: number; h: number; id: string }
  | { type: 'decor'; x: number; y: number; kind: string; id?: string }
  | { type: 'camera-hint'; x: number; y: number; w: number; h: number; id?: string; lookY?: number };

export type LevelObjectType = LevelObjectDef['type'];

export interface LevelData {
  id: string;
  name: string;
  subtitle: string;
  theme: ThemeId;
  tiles: string[];
  objects: LevelObjectDef[];
  /** Intro line shown on level start (content key). */
  introLine?: string;
  /** Rough designer target for a first clear (used for results card flavour only). */
  parTimeMs?: number;
  music?: string;
  /** If set, finishing requires beating the boss instead of touching a flag. */
  boss?: boolean;
}

export interface ParsedCheckpoint extends Point { id: string; index: number; }

export interface ParsedLevel {
  data: LevelData;
  cols: number;
  rows: number;
  widthPx: number;
  heightPx: number;
  /** Row-major grid of legend values. */
  grid: string[][];
  solids: Rect[];
  oneWays: Rect[];
  spikes: Rect[];
  water: Rect[];
  spawn: Point;
  checkpoints: ParsedCheckpoint[];
  bananas: Point[];
  flag: Point | null;
}
