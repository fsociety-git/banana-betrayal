# Progress log

## 2026-10-08 — Milestone A started
- Chose Phaser 4.2.1 (npm latest, stable), TypeScript 7.0.2, Vite 8.3.3, Vitest 5.0.3.
- Cut both Higgsfield characters out of their backgrounds (flood-fill matte, defringed), exported game-size whole/head/body layers to public/assets/characters. Originals preserved in concept/, full-res cutouts in art/cutouts/.

## Milestone A — done
- Vite 8 + TS 7 + Phaser 4 scaffold; logical 960x540 with DPR-aware camera zoom.
- Player controller: accel/decel, air control, variable jump (105px full / 44px tap measured), coyote 100ms, buffer 120ms (verified in browser), fall-gravity multiplier, state machine, single-death guard.
- Moving platforms: positional movement, sticky riding (0 grounded flickers over 4.4s vertical ride), one-way planks from below/above.
- Terrain: ASCII grid → merged static rects; per-edge cartoon visuals baked in 1000px chunks (fixed a chunk-alignment bug where chunks after the first were blank).
- Parallax backdrop (sky gradient, far/mid/near layers, haze, ambient particles) following the camera in world space.
- DOM UI shell: HUD, captions, pause menu with focus trap, touch controls, dev overlay (` / F3), URL dev flags (?level, ?nopause, ?character, ?dev).
- Unit tests: parser, validator, save schema/migration, trap state machine, snapshot registry (29 passing).
