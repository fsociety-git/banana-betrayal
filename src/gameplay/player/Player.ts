import Phaser from 'phaser';
import { CHARACTERS, type CharacterDef } from '../../content/characters';
import { PLAYER_TUNING as T } from '../../core/constants';
import { InputManager } from '../../core/input/InputManager';
import { CharacterRig } from './CharacterRig';

export type PlayerState = 'grounded' | 'rising' | 'falling' | 'hurt' | 'dead' | 'respawning';

/** Something the player can stand on that moves (a MovingPlatform or similar). Deltas are per frame. */
export interface RideSource {
  body: Phaser.Physics.Arcade.Body;
  deltaX: number;
  deltaY: number;
}

export interface PlayerEvents {
  jumped: () => void;
  landed: (impactSpeed: number) => void;
  died: (cause: string) => void;
  respawned: () => void;
  stateChanged: (next: PlayerState, prev: PlayerState) => void;
}

/**
 * Gameplay half of the player: a plain invisible rectangle with an Arcade body, driven by InputManager.
 * The CharacterRig is purely visual and follows the body every frame.
 */
export class Player {
  readonly scene: Phaser.Scene;
  readonly def: CharacterDef;
  readonly proxy: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly rig: CharacterRig;
  readonly events = new Phaser.Events.EventEmitter();
  state: PlayerState = 'falling';
  facing: 1 | -1 = 1;
  /** Set by collider callbacks each physics step when standing on a moving thing. */
  ride: RideSource | null = null;
  /** Platform we are standing on. Kept until we jump, walk off its edge or get separated from it. */
  private stickyRide: RideSource | null = null;
  private lastGroundedAt = -Infinity;
  private jumpedSinceGround = false;
  private jumpCutDone = false;
  private wasGrounded = false;
  private prevVy = 0;
  private deathToken = 0;
  private spawnPoint = { x: 0, y: 0 };
  private groundProbe = { y: null as number | null };
  controlsEnabled = true;
  /** Horizontal push applied this frame by the world (wind zones). Reset every update. */
  externalVx = 0;
  private lastExternalVx = 0;
  /** Set true for one frame when a solid presses the player into the ground or a wall. */
  crushed = false;
  /** Assist mode and similar may scale hazards, never the controls. */

  constructor(scene: Phaser.Scene, x: number, y: number, character: keyof typeof CHARACTERS = 'monkey') {
    this.scene = scene;
    this.def = CHARACTERS[character];
    this.proxy = scene.add.rectangle(x, y - this.def.bodyHeight / 2, this.def.bodyWidth, this.def.bodyHeight, 0xff00ff, 0);
    scene.physics.add.existing(this.proxy);
    this.body = this.proxy.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(true).setGravityY(T.gravity).setMaxVelocityY(T.maxFallSpeed);
    this.body.setCollideWorldBounds(false);
    this.body.useDamping = false;
    this.rig = new CharacterRig(scene, x, y, this.def);
    this.spawnPoint = { x, y };
  }

  /** Feet position (bottom centre of the collision body). */
  get x(): number { return this.body.center.x; }
  get feetY(): number { return this.body.bottom; }
  get grounded(): boolean { return this.body.blocked.down || this.body.touching.down || this.riding; }
  /** True while standing on a moving platform. */
  get riding(): boolean { return this.stickyRide !== null; }
  get alive(): boolean { return this.state !== 'dead' && this.state !== 'respawning'; }

  setSpawn(x: number, y: number): void { this.spawnPoint = { x, y }; }

  /** Teleport (feet position) and clear motion. */
  placeAt(x: number, y: number): void {
    this.body.reset(x, y - this.def.bodyHeight / 2);
    this.body.setVelocity(0, 0);
    this.rig.setPosition(x, y);
    this.prevVy = 0;
    this.ride = null;
    this.stickyRide = null;
    this.externalVx = 0; this.lastExternalVx = 0; this.crushed = false;
  }

