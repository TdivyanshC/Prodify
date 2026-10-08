// Hand-authored inputs to the dev seed. Everything numeric about users
// (points, streaks, badges, levels, rollups, together streaks) is NOT typed
// here — it's derived by replaying the generated activity through the
// progress rules (replay.ts), so the seeded DB is internally consistent.
//
// Cast: 1 main test user (Simran) + 5 accepted friends + people who exercise
// the other relationship states (incoming/outgoing request, a suggestion via
// mutual friends, a blocked + reported account).

export type CatSlug = 'study' | 'coding' | 'work' | 'fitness' | 'move' | 'wellness' | 'creative' | 'growth';

// The 8 fixed themes. `legacyId` is the Phase 1 mock id (src/mocks/sessionCategories.mock.ts)
// so the app can map fixtures ↔ seeded docs while both exist.
export const CATEGORIES: { slug: CatSlug; legacyId: string; name: string; icon: string }[] = [
  { slug: 'study', legacyId: 'cat_study', name: 'Study', icon: '📚' },
  { slug: 'coding', legacyId: 'cat_coding', name: 'Coding & Tech', icon: '💻' },
  { slug: 'work', legacyId: 'cat_work', name: 'Work & Career', icon: '💼' },
  { slug: 'fitness', legacyId: 'cat_fitness', name: 'Fitness', icon: '🏋️' },
  { slug: 'move', legacyId: 'cat_move', name: 'Move & Outdoors', icon: '🚶' },
  { slug: 'wellness', legacyId: 'cat_wellness', name: 'Wellness', icon: '🧘' },
  { slug: 'creative', legacyId: 'cat_creative', name: 'Creative', icon: '🎨' },
  { slug: 'growth', legacyId: 'cat_growth', name: 'Personal Growth', icon: '🌱' },
];

export type BadgeCriteria =
  | 'streak'
  | 'early_sessions'
  | 'late_sessions'
  | 'sessions_completed'
  | 'friend_count'
  | 'total_xp';

// Same catalog as src/mocks/badges.mock.ts (key = its _id).
export const BADGES: { key: string; name: string; description: string; criteriaType: BadgeCriteria; criteriaValue: number; icon: string }[] = [
  { key: 'badge_streak_7', name: '7-Day Streak', description: 'Kept your streak alive for a full week.', criteriaType: 'streak', criteriaValue: 7, icon: '🔥' },
  { key: 'badge_early_bird', name: 'Early Bird', description: 'Completed 5 sessions before 9am.', criteriaType: 'early_sessions', criteriaValue: 5, icon: '🌅' },
  { key: 'badge_streak_30', name: '30-Day Streak', description: 'A full month without missing a day.', criteriaType: 'streak', criteriaValue: 30, icon: '🏆' },
  { key: 'badge_night_owl', name: 'Night Owl', description: 'Completed 5 sessions after 10pm.', criteriaType: 'late_sessions', criteriaValue: 5, icon: '🌙' },
  { key: 'badge_centurion', name: 'Centurion', description: 'Completed 100 sessions total.', criteriaType: 'sessions_completed', criteriaValue: 100, icon: '💯' },
  { key: 'badge_social_butterfly', name: 'Social Butterfly', description: 'Made 10 friends on Prodify.', criteriaType: 'friend_count', criteriaValue: 10, icon: '🦋' },
  { key: 'badge_xp_1000', name: 'Rising Flame', description: 'Earned 1,000 XP.', criteriaType: 'total_xp', criteriaValue: 1000, icon: '🔥' },
  { key: 'badge_xp_5000', name: 'Steady Blaze', description: 'Earned 5,000 XP.', criteriaType: 'total_xp', criteriaValue: 5000, icon: '☄️' },
  { key: 'badge_xp_10000', name: 'Inferno', description: 'Earned 10,000 XP.', criteriaType: 'total_xp', criteriaValue: 10000, icon: '🌋' },
];

