import { InputManager } from '../core/input/InputManager';
import { SaveManager } from '../core/save/SaveManager';
import type { Settings } from '../core/save/schema';
import { SettingsService } from '../core/settings/SettingsService';
import { button, el, trapFocus, UIRoot } from './UIRoot';

/** Settings dialog (semantic form controls). Works over the title screen and inside the pause menu. */
export class SettingsMenu {
  private screen: HTMLElement | null = null;
  private untrap: (() => void) | null = null;
  private onClose: (() => void) | null = null;
  private onResetProgress: (() => void) | null = null;

  show(onClose: () => void, onResetProgress?: () => void): void {
    this.hide();
    this.onClose = onClose;
    this.onResetProgress = onResetProgress ?? null;
    const svc = SettingsService.instance;
    const s = svc.settings;
    InputManager.instance.gameplayEnabled = false;
    InputManager.instance.releaseAll();
    const screen = el('div', 'bb-screen dim');
    const panel = el('div', 'bb-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'bb-settings-title');
    const title = el('h2', '', 'Settings'); title.id = 'bb-settings-title';
    const form = el('form', 'bb-stack');
    form.addEventListener('submit', (e) => e.preventDefault());

    form.append(this.range('Music volume', 'music', s.musicVolume, (v) => svc.update({ musicVolume: v })));
    form.append(this.range('Effects volume', 'sfx', s.sfxVolume, (v) => svc.update({ sfxVolume: v })));
    form.append(this.toggle('Mute everything', 'mute', s.muted, (v) => svc.update({ muted: v })));
    form.append(this.select('Graphics quality', 'quality', s.quality, [['high', 'High — full effects'], ['balanced', 'Balanced — fewer particles'], ['low', 'Low — simple backgrounds']], (v) => svc.update({ quality: v as Settings['quality'] }), 'Low also renders at 1× on high-density screens.'));
    form.append(this.select('Reduced motion', 'motion', s.reducedMotion, [['system', 'Follow system setting'], ['on', 'On'], ['off', 'Off']], (v) => svc.update({ reducedMotion: v as Settings['reducedMotion'] }), 'Calms squash, bobbing, intro cards and particles.'));
    form.append(this.toggle('Screen shake', 'shake', s.screenShake, (v) => svc.update({ screenShake: v })));
    form.append(this.select('Touch controls', 'touch', s.touchControls, [['auto', 'Automatic'], ['on', 'Always show'], ['off', 'Never show']], (v) => svc.update({ touchControls: v as Settings['touchControls'] })));
    form.append(this.toggle('Show level timer', 'timer', s.showTimer, (v) => svc.update({ showTimer: v })));
    form.append(this.toggle('Larger interface text', 'largetext', s.largeText, (v) => svc.update({ largeText: v })));
    const assistHead = el('h2', 'bb-section', 'Assist mode');
    assistHead.style.fontSize = '1.1rem';
    form.append(assistHead);
    form.append(this.toggle('Enable assist mode', 'assist', s.assist.enabled, (v) => svc.update({ assist: { ...svc.settings.assist, enabled: v } }), 'Records set with assist on are kept separately. No judgement — Dukkar does enough of that.'));
    form.append(this.toggle('Slower hazard cycles', 'assist-slow', s.assist.slowHazards, (v) => svc.update({ assist: { ...svc.settings.assist, slowHazards: v } })));
    form.append(this.toggle('Extra checkpoints', 'assist-cp', s.assist.extraCheckpoints, (v) => svc.update({ assist: { ...svc.settings.assist, extraCheckpoints: v } })));

    const footer = el('div', 'bb-row');
    const store = SaveManager.instance.persistent ? '' : 'Storage unavailable: settings last for this session only.';
    footer.append(el('span', 'bb-muted', store));
    const buttons = el('div', 'bb-row');
    if (this.onResetProgress) buttons.append(button('Reset progress…', () => this.confirmReset(), 'danger small'));
    buttons.append(button('Done', () => this.close(), 'small'));
    footer.append(buttons);
    panel.append(title, form, footer);
    screen.append(panel);
    this.screen = UIRoot.mount(screen);
    this.untrap = trapFocus(panel);
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } };
    panel.addEventListener('keydown', onKey);
  }

  private confirmReset(): void {
    const ok = window.confirm('Reset all saved progress, records and ghosts? Settings are kept. This cannot be undone.');
    if (!ok) return;
    SaveManager.instance.resetProgress();
    UIRoot.toast('Progress reset. Dukkar is thrilled.');
    this.onResetProgress?.();
    this.close();
  }

  private field(label: string, id: string, control: HTMLElement, hint?: string): HTMLElement {
    const wrap = el('div', 'bb-field');
    const l = el('label', '', label);
    l.htmlFor = id;
    control.id = id;
    wrap.append(l, control);
    if (hint) wrap.append(el('div', 'hint', hint));
    return wrap;
  }

  private range(label: string, id: string, value: number, onChange: (v: number) => void): HTMLElement {
    const input = el('input');
    input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.05'; input.value = String(value);
    input.addEventListener('input', () => onChange(Number(input.value)));
    return this.field(label, `bb-set-${id}`, input);
  }

  private toggle(label: string, id: string, value: boolean, onChange: (v: boolean) => void, hint?: string): HTMLElement {
    const input = el('input');
    input.type = 'checkbox'; input.checked = value;
    input.addEventListener('change', () => onChange(input.checked));
    return this.field(label, `bb-set-${id}`, input, hint);
  }

  private select(label: string, id: string, value: string, options: [string, string][], onChange: (v: string) => void, hint?: string): HTMLElement {
    const sel = el('select');
    for (const [v, text] of options) { const o = el('option', '', text); o.value = v; if (v === value) o.selected = true; sel.append(o); }
    sel.addEventListener('change', () => onChange(sel.value));
    return this.field(label, `bb-set-${id}`, sel, hint);
  }

  get open(): boolean { return this.screen !== null; }

  private close(): void { const cb = this.onClose; this.hide(); cb?.(); }

  hide(): void {
    this.untrap?.(); this.untrap = null;
    this.screen?.remove(); this.screen = null;
  }
}
