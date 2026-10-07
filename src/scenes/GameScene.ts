import Phaser from 'phaser';
import { CAPTIONS, LEVEL_INTROS, PIG_LINES, type DeathCause } from '../content/script';
import { AudioEngine } from '../core/audio/AudioEngine';
import { GAME_VERSION, PLAYER_TUNING } from '../core/constants';
import { devFlags } from '../core/devFlags';
import { Events, bus } from '../core/events';
import { InputManager } from '../core/input/InputManager';
import { fitCamera } from '../core/render/RenderScale';
import { SaveManager } from '../core/save/SaveManager';
import { makeRecord } from '../core/save/schema';
import { SettingsService } from '../core/settings/SettingsService';
import { DevOverlay } from '../dev/DevOverlay';
import { CameraController } from '../gameplay/camera/CameraController';
import { DialogueManager } from '../gameplay/dialogue/DialogueManager';
import { SpeechBubble } from '../gameplay/dialogue/SpeechBubble';
import { Banana } from '../gameplay/objects/Banana';
import { CheckpointPost } from '../gameplay/objects/CheckpointPost';
import { GoalFlag } from '../gameplay/objects/GoalFlag';
import { Player } from '../gameplay/player/Player';
import { Backdrop } from '../gameplay/world/Backdrop';
import { autoDecorate } from '../gameplay/world/Decor';
import { LevelWorld, type WorldContext } from '../gameplay/world/LevelWorld';
import { SnapshotRegistry } from '../gameplay/world/SnapshotRegistry';
import { Terrain } from '../gameplay/world/Terrain';
import { Water } from '../gameplay/world/Water';
import { THEMES, type ThemePalette } from '../gameplay/world/themes';
import { CAMPAIGN, getLevel } from '../levels';
import { parseLevel } from '../levels/parse';
import type { LevelData, ParsedLevel } from '../levels/types';
import { validateLevel } from '../levels/validate';
import { CaptionLayer } from '../ui/CaptionLayer';
import { Hud } from '../ui/Hud';
import { LevelIntro } from '../ui/LevelIntro';
import { PauseMenu } from '../ui/PauseMenu';
import { ResultsOverlay } from '../ui/ResultsOverlay';
import { SettingsMenu } from '../ui/SettingsMenu';
import { TouchControls } from '../ui/TouchControls';
import { UIRoot } from '../ui/UIRoot';

export interface GameSceneData {
  levelId: string;
  character?: 'monkey' | 'pig';
  mode?: 'campaign' | 'replay';
}

const DECOR_BY_THEME: Record<string, string[]> = {
  test: ['bush', 'flowers', 'rock'],
  jungle: ['bush', 'flowers', 'mushroom', 'rock'],
  swamp: ['reeds', 'mushroom', 'rock'],
  factory: ['crate', 'gear', 'pipe'],
  sky: ['cloudpuff', 'flowers'],
  hq: ['goldstack', 'poster', 'crate'],
};

/**
 * One level, start to finish. Builds the world from data, wires physics, runs the death/checkpoint loop and
 * hands results to the UI. Everything created here is destroyed in cleanup().
 */
export class GameScene extends Phaser.Scene {
  private sceneData!: GameSceneData;
  private levelData!: LevelData;
  private level!: ParsedLevel;
  private palette!: ThemePalette;
  private terrain!: Terrain;
  private backdrop!: Backdrop;
  private water!: Water;
  private player!: Player;
  private cameraCtl!: CameraController;
  private world!: LevelWorld;
  private bananas: Banana[] = [];
  private bananasSpent = 0;
  private spentAtBaseline = 0;
  private checkpoints: CheckpointPost[] = [];
  private flag: GoalFlag | null = null;
  private flagFleeing = false;
  private flagCanFinish = true;
  private decor: Phaser.GameObjects.GameObject[] = [];
  private snapshots = new SnapshotRegistry();
  private dialogue!: DialogueManager;
  private bubble!: SpeechBubble;
  private hud!: Hud;
  private captions!: CaptionLayer;
  private pauseMenu!: PauseMenu;
  private results = new ResultsOverlay();
  private settingsMenu = new SettingsMenu();
  private intro = new LevelIntro();
  private sparkles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private debris: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private deaths = 0;
  private elapsedMs = 0;
  private running = false;
  private finished = false;
  private deathContext: { cause: DeathCause; until: number } | null = null;
  private captionCursor = new Map<string, number>();
  private cleanups: (() => void)[] = [];
  private audio = AudioEngine.instance;
  private settings = SettingsService.instance;

