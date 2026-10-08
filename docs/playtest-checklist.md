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
- [ ] The intro sign and Dukkar's "Relax. I tested this." read clearly before the first jump.
- [ ] The ledge banana shivers, hops twice, then slumps; Dukkar comments; it can then be collected.
- [ ] Checkpoint 1 flashes "Checkpoint" with confetti; dying afterwards respawns there with bananas collected since the checkpoint restored.
- [ ] Bridge: the planks shake for about a third of a second before dropping one by one; running straight across survives; stopping drops you into the water with a bridge caption, and Dukkar says "Okay, that one was half oak."
- [ ] Coconut: the "!" and wobble give about half a second of warning; the thud and debris land; Dukkar comments.
- [ ] The finish flag fidgets as you approach, runs once to the dead end, and can be cornered.
- [ ] No death shows the same caption twice in a row.

## Dukkar (Level 1 → 2, fresh save)
- [ ] New game: the opening (banana grab, "Come get it, Makad.", the sign bump) plays once, Skip works, and controls respond the instant it ends; restarting the level does not replay it.
- [ ] Bonk (J): the swing is immediate, the BONK burst and squeak land, a second press within half a second does nothing, and bonking air gives only a whiff.
- [ ] Bonking Dukkar at the start drops the banana; the caption "Dukkar deserved that." appears only the first time ever.
- [ ] The prompt above Makad switches between DUKKAR!, Talk, Show me, Press as you move; on a phone the ! button lights up at the same moments.
- [ ] "Show me": Dukkar walks, hops into the pit, pops back up with "Controller issue."; the dotted arc is readable; the sign appears briefly after you clear the jump.
- [ ] Red button both ways: walking past makes him press it and take the glove; pressing it yourself gives confetti and GOTCHA. Dying before the checkpoint resets the whole setup.
- [ ] Reactions: standing still near him for a few seconds, walking back, dodging a trap, dying three times in one section (taunts stop, a hint and a marker appear), reaching a checkpoint (applause, then a sheepish stop).
- [ ] Level 2 help desk: Complain → pick a complaint with 1/2/3 or tap → printout → REFUND stamp → banana on his head; the moustache falls off when bonked.
- [ ] No Dukkar line appears while you are mid-jump over a hazard.

## Checkpoints and the boss (Levels 4–5)
- [ ] Level 4: after the climb, the post on the high shelf flashes and confetti plays when you touch it; dying afterwards puts you back on the shelf, not on the ground post before the climb.
- [ ] Level 4: walking back to an earlier post never moves your respawn backwards.
- [ ] Boss: jumping over a charge is survivable; touching the moving forklift is not; a crate landing on you is not.
- [ ] Boss: landing on the hood of a stunned forklift removes exactly one health point, bounces you up, and you can move away freely; it never kills you on the way up or on the bounce down.
- [ ] Boss: walking into or jumping beside a stunned forklift at either wall does nothing worse than a bump.
- [ ] Boss: dying restarts the fight from the checkpoint outside the arena with the forklift back in its corner.
- [ ] Level 3 chase: every line Dukkar says while running ahead stays readable on screen, with the bubble's tail pointing his way.
- [ ] Ending: Dukkar climbs out of the forklift (the seat is empty afterwards) and stops a clear step away from Makad, facing him, whichever wall you are near.

## Everything else
- [ ] Completing Level 5: phase lines, bolt-ons falling off, the emergency light; after the win a bonk flips DUKKAR WINS to MAKAD WINS and the footnote can be removed; the plastic reveal, the handover, the three-choice moment and "Truce lasted 4 seconds." read clearly; the results card shows one comedy line; Dukkar is selectable afterwards.
- [ ] "Download results card" saves a PNG that looks right.
- [ ] Reduced motion (Settings) calms the title loop and particles; Low quality keeps the game smooth on an older laptop.
