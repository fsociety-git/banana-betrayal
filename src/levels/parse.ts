import { TILE } from '../core/constants';
import { orderCheckpoints } from './checkpointOrder';
import type { LevelData, ParsedLevel, Point, Rect } from './types';
import { TILE_LEGEND } from './types';

/** Merge grid cells matching `pred` into the fewest axis-aligned rectangles (greedy row runs, then vertical merge). */
export function mergeCells(grid: string[][], pred: (v: string) => boolean, tile = TILE): Rect[] {
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  type Run = { x0: number; x1: number; y0: number; y1: number };
  const runs: Run[] = [];
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      if (!pred(grid[y][x])) { x++; continue; }
      const x0 = x;
      while (x < cols && pred(grid[y][x])) x++;
      runs.push({ x0, x1: x - 1, y0: y, y1: y });
    }
  }
  // vertical merge of identical runs on consecutive rows
  const merged: Run[] = [];
  for (const run of runs) {
    const prev = merged.find((m) => m.x0 === run.x0 && m.x1 === run.x1 && m.y1 === run.y0 - 1);
    if (prev) prev.y1 = run.y1; else merged.push({ ...run });
  }
  return merged.map((m) => ({ x: m.x0 * tile, y: m.y0 * tile, w: (m.x1 - m.x0 + 1) * tile, h: (m.y1 - m.y0 + 1) * tile }));
}

export function cellCenter(cx: number, cy: number, tile = TILE): Point {
  return { x: cx * tile + tile / 2, y: cy * tile + tile / 2 };
}

export function parseLevel(data: LevelData, tile = TILE): ParsedLevel {
  const rows = data.tiles.length;
  const cols = rows ? data.tiles[0].length : 0;
  const grid: string[][] = data.tiles.map((row) => row.split('').map((ch) => (TILE_LEGEND as Record<string, string>)[ch] ?? 'unknown'));
  let spawn: Point = { x: tile, y: tile };
  const checkpoints: ParsedLevel['checkpoints'] = [];
  const bananas: Point[] = [];
  let flag: Point | null = null;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = grid[y][x];
      // Entities stand on the floor of their cell.
      const foot = { x: x * tile + tile / 2, y: (y + 1) * tile };
      if (v === 'spawn') spawn = foot;
      else if (v === 'checkpoint') checkpoints.push({ ...foot, id: '', index: 0 });
      else if (v === 'banana') bananas.push(cellCenter(x, y, tile));
      else if (v === 'flag') flag = foot;
    }
  }
  // ids/indices follow route progression (ascending x), not grid scan order
  const ordered = orderCheckpoints(checkpoints).map((c, index) => ({ ...c, id: `cp${index + 1}`, index }));
  return {
    data, cols, rows, widthPx: cols * tile, heightPx: rows * tile, grid,
    solids: mergeCells(grid, (v) => v === 'solid', tile),
    oneWays: mergeCells(grid, (v) => v === 'oneway', tile),
    spikes: mergeCells(grid, (v) => v === 'spikes', tile),
    water: mergeCells(grid, (v) => v === 'water', tile),
    spawn, checkpoints: ordered, bananas, flag,
  };
}

export function isSolidAt(level: ParsedLevel, cx: number, cy: number): boolean {
  if (cy < 0 || cy >= level.rows || cx < 0 || cx >= level.cols) return false;
  return level.grid[cy][cx] === 'solid';
}
