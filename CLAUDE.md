# Banana Betrayal — project guide for Claude

Comedy 2D platformer. "Two friends. One banana. Absolutely no trust."
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
- `src/core/` input, save, audio, settings, render helpers; `src/ui/` DOM overlays (menus, HUD, touch controls)
- `src/levels/` level data + parser + validator; `src/content/` editable text; `src/dev/` dev overlay
- `public/assets/characters/` game-ready cutouts (generated from `concept/`); `art/cutouts/` full-res cutouts
- `tests/` vitest unit tests; `PROGRESS.md` milestone log; `PLAN.md` implementation plan

## Phaser 4 notes (differs from v3)
- `roundPixels` defaults to false. `setTintFill` removed → `setTint(c).setTintMode(Phaser.TintModes.FILL)`.
- DynamicTexture draw commands need `render()`. postFX/preFX → `gameObject.filters.internal.add*()`, `camera.filters.internal/external`.
- `Math.TAU` is 2π. `Geom.Point` → `Vector2`. BitmapMask → Mask filter.
- Bundled docs: `node_modules/phaser/skills/` (grep them before guessing an API).