  constructor() { super('Game'); }

  init(data: GameSceneData): void {
    this.sceneData = { levelId: data.levelId ?? 'test', character: data.character ?? 'monkey', mode: data.mode ?? 'campaign' };
  }

  // ------------------------------------------------------------------ create
  create(): void {
    const data = (this.levelData = getLevel(this.sceneData.levelId));
    for (const i of validateLevel(data)) (i.level === 'error' ? console.error : console.warn)(`[level ${data.id}] ${i.message}`);
    this.level = parseLevel(data);
    this.palette = THEMES[data.theme];
    const rng = new Phaser.Math.RandomDataGenerator([`${data.id}`]);
    fitCamera(this.cameras.main);
    this.cameras.main.setBackgroundColor(this.palette.skyBottom);
    this.physics.world.setBounds(0, 0, this.level.widthPx, this.level.heightPx + 400);
    this.deaths = 0; this.elapsedMs = 0; this.finished = false; this.running = true; this.bananasSpent = 0;
    this.bananas = []; this.checkpoints = []; this.decor = [];
    this.flag = null; this.flagFleeing = false; this.flagCanFinish = true; this.deathContext = null;
    this.snapshots = new SnapshotRegistry();

    // world
    this.backdrop = new Backdrop(this, this.palette, this.settings.settings.quality, 7);
    this.terrain = new Terrain(this, this.level, this.palette, 1337);
    this.water = new Water(this, this.level.water, this.palette);
    this.decor.push(...autoDecorate(this, this.level.grid, this.level.cols, this.level.rows, this.palette, rng, DECOR_BY_THEME[data.theme] ?? ['bush']));
    this.player = new Player(this, this.level.spawn.x, this.level.spawn.y, this.sceneData.character);
    this.player.setReducedMotion(this.settings.reducedMotion);
    this.cameraCtl = new CameraController(this, this.level.widthPx, this.level.heightPx);
    this.cameraCtl.shakeEnabled = this.settings.screenShake;
    this.cameraCtl.snapTo(this.player.x, this.player.feetY, 1);
    this.bubble = new SpeechBubble(this);
    this.dialogue = new DialogueManager(this.bubble);
    this.buildParticles();

    // grid entities
    this.level.bananas.forEach((b, i) => this.bananas.push(new Banana(this, b.x, b.y, `b${i}`)));
    for (const c of this.level.checkpoints) this.checkpoints.push(new CheckpointPost(this, c.x, c.y, c.id, c.index, this.palette));
    if (this.level.flag) this.flag = new GoalFlag(this, this.level.flag.x, this.level.flag.y);
    // data-driven objects
    const ctx: WorldContext & { solids: Phaser.Physics.Arcade.StaticGroup } = {
      scene: this, palette: this.palette, level: this.level, data, player: this.player, snapshots: this.snapshots, rng,
      hazardTimeScale: this.settings.hazardTimeScale, reducedMotion: this.settings.reducedMotion, solids: this.terrain.solids,
      kill: (cause) => this.kill(cause),
      say: (key, once, speaker = 'pig') => this.sayLine(key, once, speaker),
      sfx: (name, intensity, gap) => this.audio.play(name, intensity, gap),
      shake: (i, ms) => this.cameraCtl.shake(i, ms),
      debris: (x, y, n) => this.debris?.emitParticleAt(x, y, n),
      sparkle: (x, y, n) => this.sparkles?.emitParticleAt(x, y, n),
      setDeathContext: (cause, ms) => {
        // ambient wind never overrides a specific trap context that is still fresh
        const cur = this.deathContext;
        if (cause === 'wind' && cur && cur.cause !== 'wind' && this.time.now < cur.until) return;
        this.deathContext = { cause, until: this.time.now + ms };
      },
      spendBanana: () => this.spendBanana(),
      toast: (text, ms) => UIRoot.toast(text, ms),
      groundBelow: (x, y) => this.groundBelow(x, y),
      onFlagFlee: (to) => this.fleeFlag(to),
    };
    this.world = new LevelWorld(ctx);
    this.world.build(data.objects);
    for (const fb of this.world.fleeing) this.bananas.push(fb.banana);
    for (const [i, b] of this.bananas.entries()) if (!this.world.fleeing.some((f) => f.banana === b)) this.snapshots.register(`banana-${i}`, b);
    this.wirePhysics();
    this.world.wire();

    // UI
    this.hud = new Hud(() => this.pause(), this.sceneData.mode === 'replay' || this.settings.settings.showTimer);
    this.hud.setBananas(0, this.bananas.length);
    this.captions = new CaptionLayer();
    this.pauseMenu = new PauseMenu({
      resume: () => this.resume(),
      restart: () => { this.resume(); this.restartFromCheckpoint(); },
      settings: () => { this.pauseMenu.hide(); this.settingsMenu.show(() => { if (this.scene.isPaused()) this.pauseMenu.show(this.levelData.name); }); },
      quit: () => this.quitToTitle(),
    });
    TouchControls.instance.setPlaying(true);
    const introText = LEVEL_INTROS[data.id] ?? { title: data.name, subtitle: data.subtitle };
    const campaignIndex = CAMPAIGN.indexOf(data.id);
    this.intro.show(campaignIndex >= 0 ? campaignIndex + 1 : null, introText.title, introText.subtitle);
    this.audio.playMusic(data.music ?? 'jungle');
    this.audio.setMusicIntensity(1);

    // input + global hooks
    const input = InputManager.instance;
    const onRestart = (): void => { if (!this.pauseMenu.open && !this.results.open) this.restartFromCheckpoint(); };
    const onPause = (): void => { if (this.results.open) return; this.pauseMenu.open ? this.resume() : this.pause(); };
    const onBack = (): void => { if (this.pauseMenu.open) this.resume(); };
    const onBlur = (): void => { if (!devFlags.noAutoPause && !this.pauseMenu.open && !this.results.open && this.scene.isActive()) this.pause(); };
    const onMute = (): void => { const m = this.settings.toggleMute(); UIRoot.toast(m ? 'Muted' : 'Sound on', 900); };
    const onScale = (): void => this.cameraCtl.applyZoom();
    const onSettings = (): void => { this.cameraCtl.shakeEnabled = this.settings.screenShake; this.player.setReducedMotion(this.settings.reducedMotion); this.hud.setTimerVisible(this.sceneData.mode === 'replay' || this.settings.settings.showTimer); };
    input.on('restart', onRestart); input.on('pause', onPause); input.on('menuBack', onBack); input.on('mute', onMute);
    window.addEventListener('blur', onBlur);
    bus.on(Events.RenderScaleChanged, onScale);
    bus.on(Events.SettingsChanged, onSettings);
    this.cleanups.push(() => {
      input.off('restart', onRestart); input.off('pause', onPause); input.off('menuBack', onBack); input.off('mute', onMute);
      window.removeEventListener('blur', onBlur);
      bus.off(Events.RenderScaleChanged, onScale); bus.off(Events.SettingsChanged, onSettings);
    });

    // player events
    this.player.events.on('jumped', () => { this.audio.play('jump', 1, 60); this.puffDust(this.player.x, this.player.feetY, 6); });
    this.player.events.on('landed', (impact: number) => { if (impact > 150) { this.audio.play('land', Math.min(1.2, impact / 700), 80); this.puffDust(this.player.x, this.player.feetY, Math.round(4 + impact / 120)); } });
    this.player.events.on('died', (cause: DeathCause) => this.onPlayerDied(cause));
    this.player.events.on('stateChanged', (next: string) => { if (next === 'respawning') this.respawn(); });

    DevOverlay.instance.bind(() => this.devText(), [
      { label: 'physics debug', onClick: () => { this.physics.world.drawDebug = !this.physics.world.drawDebug; this.physics.world.debugGraphic?.clear(); } },
      { label: 'respawn', onClick: () => this.restartFromCheckpoint() },
      { label: 'next checkpoint', onClick: () => this.devSkipCheckpoint() },
      { label: 'complete level', onClick: () => this.completeLevel() },
    ]);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    bus.emit(Events.LevelStarted, data.id);
  }

