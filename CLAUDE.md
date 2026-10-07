# Banana Betrayal — project guide for Claude

Comedy 2D platformer. "Makad & Dukkar: He Started It." Two cartoon rivals (Makad the monkey, Dukkar the pig) in an escalating banana dispute. Public brief: no relationship framing, no references to anyone outside the game.
Stack: Phaser 4.2.1, TypeScript 7 (strict), Vite 8, Vitest 5. Static deploy (GitHub Pages, relative base).

## Commands
- `npm run dev` — dev server (http://localhost:5173)
- `npm run typecheck` — tsc strict, no emit
- `npm run test` — vitest unit tests (tests/**/*.test.ts, node env)
- `npm run build` — typecheck + production build to dist/
- `npm run preview` — serve dist/ for production verification

## Non-negotiable design rules
- "Reliable controls. Unreliable world." Never add input lag, never reverse controls, never change physics as a joke.
- Collision geometry is separate from visuals. Player body is a fixed rectangle; the oversized head is visual only.
- Logical resolution is 960x540. Render scale (DPR) is handled by camera zoom in `src/core/render/RenderScale.ts`; never bake DPR into world coordinates.
- All jokes, names, captions and dialogue live in `src/content/` and must stay editable.
- Levels are data (`src/levels/*.ts`): ASCII terrain + object list, validated by `src/levels/validate.ts`.
- Traps are a state machine (idle → warning → active → cooldown → reset) in `src/gameplay/traps/`. Deterministic, resettable from a checkpoint snapshot.
- Every scene/system cleans up its own events, timers, tweens, particles and DOM on shutdown.
- No backend, no API keys, no runtime AI calls. Audio is procedural (WebAudio) and starts only after a user gesture.

## Layout
- `src/main.ts` boot; `src/scenes/` Phaser scenes; `src/gameplay/` player, world, traps, objects, camera, fx, dialogue, boss, ghost
- `src/core/` input, save, audio, settings, render helpers; `src/ui/` DOM overlays (menus, HUD, touch controls, reply chooser, achievement toast)
- `src/gameplay/interact/` bonk timing/hit box and the contextual-action registry; `src/gameplay/encounters/` optional Dukkar gags (explicit idle → anticipation → active → payoff → complete, snapshot-safe); `src/gameplay/dialogue/` speech bubbles, `DialoguePolicy` (pure scheduling rules) and `ReactionDirector` (event-aware lines)
- Encounter and dialogue rules: all player-facing text lives in `src/content/script.ts`; sequence NPC animation with callbacks/timers (never promises: the deterministic test harness steps synchronously); never gate progress or delay input on an NPC animation; bonus bananas start locked and release exactly once
- `src/levels/` level data + parser + validator; `src/content/` editable text; `src/dev/` dev overlay
- `public/assets/characters/` game-ready cutouts (generated from `concept/`); `art/cutouts/` full-res cutouts
- `tests/` vitest unit tests; `PROGRESS.md` milestone log; `PLAN.md` implementation plan

## Browser testing
- Dev builds expose `window.__bbTest` (src/dev/TestHooks.ts): `down/up(code)` synthetic keys, `place(x,y)`, `pos()`, and `sim(ms)` which sleeps the RAF loop and steps the game deterministically (immune to hidden tabs / timer throttling). Use `?level=<id>&nopause=1` to boot straight into a level without pause-on-blur.
- A hidden/occluded tab stops requestAnimationFrame: screenshots still work but nothing moves. Prefer `sim()` over real waits.

## Phaser 4 notes (differs from v3)
- `roundPixels` defaults to false. `setTintFill` removed → `setTint(c).setTintMode(Phaser.TintModes.FILL)`.
- DynamicTexture draw commands need `render()`. postFX/preFX → `gameObject.filters.internal.add*()`, `camera.filters.internal/external`.
- `Math.TAU` is 2π. `Geom.Point` → `Vector2`. BitmapMask → Mask filter.
- Bundled docs: `node_modules/phaser/skills/` (grep them before guessing an API).