// C = hit target, H = ≥50% (still counts), L = showed up but <50%, N = nothing.
export type DayType = 'C' | 'H' | 'L' | 'N';

export interface Persona {
  key: string;
  displayName: string;
  handle: string;
  tagline: string;
  timezone: string;
  dailyTargetMin: number;
  accountAgeDays: number;
  categories: Partial<Record<CatSlug, number>>;
  // Local hour solo sessions usually start from.
  soloFromHour: number;
  // Odds for days not covered by `recent`.
  odds: Record<DayType, number>;
  // Explicit day types for the most recent days, oldest → yesterday (last
  // char = yesterday). Starting a block with "NN" guarantees a hard streak
  // reset (one freeze can cover one missed day, never two).
  recent: string;
  socialHandles?: { instagram?: { value: string; isVisible: boolean }; snapchat?: { value: string; isVisible: boolean } };
  notificationPrefs?: { nudges?: boolean; friendAlerts?: string[]; quietHours?: { enabled: boolean; startHour: number; endHour: number }; dailyToastCap?: number };
  platform: 'android' | 'ios' | 'web';
}

export const MAIN_USER = 'simran';
export const FRIENDS_OF_MAIN = ['riya', 'arjun', 'meera', 'kabir', 'sara'] as const;

export const PERSONAS: Persona[] = [
  {
    key: 'simran',
    displayName: 'Simran Kaur',
    handle: 'simran',
    tagline: 'Building Prodify, one focused hour at a time ✨',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 120,
    accountAgeDays: 120,
    categories: { study: 4, coding: 3, work: 1, wellness: 1 },
    soloFromHour: 9,
    odds: { C: 0.3, H: 0.25, L: 0.2, N: 0.25 },
    // Story: 7-day run (freeze earned) → 1 miss covered by that freeze → run
    // continues to 14 (second freeze) → miss covered, second miss resets →
    // a couple of rough days → current 8-day run (freeze earned at 7).
    recent: 'NN' + 'CHCCCCC' + 'L' + 'CCHCCCC' + 'NN' + 'L' + 'N' + 'L' + 'CCHCCCCC',
    socialHandles: { instagram: { value: 'simran.focuses', isVisible: false } },
    notificationPrefs: { friendAlerts: ['riya', 'kabir'] },
    platform: 'android',
  },
  {
    key: 'riya',
    displayName: 'Riya Sharma',
    handle: 'riya.codes',
    tagline: 'Debugging life one commit at a time 💻',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 90,
    accountAgeDays: 200,
    categories: { coding: 5, study: 1 },
    soloFromHour: 10,
    odds: { C: 0.5, H: 0.2, L: 0.1, N: 0.2 },
    recent: 'NN' + 'CCHCCCCCHCCC',
    socialHandles: { instagram: { value: 'riya.codes', isVisible: true } },
    platform: 'ios',
  },
  {
    key: 'arjun',
    displayName: 'Arjun Mehta',
    handle: 'arjun.lifts',
    tagline: 'Leg day is sacred 🦵',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 60,
    accountAgeDays: 150,
    categories: { fitness: 4, move: 2 },
    soloFromHour: 16,
    odds: { C: 0.4, H: 0.2, L: 0.15, N: 0.25 },
    recent: 'NN' + 'CHCCC',
    platform: 'android',
  },
  {
    key: 'meera',
    displayName: 'Meera Iyer',
    handle: 'meera.reads',
    tagline: '3am library gremlin 📖',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 120,
    accountAgeDays: 220,
    categories: { study: 5, creative: 1 },
    soloFromHour: 22,
    odds: { C: 0.55, H: 0.2, L: 0.1, N: 0.15 },
    recent: 'NN' + 'CCCHCCCCCCHCCCCCCCHCC',
    // Nudges off — exercises a muted category.
    notificationPrefs: { nudges: false },
    platform: 'web',
  },
  {
    key: 'kabir',
    displayName: 'Kabir Anand',
    handle: 'kabir.breathes',
    tagline: 'Breathing through the chaos 🧘',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 30,
    accountAgeDays: 35,
    categories: { wellness: 5, growth: 2 },
    soloFromHour: 7,
    odds: { C: 0.35, H: 0.25, L: 0.15, N: 0.25 },
    recent: 'NN' + 'CCC',
    platform: 'android',
  },
  {
    key: 'sara',
    displayName: 'Sara Kapoor',
    handle: 'sara.sketches',
    tagline: 'Turning coffee into color palettes 🎨',
    // Different timezone on purpose — exercises per-user day keys and the
    // together-streak "closer's day wins" tie-break.
    timezone: 'America/New_York',
    dailyTargetMin: 90,
    accountAgeDays: 180,
    categories: { creative: 4, work: 2 },
    soloFromHour: 9,
    odds: { C: 0.45, H: 0.2, L: 0.15, N: 0.2 },
    recent: 'NN' + 'CCHCCCCC',
    platform: 'ios',
  },
  {
    key: 'dev',
    displayName: 'Dev Malhotra',
    handle: 'dev.ships',
    tagline: 'Inbox zero or bust',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 60,
    accountAgeDays: 90,
    categories: { work: 5, coding: 1 },
    soloFromHour: 10,
    odds: { C: 0.4, H: 0.2, L: 0.2, N: 0.2 },
    recent: '',
    platform: 'web',
  },
  {
    key: 'priya',
    displayName: 'Priya Nair',
    handle: 'priya.grows',
    tagline: 'Small steps, big glow-up 🌱',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 30,
    accountAgeDays: 20,
    categories: { growth: 3, creative: 2 },
    soloFromHour: 17,
    odds: { C: 0.3, H: 0.25, L: 0.2, N: 0.25 },
    // 4-day gap then back → welcome_back.
    recent: 'CHC' + 'NNNN' + 'CCH',
    platform: 'android',
  },
  {
    key: 'ishaan',
    displayName: 'Ishaan Verma',
    handle: 'ishaan.walks',
    tagline: 'Steps > scrolling 🚶',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 45,
    accountAgeDays: 100,
    categories: { move: 4, study: 2 },
    soloFromHour: 6,
    odds: { C: 0.35, H: 0.25, L: 0.2, N: 0.2 },
    recent: '',
    platform: 'ios',
  },
  {
    key: 'troll',
    displayName: 'Free Followers 4U',
    handle: 'free.followers',
    tagline: 'DM for 10k followers!!!',
    timezone: 'Asia/Kolkata',
    dailyTargetMin: 30,
    accountAgeDays: 15,
    categories: { growth: 1 },
    soloFromHour: 12,
    odds: { C: 0, H: 0.05, L: 0.15, N: 0.8 },
    recent: '',
    platform: 'web',
  },
];

