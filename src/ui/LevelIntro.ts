import { el, UIRoot } from './UIRoot';

/** Non-blocking level title card shown for a couple of seconds at level start. */
export class LevelIntro {
  private node: HTMLElement | null = null;
  private timer: number | null = null;

  show(index: number | null, title: string, subtitle: string, ms = 2600): void {
    this.hide();
    const wrap = el('div', 'bb-intro');
    wrap.setAttribute('aria-live', 'polite');
    const card = el('div', 'bb-intro-card');
    if (index !== null) card.append(el('div', 'bb-intro-kicker', `Level ${index}`));
    card.append(el('h2', 'bb-intro-title', title), el('p', 'bb-intro-sub', subtitle));
    wrap.append(card);
    this.node = UIRoot.mount(wrap);
    this.timer = window.setTimeout(() => { wrap.classList.add('out'); window.setTimeout(() => this.hide(), 450); }, ms);
  }

  hide(): void {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.node?.remove();
    this.node = null;
  }
}
