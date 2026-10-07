import type { LevelRecord } from '../core/save/schema';
import { InputManager } from '../core/input/InputManager';
import { formatTime } from './Hud';
import { button, el, trapFocus, UIRoot } from './UIRoot';

export interface ResultsInfo {
  levelName: string;
  levelIndex: number | null;
  timeMs: number;
  deaths: number;
  bananas: number;
  bananaTotal: number;
  best: LevelRecord | undefined;
  isNewBest: boolean;
  nextLevelId: string | null;
  pigLine: string;
  character: 'monkey' | 'pig';
}

export interface ResultsActions {
  next: () => void;
  replay: () => void;
  title: () => void;
  download: () => void;
}

/** End-of-level results card (modal). */
export class ResultsOverlay {
  private screen: HTMLElement | null = null;
  private untrap: (() => void) | null = null;

  show(info: ResultsInfo, actions: ResultsActions): void {
    this.hide();
    InputManager.instance.gameplayEnabled = false;
    InputManager.instance.releaseAll();
    const screen = el('div', 'bb-screen dim');
    const panel = el('div', 'bb-panel bb-results');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'bb-results-title');
    const kicker = el('div', 'bb-intro-kicker', info.levelIndex !== null ? `Level ${info.levelIndex} complete` : 'Complete');
    const title = el('h2', '', info.levelName); title.id = 'bb-results-title';
    const quote = el('p', 'bb-quote', `“${info.pigLine}” — ${info.character === 'pig' ? 'Monkey' : 'Pig'}`);
    const stats = el('div', 'bb-statgrid');
    const stat = (label: string, value: string, extra = ''): HTMLElement => {
      const d = el('div', `bb-stat ${extra}`.trim());
      d.append(el('div', 'bb-stat-value', value), el('div', 'bb-stat-label', label));
      return d;
    };
    stats.append(
      stat('Time', formatTime(info.timeMs), info.isNewBest ? 'best' : ''),
      stat('Deaths', String(info.deaths)),
      stat('Bananas', `${info.bananas}/${info.bananaTotal}`),
    );
    const best = el('p', 'bb-muted', info.isNewBest ? '★ New personal best!' : info.best ? `Personal best: ${formatTime(info.best.timeMs)} with ${info.best.deaths} deaths` : '');
    const row = el('div', 'bb-stack');
    if (info.nextLevelId) row.append(button('Next level', actions.next));
    row.append(button('Replay level', actions.replay, info.nextLevelId ? 'secondary' : ''));
    row.append(button('Download results card', actions.download, 'secondary'));
    row.append(button('Return to title', actions.title, 'secondary'));
    panel.append(kicker, title, quote, stats, best, row);
    screen.append(panel);
    this.screen = UIRoot.mount(screen);
    this.untrap = trapFocus(panel);
  }

  get open(): boolean { return this.screen !== null; }

  hide(): void {
    this.untrap?.(); this.untrap = null;
    this.screen?.remove(); this.screen = null;
    InputManager.instance.gameplayEnabled = true;
  }
}
