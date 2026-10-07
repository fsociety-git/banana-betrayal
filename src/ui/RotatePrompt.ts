import { Events, bus } from '../core/events';
import { button, el, trapFocus, UIRoot } from './UIRoot';
import { LayoutManager, type LayoutState } from './Layout';

const KEY = 'bb-rotate-dismissed';

/**
 * Friendly "rotate for the best experience" card shown once per session when a narrow screen is held in
 * portrait. Never blocks: Continue keeps playing in portrait; turning the device dismisses it automatically.
 */
export class RotatePrompt {
  private static _instance: RotatePrompt | null = null;
  static get instance(): RotatePrompt { return (this._instance ??= new RotatePrompt()); }

  private node: HTMLElement | null = null;
  private untrap: (() => void) | null = null;
  private dismissed = false;

  private constructor() {
    try { this.dismissed = sessionStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }
    bus.on(Events.LayoutChanged, (state: unknown) => this.onLayout(state as LayoutState));
    this.onLayout(LayoutManager.instance.state);
  }

  get open(): boolean { return this.node !== null; }

  private onLayout(state: LayoutState): void {
    if (state.portraitNarrow) { if (!this.dismissed && !this.node) this.show(); }
    else if (this.node) this.hide();
  }

  private show(): void {
    const screen = el('div', 'bb-screen dim bb-rotate');
    const panel = el('div', 'bb-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'bb-rotate-title');
    const icon = el('div', 'bb-phone');
    icon.setAttribute('aria-hidden', 'true');
    icon.append(el('div', 'bb-phone-screen'));
    const title = el('h2', '', 'Rotate for the best experience'); title.id = 'bb-rotate-title';
    const text = el('p', '', 'Banana Betrayal is a wide game. Landscape shows what Dukkar has planned ahead of you. You can keep playing in portrait if you prefer.');
    const row = el('div', 'bb-stack');
    row.append(button('Continue in portrait', () => this.dismiss()));
    panel.append(icon, title, text, row);
    screen.append(panel);
    this.node = UIRoot.mount(screen);
    this.untrap = trapFocus(panel);
    bus.emit(Events.RotatePromptShown);
  }

  private dismiss(): void {
    this.dismissed = true;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    this.hide();
  }

  private hide(): void {
    this.untrap?.(); this.untrap = null;
    this.node?.remove(); this.node = null;
    bus.emit(Events.RotatePromptHidden);
  }
}
