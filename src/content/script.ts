/**
 * ALL player-facing words live here: names, captions, pig dialogue, signs, level intros, ending, credits.
 * Edit freely. Keys are referenced from level data and gameplay code; keep the keys, change the text.
 * Keep it friendly: mutual roasting between two friends, never cruel.
 */

export const NAMES = {
  game: 'Banana Betrayal',
  subtitle: 'Two friends. One banana. Absolutely no trust.',
  hero: 'Monkey',
  rival: 'Pig',
  /** Shown on the results card and credits. Change to real first names if you like. */
  heroCredit: 'The Monkey (a friend who trusted a pig)',
  rivalCredit: 'The Pig (a friend who owns a forklift)',
} as const;

export type DeathCause =
  | 'fall' | 'spikes' | 'water' | 'crush' | 'coconut' | 'bridge' | 'croc' | 'sinking' | 'falling-object'
  | 'cloud' | 'wind' | 'boss' | 'peel' | 'electric' | 'saw' | 'generic';

/** Death captions by cause. At least three per cause so repeats stay rare. */
export const CAPTIONS: Record<DeathCause, string[]> = {
  fall: [
    'Gravity remains undefeated.',
    'That was a confident step into nothing.',
    'The ground was optional, apparently.',
    'A small setback for monkeykind.',
    'Confidence: 100. Landing: 0.',
  ],
  spikes: [
    'Pointy. Noted.',
    'The spikes were not decorative. Lesson logged.',
    'He said the spikes were "mostly soft."',
  ],
  water: [
    'Monkeys famously float. This one did not.',
    'The swamp has accepted your application.',
    'Your complaint has been forwarded to the pig.',
  ],
  crush: [
    'Flattened. Easier to mail now.',
    'The crusher was on schedule. You were not.',
    'Timing is everything. That was not timing.',
  ],
  coconut: [
    'That coconut had been waiting all day.',
    'Decorative, he said. Purely decorative.',
    'Head meets coconut. Coconut wins.',
  ],
  bridge: [
    'He said he tested it.',
    'That bridge had commitment issues.',
    'Load-bearing was a strong word for it.',
  ],
  croc: [
    'The platform blinked. You should have too.',
    'Not every log is a log.',
    'Dental plan: none. Teeth: many.',
  ],
  sinking: [
    'The platform wobbled twice. That was the warning.',
    'It said "temporary" right there on the side.',
    'Sinking feeling confirmed.',
  ],
  'falling-object': [
    'The shadow was the hint.',
    'Something fell. Then you did.',
    'Cloud storage is not a safe place to stand under.',
  ],
  cloud: [
    'The cloud said "Definitely Solid." It was lying.',
    'Clouds: beautiful, fluffy, structurally unsound.',
    'Terms and conditions applied to that cloud.',
  ],
  wind: [
    'The wind had other plans for you.',
    'Blown off course, on brand.',
    'That gust came with a strong opinion.',
  ],
  boss: [
    'The forklift has a licence. You do not.',
    'Please stand clear of the banana forklift.',
    'He drives like he gives directions.',
  ],
  peel: [
    'The banana was a paid actor.',
    'Classic peel. Classic you.',
    'Slipped on the one free thing in the building.',
  ],
  electric: [
    'Shocking. Truly.',
    'The sign said "LIVE". It meant the wire.',
    'A bright idea, briefly.',
  ],
  saw: [
    'That saw was very committed to its job.',
    'Half the monkey you used to be.',
    'Safety guard not included.',
  ],
  generic: [
    'Everything is fine. Try again.',
    'The pig has been notified and is laughing.',
    'Bananas: 0. Dignity: also 0.',
    'Respawning. Nobody is counting. (The HUD is counting.)',
  ],
};

