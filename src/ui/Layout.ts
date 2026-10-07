import type Phaser from 'phaser';
import { Events, bus } from '../core/events';
import { UIRoot } from './UIRoot';

export interface LayoutState {
  viewportW: number;
  viewportH: number;
  /** Canvas rectangle in CSS pixels (the "stage" overlays align to). */
  stage: { x: number; y: number; w: number; h: number };
  portrait: boolean;
  /** Portrait on a narrow screen: the 16:9 playfield becomes a thin strip. */
  portraitNarrow: boolean;
}

/**
 * Keeps the DOM overlays aligned with the Phaser canvas. On every resize / orientation change it refreshes the
 * Scale Manager (twice, because mobile browsers report the new size before the layout settles), measures the
 * canvas and publishes the rectangle as CSS variables on the stage element plus a bus event.
 */
export class LayoutManager {
  private static _instance: LayoutManager | null = null;
  static get instance(): LayoutManager { return (this._instance ??= new LayoutManager()); }

  state: LayoutState = { viewportW: 0, viewportH: 0, stage: { x: 0, y: 0, w: 0, h: 0 }, portrait: false, portraitNarrow: false };
  private game: Phaser.Game | null = null;
  private raf = 0;
  private settleTimer: number | null = null;
  private lateTimer: number | null = null;

  init(game: Phaser.Game): void {
    this.game = game;
    const schedule = (): void => this.schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    game.scale.on('resize', () => this.measure());
    document.addEventListener('fullscreenchange', schedule);
    // Container-size changes that never raise a window resize (embeds, split view, browser bars, some rotations)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(schedule);
      const parent = document.getElementById('game') ?? document.body;
      ro.observe(parent);
      ro.observe(document.documentElement);
    }
    this.schedule();
  }

  /** Refresh soon, then again after the layout has settled. */
  schedule(): void {
    // immediate pass (works even while requestAnimationFrame is throttled), then settle passes
    this.refresh();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.refresh(); });
    if (this.settleTimer) window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => { this.settleTimer = null; this.refresh(); }, 320);
    // Phaser's Scale Manager polls the parent every 500 ms; a late pass catches whatever that pass changed.
    if (this.lateTimer) window.clearTimeout(this.lateTimer);
    this.lateTimer = window.setTimeout(() => { this.lateTimer = null; this.refresh(); }, 900);
  }

  refresh(): void {
    const scale = this.game?.scale;
    if (scale) {
      // refresh() alone reuses the cached parent size; re-read the parent first so orientation changes apply
      scale.getParentBounds();
      scale.refresh();
    }
    this.measure();
  }

  private measure(): void {
    const canvas = this.game?.canvas;
    const vw = window.innerWidth, vh = window.innerHeight;
    let rect = { x: 0, y: 0, w: vw, h: vh };
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    const portrait = vh > vw;
    const next: LayoutState = { viewportW: vw, viewportH: vh, stage: rect, portrait, portraitNarrow: portrait && vw < 760 };
    const changed = JSON.stringify(next) !== JSON.stringify(this.state);
    this.state = next;
    const stage = UIRoot.stage;
    stage.style.setProperty('--stage-x', `${rect.x}px`);
    stage.style.setProperty('--stage-y', `${rect.y}px`);
    stage.style.setProperty('--stage-w', `${rect.w}px`);
    stage.style.setProperty('--stage-h', `${rect.h}px`);
    const root = document.documentElement;
    root.style.setProperty('--stage-x', `${rect.x}px`);
    root.style.setProperty('--stage-y', `${rect.y}px`);
    root.style.setProperty('--stage-w', `${rect.w}px`);
    root.style.setProperty('--stage-h', `${rect.h}px`);
    root.dataset.orientation = portrait ? 'portrait' : 'landscape';
    root.dataset.portraitNarrow = next.portraitNarrow ? '1' : '0';
    if (changed) bus.emit(Events.LayoutChanged, next);
  }
}
