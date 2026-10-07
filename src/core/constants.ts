/** Logical game resolution. World coordinates never depend on the device pixel ratio. */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
/** Terrain grid size in logical pixels. */
export const TILE = 40;

export const GAME_VERSION = '0.1.0';
/** Bump when level layouts change in a way that invalidates ghosts / personal bests. */
export const LEVEL_FORMAT_VERSION = 1;

/** Movement tuning. Start values from the brief; tuned against level geometry. */
export const PLAYER_TUNING = {
  bodyWidth: 36,
  bodyHeight: 82,
  runSpeed: 280,
  groundAccel: 2400,
  groundDecel: 2800,
  airAccel: 1700,
  airDecel: 900,
  gravity: 1800,
  fallGravityMultiplier: 1.25,
  jumpVelocity: -680,
  jumpCutMultiplier: 0.45,
  maxFallSpeed: 900,
  coyoteMs: 100,
  jumpBufferMs: 120,
  respawnDelayMs: 650,
  deathFreezeMs: 90,
} as const;

export const DEPTH = {
  skyFar: -100,
  parallax: -90,
  decorBack: -40,
  terrain: 0,
  objects: 10,
  npc: 15,
  playerShadow: 18,
  player: 20,
  particles: 30,
  foreground: 40,
  bubbles: 50,
  debug: 100,
} as const;
