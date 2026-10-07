import Phaser from 'phaser';
import { CHARACTERS } from '../content/characters';
import { AudioEngine } from '../core/audio/AudioEngine';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { Events, bus } from '../core/events';
import { InputManager } from '../core/input/InputManager';
import { fitCamera } from '../core/render/RenderScale';
import { SaveManager } from '../core/save/SaveManager';
import { SettingsService } from '../core/settings/SettingsService';
import { CharacterRig } from '../gameplay/player/CharacterRig';
import { Backdrop } from '../gameplay/world/Backdrop';
import { THEMES } from '../gameplay/world/themes';
import { CAMPAIGN } from '../levels';
import { LevelSelectMenu } from '../ui/LevelSelectMenu';
import { MainMenu } from '../ui/MainMenu';
import { showCharacterPicker, showCredits, showFirstRun, SimpleDialog } from '../ui/Overlays';
import { SettingsMenu } from '../ui/SettingsMenu';
import { TouchControls } from '../ui/TouchControls';
import { UIRoot } from '../ui/UIRoot';

/**
 * Title screen diorama. The monkey guards the golden banana; the pig sneaks closer; the monkey turns; the
 * pig whistles innocently and backs off. Loops with deliberate pauses. Menus are DOM.
 */
export class TitleScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private monkey!: CharacterRig;
  private pig!: CharacterRig;
  private banana!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private beam!: Phaser.GameObjects.Graphics;
  private sparkles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private monkeyMark!: Phaser.GameObjects.Text;
  private pigMark!: Phaser.GameObjects.Text;
  private menu = new MainMenu();
  private settingsMenu = new SettingsMenu();
  private levels = new LevelSelectMenu();
  private dialog = new SimpleDialog();
  private groundY = GAME_HEIGHT - 52;
  private pigHomeX = 0;
  private pigTarget = 0;
  private pigVx = 0;
  private pigGrounded = true;
  private beat: Phaser.Time.TimerEvent | null = null;
  private tweensActive: Phaser.Tweens.Tween[] = [];
  private cleanups: (() => void)[] = [];
  private reduced = false;

  constructor() { super('Title'); }

  create(): void {
    const palette = THEMES.jungle;
    this.reduced = SettingsService.instance.reducedMotion;
    fitCamera(this.cameras.main);
    this.cameras.main.setBackgroundColor(palette.skyBottom);
    this.backdrop = new Backdrop(this, palette, SettingsService.instance.settings.quality, 3, this.reduced);
    this.backdrop.update(GAME_WIDTH / 2, GAME_HEIGHT / 2, 0, 0, 0);

    const gy = this.groundY;
    const g = this.add.graphics().setDepth(0);
    // ground slab with grass, soil bands and a few stones
    g.fillStyle(palette.outline, 1); g.fillRect(-100, gy - 3, GAME_WIDTH + 200, 200);
    g.fillStyle(palette.ground, 1); g.fillRect(-100, gy, GAME_WIDTH + 200, 200);
    g.fillStyle(palette.soilLight, 0.5); g.fillRect(-100, gy + 14, GAME_WIDTH + 200, 10);
    g.fillStyle(palette.soilDeep, 0.5); g.fillRect(-100, gy + 60, GAME_WIDTH + 200, 200);
    g.fillStyle(palette.grass, 1); g.fillRect(-100, gy, GAME_WIDTH + 200, 11);
    g.fillStyle(palette.grassDark, 1); g.fillRect(-100, gy + 11, GAME_WIDTH + 200, 4);
    for (let x = -80; x < GAME_WIDTH + 100; x += 11) { const k = ((x / 11) % 4 + 4) % 4; g.fillStyle(k % 2 ? palette.grassDark : palette.grass, 1); g.fillEllipse(x, gy - 1 - k, 9 + k, 8 + k); g.fillStyle(palette.grass, 1); g.fillEllipse(x - 1, gy - 2 - k, 5, 5); }
    for (let i = 0; i < 9; i++) { const sx = 40 + i * 110, sy = gy + 70 + (i % 3) * 18; g.fillStyle(palette.outline, 0.9); g.fillEllipse(sx, sy, 16, 10); g.fillStyle(palette.stone, 0.9); g.fillEllipse(sx - 1, sy - 1, 12, 7); }

    // pedestal: stone plinth with a gilded trim and a spotlight beam
    const px = GAME_WIDTH / 2, py = gy;
    this.beam = this.add.graphics().setDepth(1);
    this.beam.fillStyle(0xfff1a8, 0.16); this.beam.fillTriangle(px - 22, py - 70, px + 22, py - 70, px + 150, -40); this.beam.fillTriangle(px - 22, py - 70, px + 22, py - 70, px - 150, -40);
    g.fillStyle(palette.outline, 1); g.fillRoundedRect(px - 46, py - 64, 92, 64, 8); g.fillRoundedRect(px - 56, py - 14, 112, 14, 4);
    g.fillStyle(palette.groundLight, 1); g.fillRoundedRect(px - 42, py - 60, 84, 56, 6); g.fillRoundedRect(px - 52, py - 11, 104, 9, 3);
    g.fillStyle(0xf7c948, 1); g.fillRect(px - 42, py - 60, 84, 5); g.fillStyle(0xffe58a, 1); g.fillRect(px - 42, py - 60, 84, 2);
    g.fillStyle(palette.outline, 0.9); g.fillRect(px - 42, py - 36, 84, 3);
    g.fillStyle(0xffffff, 0.18); g.fillRect(px - 38, py - 54, 4, 44);
    this.glow = this.add.image(px, py - 96, 'glow').setScale(2.6).setTint(0xf7c948).setAlpha(0.65).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    this.banana = this.add.image(px, py - 96, 'banana-gold').setScale(1.45).setDepth(2);
    if (!this.reduced) {
      this.sparkles = this.add.particles(px, py - 96, 'spark', { lifespan: { min: 600, max: 1100 }, speed: { min: 6, max: 24 }, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, frequency: 420, quantity: 1, x: { min: -34, max: 34 }, y: { min: -20, max: 16 }, tint: [0xffffff, 0xfff1a8], blendMode: Phaser.BlendModes.ADD }).setDepth(3);
    }

    // characters, larger than in play
    this.monkey = new CharacterRig(this, px - 190, gy, CHARACTERS.monkey);
    this.monkey.setScale(1.3); this.monkey.baseScaleMultiplier = 1.3;
    this.monkey.setFacing(-1);
    this.pigHomeX = px + 410;
    this.pigTarget = px + 150;
    this.pig = new CharacterRig(this, this.pigHomeX, gy, CHARACTERS.pig);
    this.pig.baseScaleMultiplier = 1.3;
    this.pig.setFacing(-1);
    this.monkey.reducedMotion = this.reduced; this.pig.reducedMotion = this.reduced;
    const markStyle = { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: '44px', color: '#fff8e7', fontStyle: 'bold', stroke: '#2c1a0e', strokeThickness: 8 };
    this.monkeyMark = this.add.text(0, 0, '!', markStyle).setOrigin(0.5).setDepth(30).setVisible(false);
    this.pigMark = this.add.text(0, 0, '♪', markStyle).setOrigin(0.5).setDepth(30).setVisible(false);
    if (this.reduced) {
      // static tableau: the pig caught mid-sneak, whistling
      this.pig.setX(px + 230); this.pig.setMood('smug');
      this.pigMark.setVisible(true).setPosition(px + 250, gy - 170);
    } else {
      this.scheduleBeat(900, () => this.sneak());
    }
    this.add.rectangle(GAME_WIDTH / 2, 150, GAME_WIDTH + 200, 300, 0x14231a, 0.18).setDepth(3).setBlendMode(Phaser.BlendModes.MULTIPLY);

    TouchControls.instance.setPlaying(false);
    AudioEngine.instance.playMusic('title');
    AudioEngine.instance.setMusicIntensity(0.5);
    this.showMenu();
    this.cameras.main.fadeIn(400, 20, 35, 26);

    const input = InputManager.instance;
    const onMute = (): void => { const m = SettingsService.instance.toggleMute(); UIRoot.toast(m ? 'Muted' : 'Sound on', 900); };
    const onScale = (): void => fitCamera(this.cameras.main);
    input.on('mute', onMute);
    bus.on(Events.RenderScaleChanged, onScale);
    this.cleanups.push(() => { input.off('mute', onMute); bus.off(Events.RenderScaleChanged, onScale); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  // ---------- the loop: guard → sneak → notice → innocent → retreat ----------
  private scheduleBeat(delay: number, fn: () => void): void {
    this.beat = this.time.delayedCall(delay, () => { if (this.scene.isActive()) fn(); });
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const t = this.tweens.add(cfg);
    this.tweensActive.push(t);
    return t;
  }

  /** Where each creeping attempt stops; the third one is close enough to get properly caught. */
  private stops(): number[] { return [this.pigTarget + 170, this.pigTarget + 70, this.pigTarget]; }
  private attempt = 0;

  private sneak(): void {
    // first cautious tiptoe from home
    this.attempt = 0;
    this.pig.setFacing(-1); this.pig.setMood('alert');
    this.pigVx = -70;
    this.tween({ targets: this.pig, x: this.stops()[0], duration: 1900, ease: 'Sine.easeInOut', onComplete: () => { this.pigVx = 0; this.scheduleBeat(250, () => this.notice()); } });
  }

  private notice(): void {
    // Makad catches movement: whips round with a "!"; Dukkar freezes mid-step
    this.monkey.setFacing(1); this.monkey.setMood('alert'); this.monkey.impulse(0.86, 1.14, 110);
    this.showMark(this.monkeyMark, this.monkey.x + 30, this.groundY - 190, 700);
    this.pig.impulse(1.14, 0.86, 110);
    const lastAttempt = this.attempt >= this.stops().length - 1;
    this.scheduleBeat(450, () => {
      if (lastAttempt) { this.caught(); return; }
      // pretends to inspect the scenery: turns away, shuffles a step, very interested in a leaf
      this.pig.setMood('neutral');
      this.pig.setFacing(1);
      this.pigVx = 40;
      this.tween({ targets: this.pig, x: this.pig.x + 26, duration: 520, ease: 'Sine.easeInOut', onComplete: () => { this.pigVx = 0; } });
      this.showMark(this.pigMark, this.pig.x + 34, this.groundY - 186, 1500);
      this.scheduleBeat(1500, () => {
        // Makad shrugs it off and looks away…
        this.monkey.setMood('neutral'); this.monkey.setFacing(-1);
        this.scheduleBeat(900, () => this.tryAgain());
      });
    });
  }

  private tryAgain(): void {
    // …and Dukkar immediately tries again, from where he stands, a little closer each time
    this.attempt++;
    const target = this.stops()[Math.min(this.attempt, this.stops().length - 1)];
    this.pig.setFacing(-1); this.pig.setMood('alert');
    this.pigVx = -70;
    this.tween({ targets: this.pig, x: target, duration: Math.max(700, Math.abs(this.pig.x - target) * 12), ease: 'Sine.easeInOut', onComplete: () => { this.pigVx = 0; this.scheduleBeat(250, () => this.notice()); } });
  }

  private caught(): void {
    // too close to pretend: whistles, then backs off all the way home and the whole thing starts over
    this.pig.setMood('smug');
    this.pig.setFacing(1);
    this.showMark(this.pigMark, this.pig.x + 34, this.groundY - 186, 1500);
    this.scheduleBeat(1500, () => this.retreat());
  }

  private retreat(): void {
    this.pigVx = 110;
    this.tween({ targets: this.pig, x: this.pigHomeX, duration: 1500, ease: 'Quad.easeIn', onComplete: () => {
      this.pigVx = 0; this.pig.setFacing(-1); this.pig.setMood('neutral');
      this.scheduleBeat(500, () => { this.monkey.setMood('neutral'); this.monkey.setFacing(-1); this.scheduleBeat(1600, () => this.sneak()); });
    } });
  }

  private showMark(mark: Phaser.GameObjects.Text, x: number, y: number, ms: number): void {
    mark.setPosition(x, y).setVisible(true).setScale(0.4).setAlpha(1);
    this.tween({ targets: mark, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.easeOut' });
    this.tween({ targets: mark, alpha: 0, delay: ms, duration: 200, onComplete: () => mark.setVisible(false) });
  }

  // ---------- menus ----------
  private showMenu(): void {
    this.menu.show({
      play: () => this.startCampaign(),
      levelSelect: () => { this.menu.hide(); this.pickCharacter((c) => this.levels.show(c, (id) => this.startLevel(id, c, 'replay'), () => this.showMenu())); },
      settings: () => { this.menu.hide(); this.settingsMenu.show(() => this.showMenu(), () => { /* progress reset */ }); },
      credits: () => { this.menu.hide(); showCredits(this.dialog, () => this.showMenu()); },
    });
  }

  private pickCharacter(then: (c: 'monkey' | 'pig') => void): void {
    if (!SaveManager.instance.data.progress.pigUnlocked) { then('monkey'); return; }
    showCharacterPicker(this.dialog, import.meta.env.BASE_URL.replace(/\/?$/, '/'), then, () => this.showMenu());
  }

  private startCampaign(): void {
    this.menu.hide();
    const save = SaveManager.instance;
    const next = CAMPAIGN.find((id) => !save.data.progress.completed[id]) ?? CAMPAIGN[0];
    const go = (c: 'monkey' | 'pig'): void => {
      if (!save.data.progress.firstRunDone) showFirstRun(this.dialog, () => { save.markFirstRunDone(); this.startLevel(next, c, 'campaign'); });
      else this.startLevel(next, c, 'campaign');
    };
    this.pickCharacter(go);
  }

  private startLevel(levelId: string, character: 'monkey' | 'pig', mode: 'campaign' | 'replay'): void {
    this.menu.hide(); this.levels.hide(); this.settingsMenu.hide(); this.dialog.hide();
    AudioEngine.instance.play('ui', 1, 0);
    this.cameras.main.fadeOut(260, 20, 35, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game', { levelId, character, mode }));
  }

  override update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const t = this.time.now / 1000;
    this.monkey.animate(dt, 0, 0, true, this.groundY);
    this.pig.animate(dt, this.pigVx, 0, this.pigGrounded, this.groundY);
    this.banana.setY(this.groundY - 96 + (this.reduced ? 0 : Math.sin(t * 2) * 4)).setRotation(this.reduced ? 0 : Math.sin(t * 1.4) * 0.1);
    this.glow.setAlpha(0.55 + (this.reduced ? 0 : Math.sin(t * 3) * 0.1)).setScale(2.5 + (this.reduced ? 0 : Math.sin(t * 3) * 0.12));
    this.backdrop.update(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.reduced ? 0 : t * 10, 0, dt);
  }

  private cleanup(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.beat?.remove(false);
    for (const t of this.tweensActive) t.stop();
    this.menu.hide(); this.levels.hide(); this.settingsMenu.hide(); this.dialog.hide();
    this.backdrop.destroy();
    this.sparkles?.destroy();
    this.monkey.destroy(); this.pig.destroy();
    InputManager.instance.gameplayEnabled = true;
  }
}
