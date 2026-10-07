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
    let depth = 0;
    while (ty - depth - 1 >= 0 && solid(tx, ty - depth - 1)) depth++;
    const o = 3;
    const metal = p.style === 'metal', cloud = p.style === 'cloud', gold = p.style === 'gold';
    // body colour by depth: a lighter topsoil band, then ground, then deep soil
    const bodyColor = depth === 0 ? p.ground : depth === 1 ? p.ground : depth >= 3 ? p.soilDeep : p.ground;
    const radius = { tl: !up && !left ? 10 : 0, tr: !up && !right ? 10 : 0, bl: !down && !left ? 8 : 0, br: !down && !right ? 8 : 0 };
    g.fillStyle(p.outline, 1); g.fillRoundedRect(px, py, TILE, TILE, radius);
    g.fillStyle(bodyColor, 1); g.fillRoundedRect(px + (left ? 0 : o), py + (up ? 0 : o), TILE - (left ? 0 : o) - (right ? 0 : o), TILE - (up ? 0 : o) - (down ? 0 : o), { tl: radius.tl ? 7 : 0, tr: radius.tr ? 7 : 0, bl: radius.bl ? 5 : 0, br: radius.br ? 5 : 0 });
    if (depth === 1 && !metal) { g.fillStyle(p.soilLight, 0.55); g.fillRect(px + (left ? 0 : o), py, TILE - (left ? 0 : o) - (right ? 0 : o), 10); }
    if (depth >= 2 && !metal) { g.fillStyle(p.soilDeep, Math.min(0.75, 0.25 + depth * 0.12)); g.fillRect(px + (left ? 0 : o), py + (up ? 0 : o), TILE - (left ? 0 : o) - (right ? 0 : o), TILE - (up ? 0 : o) - (down ? 0 : o)); }
    // texture: speckles, stones, rivets
    if (metal) {
      g.fillStyle(p.soilDeep, 0.6); g.fillRect(px + 6, py + 6, TILE - 12, 2); g.fillRect(px + 6, py + TILE - 8, TILE - 12, 2);
      g.fillStyle(p.outline, 0.8); g.fillCircle(px + 7, py + 7, 2); g.fillCircle(px + TILE - 7, py + 7, 2); g.fillCircle(px + 7, py + TILE - 7, 2); g.fillCircle(px + TILE - 7, py + TILE - 7, 2);
      if (rng.frac() < 0.12) { g.fillStyle(0xf2c94c, 0.5); g.fillRect(px + 10, py + 16, 20, 6); }
    } else {
      if (rng.frac() < 0.55) { g.fillStyle(p.groundDark, 0.5); g.fillCircle(px + rng.between(6, 34), py + rng.between(10, 34), rng.between(2, 4)); }
      if (rng.frac() < 0.35) { g.fillStyle(p.groundLight, 0.45); g.fillCircle(px + rng.between(6, 34), py + rng.between(6, 34), rng.between(1, 3)); }
      if (depth >= 2 && rng.frac() < 0.22) { g.fillStyle(p.outline, 0.9); g.fillEllipse(px + rng.between(10, 30), py + rng.between(10, 30), 14, 9); g.fillStyle(p.stone, 0.9); g.fillEllipse(px + rng.between(10, 30) - 1, py + rng.between(10, 30) - 1, 11, 6); }
    }
    // side highlights / shadows for a hint of lighting from the upper left
    if (!left) { g.fillStyle(0xffffff, metal ? 0.22 : 0.16); g.fillRect(px + o, py + (up ? 0 : o), 2, TILE - (up ? 0 : o) - (down ? 0 : o)); }
    if (!right) { g.fillStyle(0x000000, 0.14); g.fillRect(px + TILE - o - 2, py + (up ? 0 : o), 2, TILE - (up ? 0 : o) - (down ? 0 : o)); }
    if (!up) {
      if (cloud) {
        // puffy cloud top
        g.fillStyle(p.outline, 1); for (let i = 0; i < 3; i++) g.fillCircle(px + 7 + i * 13, py + 4, 9);
        g.fillStyle(0xffffff, 1); for (let i = 0; i < 3; i++) g.fillCircle(px + 7 + i * 13, py + 5, 7);
        g.fillStyle(0xd7e6fb, 1); g.fillRect(px, py + 12, TILE, 3);
      } else if (metal) {
        // hazard-stripe safety edge
        g.fillStyle(p.outline, 1); g.fillRect(px, py, TILE, o);
        g.fillStyle(0xf2c94c, 1); g.fillRect(px, py + o, TILE, 8);
        g.fillStyle(p.outline, 1); for (let i = 0; i < 3; i++) g.fillTriangle(px + i * 14, py + o + 8, px + i * 14 + 6, py + o, px + i * 14 + 12, py + o + 8);
        g.fillStyle(0xffffff, 0.3); g.fillRect(px, py + o, TILE, 1);
      } else if (gold) {
        // gilded trim
        g.fillStyle(p.outline, 1); g.fillRect(px, py, TILE, o);
        g.fillStyle(0xf7c948, 1); g.fillRect(px + (left ? 0 : o), py + o, TILE - (left ? 0 : o) - (right ? 0 : o), 7);
        g.fillStyle(0xffe58a, 1); g.fillRect(px + (left ? 0 : o), py + o, TILE - (left ? 0 : o) - (right ? 0 : o), 2);
        g.fillStyle(0xc49a1a, 1); g.fillRect(px + (left ? 0 : o), py + o + 7, TILE - (left ? 0 : o) - (right ? 0 : o), 2);
        g.fillStyle(p.outline, 0.9); for (let i = 0; i < 2; i++) g.fillCircle(px + 12 + i * 16, py + 6, 1.6);
      } else {
        // grass cap with blades rising above the edge and a soft soil transition
        g.fillStyle(p.outline, 1); g.fillRect(px + (left ? 0 : 2), py, TILE - (left ? 0 : 2) - (right ? 0 : 2), o);
        g.fillStyle(p.grass, 1); g.fillRect(px + (left ? 0 : o), py + o, TILE - (left ? 0 : o) - (right ? 0 : o), 8);
        g.fillStyle(p.grassDark, 1); g.fillRect(px + (left ? 0 : o), py + 9, TILE - (left ? 0 : o) - (right ? 0 : o), 4);
        for (let i = 0; i < 4; i++) { const bx = px + 5 + i * 10 + rng.between(-1, 1); g.fillStyle(p.grassDark, 0.9); g.fillCircle(bx, py + 13, 2.5); }
        // blades poking above the outline
        for (let i = 0; i < 3; i++) {
          const bx = px + 6 + i * 13 + rng.between(-2, 2), h = rng.between(5, 11), lean = rng.between(-3, 3);
          g.fillStyle(p.outline, 1); g.fillTriangle(bx - 4, py + 1, bx + lean, py - h - 1, bx + 4, py + 1);
          g.fillStyle(i % 2 ? p.grassDark : p.grass, 1); g.fillTriangle(bx - 2.5, py + 1, bx + lean, py - h + 1, bx + 2.5, py + 1);
        }
        g.fillStyle(0xffffff, 0.3); g.fillRect(px + (left ? 0 : o), py + o, TILE - (left ? 0 : o) - (right ? 0 : o), 2);
      }
    } else if (!down) {
      // underside: hanging roots / drips on floating ground
      g.fillStyle(p.outline, 0.9);
      if (!metal) { for (let i = 0; i < 2; i++) { const rx = px + 9 + i * 18 + rng.between(-3, 3); g.fillRect(rx, py + TILE - 2, 3, rng.between(6, 14)); g.fillRect(rx + 2, py + TILE + 4, 2, rng.between(3, 8)); } }
      else { g.fillRect(px + 8, py + TILE - 2, TILE - 16, 4); }
    }
    if (!down && !up && !metal) { g.fillStyle(p.outline, 0.9); g.fillRect(px + 12, py + TILE - 2, 3, rng.between(8, 16)); }
  }

  private drawPlank(g: Phaser.GameObjects.Graphics, level: ParsedLevel, tx: number, ty: number, px: number, py: number, p: ThemePalette): void {
    const same = (x: number) => x >= 0 && x < level.cols && level.grid[ty][x] === 'oneway';
    const left = same(tx - 1), right = same(tx + 1);
    const cloud = p.style === 'cloud';
    if (cloud) {
      g.fillStyle(0x4a5a7a, 1); g.fillRoundedRect(px - (left ? 0 : 0), py, TILE, 16, { tl: left ? 0 : 8, tr: right ? 0 : 8, bl: left ? 0 : 8, br: right ? 0 : 8 });
      g.fillStyle(0xffffff, 1); g.fillRoundedRect(px + (left ? 0 : 3), py + 3, TILE - (left ? 0 : 3) - (right ? 0 : 3), 10, { tl: left ? 0 : 5, tr: right ? 0 : 5, bl: left ? 0 : 5, br: right ? 0 : 5 });
      g.fillStyle(0xd7e6fb, 1); g.fillRect(px + (left ? 0 : 3), py + 10, TILE - (left ? 0 : 3) - (right ? 0 : 3), 3);
      return;
    }
    g.fillStyle(p.outline, 1); g.fillRoundedRect(px, py, TILE, 14, { tl: left ? 0 : 4, tr: right ? 0 : 4, bl: left ? 0 : 4, br: right ? 0 : 4 });
    g.fillStyle(p.plank, 1); g.fillRect(px + (left ? 0 : 3), py + 3, TILE - (left ? 0 : 3) - (right ? 0 : 3), 8);
    g.fillStyle(p.plankDark, 0.9); g.fillRect(px + (left ? 0 : 3), py + 9, TILE - (left ? 0 : 3) - (right ? 0 : 3), 2);
    g.fillStyle(p.plankDark, 0.5); g.fillRect(px + 6, py + 5, 12, 1); g.fillRect(px + 22, py + 7, 10, 1);
    g.fillStyle(0xffffff, 0.3); g.fillRect(px + (left ? 0 : 3), py + 3, TILE - (left ? 0 : 3) - (right ? 0 : 3), 2);
    // brackets at the ends, nails in the middle
    g.fillStyle(p.outline, 1);
    if (!left) g.fillRect(px + 2, py + 2, 4, 10);
    if (!right) g.fillRect(px + TILE - 6, py + 2, 4, 10);
    g.fillCircle(px + 12, py + 7, 1.5); g.fillCircle(px + TILE - 12, py + 7, 1.5);
  }

  private drawSpikes(g: Phaser.GameObjects.Graphics, px: number, py: number, p: ThemePalette): void {
    g.fillStyle(p.outline, 1); g.fillRect(px, py + TILE - 6, TILE, 6);
    g.fillStyle(p.groundDark, 1); g.fillRect(px + 2, py + TILE - 4, TILE - 4, 2);
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
