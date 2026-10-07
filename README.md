# Banana Betrayal

*Two friends. One banana. Absolutely no trust.*

A comedy 2D platformer for the browser. A monkey wants the legendary golden banana; a pig claims to know the way.
Every helpful suggestion makes the journey worse. Built with Phaser 4, TypeScript and Vite; ships as a static site.

![Title screen](docs/screenshots/after/title.jpg)

| | |
|---|---|
| ![Level 1: Trust Issues](docs/screenshots/after/level1-start.jpg) | ![Level 1: the totally safe bridge](docs/screenshots/after/level1-bridge.jpg) |
| ![Level 2: Customer Support Swamp](docs/screenshots/after/level2.jpg) | ![Level 3: The Banana Economy](docs/screenshots/after/level3.jpg) |
| ![Level 4: Cloud Storage](docs/screenshots/after/level4.jpg) | ![Level 5: The Oinkcident](docs/screenshots/after/level5.jpg) |
| ![Level 5: the pig's banana forklift](docs/screenshots/level5-boss.jpg) | ![Results card](docs/screenshots/results.jpg) |

Before/after captures of the art pass live in `docs/screenshots/before/` and `docs/screenshots/after/`.

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

## Release checklist

A human playtest checklist (sound, phone controls, the first traps) is in [`docs/playtest-checklist.md`](docs/playtest-checklist.md).
A viewport harness for exact-size layout checks lives at `/dev/frame.html?size=390x844&src=/%3Flevel%3Dlevel1` in dev builds.

## Known limitations

- Characters are single illustrations animated procedurally (squash, bob, tilt, shadow); there is no drawn walk cycle.
- The ghost is a sampled visual replay of positions, not a deterministic physics re-simulation.
- Audio is procedural WebAudio; it starts after the first click/tap as browsers require.

## Testing

- `npm test` runs 36 Vitest unit tests: level parser and validator (every shipped level), save schema sanitising and
  v0→v1 migration, record comparison, completion/unlock rules, trap state machine timing and snapshots, the
  snapshot registry, level hashing for ghost compatibility, and content integrity (≥30 captions, every dialogue
  key referenced by a level exists).
- Browser playtests were driven through the dev-only hooks (`window.__bbTest`) in Chrome: movement tuning
  (jump heights, buffering, coyote), moving-platform riding, one-way planks, every trap type, checkpoint
  restore (including banana rollback), death captions by cause, the full boss fight and ending, pause/settings/
  quit, level select and replay mode, the results overlay and card download, the first-run card, the production
  build served from a `/banana-betrayal/` sub-directory, and portrait/landscape layouts with touch controls.
- Performance on the development machine (Apple Silicon MacBook, 120 Hz display): ~7 ms average frame time in
  the factory level at the 120 fps cap; simulated CPU cost 2.7–4.9 ms per frame in the heaviest levels.

## Deployment

The repository is ready for GitHub Pages: `vite.config.ts` uses a relative base so the build works from a
repository sub-directory, and `.github/workflows/deploy.yml` builds, tests and publishes `dist/` on every push to
`main`. Remaining steps for the owner:

```bash
gh repo create banana-betrayal --public --source=. --remote=origin --push
# then in the repository settings → Pages → Source: "GitHub Actions"
```

After the first workflow run the game is served at `https://<user>.github.io/banana-betrayal/`.

## Asset checklist (optional, improves animation)

Ready-to-use Higgsfield prompts with pose, angle, framing, background and consistency requirements are in
[`docs/asset-request.md`](docs/asset-request.md).

The game is complete with the two supplied portraits. Extra poses would materially improve the feel; each should
be the same character on a transparent background at roughly the same scale:

- Monkey: jump (arms up), fall/flail, hurt (eyes shut, limbs splayed), victory (trophy raised).
- Pig: driving pose (seated, hooves on a wheel), laughing, stunned (stars), defeated/sulking.

Drop them into `public/assets/characters/` and wire the keys in `src/content/characters.ts`.
