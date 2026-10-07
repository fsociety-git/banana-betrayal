import { PIG_LINES } from '../../content/script';
import type { SpeechBubble } from './SpeechBubble';

export interface Speaker {
  /** Where the bubble tail should point (top of the head). */
  bubbleAnchor(): { x: number; y: number; flip: boolean };
  onSpeak?(): void;
}

/**
 * Rate-limited pig dialogue. Lines are looked up by key in content/script.ts; array values rotate.
 * - minimum gap between lines, - no key repeats within a window, - `once` keys fire a single time per level.
 * Nothing here blocks gameplay or hides required information.
 */
export class DialogueManager {
  private bubble: SpeechBubble;
  private speaker: Speaker | null = null;
  private lastSpokeAt = -Infinity;
  private busyUntil = -Infinity;
  private lastByKey = new Map<string, number>();
  private rotation = new Map<string, number>();
  private firedOnce = new Set<string>();
  private now = 0;
  minGapMs = 1800;
  repeatWindowMs = 15000;
  /** Set false in reduced-chatter contexts (e.g. speedrun replays). */
  enabled = true;
  onLine: ((key: string, text: string) => void) | null = null;

  constructor(bubble: SpeechBubble) { this.bubble = bubble; }

  setSpeaker(speaker: Speaker | null): void { this.speaker = speaker; }

  update(timeMs: number): void {
    this.now = timeMs;
    if (this.speaker && this.bubble.visible) {
      const a = this.speaker.bubbleAnchor();
      this.bubble.follow(a.x, a.y);
    }
  }

  /** Try to say a line. Returns true if it was shown. `force` ignores the gap (boss phase lines). */
  say(key: string, opts: { once?: boolean; force?: boolean; priority?: boolean } = {}): boolean {
    if (!this.enabled || !this.speaker) return false;
    if (opts.once && this.firedOnce.has(key)) return false;
    if (!opts.force) {
      if (this.now < this.busyUntil && !opts.priority) return false;
      if (this.now - this.lastSpokeAt < this.minGapMs && !opts.priority) return false;
      const last = this.lastByKey.get(key);
      if (last !== undefined && this.now - last < this.repeatWindowMs) return false;
    }
    const text = this.resolve(key);
    if (!text) return false;
    const a = this.speaker.bubbleAnchor();
    const ms = this.bubble.say(text, a.x, a.y, a.flip);
    this.speaker.onSpeak?.();
    this.lastSpokeAt = this.now;
    this.busyUntil = this.now + ms;
    this.lastByKey.set(key, this.now);
    if (opts.once) this.firedOnce.add(key);
    this.onLine?.(key, text);
    return true;
  }

  private resolve(key: string): string | null {
    const entry = PIG_LINES[key];
    if (!entry) { console.warn(`[dialogue] missing line '${key}'`); return null; }
    if (typeof entry === 'string') return entry;
    const i = this.rotation.get(key) ?? 0;
    this.rotation.set(key, (i + 1) % entry.length);
    return entry[i];
  }

  /** Forget `once` flags (new level attempt from scratch). Deaths do NOT call this. */
  resetOnce(): void { this.firedOnce.clear(); this.lastByKey.clear(); }
  hide(): void { this.bubble.hideNow(); this.busyUntil = -Infinity; }
}
