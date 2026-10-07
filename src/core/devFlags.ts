/** Developer switches read once from the URL. Never affect a normal player. */
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export const devFlags = {
  /** `?dev=1` enables the dev overlay hotkeys and level-skip controls. Always on in Vite dev mode. */
  enabled: params.get('dev') === '1' || import.meta.env.DEV,
  /** `?nopause=1` disables pause-on-blur (used by automated browser tests). */
  noAutoPause: params.get('nopause') === '1',
  /** `?level=<id>` boots straight into a level. */
  startLevel: params.get('level'),
  /** `?character=pig` plays as the pig. */
  character: params.get('character') === 'pig' ? ('pig' as const) : null,
};
