import type { AppNotificationType } from '../types/social';

// Notification copy library — the single source for every notification's
// words (claude.md §8 spirit: copy lives in one fixture the Phase 2/4
// notification service also serves from, never duplicated). Each variant
// has a stable `id` that becomes the notification's `copyVariantId`, so
// Phase 4 can A/B which lines actually get people into a space.
//
// Voice: the Swiggy/Zomato school — punchy hook in the title, the actual
// ask in the body, a little drama, a little food, a lot of emoji. Two
// hard rules from claude.md §3b/§4 that every line here follows:
//   • never shame (no "you failed", "you're slacking", "don't let X down")
//   • a missed day is never a disaster — streak copy is warm, not alarming
//
// Tokens in {braces} are filled at send time; a variant whose tokens
// aren't all available is skipped (see pickCopy).

export interface CopyVariant {
  id: string;
  title: string;
  body: string;
}

export const NOTIFICATION_COPY: Record<AppNotificationType, CopyVariant[]> = {
  // ── Spaces ───────────────────────────────────────────────────────────
  space_invite: [
    { id: 'invite_seat', title: '{friend} saved you a seat ✉️', body: '“{space}” is live. Your spot’s still warm.' },
    { id: 'invite_plain', title: '{friend} invited you 💌', body: '“{space}” · {theme}. Come focus together.' },
    { id: 'invite_vip', title: 'You’re on the guest list 🎟️', body: '{friend} wants you in “{space}”. No dress code.' },
  ],
  friend_started_space: [
    { id: 'started_plain', title: '{friend} just started a space 🟢', body: '“{space}” · {theme}. Come focus together.' },
    { id: 'started_building', title: '{friend} is in the building 🏃', body: '“{space}” just went live. Doors are open.' },
    { id: 'started_lockin', title: 'Look who’s locking in 🔒', body: '{friend} just opened “{space}”. Bring your A-game.' },
    { id: 'started_news', title: 'Breaking: {friend} is being productive 📰', body: 'Witnesses confirm “{space}” is live. Join before it’s old news.' },
  ],
  space_reminder: [
    { id: 'reminder_plain', title: '⏰ “{space}” starts in {minutes} min', body: '{friend} is opening it at {time}. Grab water, find your spot.' },
    { id: 'reminder_countdown', title: 'T-minus {minutes} minutes 🚀', body: '“{space}” with {friend} lifts off at {time}.' },
  ],
  own_space_due: [
    { id: 'due_ready', title: 'Your space is ready 🚀', body: '“{space}” was set for {time}. The stage is yours.' },
    { id: 'due_showtime', title: 'Showtime! 🎬', body: '“{space}” is waiting for its host. That’s you.' },
  ],
  space_joined: [
    { id: 'joined_plain', title: '{friend} joined your space 🙌', body: '“{space}” just got better company.' },
    { id: 'joined_squad', title: 'Squad’s growing 👯', body: '{friend} just walked into “{space}”.' },
  ],

  // ── Friends ──────────────────────────────────────────────────────────
  friend_request: [
    { id: 'request_buddy', title: '{friend} wants to be accountability buddies 🤝', body: 'Accept and you’ll see each other’s spaces.' },
    { id: 'request_duo', title: 'New duo incoming 👋', body: '{friend} sent you a friend request.' },
  ],
  friend_accepted: [
    { id: 'accepted_yes', title: '{friend} said yes 🤝', body: 'You’re accountability buddies now. Their spaces will show up for you.' },
    { id: 'accepted_official', title: 'It’s official 💫', body: 'You and {friend} are friends on Prodify.' },
  ],
  friend_milestone: [
    { id: 'milestone_plain', title: '{friend} hit a {milestone}-day streak 🎉', body: 'Send some fire their way.' },
    { id: 'milestone_legend', title: 'Legend alert: {friend} 🏆', body: '{milestone} days straight. That deserves a 🔥.' },
  ],
  reactions_received: [
    { id: 'reaction_single', title: '{friend} cheered you on {emoji}', body: 'During “{space}”. You’ve got fans.' },
    { id: 'reaction_fan', title: 'You have a fan club {emoji}', body: '{friend} sent you a cheer in “{space}”.' },
  ],
  together_streak_risk: [
    { id: 'together_duo', title: 'You & {friend}: {days}-day together streak 🤝', body: '{friend}’s in a space right now. Make it {next}?' },
    { id: 'together_goals', title: 'Duo goals 👯', body: '{friend} just sat down to focus. Your {days}-day streak together is one session from {next}.' },
  ],

  // ── Progress & rewards ───────────────────────────────────────────────
  streak_at_risk: [
    { id: 'risk_attention', title: 'Your {streak}-day streak wants a little attention 🔥', body: '{needed} more minutes today keeps it glowing.' },
    { id: 'risk_smallask', title: 'Small ask, big glow ✨', body: 'Just {needed} minutes and your {streak}-day streak lives on.' },
    { id: 'risk_pushups', title: 'Your streak is doing push-ups waiting for you 💪', body: '{needed} minutes is all it needs tonight.' },
  ],
  goal_close: [
    { id: 'goal_taste', title: 'So close you can taste it 😋', body: '{remaining} min to today’s goal. One short session?' },
    { id: 'goal_thatsit', title: '{remaining} minutes. That’s it. 🎯', body: 'Today’s goal is right there. Go grab it.' },
  ],
  streak_freeze_used: [
    { id: 'freeze_saved', title: 'A freeze saved your {streak}-day streak ❄️', body: 'Life happens. Your streak’s safe. Welcome back.' },
  ],
  streak_freeze_earned: [
    { id: 'freeze_earned', title: 'You earned a streak freeze ❄️', body: '{streak} days in a row unlocked a backup. You have {count} now.' },
  ],
  badge_earned: [
    { id: 'badge_new', title: 'New badge: {badge} {icon}', body: '{description} Tap to celebrate.' },
  ],
  level_up: [
    { id: 'level_up', title: 'Level {level} unlocked ✨', body: 'Spark’s glowing brighter. Tap to celebrate.' },
  ],
  weekly_recap: [
    { id: 'recap_week', title: 'Your week in focus 📊', body: '{hours} focused · best day {bestDay}. Tap for the full recap.' },
    { id: 'recap_wrapped', title: 'Your weekly wrap is here 🎁', body: '{hours} of focus this week. Want the highlights?' },
  ],
  welcome_back: [
    { id: 'welcome_friend', title: 'Missed you 👀', body: '{friend}’s in a space right now if you want company.' },
    { id: 'welcome_plain', title: 'Look who’s back ✨', body: 'Pick up wherever you like. No pressure, just a fresh start.' },
  ],

  // join_nudge is served from JOIN_NUDGE_COPY below, by context.
  join_nudge: [],
};

