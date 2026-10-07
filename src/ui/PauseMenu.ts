import { InputManager } from '../core/input/InputManager';
import { button, el, trapFocus, UIRoot } from './UIRoot';

export interface PauseActions {
  resume: () => void;
  restart: () => void;
  settings: () => void;
  quit: () => void;
}

/** Modal pause menu. Owns the keyboard while open (gameplay input is disabled). */
export class PauseMenu {
  private screen: HTMLElement | null = null;
  private untrap: (() => void) | null = null;
  private actions: PauseActions;
  constructor(actions: PauseActions) { this.actions = actions; }

  get open(): boolean { return this.screen !== null; }

  show(levelName: string): void {
    if (this.screen) return;
    InputManager.instance.gameplayEnabled = false;
    InputManager.instance.releaseAll();
    const screen = el('div', 'bb-screen dim');
    const panel = el('div', 'bb-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'bb-pause-title');
    const title = el('h2', '', 'Paused');
    title.id = 'bb-pause-title';
    const sub = el('p', 'bb-muted', levelName);
    const stack = el('div', 'bb-stack');
    stack.append(
      button('Resume', () => this.actions.resume()),
      button('Restart from checkpoint', () => this.actions.restart(), 'secondary'),
      button('Settings', () => this.actions.settings(), 'secondary'),
      button('Return to title', () => this.actions.quit(), 'secondary'),
    );
    const hint = el('p', 'bb-muted');
    hint.innerHTML = '<span class="bb-kbd">Esc</span> resume · <span class="bb-kbd">R</span> restart · <span class="bb-kbd">M</span> mute';
    panel.append(title, sub, stack, hint);
    screen.append(panel);
    this.screen = UIRoot.mount(screen);
    this.untrap = trapFocus(panel);
  }

  hide(): void {
    this.untrap?.();
    this.untrap = null;
    this.screen?.remove();
    this.screen = null;
    InputManager.instance.gameplayEnabled = true;
  }
}
