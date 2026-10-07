import { el, UIRoot } from '../ui/UIRoot';

/** Developer overlay: live state text + action buttons. Toggle with ` or F3. Zero cost when hidden. */
export class DevOverlay {
  private static _instance: DevOverlay | null = null;
  static get instance(): DevOverlay { return (this._instance ??= new DevOverlay()); }

  private root: HTMLElement;
  private text: HTMLElement;
  private actions: HTMLElement;
  private provider: (() => string) | null = null;
  private frameTimes: number[] = [];
  private lastTick = performance.now();
  visible = false;

  private constructor() {
    this.root = el('div', 'bb-dev');
    this.root.style.display = 'none';
    this.text = el('div');
    this.actions = el('div');
    this.root.append(this.text, this.actions);
    UIRoot.mountOnStage(this.root);
  }

  toggle(): void { this.setVisible(!this.visible); }
  setVisible(v: boolean): void { this.visible = v; this.root.style.display = v ? 'block' : 'none'; }

  /** The active gameplay scene registers what to show and which buttons to offer. */
  bind(provider: () => string, actions: { label: string; onClick: () => void }[]): void {
    this.provider = provider;
    this.actions.replaceChildren(...actions.map((a) => { const b = el('button', '', a.label); b.type = 'button'; b.addEventListener('click', a.onClick); return b; }));
  }
  unbind(): void { this.provider = null; this.actions.replaceChildren(); this.text.textContent = ''; }

  /** Call once per frame from the gameplay scene. */
  tick(): void {
    const now = performance.now();
    this.frameTimes.push(now - this.lastTick);
    this.lastTick = now;
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    if (!this.visible) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, this.frameTimes.length);
    const worst = Math.max(...this.frameTimes);
    const head = `frame ${avg.toFixed(1)}ms avg / ${worst.toFixed(1)}ms worst (${(1000 / Math.max(0.01, avg)).toFixed(0)} fps)`;
    this.text.textContent = head + '\n' + (this.provider ? this.provider() : '');
  }

  get averageFrameMs(): number { return this.frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, this.frameTimes.length); }
}
