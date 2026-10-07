import { el, UIRoot } from './UIRoot';

/** Compact gameplay HUD: bananas, deaths, optional timer, checkpoint pop, pause button. */
export class Hud {
  private root: HTMLElement;
  private bananaChip: HTMLElement;
  private bananaValue: HTMLElement;
  private deathValue: HTMLElement;
  private timerChip: HTMLElement;
  private checkpointSlot: HTMLElement;
  private onPause: () => void;

  constructor(onPause: () => void, showTimer: boolean) {
    this.onPause = onPause;
    this.root = el('div', 'bb-hud');
    this.root.setAttribute('role', 'status');
    const stats = el('div', 'bb-stats');
    this.bananaChip = el('span', 'bb-chip');
    this.bananaChip.append(el('span', 'ico', '🍌'), (this.bananaValue = el('span', '', '0')));
    this.bananaChip.setAttribute('aria-label', 'Bananas collected');
    const deathChip = el('span', 'bb-chip');
    deathChip.append(el('span', 'ico', '💀'), (this.deathValue = el('span', '', '0')));
    deathChip.setAttribute('aria-label', 'Deaths');
    this.timerChip = el('span', 'bb-chip timer', '0:00.0');
    this.timerChip.setAttribute('aria-label', 'Level timer');
    this.timerChip.style.display = showTimer ? '' : 'none';
    this.checkpointSlot = el('span');
    stats.append(this.bananaChip, deathChip, this.timerChip, this.checkpointSlot);
    const pause = el('button', 'bb-iconbtn', '❚❚');
    pause.type = 'button';
    pause.setAttribute('aria-label', 'Pause (Escape)');
    pause.addEventListener('click', () => this.onPause());
    this.root.append(stats, pause);
    UIRoot.mountOnStage(this.root);
  }

  setBananas(n: number, total?: number): void {
    this.bananaValue.textContent = total !== undefined ? `${n}/${total}` : String(n);
    this.bananaChip.classList.remove('pop');
    void this.bananaChip.offsetWidth;
    this.bananaChip.classList.add('pop');
    window.setTimeout(() => this.bananaChip.classList.remove('pop'), 150);
  }
  setDeaths(n: number): void { this.deathValue.textContent = String(n); }
  setTimer(ms: number): void { this.timerChip.textContent = formatTime(ms); }
  setTimerVisible(v: boolean): void { this.timerChip.style.display = v ? '' : 'none'; }
  flashCheckpoint(label = 'Checkpoint'): void {
    const chip = el('span', 'bb-chip checkpoint', `✔ ${label}`);
    this.checkpointSlot.replaceChildren(chip);
    window.setTimeout(() => chip.remove(), 1700);
  }
  private bossChip: HTMLElement | null = null;
  /** Show the pig's remaining hits (null hides the bar). */
  setBoss(hp: number | null, max = 3): void {
    if (hp === null) { this.bossChip?.remove(); this.bossChip = null; return; }
    if (!this.bossChip) { this.bossChip = el('span', 'bb-chip boss'); this.bossChip.setAttribute('aria-label', 'Pig health'); this.root.querySelector('.bb-stats')?.append(this.bossChip); }
    this.bossChip.replaceChildren(el('span', 'ico', '🐷'), el('span', '', '♥'.repeat(hp) + '♡'.repeat(Math.max(0, max - hp))));
    this.bossChip.classList.remove('pop'); void this.bossChip.offsetWidth; this.bossChip.classList.add('pop');
  }
  setVisible(v: boolean): void { this.root.style.display = v ? '' : 'none'; }
  destroy(): void { this.root.remove(); }
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`;
}
