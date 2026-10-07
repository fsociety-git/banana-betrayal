import Phaser from 'phaser';
import { GAME_VERSION, PLAYER_TUNING, TILE } from '../core/constants';
import { devFlags } from '../core/devFlags';
import { InputManager } from '../core/input/InputManager';
import { fitCamera } from '../core/render/RenderScale';
import { Events, bus } from '../core/events';
import { DevOverlay } from '../dev/DevOverlay';
import { CameraController } from '../gameplay/camera/CameraController';
import { MovingPlatform } from '../gameplay/objects/MovingPlatform';
import { Player } from '../gameplay/player/Player';
import { Backdrop } from '../gameplay/world/Backdrop';
import { Terrain } from '../gameplay/world/Terrain';
import { THEMES } from '../gameplay/world/themes';
import { getLevel } from '../levels';
import { parseLevel } from '../levels/parse';
import type { ParsedLevel } from '../levels/types';
import { validateLevel } from '../levels/validate';
import { CaptionLayer } from '../ui/CaptionLayer';
import { Hud } from '../ui/Hud';
import { PauseMenu } from '../ui/PauseMenu';
import { TouchControls } from '../ui/TouchControls';
import { UIRoot } from '../ui/UIRoot';

export interface GameSceneData {
  levelId: string;
  character?: 'monkey' | 'pig';
  mode?: 'campaign' | 'replay';
}

export class GameScene extends Phaser.Scene {
  private level!: ParsedLevel;
  private terrain!: Terrain;
  private backdrop!: Backdrop;
  private player!: Player;
  private cameraCtl!: CameraController;
  private platforms: MovingPlatform[] = [];
  private hud!: Hud;
  private captions!: CaptionLayer;
  private pauseMenu!: PauseMenu;
  private deaths = 0;
  private bananas = 0;
  private elapsedMs = 0;
  private flagZone: Phaser.GameObjects.Zone | null = null;
  private sceneData!: GameSceneData;
  private cleanups: (() => void)[] = [];

  constructor() { super('Game'); }

  init(data: GameSceneData): void {
    this.sceneData = { levelId: data.levelId ?? 'test', character: data.character ?? 'monkey', mode: data.mode ?? 'campaign' };
  }

