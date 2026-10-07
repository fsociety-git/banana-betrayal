/**
 * ALL player-facing words live here: names, captions, Dukkar's lines, Makad's lines, signs, encounters,
 * achievements, results lines, intro, ending and credits. Edit freely; keep the keys.
 *
 * Public brief: Makad (the monkey) and Dukkar (the pig) are two mischievous rivals in an escalating banana
 * dispute. Cartoon rivalry only — no relationship framing, no references to anyone outside the game.
 */

export const NAMES = {
  game: 'Banana Betrayal',
  subtitle: 'Makad & Dukkar: He Started It.',
  hero: 'Makad',
  rival: 'Dukkar',
  heroCredit: 'Makad — the monkey. Observant, capable, increasingly hard to prank.',
  rivalCredit: 'Dukkar — the pig. Self-appointed Chief of Mischief.',
  /** The only signature Dukkar ever uses. */
  signature: 'From Dukkar.',
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
    'A small setback for Makad.',
    'Confidence: 100. Landing: 0.',
  ],
  spikes: [
    'Pointy. Noted.',
    'The spikes were not decorative. Lesson logged.',
    'Dukkar said the spikes were "mostly soft."',
  ],
  water: [
    'Monkeys famously float. Makad did not.',
    'The swamp has accepted your application.',
    'Your complaint has been forwarded to Dukkar.',
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
    'Half the Makad you used to be.',
    'Safety guard not included.',
  ],
  generic: [
    'Everything is fine. Try again.',
    'Dukkar has been notified and is laughing.',
    'Bananas: 0. Dignity: also 0.',
    'Respawning. Nobody is counting. (The HUD is counting.)',
  ],
};

