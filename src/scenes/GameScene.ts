import Phaser from 'phaser';
import { CAPTIONS, LEVEL_INTROS, PIG_LINES, SIGNS, type DeathCause } from '../content/script';
import { AudioEngine } from '../core/audio/AudioEngine';
import { GAME_VERSION, PLAYER_TUNING, TILE } from '../core/constants';
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
import { MovingPlatform } from '../gameplay/objects/MovingPlatform';
import { PigNPC } from '../gameplay/objects/PigNPC';
import { Player } from '../gameplay/player/Player';
import { Coconut } from '../gameplay/traps/Coconut';
import { CollapsingBridge } from '../gameplay/traps/CollapsingBridge';
import { FleeingBanana } from '../gameplay/traps/FleeingBanana';
import { Backdrop } from '../gameplay/world/Backdrop';
import { autoDecorate, placeDecor } from '../gameplay/world/Decor';
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
  private platforms: MovingPlatform[] = [];
  private bananas: Banana[] = [];
  private checkpoints: CheckpointPost[] = [];
  private flag: GoalFlag | null = null;
  private flagFleeing = false;
  private flagCanFinish = true;
  private pigs: PigNPC[] = [];
  private bridges: CollapsingBridge[] = [];
  private coconuts: Coconut[] = [];
  private fleeing: FleeingBanana[] = [];
  private decor: Phaser.GameObjects.GameObject[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
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
    this.deaths = 0; this.elapsedMs = 0; this.finished = false; this.running = true;
    this.platforms = []; this.bananas = []; this.checkpoints = []; this.pigs = []; this.bridges = []; this.coconuts = []; this.fleeing = []; this.decor = []; this.zones = [];
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
    for (const o of data.objects) this.buildObject(o, rng);
    for (const [i, b] of this.bananas.entries()) this.snapshots.register(`banana-${i}`, b);
    for (const [i, p] of this.platforms.entries()) this.snapshots.register(`platform-${i}`, p);
    this.wirePhysics();

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

  private buildObject(o: LevelData['objects'][number], rng: Phaser.Math.RandomDataGenerator): void {
    const px = o.x * TILE, py = o.y * TILE;
    const foot = { x: px + TILE / 2, y: py + TILE };
    switch (o.type) {
      case 'moving-platform':
        this.platforms.push(new MovingPlatform(this, px + (o.w * TILE) / 2, py + 10, o.w, o.path, o.speed, o.pauseMs ?? 300, this.palette));
        break;
      case 'sign':
        this.decor.push(...this.addSign(foot.x, foot.y, SIGNS[o.text] ?? o.text));
        break;
      case 'pig': {
        const pig = new PigNPC(this, foot.x, foot.y, o.pose ?? 'idle', o.flip ?? false);
        this.pigs.push(pig);
        break;
      }
      case 'dialogue-trigger': {
        const zone = this.add.zone(px + (o.w * TILE) / 2, py + (o.h * TILE) / 2, o.w * TILE, o.h * TILE);
        this.physics.add.existing(zone, true);
        this.zones.push(zone);
        this.physics.add.overlap(this.player.proxy, zone, () => this.sayLine(o.line, o.once ?? true, o.speaker ?? 'pig'));
        break;
      }
      case 'fleeing-banana': {
        const fb = new FleeingBanana(this, o.id, foot.x, py + TILE / 2, o.path);
        fb.onJoke = () => this.sayLine('l1-banana-flee', true, 'pig');
        fb.onHop = () => this.audio.play('whoosh', 0.8, 200);
        this.fleeing.push(fb);
        this.bananas.push(fb.banana);
        this.snapshots.register(`fleeing-${o.id}`, fb);
        break;
      }
      case 'collapsing-bridge': {
        const bridge = new CollapsingBridge(this, o.id, o.x, o.y, o.w, o.delayMs ?? 350, o.stepMs ?? 230, this.palette);
        bridge.machine.timeScale = this.settings.hazardTimeScale;
        bridge.onWarn = () => this.audio.play('warning', 0.7, 300);
        bridge.onPlankFall = (x, y) => { this.audio.play('collapse', 0.6, 90); this.debris?.emitParticleAt(x, y, 4); this.cameraCtl.shake(0.002, 90); };
        this.bridges.push(bridge);
        this.snapshots.register(`bridge-${o.id}`, bridge);
        break;
      }
      case 'coconut': {
        const groundY = this.groundBelow(foot.x, py) ?? this.level.heightPx;
        const coco = new Coconut(this, o.id, o.x, o.y, o.triggerWidth ?? 3, groundY);
        coco.machine.timeScale = this.settings.hazardTimeScale;
        coco.onWarn = () => this.audio.play('warning', 0.8, 300);
        coco.onLand = (x, y) => { this.audio.play('impact', 0.9, 120); this.debris?.emitParticleAt(x, y, 8); this.cameraCtl.shake(0.004, 160); };
        this.coconuts.push(coco);
        this.snapshots.register(`coconut-${o.id}`, coco);
        break;
      }
      case 'fleeing-flag': {
        const zone = this.add.zone(px + (o.w * TILE) / 2, py + (o.h * TILE) / 2, o.w * TILE, o.h * TILE);
        this.physics.add.existing(zone, true);
        this.zones.push(zone);
        const fleeTo = { x: o.fleeTo.x * TILE + TILE / 2, y: (o.fleeTo.y + 1) * TILE };
        this.physics.add.overlap(this.player.proxy, zone, () => this.fleeFlag(fleeTo));
        break;
      }
      case 'decor': {
        const img = placeDecor(this, o.kind, foot.x, foot.y + 4, this.palette, rng);
        if (img) this.decor.push(img);
        break;
      }
      default:
        console.warn(`[level ${this.levelData.id}] object type '${o.type}' is not implemented yet`);
    }
  }

  private wirePhysics(): void {
    const p = this.player.proxy;
    this.physics.add.collider(p, this.terrain.solids);
    const fromAbove = (top: number, slack: number): boolean => this.player.body.velocity.y >= 0 && this.player.body.bottom - this.player.body.deltaY() <= top + slack;
    this.physics.add.collider(p, this.terrain.oneWays, undefined, (_a, b) => fromAbove(((b as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody).top, 2));
    this.physics.add.collider(p, this.platforms, (_a, b) => {
      const mp = b as MovingPlatform;
      if (this.player.body.touching.down && mp.body.touching.up) this.player.ride = mp;
    }, (_a, b) => fromAbove((b as MovingPlatform).body.top, 6));
    for (const bridge of this.bridges) {
      this.physics.add.collider(p, bridge.group, () => {
        if (this.player.body.touching.down) { bridge.stepOn(); this.deathContext = { cause: 'bridge', until: this.time.now + 1600 }; }
      }, (_a, b) => fromAbove(((b as Phaser.GameObjects.Container).body as Phaser.Physics.Arcade.StaticBody).top, 4));
    }
    for (const coco of this.coconuts) {
      this.physics.add.overlap(p, coco.triggerZone, () => coco.trigger());
      this.physics.add.collider(coco.sprite, this.terrain.solids, () => coco.land());
      this.physics.add.collider(coco.sprite, this.terrain.oneWays, () => coco.land());
      this.physics.add.overlap(p, coco.sprite, () => { if (coco.deadly) this.kill('coconut'); });
    }
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

  private collectedCount(): number { return this.bananas.filter((b) => b.collected).length; }

  private reachCheckpoint(c: CheckpointPost): void {
    if (c.reached || !this.player.alive) return;
    for (const other of this.checkpoints) if (other.index < c.index) other.reached = true;
    c.activate();
    this.player.setSpawn(c.footX, c.footY);
    this.snapshots.capture();
    this.audio.play('checkpoint', 1, 200);
    this.hud.flashCheckpoint(this.levelData.id === 'level2' ? 'Receipt printed' : 'Checkpoint');
    bus.emit(Events.CheckpointReached, c.id);
  }

  private sayLine(key: string, once: boolean, speaker: 'pig' | 'caption'): void {
    if (!this.player.alive || this.finished) return;
    if (speaker === 'caption' || this.pigs.length === 0) {
      const line = PIG_LINES[key];
      const text = Array.isArray(line) ? line[0] : line;
      if (text && this.dialogue.say(key, { once })) this.captions.show(text, 2200);
      return;
    }
    let best = this.pigs[0], bestD = Infinity;
    for (const pig of this.pigs) { const d = Math.abs(pig.footX - this.player.x); if (d < bestD) { bestD = d; best = pig; } }
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
    const ctx = this.deathContext && this.time.now < this.deathContext.until ? this.deathContext.cause : null;
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
      for (const p of this.platforms) p.resetToStart();
      for (const b of this.bananas) b.restore({ collected: false });
      for (const f of this.fleeing) f.restore({ hopIndex: 0, collected: false, joked: (f.snapshot()).joked });
      for (const br of this.bridges) br.restore({ trap: { ...br.machine.snapshot(), state: 'idle', timer: 0 }, fallen: br.planks.map(() => false) });
      for (const c of this.coconuts) c.restore({ trap: { ...c.machine.snapshot(), state: 'idle', timer: 0 }, landed: false });
    }
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
    const dtMs = dt * 1000;
    InputManager.instance.pollGamepad();
    for (const p of this.platforms) p.update(dt);
    for (const b of this.bridges) b.update(dtMs);
    for (const c of this.coconuts) c.update(dtMs);
    for (const f of this.fleeing) f.update(this.time.now, this.player.x, this.player.feetY);
    for (const b of this.bananas) if (!this.fleeing.some((f) => f.banana === b)) b.tick(this.time.now);
    this.flag?.tick(dt);
    for (const pig of this.pigs) pig.update(dt);
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

  private addSign(x: number, y: number, text: string): Phaser.GameObjects.GameObject[] {
    const p = this.palette;
    const t = this.add.text(0, 0, text, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '13px', color: '#2c1a0e', align: 'center', wordWrap: { width: 132 }, fontStyle: 'bold' }).setOrigin(0.5).setDepth(6);
    const bw = Math.max(110, t.width + 24), bh = t.height + 20;
    const boardBottom = y - 44, boardTop = boardBottom - bh;
    t.setPosition(x, boardTop + bh / 2);
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(p.outline, 1); g.fillRect(x - 4, y - 44, 8, 44);
    g.fillRoundedRect(x - bw / 2 - 4, boardTop - 4, bw + 8, bh + 8, 8);
    g.fillStyle(p.plank, 1); g.fillRoundedRect(x - bw / 2, boardTop, bw, bh, 6);
    g.fillStyle(p.plankDark, 0.7); g.fillRect(x - bw / 2, boardBottom - 4, bw, 4);
    g.fillStyle(0xffffff, 0.25); g.fillRect(x - bw / 2 + 4, boardTop + 3, bw - 8, 2);
    return [g, t];
  }

  private devSkipCheckpoint(): void {
    const next = this.checkpoints.find((c) => !c.reached);
    if (next) { this.player.placeAt(next.footX, next.footY); this.reachCheckpoint(next); }
  }

  private devText(): string {
    const b = this.player.body;
    const traps = [...this.bridges.map((x) => `${x.id}:${x.machine.state}`), ...this.coconuts.map((x) => `${x.id}:${x.machine.state}`), ...this.fleeing.map((x) => `${x.id}:hop${x.snapshot().hopIndex}`)];
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
    for (const pig of this.pigs) pig.destroy();
    for (const b of this.bridges) b.destroy();
    for (const c of this.coconuts) c.destroy();
    for (const f of this.fleeing) f.destroy();
    for (const z of this.zones) z.destroy();
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
    this.platforms = []; this.bananas = []; this.checkpoints = []; this.pigs = []; this.bridges = []; this.coconuts = []; this.fleeing = []; this.decor = []; this.zones = [];
  }
}
