import type Phaser from 'phaser';
import { COMPLAINTS, COMPLAINT_PRINTOUT } from '../../content/script';
import { TILE } from '../../core/constants';
import type { EncounterDef } from '../../levels/types';
import type { Banana } from '../objects/Banana';
import type { PigNPC } from '../objects/PigNPC';
import { installMoustacheBonk, releaseBanana, resolvePig } from './basic';
import { Encounter, type EncounterHost } from './Encounter';
import { drawPaper, drawStamp } from './props';

/**
 * Prank Complaint Department. Dukkar in a fake moustache behind the help desk. File a complaint, watch the printer
 * assign it to Dukkar, stamp REFUND, and a bonus banana drops on his head from the roof. Nothing here is required.
 */
export class DeskEncounter extends Encounter {
  protected declare pig: PigNPC;
  private banana!: Banana;
  private paper: Phaser.GameObjects.Container | null = null;
  private stamp!: Phaser.GameObjects.Text;
  private groundY = 0;
  constructor(host: EncounterHost, private def: EncounterDef) { super(host, def.id); }

  build(): void {
    this.groundY = (this.def.y + 1) * TILE;
    this.pig = resolvePig(this.host, this.def, 'shack');
    this.pig.setMoustache(true);
    installMoustacheBonk(this.host, this.pig);
    this.pig.calloutHandler = () => {
      if (this.state === 'active') return false;
      this.pig.rig.setMood('alert', 1200);
      this.host.say(this.pig, 'callout-clipboard', { priority: true });
      return true;
    };
    this.banana = this.host.addBanana(this.pig.footX, this.groundY - 60, `${this.id}-banana`);
    this.stamp = drawStamp(this.host.scene, this.pig.footX + 62, this.groundY - 118, 'REFUND.');
    this.addAction({ id: `${this.id}-complain`, label: 'Complain', priority: 2, available: () => this.state === 'idle' && this.near(this.pig.footX, 140, this.groundY), run: () => this.complain() });
  }

  private complain(): void {
    if (this.state !== 'idle') return;
    this.setState('active');
    this.pig.lookAt(this.host.player.x);
    this.host.say(this.pig, 'desk-greet', { priority: true });
    this.after(1300, () => {
      this.ask(null, COMPLAINTS.map((text, i) => ({ id: `c${i}`, label: text })), (pick) => {
        if (!pick) { this.setState('idle'); return; }
        const text = COMPLAINTS[parseInt(pick.slice(1), 10)] ?? COMPLAINTS[0];
        this.host.makad(text);
        this.after(1100, () => this.print());
      });
    });
  }

  private print(): void {
    this.host.sfx('receipt', 1, 0);
    const px = this.pig.footX + 62, py = this.groundY - 64;
    this.paper?.destroy();
    this.paper = drawPaper(this.host.scene, px, py, COMPLAINT_PRINTOUT);
    if (!this.host.reducedMotion) { this.paper.setScale(1, 0.05); this.tween({ targets: this.paper, scaleY: 1, duration: 700, ease: 'Linear' }); }
    this.after(800, () => this.host.say(this.pig, 'desk-received', { priority: true }));
    this.after(2500, () => {
      // STAMP
      this.stamp.setVisible(true).setScale(this.host.reducedMotion ? 1 : 3).setAlpha(1);
      this.host.sfx('stamp', 1, 0);
      this.host.shake(0.003, 120);
      if (!this.host.reducedMotion) this.tween({ targets: this.stamp, scaleX: 1, scaleY: 1, duration: 140, ease: 'Quad.easeIn' });
      this.after(700, () => this.bananaOnHead());
    });
  }

  private bananaOnHead(): void {
    const headX = this.pig.rig.x, headY = this.pig.rig.y - 92;
    this.banana.setLocked(false);
    this.banana.moveTo(headX, this.groundY - 240);
    this.banana.body.enable = false; // not collectable until it lands
    const land = (): void => {
      this.host.sfx('bonk', 1, 0); this.host.sfx('squeak', 1, 0);
      this.host.debris(headX, headY, 6);
      this.pig.recoil(headX + 1);
      this.pig.rig.setMood('embarrassed', 2600);
      this.host.say(this.pig, 'desk-refund', { priority: true });
      releaseBanana(this.host, this.banana, { x: headX, y: headY }, { x: this.pig.footX - 58, y: this.groundY - 26 }, () => {
        this.host.achievement('complaint');
        this.setState('complete');
      });
      this.setState('payoff');
    };
    if (this.host.reducedMotion) { land(); return; }
    this.tween({ targets: this.banana, y: headY, duration: 380, ease: 'Quad.easeIn', onComplete: land });
  }

  protected applyState(state: 'idle' | 'complete'): void {
    this.pig.resetToHome();
    this.paper?.destroy(); this.paper = null;
    this.host.scene.tweens.killTweensOf(this.banana);
    if (state === 'idle') { this.stamp.setVisible(false); this.banana.setLocked(true); this.banana.moveTo(this.pig.footX, this.groundY - 60); }
    else { this.stamp.setVisible(true).setScale(1); this.banana.setLocked(false); this.banana.moveTo(this.pig.footX - 58, this.groundY - 26); }
  }
  protected override onDestroy(): void { this.paper?.destroy(); this.stamp.destroy(); }
}
