import { InputManager } from '../core/input/InputManager';
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
  private buttons = new Map<'left' | 'right' | 'jump', HTMLButtonElement>();
  private pointerAction = new Map<number, 'left' | 'right' | 'jump'>();

  private constructor() {
    this.root = el('div', 'bb-touch');
    this.root.setAttribute('aria-hidden', 'true');
    const padL = el('div', 'pad left');
    const padR = el('div', 'pad right');
    padL.append(this.makeButton('left', '◀'), this.makeButton('right', '▶'));
    padR.append(this.makeButton('jump', 'JUMP'));
    this.root.append(padL, padR);
    UIRoot.mount(this.root);
    for (const type of ['touchstart', 'touchmove'] as const) {
      this.root.addEventListener(type, (e) => { if (e.target instanceof HTMLButtonElement) e.preventDefault(); }, { passive: false });
    }
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.refresh(); }, { passive: true, once: true });
  }

  private makeButton(action: 'left' | 'right' | 'jump', label: string): HTMLButtonElement {
    const b = el('button', action === 'jump' ? 'jump' : 'dir', label);
    b.type = 'button';
    b.setAttribute('aria-label', action === 'jump' ? 'Jump' : action === 'left' ? 'Move left' : 'Move right');
    const input = InputManager.instance;
    const press = (e: PointerEvent): void => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
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
