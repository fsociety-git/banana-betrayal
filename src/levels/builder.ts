/**
 * Small authoring helper: build the ASCII tile grid from named operations instead of hand-typing 160-column
 * strings. The output is plain data (string[]) and goes through the same parser/validator as any level.
 */
export class LevelBuilder {
  readonly cols: number;
  readonly rows: number;
  private grid: string[][];

  constructor(cols: number, rows: number) {
    this.cols = cols; this.rows = rows;
    this.grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => '.'));
  }

  private set(x: number, y: number, ch: string): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) throw new Error(`builder: (${x},${y}) '${ch}' out of ${this.cols}x${this.rows}`);
    this.grid[y][x] = ch;
  }

  /** Fill a rectangle of cells (inclusive x range, y0..y1 inclusive). */
  fill(x0: number, x1: number, y0: number, y1: number, ch = '#'): this {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
    return this;
  }
  /** Solid ground from surface row `top` down to the bottom of the level. */
  ground(x0: number, x1: number, top: number): this { return this.fill(x0, x1, top, this.rows - 1, '#'); }
  /** Carve a pit (empty) from `top` down to the bottom; optionally fill the bottom rows with water/spikes. */
  pit(x0: number, x1: number, top: number, floor?: '~' | '^', floorRows = 1): this {
    this.fill(x0, x1, top, this.rows - 1, '.');
    if (floor) this.fill(x0, x1, this.rows - floorRows, this.rows - 1, floor);
    return this;
  }
  /** Floating solid block; `h` rows tall. */
  block(x: number, y: number, w: number, h = 1): this { return this.fill(x, x + w - 1, y, y + h - 1, '#'); }
  /** One-way plank row. */
  plank(x: number, y: number, w: number): this { return this.fill(x, x + w - 1, y, y, '='); }
  spikes(x: number, y: number, w: number): this { return this.fill(x, x + w - 1, y, y, '^'); }
  water(x: number, y: number, w: number, h = 1): this { return this.fill(x, x + w - 1, y, y + h - 1, '~'); }
  spawn(x: number, y: number): this { this.set(x, y, 'P'); return this; }
  checkpoint(x: number, y: number): this { this.set(x, y, 'C'); return this; }
  flag(x: number, y: number): this { this.set(x, y, 'F'); return this; }
  banana(x: number, y: number): this { this.set(x, y, 'B'); return this; }
  /** A row of bananas. */
  bananas(x: number, y: number, count: number, step = 1): this { for (let i = 0; i < count; i++) this.set(x + i * step, y, 'B'); return this; }
  /** An arc of bananas following a jump. */
  bananaArc(x: number, y: number, count: number, rise = 1): this {
    for (let i = 0; i < count; i++) { const t = count === 1 ? 0 : i / (count - 1); const dy = Math.round(Math.sin(t * Math.PI) * rise); this.set(x + i, y - dy, 'B'); }
    return this;
  }

  build(): string[] { return this.grid.map((row) => row.join('')); }
}
