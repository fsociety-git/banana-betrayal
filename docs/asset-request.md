# Asset request: extra character poses (optional)

The game is complete with the two supplied portraits (one pose each, animated procedurally). These extra poses
would materially improve the feel. Generate them with Higgsfield (GPT Image 2.5) **using the existing character
image as the reference input** so identity, proportions, outline weight and colours stay consistent, then run the
cut-out script (`scratchpad/cutout.py` logic lives in PROGRESS.md) and drop the results into
`public/assets/characters/`.

## Consistency requirements (paste into every prompt)

> Same character as the reference image: identical photo-cutout style head, hairstyle and proportions on
> the same cartoon body with the same warm brown fur / pink skin, bold black outlines, flat cel shading and tiny
> red sneakers (monkey) or small dark hooves (pig). Full body, side view facing right, face turned slightly toward
> the viewer. Centered on a plain solid pure white background. No text, props, scenery, ground shadow or extra
> characters. Same rendering scale as the reference: the head is about 45% of total height.

## Makad (the monkey, hero)

| Pose key | Prompt addition | Used for |
|---|---|---|
| `monkey-jump` | "…mid-jump pose: knees tucked, both long arms raised above the head, tail curled upward, excited open-mouth smile." | rising state |
| `monkey-fall` | "…falling pose: arms flailing out to the sides, legs splayed, tail straight up, wide-eyed alarmed expression." | falling state |
| `monkey-hurt` | "…hurt pose: eyes squeezed shut, limbs splayed like a starfish, tail drooping, small sweat drops." | death pop |
| `monkey-victory` | "…victory pose: standing proud, one arm raised holding nothing, chest out, big grin, tail curled high." | results, flag |

## Dukkar (the pig: rival, boss, unlockable)

| Pose key | Prompt addition | Used for |
|---|---|---|
| `pig-driving` | "…seated driving pose: body seated with both hooves gripping an imaginary steering wheel in front, leaning forward, smug grin." | forklift boss |
| `pig-laugh` | "…laughing pose: leaning back, one hoof on the belly, eyes closed, mouth open laughing." | death tease |
| `pig-stunned` | "…stunned pose: eyes crossed, tongue slightly out, swaying, three little stars above the head drawn in the same cartoon style." | boss stun |
| `pig-sulk` | "…defeated sulking pose: slumped shoulders, head down, bottom lip out, ears drooping." | boss defeat |

## Integration notes

- Export at the same canvas height as the current layers (318 px for the monkey, 304 px for the pig) so the
  `CharacterDef` pivots in `src/content/characters.ts` keep working; add new keys there and load them in
  `src/scenes/PreloadScene.ts`.
- Keep the head/body split: run the head outline + tail split pipeline on each new pose, then swap the
  body texture per state in `CharacterRig` (head layer stays the same so the face never jumps).
