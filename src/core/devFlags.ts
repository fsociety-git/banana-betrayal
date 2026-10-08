/**
 * Developer switches read once from the URL. They only exist in dev builds (`vite dev`); the published game ignores
 * them, so there are no level skips, overlays or test switches reachable on the public site.
 */
const params = new URLSearchParams(typeof location !== 'undefined' && import.meta.env.DEV ? location.search : '');

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
