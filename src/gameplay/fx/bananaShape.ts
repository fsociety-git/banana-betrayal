/**
 * One banana silhouette for everything: pickups, HUD-ish bits, title pedestal, results card.
 * A crescent built from two offset circles, tilted so it reads as a banana rather than a smile.
 */
export interface Pt { x: number; y: number; }

/** Crescent polygon (closed) centred near the origin; width ≈ 60·scale, height ≈ 34·scale. */
export function bananaPolygon(scale = 1, inset = 0): Pt[] {
  const R = 30 * scale;
  const c1 = { x: 0, y: 14 * scale };  // outer (bottom) curve
  const c2 = { x: 0, y: 26 * scale };  // inner (top) curve
  const r1 = R - inset, r2 = R + inset;
  const a0 = Math.PI * 1.17, a1 = Math.PI * 1.83;
  const pts: Pt[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push({ x: c1.x + Math.cos(a) * r1, y: c1.y + Math.sin(a) * r1 }); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; pts.push({ x: c2.x + Math.cos(a) * r2, y: c2.y + Math.sin(a) * r2 }); }
  return rotate(pts, -0.35);
}

/** Thin highlight along the outer curve. */
export function bananaHighlight(scale = 1): Pt[] {
  const R = 30 * scale;
  const c1 = { x: 0, y: 14 * scale }, c2 = { x: 0, y: 19 * scale };
  const a0 = Math.PI * 1.3, a1 = Math.PI * 1.7;
  const pts: Pt[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push({ x: c1.x + Math.cos(a) * (R - 3 * scale), y: c1.y + Math.sin(a) * (R - 3 * scale) }); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; pts.push({ x: c2.x + Math.cos(a) * (R - 3 * scale), y: c2.y + Math.sin(a) * (R - 3 * scale) }); }
  return rotate(pts, -0.35);
}

/** Stem tips (dark caps) at both ends: [tipLeft, tipRight] as small quads. */
export function bananaTips(scale = 1): Pt[][] {
  const R = 30 * scale;
  const c1 = { x: 0, y: 14 * scale };
  const tips: Pt[][] = [];
  for (const a of [Math.PI * 1.17, Math.PI * 1.83]) {
    const px = c1.x + Math.cos(a) * R, py = c1.y + Math.sin(a) * R;
    const dir = a < Math.PI * 1.5 ? -1 : 1;
    tips.push(rotate([
      { x: px - 3 * scale * dir, y: py - 2 * scale }, { x: px + 5 * scale * dir, y: py - 6 * scale },
      { x: px + 7 * scale * dir, y: py - 1 * scale }, { x: px + 1 * scale * dir, y: py + 4 * scale },
    ], -0.35));
  }
  return tips;
}

function rotate(pts: Pt[], angle: number): Pt[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return pts.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

/** Phaser's fillPoints is typed for Vector2[]; plain {x,y} objects work at runtime. */
export function fillPts(g: Phaser.GameObjects.Graphics, pts: Pt[]): void {
  g.fillPoints(pts as unknown as Phaser.Math.Vector2[], true);
}

/** Draw a complete banana into a Phaser Graphics at (cx, cy). gold = trophy variant. */
export function drawBanana(g: Phaser.GameObjects.Graphics, cx: number, cy: number, scale: number, gold = false): void {
  const outline = gold ? 0x5a3b00 : 0x3a2308;
  const body = gold ? 0xffc93c : 0xf7c948;
  const light = gold ? 0xfff3b0 : 0xffe58a;
  const move = (pts: Pt[]): Pt[] => pts.map((p) => ({ x: p.x + cx, y: p.y + cy }));
  g.fillStyle(outline, 1); fillPts(g, move(bananaPolygon(scale, 2.6 * scale)));
  for (const tip of bananaTips(scale)) fillPts(g, move(tip));
  g.fillStyle(body, 1); fillPts(g, move(bananaPolygon(scale)));
  g.fillStyle(light, 0.95); fillPts(g, move(bananaHighlight(scale)));
  if (!gold) { g.fillStyle(0x8a5a2b, 0.9); g.fillCircle(cx - 8 * scale, cy + 8 * scale, 1.4 * scale); g.fillCircle(cx + 11 * scale, cy + 3 * scale, 1.2 * scale); }
  else { g.fillStyle(0xffffff, 0.9); g.fillCircle(cx - 6 * scale, cy - 2 * scale, 2.2 * scale); }
}

/** Same banana on a 2D canvas (results card). */
export function drawBananaCanvas(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, gold = false): void {
  const fill = (pts: Pt[], color: string): void => {
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x + cx, p.y + cy) : ctx.moveTo(p.x + cx, p.y + cy))); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  fill(bananaPolygon(scale, 2.6 * scale), gold ? '#5a3b00' : '#3a2308');
  for (const tip of bananaTips(scale)) fill(tip, gold ? '#5a3b00' : '#3a2308');
  fill(bananaPolygon(scale), gold ? '#ffc93c' : '#f7c948');
  fill(bananaHighlight(scale), gold ? '#fff3b0' : '#ffe58a');
}
