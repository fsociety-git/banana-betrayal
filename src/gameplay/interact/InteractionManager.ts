/**
 * Contextual actions ("DUKKAR!", "Show me.", replies). Encounters register actions with an availability check;
 * the manager exposes the single best one so the UI can show a prompt and the interact key runs it.
 * A short cooldown stops repeated presses from stacking dialogue or animation.
 */
export interface ContextAction {
  id: string;
  /** Short label for the prompt chip, e.g. "DUKKAR!" */
  label: string;
  priority?: number;
  available(): boolean;
  run(): void;
}

export class InteractionManager {
  private actions = new Map<string, ContextAction>();
  current: ContextAction | null = null;
  private lastRunAt = -Infinity;
  cooldownMs = 650;
  onChange: ((action: ContextAction | null) => void) | null = null;

  register(action: ContextAction): void { this.actions.set(action.id, action); }
  unregister(id: string): void { this.actions.delete(id); if (this.current?.id === id) { this.current = null; this.onChange?.(null); } }

  update(): void {
    let best: ContextAction | null = null;
    for (const a of this.actions.values()) {
      if (!a.available()) continue;
      if (!best || (a.priority ?? 0) > (best.priority ?? 0)) best = a;
    }
    if (best !== this.current) { this.current = best; this.onChange?.(best); }
  }

  /** Called on the interact input. Returns true if an action ran. */
  onInteract(now: number): boolean {
    if (!this.current || now - this.lastRunAt < this.cooldownMs) return false;
    this.lastRunAt = now;
    const action = this.current;
    action.run();
    this.update();
    return true;
  }

  clear(): void { this.actions.clear(); this.current = null; this.onChange?.(null); }
}