  create(): void {
    const data = getLevel(this.sceneData.levelId);
    const issues = validateLevel(data);
    for (const i of issues) (i.level === 'error' ? console.error : console.warn)(`[level ${data.id}] ${i.message}`);
    this.level = parseLevel(data);
    const palette = THEMES[data.theme];
    fitCamera(this.cameras.main);
    this.cameras.main.setBackgroundColor(palette.skyBottom);
    this.physics.world.setBounds(0, 0, this.level.widthPx, this.level.heightPx + 400);

    this.backdrop = new Backdrop(this, palette, 'high', 7);
    this.terrain = new Terrain(this, this.level, palette, 1337);
    this.player = new Player(this, this.level.spawn.x, this.level.spawn.y, this.sceneData.character);
    this.cameraCtl = new CameraController(this, this.level.widthPx, this.level.heightPx);
    this.cameraCtl.snapTo(this.player.x, this.player.feetY, 1);

    // objects
    for (const o of data.objects) {
      if (o.type === 'moving-platform') {
        const mp = new MovingPlatform(this, o.x * TILE + (o.w * TILE) / 2, o.y * TILE + 10, o.w, o.path, o.speed, o.pauseMs ?? 300, palette);
        this.platforms.push(mp);
      } else if (o.type === 'sign') {
        this.addSign(o.x * TILE + TILE / 2, (o.y + 1) * TILE, o.text, palette.plank, palette.outline);
      }
    }
    if (this.level.flag) {
      this.addFlag(this.level.flag.x, this.level.flag.y);
    }
    for (const b of this.level.bananas) this.add.image(b.x, b.y, 'banana').setDepth(10);

    // physics wiring
    this.physics.add.collider(this.player.proxy, this.terrain.solids);
    this.physics.add.collider(this.player.proxy, this.terrain.oneWays, undefined, (_p, platform) => {
      // only land on planks when falling onto them from above
      const body = (platform as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody;
      return this.player.body.velocity.y >= 0 && this.player.body.bottom - this.player.body.deltaY() <= body.top + 2;
    });
    this.physics.add.collider(this.player.proxy, this.platforms, (_p, plat) => {
      const mp = plat as MovingPlatform;
      if (this.player.body.touching.down && mp.body.touching.up) this.player.ride = mp;
    }, (_p, plat) => {
      const mp = plat as MovingPlatform;
      return this.player.body.velocity.y >= 0 && this.player.body.bottom - this.player.body.deltaY() <= mp.body.top + 6;
    });
    this.physics.add.overlap(this.player.proxy, this.terrain.spikes, () => this.kill('spikes'));
    this.physics.add.overlap(this.player.proxy, this.terrain.water, () => this.kill('water'));

    // UI
    this.hud = new Hud(() => this.pause(), this.sceneData.mode === 'replay');
    this.captions = new CaptionLayer();
    this.pauseMenu = new PauseMenu({
      resume: () => this.resume(),
      restart: () => { this.resume(); this.restartFromCheckpoint(); },
      settings: () => UIRoot.toast('Settings arrive in milestone B.'),
      quit: () => UIRoot.toast('Title screen arrives in milestone B.'),
    });
    TouchControls.instance.setPlaying(true);

    // input hooks
    const input = InputManager.instance;
    const onRestart = (): void => { if (!this.pauseMenu.open) this.restartFromCheckpoint(); };
    const onPause = (): void => { this.pauseMenu.open ? this.resume() : this.pause(); };
    const onBack = (): void => { if (this.pauseMenu.open) this.resume(); };
    const onBlur = (): void => { if (!devFlags.noAutoPause && !this.pauseMenu.open && this.scene.isActive()) this.pause(); };
    input.on('restart', onRestart); input.on('pause', onPause); input.on('menuBack', onBack);
    window.addEventListener('blur', onBlur);
    this.cleanups.push(() => { input.off('restart', onRestart); input.off('pause', onPause); input.off('menuBack', onBack); window.removeEventListener('blur', onBlur); });

    this.player.events.on('died', (cause: string) => {
      this.deaths++;
      this.hud.setDeaths(this.deaths);
      this.cameraCtl.shake(0.006, 220);
      this.captions.show(this.captionFor(cause), PLAYER_TUNING.respawnDelayMs + 500);
    });
    this.player.events.on('stateChanged', (next: string) => { if (next === 'respawning') this.respawn(); });

    DevOverlay.instance.bind(() => this.devText(), [
      { label: 'physics debug', onClick: () => { this.physics.world.drawDebug = !this.physics.world.drawDebug; this.physics.world.debugGraphic?.clear(); } },
      { label: 'respawn', onClick: () => this.restartFromCheckpoint() },
    ]);
    const onScale = (): void => { this.cameraCtl.applyZoom(); };
    bus.on(Events.RenderScaleChanged, onScale);
    this.cleanups.push(() => bus.off(Events.RenderScaleChanged, onScale));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    bus.emit(Events.LevelStarted, data.id);
  }

  private addSign(x: number, y: number, text: string, plank: number, outline: number): void {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(outline, 1); g.fillRect(x - 4, y - 44, 8, 44);
    g.fillStyle(outline, 1); g.fillRoundedRect(x - 70, y - 86, 140, 46, 8);
    g.fillStyle(plank, 1); g.fillRoundedRect(x - 66, y - 82, 132, 38, 6);
    this.add.text(x, y - 63, text, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '13px', color: '#2c1a0e', align: 'center', wordWrap: { width: 124 } }).setOrigin(0.5).setDepth(6);
  }

  private addFlag(x: number, y: number): void {
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(0x2c1a0e, 1); g.fillRect(x - 3, y - 110, 6, 110);
    g.fillStyle(0xf7c948, 1); g.fillTriangle(x + 3, y - 108, x + 3, y - 66, x + 52, y - 87);
    g.fillStyle(0x2c1a0e, 1); g.fillCircle(x, y - 112, 6);
    this.flagZone = this.add.zone(x, y - 50, 40, 110);
    this.physics.add.existing(this.flagZone, true);
    this.physics.add.overlap(this.player.proxy, this.flagZone, () => this.completeLevel());
  }

