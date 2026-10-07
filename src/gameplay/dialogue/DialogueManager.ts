import { DUKKAR_LINES } from '../../content/script';
import { DialoguePolicy, type SayOptions } from './DialoguePolicy';
import type { SpeechBubble } from './SpeechBubble';

export interface Speaker {
  /** Where the bubble tail should point (top of the head). */
  bubbleAnchor(): { x: number; y: number; flip: boolean };
  onSpeak?(): void;
}

/** Keys that count as taunts (suppressed after repeated failures). */
const TAUNT_KEYS = /^(death-tease|idle-tease|react-waiting|react-return|chase-taunt)$/;

/**
 * Rate-limited Dukkar dialogue. Lines are looked up by key in content/script.ts; array values rotate.
 * Scheduling rules live in DialoguePolicy (unit-tested). Nothing here blocks gameplay or hides required information.
 */
export class DialogueManager {
  private bubble: SpeechBubble;
  private speaker: Speaker | null = null;
  private rotation = new Map<string, number>();
  private now = 0;
  readonly policy = new DialoguePolicy();
  /** Set false in reduced-chatter contexts (e.g. speedrun replays). */
  enabled = true;
  onLine: ((key: string, text: string) => void) | null = null;

  constructor(bubble: SpeechBubble) { this.bubble = bubble; }

  setSpeaker(speaker: Speaker | null): void { this.speaker = speaker; }
  get currentSpeaker(): Speaker | null { return this.speaker; }

  update(timeMs: number, airborne = false): void {
    this.now = timeMs;
    this.policy.airborne = airborne;
    if (this.speaker && this.bubble.visible) {
      const a = this.speaker.bubbleAnchor();
      this.bubble.follow(a.x, a.y);
    }
  }

  /** Try to say a line. Returns true if it was shown. */
  say(key: string, opts: SayOptions = {}): boolean {
    if (!this.enabled || !this.speaker) return false;
    const o: SayOptions = { ...opts, taunt: opts.taunt ?? TAUNT_KEYS.test(key) };
    if (!this.policy.canSay(key, this.now, o)) return false;
    const text = this.resolve(key);
    if (!text) return false;
    const a = this.speaker.bubbleAnchor();
    const ms = this.bubble.say(text, a.x, a.y, a.flip);
    this.speaker.onSpeak?.();
    this.policy.record(key, this.now, ms, o);
    this.onLine?.(key, text);
    return true;
  }

  private resolve(key: string): string | null {
    const entry = DUKKAR_LINES[key];
    if (!entry) { console.warn(`[dialogue] missing line '${key}'`); return null; }
    if (typeof entry === 'string') return entry;
    const i = this.rotation.get(key) ?? 0;
    this.rotation.set(key, (i + 1) % entry.length);
    return entry[i];
  }

  /** Forget `once` flags (new level attempt from scratch). Deaths do NOT call this. */
  resetOnce(): void { this.policy.resetOnce(); }
  /** Cut the current line and free the channel (death, scene change). */
  hide(): void { this.bubble.hideNow(); this.policy.cancel(); }
}
