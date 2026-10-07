import { ACHIEVEMENTS } from '../content/script';
import { el, UIRoot } from './UIRoot';

/** Small, single-instance toast for achievement unlocks (queues if several unlock quickly). */
export class AchievementToast {
  private static queue: string[] = [];
  private static showing = false;

  static show(id: string): void {
    this.queue.push(id);
    if (!this.showing) this.next();
  }

  private static next(): void {
    const id = this.queue.shift();
    if (!id) { this.showing = false; return; }
    this.showing = true;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    const node = el('div', 'bb-achievement');
    node.setAttribute('role', 'status');
    const text = el('div');
    text.append(el('div', 'title', `Achievement: ${def?.title ?? id}`), el('div', 'desc', def?.description ?? ''));
    node.append(el('span', 'ico', '🏆'), text);
    UIRoot.mount(node);
    window.setTimeout(() => { node.remove(); this.next(); }, 3200);
  }
}
