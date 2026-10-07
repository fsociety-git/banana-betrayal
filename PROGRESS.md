# Progress log

## 2026-10-08 — Milestone A started
- Chose Phaser 4.2.1 (npm latest, stable), TypeScript 7.0.2, Vite 8.3.3, Vitest 5.0.3.
- Cut both generated character portraits out of their backgrounds (flood-fill matte, defringed), exported game-size whole/head/body layers to public/assets/characters. Originals preserved in concept/, full-res cutouts in art/cutouts/.

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

## Milestone E/F — polish, testing, deployment prep
- Direct squash detection for crushers and the forklift (Arcade's overlap bias rejects fast immovable bodies).
- Reduced motion gates particles and rig animation; render scale re-applies when quality changes; assist checkpoints; touch controls verified in portrait and landscape.
- Production build (195 kB app + 1.37 MB Phaser, 417 kB gzip total) verified from a sub-directory; GitHub Pages workflow added; README with screenshots, controls, architecture, editing guide, limitations.
- 36 unit tests passing. Browser playtests of every mechanic, the boss and the ending via deterministic stepping.
- Deployment itself not performed: no repository was authorised; exact remaining step documented in README.

## Art-direction, animation and comedy polish pass
- Bananas: one shared crescent silhouette (`src/gameplay/fx/bananaShape.ts`) for pickups, checkpoint tops, the title pedestal, the boss trophy, the ending and the results card; a golden variant with highlight and restrained sparkle.
- Backdrop: sun glow, drifting cloud layer, far landmark per theme (kapok tree + temple, dead swamp trees + stilt shack, smokestacks + banana billboard, cloud shelves + rainbow, gold skyline + pig statue), richer mid/near vegetation and a hanging canopy/duct/bunting layer framing the top. Low quality keeps two layers; reduced motion drops ambient motes.
- Terrain: topsoil band, deep soil, stones, rounded convex corners, grass blades above the edge, hanging roots under floating ground; metal plates with rivets and hazard stripes (factory), gilded trim (HQ), puffy cloud tops (sky); planks with grain, brackets and nails; signs with two posts, grain, nails and a tuft of grass.
- Characters: 3 px cartoon outline around the photo heads (matches body line weight), separate tail layers (monkey, pig) that sway, wag and flick; jump anticipation (crouch → stretch → settle); landing compression scaled by impact; moods (smug, embarrassed, alert) used by the pig when speaking/laughing, by the monkey after a respawn and when a trap arms nearby.
- Title: staged loop (two-step sneak, monkey turns with "!", pig whistles "♪" and backs off, ~10 s period); static tableau under reduced motion; larger characters, stone pedestal, spotlight beam.
- Comedy staging: fleeing banana shivers before it bolts and slumps when it gives up (pig: "Fine. It is tired. Take it."); pig comments when you survive the bridge and when the coconut lands; the finish flag fidgets and hops when you get close; the nearest pig chuckles at every death and sometimes teases; captions already rotate per cause.
- Effects: landing rings on hard landings, banana fly-up + ring on pickups, confetti + ring on checkpoints, flash + confetti on boss hits, fade-in on level start.
- Test hook: `sim()` now also drives Phaser 4's wall-clock tween manager so tween-based animation is testable deterministically.
- Measured (same machine, sim CPU per frame): L1 2.5 ms, L3 2.7 → 4.1 ms, L5 3.6 ms. Real-time frame time is vsync-bound (16.7 ms at 60 Hz, 6.9 ms earlier at 120 Hz).

## Release-readiness pass
- Grass: decorative tufts are now soft rounded blobs in two greens with no dark outline; factory platform tops lost their sawtooth and use a flat painted band with rivets. Spikes/saws/electric keep sharp, high-contrast silhouettes. Applied to terrain, the title ground, sign bases and rock props.
- Layout: `#game` no longer flex-centres the canvas (Phaser's CENTER_BOTH margins were being applied on top of CSS centring → off-centre in landscape). New `LayoutManager` refreshes the Scale Manager on resize/orientation/visualViewport/ResizeObserver signals (immediate pass + settle passes at 320 ms and 900 ms, re-reading parent bounds first), measures the canvas and publishes the rectangle as CSS variables. HUD, captions, intro cards and the dev overlay mount in a `.bb-stage` element aligned to the canvas; touch pads stay in safe-area corners (or in wide letterbox margins) and under the strip in portrait.
- Portrait: a dismissable "Rotate for the best experience" card (once per session) pauses gameplay while shown; Continue keeps playing in portrait with the full 16:9 view (no world stretching or cropping); landscape auto-dismisses it.
- Verified with an iframe viewport harness (`public/dev/frame.html`) at 390×844, 844×390 and 1280×720: initial loads and resize-event transitions produce identical geometry (portrait strip 390×219 at y=312 with HUD above and pads below; landscape canvas 693×390 centred at x=75 with HUD inside; desktop full-frame). Simultaneous move + jump via two synthetic touch pointers moved 163 px while jumping 126 px; releases clear both. Jump input sets vertical velocity on the very first frame; anticipation is visual only.
- Not verified on a physical phone; synthetic pointer events are not real touches.

## Comedy and character-interaction update
- Names and framing: Makad (monkey) and Dukkar (pig) everywhere (content, UI, HUD labels, metadata, docs); credits list roles and asset origins only; a content test bans relationship wording.
- Bonk: `Player.tryBonk()` (120 ms window, 450 ms cooldown, 14–74 px in front, no effect on movement or jumping); `Bonkable` targets resolved by AABB in `GameScene.doBonk`; pigs recoil with rotating lines, encounter handlers can intercept (drop a banana, lose a moustache), the forklift clangs until it is beaten.
- Contextual actions: `InteractionManager` picks one available action (DUKKAR!, Talk, Show me, Press, Complain, Open, Pull, Flip sign, Remove); prompt chip above Makad; touch `!` button lights up; `ReplyChooser` pauses gameplay input while open (1/2/3, arrows, tap, Esc).
- Dialogue scheduling: `DialoguePolicy` (gap, repeat window, once, airborne suppression, taunt budget, priority interrupts with a 400 ms guard, cancel on death). `ReactionDirector`: waiting, walking back, avoided trap, caught laughing, hints + marker after three deaths in a section, SKILL ISSUE sign removal on a first-try clear, applause that stops, hard-banana respect, flinch at impacts.
- Encounters (`src/gameplay/encounters`): explicit idle → anticipation → active → payoff → complete; baselines never capture a gag mid-flight (unfinished → idle); death before a checkpoint resets everything; completed outcomes survive restores; locked bonus bananas count toward the level total and release exactly once.
- Opening cinematic (new campaign only, skippable, `introSeen`), title-screen freeze-and-inspect beat with escalating attempts, boss phase staging, post-fight banner flip + footnote, handover ending with three choices and the four-second truce tableau, achievements (save v2, toast once), one context-aware results line.
- Verified in the browser with deterministic stepping: every encounter on all five levels, both red-button paths, both coconut paths, the chase (bonk and ignored), replies, death resets, the full boss/ending flow. 54 unit tests.
