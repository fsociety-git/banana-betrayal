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
 * Title screen: both characters, the golden banana between them, and the pig quietly trying to steal it.
 * Menus are DOM; this scene only animates the diorama.
 */
export class TitleScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private monkey!: CharacterRig;
  private pig!: CharacterRig;
  private banana!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private menu = new MainMenu();
  private settingsMenu = new SettingsMenu();
  private levels = new LevelSelectMenu();
  private dialog = new SimpleDialog();
  private pigHomeX = 0;
  private pigTarget = 0;
  private sneakTween: Phaser.Tweens.Tween | null = null;
  private cleanups: (() => void)[] = [];

  constructor() { super('Title'); }

  create(): void {
    const palette = THEMES.jungle;
    fitCamera(this.cameras.main);
    this.cameras.main.setBackgroundColor(palette.skyBottom);
    this.backdrop = new Backdrop(this, palette, SettingsService.instance.settings.quality, 3);
    this.backdrop.update(GAME_WIDTH / 2, GAME_HEIGHT / 2, 0, 0, 0);
    // ground
    const groundY = GAME_HEIGHT - 60;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(palette.outline, 1); g.fillRect(-100, groundY - 3, GAME_WIDTH + 200, 200);
    g.fillStyle(palette.ground, 1); g.fillRect(-100, groundY, GAME_WIDTH + 200, 200);
    g.fillStyle(palette.grass, 1); g.fillRect(-100, groundY, GAME_WIDTH + 200, 12);
    g.fillStyle(palette.grassDark, 1); g.fillRect(-100, groundY + 12, GAME_WIDTH + 200, 4);
    for (let x = -80; x < GAME_WIDTH + 100; x += 14) { g.fillStyle(palette.grass, 1); g.fillCircle(x, groundY + 2, 5); }
    // pedestal + banana
    const px = GAME_WIDTH / 2, py = groundY;
    g.fillStyle(palette.outline, 1); g.fillRoundedRect(px - 36, py - 54, 72, 54, 6);
    g.fillStyle(palette.groundLight, 1); g.fillRoundedRect(px - 32, py - 50, 64, 46, 5);
    g.fillStyle(palette.outline, 1); g.fillRect(px - 32, py - 30, 64, 3);
    this.glow = this.add.image(px, py - 86, 'glow').setScale(2.4).setTint(0xf7c948).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    this.banana = this.add.image(px, py - 86, 'banana').setScale(2.2).setDepth(2);
    // characters
    this.monkey = new CharacterRig(this, px - 180, groundY, CHARACTERS.monkey);
    this.monkey.setFacing(1);
    this.pigHomeX = px + 300;
    this.pigTarget = px + 95;
    this.pig = new CharacterRig(this, this.pigHomeX, groundY, CHARACTERS.pig);
    this.pig.setFacing(-1);
    const reduced = SettingsService.instance.reducedMotion;
    this.monkey.reducedMotion = reduced; this.pig.reducedMotion = reduced;
    if (!reduced) this.scheduleSneak(1200);

    // dim vignette band behind the menu for text contrast
    const band = this.add.rectangle(GAME_WIDTH / 2, 150, GAME_WIDTH + 200, 300, 0x14231a, 0.18).setDepth(3);
    band.setBlendMode(Phaser.BlendModes.MULTIPLY);

    TouchControls.instance.setPlaying(false);
    AudioEngine.instance.playMusic('title');
    AudioEngine.instance.setMusicIntensity(0.5);
    this.showMenu();

    const input = InputManager.instance;
    const onMute = (): void => { const m = SettingsService.instance.toggleMute(); UIRoot.toast(m ? 'Muted' : 'Sound on', 900); };
    const onScale = (): void => fitCamera(this.cameras.main);
    input.on('mute', onMute);
    bus.on(Events.RenderScaleChanged, onScale);
    this.cleanups.push(() => { input.off('mute', onMute); bus.off(Events.RenderScaleChanged, onScale); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private scheduleSneak(delay: number): void {
    this.time.delayedCall(delay, () => {
      if (!this.scene.isActive()) return;
      // pig tiptoes toward the banana…
      this.sneakTween = this.tweens.add({
        targets: this.pig, x: this.pigTarget, duration: 2600, ease: 'Sine.easeInOut',
        onUpdate: () => { this.pig.animate(1 / 60, -90, 0, true, GAME_HEIGHT - 60); },
        onComplete: () => {
          // …monkey notices, pig freezes, then backs off
          this.monkey.impulse(0.9, 1.1, 120);
          this.pig.impulse(1.15, 0.85, 120);
          this.time.delayedCall(700, () => {
            if (!this.scene.isActive()) return;
            this.pig.setFacing(1);
            this.sneakTween = this.tweens.add({
              targets: this.pig, x: this.pigHomeX, duration: 1400, ease: 'Quad.easeIn',
              onUpdate: () => this.pig.animate(1 / 60, 220, 0, true, GAME_HEIGHT - 60),
              onComplete: () => { this.pig.setFacing(-1); this.scheduleSneak(2200); },
            });
          });
        },
      });
    });
  }

  private showMenu(): void {
    const save = SaveManager.instance;
    this.menu.show({
      play: () => this.startCampaign(),
      levelSelect: () => { this.menu.hide(); this.pickCharacter((c) => this.levels.show(c, (id) => this.startLevel(id, c, 'replay'), () => this.showMenu())); },
      settings: () => { this.menu.hide(); this.settingsMenu.show(() => this.showMenu(), () => { /* progress reset: menu re-renders on return */ }); },
      credits: () => { this.menu.hide(); showCredits(this.dialog, () => this.showMenu()); },
    });
    void save;
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
      if (!save.data.progress.firstRunDone) {
        showFirstRun(this.dialog, () => { save.markFirstRunDone(); this.startLevel(next, c, 'campaign'); });
      } else this.startLevel(next, c, 'campaign');
    };
    this.pickCharacter(go);
  }

  private startLevel(levelId: string, character: 'monkey' | 'pig', mode: 'campaign' | 'replay'): void {
    this.menu.hide(); this.levels.hide(); this.settingsMenu.hide(); this.dialog.hide();
    AudioEngine.instance.play('ui', 1, 0);
    this.cameras.main.fadeOut(260, 20, 35, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Game', { levelId, character, mode });
    });
  }

  override update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.monkey.animate(dt, 0, 0, true, GAME_HEIGHT - 60);
    if (!this.sneakTween?.isPlaying()) this.pig.animate(dt, 0, 0, true, GAME_HEIGHT - 60);
    const t = this.time.now / 1000;
    this.banana.setY(GAME_HEIGHT - 60 - 86 + Math.sin(t * 2) * 5).setRotation(Math.sin(t * 1.4) * 0.15);
    this.glow.setAlpha(0.5 + Math.sin(t * 3) * 0.12).setScale(2.3 + Math.sin(t * 3) * 0.15);
    this.backdrop.update(GAME_WIDTH / 2, GAME_HEIGHT / 2, t * 12, 0, dt);
  }

  private cleanup(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.sneakTween?.stop();
    this.menu.hide(); this.levels.hide(); this.settingsMenu.hide(); this.dialog.hide();
    this.backdrop.destroy();
    this.monkey.destroy(); this.pig.destroy();
    InputManager.instance.gameplayEnabled = true;
  }
}
