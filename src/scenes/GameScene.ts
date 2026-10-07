import Phaser from 'phaser';
import { CAPTIONS, ENDING, INTRO, LEVEL_INTROS, DUKKAR_LINES, RESULTS_LINES, type DeathCause } from '../content/script';
import { AudioEngine } from '../core/audio/AudioEngine';
import { DEPTH, GAME_VERSION, PLAYER_TUNING, TILE } from '../core/constants';
import { devFlags } from '../core/devFlags';
import { Events, bus } from '../core/events';
import { InputManager } from '../core/input/InputManager';
import { fitCamera } from '../core/render/RenderScale';
import { SaveManager } from '../core/save/SaveManager';
import { makeRecord } from '../core/save/schema';
import { SettingsService } from '../core/settings/SettingsService';
import { DevOverlay } from '../dev/DevOverlay';
import { PigBoss } from '../gameplay/boss/PigBoss';
import { CameraController } from '../gameplay/camera/CameraController';
import { GhostPlayer, GhostRecorder } from '../gameplay/ghost/Ghost';
import { DialogueManager } from '../gameplay/dialogue/DialogueManager';
import type { SayOptions } from '../gameplay/dialogue/DialoguePolicy';
import { MakadVoice } from '../gameplay/dialogue/MakadVoice';
import { ReactionDirector } from '../gameplay/dialogue/ReactionDirector';
import { EncounterManager } from '../gameplay/encounters/EncounterManager';
import type { EncounterHost } from '../gameplay/encounters/Encounter';
import { overlaps, type Bonkable } from '../gameplay/interact/Bonk';
import { InteractionManager } from '../gameplay/interact/InteractionManager';
import { PigNPC, type PigPose } from '../gameplay/objects/PigNPC';
import { drawBanner, drawTrophy } from '../gameplay/encounters/props';
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
import { levelHash } from '../levels/hash';
import { parseLevel } from '../levels/parse';
import type { LevelData, ParsedLevel } from '../levels/types';
import { validateLevel } from '../levels/validate';
import { AchievementToast } from '../ui/AchievementToast';
import { CaptionLayer } from '../ui/CaptionLayer';
import { ReplyChooser } from '../ui/ReplyChooser';
import { el } from '../ui/UIRoot';
import { Hud } from '../ui/Hud';
import { LevelIntro } from '../ui/LevelIntro';
import { PauseMenu } from '../ui/PauseMenu';
import { downloadResultsCard } from '../results/ResultsCard';
import { ResultsOverlay } from '../ui/ResultsOverlay';
import { RotatePrompt } from '../ui/RotatePrompt';
import { showCredits, SimpleDialog } from '../ui/Overlays';
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
  private boss: PigBoss | null = null;
  private bossStarted = false;
  private endingStarted = false;
  private endingObjects: Phaser.GameObjects.GameObject[] = [];
  private ghostRecorder = new GhostRecorder(50);
  private ghostPlayer: GhostPlayer | null = null;
  private dialog = new SimpleDialog();
  private decor: Phaser.GameObjects.GameObject[] = [];
  private snapshots = new SnapshotRegistry();
  private dialogue!: DialogueManager;
  private bubble!: SpeechBubble;
  private makad!: MakadVoice;
  private interactions = new InteractionManager();
  private replies = new ReplyChooser();
  private encounters!: EncounterManager;
  private director!: ReactionDirector;
  private bonusHooks = new Map<Banana, () => void>();
  private achievementsThisRun = 0;
  private calloutBusyUntil = 0;
  private calloutCount = 0;
  private introTimers: Phaser.Time.TimerEvent[] = [];
  private introNode: HTMLElement | null = null;
  private introKey: ((e: KeyboardEvent) => void) | null = null;
  private banner: ReturnType<typeof drawBanner> | null = null;
  private footnote: Phaser.GameObjects.Text | null = null;
  private finalBonkDone = false;
  private handoverStarted = false;
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
  private rotatePaused = false;
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
    this.boss = null; this.bossStarted = false; this.endingStarted = false; this.endingObjects = []; this.ghostRecorder.reset(); this.ghostPlayer = null;
    this.snapshots = new SnapshotRegistry();

    // world
    this.backdrop = new Backdrop(this, this.palette, this.settings.settings.quality, 7, this.settings.reducedMotion);
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
    this.makad = new MakadVoice(this, this.player);
    this.interactions = new InteractionManager();
    this.interactions.onChange = (a) => { this.makad.setPrompt(a ? a.label : null, InputManager.instance.touchSeen ? '' : 'E'); TouchControls.instance.setTalkAvailable(!!a); };
    this.achievementsThisRun = 0; this.calloutBusyUntil = 0; this.calloutCount = 0; this.bonusHooks.clear();
    this.buildParticles();

    // grid entities
    this.level.bananas.forEach((b, i) => this.bananas.push(new Banana(this, b.x, b.y, `b${i}`)));
    const checkpointDefs = this.settings.settings.assist.enabled && this.settings.settings.assist.extraCheckpoints ? this.withAssistCheckpoints(this.level) : this.level.checkpoints;
    for (const c of checkpointDefs) this.checkpoints.push(new CheckpointPost(this, c.x, c.y, c.id, c.index, this.palette));
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
      playerAlert: (x) => { if (Math.abs(x - this.player.x) < 420 && this.player.alive) this.player.rig.setMood('alert', 700); },
      onImpact: (x) => this.director?.onImpactNear(x),
    };
    this.world = new LevelWorld(ctx);
    this.world.build(data.objects);
    // optional comedy encounters (own their pigs, props and locked bonus bananas)
    this.encounters = new EncounterManager(this.encounterHost());
    this.encounters.build(data.objects);
    this.director = new ReactionDirector({
      scene: this, player: this.player, pigs: this.world.pigs, policy: this.dialogue.policy, reducedMotion: this.settings.reducedMotion,
      say: (pig, key, opts) => this.pigSay(pig, key, opts),
      sfx: (name, i, gap) => this.audio.play(name, i, gap),
      sparkle: (x, y, n) => this.sparkles?.emitParticleAt(x, y, n),
      traps: this.world.trapWatchers(), signs: this.world.signs,
      hardBanana: data.hardBanana ? { x: data.hardBanana.x * TILE + TILE / 2, y: data.hardBanana.y * TILE + TILE / 2 } : null,
    });
    this.interactions.register({
      id: 'callout', label: 'DUKKAR!', priority: 1,
      available: () => { if (!this.player.alive || !this.player.grounded || this.time.now < this.calloutBusyUntil) return false; const pig = this.nearestPig(320); return !!pig && (!!pig.calloutHandler || !this.encounters.pigBusy(pig)); },
      run: () => this.callout(),
    });
    for (const fb of this.world.fleeing) this.bananas.push(fb.banana);
    for (const [i, b] of this.bananas.entries()) if (!this.world.fleeing.some((f) => f.banana === b)) this.snapshots.register(`banana-${i}`, b);
    this.wirePhysics();
    this.world.wire();
    if (data.boss) this.setupBoss(data);
    // ghost of the best run (replay mode only; visual, never collides)
    if (this.sceneData.mode === 'replay') {
      const rec = SaveManager.instance.getGhost(data.id, levelHash(data));
      if (rec && rec.frames.length >= 8) this.ghostPlayer = new GhostPlayer(this, rec);
    }

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
    this.cameras.main.fadeIn(this.settings.reducedMotion ? 1 : 380, 20, 35, 26);

    // input + global hooks
    const input = InputManager.instance;
    const onRestart = (): void => { if (!this.pauseMenu.open && !this.results.open) this.restartFromCheckpoint(); };
    const onPause = (): void => { if (this.results.open) return; this.pauseMenu.open ? this.resume() : this.pause(); };
    const onBack = (): void => { if (this.pauseMenu.open) this.resume(); };
    const onBlur = (): void => { if (!devFlags.noAutoPause && !this.pauseMenu.open && !this.results.open && this.scene.isActive()) this.pause(); };
    const onMute = (): void => { const m = this.settings.toggleMute(); UIRoot.toast(m ? 'Muted' : 'Sound on', 900); };
    const onScale = (): void => this.cameraCtl.applyZoom();
    const onSettings = (): void => { this.cameraCtl.shakeEnabled = this.settings.screenShake; this.player.setReducedMotion(this.settings.reducedMotion); this.hud.setTimerVisible(this.sceneData.mode === 'replay' || this.settings.settings.showTimer); };
    const onRotateShown = (): void => { if (!this.finished && !this.pauseMenu.open && !this.results.open && this.scene.isActive()) { this.scene.pause(); InputManager.instance.gameplayEnabled = false; InputManager.instance.releaseAll(); this.rotatePaused = true; } };
    const onRotateHidden = (): void => { if (this.rotatePaused) { this.rotatePaused = false; if (this.scene.isPaused()) this.scene.resume(); InputManager.instance.gameplayEnabled = true; } };
    const onBonk = (): void => { if (!this.pauseMenu.open && !this.results.open && !this.replies.open) this.doBonk(); };
    const onInteract = (): void => { if (!this.pauseMenu.open && !this.results.open && !this.replies.open && this.player.alive) this.interactions.onInteract(this.time.now); };
    input.on('restart', onRestart); input.on('pause', onPause); input.on('menuBack', onBack); input.on('mute', onMute);
    input.on('bonk', onBonk); input.on('interact', onInteract);
    window.addEventListener('blur', onBlur);
    bus.on(Events.RenderScaleChanged, onScale);
    bus.on(Events.SettingsChanged, onSettings);
    bus.on(Events.RotatePromptShown, onRotateShown);
    bus.on(Events.RotatePromptHidden, onRotateHidden);
    // the scene is still CREATING here; pause on the first update tick if the prompt is already up
    if (RotatePrompt.instance.open) this.time.delayedCall(0, onRotateShown);
    this.cleanups.push(() => {
      input.off('restart', onRestart); input.off('pause', onPause); input.off('menuBack', onBack); input.off('mute', onMute);
      input.off('bonk', onBonk); input.off('interact', onInteract);
      window.removeEventListener('blur', onBlur);
      bus.off(Events.RenderScaleChanged, onScale); bus.off(Events.SettingsChanged, onSettings);
      bus.off(Events.RotatePromptShown, onRotateShown); bus.off(Events.RotatePromptHidden, onRotateHidden);
    });

    // player events
    this.player.events.on('jumped', () => { this.audio.play('jump', 1, 60); this.puffDust(this.player.x, this.player.feetY, 6); });
    this.player.events.on('landed', (impact: number) => {
      if (impact > 150) {
        this.audio.play('land', Math.min(1.2, impact / 700), 80);
        this.puffDust(this.player.x, this.player.feetY, Math.round(4 + impact / 120));
        if (impact > 420 && !this.settings.reducedMotion) this.ringPuff(this.player.x, this.player.feetY - 4, 0.5 + impact / 1800);
      }
    });
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
    if (data.id === 'level1' && this.sceneData.mode === 'campaign' && this.sceneData.character === 'monkey' && !SaveManager.instance.data.progress.introSeen && !devFlags.startLevel) this.playIntro();
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

  /** Expanding ring for landings, pickups and checkpoints. */
  private ringPuff(x: number, y: number, scale = 1, tint = 0xffffff): void {
    if (this.settings.reducedMotion) return;
    const ring = this.add.image(x, y, 'ring').setScale(0.3 * scale).setAlpha(0.7).setTint(tint).setDepth(DEPTH.particles);
    this.tweens.add({ targets: ring, scaleX: 2.2 * scale, scaleY: 1.1 * scale, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  /** A small banana floats up from the pickup point toward the HUD and fades. */
  private collectFx(x: number, y: number): void {
    this.sparkles?.emitParticleAt(x, y, 10);
    this.ringPuff(x, y, 0.6, 0xf7c948);
    if (this.settings.reducedMotion) return;
    const icon = this.add.image(x, y, 'banana').setScale(0.5).setDepth(DEPTH.particles + 1);
    this.tweens.add({ targets: icon, y: y - 70, scaleX: 0.3, scaleY: 0.3, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => icon.destroy() });
  }

  /** Confetti burst for checkpoints and victories. */
  private confetti(x: number, y: number, n = 18): void {
    if (this.settings.reducedMotion || !this.debris) return;
    this.debris.setParticleTint([0xf7c948, 0xf4a7b4, 0x7ed957, 0x9fe3ff, 0xffffff]);
    this.debris.emitParticleAt(x, y, n);
    this.debris.setParticleTint([this.palette.plank, this.palette.plankDark, this.palette.outline]);
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
    this.collectFx(b.x, b.y);
    this.bonusHooks.get(b)?.();
    this.director.onBananaCollected(b.x, b.y);
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
    this.confetti(c.footX, c.footY - 90, 20);
    this.ringPuff(c.footX, c.footY - 60, 1.2, 0xf7c948);
    this.hud.flashCheckpoint(this.levelData.id === 'level2' ? 'Receipt printed' : 'Checkpoint');
    this.director.onCheckpoint(c.footX);
    bus.emit(Events.CheckpointReached, c.id);
  }

  private sayLine(key: string, once: boolean, speaker: 'pig' | 'caption'): void {
    if (!this.player.alive) return;
    const pigs = this.world.pigs;
    if (speaker === 'caption' || pigs.length === 0) {
      const line = DUKKAR_LINES[key];
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

  // ------------------------------------------------------------------ bonk, callout, encounters
  private nearestPig(maxDist: number): PigNPC | null {
    let best: PigNPC | null = null, bestD = maxDist;
    for (const pig of this.world.pigs) { if (pig.isHidden) continue; const d = Math.abs(pig.footX - this.player.x); if (d < bestD) { bestD = d; best = pig; } }
    return best;
  }

  private pigSay(pig: PigNPC, key: string, opts?: SayOptions): boolean {
    if (!this.player.alive && !opts?.force) return false;
    this.dialogue.setSpeaker(pig);
    const ok = this.dialogue.say(key, opts);
    if (ok) this.audio.play('oink', 0.7, 400);
    return ok;
  }

  /** Everything a bonk can connect with, in priority order. */
  private bonkTargets(): Bonkable[] {
    const list: Bonkable[] = [...this.world.pigs];
    if (this.boss) list.push(this.boss.bonkable());
    return list;
  }

  private doBonk(): void {
    const box = this.player.tryBonk();
    if (!box) return;
    const fromX = this.player.x;
    let hit: Bonkable | null = null;
    for (const b of this.bonkTargets()) {
      const bb = b.bonkBounds();
      if (!bb || !overlaps(box, bb)) continue;
      if (b instanceof PigNPC) {
        const handled = b.bonkHandler?.(fromX) ?? false;
        if (!handled) { b.recoil(fromX); this.pigSay(b, 'bonk-react', { priority: true }); }
      } else if (!b.onBonk(fromX)) continue;
      hit = b;
      this.bonkBurst((bb.left + bb.right) / 2, bb.top + (bb.bottom - bb.top) * 0.35);
      break;
    }
    if (hit) { this.audio.play('bonk', 1, 0); this.audio.play('squeak', 0.9, 0); this.cameraCtl.shake(0.0025, 90); }
    else { this.audio.play('whiff', 1, 0); if (!this.settings.reducedMotion) this.swipe(box.left + (box.right - box.left) / 2, box.top + (box.bottom - box.top) / 2); }
  }

  /** Comic impact: a star burst and the word, not a bruise. */
  private bonkBurst(x: number, y: number): void {
    const t = this.add.text(x, y - 20, 'BONK!', { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '26px', color: '#fff1a8', stroke: '#2a1d12', strokeThickness: 6, fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.particles + 1).setAngle(-8);
    if (this.settings.reducedMotion) { this.time.delayedCall(420, () => t.destroy()); return; }
    const spark = this.add.image(x, y, 'spark').setScale(0.9).setTint(0xfff1a8).setDepth(DEPTH.particles);
    t.setScale(0.3);
    this.tweens.add({ targets: t, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 260, duration: 320, onComplete: () => t.destroy() });
    this.tweens.add({ targets: spark, scaleX: 2.2, scaleY: 2.2, alpha: 0, angle: 60, duration: 240, onComplete: () => spark.destroy() });
    this.debris?.emitParticleAt(x, y, 5);
  }

  private swipe(x: number, y: number): void {
    const g = this.add.graphics().setDepth(DEPTH.particles);
    g.lineStyle(4, 0xffffff, 0.7); g.beginPath(); g.arc(x, y, 26, -1.2 * this.player.facing, 1.2 * this.player.facing, this.player.facing === -1); g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  /** "DUKKAR!" — the shout is Makad's; the reaction depends on what the nearest pig is up to. */
  private callout(): void {
    const pig = this.nearestPig(320);
    if (!pig) return;
    this.calloutBusyUntil = this.time.now + 5500;
    this.makad.say('callout');
    this.audio.play('callout', 1, 0);
    if (!this.settings.reducedMotion) this.player.rig.impulse(0.92, 1.12, 120);
    this.time.delayedCall(380, () => {
      if (!this.player.alive || pig.isHidden) return;
      if (pig.calloutHandler?.()) return;
      if (this.encounters.pigBusy(pig)) return; // mid-gag: the shout alone is the joke
      pig.lookAt(this.player.x);
      const variant = this.calloutCount++ % 2;
      if (variant === 0) {
        pig.rig.setMood('alert', 1600);
        if (!this.settings.reducedMotion) pig.rig.impulse(1.14, 0.86, 110);
        this.pigSay(pig, 'callout-freeze', { priority: true });
      } else {
        pig.showPlant(true);
        pig.rig.setMood('alert', 2200);
        this.pigSay(pig, 'callout-plant', { priority: true });
        this.time.delayedCall(2300, () => pig.showPlant(false));
      }
    });
  }

  private unlockAchievement(id: string): void {
    if (!SaveManager.instance.unlockAchievement(id)) return;
    this.achievementsThisRun++;
    AchievementToast.show(id);
    this.audio.play('sparkle', 1, 0);
  }

  private comedyLine(timeMs: number, bananas: number): string {
    const par = this.levelData.parTimeMs;
    const when = this.deaths === 0 ? 'deathless'
      : bananas >= this.bananas.length && this.bananas.length > 0 ? 'allBananas'
      : par && timeMs < par * 0.75 ? 'fast'
      : this.deaths >= 8 ? 'manyDeaths'
      : this.achievementsThisRun > 0 ? 'achievement' : 'default';
    return RESULTS_LINES.find((r) => r.when === when)?.text ?? RESULTS_LINES[RESULTS_LINES.length - 1].text;
  }

  private encounterHost(): EncounterHost {
    return {
      scene: this, player: this.player, world: this.world, reducedMotion: this.settings.reducedMotion,
      say: (pig, key, opts) => this.pigSay(pig, key, opts),
      makad: (k) => { this.makad.say(k); },
      caption: (text, ms) => this.captions.show(text, ms),
      sfx: (name, i, gap) => this.audio.play(name, i, gap),
      shake: (i, ms) => this.cameraCtl.shake(i, ms),
      debris: (x, y, n) => this.debris?.emitParticleAt(x, y, n),
      sparkle: (x, y, n) => this.sparkles?.emitParticleAt(x, y, n),
      confetti: (x, y, n) => this.confetti(x, y, n),
      addBanana: (x, y, id) => { const b = new Banana(this, x, y, id); b.setLocked(true); this.bananas.push(b); return b; },
      spawnPig: (x, y, pose: PigPose, flip, id) => { const pig = new PigNPC(this, x, y, pose, flip, id); this.world.pigs.push(pig); return pig; },
      achievement: (id) => this.unlockAchievement(id),
      interactions: this.interactions,
      bonkables: [],
      replies: this.replies,
      setFlag: (id) => SaveManager.instance.setFlag(id),
      hasFlag: (id) => SaveManager.instance.hasFlag(id),
      onBananaCollected: (banana, fn) => { this.bonusHooks.set(banana, fn); },
    };
  }

  // ------------------------------------------------------------------ opening (first new game only, skippable)
  private playIntro(): void {
    const pig = this.world.pigById('pig-intro');
    const sign = this.world.signs.get('sign-mine');
    if (!pig) return;
    SaveManager.instance.markIntroSeen();
    this.player.controlsEnabled = false;
    this.player.body.setVelocityX(0);
    const skip = el('button', 'bb-skip', INTRO.skip);
    skip.type = 'button';
    skip.addEventListener('click', () => this.skipIntro());
    this.introNode = UIRoot.mountOnStage(skip);
    this.introKey = (e: KeyboardEvent): void => { if (e.key === 'Enter' || e.key === 'Escape' || e.code === 'Space') { e.preventDefault(); this.skipIntro(); } };
    window.addEventListener('keydown', this.introKey, true);
    const at = (ms: number, fn: () => void): void => { this.introTimers.push(this.time.delayedCall(ms, fn)); };
    pig.lookAt(this.player.x);
    at(400, () => { pig.rig.setMood('smug', 2400); if (!this.settings.reducedMotion) pig.rig.impulse(0.9, 1.14, 160); this.audio.play('oink', 0.8, 0); this.dialogue.setSpeaker(pig); this.bubble.say(INTRO.steal, pig.bubbleAnchor().x, pig.bubbleAnchor().y, pig.bubbleAnchor().flip); });
    at(1700, () => { this.player.rig.setMood('neutral'); this.makad.say('intro-look'); });
    at(2700, () => {
      pig.walkTo(pig.footX + 64, 110, () => {
        if (!this.introNode) return;
        this.audio.play('bonk', 0.6, 0);
        pig.recoil(pig.rig.x - 40);
        if (sign && !this.settings.reducedMotion) this.tweens.add({ targets: [sign.gfx, sign.text], angle: 5, duration: 90, yoyo: true, repeat: 2 });
        this.captions.show(INTRO.bump, 1800);
      });
    });
    at(3700, () => this.finishIntro(pig));
  }

  private finishIntro(pig: PigNPC): void {
    this.player.controlsEnabled = true;
    if (this.introNode) { this.introNode.remove(); this.introNode = null; }
    if (this.introKey) { window.removeEventListener('keydown', this.introKey, true); this.introKey = null; }
    // the title card is optional and never blocks: it fades while the player already has control
    const card = el('div', 'bb-namecard');
    card.append(el('div', 'bb-namecard-name', INTRO.card.name), el('div', 'bb-namecard-role', INTRO.card.role), el('div', 'bb-namecard-note', INTRO.card.note));
    const node = UIRoot.mountOnStage(card);
    this.introTimers.push(this.time.delayedCall(2600, () => node.remove()));
    this.introTimers.push(this.time.delayedCall(900, () => pig.walkTo(pig.footX, 120, () => pig.lookAt(this.player.x))));
  }

  private skipIntro(silent = false): void {
    for (const t of this.introTimers) t.remove(false);
    this.introTimers = [];
    if (this.introNode) { this.introNode.remove(); this.introNode = null; }
    if (this.introKey) { window.removeEventListener('keydown', this.introKey, true); this.introKey = null; }
    document.querySelectorAll('.bb-namecard').forEach((n) => n.remove());
    if (silent) return;
    const pig = this.world.pigById('pig-intro');
    if (pig) { pig.resetToHome(); pig.holdBanana(true); pig.lookAt(this.player.x); }
    this.bubble.hideNow();
    this.player.controlsEnabled = true;
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
    if (cause === 'crush' && this.bossStarted && this.boss && !this.boss.defeated) cause = 'boss';
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
    if (!this.settings.reducedMotion) { const burst = this.add.image(this.player.x, this.player.feetY - 50, 'spark').setScale(1.4).setTint(0xfff1a8).setDepth(DEPTH.particles); this.tweens.add({ targets: burst, scaleX: 3, scaleY: 3, alpha: 0, angle: 90, duration: 260, onComplete: () => burst.destroy() }); }
    // the nearest pig enjoys this a little too much (until he has seen it three times)
    this.director.onPlayerDied(cause, this.player.x);
    this.encounters.onPlayerDied();
    this.replies.hide();
    this.makad.hide();
    this.dialogue.hide();
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
      this.encounters.resetAll();
      this.boss?.restore();
      this.bananasSpent = 0;
    } else {
      this.bananasSpent = this.spentAtBaseline;
    }
    this.world.afterRestore();
    if (this.boss && this.bossStarted) {
      // the encounter restarts from the pre-arena checkpoint: reopen the door, widen the camera, calm the music
      this.bossStarted = false;
      this.cameraCtl.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
      this.world.gates.get('arena-door')?.setOpen(true, false);
      this.hud.setBoss(null);
      this.audio.playMusic(this.levelData.music ?? 'hq');
      this.dialogue.hide();
    }
    this.hud.setBananas(this.collectedCount(), this.bananas.length);
    this.deathContext = null;
    this.dialogue.hide();
    this.player.respawn();
    this.player.rig.setMood('embarrassed', 900);
    this.cameraCtl.snapTo(this.player.x, this.player.feetY, this.player.facing);
    this.encounters.onPlayerRespawned();
    this.director.onPlayerRespawned();
    bus.emit(Events.PlayerRespawned);
  }

  private restartFromCheckpoint(): void {
    if (!this.player.alive || this.finished) return;
    this.captions.clear();
    this.respawn();
  }

  // ------------------------------------------------------------------ boss + ending
  private setupBoss(data: LevelData): void {
    const arenaDef = data.objects.find((o) => o.type === 'boss-arena');
    if (!arenaDef || arenaDef.type !== 'boss-arena') return;
    const arena = { left: arenaDef.x * TILE, right: (arenaDef.x + arenaDef.w) * TILE, top: arenaDef.y * TILE, floorY: (arenaDef.y + arenaDef.h) * TILE };
    const boss = (this.boss = new PigBoss(this, arena, this.settings.reducedMotion));
    this.snapshots.register('boss', boss);
    const entry = this.add.zone(arena.left + 70, arena.floorY - 100, 60, 200);
    this.physics.add.existing(entry, true);
    this.decor.push(entry);
    this.physics.add.overlap(this.player.proxy, entry, () => this.startBoss(arena));
    this.physics.add.collider(this.player.proxy, boss.root, () => { if (boss.deadly) this.kill('boss'); });
    this.physics.add.overlap(this.player.proxy, boss.stompZone, () => {
      if (!boss.stunned || this.player.body.velocity.y < 60) return;
      if (boss.stomp()) {
        this.player.body.setVelocityY(-560);
        this.audio.play('bossHit', 1, 200);
        this.cameraCtl.shake(0.008, 260);
        if (!this.settings.reducedMotion) this.cameras.main.flash(140, 255, 241, 168);
        this.confetti(boss.root.x, boss.root.y - 110, 14);
        this.sparkles?.emitParticleAt(boss.root.x, boss.root.y - 110, 18);
        this.hud.setBoss(boss.hp);
      }
    });
    boss.events.on('telegraph', (kind: string) => this.audio.play(kind === 'charge' ? 'bossCharge' : 'warning', 1, 300));
    boss.events.on('charge', () => this.audio.play('whoosh', 1, 200));
    boss.events.on('wallHit', () => { this.audio.play('slam', 1, 100); this.cameraCtl.shake(0.01, 300); this.debris?.emitParticleAt(boss.root.x, boss.root.y - 60, 12); });
    boss.events.on('crateLand', (x: number, y: number) => { this.audio.play('impact', 0.9, 80); this.debris?.emitParticleAt(x, y, 6); this.cameraCtl.shake(0.003, 120); });
    boss.events.on('hit', (hp: number) => {
      this.audio.play('bossHurt', 1, 0);
      if (hp === 2) { this.time.delayedCall(350, () => boss.dropDecor()); this.time.delayedCall(600, () => this.bossSay('boss-p2')); }
      if (hp === 1) { this.time.delayedCall(400, () => { boss.emergencyLight(true); this.audio.play('warning', 0.6, 0); }); this.time.delayedCall(600, () => this.bossSay('boss-p3')); }
    });
    boss.events.on('clang', () => this.audio.play('clang', 1, 150));
    boss.events.on('bonked', () => this.finalBonk());
    boss.events.on('defeated', () => this.onBossDefeated(arena));
  }

  private bossSay(key: string): void {
    if (!this.boss) return;
    this.dialogue.setSpeaker(this.boss);
    this.dialogue.say(key, { once: true, priority: true });
  }

  private startBoss(arena: { left: number; right: number; floorY: number; top: number }): void {
    if (!this.boss || this.bossStarted || !this.player.alive) return;
    this.bossStarted = true;
    this.cameraCtl.setBounds(arena.left, 0, arena.right - arena.left, this.level.heightPx);
    this.world.gates.get('arena-door')?.setOpen(false);
    this.audio.playMusic('boss');
    this.audio.setMusicIntensity(1);
    this.hud.setBoss(this.boss.hp);
    this.boss.start();
    this.time.delayedCall(400, () => this.bossSay('l5-boss-start'));
    this.time.delayedCall(3400, () => this.bossSay('boss-p1'));
  }

  private onBossDefeated(arena: { left: number; right: number; floorY: number; top: number }): void {
    if (!this.boss || this.endingStarted) return;
    this.endingStarted = true;
    this.running = false; // the clock stops when the pig does
    this.hud.setBoss(0);
    this.audio.play('fanfare', 1, 0);
    this.audio.setMusicIntensity(0.4);
    this.cameraCtl.shake(0.006, 400);
    this.time.delayedCall(700, () => this.bossSay('l5-defeat'));
    // a banner he clearly had made in advance
    this.finalBonkDone = false; this.handoverStarted = false;
    const bx = (arena.left + arena.right) / 2;
    this.banner = drawBanner(this, bx, arena.top - 120, ENDING.bannerFirst);
    this.endingObjects.push(this.banner.c);
    this.time.delayedCall(900, () => { this.audio.play('pop', 1, 0); if (this.settings.reducedMotion) this.banner?.c.setY(arena.top + 150); else this.tweens.add({ targets: this.banner!.c, y: arena.top + 150, duration: 900, ease: 'Bounce.easeOut' }); });
    // the "golden" banana trophy lands on the floor in front of the forklift
    const tx = Phaser.Math.Clamp(this.boss.root.x - 150, arena.left + 60, arena.right - 60);
    const trophy = this.add.image(tx, arena.floorY - 24, 'banana-gold').setScale(1.2).setDepth(DEPTH.objects + 2);
    const glow = this.add.image(tx, arena.floorY - 24, 'glow').setScale(1.4).setTint(0xf7c948).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.objects + 1);
    const tzone = this.add.zone(tx, arena.floorY - 30, 60, 60);
    this.physics.add.existing(tzone, true);
    // the real banana, next to his lunch, by the far wall
    const lx = arena.right - 90;
    const lunch = this.add.graphics().setDepth(DEPTH.objects);
    lunch.fillStyle(0x2c1a0e, 1); lunch.fillRoundedRect(lx - 50, arena.floorY - 44, 100, 10, 4); lunch.fillRect(lx - 40, arena.floorY - 34, 8, 34); lunch.fillRect(lx + 32, arena.floorY - 34, 8, 34);
    lunch.fillStyle(0xe5484d, 1); lunch.fillRoundedRect(lx - 36, arena.floorY - 74, 44, 30, 5); lunch.fillStyle(0x2c1a0e, 1); lunch.fillRect(lx - 30, arena.floorY - 78, 32, 6);
    const real = this.add.image(lx + 24, arena.floorY - 60, 'banana').setScale(0.7).setDepth(DEPTH.objects + 2);
    const realGlow = this.add.image(lx + 24, arena.floorY - 60, 'glow').setScale(0.8).setTint(0xfff1a8).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.objects + 1);
    const rzone = this.add.zone(lx + 24, arena.floorY - 50, 50, 70);
    this.physics.add.existing(rzone, true);
    this.endingObjects.push(trophy, glow, tzone, lunch, real, realGlow, rzone);
    let gotTrophy = false, finished = false;
    const finish = (): void => { if (finished) return; finished = true; this.completeLevel(); };
    this.physics.add.overlap(this.player.proxy, tzone, () => {
      if (gotTrophy) return;
      gotTrophy = true;
      this.audio.play('collect', 1, 0);
      this.sparkles?.emitParticleAt(tx, arena.floorY - 30, 20);
      trophy.destroy(); glow.destroy();
      this.time.delayedCall(500, () => { this.captions.show(ENDING.trophyReveal, 2400); this.audio.play('pop', 1, 0); this.bossSay('l5-plastic'); });
      this.time.delayedCall(3100, () => { this.captions.show(ENDING.realBanana, 2600); realGlow.setAlpha(0.9); });
      autoFinish = this.time.delayedCall(12000, finish);
    });
    let autoFinish: Phaser.Time.TimerEvent | null = null;
    this.physics.add.overlap(this.player.proxy, rzone, () => {
      if (!gotTrophy || finished || this.handoverStarted) return;
      this.handoverStarted = true;
      autoFinish?.remove(false);
      this.audio.play('sparkle', 1, 0);
      this.sparkles?.emitParticleAt(lx + 24, arena.floorY - 60, 30);
      real.destroy(); realGlow.destroy();
      this.bossSay('l5-real');
      this.time.delayedCall(1500, () => this.handover(arena, finish));
    });
  }

  /** One safe celebratory bonk after the fight: the pre-made banner gets corrected. */
  private finalBonk(): void {
    if (!this.boss || this.finalBonkDone) return;
    this.finalBonkDone = true;
    this.boss.rig.playHurt();
    this.boss.rig.setMood('embarrassed', 2600);
    this.bossSay('boss-final-bonk');
    const b = this.banner;
    if (!b) return;
    const flip = (): void => {
      b.label.setText(ENDING.bannerFlipped);
      this.audio.play('pop', 1, 0);
      const foot = this.add.text(b.c.x, b.c.y + 44, ENDING.footnote, { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '12px', color: '#2a1d12', fontStyle: 'italic', backgroundColor: '#fff8e7', padding: { x: 6, y: 2 } }).setOrigin(0.5).setDepth(DEPTH.npc + 4);
      this.footnote = foot;
      this.endingObjects.push(foot);
      this.interactions.register({
        id: 'remove-footnote', label: 'Remove', priority: 4,
        available: () => !!this.footnote && this.player.alive && Math.abs(this.player.x - b.c.x) < 130,
        run: () => {
          const f = this.footnote; if (!f) return;
          this.footnote = null;
          this.interactions.unregister('remove-footnote');
          this.audio.play('pop', 1, 0);
          this.player.rig.setMood('smug', 1500);
          if (this.settings.reducedMotion) f.destroy();
          else this.tweens.add({ targets: f, y: f.y + 220, angle: -70, alpha: 0, duration: 700, ease: 'Quad.easeIn', onComplete: () => f.destroy() });
        },
      });
    };
    if (this.settings.reducedMotion) { flip(); return; }
    this.tweens.add({ targets: b.c, scaleX: 0, duration: 160, ease: 'Quad.easeIn', onComplete: () => { flip(); this.tweens.add({ targets: b.c, scaleX: 1, duration: 200, ease: 'Back.easeOut' }); } });
  }

  /** Real banana, handmade trophy, and a choice: high-five, bonk, or both. Then the truce lasts four seconds. */
  private handover(arena: { left: number; right: number; floorY: number; top: number }, finish: () => void): void {
    const px = this.player.x;
    const startX = Phaser.Math.Clamp(px + 260, arena.left + 80, arena.right - 60);
    const d = new PigNPC(this, startX, arena.floorY, 'idle', true, 'dukkar-end');
    this.world.pigs.push(d);
    d.holdBanana(true);
    const trophy = drawTrophy(this, startX - 30, arena.floorY - 40, ENDING.trophyFront, ENDING.trophyBack);
    trophy.c.setScale(0.8);
    this.endingObjects.push(trophy.c);
    const standX = Phaser.Math.Clamp(px + 110, arena.left + 60, arena.right - 60);
    const follow = this.time.addEvent({ delay: 16, loop: true, callback: () => { trophy.c.setPosition(d.rig.x - 30 * (d.rig.x > this.player.x ? 1 : -1), d.rig.y - 40); } });
    const say = (key: string): void => { this.pigSay(d, key, { priority: true, force: true }); };
    d.walkTo(standX, 150, () => {
      follow.remove(false);
      d.lookAt(this.player.x);
      say('end-handover');
      const dir = this.player.x < d.rig.x ? -1 : 1;
      const tx = d.rig.x + dir * 60, ty = arena.floorY;
      // trophy goes down between them; a flip shows the back, then the front again
      this.tweens.add({ targets: trophy.c, x: tx, y: ty, scaleX: 1, scaleY: 1, duration: this.settings.reducedMotion ? 1 : 500, ease: 'Quad.easeOut', onComplete: () => {
        this.sparkles?.emitParticleAt(tx, ty - 50, 12);
        const showBack = (): void => { trophy.front.setVisible(false); trophy.back.setVisible(true); };
        const showFront = (): void => { trophy.front.setVisible(true); trophy.back.setVisible(false); };
        if (this.settings.reducedMotion) { showBack(); this.time.delayedCall(1400, showFront); }
        else {
          this.tweens.add({ targets: trophy.c, scaleX: -1, duration: 260, delay: 600, onComplete: showBack });
          this.tweens.add({ targets: trophy.c, scaleX: 1, duration: 260, delay: 2300, onStart: showFront });
        }
      } });
      // the real banana changes hands
      this.time.delayedCall(900, () => {
        d.holdBanana(false);
        const img = this.add.image(d.rig.x, d.rig.y - 40, 'banana').setScale(0.5).setDepth(DEPTH.npc + 3);
        this.endingObjects.push(img);
        this.tweens.add({ targets: img, x: this.player.x, y: this.player.feetY - 70, duration: this.settings.reducedMotion ? 1 : 420, ease: 'Quad.easeOut', onComplete: () => { img.destroy(); this.audio.play('collect', 1, 0); this.collectFx(this.player.x, this.player.feetY - 70); } });
      });
      this.time.delayedCall(2800, () => {
        this.makad.say('end-pick');
        this.replies.show(null, [
          { id: 'highfive', label: ENDING.options.highfive }, { id: 'bonk', label: ENDING.options.bonk }, { id: 'both', label: ENDING.options.both },
        ], (pick) => {
          const highfive = (key: string | null): void => {
            d.lookAt(this.player.x);
            this.audio.play('pop', 1, 0);
            if (!this.settings.reducedMotion) { this.player.rig.impulse(0.9, 1.12, 140); d.rig.impulse(0.9, 1.12, 140); }
            this.sparkles?.emitParticleAt((this.player.x + d.rig.x) / 2, this.player.feetY - 80, 16);
            if (key) say(key);
            this.unlockAchievement('truce');
          };
          const bonk = (key: string | null): void => {
            this.player.facing = d.rig.x > this.player.x ? 1 : -1;
            if (!this.settings.reducedMotion) this.player.rig.impulse(1.14, 0.9, 70);
            d.recoil(this.player.x);
            this.bonkBurst(d.rig.x, d.rig.y - 60);
            this.audio.play('bonk', 1, 0); this.audio.play('squeak', 1, 0);
            if (key) say(key);
            this.unlockAchievement('coming');
          };
          let tableauDelay = 1600;
          if (pick === 'highfive') highfive('end-highfive');
          else if (pick === 'bonk') bonk('end-bonk');
          else if (pick === 'both') { bonk(null); this.time.delayedCall(1000, () => highfive('end-both')); tableauDelay = 2800; }
          this.time.delayedCall(tableauDelay, () => {
            // the tableau: he reaches for another banana, Makad notices, everyone freezes
            d.holdBanana(true);
            d.rig.setMood('smug', 4000);
            if (!this.settings.reducedMotion) d.rig.impulse(1.08, 0.94, 160);
            this.time.delayedCall(700, () => {
              this.player.rig.setMood('alert', 4000);
              d.rig.setMood('alert', 4000);
              this.audio.play('pop', 0.8, 0);
              this.captions.show(ENDING.closing, 2600);
              this.time.delayedCall(2600, finish);
            });
          });
        }, 12000);
      });
    });
  }

  private completeLevel(): void {
    if (this.finished || !this.player.alive) return;
    this.finished = true;
    this.running = false;
    this.player.controlsEnabled = false;
    this.player.body.setVelocityX(0);
    this.replies.hide();
    this.interactions.clear();
    this.makad.setPrompt(null);
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
    const wasUnlocked = save.data.progress.pigUnlocked;
    if (idx >= 0 && idx === CAMPAIGN.length - 1 && CAMPAIGN.every((id) => save.data.progress.completed[id])) save.setCampaignComplete();
    const justUnlocked = !wasUnlocked && save.data.progress.pigUnlocked;
    if (isNewBest) save.setGhost(this.levelData.id, this.ghostRecorder.toRecording(this.levelData.id, levelHash(this.levelData), character, record.timeMs));
    const endLine = DUKKAR_LINES[`${this.levelData.id.replace('level', 'l')}-end`] ?? DUKKAR_LINES['l5-defeat'];
    bus.emit(Events.LevelCompleted, this.levelData.id);
    this.time.delayedCall(900, () => {
      if (!this.scene.isActive()) return;
      TouchControls.instance.setPlaying(false);
      this.results.show({
        levelName: this.levelData.name, levelIndex: idx >= 0 ? idx + 1 : null, timeMs: record.timeMs, deaths: this.deaths,
        bananas, bananaTotal: this.bananas.length, best: isNewBest ? previous : save.getRecord(this.levelData.id, character, assist), isNewBest,
        nextLevelId, pigLine: typeof endLine === 'string' ? endLine : 'See? Nothing happened. Mostly.', character, comedyLine: this.comedyLine(record.timeMs, bananas),
        campaignComplete: this.levelData.boss === true && save.data.progress.campaignComplete,
        unlockLine: justUnlocked ? ENDING.unlock : null,
      }, {
        next: () => { this.results.hide(); if (nextLevelId) this.scene.restart({ ...this.sceneData, levelId: nextLevelId }); },
        replay: () => { this.results.hide(); this.scene.restart(this.sceneData); },
        title: () => { this.results.hide(); this.quitToTitle(); },
        download: () => downloadResultsCard(this, { levelName: this.levelData.name, levelIndex: idx >= 0 ? idx + 1 : null, timeMs: record.timeMs, deaths: this.deaths, bananas, bananaTotal: this.bananas.length, character, isNewBest, campaignComplete: save.data.progress.campaignComplete && this.levelData.boss === true, assist, gameVersion: GAME_VERSION, comedyLine: this.comedyLine(record.timeMs, bananas) }),
        credits: () => { this.results.hide(); showCredits(this.dialog, () => this.quitToTitle()); },
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
    if (this.flag) { this.flag.alert = !this.flag.fled && Math.abs(this.flag.x - this.player.x) < 340 && this.player.alive; this.flag.tick(dt); }
    this.player.update(dt);
    this.encounters.update(dt, this.time.now);
    this.director.quiet = this.encounters.anyRunning() || this.endingStarted || this.finished || this.replies.open;
    this.director.update(dt);
    this.interactions.update();
    this.makad.update(dt);
    if (this.boss) {
      this.boss.update(this.bossStarted ? dt : 0, this.player.x);
      const pb = this.player.body;
      if (this.player.alive && this.boss.crateHits(pb.left, pb.right, pb.top, pb.bottom)) this.kill('boss');
      // the forklift moves faster per step than Arcade's overlap bias allows, so contact is checked directly
      const bb = this.boss.body;
      if (this.player.alive && this.boss.deadly && bb.enable && pb.right > bb.left + 6 && pb.left < bb.right - 6 && pb.bottom > bb.top + 8 && pb.top < bb.bottom) this.kill('boss');
    }
    if (this.player.alive && this.running) this.ghostRecorder.update(delta, this.player.x, this.player.feetY, this.player.facing, this.player.state);
    this.ghostPlayer?.update(delta);
    if (this.player.alive && this.running) {
      this.elapsedMs += delta;
      if (this.player.feetY > this.level.heightPx + 160) this.kill('fall');
    }
    this.player.setGroundProbe(this.groundBelow(this.player.x, this.player.feetY - 2));
    this.cameraCtl.update(dt, this.player.x, this.player.feetY, this.player.facing, this.player.body.velocity.y, this.player.grounded);
    const cam = this.cameras.main;
    this.backdrop.update(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2, cam.scrollX, cam.scrollY, dt);
    this.water.update(dt);
    this.dialogue.update(this.time.now, !this.player.grounded);
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

  /** Assist mode: add a checkpoint on safe ground roughly halfway between each pair of designer checkpoints. */
  private withAssistCheckpoints(level: ParsedLevel): ParsedLevel['checkpoints'] {
    const anchors = [level.spawn, ...level.checkpoints.map((c) => ({ x: c.x, y: c.y }))];
    const extra: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < anchors.length; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (b.x - a.x < TILE * 24) continue;
      const midCol = Math.round((a.x + b.x) / 2 / TILE);
      // search outward for a solid tile with three empty tiles above it (standing room)
      for (let d = 0; d < 12; d++) {
        for (const col of [midCol + d, midCol - d]) {
          if (col < 1 || col >= level.cols - 1) continue;
          for (let row = 1; row < level.rows; row++) {
            if (level.grid[row][col] === 'solid' && level.grid[row - 1][col] === 'empty' && (row < 2 || level.grid[row - 2][col] === 'empty') && (row < 3 || level.grid[row - 3][col] === 'empty')) {
              extra.push({ x: col * TILE + TILE / 2, y: row * TILE });
              d = 99; break;
            }
          }
          if (d === 99) break;
        }
      }
    }
    const all = [...level.checkpoints.map((c) => ({ x: c.x, y: c.y })), ...extra].sort((p, q) => p.x - q.x);
    return all.map((p, index) => ({ ...p, id: `cp${index + 1}`, index }));
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
    this.boss?.destroy();
    this.ghostPlayer?.destroy();
    for (const o of this.endingObjects) o.destroy();
    this.dialog.hide();
    for (const b of this.bananas) b.destroy();
    for (const c of this.checkpoints) c.destroy();
    this.flag?.destroy();
    for (const d of this.decor) d.destroy();
    this.terrain.destroy();
    this.backdrop.destroy();
    this.water.destroy();
    this.sparkles?.destroy(); this.dust?.destroy(); this.debris?.destroy();
    this.skipIntro(true);
    this.encounters.destroy();
    this.director.destroy();
    this.makad.destroy();
    this.replies.hide();
    this.interactions.clear();
    TouchControls.instance.setTalkAvailable(false);
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
