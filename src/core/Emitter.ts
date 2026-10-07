/** Minimal typed event emitter with no Phaser dependency (safe to import in Node tests). */
export type Listener = (...args: unknown[]) => void;

export class Emitter {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, fn: Listener): this {
    (this.listeners.get(event) ?? this.listeners.set(event, new Set()).get(event)!).add(fn);
    return this;
  }
  once(event: string, fn: Listener): this {
    const wrapper: Listener = (...args) => { this.off(event, wrapper); fn(...args); };
    return this.on(event, wrapper);
  }
  off(event: string, fn?: Listener): this {
    if (!fn) this.listeners.delete(event);
    else this.listeners.get(event)?.delete(fn);
    return this;
  }
  emit(event: string, ...args: unknown[]): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const fn of [...set]) fn(...args);
    return true;
  }
  removeAllListeners(): void { this.listeners.clear(); }
}