/** Pig dialogue by event key. Arrays rotate on repeat; strings are single lines. */
export const PIG_LINES: Record<string, string | string[]> = {
  // Level 1 — Trust Issues
  'l1-intro': 'Relax. I tested this.',
  'l1-banana-flee': ['It does that. Keep walking.', 'Bananas are shy. Trust me.'],
  'l1-bridge': 'Solid oak. Probably oak.',
  'l1-bridge-fell': 'Okay, that one was half oak.',
  'l1-bridge-survived': ['Huh. Lucky oak.', 'I knew it would hold. Mostly.'],
  'l1-coconut-fell': 'Decorative AND dynamic.',
  'l1-banana-gaveup': 'Fine. It is tired. Take it.',
  'l1-coconut': 'Lovely coconut. Purely decorative.',
  'l1-flag': 'The flag is just stretching its legs.',
  'l1-flag-caught': 'Fine. You cornered a flag. Big day.',
  'l1-end': 'See? Nothing happened. Mostly.',
  // Level 2 — Customer Support Swamp
  'l2-intro': 'Welcome to Support. Your jump is very important to us.',
  'l2-sink': 'Those platforms are on a break.',
  'l2-croc': 'Logs. Definitely logs.',
  'l2-rescue': 'Estimated rescue time: eventually.',
  'l2-receipt': 'Receipt for your checkpoint. Keep it for your records.',
  'l2-shortcut': 'Shortcut on the right. Technically shorter.',
  'l2-end': 'Ticket closed. Reason: you left.',
  // Level 3 — The Banana Economy
  'l3-intro': 'Welcome to the Banana Economy. Please mind the fees.',
  'l3-manager': 'I am management now. The badge was free.',
  'l3-machine': 'FREE banana. Reasonable processing fee.',
  'l3-fee': 'Processing fee: one banana. Standard.',
  'l3-crusher': 'The crushers are very punctual. Be like the crushers.',
  'l3-end': 'Thank you for your business. All sales final.',
  // Level 4 — Cloud Storage
  'l4-intro': 'Cloud Storage. Everyone\'s bananas are safe up here. Mostly.',
  'l4-umbrella': 'I brought an umbrella. I have planned for everything.',
  'l4-cloud': 'That cloud is definitely solid. It told me.',
  'l4-wind': 'Lean into the wind. Or away. One of those.',
  'l4-sign': 'That sign was load-bearing for my confidence.',
  'l4-end': 'Backed up and nearly deleted. Classic cloud.',
  // Level 5 — The Oinkcident
  'l5-intro': 'Welcome to HQ. Please do not touch the forklift.',
  'l5-boss-start': 'Nobody takes the golden banana. Not even you, buddy.',
  'l5-phase2': 'Okay. OKAY. Phase two. I have a phase two.',
  'l5-phase3': 'This forklift was a company car!',
  'l5-defeat': 'Fine. Take it. It is yours. Congratulations. Really.',
  'l5-plastic': 'What? It says golden. On the sticker.',
  'l5-real': 'That one is my lunch. Hands off.',
  // Generic
  'death-tease': ['Need a hand? I have hooves.', 'I would have jumped there too. Earlier.', 'Try pressing the jump button. Just a thought.'],
  'idle-tease': ['Take your time. The banana is ageing beautifully.', 'No rush. I have a forklift to polish.'],
};

/** Sign text by key (levels reference these). */
export const SIGNS: Record<string, string> = {
  'l1-welcome': 'WELCOME! Nothing suspicious ahead.',
  'l1-safe': 'Totally safe bridge →',
  'l1-coconut': 'Decorative coconut. Do not worry about it.',
  'l1-flag': 'Finish line! (terms apply)',
  'l2-important': 'Your jump is very important to us.',
  'l2-hold': 'Please hold. Estimated wait: a while.',
  'l2-shortcut': 'SHORTCUT → (we are not liable)',
  'l2-logs': 'Logs. Just logs.',
  'l3-free': 'FREE BANANA MACHINE',
  'l3-fee': 'Processing fee: one banana.',
  'l3-crusher': 'Crushers operate on a schedule. Please respect the schedule.',
  'l3-greed': 'Bonus bananas → (optional, greedy)',
  'l4-solid': 'Definitely Solid',
  'l4-reassure': 'You are doing great! Nothing can go wrong.',
  'l4-wind': 'Mild breeze ahead.',
  'l5-hq': 'PIG HQ — Visitors must be banana-free.',
  'l5-forklift': 'Forklift parking. Authorised pigs only.',
  'test': 'Test room. Nothing here is a joke. Yet.',
};

export const LEVEL_INTROS: Record<string, { title: string; subtitle: string }> = {
  level1: { title: 'Trust Issues', subtitle: 'A bright jungle with very confident signs.' },
  level2: { title: 'Customer Support Swamp', subtitle: 'Your jump is very important to us.' },
  level3: { title: 'The Banana Economy', subtitle: 'Bananas in. Smaller bananas out.' },
  level4: { title: 'Cloud Storage', subtitle: 'Everyone\'s saved bananas. Zero redundancy.' },
  level5: { title: 'The Oinkcident', subtitle: 'Golden banana headquarters. Do not touch the forklift.' },
  test: { title: 'Movement Test Room', subtitle: 'For tuning, not for trust.' },
};

export const ENDING = {
  trophyReveal: 'It\'s… plastic. There\'s a sticker.',
  realBanana: 'The real one is next to his lunch.',
  closing: 'The monkey took the lunch too. Friendship is complicated.',
  unlock: 'The pig is now playable. He insists it was his idea.',
};

export const CREDITS: { role: string; name: string }[] = [
  { role: 'Starring', name: NAMES.heroCredit },
  { role: 'Also starring, unfortunately', name: NAMES.rivalCredit },
  { role: 'Character portraits', name: 'Generated with Higgsfield from the players\' own photos' },
  { role: 'Code, art, music, sounds', name: 'Built with Phaser, TypeScript, Vite and WebAudio' },
  { role: 'Bananas harmed', name: 'Several. All plastic.' },
];

export const FIRST_RUN = {
  title: 'How to betray a pig',
  lines: [
    'Move with A / D or the arrow keys. Jump with Space, W or Up. Hold jump to go higher.',
    'R restarts from the last checkpoint. Esc pauses. M mutes.',
    'On touch screens, use the on-screen buttons. Thumbs recommended.',
    'The controls are reliable. The world is not. Blame the pig.',
  ],
};