/** Dukkar's lines by event key. Arrays rotate on repeat; strings are single lines. */
export const DUKKAR_LINES: Record<string, string | string[]> = {
  // Level 1 — Trust Issues
  'l1-intro': 'Relax. I tested this.',
  'l1-banana-flee': ['It does that. Keep walking.', 'Bananas are shy. Trust me.'],
  'l1-banana-gaveup': 'Fine. It is tired. Take it.',
  'l1-bridge': 'Solid oak. Probably oak.',
  'l1-bridge-fell': 'Okay, that one was half oak.',
  'l1-bridge-survived': ['I was confident. Mostly.', 'I knew it would hold. Mostly.'],
  'l1-coconut': 'Lovely coconut. Purely decorative.',
  'l1-coconut-fell': 'Decorative AND dynamic.',
  'l1-flag': 'The flag is just stretching its legs.',
  'l1-flag-caught': 'Fine. You cornered a flag. Big day.',
  'l1-end': 'See? Nothing happened. Mostly.',
  // Level 2 — Customer Support Swamp
  'l2-intro': 'Welcome to Support. Your jump is very important to us.',
  'l2-sink': 'Those platforms are on a break.',
  'l2-croc': 'Logs. Definitely logs.',
  'l2-rescue': 'Estimated rescue time: eventually.',
  'l2-receipt': 'Receipt for your checkpoint. Keep it for your records.',
  'l2-shortcut': 'Trust me. I know a shortcut.',
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
  'l5-boss-start': 'Nobody takes the golden banana. Not even you, Makad.',
  'l5-phase2': 'Okay. OKAY. Phase two. I have a phase two.',
  'l5-phase3': 'This forklift was a company car!',
  'l5-defeat': 'Fine. Take it. It is yours. Congratulations. Really.',
  'l5-plastic': 'What? It says golden. On the sticker.',
  'l5-real': 'That one is my lunch. Hands off.',
  // Generic
  'death-tease': ['Need a hand? I have hooves.', 'I would have jumped there too. Earlier.', 'Try pressing the jump button. Just a thought.'],
  'idle-tease': ['Take your time. The banana is ageing beautifully.', 'No rush. I have a forklift to polish.'],
  // Event-aware reactions
  'react-waiting': 'Planning something, Makad?',
  'react-avoided': ['That usually works.', 'Huh. That usually works.'],
  'react-return': 'Makad. Let\'s discuss this.',
  'react-bonus': 'All that for one banana. Respect.',
  'react-caught-laughing': '…I was coughing.',
  'react-applaud-stop': '…Reflex.',
  // Gentle hints after repeated failures (replace taunts)
  'hint-bridge': 'Keep moving. They drop from the side you start on.',
  'hint-coconut': 'It drops when you stand under it. So don\'t.',
  'hint-crusher': 'Wait for the slam. Then walk. Then stop again.',
  'hint-croc': 'Eyes blink red before the teeth. Count to two.',
  'hint-sinking': 'Two wobbles, then it sinks. Hop early.',
  'hint-cloud': 'Clouds give you a moment. Use the moment.',
  'hint-wind': 'Jump short with the wind, long against it.',
  'hint-generic': 'Jump later than feels right. Trust me. Once.',
  // Bonk
  'bonk-holder': 'You wouldn\'t bonk someone holding a banana.',
  'bonk-react': ['Ow.', 'Unprovoked.', 'I was holding that.', 'Noted. Rudely.', 'That counts as assault in three jungles.'],
  'bonk-moustache': 'This is a separate department.',
  'bonk-dropped': 'Ow. Fine. Take it.',
  // "DUKKAR!" callouts
  'callout-freeze': 'I was not stealing. I was inspecting.',
  'callout-plant': 'There is no pig behind this plant.',
  'callout-lever': '…Returning the lever to its original position.',
  'callout-return': 'Fine. Here.',
  'callout-sign': 'What sign? I see no sign.',
  'callout-clipboard': 'Very busy. Clipboard things.',
  // Red button
  'button-dont': 'Whatever you do, don\'t press this.',
  'button-saw': 'You saw the button, right?',
  'button-ages': 'I spent ages on this.',
  'button-self': 'Fine. I\'ll press it myself.',
  'button-glove': 'Ow. Who installed that?',
  'button-pressed': 'Told you. Technically.',
  // Stolen banana chase
  'chase-start': 'Mine now. Try to keep up.',
  'chase-taunt': 'Too slow, Makad!',
  'chase-sign': 'Meant to do that.',
  'chase-breath': 'Hold on. Hold on. Cardio.',
  'chase-return-1': 'You were supposed to chase me.',
  'chase-return-2': 'Anyway. Here.',
  // Shortcut
  'shortcut-exit': 'Scenic route.',
  'shortcut-callback-start': 'I know a—',
  'shortcut-callback-end': '…Never mind.',
  // Show me
  'showme-claim': 'It\'s literally one jump.',
  'showme-go': 'Watch closely.',
  'showme-fail': 'Controller issue.',
  // Complaint department
  'desk-greet': 'How can we avoid helping?',
  'desk-received': 'Complaint received. Assigned to: Dukkar.',
  'desk-refund': 'REFUND? That is not a— ow.',
  'desk-escalations': 'Escalations. Same pig. Taller box.',
  // Backfire
  'backfire-intro': 'Behold. Over-engineering.',
  'backfire-pull': 'And… pull!',
  'backfire-error': 'There has been a minor administrative error.',
  'backfire-flee': 'Not my machinery. Never seen it.',
  'backfire-miss': 'Noted. Next time: two coconuts.',
  // Replies
  'reply-explain-answer': 'See, the diagram—',
  'reply-yourself-answer': 'I just remembered something urgent. Elsewhere.',
  'reply-stare-answer': '…Fine. Here.',
  // Cooperation
  'coop-umbrella': 'Checkpoint machinery hates rain. Allegedly.',
  'coop-step': 'Try the step. Pretend I did not help.',
  'coop-pulled': 'Thanks. Tell no one.',
  'apology-read': 'Reading the form now. "Incident probably unrelated to—"',
  'apology-boom': 'That was unrelated too.',
  // Boss staging
  'boss-p1': 'I\'m obviously winning.',
  'boss-p2': 'I wasn\'t ready.',
  'boss-p3': 'Okay. Serious now.',
  'boss-final-bonk': 'Fair.',
  'boss-footnote': 'Pending review.',
  // Ending
  'end-handover': 'Real banana. And a trophy. Handmade. Mostly glue.',
  'end-highfive': 'Truce. Temporary.',
  'end-bonk': 'Deserved.',
  'end-both': 'Deserved. Then truce. Temporary.',
};

/** Makad's own short lines (shown in his bubble). */
export const MAKAD_LINES: Record<string, string> = {
  callout: 'DUKKAR!',
  showme: 'Show me.',
  'shortcut-exit': 'The exit was right there.',
  'reply-explain': 'Explain yourself.',
  'reply-yourself': 'Do it yourself, then.',
  'reply-stare': '…',
  'intro-look': '…',
  'end-pick': 'Well?',
};

/** Sign text by key. */
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
  'l5-hq': 'DUKKAR HQ — Visitors must be banana-free.',
  'l5-forklift': 'Forklift parking. Authorised pigs only.',
  'l1-mine': 'PROPERTY OF DUKKAR. ALL OF IT.',
  'red-button': 'DO NOT PRESS',
  'gotcha': 'GOTCHA',
  'queue': 'Queue here. Est. wait: 0 min.',
  'ladder': 'Ladder (unnecessary).',
  'time-saved': 'Time saved: questionable.',
  'skill-issue': 'SKILL ISSUE',
  'complaint-dept': 'Prank Complaint Department',
  'escalations': 'Escalations',
  'supplies': 'Emergency supplies. Do not overthink it.',
  'direction': '← COCONUT DIRECTION',
  'direction-flipped': 'COCONUT DIRECTION →',
  'showme': 'IT\'S LITERALLY ONE JUMP',
  'apology': 'Official Apology Kit',
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

