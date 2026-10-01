// TODO(placeholder copy): stands in for the real quote library in
// prodify_full_architecture.md §7, which isn't in this repo yet. Swap every
// array below for the real copy once that file is added — per claude.md §8
// this fixture should stay the single source the Phase 2 Mascot Engine also
// reads from, so copy is never maintained in two places.

export type MascotQuoteCategory =
  | 'onboarding'
  | 'returning'
  | 'regular'
  | 'welcomeBack'
  | 'streakAtRisk'
  | 'streakMilestone'
  | 'xpMilestone'
  | 'celebration'
  | 'sessionComplete'
  | 'missedTarget'
  | 'badgeEarned'
  | 'friendUpdate'
  | 'friendsLive'
  | 'levelUp'
  | 'idle';

export const mascotQuotes: Record<MascotQuoteCategory, string[]> = {
  onboarding: [
    'Hey! I’m Spark ✨\nLet’s make today count.',
    "Let's light this up together — one session at a time.",
  ],
  returning: [
    'Back again? 🔥',
    "There you are — let's keep it going.",
  ],
  regular: [
    'Another session?\nYou’re becoming predictable 😏',
    "At this point we're basically a team.",
  ],
  welcomeBack: [
    'Psst...\nI haven’t seen you in a while 👀',
    "Good to see you again — ready to pick things back up?",
  ],
  streakAtRisk: [
    "Your streak's flickering — one session today keeps it alive.",
    "Don't let today slip! A quick session is all it takes to protect your streak.",
  ],
  streakMilestone: [
    '7 days?!\nOkay... we’re building something here 👀',
    "That's a real streak now. I'm impressed.",
  ],
  xpMilestone: [
    'You just crossed 1,000 XP!',
    "That's a new personal high. Nicely done.",
  ],
  celebration: [
    "That's the energy! Keep it going.",
    "Look at you go — I'm glowing brighter just watching.",
  ],
  sessionComplete: [
    'That was solid! 🔥\nYou just added {minutes} productive minutes.',
    "Session done! That's another log on the fire.",
  ],
  missedTarget: [
    "Didn't hit the full target this time — that's okay, showing up still counts.",
    "Not every session goes to plan, and that's fine. Same time next round?",
  ],
  badgeEarned: [
    "New badge unlocked! You earned that one.",
    "Shiny! Add that badge to the collection.",
  ],
  friendUpdate: [
    '{name} just finished a session.',
    "Your crew's been busy. Check out what they've been up to.",
  ],
  // {crew} is pre-built by the caller ("Riya is" / "3 of your friends
  // are") so the grammar is right for one friend or many.
  friendsLive: [
    '{crew} focusing right now 👀\nWant to jump in with them?',
    "Company makes the first minute easier. They're in Spaces.",
  ],
  levelUp: [
    "Level up! I can feel myself getting brighter.",
    "You leveled up — this glow is well earned.",
  ],
  idle: [
    "Whenever you're ready, I'll be right here.",
    "Quiet moment — good time to plan your next session.",
  ],
};
