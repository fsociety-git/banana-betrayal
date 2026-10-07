import { el, UIRoot } from './UIRoot';

/** Death captions and short one-liners, centred low on screen so they never cover the next jump. */
export class CaptionLayer {
  private wrap: HTMLElement;
  private timer: number | null = null;

  constructor() {
    this.wrap = el('div', 'bb-caption-wrap');
    this.wrap.setAttribute('aria-live', 'polite');
    UIRoot.mountOnStage(this.wrap);
  }

  show(text: string, ms = 1400): void {
    this.wrap.replaceChildren(el('div', 'bb-caption', text));
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.clear(), ms);
  }
  clear(): void { this.wrap.replaceChildren(); }
  destroy(): void { if (this.timer) window.clearTimeout(this.timer); this.wrap.remove(); }
}