export interface FriendshipDef {
  a: string;
  b: string;
  requestedBy: string;
  requestedDaysAgo: number;
  respondedDaysAgo?: number; // set when accepted
  status: 'accepted' | 'pending';
}

export const FRIENDSHIPS: FriendshipDef[] = [
  // Simran's 5 friends
  { a: 'simran', b: 'riya', requestedBy: 'riya', requestedDaysAgo: 41, respondedDaysAgo: 40, status: 'accepted' },
  { a: 'simran', b: 'arjun', requestedBy: 'simran', requestedDaysAgo: 26, respondedDaysAgo: 25, status: 'accepted' },
  { a: 'simran', b: 'meera', requestedBy: 'simran', requestedDaysAgo: 61, respondedDaysAgo: 60, status: 'accepted' },
  { a: 'simran', b: 'kabir', requestedBy: 'simran', requestedDaysAgo: 11, respondedDaysAgo: 10, status: 'accepted' },
  { a: 'simran', b: 'sara', requestedBy: 'sara', requestedDaysAgo: 90, respondedDaysAgo: 89, status: 'accepted' },
  // Simran's pending requests, one each direction
  { a: 'dev', b: 'simran', requestedBy: 'dev', requestedDaysAgo: 3, status: 'pending' },
  { a: 'simran', b: 'priya', requestedBy: 'simran', requestedDaysAgo: 2, status: 'pending' },
  // The friends' own graph — Ishaan is a friend of Riya + Meera, so he's
  // Simran's top suggestion (2 mutuals) without being connected to her.
  { a: 'riya', b: 'meera', requestedBy: 'meera', requestedDaysAgo: 150, respondedDaysAgo: 150, status: 'accepted' },
  { a: 'riya', b: 'ishaan', requestedBy: 'ishaan', requestedDaysAgo: 80, respondedDaysAgo: 79, status: 'accepted' },
  { a: 'meera', b: 'ishaan', requestedBy: 'meera', requestedDaysAgo: 70, respondedDaysAgo: 70, status: 'accepted' },
  { a: 'riya', b: 'sara', requestedBy: 'riya', requestedDaysAgo: 120, respondedDaysAgo: 119, status: 'accepted' },
  { a: 'arjun', b: 'kabir', requestedBy: 'kabir', requestedDaysAgo: 30, respondedDaysAgo: 30, status: 'accepted' },
  { a: 'sara', b: 'priya', requestedBy: 'priya', requestedDaysAgo: 18, respondedDaysAgo: 17, status: 'accepted' },
];