  private completeLevel(): void {
    if (!this.player.alive || !this.flagZone) return;
    this.flagZone.destroy(); this.flagZone = null;
    UIRoot.toast(`Level complete in ${(this.elapsedMs / 1000).toFixed(1)}s with ${this.deaths} deaths. (Results screen arrives in milestone D.)`, 3500);
    bus.emit(Events.LevelCompleted, this.level.data.id);
    this.time.delayedCall(800, () => this.scene.restart(this.sceneData));
  }

  private kill(cause: string): void {
    if (this.player.die(cause)) bus.emit(Events.PlayerDied, cause);
  }

  private respawn(): void {
    for (const p of this.platforms) p.resetToStart();
    this.player.respawn();
    this.cameraCtl.snapTo(this.player.x, this.player.feetY, this.player.facing);
    bus.emit(Events.PlayerRespawned);
  }

  private restartFromCheckpoint(): void {
    if (!this.player.alive) return;
    this.captions.clear();
    this.respawn();
  }

  private pause(): void {
    if (this.pauseMenu.open) return;
    this.pauseMenu.show(this.level.data.name);
    this.scene.pause();
    TouchControls.instance.setPlaying(false);
  }

  private resume(): void {
    if (!this.pauseMenu.open) return;
    this.pauseMenu.hide();
    this.scene.resume();
    TouchControls.instance.setPlaying(true);
  }

  private captionFor(cause: string): string {
    switch (cause) {
      case 'spikes': return 'Pointy. Noted.';
      case 'water': return 'Monkeys famously float. This one did not.';
      case 'fall': return 'Gravity remains undefeated.';
      default: return 'A small setback for monkeykind.';
    }
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const input = InputManager.instance;
    input.pollGamepad();
    for (const p of this.platforms) p.update(dt);
    this.player.update(dt);
    if (this.player.alive) {
      this.elapsedMs += delta;
      if (this.player.feetY > this.level.heightPx + 160) this.kill('fall');
    }
    this.player.setGroundProbe(this.probeGround());
    this.cameraCtl.update(dt, this.player.x, this.player.feetY, this.player.facing, this.player.body.velocity.y, this.player.grounded);
    const cam = this.cameras.main;
    this.backdrop.update(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2, cam.scrollX, cam.scrollY, dt);
    this.hud.setTimer(this.elapsedMs);
    DevOverlay.instance.tick();
  }

  /** Top of the nearest static surface below the player's feet (for the contact shadow). */
  private probeGround(): number | null {
    const feet = this.player.feetY;
    const bodies = this.physics.overlapRect(this.player.x - 4, feet - 2, 8, 420, true, true) as Phaser.Physics.Arcade.Body[];
    let best: number | null = null;
    for (const b of bodies) {
      if (b === this.player.body) continue;
      if (b.top >= feet - 3 && (best === null || b.top < best)) best = b.top;
    }
    return best;
  }

  private devText(): string {
    const b = this.player.body;
    return [
      `v${GAME_VERSION} level=${this.level.data.id} ${this.level.cols}x${this.level.rows}`,
      `state=${this.player.state} facing=${this.player.facing} grounded=${this.player.grounded}`,
      `pos=(${b.center.x.toFixed(0)}, ${b.bottom.toFixed(0)}) vel=(${b.velocity.x.toFixed(0)}, ${b.velocity.y.toFixed(0)})`,
      `blocked d/l/r=${b.blocked.down ? 1 : 0}/${b.blocked.left ? 1 : 0}/${b.blocked.right ? 1 : 0} touching d=${b.touching.down ? 1 : 0}`,
      `deaths=${this.deaths} bananas=${this.bananas} t=${(this.elapsedMs / 1000).toFixed(1)}s`,
      `input L/R/J=${InputManager.instance.left ? 1 : 0}/${InputManager.instance.right ? 1 : 0}/${InputManager.instance.jumpHeld ? 1 : 0}`,
    ].join('\n');
  }

  private cleanup(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.player.events.removeAllListeners();
    this.player.destroy();
    this.terrain.destroy();
    this.backdrop.destroy();
    this.hud.destroy();
    this.captions.destroy();
    this.pauseMenu.hide();
    DevOverlay.instance.unbind();
    TouchControls.instance.setPlaying(false);
    this.platforms = [];
  }
}
