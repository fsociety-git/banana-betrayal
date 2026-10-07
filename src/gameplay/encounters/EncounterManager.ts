import type { EncounterDef, LevelObjectDef } from '../../levels/types';
import type { PigNPC } from '../objects/PigNPC';
import { BackfireEncounter } from './backfire';
import { ButtonEncounter, CallbackEncounter, CrateEncounter, EscalationsEncounter, HolderEncounter, ShowMeEncounter, StuckEncounter, UmbrellaEncounter } from './basic';
import { ChaseEncounter } from './chase';
import { DeskEncounter } from './desk';
import type { Encounter, EncounterHost } from './Encounter';
import { ShortcutEncounter } from './shortcut';

function create(host: EncounterHost, def: EncounterDef): Encounter | null {
  switch (def.kind) {
    case 'holder': return new HolderEncounter(host, def);
    case 'showme': return new ShowMeEncounter(host, def);
    case 'button': return new ButtonEncounter(host, def);
    case 'chase': return new ChaseEncounter(host, def);
    case 'shortcut': return new ShortcutEncounter(host, def);
    case 'callback': return new CallbackEncounter(host, def);
    case 'desk': return new DeskEncounter(host, def);
    case 'escalations': return new EscalationsEncounter(host, def);
    case 'crate': case 'apology': return new CrateEncounter(host, def);
    case 'stuck': return new StuckEncounter(host, def);
    case 'umbrella': return new UmbrellaEncounter(host, def);
    case 'backfire': return new BackfireEncounter(host, def);
    default: return null;
  }
}

/** Owns every encounter in a level: build, per-frame update, death/respawn fan-out, snapshots, teardown. */
export class EncounterManager {
  readonly encounters: Encounter[] = [];
  constructor(private host: EncounterHost) {}

  build(objects: LevelObjectDef[]): void {
    for (const o of objects) {
      if (o.type !== 'encounter') continue;
      const e = create(this.host, o);
      if (!e) { console.warn(`[encounter] unknown kind '${o.kind}'`); continue; }
      e.build();
      e.applyStateFromManager();
      this.encounters.push(e);
      this.host.world.snapshotsRegister(`enc-${e.id}`, e);
    }
  }

  update(dt: number, now: number): void { for (const e of this.encounters) if (e.state !== 'complete') e.update(dt, now); }
  /** A gag is mid-flight somewhere: generic banter should wait. */
  anyRunning(): boolean { return this.encounters.some((e) => e.running); }
  /** This pig is busy in a running gag (unless that gag handles callouts itself). */
  pigBusy(pig: PigNPC): boolean { return this.encounters.some((e) => e.running && e.involves(pig)); }
  onPlayerDied(): void { for (const e of this.encounters) e.onPlayerDied(); }
  onPlayerRespawned(): void { for (const e of this.encounters) { e.seenOnce = e.seenOnce || e.state !== 'idle'; e.onPlayerRespawned(); } }
  /** Death before any checkpoint: everything back to the untouched setup. */
  resetAll(): void { for (const e of this.encounters) { e.seenOnce = e.seenOnce || e.state !== 'idle'; e.reset(); } }
  destroy(): void { for (const e of this.encounters) e.destroy(); this.encounters.length = 0; }
}
