import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { Events, bus } from '../events';

export type QualityLevel = 'high' | 'balanced' | 'low';

/**
 * Render scale = how many canvas pixels back one logical pixel.
 * Canvas is GAME_WIDTH*scale by GAME_HEIGHT*scale; every scene's camera zooms by the same factor
 * so the world stays in logical coordinates and text/vectors stay crisp on high-density screens.
 */
let current = 1;

export function computeRenderScale(quality: QualityLevel): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (quality === 'low') return 1;
  if (quality === 'balanced') return Math.min(dpr, 1.5);
  return dpr;
}

export function getRenderScale(): number {
  return current;
}

export function initRenderScale(quality: QualityLevel): number {
  current = computeRenderScale(quality);
  return current;
}

export function applyRenderScale(game: Phaser.Game, quality: QualityLevel): void {
  const next = computeRenderScale(quality);
  if (Math.abs(next - current) < 0.001) return;
  current = next;
  game.scale.resize(Math.round(GAME_WIDTH * current), Math.round(GAME_HEIGHT * current));
  bus.emit(Events.RenderScaleChanged, current);
}

/** Point a camera at the logical viewport. Call in create() and on RenderScaleChanged. */
export function fitCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
  camera.setZoom(current);
  camera.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
