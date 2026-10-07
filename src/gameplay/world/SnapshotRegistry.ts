/**
 * Checkpoint reset model. Every object whose state can change during play registers a snapshot/restore pair.
 * When a checkpoint is reached we `capture()` a baseline; on death we `restore()` it. Nothing is reset by
 * guesswork — if an object can change, it is registered here. Pure TypeScript so it is unit-testable.
 */
export interface Resettable<S = unknown> {
  snapshot(): S;
  restore(state: S): void;
}

export type Snapshot = Map<string, unknown>;

export class SnapshotRegistry {
  private entries = new Map<string, Resettable>();
  private baseline: Snapshot | null = null;

  register(id: string, target: Resettable): void {
    if (this.entries.has(id)) throw new Error(`Resettable id '${id}' registered twice`);
    this.entries.set(id, target);
  }

  unregister(id: string): void { this.entries.delete(id); }

  /** Capture the current state of everything as the new baseline. */
  capture(): Snapshot {
    const snap: Snapshot = new Map();
    for (const [id, target] of this.entries) snap.set(id, structuredCloneSafe(target.snapshot()));
    this.baseline = snap;
    return snap;
  }

  /** Restore to the last captured baseline (or to an explicit snapshot). Returns false if none exists. */
  restore(snapshot: Snapshot | null = this.baseline): boolean {
    if (!snapshot) return false;
    for (const [id, target] of this.entries) {
      if (snapshot.has(id)) target.restore(structuredCloneSafe(snapshot.get(id)));
    }
    return true;
  }

  get hasBaseline(): boolean { return this.baseline !== null; }
  get size(): number { return this.entries.size; }
  clear(): void { this.entries.clear(); this.baseline = null; }
}

function structuredCloneSafe<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  return structuredClone(v);
}
