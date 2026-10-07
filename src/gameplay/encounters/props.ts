import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';

/** Small drawn props shared by encounters. All return objects the caller owns and destroys. */

export function drawPedestalButton(scene: Phaser.Scene, x: number, y: number): { base: Phaser.GameObjects.Graphics; dome: Phaser.GameObjects.Graphics; glove: Phaser.GameObjects.Graphics } {
  const base = scene.add.graphics().setDepth(DEPTH.objects);
  base.fillStyle(0x2a1d12, 1); base.fillRoundedRect(x - 26, y - 44, 52, 44, 6);
  base.fillStyle(0x6b6f7a, 1); base.fillRoundedRect(x - 22, y - 40, 44, 36, 5);
  base.fillStyle(0x2a1d12, 1); base.fillRect(x - 22, y - 24, 44, 3);
  base.fillStyle(0xf7c948, 1); base.fillRect(x - 16, y - 18, 10, 10); base.fillRect(x + 6, y - 18, 10, 10);
  const dome = scene.add.graphics().setDepth(DEPTH.objects + 1);
  dome.fillStyle(0x2a1d12, 1); dome.fillEllipse(0, 0, 40, 18);
  dome.fillStyle(0xe5484d, 1); dome.fillEllipse(0, -6, 34, 22);
  dome.fillStyle(0xffffff, 0.45); dome.fillEllipse(-6, -11, 12, 6);
  dome.setPosition(x, y - 42);
  const glove = scene.add.graphics().setDepth(DEPTH.npc + 2);
  // spring + boxing glove, drawn pointing up; scaled/rotated by the encounter
  glove.lineStyle(4, 0x6b6f7a, 1);
  for (let i = 0; i < 6; i++) glove.lineBetween(-10, -i * 12, 10, -i * 12 - 6);
  glove.fillStyle(0x2a1d12, 1); glove.fillCircle(0, -92, 24);
  glove.fillStyle(0xe5484d, 1); glove.fillCircle(0, -92, 20); glove.fillRoundedRect(-14, -84, 28, 18, 6);
  glove.fillStyle(0xffffff, 0.35); glove.fillCircle(-7, -99, 6);
  glove.setPosition(x, y - 44).setVisible(false);
  return { base, dome, glove };
}

export function drawCrate(scene: Phaser.Scene, x: number, y: number, label: string, color = 0x9c7a4a): { box: Phaser.GameObjects.Graphics; lid: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text } {
  const box = scene.add.graphics().setDepth(DEPTH.objects);
  box.fillStyle(0x2a1d12, 1); box.fillRoundedRect(x - 36, y - 50, 72, 50, 5);
  box.fillStyle(color, 1); box.fillRoundedRect(x - 32, y - 46, 64, 46, 4);
  box.fillStyle(0x2a1d12, 0.5); box.fillRect(x - 32, y - 26, 64, 3); box.fillRect(x - 2, y - 46, 3, 46);
  const lid = scene.add.graphics().setDepth(DEPTH.objects + 1);
  lid.fillStyle(0x2a1d12, 1); lid.fillRoundedRect(-40, -8, 80, 14, 4);
  lid.fillStyle(color, 1); lid.fillRoundedRect(-37, -5, 74, 9, 3);
  lid.setPosition(x, y - 50);
  const text = scene.add.text(x, y - 24, label, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '10px', color: '#2a1d12', fontStyle: 'bold', align: 'center', wordWrap: { width: 60 } }).setOrigin(0.5).setDepth(DEPTH.objects + 1);
  return { box, lid, text };
}

/** A receipt-style paper with several short lines. */
export function drawPaper(scene: Phaser.Scene, x: number, y: number, lines: string[], width = 118): Phaser.GameObjects.Container {
  const h = 18 + lines.length * 14;
  const g = scene.add.graphics();
  g.fillStyle(0x2a1d12, 1); g.fillRect(-width / 2 - 3, -h - 3, width + 6, h + 6);
  g.fillStyle(0xfff8e7, 1); g.fillRect(-width / 2, -h, width, h);
  g.fillStyle(0xe6d9bf, 1); for (let i = 0; i < lines.length; i++) g.fillRect(-width / 2 + 8, -h + 14 + i * 14 + 10, width - 16, 1);
  const t = scene.add.text(0, -h + 8, lines.join('\n'), { fontFamily: '"Courier New", monospace', fontSize: '10px', color: '#2a1d12', align: 'left', lineSpacing: 2 }).setOrigin(0.5, 0);
  return scene.add.container(x, y, [g, t]).setDepth(DEPTH.npc + 3);
}

