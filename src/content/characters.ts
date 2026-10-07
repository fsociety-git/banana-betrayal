/**
 * Character art definitions. Textures are photo-cutout heads on cartoon bodies, split into a head layer and a
 * body layer that share one canvas, so the head can bob/tilt while the body squashes without distorting the face.
 * Fractions are relative to the texture canvas (same for head and body layers).
 */
export interface CharacterDef {
  id: 'monkey' | 'pig';
  displayName: string;
  headKey: string;
  bodyKey: string;
  wholeKey: string;
  /** Texture canvas size in pixels (game-size export). */
  texW: number;
  texH: number;
  /** Bottom of the feet as a fraction of texture height. */
  feetFrac: number;
  /** Neck pivot (head rotation/bob origin) as a fraction of the canvas. */
  neckX: number;
  neckY: number;
  /** Rendered height in logical pixels. */
  displayHeight: number;
  /** Collision body (logical px); feet-aligned. */
  bodyWidth: number;
  bodyHeight: number;
  /** Horizontal offset of the collision body centre from the texture centre (logical px). */
  bodyOffsetX: number;
}

export const CHARACTERS: Record<'monkey' | 'pig', CharacterDef> = {
  monkey: {
    id: 'monkey', displayName: 'Monkey',
    headKey: 'monkey-head', bodyKey: 'monkey-body', wholeKey: 'monkey-whole',
    texW: 148, texH: 318, feetFrac: 0.993, neckX: 0.534, neckY: 0.428,
    displayHeight: 96, bodyWidth: 36, bodyHeight: 82, bodyOffsetX: 4,
  },
  pig: {
    id: 'pig', displayName: 'Pig',
    headKey: 'pig-head', bodyKey: 'pig-body', wholeKey: 'pig-whole',
    texW: 157, texH: 304, feetFrac: 0.993, neckX: 0.573, neckY: 0.424,
    displayHeight: 96, bodyWidth: 44, bodyHeight: 80, bodyOffsetX: 2,
  },
};