export const BLOCKS = [{ blocker: 'simran', blocked: 'troll', daysAgo: 5 }];
export const REPORTS = [{ reporter: 'simran', reported: 'troll', reason: 'spam', daysAgo: 5 }];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Spaces that happened on earlier days. Day numbers are "days ago" in the
// host's timezone. An attendee whose day type is N that day skips it, and
// on L/H days stays only as long as that day's band allows.
export interface RecurringSpaceDef {
  key: string;
  name: string;
  description: string;
  host: string;
  category: CatSlug;
  isPublic: boolean;
  hour: number;
  minute: number;
  targetMin: number;
  maxParticipants: number | null;
  hostDays: number[];
  attendees: { user: string; days: number[] }[];
}

export const RECURRING_SPACES: RecurringSpaceDef[] = [
  {
    key: 'library',
    name: 'Library Hours',
    description: 'Silent study, phones face down.',
    host: 'simran',
    category: 'study',
    isPublic: false,
    hour: 21,
    minute: 0,
    targetMin: 90,
    maxParticipants: 6,
    hostDays: [...range(1, 8), 15, 16, 17, 18, 19, 20, 24, 25, 26],
    attendees: [{ user: 'meera', days: [...range(1, 8), 15, 16, 17, 18, 19, 20, 24, 25, 26] }],
  },
  {
    key: 'graph',
    name: 'Graph Problems Sprint',
    description: 'BFS, DFS, then one hard one. Cameras off, brains on.',
    host: 'riya',
    category: 'coding',
    isPublic: false,
    hour: 18,
    minute: 0,
    targetMin: 60,
    maxParticipants: 8,
    hostDays: range(1, 14),
    attendees: [
      { user: 'simran', days: [1, 2, 3, 4] },
      { user: 'meera', days: range(1, 11) },
      { user: 'ishaan', days: [1, 2, 3, 5, 6] },
      { user: 'sara', days: [2, 3, 6] },
    ],
  },
  {
    key: 'run',
    name: 'Morning Run Club',
    description: '5k at an easy pace. Check in, run, check out.',
    host: 'arjun',
    category: 'move',
    isPublic: true,
    hour: 7,
    minute: 0,
    targetMin: 45,
    maxParticipants: null,
    hostDays: range(1, 5),
    attendees: [
      { user: 'simran', days: [4, 5] },
      { user: 'kabir', days: [1, 2, 3] },
    ],
  },
  {
    key: 'sketch',
    name: 'Daily Sketchbook',
    description: 'One page a day. Any medium.',
    host: 'sara',
    category: 'creative',
    isPublic: true,
    hour: 19,
    minute: 0,
    targetMin: 60,
    maxParticipants: 10,
    hostDays: range(1, 10),
    attendees: [{ user: 'priya', days: range(1, 6) }],
  },
  {
    key: 'deepwork',
    name: 'Deep Work Block',
    description: 'Two pomodoros, zero Slack.',
    host: 'dev',
    category: 'work',
    isPublic: true,
    hour: 10,
    minute: 0,
    targetMin: 50,
    maxParticipants: 12,
    hostDays: range(1, 20),
    attendees: [
      { user: 'ishaan', days: [2, 4, 6, 8] },
      // Simran once dropped into a stranger's public space — that's how Dev
      // found her (his friend request is still pending).
      { user: 'simran', days: [11] },
    ],
  },
];

