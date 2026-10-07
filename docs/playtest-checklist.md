# Human playtest checklist (release readiness)

Automated checks cover physics, saves, level data and layout geometry. These items need a person:

## Sound (desktop, headphones)
- [ ] First click/tap on the title starts music; nothing plays before that gesture.
- [ ] Jump, land, banana, checkpoint and death effects are audible and not harsh; repeated jumps do not stack into a buzz.
- [ ] Music changes between levels and when the boss fight starts; mute (M) silences everything and the toast confirms it.
- [ ] Music/effects sliders in Settings change volume live.

## Phone (real device, both orientations)
- [ ] Landscape: the playfield is centred, the HUD sits inside the playfield's top corners, nothing is hidden under a notch or the home indicator.
- [ ] Portrait: the "Rotate for the best experience" card appears once; Continue keeps playing; rotating to landscape dismisses it on its own.
- [ ] Touch pads: holding a direction and tapping JUMP with another thumb jumps while moving; sliding the thumb between ◀ and ▶ switches direction without lifting.
- [ ] Buttons never block a hazard you need to see; the page does not scroll or zoom while playing.
- [ ] Rotating mid-level does not leave the HUD or pads in the wrong place after a second.
- [ ] Pause (❚❚) works; Settings opens and closes; the game resumes where it was.

## First few traps (Level 1, fresh save)
- [ ] The intro sign and the pig's "Relax. I tested this." read clearly before the first jump.
- [ ] The ledge banana shivers, hops twice, then slumps; the pig comments; it can then be collected.
- [ ] Checkpoint 1 flashes "Checkpoint" with confetti; dying afterwards respawns there with bananas collected since the checkpoint restored.
- [ ] Bridge: the planks shake for about a third of a second before dropping one by one; running straight across survives; stopping drops you into the water with a bridge caption, and the pig says "Okay, that one was half oak."
- [ ] Coconut: the "!" and wobble give about half a second of warning; the thud and debris land; the pig comments.
- [ ] The finish flag fidgets as you approach, runs once to the dead end, and can be cornered.
- [ ] No death shows the same caption twice in a row.

## Everything else
- [ ] Completing Level 5 shows the plastic-trophy reveal, the real banana by the lunch, the results card and the credits; the pig is selectable afterwards.
- [ ] "Download results card" saves a PNG that looks right.
- [ ] Reduced motion (Settings) calms the title loop and particles; Low quality keeps the game smooth on an older laptop.