  update(dt: number): void {
    const input = InputManager.instance;
    if (this.state === 'dead' || this.state === 'respawning') {
      this.syncRig(dt);
      return;
    }
    const now = performance.now();
    // Riding: a fresh contact refreshes the sticky window; otherwise keep the last platform while we are
    // still just above it and have not jumped, so vertical motion of the platform never breaks contact.
    if (this.ride) {
      this.stickyRide = this.ride;
    } else if (this.stickyRide) {
      const pb = this.stickyRide.body;
      const over = this.body.right > pb.left + 2 && this.body.left < pb.right - 2;
      const near = this.body.bottom <= pb.top + 14 && this.body.bottom >= pb.top - 24;
      if (!over || !near || this.jumpedSinceGround || !pb.enable) this.stickyRide = null;
    }
    const grounded = this.grounded;
    const vx0 = this.body.velocity.x;

    // Landing detection (uses previous frame's vertical velocity for impact strength)
    if (grounded && !this.wasGrounded) {
      this.jumpedSinceGround = false;
      this.jumpCutDone = false;
      const impact = Math.max(0, this.prevVy);
      this.rig.playLand(impact / 700);
      this.events.emit('landed', impact);
    }
    if (grounded) this.lastGroundedAt = now;

    // Horizontal movement
    const axis = this.controlsEnabled ? input.axis : 0;
    const target = axis * T.runSpeed;
    let vx = vx0 - this.lastExternalVx;
    if (axis !== 0) {
      const accel = grounded ? T.groundAccel : T.airAccel;
      // turning around is snappier than accelerating from rest
      const turning = Math.sign(vx) !== 0 && Math.sign(vx) !== Math.sign(axis);
      vx = Phaser.Math.Linear(vx, target, Math.min(1, ((turning ? accel * 1.6 : accel) * dt) / Math.max(1, Math.abs(target - vx))));
      this.facing = axis > 0 ? 1 : -1;
    } else {
      const decel = grounded ? T.groundDecel : T.airDecel;
      const step = decel * dt;
      vx = Math.abs(vx) <= step ? 0 : vx - Math.sign(vx) * step;
    }
    // Carried by a moving platform: ride delta is applied positionally, so velocity stays player-relative.
    // Wind and belts add an external component that does not fight the player's own acceleration curve.
    this.body.setVelocityX(vx + this.externalVx);
    this.lastExternalVx = this.externalVx;
    this.externalVx = 0;
    // Crushed: something solid pressing from above while standing, or from both sides.
    this.crushed = (this.body.touching.up && (this.body.blocked.down || this.body.touching.down)) || (this.body.blocked.left && this.body.blocked.right);

    // Jumping: coyote time + buffered input
    const canCoyote = now - this.lastGroundedAt <= T.coyoteMs && !this.jumpedSinceGround;
    if (this.controlsEnabled && input.hasBufferedJump(T.jumpBufferMs) && (grounded || canCoyote)) {
      input.consumeJump();
      this.body.setVelocityY(T.jumpVelocity);
      this.jumpedSinceGround = true;
      this.jumpCutDone = false;
      this.ride = null;
      this.stickyRide = null;
      this.rig.playJump();
      this.events.emit('jumped');
    }
    // Variable height: releasing early cuts upward velocity once.
    if (!input.jumpHeld && this.body.velocity.y < 0 && this.jumpedSinceGround && !this.jumpCutDone) {
      this.body.setVelocityY(this.body.velocity.y * T.jumpCutMultiplier);
      this.jumpCutDone = true;
    }
    // Heavier falls read better and shorten airtime.
    this.body.setGravityY(this.body.velocity.y > 0 ? T.gravity * T.fallGravityMultiplier : T.gravity);

    // Carry: snap onto the platform top and move with it. Velocity stays player-relative.
    if (this.riding && this.stickyRide && !this.jumpedSinceGround) {
      const r = this.stickyRide;
      this.body.x += r.deltaX;
      this.body.y = r.body.top - this.body.height;
      if (this.body.velocity.y > 0) this.body.setVelocityY(0);
    }
    this.ride = null;

    // State
    const next: PlayerState = grounded ? 'grounded' : this.body.velocity.y < 0 ? 'rising' : 'falling';
    this.setState(next);
    this.wasGrounded = grounded;
    this.prevVy = this.body.velocity.y;
    this.syncRig(dt);
  }

  private setState(next: PlayerState): void {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.events.emit('stateChanged', next, prev);
  }

  /** Called by the scene after it has resolved where the ground below the player is (for the shadow). */
  setGroundProbe(y: number | null): void { this.groundProbe.y = y; }

  private syncRig(dt: number): void {
    this.rig.setPosition(this.body.center.x, this.body.bottom);
    this.rig.setFacing(this.facing);
    const alive = this.alive;
    this.rig.animate(dt, alive ? this.body.velocity.x : 0, alive ? this.body.velocity.y : 0, alive && this.grounded, alive ? this.groundProbe.y : null);
  }

  /** Kill the player once; repeated calls during the same death are ignored. Returns false if already dead. */
  die(cause: string): boolean {
    if (!this.alive) return false;
    const token = ++this.deathToken;
    this.setState('dead');
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.body.enable = false;
    this.rig.playHurt();
    this.events.emit('died', cause);
    // Hurt pop: rig hops up and spins, then the scene decides when to respawn.
    if (!this.rig.reducedMotion) {
      this.scene.tweens.add({ targets: this.rig, y: this.rig.y - 70, duration: 260, ease: 'Quad.easeOut', yoyo: true });
      this.scene.tweens.add({ targets: this.rig, angle: this.facing * 360, duration: T.respawnDelayMs, ease: 'Quad.easeIn' });
    }
    this.scene.time.delayedCall(T.respawnDelayMs, () => { if (token === this.deathToken) this.setState('respawning'); });
    return true;
  }

  /** Put the player back at the spawn point and hand control back. */
  respawn(): void {
    this.deathToken++;
    this.scene.tweens.killTweensOf(this.rig);
    this.rig.setAngle(0).setAlpha(1);
    this.body.enable = true;
    this.body.setAllowGravity(true);
    this.placeAt(this.spawnPoint.x, this.spawnPoint.y);
    this.state = 'falling';
    this.wasGrounded = false;
    this.jumpedSinceGround = false;
    this.lastGroundedAt = -Infinity;
    InputManager.instance.consumeJump();
    this.rig.impulse(0.7, 1.3, 160);
    this.events.emit('respawned');
  }

  setReducedMotion(on: boolean): void { this.rig.reducedMotion = on; }

  destroy(): void {
    this.events.removeAllListeners();
    this.scene.tweens.killTweensOf(this.rig);
    this.rig.destroy();
    this.proxy.destroy();
  }
}
