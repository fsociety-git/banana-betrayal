import { InputManager } from '../core/input/InputManager';
import { SaveManager } from '../core/save/SaveManager';
import { SettingsService } from '../core/settings/SettingsService';
import { NAMES } from '../content/script';
import { CAMPAIGN, getLevel } from '../levels';
import { formatTime } from './Hud';
import { button, el, trapFocus, UIRoot } from './UIRoot';

/** Grid of campaign levels. Completed levels (and the next one) can be replayed with the timer on. */
export class LevelSelectMenu {
  private screen: HTMLElement | null = null;
  private untrap: (() => void) | null = null;

  show(character: 'monkey' | 'pig', onPick: (levelId: string) => void, onClose: () => void): void {
    this.hide();
    InputManager.instance.gameplayEnabled = false;
    const save = SaveManager.instance;
    const assist = SettingsService.instance.assist;
    const screen = el('div', 'bb-screen dim');
    const panel = el('div', 'bb-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'bb-levels-title');
    const title = el('h2', '', 'Levels'); title.id = 'bb-levels-title';
    const sub = el('p', 'bb-muted', `Replay mode: timer on, personal bests tracked${assist ? ' (assist records)' : ''}. Playing as ${character === 'pig' ? NAMES.rival : NAMES.hero}.`);
    const grid = el('div', 'bb-levels');
    CAMPAIGN.forEach((id, i) => {
      const level = getLevel(id);
      const unlocked = i === 0 || !!save.data.progress.completed[CAMPAIGN[i - 1]];
      const card = el('button', 'bb-level-card');
      card.type = 'button';
      card.disabled = !unlocked;
      const rec = save.getRecord(id, character, assist);
      const done = !!save.data.progress.completed[id];
      card.append(el('div', 'num', `Level ${i + 1}${done ? ' ✔' : ''}`), el('div', 'name', unlocked ? level.name : '???'));
      card.append(el('div', 'meta', rec ? `Best ${formatTime(rec.timeMs)} · ${rec.deaths} deaths · ${rec.bananas} 🍌` : unlocked ? 'No record yet' : 'Finish the previous level'));
      card.addEventListener('click', () => { if (unlocked) { this.hide(); onPick(id); } });
      grid.append(card);
    });
    const close = button('Back', () => { this.hide(); onClose(); }, 'secondary small');
    panel.append(title, sub, grid, close);
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.hide(); onClose(); } });
    screen.append(panel);
    this.screen = UIRoot.mount(screen);
    this.untrap = trapFocus(panel);
  }

  hide(): void { this.untrap?.(); this.untrap = null; this.screen?.remove(); this.screen = null; }
}