export function drawStamp(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '22px', color: '#e5484d', fontStyle: 'bold', stroke: '#8a1c22', strokeThickness: 2 }).setOrigin(0.5).setAngle(-12).setDepth(DEPTH.npc + 4).setVisible(false);
}

/** Dotted arc from (x0,y0) to (x1,y1) with the given apex rise — "the correct jump", drawn as a hint. */
export function drawArc(scene: Phaser.Scene, x0: number, y0: number, x1: number, y1: number, apex: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.particles);
  g.fillStyle(0xfff1a8, 0.95);
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    g.fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - apex * 4 * t * (1 - t), i === 14 ? 6 : 3.5);
  }
  g.lineStyle(2, 0x2a1d12, 0.8); g.strokeCircle(x1, y1, 9);
  return g;
}

export function drawPuddle(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.terrain + 1);
  g.fillStyle(0x2a1d12, 0.9); g.fillEllipse(x, y - 2, 36, 12);
  g.fillStyle(0x6fb4d6, 1); g.fillEllipse(x, y - 3, 30, 8);
  g.fillStyle(0xffffff, 0.5); g.fillEllipse(x - 6, y - 5, 8, 3);
  return g;
}

export function drawLadder(scene: Phaser.Scene, x: number, y: number, h = 60): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.objects - 1);
  g.lineStyle(4, 0x2a1d12, 1); g.lineBetween(x - 10, y, x - 4, y - h); g.lineBetween(x + 10, y, x + 16, y - h);
  g.lineStyle(3, 0x9c7a4a, 1); for (let i = 1; i < 5; i++) { const t = i / 5; g.lineBetween(x - 10 + 6 * t, y - h * t, x + 10 + 6 * t, y - h * t); }
  return g;
}

export function drawCoconut(scene: Phaser.Scene, x: number, y: number, r = 26): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.npc + 2);
  g.fillStyle(0x2a1d12, 1); g.fillCircle(0, 0, r + 3);
  g.fillStyle(0x6b4a2b, 1); g.fillCircle(0, 0, r);
  g.fillStyle(0x4a3220, 1); g.fillCircle(-7, -6, 4); g.fillCircle(6, -8, 4); g.fillCircle(0, 4, 4);
  g.fillStyle(0xffffff, 0.18); g.fillEllipse(-8, -10, 12, 8);
  g.setPosition(x, y);
  return g;
}

/** Overhead rail with hanging cables, a cradle and three warning lights. */
export function drawRail(scene: Phaser.Scene, x0: number, x1: number, y: number, cradleX: number): { gfx: Phaser.GameObjects.Graphics; lights: Phaser.GameObjects.Graphics[] } {
  const gfx = scene.add.graphics().setDepth(DEPTH.objects - 1);
  gfx.fillStyle(0x2a1d12, 1); gfx.fillRect(x0, y - 8, x1 - x0, 16);
  gfx.fillStyle(0x6b6f7a, 1); gfx.fillRect(x0 + 2, y - 5, x1 - x0 - 4, 10);
  gfx.fillStyle(0xf7c948, 1); for (let x = x0 + 8; x < x1 - 8; x += 28) gfx.fillRect(x, y - 3, 12, 6);
  // supports + cables
  gfx.fillStyle(0x2a1d12, 1); gfx.fillRect(x0 + 6, y, 10, 400); gfx.fillRect(x1 - 16, y, 10, 400);
  gfx.lineStyle(3, 0x1f2026, 1);
  for (let i = 0; i < 4; i++) { const cx = x0 + 40 + i * ((x1 - x0 - 80) / 3); gfx.lineBetween(cx, y + 8, cx + 14, y + 60); gfx.lineBetween(cx + 14, y + 60, cx - 6, y + 110); }
  // cradle
  gfx.lineStyle(5, 0x2a1d12, 1); gfx.beginPath(); gfx.arc(cradleX, y + 44, 34, Math.PI * 0.1, Math.PI * 0.9, false); gfx.strokePath();
  gfx.lineBetween(cradleX - 30, y + 8, cradleX - 30, y + 44); gfx.lineBetween(cradleX + 30, y + 8, cradleX + 30, y + 44);
  const lights: Phaser.GameObjects.Graphics[] = [];
  for (let i = 0; i < 3; i++) {
    const lx = x0 + 30 + i * ((x1 - x0 - 60) / 2);
    const l = scene.add.graphics().setDepth(DEPTH.objects);
    l.fillStyle(0x2a1d12, 1); l.fillRoundedRect(-9, -22, 18, 14, 3);
    l.fillStyle(0xe5484d, 1); l.fillCircle(0, -15, 6);
    l.setPosition(lx, y - 8).setAlpha(0.45);
    lights.push(l);
  }
  return { gfx, lights };
}

