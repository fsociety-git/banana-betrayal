import { CREDITS, FIRST_RUN } from '../content/script';
import { InputManager } from '../core/input/InputManager';
import { button, el, trapFocus, UIRoot } from './UIRoot';

/** Small modal helpers: credits, first-run controls card, character picker. */
export class SimpleDialog {
  private screen: HTMLElement | null = null;
  private untrap: (() => void) | null = null;

  open(build: (panel: HTMLElement, close: () => void) => void, onClose?: () => void): void {
    this.hide();
    InputManager.instance.gameplayEnabled = false;
    const screen = el('div', 'bb-screen dim');
    const panel = el('div', 'bb-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    const close = (): void => { this.hide(); onClose?.(); };
    build(panel, close);
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    screen.append(panel);
    this.screen = UIRoot.mount(screen);
    this.untrap = trapFocus(panel);
  }

  get isOpen(): boolean { return this.screen !== null; }
  hide(): void { this.untrap?.(); this.untrap = null; this.screen?.remove(); this.screen = null; }
}

export function showCredits(dialog: SimpleDialog, onClose: () => void): void {
  dialog.open((panel, close) => {
    panel.append(el('h2', '', 'Credits'));
    const dl = el('dl', 'bb-credits-list');
    for (const c of CREDITS) dl.append(el('dt', '', c.role), el('dd', '', c.name));
    panel.append(dl);
    panel.append(el('p', 'bb-muted', 'No real bananas were consulted. Any resemblance to actual pigs is intentional.'));
    panel.append(button('Back', close, 'secondary small'));
  }, onClose);
}

export function showFirstRun(dialog: SimpleDialog, onDone: () => void): void {
  dialog.open((panel, close) => {
    panel.append(el('h2', '', FIRST_RUN.title));
    const list = el('ul', 'bb-stack');
    list.style.paddingLeft = '1.2em';
    for (const line of FIRST_RUN.lines) list.append(el('li', '', line));
    panel.append(list);
    const row = el('div', 'bb-row');
    row.append(button('Got it, let\'s go', close), button('Skip', close, 'secondary small'));
    panel.append(row);
  }, onDone);
}

export function showCharacterPicker(dialog: SimpleDialog, base: string, onPick: (c: 'monkey' | 'pig') => void, onClose: () => void): void {
  dialog.open((panel, close) => {
    panel.append(el('h2', '', 'Who is playing?'));
    panel.append(el('p', 'bb-muted', 'The pig unlocked himself. He says it was always the plan.'));
    const row = el('div', 'bb-row');
    row.style.justifyContent = 'center';
    for (const c of ['monkey', 'pig'] as const) {
      const card = el('button', 'bb-level-card');
      card.type = 'button';
      card.style.alignItems = 'center';
      const img = el('img');
      img.src = `${base}assets/characters/${c}.png`;
      img.alt = c === 'monkey' ? 'The monkey' : 'The pig';
      img.style.height = '140px';
      card.append(img, el('div', 'name', c === 'monkey' ? 'Monkey' : 'Pig'));
      card.addEventListener('click', () => { dialog.hide(); onPick(c); });
      row.append(card);
    }
    panel.append(row, button('Back', close, 'secondary small'));
  }, onClose);
}
