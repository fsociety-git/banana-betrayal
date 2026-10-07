import Phaser from 'phaser';
import { DEPTH, TILE } from '../../core/constants';
import type { ParsedLevel, Rect } from '../../levels/types';
import type { ThemePalette } from './themes';

/** Must be a multiple of TILE so chunk edges fall on tile boundaries. */
const CHUNK_W = TILE * 25;

/**
 * Terrain = static physics rectangles (merged from the grid) + baked cartoon visuals.
 * Visuals are drawn per exposed tile edge so merged rectangles never show seams, then baked to textures
 * in chunks (Graphics replays its command list every frame; baked images do not).
 */
export class Terrain {
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  readonly oneWays: Phaser.Physics.Arcade.StaticGroup;
  readonly spikes: Phaser.Physics.Arcade.StaticGroup;
  readonly water: Phaser.Physics.Arcade.StaticGroup;
  private images: Phaser.GameObjects.Image[] = [];
  private textureKeys: string[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, level: ParsedLevel, palette: ThemePalette, seed: number) {
    this.scene = scene;
    this.solids = scene.physics.add.staticGroup();
    this.oneWays = scene.physics.add.staticGroup();
    this.spikes = scene.physics.add.staticGroup();
    this.water = scene.physics.add.staticGroup();
    for (const r of level.solids) this.addStatic(this.solids, r);
    for (const r of level.oneWays) {
      const body = this.addStatic(this.oneWays, { x: r.x, y: r.y, w: r.w, h: 14 });
      body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false;
    }
    for (const r of level.spikes) this.addStatic(this.spikes, { x: r.x + 4, y: r.y + 14, w: r.w - 8, h: r.h - 14 });
    for (const r of level.water) this.addStatic(this.water, { x: r.x, y: r.y + 12, w: r.w, h: r.h - 12 });
    this.bake(level, palette, seed);
  }

