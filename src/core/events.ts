import { Emitter } from './Emitter';

/** Game-wide event bus (menus ↔ scenes ↔ systems). Listeners must remove themselves on shutdown. */
export const bus = new Emitter();

export const Events = {
  RenderScaleChanged: 'render-scale-changed',
  SettingsChanged: 'settings-changed',
  PlayerDied: 'player-died',
  PlayerRespawned: 'player-respawned',
  CheckpointReached: 'checkpoint-reached',
  BananaCollected: 'banana-collected',
  LevelStarted: 'level-started',
  LevelCompleted: 'level-completed',
  PauseRequested: 'pause-requested',
  ResumeRequested: 'resume-requested',
  RestartRequested: 'restart-requested',
  QuitToTitle: 'quit-to-title',
  MuteToggled: 'mute-toggled',
  Caption: 'caption',
  Dialogue: 'dialogue',
  HudUpdate: 'hud-update',
  AudioUnlocked: 'audio-unlocked',
  LayoutChanged: 'layout-changed',
  RotatePromptShown: 'rotate-prompt-shown',
  RotatePromptHidden: 'rotate-prompt-hidden',
} as const;
