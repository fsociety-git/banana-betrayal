import Phaser from 'phaser';

export type InputAction = 'restart' | 'pause' | 'mute' | 'dev' | 'fullscreen' | 'menuBack' | 'jumpPressed' | 'bonk' | 'interact';

interface GamepadEdge { jump: boolean; pause: boolean; restart: boolean; bonk: boolean; interact: boolean; }

/**
 * Unified, device-agnostic input. Keyboard (window), touch (DOM buttons via TouchControls) and gamepad
 * (polled) all feed the same held/pressed state. Jump presses are timestamped so the player can buffer them.
 * `gameplayEnabled` is false while a menu owns the keyboard; global hotkeys still work.
 */
export class InputManager extends Phaser.Events.EventEmitter {
  private static _instance: InputManager | null = null;
  static get instance(): InputManager {
    if (!this._instance) this._instance = new InputManager();
    return this._instance;
  }

  private keys = new Set<string>();
  private touch = { left: false, right: false, jump: false };
  private pad = { left: false, right: false, jump: false };
  private padPrev: GamepadEdge = { jump: false, pause: false, restart: false, bonk: false, interact: false };
  private jumpPressedTime = -Infinity;
  private jumpHeldState = false;
  gameplayEnabled = true;
  /** True whenever a touch control was used (used to auto-show the touch UI). */
  touchSeen = false;
  gamepadSeen = false;

  private constructor() {
    super();
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearAll(); });
    window.addEventListener('gamepadconnected', () => { this.gamepadSeen = true; });
  }

  // ----- public state -----
  get left(): boolean { return this.gameplayEnabled && (this.keyDown('ArrowLeft', 'KeyA') || this.touch.left || this.pad.left); }
  get right(): boolean { return this.gameplayEnabled && (this.keyDown('ArrowRight', 'KeyD') || this.touch.right || this.pad.right); }
  get jumpHeld(): boolean { return this.gameplayEnabled && this.jumpHeldState; }
  /** Horizontal axis in [-1, 1]. */
  get axis(): number { return (this.right ? 1 : 0) - (this.left ? 1 : 0); }

  /** True if a jump was pressed within the last `bufferMs` milliseconds and not yet consumed. */
  hasBufferedJump(bufferMs: number): boolean {
    return this.gameplayEnabled && performance.now() - this.jumpPressedTime <= bufferMs;
  }
  consumeJump(): void { this.jumpPressedTime = -Infinity; }

  /** Called by touch controls. */
  setTouch(action: 'left' | 'right' | 'jump' | 'bonk' | 'interact', down: boolean): void {
    this.touchSeen = true;
    if (action === 'jump') {
      if (down && !this.touch.jump) this.pressJump();
      this.touch.jump = down;
      this.recomputeJumpHeld();
    } else if (action === 'bonk' || action === 'interact') {
      if (down && this.gameplayEnabled) this.emit(action);
    } else {
      this.touch[action] = down;
    }
  }

  /** Poll gamepads once per frame (from the active gameplay scene). */
  pollGamepad(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    // Standard mapping: A/B jump, X bonk, Y interact, Start pause, Back/Select restart
    let left = false, right = false, jump = false, pause = false, restart = false, bonk = false, interact = false;
    for (const gp of pads) {
      if (!gp) continue;
      this.gamepadSeen = true;
      const ax = gp.axes[0] ?? 0;
      left ||= ax < -0.45 || !!gp.buttons[14]?.pressed;
      right ||= ax > 0.45 || !!gp.buttons[15]?.pressed;
      jump ||= !!gp.buttons[0]?.pressed || !!gp.buttons[1]?.pressed;
      bonk ||= !!gp.buttons[2]?.pressed;
      interact ||= !!gp.buttons[3]?.pressed;
      pause ||= !!gp.buttons[9]?.pressed;
      restart ||= !!gp.buttons[8]?.pressed;
    }
    this.pad.left = left; this.pad.right = right;
    if (jump && !this.padPrev.jump) this.pressJump();
    this.pad.jump = jump;
    if (pause && !this.padPrev.pause) this.emit('pause');
    if (restart && !this.padPrev.restart && this.gameplayEnabled) this.emit('restart');
    if (bonk && !this.padPrev.bonk && this.gameplayEnabled) this.emit('bonk');
    if (interact && !this.padPrev.interact && this.gameplayEnabled) this.emit('interact');
    this.padPrev = { jump, pause, restart, bonk, interact };
    this.recomputeJumpHeld();
  }

  // ----- internals -----
  private keyDown(...codes: string[]): boolean { return codes.some((c) => this.keys.has(c)); }

  private pressJump(): void {
    this.jumpPressedTime = performance.now();
    this.emit('jumpPressed');
  }

  private recomputeJumpHeld(): void {
    this.jumpHeldState = this.keyDown('Space', 'KeyW', 'ArrowUp') || this.touch.jump || this.pad.jump;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    const inField = !!target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
    // Global hotkeys (work even when menus are open, but not while typing in a field)
    if (!inField) {
      if (e.code === 'KeyM' && !e.repeat) { this.emit('mute'); }
      if ((e.code === 'Backquote' || e.code === 'F3') && !e.repeat) { e.preventDefault(); this.emit('dev'); }
      if (e.code === 'KeyF' && !e.repeat && !e.metaKey && !e.ctrlKey) { this.emit('fullscreen'); }
      if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); this.emit(this.gameplayEnabled ? 'pause' : 'menuBack'); }
    }
    if (!this.gameplayEnabled) return;
    if (inField) return;
    const gameKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyR', 'KeyJ', 'KeyX', 'KeyE', 'Enter'].includes(e.code);
    if (gameKey) e.preventDefault();
    if (e.repeat) return;
    if (!this.keys.has(e.code)) {
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') this.pressJump();
      if (e.code === 'KeyR') this.emit('restart');
      if (e.code === 'KeyJ' || e.code === 'KeyX') this.emit('bonk');
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') this.emit('interact');
      this.recomputeJumpHeld();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.recomputeJumpHeld();
  };

  private clearAll = (): void => {
    this.keys.clear();
    this.touch.left = this.touch.right = this.touch.jump = false;
    this.pad.left = this.pad.right = this.pad.jump = false;
    this.jumpHeldState = false;
    this.jumpPressedTime = -Infinity;
  };

  /** Drop any held state (e.g. when a menu opens) so the player does not keep running. */
  releaseAll(): void { this.clearAll(); }
}
