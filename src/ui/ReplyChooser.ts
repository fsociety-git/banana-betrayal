import { InputManager } from '../core/input/InputManager';
import { el, UIRoot } from './UIRoot';

export interface ReplyOption { id: string; label: string; }

/**
 * Quick three-option reply strip for Makad. Keyboard: 1/2/3, arrows + Enter/E; touch: tap. Gameplay input is
 * paused while it is open so a jump key never doubles as an answer. Auto-closes with no choice after a timeout.
 */
export class ReplyChooser {
  private node: HTMLElement | null = null;
  private timer: number | null = null;
  private onKey: ((e: KeyboardEvent) => void) | null = null;

  get open(): boolean { return this.node !== null; }

  show(title: string | null, options: ReplyOption[], onPick: (id: string | null) => void, timeoutMs = 9000): void {
    this.hide();
    InputManager.instance.gameplayEnabled = false;
    InputManager.instance.releaseAll();
    const wrap = el('div', 'bb-replies');
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', title ?? 'Reply');
    if (title) wrap.append(el('div', 'bb-replies-title', title));
    const list = el('div', 'bb-replies-list');
    const buttons: HTMLButtonElement[] = [];
    options.forEach((o, i) => {
      const b = el('button', 'bb-reply', `${i + 1}  ${o.label}`);
      b.type = 'button';
      b.addEventListener('click', () => finish(o.id));
      buttons.push(b);
      list.append(b);
    });
    wrap.append(list);
    this.node = UIRoot.mountOnStage(wrap);
    let focus = 0;
    const setFocus = (i: number): void => { focus = (i + buttons.length) % buttons.length; buttons.forEach((b, k) => b.classList.toggle('focus', k === focus)); buttons[focus].focus(); };
    setFocus(0);
    const finish = (id: string | null): void => { this.hide(); onPick(id); };
    this.onKey = (e: KeyboardEvent): void => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) { e.preventDefault(); e.stopPropagation(); finish(options[n - 1].id); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyW') { e.preventDefault(); e.stopPropagation(); setFocus(focus - 1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyS') { e.preventDefault(); e.stopPropagation(); setFocus(focus + 1); }
      else if (e.key === 'Enter' || e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); finish(options[focus].id); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
    };
    window.addEventListener('keydown', this.onKey, true);
    if (timeoutMs > 0) this.timer = window.setTimeout(() => finish(null), timeoutMs);
  }

  hide(): void {
    if (this.onKey) window.removeEventListener('keydown', this.onKey, true);
    this.onKey = null;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    if (this.node) { this.node.remove(); this.node = null; InputManager.instance.gameplayEnabled = true; }
  }
}
