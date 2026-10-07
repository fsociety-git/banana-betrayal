import { Events, bus } from '../core/events';
import { InputManager } from '../core/input/InputManager';
import type { LayoutState } from './Layout';
import { el, UIRoot } from './UIRoot';

export type TouchMode = 'auto' | 'on' | 'off';

/**
 * On-screen controls: left/right pad on the left thumb, jump on the right thumb. Multi-touch safe,
 * sliding between left/right keeps the pointer captured, and the page never scrolls.
 */
export class TouchControls {
  private static _instance: TouchControls | null = null;
  static get instance(): TouchControls { return (this._instance ??= new TouchControls()); }

  private root: HTMLElement;
  private mode: TouchMode = 'auto';
  private visibleWhenPlaying = false;
  private buttons = new Map<'left' | 'right' | 'jump' | 'bonk' | 'interact', HTMLButtonElement>();
  private pointerAction = new Map<number, 'left' | 'right' | 'jump' | 'bonk' | 'interact'>();

  private constructor() {
    this.root = el('div', 'bb-touch');
    this.root.setAttribute('aria-hidden', 'true');
    const padL = el('div', 'pad left');
    const padR = el('div', 'pad right');
    padL.append(this.makeButton('left', '◀'), this.makeButton('right', '▶'));
    const cluster = el('div', 'cluster');
    cluster.append(this.makeButton('interact', '!'), this.makeButton('bonk', 'BONK'));
    padR.append(cluster, this.makeButton('jump', 'JUMP'));
    this.root.append(padL, padR);
    UIRoot.mount(this.root);
    for (const type of ['touchstart', 'touchmove'] as const) {
      this.root.addEventListener(type, (e) => { if (e.target instanceof HTMLButtonElement) e.preventDefault(); }, { passive: false });
    }
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.refresh(); }, { passive: true, once: true });
    bus.on(Events.LayoutChanged, (state: unknown) => this.layout(state as LayoutState));
  }

  private padL: HTMLElement | null = null;
  private padR: HTMLElement | null = null;

  /**
   * In wide landscape the canvas is letterboxed left/right; when those margins are wide enough the pads move
   * into them so thumbs never cover the playfield. Otherwise they sit in the safe-area corners.
   */
  private layout(state: LayoutState): void {
    const padL = this.padL ?? (this.padL = this.root.querySelector('.pad.left'));
    const padR = this.padR ?? (this.padR = this.root.querySelector('.pad.right'));
    if (!padL || !padR) return;
    const margin = state.stage.x;
    const padW = padL.getBoundingClientRect().width || 150;
    const jumpW = padR.getBoundingClientRect().width || 90;
    const inMargins = !state.portrait && margin >= Math.max(padW, jumpW) + 20;
    this.root.classList.toggle('in-margins', inMargins);
    padL.style.left = inMargins ? `${Math.max(8, margin - padW - 10)}px` : '';
    padR.style.right = inMargins ? `${Math.max(8, margin - jumpW - 10)}px` : '';
    // portrait: keep the pads just under the playfield strip when there is room
    const below = state.portrait ? state.stage.y + state.stage.h : 0;
    const roomBelow = state.viewportH - below;
    const underStrip = state.portrait && roomBelow > 140;
    this.root.classList.toggle('under-strip', underStrip);
    this.root.style.setProperty('--pad-bottom', underStrip ? `${Math.max(16, roomBelow - 120)}px` : '');
  }

  private makeButton(action: 'left' | 'right' | 'jump' | 'bonk' | 'interact', label: string): HTMLButtonElement {
    const b = el('button', action === 'jump' ? 'jump' : action === 'bonk' ? 'bonk' : action === 'interact' ? 'talk' : 'dir', label);
    b.type = 'button';
    const labels = { jump: 'Jump', left: 'Move left', right: 'Move right', bonk: 'Bonk', interact: 'Talk back' } as const;
    b.setAttribute('aria-label', labels[action]);
    const input = InputManager.instance;
    const press = (e: PointerEvent): void => {
      e.preventDefault();
      // capture keeps the release on this button even if the thumb drifts; some browsers throw for odd pointers
      try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      this.pointerAction.set(e.pointerId, action);
      input.setTouch(action, true);
      b.classList.add('pressed');
    };
    const release = (e: PointerEvent): void => {
      const held = this.pointerAction.get(e.pointerId);
      if (!held) return;
      this.pointerAction.delete(e.pointerId);
      input.setTouch(held, false);
      this.buttons.get(held)?.classList.remove('pressed');
    };
    const move = (e: PointerEvent): void => {
      const held = this.pointerAction.get(e.pointerId);
      if (!held || held === 'jump') return;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const other = held === 'left' ? 'right' : 'left';
      if (under === this.buttons.get(other)) {
        input.setTouch(held, false); this.buttons.get(held)?.classList.remove('pressed');
        input.setTouch(other, true); this.buttons.get(other)?.classList.add('pressed');
        this.pointerAction.set(e.pointerId, other);
      }
    };
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('pointermove', move);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    this.buttons.set(action, b);
    return b;
  }

  /** Dim the talk button when Makad has nothing to say. */
  setTalkAvailable(on: boolean): void {
    const b = this.buttons.get('interact');
    if (!b) return;
    b.classList.toggle('available', on);
    b.setAttribute('aria-disabled', on ? 'false' : 'true');
  }

  setMode(mode: TouchMode): void { this.mode = mode; this.refresh(); }
  /** Gameplay scenes call this with true; menus with false. */
  setPlaying(playing: boolean): void { this.visibleWhenPlaying = playing; this.refresh(); }

  private shouldShow(): boolean {
    if (!this.visibleWhenPlaying) return false;
    if (this.mode === 'on') return true;
    if (this.mode === 'off') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return coarse || InputManager.instance.touchSeen;
  }

  refresh(): void {
    const show = this.shouldShow();
    this.root.classList.toggle('visible', show);
    this.root.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (!show) {
      for (const [id, action] of this.pointerAction) { InputManager.instance.setTouch(action, false); this.pointerAction.delete(id); }
      this.buttons.forEach((b) => b.classList.remove('pressed'));
    }
  }
}