/** New-game introduction (skippable, shown once). */
/** Caption shown the first time a bonk makes Dukkar drop a banana. */
export const BONK_CAPTION = 'Dukkar deserved that.';

export const INTRO = {
  steal: 'Come get it, Makad.',
  card: { name: 'Dukkar', role: 'Self-appointed Chief of Mischief', note: 'Qualifications: Trust me.' },
  bump: 'That sign was not there before.',
  skip: 'Skip',
};

/** Complaint desk options (keyboard 1–3 or tap). */
export const COMPLAINTS: string[] = [
  'Someone keeps stealing bananas.',
  'The signs are lying.',
  'The pig thinks he\'s funny.',
];
export const COMPLAINT_PRINTOUT = ['COMPLAINT RECEIVED', 'Ref: #0001 (every time)', 'Assigned to: Dukkar', 'Priority: eventually', 'Status: ignored'];
export const APOLOGY_KIT = ['OFFICIAL APOLOGY KIT', '1 × banana', '1 × tiny repair tool', 'Form: "Incident probably', 'unrelated to Dukkar."'];

export const ENDING = {
  trophyReveal: 'It\'s… plastic. There\'s a sticker.',
  realBanana: 'The real one is next to his lunch.',
  closing: 'Truce lasted 4 seconds.',
  unlock: 'Dukkar is now playable. He insists it was his idea.',
  trophyFront: 'BANANA CHAMPION',
  trophyBack: NAMES.signature,
  bannerFirst: 'DUKKAR WINS',
  bannerFlipped: 'MAKAD WINS',
  footnote: 'Pending review.',
  options: { highfive: 'High-five', bonk: 'Bonk', both: 'Both' },
};

export interface AchievementDef { id: string; title: string; description: string; }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'unbothered', title: 'Unbothered', description: 'Ignored the red button. Dukkar pressed it himself.' },
  { id: 'demonstration', title: 'Demonstration Required', description: 'Made Dukkar attempt the jump.' },
  { id: 'complaint', title: 'Complaint Escalated', description: 'Filed a complaint and stamped REFUND.' },
  { id: 'reverse', title: 'Reverse Engineering', description: 'Turned the big trap against Dukkar.' },
  { id: 'recovered', title: 'Banana Recovered', description: 'Got the stolen banana back.' },
  { id: 'coming', title: 'Dukkar Had It Coming', description: 'Delivered the final bonk.' },
  { id: 'truce', title: 'Brief Truce', description: 'Chose the high-five ending.' },
];

/** One short context-aware line for the results card / overlay. First matching rule wins. */
export const RESULTS_LINES: { when: 'deathless' | 'fast' | 'allBananas' | 'manyDeaths' | 'achievement' | 'default'; text: string }[] = [
  { when: 'deathless', text: 'Not a single death. Dukkar has requested a recount.' },
  { when: 'allBananas', text: 'Every banana. The pig has filed a complaint about greed.' },
  { when: 'fast', text: 'Fast. Suspiciously fast. Dukkar is checking the controller.' },
  { when: 'manyDeaths', text: 'Many attempts. Dukkar stopped laughing around attempt eight.' },
  { when: 'achievement', text: 'A new entry in the official record of Dukkar having it coming.' },
  { when: 'default', text: 'Level complete. Dukkar maintains he was winning.' },
];

export const CREDITS: { role: string; name: string }[] = [
  { role: 'Starring', name: NAMES.heroCredit },
  { role: 'Also starring, regrettably', name: NAMES.rivalCredit },
  { role: 'Character portraits', name: 'Original generated illustrations (photo-cutout style)' },
  { role: 'Design, code, procedural art, music, sound', name: 'Built with Phaser, TypeScript, Vite and WebAudio' },
  { role: 'Bananas harmed', name: 'Several. All plastic.' },
];

export const FIRST_RUN = {
  title: 'How to outsmart a pig',
  lines: [
    'Move with A / D or the arrow keys. Jump with Space, W or Up. Hold jump to go higher.',
    'J bonks. E (or Enter) talks back when Makad has something to say — watch for the "!" above his head.',
    'R restarts from the last checkpoint. Esc pauses. M mutes.',
    'On touch screens, use the on-screen buttons. Thumbs recommended.',
    'The controls are reliable. The world is not. Blame Dukkar.',
  ],
};