  private buildParticles(): void {
    const low = this.settings.settings.quality === 'low';
    this.sparkles = this.add.particles(0, 0, 'dot', {
      lifespan: 500, speed: { min: 60, max: 180 }, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xf7c948, 0xffe58a, 0xffffff], emitting: false, blendMode: Phaser.BlendModes.ADD, quantity: low ? 5 : 12,
    }).setDepth(30);
    this.dust = this.add.particles(0, 0, 'dot', {
      lifespan: { min: 250, max: 450 }, speed: { min: 20, max: 70 }, angle: { min: 200, max: 340 }, gravityY: 300,
      scale: { start: 0.45, end: 0 }, alpha: { start: 0.55, end: 0 }, tint: 0xffffff, emitting: false,
    }).setDepth(19);
    this.debris = this.add.particles(0, 0, 'chip', {
      lifespan: { min: 500, max: 900 }, speed: { min: 80, max: 240 }, angle: { min: 200, max: 340 }, gravityY: 900,
      scale: { start: 1, end: 0.3 }, rotate: { start: 0, end: 360 }, alpha: { start: 1, end: 0 }, tint: [this.palette.plank, this.palette.plankDark, this.palette.outline], emitting: false,
    }).setDepth(31);
  }

  private puffDust(x: number, y: number, n: number): void {
    if (this.settings.reducedMotion || !this.dust) return;
    this.dust.emitParticleAt(x, y - 2, n);
  }

  private wirePhysics(): void {
    const p = this.player.proxy;
    this.physics.add.collider(p, this.terrain.solids);
    const fromAbove = (top: number, slack: number): boolean => this.player.body.velocity.y >= 0 && this.player.body.bottom - this.player.body.deltaY() <= top + slack;
    this.physics.add.collider(p, this.terrain.oneWays, undefined, (_a, b) => fromAbove(((b as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody).top, 2));
    this.physics.add.overlap(p, this.terrain.spikes, () => this.kill('spikes'));
    this.physics.add.overlap(p, this.terrain.water, () => this.kill('water'));
    this.physics.add.overlap(p, this.bananas, (_a, b) => this.collectBanana(b as Banana));
    for (const c of this.checkpoints) this.physics.add.overlap(p, c.zone, () => this.reachCheckpoint(c));
    if (this.flag) this.physics.add.overlap(p, this.flag.zone, () => { if (this.flagCanFinish) this.completeLevel(); });
  }

  // ------------------------------------------------------------------ gameplay events
  private collectBanana(b: Banana): void {
    if (!this.player.alive || !b.collect()) return;
    this.audio.play('collect', 1, 50);
    this.sparkles?.emitParticleAt(b.x, b.y, 12);
    this.hud.setBananas(this.collectedCount(), this.bananas.length);
    bus.emit(Events.BananaCollected, this.collectedCount());
  }

  /** Bananas currently held: collected minus processing fees. Always what the HUD shows. */
  private collectedCount(): number { return Math.max(0, this.bananas.filter((b) => b.collected).length - this.bananasSpent); }

  private spendBanana(): boolean {
    if (this.collectedCount() <= 0) return false;
    this.bananasSpent++;
    this.hud.setBananas(this.collectedCount(), this.bananas.length);
    return true;
  }

  private reachCheckpoint(c: CheckpointPost): void {
    if (c.reached || !this.player.alive) return;
    for (const other of this.checkpoints) if (other.index < c.index) other.reached = true;
    c.activate();
    this.player.setSpawn(c.footX, c.footY);
    this.snapshots.capture();
    this.spentAtBaseline = this.bananasSpent;
    if (this.levelData.id === 'level2') { this.audio.play('receipt', 0.8, 0); c.printReceipt(); }
    this.audio.play('checkpoint', 1, 200);
    this.hud.flashCheckpoint(this.levelData.id === 'level2' ? 'Receipt printed' : 'Checkpoint');
    bus.emit(Events.CheckpointReached, c.id);
  }

  private sayLine(key: string, once: boolean, speaker: 'pig' | 'caption'): void {
    if (!this.player.alive) return;
    const pigs = this.world.pigs;
    if (speaker === 'caption' || pigs.length === 0) {
      const line = PIG_LINES[key];
      const text = Array.isArray(line) ? line[0] : line;
      if (text && this.dialogue.say(key, { once })) this.captions.show(text, 2200);
      return;
    }
    let best = pigs[0], bestD = Infinity;
    for (const pig of pigs) { const d = Math.abs(pig.footX - this.player.x); if (d < bestD) { bestD = d; best = pig; } }
    best.lookAt(this.player.x);
    this.dialogue.setSpeaker(best);
    if (this.dialogue.say(key, { once })) this.audio.play('oink', 0.7, 400);
  }

  private fleeFlag(to: { x: number; y: number }): void {
    if (!this.flag || this.flagFleeing || this.flag.fled || !this.player.alive) return;
    this.flag.fled = true;
    this.flagFleeing = true;
    this.flagCanFinish = false;
    this.audio.play('flagRun', 1, 300);
    this.sayLine('l1-flag', true, 'pig');
    void this.flag.runTo(to.x, to.y, 1400).then(() => { this.flagFleeing = false; this.flagCanFinish = true; });
  }

  private kill(cause: DeathCause): void {
    if (!this.player.alive || this.finished) return;
    // Environmental deaths (falling, drowning) are attributed to the trap that caused them; direct hazards keep their own cause.
    const environmental = cause === 'fall' || cause === 'water';
    const ctx = environmental && this.deathContext && this.time.now < this.deathContext.until ? this.deathContext.cause : null;
    const finalCause = ctx ?? cause;
    if (this.player.die(finalCause)) bus.emit(Events.PlayerDied, finalCause);
  }

  private onPlayerDied(cause: DeathCause): void {
    this.deaths++;
    this.hud.setDeaths(this.deaths);
    this.audio.play(cause === 'water' ? 'splash' : 'death', 1, 300);
    this.cameraCtl.shake(0.006, 220);
    this.captions.show(this.pickCaption(cause), PLAYER_TUNING.respawnDelayMs + 700);
    if (cause === 'bridge') this.time.delayedCall(900, () => this.sayLine('l1-bridge-fell', true, 'pig'));
  }

  private pickCaption(cause: DeathCause): string {
    const list = CAPTIONS[cause] ?? CAPTIONS.generic;
    const i = this.captionCursor.get(cause) ?? Math.floor(Math.random() * list.length);
    this.captionCursor.set(cause, (i + 1) % list.length);
    return list[i];
  }

  private respawn(): void {
    if (this.finished) return;
    if (!this.snapshots.restore()) {
      // no checkpoint yet: everything back to the level's initial state
      for (const b of this.bananas) b.restore({ collected: false });
      this.world.resetAll();
      this.bananasSpent = 0;
    } else {
      this.bananasSpent = this.spentAtBaseline;
    }
    this.world.afterRestore();
    this.hud.setBananas(this.collectedCount(), this.bananas.length);
    this.deathContext = null;
    this.dialogue.hide();
    this.player.respawn();
    this.cameraCtl.snapTo(this.player.x, this.player.feetY, this.player.facing);
    bus.emit(Events.PlayerRespawned);
  }

  private restartFromCheckpoint(): void {
    if (!this.player.alive || this.finished) return;
    this.captions.clear();
    this.respawn();
  }

  private completeLevel(): void {
    if (this.finished || !this.player.alive) return;
    this.finished = true;
    this.running = false;
    this.player.controlsEnabled = false;
    this.player.body.setVelocityX(0);
    this.audio.play('victory', 1, 0);
    if (this.flag?.fled) this.sayLine('l1-flag-caught', true, 'pig');
    this.sparkles?.emitParticleAt(this.player.x, this.player.feetY - 60, 24);
    this.cameraCtl.shake(0.003, 200);
    InputManager.instance.releaseAll();
    const save = SaveManager.instance;
    const bananas = this.collectedCount();
    const character = this.sceneData.character ?? 'monkey';
    const assist = this.settings.assist;
    const previous = save.getRecord(this.levelData.id, character, assist);
    const record = makeRecord(Math.round(this.elapsedMs), this.deaths, bananas);
    const isNewBest = save.submitRecord(this.levelData.id, character, assist, record);
    save.markLevelComplete(this.levelData.id, this.deaths, bananas);
    const idx = CAMPAIGN.indexOf(this.levelData.id);
    const nextLevelId = idx >= 0 && idx + 1 < CAMPAIGN.length ? CAMPAIGN[idx + 1] : null;
    if (idx >= 0 && idx === CAMPAIGN.length - 1 && CAMPAIGN.every((id) => save.data.progress.completed[id])) save.setCampaignComplete();
    const endLine = PIG_LINES[`${this.levelData.id.replace('level', 'l')}-end`];
    bus.emit(Events.LevelCompleted, this.levelData.id);
    this.time.delayedCall(900, () => {
      if (!this.scene.isActive()) return;
      TouchControls.instance.setPlaying(false);
      this.results.show({
        levelName: this.levelData.name, levelIndex: idx >= 0 ? idx + 1 : null, timeMs: record.timeMs, deaths: this.deaths,
        bananas, bananaTotal: this.bananas.length, best: isNewBest ? previous : save.getRecord(this.levelData.id, character, assist), isNewBest,
        nextLevelId, pigLine: typeof endLine === 'string' ? endLine : 'See? Nothing happened. Mostly.', character,
      }, {
        next: () => { this.results.hide(); if (nextLevelId) this.scene.restart({ ...this.sceneData, levelId: nextLevelId }); },
        replay: () => { this.results.hide(); this.scene.restart(this.sceneData); },
        title: () => { this.results.hide(); this.quitToTitle(); },
        download: () => UIRoot.toast('Results card export arrives in milestone D.'),
      });
    });
  }

  private quitToTitle(): void {
    this.pauseMenu.hide();
    this.results.hide();
    this.settingsMenu.hide();
    if (this.scene.isPaused()) this.scene.resume();
    this.audio.stopMusic(300);
    this.scene.start('Title');
  }

  private pause(): void {
    if (this.pauseMenu.open || this.finished) return;
    this.pauseMenu.show(this.levelData.name);
    this.scene.pause();
    TouchControls.instance.setPlaying(false);
  }

  private resume(): void {
    if (!this.pauseMenu.open) return;
    this.pauseMenu.hide();
    this.scene.resume();
    TouchControls.instance.setPlaying(true);
  }

  // ------------------------------------------------------------------ update
  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    InputManager.instance.pollGamepad();
    this.world.update(dt, this.time.now);
    for (const b of this.bananas) if (!this.world.fleeing.some((f) => f.banana === b)) b.tick(this.time.now);
    this.flag?.tick(dt);
    this.player.update(dt);
    if (this.player.alive && this.running) {
      this.elapsedMs += delta;
      if (this.player.feetY > this.level.heightPx + 160) this.kill('fall');
    }
    this.player.setGroundProbe(this.groundBelow(this.player.x, this.player.feetY - 2));
    this.cameraCtl.update(dt, this.player.x, this.player.feetY, this.player.facing, this.player.body.velocity.y, this.player.grounded);
    const cam = this.cameras.main;
    this.backdrop.update(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2, cam.scrollX, cam.scrollY, dt);
    this.water.update(dt);
    this.dialogue.update(this.time.now);
    this.hud.setTimer(this.elapsedMs);
    DevOverlay.instance.tick();
  }

  /** Top of the nearest static surface below (x, y) within 420px, or null. */
  private groundBelow(x: number, y: number): number | null {
    const bodies = this.physics.overlapRect(x - 4, y, 8, 420, false, true) as Phaser.Physics.Arcade.StaticBody[];
    let best: number | null = null;
    for (const b of bodies) {
      if (!b.enable) continue;
      if (b.top >= y - 1 && (best === null || b.top < best)) best = b.top;
    }
    return best;
  }

  private devSkipCheckpoint(): void {
    const next = this.checkpoints.find((c) => !c.reached);
    if (next) { this.player.placeAt(next.footX, next.footY); this.reachCheckpoint(next); }
  }

  private devText(): string {
    const b = this.player.body;
    const traps = [this.world.devStates(), ...this.world.fleeing.map((x) => `${x.id}:hop${x.snapshot().hopIndex}`)];
    return [
      `v${GAME_VERSION} ${this.levelData.id} ${this.level.cols}x${this.level.rows} ${this.sceneData.character}`,
      `state=${this.player.state} facing=${this.player.facing} grounded=${this.player.grounded} riding=${this.player.riding}`,
      `pos=(${b.center.x.toFixed(0)}, ${b.bottom.toFixed(0)}) vel=(${b.velocity.x.toFixed(0)}, ${b.velocity.y.toFixed(0)})`,
      `blocked d/l/r=${b.blocked.down ? 1 : 0}/${b.blocked.left ? 1 : 0}/${b.blocked.right ? 1 : 0} touching d=${b.touching.down ? 1 : 0}`,
      `deaths=${this.deaths} bananas=${this.collectedCount()}/${this.bananas.length} t=${(this.elapsedMs / 1000).toFixed(1)}s checkpoint=${this.checkpoints.filter((c) => c.reached).length}/${this.checkpoints.length} baseline=${this.snapshots.hasBaseline}`,
      `traps: ${traps.join(' ') || '-'}`,
      `input L/R/J=${InputManager.instance.left ? 1 : 0}/${InputManager.instance.right ? 1 : 0}/${InputManager.instance.jumpHeld ? 1 : 0} audio=${this.audio.unlocked ? 'on' : 'locked'} music=${this.audio.currentTrack ?? '-'}`,
    ].join('\n');
  }

  private cleanup(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.player.events.removeAllListeners();
    this.player.destroy();
    this.world.destroy();
    for (const b of this.bananas) b.destroy();
    for (const c of this.checkpoints) c.destroy();
    this.flag?.destroy();
    for (const d of this.decor) d.destroy();
    this.terrain.destroy();
    this.backdrop.destroy();
    this.water.destroy();
    this.sparkles?.destroy(); this.dust?.destroy(); this.debris?.destroy();
    this.bubble.destroy();
    this.hud.destroy();
    this.captions.destroy();
    this.intro.hide();
    this.pauseMenu.hide();
    this.results.hide();
    this.settingsMenu.hide();
    this.snapshots.clear();
    DevOverlay.instance.unbind();
    TouchControls.instance.setPlaying(false);
    this.bananas = []; this.checkpoints = []; this.decor = [];
  }
}
