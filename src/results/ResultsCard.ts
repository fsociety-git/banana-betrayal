import type Phaser from 'phaser';
import { NAMES } from '../content/script';
import { formatTime } from '../ui/Hud';

export interface CardData {
  levelName: string;
  levelIndex: number | null;
  timeMs: number;
  deaths: number;
  bananas: number;
  bananaTotal: number;
  character: 'monkey' | 'pig';
  isNewBest: boolean;
  campaignComplete: boolean;
  assist: boolean;
  gameVersion: string;
}

/** Renders a shareable 1200x630 results card on an offscreen canvas and downloads it as PNG. Entirely local. */
export function downloadResultsCard(scene: Phaser.Scene, d: CardData): void {
  const W = 1200, H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#3aa0d8'); grad.addColorStop(1, '#14231a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // ground band
  ctx.fillStyle = '#2c1a0e'; ctx.fillRect(0, H - 110, W, 110);
  ctx.fillStyle = '#8a5a36'; ctx.fillRect(0, H - 104, W, 104);
  ctx.fillStyle = '#7ed957'; ctx.fillRect(0, H - 104, W, 18);
  ctx.fillStyle = '#4faa3a'; ctx.fillRect(0, H - 86, W, 5);
  // card panel
  roundRect(ctx, 60, 60, 700, 420, 28); ctx.fillStyle = 'rgba(255,248,231,0.96)'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#3a2a1c'; ctx.stroke();
  const font = (size: number, weight = 800): string => `${weight} ${size}px Fredoka, Nunito, "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = '#c47b1e'; ctx.font = font(22); ctx.fillText(NAMES.game.toUpperCase(), 100, 110);
  ctx.fillStyle = '#2a1d12'; ctx.font = font(54, 900);
  ctx.fillText(d.campaignComplete ? 'Campaign complete!' : d.levelIndex !== null ? `Level ${d.levelIndex} complete` : 'Level complete', 100, 170);
  ctx.font = font(30, 700); ctx.fillStyle = '#5a4634'; ctx.fillText(d.levelName, 100, 212);
  const stats: [string, string][] = [['TIME', formatTime(d.timeMs)], ['DEATHS', String(d.deaths)], ['BANANAS', `${d.bananas}/${d.bananaTotal}`]];
  stats.forEach(([label, value], i) => {
    const x = 100 + i * 210;
    roundRect(ctx, x, 250, 190, 120, 18); ctx.fillStyle = i === 0 && d.isNewBest ? 'rgba(247,201,72,0.7)' : 'rgba(42,29,18,0.08)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(42,29,18,0.35)'; ctx.stroke();
    ctx.fillStyle = '#2a1d12'; ctx.font = font(48, 900); ctx.textAlign = 'center'; ctx.fillText(value, x + 95, 318);
    ctx.font = font(18, 800); ctx.fillStyle = '#5a4634'; ctx.fillText(label, x + 95, 350); ctx.textAlign = 'left';
  });
  ctx.font = font(22, 700); ctx.fillStyle = '#2a1d12';
  const line = d.isNewBest ? '★ New personal best' : 'Played as the ' + d.character;
  ctx.fillText(line + (d.assist ? ' · assist mode' : ''), 100, 420);
  ctx.font = font(18, 600); ctx.fillStyle = '#5a4634'; ctx.fillText(`${NAMES.subtitle}  ·  v${d.gameVersion}`, 100, 455);
  // character portrait
  const key = d.character === 'pig' ? 'pig-whole' : 'monkey-whole';
  const src = scene.textures.exists(key) ? (scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement) : null;
  if (src && 'width' in src) {
    const targetH = 440, scale = targetH / src.height, w = src.width * scale;
    ctx.save();
    if (d.character === 'pig') { ctx.translate(1130, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, H - 104 - targetH, w, targetH); }
    else ctx.drawImage(src, 1130 - w, H - 104 - targetH, w, targetH);
    ctx.restore();
  }
  // banana glyph
  ctx.save(); ctx.translate(820, 120); ctx.rotate(-0.5);
  ctx.fillStyle = '#2c1a0e'; ellipse(ctx, 0, 0, 70, 30); ctx.fillStyle = '#f7c948'; ellipse(ctx, 0, 0, 62, 22); ctx.fillStyle = '#ffe58a'; ellipse(ctx, -14, -6, 30, 7);
  ctx.restore();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `banana-betrayal-${d.levelName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
