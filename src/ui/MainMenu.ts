import { NAMES } from '../content/script';
import { InputManager } from '../core/input/InputManager';
import { SaveManager } from '../core/save/SaveManager';
import { CAMPAIGN } from '../levels';
import { button, el, trapFocus, UIRoot } from './UIRoot';

export interface MenuActions {
  play: () => void;
  levelSelect: () => void;
  settings: () => void;
  credits: () => void;
}

/** Title-screen menu (DOM, keyboard operable). The Phaser Title scene draws the characters behind it. */
export class MainMenu {
  private node: HTMLElement | null = null;
  private untrap: (() => void) | null = null;

  show(actions: MenuActions): void {
    this.hide();
    InputManager.instance.gameplayEnabled = false;
    const save = SaveManager.instance;
    const progress = save.data.progress;
    const completedCount = CAMPAIGN.filter((id) => progress.completed[id]).length;
    const hasProgress = completedCount > 0 && !progress.campaignComplete;
    const wrap = el('div', 'bb-title-menu');
    const logo = el('div', 'bb-logo');
    logo.append(el('div', 'bb-logo-top', 'BANANA'), el('div', 'bb-logo-bottom', 'BETRAYAL'));
    const sub = el('p', 'bb-logo-sub', NAMES.subtitle);
    const stack = el('div', 'bb-stack bb-title-actions');
    const primary = button(hasProgress ? `Continue · Level ${completedCount + 1}` : progress.campaignComplete ? 'Play again' : 'Play', actions.play);
    primary.classList.add('bb-primary');
    stack.append(primary);
    const row = el('div', 'bb-row bb-title-secondary');
    const lvl = button('Levels', actions.levelSelect, 'secondary small');
    if (completedCount === 0) lvl.disabled = true;
    row.append(lvl, button('Settings', actions.settings, 'secondary small'), button('Credits', actions.credits, 'secondary small'));
    stack.append(row);
    const hint = el('p', 'bb-muted bb-title-hint');
    hint.innerHTML = '<span class="bb-kbd">←</span><span class="bb-kbd">→</span> move · <span class="bb-kbd">Space</span> jump · <span class="bb-kbd">J</span> bonk · <span class="bb-kbd">E</span> talk · <span class="bb-kbd">Esc</span> pause · <span class="bb-kbd">M</span> mute';
    wrap.append(logo, sub, stack, hint);
    if (progress.pigUnlocked) wrap.append(el('p', 'bb-unlock-badge', '🐷 Dukkar unlocked — choose a character when you press Play'));
    this.node = UIRoot.mount(wrap);
    this.untrap = trapFocus(wrap);
  }

  hide(): void {
    this.untrap?.(); this.untrap = null;
    this.node?.remove(); this.node = null;
  }
}
