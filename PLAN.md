# Implementation plan

Milestones (each leaves the project runnable):

- **A. Foundation + movement test room** — Vite/TS/Phaser scaffold, render-scale camera, input manager (keyboard/touch/gamepad), player controller (accel, air control, variable jump, coyote 100ms, buffer 120ms, states), moving-platform carry, camera lookahead, DOM UI shell, dev overlay, test room level.
- **B. Vertical slice of Level 1** — theme renderer (parallax, foliage, water, particles), terrain styling, bananas, checkpoints (snapshot reset), death/respawn + captions, flag, pig NPC with speech bubbles, three traps (fleeing banana, collapsing bridge, coconut), procedural audio (SFX + music), title screen, HUD, pause.
- **C. Trap architecture + five levels** — trap registry/state machine, sinking platforms, bubbles, croc platforms, conveyors, crushers, cargo, switches, wind, crumbling clouds, falling objects, doubting cloud, free-banana machine, signs; levels 1–5 authored and validated.
- **D. Boss, ending, unlocks, saves, replay** — three-phase forklift boss, ending + credits, pig unlock, versioned save with migration, level select, replay mode with timer, personal bests, ghost recording/playback, results card export.
- **E. Polish** — comedy timing, particles/FX budget by quality setting, touch controls with safe areas, accessibility (reduced motion, shake toggle, assist mode, focus states), performance pass, resize/orientation handling.
- **F. Testing, deployment, docs** — unit tests (save, checkpoints, traps, validation, unlocks, replay compat), browser playtest of all levels, screenshots, README, GitHub Pages workflow, production preview check.

Key decisions
- Terrain: ASCII grid (40px tiles) merged into static rectangles; visuals drawn per exposed edge into chunked Graphics.
- Characters: single photo-cutout split into head + body layers (head never stretches); whole-body squash/stretch, tilt, bob, shadow.
- UI: semantic HTML overlays over the canvas (menus, settings, HUD, captions, touch controls). Phaser renders the world only.
- Audio: WebAudio synth engine (SFX + sequenced music) — no external audio files.