// ── "Right now" — positioned relative to the moment the seed runs ──────────
// Offsets are minutes from now (negative = past, null end = still open).

export interface ScriptedSpace {
  key: string;
  name: string;
  description: string | null;
  host: string | null;
  category: CatSlug;
  isPublic: boolean;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  startOffsetMin: number;
  targetMin: number;
  maxParticipants: number | null;
  invited: string[];
  syntheticCount?: number;
  sessions: { user: string; startOffsetMin: number; endOffsetMin: number | null }[];
  reactions: { from: string; to: string; type: 'clap' | 'fire' | 'fist_bump'; atOffsetMin: number }[];
  reminders?: string[]; // users who tapped "Remind me"
}

export const SCRIPTED_SPACES: ScriptedSpace[] = [
  // Live friends-only space Simran is invited to (pending) — Meera + Ishaan are in it.
  {
    key: 'graph_live',
    name: 'Graph Problems Sprint',
    description: 'BFS, DFS, then one hard one. Cameras off, brains on.',
    host: 'riya',
    category: 'coding',
    isPublic: false,
    status: 'active',
    startOffsetMin: -18,
    targetMin: 60,
    maxParticipants: 8,
    invited: ['simran', 'meera', 'ishaan', 'sara'],
    sessions: [
      { user: 'riya', startOffsetMin: -18, endOffsetMin: null },
      { user: 'meera', startOffsetMin: -14, endOffsetMin: null },
      { user: 'ishaan', startOffsetMin: -11, endOffsetMin: null },
    ],
    reactions: [
      { from: 'meera', to: 'riya', type: 'fire', atOffsetMin: -10 },
      { from: 'ishaan', to: 'riya', type: 'fist_bump', atOffsetMin: -8 },
      { from: 'riya', to: 'meera', type: 'clap', atOffsetMin: -7 },
    ],
  },
  // Live public space hosted by a friend, nobody else yet.
  {
    key: 'breathe_live',
    name: 'Breathe & Plan',
    description: 'Ten minutes of breathing, then plan the next block.',
    host: 'kabir',
    category: 'wellness',
    isPublic: true,
    status: 'active',
    startOffsetMin: -6,
    targetMin: 30,
    maxParticipants: 6,
    invited: [],
    sessions: [{ user: 'kabir', startOffsetMin: -6, endOffsetMin: null }],
    reactions: [],
  },
  // Live public space by non-friends → "Open to everyone".
  {
    key: 'sketch_live',
    name: 'Sketch & Chill',
    description: 'Lo-fi, pencils, no pressure.',
    host: 'priya',
    category: 'creative',
    isPublic: true,
    status: 'active',
    startOffsetMin: -25,
    targetMin: 60,
    maxParticipants: 10,
    invited: [],
    sessions: [
      { user: 'priya', startOffsetMin: -25, endOffsetMin: null },
      { user: 'dev', startOffsetMin: -20, endOffsetMin: null },
    ],
    reactions: [],
  },
  // Bot-seeded public rooms — synthetic counts only, never sessions/reactions (CLAUDE.md §4).
  { key: 'bot_dsa', name: 'Late Night DSA', description: 'Grinding arrays and DP problems together.', host: null, category: 'coding', isPublic: true, status: 'active', startOffsetMin: -50, targetMin: 90, maxParticipants: null, invited: [], syntheticCount: 24, sessions: [], reactions: [] },
  { key: 'bot_study', name: 'Silent Study Hall', description: 'Heads down, notes out.', host: null, category: 'study', isPublic: true, status: 'active', startOffsetMin: -35, targetMin: 120, maxParticipants: null, invited: [], syntheticCount: 41, sessions: [], reactions: [] },
  { key: 'bot_walk', name: 'Walk & Think', description: 'Out the door, phone in pocket.', host: null, category: 'move', isPublic: true, status: 'active', startOffsetMin: -15, targetMin: 30, maxParticipants: null, invited: [], syntheticCount: 9, sessions: [], reactions: [] },
  // Friend's scheduled space Simran asked to be reminded about.
  {
    key: 'legday_scheduled',
    name: 'Leg Day Crew',
    description: 'Squats, lunges, regret.',
    host: 'arjun',
    category: 'fitness',
    isPublic: false,
    status: 'scheduled',
    startOffsetMin: 120,
    targetMin: 60,
    maxParticipants: 6,
    invited: ['simran', 'kabir'],
    sessions: [],
    reactions: [],
    reminders: ['simran'],
  },
  // Simran's own scheduled space (waits for her "Start now").
  {
    key: 'marathon_scheduled',
    name: 'Weekend Study Marathon',
    description: 'Three hours, breaks every 50.',
    host: 'simran',
    category: 'study',
    isPublic: true,
    status: 'scheduled',
    startOffsetMin: 26 * 60,
    targetMin: 180,
    maxParticipants: 12,
    invited: ['meera', 'riya'],
    sessions: [],
    reactions: [],
    reminders: ['meera'],
  },
  // Expired: scheduled yesterday, host never started it.
  {
    key: 'sunrise_cancelled',
    name: 'Sunrise Sketch',
    description: 'Catch the light before work.',
    host: 'sara',
    category: 'creative',
    isPublic: false,
    status: 'cancelled',
    startOffsetMin: -20 * 60,
    targetMin: 45,
    maxParticipants: 6,
    invited: ['simran', 'priya'],
    sessions: [],
    reactions: [],
  },
  // Ended earlier today — shows in friends' "recently ended". Simran was in it.
  {
    key: 'winddown_ended',
    name: 'Wind-down Session',
    description: 'Stretch, journal, log off.',
    host: 'kabir',
    category: 'wellness',
    isPublic: false,
    status: 'completed',
    startOffsetMin: -210,
    targetMin: 40,
    maxParticipants: 6,
    invited: ['simran'],
    sessions: [
      { user: 'kabir', startOffsetMin: -210, endOffsetMin: -170 },
      { user: 'simran', startOffsetMin: -205, endOffsetMin: -175 },
    ],
    reactions: [{ from: 'kabir', to: 'simran', type: 'clap', atOffsetMin: -190 }],
  },
];

// Solo sessions relative to now (null end = open right now).
export const SCRIPTED_SOLO: { key: string; user: string; category: CatSlug; startOffsetMin: number; endOffsetMin: number | null; targetMin: number }[] = [
  { key: 'simran_morning_study', user: 'simran', category: 'study', startOffsetMin: -265, endOffsetMin: -240, targetMin: 25 },
  { key: 'arjun_live_solo', user: 'arjun', category: 'fitness', startOffsetMin: -12, endOffsetMin: null, targetMin: 45 },
];
