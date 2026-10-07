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

## Milestone B — in progress (Level 1 vertical slice)
- Level builder DSL + Level 1 "Trust Issues" authored (170x15 tiles, 31 bananas, 4 checkpoints).
- Traps: collapsing bridge (warning shake → sequential plank drop), fleeing banana (deterministic hop path), decorative coconut (wobble → drop → debris), fleeing flag (runs once to a dead end).
- Checkpoint snapshots restore platforms, bananas, traps; first-time jokes persist across deaths.
- Pig NPC with rate-limited speech bubbles; content file holds all text.
- Procedural audio engine (SFX recipes + 8 sequenced tracks) started on first gesture.
- Title scene with menu, settings dialog, level select, credits, first-run card, character picker.
- Phaser 4 gotcha: Containers cannot carry static bodies (StaticBody.updateFromGameObject needs getTopLeft) → static triggers use Zones/Rectangles.

## Milestone C — trap architecture and all five levels
- LevelWorld factory owns all data-driven objects: moving platforms, sinking platforms, bubbles, croc platforms, conveyors, crushers, switches/gates, wind zones, crumble + doubting clouds, falling objects (coconut/anvil/crates with ground shadows), banana machine (+ honest processing fee and dispensed peel), hazard rects (spikes/saw/electric/peel), blow-away signs, pigs with poses.
- Levels 1–5 authored with the builder; all validate. Level 5 ends in a boss arena (boss in Milestone D).
- Death attribution: environmental deaths credit the trap that caused them (bridge/cloud/sinking/wind); direct hazards keep their own captions.

## Milestone D — boss, ending, unlock, saves, replay
- Three-phase pig forklift boss (telegraphed charges that jam into the wall → stomp the hood; lobbed banana crates with landing shadows; frenzy phase). Deaths restart the encounter from the pre-arena checkpoint; the arena door closes during the fight and the camera locks to the arena.
- Ending: plastic trophy reveal, the real banana beside the pig's lunch, closing caption, results, credits, pig unlock.
- Ghost recorder (50ms samples) saved with the personal best and keyed by a level-layout hash; replay mode shows the ghost and the timer.
- Downloadable 1200x630 results card rendered locally on a canvas.
- Assist mode: slower hazard cycles and extra mid-way checkpoints; assist records kept separately.
- Deterministic browser test hook `__bbTest.sim(ms)` steps the game manually (immune to hidden-tab throttling).