/** A handmade trophy: lopsided cup, visible glue, a banana sticker. Front/back texts are swapped by flipping. */
export function drawTrophy(scene: Phaser.Scene, x: number, y: number, front: string, back: string): { c: Phaser.GameObjects.Container; front: Phaser.GameObjects.Text; back: Phaser.GameObjects.Text } {
  const g = scene.add.graphics();
  g.fillStyle(0x2a1d12, 1); g.fillRoundedRect(-30, -12, 60, 12, 3);
  g.fillStyle(0x9c7a4a, 1); g.fillRoundedRect(-26, -10, 52, 8, 2);
  g.fillStyle(0x2a1d12, 1); g.fillRect(-6, -34, 12, 24);
  g.fillStyle(0xf7c948, 1); g.fillRect(-4, -32, 8, 20);
  g.fillStyle(0x2a1d12, 1); g.fillEllipse(0, -58, 66, 54);
  g.fillStyle(0xf7c948, 1); g.fillEllipse(1, -59, 58, 46);
  g.fillStyle(0xfff1a8, 0.6); g.fillEllipse(-10, -70, 16, 8);
  g.lineStyle(5, 0x2a1d12, 1); g.strokeEllipse(-38, -60, 22, 30); g.strokeEllipse(40, -56, 20, 26);
  g.fillStyle(0xffffff, 0.9); g.fillCircle(-24, -40, 3); g.fillCircle(22, -36, 2.5); g.fillCircle(6, -82, 2.5); // glue
  const sticker = scene.add.image(18, -74, 'banana').setScale(0.18).setAngle(20);
  const frontT = scene.add.text(0, -56, front, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '9px', color: '#2a1d12', fontStyle: 'bold', align: 'center', wordWrap: { width: 46 } }).setOrigin(0.5);
  const backT = scene.add.text(0, -56, back, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '10px', color: '#2a1d12', fontStyle: 'italic', align: 'center', wordWrap: { width: 46 } }).setOrigin(0.5).setVisible(false);
  const c = scene.add.container(x, y, [g, sticker, frontT, backT]).setDepth(DEPTH.objects + 3);
  return { c, front: frontT, back: backT };
}

/** A banner on two ropes. */
export function drawBanner(scene: Phaser.Scene, x: number, y: number, text: string): { c: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; cloth: Phaser.GameObjects.Graphics } {
  const cloth = scene.add.graphics();
  cloth.lineStyle(3, 0x2a1d12, 1); cloth.lineBetween(-120, -140, -110, -20); cloth.lineBetween(120, -140, 110, -20);
  cloth.fillStyle(0x2a1d12, 1); cloth.fillRoundedRect(-134, -24, 268, 54, 6);
  cloth.fillStyle(0xe5484d, 1); cloth.fillRoundedRect(-130, -20, 260, 46, 5);
  cloth.fillStyle(0xffffff, 0.18); cloth.fillRect(-124, -16, 248, 6);
  const label = scene.add.text(0, 2, text, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '24px', color: '#fff8e7', fontStyle: 'bold', stroke: '#2a1d12', strokeThickness: 4 }).setOrigin(0.5);
  const c = scene.add.container(x, y, [cloth, label]).setDepth(DEPTH.npc + 4);
  return { c, label, cloth };
}