  private addStatic(group: Phaser.Physics.Arcade.StaticGroup, r: Rect): Phaser.Physics.Arcade.StaticBody {
    const go = this.scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0xffffff, 0).setVisible(false);
    group.add(go);
    const body = go.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();
    return body;
  }

  private bake(level: ParsedLevel, p: ThemePalette, seed: number): void {
    const rng = new Phaser.Math.RandomDataGenerator([String(seed)]);
    const chunks = Math.ceil(level.widthPx / CHUNK_W);
    const h = level.heightPx;
    for (let c = 0; c < chunks; c++) {
      const x0 = c * CHUNK_W;
      const w = Math.min(CHUNK_W, level.widthPx - x0);
      const g = this.scene.add.graphics();
      const c0 = Math.floor(x0 / TILE), c1 = Math.min(level.cols, Math.ceil((x0 + w) / TILE));
      for (let ty = 0; ty < level.rows; ty++) {
        for (let tx = c0; tx < c1; tx++) {
          const v = level.grid[ty][tx];
          const px = tx * TILE - x0, py = ty * TILE;
          if (v === 'solid') this.drawSolidTile(g, level, tx, ty, px, py, p, rng);
          else if (v === 'oneway') this.drawPlank(g, level, tx, ty, px, py, p);
          else if (v === 'spikes') this.drawSpikes(g, px, py, p);
        }
      }
      const key = `terrain-${level.data.id}-${c}-${seed}`;
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      g.generateTexture(key, w, h);
      g.destroy();
      this.textureKeys.push(key);
      this.images.push(this.scene.add.image(x0, 0, key).setOrigin(0, 0).setDepth(DEPTH.terrain));
    }
  }

  private drawSolidTile(g: Phaser.GameObjects.Graphics, level: ParsedLevel, tx: number, ty: number, px: number, py: number, p: ThemePalette, rng: Phaser.Math.RandomDataGenerator): void {
    const solid = (x: number, y: number) => y >= 0 && y < level.rows && x >= 0 && x < level.cols && level.grid[y][x] === 'solid';
    const up = solid(tx, ty - 1), down = solid(tx, ty + 1), left = solid(tx - 1, ty), right = solid(tx + 1, ty);
    g.fillStyle(p.ground, 1);
    g.fillRect(px, py, TILE, TILE);
    // speckles
    if (rng.frac() < 0.5) { g.fillStyle(p.groundDark, 0.55); g.fillCircle(px + rng.between(6, 34), py + rng.between(6, 34), rng.between(2, 4)); }
    if (rng.frac() < 0.3) { g.fillStyle(p.groundLight, 0.5); g.fillCircle(px + rng.between(6, 34), py + rng.between(6, 34), rng.between(1, 3)); }
    const o = 3;
    g.fillStyle(p.outline, 1);
    if (!left) g.fillRect(px, py, o, TILE);
    if (!right) g.fillRect(px + TILE - o, py, o, TILE);
    if (!down) g.fillRect(px, py + TILE - o, TILE, o);
    if (!up) {
      // grass cap with bumpy fringe
      g.fillStyle(p.outline, 1); g.fillRect(px, py, TILE, o);
      g.fillStyle(p.grass, 1); g.fillRect(px + (left ? 0 : o), py + o, TILE - (left ? 0 : o) - (right ? 0 : o), 9);
      g.fillStyle(p.grassDark, 1); g.fillRect(px + (left ? 0 : o), py + 10, TILE - (left ? 0 : o) - (right ? 0 : o), 3);
      // soft grass bumps peeking above the ground line, and a wavy soil edge below the grass
      g.fillStyle(p.grass, 1);
      for (let i = 0; i < 3; i++) { const bx = px + 7 + i * 13 + rng.between(-2, 2); g.fillCircle(bx, py + o + 1, 4 + rng.between(0, 2)); }
      g.fillStyle(p.groundDark, 0.5);
      for (let i = 0; i < 4; i++) { g.fillCircle(px + 5 + i * 10 + rng.between(-1, 1), py + 14, 2.5); }
      // highlight line just under the outline
      g.fillStyle(0xffffff, 0.25); g.fillRect(px + (left ? 0 : o), py + o, TILE - (left ? 0 : o) - (right ? 0 : o), 2);
    } else if (!down) {
      // ceiling drip
      g.fillStyle(p.groundDark, 0.6); g.fillRect(px + 8, py + TILE - 8, 6, 3); g.fillRect(px + 24, py + TILE - 10, 5, 5);
    }
    if (!left && up) { g.fillStyle(p.groundLight, 0.35); g.fillRect(px + o, py, 2, TILE); }
  }

  private drawPlank(g: Phaser.GameObjects.Graphics, level: ParsedLevel, tx: number, ty: number, px: number, py: number, p: ThemePalette): void {
    const same = (x: number) => x >= 0 && x < level.cols && level.grid[ty][x] === 'oneway';
    const left = same(tx - 1), right = same(tx + 1);
    g.fillStyle(p.outline, 1); g.fillRect(px, py, TILE, 14);
    g.fillStyle(p.plank, 1); g.fillRect(px + (left ? 0 : 3), py + 3, TILE - (left ? 0 : 3) - (right ? 0 : 3), 8);
    g.fillStyle(p.plankDark, 1); g.fillRect(px + (left ? 0 : 3), py + 9, TILE - (left ? 0 : 3) - (right ? 0 : 3), 2);
    g.fillStyle(0xffffff, 0.3); g.fillRect(px + (left ? 0 : 3), py + 3, TILE - (left ? 0 : 3) - (right ? 0 : 3), 2);
    // nail
    g.fillStyle(p.outline, 1); g.fillCircle(px + 8, py + 7, 1.5); g.fillCircle(px + TILE - 8, py + 7, 1.5);
  }

  private drawSpikes(g: Phaser.GameObjects.Graphics, px: number, py: number, p: ThemePalette): void {
    g.fillStyle(p.outline, 1);
    for (let i = 0; i < 2; i++) g.fillTriangle(px + i * 20, py + TILE, px + i * 20 + 10, py + 6, px + i * 20 + 20, py + TILE);
    g.fillStyle(0xe8e8f0, 1);
    for (let i = 0; i < 2; i++) g.fillTriangle(px + i * 20 + 3, py + TILE, px + i * 20 + 10, py + 11, px + i * 20 + 17, py + TILE);
    g.fillStyle(0xffffff, 0.6);
    for (let i = 0; i < 2; i++) g.fillTriangle(px + i * 20 + 7, py + TILE - 4, px + i * 20 + 10, py + 13, px + i * 20 + 10, py + TILE - 4);
  }

  destroy(): void {
    for (const img of this.images) img.destroy();
    for (const key of this.textureKeys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.solids.destroy(true); this.oneWays.destroy(true); this.spikes.destroy(true); this.water.destroy(true);
  }
}
