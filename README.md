# Banana Betrayal

*Two friends. One banana. Absolutely no trust.*

A comedy 2D platformer for the browser. A monkey wants the legendary golden banana; a pig claims to know the way.
Every helpful suggestion makes the journey worse. Built with Phaser 4, TypeScript and Vite; ships as a static site.

> Screenshots and the live link are added in the final section of this README once deployed.

## Play it locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build and preview (what GitHub Pages serves):

```bash
npm run build      # typecheck + bundle into dist/
npm run preview    # serve dist/ at http://localhost:4173
```

## Controls

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move | A / D or ← / → | left pad | left stick / d-pad |
| Jump (hold for height) | Space, W or ↑ | JUMP | A / B / X |
| Restart from checkpoint | R | pause menu | Y |
| Pause | Esc | ❚❚ button | Start |
| Mute | M | settings | – |
| Dev overlay | ` or F3 (dev builds) | – | – |

Touch controls appear automatically on coarse-pointer devices and can be forced on/off in Settings.

## Campaign

1. **Trust Issues** — a cheerful jungle with suspiciously confident signs.
2. **Customer Support Swamp** — sinking platforms, bubbles, mechanical crocodiles and a help desk.
3. **The Banana Economy** — conveyors, crushers, cargo, switches and a FREE BANANA machine (fees apply).
4. **Cloud Storage** — wind, crumbling clouds, falling anvils and a cloud that doubts itself.
5. **The Oinkcident** — everything at once, then the pig and his banana forklift.

Finishing the campaign unlocks the pig as a playable character. Every level can be replayed from the Levels menu
with a timer, personal bests and a ghost of your best run.

## Architecture

```
src/
  main.ts                 boot, Phaser config, render scale, global hotkeys
  scenes/                 Boot → Preload → Title → Game
  gameplay/
    player/               Player (physics + state machine) and CharacterRig (visual head/body layers)
    world/                Terrain baking, Backdrop parallax, Water, Decor, LevelWorld (object factory), SnapshotRegistry
    traps/                TrapStateMachine + every trap type (bridge, coconut, sinking, croc, crusher, clouds, machine…)
    objects/              Platforms, conveyor, bubbles, switches/gates, wind, hazards, checkpoints, flag, pig NPC
    boss/                 PigBoss (three-phase forklift fight)
    ghost/                Ghost recorder/player (visual-only best-run replay)
    dialogue/             Speech bubbles and the rate-limited DialogueManager
    camera/               CameraController (look-ahead, dead-band, bounds, shake)
  core/                   input (keyboard/touch/gamepad), save (versioned schema + migrations), settings, audio (procedural), render scale
  ui/                     DOM overlays: HUD, pause, settings, results, level select, title menu, touch controls, captions
  levels/                 Level data (builder DSL), parser, validator, hash
  content/                ALL words: names, captions, pig lines, signs, credits  ← edit jokes here
  results/                Results card renderer (PNG download)
  dev/                    Dev overlay and browser test hooks
tests/                    Vitest unit tests
public/assets/characters  game-ready character cutouts
art/cutouts               full-resolution cutouts; concept/ holds the original generated portraits
```

Key design rules live in `CLAUDE.md`. In short: reliable controls, unreliable world; collision geometry is
independent from visuals; levels are data; every trap is a deterministic state machine that checkpoints can snapshot
and restore exactly; all text is in `src/content/script.ts`.

## Editing

- **Jokes, names, captions:** `src/content/script.ts`. Captions are grouped by death cause; pig lines by key.
- **Levels:** `src/levels/level1.ts` … `level5.ts` use `LevelBuilder` for terrain plus an object list. Run
  `npm test` — `validate.test.ts` checks every level for ragged rows, missing spawns/flags, out-of-bounds objects,
  duplicate ids and dangling switch targets.
- **Characters:** replace `public/assets/characters/{monkey,pig}.png`, `-head.png` and `-body.png` (same canvas size
  for head and body), then adjust `src/content/characters.ts` (texture size, feet line, neck pivot). The split lets the
  head bob/tilt while the body squashes without stretching the face.

## Asset provenance

- Character portraits: generated with Higgsfield (GPT Image) from the players' own photos, cut out and split with a
  small Python script (see `PROGRESS.md`). Only the game-ready cutouts ship; no source photographs are included.
- Everything else — terrain, backgrounds, props, UI, music and sound effects — is generated procedurally in code.
  No third-party art or audio files are used.
- Fonts: system font stack (no external requests).

## Known limitations

- Characters are single illustrations animated procedurally (squash, bob, tilt, shadow); there is no drawn walk cycle.
- The ghost is a sampled visual replay of positions, not a deterministic physics re-simulation.
- Audio is procedural WebAudio; it starts after the first click/tap as browsers require.