// Grouped forms — used when an unread notification of the same groupKey
// absorbs another one ("Riya and 2 others…").
export const GROUPED_COPY: Partial<Record<AppNotificationType, CopyVariant>> = {
  friend_started_space: {
    id: 'started_grouped',
    title: '{friend} and {others} just started spaces 🎉',
    body: 'It’s a whole vibe in Spaces right now. Pick one.',
  },
  space_joined: {
    id: 'joined_grouped',
    title: '{friend} and {others} joined your space 🙌',
    body: '“{space}” is filling up. Nice crew.',
  },
  reactions_received: {
    id: 'reaction_grouped',
    title: '{friend} and {others} cheered you on {emoji}',
    body: 'During “{space}”. Your focus is contagious.',
  },
};

// ── Playful "come focus" nudges — the Swiggy/Zomato-style hooks ─────────
// Picked by context server-side (server/src/jobs/index.ts nudgeUser):
// a friend live right now beats a streak hook beats a time-of-day line.
export type NudgeContext = 'friend_live' | 'streak' | 'theme' | 'morning' | 'afternoon' | 'evening' | 'late_night';

export const JOIN_NUDGE_COPY: Record<NudgeContext, CopyVariant[]> = {
  friend_live: [
    { id: 'nudge_netflix', title: 'Netflix can wait. {friend} can’t 👀', body: '{friend} is {minutes} min into “{space}”. Pull up a chair.' },
    { id: 'nudge_rude', title: '{friend} started without you 😤 (rude)', body: '“{space}” is live. Go show them how it’s done.' },
    { id: 'nudge_partyofone', title: 'Party of one? Not anymore 🎉', body: '{friend} just opened “{space}”. There’s a seat with your name on it.' },
    { id: 'nudge_psst', title: 'Psst… {friend} is in the zone 🤫', body: 'Tiptoe into “{space}”. No small talk required.' },
    { id: 'nudge_biryani', title: 'Focus tastes better together 🍛', body: '{friend} is serving up “{space}”. Grab a plate.' },
  ],
  streak: [
    { id: 'nudge_streak_pushups', title: 'Your {streak}-day streak is doing push-ups 💪', body: 'It’s warmed up and ready when you are.' },
    { id: 'nudge_streak_flame', title: '{streak} days strong 🔥', body: 'Feed the flame. One session keeps it roaring.' },
    { id: 'nudge_streak_chef', title: 'Chef’s kiss to {streak} days 👨‍🍳', body: 'Today’s special: one focused session, served fresh.' },
  ],
  theme: [
    { id: 'nudge_theme_called', title: '{icon} {theme} called. It misses you', body: 'A quick {theme} session? Your future self says yes.' },
    { id: 'nudge_theme_desk', title: 'Your desk is lonely 🪑', body: 'It’s been staring at the door all day. Visit it with a {theme} session?' },
  ],
  morning: [
    { id: 'nudge_morning_grind', title: 'Rise and grind ☕', body: 'Coffee’s brewing, focus is loading. Start a space?' },
    { id: 'nudge_morning_legend', title: 'Good morning, legend 🌅', body: 'Early bird gets the streak. 25 minutes is all it takes.' },
    { id: 'nudge_morning_todo', title: 'Your to-do list called 📞', body: 'It said “please”. Start a quick space?' },
  ],
  afternoon: [
    { id: 'nudge_afternoon_slump', title: 'Post-lunch slump? We have the cure 💊', body: 'One focused session. Zero side effects.' },
    { id: 'nudge_afternoon_plot', title: 'Plot twist: you, focusing, right now 🎬', body: 'The 3pm comeback arc starts with one space.' },
    { id: 'nudge_afternoon_snack', title: 'Snack break’s over 🍪', body: 'Brush off the crumbs. Let’s get one done.' },
  ],
  evening: [
    { id: 'nudge_evening_golden', title: 'Golden hour, golden focus ✨', body: 'One evening session and today ends on a high.' },
    { id: 'nudge_evening_dinner', title: 'Dinner’s in an hour 🍝', body: 'So is one solid session. Coincidence? We think not.' },
    { id: 'nudge_evening_couch', title: 'Your couch is lovely. Your goals are lovelier 🛋️', body: 'Quick 30 before you sink in?' },
  ],
  late_night: [
    { id: 'nudge_night_owl', title: 'Night owl mode: activated 🦉', body: 'The world’s asleep. Perfect time to get things done.' },
    { id: 'nudge_night_snack', title: 'Midnight snack or midnight win? 🌙', body: 'Why not both. Start a short space.' },
  ],
};
